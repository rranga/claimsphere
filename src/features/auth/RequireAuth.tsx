import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/shared/ui/Spinner';
import { useSession } from './useSession';

export function RequireAuth() {
  const { status } = useSession();
  const location = useLocation();
  if (status === 'restoring') return <FullPageSpinner label="Restoring your session…" />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
