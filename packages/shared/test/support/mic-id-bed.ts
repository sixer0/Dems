// Test bed of the integration-pass-C1 seams (decision D120): a signed-in simulator of a scenario and
// a selector that holds the local microphone (D61: MIC-05, since MIC-03/MIC-04 are built-ins). One definition; the test files that use it are
// `sim-capture-config` and `sim-capture-start`.
import { expect } from 'vitest';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, createManualClock, createSim, type CaptureConfigMic, type CaptureDeviceStatus, type ScenarioName, type SimState } from '../../src/sim';

export const START = Date.UTC(2026, 9, 1, 3, 0, 0);

export function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const operator = OPERATORS.find((candidate) => candidate.role === 'TECHNICIAN');
  if (operator === undefined) throw new Error('no seeded technician');
  expect(sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  return { sim, clock, state: () => sim.store.getState() };
}

/** The local microphone as row 136 registers it: a NEW device with its own id (D106 (4)).
 *  D61 (2026-11-04): `MIC-03` and `MIC-04` are BUILT-IN now — the registered-later device is `MIC-05`. */
export const LOCAL_MIC: CaptureDeviceStatus = { id: 'MIC-05', kind: 'MIC', model: 'MacBook Air Microphone', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: [] };

export const line = (id: string, channel: CaptureConfigMic['channel']): CaptureConfigMic => ({ channel, inputId: id, deviceId: id, transport: channel === 'MIC-01' ? 'AVFOUNDATION' : 'USB', online: true });

/** A state whose selector holds `MIC-05` on channel 1 beside `MIC-02` on channel 2, as a Core rehydrates it from a stored row. */
export function withLocalMic(state: SimState, primary: 'MIC-02' | 'MIC-05'): SimState {
  return {
    ...state,
    captureDevices: { devices: [...state.captureDevices.devices, LOCAL_MIC] },
    captureConfig: { ...state.captureConfig, mics: [line('MIC-02', primary === 'MIC-02' ? 'MIC-01' : 'MIC-02'), line('MIC-05', primary === 'MIC-05' ? 'MIC-01' : 'MIC-02')] },
  };
}
