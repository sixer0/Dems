/**
 * Test-only module mocks for the Devices & Inputs suites (step 84). Import it FIRST in a test file,
 * before `@/navigation/testing/router-harness`, because HeroUI Native loads `@gorhom/bottom-sheet`
 * when the kit loads.
 *
 * - `@gorhom/bottom-sheet`: the package's own test mock (sheet content renders inline). The real
 *   sheet's worklet closure holds the whole `react-native` module, which Reanimated's JS mapper walks
 *   in Jest (step 79 finding). Sheets are proven on the devices.
 * - `victory-native`: it draws with Skia, which the router harness replaces with step 71's mock, so
 *   `CartesianChart` becomes a host View that runs its render function with the data as points
 *   (one per row) and `Line` a host View that receives its props. The chart's real drawing is
 *   proven on the device.
 */
import { jest } from '@jest/globals';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));

type MockPoint = { x: number; y: number; xValue: number; yValue: number };
interface MockChartProps {
  data: Record<string, number>[];
  xKey: string;
  yKeys: string[];
  domain?: { y?: [number, number] };
  children: (args: { points: Record<string, MockPoint[]> }) => import('react').ReactNode;
}

jest.mock('victory-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const CartesianChart = ({ data, xKey, yKeys, domain, children }: MockChartProps) => {
    const points: Record<string, MockPoint[]> = {};
    for (const key of yKeys) {
      points[key] = data.map((row, index) => ({ x: index, y: row[key] ?? 0, xValue: row[xKey] ?? 0, yValue: row[key] ?? 0 }));
    }
    const hostProps: Record<string, unknown> = { testID: 'victory-chart', dataLength: data.length, domainY: domain?.y };
    return React.createElement(View, hostProps, children({ points }));
  };
  const Line = (props: Record<string, unknown>) => React.createElement(View, { testID: 'victory-line', ...props });
  return { __esModule: true, CartesianChart, Line };
});
