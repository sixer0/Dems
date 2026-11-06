// FIRST CONTACT: the shared client layer against the real server (plan row W42, rule 8 of its
// brief; spec §9; client specification CL-7 to CL-18). Until here the Live socket client and the
// Live source ran against the contract-checked fake transport, and the server against test
// sockets. This file puts the two together, unchanged, over a real listener:
//
//   (a) `createLiveSocketClient` of `@dems/shared/realtime` against `/ws`;
//   (b) `createLiveSim` of `@dems/shared/live/source`, with `createCoreClient` of
//       `@dems/shared/client` and the Live socket client, both pointed at the server: a web
//       console and a paired tablet, a sign-in through the real identity routes, a session from
//       create to seal through the real session routes, and each replica compared with
//       `app.engine.state()` at the same revision.
//
// THE TRANSPORTS are Node's own `fetch` and `WebSocket`, wrapped so that each stand-in sends what
// its platform sends and nothing else:
//   a browser   the page's `Origin` on a POST and on the upgrade, and the cookie it was given;
//   the tablet  no `Origin` on REST, the own origin on the upgrade, one bearer value, no cookie
//               (measured on the emulator, decision D69).
//
// Nothing of `packages/shared` is changed here and nothing is bent to make a client pass: what
// does not fit is a finding, written down in the row's document with the message and the field.
//
// TIME. The server is on manual time, as in the other files. The two clients run on the
// platform's real clock and timers, as in an app; the test waits for what they report, one turn
// of the event loop at a time, and drives the server's heartbeat itself so that no link goes stale.
import { REPLICATED_SLICE_NAMES, type DeviceRevokedMessage, type SessionEndedMessage } from '@dems/shared/api';
import { createCoreClient, type CoreClientReport, type CoreFetch } from '@dems/shared/client';
import { createLiveSim, type LiveSessionEnd, type LiveSim } from '@dems/shared/live/source';
// By file, not through `@dems/shared/realtime`: that entry point also exports a React context from
// a `.tsx` file, which this workspace's compiler options (no `jsx`) cannot type-check.
import {
  createLiveSocketClient,
  type LiveSocketClient,
  type LiveSocketControlMessage,
  type LiveSocketEnd,
  type LiveSocketErrorReport,
  type LiveSocketFactory,
  type LiveSocketLike,
  type LiveSocketResyncEvent,
} from '../../../../../packages/shared/src/realtime/live-socket-client';
import { DEMO_OPERATOR_PASSWORD, type SimErrorReport } from '@dems/shared/sim';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { SIGN_OUT } from '../../../test/support/identity';
import { revokeUrl, type PairedTestDevice } from '../../../test/support/pairing';
import { replay, wire } from './hub-support';
import {
  INVESTIGATOR,
  OWN_ORIGIN,
  SUPERVISOR,
  WEB_ORIGIN,
  deviceOperator,
  eventually,
  pairedDevice,
  realtimeApp,
  untilSockets,
  webOperator,
  webPost,
  type RealtimeApp,
  type WebOperator,
} from '../../../test/support/realtime';

const db = useTestDatabase({ template: 'seed' });
let rt: RealtimeApp;
let supervisor: WebOperator;

/** What a test started and must stop: clients first, so that the server knows no socket at the end. */
const stoppers: Array<() => void> = [];

beforeAll(async () => {
  rt = await realtimeApp(db);
  supervisor = await webOperator(rt, SUPERVISOR);
});

beforeEach(() => {
  rt.forgetCounters();
});

afterEach(async () => {
  for (const stop of stoppers.splice(0)) stop();
  await untilSockets(rt, 0);
});

// ── The two platforms ──────────────────────────────────────────────────────────────────────────

type SocketOptions = { headers: Record<string, string> };
const NodeSocket = WebSocket as unknown as new (url: string, options: SocketOptions) => LiveSocketLike;

interface Browser {
  readonly fetch: CoreFetch;
  /** The browser opens the socket itself: it adds its `Origin` and the cookie of the host. */
  readonly socketFactory: LiveSocketFactory;
  /** True while the browser holds this instance's session cookie. */
  hasCookie(): boolean;
  /** Puts a cookie into the jar, as an earlier sign-in of this browser left it. */
  give(cookie: string): void;
}

/** A browser on the web console's origin: a cookie jar for the host, `Origin` on a POST and on the upgrade. */
function browser(): Browser {
  const jar = new Map<string, string>();
  const cookieHeader = (): Record<string, string> => (jar.size === 0 ? {} : { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') });
  return {
    async fetch(input, init) {
      const response = await fetch(input, {
        method: init.method,
        headers: { ...init.headers, ...(init.credentials === 'same-origin' ? cookieHeader() : {}), ...(init.method === 'POST' ? { origin: WEB_ORIGIN } : {}) },
        ...(init.body === undefined ? {} : { body: init.body }),
        ...(init.signal === undefined ? {} : { signal: init.signal }),
      });
      for (const line of response.headers.getSetCookie()) {
        const [pair = '', ...attributes] = line.split(';').map((part) => part.trim());
        const at = pair.indexOf('=');
        const name = pair.slice(0, at);
        const value = pair.slice(at + 1);
        const expired = value === '' || attributes.some((attribute) => /^max-age=0$/i.test(attribute) || /^expires=thu, 01 jan 1970/i.test(attribute));
        if (expired) jar.delete(name);
        else jar.set(name, value);
      }
      return response;
    },
    socketFactory: (url) => new NodeSocket(url, { headers: { origin: WEB_ORIGIN, ...cookieHeader() } }),
    hasCookie: () => jar.has(rt.cookieName),
    give(cookie) {
      const at = cookie.indexOf('=');
      jar.set(cookie.slice(0, at), cookie.slice(at + 1));
    },
  };
}

interface Tablet {
  readonly fetch: CoreFetch;
  /** React Native's socket: the headers the app gave it, and the origin of the URL it opens. */
  readonly socketFactory: LiveSocketFactory;
  /** The app's secrets, in memory: what its credential providers return. */
  readonly secrets: { deviceCredential: string | null; sessionToken: string | null };
  /** The bearer value of the next request: the session token when signed in, else the device credential. */
  bearerValue(): string | null;
}

function tabletOf(device: PairedTestDevice): Tablet {
  const secrets: Tablet['secrets'] = { deviceCredential: device.credential, sessionToken: null };
  return {
    secrets,
    bearerValue: () => secrets.sessionToken ?? secrets.deviceCredential,
    // The typed client asks with `credentials: 'omit'`: no cookie, and this platform adds no `Origin`.
    fetch: (input, init) =>
      fetch(input, {
        method: init.method,
        headers: init.headers,
        ...(init.body === undefined ? {} : { body: init.body }),
        ...(init.signal === undefined ? {} : { signal: init.signal }),
      }),
    socketFactory: (url, headers) => new NodeSocket(url, { headers: { origin: OWN_ORIGIN, ...headers } }),
  };
}

const bearerHeaders = (tablet: Tablet) => (): Record<string, string> | null => {
  const value = tablet.bearerValue();
  return value === null ? null : { Authorization: `Bearer ${value}` };
};

// ── (a) the Live socket client ─────────────────────────────────────────────────────────────────

interface Observed {
  readonly client: LiveSocketClient;
  readonly links: string[];
  readonly resyncs: LiveSocketResyncEvent[];
  readonly control: LiveSocketControlMessage[];
  readonly ends: LiveSocketEnd[];
  readonly reports: LiveSocketErrorReport[];
  /** Every state message the client handed on, in order: what a consumer applies. */
  readonly state: Array<Parameters<typeof replay>[0][number]>;
}

function observe(options: { socketFactory: LiveSocketFactory; headers?: () => Record<string, string> | null }): Observed {
  const observed: Omit<Observed, 'client'> = { links: [], resyncs: [], control: [], ends: [], reports: [], state: [] };
  const client = createLiveSocketClient({
    url: rt.wsUrl,
    socketFactory: options.socketFactory,
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    onSnapshot: (snapshot) => void observed.state.push(snapshot),
    onDelta: (delta) => void observed.state.push(delta),
    onLinkChange: (link) => void observed.links.push(link),
    onResync: (event) => void observed.resyncs.push(event),
    onControl: (message) => void observed.control.push(message),
    onEnd: (end) => void observed.ends.push(end),
    onError: (report) => void observed.reports.push(report),
  });
  stoppers.push(() => client.stop());
  return { client, ...observed };
}

/** Flushes what waits for the pace step and waits until the client's position is the engine's. */
async function caughtUp(client: LiveSocketClient, what: string): Promise<void> {
  rt.channel.pace();
  await eventually(`${what}: the client at the engine's revision`, () => {
    const status = client.getStatus();
    return status.synced && status.epoch === rt.engine.epoch && status.revision === rt.engine.revision;
  });
}

const supervisorPrincipal = () => {
  const operator = rt.engine.slice('operators').find((candidate) => candidate.id === SUPERVISOR.id);
  if (operator === undefined) throw new Error('the seeded supervisor is not in the operators slice');
  return { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'first-contact', deviceId: null, role: operator.role, permissions: [] } as const;
};

describe('(a) the shared Live socket client against the real /ws', () => {
  it('a web console: hello, snapshot, deltas of real engine commands, a resync, meters, and an end with 4401 after a sign-out; then the anonymous socket', async () => {
    const page = browser();
    const session = await webOperator(rt, INVESTIGATOR);
    page.give(session.cookie['cookie'] ?? '');
    const web = observe({ socketFactory: page.socketFactory });

    // CONNECTING until the snapshot of the connection, then ONLINE (the client's state machine).
    web.client.start();
    await eventually('the link ONLINE', () => web.client.getStatus().link === 'ONLINE');
    expect(web.links).toEqual(['ONLINE']);
    const status = web.client.getStatus();
    expect(status).toMatchObject({
      principal: 'OPERATOR',
      helloReason: null,
      topics: ['heartbeat', 'control', 'state', 'meters'],
      epoch: rt.engine.epoch,
      revision: rt.engine.revision,
      synced: true,
      resync: null,
      end: null,
    });
    expect(status.connectionId).toBe(rt.channel.connections()[0]?.connectionId);
    expect(status.counters).toMatchObject({ snapshots: 1, deltas: 0, invalid: 0, errors: 0 });
    // The connect-time heartbeat made the heartbeat view LIVE at once.
    expect(web.client.getSnapshot()).toMatchObject({ state: 'LIVE', seq: rt.channel.stats().beats, clients: 1 });
    expect(status.serverTime?.source).toBe('heartbeat');

    // Deltas produced by real engine commands arrive in order and are applied without a gap.
    for (const timeFormat of ['12', '24', '12'] as const) await rt.engine.command(supervisorPrincipal(), 'updateSettings', { timeFormat });
    await caughtUp(web.client, 'after three commands');
    expect(web.client.getStatus().counters).toMatchObject({ snapshots: 1, deltas: 3, deltasDropped: 0, deltasStale: 0 });
    expect(replay(web.state).state).toEqual(wire(rt.engine.state()));

    // The client subscribed to the meters by itself after the OPERATOR hello; frames reach it.
    await eventually('the server reading the subscribe', () => rt.channel.connections()[0]?.meters === true);
    expect(web.client.getStatus().metersSubscribed).toBe(true);
    await rt.drive(250);
    await caughtUp(web.client, 'after five ticks');
    await eventually('five meter frames', () => web.client.getStatus().counters.meters === 5);
    expect(web.client.getLatestMeters()?.seq).toBe(5);

    // A resync the consumer asks for: RESYNCING, a snapshot, RESYNCED.
    expect(web.client.requestResync()).toBe(true);
    await eventually('the snapshot of the resync', () => web.client.getStatus().counters.snapshots === 2);
    expect(web.resyncs).toEqual([
      { phase: 'RESYNCING', cause: 'REQUESTED' },
      { phase: 'RESYNCED', cause: 'REQUESTED' },
    ]);
    expect(web.links).toEqual(['ONLINE', 'RESYNCING', 'ONLINE']);
    expect(replay(web.state).state).toEqual(wire(rt.engine.state()));

    // A new epoch (the engine restarted): a snapshot nobody asked for. The client takes it without
    // sending a resync, deltas continue from it, and the meter frames go on: their number on the
    // wire did not start again with the engine's.
    const epochBefore = rt.engine.epoch;
    const metersBefore = web.client.getStatus().counters.meters;
    await rt.engine.stop();
    await rt.engine.start('boot');
    await rt.engine.idle();
    await caughtUp(web.client, 'after the restart of the engine');
    expect(web.client.getStatus().epoch).toBe(epochBefore + 1);
    expect(web.client.getStatus().counters).toMatchObject({ snapshots: 3, resyncs: 1 });
    expect(web.links).toEqual(['ONLINE', 'RESYNCING', 'ONLINE']);
    expect(replay(web.state).state).toEqual(wire(rt.engine.state()));
    await rt.drive(250);
    await eventually('five more meter frames after the restart', () => web.client.getStatus().counters.meters === metersBefore + 5);
    expect(web.client.getStatus().counters.metersDropped).toBe(0);
    await caughtUp(web.client, 'after the ticks of the new epoch');

    // A sign-out of that session over REST: session.ended, then close 4401; the client ends and does not reconnect.
    expect((await webPost(rt.app, SIGN_OUT, session.cookie)).statusCode).toBe(204);
    await eventually('the end of the run', () => web.ends.length === 1);
    expect(web.control).toEqual([{ type: 'session.ended', v: 1, reason: 'SIGNED_OUT' } satisfies SessionEndedMessage]);
    expect(web.ends[0]).toMatchObject({ kind: 'SESSION_ENDED', closeCode: 4401, sessionEnded: 'SIGNED_OUT', deviceRevoked: null, helloReason: null, principal: 'OPERATOR' });
    expect(web.client.getStatus()).toMatchObject({ link: 'OFFLINE', lastCloseCode: 4401 });
    expect(web.client.getStatus().counters.reconnects).toBe(0);
    await untilSockets(rt, 0);

    // The web console then opens its anonymous socket: the dead cookie gives hello with SESSION_INVALID and a heartbeat.
    expect(web.client.reconnect('SIGN_OUT')).toBe(true);
    await eventually('the anonymous link', () => web.client.getStatus().link === 'ONLINE');
    expect(web.client.getStatus()).toMatchObject({ principal: 'ANONYMOUS', helloReason: 'SESSION_INVALID', topics: ['heartbeat'], end: null });
    rt.channel.beat();
    await eventually('a heartbeat on the anonymous socket', () => web.client.getSnapshot().seq === rt.channel.stats().beats);
    expect(web.client.getSnapshot().state).toBe('LIVE');
    expect(web.ends).toHaveLength(1);

    // Nothing the server sent was dropped or reported by the client.
    expect(web.reports).toEqual([]);
    expect(web.client.getStatus().counters).toMatchObject({ invalid: 0, errors: 0 });
  });

  it('a paired tablet: DEVICE with its credential, OPERATOR with a session token, and the two ends a device can meet: 4403 after a revoke, 4401 for a value that does not resolve', async () => {
    const device = await pairedDevice(rt, supervisor, 'First-contact tablet');
    const tablet = tabletOf(device);
    const mobile = observe({ socketFactory: tablet.socketFactory, headers: bearerHeaders(tablet) });

    // Signed out: the device credential. No state topic, so the link is ONLINE at hello.
    mobile.client.start();
    await eventually('the link ONLINE', () => mobile.client.getStatus().link === 'ONLINE');
    expect(mobile.client.getStatus()).toMatchObject({ principal: 'DEVICE', topics: ['heartbeat', 'control'], synced: false, metersSubscribed: false });
    expect(mobile.client.getStatus().counters.sent).toBe(0);

    // Signed in: the session token; the principal is fixed at the upgrade, so the client reconnects.
    tablet.secrets.sessionToken = (await deviceOperator(rt, device, INVESTIGATOR)).token;
    expect(mobile.client.reconnect('SIGN_IN')).toBe(true);
    await eventually('the OPERATOR link', () => mobile.client.getStatus().principal === 'OPERATOR' && mobile.client.getStatus().link === 'ONLINE');
    await caughtUp(mobile.client, 'after the sign-in');
    expect(replay(mobile.state).state).toEqual(wire(rt.engine.state()));

    // The supervisor revokes the device: device.revoked, then close 4403.
    expect((await webPost(rt.app, revokeUrl(device.deviceId), supervisor.cookie, { reason: 'First contact: revoke' })).statusCode).toBe(200);
    await eventually('the end of the run', () => mobile.ends.length === 1);
    expect(mobile.control.at(-1)).toEqual({ type: 'device.revoked', v: 1, reason: 'REVOKED' } satisfies DeviceRevokedMessage);
    expect(mobile.ends[0]).toMatchObject({ kind: 'DEVICE_REVOKED', closeCode: 4403, deviceRevoked: 'REVOKED', sessionEnded: null, principal: 'OPERATOR' });

    // The app still holds the retired values and reconnects: hello with DEVICE_REVOKED, then 4403, for both.
    for (const signedIn of [true, false]) {
      if (!signedIn) tablet.secrets.sessionToken = null;
      mobile.client.reconnect('CREDENTIAL');
      const expected = mobile.ends.length + 1;
      await eventually('the refusal of the retired value', () => mobile.ends.length === expected);
      expect(mobile.ends.at(-1)).toMatchObject({ kind: 'DEVICE_REVOKED', closeCode: 4403, helloReason: 'DEVICE_REVOKED', principal: 'ANONYMOUS', deviceRevoked: null });
    }

    // A value the Core does not know: hello with SESSION_INVALID, then 4401.
    tablet.secrets.deviceCredential = `dvc_${'A'.repeat(43)}`;
    mobile.client.reconnect('CREDENTIAL');
    await eventually('the refusal of the unknown value', () => mobile.ends.length === 4);
    expect(mobile.ends.at(-1)).toMatchObject({ kind: 'SESSION_ENDED', closeCode: 4401, helloReason: 'SESSION_INVALID', principal: 'ANONYMOUS', sessionEnded: null });

    // Without any credential the app's socket is ANONYMOUS and stays open.
    tablet.secrets.deviceCredential = null;
    mobile.client.reconnect('CREDENTIAL');
    await eventually('the anonymous link', () => mobile.client.getStatus().link === 'ONLINE');
    expect(mobile.client.getStatus()).toMatchObject({ principal: 'ANONYMOUS', helloReason: null });
    expect(mobile.reports).toEqual([]);
    await rt.channel.settled();
  });
});

// ── (b) the Live source ────────────────────────────────────────────────────────────────────────

const SESSION_INPUT = {
  caseNumber: 'LP/2026/1004-0064',
  subjectType: 'SAKSI',
  subjectName: 'Test Subject',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;

interface Source {
  readonly live: LiveSim;
  readonly reports: SimErrorReport[];
  readonly clientReports: CoreClientReport[];
  readonly ends: LiveSessionEnd[];
}

/**
 * The 30 replicated slices of a replica, against the engine's committed state as it travels over
 * the wire. Returns the names that differ. The comparison is structural: the order of the members
 * of an object is not part of a slice (a client's parser writes them in the schema's order).
 */
function differingSlices(live: LiveSim): string[] {
  const replica = live.store.getState() as unknown as Record<string, unknown>;
  const engine = wire(rt.engine.state()) as unknown as Record<string, unknown>;
  return REPLICATED_SLICE_NAMES.filter((name) => {
    try {
      expect(replica[name]).toEqual(engine[name]);
      return false;
    } catch {
      return true;
    }
  });
}

/** Waits until every source holds the engine's revision, then compares each replica with the engine's state. */
async function expectReplicas(what: string, ...sources: Source[]): Promise<void> {
  rt.channel.pace();
  rt.channel.beat();
  for (const { live } of sources) {
    await eventually(`${what}: the replica at revision ${rt.engine.revision}`, () => {
      const status = live.socketStatus();
      return status.synced && status.epoch === rt.engine.epoch && status.revision === rt.engine.revision;
    });
    expect(differingSlices(live), `${what}: slices of the replica that differ from app.engine.state() at revision ${rt.engine.revision}`).toEqual([]);
  }
}

describe('(b) the shared Live source, the typed client and the Live socket client against the real server', () => {
  it('a web console and a paired tablet: sign-in through the identity routes, a session from create to seal through the session routes, both replicas equal to app.engine.state() at each step; then a sign-out and a revoke', async () => {
    // ── The web console: the supervisor ──
    const page = browser();
    const webSource: Source = { reports: [], clientReports: [], ends: [], live: undefined as unknown as LiveSim };
    const webClient = createCoreClient({ baseUrl: rt.httpUrl, credentials: 'browser-cookie', fetch: page.fetch, report: (report) => void webSource.clientReports.push(report) });
    const web = createLiveSim({ client: webClient, socket: { url: rt.wsUrl, factory: page.socketFactory }, onError: (report) => void webSource.reports.push(report) });
    Object.assign(webSource, { live: web });
    stoppers.push(() => web.stop());
    web.onSessionEnd((end) => void webSource.ends.push(end));

    await web.ready;
    expect(web.session).toBeNull();
    await eventually('the web console\'s anonymous link', () => web.link === 'ONLINE');
    expect(web.socketStatus()).toMatchObject({ principal: 'ANONYMOUS', helloReason: null });

    const webSignIn = await web.actions.signIn(SUPERVISOR.username, DEMO_OPERATOR_PASSWORD);
    expect(webSignIn).toMatchObject({ ok: true, operatorId: SUPERVISOR.id, role: 'SUPERVISOR' });
    expect(page.hasCookie()).toBe(true);
    expect(web.session).toMatchObject({ operator: { id: SUPERVISOR.id, role: 'SUPERVISOR' } });
    expect(web.socketStatus()).toMatchObject({ principal: 'OPERATOR', topics: ['heartbeat', 'control', 'state', 'meters', 'admin'] });
    await expectReplicas('the web console after its sign-in', webSource);
    expect(web.store.getState().auth).toMatchObject({ status: 'SIGNED_IN', operatorId: SUPERVISOR.id });

    // ── The tablet: paired through the portal, then the investigator signs in on it ──
    const device = await pairedDevice(rt, supervisor, 'First-contact tablet 2');
    const tablet = tabletOf(device);
    const mobileSource: Source = { reports: [], clientReports: [], ends: [], live: undefined as unknown as LiveSim };
    const unpaired: LiveSessionEnd[] = [];
    const mobileClient = createCoreClient({ baseUrl: rt.httpUrl, credentials: () => tablet.bearerValue(), fetch: tablet.fetch, report: (report) => void mobileSource.clientReports.push(report) });
    const mobile = createLiveSim({
      client: mobileClient,
      socket: { url: rt.wsUrl, factory: tablet.socketFactory, headers: bearerHeaders(tablet) },
      secrets: {
        sessionIssued(issued) {
          tablet.secrets.sessionToken = issued.sessionToken;
        },
        sessionCleared() {
          tablet.secrets.sessionToken = null;
        },
        deviceUnpaired(end) {
          unpaired.push(end);
          tablet.secrets.deviceCredential = null;
          tablet.secrets.sessionToken = null;
        },
      },
      device: () => ({ deviceName: 'First-contact tablet 2', platform: 'android', appVersion: '0.2.0' }),
      onError: (report) => void mobileSource.reports.push(report),
    });
    Object.assign(mobileSource, { live: mobile });
    stoppers.push(() => mobile.stop());
    mobile.onSessionEnd((end) => void mobileSource.ends.push(end));

    await mobile.ready;
    await eventually('the tablet\'s DEVICE link', () => mobile.link === 'ONLINE');
    expect(mobile.socketStatus()).toMatchObject({ principal: 'DEVICE' });
    await rt.channel.settled();
    // A paired device holds an authenticated socket: the tablet link is CONNECTED, and the web replica shows it.
    expect(rt.engine.slice('tabletLink').state).toBe('CONNECTED');
    await expectReplicas('the web console after the tablet connected', webSource);
    expect(web.store.getState().tabletLink.state).toBe('CONNECTED');

    const mobileSignIn = await mobile.actions.signIn(INVESTIGATOR.username, DEMO_OPERATOR_PASSWORD);
    expect(mobileSignIn).toMatchObject({ ok: true, operatorId: INVESTIGATOR.id, role: 'INVESTIGATOR' });
    expect(tablet.secrets.sessionToken).not.toBeNull();
    expect(mobile.socketStatus()).toMatchObject({ principal: 'OPERATOR', topics: ['heartbeat', 'control', 'state', 'meters'] });
    await expectReplicas('both clients after the tablet\'s sign-in', webSource, mobileSource);

    // ── A session from create to seal, through the real routes, driven from the tablet ──
    const ran: string[] = [];
    const step = async (name: string, run: () => PromiseLike<unknown>): Promise<unknown> => {
      const value = await run();
      ran.push(name);
      await expectReplicas(`after ${name}`, webSource, mobileSource);
      return value;
    };
    const created = await step('createSession', () => mobile.actions.createSession({ ...SESSION_INPUT, investigatorId: INVESTIGATOR.id }));
    expect(created).toMatchObject({ ok: true, created: true });
    await step('beginPrecheck', () => mobile.actions.beginPrecheck());
    await rt.drive(5_000);
    await expectReplicas('after the precheck ran', webSource, mobileSource);
    if (rt.engine.slice('session')?.state === 'PRECHECK') await step('acknowledgePrecheckWarnings', () => mobile.actions.acknowledgePrecheckWarnings());
    expect(rt.engine.slice('session')?.state).toBe('ARMED');
    await step('startRecording', () => mobile.actions.startRecording());
    expect(web.store.getState().session?.state).toBe('RECORDING');
    await rt.drive(2_000);
    await step('addMarker', () => mobile.actions.addMarker('Key statement'));
    // A command from the OTHER client, during the recording: visible on both (SC3).
    await step('addNote (web)', () => web.actions.addNote('Supervisor is watching'));
    await step('stopRecording', () => mobile.actions.stopRecording('Interview completed'));
    await rt.drive(20_000);
    await expectReplicas('after the seal', webSource, mobileSource);
    expect(mobile.store.getState().session?.state).toBe('SEALED');
    const sealedId = rt.engine.slice('lastSealedSessionId') ?? '';
    await step('acknowledgeSummary', () => mobile.actions.acknowledgeSummary(sealedId));
    expect(web.store.getState().lastSealedAcknowledged).toBe(true);

    // Meter frames reached both clients while the engine ticked, and none of them is in a replica's 30 slices.
    expect(mobile.socketStatus().counters.meters).toBeGreaterThan(100);
    expect(web.socketStatus().counters.meters).toBeGreaterThan(100);

    // ── The ends ──
    // The investigator signs out on the tablet: the session ends, the socket is reopened with the device credential.
    await mobile.actions.signOut('USER');
    await eventually('the tablet back on its DEVICE socket', () => mobile.socketStatus().principal === 'DEVICE' && mobile.link === 'ONLINE');
    expect(tablet.secrets.sessionToken).toBeNull();
    expect(mobile.session).toBeNull();
    expect(mobile.store.getState().auth.status).toBe('SIGNED_OUT');
    await expectReplicas('the web console after the tablet signed out', webSource);

    // The supervisor revokes the tablet from the console, through the typed client of the Live source.
    const revoked = await web.client.call('revokeDevice', { params: { id: device.deviceId }, body: { reason: 'First contact: revoke' } });
    expect(revoked).toMatchObject({ ok: true, status: 200 });
    await eventually('the tablet told that it is no longer paired', () => unpaired.length >= 1);
    expect(unpaired[0]).toMatchObject({ kind: 'DEVICE_REVOKED', reason: 'REVOKED' });
    expect(tablet.secrets.deviceCredential).toBeNull();
    await eventually('the tablet on an anonymous socket', () => mobile.socketStatus().principal === 'ANONYMOUS' && mobile.link === 'ONLINE');
    await rt.channel.settled();
    await expectReplicas('the web console after the revoke', webSource);
    expect(web.store.getState().tabletLink.state).toBe('OFFLINE');

    // Nothing the server sent or answered was refused, dropped or reported by either client.
    const problems = (source: Source) => ({
      reports: source.reports.map((report) => `${report.level} ${report.source} ${report.message}`),
      contract: source.clientReports.map((report) => JSON.stringify(report)),
      socket: (({ invalid, errors, deltasDropped }) => ({ invalid, errors, deltasDropped }))(source.live.socketStatus().counters),
    });
    console.info(`[w42] first contact (b): ${ran.join(' → ')}; engine revision ${rt.engine.revision}, epoch ${rt.engine.epoch}`);
    console.info(`[w42] first contact (b): web ${JSON.stringify(problems(webSource))}`);
    console.info(`[w42] first contact (b): tablet ${JSON.stringify(problems(mobileSource))}`);
    expect(problems(webSource).contract).toEqual([]);
    expect(problems(mobileSource).contract).toEqual([]);
    expect(problems(webSource).socket).toEqual({ invalid: 0, errors: 0, deltasDropped: 0 });
  });
});
