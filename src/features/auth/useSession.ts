import { useContext } from 'react';
import type { Permission, Session } from '@/shared/api/contracts';
import { SessionContext } from './sessionContext';

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <AuthProvider>');
  return context;
}

/** For screens behind <RequireAuth> — the session is guaranteed to exist. */
export function useCurrentSession(): Session {
  const { session } = useSession();
  if (!session) throw new Error('useCurrentSession called outside an authenticated route');
  return session;
}

/** Role-level capability check for UX (show/hide). The server re-checks every request. */
export function usePermission(permission: Permission): boolean {
  const { session } = useSession();
  return session?.permissions.includes(permission) ?? false;
}
