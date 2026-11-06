// The scheduler of the engine host (plan row W26; spec ENG-1, ENG-5). Database-free and without
// real time: a manual clock, a manual timer, and ticks whose end the test decides.
import { createManualClock } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { createScheduler, type Scheduler } from '../scheduler';
import { manualTimer, type ManualTimer } from './support';

interface Deferred {
  resolve(): void;
  reject(error: unknown): void;
}

interface Harness {
  readonly scheduler: Scheduler;
  readonly timer: ManualTimer;
  readonly clock: ReturnType<typeof createManualClock>;
  /** The ticks and probes that were submitted and have not ended, oldest first. */
  readonly ticks: Deferred[];
  readonly probes: Deferred[];
  readonly events: string[];
}

function harness(): Harness {
  const timer = manualTimer();
  const clock = createManualClock(1_000_000);
  const ticks: Deferred[] = [];
  const probes: Deferred[] = [];
  const events: string[] = [];
  const pending = (list: Deferred[]) => () =>
    new Promise<void>((resolve, reject) => {
      list.push({ resolve, reject });
    });
  const scheduler = createScheduler({
    timer: timer.timer,
    clock,
    intervalMs: 50,
    probeIntervalMs: 1_000,
    tick: pending(ticks),
    probe: pending(probes),
    onSuspended: (error) => events.push(`suspended:${String((error as { code?: string }).code)}`),
    onResumed: () => events.push('resumed'),
  });
  return { scheduler, timer, clock, ticks, probes, events };
}

/** Lets the continuations of a settled promise run. */
const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
};

describe('one unit of the engine in flight (ENG-1)', () => {
  it('does nothing before start, and registers one repeating call at the engine interval', () => {
    const { scheduler, timer, ticks } = harness();
    scheduler.fire();
    expect(ticks).toHaveLength(0);
    scheduler.start();
    scheduler.start();
    expect(timer.active()).toBe(1);
    expect(timer.registered()).toBe(1);
    expect(scheduler.stats()).toMatchObject({ running: true, suspended: false, ticks: 0, skipped: 0 });
  });

  it('a timer call submits no tick while the last one is still queued or running; it is counted as skipped', async () => {
    const { scheduler, timer, ticks } = harness();
    scheduler.start();
    timer.fire();
    timer.fire();
    timer.fire();
    expect(ticks).toHaveLength(1);
    expect(scheduler.stats()).toMatchObject({ ticks: 1, skipped: 2 });

    ticks[0]?.resolve();
    await settle();
    timer.fire();
    expect(ticks).toHaveLength(2);
    expect(scheduler.stats()).toMatchObject({ ticks: 2, skipped: 2 });
  });

  it('idle() resolves when what is in flight has ended, and at once when nothing is', async () => {
    const { scheduler, timer, ticks } = harness();
    scheduler.start();
    await scheduler.idle();
    timer.fire();
    let idle = false;
    const waiting = scheduler.idle().then(() => {
      idle = true;
    });
    await settle();
    expect(idle).toBe(false);
    ticks[0]?.resolve();
    await waiting;
    expect(idle).toBe(true);
  });
});

describe('suspension after a tick that was not committed (ENG-5)', () => {
  it('suspends the ticks, reports once, and probes at most once in the probe interval of the SERVER clock', async () => {
    const { scheduler, timer, clock, ticks, probes, events } = harness();
    scheduler.start();
    timer.fire();
    ticks[0]?.reject(Object.assign(new Error('not committed'), { code: 'COMMIT_FAILED' }));
    await settle();
    expect(events).toEqual(['suspended:COMMIT_FAILED']);
    expect(scheduler.stats()).toMatchObject({ suspended: true, ticksFailed: 1 });

    // 950 ms of timer calls: no tick and no probe, however often the timer fires.
    for (let step = 0; step < 19; step += 1) {
      clock.advance(50);
      timer.fire();
    }
    expect(ticks).toHaveLength(1);
    expect(probes).toHaveLength(0);

    // The interval has passed: one probe. While it is in flight nothing else is submitted.
    clock.advance(50);
    timer.fire();
    timer.fire();
    expect(probes).toHaveLength(1);
    expect(scheduler.stats()).toMatchObject({ probes: 1 });

    // The probe fails: still suspended, the next one a whole interval later.
    probes[0]?.reject(new Error('still down'));
    await settle();
    clock.advance(500);
    timer.fire();
    expect(probes).toHaveLength(1);
    clock.advance(500);
    timer.fire();
    expect(probes).toHaveLength(2);
    expect(events).toEqual(['suspended:COMMIT_FAILED']);

    // The probe commits: ticks resume at the next timer call.
    probes[1]?.resolve();
    await settle();
    expect(events).toEqual(['suspended:COMMIT_FAILED', 'resumed']);
    expect(scheduler.stats()).toMatchObject({ suspended: false, probes: 2 });
    timer.fire();
    expect(ticks).toHaveLength(2);
  });

  it('a write of the engine that commits meanwhile resumes the ticks at once', async () => {
    const { scheduler, timer, ticks, probes, events } = harness();
    scheduler.start();
    timer.fire();
    ticks[0]?.reject(new Error('not committed'));
    await settle();
    expect(scheduler.stats().suspended).toBe(true);

    scheduler.resume();
    scheduler.resume();
    expect(events.filter((event) => event === 'resumed')).toHaveLength(1);
    timer.fire();
    expect(ticks).toHaveLength(2);
    expect(probes).toHaveLength(0);
  });

  it('a second failure while suspended is not reported again', async () => {
    const { scheduler, timer, clock, ticks, probes, events } = harness();
    scheduler.start();
    timer.fire();
    ticks[0]?.reject(new Error('one'));
    await settle();
    clock.advance(1_000);
    timer.fire();
    probes[0]?.reject(new Error('two'));
    await settle();
    expect(events).toHaveLength(1);
    expect(scheduler.stats()).toMatchObject({ ticksFailed: 1, probes: 1, suspended: true });
  });
});

describe('stop', () => {
  it('cancels the timer: no repeating call is left, a late timer call submits nothing, and what is in flight ends by itself', async () => {
    const { scheduler, timer, ticks } = harness();
    scheduler.start();
    timer.fire();
    scheduler.stop();
    scheduler.stop();
    expect(timer.active()).toBe(0);
    expect(scheduler.stats().running).toBe(false);
    scheduler.fire();
    expect(ticks).toHaveLength(1);

    const waiting = scheduler.idle();
    ticks[0]?.resolve();
    await waiting;

    scheduler.start();
    expect(timer.active()).toBe(1);
    timer.fire();
    expect(ticks).toHaveLength(2);
  });
});
