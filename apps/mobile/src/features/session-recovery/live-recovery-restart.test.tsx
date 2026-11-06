// Backend task, plan row W73: the row's Live test of recovery after a server-side fault (requirement
// E1, 01_specs §8.6 "A session that was in flight"). On the app's real Live source over the
// contract-checked fake transport, the Core server stops and starts again with a NEW epoch while a
// recording runs; the Core raises the power-failure fault, the session waits in FAULT, the device
// takes the new epoch's snapshot, the route sync opens Recovery, and the screen shows what the Core
// holds: the fault, the instant the recording stopped, the recovery stages, the INCOMPLETE outcome
// with the RECORDED (never sealed) item. Also: a second restart while in FAULT changes nothing (§8.6
// "FAULT: nothing; the fault stays"), a restart during the recovery completes it at its deadline
// and the screen shows the Core's outcome, and a critical fault the Core raises while connected
// opens the screen without any restart.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/recovery-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { formatClock } from '@dems/shared/realtime';
import { RECOVERY_MS, ScenarioName } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { ACK_SETTLE_MS } from './recovery.model';
import { resetRecoveryHapticsForTests } from './session-recovery-screen';
import { renderLiveRecovery, resetLiveRecoveryBed, type LiveRecoveryBed } from './testing/live-recovery-bed';

let bed: LiveRecoveryBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  resetRecoveryHapticsForTests();
  await resetLiveRecoveryBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  resetMotionStateForTests();
  jest.restoreAllMocks();
});

const toastShown = (text: string) => screen.queryAllByText(text).length > 0;

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

/** Captures hardware-Back listeners so a test can press Back (newest first, as Android does). */
function spyHardwareBack() {
  const listeners: BackListener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler);
    return { remove: () => void listeners.splice(listeners.indexOf(handler), 1) };
  });
  return () => {
    let consumed = false;
    act(() => {
      for (const listener of [...listeners].reverse()) {
        if (listener({} as Parameters<BackListener>[0])) {
          consumed = true;
          break;
        }
      }
    });
    return consumed;
  };
}

/** A recording on the Core (fault-demo: Camera 2 lost, MIC 2 clipping, GNSS → NTP), the operator on the monitor. */
async function recordingOnMonitor(): Promise<LiveRecoveryBed> {
  const b = await renderLiveRecovery({
    setup: (engine) => engine.sim.actions.loadScenario(ScenarioName.FAULT_DEMO),
    initialUrl: '/session/live',
  });
  bed = b;
  expect(b.state().session?.state).toBe('RECORDING');
  expect(b.app.getPathname()).toBe('/session/live');
  return b;
}

describe('E1: the Core restarts while a recording runs (01_specs §8.6)', () => {
  it('the Core comes back in a new epoch with the session in FAULT; Recovery opens and recovers the session truthfully to INCOMPLETE', async () => {
    const b = await recordingOnMonitor();
    const sessionId = b.state().session!.id;
    const epochBefore = b.epoch();
    await b.elapse(5_000, 250); // the recording runs on the Core
    const stoppedAt = b.engine.clock.now();

    await b.restartCore({ downMs: 12_000 });
    // The socket was closed by the server (1001), the device reconnected into the new epoch.
    expect(b.fake.connections.some((connection) => connection.closed?.code === 1001)).toBe(true);
    expect(b.epoch()).toBe(epochBefore + 1);
    const session = b.state().session!;
    expect(session.id).toBe(sessionId);
    expect(session.state).toBe('FAULT');
    expect(session.fault?.kind).toBe('POWER_FAIL');
    expect(session.fault?.fromState).toBe('RECORDING');
    expect(session.fault!.at).toBeLessThanOrEqual(stoppedAt);

    // The route sync opened Recovery on the replica's FAULT; the screen names what the Core holds.
    expect(b.app.getPathname()).toBe('/session/recovery');
    expect(screen.getByTestId('recovery-session-id')).toHaveTextContent(sessionId);
    expect(screen.getByText('Session interrupted: Power failure')).toBeTruthy();
    expect(screen.getByText(`Recording stopped at ${formatClock(session.fault!.at)}. The evidence stays unsealed until a controlled recovery analysis has run.`)).toBeTruthy();
    expect(within(screen.getByTestId('recovery-from-state')).getByText('Recording')).toBeTruthy();
    expect(screen.queryByTestId('recovery-link-down')).toBeNull();
    expect(b.requests('recoverSession')).toHaveLength(0); // nothing was started for the operator

    // Start recovery on the new epoch: one request; the Core's stages; its INCOMPLETE outcome.
    fireEvent.press(screen.getByTestId('recovery-start'));
    await b.flush();
    expect(b.requests('recoverSession').map((call) => call.params['id'])).toEqual([sessionId]);
    expect(b.state().session?.state).toBe('RECOVERY');
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
    expect(screen.getByTestId('recovery-stage')).toHaveTextContent('Recovery scan · stage 1 of 2');
    await b.elapse(RECOVERY_MS + 500, 100);
    expect(b.state().session).toBeNull();
    const entry = b.state().sessionHistory.find((candidate) => candidate.id === sessionId)!;
    expect(entry.outcome).toBe('INCOMPLETE');
    expect(entry.evidenceId).not.toBeNull();
    expect(b.state().evidence.find((item) => item.id === entry.evidenceId)?.status).toBe('RECORDED');
    expect(screen.getByTestId('recovery-outcome-line')).toHaveTextContent('Session marked INCOMPLETE. It will never be sealed.');
    expect(within(screen.getByTestId('recovery-state-chip')).getByText('INCOMPLETE')).toBeTruthy();
    expect(within(screen.getByTestId('recovery-outcome-evidence')).getByText(`${entry.evidenceId} (recorded, unsealed)`)).toBeTruthy();
    // The track findings are the Core's faults of before the stop (derived on the device, said so).
    expect(within(screen.getByTestId('recovery-track-VIDEO-02-result')).getByText('GAP')).toBeTruthy();
    expect(within(screen.getByTestId('recovery-track-AUDIO-02-result')).getByText('FLAGGED')).toBeTruthy();
    expect(screen.getByTestId('recovery-live-derived')).toBeTruthy();
    expect(screen.queryAllByText(/simulat/i)).toHaveLength(0);

    // Acknowledge: the fault's alert on the Core, then Home.
    const alert = b.state().alerts.find((candidate) => candidate.kind === 'POWER_FAIL')!;
    fireEvent.press(screen.getByTestId('recovery-acknowledge'));
    await b.flush();
    expect(b.requests('acknowledgeAlert').map((call) => call.params['id'])).toEqual([alert.id]);
    await b.elapse(ACK_SETTLE_MS + 200, 100);
    expect(b.app.getPathname()).toBe('/home');
    expect(getMissingKeys()).toEqual([]);
  });

  it('a second restart while in FAULT: the notice while the Core is down (a press sends nothing); afterwards the same fault, the same instant, and Start works', async () => {
    const b = await recordingOnMonitor();
    await b.elapse(3_000, 250);
    await b.restartCore();
    expect(b.app.getPathname()).toBe('/session/recovery');
    const first = b.state().session!;
    const epochAfterFirst = b.epoch();

    // The second stop: the screen keeps the last state received and says the link is down.
    b.setReachable(false);
    await b.elapse(3_000, 250);
    expect(screen.getByTestId('recovery-link-down')).toBeTruthy();
    expect(screen.getByTestId('recovery-fault')).toBeTruthy();
    fireEvent.press(screen.getByTestId('recovery-start'));
    await b.flush();
    expect(toastShown('Recovery is paused while the Core link is offline.')).toBe(true);
    expect(b.requests('recoverSession')).toHaveLength(0);

    // The start: "FAULT: nothing; the fault stays" — a new epoch, the same session and instant.
    await b.restartCore({ downMs: 2_000 });
    expect(b.epoch()).toBe(epochAfterFirst + 1);
    const second = b.state().session!;
    expect(second.id).toBe(first.id);
    expect(second.state).toBe('FAULT');
    expect(second.fault?.at).toBe(first.fault?.at);
    expect(screen.queryByTestId('recovery-link-down')).toBeNull();
    expect(screen.getByText(`Recording stopped at ${formatClock(first.fault!.at)}. The evidence stays unsealed until a controlled recovery analysis has run.`)).toBeTruthy();
    fireEvent.press(screen.getByTestId('recovery-start'));
    await b.flush();
    expect(b.requests('recoverSession')).toHaveLength(1);
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
  });

  it('a restart during the recovery: Back is held while the Core answers; the screen keeps the last state while it is down; the Core completes the recovery at its deadline and the screen shows its outcome', async () => {
    const pressBack = spyHardwareBack();
    const b = await recordingOnMonitor();
    await b.elapse(3_000, 250);
    await b.restartCore();
    const sessionId = b.state().session!.id;
    fireEvent.press(screen.getByTestId('recovery-start'));
    await b.flush();
    expect(b.state().session?.state).toBe('RECOVERY');
    // While the Core answers, Back is consumed during the analysis (step 81's rule).
    expect(pressBack()).toBe(true);
    expect(b.app.getPathname()).toBe('/session/recovery');

    // The Core stops one second into the recovery.
    await b.elapse(1_000, 100);
    b.setReachable(false);
    await b.elapse(3_000, 250);
    expect(screen.getByTestId('recovery-link-down')).toBeTruthy();
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy(); // the last state received; no outcome invented
    expect(screen.queryByTestId('recovery-outcome')).toBeNull();

    // It comes back: RECOVERY completed at its stored deadline; the snapshot holds no session and the INCOMPLETE entry.
    await b.restartCore({ downMs: 3_000 });
    expect(b.state().session).toBeNull();
    expect(b.state().sessionHistory.find((entry) => entry.id === sessionId)?.outcome).toBe('INCOMPLETE');
    expect(b.app.getPathname()).toBe('/session/recovery');
    expect(screen.getByTestId('recovery-outcome')).toBeTruthy();
    expect(screen.getByTestId('recovery-session-id')).toHaveTextContent(sessionId);
    expect(screen.queryByTestId('recovery-link-down')).toBeNull();
  });

  it('while the Core is down during the recovery, Back leaves (the analysis runs on the Core, not here)', async () => {
    const pressBack = spyHardwareBack();
    const b = await recordingOnMonitor();
    await b.elapse(3_000, 250);
    await b.restartCore();
    fireEvent.press(screen.getByTestId('recovery-start'));
    await b.flush();
    b.setReachable(false);
    await b.elapse(3_000, 250);
    expect(screen.getByTestId('recovery-link-down')).toBeTruthy();
    expect(pressBack()).toBe(true); // handled: with nothing below, Home (F-79-1)
    expect(b.app.getPathname()).toBe('/home');
  });
});

describe('A critical fault the Core raises while connected (no restart)', () => {
  it('a POWER_FAIL delta on the monitor: the route sync opens Recovery in FAULT, and Start works', async () => {
    const b = await recordingOnMonitor();
    await b.elapse(2_000, 250);
    const epoch = b.epoch();
    await b.onCore((engine) => engine.sim.actions.inject('POWER_FAIL'));
    expect(b.epoch()).toBe(epoch);
    expect(b.state().session?.state).toBe('FAULT');
    expect(b.app.getPathname()).toBe('/session/recovery');
    expect(screen.getByTestId('recovery-fault')).toBeTruthy();
    fireEvent.press(screen.getByTestId('recovery-start'));
    await b.flush();
    expect(b.requests('recoverSession')).toHaveLength(1);
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
  });
});
