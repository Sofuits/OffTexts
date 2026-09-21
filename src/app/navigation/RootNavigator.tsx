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
  EditProfileScreen,
  MeetDetailsScreen,
  PersonProfileScreen,
  RatingsReviewsScreen,
} from '@/presentation/screens';

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

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="RootTabs"
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
        <Stack.Screen name="RootTabs" component={BottomTabs} options={{ headerShown: false }} />

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
