import {
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';

import { useTheme } from '@/presentation/hooks/useTheme';
import { BottomTabs } from '@/app/navigation/BottomTabs';
import type { RootStackParamList } from '@/app/navigation/types';
import {
  AvailabilitySelectDatesScreen,
  AvailabilityStartScreen,
  EditProfileScreen,
  MeetDetailsScreen,
  PersonProfileScreen,
  RatingsReviewsScreen,
  SignInScreen,
  SplashScreen,
} from '@/presentation/screens';
import { useAuth } from '@/app/providers/AuthProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The root stack.
 *
 * The tab navigator is one route inside it, so pushing a detail screen covers
 * the tab bar — which is what you want for a drill-down, and what you would
 * lose by nesting the stack inside the tabs instead.
 */
export function RootNavigator(): React.JSX.Element {
  const theme = useTheme();
  const { isRestoring, isSignedIn } = useAuth();

  // Hand our palette to React Navigation so its own chrome (headers, card
  // backgrounds, the flash between screens) matches the app.
  const navigationTheme = useMemo<NavTheme>(
    () => ({
      ...DefaultTheme,
      dark: false,
      colors: {
        ...DefaultTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    }),
    [theme],
  );

  // Reading the stored session takes a moment. Rendering the sign-in screen
  // during it flashes it at members who are already signed in.
  if (isRestoring) return <SplashScreen />;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: {
            fontSize: theme.fontSizes.lg,
            fontWeight: theme.fontWeights.semibold,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {/*
          Conditional groups, not navigate() calls.
          React Navigation unmounts the branch that is no longer rendered, so
          signing out cannot leave a signed-in screen underneath, and there is
          no back gesture from the tabs to the sign-in screen. Doing this with
          navigate() instead leaves both in the stack and is how a signed-out
          member ends up able to swipe back into the app.
        */}
        {isSignedIn ? (
          <Stack.Screen
            name="RootTabs"
            component={BottomTabs}
            options={{ headerShown: false }}
          />
        ) : (
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{ headerShown: false }}
          />
        )}

        <Stack.Screen
          name="AvailabilityStart"
          component={AvailabilityStartScreen}
          options={{ headerShown: false }}
        />
<Stack.Screen
  name="AvailabilitySelectDates"
  component={AvailabilitySelectDatesScreen}
  options={{ headerShown: false }}
/>
        <Stack.Screen
          name="AvailabilityStart"
          component={AvailabilityStartScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="AvailabilitySelectDates"
          component={AvailabilitySelectDatesScreen}
          options={{ headerShown: false }}
        />

<Stack.Screen
  name="AvailabilitySelectDates"
  component={AvailabilitySelectDatesScreen}
  options={{ headerShown: false }}
/>
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ title: 'Edit profile' }}
        />
        <Stack.Screen
          name="PersonProfile"
          component={PersonProfileScreen}
          // Title comes from the route params, so the header names the person.
          options={({ route }) => ({ title: route.params.personName })}
        />
        <Stack.Screen
          name="MeetDetails"
          component={MeetDetailsScreen}
          options={{ title: 'Meet details' }}
        />
        <Stack.Screen
          name="RatingsReviews"
          component={RatingsReviewsScreen}
          options={{ title: 'Ratings & reviews' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
