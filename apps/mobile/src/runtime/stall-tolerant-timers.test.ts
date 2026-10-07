// Closing-fix row CF-M1, defects R-P-2 and R-S-2 (re-test round; decision D214).
//
// On dems2_phone a JS stall of 3.5 s (injected through the Hermes inspector, as the starved emulator
// thread did by itself in the re-test) made the monitor show "Core link lost", then "Resynced", with no
// close and no open on the Core: 4 of 4 stalls in one run (CF-M1 report §2). The cause is the ORDER of the
// JS queue after a stall: the socket client's housekeeping tick was queued before the heartbeats that
// arrived during the stall, runs first, reads the wall clock and declares the link STALE; the heartbeat
// that runs a moment later brings it back.
//
// This file models that queue exactly: a task queue in arrival order, a clock that moves on during a
// stall while nothing runs, timer tasks queued at their due time, socket messages queued at their arrival
// time. The real live socket client of `@dems/shared/realtime` runs on it, once with the plain timers
// (the defect: STALE, or SYNC_TIMEOUT and a socket restart, after the stall) and once with the
// stall-tolerant timers of `createMobileLive` (the fix: nothing is declared lost).
import { describe, expect, it } from '@jest/globals';
import { HEARTBEAT_STALE_AFTER_MS, REALTIME_SERVER_EXAMPLES } from '@dems/shared/api';
import { LIVE_SOCKET_SYNC_TIMEOUT_MS, createLiveSocketClient } from '@dems/shared/realtime';
import { STALL_LATENESS_MS, STALL_MAX_POSTPONE_MS, STALL_MAX_YIELDS, STALL_YIELD_MS, createStallTolerantTimers } from './stall-tolerant-timers';
import { FakeSocket, JsThread } from './testing/js-thread';

const DEVICE_HELLO = REALTIME_SERVER_EXAMPLES.hello.device.value;
const beat = (seq: number, at: number) => ({ ...REALTIME_SERVER_EXAMPLES.heartbeat.withoutSession.value, seq, serverTime: new Date(at).toISOString() });

type Mode = 'plain' | 'stall-tolerant';

function harness(mode: Mode) {
  const thread = new JsThread();
  const timers = mode === 'plain' ? thread.timers : createStallTolerantTimers(thread.timers, () => thread.now);
  const sockets: FakeSocket[] = [];
  const links: string[] = [];
  const errors: string[] = [];
  const client = createLiveSocketClient({
    url: 'ws://127.0.0.1:4420/ws',
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    now: () => thread.now,
    timers,
    random: () => 0,
    onLinkChange: (next) => links.push(next),
    onError: (report) => errors.push(report.code),
  });
  let seq = 0;
  const heartbeat = (socket: FakeSocket) => () => socket.deliver(beat(++seq, thread.now));
  return { thread, client, sockets, links, errors, heartbeat };
}

/** A DEVICE socket that is up, with the Core's heartbeat every second for a while. */
function online(mode: Mode) {
  const h = harness(mode);
  h.client.start();
  const socket = h.sockets[0]!;
  socket.deliver(DEVICE_HELLO);
  for (let i = 0; i < 5; i += 1) {
    h.thread.idle(1_000);
    h.heartbeat(socket)();
  }
  expect(h.client.getStatus().link).toBe('ONLINE');
  h.links.length = 0;
  return { ...h, socket };
}

describe('the device picture, modelled: a 3.5 s JS stall while the Core keeps beating', () => {
  const stall = (h: ReturnType<typeof online>) =>
    h.thread.stall(3_500, [1_000, 2_000, 3_000].map((after) => ({ after, deliver: h.heartbeat(h.socket) })));

  it('the defect (plain timers): the housekeeping tick queued before the heartbeats runs first and declares the link STALE', () => {
    const h = online('plain');
    stall(h);
    expect(h.links).toEqual(['STALE', 'ONLINE']);
  });

  it('the fix (stall-tolerant timers): the late tick yields, the waiting heartbeats run first, the link is never declared lost', () => {
    const h = online('stall-tolerant');
    stall(h);
    h.thread.idle(STALL_YIELD_MS * 2);
    expect(h.links).toEqual([]);
    expect(h.client.getStatus().link).toBe('ONLINE');
    // The thread is free again: the housekeeping goes on as before.
    h.thread.idle(2_000);
    expect(h.client.getStatus().link).toBe('ONLINE');
  });

  it('a Core that really went quiet is still declared STALE (the rule is the transport\'s, only judged after the queue)', () => {
    const h = online('stall-tolerant');
    h.thread.idle(HEARTBEAT_STALE_AFTER_MS + 1_000);
    expect(h.links).toEqual(['STALE']);
  });
});

describe('the pairing hand-off picture, modelled (R-S-2): `hello` waits in the queue behind the sync deadline', () => {
  function connecting(mode: Mode) {
    const h = harness(mode);
    h.client.start();
    const socket = h.sockets[0]!;
    // The JS thread is held from the moment the socket was asked for (the paired view and the routing of
    // the hand-off run then), for 5 s. The Core opens the socket and sends `hello` 600 ms later, after the
    // first housekeeping tick fell due, so `hello` waits BEHIND that tick (D211: the Core opened the socket
    // at 19.178, the app judged `waiting: 'hello'` at device 24.176 and gave the socket up).
    h.thread.stall(LIVE_SOCKET_SYNC_TIMEOUT_MS + 1_000, [{ after: 600, deliver: () => socket.deliver(DEVICE_HELLO) }]);
    h.thread.idle(STALL_YIELD_MS * 2);
    return { ...h, socket };
  }

  it('the defect (plain timers): SYNC_TIMEOUT, the socket is given up and the link reads OFFLINE (the false "Core server unreachable")', () => {
    const h = connecting('plain');
    expect(h.errors).toContain('SYNC_TIMEOUT');
    expect(h.socket.closed).toBe(true);
    expect(h.links).toContain('OFFLINE');
  });

  it('the fix: the queued `hello` runs first, no SYNC_TIMEOUT, the first socket is kept and the link is ONLINE', () => {
    const h = connecting('stall-tolerant');
    expect(h.errors).not.toContain('SYNC_TIMEOUT');
    expect(h.socket.closed).toBe(false);
    expect(h.sockets).toHaveLength(1);
    expect(h.links).not.toContain('OFFLINE');
    expect(h.client.getStatus().link).toBe('ONLINE');
  });

  it('a `hello` that never comes still ends in SYNC_TIMEOUT within the deadline plus at most one yield', () => {
    const h = harness('stall-tolerant');
    h.client.start();
    h.thread.idle(LIVE_SOCKET_SYNC_TIMEOUT_MS + 500 + STALL_YIELD_MS);
    expect(h.errors).toEqual(['SYNC_TIMEOUT']);
  });
});

describe('createStallTolerantTimers: the rule', () => {
  function setup() {
    const thread = new JsThread();
    const timers = createStallTolerantTimers(thread.timers, () => thread.now);
    const ran: number[] = [];
    return { thread, timers, ran };
  }

  it('a callback on time runs at its due time, once', () => {
    const { thread, timers, ran } = setup();
    timers.setTimeout(() => ran.push(thread.now), 1_000);
    const t0 = thread.now;
    thread.idle(5_000);
    expect(ran).toEqual([t0 + 1_000]);
  });

  it(`a callback later than ${STALL_LATENESS_MS} ms yields ${STALL_YIELD_MS} ms to the queue, then runs`, () => {
    const { thread, timers, ran } = setup();
    const order: string[] = [];
    timers.setTimeout(() => order.push('timer'), 500);
    thread.stall(2_000, [{ after: 1_000, deliver: () => order.push('message') }]);
    expect(order).toEqual(['message']);
    const end = thread.now;
    thread.idle(STALL_YIELD_MS);
    expect(order).toEqual(['message', 'timer']);
    expect(ran).toEqual([]);
    expect(thread.now).toBe(end + STALL_YIELD_MS);
  });

  it('a callback just inside the lateness bound runs in that turn (no yield)', () => {
    const { thread, timers } = setup();
    const order: string[] = [];
    timers.setTimeout(() => order.push('timer'), 500);
    thread.stall(500 + STALL_LATENESS_MS, [{ after: 600, deliver: () => order.push('message') }]);
    expect(order).toEqual(['timer', 'message']);
  });

  it(`a starved thread postpones a callback at most ${STALL_MAX_YIELDS} yields, then it runs`, () => {
    const { thread, timers } = setup();
    let ran = false;
    timers.setTimeout(() => {
      ran = true;
    }, 100);
    for (let i = 0; i <= STALL_MAX_YIELDS && !ran; i += 1) thread.stall(STALL_YIELD_MS + STALL_LATENESS_MS + 100);
    expect(ran).toBe(true);
  });

  // CF2-A, RF-PH-1 / RF-T-3 and RF-PH-2: on the loaded emulator every task ran hundreds of ms late for
  // seconds on end, so each 50 ms yield was itself late and 20 of them postponed a callback by ~9 s.
  /** The header's promise: a deadline is never postponed by more than about a second. */
  const ABOUT_A_SECOND = 1_000;

  it('the wall-time bound of the yields is that second', () => {
    expect(STALL_MAX_POSTPONE_MS).toBe(ABOUT_A_SECOND);
  });

  it('a thread starved for good (every task 400 ms late) postpones a callback by at most about a second after it first fired late', () => {
    const { thread, timers } = setup();
    const lateBy = 400;
    const due = thread.now + 100;
    let ranAt: number | null = null;
    timers.setTimeout(() => {
      ranAt = thread.now;
    }, 100);
    thread.starve(20_000, lateBy);
    expect(ranAt).not.toBeNull();
    // First late firing at due + lateBy; the last yield starts before + STALL_MAX_POSTPONE_MS and fires one yield (and its lateness) later.
    expect(ranAt! - due).toBeLessThanOrEqual(lateBy + ABOUT_A_SECOND + STALL_YIELD_MS + lateBy);
    // CF-M1's count-only bound gave 20 x (50 + 400) ms on top of the first lateness.
    expect(ranAt! - due).toBeLessThan(lateBy + STALL_MAX_YIELDS * (STALL_YIELD_MS + lateBy));
  });

  it("the Live source's 100 ms clock publication keeps running under that starvation: no gap above about 2 s (it was ~9 s)", () => {
    const { thread, timers } = setup();
    const at: number[] = [];
    timers.setInterval(() => at.push(thread.now), 100);
    thread.starve(30_000, 400);
    const gaps = at.slice(1).map((t, i) => t - at[i]!);
    expect(at.length).toBeGreaterThan(10);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(100 + 400 + ABOUT_A_SECOND + STALL_YIELD_MS + 400);
  });

  it('clearTimeout cancels before the due time and during a yield', () => {
    const { thread, timers } = setup();
    let a = 0;
    let b = 0;
    const first = timers.setTimeout(() => (a += 1), 500);
    timers.clearTimeout(first);
    const second = timers.setTimeout(() => (b += 1), 500);
    thread.stall(2_000);
    timers.clearTimeout(second); // it is yielding now
    thread.idle(1_000);
    expect([a, b]).toEqual([0, 0]);
  });

  it('an interval keeps its period from the run that happened, survives a stall, and stops when cleared (also from its own callback)', () => {
    const { thread, timers } = setup();
    const at: number[] = [];
    const t0 = thread.now;
    const handle = timers.setInterval(() => at.push(thread.now - t0), 500);
    thread.idle(1_600);
    expect(at).toEqual([500, 1_000, 1_500]);
    thread.stall(3_000);
    thread.idle(STALL_YIELD_MS);
    expect(at.at(-1)).toBe(1_600 + 3_000 + STALL_YIELD_MS);
    timers.clearInterval(handle);
    const count = at.length;
    thread.idle(5_000);
    expect(at).toHaveLength(count);

    let runs = 0;
    const self: { handle: unknown } = { handle: null };
    self.handle = timers.setInterval(() => {
      runs += 1;
      timers.clearInterval(self.handle);
    }, 100);
    thread.idle(1_000);
    expect(runs).toBe(1);
  });

  it('a foreign handle is ignored by the clear functions', () => {
    const { timers } = setup();
    expect(() => timers.clearTimeout(42)).not.toThrow();
    expect(() => timers.clearInterval(undefined)).not.toThrow();
  });
});
