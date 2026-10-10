// Fix wave H, driver A, finding G89-08 (explains G81-08; gates 81 and 89): operation 83 answered
// `STORE_SEALED_PACKAGE` with `completedAt` EARLIER than `startedAt` and `durationMs 0`.
//
// WHY. `sealedAt` of a real package is the instant the manifest's content was frozen at
// BUILD_MANIFEST - it is under the signature, so it cannot be a later instant - and the seal is
// committed with that instant AFTER SIGN_MANIFEST and STORE_SEALED_PACKAGE ran. The step that was
// still running at the commit was closed "at `sealedAt`", before its own start.
//
// RULED: the step timestamps are monotonic. `sealedAt` keeps its definition (the session's and the
// item's `sealedAt` are the manifest's); a step never completes before it started.
import { describe, expect, it } from 'vitest';
import { FINALIZATION_ORDER, applySealingProgressTransition, completeSealTransition, createManualClock, createSim, type CompleteSealInput, type SealingStepReport, type SessionCreateInput, type SimState } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);

function recorded() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = (): SimState => sim.store.getState();
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
  run(4_000);
  const sessionId = state().session?.id ?? '';
  sim.actions.stopRecording('Interview complete');
  const apply = (next: SimState): void => void sim.store.setState(next, true);
  return { clock, state, apply, sessionId };
}

const report = (running: number): SealingStepReport[] =>
  FINALIZATION_ORDER.map((id, index) => ({ id, status: index < running ? 'DONE' : index === running ? 'RUNNING' : 'PENDING', progress: index < running ? 100 : index === running ? 10 : 0, etaMs: index === running ? 100 : null, attempt: 1 }) as SealingStepReport);

const sealInput = (sessionId: string, sealedAt: number): CompleteSealInput => ({
  sessionId,
  sealedAt,
  manifestSha256: hex('ab'),
  signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
  tracks: [{ trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: hex('01') }, { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: hex('02') }],
  interrupted: false,
  durableEndAt: sealedAt - 2_000,
  transcriptSha256: null,
  labelsStatus: null,
  developmentSources: true,
});

describe('G89-08: the steps of a seal the Core drives', () => {
  it('a seal committed with the BUILD_MANIFEST instant: no step completes before it started, every duration is >= 0, the steps and the seal end in order - and `sealedAt` is still the manifest\'s instant', () => {
    const h = recorded();
    // The pipeline as the gate saw it: one report per step, each some milliseconds after the other.
    let sealedAt = 0;
    for (let running = 0; running < FINALIZATION_ORDER.length; running += 1) {
      h.clock.advance(20);
      // BUILD_MANIFEST (index 3) freezes `sealedAt`; SIGN_MANIFEST and STORE_SEALED_PACKAGE start after it.
      if (running === 3) sealedAt = h.clock.now();
      h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId: h.sessionId, steps: report(running) }));
    }
    const storeStartedAt = h.state().session?.finalization.steps.at(-1)?.startedAt ?? 0;
    // The condition of the finding: the last step began AFTER the instant the seal is committed with.
    expect(storeStartedAt).toBeGreaterThan(sealedAt);
    h.clock.advance(35);
    h.apply(completeSealTransition(h.state(), h.clock.now(), sealInput(h.sessionId, sealedAt)));

    const session = h.state().session;
    const steps = session?.finalization.steps ?? [];
    expect(session).toMatchObject({ state: 'SEALED', sealedAt });
    expect(h.state().evidence.at(-1)).toMatchObject({ sealedAt });
    expect(steps.map((step) => step.status)).toEqual(FINALIZATION_ORDER.map(() => 'done'));
    for (const step of steps) {
      expect(step.completedAt, step.id).toBeGreaterThanOrEqual(step.startedAt ?? Number.NaN);
      expect(step.durationMs, step.id).toBeGreaterThanOrEqual(0);
      expect(step.durationMs, step.id).toBe((step.completedAt ?? 0) - (step.startedAt ?? 0));
    }
    // In order: each step starts no earlier than the one before it, and completes no earlier than it.
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index]?.startedAt, steps[index]?.id).toBeGreaterThanOrEqual(steps[index - 1]?.startedAt ?? Number.NaN);
      expect(steps[index]?.completedAt, steps[index]?.id).toBeGreaterThanOrEqual(steps[index - 1]?.completedAt ?? Number.NaN);
    }
    expect(steps.at(-1)).toMatchObject({ startedAt: storeStartedAt, completedAt: storeStartedAt });
    // The seal as a whole ended when its last step did, never before `sealedAt`.
    expect(session?.finalization.completedAt).toBe(storeStartedAt);
    expect(session?.finalization.completedAt).toBeGreaterThanOrEqual(sealedAt);
  });

  it('CONTROL - a seal committed at an instant AFTER every step began keeps that instant as the completion of the running step', () => {
    const h = recorded();
    for (let running = 0; running < FINALIZATION_ORDER.length; running += 1) {
      h.clock.advance(20);
      h.apply(applySealingProgressTransition(h.state(), h.clock.now(), { sessionId: h.sessionId, steps: report(running) }));
    }
    h.clock.advance(500);
    const at = h.clock.now();
    h.apply(completeSealTransition(h.state(), at, sealInput(h.sessionId, at)));
    const last = h.state().session?.finalization.steps.at(-1);
    expect(last).toMatchObject({ completedAt: at, durationMs: 500 });
    expect(h.state().session?.finalization.completedAt).toBe(at);
  });
});
