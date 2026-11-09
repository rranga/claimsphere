# ClaimSphere

A claims-adjudication workspace for ABC Insurance, built as the **Senior UI Engineering case study**. It has a landing grid over **25,000 claims** and a document workspace that opens **100 MB – 1 GB** PDFs, where users can edit, split, merge, delete pages, comment and annotate. Role-based access is enforced by the backend and reflected in the UI.

> **Stack:** React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · TanStack Query · Redux Toolkit · TanStack Virtual · pdf.js · Radix UI · MSW · Vitest · Playwright · axe-core
>
> **Technical report:** [docs/ClaimSphere-Technical-Design.docx](docs/ClaimSphere-Technical-Design.docx) ([PDF](docs/ClaimSphere-Technical-Design.pdf)) covers architecture, design patterns, performance, security, accessibility, coding standards and testing.

---

## Quick start

```bash
nvm use                 # Node 24 (see .nvmrc; Node ≥ 22 works)
npm install
npm run dev             # http://localhost:5173
```

Optional: generate genuinely large documents (they are git-ignored, so this takes about 2 s and writes 1.3 GB to disk):

```bash
npm run generate:docs -- --preset large   # 250 MB + 1 GB PDFs
```

Restart `npm run dev` after generating. Every 4th claim (`c-00001`, `c-00005`, …) then gets a large document attached.

| Command                 | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run validate`      | lint + typecheck + unit/integration tests               |
| `npm run test:e2e`      | Playwright end-to-end suite (starts its own dev server) |
| `npm run build`         | typecheck + production build                            |
| `npm run generate:docs` | regenerate the committed sample PDFs                    |

### Demo personas

Pick a persona on the sign-in screen. The mock backend enforces the same rules on every request.

| Persona       | Role             | Data scope  | Can                                                    |
| ------------- | ---------------- | ----------- | ------------------------------------------------------ |
| Evano Morales | Adjuster         | EMEA        | Edit **own** claims, edit documents, comment, annotate |
| Priya Raman   | Supervisor       | EMEA        | Edit + **assign** any open claim in the region         |
| Marcus Lee    | Viewer (auditor) | All regions | Read-only everywhere                                   |
| Sofia Alvarez | Admin            | All regions | Everything, including **delete**                       |

### Things worth trying

1. **Grid:** drag the scrollbar to the middle of 25,000 rows. The footer shows only ~35 rows in the DOM. Switch to **Paginated** to get the Figma-style footer. Use the panel icon next to the logo to switch the sidebar between the Figma **expanded** and **minimized** states. Your choice is remembered; below 1280 px the sidebar starts minimized.
2. **RBAC:** sign in as Marcus (no row actions), then Evano (Edit is visible but disabled, with a reason, on claims assigned to someone else).
3. **Grid → workspace:** hover a row for about 120 ms and the route chunk, document manifest and first page are prefetched, so the click opens instantly. Press **Back** and the filters, sort and page are restored from the URL.
4. **1 GB document:** open it and watch the green badge, e.g. _"Fetched 6.6 MB of 1021 MB (0.7%)"_. Jump to page 900; only that page's byte ranges are downloaded.
5. **Editing:** select a page in the thumbnails, then **Split**, **Rotate**, delete, drag to reorder (or press Alt + ↑/↓). Merge or rename via the document's ⋮ menu. Undo with **Ctrl+Z**, then **Save changes** to watch the job progress. Tick _Simulate failure_ to see the atomic rollback and the safe **Retry**.
6. **Draft recovery:** make a few edits, refresh the page, and the draft is restored.
7. **Annotations and comments:** use the highlight/box tool on a page and comment on it. Both are optimistic, and they survive split, merge and reorder because they are keyed by a stable page id.
8. **Responsive:** narrow the window or use device emulation. Below 1024 px the navigation is icons only and claims become cards with a _Sort by_ control. On phones, the workspace's document list and comments open as slide-in panels.

---

## How each requirement is met

| Requirement                                      | Implementation                                                                                                                                                    | Where                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Grid with 20k+ records, sort/filter, row actions | Server-side sort/filter/search; **virtualized grid with windowed block loading** (default) plus classic pagination (Figma); Edit / Assign / Delete                | `features/claims`                                                                    |
| Pagination vs alternatives, justified            | Virtualization + 100-row blocks keeps the DOM and memory constant and the scrollbar true. See [ADR-0001](docs/adr/0001-virtualized-grid-with-server-row-model.md) |                                                                                      |
| RBAC: backend is the source of truth             | Mock API checks permissions, scopes records by region, computes `allowedActions` per row and `capabilities` per claim; returns 401/403/404                        | `mocks/server/policy.ts`, `mocks/handlers.ts`                                        |
| RBAC: frontend for UX                            | `<Can>`, `usePermission`; **hide** if the role can never do it, **disable with a reason** if this record blocks it; route guard                                   | `features/auth`, `RowActions.tsx`                                                    |
| Row → large document, smooth transition          | Hover-intent prefetch (JS chunk, manifest, first page), instant header from grid row data, skeletons, View Transitions, URL-restored grid on Back                 | `pages/ClaimsPage.tsx`, `pages/WorkspacePage.tsx`                                    |
| View 100 MB – 1 GB documents                     | pdf.js in a Web Worker + **custom HTTP Range transport**; virtualized pages and thumbnails; canvases released off-screen; LRU of open docs                        | `features/documents/viewer`                                                          |
| Edit / split / merge / delete / reorder / rotate | Command log over immutable page references; undo/redo; same pure engine on client (preview) and server (commit)                                                   | `shared/domain/documentOperations.ts`                                                |
| Page-level comments and annotations              | Keyed by stable page id; normalized (0–1) rect coords so zoom/rotation independent; optimistic                                                                    | `features/documents/components/CollaborationPanel.tsx`, `viewer/AnnotationLayer.tsx` |
| Performance                                      | Memoized rows, structural sharing, selector subscriptions, debounced search, scroll-idle page rendering, DPR cap, code splitting                                  | see [Performance](#performance)                                                      |
| UX: progress, cancel, retry, errors              | Async job with progress, cooperative cancel, idempotent retry, per-region error boundaries, toasts, skeletons                                                     | `useCommitDraft.ts`, `DraftBar.tsx`                                                  |
| Reliability                                      | **Atomic** server commit, optimistic concurrency (versions → 409 conflict dialog), idempotency keys, draft persistence, orphan pruning                            | `mocks/server/jobs.ts`                                                               |

---

## Architecture

The full write-up is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), with diagrams and the backend API assumptions.

```
src/
├── app/            # composition: providers, router, store, layout shell
├── pages/          # route screens; compose features (Claims, Workspace, Login)
├── features/
│   ├── auth/       # session (Context), <Can/>, usePermission, RequireAuth
│   ├── claims/     # grid, toolbar, dialogs, URL state, block loader, mutations
│   └── documents/  # workspace: Redux slice, pdf engine, viewer, thumbnails, jobs, comments
├── shared/
│   ├── api/        # typed HTTP client + API contract (single source of types)
│   ├── domain/     # pure document-operation engine (shared with the server)
│   ├── ui/         # design-system primitives (Button, Dialog, Badge, Tooltip…)
│   └── lib, hooks/
└── mocks/          # MSW "backend": data, RBAC policy, query engine, async jobs
```

ESLint enforces the boundaries: `shared/` cannot import features; features cannot import `mocks/` and talk HTTP only.

### State management: each kind of state has one owner

| State                                           | Owner                  | Why                                                                                               |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| Server data (claims, documents, comments, jobs) | **TanStack Query**     | caching, dedupe, cancellation, prefetch, GC, optimistic updates                                   |
| Grid sort/filter/page/view                      | **URL search params**  | shareable, refresh-safe, Back restores the view for free                                          |
| Document editing draft, selection, tool, zoom   | **Redux Toolkit**      | client-owned, cross-component, high-frequency; command log gives undo/redo and the commit payload |
| Session and permissions                         | **React Context**      | read everywhere, changes almost never                                                             |
| Download stats from the pdf engine              | `useSyncExternalStore` | tear-free reads from a non-React source                                                           |
| Ephemeral UI                                    | `useState`             | local                                                                                             |

MobX was not needed. The split above covers every case with less magic and better DevTools.

---

## Performance

| Concern                  | Technique                                                                               | Measured (Chromium, dev build)                                        |
| ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 25k-row grid DOM         | Virtualization (TanStack Virtual), fixed 56 px rows, overscan 12                        | **~22–35 rows** in the DOM at any scroll position                     |
| Grid memory              | 100-row blocks as Query entries, `gcTime` 60 s                                          | bounded; no "infinite scroll" growth                                  |
| Row re-renders           | `memo` rows, stable callbacks, structural sharing, single dialog host                   | unchanged rows don't re-render                                        |
| Search                   | 300 ms debounce, server-side                                                            | one request per pause                                                 |
| 1 GB PDF first page      | Custom Range transport, 256 KB chunks, `disableAutoFetch`                               | **< 2 s**, **6.6 MB** fetched                                         |
| Jump to page 900 of 1500 | Only that page's ranges                                                                 | **+9.8 MB** (16.4 MB total, 1.6%)                                     |
| Page rendering           | 60 ms scroll-idle debounce, render cancellation, `canvas.width = 0` on unmount, DPR ≤ 2 | off-screen pages hold no bitmaps                                      |
| Bundles                  | Lazy workspace route + lazy dialogs; pdf.js split                                       | initial app JS **~74 KB gz** (+ React vendor); pdf.js loads on demand |

The sample PDFs are written in a **web-optimized layout**: page dictionaries at the head, images after, as `qpdf --linearize`-style tools produce. With an interleaved layout, pdf.js has to touch a chunk next to every preceding page to locate page _N_. Measured: 152 MB vs 9.8 MB to jump to 60% of a 250 MB file. **In production, the ingestion pipeline should linearize documents** (see [ADR-0002](docs/adr/0002-large-documents-range-loading.md)).

---

## Testing

- **Unit:** document-operation engine, Redux slice (undo/redo, selection, draft restore), annotation geometry, URL parsing, LRU.
- **API contract:** RBAC (401/403/404 scoping, `allowedActions`), optimistic concurrency (409), atomic and idempotent jobs, validation (422). These run against the same MSW handlers the app uses.
- **Component:** RowActions hide/disable rules with React Testing Library.
- **E2E (Playwright):** virtualization, filtering, RBAC per persona, pagination, split → save job, failure → retry, annotations and comments, read-only workspace.
- **Accessibility (Playwright + axe-core):** WCAG 2.1 A/AA audit of the sign-in screen, grid and workspace. The suite fails on any violation; currently 0.

CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, unit tests, build and e2e. Pre-commit runs ESLint and Prettier on staged files (Husky + lint-staged).

## Accessibility (WCAG 2.1 AA)

- **Verified:** automated axe-core audit in the e2e suite (0 violations), plus eslint-plugin-jsx-a11y.
- **Colour contrast:** Figma's light greys and greens were darkened within the same hue so every text token is at least 4.5:1.
- **Keyboard:** the grid supports arrows, PageUp/PageDown, Home/End and Enter. Thumbnails support arrows, Shift-select, Space and Alt+arrows to move pages. Ctrl+Z / Ctrl+Shift+Z undo and redo. Dialogs and menus are fully keyboard operable.
- **Semantics:** `grid` with `aria-rowcount`/`aria-rowindex` for the virtualized rows, `listbox` for thumbnails, `aria-sort`, live regions for counts, progress and errors, a skip link, visible focus rings, and `prefers-reduced-motion`.
- **Known gaps:**
  - Document text is canvas-only. Next step: the pdf.js text layer.
  - Annotations can only be drawn with a pointer.
  - No manual screen-reader pass has been done yet.

## Live demo (GitHub Pages)

`.github/workflows/deploy.yml` builds with the correct base path, generates a 250 MB document at deploy time (never committed), and publishes to GitHub Pages. To enable it: **Settings → Pages → Source: GitHub Actions**.

## Known limitations and next steps

- The backend is **MSW in the browser**. It is a faithful HTTP contract (status codes, versions, jobs), but the data resets on reload. Next step: a Node or .NET BFF with the same contract (an OpenAPI spec would generate `contracts.ts`).
- The job **simulates** byte-level PDF rewriting. Production would run a queue worker (e.g. qpdf/PDFium), write a new immutable file version, and notify via SSE/WebSocket instead of polling.
- Demo auth uses a sessionStorage token. Production would use OIDC (e.g. Azure AD) with httpOnly cookies, plus CSP headers.
- Comments refresh on focus or after a commit. Real-time collaboration (presence, live annotations) would use WebSockets.
- Touch works (including drawing annotations), but there is no pinch-to-zoom gesture in the viewer and no offline mode for field adjusters.
- Not implemented: i18n, server-rendered thumbnails/tiles (an option for very weak devices, see ADR-0002), and Storybook for the UI primitives.
