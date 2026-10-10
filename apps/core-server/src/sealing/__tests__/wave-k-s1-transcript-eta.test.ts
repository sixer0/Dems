// FIX WAVE K, driver S1 - re-gate 75 finding G75c-05: "This step: about 1680 s left" for a step of 8-16 s.
//
// The remaining time of the transcript step was `remainingWaitMs` of its WAITING answer: what is left of the BOUND of
// the wait (the longest the step waits before it closes the transcript out), not an estimate of the work. The Core has
// no sound basis for an estimate there (D230 forbids a figure derived from the speed of the STT), so the member is
// null: no ETA is stated, and the operator reads "n of m chunks". The steps the Core measures itself keep theirs.
import { afterAll, describe, expect, it } from 'vitest';
import type { FinalizeTranscriptResult } from '../finalize-transcript/contract';
import { removePackages } from './package-support';
import { harnessOf, recordSession, removeRecordings } from './pipeline-support';

afterAll(() => {
  removeRecordings();
  removePackages();
});

describe('G75c-05: the transcript step states no remaining time', () => {
  it('a WAITING answer with 1,680 s left of its bound: the step is told RUNNING with its chunk counters and `etaMs: null` - never the bound; then the seal completes', async () => {
    const recording = recordSession();
    const h = harnessOf(recording);
    const real = h.ports.transcript.finalize;
    let waits = 0;
    Object.assign(h.ports, {
      transcript: {
        ...h.ports.transcript,
        finalize: async (input: Parameters<typeof real>[0]): Promise<FinalizeTranscriptResult> => {
          if (waits < 2) {
            waits += 1;
            return { status: 'WAITING', progress: 33, counters: { chunksTotal: 3, chunksDone: 1, chunksFailed: 0 }, remainingWaitMs: 1_680_000 };
          }
          return real(input);
        },
      },
    });
    let outcome: Awaited<ReturnType<ReturnType<typeof h.again>['run']>> | null = null;
    const running = h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' }).then((result) => void (outcome = result));
    // The poll of the step waits on the harness clock: it is moved on until the run ends (file work takes real turns).
    for (let turn = 0; turn < 2_000 && outcome === null; turn += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 2));
      h.clock.advance(1_000);
    }
    expect(outcome).not.toBeNull();
    await running;
    expect(outcome).toMatchObject({ status: 'SEALED' });
    expect(waits).toBe(2);

    const told = h.engine.progress.flatMap((report) => report.steps.filter((step) => step.id === 'FINALIZE_TRANSCRIPT' && step.status === 'RUNNING'));
    const waiting = told.filter((step) => step.detail === '1 of 3 chunks');
    expect(waiting.length).toBeGreaterThanOrEqual(1);
    expect(waiting.map((step) => step.etaMs)).toEqual(waiting.map(() => null));
    expect(waiting.map((step) => step.progress)).toEqual(waiting.map(() => 33));
    // Nothing the Core told anybody holds the bound.
    expect(JSON.stringify(h.engine.progress)).not.toContain('1680000');
    // The transcript step never states a remaining time while it runs.
    expect(told.every((step) => step.etaMs === null)).toBe(true);
  });
});
