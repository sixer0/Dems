// Test bed of the integration-pass-D1b seams (decision D133): a signed-in simulator of a scenario
// and a role with its REST facade, the local microphone (D61 of 2026-11-04: MIC-05, since
// MIC-03/MIC-04 are built-ins) and the readers of the microphone lines and their audit rows. One definition; the test files that use it are `sim-capture-config`,
// `sim-evidence-item-kind`, `sim-capture-telemetry` and `api-domain-operations`.
import { expect } from 'vitest';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, createManualClock, createSim, type CaptureDeviceStatus, type ScenarioName, type SimState } from '../../src/sim';

export const START = Date.UTC(2026, 9, 1, 3, 0, 0);

export const CAPTURE_CONFIG_PATH = '/api/v1/capture/config';

export function harness(scenario: ScenarioName = 'idle', role: 'TECHNICIAN' | 'INVESTIGATOR' = 'TECHNICIAN') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded ${role}`);
  expect(sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  return { sim, clock, state: () => sim.store.getState() };
}

/** The local microphone as row 136 registers it: a NEW device with its own id (D106 (4); D61: `MIC-05`). */
export const LOCAL_MIC: CaptureDeviceStatus = { id: 'MIC-05', kind: 'MIC', model: 'MacBook Air Microphone', firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: [] };

/** A development registry: the seeded devices and the local microphone. The selector is the seeded one. */
export function registerLocalMic(h: ReturnType<typeof harness>): void {
  const state = h.state();
  h.sim.store.setState({ captureDevices: { devices: [...state.captureDevices.devices, LOCAL_MIC] } });
}

// D61 (2026-11-04): the by-role pair became the by-channel pair (channels 1 and 2).
export const pair = (primary: string, standby: string, extra: Record<string, unknown> = {}) => ({
  mics: [
    { inputId: primary, deviceId: primary, channel: 'MIC-01', ...extra },
    { inputId: standby, deviceId: standby, channel: 'MIC-02' },
  ],
});

export const micsOf = (state: SimState): (string | boolean)[][] => state.captureConfig.mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel, mic.transport]);

export const changedRows = (state: SimState) => state.audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');
