import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useRef } from 'react';
import type {
  Annotation,
  AnnotationKind,
  ClaimDocument,
  NormalizedRect,
  PageRef,
  SourceFile,
} from '@/shared/api/contracts';
import { useElementWidth } from '@/shared/hooks/useElementWidth';
import { cn } from '@/shared/lib/cn';
import { displayAspect } from '../lib/geometry';
import { useWorkspaceDispatch, useWorkspaceSelector } from '../model/hooks';
import {
  selectActivePageId,
  selectScrollRequest,
  selectSelectedPageIds,
  selectTool,
  selectZoom,
  workspaceActions,
  type WorkspaceTool,
} from '../model/workspaceSlice';
import { AnnotationLayer } from './AnnotationLayer';
import { PageCanvas } from './PageCanvas';

const GAP = 24;
const MAX_FIT_WIDTH = 920;

interface Props {
  document: ClaimDocument;
  files: Record<string, SourceFile>;
  annotationsByPage: Map<string, Annotation[]>;
  canAnnotate: boolean;
  onCreateAnnotation: (pageId: string, kind: AnnotationKind, rect: NormalizedRect) => void;
}

/**
 * Virtualized page list. A 1,500-page document mounts only the ~3–5 pages around the viewport;
 * each page fetches just the byte ranges it needs. Page heights are known up-front from the
 * server manifest, so the scrollbar is exact before any page is rendered.
 */
export function PageViewer({ document, files, annotationsByPage, canAnnotate, onCreateAnnotation }: Props) {
  const dispatch = useWorkspaceDispatch();
  const zoom = useWorkspaceSelector(selectZoom);
  const tool = useWorkspaceSelector(selectTool);
  const selected = useWorkspaceSelector(selectSelectedPageIds);
  const activePageId = useWorkspaceSelector(selectActivePageId);
  const scrollRequest = useWorkspaceSelector(selectScrollRequest);

  const scrollRef = useRef<HTMLDivElement>(null);
  const containerWidth = useElementWidth(scrollRef);
  const pageWidth = Math.round(Math.max(280, Math.min(containerWidth - 64, MAX_FIT_WIDTH)) * zoom);
  const { pages } = document;

  const heightOf = (page: PageRef) => {
    const file = files[page.fileId];
    return file
      ? Math.round(pageWidth * displayAspect(file.pageWidth, file.pageHeight, page.rotation))
      : pageWidth * 1.3;
  };

  const lastReported = useRef<string | null>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual exposes an imperative instance by design.
  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => heightOf(pages[index]!) + GAP,
    getItemKey: (index) => pages[index]!.id, // stable keys: reorder/rotate never remounts unrelated pages
    overscan: 2,
    paddingStart: GAP,
    onChange: (instance) => {
      // Report the page under the top third of the viewport as "active" (drives thumbnails/comments).
      const offset = (instance.scrollOffset ?? 0) + (instance.scrollRect?.height ?? 0) / 3;
      const item = instance.getVirtualItemForOffset(offset);
      const pageId = item ? pages[item.index]?.id : undefined;
      if (pageId && pageId !== lastReported.current) {
        lastReported.current = pageId;
        dispatch(workspaceActions.activePageChanged(pageId));
      }
    },
  });

  // Zoom, rotation or reorder changes page heights → re-measure.
  const layoutKey = `${pageWidth}|${pages.map((p) => `${p.id}${p.rotation}`).join(',')}`;
  useEffect(() => {
    virtualizer.measure();
  }, [layoutKey, virtualizer]);

  // Explicit navigation requests (thumbnail click, document switch).
  useEffect(() => {
    if (!scrollRequest) return;
    const index = pages.findIndex((p) => p.id === activePageId);
    if (index >= 0) {
      lastReported.current = activePageId;
      virtualizer.scrollToIndex(index, { align: 'start' });
    }
    // Only react to new requests — not to every activePage change caused by scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequest]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto bg-[#eef0f6]"
      role="region"
      aria-label={`${document.name}, ${pages.length} pages`}
      // Focusable so keyboard users can scroll the document (axe: scrollable-region-focusable).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <div className="relative mx-auto" style={{ height: virtualizer.getTotalSize(), width: pageWidth }}>
        {virtualizer.getVirtualItems().map((item) => {
          const page = pages[item.index]!;
          const file = files[page.fileId];
          if (!file) return null;
          return (
            <ViewerPage
              key={item.key}
              page={page}
              file={file}
              index={item.index}
              total={pages.length}
              top={item.start}
              width={pageWidth}
              selected={selected.includes(page.id)}
              annotations={annotationsByPage.get(page.id)}
              tool={tool}
              canAnnotate={canAnnotate}
              onCreateAnnotation={onCreateAnnotation}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ViewerPageProps {
  page: PageRef;
  file: SourceFile;
  index: number;
  total: number;
  top: number;
  width: number;
  selected: boolean;
  annotations: Annotation[] | undefined;
  tool: WorkspaceTool;
  canAnnotate: boolean;
  onCreateAnnotation: Props['onCreateAnnotation'];
}

const ViewerPage = memo(function ViewerPage({
  page,
  file,
  index,
  total,
  top,
  width,
  selected,
  annotations,
  tool,
  canAnnotate,
  onCreateAnnotation,
}: ViewerPageProps) {
  const dispatch = useWorkspaceDispatch();
  return (
    <figure
      className="absolute left-0 m-0"
      style={{ transform: `translateY(${top}px)`, width }}
      aria-label={`Page ${index + 1} of ${total}`}
    >
      {/* Pointer shortcut only — the keyboard-accessible equivalent is the thumbnail listbox. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={cn(
          'relative shadow-[0_2px_12px_rgba(41,45,50,0.12)] ring-offset-2 transition-shadow',
          selected && 'ring-brand-500 ring-3',
        )}
        onClick={(event) => {
          if (tool !== 'select') return;
          dispatch(
            workspaceActions.pageClicked({
              pageId: page.id,
              mode: event.shiftKey ? 'range' : event.metaKey || event.ctrlKey ? 'toggle' : 'single',
            }),
          );
        }}
      >
        <PageCanvas file={file} pageIndex={page.sourcePageIndex} rotation={page.rotation} width={width} />
        <AnnotationLayer
          pageId={page.id}
          rotation={page.rotation}
          annotations={annotations}
          tool={tool}
          canAnnotate={canAnnotate}
          onCreate={onCreateAnnotation}
        />
      </div>
      <figcaption className="text-muted mt-1.5 text-center text-[11px]">
        Page {index + 1} of {total}
      </figcaption>
    </figure>
  );
});
