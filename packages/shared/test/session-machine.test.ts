// Session machine (AC-52; masterplan/01_specs.md §14.7 transition table; book §6.2).
// Every allowed row passes, disallowed transitions throw SimTransitionError, and a second
// createSession while a session is active is refused (S26). AC-62 and AC-63 unit forms too.
// D54 (a): every sim here uses storage: null and authStorage: null.
import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createSim,
  passCaptureStart,
  PRECHECK_TOTAL_MAX_MS,
  selectSealedHourly,
  selectSealedToday,
  SimTransitionError,
  wibDateParts,
  type FaultKind,
  type SessionCreateInput,
  type SimState,
  EVIDENCE_NOT_SEALED_DIGEST,
  EVIDENCE_NOT_SEALED_SIGNATURE,
  hasSealedValues,
} from '../src/sim';
import { EvidenceItemSchema } from '../src/api';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 2026-10-01 10:00 WIB

const INPUT: SessionCreateInput = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'Test Saksi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

function harness(operator: 'budi.santoso' | 'andi.pratama' | 'rina.wijaya' | null = 'budi.santoso') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  if (operator) sim.actions.signIn(operator, 'demo-2026');
  const state = () => sim.store.getState();
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const auditTypes = () => state().audit.rows.map((row) => row.type);
  const toArmed = () => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
  };
  const toRecording = () => {
    toArmed();
    sim.actions.startRecording();
    // Pass D10: a start connects its cameras first; these tests need a recording that can be stopped.
    passCaptureStart(clock.advance, sim.tick);
  };
  return { sim, clock, state, run, auditTypes, toArmed, toRecording };
}

function sessionState(state: SimState) {
  return state.session?.state ?? null;
}

describe('allowed transitions (§14.7 table)', () => {
  it('null → createSession → CREATE, audit SESSION_CREATED', () => {
    const h = harness();
    const result = h.sim.actions.createSession(INPUT);
    expect(result).toEqual({ ok: true, sessionId: 'SES-20261001-0024', created: true });
    expect(sessionState(h.state())).toBe('CREATE');
    expect(h.state().session?.createdBy).toBe('OPR-001');
    expect(h.auditTypes().at(-1)).toBe('SESSION_CREATED');
    expect(h.state().meta.counters.session).toBe(25);
  });

  it('CREATE → beginPrecheck → PRECHECK: 8 checks resolve one at a time, 300-700 ms each, all within 5 s (AC-62)', () => {
    const h = harness();
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    const precheck = h.state().session?.precheck;
    expect(sessionState(h.state())).toBe('PRECHECK');
    expect(precheck?.items.map((item) => item.status)).toEqual(['RUNNING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']);
    const times = [START, ...(precheck?.items.map((item) => item.resolvesAt ?? 0) ?? [])];
    for (let index = 1; index < times.length; index += 1) {
      const gap = (times[index] ?? 0) - (times[index - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(300);
      expect(gap).toBeLessThanOrEqual(700);
    }
    expect((times.at(-1) ?? 0) - START).toBeLessThanOrEqual(PRECHECK_TOTAL_MAX_MS);

    // One at a time: after the first check's time, exactly one is resolved and the next runs.
    h.run((times[1] ?? START) - START);
    expect(h.state().session?.precheck.items.slice(0, 2).map((item) => item.status)).toEqual(['PASS', 'RUNNING']);
    h.run(5_000);
    expect(h.state().session?.precheck.items.every((item) => item.status === 'PASS')).toBe(true);
  });

  it('PRECHECK, all PASS → ARMED, audit PRECHECK_PASSED', () => {
    const h = harness();
    h.toArmed();
    expect(sessionState(h.state())).toBe('ARMED');
    expect(h.state().session?.precheck.outcome).toBe('PASS');
    expect(h.state().session?.armedAt).toBe(h.state().session?.precheck.completedAt);
    expect(h.auditTypes()).toContain('PRECHECK_PASSED');
  });

  it('PRECHECK with a BLOCK stays in PRECHECK and lists the reasons; retry after clearing arms', () => {
    const h = harness();
    h.sim.actions.inject('STORAGE_FULL');
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    const session = h.state().session;
    expect(session?.state).toBe('PRECHECK');
    expect(session?.precheck.outcome).toBe('BLOCK');
    expect(session?.precheck.items.find((item) => item.id === 'STORAGE')).toMatchObject({ status: 'BLOCK', value: 'FULL' });
    expect(h.auditTypes()).toContain('PRECHECK_BLOCKED');
    expect(() => h.sim.actions.startRecording()).toThrow(SimTransitionError);

    h.sim.actions.clearFault('STORAGE_FULL');
    h.sim.actions.retryPrecheck();
    h.run(5_000);
    expect(sessionState(h.state())).toBe('ARMED');
  });

  it('PRECHECK with a WARN waits for acknowledgement, then arms (MIC CLIP, time on RTC)', () => {
    const h = harness();
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    h.sim.actions.inject('GNSS_LOSS', { fallback: 'RTC' });
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    const items = h.state().session?.precheck.items ?? [];
    expect(h.state().session?.precheck.outcome).toBe('WARN');
    expect(items.find((item) => item.id === 'MIC_STANDBY')).toMatchObject({ status: 'WARN', value: 'CLIP' });
    expect(items.find((item) => item.id === 'TIME')).toMatchObject({ status: 'WARN', value: 'RTC' });
    expect(sessionState(h.state())).toBe('PRECHECK');
    h.run(10_000);
    expect(sessionState(h.state())).toBe('PRECHECK');
    h.sim.actions.acknowledgePrecheckWarnings();
    expect(sessionState(h.state())).toBe('ARMED');
    expect(h.state().session?.precheck.warningsAcknowledged).toBe(true);
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'PRECHECK_PASSED', details: { warnings: 2, acknowledged: true } });
  });

  it('time on NTP passes the gate and shows its source (informational)', () => {
    const h = harness();
    h.sim.actions.inject('GNSS_LOSS');
    h.toArmed();
    expect(h.state().session?.precheck.items.find((item) => item.id === 'TIME')).toMatchObject({ status: 'PASS', value: 'NTP' });
  });

  it('ARMED → startRecording → RECORDING: startedAt = now, audit RECORDING_STARTED, timeline START', () => {
    const h = harness();
    h.toArmed();
    const now = h.clock.now();
    h.sim.actions.startRecording();
    const session = h.state().session;
    expect(session).toMatchObject({ state: 'RECORDING', startedAt: now });
    expect(session?.timeline[0]).toMatchObject({ kind: 'START', at: now });
    expect(h.auditTypes().at(-1)).toBe('RECORDING_STARTED');
    expect(h.state().cameras.map((camera) => camera.recState)).toEqual(['REC', 'REC']);
    expect(h.state().otherDevices.find((device) => device.id === 'REC-INDICATOR')?.status).toBe('SEDANG MEREKAM');
  });

  it('RECORDING → stopRecording(reason ≥ 5) → STOPPING; a short reason throws', () => {
    const h = harness();
    h.toRecording();
    h.run(20_000);
    expect(() => h.sim.actions.stopRecording('done')).toThrow(SimTransitionError);
    expect(sessionState(h.state())).toBe('RECORDING');
    h.sim.actions.stopRecording('  Interview completed  ');
    const session = h.state().session;
    expect(session).toMatchObject({ state: 'STOPPING', stopReason: 'Interview completed', stoppedAt: h.clock.now() });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'RECORDING_STOPPED', details: { reason: 'Interview completed' } });
  });

  it('STOPPING (1.5 s) → FINALIZING (6 steps of 0.6-1.2 s) → SEALED within 10 s, with evidence (AC-63)', () => {
    const h = harness();
    h.toRecording();
    h.run(30_000);
    h.sim.actions.stopRecording('Interview completed');
    const stoppedAt = h.clock.now();
    h.run(1_450);
    expect(sessionState(h.state())).toBe('STOPPING');
    h.run(100);
    expect(sessionState(h.state())).toBe('FINALIZING');
    const steps = h.state().session?.finalization.steps ?? [];
    // Sealing steps v2 (SH-01; `ev §E.1`): CLOSE_TRACKS .. STORE_SEALED_PACKAGE. The v1 pair
    // FINALIZE_TRACKS/CALCULATE_HASHES is renamed, and ENCRYPT_PAYLOAD is fallback-only (OD-21),
    // so it no longer runs in the normal pipeline.
    expect(steps.map((step) => step.id)).toEqual([
      'CLOSE_TRACKS',
      'FINALIZE_HASHES',
      'FINALIZE_TRANSCRIPT',
      'BUILD_MANIFEST',
      'SIGN_MANIFEST',
      'STORE_SEALED_PACKAGE',
    ]);
    for (const step of steps) {
      expect(step.durationMs).toBeGreaterThanOrEqual(600);
      expect(step.durationMs).toBeLessThanOrEqual(1_200);
    }
    const sealedBefore = selectSealedToday(h.state());
    h.run(8_500);
    const state = h.state();
    const session = state.session;
    expect(session?.state).toBe('SEALED');
    expect((session?.sealedAt ?? 0) - stoppedAt).toBeLessThanOrEqual(10_000);
    expect(session?.finalization.steps.every((step) => step.status === 'done')).toBe(true);
    const evidence = state.evidence.at(-1);
    expect(evidence).toMatchObject({ id: 'EV-20261001-0014', sessionId: session?.id, status: 'SEALED', sealedAt: session?.sealedAt });
    expect(evidence?.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']);
    expect(state.audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_SEALED', evidenceId: evidence?.id });
    // sealedHourly incremented in the seal's WIB hour.
    expect(selectSealedToday(state)).toBe(sealedBefore + 1);
    expect(selectSealedHourly(state)[wibDateParts(session?.sealedAt ?? 0).hour]).toBeGreaterThanOrEqual(1);
    expect(state.lastSealedSessionId).toBe(session?.id);
    expect(h.sim.actions.verify(evidence?.id ?? '').ok).toBe(true);
  });

  it('SEALED → createSession → CREATE (the next session)', () => {
    const h = harness();
    h.toRecording();
    h.sim.actions.stopRecording('Interview completed');
    h.run(12_000);
    expect(sessionState(h.state())).toBe('SEALED');
    const result = h.sim.actions.createSession({ ...INPUT, subjectName: 'Second Saksi' });
    expect(result).toEqual({ ok: true, sessionId: 'SES-20261001-0025', created: true });
    expect(sessionState(h.state())).toBe('CREATE');
  });

  const criticalRows: [string, FaultKind][] = [
    ['PRECHECK', 'STORAGE_FULL'],
    ['ARMED', 'TPM_FAILURE'],
    ['RECORDING', 'POWER_FAIL'],
    ['FINALIZING', 'SECURITY_FAULT'],
  ];
  it.each(criticalRows)('%s + inject(%s) → FAULT, with a CRITICAL alert and an audit row', (from, kind) => {
    const h = harness();
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    if (from !== 'PRECHECK') h.run(5_000);
    if (from === 'RECORDING' || from === 'FINALIZING') h.sim.actions.startRecording();
    if (from === 'FINALIZING') {
      h.run(10_000);
      h.sim.actions.stopRecording('Interview completed');
      h.run(2_000);
    }
    expect(sessionState(h.state())).toBe(from);
    h.sim.actions.inject(kind);
    const state = h.state();
    expect(state.session?.state).toBe('FAULT');
    expect(state.session?.fault).toMatchObject({ kind, fromState: from });
    expect(state.alerts.at(-1)).toMatchObject({ kind, severity: 'CRITICAL', active: true });
    expect(state.audit.rows.at(-1)).toMatchObject({ type: 'FAULT_RAISED', details: { kind, fromState: from } });
  });

  it('FAULT → recover → RECOVERY (scan, analysis, 3 s) → no session; kept INCOMPLETE, never sealed (SYS-008)', () => {
    const h = harness();
    h.toRecording();
    h.run(12_000);
    h.sim.actions.inject('STORAGE_FULL');
    expect(sessionState(h.state())).toBe('FAULT');
    const sessionId = h.state().session?.id;
    h.sim.actions.recover();
    expect(h.state().session?.recovery).toMatchObject({ stage: 'RECOVERY_SCAN' });
    h.run(1_600);
    expect(h.state().session?.recovery?.stage).toBe('INCOMPLETE_SESSION_ANALYSIS');
    h.run(1_500);
    const state = h.state();
    expect(state.session).toBeNull();
    expect(state.sessionHistory[0]).toMatchObject({ id: sessionId, outcome: 'INCOMPLETE', faultKind: 'STORAGE_FULL' });
    const evidence = state.evidence.find((item) => item.sessionId === sessionId);
    expect(evidence).toMatchObject({ status: 'RECORDED', sealedAt: null });
    expect(state.audit.rows.map((row) => row.type)).toEqual(expect.arrayContaining(['RECOVERY_STARTED', 'SESSION_INCOMPLETE', 'RECOVERY_COMPLETED']));
    expect(state.audit.rows.some((row) => row.type === 'EVIDENCE_SEALED' && row.sessionId === sessionId)).toBe(false);

    // Fix wave J (decision D243; truth rule 3a; BLOCKER JA2-01 / JW-01). The item of a session that "will never be
    // sealed" carries NO sealed value: no track (so no per-track hash), the null digest where the shape needs a manifest
    // hash, a placeholder where it needs a signature, no v2 seal member - and it parses as an item of the contract.
    expect(evidence).toMatchObject({ tracks: [], manifestHash: EVIDENCE_NOT_SEALED_DIGEST, signature: EVIDENCE_NOT_SEALED_SIGNATURE, verification: { status: 'NOT_RUN', at: null }, tampered: false });
    expect(evidence).not.toHaveProperty('files');
    expect(evidence).not.toHaveProperty('fragmentChainHead');
    expect(evidence).not.toHaveProperty('transcriptSha256');
    expect(hasSealedValues(evidence)).toBe(false);
    expect(EvidenceItemSchema.safeParse(JSON.parse(JSON.stringify(evidence))).success).toBe(true);
    // No 64-hex value of the record is anything but the null digest.
    expect((JSON.stringify(evidence).match(/[0-9a-f]{64}/g) ?? []).filter((hex) => hex !== EVIDENCE_NOT_SEALED_DIGEST)).toEqual([]);

    // Verify answers that there is nothing sealed to verify: refused, no verdict, no custody entry, no row, no event.
    const rows = state.audit.total;
    const events = state.events.length;
    let refused: unknown = null;
    try {
      h.sim.actions.verify(evidence!.id);
    } catch (error) {
      refused = error;
    }
    expect(refused).toMatchObject({ name: 'SimTransitionError', code: 'UNSEALED_EVIDENCE', event: 'verify' });
    expect(h.state().evidence.find((item) => item.sessionId === sessionId)).toEqual(evidence);
    expect(h.state().audit.total).toBe(rows);
    expect(h.state().events.length).toBe(events);
    expect(h.state().audit.rows.some((row) => (row.type === 'EVIDENCE_VERIFIED' || row.type === 'EVIDENCE_VERIFY_FAILED') && row.evidenceId === evidence!.id)).toBe(false);
  });

  it('fix wave J CONTROL - a session that IS sealed carries its sealed values and verifies (a demonstration verdict); every other non-sealed end makes no item', () => {
    const h = harness();
    h.toRecording();
    h.run(12_000);
    const sessionId = h.state().session?.id;
    h.sim.actions.stopRecording('Interview completed');
    h.run(20_000);
    const sealed = h.state().evidence.find((item) => item.sessionId === sessionId);
    expect(sealed).toMatchObject({ status: 'SEALED', integritySource: 'SIMULATED' });
    expect(hasSealedValues(sealed)).toBe(true);
    expect(sealed?.tracks).toHaveLength(4);
    expect(sealed?.manifestHash).not.toBe(EVIDENCE_NOT_SEALED_DIGEST);
    expect(h.sim.actions.verify(sealed!.id)).toMatchObject({ ok: true, demonstration: true });

    // Cancelled before a recording, and a fault before a recording: no evidence item at all.
    const before = h.state().evidence.length;
    h.sim.actions.acknowledgeSummary(sessionId ?? '');
    h.sim.actions.createSession({ ...INPUT, caseNumber: 'LP/2026/1001-0042' });
    h.sim.actions.cancel();
    h.sim.actions.createSession({ ...INPUT, caseNumber: 'LP/2026/1001-0043' });
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    h.sim.actions.inject('POWER_FAIL');
    h.sim.actions.recover();
    h.run(5_000);
    expect(h.state().session).toBeNull();
    expect(h.state().evidence).toHaveLength(before);
    expect(h.state().sessionHistory[0]).toMatchObject({ outcome: 'INCOMPLETE', startedAt: null, evidenceId: null });
    // While a session records, stops and finalizes there is no item of it either.
    h.sim.actions.clearFault('POWER_FAIL');
    h.sim.actions.createSession({ ...INPUT, caseNumber: 'LP/2026/1001-0044' });
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    h.sim.actions.startRecording();
    h.run(3_000);
    const open = h.state().session?.id;
    expect(h.state().evidence.some((item) => item.sessionId === open)).toBe(false);
    h.sim.actions.stopRecording('Interview completed');
    expect(h.state().evidence.some((item) => item.sessionId === open)).toBe(false);
  });

  it.each(['CREATE', 'PRECHECK', 'ARMED'])('%s → cancel → no session, audit SESSION_CANCELLED', (from) => {
    const h = harness();
    h.sim.actions.createSession(INPUT);
    if (from !== 'CREATE') h.sim.actions.beginPrecheck();
    if (from === 'ARMED') h.run(5_000);
    expect(sessionState(h.state())).toBe(from);
    h.sim.actions.cancel();
    expect(h.state().session).toBeNull();
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'SESSION_CANCELLED', details: { fromState: from } });
  });
});

describe('disallowed transitions throw SimTransitionError', () => {
  it('from IDLE', () => {
    const h = harness();
    for (const action of ['beginPrecheck', 'startRecording', 'cancel', 'recover', 'snapshot', 'addMarker', 'acknowledgePrecheckWarnings', 'retryPrecheck'] as const) {
      expect(() => (h.sim.actions[action] as () => void)()).toThrow(SimTransitionError);
    }
    expect(() => h.sim.actions.stopRecording('Interview completed')).toThrow(SimTransitionError);
    expect(() => h.sim.actions.addNote('text')).toThrow(SimTransitionError);
  });

  it('out of order inside a session', () => {
    const h = harness();
    h.sim.actions.createSession(INPUT);
    expect(() => h.sim.actions.startRecording()).toThrow(SimTransitionError); // CREATE ↛ RECORDING
    h.sim.actions.beginPrecheck();
    expect(() => h.sim.actions.retryPrecheck()).toThrow(SimTransitionError); // checks still running
    expect(() => h.sim.actions.acknowledgePrecheckWarnings()).toThrow(SimTransitionError); // no WARN
    h.run(5_000);
    expect(() => h.sim.actions.stopRecording('Interview completed')).toThrow(SimTransitionError); // ARMED ↛ STOPPING
    expect(() => h.sim.actions.recover()).toThrow(SimTransitionError); // not FAULT
    h.sim.actions.startRecording();
    expect(() => h.sim.actions.cancel()).toThrow(SimTransitionError); // RECORDING ↛ cancel
    expect(() => h.sim.actions.beginPrecheck()).toThrow(SimTransitionError);
    expect(() => h.sim.actions.addNote('   ')).toThrow(SimTransitionError);
    passCaptureStart(h.clock.advance, h.sim.tick);
    h.sim.actions.stopRecording('Interview completed');
    expect(() => h.sim.actions.addMarker()).toThrow(SimTransitionError); // STOPPING
    expect(sessionState(h.state())).toBe('STOPPING');
  });

  it('the error names the state and the event', () => {
    const h = harness();
    try {
      h.sim.actions.startRecording();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SimTransitionError);
      expect(error).toMatchObject({ from: null, event: 'startRecording' });
    }
  });
});

describe('createSession refusals and idempotency (S26, §5.6)', () => {
  it('a second, different session while one is active is refused', () => {
    const h = harness();
    h.toRecording();
    const id = h.state().session?.id;
    const second = h.sim.actions.createSession({ ...INPUT, subjectName: 'Someone Else' });
    expect(second).toEqual({ ok: false, reason: 'SESSION_ACTIVE', sessionId: id });
    expect(h.state().session?.id).toBe(id);
    expect(h.state().meta.counters.session).toBe(25);
  });

  it('the same input again (a retry after reconnect) returns the same session, never a second one', () => {
    const h = harness();
    const first = h.sim.actions.createSession(INPUT);
    expect(h.sim.actions.createSession({ ...INPUT, subjectName: '  Test   Saksi ' })).toEqual({
      ok: true,
      sessionId: first.ok ? first.sessionId : '',
      created: false,
    });
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    h.sim.actions.startRecording();
    expect(h.sim.actions.createSession(INPUT)).toMatchObject({ ok: true, created: false });
    expect(h.state().audit.rows.filter((row) => row.type === 'SESSION_CREATED' && row.sessionId === h.state().session?.id)).toHaveLength(1);
  });

  it('refuses when signed out, for a TECHNICIAN, and for invalid input', () => {
    expect(harness(null).sim.actions.createSession(INPUT)).toEqual({ ok: false, reason: 'NOT_SIGNED_IN', sessionId: null });
    expect(harness('rina.wijaya').sim.actions.createSession(INPUT)).toEqual({ ok: false, reason: 'NOT_PERMITTED', sessionId: null });
    const h = harness();
    expect(h.sim.actions.createSession({ ...INPUT, subjectName: ' ' })).toMatchObject({ ok: false, reason: 'INVALID_INPUT' });
    expect(h.sim.actions.createSession({ ...INPUT, investigatorId: 'OPR-003' })).toMatchObject({ ok: false, reason: 'INVALID_INPUT' });
    expect(h.sim.actions.createSession({ ...INPUT, subjectType: 'WITNESS' as never })).toMatchObject({ ok: false, reason: 'INVALID_INPUT' });
    expect(h.state().session).toBeNull();
  });
});

describe('policy details', () => {
  it('a non-critical fault while recording keeps RECORDING but raises an alert, an audit row and a FAULT timeline node (§6.4)', () => {
    const h = harness();
    h.toRecording();
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    const state = h.state();
    expect(state.session?.state).toBe('RECORDING');
    expect(state.cameras.find((camera) => camera.id === 'VIDEO-02')).toMatchObject({ lens: 'FAULT', online: false, recState: 'LOST' });
    expect(state.alerts.at(-1)).toMatchObject({ kind: 'CAMERA_LOSS', active: true });
    expect(state.audit.rows.at(-1)).toMatchObject({ type: 'FAULT_RAISED', details: { kind: 'CAMERA_LOSS', evt: 'EVT-04' } });
    expect(state.session?.timeline.at(-1)).toMatchObject({ kind: 'FAULT' });
  });

  it('a catch-up after a long pause gives the same seal time as a live run (scheduled transitions)', () => {
    const live = harness();
    live.toRecording();
    live.run(10_000);
    live.sim.actions.stopRecording('Interview completed');
    live.run(12_000);

    const late = harness();
    late.toRecording();
    late.run(10_000);
    late.sim.actions.stopRecording('Interview completed');
    late.clock.advance(12_000);
    late.sim.tick();

    expect(late.state().session?.state).toBe('SEALED');
    expect(late.state().session?.sealedAt).toBe(live.state().session?.sealedAt);
    expect(late.state().session?.finalization).toEqual(live.state().session?.finalization);
  });

  it('markers, notes and snapshots feed the timeline and the audit trail while recording', () => {
    const h = harness();
    h.toRecording();
    h.sim.actions.addMarker('Key statement');
    h.sim.actions.addNote('Subject asked for water');
    h.sim.actions.snapshot();
    const session = h.state().session;
    expect(session?.timeline.slice(-3).map((item) => item.kind)).toEqual(['MARKER', 'NOTE', 'SNAPSHOT']);
    expect(session).toMatchObject({ markerCount: 1, snapshotCount: 1 });
    expect(session?.notes[0]).toMatchObject({ text: 'Subject asked for water', authorId: 'OPR-001' });
    expect(h.auditTypes().slice(-3)).toEqual(['MARKER_ADDED', 'NOTE_ADDED', 'SNAPSHOT_TAKEN']);
    // The note text stays in the session record, not in the audit trail.
    expect(JSON.stringify(h.state().audit.rows)).not.toContain('Subject asked for water');
  });
});
