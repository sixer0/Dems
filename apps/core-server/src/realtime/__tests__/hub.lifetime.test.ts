// The hub: one socket's lifetime, the caps, the heartbeat, the ping, the close deadline, the stop
// and the client messages (plan row W42; spec §9.1, §9.2, §9.4; SR-40, SR-42, SR-51; AC-B-42,
// AC-B-85). No socket and no database: a recording transport, a manual clock, an engine with a
// real simulator state. The same rules run over real sockets in the `*.db.test.ts` files.
import {
  HEARTBEAT_INTERVAL_MS,
  REALTIME_CLIENT_MESSAGE_LIMIT,
  REALTIME_CONNECTION_ID_PATTERN,
  REPLICATED_SLICE_NAMES,
  type HelloMessage,
  type Heartbeat,
  type SnapshotMessage,
} from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { ClientMessageRefusal } from '../hub-types';
import { CLOSE_REASON, REALTIME_CLOSE_GRACE_MS } from '../limits';
import { ANONYMOUS, CLOCK_START, deviceAdmission, frame, operatorAdmission, testHub } from './hub-support';

const helloOf = (messages: readonly unknown[]): HelloMessage => messages[0] as HelloMessage;

describe('one socket: what it is sent when it opens', () => {
  it('ANONYMOUS: hello with the heartbeat topic, then a connect-time heartbeat without a session state, and nothing else', async () => {
    const { open, engine } = await testHub();
    const { transport } = open(ANONYMOUS);
    expect(transport.types()).toEqual(['hello', 'heartbeat']);
    const [hello, heartbeat] = transport.messages() as [HelloMessage, Heartbeat];
    expect(hello).toEqual({
      type: 'hello',
      v: 1,
      connectionId: hello.connectionId,
      epoch: engine.epoch,
      principal: 'ANONYMOUS',
      topics: ['heartbeat'],
      serverTime: CLOCK_START,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    });
    expect(hello.connectionId).toMatch(REALTIME_CONNECTION_ID_PATTERN);
    expect(heartbeat).toEqual({
      type: 'heartbeat',
      v: 1,
      seq: 0,
      serverTime: new Date(CLOCK_START).toISOString(),
      uptimeMs: 0,
      intervalMs: 1000,
      clients: 1,
      sessionState: null,
    });
    expect(transport.closed).toBeNull();
  });

  it('a cookie that no longer resolves: the same, with hello.reason SESSION_INVALID, and the socket stays open', async () => {
    const { open } = await testHub();
    const { transport } = open({ kind: 'ANONYMOUS', reason: 'SESSION_INVALID', closeCode: null });
    expect(transport.types()).toEqual(['hello', 'heartbeat']);
    expect(helloOf(transport.messages())).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID', topics: ['heartbeat'] });
    expect(transport.closed).toBeNull();
  });

  it('DEVICE: hello with heartbeat and control, then the heartbeat without a session state', async () => {
    const { open } = await testHub({ scenario: 'recording' });
    const { transport } = open(deviceAdmission());
    expect(transport.types()).toEqual(['hello', 'heartbeat']);
    const [hello, heartbeat] = transport.messages() as [HelloMessage, Heartbeat];
    expect(hello).toMatchObject({ principal: 'DEVICE', topics: ['heartbeat', 'control'] });
    expect('reason' in hello).toBe(false);
    expect(heartbeat.sessionState).toBeNull();
  });

  it('OPERATOR: hello, ONE snapshot of the 28 slices at the engine\'s position, then the heartbeat with the real session state', async () => {
    const { open, engine } = await testHub({ scenario: 'recording' });
    const { transport } = open(operatorAdmission());
    expect(transport.types()).toEqual(['hello', 'snapshot', 'heartbeat']);
    const [hello, snapshot, heartbeat] = transport.messages() as [HelloMessage, SnapshotMessage, Heartbeat];
    expect(hello).toMatchObject({ principal: 'OPERATOR', topics: ['heartbeat', 'control', 'state', 'meters'], epoch: engine.epoch });
    expect(snapshot.epoch).toBe(engine.epoch);
    expect(snapshot.revision).toBe(engine.revision);
    expect(snapshot.serverTime).toBe(CLOCK_START);
    expect(Object.keys(snapshot.state).sort()).toEqual([...REPLICATED_SLICE_NAMES].sort());
    expect(snapshot.state).toEqual(JSON.parse(JSON.stringify(engine.state())));
    expect(heartbeat.sessionState).toBe('RECORDING');
    expect(engine.state().session?.state).toBe('RECORDING');
  });

  it('an OPERATOR with USER_ADMIN or PAIRING_MANAGE is also given the admin topic', async () => {
    const { open } = await testHub();
    const { transport } = open(operatorAdmission({ role: 'SUPERVISOR', operatorId: 'OPR-002', sessionId: 'session-2' }));
    expect(helloOf(transport.messages()).topics).toEqual(['heartbeat', 'control', 'state', 'meters', 'admin']);
  });

  it('while the engine does not run an OPERATOR gets hello and the heartbeat; the snapshot comes with the start', async () => {
    const { open, engine, hub, clock } = await testHub();
    engine.stop();
    const { transport } = open(operatorAdmission());
    expect(transport.types()).toEqual(['hello', 'heartbeat']);
    expect((transport.messages()[1] as Heartbeat).sessionState).toBeNull();
    hub.publish({ kind: 'state', change: engine.start(clock.now()) });
    expect(transport.types()).toEqual(['hello', 'heartbeat', 'snapshot']);
    expect(transport.messages()[2]).toMatchObject({ epoch: engine.epoch, revision: 0 });
  });

  it('a bearer value that did not resolve: hello with the reason, then close 4401; nothing more, and it counts nowhere', async () => {
    const { open, hub } = await testHub();
    const { transport } = open({ kind: 'ANONYMOUS', reason: 'SESSION_INVALID', closeCode: 4401 });
    expect(transport.types()).toEqual(['hello']);
    expect(helloOf(transport.messages())).toMatchObject({ principal: 'ANONYMOUS', reason: 'SESSION_INVALID', topics: ['heartbeat'] });
    expect(transport.closed).toEqual({ code: 4401, reason: CLOSE_REASON.CREDENTIAL });
    hub.beat();
    expect(transport.types()).toEqual(['hello']);
    expect(hub.stats()).toMatchObject({ connections: 0, anonymous: 0, sockets: 1 });
  });

  it('a bearer value of a retired device: hello with DEVICE_REVOKED, then close 4403', async () => {
    const { open } = await testHub();
    const { transport } = open({ kind: 'ANONYMOUS', reason: 'DEVICE_REVOKED', closeCode: 4403 });
    expect(transport.types()).toEqual(['hello']);
    expect(helloOf(transport.messages())).toMatchObject({ principal: 'ANONYMOUS', reason: 'DEVICE_REVOKED' });
    expect(transport.closed).toEqual({ code: 4403, reason: CLOSE_REASON.DEVICE_REVOKED });
  });

  it('every connection has its own ID, and the log names a socket by that ID and a principal reference only', async () => {
    const { open, log } = await testHub();
    const first = open(ANONYMOUS);
    const second = open(operatorAdmission());
    const third = open(deviceAdmission('DEV-0007'));
    const ids = [first, second, third].map((entry) => entry.handle.connectionId);
    expect(new Set(ids).size).toBe(3);
    const opened = log.lines.filter((line) => line.message === 'socket opened');
    expect(opened.map((line) => line.fields)).toEqual([
      { connectionId: ids[0], principal: null, kind: 'ANONYMOUS' },
      { connectionId: ids[1], principal: 'operator:OPR-001', kind: 'OPERATOR' },
      { connectionId: ids[2], principal: 'device:DEV-0007', kind: 'DEVICE' },
    ]);
  });
});

describe('the caps: 16 connections, of which 6 anonymous (RT-P6, SR-42, AC-B-85)', () => {
  it('the seventh anonymous socket is closed with 1013 and gets nothing, while an operator and a device are accepted', async () => {
    const { open, hub } = await testHub();
    const six = Array.from({ length: 6 }, () => open(ANONYMOUS));
    expect(six.every((entry) => entry.transport.closed === null)).toBe(true);
    const seventh = open(ANONYMOUS);
    expect(seventh.transport.closed).toEqual({ code: 1013, reason: CLOSE_REASON.CAP });
    expect(seventh.transport.sent).toEqual([]);
    const dead = open({ kind: 'ANONYMOUS', reason: 'SESSION_INVALID', closeCode: null });
    expect(dead.transport.closed?.code).toBe(1013);

    const device = open(deviceAdmission());
    const operator = open(operatorAdmission());
    expect(operator.transport.closed).toBeNull();
    expect(device.transport.closed).toBeNull();
    expect(device.transport.types()).toEqual(['hello', 'heartbeat']);
    expect(operator.transport.types()).toEqual(['hello', 'snapshot', 'heartbeat']);
    expect(hub.stats()).toMatchObject({ connections: 8, anonymous: 6, operators: 1, devices: 1, refusedByCap: 2 });
  });

  it('a bearer value that does not resolve is told so, also while the anonymous places are taken', async () => {
    const { open } = await testHub();
    for (let index = 0; index < 6; index += 1) open(ANONYMOUS);
    const refused = open({ kind: 'ANONYMOUS', reason: 'SESSION_INVALID', closeCode: 4401 });
    expect(refused.transport.types()).toEqual(['hello']);
    expect(refused.transport.closed?.code).toBe(4401);
  });

  it('the 17th connection of any kind is closed with 1013', async () => {
    const { open, hub } = await testHub();
    for (let index = 0; index < 6; index += 1) open(ANONYMOUS);
    for (let index = 0; index < 10; index += 1) open(operatorAdmission({ sessionId: `session-${index}` }));
    expect(hub.stats().connections).toBe(16);
    for (const admission of [operatorAdmission({ sessionId: 'session-17' }), deviceAdmission(), ANONYMOUS]) {
      const beyond = open(admission);
      expect(beyond.transport.closed).toEqual({ code: 1013, reason: CLOSE_REASON.CAP });
      expect(beyond.transport.sent).toEqual([]);
    }
    expect(hub.stats().connections).toBe(16);
  });

  it('a socket that closed, or that the server is closing, frees its place at once', async () => {
    const { open, hub } = await testHub();
    const six = Array.from({ length: 6 }, () => open(ANONYMOUS));
    six[0]?.handle.closed(1000);
    expect(hub.stats()).toMatchObject({ anonymous: 5, sockets: 5 });
    expect(open(ANONYMOUS).transport.closed).toBeNull();
    // The server closes one (a protocol violation): its place is free before the peer answers.
    six[1]?.handle.receive(frame({ type: 'resync' }), false);
    expect(six[1]?.transport.closed?.code).toBe(1008);
    expect(hub.stats()).toMatchObject({ anonymous: 5, sockets: 6 });
    expect(open(ANONYMOUS).transport.closed).toBeNull();
    expect(open(ANONYMOUS).transport.closed?.code).toBe(1013);
  });

  it('the cap refusal is logged with the counts and no credential', async () => {
    const { open, log } = await testHub();
    for (let index = 0; index < 7; index += 1) open(ANONYMOUS);
    const line = log.lines.find((entry) => entry.message === 'socket refused: connection cap');
    expect(line?.level).toBe('warn');
    expect(line?.fields).toMatchObject({ code: 1013, principal: 'ANONYMOUS', open: 6, anonymous: 6 });
  });
});

describe('the heartbeat (RT-P1)', () => {
  it('goes to every open socket with a growing seq, the server time, the uptime and the number of clients', async () => {
    const { open, hub, clock } = await testHub({ scenario: 'recording' });
    const anonymous = open(ANONYMOUS);
    const device = open(deviceAdmission());
    const operator = open(operatorAdmission());
    for (const entry of [anonymous, device, operator]) entry.transport.clear();

    clock.advance(1000);
    hub.beat();
    clock.advance(1000);
    hub.beat();
    for (const entry of [anonymous, device, operator]) expect(entry.transport.types()).toEqual(['heartbeat', 'heartbeat']);
    const beats = operator.transport.messages() as Heartbeat[];
    expect(beats.map((beat) => beat.seq)).toEqual([1, 2]);
    expect(beats.map((beat) => beat.uptimeMs)).toEqual([1000, 2000]);
    expect(beats.map((beat) => beat.serverTime)).toEqual([new Date(CLOCK_START + 1000).toISOString(), new Date(CLOCK_START + 2000).toISOString()]);
    expect(beats.every((beat) => beat.clients === 3 && beat.intervalMs === 1000)).toBe(true);
    // Only an OPERATOR is told the session state (SR-40).
    expect(beats.every((beat) => beat.sessionState === 'RECORDING')).toBe(true);
    expect((anonymous.transport.messages() as Heartbeat[]).every((beat) => beat.sessionState === null)).toBe(true);
    expect((device.transport.messages() as Heartbeat[]).every((beat) => beat.sessionState === null)).toBe(true);
    expect(hub.stats().beats).toBe(2);
  });

  it('a socket that is being closed gets no heartbeat', async () => {
    const { open, hub } = await testHub();
    const { transport, handle } = open(ANONYMOUS);
    handle.receive(frame('not json'), false);
    transport.clear();
    hub.beat();
    expect(transport.sent).toEqual([]);
  });
});

describe('the protocol ping (RT-P3)', () => {
  it('pings every socket; a socket that answered is pinged again, one that did not is destroyed', async () => {
    const { open, hub, log } = await testHub();
    const answering = open(ANONYMOUS);
    const silent = open(deviceAdmission());
    hub.ping();
    expect([answering.transport.pings, silent.transport.pings]).toEqual([1, 1]);
    answering.handle.pong();
    hub.ping();
    expect([answering.transport.pings, silent.transport.pings]).toEqual([2, 1]);
    expect(answering.transport.terminated).toBe(false);
    expect(silent.transport.terminated).toBe(true);
    expect(hub.stats()).toMatchObject({ connections: 1, devices: 0 });
    expect(log.lines.some((line) => line.message === 'socket destroyed: no answer to the last ping')).toBe(true);
    // A healthy link stays open ping after ping (AC-B-48).
    for (let round = 0; round < 5; round += 1) {
      answering.handle.pong();
      hub.ping();
    }
    expect(answering.transport.terminated).toBe(false);
    expect(answering.transport.closed).toBeNull();
  });
});

describe('the close deadline (RT-P12)', () => {
  it('a socket the server closed is destroyed at the pace step that finds the grace passed, and not before', async () => {
    const { open, hub, clock } = await testHub();
    const { transport, handle } = open(ANONYMOUS);
    handle.receive(frame({ type: 'resync' }), false);
    expect(transport.closed?.code).toBe(1008);
    clock.advance(REALTIME_CLOSE_GRACE_MS - 1);
    hub.pace();
    expect(transport.terminated).toBe(false);
    clock.advance(1);
    hub.pace();
    expect(transport.terminated).toBe(true);
    expect(hub.stats()).toMatchObject({ terminated: 1, sockets: 1 });
    // Destroyed once: a later step does not count it again, and the close event forgets it.
    hub.pace();
    expect(hub.stats().terminated).toBe(1);
    handle.closed(1006);
    expect(hub.stats().sockets).toBe(0);
  });

  it('a socket that answered the close frame in time is not destroyed', async () => {
    const { open, hub, clock } = await testHub();
    const { transport, handle } = open(ANONYMOUS);
    handle.receive(frame({ type: 'resync' }), false);
    handle.closed(1008);
    clock.advance(REALTIME_CLOSE_GRACE_MS);
    hub.pace();
    expect(transport.terminated).toBe(false);
    expect(hub.stats().terminated).toBe(0);
  });

  it('a socket that reported an error is given the grace, then destroyed; one that cannot be written to is destroyed at once', async () => {
    const { open, hub, clock, log } = await testHub();
    const failed = open(ANONYMOUS);
    failed.handle.failed();
    expect(failed.transport.terminated).toBe(false);
    expect(hub.stats().connections).toBe(0);
    clock.advance(REALTIME_CLOSE_GRACE_MS);
    hub.pace();
    expect(failed.transport.terminated).toBe(true);

    const gone = open(ANONYMOUS);
    gone.transport.failNextSend = true;
    hub.beat();
    expect(gone.transport.terminated).toBe(true);
    const line = log.lines.find((entry) => entry.message.startsWith('a message could not be queued'));
    expect(Object.keys(line?.fields ?? {}).sort()).toEqual(['connectionId', 'err']);
  });

  it('the log line of a closed socket names the code, who closed it, the principal reference and the duration', async () => {
    const { open, clock, log } = await testHub();
    const { handle } = open(operatorAdmission());
    clock.advance(4_200);
    handle.closed(1001);
    const line = log.lines.find((entry) => entry.message === 'socket closed');
    expect(line?.fields).toEqual({ connectionId: handle.connectionId, code: 1001, closedBy: 'peer', principal: 'operator:OPR-001', durationMs: 4_200 });
    // A second close event of the same socket is not a second line.
    handle.closed(1001);
    expect(log.lines.filter((entry) => entry.message === 'socket closed')).toHaveLength(1);
  });
});

describe('the stop (spec §8.6)', () => {
  it('closes every socket with 1001, admits no other, and destroys on request what is left', async () => {
    const { open, hub } = await testHub();
    const sockets = [open(ANONYMOUS), open(deviceAdmission()), open(operatorAdmission())];
    hub.shutdown();
    for (const entry of sockets) expect(entry.transport.closed).toEqual({ code: 1001, reason: CLOSE_REASON.SHUTDOWN });
    expect(hub.stats()).toMatchObject({ connections: 0, sockets: 3 });
    const late = open(operatorAdmission({ sessionId: 'late' }));
    expect(late.transport.closed).toEqual({ code: 1001, reason: CLOSE_REASON.SHUTDOWN });
    expect(late.transport.sent).toEqual([]);
    hub.terminateAll();
    for (const entry of [...sockets, late]) expect(entry.transport.terminated).toBe(true);
  });

  it('onChange tells a listener about every admission and every closing, and stops when asked', async () => {
    const { open, hub } = await testHub();
    let calls = 0;
    const stop = hub.onChange(() => {
      calls += 1;
    });
    const { handle } = open(ANONYMOUS);
    expect(calls).toBe(1);
    handle.closed(1000);
    expect(calls).toBe(2);
    stop();
    open(ANONYMOUS);
    expect(calls).toBe(2);
  });
});

describe('client messages (spec §9.4; RT-P5; SR-38, SR-51)', () => {
  const VIOLATIONS: ReadonlyArray<readonly [name: string, data: Buffer, binary: boolean, why: ClientMessageRefusal]> = [
    ['a binary frame', Buffer.from([1, 2, 3]), true, ClientMessageRefusal.NOT_TEXT],
    ['a valid message in a binary frame', frame({ type: 'resync' }), true, ClientMessageRefusal.NOT_TEXT],
    ['text that is not JSON', frame('resync'), false, ClientMessageRefusal.NOT_JSON],
    ['an empty frame', Buffer.alloc(0), false, ClientMessageRefusal.NOT_JSON],
    ['JSON that is no object', frame('"resync"'), false, ClientMessageRefusal.NOT_A_CLIENT_MESSAGE],
    ['an unknown type', frame({ type: 'ping' }), false, ClientMessageRefusal.NOT_A_CLIENT_MESSAGE],
    ['a server message', frame({ type: 'heartbeat', v: 1 }), false, ClientMessageRefusal.NOT_A_CLIENT_MESSAGE],
    ['a subscribe to another topic', frame({ type: 'subscribe', topic: 'state' }), false, ClientMessageRefusal.NOT_A_CLIENT_MESSAGE],
    ['a subscribe without a topic', frame({ type: 'subscribe' }), false, ClientMessageRefusal.NOT_A_CLIENT_MESSAGE],
    ['a resync with a token member', frame({ type: 'resync', token: 'marker-in-a-message' }), false, ClientMessageRefusal.NOT_A_CLIENT_MESSAGE],
    ['an authenticate message', frame({ type: 'authenticate', token: 'marker-in-a-message' }), false, ClientMessageRefusal.NOT_A_CLIENT_MESSAGE],
  ];

  it.each(VIOLATIONS)('%s closes an OPERATOR socket with 1008', async (_name, data, binary, why) => {
    const { open, log } = await testHub();
    const { transport, handle } = open(operatorAdmission());
    transport.clear();
    handle.receive(data, binary);
    expect(transport.closed).toEqual({ code: 1008, reason: CLOSE_REASON.VIOLATION });
    expect(transport.sent).toEqual([]);
    const line = log.lines.find((entry) => entry.message === 'socket closed: client message refused');
    expect(line?.fields).toEqual({ connectionId: handle.connectionId, code: 1008, refusal: why });
  });

  it('a message authenticates nothing and nothing of it reaches the log (SR-38, SR-51)', async () => {
    const { open, log, hub } = await testHub();
    const { transport, handle } = open(ANONYMOUS);
    handle.receive(frame({ type: 'authenticate', token: 'marker-in-a-message' }), false);
    expect(transport.closed?.code).toBe(1008);
    expect(hub.connections()[0]).toMatchObject({ principal: 'ANONYMOUS', operatorId: null, sessionId: null, deviceId: null });
    expect(JSON.stringify(log.lines)).not.toContain('marker-in-a-message');
  });

  it.each([
    ['subscribe', { type: 'subscribe', topic: 'meters' }],
    ['unsubscribe', { type: 'unsubscribe', topic: 'meters' }],
    ['resync', { type: 'resync' }],
  ] as const)('%s from an ANONYMOUS or a DEVICE socket closes it with 1008: only an OPERATOR may send', async (_type, message) => {
    for (const admission of [ANONYMOUS, deviceAdmission()]) {
      const { open, log } = await testHub();
      const { transport, handle } = open(admission);
      transport.clear();
      handle.receive(frame(message), false);
      expect(transport.closed?.code).toBe(1008);
      expect(transport.sent).toEqual([]);
      expect(log.lines.find((entry) => entry.message === 'socket closed: client message refused')?.fields).toMatchObject({ refusal: ClientMessageRefusal.NOT_ALLOWED });
    }
  });

  it('subscribe and unsubscribe switch the meters of an OPERATOR socket and are answered with nothing', async () => {
    const { open, hub } = await testHub();
    const { transport, handle } = open(operatorAdmission());
    transport.clear();
    expect(hub.connections()[0]?.meters).toBe(false);
    handle.receive(frame({ type: 'subscribe', topic: 'meters' }), false);
    handle.receive(frame({ type: 'subscribe', topic: 'meters' }), false);
    expect(hub.connections()[0]?.meters).toBe(true);
    handle.receive(frame({ type: 'unsubscribe', topic: 'meters' }), false);
    expect(hub.connections()[0]?.meters).toBe(false);
    expect(transport.sent).toEqual([]);
    expect(transport.closed).toBeNull();
  });

  it('30 messages in 10 s are accepted, the 31st closes with 1008; a window later the count starts again', async () => {
    expect(REALTIME_CLIENT_MESSAGE_LIMIT).toEqual({ count: 30, windowMs: 10_000 });
    const { open, clock, log } = await testHub();
    const { transport, handle } = open(operatorAdmission());
    const subscribe = frame({ type: 'subscribe', topic: 'meters' });
    for (let index = 0; index < 30; index += 1) {
      clock.advance(100);
      handle.receive(subscribe, false);
    }
    expect(transport.closed).toBeNull();
    // The messages arrived 100 ms apart from 100 ms on. 10 s after the first one it has left the
    // window, so one more fits, and the one after that does not.
    clock.advance(7_100);
    handle.receive(subscribe, false);
    expect(transport.closed).toBeNull();
    handle.receive(subscribe, false);
    expect(transport.closed).toEqual({ code: 1008, reason: CLOSE_REASON.VIOLATION });
    expect(log.lines.find((entry) => entry.message === 'socket closed: client message refused')?.fields).toMatchObject({ refusal: ClientMessageRefusal.RATE });
  });

  it('the window is 10 s to the millisecond: 30 messages at one instant block a 31st for 9,999 ms and no longer', async () => {
    const subscribe = frame({ type: 'subscribe', topic: 'meters' });
    for (const [waitMs, closed] of [
      [0, true],
      [9_999, true],
      [10_000, false],
    ] as const) {
      const { open, clock } = await testHub();
      const { transport, handle } = open(operatorAdmission());
      for (let index = 0; index < 30; index += 1) handle.receive(subscribe, false);
      expect(transport.closed).toBeNull();
      clock.advance(waitMs);
      handle.receive(subscribe, false);
      expect(transport.closed !== null, `after ${waitMs} ms`).toBe(closed);
    }
  });

  it('messages that are refused count too, and a socket that is being closed is not read any more', async () => {
    const { open, hub } = await testHub();
    const { transport, handle } = open(operatorAdmission());
    handle.receive(frame('x'), false);
    expect(transport.closed?.code).toBe(1008);
    handle.receive(frame({ type: 'subscribe', topic: 'meters' }), false);
    expect(hub.connections()[0]?.meters).toBe(false);
  });
});
