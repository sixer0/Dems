// Heartbeat client state machine (masterplan/01_specs.md §2.6) driven by a fake socket and fake timers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHeartbeatClient,
  reconnectDelayMs,
  type SocketLike,
} from '../src/realtime/heartbeat-client';

class FakeSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  closedWith: number | undefined;
  close(code?: number): void {
    this.closedWith = code;
    this.readyState = 3;
  }
  beat(seq: number): void {
    this.onmessage?.({
      data: JSON.stringify({
        type: 'heartbeat',
        v: 1,
        seq,
        serverTime: '2026-09-30T16:41:00.000Z',
        uptimeMs: seq * 1000,
        intervalMs: 1000,
        clients: 1,
        sessionState: null,
      }),
    });
  }
}

describe('createHeartbeatClient', () => {
  let sockets: FakeSocket[];
  let clock: number;

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    clock = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeClient(onResync?: () => void) {
    const client = createHeartbeatClient({
      url: 'ws://127.0.0.1:4400/ws',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      now: () => clock,
      random: () => 0,
      ...(onResync ? { onResync } : {}),
      onInvalidMessage: () => undefined,
    });
    return { client };
  }

  it('goes CONNECTING → LIVE → STALE → OFFLINE → CONNECTING → LIVE and resyncs once', () => {
    const onResync = vi.fn();
    const { client } = makeClient(onResync);
    expect(client.getSnapshot().state).toBe('CONNECTING');
    client.start();
    expect(sockets).toHaveLength(1);

    sockets[0]!.beat(7);
    expect(client.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 7, clients: 1, reconnectAttempt: 0 });

    clock += 2500;
    vi.advanceTimersByTime(500);
    expect(client.getSnapshot().state).toBe('STALE');

    sockets[0]!.beat(8);
    expect(client.getSnapshot().state).toBe('LIVE');

    sockets[0]!.onclose?.({ code: 1001 });
    expect(client.getSnapshot()).toMatchObject({ state: 'OFFLINE', reconnectAttempt: 1 });
    expect(onResync).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500); // backoff[0] + jitter 0
    expect(sockets).toHaveLength(2);
    expect(client.getSnapshot().state).toBe('CONNECTING');

    sockets[1]!.beat(12);
    expect(client.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 12, reconnectAttempt: 0 });
    expect(onResync).toHaveBeenCalledTimes(1);

    client.stop();
    expect(sockets[1]!.closedWith).toBe(1000);
  });

  it('drops invalid messages without changing state', () => {
    const { client } = makeClient();
    client.start();
    sockets[0]!.onmessage?.({ data: '{"type":"nope"}' });
    sockets[0]!.onmessage?.({ data: 'not json' });
    expect(client.getSnapshot().state).toBe('CONNECTING');
    client.stop();
  });

  it('backs off 500, 1000, 2000, 4000, 8000, 8000 ms (+ up to 250 ms jitter)', () => {
    expect([0, 1, 2, 3, 4, 5].map((a) => reconnectDelayMs(a, () => 0))).toEqual([
      500, 1000, 2000, 4000, 8000, 8000,
    ]);
    expect(reconnectDelayMs(0, () => 0.9999)).toBe(750);
  });

  it('notifies subscribers and keeps snapshot identity between changes', () => {
    const { client } = makeClient();
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);
    const before = client.getSnapshot();
    expect(client.getSnapshot()).toBe(before);
    client.start();
    sockets[0]!.beat(1);
    expect(listener).toHaveBeenCalled();
    expect(client.getSnapshot()).not.toBe(before);
    unsubscribe();
    client.stop();
  });
});
