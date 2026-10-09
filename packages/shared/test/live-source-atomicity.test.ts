// Plan row W44 (HB-14), own-command atomicity: 04_client_integration_spec §2.5 CL-16, CL-17, CL-18,
// CL-22, CL-24 to CL-26; AC-C-10, AC-C-12, AC-C-14, AC-C-15.
//
// A Live source on the real typed client and the real live socket client, over the fake transport.
// The order of the two arrivals is set by the test: the HTTP answer is held back and released by
// hand, the delta is sent by hand. Time is the fake's clock: the settle time-out is reached with
// `advance`, never by waiting.
import { afterEach, describe, expect, it } from 'vitest';
import { pickReplicatedState, type DeltaMessage, type ReplicatedState } from '../src/api';
import { createCoreClient } from '../src/client';
import { LiveTransportError, settle } from '../src/live';
import {
  LIVE_BOOT_TIMEOUT_MS,
  LIVE_SETTLE_TIMEOUT_MS,
  createCommandGate,
  createLiveResult,
  createLiveSim,
  type LiveSim,
  type StateMessage,
} from '../src/live/source';
import { createFakeClock, createFakeTransport, type FakeConnection, type FakeTransport } from '../src/live/testing';
import { LIVE_SOCKET_SYNC_TIMEOUT_MS } from '../src/realtime/live-socket-client';
import { DEFAULT_SEED, buildScenarioState, createIdleState, type SimErrorReport, type SimState } from '../src/sim';

type Ops = DeltaMessage['ops'];

const BASE_URL = 'http://127.0.0.1:4420';
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const MARKER = 'addSessionMarker';
const NOTE = 'addSessionNote';

let fake: FakeTransport;
let live: LiveSim | undefined;

afterEach(() => {
  live?.stop();
  live = undefined;
  (fake as FakeTransport | undefined)?.assertNoViolations();
});

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
/** Lets every promise job that is queued, and the ones those queue, run. */
const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
};

interface Rig {
  source: LiveSim;
  connection: FakeConnection;
  reports: SimErrorReport[];
  recording: SimState;
  idle: SimState;
  /** The delta that holds the effect of one more marker. */
  markerOps(): Ops;
  noteOps(): Ops;
  markers(): number;
}

async function signedIn(): Promise<Rig> {
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  const idle = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
  const recording = buildScenarioState('recording', idle);
  fake.scriptSignedInStart(wire(recording));
  const reports: SimErrorReport[] = [];
  const source = createLiveSim({
    client: createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch }),
    socket: { url: SOCKET_URL, factory: fake.socketFactory },
    now: fake.clock.now,
    timers: fake.clock.timers,
    random: () => 0,
    onError: (report) => reports.push(report),
  });
  live = source;
  await source.ready;
  const connection = fake.connection();
  connection.beatEvery();
  const session = (): NonNullable<SimState['session']> => {
    const open = source.store.getState().session;
    if (!open) throw new Error('the replica holds an open session');
    return open;
  };
  let markerCount = recording.session?.markerCount ?? 0;
  return {
    source,
    connection,
    reports,
    recording,
    idle,
    markerOps() {
      markerCount += 1;
      return [{ op: 'replace', slice: 'session', value: { ...session(), markerCount } }] as Ops;
    },
    noteOps() {
      const open = session();
      return [
        { op: 'replace', slice: 'session', value: { ...open, markerCount, notes: [...open.notes, { id: 'NOTE-000901', at: fake.clock.now(), authorId: null, text: 'held' }] } },
      ] as Ops;
    },
    markers: () => session().markerCount,
  };
}

/** Records, in order: every store update, a microtask queued by that update, and the continuation. */
function observe(source: LiveSim, log: string[]): () => void {
  return source.store.subscribe((state) => {
    log.push(`update markers=${state.session?.markerCount}`);
    queueMicrotask(() => log.push('microtask'));
  });
}

describe('AC-C-10: own-command atomicity, in both arrival orders', () => {
  it('delta first: the delta is held while the command is in flight; the answer applies it and runs the continuation in one turn', async () => {
    const { source, connection, markerOps, markers } = await signedIn();
    const before = markers();
    const log: string[] = [];
    const stop = observe(source, log);
    const answer = fake.hold(MARKER);

    settle(() => source.actions.addMarker('Key statement'), {
      ok: () => log.push(`ok markers=${markers()}`),
      fail: () => log.push('fail'),
      done: () => log.push('done'),
    });
    await fake.arrived();
    expect(fake.log.operationIds()).toContain(MARKER);

    // The effect arrives on the socket BEFORE the HTTP answer. It is held: nothing changes, nobody is told.
    connection.delta(markerOps());
    await flush();
    expect(markers()).toBe(before);
    expect(log).toEqual([]);

    // The answer names the revision of that delta: the update, then the continuation, in one turn.
    answer.release();
    await flush();
    stop();
    expect(log).toEqual([`update markers=${before + 1}`, `ok markers=${before + 1}`, 'done', 'microtask']);
  });

  it('answer first: the action stays unsettled until the delta of its revision; the delta applies and settles in one synchronous turn', async () => {
    const { source, connection, markerOps, markers } = await signedIn();
    const before = markers();
    const log: string[] = [];
    const stop = observe(source, log);
    const answer = fake.hold(MARKER);

    settle(() => source.actions.addMarker('Key statement'), {
      ok: () => log.push(`ok markers=${markers()}`),
      fail: () => log.push('fail'),
      done: () => log.push('done'),
    });
    await fake.arrived();

    // The HTTP answer arrives first, naming the next revision. The store has not reached it.
    answer.release({ status: 204, revision: fake.position.revision + 1 });
    await flush();
    expect(log).toEqual([]);
    expect(markers()).toBe(before);

    // The delta arrives: the store update and the continuation happen inside this very call.
    connection.delta(markerOps());
    expect(log).toEqual([`update markers=${before + 1}`, `ok markers=${before + 1}`, 'done']);
    await flush();
    stop();
    // The microtask the subscriber queued during the update runs only after the continuation.
    expect(log).toEqual([`update markers=${before + 1}`, `ok markers=${before + 1}`, 'done', 'microtask']);
  });

  it.each(['delta-first', 'answer-first'] as const)('the scripted command of the fake transport, %s: one update, then the continuation', async (order) => {
    const { source, markerOps, markers } = await signedIn();
    const before = markers();
    const log: string[] = [];
    const stop = observe(source, log);
    const command = fake.scriptCommand(MARKER, { ops: markerOps(), order });

    settle(() => source.actions.addMarker(), { ok: () => log.push(`ok markers=${markers()}`), fail: () => log.push('fail') });
    await fake.arrived();
    await flush();
    if (order === 'answer-first') {
      expect(log).toEqual([]);
      command.sendDelta();
    }
    await flush();
    stop();
    expect(command.deltaSent).toBe(true);
    expect(log).toEqual([`update markers=${before + 1}`, `ok markers=${before + 1}`, 'microtask']);
  });

  it('CL-26: a Live result can be awaited, and the awaiting code sees the effect', async () => {
    const { source, markerOps, markers } = await signedIn();
    const before = markers();
    fake.scriptCommand(MARKER, { ops: markerOps(), order: 'delta-first' });
    await expect(source.actions.addMarker('Awaited')).resolves.toBeUndefined();
    expect(markers()).toBe(before + 1);
  });

  it('a delta of somebody else that arrives in flight is held too, and goes into the same single update', async () => {
    const { source, connection, markerOps, markers } = await signedIn();
    const before = markers();
    const updates: string[] = [];
    const stop = source.store.subscribe((state) => updates.push(`${state.tabletLink.state} ${state.session?.markerCount}`));
    const answer = fake.hold(MARKER);
    const result = source.actions.addMarker();
    await fake.arrived();

    connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    connection.delta(markerOps());
    expect(updates).toEqual([]);
    expect(source.store.getState().tabletLink.state).toBe('CONNECTED');

    answer.release();
    await result;
    stop();
    expect(updates).toEqual([`OFFLINE ${before + 1}`]);
  });

  it('deltas beyond the answered revision stay held while another command is in flight, and are applied when it settles', async () => {
    const { source, connection, markerOps, noteOps, markers } = await signedIn();
    const before = markers();
    const marker = fake.hold(MARKER);
    const note = fake.hold(NOTE);
    const settled: string[] = [];
    void source.actions.addMarker().then(() => settled.push(`marker notes=${source.store.getState().session?.notes.length}`));
    void source.actions.addNote('A note that is held').then(() => settled.push(`note notes=${source.store.getState().session?.notes.length}`));
    await fake.arrived(2);
    const notes = source.store.getState().session?.notes.length ?? 0;

    const markerRevision = fake.position.revision + 1;
    connection.delta(markerOps());
    connection.delta(noteOps());
    expect(markers()).toBe(before);

    // The marker's answer names its own revision: only the deltas up to it are applied.
    marker.release({ status: 204, revision: markerRevision });
    await flush();
    expect(settled).toEqual([`marker notes=${notes}`]);
    expect(markers()).toBe(before + 1);
    expect(source.store.getState().session?.notes).toHaveLength(notes);

    note.release({ status: 204, revision: markerRevision + 1 });
    await flush();
    expect(settled).toEqual([`marker notes=${notes}`, `note notes=${notes + 1}`]);
  });

  it('with no other command in flight, the deltas beyond the answered revision go into the same update', async () => {
    const { source, connection, markerOps, markers } = await signedIn();
    const before = markers();
    const updates: number[] = [];
    const answer = fake.hold(MARKER);
    const result = source.actions.addMarker();
    await fake.arrived();
    const revision = fake.position.revision + 1;
    connection.delta(markerOps());
    connection.delta(markerOps());
    const stop = source.store.subscribe((state) => updates.push(state.session?.markerCount ?? -1));
    answer.release({ status: 204, revision });
    await result;
    stop();
    expect(updates).toEqual([before + 2]);
  });

  it('a refusal ends the hold: what was held is applied, and the action rejects with the rebuilt error', async () => {
    const { source, connection, markers } = await signedIn();
    const answer = fake.hold(MARKER);
    const result = source.actions.addMarker();
    await fake.arrived();
    connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    expect(source.store.getState().tabletLink.state).toBe('CONNECTED');
    const before = markers();
    answer.release({ status: 409, body: { error: { code: 'INVALID_STATE', message: 'The session is not recording.', details: { simCode: 'ILLEGAL_STATE', from: 'STOPPING', event: 'addMarker' } } } });
    await expect(result).rejects.toMatchObject({ name: 'SimTransitionError', code: 'ILLEGAL_STATE', from: 'STOPPING', event: 'addMarker' });
    expect(source.store.getState().tabletLink.state).toBe('OFFLINE');
    expect(markers()).toBe(before);
  });

  it('meter frames are never held: one that arrives while a command is in flight shows at once', async () => {
    const { source, connection, markerOps } = await signedIn();
    const answer = fake.hold(MARKER);
    const result = source.actions.addMarker();
    await fake.arrived();
    const frame = { seq: 7, at: fake.clock.now(), dbfs: -18, peak: -12, clip: false, noSignal: false };
    connection.meters({ inputs: { 'MIC-01': frame, 'MIC-02': frame }, activeInputId: 'MIC-01' });
    expect(source.store.getState().audio.inputs['MIC-01']).toEqual(frame);
    connection.delta(markerOps());
    answer.release();
    await result;
  });

  it('a continuation that throws is contained and reported; the next delta is applied as if nothing happened (F40-3 c)', async () => {
    const { source, connection, markerOps, markers, reports } = await signedIn();
    const before = markers();
    const command = fake.scriptCommand(MARKER, { ops: markerOps(), order: 'answer-first' });
    void source.actions.addMarker().then(() => {
      throw new Error('a handler of the screen failed');
    });
    await fake.arrived();
    await flush();
    // The delta settles the action inside this call; the handler throws inside it; nothing escapes.
    expect(() => command.sendDelta()).not.toThrow();
    expect(markers()).toBe(before + 1);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ level: 'error', source: 'live.continuation', message: 'a handler of the screen failed' });
    connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    expect(source.store.getState().tabletLink.state).toBe('OFFLINE');
  });
});

describe('AC-C-14: the settle time-out (CL-17)', () => {
  it('when the delta of the answered revision does not arrive within 2,000 ms: ONE resync, the action resolves, the link reads RESYNCING until the snapshot', async () => {
    expect(LIVE_SETTLE_TIMEOUT_MS).toBe(2_000);
    const { source, connection, recording, reports } = await signedIn();
    const answer = fake.hold('runDiagnostics');
    let outcome: string | undefined;
    void source.actions.runDiagnostics().then(
      (runId) => (outcome = `resolved ${runId}`),
      () => (outcome = 'rejected'),
    );
    await fake.arrived();
    answer.release({ ...fake.example('runDiagnostics'), revision: fake.position.revision + 1 });
    await flush();
    expect(outcome).toBeUndefined();

    fake.clock.advance(LIVE_SETTLE_TIMEOUT_MS - 1);
    expect(outcome).toBeUndefined();
    expect(connection.receivedOf('resync')).toEqual([]);
    expect(source.link).toBe('ONLINE');

    fake.clock.advance(1);
    // The command did succeed: the action resolves with the server's answer, inside the timer's turn.
    expect(outcome).toMatch(/^resolved DIAG-\d{6}$/);
    expect(connection.receivedOf('resync')).toEqual([{ type: 'resync' }]);
    expect(source.link).toBe('RESYNCING');
    // While the link is not ONLINE no command is sent (CL-22).
    const calls = fake.calls.length;
    await expect(source.actions.runDiagnostics()).rejects.toBeInstanceOf(LiveTransportError);
    expect(fake.calls).toHaveLength(calls);

    // The snapshot the server answers with replaces the replica, and the link is ONLINE again.
    connection.snapshot(wire({ ...recording, activeCameraId: 'VIDEO-02' }), { revision: fake.position.revision + 1 });
    expect(source.link).toBe('ONLINE');
    expect(source.store.getState().activeCameraId).toBe('VIDEO-02');

    fake.clock.advance(10_000);
    expect(connection.receivedOf('resync')).toHaveLength(1);
    expect(fake.connections).toHaveLength(1);
    // The time-out itself is no error (CL-17: "no error toast"). The one report is the command that was refused while resynchronising.
    expect(reports.map((report) => report.source)).toEqual(['live.action.runDiagnostics']);
    expect(reports[0]?.context).toMatchObject({ reason: 'CORE_OFFLINE', link: 'RESYNCING' });
  });

  it('two commands that both time out still send ONE resync, and both resolve', async () => {
    const { source, connection } = await signedIn();
    const marker = fake.hold(MARKER);
    const note = fake.hold(NOTE);
    const settled: string[] = [];
    void source.actions.addMarker().then(() => settled.push('marker'));
    void source.actions.addNote('note').then(() => settled.push('note'));
    await fake.arrived(2);
    marker.release({ status: 204, revision: fake.position.revision + 1 });
    note.release({ status: 204, revision: fake.position.revision + 2 });
    await flush();
    expect(settled).toEqual([]);
    fake.clock.advance(LIVE_SETTLE_TIMEOUT_MS);
    expect(settled.sort()).toEqual(['marker', 'note']);
    expect(connection.receivedOf('resync')).toEqual([{ type: 'resync' }]);
  });

  it('whatever was held is applied at the time-out, even though it does not reach the answered revision', async () => {
    const { source, connection } = await signedIn();
    const answer = fake.hold(MARKER);
    const result = source.actions.addMarker();
    await fake.arrived();
    const revision = fake.position.revision;
    connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    answer.release({ status: 204, revision: revision + 5 });
    await flush();
    expect(source.store.getState().tabletLink.state).toBe('CONNECTED');
    fake.clock.advance(LIVE_SETTLE_TIMEOUT_MS);
    await result;
    expect(source.store.getState().tabletLink.state).toBe('OFFLINE');
    expect(connection.receivedOf('resync')).toHaveLength(1);
  });

  it('a command answered without its revision header settles at once and is reported (decision D51)', async () => {
    const { source, reports } = await signedIn();
    fake.answerOnce(MARKER, { status: 204, headers: { 'x-dems-revision': null }, violatesContract: true });
    await expect(source.actions.addMarker()).resolves.toBeUndefined();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ level: 'warn', source: 'live.action.addMarker', context: { operationId: MARKER, status: 204 } });
  });

  it('the boot time-out is the sync deadline of the socket, and both are the specification\'s 4,000 ms', () => {
    expect(LIVE_BOOT_TIMEOUT_MS).toBe(4_000);
    expect(LIVE_BOOT_TIMEOUT_MS).toBe(LIVE_SOCKET_SYNC_TIMEOUT_MS);
  });
});

describe('AC-C-15: a revision gap, and a new epoch (CL-18)', () => {
  it('a gap sends resync at most once in 2 s, and the snapshot replaces the replica', async () => {
    const { source, connection, recording } = await signedIn();
    const revision = fake.position.revision;
    // Five deltas that skip revisions: the socket drops them and asks once.
    for (let skip = 3; skip <= 7; skip += 1) {
      connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }], { revision: revision + skip });
      fake.clock.advance(300);
    }
    expect(connection.receivedOf('resync')).toEqual([{ type: 'resync' }]);
    expect(source.link).toBe('RESYNCING');
    expect(source.store.getState().tabletLink.state).toBe('CONNECTED');

    const resynced: string[] = [];
    source.onResync((event) => resynced.push(`${event.phase} ${event.cause}`));
    connection.snapshot(wire({ ...recording, tabletLink: { state: 'OFFLINE', changedAt: 5 }, lastSealedAcknowledged: false }));
    expect(source.link).toBe('ONLINE');
    expect(source.store.getState().tabletLink).toEqual({ state: 'OFFLINE', changedAt: 5 });
    expect(source.store.getState().lastSealedAcknowledged).toBe(false);
    expect(resynced).toEqual(['RESYNCED GAP']);
  });

  it.each(['snapshot first', 'answer first'] as const)('a reset settles when the snapshot of its epoch is applied (%s)', async (order) => {
    const { source, connection, idle } = await signedIn();
    const answer = fake.hold('resetDemo');
    const log: string[] = [];
    settle(() => source.actions.resetDemo(), {
      ok: () => log.push(`ok session=${source.store.getState().session?.state ?? 'none'} epoch=${source.socketStatus().epoch}`),
      fail: () => log.push('fail'),
    });
    await fake.arrived();
    const epoch = fake.position.epoch + 1;
    const snapshot = (): void => {
      connection.snapshot(wire(idle), { epoch, revision: 0 });
    };
    const release = (): void => answer.release({ status: 200, body: { epoch }, epoch, revision: 0 });

    if (order === 'snapshot first') {
      snapshot();
      // Held: the command is in flight, so the screen still shows the old epoch's state.
      expect(source.store.getState().session?.state).toBe('RECORDING');
      release();
      await flush();
    } else {
      release();
      await flush();
      expect(log).toEqual([]);
      snapshot();
    }
    expect(log).toEqual([`ok session=none epoch=${epoch}`]);
    expect(connection.receivedOf('resync')).toEqual([]);
  });
});

describe('CL-22 and CL-24: a command while the link is not ONLINE; a rejection nobody awaits (AC-C-12)', () => {
  it('is refused at once with LiveTransportError CORE_OFFLINE, and no request is sent', async () => {
    const { source, connection, reports } = await signedIn();
    // No heartbeat for 2,500 ms: the link is STALE.
    connection.close(1001);
    expect(source.link).toBe('OFFLINE');
    const calls = fake.calls.length;
    const seen: unknown[] = [];
    // Settled already: `fail` runs before `settle` returns, as a simulator action that throws.
    settle(() => source.actions.archiveEvidence('EV-20260930-0004'), { fail: (error) => seen.push(error) });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(LiveTransportError);
    expect(seen[0]).toMatchObject({ reason: 'CORE_OFFLINE', status: null, code: null, retryAfterSeconds: null });
    expect(fake.calls).toHaveLength(calls);
    expect(reports.at(-1)).toMatchObject({ level: 'error', source: 'live.action.archiveEvidence', context: { reason: 'CORE_OFFLINE', link: 'OFFLINE' } });
  });

  it('AC-C-12: a rejected Live action that nobody awaits raises no unhandled-rejection event and is reported once through onError', async () => {
    const { source, reports } = await signedIn();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      fake.answerOnce('archiveEvidence', { status: 403, body: { error: { code: 'NOT_PERMITTED', message: 'Your role does not allow this action.', details: { permission: 'EVIDENCE_REVIEW' } } } });
      // Fire and forget: no `then`, no `await`, no `settle`.
      void source.actions.archiveEvidence('EV-20260930-0004');
      await fake.arrived();
      await flush();
      // A macrotask boundary: the runtime reports unhandled rejections after the microtasks.
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    expect(unhandled).toEqual([]);
    const own = reports.filter((report) => report.source === 'live.action.archiveEvidence');
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ level: 'warn', context: { action: 'archiveEvidence', errorName: 'SimPermissionError', code: 'NOT_PERMITTED', status: 403, operationId: 'archiveEvidence' } });
    expect(source.errors()).toEqual(reports);
  });

  it('a report never holds an argument of the action', async () => {
    const { source, reports } = await signedIn();
    const secretNote = 'MARKER-NOTE-7f3a the subject named a witness';
    fake.answerOnce(NOTE, { status: 422, body: { error: { code: 'INVALID_INPUT', message: 'The request does not match the expected input.', details: { in: 'body' } } } });
    await expect(source.actions.addNote(secretNote)).rejects.toMatchObject({ name: 'SimTransitionError', code: 'NOTE_INVALID' });
    expect(JSON.stringify(reports)).not.toContain('MARKER-NOTE-7f3a');
    expect(JSON.stringify(source.errors())).not.toContain('witness');
  });

  it('errors() keeps the last 50 reports', async () => {
    const { source, connection } = await signedIn();
    connection.close(1001);
    for (let index = 0; index < 60; index += 1) void source.actions.snapshot();
    expect(source.errors()).toHaveLength(50);
  });
});

describe('the gate by itself (CL-16 to CL-18)', () => {
  const message = (revision: number, epoch = 1): StateMessage => ({
    connection: 1,
    message: { type: 'delta', v: 1, epoch, revision, serverTime: 0, ops: [{ op: 'replace', slice: 'lastSealedAcknowledged', value: true }] },
  });
  const snapshotOf = (connection: number, revision: number, epoch = 1): StateMessage => ({
    connection,
    message: { type: 'snapshot', v: 1, epoch, revision, serverTime: 0, state: {} as ReplicatedState },
  });

  function gateRig() {
    const clock = createFakeClock(0);
    const log: string[] = [];
    const gate = createCommandGate({
      timers: clock.timers,
      apply: (messages, extra) => log.push(`apply [${messages.map((entry) => entry.message.revision).join(',')}]${extra ? ' +extra' : ''}`),
      requestResync: () => log.push('resync'),
      report: (error) => log.push(`report ${String(error)}`),
    });
    return { clock, log, gate };
  }

  it('with nothing in flight a state message is applied at once and moves the position', () => {
    const { gate, log } = gateRig();
    expect(gate.position).toBeNull();
    gate.receive(snapshotOf(1, 10));
    gate.receive(message(11));
    expect(log).toEqual(['apply [10]', 'apply [11]']);
    expect(gate.position).toEqual({ epoch: 1, revision: 11 });
    expect([gate.inFlight, gate.held]).toEqual([0, 0]);
  });

  it('in flight: held; `end` applies what is held and then settles', () => {
    const { gate, log } = gateRig();
    gate.receive(snapshotOf(1, 10));
    gate.begin();
    gate.receive(message(11));
    gate.receive(message(12));
    expect([gate.inFlight, gate.held]).toEqual([1, 2]);
    expect(log).toEqual(['apply [10]']);
    gate.end(() => log.push('settled'));
    expect(log).toEqual(['apply [10]', 'apply [11,12]', 'settled']);
  });

  it('a position that is already reached settles at once; a later epoch counts as reached', () => {
    const { gate, log } = gateRig();
    gate.receive(snapshotOf(1, 10, 2));
    gate.begin();
    gate.wait({ kind: 'position', epoch: 2, revision: 10 }, { timeoutMs: 2_000, settle: (outcome) => log.push(outcome) });
    gate.begin();
    gate.wait({ kind: 'position', epoch: 1, revision: 99 }, { timeoutMs: 2_000, settle: (outcome) => log.push(outcome) });
    expect(log).toEqual(['apply [10]', 'reached', 'reached']);
    expect(gate.inFlight).toBe(0);
  });

  it('the time-out: resync, everything held applied with the extra, settled as `timeout`; a timer that was cleared never fires', () => {
    const { gate, log, clock } = gateRig();
    gate.receive(snapshotOf(1, 10));
    gate.begin();
    gate.receive(message(11));
    gate.wait({ kind: 'position', epoch: 1, revision: 15 }, { timeoutMs: 2_000, extra: () => ({ lastSealedAcknowledged: false }), settle: (outcome) => log.push(outcome) });
    clock.advance(1_999);
    expect(log).toEqual(['apply [10]']);
    clock.advance(1);
    expect(log).toEqual(['apply [10]', 'resync', 'apply [11] +extra', 'timeout']);

    gate.begin();
    gate.wait({ kind: 'position', epoch: 1, revision: 12 }, { timeoutMs: 2_000, settle: (outcome) => log.push(outcome) });
    gate.receive(message(12));
    expect(log.slice(-2)).toEqual(['apply [12]', 'reached']);
    clock.advance(60_000);
    expect(log.filter((entry) => entry === 'resync')).toHaveLength(1);
    expect(clock.pendingTasks).toBe(0);
  });

  it('a sign-in waits for the first snapshot of a later connection, with its extra in the same update; its time-out asks for no resync', () => {
    const { gate, log, clock } = gateRig();
    gate.receive(snapshotOf(1, 10));
    gate.begin();
    gate.wait({ kind: 'snapshot', afterConnection: 1 }, { timeoutMs: 4_000, extra: () => ({ lastSealedAcknowledged: true }), settle: (outcome) => log.push(outcome) });
    gate.receive(message(11));
    // A snapshot of the connection the sign-in started on (a resync that was under way) is not its effect.
    gate.receive(snapshotOf(1, 12));
    expect(log).toEqual(['apply [10]']);
    gate.receive(snapshotOf(2, 30));
    expect(log).toEqual(['apply [10]', 'apply [11,12,30] +extra', 'reached']);
    expect(gate.position).toEqual({ epoch: 1, revision: 30 });

    gate.begin();
    gate.wait({ kind: 'snapshot', afterConnection: 2 }, { timeoutMs: 4_000, settle: (outcome) => log.push(outcome) });
    clock.advance(4_000);
    expect(log.slice(-1)).toEqual(['timeout']);
    expect(log).not.toContain('resync');
    expect(gate.inFlight).toBe(0);
  });

  it('a hold keeps state messages back until it is released', () => {
    const { gate, log } = gateRig();
    gate.hold();
    gate.receive(snapshotOf(1, 10));
    expect(log).toEqual([]);
    gate.release();
    expect(log).toEqual(['apply [10]']);
  });

  it('reset drops what is held, forgets the position and settles every waiting command as `dropped`', () => {
    const { gate, log, clock } = gateRig();
    gate.receive(snapshotOf(1, 10));
    gate.begin();
    gate.wait({ kind: 'position', epoch: 1, revision: 12 }, { timeoutMs: 2_000, settle: (outcome) => log.push(outcome) });
    gate.receive(message(11));
    gate.reset();
    expect(log).toEqual(['apply [10]', 'dropped']);
    expect([gate.position, gate.inFlight, gate.held]).toEqual([null, 0, 0]);
    clock.advance(10_000);
    expect(log).toEqual(['apply [10]', 'dropped']);
  });

  it('what a settle callback throws is reported and the gate goes on', () => {
    const { gate, log } = gateRig();
    gate.begin();
    gate.end(() => {
      throw new Error('boom');
    });
    gate.receive(snapshotOf(1, 10));
    expect(log).toEqual(['report Error: boom', 'apply [10]']);
  });

  describe('fix round after CP-C1 (decision D80)', () => {
    function boundedRig(maxHeld: number) {
      const clock = createFakeClock(0);
      const log: string[] = [];
      const gate = createCommandGate({
        timers: clock.timers,
        maxHeld,
        apply: (messages) => log.push(`apply [${messages.map((entry) => entry.message.revision).join(',')}]`),
        requestResync: () => log.push('resync'),
        overflow: (dropped) => log.push(`overflow ${dropped}`),
        report: (error) => log.push(`report ${String(error)}`),
      });
      return { clock, log, gate };
    }

    it('CPC1-8: beyond `maxHeld` everything held is dropped and told; deltas are dropped until a snapshot; ONE resync is asked for when the gate is free', () => {
      const { gate, log } = boundedRig(3);
      gate.receive(snapshotOf(1, 10));
      gate.begin();
      for (const revision of [11, 12, 13]) gate.receive(message(revision));
      expect(gate.held).toBe(3);
      gate.receive(message(14));
      // Four were held; all four are gone, and the store was not touched.
      expect(gate.held).toBe(0);
      expect(log).toEqual(['apply [10]', 'overflow 4']);
      expect(gate.position).toEqual({ epoch: 1, revision: 10 });
      // Behind: a delta cannot be built on a state that lost messages.
      gate.receive(message(15));
      expect(gate.held).toBe(0);
      // The command is still in flight: nothing is asked for yet.
      expect(log).toEqual(['apply [10]', 'overflow 4']);
      gate.end(() => log.push('settled'));
      expect(log).toEqual(['apply [10]', 'overflow 4', 'resync', 'settled']);
      gate.receive(message(16));
      expect(log).toHaveLength(4);
      // The snapshot repairs it, and deltas count again.
      gate.receive(snapshotOf(1, 16));
      gate.receive(message(17));
      expect(log).toEqual(['apply [10]', 'overflow 4', 'resync', 'settled', 'apply [16]', 'apply [17]']);
      expect(gate.position).toEqual({ epoch: 1, revision: 17 });
    });

    it('CPC1-8: a command that waited for a dropped message leaves by its time-out, and the resync is asked for once', () => {
      const { gate, log, clock } = boundedRig(2);
      gate.receive(snapshotOf(1, 10));
      gate.begin();
      gate.begin();
      // Its delta is far away: the three messages that come first pass the bound and are dropped.
      gate.wait({ kind: 'position', epoch: 1, revision: 20 }, { timeoutMs: 2_000, settle: (outcome) => log.push(`first ${outcome}`) });
      for (const revision of [11, 12, 13]) gate.receive(message(revision));
      expect(log).toEqual(['apply [10]', 'overflow 3']);
      clock.advance(2_000);
      expect(log).toEqual(['apply [10]', 'overflow 3', 'resync', 'first timeout']);
      gate.end(() => log.push('second settled'));
      // The one resync was asked for at the time-out: freeing the gate asks for no second one.
      expect(log).toEqual(['apply [10]', 'overflow 3', 'resync', 'first timeout', 'second settled']);
    });

    it('CPC1-8: without `maxHeld` nothing is bounded, as before', () => {
      const { gate } = gateRig();
      gate.begin();
      for (let revision = 1; revision <= 400; revision += 1) gate.receive(message(revision));
      expect(gate.held).toBe(400);
    });

    it('CPC1-7: `halt` settles every waiting command as dropped, clears its timer, drops what is held, lifts every hold, and keeps the position', () => {
      const { gate, log, clock } = gateRig();
      gate.receive(snapshotOf(1, 10));
      gate.begin();
      gate.wait({ kind: 'position', epoch: 1, revision: 12 }, { timeoutMs: 2_000, settle: (outcome) => log.push(`command ${outcome}`) });
      gate.begin();
      gate.wait({ kind: 'snapshot', afterConnection: 1 }, { timeoutMs: 4_000, settle: (outcome) => log.push(`sign-in ${outcome}`) });
      gate.hold();
      gate.receive(message(11));
      expect([gate.inFlight, gate.held, clock.pendingTasks]).toEqual([2, 1, 2]);

      gate.halt();
      expect(log).toEqual(['apply [10]', 'command dropped', 'sign-in dropped']);
      expect([gate.inFlight, gate.held, clock.pendingTasks]).toEqual([0, 0, 0]);
      expect(gate.position).toEqual({ epoch: 1, revision: 10 });
      clock.advance(10_000);
      expect(log).toHaveLength(3);
      // The hold is lifted: the next message is applied at once.
      gate.receive(snapshotOf(2, 20));
      expect(log.at(-1)).toBe('apply [20]');
    });
  });
});

describe('the Live result (CL-16, CL-24 to CL-26; the light API\'s O-1 and O-3)', () => {
  it('runs its callbacks inside `resolve`, in the order they were given; later ones run inside `then`', () => {
    const reported: unknown[] = [];
    const control = createLiveResult<number>((error) => reported.push(error));
    const log: string[] = [];
    void control.result.then((value) => log.push(`first ${value}`));
    void control.result.then((value) => log.push(`second ${value}`));
    expect(control.settled).toBe(false);
    control.resolve(7);
    expect(log).toEqual(['first 7', 'second 7']);
    control.resolve(8);
    control.reject(new Error('late'));
    void control.result.then((value) => log.push(`late ${value}`));
    expect(log).toEqual(['first 7', 'second 7', 'late 7']);
    expect(control.settled).toBe(true);
    expect(reported).toEqual([]);
  });

  it('has the members of a promise: chains, catch, finally, await, and a thenable a callback returns is followed', async () => {
    const control = createLiveResult<number>(() => undefined);
    const chained = control.result.then((value) => value + 1).then((value) => Promise.resolve(value * 2));
    const log: string[] = [];
    const cleaned = control.result.finally(() => log.push('finally'));
    control.resolve(1);
    expect(log).toEqual(['finally']);
    await expect(chained).resolves.toBe(4);
    await expect(cleaned).resolves.toBe(1);
    expect(Object.prototype.toString.call(control.result)).toBe('[object LiveResult]');

    const failing = createLiveResult<number>(() => undefined);
    const error = new Error('refused');
    const recovered = failing.result.catch((reason) => (reason === error ? -1 : 0));
    const passed = failing.result.then((value) => value);
    const finallyKept = failing.result.finally(() => log.push('finally 2'));
    failing.reject(error);
    await expect(recovered).resolves.toBe(-1);
    await expect(passed).rejects.toBe(error);
    await expect(finallyKept).rejects.toBe(error);
    await expect(failing.result).rejects.toBe(error);
  });

  it('a callback that throws rejects the derived result and is reported; a rejection nobody handles reports nothing by itself', async () => {
    const reported: unknown[] = [];
    const control = createLiveResult<number>((error) => reported.push(error));
    const boom = new Error('boom');
    const derived = control.result.then(() => {
      throw boom;
    });
    const cleanup = control.result.finally(() => {
      throw boom;
    });
    control.resolve(1);
    expect(reported).toEqual([boom, boom]);
    await expect(derived).rejects.toBe(boom);
    await expect(cleanup).rejects.toBe(boom);

    const rejected = createLiveResult<number>((error) => reported.push(error));
    rejected.reject(new Error('nobody listens'));
    expect(reported).toHaveLength(2);
  });

  it('settle() gets both handlers through one `then`; `ok` and `done` run inside the resolution', () => {
    const control = createLiveResult<string>(() => undefined);
    const log: string[] = [];
    settle(() => control.result, { ok: (value) => log.push(`ok ${value}`), fail: () => log.push('fail'), done: () => log.push('done') });
    expect(log).toEqual([]);
    control.resolve('settled');
    expect(log).toEqual(['ok settled', 'done']);
  });
});
