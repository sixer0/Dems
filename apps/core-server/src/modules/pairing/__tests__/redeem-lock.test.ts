// The redeem lock and the presence counter (plan row W32; spec §6.1 PR-P4, §6.5 `online`; SR-27,
// SR-72; ENG-24; database contract AT-6). Memory state, no database: the instants are numbers a
// test chooses, as the manual server clock gives them.
import { describe, expect, it } from 'vitest';
import { createDevicePresence } from '../presence';
import { createRedeemLock, type RedeemTicket } from '../redeem-lock';

const T0 = Date.UTC(2031, 0, 1);
const MINUTE = 60_000;

async function taken(lock: ReturnType<typeof createRedeemLock>, now: number): Promise<RedeemTicket> {
  const attempt = await lock.take(now);
  if (attempt.kind !== 'TAKEN') throw new Error('the attempt was refused');
  return attempt;
}

describe('the redeem lock: 3 failed redeems within 300 s lock redeeming for 60 s (PR-P4)', () => {
  it('starts open with three attempts', async () => {
    const lock = createRedeemLock();
    expect(await lock.status(T0)).toEqual({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 3 });
  });

  it('counts failures down: 2, 1, and the third is the locking one with the end of the lock', async () => {
    const lock = createRedeemLock();
    expect(await lock.fail(await taken(lock, T0), T0)).toEqual({ attemptsRemaining: 2, lockedUntil: null, retryInMs: 0 });
    expect(await lock.fail(await taken(lock, T0 + 1_000), T0 + 1_000)).toEqual({ attemptsRemaining: 1, lockedUntil: null, retryInMs: 0 });
    expect(await lock.status(T0 + 1_000)).toMatchObject({ locked: false, attemptsRemaining: 1 });
    const third = await taken(lock, T0 + 2_000);
    // The lock stands from the moment the third attempt is TAKEN, before its comparison ends.
    expect(await lock.status(T0 + 2_000)).toEqual({ locked: true, lockedUntil: T0 + 2_000 + MINUTE, retryInMs: MINUTE, attemptsRemaining: 0 });
    expect(await lock.fail(third, T0 + 2_500)).toEqual({ attemptsRemaining: 0, lockedUntil: T0 + 2_000 + MINUTE, retryInMs: MINUTE - 500 });
  });

  it('ENG-24: of 20 attempts at one instant exactly three are taken; the other 17 are refused and nothing of theirs is compared', async () => {
    const lock = createRedeemLock();
    const attempts = await Promise.all(Array.from({ length: 20 }, () => lock.take(T0)));
    expect(attempts.filter((attempt) => attempt.kind === 'TAKEN')).toHaveLength(3);
    expect(attempts.slice(0, 3).every((attempt) => attempt.kind === 'TAKEN')).toBe(true);
    expect(attempts.slice(3)).toEqual(Array.from({ length: 17 }, () => ({ kind: 'LOCKED', lockedUntil: T0 + MINUTE, retryInMs: MINUTE })));
  });

  it('during the lock every attempt is refused with the same end; one millisecond before the end still, at the end not any more', async () => {
    const lock = createRedeemLock();
    for (let attempt = 0; attempt < 3; attempt += 1) await lock.fail(await taken(lock, T0), T0);
    expect(await lock.take(T0 + 20_000)).toEqual({ kind: 'LOCKED', lockedUntil: T0 + MINUTE, retryInMs: 40_000 });
    expect(await lock.take(T0 + MINUTE - 1)).toEqual({ kind: 'LOCKED', lockedUntil: T0 + MINUTE, retryInMs: 1 });
    expect((await lock.take(T0 + MINUTE)).kind).toBe('TAKEN');
  });

  it('a lock that has ended starts a fresh count, as the simulator does', async () => {
    const lock = createRedeemLock();
    for (let attempt = 0; attempt < 3; attempt += 1) await lock.fail(await taken(lock, T0), T0);
    expect(await lock.status(T0 + MINUTE)).toEqual({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 3 });
    expect(await lock.fail(await taken(lock, T0 + MINUTE), T0 + MINUTE)).toMatchObject({ attemptsRemaining: 2, lockedUntil: null });
    expect(await lock.fail(await taken(lock, T0 + MINUTE), T0 + MINUTE)).toMatchObject({ attemptsRemaining: 1 });
    expect(await lock.fail(await taken(lock, T0 + MINUTE), T0 + MINUTE)).toMatchObject({ attemptsRemaining: 0, lockedUntil: T0 + 2 * MINUTE });
  });

  it('a success clears the count and lifts the lock that the third take had set', async () => {
    const lock = createRedeemLock();
    await lock.fail(await taken(lock, T0), T0);
    await lock.fail(await taken(lock, T0), T0);
    await taken(lock, T0); // the third attempt: the right code
    expect((await lock.status(T0)).locked).toBe(true);
    lock.succeed();
    expect(await lock.status(T0)).toEqual({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 3 });
    expect(await lock.fail(await taken(lock, T0 + 1), T0 + 1)).toMatchObject({ attemptsRemaining: 2 });
  });

  it('the window is 300 s from the first taken attempt: two failures do not last longer than that', async () => {
    const lock = createRedeemLock();
    await lock.fail(await taken(lock, T0), T0);
    await lock.fail(await taken(lock, T0 + 1_000), T0 + 1_000);
    expect(await lock.status(T0 + 5 * MINUTE - 1)).toMatchObject({ attemptsRemaining: 1 });
    expect(await lock.status(T0 + 5 * MINUTE)).toMatchObject({ locked: false, attemptsRemaining: 3 });
    expect(await lock.fail(await taken(lock, T0 + 5 * MINUTE), T0 + 5 * MINUTE)).toMatchObject({ attemptsRemaining: 2, lockedUntil: null });
  });

  it('a failure reported after its window is over still counts, where the lock stands now', async () => {
    const lock = createRedeemLock();
    const early = await taken(lock, T0);
    lock.succeed(); // another attempt of the window was right
    expect(await lock.fail(early, T0 + 10)).toEqual({ attemptsRemaining: 2, lockedUntil: null, retryInMs: 0 });
    expect(await lock.status(T0 + 10)).toMatchObject({ attemptsRemaining: 2 });
  });

  it('reset forgets the count and the lock; two locks do not share a count', async () => {
    const lock = createRedeemLock();
    const other = createRedeemLock();
    for (let attempt = 0; attempt < 3; attempt += 1) await lock.fail(await taken(lock, T0), T0);
    expect((await other.status(T0)).attemptsRemaining).toBe(3);
    expect((await lock.take(T0)).kind).toBe('LOCKED');
    lock.reset();
    expect(await lock.status(T0)).toMatchObject({ locked: false, attemptsRemaining: 3 });
    expect((await lock.take(T0)).kind).toBe('TAKEN');
  });
});

describe('the presence counter (spec §6.5 `online`)', () => {
  it('a device is online while at least one of its sockets is open', () => {
    const presence = createDevicePresence();
    expect(presence.isOnline('DEV-0001')).toBe(false);
    presence.socketOpened('DEV-0001');
    presence.socketOpened('DEV-0001');
    presence.socketOpened('DEV-0002');
    expect(presence.online().sort()).toEqual(['DEV-0001', 'DEV-0002']);
    presence.socketClosed('DEV-0001');
    expect(presence.isOnline('DEV-0001')).toBe(true);
    presence.socketClosed('DEV-0001');
    expect(presence.isOnline('DEV-0001')).toBe(false);
    // A close without an open socket changes nothing.
    presence.socketClosed('DEV-0001');
    presence.socketClosed('DEV-0009');
    expect(presence.online()).toEqual(['DEV-0002']);
  });

  it('forget drops every socket of one device; reset drops every device', () => {
    const presence = createDevicePresence();
    for (const deviceId of ['DEV-0001', 'DEV-0001', 'DEV-0002', 'DEV-0003']) presence.socketOpened(deviceId);
    presence.forget('DEV-0001');
    expect(presence.online().sort()).toEqual(['DEV-0002', 'DEV-0003']);
    presence.reset();
    expect(presence.online()).toEqual([]);
  });
});
