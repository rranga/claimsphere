/** Page list with ellipses: 1 … 4 5 [6] 7 8 … 40 — as in the Figma footer. */
export function pageWindow(current: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((page, i) =>
    i > 0 && page - sorted[i - 1]! > 1 ? (['gap', page] as const) : [page],
  );
}
