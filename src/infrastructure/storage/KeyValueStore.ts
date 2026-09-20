/**
 * Key-value persistence, behind an interface.
 *
 * Two implementations exist because the requirements genuinely differ: a
 * session token needs the OS keychain, a remembered filter does not and would
 * be slower for it. Both satisfy this interface, so a caller picks by intent
 * rather than by library.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}
