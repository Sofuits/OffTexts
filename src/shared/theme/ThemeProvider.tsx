import React, { createContext, useMemo, type PropsWithChildren } from 'react';

import { theme as defaultTheme, type Theme } from './index';

/**
 * Holds the active theme.
 *
 * There is one theme today. The provider exists so that adding a second one
 * (a light palette, a white-label variant) is a change here and nowhere else —
 * components already read through `useTheme()`.
 */
export const ThemeContext = createContext<Theme>(defaultTheme);

type ThemeProviderProps = PropsWithChildren<{
  /** Override the theme, mainly useful in tests. */
  value?: Theme;
}>;

export function ThemeProvider({ children, value }: ThemeProviderProps): React.JSX.Element {
  const resolved = useMemo(() => value ?? defaultTheme, [value]);
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}
