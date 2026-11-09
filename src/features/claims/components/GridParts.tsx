import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { memo, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { Claim, SortDirection, SortField } from '@/shared/api/contracts';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui/Skeleton';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import { PriorityLabel, StatusBadge } from './ClaimBadges';
import { CARD_ROW_HEIGHT, CLAIM_COLUMNS, GRID_TEMPLATE, ROW_HEIGHT, type GridLayout } from './columns';
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
        {/* Actions are pinned to the right edge so they stay reachable while the grid scrolls sideways. */}
        <div
          role="columnheader"
          className="text-muted sticky right-0 flex items-center justify-end self-stretch bg-white px-2 text-right text-sm font-medium shadow-[-10px_0_10px_-10px_rgba(41,45,50,0.25)]"
        >
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
  /** `cards` below 1024 px: one stacked card per claim instead of an 11-column row. */
  layout?: GridLayout;
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
  layout = 'table',
}: ClaimRowProps) {
  const intentTimer = useRef<number | undefined>(undefined);
  const cards = layout === 'cards';
  const style: CSSProperties = {
    ...(!cards && { gridTemplateColumns: GRID_TEMPLATE }),
    height: cards ? CARD_ROW_HEIGHT : ROW_HEIGHT,
    ...(top !== undefined && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      transform: `translateY(${top}px)`,
    }),
  };

  if (!claim && cards) {
    return (
      <div
        role="row"
        aria-rowindex={index + 2}
        aria-busy="true"
        className="border-line border-b"
        style={style}
      >
        <div role="gridcell" className="flex h-full flex-col justify-center gap-2.5 px-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

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
        'group border-line cursor-pointer border-b text-sm transition-colors outline-none',
        cards ? 'block' : 'grid items-center px-6',
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
      {cards ? (
        <div
          role="gridcell"
          aria-colspan={CLAIM_COLUMNS.length + 1}
          className="flex h-full flex-col justify-center gap-1.5 px-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{claim.claimNumber}</span>
            <StatusBadge status={claim.status} />
          </div>
          <div className="text-muted truncate text-xs">
            {claim.claimant} · {claim.lineOfBusiness} · {claim.channel}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium tabular-nums">{formatCurrency(claim.amount)}</span>
            <PriorityLabel priority={claim.priority} riskScore={claim.riskScore} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted truncate text-xs">
              {claim.assigneeName ?? 'Unassigned'} · {formatDate(claim.receivedAt)}
            </span>
            <RowActions claim={claim} onAction={onAction} />
          </div>
        </div>
      ) : (
        <>
          {CLAIM_COLUMNS.map((column) => (
            <div
              key={column.id}
              role="gridcell"
              className={cn('min-w-0 truncate px-2', column.align === 'right' && 'text-right')}
            >
              {column.cell(claim)}
            </div>
          ))}
          <div
            role="gridcell"
            className="group-focus-visible:bg-brand-50 sticky right-0 flex h-full items-center justify-end bg-white px-2 shadow-[-10px_0_10px_-10px_rgba(41,45,50,0.25)] group-hover:bg-[#f9f8ff]"
          >
            <RowActions claim={claim} onAction={onAction} />
          </div>
        </>
      )}
    </div>
  );
});
