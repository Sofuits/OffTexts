import {
  averageRating,
  DEFAULT_PREFERENCES,
  MAX_PHOTOS,
  type AuthState,
  type Candidate,
  type CandidateId,
  type CandidateSet,
  type DecisionKind,
  type DayKey,
  type DecisionOutcome,
  type Match,
  type MatchId,
  type OtherMemberDates,
  type Meet,
  type Person,
  type PersonId,
  type Photo,
  type Preferences,
  type PreferencesUpdate,
  type Review,
  type Session,
  type Venue,
} from '@/domain/entities';
import {
  AppError,
  failure,
  success,
  type AuthRepository,
  type Credentials,
  type DiscoverPage,
  type DiscoverQuery,
  type DiscoverRepository,
  type MatchingRepository,
  type MeetingRequest,
  type MeetRepository,
  type DateSharingRepository,
  type NewReview,
  type OAuthProvider,
  type PhotoRepository,
  type PreferencesRepository,
  type ProfileRepository,
  type ProfileUpdate,
  type Result,
  type ReviewRepository,
  type VenueRepository,
} from '@/domain/repositories';
import {
  SEED_MEETS,
  SEED_PEOPLE,
  SEED_REVIEWS,
  SEED_SESSION,
  SEED_VENUES,
} from '@/shared/constants/seedData';
import { fromDateKey, toDateKey } from '@/shared/utils/calendar';

/**
 * Repositories backed by seed data held in memory.
 *
 * These are not throwaway stubs — they are the default wiring when no Supabase
 * credentials are configured, and they earn their place three times over:
 *
 *   1. A new developer clones, installs, runs, and has a working app in two
 *      minutes without an account on anything.
 *   2. Tests get a real implementation of every interface with no mocking
 *      framework and no network.
 *   3. They are the proof the abstraction holds. If a screen ever stops working
 *      when these are swapped in, something above the data layer has reached
 *      for Supabase directly — which is exactly the mistake the architecture
 *      exists to prevent.
 *
 * Writes mutate the in-memory arrays, so the app behaves like a real one within
 * a session and forgets everything on restart.
 */

const LATENCY_MS = 220;

/** Fakes a round trip, so loading states are visible during development. */
const delay = (ms = LATENCY_MS): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class InMemoryProfileRepository implements ProfileRepository {
  private me: Person = clone(SEED_PEOPLE[0] as Person);
  private readonly people: Person[] = clone(SEED_PEOPLE);

  async getMyProfile(): Promise<Result<Person>> {
    await delay();
    return success(clone(this.me));
  }

  async getProfileById(id: string): Promise<Result<Person>> {
    await delay();
    const person = this.people.find((candidate) => candidate.id === id);
    if (!person) return failure(new AppError('notFound', 'That profile no longer exists.'));
    return success(clone(person));
  }

  async updateMyProfile(update: ProfileUpdate): Promise<Result<Person>> {
    await delay();
    this.me = { ...this.me, ...update };
    return success(clone(this.me));
  }
}

/* ============================================================== photos ===== */

export class InMemoryPhotoRepository implements PhotoRepository {
  private photos: Photo[] = [];

  async listMyPhotos(): Promise<Result<Photo[]>> {
    await delay();
    return success(clone(this.photos).sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async addPhoto(localUri: string): Promise<Result<Photo>> {
    await delay(600);

    if (this.photos.length >= MAX_PHOTOS) {
      return failure(
        new AppError('validation', `You can have ${MAX_PHOTOS} photos. Remove one to add another.`),
      );
    }

    const photo: Photo = {
      id: `photo-${Date.now()}`,
      // Echoing the local URI back is enough: <Image> renders a file:// URI, so
      // the whole flow can be demonstrated with no storage behind it.
      url: localUri,
      storagePath: `local/${Date.now()}`,
      sortOrder: this.photos.length + 1,
      // `pending`, like the real one. A fake that returned `approved` would hide
      // the moderation notice the screen is meant to show.
      moderation: 'pending',
    };

    this.photos = [...this.photos, photo];
    return success({ ...photo });
  }

  async removePhoto(id: string): Promise<Result<void>> {
    await delay();

    const exists = this.photos.some((photo) => photo.id === id);
    if (!exists) return failure(new AppError('notFound', 'That photo is already gone.'));

    this.photos = this.photos
      .filter((photo) => photo.id !== id)
      // Renumbered, exactly as the real repository does — a gap here would let
      // the grid fill the wrong slot and nobody would find out until Supabase
      // was wired in.
      .map((photo, index) => ({ ...photo, sortOrder: index + 1 }));

    return success(undefined);
  }

  async setPhotoOrder(ids: string[]): Promise<Result<void>> {
    await delay();

    const byId = new Map(this.photos.map((photo) => [photo.id, photo]));
    if (ids.some((id) => !byId.has(id))) {
      return failure(new AppError('forbidden', 'Some of those photos are not yours.'));
    }

    this.photos = ids.map((id, index) => ({
      ...(byId.get(id) as Photo),
      sortOrder: index + 1,
    }));

    return success(undefined);
  }
}

export class InMemoryDiscoverRepository implements DiscoverRepository {
  private readonly people: Person[] = clone(SEED_PEOPLE);

  async getSuggestions(query: DiscoverQuery = {}): Promise<Result<DiscoverPage>> {
    await delay();

    let people = this.people.filter((person) => person.verification === 'verified');

    if (query.city) {
      people = people.filter((person) => person.city === query.city);
    }
    if (query.intents?.length) {
      people = people.filter((person) =>
        person.intents.some((intent) => query.intents?.includes(intent)),
      );
    }

    return success({ people: clone(people.slice(0, query.limit ?? 20)), nextCursor: null });
  }
}

/**
 * What the fake meet repository needs to look up elsewhere.
 *
 * Passed in rather than imported, so the three fakes stay independent of each
 * other and the composition root is still the only place that knows how the
 * graph is wired. It also keeps this file free of a require cycle: matching
 * would otherwise have to import meets and meets import matching.
 */
export type InMemoryMeetLookups = {
  findMatch: (id: MatchId) => Match | null;
  findVenue: (id: string) => Venue | null;
};

/**
 * The default: nothing is bookable.
 *
 * Deliberately not "everything is bookable". A fake that succeeded without
 * being wired would let a broken composition root pass its tests, and the
 * failure would surface on a device instead.
 */
const NO_LOOKUPS: InMemoryMeetLookups = { findMatch: () => null, findVenue: () => null };

export class InMemoryMeetRepository implements MeetRepository {
  private meets: Meet[] = clone(SEED_MEETS).map((meet) => ({
    ...meet,
    scheduledFor: new Date(meet.scheduledFor),
  }));

  constructor(private readonly lookups: InMemoryMeetLookups = NO_LOOKUPS) {}

  async listMeets(): Promise<Result<Meet[]>> {
    await delay();
    return success(this.meets.map((meet) => ({ ...meet })));
  }

  async getMeetById(id: string): Promise<Result<Meet>> {
    await delay();
    const meet = this.meets.find((candidate) => candidate.id === id);
    if (!meet) return failure(new AppError('notFound', 'That meet no longer exists.'));
    return success({ ...meet });
  }

  async requestMeeting(request: MeetingRequest): Promise<Result<string>> {
    await delay(450);

    const match = this.lookups.findMatch(request.matchId);
    if (!match) {
      // The same refusal the database gives, and for the same reason: being in
      // the match is what grants the right to book.
      return failure(new AppError('forbidden', 'You do not have an active match with them.'));
    }

    const venue = this.lookups.findVenue(request.venueId);
    if (!venue) return failure(new AppError('notFound', 'That café is no longer bookable.'));

    const meet: Meet = {
      id: `meet-${Date.now()}`,
      personId: match.person.id,
      personName: match.person.name,
      ...(match.person.photoUrls[0] ? { personPhotoUrl: match.person.photoUrls[0] } : {}),
      venueName: venue.name,
      venueArea: venue.area,
      scheduledFor: request.scheduledFor,
      status: 'pending',
    };

    this.meets = [...this.meets, meet];
    return success(meet.id);
  }

  async cancelMeet(id: string): Promise<Result<Meet>> {
    await delay();
    const meet = this.meets.find((candidate) => candidate.id === id);
    if (!meet) return failure(new AppError('notFound', 'That meet no longer exists.'));

    meet.status = 'cancelled';
    return success({ ...meet });
  }
}

export class InMemoryReviewRepository implements ReviewRepository {
  private reviews: Review[] = clone(SEED_REVIEWS).map((review) => ({
    ...review,
    createdAt: new Date(review.createdAt),
  }));

  async listReviewsForMeet(meetId: string): Promise<Result<Review[]>> {
    await delay();
    return success(
      this.reviews.filter((review) => review.meetId === meetId).map((r) => ({ ...r })),
    );
  }

  async submitReview(input: NewReview): Promise<Result<Review>> {
    await delay(400);
    const review: Review = {
      id: `review-${Date.now()}`,
      meetId: input.meetId,
      authorId: SEED_SESSION.user.id,
      authorName: 'You',
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date(),
    };
    this.reviews = [...this.reviews, review];
    return success({ ...review });
  }

  /** Not on the interface — a convenience for demos and tests. */
  averageFor(meetId: string): number | null {
    return averageRating(this.reviews.filter((review) => review.meetId === meetId));
  }
}

/**
 * Auth with nobody really signed in.
 *
 * It starts SIGNED OUT, so the sign-in screen is the first thing a developer
 * sees and the whole gated flow is exercised without a backend. Any sign-in
 * attempt succeeds — which is precisely why this class must never be reachable
 * in a build that has Supabase configured. The composition root guarantees
 * that, and a test asserts it.
 *
 * The delay on `signInWithOAuth` stands in for the browser round trip, so the
 * button's loading state is visible during development instead of being a
 * frame long.
 */
export type InMemoryAuthOptions = {
  /**
   * Report an existing session from the moment the app starts.
   *
   * Default false, so the auth gate is exercised the way a real member meets
   * it. `env.devSkipAuth` turns it on to skip sign-in while the screens are
   * being built.
   *
   * Note where this lives: the bypass is a property of the fake backend, not a
   * branch in the navigator or the gate. Those stay exactly as they are and
   * simply believe what the repository tells them — which is the point of the
   * repository being an interface.
   */
  startSignedIn?: boolean;
};

export class InMemoryAuthRepository implements AuthRepository {
  private session: Session | null;
  private readonly listeners = new Set<(state: AuthState) => void>();

  constructor(options: InMemoryAuthOptions = {}) {
    this.session = options.startSignedIn ? SEED_SESSION : null;
  }

  private emit(): void {
    const state: AuthState = this.session
      ? { status: 'signedIn', session: this.session }
      : { status: 'signedOut' };
    this.listeners.forEach((listener) => listener(state));
  }

  async getSession(): Promise<Result<Session | null>> {
    return success(this.session);
  }

  observeAuthState(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    listener(
      this.session ? { status: 'signedIn', session: this.session } : { status: 'signedOut' },
    );
    return () => this.listeners.delete(listener);
  }

  async signInWithOAuth(_provider: OAuthProvider): Promise<Result<Session | null>> {
    await delay(700);
    this.session = SEED_SESSION;
    this.emit();
    return success(this.session);
  }

  async signInWithPassword(credentials: Credentials): Promise<Result<Session>> {
    await delay();
    this.session = { user: { ...SEED_SESSION.user, email: credentials.email } };
    this.emit();
    return success(this.session);
  }

  async signUpWithPassword(credentials: Credentials): Promise<Result<Session | null>> {
    return this.signInWithPassword(credentials);
  }

  async sendMagicLink(): Promise<Result<void>> {
    await delay();
    return success(undefined);
  }

  async sendPasswordReset(): Promise<Result<void>> {
    await delay();
    return success(undefined);
  }

  async signOut(): Promise<Result<void>> {
    await delay();
    this.session = null;
    this.emit();
    return success(undefined);
  }
}

/* =========================================================== matching ===== */

/**
 * The matching loop, in memory.
 *
 * Does the real thing rather than returning canned data: it keeps decisions,
 * works out reciprocity, and creates a match when both sides like each other.
 * That matters because it is the only way the screens can be built and tested
 * against the actual shape of the loop — a fake that always returns "matched"
 * would let a screen ship that never handles the ordinary case.
 *
 * The seeded reciprocal likes below are the one piece of theatre: without
 * somebody who already likes you, a match can never happen in a single-user
 * demo, and the match moment is the most important screen in the app to be
 * able to look at.
 */
export class InMemoryMatchingRepository implements MatchingRepository {
  /** What the signed-in member has decided, keyed by the other person's id. */
  private readonly decisions = new Map<PersonId, DecisionKind>();
  /** Who already likes the signed-in member. Seeded, because nobody else is here. */
  private readonly likesMe: Set<PersonId>;
  private readonly matches: Match[] = [];

  /** Everyone except the signed-in member — see the constructor. */
  private readonly people: Person[];

  constructor(
    people: Person[] = SEED_PEOPLE,
    /**
     * The signed-in member, who must never appear in their own set.
     *
     * `generate_candidates` excludes them in SQL, so a fake that did not would
     * put you in front of yourself — which is how the match screen ends up
     * showing the same face twice and nobody notices until it is on a device.
     */
    meId: PersonId | null = SEED_SESSION.user.profileId,
  ) {
    this.people = people.filter((person) => person.id !== meId);

    // The first and third of them like you back; the second does not. One of
    // each means every branch of the screen is reachable by tapping.
    this.likesMe = new Set(
      [this.people[0]?.id, this.people[2]?.id].filter((id): id is PersonId => Boolean(id)),
    );
  }

  async getTodaysCandidates(): Promise<Result<CandidateSet>> {
    await delay();

    const forDate = new Date().toISOString().slice(0, 10);
    const candidates: Candidate[] = this.people.slice(0, 3).map((person, index) => ({
      id: `candidate-${person.id}`,
      forDate,
      slot: index + 1,
      person,
      myDecision: this.decisions.get(person.id) ?? null,
    }));

    return success({ forDate, candidates });
  }

  async recordDecision(
    subjectId: PersonId,
    kind: DecisionKind,
    _candidateId?: CandidateId,
  ): Promise<Result<DecisionOutcome>> {
    await delay();

    this.decisions.set(subjectId, kind);

    if (kind !== 'like' || !this.likesMe.has(subjectId)) {
      return success({ kind, subjectId, match: null });
    }

    const existing = this.matches.find((match) => match.person.id === subjectId);
    if (existing) return success({ kind, subjectId, match: existing });

    const person = this.people.find((candidate) => candidate.id === subjectId);
    if (!person) return success({ kind, subjectId, match: null });

    const match: Match = {
      id: `match-${subjectId}`,
      person,
      matchedAt: new Date(),
      status: 'active',
      meetingCount: 0,
    };
    this.matches.push(match);

    return success({ kind, subjectId, match });
  }

  /**
   * Not part of `MatchingRepository`, and must not be.
   *
   * The composition root uses it to let the fake meet repository resolve a
   * match id into a person, which the real one does server-side inside
   * `api_v1.request_meeting`. Putting it on the interface would invite a screen
   * to read a match by id and skip the booking RPC entirely.
   */
  findMatch(id: MatchId): Match | null {
    return this.matches.find((match) => match.id === id) ?? null;
  }

  async listMatches(): Promise<Result<Match[]>> {
    await delay();
    return success(
      [...this.matches]
        .filter((match) => match.status === 'active')
        .sort((a, b) => b.matchedAt.getTime() - a.matchedAt.getTime()),
    );
  }

  async closeMatch(id: MatchId, reason?: string): Promise<Result<void>> {
    await delay();

    const match = this.matches.find((candidate) => candidate.id === id);
    if (!match) {
      return failure(new AppError('notFound', 'That match no longer exists.'));
    }

    match.status = 'closed';
    if (reason) void reason;
    return success(undefined);
  }
}

/* ============================================================== venues ===== */

export class InMemoryVenueRepository implements VenueRepository {
  private readonly venues: Venue[] = clone(SEED_VENUES);

  async listVenues(city?: string): Promise<Result<Venue[]>> {
    await delay();
    const wanted = city?.trim().toLowerCase();
    const venues = wanted
      ? this.venues.filter((venue) => venue.city.toLowerCase() === wanted)
      : this.venues;
    return success(clone(venues));
  }

  /** Fake-only, for the same reason as `InMemoryMatchingRepository.findMatch`. */
  findVenue(id: string): Venue | null {
    return this.venues.find((venue) => venue.id === id) ?? null;
  }
}

/* ======================================================== preferences ===== */

export class InMemoryPreferencesRepository implements PreferencesRepository {
  private preferences: Preferences = { ...DEFAULT_PREFERENCES };

  async getMyPreferences(): Promise<Result<Preferences>> {
    await delay();
    return success({ ...this.preferences });
  }

  async updateMyPreferences(update: PreferencesUpdate): Promise<Result<Preferences>> {
    await delay();

    // Spread rather than assign, so an absent key means "leave it alone" here
    // exactly as it does against the database. A fake that behaved differently
    // would hide a whole class of bug until the real backend was wired in.
    this.preferences = { ...this.preferences, ...update };
    return success({ ...this.preferences });
  }
}

/* ======================================================== date sharing ===== */

/**
 * A pretend second member, for the date-sharing screens. PLACEHOLDER.
 *
 * There is no backend for sharing dates yet (see `DateSharingRepository`), so
 * this invents the other member's dates from the ones you marked: every other
 * one of yours, which guarantees at least one day you are both free whatever
 * you picked, plus the day after your first and your last, so their column has
 * days of their own and yours has something to tick. It used to be two fixed
 * dates in October 2026, and picking anything else meant the flow could never
 * continue.
 *
 * Deterministic, so a test can say what it will answer. `isPlaceholder` is
 * always true, and the screens say so.
 */
export class InMemoryDateSharingRepository implements DateSharingRepository {
  constructor(private readonly name = 'Alex') {}

  async theirDates(mine: DayKey[]): Promise<Result<OtherMemberDates>> {
    await delay();

    const sorted = [...new Set(mine)].sort();
    const dayAfter = (key: DayKey): DayKey => {
      const date = fromDateKey(key);
      date.setDate(date.getDate() + 1);
      return toDateKey(date);
    };

    const theirs = new Set(sorted.filter((_, index) => index % 2 === 0));
    for (const edge of [sorted[0], sorted[sorted.length - 1]]) {
      if (edge !== undefined) theirs.add(dayAfter(edge));
    }

    return success({ name: this.name, dates: [...theirs].sort(), isPlaceholder: true });
  }
}
