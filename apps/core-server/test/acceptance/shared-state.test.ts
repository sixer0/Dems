// Acceptance test "two-client shared state with resync" of the DEMS Core server (plan row W49;
// success criterion SC3; AC-B-44 to AC-B-47; spec §9 RT-1 to RT-7, §9.2, §9.5).
//
// WHAT IS ASKED. Two clients connected to the same Core see the same state; what one does, the
// other sees; a client that lost its socket catches up.
//
// WHAT IS REAL. The server: the real app factory on a clone of the seed, as `dems_app`, every
// stage as the server has it, the engine BOOTED, a real listener on `127.0.0.1` at an ephemeral
// port. The clients: the SHARED Live source (`createLiveSim`) with the typed client and the Live
// socket client, unchanged, over Node's own `fetch` and `WebSocket`. Client A is a web console
// (a web console origin, the cookie, the INVESTIGATOR). Client B is a second client of ANOTHER
// operator (the SUPERVISOR), and the scenario runs twice with two kinds of B:
//   (i)  a second web console;
//   (ii) a paired tablet (its own origin, a bearer value; its socket also brings up the Core link).
// Every command is a real request through the real session routes.
//
// WHAT IS THE TEST'S. The server clock (a manual clock) and the timers of the engine and of the
// channel (manual): the engine ticks and the channel beats and paces when the test says so, so no
// test waits for the server. The real waits are polls for a socket event or an answered request,
// each with a cap (`shared-state.support.ts`). B reaches the Core through a TCP relay of the test:
// the network between B and the Core, which the test can cut and hold down.
//
// HOW EQUALITY IS ASKED. Never by counting how many deltas a step produced: after each step the
// test waits for a heartbeat sent AFTER the step on each client's socket (frames keep their
// order), then compares, at the engine's revision of that moment and slice by slice, three things
// with `app.engine.state()`: the Live store of each client, and a second replica that this test
// builds from the recorded frames by the rule of spec §9.3 alone.
//
// THE TESTS.
//   SC3 (i), (ii)   the scenario of AC-B-44 to AC-B-47, once per kind of B: equal after every
//                   step, the drop, the reconnect, a fresh client, an explicit resync, and what
//                   nobody may be sent;
//   RT-7            a new epoch under the same listener, twice: the engine stopped and started
//                   again, and a REAL demo reset through the demo route on a clone of this file;
//   can it fail?    shown by changes of the test's INPUT only: the deltas of a command withheld
//                   on their way to B (the equality assertion is red until B resyncs), and a frame
//                   with a member the contract does not name (the validation assertion is red).
//
// Secrets (P19). A cookie, a session token, a device credential and a pairing code are taken from
// an answer and handed on. None is printed, logged, put into a test name or into the message of an
// assertion.
import { DEMO_OPERATOR_PASSWORD, OPERATORS } from '@dems/shared/sim';
import { performance } from 'node:perf_hooks';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { RESET, testRoutine, useRoutine } from '../../src/modules/demo/__tests__/support';
import { useTestDatabase } from '../helpers/db';
import { roleUrl } from '../support/admin';
import { credentialLeaks } from '../support/config';
import { OWN_ORIGIN, WEB_ORIGIN, signInOnWeb, webPost, type IdentityTarget } from '../support/identity';
import { pairDevice } from '../support/pairing';
import { maintenancePool, resetApplicationName } from '../support/reset';
import {
  EVENT_CAP_MS,
  NEVER_A_SLICE,
  RECONNECT_CAP_MS,
  differingSlices,
  digestOf,
  forbiddenContent,
  frameProblems,
  kindsOf,
  openDemoStage,
  openStage,
  positionText,
  replicaProblems,
  sequenceProblems,
  stateMessagesOf,
  wire,
  type EndState,
  type LiveClient,
  type Position,
  type Relay,
  type Slices,
  type Stage,
  type StageCore,
  type Wire,
} from './shared-state.support';

const db = useTestDatabase({ template: 'seed' });

// Caps, not waits: a clone made inside a test waits for the clone lock, which the runs of other
// rows may hold on a loaded host; a scenario itself takes a few seconds.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const INVESTIGATOR = OPERATORS[0]!;
/** The seeded operator who holds `USER_ADMIN` and `PAIRING_MANAGE`. */
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;

const FIRST_SESSION = {
  caseNumber: 'LP/2026/1004-0071',
  subjectType: 'SAKSI',
  subjectName: 'Test Subject',
  investigatorId: INVESTIGATOR.id,
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;
const SECOND_SESSION = { ...FIRST_SESSION, caseNumber: 'LP/2026/1004-0072' } as const;
const MARKER = 'Key statement';
/** A valid stop reason: at least five characters (AC-B-50). */
const STOP_REASON = 'Interview completed';

/** The engine resolves the eight checks within 4.9 s, and finalises a stopped recording within 20 s. */
const PRECHECK_MS = 5_000;
const RECORDING_MS = 2_000;
const FINALIZE_MS = 20_000;
/** Spec §6.8: the Core link goes OFFLINE 5 s after the last device socket closed; the pace step finds it. */
const LINK_DEBOUNCE_MS = 5_250;
/** A demo reset rebuilds the database: about a second on a quiet host. The cap is for a loaded one. */
const RESET_CAP_MS = 90_000;

const NOTHING_LEFT: EndState = { listening: [], accepting: [], openClientSockets: [], openServerSockets: 0, hubSockets: 0 };

// ── The stages of this file ────────────────────────────────────────────────────────────────────

const open: StageCore[] = [];
const durations: string[] = [];
let stagesOpened = 0;

/** A booted server for one test: the first takes the file's own clone, every later one an untouched clone of its own. */
async function stageOn(slug: string): Promise<Stage> {
  let target: IdentityTarget = db;
  if (stagesOpened > 0) {
    const extra = await db.another({ slug });
    target = { runtime: extra.runtime, run: { dataDir: db.run.dataDir }, onCleanup: (close) => extra.onCleanup(close) };
  }
  stagesOpened += 1;
  const stage = await openStage(target);
  open.push(stage);
  return stage;
}

afterEach(async () => {
  // A test that passed closed its stage itself and looked at what was left; this is for one that failed.
  for (const stage of open.splice(0)) await stage.close();
});

afterAll(() => {
  console.info(`[w49] durations: ${durations.join('; ')}`);
});

async function timed<T>(name: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await run();
  } finally {
    durations.push(`${name} ${Math.round(performance.now() - started)} ms`);
  }
}

// ── A scene: one stage, its clients, and what the test writes down ─────────────────────────────

interface Scene {
  readonly stage: StageCore;
  /** `(i) web + web`, … : the head of every printed line. */
  readonly tag: string;
  readonly started: number;
}

function say(scene: Scene, text: string): void {
  console.info(`[w49] ${scene.tag}: ${text}`);
}

/** Milliseconds of real time since the scene began. */
const elapsed = (scene: Scene): string => `+${Math.round(performance.now() - scene.started)} ms`;

const enginePosition = (stage: StageCore): Position => ({ epoch: stage.engine.epoch, revision: stage.engine.revision });

/**
 * THE EQUALITY ASSERTION. Flushes what waits for the pace step, waits for a heartbeat sent after
 * it on each client's socket, then asks that every client holds `app.engine.state()` at the
 * engine's position: its socket client's position, its Live store slice by slice, and the replay
 * of its frames slice by slice. A `patient` client is one whose Live source may still hold the
 * state of a new socket back (the session of a reconnected or freshly started client is confirmed
 * with one request first): for it the test waits, with a cap, until the store shows the position.
 */
async function compare(scene: Scene, step: string, clients: readonly LiveClient[], patient: readonly LiveClient[] = []): Promise<Position> {
  const { stage } = scene;
  stage.channel.pace();
  await stage.channel.settled();
  await stage.engine.idle();
  await stage.barrier(step, clients.map((client) => client.station.wire()));
  const position = enginePosition(stage);
  const engineState = wire(stage.engine.state()) as unknown as Slices;
  let turns = 0;
  if (patient.length > 0) {
    turns = await stage.until(
      `${step}: the store of ${patient.map((client) => client.name).join(', ')} at ${positionText(position)}`,
      () => replicaProblems(patient, engineState, position).length === 0,
      EVENT_CAP_MS,
      () => replicaProblems(patient, engineState, position).join('; '),
    );
  }
  expect(replicaProblems(clients, engineState, position), `${scene.tag}, ${step}`).toEqual([]);
  expect(enginePosition(stage), `${step}: the engine moved while it was compared`).toEqual(position);
  // The heartbeat of an operator's socket carries the state of the Core's session: the same on every client.
  const sessionState = stage.engine.slice('session')?.state ?? null;
  for (const client of clients) {
    const beat = client.station.wire().frames.findLast((frame) => frame.message?.type === 'heartbeat')?.message;
    expect(beat?.type === 'heartbeat' ? beat.sessionState : undefined, `${step}: the session state in the newest heartbeat of ${client.name}`).toBe(sessionState);
  }
  const digests = clients.map((client) => `${client.name} ${digestOf(client.replica())}`).join(', ');
  say(scene, `${step}: engine ${positionText(position)}; digests ${digests}, engine ${digestOf(engineState)}; 28 of 28 slices equal${patient.length > 0 ? ` (waited ${turns} turn(s) for ${patient.map((client) => client.name).join(', ')})` : ''}`);
  return position;
}

/**
 * ONE COMMAND of a client through its Live source, and what the criteria ask of it:
 *   AC-B-47  the sender's store shows the effect in the turn its action settles, and a replica
 *            that applied exactly the revision the answer named shows it (the sender's and every
 *            watcher's, by the frames alone);
 *   RT-5     the delta that holds the effect has a revision of at most the one the answer named;
 *   AC-B-44  every watcher was sent the delta of each revision the command produced;
 *   SC3      afterwards every client holds `app.engine.state()`.
 */
async function command<T>(
  scene: Scene,
  name: string,
  actor: LiveClient,
  watchers: readonly LiveClient[],
  run: () => PromiseLike<T>,
  effect: (state: Slices) => boolean,
): Promise<T> {
  const { stage } = scene;
  const before = enginePosition(stage);
  const answeredBefore = actor.station.answers.length;
  expect(effect(actor.replica()), `${name}: the effect is not in the sender's store before the command`).toBe(false);

  let shownAtSettlement: boolean | null = null;
  const value = await run().then((result) => {
    // Inside the settlement of the Live result: the turn in which the store took the answer's revision.
    shownAtSettlement = effect(actor.replica());
    return result;
  });
  const answer = actor.station.answers
    .slice(answeredBefore)
    .filter((entry) => entry.method === 'POST')
    .at(-1);
  if (answer === undefined || answer.status === null || answer.epoch === null || answer.revision === null) {
    throw new Error(`${name}: no POST was answered with an epoch and a revision (API-7); status ${String(answer?.status ?? 'none')}`);
  }
  expect(answer.status, `${name}: the status of the answer`).toBeGreaterThanOrEqual(200);
  expect(answer.status, `${name}: the status of the answer`).toBeLessThan(300);
  const named: Position = { epoch: answer.epoch, revision: answer.revision };
  expect(named.epoch, `${name}: the epoch of the answer`).toBe(before.epoch);
  expect(named.revision, `${name}: the revision of the answer is later than the one before the command`).toBeGreaterThan(before.revision);
  expect(shownAtSettlement, `${name}: the sender's store shows the effect when its action settles (AC-B-47)`).toBe(true);

  const position = await compare(scene, name, [actor, ...watchers]);
  expect(position.revision, `${name}: the engine is at or beyond the revision of the answer`).toBeGreaterThanOrEqual(named.revision);

  // By the frames alone: at the revision the answer named the effect is there, before the command it is not.
  for (const client of [actor, ...watchers]) {
    const held = client.station.shadow.at(named);
    expect(held !== undefined, `${name}: ${client.name} was handed every revision up to ${positionText(named)}`).toBe(true);
    expect(held !== undefined && effect(held), `${name}: a replica of ${client.name} at ${positionText(named)} shows the effect (AC-B-47)`).toBe(true);
    const earlier = client.station.shadow.at(before);
    expect(earlier !== undefined && !effect(earlier), `${name}: a replica of ${client.name} at ${positionText(before)} does not show it yet`).toBe(true);
  }
  let holder: number | null = null;
  for (let revision = before.revision + 1; revision <= named.revision && holder === null; revision += 1) {
    const held = actor.station.shadow.at({ epoch: named.epoch, revision });
    if (held !== undefined && effect(held)) holder = revision;
  }
  expect(holder, `${name}: a delta between ${positionText(before)} and ${positionText(named)} holds the effect (RT-5)`).not.toBeNull();
  for (const watcher of watchers) {
    const deltas = stateMessagesOf(watcher.station.wire())
      .filter((message) => message.type === 'delta')
      .map((message) => positionText(message.position));
    for (let revision = before.revision + 1; revision <= named.revision; revision += 1) {
      expect(deltas, `${name}: ${watcher.name} was sent the delta of revision ${revision} (AC-B-44)`).toContain(positionText({ epoch: named.epoch, revision }));
    }
  }
  say(
    scene,
    `${name}: answered ${answer.status} with ${positionText(named)} (before: ${positionText(before)}); the effect is in the delta of revision ${String(holder)}; ` +
      `${actor.name}'s store showed it when the action settled${watchers.length > 0 ? `; ${watchers.map((watcher) => watcher.name).join(', ')} got every delta up to ${named.revision}` : ''}`,
  );
  return value;
}

const sessionOf = (state: Slices): { state?: string; input?: { caseNumber?: string }; markerCount?: number; stopReason?: string | null } | null =>
  (state['session'] ?? null) as { state?: string; input?: { caseNumber?: string }; markerCount?: number; stopReason?: string | null } | null;

/** A signed-in web console on its OPERATOR socket, past its snapshot. */
async function signedInConsole(scene: Scene, name: string, operator: { username: string; id: string }, through?: Relay): Promise<LiveClient> {
  const { stage } = scene;
  const client = stage.web(name, through === undefined ? {} : { through });
  await client.live.ready;
  expect(client.live.session, `${name} starts signed out`).toBeNull();
  await stage.until(`${name}: its anonymous link`, () => client.live.link === 'ONLINE');
  expect(client.live.socketStatus()).toMatchObject({ principal: 'ANONYMOUS', helloReason: null });
  const signedIn = await client.live.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD);
  expect(signedIn).toMatchObject({ ok: true, operatorId: operator.id });
  expect(client.live.socketStatus()).toMatchObject({ principal: 'OPERATOR', synced: true });
  expect(client.live.session).toMatchObject({ operator: { id: operator.id } });
  return client;
}

/** What every scenario asks of everything every socket received, and of what the clients reported. */
function expectCleanTraffic(scene: Scene, clients: readonly LiveClient[]): void {
  const { stage } = scene;
  // AC-B-46: every frame of every socket, of every kind, validates against the contract's union.
  expect(frameProblems(stage.wires), 'frames that are no message of the contract').toEqual([]);
  // AC-B-46, RT-2: on every socket the revisions are gap-free within an epoch, and nothing goes back.
  expect(sequenceProblems(stage.wires), 'state messages out of sequence').toEqual([]);
  // Spec §9.2, §9.5: nothing a socket must not be sent.
  expect(forbiddenContent(stage.wires), 'what a socket must not be sent').toEqual([]);
  for (const client of clients) {
    // What the client was handed was gap-free too: nothing made it resynchronise but the test's own request.
    expect(client.station.shadow.gaps, `${client.name}: gaps in what it was handed`).toEqual([]);
    expect(client.clientReports.map((report) => `${report.operationId} ${report.kind}`), `${client.name}: answers that were not the contract's`).toEqual([]);
    expect(client.reports.filter((report) => report.level === 'error').map((report) => `${report.source}: ${report.message}`), `${client.name}: error reports of its Live source`).toEqual([]);
    const { invalid, deltasDropped } = client.live.socketStatus().counters;
    expect({ invalid, deltasDropped }, `${client.name}: frames its socket client refused or dropped`).toEqual({ invalid: 0, deltasDropped: 0 });
  }
  // SR-49: the server's log of the whole scenario holds nothing that looks like a credential.
  expect(credentialLeaks(stage.log.text())).toEqual([]);
  const frames = stage.wires.reduce((sum, socket) => sum + socket.frames.length, 0);
  const bytes = stage.wires.reduce((sum, socket) => sum + socket.frames.reduce((inner, frame) => inner + frame.bytes, 0), 0);
  say(scene, `every frame validated against the contract's union: ${frames} frames (${bytes} bytes) on ${stage.wires.length} sockets, 0 refused; 0 out of sequence; 0 forbidden`);
}

/** The message kinds each owner of a socket received, with counts: one line per owner. */
function sayKinds(scene: Scene): void {
  const owners = [...new Set(scene.stage.wires.map((socket) => socket.owner))];
  for (const owner of owners) {
    const sockets = scene.stage.wires.filter((socket) => socket.owner === owner);
    const principals = sockets.map((socket) => socket.hello?.principal ?? 'refused').join(' → ');
    say(scene, `received by ${owner} over ${sockets.length} socket(s) (${principals}): ${JSON.stringify(kindsOf(sockets))}`);
  }
}

// ── SC3: the scenario, twice ───────────────────────────────────────────────────────────────────

describe.each([
  { kind: 'web', tag: '(i) web + web', slug: 'w49_web' },
  { kind: 'tablet', tag: '(ii) web + tablet', slug: 'w49_tab' },
] as const)('SC3, AC-B-44 to AC-B-47: two clients on one Core, $tag', ({ kind, tag, slug }) => {
  // In full: A and B take the snapshot; after create, pre-check, start, marker and stop the
  // replicas of A and B equal `app.engine.state()` slice by slice; B is dropped while A runs two
  // commands, reconnects by itself and equals a fresh client; an explicit resync gives the same;
  // every frame validates against the union, and nobody is sent what is not theirs.
  it('equal after every step; B dropped, back and equal to a fresh client; an explicit resync; every frame valid', async () => {
    await timed(tag, async () => {
      const stage = await stageOn(slug);
      const scene: Scene = { stage, tag, started: performance.now() };

      // Two sessions that are no socket client: the portal's administrator (pairing, a role
      // change) and the third operator, whose console is opened later as the FRESH client.
      const admin = await signInOnWeb(stage.identity, SUPERVISOR.username);
      const third = await signInOnWeb(stage.identity, TECHNICIAN.username);

      // One socket without a credential for the whole scenario: what does an anonymous caller get?
      const anonymous = stage.bare('anonymous', { origin: WEB_ORIGIN });
      await stage.until('the anonymous hello', () => anonymous.wire.hello !== null);
      expect(anonymous.wire.hello).toMatchObject({ principal: 'ANONYMOUS', topics: ['heartbeat'] });

      // ── Client A: a web console, the investigator ──
      const a = await signedInConsole(scene, 'A', INVESTIGATOR);
      expect(a.live.socketStatus().topics).toEqual(['heartbeat', 'control', 'state', 'meters']);

      // ── Client B: another operator, behind the relay ──
      const relay = await stage.relay();
      let b: LiveClient;
      if (kind === 'web') {
        b = await signedInConsole(scene, 'B', SUPERVISOR, relay);
        expect(b.live.socketStatus().topics).toEqual(['heartbeat', 'control', 'state', 'meters', 'admin']);
        // The Core link needs a real socket of a paired device (finding F69): a tablet that only holds the link.
        const device = await pairDevice(stage.pairing, admin.cookie, 'W49 link tablet');
        const link = stage.bare('link', { origin: OWN_ORIGIN, authorization: `Bearer ${device.credential}` });
        await stage.until('the hello of the device that holds the link', () => link.wire.hello !== null);
        expect(link.wire.hello).toMatchObject({ principal: 'DEVICE', topics: ['heartbeat', 'control'] });
      } else {
        const device = await pairDevice(stage.pairing, admin.cookie, 'W49 tablet B');
        b = stage.tablet('B', { credential: device.credential, name: 'W49 tablet B' }, { through: relay });
        await b.live.ready;
        await stage.until('the tablet on its DEVICE socket', () => b.live.link === 'ONLINE' && b.live.socketStatus().principal === 'DEVICE');
        const signedIn = await b.live.actions.signIn(SUPERVISOR.username, DEMO_OPERATOR_PASSWORD);
        expect(signedIn).toMatchObject({ ok: true, operatorId: SUPERVISOR.id });
        expect(b.live.socketStatus()).toMatchObject({ principal: 'OPERATOR', synced: true });
        expect(b.live.socketStatus().topics).toEqual(['heartbeat', 'control', 'state', 'meters', 'admin']);
      }
      await stage.channel.settled();
      expect(stage.engine.slice('tabletLink').state, 'a paired device holds a socket: the Core link').toBe('CONNECTED');

      // ── AC-B-44: both took the snapshot; then every step of a session, driven by A ──
      await compare(scene, 'A and B took the snapshot', [a, b]);

      const created = await command(scene, 'createSession', a, [b], () => a.live.actions.createSession(FIRST_SESSION), (state) => sessionOf(state)?.input?.caseNumber === FIRST_SESSION.caseNumber);
      expect(created).toMatchObject({ ok: true, created: true });
      expect(sessionOf(b.replica())?.state, 'B sees the session A created').toBe('CREATE');

      await command(scene, 'beginPrecheck', a, [b], () => a.live.actions.beginPrecheck(), (state) => sessionOf(state)?.state === 'PRECHECK');
      await stage.drive(PRECHECK_MS);
      await compare(scene, 'the pre-check ran (5 s of the engine)', [a, b]);
      if (stage.engine.slice('session')?.state === 'PRECHECK') {
        await command(scene, 'acknowledgePrecheckWarnings', a, [b], () => a.live.actions.acknowledgePrecheckWarnings(), (state) => sessionOf(state)?.state === 'ARMED');
      }
      expect(stage.engine.slice('session')?.state).toBe('ARMED');

      await command(scene, 'startRecording', a, [b], () => a.live.actions.startRecording(), (state) => sessionOf(state)?.state === 'RECORDING');
      expect(sessionOf(b.replica())?.state, 'B sees the recording A started').toBe('RECORDING');
      await stage.drive(RECORDING_MS);
      await compare(scene, 'recording (2 s of the engine)', [a, b]);

      await command(scene, 'addMarker', a, [b], () => a.live.actions.addMarker(MARKER), (state) => sessionOf(state)?.markerCount === 1);

      await command(scene, 'stopRecording', a, [b], () => a.live.actions.stopRecording(STOP_REASON), (state) => sessionOf(state)?.stopReason === STOP_REASON);
      expect(sessionOf(b.replica()), 'B sees the stop and its reason').toMatchObject({ stopReason: STOP_REASON });
      await stage.drive(FINALIZE_MS);
      await compare(scene, 'finalised and sealed (20 s of the engine)', [a, b]);
      expect(sessionOf(b.replica())?.state).toBe('SEALED');
      const sealedId = stage.engine.slice('lastSealedSessionId') ?? '';
      expect(sealedId).not.toBe('');

      // Meter frames reached both clients while the engine ticked; none of them is a slice of a replica.
      expect(a.live.socketStatus().counters.meters).toBeGreaterThan(100);
      expect(b.live.socketStatus().counters.meters).toBeGreaterThan(100);

      // ── AC-B-45: B's socket is dropped while A runs two more commands ──
      const droppedAt = enginePosition(stage);
      const droppedWire = b.station.wire();
      const droppedConnection = b.live.socketStatus().connectionId;
      const wiresAtDrop = b.station.wires.length;
      const answersAtDrop = b.station.answers.length;
      const dropStarted = performance.now();
      const sinceDrop = (): string => `+${Math.round(performance.now() - dropStarted)} ms`;
      let how: string;
      if (kind === 'web') {
        // From the SERVER side: the server destroys the stream of B's socket. No close frame, no
        // `session.ended`. The relay refuses B's new connections until the test lets it back.
        relay.refuse();
        expect(stage.terminateServerSide(relay.upstreamPorts()), "sockets of B's that the server destroyed").toBe(1);
        how = 'the server destroyed the stream of its socket (no close frame); new connections of B are refused';
      } else {
        // From the NETWORK side: every TCP connection between the tablet and the Core is
        // destroyed, both legs, and new ones are refused.
        expect(relay.cut(), 'connections of the tablet that the cut destroyed').toBeGreaterThanOrEqual(1);
        how = 'the network between the tablet and the Core was cut (both TCP legs destroyed, new connections refused)';
      }
      await stage.until('B to see its socket closed', () => droppedWire.closed !== null);
      await stage.until("the hub to forget B's socket", () => !stage.channel.connections().some((connection) => connection.connectionId === droppedConnection));
      await stage.until("B's link to be OFFLINE", () => b.live.link === 'OFFLINE');
      expect(droppedWire.closed, 'an abnormal closure: no close frame arrived').toEqual({ code: 1006, clean: false });
      expect(droppedWire.frames.some((frame) => frame.type === 'session.ended' || frame.type === 'device.revoked'), 'B was not told that anything ended').toBe(false);
      say(scene, `drop: B at ${positionText(droppedAt)}; ${how}; B's link OFFLINE ${sinceDrop()}`);

      await command(scene, 'acknowledgeSummary (B is away)', a, [], () => a.live.actions.acknowledgeSummary(sealedId), (state) => state['lastSealedAcknowledged'] === true);
      if (kind === 'tablet') {
        // The tablet was the device that held the Core link: 5 s of the server clock later the link is OFFLINE, and A sees it.
        await stage.drive(LINK_DEBOUNCE_MS);
        await compare(scene, 'the Core link went OFFLINE (B is away)', [a]);
        expect(stage.engine.slice('tabletLink').state).toBe('OFFLINE');
        expect(a.replica()['tabletLink']).toMatchObject({ state: 'OFFLINE' });
        // The outage outlasts the tablet's first reconnect (500 ms plus jitter): that attempt is
        // refused, and its socket client tries again by its backoff (1,000 ms plus jitter).
        await stage.until("the tablet's first reconnect attempt to be refused", () => relay.counters.refused >= 1, RECONNECT_CAP_MS);
        say(scene, `while B is away: its first reconnect attempt was refused ${sinceDrop()}`);
      }
      await command(scene, 'createSession, the second (B is away)', a, [], () => a.live.actions.createSession(SECOND_SESSION), (state) => sessionOf(state)?.input?.caseNumber === SECOND_SESSION.caseNumber);
      const missedUpTo = enginePosition(stage);

      // B holds what it held at the drop: it is behind, and the equality assertion says so.
      expect(b.position(), 'B is where it was dropped').toEqual(droppedAt);
      const stale = differingSlices(b.replica(), wire(stage.engine.state()) as unknown as Slices);
      expect(stale, 'slices in which B is behind while it is away').toEqual(expect.arrayContaining(['session', 'lastSealedAcknowledged', 'audit']));
      say(scene, `while B is away: A ran two commands, the engine is at ${positionText(missedUpTo)}; B holds ${positionText(b.position())} and is behind in ${stale.length} slice(s): ${stale.join(', ')}`);

      // The network is back. Nobody tells B: its socket client reconnects by its own backoff (RT-P2).
      relay.accept();
      const restored = sinceDrop();
      await stage.until(
        'B to be back on a new socket, synced',
        () => b.station.wire() !== droppedWire && b.station.wire().hello !== null && b.live.link === 'ONLINE' && b.live.socketStatus().synced,
        RECONNECT_CAP_MS,
        () => `link ${b.live.link}, ${b.station.wires.length - wiresAtDrop} socket(s) opened since the drop`,
      );
      const back = sinceDrop();
      const returned = b.station.wire();
      await compare(scene, 'B is back', [a, b], [b]);
      const stored = sinceDrop();

      // RT-6: a reconnect starts with a snapshot at the engine's position; no delta is replayed.
      const afterReturn = stateMessagesOf(returned);
      expect(afterReturn[0]?.type, 'the first state message of the new socket').toBe('snapshot');
      expect(afterReturn[0]?.position.epoch).toBe(missedUpTo.epoch);
      expect(afterReturn[0]?.position.revision, 'the snapshot holds both commands B missed').toBeGreaterThanOrEqual(missedUpTo.revision);
      expect(afterReturn.filter((message) => message.type === 'delta' && message.position.revision <= (afterReturn[0]?.position.revision ?? 0)), 'deltas replayed after the snapshot').toEqual([]);
      expect(returned.hello).toMatchObject({ principal: 'OPERATOR' });
      expect(b.resyncs.at(-1), 'the socket client told its consumer that the link is back').toEqual({ phase: 'RESYNCED', cause: 'RECONNECT' });
      // After a reconnect the Live source confirms its session with ONE request before it shows the new socket's state.
      const confirmations = b.station.answers.slice(answersAtDrop).filter((entry) => entry.path === '/api/v1/auth/session');
      expect(confirmations.map((entry) => `${entry.method} ${entry.status}`), 'the session of the reconnected client is confirmed once').toEqual(['GET 200']);
      const attempts = b.station.wires.slice(wiresAtDrop);
      const refusedAttempts = attempts.filter((socket) => !socket.opened).length;
      say(
        scene,
        `resync by reconnect: network restored ${restored}; ${refusedAttempts} attempt(s) of B were refused while it was down; B's socket #${returned.number} synced ${back} ` +
          `with a snapshot at ${positionText(afterReturn[0]?.position ?? null)}; one GET /api/v1/auth/session; B's store equal to the engine ${stored}`,
      );
      if (kind === 'tablet') {
        await stage.channel.settled();
        expect(stage.engine.slice('tabletLink').state, 'the tablet is back: the Core link').toBe('CONNECTED');
      }

      // ── AC-B-45: B equals a client that takes a fresh snapshot at this moment ──
      const thirdCookie = third.cookie['cookie'];
      if (thirdCookie === undefined) throw new Error('the sign-in of the third operator gave no cookie');
      const c = stage.web('C', { cookie: thirdCookie });
      await c.live.ready;
      await stage.until("C's link", () => c.live.link === 'ONLINE' && c.live.socketStatus().synced);
      expect(c.live.session).toMatchObject({ operator: { id: TECHNICIAN.id } });
      const fresh = await compare(scene, 'a fresh client C joined: B = C = engine', [a, b, c], [c]);
      const freshSnapshot = stateMessagesOf(c.station.wire())[0];
      if (freshSnapshot === undefined) throw new Error('C was sent no state message');
      expect(freshSnapshot.type).toBe('snapshot');
      expect(freshSnapshot.position.epoch, "C's snapshot is of this epoch").toBe(fresh.epoch);
      expect(freshSnapshot.position.revision, "C's snapshot is not behind what B was sent at its reconnect").toBeGreaterThanOrEqual(afterReturn[0]?.position.revision ?? 0);
      // The snapshot as it was sent to the fresh client, against what B held at that very position, and both stores now.
      const freshState = (freshSnapshot.frame.json as { state: Slices }).state;
      const heldByB = b.station.shadow.at(freshSnapshot.position);
      expect(heldByB !== undefined, `B stood at ${positionText(freshSnapshot.position)}, the position of the fresh client's snapshot`).toBe(true);
      expect(differingSlices(heldByB ?? {}, freshState), 'slices in which B differs from the snapshot a fresh client was sent').toEqual([]);
      expect(differingSlices(b.replica(), c.replica()), "slices in which B's store differs from the fresh client's").toEqual([]);

      // ── RT-6: an explicit resync of B gives the same ──
      const snapshotsBefore = stateMessagesOf(returned).filter((message) => message.type === 'snapshot').length;
      expect(b.socketClient().requestResync(), 'a resync is pending').toBe(true);
      await stage.until('the snapshot that answers the resync', () => stateMessagesOf(returned).filter((message) => message.type === 'snapshot').length === snapshotsBefore + 1);
      await stage.until('RESYNCED', () => b.resyncs.at(-1)?.phase === 'RESYNCED' && b.resyncs.at(-1)?.cause === 'REQUESTED');
      expect(b.resyncs.slice(-2)).toEqual([
        { phase: 'RESYNCING', cause: 'REQUESTED' },
        { phase: 'RESYNCED', cause: 'REQUESTED' },
      ]);
      expect(returned.sent.filter((type) => type === 'resync')).toHaveLength(1);
      const resynced = await compare(scene, 'B asked for a resync: B = C = engine', [a, b, c]);
      const answerToResync = stateMessagesOf(returned).filter((message) => message.type === 'snapshot').at(-1)?.position;
      expect(answerToResync?.epoch, 'the answer to the resync').toBe(resynced.epoch);
      expect(answerToResync?.revision ?? -1, 'the answer to the resync is the state of now, not of the reconnect').toBeGreaterThanOrEqual(fresh.revision);
      expect(differingSlices(b.replica(), c.replica())).toEqual([]);

      // ── Another operator's session events: C's role changes, then B signs out ──
      const roleChanged = await webPost(stage.app, roleUrl(TECHNICIAN.id), admin.cookie, { role: 'INVESTIGATOR', reason: 'W49: a session event of one operator' });
      expect(roleChanged.statusCode).toBe(200);
      await stage.app.pipeline.drain();
      await stage.until("C's session.updated", () => c.control.some((message) => message.type === 'session.updated'));
      await compare(scene, "C's role changed: A = B = C = engine", [a, b, c]);
      expect(c.control.filter((message) => message.type === 'session.updated')).toEqual([
        expect.objectContaining({ type: 'session.updated', operator: { id: TECHNICIAN.id, role: 'INVESTIGATOR' }, reason: 'ROLE_CHANGED' }),
      ]);

      const signedOutWire = b.station.wire();
      await b.live.actions.signOut('USER');
      await stage.until("B's session.ended", () => signedOutWire.frames.some((frame) => frame.type === 'session.ended'));
      await stage.until('B on the socket of a client that is signed out', () => b.station.wire() !== signedOutWire && b.live.link === 'ONLINE');
      expect(b.live.socketStatus().principal, 'B after its sign-out').toBe(kind === 'web' ? 'ANONYMOUS' : 'DEVICE');
      expect(signedOutWire.frames.filter((frame) => frame.type === 'session.ended').map((frame) => (frame.json as { reason: string }).reason)).toEqual(['SIGNED_OUT']);
      await compare(scene, 'B signed out: A = C = engine', [a, c]);

      // ── What nobody may be sent that is not theirs ──
      const typesOf = (owner: string): string[] => Object.keys(kindsOf(stage.wires.filter((socket) => socket.owner === owner)));
      // An anonymous socket: `hello` and `heartbeat` and nothing else, whatever happened on the Core.
      expect(typesOf('anonymous')).toEqual(['hello', 'heartbeat']);
      expect(anonymous.wire.frames.filter((frame) => frame.message?.type === 'heartbeat' && frame.message.sessionState !== null), 'heartbeats with a session state on the anonymous socket').toEqual([]);
      expect(anonymous.wire.frames.length, 'the anonymous socket did hear the heartbeat of the whole scenario').toBeGreaterThan(25);
      // The device that only holds the link: the same two.
      if (kind === 'web') expect(typesOf('link')).toEqual(['hello', 'heartbeat']);
      // A, the investigator: state and meters; no control event of another operator, and no list hint (it holds neither USER_ADMIN nor PAIRING_MANAGE).
      expect(typesOf('A')).toEqual(['hello', 'heartbeat', 'snapshot', 'delta', 'meters']);
      // B, the supervisor: the list hints of the portal, and the end of ITS session; not C's `session.updated`.
      expect(typesOf('B')).toEqual(['hello', 'heartbeat', 'snapshot', 'delta', 'meters', 'session.ended', 'admin.changed']);
      // C: ITS `session.updated`; not B's `session.ended`, and no list hint (neither role it had holds the
      // permission). No meter frame: the engine did not tick after C joined.
      expect(typesOf('C')).toEqual(['hello', 'heartbeat', 'snapshot', 'delta', 'session.updated']);
      // The slices the channel never publishes: in no snapshot and in no delta of any socket.
      const published = new Set<string>();
      for (const socket of stage.wires) {
        for (const frame of socket.frames) {
          const raw = frame.json as { state?: Record<string, unknown>; ops?: Array<{ slice: string }> } | undefined;
          if (frame.type === 'snapshot') for (const name of Object.keys(raw?.state ?? {})) published.add(name);
          if (frame.type === 'delta') for (const op of raw?.ops ?? []) published.add(op.slice);
        }
      }
      expect(NEVER_A_SLICE.filter((name) => published.has(name)), 'slices that must never travel').toEqual([]);
      expect(published.size, 'the snapshots hold the 28 replicated slices').toBe(28);

      expectCleanTraffic(scene, [a, b, c]);
      sayKinds(scene);
      say(scene, `reports of the Live sources: ${JSON.stringify(Object.fromEntries([a, b, c].map((client) => [client.name, client.reports.map((report) => `${report.level} ${report.source}`)])))}`);
      say(scene, `relay: ${JSON.stringify(relay.counters)}; hub: ${JSON.stringify({ healed: stage.channel.stats().healed, slowConsumers: stage.channel.stats().slowConsumers, refusedByCap: stage.channel.stats().refusedByCap })}`);
      expect(stage.channel.stats().healed, 'snapshots the hub sent because a socket was out of position').toBe(0);

      // ── Nothing of the test remains ──
      expect(await stage.close(), 'what the test left behind').toEqual(NOTHING_LEFT);
      say(scene, `closed: no listener, no socket; ${elapsed(scene)}`);
    });
  });
});

// ── RT-7: a new epoch with real sockets ────────────────────────────────────────────────────────

describe('RT-7, a new epoch under the same listener', () => {
  it('the engine stops and starts again: both clients are sent a snapshot of the new epoch without asking, and continue equal', async () => {
    await timed('new epoch', async () => {
      const stage = await stageOn('w49_epoch');
      const scene: Scene = { stage, tag: 'new epoch', started: performance.now() };
      const a = await signedInConsole(scene, 'A', INVESTIGATOR);
      const b = await signedInConsole(scene, 'B', SUPERVISOR);
      const before = await compare(scene, 'A and B took the snapshot', [a, b]);
      await command(scene, 'createSession', a, [b], () => a.live.actions.createSession(FIRST_SESSION), (state) => sessionOf(state)?.input?.caseNumber === FIRST_SESSION.caseNumber);
      const old = enginePosition(stage);
      expect(old.epoch).toBe(before.epoch);

      // What a reload does to the engine, without a reset of the database: stop, then a start that takes a new epoch.
      await stage.engine.stop();
      expect(stage.engine.running).toBe(false);
      // While the engine is stopped the sockets stay open and keep their heartbeat (decision D111 DN-4).
      await stage.barrier('a heartbeat while the engine is stopped', [a.station.wire(), b.station.wire()]);
      expect(stage.channel.stats().operators, 'operator sockets while the engine is stopped').toBe(2);
      await stage.engine.start('resync');
      await stage.engine.idle();

      const renewed = await compare(scene, 'the engine started again: A = B = engine', [a, b]);
      expect(renewed.epoch, 'a new epoch').toBe(old.epoch + 1);
      for (const client of [a, b]) {
        const socket = client.station.wire();
        const firstOfTheEpoch = stateMessagesOf(socket).find((message) => message.position.epoch === renewed.epoch);
        expect(firstOfTheEpoch, `${client.name}: the first state message of the new epoch`).toMatchObject({ type: 'snapshot', position: { epoch: renewed.epoch, revision: 0 } });
        expect(socket.sent.filter((type) => type === 'resync'), `${client.name}: it did not have to ask`).toEqual([]);
        expect(client.live.socketStatus().counters).toMatchObject({ resyncs: 0, reconnects: 0 });
        expect(sessionOf(client.replica())?.input?.caseNumber, `${client.name}: the session is still there`).toBe(FIRST_SESSION.caseNumber);
      }

      // The clients continue in the new epoch: a command of A, its delta at B, equal again.
      await command(scene, 'beginPrecheck, in the new epoch', a, [b], () => a.live.actions.beginPrecheck(), (state) => sessionOf(state)?.state === 'PRECHECK');
      expect(enginePosition(stage).epoch).toBe(old.epoch + 1);
      expect(sessionOf(b.replica())?.state).toBe('PRECHECK');

      expectCleanTraffic(scene, [a, b]);
      sayKinds(scene);
      expect(await stage.close(), 'what the test left behind').toEqual(NOTHING_LEFT);
    });
  });

  it('a real demo reset through the demo route: the snapshot of the new epoch and the session.updated of the operator whose role the seed put back arrive, and both clients continue equal', async () => {
    await timed('demo reset', async () => {
      // WHICH DATABASE IS RESET. A clone of this test's own, made by the helper, and nothing else:
      // the routine accepts it only because `testRoutine` names this run's prefix. The staging and
      // the previous copy it makes carry the same prefix.
      const target = await db.another({ slug: 'w49r' });
      const maintenance = maintenancePool(db.run.dataDir);
      try {
        const stage = await openDemoStage({ runtime: target.runtime, dataDir: db.run.dataDir });
        open.push(stage);
        expect(stage.app.config.demoControls).toBe(true);
        useRoutine(stage.app, testRoutine(target, { runPrefix: db.run.identity.prefix, applicationName: resetApplicationName(db.run.identity.stamp, 'w49'), maintenance }));
        const scene: Scene = { stage, tag: 'demo reset', started: performance.now() };
        const a = await signedInConsole(scene, 'A', INVESTIGATOR);
        const b = await signedInConsole(scene, 'B', SUPERVISOR);
        await compare(scene, 'A and B took the snapshot', [a, b]);

        // B, the supervisor, changes A's role through the typed client of its Live source: A is told, B is not.
        const assigned = await b.live.client.call('assignUserRole', { params: { id: INVESTIGATOR.id }, body: { role: 'TECHNICIAN', reason: 'W49: a role the reset puts back' } });
        expect(assigned).toMatchObject({ ok: true, status: 200 });
        await stage.until("A's session.updated", () => a.control.some((message) => message.type === 'session.updated'));
        await compare(scene, "A's role changed to TECHNICIAN", [a, b]);
        // A session the reset removes, created by B.
        await command(scene, 'createSession (by B)', b, [a], () => b.live.actions.createSession({ ...FIRST_SESSION, investigatorId: SUPERVISOR.id }), (state) => sessionOf(state)?.input?.caseNumber === FIRST_SESSION.caseNumber);
        const before = enginePosition(stage);

        // The reset, asked for by B's browser through the demo route. The test waits for its answer
        // (and keeps the heartbeat going meanwhile): the sockets stay open through it.
        let answered: { status: number; body: string } | null = null;
        const asked = b.station.fetch(`${stage.httpUrl}${RESET}`, { method: 'POST', headers: { accept: 'application/json' }, credentials: 'same-origin' }).then(async (response) => {
          answered = { status: response.status, body: await response.text() };
        });
        const resetStarted = performance.now();
        await stage.until('the answer of the demo reset', () => answered !== null, RESET_CAP_MS);
        await asked;
        const answer = answered as { status: number; body: string } | null;
        expect(answer?.status).toBe(200);
        expect(JSON.parse(answer?.body ?? 'null')).toEqual({ epoch: before.epoch + 1 });
        const resetMs = Math.round(performance.now() - resetStarted);

        // RT-7: a snapshot of the new epoch on every operator socket, without a `resync`; and the
        // operator whose role the seed put back is told (spec §12.4).
        await stage.until("A's second session.updated", () => a.control.filter((message) => message.type === 'session.updated').length === 2);
        const renewed = await compare(scene, 'after the demo reset: A = B = engine', [a, b]);
        expect(renewed.epoch, 'the epoch of the reset').toBe(before.epoch + 1);
        for (const client of [a, b]) {
          const socket = client.station.wire();
          const firstOfTheEpoch = stateMessagesOf(socket).find((message) => message.position.epoch === renewed.epoch);
          expect(firstOfTheEpoch, `${client.name}: the first state message of the new epoch`).toMatchObject({ type: 'snapshot', position: { epoch: renewed.epoch, revision: 0 } });
          expect(socket.sent.filter((type) => type === 'resync'), `${client.name}: it did not have to ask`).toEqual([]);
          expect(client.live.socketStatus().counters).toMatchObject({ resyncs: 0, reconnects: 0 });
          expect(sessionOf(client.replica()), `${client.name}: the session is gone, the Core is at the seed state`).toBeNull();
          const operators = client.replica()['operators'] as Array<{ id: string; role: string }>;
          expect(operators.find((operator) => operator.id === INVESTIGATOR.id)?.role, `${client.name}: the role the seed put back`).toBe('INVESTIGATOR');
        }
        expect(a.control.filter((message) => message.type === 'session.updated')).toEqual([
          expect.objectContaining({ operator: { id: INVESTIGATOR.id, role: 'TECHNICIAN' }, reason: 'ROLE_CHANGED' }),
          expect.objectContaining({ operator: { id: INVESTIGATOR.id, role: 'INVESTIGATOR' }, reason: 'ROLE_CHANGED' }),
        ]);
        expect(b.control.filter((message) => message.type === 'session.updated'), "B is not told of A's session events").toEqual([]);
        expect(a.live.session, 'the sessions of the operators are kept by a reset').toMatchObject({ operator: { id: INVESTIGATOR.id } });
        // Spec §12.4: after a reset the Core link is recomputed from the open sockets. No paired device
        // holds one here, so it is OFFLINE (the comparison above ran the channel's pace step).
        expect(stage.engine.slice('tabletLink').state, 'the Core link after the reset, with no device socket').toBe('OFFLINE');
        const firstSnapshotOfTheEpoch = stateMessagesOf(a.station.wire()).find((message) => message.position.epoch === renewed.epoch);
        const linkInSnapshot = (firstSnapshotOfTheEpoch?.frame.json as { state?: { tabletLink?: { state?: string } } } | undefined)?.state?.tabletLink?.state;
        say(scene, `the Core link: ${String(linkInSnapshot)} in the snapshot of the new epoch, ${stage.engine.slice('tabletLink').state} at ${positionText(renewed)} (recomputed from the open sockets at the channel's pace step)`);
        const sinceTheReset = stateMessagesOf(a.station.wire())
          .filter((message) => message.position.epoch === renewed.epoch)
          .map((message) => {
            const ops = (message.frame.json as { ops?: Array<{ op: string; slice: string; rows?: Array<{ type: string }> }> }).ops ?? [];
            const named = ops.map((op) => `${op.op} ${op.slice}${op.rows === undefined ? '' : ` [${op.rows.map((row) => row.type).join(', ')}]`}`);
            return `${message.type} ${positionText(message.position)}${named.length === 0 ? '' : ` (${named.join(', ')})`}`;
          });
        say(scene, `the reset was answered 200 after ${resetMs} ms; epoch ${before.epoch} → ${renewed.epoch}; A was told session.updated twice (TECHNICIAN, then INVESTIGATOR), B never; A's socket since: ${sinceTheReset.join('; ')}`);

        // Both continue in the new epoch: A is an investigator again and creates a session; B sees it.
        await command(scene, 'createSession, after the reset (by A)', a, [b], () => a.live.actions.createSession(SECOND_SESSION), (state) => sessionOf(state)?.input?.caseNumber === SECOND_SESSION.caseNumber);
        expect(sessionOf(b.replica())?.state).toBe('CREATE');

        expectCleanTraffic(scene, [a, b]);
        sayKinds(scene);
        expect(await stage.close(), 'what the test left behind').toEqual(NOTHING_LEFT);
      } finally {
        // The stage before the pool: a stage that is still open here belongs to a test that failed.
        for (const stage of open.splice(0)) await stage.close();
        await maintenance.end();
      }
    });
  });
});

// ── Can it fail? Shown by changes of the test's INPUT, never of production code ────────────────

describe('can the assertions fail?', () => {
  it('the deltas of one command withheld on their way to B: the equality assertion is red; B meets the gap at the next delta, resyncs, and it is green', async () => {
    await timed('withheld delta', async () => {
      const stage = await stageOn('w49_gap');
      const scene: Scene = { stage, tag: 'withheld delta', started: performance.now() };
      const a = await signedInConsole(scene, 'A', INVESTIGATOR);
      const b = await signedInConsole(scene, 'B', SUPERVISOR);
      const start = await compare(scene, 'A and B took the snapshot', [a, b]);

      // A filtering socket wrapper of the test: no delta of A's next command reaches B's client
      // (however many deltas the command produces).
      const withheld = b.station.withhold((message) => message.type === 'delta');
      await a.live.actions.createSession(FIRST_SESSION);
      stage.channel.pace();
      await stage.barrier('after the command whose deltas B does not get', [a.station.wire(), b.station.wire()]);
      withheld.stop();
      const position = enginePosition(stage);
      const engineState = wire(stage.engine.state()) as unknown as Slices;
      expect(withheld.taken.length, 'deltas that were withheld from B').toBeGreaterThanOrEqual(1);
      expect(withheld.taken.every((frame) => frame.type === 'delta')).toBe(true);
      expect(position, 'B missed every revision of the command, and nothing else happened').toEqual({ epoch: start.epoch, revision: start.revision + withheld.taken.length });

      // RED: B is behind, the assertion names B and the slices; A is equal.
      const problems = replicaProblems([a, b], engineState, position);
      expect(problems.filter((problem) => problem.startsWith('A:'))).toEqual([]);
      expect(problems.some((problem) => problem.startsWith(`B: its socket client is at ${positionText(start)}`))).toBe(true);
      expect(problems.some((problem) => /^B: slices of its store that differ from app\.engine\.state\(\) at .*\bsession\b/.test(problem))).toBe(true);
      expect(sessionOf(b.replica()), 'B does not see the session').toBeNull();
      const red = await compare(scene, 'with the deltas of one command withheld from B', [a, b]).then(
        () => null,
        (error: unknown) => error,
      );
      expect(red, 'the equality assertion of the scenarios is red').toBeInstanceOf(Error);
      say(scene, `red, as it must be: ${problems.join(' | ')}`);

      // The server did nothing wrong: what it SENT on B's socket is gap-free.
      expect(sequenceProblems([b.station.wire()])).toEqual([]);

      // Unless B resyncs: the next delta does not continue what B holds, so its socket client asks (RT-6).
      await a.live.actions.beginPrecheck();
      await stage.until('B to be resynchronised after the gap', () => b.resyncs.some((event) => event.phase === 'RESYNCED' && event.cause === 'GAP'));
      expect(b.resyncs).toEqual([
        { phase: 'RESYNCING', cause: 'GAP' },
        { phase: 'RESYNCED', cause: 'GAP' },
      ]);
      const green = await compare(scene, 'B met the gap and resynchronised: A = B = engine', [a, b]);
      expect(sessionOf(b.replica())?.state).toBe('PRECHECK');
      const sent = stateMessagesOf(b.station.wire());
      const answerToResync = sent.filter((message) => message.type === 'snapshot').at(-1)?.position;
      expect(answerToResync?.epoch, "the server's answer to B's resync").toBe(green.epoch);
      expect(answerToResync?.revision ?? -1, 'the snapshot holds what B had missed').toBeGreaterThan(position.revision);
      expect(answerToResync?.revision ?? -1).toBeLessThanOrEqual(green.revision);
      expect(b.station.wire().sent.filter((type) => type === 'resync')).toHaveLength(1);
      expect(b.station.shadow.gaps, 'the gap as the client met it').toEqual([`delta ${positionText({ epoch: position.epoch, revision: position.revision + 1 })} does not continue ${positionText(start)}`]);
      expect(b.live.socketStatus().counters).toMatchObject({ resyncs: 1, invalid: 0 });
      expect(b.live.socketStatus().counters.deltasDropped, 'deltas B dropped because they did not continue what it held').toBeGreaterThanOrEqual(1);
      say(scene, `green after the resync: B's socket was sent ${sent.map((message) => `${message.type} ${positionText(message.position)}${message.delivered ? '' : ' (withheld)'}`).join(', ')}`);

      expect(frameProblems(stage.wires)).toEqual([]);
      expect(forbiddenContent(stage.wires)).toEqual([]);

      // The two other checks of every scenario can fail too. Shown on frames this run really
      // received, rearranged by the test:
      // (1) A's socket without its first delta: the next state message does not continue the one before.
      const whole = a.station.wire();
      const firstDelta = whole.frames.find((frame) => frame.message?.type === 'delta');
      const before = a.station.wires[0];
      if (firstDelta === undefined || before === undefined) throw new Error('A has no delta, or no socket of before its sign-in');
      const holed: Wire = { ...whole, frames: whole.frames.filter((frame) => frame !== firstDelta) };
      expect(sequenceProblems([whole])).toEqual([]);
      expect(sequenceProblems([holed])).toHaveLength(1);
      expect(sequenceProblems([holed])[0]).toContain('does not continue');
      // (2) that delta on the ANONYMOUS socket A held before its sign-in: no socket without an operator is sent state.
      expect(before.hello?.principal).toBe('ANONYMOUS');
      const place = before.frames.length;
      const eavesdropping: Wire = { ...before, frames: [...before.frames, { ...firstDelta, index: place }] };
      expect(forbiddenContent([before])).toEqual([]);
      expect(forbiddenContent([eavesdropping])).toEqual([
        `A #1 frame ${place} (delta): never sent to a socket of principal ANONYMOUS`,
        `A #1 frame ${place} (delta): the socket was not given the topic state`,
      ]);
      say(scene, `red, as they must be: ${sequenceProblems([holed]).join(' | ')} | ${forbiddenContent([eavesdropping]).join(' | ')}`);

      expect(await stage.close(), 'what the test left behind').toEqual(NOTHING_LEFT);
    });
  });

  it('frames the test makes itself: a member the contract does not name, a slice that never travels, a value like a credential; each assertion about frames is red, and the client drops them', async () => {
    await timed('frames of the test', async () => {
      const stage = await stageOn('w49_bad');
      const scene: Scene = { stage, tag: 'frames of the test', started: performance.now() };
      const a = await signedInConsole(scene, 'A', SUPERVISOR);
      await compare(scene, 'A took the snapshot', [a]);
      expect(frameProblems(stage.wires), 'every frame the server sent validates').toEqual([]);
      expect(forbiddenContent(stage.wires, 'any')).toEqual([]);

      // A list hint as the server sends it, with one member more: the eight new members of the union are strict.
      const strict = a.station.inject(JSON.stringify({ type: 'admin.changed', v: 1, resource: 'USERS', rows: [] }));
      expect(strict.message, 'the union refuses it').toBeNull();
      const problems = frameProblems(stage.wires);
      expect(problems).toEqual([`A #${a.station.wire().number} frame ${strict.index} (admin.changed): admin.changed: unrecognized_keys [rows] at (the message)`]);
      // RED: the assertion every scenario makes.
      expect(() => expect(frameProblems(stage.wires), 'frames that are no message of the contract').toEqual([])).toThrow();
      // The frames the server sent are still all valid: the red is the injected frame, and only it.
      expect(frameProblems(stage.wires, 'server')).toEqual([]);
      // The shared socket client validates too: it dropped the frame, counted it, and handed nothing on.
      expect(a.live.socketStatus().counters.invalid).toBe(1);
      expect(a.control.filter((message) => message.type === 'admin.changed')).toEqual([]);
      say(scene, `red, as it must be: ${problems.join(' | ')}; the socket client counted ${a.live.socketStatus().counters.invalid} invalid frame`);

      // `heartbeat` is the one member of the union that is NOT strict (it is mock-core's, unchanged):
      // the union accepts a heartbeat with an unknown member. The test's own rule for what a socket
      // must not be sent refuses it.
      const beats = stage.channel.stats().beats;
      const loose = a.station.inject(
        JSON.stringify({ type: 'heartbeat', v: 1, seq: beats, serverTime: new Date(stage.clock.now()).toISOString(), uptimeMs: 0, intervalMs: 1000, clients: 1, sessionState: null, extra: 'a member the contract does not name' }),
      );
      expect(loose.problems, 'the union accepts an unknown member of a heartbeat').toEqual([]);
      expect(forbiddenContent(stage.wires, 'server')).toEqual([]);
      const forbidden = forbiddenContent(stage.wires, 'any');
      expect(forbidden).toEqual([`A #${a.station.wire().number} frame ${loose.index} (heartbeat): members clients, extra, intervalMs, seq, serverTime, sessionState, type, uptimeMs, v`]);
      expect(() => expect(forbiddenContent(stage.wires, 'any'), 'what a socket must not be sent').toEqual([])).toThrow();
      say(scene, `the union alone does not refuse an unknown member of a heartbeat; the test's own rule does: ${forbidden.join(' | ')}`);

      // A delta that names a slice the channel never publishes (spec §9.5): no message of the contract.
      const held = enginePosition(stage);
      const neverTravels = a.station.inject(
        JSON.stringify({ type: 'delta', v: 1, epoch: held.epoch, revision: held.revision + 1, serverTime: stage.clock.now(), ops: [{ op: 'replace', slice: 'auth', value: { status: 'SIGNED_OUT' } }] }),
      );
      expect(neverTravels.message, 'a delta on the slice auth is refused by the union').toBeNull();
      expect(frameProblems(stage.wires).filter((problem) => problem.includes(`frame ${neverTravels.index} (delta)`)).length).toBeGreaterThanOrEqual(1);
      expect(a.position(), "the client did not take it: its position is the engine's").toEqual(held);
      expect(differingSlices(a.replica(), wire(stage.engine.state()) as unknown as Slices)).toEqual([]);

      // A value that looks like a session token, anywhere in a frame: reported, by its kind only.
      const leaking = a.station.inject(JSON.stringify({ type: 'admin.changed', v: 1, resource: 'USERS', note: `ses_${'A'.repeat(43)}` }));
      const leaks = forbiddenContent(stage.wires, 'any').filter((line) => line.includes(`frame ${leaking.index} `));
      expect(leaks).toEqual([`A #${a.station.wire().number} frame ${leaking.index} (admin.changed): holds what looks like a credential (token)`]);
      expect(leaks.join(' ')).not.toContain('ses_');
      expect(a.live.socketStatus().counters.invalid, 'frames the shared socket client refused: the three that are no message of the contract').toBe(3);
      say(scene, `red, as they must be: ${frameProblems(stage.wires).length} frames refused by the union; ${leaks.join(' | ')}`);

      expect(await stage.close(), 'what the test left behind').toEqual(NOTHING_LEFT);
    });
  });
});
