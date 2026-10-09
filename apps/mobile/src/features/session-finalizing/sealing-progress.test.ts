// Blueprint row 87 (M7-W6; MB-04; UX spec flows 3 and 4; E-13): sealing progress on the tablet and the
// phone is forward-only and comes from the Core's states alone. The rule itself (pure); the screen is
// `finalizing-forward-only.test.tsx`. The web console holds the same cases for its own copy.
//
// | Rule | Where |
// |------|-------|
// | The percent is the mean of the step percents, floored (the rule of operation 83) | "the rule" |
// | A lower value from the Core never rewinds a step or the overall percent; a DONE step stays DONE | "forward-only" |
// | NEGATIVE CONTROL: without a new Core state nothing moves | "no Core state, no movement" |
// | The ETA is the Core's or none; never a number made here | "the ETA" |
import { describe, expect, it } from '@jest/globals';
import { FINALIZATION_STEPS_V2 } from '@dems/shared/domain';
import { EMPTY_SEALING_MEMORY, advanceSealing, etaSeconds, type SealingMemory, type SealingStepInput } from './sealing-progress';

const IDS = FINALIZATION_STEPS_V2;

/** Six steps: the first `done` are DONE, the next is running at `progress`, the rest wait. */
function steps(done: number, progress: number | undefined, patch: Partial<SealingStepInput> = {}): SealingStepInput[] {
  return IDS.map((id, index) => {
    if (index < done) return { id, status: 'done', progress: 100, attempt: 1 };
    if (index === done) return { id, status: 'active', ...(progress === undefined ? {} : { progress }), attempt: 1, ...patch };
    return { id, status: 'pending', progress: 0, attempt: 1 };
  });
}

/** Feeds Core states in order and returns the view after each. */
function feed(states: readonly (readonly SealingStepInput[] | null)[], sessionId = 'SES-1', sealedAtLast = false) {
  let memory: SealingMemory = EMPTY_SEALING_MEMORY;
  return states.map((state, index) => {
    const next = advanceSealing(memory, sessionId, state, sealedAtLast && index === states.length - 1);
    memory = next.memory;
    return next.view;
  });
}

describe('the rule', () => {
  it('percent = floor(mean of the step percents); DONE is 100, a running step its progress, a waiting step 0', () => {
    expect(feed([null])[0]!.percent).toBe(0);
    expect(feed([steps(0, 0)])[0]!.percent).toBe(0);
    expect(feed([steps(1, 0)])[0]!.percent).toBe(16);
    expect(feed([steps(1, 50)])[0]!.percent).toBe(25);
    expect(feed([steps(3, 72)])[0]!.percent).toBe(62);
    expect(feed([steps(5, 99)])[0]!.percent).toBe(99);
  });

  it('100 belongs to SEALED (or to six DONE steps): a running step never reads 100', () => {
    const view = feed([steps(5, 100)])[0]!;
    expect(view.steps[5]).toMatchObject({ status: 'active', percent: 99 });
    expect(view.percent).toBe(99);
    expect(feed([steps(5, 99), steps(6, undefined)])[1]!.percent).toBe(100);
    expect(feed([steps(2, 10)], 'SES-1', true)[0]).toMatchObject({ percent: 100, etaMs: null });
  });

  it('without a `progress` from the Core (the v1 shape) it is the count of DONE steps, as before this row', () => {
    const view = feed([steps(2, undefined)])[0]!;
    expect(view.percent).toBe(33);
    expect(view.reportsProgress).toBe(false);
  });
});

describe('forward-only', () => {
  it('a lower percent of the running step is not drawn; the overall never decreases', () => {
    const views = feed([steps(2, 80), steps(2, 30), steps(2, 85)]);
    expect(views.map((view) => view.steps[2]!.percent)).toEqual([80, 80, 85]);
    expect(views.map((view) => view.percent)).toEqual([46, 46, 47]);
  });

  it('a resumed attempt that rewrites a DONE step: the step stays DONE, the percent stays, and the view says "resumed"', () => {
    const first = steps(4, 40);
    // RECOVERY resumes from an earlier checkpoint: step 3 runs again at attempt 2, the later steps wait again.
    const resumed: SealingStepInput[] = IDS.map((id, index) => {
      if (index < 2) return { id, status: 'done', progress: 100, attempt: 1 };
      if (index === 2) return { id, status: 'active', progress: 5, attempt: 2 };
      return { id, status: 'pending', progress: 0, attempt: 1 };
    });
    const [before, after] = feed([first, resumed]);
    expect(before!.percent).toBe(73);
    expect(after!.percent).toBe(73);
    // Steps 3 and 4 were drawn DONE and stay DONE; step 5 follows the Core (it waits again) and keeps the percent it had.
    expect(after!.steps.map((step) => step.status)).toEqual(['done', 'done', 'done', 'done', 'pending', 'pending']);
    expect(after!.steps.map((step) => step.percent)).toEqual([100, 100, 100, 100, 40, 0]);
    expect([before!.resumed, after!.resumed, after!.attempt]).toEqual([false, true, 2]);
  });

  it('a state without the steps (the slice is missing for a moment, or lists fewer steps) does not rewind the overall percent', () => {
    const views = feed([steps(4, 40), null, steps(4, 40).slice(0, 2), steps(4, 45)]);
    expect(views.map((view) => view.percent)).toEqual([73, 73, 73, 74]);
    // A state that lists MORE steps than the one before lowers the mean; what was drawn is kept.
    const grown = feed([steps(1, 60).slice(0, 2), steps(1, 60)]);
    expect(grown.map((view) => view.percent)).toEqual([80, 80]);
  });

  it('another session starts from nothing', () => {
    let memory = advanceSealing(EMPTY_SEALING_MEMORY, 'SES-1', steps(4, 90), false).memory;
    const next = advanceSealing(memory, 'SES-2', steps(0, 10), false);
    memory = next.memory;
    expect(next.view.percent).toBe(1);
    expect(next.view.steps[3]!.status).toBe('pending');
    expect(memory.sessionId).toBe('SES-2');
  });
});

describe('no Core state, no movement (negative control)', () => {
  it('the same state again changes nothing, and gives back the same memory object', () => {
    const state = steps(2, 55, { etaMs: 4_000 });
    const first = advanceSealing(EMPTY_SEALING_MEMORY, 'SES-1', state, false);
    const second = advanceSealing(first.memory, 'SES-1', state, false);
    const third = advanceSealing(second.memory, 'SES-1', steps(2, 55, { etaMs: 4_000 }), false);
    expect(second.memory).toBe(first.memory);
    expect(third.memory).toBe(first.memory);
    expect(third.view).toEqual(first.view);
  });
});

describe('the ETA', () => {
  it("is the Core's value at the running step, or none; a number is never made here", () => {
    expect(feed([steps(2, 10, { etaMs: 4_200 })])[0]).toMatchObject({ etaMs: 4_200, reportsProgress: true });
    expect(feed([steps(2, 10, { etaMs: null })])[0]).toMatchObject({ etaMs: null, reportsProgress: true });
    expect(feed([steps(2, 10)])[0]).toMatchObject({ etaMs: null, reportsProgress: true });
    expect(feed([steps(2, 10, { etaMs: -5 })])[0]!.etaMs).toBeNull();
    expect(feed([steps(2, 10, { etaMs: Number.NaN })])[0]!.etaMs).toBeNull();
    expect([etaSeconds(4_200), etaSeconds(1), etaSeconds(0), etaSeconds(61_000)]).toEqual([5, 1, 1, 61]);
  });
});
