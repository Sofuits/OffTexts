# Project setup

Everything needed to get the Offtexts mobile app running, plus every problem hit
while building it and how it was fixed — so nobody has to solve the same thing
twice.

Written for someone who has never opened this repository.

---

## 1. Prerequisites

| Tool        | Version                                   | How to check                          |
| ----------- | ----------------------------------------- | ------------------------------------- |
| **Node.js** | **20.19.4 or newer** (22 LTS recommended) | `node -v`                             |
| **npm**     | 10 or newer                               | `npm -v`                              |
| **Git**     | any recent                                | `git --version`                       |
| **Expo Go** | latest                                    | Play Store / App Store, on your phone |

You do **not** need Xcode or Android Studio to work on this. Expo Go on a
physical phone is enough for everything in the repository today. Those tools are
only needed for native builds, and EAS handles that in the cloud (see
[Packaging for the stores](#8-packaging-for-the-stores)).

Use **npm**, not yarn or pnpm. `package-lock.json` is committed; mixing package
managers produces a second lockfile and a different dependency tree from
everyone else's.

---

## 2. Getting the code

`main` is a **protected branch**. Nobody pushes to it — not even the repository
owner. All work goes on a feature branch and reaches `main` through a reviewed
pull request.

```bash
git clone <repository-url>
cd <repo>/app
git checkout main
git pull
git checkout -b feature/<what-you-are-doing>
```

Branch naming: `feature/…`, `fix/…`, `chore/…`, lowercase, hyphens.
`feature/supabase-auth`, not `Saksham-work-2`.

---

## 3. Install and run

```bash
npm install          # 2–4 minutes the first time
cp .env.example .env # optional — see below
npm run verify       # confirm your machine matches everyone else's
npm start            # scan the QR with Expo Go
```

**You do not need a Supabase account to run this.** Leave the Supabase values in
`.env` blank (or skip the file entirely) and the app wires in-memory
repositories instead — real implementations of every interface, seeded with
sample data. You get a fully working app with placeholder content.

You will see this in the Metro log, and it is correct:

```
[info] No Supabase configuration found; using in-memory repositories.
```

### Running on a device

`npm start`, then:

- **Android** — open Expo Go, tap "Scan QR code"
- **iPhone** — point the normal Camera app at the QR, tap the banner

Phone and computer must be on the same network. If they are not, or the network
blocks it:

```bash
npx expo start --tunnel
```

Slower to start, works anywhere.

### The scripts

| Script                            | What it does                            |
| --------------------------------- | --------------------------------------- |
| `npm start`                       | Metro bundler                           |
| `npm run android` / `npm run ios` | Emulator or simulator                   |
| `npm run typecheck`               | `tsc --noEmit`                          |
| `npm run lint`                    | ESLint, **failing on any warning**      |
| `npm run format`                  | Prettier, writing changes               |
| `npm test`                        | Jest — 33 tests, no network, ~3 seconds |
| **`npm run verify`**              | **All four. Run before every push.**    |

`npm run verify` is the gate. If it passes locally it will pass in review.

---

## 4. Environment variables

Only `EXPO_PUBLIC_*` variables reach the app. They are declared in
`app.config.ts` and read back through `src/shared/config/env.ts` — never
`process.env` directly.

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENVIRONMENT=development
```

> **Everything reachable from `env` ships inside the app bundle** and can be
> read by anyone who downloads it.
>
> That is fine for the Supabase URL and anon key — the anon key is _designed_ to
> be public. What protects the data is **Row Level Security** on the database,
> not the secrecy of that key.
>
> It is **not** fine for a Supabase **service role** key, which bypasses RLS
> entirely. If one ever appears in a `.env` for this app, treat it as a leaked
> credential and rotate it immediately.

`.env` is gitignored. `.env.example` is committed and must list every variable
the app understands.

---

## 5. Before you push

```bash
npm run verify
```

Then open the app and tap through all three tabs. Two of the bugs listed below
passed every automated check and only appeared on a real device.

```bash
git add -A
git commit -m "feat: what you did"
git push -u origin feature/<your-branch>
```

GitHub prints a PR link. Open it, target `main`, and describe what the change
does and what it deliberately does not do.

**Authentication:** GitHub no longer accepts your password for git. Use a
personal access token — GitHub → Settings → Developer settings → Personal access
tokens → Tokens (classic) → Generate new token → tick **repo** → paste it where
git asks for a password.

---

## 6. Problems hit while building this, and the fixes

Every one of these cost real time. They are written up so the next person
recognises the symptom instead of debugging it from scratch.

### 6.1 The Meets tab crashed on Android and only on Android

**Symptom** — the app worked in the iOS simulator and in a web preview. On a
real Android phone, opening the Meets tab took the whole screen down.

**Cause** — `Intl.RelativeTimeFormat`. Hermes, the JavaScript engine React
Native uses, implements only part of `Intl` on Android. `Intl.DateTimeFormat`
works; `Intl.RelativeTimeFormat` does **not**, and calling it throws
`Intl.RelativeTimeFormat is not a constructor`.

The Meets tab was the only screen formatting a relative time ("in 2 days"),
which is why it was the only one that crashed.

**Fix** — `src/shared/utils/date.ts` formats dates by hand and imports no `Intl`
at all.

**What to take from it**

- Do not use `Intl` beyond `DateTimeFormat` and `NumberFormat` in this codebase.
- Be careful with any date library that reaches for `Intl` internally.
- **A feature working in the simulator is not evidence it works on Android.**

### 6.2 A render error blanked the whole app

**Symptom** — related to the above. When a screen threw, the app went blank with
nothing to report.

**Fix** — `ErrorBoundary` wraps the app in `src/app/providers/AppProviders.tsx`.
A render error now shows its message on screen.

**What to take from it** — when a tester says "it crashed", ask for a photo of
that screen. The message on it is usually the entire diagnosis.

It cannot catch everything: errors inside event handlers, `setTimeout` or
promises are outside React's render cycle and still need a `try/catch`.

### 6.3 `WARN Require cycle: components/index.ts -> cards/MeetListItem.tsx -> components/index.ts`

**Cause** — `MeetListItem` imported the barrel `@/presentation/components`, and
the barrel imports `MeetListItem`.

**Fix** — import the sibling file directly:

```ts
// Wrong, from inside src/presentation/components/
import { AppText } from '@/presentation/components';

// Right
import { AppText } from '@/presentation/components/common/AppText';
```

**Why it matters** — Metro allows cycles and only warns, so one ships quietly
and surfaces much later as an undefined component with no useful stack trace.

Now guarded by an ESLint rule and by two assertions in
`src/__tests__/architecture.test.ts`.

### 6.4 The same connectivity log line four times per event

**Cause** — every component calling `useConnectivity` opened its own NetInfo
subscription. Three tabs mounted, each with an `OfflineBanner`, plus the query
provider: four native listeners reporting the same thing.

**Fix** — `ConnectivityProvider` holds one subscription for the whole app and
publishes only when a value this app actually reads has changed. NetInfo also
re-emits on signal strength and cellular generation, neither of which matters
here.

**What to take from it** — a hook that opens a native subscription should read
from one shared provider, not create a listener per caller.

### 6.5 `tsconfig.json` keeps showing as modified

**Symptom** — `git status` lists `tsconfig.json` as changed without anyone
editing it. The comments are gone and the arrays are reformatted.

**Cause** — the Expo dev server normalises it on start (`TypeScript: The
tsconfig.json#include property has been updated`), and a VS Code "format on
save" using the built-in JSON formatter rather than Prettier does the same.

**Fix** — run `npm run format` before committing, which puts Prettier back in
charge. If it keeps happening, check that
**Settings → Editor: Default Formatter** is set to **Prettier**, which
`.vscode/settings.json` already specifies.

**Do not** commit the reformatted version — it fails `npm run format:check` and
therefore fails `npm run verify`.

### 6.6 Every test rendered an empty `<RNCSafeAreaProvider />`

**Symptom** — every screen test failed with "unable to find an element", and the
rendered output was just an empty provider.

**Cause** — `SafeAreaProvider` measures its frame natively and renders nothing
until that measurement arrives, which never happens under Jest.

**Fix** — in `jest.setup.js`:

```js
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
```

The `.default` matters. The shipped mock uses `export default`, and without it
`SafeAreaProvider` is `undefined` and React reports "Element type is invalid"
pointing at `AppProviders` — an error a long way from its cause.

### 6.7 Error-state tests timing out

**Cause** — React Query retries retryable errors twice with exponential backoff.
A test asserting an error state waited out both retries and hit the 1-second
default query timeout.

**Fix** — `createTestQueryClient()` in `src/app/providers/QueryProvider.tsx`
turns retries off. Tests pass it to `AppProviders`.

**What to take from it** — a "flaky timeout" in a query test is usually the
retry policy doing exactly what it was told to.

### 6.8 `Cannot find name 'describe'` / `'node:fs'`

**Cause** — Jest's globals and Node's types are ambient and were not in
`tsconfig.json`.

**Fix** — `"types": ["jest", "node"]`, and `@types/node` as a dev dependency.

---

## 7. Architecture — the three rules

Full reasoning is in [ARCHITECTURE.md](ARCHITECTURE.md). The three that will
fail your build if broken:

**1. Only `src/infrastructure/supabase/` may import `@supabase/supabase-js`.**
Enforced by ESLint _and_ by a test. This single rule is what makes replacing
Supabase with a NestJS or Go backend a five-line change rather than a rewrite.

**2. `src/domain/` imports nothing.** Not React, not React Native, not any SDK.
That is what lets the business rules be tested in milliseconds and reused by a
future web client.

**3. Screens resolve dependencies through hooks**, never by constructing a
repository. `useRepositories()` / `useUseCases()`.

Adding a feature? The path is in the README under _How to add a screen_, and in
ARCHITECTURE.md under _Adding a feature_.

---

## 8. Packaging for the stores

Not set up yet. This is what it will take, so it can be planned rather than
discovered at launch.

### The tool

**EAS Build** — Expo's cloud build service. It compiles the native binaries on
Expo's machines, which means **an iOS build does not need a Mac**. On a Windows
team that is not a convenience, it is the difference between shipping to iOS and
not.

```bash
npm install -g eas-cli
eas login
eas build:configure          # creates eas.json
eas build --platform android --profile preview   # .apk for internal testing
eas build --platform android --profile production # .aab for Play
eas build --platform ios --profile production     # .ipa for App Store
eas submit --platform android
eas submit --platform ios
```

### Accounts needed

|                             | Cost                     | Notes                                                                    |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| **Google Play Console**     | one-off registration fee | Organisation account needs business verification — start early           |
| **Apple Developer Program** | annual                   | Same; enrolment as an organisation needs a D-U-N-S number and takes time |
| **Expo account**            | free tier available      | Paid tiers buy build concurrency and speed                               |

Get both developer accounts opened **before** the app is ready. Verification is
the slow part and it blocks everything after it.

### The deadline that matters

Google Play requires apps to target a recent Android version, and the bar moves
every year. **From 31 August 2026, new apps and updates must target Android 16
(API level 36).** An app that misses it stops being available to new users on
devices running a newer Android than it targets — existing installs keep
working, but growth stops. An extension to 1 November 2026 can be requested from
the Play Console.

**Action for this project:** pin the target SDK explicitly rather than inheriting
whatever the Expo SDK defaults to, so the value is visible in the repository and
reviewed when it changes:

```bash
npx expo install expo-build-properties
```

```ts
// app.config.ts
plugins: [
  ['expo-build-properties', { android: { compileSdkVersion: 36, targetSdkVersion: 36 } }],
],
```

Then `npx expo prebuild --clean` and check the generated
`android/build.gradle` matches.

### Before the first store submission

Not needed now, needed before launch:

- App icon and splash — currently the Offtexts logo, fine for testing
- `bundleIdentifier` / `package` — currently `com.offtexts.app`. **Cannot be
  changed after the first submission.** Confirm it now
- Privacy policy URL — both stores require one and reject without it
- Data safety form (Play) and privacy nutrition labels (App Store). The app
  collects email, phone, city and photos; declare all of it
- Screenshots at several device sizes
- Apple review: an account for the reviewer to sign in with, or the review is
  rejected for "cannot evaluate the app"
- Age rating. A dating category brings extra scrutiny on both stores

---

## 9. Where to ask

- **Architecture and why something is structured as it is** — `ARCHITECTURE.md`
- **How to add a screen, component or asset** — `README.md`
- **A setup problem** — this file, section 6. **If you hit something new, add it
  there in the same format and open a PR.** That is the point of this document.
