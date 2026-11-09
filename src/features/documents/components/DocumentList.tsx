import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight, FileText, Merge, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ClaimDocument, SourceFile } from '@/shared/api/contracts';
import { cn } from '@/shared/lib/cn';
import { formatBytes } from '@/shared/lib/format';
import { useApplyOperation, useWorkspaceDispatch, useWorkspaceSelector } from '../model/hooks';
import { selectWorkingDocuments, workspaceActions } from '../model/workspaceSlice';
import { DocumentNameDialog } from './DocumentDialogs';

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-brand-50 data-[disabled]:opacity-40';

interface Props {
  activeDocumentId: string | null;
  files: Record<string, SourceFile>;
  canEdit: boolean;
}

/** Bytes a document references (unique source files) — used to show "1.0 GB" next to the name. */
const documentBytes = (doc: ClaimDocument, files: Record<string, SourceFile>) =>
  [...new Set(doc.pages.map((p) => p.fileId))].reduce((sum, id) => sum + (files[id]?.sizeBytes ?? 0), 0);

export function DocumentList({ activeDocumentId, files, canEdit }: Props) {
  const documents = useWorkspaceSelector(selectWorkingDocuments);
  const dispatch = useWorkspaceDispatch();
  const applyOperation = useApplyOperation();
  const [renaming, setRenaming] = useState<ClaimDocument | null>(null);

  return (
    <nav
      aria-label="Claim documents"
      className="border-line max-h-[45%] shrink-0 overflow-y-auto border-b p-3"
    >
      <h2 className="text-muted px-1 pb-2 text-xs font-semibold tracking-wide uppercase">
        Documents ({documents.length})
      </h2>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
        {documents.map((doc) => {
          const active = doc.id === activeDocumentId;
          return (
            <li key={doc.id} className="group relative min-w-0">
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => dispatch(workspaceActions.documentSelected(doc.id))}
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg px-2 py-2 pr-8 text-left',
                  active ? 'bg-brand-600 text-white' : 'hover:bg-brand-50',
                )}
              >
                <FileText
                  className={cn('mt-0.5 size-4 shrink-0', active ? 'text-white' : 'text-brand-600')}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{doc.name}</span>
                  <span className={cn('text-[11px]', active ? 'text-white/80' : 'text-muted')}>
                    {doc.pages.length} pages · {formatBytes(documentBytes(doc, files))}
                  </span>
                </span>
              </button>

              {canEdit && (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger
                    aria-label={`Actions for ${doc.name}`}
                    className={cn(
                      'absolute top-2 right-1 rounded p-1',
                      active ? 'text-white hover:bg-white/20' : 'text-muted hover:bg-white',
                    )}
                  >
                    <MoreVertical className="size-4" />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      className="border-line z-30 min-w-52 rounded-xl border bg-white p-1.5 shadow-xl"
                    >
                      <DropdownMenu.Item className={menuItem} onSelect={() => setRenaming(doc)}>
                        <Pencil className="size-4" /> Rename
                      </DropdownMenu.Item>
                      <DropdownMenu.Sub>
                        <DropdownMenu.SubTrigger className={menuItem} disabled={documents.length < 2}>
                          <Merge className="size-4" /> Merge into… <ChevronRight className="ml-auto size-4" />
                        </DropdownMenu.SubTrigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.SubContent className="border-line z-40 min-w-52 rounded-xl border bg-white p-1.5 shadow-xl">
                            {documents
                              .filter((target) => target.id !== doc.id)
                              .map((target) => (
                                <DropdownMenu.Item
                                  key={target.id}
                                  className={menuItem}
                                  onSelect={() =>
                                    applyOperation({
                                      type: 'mergeDocuments',
                                      targetDocumentId: target.id,
                                      sourceDocumentId: doc.id,
                                    })
                                  }
                                >
                                  {target.name}
                                </DropdownMenu.Item>
                              ))}
                          </DropdownMenu.SubContent>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Sub>
                      <DropdownMenu.Separator className="bg-line my-1 h-px" />
                      <DropdownMenu.Item
                        className={cn(menuItem, 'text-danger-500')}
                        disabled={documents.length < 2}
                        onSelect={() => applyOperation({ type: 'deleteDocument', documentId: doc.id })}
                      >
                        <Trash2 className="size-4" /> Delete document
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              )}
            </li>
          );
        })}
      </ul>

      {renaming && (
        <DocumentNameDialog
          title="Rename document"
          description="The new name is applied when you save your changes."
          initialName={renaming.name}
          submitLabel="Rename"
          onSubmit={(name) => applyOperation({ type: 'renameDocument', documentId: renaming.id, name })}
          onClose={() => setRenaming(null)}
        />
      )}
    </nav>
  );
}
