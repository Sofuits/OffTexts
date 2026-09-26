import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Avatar } from '@/presentation/components/common/Avatar';
import { Button } from '@/presentation/components/buttons/Button';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { Match } from '@/domain/entities';

export type MatchCelebrationProps = {
  /** Null keeps the modal closed. Setting it opens it. */
  match: Match | null;
  /** The signed-in member, for the left-hand portrait. */
  me: { name: string; photoUrl?: string };
  onArrangeMeet: (match: Match) => void;
  onDismiss: () => void;
};

/**
 * The one moment in Offtexts worth celebrating.
 *
 * It exists because of what the app does not have. There is no chat, so nothing
 * arrives later to tell a member something happened — if the match is not shown
 * at the instant it is made, they find out by opening a list. This screen is
 * the notification.
 *
 * It offers to arrange a meet, because that is the only thing a match is for
 * here, and it offers to close, because the other two people in today's set are
 * still waiting and interrupting is not the same as demanding.
 */
export function MatchCelebration({
  match,
  me,
  onArrangeMeet,
  onDismiss,
}: MatchCelebrationProps): React.JSX.Element {
  const theme = useTheme();
  // `useState` with a lazy initialiser, not `useRef(...).current`. An
  // Animated.Value is created once and never replaced, which is what a ref is
  // for — but reading `.current` during a render is a rule violation and, in
  // concurrent rendering, genuinely unsound. State holds it just as stably.
  const [scale] = useState(() => new Animated.Value(0.9));

  useEffect(() => {
    if (!match) {
      scale.setValue(0.9);
      return;
    }
    Animated.spring(scale, {
      toValue: 1,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [match, scale]);

  return (
    <Modal
      visible={match !== null}
      transparent
      animationType="fade"
      // Android's hardware back must close it, or the member is trapped in a
      // celebration.
      onRequestClose={onDismiss}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onDismiss}
      >
        {match ? (
          <Animated.View
            // The inner card swallows the press, so tapping the card itself
            // does not dismiss what it is showing.
            onStartShouldSetResponder={() => true}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderRadius: theme.radii.xl,
                borderColor: theme.colors.borderStrong,
                padding: theme.spacing[32],
                transform: [{ scale }],
              },
            ]}
            testID="match-celebration"
          >
            <View style={styles.portraits}>
              <Avatar name={me.name} uri={me.photoUrl} size={84} />
              <Avatar
                name={match.person.name}
                uri={match.person.photoUrls[0]}
                size={84}
                // Overlapping portraits, with a ring in the card colour so the
                // two read as a pair rather than as one covering the other.
                style={{ marginLeft: -20, borderWidth: 3, borderColor: theme.colors.card }}
              />
            </View>

            <AppText variant="heading" align="center" style={{ marginTop: theme.spacing[24] }}>
              You both said yes
            </AppText>
            <AppText
              variant="body"
              color="textSecondary"
              align="center"
              style={{ marginTop: theme.spacing[8] }}
            >
              {`${match.person.name} wants to meet too. Pick a café and a time — there is no chat here, and that is the point.`}
            </AppText>

            <Button
              label="Arrange a meet"
              fullWidth
              size="lg"
              onPress={() => onArrangeMeet(match)}
              style={{ marginTop: theme.spacing[24] }}
              testID="button-arrange-meet"
            />
            <Button
              label="Later"
              variant="ghost"
              fullWidth
              onPress={onDismiss}
              style={{ marginTop: theme.spacing[8] }}
              testID="button-match-later"
            />
          </Animated.View>
        ) : (
          <View />
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  portraits: { flexDirection: 'row', alignItems: 'center' },
});
