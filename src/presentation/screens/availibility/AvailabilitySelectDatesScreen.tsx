import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackParamList } from '@/app/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const NEXT_SCREEN: 'AvailabilitySharedDates' = 'AvailabilitySharedDates';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getMonthDays(year: number, month: number): Array<Date | null> {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: Array<Date | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
}

export function AvailabilitySelectDatesScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();

  const today = new Date();

  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    new Set(),
  );

  const monthDays = useMemo(
    () =>
      getMonthDays(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
      ),
    [visibleMonth],
  );

  const monthTitle = visibleMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const currentMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    1,
  );

  const goToPreviousMonth = () => {
    const previousMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() - 1,
      1,
    );

    if (previousMonth >= currentMonth) {
      setVisibleMonth(previousMonth);
    }
  };

  const goToNextMonth = () => {
    setVisibleMonth(
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() + 1,
        1,
      ),
    );
  };

  const toggleDate = (date: Date) => {
    const dateKey = toDateKey(date);

    setSelectedDates((current) => {
      const next = new Set(current);

      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }

      return next;
    });
  };

  const handleContinue = () => {
    if (selectedDates.size === 0) {
      return;
    }

    navigation.navigate(NEXT_SCREEN);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
          Select the dates you’re available
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.textPrimary,
            },
          ]}
        >
          Choose one or more days that work for you.
        </Text>

        <View style={styles.monthHeader}>
          <Pressable
            onPress={goToPreviousMonth}
            style={styles.monthButton}
            accessibilityLabel="Previous month"
          >
            <Text
              style={[
                styles.arrow,
                {
                  color: theme.colors.textPrimary,
                },
              ]}
            >
              ‹
            </Text>
          </Pressable>

          <Text
            style={[
              styles.monthTitle,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.fontSizes.lg,
                fontWeight: theme.fontWeights.semibold,
              },
            ]}
          >
            {monthTitle}
          </Text>

          <Pressable
            onPress={goToNextMonth}
            style={styles.monthButton}
            accessibilityLabel="Next month"
          >
            <Text
              style={[
                styles.arrow,
                {
                  color: theme.colors.textPrimary,
                },
              ]}
            >
              ›
            </Text>
          </Pressable>
        </View>

        <View style={styles.weekHeader}>
          {WEEK_DAYS.map((day) => (
            <Text
              key={day}
              style={[
                styles.weekDay,
                {
                  color: theme.colors.textPrimary,
                },
              ]}
            >
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.calendar}>
          {monthDays.map((date, index) => {
            if (!date) {
              return (
                <View
                  key={`empty-${index}`}
                  style={styles.dayCell}
                />
              );
            }

            const dateKey = toDateKey(date);
            const selected = selectedDates.has(dateKey);

            return (
              <Pressable
                key={dateKey}
                onPress={() => toggleDate(date)}
                style={styles.dayCell}
                accessibilityRole="button"
                accessibilityState={{
                  selected,
                }}
                accessibilityLabel={`Select ${date.toDateString()}`}
              >
                <View
                  style={[
                    styles.dayCircle,
                    selected && {
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: selected
                          ? theme.colors.surface
                          : theme.colors.textPrimary,
                      },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        disabled={selectedDates.size === 0}
        onPress={handleContinue}
        style={[
          styles.button,
          {
            backgroundColor:
              selectedDates.size > 0
                ? theme.colors.primary
                : theme.colors.border,
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
          Continue
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },

  scrollContent: {
    paddingTop: 24,
    paddingBottom: 24,
  },

  title: {
    lineHeight: 36,
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  monthButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  arrow: {
    fontSize: 36,
    lineHeight: 36,
  },

  monthTitle: {
    textAlign: 'center',
  },

  weekHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },

  weekDay: {
    width: '14.285%',
    textAlign: 'center',
    fontSize: 13,
  },

  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dayCell: {
    width: '14.285%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayText: {
    fontSize: 16,
  },

  button: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  buttonText: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
