import {
  averageRating,
  type AuthState,
  type Meet,
  type Person,
  type Review,
  type Session,
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
  type MeetRepository,
  type MeetRequest,
  type NewReview,
  type OAuthProvider,
  type ProfileRepository,
  type ProfileUpdate,
  type Result,
  type ReviewRepository,
} from '@/domain/repositories';
import { SEED_MEETS, SEED_PEOPLE, SEED_REVIEWS, SEED_SESSION } from '@/shared/constants/seedData';

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

  async uploadPhoto(localUri: string): Promise<Result<string>> {
    await delay(600);
    // Echoing the local URI back is enough: <Image> renders a file:// URI, so
    // the upload flow can be built and demonstrated before storage exists.
    return success(localUri);
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

export class InMemoryMeetRepository implements MeetRepository {
  private meets: Meet[] = clone(SEED_MEETS).map((meet) => ({
    ...meet,
    scheduledFor: new Date(meet.scheduledFor),
  }));

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

  async requestMeet(request: MeetRequest): Promise<Result<Meet>> {
    await delay(450);
    const slot = request.availableSlots[0];
    if (!slot) return failure(new AppError('validation', 'Choose a time.'));

    const meet: Meet = {
      id: `meet-${Date.now()}`,
      personId: request.personId,
      personName: SEED_PEOPLE.find((p) => p.id === request.personId)?.name ?? 'Member',
      venueName: 'To be confirmed',
      venueArea: 'Pune',
      scheduledFor: slot,
      status: 'pending',
    };

    this.meets = [...this.meets, meet];
    return success({ ...meet });
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
