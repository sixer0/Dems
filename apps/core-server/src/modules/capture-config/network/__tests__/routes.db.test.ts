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
//                          handed to the rule by this file. The entry point hands the same reader
//                          to the composition of production capture since integration pass I-9a
//                          (decision C76); that hand-over is `capture-composition.db.test.ts`.
//   a refused COMMIT       (row NF) a deferred constraint this file creates on the throw-away
//                          clone and silences again with its switch: the unit's work resolves and the
//                          database refuses the COMMIT itself. A commit that is STORED and whose
//                          answer is lost cannot be made on a real connection here; it is the
//                          bench of `service.test.ts`, and here the owner writes the row behind
//                          the reader, which is the state such a commit leaves.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_INTERFACE_NAME_PATTERN, validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readTrail } from '../../../../../test/support/core';
import { manualTimer } from '../../../../../test/support/engine';
import { buildGuardApp, deviceOperator, webOperator, type GuardApp } from '../../../../../test/support/guard';
import { CLOCK_START, WEB_ORIGIN, insertPairedDevice, type Headers } from '../../../../../test/support/identity';
import { CaptureAdapterKind, judgeStoredCamera, storedCameraCandidate } from '../../../../capture/adapters';
import { captureFenceControl, storedCameraAddressRuleOf } from '../../../../capture/fence';
import { engineControl } from '../../../../engine';
import type { Principal } from '../../../../plugins/authenticate';
import { throttleControl } from '../../../../plugins/throttle';
import { identityControl } from '../../../identity';
import { captureNetworkConfigControl, captureNetworkFacts } from '../../index';
import { NETWORK_FACTS_RELOADED_CODE, NETWORK_FACTS_RELOAD_FAILED_CODE, createNetworkConfigStore, type HostInterface, type NetworkConfigStore } from '../index';

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
/**
 * Row NF (review 120b S2-01, T-1): the reads of the row through the store of this file, counted from 1 since the last
 * `reads = 0`. In ONE call of operation 102 the first read is the unit's own and the second is the RE-LOAD of the
 * reader, after the unit ended. `beforeRead` may look at the reader at that instant, or throw (a read that fails);
 * `afterRead` may hold the row it read back for a while (a slow read).
 */
let reads = 0;
let beforeRead: ((read: number) => void) | null = null;
let afterRead: ((read: number) => Promise<void>) | null = null;
const store: NetworkConfigStore = {
  ...realStore,
  async read(connection) {
    const read = (reads += 1);
    beforeRead?.(read);
    const row = await realStore.read(connection);
    await afterRead?.(read);
    return row;
  },
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
  reads = 0;
  beforeRead = null;
  afterRead = null;
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
      onvifPorts: [80],
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
      // Row V7b (F-4): capitals are in the form now; a first character outside it is not.
      { revision: 1, interfaceName: '_ETH1' },
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

  // Review 120b T-1. The case above fails INSIDE the work, before the line that hands the row to the reader, so it is
  // green whether that line waits for the commit or not. Here the work RESOLVES and the database refuses the COMMIT.
  // SEEN RED on the mutation `unit.afterCommit(() => seams.committed(after))` -> `seams.committed(after)` (service.ts):
  // at the re-load's read the reader then already answers from the row that was never stored.
  it('NEVER A NEW VALUE BEFORE A COMMIT THAT ROLLS BACK: the work resolves, the database refuses the COMMIT - when the unit has ended the reader still answers from the OLD row, nothing is stored, no entry', async () => {
    const before = await storedRow();
    const revision = before!['revision'] as number;
    const from = (await trail()).length;
    // A deferred constraint of this test on the throw-away clone: it speaks at COMMIT, and only while the switch table
    // holds a row. Nothing of it is removed afterwards (static rule T-AO-4 lets no file take a trigger away): the
    // switch is emptied and the constraint stays, silent, until the clone is dropped with the case.
    await owner.query('CREATE TABLE public.row_nf_commit_switch (refuse boolean NOT NULL)');
    await owner.query('GRANT SELECT ON public.row_nf_commit_switch TO PUBLIC');
    await owner.query(
      "CREATE FUNCTION public.row_nf_refuse_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM public.row_nf_commit_switch) THEN RAISE EXCEPTION 'rowNF: the commit is refused'; END IF; RETURN NULL; END $$",
    );
    await owner.query('CREATE CONSTRAINT TRIGGER row_nf_refuse_commit AFTER UPDATE ON public.capture_network_config DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.row_nf_refuse_commit()');
    await owner.query('INSERT INTO public.row_nf_commit_switch (refuse) VALUES (true)');
    // What the reader answers at the instant the unit has ENDED and nothing has been read again yet: the second read
    // of the call is the re-load's, and it is asked BEFORE that read returns anything.
    const atUnitEnd: string[] = [];
    beforeRead = (read) => {
      if (read === 2) atUnitEnd.push(judged(INSIDE), judged(OUTSIDE));
    };
    let response: LightMyRequestResponse;
    try {
      response = await write(technician, { revision, cameraSubnet: '192.168.60.0/24' });
    } finally {
      beforeRead = null;
      await owner.query('DELETE FROM public.row_nf_commit_switch');
    }
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
    // The work DID resolve: the unit read the row, wrote it, and the reader was read again once after it (two reads).
    expect(reads).toBe(2);
    expect(atUnitEnd).toEqual(['ALLOWED from 192.168.50.1', 'OUTSIDE_CAMERA_SUBNET']);
    expect(await storedRow()).toEqual(before);
    expect(await since(from)).toEqual([]);
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['ALLOWED from 192.168.50.1', 'OUTSIDE_CAMERA_SUBNET']);
    // CONTROL: without the refusing constraint the same body commits, and the reader follows it and comes back.
    await engineControl(guard.app).idle();
    expect((await write(technician, { revision, cameraSubnet: '192.168.60.0/24' })).statusCode).toBe(200);
    expect(judged(INSIDE)).toBe('OUTSIDE_CAMERA_SUBNET');
    expect((await write(technician, { revision: revision + 1, cameraSubnet: '192.168.50.0/24' })).statusCode).toBe(200);
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
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

// Review 120b finding S2-01 (with 60e E-09), row NF: operation 101 answers from the DATABASE, the rule judges on
// MEMORY - so memory has to follow the row after every unit of operation 102, not only after a confirmed commit.
// The first three cases were SEEN RED with the re-load removed from `changeNetworkConfig` (`await seams.reload()`
// deleted, service.ts); the fourth on its own mutation, named there.
describe('the reader\'s way back to the stored row (S2-01): after every unit of operation 102 the rule judges on the row operation 101 shows', () => {
  const logSince = (from: number): string => guard.log.text().slice(from);
  const countOf = (text: string, needle: string): number => text.split(needle).length - 1;
  const revisionNow = async (): Promise<number> => (await storedRow())!['revision'] as number;

  it('(a) A ROW STORED BEHIND THE READER (what a commit whose answer was lost leaves): the retry of the same body is a REVISION_CONFLICT - and from then on the rule judges on the stored row; (b) so does a body that changes nothing', async () => {
    expect((await write(technician, { revision: await revisionNow(), interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' })).statusCode).toBe(200);
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['ALLOWED from 192.168.50.1', 'OUTSIDE_CAMERA_SUBNET']);
    const stale = await revisionNow();
    // The row is stored and the reader was not told. Until the next call of operation 102 the reader is behind it.
    await owner.query("UPDATE public.capture_network_config SET camera_subnet = '192.168.60.0/24', revision = revision + 1");
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
    const trailFrom = (await trail()).length;
    let logFrom = guard.log.text().length;
    expect(reasonOf(await write(technician, { revision: stale, cameraSubnet: '192.168.60.0/24' }))).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    // The screen and the rule agree again, with no restart: the read shows the row the rule now judges on.
    expect((await read(technician)).json()).toMatchObject({ cameraSubnet: '192.168.60.0/24', revision: stale + 1 });
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['OUTSIDE_CAMERA_SUBNET', 'NO_CAMERA_SOURCE']);
    // Said once, with two facts and no value: memory was behind the row.
    expect(countOf(logSince(logFrom), NETWORK_FACTS_RELOADED_CODE)).toBe(1);

    // (b) The no-change path (E-09): the row moves behind the reader once more, and the body changes nothing.
    await owner.query("UPDATE public.capture_network_config SET camera_subnet = '192.168.50.0/24', revision = revision + 1");
    expect(judged(INSIDE)).toBe('OUTSIDE_CAMERA_SUBNET');
    logFrom = guard.log.text().length;
    const same = await write(technician, { revision: stale + 2, interfaceName: 'eth1' });
    expect([same.statusCode, (same.json() as { revision: number }).revision]).toEqual([200, stale + 2]);
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['ALLOWED from 192.168.50.1', 'OUTSIDE_CAMERA_SUBNET']);
    expect(countOf(logSince(logFrom), NETWORK_FACTS_RELOADED_CODE)).toBe(1);
    // Neither call stored anything or wrote an entry.
    expect(await since(trailFrom)).toEqual([]);
    // A confirmed commit says nothing of a re-load: `committed` handed the same row over, memory was not behind.
    logFrom = guard.log.text().length;
    expect((await write(technician, { revision: stale + 2, aliasMinutes: 41 })).statusCode).toBe(200);
    expect(countOf(logSince(logFrom), NETWORK_FACTS_RELOADED_CODE)).toBe(0);
  });

  it('A RE-LOAD THAT FAILS IS FAIL-CLOSED: the change is stored and answered, the reader goes to NULL (every address refused), ONE line and ONE persistent entry with the named code - and the next call reads the row again', async () => {
    const control = captureNetworkConfigControl(guard.app);
    const revision = await revisionNow();
    const logFrom = guard.log.text().length;
    const persistedBefore = countOf(readFileSync(errorLogFile, 'utf8'), NETWORK_FACTS_RELOAD_FAILED_CODE);
    reads = 0;
    beforeRead = (read) => {
      // The second read of the call: the re-load's, after the unit committed.
      if (read === 2) throw Object.assign(new Error('rowNF: the row cannot be read again'), { code: 'ROWNF_READ' });
    };
    const stored = await write(technician, { revision, aliasMinutes: 42 });
    beforeRead = null;
    expect([stored.statusCode, (stored.json() as { revision: number }).revision]).toEqual([200, revision + 1]);
    expect(await storedRow()).toMatchObject({ alias_minutes: 42, revision: revision + 1 });
    expect([captureNetworkFacts(guard.app)(), control.loaded(), control.storedInterface()]).toEqual([null, false, null]);
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['NOT_CONFIGURED', 'NOT_CONFIGURED']);
    expect(NETWORK_FACTS_RELOAD_FAILED_CODE).toBe('CAPTURE_NETWORK_FACTS_RELOAD_FAILED');
    expect(countOf(logSince(logFrom), NETWORK_FACTS_RELOAD_FAILED_CODE)).toBe(1);
    const persisted = readFileSync(errorLogFile, 'utf8');
    expect(countOf(persisted, NETWORK_FACTS_RELOAD_FAILED_CODE) - persistedBefore).toBe(1);
    expect(persisted).toContain('captureNetworkConfig.reload');
    // The way out is the next call of operation 102, whatever it is: here a body that changes nothing.
    expect((await write(technician, { revision: revision + 1 })).statusCode).toBe(200);
    expect([control.loaded(), judged(INSIDE)]).toEqual([true, 'ALLOWED from 192.168.50.1']);
  });

  it('(c) THE TABLE EMPTIED BEHIND THE READER (what a demo reset does to it): `reload()` of the control is the door - after it the reader answers "not configured", as the read does', async () => {
    const control = captureNetworkConfigControl(guard.app);
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
    await owner.query('DELETE FROM public.capture_network_config');
    // STATED, NOT HIDDEN: nobody told the reader. This is the state between a reset's commit and its call of the door.
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
    await expect(control.reload()).resolves.toBeUndefined();
    expect([captureNetworkFacts(guard.app)(), control.loaded(), judged(INSIDE)]).toEqual([null, true, 'NOT_CONFIGURED']);
    expect((await read(technician)).json()).toMatchObject({ configured: false, revision: 1, interfaceName: null, cameraSubnet: null });
    // The first change after it inserts the row again, at revision 2.
    const again = await write(technician, { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' });
    expect([again.statusCode, (again.json() as { revision: number }).revision]).toEqual([200, 2]);
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
  });

  // SEEN RED on the mutation `if (turn !== control.turn) return;` removed from `reload` (index.ts): the slow re-load then
  // puts the row it read BEFORE the commit over the committed one.
  it('A RE-LOAD OVERTAKEN BY A COMMIT CHANGES NOTHING: a slow read that began before a change committed does not put the older row back', async () => {
    const control = captureNetworkConfigControl(guard.app);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    reads = 0;
    // The FIRST read from here on is the slow one: it has read the row (subnet 50) and waits before it answers.
    afterRead = async (read) => {
      if (read === 1) await held;
    };
    const slow = control.reload();
    const moved = await write(technician, { revision: 2, cameraSubnet: '192.168.60.0/24' });
    expect([moved.statusCode, reads]).toEqual([200, 3]);
    expect(judged(INSIDE)).toBe('OUTSIDE_CAMERA_SUBNET');
    release();
    await slow;
    afterRead = null;
    expect([judged(INSIDE), judged(OUTSIDE)]).toEqual(['OUTSIDE_CAMERA_SUBNET', 'NO_CAMERA_SOURCE']);
    expect((await write(technician, { revision: 3, cameraSubnet: '192.168.50.0/24' })).statusCode).toBe(200);
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
  });
});

// Row V7b (findings F-4 and S2-02; decisions C114, C116, C127): the seventh setting and the widened name form, on the
// table of schema version 14 as `dems_app`, through the committed hand-over and NF's re-load.
describe('row V7b: the allowed ONVIF ports and the widened interface name, stored and read, and the rule judging by the STORED list', () => {
  /** The whole chain of a dial: the camera adapter's stored-address judgement on the rule bound to the BOOTED reader. */
  const dial = (address: string): unknown => judgeStoredCamera(storedCameraCandidate({ adapterKind: CaptureAdapterKind.ONVIF_RTSP, address }), storedCameraAddressRuleOf(captureNetworkFacts(guard.app)));
  const portsRow = async (): Promise<unknown> => ((await owner.query('SELECT onvif_ports FROM public.capture_network_config')).rows[0] as { onvif_ports: unknown } | undefined)?.onvif_ports;

  it('ONE pattern: the contract\'s interface-name constant is the text of the table\'s CHECK, character for character', async () => {
    const { rows } = await owner.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'capture_network_config_interface_name_check'");
    expect(rows.length).toBe(1);
    expect((rows[0] as { definition: string }).definition).toContain(`'${CAPTURE_INTERFACE_NAME_PATTERN.source}'`);
  });

  it('the list is read as stored ([80] by the column\'s default), replaced whole and in order, named in ONE entry with its count, and the rule judges every dial by it at once - no restart', async () => {
    const before = (await read(technician)).json() as { revision: number; onvifPorts: number[] };
    expect([before.onvifPorts, await portsRow()]).toEqual([[80], [80]]);
    expect(dial(INSIDE)).toEqual({ allowed: true, sourceAddress: '192.168.50.1' });
    const from = (await trail()).length;

    // [8080]: a camera stored without a port is dialled on 80, which is no longer listed (C127 / S-04).
    const only8080 = await write(technician, { revision: before.revision, onvifPorts: [8080] });
    expect([only8080.statusCode, (only8080.json() as { onvifPorts: number[] }).onvifPorts]).toEqual([200, [8080]]);
    expect(validateCoreApiResponse('updateCaptureNetworkConfig', 200, only8080.json())).toMatchObject({ ok: true });
    expect(await portsRow()).toEqual([8080]);
    expect([dial(INSIDE), dial(`${INSIDE}:8080`), dial(`${INSIDE}:80`)]).toEqual([
      { allowed: false, refusal: 'PORT_NOT_LISTED' },
      { allowed: true, sourceAddress: '192.168.50.1' },
      { allowed: false, refusal: 'PORT_NOT_LISTED' },
    ]);
    // [8080, 80], in that order: both admitted; the read answers the order written.
    expect((await write(technician, { revision: before.revision + 1, onvifPorts: [8080, 80] })).statusCode).toBe(200);
    expect([(await read(technician)).json().onvifPorts, await portsRow(), dial(INSIDE), dial(`${INSIDE}:8080`)]).toEqual([[8080, 80], [8080, 80], { allowed: true, sourceAddress: '192.168.50.1' }, { allowed: true, sourceAddress: '192.168.50.1' }]);
    // Back to [80], the state the later blocks of this file take.
    expect((await write(technician, { revision: before.revision + 2, onvifPorts: [80] })).statusCode).toBe(200);
    expect([dial(INSIDE), dial(`${INSIDE}:8080`)]).toEqual([{ allowed: true, sourceAddress: '192.168.50.1' }, { allowed: false, refusal: 'PORT_NOT_LISTED' }]);

    const rows = await since(from);
    expect(rows.map((row) => row.details)).toEqual([2, 3, 4].map((step, index) => ({ changedFields: 'onvifPorts', revision: before.revision + step - 1, onvifPortCount: [1, 2, 1][index], operationId: 'updateCaptureNetworkConfig', permission: 'CAPTURE_COMMISSION' })));
    expect(JSON.stringify(rows.map((row) => row.details))).not.toContain('8080');
  });

  it('a list outside the two CHECKs is refused by the schema (422 INVALID_INPUT) and never reaches the table; nothing stored, no entry', async () => {
    const before = await storedRow();
    const ports = await portsRow();
    const from = (await trail()).length;
    const revision = before!['revision'] as number;
    for (const onvifPorts of [[], [80, 80], [0], [65536], [1, 2, 3, 4, 5, 6, 7, 8, 9], ['80'], [80.5], null]) {
      const response = await write(technician, { revision, onvifPorts });
      expect([response.statusCode, errorOf(response).code], JSON.stringify(onvifPorts)).toEqual([422, 'INVALID_INPUT']);
    }
    expect([await storedRow(), await portsRow(), await since(from)]).toEqual([before, ports, []]);
  });

  it('F-4: an interface whose name holds capitals is stored (the table\'s CHECK of version 14 admits it) and read back; the reader judges on it', async () => {
    const control = captureNetworkConfigControl(guard.app);
    control.replaceForTest({ interfaces: () => HOST.map((entry) => (entry.name === 'eth1' ? { ...entry, name: 'enP3s0_Cam' } : entry)) });
    const revision = (await storedRow())!['revision'] as number;
    const response = await write(technician, { revision, interfaceName: 'enP3s0_Cam' });
    expect([response.statusCode, (response.json() as { interfaceName: string }).interfaceName]).toEqual([200, 'enP3s0_Cam']);
    expect((await storedRow())!['interface_name']).toBe('enP3s0_Cam');
    expect([control.storedInterface(), judged(INSIDE)]).toEqual(['enP3s0_Cam', 'ALLOWED from 192.168.50.1']);
    // Back to the host and the name of this file.
    control.replaceForTest({ interfaces: () => HOST });
    expect((await write(technician, { revision: revision + 1, interfaceName: 'eth1' })).statusCode).toBe(200);
    expect(judged(INSIDE)).toBe('ALLOWED from 192.168.50.1');
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
