/** Arrow/Home/End/PageUp/PageDown navigation for role="grid" (WAI-ARIA grid pattern, row-level focus). */
export function getNextRowIndex(
  key: string,
  current: number,
  rowCount: number,
  pageRows: number,
): number | null {
  const last = rowCount - 1;
  switch (key) {
    case 'ArrowDown':
      return Math.min(last, current + 1);
    case 'ArrowUp':
      return Math.max(0, current - 1);
    case 'PageDown':
      return Math.min(last, current + pageRows);
    case 'PageUp':
      return Math.max(0, current - pageRows);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}
