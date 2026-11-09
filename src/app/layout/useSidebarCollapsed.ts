import { useCallback, useState } from 'react';

const STORAGE_KEY = 'claimsphere.sidebar';
/** Below this width the sidebar starts minimized (Figma "Minimized" frame) to give content room. */
const AUTO_COLLAPSE_BELOW_PX = 1280;

function readInitial(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'collapsed') return true;
    if (stored === 'expanded') return false;
  } catch {
    // storage unavailable (private mode) — fall back to the responsive default
  }
  return window.matchMedia(`(max-width: ${AUTO_COLLAPSE_BELOW_PX - 1}px)`).matches;
}

/**
 * Sidebar expanded/minimized state. An explicit user choice is remembered per browser;
 * until then the default follows the viewport width.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readInitial);

  const toggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      // preference simply isn't persisted
    }
  }, [collapsed]);

  return [collapsed, toggle] as const;
}
