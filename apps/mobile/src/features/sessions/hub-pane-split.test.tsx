// Closing-fix row CF2-B, defect RF-T-2 (decision D227): on the tablet the Sessions hub detail pane was
// squeezed to about 206 dp (re-test `D4_sessions_hub_before_P05_left_after_D2_right.png`): labels broke
// inside words ("Case Num ber", "Subj ect"), the subject name was not drawn. CF2-B's before-capture
// measured the same: `pane-list` [1072..2067] px, `pane-detail` [2115..2528] px, i.e. 497.5 | 206.5 dp.
//
// Cause: CF-M2's expanded list was `flex: 2, minWidth: 360` on a zero basis next to a `flex: 3` detail.
// React Native's Yoga raises a basis to its minimum FIRST and then still hands out the free space by the
// grow factors (`ReactCommon/yoga/yoga/algorithm/CalculateLayout.cpp`, `distributeFreeSpaceFirstPass` and
// `distributeFreeSpaceSecondPass`: the bounded basis plus remaining / total grow x grow). So the list got
// 360 + 2/5 of the rest.
//
// Jest has no layout engine. `yogaRow` below follows those two passes for one row of flex items (grow,
// shrink, basis, min) and is calibrated against the device: fed the old pane styles it gives the
// measured 497.5 | 206.5 dp. The render tests read the pane styles from the rendered tree (not from the
// constants) and run them through it.
//
// Import order: the feature setup, then the router harness (see their headers).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import { screen } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { NAV_DIMENSIONS, PANE_GAP } from '@/layout';
import { DETAIL_MIN_WIDTH, DETAIL_PANE_FLEX, EXPANDED_FILTERS_WIDTH, LIST_MIN_WIDTH, LIST_PANE_FLEX } from './sessions-screen';
import { renderSessionsApp, settle } from './testing/sessions-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

interface FlexItem {
  basis: number;
  grow: number;
  shrink: number;
  min: number;
}

/** A flex item from a flattened React Native style, with React Native's (non-web) Yoga defaults. */
function itemFromStyle(style: ViewStyle): FlexItem {
  const flex = typeof style.flex === 'number' ? style.flex : 0;
  const basis = style.flexBasis ?? (flex > 0 ? 0 : undefined);
  if (typeof basis !== 'number') throw new Error(`unsupported flexBasis ${String(basis)}`);
  return {
    basis,
    grow: style.flexGrow ?? Math.max(flex, 0),
    shrink: style.flexShrink ?? (flex < 0 ? -flex : 0),
    min: typeof style.minWidth === 'number' ? style.minWidth : 0,
  };
}

/** Yoga's main-axis sizes for one line of flex items in `available` dp (no max constraints). */
function yogaRow(available: number, items: readonly FlexItem[]): number[] {
  const bound = (item: FlexItem, size: number) => Math.max(size, item.min);
  const bases = items.map((item) => bound(item, item.basis));
  let remaining = available - bases.reduce((a, b) => a + b, 0);
  let totalGrow = items.reduce((a, item) => a + item.grow, 0);
  let totalShrink = items.reduce((a, item) => a + item.shrink * item.basis, 0);
  // First pass: an item its min would clamp leaves the distribution (its delta comes off `remaining`).
  let delta = 0;
  items.forEach((item, i) => {
    const bb = bases[i]!;
    if (remaining < 0 && item.shrink * bb !== 0) {
      const size = bb + (remaining / totalShrink) * item.shrink * bb;
      if (bound(item, size) !== size) {
        delta += bound(item, size) - bb;
        totalShrink -= item.shrink * item.basis;
      }
    } else if (remaining > 0 && item.grow !== 0) {
      const size = bb + (remaining / totalGrow) * item.grow;
      if (bound(item, size) !== size) {
        delta += bound(item, size) - bb;
        totalGrow -= item.grow;
      }
    }
  });
  remaining -= delta;
  // Second pass: every flexible item from its bounded basis.
  return items.map((item, i) => {
    const bb = bases[i]!;
    if (remaining < 0 && item.shrink * bb !== 0) return bound(item, bb + (remaining / totalShrink) * item.shrink * bb);
    if (remaining > 0 && item.grow !== 0) return bound(item, bb + (remaining / totalGrow) * item.grow);
    return bb;
  });
}

/** List + detail space in the tablet capture: the pane row 464..2528 px (2 px/dp) less filters and two gaps. */
const DEVICE_ROW_DP = (2528 - 464) / 2;
const AVAILABLE_DP = DEVICE_ROW_DP - EXPANDED_FILTERS_WIDTH - 2 * PANE_GAP.row;
/** The same with the rail collapsed (88 dp instead of 232 dp). */
const AVAILABLE_COLLAPSED_DP = AVAILABLE_DP + NAV_DIMENSIONS.extendedRail - NAV_DIMENSIONS.rail;
/** CF-M2's pane styles as rendered (rollback copy of `sessions-screen.tsx`: `Pane` sizing merged with `flexBasis: 0`). */
const OLD_LIST: ViewStyle = { flex: 2, minWidth: 360, flexBasis: 0 };
const OLD_DETAIL: ViewStyle = { flex: 3, minWidth: 0, flexBasis: 0 };

const flat = (testID: string): ViewStyle => (StyleSheet.flatten(screen.getByTestId(testID).props.style) ?? {}) as ViewStyle;

describe('RF-T-2: the Sessions hub list and detail panes both stay usable', () => {
  it('the model reproduces the device: the old styles give 497.5 | 206.5 dp on the tablet', () => {
    expect(AVAILABLE_DP).toBe(704);
    const [list, detail] = yogaRow(AVAILABLE_DP, [itemFromStyle(OLD_LIST), itemFromStyle(OLD_DETAIL)]);
    expect(list).toBeCloseTo((2067 - 1072) / 2, 0);
    expect(detail).toBeCloseTo((2528 - 2115) / 2, 0);
  });

  it('expanded (tablet landscape): the rendered panes give the list >= 360 dp and the detail >= 340 dp', async () => {
    renderSessionsApp({ window: 'tabletLandscape' });
    await settle();
    const listStyle = flat('pane-list');
    const detailStyle = flat('pane-detail');
    expect(listStyle).toMatchObject(LIST_PANE_FLEX);
    expect(detailStyle).toMatchObject(DETAIL_PANE_FLEX);
    // No minimum for Yoga to raise a basis to (the cause of the defect).
    expect(listStyle.minWidth ?? 0).toBe(0);
    expect(detailStyle.minWidth ?? 0).toBe(0);

    const items = [itemFromStyle(listStyle), itemFromStyle(detailStyle)];
    const [list, detail] = yogaRow(AVAILABLE_DP, items);
    expect(list! + detail!).toBeCloseTo(AVAILABLE_DP, 6);
    expect(list).toBeGreaterThanOrEqual(LIST_MIN_WIDTH);
    expect(detail).toBeGreaterThanOrEqual(DETAIL_MIN_WIDTH);
    expect(list).toBeLessThan(LIST_MIN_WIDTH + 5);

    // Rail collapsed: the extra space is split 2 : 3 on top of the start widths.
    const [listC, detailC] = yogaRow(AVAILABLE_COLLAPSED_DP, items);
    const extra = AVAILABLE_COLLAPSED_DP - LIST_MIN_WIDTH - DETAIL_MIN_WIDTH;
    expect(listC).toBeCloseTo(LIST_MIN_WIDTH + (extra * 2) / 5, 6);
    expect(detailC).toBeCloseTo(DETAIL_MIN_WIDTH + (extra * 3) / 5, 6);

    // A narrower row (expanded class at 1000 dp, collapsed rail): both shrink in proportion, neither to 0.
    const narrow = 1000 - NAV_DIMENSIONS.rail - 12 - EXPANDED_FILTERS_WIDTH - 2 * PANE_GAP.row;
    const [listN, detailN] = yogaRow(narrow, items);
    expect(listN! / detailN!).toBeCloseTo(LIST_MIN_WIDTH / DETAIL_MIN_WIDTH, 6);
    expect(listN! + detailN!).toBeCloseTo(narrow, 6);
  });

  it('medium (tablet portrait): the 360 dp list is unchanged and the detail takes the rest', async () => {
    renderSessionsApp({ window: 'tabletPortrait' });
    await settle();
    expect(flat('pane-list')).toMatchObject({ width: LIST_MIN_WIDTH, flexGrow: 0, flexShrink: 0 });
    const detail = itemFromStyle(flat('pane-detail'));
    expect(detail).toMatchObject({ basis: 0, grow: 1, min: 0 });
  });
});
