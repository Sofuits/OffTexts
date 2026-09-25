import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  'AvailabilityDateSelected'
>;

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function AvailabilityDateSelectedScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ScreenProps['route']>();

  const { selectedDate } = route.params;

  const formattedDate = formatDateLabel(selectedDate);

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
            styles.eyebrow,
            {
              color: theme.colors.primary,
            },
          ]}
        >
          DAY SELECTED
        </Text>

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
          {formattedDate}
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.textPrimary,
            },
          ]}
        >
          You both selected this day. Next, choose the times you are
          available.
        </Text>

        <View
          style={[
            styles.dateCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.cardLabel,
              {
                color: theme.colors.textPrimary,
              },
            ]}
          >
            Shared day
          </Text>

          <Text
            style={[
              styles.cardDate,
              {
                color: theme.colors.primary,
              },
            ]}
          >
            {formattedDate}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            navigation.navigate('AvailabilityChooseDate', {
              commonDates: [selectedDate],
            })
          }
          style={styles.changeButton}
        >
          <Text
            style={[
              styles.changeText,
              {
                color: theme.colors.primary,
              },
            ]}
          >
            Change day
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() =>
          navigation.navigate('AvailabilitySelectTime', {
            selectedDate,
          })
        }
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
          Continue to time selection
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

  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
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

  dateCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },

  cardLabel: {
    fontSize: 13,
    marginBottom: 8,
  },

  cardDate: {
    fontSize: 20,
    fontWeight: '600',
  },

  changeButton: {
    alignSelf: 'flex-start',
    marginTop: 20,
    paddingVertical: 8,
  },

  changeText: {
    fontSize: 15,
    fontWeight: '600',
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
