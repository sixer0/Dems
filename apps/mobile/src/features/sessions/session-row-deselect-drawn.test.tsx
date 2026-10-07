// Closing-fix row CF2-B, defect RF-T-1 in the Sessions hub (decision D227).
//
// The final re-test saw the empty card in the Evidence list; CF2-B's before-captures on the tablet show
// the same in the Sessions hub (`gateway_check/assets/13b_rft1_before_sessions_row_empty.png`): the
// session row that loses the selection is drawn as an empty card. The row had the same pattern (the
// Reanimated `GlowLayer` mounted as the first child only while selected, inside a FlashList cell) and
// now uses the same always-mounted `SelectionGlow` and keeps its card border in both states. Same model and checks as
// `features/evidence/evidence-row-deselect-drawn.test.tsx`: no mount or removal inside the row on a
// selection change, the final state drawn by React with every animation update lost, and a border
// colour change only on the card.
//
// Import order: `@jest/globals` first (the mock below needs `jest`), the feature setup, the router harness.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { effectiveOpacity, flat, hostChildren, hostParent, isHostText } from '@/features/evidence/testing/row-tree';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderSessionsApp, settle } from './testing/sessions-harness';

// The model of the device defect: no UI-thread update of an animated style ever lands.
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

const rowShape = (id: string): string[] =>
  hostChildren(hostParent(screen.getByTestId(`session-row-${id}`))).map((node) => String(node.props.testID ?? node.type));
const cardGeometry = (id: string): Record<string, unknown> => {
  const { borderColor: _ignored, ...rest } = flat(screen.getByTestId(`session-row-card-${id}`)) as Record<string, unknown>;
  return rest;
};
const glow = (id: string): ReactTestInstance => screen.getByTestId(`session-row-glow-${id}`, { includeHiddenElements: true });
const contentOpacities = (id: string): number[] =>
  screen
    .getByTestId(`session-row-${id}`)
    .findAll(isHostText)
    .map(effectiveOpacity);

describe('RF-T-1: the Sessions hub row that loses the selection is still drawn', () => {
  it('a selection change mounts or removes nothing inside a row, and React draws both rows', async () => {
    const h = renderSessionsApp({ window: 'tabletLandscape' });
    await settle();
    const [a, b] = h
      .history()
      .slice(0, 2)
      .map((entry) => entry.id);
    expect(a && b).toBeTruthy();
    const before = rowShape(a!);
    const geometry = cardGeometry(a!);
    expect(geometry).toMatchObject({ borderWidth: 1 });
    expect(before).toEqual([`session-row-${a}`, `session-row-glow-${a}`]);

    fireEvent.press(screen.getByTestId(`session-row-${a}`));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: a });
    expect(rowShape(a!)).toEqual(before);
    expect(flat(glow(a!)).opacity).toBe(1);

    fireEvent.press(screen.getByTestId(`session-row-${b}`));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: b });
    expect(rowShape(a!)).toEqual(before);
    expect(cardGeometry(a!)).toEqual(geometry);
    expect(cardGeometry(b!)).toEqual(geometry);
    expect(flat(screen.getByTestId(`session-row-card-${a}`)).borderColor).toBe('transparent');

    const texts = contentOpacities(a!);
    expect(texts.length).toBeGreaterThanOrEqual(4);
    expect(texts.every((opacity) => opacity === 1)).toBe(true);
    expect(flat(glow(a!)).opacity).toBe(0);
    expect(flat(glow(b!)).opacity).toBe(1);
    expect(hostChildren(glow(b!))).toEqual([]);
  });
});
