// The timer of the expiry sweep (plan row W24; spec §5.1 ID-P8). Fake timers: no test waits.
// What a sweep ends is proven against PostgreSQL in `sessions.db.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../app';
import { createFakePool, unitTestConfig } from '../../../../test/support/config';
import { identityControl } from '../index';
import { SESSION_SWEEP_INTERVAL_MS } from '../limits';
import { createSweeper } from '../sweeper';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the sweeper', () => {
  it('runs a sweep every 5 s once it is started, and none before', async () => {
    expect(SESSION_SWEEP_INTERVAL_MS).toBe(5_000);
    const sweep = vi.fn(async () => []);
    const sweeper = createSweeper({ intervalMs: SESSION_SWEEP_INTERVAL_MS, sweep, onError: () => {} });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sweep).not.toHaveBeenCalled();
    expect(sweeper.running).toBe(false);

    sweeper.start();
    sweeper.start();
    expect(sweeper.running).toBe(true);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(sweep).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(sweep).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15_000);
    // One timer, although it was started twice.
    expect(sweep).toHaveBeenCalledTimes(4);

    sweeper.stop();
    sweeper.stop();
    expect(sweeper.running).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sweep).toHaveBeenCalledTimes(4);
  });

  it('never runs two sweeps at once: a tick that finds one running does nothing', async () => {
    let release: () => void = () => {};
    const sweep = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const sweeper = createSweeper({ intervalMs: 5_000, sweep, onError: () => {} });
    sweeper.start();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sweep).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sweep).toHaveBeenCalledTimes(2);
    sweeper.stop();
  });

  it('a sweep that fails is reported and the next tick tries again', async () => {
    const errors: unknown[] = [];
    const failure = new Error('the database does not answer');
    const sweep = vi.fn<() => Promise<unknown>>().mockRejectedValueOnce(failure).mockImplementationOnce(() => {
      throw failure;
    });
    sweep.mockResolvedValue([]);
    const sweeper = createSweeper({ intervalMs: 5_000, sweep, onError: (error) => void errors.push(error) });
    sweeper.start();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(sweep).toHaveBeenCalledTimes(3);
    expect(errors).toEqual([failure, failure]);
    sweeper.stop();
  });
});

describe('the sweeper of an app', () => {
  it('is not started by the app factory: an app that does not listen has no timer', async () => {
    const app = buildApp({ config: unitTestConfig(), createPool: () => createFakePool().pool });
    await app.ready();
    const control = identityControl(app);
    expect(control.sweeper.running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    // Started and stopped by hand here; a listening server does it in `onListen` and `preClose`.
    control.sweeper.start();
    expect(vi.getTimerCount()).toBe(1);
    await app.close();
    expect(control.sweeper.running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
