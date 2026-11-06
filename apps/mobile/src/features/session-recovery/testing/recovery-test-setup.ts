/**
 * Test-only module mocks for the step-81 suites. Import it FIRST, before
 * `@/navigation/testing/router-harness`, because HeroUI Native loads `@gorhom/bottom-sheet` when
 * the kit loads.
 *
 * Why (step 79, F-79-2): the real gorhom sheet has a worklet whose closure holds the whole
 * `react-native` module; Reanimated's JS mapper walks closure values in Jest and touches the lazy
 * `DevMenu` getter, which has no native module there. The package ships a mock for test runners.
 * (Same mock as the Finalization suites; kept in this folder, P6.)
 */
import { jest } from '@jest/globals';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));
