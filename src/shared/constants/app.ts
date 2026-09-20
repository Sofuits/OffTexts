/** Values that are the same everywhere and are not design tokens. */

export const APP_NAME = 'Offtexts';

/** How long a network request may run before it is abandoned. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Page size for any list that pages. */
export const DEFAULT_PAGE_SIZE = 20;

/** Copy shown wherever a list renders nothing. */
export const EMPTY_STATE_FALLBACK = 'Nothing here yet.';

/** Screen names as literals, for analytics and deep-link building. */
export const ROUTES = {
  rootTabs: 'RootTabs',
  profile: 'Profile',
  discover: 'Discover',
  scheduledMeets: 'ScheduledMeets',
  editProfile: 'EditProfile',
  personProfile: 'PersonProfile',
  meetDetails: 'MeetDetails',
  ratingsReviews: 'RatingsReviews',
} as const;
