// G70-05 (gate 70; fix wave H, driver D): a `CAPTURE_CONFIG_CHANGED` row written for a command of
// a tablet or a phone carried NO sending device, while `CAPTURE_DISCOVERY_SEARCHED` from the same
// device did. One rule for every row a paired device causes: `sendingDeviceOf` (the rule the audio
// switch uses, finding G75-02) - the paired device of the acting identity, or none for a web
// console session. The row names it in its own `deviceId`; the DETAILS keep their exact key list
// (decision D106 (3)), whose `deviceId` is the CAPTURE device the line names.
import { describe, expect, it } from 'vitest';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, createManualClock, createSim, setCaptureConfigTransition, type AuditRow, type CaptureConfigChange, type SimState } from '../src/sim';

const NOW = Date.UTC(2026, 9, 10, 3, 0, 0);
const PAIRED = 'DEV-0001';

function signedIn(): SimState {
  const sim = createSim({ clock: createManualClock(NOW), storage: null, authStorage: null });
  const technician = OPERATORS.find((operator) => operator.role === 'TECHNICIAN');
  if (technician === undefined) throw new Error('the seed has no technician');
  expect(sim.actions.signIn(technician.username, DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  return sim.store.getState();
}
const changedRows = (state: SimState): AuditRow[] => state.audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');
/** The engine's actor scope of a command of a paired device (`actorAuth` of the Core server). */
const fromDevice = (state: SimState, deviceId: string): SimState => ({ ...state, auth: { ...state.auth, deviceId } });

const CHANGES: readonly (readonly [string, CaptureConfigChange, number])[] = [
  ['operation 80, the primary microphone', { kind: 'PRIMARY_MIC', inputId: 'MIC-02' }, 1],
  ['operation 79, a camera source', { kind: 'UPDATE', cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] }, 2],
  ['operation 78, the microphone pair', { kind: 'UPDATE', mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'STANDBY' }, { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'PRIMARY' }] }, 1],
];

describe('G70-05: a selector edit names the device that sent it', () => {
  it.each(CHANGES)('%s from a paired device: every row of the edit carries that device', (_label, change, atLeast) => {
    const next = setCaptureConfigTransition(fromDevice(signedIn(), PAIRED), NOW + 1_000, change);
    const rows = changedRows(next);
    expect(rows.length).toBeGreaterThanOrEqual(atLeast);
    expect(rows.map((row) => row.deviceId)).toEqual(rows.map(() => PAIRED));
    // The details are unchanged: their `deviceId` is the capture device of the line, never the sender.
    for (const row of rows) expect(Object.keys(row.details)).not.toContain('sendingDeviceId');
    expect(rows.map((row) => row.details['deviceId'])).not.toContain(PAIRED);
  });

  it.each(CHANGES)('CONTROL - %s from a web console session (no paired device): the row names no device', (_label, change) => {
    const rows = changedRows(setCaptureConfigTransition(signedIn(), NOW + 1_000, change));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.deviceId ?? null)).toEqual(rows.map(() => null));
  });

  it('a value that is no device id is never written as one', () => {
    const rows = changedRows(setCaptureConfigTransition(fromDevice(signedIn(), 'not a device; DROP'), NOW + 1_000, { kind: 'PRIMARY_MIC', inputId: 'MIC-02' }));
    expect(rows.map((row) => row.deviceId ?? null)).toEqual([null]);
  });
});
