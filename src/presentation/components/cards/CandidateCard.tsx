import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Badge } from '@/presentation/components/common/Badge';
import { useTheme } from '@/presentation/hooks/useTheme';
import { MEET_INTENT_LABELS, type Candidate } from '@/domain/entities';
import { getInitials } from '@/shared/utils/helpers';

export type CandidateCardProps = {
  candidate: Candidate;
  /** Opens the full profile. Omit to make the card inert. */
  onPress?: (candidate: Candidate) => void;
  style?: ViewStyle;
  testID?: string;
};

/**
 * One of today's three people.
 *
 * Deliberately not the small row used in Discover. Three people a day is not a
 * list to skim — it is three decisions, and a decision deserves a face at a
 * size you can actually read, the headline in full rather than truncated, and
 * enough of the interests to have something to say at the café.
 *
 * WHY NO SWIPING
 * The app has no gesture library, and adding one to get a swipe would be a
 * native dependency, a new build, and a gesture that is invisible to anyone
 * using a screen reader. Two large, labelled buttons do the same job, are
 * reachable one-handed, and can be described aloud. If swiping is added later
 * the buttons should stay.
 *
 * The photo falls back to initials rather than to a grey box. A member with no
 * photo yet is still a person with a name, and a blank tile makes them look
 * like a broken record.
 */
export function CandidateCard({
  candidate,
  onPress,
  style,
  testID,
}: CandidateCardProps): React.JSX.Element {
  const theme = useTheme();
  const { person } = candidate;
  const photo = person.photoUrls[0];

  const body = (
    <>
      <View
        style={[
          styles.photo,
          { backgroundColor: theme.colors.inset, borderRadius: theme.radii.xl },
        ]}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${person.name}'s photo`}
          />
        ) : (
          <View style={styles.centre}>
            <AppText variant="display" color="primary">
              {getInitials(person.name)}
            </AppText>
          </View>
        )}

        {/* A solid scrim rather than a gradient: there is no gradient library
            in the app, and a flat light band at 92% keeps ink text legible over
            any photo without one. */}
        <View
          style={[
            styles.scrim,
            { padding: theme.spacing[16], backgroundColor: theme.colors.scrim },
          ]}
        >
          <View style={styles.nameRow}>
            <AppText variant="subheading" numberOfLines={1} style={styles.name}>
              {person.age ? `${person.name}, ${person.age}` : person.name}
            </AppText>
            {person.verification === 'verified' ? (
              <Ionicons
                name="shield-checkmark"
                size={18}
                color={theme.colors.primary}
                accessibilityLabel="ID verified"
              />
            ) : null}
          </View>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {person.city}
          </AppText>
        </View>
      </View>

      <AppText variant="body" style={{ marginTop: theme.spacing[16] }}>
        {person.headline}
      </AppText>

      {person.bio ? (
        <AppText
          variant="body"
          color="textSecondary"
          numberOfLines={3}
          style={{ marginTop: theme.spacing[8] }}
        >
          {person.bio}
        </AppText>
      ) : null}

      {person.intents.length > 0 ? (
        <View style={[styles.tags, { marginTop: theme.spacing[16], gap: theme.spacing[8] }]}>
          {person.intents.map((intent) => (
            <Badge key={intent} label={MEET_INTENT_LABELS[intent]} tone="primary" />
          ))}
        </View>
      ) : null}

      {person.interests.length > 0 ? (
        <View style={[styles.tags, { marginTop: theme.spacing[8], gap: theme.spacing[8] }]}>
          {person.interests.slice(0, 6).map((interest) => (
            <Badge key={interest} label={interest} />
          ))}
        </View>
      ) : null}
    </>
  );

  const container: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing[12],
    ...theme.shadows.md,
  };

  if (!onPress) {
    return (
      <View style={[container, style]} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${person.name}. ${person.headline}`}
      accessibilityHint="Opens the full profile"
      onPress={() => onPress(candidate)}
      testID={testID}
      style={({ pressed }) => [container, pressed && styles.pressed, style]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 5, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  pressed: { opacity: 0.92 },
});
