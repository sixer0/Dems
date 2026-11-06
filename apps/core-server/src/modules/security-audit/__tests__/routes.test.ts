// The routes of the security-audit module against the contract registry, and what each handler
// does with what the engine host and the pool give it (plan row W39; module gate MODG; spec
// §7.2, §7.3, §7.13; SR-64; decision D83 rules M2 to M4, M7, M8).
//
// In-process, no database: the real app factory with the REAL stages 2, 3, 5 and 6. Stage 4 is a
// stand-in that gives the request the principal a test names (rule M9), the seam `engine` is a
// stub that records what a handler hands it, and the pool refuses every connection. What the
// reads and the hosted actions do against PostgreSQL is in the `*.db.test.ts` files.
import {
  CORE_API_OPERATIONS,
  CoreApiAccessKind,
  CoreApiTag,
  EPOCH_HEADER_NAME,
  REVISION_HEADER_NAME,
  findCoreApiOperation,
  matchCoreApiOperation,
  simActionsOfOperation,
  validateCoreApiResponse,
} from '@dems/shared/api';
import { GENESIS_HASH, ROLE_PERMISSIONS, appendAudit, createIdleState, type AuditInput, type AuditLogSlice, type AuditRow, type ExportResult, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse, RouteOptions } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../app';
import { PipelineFailure, PipelineRefusal } from '../../../core';
import type { EngineHost } from '../../../engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { notReady } from '../../../plugins/error-envelope';
import type { ErrorLogEntry } from '../../../plugins/logger';
import { permissionGuard, routePatternOf } from '../../../plugins/permission-guard';
import { NO_REASON } from '../export-request';
import { SECURITY_AUDIT_MODULE_OPERATIONS, evidenceVerificationCountsOf, securityAuditControl } from '../index';
import { AUDIT, AUDIT_CHAIN, AUDIT_EXPORT, EVENTS, LOGS_EXPORT, SECURITY_STATUS, WEB_ORIGIN, errorOf, outcomeOf } from './support';

const EPOCH = 7;
const REVISION = 42;
const NOW = Date.UTC(2026, 9, 1, 3, 0, 0);
const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

interface EngineCall {
  readonly principal: Principal;
  readonly action: string;
  readonly args: readonly unknown[];
}

interface Built {
  readonly app: FastifyInstance;
  readonly registered: RouteOptions[];
  readonly log: CapturedLog;
  /** Every call a handler made on the engine host, in order. */
  readonly calls: EngineCall[];
  /** Which slices a handler read from the engine host. */
  readonly slices: string[];
  /** How often a read reached the pool. */
  readonly connects: () => number;
  /** The entries of the persistent error log that name this module as their source. */
  readonly persisted: ErrorLogEntry[];
  actAs(principal: Principal): void;
  /** What the next commands answer: a value, or a function that returns or throws. */
  engineAnswers(answer: unknown | ((call: EngineCall) => unknown)): void;
  /** The committed audit ring the stub hands out. */
  ring(rows: readonly AuditRow[]): void;
  get(url: string): Promise<LightMyRequestResponse>;
  post(url: string, payload?: InjectOptions['payload'], headers?: Record<string, string>): Promise<LightMyRequestResponse>;
}

const MARKER = 'MARK-w39-driver-text';

/** The real app; the pool refuses every connection; the engine is a stub. */
async function build(): Promise<Built> {
  const log = captureLog();
  let connects = 0;
  const failure = Object.assign(new Error(`connect refused ${MARKER}`), { code: 'ECONNREFUSED' });
  const pool = {
    connect: async () => {
      connects += 1;
      throw failure;
    },
    query: async (statement: string | { text: string }) => {
      if ((typeof statement === 'string' ? statement : statement.text) !== 'SELECT 1') connects += 1;
      throw failure;
    },
    on: () => pool,
    end: async () => {},
  };
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => pool as unknown as Pool, logStream: log.stream });
  apps.push(app);
  const registered: RouteOptions[] = [];
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);

  const calls: EngineCall[] = [];
  const slices: string[] = [];
  let answer: unknown | ((call: EngineCall) => unknown) = undefined;
  let audit: AuditLogSlice = { rows: [], head: GENESIS_HASH, total: 0, dropped: 0 };
  const state = createIdleState({ now: NOW, seed: 20_261_001 });
  const engine = {
    epoch: EPOCH,
    revision: REVISION,
    running: true,
    async command(principal: Principal, action: string, ...args: unknown[]) {
      const call = { principal, action, args };
      calls.push(call);
      const value: unknown = typeof answer === 'function' ? (answer as (call: EngineCall) => unknown)(call) : answer;
      return { value, epoch: EPOCH, revision: REVISION };
    },
    slice(name: string) {
      slices.push(name);
      return name === 'audit' ? audit : (state as unknown as Record<string, unknown>)[name];
    },
  };
  app.seams.replace('engine', engine as unknown as EngineHost);

  const persisted: ErrorLogEntry[] = [];
  vi.spyOn(app.errorLog, 'append').mockImplementation((entry) => {
    if (entry.source.startsWith('securityAudit.')) persisted.push(entry);
  });

  return {
    app,
    registered,
    log,
    calls,
    slices,
    connects: () => connects,
    persisted,
    actAs: (principal) => void (current = principal),
    engineAnswers: (next) => void (answer = next),
    ring: (rows) => {
      const last = rows.at(-1);
      audit = { rows: [...rows], head: last?.hash ?? GENESIS_HASH, total: last?.seq ?? 0, dropped: (rows[0]?.seq ?? 1) - 1 };
    },
    get: (url) => app.inject({ method: 'GET', url }),
    post: (url, payload, headers = {}) => app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...headers }, ...(payload === undefined ? {} : { payload }) }),
  };
}

const operator = (role: OperatorRole): Extract<Principal, { kind: 'OPERATOR' }> => ({
  kind: 'OPERATOR',
  operatorId: role === 'SUPERVISOR' ? 'OPR-002' : role === 'INVESTIGATOR' ? 'OPR-001' : 'OPR-003',
  sessionId: 'session',
  deviceId: null,
  role,
  permissions: ROLE_PERMISSIONS[role],
});

/** A chain of audit rows built by the shared code, continuing a chain of `before` rows. */
function ringOf(inputs: readonly AuditInput[], before = 4_100): AuditRow[] {
  let log: AuditLogSlice = { rows: [], head: 'c'.repeat(64), total: before, dropped: before };
  return inputs.map((input) => {
    const appended = appendAudit(log, input, NOW, 1);
    log = appended.log;
    return appended.row;
  });
}

const exported = (exportId: string, more: Record<string, string | number | boolean> = {}): AuditInput => ({
  type: 'AUDIT_EXPORTED',
  message: 'Audit log exported (1000 rows)',
  actorId: 'OPR-002',
  details: { exportId, rows: 1_000, head: 'f'.repeat(64), chainOk: true, eventKind: 'EXPORT', reason: 'Quarterly audit review', destination: 'Audit archive (simulated)', ...more },
});

const ACCEPTED = (exportId: string): ExportResult => ({ ok: true, status: 202, exportId });

const signature = (method: string, path: string, operationId: string): string => `${method.toUpperCase()} ${path} ${operationId}`;
const PREFIXES = ['/api/v1/security', '/api/v1/audit', '/api/v1/logs', '/api/v1/events'];
const isMine = (route: RouteOptions): boolean => PREFIXES.some((prefix) => route.url === prefix || route.url.startsWith(`${prefix}/`));

const REQUESTS: ReadonlyArray<readonly [operationId: string, method: 'GET' | 'POST', url: string]> = [
  ['getSecurityStatus', 'GET', SECURITY_STATUS],
  ['listAuditRows', 'GET', AUDIT],
  ['verifyAuditChain', 'GET', AUDIT_CHAIN],
  ['exportAudit', 'POST', AUDIT_EXPORT],
  ['exportLogs', 'POST', LOGS_EXPORT],
  ['listEvents', 'GET', EVENTS],
];

describe('MODG: the route list of the module equals the registry operations it owns', () => {
  it('registers operations 58 to 63 with the method, the path and the operation ID of the registry, and nothing else under its four path prefixes', async () => {
    const { registered } = await build();
    const fromRegistry = SECURITY_AUDIT_MODULE_OPERATIONS.map((operationId) => {
      const operation = findCoreApiOperation(operationId);
      if (operation === undefined) throw new Error(`no operation ${operationId}`);
      return signature(operation.method, routePatternOf(operation.path), operation.operationId);
    });
    const mine = registered.filter(isMine);
    const fromModule = mine.map((route) => signature(String(route.method), route.url, String(route.config?.operationId)));

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'GET /api/v1/security/status getSecurityStatus',
      'GET /api/v1/audit listAuditRows',
      'GET /api/v1/audit/chain verifyAuditChain',
      'POST /api/v1/audit/export exportAudit',
      'POST /api/v1/logs/export exportLogs',
      'GET /api/v1/events listEvents',
    ]);
    console.info(`[w39] MODG routes of src/modules/security-audit: ${fromModule.join(' | ')}`);
    console.info(`[w39] MODG registry, operations 58 to 63:           ${fromRegistry.join(' | ')}`);
    for (const route of mine) {
      expect(matchCoreApiOperation(String(route.method), route.url)?.operation.operationId).toBe(route.config?.operationId);
    }
  });

  it('the area of the registry is these six and no other, numbered 58 to 63; none has a path parameter, and none returns or takes a file', () => {
    const area = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.SECURITY).map((operation) => operation.operationId);
    expect([...area].sort()).toEqual([...SECURITY_AUDIT_MODULE_OPERATIONS].sort());
    const numberOf = (operationId: string): number => Number(/operation (\d+)/.exec(findCoreApiOperation(operationId)?.source ?? '')?.[1]);
    expect(SECURITY_AUDIT_MODULE_OPERATIONS.map(numberOf)).toEqual([58, 59, 60, 61, 62, 63]);
    for (const operationId of area) {
      const operation = findCoreApiOperation(operationId);
      expect(operation?.path).not.toMatch(/\{|media|file|download|upload|package/);
    }
    // The contract says it of both exports in so many words.
    for (const operationId of ['exportAudit', 'exportLogs']) expect(findCoreApiOperation(operationId)?.description).toContain('The answer holds no file.');
  });

  it('the access rule of each route is the registry\'s, as the guard holds it: four reads for every signed-in operator (no permission, so no denial row), AUDIT_EXPORT with EXPORT_DENIED and NOT_PERMITTED for the two exports', async () => {
    const { app } = await build();
    const rules = permissionGuard(app)
      .registeredRules()
      .filter((rule) => (SECURITY_AUDIT_MODULE_OPERATIONS as readonly string[]).includes(rule.operationId));
    expect(rules.map((rule) => [rule.operationId, rule.method, rule.url, rule.kind, rule.permissions, rule.denial?.auditType, rule.denial?.errorCode])).toEqual([
      ['getSecurityStatus', 'GET', '/api/v1/security/status', CoreApiAccessKind.AUTHENTICATED, [], undefined, undefined],
      ['listAuditRows', 'GET', '/api/v1/audit', CoreApiAccessKind.AUTHENTICATED, [], undefined, undefined],
      ['verifyAuditChain', 'GET', '/api/v1/audit/chain', CoreApiAccessKind.AUTHENTICATED, [], undefined, undefined],
      ['exportAudit', 'POST', '/api/v1/audit/export', CoreApiAccessKind.PERMISSION, ['AUDIT_EXPORT'], 'EXPORT_DENIED', 'NOT_PERMITTED'],
      ['exportLogs', 'POST', '/api/v1/logs/export', CoreApiAccessKind.PERMISSION, ['AUDIT_EXPORT'], 'EXPORT_DENIED', 'NOT_PERMITTED'],
      ['listEvents', 'GET', '/api/v1/events', CoreApiAccessKind.AUTHENTICATED, [], undefined, undefined],
    ]);
    expect(permissionGuard(app).routeProblems()).toEqual([]);
  });

  it('no route carries a check of its own: no hook beside the stage hook, and no rule in its configuration (rule M3)', async () => {
    const { registered } = await build();
    const mine = registered.filter(isMine);
    expect(mine).toHaveLength(6);
    for (const route of mine) {
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend'] as const) {
        expect(route[hook], `${String(route.config?.operationId)} ${hook}`).toBeUndefined();
      }
      expect(Object.keys(route.config ?? {}).filter((key) => key !== 'url' && key !== 'method')).toEqual(['operationId']);
    }
  });

  it('three operations are hosted actions of the contract\'s table, and the three reads are none', () => {
    expect(simActionsOfOperation('verifyAuditChain')).toEqual(['verifyAuditChain']);
    expect(simActionsOfOperation('exportAudit')).toEqual(['exportAudit']);
    expect(simActionsOfOperation('exportLogs')).toEqual(['exportLogs']);
    for (const operationId of ['getSecurityStatus', 'listAuditRows', 'listEvents']) expect(simActionsOfOperation(operationId)).toEqual([]);
  });

  it('the module keeps counters of its stored-chain check per app, and an app without the module has none', async () => {
    const { app } = await build();
    expect(securityAuditControl(app).storedChainStats()).toMatchObject({ calls: 0, runs: 0, verifiedThrough: 0, firstBadSeq: null });
    expect(() => securityAuditControl({} as FastifyInstance)).toThrow(/no security-audit module/);
  });
});

describe('who may call is stage 6: a caller without an operator session reaches no handler', () => {
  it.each(REQUESTS)('%s: nobody, and a paired device without an operator, answer 401 NOT_SIGNED_IN; no read and no command runs', async (operationId, method, url) => {
    const built = await build();
    for (const principal of [{ kind: 'ANONYMOUS', retiredDeviceId: null }, { kind: 'DEVICE', deviceId: 'DEV-0001' }] as const) {
      built.actAs(principal);
      const response = method === 'GET' ? await built.get(url) : await built.post(url, { reason: 'A reason of the test' });
      expect(outcomeOf(response)).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(operationId, 401, response.json())).toEqual({ ok: true });
    }
    expect(built.calls).toEqual([]);
    expect(built.slices).toEqual([]);
    expect(built.connects()).toBe(0);
  });

  it('a 401 is decided before the body and the query are read', async () => {
    const built = await build();
    const notJson = await built.app.inject({ method: 'POST', url: AUDIT_EXPORT, headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' }, payload: '{not json' });
    expect(outcomeOf(notJson)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcomeOf(await built.post(LOGS_EXPORT, { reason: 7 }))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcomeOf(await built.get(`${AUDIT}?limit=0`))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcomeOf(await built.get(`${EVENTS}?cursor=x_y`))).toEqual([401, 'NOT_SIGNED_IN']);
  });
});

describe('the two lists: the query (SR-64)', () => {
  const badAudit = ['limit=0', 'limit=201', 'limit=1.5', 'limit=many', 'order=UP', 'order=asc', 'category=NOPE', 'type=NOPE', 'actorId=someone', 'sessionId=x', 'evidenceId=x', 'cursor=', 'cursor=has_underscore', `cursor=${'c'.repeat(129)}`];
  const badEvents = ['limit=0', 'limit=201', 'category=PAIRING', 'type=NOPE', 'severity=LOUD', 'cursor=', 'cursor=has_underscore'];

  it.each(badAudit)('listAuditRows ?%s answers 422 INVALID_INPUT with details.in querystring, before any read', async (query) => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    const response = await built.get(`${AUDIT}?${query}`);
    expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(response).details).toEqual({ in: 'querystring' });
    expect(validateCoreApiResponse('listAuditRows', 422, response.json())).toEqual({ ok: true });
    expect(built.connects()).toBe(0);
  });

  it.each(badEvents)('listEvents ?%s answers 422 INVALID_INPUT with details.in querystring, before any read', async (query) => {
    const built = await build();
    built.actAs(operator('TECHNICIAN'));
    const response = await built.get(`${EVENTS}?${query}`);
    expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(response).details).toEqual({ in: 'querystring' });
    expect(validateCoreApiResponse('listEvents', 422, response.json())).toEqual({ ok: true });
    expect(built.connects()).toBe(0);
  });

  it('a value of the form of a bearer session token is no cursor: the underscore of its prefix is outside the pattern (CL-6a)', async () => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    // Made of fragments and never part of a test name: the form of a token, the value of none.
    const tokenForm = `${['ses', '0'.repeat(43)].join('_')}`;
    for (const url of [AUDIT, EVENTS]) {
      const response = await built.get(`${url}?cursor=${tokenForm}`);
      expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
    }
    expect(built.connects()).toBe(0);
    expect(built.log.text()).not.toContain(tokenForm);
  });

  it.each(['abc', '42', 'AUD-000010', 'AUD-0000010-0123456789abcdef', 'AUD-000010-0123456789ABCDEF', 'LOG-000010-1790823600000'])(
    'a cursor that fits the contract pattern and is none of the audit list (%s) answers the same 422, before any read',
    async (cursor) => {
      const built = await build();
      built.actAs(operator('SUPERVISOR'));
      const response = await built.get(`${AUDIT}?cursor=${cursor}`);
      expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details).toEqual({ in: 'querystring' });
      expect(built.connects()).toBe(0);
    },
  );

  it.each(['abc', '42', 'LOG-000010', 'LOG-0000010-1790823600000', 'LOG-000010-01790823600000', 'AUD-000010-0123456789abcdef'])(
    'a cursor that fits the contract pattern and is none of the events (%s) answers the same 422, before any read',
    async (cursor) => {
      const built = await build();
      built.actAs(operator('SUPERVISOR'));
      const response = await built.get(`${EVENTS}?cursor=${cursor}`);
      expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
      expect(built.connects()).toBe(0);
    },
  );

  it('a query the contract accepts reaches the read, with every member optional and an unknown member dropped', async () => {
    for (const url of [AUDIT, `${AUDIT}?category=AUTH&type=AUTH_SUCCESS&actorId=OPR-001&sessionId=SES-20261001-0024&evidenceId=EV-20260930-0004&order=DESC&limit=200&cursor=AUD-000010-0123456789abcdef&extra=1`, EVENTS, `${EVENTS}?category=EXPORT&type=EXPORT_DENIED&severity=WARNING&limit=1&cursor=LOG-000010-1790823600000&order=DESC`]) {
      // A fresh app each time: a failed read turns readiness off, and stage 2 would answer the next request.
      const built = await build();
      built.actAs(operator('SUPERVISOR'));
      // The pool refuses: the read was reached, and the database's failure is not the caller's.
      expect(outcomeOf(await built.get(url)), url).toEqual([503, 'NOT_READY']);
      expect(built.connects()).toBe(1);
      expect(built.persisted).toHaveLength(1);
    }
  });
});

describe('a read that fails is the server\'s failure: 503 NOT_READY, logged and persisted by its code', () => {
  it.each([
    ['getSecurityStatus', SECURITY_STATUS],
    ['listAuditRows', AUDIT],
    ['verifyAuditChain', AUDIT_CHAIN],
    ['listEvents', EVENTS],
  ] as const)('%s', async (operationId, url) => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    built.engineAnswers({ ok: true, checked: 0, head: GENESIS_HASH });
    const response = await built.get(url);
    expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
    expect(validateCoreApiResponse(operationId, 503, response.json())).toEqual({ ok: true });
    expect(built.persisted.map((entry) => [entry.source, entry.level, entry.code])).toEqual([[`securityAudit.${operationId}`, 'error', 'ECONNREFUSED']]);
    // Neither the answer nor the log nor the persistent entry holds the driver's text.
    expect(response.body).not.toContain(MARKER);
    expect(built.log.text()).not.toContain(MARKER);
    expect(JSON.stringify(built.persisted)).not.toContain(MARKER);
  });

  it('getSecurityStatus reads the slices `security` and `evidence` and nothing else of the engine, and runs no command', async () => {
    const built = await build();
    built.actAs(operator('TECHNICIAN'));
    const response = await built.get(SECURITY_STATUS);
    // Fix wave J (GM-02): `evidence` - the count of items with / without a verification of record is the Core's own.
    expect(built.slices).toEqual(['security', 'evidence']);
    expect(built.calls).toEqual([]);
    // (The stored head is not readable in this bed: the answer itself is held by `reads.db.test.ts`.)
    expect(response.statusCode).toBe(503);
  });

  it('fix wave J (GM-02): the counts are over EVERY item by its verification of record - they add up, and a never-sealed record is no "never verified" item', () => {
    const item = (sealedAt: number | null, status: string) => ({ sealedAt, verification: { status } });
    const items = [item(1, 'PASS'), item(1, 'PASS'), item(1, 'FAIL'), item(1, 'NOT_RUN'), item(1, 'NOT_RUN'), item(1, 'NOT_RUN'), item(null, 'NOT_RUN'), item(null, 'PASS')];
    const counts = evidenceVerificationCountsOf(items);
    expect(counts).toEqual({ sealed: 6, passed: 2, failed: 1, neverVerified: 3 });
    expect(counts.passed + counts.failed + counts.neverVerified).toBe(counts.sealed);
    expect(evidenceVerificationCountsOf([])).toEqual({ sealed: 0, passed: 0, failed: 0, neverVerified: 0 });
    // 1,500 items: the count does not depend on any window of rows (the tile's old number came from the newest 1,000 audit rows).
    const many = Array.from({ length: 1_500 }, (_, index) => item(1, index < 40 ? 'PASS' : 'NOT_RUN'));
    expect(evidenceVerificationCountsOf(many)).toEqual({ sealed: 1_500, passed: 40, failed: 0, neverVerified: 1_460 });
  });

  it('an engine that is not running answers 503 before the table is asked: the status, and the view of the chain', async () => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    built.app.seams.replace('engine', {
      epoch: 0,
      revision: 0,
      running: false,
      command: async () => {
        throw notReady();
      },
      slice: () => {
        throw notReady();
      },
    } as unknown as EngineHost);
    for (const url of [SECURITY_STATUS, AUDIT_CHAIN]) expect(outcomeOf(await built.get(url))).toEqual([503, 'NOT_READY']);
    expect(built.connects()).toBe(0);
  });
});

describe('operation 60 verifyAuditChain: the view is one hosted action under the caller\'s identity', () => {
  it('hands the engine host the request\'s principal WHOLE and the action, with no argument; then asks the table', async () => {
    const built = await build();
    const principal = operator('TECHNICIAN');
    built.actAs(principal);
    built.engineAnswers({ ok: true, checked: 0, head: GENESIS_HASH });
    await built.get(AUDIT_CHAIN);
    expect(built.calls).toHaveLength(1);
    expect(built.calls[0]?.principal).toBe(principal);
    expect([built.calls[0]?.action, built.calls[0]?.args]).toEqual(['verifyAuditChain', []]);
    expect(built.connects()).toBe(1);
    expect(securityAuditControl(built.app).storedChainStats()).toMatchObject({ calls: 1, runs: 1 });
  });

  it('a unit of the view that could not be committed answers 503 and the table is not asked', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(() => {
      throw new PipelineFailure(PipelineRefusal.QUEUE_FULL);
    });
    expect(outcomeOf(await built.get(AUDIT_CHAIN))).toEqual([503, 'NOT_READY']);
    expect(built.connects()).toBe(0);
  });
});

describe.each([
  ['exportAudit', AUDIT_EXPORT, 'AUDIT'],
  ['exportLogs', LOGS_EXPORT, 'LOGS'],
] as const)('operation %s: one hosted action, answered after it resolves', (operationId, url, scope) => {
  it('hands the engine host the principal WHOLE, the action of the operation, and the reason and destination the contract accepted', async () => {
    const built = await build();
    const principal = operator('SUPERVISOR');
    built.actAs(principal);
    built.ring(ringOf([exported('EXP-000032')]));
    built.engineAnswers(ACCEPTED('EXP-000032'));
    const response = await built.post(url, { reason: '  Quarterly audit review  ', destination: ' Audit vault ', operatorId: 'OPR-001', at: 5 });
    expect(response.statusCode).toBe(202);
    expect(built.calls).toHaveLength(1);
    expect(built.calls[0]?.principal).toBe(principal);
    expect(built.calls[0]?.action).toBe(operationId);
    expect(built.calls[0]?.args).toEqual([{ reason: 'Quarterly audit review', destination: 'Audit vault' }]);
    expect(built.connects()).toBe(0);
  });

  it('answers 202 with the scope, the state position of the outcome (API-7), and the chain the export covers: the row\'s sequence minus one and its previous hash', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    const rows = ringOf([exported('EXP-000031'), { type: 'NOTE_ADDED', message: 'a row between', details: {} }, exported('EXP-000032', scope === 'LOGS' ? { scope: 'LOGS', events: 500 } : {}), { type: 'FRAME_HASH', message: 'a later row', details: {} }]);
    built.ring(rows);
    built.engineAnswers(ACCEPTED('EXP-000032'));
    const response = await built.post(url, { reason: 'Quarterly audit review' });
    expect(response.statusCode).toBe(202);
    expect(validateCoreApiResponse(operationId, 202, response.json())).toEqual({ ok: true });
    // The row of THIS export, found by its ID among the newest rows: sequence 4,103.
    expect(response.json()).toEqual({ exportId: 'EXP-000032', scope, rows: 4_102, head: rows[2]?.prevHash });
    expect(rows[2]?.seq).toBe(4_103);
    // Not what the simulator wrote into the row's details: that is the length of its ring.
    expect(response.json().rows).not.toBe(rows[2]?.details['rows']);
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(EPOCH));
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(REVISION));
    expect(built.slices).toEqual(['audit']);
  });

  it.each([
    ['no body', undefined],
    ['an empty object', {}],
    ['a short reason', { reason: 'abcd' }],
    ['three two-unit characters', { reason: '\u{1F600}'.repeat(3) }],
  ])('%s: the action is handed NO_REASON, never the text that was sent, and its refusal answers 422 INVALID_REASON', async (_label, payload) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers({ ok: false, status: 422, reason: 'INVALID_REASON' } satisfies ExportResult);
    const response = await built.post(url, payload as never);
    expect(outcomeOf(response)).toEqual([422, 'INVALID_REASON']);
    expect(validateCoreApiResponse(operationId, 422, response.json())).toEqual({ ok: true });
    expect(errorOf(response)).toMatchObject({ message: 'An export reason of at least 5 characters is required.', details: { simCode: 'REASON_TOO_SHORT' } });
    expect(built.calls[0]?.args[0]).toBe(NO_REASON);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(built.slices).toEqual([]);
  });

  it.each([
    ['a reason that is a number', { reason: 12_345 }],
    ['a reason of 501 code units', { reason: 'r'.repeat(501) }],
    ['a destination of 121 code units', { reason: 'Quarterly audit review', destination: 'd'.repeat(121) }],
    ['a short reason and a destination that is not text', { reason: 'ab', destination: 7 }],
  ])('%s answers 422 INVALID_INPUT and the engine is not asked', async (_label, payload) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    const response = await built.post(url, payload);
    expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(response).details).toEqual({ in: 'body' });
    expect(validateCoreApiResponse(operationId, 422, response.json())).toEqual({ ok: true });
    expect(built.calls).toEqual([]);
  });

  it('a body that is not a JSON object answers 400 INVALID_JSON and the engine is not asked', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    for (const payload of ['[1]', '"text"', '{"reason":']) {
      const response = await built.app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' }, payload });
      expect(outcomeOf(response), payload).toEqual([400, 'INVALID_JSON']);
      expect(validateCoreApiResponse(operationId, 400, response.json())).toEqual({ ok: true });
    }
    expect(built.calls).toEqual([]);
  });

  it('a refusal the simulator reports IN ITS RESULT is answered after the unit: FORBIDDEN as 403 NOT_PERMITTED (RB-5), NOT_SIGNED_IN as 401', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers({ ok: false, status: 403, reason: 'FORBIDDEN' } satisfies ExportResult);
    const forbidden = await built.post(url, { reason: 'Quarterly audit review' });
    expect(outcomeOf(forbidden)).toEqual([403, 'NOT_PERMITTED']);
    expect(validateCoreApiResponse(operationId, 403, forbidden.json())).toEqual({ ok: true });
    expect(errorOf(forbidden).message).toBe('Your role does not allow this action. The attempt was audited.');
    expect(forbidden.headers[REVISION_HEADER_NAME]).toBeUndefined();

    built.engineAnswers({ ok: false, status: 401, reason: 'NOT_SIGNED_IN' } satisfies ExportResult);
    const signedOut = await built.post(url, { reason: 'Quarterly audit review' });
    expect(outcomeOf(signedOut)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse(operationId, 401, signedOut.json())).toEqual({ ok: true });
    // The command resolved both times: the answer came after the unit.
    expect(built.calls).toHaveLength(2);
    expect(built.slices).toEqual([]);
  });

  it('a refusal this action does not have (one of the evidence export) is a defect of the server: 500, no detail', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    for (const result of [
      { ok: false, status: 409, reason: 'SECURITY_FAULT' },
      { ok: false, status: 404, reason: 'NOT_FOUND' },
      { ok: false, status: 409, reason: 'NOT_SEALED' },
    ] satisfies ExportResult[]) {
      built.engineAnswers(result);
      expect(outcomeOf(await built.post(url, { reason: 'Quarterly audit review' })), result.reason).toEqual([500, 'INTERNAL_ERROR']);
    }
  });

  it('a unit that could not be committed answers 503, with no state position', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(() => {
      throw new PipelineFailure(PipelineRefusal.COMMIT_FAILED);
    });
    const response = await built.post(url, { reason: 'Quarterly audit review' });
    expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
  });

  it('an accepted export whose row is not in the committed ring is a defect of the server: 500, no detail', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    // The ring holds a row of ANOTHER export, and a row of another type that names this ID.
    built.ring(ringOf([exported('EXP-000031'), { type: 'EVIDENCE_EXPORTED', message: 'another kind', details: { exportId: 'EXP-000032' } }]));
    built.engineAnswers(ACCEPTED('EXP-000032'));
    const response = await built.post(url, { reason: 'Quarterly audit review' });
    expect(outcomeOf(response)).toEqual([500, 'INTERNAL_ERROR']);
    expect(response.body).not.toContain('EXP-000032');
  });

  it('the POST without the web console Origin is refused by stage 3 before anything else', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    const response = await built.app.inject({ method: 'POST', url, payload: { reason: 'Quarterly audit review' }, headers: { cookie: 'dems_session_4420=x' } });
    expect(outcomeOf(response)).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    expect(built.calls).toEqual([]);
  });
});
