import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { useCurrentSession } from '@/features/auth';
import { StatusBadge } from '@/features/claims';
import { claimDocumentsQuery } from '@/features/documents';
import { DocumentWorkspace } from '@/features/documents/workspace';
import { errorMessage, isApiError } from '@/shared/api/http';
import { formatCurrency } from '@/shared/lib/format';
import { ErrorFallback } from '@/shared/ui/ErrorBoundary';
import { Skeleton } from '@/shared/ui/Skeleton';
import type { WorkspaceLocationState } from './ClaimsPage';

export function WorkspacePage() {
  const { claimId = '' } = useParams();
  const location = useLocation();
  const session = useCurrentSession();
  const handoff = location.state as WorkspaceLocationState | null;
  const { data, error, refetch, isPending } = useQuery(claimDocumentsQuery(claimId));

  // Instant header from the grid's row data; replaced by fresh server data when it arrives.
  const claim = data?.claim ?? (handoff?.claim.id === claimId ? handoff.claim : undefined);
  const backTo = `/claims${handoff?.fromSearch ?? ''}`;

  return (
    <div className="flex h-full flex-col">
      <header className="border-line flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-white px-4 py-3 md:px-6">
        <Link
          to={backTo}
          viewTransition
          aria-label="Back to claims"
          className="hover:bg-brand-50 -ml-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Claims
        </Link>
        {claim ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-lg font-semibold">{claim.claimNumber}</h1>
            <StatusBadge status={claim.status} />
            <span className="text-muted text-sm">
              {claim.claimant} · {claim.lineOfBusiness} · {formatCurrency(claim.amount)} ·{' '}
              {claim.assigneeName ?? 'Unassigned'}
            </span>
          </div>
        ) : (
          <Skeleton className="h-6 w-80" />
        )}
      </header>

      <div className="min-h-0 flex-1">
        {error ? (
          <ErrorFallback
            region="Claim documents"
            error={
              new Error(
                isApiError(error) && error.status === 404
                  ? 'This claim does not exist or you no longer have access to it.'
                  : errorMessage(error),
              )
            }
            onRetry={() => void refetch()}
          />
        ) : isPending ? (
          <WorkspaceSkeleton />
        ) : (
          <DocumentWorkspace data={data} session={session} />
        )}
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading documents"
      className="grid h-full grid-cols-1 gap-0 md:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_320px]"
    >
      <div className="border-line hidden content-start gap-3 border-r bg-white p-4 md:grid">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="mx-auto h-36 w-26" />
        ))}
      </div>
      <div className="flex justify-center bg-[#eef0f6] p-8">
        <Skeleton className="aspect-[612/792] h-full max-h-[900px]" />
      </div>
      <div className="border-line hidden border-l bg-white xl:block" />
    </div>
  );
}
