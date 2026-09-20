import { useContext } from 'react';

import { ThemeContext } from '@/shared/theme/ThemeProvider';
import type { Theme } from '@/shared/theme';

/**
 * The app's design tokens.
 *
 * Always prefer this over importing `theme` directly: it is what makes a future
 * dark mode a one-file change.
 */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
