import React, { useCallback, useMemo, useState } from 'react';

import {
  AppText,
  Button,
  Chip,
  ChipGroup,
  InterestPicker,
  QueryBoundary,
  ScreenContainer,
  SectionHeader,
  Spacer,
  TextField,
} from '@/presentation/components';
import {
  MEET_INTENT_LABELS,
  SELECTABLE_INTENTS,
  type MeetIntent,
  type Person,
} from '@/domain/entities';
import { ONBOARDING_LIMITS } from '@/domain/usecases';
import type { ProfileUpdate } from '@/domain/repositories';
import { useMyProfile, useUpdateMyProfile } from '@/presentation/hooks';
import type { RootStackScreenProps } from '@/app/navigation/types';

type Props = RootStackScreenProps<'EditProfile'>;

/**
 * Limits copied from the CHECK constraints in `supabase/migrations/0001`.
 *
 * They are duplicated here on purpose. The database is the guarantee — a caller
 * can reach PostgREST without going through this app — but a member should be
 * told their bio is too long while they are typing it, not after a round trip
 * that ends in a constraint violation they cannot read.
 *
 * If these ever disagree with the migration, the migration is right.
 */
const LIMITS = {
  name: { min: 2, max: 60 },
  headline: { max: 140 },
  bio: { max: 1000 },
  age: { min: 18, max: 120 },
  city: { max: 60 },
  // Shared with the onboarding wizard, so the two cannot disagree about how
  // many interests a profile needs.
  interests: ONBOARDING_LIMITS.interests,
} as const;

type FormState = {
  name: string;
  age: string;
  headline: string;
  city: string;
  bio: string;
  intents: MeetIntent[];
  interests: string[];
};

type FieldErrors = Partial<
  Record<keyof Omit<FormState, 'intents' | 'interests'> | 'intents' | 'interests', string>
>;

function toFormState(person: Person): FormState {
  return {
    name: person.name,
    // Age is optional in the domain and a string in the form, because a
    // TextInput has no concept of "absent". Empty string is the absent case.
    age: person.age === undefined ? '' : String(person.age),
    headline: person.headline,
    city: person.city,
    bio: person.bio ?? '',
    intents: person.intents,
    interests: person.interests,
  };
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  const city = form.city.trim();

  if (name.length < LIMITS.name.min) errors.name = 'Enter your full name.';
  else if (name.length > LIMITS.name.max) errors.name = `Keep it under ${LIMITS.name.max} letters.`;

  if (form.age.trim().length > 0) {
    const age = Number(form.age);
    if (!Number.isInteger(age)) errors.age = 'Enter your age in years.';
    else if (age < LIMITS.age.min) errors.age = 'Offtexts is 18 and over.';
    else if (age > LIMITS.age.max) errors.age = 'Enter a real age.';
  }

  if (form.headline.length > LIMITS.headline.max) {
    errors.headline = `${form.headline.length} of ${LIMITS.headline.max} characters.`;
  }

  if (city.length === 0) errors.city = 'Which city are you in?';

  if (form.bio.length > LIMITS.bio.max) {
    errors.bio = `${form.bio.length} of ${LIMITS.bio.max} characters.`;
  }

  if (form.intents.length === 0) errors.intents = 'Pick at least one reason to meet.';

  if (form.interests.length < LIMITS.interests.min) {
    errors.interests = `Pick at least ${LIMITS.interests.min} — it is what the first conversation starts from.`;
  } else if (form.interests.length > LIMITS.interests.max) {
    errors.interests = `Pick at most ${LIMITS.interests.max}.`;
  }

  return errors;
}

/**
 * Only what actually changed.
 *
 * Sending every field on every save would overwrite a column somebody else
 * changed between the read and the write, and it makes the update noisy to read
 * in the database logs. `ProfileUpdate` is a partial for exactly this reason.
 */
function toUpdate(form: FormState, original: Person): ProfileUpdate {
  const update: ProfileUpdate = {};
  const name = form.name.trim().replace(/\s+/g, ' ');
  const city = form.city.trim();
  const headline = form.headline.trim();
  const bio = form.bio.trim();
  const age = form.age.trim().length > 0 ? Number(form.age) : undefined;

  if (name !== original.name) update.name = name;
  if (city !== original.city) update.city = city;
  if (headline !== original.headline) update.headline = headline;
  if (bio !== (original.bio ?? '')) update.bio = bio;
  if (age !== original.age) update.age = age;

  const sameIntents =
    form.intents.length === original.intents.length &&
    form.intents.every((intent) => original.intents.includes(intent));
  if (!sameIntents) update.intents = form.intents;

  // Order matters here where it does not for intents: interests are shown in
  // the order they were chosen, so a reorder is a real change.
  const sameInterests =
    form.interests.length === original.interests.length &&
    form.interests.every((interest, index) => original.interests[index] === interest);
  if (!sameInterests) update.interests = form.interests;

  return update;
}

/** Tab 1 → Edit. The one screen in the app that writes to the database. */
export function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const profile = useMyProfile();

  return (
    <ScreenContainer testID="screen-edit-profile" edges={['bottom']}>
      <SectionHeader title="Edit profile" subtitle="Other members see this" />
      <Spacer size={20} />

      <QueryBoundary
        isLoading={profile.isPending}
        error={profile.error}
        data={profile.data}
        onRetry={profile.refetch}
        isEmpty={() => false}
      >
        {(person) => <EditProfileForm person={person} onDone={navigation.goBack} />}
      </QueryBoundary>
    </ScreenContainer>
  );
}

/**
 * Split out so the form's state is created from a profile that already exists.
 *
 * Doing it in the parent would mean initialising `useState` from `undefined`
 * and then syncing it in an effect when the query resolves — the usual source
 * of a form that flickers blank or quietly discards the member's first
 * keystrokes. Here the component simply does not exist until there is data.
 */
function EditProfileForm({
  person,
  onDone,
}: {
  person: Person;
  onDone: () => void;
}): React.JSX.Element {
  const update = useUpdateMyProfile();

  const [form, setForm] = useState<FormState>(() => toFormState(person));
  const [showErrors, setShowErrors] = useState(false);

  const errors = useMemo(() => validate(form), [form]);
  const pending = useMemo(() => toUpdate(form, person), [form, person]);
  const hasChanges = Object.keys(pending).length > 0;

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const toggleIntent = useCallback((intent: MeetIntent) => {
    setForm((current) => ({
      ...current,
      intents: current.intents.includes(intent)
        ? current.intents.filter((value) => value !== intent)
        : [...current.intents, intent],
    }));
  }, []);

  const onSave = useCallback(() => {
    if (Object.keys(errors).length > 0) {
      // Errors stay hidden until the first save attempt. Telling someone their
      // name is too short while they are still typing the second letter is
      // technically correct and reads as nagging.
      setShowErrors(true);
      return;
    }
    if (!hasChanges) {
      onDone();
      return;
    }
    update.mutate(pending, { onSuccess: onDone });
  }, [errors, hasChanges, pending, update, onDone]);

  const errorFor = (field: keyof FieldErrors): string | undefined =>
    showErrors ? errors[field] : undefined;

  return (
    <>
      <TextField
        label="Full name"
        value={form.name}
        onChangeText={(value) => set('name', value)}
        placeholder="As on your ID"
        maxLength={LIMITS.name.max}
        autoCapitalize="words"
        error={errorFor('name')}
        testID="input-name"
      />
      <Spacer size={16} />

      <TextField
        label="Age"
        value={form.age}
        onChangeText={(value) => set('age', value.replace(/[^0-9]/g, ''))}
        placeholder="Optional"
        keyboardType="number-pad"
        maxLength={3}
        error={errorFor('age')}
        hint="Shown on your profile. Leave blank to keep it private."
        testID="input-age"
      />
      <Spacer size={16} />

      <TextField
        label="Headline"
        value={form.headline}
        onChangeText={(value) => set('headline', value)}
        placeholder="One line about you"
        maxLength={LIMITS.headline.max}
        error={errorFor('headline')}
        hint={`${form.headline.length} / ${LIMITS.headline.max}`}
        testID="input-headline"
      />
      <Spacer size={16} />

      <TextField
        label="City"
        value={form.city}
        onChangeText={(value) => set('city', value)}
        placeholder="Pune"
        maxLength={LIMITS.city.max}
        autoCapitalize="words"
        error={errorFor('city')}
        testID="input-city"
      />
      <Spacer size={16} />

      <TextField
        label="About"
        value={form.bio}
        onChangeText={(value) => set('bio', value)}
        placeholder="A few sentences"
        multiline
        numberOfLines={5}
        maxLength={LIMITS.bio.max}
        error={errorFor('bio')}
        hint={`${form.bio.length} / ${LIMITS.bio.max}`}
        testID="input-bio"
      />

      <Spacer size={32} />
      <SectionHeader title="I want to meet people for" subtitle="Pick one or more" />
      <Spacer size={12} />

      <ChipGroup>
        {/* Networking is no longer offered, but a member who already has it
            still sees it so they can take it off. */}
        {[
          ...SELECTABLE_INTENTS,
          ...form.intents.filter(
            (intent) => !(SELECTABLE_INTENTS as readonly MeetIntent[]).includes(intent),
          ),
        ].map((intent) => (
          <Chip
            key={intent}
            label={MEET_INTENT_LABELS[intent]}
            selected={form.intents.includes(intent)}
            onPress={() => toggleIntent(intent)}
            testID={`chip-${intent}`}
          />
        ))}
      </ChipGroup>

      {errorFor('intents') ? (
        <>
          <Spacer size={8} />
          <AppText variant="caption" color="danger" testID="error-intents">
            {errors.intents}
          </AppText>
        </>
      ) : null}

      <Spacer size={32} />
      <SectionHeader
        title="What you are into"
        subtitle="Shown on your profile, and what the first ten minutes gets spent on"
      />
      <Spacer size={12} />
      <InterestPicker
        selected={form.interests}
        onChange={(interests) => set('interests', interests)}
        min={LIMITS.interests.min}
        max={LIMITS.interests.max}
      />

      {errorFor('interests') ? (
        <>
          <Spacer size={8} />
          <AppText variant="caption" color="danger" testID="error-interests">
            {errors.interests}
          </AppText>
        </>
      ) : null}

      {update.isError ? (
        <>
          <Spacer size={20} />
          <AppText variant="caption" color="danger" align="center" testID="error-save">
            {update.error instanceof Error
              ? update.error.message
              : 'Could not save. Check your connection and try again.'}
          </AppText>
        </>
      ) : null}

      <Spacer size={32} />
      <Button
        label={hasChanges ? 'Save changes' : 'Saved'}
        onPress={onSave}
        loading={update.isPending}
        disabled={update.isPending}
        fullWidth
        testID="button-save-profile"
      />
      <Spacer size={12} />
      <Button
        label="Cancel"
        variant="ghost"
        fullWidth
        onPress={onDone}
        disabled={update.isPending}
        testID="button-cancel-edit"
      />
    </>
  );
}
