/**
 * Test-only module loaded FIRST by the router harness (step 70). Import order matters, so it is
 * its own module:
 *
 * 1. `standard-navigation` (an 8-line ESM-only dependency of expo-router 57 that the step-67 Jest
 *    config does not transform) is mapped to a CommonJS equivalent before expo-router loads.
 * 2. Skia is replaced by step 71's module mock: the route tree loads every file in `src/app`,
 *    including the debug `dev-gallery`, and Skia rendering is proven on device (04 §10.1).
 * 3. `expo-linking` gets the same three stubs `expo-router/testing-library` installs.
 *
 * The harness deliberately does not load `expo-router/testing-library` itself: its mocks module
 * swaps Reanimated for `react-native-reanimated/mock`, while the app's Jest setup runs the real
 * Reanimated (step 67, `setUpTests()`) that the motion kit and HeroUI Native need
 * (`useReducedMotion`, the layout-animation builders).
 */
import { jest } from '@jest/globals';

jest.mock('standard-navigation', () => ({
  createStandardNavigator: (NavigatorContent: unknown) => ({ type: 'standard', version: 1, NavigatorContent }),
}));

jest.mock('@shopify/react-native-skia', () =>
  jest
    .requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock')
    .createSkiaMock(),
);

jest.mock('expo-linking', () => ({
  ...jest.requireActual<Record<string, unknown>>('expo-linking'),
  createURL: (path: string) => `demsdemo://${path}`,
  resolveScheme: () => 'demsdemo',
  addEventListener: () => ({ remove() {} }),
}));
