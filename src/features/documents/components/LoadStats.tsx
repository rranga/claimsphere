import { Gauge } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { SourceFile } from '@/shared/api/contracts';
import { formatBytes } from '@/shared/lib/format';
import { loadStatsStore } from '../viewer/pdfEngine';

/**
 * Live proof of partial loading: "Fetched 2.1 MB of 1.0 GB (0.2%)". Reads the pdf engine's
 * external store via useSyncExternalStore (tear-free, no Redux/Context churn).
 */
export function LoadStats({ files }: { files: SourceFile[] }) {
  const snapshot = useSyncExternalStore(loadStatsStore.subscribe, () =>
    files.map((f) => loadStatsStore.get(f.id)?.bytesFetched ?? 0).join(','),
  );
  const fetched = snapshot.split(',').reduce((sum, n) => sum + Number(n), 0);
  const total = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const pct = total ? (fetched / total) * 100 : 0;

  return (
    <span
      className="bg-success-50 text-success-700 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      title="Bytes actually downloaded via HTTP Range requests vs. the full size of this document's source files"
    >
      <Gauge className="size-3.5" aria-hidden="true" />
      Fetched {formatBytes(fetched)} of {formatBytes(total)} ({pct < 0.1 && pct > 0 ? '<0.1' : pct.toFixed(1)}
      %)
    </span>
  );
}
