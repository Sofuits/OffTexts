import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { CircleButton } from '@/presentation/components/onboarding/CircleButton';
import { useTheme } from '@/presentation/hooks/useTheme';
import { isBeforeDay, monthGrid, toDateKey, type DateKey } from '@/shared/utils/calendar';
import { formatDayAndDate } from '@/shared/utils/date';

export type MonthCalendarProps = {
  /** The days that are on. */
  selected: ReadonlySet<DateKey>;
  onToggle: (day: DateKey) => void;
  /** "Now", so a test can fix it. Days before it cannot be picked. */
  today: Date;
  style?: ViewStyle;
  testID?: string;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * A month of days to tick, several at once, across as many months as you like.
 *
 * Ported from the month calendar in `AvailabilitySelectDatesScreen.tsx` on
 * `feature/shared-availability-dates` (juiwaykole2005): the Sunday-first grid,
 * the selection kept across month changes, the arrows that stop at the current
 * month, and the accessibility pattern on each day — a button with its full
 * date as the label and its selection in `accessibilityState`. Restyled onto
 * the theme, with two fixes: days before today cannot be picked (they could),
 * and the arrows have a button role (they had none).
 *
 * Selection is inversion, as everywhere else: forest with a white number. Today
 * has a ring, so it can be found without being mistaken for a choice.
 */
export function MonthCalendar({
  selected,
  onToggle,
  today,
  style,
  testID,
}: MonthCalendarProps): React.JSX.Element {
  const theme = useTheme();
  const [visible, setVisible] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const cells = useMemo(() => monthGrid(visible.year, visible.month), [visible]);
  const atCurrentMonth = visible.year === today.getFullYear() && visible.month === today.getMonth();
  const todayKey = toDateKey(today);

  const shift = (by: number): void =>
    setVisible(({ year, month }) => {
      const next = new Date(year, month + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <View style={style} testID={testID}>
      <View style={[styles.header, { marginBottom: theme.spacing[12] }]}>
        <CircleButton
          icon="chevron-back"
          tone="muted"
          size={44}
          accessibilityLabel="Previous month"
          onPress={() => shift(-1)}
          // Nothing earlier can be picked, so there is nothing to go back to.
          disabled={atCurrentMonth}
          testID="calendar-prev"
        />
        <AppText
          variant="subheading"
          align="center"
          style={styles.grow}
          accessibilityRole="header"
          testID="calendar-month"
        >
          {`${MONTHS[visible.month]} ${visible.year}`}
        </AppText>
        <CircleButton
          icon="chevron-forward"
          tone="muted"
          size={44}
          accessibilityLabel="Next month"
          onPress={() => shift(1)}
          testID="calendar-next"
        />
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((letter, index) => (
          <View key={`weekday-${index}`} style={styles.cell}>
            <AppText variant="caption" align="center" accessibilityLabel={WEEKDAY_NAMES[index]}>
              {letter}
            </AppText>
          </View>
        ))}

        {cells.map((date, index) => {
          if (!date) return <View key={`blank-${index}`} style={styles.cell} />;

          const key = toDateKey(date);
          const isOn = selected.has(key);
          const isPast = isBeforeDay(date, today);
          const isToday = key === todayKey;

          return (
            <View key={key} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={formatDayAndDate(date)}
                accessibilityState={{ selected: isOn, disabled: isPast }}
                disabled={isPast}
                onPress={() => onToggle(key)}
                testID={`calendar-day-${key}`}
                style={({ pressed }) => [
                  styles.day,
                  {
                    minHeight: theme.minTouchTarget,
                    borderRadius: theme.radii.md,
                    backgroundColor: isOn ? theme.colors.primary : theme.colors.transparent,
                    borderColor: isToday && !isOn ? theme.colors.primary : theme.colors.transparent,
                  },
                  pressed && !isPast && styles.pressed,
                ]}
              >
                <AppText
                  variant="title"
                  color={isOn ? 'textOnPrimary' : isPast ? 'textDisabled' : 'textPrimary'}
                >
                  {String(date.getDate())}
                </AppText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Seven to a row. A percentage, not a measured width, so it needs no layout
  // pass and cannot drift a pixel and push Saturday onto the next line.
  cell: { width: `${100 / 7}%`, padding: 2, justifyContent: 'center' },
  day: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  pressed: { transform: [{ scale: 0.95 }] },
});
