import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  IconTile,
  OnboardingStep,
  ScreenContainer,
  Spacer,
} from '@/presentation/components';
import { useUseCases } from '@/app/di';
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
import { useTheme } from '@/presentation/hooks/useTheme';
import { queryKeys } from '@/shared/constants/queryKeys';
import { draftFrom, type OnboardingDraft } from './draft';
import {
  backWhileEditing,
  branchOf,
  nextWhileEditing,
  progressAfterSaving,
  type Progress,
} from './progress';
import { visibleSteps } from './steps';

/**
 * The onboarding wizard.
 *
 * ONE screen for every question. What varies between them lives in
 * `steps.tsx`; what stays the same lives in `OnboardingStep`.
 *
 * WHY IT LOADS FIRST
 * Every step saves as it goes (see `SaveOnboardingStep`), so a member may be
 * coming back half-way through. The wizard is built from what the server
 * already has, and opens on the step after the last one saved.
 *
 * WHY THE DONE SCREEN DOES NOT NAVIGATE
 * There is nothing to navigate to. The navigator shows this wizard because the
 * profile is unfinished; the moment the finished profile lands in the query
 * cache it shows the app instead, and this component is unmounted. That is why
 * the cache write waits for the "Start looking" button — without the delay the
 * congratulation screen would be replaced before it was read.
 */
export function OnboardingScreen(): React.JSX.Element {
  const profile = useMyProfile();
  const details = useMyProfileDetails();
  const preferences = useMyPreferences();
  const photos = useMyPhotos();
  const { signOut } = useUseCases();

  const queries = [profile, details, preferences, photos];
  const failed = queries.find((query) => query.isError);

  if (failed) {
    return (
      <LoadProblem
        message={failed.error?.message ?? 'Your profile could not be loaded.'}
        onRetry={() => queries.forEach((query) => void query.refetch())}
        onSignOut={() => void signOut.execute()}
      />
    );
  }

  if (!profile.data || !details.data || !preferences.data) {
    return (
      <ScreenContainer testID="screen-onboarding-loading" scrollable={false}>
        <View style={styles.centre}>
          <ActivityIndicator />
          <Spacer size={12} />
          <AppText variant="body" color="textSecondary">
            Loading your profile…
          </AppText>
        </View>
      </ScreenContainer>
    );
  }

  return <Wizard person={profile.data} details={details.data} preferences={preferences.data} />;
}

/* ---------------------------------------------------------------- wizard -- */

/** Which step to show for a field the server or the use case rejected. */
const FIELD_TO_STEP: Record<string, string> = {
  purpose: 'purpose',
  name: 'name',
  lastName: 'name',
  dateOfBirth: 'birthday',
  gender: 'gender',
  pronouns: 'gender',
  city: 'location',
  hometown: 'location',
  languages: 'languages',
  occupationStatus: 'status',
  institution: 'education',
  degree: 'education',
  fieldOfStudy: 'education',
  graduationYear: 'education',
  studyYear: 'studies',
  previousEducation: 'studies',
  internship: 'studies',
  careerInterests: 'studies',
  skills: 'studies',
  occupation: 'work',
  jobTitle: 'work',
  company: 'work',
  industry: 'work',
  yearsExperience: 'work',
  workLocation: 'work',
  interests: 'interests',
  bio: 'intro',
  prompts: 'prompts',
  photos: 'photos',
  ageRange: 'preferences',
  relationshipGoal: 'datingGoal',
  partnerValues: 'datingMore',
  marriageTimeline: 'marriageBasics',
  maritalStatus: 'marriageBasics',
  cofounderRole: 'founderSide',
  founderSkills: 'founderSide',
  founderCommitment: 'founderSide',
  seekingSkills: 'founderSeeking',
  startupIndustries: 'founderSeeking',
};

/**
 * Where to start, and the draft to start with.
 *
 * Built from what the server has, then adjusted for two things the saved
 * answers alone cannot say:
 *
 * - The signup trigger gives every profile the city "Pune". Until the
 *   location step has been saved that is a default, not an answer, and is not
 *   shown as one.
 * - The guidelines agreement and the notification choice are not stored as
 *   answers of their own, so a member resuming past those steps is treated as
 *   having given them — they did, on the way past.
 */
function initialState(
  person: Person,
  details: ProfileDetails,
  preferences: Preferences,
): { draft: OnboardingDraft; index: number; progress: Progress } {
  const draft = draftFrom(person, details, preferences);
  const steps = visibleSteps(draft);
  const saved = details.onboardingStep
    ? steps.findIndex((step) => step.key === details.onboardingStep)
    : -1;
  const reached = (key: string): boolean => {
    const at = steps.findIndex((step) => step.key === key);
    return at >= 0 && saved >= at;
  };

  if (!reached('location')) draft.city = '';
  if (reached('guidelines')) draft.agreedToGuidelines = true;
  if (reached('notifications')) draft.pushEnabled = preferences.pushEnabled;

  return {
    draft,
    index: saved >= 0 ? Math.min(saved + 1, steps.length - 1) : 0,
    progress: {
      key: saved >= 0 ? (details.onboardingStep ?? null) : null,
      branch: branchOf(draft),
    },
  };
}

function Wizard({
  person,
  details,
  preferences,
}: {
  person: Person;
  details: ProfileDetails;
  preferences: Preferences;
}): React.JSX.Element {
  const { saveOnboardingStep, completeOnboarding, signOut } = useUseCases();
  const queryClient = useQueryClient();
  const photos = useMyPhotos();

  const [initial] = useState(() => initialState(person, details, preferences));
  const [draft, setDraft] = useState<OnboardingDraft>(initial.draft);
  const [index, setIndex] = useState(initial.index);
  const [progress, setProgress] = useState<Progress>(initial.progress);
  // True while a section is being edited from the preview: continue and back
  // stay inside that section, then return to the preview.
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<Person | null>(null);

  // Recomputed from the draft, because answers add and remove later questions
  // — the purpose decides "who would you like to meet" and the category
  // questions, the current status decides the student and work steps.
  const steps = useMemo(() => visibleSteps(draft), [draft]);
  const step = steps[Math.min(index, steps.length - 1)];
  const photoCount = usablePhotos(photos.data ?? []).length;

  const patch = useCallback((update: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...update }));
    // Any edit invalidates the complaint about the previous one.
    setError(null);
  }, []);

  const indexOf = useCallback(
    (key: string): number => steps.findIndex((candidate) => candidate.key === key),
    [steps],
  );

  const goTo = useCallback(
    (key: string) => {
      const target = indexOf(key);
      if (target < 0) return;
      setEditing(true);
      setError(null);
      setIndex(target);
    },
    [indexOf],
  );

  const showFieldError = useCallback(
    (message: string, field: string | undefined, fromPreview: boolean) => {
      setError(message);
      // A rejected field means the step that asked for it is the one to return
      // to. Sending somebody back to the start to find it is how a five-minute
      // flow becomes a fifteen-minute one. From the preview, the fix is an
      // edit like any other: that section, then back to the preview.
      const target = field ? indexOf(FIELD_TO_STEP[field] ?? '') : -1;
      if (target >= 0) {
        if (fromPreview) setEditing(true);
        setIndex(target);
      }
    },
    [indexOf],
  );

  const finish = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    // Checks what is saved, not this screen's draft — see CompleteOnboarding.
    const result = await completeOnboarding.execute();
    setIsSaving(false);

    if (!result.ok) {
      showFieldError(result.error.message, result.error.field, true);
      return;
    }

    setFinished(result.value);
  }, [completeOnboarding, showFieldError]);

  /** Saves this step, then moves on. `answersToo` is false for a skip. */
  const save = useCallback(
    async (answersToo: boolean) => {
      if (!step) return;
      if (step.key === 'preview') {
        await finish();
        return;
      }

      const next = progressAfterSaving(steps, index, draft, progress);

      setIsSaving(true);
      setError(null);
      const result = await saveOnboardingStep.execute({
        step: next.key ?? step.key,
        ...(answersToo && step.save ? step.save(draft) : {}),
      });
      setIsSaving(false);

      if (!result.ok) {
        showFieldError(result.error.message, result.error.field, false);
        return;
      }

      setProgress(next);

      // A new purpose brings questions the member has never seen, so editing
      // it from the preview carries on through the flow rather than jumping
      // back past them.
      const purposeChanged = step.key === 'purpose' && next.branch !== progress.branch;

      if (editing && !purposeChanged) {
        const target = nextWhileEditing(steps, index);
        if (steps[target]?.key === 'preview') setEditing(false);
        setIndex(target);
        return;
      }

      setEditing(false);
      setIndex(Math.min(index + 1, steps.length - 1));
    },
    [step, steps, index, draft, progress, editing, saveOnboardingStep, finish, showFieldError],
  );

  const onBack = useCallback(() => {
    setError(null);
    if (editing) {
      const target = backWhileEditing(steps, index);
      if (steps[target]?.key === 'preview') setEditing(false);
      setIndex(target);
      return;
    }
    setIndex((current) => Math.max(current - 1, 0));
  }, [editing, steps, index]);

  /**
   * Back from the FIRST question leaves onboarding altogether.
   *
   * The member is signed in by now — verifying the email did that — so the
   * only way back to the sign-in screen is to sign out. Nothing is lost by it:
   * every step already answered has been saved.
   */
  const onLeave = useCallback(() => {
    Alert.alert(
      'Back to sign in?',
      'You’ll be signed out. Everything you’ve answered is saved — sign in again to carry on where you left off.',
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
          void queryClient.invalidateQueries({ queryKey: queryKeys.profileDetails.all });
          void queryClient.invalidateQueries({ queryKey: queryKeys.preferences.all });
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
  const answered = step.isAnswered(draft, { photoCount });
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
      onBack={index > 0 ? onBack : onLeave}
      onNext={() => void save(true)}
      nextDisabled={!answered || isSaving}
      nextLoading={isSaving}
      {...(step.skippable && !editing ? { onSkip: () => void save(answered) } : {})}
      error={error}
    >
      <Body draft={draft} patch={patch} goTo={goTo} />
    </OnboardingStep>
  );
}

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
      <View style={styles.centre}>
        <IconTile name="checkmark-circle-outline" size={72} />
        <Spacer size={24} />
        <AppText variant="display" align="center">
          {`You’re in, ${person.name.split(' ')[0]}`}
        </AppText>
        <Spacer size={12} />
        <AppText variant="body" color="textSecondary" align="center">
          Your profile is saved. You can change any of it from your profile whenever you like.
        </AppText>
        <Spacer size={8} />
        <AppText variant="caption" color="textDisabled" align="center">
          A moderator looks at every profile before anyone else sees it. That usually takes a few
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

/* ----------------------------------------------------------- load failed -- */

function LoadProblem({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <ScreenContainer testID="screen-onboarding-error" edges={['top', 'bottom']} scrollable={false}>
      <View style={styles.centre}>
        <IconTile name="cloud-offline-outline" size={56} />
        <Spacer size={16} />
        <AppText variant="heading" align="center">
          We couldn’t load your profile
        </AppText>
        <Spacer size={8} />
        <AppText variant="body" color="textSecondary" align="center">
          {message}
        </AppText>
      </View>
      <View style={{ gap: theme.spacing[12] }}>
        <Button label="Try again" fullWidth onPress={onRetry} testID="button-retry" />
        <Button label="Sign out" variant="ghost" fullWidth onPress={onSignOut} />
      </View>
      <Spacer size={16} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
