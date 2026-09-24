/**
 * Colour tokens.
 *
 * Light and warm: cream and deep forest green, sampled from the Offtexts
 * scheduling mockups in `docs/design/offtexts-flow/`. The logo's forest green
 * is the primary; its brass survives as `accent`, a celebratory fill.
 *
 * Nearly all text is `ink`. `textSecondary` maps to ink on purpose — grey copy
 * is what made the old UI read tentative. If a screen looks flat, fix the
 * hierarchy with size and weight, not by greying text out.
 *
 * Contrast, computed (WCAG 2.x): ink on cream 15.49:1, forest on cream 9.84,
 * white on forest 10.59, inkSoft on cream 7.69, goldDeep on cream 5.09, danger
 * on cream 6.32. `gold` on cream is 1.96 — a fill, never text.
 *
 * Components never hardcode a colour — they read from here through
 * `useTheme()`.
 */

/** Raw palette. Not for direct use in components — map it through `colors`. */
const palette = {
  /** App background. */
  cream: '#FCF6EA',
  /** Cards, inputs, chips. */
  paper: '#FFFFFF',
  /** A tinted card: summaries, confirmations. */
  sand: '#FEF3E1',
  /** Dividers, and the band under a focused field. */
  hair: '#EAE2D4',
  /** Disabled fills, the unfilled progress track. Never text. */
  mute: '#E2E2D8',

  /** Nearly all text. */
  ink: '#17201C',
  /** Genuinely secondary text. Use sparingly. */
  inkSoft: '#42524A',

  /** The logo's green. Primary actions, selection, the active tab. */
  forest: '#1C4638',
  /** Pressed `forest`. */
  forestDeep: '#143528',
  /** "Both available", confirmed states. */
  sage: '#E5F1D9',
  /** Icon circles and quiet badges. */
  mist: '#E8F1DE',

  /** The logo's brass. Celebration fills only. */
  gold: '#E0A94A',
  /** Gold where it has to be text. */
  goldDeep: '#8A6212',
  danger: '#A3342E',
  /** The botanical sprigs. */
  leaf: '#D1D9C2',

  transparent: 'transparent',
} as const;

export const colors = {
  /** Brand colour: primary actions, selection, active tab, focus. */
  primary: palette.forest,
  /** Pressed state of `primary`. */
  primaryPressed: palette.forestDeep,
  /** Secondary emphasis. Passes as text (5.09:1 on cream). */
  secondary: palette.goldDeep,

  /** App background, behind everything. */
  background: palette.cream,
  /** Raised surfaces: sheets, headers, tab bar. */
  surface: palette.paper,
  /** Cards sitting on `background`. */
  card: palette.paper,
  /** Inputs. White on cream, not a darker inset. */
  inset: palette.paper,

  /** Default body and heading text. */
  textPrimary: palette.ink,
  /** Deliberately the same as `textPrimary`. Copy is ink. */
  textSecondary: palette.ink,
  /** Disabled controls and inactive icons. Never real copy. */
  textDisabled: palette.inkSoft,
  /** Text drawn on top of `primary`. */
  textOnPrimary: palette.paper,

  /** Hairline dividers and input outlines. */
  border: palette.hair,
  /** A stronger outline, for a white control that needs an edge. */
  borderStrong: palette.mute,
  /** Placeholder text inside inputs. */
  placeholder: palette.inkSoft,
  /** Blocks standing in for images that are not loaded yet. */
  skeleton: palette.mute,

  success: palette.forest,
  /** Not `gold`: that is 1.96:1 and fails as text. */
  warning: palette.goldDeep,
  danger: palette.danger,

  /** Scrim behind modals. Light — 70% black looks broken on a light theme. */
  overlay: 'rgba(23, 32, 28, 0.40)',
  transparent: palette.transparent,

  /** Celebration fills only. Never text. */
  accent: palette.gold,
  /** "Both available" rows and confirmed states. */
  successTint: palette.sage,
  /** Icon circles, quiet badges. */
  tint: palette.mist,
  /** Summary and confirmation cards. */
  cardTinted: palette.sand,
  /** Disabled control fills. Never text. */
  muted: palette.mute,
  /** Botanical decoration. */
  leaf: palette.leaf,
  /** Over a photo, under text. Light, because the theme is light. */
  scrim: 'rgba(255, 255, 255, 0.92)',
} as const;

export type Colors = typeof colors;
export type ColorToken = keyof Colors;
