import React, { useState } from 'react';
import {
  Alert,
  Pressable,
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
  'AvailabilityChooseDate'
>;

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function AvailabilityChooseDateScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ScreenProps['route']>();

  const { commonDates } = route.params;

  const [selectedDate, setSelectedDate] = useState<string | null>(
    null,
  );

  const dateOptions = commonDates.map((date) => ({
    value: date,
    label: formatDateLabel(date),
  }));

  const handleDatePress = (date: {
    value: string;
    label: string;
  }) => {
    setSelectedDate(date.value);

    if (dateOptions.length > 1) {
      const otherDate = dateOptions.find(
        (item) => item.value !== date.value,
      );

      if (otherDate) {
        Alert.alert(
          'Different day selected',
          `Alex selected ${otherDate.label}. Would you like to select this date too?`,
          [
            {
              text: 'Keep my date',
              style: 'cancel',
            },
            {
              text: 'Select their date',
              onPress: () => {
                setSelectedDate(otherDate.value);
              },
            },
          ],
        );
      }
    }
  };

  const handleConfirm = () => {
    if (!selectedDate) {
      return;
    }

    navigation.navigate('AvailabilityDateSelected', {
      selectedDate,
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
      <View style={styles.content}>
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
          Choose a day together
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.textPrimary,
            },
          ]}
        >
          Choose the same day so you can both plan together.
        </Text>

        <View style={styles.dateList}>
          {dateOptions.map((date) => {
            const isSelected = selectedDate === date.value;

            return (
              <Pressable
                key={date.value}
                onPress={() => handleDatePress(date)}
                accessibilityRole="button"
                accessibilityState={{
                  selected: isSelected,
                }}
                accessibilityLabel={`Select ${date.label}`}
                style={[
                  styles.dateCard,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.surface,
                    borderColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
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
                  {date.label}
                </Text>

                <Text
                  style={[
                    styles.statusText,
                    {
                      color: isSelected
                        ? theme.colors.surface
                        : theme.colors.primary,
                    },
                  ]}
                >
                  Both available
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        disabled={!selectedDate}
        onPress={handleConfirm}
        style={[
          styles.button,
          {
            backgroundColor: selectedDate
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
          Confirm day
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
    paddingTop: 32,
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

  dateList: {
    gap: 12,
  },

  dateCard: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },

  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },

  statusText: {
    fontSize: 13,
    marginTop: 6,
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
