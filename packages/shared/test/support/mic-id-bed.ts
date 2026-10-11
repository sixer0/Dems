// Test bed of the integration-pass-C1 seams (decision D120): a signed-in simulator of a scenario and
// a selector that holds the local microphone MIC-03. One definition; the test files that use it are
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

/** The local microphone as row 136 registers it: a NEW device with its own id (D106 (4)). */
export const LOCAL_MIC: CaptureDeviceStatus = { id: 'MIC-03', kind: 'MIC', model: 'MacBook Air Microphone', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: [] };

export const line = (id: string, role: CaptureConfigMic['role']): CaptureConfigMic => ({ inputId: id, deviceId: id, role, transport: role === 'PRIMARY' ? 'AVFOUNDATION' : 'USB', online: true });

/** A state whose selector holds `MIC-03` beside `MIC-02`, as a Core rehydrates it from a stored row. */
export function withLocalMic(state: SimState, primary: 'MIC-02' | 'MIC-03'): SimState {
  return {
    ...state,
    captureDevices: { devices: [...state.captureDevices.devices, LOCAL_MIC] },
    captureConfig: { ...state.captureConfig, mics: [line('MIC-02', primary === 'MIC-02' ? 'PRIMARY' : 'STANDBY'), line('MIC-03', primary === 'MIC-03' ? 'PRIMARY' : 'STANDBY')] },
  };
}
