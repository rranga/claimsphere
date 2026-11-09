# ADR-0001: Virtualized grid over a server-side row model

**Status:** Accepted

## Context

The landing grid must show 20,000+ claims (and keep growing) with sorting, filtering and row actions. Data is scoped by RBAC, so the server already has to filter.

## Options

|                                | Pagination                | Infinite scroll     | Virtualization + block loading          |
| ------------------------------ | ------------------------- | ------------------- | --------------------------------------- |
| DOM size                       | page size                 | grows without bound | constant (~visible rows)                |
| Memory                         | one page                  | grows without bound | bounded (block GC)                      |
| Jump to row 15,000             | yes (by page number)      | no                  | yes (scrollbar)                         |
| Scrollbar meaning              | per page                  | misleading          | true position                           |
| Triage flow ("scan the queue") | interrupted by page turns | good                | good                                    |
| Complexity                     | low                       | medium              | highest                                 |
| a11y                           | simplest                  | hard (focus, "end") | needs `aria-rowcount` / `aria-rowindex` |

Client-side sorting of 20k rows is fast enough today, but it fails both requirements: growth, and RBAC (the client must never receive rows it can't see).

## Decision

- Make **virtualization with 100-row blocks fetched on demand** the default. Sort, filter and search happen on the server.
- Keep **classic server pagination** as a toggle that matches the Figma footer. It reuses the same API and row components.

## Consequences

- Constant DOM (~35 rows) and bounded memory (TanStack Query GCs blocks after 60 s).
- Rows that aren't loaded yet render skeletons while their block arrives. Total count comes from any cached block, so the scrollbar never collapses.
- Fixed row height is required (56 px). Variable-height rows would need measurement.
- The server caches the sorted id list per (user, query) so block requests stay O(limit).
