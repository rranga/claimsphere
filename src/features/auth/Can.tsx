import type { ReactNode } from 'react';
import type { Permission } from '@/shared/api/contracts';
import { usePermission } from './useSession';

interface CanProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Declarative permission gate: <Can permission="claim:delete">…</Can>. UX only — never a security boundary. */
export function Can({ permission, children, fallback = null }: CanProps) {
  return usePermission(permission) ? children : fallback;
}
