// E-fix row FX-M2, defects E2E-P-4 and E2E-T-4 (decision D199/D200/D201): when the web stopped a session,
// the phone showed about 1.2 s (the tablet about 2 s) of EMPTY screen between the monitor and
// "Finalizing evidence": `/session/live` rendered only a `<Redirect>`, which draws nothing, until the
// Finalizing route had mounted and faded in.
//
// Held here, on the app's own Live source over the contract-checked fake transport (W68's
// `live-monitor-bed`, the REAL `/session/live` route file):
// - every commit after a stop made on ANOTHER console (the engine stops, the delta is pushed) draws
//   either the monitor or the Finalizing screen: never neither;
// - the commit that drops the monitor draws the Finalizing card in place (the stopping state, at once);
// - the stop is taken from the pushed delta: no request is sent between the push and the hand-over
//   (no poll), and the route reaches `/session/finalizing`.
//
// Import order: the gorhom mock, then the router harness, then the bed (see their headers).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { isFinalizingHandover, markFinalizingHandover, resetFinalizingHandoverForTests } from '@/features/session-finalizing/handover';
import { renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed } from './testing/live-monitor-bed';

type Frame = 'monitor' | 'finalizing-in-place' | 'finalizing-route' | 'empty';

let bed: LiveMonitorBed | null = null;
let recording = false;
const frames: Frame[] = [];

/** What one commit drew (read in the Profiler's commit callback, after the host tree changed). */
function frameNow(): Frame {
  if (screen.queryByTestId('screen-session-live') !== null) return 'monitor';
  if (screen.queryByTestId('finalizing-card') !== null) return 'finalizing-in-place';
  if (screen.queryAllByTestId('screen-session-finalizing').length > 0) return 'finalizing-route';
  return 'empty';
}

beforeEach(async () => {
  await resetLiveMonitorBed();
  resetFinalizingHandoverForTests();
  frames.length = 0;
  recording = false;
});

afterEach(() => {
  bed?.stop();
  bed = null;
});

describe('E2E-P-4 / E2E-T-4: a stop made on another console hands the monitor over to Finalizing without an empty frame', () => {
  for (const window of ['phonePortrait', 'tabletLandscape'] as const) {
    it(`${window}: every commit after the pushed stop draws the monitor or Finalizing; the first one without the monitor draws the Finalizing card`, async () => {
      const b = await renderLiveMonitor({
        window,
        onRender: () => {
          if (recording) frames.push(frameNow());
        },
      });
      bed = b;
      await b.openMonitor();
      expect(screen.getByTestId('screen-session-live')).toBeTruthy();
      const sessionId = b.state().session?.id ?? null;
      expect(b.state().session?.state).toBe('RECORDING');
      b.fake.log.clear();

      // The web's End Session: the Core's engine stops, the operator socket carries the delta.
      recording = true;
      await b.changeOnCore((engine) => engine.sim.actions.stopRecording('Stopped on the web (E2E-P-4)'));
      await b.flush();
      await b.elapse(400);
      recording = false;

      expect(b.state().session?.state).toBe('STOPPING');
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.filter((frame) => frame === 'empty')).toEqual([]);
      // The monitor's last commit is followed directly by the Finalizing card drawn in place.
      const firstWithoutMonitor = frames.find((frame) => frame !== 'monitor');
      expect(firstWithoutMonitor).toBe('finalizing-in-place');
      // The route follows; the hand-over is marked for that session, so the route's copy enters without motion.
      expect(b.app.getPathname()).toBe('/session/finalizing');
      expect(isFinalizingHandover(sessionId)).toBe(true);
      // Taken from the push: nothing was asked of the Core between the stop and the hand-over (no poll).
      expect(b.fake.log.operationIds()).toEqual([]);
    });
  }

  it('the in-place screen is the Finalizing card in its stopping state, with no enter motion (it is visible in that very commit)', async () => {
    const seen: { stopping: boolean; entering: boolean }[] = [];
    const b = await renderLiveMonitor({
      onRender: () => {
        if (!recording || screen.queryByTestId('screen-session-live') !== null) return;
        const card = screen.queryByTestId('finalizing-card');
        if (card === null) return;
        // The card's animated wrapper: an `entering` animation would start it at opacity 0.
        let wrapper = card.parent;
        let entering = false;
        while (wrapper) {
          if (wrapper.props?.entering !== undefined) entering = true;
          wrapper = wrapper.parent;
        }
        seen.push({ stopping: screen.queryByText('Ending recording and closing tracks…') !== null, entering });
      },
    });
    bed = b;
    await b.openMonitor();
    recording = true;
    await b.changeOnCore((engine) => engine.sim.actions.stopRecording('Stopped on the web (E2E-P-4)'));
    await b.flush();
    recording = false;
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toEqual({ stopping: true, entering: false });
  });
});

describe('the hand-over mark (pure)', () => {
  it('matches only the session that was handed over; a deep link into Finalizing still enters with motion', () => {
    expect(isFinalizingHandover('SES-1')).toBe(false);
    markFinalizingHandover('SES-1');
    expect(isFinalizingHandover('SES-1')).toBe(true);
    expect(isFinalizingHandover('SES-2')).toBe(false);
    expect(isFinalizingHandover(null)).toBe(false);
    markFinalizingHandover(null);
    expect(isFinalizingHandover('SES-1')).toBe(true);
  });
});
