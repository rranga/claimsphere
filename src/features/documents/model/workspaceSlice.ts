import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ClaimDocument, DocumentOperation } from '@/shared/api/contracts';
import { applyOperations } from '@/shared/domain/documentOperations';

/**
 * Client-side editing state for the document workspace (Redux Toolkit).
 *
 * Why Redux here (and not TanStack Query / Context)?
 *  - It is *client-owned* state shared by many distant components (toolbar, thumbnails,
 *    viewer, draft bar), with high-frequency updates (selection, active page) → selector-based
 *    subscriptions avoid context-style re-render cascades.
 *  - The draft is a serializable COMMAND LOG (`past`) over an immutable server snapshot (`base`).
 *    Undo/redo are just moving commands between stacks; the visible document is a memoized
 *    projection `applyOperations(base, past)`; the same log is what we POST to the server.
 */
export type WorkspaceTool = 'select' | 'highlight' | 'rectangle';

export interface WorkspaceState {
  claimId: string | null;
  base: ClaimDocument[];
  baseVersions: Record<string, number>;
  past: DocumentOperation[];
  future: DocumentOperation[];
  activeDocumentId: string | null;
  activePageId: string | null;
  selectedPageIds: string[];
  /** Selection anchor for shift-click range selection. */
  anchorPageId: string | null;
  zoom: number;
  tool: WorkspaceTool;
  /** Incremented to ask the viewer to scroll to `activePageId` (thumbnail click, keyboard). */
  scrollRequest: number;
  restoredDraftCount: number;
}

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const initialState: WorkspaceState = {
  claimId: null,
  base: [],
  baseVersions: {},
  past: [],
  future: [],
  activeDocumentId: null,
  activePageId: null,
  selectedPageIds: [],
  anchorPageId: null,
  zoom: 1,
  tool: 'select',
  scrollRequest: 0,
  restoredDraftCount: 0,
};

const working = (state: WorkspaceState) => applyOperations(state.base, state.past);
const versionsOf = (docs: ClaimDocument[]) => Object.fromEntries(docs.map((d) => [d.id, d.version]));

/** Keep active document/page/selection pointing at things that still exist after any change. */
function reconcile(state: WorkspaceState) {
  const docs = working(state);
  const active = docs.find((d) => d.id === state.activeDocumentId) ?? docs[0];
  state.activeDocumentId = active?.id ?? null;
  const pageIds = new Set(active?.pages.map((p) => p.id));
  state.selectedPageIds = state.selectedPageIds.filter((id) => pageIds.has(id));
  if (!state.activePageId || !pageIds.has(state.activePageId))
    state.activePageId = active?.pages[0]?.id ?? null;
}

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    workspaceOpened(
      state,
      {
        payload,
      }: PayloadAction<{ claimId: string; documents: ClaimDocument[]; draft?: DocumentOperation[] }>,
    ) {
      Object.assign(state, initialState, {
        claimId: payload.claimId,
        base: payload.documents,
        baseVersions: versionsOf(payload.documents),
        past: payload.draft ?? [],
        restoredDraftCount: payload.draft?.length ?? 0,
        activeDocumentId: payload.documents[0]?.id ?? null,
      });
      reconcile(state);
    },
    /** New authoritative snapshot (after a successful commit or an explicit reload). Clears the draft. */
    serverSnapshotReceived(state, { payload }: PayloadAction<ClaimDocument[]>) {
      state.base = payload;
      state.baseVersions = versionsOf(payload);
      state.past = [];
      state.future = [];
      state.restoredDraftCount = 0;
      reconcile(state);
    },
    operationApplied(state, { payload: op }: PayloadAction<DocumentOperation>) {
      state.past.push(op);
      state.future = [];
      if (op.type === 'mergeDocuments' && state.activeDocumentId === op.sourceDocumentId) {
        state.activeDocumentId = op.targetDocumentId;
      }
      if (op.type === 'splitDocument') state.selectedPageIds = [];
      reconcile(state);
    },
    undo(state) {
      const op = state.past.pop();
      if (op) state.future.unshift(op);
      reconcile(state);
    },
    redo(state) {
      const op = state.future.shift();
      if (op) state.past.push(op);
      reconcile(state);
    },
    draftDiscarded(state) {
      state.past = [];
      state.future = [];
      state.restoredDraftCount = 0;
      reconcile(state);
    },
    restoredDraftAcknowledged(state) {
      state.restoredDraftCount = 0;
    },
    documentSelected(state, { payload }: PayloadAction<string>) {
      state.activeDocumentId = payload;
      state.activePageId = null;
      state.selectedPageIds = [];
      state.anchorPageId = null;
      reconcile(state);
      state.scrollRequest++;
    },
    pageClicked(state, { payload }: PayloadAction<{ pageId: string; mode: 'single' | 'toggle' | 'range' }>) {
      const { pageId, mode } = payload;
      const pages = working(state).find((d) => d.id === state.activeDocumentId)?.pages ?? [];
      if (mode === 'toggle') {
        state.selectedPageIds = state.selectedPageIds.includes(pageId)
          ? state.selectedPageIds.filter((id) => id !== pageId)
          : [...state.selectedPageIds, pageId];
        state.anchorPageId = pageId;
      } else if (mode === 'range' && state.anchorPageId) {
        const a = pages.findIndex((p) => p.id === state.anchorPageId);
        const b = pages.findIndex((p) => p.id === pageId);
        const [from, to] = a < b ? [a, b] : [b, a];
        state.selectedPageIds = pages.slice(from, to + 1).map((p) => p.id);
      } else {
        state.selectedPageIds = [pageId];
        state.anchorPageId = pageId;
      }
      state.activePageId = pageId;
      state.scrollRequest++;
    },
    selectionCleared(state) {
      state.selectedPageIds = [];
    },
    /** Reported by the viewer while scrolling — deliberately does NOT trigger a scroll request. */
    activePageChanged(state, { payload }: PayloadAction<string>) {
      state.activePageId = payload;
    },
    zoomChanged(state, { payload }: PayloadAction<number>) {
      state.zoom = Math.max(ZOOM_LEVELS[0], Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!, payload));
    },
    toolChanged(state, { payload }: PayloadAction<WorkspaceTool>) {
      state.tool = payload;
    },
  },
});

export const workspaceActions = workspaceSlice.actions;
export const workspaceReducer = workspaceSlice.reducer;

// ---------- selectors (memoized; components subscribe to the smallest slice they need) ----------
type RootLike = { workspace: WorkspaceState };

export const selectWorkingDocuments = createSelector(
  [(s: RootLike) => s.workspace.base, (s: RootLike) => s.workspace.past],
  (base, past) => applyOperations(base, past),
);

export const selectActiveDocument = createSelector(
  [selectWorkingDocuments, (s: RootLike) => s.workspace.activeDocumentId],
  (docs, id) => docs.find((d) => d.id === id) ?? null,
);

export const selectSelectedPageIds = (s: RootLike) => s.workspace.selectedPageIds;
export const selectActivePageId = (s: RootLike) => s.workspace.activePageId;
export const selectZoom = (s: RootLike) => s.workspace.zoom;
export const selectTool = (s: RootLike) => s.workspace.tool;
export const selectScrollRequest = (s: RootLike) => s.workspace.scrollRequest;
export const selectPendingOperations = (s: RootLike) => s.workspace.past;
export const selectCanUndo = (s: RootLike) => s.workspace.past.length > 0;
export const selectCanRedo = (s: RootLike) => s.workspace.future.length > 0;
