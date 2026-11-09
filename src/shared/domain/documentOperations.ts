import type { ClaimDocument, DocumentOperation, Rotation } from '@/shared/api/contracts';

/**
 * Pure, deterministic document-operation engine.
 *
 * The *same* function runs in two places:
 *  - client: to preview the draft instantly (no bytes are touched — pages are references), and
 *  - server: as the authoritative, atomic commit (it re-validates everything).
 *
 * Because pages are references with stable ids, split/merge/reorder are O(pages) list
 * operations regardless of whether the source file is 1 MB or 1 GB.
 */
export class DocumentOperationError extends Error {
  constructor(
    message: string,
    readonly operation: DocumentOperation,
  ) {
    super(message);
    this.name = 'DocumentOperationError';
  }
}

const rotate = (rotation: Rotation, delta: 90 | -90): Rotation =>
  ((((rotation + delta) % 360) + 360) % 360) as Rotation;

function findDocument(docs: ClaimDocument[], id: string, op: DocumentOperation): ClaimDocument {
  const doc = docs.find((d) => d.id === id);
  if (!doc) throw new DocumentOperationError(`Document ${id} does not exist`, op);
  return doc;
}

const replace = (docs: ClaimDocument[], next: ClaimDocument) =>
  docs.map((d) => (d.id === next.id ? next : d));

export function applyOperation(docs: ClaimDocument[], op: DocumentOperation): ClaimDocument[] {
  switch (op.type) {
    case 'deletePages': {
      const doc = findDocument(docs, op.documentId, op);
      const toDelete = new Set(op.pageIds);
      const pages = doc.pages.filter((p) => !toDelete.has(p.id));
      if (pages.length === doc.pages.length)
        throw new DocumentOperationError('No matching pages to delete', op);
      if (pages.length === 0) {
        throw new DocumentOperationError(
          'A document must keep at least one page — delete the document instead',
          op,
        );
      }
      return replace(docs, { ...doc, pages });
    }
    case 'rotatePages': {
      const doc = findDocument(docs, op.documentId, op);
      const ids = new Set(op.pageIds);
      return replace(docs, {
        ...doc,
        pages: doc.pages.map((p) => (ids.has(p.id) ? { ...p, rotation: rotate(p.rotation, op.delta) } : p)),
      });
    }
    case 'movePage': {
      const doc = findDocument(docs, op.documentId, op);
      const from = doc.pages.findIndex((p) => p.id === op.pageId);
      if (from === -1) throw new DocumentOperationError(`Page ${op.pageId} not found`, op);
      const pages = [...doc.pages];
      const [page] = pages.splice(from, 1);
      const to = Math.max(0, Math.min(op.toIndex, pages.length));
      pages.splice(to, 0, page!);
      return replace(docs, { ...doc, pages });
    }
    case 'splitDocument': {
      const doc = findDocument(docs, op.documentId, op);
      if (docs.some((d) => d.id === op.newDocumentId)) {
        throw new DocumentOperationError(`Document ${op.newDocumentId} already exists`, op);
      }
      const at = doc.pages.findIndex((p) => p.id === op.atPageId);
      if (at <= 0) throw new DocumentOperationError('Split point must be after the first page', op);
      const head: ClaimDocument = { ...doc, pages: doc.pages.slice(0, at) };
      const tail: ClaimDocument = {
        ...doc,
        id: op.newDocumentId,
        name: op.newName,
        pages: doc.pages.slice(at),
        version: 0,
      };
      const index = docs.findIndex((d) => d.id === doc.id);
      return [...docs.slice(0, index), head, tail, ...docs.slice(index + 1)];
    }
    case 'mergeDocuments': {
      if (op.targetDocumentId === op.sourceDocumentId) {
        throw new DocumentOperationError('Cannot merge a document into itself', op);
      }
      const target = findDocument(docs, op.targetDocumentId, op);
      const source = findDocument(docs, op.sourceDocumentId, op);
      return replace(docs, { ...target, pages: [...target.pages, ...source.pages] }).filter(
        (d) => d.id !== source.id,
      );
    }
    case 'deleteDocument': {
      findDocument(docs, op.documentId, op);
      return docs.filter((d) => d.id !== op.documentId);
    }
    case 'renameDocument': {
      const doc = findDocument(docs, op.documentId, op);
      const name = op.name.trim();
      if (!name) throw new DocumentOperationError('Document name is required', op);
      return replace(docs, { ...doc, name });
    }
  }
}

export const applyOperations = (docs: ClaimDocument[], ops: readonly DocumentOperation[]): ClaimDocument[] =>
  ops.reduce(applyOperation, docs);

/** Existing documents an operation list depends on (used for optimistic-concurrency checks). */
export function referencedDocumentIds(ops: readonly DocumentOperation[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.type === 'mergeDocuments') {
      ids.add(op.targetDocumentId);
      ids.add(op.sourceDocumentId);
    } else {
      ids.add(op.documentId);
    }
  }
  return ids;
}

export function describeOperation(op: DocumentOperation): string {
  switch (op.type) {
    case 'deletePages':
      return `Delete ${op.pageIds.length} page${op.pageIds.length > 1 ? 's' : ''}`;
    case 'rotatePages':
      return `Rotate ${op.pageIds.length} page${op.pageIds.length > 1 ? 's' : ''} ${op.delta > 0 ? 'right' : 'left'}`;
    case 'movePage':
      return `Move page to position ${op.toIndex + 1}`;
    case 'splitDocument':
      return `Split into “${op.newName}”`;
    case 'mergeDocuments':
      return 'Merge documents';
    case 'deleteDocument':
      return 'Delete document';
    case 'renameDocument':
      return `Rename to “${op.name}”`;
  }
}
