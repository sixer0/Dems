/**
 * Test-only module mocks for the Session Monitor sheet and popover suites (step 79). Import it
 * FIRST, before `@/navigation/testing/router-harness`, because HeroUI Native loads
 * `@gorhom/bottom-sheet` when the kit loads.
 *
 * Why: the real gorhom sheet has a worklet whose closure holds the whole `react-native` module
 * (`Platform.OS` inside `useAnimatedStyle`); Reanimated's JS mapper walks closure values in Jest
 * and touches the lazy `DevMenu` getter, which has no native module there. The package ships a
 * mock for test runners; it renders sheet content inline. Sheets are proven on the devices.
 */
import { jest } from '@jest/globals';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));
