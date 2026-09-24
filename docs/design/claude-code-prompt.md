# Kick-off prompt for Claude Code

Paste this into Claude Code from the repository root.

---

You are rebuilding the visual design of the Offtexts mobile app (Expo, React
Native, TypeScript). The app works; the architecture, database contract, domain
rules and 113 tests are done and are **not** in scope.

**Read `docs/design/ui-rebuild-brief.md` in full before writing any code.** It
contains the decision, the exact contrast-checked colour tokens, the component
contracts, the screen specs and the rules you must not break. Follow its
sequence in §4 — do not jump to screens before the token swap is rendered and
looked at.

The short version: the current UI is monochrome and austere — near-black
background, one brass accent, hairline borders, the same dark card everywhere.
The product owner wants it **light and warm**: cream backgrounds, dark text,
saturated accents, big rounded display type, with real colour and motion so the
app is pleasant to explore. The visual reference is the Breeze dating app's
onboarding flow.

Three things to be clear about before you start:

1. **Ask for the Breeze screenshots.** They are not in the repository and the
   brief cannot reconstruct Breeze's look from memory — only its structure. The
   tokens in §6 are a complete, self-consistent light theme you can build
   immediately, but the accent family, the typeface and the illustration style
   should be confirmed against the real references. Say so rather than guessing.

2. **Do not break the contract in §3.** Every `testID`, every
   `accessibilityLabel` / `accessibilityRole` / `accessibilityState`, and the
   copy. The wording encodes product rules. `npm run verify` must be green at
   every hand-off.

3. **Render and look at your work.** §10 gives the exact recipe: export to web,
   serve it, screenshot at 390×844 with Playwright. Do not report a screen as
   finished on the strength of it compiling. That loop is what caught the four
   real defects in the previous pass — including tab labels being squeezed into
   a 7dp box, which no code review would have found.

Start with §4 step 1 (the token swap in `src/shared/theme/`), render it, and
show the product owner before continuing.
