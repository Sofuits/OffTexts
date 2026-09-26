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
| `npm test`                        | Jest — 42 tests, no network, ~7 seconds |
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
charge. If it keeps happening, set **Settings → Editor: Default Formatter** to
**Prettier** in your own editor.

Editor settings are not committed — `.vscode/` is ignored — so this is a setting
each person turns on once for themselves. `.editorconfig` **is** committed and
covers indentation, charset and line endings for any editor that reads it, but
it cannot choose your formatter for you. Running `npm run format` before every
commit makes the point moot either way, which is why that is the habit to build
rather than a particular editor configuration.

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

### 6.9 This guide originally asked for three OAuth clients

**Cause** — an earlier version of section 6a said Google sign-in needs three
Google Cloud OAuth clients (Web, Android, iOS) and that the Android one needs
the SHA-1 fingerprint of the EAS-managed keystore. That is correct advice for
the **native** Google Sign-In SDK, which is what most tutorials describe. It is
not correct for the flow this app implements.

We use the browser redirect flow. Google issues its response to
`https://<project-ref>.supabase.co/auth/v1/callback`, a web address, and never
interacts with the app binary — so there is nothing for it to identify by
package name or signing certificate.

**Fix** — section 6a now specifies one Web application client and states why,
with a table contrasting the two flows.

**What to take from it** — following that section as written would have meant
setting up an EAS account and generating build credentials before a single
sign-in could be tested, for no reason. When a setup step exists only to satisfy
another system, check what that system actually receives. If Google never sees
the APK, it cannot be checking the APK's fingerprint.

If the app ever moves to the native SDK — worth doing, since it replaces a
browser hop with the OS account picker — the three-client requirement comes back
and the SHA-1 becomes real. Both the EAS keystore fingerprint and any local
debug key would then need registering, or sign-in works for one developer only.

---

## 6a. Google sign-in — configuration

The code is complete and runs today against the in-memory repository: the
sign-in screen, the auth gate and sign-out all work with no backend. Making it
sign in with a **real** Google account needs three things configured, in this
order. The order matters — each step needs an output from the one before.

### Step 1 — Supabase project

Full instructions, including the SQL to run and how to verify RLS is actually
working, are in **[supabase/README.md](supabase/README.md)**. In short:

1. Create a project at supabase.com. **Pick the Mumbai region** — lowest latency
   for Pune members.
2. SQL Editor → run `supabase/migrations/0001_initial_schema.sql`, then
   `0002_row_level_security.sql`. **In that order.**
3. Project settings → API → copy the **Project URL** and the **anon public key**.
4. Put them in `.env`:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
   ```

The moment both are present, the composition root wires the Supabase
repositories instead of the in-memory ones. Nothing else changes.

### Step 2 — One Google Cloud OAuth client

**A single Web application client. Not three.**

This is worth being precise about, because most tutorials say three and they are
answering a different question. There are two ways to sign in with Google from a
React Native app, and they need different things:

| Flow                                                                     | What Google sees | Clients needed                               |
| ------------------------------------------------------------------------ | ---------------- | -------------------------------------------- |
| **Browser redirect** — `signInWithOAuth` + `openAuthSessionAsync` (ours) | a web request    | **Web application only**                     |
| Native SDK — `@react-native-google-signin` + `signInWithIdToken`         | a native app     | Web **and** Android (with SHA-1) **and** iOS |

We use the first. The phone opens a browser, Google redirects to
`https://<project>.supabase.co/auth/v1/callback`, Supabase exchanges the code
and redirects on to `offtexts://auth/callback`. Google never talks to the app
binary, so it has nothing to identify by package name or signing certificate —
which is exactly why no Android or iOS client is involved, and why **no SHA-1
fingerprint and no EAS keystore are needed for sign-in to work**.

Google Cloud Console → **Google Auth Platform** (formerly "APIs & Services →
OAuth consent screen"; Google reorganised it into Overview / Branding /
Audience / Clients / Data Access / Verification Center).

1. **Branding** — app name `Offtexts`, a support email, and a developer contact
   email.
2. **Audience** — **External**. Then **Publish app** to move it out of
   `Testing`. In `Testing` only accounts on an explicit list can sign in, capped
   at 100.
3. **Data Access** — leave it at the default `openid`, `email`, `profile`. These
   are **non-sensitive scopes**, and an app using only non-sensitive scopes does
   not need to pass Google's verification review before publishing. Add anything
   beyond them and that stops being true.
4. **Clients** → Create client → **Web application**. Authorised redirect URI:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   Nothing in "Authorised JavaScript origins" — that field is for a browser SPA
   calling Google directly, which is not what happens here.

### Step 3 — Connect them in Supabase

Supabase dashboard → Authentication → Sign In / Providers → Google → enable, and
paste the Web client ID and secret.

Then Authentication → URL Configuration → Redirect URLs, add:

```
offtexts://auth/callback
offtexts://auth/reset
```

These are the addresses every development and store build returns to, on
Android and iPhone alike, and the one an iPhone uses for Google sign-in even in
Expo Go. They are built by `expo-linking` from `scheme: 'offtexts'` in
`app.config.ts` — change the scheme and they change with it. (Android builds
used to produce `offtexts:///auth/callback`, with three slashes, which needed a
separate entry and failed silently without one;
`src/infrastructure/supabase/__tests__/deepLinks.test.ts` now runs the real
`expo-linking` to keep it at two.)

A redirect that is not listed does not fail: Supabase sends the browser to the
Site URL instead, and the app never hears back — Google's consent screen, then
nothing.

**Expo Go on Android** returns to an address on the developer's own machine,
such as `exp://192.168.1.23:8081/--/auth/callback` (and `…/--/auth/reset`). The
app logs its exact value at startup — "Google sign-in returns to" — when
`EXPO_PUBLIC_ENVIRONMENT=development`. It changes with the computer's IP
address, so each developer needs their own entry, and a new one when their IP
changes. **Never add a wildcard such as `exp://**`**: on this project it would
let sign-in tokens be sent to anybody's Expo Go. Every `exp://` entry comes out
before launch (§8). For anything beyond one developer, use a development build
(Step 4).

### Step 4 — A development build

Google sign-in does work in Expo Go: on iPhone with the fixed
`offtexts://auth/callback`, and on Android with the per-developer `exp://`
entry described in Step 3. That per-developer entry is what does not scale — it
puts one IP address per person into the production project's allow-list. A
development build uses the fixed `offtexts://` addresses on both platforms, so
the two entries in Step 3 work for everyone.

What it takes:

1. **Install `expo-dev-client`.** `eas.json`'s `development` profile already
   sets `developmentClient: true`, which needs this package, and it is not
   installed yet — EAS stops and asks for it otherwise. Commit the
   `package.json` and lockfile change.

   ```bash
   npx expo install expo-dev-client
   ```

2. **Build from a branch that has all the native modules you run.** A
   development build contains the app's native code; the JavaScript is loaded
   from Metro. Add a native module later — the UI rebuild adds fonts, a splash
   screen, Reanimated, SVG, haptics and gradients — and the build must be made
   again, or the app fails the moment it reaches that module.

3. **Build and install.** The EAS project is already linked
   (`extra.eas.projectId` in `app.config.ts`); you need an Expo account with
   access to it.

   ```bash
   npm install -g eas-cli
   eas login
   eas build --profile development --platform android
   ```

   EAS builds an `.apk` in the cloud and prints a link and QR code; open it on
   the phone and install. Once per native change, not per code change.

4. **Day to day:** `npx expo start`, and open the project in the development
   build instead of Expo Go. Reloads and fast refresh work as before.

**iPhone:** a development build for a physical device needs an Apple Developer
account and the device registered (`eas device:create`). A Simulator build
does not — add `"ios": { "simulator": true }` to a profile for that.

**Nothing in `app.config.ts` needs changing:** `scheme`, `android.package` and
`ios.bundleIdentifier` are set. `.env` is not uploaded to EAS (it is
gitignored), and a development build does not need it to be: its JavaScript and
config come from Metro on the developer's machine, with that machine's `.env`.
Preview and production builds will need the `EXPO_PUBLIC_*` values set as EAS
environment variables.

### Why OAuth uses the system browser, not a WebView

`openAuthSessionAsync` opens SFSafariViewController on iOS and Custom Tabs on
Android. **Google blocks OAuth inside embedded WebViews** — the error is
`disallowed_useragent` — because an app hosting a WebView can read the password
typed into it. Anyone "simplifying" this to a `WebView` will find sign-in stops
working.

### Testing it without a real Google account

Leave `.env` blank. The in-memory auth repository signs you in after a short
delay, so the screens, the gate and sign-out can all be worked on and tested
with no Google or Supabase account at all.

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
- **Remove every `exp://` entry** from Supabase → Authentication → URL
  Configuration → Redirect URLs. They are per-developer Expo Go addresses (§6a,
  Step 3) and have no place in the production project. There must never be an
  `exp://**` wildcard. What should remain is the app's own
  `offtexts://auth/callback` and `offtexts://auth/reset`, plus the website's
  reset page if one is used

---

## 9. Where to ask

- **Architecture and why something is structured as it is** — `ARCHITECTURE.md`
- **How to add a screen, component or asset** — `README.md`
- **A setup problem** — this file, section 6. **If you hit something new, add it
  there in the same format and open a PR.** That is the point of this document.
