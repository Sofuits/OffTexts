import * as ExpoSecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Logger } from '@/infrastructure/logging';
import type { KeyValueStore } from './KeyValueStore';
import { AsyncStorageStore } from './AsyncStorageStore';

/**
 * Credential storage, on the OS keychain — Keychain on iOS, Keystore-backed
 * EncryptedSharedPreferences on Android.
 *
 * This is where the Supabase session goes. On a rooted device AsyncStorage is
 * readable by other apps; the keychain is not.
 *
 * Two constraints worth knowing before using it for anything else:
 *
 *   - Values are capped at about 2 KB. A Supabase session fits comfortably;
 *     a cached list would not.
 *   - It does not exist on web. `SecureStore.isAvailableAsync()` is checked and
 *     the store falls back to AsyncStorage, which is correct for a browser
 *     (where the keychain has no equivalent) and is why web is a preview target
 *     rather than a place to hold a production session.
 */
export class SecureKeyValueStore implements KeyValueStore {
  private readonly fallback: KeyValueStore;
  private available: boolean | null = null;

  constructor(private readonly logger: Logger) {
    this.fallback = new AsyncStorageStore(logger);
  }

  private async useSecure(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    if (this.available !== null) return this.available;

    try {
      this.available = await ExpoSecureStore.isAvailableAsync();
    } catch {
      this.available = false;
    }

    if (!this.available) {
      this.logger.warn('SecureStore unavailable; falling back to AsyncStorage.');
    }
    return this.available;
  }

  async getItem(key: string): Promise<string | null> {
    if (!(await this.useSecure())) return this.fallback.getItem(key);
    try {
      return await ExpoSecureStore.getItemAsync(key);
    } catch (error) {
      this.logger.warn('SecureStore read failed', { key, error });
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!(await this.useSecure())) return this.fallback.setItem(key, value);
    try {
      await ExpoSecureStore.setItemAsync(key, value);
    } catch (error) {
      // Worth an error rather than a warning: a session that failed to persist
      // means the member is signed out again on next launch.
      this.logger.error('SecureStore write failed', error, { key });
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!(await this.useSecure())) return this.fallback.removeItem(key);
    try {
      await ExpoSecureStore.deleteItemAsync(key);
    } catch (error) {
      this.logger.warn('SecureStore remove failed', { key, error });
    }
  }

  async clear(): Promise<void> {
    // SecureStore has no "clear everything" — it is keyed access only. Callers
    // remove the keys they know about, which is why every key is declared in
    // shared/constants/storageKeys.ts.
    this.logger.warn('SecureKeyValueStore.clear() is a no-op; remove keys individually.');
  }
}
