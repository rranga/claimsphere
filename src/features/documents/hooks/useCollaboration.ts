import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  Annotation,
  AnnotationKind,
  NormalizedRect,
  PageComment,
  Session,
} from '@/shared/api/contracts';
import { errorMessage } from '@/shared/api/http';
import { createId } from '@/shared/lib/id';
import { documentKeys, documentsApi } from '../api/documentsApi';

/**
 * Comments & annotations are OPTIMISTIC: small, additive, easily reversible, and users expect
 * them to appear instantly. On failure the cache is rolled back and the user is told.
 */
function useOptimisticList<TItem extends { id: string }, TVars>(
  queryKey: QueryKey,
  mutationFn: (vars: TVars) => Promise<TItem | void>,
  apply: (list: TItem[], vars: TVars) => TItem[],
  failureMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TItem[]>(queryKey);
      queryClient.setQueryData<TItem[]>(queryKey, (list = []) => apply(list, vars));
      return { previous };
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error(failureMessage, { description: errorMessage(error) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }), // reconcile temp ids with server ids
  });
}

export function useAddComment(claimId: string, session: Session) {
  return useOptimisticList<PageComment, { pageId: string; body: string }>(
    documentKeys.comments(claimId),
    ({ pageId, body }) => documentsApi.addComment(claimId, pageId, body),
    (list, { pageId, body }) => [
      ...list,
      {
        id: createId('temp-'),
        claimId,
        pageId,
        body,
        authorId: session.user.id,
        authorName: session.user.name,
        createdAt: new Date().toISOString(),
      },
    ],
    'Comment could not be posted',
  );
}

export function useDeleteComment(claimId: string) {
  return useOptimisticList<PageComment, string>(
    documentKeys.comments(claimId),
    (commentId) => documentsApi.deleteComment(claimId, commentId),
    (list, commentId) => list.filter((c) => c.id !== commentId),
    'Comment could not be deleted',
  );
}

export function useAddAnnotation(claimId: string, session: Session) {
  return useOptimisticList<Annotation, { pageId: string; kind: AnnotationKind; rect: NormalizedRect }>(
    documentKeys.annotations(claimId),
    (input) => documentsApi.addAnnotation(claimId, input),
    (list, input) => [
      ...list,
      {
        id: createId('temp-'),
        claimId,
        ...input,
        authorId: session.user.id,
        authorName: session.user.name,
        createdAt: new Date().toISOString(),
      },
    ],
    'Annotation could not be saved',
  );
}

export function useDeleteAnnotation(claimId: string) {
  return useOptimisticList<Annotation, string>(
    documentKeys.annotations(claimId),
    (annotationId) => documentsApi.deleteAnnotation(claimId, annotationId),
    (list, annotationId) => list.filter((a) => a.id !== annotationId),
    'Annotation could not be deleted',
  );
}
