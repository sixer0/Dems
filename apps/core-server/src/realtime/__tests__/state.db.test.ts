// State replication over REAL sockets with the REAL engine (plan row W42; spec §9.3 RT-1 to RT-8,
// §9.1 RT-P8, RT-P11; AC-B-46, AC-B-48). The app is booted on a seeded clone, so every change
// here is a unit of work committed to PostgreSQL and published by the engine host; the sockets
// are opened against a listener on an ephemeral loopback port. Time is manual: the engine ticks
// when the test fires its timer, the channel's steps fall due on the manual clock.
//
// Every frame every socket receives is parsed with the contract's union as it arrives; a frame
// that is not a message of it fails the test that received it (`useSockets`).
import type { Heartbeat, MetersMessage, SnapshotMessage } from '@dems/shared/api';
import { ROLE_PERMISSIONS, type OperatorRole } from '@dems/shared/sim';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import type { Principal } from '../../plugins/authenticate';
import { replay, wire } from './hub-support';
import {
  INVESTIGATOR,
  SUPERVISOR,
  deviceHeaders,
  deviceOperator,
  openSocket,
  operatorSocket,
  pairedDevice,
  realtimeApp,
  setMeters,
  settle,
  untilSockets,
  useSockets,
  webHeaders,
  webOperator,
  type DeviceOperator,
  type RealtimeApp,
  type TestSocket,
  type WebOperator,
} from '../../../test/support/realtime';

const db = useTestDatabase({ template: 'seed' });
let rt: RealtimeApp;
let supervisor: WebOperator;
let onTablet: DeviceOperator;

useSockets(() => rt);

beforeAll(async () => {
  rt = await realtimeApp(db);
  supervisor = await webOperator(rt, SUPERVISOR);
  onTablet = await deviceOperator(rt, await pairedDevice(rt, supervisor), INVESTIGATOR);
});

beforeEach(() => {
  rt.forgetCounters();
});

/** A principal as stage 4 builds it, for commands the test runs on the engine itself. */
function principal(role: OperatorRole): Extract<Principal, { kind: 'OPERATOR' }> {
  const operator = rt.engine.slice('operators').find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no operator with role ${role}`);
  return { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'state-test', deviceId: null, role, permissions: ROLE_PERMISSIONS[role] };
}

const SESSION_INPUT = {
  caseNumber: 'LP/2026/1004-0042',
  subjectType: 'SAKSI',
  subjectName: 'Test Subject',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;

/** What a socket holds after it applied everything it was sent, checked against the engine. */
function expectInSync(socket: TestSocket, label: string): void {
  const replayed = replay(socket.messages);
  expect([replayed.epoch, replayed.revision], label).toEqual([rt.engine.epoch, rt.engine.revision]);
  expect(replayed.state, label).toEqual(wire(rt.engine.state()));
}

describe('RT-1: after hello, one snapshot', () => {
  it('an OPERATOR socket is sent hello, the 30 slices at the engine\'s epoch and revision, then the heartbeat with the session state', async () => {
    const socket = await operatorSocket(rt, webHeaders(supervisor.cookie));
    expect(socket.types()).toEqual(['hello', 'snapshot', 'heartbeat']);
    const [hello, snapshot, heartbeat] = socket.messages as [{ epoch: number }, SnapshotMessage, Heartbeat];
    expect(hello.epoch).toBe(rt.engine.epoch);
    expect([snapshot.epoch, snapshot.revision]).toEqual([rt.engine.epoch, rt.engine.revision]);
    expect(snapshot.serverTime).toBe(rt.clock.now());
    expect(snapshot.state).toEqual(wire(rt.engine.state()));
    expect(heartbeat.sessionState).toBe(rt.engine.slice('session')?.state ?? null);
    for (const hidden of ['auth', 'authLockout', 'pairing', 'clock', 'audio']) expect(hidden in snapshot.state, hidden).toBe(false);
  });
});

describe('RT-2, RT-5, AC-B-46: a session from create to seal through the real engine', () => {
  it('every socket is sent every revision once, in commit order, without a gap, and holds the engine\'s state after each step', async () => {
    const investigator = principal('INVESTIGATOR');
    const web = await operatorSocket(rt, webHeaders(supervisor.cookie));
    const mobile = await operatorSocket(rt, deviceHeaders(onTablet.token));
    await setMeters(rt, mobile, true);
    const startRevision = replay(web.messages).revision;

    /** Runs one command; the delta that holds its effect has left for every socket when it resolves (RT-5). */
    const command = async (run: () => Promise<{ revision: number; epoch: number }>): Promise<void> => {
      const outcome = await run();
      expect(outcome.epoch).toBe(rt.engine.epoch);
      for (const connection of rt.channel.connections()) {
        if (connection.principal === 'OPERATOR') expect(connection.position?.revision ?? -1).toBeGreaterThanOrEqual(outcome.revision);
      }
    };
    const checkpoint = async (label: string, ...sockets: TestSocket[]): Promise<void> => {
      rt.channel.pace();
      await settle(rt, ...sockets);
      for (const socket of sockets) expectInSync(socket, label);
    };

    await command(() => rt.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId }));
    await command(() => rt.engine.command(investigator, 'beginPrecheck'));
    await checkpoint('after beginPrecheck', web, mobile);

    await rt.drive(5_000);
    if (rt.engine.slice('session')?.state === 'PRECHECK') await command(() => rt.engine.command(investigator, 'acknowledgePrecheckWarnings'));
    expect(rt.engine.slice('session')?.state).toBe('ARMED');
    await command(() => rt.engine.command(investigator, 'startRecording'));
    await checkpoint('after startRecording', web, mobile);

    // A socket that opens in the middle starts at the engine's revision.
    const late = await operatorSocket(rt, webHeaders(supervisor.cookie));
    const joinedAt = replay(late.messages).revision;
    expect(joinedAt).toBe(rt.engine.revision);

    await rt.drive(3_000);
    await command(() => rt.engine.command(investigator, 'addMarker', 'Key statement'));
    await command(() => rt.engine.command(investigator, 'addNote', 'Subject asked for a break'));
    await command(() => rt.engine.command(investigator, 'snapshot'));
    await checkpoint('during the recording', web, mobile, late);
    await command(() => rt.engine.command(investigator, 'stopRecording', 'Interview completed'));
    await rt.drive(20_000);
    expect(rt.engine.slice('session')?.state).toBe('SEALED');
    await command(() => rt.engine.command(investigator, 'acknowledgeSummary', rt.engine.slice('lastSealedSessionId') ?? ''));
    await checkpoint('after the seal', web, mobile, late);

    // Gap-free: every revision from the snapshot to the engine's, each exactly once (`replay`
    // throws at a delta that does not continue; the lists say the same in numbers).
    const end = rt.engine.revision;
    expect(end - startRevision).toBeGreaterThan(40);
    for (const socket of [web, mobile]) {
      expect(replay(socket.messages).revisions).toEqual(Array.from({ length: end - startRevision + 1 }, (_, index) => startRevision + index));
    }
    expect(replay(late.messages).revisions).toEqual(Array.from({ length: end - joinedAt + 1 }, (_, index) => joinedAt + index));
    expect(web.types().filter((type) => type === 'snapshot')).toHaveLength(1);
    expect(rt.channel.stats().healed).toBe(0);

    // The heartbeat told the operators the session state as it moved; the trail on both sockets is the same.
    const states = new Set((web.messages.filter((message) => message.type === 'heartbeat') as Heartbeat[]).map((beat) => beat.sessionState));
    for (const state of ['PRECHECK', 'RECORDING', 'SEALED']) expect(states.has(state as Heartbeat['sessionState']), state).toBe(true);
    const deltas = (socket: TestSocket): string => JSON.stringify(socket.messages.filter((message) => message.type === 'delta'));
    expect(deltas(mobile)).toBe(deltas(web));

    // RT-8: only the socket that subscribed got meter frames; they carry no revision and their seq grows.
    const meters = mobile.messages.filter((message) => message.type === 'meters') as MetersMessage[];
    expect(meters.length).toBeGreaterThan(100);
    expect(meters.every((frame, index) => index === 0 || frame.seq > (meters[index - 1]?.seq ?? 0))).toBe(true);
    expect(meters.every((frame) => !('revision' in frame))).toBe(true);
    expect(web.types()).not.toContain('meters');
    expect(late.types()).not.toContain('meters');
    console.info(
      `[w42] journey: revisions ${startRevision} to ${end} (${end - startRevision} deltas, 1 snapshot per socket), ${meters.length} meter frames to the subscriber, ` +
        `snapshot ${JSON.stringify(web.messages[1]).length} bytes, largest delta ${Math.max(...web.messages.filter((message) => message.type === 'delta').map((message) => JSON.stringify(message).length))} bytes`,
    );
  });
});

describe('RT-P8, RT-P11: the wire rate of meters and the pacing of the 1 Hz deltas, on the real engine', () => {
  it('a subscriber is sent 20 meter frames in a second of the server clock while the engine ticks at 50 ms', async () => {
    const socket = await operatorSocket(rt, webHeaders(supervisor.cookie));
    await setMeters(rt, socket, true);
    await settle(rt, socket);
    const before = socket.messages.length;
    await rt.drive(2_000);
    await settle(rt, socket);
    const frames = socket.messages.slice(before).filter((message) => message.type === 'meters') as MetersMessage[];
    expect(frames).toHaveLength(40);
    expect(frames.map((frame) => frame.seq)).toEqual(Array.from({ length: 40 }, (_, index) => (frames[0]?.seq ?? 0) + index));
    expect(rt.channel.stats().metersOverRate).toBe(0);

    await setMeters(rt, socket, false);
    await settle(rt, socket);
    const afterUnsubscribe = socket.messages.length;
    await rt.drive(500);
    await settle(rt, socket);
    expect(socket.messages.slice(afterUnsubscribe).filter((message) => message.type === 'meters')).toEqual([]);
  });

  it('a delta of the 1 Hz step waits for the pace step; over five seconds none is lost and none is sent twice', async () => {
    const socket = await operatorSocket(rt, webHeaders(supervisor.cookie));
    rt.channel.pace();
    expect(rt.channel.stats().heldDeltas).toBe(0);
    const from = rt.engine.revision;
    // One engine tick on the whole second, with no step of the channel: the delta waits.
    rt.clock.set(Math.ceil((rt.clock.now() + 1) / 1000) * 1000);
    rt.engineTimer.fire();
    await rt.engine.idle();
    expect(rt.engine.revision).toBe(from + 1);
    expect(rt.channel.stats().heldDeltas).toBe(1);
    expect(rt.channel.connections()[0]?.position?.revision).toBe(from);
    // 249 ms of the server clock later it still waits; the timer's pace step at 250 ms sends it.
    rt.steps.advance(249);
    expect(rt.channel.stats().heldDeltas).toBe(1);
    rt.steps.advance(1);
    expect(rt.channel.stats().heldDeltas).toBe(0);
    expect(rt.channel.connections()[0]?.position?.revision).toBe(from + 1);

    await rt.drive(5_000);
    rt.channel.pace();
    await settle(rt, socket);
    expectInSync(socket, 'after five seconds of ticks');
    expect(rt.channel.stats().healed).toBe(0);
  });
});

describe('RT-P1: the timers of a listening server', () => {
  it('three timers run; the heartbeat goes to every socket once in 1,000 ms of the server clock, with the next seq and the server time', async () => {
    expect(rt.channel.running).toBe(true);
    expect(rt.steps.active()).toBe(3);
    const operator = await operatorSocket(rt, webHeaders(supervisor.cookie));
    const anonymous = openSocket(rt.wsUrl);
    await anonymous.nextOf('heartbeat');
    // Up to the next beat of the timer, a millisecond at a time: from there the phase is known.
    const before = rt.channel.stats().beats;
    for (let ms = 0; ms < 1_000 && rt.channel.stats().beats === before; ms += 1) rt.steps.advance(1);
    const beats = rt.channel.stats().beats;
    expect(beats).toBe(before + 1);

    rt.steps.advance(999);
    expect(rt.channel.stats().beats).toBe(beats);
    rt.steps.advance(1);
    expect(rt.channel.stats().beats).toBe(beats + 1);
    rt.steps.advance(3_000);
    expect(rt.channel.stats().beats).toBe(beats + 4);
    for (const socket of [operator, anonymous]) {
      const last = await socket.next<Heartbeat>(`heartbeat ${beats + 4}`, (message) => message.type === 'heartbeat' && message.seq === beats + 4);
      expect(last.serverTime).toBe(new Date(rt.clock.now()).toISOString());
      expect(last.clients).toBe(2);
      const seqs = (socket.messages.filter((message) => message.type === 'heartbeat') as Heartbeat[]).map((beat) => beat.seq);
      expect(seqs.slice(-4)).toEqual([beats + 1, beats + 2, beats + 3, beats + 4]);
    }
  });
});

describe('RT-6: resync', () => {
  it('is answered with a snapshot at the engine\'s position; the socket then holds what a fresh one holds, and deltas continue', async () => {
    const socket = await operatorSocket(rt, deviceHeaders(onTablet.token));
    await rt.engine.command(principal('SUPERVISOR'), 'updateSettings', { timeFormat: '12' });
    socket.send({ type: 'resync' });
    const resynced = await socket.nextOf('snapshot', 2);
    expect([resynced.epoch, resynced.revision]).toEqual([rt.engine.epoch, rt.engine.revision]);

    const fresh = await operatorSocket(rt, webHeaders(supervisor.cookie));
    expect(resynced.state).toEqual((fresh.messages[1] as SnapshotMessage).state);

    await rt.engine.command(principal('SUPERVISOR'), 'updateSettings', { timeFormat: '24' });
    await settle(rt, socket, fresh);
    expectInSync(socket, 'the resynchronised socket');
    expectInSync(fresh, 'the fresh socket');
  });

  it('a resync from a DEVICE or an ANONYMOUS socket closes it with 1008', async () => {
    for (const headers of [deviceHeaders(onTablet.device.credential), {}]) {
      const socket = openSocket(rt.wsUrl, headers);
      await socket.opened;
      await socket.nextOf('heartbeat');
      socket.send({ type: 'resync' });
      expect((await socket.closed).code).toBe(1008);
      expect(socket.types()).toEqual(['hello', 'heartbeat']);
    }
  });
});

describe('RT-7: a new epoch', () => {
  it('a restart of the engine sends every OPERATOR socket a snapshot of the next epoch at revision 0, and nothing to a DEVICE or an ANONYMOUS socket', async () => {
    const web = await operatorSocket(rt, webHeaders(supervisor.cookie));
    const mobile = await operatorSocket(rt, deviceHeaders(onTablet.token));
    const device = openSocket(rt.wsUrl, deviceHeaders(onTablet.device.credential));
    const anonymous = openSocket(rt.wsUrl);
    await Promise.all([device.nextOf('heartbeat'), anonymous.nextOf('heartbeat')]);
    await rt.channel.settled();
    const before = rt.engine.epoch;

    await rt.engine.stop();
    // While the engine is stopped the sockets stay open and the heartbeat goes on, without a session state.
    await settle(rt, web, mobile, device, anonymous);
    expect((web.messages.at(-1) as Heartbeat).sessionState).toBeNull();
    await rt.engine.start('boot');
    await rt.engine.idle();

    for (const socket of [web, mobile]) {
      const snapshot = await socket.next<SnapshotMessage>('the snapshot of the new epoch', (message) => message.type === 'snapshot' && message.epoch === before + 1);
      expect(snapshot.revision).toBe(0);
    }
    rt.channel.pace();
    await rt.channel.settled();
    rt.channel.pace();
    await settle(rt, web, mobile, device, anonymous);
    expectInSync(web, 'the web socket after the new epoch');
    expectInSync(mobile, 'the device session after the new epoch');
    expect(new Set(device.types())).toEqual(new Set(['hello', 'heartbeat']));
    expect(new Set(anonymous.types())).toEqual(new Set(['hello', 'heartbeat']));

    // A socket that opens now is told the new epoch in hello.
    const next = openSocket(rt.wsUrl, webHeaders(supervisor.cookie));
    expect((await next.nextOf('hello')).epoch).toBe(before + 1);
    await untilSockets(rt, 5);
  });
});
