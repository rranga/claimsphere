import { useQuery } from '@tanstack/react-query';
import { Files, Info, Lock, MessageSquare, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  Annotation,
  AnnotationKind,
  ClaimDocumentsResponse,
  NormalizedRect,
  PageComment,
  Session,
} from '@/shared/api/contracts';
import { MEDIA, useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Sheet } from '@/shared/ui/Sheet';
import { FullPageSpinner } from '@/shared/ui/Spinner';
import { annotationsQuery, commentsQuery } from '../api/documentsApi';
import { useAddAnnotation } from '../hooks/useCollaboration';
import { useCommitDraft } from '../hooks/useCommitDraft';
import { loadDraft, saveDraft } from '../model/draftStorage';
import { useWorkspaceDispatch, useWorkspaceSelector } from '../model/hooks';
import { selectActiveDocument, selectActivePageId, workspaceActions } from '../model/workspaceSlice';
import { PageViewer } from '../viewer/PageViewer';
import { CollaborationPanel } from './CollaborationPanel';
import { DocumentList } from './DocumentList';
import { DraftBar } from './DraftBar';
import { LoadStats } from './LoadStats';
import { PageToolbar } from './PageToolbar';
import { ThumbnailRail } from './ThumbnailRail';

function groupByPage<T extends { pageId: string }>(items: T[] | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  items?.forEach((item) => map.set(item.pageId, [...(map.get(item.pageId) ?? []), item]));
  return map;
}

const EMPTY_COMMENTS: PageComment[] = [];
const EMPTY_ANNOTATIONS: Annotation[] = [];

function readOnlyReason(session: Session, data: ClaimDocumentsResponse): string {
  if (!session.permissions.includes('document:edit'))
    return 'Your role can view and comment, but not modify documents.';
  if (data.claim.status === 'Closed') return 'This claim is closed — its documents are read-only.';
  return 'Only the assigned adjuster can modify these documents.';
}

export function DocumentWorkspace({ data, session }: { data: ClaimDocumentsResponse; session: Session }) {
  const claimId = data.claim.id;
  const { capabilities, files } = data;
  const dispatch = useWorkspaceDispatch();
  const openedFor = useWorkspaceSelector((s) => s.workspace.claimId);
  const past = useWorkspaceSelector((s) => s.workspace.past);
  const baseVersions = useWorkspaceSelector((s) => s.workspace.baseVersions);
  const restoredDraftCount = useWorkspaceSelector((s) => s.workspace.restoredDraftCount);
  const activeDocument = useWorkspaceSelector(selectActiveDocument);
  const activePageId = useWorkspaceSelector(selectActivePageId);
  const commit = useCommitDraft(claimId);

  // Open the workspace for this claim once, restoring a persisted draft if it is still valid.
  useEffect(() => {
    if (openedFor === claimId) return;
    const draft = capabilities.edit ? loadDraft(claimId, data.documents) : ({ status: 'none' } as const);
    if (draft.status === 'stale') {
      toast.warning('Your unsaved draft could not be restored', {
        description: 'These documents changed since your draft was created.',
      });
    }
    dispatch(
      workspaceActions.workspaceOpened({
        claimId,
        documents: data.documents,
        draft: draft.status === 'restored' ? draft.operations : undefined,
      }),
    );
  }, [openedFor, claimId, capabilities.edit, data.documents, dispatch]);

  // Persist the command log so a refresh or crash never loses work.
  useEffect(() => {
    if (openedFor === claimId && capabilities.edit) saveDraft(claimId, past, baseVersions);
  }, [openedFor, claimId, capabilities.edit, past, baseVersions]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!past.length) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [past.length]);

  const comments = useQuery(commentsQuery(claimId));
  const annotations = useQuery(annotationsQuery(claimId));
  const commentsByPage = useMemo(() => groupByPage(comments.data), [comments.data]);
  const annotationsByPage = useMemo(() => groupByPage(annotations.data), [annotations.data]);
  const commentCounts = useMemo(
    () => new Map([...commentsByPage].map(([pageId, list]) => [pageId, list.length])),
    [commentsByPage],
  );

  const { mutate: addAnnotation } = useAddAnnotation(claimId, session);
  const onCreateAnnotation = useCallback(
    (pageId: string, kind: AnnotationKind, rect: NormalizedRect) => addAnnotation({ pageId, kind, rect }),
    [addAnnotation],
  );

  const activeFiles = useMemo(() => {
    const ids = new Set(activeDocument?.pages.map((p) => p.fileId));
    return Object.values(files).filter((f) => ids.has(f.id));
  }, [activeDocument, files]);

  // Responsive layout: phone = viewer only (panels in sheets); tablet = + documents column;
  // wide = + comments column. Panels mount exactly once — in a column OR a sheet.
  const isPhone = useMediaQuery(MEDIA.phone);
  const isWide = useMediaQuery(MEDIA.wide);
  const [pagesSheetOpen, setPagesSheetOpen] = useState(false);
  const [commentsSheetOpen, setCommentsSheetOpen] = useState(false);

  if (openedFor !== claimId) return <FullPageSpinner label="Preparing workspace…" />;
  if (!activeDocument) {
    return <p className="text-muted p-8 text-center text-sm">This claim has no documents.</p>;
  }

  const pageNumber = activeDocument.pages.findIndex((p) => p.id === activePageId) + 1;

  const canEditNow = capabilities.edit && !commit.isRunning;
  const activePageComments = (activePageId && commentsByPage.get(activePageId)) || EMPTY_COMMENTS;

  const navigator = (
    <>
      <DocumentList activeDocumentId={activeDocument.id} files={files} canEdit={canEditNow} />
      <div className="min-h-0 flex-1">
        <ErrorBoundary region="Thumbnails" resetKey={activeDocument.id}>
          {/* Keyed by document: each document gets fresh virtualizer + scroll state. */}
          <ThumbnailRail
            key={activeDocument.id}
            document={activeDocument}
            files={files}
            canEdit={canEditNow}
            commentCounts={commentCounts}
          />
        </ErrorBoundary>
      </div>
    </>
  );

  const collaboration = (
    <ErrorBoundary region="Comments" resetKey={activePageId}>
      <CollaborationPanel
        claimId={claimId}
        session={session}
        pageId={activePageId}
        pageNumber={pageNumber}
        comments={activePageComments}
        annotations={(activePageId && annotationsByPage.get(activePageId)) || EMPTY_ANNOTATIONS}
        capabilities={capabilities}
        isLoading={comments.isPending}
      />
    </ErrorBoundary>
  );

  return (
    <div
      className={cn(
        'grid h-full min-h-0',
        isPhone
          ? 'grid-cols-1'
          : isWide
            ? 'grid-cols-[248px_minmax(0,1fr)_320px]'
            : 'grid-cols-[248px_minmax(0,1fr)]',
      )}
    >
      {!isPhone && <div className="border-line flex min-h-0 flex-col border-r bg-white">{navigator}</div>}

      <section aria-label="Document viewer" className="flex min-h-0 flex-col">
        {restoredDraftCount > 0 && (
          <div className="border-info-600/20 bg-info-50 text-info-600 flex items-center gap-2 border-b px-4 py-2 text-sm">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            Restored {restoredDraftCount} unsaved change{restoredDraftCount === 1 ? '' : 's'} from your
            previous session.
            <button
              type="button"
              aria-label="Dismiss"
              className="ml-auto rounded p-1 hover:bg-white"
              onClick={() => dispatch(workspaceActions.restoredDraftAcknowledged())}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        {!capabilities.edit && (
          <div className="border-line bg-canvas text-muted flex items-center gap-2 border-b px-4 py-2 text-xs">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" /> Read-only ·{' '}
            {readOnlyReason(session, data)}
          </div>
        )}
        <DraftBar commit={commit} canEdit={capabilities.edit} />
        <div className="border-line flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2">
          <h2 className="min-w-0 truncate text-sm font-semibold">
            {activeDocument.name}
            <span className="text-muted ml-2 font-normal">{activeDocument.pages.length} pages</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <LoadStats files={activeFiles} />
            {isPhone && (
              <Button size="sm" onClick={() => setPagesSheetOpen(true)}>
                <Files className="size-4" aria-hidden="true" /> Pages
              </Button>
            )}
            {!isWide && (
              <Button size="sm" onClick={() => setCommentsSheetOpen(true)}>
                <MessageSquare className="size-4" aria-hidden="true" /> Comments
                {activePageComments.length > 0 && (
                  <span className="bg-brand-600 rounded-full px-1.5 text-[10px] text-white">
                    {activePageComments.length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
        <PageToolbar
          document={activeDocument}
          capabilities={commit.isRunning ? { ...capabilities, edit: false } : capabilities}
        />
        <div className="min-h-0 flex-1">
          <ErrorBoundary region="Document viewer" resetKey={activeDocument.id}>
            <PageViewer
              key={activeDocument.id}
              document={activeDocument}
              files={files}
              annotationsByPage={annotationsByPage}
              canAnnotate={capabilities.annotate}
              onCreateAnnotation={onCreateAnnotation}
            />
          </ErrorBoundary>
        </div>
      </section>

      {isWide && <div className="border-line min-h-0 border-l bg-white">{collaboration}</div>}

      {isPhone && (
        <Sheet open={pagesSheetOpen} onOpenChange={setPagesSheetOpen} title="Documents & pages" side="left">
          {navigator}
        </Sheet>
      )}
      {!isWide && (
        <Sheet open={commentsSheetOpen} onOpenChange={setCommentsSheetOpen} title="Comments & annotations">
          {collaboration}
        </Sheet>
      )}
    </div>
  );
}
