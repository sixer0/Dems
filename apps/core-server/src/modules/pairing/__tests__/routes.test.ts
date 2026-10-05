// The routes of the pairing module against the contract registry (plan row W32; module gate
// MODG; spec §7.7 operations 15 to 23). In-process, no database: the route table of the real app
// factory, the real stages 5 and 6, a stand-in at stage 4, and a pool that a test makes answer
// or fail. The allowed call of every operation that changes state is in the database tests.
import {
  CORE_API_OPERATIONS,
  CoreApiAccessKind,
  CoreApiTag,
  PAIRING_OPERATIONS,
  matchCoreApiOperation,
  validateCoreApiResponse,
} from '@dems/shared/api';
import { ROLE_PERMISSIONS, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, RouteOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import type { Principal } from '../../../plugins/authenticate';
import { standInDatabase } from '../../../../test/support/core';
import { captureLog, createFakePool, credentialLeaks, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { permissionGuard } from '../../../plugins/permission-guard';
import { PAIRING_OPERATION_IDS, pairingControl } from '../index';
import { FIND_DEVICE, FIND_DEVICE_BY_CREDENTIAL, MARK_DEVICE_SEEN, PROMOTE_CREDENTIAL, READ_ACTIVE_CODE, READ_CORE_IDENTITY, READ_REGISTRATION, READ_REGISTRY } from '../store';

const PAIRING = '/api/v1/pairing';
const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

interface Built {
  readonly app: FastifyInstance;
  readonly registered: RouteOptions[];
  readonly log: CapturedLog;
  readonly queries: string[];
  actAs(principal: Principal): void;
}

type Answer = (text: string) => unknown[] | Error;

/** The real app; the pool answers each statement text with rows, or fails it. */
async function build(answer: Answer = () => []): Promise<Built> {
  const log = captureLog();
  const fake = createFakePool(async (text) => {
    const outcome = answer(text);
    if (outcome instanceof Error) throw outcome;
    return { rows: outcome, rowCount: outcome.length };
  });
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream });
  apps.push(app);
  const registered: RouteOptions[] = [];
  // Before the units load: every route they add is seen.
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
  // Stage 4 as a stand-in; stages 5 and 6 are the real ones.
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  return { app, registered, log, queries: fake.queries, actAs: (principal) => void (current = principal) };
}

const operator = (role: OperatorRole, deviceId: string | null = null): Principal => ({
  kind: 'OPERATOR',
  operatorId: 'OPR-002',
  sessionId: 'session',
  deviceId,
  role,
  permissions: ROLE_PERMISSIONS[role],
});
const device: Principal = { kind: 'DEVICE', deviceId: 'DEV-0001' };
const mine = (route: RouteOptions): boolean => route.url.startsWith(PAIRING);
const signature = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;
const outcome = (response: { statusCode: number; json: () => unknown }): [number, string] => [
  response.statusCode,
  (response.json() as { error: { code: string } }).error.code,
];

/** Method and URL of each operation, with a path ID where the registry has one. */
const CALLS: ReadonlyArray<readonly [operationId: string, method: 'GET' | 'POST', url: string]> = [
  ['issuePairingCode', 'POST', `${PAIRING}/code`],
  ['getPairingCodeStatus', 'GET', `${PAIRING}/code`],
  ['cancelPairingCode', 'POST', `${PAIRING}/code/cancel`],
  ['redeemPairingCode', 'POST', `${PAIRING}/redeem`],
  ['listPairedDevices', 'GET', `${PAIRING}/devices`],
  ['revokeDevice', 'POST', `${PAIRING}/devices/DEV-0001/revoke`],
  ['getDeviceRegistration', 'GET', `${PAIRING}/device`],
  ['unpairDevice', 'POST', `${PAIRING}/device/unpair`],
  ['rotateDeviceCredential', 'POST', `${PAIRING}/device/credential`],
];
const PORTAL = ['issuePairingCode', 'getPairingCodeStatus', 'cancelPairingCode', 'listPairedDevices', 'revokeDevice'];
const DEVICE_ONLY = ['getDeviceRegistration', 'unpairDevice', 'rotateDeviceCredential'];

describe('MODG: the route list of the module equals the registry operations it owns', () => {
  it('registers operations 15 to 23 with the method, the path and the operation ID of the registry, and nothing else under /api/v1/pairing', async () => {
    const { registered } = await build();
    const fromRegistry = PAIRING_OPERATIONS.map((operation) => `${signature(operation.method, operation.path)} ${operation.operationId}`);
    const fromModule = registered
      .filter(mine)
      // The router's form of a path parameter is `:id`; the registry's is `{id}`.
      .map((route) => `${signature(String(route.method), route.url.replace(':id', '{id}'))} ${String(route.config?.operationId)}`);

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toHaveLength(9);
    expect(PAIRING_OPERATIONS.map((operation) => operation.operationId)).toEqual([...PAIRING_OPERATION_IDS]);
    console.info(`[w32] MODG routes of src/modules/pairing:\n  ${fromModule.join('\n  ')}`);
    console.info(`[w32] MODG registry, operations 15 to 23:\n  ${fromRegistry.join('\n  ')}`);
    for (const route of registered.filter(mine)) {
      expect(matchCoreApiOperation(String(route.method), route.url.replace(':id', 'DEV-0001'))?.operation.operationId).toBe(route.config?.operationId);
    }
  });

  it('the area is the module\'s whole: nine operations, numbered 15 to 23 in the registry', () => {
    const area = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.PAIRING).map((operation) => operation.operationId);
    expect(area).toEqual([...PAIRING_OPERATION_IDS]);
    const numberOf = (operationId: string): number =>
      Number(/operation (\d+)/.exec(CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId)?.source ?? '')?.[1]);
    expect(area.map(numberOf)).toEqual([15, 16, 17, 18, 19, 20, 21, 22, 23]);
  });

  it('the rule the guard applies to each route is the registry\'s: PAIRING_MANAGE for the portal, PUBLIC for the redeem, DEVICE for a device\'s own operations', async () => {
    const { app } = await build();
    const rules = new Map(permissionGuard(app).registeredRules().map((rule) => [rule.operationId, rule]));
    for (const operationId of PORTAL) expect(rules.get(operationId), operationId).toMatchObject({ kind: CoreApiAccessKind.PERMISSION, permissions: ['PAIRING_MANAGE'], conditions: [] });
    expect(rules.get('redeemPairingCode')).toMatchObject({ kind: CoreApiAccessKind.PUBLIC, permissions: [], conditions: [], denial: null });
    // By design (finding CPS1-3, decision D113): operation 23 also needs the device's own credential.
    for (const operationId of DEVICE_ONLY) {
      expect(rules.get(operationId), operationId).toMatchObject({ kind: CoreApiAccessKind.DEVICE, permissions: [], conditions: operationId === 'rotateDeviceCredential' ? ['DEVICE_CREDENTIAL'] : [] });
    }
    expect(rules.get('revokeDevice')?.url).toBe(`${PAIRING}/devices/:id/revoke`);
  });

  it('no route carries a check of its own: no hook beside the stage hook; only the revoke attaches its validation, to answer INVALID_REASON', async () => {
    const { registered } = await build();
    for (const route of registered.filter(mine)) {
      const name = String(route.config?.operationId);
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization'] as const) expect(route[hook], `${name} ${hook}`).toBeUndefined();
      expect(route.attachValidation === true, name).toBe(name === 'revokeDevice');
    }
  });
});

describe('who may call is stage 6: one refused call per operation, before the body is read and without the database', () => {
  it('nobody without a principal: 401 on eight operations; the redeem is PUBLIC and reaches its handler', async () => {
    const built = await build();
    for (const [operationId, method, url] of CALLS) {
      if (operationId === 'redeemPairingCode') continue;
      // A body that would not validate: the refusal comes first.
      const response = await built.app.inject({ method, url, ...(method === 'POST' ? { payload: { reason: 1, code: 'x' } } : {}) });
      expect(outcome(response), operationId).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(operationId, 401, response.json()), operationId).toEqual({ ok: true });
    }
    expect(built.queries).toEqual([]);
    // PUBLIC: stage 6 lets it through, and stage 7 judges the body (422, no query, no attempt).
    const redeem = await built.app.inject({ method: 'POST', url: `${PAIRING}/redeem`, payload: { code: 'x' } });
    expect(outcome(redeem)).toEqual([422, 'INVALID_INPUT']);
    expect(await pairingControl(built.app).lock.status(0)).toMatchObject({ attemptsRemaining: 3 });
    expect(built.queries).toEqual([]);
  });

  it('a paired device without an operator: 401 on the five portal operations; it reaches its own three', async () => {
    const built = await build((text) => (text === READ_REGISTRATION ? [] : []));
    built.actAs(device);
    for (const [operationId, method, url] of CALLS.filter(([id]) => PORTAL.includes(id))) {
      expect(outcome(await built.app.inject({ method, url })), operationId).toEqual([401, 'NOT_SIGNED_IN']);
    }
    expect(built.queries).toEqual([]);
    // Its own registration is read (and, the registry holding no such row here, it is told that it is no device any more).
    const own = await built.app.inject({ method: 'GET', url: `${PAIRING}/device` });
    expect(outcome(own)).toEqual([403, 'DEVICE_REVOKED']);
    expect(built.queries).toEqual([READ_REGISTRATION, READ_CORE_IDENTITY]);
  });

  it('an operator on the web console: 403 DEVICE_NOT_PAIRED on the three device operations, whatever the role, and no query', async () => {
    const built = await build();
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      built.actAs(operator(role));
      for (const [operationId, method, url] of CALLS.filter(([id]) => DEVICE_ONLY.includes(id))) {
        expect(outcome(await built.app.inject({ method, url })), `${role} ${operationId}`).toEqual([403, 'DEVICE_NOT_PAIRED']);
      }
    }
    expect(built.queries).toEqual([]);
  });

  it('only SUPERVISOR holds PAIRING_MANAGE in the shared matrix', () => {
    expect(Object.entries(ROLE_PERMISSIONS).filter(([, permissions]) => (permissions as readonly string[]).includes('PAIRING_MANAGE')).map(([role]) => role)).toEqual(['SUPERVISOR']);
  });
});

describe('the reads, with a pool that answers', () => {
  const NOW_LIKE = '4102444800000';
  const registryRow = (id: string, state: string, more: Record<string, unknown> = {}) => ({
    id,
    name: `Tablet ${id}`,
    platform: 'android',
    app_version: '0.2.0',
    state,
    paired_at: '1000',
    paired_with_code_id: 'PCD-000001',
    code_issued_by: 'OPR-002',
    last_seen_at: '2000',
    signed_in_operator_id: null,
    rotated_at: null,
    revoked_at: null,
    revoked_by_operator_id: null,
    revoke_reason: null,
    unpaired_at: null,
    ...more,
  });

  it('16 getPairingCodeStatus: the active code without the code; attemptsRemaining is 5 minus the failed redeems; null when none is active', async () => {
    let rows: unknown[] = [{ id: 'PCD-000007', issued_by_operator_id: 'OPR-002', issued_at: '1000', expires_at: NOW_LIKE, failed_attempts: 2 }];
    const built = await build((text) => (text === READ_ACTIVE_CODE ? rows : []));
    built.actAs(operator('SUPERVISOR'));
    const active = await built.app.inject({ method: 'GET', url: `${PAIRING}/code` });
    expect(active.statusCode).toBe(200);
    expect(active.json()).toEqual({ active: { codeId: 'PCD-000007', issuedBy: 'OPR-002', issuedAt: 1000, expiresAt: Number(NOW_LIKE), attemptsRemaining: 3 } });
    expect(validateCoreApiResponse('getPairingCodeStatus', 200, active.json())).toEqual({ ok: true });
    rows = [];
    expect((await built.app.inject({ method: 'GET', url: `${PAIRING}/code` })).json()).toEqual({ active: null });
    // One read per call, on the pool, and nothing else.
    expect(built.queries).toEqual([READ_ACTIVE_CODE, READ_ACTIVE_CODE]);
  });

  it('19 listPairedDevices: the rows in the contract shape; online only for a PAIRED device with an open socket', async () => {
    const built = await build((text) =>
      text === READ_REGISTRY
        ? [
            registryRow('DEV-0002', 'PAIRED', { signed_in_operator_id: 'OPR-001', rotated_at: '1500' }),
            registryRow('DEV-0001', 'REVOKED', { revoked_at: '3000', revoked_by_operator_id: 'OPR-002', revoke_reason: 'Lost in transit' }),
          ]
        : [],
    );
    built.actAs(operator('SUPERVISOR'));
    const { presence } = pairingControl(built.app);
    presence.socketOpened('DEV-0002');
    presence.socketOpened('DEV-0001'); // a counter that was never cleared: a retired device is not online all the same

    const response = await built.app.inject({ method: 'GET', url: `${PAIRING}/devices` });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('listPairedDevices', 200, response.json())).toEqual({ ok: true });
    const { devices } = response.json() as { devices: Array<Record<string, unknown>> };
    expect(devices.map((entry) => [entry['id'], entry['state'], entry['online'], entry['signedInOperatorId'], entry['credentialRotatedAt']])).toEqual([
      ['DEV-0002', 'PAIRED', true, 'OPR-001', 1500],
      ['DEV-0001', 'REVOKED', false, null, null],
    ]);
    expect(Object.keys(devices[0] ?? {}).sort()).toEqual([
      'appVersion',
      'codeIssuedBy',
      'credentialRotatedAt',
      'id',
      'lastSeenAt',
      'name',
      'online',
      'pairedAt',
      'pairedWithCodeId',
      'platform',
      'revokeReason',
      'revokedAt',
      'revokedBy',
      'signedInOperatorId',
      'state',
      'unpairedAt',
    ]);
  });

  it('21 getDeviceRegistration: the device of the principal, through its credential or through an operator\'s session on it', async () => {
    const built = await build((text) => {
      if (text === READ_REGISTRATION) return [{ id: 'DEV-0001', name: 'Interview tablet 01', state: 'PAIRED', paired_at: '1000', rotated_at: '1500' }];
      if (text === READ_CORE_IDENTITY) return [{ id: 'DEMS-IR-01', name: 'Interview Room 1', certificate_fingerprint: '76:0B' }];
      return [];
    });
    for (const principal of [device, operator('INVESTIGATOR', 'DEV-0001')]) {
      built.actAs(principal);
      const response = await built.app.inject({ method: 'GET', url: `${PAIRING}/device` });
      expect(response.statusCode).toBe(200);
      expect(validateCoreApiResponse('getDeviceRegistration', 200, response.json())).toEqual({ ok: true });
      expect(response.json()).toEqual({
        deviceId: 'DEV-0001',
        name: 'Interview tablet 01',
        state: 'PAIRED',
        pairedAt: 1000,
        credentialRotatedAt: 1500,
        core: { deviceId: 'DEMS-IR-01', name: 'Interview Room 1', certificateFingerprint: '76:0B' },
      });
    }
  });

  it('a stored value outside the contract never leaves the server: the response schema refuses the answer (500)', async () => {
    const built = await build((text) => (text === READ_REGISTRY ? [registryRow('DEV-0001', 'LOST-w32-marker')] : []));
    built.actAs(operator('SUPERVISOR'));
    const response = await built.app.inject({ method: 'GET', url: `${PAIRING}/devices` });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('LOST-w32-marker');
  });

  it('a read that fails answers 503 NOT_READY; the error is logged as { err } with its code, and nothing of its message or its parameters reaches the log or the answer', async () => {
    const marker = 'MARK-w32-statement-text';
    const parameter = `dvc_${'P'.repeat(43)}`;
    // As the driver and the query builder throw: the message quotes the statement, and the
    // parameters ride on the error as enumerable members.
    const failure = (): Error => Object.assign(new Error(`Failed query: select ${marker} params: ${parameter}`), { code: '42P01', query: `select ${marker}`, params: [parameter], detail: parameter });
    const built = await build((text) => (text === READ_REGISTRY || text === READ_ACTIVE_CODE || text === FIND_DEVICE ? failure() : []));
    built.actAs(operator('SUPERVISOR'));
    for (const url of [`${PAIRING}/devices`, `${PAIRING}/code`]) {
      const response = await built.app.inject({ method: 'GET', url });
      expect(outcome(response)).toEqual([503, 'NOT_READY']);
      expect(response.body).not.toContain(marker);
    }
    // The resolver's read fails the same way.
    await expect(built.app.deviceResolver.resolveDevice('DEV-0001')).rejects.toMatchObject({ statusCode: 503, code: 'NOT_READY' });

    const lines = built.log.lines().filter((entry) => entry['msg'] === 'a read on the pool failed');
    expect(lines.map((line) => [line['level'], line['source']])).toEqual([
      [50, 'pairing.listPairedDevices'],
      [50, 'pairing.getPairingCodeStatus'],
      [50, 'pairing.resolveDevice'],
    ]);
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(['err', 'hostname', 'level', 'msg', 'pid', 'source', 'time']);
      expect(line['err']).toMatchObject({ type: 'Error', code: '42P01', message: '42P01' });
      expect(Object.keys(line['err'] as object).sort()).toEqual(['code', 'message', 'stack', 'type']);
    }
    const text = built.log.text();
    expect(text).not.toContain(marker);
    expect(text).not.toContain(parameter);
    expect(credentialLeaks(text)).toEqual([]);
  });
});

describe('the device resolver without a database', () => {
  it('a value that has not the form of its kind is answered without a query; a value that has it is looked up by a hash, never by itself', async () => {
    const seen: string[] = [];
    const built = await build((text) => {
      seen.push(text);
      return [];
    });
    const resolver = built.app.deviceResolver;
    for (const value of ['', 'dvc_unknown', `bio_${'A'.repeat(43)}`, `ses_${'A'.repeat(43)}`, `dvc_${'A'.repeat(42)}`, `dvc_${'A'.repeat(43)} `]) {
      expect(await resolver.resolveCredential(value), JSON.stringify(value.length)).toBeNull();
    }
    for (const value of ['', 'DEV-1', 'dev-0001', 'DEV-0001 ', 'PCD-000001']) expect(await resolver.resolveDevice(value)).toBeNull();
    expect(seen).toEqual([]);

    expect(await resolver.resolveCredential(`dvc_${'A'.repeat(43)}`)).toBeNull();
    expect(await resolver.resolveDevice('DEV-0001')).toBeNull();
    expect(seen).toEqual([FIND_DEVICE_BY_CREDENTIAL, FIND_DEVICE]);
  });

  it('fails closed: a credential that is still the pending one after its promotion ran resolves to nothing', async () => {
    // A pool whose lookup always says "pending" and whose units change nothing: the promotion
    // statement returns no row, and the second lookup finds the credential pending still.
    const standIn = standInDatabase();
    const lookups: string[] = [];
    const pool = Object.assign(standIn.pool, {
      query: async (text: string) => {
        lookups.push(text);
        const rows = text === FIND_DEVICE_BY_CREDENTIAL ? [{ device_id: 'DEV-0001', state: 'PAIRED', last_seen_at: '0', pending: true }] : [];
        return { rows, rowCount: rows.length, command: 'SELECT', fields: [], oid: 0 };
      },
    });
    const app = buildApp({ config: unitTestConfig(), createPool: () => pool });
    apps.push(app);
    await app.ready();

    expect(await app.deviceResolver.resolveCredential(`dvc_${'B'.repeat(43)}`)).toBeNull();
    // The lookup, the promoting unit, the lookup again: and no "last seen" for a credential that did not resolve.
    expect(lookups.filter((text) => text === FIND_DEVICE_BY_CREDENTIAL)).toHaveLength(2);
    expect(standIn.statements.filter((text) => text === PROMOTE_CREDENTIAL)).toHaveLength(1);
    expect(standIn.statements.filter((text) => text === MARK_DEVICE_SEEN)).toEqual([]);
  });
});
