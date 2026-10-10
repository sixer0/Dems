// Fix wave I, driver A2 - finding G75b-04 of re-gate 75, ruling D216 (2): every audit row of a
// session action SENT BY A PAIRED DEVICE carries that device's id in the row's `deviceId`, as the
// switch row does since wave H (G75-02): SESSION_CREATED, PRECHECK_PASSED / PRECHECK_BLOCKED,
// RECORDING_STARTED, RECORDING_STOPPED, SESSION_CANCELLED. Additive: an action a web console
// session sent keeps `deviceId: null`, and no `details` key is added to any of these rows.
//
// HOW THE CORE SENDS A COMMAND (`apps/core-server/src/engine/actor-scope.ts`): the `auth` slice is
// set to the caller - operator AND paired device - for exactly ONE synchronous action and cleared
// after it. The pre-check resolves LATER, on a tick, when nobody is signed in on the engine: its
// row names the device that sent the pre-check command, which the pre-check itself remembers
// (`session.precheck.sendingDeviceId`, an optional member of the stored pre-check).
import { describe, expect, it } from 'vitest';
import { ActiveSessionSchema, SESSION_PRECHECK_SENDING_DEVICE_EXAMPLE } from '../src/api';
import { CAPTURE_CONNECT_MS, createManualClock, createSim, type AuditRow, type SessionCreateInput, type SimState } from '../src/sim';

const START = Date.UTC(2026, 9, 10, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1010-0042', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const DEVICE = 'DEV-0001';

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, capture: 'simulated' });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  /** ONE command as the Core's actor scope runs it: the device is in `auth` for that action only. */
  const sentBy = <Result>(deviceId: string | null, action: () => Result): Result => {
    const before = state().auth;
    sim.store.setState({ ...state(), auth: deviceId === null ? before : { ...before, deviceId } }, true);
    try {
      return action();
    } finally {
      const { deviceId: _dropped, ...auth } = state().auth;
      sim.store.setState({ ...state(), auth }, true);
    }
  };
  const rows = (type: string): AuditRow[] => state().audit.rows.filter((row) => row.type === type);
  const last = (type: string): AuditRow | undefined => rows(type).at(-1);
  return { sim, clock, state, run, sentBy, rows, last };
}

describe('G75b-04: the audit rows of the session actions a paired device sent name that device', () => {
  it('create, pre-check (resolved later, on a tick), start and stop: each row carries the device; no details key is added', () => {
    const h = harness();
    h.sentBy(DEVICE, () => h.sim.actions.createSession(INPUT));
    expect(h.last('SESSION_CREATED')).toMatchObject({ deviceId: DEVICE });
    expect(Object.keys(h.last('SESSION_CREATED')?.details ?? {})).toEqual(['caseNumber', 'subjectType']);

    h.sentBy(DEVICE, () => h.sim.actions.beginPrecheck());
    expect(h.state().session?.precheck.sendingDeviceId).toBe(DEVICE);
    // Nobody's device is in `auth` while the checks run: the row takes it from the pre-check.
    expect(h.state().auth.deviceId).toBeUndefined();
    h.run(5_000);
    expect(h.state().session?.state).toBe('ARMED');
    expect(h.last('PRECHECK_PASSED')).toMatchObject({ deviceId: DEVICE, details: { by: 'system' } });
    expect(Object.keys(h.last('PRECHECK_PASSED')?.details ?? {})).toEqual(['warnings', 'acknowledged', 'by']);

    h.sentBy(DEVICE, () => h.sim.actions.startRecording());
    expect(h.last('RECORDING_STARTED')).toMatchObject({ deviceId: DEVICE });
    expect(Object.keys(h.last('RECORDING_STARTED')?.details ?? {})).toEqual(['timeSource']);
    h.run(CAPTURE_CONNECT_MS + 3_000);

    h.sentBy(DEVICE, () => h.sim.actions.stopRecording('Interview finished'));
    expect(h.last('RECORDING_STOPPED')).toMatchObject({ deviceId: DEVICE });
    expect(Object.keys(h.last('RECORDING_STOPPED')?.details ?? {})).toEqual(['reason', 'durationMs']);
  });

  it('cancel: the row carries the device that sent it', () => {
    const h = harness();
    h.sentBy(null, () => h.sim.actions.createSession(INPUT));
    h.sentBy(DEVICE, () => h.sim.actions.cancel());
    expect(h.last('SESSION_CANCELLED')).toMatchObject({ deviceId: DEVICE, details: { fromState: 'CREATE' } });
    expect(Object.keys(h.last('SESSION_CANCELLED')?.details ?? {})).toEqual(['fromState']);
  });

  it('a BLOCKED pre-check names the device that sent the pre-check; a retry from the web names none', () => {
    const h = harness();
    h.sentBy(DEVICE, () => h.sim.actions.createSession(INPUT));
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    h.sentBy(DEVICE, () => h.sim.actions.beginPrecheck());
    h.run(5_000);
    expect(h.state().session?.precheck.outcome).toBe('BLOCK');
    expect(h.last('PRECHECK_BLOCKED')).toMatchObject({ deviceId: DEVICE });
    // The retry is a new pre-check, sent by the web console: its row names no device.
    h.sentBy(null, () => h.sim.actions.retryPrecheck());
    expect(h.state().session?.precheck.sendingDeviceId).toBeUndefined();
    h.run(5_000);
    expect(h.rows('PRECHECK_BLOCKED')).toHaveLength(2);
    expect(h.last('PRECHECK_BLOCKED')?.deviceId).toBeNull();
  });

  it('the device of each row is the device of ITS action: tablet creates, web starts the pre-check, phone starts, web stops', () => {
    const h = harness();
    h.sentBy('DEV-0001', () => h.sim.actions.createSession(INPUT));
    h.sentBy(null, () => h.sim.actions.beginPrecheck());
    h.run(5_000);
    h.sentBy('DEV-0002', () => h.sim.actions.startRecording());
    h.run(CAPTURE_CONNECT_MS + 3_000);
    h.sentBy(null, () => h.sim.actions.stopRecording('Interview finished'));
    expect([h.last('SESSION_CREATED')?.deviceId, h.last('PRECHECK_PASSED')?.deviceId, h.last('RECORDING_STARTED')?.deviceId, h.last('RECORDING_STOPPED')?.deviceId]).toEqual(['DEV-0001', null, 'DEV-0002', null]);
  });

  it('CONTROL - a web console session (no device): every row keeps `deviceId: null` and the pre-check holds no device member', () => {
    const h = harness();
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    expect(h.state().session?.precheck).not.toHaveProperty('sendingDeviceId');
    h.run(5_000);
    h.sim.actions.startRecording();
    h.run(CAPTURE_CONNECT_MS + 3_000);
    h.sim.actions.stopRecording('Interview finished');
    for (const type of ['SESSION_CREATED', 'PRECHECK_PASSED', 'RECORDING_STARTED', 'RECORDING_STOPPED']) expect(h.last(type)?.deviceId, type).toBeNull();
    const cancelled = harness();
    cancelled.sim.actions.createSession(INPUT);
    cancelled.sim.actions.cancel();
    expect(cancelled.last('SESSION_CANCELLED')?.deviceId).toBeNull();
  });

  it('CONTROL - a value that names no device is not written: the row keeps null', () => {
    const h = harness();
    h.sentBy('not a device id', () => h.sim.actions.createSession(INPUT));
    expect(h.last('SESSION_CREATED')?.deviceId).toBeNull();
    h.sentBy('not a device id', () => h.sim.actions.beginPrecheck());
    expect(h.state().session?.precheck).not.toHaveProperty('sendingDeviceId');
  });

  it('the contract takes the member: the session slice with `precheck.sendingDeviceId` parses, the example is of the schema, and a value that is no device id is refused', () => {
    const h = harness();
    h.sentBy(DEVICE, () => h.sim.actions.createSession(INPUT));
    h.sentBy(DEVICE, () => h.sim.actions.beginPrecheck());
    const session = h.state().session;
    expect(ActiveSessionSchema.safeParse(session).success).toBe(true);
    expect(SESSION_PRECHECK_SENDING_DEVICE_EXAMPLE.sendingDeviceId).toBe('DEV-0001');
    expect(ActiveSessionSchema.safeParse({ ...session, precheck: { ...session?.precheck, ...SESSION_PRECHECK_SENDING_DEVICE_EXAMPLE } }).success).toBe(true);
    expect(ActiveSessionSchema.safeParse({ ...session, precheck: { ...session?.precheck, sendingDeviceId: 'a b' } }).success).toBe(false);
  });
});
