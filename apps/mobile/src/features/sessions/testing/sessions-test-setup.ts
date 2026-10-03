/**
 * Test-only module mocks for the Sessions hub suites (step 82; the pattern of step 83's evidence
 * setup, kept in this folder per P6). Import it FIRST in a test file, before
 * `@/navigation/testing/router-harness`, because HeroUI Native loads `@gorhom/bottom-sheet` when the
 * kit loads.
 *
 * - `@gorhom/bottom-sheet`: the package's own test mock (no sheet is used here; the kit loads it).
 * - `@shopify/flash-list`: fixed layout measurements (FlashList 2.0.2), so rows render without a
 *   native layout pass.
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
    measureParentSize: jest.fn(() => ({ x: 0, y: 0, width: 400, height: 4000 })),
    measureFirstChildLayout: jest.fn(() => ({ x: 0, y: 0, width: 400, height: 4000 })),
    measureItemLayout: jest.fn(() => ({ x: 0, y: 0, width: 400, height: 100 })),
  };
});
