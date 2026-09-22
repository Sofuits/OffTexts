import { colors } from '@/shared/theme/colors';
import { radii, spacing } from '@/shared/theme/spacing';
import { fontSizes } from '@/shared/theme/typography';

/**
 * The app's design tokens, as CSS custom properties.
 *
 * Imported file by file rather than through `@/shared/theme`. The barrel
 * re-exports `shadows.ts`, which does a runtime `import { Platform } from
 * 'react-native'` — so one convenient import would put React Native in a Vite
 * bundle, and the build fails on Flow syntax in a file nobody meant to include.
 *
 * No loss: `shadows` describes Android elevation and iOS shadow offsets, which
 * have no meaning in CSS. The three modules imported here are the tokens that
 * genuinely are shared — the palette, the spacing scale, the type sizes — and
 * none of them imports anything at runtime.
 *
 * Only the tokens cross over. The components do not: a profile card and an
 * admin table have nothing in common, and pretending otherwise is how you end
 * up building a table out of `<View>`.
 */

const kebab = (value: string): string => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function themeCssVariables(): string {
  const entries: string[] = [];

  for (const [name, value] of Object.entries(colors)) {
    // `colors` holds a few nested groups alongside the flat tokens; only the
    // strings are usable as custom properties.
    if (typeof value === 'string') entries.push(`--c-${kebab(name)}: ${value};`);
  }

  for (const [step, value] of Object.entries(spacing)) {
    entries.push(`--s-${step}: ${value}px;`);
  }

  for (const [name, value] of Object.entries(radii)) {
    entries.push(`--r-${kebab(name)}: ${value}px;`);
  }

  for (const [name, value] of Object.entries(fontSizes)) {
    entries.push(`--f-${kebab(name)}: ${value}px;`);
  }

  return entries.join('\n  ');
}

/** Applies the tokens to the document, once, at startup. */
export function installTheme(): void {
  const style = document.createElement('style');
  style.setAttribute('data-offtexts-theme', '');
  style.textContent = `:root {\n  ${themeCssVariables()}\n}`;
  document.head.appendChild(style);
}
