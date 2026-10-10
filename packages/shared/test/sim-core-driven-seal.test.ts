// Blueprint row 82 (M7-W1): the seal the Core's pipeline drives, in the shared session machine.
// Register SH-06, SH-18, CS-04, E-13; evidence package spec §E.1, §E.2, §E.4; decisions D107 (1), D121.
//
// What is proven here is the machine only: pure transitions on the simulator's state. The pipeline
// that calls them is `apps/core-server/src/sealing`.
import { describe, expect, it } from 'vitest';
import {
  applySealingProgressTransition,
  audioSourceAtStart,
  completeSealTransition,
  createManualClock,
  createSim,
  FaultKind,
  FINALIZATION_ORDER,
  isCoreDrivenSeal,
  recordEvidenceVerificationTransition,
  type CompleteSealInput,
  type SealingStepReport,
  type SessionCreateInput,
  type SimState,
} from '../src/sim';
import { EvidenceItemSchema } from '../src/api/state-slices';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const apply = (next: SimState): void => {
    sim.store.setState(next, true);
  };
  const toRecording = (): string => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
    sim.actions.startRecording();
    run(4_000);
    return state().session?.id ?? '';
  };
  return { sim, clock, state, run, apply, toRecording };
}

const report = (running: number, progress: number, attempt = 1, etaMs: number | null = 900): SealingStepReport[] =>
  FINALIZATION_ORDER.map((id, index) => ({ id, status: index < running ? 'DONE' : index === running ? 'RUNNING' : 'PENDING', progress: index < running ? 100 : index === running ? progress : 0, etaMs: index === running ? etaMs : null, attempt }));

const sealInput = (sessionId: string, at: number, overrides: Partial<CompleteSealInput> = {}): CompleteSealInput => ({
  sessionId,
  sealedAt: at,
  manifestSha256: hex('ab'),
  signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
  tracks: [
    { trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: hex('01') },
    { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: hex('02') },
  ],
  interrupted: false,
  durableEndAt: at - 2_000,
  transcriptSha256: null,
  labelsStatus: null,
  developmentSources: true,
  ...overrides,
});

describe('D121: a step ETA is the remaining time of that step (simulator seal)', () => {
  it('the running step carries its own remaining time, never more than its duration; a waiting step carries none; a finished step 0', () => {
    const h = harness();
    h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    h.run(1_600);
    const steps = h.state().session?.finalization.steps ?? [];
    const active = steps.find((step) => step.status === 'active');
    expect(active?.etaMs).toBeGreaterThan(0);
    // The defect of D121: the run's remaining time (up to 6 x 1.2 s) stood here.
    expect(active?.etaMs).toBeLessThanOrEqual(active?.durationMs ?? 0);
    expect(steps.filter((step) => step.status === 'pending').every((step) => step.etaMs === null)).toBe(true);
    h.run(1_300);
    expect((h.state().session?.finalization.steps ?? []).filter((step) => step.status === 'done').every((step) => step.etaMs === 0)).toBe(true);
    h.run(10_000);
    expect(h.state().session?.state).toBe('SEALED');
  });
});

describe('applySealingProgress: the pipeline drives the finalization', () => {
  it('moves STOPPING to FINALIZING, and from then on no time seals the session', () => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(0, 10) }));
    expect(h.state().session?.state).toBe('FINALIZING');
    expect(isCoreDrivenSeal(h.state().session)).toBe(true);
    const evidenceBefore = h.state().evidence.length;
    h.run(60_000);
    // CONTROL of the claim: the simulator's own seal would have sealed within about 9 s.
    expect(h.state().session?.state).toBe('FINALIZING');
    expect(h.state().evidence.length).toBe(evidenceBefore);
    expect(h.state().session?.finalization.steps[0]).toMatchObject({ id: 'CLOSE_TRACKS', status: 'active', progress: 10, etaMs: 900, durationMs: null, attempt: 1 });
  });

  it('CONTROL: without the pipeline the same session seals by time (the guard is what holds it)', () => {
    const h = harness();
    h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    h.run(20_000);
    expect(h.state().session?.state).toBe('SEALED');
    expect(h.state().evidence.at(-1)?.integritySource).toBe('SIMULATED');
  });

  it('is forward-only inside one attempt, keeps a DONE step DONE, and lets a resumed attempt start lower', () => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    const step = (index: number) => h.state().session?.finalization.steps[index];
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(1, 60) }));
    h.clock.advance(100);
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(1, 20) }));
    expect(step(1)).toMatchObject({ status: 'active', progress: 60 });
    const doneAt = step(0)?.completedAt;
    // A resumed run (attempt 2) reports step 1 as running again and step 0 as pending: step 0 stays DONE.
    h.clock.advance(100);
    const resumed = report(1, 5, 2).map((entry, index) => (index === 0 ? { ...entry, status: 'PENDING' as const, progress: 0 } : entry));
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: resumed }));
    expect(step(0)).toMatchObject({ status: 'done', progress: 100, completedAt: doneAt });
    expect(step(1)).toMatchObject({ status: 'active', progress: 5, attempt: 2 });
    // The same report again changes nothing: no new state object, so nothing is written or published.
    const before = h.state();
    expect(applySealingProgressTransition(before, h.clock.now() + 50, { sessionId, steps: resumed })).toBe(before);
  });

  it('refuses another session, and a session that is not stopping, finalizing, faulted or recovering', () => {
    const h = harness();
    const sessionId = h.toRecording();
    expect(() => applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(0, 1) })).toThrow();
    h.sim.actions.stopRecording('Interview complete');
    expect(() => applySealingProgressTransition(h.state(), h.clock.now(), { sessionId: 'SES-20990101-0001', steps: report(0, 1) })).toThrow();
  });

  it('the interrupted path: FAULT becomes FINALIZING with RECOVERY_STARTED, and a dropped tail is written once into the session record', () => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.inject(FaultKind.POWER_FAIL);
    expect(h.state().session?.state).toBe('FAULT');
    const tails = [{ trackId: 'VIDEO-02', droppedBytes: 37 }];
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(0, 0), truncatedTails: tails }));
    expect(h.state().session?.state).toBe('FINALIZING');
    expect(h.state().audit.rows.filter((row) => row.type === 'RECOVERY_STARTED' && row.sessionId === sessionId)).toHaveLength(1);
    h.clock.advance(100);
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(0, 50), truncatedTails: tails }));
    const marks = (h.state().session?.timeline ?? []).filter((item) => item.kind === 'CHECK' && item.params?.source === 'TAIL_VALIDATION');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.params).toMatchObject({ trackId: 'VIDEO-02', droppedBytes: 37, truncated: true });
    h.run(30_000);
    // A recovering session the pipeline holds is never closed as INCOMPLETE by the time.
    expect(h.state().session?.state).toBe('FINALIZING');
  });
});

describe('completeSeal: the item of the real package', () => {
  it('seals with the hashes and the signature it was handed; the item passes the slice schema and names nothing simulated', () => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
    h.clock.advance(500);
    const at = h.clock.now();
    h.apply(completeSealTransition(h.state(), at, sealInput(sessionId, at, { transcriptSha256: hex('7a'), labelsStatus: 'LABELLED' })));
    const session = h.state().session;
    const item = h.state().evidence.at(-1);
    expect(session).toMatchObject({ state: 'SEALED', sealedAt: at });
    expect(session?.finalization.steps.every((step) => step.status === 'done' && step.progress === 100 && step.etaMs === 0)).toBe(true);
    expect(item).toMatchObject({
      id: session?.evidenceId,
      integritySource: 'REAL',
      status: 'SEALED',
      manifestHash: hex('ab'),
      manifestVersion: 2,
      transcriptSha256: hex('7a'),
      labelsStatus: 'LABELLED',
      developmentSources: true,
      sizeBytes: 9_000,
      signature: { algorithm: 'Ed25519', simulated: false, value: hex('cd', 128) },
    });
    expect(item?.tracks.map((track) => [track.trackId, track.sha256])).toEqual([['VIDEO-01', hex('01')], ['VIDEO-02', hex('02')]]);
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true);
    expect(h.state().sessionHistory[0]).toMatchObject({ id: sessionId, outcome: 'SEALED', evidenceId: item?.id });
    const sealedRows = h.state().audit.rows.filter((row) => row.type === 'EVIDENCE_SEALED' && row.sessionId === sessionId);
    expect(sealedRows).toHaveLength(1);
    expect(Object.keys(sealedRows[0]?.details ?? {}).sort()).toEqual(['manifestHash', 'sizeBytes', 'tracks']);
  });

  it('an interrupted seal ends where the durable media ends, says so in the custody, and closes the recovery', () => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.inject(FaultKind.POWER_FAIL);
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
    const at = h.clock.now() + 300;
    h.apply(completeSealTransition(h.state(), at, sealInput(sessionId, at, { interrupted: true, durableEndAt: at - 5_000 })));
    const item = h.state().evidence.at(-1);
    expect(item?.endedAt).toBe(at - 5_000);
    expect(item?.custody.map((entry) => entry.action)).toEqual(['RECORDING_STARTED', 'RECORDING_INTERRUPTED', 'SEALED']);
    expect(item?.custody.at(-1)?.detail).toBe('Durable prefix sealed (interrupted)');
    // A SEALED history entry names no fault (the database CHECK `session_history_outcome_check`); the custody does.
    expect(h.state().sessionHistory[0]).toMatchObject({ outcome: 'SEALED', faultKind: null });
    expect(item?.custody[1]).toMatchObject({ action: 'RECORDING_INTERRUPTED', detail: 'POWER_FAIL' });
    expect(h.state().audit.rows.filter((row) => row.type === 'RECOVERY_COMPLETED' && row.sessionId === sessionId)).toHaveLength(1);
  });

  it.each([['VIDEO-01' as const], ['VIDEO-02' as const]])('F-M7 R88-01: a session that recorded with ONE camera file (%s) is sealed with that file: the item lists it alone', (trackId) => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
    const at = h.clock.now() + 200;
    h.apply(completeSealTransition(h.state(), at, sealInput(sessionId, at, { tracks: [{ trackId, sizeBytes: 4_000, sha256: hex('01') }] })));
    const item = h.state().evidence.at(-1);
    expect(h.state().session).toMatchObject({ state: 'SEALED', sealedAt: at });
    expect(item?.tracks.map((track) => [track.trackId, track.label, track.sizeBytes])).toEqual([[trackId, trackId === 'VIDEO-01' ? 'Camera 1' : 'Camera 2', 4_000]]);
    expect(item?.sizeBytes).toBe(4_000);
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true);
    expect(h.state().audit.rows.filter((row) => row.type === 'EVIDENCE_SEALED' && row.sessionId === sessionId)[0]?.details).toMatchObject({ tracks: 1 });
    // The Core is free again: a sealed session blocks no new one.
    expect(() => h.sim.actions.createSession({ ...INPUT, caseNumber: 'LP/2026/1001-0009' })).not.toThrow();
  });

  it.each([
    ['a manifest digest that is no SHA-256', { manifestSha256: 'abc' }],
    ['a simulated-length signature', { signature: { value: hex('cd'), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' as const } }],
    // Fix pass F-M7 (R88-01, D178): ONE camera file is a sealed package (the case below proves it); these are not.
    ['no camera file', { tracks: [] }],
    ['the two camera files in the wrong order', { tracks: [{ trackId: 'VIDEO-02' as const, sizeBytes: 1, sha256: hex('02') }, { trackId: 'VIDEO-01' as const, sizeBytes: 1, sha256: hex('01') }] }],
    ['one camera file twice', { tracks: [{ trackId: 'VIDEO-01' as const, sizeBytes: 1, sha256: hex('01') }, { trackId: 'VIDEO-01' as const, sizeBytes: 1, sha256: hex('01') }] }],
    ['a camera file without a hash', { tracks: [{ trackId: 'VIDEO-01' as const, sizeBytes: 1, sha256: '' }, { trackId: 'VIDEO-02' as const, sizeBytes: 1, sha256: hex('02') }] }],
    ['another session', { sessionId: 'SES-20990101-0001' }],
  ])('refuses %s and seals nothing', (_name, overrides) => {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
    const items = h.state().evidence.length;
    expect(() => completeSealTransition(h.state(), h.clock.now(), sealInput(sessionId, h.clock.now(), overrides as Partial<CompleteSealInput>))).toThrow();
    expect(h.state().evidence.length).toBe(items);
    expect(h.state().session?.state).toBe('FINALIZING');
  });

  it('refuses a session whose pipeline reported a failed step, and one that is not finalizing', () => {
    const h = harness();
    const sessionId = h.toRecording();
    expect(() => completeSealTransition(h.state(), h.clock.now(), sealInput(sessionId, h.clock.now()))).toThrow();
    h.sim.actions.stopRecording('Interview complete');
    const failed = report(3, 40).map((entry, index) => (index === 3 ? { ...entry, status: 'FAILED' as const } : entry));
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: failed }));
    expect(h.state().session?.finalization.steps[3]?.status).toBe('error');
    expect(() => completeSealTransition(h.state(), h.clock.now(), sealInput(sessionId, h.clock.now()))).toThrow();
  });
});

describe('recordEvidenceVerification: a verdict the Core computed (D107 (1))', () => {
  function sealed() {
    const h = harness();
    const sessionId = h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(5, 90) }));
    h.apply(completeSealTransition(h.state(), h.clock.now(), sealInput(sessionId, h.clock.now())));
    return { h, evidenceId: h.state().evidence.at(-1)?.id ?? '' };
  }

  it('a pass and a failure write the keys of the hosted verify; the failure names the file and is a TAMPER row', () => {
    const { h, evidenceId } = sealed();
    const at = h.clock.now() + 1_000;
    h.apply(recordEvidenceVerificationTransition(h.state(), at, { evidenceId, ok: true, at, manifestOk: true, signatureOk: true, failedTracks: [], detail: null, actorId: 'OPR-001' }));
    let item = h.state().evidence.find((entry) => entry.id === evidenceId);
    expect(item?.verification).toEqual({ status: 'PASS', at });
    expect(item?.custody.at(-1)).toEqual({ at, action: 'VERIFIED', actorId: 'OPR-001', detail: null });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFIED', evidenceId, actorId: 'OPR-001', details: { manifestOk: true, signatureOk: true, failedTracks: '' } });

    h.apply(recordEvidenceVerificationTransition(h.state(), at + 5, { evidenceId, ok: false, at: at + 5, manifestOk: true, signatureOk: true, failedTracks: ['VIDEO-02'], detail: 'Mismatch: VIDEO-02 fragment 3', actorId: 'OPR-001' }));
    item = h.state().evidence.find((entry) => entry.id === evidenceId);
    expect(item?.verification).toEqual({ status: 'FAIL', at: at + 5 });
    expect(item?.custody.at(-1)).toMatchObject({ action: 'VERIFY_FAILED', detail: 'Mismatch: VIDEO-02 fragment 3' });
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFY_FAILED', details: { failedTracks: 'VIDEO-02', eventKind: 'TAMPER' } });
  });

  it('refuses an item that is not REAL (its verdict is the hosted action\'s) and an unknown item', () => {
    const { h } = sealed();
    const dataset = h.state().evidence.find((entry) => entry.integritySource !== 'REAL');
    expect(dataset).toBeDefined();
    const verdict = { ok: true, at: h.clock.now(), manifestOk: true, signatureOk: true, failedTracks: [], detail: null, actorId: null };
    expect(() => recordEvidenceVerificationTransition(h.state(), h.clock.now(), { ...verdict, evidenceId: dataset?.id ?? '' })).toThrow();
    expect(() => recordEvidenceVerificationTransition(h.state(), h.clock.now(), { ...verdict, evidenceId: 'EV-20990101-0001' })).toThrow();
  });

  it('PASS E3: a SEED-SEALED demo item (DEMO_PACKAGE, version 2, development sources, really signed) takes the verdict; each member missing refuses it', () => {
    const { h } = sealed();
    const demo = h.state().evidence.find((entry) => entry.integritySource === 'DEMO_PACKAGE');
    if (demo === undefined) throw new Error('the dataset holds no demo item');
    const verdict = { evidenceId: demo.id, ok: false, at: h.clock.now(), manifestOk: true, signatureOk: true, failedTracks: ['VIDEO-02'], detail: 'Mismatch: VIDEO-02 fragment 3', actorId: null };
    const signed = { value: 'cd'.repeat(64), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false } as unknown as typeof demo.signature;
    const withItem = (item: typeof demo) => ({ ...h.state(), evidence: h.state().evidence.map((entry) => (entry.id === demo.id ? item : entry)) });
    const seedSealed = { ...demo, manifestVersion: 2 as const, developmentSources: true, signature: signed };
    const next = recordEvidenceVerificationTransition(withItem(seedSealed), h.clock.now(), verdict);
    expect(next.evidence.find((entry) => entry.id === demo.id)?.verification).toEqual({ status: 'FAIL', at: verdict.at });
    expect(next.audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFY_FAILED', evidenceId: demo.id });
    // CONTROLS: the frozen demo item itself, and each of the three facts taken away.
    expect(() => recordEvidenceVerificationTransition(h.state(), h.clock.now(), verdict)).toThrow();
    expect(() => recordEvidenceVerificationTransition(withItem({ ...seedSealed, signature: demo.signature }), h.clock.now(), verdict)).toThrow();
    expect(() => recordEvidenceVerificationTransition(withItem({ ...seedSealed, developmentSources: false }), h.clock.now(), verdict)).toThrow();
    expect(() => recordEvidenceVerificationTransition(withItem({ ...demo, developmentSources: true, signature: signed }), h.clock.now(), verdict)).toThrow();
  });
});

describe('the session audio source is the selector\'s pair, whatever its inputs are named (D133 (1), D137; request of pass D1b)', () => {
  it('a pair MIC-03 / MIC-01 starts with MIC-03 active; CONTROL: the built-in pair starts as before', () => {
    const h = harness();
    const state = h.state();
    expect(audioSourceAtStart(state, 'SES-20261001-0001')).toMatchObject({ activeInputId: 'MIC-01', standbyInputId: 'MIC-02' });
    const [first, second] = state.captureConfig.mics;
    const moved: SimState = { ...state, captureConfig: { ...state.captureConfig, mics: [{ ...first!, inputId: 'MIC-01', deviceId: 'MIC-01', role: 'STANDBY' }, { ...second!, inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' }] } };
    expect(audioSourceAtStart(moved, 'SES-20261001-0001')).toMatchObject({ activeInputId: 'MIC-03', standbyInputId: 'MIC-01' });
  });
});

// Blueprint row 82b: who seals a stopped session. In Simulated mode the simulator's timed seal; a
// session the Core's capture recorded (it carries `captureDurable`) waits for the Core's pipeline.
describe('a stopped session: the timed seal of Simulated mode, and a session the Core recorded', () => {
  it('SIMULATED (no `captureDurable`): the timed seal runs as before - FINALIZING after the stop, SEALED with a simulated item', () => {
    const h = harness();
    h.toRecording();
    expect(h.state().session?.captureDurable).toBeUndefined();
    h.sim.actions.stopRecording('Interview complete');
    h.run(1_600);
    expect(h.state().session?.state).toBe('FINALIZING');
    expect(h.state().session?.finalization.steps.every((step) => step.durationMs !== null)).toBe(true);
    const items = h.state().evidence.length;
    h.run(10_000);
    expect(h.state().session?.state).toBe('SEALED');
    expect(h.state().evidence).toHaveLength(items + 1);
    expect(h.state().evidence.at(-1)?.integritySource).not.toBe('REAL');
  });

  it.each([true, false])('RECORDED BY THE CORE (`captureDurable: %s`): no time seals it - it stays STOPPING, no item appears, until the pipeline reports', (durable) => {
    const h = harness();
    const sessionId = h.toRecording();
    // Pass D10: the stop comes first - a stop of a session that says `false` is refused now
    // (CAPTURE_NOT_DURABLE), and this case is about what seals a STOPPED session.
    h.sim.actions.stopRecording('Interview complete');
    const session = h.state().session;
    if (session === null) throw new Error('no session');
    h.apply({ ...h.state(), session: { ...session, captureDurable: durable } });
    const items = h.state().evidence.length;
    h.run(60_000);
    expect(h.state().session?.state).toBe('STOPPING');
    expect(h.state().evidence).toHaveLength(items);
    // The pipeline's first report is what moves it on, and from there no tick seals it either.
    h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId, steps: report(0, 10) }));
    expect(isCoreDrivenSeal(h.state().session)).toBe(true);
    h.run(60_000);
    expect(h.state().session?.state).toBe('FINALIZING');
    expect(h.state().evidence).toHaveLength(items);
  });
});
