# Offtexts — mobile app

The Offtexts mobile app. A React Native (Expo) foundation with navigation, a
design system and tooling already in place. There are no features here on
purpose: the point is that a developer can clone it, run it, and start on a
screen within ten minutes.

**Status:** placeholder screens, wired navigation, no backend.

---

## What is here

- **Expo SDK 57** with **React Native 0.86** and **React 19**
- **TypeScript in strict mode**, plus `noUncheckedIndexedAccess`,
  `noUnusedLocals` and `noUnusedParameters`
- **React Navigation 7** — a root stack with a three-tab navigator inside it,
  fully typed
- **Clean Architecture** — `domain / data / infrastructure / presentation /
app / shared`, with dependencies pointing inward and the rule enforced by
  both ESLint and a test. See **[ARCHITECTURE.md](ARCHITECTURE.md)**
- **Supabase behind repository interfaces** — the SDK is importable in exactly
  one file, so replacing it with a NestJS or Go backend is five lines
- **Runs with no backend at all** — leave `.env` blank and in-memory
  repositories are wired instead
- **TanStack Query** for server state, **Zustand** for client state
- **A design system** — colours, typography, spacing, radii and shadows, with no
  hardcoded values in any component. The palette is taken from the Offtexts
  logo, with the background sampled from the artwork itself
- **An error boundary** — a render error shows its message instead of blanking
  the app
- **Eleven shared components** built on those tokens
- **ESLint 9 + Prettier 3 + EditorConfig**, wired so they do not fight
- **Environment configuration** through `EXPO_PUBLIC_*`, with no secrets

Verified before commit: TypeScript passes, ESLint passes with zero warnings,
Prettier reports no changes, **31 tests pass**, and the app bundles for **both
Android and iOS**.

---

> **New to this repository?** Start with
> **[project-setup.md](project-setup.md)** — install, run, branch and push, plus
> every problem hit while building this and how it was fixed.

---

## Prerequisites

| Tool            | Version               | Notes                                       |
| --------------- | --------------------- | ------------------------------------------- |
| Node.js         | **20.19.4 or newer**  | 22 LTS recommended. Check with `node -v`.   |
| Package manager | **npm 10+**           | `package-lock.json` is committed — use npm. |
| Expo Go         | Latest                | For running on a physical device.           |
| Xcode           | 15+ _(iOS only)_      | macOS only.                                 |
| Android Studio  | Hedgehog+ _(Android)_ | Needs an emulator image or a USB device.    |

You do **not** need Xcode or Android Studio to start. Expo Go on a phone is
enough for everything in this repository.

---

## Installation

```bash
git clone <repository-url>
cd app
npm install
cp .env.example .env
```

`.env` is gitignored. **Leave the Supabase values blank and the app works** —
the composition root wires in-memory repositories when no backend is
configured, so there is nothing to sign up for before running it.

---

## Running

```bash
npm start          # Metro, then scan the QR code with Expo Go
npm run android    # Android emulator or connected device
npm run ios        # iOS simulator (macOS only)
npm run web        # browser — useful for a quick look, not a target platform
```

**On a physical device:** run `npm start`, then scan the QR code — Expo Go on
Android, the Camera app on iOS. The phone and the computer must be on the same
network.

**First run is slow.** Metro is building its cache. Subsequent starts take
seconds. If something looks stale, `npx expo start --clear`.

---

## Scripts

| Script                 | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm start`            | Start Metro                                           |
| `npm run android`      | Build and open on Android                             |
| `npm run ios`          | Build and open on iOS                                 |
| `npm run typecheck`    | `tsc --noEmit` — types only, no output                |
| `npm run lint`         | ESLint, **failing on any warning**                    |
| `npm run lint:fix`     | ESLint with autofix                                   |
| `npm run format`       | Prettier, writing changes                             |
| `npm run format:check` | Prettier, reporting only — what CI should run         |
| `npm run verify`       | **typecheck + lint + format check.** Run before a PR. |
| `npm run doctor`       | `expo-doctor` — dependency version sanity check       |

`npm run verify` is the gate. If it passes locally it will pass in review.

---

## Folder structure

```text
src/
├── app/                     Composition root — wiring, not features
│   ├── App.tsx
│   ├── di/                  container.ts: THE file that picks implementations
│   ├── navigation/          RootNavigator, BottomTabs, param lists
│   └── providers/           AppProviders, QueryProvider, AuthProvider
│
├── presentation/            Everything React
│   ├── components/          Reusable. buttons, cards, common, inputs, layouts
│   ├── screens/             auth, onboarding, today, meets, person, profile, discover
│   ├── hooks/               queries/ (React Query) + useTheme, useConnectivity
│   └── stores/              Zustand, for client state only
│
├── domain/                  The centre. No React, no SDK, no HTTP
│   ├── entities/            Person, Photo, Matching, Preferences, Meet, Venue, Review
│   ├── repositories/        INTERFACES only, plus Result and AppError
│   └── usecases/            Only where a rule exists — see ARCHITECTURE.md
│
├── data/                    Implements the domain's interfaces
│   ├── repositories/        Supabase* and InMemory* side by side
│   ├── datasources/         remote / local (offline cache) / cache
│   └── mappers/             Database rows <-> domain entities
│
├── infrastructure/          Every vendor SDK, and nothing else
│   ├── supabase/            The ONLY place @supabase/supabase-js is imported
│   ├── storage/             SecureStore (keychain), AsyncStorage, in-memory
│   ├── logging/             Logger interface + Sentry integration point
│   ├── analytics/           Interface + no-op
│   ├── notifications/       Interface + no-op
│   └── network/             Connectivity monitor
│
├── shared/                  Leaves. Anyone may depend on these
│   ├── theme/ constants/ types/ utils/ validation/ config/
│
└── assets/
```

### Rules the structure depends on

1. **Dependencies point inward.** `domain` imports nothing. `data` may use
   `infrastructure`. `presentation` may use `domain` and hooks. Nothing imports
   `presentation`.
2. **Only `infrastructure/supabase` imports the Supabase SDK.** Enforced by
   ESLint and by a test.
3. **Screens resolve dependencies through hooks**, never by constructing a
   repository.
4. **Imports use the `@/` alias**, not `../../`.
5. **No hardcoded design values.** Take them from `useTheme()`.

Full reasoning, including where this deviates from a textbook layout and why:
**[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## Navigation flow

```text
RootNavigator  (native stack)
│
├── SignIn                    when signed out
│
├── RootTabs → AuthedArea     when signed in
│   │
│   ├── Onboarding            if the profile has never been filled in
│   │                         a dozen questions, one screen, one write at the end
│   │
│   └── BottomTabs  (no header)
│       │
│       ├── Profile          Tab 1 — your own profile, photos, who you see
│       │      ├── "Edit profile" ─────────► EditProfile
│       │      └── "Browse everyone else" ─► Browse
│       │
│       ├── Today            Tab 2 — CENTRE, opens first
│       │      ├── three candidates, one at a time, like or pass
│       │      ├── tap the card ──────────► PersonProfile { personId, personName }
│       │      └── a match ───────────────► RequestMeet { matchId, personName }
│       │
│       └── ScheduledMeets   Tab 3 — matches, then upcoming, then history
│              ├── Matches  → tap ────────► PersonProfile { …, matchId }
│              ├── Upcoming → tap ────────► MeetDetails { meetId }
│              └── History  → tap ────────► RatingsReviews { meetId, personName }
│
├── EditProfile
├── PersonProfile             offers a booking only when a matchId came with it
├── RequestMeet               café → day → time, then replace() to MeetDetails
├── MeetDetails
├── RatingsReviews
└── Browse                    everyone else; deliberately not a tab
```

**Three tabs, not four.** Every candidate for a fourth — a browsable feed, a
"likes you" screen, a messages tab — is something Offtexts deliberately does
not have, and a tab bar is the loudest possible place to promise one. `Browse`
exists, but it lives one level down off the profile screen.

**Onboarding is a branch, not a route.** As a pushable screen it would need
somebody to decide to push it, somebody to remember to pop it, and a back
gesture that lands on a half-built profile. `AuthedArea` renders one of two
things instead, and finishing the wizard changes the answer.

The detail screens sit on the **stack**, not inside the tabs. That is what makes
them cover the tab bar when pushed, which is the expected behaviour for a
drill-down. Nesting a stack inside each tab instead would keep the bar visible
and give each tab its own history to reason about.

`MeetDetails` can also push `PersonProfile`, so the stack nests naturally.

---

## How to add a screen

Four steps. The type system enforces three of them.

**1. Add the route to the param list** — `src/navigation/types.ts`:

```ts
export type RootStackParamList = {
  // …existing routes
  MeetFeedback: { meetId: ID };
};
```

**2. Create the folder and screen** — `src/screens/MeetFeedback/`:

```tsx
// MeetFeedbackScreen.tsx
import React from 'react';

import { ScreenContainer, SectionHeader } from '@/components';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'MeetFeedback'>;

export function MeetFeedbackScreen({ route }: Props): React.JSX.Element {
  const { meetId } = route.params; // typed, no cast
  return (
    <ScreenContainer edges={['bottom']}>
      <SectionHeader title="Feedback" subtitle={meetId} />
    </ScreenContainer>
  );
}
```

**3. Add its barrel** — `src/screens/MeetFeedback/index.ts`:

```ts
export { MeetFeedbackScreen } from './MeetFeedbackScreen';
```

Then add the same line to `src/screens/index.ts`.

**4. Register it** in `RootNavigator.tsx` (or `BottomTabs.tsx` for a tab):

```tsx
<Stack.Screen name="MeetFeedback" component={MeetFeedbackScreen} options={{ title: 'Feedback' }} />
```

Navigate to it from anywhere:

```tsx
navigation.navigate('MeetFeedback', { meetId: meet.id });
```

Omit `meetId` and TypeScript fails the build.

> **A screen inside a tab** types its props as
> `BottomTabScreenPropsFor<'Profile'>`, not `RootStackScreenProps`. That
> composite type is what lets a tab screen navigate to a stack route.

---

## How to create a component

Shared components live under `src/components`, in the subfolder that matches
what they are. A component used by exactly one screen belongs next to that
screen instead — `MeetListItem` is the example to follow.

```tsx
// src/components/cards/VenueCard.tsx
import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { useTheme } from '@/hooks/useTheme';

export type VenueCardProps = {
  name: string;
  distanceKm: number;
  style?: ViewStyle;
};

export function VenueCard({ name, distanceKm, style }: VenueCardProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.lg,
          padding: theme.spacing[16],
          ...theme.shadows.sm,
        },
        style,
      ]}
    >
      <AppText variant="title">{name}</AppText>
      <AppText variant="caption" color="textSecondary">
        {distanceKm} km away
      </AppText>
    </View>
  );
}
```

Then export it from `src/components/index.ts`.

A component is finished when it:

- takes an exported `Props` type,
- reads every colour and dimension from `useTheme()`,
- accepts an optional `style` so callers can position it,
- carries an accessibility role and label if it is interactive,
- and knows nothing about any screen.

---

## How to add assets

See **[`src/assets/README.md`](src/assets/README.md)** — it covers images with
`@2x`/`@3x` variants, icon fonts, loading custom fonts and wiring them into the
theme, and what it takes to enable SVG components.

---

## Environment variables

Only `EXPO_PUBLIC_*` variables reach the app. They are read in `app.config.ts`,
placed on `expo.extra`, and read back through `src/shared/config/env.ts`:

```ts
import { env } from '@/shared/config';

env.supabaseUrl; // string
env.hasSupabase; // boolean — false wires in-memory repositories
```

**Everything reachable from `env` ships inside the bundle and can be read by
anyone who downloads the app.**

That is fine for the Supabase URL and anon key. The anon key is _designed_ to be
public — what protects your data is **Row Level Security** on the database, not
the secrecy of that key.

It is **not** fine for a Supabase **service role** key, which bypasses RLS
entirely. If one ever appears in a `.env` for this app, treat it as leaked and
rotate it.

Add a variable in three places: `.env.example`, `app.config.ts` under `extra`,
and `env.ts` so it is typed.

---

## Code quality

Enforced by tooling, not by review:

- Function components and hooks only — no classes.
- Strict TypeScript. `any` needs a comment explaining why.
- `@/` imports; `../../` fails lint.
- No magic values — spacing, colour, radius and type come from the theme.
- `console.log` warns; `console.warn` and `console.error` are allowed.

Run `npm run verify` before opening a PR.

---

## Roadmap

Built in stages on purpose — asking for auth, every screen, the database, the
UI and the architecture in one go produces code that is inconsistent in all of
them.

| Stage | What                                                            | Status   |
| ----- | --------------------------------------------------------------- | -------- |
| 1     | Architecture, infrastructure, DI, React Query, tests            | **done** |
| 2     | Authentication — sign-up, sign-in, password reset, session gate | **done** |
| 3     | Database, RLS, storage, the `api_v1` contract, typed clients    | **done** |
| 4     | Onboarding, Today, matches, profile, booking a table            | **done** |
| 5     | Payments — Razorpay, refunds, cancellation rules                | blocked  |
| 6     | Analytics, Sentry, push, offline mutation queue, polish         |          |

Stage 5 is blocked on product decisions rather than on code: who pays for a
meeting, whether there is a prepaid balance, and what a late cancellation
costs. The schema is already built for all three — `payments`, `refunds` and
`meets.booking_fee_paise` exist — and nothing pretends money has changed hands
until they are wired up.

### Known placeholders

- **`EditProfile` cannot change your birthday or gender.** Onboarding sets both
  and nothing else writes them; the database derives `age` from the date of
  birth by trigger, so a member who mistyped it needs an admin today.
- **Photo moderation has no admin screen yet.** Photos upload and sit at
  `pending`, visible only to their owner, until a moderator approves them —
  which today means an `update` in the SQL editor.
- **Push notifications are an interface with no implementation.** The
  onboarding question stores the answer; nothing sends anything yet.
- **`shared/constants/seedData.ts`** is the only data source with no backend.
  Deleting it is how you find everything still running on fake records.
- **Sentry and analytics are interfaces with no implementation.** The
  integration points are in `infrastructure/logging` and
  `infrastructure/analytics`.

### Demo sign-in

Sign-in is somebody else's piece of work, and everything past the auth gate
needs a real session — every RLS policy on the database requires an
authenticated caller. So the sign-in screen offers a one-tap **Demo sign-in**
when `EXPO_PUBLIC_DEMO_EMAIL` and `EXPO_PUBLIC_DEMO_PASSWORD` are set.

It signs in properly: real session, real RLS, real rows. That is what
distinguishes it from `EXPO_PUBLIC_DEV_SKIP_AUTH`, which forces the in-memory
repositories and exercises no policy at all.

> Both values ship inside the bundle and are readable by anyone who downloads
> the app. They may only ever point at a **throwaway test account** — never a
> real member's, never one with staff access, never a password used anywhere
> else. `src/shared/config/env.ts` refuses to honour them when
> `EXPO_PUBLIC_ENVIRONMENT=production`, so the button cannot ship.

---

## Two things worth knowing before you change code

### `Intl` is not fully available on Android

Hermes — the JavaScript engine React Native runs — implements only part of
`Intl` on Android. `Intl.DateTimeFormat` works; **`Intl.RelativeTimeFormat` does
not**, and calling it throws `Intl.RelativeTimeFormat is not a constructor`,
which takes the whole screen down.

It works in the iOS simulator and in a web preview, so the failure only appears
on a real Android device. That is exactly how it was found here — the Meets tab
crashed on Android and nowhere else.

`src/utils/date.ts` therefore formats dates by hand and imports no `Intl` at
all. Keep it that way, and be careful with any library that reaches for `Intl`
internally.

### Supabase may be imported in exactly one file

`src/infrastructure/supabase/`. ESLint fails the build otherwise, and
`src/__tests__/architecture.test.ts` asserts it independently.

This is not style. It is the single thing that makes "we can replace the
backend" true rather than aspirational.

### Every render error is caught

`ErrorBoundary` wraps the whole app in `src/App.tsx`. If a screen throws while
rendering, you get the error message on screen instead of a blank app. When a
tester says "it crashed", ask for a photo of that screen — the message on it is
usually the whole diagnosis.

It cannot catch everything: errors inside event handlers, in `setTimeout`, or in
promises are outside React's render cycle. Those still need a try/catch.
