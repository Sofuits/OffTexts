import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/presentation/hooks/useTheme';
import type { BottomTabParamList } from '@/app/navigation/types';
import { ProfileScreen, ScheduledMeetsScreen, TodayScreen } from '@/presentation/screens';

const Tab = createBottomTabNavigator<BottomTabParamList>();

/** Icon per tab, focused and unfocused. Kept next to the navigator that uses it. */
const ICONS: Record<
  keyof BottomTabParamList,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Profile: { active: 'person', inactive: 'person-outline' },
  Today: { active: 'sunny', inactive: 'sunny-outline' },
  ScheduledMeets: { active: 'cafe', inactive: 'cafe-outline' },
};

/**
 * Three tabs, with Today in the middle because it is what the app is for.
 *
 * Three and not four. Every candidate for a fourth — a browsable feed, a
 * "likes you" screen, a messages tab — is something Offtexts deliberately does
 * not have, and a tab bar is the loudest possible place to promise one.
 */
export function BottomTabs(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Today"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textDisabled,
        // The height is set rather than inherited, because the default clips
        // the labels. React Navigation's bar is 49dp; inside it the icon takes
        // 28 and the label is left with what remains, and since the label has
        // `flexShrink: 1` it is squeezed to a 7dp box for a 12dp font — so the
        // descender on "Profile" is cut in half. Measured, not guessed.
        //
        // Two changes fix it, and both are needed: more height, and a label
        // that refuses to shrink. Height alone leaves the label shrunk when a
        // longer word arrives; `flexShrink: 0` alone overflows a 49dp bar.
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64 + insets.bottom,
          paddingTop: theme.spacing[8],
          // The inset is added rather than replaced: on a phone with a home
          // indicator the bar has to clear it, and on one without, this is zero.
          paddingBottom: theme.spacing[8] + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: theme.fontSizes.xs,
          fontWeight: theme.fontWeights.medium,
          lineHeight: 16,
          flexShrink: 0,
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
      <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarLabel: 'Today' }} />
      <Tab.Screen
        name="ScheduledMeets"
        component={ScheduledMeetsScreen}
        options={{ tabBarLabel: 'Meets' }}
      />
    </Tab.Navigator>
  );
}
