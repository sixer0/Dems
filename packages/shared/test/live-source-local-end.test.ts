// Plan row W44: the end of a session that is decided on the client.
//
// | Rule | Source | Where it is proven |
// |------|--------|--------------------|
// | `signOut` (USER, LOCK) never does nothing: with the link down, or without an answer, the session ends HERE | D80 (CPC1-21) | "a local end, never a refusal" |
// | What the Core has not heard is a DEBT: the session it is for, the reason, the instant; no credential | D90 | "a local end …"; "the debt is never paid blindly" |
// | A debt is never paid blindly: the Core is asked first; only the SAME session, still open, is signed out, and only for USER or LOCK | D90 (CPC1-23 c) | "the debt is never paid blindly" |
// | An expiry is not decided on a reckoning while the Core can be asked; RESYNCING is no lost link | D90 (CPC1-23 a, b) | "the expiry this client reckons with" |
// | The debt survives a reload when the app gives a storage for it | D90 (CPC1-24) | "the debt across a reload" |
// | A sign-out the Core refuses fails closed | D90 (CPC1-31) | "fails closed" |
// | A page's call through `live.client`: activity, and the full CL-23 except CL-22 | D84, D90 (CPC1-32) | "`live.client`" |
// | An action's late answer changes nothing for a newer session | D90 (CPC1-25) | "an answer is held to the session that sent the request" |
// | A socket that is not the session's tells nothing | D84 (F66-18) | "F66-18" |
// | The storage's calls take effect in the order they were asked for; a `read` that fails starts closed | D100 (CPC1-34) | "an asynchronous storage"; "a `read` that fails" |
// | A known session is confirmed again for a socket that was opened after a time without one | D100 (CPC1-35) | "a known session is confirmed again" |
// | A session taken after a debt check is this client's again: the end of its socket is told | D100 (CPC1-33) | "the debt is never paid blindly" |
// | A payment the Core keeps refusing is not repeated without end | D100 (CPC1-36) | "fails closed" |
//
// The tests run against a small model of the Core's session (`core`): one session behind the
// browser's credential, shared by every tab, with the Core's own rules: a POST that reaches its
// handler is activity, the idle expiry is 15 minutes after the last one, a sign-out ends it and
// tells its sockets. Each answer goes by what the Core holds when the request arrives.
import { afterEach, describe, expect, it } from 'vitest';
import { CORE_API_EXAMPLES, pickReplicatedState, type AuthSessionInfo, type ReplicatedState } from '../src/api';
import { createCoreClient } from '../src/client';
import { settle } from '../src/live';
import {
  createLiveSim,
  type CreateLiveSimOptions,
  type LiveClient,
  type LiveOwedSignOut,
  type LiveOwedSignOutPort,
  type LiveSecretsPort,
  type LiveSessionEnd,
  type LiveSim,
} from '../src/live/source';
import { FAKE_CREDENTIALS, OUTAGE, createFakeTransport, rateLimited, type FakeConnection, type FakeReply, type FakeTransport } from '../src/live/testing';
import { AUTH_IDLE_TIMEOUT_MS, DEFAULT_SEED, buildScenarioState, createIdleState, selectIsSignedIn, type SimErrorReport, type SimState } from '../src/sim';

const BASE_URL = 'http://127.0.0.1:4420';
const SOCKET_URL = 'ws://127.0.0.1:4420/ws';
const PASSWORD = 'MARKER-PASSWORD-7f3a';
const MINUTE = 60_000;
const SECRETS_TIMEOUT_MS = 5_000;
const WEB_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.webConsole?.value as AuthSessionInfo;
/** Another operator of the same console (the same browser, the same credential store). */
const OTHER_OPERATOR: AuthSessionInfo['operator'] = {
  ...WEB_SESSION.operator,
  id: 'OPR-003',
  username: 'second.operator',
  name: 'Second Operator',
  displayName: 'AKP Second Operator',
  initials: 'SO',
};

/** `live.client` as a page calls it: an operation that is no simulator action. */
interface PageClient {
  call(operationId: string, input?: unknown): Promise<{ ok: boolean; status: number | null; transport?: string | null }>;
}

interface Tab {
  source: LiveSim;
  reports: SimErrorReport[];
  ends: LiveSessionEnd[];
  /** Every socket this tab opened, in order. */
  sockets: FakeConnection[];
  pages: PageClient;
}

/** The Core's one session behind the browser's credential, and whether the Core can be reached. */
interface CoreModel {
  start: number;
  session: { issuedAt: number; lastActivityAt: number; absoluteExpiresAt: number; open: boolean; operator: AuthSessionInfo['operator'] };
  reachable: boolean;
  /** Operations that get no answer although the sockets work. */
  down: Set<string>;
  /** Tabs whose sockets the Core does not accept (only that tab's link is down). */
  blocked: Set<Tab>;
  /** Tabs whose next socket the Core has not answered yet: the test answers the upgrade itself. */
  parked: Set<Tab>;
  /** Every socket is taken for nobody, whatever the credential says (F66-18). */
  anonymousSockets: boolean;
  idleExpiresAt(): number;
  alive(): boolean;
  info(): AuthSessionInfo;
  /** A POST that reached its handler (ID-P9). */
  activity(): void;
  /** The Core ends the session and tells its sockets. */
  end(reason: 'SIGNED_OUT' | 'IDLE_EXPIRED' | 'USER_DISABLED' | 'ROTATED'): void;
  /** A new sign-in, of the same operator or of another one: the session behind the credential is replaced. */
  signIn(operator?: AuthSessionInfo['operator']): void;
  /** The same replacement, and the sockets of the earlier session are NOT told (the message is late, or lost). */
  replaceUnheard(operator?: AuthSessionInfo['operator']): void;
  /** Every socket is lost and nothing answers. */
  unreachable(): void;
  back(): void;
}

let fake: FakeTransport;
let core: CoreModel;
let tabs: Tab[] = [];
let recording: SimState;
/** What the Core's state is: the snapshot of every OPERATOR socket that is opened. */
let served: SimState;
let beats: (() => void)[] = [];

afterEach(() => {
  for (const tab of tabs) tab.source.stop();
  tabs = [];
  beats = [];
  (fake as FakeTransport | undefined)?.assertNoViolations();
});

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
};
const elapse = async (ms: number, step = 250): Promise<void> => {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    fake.clock.advance(Math.min(step, ms - elapsed));
    await flush();
  }
};
const until = (at: number, step = 1_000): Promise<void> => elapse(at - fake.clock.now(), step);
const requests = (operationId: string): number => fake.log.requestsOf(operationId).length;
const signOuts = (): number => requests('signOut');
const questions = (): number => requests('getAuthSession');

/** The fake transport and the model of the Core behind it. The session was issued, and last used, now. */
function boot(): void {
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  recording = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
  served = recording;
  const start = fake.clock.now();
  const open = (): FakeConnection[] => fake.connections.filter((connection) => connection.state === 'OPEN');
  core = {
    start,
    session: { issuedAt: start, lastActivityAt: start, absoluteExpiresAt: start + 8 * 60 * MINUTE, open: true, operator: WEB_SESSION.operator },
    reachable: true,
    down: new Set(),
    blocked: new Set(),
    parked: new Set(),
    anonymousSockets: false,
    idleExpiresAt: () => core.session.lastActivityAt + AUTH_IDLE_TIMEOUT_MS,
    alive: () => core.session.open && fake.clock.now() < core.idleExpiresAt() && fake.clock.now() < core.session.absoluteExpiresAt,
    info: () => ({
      ...WEB_SESSION,
      operator: core.session.operator,
      issuedAt: core.session.issuedAt,
      lastActivityAt: core.session.lastActivityAt,
      idleExpiresAt: core.idleExpiresAt(),
      absoluteExpiresAt: core.session.absoluteExpiresAt,
      serverTime: fake.clock.now(),
    }),
    activity: () => {
      core.session.lastActivityAt = fake.clock.now();
    },
    end: (reason) => {
      core.session.open = false;
      for (const connection of open()) if (connection.principal === 'OPERATOR') connection.sessionEnded(reason);
    },
    signIn: (operator) => {
      if (core.session.open) core.end('ROTATED');
      core.replaceUnheard(operator);
    },
    replaceUnheard: (operator = WEB_SESSION.operator) => {
      const now = fake.clock.now();
      core.session = { issuedAt: now, lastActivityAt: now, absoluteExpiresAt: now + 8 * 60 * MINUTE, open: true, operator };
    },
    unreachable: () => {
      core.reachable = false;
      for (const connection of open()) connection.close(1001);
    },
    back: () => {
      core.reachable = true;
    },
  };
  fake.onConnect((connection) => {
    // A socket the client gave up before the Core answered its upgrade gets no script (F66-8).
    if (connection.state !== 'CONNECTING') return;
    const owner = tabs.find((tab) => tab.sockets.includes(connection));
    if (!core.reachable || (owner !== undefined && core.blocked.has(owner))) connection.refuse();
    else if (owner !== undefined && core.parked.has(owner)) return;
    else if (core.alive() && !core.anonymousSockets) beats.push(connection.startOperator(wire(served)).beatEvery());
    else beats.push(connection.startAnonymous().beatEvery());
  });
  const answered = (operationId: string, reply: () => FakeReply): void =>
    fake.answer(operationId, () => (core.reachable && !core.down.has(operationId) ? reply() : OUTAGE));
  answered('getAuthSession', () => (core.alive() ? { status: 200, body: core.info() } : fake.example('getAuthSession', 401)));
  answered('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  answered('signOut', () => {
    if (!core.alive()) return fake.example('signOut', 401, 'notSignedIn');
    core.end('SIGNED_OUT');
    return fake.example('signOut');
  });
  answered('signIn', () => {
    core.signIn();
    return { status: 200, body: { session: core.info() } };
  });
  answered('touchSession', () => {
    if (!core.alive()) return fake.example('touchSession', 401, 'notSignedIn');
    core.activity();
    return { status: 200, body: { idleExpiresAt: core.idleExpiresAt(), absoluteExpiresAt: core.session.absoluteExpiresAt } };
  });
  answered('issuePairingCode', () => {
    if (!core.alive()) return fake.example('issuePairingCode', 401, 'notSignedIn');
    core.activity();
    return fake.example('issuePairingCode', 201, 'issued');
  });
  answered('listUsers', () => (core.alive() ? fake.example('listUsers', 200, 'seeded') : fake.example('listUsers', 401, 'notSignedIn')));
}

/** One tab of the browser: its own Live source, the shared credential. */
function openTab(options: Partial<CreateLiveSimOptions<LiveClient>> = {}): Tab {
  const sockets: FakeConnection[] = [];
  const reports: SimErrorReport[] = [];
  const ends: LiveSessionEnd[] = [];
  const source: LiveSim = createLiveSim({
    client: createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch }),
    socket: {
      url: SOCKET_URL,
      factory: (url, headers) => {
        const before = fake.connections.length;
        const socket = fake.socketFactory(url, headers);
        sockets.push(...fake.connections.slice(before));
        return socket;
      },
    },
    now: fake.clock.now,
    timers: fake.clock.timers,
    random: () => 0,
    onError: (report) => reports.push(report),
    ...options,
  });
  source.onSessionEnd((end) => ends.push(end));
  const tab: Tab = { source, reports, ends, sockets, pages: source.client as unknown as PageClient };
  tabs.push(tab);
  return tab;
}

async function signedInTab(options: Partial<CreateLiveSimOptions<LiveClient>> = {}): Promise<Tab> {
  if ((fake as FakeTransport | undefined) === undefined || tabs.length === 0) boot();
  const tab = openTab(options);
  await tab.source.ready;
  await flush();
  expect(tab.source.store.getState().auth.status).toBe('SIGNED_IN');
  return tab;
}

function expectNoCoreData(source: LiveSim): void {
  const state = source.store.getState();
  expect(state.operators).toEqual([]);
  expect(state.evidence).toEqual([]);
  expect(state.audit.rows).toEqual([]);
  expect(state.session).toBeNull();
  expect(state.device.id).toBe('');
  expect(source.session).toBeNull();
}

const signedIn = (tab: Tab): boolean => selectIsSignedIn(tab.source.store.getState());
const errors = (tab: Tab): SimErrorReport[] => tab.reports.filter((report) => report.level === 'error');

// ═══════════════════════════════════════════════════════════════════════════════════════
// D80: a local end
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-21 / D80: `signOut` while the link is not ONLINE is a local end, never a refusal', () => {
  it.each(['USER', 'LOCK'] as const)('signOut(%s) while the link is OFFLINE resolves; the replica is cleared at once; lastSessionEnd says LOCAL and the reason; no request is sent', async (reason) => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    core.unreachable();
    expect(source.link).not.toBe('ONLINE');
    const seen: string[] = [];
    source.store.subscribe((state) => seen.push(`${state.auth.status} operators=${state.operators.length}`));
    const calls = fake.calls.length;

    // The call site is fire-and-forget (the shell's menu): through `settle`, as a screen calls it.
    const log: string[] = [];
    settle(() => source.actions.signOut(reason), { ok: () => log.push('ok'), fail: (error) => log.push(`fail ${String(error)}`) });
    // In the same turn: the continuation ran, and the store is empty in ONE update.
    expect(log).toEqual(['ok']);
    expect(seen).toEqual(['SIGNED_OUT operators=0']);
    expectNoCoreData(source);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: 'SIGNED_OUT', source: 'LOCAL', signOut: reason, wasSignedIn: true, sessionState: 'RECORDING' });
    expect(source.lastSessionEnd).toBe(ends[0]);
    expect(fake.calls).toHaveLength(calls);
    await elapse(20_000, 1_000);
    expect(signOuts()).toBe(0);
    expect(ends).toHaveLength(1);
  });

  it('Lock while the link is STALE: the same local end', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    for (const stop of beats.splice(0)) stop();
    await elapse(3_000);
    expect(source.link).toBe('STALE');
    // The socket is still open; the Core is only silent, and takes no new socket.
    core.reachable = false;

    await expect(source.actions.signOut('LOCK')).resolves.toBeUndefined();
    expectNoCoreData(source);
    expect(source.store.getState().auth.status).toBe('SIGNED_OUT');
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ source: 'LOCAL', signOut: 'LOCK', reason: 'SIGNED_OUT' });
    expect(signOuts()).toBe(0);
  });

  it('no answer: a sign-out the Core does not answer while the link says ONLINE ends here too; the debt is settled as soon as the Core answers', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    fake.answerOnce('signOut', OUTAGE);
    await expect(source.actions.signOut('LOCK')).resolves.toBeUndefined();
    expectNoCoreData(source);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ source: 'LOCAL', signOut: 'LOCK', reason: 'SIGNED_OUT' });
    // The socket is reopened as after every end; it is still an OPERATOR socket: the Core is asked, then paid.
    await elapse(5_000);
    expect(fake.log.requestsOf('signOut').map((call) => call.body)).toEqual([{ reason: 'LOCK' }, { reason: 'LOCK' }]);
    expect(core.session.open).toBe(false);
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    expect(ends).toHaveLength(1);
  });

  it('nothing owed: a link that is lost and returns sends no sign-out, and the client stays signed in', async () => {
    const tab = await signedInTab();
    core.unreachable();
    await elapse(3_000);
    core.back();
    await elapse(10_000);
    expect(tab.source.link).toBe('ONLINE');
    expect(signedIn(tab)).toBe(true);
    expect(signOuts()).toBe(0);
    expect(tab.ends).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// D90, CPC1-23 (c): the debt
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-23 (c) / D90: the debt is never paid blindly', () => {
  it('the link returns: the Core is asked first, then exactly ONE sign-out is sent for the same session, before the socket is taken; its state is never shown', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    core.unreachable();
    await source.actions.signOut('LOCK');
    const asked = questions();

    // The Core is back, and the browser still presents the session: the new socket is an OPERATOR socket.
    core.back();
    const payment = fake.hold('signOut');
    await elapse(10_000);
    expect(tab.sockets.at(-1)?.principal).toBe('OPERATOR');
    expect(source.link).toBe('ONLINE');
    // One question, then one sign-out with the reason the operator gave.
    expect(questions()).toBe(asked + 1);
    expect(signOuts()).toBe(1);
    expect(fake.log.requestsOf('signOut')[0]?.body).toEqual({ reason: 'LOCK' });
    expect(fake.log.requestsOf('getAuthSession').at(-1)?.seq ?? 0).toBeLessThan(fake.log.requestsOf('signOut')[0]?.seq ?? 0);
    // Not taken: nothing of the socket's snapshot is shown, and nothing that follows it.
    expectNoCoreData(source);
    expect(signedIn(tab)).toBe(false);
    tab.sockets.at(-1)?.delta([{ op: 'replace', slice: 'activeCameraId', value: 'VIDEO-02' }]);
    expectNoCoreData(source);

    // The Core ends the session: `session.ended` and close 4401 on that socket, then the answer.
    core.end('SIGNED_OUT');
    payment.release();
    await flush();
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    expect(source.link).toBe('ONLINE');
    expectNoCoreData(source);
    // One end, the local one: the shell keeps its "Console locked" notice.
    expect(ends).toHaveLength(1);
    expect(source.lastSessionEnd).toMatchObject({ source: 'LOCAL', signOut: 'LOCK' });
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(1);
    expect(ends).toHaveLength(1);
    expect(errors(tab)).toEqual([]);
  });

  it('the Core says the session is over when it is asked (401): nothing is paid, and the client is signed out', async () => {
    const tab = await signedInTab();
    core.unreachable();
    await tab.source.actions.signOut('USER');
    core.back();
    const question = fake.hold('getAuthSession');
    await elapse(10_000);
    expect(tab.sockets.at(-1)?.principal).toBe('OPERATOR');
    // While the question is out, the session ends at the Core (a Supervisor disabled the account).
    core.end('USER_DISABLED');
    question.release(fake.example('getAuthSession', 401));
    await elapse(10_000);
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    expect(signOuts()).toBe(0);
    expect(signedIn(tab)).toBe(false);
    expectNoCoreData(tab.source);
    expect(tab.ends).toHaveLength(1);
  });

  it('the sign-out is answered 401 (the session ended between the question and the payment): that counts as done', async () => {
    const tab = await signedInTab();
    core.unreachable();
    await tab.source.actions.signOut();
    core.back();
    const payment = fake.hold('signOut');
    await elapse(10_000);
    expect(signOuts()).toBe(1);
    core.end('USER_DISABLED');
    const asked = questions();
    payment.release(fake.example('signOut', 401, 'notSignedIn'));
    await flush();
    // Done at once: no refusal is reported, and nothing is asked again.
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    expect(errors(tab)).toEqual([]);
    await elapse(60_000, 1_000);
    expect(questions()).toBe(asked);
    expect(signOuts()).toBe(1);
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    expect(tab.ends).toHaveLength(1);
    expectNoCoreData(tab.source);
  });

  it('a NEW sign-in while a debt exists (another tab): the debt is dropped, no sign-out is sent, and the new session lives', async () => {
    const a = await signedInTab();
    const b = await signedInTab();
    const first = core.session.issuedAt;
    // Only tab A loses its link; the operator locks tab A.
    core.blocked.add(a);
    a.sockets.at(-1)?.close(1001);
    await elapse(1_000);
    await a.source.actions.signOut('LOCK');
    expect(a.ends).toMatchObject([{ source: 'LOCAL', signOut: 'LOCK' }]);

    // In tab B the operator signs in again: the Core replaces the session behind the shared credential.
    await elapse(60_000, 1_000);
    await expect(b.source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    expect(core.session.issuedAt).not.toBe(first);
    expect(signedIn(b)).toBe(true);

    // Tab A's link returns. Its debt names the first session; the credential names the new one.
    core.blocked.delete(a);
    await elapse(10_000);
    expect(signOuts()).toBe(0);
    expect(core.session.open).toBe(true);
    expect(signedIn(b)).toBe(true);
    expect(b.ends).toEqual([]);
    // Tab A takes the new session, as after any probe: the debt was never owed for it.
    expect(signedIn(a)).toBe(true);
    expect(a.source.session?.issuedAt).toBe(core.session.issuedAt);
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(0);
  });

  it('a sign-in in the SAME tab while a debt exists ends the debt: nothing is asked or sent while the sign-in is out, and the new session is not signed out afterwards', async () => {
    const tab = await signedInTab();
    const { source } = tab;
    core.unreachable();
    await source.actions.signOut('LOCK');
    core.back();
    // The Core cannot answer the question about the debt, so the debt stays.
    core.down.add('getAuthSession');
    await elapse(3_000);
    expect(source.link).toBe('ONLINE');
    expect(signedIn(tab)).toBe(false);
    const asked = questions();
    expect(asked).toBeGreaterThanOrEqual(1);

    // The operator unlocks with the password; the Core takes a while to answer.
    const answer = fake.hold('signIn');
    const calls = fake.calls.length;
    const result = source.actions.signIn('andi.pratama', PASSWORD);
    await fake.arrived(calls + 1);
    core.down.clear();
    await elapse(20_000);
    expect(signOuts()).toBe(0);
    expect(questions()).toBe(asked);
    core.signIn();
    answer.release({ status: 200, body: { session: core.info() } });
    await expect(result).resolves.toMatchObject({ ok: true });
    expect(signedIn(tab)).toBe(true);
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(0);
    // The debt ended with the sign-in's answer: nothing asks about it afterwards.
    expect(questions()).toBe(asked);
    expect(core.session.open).toBe(true);
    expect(signedIn(tab)).toBe(true);
  });

  it('the question without an answer is asked again after 2 s, 4 s, 8 s (and never inside a retry-after); the socket stays untaken meanwhile', async () => {
    const tab = await signedInTab();
    const { source } = tab;
    core.unreachable();
    await source.actions.signOut('LOCK');
    core.back();
    core.down.add('getAuthSession');
    const before = questions();
    await elapse(1_000);
    expect(tab.sockets.at(-1)?.principal).toBe('OPERATOR');
    const first = fake.log.requestsOf('getAuthSession')[before]?.at ?? 0;
    await elapse(20_000);
    expect(fake.log.requestsOf('getAuthSession').slice(before).map((call) => call.at - first)).toEqual([0, 2_000, 6_000, 14_000]);
    expectNoCoreData(source);
    expect(signOuts()).toBe(0);

    // A rate limit: the next question waits for the server's time.
    core.down.clear();
    fake.answerOnce('getAuthSession', rateLimited(40));
    await elapse(11_000);
    const limited = fake.log.requestsOf('getAuthSession').at(-1)?.at ?? 0;
    expect(limited - first).toBe(30_000);
    await until(limited + 39_000);
    expect(fake.log.requestsOf('getAuthSession').at(-1)?.at).toBe(limited);
    await elapse(1_500);
    expect((fake.log.requestsOf('getAuthSession').at(-1)?.at ?? 0) - limited).toBe(40_000);
    // Now the Core answers: the same session, still open: paid.
    expect(signOuts()).toBe(1);
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
  });

  it('the link returns and the socket is anonymous (the credential names no session any more): nothing is owed, nothing is asked, nothing is sent', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    core.unreachable();
    await source.actions.signOut('LOCK');
    core.session.open = false;
    core.back();
    const asked = questions();
    await elapse(10_000);
    expect(source.link).toBe('ONLINE');
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(0);
    expect(questions()).toBe(asked);
    expect(ends).toHaveLength(1);

    // Later an OPERATOR socket is a NEW session (a sign-in in another tab): it is taken as usual.
    core.signIn();
    tab.sockets.at(-1)?.close(1001);
    await elapse(10_000);
    expect(tab.sockets.at(-1)?.principal).toBe('OPERATOR');
    expect(signedIn(tab)).toBe(true);
    await elapse(30_000, 1_000);
    expect(signOuts()).toBe(0);
  });

  it('stop() and start() while the question about the debt is out: the new run asks for itself, and the debt is paid', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    core.unreachable();
    await source.actions.signOut('LOCK');
    core.back();
    const question = fake.hold('getAuthSession');
    await elapse(10_000);
    const asked = questions();

    // The provider is mounted again (React StrictMode, or the app returns from the background).
    source.stop();
    source.start();
    await flush();
    expectNoCoreData(source);
    // The question of the stopped run gets no answer; the run that is going asks for itself.
    question.fail();
    await elapse(5_000);
    expect(questions()).toBeGreaterThan(asked);
    expect(signOuts()).toBe(1);
    expect(core.session.open).toBe(false);
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    expectNoCoreData(source);
    expect(ends).toHaveLength(1);
  });

  it('CPC1-33 / D100: a session that is taken after a debt check is this client\'s again: when the Core closes its socket with 4401 and no `session.ended` arrives, that is an end', async () => {
    boot();
    // What an earlier page left: an expiry it reckoned. The Core still holds the session, so the check takes it.
    const stored: LiveOwedSignOut = { operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt, reason: 'IDLE_EXPIRED', at: core.start };
    const tab = openTab({ owedSignOut: { read: () => stored, write: () => undefined, clear: () => undefined } });
    await tab.source.ready;
    await elapse(5_000);
    expect(signedIn(tab)).toBe(true);
    expect(tab.sockets).toHaveLength(1);
    expect(tab.ends).toEqual([]);

    // The session ends at the Core; the socket is closed, and its `session.ended` is lost.
    core.session.open = false;
    tab.sockets.at(-1)?.close(4401);
    await elapse(2_000);
    expect(tab.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: null, source: 'CLOSE', wasSignedIn: true }]);
    expect(signedIn(tab)).toBe(false);
    expectNoCoreData(tab.source);
    expect(signOuts()).toBe(0);
  });
});

describe('CPC1-31 / D90: a sign-out the Core refuses fails closed', () => {
  it.each(['LOCK', 'USER'] as const)('signOut(%s) refused with 403: the action resolves, the console is signed out here, the debt stays owed and is asked again with back-off; the session is never taken again', async (reason) => {
    const tab = await signedInTab();
    const { source, ends, reports } = tab;
    const refused = (): void => fake.answer('signOut', () => fake.example('signOut', 403, 'originNotAllowed'));
    refused();
    await expect(source.actions.signOut(reason)).resolves.toBeUndefined();
    expectNoCoreData(source);
    expect(ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'SIGNED_OUT', source: 'LOCAL', signOut: reason }]);
    expect(reports.filter((report) => report.source === 'live.session')).toMatchObject([{ level: 'error', context: { status: 403, code: 'ORIGIN_NOT_ALLOWED', reason } }]);

    // The socket is reopened; the Core still holds the session; the payment is refused again.
    const first = fake.clock.now();
    await elapse(20_000);
    expect(signedIn(tab)).toBe(false);
    expectNoCoreData(source);
    expect(core.session.open).toBe(true);
    // The action's own request, then the payments: at the reopening, and 2 s, 6 s and 14 s after it.
    const payments = fake.log.requestsOf('signOut').slice(1);
    expect(payments.map((call) => call.at - (payments[0]?.at ?? 0))).toEqual([0, 2_000, 6_000, 14_000]);
    expect((payments[0]?.at ?? 0) - first).toBeLessThanOrEqual(1_000);
    // Reported once more for the debt, not once per try.
    expect(reports.filter((report) => report.source === 'live.session')).toHaveLength(2);
    expect(ends).toHaveLength(1);

    // The Core takes the sign-out at last.
    fake.answer('signOut', () => {
      core.end('SIGNED_OUT');
      return fake.example('signOut');
    });
    await elapse(20_000);
    expect(core.session.open).toBe(false);
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    const sent = signOuts();
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(sent);
    expect(ends).toHaveLength(1);
  });

  it('CPC1-36 / D100: a payment the Core refuses again and again is not repeated without end: after five refusals in a row the source stops asking by itself, says so once, and a new socket asks again', async () => {
    const tab = await signedInTab();
    const { source, reports } = tab;
    fake.answer('signOut', () => fake.example('signOut', 403, 'originNotAllowed'));
    await source.actions.signOut('LOCK');
    await elapse(10 * MINUTE, 1_000);
    expect(signedIn(tab)).toBe(false);
    expect(core.session.open).toBe(true);
    // The action's own request, then five payments: at the reopening, and 2 s, 6 s, 14 s and 30 s after it. Then none.
    const payments = fake.log.requestsOf('signOut').slice(1);
    expect(payments.map((call) => call.at - (payments[0]?.at ?? 0))).toEqual([0, 2_000, 6_000, 14_000, 30_000]);
    // The refused action, the refused debt (once), and the giving up (once).
    const said = reports.filter((report) => report.source === 'live.session');
    expect(said).toHaveLength(3);
    expect(said[2]).toMatchObject({ level: 'error', context: { operationId: 'signOut', refusals: 5, reason: 'LOCK' } });
    expect(JSON.stringify(said)).not.toContain(PASSWORD);

    // Still owed, and still closed: a new socket of the session is not taken, and it asks again,
    // more than once (the count of the refusals started again), without saying anything new.
    tab.sockets.at(-1)?.close(1001);
    await elapse(80_000, 1_000);
    expect(fake.log.requestsOf('signOut').length).toBeGreaterThan(7);
    expect(reports.filter((report) => report.source === 'live.session')).toHaveLength(3);
    expect(signedIn(tab)).toBe(false);
    expectNoCoreData(source);
    expect(tab.ends).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// D80 amended by D90, CPC1-23 (a), (b): the expiry
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-23 (a), (b) / D90: the expiry this client reckons with is not decided here while the Core can be asked', () => {
  it('the offline local end still works as ruled: the idle expiry passes while the Core cannot be reached: EXPIRED, the replica cleared, IDLE_EXPIRED and LOCAL', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    const idleAt = core.idleExpiresAt();
    core.unreachable();
    await until(idleAt - 1_000);
    // One second before the instant: still signed in, the last state still shown.
    expect(signedIn(tab)).toBe(true);
    expect(ends).toEqual([]);
    await elapse(1_000);
    expect(source.store.getState().auth.status).toBe('EXPIRED');
    expectNoCoreData(source);
    expect(ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'IDLE_EXPIRED', source: 'LOCAL', signOut: null, wasSignedIn: true, at: idleAt }]);
    expect(signOuts()).toBe(0);
  });

  it('the absolute expiry likewise', async () => {
    boot();
    core.session.absoluteExpiresAt = core.start + MINUTE;
    const tab = openTab();
    await tab.source.ready;
    await flush();
    core.unreachable();
    await until(core.start + MINUTE - 1_000);
    expect(signedIn(tab)).toBe(true);
    await elapse(1_000);
    expect(tab.source.store.getState().auth.status).toBe('EXPIRED');
    expect(tab.ends).toMatchObject([{ reason: 'ABSOLUTE_EXPIRED', source: 'LOCAL', at: core.start + MINUTE }]);
    expectNoCoreData(tab.source);
  });

  it('while the Core can be asked, the instant is not decided here: the client asks; the Core says 401; the session ends with the expiry as its reason, and nothing is owed', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    const idleAt = core.idleExpiresAt();
    const asked = questions();
    await until(idleAt - 1_000);
    expect(questions()).toBe(asked);
    expect(signedIn(tab)).toBe(true);
    await elapse(1_000);
    expect(questions()).toBe(asked + 1);
    expect(source.store.getState().auth.status).toBe('EXPIRED');
    expect(ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'IDLE_EXPIRED', source: 'REST', signOut: null }]);
    expectNoCoreData(source);
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(0);
    expect(ends).toHaveLength(1);
  });

  it('two tabs: the operator works in tab B; tab A\'s reckoned instant passes while ONLINE: A asks, takes the Core\'s instant and does not end; a blip of A\'s link afterwards ends nothing; tab B stays signed in', async () => {
    const a = await signedInTab();
    const b = await signedInTab();
    const first = core.idleExpiresAt();
    // Minute 10: activity in tab B. The Core counts it; tab A never sees it.
    await until(core.start + 10 * MINUTE);
    expect(await b.pages.call('issuePairingCode')).toMatchObject({ ok: true });
    const real = core.idleExpiresAt();
    expect(real).toBe(core.start + 10 * MINUTE + AUTH_IDLE_TIMEOUT_MS);
    expect(a.source.session?.idleExpiresAt).toBe(first);

    // Minute 15: tab A's own reckoning says "expired". It asks the Core.
    const asked = questions();
    await until(first + 1_000);
    expect(questions()).toBe(asked + 1);
    expect(a.source.session?.idleExpiresAt).toBe(real);
    expect(signedIn(a)).toBe(true);
    expect(a.ends).toEqual([]);

    // Minute 16: tab A's link blips once.
    await until(core.start + 16 * MINUTE);
    a.sockets.at(-1)?.close(1001);
    await elapse(10_000);
    expect(a.source.link).toBe('ONLINE');
    expect(signedIn(a)).toBe(true);
    expect(a.ends).toEqual([]);
    // The shared session was not signed out, and tab B was not thrown out of its work.
    expect(signOuts()).toBe(0);
    expect(core.session.open).toBe(true);
    expect(signedIn(b)).toBe(true);
    expect(b.ends).toEqual([]);
  });

  it('a lost answer: the Core counted a POST whose answer never arrived; at the reckoned instant the client asks and takes the later instant instead of ending', async () => {
    const tab = await signedInTab();
    const first = core.idleExpiresAt();
    await until(core.start + 10 * MINUTE);
    // The request reaches the Core, which counts it; the answer is lost on the way back.
    fake.answerOnce('issuePairingCode', () => {
      core.activity();
      return OUTAGE;
    });
    expect(await tab.pages.call('issuePairingCode')).toMatchObject({ ok: false, status: null });
    const real = core.idleExpiresAt();
    expect(tab.source.session?.idleExpiresAt).toBe(first);

    await until(first + 1_000);
    expect(tab.source.session?.idleExpiresAt).toBe(real);
    expect(signedIn(tab)).toBe(true);
    // Also a blip after the first instant ends nothing, and signs nothing out.
    tab.sockets.at(-1)?.close(1001);
    await elapse(10_000);
    expect(signedIn(tab)).toBe(true);
    expect(tab.ends).toEqual([]);
    expect(signOuts()).toBe(0);
    expect(core.session.open).toBe(true);
  });

  it('RESYNCING is no lost link: the instant has passed, the Core cannot be asked over REST, the socket waits for a snapshot: nothing ends here', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    // The operator works in another client of this session; this one never sees it.
    await until(core.start + 10 * MINUTE);
    core.activity();
    core.down.add('getAuthSession');
    await until(core.start + AUTH_IDLE_TIMEOUT_MS + 5_000);
    // The question got no answer, and the socket is the session's own: nothing ended.
    expect(source.link).toBe('ONLINE');
    expect(signedIn(tab)).toBe(true);

    // A gap: the client asks for a snapshot and reads RESYNCING until it comes.
    tab.sockets.at(-1)?.delta([{ op: 'replace', slice: 'activeCameraId', value: 'VIDEO-02' }], { revision: fake.position.revision + 5 });
    expect(source.link).toBe('RESYNCING');
    await flush();
    expect(ends).toEqual([]);
    expect(signedIn(tab)).toBe(true);
    tab.sockets.at(-1)?.snapshot(wire(recording));
    await elapse(60_000, 1_000);
    expect(ends).toEqual([]);
    expect(signedIn(tab)).toBe(true);
    // The Core answers again: its instant is taken.
    core.down.clear();
    await elapse(30_000, 1_000);
    expect(source.session?.idleExpiresAt).toBe(core.idleExpiresAt());
  });

  it('when the link is lost after the instant and the Core cannot be asked either, the end follows: LOCAL', async () => {
    const tab = await signedInTab();
    core.down.add('getAuthSession');
    // The question was asked at the instant and 2 s, 6 s, 14 s and 30 s after it; the next one is due at 60 s.
    await until(core.idleExpiresAt() + 31_000);
    expect(signedIn(tab)).toBe(true);
    const lostAt = fake.clock.now();
    core.unreachable();
    // At once, in the turns of the lost link: not when the next question is due.
    await flush();
    expect(fake.clock.now()).toBe(lostAt);
    expect(tab.ends).toMatchObject([{ reason: 'IDLE_EXPIRED', source: 'LOCAL', at: lostAt }]);
    expect(tab.source.store.getState().auth.status).toBe('EXPIRED');
  });

  it('after a local expiry the link returns and the Core still holds the session (activity this tab never saw): NO sign-out is sent, and the session is taken again', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    await until(core.start + 10 * MINUTE);
    // Another tab's POST.
    core.activity();
    core.unreachable();
    await until(core.start + AUTH_IDLE_TIMEOUT_MS);
    expect(ends).toMatchObject([{ reason: 'IDLE_EXPIRED', source: 'LOCAL' }]);
    expectNoCoreData(source);

    core.back();
    await elapse(10_000);
    // The reckoning was early. The session was never ended for it: not here for good, and not at the Core.
    expect(signOuts()).toBe(0);
    expect(core.session.open).toBe(true);
    expect(signedIn(tab)).toBe(true);
    expect(source.session?.idleExpiresAt).toBe(core.idleExpiresAt());
    expect(ends).toHaveLength(1);
  });

  it('after a local expiry the link returns and the Core has ended the session: signed out, and nothing is sent', async () => {
    const tab = await signedInTab();
    core.unreachable();
    await until(core.idleExpiresAt());
    expect(tab.ends).toHaveLength(1);
    core.back();
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(0);
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    expect(tab.source.store.getState().auth.status).toBe('EXPIRED');
    expect(tab.ends).toHaveLength(1);
  });

  it('an answered POST of this client moves the idle instant by the idle time-out', async () => {
    const tab = await signedInTab();
    await until(core.start + 10 * MINUTE);
    expect(await tab.pages.call('issuePairingCode')).toMatchObject({ ok: true });
    core.unreachable();
    await until(core.start + AUTH_IDLE_TIMEOUT_MS + 10_000);
    expect(signedIn(tab)).toBe(true);
    await until(core.start + 10 * MINUTE + AUTH_IDLE_TIMEOUT_MS - 1_000);
    expect(signedIn(tab)).toBe(true);
    await elapse(1_000);
    expect(tab.ends).toMatchObject([{ reason: 'IDLE_EXPIRED', source: 'LOCAL', at: core.start + 10 * MINUTE + AUTH_IDLE_TIMEOUT_MS }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// D90, CPC1-24: the debt across a reload
// ═══════════════════════════════════════════════════════════════════════════════════════

interface FakePort extends LiveOwedSignOutPort {
  stored: unknown;
  calls: string[];
}

/** The storage an app gives for the debt: one record, shared by every tab of the origin. */
function fakePort(stored: unknown = null): FakePort {
  const port: FakePort = {
    stored,
    calls: [],
    read: () => {
      port.calls.push('read');
      return port.stored as LiveOwedSignOut | null;
    },
    write: (debt) => {
      port.calls.push('write');
      port.stored = debt;
    },
    clear: () => {
      port.calls.push('clear');
      port.stored = null;
    },
  };
  return port;
}

interface SlowPort extends LiveOwedSignOutPort {
  stored: unknown;
  calls: string[];
  /** The calls the storage has not finished yet, oldest first. Each takes effect when it is finished. */
  out: { name: 'read' | 'write' | 'clear'; finish(): void }[];
}

/** A storage that answers LATER: every call returns a promise, and does its work only when the test finishes it. */
function slowPort(stored: unknown = null): SlowPort {
  const port: SlowPort = {
    stored,
    calls: [],
    out: [],
    read: () => {
      port.calls.push('read');
      return new Promise<LiveOwedSignOut | null>((resolve) => {
        port.out.push({ name: 'read', finish: () => resolve(port.stored as LiveOwedSignOut | null) });
      });
    },
    write: (debt) => {
      port.calls.push('write');
      return new Promise<void>((resolve) => {
        port.out.push({
          name: 'write',
          finish: () => {
            port.stored = debt;
            resolve();
          },
        });
      });
    },
    clear: () => {
      port.calls.push('clear');
      return new Promise<void>((resolve) => {
        port.out.push({
          name: 'clear',
          finish: () => {
            port.stored = null;
            resolve();
          },
        });
      });
    },
  };
  return port;
}

/** The storage finishes one call that is out. */
async function finish(port: SlowPort, name: 'read' | 'write' | 'clear'): Promise<void> {
  const at = port.out.findIndex((call) => call.name === name);
  expect(at, `a ${name} is out`).not.toBe(-1);
  port.out.splice(at, 1)[0]?.finish();
  await flush();
}

/** The storage finishes what is out, the NEWEST call first: out of order whenever two calls are out at once. */
async function finishNewestFirst(port: SlowPort): Promise<void> {
  for (let guard = 0; port.out.length > 0 && guard < 20; guard += 1) {
    port.out.pop()?.finish();
    await flush();
  }
}

describe('CPC1-24 / D90: the debt of a local end survives a reload when the app gives a storage for it', () => {
  it('a Lock while the Core cannot be reached is written BEFORE the end is reported: the session it is for, the reason, the instant, and no credential', async () => {
    boot();
    const port = fakePort();
    const tab = openTab({ owedSignOut: port });
    await tab.source.ready;
    await flush();
    expect(port.calls).toEqual(['read']);
    core.unreachable();
    const atReport: unknown[] = [];
    tab.source.onSessionEnd(() => atReport.push(port.stored));
    await tab.source.actions.signOut('LOCK');
    const debt = { operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt, reason: 'LOCK', at: fake.clock.now() };
    expect(port.stored).toEqual(debt);
    expect(atReport).toEqual([debt]);
    expect(Object.keys(port.stored as object).sort()).toEqual(['at', 'issuedAt', 'operatorId', 'reason']);
    expect(port.calls).toEqual(['read', 'write']);
  });

  it('a reload after an offline Lock (a new source, the same credential, the same storage): the session is NOT taken, and the sign-out is sent once', async () => {
    boot();
    const port = fakePort();
    const tab = openTab({ owedSignOut: port });
    await tab.source.ready;
    await flush();
    core.unreachable();
    await tab.source.actions.signOut('LOCK');
    expect(port.stored).not.toBeNull();

    // The page is loaded again. The browser still presents the session, and the Core answers again.
    tab.source.stop();
    core.back();
    const reloaded = openTab({ owedSignOut: port });
    const seen: string[] = [];
    reloaded.source.store.subscribe((state) => seen.push(state.auth.status));
    await reloaded.source.ready;
    await elapse(10_000);
    // Never signed in, not for a moment, and nothing of the Core was shown.
    expect(seen.filter((status) => status === 'SIGNED_IN')).toEqual([]);
    expect(signedIn(reloaded)).toBe(false);
    expectNoCoreData(reloaded.source);
    expect(fake.log.requestsOf('signOut').map((call) => call.body)).toEqual([{ reason: 'LOCK' }]);
    expect(core.session.open).toBe(false);
    expect(reloaded.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    // Paid: the storage is empty again.
    expect(port.stored).toBeNull();
    expect(port.calls.at(-1)).toBe('clear');
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(1);
    expect(errors(reloaded)).toEqual([]);
  });

  it('a second tab that finds a debt for the credential\'s session pays it rather than taking the session', async () => {
    boot();
    const port = fakePort({ operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt, reason: 'USER', at: core.start });
    const second = openTab({ owedSignOut: port });
    await second.source.ready;
    await elapse(5_000);
    expect(signedIn(second)).toBe(false);
    expect(fake.log.requestsOf('signOut').map((call) => call.body)).toEqual([{ reason: 'USER' }]);
    expect(core.session.open).toBe(false);
    expect(port.stored).toBeNull();
  });

  it('a stored debt for ANOTHER session is dropped: the session is taken and nothing is signed out', async () => {
    boot();
    const port = fakePort({ operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt - 60_000, reason: 'LOCK', at: core.start });
    const tab = openTab({ owedSignOut: port });
    await tab.source.ready;
    await elapse(5_000);
    expect(signedIn(tab)).toBe(true);
    expect(signOuts()).toBe(0);
    expect(core.session.open).toBe(true);
    expect(port.stored).toBeNull();
    expect(port.calls).toEqual(['read', 'clear']);
  });

  it('the link returns and the socket is nobody\'s (the credential names no session): the debt lapses and the storage is cleared at once, without a question', async () => {
    boot();
    const port = fakePort();
    const tab = openTab({ owedSignOut: port });
    await tab.source.ready;
    await flush();
    core.unreachable();
    await tab.source.actions.signOut('LOCK');
    expect(port.stored).not.toBeNull();
    // The session ends at the Core while the link is down.
    core.session.open = false;
    core.back();
    const asked = questions();
    await elapse(10_000);
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    expect(port.stored).toBeNull();
    expect(port.calls).toEqual(['read', 'write', 'clear']);
    expect(questions()).toBe(asked);
    expect(signOuts()).toBe(0);
  });

  it('a stored debt whose session is over at the Core is dropped: signed out, nothing sent', async () => {
    boot();
    const port = fakePort({ operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt, reason: 'LOCK', at: core.start });
    core.session.open = false;
    const tab = openTab({ owedSignOut: port });
    await tab.source.ready;
    await elapse(5_000);
    expect(signedIn(tab)).toBe(false);
    expect(signOuts()).toBe(0);
    expect(port.stored).toBeNull();
  });

  it('a stored EXPIRY debt: when the Core still holds the session it is taken again; no sign-out is ever sent for an expiry', async () => {
    boot();
    const port = fakePort({ operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt, reason: 'IDLE_EXPIRED', at: core.start });
    const tab = openTab({ owedSignOut: port });
    await tab.source.ready;
    await elapse(5_000);
    expect(signedIn(tab)).toBe(true);
    expect(signOuts()).toBe(0);
    expect(port.stored).toBeNull();
  });

  it('CPC1-34 / D100: a stored value that is no debt (a text, a record with a credential-like member and no reason) is dropped, cleared and reported, and the start is CLOSED: it may have been a debt, so the session is not taken', async () => {
    for (const stored of ['LOCK', { operatorId: 'OPR-002', issuedAt: 'yesterday', reason: 'LOCK', at: 1 }, { operatorId: 'OPR-002', issuedAt: 1, reason: 'ELSE', at: 1 }]) {
      boot();
      const port = fakePort(stored);
      const tab = openTab({ owedSignOut: port });
      await tab.source.ready;
      await elapse(2_000);
      expect(signedIn(tab), JSON.stringify(stored)).toBe(false);
      expectNoCoreData(tab.source);
      expect(port.stored).toBeNull();
      expect(tab.reports.filter((report) => report.source === 'live.owed')).toMatchObject([{ level: 'warn' }, { level: 'error' }]);
      // Nothing is known to be owed: nothing is signed out.
      expect(signOuts()).toBe(0);
      expect(core.session.open).toBe(true);
      tab.source.stop();
      fake.assertNoViolations();
      tabs = [];
    }
  });

  it('CPC1-34 / D100: a `read` that returns null (now, or later) means nothing is owed: the session is taken, and nothing is reported', async () => {
    for (const later of [false, true]) {
      boot();
      const port = fakePort();
      if (later) {
        port.read = () => {
          port.calls.push('read');
          return Promise.resolve(null);
        };
      }
      const tab = openTab({ owedSignOut: port });
      await tab.source.ready;
      await flush();
      expect(signedIn(tab), String(later)).toBe(true);
      expect(tab.reports).toEqual([]);
      expect(port.calls).toEqual(['read']);
      tab.source.stop();
      fake.assertNoViolations();
      tabs = [];
    }
  });

  it('CPC1-34 / D100: a `read` that THROWS is "a debt may exist": the Core is asked, the session it names is NOT taken, one report says why, and a fresh sign-in is required; the storage is not asked again', async () => {
    boot();
    const secret = 'MARKER-STORED-VALUE-91c2';
    const port = fakePort();
    port.read = () => {
      port.calls.push('read');
      throw new RangeError(`the storage failed while it held ${secret}`);
    };
    const tab = openTab({ owedSignOut: port });
    const seen: string[] = [];
    tab.source.store.subscribe((state) => seen.push(state.auth.status));
    await tab.source.ready;
    await flush();
    // Closed: the Core was asked and names a session, and the client is signed out all the same.
    expect(questions()).toBe(1);
    expect(tab.sockets.at(-1)?.principal).toBe('OPERATOR');
    expect(signedIn(tab)).toBe(false);
    expectNoCoreData(tab.source);
    expect(seen.filter((status) => status === 'SIGNED_IN')).toEqual([]);
    // Nothing is known to be owed, so nothing is signed out at the Core.
    expect(signOuts()).toBe(0);
    expect(core.session.open).toBe(true);
    const failures = (): SimErrorReport[] => tab.reports.filter((report) => report.source === 'live.secrets');
    const declined = (): SimErrorReport[] => tab.reports.filter((report) => report.source === 'live.owed');
    expect(failures()).toMatchObject([{ level: 'error', context: { port: 'owedSignOut.read', errorName: 'RangeError' } }]);
    expect(declined()).toMatchObject([{ level: 'error' }]);
    expect(JSON.stringify([tab.reports, tab.source.errors()])).not.toContain(secret);
    expect(failures()[0]?.stack).toBeUndefined();

    // The same session is not taken later either (the link is lost and returns), and it is said once.
    tab.sockets.at(-1)?.close(1001);
    await elapse(10_000);
    expect(tab.sockets.at(-1)?.principal).toBe('OPERATOR');
    expect(signedIn(tab)).toBe(false);
    expectNoCoreData(tab.source);
    expect(seen.filter((status) => status === 'SIGNED_IN')).toEqual([]);
    expect(declined()).toHaveLength(1);

    // The fresh sign-in is what is required, and it is taken.
    await expect(tab.source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    expect(signedIn(tab)).toBe(true);
    expect(tab.source.session?.issuedAt).toBe(core.session.issuedAt);

    // Not asked again: the Lock is not written, the debt lives in memory, and nothing more is reported.
    core.unreachable();
    await tab.source.actions.signOut('LOCK');
    expect(port.calls).toEqual(['read']);
    core.back();
    await elapse(10_000);
    expect(signOuts()).toBe(1);
    expect(failures()).toHaveLength(1);
    expect(declined()).toHaveLength(1);
  });

  it('CPC1-34 / D100: a `read` that never answers: nothing is asked for 5,000 ms, then the start goes on CLOSED, with the two reports', async () => {
    boot();
    const port = fakePort();
    port.read = () => new Promise<LiveOwedSignOut | null>(() => undefined);
    const tab = openTab({ owedSignOut: port });
    await flush();
    // Nothing is asked for, and no socket is taken, before the storage was read.
    expect(questions()).toBe(0);
    expect(signedIn(tab)).toBe(false);
    fake.clock.advance(SECRETS_TIMEOUT_MS - 1);
    await flush();
    expect(questions()).toBe(0);
    fake.clock.advance(1);
    await flush();
    expect(questions()).toBe(1);
    expect(signedIn(tab)).toBe(false);
    expectNoCoreData(tab.source);
    expect(tab.reports.filter((report) => report.source === 'live.secrets')).toMatchObject([{ context: { port: 'owedSignOut.read', timedOut: true } }]);
    expect(tab.reports.filter((report) => report.source === 'live.owed')).toMatchObject([{ level: 'error' }]);
    expect(signOuts()).toBe(0);
    await elapse(60_000, 1_000);
    expect(signedIn(tab)).toBe(false);
    expect(tab.reports).toHaveLength(2);
  });

  it('CPC1-34 / D100: a `read` that throws while the credential names NO session: signed out as usual, nothing about a session that was not taken; a session that is issued later is taken', async () => {
    boot();
    core.session.open = false;
    const port = fakePort();
    port.read = () => {
      throw new Error('not available');
    };
    const tab = openTab({ owedSignOut: port });
    await tab.source.ready;
    await elapse(2_000);
    expect(signedIn(tab)).toBe(false);
    expect(tab.reports.filter((report) => report.source === 'live.owed')).toEqual([]);

    // Somebody signs in with this browser (another tab), and this tab's link returns.
    core.signIn();
    tab.sockets.at(-1)?.close(1001);
    await elapse(10_000);
    expect(signedIn(tab)).toBe(true);
    expect(tab.source.session?.issuedAt).toBe(core.session.issuedAt);
    expect(tab.reports.filter((report) => report.source === 'live.owed')).toEqual([]);
  });

  it('CPC1-34 / D100: the fresh sign-in ends the closed start, also when it comes before the Core answered the first question: a session that follows it is taken', async () => {
    boot();
    const port = fakePort();
    port.read = () => {
      throw new Error('not available');
    };
    // The Core does not answer the first question, so nothing was declined yet when the operator signs in.
    core.down.add('getAuthSession');
    const tab = openTab({ owedSignOut: port });
    await elapse(1_000);
    expect(signedIn(tab)).toBe(false);
    await expect(tab.source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    expect(signedIn(tab)).toBe(true);
    core.down.delete('getAuthSession');

    // That session ends at the Core; later somebody signs in again with this browser, and this tab's link returns.
    await elapse(5_000);
    core.end('USER_DISABLED');
    await elapse(5_000);
    expect(signedIn(tab)).toBe(false);
    core.signIn();
    tab.sockets.at(-1)?.close(1001);
    await elapse(10_000);
    expect(signedIn(tab)).toBe(true);
    expect(tab.reports.filter((report) => report.source === 'live.owed')).toEqual([]);
  });

  it('CPC1-34 / D100: after a closed start, a session another tab signs in to LATER is another session, and it is taken', async () => {
    boot();
    const port = fakePort();
    port.read = () => {
      throw new Error('not available');
    };
    const tab = openTab({ owedSignOut: port });
    await tab.source.ready;
    await elapse(2_000);
    expect(signedIn(tab)).toBe(false);
    const first = core.session.issuedAt;

    await elapse(30_000, 1_000);
    core.signIn();
    await elapse(10_000);
    expect(core.session.issuedAt).not.toBe(first);
    expect(signedIn(tab)).toBe(true);
    expect(tab.source.session?.issuedAt).toBe(core.session.issuedAt);
    expect(signOuts()).toBe(0);
  });

  it('without a storage the behaviour is as before: a reload forgets the debt (the tablet drops its token at the local end instead)', async () => {
    const tab = await signedInTab();
    core.unreachable();
    await tab.source.actions.signOut('LOCK');
    tab.source.stop();
    core.back();
    const reloaded = openTab();
    await reloaded.source.ready;
    await elapse(5_000);
    expect(signedIn(reloaded)).toBe(true);
    expect(signOuts()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// D100, CPC1-34: a storage that answers later
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-34 / D100: an asynchronous storage: the calls take effect in the order they were asked for', () => {
  it('a `clear` that is still out does not erase a debt that is written after it was asked for: the write is made only when the storage has finished the clear', async () => {
    boot();
    // A debt of an EARLIER session is stored: the start finds it is not owed, takes the session and asks for its removal.
    const port = slowPort({ operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt - 60_000, reason: 'LOCK', at: core.start });
    const tab = openTab({ owedSignOut: port });
    await flush();
    await finish(port, 'read');
    await tab.source.ready;
    await flush();
    expect(signedIn(tab)).toBe(true);
    expect(port.out.map((call) => call.name)).toEqual(['clear']);

    // The clear is still out when the operator locks the console, and the Core cannot be reached.
    core.unreachable();
    await tab.source.actions.signOut('LOCK');
    const debt = { operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt, reason: 'LOCK', at: fake.clock.now() };
    // The write waits for its turn: two calls are never out at once.
    expect(port.calls).toEqual(['read', 'clear']);
    await finishNewestFirst(port);
    expect(port.calls).toEqual(['read', 'clear', 'write']);
    // The debt that was asked for LAST is what the storage holds.
    expect(port.stored).toEqual(debt);
    expect(tab.reports.filter((report) => report.source === 'live.secrets')).toEqual([]);

    // So a page that is loaded again finds it: the session is not taken, and the sign-out is paid once.
    tab.source.stop();
    core.back();
    const reloaded = openTab({ owedSignOut: port });
    await flush();
    await finish(port, 'read');
    await reloaded.source.ready;
    await elapse(4_000);
    await finishNewestFirst(port);
    expect(signedIn(reloaded)).toBe(false);
    expect(fake.log.requestsOf('signOut').map((call) => call.body)).toEqual([{ reason: 'LOCK' }]);
    expect(port.stored).toBeNull();
  });

  it('a `write` that is still out is not overtaken by the `clear` that follows it: the paid debt is gone from the storage', async () => {
    boot();
    const port = slowPort();
    const tab = openTab({ owedSignOut: port });
    await flush();
    await finish(port, 'read');
    await tab.source.ready;
    await flush();
    expect(signedIn(tab)).toBe(true);

    // Lock while the Core cannot be reached: the write goes out, and the storage is slow with it.
    core.unreachable();
    await tab.source.actions.signOut('LOCK');
    expect(port.out.map((call) => call.name)).toEqual(['write']);
    // The Core is back at once: the debt is checked and paid while the write is still out.
    core.back();
    await elapse(4_000);
    expect(signOuts()).toBe(1);
    expect(core.session.open).toBe(false);
    // The clear waits for its turn.
    expect(port.calls).toEqual(['read', 'write']);
    await finishNewestFirst(port);
    expect(port.calls).toEqual(['read', 'write', 'clear']);
    expect(port.stored).toBeNull();
    expect(tab.reports.filter((report) => report.source === 'live.secrets')).toEqual([]);
  });

  it('`stop()` ends the waiting and the reports, not the order: a call that waits is still made in its turn', async () => {
    boot();
    const port = slowPort({ operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt - 60_000, reason: 'LOCK', at: core.start });
    const tab = openTab({ owedSignOut: port });
    await flush();
    await finish(port, 'read');
    await tab.source.ready;
    await flush();
    core.unreachable();
    await tab.source.actions.signOut('LOCK');
    const debt = { operatorId: WEB_SESSION.operator.id, issuedAt: core.session.issuedAt, reason: 'LOCK', at: fake.clock.now() };
    expect(port.calls).toEqual(['read', 'clear']);

    // The page goes away while the clear is out and the write waits.
    tab.source.stop();
    const said = tab.reports.length;
    await finishNewestFirst(port);
    expect(port.calls).toEqual(['read', 'clear', 'write']);
    expect(port.stored).toEqual(debt);
    await elapse(2 * SECRETS_TIMEOUT_MS, 1_000);
    expect(tab.reports).toHaveLength(said);
  });

  it('a call that waits behind one the storage never finishes is not made: the storage failed, which is reported once, and it is not asked again', async () => {
    boot();
    const port = slowPort();
    const tab = openTab({ owedSignOut: port });
    await flush();
    await finish(port, 'read');
    await tab.source.ready;
    await flush();
    core.unreachable();
    await tab.source.actions.signOut('LOCK');
    core.back();
    // The debt is paid while the write is out; the clear waits. Then the write runs out of its 5,000 ms.
    await elapse(4_000);
    expect(signOuts()).toBe(1);
    expect(port.calls).toEqual(['read', 'write']);
    await elapse(2_000);
    const failures = (): SimErrorReport[] => tab.reports.filter((report) => report.source === 'live.secrets');
    expect(failures()).toMatchObject([{ context: { port: 'owedSignOut.write', timedOut: true } }]);
    // The clear that waited is given up with the storage: it is not made, and it is not reported by itself.
    await elapse(2 * SECRETS_TIMEOUT_MS, 1_000);
    expect(port.calls).toEqual(['read', 'write']);
    expect(failures()).toHaveLength(1);
    // The storage finishes the write at last: still nothing is asked of it.
    await finishNewestFirst(port);
    await elapse(2 * SECRETS_TIMEOUT_MS, 1_000);
    expect(port.calls).toEqual(['read', 'write']);
    expect(failures()).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// D100, CPC1-35: whose session a socket carries after a time without one
// ═══════════════════════════════════════════════════════════════════════════════════════

/** What a tab showed, update by update: who is signed in, and whether the Core's recording is on screen. */
interface Shown {
  operatorId: string | null;
  issuedAt: number | null;
  recording: boolean;
}

function watch(tab: Tab): Shown[] {
  const shown: Shown[] = [];
  tab.source.store.subscribe((state) => {
    const signed = state.auth.status === 'SIGNED_IN';
    shown.push({ operatorId: signed ? state.auth.operatorId : null, issuedAt: signed ? state.auth.issuedAt : null, recording: state.session !== null });
  });
  return shown;
}

/** Only this tab loses its link (the other tabs of the browser keep theirs). */
async function offline(tab: Tab): Promise<void> {
  core.blocked.add(tab);
  tab.sockets.at(-1)?.close(1001);
  await elapse(1_000);
  expect(tab.source.link).not.toBe('ONLINE');
}

describe('CPC1-35 / D100: a known session is confirmed again for a socket that was opened after a time without one', () => {
  it('ANOTHER operator signs in with the same browser while this tab is offline: at the reconnect ONE question, the earlier session ends here (ROTATED, nothing owed), and the new one is taken as at a fresh start; never the earlier operator with the new socket\'s state', async () => {
    const a = await signedInTab();
    const shown = watch(a);
    const first = core.session.issuedAt;
    await offline(a);

    // In another tab operator B signs in: the credential of the browser now names B's session. The Core's state moved on, too.
    await elapse(30_000, 1_000);
    core.signIn(OTHER_OPERATOR);
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    const asked = questions();

    core.blocked.delete(a);
    await elapse(10_000);
    // Never, not for one update: the earlier operator on screen with what the new socket sent.
    expect(shown.filter((entry) => entry.operatorId === WEB_SESSION.operator.id && !entry.recording)).toEqual([]);
    expect(shown.filter((entry) => entry.issuedAt === first && !entry.recording)).toEqual([]);
    // And never the new operator with the earlier replica.
    expect(shown.filter((entry) => entry.operatorId === OTHER_OPERATOR.id && entry.recording)).toEqual([]);
    // Tab A shows B's session, with the state of B's socket.
    expect(signedIn(a)).toBe(true);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(a.source.store.getState().auth).toMatchObject({ operatorId: OTHER_OPERATOR.id, issuedAt: core.session.issuedAt });
    expect(a.source.store.getState().session).toBeNull();
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST', signOut: null, wasSignedIn: true }]);
    // Nothing is owed for a session that is over, and B's session is not signed out.
    expect(signOuts()).toBe(0);
    expect(core.session.open).toBe(true);
    // One question for the reconnect, and the one every fresh start asks.
    expect(questions()).toBe(asked + 2);
    expect(errors(a)).toEqual([]);
  });

  it('the SAME operator signed in again elsewhere (another session of the same operator): the same end, and the new session is taken', async () => {
    const a = await signedInTab();
    const shown = watch(a);
    const first = core.session.issuedAt;
    await offline(a);
    await elapse(30_000, 1_000);
    core.signIn();
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    expect(core.session.issuedAt).not.toBe(first);

    core.blocked.delete(a);
    await elapse(10_000);
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST', wasSignedIn: true }]);
    expect(signedIn(a)).toBe(true);
    expect(a.source.session?.issuedAt).toBe(core.session.issuedAt);
    expect(shown.filter((entry) => entry.issuedAt === first && !entry.recording)).toEqual([]);
    expect(signOuts()).toBe(0);
  });

  it('another operator whose session was issued at the very instant of the earlier one is another session all the same', async () => {
    const a = await signedInTab();
    await offline(a);
    core.session = { ...core.session, operator: OTHER_OPERATOR };
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    core.blocked.delete(a);
    await elapse(10_000);
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST' }]);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(a.source.session?.issuedAt).toBe(core.start);
  });

  it('the session is still the same one: ONE question, no end, and it goes on with the Core\'s present instants and the state of the new socket', async () => {
    const a = await signedInTab();
    await offline(a);
    // Another tab of the same session is used meanwhile (a POST this tab never saw), and the Core's state moves on.
    await elapse(5 * MINUTE, 1_000);
    core.activity();
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    const asked = questions();

    core.blocked.delete(a);
    await elapse(10_000);
    expect(a.ends).toEqual([]);
    expect(signedIn(a)).toBe(true);
    // The Core's present instants, not the ones this tab reckoned with while it was offline.
    expect(a.source.session).toMatchObject({ issuedAt: core.session.issuedAt, lastActivityAt: core.session.lastActivityAt, idleExpiresAt: core.idleExpiresAt() });
    expect(a.source.store.getState().session).toBeNull();
    expect(questions()).toBe(asked + 1);
    // A command is sent again.
    expect(a.source.link).toBe('ONLINE');
    const calls = fake.calls.length;
    await a.source.actions.touch();
    await flush();
    expect(fake.calls.length).toBeGreaterThan(calls);
    expect(errors(a)).toEqual([]);
  });

  it('the trigger is exact: a socket that was never lost causes no question, and neither does the socket this source opens itself right after the Core named the session', async () => {
    const a = await signedInTab();
    const b = await signedInTab();
    const asked = questions();
    await elapse(5 * MINUTE, 1_000);
    expect(questions()).toBe(asked);
    expect(a.sockets).toHaveLength(1);

    // Tab B signs in again: tab A hears ROTATED on its open socket, asks ONCE (the check of that
    // message), and opens the new session's socket itself. That socket causes no second question.
    await expect(b.source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    await elapse(10_000);
    expect(signedIn(a)).toBe(true);
    expect(a.source.session?.issuedAt).toBe(core.session.issuedAt);
    expect(a.sockets.length).toBeGreaterThan(1);
    expect(questions()).toBe(asked + 1);
    await elapse(MINUTE, 1_000);
    expect(questions()).toBe(asked + 1);
    expect(a.ends).toEqual([]);
  });

  it('while the question has no answer nothing of the new socket is shown and nothing is sent for the operator; it is asked again after 2 s, 4 s, 8 s; a Lock ends the session HERE and never signs out the session of the other operator', async () => {
    const a = await signedInTab();
    const shown = watch(a);
    await offline(a);
    await elapse(30_000, 1_000);
    core.signIn(OTHER_OPERATOR);
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    const before = questions();

    // The socket returns, and the Core does not answer the question.
    core.down.add('getAuthSession');
    core.blocked.delete(a);
    await elapse(25_000);
    expect(a.sockets.at(-1)?.principal).toBe('OPERATOR');
    expect(a.source.link).toBe('ONLINE');
    // What the new socket sent is not on screen: the replica is the earlier one, and so is the operator.
    expect(a.source.store.getState().session?.state).toBe('RECORDING');
    expect(shown.filter((entry) => !entry.recording)).toEqual([]);
    const asked = fake.log.requestsOf('getAuthSession').slice(before);
    expect(asked.slice(0, 4).map((call) => call.at - (asked[0]?.at ?? 0))).toEqual([0, 2_000, 6_000, 14_000]);
    // A command is not sent (CL-22): the request would act for whoever the credential names now.
    const calls = fake.calls.length;
    await expect(a.source.actions.addMarker('Key statement')).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', code: null });
    await a.source.actions.touch();
    await flush();
    expect(fake.calls).toHaveLength(calls);

    // The operator of tab A locks the console. It is locked here, and NO sign-out is sent.
    await expect(a.source.actions.signOut('LOCK')).resolves.toBeUndefined();
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'SIGNED_OUT', source: 'LOCAL', signOut: 'LOCK' }]);
    expectNoCoreData(a.source);
    expect(signOuts()).toBe(0);

    // The Core answers again. The debt names the earlier session, the credential names B's: it was never owed for that one.
    core.down.delete('getAuthSession');
    await elapse(40_000, 1_000);
    expect(signOuts()).toBe(0);
    expect(core.session.open).toBe(true);
    expect(core.session.operator.id).toBe(OTHER_OPERATOR.id);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(shown.filter((entry) => entry.operatorId === WEB_SESSION.operator.id && !entry.recording)).toEqual([]);
  });

  it('the question is answered 401 (the session ended while the socket was being opened): the session ends as after any 401', async () => {
    const a = await signedInTab();
    await offline(a);
    core.blocked.delete(a);
    const question = fake.hold('getAuthSession');
    await elapse(10_000);
    expect(a.sockets.at(-1)?.principal).toBe('OPERATOR');
    expect(signedIn(a)).toBe(true);
    // While the question is OUT, nothing is sent for the operator: no command, no read, and a touch waits.
    expect(a.source.link).toBe('ONLINE');
    const calls = fake.calls.length;
    await expect(a.source.actions.addMarker('Key statement')).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', code: null });
    await expect(a.source.actions.verifyAuditChain()).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', code: null });
    await a.source.actions.touch();
    await flush();
    expect(fake.calls).toHaveLength(calls);
    core.session.open = false;
    question.release(fake.example('getAuthSession', 401));
    await elapse(2_000);
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: null, source: 'REST', wasSignedIn: true }]);
    expect(signedIn(a)).toBe(false);
    expectNoCoreData(a.source);
    const asked = questions();
    await elapse(MINUTE, 1_000);
    expect(questions()).toBe(asked);
  });

  it('`stop()` while the question is out, and `start()` again: the new run asks for itself, and the tab does not stay unconfirmed', async () => {
    const a = await signedInTab();
    await offline(a);
    core.blocked.delete(a);
    const question = fake.hold('getAuthSession');
    await elapse(10_000);
    a.source.stop();
    a.source.start();
    question.fail();
    await elapse(10_000);
    expect(signedIn(a)).toBe(true);
    expect(a.ends).toEqual([]);
    const calls = fake.calls.length;
    await a.source.actions.touch();
    await flush();
    expect(fake.calls.length).toBeGreaterThan(calls);
  });

  it('the socket is lost AGAIN while the question is out: the answer "the same session" confirms nothing for the newer socket, which is asked about itself', async () => {
    const a = await signedInTab();
    const shown = watch(a);
    await offline(a);
    core.blocked.delete(a);
    const question = fake.hold('getAuthSession');
    await elapse(10_000);
    expect(a.sockets.at(-1)?.principal).toBe('OPERATOR');
    const asked = questions();

    // The link is lost again; operator B signs in elsewhere; the link returns with B's socket.
    await offline(a);
    core.signIn(OTHER_OPERATOR);
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    core.blocked.delete(a);
    await elapse(10_000);
    expect(a.sockets.at(-1)?.principal).toBe('OPERATOR');
    // The earlier question is answered at last, with what was true when it was asked.
    question.release({ status: 200, body: { ...core.info(), operator: WEB_SESSION.operator, issuedAt: core.start } });
    await elapse(10_000);
    expect(shown.filter((entry) => entry.operatorId === WEB_SESSION.operator.id && !entry.recording)).toEqual([]);
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST' }]);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(questions()).toBeGreaterThan(asked);
  });

  it('a start with a session in memory (`stop()`, another operator signs in elsewhere, `start()`): the earlier session ends (ROTATED) and the new one is taken; with the same session the start goes on without an end', async () => {
    const a = await signedInTab();
    a.source.stop();
    a.source.start();
    await elapse(5_000);
    expect(signedIn(a)).toBe(true);
    expect(a.ends).toEqual([]);

    const shown = watch(a);
    a.source.stop();
    await elapse(30_000, 1_000);
    core.signIn(OTHER_OPERATOR);
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    a.source.start();
    await elapse(10_000);
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST', wasSignedIn: true }]);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(shown.filter((entry) => entry.operatorId === WEB_SESSION.operator.id && !entry.recording)).toEqual([]);
    expect(shown.filter((entry) => entry.operatorId === OTHER_OPERATOR.id && entry.recording)).toEqual([]);
    expect(signOuts()).toBe(0);
  });

  it('activity while the session waits to be confirmed is remembered, and sent when it is confirmed', async () => {
    const a = await signedInTab();
    await offline(a);
    core.blocked.delete(a);
    const question = fake.hold('getAuthSession');
    await elapse(10_000);
    expect(a.source.link).toBe('ONLINE');
    const touches = requests('touchSession');
    await a.source.actions.touch();
    await flush();
    expect(requests('touchSession')).toBe(touches);
    question.release({ status: 200, body: core.info() });
    await flush();
    expect(requests('touchSession')).toBe(touches + 1);
    expect(a.ends).toEqual([]);
  });

  it('the back-off of the question belongs to one socket: after a confirmation, and at a new socket, it starts again at 2 s', async () => {
    const a = await signedInTab();
    for (const round of [1, 2]) {
      await offline(a);
      core.down.add('getAuthSession');
      const before = questions();
      core.blocked.delete(a);
      await elapse(25_000);
      const asked = fake.log.requestsOf('getAuthSession').slice(before);
      expect(asked.slice(0, 3).map((call) => call.at - (asked[0]?.at ?? 0)), String(round)).toEqual([0, 2_000, 6_000]);
      core.down.delete('getAuthSession');
      await elapse(40_000, 1_000);
      expect(signedIn(a)).toBe(true);
      expect(a.ends).toEqual([]);
    }
  });

  it('inside the Core\'s `retry-after` the question is not asked again, whatever suggests it (the socket is lost and returns once more)', async () => {
    const a = await signedInTab();
    await offline(a);
    fake.answerOnce('getAuthSession', rateLimited(40));
    const before = questions();
    core.blocked.delete(a);
    await elapse(10_000);
    const first = fake.log.requestsOf('getAuthSession')[before]?.at ?? 0;
    expect(questions()).toBe(before + 1);
    // The socket is lost and returns inside the 40 s: its `hello` asks nothing.
    await offline(a);
    core.blocked.delete(a);
    await elapse(15_000);
    expect(a.sockets.at(-1)?.principal).toBe('OPERATOR');
    expect(questions()).toBe(before + 1);
    // Unconfirmed meanwhile: nothing is sent for the operator.
    await expect(a.source.actions.addMarker('Key statement')).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', code: null });
    await until(first + 45_000);
    const asked = fake.log.requestsOf('getAuthSession').slice(before);
    expect(asked).toHaveLength(2);
    expect((asked[1]?.at ?? 0) - first).toBeGreaterThanOrEqual(40_000);
    expect(signedIn(a)).toBe(true);
    expect(a.ends).toEqual([]);
  });

  it('a ROTATED that is heard while the question waits to be asked again: its own check takes the session, and the tab is not left waiting', async () => {
    const a = await signedInTab();
    const b = await signedInTab();
    await offline(a);
    core.down.add('getAuthSession');
    const before = questions();
    core.blocked.delete(a);
    // The question goes unanswered four times: the next one is 16 s away.
    for (let turn = 0; turn < 200 && questions() < before + 4; turn += 1) await elapse(250);
    expect(questions()).toBe(before + 4);
    expect(a.sockets.at(-1)?.principal).toBe('OPERATOR');
    core.down.delete('getAuthSession');

    // In tab B the operator signs in again; tab A hears ROTATED and checks who owns the credential now.
    await expect(b.source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    await elapse(4_000);
    expect(a.source.session?.issuedAt).toBe(core.session.issuedAt);
    expect(a.source.link).toBe('ONLINE');
    // Confirmed by that check: a command of tab A goes out, long before the old question would be asked again.
    const calls = fake.calls.length;
    await a.source.actions.touch();
    await flush();
    expect(fake.calls.length).toBeGreaterThan(calls);
    expect(a.ends).toEqual([]);
  });

  it('a Lock while the question is out ends the question with the session: after the next sign-in nothing waits for the old answer', async () => {
    const a = await signedInTab();
    await offline(a);
    core.blocked.delete(a);
    const question = fake.hold('getAuthSession');
    await elapse(10_000);
    await a.source.actions.signOut('LOCK');
    await elapse(10_000);
    expect(signOuts()).toBe(1);
    expect(core.session.open).toBe(false);

    await expect(a.source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    expect(signedIn(a)).toBe(true);
    const calls = fake.calls.length;
    await a.source.actions.touch();
    await flush();
    expect(fake.calls.length).toBeGreaterThan(calls);

    // The new session waits for a confirmation of its own (the link was lost again) when the old
    // answer arrives at last, about a session that is over: it changes nothing, and it does not
    // end the waiting of the new session either.
    await offline(a);
    core.blocked.delete(a);
    const second = fake.hold('getAuthSession');
    await elapse(10_000);
    expect(a.source.link).toBe('ONLINE');
    question.release(fake.example('getAuthSession', 401));
    await flush();
    expect(signedIn(a)).toBe(true);
    const sent = fake.calls.length;
    await expect(a.source.actions.addMarker('Key statement')).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', code: null });
    expect(fake.calls).toHaveLength(sent);
    second.release({ status: 200, body: core.info() });
    await elapse(5_000);
    expect(signedIn(a)).toBe(true);
    expect(a.ends).toHaveLength(1);
  });

  it('a Lock while the question is out, and the credential names another session: that session is taken, and nothing waits for the old answer', async () => {
    const a = await signedInTab();
    await offline(a);
    await elapse(30_000, 1_000);
    core.signIn(OTHER_OPERATOR);
    core.blocked.delete(a);
    const question = fake.hold('getAuthSession');
    await elapse(10_000);
    expect(a.sockets.at(-1)?.principal).toBe('OPERATOR');

    // The operator of tab A locks the console while the question is out. The debt names the
    // earlier session; asked, the Core names B's: the debt was never owed for it, and it is taken.
    await a.source.actions.signOut('LOCK');
    await elapse(10_000);
    expect(signOuts()).toBe(0);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(a.source.link).toBe('ONLINE');
    // No sign-in happened in between: the end of the earlier session itself ended its question.
    fake.answerOnceFromExample('addSessionMarker', 409, 'invalidState');
    await expect(a.source.actions.addMarker('Key statement')).rejects.toMatchObject({ name: 'SimTransitionError' });
    question.release(fake.example('getAuthSession', 401));
    await elapse(2_000);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(a.ends).toHaveLength(1);
  });

  it('a sign-in while the session waits to be confirmed ends the waiting: the new session is confirmed by its own snapshot', async () => {
    for (const waiting of ['the question is out', 'the question waits to be asked again'] as const) {
      boot();
      const a = openTab();
      await a.source.ready;
      await flush();
      await offline(a);
      const question = waiting === 'the question is out' ? fake.hold('getAuthSession') : null;
      if (question === null) core.down.add('getAuthSession');
      const before = questions();
      core.blocked.delete(a);
      // Unanswered four times in the second case: the next question is 16 s away.
      for (let turn = 0; turn < 200 && (a.sockets.at(-1)?.principal !== 'OPERATOR' || (question === null && questions() < before + 4)); turn += 1) await elapse(250);
      await elapse(500);
      expect(a.source.link, waiting).toBe('ONLINE');
      core.down.delete('getAuthSession');

      await expect(a.source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
      expect(signedIn(a)).toBe(true);
      expect(a.source.session?.issuedAt).toBe(core.session.issuedAt);
      // A command goes out again (the Core refuses this one by its own rule): nothing is waited for.
      fake.answerOnceFromExample('addSessionMarker', 409, 'invalidState');
      await expect(a.source.actions.addMarker('Key statement'), waiting).rejects.toMatchObject({ name: 'SimTransitionError' });
      question?.release({ status: 200, body: { ...core.info(), issuedAt: core.start } });
      await elapse(2_000);
      expect(signedIn(a)).toBe(true);
      expect(a.ends).toEqual([]);
      a.source.stop();
      fake.assertNoViolations();
      tabs = [];
    }
  });

  it('an answer that only brings the present values of the session (the expiry check) confirms nothing for a socket that is being opened: its `hello` is asked about all the same', async () => {
    const a = await signedInTab();
    const shown = watch(a);
    await offline(a);
    // Another tab of the session is used, so the Core holds the session past the instant this tab reckons with.
    await elapse(10 * MINUTE, 1_000);
    core.activity();
    // At its instant the offline tab asks the Core, and the answer is slow.
    const question = fake.hold('getAuthSession');
    await until(core.start + AUTH_IDLE_TIMEOUT_MS + 1_000);
    const stale = core.info();
    // Operator B signs in elsewhere, and tab A's socket is being opened again: the upgrade is out.
    core.signIn(OTHER_OPERATOR);
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    core.parked.add(a);
    core.blocked.delete(a);
    for (let turn = 0; turn < 400 && a.sockets.at(-1)?.state !== 'CONNECTING'; turn += 1) await elapse(250);
    const connection = a.sockets.at(-1);
    expect(connection?.state).toBe('CONNECTING');
    // The slow answer arrives now: "the same session", which was true when it was asked.
    question.release({ status: 200, body: stale });
    await flush();
    // The Core answers the upgrade: the socket is B's.
    core.parked.delete(a);
    if (connection) beats.push(connection.startOperator(wire(served)).beatEvery());
    await elapse(10_000);
    expect(shown.filter((entry) => entry.operatorId === WEB_SESSION.operator.id && !entry.recording)).toEqual([]);
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST' }]);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
  });

  it.each(['the expiry check', 'the permission refresh'] as const)('an answer of %s that was asked earlier and arrives while the session waits to be confirmed releases nothing', async (which) => {
    const a = await signedInTab();
    const shown = watch(a);
    let question: ReturnType<FakeTransport['hold']>;
    if (which === 'the expiry check') {
      await offline(a);
      await elapse(10 * MINUTE, 1_000);
      core.activity();
      question = fake.hold('getAuthSession');
      await until(core.start + AUTH_IDLE_TIMEOUT_MS + 1_000);
    } else {
      fake.answerOnce('issuePairingCode', () => fake.example('issuePairingCode', 403, 'notPermitted'));
      expect(await a.pages.call('issuePairingCode')).toMatchObject({ ok: false, status: 403 });
      question = fake.hold('getAuthSession');
      await elapse(1_000);
      await offline(a);
    }
    const stale = core.info();
    core.signIn(OTHER_OPERATOR);
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    // The socket returns as B's, and the Core does not answer the confirmation.
    core.down.add('getAuthSession');
    core.blocked.delete(a);
    for (let turn = 0; turn < 400 && a.sockets.at(-1)?.principal !== 'OPERATOR'; turn += 1) await elapse(250);
    await elapse(1_000);
    expect(a.source.link).toBe('ONLINE');
    // The earlier answer arrives: "the same session", which was true when it was asked.
    question.release({ status: 200, body: stale });
    await flush();
    expect(shown.filter((entry) => !entry.recording)).toEqual([]);
    expect(a.source.store.getState().session?.state).toBe('RECORDING');

    core.down.delete('getAuthSession');
    await elapse(40_000, 1_000);
    expect(a.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST' }]);
    expect(a.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(shown.filter((entry) => entry.operatorId === WEB_SESSION.operator.id && !entry.recording)).toEqual([]);
  });

  it('an answer that names ANOTHER session is never taken over in silence: the expiry check ends the known session (ROTATED) and the new one starts fresh', async () => {
    const tab = await signedInTab();
    const shown = watch(tab);
    await elapse(MINUTE, 1_000);
    // The Core replaced the session, and this socket was not told (its `session.ended` is late, or lost).
    core.replaceUnheard(OTHER_OPERATOR);
    served = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
    // At the instant this client reckons with, it asks; the Core names the other session.
    await until(core.start + AUTH_IDLE_TIMEOUT_MS + 10_000);
    expect(tab.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST', wasSignedIn: true }]);
    expect(tab.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(shown.filter((entry) => entry.operatorId === OTHER_OPERATOR.id && entry.recording)).toEqual([]);
    expect(signOuts()).toBe(0);
  });

  it('the same for the permission refresh after a page\'s 403', async () => {
    const tab = await signedInTab();
    await elapse(MINUTE, 1_000);
    core.replaceUnheard(OTHER_OPERATOR);
    fake.answer('issuePairingCode', () => fake.example('issuePairingCode', 403, 'notPermitted'));
    expect(await tab.pages.call('issuePairingCode')).toMatchObject({ ok: false, status: 403 });
    await elapse(10_000);
    expect(tab.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'ROTATED', source: 'REST', wasSignedIn: true }]);
    expect(tab.source.session?.operator.id).toBe(OTHER_OPERATOR.id);
    expect(signOuts()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// D84 and D90 (CPC1-32): `live.client`
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('F66-14 / D84: an answered POST of the operator through `live.client` is activity, as an action\'s is', () => {
  /** The clock stands at minute 14 of a session whose idle instant is minute 15; the link is ONLINE. */
  async function atMinute14(): Promise<Tab> {
    const tab = await signedInTab();
    await until(core.start + 14 * MINUTE);
    expect(tab.source.link).toBe('ONLINE');
    return tab;
  }

  /** The Core cannot be reached from now on; the session must end here at `at`, and not a second before. */
  async function expectLocalExpiryAt(tab: Tab, at: number): Promise<void> {
    core.unreachable();
    await until(at - 1_000);
    expect(signedIn(tab), 'one second before the instant').toBe(true);
    expect(tab.ends).toEqual([]);
    await elapse(1_000);
    expect(tab.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'IDLE_EXPIRED', source: 'LOCAL', at }]);
  }

  it('a POST at minute 14 moves the idle instant from minute 15 to minute 29', async () => {
    const tab = await atMinute14();
    const calls = fake.calls.length;
    expect(await tab.pages.call('issuePairingCode')).toMatchObject({ ok: true, status: 201 });
    // The view sent the page's request and nothing else.
    expect(fake.calls).toHaveLength(calls + 1);
    await expectLocalExpiryAt(tab, core.start + 14 * MINUTE + AUTH_IDLE_TIMEOUT_MS);
  });

  it('a POST the Core refuses (403) counts too: the operator was at the console, and the instant must not come early', async () => {
    const tab = await atMinute14();
    fake.answer('issuePairingCode', () => fake.example('issuePairingCode', 403, 'notPermitted'));
    expect(await tab.pages.call('issuePairingCode')).toMatchObject({ ok: false, status: 403 });
    await expectLocalExpiryAt(tab, core.start + 14 * MINUTE + AUTH_IDLE_TIMEOUT_MS);
  });

  it('an ACTION the Core refuses with a state conflict (409) counts by the same rule', async () => {
    const tab = await atMinute14();
    fake.answerOnceFromExample('addSessionMarker', 409, 'invalidState');
    await expect(tab.source.actions.addMarker('Key statement')).rejects.toMatchObject({ name: 'SimTransitionError' });
    await expectLocalExpiryAt(tab, core.start + 14 * MINUTE + AUTH_IDLE_TIMEOUT_MS);
  });

  it('a GET does not count: the instant stays minute 15', async () => {
    const tab = await atMinute14();
    expect(await tab.pages.call('listUsers')).toMatchObject({ ok: true, status: 200 });
    await expectLocalExpiryAt(tab, core.start + AUTH_IDLE_TIMEOUT_MS);
  });

  it('the same POST while the Core cannot be reached counts nothing: there is no answer', async () => {
    const tab = await atMinute14();
    core.unreachable();
    expect(await tab.pages.call('issuePairingCode')).toMatchObject({ ok: false, status: null, transport: 'CORE_OFFLINE' });
    await until(core.start + AUTH_IDLE_TIMEOUT_MS - 1_000);
    expect(signedIn(tab)).toBe(true);
    await elapse(1_000);
    expect(tab.ends).toMatchObject([{ reason: 'IDLE_EXPIRED', source: 'LOCAL', at: core.start + AUTH_IDLE_TIMEOUT_MS }]);
  });

  it('the touch period: a 2xx POST through `live.client` restarts it (the Core counted it), a refused one does not (a touch is still owed)', async () => {
    for (const [status, touches] of [
      [201, 1],
      [403, 2],
    ] as const) {
      const tab = await signedInTab();
      if (status === 403) fake.answer('issuePairingCode', () => fake.example('issuePairingCode', 403, 'notPermitted'));
      await tab.source.actions.touch();
      await elapse(10_000);
      // Activity inside the period: remembered, to be reported when the period ends.
      await tab.source.actions.touch();
      await elapse(10_000);
      await tab.pages.call('issuePairingCode');
      await elapse(45_000);
      expect(requests('touchSession'), `after a ${status}`).toBe(touches);
      tab.source.stop();
      fake.assertNoViolations();
      tabs = [];
    }
  });

  it('the view is transparent: the very promise of the typed client, its arguments, its other members; no request of its own', async () => {
    const answer = Promise.resolve({ ok: true, operationId: 'issuePairingCode', status: 201, data: {}, epoch: null, revision: null, requestId: null });
    const seen: unknown[][] = [];
    const stub = {
      baseUrl: BASE_URL,
      call(...input: unknown[]): Promise<unknown> {
        seen.push([this === stub, ...input]);
        return answer;
      },
    };
    const socket = {
      subscribe: () => () => undefined,
      getSnapshot: () => ({ state: 'CONNECTING', seq: null, serverTime: null, lastBeatAt: null, clients: null, reconnectAttempt: 0 }),
      start: () => undefined,
      stop: () => undefined,
      getStatus: () => ({ connection: 0 }),
      getLatestMeters: () => null,
      reconnect: () => false,
      setMetersWanted: () => undefined,
      requestResync: () => false,
    };
    fake = createFakeTransport();
    const source = createLiveSim({ client: stub as unknown as LiveClient, socket: { url: SOCKET_URL, create: () => socket as never }, autoStart: false });
    const view = source.client as unknown as typeof stub;
    const input = { params: { id: 'x' } };
    expect(view.call('issuePairingCode', input)).toBe(answer);
    expect(seen).toEqual([[true, 'issuePairingCode', input]]);
    // A view of the client that was passed in: every other member is that client's own.
    expect(view).not.toBe(stub);
    expect(Object.getPrototypeOf(view)).toBe(stub);
    expect(view.baseUrl).toBe(stub.baseUrl);
    expect(source.client).toBe(source.client);
    expect(source.errors()).toEqual([]);
    await flush();
  });

  it('a promise the typed client rejects still rejects for the caller, and is reported as live.client', async () => {
    boot();
    const real = createCoreClient({ baseUrl: BASE_URL, credentials: 'browser-cookie', fetch: fake.fetch });
    const client = {
      call: (operationId: string, input: unknown): Promise<unknown> =>
        operationId === 'issuePairingCode'
          ? Promise.reject(new TypeError('a usage error of the typed client'))
          : (real.call as (id: string, input: unknown) => Promise<unknown>)(operationId, input),
    };
    const tab = openTab({ client: client as unknown as LiveClient });
    await tab.source.ready;
    await flush();
    await expect((tab.source.client as unknown as PageClient).call('issuePairingCode')).rejects.toThrow('a usage error of the typed client');
    await flush();
    expect(tab.reports).toMatchObject([{ level: 'error', source: 'live.client', message: 'a usage error of the typed client', context: { operationId: 'issuePairingCode' } }]);
    expect(signedIn(tab)).toBe(true);
  });
});

describe('CPC1-32 / D90: a page\'s call through `live.client` gets the full CL-23, and not CL-22', () => {
  it('a page\'s 401 ends the session exactly as an action\'s 401 does', async () => {
    const page = await signedInTab();
    core.session.open = false;
    expect(await page.pages.call('issuePairingCode')).toMatchObject({ ok: false, status: 401 });
    await flush();

    tabs.forEach((tab) => tab.source.stop());
    tabs = [];
    const action = await signedInTab();
    core.session.open = false;
    fake.answerOnceFromExample('addSessionMarker', 401, 'notSignedIn');
    await expect(action.source.actions.addMarker('Key statement')).rejects.toMatchObject({ name: 'SimPermissionError', code: 'NOT_SIGNED_IN' });
    await flush();

    const shape = (end: LiveSessionEnd | undefined): unknown => ({ ...end, at: 0 });
    expect(page.ends).toHaveLength(1);
    expect(page.ends[0]).toMatchObject({ kind: 'SESSION_ENDED', reason: null, source: 'REST', signOut: null, wasSignedIn: true, sessionState: 'RECORDING' });
    expect(shape(page.ends[0])).toEqual(shape(action.ends[0]));
    expectNoCoreData(page.source);
    expect(page.source.store.getState().auth.status).toBe('SIGNED_OUT');
  });

  it('a page\'s 403 NOT_PERMITTED causes exactly one debounced permission refresh; ten of them cause one', async () => {
    const tab = await signedInTab();
    fake.answer('issuePairingCode', () => fake.example('issuePairingCode', 403, 'notPermitted'));
    const asked = questions();
    expect(await tab.pages.call('issuePairingCode')).toMatchObject({ ok: false, status: 403 });
    await flush();
    // Debounced: nothing yet.
    expect(questions()).toBe(asked);
    await elapse(999, 333);
    expect(questions()).toBe(asked);
    await elapse(1);
    expect(questions()).toBe(asked + 1);

    for (let index = 0; index < 10; index += 1) await tab.pages.call('issuePairingCode');
    await elapse(5_000);
    expect(questions()).toBe(asked + 2);
    expect(signedIn(tab)).toBe(true);
  });

  it('a page call while the link is down is NOT refused by the view: the request goes out, and the page gets the typed client\'s own transport error', async () => {
    const tab = await signedInTab();
    core.unreachable();
    expect(tab.source.link).not.toBe('ONLINE');
    const calls = fake.calls.length;
    const answer = await tab.pages.call('issuePairingCode');
    expect(answer).toMatchObject({ ok: false, status: null, transport: 'CORE_OFFLINE', error: { code: 'NETWORK' } });
    expect(fake.calls).toHaveLength(calls + 1);
    // An action in the same state is refused here, without a request (CL-22).
    await expect(tab.source.actions.addMarker('Key statement')).rejects.toMatchObject({ name: 'LiveTransportError', reason: 'CORE_OFFLINE', code: null });
    expect(fake.calls).toHaveLength(calls + 1);
    expect(signedIn(tab)).toBe(true);
  });
});

describe('CPC1-25 / D90: an answer is held to the session that sent the request', () => {
  it('an action\'s 401 that arrives after that session ended and another one signed in ends nothing and counts nothing', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    const held = fake.hold('addSessionMarker');
    const calls = fake.calls.length;
    const outcome: string[] = [];
    void source.actions.addMarker('Key statement').then(
      () => outcome.push('resolved'),
      (error: unknown) => outcome.push((error as Error).name),
    );
    await fake.arrived(calls + 1);

    // The session ends at the Core, and the operator signs in again: a new session.
    core.end('USER_DISABLED');
    await flush();
    expect(ends).toHaveLength(1);
    await expect(source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    expect(signedIn(tab)).toBe(true);
    const idle = source.session?.idleExpiresAt;
    await elapse(60_000, 1_000);

    // Now the answer to the first session's command arrives: 401.
    held.release(fake.example('addSessionMarker', 401, 'notSignedIn'));
    await flush();
    // The action itself settles with its own answer; the new session is untouched.
    expect(outcome).toEqual(['SimPermissionError']);
    expect(ends).toHaveLength(1);
    expect(signedIn(tab)).toBe(true);
    expect(core.session.open).toBe(true);
    expect(source.session?.idleExpiresAt).toBe(idle);
    await elapse(60_000, 1_000);
    expect(signedIn(tab)).toBe(true);
  });

  it('the answer to a sign-out that arrives after that session ended and another one signed in does not end the new session', async () => {
    const tab = await signedInTab();
    const { source, ends } = tab;
    const held = fake.hold('signOut');
    const calls = fake.calls.length;
    const outcome: string[] = [];
    void source.actions.signOut('USER').then(
      () => outcome.push('resolved'),
      (error: unknown) => outcome.push((error as Error).name),
    );
    await fake.arrived(calls + 1);
    // The Core ends the session by itself before it answers; the operator signs in again.
    core.end('USER_DISABLED');
    await flush();
    expect(ends).toHaveLength(1);
    await expect(source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    expect(signedIn(tab)).toBe(true);

    held.release(fake.example('signOut', 401, 'notSignedIn'));
    await flush();
    expect(outcome).toEqual(['resolved']);
    expect(ends).toHaveLength(1);
    expect(signedIn(tab)).toBe(true);
    expect(core.session.open).toBe(true);
    await elapse(30_000, 1_000);
    expect(signOuts()).toBe(1);
    expect(signedIn(tab)).toBe(true);
  });

  it('an answer through `live.client` that arrives for an earlier session counts nothing for the next one', async () => {
    const tab = await signedInTab();
    const { source } = tab;
    const held = fake.hold('issuePairingCode');
    const calls = fake.calls.length;
    const answer = tab.pages.call('issuePairingCode');
    await fake.arrived(calls + 1);
    core.end('USER_DISABLED');
    await flush();
    await expect(source.actions.signIn('andi.pratama', PASSWORD)).resolves.toMatchObject({ ok: true });
    const idle = source.session?.idleExpiresAt;
    await elapse(5 * MINUTE, 1_000);
    held.release(fake.example('issuePairingCode', 401, 'notSignedIn'));
    expect(await answer).toMatchObject({ ok: false, status: 401 });
    await flush();
    expect(tab.ends).toHaveLength(1);
    expect(signedIn(tab)).toBe(true);
    expect(source.session?.idleExpiresAt).toBe(idle);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// F66-18
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('F66-18 (decision D84): a socket that is not the session\'s tells nothing, so the client looks itself', () => {
  it('the link returns ANONYMOUS without a reason while signed in: one new socket, one report, no loop; an unattended console ends at its idle instant, not later', async () => {
    const tab = await signedInTab();
    const { source, ends, reports } = tab;
    // The link is lost; the Core takes the next sockets for nobody and says no reason.
    core.anonymousSockets = true;
    tab.sockets.at(-1)?.close(1001);
    await elapse(5_000);
    expect(source.link).toBe('ONLINE');
    expect(tab.sockets.at(-1)?.principal).toBe('ANONYMOUS');
    // Not an end (the specification names SESSION_INVALID only): one new socket was asked for (CPC1-9), once.
    expect(ends).toEqual([]);
    expect(tab.sockets).toHaveLength(3);
    expect(reports.filter((report) => report.source === 'live.socket' && report.level === 'error')).toHaveLength(1);
    expect(signedIn(tab)).toBe(true);

    // Nobody is at the console, and this socket will never say `session.ended`.
    const calls = fake.calls.length;
    await until(core.idleExpiresAt() - 1_000);
    expect(tab.sockets).toHaveLength(3);
    expect(fake.calls).toHaveLength(calls);
    expect(signedIn(tab)).toBe(true);
    await elapse(1_000);
    // The bound: the idle instant. The link is ONLINE all the while; the Core, asked, says the session is over.
    expect(source.link).toBe('ONLINE');
    expect(ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: 'IDLE_EXPIRED', source: 'REST' }]);
    expect(source.store.getState().auth.status).toBe('EXPIRED');
    expectNoCoreData(source);
  });

  it('the same, and the Core cannot be asked either: the session ends HERE at the instant although the link reads ONLINE', async () => {
    const tab = await signedInTab();
    core.anonymousSockets = true;
    tab.sockets.at(-1)?.close(1001);
    await elapse(5_000);
    core.down.add('getAuthSession');
    await until(core.idleExpiresAt());
    expect(tab.source.link).toBe('ONLINE');
    expect(tab.ends).toMatchObject([{ reason: 'IDLE_EXPIRED', source: 'LOCAL' }]);
    expectNoCoreData(tab.source);
  });

  it('with an operator at the console the bound is the next answer: the touch is refused 401 and the session ends at once', async () => {
    const tab = await signedInTab();
    core.anonymousSockets = true;
    tab.sockets.at(-1)?.close(1001);
    await elapse(5_000);
    expect(signedIn(tab)).toBe(true);
    // The Core no longer knows the session.
    core.session.open = false;
    await tab.source.actions.touch();
    await flush();
    expect(tab.ends).toMatchObject([{ kind: 'SESSION_ENDED', reason: null, source: 'REST', wasSignedIn: true }]);
    expectNoCoreData(tab.source);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// D80 on a device
// ═══════════════════════════════════════════════════════════════════════════════════════

describe('CPC1-21 / D80 on a device: the app drops the session token at the local end, and nothing is kept for the debt', () => {
  it('Lock while OFFLINE: sessionCleared is called then; when the link returns the socket is the device\'s; nothing is asked and no sign-out is sent', async () => {
    fake = createFakeTransport({ epoch: 3, revision: 40 });
    const state = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
    const vault: { device: string | null; session: string | null } = { device: FAKE_CREDENTIALS.deviceCredential, session: null };
    const calls: string[] = [];
    const bearer = (): string | null => vault.session ?? vault.device;
    let reachable = true;
    fake.onConnect((connection) => {
      const header = connection.headers.authorization ?? '';
      if (connection.state !== 'CONNECTING') return;
      if (!reachable) connection.refuse();
      else if (header.startsWith('Bearer ses_')) connection.startOperator(wire(state)).beatEvery();
      else connection.startDevice().beatEvery();
    });
    fake.answer('getAuthSession', () => (vault.session ? fake.example('getAuthSession', 200, 'pairedDevice') : fake.example('getAuthSession', 401)));
    fake.answerFromExample('getSignInStatus', 200, 'open');
    const secrets: LiveSecretsPort = {
      sessionIssued: ({ sessionToken }) => {
        vault.session = sessionToken;
      },
      sessionCleared: (end) => {
        calls.push(`sessionCleared ${end.source} ${String(end.signOut)} link=${source.link}`);
        vault.session = null;
      },
    };
    const ends: LiveSessionEnd[] = [];
    const source: LiveSim = createLiveSim({
      client: createCoreClient({ baseUrl: BASE_URL, credentials: bearer, fetch: fake.fetch }),
      socket: { url: SOCKET_URL, factory: fake.socketFactory, headers: () => (bearer() ? { Authorization: `Bearer ${bearer()}` } : null) },
      secrets,
      now: fake.clock.now,
      timers: fake.clock.timers,
      random: () => 0,
    });
    tabs.push({ source, reports: [], ends, sockets: [], pages: source.client as unknown as PageClient });
    source.onSessionEnd((end) => ends.push(end));
    await source.ready;
    fake.answerOnceFromExample('signIn', 200, 'pairedDevice');
    await source.actions.signIn('budi.santoso', PASSWORD);
    expect(selectIsSignedIn(source.store.getState())).toBe(true);

    reachable = false;
    fake.connection().close(1001);
    await expect(source.actions.signOut('LOCK')).resolves.toBeUndefined();
    await flush();
    // At the local end, with the link still down: not at a later send.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^sessionCleared LOCAL LOCK link=(OFFLINE|CONNECTING)$/);
    expect(vault).toEqual({ device: FAKE_CREDENTIALS.deviceCredential, session: null });
    expectNoCoreData(source);

    reachable = true;
    const asked = questions();
    await elapse(10_000);
    expect(source.link).toBe('ONLINE');
    expect(fake.connection().principal).toBe('DEVICE');
    await elapse(60_000, 1_000);
    expect(signOuts()).toBe(0);
    expect(questions()).toBe(asked);
    expect(ends).toHaveLength(1);
    // The source holds no token it could have sent: nothing of the kind is readable on it.
    const surface = JSON.stringify({ errors: source.errors(), state: source.store.getState(), end: source.lastSessionEnd, socket: source.socketStatus() });
    expect(/\b(?:ses|dvc|bio)_[A-Za-z0-9_-]{20,}/.test(surface)).toBe(false);
  });
});
