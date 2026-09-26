# Architecture

Clean Architecture with the Repository Pattern. The goal is a single one:
**the UI must not know which backend it is talking to.** Supabase is the first
one; a NestJS or Go service should be able to replace it without any screen
changing.

This document explains how that is achieved, where the trade-offs were made,
and — deliberately — where the brief was not followed and why.

---

## The layers

```text
         ┌───────────────────────────────────────┐
         │  app/          composition root       │  wiring, providers, routing
         └──────────────────┬────────────────────┘
                            │ builds
         ┌──────────────────▼────────────────────┐
         │  presentation/  screens, components   │  React lives only here
         └──────────────────┬────────────────────┘
                            │ calls (interfaces only)
         ┌──────────────────▼────────────────────┐
         │  domain/        entities, rules       │  no React, no SDK, no HTTP
         └──────────────────▲────────────────────┘
                            │ implements
         ┌──────────────────┴────────────────────┐
         │  data/          repository impls      │  mapping, caching
         └──────────────────┬────────────────────┘
                            │ uses
         ┌──────────────────▼────────────────────┐
         │  infrastructure/ Supabase, storage…   │  every vendor SDK
         └───────────────────────────────────────┘

  shared/  theme, utils, config, constants — leaves, depended on by anyone
```

**Dependencies point inward.** `domain` is the centre and imports nothing —
not React, not Supabase, not even React Native. That is what makes the business
rules testable in milliseconds and reusable by a future web client.

The arrow from `data` points **up** into `domain`, not down. `data` implements
interfaces that `domain` declares. That inversion is the whole trick: the
domain says what it needs, and something outside it decides how.

---

## The one rule that makes the swap real

> **Only `src/infrastructure/supabase/` may import `@supabase/supabase-js`.**

It is enforced twice, because a rule nobody checks is a comment:

1. **ESLint** — `no-restricted-imports` fails the build on any other import of
   the SDK. See `eslint.config.js`.
2. **A test** — `src/__tests__/architecture.test.ts` walks the source tree and
   asserts the same thing, so it holds in CI even if linting is skipped.

Run `npm run verify` and both run.

If those pass, replacing Supabase is genuinely mechanical: write five new
repository classes in `data/repositories`, change five lines in
`app/di/container.ts`. Nothing else.

---

## The composition root

`src/app/di/container.ts` is the only file that knows which concrete class
satisfies which interface. Everything else receives dependencies through a
constructor or a hook.

It also decides the backend:

```ts
const backend = env.hasSupabase ? 'supabase' : 'in-memory';
```

**With no `.env`, the app runs on in-memory repositories.** Clone, install,
start — a working app in two minutes with no account on anything. Those
repositories are not throwaway stubs; they are real implementations of every
interface, and they are what the tests use.

---

## Where the brief was not followed

Three deliberate departures. Each is a place where following the structure
literally would have cost more than it returned.

### 1. No use case for a plain read

The brief implies a use case per operation. That produces this:

```ts
class GetProfileUseCase {
  constructor(private repo: ProfileRepository) {}
  execute() {
    return this.repo.getMyProfile();
  } // …and nothing else
}
```

A file, a constructor, a container registration and a line in every test, for
zero behaviour. It is the most common way Clean Architecture becomes ceremony.

**The rule here:** a use case exists when it does something a repository call
does not — enforce a rule, combine sources, or derive something the whole
product must agree on. There are four, and each earns it:

| Use case            | Why it exists                                                   |
| ------------------- | --------------------------------------------------------------- |
| `GetScheduledMeets` | Splitting upcoming from history is a business rule, not a query |
| `SubmitReview`      | Rating and comment limits must hold for every client            |
| `RequestMeet`       | Rejects slots in the past before a round trip                   |
| `SignIn`            | Rejects a malformed email before a guaranteed failure           |

Plain reads go from a query hook straight to the repository. Both are behind the
same interface, so decoupling is unaffected.

### 2. `entities` only, not `entities` **and** `models`

The brief lists both under `domain/`. In TypeScript the distinction between an
"entity" and a "model" collapses — both are types. Two folders would mean a
daily argument about which one a new type belongs in, and no compiler help when
someone guesses wrong.

Database row shapes, which is what a "model" usually means, live in
`infrastructure/supabase/database.types.ts` where they belong, and
`data/mappers` converts between the two.

### 3. One `navigation/`, not three

The brief has `app/navigation`, `app/routes` **and** `presentation/navigation`.
Three places for routing means three places to look when a route is wrong.

Everything routing-related is in `src/app/navigation/`. Screens are in
`presentation/screens/` and are plain components that happen to receive typed
navigation props — they have no knowledge of the navigator that mounts them,
which is what the separation was for.

---

## Server state vs client state

The most common state-management mistake in an app like this:

|                  | Owner       | Examples                                 |
| ---------------- | ----------- | ---------------------------------------- |
| **Server state** | React Query | Profiles, meets, reviews                 |
| **Client state** | Zustand     | Selected filter, dismissed banner, draft |

**If the server can change it, it does not belong in Zustand.** Copying a
fetched profile into a store gives you two sources of truth and a
synchronisation bug that appears a week later.

React Query's defaults are written for the web and two of them are corrected in
`QueryProvider`:

- `onlineManager` is wired to NetInfo. By default it watches
  `navigator.onLine`, which does not exist in React Native — leave it and React
  Query believes it is permanently online.
- `focusManager` is wired to `AppState`. The web's "window focused" has no
  equivalent on a phone, so refetch-on-focus silently never fires.

Mutations do not retry. A retried "request meet" books two.

---

## Errors

Every repository method returns `Result<T>` rather than throwing:

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };
```

A thrown error is invisible to the type system — a caller can forget to catch
it and TypeScript says nothing. `Result` puts the failure in the signature.

`AppError.kind` is one of `network | unauthenticated | forbidden | notFound |
validation | server | unknown`. That vocabulary is what lets the UI behave
correctly without knowing anything about Postgres:

- React Query retries only `isRetryable` errors. Retrying a 403 from an RLS
  policy is three guaranteed failures and three seconds of spinner.
- `QueryBoundary` offers "Try again" only when retrying could plausibly work.
  A retry button on a permissions error is a lie.

Translation from a vendor error happens once, in
`infrastructure/supabase/supabaseErrors.ts`.

At the React Query boundary, `unwrap()` converts a `Result` back into a throw —
because React Query's error states and retry logic are built around exceptions.
The Result type did its job at the layer where a caller might have forgotten.

---

## Offline

Not offline-first — that is a much larger project and was not asked for. What
exists:

- **Repositories fall back to a disk cache** on network failure.
  `SupabaseProfileRepository` and `SupabaseMeetRepository` write every
  successful read to `data/datasources/local` and serve it when the request
  fails.
- **Only for `network` errors.** A 403 must surface; serving cached data over an
  authorisation failure shows a member something they are no longer allowed to
  see.
- **`OfflineBanner`** tells the member they are looking at a saved copy, rather
  than interrupting them.
- **React Query pauses and resumes** with real connectivity.

Not built: a mutation queue that replays writes made while offline. That needs
conflict resolution and idempotency keys on the server. `RequestMeet` is the
first thing that would want it.

---

## Security

**The Supabase anon key ships in the bundle and that is by design.** Anyone who
downloads the app can read it. What protects the data is **Row Level Security**
on the database — not the secrecy of that key.

> Without RLS, every table is readable by anyone who downloads the app. Every
> email, every phone number. This is the single most common serious mistake with
> Supabase, and it is not caught by any client-side code.

Two consequences visible in this codebase:

- **Client validation is a courtesy, not a guarantee.** `SubmitReview` checks
  the rating range so the member gets a good message; a `CHECK` constraint and
  an RLS policy are what actually enforce it, because a determined caller can
  talk to PostgREST without this app.
- **No token is ever exposed above the data layer.** `Session` deliberately has
  no `accessToken` field, and a test asserts it. A token on a domain type is how
  one ends up in a log or a crash report.

Sessions are stored in `SecureKeyValueStore` — the OS keychain — not
AsyncStorage, which is readable on a rooted device.

---

## Testing

```bash
npm test
```

113 tests, no network, no mocking framework, about ten seconds.

The one worth reading is
`src/presentation/screens/__tests__/DiscoverScreen.test.tsx`. It renders the
real screen against a repository invented in the test file — no Supabase, no
HTTP interception, no `jest.mock`. The screen cannot tell the difference.

**If that test ever needs `jest.mock('@supabase/supabase-js')` to pass, the
decoupling has been broken.** That is the canary.

`src/__tests__/architecture.test.ts` enforces the layer rules from disk, so a
violation fails before review rather than during it.

---

## Replacing Supabase later

1. Write the new repositories in `src/data/repositories/` against the same
   interfaces. Reuse `data/mappers` if the shapes are similar; replace them if
   not.
2. Put the new client in `src/infrastructure/` and update the ESLint rule to
   restrict its import the same way.
3. Change five lines in `app/di/container.ts`.

Nothing in `domain/`, `presentation/` or `app/navigation/` changes.

**The honest caveat:** the data layer swaps cleanly. Auth is messier, because
Supabase's session refresh and RLS-as-authorisation have no exact equivalent in
a bespoke backend. Expect `SupabaseAuthRepository` to be a rewrite rather than a
translation — but a rewrite of one file behind one interface, not a rewrite of
the app.

---

## Adding a feature

Working inward from the UI, the path is always the same:

1. **Entity** in `domain/entities/` if a new shape is involved.
2. **Repository interface** in `domain/repositories/`.
3. **Use case** in `domain/usecases/` — only if there is a rule. Usually not.
4. **Implementations** in `data/repositories/`: the real one _and_ the in-memory
   one, or the app stops running without a backend.
5. **Register** both in `app/di/container.ts`.
6. **Query hook** in `presentation/hooks/queries/`, with a key in
   `shared/constants/queryKeys.ts`.
7. **Screen** in `presentation/screens/`, wrapped in `QueryBoundary`.
8. **Test** the rule at the domain level and the screen with a fake repository.

Steps 1–3 need no React. Step 8 needs no network.
