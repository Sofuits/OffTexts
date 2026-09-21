import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

// Sibling files directly, never the barrel: components/index.ts imports this
// file, so importing it back creates a require cycle. Metro allows cycles but
// warns, and the failure when one bites is an undefined component at runtime
// with no useful stack.
import { AppText } from '@/presentation/components/common/AppText';
import { Avatar } from '@/presentation/components/common/Avatar';
import { Badge } from '@/presentation/components/common/Badge';
import { useTheme } from '@/presentation/hooks/useTheme';
import { isUpcoming, type Meet } from '@/domain/entities';
import { formatDayAndDate, formatRelative, formatTime } from '@/shared/utils/date';

export type MeetListItemProps = {
  meet: Meet;
  onPress: (meet: Meet) => void;
  testID?: string;
};

/**
 * One row in the Upcoming or History list.
 *
 * Local to this screen folder because nothing else renders a meet row yet. If a
 * second screen ever needs it, move it to `src/components/cards`.
 */
export function MeetListItem({ meet, onPress, testID }: MeetListItemProps): React.JSX.Element {
  const theme = useTheme();
  // The domain decides what counts as upcoming — see isUpcoming for why a
  // confirmed meet in the past is history.
  const upcoming = isUpcoming(meet);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meet.personName}, ${meet.venueName}, ${meet.venueArea}, ${formatDayAndDate(meet.scheduledFor)}`}
      accessibilityHint={upcoming ? 'Opens the meet details' : 'Opens ratings and reviews'}
      onPress={() => onPress(meet)}
      testID={testID}
      style={({ pressed }) => [
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.lg,
          padding: theme.spacing[16],
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          ...theme.shadows.sm,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <Avatar name={meet.personName} uri={meet.personPhotoUrl} size={48} />

        <View style={[styles.body, { marginLeft: theme.spacing[12] }]}>
          <AppText variant="title" numberOfLines={1}>
            {meet.personName}
          </AppText>
          <AppText
            variant="caption"
            color="textSecondary"
            numberOfLines={1}
            style={{ marginTop: theme.spacing[2] }}
          >
            {`${meet.venueName} · ${meet.venueArea}`}
          </AppText>
        </View>

        <Badge
          label={formatRelative(meet.scheduledFor)}
          tone={upcoming ? 'primary' : 'textSecondary'}
        />
      </View>

      <View
        style={[
          styles.footer,
          {
            marginTop: theme.spacing[12],
            paddingTop: theme.spacing[12],
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <AppText variant="label" color="textSecondary">
          {formatDayAndDate(meet.scheduledFor)}
        </AppText>
        <AppText variant="label" color={upcoming ? 'textPrimary' : 'textSecondary'}>
          {formatTime(meet.scheduledFor)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.85 },
});
