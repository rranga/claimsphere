import { keepPreviousData, queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Claim, ClaimPage, ClaimQuery } from '@/shared/api/contracts';
import { claimsApi } from './claimsApi';

/** Server rows are fetched in fixed-size blocks; one block == one cache entry. */
export const BLOCK_SIZE = 100;

/** Hierarchical query keys → precise invalidation (e.g. all lists, but not stats). */
export const claimKeys = {
  all: ['claims'] as const,
  lists: () => [...claimKeys.all, 'list'] as const,
  block: (query: ClaimQuery, block: number) => [...claimKeys.lists(), 'block', query, block] as const,
  page: (query: ClaimQuery, page: number, size: number) =>
    [...claimKeys.lists(), 'page', query, page, size] as const,
  stats: () => [...claimKeys.all, 'stats'] as const,
  assignable: (region: string) => ['users', 'assignable', region] as const,
};

export const claimBlockQuery = (query: ClaimQuery, block: number) =>
  queryOptions({
    queryKey: claimKeys.block(query, block),
    queryFn: ({ signal }) => claimsApi.list(query, block * BLOCK_SIZE, BLOCK_SIZE, signal),
    staleTime: 30_000,
    // Blocks scrolled out of view are garbage-collected after 60s → memory stays bounded
    // no matter how far the user scrolls (unlike infinite scroll, which only grows).
    gcTime: 60_000,
  });

export const claimPageQuery = (query: ClaimQuery, page: number, size: number) =>
  queryOptions({
    queryKey: claimKeys.page(query, page, size),
    queryFn: ({ signal }) => claimsApi.list(query, (page - 1) * size, size, signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData, // no flash of empty table between pages
  });

export const claimStatsQuery = () =>
  queryOptions({
    queryKey: claimKeys.stats(),
    queryFn: ({ signal }) => claimsApi.stats(signal),
    staleTime: 60_000,
  });

export const assignableUsersQuery = (region: string) =>
  queryOptions({
    queryKey: claimKeys.assignable(region),
    queryFn: ({ signal }) => claimsApi.assignableUsers(region, signal),
    staleTime: 5 * 60_000,
  });

/**
 * Patch one claim inside every cached block/page that contains it — O(cached rows), no refetch.
 * Returns a rollback function for optimistic updates.
 */
export function patchCachedClaim(
  queryClient: QueryClient,
  id: string,
  patch: (claim: Claim) => Claim,
): () => void {
  const snapshots = queryClient.getQueriesData<ClaimPage>({ queryKey: claimKeys.lists() });
  queryClient.setQueriesData<ClaimPage>({ queryKey: claimKeys.lists() }, (page) => {
    if (!page?.rows.some((row) => row.id === id)) return page;
    return { ...page, rows: page.rows.map((row) => (row.id === id ? patch(row) : row)) };
  });
  return () => snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
}
