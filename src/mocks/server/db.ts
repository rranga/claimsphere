import type {
  Annotation,
  Claim,
  ClaimDocument,
  ClaimQuery,
  Job,
  PageComment,
  SourceFile,
  User,
} from '@/shared/api/contracts';
import sampleManifest from '../data/sample-documents.json';
import { generateClaims, type ClaimRecord } from '../data/claims';
import { findUser } from '../data/users';
import { allowedActions, canSeeClaim } from './policy';

interface ManifestEntry {
  id: string;
  name: string;
  file: string;
  pageCount: number;
  sizeBytes: number;
  pageWidth: number;
  pageHeight: number;
}

const base = import.meta.env.BASE_URL;
const toSourceFile = (entry: ManifestEntry, folder: string): SourceFile & { name: string } => ({
  id: entry.id,
  name: entry.name,
  url: `${base}documents/${folder}${entry.file}`,
  sizeBytes: entry.sizeBytes,
  pageCount: entry.pageCount,
  pageWidth: entry.pageWidth,
  pageHeight: entry.pageHeight,
});

// ---------------------------------------------------------------------------
// In-memory "database". Lives in the browser tab (MSW) — it resets on reload by design.
// ---------------------------------------------------------------------------
const claims: ClaimRecord[] = generateClaims();
const claimsById = new Map(claims.map((c) => [c.id, c]));
const sampleFiles = (sampleManifest as ManifestEntry[]).map((e) => toSourceFile(e, ''));
let largeFiles: (SourceFile & { name: string })[] = [];
const documentsByClaim = new Map<string, ClaimDocument[]>();
const commentsByClaim = new Map<string, PageComment[]>();
const annotationsByClaim = new Map<string, Annotation[]>();
export const jobs = new Map<string, Job>();
export const jobsByIdempotencyKey = new Map<string, string>();

let ready: Promise<void> | null = null;

/** Large (100 MB–1 GB) files are generated locally and optional, so their manifest is discovered at runtime. */
export function ensureReady(): Promise<void> {
  ready ??= (async () => {
    if (import.meta.env.MODE === 'test') return;
    try {
      const response = await fetch(`${base}documents/large/manifest.json`, { cache: 'no-store' });
      if (response.ok)
        largeFiles = ((await response.json()) as ManifestEntry[]).map((e) => toSourceFile(e, 'large/'));
    } catch {
      largeFiles = []; // not generated (or SPA fallback returned HTML) — samples only
    }
  })();
  return ready;
}

export const allFiles = () => [...sampleFiles, ...largeFiles];
const fileById = (id: string) => allFiles().find((f) => f.id === id);

// ---------- Documents (materialized lazily per claim — 25k claims × N docs never sit in memory) ----------
function documentSpec(claim: ClaimRecord) {
  const [fnol, medical, photos] = sampleFiles;
  const files = [fnol!];
  if (['Health', 'Life', 'Casualty'].includes(claim.lineOfBusiness) || claim.index % 3 === 0)
    files.push(medical!);
  if (['Property', 'Motor', 'Marine'].includes(claim.lineOfBusiness) || claim.index % 5 === 0)
    files.push(photos!);
  if (largeFiles.length && claim.index % 4 === 0)
    files.push(largeFiles[(claim.index / 4) % largeFiles.length]!);
  return files;
}

export function getDocuments(claim: ClaimRecord): ClaimDocument[] {
  let docs = documentsByClaim.get(claim.id);
  if (!docs) {
    docs = documentSpec(claim).map((file, n) => {
      const id = `${claim.id}-d${n + 1}`;
      return {
        id,
        claimId: claim.id,
        name: file.name,
        version: 1,
        updatedAt: claim.receivedAt,
        pages: Array.from({ length: file.pageCount }, (_, i) => ({
          id: `${id}-p${i + 1}`,
          fileId: file.id,
          sourcePageIndex: i,
          rotation: 0 as const,
        })),
      };
    });
    documentsByClaim.set(claim.id, docs);
  }
  return docs;
}

export const setDocuments = (claimId: string, docs: ClaimDocument[]) => documentsByClaim.set(claimId, docs);

function documentSummary(claim: ClaimRecord) {
  const docs = documentsByClaim.get(claim.id);
  if (!docs) {
    const files = documentSpec(claim);
    return { count: files.length, bytes: files.reduce((sum, f) => sum + f.sizeBytes, 0) };
  }
  const fileIds = new Set(docs.flatMap((d) => d.pages.map((p) => p.fileId)));
  return {
    count: docs.length,
    bytes: [...fileIds].reduce((sum, id) => sum + (fileById(id)?.sizeBytes ?? 0), 0),
  };
}

// ---------- Collaboration ----------
export const getComments = (claimId: string) => commentsByClaim.get(claimId) ?? [];
export const setComments = (claimId: string, list: PageComment[]) => commentsByClaim.set(claimId, list);
export const getAnnotations = (claimId: string) => annotationsByClaim.get(claimId) ?? [];
export const setAnnotations = (claimId: string, list: Annotation[]) => annotationsByClaim.set(claimId, list);

/** Referential integrity: drop comments/annotations whose page no longer exists after a commit. */
export function pruneOrphans(claimId: string) {
  const pageIds = new Set((documentsByClaim.get(claimId) ?? []).flatMap((d) => d.pages.map((p) => p.id)));
  setComments(
    claimId,
    getComments(claimId).filter((c) => pageIds.has(c.pageId)),
  );
  setAnnotations(
    claimId,
    getAnnotations(claimId).filter((a) => pageIds.has(a.pageId)),
  );
}

// ---------- Claims ----------
export const getClaim = (id: string) => claimsById.get(id);

export function toClaimDto(record: ClaimRecord, user: User): Claim {
  const { index: _index, ...rest } = record;
  const summary = documentSummary(record);
  return {
    ...rest,
    assigneeName: findUser(record.assigneeId)?.name ?? null,
    documentCount: summary.count,
    documentBytes: summary.bytes,
    allowedActions: allowedActions(user, record),
  };
}

export function updateClaim(id: string, changes: Partial<ClaimRecord>) {
  const current = claimsById.get(id);
  if (!current) return undefined;
  const next = { ...current, ...changes, version: current.version + 1 };
  claims[current.index] = next;
  claimsById.set(id, next);
  invalidateQueryCache();
  return next;
}

export function deleteClaim(id: string) {
  const current = claimsById.get(id);
  if (!current) return false;
  claimsById.delete(id);
  documentsByClaim.delete(id);
  invalidateQueryCache();
  return true;
}

// ---------- Server-side filtering & sorting ----------
const PRIORITY_RANK = { Low: 0, Medium: 1, High: 2, Critical: 3 } as const;
const STATUS_RANK = {
  New: 0,
  'In Review': 1,
  'Pending Info': 2,
  Approved: 3,
  Rejected: 4,
  Closed: 5,
} as const;
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function sortKey(record: ClaimRecord, field: ClaimQuery['sortBy']): string | number {
  switch (field) {
    case 'priority':
      return PRIORITY_RANK[record.priority];
    case 'status':
      return STATUS_RANK[record.status];
    case 'assigneeName':
      return findUser(record.assigneeId)?.name ?? '￿';
    default:
      return record[field];
  }
}

/**
 * Filtered + sorted id list per (user scope, query). Cached so scrolling through 250 blocks of a
 * 25k result set costs one sort, not 250. Any write invalidates the cache.
 */
const queryCache = new Map<string, ClaimRecord[]>();
function invalidateQueryCache() {
  queryCache.clear();
}

export function queryClaims(user: User, query: ClaimQuery): ClaimRecord[] {
  const key = JSON.stringify([user.id, query]);
  const cached = queryCache.get(key);
  if (cached) return cached;

  const q = query.q?.trim().toLowerCase();
  const status = query.status?.length ? new Set(query.status) : null;
  const priority = query.priority?.length ? new Set(query.priority) : null;
  const channel = query.channel?.length ? new Set(query.channel) : null;

  const rows = [...claimsById.values()].filter(
    (c) =>
      canSeeClaim(user, c) &&
      (!status || status.has(c.status)) &&
      (!priority || priority.has(c.priority)) &&
      (!channel || channel.has(c.channel)) &&
      (!q ||
        c.claimNumber.toLowerCase().includes(q) ||
        c.policyNumber.toLowerCase().includes(q) ||
        c.claimant.toLowerCase().includes(q)),
  );

  const dir = query.sortDir === 'asc' ? 1 : -1;
  const keyed = rows.map((r) => [sortKey(r, query.sortBy), r] as const);
  keyed.sort(
    ([a], [b]) =>
      dir * (typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b))),
  );
  const result = keyed.map(([, r]) => r);

  if (queryCache.size > 20) invalidateQueryCache();
  queryCache.set(key, result);
  return result;
}

export const visibleClaims = (user: User) => [...claimsById.values()].filter((c) => canSeeClaim(user, c));
