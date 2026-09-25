import {
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';

import { useTheme } from '@/presentation/hooks/useTheme';
import { AuthedArea } from '@/app/navigation/AuthedArea';
import type { RootStackParamList } from '@/app/navigation/types';
import {
  DiscoverScreen,
  EditProfileScreen,
  MeetDetailsScreen,
  PersonProfileScreen,
  RatingsReviewsScreen,
  RequestMeetScreen,
  SetNewPasswordScreen,
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
 *
 * `RootTabs` renders `AuthedArea` rather than the tabs directly, because a
 * signed-in member who has not filled in a profile gets the onboarding wizard
 * in that slot. See AuthedArea for why that is a branch and not a route.
 */
export function RootNavigator(): React.JSX.Element {
  const theme = useTheme();
  const { isRestoring, isSignedIn, passwordRecovery } = useAuth();

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

  // A reset link signs the member in, but that session exists only so they can
  // choose a new password. Until they do — or give up — nothing else is shown,
  // including the app the session would otherwise open.
  if (passwordRecovery.status !== 'none') return <SetNewPasswordScreen />;

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
          <Stack.Screen name="RootTabs" component={AuthedArea} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
        )}

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
          name="RequestMeet"
          component={RequestMeetScreen}
          options={{ title: 'Book a table' }}
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
        <Stack.Screen
          name="Browse"
          component={DiscoverScreen}
          options={{ title: 'Everyone else' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
