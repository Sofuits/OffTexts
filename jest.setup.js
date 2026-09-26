/**
 * Test environment setup.
 *
 * Only native modules are mocked here — the ones with no JavaScript
 * implementation, which throw the moment they are imported under Node. Nothing
 * of ours is mocked: the in-memory repositories are real implementations, so
 * tests exercise real code paths rather than assertions about a mock.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * Icons load their font asynchronously and call setState when it arrives.
 *
 * Under Jest that resolves after the test has finished, so every screen with an
 * icon on it produces "An update to Icon inside a test was not wrapped in
 * act(...)" — dozens of them, which is how a real warning goes unnoticed.
 *
 * The replacement forwards every prop to a View, so an icon carrying an
 * `accessibilityLabel` is still queryable. `glyphMap` is only ever used as a
 * TypeScript type (`keyof typeof Ionicons.glyphMap`), which is erased before
 * this mock exists, so an empty object is enough.
 */
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');

  const iconSet = (displayName) => {
    const Icon = (props) => React.createElement(View, props);
    Icon.displayName = displayName;
    Icon.glyphMap = {};
    return Icon;
  };

  return {
    Ionicons: iconSet('Ionicons'),
    MaterialIcons: iconSet('MaterialIcons'),
    MaterialCommunityIcons: iconSet('MaterialCommunityIcons'),
    Feather: iconSet('Feather'),
    FontAwesome: iconSet('FontAwesome'),
  };
});

/**
 * The camera roll does not exist under Node.
 *
 * `src/app/di/container.ts` constructs an `ExpoImagePicker` in the production
 * branch, so the module is imported the moment the container file is loaded —
 * even by a test that wires `UnavailableImagePicker` instead. The mock stops
 * that import throwing; nothing calls through it, because `createTestContainer`
 * injects the unavailable picker.
 */
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: false, canAskAgain: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
}));

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

/**
 * SafeAreaProvider measures its own frame natively and renders nothing until
 * that measurement arrives — which never happens under Jest. Without this mock
 * every screen renders as an empty <RNCSafeAreaProvider /> and every query is
 * "unable to find an element", which looks like a broken component and is not.
 */
jest.mock(
  'react-native-safe-area-context',
  () =>
    // `.default` because the shipped mock uses `export default`, and Babel's
    // interop wraps it. Without it, SafeAreaProvider is undefined and React
    // reports "Element type is invalid" pointing at AppProviders — a confusing
    // error a long way from its cause.
    require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest
    .fn()
    .mockResolvedValue({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
  addEventListener: jest.fn(() => () => {}),
}));

// Timers are used by the in-memory repositories to simulate latency. Keeping
// real timers makes the tests read normally; the delays are ~200ms.
jest.setTimeout(20000);
