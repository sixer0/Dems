// The routes of the evidence module against the contract registry, and what each handler does
// with what the engine host and the pool give it (plan row W35; module gate MODG; spec §7.2,
// §7.3, §7.9; SR-64, SR-66; decision D83 rules M2 to M4, M7, M8).
//
// In-process, no database: the real app factory with the REAL stages 2, 3, 5 and 6. Stage 4 is a
// stand-in that gives the request the principal a test names (rule M9), the seam `engine` is a
// stub that records what a handler hands it, and the pool refuses every connection. What the
// hosted actions and the reads do against PostgreSQL is in the `*.db.test.ts` files.
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
  VERIFY_NOT_SEALED_EXAMPLE,
  VERIFY_NOT_SEALED_TEXT,
} from '@dems/shared/api';
import { ROLE_PERMISSIONS, SimErrorCode, SimNotFoundError, SimPermissionError, SimTransitionError, type EvidenceVerifyResult, type ExportResult, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse, RouteOptions } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../app';
import { simRefusal, type EngineHost } from '../../../engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { ApiFailure, notReady } from '../../../plugins/error-envelope';
import type { ErrorLogEntry } from '../../../plugins/logger';
import { permissionGuard, routePatternOf } from '../../../plugins/permission-guard';
import { EVIDENCE_MODULE_OPERATIONS, evidenceVerification } from '../index';
import { NO_REASON } from '../export-request';
import { EVIDENCE, UNKNOWN_EVIDENCE_ID, WEB_ORIGIN, archiveUrl, errorOf, exportUrl, itemUrl, outcomeOf, verifyUrl } from './support';

const ID = 'EV-20260930-0004';
const EPOCH = 7;
const REVISION = 42;
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
  /** How often a read reached the pool: a connection asked for, or a statement that is not the readiness probe's. */
  readonly connects: () => number;
  /** The entries this module wrote into the persistent error log. */
  readonly persisted: ErrorLogEntry[];
  actAs(principal: Principal): void;
  /** What the next commands answer: a value, or a function that returns or throws. */
  engineAnswers(answer: unknown | ((call: EngineCall) => unknown)): void;
  get(url: string): Promise<LightMyRequestResponse>;
  post(url: string, payload?: InjectOptions['payload'], headers?: Record<string, string>): Promise<LightMyRequestResponse>;
}

const MARKER = 'MARK-w35-driver-text';

/** The real app; the pool refuses every connection with `failure`; the engine is a stub. */
async function build(failure: Error = Object.assign(new Error(`connect refused ${MARKER}`), { code: 'ECONNREFUSED' })): Promise<Built> {
  const log = captureLog();
  let connects = 0;
  // A stand-in is no `pg.Pool`, so the query builder sends its `begin` through `query` instead
  // of asking for a connection first; against the real pool it asks (the database tests).
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
  // Before the units load: every route they add is seen.
  app.addHook('onRoute', (route) => void registered.push(route));
  let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
  // Stage 4 as a stand-in; stage 6 is the real one.
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);

  const calls: EngineCall[] = [];
  let answer: unknown | ((call: EngineCall) => unknown) = undefined;
  const engine = {
    epoch: EPOCH,
    revision: REVISION,
    running: true,
    // Fix pass F-M8: operation 42 asks the committed state whether the item has a sealed package here. This stub holds none.
    state: () => ({ audit: { rows: [] }, evidence: [] }),
    async command(principal: Principal, action: string, ...args: unknown[]) {
      const call = { principal, action, args };
      calls.push(call);
      const value: unknown = typeof answer === 'function' ? (answer as (call: EngineCall) => unknown)(call) : answer;
      return { value, epoch: EPOCH, revision: REVISION };
    },
  };
  app.seams.replace('engine', engine as unknown as EngineHost);

  const persisted: ErrorLogEntry[] = [];
  vi.spyOn(app.errorLog, 'append').mockImplementation((entry) => {
    // The pool's own entry for a failed readiness probe is another unit's.
    if (entry.source.startsWith('evidence.')) persisted.push(entry);
  });

  return {
    app,
    registered,
    log,
    calls,
    connects: () => connects,
    persisted,
    actAs: (principal) => void (current = principal),
    engineAnswers: (next) => void (answer = next),
    get: (url) => app.inject({ method: 'GET', url }),
    post: (url, payload, headers = {}) =>
      app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...headers }, ...(payload === undefined ? {} : { payload }) }),
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

const VERDICT: EvidenceVerifyResult = {
  evidenceId: ID,
  ok: true,
  at: 1_790_823_600_000,
  tracks: (['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'] as const).map((trackId, index) => ({
    trackId,
    expected: String(index + 1).repeat(64),
    actual: String(index + 1).repeat(64),
    ok: true,
  })),
  manifestOk: true,
  signatureOk: true,
};

/** The refusal the engine host throws for what a hosted action threw (spec §7.2). */
function hostRefusal(error: unknown): ApiFailure {
  const failure = simRefusal(error);
  if (failure === null) throw new Error('not a refusal of the simulator');
  return failure;
}

const signature = (method: string, path: string, operationId: string): string => `${method.toUpperCase()} ${path} ${operationId}`;

describe('MODG: the route list of the module equals the registry operations it owns', () => {
  // Task 3 (schema v2, C3 §2.2) added operations 84 to 88 under the tag Evidence and the path
  // /api/v1/evidence. They are NOT this module's: the transcript read and its revisions (84 to 86),
  // the export job (87, the evidence-export unit of row 91) and the media session (88, the
  // media-stream unit of row 90). Until integration pass D1b the lists below were the five alone,
  // which the registry - and then the mounted routes - outgrew.
  const TASK_3_EVIDENCE_OPERATIONS = ['getTranscript', 'createTranscriptRevision', 'listTranscriptRevisions', 'getEvidenceExportJob', 'createEvidenceMediaSession'];

  it('registers operations 39 to 43 with the method, the path and the operation ID of the registry; nothing else under /api/v1/evidence but task 3\'s operations of other units', async () => {
    const { registered } = await build();
    const fromRegistry = EVIDENCE_MODULE_OPERATIONS.map((operationId) => {
      const operation = findCoreApiOperation(operationId);
      if (operation === undefined) throw new Error(`no operation ${operationId}`);
      return signature(operation.method, routePatternOf(operation.path), operation.operationId);
    });
    const underPath = registered.filter((route) => route.url.startsWith(EVIDENCE));
    const mine = underPath.filter((route) => (EVIDENCE_MODULE_OPERATIONS as readonly string[]).includes(String(route.config?.operationId)));
    // Whatever else is mounted under the path is one of task 3's five, registered by its own unit - never an unnamed route.
    const others = underPath.filter((route) => !mine.includes(route)).map((route) => String(route.config?.operationId));
    expect(others.filter((operationId) => !TASK_3_EVIDENCE_OPERATIONS.includes(operationId))).toEqual([]);
    expect(new Set(others).size).toBe(others.length);
    const fromModule = mine.map((route) => signature(String(route.method), route.url, String(route.config?.operationId)));

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'GET /api/v1/evidence listEvidence',
      'GET /api/v1/evidence/:id getEvidence',
      'POST /api/v1/evidence/:id/verify verifyEvidence',
      'POST /api/v1/evidence/:id/export exportEvidence',
      'POST /api/v1/evidence/:id/archive archiveEvidence',
    ]);
    console.info(`[w35] MODG routes of src/modules/evidence: ${fromModule.join(' | ')}`);
    console.info(`[w35] MODG registry, operations 39 to 43:   ${fromRegistry.join(' | ')}`);
    // Each route, called with an ID, is matched by the registry to the operation it names.
    for (const route of underPath) {
      expect(matchCoreApiOperation(String(route.method), route.url.replace(':id', ID))?.operation.operationId).toBe(route.config?.operationId);
    }
  });

  it('the area of the registry is these five and the five of task 3 that other units own: the four of contract C are numbered 39, 40, 41 and 43, and 42 is the design-book operation', () => {
    const tagged = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.EVIDENCE).map((operation) => operation.operationId);
    expect([...tagged].sort()).toEqual([...EVIDENCE_MODULE_OPERATIONS, ...TASK_3_EVIDENCE_OPERATIONS].sort());
    expect(TASK_3_EVIDENCE_OPERATIONS.map((operationId) => Number(/operation (\d+)/.exec(findCoreApiOperation(operationId)?.source ?? '')?.[1]))).toEqual([84, 85, 86, 87, 88]);
    // The module's own area: the five it registers, no more.
    const area = tagged.filter((operationId) => (EVIDENCE_MODULE_OPERATIONS as readonly string[]).includes(operationId));
    expect([...area].sort()).toEqual([...EVIDENCE_MODULE_OPERATIONS].sort());
    const numberOf = (operationId: string): number => Number(/operation (\d+)/.exec(findCoreApiOperation(operationId)?.source ?? '')?.[1]);
    expect(['listEvidence', 'getEvidence', 'verifyEvidence', 'archiveEvidence'].map(numberOf)).toEqual([39, 40, 41, 43]);
    expect(findCoreApiOperation('exportEvidence')?.source).toContain('Design book');
    // No operation of the module's area returns a file or takes one (MS-1, SR-66). Media leaves
    // the Core only through operation 88's session (the media-stream unit), never through these five.
    for (const operationId of area) {
      const operation = findCoreApiOperation(operationId);
      expect(operation?.path).not.toMatch(/media|file|download|upload|package/);
    }
  });

  it('the access rule of each route is the registry\'s, as the guard holds it: one permission each, EXPORT_DENIED and FORBIDDEN for the export only', async () => {
    const { app } = await build();
    const rules = permissionGuard(app)
      .registeredRules()
      .filter((rule) => (EVIDENCE_MODULE_OPERATIONS as readonly string[]).includes(rule.operationId));
    expect(rules.map((rule) => [rule.operationId, rule.method, rule.url, rule.kind, rule.permissions, rule.denial?.auditType, rule.denial?.errorCode])).toEqual([
      ['listEvidence', 'GET', '/api/v1/evidence', CoreApiAccessKind.PERMISSION, ['EVIDENCE_VIEW'], 'ACCESS_DENIED', 'NOT_PERMITTED'],
      ['getEvidence', 'GET', '/api/v1/evidence/:id', CoreApiAccessKind.PERMISSION, ['EVIDENCE_VIEW'], 'ACCESS_DENIED', 'NOT_PERMITTED'],
      ['verifyEvidence', 'POST', '/api/v1/evidence/:id/verify', CoreApiAccessKind.PERMISSION, ['EVIDENCE_VIEW'], 'ACCESS_DENIED', 'NOT_PERMITTED'],
      ['exportEvidence', 'POST', '/api/v1/evidence/:id/export', CoreApiAccessKind.PERMISSION, ['EVIDENCE_EXPORT'], 'EXPORT_DENIED', 'FORBIDDEN'],
      ['archiveEvidence', 'POST', '/api/v1/evidence/:id/archive', CoreApiAccessKind.PERMISSION, ['EVIDENCE_REVIEW'], 'ACCESS_DENIED', 'NOT_PERMITTED'],
    ]);
    expect(permissionGuard(app).routeProblems()).toEqual([]);
  });

  it('no route carries a check of its own: no hook beside the stage hook, and no rule in its configuration (rule M3)', async () => {
    const { registered } = await build();
    for (const route of registered.filter((candidate) => candidate.url.startsWith(EVIDENCE))) {
      for (const hook of ['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend'] as const) {
        expect(route[hook], `${String(route.config?.operationId)} ${hook}`).toBeUndefined();
      }
      expect(Object.keys(route.config ?? {}).filter((key) => key !== 'url' && key !== 'method')).toEqual(['operationId']);
    }
  });

  it('each command is one hosted action of the contract\'s table, and the two reads are none', () => {
    expect(simActionsOfOperation('verifyEvidence')).toEqual(['verify']);
    expect(simActionsOfOperation('exportEvidence')).toEqual(['exportEvidence']);
    expect(simActionsOfOperation('archiveEvidence')).toEqual(['archiveEvidence']);
    expect(simActionsOfOperation('listEvidence')).toEqual([]);
    expect(simActionsOfOperation('getEvidence')).toEqual([]);
  });
});

describe('who may call is stage 6: a caller without an operator session reaches no handler', () => {
  const requests: ReadonlyArray<readonly [operationId: string, method: 'GET' | 'POST', url: string]> = [
    ['listEvidence', 'GET', EVIDENCE],
    ['getEvidence', 'GET', itemUrl(ID)],
    ['verifyEvidence', 'POST', verifyUrl(ID)],
    ['exportEvidence', 'POST', exportUrl(ID)],
    ['archiveEvidence', 'POST', archiveUrl(ID)],
  ];

  it.each(requests)('%s: nobody, and a paired device without an operator, answer 401 NOT_SIGNED_IN; no read and no command runs', async (operationId, method, url) => {
    const built = await build();
    for (const principal of [{ kind: 'ANONYMOUS', retiredDeviceId: null }, { kind: 'DEVICE', deviceId: 'DEV-0001' }] as const) {
      built.actAs(principal);
      const response = method === 'GET' ? await built.get(url) : await built.post(url, { reason: 'A reason of the test' });
      expect(outcomeOf(response)).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(operationId, 401, response.json())).toEqual({ ok: true });
    }
    expect(built.calls).toEqual([]);
    expect(built.connects()).toBe(0);
  });

  it('a 401 is decided before the body is read: a body that is not JSON, and one that breaks the schema, answer 401 all the same', async () => {
    const built = await build();
    const notJson = await built.app.inject({ method: 'POST', url: exportUrl(ID), headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' }, payload: '{not json' });
    expect(outcomeOf(notJson)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcomeOf(await built.post(exportUrl(ID), { reason: 7 }))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcomeOf(await built.get(`${EVIDENCE}?limit=0`))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcomeOf(await built.get(itemUrl('not-an-id')))).toEqual([401, 'NOT_SIGNED_IN']);
  });
});

describe('operation 39 listEvidence: the query (SR-64)', () => {
  const badQueries = [
    'limit=0',
    'limit=201',
    'limit=1.5',
    'limit=many',
    'limit=-1',
    'status=SEALD',
    'status=sealed',
    'status=SEALED&status=EXPORTED',
    'caseType=WITNESS',
    'q=',
    'q=%20%20',
    `q=${'x'.repeat(101)}`,
    'q=a%00b',
    'cursor=',
    'cursor=has_underscore',
    `cursor=${'c'.repeat(129)}`,
  ];

  it.each(badQueries)('?%s answers 422 INVALID_INPUT with details.in querystring, before any read', async (query) => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    const response = await built.get(`${EVIDENCE}?${query}`);
    expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(response).details).toEqual({ in: 'querystring' });
    expect(validateCoreApiResponse('listEvidence', 422, response.json())).toEqual({ ok: true });
    expect(built.connects()).toBe(0);
  });

  it('a value of the form of a bearer session token is no cursor: the underscore of its prefix is outside the pattern (CL-6a)', async () => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    // Made of fragments and never part of a test name: the form of a token, the value of none.
    const tokenForm = `${['ses', '0'.repeat(43)].join('_')}`;
    const response = await built.get(`${EVIDENCE}?cursor=${tokenForm}`);
    expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(response).details).toEqual({ in: 'querystring' });
    expect(built.connects()).toBe(0);
    expect(built.log.text()).not.toContain(tokenForm);
  });

  it.each(['abc', '42', 'EV-20260930-0004', '1790823600000-EV-20260930-004', '9007199254740992-EV-20260930-0004', '01-EV-20260930-0004'])(
    'a cursor that has the form of one and is none of this list (%s) answers the same 422, before any read',
    async (cursor) => {
      const built = await build();
      built.actAs(operator('TECHNICIAN'));
      const response = await built.get(`${EVIDENCE}?cursor=${cursor}`);
      expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details).toEqual({ in: 'querystring' });
      expect(built.connects()).toBe(0);
    },
  );

  it('a query the contract accepts reaches the read: every member is optional, an unknown member is dropped', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    const accepted = ['', '?limit=1', '?limit=200', '?status=SEALED', '?caseType=SAKSI', '?q=budi', '?cursor=1790823600000-EV-20260930-0004', '?status=ARCHIVED&caseType=TERSANGKA&q=%20lp%2F2026%20&limit=20', '?unknown=1'];
    for (const [index, query] of accepted.entries()) {
      // The pool refuses the read: it was tried, which is what this test is about. A failed read
      // makes the server probe the database and report itself not ready, so the flag is set
      // again for the next request, once the probe of the one before has ended.
      await built.app.db.probe();
      built.app.readiness.set('database', true);
      expect(outcomeOf(await built.get(`${EVIDENCE}${query}`)), query).toEqual([503, 'NOT_READY']);
      expect(built.connects(), query).toBe(index + 1);
    }
    expect(built.persisted).toHaveLength(accepted.length);
  });
});

describe('operations 39 and 40: a database that does not answer', () => {
  it.each([
    ['listEvidence', EVIDENCE],
    ['getEvidence', itemUrl(ID)],
  ])('%s answers 503 NOT_READY, logs the error under the key err with the driver\'s code and never its message, persists one entry and probes the database', async (operationId, url) => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    const probe = vi.spyOn(built.app.db, 'probe');
    const response = await built.get(url);

    expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
    expect(validateCoreApiResponse(operationId, 503, response.json())).toEqual({ ok: true });
    // The one line of the pool plugin's helper (`app.db.read`), written with the request's logger.
    const line = built.log.lines().find((entry) => entry['msg'] === 'a read on the pool failed');
    expect(line).toMatchObject({ level: 50, source: `evidence.${operationId}`, reqId: errorOf(response).requestId, err: { code: 'ECONNREFUSED' } });
    expect(built.log.text()).not.toContain(MARKER);
    expect(response.body).not.toContain(MARKER);

    expect(built.persisted).toHaveLength(1);
    expect(built.persisted[0]).toMatchObject({
      level: 'error',
      source: `evidence.${operationId}`,
      message: 'a read on the pool failed',
      errorName: 'Error',
      code: 'ECONNREFUSED',
      context: { requestId: errorOf(response).requestId },
    });
    expect(JSON.stringify(built.persisted)).not.toContain(MARKER);
    expect(probe).toHaveBeenCalledWith({ fresh: true });
    expect(built.calls).toEqual([]);
  });

  it('the code of a failure the query builder wrapped is the driver\'s: the wrapper\'s message, which quotes the statement, is never read', async () => {
    const driver = Object.assign(new Error('relation does not exist'), { code: '42P01' });
    const wrapped = new Error(`Failed query: select … where subject_name = ${MARKER}`, { cause: driver });
    const built = await build(wrapped);
    built.actAs(operator('SUPERVISOR'));
    const response = await built.get(`${EVIDENCE}?q=${MARKER}`);
    expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
    expect(built.log.lines().find((entry) => entry['msg'] === 'a read on the pool failed')).toMatchObject({ source: 'evidence.listEvidence', err: { code: '42P01' } });
    expect(built.persisted[0]).toMatchObject({ code: '42P01' });
    expect(built.log.text()).not.toContain(MARKER);
    expect(JSON.stringify(built.persisted)).not.toContain(MARKER);
  });
});

describe('the path parameter of operations 40, 41 and 43 (rule M7)', () => {
  const malformed = ['EV-2026093-0004', 'ev-20260930-0004', 'EV-20260930-00045', 'SES-20260930-0004', '0004', 'EV-20260930-0004%20', '..%2F..%2Fetc', 'EV-20260930-0004%00'];

  it.each([
    ['getEvidence', 'GET', itemUrl],
    ['verifyEvidence', 'POST', verifyUrl],
    ['archiveEvidence', 'POST', archiveUrl],
  ] as const)('%s: an ID that is no evidence ID answers 422 INVALID_INPUT with details.in params; nothing is read and no action runs', async (operationId, method, url) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    for (const id of malformed) {
      const response = method === 'GET' ? await built.get(url(id)) : await built.post(url(id));
      expect(outcomeOf(response), id).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details, id).toEqual({ in: 'params' });
      expect(validateCoreApiResponse(operationId, 422, response.json())).toEqual({ ok: true });
    }
    expect(built.calls).toEqual([]);
    expect(built.connects()).toBe(0);
  });
});

describe('operation 41 verifyEvidence: the hosted action `verify`', () => {
  it('hands the engine the principal of the request as it is and the ID of the path, and answers the verdict with the state position', async () => {
    const built = await build();
    const caller = operator('TECHNICIAN');
    built.actAs(caller);
    built.engineAnswers(VERDICT);
    const response = await built.post(verifyUrl(ID));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(VERDICT);
    expect(validateCoreApiResponse('verifyEvidence', 200, response.json())).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(EPOCH));
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(REVISION));
    expect(built.calls).toHaveLength(1);
    expect(built.calls[0]?.action).toBe('verify');
    expect(built.calls[0]?.args).toEqual([ID]);
    // The very object stage 4 set: the actor never comes from a request field (SR-65).
    expect(built.calls[0]?.principal).toBe(caller);
  });

  it('a failed verification is an answer, not an error: 200 with ok false', async () => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    const failed: EvidenceVerifyResult = { ...VERDICT, ok: false, tracks: VERDICT.tracks.map((track) => (track.trackId === 'AUDIO-02' ? { ...track, actual: 'f'.repeat(64), ok: false } : track)) };
    built.engineAnswers(failed);
    const response = await built.post(verifyUrl(ID));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(failed);
    expect(validateCoreApiResponse('verifyEvidence', 200, response.json())).toEqual({ ok: true });
  });

  it('fix wave J (truth rule 3a; JA2-01 / JW-01): an item that was never sealed - 409 NOT_SEALED "nothing sealed to verify", the contract\'s example, and no verdict leaves the server', async () => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    built.engineAnswers(() => {
      throw hostRefusal(new SimTransitionError(null, 'verify', 'the item was never sealed: there is nothing sealed to verify', SimErrorCode.UNSEALED_EVIDENCE));
    });
    const response = await built.post(verifyUrl(ID));
    expect(outcomeOf(response)).toEqual([409, 'NOT_SEALED']);
    // The wording of THIS operation - not the archive's "cannot be archived".
    expect(errorOf(response)).toMatchObject({ message: VERIFY_NOT_SEALED_TEXT, details: { simCode: 'UNSEALED_EVIDENCE', from: null, event: 'verify' } });
    expect(errorOf(response)).toMatchObject({ code: VERIFY_NOT_SEALED_EXAMPLE.value.error.code, message: VERIFY_NOT_SEALED_EXAMPLE.value.error.message, details: VERIFY_NOT_SEALED_EXAMPLE.value.error.details });
    expect(validateCoreApiResponse('verifyEvidence', 409, response.json())).toEqual({ ok: true });
    // A refusal carries no state position: nothing was committed.
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    expect(response.json()).not.toHaveProperty('ok');
  });

  it('fix wave J (JA2-02): a verdict of the simulator leaves the server WITH its mark `demonstration: true`', async () => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    built.engineAnswers({ ...VERDICT, demonstration: true });
    const response = await built.post(verifyUrl(ID));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, demonstration: true });
    expect(validateCoreApiResponse('verifyEvidence', 200, response.json())).toEqual({ ok: true });
  });

  it('an unknown item: the host\'s 404 passes with its details and the wording of this area, and without the state headers', async () => {
    const built = await build();
    built.actAs(operator('INVESTIGATOR'));
    built.engineAnswers(() => {
      throw hostRefusal(new SimNotFoundError('evidence', UNKNOWN_EVIDENCE_ID));
    });
    const response = await built.post(verifyUrl(UNKNOWN_EVIDENCE_ID));
    expect(outcomeOf(response)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(response)).toMatchObject({ message: 'Evidence not found.', details: { simCode: 'NOT_FOUND' } });
    expect(validateCoreApiResponse('verifyEvidence', 404, response.json())).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    // The simulator's own message names the ID; the answer does not repeat it.
    expect(response.body).not.toContain(UNKNOWN_EVIDENCE_ID);
  });

  it('a verdict that is not the contract\'s shape never leaves the server: the response schema refuses it (500)', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers({ ...VERDICT, filePath: '/var/dems/evidence/0004/audio-02.wav' });
    const response = await built.post(verifyUrl(ID));
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('/var/dems');
  });

  it('what is not a refusal of the simulator passes unchanged: a unit that was not committed is 503, an unexpected failure 500', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(() => {
      throw notReady();
    });
    expect(outcomeOf(await built.post(verifyUrl(ID)))).toEqual([503, 'NOT_READY']);
    built.engineAnswers(() => {
      throw new TypeError(`unexpected ${MARKER}`);
    });
    const failed = await built.post(verifyUrl(ID));
    expect(outcomeOf(failed)).toEqual([500, 'INTERNAL_ERROR']);
    expect(failed.body).not.toContain(MARKER);
    // A refusal whose code has no wording here keeps the host's text.
    built.engineAnswers(() => {
      throw hostRefusal(new SimPermissionError('verify', 'EVIDENCE_VIEW'));
    });
    const refused = await built.post(verifyUrl(ID));
    expect(outcomeOf(refused)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(refused)).toMatchObject({ message: 'Your role does not allow this action.', details: { simCode: 'NOT_PERMITTED', permission: 'EVIDENCE_VIEW' } });
  });
});

describe('operation 41 verifyEvidence: an item with a real sealed package (task 3 row 85)', () => {
  const REAL_ID = 'EV-20261009-0001';
  const REAL_VERDICT = {
    evidenceId: REAL_ID,
    ok: false,
    at: 1_791_600_000_000,
    tracks: [],
    files: [
      { fileId: 'fragments/VIDEO-01.mp4', trackId: 'VIDEO-01', storedOk: true, plainOk: true, chainOk: true, fragmentCount: 5, ok: true },
      { fileId: 'fragments/VIDEO-02.mp4', trackId: 'VIDEO-02', storedOk: false, plainOk: false, chainOk: false, fragmentCount: 5, ok: false },
    ],
    transcriptOk: true,
    manifestOk: true,
    signatureOk: true,
  } as const;

  /** A provided verification that owns REAL_ID only and records what it was handed. */
  function provided(built: Built, answer: () => Promise<unknown>) {
    const asked: { principal: Principal; evidenceId: string }[] = [];
    evidenceVerification(built.app).provide({
      verify: async (principal, evidenceId) => {
        asked.push({ principal, evidenceId });
        return evidenceId === REAL_ID ? ((await answer()) as never) : null;
      },
    });
    return asked;
  }

  it('the verdict of the provided verification is the answer, in the contract\'s v2 shape, and the simulator is not asked', async () => {
    const built = await build();
    const caller = operator('INVESTIGATOR');
    built.actAs(caller);
    const asked = provided(built, async () => REAL_VERDICT);
    const response = await built.post(verifyUrl(REAL_ID));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(REAL_VERDICT);
    expect(validateCoreApiResponse('verifyEvidence', 200, response.json())).toEqual({ ok: true });
    expect(built.calls).toEqual([]);
    // The principal of stage 4, whole; the ID of the path.
    expect(asked).toHaveLength(1);
    expect(asked[0]?.principal).toBe(caller);
    expect(asked[0]?.evidenceId).toBe(REAL_ID);
  });

  it('an item the provided verification does not own takes the hosted `verify` exactly as before', async () => {
    const built = await build();
    built.actAs(operator('TECHNICIAN'));
    built.engineAnswers(VERDICT);
    const asked = provided(built, async () => REAL_VERDICT);
    const response = await built.post(verifyUrl(ID));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(VERDICT);
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(EPOCH));
    expect(asked.map((entry) => entry.evidenceId)).toEqual([ID]);
    expect(built.calls.map((call) => [call.action, call.args])).toEqual([['verify', [ID]]]);
  });

  it('a verification that fails to record its verdict answers no verdict, and the simulator is NOT used in its place', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(VERDICT);
    let failure: Error = notReady();
    provided(built, async () => Promise.reject(failure));
    expect(outcomeOf(await built.post(verifyUrl(REAL_ID)))).toEqual([503, 'NOT_READY']);
    failure = new TypeError(`unexpected ${MARKER}`);
    const failed = await built.post(verifyUrl(REAL_ID));
    expect(outcomeOf(failed)).toEqual([500, 'INTERNAL_ERROR']);
    expect(failed.body).not.toContain(MARKER);
    expect(built.calls).toEqual([]);
  });

  it('a verdict with a member the contract does not have never leaves the server (500): no path, no hash of a run', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    provided(built, async () => ({ ...REAL_VERDICT, packageDir: '/var/dems/media/sessions/SES-1' }));
    const response = await built.post(verifyUrl(REAL_ID));
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('/var/dems');
  });

  it('who may call is still stage 6: without an operator session the provided verification is not reached', async () => {
    const built = await build();
    const asked = provided(built, async () => REAL_VERDICT);
    expect((await built.post(verifyUrl(REAL_ID))).statusCode).toBe(401);
    expect(asked).toEqual([]);
  });

  it('a verification is provided once per app', async () => {
    const built = await build();
    provided(built, async () => REAL_VERDICT);
    expect(() => provided(built, async () => REAL_VERDICT)).toThrow(/provided twice/);
  });
});

describe('operation 43 archiveEvidence: the hosted action `archiveEvidence`', () => {
  it('answers 204 without a body, with the state position; the engine gets the principal and the ID', async () => {
    const built = await build();
    const caller = operator('SUPERVISOR');
    built.actAs(caller);
    built.engineAnswers(undefined);
    const response = await built.post(archiveUrl(ID));
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(validateCoreApiResponse('archiveEvidence', 204, undefined)).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(EPOCH));
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(REVISION));
    expect(built.calls.map((call) => [call.action, call.args, call.principal === caller])).toEqual([['archiveEvidence', [ID], true]]);
  });

  it('a body is not read into the command: whatever is sent, the action gets the ID only', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(undefined);
    const response = await built.post(archiveUrl(ID), { id: 'EV-20260930-0001', operatorId: 'OPR-001', at: 1 });
    expect(response.statusCode).toBe(204);
    expect(built.calls[0]?.args).toEqual([ID]);
  });

  it('an item that was never sealed: 409 NOT_SEALED with the simulator\'s code, its event, and the wording of this area', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(() => {
      throw hostRefusal(new SimTransitionError(null, 'archiveEvidence', 'unsealed (RECORDED) evidence cannot be archived', SimErrorCode.UNSEALED_EVIDENCE));
    });
    const response = await built.post(archiveUrl(ID));
    expect(outcomeOf(response)).toEqual([409, 'NOT_SEALED']);
    expect(errorOf(response)).toMatchObject({
      message: 'Unsealed evidence cannot be archived.',
      details: { simCode: 'UNSEALED_EVIDENCE', from: null, event: 'archiveEvidence' },
    });
    expect(validateCoreApiResponse('archiveEvidence', 409, response.json())).toEqual({ ok: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
  });

  it('an unknown item: 404 NOT_FOUND', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(() => {
      throw hostRefusal(new SimNotFoundError('evidence', UNKNOWN_EVIDENCE_ID));
    });
    const response = await built.post(archiveUrl(UNKNOWN_EVIDENCE_ID));
    expect(outcomeOf(response)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(response)).toMatchObject({ message: 'Evidence not found.', details: { simCode: 'NOT_FOUND' } });
    expect(validateCoreApiResponse('archiveEvidence', 404, response.json())).toEqual({ ok: true });
  });
});

describe('operation 42 exportEvidence: the hosted action `exportEvidence`', () => {
  const ACCEPTED: ExportResult = { ok: true, status: 202, exportId: 'EXP-000032' };

  it('an accepted export answers 202 with the export ID, the ID of the path and QUEUED, and the state position', async () => {
    const built = await build();
    const caller = operator('SUPERVISOR');
    built.actAs(caller);
    built.engineAnswers(ACCEPTED);
    const response = await built.post(exportUrl(ID), { reason: '  Prosecutor request  ', destination: 'Case file transfer' });

    expect(response.statusCode).toBe(202);
    // The landed schema is `EvidenceExportAcceptedSchema` (op-42, C3 §2.4): the export is QUEUED
    // for the packaging worker, not EXPORTED at answer time (rows 48/51a re-pinned the literal).
    // R93-06 (fix F-M8): the job operation 87 polls is named, as the contract and the simulator have it.
    expect(response.json()).toEqual({ exportId: 'EXP-000032', evidenceId: ID, status: 'QUEUED', jobId: 'EXPJ-000032', archiveOnCore: false }); // fix wave K (G94b-06): no job of this Core, no archive
    expect(validateCoreApiResponse('exportEvidence', 202, response.json())).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(EPOCH));
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(REVISION));
    expect(built.calls).toHaveLength(1);
    expect(built.calls[0]?.action).toBe('exportEvidence');
    // The reason as the contract's schema trimmed it; the destination as sent.
    expect(built.calls[0]?.args).toEqual([ID, { reason: 'Prosecutor request', destination: 'Case file transfer' }]);
    expect(built.calls[0]?.principal).toBe(caller);
  });

  it('nothing but the reason and the destination of a body reaches the action: no actor, no time, no ID from the body', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(ACCEPTED);
    await built.post(exportUrl(ID), { reason: 'Prosecutor request', operatorId: 'OPR-001', actorId: 'OPR-001', at: 1, evidenceId: 'EV-20260930-0001', exportId: 'EXP-000001' });
    expect(built.calls[0]?.args).toEqual([ID, { reason: 'Prosecutor request', destination: '' }]);
  });

  it.each([
    ['NOT_FOUND', 404, 'Evidence not found.'],
    ['NOT_SEALED', 409, 'Only sealed evidence can be exported.'],
    ['SECURITY_FAULT', 409, 'A security fault blocks export.'],
    ['INVALID_REASON', 422, 'An export reason of at least 5 characters is required.'],
    ['FORBIDDEN', 403, 'Your role cannot export evidence (RBAC). The attempt was audited.'],
    ['NOT_SIGNED_IN', 401, 'Sign in first.'],
  ] as const)('a refusal in the result (%s) is answered after the command resolved: %i with the contract\'s text, no details, no state headers', async (reason, status, message) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers({ ok: false, status, reason });
    const response = await built.post(exportUrl(ID), { reason: 'Prosecutor request' });

    expect(outcomeOf(response)).toEqual([status, reason]);
    expect(errorOf(response).message).toBe(message);
    expect(errorOf(response).details).toBeUndefined();
    expect(validateCoreApiResponse('exportEvidence', status, response.json())).toEqual({ ok: true });
    expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    // The command RESOLVED with the refusal as its value: the unit ended as the engine decided.
    expect(built.calls).toHaveLength(1);
  });

  it.each([
    ['no body at all', undefined],
    ['an empty object', {}],
    ['an empty reason', { reason: '' }],
    ['four characters', { reason: 'abcd' }],
    ['a blank reason and a destination', { reason: '    ', destination: 'Case file' }],
  ])('a missing or too-short reason (%s) goes to the action as NO_REASON, which decides in its own order: 404, 409, 422', async (_label, payload) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    for (const [reason, status] of [['NOT_FOUND', 404], ['NOT_SEALED', 409], ['SECURITY_FAULT', 409], ['INVALID_REASON', 422]] as const) {
      built.engineAnswers({ ok: false, status, reason });
      expect(outcomeOf(await built.post(exportUrl(ID), payload))).toEqual([status, reason]);
    }
    expect(built.calls).toHaveLength(4);
    for (const call of built.calls) {
      expect(call.args).toEqual([ID, NO_REASON]);
      // The text the caller sent is not handed on.
      expect(JSON.stringify(call.args)).not.toContain('abcd');
      expect(JSON.stringify(call.args)).not.toContain('Case file');
    }
  });

  it.each([
    ['a reason that is a number', { reason: 12_345 }],
    ['a reason that is null', { reason: null }],
    ['a reason of 501 code units', { reason: 'r'.repeat(501) }],
    ['a reason that holds U+0000', { reason: 'abc\u0000def' }],
    ['a destination of 121 code units', { reason: 'Prosecutor request', destination: 'd'.repeat(121) }],
    ['a destination that is a number', { reason: 'Prosecutor request', destination: 7 }],
    ['a short reason and a destination that is too long', { reason: 'ab', destination: 'd'.repeat(121) }],
  ])('any other body that breaks the schema (%s) answers 422 INVALID_INPUT with details.in body, before the engine, also for an unknown ID', async (_label, payload) => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    for (const id of [ID, UNKNOWN_EVIDENCE_ID, 'not-an-id']) {
      const response = await built.post(exportUrl(id), payload);
      expect(outcomeOf(response), id).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details).toEqual({ in: 'body' });
      expect(validateCoreApiResponse('exportEvidence', 422, response.json())).toEqual({ ok: true });
    }
    expect(built.calls).toEqual([]);
  });

  it('a body that is not a JSON object answers 400 INVALID_JSON and one over the limit 413, both before the handler', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    const json = { origin: WEB_ORIGIN, 'content-type': 'application/json' };
    for (const payload of ['{not json', '["Prosecutor request"]', '"Prosecutor request"', 'null']) {
      const response = await built.app.inject({ method: 'POST', url: exportUrl(ID), headers: json, payload });
      expect(outcomeOf(response), payload).toEqual([400, 'INVALID_JSON']);
      expect(validateCoreApiResponse('exportEvidence', 400, response.json())).toEqual({ ok: true });
    }
    const large = await built.app.inject({ method: 'POST', url: exportUrl(ID), headers: json, payload: JSON.stringify({ reason: 'r'.repeat(70_000) }) });
    expect(outcomeOf(large)).toEqual([413, 'PAYLOAD_TOO_LARGE']);
    expect(built.calls).toEqual([]);
  });

  it('an ID that is no evidence ID answers 404 NOT_FOUND without a unit, as in Simulated mode; nothing of the path reaches the engine', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    for (const id of ['not-an-id', 'EV-2026093-0004', 'SES-20260930-0004', '..%2F..%2Fetc%2Fpasswd', 'EV-20260930-0004%00', `EV-20260930-0004${MARKER}`]) {
      for (const payload of [{ reason: 'Prosecutor request' }, { reason: 'ab' }, undefined]) {
        const response = await built.post(exportUrl(id), payload);
        expect(outcomeOf(response), id).toEqual([404, 'NOT_FOUND']);
        expect(errorOf(response).message).toBe('Evidence not found.');
        expect(validateCoreApiResponse('exportEvidence', 404, response.json())).toEqual({ ok: true });
        expect(response.body).not.toContain(MARKER);
      }
    }
    expect(built.calls).toEqual([]);
    expect(built.log.text()).not.toContain(MARKER);
    expect(built.log.text()).not.toContain('passwd');
  });

  it('a unit that was not committed is 503, and the answer carries no state position', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers(() => {
      throw notReady();
    });
    const response = await built.post(exportUrl(ID), { reason: 'Prosecutor request' });
    expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
  });
});

describe('what the module writes into the log (rule M8, SR-48)', () => {
  it('nothing of a request: no reason, no destination, no search text and no cursor is in any line', async () => {
    const built = await build();
    built.actAs(operator('SUPERVISOR'));
    built.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });
    await built.post(exportUrl(ID), { reason: 'MARK-reason-41c7 for the court', destination: 'MARK-destination-90aa' });
    built.engineAnswers({ ok: false, status: 422, reason: 'INVALID_REASON' });
    await built.post(exportUrl(ID), { reason: 'M-1', destination: 'MARK-destination-90aa' });
    await built.post(exportUrl(ID), { reason: 7, note: 'MARK-note-5d' });
    await built.get(`${EVIDENCE}?q=MARK-search-77e2`);
    await built.get(`${EVIDENCE}?cursor=MARK-cursor-12`);
    const text = built.log.text();
    for (const mark of ['MARK-reason-41c7', 'MARK-destination-90aa', 'MARK-note-5d', 'MARK-search-77e2', 'MARK-cursor-12']) expect(text, mark).not.toContain(mark);
    expect(JSON.stringify(built.persisted)).not.toContain('MARK-');
    // The request lines are there: the search above can find what it looks for.
    expect(built.log.lines().filter((line) => line['msg'] === 'request completed').length).toBeGreaterThanOrEqual(5);
  });
});
