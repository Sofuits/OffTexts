import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  IconTile,
  QueryBoundary,
  ScreenContainer,
  SelectionControl,
  Spacer,
} from '@/presentation/components';
import { bothFree, sharedDateRows, type OtherMemberDates } from '@/domain/entities';
import { useTheirDates } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { RootStackScreenProps } from '@/app/navigation/types';
import { fromDateKey, type DateKey } from '@/shared/utils/calendar';
import { formatDayAndDate } from '@/shared/utils/date';
import { PlaceholderNotice } from './PlaceholderNotice';

type Props = RootStackScreenProps<'AvailabilitySharedDates'>;

/**
 * Step 3: your dates and theirs, side by side.
 *
 * The You/Them table is the layout from `AvailabilitySharedDatesScreen.tsx` on
 * `feature/shared-availability-dates` (juiwaykole2005). What changed:
 *
 * - Their dates come from `DateSharingRepository`, not a constant of two days
 *   in October 2026 — which meant picking anything else left no overlap and no
 *   way on. The placeholder overlaps with whatever you picked, and says it is
 *   a placeholder.
 * - Rows are in date order, whatever order the days were tapped in.
 * - There is no choosing here. The old screen made you pick a row and then
 *   passed every common date on anyway; choosing is the next screen's job
 *   (scheduling-flow.md §1, steps 3 and 4), so this one only shows and edits.
 *
 * Your column stays editable. Their column is fetched once, with the dates you
 * arrived with, so it does not shift while you tick and untick yours.
 */
export function AvailabilitySharedDatesScreen({ navigation, route }: Props): React.JSX.Element {
  const theirs = useTheirDates(route.params.myDates);

  return (
    <ScreenContainer edges={['bottom']} testID="screen-availability-shared-dates">
      <Spacer size={16} />
      <AppText variant="heading">Shared availability</AppText>
      <Spacer size={8} />
      <AppText variant="body">See which dates work for both of you.</AppText>
      <Spacer size={20} />

      <QueryBoundary
        isLoading={theirs.isPending}
        error={theirs.error}
        data={theirs.data}
        onRetry={theirs.refetch}
        isEmpty={() => false}
      >
        {(other) => (
          <SharedTable
            initialMine={route.params.myDates}
            other={other}
            onContinue={(commonDates) =>
              navigation.navigate('AvailabilityChooseDate', { commonDates })
            }
          />
        )}
      </QueryBoundary>
      <Spacer size={16} />
    </ScreenContainer>
  );
}

function SharedTable({
  initialMine,
  other,
  onContinue,
}: {
  initialMine: DateKey[];
  other: OtherMemberDates;
  onContinue: (commonDates: DateKey[]) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const [mine, setMine] = useState<ReadonlySet<DateKey>>(() => new Set(initialMine));

  const rows = useMemo(() => sharedDateRows([...mine], other.dates), [mine, other.dates]);
  const common = bothFree(rows);

  const toggle = (day: DateKey): void =>
    setMine((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  return (
    <>
      {other.isPlaceholder ? (
        <>
          <PlaceholderNotice name={other.name} />
          <Spacer size={16} />
        </>
      ) : null}

      <View
        style={[
          styles.table,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <View
          style={[
            styles.row,
            { paddingHorizontal: theme.spacing[16], paddingVertical: theme.spacing[12] },
          ]}
        >
          <AppText variant="label" style={styles.dateColumn}>
            Date
          </AppText>
          <AppText variant="label" align="center" style={styles.markColumn}>
            You
          </AppText>
          <AppText
            variant="label"
            align="center"
            style={styles.markColumn}
            numberOfLines={1}
            testID="shared-their-name"
          >
            {other.name}
          </AppText>
        </View>

        {rows.map((row) => {
          const label = formatDayAndDate(fromDateKey(row.date));
          return (
            <View
              key={row.date}
              style={[
                styles.row,
                {
                  minHeight: theme.sizes.optionRow,
                  paddingHorizontal: theme.spacing[16],
                  borderTopWidth: StyleSheet.hairlineWidth * 2,
                  borderTopColor: theme.colors.border,
                  // Green row: both free (the mockups' "both available").
                  backgroundColor: row.both ? theme.colors.successTint : theme.colors.transparent,
                },
              ]}
              testID={`shared-row-${row.date}`}
            >
              <View style={styles.dateColumn}>
                <AppText variant="title">{label}</AppText>
                {row.both ? (
                  <AppText variant="caption" color="primary">
                    Both free
                  </AppText>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`You are free on ${label}`}
                accessibilityState={{ checked: row.mine }}
                onPress={() => toggle(row.date)}
                hitSlop={theme.hitSlop}
                style={[styles.markColumn, styles.centre, { minHeight: theme.minTouchTarget }]}
                testID={`shared-you-${row.date}`}
              >
                <SelectionControl mode="multiple" selected={row.mine} />
              </Pressable>

              <View
                style={[styles.markColumn, styles.centre]}
                accessible
                accessibilityLabel={`${other.name} is ${row.theirs ? 'free' : 'not free'} on ${label}`}
                testID={`shared-them-${row.date}`}
              >
                {row.theirs ? (
                  <IconTile name="checkmark" variant="plain" size={48} />
                ) : (
                  <AppText variant="body" color="textDisabled">
                    —
                  </AppText>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Spacer size={12} />
      <AppText variant="caption" testID="shared-summary">
        {common.length === 0
          ? 'No day works for both of you yet. Tick more of your own, or go back and add some.'
          : common.length === 1
            ? 'One day works for both of you.'
            : `${common.length} days work for both of you.`}
      </AppText>

      <Spacer size={24} />
      <Button
        label="Continue"
        size="lg"
        fullWidth
        disabled={common.length === 0}
        onPress={() => onContinue(common)}
        testID="button-shared-continue"
      />
    </>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  dateColumn: { flex: 1 },
  markColumn: { width: 72 },
  centre: { alignItems: 'center', justifyContent: 'center' },
});
