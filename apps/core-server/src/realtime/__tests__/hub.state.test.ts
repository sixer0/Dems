// The hub: snapshot then deltas, the order, the pacing, resync, meter frames and the send policy
// (plan row W42; spec §9.1 RT-P8 to RT-P11, §9.3 RT-1 to RT-8; AC-B-46, AC-B-48). No socket and
// no database: the changes are those of a real simulator, published as the engine host
// publishes them, and each socket is replayed as a client would apply what it was sent.
import { REALTIME_RESYNC_MIN_INTERVAL_MS, type DeltaMessage, type MetersMessage, type SnapshotMessage } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import type { EngineStateChange } from '../../engine';
import { CLOSE_REASON, REALTIME_HARD_BUFFER_BYTES, REALTIME_METER_SKIP_BYTES, REALTIME_METER_WIRE_RATE_HZ } from '../limits';
import { ANONYMOUS, CLOCK_START, deviceAdmission, fakeTransport, frame, operatorAdmission, replay, testHub, wire, type TestHub } from './hub-support';

const investigator = (test: TestHub) => test.engine.host.operator('INVESTIGATOR');
/** One command of the recording scenario: a marker, as the investigator. */
const addMarker = (test: TestHub, label: string): void => {
  test.engine.host.runAs(investigator(test), () => test.engine.host.sim.actions.addMarker(label));
};
const deltasOf = (messages: readonly unknown[]): DeltaMessage[] => messages.filter((message): message is DeltaMessage => (message as { type: string }).type === 'delta');
const RESYNC = frame({ type: 'resync' });
const SUBSCRIBE = frame({ type: 'subscribe', topic: 'meters' });

describe('snapshot, then deltas in commit order without a gap (RT-1, RT-2, AC-B-46)', () => {
  it('every committed change reaches every OPERATOR socket as the next revision; replayed, each socket holds the engine\'s state', async () => {
    const test = await testHub({ scenario: 'recording' });
    const first = test.open(operatorAdmission());
    const second = test.open(operatorAdmission({ operatorId: 'OPR-002', sessionId: 'session-2', role: 'SUPERVISOR' }));
    const start = test.engine.revision;

    const changes: EngineStateChange[] = [];
    for (let step = 0; step < 6; step += 1) {
      addMarker(test, `Marker ${step}`);
      const command = test.commit('command');
      test.clock.advance(1000);
      test.engine.host.drive(1000);
      const tick = test.commit('tick');
      for (const change of [command, tick]) if (change !== null) changes.push(change);
    }
    expect(changes.length).toBe(12);
    expect(changes.map((change) => change.revision)).toEqual(Array.from({ length: 12 }, (_, index) => start + 1 + index));

    for (const socket of [first, second]) {
      const messages = socket.transport.messages();
      const replayed = replay(messages);
      expect(replayed.revisions).toEqual(Array.from({ length: 13 }, (_, index) => start + index));
      expect(replayed.revision).toBe(test.engine.revision);
      expect(replayed.state).toEqual(wire(test.engine.state()));
      // serverTime of a delta is the server clock at its commit.
      expect(deltasOf(messages).map((delta) => delta.serverTime)).toEqual(changes.map((change) => change.at));
      expect(deltasOf(messages).every((delta) => delta.epoch === test.engine.epoch)).toBe(true);
    }
    expect(test.hub.stats().healed).toBe(0);
  });

  it('the ops of a delta are the engine\'s, unchanged, and the engine\'s state is not altered by sending it', async () => {
    const test = await testHub({ scenario: 'recording' });
    const { transport } = test.open(operatorAdmission());
    const before = JSON.stringify(test.engine.state());
    addMarker(test, 'Key statement');
    const change = test.commit('command');
    if (change === null) throw new Error('the marker changed nothing');
    const after = JSON.stringify(test.engine.state());
    const [delta] = deltasOf(transport.messages());
    expect(delta?.ops).toEqual(wire(change.ops));
    expect(delta).toMatchObject({ type: 'delta', v: 1, epoch: change.epoch, revision: change.revision, serverTime: change.at });
    expect(JSON.stringify(test.engine.state())).toBe(after);
    expect(after).not.toBe(before);
  });

  it('a socket that opens between two commits starts at the engine\'s revision and is sent only what comes after', async () => {
    const test = await testHub({ scenario: 'recording' });
    const early = test.open(operatorAdmission());
    addMarker(test, 'Before the second socket');
    test.commit('command');
    const late = test.open(operatorAdmission({ sessionId: 'session-2' }));
    const joinedAt = test.engine.revision;
    addMarker(test, 'After the second socket');
    test.commit('command');

    expect(replay(early.transport.messages()).revisions).toEqual([joinedAt - 1, joinedAt, joinedAt + 1]);
    expect(replay(late.transport.messages()).revisions).toEqual([joinedAt, joinedAt + 1]);
    expect(replay(late.transport.messages()).state).toEqual(wire(test.engine.state()));
  });

  it('state messages go to OPERATOR sockets only: an ANONYMOUS and a DEVICE socket get none', async () => {
    const test = await testHub({ scenario: 'recording' });
    const anonymous = test.open(ANONYMOUS);
    const device = test.open(deviceAdmission());
    const operator = test.open(operatorAdmission());
    addMarker(test, 'Marker');
    test.commit('command');
    test.hub.publish({ kind: 'state', change: test.engine.start(test.clock.now()) });
    test.hub.pace();
    expect(anonymous.transport.types()).toEqual(['hello', 'heartbeat']);
    expect(device.transport.types()).toEqual(['hello', 'heartbeat']);
    expect(operator.transport.types()).toEqual(['hello', 'snapshot', 'heartbeat', 'delta', 'snapshot']);
  });

  it('with no OPERATOR socket a change costs nothing and nothing waits for the one that connects next', async () => {
    const test = await testHub({ scenario: 'idle' });
    test.engine.host.drive(1000);
    test.commit('tick');
    expect(test.hub.stats().heldDeltas).toBe(0);
    const { transport } = test.open(operatorAdmission());
    test.hub.pace();
    expect(transport.types()).toEqual(['hello', 'snapshot', 'heartbeat']);
    expect((transport.messages()[1] as SnapshotMessage).revision).toBe(test.engine.revision);
  });

  it('a delta that would not continue a socket\'s position is never sent: the socket gets a snapshot, and no gap is on the wire', async () => {
    const test = await testHub({ scenario: 'recording' });
    const { transport } = test.open(operatorAdmission());
    addMarker(test, 'Lost');
    // A change the hub is not told about, as if a publication had been lost.
    test.engine.commit('command', test.clock.now());
    addMarker(test, 'Published');
    test.commit('command');
    expect(transport.types()).toEqual(['hello', 'snapshot', 'heartbeat', 'snapshot']);
    expect(test.hub.stats().healed).toBe(1);
    const replayed = replay(transport.messages());
    expect(replayed.revision).toBe(test.engine.revision);
    expect(replayed.state).toEqual(wire(test.engine.state()));
    expect(test.log.lines.some((line) => line.level === 'warn' && line.message.startsWith('a delta did not continue'))).toBe(true);
    // From the healing snapshot on, deltas continue.
    addMarker(test, 'Next');
    test.commit('command');
    expect(replay(transport.messages()).revision).toBe(test.engine.revision);
    expect(test.hub.stats().healed).toBe(1);
  });
});

describe('a new epoch (RT-7)', () => {
  it('a start sends one snapshot of the new epoch at revision 0 to every OPERATOR socket, and deltas continue from it', async () => {
    const test = await testHub({ scenario: 'recording' });
    const first = test.open(operatorAdmission());
    const second = test.open(operatorAdmission({ sessionId: 'session-2' }));
    addMarker(test, 'Old epoch');
    test.commit('command');
    const oldEpoch = test.engine.epoch;

    test.clock.advance(5_000);
    test.hub.publish({ kind: 'state', change: test.engine.start(test.clock.now()) });
    for (const socket of [first, second]) {
      const last = socket.transport.messages().at(-1) as SnapshotMessage;
      expect(last).toMatchObject({ type: 'snapshot', epoch: oldEpoch + 1, revision: 0, serverTime: CLOCK_START + 5_000 });
      expect(last.state).toEqual(wire(test.engine.state()));
    }
    addMarker(test, 'New epoch');
    test.commit('command');
    const replayed = replay(first.transport.messages());
    expect([replayed.epoch, replayed.revision]).toEqual([oldEpoch + 1, 1]);
    expect(replayed.state).toEqual(wire(test.engine.state()));
  });

  it('paced deltas of the old epoch that still waited are not sent after the snapshot of the new one', async () => {
    const test = await testHub({ scenario: 'idle' });
    const { transport } = test.open(operatorAdmission());
    test.engine.host.drive(1000);
    expect(test.commit('tick')?.records).toBe(false);
    expect(test.hub.stats().heldDeltas).toBe(1);
    test.hub.publish({ kind: 'state', change: test.engine.start(test.clock.now()) });
    expect(test.hub.stats().heldDeltas).toBe(0);
    test.hub.pace();
    expect(transport.types()).toEqual(['hello', 'snapshot', 'heartbeat', 'snapshot']);
    expect(replay(transport.messages())).toMatchObject({ epoch: test.engine.epoch, revision: 0 });
  });
});

describe('delta pacing (RT-P11)', () => {
  it('a delta caused only by the 1 Hz steps waits for the pace step; a command or a record change is sent at once', async () => {
    const test = await testHub({ scenario: 'idle' });
    const { transport } = test.open(operatorAdmission());
    transport.clear();

    test.engine.host.drive(1000);
    const tick = test.commit('tick');
    expect(tick).toMatchObject({ cause: 'tick', records: false });
    expect(transport.sent).toEqual([]);
    expect(test.hub.stats().heldDeltas).toBe(1);
    test.hub.pace();
    expect(deltasOf(transport.messages()).map((delta) => delta.revision)).toEqual([tick?.revision]);
    expect(test.hub.stats().heldDeltas).toBe(0);

    test.engine.host.sim.actions.setPresentationMode(true);
    const command = test.commit('command');
    expect(deltasOf(transport.messages()).map((delta) => delta.revision)).toEqual([tick?.revision, command?.revision]);
  });

  it('a delta of any other cause is sent at once, also when no record changed: a command is read back by its caller (RT-5)', async () => {
    for (const cause of ['command', 'native', 'operators', 'stop'] as const) {
      const test = await testHub({ scenario: 'idle' });
      const { transport } = test.open(operatorAdmission());
      transport.clear();
      // A second of the simulator changes only snapshot slices; the cause is what the unit was.
      test.engine.host.drive(1000);
      const change = test.commit(cause);
      expect(change, cause).toMatchObject({ cause, records: false });
      expect(deltasOf(transport.messages()).map((delta) => delta.revision), cause).toEqual([change?.revision]);
      expect(test.hub.stats().heldDeltas).toBe(0);
    }
  });

  it('a tick that changed a record is not paced', async () => {
    const test = await testHub({ scenario: 'recording' });
    const { transport } = test.open(operatorAdmission());
    transport.clear();
    test.engine.host.drive(1000);
    const tick = test.commit('tick');
    expect(tick).toMatchObject({ cause: 'tick', records: true });
    expect(deltasOf(transport.messages()).map((delta) => delta.revision)).toEqual([tick?.revision]);
  });

  it('what waits is sent first, in order, when a delta that may not wait arrives: the order on the wire is the commit order', async () => {
    const test = await testHub({ scenario: 'idle' });
    const { transport } = test.open(operatorAdmission());
    const start = test.engine.revision;
    for (let second = 0; second < 3; second += 1) {
      test.engine.host.drive(1000);
      test.commit('tick');
    }
    expect(test.hub.stats().heldDeltas).toBe(3);
    expect(deltasOf(transport.messages())).toEqual([]);
    test.engine.host.sim.actions.setPresentationMode(true);
    test.commit('command');
    expect(deltasOf(transport.messages()).map((delta) => delta.revision)).toEqual([start + 1, start + 2, start + 3, start + 4]);
    expect(replay(transport.messages()).state).toEqual(wire(test.engine.state()));
    expect(test.hub.stats().heldDeltas).toBe(0);
  });

  it('a socket that opened while a delta waited holds it in its snapshot and is not sent it again', async () => {
    const test = await testHub({ scenario: 'idle' });
    const early = test.open(operatorAdmission());
    test.engine.host.drive(1000);
    const tick = test.commit('tick');
    const late = test.open(operatorAdmission({ sessionId: 'session-2' }));
    expect((late.transport.messages()[1] as SnapshotMessage).revision).toBe(tick?.revision);
    test.hub.pace();
    expect(deltasOf(early.transport.messages()).map((delta) => delta.revision)).toEqual([tick?.revision]);
    expect(deltasOf(late.transport.messages())).toEqual([]);
    expect(test.hub.stats().healed).toBe(0);
    for (const socket of [early, late]) expect(replay(socket.transport.messages()).state).toEqual(wire(test.engine.state()));
  });
});

describe('resync (RT-6)', () => {
  it('is answered with a new snapshot at the engine\'s position, and deltas continue from it', async () => {
    const test = await testHub({ scenario: 'recording' });
    const { transport, handle } = test.open(operatorAdmission());
    addMarker(test, 'One');
    test.commit('command');
    transport.clear();
    test.clock.advance(10);
    handle.receive(RESYNC, false);
    expect(transport.types()).toEqual(['snapshot']);
    const snapshot = transport.messages()[0] as SnapshotMessage;
    expect(snapshot).toMatchObject({ epoch: test.engine.epoch, revision: test.engine.revision, serverTime: CLOCK_START + 10 });
    expect(snapshot.state).toEqual(wire(test.engine.state()));
    addMarker(test, 'Two');
    test.commit('command');
    expect(replay(transport.messages()).state).toEqual(wire(test.engine.state()));
    expect(test.hub.stats().healed).toBe(0);
  });

  it('a resynchronised socket holds what a fresh socket holds', async () => {
    const test = await testHub({ scenario: 'recording' });
    const old = test.open(operatorAdmission());
    addMarker(test, 'One');
    test.commit('command');
    old.transport.clear();
    old.handle.receive(RESYNC, false);
    const fresh = test.open(operatorAdmission({ sessionId: 'session-2' }));
    expect((old.transport.messages()[0] as SnapshotMessage).state).toEqual((fresh.transport.messages()[1] as SnapshotMessage).state);
  });

  it('a delta that waited for the pace step is inside the snapshot of a resync and is not sent after it', async () => {
    const test = await testHub({ scenario: 'idle' });
    const { transport, handle } = test.open(operatorAdmission());
    test.engine.host.drive(1000);
    test.commit('tick');
    transport.clear();
    handle.receive(RESYNC, false);
    test.hub.pace();
    expect(transport.types()).toEqual(['snapshot']);
    expect(replay(transport.messages()).revision).toBe(test.engine.revision);
  });

  it('at most one snapshot in 2 s: a resync that comes sooner is answered once, at the pace step after the interval', async () => {
    expect(REALTIME_RESYNC_MIN_INTERVAL_MS).toBe(2_000);
    const test = await testHub({ scenario: 'recording' });
    const { transport, handle } = test.open(operatorAdmission());
    transport.clear();
    handle.receive(RESYNC, false);
    expect(transport.types()).toEqual(['snapshot']);

    test.clock.advance(500);
    handle.receive(RESYNC, false);
    handle.receive(RESYNC, false);
    expect(transport.types()).toEqual(['snapshot']);
    test.clock.advance(1_499);
    test.hub.pace();
    expect(transport.types()).toEqual(['snapshot']);
    test.clock.advance(1);
    test.hub.pace();
    expect(transport.types()).toEqual(['snapshot', 'snapshot']);
    test.hub.pace();
    expect(transport.types()).toEqual(['snapshot', 'snapshot']);
    expect(transport.closed).toBeNull();

    // Exactly the interval after the last answer, a resync is answered at once.
    test.clock.advance(REALTIME_RESYNC_MIN_INTERVAL_MS);
    handle.receive(RESYNC, false);
    expect(transport.types()).toEqual(['snapshot', 'snapshot', 'snapshot']);
  });

  it('while the engine does not run a resync is answered by the snapshot of its start', async () => {
    const test = await testHub({ scenario: 'recording' });
    const { transport, handle } = test.open(operatorAdmission());
    transport.clear();
    test.engine.stop();
    handle.receive(RESYNC, false);
    test.hub.pace();
    expect(transport.sent).toEqual([]);
    test.hub.publish({ kind: 'state', change: test.engine.start(test.clock.now()) });
    expect(transport.types()).toEqual(['snapshot']);
    test.hub.pace();
    expect(transport.types()).toEqual(['snapshot']);
  });
});

describe('meter frames (RT-8, RT-P8, RT-P9)', () => {
  const frameOf = (test: TestHub, seq: number) => ({ at: test.clock.now(), seq, audio: test.engine.host.state().audio });

  it('go only to OPERATOR sockets that subscribed, carry no revision, and stop with unsubscribe', async () => {
    const test = await testHub({ scenario: 'recording' });
    const subscribed = test.open(operatorAdmission());
    const silent = test.open(operatorAdmission({ sessionId: 'session-2' }));
    const device = test.open(deviceAdmission());
    const anonymous = test.open(ANONYMOUS);
    subscribed.handle.receive(SUBSCRIBE, false);
    for (const socket of [subscribed, silent, device, anonymous]) socket.transport.clear();

    test.hub.publish({ kind: 'meters', frame: frameOf(test, 1) });
    expect(subscribed.transport.types()).toEqual(['meters']);
    for (const socket of [silent, device, anonymous]) expect(socket.transport.sent).toEqual([]);
    const meters = subscribed.transport.messages()[0] as MetersMessage;
    expect(meters).toEqual({ type: 'meters', v: 1, at: test.clock.now(), seq: 1, audio: wire(test.engine.host.state().audio) });
    expect('revision' in meters).toBe(false);

    subscribed.handle.receive(frame({ type: 'unsubscribe', topic: 'meters' }), false);
    test.hub.publish({ kind: 'meters', frame: frameOf(test, 2) });
    expect(subscribed.transport.types()).toEqual(['meters']);
  });

  it('a frame is skipped for a socket whose buffer is above 65,536 bytes; the next frame that finds room is the newest', async () => {
    expect(REALTIME_METER_SKIP_BYTES).toBe(65_536);
    const test = await testHub({ scenario: 'recording' });
    const stalled = test.open(operatorAdmission());
    const healthy = test.open(operatorAdmission({ sessionId: 'session-2' }));
    for (const socket of [stalled, healthy]) {
      socket.handle.receive(SUBSCRIBE, false);
      socket.transport.clear();
    }

    stalled.transport.buffered = REALTIME_METER_SKIP_BYTES;
    test.hub.publish({ kind: 'meters', frame: frameOf(test, 1) });
    stalled.transport.buffered = REALTIME_METER_SKIP_BYTES + 1;
    for (const seq of [2, 3, 4]) {
      test.clock.advance(50);
      test.hub.publish({ kind: 'meters', frame: frameOf(test, seq) });
    }
    stalled.transport.buffered = 0;
    test.clock.advance(50);
    test.hub.publish({ kind: 'meters', frame: frameOf(test, 5) });

    const seqs = (socket: typeof stalled): number[] => (socket.transport.messages() as MetersMessage[]).map((message) => message.seq);
    expect(seqs(healthy)).toEqual([1, 2, 3, 4, 5]);
    expect(seqs(stalled)).toEqual([1, 5]);
    const summary = test.hub.connections().find((connection) => connection.connectionId === stalled.handle.connectionId);
    expect(summary?.sent).toMatchObject({ meters: 2, metersSkipped: 3 });
    expect(stalled.transport.closed).toBeNull();
  });

  it('a stalled socket loses meter frames and no state delta (AC-B-48)', async () => {
    const test = await testHub({ scenario: 'recording' });
    const { transport, handle } = test.open(operatorAdmission());
    handle.receive(SUBSCRIBE, false);
    transport.buffered = REALTIME_METER_SKIP_BYTES + 1;
    for (let step = 0; step < 5; step += 1) {
      test.clock.advance(50);
      test.hub.publish({ kind: 'meters', frame: frameOf(test, step + 1) });
      addMarker(test, `Marker ${step}`);
      test.commit('command');
    }
    expect(transport.types().filter((type) => type === 'meters')).toEqual([]);
    const replayed = replay(transport.messages());
    expect(replayed.revision).toBe(test.engine.revision);
    expect(replayed.state).toEqual(wire(test.engine.state()));
    expect(transport.closed).toBeNull();
  });

  it('at most 20 frames in a second of the server clock are put on the wire', async () => {
    expect(REALTIME_METER_WIRE_RATE_HZ).toBe(20);
    const test = await testHub({ scenario: 'recording' });
    const { transport, handle } = test.open(operatorAdmission());
    handle.receive(SUBSCRIBE, false);
    transport.clear();
    // 30 frames in 600 ms, then the rest of the second, then the next second.
    for (let seq = 1; seq <= 30; seq += 1) {
      test.hub.publish({ kind: 'meters', frame: frameOf(test, seq) });
      test.clock.advance(20);
    }
    expect(transport.sent).toHaveLength(20);
    expect(test.hub.stats().metersOverRate).toBe(10);
    test.clock.advance(399);
    test.hub.publish({ kind: 'meters', frame: frameOf(test, 31) });
    expect(transport.sent).toHaveLength(20);
    test.clock.advance(1);
    test.hub.publish({ kind: 'meters', frame: frameOf(test, 32) });
    expect(transport.sent).toHaveLength(21);
    // The engine's own cadence, one frame every 50 ms, passes whole.
    const steady = await testHub({ scenario: 'recording' });
    const socket = steady.open(operatorAdmission());
    socket.handle.receive(SUBSCRIBE, false);
    socket.transport.clear();
    for (let seq = 1; seq <= 60; seq += 1) {
      steady.hub.publish({ kind: 'meters', frame: frameOf(steady, seq) });
      steady.clock.advance(50);
    }
    expect(socket.transport.sent).toHaveLength(60);
    expect(steady.hub.stats().metersOverRate).toBe(0);
  });

  it('seq on the wire never goes back: when the engine counts from 1 again, the wire number continues', async () => {
    const test = await testHub({ scenario: 'recording' });
    const { transport, handle } = test.open(operatorAdmission());
    handle.receive(SUBSCRIBE, false);
    transport.clear();
    const publish = (seq: number): void => {
      test.clock.advance(50);
      test.hub.publish({ kind: 'meters', frame: frameOf(test, seq) });
    };
    for (const seq of [1, 2, 3]) publish(seq);
    // The engine was reloaded: its count starts at 1 again.
    test.hub.publish({ kind: 'state', change: test.engine.start(test.clock.now()) });
    for (const seq of [1, 2]) publish(seq);
    // A frame the wire rate or a full buffer skipped leaves a gap, by design.
    publish(4);
    expect((transport.messages().filter((message) => message.type === 'meters') as MetersMessage[]).map((message) => message.seq)).toEqual([1, 2, 3, 4, 5, 7]);
  });
});

describe('the send policy: a state message is never dropped, a slow consumer is closed (RT-4, RT-P10, AC-B-48)', () => {
  it('a socket whose buffer is above 4,194,304 bytes after a state message is closed with 4408; the message was queued before the close', async () => {
    expect(REALTIME_HARD_BUFFER_BYTES).toBe(4_194_304);
    const test = await testHub({ scenario: 'recording' });
    const slow = test.open(operatorAdmission());
    const healthy = test.open(operatorAdmission({ sessionId: 'session-2' }));

    slow.transport.buffered = REALTIME_HARD_BUFFER_BYTES;
    addMarker(test, 'At the limit');
    const atLimit = test.commit('command');
    expect(slow.transport.closed).toBeNull();

    slow.transport.buffered = REALTIME_HARD_BUFFER_BYTES + 1;
    addMarker(test, 'Over the limit');
    const over = test.commit('command');
    expect(slow.transport.closed).toEqual({ code: 4408, reason: CLOSE_REASON.SLOW_CONSUMER });
    expect(deltasOf(slow.transport.messages()).map((delta) => delta.revision)).toEqual([atLimit?.revision, over?.revision]);
    expect(test.hub.stats()).toMatchObject({ slowConsumers: 1, operators: 1 });

    // Nothing is sent to it afterwards; the healthy socket goes on without a gap.
    addMarker(test, 'After the close');
    test.commit('command');
    test.hub.beat();
    expect(deltasOf(slow.transport.messages())).toHaveLength(2);
    expect(replay(slow.transport.messages()).revision).toBe(over?.revision);
    const replayed = replay(healthy.transport.messages());
    expect(replayed.revision).toBe(test.engine.revision);
    expect(replayed.state).toEqual(wire(test.engine.state()));

    const line = test.log.lines.find((entry) => entry.message === 'socket closed: slow consumer');
    expect(line?.level).toBe('warn');
    expect(line?.fields).toEqual({ connectionId: slow.handle.connectionId, code: 4408, bufferedBytes: REALTIME_HARD_BUFFER_BYTES + 1 });
  });

  it('the pace step closes a socket whose buffer grew above the limit between two state messages', async () => {
    const test = await testHub({ scenario: 'recording' });
    const { transport } = test.open(operatorAdmission());
    transport.buffered = REALTIME_HARD_BUFFER_BYTES;
    test.hub.pace();
    expect(transport.closed).toBeNull();
    transport.buffered = REALTIME_HARD_BUFFER_BYTES + 1;
    test.hub.pace();
    expect(transport.closed?.code).toBe(4408);
  });

  it('a socket that is closed with 4408 in the middle of a flush is sent none of the deltas that follow', async () => {
    const test = await testHub({ scenario: 'idle' });
    const slow = test.open(operatorAdmission());
    const healthy = test.open(operatorAdmission({ sessionId: 'session-2' }));
    for (let second = 0; second < 3; second += 1) {
      test.engine.host.drive(1000);
      test.commit('tick');
    }
    expect(test.hub.stats().heldDeltas).toBe(3);
    slow.transport.buffered = REALTIME_HARD_BUFFER_BYTES + 1;
    test.hub.pace();
    expect(slow.transport.closed?.code).toBe(4408);
    expect(deltasOf(slow.transport.messages())).toHaveLength(1);
    expect(deltasOf(healthy.transport.messages())).toHaveLength(3);
    expect(replay(healthy.transport.messages()).state).toEqual(wire(test.engine.state()));
  });

  it('a socket whose FIRST snapshot crosses the limit is closed with 4408, is sent nothing after it, and never counts as a socket of its device', async () => {
    const test = await testHub({ scenario: 'recording' });
    const transport = fakeTransport();
    transport.buffered = REALTIME_HARD_BUFFER_BYTES + 1;
    const handle = test.hub.admit(operatorAdmission({ sessionId: 'dev-1', deviceId: 'DEV-0001' }), transport);
    expect(transport.types()).toEqual(['hello', 'snapshot']);
    expect(transport.closed?.code).toBe(4408);
    await test.hub.tabletLink.settled();
    expect(test.presence.online()).toEqual([]);
    expect(test.hub.tabletLink.open).toBe(0);
    expect(test.engine.linkCalls).toEqual([]);
    expect(test.hub.stats()).toMatchObject({ connections: 0, operators: 0, slowConsumers: 1 });
    // Another socket of the same device is not touched by the closing of that one.
    const other = test.open(deviceAdmission('DEV-0001'));
    await test.hub.tabletLink.settled();
    handle.closed(4408);
    expect(test.presence.isOnline('DEV-0001')).toBe(true);
    expect(test.hub.tabletLink.open).toBe(1);
    expect(other.transport.closed).toBeNull();
  });

  it('a snapshot is held to the same rule: after the first snapshot and after a resync', async () => {
    const test = await testHub({ scenario: 'recording' });
    const atOpen = test.open(operatorAdmission());
    expect(atOpen.transport.closed).toBeNull();

    const resyncing = test.open(operatorAdmission({ sessionId: 'session-2' }));
    resyncing.transport.buffered = REALTIME_HARD_BUFFER_BYTES + 1;
    resyncing.handle.receive(RESYNC, false);
    expect(resyncing.transport.types().filter((type) => type === 'snapshot')).toHaveLength(2);
    expect(resyncing.transport.closed?.code).toBe(4408);
  });

  it('an ANONYMOUS or a DEVICE socket is never closed for its buffer by the pace step: it is sent heartbeats only, and the ping ends a dead peer', async () => {
    const test = await testHub();
    const anonymous = test.open(ANONYMOUS);
    const device = test.open(deviceAdmission());
    for (const socket of [anonymous, device]) socket.transport.buffered = REALTIME_HARD_BUFFER_BYTES + 1;
    test.hub.pace();
    expect([anonymous.transport.closed, device.transport.closed]).toEqual([null, null]);
  });
});

describe('the seam never throws (the contract of `app.publish`)', () => {
  it('a socket that cannot be written to is destroyed and the other sockets are served', async () => {
    const test = await testHub({ scenario: 'recording' });
    const gone = test.open(operatorAdmission());
    const healthy = test.open(operatorAdmission({ sessionId: 'session-2' }));
    gone.transport.failNextSend = true;
    addMarker(test, 'Marker');
    expect(() => test.commit('command')).not.toThrow();
    expect(gone.transport.terminated).toBe(true);
    expect(replay(healthy.transport.messages()).revision).toBe(test.engine.revision);
  });

  it('a failure inside the hub is logged as { err } with the kind, written to the error log, and not passed on', async () => {
    const test = await testHub({ scenario: 'recording' });
    test.open(operatorAdmission());
    const broken = { kind: 'state', change: { epoch: 1, revision: 1, at: 0, cause: 'command', records: true, get ops(): never { throw new TypeError('ops cannot be read'); } } } as const;
    expect(() => test.hub.publish(broken as never)).not.toThrow();
    const line = test.log.lines.find((entry) => entry.level === 'error');
    expect(Object.keys(line?.fields ?? {}).sort()).toEqual(['err', 'kind']);
    expect(line?.fields['kind']).toBe('state');
    expect(test.log.persisted).toHaveLength(1);
    expect(test.log.persisted[0]).toMatchObject({ level: 'error', source: 'realtime.publish', errorName: 'TypeError', context: { kind: 'state' } });
  });
});
