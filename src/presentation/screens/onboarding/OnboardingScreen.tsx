import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  IconTile,
  OnboardingStep,
  ScreenContainer,
  Spacer,
} from '@/presentation/components';
import { useUseCases } from '@/app/di';
import type { Person } from '@/domain/entities';
import { queryKeys } from '@/shared/constants/queryKeys';
import { EMPTY_DRAFT, toAnswers, type OnboardingDraft } from './draft';
import { visibleSteps } from './steps';

/**
 * The onboarding wizard.
 *
 * ONE screen for a dozen questions. What varies between them lives in
 * `steps.tsx`; what stays the same lives in `OnboardingStep`. The only state
 * here is the draft and where in the list we are.
 *
 * WHY NOTHING IS SAVED UNTIL THE END
 * Writing each answer as it is given would leave half-built profiles behind
 * every time somebody puts their phone down at question four, and nothing could
 * tell those apart from real members who have not filled much in. One write at
 * the end means a profile either exists and is usable or does not exist at all.
 * The cost is that abandoning loses the answers, which is the right trade for a
 * flow that takes two minutes.
 *
 * WHY THE DONE SCREEN DOES NOT NAVIGATE
 * There is nothing to navigate to. The navigator shows this wizard because the
 * profile is incomplete; the moment the finished profile lands in the query
 * cache, it shows the app instead and this component is unmounted. That is why
 * the cache write is deferred to the "Start looking" button — without the
 * delay, the congratulation screen would be replaced before it was read.
 */
export function OnboardingScreen(): React.JSX.Element {
  const { completeOnboarding, signOut } = useUseCases();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [index, setIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<Person | null>(null);

  // Recomputed from the draft, because the answer to "what brings you here"
  // adds or removes a later question. Holding a fixed list would either show a
  // step that no longer applies or skip one that now does.
  const steps = useMemo(() => visibleSteps(draft), [draft]);
  const step = steps[Math.min(index, steps.length - 1)];

  const patch = useCallback((update: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    // Any edit invalidates the complaint about the previous one.
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    const answers = toAnswers(draft);
    if (!answers) {
      // Only reachable if a step's `isAnswered` disagrees with `toAnswers` —
      // a configuration bug, not something a member can cause. Said plainly
      // rather than crashed on.
      setError('Something is still missing. Go back and check the earlier answers.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const result = await completeOnboarding.execute(answers);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      // A rejected field means the step that asked for it is the one to return
      // to. Sending somebody back to the start to find it is how a two-minute
      // flow becomes a five-minute one.
      const field = result.error.field;
      if (field) {
        const target = steps.findIndex((candidate) => candidate.key === FIELD_TO_STEP[field]);
        if (target >= 0) setIndex(target);
      }
      return;
    }

    setFinished(result.value);
  }, [draft, completeOnboarding, steps]);

  const onNext = useCallback(() => {
    if (index < steps.length - 1) {
      setIndex(index + 1);
      return;
    }
    void submit();
  }, [index, steps.length, submit]);

  const onBack = useCallback(() => setIndex((current) => Math.max(current - 1, 0)), []);

  /**
   * Back from the FIRST question leaves onboarding altogether.
   *
   * The member is signed in by now — verifying the email did that — so the
   * only way back to the sign-in and sign-up screens is to sign out. That is
   * said before it happens, along with the fact that nothing answered so far is
   * kept (see "WHY NOTHING IS SAVED UNTIL THE END"). Signing out does not
   * navigate: the auth gate swaps this wizard for the sign-in screen.
   */
  const onLeave = useCallback(() => {
    Alert.alert(
      'Back to sign in?',
      'You will be signed out, and your answers so far will not be saved. You can sign in again to finish later.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void signOut.execute(),
        },
      ],
    );
  }, [signOut]);

  if (finished) {
    return (
      <DoneScreen
        person={finished}
        onStart={() => {
          // Seeding the cache rather than invalidating it: the profile we hold
          // is the one the server just returned, so a refetch would be a round
          // trip to be told the same thing while the member watches a spinner.
          queryClient.setQueryData(queryKeys.profile.me(), finished);
        }}
      />
    );
  }

  if (!step) {
    // Unreachable — `visibleSteps` never returns an empty list — but typed for,
    // because a crash here would be the first screen a new member ever sees.
    return (
      <ScreenContainer testID="screen-onboarding">
        <AppText variant="body">Setting things up…</AppText>
      </ScreenContainer>
    );
  }

  const { Body } = step;

  return (
    <OnboardingStep
      key={step.key}
      current={index + 1}
      total={steps.length}
      icon={step.icon}
      question={step.question}
      {...(step.subtitle ? { subtitle: step.subtitle } : {})}
      {...(step.privacy ? { privacy: step.privacy } : {})}
      onBack={index > 0 ? onBack : onLeave}
      onNext={onNext}
      nextDisabled={!step.isAnswered(draft)}
      nextLoading={isSubmitting}
      {...(step.skippable ? { onSkip: onNext } : {})}
      error={error}
    >
      <Body draft={draft} patch={patch} />
    </OnboardingStep>
  );
}

/**
 * Which step to return to when the server rejects a field.
 *
 * Keyed by `AppError.field`, which `CompleteOnboarding` sets. A field missing
 * from this map simply leaves the member where they are with the message
 * showing, which is a reasonable fallback rather than a wrong jump.
 */
const FIELD_TO_STEP: Record<string, string> = {
  name: 'name',
  dateOfBirth: 'birthday',
  interests: 'interests',
  headline: 'headline',
  city: 'city',
};

/* ------------------------------------------------------------------ done -- */

function DoneScreen({
  person,
  onStart,
}: {
  person: Person;
  onStart: () => void;
}): React.JSX.Element {
  return (
    <ScreenContainer testID="screen-onboarding-done" edges={['top', 'bottom']} scrollable={false}>
      <View style={styles.done}>
        <IconTile name="checkmark-circle-outline" size={72} />
        <Spacer size={24} />
        {/* A hero moment, so the display serif — the only place in the
            wizard it appears (brief §3.5). */}
        <AppText variant="hero" align="center">
          {`You’re in, ${person.name.split(' ')[0]}`}
        </AppText>
        <Spacer size={12} />
        <AppText variant="body" color="textSecondary" align="center">
          Three people every morning, chosen for you. Like the ones you would actually meet — if it
          is mutual, you pick a café and we book the table.
        </AppText>
        <Spacer size={8} />
        <AppText variant="caption" color="textSecondary" align="center">
          Your profile goes to a moderator before anyone else sees it. That usually takes a few
          hours.
        </AppText>
      </View>

      <Button
        label="Start looking"
        size="lg"
        fullWidth
        onPress={onStart}
        testID="button-start-looking"
      />
      <Spacer size={16} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  done: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
