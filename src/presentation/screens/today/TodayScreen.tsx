import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  CandidateCard,
  CircleButton,
  EmptyState,
  MatchCelebration,
  OfflineBanner,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  Spacer,
} from '@/presentation/components';
import { undecided, type Candidate, type DecisionKind, type Match } from '@/domain/entities';
import { useMyProfile, useRecordDecision, useTodaysCandidates } from '@/presentation/hooks';
import { useTheme } from '@/presentation/hooks/useTheme';
import type { BottomTabScreenPropsFor } from '@/app/navigation/types';
import { formatDayAndDate } from '@/shared/utils/date';

type Props = BottomTabScreenPropsFor<'Today'>;

/**
 * Tab 2 — today's three people. The screen the app exists for.
 *
 * ONE AT A TIME, NOT A LIST
 * Three cards on one screen would be a list, and a list gets compared: you look
 * at all three, rank them, and like the best one. That is not the product.
 * Offtexts asks a separate question three times — would you meet this person —
 * and showing them one at a time is what keeps it that question.
 *
 * WHY THE CARD DOES NOT DISAPPEAR ON A TAP
 * The decision is optimistic (see `useRecordDecision`), so the next card
 * arrives immediately. If the write then fails, the old one comes back rather
 * than the decision being silently lost — which is the failure mode of every
 * swipe deck that fires and forgets.
 *
 * WHAT IS NOT HERE
 * No "who liked you" count, no "you have 2 admirers", no nudge to upgrade for
 * either. The database will not answer that question — the policy on
 * `decisions` admits only their author — and the product is better for it.
 */
export function TodayScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const candidates = useTodaysCandidates();
  const profile = useMyProfile();
  const decide = useRecordDecision();

  const [celebrating, setCelebrating] = useState<Match | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const remaining = useMemo(
    () => (candidates.data ? undecided(candidates.data) : []),
    [candidates.data],
  );
  const current = remaining[0];
  const total = candidates.data?.candidates.length ?? 0;
  const answered = total - remaining.length;

  const onDecide = useCallback(
    (candidate: Candidate, kind: DecisionKind) => {
      setFailure(null);
      decide.mutate(
        { subjectId: candidate.person.id, kind, candidateId: candidate.id },
        {
          onSuccess: (outcome) => {
            // Only a like can produce one, and only the server knows. See the
            // comment on `useRecordDecision` for why this is never guessed.
            if (outcome.match) setCelebrating(outcome.match);
          },
          onError: (error) => setFailure(error.message),
        },
      );
    },
    [decide],
  );

  const openProfile = useCallback(
    (candidate: Candidate) =>
      navigation.navigate('PersonProfile', {
        personId: candidate.person.id,
        personName: candidate.person.name,
      }),
    [navigation],
  );

  const arrangeMeet = useCallback(
    (match: Match) => {
      setCelebrating(null);
      navigation.navigate('RequestMeet', {
        matchId: match.id,
        personName: match.person.name,
      });
    },
    [navigation],
  );

  const awaitingVerification =
    profile.data !== undefined && profile.data.verification !== 'verified';

  return (
    /*
       LAYOUT: a scrolling card, a pinned decision bar.

       The card does not fit on a phone — a 4:5 photo plus a headline, a bio and
       two rows of tags is taller than a 390x844 screen, and it should be: the
       point of three a day is that you get a proper look at each one.

       But the two buttons are the whole screen. Putting them at the end of the
       scroll meant that on every phone I measured, deciding required a scroll
       first — which turns a two-second judgement into a chore and, worse, means
       the first thing a member learns is that the app needs work to use. So the
       bar is pinned and the card scrolls behind it.
    */
    <ScreenContainer testID="screen-today" scrollable={false}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingBottom: theme.spacing[16] }}
        showsVerticalScrollIndicator={false}
      >
        <OfflineBanner />
        <ScreenHeader
          title="Today"
          subtitle={formatDayAndDate(new Date())}
          showLogo
          right={
            total > 0 ? (
              <Badge
                label={remaining.length === 0 ? 'All done' : `${remaining.length} left`}
                tone={remaining.length === 0 ? 'success' : 'primary'}
              />
            ) : undefined
          }
        />

        {awaitingVerification ? (
          <>
            <Spacer size={16} />
            <VerificationNotice status={profile.data.verification} />
          </>
        ) : null}

        <Spacer size={20} />

        <QueryBoundary
          isLoading={candidates.isPending}
          error={candidates.error}
          data={candidates.data}
          onRetry={candidates.refetch}
          // An empty set is a real answer, and it has its own words below rather
          // than the generic one — "nobody today" is not the same as "nothing
          // here yet".
          isEmpty={() => false}
        >
          {(set) => {
            if (set.candidates.length === 0) {
              return (
                <EmptyState
                  icon="moon-outline"
                  title="Nobody today"
                  body="We would rather show you no one than show you someone who is not worth the trip. Tomorrow morning there will be three."
                  testID="today-empty"
                />
              );
            }

            if (!current) {
              return (
                <EmptyState
                  icon="checkmark-done-outline"
                  title="That’s today’s three"
                  body="Three a day, chosen rather than scrolled. The next set lands tomorrow morning — anyone you liked is waiting on them."
                  actionLabel="See your matches"
                  onAction={() => navigation.navigate('ScheduledMeets')}
                  testID="today-finished"
                />
              );
            }

            return (
              <>
                <AppText variant="label" color="textSecondary" testID="today-position">
                  {`Person ${answered + 1} of ${total}`}
                </AppText>
                <Spacer size={12} />

                <CandidateCard
                  candidate={current}
                  onPress={openProfile}
                  testID={`card-candidate-${current.person.id}`}
                />
              </>
            );
          }}
        </QueryBoundary>
      </ScrollView>

      {current ? (
        <View
          style={[
            styles.bar,
            {
              paddingTop: theme.spacing[12],
              paddingBottom: theme.spacing[8],
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.actions, { gap: theme.spacing[32] }]}>
            <CircleButton
              icon="close"
              accessibilityLabel={`Pass on ${current.person.name}`}
              tone="muted"
              size={64}
              onPress={() => onDecide(current, 'pass')}
              disabled={decide.isPending}
              testID="button-pass"
            />
            <CircleButton
              icon="cafe"
              accessibilityLabel={`Like ${current.person.name}`}
              tone="primary"
              size={72}
              onPress={() => onDecide(current, 'like')}
              disabled={decide.isPending}
              testID="button-like"
            />
          </View>

          <Spacer size={12} />
          <AppText
            variant="caption"
            color={failure ? 'danger' : 'textSecondary'}
            align="center"
            testID={failure ? 'today-error' : undefined}
          >
            {failure ?? 'They are only told if you both say yes.'}
          </AppText>
        </View>
      ) : null}

      <MatchCelebration
        match={celebrating}
        me={{
          name: profile.data?.name ?? 'You',
          ...(profile.data?.photoUrls[0] ? { photoUrl: profile.data.photoUrls[0] } : {}),
        }}
        onArrangeMeet={arrangeMeet}
        onDismiss={() => setCelebrating(null)}
      />
    </ScreenContainer>
  );
}

/**
 * Shown until a moderator has looked at the profile.
 *
 * It matters here rather than only on the profile tab, because it explains
 * something the member would otherwise experience as a bug: they can see three
 * people, and those three cannot see them. The candidate rules only pick
 * verified members, so an unverified profile is a spectator.
 */
function VerificationNotice({ status }: { status: string }): React.JSX.Element {
  const theme = useTheme();
  const rejected = status === 'rejected';

  return (
    <View
      style={[
        styles.notice,
        {
          borderRadius: theme.radii.lg,
          borderColor: rejected ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.inset,
          padding: theme.spacing[16],
          gap: theme.spacing[12],
        },
      ]}
      testID="verification-notice"
    >
      <Ionicons
        name={rejected ? 'alert-circle-outline' : 'time-outline'}
        size={20}
        color={rejected ? theme.colors.danger : theme.colors.warning}
      />
      <View style={styles.noticeText}>
        <AppText variant="label">
          {rejected ? 'Your profile needs another look' : 'Your profile is with a moderator'}
        </AppText>
        <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing[2] }}>
          {rejected
            ? 'Something on it did not pass our checks. Edit it and it goes back into the queue.'
            : 'You can look at today’s three now. Other members will see you once it has been checked, which usually takes a few hours.'}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth },
  noticeText: { flex: 1 },
});
