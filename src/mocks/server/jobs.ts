import type { ClaimDocument, CommitOperationsRequest, Job } from '@/shared/api/contracts';
import {
  applyOperations,
  describeOperation,
  referencedDocumentIds,
} from '@/shared/domain/documentOperations';
import { getDocuments, getClaim, jobs, pruneOrphans, setDocuments } from './db';

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 1 : ms));

const patch = (id: string, changes: Partial<Job>) => {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, ...changes });
};

const isCancelled = (id: string) => jobs.get(id)?.status === 'cancelled';

/** Version check shared by submit-time validation and the final atomic swap. */
export function findVersionConflict(
  current: ClaimDocument[],
  request: CommitOperationsRequest,
): string | null {
  const created = new Set(
    request.operations.flatMap((op) => (op.type === 'splitDocument' ? [op.newDocumentId] : [])),
  );
  for (const id of referencedDocumentIds(request.operations)) {
    if (created.has(id)) continue;
    const doc = current.find((d) => d.id === id);
    if (!doc) return `Document ${id} no longer exists`;
    if (request.baseVersions[id] !== doc.version) return `“${doc.name}” was changed by someone else`;
  }
  return null;
}

/**
 * Simulates a long-running, server-side document job (in production: a queue worker that
 * rewrites the PDF and re-indexes pages). Properties demonstrated:
 *  - progress reporting, cooperative cancellation between steps
 *  - ATOMIC commit: work happens on a copy; state is swapped only in the final step,
 *    so a failure or cancel at any point leaves the document exactly as it was.
 */
export async function runDocumentJob(jobId: string, claimId: string, request: CommitOperationsRequest) {
  const steps = [
    'Validating operations',
    ...request.operations.map(describeOperation),
    'Re-indexing pages',
    'Generating thumbnails',
    'Finalizing',
  ];
  patch(jobId, { status: 'running' });

  for (let i = 0; i < steps.length; i++) {
    if (isCancelled(jobId)) return;
    patch(jobId, { step: steps[i]!, progress: Math.round((i / steps.length) * 100) });
    await sleep(steps.length > 8 ? 250 : 550);

    if (request.simulateFailure && i === Math.floor(steps.length * 0.6)) {
      patch(jobId, {
        status: 'failed',
        error: 'Storage service timed out while writing the page index (simulated).',
      });
      return;
    }
  }
  if (isCancelled(jobId)) return;

  const claim = getClaim(claimId);
  if (!claim) return patch(jobId, { status: 'failed', error: 'Claim no longer exists' });

  const current = getDocuments(claim);
  const conflict = findVersionConflict(current, request);
  if (conflict)
    return patch(jobId, { status: 'failed', error: `${conflict}. Reload to get the latest version.` });

  const next = applyOperations(current, request.operations);
  const now = new Date().toISOString();
  const previous = new Map(current.map((d) => [d.id, d]));
  // Bump versions only for documents that actually changed (reference equality from the pure engine).
  setDocuments(
    claimId,
    next.map((doc) =>
      previous.get(doc.id) === doc
        ? doc
        : { ...doc, version: (previous.get(doc.id)?.version ?? 0) + 1, updatedAt: now },
    ),
  );
  pruneOrphans(claimId);
  patch(jobId, { status: 'succeeded', progress: 100, step: 'Done' });
}
