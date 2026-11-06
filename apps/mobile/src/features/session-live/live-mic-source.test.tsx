// Task 3 M5, blueprint row 73 (register MB-03, MB-13; ux spec §3 flow 2; specs R-3; D4 OD-11; B11 / row 62):
// the microphones of the Session Live monitor in LIVE mode - the app's REAL Live source over the
// contract-checked fake transport, with a model Core behind it (`testing/live-monitor-bed`); `bed.stop()`
// throws the first contract violation.
//
// Audit row 185 (M3-05; D5, D134, D136, D138; register O4): operation 81 `switchAudioSource` is RETIRED - the
// Core answers every call `409 AUDIO_SOURCE_FIXED_BY_PAIRING`, and the tablet sends it NOWHERE. What is held
// here: no switch control in any state the Live link can be in (open, a silent input for 15 s, the link lost,
// a recording stopped elsewhere); the Live source's `switchAudioSource` is never called (spy count 0) and the
// fake transport sees no op 81 request. The switch-era cases (the confirmed request, no optimistic flip, the
// CONFLICT / INVALID_STATE / NOT_PERMITTED refusals; I63 §4.4 `live-mic-source.test.tsx:162-164`) are rewritten
// as "op 81 never sent" (spec M3-05 R3: no refusal path is left).
//
// Import order: the gorhom mock, then the router harness, then the bed (see its header).
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, within } from '@testing-library/react-native';
import { promisify } from 'node:util';
import { meterFrame, renderLiveMonitor, resetLiveMonitorBed, type LiveMonitorBed, type LiveMonitorBedOptions } from './testing/live-monitor-bed';

let bed: LiveMonitorBed | null = null;

const nextTurn = promisify(setImmediate) as () => Promise<void>;

beforeAll(async () => {
  // Reanimated prepares its UI-side frame-callback registry on the real queue (S72-12).
  await nextTurn();
  await nextTurn();
});

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  await resetLiveMonitorBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  jest.useRealTimers();
});

const OP = 'switchAudioSource';
const coreSwitches = (b: LiveMonitorBed) => b.engine.sim.store.getState().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED');
/** Register O5 (D138): the shared `session.audioSource.silent.body` with the app's thresholds (-50 dBFS, 10 s). */
const O5 = 'Below -50 dBFS for 10 s. Recording continues. The microphone of each pair is fixed by setup: check its cable or the device.';
/** Every testID the retired switch drew (task 3 M5 and task 4 row 170). */
const SWITCH_IDS = [
  'monitor-mic-switch',
  'monitor-mic-switch-dialog',
  'monitor-mic-switch-confirm',
  'monitor-mic-switch-cancel',
  'monitor-mic-switch-reason',
  'monitor-mic-switch-refusal',
  'monitor-mic-switch-no-pair',
  'monitor-mic-silent-switch',
  'monitor-mic-no-signal-switch',
] as const;
/** Row 185 (register O4): no element offers a switch - none of the retired testIDs, no "Switch to ..." text (E1), no switch sentence. */
function expectNoSwitchOffered(): void {
  for (const id of SWITCH_IDS) expect(screen.queryByTestId(id, { includeHiddenElements: true })).toBeNull();
  expect(screen.queryAllByText(/^Switch to/, { includeHiddenElements: true })).toHaveLength(0);
  expect(screen.queryAllByText(/Switch microphone|can be switched|nothing to switch|was not switched/, { includeHiddenElements: true })).toHaveLength(0);
}

/** The Live source's own action: the one door op 81 had on the tablet (row 185: never opened). */
const spyOnSwitch = (b: LiveMonitorBed) => jest.spyOn(b.mobile.sim.actions, 'switchAudioSource');

async function openMonitor(options: LiveMonitorBedOptions = {}): Promise<LiveMonitorBed> {
  const b = await renderLiveMonitor(options);
  bed = b;
  await b.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return b;
}

describe('row 185 (M3-05; register O4): op 81 is never sent in LIVE mode', () => {
  it('the open monitor offers no switch; nothing is sent', async () => {
    const b = await openMonitor();
    const spy = spyOnSwitch(b);
    expectNoSwitchOffered();
    await b.elapse(1_000, 250);
    expect(spy).toHaveBeenCalledTimes(0);
    expect(b.requests(OP)).toHaveLength(0);
    expect(coreSwitches(b)).toHaveLength(0);
    expect(b.state().session?.state).toBe('RECORDING');
  });

  it('MIC_SILENT (OD-11; M5-WARN-1, the client half): the Core\'s warning shows O5 and no button, meters keep arriving for 15 s, nothing is sent; clearing it removes the warning', async () => {
    const b = await openMonitor();
    const spy = spyOnSwitch(b);
    await b.raiseMicSilent('MIC-01');
    const warning = within(screen.getByTestId('monitor-mic-silent'));
    expect(warning.getByText('MIC 1 is silent')).toBeTruthy();
    expect(warning.getByText(O5)).toBeTruthy();
    expect(warning.queryAllByRole('button')).toHaveLength(0);
    for (let second = 1; second <= 15; second += 1) {
      const at = b.fake.clock.now();
      b.sendMeters({ 'AUDIO-01': meterFrame(-72, at, second), 'AUDIO-02': meterFrame(-20, at, second) });
      await b.elapse(1_000, 500);
    }
    expectNoSwitchOffered();
    expect(spy).toHaveBeenCalledTimes(0);
    expect(b.requests(OP)).toHaveLength(0);
    expect(coreSwitches(b)).toHaveLength(0);
    expect(b.engine.sim.store.getState().audio.activeInputId).toBe('MIC-01');
    expect(screen.getByTestId('monitor-mic-silent')).toBeTruthy();

    await b.clearMicSilent('MIC-01');
    expect(screen.queryByTestId('monitor-mic-silent')).toBeNull();
    expect(b.requests(OP)).toHaveLength(0);
  });

  it('the Core link lost (S7): still no switch control, nothing is sent', async () => {
    const b = await openMonitor();
    const spy = spyOnSwitch(b);
    b.setReachable(false);
    await b.flush();
    await b.elapse(1_000, 250);
    expectNoSwitchOffered();
    expect(spy).toHaveBeenCalledTimes(0);
    expect(b.requests(OP)).toHaveLength(0);
  });

  it('a recording stopped elsewhere (the late stop, B11 / row 62): no switch control before or after, nothing is sent', async () => {
    const b = await openMonitor();
    const spy = spyOnSwitch(b);
    expectNoSwitchOffered();
    await b.changeOnCore((core) => core.sim.actions.stopRecording('Stopped from the web console'));
    expect(b.state().session?.state).not.toBe('RECORDING');
    expectNoSwitchOffered();
    expect(spy).toHaveBeenCalledTimes(0);
    expect(b.requests(OP)).toHaveLength(0);
    expect(coreSwitches(b)).toHaveLength(0);
  });

  it('CONTROL - the model Core answers op 81 as the Core does (409 AUDIO_SOURCE_FIXED_BY_PAIRING, the contract example), and its engine refuses it with no row', async () => {
    const b = await openMonitor();
    const answer = b.fake.example(OP, 409, 'fixedByPairing') as { readonly status: number };
    expect(answer.status).toBe(409);
    expect(JSON.stringify(answer)).toContain('AUDIO_SOURCE_FIXED_BY_PAIRING');
    let thrown: unknown = null;
    try {
      b.engine.sim.actions.switchAudioSource('MIC-02' as Parameters<typeof b.engine.sim.actions.switchAudioSource>[0]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' });
    expect(coreSwitches(b)).toHaveLength(0);
    expect(b.requests(OP)).toHaveLength(0);
  });
});
