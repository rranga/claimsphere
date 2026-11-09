/**
 * The workspace route (pdf.js + editor — the heaviest code) is code-split and downloaded only
 * when needed, or earlier on row-hover intent via `preloadWorkspace()`. The module promise is
 * cached by the bundler, so preloading and navigating share one request.
 */
export const loadWorkspacePage = () => import('./WorkspacePage');
export const preloadWorkspace = () => void loadWorkspacePage();
