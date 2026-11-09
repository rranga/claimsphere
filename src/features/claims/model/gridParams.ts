import {
  CLAIM_CHANNELS,
  CLAIM_PRIORITIES,
  CLAIM_STATUSES,
  SORTABLE_FIELDS,
  type ClaimChannel,
  type ClaimPriority,
  type ClaimQuery,
  type ClaimStatus,
  type SortDirection,
  type SortField,
} from '@/shared/api/contracts';

/**
 * Grid view state lives in the URL (not Redux): it is shareable, survives refresh, and the
 * browser Back button from the document workspace restores the exact same view for free.
 */
export type GridView = 'virtual' | 'paged';

export interface GridParams {
  q: string;
  status: ClaimStatus[];
  priority: ClaimPriority[];
  channel: ClaimChannel[];
  sortBy: SortField;
  sortDir: SortDirection;
  view: GridView;
  page: number;
  pageSize: number;
}

export const PAGE_SIZES = [25, 50, 100] as const;

export const DEFAULT_GRID_PARAMS: GridParams = {
  q: '',
  status: [],
  priority: [],
  channel: [],
  sortBy: 'receivedAt',
  sortDir: 'desc',
  view: 'virtual',
  page: 1,
  pageSize: 50,
};

function list<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  return raw.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v));
}

/** Parse untrusted URL input defensively — unknown values fall back to defaults. */
export function parseGridParams(search: URLSearchParams): GridParams {
  const sortBy = search.get('sort');
  const pageSize = Number(search.get('size'));
  const page = Number(search.get('page'));
  return {
    q: search.get('q') ?? '',
    status: list(search.get('status'), CLAIM_STATUSES),
    priority: list(search.get('priority'), CLAIM_PRIORITIES),
    channel: list(search.get('channel'), CLAIM_CHANNELS),
    sortBy: (SORTABLE_FIELDS as readonly string[]).includes(sortBy ?? '')
      ? (sortBy as SortField)
      : DEFAULT_GRID_PARAMS.sortBy,
    sortDir:
      search.get('dir') === 'asc'
        ? 'asc'
        : search.get('dir') === 'desc'
          ? 'desc'
          : DEFAULT_GRID_PARAMS.sortDir,
    view: search.get('view') === 'paged' ? 'paged' : 'virtual',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_GRID_PARAMS.pageSize,
  };
}

/** Serialize only non-default values to keep URLs short and readable. */
export function serializeGridParams(params: GridParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status.length) search.set('status', params.status.join(','));
  if (params.priority.length) search.set('priority', params.priority.join(','));
  if (params.channel.length) search.set('channel', params.channel.join(','));
  if (params.sortBy !== DEFAULT_GRID_PARAMS.sortBy) search.set('sort', params.sortBy);
  if (params.sortDir !== DEFAULT_GRID_PARAMS.sortDir) search.set('dir', params.sortDir);
  if (params.view !== DEFAULT_GRID_PARAMS.view) search.set('view', params.view);
  if (params.view === 'paged' && params.page > 1) search.set('page', String(params.page));
  if (params.pageSize !== DEFAULT_GRID_PARAMS.pageSize) search.set('size', String(params.pageSize));
  return search;
}

/** The subset of grid state the *server* cares about (view mode/page are client concerns). */
export const toClaimQuery = (params: GridParams): ClaimQuery => ({
  q: params.q || undefined,
  status: params.status,
  priority: params.priority,
  channel: params.channel,
  sortBy: params.sortBy,
  sortDir: params.sortDir,
});
