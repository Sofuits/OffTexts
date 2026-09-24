import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

export type PrivacyNoteProps = {
  /** One short sentence. Anything longer stops being read. */
  children: string;
  /**
   * `shown` for something other members will see, `hidden` for something they
   * will not. The icon is the whole point — an open eye and a crossed-out eye
   * are told apart before the sentence is read.
   */
  visibility: 'shown' | 'hidden';
  style?: ViewStyle;
};

/**
 * The line under an onboarding field that says who else sees the answer.
 *
 * Worth the space it takes. The questions this flow asks — birthday, gender,
 * who you want to meet — are ones people answer carefully or not at all, and
 * the difference is usually whether anybody told them where the answer goes.
 * Saying it at the moment of typing is what makes it believed; saying it in a
 * privacy policy is not.
 *
 * The sentence must be true. If the answer becomes visible later, this is the
 * line to change first.
 */
export function PrivacyNote({ children, visibility, style }: PrivacyNoteProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing[8] }, style]}>
      <Ionicons
        name={visibility === 'shown' ? 'eye-outline' : 'eye-off-outline'}
        size={16}
        color={theme.colors.textSecondary}
        // The sentence carries the meaning; the icon repeats it visually.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.icon}
      />
      <AppText variant="caption" color="textSecondary" style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  // Nudged down so the glyph's optical centre lines up with the first line of
  // text rather than with the line box.
  icon: { marginTop: 1 },
  text: { flex: 1 },
});
