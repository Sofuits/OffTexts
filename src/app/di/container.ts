import {
  InMemoryAuthRepository,
  InMemoryDiscoverRepository,
  InMemoryMeetRepository,
  InMemoryProfileRepository,
  InMemoryReviewRepository,
  SupabaseAuthRepository,
  SupabaseDiscoverRepository,
  SupabaseMeetRepository,
  SupabaseProfileRepository,
  SupabaseReviewRepository,
} from '@/data/repositories';
import { MeetLocalDataSource, ProfileLocalDataSource } from '@/data/datasources/local';
import type {
  AuthRepository,
  DiscoverRepository,
  MeetRepository,
  ProfileRepository,
  ReviewRepository,
} from '@/domain/repositories';
import { GetScheduledMeets, RequestMeet, SignIn, SubmitReview } from '@/domain/usecases';
import { NoopAnalytics, type Analytics } from '@/infrastructure/analytics';
import { ConsoleLogger, SentryLogger, type Logger } from '@/infrastructure/logging';
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
  type TypedSupabaseClient,
} from '@/infrastructure/supabase';
import { env } from '@/shared/config';

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
    meets: MeetRepository;
    reviews: ReviewRepository;
  };
  useCases: {
    signIn: SignIn;
    getScheduledMeets: GetScheduledMeets;
    requestMeet: RequestMeet;
    submitReview: SubmitReview;
  };
  services: {
    logger: Logger;
    analytics: Analytics;
    notifications: NotificationService;
    connectivity: ConnectivityMonitor;
    secureStore: KeyValueStore;
    store: KeyValueStore;
  };
  /** Which backend was wired. For a debug screen and for tests. */
  backend: 'supabase' | 'in-memory';
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
    auth: new SupabaseAuthRepository(client, logger),
    profile: new SupabaseProfileRepository(client, profileCache, connectivity, logger),
    discover: new SupabaseDiscoverRepository(client),
    meets: new SupabaseMeetRepository(client, meetCache, connectivity, logger),
    reviews: new SupabaseReviewRepository(client),
  };
}

function buildInMemoryRepositories(): Container['repositories'] {
  return {
    auth: new InMemoryAuthRepository(),
    profile: new InMemoryProfileRepository(),
    discover: new InMemoryDiscoverRepository(),
    meets: new InMemoryMeetRepository(),
    reviews: new InMemoryReviewRepository(),
  };
}

export function createContainer(overrides: ContainerOverrides = {}): Container {
  const logger = overrides.services?.logger ?? buildLogger();
  const analytics = overrides.services?.analytics ?? new NoopAnalytics();
  const notifications = overrides.services?.notifications ?? new NoopNotificationService();
  const connectivity = overrides.services?.connectivity ?? new NetInfoConnectivityMonitor();
  const secureStore = overrides.services?.secureStore ?? new SecureKeyValueStore(logger);
  const store = overrides.services?.store ?? new AsyncStorageStore(logger);

  const backend =
    overrides.forceBackend ?? (env.hasSupabase ? ('supabase' as const) : ('in-memory' as const));

  const teardown: (() => void)[] = [];
  let repositories: Container['repositories'];

  if (backend === 'supabase') {
    const client = createSupabaseClient({
      url: env.supabaseUrl,
      anonKey: env.supabaseAnonKey,
      // The session holds a refresh token, so it belongs in the keychain.
      storage: secureStore,
      logger,
    });
    // Without this, the session can expire while the app is backgrounded.
    teardown.push(bridgeSupabaseToAppState(client));
    repositories = buildSupabaseRepositories(client, logger, connectivity, store);
  } else {
    logger.info('No Supabase configuration found; using in-memory repositories.');
    repositories = buildInMemoryRepositories();
  }

  repositories = { ...repositories, ...overrides.repositories };

  return {
    repositories,
    useCases: {
      signIn: new SignIn(repositories.auth),
      getScheduledMeets: new GetScheduledMeets(repositories.meets),
      requestMeet: new RequestMeet(repositories.meets),
      submitReview: new SubmitReview(repositories.reviews),
    },
    services: { logger, analytics, notifications, connectivity, secureStore, store },
    backend,
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
      connectivity: new AlwaysOnlineMonitor(),
      secureStore: new InMemoryStore(),
      store: new InMemoryStore(),
      ...overrides.services,
    },
  });
}
