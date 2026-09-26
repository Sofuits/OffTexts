import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/presentation/components/common/AppText';
import { CircleButton } from '@/presentation/components/onboarding/CircleButton';
import { IconTile } from '@/presentation/components/onboarding/IconTile';
import { PrivacyNote } from '@/presentation/components/onboarding/PrivacyNote';
import { ProgressDots } from '@/presentation/components/onboarding/ProgressDots';
import { useTheme } from '@/presentation/hooks/useTheme';

export type OnboardingStepProps = {
  /** 1-based. */
  current: number;
  total: number;
  icon: React.ComponentProps<typeof IconTile>['name'];
  /** The question, in the member's own words. Short enough to fit two lines. */
  question: string;
  subtitle?: string;
  /** One sentence about who sees the answer. Omit only when nothing is stored. */
  privacy?: { text: string; visibility: 'shown' | 'hidden' };
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  /** Renders a text link beside the next button. Only for genuinely optional steps. */
  onSkip?: () => void;
  skipLabel?: string;
  /** Shown above the footer, in danger colour. */
  error?: string | null;
  children: React.ReactNode;
};

/**
 * THE onboarding screen. There is one of these and a list of questions.
 *
 * Every step in the flow is the same shape — progress at the top, an icon, a
 * question, one input, a note about privacy, a round button bottom-right — so
 * building fifteen screens would have been building the same screen fifteen
 * times and then maintaining fifteen copies of it. What actually differs
 * between steps is a few lines of configuration and one input component, and
 * that is what `steps.tsx` holds.
 *
 * The layout is fixed on purpose. A member answering their eighth question
 * should not have to find the button again; by then their thumb already knows
 * where it is, and every step that moves it costs a little attention that was
 * meant for the answer.
 */
export function OnboardingStep({
  current,
  total,
  icon,
  question,
  subtitle,
  privacy,
  onBack,
  onNext,
  nextDisabled = false,
  nextLoading = false,
  onSkip,
  skipLabel = 'Skip',
  error,
  children,
}: OnboardingStepProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
      testID={`onboarding-step-${current}`}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        // iOS pushes the whole view; Android's windowSoftInputMode already
        // resizes it, and adding padding on top of that leaves a gap the height
        // of the keyboard.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[styles.header, { paddingHorizontal: theme.spacing[20], gap: theme.spacing[16] }]}
        >
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={onBack}
              hitSlop={theme.hitSlop}
              style={({ pressed }) => [pressed && styles.pressed]}
              testID="button-onboarding-back"
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </Pressable>
          ) : (
            // A spacer of exactly the arrow's width, so the progress bar sits
            // in the same place on the first step as on every other one.
            <View style={styles.backSpacer} />
          )}

          <ProgressDots current={current} total={total} />

          {/* Balances the arrow. Deliberately not an info button: there is
              nothing behind it yet, and a control that does nothing is worse
              than white space. */}
          <View style={styles.backSpacer} />
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing[20],
            paddingTop: theme.spacing[32],
            paddingBottom: theme.spacing[24],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <IconTile name={icon} />

          <AppText variant="heading" style={{ marginTop: theme.spacing[20] }}>
            {question}
          </AppText>

          {subtitle ? (
            <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing[8] }}>
              {subtitle}
            </AppText>
          ) : null}

          <View style={{ marginTop: theme.spacing[32] }}>{children}</View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: theme.spacing[20],
              paddingTop: theme.spacing[12],
              paddingBottom: theme.spacing[12],
              borderTopColor: theme.colors.border,
              gap: theme.spacing[16],
            },
          ]}
        >
          <View style={styles.footerText}>
            {error ? (
              <AppText variant="caption" color="danger" testID="onboarding-error">
                {error}
              </AppText>
            ) : privacy ? (
              <PrivacyNote visibility={privacy.visibility}>{privacy.text}</PrivacyNote>
            ) : null}
          </View>

          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={skipLabel}
              onPress={onSkip}
              hitSlop={theme.hitSlop}
              style={({ pressed }) => [pressed && styles.pressed]}
              testID="button-onboarding-skip"
            >
              <AppText variant="label" color="textSecondary">
                {skipLabel}
              </AppText>
            </Pressable>
          ) : null}

          <CircleButton
            icon="arrow-forward"
            accessibilityLabel="Continue"
            onPress={onNext}
            disabled={nextDisabled}
            loading={nextLoading}
            testID="button-onboarding-next"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', height: 44 },
  backSpacer: { width: 24 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
