import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ChoiceRow, InterestPicker, Spacer, TextField } from '@/presentation/components';
import { useTheme } from '@/presentation/hooks/useTheme';
import { PROFILE_PROMPTS, PROMPT_LABELS, type PromptKey } from '@/domain/entities';
import { ONBOARDING_LIMITS } from '@/domain/usecases';
import type { StepContext } from '../steps';

/* -------------------------------------------------------------- interests -- */

export function InterestsBody({ draft, patch }: StepContext): React.JSX.Element {
  return (
    <InterestPicker
      selected={draft.interests}
      onChange={(interests) => patch({ interests })}
      min={ONBOARDING_LIMITS.interests.min}
      max={ONBOARDING_LIMITS.interests.max}
    />
  );
}

/* ------------------------------------------------------------------ intro -- */

export function IntroBody({ draft, patch }: StepContext): React.JSX.Element {
  const remaining = ONBOARDING_LIMITS.intro.max - draft.bio.length;
  const short =
    draft.bio.trim().length > 0 && draft.bio.trim().length < ONBOARDING_LIMITS.intro.min;

  return (
    <>
      <TextField
        label="Introduce yourself"
        value={draft.bio}
        onChangeText={(bio) => patch({ bio })}
        placeholder="What you do, what you’re into, what a good Saturday looks like."
        multiline
        numberOfLines={6}
        maxLength={ONBOARDING_LIMITS.intro.max}
        autoCapitalize="sentences"
        error={
          short ? `A little more — at least ${ONBOARDING_LIMITS.intro.min} characters.` : undefined
        }
        hint={`${remaining} characters left`}
        testID="input-bio"
      />
      <Spacer size={24} />
      <TextField
        label="One line under your name (optional)"
        value={draft.headline}
        onChangeText={(headline) => patch({ headline })}
        placeholder="Would rather meet than message."
        maxLength={ONBOARDING_LIMITS.headline.max}
        autoCapitalize="sentences"
        hint="The first thing people read on your card."
        testID="input-headline"
      />
    </>
  );
}

/* ---------------------------------------------------------------- prompts -- */

/**
 * Up to three prompts, chosen by the member.
 *
 * Offered rather than required: two good answers beat five dutiful ones, and
 * a prompt answered because it was compulsory reads like it. The preview at
 * the end nudges anybody who skipped them.
 */
export function PromptsBody({ draft, patch }: StepContext): React.JSX.Element {
  const theme = useTheme();
  const chosen = new Set(draft.prompts.map((prompt) => prompt.key));
  const atMax = draft.prompts.length >= ONBOARDING_LIMITS.prompts.max;

  const add = (key: PromptKey): void => patch({ prompts: [...draft.prompts, { key, answer: '' }] });
  const remove = (key: PromptKey): void =>
    patch({ prompts: draft.prompts.filter((prompt) => prompt.key !== key) });
  const answer = (key: PromptKey, text: string): void =>
    patch({
      prompts: draft.prompts.map((prompt) =>
        prompt.key === key ? { ...prompt, answer: text } : prompt,
      ),
    });

  return (
    <>
      {draft.prompts.map((prompt) => (
        <View key={prompt.key} style={{ marginBottom: theme.spacing[20] }}>
          <View style={[styles.row, { gap: theme.spacing[8] }]}>
            <AppText variant="bodyStrong" style={styles.grow}>
              {PROMPT_LABELS[prompt.key]}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove “${PROMPT_LABELS[prompt.key]}”`}
              onPress={() => remove(prompt.key)}
              hitSlop={theme.hitSlop}
              testID={`button-remove-prompt-${prompt.key}`}
            >
              <Ionicons name="close-circle-outline" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <Spacer size={8} />
          <TextField
            label="Your answer"
            value={prompt.answer}
            onChangeText={(text) => answer(prompt.key, text)}
            multiline
            numberOfLines={3}
            maxLength={ONBOARDING_LIMITS.promptAnswer.max}
            autoCapitalize="sentences"
            hint={`${ONBOARDING_LIMITS.promptAnswer.max - prompt.answer.length} characters left`}
            testID={`input-prompt-${prompt.key}`}
          />
        </View>
      ))}

      {atMax ? (
        <AppText variant="caption" color="textDisabled">
          That’s three — the most a profile shows. Remove one to pick another.
        </AppText>
      ) : (
        <>
          <AppText variant="label" color="textSecondary">
            {draft.prompts.length === 0
              ? 'Pick two or three'
              : `Pick ${draft.prompts.length === 1 ? 'one or two more' : 'one more, if you like'}`}
          </AppText>
          <Spacer size={12} />
          <View style={{ gap: theme.spacing[12] }}>
            {PROFILE_PROMPTS.filter((key) => !chosen.has(key)).map((key) => (
              <ChoiceRow
                key={key}
                label={PROMPT_LABELS[key]}
                selected={false}
                mode="multiple"
                onPress={() => add(key)}
                testID={`choice-prompt-${key}`}
              />
            ))}
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
