// Closing-fix row CF2-B, defect RF-T-1 (decision D227), simulated in jest.
//
// On the tablet the Evidence row that LOSES the selection was drawn as an empty card and stayed empty
// (3/3 in the final re-test, `test/assets/retest2/t/F1_undrawn_evidence_row_three_occurrences.png`;
// again 2/2 in CF2-B's before-captures). The row used to mount `GlowLayer` (three Reanimated views) as
// its FIRST child only while selected, so every selection change mounted or removed views inside the
// row, in place, in a FlashList cell. Jest has no native mounting layer and cannot draw the empty card;
// it checks the two conditions the fix rests on, under the worst case of the device's dropped
// animation updates (every `useAnimatedStyle` keeps the style of its first render, as in FX-M2b's
// `chrome-lost-updates.test.tsx`):
// 1. a selection change mounts or removes NOTHING inside the row: the row's host children are the same
//    elements in the same order before selection, while selected and after the selection moved on;
// 2. React draws the final state: the content of a deselected row is at full effective opacity, the glow
//    of the selected row is at opacity 1 and of every other row at 0, with no animated style on the glow;
// 3. the card changes its border COLOUR only: the same border width (insets, layout, padding-box clip of
//    the kit Card's `overflow: hidden`) in every state. CF2-B's first device run had (1) and (2) but not
//    (3) and still showed the empty card; the old card went from a 1 dp border to none on deselection.
// What only the device can confirm (the deselected row is drawn) is in gateway_check/13b_cf2_mobile_screens.md.
//
// Import order: `@jest/globals` first (the mock below needs `jest`), the feature setup, the router harness.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { ROW_CARD_BORDER, selectionGlowOpacity } from './selection-glow';
import { renderEvidenceApp, settle } from './testing/evidence-harness';
import { effectiveOpacity, flat, hostChildren, hostParent, isHostText } from './testing/row-tree';

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

/** The row's outer View: the host parent of the pressable `evidence-row-<id>`. */
function rowWrap(id: string): ReactTestInstance {
  return hostParent(screen.getByTestId(`evidence-row-${id}`));
}

/** One line per host child of the row: its testID (or type), in mount order. */
function rowShape(id: string): string[] {
  return hostChildren(rowWrap(id)).map((node) => String(node.props.testID ?? node.type));
}

/** The effective opacity of every host Text inside the row (ID, date, subject, duration, chips). */
function contentOpacities(id: string): number[] {
  return screen
    .getByTestId(`evidence-row-${id}`)
    .findAll(isHostText)
    .map(effectiveOpacity);
}

/** The card's own style without its border colour (what must not change with the selection). */
function cardGeometry(id: string): Record<string, unknown> {
  const { borderColor: _ignored, ...rest } = flat(screen.getByTestId(`evidence-row-card-${id}`)) as Record<string, unknown>;
  return rest;
}

function glow(id: string): ReactTestInstance {
  return screen.getByTestId(`evidence-row-glow-${id}`, { includeHiddenElements: true });
}

describe('RF-T-1: the Evidence row that loses the selection is still drawn', () => {
  it('a selection change mounts or removes nothing inside a row (tablet landscape)', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const a = h.idOf('0004');
    const b = h.idOf('0003');
    const before = rowShape(a);
    // The content is the first child and the glow is part of the row in every state.
    expect(before).toEqual([`evidence-row-${a}`, `evidence-row-glow-${a}`]);

    fireEvent.press(screen.getByTestId(`evidence-row-${a}`));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: a });
    expect(rowShape(a)).toEqual(before);

    fireEvent.press(screen.getByTestId(`evidence-row-${b}`));
    await settle();
    expect(h.app.getSearchParams()).toMatchObject({ selected: b });
    expect(rowShape(a)).toEqual(before);
    expect(rowShape(b)).toEqual([`evidence-row-${b}`, `evidence-row-glow-${b}`]);
  });

  it('a selection change is a border colour change only: the card keeps its 1 dp border in every state', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const a = h.idOf('0004');
    const b = h.idOf('0003');
    const unselected = cardGeometry(a);
    expect(unselected).toMatchObject({ borderWidth: ROW_CARD_BORDER.borderWidth });
    expect(flat(screen.getByTestId(`evidence-row-card-${a}`)).borderColor).toBe('transparent');

    fireEvent.press(screen.getByTestId(`evidence-row-${a}`));
    await settle();
    expect(cardGeometry(a)).toEqual(unselected);
    expect(flat(screen.getByTestId(`evidence-row-card-${a}`)).borderColor).not.toBe('transparent');

    fireEvent.press(screen.getByTestId(`evidence-row-${b}`));
    await settle();
    expect(cardGeometry(a)).toEqual(unselected);
    expect(flat(screen.getByTestId(`evidence-row-card-${a}`)).borderColor).toBe('transparent');
    expect(cardGeometry(b)).toEqual(unselected);
  });

  it('with every animation update lost, React draws the final state of both rows', async () => {
    const h = renderEvidenceApp({ window: 'tabletLandscape' });
    await settle();
    const a = h.idOf('0004');
    const b = h.idOf('0003');
    fireEvent.press(screen.getByTestId(`evidence-row-${a}`));
    await settle();
    expect(flat(glow(a)).opacity).toBe(1);
    fireEvent.press(screen.getByTestId(`evidence-row-${b}`));
    await settle();

    // The row that lost the selection: every text at full opacity, the glow off.
    const texts = contentOpacities(a);
    expect(texts.length).toBeGreaterThanOrEqual(4);
    expect(texts.every((opacity) => opacity === 1)).toBe(true);
    expect(flat(glow(a)).opacity).toBe(0);
    // The newly selected row: drawn and lit.
    expect(contentOpacities(b).every((opacity) => opacity === 1)).toBe(true);
    expect(flat(glow(b)).opacity).toBe(1);
    // The glow is one plain view (no animated child layers) that is never flattened or read by TalkBack.
    expect(hostChildren(glow(b))).toEqual([]);
    expect(glow(b).props.collapsable).toBe(false);
    expect(glow(b).props.pointerEvents).toBe('none');
    expect(glow(b).props.importantForAccessibility).toBe('no-hide-descendants');
    expect(flat(glow(b)).boxShadow).toBeTruthy();
  });

  it('selectionGlowOpacity: 1 while selected, 0 otherwise', () => {
    expect(selectionGlowOpacity(true)).toBe(1);
    expect(selectionGlowOpacity(false)).toBe(0);
  });
});
