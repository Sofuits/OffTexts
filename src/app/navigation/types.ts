import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MatchId, MeetId, PersonId } from '@/domain/entities';

/**
 * Navigation types.
 *
 * Every screen gets its params from here, so a typo in a route name or a
 * missing param is a compile error rather than a crash on a device.
 *
 * The `CompositeScreenProps` wrappers on the tab screens are what let a tab
 * screen call `navigation.navigate('EditProfile')` — a route that lives on the
 * parent stack, not in the tabs.
 */
export type AvailabilityFlowParamList = {
  AvailabilityStart: undefined;
  AvailabilitySelectDates: undefined;
  AvailabilitySharedDates: undefined;
  AvailabilitySelectTime: { selectedDate: string };
  AvailabilitySharedTimes: { selectedDate: string };
  AvailabilityConfirmed: {
    selectedDate: string;
    selectedTime: string;
  };
};
export type RootStackParamList = {
  /** The tab navigator, as a single route on the stack. */
  RootTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  /**
   * Shown when signed out. It is on the same stack rather than in a separate
   * navigator so that signing in or out swaps the screens with the stack's own
   * transition, and so a deep link that requires auth can be held and replayed
   * later without remounting the tree.
   */
  SignIn: undefined;
  EditProfile: undefined;
  /**
   * `matchId` is present only when arriving from a match.
   *
   * It is what decides whether the "arrange a meet" button appears, and it is
   * passed rather than looked up because the screen has no way to ask "am I
   * matched with this person" — the database will not answer that question for
   * anyone but through the match itself.
   */
  PersonProfile: { personId: PersonId; personName: string; matchId?: MatchId };
  /** Booking a table. Only reachable with a match, because only a match permits it. */
  RequestMeet: { matchId: MatchId; personName: string };
  MeetDetails: { meetId: MeetId };
  RatingsReviews: { meetId: MeetId; personName: string }; AvailabilityStart: undefined;
  AvailabilitySelectDates: undefined;
  AvailabilitySharedDates: undefined;
  AvailabilitySelectTime: { selectedDate: string };
  AvailabilitySharedTimes: { selectedDate: string };
  AvailabilityConfirmed: {
    selectedDate: string;
    selectedTime: string;
};};

export type BottomTabParamList = {
  Profile: undefined;
  /** Today's three. The landing screen. */
  Today: undefined;
  ScheduledMeets: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type BottomTabScreenPropsFor<T extends keyof BottomTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Makes `useNavigation()` typed everywhere without passing generics at each
 * call site. See https://reactnavigation.org/docs/typescript.
 */
declare global {
  namespace ReactNavigation {
    // The empty body is the point: this interface exists only to merge our
    // param list into React Navigation's global one, which is what makes
    // `useNavigation()` typed without generics at every call site.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
