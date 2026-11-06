/**
 * Test-only module mocks for the Live suites of Storage (backend task, plan row W79). Import it FIRST in
 * a test file, before `@/navigation/testing/router-harness`, because HeroUI Native loads
 * `@gorhom/bottom-sheet` when the kit loads.
 *
 * - `@gorhom/bottom-sheet`: the package's own test mock (sheet content renders inline). The real sheet's
 *   worklet closure holds the whole `react-native` module, which Reanimated's JS mapper walks in Jest
 *   (step 79 finding). Sheets are proven on the devices.
 * Nothing else is mocked: the capacity ring's Skia canvas is covered by the router harness's Skia mock
 * (step 71). The same mock as `features/devices/testing/devices-test-setup.ts` and
 * `features/network-time/testing/network-time-test-setup.ts`, kept in this folder so the folder's suites
 * depend on no other row's files.
 */
import { jest } from '@jest/globals';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));
