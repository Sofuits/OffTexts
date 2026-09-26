# Master prompt — Offtexts UI rebuild

> Paste everything below the line into Claude Code, from the repository root
> (`D:\offtext\offtexts-repo`). The Breeze reference screenshots are at
> `docs/design/breeze-reference/` and the brief already quotes their sampled
> colours and
> measurements, so nothing needs editing first.

---

You are rebuilding the visual design of **Offtexts**, an Expo / React Native
app. The app is finished and working: architecture, database, API contract,
domain rules and 113 passing tests are all done and are **not** in scope. Your
job is how it looks and how it feels to move through.

Work in this repository. Read before you write.

## 0. The one thing to do first

Read **`docs/design/ui-rebuild-brief.md`** end to end. It is the specification:
a contrast-checked light palette, type scale, component contracts, screen specs
and a definition of done.

There are **two** reference sets and they do different jobs:

| Reference                       | Decides                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design/offtexts-flow/`    | **The palette and the brand.** Offtexts' own mockups, already drawn: cream `#FCF6EA`, forest green `#1C4638`, pale green `#E5F1D9`, fine botanical sprigs. |
| `docs/design/breeze-reference/` | **Structure only.** Sizes, radii, the selection model, spacing.                                                                                            |

Where they disagree, the Offtexts mockups win on colour and Breeze wins on
layout. That split is the whole brief in one line.

The ten-step scheduling flow those mockups depict is **phase 2**, specified in
`docs/design/scheduling-flow.md`. Do not build it now — read it only so the
design system you make can accommodate it.

Then open the Breeze reference screenshots yourself:

`docs/design/breeze-reference/` — 15 screenshots of the Breeze onboarding
flow. The folder is gitignored; the images are on disk, not in the repository.

Breeze is a dating app whose onboarding is the visual target. §3 of the brief
records what was sampled from these images — the exact background `#FEEFE8`,
ink `#29061C`, accent `#FF5F3F`, the shapes and radii, the selection model, and
the one detail that carries the whole personality (a solid coloured layer
offset 5px under every button). Trust §3 over any opinion elsewhere in the
brief, and trust the images over §3 if you spot something it missed.

**Read §0 of the brief first.** Breeze is a dating app; Offtexts has four
purposes — dating, life partner, networking, co-founder. Everything in Breeze's
voice, iconography and illustration assumes romance, and following this brief
faithfully while ignoring that produces an app a founder looking for a
co-founder will not use. §0 says exactly what transfers and what does not.

Report what you see before you start coding, so the product owner can correct
you early.

## 1. What Offtexts is

An 18+ app for meeting people **in person**, over coffee, at partner cafés in
Indian cities. Four purposes: dating, life partner, networking, co-founder.

The product is defined as much by what it leaves out:

- **No chat.** Ever. There is no messaging feature and there must not be one.
- **Three people a day**, chosen by the backend overnight. Not an infinite
  feed. You like or pass on each one.
- **A mutual like is a match**, and a match exists only so you can book a table
  at a café. The app books it; the two of you turn up.
- **Nobody can find out who liked them** unless they liked back. The database
  will not answer that question — the row-level-security policy on `decisions`
  admits only their author, not even staff. There is no "3 people like you"
  screen, no blurred-faces teaser, and you must not invent one. This is the
  product, not a limitation.
- **Every profile is ID-verified** before it is shown to anyone, and every
  photo is moderated before anyone else sees it.
- **It is not a dating app.** Dating is one of four purposes, alongside life
  partner, networking and co-founder. `profiles.intents` is an array — a member
  can be here for more than one at once. Every screen, every icon and every
  string has to work for somebody looking for a business partner. The test for
  any new copy: _would a founder looking for a co-founder be happy reading
  this?_

Brand: the logo is a dark near-black-green tile with a cream/brass "offtexts."
wordmark, at `src/assets/images/offtexts-logo.png`.

## 2. The stack

Expo SDK 57 · React Native 0.86.3 · React 19.2.3 · TypeScript 6.0.3 ·
React Navigation 7 · TanStack Query v5 · Zustand · Supabase.

Clean Architecture, strictly enforced by ESLint and by
`src/__tests__/architecture.test.ts`:

```
src/
  app/              composition root — di/container.ts, navigation/, providers/
  presentation/     ALL React — screens/, components/, hooks/, stores/
  domain/           entities, repository INTERFACES, use cases. No React, no SDK.
  data/             repository implementations (Supabase* and InMemory*), mappers
  infrastructure/   every vendor SDK, and nothing else
  shared/           theme/, constants/, utils/, config/
```

Rules the linter will fail you on:

- `src/domain/**` may not import React, React Native, navigation, Supabase or
  any other layer.
- `src/presentation/**` may not import a concrete repository or the Supabase
  client. Resolve through `useRepositories()` / `useUseCases()`.
- A component may not import `@/presentation/components` (its own barrel) —
  import the sibling file directly. That barrel imports every component, so
  importing it from inside creates a require cycle.
- Only `src/infrastructure/supabase/**` may import `@supabase/supabase-js`.

## 3. What already exists

**Backend.** Ten applied migrations in `supabase/migrations/` — profiles,
preferences, photos, availability, cafés, daily candidates, decisions, matches,
meetings, payments, reports, notifications, audit log — with RLS on every table
and a versioned `api_v1` schema of `security_invoker` views and functions. The
published contract is `docs/api/v1.md`. **Do not change any of it.**

**App.** Sign-in / sign-up / password reset; an onboarding wizard; a daily
candidate screen; matches; a café booking flow; profile and profile editing.

Navigation:

```
RootNavigator (native stack)
├── SignIn                        signed out
├── RootTabs → AuthedArea         signed in
│   ├── Onboarding                profile never filled in
│   └── BottomTabs
│       ├── Profile               photos, preferences, edit, browse
│       ├── Today       (centre)  three candidates, like/pass, match moment
│       └── ScheduledMeets        matches, upcoming, history
├── EditProfile · PersonProfile · RequestMeet · MeetDetails
├── RatingsReviews · Browse
```

Onboarding is **one** screen component (`OnboardingStep`) plus a config array
(`src/presentation/screens/onboarding/steps.tsx`). Twelve questions: purpose →
name → birthday → gender → _who you want to meet_ (only for dating and life
partner) → city → interests → headline → bio → photos → guidelines →
notifications. Reordering the array reorders the flow. **Keep this design.**

Run it with no backend at all: put
`EXPO_PUBLIC_ENVIRONMENT=development` and `EXPO_PUBLIC_DEV_SKIP_AUTH=true` in
`.env` and it starts signed in on seeded in-memory data.

## 4. The task

The current UI is monochrome and austere: near-black `#0B1716` background, one
brass accent `#C9A15B`, hairline borders everywhere, the same dark card on every
screen, system font, almost no motion. It is legible and accessible and it reads
like a settings screen. Onboarding is twelve near-identical grey screens — the
structure is right, the feeling is missing.

The decision, from the product owner: **go light and warm, like Breeze.** Cream
backgrounds, dark text, saturated accents, big rounded display type, real colour
and motion so the app is pleasant to explore. The Offtexts mark becomes an
accent rather than the base of the palette.

`docs/design/ui-rebuild-brief.md` has the detail: a full light palette with
every contrast ratio computed, a type scale, component-by-component contracts,
screen specs, the delight layer, and a definition of done. Follow it, adjusted
to what you see in the screenshots.

## 5. Sequence — do not skip ahead

1. **Study the screenshots** (§0) and report back.
2. **Token swap only.** Rewrite `src/shared/theme/colors.ts`, `typography.ts`,
   `spacing.ts`, `shadows.ts`. Touch no component. Every component already
   reads `useTheme()` and nothing hardcodes a colour, so the whole app changes
   appearance in one commit. **Render it and look at it** (§7) before going on.
   Show the product owner.
3. **The grey-text audit.** 13 places use `textDisabled` for real copy. Breeze
   barely uses grey text at all — subtitles and body sample at the ink colour —
   and this is a large part of why the current UI reads tentative. The brief
   lists every line.
4. **Dependencies** — fonts, `react-native-svg`, `react-native-reanimated`,
   `expo-haptics`, `expo-linear-gradient`. All run in Expo Go. Install with
   `npx expo install` so versions match SDK 57.
5. **Primitives** — `AppText`, `Button`, `TextField`, `Chip`, `ChoiceRow`,
   `IconTile`, `CircleButton`, `EmptyState`, `Avatar`, `PhotoGrid`.
6. **Screens**, onboarding first.
7. **Motion, haptics, illustration.**

## 6. Hard constraints

Breaking any of these turns a redesign into a regression.

- **Every `testID` stays.** 113 tests query by them. Renaming one breaks a suite.
- **Every `accessibilityLabel`, `accessibilityRole` and `accessibilityState`
  stays.** Some are asserted in tests; all of them are what makes the app usable
  without sight. Minimum touch target is 44dp.
- **The copy stays.** The wording encodes product rules — "They are only told if
  you both say yes", the four community guidelines, the privacy note under each
  onboarding question. Change a sentence only if the fact behind it changed, and
  say so.
- **No new text below 4.5:1** on the background it sits on.
- **`src/domain/**`, `src/data/**`, `src/infrastructure/**`, `supabase/**` are
  out of scope.** If a visual change seems to need a domain change, stop and ask.
- **`npm run verify` green** — typecheck, lint, prettier, all 113 tests — at
  every hand-off, not just at the end.
- **Never push to `main`.** It is protected: branch, PR, one approving review.
  Work on a branch named `feature/ui-<something>`.
- **`.env` is gitignored and must never be committed.** The Supabase anon key in
  it is public by design; a service-role key must never appear there at all.

Two traps specific to this codebase:

- `ColorToken` is `keyof typeof colors`. Adding keys is free; renaming one is a
  compile error everywhere it was used — which is the point, but do it on
  purpose.
- `theme.spacing` keys are their own values (`spacing[16] === 16`). `spacing[15]`
  does not typecheck. Keep it that way.

## 7. Render your work and look at it — this is not optional

The app builds for the web well enough to check layout, colour, contrast and
copy at phone size. This loop found four real defects in the previous pass,
including tab labels being squeezed into a 7dp box for a 12dp font — something
no amount of code reading would have surfaced.

```bash
# One-off. --no-save keeps package.json clean.
npm install --no-save react-dom@19.2.3 react-native-web @expo/metro-runtime

npx expo export --platform web --output-dir /tmp/web --clear
cd /tmp/web && python3 -m http.server 8099
# then screenshot at viewport 390x844, deviceScaleFactor 2, with Playwright
```

Things that cost time to learn:

- **`--clear` is mandatory.** Metro caches `.env`, so a changed variable
  silently does not reach the bundle without it.
- To reach the onboarding wizard, temporarily delete `dateOfBirth` and empty
  `intents` on `SEED_PEOPLE[0]` in `src/shared/constants/seedData.ts` —
  `hasCompletedOnboarding()` reads exactly those two fields. Put it back after.
- Tabs render as `<a role="tab">`; most controls carry `data-testid` from their
  `testID`, so Playwright can drive the whole flow.
- react-native-web is **not** a device. Shadows, font fallback and safe-area
  insets differ. Layout, colour and contrast are trustworthy; final polish needs
  a real phone.

Do not report a screen as finished on the strength of it compiling.

## 8. Ask the product owner about these

Do not guess; each one changes the work.

1. **The logo on a light background.** The mark carries its own dark tile. On
   cream it will need either a light variant or a deliberate dark tile. Which?
2. **Typeface.** Settled: Figtree 700 for UI, Fraunces 800 for hero moments,
   no negative letter-spacing. Confirm which optical size the Expo Fraunces
   package ships.
3. **Palette: settled.** Cream and forest green, sampled from the Offtexts
   mockups. Not Breeze's blush and coral, and not the terracotta an earlier
   draft of the brief proposed.
4. **Illustration: settled for now.** The Offtexts mockups already carry the
   house motif — fine botanical line sprigs in pale sage. Use those. Anything
   richer is a later commission, briefed on _meeting_, not romance.

## 9. Out of scope, for the avoidance of doubt

- **Payments.** Razorpay, refunds and cancellation charges are blocked on
  product decisions (who pays, whether there is a prepaid wallet, what a late
  cancellation costs). The schema is ready; nothing pretends money has moved.
- **Photo moderation UI**, push notification delivery, and the admin portal
  (a separate repository).
- **Editing your birthday or gender after onboarding** — a known gap, noted in
  the README.

## 10. Done means

- [ ] `npm run verify` green.
- [ ] `npx expo export --platform android` completes.
- [ ] Every screen rendered at 390×844 and looked at.
- [ ] No text below 4.5:1; no `color="textDisabled"` on real copy.
- [ ] Every interactive element ≥44dp, with its label and state intact.
- [ ] The onboarding flow walked end to end on a render, all twelve steps.
- [ ] The whole flow walked again choosing **co-founder**, not dating. No
      hearts, no romantic illustration, no copy that assumes attraction.
- [ ] A check on a real phone before calling it finished.
- [ ] A short written summary of what changed and what you decided, for the PR.
