import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { Can, useSession } from '@/features/auth';
import type { Claim, ClaimAction } from '@/shared/api/contracts';
import { Button } from '@/shared/ui/Button';
import { Tooltip } from '@/shared/ui/Tooltip';

export type RowActionHandler = (action: Exclude<ClaimAction, 'view'>, claim: Claim) => void;

/**
 * RBAC presentation rules (UX only — the server re-checks every request):
 *   • HIDE    when the user's role can never perform the action (e.g. Viewer → Delete).
 *   • DISABLE when the role could, but not on this record (closed claim, not the assignee) —
 *             with a tooltip explaining why. `allowedActions` is computed by the server per row.
 */
function disabledReason(action: ClaimAction, claim: Claim, userId: string): string {
  if (claim.status === 'Closed') return 'Closed claims are read-only';
  if (action === 'edit' && claim.assigneeId !== userId)
    return 'Only the assigned adjuster can edit this claim';
  return 'You are not allowed to perform this action on this claim';
}

function ActionButton({
  label,
  icon,
  allowed,
  reason,
  danger,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  allowed: boolean;
  reason: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={allowed ? label : reason}>
      <Button
        size="icon"
        variant={danger ? 'danger-ghost' : 'ghost'}
        aria-label={allowed ? label : `${label} (unavailable: ${reason})`}
        aria-disabled={!allowed}
        onClick={(event) => {
          event.stopPropagation(); // don't open the workspace
          onClick();
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {icon}
      </Button>
    </Tooltip>
  );
}

export const RowActions = memo(function RowActions({
  claim,
  onAction,
}: {
  claim: Claim;
  onAction: RowActionHandler;
}) {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const allowed = (action: ClaimAction) => claim.allowedActions.includes(action);

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Can permission="claim:edit">
        <ActionButton
          label="Edit claim"
          icon={<Pencil className="size-4" />}
          allowed={allowed('edit')}
          reason={disabledReason('edit', claim, userId)}
          onClick={() => onAction('edit', claim)}
        />
      </Can>
      <Can permission="claim:assign">
        <ActionButton
          label="Assign claim"
          icon={<UserPlus className="size-4" />}
          allowed={allowed('assign')}
          reason={disabledReason('assign', claim, userId)}
          onClick={() => onAction('assign', claim)}
        />
      </Can>
      <Can permission="claim:delete">
        <ActionButton
          label="Delete claim"
          icon={<Trash2 className="size-4" />}
          allowed={allowed('delete')}
          reason={disabledReason('delete', claim, userId)}
          danger
          onClick={() => onAction('delete', claim)}
        />
      </Can>
    </div>
  );
});
