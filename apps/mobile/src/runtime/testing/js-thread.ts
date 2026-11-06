/**
 * Test-only model of a React Native JS thread for the timer rules of closing-fix row CF-M1 (R-P-2, R-S-2):
 * timer callbacks and socket messages are tasks that run one after the other in the order they were
 * queued, and a stall lets time pass while nothing runs. Never import it from app code.
 */
import type { LiveSocketLike, LiveSocketTimers, SocketLike } from '@dems/shared/realtime';

interface Task {
  readonly at: number;
  readonly seq: number;
  readonly run: () => void;
  cancelled: boolean;
}

/**
 * The JS thread of a React Native app, reduced to what matters here: timer callbacks and socket
 * messages are tasks that run one after the other in the order they were queued. `idle(ms)` lets time
 * pass with the thread free (each task runs at its time); `stall(ms)` lets time pass with the thread held
 * (nothing runs; whatever falls due or arrives meanwhile waits), and the queue then drains in order with
 * the clock at the end of the stall.
 */
export class JsThread {
  now = 1_791_270_000_000;
  private seq = 0;
  private tasks: Task[] = [];

  queue(at: number, run: () => void): Task {
    const task: Task = { at, seq: this.seq++, run, cancelled: false };
    this.tasks.push(task);
    return task;
  }

  readonly timers: LiveSocketTimers = {
    setTimeout: (callback, delayMs) => this.queue(this.now + Math.max(0, delayMs), callback),
    clearTimeout: (handle) => {
      (handle as Task).cancelled = true;
    },
    setInterval: (callback, intervalMs) => {
      const every = Math.max(1, intervalMs);
      const box = { task: null as Task | null, stopped: false };
      const tick = (): void => {
        if (box.stopped) return;
        box.task = this.queue(this.now + every, tick);
        callback();
      };
      box.task = this.queue(this.now + every, tick);
      return box;
    },
    clearInterval: (handle) => {
      const box = handle as { task: Task | null; stopped: boolean };
      box.stopped = true;
      if (box.task) box.task.cancelled = true;
    },
  };

  private next(until: number): Task | undefined {
    let found: Task | undefined;
    for (const task of this.tasks) {
      if (task.cancelled || task.at > until) continue;
      if (!found || task.at < found.at || (task.at === found.at && task.seq < found.seq)) found = task;
    }
    return found;
  }

  private take(task: Task): void {
    this.tasks.splice(this.tasks.indexOf(task), 1);
  }

  /** Time passes with the thread free: every task runs at its own time. */
  idle(ms: number): void {
    const end = this.now + ms;
    for (let task = this.next(end); task; task = this.next(end)) {
      this.take(task);
      if (task.at > this.now) this.now = task.at;
      task.run();
    }
    this.now = end;
  }

  /**
   * Time passes with the thread STARVED (closing-fix row CF2-A, RF-PH-1): it never stops, but every task
   * runs `lateBy` ms after its due time, one after the other in due order, as on the loaded emulator where
   * each timer callback of the Live source fired hundreds of milliseconds late for many seconds in a row.
   */
  starve(ms: number, lateBy: number): void {
    const end = this.now + ms;
    for (let task = this.next(end - lateBy); task; task = this.next(end - lateBy)) {
      this.take(task);
      this.now = Math.max(this.now, task.at + lateBy);
      task.run();
    }
    this.now = end;
  }

  /**
   * Time passes with the thread held. `arrivals` are socket messages that reach the app during the stall
   * (offset from its start). Then the queue drains in arrival order, every task seeing the clock at the
   * end of the stall (it runs late), and anything it queues for "now" runs after what was already queued.
   */
  stall(ms: number, arrivals: { readonly after: number; readonly deliver: () => void }[] = []): void {
    const start = this.now;
    for (const arrival of arrivals) this.queue(start + arrival.after, arrival.deliver);
    this.now = start + ms;
    const pending = this.tasks.filter((task) => !task.cancelled && task.at <= this.now).sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (const task of pending) {
      if (task.cancelled || !this.tasks.includes(task)) continue;
      this.take(task);
      task.run();
    }
  }
}

export class FakeSocket implements LiveSocketLike {
  readyState = 1;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  closed = false;
  send(): void {}
  close(): void {
    this.closed = true;
  }
  deliver(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

