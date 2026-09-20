import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { Avatar } from '@/presentation/components/common/Avatar';
import { Badge } from '@/presentation/components/common/Badge';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { Person } from '@/domain/entities';
import { truncate } from '@/shared/utils/helpers';

export type ProfileCardProps = {
  person: Person;
  onPress?: (person: Person) => void;
  style?: ViewStyle;
  testID?: string;
};

/** One person in the Discover list. Tapping opens their full profile. */
export function ProfileCard({
  person,
  onPress,
  style,
  testID,
}: ProfileCardProps): React.JSX.Element {
  const theme = useTheme();

  const container: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    padding: theme.spacing[16],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${person.name}, ${person.headline}`}
      accessibilityHint="Opens this profile"
      disabled={!onPress}
      onPress={() => onPress?.(person)}
      testID={testID}
      style={({ pressed }) => [container, pressed && styles.pressed, style]}
    >
      <View style={styles.row}>
        <Avatar name={person.name} uri={person.photoUrls[0]} size={56} />

        <View style={[styles.body, { marginLeft: theme.spacing[16] }]}>
          <AppText variant="title" numberOfLines={1}>
            {person.age ? `${person.name}, ${person.age}` : person.name}
          </AppText>
          <AppText variant="caption" color="primary" style={{ marginTop: theme.spacing[2] }}>
            {person.city}
          </AppText>
        </View>
      </View>

      <AppText
        variant="body"
        color="textSecondary"
        numberOfLines={2}
        style={{ marginTop: theme.spacing[12] }}
      >
        {truncate(person.headline, 110)}
      </AppText>

      {person.interests.length > 0 ? (
        <View style={[styles.tags, { marginTop: theme.spacing[12], gap: theme.spacing[8] }]}>
          {person.interests.slice(0, 3).map((interest: string) => (
            <Badge key={interest} label={interest} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  pressed: { opacity: 0.85 },
});
