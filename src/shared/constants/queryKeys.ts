/**
 * React Query cache keys.
 *
 * Every key is built here rather than inline at the call site. Two places
 * spelling the same key differently is a cache that silently never invalidates,
 * and it is invisible in review — the code looks right in both files.
 *
 * The hierarchy matters: invalidating `meets.all` also invalidates
 * `meets.detail(id)`, because React Query matches keys by prefix.
 */
export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    me: () => [...queryKeys.profile.all, 'me'] as const,
    byId: (id: string) => [...queryKeys.profile.all, 'byId', id] as const,
  },
  discover: {
    all: ['discover'] as const,
    suggestions: (city?: string) =>
      [...queryKeys.discover.all, 'suggestions', city ?? 'any'] as const,
  },
  matching: {
    all: ['matching'] as const,
    /**
     * Not keyed by date. The repository asks for "today" and the answer changes
     * when the day does; putting the date in the key would leave yesterday's
     * set cached under its own key for ever, on a phone that is never closed.
     */
    today: () => [...queryKeys.matching.all, 'today'] as const,
    matches: () => [...queryKeys.matching.all, 'matches'] as const,
  },
  photos: {
    all: ['photos'] as const,
    mine: () => [...queryKeys.photos.all, 'mine'] as const,
  },
  profileDetails: {
    all: ['profileDetails'] as const,
    mine: () => [...queryKeys.profileDetails.all, 'mine'] as const,
  },
  preferences: {
    all: ['preferences'] as const,
    mine: () => [...queryKeys.preferences.all, 'mine'] as const,
  },
  meets: {
    all: ['meets'] as const,
    scheduled: () => [...queryKeys.meets.all, 'scheduled'] as const,
    detail: (id: string) => [...queryKeys.meets.all, 'detail', id] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    forMeet: (meetId: string) => [...queryKeys.reviews.all, 'forMeet', meetId] as const,
  },
  venues: {
    all: ['venues'] as const,
    list: (city?: string) => [...queryKeys.venues.all, 'list', city ?? 'any'] as const,
  },
} as const;
