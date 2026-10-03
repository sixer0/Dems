/**
 * Test-only module mocks for the Start Session suites (step 78). Import it FIRST, before
 * `@/navigation/testing/router-harness`, because HeroUI Native loads `@gorhom/bottom-sheet` when the
 * kit loads.
 *
 * Why (step 79's finding, reproduced here for the investigator Select, whose phone presentation is
 * a bottom sheet): the real gorhom sheet has a worklet whose closure holds the whole `react-native`
 * module; Reanimated's JS mapper walks closure values in Jest and touches the lazy `DevMenu`
 * getter, which has no native module there. The package ships a mock for test runners that renders
 * sheet content inline. Sheets are proven on the devices.
 */
import { jest } from '@jest/globals';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));
