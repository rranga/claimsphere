import { Highlighter, MessageSquare, RectangleHorizontal, Send, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Annotation, DocumentCapabilities, PageComment, Session } from '@/shared/api/contracts';
import { formatDateTime } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { useAddComment, useDeleteAnnotation, useDeleteComment } from '../hooks/useCollaboration';

interface Props {
  claimId: string;
  session: Session;
  pageId: string | null;
  pageNumber: number;
  comments: PageComment[];
  annotations: Annotation[];
  capabilities: DocumentCapabilities;
  isLoading: boolean;
}

/** Page-level comments and the annotation list for the page currently in view. */
export function CollaborationPanel({
  claimId,
  session,
  pageId,
  pageNumber,
  comments,
  annotations,
  capabilities,
  isLoading,
}: Props) {
  const addComment = useAddComment(claimId, session);
  const deleteComment = useDeleteComment(claimId);
  const deleteAnnotation = useDeleteAnnotation(claimId);
  const [draft, setDraft] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !pageId) return;
    addComment.mutate({ pageId, body });
    setDraft('');
  };

  return (
    <aside aria-label="Comments and annotations" className="flex h-full flex-col">
      <header className="border-line border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="text-brand-600 size-4" aria-hidden="true" /> Page {pageNumber || '–'}
        </h2>
        <p className="text-muted text-xs">
          Comments and annotations stay attached to this page through split, merge and reorder.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section aria-label="Comments">
          {isLoading ? (
            <p className="text-muted text-xs">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-muted text-xs">No comments on this page yet.</p>
          ) : (
            <ul className="grid gap-3">
              {comments.map((comment) => (
                <li key={comment.id} className={comment.id.startsWith('temp-') ? 'opacity-60' : undefined}>
                  <div className="flex items-start gap-2">
                    <Avatar name={comment.authorName} className="size-7 text-[10px]" />
                    <div className="bg-canvas min-w-0 flex-1 rounded-xl rounded-tl-sm px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium">{comment.authorName}</span>
                        <time className="text-muted text-[10px]" dateTime={comment.createdAt}>
                          {comment.id.startsWith('temp-') ? 'Sending…' : formatDateTime(comment.createdAt)}
                        </time>
                      </div>
                      <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{comment.body}</p>
                    </div>
                    {comment.authorId === session.user.id && !comment.id.startsWith('temp-') && (
                      <button
                        type="button"
                        aria-label="Delete comment"
                        className="text-muted hover:bg-danger-50 hover:text-danger-500 rounded p-1"
                        onClick={() => deleteComment.mutate(comment.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Annotations" className="mt-6">
          <h3 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
            Annotations ({annotations.length})
          </h3>
          {annotations.length === 0 ? (
            <p className="text-muted text-xs">
              {capabilities.annotate
                ? 'Pick the highlight or box tool and drag on the page.'
                : 'No annotations on this page.'}
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {annotations.map((annotation) => (
                <li
                  key={annotation.id}
                  className="border-line flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                >
                  {annotation.kind === 'highlight' ? (
                    <Highlighter className="size-3.5 text-yellow-600" aria-hidden="true" />
                  ) : (
                    <RectangleHorizontal className="text-danger-500 size-3.5" aria-hidden="true" />
                  )}
                  <span className="flex-1 truncate">
                    {annotation.kind === 'highlight' ? 'Highlight' : 'Box'} by {annotation.authorName}
                  </span>
                  {capabilities.annotate && !annotation.id.startsWith('temp-') && (
                    <button
                      type="button"
                      aria-label="Delete annotation"
                      className="text-muted hover:bg-danger-50 hover:text-danger-500 rounded p-1"
                      onClick={() => deleteAnnotation.mutate(annotation.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {capabilities.comment ? (
        <form onSubmit={submit} className="border-line border-t p-3">
          <label htmlFor="page-comment" className="sr-only">
            Add a comment to page {pageNumber}
          </label>
          <textarea
            id="page-comment"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
            }}
            rows={3}
            maxLength={2000}
            placeholder={`Comment on page ${pageNumber}… (Ctrl+Enter to send)`}
            className="border-line placeholder:text-subtle focus:border-brand-500 w-full resize-none rounded-lg border p-2 text-sm focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" variant="primary" aria-disabled={!draft.trim() || !pageId}>
              <Send className="size-3.5" aria-hidden="true" /> Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-line text-muted border-t p-3 text-xs">
          Your role has read-only access to comments.
        </p>
      )}
    </aside>
  );
}
