import { AlertCircle, RotateCw } from 'lucide-react';
import type { RenderTask } from 'pdfjs-dist';
import { memo, useEffect, useRef, useState } from 'react';
import type { Rotation, SourceFile } from '@/shared/api/contracts';
import { Skeleton } from '@/shared/ui/Skeleton';
import { displayAspect } from '../lib/geometry';
import { openPdf } from './pdfEngine';

interface PageCanvasProps {
  file: SourceFile;
  /** 0-based page index inside the source file. */
  pageIndex: number;
  rotation: Rotation;
  /** CSS width in px; height follows the page's aspect ratio. */
  width: number;
  /**
   * Debounce before rendering. While the user flings through hundreds of pages, pages that are
   * mounted and unmounted within this window never hit the PDF worker at all.
   */
  renderDelayMs?: number;
}

const MAX_DPR = 2; // cap: a 4K/3x display would otherwise allocate ~9x the canvas memory

/**
 * Renders one PDF page to a canvas, sized for the current zoom and device pixel ratio.
 * Memory discipline: on unmount or when its inputs change, the in-flight render is cancelled and
 * the canvas backing store is released (width = 0) — off-screen pages hold no bitmaps.
 */
export const PageCanvas = memo(function PageCanvas({
  file,
  pageIndex,
  rotation,
  width,
  renderDelayMs = 60,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderKey = `${file.id}:${pageIndex}:${rotation}:${width}`;
  const [rendered, setRendered] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const height = Math.round(width * displayAspect(file.pageWidth, file.pageHeight, rotation));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    const timer = window.setTimeout(async () => {
      try {
        const pdf = await openPdf(file);
        if (cancelled) return;
        const page = await pdf.getPage(pageIndex + 1);
        if (cancelled) return;
        const angle = (page.rotate + rotation) % 360;
        const unscaled = page.getViewport({ scale: 1, rotation: angle });
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const viewport = page.getViewport({ scale: (width / unscaled.width) * dpr, rotation: angle });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = page.render({ canvas, viewport });
        await task.promise;
        if (!cancelled) setRendered(renderKey);
      } catch (error) {
        if (cancelled || (error as Error).name === 'RenderingCancelledException') return;
        setFailed({ key: renderKey, message: (error as Error).message });
      }
    }, renderDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      task?.cancel();
      canvas.width = 0; // release the bitmap immediately instead of waiting for GC
      canvas.height = 0;
    };
  }, [file, pageIndex, rotation, width, renderDelayMs, renderKey, attempt]);

  const isReady = rendered === renderKey;
  const error = failed?.key === renderKey ? failed.message : null;

  return (
    <div className="relative bg-white" style={{ width, height }}>
      <canvas ref={canvasRef} className="block" style={{ width, height }} aria-hidden="true" />
      {!isReady && !error && <Skeleton className="absolute inset-0 rounded-none" />}
      {error && (
        <div
          role="alert"
          className="text-danger-500 absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs"
        >
          <AlertCircle className="size-5" aria-hidden="true" />
          <span className="line-clamp-3">{error}</span>
          <button
            type="button"
            className="border-line text-ink inline-flex items-center gap-1 rounded border bg-white px-2 py-1"
            onClick={() => {
              setFailed(null);
              setAttempt((n) => n + 1);
            }}
          >
            <RotateCw className="size-3" aria-hidden="true" /> Retry
          </button>
        </div>
      )}
    </div>
  );
});
