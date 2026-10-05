/**
 * The timer of the expiry sweep (plan row W24; spec §5.1 ID-P8; SR-11; RT-P13).
 *
 * It only says WHEN a sweep runs: every 5 s of real time while the server listens. WHAT is
 * expired is decided by the sweep itself, on the server clock (`sessions.ts`), so a test moves
 * the clock and calls the sweep; it never waits for this timer. The timer is not started by the
 * app factory: an app that does not listen (every in-process test) has no sweeper running.
 *
 * One sweep at a time: a tick that finds the previous sweep still running does nothing. The
 * timer does not keep the process alive.
 */
export interface Sweeper {
  /** Starts the timer. A second call does nothing. */
  start(): void;
  /** Stops the timer. A sweep that is running ends by itself. */
  stop(): void;
  readonly running: boolean;
}

export interface SweeperOptions {
  readonly intervalMs: number;
  sweep(): Promise<unknown>;
  /** Called with what a sweep threw. It must not throw. */
  onError(error: unknown): void;
}

export function createSweeper(options: SweeperOptions): Sweeper {
  let timer: ReturnType<typeof setInterval> | null = null;
  let sweeping = false;

  function tick(): void {
    if (sweeping) return;
    sweeping = true;
    Promise.resolve()
      .then(() => options.sweep())
      .catch((error: unknown) => options.onError(error))
      .finally(() => {
        sweeping = false;
      });
  }

  return {
    start() {
      if (timer !== null) return;
      timer = setInterval(tick, options.intervalMs);
      timer.unref();
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
    get running() {
      return timer !== null;
    },
  };
}
