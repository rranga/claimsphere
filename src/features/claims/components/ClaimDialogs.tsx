import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { CLAIM_PRIORITIES, CLAIM_STATUSES, type Claim, type User } from '@/shared/api/contracts';
import { formatCurrency } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { SelectField, TextField } from '@/shared/ui/Field';
import { assignableUsersQuery } from '../api/queries';
import { useAssignClaim, useDeleteClaim, useUpdateClaim } from '../hooks/useClaimMutations';

export type ClaimDialogState = { type: 'edit' | 'assign' | 'delete'; claim: Claim } | null;

interface DialogProps {
  claim: Claim;
  onClose: () => void;
}

/** Client validation mirrors the server schema for fast feedback; the server remains authoritative. */
const editSchema = z.object({
  status: z.enum(CLAIM_STATUSES),
  priority: z.enum(CLAIM_PRIORITIES),
  amount: z.coerce
    .number({ message: 'Enter a number' })
    .nonnegative('Amount cannot be negative')
    .max(100_000_000, 'Amount is too large'),
});

function EditClaimDialog({ claim, onClose }: DialogProps) {
  const update = useUpdateClaim();
  const [values, setValues] = useState({
    status: claim.status,
    priority: claim.priority,
    amount: String(claim.amount),
  });
  const [error, setError] = useState<string>();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = editSchema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    update.mutate({ claim, changes: parsed.data }, { onSuccess: onClose });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Edit ${claim.claimNumber}`}
      description={claim.claimant}
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Status"
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as Claim['status'] }))}
            options={CLAIM_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <SelectField
            label="Priority"
            value={values.priority}
            onChange={(e) => setValues((v) => ({ ...v, priority: e.target.value as Claim['priority'] }))}
            options={CLAIM_PRIORITIES.map((p) => ({ value: p, label: p }))}
          />
        </div>
        <TextField
          label="Reserve amount (USD)"
          inputMode="decimal"
          value={values.amount}
          error={error}
          onChange={(e) => {
            setError(undefined);
            setValues((v) => ({ ...v, amount: e.target.value }));
          }}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function AssignClaimDialog({ claim, onClose }: DialogProps) {
  const assign = useAssignClaim();
  const { data: users, isPending } = useQuery(assignableUsersQuery(claim.region));
  const [assigneeId, setAssigneeId] = useState(claim.assigneeId ?? '');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const assignee: User | null = users?.find((u) => u.id === assigneeId) ?? null;
    assign.mutate({ claim, assignee });
    onClose(); // optimistic: the grid already shows the new assignee
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Assign ${claim.claimNumber}`}
      description={`Adjusters in ${claim.region}`}
      size="sm"
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <SelectField
          label="Assignee"
          value={assigneeId}
          disabled={isPending}
          onChange={(e) => setAssigneeId(e.target.value)}
          options={[
            { value: '', label: isPending ? 'Loading…' : 'Unassigned' },
            ...(users ?? []).map((u) => ({ value: u.id, label: u.name })),
          ]}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            Assign
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteClaimDialog({ claim, onClose }: DialogProps) {
  const remove = useDeleteClaim();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Delete claim?"
      size="sm"
      description={
        <>
          <strong className="text-ink">{claim.claimNumber}</strong> ({claim.claimant},{' '}
          {formatCurrency(claim.amount)}) and its {claim.documentCount} documents will be permanently removed.
        </>
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => remove.mutate(claim, { onSuccess: onClose })}
          >
            Delete claim
          </Button>
        </>
      }
    />
  );
}

/** One dialog host per page (not per row) — 20k rows never carry dialog state or portals. */
export function ClaimDialogs({ state, onClose }: { state: ClaimDialogState; onClose: () => void }) {
  if (!state) return null;
  const props = { claim: state.claim, onClose, key: state.claim.id };
  switch (state.type) {
    case 'edit':
      return <EditClaimDialog {...props} />;
    case 'assign':
      return <AssignClaimDialog {...props} />;
    case 'delete':
      return <DeleteClaimDialog {...props} />;
  }
}
