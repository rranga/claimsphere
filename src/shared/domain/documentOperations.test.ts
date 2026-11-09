import { describe, expect, it } from 'vitest';
import type { ClaimDocument } from '@/shared/api/contracts';
import {
  applyOperation,
  applyOperations,
  DocumentOperationError,
  referencedDocumentIds,
} from './documentOperations';

const doc = (id: string, pages: number, name = `${id}.pdf`): ClaimDocument => ({
  id,
  claimId: 'c-1',
  name,
  version: 3,
  updatedAt: '2026-01-01T00:00:00.000Z',
  pages: Array.from({ length: pages }, (_, i) => ({
    id: `${id}-p${i + 1}`,
    fileId: `f-${id}`,
    sourcePageIndex: i,
    rotation: 0 as const,
  })),
});

const ids = (d: ClaimDocument | undefined) => d?.pages.map((p) => p.id);

describe('document operation engine', () => {
  const base = [doc('a', 5), doc('b', 2)];

  it('splits a document at a page, keeping stable page ids', () => {
    const result = applyOperation(base, {
      type: 'splitDocument',
      documentId: 'a',
      atPageId: 'a-p3',
      newDocumentId: 'a2',
      newName: 'Part 2',
    });
    expect(result.map((d) => d.id)).toEqual(['a', 'a2', 'b']);
    expect(ids(result[0])).toEqual(['a-p1', 'a-p2']);
    expect(ids(result[1])).toEqual(['a-p3', 'a-p4', 'a-p5']);
    expect(result[1]).toMatchObject({ name: 'Part 2', version: 0 });
  });

  it('rejects splitting at the first page (would leave an empty document)', () => {
    expect(() =>
      applyOperation(base, {
        type: 'splitDocument',
        documentId: 'a',
        atPageId: 'a-p1',
        newDocumentId: 'x',
        newName: 'x',
      }),
    ).toThrow(DocumentOperationError);
  });

  it('merges source pages onto the target and removes the source', () => {
    const result = applyOperation(base, {
      type: 'mergeDocuments',
      targetDocumentId: 'b',
      sourceDocumentId: 'a',
    });
    expect(result.map((d) => d.id)).toEqual(['b']);
    expect(ids(result[0])).toEqual(['b-p1', 'b-p2', 'a-p1', 'a-p2', 'a-p3', 'a-p4', 'a-p5']);
  });

  it('deletes pages but never all of them', () => {
    expect(ids(applyOperation(base, { type: 'deletePages', documentId: 'b', pageIds: ['b-p1'] })[1])).toEqual(
      ['b-p2'],
    );
    expect(() =>
      applyOperation(base, { type: 'deletePages', documentId: 'b', pageIds: ['b-p1', 'b-p2'] }),
    ).toThrow(/at least one page/);
  });

  it('moves a page and clamps the target index', () => {
    expect(
      ids(applyOperation(base, { type: 'movePage', documentId: 'a', pageId: 'a-p1', toIndex: 99 })[0]),
    ).toEqual(['a-p2', 'a-p3', 'a-p4', 'a-p5', 'a-p1']);
  });

  it('rotates pages in both directions with wrap-around', () => {
    const left = applyOperation(base, {
      type: 'rotatePages',
      documentId: 'a',
      pageIds: ['a-p1'],
      delta: -90,
    });
    expect(left[0]!.pages[0]!.rotation).toBe(270);
    const back = applyOperation(left, { type: 'rotatePages', documentId: 'a', pageIds: ['a-p1'], delta: 90 });
    expect(back[0]!.pages[0]!.rotation).toBe(0);
  });

  it('is pure: never mutates its input and preserves untouched document identity', () => {
    const snapshot = structuredClone(base);
    const result = applyOperation(base, { type: 'renameDocument', documentId: 'a', name: '  Renamed  ' });
    expect(base).toEqual(snapshot);
    expect(result[0]!.name).toBe('Renamed');
    expect(result[1]).toBe(base[1]); // reference equality → server bumps versions only for changed docs
  });

  it('replays a command log deterministically', () => {
    const log = [
      { type: 'splitDocument', documentId: 'a', atPageId: 'a-p4', newDocumentId: 'a2', newName: 'Tail' },
      { type: 'mergeDocuments', targetDocumentId: 'b', sourceDocumentId: 'a2' },
      { type: 'deleteDocument', documentId: 'a' },
    ] as const;
    const result = applyOperations(base, log);
    expect(result.map((d) => d.id)).toEqual(['b']);
    expect(ids(result[0])).toEqual(['b-p1', 'b-p2', 'a-p4', 'a-p5']);
    expect([...referencedDocumentIds(log)].sort()).toEqual(['a', 'a2', 'b']);
  });
});
