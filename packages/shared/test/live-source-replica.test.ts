// Plan row W44 (HB-14), the replica: 04_client_integration_spec §2.3, CL-13, CL-14; AC-C-07 and
// AC-C-08.
//
// AC-C-07 is proven on ONE engine (finding F42: two scenario states share no prefix of audit
// rows): a simulator is created in the `recording` scenario and driven through a working session.
// Its state at the start is sent to a Live source as the snapshot; after every step the test sends
// what changed as one delta (`replace` for a changed slice, `append` for new audit rows and new
// events), the way the Core server will. The fake transport checks every message against the
// contract. Then the simulator's own selectors are run on both stores and must agree.
//
// The Live source runs on the real typed client and the real live socket client; only the
// transport underneath is the fake. Both sides read one clock, the fake's.
import { afterEach, describe, expect, it } from 'vitest';
import {
  REPLICATED_SLICE_NAMES,
  UNREPLICATED_SLICE_NAMES,
  pickReplicatedState,
  type AuthSessionInfo,
  type DeltaMessage,
  type ReplicatedState,
  type SnapshotMessage,
} from '../src/api';
import { createCoreClient } from '../src/client';
import {
  asSim,
  createLiveSim,
  createNeutralState,
  foldStateMessages,
  replacementPatch,
  shareStructure,
  type LiveSim,
  type StateMessage,
} from '../src/live/source';
import { coreModeOf, liveOf } from '../src/live';
import { createFakeTransport, type FakeConnection, type FakeTransport } from '../src/live/testing';
import {
  AUDIT_RING_SIZE,
  AUTH_IDLE_TIMEOUT_MS,
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  EVENT_RING_SIZE,
  Permission,
  ROLE_PERMISSIONS,
  SIM_TZ,
  SIM_TZ_OFFSET_MINUTES,
  createIdleState,
  createSim,
  verifyAuditChain,
  type AuditRow,
  type Sim,
  type SimErrorReport,
  type SimEvent,
  type SimState,
} from '../src/sim';
import * as selectors from '../src/sim/selectors';

type DeltaOp = DeltaMessage['ops'][number];

const BASE_URL = 'http://127.0.0.1:4420';
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';

let fake: FakeTransport;
let live: LiveSim | undefined;

afterEach(() => {
  live?.stop();
  live = undefined;
  // D61: what a client swallowed still fails the test. (A test of a pure function makes no fake.)
  (fake as FakeTransport | undefined)?.assertNoViolations();
});

/** The replicated slices of a state as the wire carries them. */
const wire = (state: SimState): ReplicatedState => pickReplicatedState(state as unknown as ReplicatedState);

/** The caller's own session as the Core server would answer it for the simulator's signed-in operator. */
function sessionOf(state: SimState, serverTime: number): AuthSessionInfo {
  const operator = state.operators.find((candidate) => candidate.id === state.auth.operatorId);
  if (!operator || state.auth.issuedAt === null || state.auth.lastActivityAt === null) throw new Error('the simulator is not signed in');
  return {
    operator,
    permissions: [...ROLE_PERMISSIONS[operator.role]],
    method: 'PASSWORD',
    issuedAt: state.auth.issuedAt,
    lastActivityAt: state.auth.lastActivityAt,
    idleExpiresAt: state.auth.lastActivityAt + AUTH_IDLE_TIMEOUT_MS,
    absoluteExpiresAt: state.auth.issuedAt + 8 * 3_600_000,
    deviceId: null,
    demoControls: true,
    serverTime,
  };
}

/**
 * What the Core server sends for the step from `before` to `after` (01_specs RT-3): `replace` for
 * a slice whose reference changed, `append` where the audit ring or the event ring only grew.
 */
function opsBetween(before: SimState, after: SimState): DeltaOp[] {
  const ops: DeltaOp[] = [];
  const previous = wire(before) as unknown as Record<string, unknown>;
  const next = wire(after) as unknown as Record<string, unknown>;
  for (const name of REPLICATED_SLICE_NAMES) {
    if (Object.is(previous[name], next[name])) continue;
    if (name === 'audit') {
      const added = after.audit.total - before.audit.total;
      const kept = after.audit.rows.length - added;
      const onlyGrew =
        added > 0 &&
        kept >= 0 &&
        kept <= before.audit.rows.length &&
        after.audit.rows.slice(0, kept).every((row, index) => row === before.audit.rows[before.audit.rows.length - kept + index]);
      if (onlyGrew) {
        ops.push({ op: 'append', slice: 'audit', rows: after.audit.rows.slice(kept), head: after.audit.head, total: after.audit.total, dropped: after.audit.dropped } as DeltaOp);
        continue;
      }
    }
    if (name === 'events') {
      const last = before.events.at(-1);
      const at = last === undefined ? -1 : after.events.lastIndexOf(last);
      const rows = after.events.slice(at + 1);
      const overlap = after.events.length - rows.length;
      const onlyGrew =
        rows.length > 0 &&
        (last === undefined ? before.events.length === 0 : at >= 0) &&
        after.events.slice(0, overlap).every((event, index) => event === before.events[before.events.length - overlap + index]);
      if (onlyGrew) {
        ops.push({ op: 'append', slice: 'events', rows } as DeltaOp);
        continue;
      }
    }
    ops.push({ op: 'replace', slice: name, value: next[name] } as DeltaOp);
  }
  return ops;
}

/** The simulator's selectors of one argument: every `select…(state)` it exports. */
const UNARY_SELECTORS = (Object.entries(selectors) as [string, unknown][]).filter(
  (entry): entry is [string, (state: SimState) => unknown] => entry[0].startsWith('select') && typeof entry[1] === 'function' && entry[1].length === 1,
);
/**
 * Not compared: `selectPairing` reads the `pairing` slice, which the server never sends. On the
 * web console it is the neutral value in Live mode (§2.3; §5.5 WS-7: no web screen reads it),
 * while the simulator's web default is PAIRED.
 */
const NOT_REPLICATED = new Set(['selectPairing']);

function compareSelectors(label: string, sim: Sim, source: LiveSim): void {
  const expected = sim.store.getState();
  const actual = source.store.getState();
  for (const [name, select] of UNARY_SELECTORS) {
    if (NOT_REPLICATED.has(name)) continue;
    expect(select(actual), `${label}: ${name}`).toEqual(select(expected));
  }
  for (const permission of Object.values(Permission)) {
    expect(selectors.selectCan(actual, permission), `${label}: selectCan(${permission})`).toBe(selectors.selectCan(expected, permission));
  }
  for (const item of expected.evidence.slice(0, 3)) {
    expect(selectors.selectEvidenceById(actual, item.id), `${label}: selectEvidenceById`).toEqual(selectors.selectEvidenceById(expected, item.id));
    expect(selectors.selectEvidenceBySessionId(actual, item.sessionId)).toEqual(selectors.selectEvidenceBySessionId(expected, item.sessionId));
  }
  for (const camera of expected.cameras) {
    expect(selectors.selectCameraById(actual, camera.id)).toEqual(selectors.selectCameraById(expected, camera.id));
    expect(selectors.selectDeviceById(actual, camera.deviceId)).toEqual(selectors.selectDeviceById(expected, camera.deviceId));
  }
  for (const fault of ['MIC_CLIP', 'AUDIT_TAMPER', 'GNSS_LOSS']) {
    expect(selectors.selectIsFaultActive(actual, fault), `${label}: selectIsFaultActive(${fault})`).toBe(selectors.selectIsFaultActive(expected, fault));
  }
  expect(selectors.selectStorageActivity(actual), `${label}: selectStorageActivity`).toEqual(selectors.selectStorageActivity(expected));
  // The 30 replicated slices, and the web's own chain check over the server's rows (CL-14).
  expect(wire(actual), `${label}: the replicated slices`).toEqual(wire(expected));
  expect(verifyAuditChain(actual.audit), `${label}: the chain check`).toEqual(verifyAuditChain(expected.audit));
  // The streamed slice and the clock.
  expect(actual.audio, `${label}: audio`).toEqual(expected.audio);
  expect(actual.clock, `${label}: clock`).toEqual(expected.clock);
}

interface Rig {
  sim: Sim;
  source: LiveSim;
  connection: FakeConnection;
  reports: SimErrorReport[];
  /** Advances the one clock and ticks the simulator, in engine steps. */
  run(ms: number): void;
  /** Sends what changed since the last call as one delta, and the newest audio frame. Returns the ops. */
  sync(): DeltaOp[];
}

/** One simulator in the `recording` scenario with a supervisor signed in, and a Live source that holds its snapshot. */
async function rig(): Promise<Rig> {
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  const clock = { now: () => fake.clock.now(), tz: SIM_TZ, tzOffsetMinutes: SIM_TZ_OFFSET_MINUTES };
  const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording' });
  await sim.ready;
  expect(sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD)).toMatchObject({ ok: true });
  sim.tick();

  const start = sim.store.getState();
  fake.scriptSignedInStart(wire(start), { session: sessionOf(start, fake.clock.now()) });
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

  let sent = start;
  return {
    sim,
    source,
    connection,
    reports,
    run(ms) {
      for (let elapsed = 0; elapsed < ms; elapsed += 50) {
        fake.clock.advance(50);
        sim.tick();
      }
    },
    sync() {
      const state = sim.store.getState();
      const ops = opsBetween(sent, state);
      if (ops.length > 0) connection.delta(ops as DeltaMessage['ops']);
      sent = state;
      connection.meters(state.audio);
      return ops;
    },
  };
}

describe('AC-C-07: a snapshot and the deltas of the recording scenario drive the selectors to the simulator\'s values', () => {
  it('is a Live source: LIVE in the SimContext, signed in, the snapshot applied, the link ONLINE', async () => {
    const { sim, source, sync } = await rig();
    // Nothing changed since the snapshot: no delta goes out, only the newest audio frame.
    expect(sync()).toEqual([]);
    expect(coreModeOf(asSim(source))).toBe('LIVE');
    expect(liveOf(asSim(source))).toBe(source);
    expect(source.isReady()).toBe(true);
    expect(source.link).toBe('ONLINE');
    expect(source.session?.operator.id).toBe(sim.store.getState().auth.operatorId);
    expect(source.store.getState().session?.state).toBe('RECORDING');
    expect(source.seed).toBe(sim.seed);
    compareSelectors('after the snapshot', sim, source);
  });

  it('compares the simulator\'s selectors of one argument, all but the one on a slice the server never sends', () => {
    expect(UNARY_SELECTORS.length).toBeGreaterThanOrEqual(50);
    expect(UNARY_SELECTORS.map(([name]) => name)).toEqual(expect.arrayContaining(['selectSession', 'selectSystemState', 'selectAuditTail', 'selectLockout', 'selectAuth']));
    expect([...NOT_REPLICATED]).toEqual(['selectPairing']);
  });

  it('follows one engine through a session: recording, markers, faults, stop, seal, verify, export, archive, diagnostics, a new session', async () => {
    const { sim, source, run, sync, reports } = await rig();
    const { actions } = sim;
    const sentOps: DeltaOp[] = [];
    const step = (label: string, act: () => void): void => {
      act();
      sentOps.push(...sync());
      compareSelectors(label, sim, source);
    };

    step('one second of recording', () => run(1_000));
    step('a marker', () => actions.addMarker('Key statement'));
    step('a note', () => actions.addNote('Subject confirms the timeline of 14 March.'));
    step('a snapshot', () => actions.snapshot());
    step('a clipping microphone', () => {
      actions.inject('MIC_CLIP');
      run(500);
    });
    step('the clip latch reset and the alert acknowledged', () => {
      actions.resetClip('AUDIO-02');
      const alert = sim.store.getState().alerts.find((candidate) => !candidate.acknowledged);
      if (alert) actions.acknowledgeAlert(alert.id);
      actions.clearFault('MIC_CLIP');
    });
    step('the other camera', () => actions.setActiveCamera('VIDEO-02'));
    step('console settings', () => {
      actions.setPresentationMode(true);
      actions.updateSettings({ timeFormat: '12' });
    });
    step('a tampered audit row: the ring changes in place', () => actions.inject('AUDIT_TAMPER'));
    expect(verifyAuditChain(source.store.getState().audit).ok).toBe(false);
    step('the tamper cleared', () => actions.clearFault('AUDIT_TAMPER'));
    expect(verifyAuditChain(source.store.getState().audit).ok).toBe(true);
    step('three more seconds', () => run(3_000));
    step('stop', () => actions.stopRecording('Interview complete'));
    step('stopping', () => run(1_600));
    step('finalization, to the seal', () => run(12_000));
    const sealed = sim.store.getState().lastSealedSessionId;
    expect(sealed).not.toBeNull();
    expect(source.store.getState().lastSealedSessionId).toBe(sealed);
    step('the summary acknowledged', () => actions.acknowledgeSummary(sealed as string));
    const evidence = sim.store.getState().evidence.find((item) => item.sessionId === sealed);
    expect(evidence).toBeDefined();
    const evidenceId = (evidence as { id: string }).id;
    step('verified', () => expect(actions.verify(evidenceId).ok).toBe(true));
    step('exported', () => expect(actions.exportEvidence(evidenceId, { reason: 'Prosecutor review', destination: 'Case file transfer' })).toMatchObject({ ok: true }));
    step('archived', () => actions.archiveEvidence(evidenceId));
    step('the audit log exported', () => expect(actions.exportAudit({ reason: 'Monthly audit review' })).toMatchObject({ ok: true }));
    step('idle for five seconds', () => run(5_000));
    step('a case number scanned and a session created', () => {
      const caseNumber = actions.scanCaseNumber();
      expect(
        actions.createSession({
          caseNumber,
          subjectType: 'SAKSI',
          subjectName: 'Synthetic Witness',
          investigatorId: 'OPR-001',
          room: 'Interview Room 1',
          profileId: 'STANDARD_1080P25',
        }),
      ).toMatchObject({ ok: true, created: true });
    });
    step('the pre-check runs', () => {
      actions.beginPrecheck();
      run(600);
    });
    step('the pre-check resolved', () => run(5_000));
    step('cancelled', () => actions.cancel());

    // Every kind of operation was on the wire.
    const kinds = new Set(sentOps.map((op) => `${op.op} ${op.slice}`));
    expect([...kinds]).toEqual(expect.arrayContaining(['append audit', 'append events', 'replace audit', 'replace session', 'replace evidence', 'replace health']));
    expect(sentOps.filter((op) => op.op === 'append' && op.slice === 'audit').length).toBeGreaterThan(10);
    // 30 replicated slices: the five others never travel as a slice.
    expect(new Set(sentOps.map((op) => op.slice)).size).toBeLessThanOrEqual(REPLICATED_SLICE_NAMES.length);
    for (const name of UNREPLICATED_SLICE_NAMES) expect(sentOps.some((op) => (op.slice as string) === name)).toBe(false);
    // The socket handed on every delta in order: no gap, no resync, nothing dropped, nothing reported.
    const status = source.socketStatus();
    expect(status.counters).toMatchObject({ deltasDropped: 0, deltasStale: 0, resyncs: 0, invalid: 0, snapshots: 1 });
    expect(status.revision).toBe(fake.position.revision);
    expect(reports).toEqual([]);
  });
});

describe('AC-C-08: structural sharing (CL-13)', () => {
  it('after a delta that replaces one slice, every other slice reference is unchanged', async () => {
    const { source, connection } = await rig();
    const before = source.store.getState();
    connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    const after = source.store.getState();
    expect(after.tabletLink).toEqual({ state: 'OFFLINE', changedAt: fake.clock.now() });
    const changed = (Object.keys(after) as (keyof SimState)[]).filter((name) => !Object.is(after[name], before[name]));
    expect(changed).toEqual(['tabletLink']);
  });

  it('a snapshot equal to the current state changes no reference and tells no subscriber', async () => {
    const { sim, source, connection } = await rig();
    const before = source.store.getState();
    let notified = 0;
    const unsubscribe = source.store.subscribe(() => {
      notified += 1;
    });
    // The same state again, freshly serialised: every object in the message is new.
    connection.snapshot(wire(sim.store.getState()));
    unsubscribe();
    expect(source.socketStatus().counters.snapshots).toBe(2);
    expect(source.store.getState()).toBe(before);
    expect(notified).toBe(0);
  });

  it('a replace whose value equals the slice keeps the slice; unchanged array elements keep their references', async () => {
    const { sim, source, connection } = await rig();
    const before = source.store.getState();
    const state = sim.store.getState();
    const [first, second, ...rest] = state.evidence;
    if (!first || !second) throw new Error('the scenario holds evidence');
    const relabelled = { ...second, room: 'Interview Room 2' };
    connection.delta([
      { op: 'replace', slice: 'storagePolicy', value: state.storagePolicy },
      { op: 'replace', slice: 'evidence', value: [first, relabelled, ...rest] },
    ] as DeltaMessage['ops']);
    const after = source.store.getState();
    expect(after.storagePolicy).toBe(before.storagePolicy);
    expect(after.evidence).not.toBe(before.evidence);
    expect(after.evidence[0]).toBe(before.evidence[0]);
    expect(after.evidence[1]).not.toBe(before.evidence[1]);
    expect(after.evidence[1]?.room).toBe('Interview Room 2');
    // Inside the changed element, what did not change is shared too.
    expect(after.evidence[1]?.tracks).toBe(before.evidence[1]?.tracks);
    expect(after.evidence[1]?.custody).toBe(before.evidence[1]?.custody);
    for (let index = 2; index < after.evidence.length; index += 1) expect(after.evidence[index]).toBe(before.evidence[index]);
    const changed = (Object.keys(after) as (keyof SimState)[]).filter((name) => !Object.is(after[name], before[name]));
    expect(changed).toEqual(['evidence']);
  });

  it('a selector subscription does not fire for a delta that names another slice', async () => {
    const { source, connection } = await rig();
    let evidenceFired = 0;
    let linkFired = 0;
    const stopEvidence = source.store.subscribe((state) => state.evidence, () => (evidenceFired += 1));
    const stopLink = source.store.subscribe((state) => state.tabletLink, () => (linkFired += 1));
    connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    stopEvidence();
    stopLink();
    expect([evidenceFired, linkFired]).toEqual([0, 1]);
  });

  it('shareStructure: equal in, the previous reference out; an element that moved keeps its reference by its id', () => {
    const previous = { list: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'c', n: 3 }], text: 'same', nested: { deep: [1, 2, 3] } };
    const equal = JSON.parse(JSON.stringify(previous)) as typeof previous;
    expect(shareStructure(previous, equal)).toBe(previous);

    const shifted = { ...equal, list: [{ id: 'b', n: 2 }, { id: 'c', n: 3 }, { id: 'd', n: 4 }] };
    const shared = shareStructure(previous, shifted);
    expect(shared).not.toBe(previous);
    expect(shared.list[0]).toBe(previous.list[1]);
    expect(shared.list[1]).toBe(previous.list[2]);
    expect(shared.list[2]).toEqual({ id: 'd', n: 4 });
    expect(shared.nested).toBe(previous.nested);

    // A member that was added, removed or changed makes a new object; other values are taken as they come.
    expect(shareStructure({ a: 1 }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(shareStructure({ a: 1, b: 2 }, { a: 1 })).toEqual({ a: 1 });
    expect(shareStructure([1, 2], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(shareStructure({ a: 1 }, [1])).toEqual([1]);
    expect(shareStructure(null, { a: 1 })).toEqual({ a: 1 });
    expect(shareStructure('x', 'x')).toBe('x');
  });

  it('the structural-sharing function can be injected (CA-04): the source uses the one it is given', async () => {
    fake = createFakeTransport();
    fake.scriptSignedInStart(wire(createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED })));
    let calls = 0;
    const source = createLiveSim({
      client: createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch }),
      socket: { url: SOCKET_URL, factory: fake.socketFactory },
      now: fake.clock.now,
      timers: fake.clock.timers,
      structuralSharing: (previous, next) => {
        calls += 1;
        return shareStructure(previous, next);
      },
    });
    live = source;
    await source.ready;
    // One call per replicated slice of the snapshot: the injected function is the one in use.
    expect(calls).toBe(REPLICATED_SLICE_NAMES.length);
    expect(source.store.getState().operators).toHaveLength(3);
  });
});

describe('CL-14: the audit ring and the event ring are built as the simulator builds them', () => {
  const state = createNeutralState(0);
  const row = (seq: number): AuditRow =>
    ({ seq, id: `AUD-${seq}`, at: seq, type: 'AUTH_SUCCESS', category: 'AUTH', severity: 'INFO', actorId: null, message: 'm', sessionId: null, evidenceId: null, deviceId: null, details: {}, prevHash: 'p', hash: `h${seq}` }) as unknown as AuditRow;
  const event = (seq: number): SimEvent =>
    ({ id: `LOG-${seq}`, seq, at: seq, type: 'AUTH_LOGIN', severity: 'INFO', message: 'm', params: {}, sessionId: null, deviceId: null }) as unknown as SimEvent;
  const delta = (ops: unknown[], revision: number): StateMessage => ({
    connection: 1,
    message: { type: 'delta', v: 1, epoch: 1, revision, serverTime: 0, ops } as unknown as DeltaMessage,
  });

  it('an append keeps the rows it already holds, by reference, and takes head, total and dropped from the message', () => {
    const held = [row(1), row(2)];
    const full = { ...state, audit: { rows: held, head: 'h2', total: 2, dropped: 0 } };
    const patch = foldStateMessages(full, [delta([{ op: 'append', slice: 'audit', rows: [row(3)], head: 'h3', total: 3, dropped: 0 }], 1)], shareStructure);
    expect(Object.keys(patch)).toEqual(['audit']);
    expect(patch.audit).toMatchObject({ head: 'h3', total: 3, dropped: 0 });
    expect(patch.audit?.rows).toHaveLength(3);
    expect(patch.audit?.rows[0]).toBe(held[0]);
    expect(patch.audit?.rows[1]).toBe(held[1]);
  });

  it(`the audit ring holds at most ${AUDIT_RING_SIZE} rows and the event ring ${EVENT_RING_SIZE}: the oldest go`, () => {
    const rows = Array.from({ length: AUDIT_RING_SIZE }, (_, index) => row(index + 1));
    const events = Array.from({ length: EVENT_RING_SIZE }, (_, index) => event(index + 1));
    const full = { ...state, audit: { rows, head: 'h', total: AUDIT_RING_SIZE, dropped: 0 }, events };
    const patch = foldStateMessages(
      full,
      [
        delta(
          [
            { op: 'append', slice: 'audit', rows: [row(AUDIT_RING_SIZE + 1), row(AUDIT_RING_SIZE + 2)], head: 'x', total: AUDIT_RING_SIZE + 2, dropped: 2 },
            { op: 'append', slice: 'events', rows: [event(EVENT_RING_SIZE + 1)] },
          ],
          1,
        ),
      ],
      shareStructure,
    );
    expect(patch.audit?.rows).toHaveLength(AUDIT_RING_SIZE);
    expect(patch.audit?.rows[0]).toBe(rows[2]);
    expect(patch.audit?.rows.at(-1)?.seq).toBe(AUDIT_RING_SIZE + 2);
    expect(patch.audit).toMatchObject({ head: 'x', total: AUDIT_RING_SIZE + 2, dropped: 2 });
    expect(patch.events).toHaveLength(EVENT_RING_SIZE);
    expect(patch.events?.[0]).toBe(events[1]);
    expect(patch.events?.at(-1)?.seq).toBe(EVENT_RING_SIZE + 1);
  });

  it('several messages fold into one patch, in order; ops of one delta apply in order', () => {
    const patch = foldStateMessages(
      state,
      [
        delta([{ op: 'replace', slice: 'activeCameraId', value: 'VIDEO-02' }, { op: 'append', slice: 'events', rows: [event(1)] }], 1),
        delta([{ op: 'append', slice: 'events', rows: [event(2)] }, { op: 'replace', slice: 'activeCameraId', value: 'VIDEO-01' }], 2),
      ],
      shareStructure,
    );
    // The camera went there and back: it is not in the patch at all.
    expect(Object.keys(patch)).toEqual(['events']);
    expect(patch.events?.map((entry) => entry.seq)).toEqual([1, 2]);

    // Inside ONE delta the order decides: a replace and then an append on the same slice, and two replaces of one slice.
    const ordered = foldStateMessages(
      state,
      [
        delta(
          [
            { op: 'replace', slice: 'events', value: [event(7)] },
            { op: 'append', slice: 'events', rows: [event(8)] },
            { op: 'replace', slice: 'activeCameraId', value: 'VIDEO-01' },
            { op: 'replace', slice: 'activeCameraId', value: 'VIDEO-02' },
          ],
          3,
        ),
      ],
      shareStructure,
    );
    expect(ordered.events?.map((entry) => entry.seq)).toEqual([7, 8]);
    expect(ordered.activeCameraId).toBe('VIDEO-02');
  });

  it('a snapshot in the list replaces every slice; no message and an equal snapshot give an empty patch', () => {
    expect(foldStateMessages(state, [], shareStructure)).toEqual({});
    const same: StateMessage = { connection: 1, message: { type: 'snapshot', v: 1, epoch: 1, revision: 0, serverTime: 0, state: JSON.parse(JSON.stringify(wire(state))) } as unknown as SnapshotMessage };
    expect(foldStateMessages(state, [same], shareStructure)).toEqual({});
    const other = { ...wire(state), activeCameraId: 'VIDEO-02', lastSealedAcknowledged: false };
    const changed: StateMessage = { connection: 1, message: { type: 'snapshot', v: 1, epoch: 1, revision: 1, serverTime: 0, state: other } as unknown as SnapshotMessage };
    expect(foldStateMessages(state, [changed], shareStructure)).toEqual({ activeCameraId: 'VIDEO-02', lastSealedAcknowledged: false });
  });

  it('replacementPatch names only the slices that differ; the five client-built slices are never in a patch', () => {
    const next = { ...state, operators: [], settings: { ...state.settings, presentationMode: true } };
    const patch = replacementPatch(state, next, shareStructure);
    expect(patch).toEqual({ settings: { ...state.settings, presentationMode: true } });
    const everything = replacementPatch(state, createNeutralState(5), shareStructure);
    for (const name of UNREPLICATED_SLICE_NAMES) expect(Object.keys(everything)).not.toContain(name);
  });
});

describe('the neutral state: what a client holds while it holds no Core data (§2.3)', () => {
  it('is a whole SimState with no Core data in it, and every selector runs on it', () => {
    const neutral = createNeutralState(1_790_823_600_000);
    expect(Object.keys(neutral).sort()).toEqual([...REPLICATED_SLICE_NAMES, ...UNREPLICATED_SLICE_NAMES].sort());
    for (const [name, select] of UNARY_SELECTORS) expect(() => select(neutral), name).not.toThrow();
    expect(neutral.operators).toEqual([]);
    expect(neutral.evidence).toEqual([]);
    expect(neutral.audit.rows).toEqual([]);
    expect(neutral.session).toBeNull();
    expect(neutral.device.id).toBe('');
    expect(neutral.auth).toEqual({ status: 'SIGNED_OUT', operatorId: null, method: null, issuedAt: null, lastActivityAt: null });
    expect(neutral.pairing.state).toBe('UNPAIRED');
    expect(neutral.audio.inputs['MIC-01']).toMatchObject({ noSignal: true, dbfs: -90 });
    expect(selectors.selectIsSignedIn(neutral)).toBe(false);
    expect(selectors.selectLockout(neutral)).toEqual({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5 });
  });
});
