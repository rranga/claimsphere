import { queryOptions } from '@tanstack/react-query';
import type {
  Annotation,
  ClaimDocumentsResponse,
  CommitOperationsRequest,
  Job,
  NormalizedRect,
  AnnotationKind,
  PageComment,
} from '@/shared/api/contracts';
import { http } from '@/shared/api/http';

export const documentsApi = {
  claimDocuments: (claimId: string, signal?: AbortSignal) =>
    http<ClaimDocumentsResponse>(`/claims/${claimId}/documents`, { signal }),
  commit: (claimId: string, body: CommitOperationsRequest) =>
    http<Job>(`/claims/${claimId}/document-operations`, { method: 'POST', body }),
  job: (jobId: string, signal?: AbortSignal) => http<Job>(`/jobs/${jobId}`, { signal }),
  cancelJob: (jobId: string) => http<Job>(`/jobs/${jobId}/cancel`, { method: 'POST' }),
  comments: (claimId: string, signal?: AbortSignal) =>
    http<PageComment[]>(`/claims/${claimId}/comments`, { signal }),
  addComment: (claimId: string, pageId: string, body: string) =>
    http<PageComment>(`/claims/${claimId}/comments`, { method: 'POST', body: { pageId, body } }),
  deleteComment: (claimId: string, commentId: string) =>
    http<void>(`/claims/${claimId}/comments/${commentId}`, { method: 'DELETE' }),
  annotations: (claimId: string, signal?: AbortSignal) =>
    http<Annotation[]>(`/claims/${claimId}/annotations`, { signal }),
  addAnnotation: (claimId: string, input: { pageId: string; kind: AnnotationKind; rect: NormalizedRect }) =>
    http<Annotation>(`/claims/${claimId}/annotations`, { method: 'POST', body: input }),
  deleteAnnotation: (claimId: string, annotationId: string) =>
    http<void>(`/claims/${claimId}/annotations/${annotationId}`, { method: 'DELETE' }),
};

export const documentKeys = {
  claim: (claimId: string) => ['claims', claimId, 'documents'] as const,
  comments: (claimId: string) => ['claims', claimId, 'comments'] as const,
  annotations: (claimId: string) => ['claims', claimId, 'annotations'] as const,
  job: (jobId: string) => ['jobs', jobId] as const,
};

export const claimDocumentsQuery = (claimId: string) =>
  queryOptions({
    queryKey: documentKeys.claim(claimId),
    queryFn: ({ signal }) => documentsApi.claimDocuments(claimId, signal),
    // The workspace edits a draft on top of this snapshot. It must only change when *we* ask
    // (after a commit or an explicit "reload latest") — never silently on window focus.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

export const commentsQuery = (claimId: string) =>
  queryOptions({
    queryKey: documentKeys.comments(claimId),
    queryFn: ({ signal }) => documentsApi.comments(claimId, signal),
    staleTime: 15_000, // collaborative data: refresh on focus to pick up colleagues' comments
  });

export const annotationsQuery = (claimId: string) =>
  queryOptions({
    queryKey: documentKeys.annotations(claimId),
    queryFn: ({ signal }) => documentsApi.annotations(claimId, signal),
    staleTime: 15_000,
  });
