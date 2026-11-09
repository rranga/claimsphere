import type { ClaimAction, DocumentCapabilities, Permission, Role, User } from '@/shared/api/contracts';
import type { ClaimRecord } from '../data/claims';

/**
 * Authorization policy — lives on the SERVER. It is the single source of truth:
 * every endpoint re-checks it, and the UI only receives its *results*
 * (`permissions` on the session, `allowedActions` per row, `capabilities` per claim).
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ['claim:read', 'document:read'],
  adjuster: [
    'claim:read',
    'claim:edit',
    'document:read',
    'document:edit',
    'document:comment',
    'document:annotate',
  ],
  supervisor: [
    'claim:read',
    'claim:edit',
    'claim:assign',
    'document:read',
    'document:edit',
    'document:comment',
    'document:annotate',
  ],
  admin: [
    'claim:read',
    'claim:edit',
    'claim:assign',
    'claim:delete',
    'document:read',
    'document:edit',
    'document:comment',
    'document:annotate',
  ],
};

export const hasPermission = (user: User, permission: Permission) =>
  ROLE_PERMISSIONS[user.role].includes(permission);

/** Record-level visibility (data scoping). Adjusters and supervisors work their region's queue. */
export function canSeeClaim(user: User, claim: ClaimRecord): boolean {
  switch (user.role) {
    case 'admin':
    case 'viewer': // auditors have read-only access to everything
      return true;
    case 'supervisor':
    case 'adjuster':
      return claim.region === user.region;
  }
}

const isLocked = (claim: ClaimRecord) => claim.status === 'Closed';

/** Adjusters can only change claims assigned to them; supervisors/admins can change any visible claim. */
const ownsWork = (user: User, claim: ClaimRecord) => user.role !== 'adjuster' || claim.assigneeId === user.id;

export function allowedActions(user: User, claim: ClaimRecord): ClaimAction[] {
  if (!canSeeClaim(user, claim)) return [];
  const actions: ClaimAction[] = ['view'];
  if (hasPermission(user, 'claim:edit') && !isLocked(claim) && ownsWork(user, claim)) actions.push('edit');
  if (hasPermission(user, 'claim:assign') && !isLocked(claim)) actions.push('assign');
  if (hasPermission(user, 'claim:delete')) actions.push('delete');
  return actions;
}

export function documentCapabilities(user: User, claim: ClaimRecord): DocumentCapabilities {
  const visible = canSeeClaim(user, claim);
  const writable = visible && !isLocked(claim) && ownsWork(user, claim);
  return {
    edit: writable && hasPermission(user, 'document:edit'),
    annotate: writable && hasPermission(user, 'document:annotate'),
    // Commenting is collaboration, not mutation of the record — any visible, permitted user can comment.
    comment: visible && hasPermission(user, 'document:comment'),
  };
}
