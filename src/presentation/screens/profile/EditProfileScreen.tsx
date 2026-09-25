import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  QueryBoundary,
  ScreenContainer,
  SectionHeader,
  Spacer,
  TextField,
} from '@/presentation/components';
import { MEET_INTENTS, MEET_INTENT_LABELS, type MeetIntent, type Person } from '@/domain/entities';
import type { ProfileUpdate } from '@/domain/repositories';
import { useMyProfile, useUpdateMyProfile } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
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
} as const;

type FormState = {
  name: string;
  age: string;
  headline: string;
  city: string;
  bio: string;
  intents: MeetIntent[];
};

type FieldErrors = Partial<Record<keyof Omit<FormState, 'intents'> | 'intents', string>>;

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
  const theme = useTheme();
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

      <View style={styles.chips}>
        {MEET_INTENTS.map((intent) => {
          const selected = form.intents.includes(intent);
          return (
            <Pressable
              key={intent}
              onPress={() => toggleIntent(intent)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={MEET_INTENT_LABELS[intent]}
              testID={`chip-${intent}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderRadius: theme.radii.full,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: selected ? theme.colors.primary : theme.colors.transparent,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <AppText variant="caption" color={selected ? 'textOnPrimary' : 'textSecondary'}>
                {MEET_INTENT_LABELS[intent]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {errorFor('intents') ? (
        <>
          <Spacer size={8} />
          <AppText variant="caption" color="danger" testID="error-intents">
            {errors.intents}
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

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1 },
});
