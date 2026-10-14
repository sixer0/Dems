// Operations 95, 96 and 89 on a booted Core, as `dems_app`, against PostgreSQL (blueprint row 142;
// checks M4-CONN-OUT-1, M4-CONN-ATOM-1, M4-CONN-WEBONLY-1, M4-CONN-ORDER-1 (db half), M4-SEC-CRED-1,
// M4-SEC-CRED-2, M4-SEC-ADOPT-1, M7-CONN-CRED-1; contract C3 §2.6; decisions D76, D81, D103, D104).
//
// WHAT IS REAL: the app factory with every stage (stage 6 enforces `WEB_CONSOLE_SESSION`), booted
// as the entry point boots it on a throw-away clone of the seed; this row's three routes; the
// engine and the audit chain; the Core credential store, in a temporary data directory; the
// read-only ONVIF test with the real package, against the fake ONVIF stub of row 60 on 127.0.0.1
// (ONE device, D104). No device of a real network is contacted (D76).
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the candidate state   a list of this file: row 132's store is not mounted yet. The candidate
//                         is the adapter-layer record the stub's probe answer gives.
//   the device registrar  the contract has no engine action that adds a device to the replicated
//                         registry (request filed). The stand-in INSERTs the `capture_devices` row
//                         with the unit's own connection, as `dems_app`: the TRANSACTION of the
//                         adoption is the real one (device row, credential row, audit rows), the
//                         replicated slice does not learn of the device. Not proven here:
//                         `publishes captureDevices`.
//   the relay (task 4     the cases of an adoption that stores a MINTED code run the connect flow's
//   rows 50, 51)          real tester - the ONVIF half, the locator read, the stream half - with a
//                         DOOR DOUBLE in the place of the relay process: it reports the probe line
//                         of the relay's contract and ends. The fake stub's own stream responder is
//                         no camera; the real relay binary against the test camera is
//                         `stream-test.db.test.ts`. Every other case keeps the ONVIF-only tester.
//
// Fixture credentials are canaries drawn at run time. EVERY RULE HAS ITS CONTROL.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS, validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readTrail } from '../../../../../test/support/core';
import { manualTimer } from '../../../../../test/support/engine';
import { FAKE_ONVIF_HOST, createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub } from '../../../../../test/support/fake-onvif-stub';
import { buildGuardApp, deviceOperator, webOperator, type GuardApp } from '../../../../../test/support/guard';
import { CLOCK_START, WEB_ORIGIN, insertPairedDevice, type Headers } from '../../../../../test/support/identity';
import { avcDeclaredFrameRate, createSystemTimers } from '../../../../capture';
import { CaptureAdapterKind, createStreamConnectionTester, type CameraCandidate, type ProductionDoor, type ProductionExit } from '../../../../capture/adapters';
import { createOnvifConnectionTester, createOnvifStreamLocator } from '../../../../capture/adapters/camera/onvif-session';
import { streamProfileOf } from '../../../../sealing-host';
import { spsNal } from '../../../../sealing-host/__tests__/real-init-segments';
import { registerAdoptedCamera, writeAdoptedCameraStreams } from '../../adoption';
import { coreCredentialStore, type CoreCredentialStore } from '../../../../credential-store';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../../../db/schema';
import { engineControl } from '../../../../engine';
import type { Principal } from '../../../../plugins/authenticate';
import { throttleControl } from '../../../../plugins/throttle';
import { identityControl } from '../../../identity';
import {
  UPSERT_CAPTURE_CREDENTIAL,
  captureConnectControl,
  createConnectionTestLimits,
  type CandidateDirectory,
  type CandidateTestRecord,
  type ConnectCandidate,
  type ConnectionTestLimits,
  type DeviceRegistrar,
} from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row142' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row142-db-'));
const logDir = mkdtempSync(join(tmpdir(), 'dems-row142-log-'));
const errorLogFile = join(logDir, 'errors.log');

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const TABLET = 'DEV-0142';

// Two canaries as the fixture account, and a wrong secret that is a canary too.
const ACCOUNT = { username: `cnryU${randomUUID().replaceAll('-', '')}`, secret: `cnryS${randomUUID().replaceAll('-', '')}` };
const WRONG = { username: ACCOUNT.username, secret: `cnryW${randomUUID().replaceAll('-', '')}` };
const CANARIES = [ACCOUNT.username, ACCOUNT.secret, WRONG.secret];
/** A canary as bytes in a `bytea` dump, too. */
const formsOf = (canary: string): string[] => [canary, Buffer.from(canary, 'utf8').toString('hex'), Buffer.from(canary, 'utf8').toString('base64')];

let guard: GuardApp;
let owner: Pool;
let stub: FakeOnvifStub;
let store: CoreCredentialStore;
let supervisor: Headers;
let technician: Headers;
let technicianOnTablet: Headers;
let limits: ConnectionTestLimits;
/** The clock of the limits alone: moving it expires no operator session. */
let limitsClock = CLOCK_START;
/** Every response body of this file, for the sweep. */
const answers: string[] = [];
const publications: unknown[] = [];

// ── The stand-in candidate state: one session owns each candidate (the first that asks for it) ──
interface Held {
  owner: string | null;
  candidate: { candidateId: string; searchId: string; camera: CameraCandidate; registeredDeviceId: string | null; lastTest: CandidateTestRecord | null };
}
const held = new Map<string, Held>();
const directory: CandidateDirectory = {
  find(sessionId, candidateId): ConnectCandidate | null {
    const entry = held.get(candidateId);
    if (entry === undefined) return null;
    entry.owner ??= sessionId;
    return entry.owner === sessionId ? { ...entry.candidate } : null;
  },
  recordTest(_sessionId, candidateId, test) {
    const entry = held.get(candidateId);
    if (entry !== undefined) entry.candidate.lastTest = test;
  },
  markRegistered(_sessionId, candidateId, deviceId) {
    const entry = held.get(candidateId);
    if (entry !== undefined) entry.candidate.registeredDeviceId = deviceId;
  },
};
let minted = 0;
function candidate(overrides: Partial<CameraCandidate> = {}): string {
  const candidateId = `CND-${(minted += 1).toString(16).toUpperCase().padStart(12, '0')}`;
  held.set(candidateId, {
    owner: null,
    candidate: {
      candidateId,
      searchId: 'DSC-000142',
      camera: { adapterKind: CaptureAdapterKind.FAKE, host: FAKE_ONVIF_HOST, serviceAddress: stub.addresses().deviceServiceUrl, endpointRef: `urn:uuid:${randomUUID()}`, vendor: null, model: 'FAKE-CAM-1', name: 'Fake Camera 1', testable: true, conflict: false, ...overrides },
      registeredDeviceId: null,
      lastTest: null,
    },
  });
  return candidateId;
}

// ── The stand-in registrar: the registry row with the unit's own connection, as the runtime role ──
let failAfterDeviceInsert = false;
const registrar: DeviceRegistrar = async (scope, _principal, device) => {
  await scope.unit.query(
    "INSERT INTO public.capture_devices (id, kind, transport, model, address, onvif_uuid, profiles, enabled, last_seen_at, adapter_kind) VALUES ($1, 'CAMERA', 'RTSP', $2, $3, $4, $5::jsonb, true, $6, $7)",
    [device.id, device.model, device.address, device.endpointRef, JSON.stringify(device.profiles), device.at, device.adapterKind],
  );
  // Task 4 row 51: the stream rows of the adoption, by the registrar's OWN function and statement, in the same unit.
  await writeAdoptedCameraStreams(scope.unit, device);
  if (failAfterDeviceInsert) throw new Error('row142: a failure injected after the device INSERT');
  return { id: device.id, kind: 'CAMERA', model: device.model, firmware: null, host: device.address, poePort: null, online: true, streamState: null, capabilities: ['VIDEO'] };
};

// ── Task 4 rows 50 and 51: the connect flow's tester with a DOOR DOUBLE in the place of the relay ──
/** What the next probes report: the stream the "camera" sends, whatever its ONVIF answer announces. */
let streamSent: 'H264' | 'HEVC' = 'H264';
/** How many relays the door double was asked to start, and with which program. */
const relayStarts: string[] = [];
const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
/** An H.264 sequence set that states 25 pictures a second, by the seal test's own builder; HEVC sets by their header bytes. */
const AVC_SETS = { vps: '', sps: hexOf(spsNal({ width: 1920, height: 1088, timing: { unitsInTick: 1, timeScale: 50 } })), pps: '68ce3c80' };
const HEVC_SETS = { vps: '40010c01ffff0160', sps: '4201010160000003', pps: '4401c172b462' };
/** The door of the production programs, doubled: it takes the start message, says the relay's ONE probe line and ends with code 0. No process. */
const relayDouble: ProductionDoor = (options) => {
  relayStarts.push(options.command);
  const attempt = Number((options.message as Readonly<Record<string, unknown>> | null)?.['attempt']);
  const sets = streamSent === 'HEVC' ? HEVC_SETS : AVC_SETS;
  const line = `{"report":"probe","v":1,"attempt":${attempt},"codec":"${streamSent}","width":1920,"height":1080,"rate_milli":25000,"sets_in_description":true,"sets_in_stream":false,"vps":"${sets.vps}","sps":"${sets.sps}","pps":"${sets.pps}"}\n`;
  const ended = new Promise<ProductionExit>((done) => {
    setImmediate(() => {
      options.onOutput?.(Buffer.from(line, 'latin1'));
      done({ exitCode: 0, signal: null, spawnFailed: false, diagnostics: '', output: '' });
    });
  });
  return { pid: null, started: Promise.resolve(), ended, alive: () => false, endInput: () => {}, kill: () => {} };
};
/** The module's own composition of the tester (`capture-discovery/index.ts`), with the door double and a relay program that is never started. */
const streamTester = () => {
  const timers = createSystemTimers();
  return createStreamConnectionTester({
    onvif: createOnvifConnectionTester({ timers }),
    locator: createOnvifStreamLocator({ timers }),
    door: relayDouble,
    relayProgram: '/opt/dems/bin/capture-relay',
    timers,
    statement: { profileOf: streamProfileOf, declaredRate: avcDeclaredFrameRate },
  });
};
/** Puts the two-half tester in for the REST OF ONE CASE (and, when asked, the module's REAL registrar); `beforeEach` puts this file's parts back. */
function useStreamTester(sent: 'H264' | 'HEVC', realRegistrar = false): void {
  streamSent = sent;
  captureConnectControl(guard.app).replaceForTest({ tester: streamTester(), ...(realRegistrar ? { registrar: (scope, _principal, device) => registerAdoptedCamera(scope, device) } : {}) });
}
/** The parts every other case runs with: the ONVIF-only tester (no stream half: no credentialed relay exists for it) and the stand-in registrar. */
const useOnvifOnlyTester = (): void => captureConnectControl(guard.app).replaceForTest({ tester: createOnvifConnectionTester({ timers: createSystemTimers() }), registrar });
const streamRows = async (deviceId: string): Promise<Record<string, unknown>[]> =>
  (await owner.query('SELECT profile, onvif_profile_token, video_source_token, lens, stream_role, codec, width, height FROM public.capture_device_streams WHERE device_id = $1 ORDER BY lens', [deviceId])).rows as Record<string, unknown>[];

/** A case that starts from a registry without the camera an earlier case adopted: as the owner, its stream rows first (the foreign key restricts). */
const dropCamera03 = async (): Promise<void> => {
  await owner.query("DELETE FROM public.capture_device_streams WHERE device_id = 'CAM-03'");
  await owner.query("DELETE FROM public.capture_devices WHERE id = 'CAM-03'");
};

const testPath = (id: string): string => `/api/v1/capture/discovery/candidates/${id}/test`;
const adoptPath = (id: string): string => `/api/v1/capture/discovery/candidates/${id}/adopt`;
const credentialPath = (id: string): string => `/api/v1/capture/devices/${id}/credential`;

async function post(session: Headers, url: string, payload?: unknown): Promise<LightMyRequestResponse> {
  // Past the spacing of the limits for every call: only the bound a test is about can refuse.
  limitsClock += CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS + 6_000;
  const response = await guard.app.inject({ method: 'POST', url, headers: { ...session, ...('cookie' in session ? { origin: WEB_ORIGIN } : {}), ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) }, ...(payload === undefined ? {} : { payload: payload as object }) });
  answers.push(response.body);
  await guard.app.pipeline.drain();
  return response;
}
const errorOf = (response: LightMyRequestResponse): { code?: string; details?: Record<string, unknown> } => (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error ?? {};
const reasonOf = (response: LightMyRequestResponse): [number, unknown, unknown] => [response.statusCode, errorOf(response).code, errorOf(response).details?.['reason']];
const trail = (): Promise<AuditRow[]> => readTrail(owner);
const since = async (from: number): Promise<AuditRow[]> => (await trail()).slice(from);
const count = async (table: string, where = 'true'): Promise<number> => ((await owner.query(`SELECT count(*)::int AS rows FROM public.${table} WHERE ${where}`)).rows[0] as { rows: number }).rows;
const rowCounts = async (): Promise<[number, number]> => [await count('capture_devices'), await count('capture_device_credentials')];
const sqlstate = (pending: Promise<unknown>): Promise<string | undefined> =>
  pending.then(
    () => 'answered',
    (error: { code?: string }) => error.code,
  );
/** Lets the lock-out guard of the loopback host forget (its window is 30 minutes of the limits' clock). */
const forgetGuard = (): void => {
  limitsClock += 31 * 60_000;
};

beforeAll(async () => {
  owner = db.ownerPool();
  limits = createConnectionTestLimits({ now: () => limitsClock });
  guard = buildGuardApp(
    { runtime: db.runtime, run: { dataDir }, onCleanup: (close) => db.onCleanup(close) },
    // The routes are the app's own since row 132 mounted them (`modules/capture-discovery`, D114).
    { errorLogFile, logLevel: 'trace' },
  );
  await guard.app.ready();
  guard.app.seams.replace('publish', (publication) => void publications.push(publication));
  engineControl(guard.app).useTimer(manualTimer().timer);
  await guard.app.readiness.boot();
  await engineControl(guard.app).idle();

  stub = createFakeOnvifStub({ ports: await freeFakeOnvifPorts(), credential: ACCOUNT, devices: 1 });
  await stub.start();
  const connect = captureConnectControl(guard.app);
  // This file's own parts in the place of the module's: the scripted candidates, a tester on
  // system timers, the stand-in registrar, and limits on a clock of their own.
  connect.replaceForTest({ candidates: directory, tester: createOnvifConnectionTester({ timers: createSystemTimers() }), registrar, limits });
  const opened = coreCredentialStore(guard.app);
  if (opened.status !== 'READY') throw new Error(`the store is ${opened.status}`);
  store = opened.store;

  await insertPairedDevice(owner, TABLET, TECHNICIAN.id, CLOCK_START);
  const tablet = guard.devices.pair(TABLET);
  supervisor = await webOperator(guard, SUPERVISOR.username);
  technician = await webOperator(guard, TECHNICIAN.username);
  technicianOnTablet = await deviceOperator(guard, tablet, TECHNICIAN.username);
  await guard.app.pipeline.drain();
});

afterAll(async () => {
  await stub?.stop();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(logDir, { recursive: true, force: true });
});

beforeEach(() => {
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
  stub.setDeviceMode('NORMAL');
  stub.resetLog();
  failAfterDeviceInsert = false;
  forgetGuard();
  useOnvifOnlyTester();
});

describe('the database this file runs on', () => {
  it(`is at the schema version of the code: [${DB_SCHEMA_VERSION}, '${DB_CONTRACT_REVISION}'] = [15, 'dbc-16'], read as dems_app`, async () => {
    const row = (await guard.app.db.pool.query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([row.schema_version, row.contract_revision]).toEqual([15, 'dbc-16']);
    expect([DB_SCHEMA_VERSION, DB_CONTRACT_REVISION]).toEqual([15, 'dbc-16']);
    expect(((await guard.app.db.pool.query('SELECT current_user AS role')).rows[0] as { role: string }).role).toBe('dems_app');
  });
});

describe('M4-CONN-WEBONLY-1: a session of a tablet is refused on 89, 95 and 96 before the body is used', () => {
  it('403 NOT_PERMITTED (WEB_CONSOLE_ONLY), one ACCESS_DENIED row each, also for a malformed body; 0 requests to any device; the web console passes the condition', async () => {
    const id = candidate();
    const body = { credential: ACCOUNT };
    for (const [operationId, url, payload] of [
      ['testCaptureCandidateConnection', testPath(id), body],
      ['adoptCaptureCandidate', adoptPath(id), body],
      ['setCaptureDeviceCredential', credentialPath('CAM-01'), ACCOUNT],
      // A body that is no JSON, with a canary in it: the refusal is the same and nothing of it is kept.
      ['testCaptureCandidateConnection', testPath(id), `{"credential": {"username": "${ACCOUNT.username}", "secret": "${ACCOUNT.secret}"`],
    ] as const) {
      const from = (await trail()).length;
      const response = await post(technicianOnTablet, url, payload);
      expect(reasonOf(response), operationId).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      const rows = await since(from);
      expect(rows.map((row) => row.type), operationId).toEqual(['ACCESS_DENIED']);
      expect(rows[0]).toMatchObject({ actorId: TECHNICIAN.id, deviceId: TABLET, details: { operationId, reason: 'WEB_CONSOLE_ONLY' } });
    }
    expect(stub.requestLog()).toEqual([]);
    expect(await count('capture_device_credentials')).toBe(0);
    // Control: the same operator on the web console is not refused by the condition.
    const web = await post(technician, testPath(id), body);
    expect(web.statusCode).toBe(200);
    expect(stub.requestLog().length).toBeGreaterThan(0);
  });

  // Batch N (security review S99-09; ruling D241): operation 91 takes a typed secret too. Its rule depends on the BODY, so
  // the handler asks the guard: the SAME tablet session, the same answer and row - and the same session's save WITHOUT a
  // credential is stored (gate 81 drove it from the tablet).
  it('S99-09: the same tablet session on operation 91 - a body with `credential` is refused WEB_CONSOLE_ONLY with one ACCESS_DENIED row and nothing stored; without it the change is stored', async () => {
    const STT = '/api/v1/transcription/config';
    const sttRow = async (): Promise<Record<string, unknown>> =>
      (await owner.query('SELECT enabled, diarization, credential_kind, credential_ref, secret_ciphertext, revision::int AS revision FROM public.stt_config')).rows[0] as Record<string, unknown>;
    const before = await sttRow();
    const revision = before['revision'] as number;
    const planted = ['stt', 'S9909', 'k3y', 'Tn4Wq8Zc2Lm6'].join('-');
    for (const credential of [{ kind: 'SECRET', value: planted }, { kind: 'REFERENCE', ref: 'omlx-settings:auth.s9909_ref' }, { kind: 'CLEAR' }]) {
      const from = (await trail()).length;
      const response = await post(technicianOnTablet, STT, { revision, diarization: !(before['diarization'] as boolean), credential });
      expect(reasonOf(response), credential.kind).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      expect(response.body).not.toContain(planted);
      const rows = await since(from);
      expect(rows.map((row) => row.type), credential.kind).toEqual(['ACCESS_DENIED']);
      expect(rows[0]).toMatchObject({ actorId: TECHNICIAN.id, deviceId: TABLET, details: { operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', role: 'TECHNICIAN', reason: 'WEB_CONSOLE_ONLY' } });
      expect(JSON.stringify(rows)).not.toContain(planted);
    }
    expect(await sttRow()).toEqual(before);
    // CONTROL: the tablet's save without a credential is stored, with its STT_CONFIG_CHANGED row and no denial.
    const from = (await trail()).length;
    const saved = await post(technicianOnTablet, STT, { revision, diarization: !(before['diarization'] as boolean) });
    expect(saved.statusCode).toBe(200);
    expect((await since(from)).map((row) => row.type)).toEqual(['STT_CONFIG_CHANGED']);
    expect(await sttRow()).toMatchObject({ diarization: !(before['diarization'] as boolean), revision: revision + 1, credential_kind: before['credential_kind'] });
    // CONTROL: the web console session of the same operator passes the rule with a credential (a pointer: no store is needed).
    const web = await post(technician, STT, { revision: revision + 1, credential: { kind: 'REFERENCE', ref: 'omlx-settings:auth.s9909_ref' } });
    expect(web.statusCode).toBe(200);
    expect((await sttRow())['credential_kind']).toBe('REFERENCE');
  });
});

describe('M4-CONN-OUT-1: the five outcomes through operation 95, on the stub', () => {
  it('each outcome is a 200 result with one CAPTURE_CONNECTION_TESTED row; only the read-only list reached the stub; no RTSP connection', async () => {
    const seen: string[] = [];
    const run = async (mode: Parameters<FakeOnvifStub['setDeviceMode']>[0], credential: typeof ACCOUNT, expected: string): Promise<void> => {
      stub.setDeviceMode(mode);
      forgetGuard();
      const id = candidate();
      const from = (await trail()).length;
      const response = await post(supervisor, testPath(id), { credential });
      expect(response.statusCode, expected).toBe(200);
      expect(validateCoreApiResponse('testCaptureCandidateConnection', 200, response.json()), expected).toMatchObject({ ok: true });
      expect(response.json(), expected).toMatchObject({ candidateId: id, outcome: expected, authenticated: true, usableProfileCount: expected === 'REACHABLE' ? 1 : 0 });
      const rows = await since(from);
      expect(rows.map((row) => row.type), expected).toEqual(['CAPTURE_CONNECTION_TESTED']);
      // A DEVELOPMENT candidate: no `host`, no `endpointRef` (D86 C-3). The marker of the guard is on a refused credential only.
      expect(rows[0]?.details, expected).toEqual({
        candidateId: id,
        searchId: 'DSC-000142',
        outcome: expected,
        authenticated: true,
        adapter: 'FAKE',
        sourceClass: 'DEVELOPMENT',
        operationId: 'testCaptureCandidateConnection',
        ...(expected === 'AUTHENTICATION_FAILED' ? { guardTripped: false } : {}),
        permission: 'CAPTURE_CONFIG',
      });
      expect(rows[0]).toMatchObject({ actorId: SUPERVISOR.id, deviceId: null });
      seen.push((response.json() as { outcome: string }).outcome);
    };
    await run('NORMAL', ACCOUNT, 'REACHABLE');
    await run('NORMAL', WRONG, 'AUTHENTICATION_FAILED');
    await run('NO_PROFILE', ACCOUNT, 'WRONG_PROFILE');
    await run('H265_ONLY', ACCOUNT, 'NOT_H264');
    expect(stub.violations()).toEqual([]);
    expect(stub.requestLog().filter((request) => request.channel !== 'device')).toEqual([]);
    await stub.closeDeviceListener();
    try {
      await run('NORMAL', ACCOUNT, 'UNREACHABLE');
    } finally {
      // The listener of the stub is closed for good: a fresh stub on the same ports for the cases below.
      const ports = { discovery: Number(new URL(`http://${stub.addresses().discovery.address}:${stub.addresses().discovery.port}`).port), device: Number(new URL(stub.addresses().deviceServiceUrl).port), rtsp: Number(new URL(stub.addresses().streamUri.replace(/^[a-z]+:/, 'http:')).port) };
      await stub.stop();
      stub = createFakeOnvifStub({ ports, credential: ACCOUNT, devices: 1 });
      await stub.start();
    }
    expect(new Set(seen).size).toBe(5);
    // Nothing was registered by any test.
    expect(await count('capture_device_credentials')).toBe(0);
  });

  it('M4-SEC-CONN-4 / M4-SEC-AUD-1 through the route: the second refused credential carries guardTripped: true; the third test is 429 with 0 requests and no row', async () => {
    const id = candidate();
    const first = await post(supervisor, testPath(id), { credential: WRONG });
    expect(first.json()).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', failedAttemptsRemaining: 1 });
    const from = (await trail()).length;
    const second = await post(supervisor, testPath(id), { credential: WRONG });
    expect(second.json()).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', failedAttemptsRemaining: 0 });
    expect((await since(from)).map((row) => [row.type, row.details['guardTripped']])).toEqual([['CAPTURE_CONNECTION_TESTED', true]]);
    stub.resetLog();
    const rows = (await trail()).length;
    // Another candidate, another operator session, the right password: the host is closed all the same.
    const third = await post(technician, testPath(candidate()), { credential: ACCOUNT });
    expect(reasonOf(third)).toEqual([429, 'RATE_LIMITED', 'CONNECTION_TEST_LOCKOUT_GUARD']);
    expect(Number(third.headers['retry-after'])).toBeGreaterThan(0);
    expect(stub.requestLog()).toEqual([]);
    expect((await trail()).length).toBe(rows);
  });
});

describe('M4-SEC-CRED-2: a credential outside the accepted characters is refused before any request', () => {
  it('422 INVALID_INPUT on 95, 96 and 89 with 0 requests, no row, and an answer that quotes nothing of the body', async () => {
    const id = candidate();
    const rows = (await trail()).length;
    const bad = [
      { username: `${ACCOUNT.username}<x>`, secret: ACCOUNT.secret },
      { username: `${ACCOUNT.username}&`, secret: ACCOUNT.secret },
      { username: ACCOUNT.username, secret: `${ACCOUNT.secret}é` },
      { username: ACCOUNT.username, secret: `${ACCOUNT.secret}\u0007x` },
      { username: '', secret: ACCOUNT.secret },
      // The table takes 120 characters of account name: longer is refused here, not at the CHECK.
      { username: `${ACCOUNT.username}${'a'.repeat(120)}`, secret: ACCOUNT.secret },
    ];
    for (const credential of bad) {
      for (const response of [await post(supervisor, testPath(id), { credential }), await post(supervisor, adoptPath(id), { credential }), await post(supervisor, credentialPath('CAM-01'), credential)]) {
        expect([response.statusCode, errorOf(response).code]).toEqual([422, 'INVALID_INPUT']);
        for (const canary of CANARIES) expect(response.body.includes(canary)).toBe(false);
      }
    }
    // An unknown member (a typed address) is refused by the strict schema: no operation takes a target.
    for (const extra of [{ host: '192.0.2.9' }, { port: 80 }, { url: 'http://192.0.2.9/' }, { address: '192.0.2.9' }]) {
      expect((await post(supervisor, testPath(id), { credential: ACCOUNT, ...extra })).statusCode).toBe(422);
    }
    expect(stub.requestLog()).toEqual([]);
    expect((await trail()).length).toBe(rows);
    expect(await count('capture_device_credentials')).toBe(0);
  });
});

describe('M4-CONN-ATOM-1 / M7-CONN-CRED-1: adoption is one transaction, as dems_app', () => {
  it('a credentialed adoption: 201, credentialSet true; the device row, the credential row and the two audit rows are there together; the secret is stored ENCRYPTED and opens', async () => {
    // Task 4 rows 50 and 51: the two-half test. The stub ANNOUNCES H264 with the lower-case token `profile_1`; the stream is H.264.
    useStreamTester('H264');
    const id = candidate();
    expect((await post(supervisor, testPath(id), { credential: ACCOUNT })).json()).toMatchObject({ outcome: 'REACHABLE', usableProfileCount: 1 });
    // What the candidate keeps of the test is the Core's CODE, never the token.
    expect(held.get(id)?.candidate.lastTest?.profiles).toEqual(['H264_1080P25']);
    const before = await rowCounts();
    const from = (await trail()).length;
    const response = await post(supervisor, adoptPath(id), { credential: ACCOUNT });
    expect(response.statusCode, guard.log.lines().filter((line) => Number(line['level']) >= 50).map((line) => JSON.stringify(line)).join('\n')).toBe(201);
    const adoption = response.json() as { deviceId: string; credentialSet: boolean; device: { id: string; kind: string } };
    expect(validateCoreApiResponse('adoptCaptureCandidate', 201, adoption)).toMatchObject({ ok: true });
    expect(adoption).toMatchObject({ deviceId: 'CAM-03', credentialSet: true, device: { id: 'CAM-03', kind: 'CAMERA' } });
    expect(await rowCounts()).toEqual([before[0] + 1, before[1] + 1]);

    const rows = await since(from);
    expect(rows.map((row) => row.type)).toEqual(['CAPTURE_CONNECTION_TESTED', 'CAPTURE_CREDENTIAL_SET', 'CAPTURE_CANDIDATE_ADOPTED']);
    expect(rows[0]?.details).toMatchObject({ operationId: 'adoptCaptureCandidate', outcome: 'REACHABLE', authenticated: true });
    // The fact of the write, by name only.
    expect(rows[1]?.details).toEqual({ deviceId: 'CAM-03', operationId: 'adoptCaptureCandidate', permission: 'CAPTURE_CONFIG' });
    expect(rows[2]?.details).toEqual({ deviceId: 'CAM-03', candidateId: id, searchId: 'DSC-000142', adapter: 'FAKE', sourceClass: 'DEVELOPMENT', credentialSet: true, operationId: 'adoptCaptureCandidate', permission: 'CAPTURE_CONFIG' });

    const device = (await owner.query('SELECT kind, transport, adapter_kind, address, onvif_uuid, profiles, enabled FROM public.capture_devices WHERE id = $1', ['CAM-03'])).rows[0] as Record<string, unknown>;
    // Task 4 row 51 (AD-06 (4)): the profile list holds the MINTED CODE - until row 51 it held the ONVIF token `profile_1`.
    expect(device).toMatchObject({ kind: 'CAMERA', transport: 'RTSP', adapter_kind: 'FAKE', profiles: ['H264_1080P25'], enabled: true });
    // The token stands in the stream row, beside the code, with the facts the Core read from the stream.
    expect(await streamRows('CAM-03')).toEqual([{ profile: 'H264_1080P25', onvif_profile_token: 'profile_1', video_source_token: 'vs_1', lens: 1, stream_role: 'MAIN', codec: 'H264', width: 1920, height: 1080 }]);
    // No audit detail of the adoption or of its test holds the token or the code: the rows say what they said before.
    expect(JSON.stringify(rows.map((row) => row.details))).not.toMatch(/profile_1|H264_1080P25/);
    expect(String(device['address'])).toMatch(/^127\.0\.0\.1:\d+$/);
    const stored = (await owner.query('SELECT username, encryption, secret_ciphertext, nonce, key_ref FROM public.capture_device_credentials WHERE device_id = $1', ['CAM-03'])).rows[0] as { username: string; encryption: string; secret_ciphertext: Buffer; nonce: Buffer; key_ref: string };
    expect(stored.encryption).toBe('AES-256-GCM');
    expect(stored.key_ref).toMatch(/^CAPTURE_DEVICE_K_[0-9A-F]{20}$/);
    expect(stored.nonce.byteLength).toBe(12);
    expect(stored.secret_ciphertext.byteLength).toBeGreaterThanOrEqual(33);
    expect(stored.secret_ciphertext.includes(Buffer.from(ACCOUNT.secret))).toBe(false);
    expect(store.capture.open('CAM-03', { keyRef: stored.key_ref, ciphertext: new Uint8Array(stored.secret_ciphertext), nonce: new Uint8Array(stored.nonce) })).toBe(ACCOUNT.secret);
    // The runtime role cannot read it back.
    for (const text of ['SELECT secret_ciphertext FROM public.capture_device_credentials', 'SELECT username FROM public.capture_device_credentials', 'SELECT key_ref FROM public.capture_device_credentials', 'SELECT * FROM public.capture_device_credentials']) {
      expect(await sqlstate(guard.app.db.pool.query(text)), text).toBe('42501');
    }
    // A repeat: the candidate is registered; nothing is contacted and nothing is written.
    stub.resetLog();
    expect(reasonOf(await post(supervisor, adoptPath(id), { credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_ALREADY_REGISTERED']);
    expect(reasonOf(await post(supervisor, testPath(id), { credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_ALREADY_REGISTERED']);
    expect(stub.requestLog()).toEqual([]);
  });

  it('a failure after the device INSERT leaves 0 rows in both tables and no adoption row; the candidate stays NEW (2 runs)', async () => {
    for (const round of [1, 2]) {
      const id = candidate({ endpointRef: `urn:uuid:${randomUUID()}` });
      // Another address than the adopted camera's, so that only the injected failure can stop the unit.
      held.get(id)!.candidate.camera = { ...held.get(id)!.candidate.camera, serviceAddress: stub.addresses().deviceServiceUrl };
      await owner.query("DELETE FROM public.capture_device_credentials WHERE device_id = 'CAM-03'");
      await dropCamera03();
      expect((await post(supervisor, testPath(id), { credential: ACCOUNT })).json(), `round ${round}`).toMatchObject({ outcome: 'REACHABLE' });
      const before = await rowCounts();
      const from = (await trail()).length;
      failAfterDeviceInsert = true;
      const failed = await post(supervisor, adoptPath(id), { credential: ACCOUNT });
      failAfterDeviceInsert = false;
      expect(failed.statusCode, `round ${round}`).toBeGreaterThanOrEqual(500);
      for (const canary of CANARIES) expect(failed.body.includes(canary)).toBe(false);
      expect(await rowCounts(), `round ${round}`).toEqual(before);
      // The attempt itself is audited (a credential was sent); the adoption is not.
      expect((await since(from)).map((row) => row.type), `round ${round}`).toEqual(['CAPTURE_CONNECTION_TESTED']);
      expect(held.get(id)?.candidate.registeredDeviceId).toBeNull();
      // Control: without the injected failure the same candidate IS adopted - the count moves.
      const adopted = await post(supervisor, adoptPath(id), { credential: ACCOUNT });
      expect(adopted.statusCode, `round ${round}`).toBe(201);
      expect(await rowCounts(), `round ${round}`).toEqual([before[0] + 1, before[1] + 1]);
    }
  });

  it('a credential row that cannot be written rolls the device row back too (a sealer whose envelope the table refuses)', async () => {
    await owner.query("DELETE FROM public.capture_device_credentials WHERE device_id = 'CAM-03'");
    await dropCamera03();
    const id = candidate();
    await post(supervisor, testPath(id), { credential: ACCOUNT });
    const before = await rowCounts();
    // The statement itself, as dems_app, with a nonce the CHECK refuses: 23514, and the unit is gone.
    // Row T3 (review 060c T-05; survivor 12 of its section 6): the case took ANY failure - a registrar that failed for
    // another reason, before the credential statement was reached, passed. Now: the registrar DID return (its device
    // row was written inside the unit), and what ended the unit is the CHECK of the credential's nonce, by its name.
    let registrarReturned = false;
    const failure = await guard.app.engine
      .run('row142.badEnvelope', async (scope) => {
        await registrar(scope, { kind: 'ANONYMOUS', retiredDeviceId: null }, { id: 'CAM-03', adapterKind: CaptureAdapterKind.FAKE, model: null, address: '127.0.0.1:1', endpointRef: null, profiles: [], streams: [], at: 1 });
        registrarReturned = true;
        await scope.unit.query(UPSERT_CAPTURE_CREDENTIAL, ['CAM-03', 'x', Buffer.alloc(48), Buffer.alloc(11), 'CAPTURE_DEVICE_K_00000000000000000000', 1]);
      })
      .then(
        () => ({ code: 'answered', constraint: undefined }),
        (error: { code?: string; constraint?: string }) => ({ code: error.code, constraint: error.constraint }),
      );
    expect(registrarReturned).toBe(true);
    expect(failure).toEqual({ code: '23514', constraint: 'capture_device_credentials_nonce_check' });
    expect(await rowCounts()).toEqual(before);
    await guard.app.pipeline.drain();
  });

  it('M4-CONN-ORDER-1: no adoption without a fresh REACHABLE test; the credential is present exactly when the test was authenticated; each refusal stores nothing', async () => {
    await owner.query("DELETE FROM public.capture_device_credentials WHERE device_id = 'CAM-03'");
    await dropCamera03();
    const before = await rowCounts();
    const untested = candidate();
    expect(reasonOf(await post(supervisor, adoptPath(untested), { credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTED']);
    const failed = candidate();
    await post(supervisor, testPath(failed), { credential: WRONG });
    forgetGuard();
    expect(reasonOf(await post(supervisor, adoptPath(failed), { credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTED']);
    const tested = candidate();
    await post(supervisor, testPath(tested), { credential: ACCOUNT });
    stub.resetLog();
    expect(reasonOf(await post(supervisor, adoptPath(tested)))).toEqual([422, 'INVALID_INPUT', 'CREDENTIAL_REQUIRED']);
    expect(stub.requestLog()).toEqual([]);
    // The re-verification fails with the credential of THIS request: 409 with the outcome, one audited attempt, nothing stored.
    const from = (await trail()).length;
    const refused = await post(supervisor, adoptPath(tested), { credential: WRONG });
    expect(reasonOf(refused)).toEqual([409, 'INVALID_STATE', 'CONNECTION_TEST_FAILED']);
    expect(errorOf(refused).details).toMatchObject({ outcome: 'AUTHENTICATION_FAILED' });
    expect((await since(from)).map((row) => row.type)).toEqual(['CAPTURE_CONNECTION_TESTED']);
    // A candidate of another operator session: 404, one answer for unknown and foreign.
    expect(reasonOf(await post(technician, adoptPath(tested), { credential: ACCOUNT }))[0]).toBe(404);
    expect(reasonOf(await post(supervisor, testPath('CND-FFFFFFFFFFFF'), { credential: ACCOUNT }))[0]).toBe(404);
    expect(await rowCounts()).toEqual(before);
  });

  it('M4-SEC-ADOPT-1: the profiles changed between the test and the adoption: 409 CONNECTION_TEST_FAILED (DEVICE_CHANGED), 0 rows', async () => {
    const id = candidate();
    await post(supervisor, testPath(id), { credential: ACCOUNT });
    // The passing test read another profile set than the device lists now.
    held.get(id)!.candidate.lastTest = { ...held.get(id)!.candidate.lastTest!, profiles: ['profile_1', 'profile_2'] };
    const before = await rowCounts();
    const response = await post(supervisor, adoptPath(id), { credential: ACCOUNT });
    expect(reasonOf(response)).toEqual([409, 'INVALID_STATE', 'CONNECTION_TEST_FAILED']);
    expect(errorOf(response).details).toMatchObject({ cause: 'DEVICE_CHANGED' });
    expect(await rowCounts()).toEqual(before);
  });

  it('a one-character secret is stored (the sealer frames it past the 33-byte CHECK) and opens', async () => {
    const short = { username: ACCOUNT.username, secret: 'k' };
    const written = await post(supervisor, credentialPath('CAM-02'), short);
    // The status and the error code in the failure text: this case failed once in eight runs, beside a parallel acceptance run, unexplained.
    expect([written.statusCode, errorOf(written).code, errorOf(written).details?.['reason']]).toEqual([200, undefined, undefined]);
    const stored = (await owner.query('SELECT secret_ciphertext, nonce, key_ref FROM public.capture_device_credentials WHERE device_id = $1', ['CAM-02'])).rows[0] as { secret_ciphertext: Buffer; nonce: Buffer; key_ref: string };
    expect(stored.secret_ciphertext.byteLength).toBeGreaterThanOrEqual(33);
    expect(store.capture.open('CAM-02', { keyRef: stored.key_ref, ciphertext: new Uint8Array(stored.secret_ciphertext), nonce: new Uint8Array(stored.nonce) })).toBe('k');
  });
});

describe('operation 89: the credential of a registered camera, set and REPLACED (D103, F-129a-1)', () => {
  it('the second write replaces the first: one row, a new key reference, the new secret opens; the answer is the capture-config snapshot; the secret column is still 42501', async () => {
    const from = (await trail()).length;
    const first = await post(supervisor, credentialPath('CAM-01'), WRONG);
    expect(first.statusCode).toBe(200);
    expect(validateCoreApiResponse('setCaptureDeviceCredential', 200, first.json())).toMatchObject({ ok: true });
    expect(first.json()).toMatchObject({ locked: false });
    const one = (await owner.query('SELECT key_ref, rotated_at::text AS rotated_at FROM public.capture_device_credentials WHERE device_id = $1', ['CAM-01'])).rows[0] as { key_ref: string; rotated_at: string };
    guard.clock.advance(1_000);
    const second = await post(supervisor, credentialPath('CAM-01'), ACCOUNT);
    expect(second.statusCode).toBe(200);
    expect(await count('capture_device_credentials', "device_id = 'CAM-01'")).toBe(1);
    const two = (await owner.query('SELECT username, secret_ciphertext, nonce, key_ref, rotated_at::text AS rotated_at FROM public.capture_device_credentials WHERE device_id = $1', ['CAM-01'])).rows[0] as { username: string; secret_ciphertext: Buffer; nonce: Buffer; key_ref: string; rotated_at: string };
    expect(two.key_ref).not.toBe(one.key_ref);
    expect(Number(two.rotated_at)).toBeGreaterThan(Number(one.rotated_at));
    expect(store.capture.open('CAM-01', { keyRef: two.key_ref, ciphertext: new Uint8Array(two.secret_ciphertext), nonce: new Uint8Array(two.nonce) })).toBe(ACCOUNT.secret);
    expect((await since(from)).map((row) => [row.type, row.details])).toEqual([
      ['CAPTURE_CREDENTIAL_SET', { deviceId: 'CAM-01', operationId: 'setCaptureDeviceCredential', permission: 'CAPTURE_CONFIG' }],
      ['CAPTURE_CREDENTIAL_SET', { deviceId: 'CAM-01', operationId: 'setCaptureDeviceCredential', permission: 'CAPTURE_CONFIG' }],
    ]);
    expect(await sqlstate(guard.app.db.pool.query('SELECT secret_ciphertext FROM public.capture_device_credentials'))).toBe('42501');
    // Control (F-129a-1): the form with EXCLUDED is refused for the runtime role - the statement of this row is the other one.
    expect(UPSERT_CAPTURE_CREDENTIAL).not.toMatch(/EXCLUDED/i);
    const excluded = `${UPSERT_CAPTURE_CREDENTIAL.slice(0, UPSERT_CAPTURE_CREDENTIAL.indexOf(' DO UPDATE'))} DO UPDATE SET username = EXCLUDED.username`;
    expect(await sqlstate(guard.app.db.pool.query(excluded, ['CAM-01', 'x', Buffer.alloc(48), Buffer.alloc(12), 'CAPTURE_DEVICE_K_00000000000000000000', 1]))).toBe('42501');
    // The stub was never contacted: operation 89 makes no connection.
    expect(stub.requestLog()).toEqual([]);
  });

  it('404 for a device the registry does not hold, for a microphone and for a candidate id; nothing is stored', async () => {
    const before = await count('capture_device_credentials');
    for (const id of ['CAM-99', 'MIC-01']) expect((await post(supervisor, credentialPath(id), ACCOUNT)).statusCode, id).toBe(404);
    expect([404, 422]).toContain((await post(supervisor, credentialPath('CND-000000000001'), ACCOUNT)).statusCode);
    expect(await count('capture_device_credentials')).toBe(before);
  });
});

describe('409 CAPTURE_CONFIG_LOCKED while a session is open, for every connect step', () => {
  it('95, 96 and 89: no audit row, 0 requests, nothing stored; closed, the steps are accepted again', async () => {
    const id = candidate();
    const investigator: Principal = { kind: 'OPERATOR', operatorId: INVESTIGATOR.id, sessionId: 'row142-investigator', deviceId: null, role: INVESTIGATOR.role } as Principal;
    const created = await guard.app.engine.command(investigator, 'createSession', { caseNumber: 'LP/2026/1009-0142', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: INVESTIGATOR.id });
    expect(created.value).toMatchObject({ ok: true });
    await guard.app.pipeline.drain();
    const rows = (await trail()).length;
    const before = await rowCounts();
    stub.resetLog();
    for (const [url, payload] of [
      [testPath(id), { credential: ACCOUNT }],
      [adoptPath(id), { credential: ACCOUNT }],
      [credentialPath('CAM-01'), ACCOUNT],
    ] as const) {
      const response = await post(supervisor, url, payload);
      expect([response.statusCode, errorOf(response).code], url).toEqual([409, 'CAPTURE_CONFIG_LOCKED']);
    }
    expect((await trail()).length).toBe(rows);
    expect(await rowCounts()).toEqual(before);
    expect(stub.requestLog()).toEqual([]);
    await guard.app.engine.command(investigator, 'cancel');
    await guard.app.pipeline.drain();
    // Control: with no session open the same test is accepted.
    expect((await post(supervisor, testPath(id), { credential: ACCOUNT })).statusCode).toBe(200);
  });
});

describe('task 4 rows 50 and 51: the codec is judged from the stream, and an adoption stores the minted code with the ONVIF token', () => {
  it('a camera that ANNOUNCES H264 and SENDS HEVC: tested REACHABLE, adopted with the code HEVC_1080P; the lower-case token stands in the stream row only', async () => {
    useStreamTester('HEVC');
    const id = candidate();
    const starts = relayStarts.length;
    expect((await post(supervisor, testPath(id), { credential: ACCOUNT })).json()).toMatchObject({ outcome: 'REACHABLE', authenticated: true, usableProfileCount: 1 });
    expect(held.get(id)?.candidate.lastTest).toMatchObject({ outcome: 'REACHABLE', profiles: ['HEVC_1080P'] });
    const response = await post(supervisor, adoptPath(id), { credential: ACCOUNT });
    expect(response.statusCode, response.body).toBe(201);
    const { deviceId } = response.json() as { deviceId: string };
    // One relay per probed stream: the test and the re-verification of the adoption.
    expect(relayStarts.slice(starts)).toEqual(['/opt/dems/bin/capture-relay', '/opt/dems/bin/capture-relay']);
    expect((await owner.query('SELECT profiles FROM public.capture_devices WHERE id = $1', [deviceId])).rows).toEqual([{ profiles: ['HEVC_1080P'] }]);
    expect(await streamRows(deviceId)).toEqual([{ profile: 'HEVC_1080P', onvif_profile_token: 'profile_1', video_source_token: 'vs_1', lens: 1, stream_role: 'MAIN', codec: 'HEVC', width: 1920, height: 1080 }]);
    // The answer of the adoption and its log lines hold neither the token nor a text of the camera's announcement.
    expect(response.body).not.toMatch(/profile_1/);
  });

  it('the announcement is advice in the other direction too: a device that announces H265 only is NOT_H264 without a stream half, and REACHABLE with one', async () => {
    stub.setDeviceMode('H265_ONLY');
    const plain = candidate();
    expect((await post(supervisor, testPath(plain), { credential: ACCOUNT })).json()).toMatchObject({ outcome: 'NOT_H264', usableProfileCount: 0 });
    useStreamTester('HEVC');
    const judged = candidate();
    expect((await post(supervisor, testPath(judged), { credential: ACCOUNT })).json()).toMatchObject({ outcome: 'REACHABLE', usableProfileCount: 1 });
    expect(held.get(judged)?.candidate.lastTest?.profiles).toEqual(['HEVC_1080P']);
  });

  it('a stream that changed between the test and the adoption (H.264 then HEVC): 409 CONNECTION_TEST_FAILED (DEVICE_CHANGED), nothing stored', async () => {
    useStreamTester('H264');
    const id = candidate();
    expect((await post(supervisor, testPath(id), { credential: ACCOUNT })).json()).toMatchObject({ outcome: 'REACHABLE' });
    streamSent = 'HEVC';
    const before = [...(await rowCounts()), await count('capture_device_streams')];
    const response = await post(supervisor, adoptPath(id), { credential: ACCOUNT });
    expect(reasonOf(response)).toEqual([409, 'INVALID_STATE', 'CONNECTION_TEST_FAILED']);
    expect(errorOf(response).details).toMatchObject({ cause: 'DEVICE_CHANGED' });
    expect([...(await rowCounts()), await count('capture_device_streams')]).toEqual(before);
  });

  it('an adoption whose test had NO stream half stores no code and no stream row: no default profile stands in, and the ONVIF token is stored nowhere (C36)', async () => {
    const id = candidate();
    expect((await post(supervisor, testPath(id), { credential: ACCOUNT })).json()).toMatchObject({ outcome: 'REACHABLE', usableProfileCount: 1 });
    const streams = await count('capture_device_streams');
    const response = await post(supervisor, adoptPath(id), { credential: ACCOUNT });
    expect(response.statusCode, response.body).toBe(201);
    const { deviceId } = response.json() as { deviceId: string };
    expect((await owner.query('SELECT profiles FROM public.capture_devices WHERE id = $1', [deviceId])).rows).toEqual([{ profiles: [] }]);
    expect(await count('capture_device_streams')).toBe(streams);
    expect(await count('capture_devices', "profiles::text LIKE '%profile_1%'")).toBe(0);
  });

  it('a failure after the stream rows were written rolls them back with the device row', async () => {
    useStreamTester('HEVC');
    const id = candidate();
    await post(supervisor, testPath(id), { credential: ACCOUNT });
    const before = [...(await rowCounts()), await count('capture_device_streams')];
    failAfterDeviceInsert = true;
    expect((await post(supervisor, adoptPath(id), { credential: ACCOUNT })).statusCode).toBe(500);
    expect([...(await rowCounts()), await count('capture_device_streams')]).toEqual(before);
  });

  it('every stored profile element is a code of the Core: 0 rows of capture_devices hold another form (what the CHECK of AD-06 (4) will hold)', async () => {
    const offending = await owner.query("SELECT id FROM public.capture_devices d WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(d.profiles) e WHERE jsonb_typeof(e) <> 'string' OR NOT ((e #>> '{}') ~ '^[A-Z][A-Z0-9_]{0,63}$'))");
    expect(offending.rows).toEqual([]);
    // THE PREDICATE OF THE CHECK ITSELF, as it is handed to the schema writer (`file_requests.md`, row 51): a CHECK takes no
    // subquery, so it is the JSON path form the schema already uses for `source_facts`. Every stored row passes it, and
    // the controls show what it refuses: an ONVIF token, a lower-case text, a number, an over-long code.
    const HOLDS = `NOT jsonb_path_exists($1::jsonb, 'strict $[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))')`;
    const holds = async (profiles: unknown): Promise<boolean> => ((await owner.query(`SELECT ${HOLDS} AS holds`, [JSON.stringify(profiles)])).rows[0] as { holds: boolean }).holds;
    expect((await owner.query(`SELECT count(*)::int AS rows FROM public.capture_devices WHERE NOT (${HOLDS.replace('$1::jsonb', 'profiles')})`)).rows).toEqual([{ rows: 0 }]);
    expect(await Promise.all([[], ['HEVC_1080P'], ['H264_1080P25', 'HEVC_2560X1920P'], [`H${'9'.repeat(63)}`]].map(holds))).toEqual([true, true, true, true]);
    const refused: readonly unknown[][] = [['profile_1'], ['HEVC_1080P', 'profile_1'], ['hevc_1080p'], [7], [null], [{ code: 'HEVC_1080P' }], [`H${'9'.repeat(64)}`], ['HEVC_1080P '], ['']];
    expect(Object.fromEntries(await Promise.all(refused.map(async (profiles) => [JSON.stringify(profiles), await holds(profiles)] as const)))).toEqual(Object.fromEntries(refused.map((profiles) => [JSON.stringify(profiles), false])));
    // WHY THE PATH IS `strict`: in the default (lax) mode a NESTED array is unwrapped, and `[["HEVC_1080P"]]` would read
    // as its inner code and pass. Strict mode takes an element as it stands: a nested list is no string and is refused.
    expect(await holds([['HEVC_1080P']])).toBe(false);
    const lax = ((await owner.query(`SELECT ${HOLDS.replace('strict ', '')} AS holds`, [JSON.stringify([['HEVC_1080P']])])).rows[0] as { holds: boolean }).holds;
    expect(lax).toBe(true);
  });

  // Row T3 (review 060c T-06; survivor 5 of its section 6). The case above was written when the CHECK was a request: it
  // evaluates the text `HOLDS` OF THIS FILE and passes with the constraint dropped. The constraint exists since
  // migration 0022 (`capture_devices_profiles_code_check`, decision C61). THIS case asks the TABLE: the same lists,
  // written into a registry row as the runtime role, each in a unit that is rolled back - the product's own CHECK
  // refuses the nine by its name (23514) and takes the four.
  it('row T3: the TABLE\'s own CHECK holds it - as dems_app, a profile list of another form is refused by `capture_devices_profiles_code_check` (23514) and a list of codes is taken; the rows are as they were', async () => {
    expect(((await guard.app.db.pool.query('SELECT current_user AS role')).rows[0] as { role: string }).role).toBe('dems_app');
    const target = ((await owner.query('SELECT id FROM public.capture_devices ORDER BY id LIMIT 1')).rows[0] as { id: string } | undefined)?.id ?? '';
    expect(target).not.toBe('');
    const stored = async (): Promise<string> => ((await owner.query('SELECT profiles::text AS profiles FROM public.capture_devices WHERE id = $1', [target])).rows[0] as { profiles: string }).profiles;
    const before = await stored();
    /** One write of the list in a unit of its own that is always rolled back: what the table said. */
    const write = async (profiles: unknown): Promise<{ code: string | undefined; constraint: string | undefined; rows: number | null }> => {
      const client = await guard.app.db.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('UPDATE public.capture_devices SET profiles = $2::jsonb WHERE id = $1', [target, JSON.stringify(profiles)]).then(
          (answer) => ({ code: 'answered', constraint: undefined, rows: answer.rowCount }),
          (error: { code?: string; constraint?: string }) => ({ code: error.code, constraint: error.constraint, rows: null }),
        );
        return result;
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    };
    const taken: readonly unknown[][] = [[], ['HEVC_1080P'], ['H264_1080P25', 'HEVC_2560X1920P'], [`H${'9'.repeat(63)}`]];
    for (const profiles of taken) expect(await write(profiles), JSON.stringify(profiles)).toEqual({ code: 'answered', constraint: undefined, rows: 1 });
    const refused: readonly unknown[][] = [['profile_1'], ['HEVC_1080P', 'profile_1'], ['hevc_1080p'], [7], [null], [{ code: 'HEVC_1080P' }], [`H${'9'.repeat(64)}`], ['HEVC_1080P '], [''], [['HEVC_1080P']]];
    for (const profiles of refused) expect(await write(profiles), JSON.stringify(profiles)).toEqual({ code: '23514', constraint: 'capture_devices_profiles_code_check', rows: null });
    // A value that is no list at all is refused too - by the older CHECK that the column holds a list, which is asked first.
    expect(await write('HEVC_1080P')).toEqual({ code: '23514', constraint: 'capture_devices_profiles_check', rows: null });
    expect(await stored()).toBe(before);
  });

  it('with the module\'s REAL registrar: the camera whose token is lower-case is in the registry, and its minted code is assigned to a video slot (operation 78)', async () => {
    useStreamTester('HEVC', true);
    const id = candidate();
    expect((await post(supervisor, testPath(id), { credential: ACCOUNT })).json()).toMatchObject({ outcome: 'REACHABLE' });
    const response = await post(supervisor, adoptPath(id), { credential: ACCOUNT });
    expect(response.statusCode, response.body).toBe(201);
    const { deviceId } = response.json() as { deviceId: string };
    await guard.app.pipeline.drain();
    expect(guard.app.engine.state().captureDevices.devices.map((device) => device.id)).toContain(deviceId);
    expect((await owner.query('SELECT profiles FROM public.capture_devices WHERE id = $1', [deviceId])).rows).toEqual([{ profiles: ['HEVC_1080P'] }]);
    expect(await streamRows(deviceId)).toEqual([{ profile: 'HEVC_1080P', onvif_profile_token: 'profile_1', video_source_token: 'vs_1', lens: 1, stream_role: 'MAIN', codec: 'HEVC', width: 1920, height: 1080 }]);
    // The selector takes the camera with the Core's code. The token would be refused by the selector's own form.
    const assigned = await post(supervisor, '/api/v1/capture/config', { cameras: [{ trackId: 'VIDEO-02', deviceId, profile: 'HEVC_1080P' }] });
    expect(assigned.statusCode, assigned.body).toBe(200);
    await guard.app.pipeline.drain();
    expect((await owner.query('SELECT video_02_device_id, video_02_profile FROM public.capture_config')).rows).toEqual([{ video_02_device_id: deviceId, video_02_profile: 'HEVC_1080P' }]);
    const refused = await post(supervisor, '/api/v1/capture/config', { cameras: [{ trackId: 'VIDEO-02', deviceId, profile: 'profile_1' }] });
    expect(refused.statusCode).toBeGreaterThanOrEqual(400);
    // Back to the built-in camera: the blocks after this one read the selector as it was.
    expect((await post(supervisor, '/api/v1/capture/config', { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02' }] })).statusCode).toBe(200);
    await guard.app.pipeline.drain();
  });
});

describe('M4-SEC-CRED-1: the two canaries through every channel (this block runs last)', () => {
  const hits = (haystack: string, canaries: readonly string[] = CANARIES): string[] => canaries.flatMap((canary) => formsOf(canary).filter((form) => haystack.includes(form)));

  it('0 hits in every response, the log at trace, the error log, the audit trail, the events, the realtime publications and every table (the account-name column of the credential table excepted)', async () => {
    await guard.app.pipeline.drain();
    expect(answers.length).toBeGreaterThan(40);
    expect(hits(answers.join('\n'))).toEqual([]);
    const log = guard.log.text();
    expect(log.length).toBeGreaterThan(10_000);
    expect(log).toContain('camera connection tested');
    expect(hits(log)).toEqual([]);
    expect(hits(existsSync(errorLogFile) ? readFileSync(errorLogFile, 'utf8') : '')).toEqual([]);
    expect(hits(JSON.stringify(await trail()))).toEqual([]);
    expect(publications.length).toBeGreaterThan(0);
    expect(hits(JSON.stringify(publications))).toEqual([]);
    expect(hits(JSON.stringify([...held.values()].map((entry) => entry.candidate)))).toEqual([]);

    const tables = ((await owner.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1")).rows as { table_name: string }[]).map((row) => row.table_name);
    expect(tables).toHaveLength(48);
    const found: string[] = [];
    for (const table of tables) {
      const dump = ((await owner.query(`SELECT row_to_json(t)::text AS row FROM public.${table} t`)).rows as { row: string }[]).map((row) => row.row).join('\n');
      for (const hit of hits(dump)) found.push(`${table}: ${CANARIES.findIndex((canary) => formsOf(canary).includes(hit))}`);
    }
    // BY DESIGN (dbc-3 §B.3): the account name is a clear column of the credential table, which the
    // runtime role cannot read. It is the ONE place either canary is found; the secret is nowhere.
    expect([...new Set(found)]).toEqual(['capture_device_credentials: 0']);
    const names = ((await owner.query('SELECT to_jsonb(c) - \'username\' AS row FROM public.capture_device_credentials c')).rows as { row: unknown }[]).map((row) => JSON.stringify(row.row)).join('\n');
    expect(hits(names)).toEqual([]);
    // The key files of the store hold no canary either.
    expect(await count('capture_device_credentials')).toBeGreaterThanOrEqual(2);
  });

  it('control: a planted log line of the account name, and a planted answer, make the same sweep fail', () => {
    guard.app.log.info({ code: 'ROW142_PLANTED', account: ACCOUNT.username }, 'planted');
    expect(hits(guard.log.text())).toEqual([ACCOUNT.username]);
    expect(hits(`{"detail":"${Buffer.from(ACCOUNT.secret).toString('base64')}"}`)).toHaveLength(1);
  });
});
