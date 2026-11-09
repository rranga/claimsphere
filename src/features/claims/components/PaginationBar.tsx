import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatNumber } from '@/shared/lib/format';
import { PAGE_SIZES } from '../model/gridParams';
import { pageWindow } from '../model/pagination';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function PaginationBar({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pill = 'inline-flex size-7 items-center justify-center rounded border text-xs';

  return (
    <footer className="border-line text-muted flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3 text-xs">
      <div className="flex items-center gap-3">
        <span aria-live="polite">
          Showing data {formatNumber(from)} to {formatNumber(to)} of {formatNumber(total)} entries
        </span>
        <label className="flex items-center gap-1.5">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border-line text-ink h-7 rounded border bg-white px-1.5 text-xs"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      <nav aria-label="Pagination" className="flex items-center gap-1.5">
        <button
          type="button"
          className={cn(pill, 'border-line bg-canvas', page === 1 && 'opacity-40')}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                pill,
                'min-w-7 px-1.5',
                p === page
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-canvas text-ink hover:bg-brand-50',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={cn(pill, 'border-line bg-canvas', page >= totalPages && 'opacity-40')}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </nav>
    </footer>
  );
}
