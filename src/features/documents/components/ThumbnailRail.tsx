import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { ClaimDocument, PageRef, SourceFile } from '@/shared/api/contracts';
import { cn } from '@/shared/lib/cn';
import { displayAspect } from '../lib/geometry';
import { useApplyOperation, useWorkspaceDispatch, useWorkspaceSelector } from '../model/hooks';
import {
  selectActivePageId,
  selectScrollRequest,
  selectSelectedPageIds,
  workspaceActions,
} from '../model/workspaceSlice';
import { PageCanvas } from '../viewer/PageCanvas';

const THUMB_WIDTH = 104;
const THUMB_GAP = 30;

interface Props {
  document: ClaimDocument;
  files: Record<string, SourceFile>;
  canEdit: boolean;
  commentCounts: Map<string, number>;
}

/**
 * Virtualized thumbnail strip (WAI-ARIA listbox, multi-select).
 *   Click / Ctrl+Click / Shift+Click   select, toggle, range
 *   ↑ ↓ Home End                       move focus, Shift extends selection
 *   Alt + ↑ ↓                          move the page — keyboard alternative to drag & drop
 */
export function ThumbnailRail({ document, files, canEdit, commentCounts }: Props) {
  const dispatch = useWorkspaceDispatch();
  const applyOperation = useApplyOperation();
  const selected = useWorkspaceSelector(selectSelectedPageIds);
  const activePageId = useWorkspaceSelector(selectActivePageId);
  const scrollRequest = useWorkspaceSelector(selectScrollRequest);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const { pages } = document;

  // eslint-disable-next-line react-hooks/incompatible-library -- imperative virtualizer API by design.
  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => {
      const page = pages[i]!;
      const file = files[page.fileId];
      return (
        Math.round(
          THUMB_WIDTH * (file ? displayAspect(file.pageWidth, file.pageHeight, page.rotation) : 1.3),
        ) + THUMB_GAP
      );
    },
    getItemKey: (i) => pages[i]!.id,
    overscan: 4,
    paddingStart: 12,
  });

  const layoutKey = pages.map((p) => `${p.id}${p.rotation}`).join(',');
  useEffect(() => {
    virtualizer.measure();
  }, [layoutKey, virtualizer]);

  // Keep the active page visible in the rail as the main viewer scrolls.
  const activeIndex = pages.findIndex((p) => p.id === activePageId);
  useEffect(() => {
    if (activeIndex >= 0) virtualizer.scrollToIndex(activeIndex, { align: 'auto' });
  }, [activeIndex, scrollRequest, virtualizer]);

  const focusThumb = (index: number) =>
    requestAnimationFrame(() =>
      scrollRef.current?.querySelector<HTMLElement>(`[data-thumb-index="${index}"]`)?.focus(),
    );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (activeIndex < 0) return;
    const last = pages.length - 1;
    const target =
      event.key === 'ArrowDown'
        ? Math.min(last, activeIndex + 1)
        : event.key === 'ArrowUp'
          ? Math.max(0, activeIndex - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    if (event.altKey && canEdit && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      applyOperation({ type: 'movePage', documentId: document.id, pageId: activePageId!, toIndex: target });
      focusThumb(target);
      return;
    }
    dispatch(
      workspaceActions.pageClicked({ pageId: pages[target]!.id, mode: event.shiftKey ? 'range' : 'single' }),
    );
    focusThumb(target);
  };

  const onDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    const pageId = event.dataTransfer.getData('application/x-claimsphere-page');
    setDropIndex(null);
    const from = pages.findIndex((p) => p.id === pageId);
    if (from < 0 || from === index) return;
    applyOperation({
      type: 'movePage',
      documentId: document.id,
      pageId,
      toIndex: from < index ? index - 1 : index,
    });
  };

  return (
    <div
      ref={scrollRef}
      role="listbox"
      aria-label={`Pages of ${document.name}`}
      aria-multiselectable="true"
      tabIndex={-1}
      className="h-full overflow-y-auto"
      onKeyDown={onKeyDown}
    >
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const page = pages[item.index]!;
          const file = files[page.fileId];
          if (!file) return null;
          return (
            <Thumbnail
              key={item.key}
              page={page}
              file={file}
              index={item.index}
              top={item.start}
              selected={selected.includes(page.id)}
              active={page.id === activePageId}
              comments={commentCounts.get(page.id) ?? 0}
              draggable={canEdit}
              showDropIndicator={dropIndex === item.index}
              onDragOverIndex={setDropIndex}
              onDropAt={onDrop}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ThumbnailProps {
  page: PageRef;
  file: SourceFile;
  index: number;
  top: number;
  selected: boolean;
  active: boolean;
  comments: number;
  draggable: boolean;
  showDropIndicator: boolean;
  onDragOverIndex: (index: number | null) => void;
  onDropAt: (event: DragEvent, index: number) => void;
}

const Thumbnail = memo(function Thumbnail({
  page,
  file,
  index,
  top,
  selected,
  active,
  comments,
  draggable,
  showDropIndicator,
  onDragOverIndex,
  onDropAt,
}: ThumbnailProps) {
  const dispatch = useWorkspaceDispatch();
  return (
    <div className="absolute left-0 w-full" style={{ transform: `translateY(${top}px)` }}>
      {showDropIndicator && (
        <div className="bg-brand-600 absolute -top-2 right-4 left-4 h-0.5 rounded" aria-hidden="true" />
      )}
      <div
        role="option"
        aria-selected={selected}
        aria-label={`Page ${index + 1}${comments ? `, ${comments} comments` : ''}`}
        data-thumb-index={index}
        tabIndex={active ? 0 : -1}
        draggable={draggable}
        onDragStart={(event) => {
          event.dataTransfer.setData('application/x-claimsphere-page', page.id);
          event.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(event) => {
          if (!draggable) return;
          event.preventDefault();
          onDragOverIndex(index);
        }}
        onDragLeave={() => onDragOverIndex(null)}
        onDrop={(event) => onDropAt(event, index)}
        onKeyDown={(event) => {
          if (event.key !== ' ' && event.key !== 'Enter') return;
          event.preventDefault();
          dispatch(
            workspaceActions.pageClicked({
              pageId: page.id,
              mode: event.ctrlKey || event.metaKey || event.key === ' ' ? 'toggle' : 'single',
            }),
          );
        }}
        onClick={(event) =>
          dispatch(
            workspaceActions.pageClicked({
              pageId: page.id,
              mode: event.shiftKey ? 'range' : event.metaKey || event.ctrlKey ? 'toggle' : 'single',
            }),
          )
        }
        className="group mx-auto flex w-fit cursor-pointer flex-col items-center gap-1 outline-none"
      >
        <div
          className={cn(
            'relative rounded-sm shadow-sm ring-offset-2 transition',
            selected
              ? 'ring-brand-500 ring-3'
              : active
                ? 'ring-brand-200 ring-2'
                : 'group-hover:ring-brand-100 group-hover:ring-2',
            'group-focus-visible:ring-brand-600 group-focus-visible:ring-3',
          )}
        >
          <PageCanvas
            file={file}
            pageIndex={page.sourcePageIndex}
            rotation={page.rotation}
            width={THUMB_WIDTH}
            renderDelayMs={150}
          />
          {comments > 0 && (
            <span className="bg-brand-600 absolute -top-1.5 -right-1.5 rounded-full px-1.5 text-[10px] font-medium text-white">
              {comments}
            </span>
          )}
        </div>
        <span className={cn('text-[11px]', active ? 'text-brand-700 font-medium' : 'text-muted')}>
          {index + 1}
        </span>
      </div>
    </div>
  );
});
