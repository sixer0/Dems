// Operation 83's answer (blueprint row 82b; C3 §2.2 op 83; D121): derived from the session's
// `finalization` slice only. Pure: no app, no clock.
import { validateCoreApiResponse } from '@dems/shared/api';
import { FINALIZATION_ORDER, SEALING_ETA_STEP_MS, type ActiveSession } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { isTimedSeal, sealingProgressOf } from '../progress';

type Step = ActiveSession['finalization']['steps'][number];
const NOW = 1_791_529_000_000;

/** A seal the Core's pipeline drives: no planned duration on a step that is not done. */
const coreStep = (index: number, running: number, progress: number, etaMs: number | null, attempt = 1): Step => {
  const id = FINALIZATION_ORDER[index]!;
  if (index < running) return { id, status: 'done', startedAt: NOW - 9_000, completedAt: NOW - 8_000, durationMs: 1_000, progress: 100, etaMs: 0, detail: null, attempt };
  if (index === running) return { id, status: 'active', startedAt: NOW - 2_000, completedAt: null, durationMs: null, progress, etaMs, detail: '3 of 9 fragments (VIDEO-01)', attempt };
  return { id, status: 'pending', startedAt: null, completedAt: null, durationMs: null, progress: 0, etaMs: null, detail: null, attempt };
};
const session = (steps: Step[], state: ActiveSession['state'] = 'FINALIZING') => ({ id: 'SES-20261009-0001', state, finalization: { steps, startedAt: NOW - 9_000, completedAt: null } });
const core = (running: number, progress: number, etaMs: number | null, attempt = 1): Step[] => FINALIZATION_ORDER.map((_id, index) => coreStep(index, running, progress, etaMs, attempt));

describe('operation 83: the progress of a seal the pipeline drives', () => {
  it('progressPct is formed from the PER-STEP percent, and etaMs is the RUNNING step\'s own remaining time', () => {
    const body = sealingProgressOf(session(core(1, 50, 4_200)), NOW);
    // One step done (100) + the running step at 50 of six steps: 150 / 600.
    expect(body).toMatchObject({ sessionId: 'SES-20261009-0001', state: 'FINALIZING', progressPct: 25, etaMs: 4_200, resumed: false, updatedAt: NOW });
    expect(body.steps.map((step) => step.status)).toEqual(['done', 'active', 'pending', 'pending', 'pending', 'pending']);
    expect(Object.keys(body.steps[1]!).sort()).toEqual(['completedAt', 'durationMs', 'id', 'startedAt', 'status']);
  });

  it('CONTROL: the percent follows the running step (it is not a count of finished steps) and the ETA is not a figure per remaining step', () => {
    expect(sealingProgressOf(session(core(1, 0, 4_200)), NOW).progressPct).toBe(16);
    expect(sealingProgressOf(session(core(1, 99, 10)), NOW)).toMatchObject({ progressPct: 33, etaMs: 10 });
    expect(sealingProgressOf(session(core(1, 50, 4_200)), NOW).etaMs).not.toBe(Math.round(4.5 * SEALING_ETA_STEP_MS));
  });

  it('no estimate yet is null, a failed step leaves no running step (null), every step done is 0', () => {
    expect(sealingProgressOf(session(core(0, 2, null)), NOW).etaMs).toBeNull();
    const failed = core(1, 40, 900).map((step, index): Step => (index === 1 ? { ...step, status: 'error', etaMs: null, detail: 'Camera file VIDEO-02 holds no whole recording (MISSING): this session cannot be sealed.' } : step));
    expect(sealingProgressOf(session(failed), NOW)).toMatchObject({ etaMs: null, progressPct: 16 });
    expect(sealingProgressOf(session(failed), NOW).steps[1]?.status).toBe('error');
    expect(sealingProgressOf(session(core(6, 0, null), 'SEALED'), NOW)).toMatchObject({ etaMs: 0, progressPct: 100, state: 'SEALED' });
  });

  it('a resumed seal (an attempt above the first) says so', () => {
    expect(sealingProgressOf(session(core(2, 10, 300, 2)), NOW).resumed).toBe(true);
    expect(sealingProgressOf(session(core(2, 10, 300, 1)), NOW).resumed).toBe(false);
  });

  it('every answer has the shape the contract documents for operation 83', () => {
    for (const steps of [core(0, 0, null), core(3, 70, 12), core(6, 0, null)]) {
      expect(validateCoreApiResponse('getSealingProgress', 200, sealingProgressOf(session(steps), NOW))).toMatchObject({ ok: true });
    }
  });
});

describe('operation 83: the timed seal of Simulated mode keeps the simulator\'s own figures', () => {
  const timed = (running: number, progress: number): Step[] =>
    FINALIZATION_ORDER.map((id, index): Step => ({ id, status: index < running ? 'done' : index === running ? 'active' : 'pending', startedAt: index <= running ? NOW - 1_000 : null, completedAt: index < running ? NOW - 500 : null, durationMs: 800, progress: index < running ? 100 : index === running ? progress : 0, etaMs: index === running ? 400 : null, detail: null, attempt: 1 }));

  it('is recognised by a planned duration on every step; its ETA is the simulator\'s figure for the run, not the step\'s', () => {
    expect(isTimedSeal(timed(2, 50))).toBe(true);
    expect(isTimedSeal(core(2, 50, 400))).toBe(false);
    const body = sealingProgressOf(session(timed(2, 50)), NOW);
    expect(body.progressPct).toBe(41);
    expect(body.etaMs).toBe(Math.round(3.5 * SEALING_ETA_STEP_MS));
  });
});
