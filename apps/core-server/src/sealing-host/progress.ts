/**
 * THE ANSWER OF OPERATION 83 `getSealingProgress` (blueprint row 82b; contract C3 §2.2 operation
 * 83, §7; register SH-05, SH-06, CS-04, NM-07, E-13, MB-06; decisions D65(b), D121).
 *
 * ONE SOURCE: the `finalization` slice of the open session in the engine's COMMITTED state. In
 * real capture that slice is what the sealing pipeline reported from its checkpoints
 * (`applySealingProgress`: status, percent, the running step's `etaMs`, the attempt of every step
 * as `sealing_jobs` holds them); in Simulated mode it is what the simulator's timed seal wrote.
 * The answer is derived from it and from nothing else - never from a clock of the caller (E-13).
 *
 *   progressPct   the whole-percent progress over the six steps, from the PER-STEP percent: a
 *                 done step counts 100, the running step its own percent, every other step 0;
 *   etaMs         a seal the Core's pipeline drives: the remaining time of the RUNNING step as the
 *                 pipeline reported it (D121), null while it has no estimate or no step runs, 0
 *                 when every step is done. A timed (simulated) seal: the simulator's own figure
 *                 for the run, `SEALING_ETA_STEP_MS` per step that is left - the same number the
 *                 simulator answers in a client that runs without a Core;
 *   resumed       the seal was RESUMED: run again by a START of the Core (contract: "a RECOVERY
 *                 resume from a checkpoint", MB-06). On a Core in real capture that is a fact of the
 *                 sealing host (`resumedSeal`), handed in as `resumed`: the ATTEMPT of a step grows
 *                 with every run - an automatic retry of the same process and the retry on demand of
 *                 operation 33 too - so "attempt above the first" said "resumed after restart" with
 *                 no restart (fix wave I driver A1, re-gate 75 finding G75b-02; fix wave L, G75d-09
 *                 (a): the retry on demand is no resume either). Without that fact (Simulated mode:
 *                 the simulator's attempt grows on a RECOVERY only) the rule of the attempt stays.
 *
 * AN ENDED SESSION HAS NO PROGRESS (fix wave L; G75d-04). A session the Core ended UNSEALABLE is not
 * the open session any more: operation 83 answers 404 for it, and what says how it ended is the
 * notice (`unsealableNoticeOf`) and its `sessionHistory` entry (`outcome: INCOMPLETE`). A client
 * that still holds the last body of this answer must drop it then.
 *
 * Pure: no clock is read here; `now` is the Core instant of the request.
 */
import type { SealingProgressBody } from '@dems/shared/api';
import { SEALING_ETA_STEP_MS, SEALING_FIRST_ATTEMPT, type ActiveSession } from '@dems/shared/sim';

type Step = ActiveSession['finalization']['steps'][number];

const percentOf = (step: Step): number => (step.status === 'done' ? 100 : step.status === 'active' ? Math.max(0, Math.min(100, typeof step.progress === 'number' ? step.progress : 0)) : 0);

/** True for a seal whose every step carries a planned duration: the simulator's timed seal. */
export function isTimedSeal(steps: readonly Step[]): boolean {
  return steps.length > 0 && steps.every((step) => step.durationMs !== null);
}

/** The body of operation 83 for a session whose finalization has started. */
export function sealingProgressOf(session: Pick<ActiveSession, 'id' | 'state' | 'finalization'>, now: number, resumed: boolean | null = null): SealingProgressBody {
  const steps = session.finalization.steps;
  const total = Math.max(1, steps.length);
  const done = steps.reduce((sum, step) => sum + percentOf(step) / 100, 0);
  const running = steps.find((step) => step.status === 'active');
  const allDone = steps.length > 0 && steps.every((step) => step.status === 'done');
  let etaMs: number | null;
  if (isTimedSeal(steps)) {
    const remaining = Math.max(0, total - done);
    etaMs = remaining === 0 ? 0 : Math.round(remaining * SEALING_ETA_STEP_MS);
  } else {
    etaMs = allDone ? 0 : running === undefined ? null : (running.etaMs ?? null);
  }
  return {
    sessionId: session.id,
    state: session.state,
    steps: steps.map((step) => ({ id: step.id, status: step.status, startedAt: step.startedAt, completedAt: step.completedAt, durationMs: step.durationMs })),
    progressPct: Math.min(100, Math.floor((done / total) * 100)),
    etaMs,
    resumed: resumed ?? steps.some((step) => (step.attempt ?? SEALING_FIRST_ATTEMPT) > SEALING_FIRST_ATTEMPT),
    updatedAt: now,
  };
}
