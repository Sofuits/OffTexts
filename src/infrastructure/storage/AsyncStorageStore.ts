import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Logger } from '@/infrastructure/logging';
import type { KeyValueStore } from './KeyValueStore';

/**
 * Ordinary persistence, on AsyncStorage.
 *
 * For preferences, caches and anything else that is not a credential. It is
 * unencrypted — on a rooted or jailbroken device its contents are readable —
 * so tokens go to SecureStore instead.
 *
 * Every method swallows its error after logging it. A failed write to a cache
 * is not worth taking a screen down for, and AsyncStorage does fail: a full
 * disk, a corrupt database, a migration that went wrong.
 */
export class AsyncStorageStore implements KeyValueStore {
  constructor(private readonly logger: Logger) {}

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      this.logger.warn('AsyncStorage read failed', { key, error });
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      this.logger.warn('AsyncStorage write failed', { key, error });
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      this.logger.warn('AsyncStorage remove failed', { key, error });
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      this.logger.warn('AsyncStorage clear failed', { error });
    }
  }
}
