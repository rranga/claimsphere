import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AlertTriangle, CheckCircle2, History, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { describeOperation } from '@/shared/domain/documentOperations';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import type { useCommitDraft } from '../hooks/useCommitDraft';
import { useWorkspaceDispatch, useWorkspaceSelector } from '../model/hooks';
import {
  selectCanRedo,
  selectCanUndo,
  selectPendingOperations,
  workspaceActions,
} from '../model/workspaceSlice';

type Commit = ReturnType<typeof useCommitDraft>;

/**
 * Draft + long-running-save UX:
 *  idle     → "N unsaved changes" · undo/redo · history · discard · save
 *  running  → live progress + step label + Cancel (cooperative, nothing is applied)
 *  failed   → reason + Retry (safe: the draft is untouched) / Dismiss
 *  conflict → dialog: keep editing or reload the latest version
 */
export function DraftBar({ commit, canEdit }: { commit: Commit; canEdit: boolean }) {
  const dispatch = useWorkspaceDispatch();
  const operations = useWorkspaceSelector(selectPendingOperations);
  const canUndo = useWorkspaceSelector(selectCanUndo);
  const canRedo = useWorkspaceSelector(selectCanRedo);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const { job } = commit;

  // Keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z / Ctrl+Y.
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"]') || commit.isRunning) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch(event.shiftKey ? workspaceActions.redo() : workspaceActions.undo());
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        dispatch(workspaceActions.redo());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, commit.isRunning, dispatch]);

  const conflictDialog = commit.conflict && (
    <Dialog
      open
      onOpenChange={(open) => !open && commit.dismissConflict()}
      title="Someone else changed these documents"
      description={commit.conflict}
      size="sm"
      footer={
        <>
          <Button onClick={commit.dismissConflict}>Keep my draft</Button>
          <Button variant="primary" onClick={() => void commit.reloadLatest()}>
            Load latest version
          </Button>
        </>
      }
    >
      <p className="text-muted text-sm">
        Your {operations.length} unsaved change{operations.length === 1 ? '' : 's'} were made against an older
        version. Loading the latest version discards them.
      </p>
    </Dialog>
  );

  if (job && (job.status === 'queued' || job.status === 'running')) {
    return (
      <div
        className="border-brand-100 bg-brand-50 flex items-center gap-4 border-b px-4 py-2.5"
        role="status"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-brand-700 truncate font-medium">Saving · {job.step}</span>
            <span className="tabular-nums">{job.progress}%</span>
          </div>
          <ProgressBar value={job.progress} label="Saving document changes" />
        </div>
        <Button size="sm" onClick={commit.cancel} loading={commit.isCancelling}>
          Cancel
        </Button>
      </div>
    );
  }

  if (job?.status === 'failed') {
    return (
      <div
        role="alert"
        className="border-danger-500/30 bg-danger-50 flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm"
      >
        <AlertTriangle className="text-danger-500 size-4" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <strong className="font-medium">Save failed — no changes were applied.</strong> {job.error}
        </span>
        <Button size="sm" onClick={commit.dismiss}>
          Dismiss
        </Button>
        <Button size="sm" variant="primary" onClick={() => commit.start(false)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!canEdit) return conflictDialog || null;
  if (operations.length === 0 && !canUndo && !canRedo) {
    return (
      <>
        {conflictDialog}
        <div className="border-line text-muted flex items-center gap-2 border-b bg-white px-4 py-2 text-xs">
          <CheckCircle2 className="text-success-500 size-4" aria-hidden="true" /> All changes saved
        </div>
      </>
    );
  }

  return (
    <div className="border-warning-600/20 bg-warning-50 flex flex-wrap items-center gap-2 border-b px-4 py-2">
      {conflictDialog}
      <span className="text-warning-600 text-sm font-medium">
        {operations.length} unsaved change{operations.length === 1 ? '' : 's'}
      </span>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Undo (Ctrl+Z)"
        aria-disabled={!canUndo}
        onClick={() => dispatch(workspaceActions.undo())}
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Redo (Ctrl+Shift+Z)"
        aria-disabled={!canRedo}
        onClick={() => dispatch(workspaceActions.redo())}
      >
        <Redo2 className="size-4" />
      </Button>
      {operations.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="text-ink inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs hover:bg-white">
            <History className="size-4" aria-hidden="true" /> Changes
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              className="border-line z-30 max-h-72 min-w-64 overflow-auto rounded-xl border bg-white p-2 shadow-xl"
            >
              <DropdownMenu.Label className="text-muted px-2 pb-1 text-xs font-medium">
                Pending operations
              </DropdownMenu.Label>
              <ol className="list-inside list-decimal px-2 text-sm">
                {operations.map((op, i) => (
                  <li key={i} className="py-0.5">
                    {describeOperation(op)}
                  </li>
                ))}
              </ol>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
      <div className="ml-auto flex items-center gap-2">
        <label
          className="text-muted flex items-center gap-1.5 text-xs"
          title="Demo: make the server fail mid-job to exercise retry"
        >
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(e) => setSimulateFailure(e.target.checked)}
          />
          Simulate failure
        </label>
        <Button
          size="sm"
          variant="ghost"
          aria-disabled={!operations.length}
          onClick={() => dispatch(workspaceActions.draftDiscarded())}
        >
          Discard
        </Button>
        <Button
          size="sm"
          variant="primary"
          aria-disabled={!operations.length}
          loading={commit.isSubmitting}
          onClick={() => commit.start(simulateFailure)}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
