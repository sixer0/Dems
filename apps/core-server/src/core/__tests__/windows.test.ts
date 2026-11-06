// Fixed windows by the server clock (plan row W23; spec ID-P12, ID-P13; ENG-13, ENG-16). The helper
// moved from `plugins/throttle` to the core (review finding CPB1-16, decision D78 DN-11); these
// are its tests, unchanged, moved with it from `plugins/throttle/__tests__/windows-limits.test.ts`.
import { describe, expect, it } from 'vitest';
import { counterName, createFixedWindows, retryAfterSeconds } from '../windows';

describe('fixed windows by the server clock', () => {
  const T0 = 1_000_000;

  it('a window opens at the first event of its key and ends its length later', () => {
    const windows = createFixedWindows(60_000);
    expect(windows.lengthMs).toBe(60_000);
    expect(windows.current('k', T0)).toBeNull();
    const opened = windows.open('k', T0);
    expect(opened).toMatchObject({ startedAt: T0, endsAt: T0 + 60_000, announced: false });
    // Later events of the key are in the same window, whenever they come inside it.
    expect(windows.open('k', T0 + 1)).toBe(opened);
    expect(windows.open('k', T0 + 59_999)).toBe(opened);
    expect(windows.current('k', T0 + 59_999)).toBe(opened);
  });

  it('the first instant after the length belongs to a new window, which starts then', () => {
    const windows = createFixedWindows(60_000);
    const first = windows.open('k', T0);
    expect(windows.current('k', T0 + 60_000)).toBeNull();
    const second = windows.open('k', T0 + 60_000);
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({ startedAt: T0 + 60_000, endsAt: T0 + 120_000 });
  });

  it('each key has its own window, and every window its own ID', () => {
    const windows = createFixedWindows(60_000);
    const a = windows.open('a', T0);
    const b = windows.open('b', T0 + 30_000);
    expect(a.id).not.toBe(b.id);
    expect(windows.current('a', T0 + 60_000)).toBeNull();
    expect(windows.current('b', T0 + 60_000)).toBe(b);
  });

  it('forget closes one key or all; the next event opens a new window even at the same instant', () => {
    const windows = createFixedWindows(60_000);
    const a = windows.open('a', T0);
    const b = windows.open('b', T0);
    windows.forget('a');
    expect(windows.current('a', T0)).toBeNull();
    expect(windows.current('b', T0)).toBe(b);
    const again = windows.open('a', T0);
    expect(again.id).not.toBe(a.id);
    expect(counterName('a', again)).not.toBe(counterName('a', a));
    windows.forget();
    expect(windows.current('a', T0)).toBeNull();
    expect(windows.current('b', T0)).toBeNull();
  });

  it('a clock that reads earlier than the window started was replaced: the window is over', () => {
    const windows = createFixedWindows(60_000);
    const opened = windows.open('k', T0);
    expect(windows.current('k', T0 - 1)).toBeNull();
    expect(windows.open('k', T0 - 1).id).not.toBe(opened.id);
  });

  it('a counter name is the key and the window; no two windows share one', () => {
    const windows = createFixedWindows(60_000);
    const names = new Set<string>();
    for (const key of ['operator:OP-1', 'operator:OP-1#1', 'device:DEV-1', 'class:web', 'class:local']) {
      for (const at of [T0, T0 + 60_000, T0 + 120_000]) names.add(counterName(key, windows.open(key, at)));
    }
    expect(names.size).toBe(15);
    expect(counterName('class:web', { id: 7, startedAt: 0, endsAt: 1, announced: false })).toBe('class:web#7');
  });

  it('retry-after is the whole seconds until the window ends, never less than 1', () => {
    const window = createFixedWindows(60_000).open('k', T0);
    expect(retryAfterSeconds(window, T0)).toBe(60);
    expect(retryAfterSeconds(window, T0 + 1)).toBe(60);
    expect(retryAfterSeconds(window, T0 + 1_000)).toBe(59);
    expect(retryAfterSeconds(window, T0 + 59_001)).toBe(1);
    expect(retryAfterSeconds(window, T0 + 59_999)).toBe(1);
    expect(retryAfterSeconds(window, T0 + 60_000)).toBe(1);
  });
});
