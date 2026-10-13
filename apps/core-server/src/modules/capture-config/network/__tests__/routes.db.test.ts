// Operations 101 and 102 on a booted Core, as `dems_app`, against PostgreSQL, and the reader of
// the network facts of that Core (task 4 blueprint row 108, WP-19d; contract
// `packages/shared/src/api/capture-commissioning.ts`; schema set B; decisions U10, U11, C55, C60 (4)).
//
// WHAT IS REAL: the app factory with every stage (stage 6 enforces CAPTURE_COMMISSION and
// `WEB_CONSOLE_SESSION`), booted as the entry point boots it on a throw-away clone of the seed; the
// two routes; the statements as the runtime role (the grants of migration 0018); the engine's unit
// of work and the audit chain; the boot step that loads the reader; the ONE destination rule of
// the capture unit on what the booted reader answers (`storedCameraAddressRuleOf`, read-only here).
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the capture operation  the test Core is SIMULATED. The folder's own answer to a change there is
//                          409 COMMISSIONING_NOT_AVAILABLE, which the first block measures; every
//                          later block says "this Core accepts a change" with `replaceForTest`.
//                          Not proven here: a booted REAL_PRODUCTION Core (rows 86, 88).
//   the host               a table of interfaces of this file. No interface of this Mac is read,
//                          no address of any host is changed, nothing is sent anywhere. Proven on
//                          hardware: `9A/H-05`.
//   the composition        the reader is taken from the folder's door (`captureNetworkFacts`) and
//                          handed to the rule by this file; the entry point does not hand it in
//                          yet (the mount is requested of row 85c).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readTrail } from '../../../../../test/support/core';
import { manualTimer } from '../../../../../test/support/engine';
import { buildGuardApp, deviceOperator, webOperator, type GuardApp } from '../../../../../test/support/guard';
import { CLOCK_START, WEB_ORIGIN, insertPairedDevice, type Headers } from '../../../../../test/support/identity';
import { captureFenceControl, storedCameraAddressRuleOf } from '../../../../capture/fence';
import { engineControl } from '../../../../engine';
import type { Principal } from '../../../../plugins/authenticate';
import { throttleControl } from '../../../../plugins/throttle';
import { identityControl } from '../../../identity';
import { captureNetworkConfigControl, captureNetworkFacts } from '../../index';
import { createNetworkConfigStore, type HostInterface, type NetworkConfigStore } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row108' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row108-db-'));
const logDir = mkdtempSync(join(tmpdir(), 'dems-row108-log-'));
const errorLogFile = join(logDir, 'errors.log');

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const TABLET = 'DEV-0108';
const CONFIG = '/api/v1/capture/network/config';
/** The host of this file: the office network on `eth0`, the camera port `eth1`, a loopback. */
const HOST: readonly HostInterface[] = [
  { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
  { name: 'eth0', internal: false, addresses: [{ address: '10.20.0.15', prefixLength: 16 }] },
  { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24 }] },
];
/** Every value of a body of this file that names the network: none may be in an audit row or a log line. */
const BODY_TEXT = ['eth1', 'eth9', '192.168.50', '192.168.60', '10.0.0.5'];

let guard: GuardApp;
let owner: Pool;
let supervisor: Headers;
let technician: Headers;
let investigator: Headers;
let technicianOnTablet: Headers;
/** The real store, with a write that can be made to fail AFTER the statement ran (the unit must roll it back). */
let failAfterWrite = false;
const realStore = createNetworkConfigStore();
const store: NetworkConfigStore = {
  ...realStore,
  async update(connection, write, expectedRevision) {
    const written = await realStore.update(connection, write, expectedRevision);
    if (failAfterWrite) throw Object.assign(new Error('row108: a failure injected after the write'), { code: 'ROW108_INJECTED' });
    return written;
  },
};

async function call(method: 'GET' | 'POST', session: Headers | null, payload?: unknown): Promise<LightMyRequestResponse> {
  const headers = session === null ? { origin: WEB_ORIGIN } : { ...session, ...('cookie' in session ? { origin: WEB_ORIGIN } : {}) };
  const response = await guard.app.inject({ method, url: CONFIG, headers: { ...headers, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) }, ...(payload === undefined ? {} : { payload: payload as object }) });
  await guard.app.pipeline.drain();
  return response;
}
const read = (session: Headers | null): Promise<LightMyRequestResponse> => call('GET', session);
const write = (session: Headers | null, payload: unknown): Promise<LightMyRequestResponse> => call('POST', session, payload);
const errorOf = (response: LightMyRequestResponse): { code?: string; details?: Record<string, unknown> } => (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error ?? {};
const reasonOf = (response: LightMyRequestResponse): [number, unknown, unknown] => [response.statusCode, errorOf(response).code, errorOf(response).details?.['reason'] ?? null];
const trail = (): Promise<AuditRow[]> => readTrail(owner);
const since = async (from: number): Promise<AuditRow[]> => (await trail()).slice(from);
const changes = async (): Promise<AuditRow[]> => (await trail()).filter((row) => row.type === 'CAPTURE_NETWORK_CONFIG_CHANGED');
/** The stored row as the owner reads it, or null for an empty table. */
async function storedRow(): Promise<Record<string, unknown> | null> {
  const { rows } = await owner.query(
    'SELECT interface_name, camera_subnet, factory_addresses, alias_host::int AS alias_host, alias_minutes::int AS alias_minutes, camera_ip_start::int AS camera_ip_start, revision::int AS revision, updated_by FROM public.capture_network_config',
  );
  expect(rows.length).toBeLessThanOrEqual(1);
  return (rows[0] as Record<string, unknown> | undefined) ?? null;
}
/** What the ONE destination rule decides for a stored camera address on what the BOOTED reader answers now. */
function judged(address: string): string {
  const decision = storedCameraAddressRuleOf(captureNetworkFacts(guard.app))(address, undefined);
  return decision.allowed ? `ALLOWED from ${String(decision.destination?.sourceAddress)}` : decision.refusal;
}
const INSIDE = '192.168.50.101';
const OUTSIDE = '192.168.60.101';

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
  failAfterWrite = false;
});

describe('the Core this file runs on: nothing is stored, nothing is chosen, a change is not accepted', () => {
  it('after the boot: the table is empty, the reader was loaded by the boot step and answers null - every stored camera address is refused', async () => {
    expect(((await guard.app.db.pool.query('SELECT current_user AS role')).rows[0] as { role: string }).role).toBe('dems_app');
    expect(captureFenceControl(guard.app).operation).toBe('SIMULATED');
    const control = captureNetworkConfigControl(guard.app);
    expect(await storedRow()).toBeNull();
    expect([control.loaded(), control.available()]).toEqual([true, false]);
    expect(guard.log.text()).toContain('CAPTURE_NETWORK_CONFIG_LOADED');
    // The same function at every call: the composition is handed ONE reader.
    expect(captureNetworkFacts(guard.app)).toBe(control.facts);
    // With the interfaces of this file in the place of the machine's: still null, because nothing is stored.
    control.replaceForTest({ interfaces: () => HOST });
    expect(captureNetworkFacts(guard.app)()).toBeNull();
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['NOT_CONFIGURED', 'NOT_CONFIGURED']);
  });

  it('operation 101 answers the defaults with no interface (valid against the contract); operation 102 answers 409 COMMISSIONING_NOT_AVAILABLE and stores nothing, writes no audit row', async () => {
    const from = (await trail()).length;
    const response = await read(technician);
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('getCaptureNetworkConfig', 200, response.json())).toMatchObject({ ok: true });
    expect(response.json()).toEqual({
      configured: false,
      interfaceName: null,
      cameraSubnet: null,
      factoryAddresses: ['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.1.13'],
      aliasHost: 253,
      aliasMinutes: 30,
      cameraIpStart: 101,
      revision: 1,
      updatedAt: null,
      updatedBy: null,
    });
    expect(reasonOf(await write(technician, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' }))).toEqual([409, 'INVALID_STATE', 'COMMISSIONING_NOT_AVAILABLE']);
    expect(await storedRow()).toBeNull();
    expect(await since(from)).toEqual([]);
    expect(judged(INSIDE)).toBe('NOT_CONFIGURED');

    // From here on: this Core accepts a change (the stand-in for production capture), with the store of this file.
    captureNetworkConfigControl(guard.app).replaceForTest({ available: true, store });
  });
});

describe('who may call: CAPTURE_COMMISSION on a web console session - the TECHNICIAN, and nobody else', () => {
  it('401 without a session; 403 NOT_PERMITTED for the INVESTIGATOR and the SUPERVISOR; 403 WEB_CONSOLE_ONLY for the TECHNICIAN on a tablet, also with a malformed body: one ACCESS_DENIED row each, nothing stored', async () => {
    for (const [method, payload] of [
      ['GET', undefined],
      ['POST', { revision: 1, interfaceName: 'eth1' }],
    ] as const) {
      const operationId = method === 'GET' ? 'getCaptureNetworkConfig' : 'updateCaptureNetworkConfig';
      let from = (await trail()).length;
      expect(reasonOf(await call(method, null, payload)), operationId).toEqual([401, 'NOT_SIGNED_IN', null]);
      expect(await since(from), operationId).toEqual([]);

      for (const [session, operator] of [
        [investigator, INVESTIGATOR],
        [supervisor, SUPERVISOR],
      ] as const) {
        from = (await trail()).length;
        const denied = await call(method, session, payload);
        expect([denied.statusCode, errorOf(denied).code, errorOf(denied).details?.['permission']], `${operationId} ${operator.role}`).toEqual([403, 'NOT_PERMITTED', 'CAPTURE_COMMISSION']);
        const rows = await since(from);
        expect(rows.map((row) => row.type), `${operationId} ${operator.role}`).toEqual(['ACCESS_DENIED']);
        expect(rows[0], `${operationId} ${operator.role}`).toMatchObject({ actorId: operator.id, details: { operationId, permission: 'CAPTURE_COMMISSION' } });
      }

      from = (await trail()).length;
      expect(reasonOf(await call(method, technicianOnTablet, payload)), operationId).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      const rows = await since(from);
      expect(rows.map((row) => row.type), operationId).toEqual(['ACCESS_DENIED']);
      expect(rows[0], operationId).toMatchObject({ actorId: TECHNICIAN.id, deviceId: TABLET, details: { operationId, reason: 'WEB_CONSOLE_ONLY' } });
    }
    // A body that is no JSON, from the tablet and from a role without the permission: the refusal is the same, before the body is used.
    expect(reasonOf(await write(technicianOnTablet, '{"revision": 1'))).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
    expect((await write(supervisor, '{"revision": 1')).statusCode).toBe(403);
    expect(await storedRow()).toBeNull();
    expect(await changes()).toEqual([]);
    // CONTROL: the TECHNICIAN on the web console passes both rules for the read.
    expect((await read(technician)).statusCode).toBe(200);
  });
});

describe('operation 102 on the database: every refusal stores nothing and writes no entry', () => {
  it('400 for a body that is no JSON; 422 for a body outside the schema (a name as subnet, a public factory address, 33 addresses, an unknown member, a credential-like member, no revision); the refusals quote nothing', async () => {
    const from = (await trail()).length;
    expect((await write(technician, '{"revision": 1')).statusCode).toBe(400);
    const outside: readonly unknown[] = [
      {},
      { interfaceName: 'eth1' },
      { revision: 0, interfaceName: 'eth1' },
      { revision: 1, interfaceName: 'ETH1' },
      { revision: 1, interfaceName: 'eth1; rm -rf /' },
      { revision: 1, cameraSubnet: 'cameras' },
      { revision: 1, cameraSubnet: '8.8.8.0/24' },
      { revision: 1, cameraSubnet: '192.168.50.0/31' },
      { revision: 1, cameraSubnet: '192.168.50.0/8' },
      { revision: 1, factoryAddresses: ['8.8.8.8'] },
      { revision: 1, factoryAddresses: ['192.168.1.0'] },
      { revision: 1, factoryAddresses: ['camera.local'] },
      { revision: 1, factoryAddresses: Array.from({ length: 33 }, (_unused, index) => `192.168.1.${String(index + 1)}`) },
      { revision: 1, aliasHost: 1 },
      { revision: 1, aliasMinutes: 481 },
      { revision: 1, cameraIpStart: 251 },
      { revision: 1, interfaceName: 'eth1', port: 80 },
      { revision: 1, interfaceName: 'eth1', gateway: '192.168.50.254' },
      { revision: 1, interfaceName: 'eth1', dhcp: true },
      { revision: 1, interfaceName: 'eth1', credential: { username: 'admin', secret: 'row108-not-a-secret' } },
    ];
    for (const payload of outside) {
      const response = await write(technician, payload);
      expect([response.statusCode, errorOf(response).code], JSON.stringify(payload).slice(0, 80)).toEqual([422, 'INVALID_INPUT']);
      expect(response.body, JSON.stringify(payload).slice(0, 80)).not.toMatch(/8\.8\.8|camera\.local|rm -rf|row108-not-a-secret|ETH1/);
    }
    expect(await storedRow()).toBeNull();
    expect(await since(from)).toEqual([]);
  });

  it('409 REVISION_CONFLICT for a stale revision; 422 NETWORK_CONFIG_NOT_ALLOWED for an interface the host does not have, host bits in the subnet, a factory address listed twice', async () => {
    const from = (await trail()).length;
    expect(reasonOf(await write(technician, { revision: 7, interfaceName: 'eth1' }))).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    for (const payload of [
      { revision: 1, interfaceName: 'eth9', cameraSubnet: '192.168.50.0/24' },
      { revision: 1, interfaceName: 'lo' },
      { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.7/24' },
      { revision: 1, factoryAddresses: ['192.168.1.64', '192.168.1.64'] },
    ]) {
      const response = await write(technician, payload);
      expect(reasonOf(response), JSON.stringify(payload)).toEqual([422, 'INVALID_INPUT', 'NETWORK_CONFIG_NOT_ALLOWED']);
      expect(response.body).not.toMatch(/eth|192\.168/);
    }
    expect(await storedRow()).toBeNull();
    expect(await since(from)).toEqual([]);
    expect(judged(INSIDE)).toBe('NOT_CONFIGURED');
  });
});

describe('a committed change: the row, ONE entry, and the reader of the network facts in the same unit', () => {
  it('the first change stores the row as dems_app, writes exactly one CAPTURE_NETWORK_CONFIG_CHANGED row (names and the revision, no value), and the rule now ALLOWS a stored camera inside the subnet and REFUSES one outside it', async () => {
    const from = (await trail()).length;
    const response = await write(technician, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('updateCaptureNetworkConfig', 200, response.json())).toMatchObject({ ok: true });
    expect(response.json()).toMatchObject({ configured: true, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24', revision: 2, updatedBy: TECHNICIAN.id, aliasHost: 253, aliasMinutes: 30, cameraIpStart: 101 });
    expect(await storedRow()).toEqual({
      interface_name: 'eth1',
      camera_subnet: '192.168.50.0/24',
      factory_addresses: ['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.1.13'],
      alias_host: 253,
      alias_minutes: 30,
      camera_ip_start: 101,
      revision: 2,
      updated_by: TECHNICIAN.id,
    });
    const rows = await since(from);
    expect(rows.map((row) => row.type)).toEqual(['CAPTURE_NETWORK_CONFIG_CHANGED']);
    expect(rows[0]).toMatchObject({ actorId: TECHNICIAN.id, deviceId: null, details: { changedFields: 'interfaceName,cameraSubnet', revision: 2, operationId: 'updateCaptureNetworkConfig', permission: 'CAPTURE_COMMISSION' } });
    expect(Object.keys(rows[0]!.details ?? {}).sort()).toEqual(['changedFields', 'operationId', 'permission', 'revision']);

    // THE READER, with no restart and no call of this file between the commit and the judgement.
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
    expect(judged(OUTSIDE)).toBe('OUTSIDE_CAMERA_SUBNET');
    expect(judged('10.20.0.99')).toBe('OTHER_INTERFACE_SUBNET');
    expect(judged('192.168.50.1')).toBe('HOST_ADDRESS');
    // The read answers the same row.
    expect((await read(technician)).json()).toEqual(response.json());
  });

  it('never a stale value after a committed change: the subnet moves, and the address that was allowed is refused at the next judgement - and the other way round', async () => {
    const from = (await trail()).length;
    const moved = await write(technician, { revision: 2, cameraSubnet: '192.168.60.0/24' });
    expect([moved.statusCode, (moved.json() as { revision: number }).revision]).toEqual([200, 3]);
    // The camera interface of this file's host holds no address in the new subnet: no source, never another route.
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['OUTSIDE_CAMERA_SUBNET', 'NO_CAMERA_SOURCE']);
    // The host gains the address: read at the next call, with no change of the stored row.
    const control = captureNetworkConfigControl(guard.app);
    control.replaceForTest({ interfaces: () => HOST.map((entry) => (entry.name === 'eth1' ? { ...entry, addresses: [{ address: '192.168.60.1', prefixLength: 24 }] } : entry)) });
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['OUTSIDE_CAMERA_SUBNET', 'ALLOWED from 192.168.60.1']);
    control.replaceForTest({ interfaces: () => HOST });

    // Cleared: "not configured" at once.
    const cleared = await write(technician, { revision: 3, interfaceName: null });
    expect(cleared.json()).toMatchObject({ configured: false, interfaceName: null, cameraSubnet: '192.168.60.0/24', revision: 4 });
    expect(captureNetworkFacts(guard.app)()).toBeNull();
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['NOT_CONFIGURED', 'NOT_CONFIGURED']);
    // And chosen again, with the first subnet.
    expect((await write(technician, { revision: 4, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24', aliasMinutes: 45 })).statusCode).toBe(200);
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['ALLOWED from 192.168.50.1', 'OUTSIDE_CAMERA_SUBNET']);

    // Exactly one entry per committed change, each naming what changed.
    const rows = await since(from);
    expect(rows.map((row) => [row.type, row.details?.['changedFields'], row.details?.['revision']])).toEqual([
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'cameraSubnet', 3],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'interfaceName', 4],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'interfaceName,cameraSubnet,aliasMinutes', 5],
    ]);
  });

  it('a body that changes nothing: 200 with the unchanged revision, no entry; a refused change on a stored row leaves the row and the reader as they are', async () => {
    const before = await storedRow();
    const from = (await trail()).length;
    const same = await write(technician, { revision: 5, interfaceName: 'eth1', aliasMinutes: 45 });
    expect([same.statusCode, (same.json() as { revision: number }).revision]).toEqual([200, 5]);
    expect(reasonOf(await write(technician, { revision: 4, aliasMinutes: 50 }))).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    expect(reasonOf(await write(technician, { revision: 5, cameraSubnet: '192.168.60.9/24' }))).toEqual([422, 'INVALID_INPUT', 'NETWORK_CONFIG_NOT_ALLOWED']);
    expect(reasonOf(await write(technician, { revision: 5, interfaceName: 'eth9' }))).toEqual([422, 'INVALID_INPUT', 'NETWORK_CONFIG_NOT_ALLOWED']);
    expect(await storedRow()).toEqual(before);
    expect(await since(from)).toEqual([]);
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['ALLOWED from 192.168.50.1', 'OUTSIDE_CAMERA_SUBNET']);
  });

  it('a unit that fails AFTER its statement ran rolls back as a whole: the row is the old one, no entry, and the reader still answers from the old row', async () => {
    const before = await storedRow();
    const from = (await trail()).length;
    failAfterWrite = true;
    const response = await write(technician, { revision: 5, cameraSubnet: '192.168.60.0/24' });
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
    expect(await storedRow()).toEqual(before);
    expect(await since(from)).toEqual([]);
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['ALLOWED from 192.168.50.1', 'OUTSIDE_CAMERA_SUBNET']);
    // CONTROL: the same change commits once the write works; one entry, and the reader follows.
    failAfterWrite = false;
    expect((await write(technician, { revision: 5, cameraSubnet: '192.168.60.0/24' })).statusCode).toBe(200);
    expect((await since(from)).map((row) => row.type)).toEqual(['CAPTURE_NETWORK_CONFIG_CHANGED']);
    expect(judged(INSIDE)).toBe('OUTSIDE_CAMERA_SUBNET');
    expect((await write(technician, { revision: 6, cameraSubnet: '192.168.50.0/24' })).statusCode).toBe(200);
  });

  it('the boot load reads the STORED row: a reader that forgot everything answers from the row again after `load`, and a load that fails leaves it unknown and says so in the persistent error log', async () => {
    const control = captureNetworkConfigControl(guard.app);
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
    // A load from a store that cannot be read: logged and persisted, never thrown; what the reader held stays.
    control.replaceForTest({
      store: {
        ...realStore,
        read: async () => {
          throw Object.assign(new Error('row108: the row cannot be read'), { code: 'ROW108_READ' });
        },
      },
    });
    await expect(control.load()).resolves.toBeUndefined();
    expect(readFileSync(errorLogFile, 'utf8')).toContain('captureNetworkConfig.load');
    // The row changed behind the reader (the owner writes it here, as a boot finds a row another process left): `load` is what the boot step runs.
    await owner.query("UPDATE public.capture_network_config SET camera_subnet = '192.168.60.0/24', revision = revision + 1");
    expect(judged(OUTSIDE)).toBe('OUTSIDE_CAMERA_SUBNET');
    control.replaceForTest({ store, interfaces: () => HOST.map((entry) => (entry.name === 'eth1' ? { ...entry, addresses: [{ address: '192.168.60.1', prefixLength: 24 }] } : entry)) });
    await control.load();
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['OUTSIDE_CAMERA_SUBNET', 'ALLOWED from 192.168.60.1']);
    control.replaceForTest({ interfaces: () => HOST });
    // A row with no choice loads as "not configured".
    await owner.query('UPDATE public.capture_network_config SET interface_name = NULL, revision = revision + 1');
    await control.load();
    expect([captureNetworkFacts(guard.app)(), judged(INSIDE)]).toEqual([null, 'NOT_CONFIGURED']);
  });
});

describe('a session is open: 409 CAPTURE_CONFIG_LOCKED for the change (idle only); the read still answers', () => {
  it('no audit row, nothing stored; with the session cancelled the change is accepted again', async () => {
    const principal: Principal = { kind: 'OPERATOR', operatorId: INVESTIGATOR.id, sessionId: 'row108-investigator', deviceId: null, role: INVESTIGATOR.role } as Principal;
    const created = await guard.app.engine.command(principal, 'createSession', { caseNumber: 'LP/2026/1013-0108', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: INVESTIGATOR.id });
    expect(created.value).toMatchObject({ ok: true });
    await guard.app.pipeline.drain();
    const rows = (await trail()).length;
    const before = await storedRow();
    const revision = before!['revision'] as number;
    expect(reasonOf(await write(technician, { revision, interfaceName: 'eth1' }))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect((await read(technician)).statusCode).toBe(200);
    expect((await trail()).length).toBe(rows);
    expect(await storedRow()).toEqual(before);
    await guard.app.engine.command(principal, 'cancel');
    await guard.app.pipeline.drain();
    // CONTROL: with no session open the same call is accepted.
    const accepted = await write(technician, { revision, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' });
    expect(accepted.statusCode).toBe(200);
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
  });
});

describe('no value of a body outside the row and the answers (this block runs last)', () => {
  it('0 hits of an interface name, a subnet or a factory address in the entries of the changes and in the log at trace', async () => {
    await guard.app.pipeline.drain();
    const rows = await changes();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    // The WHOLE log of the Core at trace, not only this folder's lines.
    const log = guard.log.text();
    expect(log).toContain('camera network configuration changed');
    for (const text of BODY_TEXT) {
      expect(JSON.stringify(rows), text).not.toContain(text);
      expect(log, text).not.toContain(text);
    }
  });
});
