// Closing-fix row CF-M2, defect R-T-3 (decision D212): on the tablet's Network & Time the Bandwidth
// label read "Bandwidt": the sparkline sat over its end (re-test `P12_network_time.png`). The three-pane
// card is about 290 dp wide, but the one-line row (padding, icon, label, bars at their 56 dp minimum,
// readout) needs about 314 dp, so the right-aligned suffix overflowed to the left over the label.
//
// Now the row measures its width and, when it is too narrow for one line, puts the sparkline under
// the label (the label keeps its whole width) and the readout on the right. The phone (about 348 dp)
// keeps the MB 9 one-line row. Jest has no layout engine: the tests drive the row's `onLayout` with
// the widths measured on the devices and check which arrangement renders.
//
// Import order: the feature setup, then the router harness (see their headers).
import './testing/network-time-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { BANDWIDTH_CHART_SIZE } from './bandwidth-bars';
import { ICON_TILE_SIZE } from './icon-tile';
import { BANDWIDTH_ROW_METRICS, bandwidthInlineMinWidth } from './network-status-card';
import { renderNetworkTimeApp, settle } from './testing/network-time-harness';

/** Row widths (padding included) read from the re-test captures: tablet three-pane card, phone portrait. */
const TABLET_ROW_DP = 290;
const PHONE_ROW_DP = 348;

beforeEach(() => resetMissingKeys());
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

function layoutRow(width: number): void {
  act(() => {
    fireEvent(screen.getByTestId('network-time-bandwidth'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 64 } } });
  });
}

function expectStacked(): void {
  const column = within(screen.getByTestId('network-time-bandwidth-stacked'));
  expect(column.getByTestId('network-time-bandwidth-label')).toHaveTextContent('Bandwidth');
  // The bars are under the label, in the content column, not beside the readout.
  expect(column.getByTestId('network-time-bandwidth-bars')).toBeTruthy();
  expect(column.queryByTestId('network-time-bandwidth-readout')).toBeNull();
  expect(screen.queryByTestId('network-time-bandwidth-inline')).toBeNull();
  expect(screen.getByTestId('network-time-bandwidth-readout')).toBeTruthy();
}

function expectInline(): void {
  const label = within(screen.getByTestId('network-time-bandwidth-inline'));
  expect(label.getByTestId('network-time-bandwidth-label')).toHaveTextContent('Bandwidth');
  expect(label.queryByTestId('network-time-bandwidth-bars')).toBeNull();
  expect(screen.queryByTestId('network-time-bandwidth-stacked')).toBeNull();
  expect(screen.getByTestId('network-time-bandwidth-bars')).toBeTruthy();
}

describe('R-T-3: the Bandwidth label keeps its room', () => {
  it('the one-line budget: wider than the tablet card, within the phone row at font scale 1', () => {
    const m = BANDWIDTH_ROW_METRICS;
    expect(m.bars).toBe(BANDWIDTH_CHART_SIZE.minWidth);
    expect(m.icon).toBe(ICON_TILE_SIZE);
    expect(bandwidthInlineMinWidth(1)).toBe(2 * 16 + 36 + 2 * 12 + 10 + 56 + 72 + 84);
    expect(bandwidthInlineMinWidth(1)).toBeGreaterThan(TABLET_ROW_DP);
    expect(bandwidthInlineMinWidth(1)).toBeLessThanOrEqual(PHONE_ROW_DP);
    // The texts cap their scale at 1.2: a larger system font counts as 1.2, a smaller one as 1.
    expect(bandwidthInlineMinWidth(2)).toBe(bandwidthInlineMinWidth(1.2));
    expect(bandwidthInlineMinWidth(0.85)).toBe(bandwidthInlineMinWidth(1));
  });

  it('tablet (three panes): stacked before the first layout and at the measured 290 dp', async () => {
    renderNetworkTimeApp({ window: 'tabletLandscape' });
    await settle();
    expectStacked();
    layoutRow(TABLET_ROW_DP);
    expectStacked();
  });

  it('phone portrait: the MB 9 one-line row, before and after the measured 348 dp', async () => {
    renderNetworkTimeApp();
    await settle();
    expectInline();
    layoutRow(PHONE_ROW_DP);
    expectInline();
  });

  it('a narrow phone row (a 360 dp phone, about 297 dp) stacks; a wide tablet card goes back to one line', async () => {
    renderNetworkTimeApp();
    await settle();
    layoutRow(297);
    expectStacked();
    layoutRow(420);
    expectInline();
  });
});
