import React from 'react';

import { AppText, Button, IconTile, ScreenContainer, Spacer } from '@/presentation/components';
import type { RootStackScreenProps } from '@/app/navigation/types';
import { fromDateKey } from '@/shared/utils/calendar';
import { formatDayAndDate } from '@/shared/utils/date';

type Props = RootStackScreenProps<'AvailabilityTimes'>;

/**
 * Where the preview stops.
 *
 * Registered so "Continue to time selection" lands somewhere and says so,
 * rather than naming a route that does not exist. The time steps (6–8 in
 * scheduling-flow.md) need both members' choices stored where the other can
 * read them, which is the schema work that comes next.
 */
export function AvailabilityTimesScreen({ navigation, route }: Props): React.JSX.Element {
  return (
    <ScreenContainer edges={['bottom']} testID="screen-availability-times">
      <Spacer size={24} />
      <IconTile name="time-outline" />
      <Spacer size={20} />
      <AppText variant="heading">Choosing a time comes next</AppText>
      <Spacer size={8} />
      <AppText variant="body">
        {`This preview stops at the day: ${formatDayAndDate(fromDateKey(route.params.selectedDate))}. Picking a time together needs both people’s choices stored where the other can see them, and that is the next piece of work.`}
      </AppText>
      <Spacer size={32} />
      <Button
        label="Back to your meets"
        size="lg"
        fullWidth
        onPress={() => navigation.popToTop()}
        testID="button-back-to-meets"
      />
    </ScreenContainer>
  );
}
