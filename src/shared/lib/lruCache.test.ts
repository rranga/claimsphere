import { describe, expect, it, vi } from 'vitest';
import { LruCache } from './lruCache';

describe('LruCache', () => {
  it('evicts the least recently used entry and notifies the owner', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, number>(2, onEvict);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // a is now most recent
    cache.set('c', 3);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(onEvict).toHaveBeenCalledWith('b', 2);
  });

  it('delete() removes without calling onEvict', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, number>(2, onEvict);
    cache.set('a', 1);
    cache.delete('a');
    expect(cache.size).toBe(0);
    expect(onEvict).not.toHaveBeenCalled();
  });
});
