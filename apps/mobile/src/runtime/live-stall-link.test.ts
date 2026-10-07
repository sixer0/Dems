// Closing-fix row CF-M1, defects R-P-2 and R-S-2: the app's own Live source (`createMobileLive`) runs its
// timers through the stall-tolerant wrapper, so a JS stall while the Core keeps beating declares nothing lost.
//
// The Live source here is the real one of the app (`createMobileLive`), with the JS-thread model of
// `testing/js-thread.ts` as its clock and timers and a fake socket for the Core: the housekeeping tick that
// fell due during a 3.5 s stall runs AFTER the heartbeats that arrived meanwhile only if the app wrapped
// its timers (`stall-tolerant-timers.ts`). Without the wrapper the link reads STALE, then ONLINE again,
// which is the device's "Core link lost", "Resynced" (4 of 4 injected stalls on dems2_phone).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REALTIME_SERVER_EXAMPLES } from '@dems/shared/api';
import { resetCoreLinkPrefsForTests } from './core-link';
import { createMobileLive, type MobileLive } from './sim-adapters';
import { FakeSocket, JsThread } from './testing/js-thread';

let mobile: MobileLive | null = null;

afterEach(async () => {
  mobile?.stop();
  mobile = null;
  resetCoreLinkPrefsForTests();
  await AsyncStorage.clear();
});

const ANONYMOUS_HELLO = REALTIME_SERVER_EXAMPLES.hello.anonymous.value;
const beat = (seq: number, at: number) => ({ ...REALTIME_SERVER_EXAMPLES.heartbeat.withoutSession.value, seq, serverTime: new Date(at).toISOString() });

/** A fetch that never answers: the Live source's HTTP side stays out of the way of the socket's link. */
const silentFetch = jest.fn(() => new Promise<never>(() => undefined)) as unknown as typeof fetch;

async function flushJobs(): Promise<void> {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
}

async function liveSourceOnline() {
  const thread = new JsThread();
  const sockets: FakeSocket[] = [];
  const created = createMobileLive({
    fetch: silentFetch,
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    now: () => thread.now,
    timers: thread.timers,
    random: () => 0,
  });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  const started = created.start();
  for (let i = 0; i < 20 && sockets.length === 0; i += 1) {
    await flushJobs();
    thread.idle(10);
  }
  await started;
  expect(sockets).toHaveLength(1);
  const socket = sockets[0]!;
  socket.deliver(ANONYMOUS_HELLO);
  let seq = 0;
  const heartbeat = () => socket.deliver(beat(++seq, thread.now));
  for (let i = 0; i < 4; i += 1) {
    thread.idle(1_000);
    heartbeat();
  }
  expect(created.live.link).toBe('ONLINE');
  const links: string[] = [];
  const unsubscribe = created.live.heartbeat.subscribe(() => links.push(created.live.link));
  return { thread, socket, heartbeat, links, unsubscribe, live: created.live };
}

describe('createMobileLive: a 3.5 s JS stall while the Core keeps beating', () => {
  it('the link never reads STALE or OFFLINE, and the socket is kept', async () => {
    const h = await liveSourceOnline();
    h.thread.stall(3_500, [1_000, 2_000, 3_000].map((after) => ({ after, deliver: h.heartbeat })));
    h.thread.idle(200);
    h.heartbeat();
    h.thread.idle(1_000);
    h.unsubscribe();
    expect(h.links.filter((link) => link === 'STALE' || link === 'OFFLINE')).toEqual([]);
    expect(h.live.link).toBe('ONLINE');
    expect(h.socket.closed).toBe(false);
  });
});
