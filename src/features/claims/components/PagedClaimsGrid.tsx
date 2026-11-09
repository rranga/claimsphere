import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type KeyboardEvent } from 'react';
import type { ClaimQuery, SortField } from '@/shared/api/contracts';
import { claimPageQuery } from '../api/queries';
import { getNextRowIndex } from '../model/gridKeyboard';
import { ClaimRow, GridHeader, type RowCallbacks } from './GridParts';
import { GridEmptyState, GridErrorState } from './GridStates';
import { PaginationBar } from './PaginationBar';

interface Props extends Omit<RowCallbacks, 'onFocusRow'> {
  query: ClaimQuery;
  page: number;
  pageSize: number;
  onSort: (field: SortField) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onClearFilters: () => void;
}

/** Classic server-side pagination (the Figma footer). Same row components and data API as the virtual grid. */
export function PagedClaimsGrid({
  query,
  page,
  pageSize,
  onSort,
  onPageChange,
  onPageSizeChange,
  onClearFilters,
  ...callbacks
}: Props) {
  const { data, error, isPending, isPlaceholderData, refetch } = useQuery(
    claimPageQuery(query, page, pageSize),
  );
  const gridRef = useRef<HTMLDivElement>(null);
  /** Absolute row index (page offset included) so `setActiveIndex` can be passed to memoized rows as-is. */
  const [activeIndex, setActiveIndex] = useState(0);

  if (error && !data) return <GridErrorState error={error} onRetry={() => void refetch()} />;
  if (data?.total === 0) return <GridEmptyState onClearFilters={onClearFilters} />;

  const rows = data?.rows ?? [];
  const offset = (page - 1) * pageSize;
  // Exactly one row is tabbable (roving tabindex); fall back to the first row after a page change.
  const tabbableIndex = activeIndex >= offset && activeIndex < offset + rows.length ? activeIndex : offset;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = getNextRowIndex(event.key, tabbableIndex - offset, rows.length, 10);
    if (next === null) return;
    event.preventDefault();
    setActiveIndex(offset + next);
    gridRef.current?.querySelector<HTMLElement>(`[data-row-index="${offset + next}"]`)?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={gridRef}
        role="grid"
        aria-label="Claims"
        aria-rowcount={(data?.total ?? 0) + 1}
        aria-busy={isPending || isPlaceholderData}
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-auto"
        onKeyDown={onKeyDown}
      >
        <div className={`min-w-[1420px] transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <GridHeader sortBy={query.sortBy} sortDir={query.sortDir} onSort={onSort} />
          <div role="rowgroup">
            {isPending
              ? Array.from({ length: 10 }, (_, i) => (
                  <ClaimRow
                    key={i}
                    claim={undefined}
                    index={i}
                    active={false}
                    {...callbacks}
                    onFocusRow={setActiveIndex}
                  />
                ))
              : rows.map((claim, i) => (
                  <ClaimRow
                    key={claim.id}
                    claim={claim}
                    index={offset + i}
                    active={offset + i === tabbableIndex}
                    onFocusRow={setActiveIndex}
                    {...callbacks}
                  />
                ))}
          </div>
        </div>
      </div>
      <PaginationBar
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
