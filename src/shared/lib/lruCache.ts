/**
 * Minimal LRU cache built on Map insertion order. `onEvict` lets owners release
 * expensive resources (e.g. destroy a pdf.js document and its worker-side memory).
 */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(
    private readonly capacity: number,
    private readonly onEvict?: (key: K, value: V) => void,
  ) {
    if (capacity < 1) throw new Error('LRU capacity must be >= 1');
  }

  get size() {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as K;
      const evicted = this.map.get(oldest) as V;
      this.map.delete(oldest);
      this.onEvict?.(oldest, evicted);
    }
  }

  /** Remove an entry *without* calling `onEvict` (the caller already released it). */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.forEach((value, key) => this.onEvict?.(key, value));
    this.map.clear();
  }
}
