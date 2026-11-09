# ADR-0003: State management, one owner per kind of state

**Status:** Accepted

## Context

The job description mentions Redux, Context API and MobX. The app has three very different kinds of state: server data (claims, documents, comments, jobs), shareable view state (grid filters), and a complex client-owned editing session (document draft, selection, tools).

## Decision

| State                                 | Tool                                           |
| ------------------------------------- | ---------------------------------------------- |
| Server cache                          | **TanStack Query**                             |
| Grid view state                       | **URL search params**                          |
| Document workspace                    | **Redux Toolkit** (slice + memoized selectors) |
| Session/permissions                   | **React Context**                              |
| Non-React stores (pdf download stats) | `useSyncExternalStore`                         |

### Why not Redux for everything?

Server data in Redux means re-implementing caching, deduping, cancellation, retries, GC and invalidation. RTK Query could do it, but TanStack Query's per-block cache entries with `gcTime` map directly onto the virtualized grid.

### Why Redux for the workspace?

The draft is a **serializable command log**. That gives undo/redo for free, makes it persistable for crash recovery, and makes it the exact commit payload. Many distant components (toolbar, thumbnails, viewer, draft bar) read narrow slices at high frequency, and selector subscriptions avoid the re-render cascade a Context would cause.

### Why not MobX?

It would work, but the observable/proxy model adds implicit re-render behaviour and a second mental model, with no requirement that the options above don't already cover.

## Consequences

- Each piece of state has exactly one owner, so there is no syncing between stores.
- The documents feature types its hooks against its own slice (`{ workspace }`), not the app's `RootState`, which keeps the feature portable.
