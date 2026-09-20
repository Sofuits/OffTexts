/**
 * Colour tokens.
 *
 * The palette is taken from the Offtexts logo: a near-black forest green,
 * warm cream for type, and brass for anything that asks to be tapped. The
 * background value is the logo's own background, sampled from the artwork, so
 * the app and the mark cannot drift apart.
 *
 * Components never hardcode a colour — they read from here through
 * `useTheme()`. That is what makes a light palette later a change in
 * `ThemeProvider` alone.
 */

/** Raw palette. Not for direct use in components — map it through `colors`. */
const palette = {
  /** The logo's background. */
  night: '#0B1716',
  /** One step up, for cards and the tab bar. */
  forest: '#12201E',
  /** Two steps up, for inputs and empty image blocks. */
  moss: '#182926',

  /** Body and heading type. */
  linen: '#F2EDE3',
  /** Supporting copy. */
  sage: '#A3B8AF',
  /** Disabled type and inactive icons. */
  slate: '#6B7F79',

  /** The logo's accent. Primary actions and the active tab. */
  brass: '#C9A15B',
  brassLight: '#E2C184',
  /** Secondary accent, used sparingly. */
  gold: '#E8C07D',

  green: '#4CAF7D',
  amber: '#E0A83C',
  rose: '#E06A63',

  transparent: 'transparent',
} as const;

export const colors = {
  /** Brand colour: primary actions, active tab, focus rings. */
  primary: palette.brass,
  /** Pressed or hovered state of `primary`. */
  primaryPressed: palette.brassLight,
  /** Secondary brand accent for supporting emphasis. */
  secondary: palette.gold,

  /** App background, behind everything. */
  background: palette.night,
  /** Raised surfaces: sheets, headers, tab bar. */
  surface: palette.forest,
  /** Cards sitting on `background`. */
  card: palette.forest,
  /** Inputs and inset panels. */
  inset: palette.moss,

  /** Default body and heading text. */
  textPrimary: palette.linen,
  /** Supporting copy, captions, metadata. */
  textSecondary: palette.sage,
  /** Disabled text and inactive icons. */
  textDisabled: palette.slate,
  /** Text drawn on top of `primary`. Dark, because brass is a light colour. */
  textOnPrimary: palette.night,

  /** Hairline dividers and input outlines. Translucent so it works on any surface. */
  border: 'rgba(242, 237, 227, 0.12)',
  /** A brighter divider, for a card that needs to separate from its neighbour. */
  borderStrong: 'rgba(242, 237, 227, 0.2)',
  /** Placeholder text inside inputs. */
  placeholder: palette.slate,
  /** Blocks standing in for images that are not loaded yet. */
  skeleton: palette.moss,

  success: palette.green,
  warning: palette.amber,
  danger: palette.rose,

  /** Scrim behind modals. */
  overlay: 'rgba(5, 12, 11, 0.7)',
  transparent: palette.transparent,
} as const;

export type Colors = typeof colors;
export type ColorToken = keyof Colors;
