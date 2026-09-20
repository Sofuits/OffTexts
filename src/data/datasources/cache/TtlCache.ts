/**
 * A small in-memory cache with a time-to-live.
 *
 * React Query already caches server state, so this is NOT for that. It exists
 * for the data layer's own repeated lookups — the current user's id, read on
 * every meets query — where going to storage each time is wasteful and where
 * React Query has no visibility.
 *
 * Deliberately tiny. Anything that needs eviction policies or persistence
 * should use React Query or a real cache library instead.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
