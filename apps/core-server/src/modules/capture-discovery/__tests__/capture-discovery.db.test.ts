// Operations 93 and 94 against PostgreSQL, the REAL engine and every stage of the server (blueprint
// row 132; specs R-9 AC-1 to AC-4, AC-9, AC-11 to AC-13, R-10 AC-1; contract C3 §2.6, §5.2, §5.4;
// checks M4-DISC-TRIG-1, M4-DISC-STUB-1, M4-DISC-LIFE-1, M4-DISC-RBAC-1, M4-DISC-REC-1 (c),
// M4-SEC-RATE-1, M4-AUD-1, M4-LOCK-1 "not locked", M4-SEC-DISC-3 in its booted-Core form).
//
// The real app factory on a clone of the seed, as `dems_app`, booted as the entry point boots it
// (`app.ts` registers the module since decision D114); the engine runs on a manual clock and a
// manual timer; the three seeded operators are signed in on the web console. What is stored is
// read as `dems_owner`.
//
// THE ADAPTER. The module's own adapter is not used: it would probe the network of this host. Its
// place is taken through `captureDiscoveryControl(app).provideAdapter`, once, by a factory this
// file switches between
//   - a SCRIPTED adapter, whose window the test closes by hand (so "RUNNING" can be looked at and
//     the clock that decides the bounds is the manual one), and
//   - the REAL adapter of row 131 on the loopback fixture: the fake ONVIF stub of row 60 on
//     127.0.0.1, behind the loopback guard, which refuses any other destination.
//
// THE THREE SECONDS OF A SEARCH ON THE REAL ADAPTER (test-suite consolidation, D233; audit SV-D2).
// The adapter takes its timers from its caller. ONE case gives it the system timers and waits the
// whole window on the wall clock ("run 1" of M4-DISC-STUB-1). Every other search of this file
// gives it a manual timer set (`windowClock`): the datagrams still travel through the real sockets
// of the loopback, and the file moves the repeat (250 ms) and the end of the window (3,000 ms)
// itself, once the stub has received the probes (`stubWindow`). Nothing of the adapter is replaced.
import { randomUUID } from 'node:crypto';
import { get as httpGet } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CAPTURE_DISCOVERY_RESULT_TTL_MS,
  CaptureDiscoveryStateSchema,
  validateCoreApiResponse,
  type CaptureDiscoverySearch,
  type CaptureDiscoveryStateBody,
  CAPTURE_SEARCH_ID_PATTERN,
} from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { useFurtherDatabase, useTestDatabase } from '../../../../test/helpers/db';
import { capturePlan, fakeLauncher, manualCaptureTimers } from '../../../../test/support/capture';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifDiscoveryMode, type FakeOnvifStub } from '../../../../test/support/fake-onvif-stub';
import { SIGN_OUT, TOUCH, WEB_ORIGIN, signInOnWeb, type IdentityApp } from '../../../../test/support/identity';
import { createCaptureSupervisor, createSystemTimers } from '../../../capture';
import { CaptureAdapterKind, DiscoveryNotRunError, createOnvifDiscoveryAdapter, type OnvifCandidate, type OnvifDiscoveryAdapter, type RegisteredLookup, type WsDiscoveryResult } from '../../../capture/adapters';
import { WS_DISCOVERY_REPEAT_MS } from '../../../capture/adapters/camera/ws-discovery';
import { delay, installLoopbackGuard, startFakeOnvif, until, type LoopbackGuard } from '../../../capture/adapters/camera/__tests__/support';
import { noticesApp, type NoticesApp } from '../../capture-inputs/__tests__/support';
import { errorOf, outcome } from '../../devices/__tests__/support';
import { CURRENT, SESSION, on, sessionInput } from '../../sessions/__tests__/support';
import { captureDiscoveryControl, readLastSearchNumber } from '../index';
import { FIXED_NOW, engineApp, type EngineApp } from '../../../../test/support/engine';

const db = useTestDatabase({ template: 'seed' });
/** This file's database under a second name: a describe that keeps a further clone of its own calls that one `db`. */
const home = db;
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const DISCOVERY = '/api/v1/capture/discovery';
const NONE: CaptureDiscoveryStateBody = { search: null, candidates: [], truncated: false };

// ── The two adapters ───────────────────────────────────────────────────────────────────────────

interface PendingSearch {
  readonly lookup: RegisteredLookup;
  close(outcome: WsDiscoveryResult | Error): void;
}
const pending: PendingSearch[] = [];
/** Calls of `discover` on the scripted adapter since the file began: "0 datagrams" is "this number did not move". */
let scriptedCalls = 0;
let stub: FakeOnvifStub | null = null;
/** The timers of the real adapter in every search but the one that waits on the wall clock. */
const windowClock = manualCaptureTimers();
/** True for the ONE case that runs the real adapter on the system timers. */
let systemWindow = false;
const WINDOW_MS = 3_000;

const scripted = (lookup: RegisteredLookup): OnvifDiscoveryAdapter =>
  ({
    discover: () =>
      new Promise<WsDiscoveryResult>((resolve, reject) => {
        scriptedCalls += 1;
        pending.push({ lookup, close: (result) => (result instanceof Error ? reject(result) : resolve(result)) });
      }),
  }) as unknown as OnvifDiscoveryAdapter;

const answer = (host: string, more: Partial<OnvifCandidate> = {}): OnvifCandidate => ({
  adapterKind: CaptureAdapterKind.ONVIF_RTSP,
  host,
  serviceAddress: `http://${host}/onvif/device_service`,
  endpointRef: `urn:uuid:${randomUUID()}`,
  vendor: 'CANARY-VENDOR',
  model: 'CANARY-MODEL',
  name: 'CANARY-NAME',
  testable: true,
  conflict: false,
  reason: null,
  registered: false,
  addressChanged: false,
  types: [],
  profileHints: [],
  locationHints: [],
  macHint: null,
  serialHint: null,
  ...more,
});
const found = (candidates: OnvifCandidate[], more: Partial<WsDiscoveryResult> = {}): WsDiscoveryResult => ({
  candidates,
  responderCount: candidates.length,
  interfaceCount: 1,
  truncated: false,
  counts: { datagramsReceived: 0, datagramsAccepted: 0, dropped: {}, repeats: 0, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 4, sendErrors: 0, handlerErrors: 0 },
  ...more,
});

// ── The server ─────────────────────────────────────────────────────────────────────────────────

let server: NoticesApp;
let guard: LoopbackGuard;

beforeAll(async () => {
  guard = installLoopbackGuard();
  server = await noticesApp(db);
  // A process start leaves the tablet link OFFLINE, which blocks the CORE check of every pre-check.
  await server.engine.setTabletLink('CONNECTED');
  captureDiscoveryControl(server.app).provideAdapter((lookup) =>
    stub === null ? scripted(lookup) : createOnvifDiscoveryAdapter({ timers: systemWindow ? createSystemTimers() : windowClock.timers, newMessageId: randomUUID, registered: lookup, loopbackFixture: stub.addresses().discovery }),
  );
});
afterAll(async () => {
  await stub?.stop();
  guard.restore();
});

type Role = 'INVESTIGATOR' | 'SUPERVISOR' | 'TECHNICIAN';
const start = (role: Role | null): Promise<LightMyRequestResponse> => server.post(role, DISCOVERY);
const read = async (role: Role | null): Promise<CaptureDiscoveryStateBody> => (await server.get(role, DISCOVERY)).json<CaptureDiscoveryStateBody>();
const searchRows = (rows: readonly AuditRow[]): AuditRow[] => rows.filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED');
const emptyAlerts = (active?: boolean) =>
  server.engine.slice('alerts').filter((alert) => alert.kind === 'SYSTEM' && alert.params?.['reason'] === 'CAPTURE_DISCOVERY_EMPTY' && (active === undefined || alert.active === active));
/** Lets a search that was started reach its adapter: the registry read, then `discover`. */
const reachAdapter = (calls: number): Promise<void> => until(() => scriptedCalls >= calls, 5_000);
/** Lets the end of a window be written: the row, the alert. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) {
    await delay(10);
    await server.app.pipeline.drain();
    await server.engine.idle();
  }
}
/**
 * Far enough from the search before for no bound to hold: 130 s on the manual clock clears both
 * spacings and the Core's minute, and at that pace a session starts at most 28 searches in any
 * hour (the bound is 30). The three sessions are touched, so that none of them idles out
 * (15 minutes) while another role works.
 */
async function farLater(): Promise<void> {
  server.clock.advance(130_000);
  for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) expect((await server.post(role, TOUCH)).statusCode, `touch ${role}`).toBeLessThan(300);
}

/**
 * The window of a search that the REAL adapter runs on the stub, from the first probe to one
 * millisecond before its end. On the system timers that is the wall clock. On the manual timers
 * the file waits for what really happens (the first round reaches the stub, the timers of the
 * repeat and of the window are armed), moves the 250 ms of the repeat, waits for the second round
 * and for the answers of the stub to cross the loopback, then moves the clock to 2,999 ms.
 * A search the adapter itself ended early (an answer over a cap) has no timer left: nothing to move.
 */
async function openStubWindow(): Promise<void> {
  if (systemWindow) return;
  const current = stub;
  if (current === null) throw new Error('the stub of this search is not started');
  const probes = (): number => current.requestLog().filter((entry) => entry.channel === 'discovery').length;
  const ended = (): boolean => windowClock.armed().length === 0;
  await until(() => probes() >= 2 && windowClock.armed().length !== 1, 5_000);
  if (!ended()) {
    expect(windowClock.armed()).toEqual([WS_DISCOVERY_REPEAT_MS, WINDOW_MS]);
    windowClock.advance(WS_DISCOVERY_REPEAT_MS);
    await until(() => probes() >= 4 || ended(), 5_000);
  }
  // The answers of the stub are datagrams of this process on the loopback: they are read before this timer fires.
  await delay(150);
  if (!ended()) windowClock.advance(WINDOW_MS - WS_DISCOVERY_REPEAT_MS - 1);
}
/** The end of that window: the last millisecond on the manual timers, the whole window on the system timers. */
async function closeStubWindow(): Promise<void> {
  if (systemWindow) await delay(3_400);
  else {
    // CONTROL of the clock: one millisecond before its end the window is still armed, with exactly that millisecond left.
    if (windowClock.armed().length > 0) expect(windowClock.armed()).toEqual([1]);
    windowClock.advance(1);
    expect(windowClock.armed()).toEqual([]);
  }
  await settled();
}

/** One whole search on the scripted adapter: start, the window, its end. */
async function search(role: Role, result: WsDiscoveryResult | Error): Promise<{ response: LightMyRequestResponse; body: CaptureDiscoverySearch }> {
  const before = scriptedCalls;
  const response = await start(role);
  expect(response.statusCode, response.body).toBe(202);
  await reachAdapter(before + 1);
  server.clock.advance(3_000);
  pending.at(-1)?.close(result);
  await settled();
  return { response, body: response.json<CaptureDiscoverySearch>() };
}

/** `capture_devices` and `capture_device_credentials` as the owner sees them: the count and a checksum of every row. */
async function registryDigest(): Promise<unknown> {
  const { rows } = await server.owner.query(
    "SELECT (SELECT count(*)::int FROM capture_devices) AS devices, (SELECT md5(coalesce(string_agg(d::text, '|' ORDER BY d.id), '')) FROM capture_devices d) AS devices_digest, " +
      "(SELECT count(*)::int FROM capture_device_credentials) AS credentials, (SELECT md5(coalesce(string_agg(c.device_id || ':' || encode(c.secret_ciphertext, 'hex'), '|' ORDER BY c.device_id), '')) FROM capture_device_credentials c) AS credentials_digest",
  );
  return rows[0];
}

describe('M4-DISC-TRIG-1: no search at boot, on a timer or on a read; one after operation 93', () => {
  it('a booted Core has started 0 searches; ten minutes of the clock, the engine\'s ticks and the reads 76, 77 and 94 start none', async () => {
    const control = captureDiscoveryControl(server.app);
    expect([control.searchesStarted(), scriptedCalls, control.heldLists()]).toEqual([0, 0, 0]);
    const trail = await server.trailLength();
    await server.drive(2_000);
    // Ten minutes: longer than every bound of a search but the hourly one, shorter than a session's idle limit.
    server.clock.advance(600_000);
    await server.drive(500);
    for (const url of ['/api/v1/capture/config', '/api/v1/capture/devices', DISCOVERY]) expect((await server.get('SUPERVISOR', url)).statusCode, url).toBe(200);
    expect(await read('SUPERVISOR')).toEqual(NONE);
    await settled();
    expect([control.searchesStarted(), scriptedCalls]).toEqual([0, 0]);
    expect(searchRows(await server.since(trail))).toEqual([]);
    expect(guard.datagrams()).toEqual([]);
  });
});

describe('M4-DISC-RBAC-1: CAPTURE_CONFIG is SUPERVISOR and TECHNICIAN', () => {
  it('no session: 401; INVESTIGATOR: 403 NOT_PERMITTED with ONE ACCESS_DENIED row per call and 0 searches, on 93 and on 94', async () => {
    const trail = await server.trailLength();
    expect(outcome(await start(null))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcome(await server.get(null, DISCOVERY))).toEqual([401, 'NOT_SIGNED_IN']);
    const refusedStart = await start('INVESTIGATOR');
    const refusedRead = await server.get('INVESTIGATOR', DISCOVERY);
    expect([outcome(refusedStart), outcome(refusedRead)]).toEqual([[403, 'NOT_PERMITTED'], [403, 'NOT_PERMITTED']]);
    expect(errorOf(refusedStart).details).toEqual({ operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' });
    expect(validateCoreApiResponse('startCaptureDiscovery', 403, refusedStart.json())).toEqual({ ok: true });
    await settled();
    const rows = await server.since(trail);
    expect(rows.map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['ACCESS_DENIED', server.operatorId('INVESTIGATOR'), { operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' }],
      ['ACCESS_DENIED', server.operatorId('INVESTIGATOR'), { operationId: 'getCaptureDiscovery', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' }],
    ]);
    expect([captureDiscoveryControl(server.app).searchesStarted(), scriptedCalls]).toEqual([0, 0]);
  });
});

describe('operation 93 and 94 through the real pipeline (M4-AUD-1, M4-DISC-LIFE-1, R-9 AC-3)', () => {
  it('202 RUNNING at once; the read is empty while the window is open; the own repeat is 200 `created: false` with no second probe; another session gets 409 DISCOVERY_IN_PROGRESS; the window closes with the list, ONE row, and nothing written to the registry', async () => {
    await farLater();
    const trail = await server.trailLength();
    const registry = await registryDigest();
    const startedAt = server.clock.now();
    const response = await start('TECHNICIAN');
    expect(response.statusCode, response.body).toBe(202);
    const running = response.json<CaptureDiscoverySearch>();
    expect(validateCoreApiResponse('startCaptureDiscovery', 202, running)).toEqual({ ok: true });
    expect(running).toMatchObject({ searchId: 'DSC-000001', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', state: 'RUNNING', startedAt, windowMs: 3_000, completesAt: startedAt + 3_000, responderCount: 0, newCount: 0, registeredCount: 0, failureReason: null, created: true });
    // API-7: a 2xx POST carries the position of the state; this one changed no state.
    expect(response.headers['x-dems-revision']).toBeDefined();
    await reachAdapter(1);

    // While the window is open.
    const during = await read('TECHNICIAN');
    expect(during).toMatchObject({ search: { searchId: 'DSC-000001', state: 'RUNNING', created: false }, candidates: [], truncated: false });
    const again = await start('TECHNICIAN');
    expect([again.statusCode, again.json<CaptureDiscoverySearch>()]).toMatchObject([200, { searchId: 'DSC-000001', state: 'RUNNING', created: false }]);
    expect(validateCoreApiResponse('startCaptureDiscovery', 200, again.json())).toEqual({ ok: true });
    const other = await start('SUPERVISOR');
    expect([outcome(other), errorOf(other).details]).toEqual([[409, 'INVALID_STATE'], { reason: 'DISCOVERY_IN_PROGRESS' }]);
    expect(validateCoreApiResponse('startCaptureDiscovery', 409, other.json())).toEqual({ ok: true });
    expect(await read('SUPERVISOR')).toEqual(NONE);
    expect(scriptedCalls).toBe(1);
    expect(searchRows(await server.since(trail))).toEqual([]);

    // The window closes: one new camera, one that the registry holds by its whole address (the seeded CAM-01).
    server.clock.advance(3_000);
    pending.at(-1)?.close(found([answer('192.0.2.20'), answer('127.0.0.1', { adapterKind: CaptureAdapterKind.FAKE, serviceAddress: 'http://127.0.0.1:8554/onvif/device_service' })]));
    await settled();

    const state = await read('TECHNICIAN');
    expect(CaptureDiscoveryStateSchema.safeParse(state).success).toBe(true);
    expect(validateCoreApiResponse('getCaptureDiscovery', 200, state)).toEqual({ ok: true });
    expect(state.search).toMatchObject({ searchId: 'DSC-000001', state: 'COMPLETE', responderCount: 2, newCount: 1, registeredCount: 1, interfaceCount: 1, completesAt: startedAt + 3_000, expiresAt: startedAt + 3_000 + CAPTURE_DISCOVERY_RESULT_TTL_MS });
    expect(state.candidates.map((candidate) => [candidate.host, candidate.adapter, candidate.sourceClass, candidate.status, candidate.deviceId, candidate.testable, candidate.lastTest, candidate.adoptable])).toEqual([
      ['192.0.2.20', 'ONVIF_RTSP', 'PRODUCTION', 'NEW', null, true, null, false],
      ['127.0.0.1', 'FAKE', 'DEVELOPMENT', 'REGISTERED', 'CAM-01', true, null, false],
    ]);
    for (const candidate of state.candidates) expect(candidate.candidateId).toMatch(/^CND-[0-9A-F]{12}$/);

    // ONE audit row, with exactly the keys of C3 §5.2: ids, codes and counts.
    const rows = await server.since(trail);
    expect(rows.map((row) => [row.type, row.category, row.severity, row.actorId, row.deviceId, row.details])).toEqual([
      [
        'CAPTURE_DISCOVERY_SEARCHED',
        'DEVICE',
        'INFO',
        server.operatorId('TECHNICIAN'),
        null,
        { searchId: 'DSC-000001', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2, newCount: 1, registeredCount: 1, interfaceCount: 1, operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG' },
      ],
    ]);
    // No address, no endpoint reference and no device text in the row, in the log or in the events.
    const written = JSON.stringify([rows, server.log.lines(), server.engine.slice('events').slice(-10)]);
    expect(written).not.toMatch(/192\.0\.2\.20|urn:uuid|CANARY|device_service/);
    expect(server.log.lines().some((line) => line['code'] === 'CAPTURE_DISCOVERY_SEARCHED' && line['searchId'] === 'DSC-000001' && line['responderCount'] === 2)).toBe(true);

    // R-9 AC-3 / AC-4: nothing was registered. The two tables are byte-equal, operation 77 lists the five built-ins, and the chain verifies.
    expect(await registryDigest()).toEqual(registry);
    const devices = (await server.get('TECHNICIAN', '/api/v1/capture/devices')).json<{ devices: { id: string }[] }>();
    expect(devices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH']);
    expect(server.engine.slice('captureDevices').devices).toHaveLength(5);
    const trailNow = await readTrail(server.owner);
    expect(linkProblems(trailNow)).toEqual([]);
    expect(verifyTrail(trailNow, await readHead(server.owner)).ok).toBe(true);
    // A search that found something raised no alert.
    expect(emptyAlerts(true)).toEqual([]);
  });

  it('owner only: a SUPERVISOR in another session reads `search: null`; so does the SAME operator in a second session; the owner still reads its list', async () => {
    expect(await read('SUPERVISOR')).toEqual(NONE);
    const second = await signInOnWeb(server.identity, 'rina.wijaya');
    const sameOperator = await server.app.inject({ method: 'GET', url: DISCOVERY, headers: second.cookie });
    expect([sameOperator.statusCode, sameOperator.json()]).toEqual([200, NONE]);
    expect((await read('TECHNICIAN')).candidates).toHaveLength(2);
    // Operations 78 and 79 never accept a candidate ID: it is no capture device.
    const candidateId = (await read('TECHNICIAN')).candidates[0]?.candidateId ?? '';
    const assign = await server.post('TECHNICIAN', `/api/v1/capture/cameras/${candidateId}/source`, { trackId: 'VIDEO-02' });
    expect(assign.statusCode).toBe(404);
    const update = await server.post('TECHNICIAN', '/api/v1/capture/config', { cameras: [{ trackId: 'VIDEO-02', deviceId: candidateId }] });
    expect(update.statusCode).toBe(422);
  });

  it('M4-SEC-RATE-1 through the stages: 429 RATE_LIMITED (DISCOVERY_RATE_LIMITED) with retry-after, 0 probes, no row; at the bound the search starts', async () => {
    const trail = await server.trailLength();
    const calls = scriptedCalls;
    // 3 s after the technician's start: the session's 10 s hold; for another session the Core's 5 s hold.
    const own = await start('TECHNICIAN');
    expect([outcome(own), errorOf(own).details, own.headers['retry-after']]).toEqual([[429, 'RATE_LIMITED'], { reason: 'DISCOVERY_RATE_LIMITED', retryInMs: 7_000 }, '7']);
    expect(validateCoreApiResponse('startCaptureDiscovery', 429, own.json())).toEqual({ ok: true });
    const core = await start('SUPERVISOR');
    expect([outcome(core), errorOf(core).details, core.headers['retry-after']]).toEqual([[429, 'RATE_LIMITED'], { reason: 'DISCOVERY_RATE_LIMITED', retryInMs: 2_000 }, '2']);
    await settled();
    expect(scriptedCalls).toBe(calls);
    expect(await server.since(trail)).toEqual([]);
    // The refused calls replaced nothing: the technician's list is still there.
    expect((await read('TECHNICIAN')).search?.searchId).toBe('DSC-000001');
    // At the Core's bound the other session's search starts (5 s after the last start).
    server.clock.advance(2_000);
    const allowed = await search('SUPERVISOR', found([answer('192.0.2.21')]));
    expect(allowed.body.searchId).toBe('DSC-000002');
    expect(searchRows(await server.since(trail)).map((row) => row.details['searchId'])).toEqual(['DSC-000002']);
  });

  it('situation A (C3 §5.4; D80(8)): an EMPTY search writes its one row and raises ONE alert; a second empty one leaves one; a search with a responder resolves it; a FAILED search does neither', async () => {
    await farLater();
    const trail = await server.trailLength();
    const empty = await search('TECHNICIAN', found([]));
    expect((await read('TECHNICIAN')).search).toMatchObject({ searchId: empty.body.searchId, state: 'COMPLETE', responderCount: 0 });
    expect(emptyAlerts(true).map((alert) => [alert.severity, alert.target, alert.params])).toEqual([['WARNING', 'CAPTURE_DISCOVERY', { reason: 'CAPTURE_DISCOVERY_EMPTY', searchId: empty.body.searchId, trigger: 'MANUAL' }]]);
    // The search's own row and no second audit row for the alert.
    expect((await server.since(trail)).map((row) => [row.type, row.details['responderCount']])).toEqual([['CAPTURE_DISCOVERY_SEARCHED', 0]]);

    server.clock.advance(20_000);
    await search('TECHNICIAN', found([]));
    expect(emptyAlerts(true)).toHaveLength(1);
    expect(emptyAlerts()).toHaveLength(1);

    // "The search could not run" is not "nothing found": FAILED, its reason, a row with outcome FAILED, and the alert is neither raised again nor resolved.
    server.clock.advance(20_000);
    const failed = await search('TECHNICIAN', new DiscoveryNotRunError('NO_ELIGIBLE_INTERFACE'));
    const failedState = await read('TECHNICIAN');
    expect(failedState).toMatchObject({ search: { searchId: failed.body.searchId, state: 'FAILED', failureReason: 'NO_ELIGIBLE_INTERFACE', responderCount: 0 }, candidates: [] });
    expect(validateCoreApiResponse('getCaptureDiscovery', 200, failedState)).toEqual({ ok: true });
    expect(emptyAlerts(true)).toHaveLength(1);

    // A search of ANOTHER session with a responder resolves it; a registered-only answer is not empty either.
    server.clock.advance(20_000);
    await search('SUPERVISOR', found([answer('127.0.0.1', { adapterKind: CaptureAdapterKind.FAKE, serviceAddress: 'http://127.0.0.1:8554/onvif/device_service' })]));
    expect(emptyAlerts(true)).toEqual([]);
    expect(emptyAlerts(false)).toHaveLength(1);

    const rows = await server.since(trail);
    expect(rows.map((row) => [row.type, row.details['outcome'], row.details['responderCount'], row.details['failureReason'] ?? null])).toEqual([
      ['CAPTURE_DISCOVERY_SEARCHED', 'COMPLETE', 0, null],
      ['CAPTURE_DISCOVERY_SEARCHED', 'COMPLETE', 0, null],
      ['CAPTURE_DISCOVERY_SEARCHED', 'FAILED', 0, 'NO_ELIGIBLE_INTERFACE'],
      ['CAPTURE_DISCOVERY_SEARCHED', 'COMPLETE', 1, null],
    ]);
  });

  it('M4-DISC-LIFE-1: a new search replaces the list and its IDs; the list is gone at `expiresAt`; sign-out discards it with the answer', async () => {
    await farLater();
    await search('TECHNICIAN', found([answer('192.0.2.30')]));
    const first = (await read('TECHNICIAN')).candidates.map((candidate) => candidate.candidateId);
    server.clock.advance(20_000);
    await search('TECHNICIAN', found([answer('192.0.2.30')]));
    const state = await read('TECHNICIAN');
    expect(state.candidates).toHaveLength(1);
    expect(first).not.toContain(state.candidates[0]?.candidateId);

    // The life of the result, on the server clock (ten minutes: inside the idle limit of a session that was just used).
    const expiresAt = state.search?.expiresAt ?? 0;
    server.clock.advance(expiresAt - server.clock.now() - 1);
    expect((await read('TECHNICIAN')).search?.searchId).toBe(state.search?.searchId);
    server.clock.advance(1);
    expect(await read('TECHNICIAN')).toEqual(NONE);
    expect(captureDiscoveryControl(server.app).heldLists()).toBeLessThanOrEqual(1);

    // Sign-out: a second session of the technician searches, signs out, and its list is gone at once.
    const session = await signInOnWeb(server.identity, 'rina.wijaya');
    const calls = scriptedCalls;
    server.clock.advance(20_000);
    const started = await server.app.inject({ method: 'POST', url: DISCOVERY, headers: { ...session.cookie, origin: WEB_ORIGIN } });
    expect(started.statusCode, started.body).toBe(202);
    await reachAdapter(calls + 1);
    server.clock.advance(3_000);
    pending.at(-1)?.close(found([answer('192.0.2.31')]));
    await settled();
    expect((await server.app.inject({ method: 'GET', url: DISCOVERY, headers: session.cookie })).json<CaptureDiscoveryStateBody>().candidates).toHaveLength(1);
    const held = captureDiscoveryControl(server.app).heldLists();
    const signedOut = await server.app.inject({ method: 'POST', url: SIGN_OUT, headers: { ...session.cookie, origin: WEB_ORIGIN } });
    expect(signedOut.statusCode).toBeLessThan(300);
    await settled();
    expect(captureDiscoveryControl(server.app).heldLists()).toBe(held - 1);
    expect((await server.app.inject({ method: 'GET', url: DISCOVERY, headers: session.cookie })).statusCode).toBe(401);
  });
});

describe('the second trigger: the pre-check\'s one search (R-9 AC-1 (b); D80(2); SEC35-39 (3))', () => {
  it('runs for an operator WITHOUT CAPTURE_CONFIG, with trigger PRECHECK and its one row; it is outside the bounds and takes no place in the operator\'s allowance; a second one is not started while it runs', async () => {
    await farLater();
    const trail = await server.trailLength();
    const seam = captureDiscoveryControl(server.app).precheckSearch;
    const investigator = { operatorId: server.operatorId('INVESTIGATOR'), authSessionId: 'AS-PRECHECK-OWNER', deviceId: null };
    // A manual search of the technician first: every spacing bound now holds for a manual start.
    await search('TECHNICIAN', found([answer('192.0.2.40')]));
    expect(outcome(await start('SUPERVISOR'))).toEqual([429, 'RATE_LIMITED']);

    const calls = scriptedCalls;
    const run = seam.runPrecheckSearch(investigator, { sessionId: 'SES-20261001-0001' });
    await reachAdapter(calls + 1);
    // Single-flight: another pre-check's search is not started while this one runs, and says so with null.
    expect(await seam.runPrecheckSearch({ ...investigator, authSessionId: 'AS-OTHER' }, { sessionId: 'SES-20261001-0001' })).toBeNull();
    expect(scriptedCalls).toBe(calls + 1);
    server.clock.advance(3_000);
    pending.at(-1)?.close(found([answer('192.0.2.41'), answer('192.0.2.42')]));
    const closed = await run;
    await settled();
    expect(closed).toMatchObject({ trigger: 'PRECHECK', outcome: 'COMPLETE', responderCount: 2 });

    const rows = searchRows(await server.since(trail));
    expect(rows.map((row) => [row.actorId, row.details])).toEqual([
      [server.operatorId('TECHNICIAN'), expect.objectContaining({ trigger: 'MANUAL', responderCount: 1 })],
      // No `operationId` and no `permission`: the pre-check's search is no API operation and needs no CAPTURE_CONFIG of its starter.
      [investigator.operatorId, { searchId: closed?.searchId, scope: 'CAMERA_NETWORK', trigger: 'PRECHECK', outcome: 'COMPLETE', responderCount: 2, newCount: 2, registeredCount: 0, interfaceCount: 1 }],
    ]);
    // The starter gets the outcome as an alert, never the list: operation 94 refuses the role (M4-DISC-RBAC-1).
    expect(outcome(await server.get('INVESTIGATOR', DISCOVERY))).toEqual([403, 'NOT_PERMITTED']);

    // The operator's allowance is untouched by it: the technician's next manual search starts exactly at its own 10 s
    // (7 s after its window closed; the pre-check search took 3 s of them), not later.
    server.clock.advance(3_999);
    expect(outcome(await start('TECHNICIAN'))).toEqual([429, 'RATE_LIMITED']);
    server.clock.advance(1);
    const next = await search('TECHNICIAN', found([answer('192.0.2.43')]));
    expect(next.response.statusCode).toBe(202);
  });
});

describe('M4-DISC-STUB-1 (run 1 and run 2), M4-SEC-DISC-2 shape: the real adapter on the fake ONVIF stub, through operation 93', () => {
  /**
   * One whole search through the route with the REAL adapter. On the system timers (`systemWindow`,
   * run 1) about three seconds; on the manual timers the same search with its window moved by this file.
   */
  async function stubSearch(role: Role, devices: number, mode?: FakeOnvifDiscoveryMode): Promise<{ state: CaptureDiscoveryStateBody; requests: string[]; registryBefore: unknown; endpointRefs: string[] }> {
    await farLater();
    stub = await startFakeOnvif(devices);
    if (mode !== undefined) stub.setDiscoveryMode(mode);
    try {
      const registryBefore = await registryDigest();
      const response = await start(role);
      expect(response.statusCode, response.body).toBe(202);
      await until(() => captureDiscoveryControl(server.app).heldLists() > 0 && stub !== null, 1_000);
      await openStubWindow();
      // While the window is open the search is RUNNING and lists nothing (on the manual timers: until this file ends it).
      if (!systemWindow) expect(await read(role)).toMatchObject({ search: { state: 'RUNNING' }, candidates: [] });
      await closeStubWindow();
      const answered = await server.get(role, DISCOVERY);
      return {
        state: answered.json<CaptureDiscoveryStateBody>(),
        requests: stub.requestLog().map((entry) => `${entry.channel}/${entry.operation}/${entry.authPresent}`),
        registryBefore,
        endpointRefs: stub.devices().map((device) => device.endpointRef),
      };
    } finally {
      await stub.stop();
      stub = null;
    }
  }

  it.each([1, 2])('run %i: N = 0, 1 and 3 stub devices give N candidates built from the probe answer alone; the stub saw probes and nothing else; the registry is unchanged', async (run) => {
    // Run 1 is the ONE case of this file on the system timers: three whole windows on the wall clock.
    systemWindow = run === 1;
    onTestFinished(() => void (systemWindow = false));
    const trail = await server.trailLength();
    const sent = guard.datagrams().length;

    // N = 0: a search that ran and found nothing.
    const none = await stubSearch('TECHNICIAN', 0);
    expect(none.state).toMatchObject({ search: { state: 'COMPLETE', responderCount: 0, newCount: 0, registeredCount: 0, interfaceCount: 1 }, candidates: [], truncated: false });

    // N = 1: one NEW candidate, testable, FAKE / DEVELOPMENT (it answered from loopback), with what it announced.
    const one = await stubSearch('TECHNICIAN', 1);
    expect(one.state.search).toMatchObject({ state: 'COMPLETE', responderCount: 1, newCount: 1, registeredCount: 0 });
    expect(one.state.candidates.map((candidate) => [candidate.host, candidate.adapter, candidate.sourceClass, candidate.status, candidate.deviceId, candidate.testable, candidate.conflict, candidate.addressChanged, candidate.endpointRef])).toEqual([
      ['127.0.0.1', 'FAKE', 'DEVELOPMENT', 'NEW', null, true, false, false, one.endpointRefs[0]],
    ]);
    expect(one.state.candidates[0]?.name).toEqual(expect.any(String));
    expect(one.state.candidates[0]?.model).toEqual(expect.any(String));
    expect(validateCoreApiResponse('getCaptureDiscovery', 200, one.state)).toEqual({ ok: true });

    // N = 3: three candidates. The stub announces all three from ONE address, so each is listed with
    // `conflict` and none is testable (SEC35-28 (1): two identities, one address).
    const three = await stubSearch('TECHNICIAN', 3);
    expect(three.state.search).toMatchObject({ state: 'COMPLETE', responderCount: 3 });
    expect(three.state.candidates.map((candidate) => [candidate.conflict, candidate.testable, candidate.status])).toEqual([[true, false, 'NEW'], [true, false, 'NEW'], [true, false, 'NEW']]);
    expect(three.state.candidates.map((candidate) => candidate.endpointRef).sort()).toEqual([...three.endpointRefs].sort());

    // D76 (1), D80 (1): the stub's device service and its RTSP listener got NO request, and none was authenticated.
    for (const run of [none, one, three]) {
      expect(run.requests.length).toBe(4);
      expect(new Set(run.requests)).toEqual(new Set(['discovery/Probe/false']));
      expect(await registryDigest()).toEqual(run.registryBefore);
    }
    // Every datagram of the three searches (the 12 probes, and the stub's answers, which this process sends too)
    // went to 127.0.0.1; nothing else was handed to the operating system.
    expect(guard.datagrams().slice(sent).length).toBeGreaterThanOrEqual(12);
    expect(new Set(guard.datagrams().slice(sent))).toEqual(new Set(['127.0.0.1']));
    expect(guard.refused()).toEqual([]);
    expect(guard.connections().filter((host) => host !== '127.0.0.1')).toEqual([]);
    // Three searches, three rows; the counts are those of the lists.
    expect(searchRows(await server.since(trail)).map((row) => [row.details['outcome'], row.details['responderCount'], row.details['newCount'], row.details['registeredCount']])).toEqual([
      ['COMPLETE', 0, 0, 0],
      ['COMPLETE', 1, 1, 0],
      ['COMPLETE', 3, 3, 0],
    ]);
  });

  it('must FAIL when: a stub that answers nothing gives 0 candidates, not 1 (the same assertion reads the other value); a registered identity reads REGISTERED with its device', async () => {
    const silent = await stubSearch('TECHNICIAN', 1, 'SILENT');
    expect(silent.state.candidates).toHaveLength(0);
    expect(silent.state.search?.responderCount).toBe(0);

    // "Already registered" by `onvif_uuid`: the owner gives the seeded CAM-02 the endpoint reference the stub will announce.
    await farLater();
    stub = await startFakeOnvif(1);
    const reference = stub.devices()[0]?.endpointRef ?? '';
    await server.owner.query("UPDATE capture_devices SET onvif_uuid = $1 WHERE id = 'CAM-02'", [reference]);
    try {
      const registry = await registryDigest();
      expect((await start('SUPERVISOR')).statusCode).toBe(202);
      await openStubWindow();
      await closeStubWindow();
      const state = await read('SUPERVISOR');
      expect(state.search).toMatchObject({ responderCount: 1, newCount: 0, registeredCount: 1 });
      expect(state.candidates.map((candidate) => [candidate.status, candidate.deviceId, candidate.endpointRef])).toEqual([['REGISTERED', 'CAM-02', reference]]);
      expect(await registryDigest()).toEqual(registry);
    } finally {
      await server.owner.query("UPDATE capture_devices SET onvif_uuid = NULL WHERE id = 'CAM-02'");
      await stub.stop();
      stub = null;
    }
  });
});

describe('the whole flow once on the booted Core, against the fake ONVIF stub with ONE device: search -> test -> adopt -> assign (R-9 AC-2, AC-5 to AC-9)', () => {
  it('operation 93 finds the camera, 95 reaches it with the fixture credential, 96 registers CAM-03 with its credential in one unit, 79 assigns it to VIDEO-02; the rows, the slice and the registry agree', async () => {
    await farLater();
    // A fixture account made here, for this stub only; it opens nothing else and is printed nowhere.
    const account = { username: `fixture${randomUUID().replaceAll('-', '').slice(0, 12)}`, secret: `fixture ${randomUUID()} ` };
    const ports = await freeFakeOnvifPorts();
    stub = createFakeOnvifStub({ ports, credential: account, devices: 1 });
    await stub.start();
    const trail = await server.trailLength();
    try {
      // SEARCH (93, 94).
      expect((await start('TECHNICIAN')).statusCode).toBe(202);
      await openStubWindow();
      await closeStubWindow();
      const state = await read('TECHNICIAN');
      expect(state.candidates.map((candidate) => [candidate.status, candidate.testable, candidate.adapter, candidate.sourceClass, candidate.adoptable])).toEqual([['NEW', true, 'FAKE', 'DEVELOPMENT', false]]);
      const candidate = state.candidates[0];
      if (candidate === undefined) throw new Error('the search listed no candidate');
      const base = `${DISCOVERY}/candidates/${candidate.candidateId}`;
      expect(stub.requestLog().every((entry) => entry.channel === 'discovery')).toBe(true);

      // The search stayed on loopback. The guard STAYS ON for the test and the adoption (pass D1a; pass C2
      // narrowed it so that the HTTP client of the connection tester passes it for 127.0.0.1): every
      // connection of the flow is counted below, and anything but loopback is refused.
      expect(guard.refused()).toEqual([]);
      const connectionsBefore = guard.connections().length;

      // TEST (95): one read-only attempt with the credential of this request. A password is taken exactly as typed (D117).
      const tested = await server.post('TECHNICIAN', `${base}/test`, { credential: account });
      expect(tested.statusCode, tested.body).toBe(200);
      expect(tested.json()).toMatchObject({ candidateId: candidate.candidateId, outcome: 'REACHABLE', authenticated: true });
      expect(validateCoreApiResponse('testCaptureCandidateConnection', 200, tested.json())).toEqual({ ok: true });
      expect((await read('TECHNICIAN')).candidates[0]).toMatchObject({ adoptable: true, lastTest: { outcome: 'REACHABLE', authenticated: true } });
      // Another session cannot act on the candidate: one 404, and nothing reached the stub for it.
      const requests = stub.requestLog().length;
      expect(outcome(await server.post('SUPERVISOR', `${base}/test`, { credential: account }))).toEqual([404, 'NOT_FOUND']);
      expect(stub.requestLog().length).toBe(requests);

      // ADOPT (96): the device, its credential and the audit rows in one unit.
      server.clock.advance(30_000);
      const registry = await server.owner.query<{ devices: number; credentials: number }>('SELECT (SELECT count(*)::int FROM capture_devices) AS devices, (SELECT count(*)::int FROM capture_device_credentials) AS credentials');
      const adopted = await server.post('TECHNICIAN', `${base}/adopt`, { credential: account });
      expect(adopted.statusCode, adopted.body).toBe(201);
      const adoption = adopted.json<{ deviceId: string; device: Record<string, unknown>; credentialSet: boolean }>();
      expect(validateCoreApiResponse('adoptCaptureCandidate', 201, adoption)).toEqual({ ok: true });
      expect(adoption).toMatchObject({ deviceId: 'CAM-03', credentialSet: true, device: { id: 'CAM-03', kind: 'CAMERA', host: expect.stringMatching(/^127\.0\.0\.1(:\d+)?$/), online: true, streamState: null, capabilities: ['VIDEO'], adapter: 'FAKE', sourceClass: 'DEVELOPMENT' } });
      await settled();
      const stored = await server.owner.query<Record<string, unknown>>("SELECT id, kind, transport, adapter_kind, onvif_uuid, address, enabled, jsonb_array_length(profiles) AS profiles FROM capture_devices WHERE id = 'CAM-03'");
      expect(stored.rows).toEqual([{ id: 'CAM-03', kind: 'CAMERA', transport: 'RTSP', adapter_kind: 'FAKE', onvif_uuid: candidate.endpointRef, address: adoption.device['host'], enabled: true, profiles: expect.any(Number) }]);
      // Task 4 row 51 (AD-06 (4); C36). Until row 51 this line read "greater than 0": the list held the ONVIF tokens the
      // test read. This Core has no relay program, so its connection test has no stream half and judges no stream: NO
      // code exists, the list is empty and no stream row is written - an ONVIF token is stored nowhere, and no default
      // stands in. The adoption that stores a minted code is `connect/__tests__/connect.db.test.ts` (rows 50 and 51).
      expect(Number(stored.rows[0]?.['profiles'])).toBe(0);
      expect((await server.owner.query("SELECT count(*)::int AS rows FROM capture_device_streams WHERE device_id = 'CAM-03'")).rows).toEqual([{ rows: 0 }]);
      const after = await server.owner.query<{ devices: number; credentials: number }>('SELECT (SELECT count(*)::int FROM capture_devices) AS devices, (SELECT count(*)::int FROM capture_device_credentials) AS credentials');
      expect([after.rows[0]?.devices, after.rows[0]?.credentials]).toEqual([(registry.rows[0]?.devices ?? 0) + 1, (registry.rows[0]?.credentials ?? 0) + 1]);
      // The replicated slice and operation 77 hold the device; the candidate reads REGISTERED; a repeat is refused.
      expect(server.engine.slice('captureDevices').devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH', 'CAM-03']);
      expect(server.stateChanges().some((change) => change.ops.some((op) => op.op === 'replace' && op.slice === 'captureDevices'))).toBe(true);
      expect((await read('TECHNICIAN')).candidates[0]).toMatchObject({ status: 'REGISTERED', deviceId: 'CAM-03', adoptable: false });
      server.clock.advance(30_000);
      const repeat = await server.post('TECHNICIAN', `${base}/adopt`, { credential: account });
      expect([outcome(repeat), errorOf(repeat).details]).toEqual([[409, 'INVALID_STATE'], expect.objectContaining({ reason: 'CANDIDATE_ALREADY_REGISTERED', deviceId: 'CAM-03' })]);

      // ASSIGN (79): the registered camera, and never the candidate id.
      const assigned = await server.post('TECHNICIAN', '/api/v1/capture/cameras/CAM-03/source', { trackId: 'VIDEO-02' });
      expect(assigned.statusCode, assigned.body).toBe(200);
      expect(assigned.json<{ cameras: { trackId: string; deviceId: string }[] }>().cameras.map((camera) => [camera.trackId, camera.deviceId])).toEqual([['VIDEO-01', 'CAM-01'], ['VIDEO-02', 'CAM-03']]);
      expect((await server.post('TECHNICIAN', `/api/v1/capture/cameras/${candidate.candidateId}/source`, { trackId: 'VIDEO-02' })).statusCode).toBe(404);
      await settled();

      // The audit trail of the flow, in order; the credential is in none of it.
      const rows = await server.since(trail);
      expect(rows.map((row) => [row.type, row.details['operationId'] ?? null])).toEqual([
        ['CAPTURE_DISCOVERY_SEARCHED', 'startCaptureDiscovery'],
        ['CAPTURE_CONNECTION_TESTED', 'testCaptureCandidateConnection'],
        ['CAPTURE_CONNECTION_TESTED', 'adoptCaptureCandidate'],
        ['CAPTURE_CREDENTIAL_SET', 'adoptCaptureCandidate'],
        ['CAPTURE_CANDIDATE_ADOPTED', 'adoptCaptureCandidate'],
        ['CAPTURE_CONFIG_CHANGED', 'setCaptureCameraSource'],
      ]);
      const everything = JSON.stringify([rows, server.log.lines(), tested.json(), adoption, assigned.json(), server.engine.slice('captureDevices')]);
      expect(everything).not.toContain(account.username);
      expect(everything).not.toContain(account.secret);
      const trailNow = await readTrail(server.owner);
      expect(linkProblems(trailNow)).toEqual([]);
      expect(verifyTrail(trailNow, await readHead(server.owner)).ok).toBe(true);
      // The guard saw the flow: the tester's connections went out through it, all to loopback, none refused.
      expect(guard.connections().length).toBeGreaterThan(connectionsBefore);
      expect(guard.connections().filter((host) => host !== '127.0.0.1')).toEqual([]);
      expect(guard.refused()).toEqual([]);
      // The selector goes back to the built-in camera: the tests after this one start from it.
      expect((await server.post('TECHNICIAN', '/api/v1/capture/cameras/CAM-02/source', { trackId: 'VIDEO-02' })).statusCode).toBe(200);
    } finally {
      guard.restore();
      guard = installLoopbackGuard();
      await stub.stop();
      stub = null;
    }
  });
});

describe('M4-DISC-REC-1 (c) and M4-SEC-DISC-3, booted-Core form: searches during RECORDING, hostile answers included, leave the capture path alone', () => {
  const RECORDING_WINDOW_WALL_MS = 800;
  const HOSTILE: readonly FakeOnvifDiscoveryMode[] = ['WRONG_RELATES_TO', 'FOREIGN_XADDR', 'NO_XADDRS', 'TWO_MATCHES_IN_ONE', 'EMPTY_MATCHES', 'OVERSIZED_BODY', 'ENTITY_EXPANSION', 'NOT_XML', 'FLOOD_300'];

  it.each([1, 2])('run %i: with a session in RECORDING and a capture supervisor writing fragment checkpoints, operation 93 answers 202 for every hostile mode; the fragments stay contiguous and keep arriving, no CAPTURE_FAULT, the same process, a clean stop', async () => {
    await farLater();
    // The recording session of the Core: created, pre-checked and started through the API.
    const investigator = server.operatorId('INVESTIGATOR');
    const created = await server.post('INVESTIGATOR', SESSION, sessionInput(investigator, `LP/2026/1001-01${Math.floor(Math.random() * 90) + 10}`));
    expect(created.statusCode, created.body).toBe(201);
    const sessionId = created.json<{ sessionId: string }>().sessionId;
    expect((await server.post('INVESTIGATOR', on(sessionId, 'precheck'))).statusCode).toBe(202);
    await server.drive(6_000);
    const begun = await server.post('INVESTIGATOR', on(sessionId, 'start'), { acknowledgeWarnings: true });
    expect(begun.statusCode, begun.body).toBe(200);
    await server.drive(1_000);
    expect((await server.get('INVESTIGATOR', CURRENT)).json<{ session: { state: string } }>().session.state).toBe('RECORDING');

    // The capture path of this process: the production supervisor on the fake worker of the test support, which
    // says one heartbeat and one fragment checkpoint every millisecond for as long as the test lets it. (Every 5 ms
    // while each window was three seconds of the wall clock. A window is now open for RECORDING_WINDOW_WALL_MS of
    // the wall clock, counted from the start of its search whatever the search does with the event loop, so the
    // writer runs five times as fast and "more than 100 checkpoints while this search was open" asks about the
    // same share of the writer's pace as before.)
    const clock = manualCaptureTimers();
    const fake = fakeLauncher();
    const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher });
    const faults: string[] = [];
    supervisor.on('warning', (event) => void faults.push(String((event as { warning?: { code?: unknown } }).warning?.code ?? 'WARNING')));
    supervisor.on('workerDown', () => void faults.push('WORKER_DOWN'));
    const fragments: { seq: number; index: number }[] = [];
    supervisor.on('record', (event) => {
      if (event.record.kind === 'FRAGMENT_CHECKPOINT') fragments.push({ seq: event.seq, index: (event.record as unknown as { index: number }).index });
    });
    await supervisor.boot();
    await supervisor.start('S-ROW132-REC', capturePlan('S-ROW132-REC'));
    const worker = fake.last();
    let index = 0;
    const writer = setInterval(() => {
      index += 1;
      clock.advance(100);
      worker.heartbeat();
      worker.record({ kind: 'FRAGMENT_CHECKPOINT', deviceId: 'CAM-01', index, start: index * 1_000, len: 1_000 } as never);
    }, 1);
    const pid = process.pid;
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown): void => void uncaught.push(error);
    process.on('uncaughtException', onUncaught);
    process.on('unhandledRejection', onUncaught);
    const trail = await server.trailLength();
    try {
      for (const mode of HOSTILE) {
        await farLater();
        stub = await startFakeOnvif(2);
        stub.setDiscoveryMode(mode);
        const before = fragments.length;
        // The count at a FIXED time of the wall clock after the start of the search, taken by a timer set now: a
        // search that kept the event loop to itself has used that time up, and this count says so.
        const atWindowEnd = new Promise<number>((resolve) => setTimeout(() => resolve(fragments.length - before), RECORDING_WINDOW_WALL_MS));
        const response = await start('TECHNICIAN');
        // The lift of D86 C-4 is on: a search during RECORDING is accepted (before the lift this was 409).
        expect(response.statusCode, `${mode}: ${response.body}`).toBe(202);
        await openStubWindow();
        // The window stays open until that time.
        const whileOpen = await atWindowEnd;
        await closeStubWindow();
        const state = await read('TECHNICIAN');
        expect(state.search?.state, mode).toBe('COMPLETE');
        expect(validateCoreApiResponse('getCaptureDiscovery', 200, state), mode).toEqual({ ok: true });
        // Checkpoints kept arriving while this search was open.
        expect(fragments.length - before, mode).toBeGreaterThan(100);
        expect(whileOpen, `${mode}: checkpoints inside the fixed wall-clock window`).toBeGreaterThan(100);
        await stub.stop();
        stub = null;
      }
    } finally {
      clearInterval(writer);
      process.off('uncaughtException', onUncaught);
      process.off('unhandledRejection', onUncaught);
      await stub?.stop();
      stub = null;
    }
    // The analyser: fragment indexes 1..n, none missing and none twice, and the record sequence numbers the same.
    expect(fragments.length).toBeGreaterThan(1_000);
    expect(fragments.every((record, at) => record.index === at + 1)).toBe(true);
    expect(fragments.every((record, at) => record.seq === (fragments[0]?.seq ?? 0) + at)).toBe(true);
    expect([faults, uncaught, process.pid]).toEqual([[], [], pid]);
    // Every search of the run wrote its row with the recording session's ID, and the Core's session is still RECORDING, with no capture fault raised.
    const rows = searchRows(await server.since(trail));
    expect(rows.map((row) => row.details['sessionId'])).toEqual(HOSTILE.map(() => sessionId));
    expect(server.engine.slice('session')).toMatchObject({ id: sessionId, state: 'RECORDING', fault: null });
    expect(server.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active)).toEqual([]);
    // A clean stop of both.
    await supervisor.stop('S-ROW132-REC', 'STOPPED');
    await supervisor.shutdown();
    const stopped = await server.post('INVESTIGATOR', on(sessionId, 'stop'), { reason: 'Row 132 search during recording' });
    expect(stopped.statusCode, stopped.body).toBe(202);
    await server.drive(30_000);
    expect(server.engine.slice('session')?.state ?? 'IDLE').not.toBe('RECORDING');
    // Negative control of the analyser: a gap and a duplicate read "not contiguous".
    const gap = [...fragments.slice(0, 5), ...fragments.slice(6, 10)];
    expect(gap.every((record, at) => record.index === at + 1)).toBe(false);
  });
});

describe('the answer on a real listener (an ephemeral port on loopback)', () => {
  it('operation 94 over HTTP: 401 without a cookie, 200 with the supervisor\'s session, the five headers of the server', async () => {
    // The guard stays on (pass D1a, D134; pass C2 narrowed it so the HTTP client's way of naming loopback passes).
    expect(guard.refused()).toEqual([]);
    await server.app.listen({ host: '127.0.0.1', port: 0 });
    const { port } = server.app.server.address() as AddressInfo;
    const call = (headers: Record<string, string>): Promise<{ status: number; requestId: unknown; body: string }> =>
      new Promise((resolve, reject) => {
        httpGet({ host: '127.0.0.1', port, path: DISCOVERY, headers }, (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => (body += chunk));
          response.on('end', () => resolve({ status: response.statusCode ?? 0, requestId: response.headers['x-request-id'], body }));
        }).on('error', reject);
      });
    expect((await call({})).status).toBe(401);
    const session = await signInOnWeb(server.identity, 'andi.pratama');
    const answered = await call(session.cookie);
    expect(answered.status).toBe(200);
    expect(answered.requestId).toEqual(expect.any(String));
    expect(CaptureDiscoveryStateSchema.safeParse(JSON.parse(answered.body)).success).toBe(true);
  });
});

// ═══ Moved here from `wave-i-a2-search-ids.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// FIX WAVE I, DRIVER A2 - finding G70b-07 of re-gate 70, against PostgreSQL: the statement that
// reads the highest stored search number runs as `dems_app`, and a Core that is STARTED AGAIN on
// the same database gives no search ID of its audit chain a second time.
//
// Two processes, one after the other, on one clone of the seed (the real app factory, simulated capture, the scripted
// discovery adapter of `capture-discovery.db.test.ts`: no datagram is sent). The rows are read
// from the table as `dems_owner`.
describe('G70b-07: search IDs over two processes on one database', () => {
  const db = useFurtherDatabase(home, { template: 'seed' });
  const DISCOVERY = '/api/v1/capture/discovery';
  const RESCAN = '/api/v1/capture/inputs/rescan';
  const EMPTY: WsDiscoveryResult = {
    candidates: [],
    responderCount: 0,
    interfaceCount: 1,
    truncated: false,
    counts: { datagramsReceived: 0, datagramsAccepted: 0, dropped: {}, repeats: 0, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 4, sendErrors: 0, handlerErrors: 0 },
  };
  type Target = typeof db;
  const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  interface Process {
    readonly server: EngineApp;
    search(): Promise<string>;
    post(url: string): Promise<LightMyRequestResponse>;
  }

  /** One PROCESS on `target`, started at `startAt`: booted, signed in, with a scripted adapter whose every search finds nothing. */
  async function processOn(target: Target, startAt: number): Promise<Process> {
    const server = await engineApp(target, db.run.dataDir, { startAt, logLevel: 'info' });
    await server.app.readiness.boot();
    await server.app.pipeline.drain();
    captureDiscoveryControl(server.app).provideAdapter(() => ({ discover: async () => EMPTY }) as unknown as OnvifDiscoveryAdapter);
    const { cookie } = await signInOnWeb({ app: server.app, cookieName: server.app.config.sessionCookieName } as unknown as IdentityApp, 'rina.wijaya');
    const post = (url: string): Promise<LightMyRequestResponse> => server.app.inject({ method: 'POST', url, headers: { ...cookie, origin: WEB_ORIGIN } });
    const search = async (): Promise<string> => {
      // Clear of every bound of a search.
      server.clock.advance(130_000);
      const started = await post(DISCOVERY);
      expect(started.statusCode, started.body).toBe(202);
      for (let turn = 0; turn < 20; turn += 1) {
        await delay(10);
        await server.app.pipeline.drain();
      }
      const state = (await server.app.inject({ method: 'GET', url: DISCOVERY, headers: cookie })).json<CaptureDiscoveryStateBody>();
      expect(state.search?.state).toBe('COMPLETE');
      return state.search?.searchId ?? '';
    };
    return { server, search, post };
  }
  const storedIds = async (target: Target): Promise<string[]> =>
    (await readTrail(target.ownerPool())).filter((row) => row.type === 'CAPTURE_DISCOVERY_SEARCHED').map((row) => String((row.details as Record<string, unknown>)['searchId']));

  describe('G70b-07: search IDs across a restart of the Core on one database', () => {
    it('the second process goes on from the highest stored number; a microphone re-read between them does not move it; no ID is stored twice and the chain verifies', async () => {
      const target = db;
      const first = await processOn(target, FIXED_NOW);
      expect(captureDiscoveryControl(first.server.app).searchesStarted()).toBe(0);
      const firstIds = [await first.search(), await first.search()];
      expect(firstIds).toEqual(['DSC-000001', 'DSC-000002']);
      // Operation 97 writes the same audit type with a clock ID of thirteen digits: no counter.
      first.server.clock.advance(130_000);
      expect((await first.post(RESCAN)).statusCode).toBe(200);
      await first.server.app.pipeline.drain();
      // The statement itself, as the runtime role.
      expect(await first.server.app.db.read('test.lastSearchNumber', (pool) => readLastSearchNumber({ query: (text) => pool.query(text) }))).toBe(2);
      const closedAt = first.server.clock.now();
      await first.server.app.close();

      // THE RESTART: a new process, its counter at 0. Before the fix its first search was DSC-000001 again.
      const second = await processOn(target, closedAt + 60_000);
      expect(captureDiscoveryControl(second.server.app).searchesStarted()).toBe(0);
      expect([await second.search(), await second.search()]).toEqual(['DSC-000003', 'DSC-000004']);
      expect(captureDiscoveryControl(second.server.app).searchesStarted()).toBe(2);

      const ids = await storedIds(target);
      const camera = ids.filter((id) => /^DSC-[0-9]{6,9}$/.test(id));
      expect(camera).toEqual(['DSC-000001', 'DSC-000002', 'DSC-000003', 'DSC-000004']);
      expect(ids.filter((id) => /^DSC-[0-9]{13}$/.test(id))).toHaveLength(1);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(CAPTURE_SEARCH_ID_PATTERN);
      const trail = await readTrail(target.ownerPool());
      expect(linkProblems(trail)).toEqual([]);
      expect(verifyTrail(trail, await readHead(target.ownerPool())).ok).toBe(true);
    });
  });
});
