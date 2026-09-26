# Offtexts — UI rebuild brief

**For:** whoever rebuilds the interface (Claude Code, or a person).
**Status:** the app works. Architecture, database contract, domain rules and 113
tests are done and are **not** in scope. This is about how it looks.

**Two reference sets, and they do different jobs:**

| Reference                                                          | What it decides                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `docs/design/offtexts-flow/` — the ten-step scheduling mockups     | **The palette, and the brand.** These are Offtexts' own, already drawn.    |
| `docs/design/breeze-reference/` — 15 Breeze onboarding screenshots | **Structure.** Sizes, radii, the selection model, spacing, the confidence. |

Where they disagree, **the Offtexts mockups win on colour and the Breeze
screenshots win on layout.** That split is the whole brief in one line.

> The scheduling flow those mockups depict is **phase 2** and is specified
> separately in `docs/design/scheduling-flow.md`. Do not build it during the
> rebuild. Read it only so the design system you are making can accommodate it.

---

## 0. Before anything else: Breeze is a dating app. Offtexts is not.

Read this before §3, because it is the one way this brief can be followed
correctly and still produce the wrong product.

### What genuinely transfers

Breeze's own welcome screen says: _"No chat. The awkward smile, the nervous
laugh, the moment you realise you like them, happens in person. Match with
someone, pick a time, and meet at a safe partner bar we've sorted for you."_

That is Offtexts' loop almost exactly — no messaging, mutual match, pick a
time, partner venue. Breeze is not only a visual reference, it is a product
analogue for the core mechanic. Lean on its structure.

### What does not transfer

**Offtexts has four purposes: dating, life partner, networking, co-founder.**
Breeze has one. Everything in Breeze's voice, iconography and illustration
assumes romance, and copying it wholesale produces an app a founder looking for
a co-founder will not use.

**1. The like button must stop being a heart.** `TodayScreen.tsx` uses
`icon="heart"`. Use the product's own metaphor: **a coffee cup** (`cafe`). It
means "yes, I'd meet them" and reads identically for a date and a co-founder.
Pass stays `close`. The accessibility labels stay — tests assert them; only the
glyph changes. (`heart-outline` on the _"who would you like to meet"_ step is
fine; that step only appears for dating and life partner.)

**2. Illustration is about meeting, not romance.** The Offtexts mockups already
show the house motif: **fine botanical line sprigs** in the corners of cards
and screens, in pale sage. That is the decorative language. Use it. Do not
import Breeze's paper-collage hands.

**3. The voice stays warm and purpose-agnostic.** The existing copy already
does this — "You both said yes", "Coffee with {name}", "They are only told if
you both say yes" all read correctly for a co-founder search. **Do not make it
flirtier to match Breeze's tone.** Test for any new string: _would a founder
looking for a co-founder be happy reading this?_

### One open design question

`profiles.intents` is an **array** — a member can be here for networking _and_
dating, and the editor allows it. Decided for now: **do not group Today by
purpose.** The set is three; the intent badges on the card answer "why am I
seeing this person". Revisit only if the daily set grows.

---

## 1. The verdict on what exists

Monochrome and austere: near-black `#0B1716`, one brass accent, hairline borders
everywhere, the same dark card on every screen, system font, almost no motion.
Legible, consistent, accessible — and it reads like a settings screen.

- **No colour hierarchy.** Every surface `#12201E`, every accent brass.
- **Three levels of grey text**, and the palest is used for thirteen pieces of
  real copy. See §6.5. This is a large part of why it reads tentative.
- **No imagery.** Empty states are a small icon and two grey lines.
- **Type has no personality** and nothing is larger than 34px.
- **Onboarding is a form, not a conversation.**

---

## 2. The decision

**Light and warm: cream and deep forest green.** Taken from the Offtexts
scheduling mockups, which are already branded and already drawn — cream
`#FCF6EA`, forest `#1C4638`, pale green `#E5F1D9` for anything mutual or
confirmed, white cards, fine botanical sprigs.

This keeps the brand (the logo's forest green becomes the primary, its brass
becomes the celebratory accent) while going light and warm, which is what was
asked for. It is not a Breeze clone: Breeze is blush and hot coral, we are
cream and forest.

**From Breeze we take only structure** — sizes, radii, the selection model, the
confidence to leave white space, and the discipline of almost never using grey
text. Specifically we **do not** take its coral offset-shadow button; that is
Breeze's signature, not ours, and the Offtexts mockups do not have it.

---

## 3. What Breeze actually does — measured

### 3.1 Sizes. Read this before you build anything.

The screenshots are 716px wide on a **393dp** device, so **1.82px per dp**. Any
number read straight off a screenshot is 1.8× too large. Verified by measuring
controls and dividing:

| Element                   | Screenshot px | **dp — use this**       |
| ------------------------- | ------------- | ----------------------- |
| Next button (squircle)    | 87            | **48**                  |
| Icon tile                 | 95            | **52**                  |
| Text field height         | 95            | **52**                  |
| Chip height               | 71            | 39 → **44** (see below) |
| Option row                | 117           | **64**                  |
| Question heading          | 46            | 25 → **28** (see below) |
| Button offset / body text | —             | 5 / 17–18               |

Two deliberate deviations from Breeze: **chips go to 44dp** so the brief's own
"every interactive element ≥44dp" rule holds, and the **question heading to
28dp** because our strings are longer than Breeze's.

**Radii: one squircle family, roughly 12–16dp, for nearly everything.** Not
pills. The full-width CTA is a squircle too, ~48dp tall.

### 3.2 Selection is inversion, not decoration

- **Unselected chip:** white fill, ink label. **Selected: solid forest fill,
  white label.** No tick, no ring. The fill is the state.
- **Checked box:** solid forest rounded square with a white tick.
- Chosen chips also appear in an explicit **"My selection"** group above the
  list, so nothing you picked scrolls out of sight.

### 3.3 Single choice and multiple choice look different

- **Single choice** (gender): **one white card per option, with gaps between
  them**, and a **round** radio on the left.
- **Multiple choice**: **one shared white card** with `hair` dividers between
  rows, and **square** checkboxes on the left.

Both keep the control on the **left**. The app currently puts it on the right
for both; fix that.

### 3.4 The text field's raised band is focus-only

An unfocused field is white with a hairline and nothing under it. The **focused**
field gets a solid ~5dp band beneath its bottom edge. Verified: on the two-field
screen, the first field has a solid `#D1C2C2` band ~6dp deep and the second has
a single hairline and nothing else — and both are empty, so it is not a
filled/empty distinction.

Use `hair` for that band, not a pink. The border stays a hairline on focus; the
band is the focus signal.

### 3.5 Type

Two faces, and the split matters.

- **Questions and all UI: a bold geometric sans.** Not a serif. **Figtree 700**
  is the closest free match; Plus Jakarta Sans 700 is the alternative.
- **Hero moments only: a heavy display serif.** **Fraunces 800** — Playfair's
  hairline strokes read as fashion magazine and are wrong here. Check which
  optical size the Expo package ships before committing.

**No negative letter-spacing.** Breeze's text runs slightly wider than both
candidates, so tightening it moves the wrong way.

### 3.6 The thing that is easiest to miss

**Breeze barely uses grey text.** Subtitles, body and chip labels all sample at
essentially the ink colour. Grey is for placeholders and disabled controls only.
Copy is ink. Full stop. See §6.5.

---

## 4. Non-negotiables

| Must not change                                                        | Why                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/domain/**`, `src/data/**`, `src/infrastructure/**`, `supabase/**` | Done and tested. Out of scope.                                                            |
| Every `testID`                                                         | 113 tests query by them.                                                                  |
| Every `accessibilityLabel` / `Role` / `State`                          | Some asserted; all are what makes the app usable without sight.                           |
| The copy                                                               | It encodes product rules.                                                                 |
| ESLint layer rules                                                     | No barrel imports from inside `components/`; no concrete repositories in `presentation/`. |
| `npm run verify` green                                                 | At every hand-off.                                                                        |

Traps: `ColorToken` is `keyof typeof colors` — adding keys is free, renaming one
is a compile error everywhere. `theme.spacing` keys are their own values;
`spacing[15]` does not typecheck.

**Line endings:** add `.gitattributes` with `* text=auto eol=lf` and run
`npx prettier --write eslint.config.js tsconfig.json`. Do **not** run
`git add --renormalize .` while a PR is open.

---

## 5. Sequence — do not skip ahead

1. **Token swap only.** Rewrite `colors.ts`, `typography.ts`, `spacing.ts`,
   `shadows.ts`. Touch no component. Render it (§9), look, show the owner.
2. **The grey-text audit** (§6.5) and the **two hardcoded colours** (§6.6).
3. **Dependencies** (§7).
4. **Primitives** (§8.1).
5. **Screens** (§8.2), onboarding first.
6. **Motion, haptics, botanical motif.**

---

## 6. Tokens

### 6.1 `src/shared/theme/colors.ts`

Sampled from the Offtexts mockups. Every ratio computed.

```ts
const palette = {
  cream: '#FCF6EA', // app background
  paper: '#FFFFFF', // cards, inputs, chips
  sand: '#FEF3E1', // a tinted card: summaries, confirmations
  hair: '#EAE2D4', // dividers, the focused-field band
  mute: '#E2E2D8', // disabled fills, unfilled progress. NEVER text.

  ink: '#17201C', // 15.49:1 on cream. Nearly ALL text.
  inkSoft: '#42524A', //  7.69:1 — use sparingly, see §3.6

  forest: '#1C4638', //  9.84:1 on cream; white on it 10.59:1
  forestDeep: '#143528', // pressed
  sage: '#E5F1D9', // "both available", success tint. ink on it 14.22:1
  mist: '#E8F1DE', // badge and icon-circle tint

  gold: '#E0A94A', // celebratory FILL only — 1.96:1 as text, never text
  goldDeep: '#8A6212', //  5.09:1 — gold where text is needed
  danger: '#A3342E', //  6.32:1 on cream; white on it 6.80:1
  leaf: '#D1D9C2', // the botanical sprigs
  transparent: 'transparent',
} as const;

export const colors = {
  /* existing keys — keeping the names is what makes the swap free */
  primary: palette.forest,
  primaryPressed: palette.forestDeep,
  secondary: palette.goldDeep,

  background: palette.cream,
  surface: palette.paper,
  card: palette.paper,
  inset: palette.paper, // inputs are white on cream, not a darker inset

  textPrimary: palette.ink,
  textSecondary: palette.ink, // deliberately the same — §3.6
  textDisabled: palette.inkSoft,
  textOnPrimary: palette.paper,

  border: palette.hair,
  borderStrong: palette.mute,
  placeholder: palette.inkSoft,
  skeleton: palette.mute,

  success: palette.forest,
  warning: palette.goldDeep, // NOT `gold` — that is 1.96:1 and fails as text
  danger: palette.danger,

  overlay: 'rgba(23, 32, 28, 0.40)', // a light scrim; 70% black looks broken
  transparent: palette.transparent,

  /* new keys */
  accent: palette.gold, // fills and celebration only
  successTint: palette.sage, // "both available" rows, confirmed states
  tint: palette.mist, // icon circles, quiet badges
  cardTinted: palette.sand, // summary and confirmation cards
  muted: palette.mute, // disabled control fills. Never text.
  leaf: palette.leaf, // botanical decoration
  /** Over a photo. Light, because the theme is light. */
  scrim: 'rgba(255, 255, 255, 0.92)',
} as const;
```

`textSecondary` mapping to ink is intentional and is the highest-impact line in
the file. If a screen then looks flat, fix it with **size and weight**, not by
greying text out.

### 6.2 `src/shared/theme/typography.ts`

```ts
export const fontFamilies = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  /** Hero moments ONLY. Never an onboarding question. */
  serif: 'Fraunces_800ExtraBold',
} as const;
```

| variant      | size | weight   | use                                        |
| ------------ | ---- | -------- | ------------------------------------------ |
| `hero` (new) | 34   | serif    | welcome, done, the match moment            |
| `heading`    | 28   | bold     | **the onboarding question**, screen titles |
| `subheading` | 22   | bold     | section titles                             |
| `title`      | 18   | semibold | option labels, chip labels, list rows      |
| `body`       | 17   | regular  | copy                                       |
| `bodyStrong` | 17   | semibold | inline emphasis                            |
| `label`      | 15   | medium   | field labels                               |
| `caption`    | 14   | regular  | privacy notes — **14, not 12**             |

`lineHeights.tight` on `hero`/`heading`. **`letterSpacing: 0`** everywhere —
remove the existing negative tracking.

### 6.3 `src/shared/theme/spacing.ts`

```ts
export const radii = {
  none: 0,
  sm: 10, // checkbox, small controls
  md: 14, // chips
  lg: 16, // buttons, icon tiles, cards
  xl: 20, // large cards, sheets
  full: 999, // avatars only
} as const;
```

Heights, from §3.1: next button **48**, icon tile **52**, text field **52**,
chip **44**, option row **64**, full-width CTA **48**.

### 6.4 `src/shared/theme/shadows.ts`

The Offtexts mockups use a very soft shadow on cards and nothing else — no
coloured offset layer. Retune light: `shadowColor: '#5B5136'`, `sm` opacity
0.06 / radius 10 / elevation 1, `md` 0.10 / 20 / 3. Cards are white on cream,
which is most of the separation you need.

### 6.5 The grey-text audit — mandatory

Thirteen `color="textDisabled"` usages on `AppText` are real copy, plus **two
more that only go grey conditionally**:

```
components/onboarding/PrivacyNote.tsx:46
screens/auth/SignInScreen.tsx:286, 305, 319, 366
screens/profile/ProfileScreen.tsx:216
screens/discover/DiscoverScreen.tsx:58
screens/meets/RequestMeetScreen.tsx:181, 239
screens/meets/RatingsReviewsScreen.tsx:27
screens/onboarding/steps.tsx:159, 292
screens/onboarding/OnboardingScreen.tsx:189
screens/today/TodayScreen.tsx:236        (conditional)
screens/onboarding/steps.tsx:226         (conditional)
```

Most become `textSecondary`. `theme.colors.textDisabled` used as an **icon**
colour on an inactive control stays.

### 6.6 The two hardcoded colours

The claim that nothing hardcodes a colour was wrong. These two do, and a token
swap alone would leave the Today card's name band dark on a light theme:

```
components/cards/CandidateCard.tsx:168   rgba(11, 23, 22, 0.88)
components/onboarding/PhotoGrid.tsx:87   rgba(11, 23, 22, 0.82)
```

Point both at the new `scrim` token.

---

## 7. Dependencies

```bash
npx expo install expo-font @expo-google-fonts/figtree @expo-google-fonts/fraunces
npx expo install react-native-svg react-native-reanimated expo-haptics expo-linear-gradient
```

`react-native-reanimated` needs its Babel plugin **last**; restart with
`--clear`. Gate the first render on `useFonts` and show `SplashScreen` until it
resolves, or the first frame reflows.

---

## 8. Component and screen contracts

### 8.1 Primitives

**`Button`** — primary is **forest** with a white label, radius `lg`, 48 tall,
shadow `sm`. Add `size: 'xl'` (56). Pressed = `forestDeep` and scale 0.98, not
opacity. **Secondary** becomes white with an ink label and a `borderStrong`
hairline — the old ember-fill-with-white-label was 3.20:1 and failed.

**`CircleButton`** → a **squircle**, radius `lg`, 48. Enabled: forest fill,
white glyph, shadow `sm`. Disabled: `mute` fill, `inkSoft` glyph, no shadow.

**`TextField`** — white, radius `lg`, 52 tall, hairline `border`, 17px text.
Focus: a solid `hair` band ~5dp under the bottom edge (§3.4). Error: 2px
`danger`.

**`Chip`** — radius `md`, 44 tall. Unselected white with an ink label;
**selected forest with a white label**, no tick. Keep the `checkbox` role.

**`ChoiceRow`** — control moves to the **left**. Add `mode`-driven shape per
§3.3: `single` renders as its own card with a **round** control; `multiple`
renders inside a shared card with a **square** control and `hair` dividers.
Add `position: 'first' | 'middle' | 'last' | 'only'` so the group rounds its
ends. 64 tall, label at `title`.

**`ChipGroup`** — optional `selectionLabel` renders a "My selection" group above
the list.

**`IconTile`** — white squircle **52**, radius `lg`, forest **outline** glyph.

**`EmptyState`** — white card, radius `xl`, no dashed border. A `mist` circle
holds the glyph. Optional botanical sprig in the corner.

**`ProgressDots`** — 15×4, radius `full`, forest when done, `mute` when not.
The **current** segment renders partly filled. Animate over 200ms.

**`Avatar`** — initials on `mist` with forest letters; 2px `paper` ring on a
coloured surface.

**`Badge`** — add `filled`: `mist` fill, forest label, no border.

### 8.2 Screens

**Onboarding** — keep the structure, the twelve questions, the conditional step,
the pinned footer and every testID. Question at `heading`, subtitle at `body`
**in ink**. Content fades in and rises 12px over 220ms on step change; the
footer must not move. **One accent throughout** — do not colour steps
individually.

**Today** — white card, radius `xl`. The name band uses the new `scrim`
(§6.6) with ink text. Keep the **pinned decision bar**; it was fixed because the
buttons were below the fold on every phone measured. Like = forest squircle with
a **`cafe` glyph, not a heart** (§0); pass = white squircle with a
`borderStrong` ring and `close`. Labels unchanged. Light haptic per decision,
success haptic on a match.

**Meets** — section titles at `subheading`. Match rows white, radius `lg`. A
match with nothing arranged gets a 4px `gold` left edge.

**Profile** — hero card white with a `mist` wash behind the avatar and a
botanical sprig. Preference icons in `mist` circles.

**Booking** — venue rows use the grouped `ChoiceRow`; day and time chips use the
new `Chip`; the summary card uses `cardTinted`. **This screen is replaced in
phase 2** by `docs/design/scheduling-flow.md`, so do not over-invest — restyle
it and move on.

**Sign-in** — the logo is a dark tile drawn for a dark background. **Use a
deliberate dark tile on cream**; its green is close to `forest`, so it reads as
part of the palette. A clean light variant needs the source vector.

---

## 9. Render your work and look at it

```bash
npm install --no-save react-dom@19.2.3 react-native-web @expo/metro-runtime
npx expo export --platform web --output-dir /tmp/web --clear
cd /tmp/web && python3 -m http.server 8099
# screenshot at viewport 390x844, deviceScaleFactor 2, with Playwright
```

- **`--clear` is mandatory** — Metro caches `.env`.
- `EXPO_PUBLIC_ENVIRONMENT=development` + `EXPO_PUBLIC_DEV_SKIP_AUTH=true` lands
  you inside the app on seeded data.
- To reach the wizard, temporarily delete `dateOfBirth` and empty `intents` on
  `SEED_PEOPLE[0]`; `hasCompletedOnboarding()` reads exactly those two fields.
- Tabs are `<a role="tab">`; most controls carry `data-testid`.
- react-native-web is **not** a device. Layout, colour and contrast are
  trustworthy; shadows, font fallback and safe-area insets are not.

---

## 10. Done means

- [ ] `npm run verify` green.
- [ ] `npx expo export --platform android` completes.
- [ ] Every screen rendered at 390×844 and looked at.
- [ ] No text below 4.5:1; no real copy on a disabled-class colour.
- [ ] Every interactive element ≥44dp with its label and state intact.
- [ ] Onboarding walked end to end on a render, all twelve steps.
- [ ] **The four-purpose check (§0):** walk it again choosing **co-founder**.
      No hearts, no romance. If any screen reads like a dating app, it is wrong.
- [ ] Side by side against the Offtexts mockups — the palette should match, and
      the shapes should match Breeze.
- [ ] A check on a real phone.

---

## 11. Still open

1. **The logo source vector**, for a proper light variant. Dark tile until then.
2. **Illustration beyond the botanical sprigs.** The sprigs are enough to ship.
   Anything richer is a commission, briefed on _meeting_ — the table, two cups,
   the chair pulled out — not on romance.
