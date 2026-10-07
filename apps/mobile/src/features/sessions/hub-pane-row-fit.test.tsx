// Closing-fix row CF-M2, defect R-T-4 (decision D212): on the tablet the Sessions hub list column was
// too narrow (re-test `P04_sessions_hub.png`): "Tersangka" on three lines, the duration on two, the
// session ID and the date cut to "SES-…" / "6 Oct …".
//
// Cause: in the expanded layout the list pane is 40% of what the 280 dp filters leave, about 283 dp at
// 1280 dp with the 232 dp extended rail, and the row kept the phone's 88 dp poster, so its text
// column was under 60 dp wide. Now the expanded list is never narrower than the medium list (360 dp)
// and a row in a list pane uses a 64 dp poster, one line for the duration and a chip line that wraps
// only between values. The phone row is unchanged.
//
// Jest has no layout engine: the budget test computes the text column from the same constants the
// code uses (and from text widths read off the re-test capture or the monospace advance, labelled),
// and the render tests prove the rendered styles and props come from those constants.
//
// Import order: the feature setup, then the router harness (see their headers).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { NAV_DIMENSIONS, PANE_GAP } from '@/layout';
import type { WindowName } from '@/navigation/testing/router-harness';
import { PANE_ROW, PHONE_ROW, ROW_CARD_PADDING } from './session-row';
import { EXPANDED_FILTERS_WIDTH, LIST_MIN_WIDTH, LIST_PADDING_X } from './sessions-screen';
import { renderSessionsApp, settle } from './testing/sessions-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

// Text widths in dp at font scale 1. The two mono values follow from JetBrains Mono's fixed advance
// (0.6 em); the two chip widths are read off the re-test capture `P04_sessions_hub.png` (Sealed:
// 109 px at the 2000/2560 display scale = 70 dp) or estimated from the label (Tersangka chip, labelled).
const MONO_ADVANCE_EM = 0.6;
const ID_DP = 'SES-20261006-0017'.length * 13 * MONO_ADVANCE_EM; // session ID, mono 13
const DURATION_DP = '00:01:23'.length * 12 * MONO_ADVANCE_EM; // duration, mono 12 (`data`)
const SEALED_CHIP_DP = 70; // measured
const TERSANGKA_CHIP_DP = 76; // estimate: 9 letters of Inter 12 plus the chip's padding
const CHIP_GAP_DP = 8; // `chips` gap, spacing[1]

/** The expanded list pane width at 1280 dp with the extended rail, before the minimum. */
const EXPANDED_40_PERCENT = (1280 - NAV_DIMENSIONS.extendedRail - 12 - EXPANDED_FILTERS_WIDTH - 2 * PANE_GAP.row) * 0.4;

function textColumn(listWidth: number, row: { thumbWidth: number; gap: number }, trailing = SEALED_CHIP_DP): number {
  return listWidth - 2 * LIST_PADDING_X - 2 * ROW_CARD_PADDING - row.thumbWidth - 2 * row.gap - trailing;
}

const flat = (testID: string): ViewStyle => (StyleSheet.flatten(screen.getByTestId(testID).props.style) ?? {}) as ViewStyle;

describe('R-T-4: every value of a Sessions row fits on one line in a list pane', () => {
  it('the budget: the old pane left a text column under 60 dp; the new one holds the ID and chip + duration', () => {
    expect(Math.round(EXPANDED_40_PERCENT)).toBe(283);
    const before = textColumn(EXPANDED_40_PERCENT, PHONE_ROW);
    expect(before).toBeLessThan(60);
    expect(before).toBeLessThan(ID_DP);

    const after = textColumn(Math.max(EXPANDED_40_PERCENT, LIST_MIN_WIDTH), PANE_ROW);
    expect(after).toBeGreaterThanOrEqual(ID_DP);
    expect(after).toBeGreaterThanOrEqual(TERSANGKA_CHIP_DP + CHIP_GAP_DP + DURATION_DP);
  });

  it('expanded (tablet landscape): the list pane starts at 360 dp; rows use the pane variant', async () => {
    const h = renderSessionsApp({ window: 'tabletLandscape' });
    await settle();
    const pane = flat('pane-list');
    // CF2-B (RF-T-2): a 360 dp basis instead of a 360 dp minimum (see hub-pane-split.test.tsx).
    expect(pane.flexBasis).toBe(LIST_MIN_WIDTH);
    expect(pane.flexGrow).toBe(2);
    expect(flat('pane-filters').width).toBe(EXPANDED_FILTERS_WIDTH);

    const id = h.history()[0]!.id;
    expect(flat(`session-row-thumb-${id}`)).toMatchObject({ width: PANE_ROW.thumbWidth, height: PANE_ROW.thumbHeight });
    expect(flat(`session-row-chips-${id}`).flexWrap).toBe('wrap');
    expect(screen.getByTestId(`session-row-duration-${id}`).props.numberOfLines).toBe(1);
    expect(screen.getByTestId(`session-row-id-${id}`).props.numberOfLines).toBe(1);
  });

  it.each<WindowName>(['tabletPortrait'])('medium (%s): the 360 dp list keeps its width; rows use the pane variant', async (window) => {
    const h = renderSessionsApp({ window });
    await settle();
    expect(flat('pane-list').width).toBe(LIST_MIN_WIDTH);
    const id = h.history()[0]!.id;
    expect(flat(`session-row-thumb-${id}`)).toMatchObject({ width: PANE_ROW.thumbWidth, height: PANE_ROW.thumbHeight });
    expect(flat(`session-row-chips-${id}`).flexWrap).toBe('wrap');
  });

  it('phone portrait: the row is unchanged (88 x 68 poster, 12 dp gap, no wrap, no line cap on the duration)', async () => {
    const h = renderSessionsApp();
    await settle();
    const id = h.history()[0]!.id;
    expect(PHONE_ROW).toEqual({ thumbWidth: 88, thumbHeight: 68, gap: 12 });
    expect(flat(`session-row-thumb-${id}`)).toMatchObject({ width: 88, height: 68 });
    expect(flat(`session-row-chips-${id}`).flexWrap).toBeUndefined();
    expect(screen.getByTestId(`session-row-duration-${id}`).props.numberOfLines).toBeUndefined();
    expect(screen.queryByTestId('pane-list')).toBeNull();
  });
});
