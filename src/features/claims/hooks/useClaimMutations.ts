import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Claim, ClaimUpdate, User } from '@/shared/api/contracts';
import { errorMessage, isApiError } from '@/shared/api/http';
import { claimsApi } from '../api/claimsApi';
import { claimKeys, patchCachedClaim } from '../api/queries';

function useConflictAwareError() {
  const queryClient = useQueryClient();
  return (error: unknown, fallback: string) => {
    if (isApiError(error) && error.code === 'CONFLICT') {
      toast.error('This claim changed since you loaded it', {
        description: 'The grid has been refreshed with the latest data. Please review and try again.',
      });
      void queryClient.invalidateQueries({ queryKey: claimKeys.lists() });
      return;
    }
    toast.error(fallback, { description: errorMessage(error) });
  };
}

/** Edit = PESSIMISTIC: server-side validation decides; the form shows a saving state. */
export function useUpdateClaim() {
  const queryClient = useQueryClient();
  const onError = useConflictAwareError();
  return useMutation({
    mutationFn: ({ claim, changes }: { claim: Claim; changes: ClaimUpdate }) =>
      claimsApi.update(claim, changes),
    onSuccess: (updated) => {
      patchCachedClaim(queryClient, updated.id, () => updated);
      void queryClient.invalidateQueries({ queryKey: claimKeys.stats() });
      toast.success(`${updated.claimNumber} updated`);
    },
    onError: (error) => onError(error, 'Could not save the claim'),
  });
}

/** Assign = OPTIMISTIC: cheap, reversible and frequent during triage → instant feedback, rollback on failure. */
export function useAssignClaim() {
  const queryClient = useQueryClient();
  const onError = useConflictAwareError();
  return useMutation({
    mutationFn: ({ claim, assignee }: { claim: Claim; assignee: User | null }) =>
      claimsApi.assign(claim, assignee?.id ?? null),
    onMutate: async ({ claim, assignee }) => {
      await queryClient.cancelQueries({ queryKey: claimKeys.lists() }); // avoid an in-flight fetch overwriting us
      const rollback = patchCachedClaim(queryClient, claim.id, (row) => ({
        ...row,
        assigneeId: assignee?.id ?? null,
        assigneeName: assignee?.name ?? null,
      }));
      return { rollback };
    },
    onError: (error, _vars, context) => {
      context?.rollback();
      onError(error, 'Could not assign the claim');
    },
    onSuccess: (updated) => {
      patchCachedClaim(queryClient, updated.id, () => updated); // adopt the server's new version
      void queryClient.invalidateQueries({ queryKey: claimKeys.stats() });
      toast.success(updated.assigneeName ? `Assigned to ${updated.assigneeName}` : 'Claim unassigned');
    },
  });
}

/** Delete = PESSIMISTIC + confirmation: destructive and row positions shift, so we refetch afterwards. */
export function useDeleteClaim() {
  const queryClient = useQueryClient();
  const onError = useConflictAwareError();
  return useMutation({
    mutationFn: (claim: Claim) => claimsApi.remove(claim.id),
    onSuccess: (_data, claim) => {
      void queryClient.invalidateQueries({ queryKey: claimKeys.all });
      toast.success(`${claim.claimNumber} deleted`);
    },
    onError: (error) => onError(error, 'Could not delete the claim'),
  });
}
