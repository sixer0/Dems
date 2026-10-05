// The test support of the realtime channel, tested (plan row W42 follow-up; decisions D113, D116;
// note W48-F5 of the pairing lifecycle test). Other rows hold sockets for a whole journey, so the
// one thing that must hold is this: `TestSocket.closed` is guarded from the moment a test asks
// for it, not from the moment the socket was created.
//
// TIME. The guard is a timer of the test process. For the few lines that look at it, that timer
// is a fake one, moved by hand; the fake is installed and removed in one synchronous stretch with
// only promise turns in between, so nothing of the server, the driver or the socket library sets
// a timer while it is in place. Nothing sleeps.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import {
  EVENT_GUARD_MS,
  SUPERVISOR,
  openSocket,
  operatorSocket,
  realtimeApp,
  untilSockets,
  useSockets,
  webHeaders,
  webOperator,
  type Closed,
  type RealtimeApp,
  type WebOperator,
} from '../../../test/support/realtime';
import * as oldPath from './support';
import * as neutral from '../../../test/support/realtime';

const db = useTestDatabase({ template: 'seed' });
let rt: RealtimeApp;
let supervisor: WebOperator;

useSockets(() => rt);

beforeAll(async () => {
  rt = await realtimeApp(db);
  supervisor = await webOperator(rt, SUPERVISOR);
});

beforeEach(() => {
  rt.forgetCounters();
});

/** What became of a promise so far: read after the promise turns have run, never awaited. */
function watch<T>(promise: Promise<T>): { state: 'pending' | 'resolved' | 'rejected'; value?: T; message?: string } {
  const seen: { state: 'pending' | 'resolved' | 'rejected'; value?: T; message?: string } = { state: 'pending' };
  promise.then(
    (value) => Object.assign(seen, { state: 'resolved', value }),
    (error: unknown) => Object.assign(seen, { state: 'rejected', message: error instanceof Error ? error.message : String(error) }),
  );
  return seen;
}

/** Lets the promise reactions that are due run. No timer and no I/O is involved. */
async function turns(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

describe('TestSocket.closed (W48-F5)', () => {
  it('the guard starts when the property is read: a socket that has lived longer than the guard can still be awaited, and each read has its own guard', async () => {
    expect(EVENT_GUARD_MS).toBe(5_000);
    const socket = await operatorSocket(rt, webHeaders(supervisor.cookie));

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let first: ReturnType<typeof watch<Closed>>;
    let second: ReturnType<typeof watch<Closed>>;
    let bounded: ReturnType<typeof watch<Closed>>;
    let unbounded: ReturnType<typeof watch<Closed>>;
    try {
      // The socket has been open for three guard times before anybody asks for its close.
      vi.advanceTimersByTime(3 * EVENT_GUARD_MS);
      await turns();
      unbounded = watch(socket.whenClosed);
      first = watch(socket.closed);
      vi.advanceTimersByTime(EVENT_GUARD_MS - 1);
      await turns();
      expect(first.state).toBe('pending');

      // A second read, later, with a guard of its own; and one with a bound the caller names.
      second = watch(socket.closed);
      bounded = watch(socket.closedWithin(100));
      vi.advanceTimersByTime(1);
      await turns();
      expect(first).toMatchObject({ state: 'rejected' });
      expect(first.message).toContain(`the close did not happen within ${EVENT_GUARD_MS} ms`);
      expect(first.message).toContain('received so far: [hello, snapshot, heartbeat]');
      expect(second.state).toBe('pending');
      expect(bounded.state).toBe('pending');
      vi.advanceTimersByTime(99);
      await turns();
      expect(bounded).toMatchObject({ state: 'rejected' });
      expect(bounded.message).toContain('the close did not happen within 100 ms');
      expect(second.state).toBe('pending');
      expect(unbounded.state).toBe('pending');
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      vi.useRealTimers();
    }

    // The socket closes while the second guard still runs: that read resolves with the close.
    socket.terminate();
    expect(await socket.whenClosed).toEqual({ code: 1006, reason: '' });
    await turns();
    expect(second).toMatchObject({ state: 'resolved', value: { code: 1006, reason: '' } });
    expect(unbounded).toMatchObject({ state: 'resolved', value: { code: 1006, reason: '' } });
    // After the close every read resolves at once, guard or not.
    expect(await socket.closed).toEqual({ code: 1006, reason: '' });
    expect(await socket.closedWithin(1)).toEqual({ code: 1006, reason: '' });
    await untilSockets(rt, 0);
  });

  it('a read that nobody awaits is no unhandled rejection, and a guard is cleared the moment the socket closes', async () => {
    const socket = await operatorSocket(rt, webHeaders(supervisor.cookie));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      void socket.closed;
      void socket.closedWithin(50);
      expect(vi.getTimerCount()).toBe(2);
      vi.advanceTimersByTime(EVENT_GUARD_MS);
      await turns();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
    // With real timers: a guard that is still running when the close comes leaves no timer behind.
    const closed = socket.closed;
    socket.terminate();
    expect((await closed).code).toBe(1006);
  });

  it('opened and refused keep their guard from the creation of the socket: a handshake is expected at once', async () => {
    const accepted = openSocket(rt.wsUrl);
    await accepted.opened;
    await expect(accepted.refused).rejects.toThrow('the handshake completed');
    const refused = openSocket(rt.wsUrl, { origin: 'http://evil.example' });
    expect((await refused.refused).status).toBe(403);
    await expect(refused.opened).rejects.toThrow('the handshake was refused with HTTP 403');
    expect((await refused.closed).code).toBe(1006);
  });
});

describe('the old path of the support', () => {
  it('re-exports the neutral file: every name, the same objects', () => {
    expect(Object.keys(oldPath).sort()).toEqual(Object.keys(neutral).sort());
    for (const name of Object.keys(neutral) as Array<keyof typeof neutral>) expect(oldPath[name], name).toBe(neutral[name]);
    for (const name of ['openSocket', 'realtimeApp', 'settle', 'untilSockets', 'webHeaders', 'deviceHeaders', 'OWN_ORIGIN', 'stepTimer', 'useSockets']) {
      expect(Object.keys(oldPath), name).toContain(name);
    }
  });
});
