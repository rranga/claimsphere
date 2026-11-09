import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@/shared/api/contracts';
import { configureHttp } from '@/shared/api/http';
import { authApi } from './api';
import { SessionContext, type SessionContextValue } from './sessionContext';

/**
 * Demo note: the token is kept in sessionStorage so a refresh keeps you signed in.
 * Production: an httpOnly, SameSite cookie issued by the identity provider (no JS-readable token).
 */
const TOKEN_KEY = 'claimsphere.token';
const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionContextValue['status']>(() =>
    readToken() ? 'restoring' : 'anonymous',
  );

  const signOut = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setSession(null);
    setStatus('anonymous');
    queryClient.clear(); // never show one user's cached data to the next
  }, [queryClient]);

  // Wire the HTTP layer once; it reads the token lazily so it never holds a stale value.
  useEffect(() => {
    configureHttp({ getToken: readToken, onUnauthorized: signOut });
  }, [signOut]);

  useEffect(() => {
    if (status !== 'restoring') return;
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then((restored) => {
        setSession(restored);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') signOut();
      });
    return () => controller.abort();
  }, [status, signOut]);

  const signIn = useCallback(
    async (userId: string) => {
      const next = await authApi.login(userId);
      sessionStorage.setItem(TOKEN_KEY, next.token);
      queryClient.clear();
      setSession(next);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const value = useMemo<SessionContextValue>(
    () => ({ session, status, signIn, signOut }),
    [session, status, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
