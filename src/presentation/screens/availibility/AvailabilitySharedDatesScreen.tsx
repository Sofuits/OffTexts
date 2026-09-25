import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackParamList } from '@/app/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type ScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AvailabilitySharedDates'
>;

type DateRow = {
  date: string;
  label: string;
  you: boolean;
  alex: boolean;
};

const ALEX_SELECTED_DATES = new Set([
  '2026-10-09',
  '2026-10-10',
]);

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function AvailabilitySharedDatesScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ScreenProps['route']>();

  const { selectedDates } = route.params;

  const initialDates = useMemo<DateRow[]>(
    () =>
      selectedDates.map((date) => ({
        date,
        label: formatDateLabel(date),
        you: true,
        alex: ALEX_SELECTED_DATES.has(date),
      })),
    [selectedDates],
  );

  const [dates, setDates] = useState<DateRow[]>(initialDates);

  const [selectedCommonDate, setSelectedCommonDate] = useState<
    string | null
  >(null);

  const toggleYourDate = (date: string) => {
    setDates((current) =>
      current.map((item) =>
        item.date === date
          ? {
              ...item,
              you: !item.you,
            }
          : item,
      ),
    );

    if (selectedCommonDate === date) {
      setSelectedCommonDate(null);
    }
  };

  const handleContinue = () => {
  const commonDates = dates
    .filter((item) => item.you && item.alex)
    .map((item) => item.date);

  if (commonDates.length === 0) {
    return;
  }

  navigation.navigate('AvailabilityChooseDate', {
    commonDates,
  });
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
          Shared availability
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.textPrimary,
            },
          ]}
        >
          See which dates work for both of you.
        </Text>

        <View
          style={[
            styles.table,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.headerRow,
              {
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.dateColumn}>
              <Text
                style={[
                  styles.headerText,
                  {
                    color: theme.colors.textPrimary,
                  },
                ]}
              >
                Date
              </Text>
            </View>

            <View style={styles.personColumn}>
              <Text
                style={[
                  styles.headerText,
                  {
                    color: theme.colors.textPrimary,
                  },
                ]}
              >
                You
              </Text>
            </View>

            <View style={styles.personColumn}>
              <Text
                style={[
                  styles.headerText,
                  {
                    color: theme.colors.textPrimary,
                  },
                ]}
              >
                Alex
              </Text>
            </View>
          </View>

          {dates.map((item) => {
            const isCommon = item.you && item.alex;
            const isSelected = selectedCommonDate === item.date;

            return (
              <View
                key={item.date}
                style={[
                  styles.row,
                  {
                    borderBottomColor: theme.colors.border,
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : isCommon
                        ? theme.colors.background
                        : theme.colors.surface,
                  },
                ]}
              >
                <Pressable
                  disabled={!isCommon}
                  onPress={() => {
                    if (isCommon) {
                      setSelectedCommonDate(item.date);
                    }
                  }}
                  style={styles.dateColumn}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: isSelected,
                    disabled: !isCommon,
                  }}
                  accessibilityLabel={
                    isCommon
                      ? `Select ${item.label} as the meeting date`
                      : `${item.label} is not available for both`
                  }
                >
                  <Text
                    style={[
                      styles.dateText,
                      {
                        color: isSelected
                          ? theme.colors.surface
                          : theme.colors.textPrimary,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>

                  {isCommon && (
                    <Text
                      style={[
                        styles.commonText,
                        {
                          color: isSelected
                            ? theme.colors.surface
                            : theme.colors.primary,
                        },
                      ]}
                    >
                      {isSelected ? 'Selected' : 'Both available'}
                    </Text>
                  )}
                </Pressable>

                <View style={styles.personColumn}>
                  <Pressable
                    onPress={() => toggleYourDate(item.date)}
                    accessibilityRole="button"
                    accessibilityLabel={`Toggle your availability for ${item.label}`}
                    style={[
                      styles.checkCircle,
                      {
                        borderColor: isSelected
                          ? theme.colors.surface
                          : theme.colors.border,
                        backgroundColor: item.you
                          ? theme.colors.primary
                          : theme.colors.surface,
                      },
                    ]}
                  >
                    {item.you && (
                      <Text
                        style={[
                          styles.checkmark,
                          {
                            color: theme.colors.surface,
                          },
                        ]}
                      >
                        ✓
                      </Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.personColumn}>
                  <View
                    style={[
                      styles.checkCircle,
                      {
                        borderColor: isSelected
                          ? theme.colors.surface
                          : theme.colors.border,
                        backgroundColor: item.alex
                          ? theme.colors.primary
                          : theme.colors.surface,
                      },
                    ]}
                  >
                    {item.alex && (
                      <Text
                        style={[
                          styles.checkmark,
                          {
                            color: theme.colors.surface,
                          },
                        ]}
                      >
                        ✓
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <Text
          style={[
            styles.selectionHint,
            {
              color: theme.colors.textPrimary,
            },
          ]}
        >
          Select one of the dates where you are both available.
        </Text>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />

            <Text
              style={[
                styles.legendText,
                {
                  color: theme.colors.textPrimary,
                },
              ]}
            >
              Available
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: theme.colors.border,
                },
              ]}
            />

            <Text
              style={[
                styles.legendText,
                {
                  color: theme.colors.textPrimary,
                },
              ]}
            >
              Not available
            </Text>
          </View>
        </View>
      </ScrollView>

      <Pressable
        disabled={!selectedCommonDate}
        onPress={handleContinue}
        style={[
          styles.button,
          {
            backgroundColor: selectedCommonDate
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
    marginBottom: 28,
  },

  table: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },

  headerRow: {
    flexDirection: 'row',
    minHeight: 56,
    alignItems: 'center',
    borderBottomWidth: 1,
  },

  row: {
    flexDirection: 'row',
    minHeight: 72,
    alignItems: 'center',
    borderBottomWidth: 1,
  },

  dateColumn: {
    flex: 1,
    paddingHorizontal: 16,
  },

  personColumn: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    fontSize: 14,
    fontWeight: '600',
  },

  dateText: {
    fontSize: 15,
    fontWeight: '500',
  },

  commonText: {
    fontSize: 12,
    marginTop: 4,
  },

  selectionHint: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
  },

  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkmark: {
    fontSize: 18,
    fontWeight: '700',
  },

  legend: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 20,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  legendText: {
    fontSize: 13,
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
