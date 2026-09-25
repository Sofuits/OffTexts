import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MeetId, PersonId } from '@/domain/entities';

export type AvailabilityFlowParamList = {
  AvailabilityStart: undefined;
  AvailabilitySelectDates: undefined;
  AvailabilitySharedDates: {
    selectedDates: string[];
  };
  AvailabilityChooseDate: {
    commonDates: string[];
  };
  AvailabilityDateSelected: {
    selectedDate: string;
  };
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
   * transition.
   */
  SignIn: undefined;

  EditProfile: undefined;
  PersonProfile: { personId: PersonId; personName: string };
  MeetDetails: { meetId: MeetId };
  RatingsReviews: { meetId: MeetId; personName: string };

  AvailabilityStart: undefined;
  AvailabilitySelectDates: undefined;
  AvailabilitySharedDates: {
    selectedDates: string[];
  };
  AvailabilityChooseDate: {
    commonDates: string[];
  };
  AvailabilityDateSelected: {
    selectedDate: string;
  };
  AvailabilitySelectTime: { selectedDate: string };
  AvailabilitySharedTimes: { selectedDate: string };
  AvailabilityConfirmed: {
    selectedDate: string;
    selectedTime: string;
  };
};

export type BottomTabParamList = {
  Profile: undefined;
  Discover: undefined;
  ScheduledMeets: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type BottomTabScreenPropsFor<T extends keyof BottomTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<BottomTabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}