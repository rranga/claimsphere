import { describe, expect, it } from 'vitest';
import type { ClaimDocumentsResponse, ClaimPage, Job } from '@/shared/api/contracts';

const ADMIN = 'u-sofia';
const call = (path: string, init: RequestInit = {}) =>
  fetch(`http://localhost:3000/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer demo.${ADMIN}` },
  });

async function openClaim() {
  const page = (await (await call('/claims?limit=50&status=In%20Review')).json()) as ClaimPage;
  const claim = page.rows.find((c) => c.documentCount >= 2)!;
  const docs = (await (await call(`/claims/${claim.id}/documents`)).json()) as ClaimDocumentsResponse;
  return { claim, docs };
}

async function waitForJob(id: string): Promise<Job> {
  for (let i = 0; i < 200; i++) {
    const job = (await (await call(`/jobs/${id}`)).json()) as Job;
    if (['succeeded', 'failed', 'cancelled'].includes(job.status)) return job;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('job did not finish');
}

describe('document operation jobs', () => {
  it('commits atomically and bumps versions only for changed documents', async () => {
    const { claim, docs } = await openClaim();
    const [first, second] = docs.documents;
    const baseVersions = Object.fromEntries(docs.documents.map((d) => [d.id, d.version]));
    const res = await call(`/claims/${claim.id}/document-operations`, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'k-1',
        baseVersions,
        operations: [
          { type: 'rotatePages', documentId: first!.id, pageIds: [first!.pages[0]!.id], delta: 90 },
        ],
      }),
    });
    expect(res.status).toBe(202);
    const job = await waitForJob(((await res.json()) as Job).id);
    expect(job.status).toBe('succeeded');

    const after = (await (await call(`/claims/${claim.id}/documents`)).json()) as ClaimDocumentsResponse;
    expect(after.documents[0]!.version).toBe(first!.version + 1);
    expect(after.documents[0]!.pages[0]!.rotation).toBe(90);
    expect(after.documents[1]!.version).toBe(second!.version);
  });

  it('is idempotent: re-sending the same key returns the same job', async () => {
    const { claim, docs } = await openClaim();
    const body = JSON.stringify({
      idempotencyKey: 'k-dup',
      baseVersions: Object.fromEntries(docs.documents.map((d) => [d.id, d.version])),
      operations: [{ type: 'renameDocument', documentId: docs.documents[0]!.id, name: 'Renamed.pdf' }],
    });
    const a = (await (
      await call(`/claims/${claim.id}/document-operations`, { method: 'POST', body })
    ).json()) as Job;
    const b = (await (
      await call(`/claims/${claim.id}/document-operations`, { method: 'POST', body })
    ).json()) as Job;
    expect(b.id).toBe(a.id);
    await waitForJob(a.id);
  });

  it('a failed job leaves the documents untouched (no partial state)', async () => {
    const { claim, docs } = await openClaim();
    const res = await call(`/claims/${claim.id}/document-operations`, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'k-fail',
        simulateFailure: true,
        baseVersions: Object.fromEntries(docs.documents.map((d) => [d.id, d.version])),
        operations: [{ type: 'deleteDocument', documentId: docs.documents[1]!.id }],
      }),
    });
    const job = await waitForJob(((await res.json()) as Job).id);
    expect(job.status).toBe('failed');
    const after = (await (await call(`/claims/${claim.id}/documents`)).json()) as ClaimDocumentsResponse;
    expect(after.documents).toEqual(docs.documents);
  });

  it('rejects a commit based on stale versions with 409', async () => {
    const { claim, docs } = await openClaim();
    const res = await call(`/claims/${claim.id}/document-operations`, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'k-stale',
        baseVersions: Object.fromEntries(docs.documents.map((d) => [d.id, d.version - 1])),
        operations: [{ type: 'renameDocument', documentId: docs.documents[0]!.id, name: 'x.pdf' }],
      }),
    });
    expect(res.status).toBe(409);
  });

  it('validates operations before accepting the job (422)', async () => {
    const { claim, docs } = await openClaim();
    const doc = docs.documents[0]!;
    const res = await call(`/claims/${claim.id}/document-operations`, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: 'k-invalid',
        baseVersions: Object.fromEntries(docs.documents.map((d) => [d.id, d.version])),
        operations: [{ type: 'deletePages', documentId: doc.id, pageIds: doc.pages.map((p) => p.id) }],
      }),
    });
    expect(res.status).toBe(422);
  });
});
