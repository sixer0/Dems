/**
 * Test-only module mocks for the Evidence suites (step 83). Import it FIRST in a test file, before
 * `@/navigation/testing/router-harness`, because HeroUI Native loads `@gorhom/bottom-sheet` when the
 * kit loads.
 *
 * - `@gorhom/bottom-sheet`: the package's own test mock (sheet content renders inline). The real
 *   sheet's worklet closure holds the whole `react-native` module, which Reanimated's JS mapper walks
 *   in Jest (step 79 finding). Sheets are proven on the devices.
 * - `@shopify/flash-list`: the layout measurements of the package's `jestSetup.js` (FlashList 2.0.2
 *   no longer exports the `RecyclerView` that file also swaps in; `FlashList` is that component), so
 *   rows render without a native layout pass.
 */
import { jest } from '@jest/globals';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));

jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => {
  const actual = jest.requireActual<Record<string, unknown>>('@shopify/flash-list/dist/recyclerview/utils/measureLayout');
  return {
    ...actual,
    measureParentSize: jest.fn(() => ({ x: 0, y: 0, width: 400, height: 2000 })),
    measureFirstChildLayout: jest.fn(() => ({ x: 0, y: 0, width: 400, height: 2000 })),
    measureItemLayout: jest.fn(() => ({ x: 0, y: 0, width: 400, height: 110 })),
  };
});
