import {
  InMemoryAuthRepository,
  InMemoryDiscoverRepository,
  InMemoryMatchingRepository,
  InMemoryMeetRepository,
  InMemoryPhotoRepository,
  InMemoryPreferencesRepository,
  InMemoryProfileRepository,
  InMemoryReviewRepository,
  InMemoryVenueRepository,
  SupabaseAuthRepository,
  SupabaseDiscoverRepository,
  SupabaseMatchingRepository,
  SupabaseMeetRepository,
  SupabasePhotoRepository,
  SupabasePreferencesRepository,
  SupabaseProfileRepository,
  SupabaseReviewRepository,
  SupabaseVenueRepository,
} from '@/data/repositories';
import { MeetLocalDataSource, ProfileLocalDataSource } from '@/data/datasources/local';
import type {
  AuthRepository,
  DiscoverRepository,
  MatchingRepository,
  MeetRepository,
  PhotoRepository,
  PreferencesRepository,
  ProfileRepository,
  ReviewRepository,
  VenueRepository,
} from '@/domain/repositories';
import {
  CompleteOnboarding,
  GetScheduledMeets,
  RequestMeet,
  RequestPasswordReset,
  PASSWORD_REQUIREMENTS,
  type PasswordRequirement,
  ResendVerificationCode,
  SignIn,
  SignInWithGoogle,
  SignOut,
  SignUp,
  SubmitReview,
  UpdatePassword,
  VerifyEmail,
} from '@/domain/usecases';
import { NoopAnalytics, type Analytics } from '@/infrastructure/analytics';
import { ConsoleLogger, SentryLogger, type Logger } from '@/infrastructure/logging';
import {
  ExpoImagePicker,
  UnavailableImagePicker,
  type ImagePickerService,
} from '@/infrastructure/media';
import {
  AlwaysOnlineMonitor,
  NetInfoConnectivityMonitor,
  type ConnectivityMonitor,
} from '@/infrastructure/network';
import { NoopNotificationService, type NotificationService } from '@/infrastructure/notifications';
import {
  AsyncStorageStore,
  InMemoryStore,
  SecureKeyValueStore,
  type KeyValueStore,
} from '@/infrastructure/storage';
import {
  bridgeSupabaseToAppState,
  createSupabaseClient,
  passwordResetRedirect,
  runOAuthFlow,
  type TypedSupabaseClient,
} from '@/infrastructure/supabase';
import { env } from '@/shared/config';
import { KEYS_TO_CLEAR_ON_SIGN_OUT } from '@/shared/constants/storageKeys';

/**
 * THE COMPOSITION ROOT.
 *
 * This is the one place that knows which concrete class satisfies which
 * interface. Everything else receives what it needs through a constructor or a
 * hook and never learns the difference.
 *
 * That is what makes the Supabase swap real rather than aspirational: replacing
 * it with a NestJS or Go backend means writing five new repository classes and
 * changing the five lines below. No screen, no hook, no use case is touched.
 *
 * It is also why the app runs today with no backend at all. When
 * `env.hasSupabase` is false, the in-memory repositories are wired instead —
 * same interfaces, same behaviour from the UI's point of view.
 */

export type Container = {
  /** Interfaces, never concrete types. Changing this to a class is the mistake. */
  repositories: {
    auth: AuthRepository;
    profile: ProfileRepository;
    discover: DiscoverRepository;
    matching: MatchingRepository;
    meets: MeetRepository;
    photos: PhotoRepository;
    preferences: PreferencesRepository;
    reviews: ReviewRepository;
    venues: VenueRepository;
  };
  useCases: {
    signIn: SignIn;
    signUp: SignUp;
    verifyEmail: VerifyEmail;
    resendVerificationCode: ResendVerificationCode;
    requestPasswordReset: RequestPasswordReset;
    updatePassword: UpdatePassword;
    signInWithGoogle: SignInWithGoogle;
    signOut: SignOut;
    completeOnboarding: CompleteOnboarding;
    getScheduledMeets: GetScheduledMeets;
    requestMeet: RequestMeet;
    submitReview: SubmitReview;
  };
  services: {
    logger: Logger;
    analytics: Analytics;
    notifications: NotificationService;
    imagePicker: ImagePickerService;
    connectivity: ConnectivityMonitor;
    secureStore: KeyValueStore;
    store: KeyValueStore;
  };
  /** Which backend was wired. For a debug screen and for tests. */
  backend: 'supabase' | 'in-memory';
  /** The password rules the forms show, from the Supabase setting. */
  passwordRequirement: PasswordRequirement;
  /** Stops anything long-lived the container started. Call on teardown. */
  dispose: () => void;
};

export type ContainerOverrides = {
  /** Replace any part of the graph. Tests use this; production never does. */
  repositories?: Partial<Container['repositories']>;
  services?: Partial<Container['services']>;
  /** Force a backend regardless of configuration. */
  forceBackend?: 'supabase' | 'in-memory';
};

/**
 * The Supabase "Password requirements" setting from config, checked against
 * the values Supabase actually has. An unrecognised value is logged and treated
 * as "no required characters" — the server still enforces its real setting, so
 * the cost of a typo is a less helpful form, not a weaker password.
 */
function readPasswordRequirement(logger: Logger): PasswordRequirement {
  const value = env.authPasswordRequirements;
  if (!value) return null;
  const known = PASSWORD_REQUIREMENTS.find((requirement) => requirement === value);
  if (known) return known;
  logger.warn('EXPO_PUBLIC_AUTH_PASSWORD_REQUIREMENTS is not a value Supabase uses; ignoring it.', {
    value,
    allowed: PASSWORD_REQUIREMENTS,
  });
  return null;
}

function buildLogger(): Logger {
  const console = new ConsoleLogger();
  return env.sentryDsn ? new SentryLogger(env.sentryDsn, console) : console;
}

function buildSupabaseRepositories(
  client: TypedSupabaseClient,
  logger: Logger,
  connectivity: ConnectivityMonitor,
  store: KeyValueStore,
): Container['repositories'] {
  const profileCache = new ProfileLocalDataSource(store, logger);
  const meetCache = new MeetLocalDataSource(store, logger);

  return {
    // The browser flow is handed in here, not imported by the repository —
    // that is what keeps `data/` loadable outside React Native.
    auth: new SupabaseAuthRepository(client, logger, runOAuthFlow, passwordResetRedirect()),
    profile: new SupabaseProfileRepository(client, profileCache, connectivity, logger),
    discover: new SupabaseDiscoverRepository(client),
    matching: new SupabaseMatchingRepository(client),
    meets: new SupabaseMeetRepository(client, meetCache, connectivity, logger),
    photos: new SupabasePhotoRepository(client),
    preferences: new SupabasePreferencesRepository(client),
    reviews: new SupabaseReviewRepository(client),
    venues: new SupabaseVenueRepository(client),
  };
}

function buildInMemoryRepositories(startSignedIn = false): Container['repositories'] {
  // Matching and venues are built first because the fake meet repository needs
  // to resolve a match id and a venue id the way the real one does server-side
  // inside `api_v1.request_meeting`. The lookups are passed in rather than
  // imported, so the fakes do not depend on one another — this function stays
  // the only place that knows how they connect.
  const matching = new InMemoryMatchingRepository();
  const venues = new InMemoryVenueRepository();

  return {
    auth: new InMemoryAuthRepository({ startSignedIn }),
    profile: new InMemoryProfileRepository(),
    discover: new InMemoryDiscoverRepository(),
    matching,
    meets: new InMemoryMeetRepository({
      findMatch: (id) => matching.findMatch(id),
      findVenue: (id) => venues.findVenue(id),
    }),
    photos: new InMemoryPhotoRepository(),
    preferences: new InMemoryPreferencesRepository(),
    reviews: new InMemoryReviewRepository(),
    venues,
  };
}

export function createContainer(overrides: ContainerOverrides = {}): Container {
  const logger = overrides.services?.logger ?? buildLogger();
  const analytics = overrides.services?.analytics ?? new NoopAnalytics();
  const notifications = overrides.services?.notifications ?? new NoopNotificationService();
  const imagePicker = overrides.services?.imagePicker ?? new ExpoImagePicker();
  const connectivity = overrides.services?.connectivity ?? new NetInfoConnectivityMonitor();
  const secureStore = overrides.services?.secureStore ?? new SecureKeyValueStore(logger);
  const store = overrides.services?.store ?? new AsyncStorageStore(logger);

  // `devSkipAuth` forces in-memory even when Supabase is configured. A fake
  // session cannot satisfy Row Level Security, so pointing it at the real
  // database would return zero rows from every table — see env.devSkipAuth.
  const backend =
    overrides.forceBackend ??
    (env.hasSupabase && !env.devSkipAuth ? ('supabase' as const) : ('in-memory' as const));

  const teardown: (() => void)[] = [];
  let repositories: Container['repositories'];

  if (backend === 'supabase') {
    const client = createSupabaseClient({
      url: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      // The session holds a refresh token, so it belongs in the keychain.
      storage: secureStore,
      logger,
      environment: env.environment,
    });
    // Without this, the session can expire while the app is backgrounded.
    teardown.push(bridgeSupabaseToAppState(client));
    repositories = buildSupabaseRepositories(client, logger, connectivity, store);
  } else if (env.devSkipAuth) {
    // Loud on purpose. The cost of this flag is someone spending an afternoon
    // wondering why their writes never reach the database.
    logger.warn(
      'DEV_SKIP_AUTH is on: starting signed in against in-memory data. ' +
        'Nothing is read from or written to Supabase. Unset EXPO_PUBLIC_DEV_SKIP_AUTH to use the real backend.',
    );
    repositories = buildInMemoryRepositories(true);
  } else {
    logger.info('No Supabase configuration found; using in-memory repositories.');
    repositories = buildInMemoryRepositories();
  }

  repositories = { ...repositories, ...overrides.repositories };
  const passwordRequirement = readPasswordRequirement(logger);

  return {
    repositories,
    useCases: {
      signIn: new SignIn(repositories.auth),
      signUp: new SignUp(repositories.auth, passwordRequirement),
      verifyEmail: new VerifyEmail(repositories.auth),
      resendVerificationCode: new ResendVerificationCode(repositories.auth),
      requestPasswordReset: new RequestPasswordReset(repositories.auth),
      updatePassword: new UpdatePassword(repositories.auth, passwordRequirement),
      signInWithGoogle: new SignInWithGoogle(repositories.auth),
      // Signing out must also drop whatever the previous member left on disk,
      // or the next person to sign in on this phone sees their cached profile.
      signOut: new SignOut(repositories.auth, async () => {
        await Promise.all(KEYS_TO_CLEAR_ON_SIGN_OUT.map((key) => store.removeItem(key)));
      }),
      completeOnboarding: new CompleteOnboarding(repositories.profile, repositories.preferences),
      getScheduledMeets: new GetScheduledMeets(repositories.meets),
      requestMeet: new RequestMeet(repositories.meets),
      submitReview: new SubmitReview(repositories.reviews),
    },
    services: {
      logger,
      analytics,
      notifications,
      imagePicker,
      connectivity,
      secureStore,
      store,
    },
    backend,
    passwordRequirement,
    dispose: () => teardown.forEach((stop) => stop()),
  };
}

/**
 * A container with nothing real in it, for tests.
 *
 * In-memory repositories, in-memory storage, always online, silent logging.
 * Being able to write this in one function is the payoff of the whole
 * architecture — a test needs no network, no mocking framework and no native
 * module.
 */
export function createTestContainer(overrides: ContainerOverrides = {}): Container {
  const silent: Logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    captureException: () => {},
    setUser: () => {},
  };

  return createContainer({
    forceBackend: 'in-memory',
    ...overrides,
    services: {
      logger: silent,
      // No camera roll under Jest. The UI reads `isAvailable` and hides the
      // control, so a test never has to mock a native picker.
      imagePicker: new UnavailableImagePicker(),
      connectivity: new AlwaysOnlineMonitor(),
      secureStore: new InMemoryStore(),
      store: new InMemoryStore(),
      ...overrides.services,
    },
  });
}
