import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackParamList } from '@/app/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * Keep the next screen easy to change.
 * This can later be moved into a central availability-flow config.
 */
const NEXT_SCREEN: 'AvailabilitySelectDates' = 'AvailabilitySelectDates';

export function AvailabilityStartScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Simple calendar illustration matching the approved wireframe */}
        <View
          style={[
            styles.calendar,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.calendarHeader,
              {
                backgroundColor: theme.colors.primary,
              },
            ]}
          />

          <View style={styles.calendarGrid}>
            {Array.from({ length: 15 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.calendarCell,
                  {
                    backgroundColor:
                      index === 7
                        ? theme.colors.primary
                        : theme.colors.background,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <Text
          style={[
            styles.title,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fontSizes.lg,
              fontWeight: theme.fontWeights.semibold,
            },
          ]}
        >
          Plan your time together
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.textPrimary,
            },
          ]}
        >
          Choose the days when you’re available to meet, and we’ll find times
          that work for both of you.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose dates"
        onPress={() => navigation.navigate(NEXT_SCREEN)}
        style={[
          styles.button,
          {
            backgroundColor: theme.colors.primary,
          },
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: theme.colors.surface,
              fontWeight: theme.fontWeights.semibold,
            },
          ]}
        >
          Choose dates
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  calendar: {
    width: 210,
    height: 175,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    marginBottom: 48,
  },

  calendarHeader: {
    height: 22,
    borderRadius: 8,
    marginBottom: 18,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  calendarCell: {
    width: 25,
    height: 25,
    borderRadius: 5,
  },

  title: {
    textAlign: 'center',
    marginBottom: 14,
  },

  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },

  button: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
