// Closing-fix row CF2-B, defect RF-T-5 (decision D227): on the tablet's Network & Time (third pane, a
// row about 290 dp wide) "Last Sync" drew only "6 Oct 2026" of "6 Oct 2026 16:46:47" and "Time Source"
// ended in "GPS (GNSS Str…" (re-test `S06_network_time.png`; CF2-B's before-capture
// `13b_rft5_before_network_time_card.png`). The value texts had `numberOfLines={1}`.
//
// Now the values have no line cap and wrap between words, right-aligned. Jest has no layout engine: the
// budget test uses the value boxes measured on the tablet (uiautomator bounds, 2 px/dp) and the
// monospace advance (JetBrains Mono, 0.6 em) to show that one line cannot hold the Last Sync value while
// each wrapped line fits; the render tests prove the line cap is gone on every layout.
//
// Import order: the feature setup, then the router harness (see their headers).
import './testing/network-time-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { StyleSheet, type TextStyle } from 'react-native';
import type { WindowName } from '@/navigation/testing/router-harness';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderNetworkTimeApp, settle } from './testing/network-time-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

/** Value boxes on the tablet before the fix (CF2-B `q/b_network_time.txt`): [2197..2464] and [2235..2464] px. */
const LAST_SYNC_BOX_DP = (2464 - 2197) / 2;
const SOURCE_BOX_DP = (2464 - 2235) / 2;
const MONO_13_ADVANCE_DP = 13 * 0.6; // `styles.mono`: JetBrains Mono 13

const VALUES = ['last-sync', 'source', 'server'] as const;

describe('RF-T-5: Last Sync and Time Source are shown in full', () => {
  it('the budget: one line cannot hold "6 Oct 2026 16:46:47" in the tablet box; the date and the time each fit', () => {
    expect(LAST_SYNC_BOX_DP).toBe(133.5);
    expect('6 Oct 2026 16:46:47'.length * MONO_13_ADVANCE_DP).toBeGreaterThan(LAST_SYNC_BOX_DP);
    expect('6 Oct 2026'.length * MONO_13_ADVANCE_DP).toBeLessThanOrEqual(LAST_SYNC_BOX_DP);
    expect('16:46:47'.length * MONO_13_ADVANCE_DP).toBeLessThanOrEqual(LAST_SYNC_BOX_DP);
    // Time Source (Inter, no fixed advance): the device drew an ellipsis in this box, so one line is too
    // narrow there; the wrap point is the space in "GPS (GNSS | Stratum-1)".
    expect(SOURCE_BOX_DP).toBe(114.5);
  });

  it.each<WindowName>(['tabletLandscape', 'tabletPortrait', 'phonePortrait'])(
    '%s: the three values have no line cap and wrap right-aligned',
    async (window) => {
      renderNetworkTimeApp({ window });
      await settle();
      for (const id of VALUES) {
        const node = screen.getByTestId(`network-time-${id}-value`);
        expect(node.props.numberOfLines).toBeUndefined();
        expect(node.props.ellipsizeMode).toBeUndefined();
        expect((StyleSheet.flatten(node.props.style) as TextStyle).textAlign).toBe('right');
      }
      // The whole value is in the text (nothing cut in the string itself).
      expect(screen.getByTestId('network-time-source-value')).toHaveTextContent('GPS (GNSS Stratum-1)');
      expect(String(screen.getByTestId('network-time-last-sync-value').props.children)).toMatch(/^\d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2}$/);
    },
  );
});
