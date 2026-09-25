import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Avatar } from '@/presentation/components/common/Avatar';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { Match } from '@/domain/entities';
import { formatRelative } from '@/shared/utils/date';

export type MatchListItemProps = {
  match: Match;
  onPress: (match: Match) => void;
  testID?: string;
};

/**
 * One match, in the list above your meets.
 *
 * The line under the name is the only nudge there is. Offtexts has no chat, so
 * a match that nobody acts on simply sits there — and "Matched 6 days ago ·
 * nothing arranged yet" is the honest way to say that without pushing.
 *
 * `match.person` is always the other member. The domain guarantees it; see the
 * comment on `Match`.
 */
export function MatchListItem({ match, onPress, testID }: MatchListItemProps): React.JSX.Element {
  const theme = useTheme();

  const status =
    match.meetingCount === 0
      ? 'Nothing arranged yet'
      : match.meetingCount === 1
        ? 'One meet arranged'
        : `${match.meetingCount} meets arranged`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${match.person.name}. Matched ${formatRelative(match.matchedAt)}. ${status}.`}
      accessibilityHint="Opens their profile"
      onPress={() => onPress(match)}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.lg,
          padding: theme.spacing[16],
          gap: theme.spacing[12],
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Avatar name={match.person.name} uri={match.person.photoUrls[0]} size={48} />

      <View style={styles.body}>
        <AppText variant="title" numberOfLines={1}>
          {match.person.age ? `${match.person.name}, ${match.person.age}` : match.person.name}
        </AppText>
        <AppText
          variant="caption"
          color={match.meetingCount === 0 ? 'primary' : 'textSecondary'}
          numberOfLines={1}
          style={{ marginTop: theme.spacing[2] }}
        >
          {`Matched ${formatRelative(match.matchedAt)} · ${status}`}
        </AppText>
      </View>

      <Ionicons name="chevron-forward" size={20} color={theme.colors.textDisabled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1 },
  pressed: { opacity: 0.85 },
});
