/**
 * Product analytics, behind an interface.
 *
 * Not wired to anything. The interface exists so that adding PostHog, Amplitude
 * or Firebase later is an implementation rather than a refactor — and so that
 * event names are typed instead of being loose strings scattered across
 * screens, which is how two events named `meet_requested` and `meetRequested`
 * end up in the same dashboard.
 *
 * Nothing above `infrastructure` should import a vendor SDK.
 */

export type AnalyticsEvent =
  | { name: 'screen_viewed'; screen: string }
  | { name: 'sign_in_succeeded'; method: 'password' | 'magic_link' }
  | { name: 'sign_in_failed'; method: 'password' | 'magic_link'; reason: string }
  | { name: 'profile_viewed'; personId: string }
  | { name: 'meet_requested'; personId: string }
  | { name: 'meet_cancelled'; meetId: string }
  | { name: 'review_submitted'; meetId: string; rating: number };

export interface Analytics {
  track(event: AnalyticsEvent): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  reset(): void;
}

/** Does nothing. The default until a provider is chosen, and used in tests. */
export class NoopAnalytics implements Analytics {
  track(): void {}
  identify(): void {}
  reset(): void {}
}
