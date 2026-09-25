import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ScreenContainer, Spacer } from '@/presentation/components';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackScreenProps } from '@/app/navigation/types';
import { fromDateKey } from '@/shared/utils/calendar';
import { formatDayAndDate } from '@/shared/utils/date';

type Props = RootStackScreenProps<'AvailabilityDateSelected'>;

/**
 * Step 5: the day, confirmed, with a way to change it.
 *
 * Ported from `AvailabilityDateSelectedScreen.tsx` on `feature/shared-
 * availability-dates` (juiwaykole2005). Two fixes:
 *
 * - "Change day" goes back to the choice it came from, with every common day
 *   still listed. It used to navigate forward to a new copy of that screen
 *   holding only the day already chosen, so there was nothing to change to.
 * - "Continue to time selection" goes to a registered screen. It used to name
 *   a route that did not exist, and did nothing.
 *
 * And one copy change: "You both selected this day" is gone. Nobody else
 * selected anything; the other person's dates are a placeholder.
 */
export function AvailabilityDateSelectedScreen({ navigation, route }: Props): React.JSX.Element {
  const theme = useTheme();
  const { selectedDate } = route.params;

  return (
    <ScreenContainer edges={['bottom']} testID="screen-availability-date-selected">
      <Spacer size={24} />
      <AppText variant="label" color="primary">
        Day chosen
      </AppText>
      <Spacer size={16} />

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.cardTinted,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.xl,
            padding: theme.spacing[24],
          },
        ]}
      >
        <AppText variant="label">Shared day</AppText>
        <Spacer size={4} />
        <AppText variant="heading" testID="selected-date">
          {formatDayAndDate(fromDateKey(selectedDate))}
        </AppText>
      </View>

      <Spacer size={16} />
      <AppText variant="body">Next, choose the times you are available.</AppText>

      <Spacer size={32} />
      <Button
        label="Continue to time selection"
        size="lg"
        fullWidth
        onPress={() => navigation.navigate('AvailabilityTimes', { selectedDate })}
        testID="button-continue-times"
      />
      <Spacer size={12} />
      <Button
        label="Change day"
        variant="secondary"
        size="lg"
        fullWidth
        onPress={() => navigation.goBack()}
        testID="button-change-day"
      />
      <Spacer size={16} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth * 2 },
});
