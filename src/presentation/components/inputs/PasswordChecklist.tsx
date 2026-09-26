import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { PasswordCheck } from '@/domain/usecases';
import { AppText } from '@/presentation/components/common/AppText';
import { useTheme } from '@/presentation/hooks/useTheme';

type Props = { checks: PasswordCheck[]; testID?: string };

/**
 * The password rules, ticked off as the member types.
 *
 * Every rule is visible from the start, so nobody finds out about the uppercase
 * letter only after submitting. The list comes from `passwordChecks`, the same
 * function that validates before sign-up, so the two cannot disagree.
 */
export function PasswordChecklist({ checks, testID }: Props): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={{ marginTop: theme.spacing[8], gap: theme.spacing[4] }} testID={testID}>
      {checks.map((check) => (
        <View key={check.id} style={styles.row} testID={`password-rule-${check.id}`}>
          <Ionicons
            name={check.met ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={check.met ? theme.colors.success : theme.colors.textDisabled}
            accessibilityLabel={check.met ? 'Met' : 'Not met yet'}
          />
          <AppText
            variant="caption"
            color={check.met ? 'textPrimary' : 'textSecondary'}
            style={{ marginLeft: theme.spacing[8] }}
          >
            {check.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
