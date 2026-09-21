/**
 * Push notifications, behind an interface.
 *
 * Not wired to anything — out of scope for this stage. The interface is here so
 * that `expo-notifications` lands in one file rather than being imported by a
 * screen that wants to ask for permission at the right moment.
 *
 * One note for whoever implements it: ask for permission when the member does
 * something that makes the reason obvious — booking their first meet — not on
 * first launch. A permission prompt with no context is usually declined, and on
 * iOS you only get to ask once.
 */

export type PushToken = string;

export interface NotificationService {
  /** Prompts if needed. Resolves false when the member says no. */
  requestPermission(): Promise<boolean>;
  /** The device token to register with the backend. Null when not permitted. */
  getToken(): Promise<PushToken | null>;
  /** @returns An unsubscribe function. */
  onNotificationReceived(listener: (payload: Record<string, unknown>) => void): () => void;
}

export class NoopNotificationService implements NotificationService {
  async requestPermission(): Promise<boolean> {
    return false;
  }

  async getToken(): Promise<PushToken | null> {
    return null;
  }

  onNotificationReceived(): () => void {
    return () => {};
  }
}
