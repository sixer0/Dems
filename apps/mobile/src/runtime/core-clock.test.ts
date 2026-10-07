// Closing-fix row CF2-A, defect RF-PH-1 (= RF-T-3): the Core clock a running display re-reads.
import { describe, expect, it } from '@jest/globals';
import { CORE_CLOCK_WINDOW_MS, coreClockOf, createCoreClock, registerCoreClock } from './core-clock';

const timers = { setTimeout: () => null, clearTimeout: () => undefined };

/** A Live clock like `@dems/shared/live` `clock.ts`: local + newest offset, never backwards. */
function liveClock(local: () => number) {
  let offset = 0;
  let last = Number.NEGATIVE_INFINITY;
  return {
    now: () => {
      const value = local() + offset;
      if (value > last) last = value;
      return last;
    },
    sample: (serverTime: number, receivedAt: number) => {
      offset = serverTime - receivedAt;
    },
  };
}

describe('createCoreClock', () => {
  it('a heartbeat handled 8 s late makes the Live clock hold; the Core clock runs on with the local clock', () => {
    let local = 1_000_000;
    const server = () => local + 500; // the true offset
    const live = liveClock(() => local);
    const clock = createCoreClock(live.now, () => local, timers);
    live.sample(server(), local);
    expect(clock.now()).toBe(server());
    // From here every sample was taken in 8 s late.
    for (let i = 0; i < 6; i += 1) {
      local += 1_000;
      live.sample(server() - 8_000, local);
      expect(live.now()).toBeLessThanOrEqual(server() - 1_000); // held
      expect(clock.now()).toBe(server());
    }
  });

  it('never runs ahead of the Core: a late sample can only lower the estimate, the best one wins', () => {
    let local = 5_000;
    const live = liveClock(() => local);
    const clock = createCoreClock(live.now, () => local, timers);
    live.sample(local + 300, local);
    clock.sample();
    live.sample(local + 200, local);
    expect(clock.now()).toBe(local + 300);
    live.sample(local + 900, local); // a better (less delayed) sample
    expect(clock.now()).toBe(local + 900);
  });

  it('a real change of the server clock gets in within two windows', () => {
    let local = 0;
    const live = liveClock(() => local);
    const clock = createCoreClock(live.now, () => local, timers, CORE_CLOCK_WINDOW_MS);
    live.sample(local + 5_000, local);
    clock.sample();
    live.sample(local + 1_000, local); // the server clock really went back 4 s
    for (let t = 0; t <= 2 * CORE_CLOCK_WINDOW_MS + 1_000; t += 1_000) {
      local += 1_000;
      clock.sample();
    }
    // The Live clock's own hold is over by now, and the old offset has left the window.
    expect(clock.now() - local).toBe(1_000);
  });

  it('is found by the Sim it was registered for; a simulator has none', () => {
    const sim = {};
    const clock = createCoreClock(() => 1, () => 1, timers);
    registerCoreClock(sim, clock);
    expect(coreClockOf(sim)).toBe(clock);
    expect(coreClockOf({})).toBeNull();
    expect(coreClockOf(null)).toBeNull();
  });
});
