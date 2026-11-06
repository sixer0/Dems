/**
 * Test-only module mocks for the Settings suites of backend task W82. Import it FIRST in a test file,
 * before `@/navigation/testing/router-harness`, because HeroUI Native loads `@gorhom/bottom-sheet`
 * when the kit loads.
 *
 * - `@gorhom/bottom-sheet`: the package's own test mock (sheet content renders inline). The real
 *   sheet's worklet closure holds the whole `react-native` module, which Reanimated's JS mapper walks
 *   in Jest (step 79 finding F-79-2). Sheets are proven on the devices.
 * - `@/features/home/pulse-ring`: the Stack Check ring (Skia) is not part of these screens; the route
 *   tree of the boundary tests loads it.
 */
import { jest } from '@jest/globals';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));
