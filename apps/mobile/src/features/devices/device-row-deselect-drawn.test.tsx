// Post-review fix FXR-M, finding W93-4 (code review W93, decision D243; the RF-T-1 cause of CF2-B, D235).
//
// The Devices row (`ListGroup.Item`) had a 1 dp border and a tint only while selected, and its `GlowLayer`
// (Reanimated views) was mounted only while selected: the pre-CF2-B Evidence shape that left deselected rows
// drawn empty on the tablet. Under the worst case of dropped animation updates (every `useAnimatedStyle`
// keeps its first style), a selection change must mount nothing inside the row, keep the border WIDTH in
// every state (colour only), and React must draw the glow's final opacity. Device confirmation: W94-W96.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { ROW_CARD_BORDER } from '@/components/composed/selection-glow';
import { flat, hostChildren } from '@/features/evidence/testing/row-tree';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderDevicesApp, settle } from './testing/devices-harness';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    ...actual,
    useAnimatedStyle: (updater: () => Record<string, unknown>) => {
      const first = React.useRef<Record<string, unknown> | null>(null);
      if (first.current === null) first.current = updater();
      return first.current;
    },
  };
});

beforeEach(() => resetMissingKeys());
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

const host = (testID: string): ReactTestInstance =>
  screen.getAllByTestId(testID, { includeHiddenElements: true }).filter((n) => typeof n.type === 'string')[0]!;
const rowShape = (id: string): string[] => hostChildren(host(`device-row-wrap-${id}`)).map((n) => String(n.props.testID ?? n.type));
function itemGeometry(id: string): Record<string, unknown> {
  const { borderColor: _c, backgroundColor: _b, ...rest } = flat(host(`device-row-${id}`)) as Record<string, unknown>;
  return rest;
}
const glowOpacity = (id: string): unknown => flat(host(`device-row-glow-${id}`)).opacity;

describe('W93-4: the Devices row that loses the selection is still drawn (tablet landscape)', () => {
  it('MIC-02 then POE-SWITCH: nothing mounted or removed in MIC-02, the same border width, the glow drawn by React', async () => {
    renderDevicesApp({ window: 'tabletLandscape' });
    await settle();
    const shape = rowShape('MIC-02');
    expect(shape).toEqual(['device-row-MIC-02', 'device-row-glow-MIC-02']);
    const unselected = itemGeometry('MIC-02');
    expect(unselected).toMatchObject({ borderWidth: ROW_CARD_BORDER.borderWidth });
    expect(glowOpacity('MIC-02')).toBe(0);

    fireEvent.press(screen.getByTestId('device-row-MIC-02'));
    await settle();
    expect(rowShape('MIC-02')).toEqual(shape);
    expect(itemGeometry('MIC-02')).toEqual(unselected);
    expect(flat(host('device-row-MIC-02')).borderColor).not.toBe('transparent');
    expect(glowOpacity('MIC-02')).toBe(1);

    fireEvent.press(screen.getByTestId('device-row-POE-SWITCH'));
    await settle();
    expect(rowShape('MIC-02')).toEqual(shape);
    expect(itemGeometry('MIC-02')).toEqual(unselected);
    expect(flat(host('device-row-MIC-02')).borderColor).toBe('transparent');
    expect(glowOpacity('MIC-02')).toBe(0);
    expect(glowOpacity('POE-SWITCH')).toBe(1);
  });
});
