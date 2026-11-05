// The sending device on audit rows: every row an action of a paired device (tablet or phone)
// writes names that device in its own `deviceId`; a web console session names none. One rule,
// `sendingDeviceOf`. Home file of these cases (suite consolidation, 2026-10-11); the finding ids
// stay in the titles.
import { describe, expect, it } from 'vitest';
import { ActiveSessionSchema, SESSION_PRECHECK_SENDING_DEVICE_EXAMPLE } from '../src/api';
import {
  CAPTURE_CONNECT_MS,
  createManualClock,
  createSim,
  type AuditRow,
  type SessionCreateInput,
  type SimState,
  FaultKind,
  recordEvidenceVerificationTransition,
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  setCaptureConfigTransition,
  type CaptureConfigChange,
} from '../src/sim';
import * as sessionFaultBed from './support/session-fault-bed';

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
describe('session actions: create, pre-check, start, stop, cancel', () => {
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
});

// Fix wave K, driver S2 - findings G89b-04 (verify rows), G94b-03 (export rows), G75c-09
// (SUMMARY_ACKNOWLEDGED, RECOVERY_STARTED) of the re-gates; rule of D216 (2): "every audit row of an
// action sent by a paired device carries that device's id".
//
// Wave I named six session rows one by one (the block above, G75b-04). The rule is now
// held where every row of an action is written (`events.ts` `appendActivity`): the acting identity
// holds a paired device (`auth.deviceId`, set by the Core for ONE hosted command), the row's actor
// is that identity, and the row names no device of its own.
//
// | Rule | Test |
// |------|------|
// | verify (PASS and FAILED), export, export denied, summary acknowledged, recovery started: the row names the device | 1, 2, 3 |
// | SWEEP: every hosted action a device session can send - each row of the acting operator names the device | 4 |
// | The Core's own verification (INTERNAL action, nobody in `auth`): device, operation and the failed FRAGMENT are handed in | 5 |
// | CONTROLS: a web console session keeps null; a row that names a device of its own keeps it; a row of nobody (engine-timed) keeps null; a value that names no device is not written | 6, 7 |
describe('verify, export, summary, recovery and the sweep over every action', () => {
  const START = Date.UTC(2026, 9, 11, 3, 0, 0);
  const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1011-0042', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
  const DEVICE = 'DEV-0001';
  function harness(username = 'budi.santoso') {
    const clock = createManualClock(START);
    const sim = createSim({ clock, storage: null, authStorage: null, capture: 'simulated' });
    sim.actions.signIn(username, 'demo-2026');
    const state = (): SimState => sim.store.getState();
    const run = (ms: number, step = 50): void => {
      for (let elapsed = 0; elapsed < ms; elapsed += step) {
        clock.advance(step);
        sim.tick();
      }
    };
    /** ONE command as the Core's actor scope runs it (`engine/actor-scope.ts`): the device is in `auth` for that action only. Returns the rows it wrote. */
    const sentBy = (deviceId: string | null, action: () => unknown): AuditRow[] => {
      const before = state().auth;
      const from = state().audit.total;
      sim.store.setState({ ...state(), auth: deviceId === null ? before : { ...before, deviceId } }, true);
      try {
        action();
      } finally {
        const { deviceId: _dropped, ...auth } = state().auth;
        sim.store.setState({ ...state(), auth }, true);
      }
      return state().audit.rows.filter((row) => row.seq > from);
    };
    const operatorId = (): string => state().auth.operatorId ?? '';
    const sealedItem = (): string => state().evidence.find((item) => item.status === 'SEALED')?.id ?? '';
    return { sim, clock, state, run, sentBy, operatorId, sealedItem };
  }
  /** A recorded and sealed session; the summary is not acknowledged yet. */
  function sealedSession(h: ReturnType<typeof harness>): string {
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    h.sim.actions.startRecording();
    h.run(CAPTURE_CONNECT_MS + 3_000);
    h.sim.actions.stopRecording('Interview finished');
    h.run(60_000, 250);
    expect(h.state().session?.state).toBe('SEALED');
    return h.state().session?.id ?? '';
  }

  describe('D216 (2): the rows the session actions did not name carry the sending device', () => {
    it('1 - verify from a paired device: EVIDENCE_VERIFIED names the device and the operation; a FAILED verification too', () => {
      const h = harness();
      const evidenceId = h.sealedItem();
      expect(evidenceId).not.toBe('');
      const passed = h.sentBy(DEVICE, () => h.sim.actions.verify(evidenceId));
      expect(passed.map((row) => [row.type, row.deviceId, row.actorId, row.details['operationId']])).toEqual([['EVIDENCE_VERIFIED', DEVICE, h.operatorId(), 'verifyEvidence']]);

      const tampered = h.state().evidence.find((item) => item.tampered === true)?.id;
      if (tampered !== undefined) {
        const failed = h.sentBy(DEVICE, () => h.sim.actions.verify(tampered));
        expect(failed.map((row) => [row.type, row.deviceId, row.details['operationId']])).toEqual([['EVIDENCE_VERIFY_FAILED', DEVICE, 'verifyEvidence']]);
      }
      // The dataset holds a tampered item: the failed variant above really ran.
      expect(tampered).toBeDefined();
    });

    it('2 - export from a paired device: EVIDENCE_EXPORTED names the device; a refused export (EXPORT_DENIED) too', () => {
      const supervisor = harness('andi.pratama');
      const exported = supervisor.sentBy(DEVICE, () => supervisor.sim.actions.exportEvidence(supervisor.sealedItem(), { reason: 'Case file handover', destination: '' }));
      expect(exported.map((row) => [row.type, row.deviceId])).toEqual([['EVIDENCE_EXPORTED', DEVICE]]);
      // No details key was added for it: the row states the device once.
      expect(Object.keys(exported[0]?.details ?? {})).toEqual(['exportId', 'destination', 'reason', 'eventKind']);

      const investigator = harness();
      const denied = investigator.sentBy(DEVICE, () => investigator.sim.actions.exportEvidence(investigator.sealedItem(), { reason: 'Case file handover', destination: '' }));
      expect(denied.map((row) => [row.type, row.deviceId])).toEqual([['EXPORT_DENIED', DEVICE]]);
    });

    it('3 - G75c-09: SUMMARY_ACKNOWLEDGED and RECOVERY_STARTED sent from a paired device name it', () => {
      const h = harness();
      const sessionId = sealedSession(h);
      const acknowledged = h.sentBy(DEVICE, () => h.sim.actions.acknowledgeSummary(sessionId));
      expect(acknowledged.map((row) => [row.type, row.deviceId, row.sessionId])).toEqual([['SUMMARY_ACKNOWLEDGED', DEVICE, sessionId]]);

      const r = harness();
      r.sim.actions.createSession(INPUT);
      r.sim.actions.beginPrecheck();
      r.run(5_000);
      r.sim.actions.startRecording();
      r.run(CAPTURE_CONNECT_MS + 3_000);
      r.sim.actions.inject(FaultKind.POWER_FAIL);
      r.run(2_000);
      expect(r.state().session?.state).toBe('FAULT');
      const recovered = r.sentBy(DEVICE, () => r.sim.actions.recover());
      const started = recovered.filter((row) => row.type === 'RECOVERY_STARTED');
      expect(started.map((row) => [row.deviceId, row.actorId])).toEqual([[DEVICE, r.operatorId()]]);
    });

    it('4 - SWEEP: every row an action of a device session writes for its operator names the device, whatever the action', () => {
      const h = harness('andi.pratama');
      const seen = new Map<string, string | null>();
      const sent = (label: string, action: () => unknown): void => {
        for (const row of h.sentBy(DEVICE, action)) {
          if (row.actorId !== h.operatorId()) continue;
          // A row that names a device of its own (a camera, a microphone) keeps it; every other one names the sender.
          seen.set(`${label}:${row.type}`, row.deviceId);
        }
      };
      sent('createSession', () => h.sim.actions.createSession(INPUT));
      sent('beginPrecheck', () => h.sim.actions.beginPrecheck());
      h.run(5_000);
      sent('startRecording', () => h.sim.actions.startRecording());
      h.run(CAPTURE_CONNECT_MS + 3_000);
      sent('addMarker', () => h.sim.actions.addMarker('Question 1'));
      sent('addNote', () => h.sim.actions.addNote('The witness asked for water.'));
      sent('snapshot', () => h.sim.actions.snapshot());
      sent('stopRecording', () => h.sim.actions.stopRecording('Interview finished'));
      h.run(60_000, 250);
      const sessionId = h.state().session?.id ?? '';
      sent('acknowledgeSummary', () => h.sim.actions.acknowledgeSummary(sessionId));
      const evidenceId = h.sealedItem();
      sent('verify', () => h.sim.actions.verify(evidenceId));
      sent('exportEvidence', () => h.sim.actions.exportEvidence(evidenceId, { reason: 'Case file handover', destination: 'Case file transfer' }));
      sent('archiveEvidence', () => h.sim.actions.archiveEvidence(evidenceId));
      sent('exportAudit', () => h.sim.actions.exportAudit({ reason: 'Audit review of the week', destination: '' }));
      sent('acknowledgeAlert', () => h.sim.actions.acknowledgeAlert(h.state().alerts[0]?.id ?? ''));

      const types = [...seen.keys()];
      // The actions wrote rows: the sweep is not empty, and the rows of the findings are in it.
      for (const expected of ['createSession:SESSION_CREATED', 'startRecording:RECORDING_STARTED', 'stopRecording:RECORDING_STOPPED', 'acknowledgeSummary:SUMMARY_ACKNOWLEDGED', 'verify:EVIDENCE_VERIFIED', 'exportEvidence:EVIDENCE_EXPORTED', 'exportAudit:AUDIT_EXPORTED']) {
        expect(types, expected).toContain(expected);
      }
      expect([...seen.entries()].filter(([, deviceId]) => deviceId !== DEVICE)).toEqual([]);
      console.info(`[wave-k-s2] sweep, rows of the acting operator that name the sending device: ${types.join(', ')}`);
    });

    it('5 - the Core\'s own verification (INTERNAL, nobody in auth): the device, the operation and the failed FRAGMENT are on the row; without them the row is as before', () => {
      const h = harness();
      const item = h.state().evidence.find((candidate) => candidate.integritySource === 'REAL');
      // The dataset holds no REAL item: one is made of a sealed item, as a Core's seal would state it.
      const evidenceId = item?.id ?? h.sealedItem();
      const real = (state: SimState): SimState => ({ ...state, evidence: state.evidence.map((candidate) => (candidate.id === evidenceId ? { ...candidate, integritySource: 'REAL' as const } : candidate)) });
      const at = h.clock.now();
      const base = { evidenceId, at, manifestOk: true, signatureOk: true, actorId: 'OPR-001' };

      const failed = recordEvidenceVerificationTransition(real(h.state()), at, { ...base, ok: false, failedTracks: ['VIDEO-02'], detail: 'Mismatch: VIDEO-02 fragment 3', deviceId: DEVICE, operationId: 'verifyEvidence', failedFragments: ['VIDEO-02:3'] });
      expect(failed.audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFY_FAILED', deviceId: DEVICE, actorId: 'OPR-001', details: { failedTracks: 'VIDEO-02', failedFragments: 'VIDEO-02:3', failedFragmentCount: 1, operationId: 'verifyEvidence', eventKind: 'TAMPER' } });

      const many = Array.from({ length: 11 }, (_, index) => `VIDEO-01:${index + 1}`);
      const cut = recordEvidenceVerificationTransition(real(h.state()), at, { ...base, ok: false, failedTracks: ['VIDEO-01'], detail: null, deviceId: DEVICE, operationId: 'verifyEvidence', failedFragments: many });
      expect(cut.audit.rows.at(-1)?.details).toMatchObject({ failedFragments: many.slice(0, 8).join(','), failedFragmentCount: 11 });

      const passed = recordEvidenceVerificationTransition(real(h.state()), at, { ...base, ok: true, failedTracks: [], detail: null, deviceId: DEVICE, operationId: 'verifyEvidence', failedFragments: [] });
      expect(passed.audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFIED', deviceId: DEVICE, details: { operationId: 'verifyEvidence' } });
      expect(passed.audit.rows.at(-1)?.details).not.toHaveProperty('failedFragments');

      // CONTROL: the web console (no device), and a caller that hands in nothing new.
      const web = recordEvidenceVerificationTransition(real(h.state()), at, { ...base, ok: false, failedTracks: ['VIDEO-02'], detail: null, deviceId: null, operationId: 'verifyEvidence', failedFragments: ['VIDEO-02:3'] });
      expect(web.audit.rows.at(-1)?.deviceId).toBeNull();
      const plain = recordEvidenceVerificationTransition(real(h.state()), at, { ...base, ok: false, failedTracks: ['VIDEO-02'], detail: null });
      expect(plain.audit.rows.at(-1)).toMatchObject({ deviceId: null });
      expect(Object.keys(plain.audit.rows.at(-1)?.details ?? {})).toEqual(['manifestOk', 'signatureOk', 'failedTracks', 'eventKind']);
      // A value that is no fragment name, no device id, no operation id is not written.
      const hostile = recordEvidenceVerificationTransition(real(h.state()), at, { ...base, ok: false, failedTracks: ['VIDEO-02'], detail: null, deviceId: 'not a device', operationId: 'a b', failedFragments: ['x y', 'VIDEO-02:3'] });
      expect(hostile.audit.rows.at(-1)).toMatchObject({ deviceId: null, details: { failedFragments: 'VIDEO-02:3', failedFragmentCount: 1 } });
      expect(hostile.audit.rows.at(-1)?.details).not.toHaveProperty('operationId');
    });

    it('6 - CONTROL: the same actions from a web console session (no device in auth) keep `deviceId: null`', () => {
      const h = harness('andi.pratama');
      const sessionId = sealedSession(h);
      const evidenceId = h.sealedItem();
      const rows = [
        ...h.sentBy(null, () => h.sim.actions.acknowledgeSummary(sessionId)),
        ...h.sentBy(null, () => h.sim.actions.verify(evidenceId)),
        ...h.sentBy(null, () => h.sim.actions.exportEvidence(evidenceId, { reason: 'Case file handover', destination: '' })),
      ];
      expect(rows.map((row) => [row.type, row.deviceId])).toEqual([
        ['SUMMARY_ACKNOWLEDGED', null],
        ['EVIDENCE_VERIFIED', null],
        ['EVIDENCE_EXPORTED', null],
      ]);
    });

    it('7 - CONTROL: a row that names a device of its own keeps it; a row of nobody keeps null; a value that names no device is not written', () => {
      const h = harness('rina.wijaya');
      // A device command names the camera it is about - never overwritten by the sender.
      const restarted = h.sentBy(DEVICE, () => h.sim.actions.deviceCommand('CAM-01', 'RESTART'));
      const own = restarted.filter((row) => row.deviceId !== null && row.deviceId !== DEVICE);
      expect(own.length).toBeGreaterThan(0);
      expect(restarted.filter((row) => row.deviceId === 'CAM-01').length).toBeGreaterThan(0);

      // Engine-timed rows (no actor) written while a device is in `auth` name no device.
      const t = harness();
      t.sim.actions.createSession(INPUT);
      t.sim.actions.beginPrecheck();
      const ticked = t.sentBy(DEVICE, () => t.run(5_000));
      expect(ticked.length).toBeGreaterThan(0);
      expect(ticked.filter((row) => row.actorId === null && row.deviceId === DEVICE)).toEqual([]);

      const bad = harness();
      expect(bad.sentBy('not a device id', () => bad.sim.actions.verify(bad.sealedItem())).map((row) => row.deviceId)).toEqual([null]);
    });
  });
});

// Closing pass F-X, item 6 (F-M5 decision 4; contract C3 §5.2, E-30): the simulator's
// `AUDIO_SOURCE_SWITCHED` row names the sending device where the simulator knows one - a simulator
// that runs inside a tablet or phone app (`deviceConsole: true`, the device session of the Core) -
// and carries NO such key for a web console session, as the Core does. Written RED: the row never
// carried the member.
describe('the microphone switch of a simulator inside a device app', () => {
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

  // Audit row 150 (D28 DQ-2; register N-29, N-36): operation 81 is retired, so neither a device console nor a web console
  // session writes a switch row any more - by the action or by the route. The rule `sendingDeviceOf` names the device on
  // the rows of the other session actions (below), unchanged.
  describe('the sending device of a microphone switch in the simulator (op 81 retired: no row from any console)', () => {
    it.each([true, false])('device console %s: the action and operation 81 are refused AUDIO_SOURCE_FIXED_BY_PAIRING, and no switch row is written', (deviceConsole) => {
      const h = recording(deviceConsole);
      expect(() => h.sim.actions.switchAudioSource('MIC-02')).toThrow(expect.objectContaining({ code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' }));
      h.run(1_000);
      const answer = h.sim.request({ method: 'POST', path: `/api/v1/session/${h.sessionId}/audio-source`, body: { inputId: 'MIC-01' } });
      expect(answer).toMatchObject({ status: 409, body: { error: { code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' } } });
      expect(h.lastSwitch()).toBeUndefined();
    });
  });
});

// G70-05 (gate 70; fix wave H, driver D): a `CAPTURE_CONFIG_CHANGED` row written for a command of
// a tablet or a phone carried NO sending device, while `CAPTURE_DISCOVERY_SEARCHED` from the same
// device did. One rule for every row a paired device causes: `sendingDeviceOf` (the rule the audio
// switch uses, finding G75-02) - the paired device of the acting identity, or none for a web
// console session. The row names it in its own `deviceId`; the DETAILS keep their exact key list
// (decision D106 (3)), whose `deviceId` is the CAPTURE device the line names.
describe('a selector edit', () => {
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
    // D61 (2026-11-04): the by-role pair became the by-channel set; D30 K-6 (row 155): a pure trade of
    // channels 1 and 2 is a swap and writes ONE channel-swap row (was one SOURCE row per channel).
    ['operation 78, the microphone pair', { kind: 'UPDATE', mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' }, { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' }] }, 1],
  ];

  describe('G70-05: a selector edit names the device that sent it', () => {
    it.each(CHANGES)('%s from a paired device: every row of the edit carries that device', (_label, change, atLeast) => {
      const next = setCaptureConfigTransition(fromDevice(signedIn(), PAIRED), NOW + 1_000, change);
      const rows = changedRows(next);
      // D125 (row 155): the count is EXACT - op 80 one row, op 79's camera trade two, op 78's mic swap ONE (D30 K-6).
      expect(rows).toHaveLength(atLeast);
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

    it('D30 K-6 (row 155, D125): the two-line operation-78 mic swap from a paired device is EXACTLY ONE channel-swap row; a single line keeps its one SOURCE row', () => {
      const swap = changedRows(setCaptureConfigTransition(fromDevice(signedIn(), PAIRED), NOW + 1_000, { kind: 'UPDATE', mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' }, { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' }] }));
      expect(swap.map((row) => [row.deviceId, row.details])).toEqual([
        [PAIRED, { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'CHANNEL', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'MIC-02', to: 'MIC-01', permission: 'CAPTURE_CONFIG' }],
      ]);
      // CONTROL - a single line by channel onto an empty channel is one SOURCE row, as before.
      const cleared = setCaptureConfigTransition(signedIn(), NOW + 1_000, { kind: 'UPDATE', unassign: ['MIC-03'] });
      const before = changedRows(cleared).length;
      const single = changedRows(setCaptureConfigTransition(fromDevice(cleared, PAIRED), NOW + 2_000, { kind: 'UPDATE', mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-03' }] })).slice(before);
      expect(single.map((row) => [row.details['field'], row.details['channel'], row.details['to']])).toEqual([['SOURCE', 'MIC-03', 'MIC-03']]);
    });

    it('a value that is no device id is never written as one', () => {
      const rows = changedRows(setCaptureConfigTransition(fromDevice(signedIn(), 'not a device; DROP'), NOW + 1_000, { kind: 'PRIMARY_MIC', inputId: 'MIC-02' }));
      expect(rows.map((row) => row.deviceId ?? null)).toEqual([null]);
    });
  });
});

// Wave H, driver B (decision D200; gate 75). G75-02: the switch row names the sending device of the
// command (the Core's device session). Written RED against f293221.
describe('the microphone switch sent as a hosted command', () => {
  const { harness } = sessionFaultBed;

  // Audit row 150 (D28 DQ-2): the switch is retired, so a hosted command of a paired device session writes no switch row;
  // it is refused with the pairing code like a web console's.
  describe('G75-02 after D5: no switch row from a paired device session either', () => {
    const lastSwitch = (h: ReturnType<typeof harness>) => h.rows('AUDIO_SOURCE_SWITCHED').at(-1);

    it.each([['a paired device session', 'DEV-0002'], ['a web console session', null]] as const)('%s: the hosted command is refused AUDIO_SOURCE_FIXED_BY_PAIRING and no row is written', (_label, deviceId) => {
      const h = harness();
      h.toRecording();
      if (deviceId !== null) h.apply({ ...h.state(), auth: { ...h.state().auth, deviceId } });
      expect(() => h.sim.actions.switchAudioSource('MIC-02')).toThrow(expect.objectContaining({ code: 'AUDIO_SOURCE_FIXED_BY_PAIRING' }));
      expect(lastSwitch(h)).toBeUndefined();
    });
  });
});
