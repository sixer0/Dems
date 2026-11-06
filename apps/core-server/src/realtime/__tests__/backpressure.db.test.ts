// The send policy against a REAL stalled consumer, and the protocol ping against a real peer
// (plan row W42; spec §9.1 RT-P3, RT-P9, RT-P10, §9.3 RT-4, RT-8; AC-B-48).
//
// A client stops READING its TCP connection (it still writes). What the server sends then fills
// the kernel's buffers of that connection and, after them, the socket's own send buffer, which
// is the queue the policy looks at (`bufferedAmount`). The test measures:
//   - how much the kernel takes before the queue starts to grow;
//   - that above 65,536 queued bytes meter frames are skipped while state deltas are still queued;
//   - that above 4,194,304 queued bytes the connection is closed with 4408;
//   - that the client, once it reads again, receives every state message that was sent to it, in
//     order and without a gap, and then the close code 4408.
//
// REAL TIME. A socket's backpressure cannot be driven by a manual clock: the loops below wait
// for the server to have queued what the client asked for, one turn of the event loop at a time.
// Nothing sleeps for a fixed time; the server clock is manual as everywhere else.
import { connect } from 'node:net';
import { randomBytes } from 'node:crypto';
import type { Socket } from 'node:net';
import type { DeltaMessage, MetersMessage } from '@dems/shared/api';
import { ROLE_PERMISSIONS } from '@dems/shared/sim';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import type { Principal } from '../../plugins/authenticate';
import { REALTIME_HARD_BUFFER_BYTES, REALTIME_METER_SKIP_BYTES, REALTIME_PING_INTERVAL_MS } from '../limits';
import type { ConnectionSummary } from '../hub-types';
import { replay } from './hub-support';
import {
  SUPERVISOR,
  WEB_ORIGIN,
  eventually,
  operatorSocket,
  realtimeApp,
  setMeters,
  settle,
  untilSockets,
  useSockets,
  webHeaders,
  webOperator,
  type RealtimeApp,
  type TestSocket,
  type WebOperator,
} from '../../../test/support/realtime';

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

/** The TCP connection under a test socket: `pause()` stops reading, `resume()` reads again. */
const tcpOf = (socket: TestSocket): Socket => (socket.ws as unknown as { _socket: Socket })._socket;

function supervisorPrincipal(): Extract<Principal, { kind: 'OPERATOR' }> {
  return { kind: 'OPERATOR', operatorId: SUPERVISOR.id, sessionId: 'backpressure-test', deviceId: null, role: 'SUPERVISOR', permissions: ROLE_PERMISSIONS.SUPERVISOR };
}

describe('AC-B-48, RT-4, RT-P9, RT-P10: a client that stops reading', () => {
  it('loses meter frames and no state delta, is closed with 4408 above the hard limit, and reads every queued state message in order when it comes back', async () => {
    const stalled = await operatorSocket(rt, webHeaders(supervisor.cookie));
    const healthy = await operatorSocket(rt, webHeaders(supervisor.cookie));
    await setMeters(rt, stalled, true);
    await setMeters(rt, healthy, true);
    const stalledId = (await stalled.nextOf('hello')).connectionId;
    const summary = (): ConnectionSummary => {
      const found = rt.channel.connections().find((connection) => connection.connectionId === stalledId);
      if (found === undefined) throw new Error('the stalled connection is gone');
      return found;
    };
    let flip = 0;
    const command = async (): Promise<void> => {
      flip += 1;
      await rt.engine.command(supervisorPrincipal(), 'updateSettings', { timeFormat: flip % 2 === 0 ? '24' : '12' });
    };

    // While both read: meter frames reach both.
    await rt.drive(250);
    await settle(rt, stalled, healthy);
    const metersBeforeStall = summary().sent.meters;
    expect(metersBeforeStall).toBe(5);

    // The client stops reading. It asks for snapshots (one in 2 s of the server clock) until the
    // server's queue for it is above the meter threshold.
    tcpOf(stalled).pause();
    let sentWhileQueueEmpty = 0;
    let snapshotBytes = 0;
    const askSnapshot = async (): Promise<void> => {
      const before = summary().sent.snapshots;
      // The clock alone, not the channel's timers: a peer that does not read does not answer a
      // ping either, and two ping intervals would end it before its queue is full (the test below).
      rt.clock.advance(2_000);
      stalled.send({ type: 'resync' });
      await eventually('the server answering the resync', () => summary().closing !== null || summary().sent.snapshots === before + 1);
    };
    snapshotBytes = JSON.stringify(healthy.messages.find((message) => message.type === 'snapshot')).length;
    let asked = 0;
    while (summary().bufferedAmount <= REALTIME_METER_SKIP_BYTES) {
      if (summary().bufferedAmount === 0) sentWhileQueueEmpty = asked * snapshotBytes;
      await askSnapshot();
      asked += 1;
      expect(asked).toBeLessThan(400);
    }
    expect(summary().closing).toBeNull();

    // Above 65,536 queued bytes: meter frames are skipped for it, state deltas are still queued.
    const skippedBefore = summary().sent.metersSkipped;
    const deltasBefore = summary().sent.deltas;
    await rt.drive(500);
    for (let index = 0; index < 3; index += 1) await command();
    rt.channel.pace();
    expect(summary().sent.meters).toBe(metersBeforeStall);
    expect(summary().sent.metersSkipped - skippedBefore).toBe(10);
    expect(summary().sent.deltas - deltasBefore).toBeGreaterThanOrEqual(3);
    expect(summary().position?.revision).toBe(rt.engine.revision);
    expect(summary().closing).toBeNull();

    // It goes on until the queue is above the hard limit: closed with 4408.
    while (summary().closing === null) {
      await askSnapshot();
      asked += 1;
      expect(asked).toBeLessThan(400);
    }
    expect(summary().closing).toBe(4408);
    const atClose = summary();
    expect(atClose.bufferedAmount).toBeGreaterThan(REALTIME_HARD_BUFFER_BYTES);
    // The bound: the limit plus the one message that crossed it (a snapshot here).
    expect(atClose.bufferedAmount).toBeLessThanOrEqual(REALTIME_HARD_BUFFER_BYTES + 2 * snapshotBytes);
    const line = rt.log.lines().find((entry) => entry['msg'] === 'socket closed: slow consumer');
    expect(line).toMatchObject({ connectionId: stalledId, code: 4408 });
    expect(rt.channel.stats()).toMatchObject({ slowConsumers: 1, operators: 1 });

    // After the close nothing more is queued for it; the healthy socket goes on.
    await command();
    await rt.drive(250);
    rt.channel.pace();
    expect(summary().sent).toEqual(atClose.sent);

    // The client reads again: everything that was queued arrives in order, then the close code.
    tcpOf(stalled).resume();
    const closed = await stalled.closed;
    expect(closed.code).toBe(4408);
    const got = replay(stalled.messages);
    expect(got.revision).toBe(atClose.position?.revision);
    expect(stalled.types().filter((type) => type === 'snapshot')).toHaveLength(atClose.sent.snapshots);
    expect(stalled.types().filter((type) => type === 'delta')).toHaveLength(atClose.sent.deltas);
    // No state delta was dropped: its deltas are the healthy socket's, up to the revision of the close.
    await settle(rt, healthy);
    const deltasOf = (socket: TestSocket): DeltaMessage[] => socket.messages.filter((message): message is DeltaMessage => message.type === 'delta');
    const upTo = atClose.position?.revision ?? -1;
    const first = deltasOf(stalled)[0]?.revision ?? -1;
    expect(JSON.stringify(deltasOf(stalled))).toBe(JSON.stringify(deltasOf(healthy).filter((delta) => delta.revision >= first && delta.revision <= upTo)));
    expect(replay(healthy.messages).revision).toBe(rt.engine.revision);
    // Meter frames: the stalled socket got only those sent before its queue filled; the healthy one got every frame.
    const metersOf = (socket: TestSocket): MetersMessage[] => socket.messages.filter((message): message is MetersMessage => message.type === 'meters');
    expect(metersOf(stalled)).toHaveLength(metersBeforeStall);
    const healthySeqs = metersOf(healthy).map((frame) => frame.seq);
    expect(healthySeqs).toEqual(Array.from({ length: healthySeqs.length }, (_, index) => (healthySeqs[0] ?? 0) + index));
    expect(healthySeqs.length).toBe(metersBeforeStall + 10 + 5);

    console.info(
      `[w42] stalled consumer: snapshot ${snapshotBytes} bytes; the kernel took about ${sentWhileQueueEmpty} bytes before the queue grew; ` +
        `${atClose.sent.metersSkipped} meter frames skipped, ${atClose.sent.deltas} deltas and ${atClose.sent.snapshots} snapshots queued, none dropped; ` +
        `closed with 4408 at ${atClose.bufferedAmount} queued bytes (limit ${REALTIME_HARD_BUFFER_BYTES}) after ${asked} snapshots`,
    );
  });
});

describe('RT-P3, AC-B-48: the protocol ping', () => {
  it('a peer that answers stays open ping after ping; a peer that does not is destroyed at the second ping', async () => {
    const logMark = rt.log.lines().length;
    const healthy = await operatorSocket(rt, webHeaders(supervisor.cookie));
    const healthyId = (await healthy.nextOf('hello')).connectionId;
    let pings = 0;
    healthy.ws.on('ping', () => {
      pings += 1;
    });

    // A peer that completed the handshake and then says nothing: plain TCP, no socket library, so no pong.
    const silent = connect(rt.port, '127.0.0.1');
    silent.on('error', () => {});
    silent.on('data', () => {});
    silent.write(
      ['GET /ws HTTP/1.1', 'Host: 127.0.0.1', 'Connection: Upgrade', 'Upgrade: websocket', 'Sec-WebSocket-Version: 13', `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}`, `Origin: ${WEB_ORIGIN}`].join('\r\n') + '\r\n\r\n',
    );
    await untilSockets(rt, 2);
    const closedBySilent = new Promise<void>((resolve) => silent.once('close', () => resolve()));

    const alive = (): boolean | undefined => rt.channel.connections().find((connection) => connection.connectionId === healthyId)?.alive;
    for (let round = 1; round <= 3; round += 1) {
      rt.steps.advance(REALTIME_PING_INTERVAL_MS);
      await eventually(`the pong of round ${round}`, () => alive() === true);
      expect(pings).toBe(round);
      // After the second round the silent peer is gone; the one that answers stays.
      if (round === 2) {
        await untilSockets(rt, 1);
        await closedBySilent;
      }
    }
    expect(healthy.ws.readyState).toBe(healthy.ws.OPEN);
    expect(rt.channel.stats()).toMatchObject({ connections: 1, sockets: 1 });
    expect(rt.log.lines().slice(logMark).filter((line) => line['msg'] === 'socket destroyed: no answer to the last ping')).toHaveLength(1);
    // Whatever the heartbeats in between did, the healthy socket never missed a state message.
    await settle(rt, healthy);
    expect(replay(healthy.messages).revision).toBe(rt.engine.revision);
  });
});
