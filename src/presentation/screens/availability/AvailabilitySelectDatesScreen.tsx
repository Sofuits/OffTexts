import React, { useMemo, useState } from 'react';

import {
  AppText,
  Button,
  Chip,
  ChipGroup,
  MonthCalendar,
  ScreenContainer,
  SectionHeader,
  Spacer,
} from '@/presentation/components';
import { useNow } from '@/presentation/hooks/useNow';
import type { RootStackScreenProps } from '@/app/navigation/types';
import { fromDateKey, type DateKey } from '@/shared/utils/calendar';
import { formatDayAndDate } from '@/shared/utils/date';

type Props = RootStackScreenProps<'AvailabilitySelectDates'>;

/**
 * Step 2: tick the days you could meet, across as many months as you like.
 *
 * Ported from `AvailabilitySelectDatesScreen.tsx` on `feature/shared-
 * availability-dates` (juiwaykole2005); the calendar itself is `MonthCalendar`.
 * The picked days are repeated as chips below, earliest first, so a choice made
 * in another month stays in sight — tapping one removes it.
 */
export function AvailabilitySelectDatesScreen({ navigation }: Props): React.JSX.Element {
  const now = useNow();
  const [picked, setPicked] = useState<ReadonlySet<DateKey>>(new Set());
  const sorted = useMemo(() => [...picked].sort(), [picked]);

  const toggle = (day: DateKey): void =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  return (
    <ScreenContainer edges={['bottom']} testID="screen-availability-select-dates">
      <Spacer size={16} />
      <AppText variant="heading">Select the dates you’re available</AppText>
      <Spacer size={8} />
      <AppText variant="body">Choose one or more days that work for you.</AppText>
      <Spacer size={24} />

      <MonthCalendar selected={picked} onToggle={toggle} today={now} testID="calendar" />

      {sorted.length > 0 ? (
        <>
          <Spacer size={24} />
          <SectionHeader title="Your dates" />
          <Spacer size={12} />
          <ChipGroup>
            {sorted.map((day) => (
              <Chip
                key={day}
                label={formatDayAndDate(fromDateKey(day))}
                selected
                onPress={() => toggle(day)}
                testID={`chip-date-${day}`}
              />
            ))}
          </ChipGroup>
        </>
      ) : null}

      <Spacer size={32} />
      <Button
        label="Continue"
        size="lg"
        fullWidth
        disabled={sorted.length === 0}
        onPress={() => navigation.navigate('AvailabilitySharedDates', { myDates: sorted })}
        testID="button-dates-continue"
      />
      <Spacer size={16} />
    </ScreenContainer>
  );
}
