// The sign-in lockout of a console (plan row W24; spec §5.1 ID-P1 to ID-P3, §5.2 ID-5, §8.2
// ENG-24; SR-22, SR-25, SR-72). Pure: the time is a number the test passes in, so no test waits.
import { describe, expect, it } from 'vitest';
import { LOCKOUT_DURATION_MS, LOCKOUT_MAX_ATTEMPTS, LOCKOUT_WINDOW_MS } from '../limits';
import { createConsoleLockout, type AttemptTicket, type ConsoleLockout, type LockRefusal } from '../lockout';

const T0 = Date.UTC(2031, 0, 1);
const WEB = 'web';

async function takeTicket(lockout: ConsoleLockout, key: string, now: number): Promise<AttemptTicket> {
  const taken = await lockout.take(key, now);
  if (taken.kind !== 'TAKEN') throw new Error('the console is locked');
  return taken;
}

async function takeRefusal(lockout: ConsoleLockout, key: string, now: number): Promise<LockRefusal> {
  const taken = await lockout.take(key, now);
  if (taken.kind !== 'LOCKED') throw new Error('the attempt was taken');
  return taken;
}

describe('the numbers (ID-P1, ID-P2)', () => {
  it('are 5 attempts within 300 s and a lock of 60 s, as in the shared simulator', () => {
    expect([LOCKOUT_MAX_ATTEMPTS, LOCKOUT_WINDOW_MS, LOCKOUT_DURATION_MS]).toEqual([5, 300_000, 60_000]);
  });
});

describe('one attempt after the other', () => {
  it('four failures leave 4, 3, 2, 1; the fifth locks for 60 s from the moment it was taken', async () => {
    const lockout = createConsoleLockout();
    const outcomes = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = T0 + attempt * 1_000;
      outcomes.push(await lockout.fail(WEB, await takeTicket(lockout, WEB, now), now));
    }
    const lockedUntil = T0 + 4_000 + 60_000;
    expect(outcomes).toEqual([
      { attemptsRemaining: 4, lockedUntil: null, retryInMs: 0 },
      { attemptsRemaining: 3, lockedUntil: null, retryInMs: 0 },
      { attemptsRemaining: 2, lockedUntil: null, retryInMs: 0 },
      { attemptsRemaining: 1, lockedUntil: null, retryInMs: 0 },
      { attemptsRemaining: 0, lockedUntil, retryInMs: 60_000 },
    ]);
    expect(await lockout.status(WEB, T0 + 5_000)).toEqual({ locked: true, lockedUntil, retryInMs: 59_000, attemptsRemaining: 0 });
    expect(await lockout.take(WEB, T0 + 5_000)).toEqual({ kind: 'LOCKED', lockedUntil, retryInMs: 59_000 });
  });

  it('during the lock nothing is taken; at its end the count is fresh', async () => {
    const lockout = createConsoleLockout();
    for (let attempt = 0; attempt < 5; attempt += 1) await lockout.fail(WEB, await takeTicket(lockout, WEB, T0), T0);
    const lockedUntil = T0 + 60_000;
    for (let refused = 0; refused < 50; refused += 1) expect((await takeRefusal(lockout, WEB, T0 + refused)).lockedUntil).toBe(lockedUntil);
    expect((await takeRefusal(lockout, WEB, lockedUntil - 1)).retryInMs).toBe(1);

    expect(await lockout.status(WEB, lockedUntil)).toEqual({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5 });
    const ticket = await takeTicket(lockout, WEB, lockedUntil);
    expect(await lockout.fail(WEB, ticket, lockedUntil)).toEqual({ attemptsRemaining: 4, lockedUntil: null, retryInMs: 0 });
  });

  it('a success clears the count, also the success of the fifth attempt, which lifts the lock it set', async () => {
    const lockout = createConsoleLockout();
    for (let attempt = 0; attempt < 4; attempt += 1) await lockout.fail(WEB, await takeTicket(lockout, WEB, T0), T0);
    expect((await lockout.status(WEB, T0)).attemptsRemaining).toBe(1);

    await takeTicket(lockout, WEB, T0);
    // The limit is reached by taking: whoever comes now is refused, although nothing failed yet.
    expect(await lockout.status(WEB, T0)).toMatchObject({ locked: true, lockedUntil: T0 + 60_000 });
    expect((await lockout.take(WEB, T0)).kind).toBe('LOCKED');

    lockout.succeed(WEB);
    expect(await lockout.status(WEB, T0)).toEqual({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5 });
    expect((await lockout.fail(WEB, await takeTicket(lockout, WEB, T0), T0)).attemptsRemaining).toBe(4);
  });

  it('the window is 300 s from the first counted attempt: one millisecond before its end the count stands, at its end it is fresh', async () => {
    const lockout = createConsoleLockout();
    await lockout.fail(WEB, await takeTicket(lockout, WEB, T0), T0);
    for (let attempt = 0; attempt < 3; attempt += 1) await lockout.fail(WEB, await takeTicket(lockout, WEB, T0 + 200_000), T0 + 200_000);
    expect((await lockout.status(WEB, T0 + 299_999)).attemptsRemaining).toBe(1);
    expect((await lockout.status(WEB, T0 + 300_000)).attemptsRemaining).toBe(5);
    const fresh = await lockout.fail(WEB, await takeTicket(lockout, WEB, T0 + 300_000), T0 + 300_000);
    expect(fresh).toEqual({ attemptsRemaining: 4, lockedUntil: null, retryInMs: 0 });
  });

  it('each console has its own count and its own lock (ID-P3)', async () => {
    const lockout = createConsoleLockout();
    for (let attempt = 0; attempt < 5; attempt += 1) await lockout.fail('DEV-0001', await takeTicket(lockout, 'DEV-0001', T0), T0);
    expect((await lockout.status('DEV-0001', T0)).locked).toBe(true);
    expect(await lockout.status(WEB, T0)).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect(await lockout.status('DEV-0002', T0)).toMatchObject({ locked: false, attemptsRemaining: 5 });
    expect((await lockout.take(WEB, T0)).kind).toBe('TAKEN');
  });

  it('status takes nothing', async () => {
    const lockout = createConsoleLockout();
    for (let asked = 0; asked < 100; asked += 1) await lockout.status(WEB, T0);
    expect(await lockout.status(WEB, T0)).toMatchObject({ locked: false, attemptsRemaining: 5 });
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await lockout.take(WEB, T0)).kind).toBe('TAKEN');
  });
});

describe('attempts that arrive together (ENG-24: an attempt is taken before it is verified)', () => {
  it('of 20 at once, five are taken and 15 are refused with one lock; the failures then count 4, 3, 2, 1, 0 in any order', async () => {
    const lockout = createConsoleLockout();
    const taken = await Promise.all(Array.from({ length: 20 }, () => lockout.take(WEB, T0)));
    const tickets = taken.filter((entry): entry is AttemptTicket => entry.kind === 'TAKEN');
    const refusals = taken.filter((entry): entry is LockRefusal => entry.kind === 'LOCKED');
    expect([tickets.length, refusals.length]).toEqual([5, 15]);
    expect(taken.slice(0, 5).every((entry) => entry.kind === 'TAKEN')).toBe(true);
    expect(new Set(refusals.map((refusal) => refusal.lockedUntil))).toEqual(new Set([T0 + 60_000]));

    // The verifications end in another order than they started.
    const order = [3, 0, 4, 2, 1];
    const outcomes = [];
    for (const index of order) outcomes.push(await lockout.fail(WEB, tickets[index]!, T0 + 20));
    expect(outcomes.map((outcome) => [outcome.attemptsRemaining, outcome.lockedUntil])).toEqual([
      [4, null],
      [3, null],
      [2, null],
      [1, null],
      [0, T0 + 60_000],
    ]);
  });

  it('whatever the order, what remains is the number of failures since the last success', async () => {
    // Success first, then four failures of attempts that were taken before it.
    const first = createConsoleLockout();
    const tickets = await Promise.all(Array.from({ length: 5 }, () => takeTicket(first, WEB, T0)));
    first.succeed(WEB);
    const after = [];
    for (const ticket of tickets.slice(1)) after.push((await first.fail(WEB, ticket, T0)).attemptsRemaining);
    expect(after).toEqual([4, 3, 2, 1]);
    expect(await first.status(WEB, T0)).toMatchObject({ locked: false, attemptsRemaining: 1 });
    // Each of those failures also took its attempt where the console stands now: one is left,
    // and taking it reaches the limit.
    expect((await first.take(WEB, T0)).kind).toBe('TAKEN');
    expect(await first.status(WEB, T0)).toMatchObject({ locked: true, lockedUntil: T0 + 60_000 });
    expect((await first.take(WEB, T0)).kind).toBe('LOCKED');

    // Two failures, the success, two failures.
    const second = createConsoleLockout();
    const more = await Promise.all(Array.from({ length: 5 }, () => takeTicket(second, WEB, T0)));
    await second.fail(WEB, more[0]!, T0);
    await second.fail(WEB, more[1]!, T0);
    second.succeed(WEB);
    await second.fail(WEB, more[3]!, T0);
    expect((await second.fail(WEB, more[4]!, T0)).attemptsRemaining).toBe(3);
  });

  it('a failure that arrives while the console is locked again is reported with that lock', async () => {
    const lockout = createConsoleLockout();
    const early = await takeTicket(lockout, WEB, T0);
    lockout.succeed(WEB);
    for (let attempt = 0; attempt < 5; attempt += 1) await lockout.fail(WEB, await takeTicket(lockout, WEB, T0 + 1_000), T0 + 1_000);
    expect(await lockout.fail(WEB, early, T0 + 2_000)).toEqual({ attemptsRemaining: 0, lockedUntil: T0 + 61_000, retryInMs: 59_000 });
  });

  it('an attempt that never reports back leaves the console locked for its 60 s and no longer', async () => {
    const lockout = createConsoleLockout();
    const tickets = await Promise.all(Array.from({ length: 5 }, () => takeTicket(lockout, WEB, T0)));
    for (const ticket of tickets.slice(0, 4)) await lockout.fail(WEB, ticket, T0);
    expect(await lockout.status(WEB, T0 + 59_999)).toMatchObject({ locked: true, lockedUntil: T0 + 60_000 });
    expect(await lockout.status(WEB, T0 + 60_000)).toMatchObject({ locked: false, attemptsRemaining: 5 });
  });
});

describe('reset (a test, or a restart: SR-25)', () => {
  it('forgets one console or every console', async () => {
    const lockout = createConsoleLockout();
    for (const key of [WEB, 'DEV-0001']) for (let attempt = 0; attempt < 5; attempt += 1) await lockout.take(key, T0);
    lockout.reset(WEB);
    expect((await lockout.status(WEB, T0)).locked).toBe(false);
    expect((await lockout.status('DEV-0001', T0)).locked).toBe(true);
    lockout.reset();
    expect(await lockout.status('DEV-0001', T0)).toMatchObject({ locked: false, attemptsRemaining: 5 });
  });

  it('two lockouts do not share a counter', async () => {
    const [one, two] = [createConsoleLockout(), createConsoleLockout()];
    for (let attempt = 0; attempt < 5; attempt += 1) await one.take(WEB, T0);
    expect((await two.take(WEB, T0)).kind).toBe('TAKEN');
  });
});
