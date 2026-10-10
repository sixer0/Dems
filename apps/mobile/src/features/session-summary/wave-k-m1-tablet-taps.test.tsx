// Wave K, driver M1 - gate finding G81b-03 (MAJOR) on the Session Summary itself.
//
// On the tablet the right pane holds the session details, the hashes, the "Sealed files" block
// (which arrives from the Core AFTER the pane mounted) and the two closing buttons. Under reduced
// motion the pane's layout transition left its native box at the height it had before that block
// arrived; everything below lay outside the box and took no touch (the view tree of the gate:
// pane [176..580], buttons at 1376). The cause and the device proof: implementation/142 section 2;
// the shared rule: `src/layout/wave-k-m1-pane-reduced.test.tsx`.
//
// Held here, on the screen: with reduced motion neither pane of the tablet Summary (nor the one pane
// of the phone) carries a layout transition, the closing controls are INSIDE the summary pane, and
// they answer a press.
import '@/features/session-finalizing/testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { PANE_REFLOW } from '@/layout';
import { resetMotionStateForTests } from '@/motion';
import { renderFlowApp, settle } from '@/features/session-finalizing/testing/flow-harness';
import { resetStampedForTests } from './stamp-once';

beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
});
afterEach(() => {
  resetMotionStateForTests();
  jest.restoreAllMocks();
  expect(getMissingKeys()).toEqual([]);
});

const layoutOf = (testID: string): unknown => (screen.getByTestId(testID).props as { layout?: unknown }).layout;

describe('G81b-03 - the panes of the Session Summary under reduced motion', () => {
  it('tablet: `pane-summary` and `pane-finalization` carry no layout transition; "Done", "View in Evidence" and the hash rows are inside the summary pane and answer a press', async () => {
    resetMotionStateForTests({ linkMotion: 'off' });
    renderFlowApp({ scenario: 'sealed', window: 'tabletLandscape' });
    await settle();
    expect(layoutOf('pane-summary')).toBeUndefined();
    expect(layoutOf('pane-finalization')).toBeUndefined();
    const pane = within(screen.getByTestId('pane-summary'));
    // No closing control is drawn outside the pane that owns it (the tablet has no pinned bar).
    expect(pane.getByTestId('summary-done')).toBeTruthy();
    expect(pane.getByTestId('summary-view-evidence')).toBeTruthy();
    fireEvent.press(pane.getByTestId('summary-hash-manifest'));
    await settle();
    expect(screen.getByTestId('summary-hash-sheet')).toBeTruthy();
  });

  it('tablet: "Done" answers (the summary is acknowledged and left)', async () => {
    resetMotionStateForTests({ linkMotion: 'off' });
    const h = renderFlowApp({ scenario: 'sealed', window: 'tabletLandscape' });
    await settle();
    expect(h.sim.store.getState().lastSealedAcknowledged).toBe(false);
    fireEvent.press(within(screen.getByTestId('pane-summary')).getByTestId('summary-done'));
    await settle();
    expect(h.sim.store.getState().lastSealedAcknowledged).toBe(true);
    expect(h.app.getPathname()).toBe('/home');
  });

  it('phone: the one pane carries no layout transition either (its "Sealed files" rows are inside it)', async () => {
    resetMotionStateForTests({ linkMotion: 'off' });
    renderFlowApp({ scenario: 'sealed', window: 'phonePortrait' });
    await settle();
    expect(layoutOf('pane-summary')).toBeUndefined();
  });

  it('CONTROL: under full motion the panes keep their re-flow spring', async () => {
    resetMotionStateForTests();
    renderFlowApp({ scenario: 'sealed', window: 'tabletLandscape' });
    await settle();
    expect(layoutOf('pane-summary')).toBe(PANE_REFLOW);
  });
});
