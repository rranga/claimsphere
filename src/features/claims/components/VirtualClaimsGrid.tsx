import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ClaimQuery, SortField } from '@/shared/api/contracts';
import { formatNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { useClaimBlocks } from '../hooks/useClaimBlocks';
import { ROW_HEIGHT } from './columns';
import { getNextRowIndex } from '../model/gridKeyboard';
import { ClaimRow, GridHeader, type RowCallbacks } from './GridParts';
import { GridEmptyState, GridErrorState } from './GridStates';

interface Props extends Omit<RowCallbacks, 'onFocusRow'> {
  query: ClaimQuery;
  onSort: (field: SortField) => void;
  onClearFilters: () => void;
}

/**
 * Virtualized grid over a server-side row model:
 *  • DOM size is constant (~visible rows + overscan) whether there are 2k or 2M matches.
 *  • The scrollbar represents the full result set — users can jump to row 15,000 directly,
 *    which infinite scroll cannot do.
 */
export function VirtualClaimsGrid({ query, onSort, onClearFilters, ...callbacks }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 30 });
  const blocks = useClaimBlocks(query, range.start, range.end);
  const rowCount = blocks.total ?? 0;

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns imperative APIs by design; rows are memoized separately.
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    onChange: (instance) => {
      const items = instance.getVirtualItems();
      const start = items[0]?.index ?? 0;
      const end = items[items.length - 1]?.index ?? 30;
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    },
  });

  // New query → back to the top (the old scroll offset is meaningless for a different result set).
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [queryKey]);

  const focusRow = (index: number) => {
    setActiveIndex(index);
    virtualizer.scrollToIndex(index, { align: 'auto' });
    // Row may need a frame to mount after scrolling.
    requestAnimationFrame(() =>
      scrollRef.current
        ?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
        ?.focus({ preventScroll: true }),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const pageRows = Math.floor((scrollRef.current?.clientHeight ?? 600) / ROW_HEIGHT) - 1;
    const next = getNextRowIndex(event.key, activeIndex, rowCount, pageRows);
    if (next === null) return;
    event.preventDefault();
    focusRow(next);
  };

  if (blocks.error && blocks.total === undefined)
    return <GridErrorState error={blocks.error} onRetry={blocks.retry} />;
  if (blocks.total === 0) return <GridEmptyState onClearFilters={onClearFilters} />;

  const items = virtualizer.getVirtualItems();
  const first = items[0]?.index ?? 0;
  const last = items[items.length - 1]?.index ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        role="grid"
        aria-label="Claims"
        aria-rowcount={rowCount + 1}
        aria-busy={blocks.isInitialLoading}
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-auto [overflow-anchor:none]"
        onKeyDown={onKeyDown}
      >
        <div className="min-w-[1420px]">
          <GridHeader sortBy={query.sortBy} sortDir={query.sortDir} onSort={onSort} />
          <div
            role="rowgroup"
            className="relative"
            style={{ height: blocks.isInitialLoading ? ROW_HEIGHT * 12 : virtualizer.getTotalSize() }}
          >
            {blocks.isInitialLoading
              ? Array.from({ length: 12 }, (_, i) => (
                  <ClaimRow
                    key={i}
                    claim={undefined}
                    index={i}
                    top={i * ROW_HEIGHT}
                    active={false}
                    {...callbacks}
                    onFocusRow={setActiveIndex}
                  />
                ))
              : items.map((item) => (
                  <ClaimRow
                    key={item.key}
                    claim={blocks.getRow(item.index)}
                    index={item.index}
                    top={item.start}
                    active={item.index === activeIndex}
                    onFocusRow={setActiveIndex}
                    {...callbacks}
                  />
                ))}
          </div>
        </div>
      </div>
      <footer className="border-line text-muted flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3 text-xs">
        <span aria-live="polite">
          {blocks.total === undefined
            ? 'Loading claims…'
            : `Showing ${formatNumber(first + 1)}–${formatNumber(last + 1)} of ${formatNumber(rowCount)} claims`}
        </span>
        {blocks.error && (
          <span role="alert" className="text-danger-500 flex items-center gap-2">
            Some rows failed to load.
            <Button size="sm" onClick={blocks.retry}>
              Retry
            </Button>
          </span>
        )}
        <span title="Only the rows in view are mounted — the DOM size stays constant regardless of the total.">
          Virtualized · {items.length} rows in DOM
        </span>
      </footer>
    </div>
  );
}
