/**
 * Jest, on the `jest-expo` preset.
 *
 * The preset matters: React Native ships untranspiled ESM in node_modules, and
 * a stock Jest config chokes on the first `import` it meets inside
 * react-native. `transformIgnorePatterns` is the allow-list of packages Jest is
 * permitted to transform — when a new native library breaks the test run with
 * "Unexpected token 'export'", adding it here is the fix.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@supabase/.*|@tanstack/.*)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/shared/constants/seedData.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
