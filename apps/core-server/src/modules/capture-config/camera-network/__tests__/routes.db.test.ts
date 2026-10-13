// Operations 106 `setCameraNetwork` and 107 `getCameraNetworkJob` on a booted Core, as `dems_app`,
// against PostgreSQL (task 4 blueprint row 111, WP-22b; contract
// `packages/shared/src/api/capture-commissioning.ts`; decisions C1, C7, C78, U10; S13-04, S13-11).
//
// WHAT IS REAL: the app factory with every stage (stage 6 enforces CAPTURE_COMMISSION and
// `WEB_CONSOLE_SESSION`, stage 7 the body), booted as the entry point boots it on a throw-away
// clone of the seed; the two routes; the stored network configuration (operation 102) and the
// reader of the network facts; the read of the registered cameras; the engine's unit of work and
// the audit chain; the log at trace level and the persistent error log file; THE TWO RULES of the
// capture unit; the SET-NETWORK FILE and the unauthenticated clock read, through the real `onvif`
// package; in one case THE LOCK-OUT GUARD OF THE APP ITSELF (`captureConnectControl(app).limits`).
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the capture operation  the test Core is SIMULATED: of itself it answers 409
//                          COMMISSIONING_NOT_AVAILABLE (measured first); later blocks say "this Core
//                          changes a camera address" with `replaceForTest`.
//   the camera             the fake ONVIF stub on 127.0.0.1, ephemeral ports. The product's rule
//                          never admits loopback: this file maps the address the rule admitted to
//                          the stub's listener. "The new address" is the ports the stub moves to.
//   the alias address      a recording double that puts the address on the host table of this file.
//   the host               a table of interfaces, a neighbour table and an "answers" function of
//                          this file. No address of any host is read or changed; no `ip`, `ping`
//                          or `arping` runs.
// WHAT IS TYPED is drawn at run time and searched for, count only, in the log, the error log file,
// the audit trail and every answer.
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readTrail } from '../../../../../test/support/core';
import { manualTimer } from '../../../../../test/support/engine';
import { FAKE_ONVIF_HOST, FAKE_ONVIF_NETWORK_DEFAULTS, createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub } from '../../../../../test/support/fake-onvif-stub';
import { buildGuardApp, deviceOperator, webOperator, type GuardApp } from '../../../../../test/support/guard';
import { CLOCK_START, WEB_ORIGIN, insertPairedDevice, type Headers } from '../../../../../test/support/identity';
import { createSystemTimers } from '../../../../capture';
import { createOnvifTimeReader } from '../../../../capture/adapters/camera/onvif-session';
import { CaptureAdapterKind } from '../../../../capture/adapters/kinds';
import type { CameraCandidate } from '../../../../capture/adapters/types';
import { DestinationPurpose, decideDestination, decideNewCameraAddress } from '../../../../capture/destination-rule';
import { cameraNetworkSetterOf, captureFenceControl, hostCommissioningInputsOf, productionCameraDoors } from '../../../../capture/fence';
import { engineControl } from '../../../../engine';
import { throttleControl } from '../../../../plugins/throttle';
import { captureConnectControl } from '../../../capture-discovery';
import { createConnectionTestLimits } from '../../../capture-discovery/connect';
import { identityControl } from '../../../identity';
import { captureCameraNetworkControl, captureNetworkConfigControl } from '../../index';
import type { HostInterface } from '../../network';
import type { CameraNetworkGuard, CameraNetworkParts } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row111' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row111-db-'));
const logDir = mkdtempSync(join(tmpdir(), 'dems-row111-log-'));
const errorLogFile = join(logDir, 'errors.log');

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const TABLET = 'DEV-0111';
const SET = '/api/v1/capture/network/cameras/address';
const JOBS = '/api/v1/capture/network/jobs';
const CONFIG = '/api/v1/capture/network/config';
const ACCOUNT = { username: `cnryU${randomUUID().replaceAll('-', '')}`, secret: `cnryS${randomUUID().replaceAll('-', '')}` };
const WRONG = { username: ACCOUNT.username, secret: `cnryW${randomUUID().replaceAll('-', '')}` };
const NEEDLES = [ACCOUNT.username, ACCOUNT.secret, WRONG.secret];
const FROM = '192.168.1.64';
const ALIAS = '192.168.1.253';
const NEXT = '192.168.50.101';
const MAC = FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress.toUpperCase();

let guard: GuardApp;
let owner: Pool;
let supervisor: Headers;
let technician: Headers;
let otherTechnician: Headers;
let investigator: Headers;
let technicianOnTablet: Headers;

/** The host of this file: the office network on `eth0`, the camera port `eth1`, a loopback. The alias double adds to `eth1`. */
let onPort: string | null = null;
const hostTable = (): readonly HostInterface[] => [
  { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
  { name: 'eth0', internal: false, addresses: [{ address: '10.20.0.15', prefixLength: 16 }] },
  { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24 }, ...(onPort === null ? [] : [{ address: onPort, prefixLength: 24 }])] },
];
let calls: string[] = [];
const open: FakeOnvifStub[] = [];
const timers = createSystemTimers();
const reader = createOnvifTimeReader({ timers });
const candidateAt = (port: number): CameraCandidate => ({ adapterKind: CaptureAdapterKind.FAKE, host: FAKE_ONVIF_HOST, serviceAddress: `http://${FAKE_ONVIF_HOST}:${String(port)}/onvif/device_service`, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false });

/** ONE camera at the factory address (the stub); the parts of a job on it, with `guardOf` as the lock-out guard. */
/** What the last scan says of the camera's address (row V6): as the product's scan today, the count NOT KNOWN and the row showing the camera's hardware address. */
type LastScan = { readonly deviceCount: 'ONE' | 'MORE_THAN_ONE' | 'NOT_KNOWN'; readonly mac: string | null };
const SCANNED: LastScan = { deviceCount: 'NOT_KNOWN', mac: FAKE_ONVIF_NETWORK_DEFAULTS.hwAddress.toUpperCase() };
async function cameraOf(guardOf: () => CameraNetworkGuard, lastScan: LastScan | null = SCANNED): Promise<{ readonly stub: FakeOnvifStub; readonly parts: CameraNetworkParts }> {
  const ports = await freeFakeOnvifPorts();
  const moved = await freeFakeOnvifPorts();
  const stub = createFakeOnvifStub({ ports, credential: ACCOUNT, network: { gatewayReadBack: true, onApply: 'MOVE', movedPorts: moved } });
  await stub.start();
  open.push(stub);
  const rule: CameraNetworkParts['camera']['rule'] = (address, facts) => decideDestination({ purpose: DestinationPurpose.SET_IP, address }, facts);
  const parts: CameraNetworkParts = {
    camera: {
      rule,
      newAddress: (request, context) => decideNewCameraAddress(request, context),
      async poll(destination, signal) {
        calls.push(`poll ${destination.address} from ${String(destination.sourceAddress)}`);
        if (destination.address !== FROM) await stub.networkSettled();
        return reader.read(candidateAt(destination.address === FROM ? ports.device : moved.device), signal, FAKE_ONVIF_HOST);
      },
      // THE MAPPING OF THIS FILE: the product's rule judges the real address; what it admits is dialled at the stub.
      set: cameraNetworkSetterOf(timers, (host, facts) => {
        const decision = decideDestination({ purpose: DestinationPurpose.SET_IP, address: host }, facts);
        if (decision.allowed !== true) return decision;
        calls.push(`set dials ${decision.destination.address} from ${decision.destination.sourceAddress}`);
        return { allowed: true, destination: { address: FAKE_ONVIF_HOST, port: ports.device, sourceAddress: FAKE_ONVIF_HOST, viaAlias: decision.destination.viaAlias } };
      }),
    },
    alias: {
      helper: async () => null,
      async add(request) {
        calls.push(`add ${request.address} ${String(request.minutes)} ${request.subject.reason} by ${request.subject.operatorId}`);
        onPort = request.address;
        return { refusal: null, effect: 'DONE' };
      },
      async remove(request) {
        calls.push(`remove ${request.address}`);
        onPort = null;
        return { refusal: null, effect: 'DONE' };
      },
    },
    guard: guardOf,
    inputs: {
      neighbour: async (address) => (address === FROM || stub.networkState().location === 'MOVED' ? stub.networkState().hwAddress.toUpperCase() : null),
      answers: async (address) => address === FROM,
    },
  };
  captureCameraNetworkControl(guard.app).replaceForTest({ available: true, parts, scan: { claim: () => () => undefined, lastScanOf: (address) => (address === FROM && lastScan !== null ? { ...lastScan, scannedAt: guard.app.clock.now() } : null) } });
  return { stub, parts };
}

async function send(method: 'GET' | 'POST', url: string, session: Headers | null, payload?: unknown): Promise<LightMyRequestResponse> {
  const headers = session === null ? { origin: WEB_ORIGIN } : { ...session, ...('cookie' in session ? { origin: WEB_ORIGIN } : {}) };
  const response = await guard.app.inject({ method, url, headers: { ...headers, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) }, ...(payload === undefined ? {} : { payload: payload as object }) });
  await guard.app.pipeline.drain();
  return response;
}
const start = (session: Headers | null, payload?: unknown): Promise<LightMyRequestResponse> => send('POST', SET, session, payload);
const read = (session: Headers | null, jobId: string): Promise<LightMyRequestResponse> => send('GET', `${JOBS}/${jobId}`, session);
const errorOf = (response: LightMyRequestResponse): { code?: string; details?: Record<string, unknown> } => (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error ?? {};
const reasonOf = (response: LightMyRequestResponse): [number, unknown, unknown] => [response.statusCode, errorOf(response).code, errorOf(response).details?.['reason'] ?? null];
const trail = (): Promise<AuditRow[]> => readTrail(owner);
const since = async (from: number): Promise<AuditRow[]> => (await trail()).slice(from);
async function tableCounts(): Promise<Record<string, number>> {
  const { rows } = await owner.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const counts: Record<string, number> = {};
  for (const { tablename } of rows as { tablename: string }[]) {
    counts[tablename] = Number(((await owner.query(`SELECT count(*)::int AS n FROM public."${tablename}"`)).rows[0] as { n: number }).n);
  }
  return counts;
}
const changedTables = (before: Record<string, number>, after: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.keys(after).filter((table) => after[table] !== before[table]).map((table) => [table, (after[table] ?? 0) - (before[table] ?? 0)]));
const persisted = (): string => (existsSync(errorLogFile) ? readFileSync(errorLogFile, 'utf8') : '');
/** COUNT ONLY: how often anything typed stands in the log, the persistent error log, the whole audit trail and the texts given. */
async function typedAnywhere(...texts: string[]): Promise<number> {
  const everything = [guard.log.text(), persisted(), JSON.stringify(await trail()), ...texts].join('\n');
  return NEEDLES.reduce((sum, needle) => sum + (everything.split(needle).length - 1), 0);
}

beforeAll(async () => {
  owner = db.ownerPool();
  guard = buildGuardApp({ runtime: db.runtime, run: { dataDir }, onCleanup: (close) => db.onCleanup(close) }, { errorLogFile, logLevel: 'trace' });
  await guard.app.ready();
  engineControl(guard.app).useTimer(manualTimer().timer);
  await guard.app.readiness.boot();
  await engineControl(guard.app).idle();

  await insertPairedDevice(owner, TABLET, TECHNICIAN.id, CLOCK_START);
  const tablet = guard.devices.pair(TABLET);
  supervisor = await webOperator(guard, SUPERVISOR.username);
  technician = await webOperator(guard, TECHNICIAN.username);
  otherTechnician = await webOperator(guard, TECHNICIAN.username);
  investigator = await webOperator(guard, INVESTIGATOR.username);
  technicianOnTablet = await deviceOperator(guard, tablet, TECHNICIAN.username);
  await guard.app.pipeline.drain();
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(logDir, { recursive: true, force: true });
});

beforeEach(() => {
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
  calls = [];
  onPort = null;
});
afterEach(async () => {
  await captureCameraNetworkControl(guard.app).idle();
  for (const stub of open.splice(0)) await stub.stop();
});

describe('the Core this file runs on: no parts were handed in and it is not in production capture', () => {
  it('the two routes are mounted; a job is refused 409 COMMISSIONING_NOT_AVAILABLE, writes no audit entry and stores nothing; an id no job has is 404', async () => {
    expect(captureFenceControl(guard.app).operation).toBe('SIMULATED');
    const control = captureCameraNetworkControl(guard.app);
    expect([control.available(), control.provided()]).toEqual([false, false]);
    const from = (await trail()).length;
    const before = await tableCounts();
    expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(reasonOf(await read(technician, 'CNJ-000001'))).toEqual([404, 'NOT_FOUND', null]);
    // A production Core that was handed no parts answers the same: the door is the only way in.
    control.replaceForTest({ available: true });
    expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    // THE PRODUCT AS COMPOSED TODAY: the door takes the parts once, WITHOUT the observations of the host - and every job stays refused.
    const { parts } = await cameraOf(() => createConnectionTestLimits({ now: () => guard.app.clock.now() }));
    control.replaceForTest({ parts: null, scan: null });
    control.provide({ camera: parts.camera, alias: parts.alias, guard: parts.guard });
    expect(control.provided()).toBe(true);
    expect(() => control.provide(parts)).toThrow('provided twice');
    expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(await since(from)).toEqual([]);
    expect(changedTables(before, await tableCounts())).toEqual({});
    expect(calls).toEqual([]);
    expect(open[0]?.httpRequests()).toEqual([]);
    expect(await typedAnywhere()).toBe(0);
    control.replaceForTest({ available: false });
  });
});

describe('who may call: CAPTURE_COMMISSION on a web console session - the TECHNICIAN, and nobody else', () => {
  it('401 without a session; 403 NOT_PERMITTED for the INVESTIGATOR and the SUPERVISOR; 403 WEB_CONSOLE_ONLY for the TECHNICIAN on a tablet - on both operations, before the body is used', async () => {
    const body = { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT };
    expect(reasonOf(await start(null, body))).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(reasonOf(await read(null, 'CNJ-000001'))).toEqual([401, 'NOT_SIGNED_IN', null]);
    for (const [session, operator] of [
      [investigator, INVESTIGATOR],
      [supervisor, SUPERVISOR],
    ] as const) {
      const from = (await trail()).length;
      const denied = await start(session, body);
      expect([denied.statusCode, errorOf(denied).code, errorOf(denied).details?.['permission']], operator.role).toEqual([403, 'NOT_PERMITTED', 'CAPTURE_COMMISSION']);
      expect((await read(session, 'CNJ-000001')).statusCode, operator.role).toBe(403);
      const rows = await since(from);
      expect(rows.map((row) => row.type), operator.role).toEqual(['ACCESS_DENIED', 'ACCESS_DENIED']);
      expect(rows[0], operator.role).toMatchObject({ actorId: operator.id, details: { operationId: 'setCameraNetwork', permission: 'CAPTURE_COMMISSION' } });
    }
    expect(reasonOf(await start(technicianOnTablet, body))).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
    expect(reasonOf(await read(technicianOnTablet, 'CNJ-000001'))).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
    expect((await start(supervisor, '{"fromAddress": ')).statusCode).toBe(403);
    expect(await typedAnywhere()).toBe(0);
  });
});

describe('the body: the present address, at most a new address and a gateway, and the typed account - nothing else', () => {
  it('400 for a body that is no JSON; 422 for a missing account, a prefix, a DHCP mode, a port, an interface, a name, a public or loopback address, a malformed job id - none quoted, nothing asked', async () => {
    const from = (await trail()).length;
    expect((await start(technician, '{"fromAddress": ')).statusCode).toBe(400);
    for (const body of [
      { fromAddress: FROM },
      { fromAddress: FROM, scannedMac: MAC, credential: { username: ACCOUNT.username } },
      { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT, prefixLength: 16 },
      { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT, dhcp: true },
      { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT, mode: 'DHCP' },
      { fromAddress: `${FROM}:8080`, credential: ACCOUNT },
      { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT, interfaceName: 'eth0' },
      { fromAddress: 'camera.local', credential: ACCOUNT },
      { fromAddress: '8.8.8.8', credential: ACCOUNT },
      { fromAddress: '127.0.0.1', credential: ACCOUNT },
      { fromAddress: FROM, scannedMac: MAC, toAddress: '192.168.50.0/24', credential: ACCOUNT },
      { fromAddress: FROM, scannedMac: MAC, gateway: 'gateway.local', credential: ACCOUNT },
    ]) {
      const response = await start(technician, body);
      expect([response.statusCode, errorOf(response).code], Object.keys(body).join(',')).toEqual([422, 'INVALID_INPUT']);
      expect(response.body).not.toMatch(/192\.168\.1\.|camera\.local|8\.8\.8\.8|8080/);
    }
    for (const jobId of ['cnj-1', 'CNJ-1', 'CNJ-0000001', 'CNJ-00000a']) expect([(await read(technician, jobId)).statusCode, jobId]).toEqual([422, jobId]);
    expect(await since(from)).toEqual([]);
    expect(calls).toEqual([]);
    expect(await typedAnywhere()).toBe(0);
  });
});

describe('the whole sequence on the stub, through the routes of a booted Core', () => {
  it('no interface and no subnet are chosen yet: 409 COMMISSIONING_NOT_CONFIGURED, nothing asked of the camera', async () => {
    const { stub } = await cameraOf(() => createConnectionTestLimits({ now: () => guard.app.clock.now() }));
    expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_CONFIGURED']);
    expect(stub.httpRequests()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('the camera at a factory address is given the next free address: 202, the job COMPLETED with the same hardware address; TWO CAMERA_NETWORK_SET entries and no other row of any table; nothing typed anywhere', async () => {
    // The technician states the camera network (operation 102, row 108) on the host of this file.
    captureNetworkConfigControl(guard.app).replaceForTest({ available: true, interfaces: hostTable });
    expect((await send('POST', CONFIG, technician, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' })).statusCode).toBe(200);
    const { stub } = await cameraOf(() => createConnectionTestLimits({ now: () => guard.app.clock.now() }));

    // Refused by the product's rule and by the conflict flag, each with 0 requests at the stub.
    expect(reasonOf(await start(technician, { fromAddress: '192.168.50.1', scannedMac: MAC, credential: ACCOUNT }))).toEqual([422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']);
    expect(reasonOf(await start(technician, { fromAddress: '10.20.0.77', scannedMac: MAC, credential: ACCOUNT }))).toEqual([422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']);
    expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, toAddress: '192.168.60.101', credential: ACCOUNT }))).toEqual([422, 'INVALID_INPUT', 'COMMISSIONING_ADDRESS_NOT_ALLOWED']);
    expect(stub.httpRequests()).toEqual([]);

    const from = (await trail()).length;
    const before = await tableCounts();
    const devicesBefore = (await owner.query('SELECT id, address FROM public.capture_devices ORDER BY id')).rows;
    const response = await start(technician, { fromAddress: FROM, scannedMac: MAC, gateway: '192.168.50.254', credential: ACCOUNT });
    expect(response.statusCode).toBe(202);
    const started = response.json() as { jobId: string; state: string; toAddress: string };
    expect(validateCoreApiResponse('setCameraNetwork', 202, started)).toMatchObject({ ok: true });
    expect(started).toMatchObject({ state: 'RUNNING', fromAddress: FROM, scannedMac: MAC, toAddress: NEXT, deviceId: null });
    await captureCameraNetworkControl(guard.app).idle();
    await guard.app.pipeline.drain();

    const ended = await read(technician, started.jobId);
    expect(ended.statusCode).toBe(200);
    expect(validateCoreApiResponse('getCameraNetworkJob', 200, ended.json())).toMatchObject({ ok: true });
    expect(ended.json()).toMatchObject({ jobId: started.jobId, state: 'COMPLETED', step: 'DONE', fromAddress: FROM, scannedMac: MAC, toAddress: NEXT, neighbourMac: MAC, authenticatedMac: MAC, confirmedMac: MAC, deviceId: null, failure: null });
    // A job is data of the session that started it: the same operator in another session gets the one 404.
    expect(reasonOf(await read(otherTechnician, started.jobId))).toEqual([404, 'NOT_FOUND', null]);

    // The camera: ONE static address, the configuration's prefix, the gateway, one reboot; dialled from the alias address.
    expect(stub.networkState()).toMatchObject({ location: 'MOVED', address: NEXT, prefixLength: 24, dhcp: false, gateway: '192.168.50.254', rebootCount: 1 });
    expect(calls).toEqual([`add ${ALIAS} 30 SET_CAMERA_ADDRESS by ${TECHNICIAN.id}`, `poll ${FROM} from ${ALIAS}`, `set dials ${FROM} from ${ALIAS}`, `remove ${ALIAS}`, `poll ${NEXT} from 192.168.50.1`]);
    expect(onPort).toBeNull();
    // What is typed left as a Digest answer only, to the OLD place only; the polls carry nothing.
    expect(stub.httpRequests().filter((request) => request.authorizationScheme === 'Basic' || request.wsSecurity === 'CLEAR' || (request.authorizationPresent && request.authorizationScheme !== 'Digest'))).toEqual([]);
    expect(stub.httpRequests().filter((request) => request.listener === 'MOVED').map((request) => [request.operation, request.authorizationPresent, request.wsSecurity])).toEqual([['GetSystemDateAndTime', false, 'NONE']]);
    expect(stub.httpRequests()[0]).toMatchObject({ operation: 'GetSystemDateAndTime', authorizationPresent: false, wsSecurity: 'NONE' });
    expect(stub.violations()).toEqual([]);

    // The audit trail: the intent and the result. The addresses and the hardware address; nothing else.
    const rows = await since(from);
    expect(rows.map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['CAMERA_NETWORK_SET', TECHNICIAN.id, { phase: 'REQUESTED', fromAddress: FROM, toAddress: NEXT, deviceCount: 'NOT_KNOWN', operationId: 'setCameraNetwork', permission: 'CAPTURE_COMMISSION' }],
      ['CAMERA_NETWORK_SET', TECHNICIAN.id, { phase: 'COMPLETED', fromAddress: FROM, toAddress: NEXT, deviceCount: 'NOT_KNOWN', mac: MAC, operationId: 'setCameraNetwork', permission: 'CAPTURE_COMMISSION' }],
    ]);
    // NOT STORED: only the audit trail has another count; no registered camera was re-addressed, no alias row, no job row.
    const changed = changedTables(before, await tableCounts());
    expect(Object.values(changed)).toEqual([2]);
    expect(Object.keys(changed).join(',')).toMatch(/audit/);
    expect((await owner.query('SELECT id, address FROM public.capture_devices ORDER BY id')).rows).toEqual(devicesBefore);
    expect(guard.log.text()).toContain('camera address change ended');
    expect(persisted()).toBe('');
    expect(await typedAnywhere(response.body, ended.body, JSON.stringify(calls), JSON.stringify(process.env), process.argv.join(' '))).toBe(0);
  });

  it('A WRONG ACCOUNT spends from THE GUARD OF THE APP ITSELF (the one of operations 95 and 96): one refused Digest answer, nothing set, the alias address away, one count gone; the conflict flag sends nothing', async () => {
    const limits = captureConnectControl(guard.app).limits;
    expect(limits.remaining(FROM)).toBe(2);
    const { stub } = await cameraOf(() => captureConnectControl(guard.app).limits);
    const from = (await trail()).length;
    const response = await start(technician, { fromAddress: FROM, scannedMac: MAC, credential: WRONG });
    expect(response.statusCode).toBe(202);
    await captureCameraNetworkControl(guard.app).idle();
    await guard.app.pipeline.drain();
    const ended = await read(technician, (response.json() as { jobId: string }).jobId);
    expect(ended.json()).toMatchObject({ state: 'FAILED', failure: 'AUTHENTICATION_FAILED', neighbourMac: MAC, authenticatedMac: null, confirmedMac: null });
    expect(stub.networkRequests()).toEqual([]);
    expect(stub.networkState()).toMatchObject({ location: 'ORIGINAL', rebootCount: 0 });
    expect(stub.httpRequests().filter((request) => request.authorizationPresent).map((request) => request.authorizationScheme)).toEqual(['Digest']);
    expect(calls.filter((call) => call.startsWith('add ') || call.startsWith('remove ')).map((call) => call.split(' ')[0])).toEqual(['add', 'remove']);
    expect(limits.remaining(FROM)).toBe(1);
    expect(limits.busy()).toBe(false);
    expect((await since(from)).map((row) => [row.type, row.details['phase'], row.details['failureReason'] ?? null])).toEqual([
      ['CAMERA_NETWORK_SET', 'REQUESTED', null],
      ['CAMERA_NETWORK_SET', 'FAILED', 'AUTHENTICATION_FAILED'],
    ]);
    // The same session at the same instant: the spacing of that guard refuses, before anything is asked.
    const seen = stub.httpRequests().length;
    expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, credential: WRONG }))).toEqual([429, 'RATE_LIMITED', 'CONNECTION_TEST_RATE_LIMITED']);
    expect(stub.httpRequests()).toHaveLength(seen);

    const conflict = await cameraOf(() => createConnectionTestLimits({ now: () => guard.app.clock.now() }), { ...SCANNED, deviceCount: 'MORE_THAN_ONE' });
    expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'CAMERA_ADDRESS_CONFLICT']);
    expect(conflict.stub.httpRequests()).toEqual([]);
    expect(await typedAnywhere(response.body, ended.body, JSON.stringify(calls))).toBe(0);
    captureCameraNetworkControl(guard.app).replaceForTest({ available: false, parts: null, scan: null });
  });

  // Task 4 row 111b (decisions C78, C87). THE HOST'S OBSERVATIONS ARE THE PRODUCT'S HERE: `hostCommissioningInputsOf` of the
  // capture unit, with the destination rule on the facts of this Core before every program. WHAT IS A STAND-IN: the two
  // PROGRAMS - shell scripts of this case in a temporary directory, started by the real production door (only the
  // core-file limit of this test process is answered as 0). No `ip`, `ping` or `arping` runs; nothing but the stub is dialled.
  it('row 111b: the job with THE PRODUCT\'S observations over stand-in programs - a new address that answers is refused, an answer that is not known is refused, and the whole sequence completes with the neighbour table\'s hardware address three times', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'dems-row111b-job-'));
    try {
      const IN_USE = '192.168.50.150';
      const NOT_KNOWN = '192.168.50.151';
      /** The echo program ends with exit code 0 and states NOTHING (the container finding of record 079: such a code proves nothing). */
      const CODE_ONLY = '192.168.50.152';
      /** No echo, and no entry of the neighbour table. */
      const NOT_ASKED = '192.168.50.153';
      const moved = join(folder, 'moved');
      const standIn = (name: string, body: string): string => {
        const program = join(folder, name);
        writeFileSync(program, `#!/bin/sh\nprintf '%s\\n' "$*" >> "$0.args"\n/usr/bin/env >> "$0.env"\n${body}\n`, { mode: 0o700 });
        chmodSync(program, 0o700);
        return program;
      };
      const startedWith = (program: string): string[] => (existsSync(`${program}.args`) ? readFileSync(`${program}.args`, 'utf8').trim().split('\n') : []);
      // The neighbour table of this case: the camera at its factory address; at any other address only once the stub has moved.
      // For ONE address it holds no entry at all: the host never asked there.
      const neighbourProgram = standIn('neighbour', `[ "$5" = "${NOT_ASKED}" ] && exit 0\nif [ "$5" = "${FROM}" ] || [ -e "${moved}" ]; then printf '%s dev eth1 lladdr %s REACHABLE\\n' "$5" "${MAC.toLowerCase()}"; else printf '%s dev eth1  FAILED\\n' "$5"; fi`);
      // The echo program STATES its result (the statistics of its address, one summary line) and ends with the matching code - but for two addresses.
      const says = (received: 0 | 1): string => `printf '%s\\n' "--- $7 ping statistics ---" "1 packets transmitted, ${String(received)} received, ${received === 1 ? '0' : '100'}% packet loss, time 0ms"`;
      const echoProgram = standIn('echo', `case "$7" in\n  ${FROM}|${IN_USE}) ${says(1)}; exit 0 ;;\n  ${NOT_KNOWN}) exit 2 ;;\n  ${CODE_ONLY}) exit 0 ;;\nesac\n${says(0)}\nexit 1`);
      const network = captureNetworkConfigControl(guard.app);
      network.replaceForTest({ available: true, interfaces: hostTable });
      const observed = hostCommissioningInputsOf({
        platform: 'linux',
        timers,
        network: () => network.facts(),
        cameraInterface: () => network.storedInterface(),
        door: (options) => productionCameraDoors(timers).door({ ...options, coreFileLimit: () => 0 }),
        neighbourProgram,
        echoProgram,
      });
      if (observed === null) throw new Error('expected the observations of a linux host');
      const withObservations = async (): Promise<FakeOnvifStub> => {
        const { stub, parts } = await cameraOf(() => createConnectionTestLimits({ now: () => guard.app.clock.now() }));
        const camera: CameraNetworkParts['camera'] = {
          ...parts.camera,
          async poll(destination, signal) {
            const answer = await parts.camera.poll(destination, signal);
            // The host "learns" the moved camera when it has spoken with it at its new place.
            if (stub.networkState().location === 'MOVED') writeFileSync(moved, '');
            return answer;
          },
        };
        captureCameraNetworkControl(guard.app).replaceForTest({ available: true, parts: { ...parts, camera, inputs: observed.job }, scan: { claim: () => () => undefined, lastScanOf: (address) => (address === FROM ? { ...SCANNED, scannedAt: guard.app.clock.now() } : null) } });
        return stub;
      };

      // ── SOMETHING ANSWERS at the typed new address: refused, nothing sent to the camera, the neighbour table not even asked.
      let stub = await withObservations();
      expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, toAddress: IN_USE, credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'CAMERA_NEW_ADDRESS_IN_USE']);
      expect(stub.httpRequests()).toEqual([]);
      expect([startedWith(echoProgram), startedWith(neighbourProgram)]).toEqual([[`-n -q -c 1 -W 1 ${IN_USE}`], []]);

      // ── NOT KNOWN (the echo program ended with a code its row does not know): never "free" - the job is refused.
      stub = await withObservations();
      const from = (await trail()).length;
      expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, toAddress: NOT_KNOWN, credential: ACCOUNT }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
      expect(stub.httpRequests()).toEqual([]);
      expect(await since(from)).toEqual([]);
      expect(startedWith(echoProgram)).toHaveLength(2);
      // THE SAME for an exit code of 0 with nothing stated, and for "none back" with no entry of the table: the new address is REFUSED.
      for (const toAddress of [CODE_ONLY, NOT_ASKED]) {
        stub = await withObservations();
        expect(reasonOf(await start(technician, { fromAddress: FROM, scannedMac: MAC, toAddress, credential: ACCOUNT })), toAddress).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
        expect(stub.httpRequests()).toEqual([]);
      }
      expect(await since(from)).toEqual([]);
      expect(startedWith(echoProgram)).toHaveLength(4);
      expect(startedWith(neighbourProgram)).toEqual([`-4 neigh show to ${NOT_ASKED}`]);

      // ── THE WHOLE SEQUENCE: the next free address (no echo, nothing learnt: free), the camera recognised before the set and at its new place.
      stub = await withObservations();
      calls = [];
      const response = await start(technician, { fromAddress: FROM, scannedMac: MAC, credential: ACCOUNT });
      expect(response.statusCode, response.body).toBe(202);
      const started = response.json() as { jobId: string; toAddress: string };
      expect(started.toAddress).toBe(NEXT);
      await captureCameraNetworkControl(guard.app).idle();
      await guard.app.pipeline.drain();
      const ended = await read(technician, started.jobId);
      expect(ended.json()).toMatchObject({ state: 'COMPLETED', step: 'DONE', fromAddress: FROM, scannedMac: MAC, toAddress: NEXT, neighbourMac: MAC, authenticatedMac: MAC, confirmedMac: MAC, failure: null });
      expect(stub.networkState()).toMatchObject({ location: 'MOVED', address: NEXT });
      expect(stub.violations()).toEqual([]);
      // What the programs were started with: fixed rows and ONE address each. The factory address was asked while its alias address was on the port.
      // Row V6 (R119-06): "free" is TWO silent observations - the fixed echo row, word for word, started twice, and the
      // neighbour entry read after each; never a changed row.
      expect(startedWith(echoProgram).slice(4)).toEqual([`-n -q -c 1 -W 1 ${NEXT}`, `-n -q -c 1 -W 1 ${NEXT}`]);
      expect(startedWith(neighbourProgram).slice(1)).toEqual([`-4 neigh show to ${NEXT}`, `-4 neigh show to ${NEXT}`, `-4 neigh show to ${FROM}`, `-4 neigh show to ${NEXT}`]);
      expect(calls).toEqual([`add ${ALIAS} 30 SET_CAMERA_ADDRESS by ${TECHNICIAN.id}`, `poll ${FROM} from ${ALIAS}`, `set dials ${FROM} from ${ALIAS}`, `remove ${ALIAS}`, `poll ${NEXT} from 192.168.50.1`]);
      // Nothing typed reached a program: not as an argument, not in its environment; nor a log line, the error log, the trail or an answer.
      const programs = [neighbourProgram, echoProgram].map((program) => `${readFileSync(`${program}.args`, 'utf8')}\n${readFileSync(`${program}.env`, 'utf8')}`).join('\n');
      expect(await typedAnywhere(response.body, ended.body, programs)).toBe(0);
      expect(programs).not.toMatch(/^(?:HOME|USER|NODE_|DEMS_)/m);
    } finally {
      rmSync(folder, { recursive: true, force: true });
      captureCameraNetworkControl(guard.app).replaceForTest({ available: false, parts: null, scan: null });
    }
  });
});
