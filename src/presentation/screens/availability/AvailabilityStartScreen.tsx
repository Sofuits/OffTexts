import React from 'react';

import { AppText, Button, IconTile, ScreenContainer, Spacer } from '@/presentation/components';
import type { RootStackScreenProps } from '@/app/navigation/types';

type Props = RootStackScreenProps<'AvailabilityStart'>;

/**
 * Step 1 of choosing a day together: what is about to happen.
 *
 * Ported from `AvailabilityStartScreen.tsx` on `feature/shared-availability-
 * dates` (juiwaykole2005), copy included. The decorative grey calendar is
 * replaced by the café cup — the mockup's heart is wrong for three of the four
 * purposes (scheduling-flow.md §1).
 */
export function AvailabilityStartScreen({ navigation }: Props): React.JSX.Element {
  return (
    <ScreenContainer edges={['bottom']} testID="screen-availability-start">
      <Spacer size={24} />
      <IconTile name="cafe-outline" />
      <Spacer size={20} />
      <AppText variant="heading">Plan your time together</AppText>
      <Spacer size={8} />
      <AppText variant="body">
        Choose the days when you’re available to meet, and we’ll find times that work for both of
        you.
      </AppText>
      <Spacer size={32} />
      <Button
        label="Choose dates"
        size="lg"
        fullWidth
        onPress={() => navigation.navigate('AvailabilitySelectDates')}
        testID="button-choose-dates"
      />
      <Spacer size={16} />
      <AppText variant="caption" align="center">
        A preview. The other person’s dates are placeholders for now.
      </AppText>
    </ScreenContainer>
  );
}
