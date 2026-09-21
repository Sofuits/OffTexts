import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/presentation/hooks/useTheme';
import type { BottomTabParamList } from '@/app/navigation/types';
import { DiscoverScreen, ProfileScreen, ScheduledMeetsScreen } from '@/presentation/screens';

const Tab = createBottomTabNavigator<BottomTabParamList>();

/** Icon per tab, focused and unfocused. Kept next to the navigator that uses it. */
const ICONS: Record<
  keyof BottomTabParamList,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Profile: { active: 'person', inactive: 'person-outline' },
  Discover: { active: 'compass', inactive: 'compass-outline' },
  ScheduledMeets: { active: 'calendar', inactive: 'calendar-outline' },
};

/**
 * The three tabs, with Discover in the middle because it is the screen people
 * open the app for.
 */
export function BottomTabs(): React.JSX.Element {
  const theme = useTheme();

  return (
    <Tab.Navigator
      // Discover is the centre tab and the landing screen.
      initialRouteName="Discover"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textDisabled,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontSize: theme.fontSizes.xs,
          fontWeight: theme.fontWeights.medium,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icon = ICONS[route.name];
          return (
            <Ionicons name={focused ? icon.active : icon.inactive} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ tabBarLabel: 'Discover' }}
      />
      <Tab.Screen
        name="ScheduledMeets"
        component={ScheduledMeetsScreen}
        options={{ tabBarLabel: 'Meets' }}
      />
    </Tab.Navigator>
  );
}
