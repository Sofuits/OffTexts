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
  meets: {
    all: ['meets'] as const,
    scheduled: () => [...queryKeys.meets.all, 'scheduled'] as const,
    detail: (id: string) => [...queryKeys.meets.all, 'detail', id] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    forMeet: (meetId: string) => [...queryKeys.reviews.all, 'forMeet', meetId] as const,
  },
} as const;
