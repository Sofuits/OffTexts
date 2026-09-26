import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  OnboardingStep,
  ScreenContainer,
  Spacer,
  type ProfileSection,
} from '@/presentation/components';
import { useUseCases } from '@/app/di';
import type { RootStackScreenProps } from '@/app/navigation/types';
import {
  usablePhotos,
  type Person,
  type Preferences,
  type ProfileDetails,
} from '@/domain/entities';
import {
  useMyPhotos,
  useMyPreferences,
  useMyProfile,
  useMyProfileDetails,
} from '@/presentation/hooks';
import { queryKeys } from '@/shared/constants/queryKeys';
import { draftFrom, visibleSteps, type OnboardingDraft } from '@/presentation/screens/onboarding';

type Props = RootStackScreenProps<'EditProfileSection'>;

/**
 * Steps that are part of onboarding but not part of editing a profile.
 *
 * The birthday: once a moderator has checked a profile, the age on it is part
 * of what they checked, and changing it afterwards should go through support,
 * not a form. The purpose: members can hold several and change them in the
 * profile editor, where that choice already lives; the onboarding question
 * asks for exactly one and would quietly drop the others.
 */
const NOT_EDITABLE_HERE = new Set(['birthday', 'purpose']);

/**
 * One section of the profile, edited with the questions onboarding asked.
 *
 * The same step configuration as onboarding — same questions, same validation,
 * same save — rather than a second form that would drift from the first. What
 * differs is the frame: only the section's steps, back from the first one
 * closes the screen, and continue on the last one saves and closes.
 *
 * Saving goes through `SaveOnboardingStep` like every onboarding step, with
 * the member's onboarding progress passed through unchanged; a finished member
 * editing their lifestyle is not "at the lifestyle step".
 */
export function EditProfileSectionScreen({ route, navigation }: Props): React.JSX.Element {
  const { section } = route.params;
  const profile = useMyProfile();
  const details = useMyProfileDetails();
  const preferences = useMyPreferences();

  const failed = [profile, details, preferences].find((query) => query.isError);

  if (failed) {
    return (
      <ScreenContainer testID="screen-edit-section-error" scrollable={false}>
        <View style={styles.centre}>
          <AppText variant="heading" align="center">
            We couldn’t load your profile
          </AppText>
          <Spacer size={8} />
          <AppText variant="body" color="textSecondary" align="center">
            {failed.error?.message ?? 'Check your connection and try again.'}
          </AppText>
        </View>
        <Button
          label="Try again"
          fullWidth
          onPress={() => [profile, details, preferences].forEach((query) => void query.refetch())}
        />
        <Spacer size={12} />
        <Button label="Close" variant="ghost" fullWidth onPress={navigation.goBack} />
      </ScreenContainer>
    );
  }

  if (!profile.data || !details.data || !preferences.data) {
    return (
      <ScreenContainer testID="screen-edit-section-loading" scrollable={false}>
        <View style={styles.centre}>
          <ActivityIndicator />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <SectionEditor
      section={section}
      person={profile.data}
      details={details.data}
      preferences={preferences.data}
      onDone={navigation.goBack}
    />
  );
}

function SectionEditor({
  section,
  person,
  details,
  preferences,
  onDone,
}: {
  section: ProfileSection;
  person: Person;
  details: ProfileDetails;
  preferences: Preferences;
  onDone: () => void;
}): React.JSX.Element {
  const { saveOnboardingStep } = useUseCases();
  const queryClient = useQueryClient();
  const photos = useMyPhotos();

  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    draftFrom(person, details, preferences),
  );
  const [index, setIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomputed from the draft: changing the status inside "Education & work"
  // adds or removes the studies and work steps of that same section.
  const steps = useMemo(
    () =>
      visibleSteps(draft).filter(
        (step) => step.section === section && !NOT_EDITABLE_HERE.has(step.key),
      ),
    [draft, section],
  );
  const step = steps[Math.min(index, steps.length - 1)];
  const photoCount = usablePhotos(photos.data ?? []).length;

  const patch = useCallback((update: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (!step) return;

    setIsSaving(true);
    setError(null);
    const result = await saveOnboardingStep.execute({
      // Progress is left where it is. See the comment on the screen.
      step: details.onboardingStep ?? step.key,
      ...(step.save ? step.save(draft) : {}),
    });
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    if (index < steps.length - 1) {
      setIndex(index + 1);
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profileDetails.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences.all }),
      // Who a member is shown depends on some of these answers.
      queryClient.invalidateQueries({ queryKey: queryKeys.matching.all }),
    ]);
    onDone();
  }, [
    step,
    steps.length,
    index,
    draft,
    details.onboardingStep,
    saveOnboardingStep,
    queryClient,
    onDone,
  ]);

  const onBack = useCallback(() => {
    setError(null);
    // Back from the first step closes without saving that step, like any
    // other editor. Steps already continued past have been saved.
    if (index === 0) onDone();
    else setIndex(index - 1);
  }, [index, onDone]);

  if (!step) {
    // A section with nothing editable in it — a category section the member
    // is not here for, reached from a stale link. Nothing to do but leave.
    return (
      <ScreenContainer testID="screen-edit-section-empty" scrollable={false}>
        <View style={styles.centre}>
          <AppText variant="body" color="textSecondary" align="center">
            There is nothing to edit in this section.
          </AppText>
        </View>
        <Button label="Close" fullWidth onPress={onDone} />
      </ScreenContainer>
    );
  }

  const { Body } = step;
  const question = typeof step.question === 'function' ? step.question(draft) : step.question;
  const subtitle = typeof step.subtitle === 'function' ? step.subtitle(draft) : step.subtitle;

  return (
    <OnboardingStep
      key={step.key}
      current={index + 1}
      total={steps.length}
      icon={step.icon}
      section={step.section}
      question={question}
      {...(subtitle ? { subtitle } : {})}
      {...(step.privacy ? { privacy: step.privacy } : {})}
      onBack={onBack}
      onNext={() => void save()}
      nextDisabled={!step.isAnswered(draft, { photoCount }) || isSaving}
      nextLoading={isSaving}
      error={error}
    >
      {/* Editing one section: there is no other section to jump to. */}
      <Body draft={draft} patch={patch} goToSection={() => {}} />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
