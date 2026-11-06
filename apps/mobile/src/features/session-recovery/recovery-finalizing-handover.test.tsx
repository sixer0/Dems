// Task 3, integration pass D7 item 2 (MB-06; row 87's request, file_requests.md 11:28:04Z;
// masterplan/08_client_ux_spec.md §5 flow 4, §5.6 "Hand-off: in place"; E-13; decision D121).
//
// A recovery that RESUMES the seal moves the session the Recovery screen shows to FINALIZING. No
// forced route change exists for that step, so the route itself hands over: the commit that drops
// the recovery view draws `<SessionFinalizingScreen handover />` in place, and the redirect follows
// (the recipe of `app/(app)/session/live.tsx`).
//
// Held here on the REAL `/session/recovery` route over a test simulator (its recovery never resumes a
// seal, so FINALIZING is put on the store as the Core sends it): every commit from the state change
// to the Finalizing route draws the recovery view or a Finalizing view — never neither — and the
// first commit without the recovery view draws the Finalizing card in place.
//
// Import order matters: the gorhom mock, then the router harness, then the recovery harness.
import './testing/recovery-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { isFinalizingHandover, resetFinalizingHandoverForTests } from '@/features/session-finalizing/handover';
import { resetMotionStateForTests } from '@/motion';
import { resetRecoveryHapticsForTests } from './session-recovery-screen';
import { renderRecoveryApp, settle, type RecoveryHarness } from './testing/recovery-harness';

type Frame = 'recovery' | 'finalizing-in-place' | 'finalizing-route' | 'empty';

let recording = false;
const frames: Frame[] = [];

/** What one commit drew (read in the Profiler's commit callback, after the host tree changed). */
function frameNow(): Frame {
  if (screen.queryByTestId('screen-session-recovery') !== null) return 'recovery';
  if (screen.queryByTestId('finalizing-card') !== null) return 'finalizing-in-place';
  if (screen.queryAllByTestId('screen-session-finalizing').length > 0) return 'finalizing-route';
  return 'empty';
}

const onRender = (): void => {
  if (recording) frames.push(frameNow());
};

/** The Core resumed the seal of this session: FINALIZING on the store. */
function resumeSeal(h: RecoveryHarness): void {
  act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, state: 'FINALIZING', recovery: null } })));
}

beforeEach(() => {
  resetFinalizingHandoverForTests();
  resetRecoveryHapticsForTests();
  frames.length = 0;
  recording = false;
});

afterEach(() => {
  resetMotionStateForTests();
});

describe('MB-06: Recovery hands over to Finalizing in place (pass D7 item 2)', () => {
  for (const window of ['phonePortrait', 'tabletLandscape'] as const) {
    it(`${window}: RECOVERY -> FINALIZING — no commit draws neither view; the first one without the recovery view draws the Finalizing card`, async () => {
      const h = renderRecoveryApp({ window, onRender });
      await settle();
      fireEvent.press(screen.getByTestId('recovery-start'));
      await settle();
      expect(h.sim.store.getState().session?.state).toBe('RECOVERY');
      expect(screen.getByTestId('recovery-analysing')).toBeTruthy();

      recording = true;
      resumeSeal(h);
      await settle();
      recording = false;

      expect(frames.length).toBeGreaterThan(0);
      expect(frames.filter((frame) => frame === 'empty')).toEqual([]);
      expect(frames.find((frame) => frame !== 'recovery')).toBe('finalizing-in-place');
      // The route follows, and the hand-over is marked: the route's own copy enters without motion.
      expect(h.app.getPathname()).toBe('/session/finalizing');
      expect(isFinalizingHandover(h.sessionId)).toBe(true);
    });
  }

  it('FAULT -> FINALIZING (the Core resumed without this device asking): the same hand-over', async () => {
    const h = renderRecoveryApp({ onRender });
    await settle();
    expect(screen.getByTestId('recovery-start')).toBeTruthy();
    recording = true;
    resumeSeal(h);
    await settle();
    recording = false;
    expect(frames.filter((frame) => frame === 'empty')).toEqual([]);
    expect(frames.find((frame) => frame !== 'recovery')).toBe('finalizing-in-place');
    expect(h.app.getPathname()).toBe('/session/finalizing');
  });

  it('CONTROL: a deep link into /session/recovery while a session this route never showed finalizes keeps the screen\'s own notice', async () => {
    const h = renderRecoveryApp({ scenario: 'recording', routeSync: false, onRender });
    await settle();
    recording = true;
    resumeSeal(h);
    await settle();
    recording = false;
    expect(h.app.getPathname()).toBe('/session/recovery');
    expect(screen.getByTestId('recovery-other')).toBeTruthy();
    expect(screen.queryByTestId('finalizing-card')).toBeNull();
    expect(frames).not.toContain('finalizing-in-place');
    expect(isFinalizingHandover(h.sessionId)).toBe(false);
  });
});
