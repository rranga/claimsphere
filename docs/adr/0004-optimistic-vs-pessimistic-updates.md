# ADR-0004: Optimistic vs pessimistic updates, and the document commit model

**Status:** Accepted

## Decision matrix

| Operation                              | Strategy                                 | Reasoning                                                    |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Assign claim                           | **Optimistic** + rollback                | Frequent during triage, cheap, reversible                    |
| Comment / annotation                   | **Optimistic** + rollback                | Additive, low risk, users expect instant feedback            |
| Edit claim (status/amount)             | **Pessimistic**                          | Server-side validation decides; the form shows saving state  |
| Delete claim                           | **Pessimistic** + confirmation           | Destructive; row positions shift, so refetch                 |
| Split / merge / delete / reorder pages | **Local draft → pessimistic atomic job** | Expensive server work on large files; must be all-or-nothing |

## Document commit model

- **Draft locally.** Each edit is a command validated by the same pure engine the server runs, so it previews instantly and can be undone. Nothing is sent until the user saves.
- **Save is one job.** The body is `{ idempotencyKey, baseVersions, operations }`, and the server answers `202 { jobId }`.
  - **Optimistic concurrency.** If any document changed since it was loaded, the server returns 409 and the UI offers _keep draft_ or _load latest_.
  - **Idempotency.** A double-click or network retry returns the same job.
  - **Atomicity.** The worker applies operations to a copy and swaps state in the final step. Failure or cancellation at any point leaves the documents exactly as they were, so there are **no partial failures to reconcile**. The draft stays intact, so Retry is always safe.
  - **Referential integrity.** Comments and annotations are keyed by stable page ids, so they survive split, merge and reorder. Those attached to deleted pages are pruned in the same commit.
- **Recovery.** The command log is persisted per claim with its base versions, and restored after a refresh only if those versions still match.

## Consequences

- The user always sees a truthful state: drafts are clearly marked "unsaved", and a save shows real progress.
- Polling (400 ms) is used for job status. Production would push via SSE or WebSocket.
