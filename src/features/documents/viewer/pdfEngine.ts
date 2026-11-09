import { getDocument, GlobalWorkerOptions, PDFDataRangeTransport, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SourceFile } from '@/shared/api/contracts';
import { LruCache } from '@/shared/lib/lruCache';

// PDF parsing and rasterization run in pdf.js' own Web Worker — the main thread only paints.
GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * 256 KB chunks: small enough that the first page of a 1 GB file needs only a few hundred KB,
 * large enough to keep request counts low. pdf.js coalesces adjacent missing chunks into one request.
 */
const RANGE_CHUNK_SIZE = 256 * 1024;
/** Keep at most N open documents; evicting one destroys it in the worker and frees its memory. */
const MAX_OPEN_DOCUMENTS = 4;

// ---------------------------------------------------------------------------
// Network statistics — a tiny external store (consumed with useSyncExternalStore).
// ---------------------------------------------------------------------------
interface FileLoadStats {
  bytesFetched: number;
  requests: number;
  totalBytes: number;
  error?: string;
}

const stats = new Map<string, FileLoadStats>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const loadStatsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: (fileId: string) => stats.get(fileId),
};

function recordStats(fileId: string, patch: Partial<FileLoadStats>) {
  const current = stats.get(fileId) ?? { bytesFetched: 0, requests: 0, totalBytes: 0 };
  stats.set(fileId, { ...current, ...patch }); // new object → useSyncExternalStore sees a change
  emit();
}

// ---------------------------------------------------------------------------
// Custom HTTP Range transport.
// pdf.js' default loader first issues a full GET and aborts it once it sees `Accept-Ranges`.
// Because the server already told us the file size, we skip that entirely: every byte that
// crosses the network is an explicit, abortable, accounted-for Range request.
// ---------------------------------------------------------------------------
class HttpRangeTransport extends PDFDataRangeTransport {
  private readonly controller = new AbortController();

  constructor(
    private readonly file: SourceFile,
    private readonly onError: (error: Error) => void,
  ) {
    super(file.sizeBytes, null);
  }

  override requestDataRange(begin: number, end: number): void {
    const { file } = this;
    recordStats(file.id, { requests: (stats.get(file.id)?.requests ?? 0) + 1 });
    fetch(file.url, { headers: { Range: `bytes=${begin}-${end - 1}` }, signal: this.controller.signal })
      .then(async (response) => {
        if (response.status !== 206) {
          throw new Error(`Document server did not honour the byte-range request (HTTP ${response.status}).`);
        }
        const chunk = new Uint8Array(await response.arrayBuffer());
        recordStats(file.id, { bytesFetched: (stats.get(file.id)?.bytesFetched ?? 0) + chunk.byteLength });
        this.onDataRange(begin, chunk);
      })
      .catch((error: unknown) => {
        if (this.controller.signal.aborted) return;
        this.onError(error instanceof Error ? error : new Error(String(error)));
      });
  }

  override abort(): void {
    this.controller.abort();
  }
}

// ---------------------------------------------------------------------------
// Document cache
// ---------------------------------------------------------------------------
interface OpenDocument {
  promise: Promise<PDFDocumentProxy>;
  destroy: () => void;
}

const cache = new LruCache<string, OpenDocument>(MAX_OPEN_DOCUMENTS, (_id, doc) => doc.destroy());

/** Open (or reuse) a PDF. Only the xref/trailer and requested pages are ever downloaded. */
export function openPdf(file: SourceFile): Promise<PDFDocumentProxy> {
  const cached = cache.get(file.id);
  if (cached) return cached.promise;

  recordStats(file.id, { bytesFetched: 0, requests: 0, totalBytes: file.sizeBytes, error: undefined });

  let rejectOnTransportError: (error: Error) => void = () => undefined;
  const transportFailed = new Promise<never>((_, reject) => {
    rejectOnTransportError = reject;
  });

  const transport = new HttpRangeTransport(file, (error) => {
    recordStats(file.id, { error: error.message });
    rejectOnTransportError(error);
    evictPdf(file.id); // allow a clean retry
  });

  const task = getDocument({
    range: transport,
    length: file.sizeBytes,
    rangeChunkSize: RANGE_CHUNK_SIZE,
    disableAutoFetch: true, // never background-download the rest of a 1 GB file
    disableStream: true,
    enableXfa: false,
  });

  const promise = Promise.race([task.promise, transportFailed]);
  promise.catch(() => undefined); // errors are surfaced to callers; avoid unhandled-rejection noise
  cache.set(file.id, {
    promise,
    destroy: () => {
      transport.abort();
      void task.destroy();
    },
  });
  return promise;
}

function evictPdf(fileId: string) {
  const entry = cache.get(fileId);
  if (!entry) return;
  entry.destroy();
  cache.delete(fileId);
}

/** Warm the document on hover intent so the workspace opens with the first page ready. */
export function prefetchFirstPage(file: SourceFile) {
  void openPdf(file)
    .then((pdf) => pdf.getPage(1))
    .catch(() => undefined);
}
