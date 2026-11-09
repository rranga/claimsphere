/**
 * API contract shared by the UI and the (mock) backend.
 * In a real system this file would be generated from an OpenAPI spec.
 */

// ---------- Identity & authorization ----------
export const ROLES = ['viewer', 'adjuster', 'supervisor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'claim:read',
  'claim:edit',
  'claim:assign',
  'claim:delete',
  'document:read',
  'document:edit',
  'document:comment',
  'document:annotate',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type Region = 'EMEA' | 'AMER' | 'APAC';

export interface User {
  id: string;
  name: string;
  title: string;
  role: Role;
  region: Region;
  avatarColor: string;
}

export interface Session {
  token: string;
  user: User;
  /** Coarse, role-level capabilities. Row-level decisions come from `Claim.allowedActions`. */
  permissions: Permission[];
}

// ---------- Claims ----------
export const CLAIM_STATUSES = ['New', 'In Review', 'Pending Info', 'Approved', 'Rejected', 'Closed'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type ClaimPriority = (typeof CLAIM_PRIORITIES)[number];

export const CLAIM_CHANNELS = ['Email', 'SFTP', 'Portal', 'API'] as const;
export type ClaimChannel = (typeof CLAIM_CHANNELS)[number];

export const LINES_OF_BUSINESS = ['Property', 'Casualty', 'Life', 'Health', 'Marine', 'Motor'] as const;
export type LineOfBusiness = (typeof LINES_OF_BUSINESS)[number];

export type ClaimAction = 'view' | 'edit' | 'assign' | 'delete';

export interface Claim {
  id: string;
  claimNumber: string;
  policyNumber: string;
  claimant: string;
  lineOfBusiness: LineOfBusiness;
  channel: ClaimChannel;
  status: ClaimStatus;
  priority: ClaimPriority;
  riskScore: number;
  amount: number;
  region: Region;
  lossDate: string;
  receivedAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
  documentCount: number;
  documentBytes: number;
  /** Optimistic-concurrency token. Sent back on every write. */
  version: number;
  /** Computed by the server for the *current* user — the UI never re-derives row-level authorization. */
  allowedActions: ClaimAction[];
}

export const SORTABLE_FIELDS = [
  'claimNumber',
  'claimant',
  'lineOfBusiness',
  'channel',
  'status',
  'priority',
  'riskScore',
  'amount',
  'receivedAt',
  'assigneeName',
] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface ClaimQuery {
  q?: string;
  status?: ClaimStatus[];
  priority?: ClaimPriority[];
  channel?: ClaimChannel[];
  sortBy: SortField;
  sortDir: SortDirection;
}

export interface ClaimPage {
  rows: Claim[];
  offset: number;
  limit: number;
  total: number;
}

export interface ClaimStats {
  total: number;
  open: number;
  highRisk: number;
  assignedToMe: number;
}

export interface ClaimUpdate {
  status?: ClaimStatus;
  priority?: ClaimPriority;
  amount?: number;
}

// ---------- Documents ----------
export type Rotation = 0 | 90 | 180 | 270;

/** A page is a *reference* into an immutable source file. Edits never rewrite bytes on the client. */
export interface PageRef {
  /** Stable id — survives reorder/split/merge so comments & annotations stay attached. */
  id: string;
  fileId: string;
  sourcePageIndex: number;
  rotation: Rotation;
}

export interface SourceFile {
  id: string;
  url: string;
  sizeBytes: number;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
}

export interface ClaimDocument {
  id: string;
  claimId: string;
  name: string;
  pages: PageRef[];
  version: number;
  updatedAt: string;
}

export interface DocumentCapabilities {
  edit: boolean;
  comment: boolean;
  annotate: boolean;
}

export interface ClaimDocumentsResponse {
  claim: Claim;
  documents: ClaimDocument[];
  files: Record<string, SourceFile>;
  /** Server-computed for the current user and this claim's state. */
  capabilities: DocumentCapabilities;
}

export type DocumentOperation =
  | { type: 'deletePages'; documentId: string; pageIds: string[] }
  | { type: 'rotatePages'; documentId: string; pageIds: string[]; delta: 90 | -90 }
  | { type: 'movePage'; documentId: string; pageId: string; toIndex: number }
  | { type: 'splitDocument'; documentId: string; atPageId: string; newDocumentId: string; newName: string }
  | { type: 'mergeDocuments'; targetDocumentId: string; sourceDocumentId: string }
  | { type: 'deleteDocument'; documentId: string }
  | { type: 'renameDocument'; documentId: string; name: string };

export interface CommitOperationsRequest {
  idempotencyKey: string;
  /** documentId -> version the client edited against */
  baseVersions: Record<string, number>;
  operations: DocumentOperation[];
  /** Demo-only switch to exercise the failure/retry path. */
  simulateFailure?: boolean;
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  step: string;
  error?: string;
  createdAt: string;
}

// ---------- Collaboration ----------
export interface PageComment {
  id: string;
  claimId: string;
  pageId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export type AnnotationKind = 'highlight' | 'rectangle';

/** Normalized (0–1) coordinates in the *unrotated* page space → zoom- and rotation-independent. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  claimId: string;
  pageId: string;
  kind: AnnotationKind;
  rect: NormalizedRect;
  authorId: string;
  authorName: string;
  createdAt: string;
}

// ---------- Errors ----------
export interface ApiErrorBody {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION' | 'INTERNAL';
  message: string;
}
