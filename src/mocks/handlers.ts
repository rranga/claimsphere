import { delay, http, HttpResponse, type DefaultBodyType, type StrictRequest } from 'msw';
import { z } from 'zod';
import {
  CLAIM_CHANNELS,
  CLAIM_PRIORITIES,
  CLAIM_STATUSES,
  SORTABLE_FIELDS,
  type Annotation,
  type ApiErrorBody,
  type ClaimDocumentsResponse,
  type ClaimPage,
  type ClaimQuery,
  type ClaimStats,
  type CommitOperationsRequest,
  type Job,
  type PageComment,
  type Session,
  type User,
} from '@/shared/api/contracts';
import { applyOperations, DocumentOperationError } from '@/shared/domain/documentOperations';
import { findUser, SIGN_IN_USER_IDS, USERS } from './data/users';
import {
  allFiles,
  deleteClaim,
  ensureReady,
  getAnnotations,
  getClaim,
  getComments,
  getDocuments,
  jobs,
  jobsByIdempotencyKey,
  queryClaims,
  setAnnotations,
  setComments,
  toClaimDto,
  updateClaim,
  visibleClaims,
} from './server/db';
import { findVersionConflict, runDocumentJob } from './server/jobs';
import {
  allowedActions,
  canSeeClaim,
  documentCapabilities,
  hasPermission,
  ROLE_PERMISSIONS,
} from './server/policy';

// ---------- helpers ----------
const latency = () =>
  import.meta.env.MODE === 'test' ? Promise.resolve() : delay(120 + Math.random() * 230);
/** Typed as plain `Response` so handlers can mix error and success bodies. */
const fail = (status: number, code: ApiErrorBody['code'], message: string): Response =>
  HttpResponse.json<ApiErrorBody>({ code, message }, { status });

const forbidden = (message = 'You do not have permission to perform this action.') =>
  fail(403, 'FORBIDDEN', message);
const notFound = (what = 'Resource') => fail(404, 'NOT_FOUND', `${what} not found`);

/** Authenticate every request from its bearer token. Returns a User or an error response. */
function authenticate(request: StrictRequest<DefaultBodyType>): User | Response {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  const user = token?.startsWith('demo.') ? findUser(token.slice(5)) : undefined;
  return user ?? fail(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
}

const csv = <T extends string>(value: string | null, allowed: readonly T[]) =>
  value ? (value.split(',').filter((v) => (allowed as readonly string[]).includes(v)) as T[]) : undefined;

const claimUpdateSchema = z.object({
  version: z.number().int(),
  changes: z
    .object({
      status: z.enum(CLAIM_STATUSES).optional(),
      priority: z.enum(CLAIM_PRIORITIES).optional(),
      amount: z.number().nonnegative().max(100_000_000).optional(),
    })
    .strict(),
});

const assignSchema = z.object({ version: z.number().int(), assigneeId: z.string().nullable() });
const commentSchema = z.object({ pageId: z.string().min(1), body: z.string().trim().min(1).max(2000) });
const rectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});
const annotationSchema = z.object({
  pageId: z.string().min(1),
  kind: z.enum(['highlight', 'rectangle']),
  rect: rectSchema,
});

const API = '*/api';

export const handlers = [
  // ---------- auth ----------
  http.get(`${API}/auth/users`, async () => {
    await latency();
    return HttpResponse.json(USERS.filter((u) => SIGN_IN_USER_IDS.includes(u.id)));
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    await latency();
    const { userId } = (await request.json()) as { userId: string };
    const user = findUser(userId);
    if (!user || !SIGN_IN_USER_IDS.includes(user.id)) return fail(401, 'UNAUTHENTICATED', 'Unknown user');
    return HttpResponse.json<Session>({
      token: `demo.${user.id}`,
      user,
      permissions: [...ROLE_PERMISSIONS[user.role]],
    });
  }),

  http.get(`${API}/auth/me`, async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    return HttpResponse.json<Session>({
      token: `demo.${user.id}`,
      user,
      permissions: [...ROLE_PERMISSIONS[user.role]],
    });
  }),

  http.get(`${API}/users/assignable`, async ({ request }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    if (!hasPermission(user, 'claim:assign')) return forbidden();
    const region = new URL(request.url).searchParams.get('region');
    return HttpResponse.json(USERS.filter((u) => u.role === 'adjuster' && (!region || u.region === region)));
  }),

  // ---------- claims ----------
  http.get(`${API}/claims`, async ({ request }) => {
    await ensureReady();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();

    const params = new URL(request.url).searchParams;
    const offset = Math.max(0, Number(params.get('offset') ?? 0));
    const limit = Math.min(500, Math.max(1, Number(params.get('limit') ?? 50))); // hard cap protects the server
    const sortBy = (SORTABLE_FIELDS as readonly string[]).includes(params.get('sortBy') ?? '')
      ? (params.get('sortBy') as ClaimQuery['sortBy'])
      : 'receivedAt';
    const query: ClaimQuery = {
      q: params.get('q') ?? undefined,
      status: csv(params.get('status'), CLAIM_STATUSES),
      priority: csv(params.get('priority'), CLAIM_PRIORITIES),
      channel: csv(params.get('channel'), CLAIM_CHANNELS),
      sortBy,
      sortDir: params.get('sortDir') === 'asc' ? 'asc' : 'desc',
    };
    const all = queryClaims(user, query);
    return HttpResponse.json<ClaimPage>({
      rows: all.slice(offset, offset + limit).map((c) => toClaimDto(c, user)),
      offset,
      limit,
      total: all.length,
    });
  }),

  http.get(`${API}/claims/stats`, async ({ request }) => {
    await ensureReady();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const scoped = visibleClaims(user);
    return HttpResponse.json<ClaimStats>({
      total: scoped.length,
      open: scoped.filter((c) => !['Approved', 'Rejected', 'Closed'].includes(c.status)).length,
      highRisk: scoped.filter((c) => c.riskScore >= 75).length,
      assignedToMe: scoped.filter((c) => c.assigneeId === user.id).length,
    });
  }),

  http.patch(`${API}/claims/:id`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim'); // don't leak existence
    if (!allowedActions(user, claim).includes('edit')) return forbidden();
    const parsed = claimUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return fail(422, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid payload');
    if (parsed.data.version !== claim.version) {
      return fail(
        409,
        'CONFLICT',
        'This claim was updated by someone else. Review the latest data and try again.',
      );
    }
    return HttpResponse.json(toClaimDto(updateClaim(claim.id, parsed.data.changes)!, user));
  }),

  http.post(`${API}/claims/:id/assign`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim');
    if (!allowedActions(user, claim).includes('assign')) return forbidden();
    const parsed = assignSchema.safeParse(await request.json());
    if (!parsed.success) return fail(422, 'VALIDATION', 'Invalid payload');
    const assignee = parsed.data.assigneeId ? findUser(parsed.data.assigneeId) : null;
    if (
      parsed.data.assigneeId &&
      (!assignee || assignee.role !== 'adjuster' || assignee.region !== claim.region)
    ) {
      return fail(422, 'VALIDATION', 'Assignee must be an adjuster in the claim’s region');
    }
    if (parsed.data.version !== claim.version)
      return fail(409, 'CONFLICT', 'This claim was updated by someone else.');
    return HttpResponse.json(
      toClaimDto(updateClaim(claim.id, { assigneeId: parsed.data.assigneeId })!, user),
    );
  }),

  http.delete(`${API}/claims/:id`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim');
    if (!allowedActions(user, claim).includes('delete')) return forbidden();
    deleteClaim(claim.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- documents ----------
  http.get(`${API}/claims/:id/documents`, async ({ request, params }) => {
    await ensureReady();
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim) || !hasPermission(user, 'document:read'))
      return notFound('Claim');
    const documents = getDocuments(claim);
    const fileIds = new Set(documents.flatMap((d) => d.pages.map((p) => p.fileId)));
    const files = Object.fromEntries(
      allFiles()
        .filter((f) => fileIds.has(f.id))
        .map(({ name: _name, ...f }) => [f.id, f]),
    );
    return HttpResponse.json<ClaimDocumentsResponse>({
      claim: toClaimDto(claim, user),
      documents,
      files,
      capabilities: documentCapabilities(user, claim),
    });
  }),

  http.post(`${API}/claims/:id/document-operations`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim');
    if (!documentCapabilities(user, claim).edit)
      return forbidden('You cannot modify documents on this claim.');

    const body = (await request.json()) as CommitOperationsRequest;
    if (!body.idempotencyKey || !Array.isArray(body.operations) || body.operations.length === 0) {
      return fail(422, 'VALIDATION', 'idempotencyKey and at least one operation are required');
    }

    // Idempotency: a re-sent request (double click, network retry) returns the same in-flight/finished job.
    const existingId = jobsByIdempotencyKey.get(body.idempotencyKey);
    const existing = existingId ? jobs.get(existingId) : undefined;
    if (existing && existing.status !== 'failed' && existing.status !== 'cancelled') {
      return HttpResponse.json<Job>(existing, { status: 202 });
    }

    const current = getDocuments(claim);
    const conflict = findVersionConflict(current, body);
    if (conflict) return fail(409, 'CONFLICT', `${conflict}. Reload to get the latest version.`);
    try {
      applyOperations(current, body.operations); // dry-run validation before accepting the job
    } catch (error) {
      if (error instanceof DocumentOperationError) return fail(422, 'VALIDATION', error.message);
      throw error;
    }

    const job: Job = {
      id: `job-${crypto.randomUUID()}`,
      status: 'queued',
      progress: 0,
      step: 'Queued',
      createdAt: new Date().toISOString(),
    };
    jobs.set(job.id, job);
    jobsByIdempotencyKey.set(body.idempotencyKey, job.id);
    void runDocumentJob(job.id, claim.id, body);
    return HttpResponse.json<Job>(job, { status: 202 });
  }),

  http.get(`${API}/jobs/:id`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    const job = jobs.get(String(params.id));
    return job ? HttpResponse.json<Job>(job) : notFound('Job');
  }),

  http.post(`${API}/jobs/:id/cancel`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const job = jobs.get(String(params.id));
    if (!job) return notFound('Job');
    if (job.status === 'queued' || job.status === 'running') {
      jobs.set(job.id, { ...job, status: 'cancelled', step: 'Cancelled — no changes were applied' });
    }
    return HttpResponse.json<Job>(jobs.get(job.id)!);
  }),

  // ---------- comments ----------
  http.get(`${API}/claims/:id/comments`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim');
    return HttpResponse.json<PageComment[]>(getComments(claim.id));
  }),

  http.post(`${API}/claims/:id/comments`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim');
    if (!documentCapabilities(user, claim).comment) return forbidden();
    const parsed = commentSchema.safeParse(await request.json());
    if (!parsed.success) return fail(422, 'VALIDATION', 'Comment text is required (max 2000 characters)');
    const comment: PageComment = {
      id: `cm-${crypto.randomUUID()}`,
      claimId: claim.id,
      pageId: parsed.data.pageId,
      authorId: user.id,
      authorName: user.name,
      body: parsed.data.body,
      createdAt: new Date().toISOString(),
    };
    setComments(claim.id, [...getComments(claim.id), comment]);
    return HttpResponse.json(comment, { status: 201 });
  }),

  http.delete(`${API}/claims/:id/comments/:commentId`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claimId = String(params.id);
    const comment = getComments(claimId).find((c) => c.id === params.commentId);
    if (!comment) return notFound('Comment');
    if (comment.authorId !== user.id && user.role !== 'admin')
      return forbidden('Only the author can delete this comment.');
    setComments(
      claimId,
      getComments(claimId).filter((c) => c.id !== comment.id),
    );
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- annotations ----------
  http.get(`${API}/claims/:id/annotations`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim');
    return HttpResponse.json<Annotation[]>(getAnnotations(claim.id));
  }),

  http.post(`${API}/claims/:id/annotations`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim');
    if (!documentCapabilities(user, claim).annotate) return forbidden();
    const parsed = annotationSchema.safeParse(await request.json());
    if (!parsed.success) return fail(422, 'VALIDATION', 'Invalid annotation');
    const annotation: Annotation = {
      id: `an-${crypto.randomUUID()}`,
      claimId: claim.id,
      ...parsed.data,
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    };
    setAnnotations(claim.id, [...getAnnotations(claim.id), annotation]);
    return HttpResponse.json(annotation, { status: 201 });
  }),

  http.delete(`${API}/claims/:id/annotations/:annotationId`, async ({ request, params }) => {
    const user = authenticate(request);
    if (user instanceof Response) return user;
    await latency();
    const claim = getClaim(String(params.id));
    if (!claim || !canSeeClaim(user, claim)) return notFound('Claim');
    if (!documentCapabilities(user, claim).annotate) return forbidden();
    setAnnotations(
      claim.id,
      getAnnotations(claim.id).filter((a) => a.id !== params.annotationId),
    );
    return new HttpResponse(null, { status: 204 });
  }),
];
