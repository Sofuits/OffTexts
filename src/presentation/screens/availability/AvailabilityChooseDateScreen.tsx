import React, { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, ChoiceRow, ScreenContainer, Spacer } from '@/presentation/components';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackScreenProps } from '@/app/navigation/types';
import { fromDateKey, type DateKey } from '@/shared/utils/calendar';
import { formatDayAndDate } from '@/shared/utils/date';
import { PlaceholderNotice } from './PlaceholderNotice';

type Props = RootStackScreenProps<'AvailabilityChooseDate'>;

/**
 * Step 4: one day, out of the ones you are both free.
 *
 * Ported from `AvailabilityChooseDateScreen.tsx` on `feature/shared-
 * availability-dates` (juiwaykole2005). Dropped: the alert claiming the other
 * member had picked a different day — invented on the phone, and fired on
 * every tap. Fixed: the day chosen here is the one passed on, and the list
 * travels with it, so "Change day" on the next screen comes back to all of
 * them rather than just the one.
 */
export function AvailabilityChooseDateScreen({ navigation, route }: Props): React.JSX.Element {
  const theme = useTheme();
  const { commonDates } = route.params;
  const [chosen, setChosen] = useState<DateKey | null>(null);

  return (
    <ScreenContainer edges={['bottom']} testID="screen-availability-choose-date">
      <Spacer size={16} />
      <AppText variant="heading">Choose a day together</AppText>
      <Spacer size={8} />
      <AppText variant="body">Pick one of the days you are both free.</AppText>
      <Spacer size={20} />
      <PlaceholderNotice />
      <Spacer size={20} />

      <View style={{ gap: theme.spacing[12] }}>
        {[...commonDates].sort().map((day) => (
          <ChoiceRow
            key={day}
            label={formatDayAndDate(fromDateKey(day))}
            description="Both available"
            selected={chosen === day}
            onPress={() => setChosen(day)}
            testID={`choice-date-${day}`}
          />
        ))}
      </View>

      <Spacer size={32} />
      <Button
        label="Confirm day"
        size="lg"
        fullWidth
        disabled={chosen === null}
        onPress={() => {
          if (chosen) {
            navigation.navigate('AvailabilityDateSelected', { selectedDate: chosen, commonDates });
          }
        }}
        testID="button-confirm-day"
      />
      <Spacer size={16} />
    </ScreenContainer>
  );
}
