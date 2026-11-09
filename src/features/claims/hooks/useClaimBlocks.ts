import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Claim, ClaimPage, ClaimQuery } from '@/shared/api/contracts';
import { BLOCK_SIZE, claimBlockQuery, claimKeys } from '../api/queries';

export interface ClaimBlocks {
  /** Total rows matching the query (undefined until the first block arrives). */
  total: number | undefined;
  getRow: (index: number) => Claim | undefined;
  isInitialLoading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * Server-side row model for the virtualized grid ("windowed block loading").
 *
 *  - Only blocks intersecting the visible window (+ overscan) are requested.
 *  - Each block is an independent TanStack Query entry → deduped, cached, cancellable,
 *    and garbage-collected when it scrolls away.
 *  - Sorting/filtering happen on the server, so the client never holds 20k+ rows.
 */
export function useClaimBlocks(query: ClaimQuery, visibleStart: number, visibleEnd: number): ClaimBlocks {
  const queryClient = useQueryClient();
  const firstBlock = Math.floor(Math.max(0, visibleStart) / BLOCK_SIZE);
  const lastBlock = Math.floor(Math.max(0, visibleEnd) / BLOCK_SIZE);
  const blockIndexes = useMemo(
    () => Array.from({ length: lastBlock - firstBlock + 1 }, (_, i) => firstBlock + i),
    [firstBlock, lastBlock],
  );

  const combine = useCallback(
    (results: UseQueryResult<ClaimPage>[]) => ({
      pages: results.map((r) => r.data),
      error: results.find((r) => r.error)?.error ?? null,
      pending: results.every((r) => r.isPending),
      refetchers: results.map((r) => r.refetch),
    }),
    [],
  );

  const { pages, error, pending, refetchers } = useQueries({
    queries: blockIndexes.map((block) => claimBlockQuery(query, block)),
    combine,
  });

  // While a jump-scroll loads new blocks, keep the total from any cached block of the same
  // query so the scrollbar never collapses.
  const total =
    pages.find(Boolean)?.total ??
    queryClient
      .getQueriesData<ClaimPage>({ queryKey: [...claimKeys.lists(), 'block', query] })
      .find(([, data]) => data)?.[1]?.total;

  const getRow = useCallback(
    (index: number) => {
      const page = pages[Math.floor(index / BLOCK_SIZE) - firstBlock];
      return page?.rows[index - page.offset];
    },
    [pages, firstBlock],
  );

  const retry = useCallback(() => refetchers.forEach((refetch) => void refetch()), [refetchers]);

  return { total, getRow, isInitialLoading: pending && total === undefined, error, retry };
}
