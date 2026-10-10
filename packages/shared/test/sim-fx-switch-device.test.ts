// Closing pass F-X, item 6 (F-M5 decision 4; contract C3 §5.2, E-30): the simulator's
// `AUDIO_SOURCE_SWITCHED` row names the sending device where the simulator knows one - a simulator
// that runs inside a tablet or phone app (`deviceConsole: true`, the device session of the Core) -
// and carries NO such key for a web console session, as the Core does. Written RED: the row never
// carried the member.
import { describe, expect, it } from 'vitest';
import { CAPTURE_CONNECT_MS, SIM_CONSOLE_DEVICE_ID, createManualClock, createSim, type AuditRow, type SessionCreateInput } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };

function recording(deviceConsole: boolean) {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: 'simulated', deviceConsole });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const run = (ms: number): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.advance(50);
      sim.tick();
    }
  };
  sim.actions.createSession(INPUT);
  sim.actions.beginPrecheck();
  run(5_000);
  sim.actions.startRecording();
  run(CAPTURE_CONNECT_MS + 2_000);
  expect(sim.store.getState().session?.state).toBe('RECORDING');
  const lastSwitch = (): AuditRow | undefined => sim.store.getState().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED').at(-1);
  return { sim, run, lastSwitch, sessionId: sim.store.getState().session?.id ?? '' };
}

describe('the sending device of a microphone switch in the simulator', () => {
  it('a device console: the row and its details name the paired device, by the action and by operation 81', () => {
    const h = recording(true);
    h.sim.actions.switchAudioSource('MIC-02');
    expect(h.lastSwitch()).toMatchObject({ deviceId: SIM_CONSOLE_DEVICE_ID, details: { fromInput: 'MIC-01', toInput: 'MIC-02', sendingDeviceId: SIM_CONSOLE_DEVICE_ID } });
    h.run(1_000);
    const answer = h.sim.request({ method: 'POST', path: `/api/v1/session/${h.sessionId}/audio-source`, body: { inputId: 'MIC-01' } });
    expect(answer.status).toBe(200);
    expect(h.lastSwitch()).toMatchObject({ deviceId: SIM_CONSOLE_DEVICE_ID, details: { fromInput: 'MIC-02', toInput: 'MIC-01', sendingDeviceId: SIM_CONSOLE_DEVICE_ID } });
  });

  it('CONTROL - a web console session: no device on the row and no `sendingDeviceId` key at all', () => {
    const h = recording(false);
    h.sim.actions.switchAudioSource('MIC-02');
    h.run(1_000);
    expect(h.sim.request({ method: 'POST', path: `/api/v1/session/${h.sessionId}/audio-source`, body: { inputId: 'MIC-01' } }).status).toBe(200);
    const rows = h.sim.store.getState().audit.rows.filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.deviceId).toBeNull();
      expect(Object.keys(row.details)).toEqual(['fromInput', 'toInput', 'fromMs', 'toMs']);
    }
  });
});
