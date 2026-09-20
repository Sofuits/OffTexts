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
