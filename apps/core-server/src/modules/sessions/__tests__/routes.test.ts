// The routes of the sessions module against the contract registry (plan row W34; module gate
// MODG; spec §7.2, §7.3, §7.8, §7.17). In-process, no database: the real app factory and the
// real stages 2, 3, 5, 6 and 7, with the shared simulator itself behind the engine seam
// (`memory-engine.ts`). What PostgreSQL adds is in the `*.db.test.ts` files of this folder.
//
// The file keeps a ledger of every (operation, status) pair an answer of it had. Its last test
// holds the ledger against the registry: every status the contract documents for operations 24
// to 38 was produced here, and every answer validated against the contract.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  CoreApiAccessKind,
  CoreApiTag,
  coreApiAccessPermissions,
  matchCoreApiOperation,
  simActionsOfOperation,
  validateCoreApiResponse,
  type CoreApiSchemaName,
} from '@dems/shared/api';
import type { OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse, RouteOptions } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createHost } from '../../../../test/support/seed';
import { createFakePool } from '../../../../test/support/config';
import { permissionGuard } from '../../../plugins/permission-guard';
import { SESSION_OPERATION_IDS, SESSION_READ_IDS, actionOf, operationOf, sessionUnitLabel, successStatusesOf, type SessionCommandId, type SessionOperationId } from '../index';
import { NOW, unitApp, type MemoryEngine, type UnitApp, type UnitAppOptions } from './memory-engine';
import { CASE_NUMBER, CURRENT, HISTORY, OTHER_SESSION, SESSION, bodyOf, errorOf, on, outcome, sessionInput } from './support';

const scratch = mkdtempSync(join(tmpdir(), 'dems-w34-'));
const apps: UnitApp[] = [];

afterEach(async () => {
  for (const unit of apps.splice(0)) await unit.close();
});
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

async function build(options: UnitAppOptions = {}): Promise<UnitApp> {
  const unit = await unitApp(options);
  apps.push(unit);
  return unit;
}

// ── The ledger ─────────────────────────────────────────────────────────────────────────────────

/** `operationId` → the statuses an answer of this file had, each with the codes it carried. */
const ledger = new Map<string, Map<number, Set<string>>>();

/**
 * Asserts the status and the code of an answer, validates it against the contract and enters it
 * into the ledger. `code` is null for a success.
 */
function check(response: LightMyRequestResponse, operationId: SessionOperationId, status: number, code: string | null = null): LightMyRequestResponse {
  const answered = response.body === '' ? null : ((response.json() as { error?: { code?: string } }).error?.code ?? null);
  expect([response.statusCode, answered], `${operationId}: ${response.body}`).toEqual([status, code]);
  expect(validateCoreApiResponse(operationId, status, bodyOf(response)), `${operationId} ${status}`).toEqual({ ok: true });
  const statuses = ledger.get(operationId) ?? new Map<number, Set<string>>();
  ledger.set(operationId, statuses);
  const codes = statuses.get(status) ?? new Set<string>();
  statuses.set(status, codes);
  codes.add(code ?? 'success');
  return response;
}

// ── Bringing the one session to a state ────────────────────────────────────────────────────────

type Reach = 'IDLE' | 'CREATE' | 'PRECHECK_RUNNING' | 'PRECHECK_WARN' | 'PRECHECK_BLOCK' | 'ARMED' | 'RECORDING' | 'FAULT' | 'STOPPING' | 'SEALED';

const STOP_REASON = 'Interview completed';
/** The two operations whose body the handler reads with the contract's schema (decision D94): the member the hosted action bounds from below. */
const HANDLER_READ_BODIES = ['stopSession', 'addSessionNote'] as const;
/** Two UTF-16 code units, one character. */
const ASTRAL = '\u{1F600}';

/**
 * Brings the simulator behind the memory engine to a state with its own actions (a test's
 * set-up: no request, nothing in `memory.calls`). Returns the ID of the open session.
 */
function reach(memory: MemoryEngine, target: Reach): string {
  const { host } = memory;
  if (target === 'IDLE') return OTHER_SESSION;
  if (target === 'PRECHECK_WARN') host.sim.actions.inject('MIC_NO_SIGNAL');
  if (target === 'PRECHECK_BLOCK') host.sim.actions.setTabletLink('OFFLINE');
  const created = memory.act('INVESTIGATOR', (actions) => actions.createSession(sessionInput(host.operator('INVESTIGATOR').id)));
  if (!created.ok) throw new Error(`the set-up could not create a session: ${created.reason}`);
  const id = created.sessionId;
  const state = (): string | undefined => memory.session?.state;
  const must = (expected: string, outcome?: string | null): string => {
    if (state() !== expected) throw new Error(`the set-up wanted ${expected} and got ${state()}`);
    if (outcome !== undefined && memory.session?.precheck.outcome !== outcome) throw new Error(`the set-up wanted the outcome ${outcome} and got ${memory.session?.precheck.outcome}`);
    return id;
  };
  if (target === 'CREATE') return must('CREATE');
  memory.act('INVESTIGATOR', (actions) => actions.beginPrecheck());
  if (target === 'PRECHECK_RUNNING') return must('PRECHECK', null);
  host.drive(5_000);
  if (target === 'PRECHECK_WARN') return must('PRECHECK', 'WARN');
  if (target === 'PRECHECK_BLOCK') return must('PRECHECK', 'BLOCK');
  if (target === 'ARMED') return must('ARMED');
  memory.act('INVESTIGATOR', (actions) => actions.startRecording());
  host.drive(2_000);
  if (target === 'RECORDING') return must('RECORDING');
  if (target === 'FAULT') {
    host.sim.actions.inject('POWER_FAIL');
    return must('FAULT');
  }
  memory.act('INVESTIGATOR', (actions) => actions.stopRecording(STOP_REASON));
  if (target === 'STOPPING') return must('STOPPING');
  host.drive(20_000);
  return must('SEALED');
}

async function at(target: Reach, caller: OperatorRole | null = 'INVESTIGATOR'): Promise<{ unit: UnitApp; id: string }> {
  const unit = await build();
  const id = reach(unit.memory, target);
  unit.actAs(caller);
  return { unit, id };
}

const auditTotal = (unit: UnitApp): number => unit.memory.host.state().audit.total;
const newAudit = (unit: UnitApp, since: number): string[] =>
  unit.memory.host
    .state()
    .audit.rows.filter((row) => row.seq > since)
    .map((row) => row.type);

/** The request of each command on a session, as a permitted caller sends it. */
const COMMANDS_ON_SESSION: ReadonlyArray<readonly [operationId: SessionCommandId, path: string, body: object | undefined]> = [
  ['startSession', 'start', undefined],
  ['stopSession', 'stop', { reason: STOP_REASON }],
  ['beginPrecheck', 'precheck', undefined],
  ['retryPrecheck', 'precheck/retry', undefined],
  ['acknowledgePrecheckWarnings', 'precheck/acknowledge', undefined],
  ['cancelSession', 'cancel', undefined],
  ['recoverSession', 'recover', undefined],
  ['addSessionMarker', 'markers', { label: 'Key statement' }],
  ['addSessionNote', 'notes', { text: 'Subject asked for a break' }],
  ['takeSessionSnapshot', 'snapshots', undefined],
  ['acknowledgeSessionSummary', 'summary/acknowledge', undefined],
];

/** One request per operation, for the tests about who may call. */
function requestOf(unit: UnitApp, operationId: SessionOperationId, id: string): Promise<LightMyRequestResponse> {
  if (operationId === 'createSession') return unit.post(SESSION, sessionInput(unit.memory.host.operator('INVESTIGATOR').id));
  if (operationId === 'scanCaseNumber') return unit.post(CASE_NUMBER);
  if (operationId === 'getCurrentSession') return unit.get(CURRENT);
  if (operationId === 'listSessionHistory') return unit.get(HISTORY);
  const command = COMMANDS_ON_SESSION.find(([candidate]) => candidate === operationId);
  if (command === undefined) throw new Error(`no request for ${operationId}`);
  return unit.post(on(id, command[1]), command[2]);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('MODG: the route list of the module equals its registry operations', () => {
  async function registered(): Promise<{ unit: UnitApp; routes: RouteOptions[] }> {
    const all: RouteOptions[] = [];
    const unit = await build({ beforeReady: (app: FastifyInstance) => void app.addHook('onRoute', (route) => void all.push(route)) });
    const own = new Set<string>(SESSION_OPERATION_IDS);
    return { unit, routes: all.filter((route) => route.url.startsWith(SESSION) || own.has(String(route.config?.operationId))) };
  }

  it('registers operations 24 to 38 with the method, the path and the operation ID of the registry, in registry order, and nothing else under /api/v1/session', async () => {
    const { routes } = await registered();
    const signature = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;
    const fromRegistry = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.SESSION).map(
      (operation) => `${signature(operation.method, operation.path)} ${operation.operationId}`,
    );
    const fromModule = routes.map((route) => `${signature(String(route.method), route.url.replace(':id', '{id}'))} ${String(route.config?.operationId)}`);

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toHaveLength(15);
    for (const route of routes) {
      expect(matchCoreApiOperation(String(route.method), route.url.replace(':id', OTHER_SESSION))?.operation.operationId).toBe(route.config?.operationId);
    }
    console.info(`[w34] MODG routes of src/modules/sessions (${fromModule.length}):\n${fromModule.map((line) => `[w34]   ${line}`).join('\n')}`);
    console.info(`[w34] MODG registry, tag Session (${fromRegistry.length}):\n${fromRegistry.map((line) => `[w34]   ${line}`).join('\n')}`);
  });

  it('the tag Session of the registry is exactly the module\'s list, and the eleven entries of contract C are operations 28 to 38', () => {
    const area = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.SESSION).map((operation) => operation.operationId);
    expect(area).toEqual([...SESSION_OPERATION_IDS]);
    const numberOf = (operationId: SessionOperationId): number => Number(/operation (\d+)/.exec(operationOf(operationId).source)?.[1]);
    expect(SESSION_OPERATION_IDS.slice(4).map(numberOf)).toEqual([28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38]);
    // The first four are the design book's: operations 24 to 27 of spec §7.8.
    expect(SESSION_OPERATION_IDS.slice(0, 4).map((operationId) => operationOf(operationId).source)).toEqual(Array.from({ length: 4 }, () => 'Design book §21.2'));
  });

  it('request and response schemas are the registry\'s own objects; a 204 has none; the {id} is held to the registry\'s pattern; the bodies of a stop and of a note are read in the handler', async () => {
    const { routes } = await registered();
    const named = (name: CoreApiSchemaName | undefined): unknown => (name === undefined ? undefined : CORE_API_SCHEMAS[name]);
    const inHandler: string[] = [];
    for (const route of routes) {
      const operationId = String(route.config?.operationId) as SessionOperationId;
      const operation = operationOf(operationId);
      const schema = (route.schema ?? {}) as { body?: unknown; querystring?: unknown; params?: { safeParse(value: unknown): { success: boolean } }; response?: Record<number, unknown> };

      if ((HANDLER_READ_BODIES as readonly string[]).includes(operationId)) {
        // Decision D94: no body schema on the route, so that stage 7 does not answer the lower
        // bound of the text before the session was looked at. The handler reads the body with the
        // registry's schema (`bodySchemaOf` holds it to the registry at registration; the tests
        // of blocks 26 and 35 show every rule of that schema applied).
        expect(schema.body, `${operationId} body`).toBeUndefined();
        expect(operation.requestBody?.required, operationId).toBe(true);
        inHandler.push(operationId);
      } else {
        expect(schema.body, `${operationId} body`).toBe(named(operation.requestBody?.schema));
      }
      expect(schema.querystring, `${operationId} query`).toBe(named(operation.query?.schema));
      const successes = successStatusesOf(operationId);
      const withBody = successes.filter((status) => operation.responses[status]?.schema !== undefined);
      expect(Object.keys(schema.response ?? {}).map(Number), `${operationId} response statuses`).toEqual(withBody);
      for (const status of withBody) expect(schema.response?.[status], `${operationId} ${status}`).toBe(named(operation.responses[status]?.schema));

      expect(schema.params === undefined, `${operationId} params`).toBe(operation.pathParam === undefined);
      if (operation.pathParam !== undefined) {
        expect(schema.params?.safeParse({ id: OTHER_SESSION }).success).toBe(true);
        for (const id of ['SES-1', 'ses-20200101-0001', 'SES-20200101-00011', 'EV-20200101-0001', '']) {
          expect(schema.params?.safeParse({ id }).success, `${operationId} ${id}`).toBe(operation.pathParam.pattern.test(id));
          expect(operation.pathParam.pattern.test(id)).toBe(false);
        }
      }
    }
    expect(inHandler).toEqual([...HANDLER_READ_BODIES]);
  });

  it('M3: no route carries a check of its own: no hook beside the stages, and no route takes a validation failure into its handler', async () => {
    const { routes } = await registered();
    for (const route of routes) {
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onResponse', 'errorHandler'] as const) {
        expect(route[hook], `${String(route.config?.operationId)} ${hook}`).toBeUndefined();
      }
    }
    expect(routes.filter((route) => route.attachValidation === true).map((route) => route.config?.operationId)).toEqual([]);
  });

  it('the access rule of each route is the registry\'s: SESSION_START, SESSION_NOTE, or any signed-in operator for the two reads', async () => {
    const { unit } = await registered();
    const rules = permissionGuard(unit.app).registeredRules();
    const table = SESSION_OPERATION_IDS.map((operationId) => {
      const rule = rules.find((candidate) => candidate.operationId === operationId);
      const { access } = operationOf(operationId);
      expect(rule?.kind, operationId).toBe(access.kind);
      expect(rule?.permissions, operationId).toEqual(coreApiAccessPermissions(access));
      return `${operationId}: ${access.kind === CoreApiAccessKind.AUTHENTICATED ? 'AUTHENTICATED' : coreApiAccessPermissions(access).join(', ')}`;
    });
    expect(table.filter((line) => line.endsWith('SESSION_START'))).toHaveLength(10);
    expect(table.filter((line) => line.endsWith('SESSION_NOTE'))).toHaveLength(3);
    expect(table.filter((line) => line.endsWith('AUTHENTICATED')).map((line) => line.split(':')[0])).toEqual([...SESSION_READ_IDS]);
  });

  it('each command is bound to its hosted action by the contract\'s table, one action each', () => {
    const commands = SESSION_OPERATION_IDS.filter((operationId): operationId is SessionCommandId => !(SESSION_READ_IDS as readonly string[]).includes(operationId));
    const table = commands.map((operationId) => [operationId, actionOf(operationId)] as const);
    for (const [operationId, action] of table) expect(simActionsOfOperation(operationId)).toEqual([action]);
    expect(table).toEqual([
      ['createSession', 'createSession'],
      ['startSession', 'startRecording'],
      ['stopSession', 'stopRecording'],
      ['beginPrecheck', 'beginPrecheck'],
      ['retryPrecheck', 'retryPrecheck'],
      ['acknowledgePrecheckWarnings', 'acknowledgePrecheckWarnings'],
      ['cancelSession', 'cancel'],
      ['scanCaseNumber', 'scanCaseNumber'],
      ['recoverSession', 'recover'],
      ['addSessionMarker', 'addMarker'],
      ['addSessionNote', 'addNote'],
      ['takeSessionSnapshot', 'snapshot'],
      ['acknowledgeSessionSummary', 'acknowledgeSummary'],
    ]);
    for (const read of SESSION_READ_IDS) expect(simActionsOfOperation(read)).toEqual([]);
    console.info(`[w34] operation -> hosted action (from SIM_ACTION_OPERATIONS): ${table.map(([operationId, action]) => `${operationId} -> ${action}`).join('; ')}`);
  });
});

describe('who may call is stage 6 (one allowed and one refused call per operation)', () => {
  it('nobody without a session: 401 on all fifteen, no unit of the engine, no row', async () => {
    const { unit, id } = await at('RECORDING', null);
    for (const operationId of SESSION_OPERATION_IDS) check(await requestOf(unit, operationId, id), operationId, 401, 'NOT_SIGNED_IN');
    expect(unit.memory.units).toEqual([]);
    expect(unit.database.committed.auditSeqs).toEqual([]);
  });

  it('a TECHNICIAN holds neither SESSION_START nor SESSION_NOTE: 403 NOT_PERMITTED on the thirteen commands, one ACCESS_DENIED row each by the guard, none by the module, and no action runs', async () => {
    const { unit, id } = await at('RECORDING', 'TECHNICIAN');
    const commands = SESSION_OPERATION_IDS.filter((operationId) => !(SESSION_READ_IDS as readonly string[]).includes(operationId));
    for (const operationId of commands) {
      const refused = check(await requestOf(unit, operationId, id), operationId, 403, 'NOT_PERMITTED');
      expect(errorOf(refused).details).toMatchObject({ permission: coreApiAccessPermissions(operationOf(operationId).access)[0] });
    }
    // The simulator would have run `addNote` for a TECHNICIAN: the access rule is the only check.
    expect(unit.memory.units).toEqual([]);
    expect(unit.memory.calls).toEqual([]);
    expect(unit.database.committed.auditSeqs).toHaveLength(commands.length);
    expect(unit.memory.session).toMatchObject({ state: 'RECORDING', markerCount: 0, snapshotCount: 0, notes: [] });
  });

  it('a 403 is decided before the body is read: a TECHNICIAN with a body that is no JSON, or with a short reason, is still 403', async () => {
    const { unit, id } = await at('RECORDING', 'TECHNICIAN');
    expect((await unit.post(on(id, 'stop'), 'not json')).statusCode).toBe(403);
    expect((await unit.post(on(id, 'stop'), { reason: 'x' })).statusCode).toBe(403);
    expect((await unit.post(SESSION, '[]')).statusCode).toBe(403);
  });

  it('every role reads the monitor and the history: the two reads are AUTHENTICATED; a retired device is 403 on them', async () => {
    const { unit } = await at('RECORDING', 'TECHNICIAN');
    check(await unit.get(CURRENT), 'getCurrentSession', 200);
    // (The history is read from PostgreSQL: its 200 is in history.db.test.ts and in the journey.)
    unit.app.stages.replace('authenticate', (request) => {
      request.principal = { kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0001' };
    });
    check(await unit.get(CURRENT), 'getCurrentSession', 403, 'DEVICE_REVOKED');
    check(await unit.get(HISTORY), 'listSessionHistory', 403, 'DEVICE_REVOKED');
  });

  it('the holders: an INVESTIGATOR and a SUPERVISOR reach every command (one allowed call per operation)', async () => {
    for (const role of ['INVESTIGATOR', 'SUPERVISOR'] as const) {
      const { unit, id } = await at('RECORDING', role);
      // None of these is refused for who the caller is; what each answers is the next blocks' subject.
      for (const operationId of SESSION_OPERATION_IDS.filter((candidate) => candidate !== 'listSessionHistory')) {
        const response = await requestOf(unit, operationId, id);
        expect([401, 403], `${role} ${operationId}`).not.toContain(response.statusCode);
      }
    }
  });
});

describe('24 createSession', () => {
  it('201 with the session in CREATE; the action got the parsed body and ran as the caller; API-7 names the outcome\'s position', async () => {
    const { unit } = await at('IDLE', 'SUPERVISOR');
    const investigator = unit.memory.host.operator('INVESTIGATOR');
    const before = auditTotal(unit);
    const response = check(await unit.post(SESSION, { ...sessionInput(investigator.id), subjectName: '  Test   Subject ', notes: ' context ', unknown: 1 }), 'createSession', 201);
    const body = response.json() as { sessionId: string };
    expect(body).toEqual({ sessionId: unit.memory.session?.id, state: 'CREATE', created: true });
    expect(response.headers['x-dems-epoch']).toBe('3');
    expect(response.headers['x-dems-revision']).toBe('1');
    expect(unit.memory.calls).toEqual([
      {
        unit: 'engine.createSession',
        action: 'createSession',
        // The schema stage normalised the text and dropped the unknown key (API-4).
        args: [{ ...sessionInput(investigator.id), subjectName: 'Test Subject', notes: 'context' }],
        operatorId: unit.memory.host.operator('SUPERVISOR').id,
      },
    ]);
    expect(newAudit(unit, before)).toEqual(['SESSION_CREATED']);
    expect(unit.memory.session).toMatchObject({ createdBy: unit.memory.host.operator('SUPERVISOR').id, input: { investigatorId: investigator.id } });
  });

  it('equal input while the session is open: 200, created false, the state the session is in now, nothing stored', async () => {
    const { unit, id } = await at('PRECHECK_RUNNING');
    const before = auditTotal(unit);
    const response = check(await unit.post(SESSION, sessionInput(unit.memory.host.operator('INVESTIGATOR').id)), 'createSession', 200);
    expect(response.json()).toEqual({ sessionId: id, state: 'PRECHECK', created: false });
    // Nothing replicated changed: the current revision is named.
    expect(response.headers['x-dems-revision']).toBe('0');
    expect(newAudit(unit, before)).toEqual([]);
  });

  it('AC-B-49: other input while a session is open: 409 SESSION_ACTIVE with the open session in details, after a unit that changed nothing', async () => {
    const { unit, id } = await at('CREATE', 'SUPERVISOR');
    const response = check(await unit.post(SESSION, sessionInput(unit.memory.host.operator('SUPERVISOR').id, 'LP/2026/1001-0100')), 'createSession', 409, 'SESSION_ACTIVE');
    expect(errorOf(response)).toMatchObject({ message: 'A session is active.', details: { simCode: 'SESSION_ACTIVE', sessionId: id } });
    expect(response.headers['x-dems-revision']).toBeUndefined();
    // The refusal came in the simulator's RESULT: the unit committed, and the answer was built after it.
    expect(unit.memory.units).toEqual([{ label: 'engine.createSession', committed: true, actions: ['createSession'] }]);
    expect(unit.memory.session?.id).toBe(id);
  });

  it('a sealed session does not block: the next create is 201 and replaces it', async () => {
    const { unit, id } = await at('SEALED');
    const response = check(await unit.post(SESSION, sessionInput(unit.memory.host.operator('INVESTIGATOR').id, 'LP/2026/1001-0100')), 'createSession', 201);
    expect((response.json() as { sessionId: string }).sessionId).not.toBe(id);
  });

  it('422: the schema stage refuses incomplete input before the engine; the simulator refuses an investigator who does not exist or may not start sessions', async () => {
    const { unit } = await at('IDLE');
    const input = sessionInput(unit.memory.host.operator('INVESTIGATOR').id);
    const { subjectName: _omitted, ...incomplete } = input;
    const schema = check(await unit.post(SESSION, incomplete), 'createSession', 422, 'INVALID_INPUT');
    expect(errorOf(schema).details).toEqual({ in: 'body' });
    check(await unit.post(SESSION, { ...input, caseNumber: 'LP-1' }), 'createSession', 422, 'INVALID_INPUT');
    check(await unit.post(SESSION, { ...input, subjectName: 'a\u0000b' }), 'createSession', 422, 'INVALID_INPUT');
    expect(unit.memory.units).toEqual([]);

    // What a static schema cannot know: the investigator must exist and hold SESSION_START.
    for (const investigatorId of ['OPR-999', unit.memory.host.operator('TECHNICIAN').id]) {
      const refused = check(await unit.post(SESSION, { ...input, investigatorId }), 'createSession', 422, 'INVALID_INPUT');
      expect(errorOf(refused).details).toEqual({ simCode: 'INVALID_INPUT' });
    }
    expect(unit.memory.session).toBeNull();
  });

  it('400: a body that is no JSON object', async () => {
    const { unit } = await at('IDLE');
    check(await unit.post(SESSION, '[1, 2]'), 'createSession', 400, 'INVALID_JSON');
    check(await unit.post(SESSION, '{ not json'), 'createSession', 400, 'INVALID_JSON');
    expect(unit.memory.units).toEqual([]);
  });

  it('a role that changed between stage 4 and the unit: the simulator\'s refusal in the result is 403 NOT_PERMITTED, and the module writes no row for it', async () => {
    const { unit } = await at('IDLE', 'INVESTIGATOR');
    const { host } = unit.memory;
    // The engine mirrors the operators table before every action (ENG-3): the caller is a TECHNICIAN there now.
    host.sim.store.setState({ operators: host.state().operators.map((operator) => (operator.role === 'INVESTIGATOR' ? { ...operator, role: 'TECHNICIAN' as const } : operator)) });
    const response = check(await unit.post(SESSION, sessionInput(host.operator('SUPERVISOR').id)), 'createSession', 403, 'NOT_PERMITTED');
    expect(errorOf(response).details).toEqual({ simCode: 'NOT_PERMITTED' });
    expect(unit.database.committed.auditSeqs).toEqual([]);
    expect(unit.memory.session).toBeNull();
  });
});

describe('25 startSession: the composite start of the design book', () => {
  it('from CREATE: 202 PRECHECK through beginPrecheck, no audit row', async () => {
    const { unit, id } = await at('CREATE');
    const before = auditTotal(unit);
    const response = check(await unit.post(on(id, 'start')), 'startSession', 202);
    expect(response.json()).toEqual({ sessionId: id, state: 'PRECHECK' });
    expect(unit.memory.units).toEqual([{ label: 'sessions.startSession', committed: true, actions: ['beginPrecheck'] }]);
    expect(unit.memory.session?.state).toBe('PRECHECK');
    expect(newAudit(unit, before)).toEqual([]);
    expect(response.headers['x-dems-revision']).toBe('1');
  });

  it('from ARMED: 200 RECORDING through startRecording, as the caller', async () => {
    const { unit, id } = await at('ARMED', 'SUPERVISOR');
    const before = auditTotal(unit);
    const response = check(await unit.post(on(id, 'start'), {}), 'startSession', 200);
    expect(response.json()).toEqual({ sessionId: id, state: 'RECORDING' });
    expect(unit.memory.calls).toEqual([{ unit: 'sessions.startSession', action: 'startRecording', args: [], operatorId: unit.memory.host.operator('SUPERVISOR').id }]);
    expect(newAudit(unit, before)).toEqual(['RECORDING_STARTED']);
  });

  it('while the checks run: 409 PRECHECK_RUNNING, with or without acknowledgeWarnings; no action runs', async () => {
    const { unit, id } = await at('PRECHECK_RUNNING');
    for (const body of [undefined, { acknowledgeWarnings: true }]) {
      const response = check(await unit.post(on(id, 'start'), body), 'startSession', 409, 'PRECHECK_RUNNING');
      expect(errorOf(response)).toMatchObject({ message: 'Pre-recording checks are still running.', details: { simCode: 'CHECKS_RUNNING', from: 'PRECHECK', event: 'startRecording' } });
    }
    expect(unit.memory.units).toEqual(Array.from({ length: 2 }, () => ({ label: 'sessions.startSession', committed: false, actions: [] })));
  });

  it('a pre-check that ended with a warning: 409 PRECHECK_WARNINGS until acknowledgeWarnings is true; then ONE unit runs the acknowledgement and the start: 200, two rows, one revision', async () => {
    const { unit, id } = await at('PRECHECK_WARN');
    for (const body of [undefined, {}, { acknowledgeWarnings: false }]) {
      const response = check(await unit.post(on(id, 'start'), body), 'startSession', 409, 'PRECHECK_WARNINGS');
      expect(errorOf(response).details).toEqual({ simCode: 'ILLEGAL_STATE', from: 'PRECHECK', event: 'startRecording' });
    }
    expect(unit.memory.calls).toEqual([]);

    const before = auditTotal(unit);
    const response = check(await unit.post(on(id, 'start'), { acknowledgeWarnings: true }), 'startSession', 200);
    expect(response.json()).toEqual({ sessionId: id, state: 'RECORDING' });
    expect(unit.memory.units.at(-1)).toEqual({ label: 'sessions.startSession', committed: true, actions: ['acknowledgePrecheckWarnings', 'startRecording'] });
    expect(newAudit(unit, before)).toEqual(['PRECHECK_PASSED', 'RECORDING_STARTED']);
    expect(response.headers['x-dems-revision']).toBe('1');
    expect(unit.memory.session).toMatchObject({ state: 'RECORDING', precheck: { warningsAcknowledged: true } });
  });

  it('a pre-check that ended with a block: 409 PRECHECK_BLOCKED naming the blocking check, also with acknowledgeWarnings', async () => {
    const { unit, id } = await at('PRECHECK_BLOCK');
    for (const body of [undefined, { acknowledgeWarnings: true }]) {
      const response = check(await unit.post(on(id, 'start'), body), 'startSession', 409, 'PRECHECK_BLOCKED');
      expect(errorOf(response)).toMatchObject({ message: 'Start blocked: Core link offline', details: { simCode: 'ILLEGAL_STATE', from: 'PRECHECK', event: 'startRecording' } });
    }
    expect(unit.memory.calls).toEqual([]);
    expect(unit.memory.session?.state).toBe('PRECHECK');
  });

  it.each(['RECORDING', 'STOPPING', 'SEALED', 'FAULT'] as const)('from %s: 409 INVALID_STATE, the simulator\'s own refusal of startRecording', async (state) => {
    const { unit, id } = await at(state);
    const response = check(await unit.post(on(id, 'start')), 'startSession', 409, 'INVALID_STATE');
    expect(errorOf(response).details).toEqual({ simCode: 'ILLEGAL_STATE', from: state, event: 'startRecording' });
    expect(unit.memory.units).toEqual([{ label: 'sessions.startSession', committed: false, actions: ['startRecording'] }]);
    expect(unit.memory.session?.state).toBe(state);
  });

  it('422 for a body the schema refuses or a malformed {id}; 400 for a body that is no JSON object', async () => {
    const { unit, id } = await at('ARMED');
    expect(errorOf(check(await unit.post(on(id, 'start'), { acknowledgeWarnings: 'yes' }), 'startSession', 422, 'INVALID_INPUT')).details).toEqual({ in: 'body' });
    expect(errorOf(check(await unit.post(on('SES-1', 'start')), 'startSession', 422, 'INVALID_INPUT')).details).toEqual({ in: 'params' });
    check(await unit.post(on(id, 'start'), '"text"'), 'startSession', 400, 'INVALID_JSON');
    expect(unit.memory.units).toEqual([]);
    expect(unit.memory.session?.state).toBe('ARMED');
  });
});

describe('26 stopSession (AC-B-50)', () => {
  it('202 STOPPING; the action got the trimmed reason and ran as the caller, who is not the creator; RECORDING_STOPPED names the caller', async () => {
    const { unit, id } = await at('RECORDING', 'SUPERVISOR');
    const supervisor = unit.memory.host.operator('SUPERVISOR');
    const before = auditTotal(unit);
    const response = check(await unit.post(on(id, 'stop'), { reason: '  Done.  ' }), 'stopSession', 202);
    expect(response.json()).toEqual({ sessionId: id, state: 'STOPPING' });
    expect(unit.memory.calls).toEqual([{ unit: 'sessions.stopSession', action: 'stopRecording', args: ['Done.'], operatorId: supervisor.id }]);
    const row = unit.memory.host.state().audit.rows.find((candidate) => candidate.seq > before);
    expect(row).toMatchObject({ type: 'RECORDING_STOPPED', actorId: supervisor.id, details: { reason: 'Done.' } });
    expect(unit.memory.session?.createdBy).toBe(unit.memory.host.operator('INVESTIGATOR').id);
    expect(response.headers['x-dems-epoch']).toBe('3');
  });

  it.each([
    ['four characters', { reason: 'Done' }],
    ['two characters after trimming', { reason: '   ab   ' }],
    ['the empty text', { reason: '' }],
    ['no reason', {}],
    // The contract counts three characters; the simulator would count six code units and accept.
    ['three two-unit characters', { reason: ASTRAL.repeat(3) }],
  ])('a reason that is absent or shorter than five characters (%s): 422 INVALID_REASON, decided by the hosted action, which got the EMPTY text; the recording goes on', async (_name, body) => {
    const { unit, id } = await at('RECORDING');
    const response = check(await unit.post(on(id, 'stop'), body), 'stopSession', 422, 'INVALID_REASON');
    expect(errorOf(response)).toMatchObject({
      message: 'A reason of at least 5 characters is required.',
      details: { simCode: 'REASON_TOO_SHORT', from: 'RECORDING', event: 'stopRecording' },
    });
    expect(response.headers['x-dems-revision']).toBeUndefined();
    // The action ran in a unit that was not committed, and never saw the text the client sent.
    expect(unit.memory.calls).toEqual([{ unit: 'sessions.stopSession', action: 'stopRecording', args: [''], operatorId: unit.memory.host.operator('INVESTIGATOR').id }]);
    expect(unit.memory.units).toEqual([{ label: 'sessions.stopSession', committed: false, actions: ['stopRecording'] }]);
    expect(unit.memory.session).toMatchObject({ state: 'RECORDING', stopReason: null });
  });

  it('no body at all is a missing reason: 422 INVALID_REASON from the action', async () => {
    const { unit, id } = await at('RECORDING');
    check(await unit.post(on(id, 'stop')), 'stopSession', 422, 'INVALID_REASON');
    expect(unit.memory.calls.map((call) => call.args)).toEqual([['']]);
  });

  it('the SHAPE of the body is the schema stage\'s (spec §7.3 line 8): a reason that is no text or breaks the text rule is 422 INVALID_INPUT before the engine, also on a session that is not open; so is a malformed {id}', async () => {
    const { unit, id } = await at('RECORDING');
    for (const reason of [null, 12_345, ['Interview completed'], { text: 'Interview completed' }, true, 'Interview\u0000completed', 'Interview \ud800 completed', 'a\u0000']) {
      for (const session of [id, OTHER_SESSION]) {
        expect(errorOf(check(await unit.post(on(session, 'stop'), { reason }), 'stopSession', 422, 'INVALID_INPUT')).details, JSON.stringify(reason)).toEqual({ in: 'body' });
      }
    }
    // The path is validated before the body: a malformed {id} with a short reason is the path's refusal.
    expect(errorOf(check(await unit.post(on('SES-1', 'stop'), { reason: 'x' }), 'stopSession', 422, 'INVALID_INPUT')).details).toEqual({ in: 'params' });
    expect(errorOf(check(await unit.post(on('SES-1', 'stop'), { reason: STOP_REASON }), 'stopSession', 422, 'INVALID_INPUT')).details).toEqual({ in: 'params' });
    check(await unit.post(on(id, 'stop'), '[]'), 'stopSession', 400, 'INVALID_JSON');
    expect(unit.memory.units).toEqual([]);
    expect(unit.memory.session?.state).toBe('RECORDING');
  });

  /** What the simulator's own REST layer answers the same request, on the same state: `[status, code]`. A refusal changes nothing. */
  const simulated = (unit: UnitApp, path: string, body: object): [number, string | null] => {
    const { host } = unit.memory;
    const answer = host.runAs(host.operator('INVESTIGATOR'), () => host.sim.request({ method: 'POST', path, body }));
    return [answer.status, (answer.body as { error?: { code?: string } } | undefined)?.error?.code ?? null];
  };
  /** Bodies whose reason is absent or too short, in every form the contract and the simulator agree on. */
  const SHORT = [{ reason: 'Done' }, { reason: '' }, { reason: '    ' }, {}] as const;

  it.each(['IDLE', 'CREATE', 'PRECHECK_RUNNING', 'PRECHECK_BLOCK', 'ARMED', 'RECORDING', 'FAULT', 'STOPPING', 'SEALED'] as const)(
    'one error precedence (spec §7.3 line 10; decision D94), with the Core at %s: 404 for a session that is not the open one, then 409 for its state, then 422 INVALID_REASON, as the simulator\'s REST layer answers',
    async (state) => {
      const { unit, id } = await at(state);
      // The open session in a state that cannot be stopped: 409. Stoppable: the reason decides, last.
      const onOpen: [number, string] = state === 'RECORDING' ? [422, 'INVALID_REASON'] : [409, 'INVALID_STATE'];
      for (const body of SHORT) {
        // A session that is not the open one: 404, whatever the reason is.
        const other = await unit.post(on(OTHER_SESSION, 'stop'), body);
        expect(outcome(check(other, 'stopSession', 404, 'NOT_FOUND')), JSON.stringify(body)).toEqual(simulated(unit, on(OTHER_SESSION, 'stop'), body));
        if (state === 'IDLE') continue;
        const open = await unit.post(on(id, 'stop'), body);
        expect(outcome(check(open, 'stopSession', ...onOpen)), JSON.stringify(body)).toEqual(simulated(unit, on(id, 'stop'), body));
        if (onOpen[0] === 409) expect(errorOf(open).details).toEqual({ simCode: 'ILLEGAL_STATE', from: unit.memory.session?.state, event: 'stopRecording' });
      }
      // With a reason the contract accepts the first two answers are the same: the reason is looked at last.
      check(await unit.post(on(OTHER_SESSION, 'stop'), { reason: STOP_REASON }), 'stopSession', 404, 'NOT_FOUND');
      if (state !== 'IDLE' && state !== 'RECORDING') check(await unit.post(on(id, 'stop'), { reason: STOP_REASON }), 'stopSession', 409, 'INVALID_STATE');
      // Nothing changed, no unit was committed, and no text of a refused body reached the engine.
      expect(unit.memory.units.every((record) => !record.committed)).toBe(true);
      expect(unit.memory.calls.filter((call) => call.args[0] !== '' && call.args[0] !== STOP_REASON)).toEqual([]);
      expect(unit.memory.session?.state ?? 'IDLE').toBe(state.startsWith('PRECHECK') ? 'PRECHECK' : state);
    },
  );

  it('a long reason is passed whole: the server cuts nothing', async () => {
    const { unit, id } = await at('RECORDING');
    const reason = `Interview completed ${'x'.repeat(4_000)}`;
    check(await unit.post(on(id, 'stop'), { reason }), 'stopSession', 202);
    expect(unit.memory.calls[0]?.args).toEqual([reason]);
    expect(unit.memory.session?.stopReason).toBe(reason);
  });
});

describe('27 getCurrentSession', () => {
  it('null when no session is open; the server time is the server clock in UTC+07:00; no unit, no state position', async () => {
    const { unit } = await at('IDLE', 'TECHNICIAN');
    const response = check(await unit.get(CURRENT), 'getCurrentSession', 200);
    expect(response.json()).toEqual({ session: null, serverTime: '2026-10-01T10:00:00.000+07:00' });
    expect(response.headers['x-dems-epoch']).toBeUndefined();
    expect(unit.memory.units).toEqual([]);
  });

  it.each(['CREATE', 'PRECHECK_RUNNING', 'PRECHECK_WARN', 'PRECHECK_BLOCK', 'ARMED', 'RECORDING', 'FAULT', 'STOPPING', 'SEALED'] as const)(
    'with the session at %s the answer is the shared simulator\'s own REST answer',
    async (state) => {
      const { unit } = await at(state, 'TECHNICIAN');
      const response = check(await unit.get(CURRENT), 'getCurrentSession', 200);
      const simulated = unit.memory.host.sim.request({ method: 'GET', path: CURRENT });
      expect(simulated.status).toBe(200);
      expect(response.json()).toEqual(simulated.body);
    },
  );

  it('the recording time follows the server clock between two ticks of the engine', async () => {
    const { unit } = await at('RECORDING', 'INVESTIGATOR');
    const started = unit.memory.session?.startedAt ?? 0;
    expect(unit.memory.host.now() - started).toBe(2_000);
    expect((check(await unit.get(CURRENT), 'getCurrentSession', 200).json() as { session: { elapsedMs: number } }).session.elapsedMs).toBe(2_000);
  });

  it('503 while the engine does not run', async () => {
    const { unit } = await at('RECORDING', 'INVESTIGATOR');
    await unit.memory.engine.stop();
    check(await unit.get(CURRENT), 'getCurrentSession', 503, 'NOT_READY');
  });
});

describe('28 to 31, 33 to 36: one hosted action on the open session', () => {
  it('28 beginPrecheck: 202 PRECHECK from CREATE, no audit row; 409 INVALID_STATE from any other state', async () => {
    const { unit, id } = await at('CREATE');
    const before = auditTotal(unit);
    const response = check(await unit.post(on(id, 'precheck')), 'beginPrecheck', 202);
    expect(response.json()).toEqual({ sessionId: id, state: 'PRECHECK' });
    expect(unit.memory.calls).toEqual([{ unit: 'sessions.beginPrecheck', action: 'beginPrecheck', args: [], operatorId: unit.memory.host.operator('INVESTIGATOR').id }]);
    expect(newAudit(unit, before)).toEqual([]);
    const again = check(await unit.post(on(id, 'precheck')), 'beginPrecheck', 409, 'INVALID_STATE');
    expect(errorOf(again).details).toEqual({ simCode: 'ILLEGAL_STATE', from: 'PRECHECK', event: 'beginPrecheck' });
  });

  it('29 retryPrecheck: 202 PRECHECK after a block; 409 PRECHECK_RUNNING while the checks run; 409 INVALID_STATE from CREATE', async () => {
    const blocked = await at('PRECHECK_BLOCK');
    const response = check(await blocked.unit.post(on(blocked.id, 'precheck/retry')), 'retryPrecheck', 202);
    expect(response.json()).toEqual({ sessionId: blocked.id, state: 'PRECHECK' });
    expect(blocked.unit.memory.session?.precheck.outcome).toBeNull();
    const running = check(await blocked.unit.post(on(blocked.id, 'precheck/retry')), 'retryPrecheck', 409, 'PRECHECK_RUNNING');
    expect(errorOf(running).details).toEqual({ simCode: 'CHECKS_RUNNING', from: 'PRECHECK', event: 'retryPrecheck' });

    const created = await at('CREATE');
    expect(errorOf(check(await created.unit.post(on(created.id, 'precheck/retry')), 'retryPrecheck', 409, 'INVALID_STATE')).details).toEqual({
      simCode: 'ILLEGAL_STATE',
      from: 'CREATE',
      event: 'retryPrecheck',
    });
  });

  it('30 acknowledgePrecheckWarnings: 200 ARMED and PRECHECK_PASSED by the caller; 409 for a block (nothing to acknowledge), while the checks run, and from another state', async () => {
    const warned = await at('PRECHECK_WARN', 'SUPERVISOR');
    const before = auditTotal(warned.unit);
    const response = check(await warned.unit.post(on(warned.id, 'precheck/acknowledge')), 'acknowledgePrecheckWarnings', 200);
    expect(response.json()).toEqual({ sessionId: warned.id, state: 'ARMED' });
    const row = warned.unit.memory.host.state().audit.rows.find((candidate) => candidate.seq > before);
    expect(row).toMatchObject({ type: 'PRECHECK_PASSED', actorId: warned.unit.memory.host.operator('SUPERVISOR').id });

    const blocked = await at('PRECHECK_BLOCK');
    expect(errorOf(check(await blocked.unit.post(on(blocked.id, 'precheck/acknowledge')), 'acknowledgePrecheckWarnings', 409, 'INVALID_STATE')).details).toMatchObject({ simCode: 'NO_WARNINGS' });
    const running = await at('PRECHECK_RUNNING');
    expect(errorOf(check(await running.unit.post(on(running.id, 'precheck/acknowledge')), 'acknowledgePrecheckWarnings', 409, 'PRECHECK_RUNNING')).details).toMatchObject({ simCode: 'CHECKS_RUNNING' });
    const armed = await at('ARMED');
    expect(errorOf(check(await armed.unit.post(on(armed.id, 'precheck/acknowledge')), 'acknowledgePrecheckWarnings', 409, 'INVALID_STATE')).details).toMatchObject({ simCode: 'ILLEGAL_STATE', from: 'ARMED' });
  });

  it.each(['CREATE', 'PRECHECK_RUNNING', 'PRECHECK_BLOCK', 'ARMED'] as const)('31 cancelSession from %s: 204, SESSION_CANCELLED by the caller, no session afterwards', async (state) => {
    const { unit, id } = await at(state, 'SUPERVISOR');
    const before = auditTotal(unit);
    const response = check(await unit.post(on(id, 'cancel')), 'cancelSession', 204);
    expect(response.body).toBe('');
    expect(response.headers['x-dems-revision']).toBe('1');
    expect(unit.memory.calls).toEqual([{ unit: 'sessions.cancelSession', action: 'cancel', args: [], operatorId: unit.memory.host.operator('SUPERVISOR').id }]);
    expect(newAudit(unit, before)).toEqual(['SESSION_CANCELLED']);
    expect(unit.memory.session).toBeNull();
    // The session is gone: the same request again names no open session.
    check(await unit.post(on(id, 'cancel')), 'cancelSession', 404, 'NOT_FOUND');
  });

  it.each(['RECORDING', 'STOPPING', 'SEALED', 'FAULT'] as const)('31 cancelSession from %s: 409 INVALID_STATE (a recording is stopped, not cancelled)', async (state) => {
    const { unit, id } = await at(state);
    expect(errorOf(check(await unit.post(on(id, 'cancel')), 'cancelSession', 409, 'INVALID_STATE')).details).toEqual({ simCode: 'ILLEGAL_STATE', from: state, event: 'cancel' });
    expect(unit.memory.session?.state).toBe(state);
  });

  it('33 recoverSession: 202 RECOVERY from FAULT, with SYSTEM_BOOT, RECOVERY_STARTED (the caller) and FAULT_CLEARED after a power failure; 409 from any other state', async () => {
    const { unit, id } = await at('FAULT', 'SUPERVISOR');
    const before = auditTotal(unit);
    const response = check(await unit.post(on(id, 'recover')), 'recoverSession', 202);
    expect(response.json()).toEqual({ sessionId: id, state: 'RECOVERY' });
    expect(unit.memory.calls).toEqual([{ unit: 'sessions.recoverSession', action: 'recover', args: [], operatorId: unit.memory.host.operator('SUPERVISOR').id }]);
    expect(newAudit(unit, before)).toEqual(['SYSTEM_BOOT', 'RECOVERY_STARTED', 'FAULT_CLEARED']);
    const recorded = unit.memory.host.state().audit.rows.find((row) => row.seq > before && row.type === 'RECOVERY_STARTED');
    expect(recorded?.actorId).toBe(unit.memory.host.operator('SUPERVISOR').id);
    expect(errorOf(check(await unit.post(on(id, 'recover')), 'recoverSession', 409, 'INVALID_STATE')).details).toEqual({ simCode: 'ILLEGAL_STATE', from: 'RECOVERY', event: 'recover' });
  });

  it('34 addSessionMarker: 204; the label as sent, or none; an empty label and no body let the Core name it', async () => {
    const { unit, id } = await at('RECORDING');
    const before = auditTotal(unit);
    expect(check(await unit.post(on(id, 'markers'), { label: '  Key statement  ' }), 'addSessionMarker', 204).body).toBe('');
    check(await unit.post(on(id, 'markers'), { label: '' }), 'addSessionMarker', 204);
    check(await unit.post(on(id, 'markers')), 'addSessionMarker', 204);
    expect(unit.memory.calls.map((call) => [call.unit, call.action, call.args])).toEqual([
      ['sessions.addSessionMarker', 'addMarker', ['Key statement']],
      ['sessions.addSessionMarker', 'addMarker', ['']],
      ['sessions.addSessionMarker', 'addMarker', [undefined]],
    ]);
    expect(newAudit(unit, before)).toEqual(['MARKER_ADDED', 'MARKER_ADDED', 'MARKER_ADDED']);
    expect(unit.memory.session?.timeline.filter((item) => item.kind === 'MARKER').map((item) => item.label)).toEqual(['Key statement', 'Marker 2', 'Marker 3']);
  });

  it('34 addSessionMarker: a label of 80 code units is stored as sent; 81 is refused with 422 (the server never cuts); 400 for a body that is no JSON object; 409 when not recording', async () => {
    const { unit, id } = await at('RECORDING');
    const exact = 'm'.repeat(80);
    check(await unit.post(on(id, 'markers'), { label: exact }), 'addSessionMarker', 204);
    expect(unit.memory.session?.timeline.at(-1)?.label).toBe(exact);
    expect(errorOf(check(await unit.post(on(id, 'markers'), { label: 'm'.repeat(81) }), 'addSessionMarker', 422, 'INVALID_INPUT')).details).toEqual({ in: 'body' });
    check(await unit.post(on(id, 'markers'), 'null'), 'addSessionMarker', 400, 'INVALID_JSON');
    expect(unit.memory.session?.markerCount).toBe(1);

    const armed = await at('ARMED');
    expect(errorOf(check(await armed.unit.post(on(armed.id, 'markers'), { label: 'x' }), 'addSessionMarker', 409, 'INVALID_STATE')).details).toEqual({ simCode: 'ILLEGAL_STATE', from: 'ARMED', event: 'addMarker' });
  });

  it('35 addSessionNote: 204, the text as sent and its author; 2,000 characters pass; the shape of the body (too long, no text, the text rule) is 422 INVALID_INPUT before the engine; 409 when not recording', async () => {
    const { unit, id } = await at('RECORDING', 'SUPERVISOR');
    const before = auditTotal(unit);
    check(await unit.post(on(id, 'notes'), { text: '  Subject asked for a break  ' }), 'addSessionNote', 204);
    expect(unit.memory.calls).toEqual([{ unit: 'sessions.addSessionNote', action: 'addNote', args: ['Subject asked for a break'], operatorId: unit.memory.host.operator('SUPERVISOR').id }]);
    expect(newAudit(unit, before)).toEqual(['NOTE_ADDED']);
    check(await unit.post(on(id, 'notes'), { text: 'n'.repeat(2_000) }), 'addSessionNote', 204);
    expect(unit.memory.session?.notes.at(-1)?.text).toHaveLength(2_000);

    // Line 8 of the precedence table: before the engine, also on a session that is not open.
    const units = unit.memory.units.length;
    for (const body of [{ text: 'n'.repeat(2_001) }, { text: ASTRAL.repeat(1_001) }, { text: 7 }, { text: null }, { text: 'a\u0000b' }]) {
      for (const session of [id, OTHER_SESSION]) {
        expect(errorOf(check(await unit.post(on(session, 'notes'), body), 'addSessionNote', 422, 'INVALID_INPUT')).details).toEqual({ in: 'body' });
      }
    }
    check(await unit.post(on(id, 'notes'), '[]'), 'addSessionNote', 400, 'INVALID_JSON');
    expect(unit.memory.units).toHaveLength(units);
    expect(unit.memory.session?.notes).toHaveLength(2);

    const stopping = await at('STOPPING');
    expect(errorOf(check(await stopping.unit.post(on(stopping.id, 'notes'), { text: 'late' }), 'addSessionNote', 409, 'INVALID_STATE')).details).toEqual({
      simCode: 'ILLEGAL_STATE',
      from: 'STOPPING',
      event: 'addNote',
    });
  });

  it('35 addSessionNote, one error precedence (decision D94): a text that is absent or empty is the hosted action\'s to refuse, after 404 and 409: 422 INVALID_INPUT with simCode NOTE_INVALID', async () => {
    const EMPTY = [{ text: '' }, { text: '   ' }, {}] as const;
    const recording = await at('RECORDING', 'SUPERVISOR');
    for (const body of EMPTY) {
      // A session that is not the open one: 404, whatever the text is.
      check(await recording.unit.post(on(OTHER_SESSION, 'notes'), body), 'addSessionNote', 404, 'NOT_FOUND');
      // The open session, recording: only now the text.
      const refused = check(await recording.unit.post(on(recording.id, 'notes'), body), 'addSessionNote', 422, 'INVALID_INPUT');
      expect(errorOf(refused).details, JSON.stringify(body)).toEqual({ simCode: 'NOTE_INVALID', from: 'RECORDING', event: 'addNote' });
    }
    check(await recording.unit.post(on(recording.id, 'notes')), 'addSessionNote', 422, 'INVALID_INPUT');
    // The action got the empty text every time, in a unit that was not committed; no note was added.
    expect(recording.unit.memory.calls.map((call) => [call.action, call.args])).toEqual(Array.from({ length: 4 }, () => ['addNote', ['']]));
    expect(recording.unit.memory.units.every((record) => !record.committed)).toBe(true);
    expect(recording.unit.memory.session?.notes).toEqual([]);

    // The open session in a state that takes no note: 409 before the text is looked at.
    for (const state of ['ARMED', 'STOPPING', 'SEALED', 'FAULT'] as const) {
      const { unit, id } = await at(state);
      for (const body of EMPTY) {
        const refused = check(await unit.post(on(id, 'notes'), body), 'addSessionNote', 409, 'INVALID_STATE');
        expect(errorOf(refused).details, state).toEqual({ simCode: 'ILLEGAL_STATE', from: state, event: 'addNote' });
        check(await unit.post(on(OTHER_SESSION, 'notes'), body), 'addSessionNote', 404, 'NOT_FOUND');
      }
    }
  });

  it('36 takeSessionSnapshot: 204 and SNAPSHOT_TAKEN by the caller; 409 when not recording', async () => {
    const { unit, id } = await at('RECORDING');
    const before = auditTotal(unit);
    check(await unit.post(on(id, 'snapshots')), 'takeSessionSnapshot', 204);
    expect(unit.memory.calls).toEqual([{ unit: 'sessions.takeSessionSnapshot', action: 'snapshot', args: [], operatorId: unit.memory.host.operator('INVESTIGATOR').id }]);
    expect(newAudit(unit, before)).toEqual(['SNAPSHOT_TAKEN']);
    const armed = await at('ARMED');
    check(await armed.unit.post(on(armed.id, 'snapshots')), 'takeSessionSnapshot', 409, 'INVALID_STATE');
  });
});

describe('the {id} of the path must be the open session (spec §7.8): decided inside the unit', () => {
  it('another ID while a session is open: 404 NOT_FOUND on the ten operations that name the open session, in a unit that ran no action and changed nothing', async () => {
    const { unit, id } = await at('RECORDING', 'SUPERVISOR');
    const before = auditTotal(unit);
    const named = COMMANDS_ON_SESSION.filter(([operationId]) => operationId !== 'acknowledgeSessionSummary');
    expect(named).toHaveLength(10);
    for (const [operationId, path, body] of named) {
      const response = check(await unit.post(on(OTHER_SESSION, path), body), operationId, 404, 'NOT_FOUND');
      expect(errorOf(response)).toMatchObject({ message: 'This session is not the open session.', details: { simCode: 'NOT_FOUND' } });
      expect(response.headers['x-dems-revision']).toBeUndefined();
    }
    expect(unit.memory.calls).toEqual([]);
    expect(unit.memory.units).toEqual(named.map(([operationId]) => ({ label: sessionUnitLabel(operationId), committed: false, actions: [] })));
    expect(newAudit(unit, before)).toEqual([]);
    expect(unit.memory.session).toMatchObject({ id, state: 'RECORDING' });
  });

  it('with no session open every ID is another one: 404', async () => {
    const { unit } = await at('IDLE');
    for (const [operationId, path, body] of COMMANDS_ON_SESSION.filter(([candidate]) => candidate !== 'acknowledgeSessionSummary')) {
      check(await unit.post(on(OTHER_SESSION, path), body), operationId, 404, 'NOT_FOUND');
    }
    expect(unit.memory.calls).toEqual([]);
  });

  it('a malformed {id} is refused by the schema stage on every operation that has one: 422 INVALID_INPUT, in params, no unit', async () => {
    const { unit } = await at('RECORDING');
    for (const [operationId, path, body] of COMMANDS_ON_SESSION) {
      for (const id of ['SES-1', 'EV-20200101-0001', 'current']) {
        if (path === 'start' && id === 'current') continue;
        const response = await unit.post(on(id, path), body);
        // `current` and `history` are literal paths of two GETs: a POST there is the router's 405, not this module's.
        if (response.statusCode === 405) continue;
        expect(errorOf(check(response, operationId, 422, 'INVALID_INPUT')).details).toEqual({ in: 'params' });
      }
    }
    expect(unit.memory.units).toEqual([]);
  });

  it('a session that was replaced while a request waited is not the one it named: the check reads the state inside the unit', async () => {
    const { unit, id } = await at('ARMED', 'SUPERVISOR');
    const { engine } = unit.memory;
    // Another operator's units run first: the session is cancelled and the next one created.
    const run = engine.run.bind(engine);
    let overtaken = false;
    unit.app.seams.replace('engine', {
      ...engine,
      get epoch() {
        return engine.epoch;
      },
      get revision() {
        return engine.revision;
      },
      get running() {
        return engine.running;
      },
      run: (label, work) => {
        if (!overtaken) {
          overtaken = true;
          unit.memory.act('INVESTIGATOR', (actions) => actions.cancel());
          unit.memory.act('INVESTIGATOR', (actions) => actions.createSession(sessionInput(unit.memory.host.operator('INVESTIGATOR').id, 'LP/2026/1001-0100')));
        }
        return run(label, work);
      },
    });
    const response = check(await unit.post(on(id, 'cancel')), 'cancelSession', 404, 'NOT_FOUND');
    expect(response.statusCode).toBe(404);
    // The session that IS open now was not touched by a request that named the old one.
    expect(unit.memory.session).toMatchObject({ state: 'CREATE' });
    expect(unit.memory.session?.id).not.toBe(id);
    expect(unit.memory.calls).toEqual([]);
  });
});

describe('32 scanCaseNumber and 37 acknowledgeSessionSummary: one hosted action, no session named or needed', () => {
  it('32: 200 with the next case number; each scan reserves one; no audit row', async () => {
    const { unit } = await at('IDLE', 'SUPERVISOR');
    const before = auditTotal(unit);
    const first = check(await unit.post(CASE_NUMBER), 'scanCaseNumber', 200).json() as { caseNumber: string };
    const second = check(await unit.post(CASE_NUMBER), 'scanCaseNumber', 200).json() as { caseNumber: string };
    expect(first.caseNumber).toMatch(/^LP\/2026\/1001-\d{4}$/);
    expect(Number(second.caseNumber.slice(-4))).toBe(Number(first.caseNumber.slice(-4)) + 1);
    expect(unit.memory.calls.map((call) => [call.unit, call.action, call.args, call.operatorId])).toEqual(
      Array.from({ length: 2 }, () => ['engine.scanCaseNumber', 'scanCaseNumber', [], unit.memory.host.operator('SUPERVISOR').id]),
    );
    expect(newAudit(unit, before)).toEqual([]);
  });

  it('37: the {id} is the action\'s argument; 204 and SUMMARY_ACKNOWLEDGED for the session sealed last; a repeat and another ID are 204 with nothing stored and the same revision', async () => {
    const { unit, id } = await at('SEALED');
    const before = auditTotal(unit);
    const first = check(await unit.post(on(id, 'summary/acknowledge')), 'acknowledgeSessionSummary', 204);
    expect(first.body).toBe('');
    expect(first.headers['x-dems-revision']).toBe('1');
    expect(unit.memory.calls).toEqual([{ unit: 'engine.acknowledgeSummary', action: 'acknowledgeSummary', args: [id], operatorId: unit.memory.host.operator('INVESTIGATOR').id }]);
    expect(newAudit(unit, before)).toEqual(['SUMMARY_ACKNOWLEDGED']);

    expect(check(await unit.post(on(id, 'summary/acknowledge')), 'acknowledgeSessionSummary', 204).headers['x-dems-revision']).toBe('1');
    expect(check(await unit.post(on(OTHER_SESSION, 'summary/acknowledge')), 'acknowledgeSessionSummary', 204).headers['x-dems-revision']).toBe('1');
    expect(newAudit(unit, before)).toEqual(['SUMMARY_ACKNOWLEDGED']);
    expect(unit.memory.calls.map((call) => call.args)).toEqual([[id], [id], [OTHER_SESSION]]);
    expect(errorOf(check(await unit.post(on('SES-1', 'summary/acknowledge')), 'acknowledgeSessionSummary', 422, 'INVALID_INPUT')).details).toEqual({ in: 'params' });
  });

  it('37 with no session sealed yet: 204, nothing stored', async () => {
    const { unit } = await at('IDLE');
    const before = auditTotal(unit);
    check(await unit.post(on(OTHER_SESSION, 'summary/acknowledge')), 'acknowledgeSessionSummary', 204);
    expect(newAudit(unit, before)).toEqual([]);
  });
});

describe('38 listSessionHistory: what needs no database', () => {
  it('422 for a query the schema refuses and for a cursor that is no position of this list; no statement is sent', async () => {
    const { unit } = await at('IDLE', 'TECHNICIAN');
    const statements = unit.database.statements.length;
    for (const query of ['limit=0', 'limit=201', 'limit=1.5', 'limit=abc', 'cursor=a_b', `cursor=${'9'.repeat(129)}`]) {
      expect(errorOf(check(await unit.get(`${HISTORY}?${query}`), 'listSessionHistory', 422, 'INVALID_INPUT')).details, query).toEqual({ in: 'querystring' });
    }
    // These fit the contract's cursor pattern and are still no `<endedAt>-<session ID>`.
    for (const cursor of ['abc', '1790819100000', '1790819100000-EV-20261001-0022', '-SES-20261001-0022', '99999999999999999-SES-20261001-0022', '9999999999999999-SES-20261001-0022', 'SES-20261001-0022']) {
      expect(errorOf(check(await unit.get(`${HISTORY}?cursor=${cursor}`), 'listSessionHistory', 422, 'INVALID_INPUT')).details, cursor).toEqual({ in: 'querystring' });
    }
    expect(unit.database.statements).toHaveLength(statements);
  });

  it('M14: a statement that fails: 503 NOT_READY, one error line under the key err and one persistent entry; neither holds the statement, a parameter, the DETAIL or the driver\'s message', async () => {
    const errorLogFile = join(scratch, 'history-errors.log');
    // What a failed statement throws: the message quotes the statement, and the statement, its
    // parameters and the server's DETAIL ride along as enumerable members.
    const failing = createFakePool(async () => {
      throw Object.assign(new Error('Failed query: select STATEMENT-W34 from "session_history" params: PARAM-W34'), {
        code: '57P01',
        query: 'select STATEMENT-W34 from "session_history"',
        params: ['PARAM-W34', 1790819100000],
        detail: 'Key (id)=(DETAIL-W34) is not present.',
        cause: Object.assign(new Error('terminating connection CAUSE-W34'), { code: '57P01', detail: 'DETAIL-W34' }),
      });
    });
    const unit = await build({ pool: failing.pool, errorLogFile });
    unit.actAs('INVESTIGATOR');
    const response = check(await unit.get(`${HISTORY}?limit=5&cursor=1790819100000-SES-20261001-0022`), 'listSessionHistory', 503, 'NOT_READY');
    expect(errorOf(response).message).toBe('The server is not ready. Try again shortly.');
    expect(response.body).not.toMatch(/W34|session_history/);

    // The one line of the pool plugin's helper (`app.db.read`), written with the request's logger.
    const lines = unit.log.lines().filter((line) => line['msg'] === 'a read on the pool failed');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 50, source: 'sessions.listSessionHistory', reqId: errorOf(response).requestId });
    // The error is under `err`, as the logger's serializer writes it, and under no other key.
    expect(Object.keys(lines[0] ?? {}).filter((key) => ['error', 'cause', 'e', 'reason', 'query', 'params', 'detail'].includes(key))).toEqual([]);
    expect(lines[0]?.['err']).toBeTypeOf('object');
    const persisted = readFileSync(errorLogFile, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((entry) => entry['source'] === 'sessions.listSessionHistory');
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ level: 'error', message: 'a read on the pool failed', context: { requestId: errorOf(response).requestId } });

    // The scan: nothing of the failed statement is in the log or in the persistent error log.
    for (const text of [unit.log.text(), JSON.stringify(persisted)]) {
      for (const secret of ['STATEMENT-W34', 'PARAM-W34', 'DETAIL-W34', 'CAUSE-W34', 'Failed query', '1790819100000']) expect(text, secret).not.toContain(secret);
    }
  });
});

describe('a unit that could not be run or committed, and what the log holds', () => {
  it('503 NOT_READY from the engine propagates on a command; no header of API-7; the state is as before', async () => {
    const { unit, id } = await at('RECORDING');
    const { ApiFailure } = await import('../../../plugins/error-envelope');
    unit.memory.failNextUnit(new ApiFailure(503, 'NOT_READY', 'The server is not ready. Try again shortly.'));
    const response = check(await unit.post(on(id, 'stop'), { reason: STOP_REASON }), 'stopSession', 503, 'NOT_READY');
    expect(response.headers['x-dems-revision']).toBeUndefined();
    expect(unit.memory.session?.state).toBe('RECORDING');
    // The next command works.
    check(await unit.post(on(id, 'stop'), { reason: STOP_REASON }), 'stopSession', 202);
  });

  it('an unexpected failure inside a unit is the generic 500 with no detail', async () => {
    const { unit, id } = await at('RECORDING');
    unit.memory.failNextUnit(new Error('internal: SELECT * FROM active_session'));
    const response = await unit.post(on(id, 'snapshots'));
    expect(response.statusCode).toBe(500);
    expect(errorOf(response)).toMatchObject({ code: 'INTERNAL_ERROR', message: 'The server could not complete the request.' });
    expect(response.body).not.toContain('active_session');
  });

  it('SR-48: the request log of the module\'s operations holds route patterns, codes and IDs; never a reason, a note, a label or a subject', async () => {
    const { unit, id } = await at('RECORDING');
    check(await unit.post(on(id, 'markers'), { label: 'MARKER-TEXT-W34' }), 'addSessionMarker', 204);
    check(await unit.post(on(id, 'notes'), { text: 'NOTE-TEXT-W34' }), 'addSessionNote', 204);
    check(await unit.post(on(id, 'stop'), { reason: 'x' }), 'stopSession', 422, 'INVALID_REASON');
    check(await unit.post(on(id, 'stop'), { reason: 'REASON-TEXT-W34' }), 'stopSession', 202);
    await unit.post(SESSION, { ...sessionInput('OPR-001'), subjectName: 'SUBJECT-TEXT-W34' });
    const text = unit.log.text();
    for (const marker of ['MARKER-TEXT-W34', 'NOTE-TEXT-W34', 'REASON-TEXT-W34', 'SUBJECT-TEXT-W34']) expect(text, marker).not.toContain(marker);
    expect(text).toContain('/api/v1/session/:id/stop');
    expect(text).not.toContain(`/api/v1/session/${id}/stop`);
  });
});

describe('API-1: the four design-book operations answer as the simulator\'s REST layer does', () => {
  /** Runs the same requests against the server and against a twin simulator, and compares status, code and success body. */
  async function twins(prepare: (actions: Awaited<ReturnType<typeof createHost>>['sim']['actions']) => void) {
    const unit = await build();
    const twin = await createHost({ scenario: 'idle', startAt: NOW });
    prepare(unit.memory.host.sim.actions);
    prepare(twin.sim.actions);
    const differences: string[] = [];
    const same = async (role: OperatorRole, method: 'GET' | 'POST', path: string, body?: object): Promise<number> => {
      unit.actAs(role);
      const answered = method === 'GET' ? await unit.get(path) : await unit.post(path, body);
      const simulated = twin.runAs(twin.operator(role), () => twin.sim.request({ method, path, body }));
      const code = (value: unknown): string | null => (value as { error?: { code?: string } } | undefined)?.error?.code ?? null;
      const mine = answered.statusCode < 300 ? bodyOf(answered) : code(bodyOf(answered));
      const theirs = simulated.status < 300 ? simulated.body : code(simulated.body);
      if (answered.statusCode !== simulated.status || JSON.stringify(mine) !== JSON.stringify(theirs)) {
        differences.push(`${method} ${path} ${JSON.stringify(body ?? null)}: server ${answered.statusCode} ${JSON.stringify(mine)}, simulator ${simulated.status} ${JSON.stringify(theirs)}`);
      }
      return answered.statusCode;
    };
    const drive = (ms: number): void => {
      unit.memory.host.drive(ms);
      twin.drive(ms);
    };
    return { unit, twin, same, drive, differences };
  }

  it('a recording with a warning, step by step: every status, error code and success body is the simulator\'s', async () => {
    const { unit, same, drive, differences } = await twins((actions) => actions.inject('MIC_NO_SIGNAL'));
    const input = sessionInput(unit.memory.host.operator('INVESTIGATOR').id);
    const { subjectName: _omitted, ...incomplete } = input;
    expect(await same('TECHNICIAN', 'GET', CURRENT)).toBe(200);
    expect(await same('INVESTIGATOR', 'POST', on(OTHER_SESSION, 'start'))).toBe(404);
    // No session is open: a stop is 404, with a short reason too (one error precedence, decision D94).
    expect(await same('INVESTIGATOR', 'POST', on(OTHER_SESSION, 'stop'), { reason: 'x' })).toBe(404);
    expect(await same('INVESTIGATOR', 'POST', SESSION, input)).toBe(201);
    const id = unit.memory.session?.id ?? '';
    expect(await same('INVESTIGATOR', 'POST', SESSION, input)).toBe(200);
    expect(await same('SUPERVISOR', 'POST', SESSION, { ...input, caseNumber: 'LP/2026/1001-0100' })).toBe(409);
    expect(await same('SUPERVISOR', 'POST', SESSION, { ...input, investigatorId: 'OPR-999', caseNumber: 'LP/2026/1001-0100' })).toBe(409);
    // A create validates its input before it looks for an open session, on both: 422, not 409.
    expect(await same('SUPERVISOR', 'POST', SESSION, incomplete)).toBe(422);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'stop'), { reason: 'Interview completed' })).toBe(409);
    expect(await same('INVESTIGATOR', 'POST', on(OTHER_SESSION, 'stop'), { reason: 'Interview completed' })).toBe(404);
    // CREATE cannot be stopped: 409 before the reason is looked at; another session: 404.
    expect(await same('INVESTIGATOR', 'POST', on(id, 'stop'), { reason: 'x' })).toBe(409);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'stop'), {})).toBe(409);
    expect(await same('INVESTIGATOR', 'POST', on(OTHER_SESSION, 'stop'), {})).toBe(404);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'start'))).toBe(202);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'start'))).toBe(409);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'stop'), { reason: 'Done' })).toBe(409);
    expect(await same('INVESTIGATOR', 'GET', CURRENT)).toBe(200);
    drive(5_000);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'start'))).toBe(409);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'start'), { acknowledgeWarnings: false })).toBe(409);
    expect(await same('SUPERVISOR', 'POST', on(id, 'start'), { acknowledgeWarnings: true })).toBe(200);
    expect(await same('SUPERVISOR', 'POST', on(id, 'start'), { acknowledgeWarnings: true })).toBe(409);
    drive(3_000);
    expect(await same('TECHNICIAN', 'GET', CURRENT)).toBe(200);
    // RECORDING: another session is still 404; the open one is refused for its reason, last.
    expect(await same('SUPERVISOR', 'POST', on(OTHER_SESSION, 'stop'), { reason: 'Done' })).toBe(404);
    expect(await same('SUPERVISOR', 'POST', on(id, 'stop'), { reason: 'Done' })).toBe(422);
    expect(await same('SUPERVISOR', 'POST', on(id, 'stop'), { reason: '   ab   ' })).toBe(422);
    expect(await same('SUPERVISOR', 'POST', on(id, 'stop'), {})).toBe(422);
    expect(await same('SUPERVISOR', 'POST', on(id, 'stop'), { reason: 'Done.' })).toBe(202);
    expect(await same('SUPERVISOR', 'POST', on(id, 'stop'), { reason: 'Done.' })).toBe(409);
    // STOPPING, and later SEALED: 409 with a short reason too.
    expect(await same('SUPERVISOR', 'POST', on(id, 'stop'), { reason: 'x' })).toBe(409);
    drive(20_000);
    expect(await same('TECHNICIAN', 'GET', CURRENT)).toBe(200);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'stop'), {})).toBe(409);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'start'))).toBe(409);
    expect(await same('INVESTIGATOR', 'POST', SESSION, { ...input, caseNumber: 'LP/2026/1001-0100' })).toBe(201);
    expect(differences).toEqual([]);
  });

  it('a blocked pre-check: 409 PRECHECK_BLOCKED on both, with the same text', async () => {
    const { unit, twin, same, drive, differences } = await twins((actions) => actions.setTabletLink('OFFLINE'));
    const input = sessionInput(unit.memory.host.operator('INVESTIGATOR').id);
    expect(await same('INVESTIGATOR', 'POST', SESSION, input)).toBe(201);
    const id = unit.memory.session?.id ?? '';
    expect(await same('INVESTIGATOR', 'POST', on(id, 'start'))).toBe(202);
    drive(5_000);
    expect(await same('INVESTIGATOR', 'POST', on(id, 'start'), { acknowledgeWarnings: true })).toBe(409);
    expect(differences).toEqual([]);
    unit.actAs('INVESTIGATOR');
    const mine = errorOf(await unit.post(on(id, 'start')));
    const theirs = twin.runAs(twin.operator('INVESTIGATOR'), () => twin.sim.request({ method: 'POST', path: on(id, 'start') })).body as { error: { code: string; message: string } };
    expect([mine.code, mine.message]).toEqual([theirs.error.code, theirs.error.message]);
    expect(mine.message).toBe('Start blocked: Core link offline');
  });

  it('a short stop reason no longer differs (decision D94); where the server still differs from the simulator\'s REST layer, by the specification: who is refused first, and the SHAPE of a body before the session', async () => {
    const { unit, twin, same, differences } = await twins(() => {});
    const simulated = (path: string, body: unknown): [number, string | null] => {
      const answer = twin.runAs(twin.operator('INVESTIGATOR'), () => twin.sim.request({ method: 'POST', path, body }));
      return [answer.status, (answer.body as { error?: { code?: string } } | undefined)?.error?.code ?? null];
    };
    // The case the old order got wrong: a short reason on a session that is not open is 404 on both.
    expect(await same('INVESTIGATOR', 'POST', on(OTHER_SESSION, 'stop'), { reason: 'x' })).toBe(404);
    expect(differences).toEqual([]);

    // Spec §7.3: the server answers 401 before it reads a body; the simulator answers 400 first.
    unit.actAs(null);
    expect((await unit.post(SESSION, '[]')).statusCode).toBe(401);
    expect(twin.sim.request({ method: 'POST', path: SESSION, body: '[]' }).status).toBe(400);

    // Spec §7.3 line 8 before line 10: a reason that is NOT TEXT is the schema stage's
    // `INVALID_INPUT`, before the session is looked at. The simulator's REST layer has no
    // schema stage: it reads such a reason as the empty text and answers in its own order.
    unit.actAs('INVESTIGATOR');
    for (const reason of [12_345, null]) {
      expect(outcome(await unit.post(on(OTHER_SESSION, 'stop'), { reason }))).toEqual([422, 'INVALID_INPUT']);
      expect(simulated(on(OTHER_SESSION, 'stop'), { reason })).toEqual([404, 'NOT_FOUND']);
    }
    // The same on a recording: `INVALID_INPUT` here, `INVALID_REASON` there. Both are 422.
    for (const host of [unit.memory.host, twin]) {
      host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.createSession(sessionInput(host.operator('INVESTIGATOR').id)));
      host.sim.actions.setTabletLink('CONNECTED');
      host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.beginPrecheck());
      host.drive(5_000);
      host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.startRecording());
    }
    const id = unit.memory.session?.id ?? '';
    expect(unit.memory.session?.state).toBe('RECORDING');
    expect(outcome(await unit.post(on(id, 'stop'), { reason: 12_345 }))).toEqual([422, 'INVALID_INPUT']);
    expect(simulated(on(id, 'stop'), { reason: 12_345 })).toEqual([422, 'INVALID_REASON']);
    // And where the contract counts characters and the simulator code units: three two-unit
    // characters are too short for the contract (422) and a reason of six for the simulator (202).
    expect(outcome(await unit.post(on(id, 'stop'), { reason: ASTRAL.repeat(3) }))).toEqual([422, 'INVALID_REASON']);
    expect(simulated(on(id, 'stop'), { reason: ASTRAL.repeat(3) })).toEqual([202, null]);
    expect(unit.memory.session?.state).toBe('RECORDING');
  });
});

describe('MODG: every documented status of operations 24 to 38 was produced above, and every answer validated', () => {
  it('the ledger of this file equals the registry, status for status', () => {
    const lines: string[] = [];
    for (const operationId of SESSION_OPERATION_IDS) {
      const documented = Object.keys(operationOf(operationId).responses)
        .map(Number)
        .sort((a, b) => a - b);
      const produced = ledger.get(operationId) ?? new Map<number, Set<string>>();
      // The 200 of the history needs PostgreSQL: it is produced and validated in history.db.test.ts.
      const here = operationId === 'listSessionHistory' ? documented.filter((status) => status !== 200) : documented;
      const got = [...produced.keys()].filter((status) => status !== 503).sort((a, b) => a - b);
      expect(got, operationId).toEqual(here);
      lines.push(
        `${operationId}: ${documented
          .map((status) => `${status}${produced.has(status) ? ` (${[...(produced.get(status) ?? [])].sort().join(', ')})` : ' (history.db.test.ts)'}`)
          .join('; ')}`,
      );
    }
    console.info(`[w34] MODG statuses produced and validated against the contract, per operation:\n${lines.map((line) => `[w34]   ${line}`).join('\n')}`);
  });
});
