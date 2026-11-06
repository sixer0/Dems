// The timer of the expiry sweeps, now in the core (review finding W91-11; moved unchanged from
// `modules/identity/sweeper.ts`, plan row W24). Fake timers: no test waits for real time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSweeper } from '../index';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createSweeper (core; W91-11)', () => {
  it('runs a sweep every interval once started, and none after stop; a second start does nothing', async () => {
    const sweep = vi.fn(async () => undefined);
    const sweeper = createSweeper({ intervalMs: 5_000, sweep, onError: () => undefined });
    expect(sweeper.running).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sweep).not.toHaveBeenCalled();
    sweeper.start();
    sweeper.start();
    expect(sweeper.running).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sweep).toHaveBeenCalledTimes(2);
    sweeper.stop();
    expect(sweeper.running).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it('one sweep at a time: a tick that finds the previous sweep running does nothing', async () => {
    let release: () => void = () => undefined;
    const sweep = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const sweeper = createSweeper({ intervalMs: 1_000, sweep, onError: () => undefined });
    sweeper.start();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sweep).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sweep).toHaveBeenCalledTimes(2);
    sweeper.stop();
  });

  it('what a sweep throws goes to onError, and the next tick sweeps again', async () => {
    const failure = new Error('sweep failed');
    const errors: unknown[] = [];
    const sweep = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const sweeper = createSweeper({ intervalMs: 1_000, sweep, onError: (error) => errors.push(error) });
    sweeper.start();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(errors).toEqual([failure]);
    expect(sweep).toHaveBeenCalledTimes(2);
    sweeper.stop();
  });

  it('the identity module\'s old path is the same function (one home)', async () => {
    const identityPath = await import('../../modules/identity/sweeper');
    expect(identityPath.createSweeper).toBe(createSweeper);
  });
});
