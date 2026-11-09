import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { parseGridParams, serializeGridParams, type GridParams } from '../model/gridParams';

/** Grid state ⇄ URL. Any change other than paging resets to page 1. */
export function useGridParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseGridParams(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<GridParams>, options: { replace?: boolean } = {}) => {
      setSearchParams(
        (current) => {
          const previous = parseGridParams(current);
          const resetsPage = Object.keys(patch).some((key) => key !== 'page');
          return serializeGridParams({
            ...previous,
            ...patch,
            ...(resetsPage && !('page' in patch) && { page: 1 }),
          });
        },
        { replace: options.replace ?? false },
      );
    },
    [setSearchParams],
  );

  return [params, update] as const;
}
