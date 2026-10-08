// Closing-fix row CF2-A, defect RF-PH-1: the LIVE ticker of the monitor timer (`createElapsedTicker`).
// On the phone a 1 Hz tick that the busy JS thread ran late kept the old second up to a further second, and
// the state update then waited 0.4-0.75 s in React's queue. The ticker re-reads the Core clock every 250 ms
// and is an external store (React renders its change at once); it never steps back and stops when unused.
import { describe, expect, it } from '@jest/globals';
import { runtimeLog } from '@/runtime/log';
import type { CoreClock } from '@/runtime';
import { ELAPSED_TICK_MS, createElapsedTicker } from './use-monitor';

function fakeClock(start: number) {
  let now = start;
  /** What the Core clock reads on top of the timers' clock (a jump forward, or a read that went back). */
  let shift = 0;
  let tasks: { at: number; run: () => void; id: number }[] = [];
  let id = 0;
  const clock: CoreClock = {
    now: () => now + shift,
    sample: () => undefined,
    timers: {
      setTimeout: (run, ms) => {
        id += 1;
        tasks.push({ at: now + ms, run, id });
        return id;
      },
      clearTimeout: (handle) => {
        tasks = tasks.filter((t) => t.id !== handle);
      },
    },
  };
  /** Time passes; each due task runs `lateBy` ms after its due time. */
  const advance = (ms: number, lateBy = 0): void => {
    const end = now + ms;
    for (;;) {
      const due = tasks.filter((t) => t.at + lateBy <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      tasks = tasks.filter((t) => t !== due);
      now = Math.max(now, due.at + lateBy);
      due.run();
    }
    now = end;
  };
  return { clock, advance, pending: () => tasks.length, setShift: (ms: number) => (shift = ms) };
}

describe('createElapsedTicker', () => {
  it('a subscriber hears each new second; with every tick 700 ms late it is still within a second of the clock', () => {
    const start = 1_000_000;
    const f = fakeClock(start);
    const ticker = createElapsedTicker(f.clock, start, 'SES-1');
    const heard: number[] = [];
    const off = ticker.subscribe(() => heard.push(ticker.getSnapshot()));
    f.advance(5_000);
    expect(ticker.getSnapshot()).toBe(5);
    expect(heard).toEqual([1, 2, 3, 4, 5]);
    for (let i = 0; i < 20; i += 1) {
      f.advance(500, 700);
      expect(Math.floor((f.clock.now() - start) / 1000) - ticker.getSnapshot()).toBeLessThanOrEqual(1);
    }
    off();
  });

  it(`a Core clock that jumps forward right after a tick is drawn within ${ELAPSED_TICK_MS} ms (not at the next whole second)`, () => {
    const start = 3_000_000;
    const f = fakeClock(start);
    const ticker = createElapsedTicker(f.clock, start, 'SES-2');
    const off = ticker.subscribe(() => undefined);
    f.advance(1_030); // the tick of second 1 has just run
    expect(ticker.getSnapshot()).toBe(1);
    f.setShift(2_500); // a better sample lifts the Core clock by 2.5 s
    f.advance(ELAPSED_TICK_MS + 10);
    expect(ticker.getSnapshot()).toBe(3);
    off();
  });

  it('never steps back when the clock reads earlier, and stops its timer when the last subscriber leaves', () => {
    const start = 2_000_000;
    const f = fakeClock(start);
    const ticker = createElapsedTicker(f.clock, start, null);
    const off = ticker.subscribe(() => undefined);
    f.advance(3_100);
    expect(ticker.getSnapshot()).toBe(3);
    f.setShift(-2_000); // the clock now reads 1.x s
    f.advance(600);
    expect(ticker.getSnapshot()).toBe(3);
    off();
    expect(f.pending()).toBe(0);
  });

  // RC-1 (D255), the `freeze()` member added by row 22, the direct unit contract per row-26 review finding
  // F3. Since ruling D19(b) (RV-CODE) the hook retires a session's ticker with it once the Core reports the
  // stop (the drawn value is then the Core's recorded duration; `live-rc1-elapsed-stop-hold.test.tsx`), and
  // a frozen ticker is never handed out again (`isFrozen`, audit AU1-6).
  it('RC-1: freeze() stops the advancement at the last drawn second and drops the armed timer', () => {
    const start = 5_000_000;
    const f = fakeClock(start);
    const ticker = createElapsedTicker(f.clock, start, 'SES-F1');
    const heard: number[] = [];
    const off = ticker.subscribe(() => heard.push(ticker.getSnapshot()));
    f.advance(3_000);
    expect(ticker.getSnapshot()).toBe(3);
    const before = heard.length;
    expect(ticker.isFrozen()).toBe(false);
    ticker.freeze(); // the Core reported the stop: retire the ticker at the last second it drew
    expect(ticker.isFrozen()).toBe(true);
    expect(f.pending()).toBe(0); // the armed timer is dropped AT the freeze, not at the next tick
    f.advance(6_000);
    expect(ticker.getSnapshot()).toBe(3); // frozen: no clock read, no growth past the stop
    expect(heard.length).toBe(before); // and no subscriber is ever notified again
    off();
  });

  it('RC-1: freeze() is idempotent, and a subscribe after a freeze keeps drawing the frozen second', () => {
    const start = 6_000_000;
    const f = fakeClock(start);
    const ticker = createElapsedTicker(f.clock, start, 'SES-F2');
    const off = ticker.subscribe(() => undefined);
    f.advance(4_000);
    expect(ticker.getSnapshot()).toBe(4);
    off(); // every subscriber left: the timer is dropped (the stopped flag is not yet set)
    ticker.freeze();
    ticker.freeze(); // idempotent: the second freeze is a no-op, it must not throw
    expect(f.pending()).toBe(0);
    const heard: number[] = [];
    const off2 = ticker.subscribe(() => heard.push(ticker.getSnapshot()));
    expect(ticker.getSnapshot()).toBe(4); // subscribe after freeze returns the frozen value
    f.advance(5_000);
    expect(ticker.getSnapshot()).toBe(4); // a frozen ticker never re-arms: neither via subscribe nor tick
    expect(heard).toEqual([]);
    expect(f.pending()).toBe(0);
    off2();
  });

  it('W93-12 (FXR-M): a tick that throws once is logged and the ticker keeps running (it used to stop for the session)', () => {
    const start = 4_000_000;
    const f = fakeClock(start);
    const realNow = f.clock.now;
    let throwOnce = false;
    const clock: CoreClock = {
      ...f.clock,
      now: () => {
        if (throwOnce) {
          throwOnce = false;
          throw new Error('clock read failed (test)');
        }
        return realNow();
      },
    };
    const ticker = createElapsedTicker(clock, start, 'SES-12');
    const off = ticker.subscribe(() => undefined);
    f.advance(2_100);
    expect(ticker.getSnapshot()).toBe(2);
    const before = runtimeLog.records().filter((r) => r.source === 'sessionLive.elapsedTick').length;
    throwOnce = true;
    f.advance(4_000);
    expect(runtimeLog.records().filter((r) => r.source === 'sessionLive.elapsedTick').length).toBe(before + 1);
    expect(ticker.getSnapshot()).toBe(6);
    expect(f.pending()).toBe(1);
    off();
    expect(f.pending()).toBe(0);
  });
});
