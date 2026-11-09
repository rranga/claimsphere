import type { ClaimDocument, DocumentOperation } from '@/shared/api/contracts';
import { applyOperations } from '@/shared/domain/documentOperations';

/**
 * Unsaved document edits survive a refresh / crash: the command log is persisted per claim
 * together with the versions it was based on. It is only restored if those versions still
 * match the server — otherwise replaying it could silently clobber someone else's work.
 */
interface StoredDraft {
  operations: DocumentOperation[];
  baseVersions: Record<string, number>;
  savedAt: string;
}

const key = (claimId: string) => `claimsphere.draft.${claimId}`;

export function saveDraft(
  claimId: string,
  operations: DocumentOperation[],
  baseVersions: Record<string, number>,
) {
  try {
    if (operations.length === 0) localStorage.removeItem(key(claimId));
    else
      localStorage.setItem(
        key(claimId),
        JSON.stringify({ operations, baseVersions, savedAt: new Date().toISOString() }),
      );
  } catch {
    // storage full / disabled (private mode) — drafts are a convenience, never a hard dependency
  }
}

type DraftRestoreResult =
  { status: 'none' } | { status: 'restored'; operations: DocumentOperation[] } | { status: 'stale' };

export function loadDraft(claimId: string, documents: ClaimDocument[]): DraftRestoreResult {
  let stored: StoredDraft | null = null;
  try {
    const raw = localStorage.getItem(key(claimId));
    stored = raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    stored = null;
  }
  if (!stored?.operations?.length) return { status: 'none' };

  const current = Object.fromEntries(documents.map((d) => [d.id, d.version]));
  const sameBase =
    Object.keys(stored.baseVersions).length === documents.length &&
    Object.entries(stored.baseVersions).every(([id, version]) => current[id] === version);

  if (sameBase) {
    try {
      applyOperations(documents, stored.operations); // must still replay cleanly
      return { status: 'restored', operations: stored.operations };
    } catch {
      /* fall through */
    }
  }
  saveDraft(claimId, [], {});
  return { status: 'stale' };
}
