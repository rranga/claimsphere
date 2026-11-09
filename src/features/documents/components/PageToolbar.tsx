import {
  ArrowDown,
  ArrowUp,
  Highlighter,
  MousePointer2,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ClaimDocument, DocumentCapabilities } from '@/shared/api/contracts';
import { cn } from '@/shared/lib/cn';
import { createId } from '@/shared/lib/id';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useApplyOperation, useWorkspaceDispatch, useWorkspaceSelector } from '../model/hooks';
import {
  selectActivePageId,
  selectSelectedPageIds,
  selectTool,
  selectZoom,
  workspaceActions,
  ZOOM_LEVELS,
  type WorkspaceTool,
} from '../model/workspaceSlice';
import { DocumentNameDialog } from './DocumentDialogs';

function ToolButton({
  label,
  shortcut,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-disabled={disabled}
        onClick={disabled ? undefined : onClick}
        className={cn(
          'text-ink inline-flex size-8 items-center justify-center rounded-md transition-colors',
          pressed ? 'bg-brand-600 text-white' : 'hover:bg-brand-50',
          disabled && 'cursor-not-allowed opacity-35 hover:bg-transparent',
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

const Divider = () => <span className="bg-line mx-1 h-5 w-px" aria-hidden="true" />;

const TOOLS: { tool: WorkspaceTool; label: string; icon: typeof MousePointer2 }[] = [
  { tool: 'select', label: 'Select pages', icon: MousePointer2 },
  { tool: 'highlight', label: 'Highlight', icon: Highlighter },
  { tool: 'rectangle', label: 'Box annotation', icon: RectangleHorizontal },
];

export function PageToolbar({
  document,
  capabilities,
}: {
  document: ClaimDocument;
  capabilities: DocumentCapabilities;
}) {
  const dispatch = useWorkspaceDispatch();
  const applyOperation = useApplyOperation();
  const zoom = useWorkspaceSelector(selectZoom);
  const tool = useWorkspaceSelector(selectTool);
  const selectedIds = useWorkspaceSelector(selectSelectedPageIds);
  const activePageId = useWorkspaceSelector(selectActivePageId);
  const [splitting, setSplitting] = useState(false);

  // Operations target the selection, or the active page when nothing is selected.
  const targetIds = selectedIds.length ? selectedIds : activePageId ? [activePageId] : [];
  const single = targetIds.length === 1 ? targetIds[0]! : null;
  const singleIndex = single ? document.pages.findIndex((p) => p.id === single) : -1;
  const zoomIndex = ZOOM_LEVELS.findIndex((z) => z >= zoom);

  return (
    <div
      role="toolbar"
      aria-label="Page tools"
      className="border-line flex flex-wrap items-center gap-0.5 border-b bg-white px-3 py-1.5"
    >
      {TOOLS.map(({ tool: value, label, icon: Icon }) => (
        <ToolButton
          key={value}
          label={label}
          pressed={tool === value}
          disabled={value !== 'select' && !capabilities.annotate}
          onClick={() => dispatch(workspaceActions.toolChanged(value))}
        >
          <Icon className="size-4" />
        </ToolButton>
      ))}

      {capabilities.edit && (
        <>
          <Divider />
          <ToolButton
            label="Rotate left"
            disabled={!targetIds.length}
            onClick={() =>
              applyOperation({ type: 'rotatePages', documentId: document.id, pageIds: targetIds, delta: -90 })
            }
          >
            <RotateCcw className="size-4" />
          </ToolButton>
          <ToolButton
            label="Rotate right"
            disabled={!targetIds.length}
            onClick={() =>
              applyOperation({ type: 'rotatePages', documentId: document.id, pageIds: targetIds, delta: 90 })
            }
          >
            <RotateCw className="size-4" />
          </ToolButton>
          <ToolButton
            label="Move page up"
            shortcut="Alt+↑ in thumbnails"
            disabled={!single || singleIndex <= 0}
            onClick={() =>
              applyOperation({
                type: 'movePage',
                documentId: document.id,
                pageId: single!,
                toIndex: singleIndex - 1,
              })
            }
          >
            <ArrowUp className="size-4" />
          </ToolButton>
          <ToolButton
            label="Move page down"
            shortcut="Alt+↓ in thumbnails"
            disabled={!single || singleIndex >= document.pages.length - 1}
            onClick={() =>
              applyOperation({
                type: 'movePage',
                documentId: document.id,
                pageId: single!,
                toIndex: singleIndex + 1,
              })
            }
          >
            <ArrowDown className="size-4" />
          </ToolButton>
          <ToolButton
            label="Split document before this page"
            disabled={!single || singleIndex <= 0}
            onClick={() => setSplitting(true)}
          >
            <Scissors className="size-4" />
          </ToolButton>
          <ToolButton
            label={`Delete ${targetIds.length > 1 ? `${targetIds.length} pages` : 'page'}`}
            disabled={!targetIds.length || targetIds.length >= document.pages.length}
            onClick={() =>
              applyOperation({ type: 'deletePages', documentId: document.id, pageIds: targetIds })
            }
          >
            <Trash2 className="text-danger-500 size-4" />
          </ToolButton>
        </>
      )}

      <span className="text-muted ml-3 text-xs" aria-live="polite">
        {selectedIds.length > 1 ? `${selectedIds.length} pages selected` : ''}
      </span>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolButton
          label="Zoom out"
          disabled={zoomIndex <= 0}
          onClick={() => dispatch(workspaceActions.zoomChanged(ZOOM_LEVELS[zoomIndex - 1]!))}
        >
          <ZoomOut className="size-4" />
        </ToolButton>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <ToolButton
          label="Zoom in"
          disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
          onClick={() => dispatch(workspaceActions.zoomChanged(ZOOM_LEVELS[zoomIndex + 1]!))}
        >
          <ZoomIn className="size-4" />
        </ToolButton>
      </div>

      {splitting && single && (
        <DocumentNameDialog
          title={`Split “${document.name}”`}
          description={`Pages ${singleIndex + 1}–${document.pages.length} move into a new document.`}
          initialName={`${document.name.replace(/\.pdf$/i, '')} (part 2).pdf`}
          submitLabel="Split"
          onSubmit={(newName) =>
            applyOperation({
              type: 'splitDocument',
              documentId: document.id,
              atPageId: single,
              newDocumentId: createId('doc-'),
              newName,
            })
          }
          onClose={() => setSplitting(false)}
        />
      )}
    </div>
  );
}
