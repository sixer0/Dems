// Post-review fix FXR-M, finding W93-2 (code review W93, decision D243; the RF-T-1 cause of CF2-B, D235).
//
// The Audit row is a kit `Card` (overflow hidden, a corner radius and a shadow) that had a 1 dp border only
// while selected or broken and none otherwise, and a `GlowLayer` (Reanimated views) mounted only while
// selected. On the tablet that exact shape left Evidence and Sessions rows that LOST the selection drawn as
// empty cards (CF2-B proved the border change is the trigger). Jest cannot draw the empty card; it checks the
// three conditions CF2-B's device fix rests on, under the worst case of the device's dropped animation
// updates (every `useAnimatedStyle` keeps the style of its first render):
// 1. a selection change mounts or removes nothing inside the row (same host children, same order);
// 2. React draws the final state: the selected row's glow at opacity 1, every other row's at 0, the
//    deselected row's text at full effective opacity;
// 3. the card changes its border COLOUR only: the same border width in every state.
// What only the device can confirm (the deselected Audit row is drawn) is W94-W96's.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/audit-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { ROW_CARD_BORDER } from '@/components/composed/selection-glow';
import { effectiveOpacity, flat, hostChildren, hostParent, isHostText } from '@/features/evidence/testing/row-tree';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderAuditApp, settle } from './testing/audit-harness';

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

/** The row's outer View: the host parent of the pressable `audit-row-<seq>`. */
const rowWrap = (seq: number): ReactTestInstance => hostParent(screen.getByTestId(`audit-row-${seq}`));
const rowShape = (seq: number): string[] => hostChildren(rowWrap(seq)).map((node) => String(node.props.testID ?? node.type));
const card = (seq: number): ReactTestInstance => screen.getAllByTestId(`audit-row-card-${seq}`).filter((n) => typeof n.type === 'string')[0]!;
function cardGeometry(seq: number): Record<string, unknown> {
  const { borderColor: _ignored, ...rest } = flat(card(seq)) as Record<string, unknown>;
  return rest;
}
const glowOpacity = (seq: number): unknown => flat(screen.getByTestId(`audit-row-selected-${seq}`, { includeHiddenElements: true })).opacity;

describe('W93-2: the Audit row that loses the selection is still drawn (tablet landscape)', () => {
  it('a selection change mounts nothing, changes the border colour only, and React draws the glow and the text', async () => {
    const h = renderAuditApp({ window: 'tabletLandscape' });
    await settle();
    const rows = h.sim.store.getState().audit.rows;
    const a = rows.at(-2)!.seq;
    const b = rows.at(-3)!.seq;

    const shapeA = rowShape(a);
    expect(shapeA).toEqual([`audit-row-${a}`, `audit-row-selected-${a}`]);
    const unselected = cardGeometry(a);
    expect(unselected).toMatchObject({ borderWidth: ROW_CARD_BORDER.borderWidth });
    expect(flat(card(a)).borderColor).toBe('transparent');
    expect(glowOpacity(a)).toBe(0);

    fireEvent.press(screen.getByTestId(`audit-row-${a}`));
    await settle();
    expect(rowShape(a)).toEqual(shapeA);
    expect(cardGeometry(a)).toEqual(unselected);
    expect(flat(card(a)).borderColor).not.toBe('transparent');
    expect(glowOpacity(a)).toBe(1);

    fireEvent.press(screen.getByTestId(`audit-row-${b}`));
    await settle();
    expect(rowShape(a)).toEqual(shapeA);
    expect(rowShape(b)).toEqual([`audit-row-${b}`, `audit-row-selected-${b}`]);
    expect(cardGeometry(a)).toEqual(unselected);
    expect(flat(card(a)).borderColor).toBe('transparent');
    expect(glowOpacity(a)).toBe(0);
    expect(glowOpacity(b)).toBe(1);
    const texts = screen.getByTestId(`audit-row-${a}`).findAll(isHostText).map(effectiveOpacity);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((o) => o === 1)).toBe(true);
  });
});
