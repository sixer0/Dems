/**
 * The clock of the fake transport (HB-11). The fake starts no timer of its own and reads no real
 * time: every instant it writes (the time of a log entry, `serverTime` of a message it builds) and
 * every delay it keeps (a delayed answer, the heartbeat series) comes from the clock it is given.
 *
 * Two clocks:
 * - `createFakeClock(start)`: a manual clock. Time moves only when the test calls `advance`. Its
 *   `timers` are timer functions on that clock, for a client that takes its timers by injection.
 * - `clockFromTimers(timers)`: a clock on timer functions the test passes in. A test that runs
 *   under the fake timers of its runner passes the runner-controlled functions, so one call of the
 *   runner (advance by 1,000 ms) moves the client's timers and the fake's delays together.
 */
import { OPENAPI_EXAMPLE_INSTANT } from '../../api/examples';
import { FakeTransportUsageError } from './errors';

export interface FakeClock {
  /** Epoch milliseconds. */
  now(): number;
  /** Runs `task` once, when the clock has moved on by `delayMs`. Returns the cancel function. */
  schedule(delayMs: number, task: () => void): () => void;
}

/** Timer functions on a clock, of the shape a client takes by injection. A handle is opaque. */
export interface FakeTimers {
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
  readonly setInterval: (callback: () => void, intervalMs: number) => unknown;
  readonly clearInterval: (handle: unknown) => void;
}

export interface ManualFakeClock extends FakeClock {
  /** Moves the clock on by `ms` and runs every task that falls due, in time order. */
  advance(ms: number): void;
  /** Tasks that are scheduled and have not run. */
  readonly pendingTasks: number;
  /**
   * Timer functions that run on this clock. A client that takes its timers by injection (the live
   * socket client's `timers`) gets these, so one `advance` moves the client and the fake together.
   */
  readonly timers: FakeTimers;
}

/** The instant of the contract's examples, 2026-10-01 10:00:00 WIB: where a manual clock starts by default. */
export const FAKE_CLOCK_START_MS = Date.parse(OPENAPI_EXAMPLE_INSTANT);

interface Task {
  readonly at: number;
  readonly order: number;
  readonly run: () => void;
}

export function createFakeClock(startMs: number = FAKE_CLOCK_START_MS): ManualFakeClock {
  if (!Number.isFinite(startMs)) throw new FakeTransportUsageError('the clock needs a finite start instant');
  let current = startMs;
  let order = 0;
  const tasks: Task[] = [];

  function nextDue(until: number): Task | undefined {
    let found: Task | undefined;
    for (const task of tasks) {
      if (task.at > until) continue;
      if (!found || task.at < found.at || (task.at === found.at && task.order < found.order)) found = task;
    }
    return found;
  }

  function schedule(delayMs: number, task: () => void): () => void {
    const entry: Task = { at: current + Math.max(0, Number.isFinite(delayMs) ? delayMs : 0), order, run: task };
    order += 1;
    tasks.push(entry);
    return () => {
      const index = tasks.indexOf(entry);
      if (index >= 0) tasks.splice(index, 1);
    };
  }

  const cancel = (handle: unknown): void => {
    if (typeof handle === 'function') (handle as () => void)();
  };
  const timers: FakeTimers = {
    setTimeout: (callback, delayMs) => schedule(delayMs, callback),
    clearTimeout: cancel,
    setInterval: (callback, intervalMs) => {
      // An interval of 0 would never let `advance` end; a platform timer clamps it too.
      const every = Math.max(1, Number.isFinite(intervalMs) ? intervalMs : 1);
      let stop: () => void = () => undefined;
      let stopped = false;
      const run = (): void => {
        if (stopped) return;
        stop = schedule(every, run);
        callback();
      };
      stop = schedule(every, run);
      return () => {
        stopped = true;
        stop();
      };
    },
    clearInterval: cancel,
  };

  return {
    now: () => current,
    schedule,
    timers,
    advance(ms) {
      if (!(ms >= 0) || !Number.isFinite(ms)) throw new FakeTransportUsageError('the clock advances by a finite number of milliseconds, 0 or more');
      const target = current + ms;
      for (let due = nextDue(target); due; due = nextDue(target)) {
        tasks.splice(tasks.indexOf(due), 1);
        // A task sees the instant it was due at, and may schedule a later one inside the same advance.
        if (due.at > current) current = due.at;
        due.run();
      }
      current = target;
    },
    get pendingTasks() {
      return tasks.length;
    },
  };
}

export interface InjectedTimers<Handle> {
  /** Epoch milliseconds. Under a runner's fake timers, the runner-controlled clock. */
  readonly now: () => number;
  readonly setTimeout: (task: () => void, delayMs: number) => Handle;
  readonly clearTimeout: (handle: Handle) => void;
}

/**
 * A clock on timer functions the caller passes in. The fake calls nothing else.
 *
 * ```ts
 * const clock = clockFromTimers({
 *   now: () => Date.now(),
 *   setTimeout: (task, ms) => setTimeout(task, ms),
 *   clearTimeout: (handle) => clearTimeout(handle),
 * });
 * ```
 */
export function clockFromTimers<Handle>(timers: InjectedTimers<Handle>): FakeClock {
  return {
    now: () => timers.now(),
    schedule(delayMs, task) {
      let done = false;
      const handle = timers.setTimeout(() => {
        done = true;
        task();
      }, Math.max(0, delayMs));
      return () => {
        if (!done) timers.clearTimeout(handle);
        done = true;
      };
    },
  };
}
