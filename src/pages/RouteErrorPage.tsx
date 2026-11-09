import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';
import { ErrorFallback } from '@/shared/ui/ErrorBoundary';

/** Last-resort boundary for errors thrown while loading/rendering a route (e.g. a failed lazy chunk). */
export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected error';
  return (
    <main className="h-full">
      <ErrorFallback region="This screen" error={new Error(message)} onRetry={() => void navigate(0)} />
    </main>
  );
}
