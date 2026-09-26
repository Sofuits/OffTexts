import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Chip,
  ChipGroup,
  ChoiceRow,
  DateOfBirthField,
  InterestPicker,
  Spacer,
  TextField,
  VisibilityToggle,
} from '@/presentation/components';
import { useServices } from '@/app/di';
import { useTheme } from '@/presentation/hooks/useTheme';
import {
  GENDERS,
  GENDER_LABELS,
  GENDER_PLURAL_LABELS,
  MEET_INTENT_DESCRIPTIONS,
  MEET_INTENT_EMOJI,
  MEET_INTENT_LABELS,
  MIN_AGE,
  PREFERABLE_GENDERS,
  SELECTABLE_INTENTS,
  isRomanticIntent,
  type Gender,
} from '@/domain/entities';
import { ONBOARDING_LIMITS } from '@/domain/usecases';
import { SUGGESTED_CITIES, SUGGESTED_LANGUAGES, SUGGESTED_PRONOUNS } from '@/shared/constants/app';
import type { StepContext } from '../steps';

/* ---------------------------------------------------------------- welcome -- */

export function WelcomeBody(_props: StepContext): React.JSX.Element {
  const theme = useTheme();
  const points: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'time-outline', text: 'About five minutes. Most questions are a single tap.' },
    { icon: 'save-outline', text: 'Everything saves as you go. Stop any time and pick up here.' },
    { icon: 'eye-off-outline', text: 'Each step says who can see the answer. Some you can hide.' },
    { icon: 'create-outline', text: 'You can change any of it later from your profile.' },
  ];

  return (
    <View style={{ gap: theme.spacing[16] }}>
      {points.map((point) => (
        <View key={point.text} style={[styles.row, { gap: theme.spacing[12] }]}>
          <Ionicons name={point.icon} size={22} color={theme.colors.primary} />
          <AppText variant="body" color="textSecondary" style={styles.grow}>
            {point.text}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- purpose -- */

export function PurposeBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[12] }}>
      {SELECTABLE_INTENTS.map((intent) => (
        <ChoiceRow
          key={intent}
          label={`${MEET_INTENT_EMOJI[intent]}  ${MEET_INTENT_LABELS[intent]}`}
          description={MEET_INTENT_DESCRIPTIONS[intent]}
          selected={draft.purpose === intent}
          // Moving to co-founder clears who you want to meet: that question is
          // only asked for dating and life partner, and a co-founder search
          // carrying a gender filter from an abandoned answer would filter
          // people out for a reason nobody chose.
          onPress={() =>
            patch({
              purpose: intent,
              ...(isRomanticIntent(intent) ? {} : { interestedIn: [] }),
            })
          }
          testID={`choice-purpose-${intent}`}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------- name -- */

export function NameBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <>
      <TextField
        label="First name"
        value={draft.firstName}
        onChangeText={(firstName) => patch({ firstName })}
        placeholder="Saksham"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={ONBOARDING_LIMITS.name.max}
        textContentType="givenName"
        returnKeyType="next"
        testID="input-first-name"
      />
      <Spacer size={16} />
      <TextField
        label="Last name (optional)"
        value={draft.lastName}
        onChangeText={(lastName) => patch({ lastName })}
        placeholder="Kulkarni"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={ONBOARDING_LIMITS.lastName.max}
        textContentType="familyName"
        returnKeyType="done"
        testID="input-last-name"
      />
      {draft.lastName.trim() ? (
        <VisibilityToggle
          shown={draft.showLastName}
          onChange={(showLastName) => patch({ showLastName })}
          subject="your last name"
          testID="toggle-show-last-name"
        />
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- birthday -- */

export function BirthdayBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <DateOfBirthField
      value={draft.dateOfBirth}
      onChange={(dateOfBirth) => patch({ dateOfBirth })}
      minimumAge={MIN_AGE}
    />
  );
}

/* ----------------------------------------------------------------- gender -- */

export function GenderBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  return (
    <>
      <View style={{ gap: theme.spacing[12] }}>
        {GENDERS.map((gender) => (
          <ChoiceRow
            key={gender}
            label={GENDER_LABELS[gender]}
            selected={draft.gender === gender}
            onPress={() => patch({ gender })}
            testID={`choice-gender-${gender}`}
          />
        ))}
      </View>

      <Spacer size={24} />
      <TextField
        label="Pronouns (optional)"
        value={draft.pronouns}
        onChangeText={(pronouns) => patch({ pronouns })}
        placeholder="she/her"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={ONBOARDING_LIMITS.pronouns.max}
        testID="input-pronouns"
      />
      <Spacer size={8} />
      <ChipGroup>
        {SUGGESTED_PRONOUNS.map((pronouns) => (
          <Chip
            key={pronouns}
            label={pronouns}
            selected={draft.pronouns.trim() === pronouns}
            onPress={() => patch({ pronouns: draft.pronouns.trim() === pronouns ? '' : pronouns })}
            testID={`chip-pronouns-${pronouns}`}
          />
        ))}
      </ChipGroup>
    </>
  );
}

/* ----------------------------------------------------------- interestedIn -- */

export function InterestedInBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();

  const toggle = (gender: Gender): void => {
    const next = draft.interestedIn.includes(gender)
      ? draft.interestedIn.filter((value) => value !== gender)
      : [...draft.interestedIn, gender];
    patch({ interestedIn: next });
  };

  return (
    <View style={{ gap: theme.spacing[12] }}>
      {PREFERABLE_GENDERS.map((gender) => (
        <ChoiceRow
          key={gender}
          label={GENDER_PLURAL_LABELS[gender]}
          selected={draft.interestedIn.includes(gender)}
          onPress={() => toggle(gender)}
          mode="multiple"
          testID={`choice-interested-${gender}`}
        />
      ))}
      <AppText variant="caption" color="textDisabled">
        Pick as many as apply. You can change this later without anyone being told.
      </AppText>
    </View>
  );
}

/* --------------------------------------------------------------- location -- */

export function LocationBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  const { location } = useServices();
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const detect = async (): Promise<void> => {
    setDetectError(null);
    setDetecting(true);
    try {
      const found = await location.detectCity();
      if (found) patch({ city: found.city });
      else setDetectError('We couldn’t tell which city you’re in. Type it instead.');
    } catch (caught) {
      setDetectError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t find your location. Type your city.',
      );
    } finally {
      setDetecting(false);
    }
  };

  return (
    <>
      <TextField
        label="City you live in"
        value={draft.city}
        onChangeText={(city) => patch({ city })}
        placeholder="Pune"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={ONBOARDING_LIMITS.place.max}
        returnKeyType="done"
        testID="input-city"
      />

      {location.isAvailable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          onPress={() => void detect()}
          disabled={detecting}
          hitSlop={theme.hitSlop}
          style={({ pressed }) => [
            styles.row,
            { gap: theme.spacing[8], marginTop: theme.spacing[12] },
            pressed && styles.pressed,
          ]}
          testID="button-detect-city"
        >
          {detecting ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="navigate-outline" size={18} color={theme.colors.primary} />
          )}
          <AppText variant="label" color="primary">
            {detecting ? 'Finding your city…' : 'Use my current location'}
          </AppText>
        </Pressable>
      ) : null}

      {detectError ? (
        <AppText
          variant="caption"
          color="danger"
          style={{ marginTop: theme.spacing[8] }}
          testID="detect-city-error"
        >
          {detectError}
        </AppText>
      ) : null}

      <Spacer size={16} />
      <AppText variant="caption" color="textSecondary">
        Where we have cafés today
      </AppText>
      <Spacer size={8} />
      <ChipGroup>
        {SUGGESTED_CITIES.map((city) => (
          <Chip
            key={city}
            label={city}
            selected={draft.city.trim().toLowerCase() === city.toLowerCase()}
            onPress={() => patch({ city })}
            testID={`chip-city-${city}`}
          />
        ))}
      </ChipGroup>

      <Spacer size={32} />
      <TextField
        label="Hometown (optional)"
        value={draft.hometown}
        onChangeText={(hometown) => patch({ hometown })}
        placeholder="Nashik"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={ONBOARDING_LIMITS.place.max}
        testID="input-hometown"
      />
      {draft.hometown.trim() ? (
        <VisibilityToggle
          shown={draft.showHometown}
          onChange={(showHometown) => patch({ showHometown })}
          subject="your hometown"
          testID="toggle-show-hometown"
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------- languages -- */

export function LanguagesBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <InterestPicker
      selected={draft.languages}
      onChange={(languages) => patch({ languages })}
      min={0}
      max={ONBOARDING_LIMITS.languages.max}
      suggestions={SUGGESTED_LANGUAGES}
      customLabel="Another language"
      customPlaceholder="Konkani, French…"
      testIDPrefix="language"
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  pressed: { opacity: 0.6 },
});
