import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useStore } from 'react-redux';
import { toast } from 'sonner';
import type { Job } from '@/shared/api/contracts';
import { errorMessage, isApiError } from '@/shared/api/http';
import { createId } from '@/shared/lib/id';
import { claimDocumentsQuery, documentKeys, documentsApi } from '../api/documentsApi';
import { workspaceActions, type WorkspaceState } from '../model/workspaceSlice';
import { useWorkspaceDispatch } from '../model/hooks';

const TERMINAL: Job['status'][] = ['succeeded', 'failed', 'cancelled'];
export const isTerminal = (job: Job | undefined) => !!job && TERMINAL.includes(job.status);

/**
 * Commit the draft as ONE long-running server job — PESSIMISTIC by design:
 * split/merge/delete rewrite large files and must be atomic, so the UI shows real progress
 * instead of pretending it succeeded.
 *
 *  - Idempotency key per attempt: double-clicks or network-level retries can't create two jobs.
 *  - Optimistic concurrency: base versions are sent; a 409 surfaces a conflict dialog.
 *  - Cancel is cooperative: the server stops between steps and applies nothing.
 *  - On failure the draft is untouched, so "Retry" is always safe.
 */
export function useCommitDraft(claimId: string) {
  const store = useStore<{ workspace: WorkspaceState }>();
  const dispatch = useWorkspaceDispatch();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: ({
      idempotencyKey,
      simulateFailure,
    }: {
      idempotencyKey: string;
      simulateFailure: boolean;
    }) => {
      const { past, baseVersions } = store.getState().workspace;
      return documentsApi.commit(claimId, {
        idempotencyKey,
        baseVersions,
        operations: past,
        simulateFailure,
      });
    },
    // Network blips: retrying is safe because the same idempotency key is re-sent.
    retry: (count, error) => count < 2 && isApiError(error) && error.code === 'NETWORK',
    onSuccess: (job) => setJobId(job.id),
    onError: (error) => {
      if (isApiError(error) && error.code === 'CONFLICT') setConflict(error.message);
      else toast.error('Could not start saving', { description: errorMessage(error) });
    },
  });

  const { data: job } = useQuery({
    queryKey: documentKeys.job(jobId ?? 'none'),
    queryFn: ({ signal }) => documentsApi.job(jobId!, signal),
    enabled: jobId !== null,
    refetchInterval: (query) => (isTerminal(query.state.data) ? false : 400),
  });

  // React to the job reaching a terminal state.
  const status = job?.status;
  useEffect(() => {
    if (status !== 'succeeded') return;
    let cancelled = false;
    void queryClient.fetchQuery({ ...claimDocumentsQuery(claimId), staleTime: 0 }).then((data) => {
      if (cancelled) return;
      dispatch(workspaceActions.serverSnapshotReceived(data.documents));
      void queryClient.invalidateQueries({ queryKey: documentKeys.comments(claimId) });
      void queryClient.invalidateQueries({ queryKey: documentKeys.annotations(claimId) });
      void queryClient.invalidateQueries({ queryKey: ['claims', 'list'] });
      toast.success('All changes saved');
      setJobId(null);
    });
    return () => {
      cancelled = true;
    };
  }, [status, claimId, dispatch, queryClient]);

  const cancel = useMutation({
    mutationFn: () => documentsApi.cancelJob(jobId!),
    onSuccess: (cancelledJob) => {
      queryClient.setQueryData(documentKeys.job(cancelledJob.id), cancelledJob);
      if (cancelledJob.status === 'cancelled')
        toast.info('Save cancelled — no changes were applied. Your draft is intact.');
    },
  });

  const reloadLatest = async () => {
    setConflict(null);
    setJobId(null);
    const data = await queryClient.fetchQuery({ ...claimDocumentsQuery(claimId), staleTime: 0 });
    dispatch(workspaceActions.serverSnapshotReceived(data.documents));
    toast.info('Loaded the latest version. Your previous draft was discarded.');
  };

  return {
    job: jobId ? job : undefined,
    isSubmitting: submit.isPending,
    isRunning: submit.isPending || (jobId !== null && !isTerminal(job)),
    start: (simulateFailure = false) =>
      submit.mutate({ idempotencyKey: createId('commit-'), simulateFailure }),
    cancel: () => cancel.mutate(),
    isCancelling: cancel.isPending,
    dismiss: () => setJobId(null),
    conflict,
    dismissConflict: () => setConflict(null),
    reloadLatest,
  };
}
