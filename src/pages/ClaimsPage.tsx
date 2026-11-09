import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useCurrentSession } from '@/features/auth';
import {
  ClaimsToolbar,
  DEFAULT_GRID_PARAMS,
  PagedClaimsGrid,
  StatCards,
  toClaimQuery,
  useGridParams,
  VirtualClaimsGrid,
  type ClaimDialogState,
  type RowActionHandler,
} from '@/features/claims';
import { claimDocumentsQuery, prefetchFirstPage } from '@/features/documents';
import type { Claim, SortField } from '@/shared/api/contracts';
import { preloadWorkspace } from './workspaceRoute';

const ClaimDialogs = lazy(() => import('@/features/claims/dialogs'));

export interface WorkspaceLocationState {
  /** Row data from the grid → the workspace header renders instantly, before any fetch. */
  claim: Claim;
  /** Grid URL to return to (filters, sort, page). */
  fromSearch: string;
}

/** Page = composition root: wires independent features together (grid ↔ document workspace). */
export function ClaimsPage() {
  const { user } = useCurrentSession();
  const [params, updateParams] = useGridParams();
  const [dialog, setDialog] = useState<ClaimDialogState>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const query = toClaimQuery(params);

  const onOpen = useCallback(
    (claim: Claim) => {
      const state: WorkspaceLocationState = { claim, fromSearch: location.search };
      void navigate(`/claims/${claim.id}`, { state, viewTransition: true });
    },
    [navigate, location.search],
  );

  /**
   * Hover/focus intent → warm everything the workspace needs, in parallel:
   * the route's JS chunk, the documents manifest and the first page's byte ranges.
   */
  const onPrefetch = useCallback(
    (claim: Claim) => {
      preloadWorkspace();
      void queryClient.prefetchQuery(claimDocumentsQuery(claim.id)).then(() => {
        const data = queryClient.getQueryData(claimDocumentsQuery(claim.id).queryKey);
        const firstFileId = data?.documents[0]?.pages[0]?.fileId;
        const file = firstFileId ? data.files[firstFileId] : undefined;
        if (file) void prefetchFirstPage(file);
      });
    },
    [queryClient],
  );

  const onAction = useCallback<RowActionHandler>((type, claim) => setDialog({ type, claim }), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const onSort = useCallback(
    (field: SortField) =>
      updateParams({
        sortBy: field,
        sortDir: params.sortBy === field && params.sortDir === 'desc' ? 'asc' : 'desc',
      }),
    [updateParams, params.sortBy, params.sortDir],
  );
  const onClearFilters = useCallback(
    () => updateParams({ q: '', status: [], priority: [], channel: [] }),
    [updateParams],
  );

  const callbacks = { query, onOpen, onPrefetch, onAction, onSort, onClearFilters };

  // The page scrolls instead of clipping when the window is too short for header + KPIs + grid.
  return (
    <div className="short:gap-4 short:py-4 flex h-full flex-col gap-4 overflow-y-auto px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="short:text-xl text-xl font-medium sm:text-2xl">
            Hello {user.name.split(' ')[0]} 👋🏼,
          </h1>
          <p className="text-muted mt-1 text-sm">
            {user.title} · {user.region} region
          </p>
        </div>
      </header>

      <StatCards />

      <section
        aria-labelledby="claims-heading"
        className="shadow-card short:min-h-[360px] flex min-h-[460px] flex-1 flex-col overflow-hidden rounded-2xl bg-white max-lg:min-h-[calc(65dvh+17rem)]! sm:rounded-3xl"
      >
        <div className="short:pt-4 short:pb-3 flex flex-wrap items-center justify-between gap-4 px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
          <div>
            <h2 id="claims-heading" className="text-xl font-semibold">
              All Claims
            </h2>
            <p className="text-success-700 text-sm">Server-side sort, filter & search</p>
          </div>
        </div>
        <div className="px-4 pb-4 sm:px-6">
          <ClaimsToolbar params={params} onChange={updateParams} />
        </div>

        {params.view === 'paged' ? (
          <PagedClaimsGrid
            {...callbacks}
            page={params.page}
            pageSize={params.pageSize}
            onPageChange={(page) => updateParams({ page })}
            onPageSizeChange={(pageSize) => updateParams({ pageSize, page: DEFAULT_GRID_PARAMS.page })}
          />
        ) : (
          <VirtualClaimsGrid {...callbacks} />
        )}
      </section>

      {dialog && (
        <Suspense fallback={null}>
          <ClaimDialogs state={dialog} onClose={closeDialog} />
        </Suspense>
      )}
    </div>
  );
}
