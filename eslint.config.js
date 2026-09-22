// ESLint flat config (ESLint 9).
//
// `eslint-config-expo` brings the React, React Hooks, React Native and
// TypeScript rules for this Expo SDK. `eslint-config-prettier` goes last and
// switches off everything that would fight the formatter — formatting is
// Prettier's job, correctness is ESLint's.
//
// The interesting part is the per-layer import rules further down. Clean
// Architecture is a set of promises about which direction dependencies point,
// and a promise nobody checks is a comment. These make a violation fail the
// build instead of surviving review.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

/** Message shown when a layer reaches somewhere it must not. */
const layerViolation = (from, to, why) => `${from} must not import from ${to}. ${why}`;

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // `admin/` is a separate Vite app with its own tsconfig, its own lib and
    // jsx settings, and a browser target. Linting it with the React Native
    // config here would be linting it against the wrong platform.
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'android/*', 'ios/*', 'coverage/*', 'admin/*'],
  },

  /* ---------------------------------------------------------------- general */
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  /* ------------------------------------------------- the architecture rules */

  // The Supabase SDK may be imported in exactly one place. This single rule is
  // what makes "we can swap the backend" true rather than aspirational: if it
  // passes, no screen, hook or use case can possibly be holding a Supabase
  // client, because the compiler would have nowhere to get one from.
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/infrastructure/supabase/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message:
                'Only src/infrastructure/supabase may import the Supabase SDK. Everything else goes through a repository interface.',
            },
          ],
          patterns: [
            {
              group: ['../../*'],
              message: 'Use the `@/` alias instead of climbing out of a folder.',
            },
          ],
        },
      ],
    },
  },

  // The domain is the innermost layer. It depends on nothing — not on the
  // framework, not on the database, not on the screen. That is what lets the
  // business rules be tested with no React, no network and no Supabase.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data/*', '@/infrastructure/*', '@/presentation/*', '@/app/*'],
              message: layerViolation(
                'domain',
                'data, infrastructure, presentation or app',
                'The domain is the innermost layer and must depend on nothing.',
              ),
            },
            {
              group: ['react', 'react-native', 'react-native/*', '@react-navigation/*'],
              message: layerViolation(
                'domain',
                'React or React Native',
                'Business rules must be usable from a web or server client too.',
              ),
            },
          ],
        },
      ],
    },
  },

  // The data layer implements domain interfaces using infrastructure. It must
  // never reach up into the UI.
  {
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/presentation/*', '@/app/*'],
              message: layerViolation(
                'data',
                'presentation or app',
                'Data flows up to the UI, never the other way.',
              ),
            },
          ],
        },
      ],
    },
  },

  // A component must not import its own barrel. components/index.ts imports
  // every component, so a component importing the barrel is a require cycle —
  // Metro warns about it, and when one actually bites you get an undefined
  // component at runtime with no useful stack trace.
  {
    files: ['src/presentation/components/**/*.{ts,tsx}'],
    ignores: ['src/presentation/components/index.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/presentation/components',
              message:
                'Import the sibling file directly (e.g. @/presentation/components/common/AppText). Importing the barrel from inside it creates a require cycle.',
            },
          ],
        },
      ],
    },
  },

  // Presentation renders. It may use domain types and hooks, and must reach the
  // outside world only through the container.
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Screens never touch the SDK. Use a hook, which uses a repository.',
            },
          ],
          patterns: [
            {
              group: ['@/data/repositories/*', '@/infrastructure/supabase/*'],
              message: layerViolation(
                'presentation',
                'a concrete repository or the Supabase client',
                'Resolve dependencies through useRepositories() / useUseCases() instead.',
              ),
            },
          ],
        },
      ],
    },
  },

  /* --------------------------------------------------------------- configs */
  {
    files: ['*.config.js', 'metro.config.js', 'babel.config.js', 'jest.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      // A test is allowed to build concrete implementations directly — that is
      // the point of it.
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    // Plain JS, so the TypeScript plugin's rules do not exist here.
    files: ['jest.setup.js'],
    languageOptions: {
      globals: { jest: 'readonly' },
    },
  },
]);
