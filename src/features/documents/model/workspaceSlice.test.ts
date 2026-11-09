import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import type { ClaimDocument } from '@/shared/api/contracts';
import {
  selectActiveDocument,
  selectCanRedo,
  selectWorkingDocuments,
  workspaceActions,
  workspaceReducer,
} from './workspaceSlice';

const documents: ClaimDocument[] = [
  {
    id: 'd1',
    claimId: 'c1',
    name: 'Report.pdf',
    version: 1,
    updatedAt: '',
    pages: ['p1', 'p2', 'p3', 'p4'].map((id, i) => ({
      id,
      fileId: 'f1',
      sourcePageIndex: i,
      rotation: 0 as const,
    })),
  },
  {
    id: 'd2',
    claimId: 'c1',
    name: 'Photos.pdf',
    version: 7,
    updatedAt: '',
    pages: [{ id: 'q1', fileId: 'f2', sourcePageIndex: 0, rotation: 0 as const }],
  },
];

const setup = () => {
  const store = configureStore({ reducer: { workspace: workspaceReducer } });
  store.dispatch(workspaceActions.workspaceOpened({ claimId: 'c1', documents }));
  return store;
};

describe('workspace slice', () => {
  it('opens on the first document with version snapshot', () => {
    const store = setup();
    expect(selectActiveDocument(store.getState())?.id).toBe('d1');
    expect(store.getState().workspace.baseVersions).toEqual({ d1: 1, d2: 7 });
    expect(store.getState().workspace.activePageId).toBe('p1');
  });

  it('projects the draft without mutating the server snapshot, and supports undo/redo', () => {
    const store = setup();
    store.dispatch(
      workspaceActions.operationApplied({ type: 'deletePages', documentId: 'd1', pageIds: ['p2'] }),
    );
    store.dispatch(
      workspaceActions.operationApplied({
        type: 'rotatePages',
        documentId: 'd1',
        pageIds: ['p1'],
        delta: 90,
      }),
    );
    expect(selectActiveDocument(store.getState())?.pages.map((p) => p.id)).toEqual(['p1', 'p3', 'p4']);
    expect(store.getState().workspace.base[0]!.pages).toHaveLength(4);

    store.dispatch(workspaceActions.undo());
    store.dispatch(workspaceActions.undo());
    expect(selectActiveDocument(store.getState())?.pages).toHaveLength(4);
    expect(selectCanRedo(store.getState())).toBe(true);

    store.dispatch(workspaceActions.redo());
    expect(selectActiveDocument(store.getState())?.pages.map((p) => p.id)).toEqual(['p1', 'p3', 'p4']);
  });

  it('a new command clears the redo stack', () => {
    const store = setup();
    store.dispatch(
      workspaceActions.operationApplied({ type: 'renameDocument', documentId: 'd1', name: 'A' }),
    );
    store.dispatch(workspaceActions.undo());
    store.dispatch(
      workspaceActions.operationApplied({ type: 'renameDocument', documentId: 'd1', name: 'B' }),
    );
    expect(selectCanRedo(store.getState())).toBe(false);
  });

  it('supports shift-click range selection and drops selection of deleted pages', () => {
    const store = setup();
    store.dispatch(workspaceActions.pageClicked({ pageId: 'p1', mode: 'single' }));
    store.dispatch(workspaceActions.pageClicked({ pageId: 'p3', mode: 'range' }));
    expect(store.getState().workspace.selectedPageIds).toEqual(['p1', 'p2', 'p3']);

    store.dispatch(
      workspaceActions.operationApplied({ type: 'deletePages', documentId: 'd1', pageIds: ['p2'] }),
    );
    expect(store.getState().workspace.selectedPageIds).toEqual(['p1', 'p3']);
  });

  it('follows the merge target when the active document is merged away', () => {
    const store = setup();
    store.dispatch(
      workspaceActions.operationApplied({
        type: 'mergeDocuments',
        targetDocumentId: 'd2',
        sourceDocumentId: 'd1',
      }),
    );
    expect(selectActiveDocument(store.getState())?.id).toBe('d2');
    expect(selectWorkingDocuments(store.getState())).toHaveLength(1);
  });

  it('restores a persisted draft and clears it on a fresh server snapshot', () => {
    const store = configureStore({ reducer: { workspace: workspaceReducer } });
    store.dispatch(
      workspaceActions.workspaceOpened({
        claimId: 'c1',
        documents,
        draft: [{ type: 'deleteDocument', documentId: 'd2' }],
      }),
    );
    expect(store.getState().workspace.restoredDraftCount).toBe(1);
    expect(selectWorkingDocuments(store.getState())).toHaveLength(1);

    store.dispatch(workspaceActions.serverSnapshotReceived(documents));
    expect(store.getState().workspace.past).toEqual([]);
    expect(selectWorkingDocuments(store.getState())).toHaveLength(2);
  });
});
