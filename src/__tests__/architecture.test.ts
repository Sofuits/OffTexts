import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards the architecture itself.
 *
 * ESLint enforces these rules while someone is editing. This test enforces them
 * in CI even if the lint step is skipped, and — more usefully — it states the
 * rules in a place a new developer will actually read: a failing test says what
 * the rule is and where it was broken, which a config file does not.
 */

const SRC = path.join(__dirname, '..');

/**
 * Every .ts/.tsx file under a layer, walked from disk.
 *
 * Deliberately not `git ls-files`: a rule that only checks committed files
 * passes on the working tree that is about to be committed, which is precisely
 * when it is needed.
 */
function filesIn(layer: string): string[] {
  const root = path.join(SRC, layer);
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        // Tests are allowed to import anything; see the eslint override.
        if (entry === '__tests__') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) {
        found.push(path.relative(SRC, full));
      }
    }
  };

  walk(root);
  return found;
}

function importsOf(file: string): string[] {
  const source = readFileSync(path.join(SRC, file), 'utf8');
  // Comments mention forbidden names on purpose (explaining the rule), so they
  // are stripped before matching or the test fails on its own documentation.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1] as string);
}

/**
 * Anything that only exists on a phone.
 *
 * `import type` is excluded from this check by construction: a type-only import
 * is erased before a bundler ever sees it, so it cannot pull a native module
 * into a browser build. Everything here is a runtime import.
 */
const NATIVE_MODULES = [
  'react-native',
  '@react-native-async-storage/async-storage',
  '@react-native-community/netinfo',
  '@react-navigation/native',
  'expo-constants',
  'expo-image-picker',
  'expo-linking',
  'expo-secure-store',
  'expo-web-browser',
];

const isNative = (specifier: string): boolean =>
  NATIVE_MODULES.some((native) => specifier === native || specifier.startsWith(`${native}/`));

describe('architecture boundaries', () => {
  it('finds source files to check', () => {
    expect(filesIn('domain').length).toBeGreaterThan(5);
    expect(filesIn('presentation').length).toBeGreaterThan(5);
  });

  it('the domain depends on nothing outside itself', () => {
    const offenders: string[] = [];

    for (const file of filesIn('domain')) {
      for (const specifier of importsOf(file)) {
        const forbidden =
          specifier.startsWith('@/data') ||
          specifier.startsWith('@/infrastructure') ||
          specifier.startsWith('@/presentation') ||
          specifier.startsWith('@/app') ||
          specifier === 'react' ||
          specifier === 'react-native' ||
          specifier.startsWith('@react-navigation') ||
          specifier.startsWith('@supabase') ||
          specifier.startsWith('@tanstack');

        if (forbidden) offenders.push(`${file} -> ${specifier}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  /**
   * The admin web app imports `domain/` and `data/` verbatim and runs them in a
   * browser. One `import { env }` or one reach through the
   * `infrastructure/supabase` barrel — which re-exports the OAuth flow and the
   * AppState bridge — puts `expo-web-browser` in a Vite bundle and breaks it,
   * with a runtime error rather than a compile one.
   *
   * ESLint cannot express this rule usefully, because the same barrel is
   * perfectly legal from `app/`. So it is asserted here instead.
   */
  it('the domain and data layers run in a browser', () => {
    const offenders: string[] = [];

    for (const layer of ['domain', 'data']) {
      for (const file of filesIn(layer)) {
        for (const specifier of importsOf(file)) {
          if (isNative(specifier)) {
            offenders.push(`${file} -> ${specifier}`);
          }
          // The barrel is the trap: it looks harmless and pulls in three
          // native modules. Deep-import the file you actually want.
          if (specifier === '@/infrastructure/supabase') {
            offenders.push(
              `${file} -> the infrastructure/supabase barrel (import the file directly)`,
            );
          }
          if (specifier === '@/shared/config') {
            offenders.push(
              `${file} -> @/shared/config (reads expo-constants; take it as a parameter)`,
            );
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /**
   * The theme modules the admin portal imports.
   *
   * Not the whole of `shared/`, and deliberately not the `shared/theme` barrel:
   * `shadows.ts` does a runtime `import { Platform } from 'react-native'`, and
   * it is right to — Android elevation and iOS shadow offsets are native ideas
   * with no CSS equivalent. The barrel re-exports it, so importing the theme
   * the convenient way puts React Native in a Vite bundle and the build dies on
   * Flow syntax in a file nobody meant to include.
   *
   * These three are the tokens that genuinely are shared. Listing them by name
   * is the point: it says exactly which files two products depend on.
   */
  it('the shared design tokens run in a browser', () => {
    const offenders: string[] = [];

    for (const file of [
      'shared/theme/colors.ts',
      'shared/theme/spacing.ts',
      'shared/theme/typography.ts',
    ]) {
      for (const specifier of importsOf(file)) {
        // `import type { TextStyle } from 'react-native'` is fine and typography
        // uses it. Only runtime imports reach a bundle, so match on those.
        const source = readFileSync(path.join(SRC, file), 'utf8');
        const typeOnly = new RegExp(`import\\s+type[^;]*from\\s+['"]${specifier}['"]`).test(source);
        if (isNative(specifier) && !typeOnly) offenders.push(`${file} -> ${specifier}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('only infrastructure/supabase imports the Supabase SDK', () => {
    const offenders: string[] = [];

    for (const layer of ['domain', 'data', 'presentation', 'app', 'shared']) {
      for (const file of filesIn(layer)) {
        if (importsOf(file).some((specifier) => specifier.startsWith('@supabase/'))) {
          offenders.push(file);
        }
      }
    }

    // This is the assertion the whole architecture exists to make true. If it
    // fails, replacing Supabase is no longer a five-line change.
    expect(offenders).toEqual([]);
  });

  it('presentation never builds a concrete repository', () => {
    const offenders: string[] = [];

    for (const file of filesIn('presentation')) {
      for (const specifier of importsOf(file)) {
        if (
          specifier.startsWith('@/data/repositories') ||
          specifier.startsWith('@/infrastructure/supabase')
        ) {
          offenders.push(`${file} -> ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('no domain entity leaks a token', () => {
    const session = readFileSync(path.join(SRC, 'domain/entities/Session.ts'), 'utf8');
    const code = session.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    // A token on a domain type is how one ends up in a log or a crash report.
    expect(code).not.toMatch(/accessToken|refreshToken|access_token|refresh_token/);
  });
});

/**
 * Require cycles.
 *
 * Metro allows them and only warns, so a cycle ships quietly and surfaces much
 * later as an undefined component with no useful stack trace. The barrel is
 * where they come from: components/index.ts imports every component, so a
 * component importing the barrel closes the loop.
 */
describe('module cycles', () => {
  it('no component imports its own barrel', () => {
    const offenders: string[] = [];

    for (const file of filesIn('presentation/components')) {
      if (file.endsWith('components/index.ts')) continue;
      if (importsOf(file).includes('@/presentation/components')) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });

  it('no screen imports the screens barrel', () => {
    const offenders: string[] = [];

    for (const file of filesIn('presentation/screens')) {
      if (file.endsWith('screens/index.ts')) continue;
      if (importsOf(file).includes('@/presentation/screens')) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});
