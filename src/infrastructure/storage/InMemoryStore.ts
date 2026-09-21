import type { KeyValueStore } from './KeyValueStore';

/**
 * Storage that forgets everything on restart.
 *
 * For tests, and as the default when no native storage is available. Having it
 * satisfy the same interface means a test never has to mock a native module.
 */
export class InMemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}
