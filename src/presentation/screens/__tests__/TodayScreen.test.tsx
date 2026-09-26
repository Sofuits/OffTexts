import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createTestContainer } from '@/app/di';
import { AppProviders, createTestQueryClient } from '@/app/providers';
import type { Candidate, DecisionKind, Match, Person, PersonId } from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type MatchingRepository,
  type Result,
} from '@/domain/repositories';
import { TodayScreen } from '@/presentation/screens';

/**
 * Today's three, and what happens when you answer.
 *
 * The decision path is the one worth testing carefully, because it is
 * optimistic: the card moves on before the server has replied. Two things must
 * hold — a failure has to put the card back, and a match must never be guessed.
 */

const TODAY = new Date().toISOString().slice(0, 10);

const person = (id: string, name: string): Person => ({
  id,
  name,
  age: 28,
  headline: `${name} would rather meet than message.`,
  city: 'Pune',
  photoUrls: [],
  interests: ['Coffee'],
  intents: ['dating'],
  verification: 'verified',
});

const candidate = (
  slot: number,
  subject: Person,
  decided: DecisionKind | null = null,
): Candidate => ({
  id: `candidate-${subject.id}`,
  forDate: TODAY,
  slot,
  person: subject,
  myDecision: decided,
});

const match = (subject: Person): Match => ({
  id: `match-${subject.id}`,
  person: subject,
  matchedAt: new Date(),
  status: 'active',
  meetingCount: 0,
});

const AANYA = person('p1', 'Aanya Rao');
const ROHAN = person('p2', 'Rohan Mehta');

/**
 * A matching repository that remembers what it was told.
 *
 * Stateful rather than returning a fixed list, and that is not gold-plating:
 * the decision is optimistic and `onSettled` refetches. A stub that kept
 * answering `myDecision: null` would overwrite the optimistic write on every
 * refetch and the card would spring back — which is exactly the bug this
 * screen would have against a server that did not persist, and exactly what a
 * fixed stub would hide.
 */
function matchingReturning(
  initial: Candidate[],
  onDecision: (subjectId: PersonId, kind: DecisionKind) => Result<Match | null> = () =>
    success(null),
): MatchingRepository {
  let candidates = initial;

  return {
    getTodaysCandidates: async () => success({ forDate: TODAY, candidates }),
    recordDecision: async (subjectId, kind) => {
      const outcome = onDecision(subjectId, kind);
      // A failure records nothing, so the next refetch still shows the
      // candidate as undecided — which is what makes the rollback assertable.
      if (!outcome.ok) return outcome;

      candidates = candidates.map((entry) =>
        entry.person.id === subjectId ? { ...entry, myDecision: kind } : entry,
      );
      return success({ kind, subjectId, match: outcome.value });
    },
    listMatches: async () => success([]),
    closeMatch: async () => success(undefined),
  };
}

const navigationProps = () =>
  ({
    navigation: { navigate: jest.fn() },
    route: { key: 'Today', name: 'Today', params: undefined },
  }) as unknown as React.ComponentProps<typeof TodayScreen>;

function renderWith(matching: MatchingRepository) {
  const container = createTestContainer({ repositories: { matching } });
  const props = navigationProps();

  return {
    props,
    ...render(
      <AppProviders container={container} queryClient={createTestQueryClient()}>
        <TodayScreen {...props} />
      </AppProviders>,
    ),
  };
}

describe('TodayScreen', () => {
  it('shows one candidate at a time, with the position', async () => {
    renderWith(matchingReturning([candidate(1, AANYA), candidate(2, ROHAN)]));

    expect(await screen.findByText('Aanya Rao, 28')).toBeTruthy();
    expect(screen.getByTestId('today-position').props.children).toBe('Person 1 of 2');
    // Three cards on one screen would be a list, and a list gets compared.
    expect(screen.queryByText('Rohan Mehta, 28')).toBeNull();
  });

  it('moves to the next person after a decision', async () => {
    renderWith(matchingReturning([candidate(1, AANYA), candidate(2, ROHAN)]));

    await screen.findByText('Aanya Rao, 28');
    fireEvent.press(screen.getByTestId('button-pass'));

    expect(await screen.findByText('Rohan Mehta, 28')).toBeTruthy();
  });

  it('skips people already decided on, so closing the app keeps your place', async () => {
    renderWith(matchingReturning([candidate(1, AANYA, 'like'), candidate(2, ROHAN)]));

    expect(await screen.findByText('Rohan Mehta, 28')).toBeTruthy();
    expect(screen.getByTestId('today-position').props.children).toBe('Person 2 of 2');
  });

  it('celebrates a match, and only when the server says there is one', async () => {
    renderWith(
      matchingReturning([candidate(1, AANYA), candidate(2, ROHAN)], (subjectId, kind) =>
        success(kind === 'like' && subjectId === AANYA.id ? match(AANYA) : null),
      ),
    );

    await screen.findByText('Aanya Rao, 28');
    fireEvent.press(screen.getByTestId('button-like'));

    expect(await screen.findByTestId('match-celebration')).toBeTruthy();
    expect(screen.getByText('You both said yes')).toBeTruthy();
  });

  it('says nothing when a like is not reciprocated', async () => {
    renderWith(matchingReturning([candidate(1, AANYA), candidate(2, ROHAN)]));

    await screen.findByText('Aanya Rao, 28');
    fireEvent.press(screen.getByTestId('button-like'));

    await screen.findByText('Rohan Mehta, 28');
    // No modal, no "they will be told", nothing. The other person is not told
    // either — that is the whole product.
    expect(screen.queryByTestId('match-celebration')).toBeNull();
  });

  it('puts the card back when the decision fails', async () => {
    renderWith(
      matchingReturning([candidate(1, AANYA), candidate(2, ROHAN)], () =>
        failure(new AppError('network', 'No connection.')),
      ),
    );

    await screen.findByText('Aanya Rao, 28');
    fireEvent.press(screen.getByTestId('button-like'));

    // The optimistic write is rolled back, so the same person is in front of
    // them again rather than the decision being silently lost.
    expect(await screen.findByTestId('today-error')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Aanya Rao, 28')).toBeTruthy());
  });

  it('says the set is finished rather than showing an empty screen', async () => {
    renderWith(matchingReturning([candidate(1, AANYA, 'like'), candidate(2, ROHAN, 'pass')]));

    expect(await screen.findByTestId('today-finished')).toBeTruthy();
    expect(screen.getByText('That’s today’s three')).toBeTruthy();
  });

  it('distinguishes nobody today from a finished set', async () => {
    renderWith(matchingReturning([]));

    expect(await screen.findByTestId('today-empty')).toBeTruthy();
    expect(screen.getByText('Nobody today')).toBeTruthy();
  });

  it('explains why an unverified member is not being shown to anyone', async () => {
    // The seeded in-memory profile is 'verified', so this asserts the notice is
    // absent there and present when it is not.
    renderWith(matchingReturning([candidate(1, AANYA)]));

    await screen.findByText('Aanya Rao, 28');
    await waitFor(() => expect(screen.queryByTestId('verification-notice')).toBeNull());
  });
});
