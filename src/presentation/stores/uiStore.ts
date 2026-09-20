import { create } from 'zustand';

/**
 * Client state, on Zustand.
 *
 * The line between this and React Query matters, and getting it wrong is the
 * most common state-management mistake in an app like this:
 *
 *   React Query owns SERVER state — anything the backend is the truth for.
 *     Profiles, meets, reviews. It is fetched, cached, invalidated and refetched.
 *
 *   Zustand owns CLIENT state — anything the backend neither knows nor cares
 *     about. A selected filter, a dismissed banner, a draft not yet sent.
 *
 * Copying a fetched profile into Zustand gives you two sources of truth and a
 * synchronisation bug. If the server can change it, it does not belong here.
 *
 * Deliberately small. It is one store rather than several because the state
 * here is unrelated to any one feature; a feature with substantial local state
 * should get its own store beside it.
 */

type UiState = {
  /** The city Discover is filtered to. Null means every city. */
  discoverCityFilter: string | null;
  /** Ids of one-off banners the member has dismissed this session. */
  dismissedBanners: string[];
  /** Set while the offline notice is showing, so screens can adjust copy. */
  isOfflineNoticeVisible: boolean;

  setDiscoverCityFilter: (city: string | null) => void;
  dismissBanner: (id: string) => void;
  setOfflineNoticeVisible: (visible: boolean) => void;
  /** Called on sign-out. Anything member-specific must be cleared here. */
  reset: () => void;
};

const initialState = {
  discoverCityFilter: null,
  dismissedBanners: [],
  isOfflineNoticeVisible: false,
} satisfies Pick<UiState, 'discoverCityFilter' | 'dismissedBanners' | 'isOfflineNoticeVisible'>;

export const useUiStore = create<UiState>((set) => ({
  ...initialState,

  setDiscoverCityFilter: (city) => set({ discoverCityFilter: city }),

  dismissBanner: (id) =>
    set((state) =>
      state.dismissedBanners.includes(id)
        ? state
        : { dismissedBanners: [...state.dismissedBanners, id] },
    ),

  setOfflineNoticeVisible: (visible) => set({ isOfflineNoticeVisible: visible }),

  reset: () => set(initialState),
}));

/**
 * Selectors.
 *
 * Subscribing to one field rather than the whole store is what keeps a change
 * to `isOfflineNoticeVisible` from re-rendering every screen that only cares
 * about the city filter.
 */
export const selectDiscoverCityFilter = (state: UiState): string | null => state.discoverCityFilter;
export const selectIsOfflineNoticeVisible = (state: UiState): boolean =>
  state.isOfflineNoticeVisible;
