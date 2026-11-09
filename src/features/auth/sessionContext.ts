import { createContext } from 'react';
import type { Session } from '@/shared/api/contracts';

export interface SessionContextValue {
  session: Session | null;
  status: 'restoring' | 'authenticated' | 'anonymous';
  signIn: (userId: string) => Promise<void>;
  signOut: () => void;
}

/**
 * Context (not Redux) on purpose: the session is read everywhere but changes only on sign-in/out,
 * so the re-render cost of a context update is irrelevant here.
 */
export const SessionContext = createContext<SessionContextValue | null>(null);
