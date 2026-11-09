import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_PARAMS, parseGridParams, serializeGridParams } from './gridParams';
import { pageWindow } from './pagination';

describe('grid URL state', () => {
  it('round-trips through the URL', () => {
    const params = {
      ...DEFAULT_GRID_PARAMS,
      q: 'cooper',
      status: ['New' as const, 'Closed' as const],
      sortBy: 'amount' as const,
      sortDir: 'asc' as const,
      view: 'paged' as const,
      page: 4,
      pageSize: 100,
    };
    expect(parseGridParams(serializeGridParams(params))).toEqual(params);
  });

  it('keeps default values out of the URL', () => {
    expect(serializeGridParams(DEFAULT_GRID_PARAMS).toString()).toBe('');
  });

  it('ignores unknown or malicious values instead of sending them to the API', () => {
    const parsed = parseGridParams(
      new URLSearchParams('status=New,DROP TABLE&sort=password&dir=sideways&size=100000&page=-3'),
    );
    expect(parsed.status).toEqual(['New']);
    expect(parsed.sortBy).toBe(DEFAULT_GRID_PARAMS.sortBy);
    expect(parsed.sortDir).toBe(DEFAULT_GRID_PARAMS.sortDir);
    expect(parsed.pageSize).toBe(DEFAULT_GRID_PARAMS.pageSize);
    expect(parsed.page).toBe(1);
  });
});

describe('pagination window', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('collapses distant pages into gaps', () => {
    expect(pageWindow(6, 40)).toEqual([1, 'gap', 5, 6, 7, 'gap', 40]);
    expect(pageWindow(1, 40)).toEqual([1, 2, 'gap', 40]);
  });
});
