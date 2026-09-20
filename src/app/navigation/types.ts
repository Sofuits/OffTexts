import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MeetId, PersonId } from '@/domain/entities';

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

export type RootStackParamList = {
  /** The tab navigator, as a single route on the stack. */
  RootTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  EditProfile: undefined;
  PersonProfile: { personId: PersonId; personName: string };
  MeetDetails: { meetId: MeetId };
  RatingsReviews: { meetId: MeetId; personName: string };
};

export type BottomTabParamList = {
  Profile: undefined;
  Discover: undefined;
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
