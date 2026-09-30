// masterplan/01_specs.md §8, adjusted for Reanimated 4.5 + Worklets 0.10: the native Worklets
// module cannot load in Jest, so it is replaced by the mock Worklets ships; the real Reanimated
// then runs its JS implementation, configured by its own setUpTests().
import { jest } from '@jest/globals';

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));

jest
  .requireActual<{ setUpTests: () => void }>('react-native-reanimated')
  .setUpTests();
