// The sockets of upgrade requests before the socket route takes them (plan row W42 follow-up;
// review finding CPS1-4; findings F-1, F-2, F-4 of the row). Pure: real streams as the sockets,
// a manual clock, no listener. The same rules run against a real listener and a raw TCP client
// in `upgrade.db.test.ts`.
import { PassThrough } from 'node:stream';
import { createManualClock } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { createHandshakeGuard, type HandshakeGuard } from '../handshake';
import { REALTIME_HANDSHAKE_TIMEOUT_MS, REALTIME_MAX_CONNECTIONS, REALTIME_MAX_PENDING_HANDSHAKES } from '../limits';

const START = Date.UTC(2031, 0, 1);

interface Scene {
  readonly guard: HandshakeGuard;
  readonly clock: ReturnType<typeof createManualClock>;
  /** A new upgrade request with its socket, handed to the guard. */
  upgrade(): { request: object; socket: PassThrough };
}

function scene(limits = { handshakeTimeoutMs: REALTIME_HANDSHAKE_TIMEOUT_MS, maxPendingHandshakes: REALTIME_MAX_PENDING_HANDSHAKES }): Scene {
  const clock = createManualClock(START);
  const guard = createHandshakeGuard(clock, limits);
  return {
    guard,
    clock,
    upgrade() {
      const request = {};
      const socket = new PassThrough();
      guard.begin(request, socket);
      return { request, socket };
    },
  };
}

describe('the numbers', () => {
  it('a handshake has 5,000 ms, longer than a client waits for hello; 32 sockets may wait at one time, twice the connection cap', () => {
    expect(REALTIME_HANDSHAKE_TIMEOUT_MS).toBe(5_000);
    expect(REALTIME_MAX_PENDING_HANDSHAKES).toBe(32);
    expect(REALTIME_MAX_PENDING_HANDSHAKES).toBe(2 * REALTIME_MAX_CONNECTIONS);
  });
});

describe('one upgrade request ends in one of three ways', () => {
  it('taken by the socket route: the guard forgets it, takes its listeners off and never touches it again', () => {
    const { guard, clock, upgrade } = scene();
    const { request, socket } = upgrade();
    expect(guard.stats()).toEqual({ pending: 1, expired: 0, displaced: 0 });
    expect([socket.listenerCount('error'), socket.listenerCount('end')]).toEqual([1, 1]);

    guard.taken(request);
    expect(guard.stats().pending).toBe(0);
    expect([socket.listenerCount('error'), socket.listenerCount('end')]).toEqual([0, 0]);
    expect(socket.destroyed).toBe(false);
    // Neither the answer hook, nor the bound, nor the stop destroys a socket that was taken.
    guard.answered(request);
    clock.advance(10 * REALTIME_HANDSHAKE_TIMEOUT_MS);
    expect(guard.sweep()).toBe(0);
    guard.clear();
    expect(socket.destroyed).toBe(false);
  });

  it('answered over HTTP: the socket is destroyed at once, and an error on it afterwards is still caught', () => {
    const { guard, upgrade } = scene();
    const { request, socket } = upgrade();
    guard.answered(request);
    expect(socket.destroyed).toBe(true);
    expect(guard.stats()).toEqual({ pending: 0, expired: 0, displaced: 0 });
    // A write of the answer to the destroyed socket may still report an error: it must not be unhandled.
    expect(socket.listenerCount('error')).toBe(1);
    expect(() => socket.emit('error', new Error('write after end'))).not.toThrow();
    // A second report of the same request changes nothing.
    guard.answered(request);
    expect(guard.stats().pending).toBe(0);
  });

  it('neither: destroyed by the sweep at the bound, and not a millisecond before', () => {
    const { guard, clock, upgrade } = scene();
    const { socket } = upgrade();
    clock.advance(REALTIME_HANDSHAKE_TIMEOUT_MS - 1);
    expect(guard.sweep()).toBe(0);
    expect(socket.destroyed).toBe(false);
    clock.advance(1);
    expect(guard.sweep()).toBe(1);
    expect(socket.destroyed).toBe(true);
    expect(guard.stats()).toEqual({ pending: 0, expired: 1, displaced: 0 });
    expect(guard.sweep()).toBe(0);
  });

  it('a request the guard does not know changes nothing', () => {
    const { guard, upgrade } = scene();
    const { socket } = upgrade();
    guard.taken({});
    guard.answered({});
    expect(guard.stats().pending).toBe(1);
    expect(socket.destroyed).toBe(false);
  });
});

describe('the peer, while the socket waits', () => {
  it('a peer that resets the connection is no unhandled error: the socket is destroyed and forgotten', () => {
    const { guard, upgrade } = scene();
    const { socket } = upgrade();
    expect(() => socket.emit('error', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).not.toThrow();
    expect(socket.destroyed).toBe(true);
    expect(guard.stats().pending).toBe(0);
  });

  it('a peer that ends is not left half open', () => {
    const { guard, upgrade } = scene();
    const { socket } = upgrade();
    socket.emit('end');
    expect(socket.destroyed).toBe(true);
    expect(guard.stats().pending).toBe(0);
  });

  it('after the route took the socket, an end or an error is the socket library\'s, not the guard\'s', () => {
    const { guard, upgrade } = scene();
    const { request, socket } = upgrade();
    guard.taken(request);
    socket.on('error', () => {});
    socket.emit('end');
    socket.emit('error', new Error('later'));
    expect(socket.destroyed).toBe(false);
  });
});

describe('the sweep', () => {
  it('destroys those whose time is up, in the order they came, and leaves the others', () => {
    const { guard, clock, upgrade } = scene();
    const first = upgrade();
    clock.advance(1_000);
    const second = upgrade();
    clock.advance(1_000);
    const third = upgrade();
    guard.taken(second.request);

    clock.advance(REALTIME_HANDSHAKE_TIMEOUT_MS - 2_000);
    expect(guard.sweep()).toBe(1);
    expect([first.socket.destroyed, second.socket.destroyed, third.socket.destroyed]).toEqual([true, false, false]);
    clock.advance(1_999);
    expect(guard.sweep()).toBe(0);
    clock.advance(1);
    expect(guard.sweep()).toBe(1);
    expect([first.socket.destroyed, second.socket.destroyed, third.socket.destroyed]).toEqual([true, false, true]);
    expect(guard.stats()).toEqual({ pending: 0, expired: 2, displaced: 0 });
  });

  it('the stop destroys everything that waits', () => {
    const { guard, upgrade } = scene();
    const sockets = [upgrade(), upgrade(), upgrade()].map((entry) => entry.socket);
    guard.clear();
    expect(sockets.map((socket) => socket.destroyed)).toEqual([true, true, true]);
    // Not counted as expired or displaced: it is the stop.
    expect(guard.stats()).toEqual({ pending: 0, expired: 0, displaced: 0 });
  });
});

describe('the cap of waiting sockets', () => {
  it('at the cap the oldest waiting socket is destroyed and the new one waits in its place: a new upgrade is never kept out', () => {
    const { guard, upgrade } = scene({ handshakeTimeoutMs: REALTIME_HANDSHAKE_TIMEOUT_MS, maxPendingHandshakes: 3 });
    const sockets = [upgrade(), upgrade(), upgrade()].map((entry) => entry.socket);
    expect(guard.stats()).toEqual({ pending: 3, expired: 0, displaced: 0 });
    const fourth = upgrade();
    expect(sockets.map((socket) => socket.destroyed)).toEqual([true, false, false]);
    expect(fourth.socket.destroyed).toBe(false);
    expect(guard.stats()).toEqual({ pending: 3, expired: 0, displaced: 1 });
    const fifth = upgrade();
    expect(sockets.map((socket) => socket.destroyed)).toEqual([true, true, false]);
    expect(guard.stats()).toEqual({ pending: 3, expired: 0, displaced: 2 });
    // The newcomers can still be taken by the route.
    guard.taken(fourth.request);
    guard.taken(fifth.request);
    expect([fourth.socket.destroyed, fifth.socket.destroyed]).toEqual([false, false]);
    expect(guard.stats().pending).toBe(1);
  });

  it('a flood of upgrades that never complete holds 32 sockets and no more, and a place that was freed is not counted', () => {
    const { guard, upgrade } = scene();
    const flood = Array.from({ length: 100 }, () => upgrade().socket);
    expect(guard.stats()).toEqual({ pending: 32, expired: 0, displaced: 68 });
    expect(flood.filter((socket) => !socket.destroyed)).toHaveLength(32);
    expect(flood.slice(0, 68).every((socket) => socket.destroyed)).toBe(true);
    // One below the cap displaces nobody.
    const roomy = scene({ handshakeTimeoutMs: REALTIME_HANDSHAKE_TIMEOUT_MS, maxPendingHandshakes: 3 });
    const two = [roomy.upgrade(), roomy.upgrade()];
    roomy.guard.answered(two[0]!.request);
    roomy.upgrade();
    roomy.upgrade();
    expect(roomy.guard.stats()).toEqual({ pending: 3, expired: 0, displaced: 0 });
    expect(two[1]?.socket.destroyed).toBe(false);
  });
});
