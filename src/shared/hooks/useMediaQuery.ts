import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query. Used where layout differences go beyond styling — e.g. rendering
 * card rows instead of table rows, or mounting a panel in a drawer instead of a column (mounting it
 * twice would duplicate ids and state).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Breakpoints mirror Tailwind's defaults so JS and CSS layout switches stay in sync. */
export const MEDIA = {
  /** Phones: < 768 px (below Tailwind `md`). */
  phone: '(max-width: 767px)',
  /** Phones and tablets in portrait: < 1024 px (below Tailwind `lg`). */
  compact: '(max-width: 1023px)',
  /** Wide desktop: ≥ 1280 px (Tailwind `xl`). */
  wide: '(min-width: 1280px)',
} as const;
