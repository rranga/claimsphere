import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { memo, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { Claim, SortDirection, SortField } from '@/shared/api/contracts';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui/Skeleton';
import { CLAIM_COLUMNS, GRID_TEMPLATE, ROW_HEIGHT } from './columns';
import { RowActions, type RowActionHandler } from './RowActions';

export interface RowCallbacks {
  onOpen: (claim: Claim) => void;
  onPrefetch: (claim: Claim) => void;
  onAction: RowActionHandler;
  onFocusRow: (index: number) => void;
}

interface HeaderProps {
  sortBy: SortField;
  sortDir: SortDirection;
  onSort: (field: SortField) => void;
}

export function GridHeader({ sortBy, sortDir, onSort }: HeaderProps) {
  return (
    <div role="rowgroup" className="border-line sticky top-0 z-10 border-b bg-white">
      <div
        role="row"
        aria-rowindex={1}
        className="grid items-center px-6"
        style={{ gridTemplateColumns: GRID_TEMPLATE, height: 48 }}
      >
        {CLAIM_COLUMNS.map((column) => {
          const active = column.sortField === sortBy;
          const ariaSort = active
            ? sortDir === 'asc'
              ? 'ascending'
              : 'descending'
            : column.sortField
              ? 'none'
              : undefined;
          return (
            <div
              key={column.id}
              role="columnheader"
              aria-sort={ariaSort}
              className={cn('text-muted px-2 text-sm font-medium', column.align === 'right' && 'text-right')}
            >
              {column.sortField ? (
                <button
                  type="button"
                  onClick={() => onSort(column.sortField!)}
                  className={cn(
                    'hover:text-ink inline-flex items-center gap-1 rounded',
                    active && 'text-brand-600',
                    column.align === 'right' && 'flex-row-reverse',
                  )}
                >
                  {column.header}
                  {active ? (
                    sortDir === 'asc' ? (
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />
                  )}
                </button>
              ) : (
                column.header
              )}
            </div>
          );
        })}
        <div role="columnheader" className="text-muted px-2 text-right text-sm font-medium">
          Actions
        </div>
      </div>
    </div>
  );
}

interface ClaimRowProps extends RowCallbacks {
  claim: Claim | undefined;
  index: number;
  /** Absolute offset for virtualized rendering; omitted in paged (normal flow) mode. */
  top?: number;
  active: boolean;
}

const PREFETCH_INTENT_MS = 120;

/**
 * Memoized: while scrolling, only rows *entering* the window render. Callbacks are stable
 * (useCallback in the parent), and `claim` objects keep identity thanks to TanStack Query's
 * structural sharing — so an unchanged row never re-renders.
 */
export const ClaimRow = memo(function ClaimRow({
  claim,
  index,
  top,
  active,
  onOpen,
  onPrefetch,
  onAction,
  onFocusRow,
}: ClaimRowProps) {
  const intentTimer = useRef<number | undefined>(undefined);
  const style: CSSProperties = {
    gridTemplateColumns: GRID_TEMPLATE,
    height: ROW_HEIGHT,
    ...(top !== undefined && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      transform: `translateY(${top}px)`,
    }),
  };

  if (!claim) {
    return (
      <div
        role="row"
        aria-rowindex={index + 2}
        aria-busy="true"
        className="border-line grid items-center border-b px-6"
        style={style}
      >
        {CLAIM_COLUMNS.map((column) => (
          <div key={column.id} role="gridcell" className="px-2">
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        ))}
        <div role="gridcell" />
      </div>
    );
  }

  // Prefetch on *intent* (hover ≥120 ms or keyboard focus) — not on every pointer pass while scrolling.
  const startIntent = () => {
    window.clearTimeout(intentTimer.current);
    intentTimer.current = window.setTimeout(() => onPrefetch(claim), PREFETCH_INTENT_MS);
  };
  const cancelIntent = () => window.clearTimeout(intentTimer.current);

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      data-row-index={index}
      tabIndex={active ? 0 : -1}
      aria-label={`${claim.claimNumber}, ${claim.claimant}, ${claim.status}. Press Enter to open documents.`}
      className={cn(
        'group border-line grid cursor-pointer items-center border-b px-6 text-sm transition-colors outline-none',
        'hover:bg-brand-50/50 focus-visible:bg-brand-50 focus-visible:ring-brand-500 focus-visible:ring-2 focus-visible:ring-inset',
      )}
      style={style}
      onClick={() => onOpen(claim)}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Enter') onOpen(claim);
      }}
      onFocus={() => {
        onFocusRow(index);
        onPrefetch(claim);
      }}
      onMouseEnter={startIntent}
      onMouseLeave={cancelIntent}
    >
      {CLAIM_COLUMNS.map((column) => (
        <div
          key={column.id}
          role="gridcell"
          className={cn('min-w-0 truncate px-2', column.align === 'right' && 'text-right')}
        >
          {column.cell(claim)}
        </div>
      ))}
      <div role="gridcell" className="px-2">
        <RowActions claim={claim} onAction={onAction} />
      </div>
    </div>
  );
});
