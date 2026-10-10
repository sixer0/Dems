// Fix wave K, driver S2 - findings G89b-04 (verify rows), G94b-03 (export rows), G75c-09
// (SUMMARY_ACKNOWLEDGED, RECOVERY_STARTED) of the re-gates; rule of D216 (2): "every audit row of an
// action sent by a paired device carries that device's id".
//
// Wave I named six session rows one by one (`sim-wave-i-a2-sending-device.test.ts`). The rule is now
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
import { describe, expect, it } from 'vitest';
import { CAPTURE_CONNECT_MS, FaultKind, createManualClock, createSim, recordEvidenceVerificationTransition, type AuditRow, type SessionCreateInput, type SimState } from '../src/sim';

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

describe('D216 (2), wave K: the rows wave I did not name carry the sending device', () => {
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
