// HB-11, the contract-checked fake transport, under the live socket client (plan rows W30 and W31;
// 04_client_integration_spec CL-7 to CL-11b). The live socket client is the socket consumer the
// Live source builds on: it takes a socket factory with the upgrade headers, the clock and the timer
// functions by injection. Here it runs on the fake socket, the fake clock and the fake clock's
// timers, so one `advance` moves the client and the fake together and no runner timer is involved.
// The assertions are about the fake: what it logs, what it checks, what it lets through.
import { describe, expect, it } from 'vitest';
import { REALTIME_SERVER_EXAMPLES, pickReplicatedState, type ReplicatedState } from '../src/api';
import { FAKE_CREDENTIALS, createFakeClock, createFakeTransport } from '../src/live/testing';
import { createLiveSocketClient, type LiveSocketFactory, type LiveSocketTimers } from '../src/realtime/live-socket-client';
import { DEFAULT_SEED, createIdleState } from '../src/sim';

const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const BEARER = `Bearer ${FAKE_CREDENTIALS.sessionToken}`;
const STATE = pickReplicatedState(JSON.parse(JSON.stringify(createIdleState({ now: createFakeClock().now(), seed: DEFAULT_SEED }))) as ReplicatedState);
const ops = REALTIME_SERVER_EXAMPLES.delta.tabletConnected.value.ops;

function setup(headers?: () => Record<string, string>) {
  const fake = createFakeTransport({ epoch: 3, revision: 128 });
  const events: string[] = [];
  const errors: string[] = [];
  // Both are passed as they are: the fake has the shapes the client injects.
  const socketFactory: LiveSocketFactory = fake.socketFactory;
  const timers: LiveSocketTimers = fake.clock.timers;
  const live = createLiveSocketClient({
    url: SOCKET_URL,
    socketFactory,
    timers,
    now: fake.clock.now,
    random: () => 0,
    ...(headers ? { headers } : {}),
    onSnapshot: (snapshot) => events.push(`snapshot ${snapshot.epoch}.${snapshot.revision}`),
    onDelta: (delta) => events.push(`delta ${delta.revision}`),
    onControl: (message) => events.push(message.type),
    onEnd: (end) => events.push(`end ${end.kind}`),
    onError: (report) => errors.push(report.code),
  });
  return { fake, live, events, errors };
}

describe('the real live socket client on the fake socket, the fake clock and its timers', () => {
  it('the mobile form: the bearer header reaches the upgrade and the log, kept as given and printed masked', () => {
    const { fake, live } = setup(() => ({ Authorization: BEARER }));
    live.start();
    expect(fake.connections).toHaveLength(1);
    expect(fake.connection()).toMatchObject({ url: SOCKET_URL, state: 'CONNECTING', headers: { authorization: BEARER } });
    expect(String(fake.log)).toContain('authorization: Bearer ses_***');
    expect(String(fake.log)).not.toContain('FAKE-TRANSPORT');
    live.stop();
    expect(fake.connection().closed).toMatchObject({ by: 'client', code: 1000 });
    fake.assertNoViolations();
  });

  it('the web form: no header; a signed-in start hands the snapshot on, and every message the client sends is the contract', () => {
    const { fake, live, events, errors } = setup();
    live.start();
    expect(fake.connection().headers).toEqual({});
    fake.connection().startOperator(STATE);
    expect(events).toEqual(['snapshot 3.128']);
    expect(live.getStatus()).toMatchObject({ principal: 'OPERATOR', epoch: 3, revision: 128, synced: true });

    fake.connection().delta(ops);
    expect(events).toEqual(['snapshot 3.128', 'delta 129']);

    // A revision gap: the client asks for a new snapshot with a message the fake checks.
    fake.connection().delta(ops, { revision: 140 });
    expect(fake.connection().receivedOf('resync')).toEqual([{ type: 'resync' }]);
    fake.connection().snapshot(STATE);
    expect(events.at(-1)).toBe('snapshot 3.140');
    expect(live.getStatus()).toMatchObject({ synced: true, revision: 140 });

    // The meters wish of an operator socket is a `subscribe` of the contract (CL-11b).
    expect(fake.connection().receivedOf('subscribe')).toEqual([{ type: 'subscribe', topic: 'meters' }]);
    expect(errors).toEqual([]);
    fake.assertNoViolations();
    live.stop();
  });

  it('the heartbeat series and the client timers run on one clock; a session end closes with 4401 and nothing is left scheduled', () => {
    const { fake, live, events, errors } = setup();
    live.start();
    const connection = fake.connection().startOperator(STATE);
    connection.beatEvery();
    fake.clock.advance(3_000);
    expect(live.getSnapshot()).toMatchObject({ state: 'LIVE', seq: 2, lastBeatAt: fake.clock.now() });

    connection.sessionEnded('IDLE_EXPIRED');
    expect(events.slice(-2)).toEqual(['session.ended', 'end SESSION_ENDED']);
    expect(live.getStatus().end).toMatchObject({ kind: 'SESSION_ENDED', closeCode: 4401, sessionEnded: 'IDLE_EXPIRED' });
    fake.clock.advance(60_000);
    expect(fake.connections).toHaveLength(1);
    live.stop();
    expect(fake.clock.pendingTasks).toBe(0);
    expect(errors).toEqual([]);
    fake.assertNoViolations();
  });

  it('a close with 1001 is followed by a reconnect on the clock, and the new socket carries headers asked afresh', () => {
    let asked = 0;
    const { fake, live } = setup(() => {
      asked += 1;
      return { Authorization: asked === 1 ? `Bearer ${FAKE_CREDENTIALS.deviceCredential}` : BEARER };
    });
    live.start();
    fake.connection().startDevice().close(1001);
    fake.clock.advance(60_000);
    expect(fake.connections.length).toBeGreaterThanOrEqual(2);
    expect(fake.connections.map((connection) => connection.headers.authorization?.slice(0, 11))).toEqual(
      expect.arrayContaining(['Bearer dvc_', 'Bearer ses_']),
    );
    live.stop();
    fake.assertNoViolations();
  });
});
