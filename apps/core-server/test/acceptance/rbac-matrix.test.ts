// Acceptance test "role-by-endpoint matrix" of the DEMS Core server (plan row W47; success
// criterion SC4; AC-B-15, AC-B-16, AC-B-81; SR-73; spec §4.4, §6.6, §7, §12.1, §14.2).
//
// WHAT IS ASKED. Every one of the 99 operations of the contract registry answers each kind of
// caller exactly as the specification says, through the real pipeline stages.
//
// HOW A CELL GETS ITS EXPECTATION. The test loops over the registry's 75 entries. The expected
// answer of a cell is derived (`rbac-matrix.support.ts`) from the registry entry's access rule and
// from the role matrix STORED in the test's own database; it holds no list of operations and no
// expectation per operation. Two independent checks stand in front of the matrix: the registry
// against the operation tables of spec §7 (all 75 rows, read mechanically from the document), and
// the stored matrix against spec §4.4 and the shared role table.
//
// THE CALLERS. Sixteen columns over the 100 operations (the routed ones; see DEFERRED_ROUTE):
//   AC-B-15, five callers        an unauthenticated caller (a signed-out web console), an unpaired
//                                device (no credential, no Origin), and the three roles signed in
//                                on the web console;
//   the paired device            a paired device with no operator (its device credential), and
//                                the three roles signed in ON that device (the bearer path);
//   a retired device             the credential of a REVOKED device, the session token of an
//                                operator who was signed in on it, and the old credential of a
//                                device that unpaired itself (spec §4.1, §6.6, RB-6);
//   AC-B-81, credential misuse   the cookie and a bearer value together; a bearer value with a web
//                                console origin; a device session's token as the cookie; a web
//                                session's token as a bearer value.
// The row's "5 caller kinds" are read twice, and both readings are in the file: the five of
// AC-B-15 above (375 cells), and anonymous, a paired device and the three roles (375 cells).
//
// WHAT A CELL ASSERTS. For a refusal: status, error code, the named details of the answer and its
// reason (the one the specification names, or none); the
// audit rows written (exactly one `ACCESS_DENIED`, or `EXPORT_DENIED` with its event for the three
// exports, naming actor, device, operation, permission and role; none for a 401, a
// `DEVICE_NOT_PAIRED` or a `DEMO_DISABLED`); that the row count of every other table is unchanged
// (the engine's timed health snapshot apart); and that the request never passed stage 6 (a hook of
// the test after the stages and before the body is read). For a permitted call: that stage 6 let
// it through, that the answer is one the registry documents for the operation and is no refusal
// of the caller, and that no denial row was written. For every cell: who stage 4 resolved the
// caller to, that the answer is not 429, and that the call took exactly as many places in the
// denial budget of its key as it wrote rows of a counted type (by the server's own count).
//
// THE CONDITIONS OF AN ACCESS RULE (four: the console identity of `signIn`, a session bound to a
// device, the device's own credential (decision D118), the demo flag) are read from the registry
// entry of each operation. No count of operations per condition is written here: an operation
// that gains or loses a condition, in the registry and in its row of spec §7, changes its cells
// with no change of this file.
//
// HOW "REFUSED BY ACCESS" IS TOLD FROM "REFUSED BY THE HANDLER". By the hook, not by the status: a
// request the stages refused never reaches `preParsing`. The code says the same a second time
// (`NOT_SIGNED_IN`, `NOT_PERMITTED`, `FORBIDDEN`, `DEVICE_REVOKED`, `DEVICE_NOT_PAIRED`,
// `DEMO_DISABLED`, `ORIGIN_NOT_ALLOWED` are refusals of the caller; `INVALID_CREDENTIALS`,
// `INVALID_CODE`, `LOCKED`, `NOT_FOUND`, a 409 and a 422 are answers of a handler), and the denial
// row a third time.
//
// CELLS DO NOT DISTURB EACH OTHER. A GET reads. A command is sent with the registry's example
// input and its handler runs for a permitted caller, EXCEPT a command whose success would take a
// caller of the matrix away, change who it is or replace the dataset (decided from the success
// row of its registry entry): with a path parameter it is sent for an identifier that names
// nothing (the handler answers its documented 404), without one with a body that is no JSON
// (stage 7 answers 400 and no handler runs). `loadScenario` and `resetDemo` are of the second
// kind: no cell of this file resets anything.
//
// THE DENIAL BUDGET (F25). 20 audited refusals per throttle key per 60 s, and 30 requests per
// 60 s for a caller without a principal. The test counts both per key from what each cell wrote,
// advances the manual clock by 60 s before a key would exceed either, and compares its count with
// the server's own (`throttleControl(app).inspect`). No cell is answered 429.
//
// WHAT IS REAL. The app factory with every module and every stage, on a clone of the bulk
// template as `dems_app`, booted as the entry point boots it, the demo flag ON (a second server
// on a second clone has it off). Every request is `app.inject`. The callers are the seeded
// operators, signed in through the sign-in route, and devices that redeemed a pairing code the
// server issued. The test's own are the server clock (manual) and the engine's timer (manual, never
// fired). Grants are changed only in the test's clone, as `dems_owner`, after the boot.
//
// Secrets (P19). A cookie, a session token, a device credential and a pairing code are taken from
// an answer and handed on. None is printed, logged, put into a test name or compared in an
// assertion whose failure message would show it.
import { writeFileSync } from 'node:fs';
import {
  CORE_API_ENVELOPE_RESPONSES,
  CORE_API_OPERATIONS,
  CoreApiAccessCondition,
  CoreApiAccessKind,
  DEVICE_CREDENTIAL_REQUIRED_REASON,
  WEB_CONSOLE_ONLY_REASON,
  coreApiAccessPermissions,
  describeCoreApiAccess,
  type CoreApiEnvelopeResponse,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import { OPERATORS, ROLE_PERMISSIONS, createManualClock, type ControllableClock } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app';
import type { DatabaseConnection } from '../../src/config';
import { BULK_TEMPLATE_NOW } from '../../src/db/fixtures/__tests__/template-hook.bulk';
import { engineControl } from '../../src/engine';
import type { OnvifDiscoveryAdapter, WsDiscoveryResult } from '../../src/capture/adapters';
import { captureDiscoveryControl } from '../../src/modules/capture-discovery';
import { captureAudioCardsControl, createListingGate } from '../../src/modules/capture-inputs/audio-cards';
import { sttConfigControl } from '../../src/modules/stt-config';
import type { Principal } from '../../src/plugins/authenticate';
import { throttleControl, type ThrottleKey } from '../../src/plugins/throttle';
import { useTestDatabase } from '../helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../support/config';
import { manualTimer } from '../support/engine';
import { SESSION as AUTH_SESSION, TOUCH, WEB_ORIGIN, bearer, cookieValue, deviceSignIn, webSignIn, type Headers } from '../support/identity';
import { CODE, UNPAIR, portalPost, redeem, revokeUrl } from '../support/pairing';
import {
  NOT_JSON,
  cellModeOf,
  cellRequestOf,
  deniedCellsFromTable,
  describeExpectation,
  exampleCodesOf,
  expectationOf,
  isApiContractSection,
  readSpecification,
  type CallerFacts,
  type CallerIdentity,
  type CellMode,
  type Expectation,
  type Grant,
  type SpecOperation,
} from './rbac-matrix.support';

const db = useTestDatabase({ template: 'bulk' });

// Caps, not waits: a clone, a boot and a sign-in take many times their usual time while other
// rows' runs load the host. Nothing in this file waits for real time.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

// ── The specification and the registry ─────────────────────────────────────────────────────────

const spec = readSpecification();
const specOf = new Map<string, SpecOperation>(spec.operations.map((operation) => [operation.operationId, operation]));

/** The row of spec §7 for a registry operation. A registry operation the document does not hold stops the cell. */
function specRowOf(operation: CoreApiRegistryOperation): SpecOperation {
  const row = specOf.get(operation.operationId);
  if (row === undefined) throw new Error(`spec §7 has no row for the registry operation ${operation.operationId}`);
  return row;
}

/**
 * The operations the booted server routes: the matrix walks these. C3's fourteen new operations
 * answer NO route until their milestone rows land (R4, ruling D44): row 66 / M4-W2 registers the
 * six capture operations (76, 77, 78, 79, 80, 89), M5 switchAudioSource (81), M5/M7
 * listAudioSourceIntervals (82), M7 getSealingProgress (83), M6 to M8 the five evidence operations
 * (84, 85, 86, 87, 88). The deferral is derived from the server's own routing table, so a row
 * that registers one of those routes adds its cells to every walk automatically - and the test
 * that names the deferred set fails until the set is revised.
 */
function routedOperations(): CoreApiRegistryOperation[] {
  return CORE_API_OPERATIONS.filter((operation) => world.server.app.hasRoute({
    method: operation.method.toUpperCase() as 'GET' | 'POST',
    url: operation.path.replace('{id}', ':id'),
  }));
}

/** The operations C3 adds whose routes land with later rows (R4): named, with their milestone. */
// Blueprint row 66 / M4-W2 landed operations 76 to 80: their five entries left this record and
// their cells joined every walk. Rows 132, 133 and 142 (decision D114) routed operation 89 and
// operations 93 to 97 (`modules/capture-discovery` with its `connect` routes, `modules/capture-inputs`):
// their six entries left it as well. Wave D (decision D133; integration pass D1b, ruling D140): row
// 71b routed operation 81 (`switchAudioSource`, the sessions module) and row 91 operation 87
// (`getEvidenceExportJob`, the evidence-export unit): their two entries left it. Integration pass D4
// (decision D146) routed operation 82 (`listAudioSourceIntervals`, the sessions module) and
// operations 84, 85 and 86 (`modules/transcripts`): their four entries left it.
// Row 82b (decision D153) routed operation 83 (`getSealingProgress`, `modules/sealing`): the last
// entry left it. Every operation of the registry was routed then; the record was the named, empty set.
// Task 4 (blueprint row 63, integration pass I-2): the contract of the two sound-card operations 98
// and 99 landed before their routes. Row 70 (the live path, milestone M4 / WP-07b) routes them and
// takes both entries out again.
// Task 4 row 70 (decision C31) routed operations 98 and 99 (`modules/capture-inputs/audio-cards`):
// both entries left it. Every operation of the registry is routed again; the record is the named, empty set.
// Task 4 (blueprint row 194, WP-12): the contract of operation 100 landed before its route; row 197
// (the wiring of the re-address) routes it and takes the entry out again.
// Task 4 row 197: operation 100 is routed (`modules/capture-discovery/readdress-route.ts`) and its entry left the record.
// Task 4 (blueprint row 102, WP-23b): the contract of the seven commissioning operations landed
// before their routes; each entry leaves with the row that routes it.
// Task 4 row 108: operations 101 and 102 are routed (`modules/capture-config/network`) and their two entries left the record.
// Task 4 row 107: operation 103 is routed (`modules/capture-config/factory-scan`) and its entry left the record.
// Task 4 row 106b (decision C74): operations 104 and 105 are routed (`modules/capture-config/host-alias`) and their two entries left the record.
// Task 4 row 111 (WP-22b): operations 106 and 107 are routed (`modules/capture-config/camera-network`) and their two entries left the record, which is empty.
const DEFERRED_ROUTE: Readonly<Record<string, string>> = {
  // Task 4 (blueprint row 116, WP-26b): the contract of the installation acceptance and its revocation
  // (operations 109 and 110) landed before their routes; row 117 routes both and takes the entries out.
  // Task 4 row 117: operations 109 and 110 are routed (`modules/capture-config/installation-acceptance`) and their two entries left the record.
  // Task 4 row V3 (the third contract step; blueprint row 146, decisions C58, C62): the contract of
  // operation 108 landed before its route; the route edge of `modules/capture-discovery/adopted-test.ts` takes the entry out.
  // Task 4 row 146b: operation 108 is routed (`modules/capture-discovery/adopted-test-route.ts`) and its entry left the record.
  // Task 4 row RD2 (decision C147): the contract of operation 111 landed before its route; row RD3 routes it and takes the entry out.
  retireCaptureDevice: 'task 4 row RD3',
};

/**
 * Permissions that are stored and granted while NO operation names them yet. Task 4 (blueprint
 * row 100, decision U10, plan review P12-F07): the commissioning permission lands with schema set
 * B, whose hand-written file carries its two stored rows; its operations are the contract package
 * of blueprint row 102, which takes the entry out again. Until then no route can be reached with
 * it and none is refused for the lack of it: the guard asks for a permission only where a rule
 * names one.
 * Task 4 row 102 (WP-23b): the contract package landed - operations 101 to 107 name the
 * permission - and the entry is OUT. The list is the named, empty set; a name here is a finding.
 */
const NOT_YET_ENFORCED: readonly string[] = [];

/**
 * The answer the specification gives a caller on an operation: `expectationOf` with what it takes
 * from the document (what a retired device may call, the code of the operation's permission
 * refusal, the reason of "needs the device's own credential").
 */
function expectationFor(operation: CoreApiRegistryOperation, caller: CallerFacts, grants: readonly Grant[], demoFlag: boolean): Expectation {
  return expectationOf({
    operation,
    caller,
    grants,
    demoFlag,
    retiredDeviceMayCall: spec.retiredDeviceMayCall,
    denialCode: specRowOf(operation).denialCode,
    deviceCredentialReason: spec.deviceCredentialReason,
    webConsoleOnlyReason: spec.webConsoleOnlyReason,
  });
}

/**
 * The operations whose row of spec §7 says "needs the device's own credential", in the order of
 * their numbers. From the DOCUMENT, not from the registry: what the named test of decision D118
 * asserts stays what the specification says if the registry ever loses the condition.
 */
const needDeviceCredential = (): string[] =>
  spec.operations.filter((operation) => operation.conditions.includes(CoreApiAccessCondition.DEVICE_CREDENTIAL)).map((operation) => operation.operationId);

/** `GET` or `POST`, as the document writes a method. */
const methodOf = (operation: CoreApiRegistryOperation): string => operation.method.toUpperCase();

/** The conditions of a registry entry, sorted, as the specification reader gives them. */
const conditionsOf = (operation: CoreApiRegistryOperation): string[] => [...(operation.access.conditions ?? [])].sort();

/** The answers of stages 3 to 6 that are a refusal of the caller, not an answer of a handler. */
const ACCESS_REFUSAL_CODES: readonly string[] = [
  'NOT_SIGNED_IN',
  'NOT_PERMITTED',
  'FORBIDDEN',
  'DEVICE_REVOKED',
  'DEVICE_NOT_PAIRED',
  'DEMO_DISABLED',
  'ORIGIN_NOT_ALLOWED',
  'RATE_LIMITED',
];
/** The two row types the access rule writes (RB-4, RB-5, RB-6). */
const DENIAL_ROW_TYPES: readonly string[] = ['ACCESS_DENIED', 'EXPORT_DENIED'];
/** ID-P13: the row types that take a place in the denial budget of the key that caused them. */
const BUDGET_ROW_TYPES: readonly string[] = ['ACCESS_DENIED', 'EXPORT_DENIED', 'AUTH_FAILED', 'AUTH_LOCKED', 'PAIRING_FAILED', 'PAIRING_LOCKED'];
/**
 * Tables whose row count a refused call is not held to: the two the refusal itself writes, and
 * the engine's periodic health snapshot, whose timing is the engine's own (it is written by time,
 * not by a caller).
 */
const TRAIL_TABLES: readonly string[] = ['audit_log', 'events'];
const ENGINE_TIMED_TABLES: readonly string[] = ['health_snapshots'];

// ── The server ─────────────────────────────────────────────────────────────────────────────────

/** What a hook of the test saw of one request: who stage 4 resolved, and whether the stages let it through. */
interface SeenRequest {
  readonly id: string;
  readonly principal: Principal;
}

interface AuditRowRead {
  readonly seq: number;
  readonly type: string;
  readonly category: string;
  readonly actorId: string | null;
  readonly deviceId: string | null;
  readonly details: Readonly<Record<string, unknown>>;
}

interface Server {
  readonly app: FastifyInstance;
  /** The server clock: it moves only when the test moves it. */
  readonly clock: ControllableClock;
  readonly log: CapturedLog;
  /** `dems_owner` on the clone: the test's own reads, and the grant changes of the test. */
  readonly owner: Pool;
  readonly demoFlag: boolean;
  readonly cookieName: string;
  /** One entry per request since the list was last emptied. */
  readonly seen: SeenRequest[];
  /** The IDs of the requests that passed the request stages (recorded before the body is read). */
  readonly passed: Set<string>;
  /** `SELECT` of one row: the row count of every table of schema `public`. */
  readonly countStatement: string;
  /** The sessions the test keeps alive across the clock's steps: the headers of each. */
  readonly sessions: Headers[];
  /** Audited refusals per throttle key in the open window, counted by the test from the rows written. */
  readonly refusals: Map<string, number>;
  /** Requests per throttle key at the strict limit in the open window, counted by the test. */
  readonly strict: Map<string, number>;
  /** Where the server's own count of a key's refusals differed from the test's. */
  readonly budgetProblems: string[];
  /** Cells in which a table of `ENGINE_TIMED_TABLES` gained a row: by whether the call was refused. */
  readonly timedTableMoves: { refused: number; permitted: number };
  /** How often the clock was advanced by one window. */
  windows: number;
  /** The sequence of the newest audit row the test has read. */
  lastSeq: number;
  /** The row counts after the last cell. */
  counts: Readonly<Record<string, number>>;
}

interface ServerTarget {
  readonly runtime: DatabaseConnection;
  onCleanup(close: () => Promise<unknown> | unknown): void;
  ownerPool(): Pool;
}

async function headSeq(owner: Pool): Promise<number> {
  const { rows } = await owner.query<{ seq: string }>('SELECT seq::text AS seq FROM public.audit_chain_head');
  return Number(rows[0]?.seq);
}

async function countTables(server: Pick<Server, 'owner' | 'countStatement'>): Promise<Record<string, number>> {
  const { rows } = await server.owner.query<Record<string, number>>(server.countStatement);
  return rows[0] ?? {};
}

/** Everything the server does after an answer has ended: the engine's queue and the pipeline. */
async function settle(app: FastifyInstance): Promise<void> {
  await engineControl(app).idle();
  await app.pipeline.drain();
}

/**
 * A process start: the real app factory on the database, as `dems_app`, booted as the entry point
 * boots it. The clock and the engine's timer are in place before the boot; the timer is never
 * fired, so the engine ticks nothing by itself.
 */
async function startServer(target: ServerTarget, demoFlag: boolean): Promise<Server> {
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'warn', port: 4420, demoControls: demoFlag }),
    logStream: log.stream,
  });
  target.onCleanup(() => app.close());

  // Two hooks of the test, added before the plugins load. `preParsing` runs after the one
  // `onRequest` hook of the request stages and before the body is read: a request a stage refused
  // never gets there. `onSend` runs for every answer, a refusal included.
  const seen: SeenRequest[] = [];
  const passed = new Set<string>();
  app.addHook('preParsing', (request, _reply, payload, done) => {
    passed.add(request.id);
    done(null, payload);
  });
  app.addHook('onSend', (request, _reply, payload, done) => {
    seen.push({ id: request.id, principal: request.principal });
    done(null, payload);
  });

  await app.ready();
  const clock = createManualClock(BULK_TEMPLATE_NOW + 60_000);
  app.seams.replace('clock', clock);
  engineControl(app).useTimer(manualTimer().timer);
  // Operation 92 tests the STT connection through a PROVIDED probe (the transcriber runtime's, row
  // 115); without one a permitted caller is answered the envelope's 503 `TRANSCRIBER_NOT_READY`,
  // which belongs to no operation's documented statuses. The matrix asks WHO may call, so it gives
  // the operation a probe that contacts nothing and answers "unreachable": a permitted cell then
  // gets its documented 200. The 503 itself is held by the module's own test.
  sttConfigControl(app).provideProbe(async () => ({ reachable: false, modelAvailable: false, detailCode: 'UNREACHABLE' }));
  // The same for operation 93 (rows 132 / 142, D114): a Core that does not run real capture has no
  // discovery adapter, and a permitted caller is answered the envelope's 503 `NOT_READY`, which is
  // no documented status of the operation. The matrix gives the module an adapter that sends
  // nothing and finds nothing: a permitted cell then gets its documented 202. The 503, the bounds
  // and the candidates are held by the module's own tests (`capture-discovery.db.test.ts`).
  captureDiscoveryControl(app).provideAdapter(() => ({ discover: async () => NOTHING_FOUND }) as unknown as OnvifDiscoveryAdapter);
  // The same for operations 98 and 99 (task 4 row 70): a Core outside production capture has no
  // enumerator of the sound cards, and a permitted caller is answered the envelope's 503
  // `NOT_READY`. The matrix gives the module an enumerator that reads no host and lists no card, a
  // registrar that is never reached (no card is listed, so nothing is registered) and a gate
  // without the spacing of the search (the matrix calls 98 once per column): a permitted cell then
  // gets its documented 200 (98) or 404 (99). The 503, the bounds, the registration and its audit
  // row are held by the module's own tests (`capture-inputs/audio-cards/__tests__`).
  captureAudioCardsControl(app).replaceForTest({
    enumerator: { list: async () => ({ cards: [], truncated: false, skipped: 0 }) },
    registrar: {
      register: async () => {
        throw new Error('the matrix registers no microphone');
      },
      reenable: async () => {
        throw new Error('the matrix registers no microphone');
      },
    },
    gate: createListingGate(() => app.clock.now(), 0),
  });
  await app.readiness.boot();
  await settle(app);

  const owner = target.ownerPool();
  const { rows: tables } = await owner.query<{ name: string }>("SELECT tablename::text AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  for (const { name } of tables) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('a table of schema public has a name this test does not put into a statement');
  }
  const countStatement = `SELECT ${tables.map(({ name }) => `(SELECT count(*) FROM public.${name})::int AS ${name}`).join(', ')}`;

  return {
    app,
    clock,
    log,
    owner,
    demoFlag,
    cookieName: app.config.sessionCookieName,
    seen,
    passed,
    countStatement,
    sessions: [],
    refusals: new Map(),
    strict: new Map(),
    budgetProblems: [],
    timedTableMoves: { refused: 0, permitted: 0 },
    windows: 0,
    lastSeq: await headSeq(owner),
    counts: await countTables({ owner, countStatement }),
  };
}

/** What the matrix's discovery adapter answers: a search that ran and found no camera. */
const NOTHING_FOUND: WsDiscoveryResult = {
  candidates: [],
  responderCount: 0,
  interfaceCount: 1,
  truncated: false,
  counts: { datagramsReceived: 0, datagramsAccepted: 0, dropped: {}, repeats: 0, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 0, sendErrors: 0, handlerErrors: 0 },
};

/**
 * The next window of the throttle and of the denial budget: the server clock moves on by the
 * window's length (60 s), which ends every open window. Before it does, the test's count of each
 * key's refusals is held against the server's own. Afterwards every session of the test is
 * touched, so that no session becomes idle while other callers' columns run.
 */
async function nextWindow(server: Server): Promise<void> {
  const control = throttleControl(server.app);
  for (const [key, counted] of server.refusals) {
    const { used } = await control.inspect(key as ThrottleKey);
    if (used !== counted) server.budgetProblems.push(`window ${server.windows}: the server counts ${used} refusals of ${key}, the test counted ${counted}`);
  }
  server.clock.advance(spec.windowMs);
  server.windows += 1;
  server.refusals.clear();
  server.strict.clear();
  for (const headers of server.sessions) {
    const response = await server.app.inject({ method: 'POST', url: TOUCH, headers });
    if (response.statusCode !== 200) throw new Error(`a session of the test could not be kept alive: touchSession answered ${response.statusCode}`);
  }
  await settle(server.app);
  server.lastSeq = await headSeq(server.owner);
  server.counts = await countTables(server);
}

// ── Callers ────────────────────────────────────────────────────────────────────────────────────

type Method = 'GET' | 'POST';

interface Caller extends CallerFacts {
  /** The column of the matrix. */
  readonly id: string;
  /**
   * What a request of the caller carries: a credential, an `Origin`, both or neither. Handed on,
   * never printed. A web console sends its `Origin` on a POST and none on a GET (a same-origin
   * read, OR-3); every other caller sends the same headers on both.
   */
  headersFor(method: Method): Headers;
  /**
   * The key stage 5 counts a request of the caller under (ID-P12): the resolved principal, else
   * the class of its `Origin`. Null for a caller that is refused before stage 5 on every operation.
   */
  keyFor(method: Method): ThrottleKey | null;
}

/** The same headers and the same key on a GET and on a POST. */
const always = <Value>(value: Value) => (): Value => value;

/** A request as the mobile app sends it (decision D69): no `Origin`, no cookie. */
const MOBILE: Headers = { host: '127.0.0.1:4420', 'user-agent': 'okhttp/4.12.0' };

/** Who stage 4 must resolve a caller to, in the words `resolvedAs` uses for what it did resolve. */
function resolvesTo(identity: CallerIdentity): string {
  switch (identity.kind) {
    case 'ANONYMOUS':
      return 'ANONYMOUS';
    case 'RETIRED_DEVICE':
      return `ANONYMOUS, retired device ${identity.deviceId}`;
    case 'DEVICE':
      return `DEVICE ${identity.deviceId}`;
    case 'OPERATOR':
      return `OPERATOR ${identity.operatorId} ${identity.role} on ${identity.deviceId ?? 'the web console'}`;
  }
}

function resolvedAs(principal: Principal): string {
  switch (principal.kind) {
    case 'ANONYMOUS':
      return principal.retiredDeviceId === null ? 'ANONYMOUS' : `ANONYMOUS, retired device ${principal.retiredDeviceId}`;
    case 'DEVICE':
      return `DEVICE ${principal.deviceId}`;
    case 'OPERATOR':
      return `OPERATOR ${principal.operatorId} ${principal.role} on ${principal.deviceId ?? 'the web console'}`;
  }
}

/** The seeded operator of a role. The three roles are the columns of spec §4.4. */
function seededOperator(role: string): (typeof OPERATORS)[number] {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`the seed has no operator with the role ${role}`);
  return operator;
}

/** A seeded operator signed in on the web console: the cookie header and the token inside it. */
async function signInOnWeb(server: Server, role: string): Promise<{ readonly cookie: Headers; readonly token: string }> {
  const response = await webSignIn(server.app, seededOperator(role).username);
  const token = response.statusCode === 200 ? cookieValue(response, server.cookieName) : null;
  if (token === null) throw new Error(`the web sign-in of the ${role} answered ${response.statusCode}`);
  return { cookie: { cookie: `${server.cookieName}=${token}` }, token };
}

interface PairedDevice {
  readonly deviceId: string;
  /** Held by the test only. */
  readonly credential: string;
}

/** A real paired device: a code the supervisor issued (operation 15), redeemed without a credential (operation 18). */
async function pairDevice(server: Server, supervisor: Headers, deviceName: string): Promise<PairedDevice> {
  const issued = await portalPost(server.app, CODE, supervisor);
  if (issued.statusCode !== 201) throw new Error(`issuePairingCode answered ${issued.statusCode}`);
  const response = await redeem(server.app, (issued.json() as { code: string }).code, { deviceName });
  if (response.statusCode !== 201) throw new Error(`redeemPairingCode answered ${response.statusCode}`);
  const body = response.json() as { deviceId: string; deviceCredential: string };
  return { deviceId: body.deviceId, credential: body.deviceCredential };
}

/** A seeded operator signed in on a paired device: the bearer value of the session. */
async function signInOnDevice(server: Server, device: PairedDevice, role: string): Promise<string> {
  const response = await deviceSignIn(server.app, device.credential, seededOperator(role).username);
  const token = response.statusCode === 200 ? (response.json() as { sessionToken?: string }).sessionToken : undefined;
  if (token === undefined) throw new Error(`the device sign-in of the ${role} answered ${response.statusCode}`);
  return token;
}

const operatorKey = (role: string): ThrottleKey => `operator:${seededOperator(role).id}`;

/** A web console: the cookie on every request, the web console `Origin` on a POST only, as a browser sends them. */
function webOperator(role: string, cookie: Headers): Caller {
  return {
    id: role,
    identity: { kind: 'OPERATOR', operatorId: seededOperator(role).id, role, deviceId: null },
    webConsole: true,
    early: null,
    headersFor: (method) => (method === 'POST' ? { origin: WEB_ORIGIN, ...cookie } : cookie),
    keyFor: always(operatorKey(role)),
  };
}

function deviceOperator(role: string, device: PairedDevice, token: string): Caller {
  return {
    id: `${role}@DEVICE`,
    identity: { kind: 'OPERATOR', operatorId: seededOperator(role).id, role, deviceId: device.deviceId },
    webConsole: false,
    early: null,
    headersFor: always({ ...MOBILE, ...bearer(token) }),
    keyFor: always(operatorKey(role)),
  };
}

/**
 * A signed-out web console: no credential. Its POSTs carry the web console `Origin` and count in
 * `class:web`; its GETs are same-origin reads without an `Origin` and count in `class:local`
 * (spec §5.1, the key table).
 */
const ANONYMOUS: Caller = {
  id: 'ANONYMOUS',
  identity: { kind: 'ANONYMOUS' },
  webConsole: true,
  early: null,
  headersFor: (method): Headers => (method === 'POST' ? { origin: WEB_ORIGIN } : {}),
  keyFor: (method) => (method === 'POST' ? 'class:web' : 'class:local'),
};
/** No credential and no `Origin`: the mobile app before it is paired (spec §6.6, first line). Counted in `class:local`. */
const UNPAIRED_DEVICE: Caller = { id: 'UNPAIRED_DEVICE', identity: { kind: 'ANONYMOUS' }, webConsole: false, early: null, headersFor: always(MOBILE), keyFor: always('class:local') };

// ── The columns ────────────────────────────────────────────────────────────────────────────────

/** The three roles of spec §4.4, in the order of its columns. */
const ROLES = spec.roles;

const AC_B_15_COLUMNS = ['ANONYMOUS', 'UNPAIRED_DEVICE', ...ROLES];
const PAIRED_DEVICE_COLUMNS = ['DEVICE', ...ROLES.map((role) => `${role}@DEVICE`)];
const RETIRED_DEVICE_COLUMNS = ['RETIRED_DEVICE', 'RETIRED_DEVICE_SESSION', 'UNPAIRED_CREDENTIAL'];
const MISUSE_COLUMNS = ['COOKIE_AND_BEARER', 'BEARER_WITH_WEB_ORIGIN', 'DEVICE_TOKEN_AS_COOKIE', 'WEB_TOKEN_AS_BEARER'];
/** The other reading of the row's "5 caller kinds": anonymous, a paired device, the three roles. */
const BRIEF_COLUMNS = ['ANONYMOUS', 'DEVICE', ...ROLES];

const COLUMN_TITLES: Readonly<Record<string, string>> = {
  ANONYMOUS: 'an unauthenticated caller: a signed-out web console (no credential; a web console Origin on a POST, none on a GET)',
  UNPAIRED_DEVICE: 'an unpaired device: no credential and no Origin, as the mobile app sends before it is paired',
  DEVICE: 'a paired device with no operator: its device credential as a bearer value',
  RETIRED_DEVICE: 'a retired device: the credential of a REVOKED device',
  RETIRED_DEVICE_SESSION: 'a retired device: the session token of an operator who was signed in on the device when it was revoked',
  UNPAIRED_CREDENTIAL: 'a retired device: the old credential of a device that unpaired itself (state UNPAIRED)',
  COOKIE_AND_BEARER: 'the cookie of a web session AND the bearer value of a device session in one request (web console Origin)',
  BEARER_WITH_WEB_ORIGIN: 'the bearer value of a valid device session with a web console Origin',
  DEVICE_TOKEN_AS_COOKIE: "a device session's token sent as the cookie (web console Origin)",
  WEB_TOKEN_AS_BEARER: "a web session's token sent as a bearer value (no Origin)",
  ...Object.fromEntries(ROLES.flatMap((role) => [
    [role, `the seeded ${role}, signed in on the web console (the session cookie; a web console Origin on a POST, none on a GET)`],
    [`${role}@DEVICE`, `the seeded ${role}, signed in on a paired device (the session token as a bearer value)`],
  ])),
};

/** Everything the tests of this file share once the servers are up. */
interface World {
  readonly server: Server;
  /** The role matrix stored in the clone at the start: `role_permissions`, as `dems_owner` read it. */
  readonly stored: readonly Grant[];
  readonly callers: Readonly<Record<string, Caller>>;
  /** The paired device of the device columns, and the retired one. */
  readonly paired: PairedDevice;
  readonly retired: PairedDevice;
  /** Headers of two valid sessions the misuse columns borrow from: asked again afterwards. */
  readonly supervisorWeb: Headers;
  readonly investigatorDevice: Headers;
  /** The epoch and the number of discarded chains once the server had started: a reset would move both. */
  readonly startedWith: DatasetMark;
  /** The row count of every table when the first cell ran. */
  readonly startedCounts: Readonly<Record<string, number>>;
}

interface DatasetMark {
  readonly epoch: string | undefined;
  readonly discardedChains: number | undefined;
}

/** What a scenario load or a reset would change: the epoch and the lineage of discarded chains (spec §12.4). */
async function datasetMark(owner: Pool): Promise<DatasetMark> {
  const { rows } = await owner.query<{ epoch: string; discarded: number }>(
    'SELECT (SELECT epoch::text FROM public.core_state) AS epoch, (SELECT count(*)::int FROM public.audit_chain_history) AS discarded',
  );
  return { epoch: rows[0]?.epoch, discardedChains: rows[0]?.discarded };
}

let world: World;

async function storedGrants(owner: Pool): Promise<Grant[]> {
  const { rows } = await owner.query<{ role: string; permission: string }>(
    'SELECT role_id AS role, permission_id AS permission FROM public.role_permissions ORDER BY role_id, permission_id',
  );
  return rows;
}

const grantNames = (grants: readonly Grant[]): string[] => grants.map((grant) => `${grant.role}: ${grant.permission}`).sort();

beforeAll(async () => {
  const server = await startServer(db, true);
  const stored = await storedGrants(server.owner);

  // The callers: the three seeded operators on the web console, two real devices (one stays
  // paired, one is revoked by the supervisor), and the three operators on the paired device.
  const web: Record<string, { readonly cookie: Headers; readonly token: string }> = {};
  for (const role of ROLES) web[role] = await signInOnWeb(server, role);
  const supervisor = ROLES.find((role) => stored.some((grant) => grant.role === role && grant.permission === 'PAIRING_MANAGE'));
  const supervisorWeb = supervisor === undefined ? undefined : web[supervisor];
  if (supervisorWeb === undefined) throw new Error('no role of the stored matrix may issue a pairing code');
  const paired = await pairDevice(server, supervisorWeb.cookie, 'Matrix tablet (paired)');
  const firstRole = ROLES[0];
  if (firstRole === undefined) throw new Error('spec §4.4 names no role');
  // A device that is revoked while an operator is signed in on it (edge case E3): its credential
  // and that operator's session token are both retired from then on.
  const retired = await pairDevice(server, supervisorWeb.cookie, 'Matrix tablet (to be revoked)');
  const retiredSession = await signInOnDevice(server, retired, firstRole);
  const revoked = await portalPost(server.app, revokeUrl(retired.deviceId), supervisorWeb.cookie, { reason: 'Role matrix test: a retired device' });
  if (revoked.statusCode !== 200) throw new Error(`revokeDevice answered ${revoked.statusCode}`);
  // A device that unpairs itself (operation 22): state UNPAIRED. The test keeps the credential the app would delete.
  const unpaired = await pairDevice(server, supervisorWeb.cookie, 'Matrix tablet (to unpair itself)');
  const left = await server.app.inject({ method: 'POST', url: UNPAIR, headers: { ...MOBILE, ...bearer(unpaired.credential) } });
  if (left.statusCode !== 204) throw new Error(`unpairDevice answered ${left.statusCode}`);
  const onDevice: Record<string, string> = {};
  for (const role of ROLES) onDevice[role] = await signInOnDevice(server, paired, role);
  await settle(server.app);

  const investigatorToken = onDevice[firstRole];
  if (investigatorToken === undefined) throw new Error(`the ${firstRole} is not signed in on the paired device`);
  const investigatorDevice: Headers = { ...MOBILE, ...bearer(investigatorToken) };

  const callers: Record<string, Caller> = {
    ANONYMOUS,
    UNPAIRED_DEVICE,
    DEVICE: {
      id: 'DEVICE',
      identity: { kind: 'DEVICE', deviceId: paired.deviceId },
      webConsole: false,
      early: null,
      headersFor: always({ ...MOBILE, ...bearer(paired.credential) }),
      keyFor: always<ThrottleKey>(`device:${paired.deviceId}`),
    },
    RETIRED_DEVICE: {
      id: 'RETIRED_DEVICE',
      identity: { kind: 'RETIRED_DEVICE', deviceId: retired.deviceId },
      webConsole: false,
      early: null,
      headersFor: always({ ...MOBILE, ...bearer(retired.credential) }),
      // A retired credential is not a principal: it counts in the pre-authentication class (RB-6).
      keyFor: always('class:local'),
    },
    // Spec §4.1: "a session token whose device is no longer PAIRED does not resolve to a principal".
    RETIRED_DEVICE_SESSION: {
      id: 'RETIRED_DEVICE_SESSION',
      identity: { kind: 'RETIRED_DEVICE', deviceId: retired.deviceId },
      webConsole: false,
      early: null,
      headersFor: always({ ...MOBILE, ...bearer(retiredSession) }),
      keyFor: always('class:local'),
    },
    // Spec §7.2: `DEVICE_REVOKED` is the answer for a device that is REVOKED or UNPAIRED.
    UNPAIRED_CREDENTIAL: {
      id: 'UNPAIRED_CREDENTIAL',
      identity: { kind: 'RETIRED_DEVICE', deviceId: unpaired.deviceId },
      webConsole: false,
      early: null,
      headersFor: always({ ...MOBILE, ...bearer(unpaired.credential) }),
      keyFor: always('class:local'),
    },
    // AC-B-81, ID-12: both credentials are VALID ones; stage 4 refuses the request and resolves neither.
    COOKIE_AND_BEARER: {
      id: 'COOKIE_AND_BEARER',
      identity: { kind: 'ANONYMOUS' },
      webConsole: false,
      early: { status: 401, code: 'NOT_SIGNED_IN', reason: 'CREDENTIAL_CONFLICT' },
      headersFor: always({ origin: WEB_ORIGIN, ...supervisorWeb.cookie, ...bearer(investigatorToken) }),
      keyFor: always(null),
    },
    // AC-B-81, OR-4: a VALID bearer session with a web console origin; the Origin guard refuses it.
    BEARER_WITH_WEB_ORIGIN: {
      id: 'BEARER_WITH_WEB_ORIGIN',
      identity: { kind: 'ANONYMOUS' },
      webConsole: false,
      early: { status: 403, code: 'ORIGIN_NOT_ALLOWED', reason: null },
      headersFor: always({ origin: WEB_ORIGIN, ...bearer(investigatorToken) }),
      keyFor: always(null),
    },
    // AC-B-81, ID-13: the cookie resolves only a session without a device. The caller is then a
    // signed-out web console: no principal, a web console Origin, no `Authorization` header.
    DEVICE_TOKEN_AS_COOKIE: {
      id: 'DEVICE_TOKEN_AS_COOKIE',
      identity: { kind: 'ANONYMOUS' },
      webConsole: true,
      early: null,
      headersFor: always({ origin: WEB_ORIGIN, cookie: `${server.cookieName}=${investigatorToken}` }),
      keyFor: always('class:web'),
    },
    // AC-B-81, ID-13: a bearer value resolves only a session with a device. No principal, no Origin.
    WEB_TOKEN_AS_BEARER: {
      id: 'WEB_TOKEN_AS_BEARER',
      identity: { kind: 'ANONYMOUS' },
      webConsole: false,
      early: null,
      headersFor: always({ ...MOBILE, ...bearer(supervisorWeb.token) }),
      keyFor: always('class:local'),
    },
  };
  for (const role of ROLES) {
    const session = web[role];
    const token = onDevice[role];
    if (session === undefined || token === undefined) throw new Error(`the ${role} is not signed in`);
    callers[role] = webOperator(role, session.cookie);
    callers[`${role}@DEVICE`] = deviceOperator(role, paired, token);
    server.sessions.push({ origin: WEB_ORIGIN, ...session.cookie }, { ...MOBILE, ...bearer(token) });
  }

  world = { server, stored, callers, paired, retired, supervisorWeb: supervisorWeb.cookie, investigatorDevice, startedWith: await datasetMark(server.owner), startedCounts: server.counts };
  // The matrix starts in fresh windows: what the preparation counted is behind it.
  await nextWindow(server);
  server.budgetProblems.length = 0;
  world = { ...world, startedCounts: server.counts };
});

// ── One cell ───────────────────────────────────────────────────────────────────────────────────

interface Cell {
  /** `MATRIX`, `FLAG_OFF`, `GRANT_REMOVED` or `CAN_IT_FAIL`. */
  readonly table: string;
  readonly column: string;
  /** The operation number of spec §7. */
  readonly number: number;
  readonly operationId: string;
  readonly mode: CellMode;
  /** What the specification expects, in one line. */
  readonly expected: string;
  readonly allowed: boolean;
  /** The specification expects exactly one denial row of this call. */
  readonly expectsRow: boolean;
  readonly status: number;
  readonly code: string | null;
  /** `error.details.reason` of the answer, where it has one. */
  readonly reason: string | null;
  /** The places the call took in the denial budget of the caller's key, by the server's own count. */
  readonly places: number;
  /** Stage 6 let the request through. */
  readonly passed: boolean;
  /** The types of the audit rows the call wrote, in order. */
  readonly rows: readonly string[];
  /** Empty: the cell equals the specification. */
  readonly problems: readonly string[];
}

/** Every cell this file ran, in order. */
const cells: Cell[] = [];

interface ErrorBody {
  readonly code?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

function errorOf(response: LightMyRequestResponse): ErrorBody | null {
  if (response.body === '') return null;
  try {
    return (response.json() as { error?: ErrorBody }).error ?? null;
  } catch {
    return null;
  }
}

/** Whether a request under the key on the operation counts at the strict limit of the key (spec §5.1, the key table). */
function countsStrict(key: ThrottleKey | null, operation: CoreApiRegistryOperation): boolean {
  if (key === null) return false;
  // A class key: every request. Health counts at the wide limit; counting it here only moves the clock a request early.
  if (key.startsWith('class:')) return true;
  if (key.startsWith('device:')) return spec.deviceStrictOperations.includes(specRowOf(operation).number);
  return false;
}

interface CellOptions {
  readonly table: string;
  /** The grants the expectation is derived from. */
  readonly grants: readonly Grant[];
  /** Sends every command with a body that is no JSON, whatever its registry entry says. */
  readonly probeOnly?: boolean;
  /** Pass D6: false = the model is NOT given the creator of the open session (the impostor control only). */
  readonly holderFact?: boolean;
}

async function runCell(server: Server, caller: Caller, operation: CoreApiRegistryOperation, options: CellOptions): Promise<Cell> {
  const row = specRowOf(operation);
  const mode: CellMode = options.probeOnly === true && operation.method === 'post' ? 'PROBE' : cellModeOf(operation);
  const request = cellRequestOf(operation, mode);
  // Pass D6 (F-D4-3): the SESSION_HOLDER fact is a fact of the database at the moment of the call -
  // the operator who CREATED the open session (C3 §2.2). The matrix reads it itself, as `dems_owner`
  // and with its own statement, and gives it to the model: the column that created the open session
  // is its holder and passes stage 6; every other non-SUPERVISOR is refused. (Until pass D6 the guard
  // read a column that is always NULL, so no creator ever passed and the matrix never had to ask.)
  // Not for the impostor control (`holderFact: false`): it presents ANOTHER role's session and must not have its expectation moved by a fact of the run.
  const holderRule = options.holderFact !== false && (operation.access.conditions ?? []).some((condition) => condition === 'SESSION_HOLDER');
  const creator = holderRule ? ((await server.owner.query<{ created_by: string | null }>('SELECT created_by FROM public.active_session LIMIT 1')).rows[0]?.created_by ?? null) : null;
  const expectation = expectationFor(operation, holderRule ? { ...caller, sessionCreatorId: creator } : caller, options.grants, server.demoFlag);

  // A permitted search (operation 93) is bounded per session and per Core (C3 §5.4: 10 s, 5 s, 6 a
  // minute). The matrix asks who may call, not how often: the search of each permitted cell runs
  // in a window of its own, so no cell meets the bound of the cell before it (429 stays a failure).
  if (operation.operationId === 'startCaptureDiscovery' && expectation.allowed && mode !== 'PROBE') await nextWindow(server);

  // The denial budget and the strict limit of the caller's key (F25): the next window first.
  const key = caller.keyFor(request.method);
  const strict = countsStrict(key, operation);
  if (key !== null && ((server.refusals.get(key) ?? 0) >= spec.denialBudget || (strict && (server.strict.get(key) ?? 0) >= spec.strictLimit))) {
    await nextWindow(server);
  }

  // The places the key holds in the denial budget, as the server counts them, before and after.
  const control = throttleControl(server.app);
  const placesBefore = key === null ? 0 : (await control.inspect(key)).used;

  server.seen.length = 0;
  const response = await server.app.inject({
    method: request.method,
    url: request.url,
    headers: request.body === NOT_JSON.payload ? { ...caller.headersFor(request.method), 'content-type': NOT_JSON.contentType } : caller.headersFor(request.method),
    ...(request.body === undefined ? {} : { payload: request.body }),
  });
  await settle(server.app);

  const [observed] = server.seen;
  const passed = observed !== undefined && server.passed.has(observed.id);
  const { rows: written } = await server.owner.query<{ seq: string; type: string; category: string; actor_id: string | null; device_id: string | null; details: Record<string, unknown> }>(
    'SELECT seq::text AS seq, type, category, actor_id, device_id, details FROM public.audit_log WHERE seq > $1 ORDER BY seq',
    [server.lastSeq],
  );
  const rows: AuditRowRead[] = written.map((entry) => ({
    seq: Number(entry.seq),
    type: entry.type,
    category: entry.category,
    actorId: entry.actor_id,
    deviceId: entry.device_id,
    details: entry.details,
  }));
  const before = server.counts;
  const after = await countTables(server);
  server.lastSeq = rows.at(-1)?.seq ?? server.lastSeq;
  server.counts = after;
  const counted = rows.filter((entry) => BUDGET_ROW_TYPES.includes(entry.type)).length;
  const places = key === null ? 0 : (await control.inspect(key)).used - placesBefore;
  if (key !== null) {
    if (strict) server.strict.set(key, (server.strict.get(key) ?? 0) + 1);
    if (counted > 0) server.refusals.set(key, (server.refusals.get(key) ?? 0) + counted);
  }

  if (ENGINE_TIMED_TABLES.some((table) => after[table] !== before[table])) server.timedTableMoves[passed ? 'permitted' : 'refused'] += 1;

  const status = response.statusCode;
  const error = errorOf(response);
  const code = error?.code ?? null;
  const reason = typeof error?.details?.['reason'] === 'string' ? error.details['reason'] : null;
  const problems: string[] = [];
  const say = (problem: string): void => void problems.push(problem);

  if (status === 429) say('answered 429');
  // ID-P13: a place in the budget of the caller's key for every row of a counted type, and for nothing else.
  if (places !== counted) say(`took ${places} place(s) in the denial budget of ${key} and wrote ${counted} row(s) of a counted type`);
  if (server.seen.length !== 1 || observed === undefined) say(`${server.seen.length} answers were seen for one request`);
  else if (resolvedAs(observed.principal) !== resolvesTo(caller.identity)) say(`stage 4 resolved ${resolvedAs(observed.principal)}, not ${resolvesTo(caller.identity)}`);

  if (expectation.allowed) {
    if (!passed) say(`refused before the body was read: ${status} ${code}`);
    else if (code !== null && ACCESS_REFUSAL_CODES.includes(code)) say(`let through by stage 6 and then answered ${status} ${code}`);
    else if (mode === 'PROBE') {
      if (status !== 400 || code !== 'INVALID_JSON') say(`a body that is no JSON was answered ${status} ${code}, not 400 INVALID_JSON`);
    } else if (!Object.keys(operation.responses).includes(String(status))) say(`answered ${status} ${code}, which the registry does not document for the operation`);
    const denials = rows.filter((entry) => DENIAL_ROW_TYPES.includes(entry.type));
    if (denials.length > 0) say(`a permitted call wrote ${denials.map((entry) => entry.type).join(', ')}`);
  } else {
    if (passed) say('stage 6 let the request through');
    if (status !== expectation.status || code !== expectation.code) say(`answered ${status} ${code}`);
    // The reason is part of the answer: where the specification names one it must be that one, and
    // where it names none the answer must carry none (it tells a refusal of a condition from the marker's).
    const wantedReason = expectation.details['reason'] ?? null;
    if (reason !== wantedReason) say(`error.details.reason is ${JSON.stringify(reason)}, not ${JSON.stringify(wantedReason)}`);
    for (const [name, value] of Object.entries(expectation.details)) {
      if (error?.details?.[name] !== value) say(`error.details.${name} is ${JSON.stringify(error?.details?.[name])}, not ${JSON.stringify(value)}`);
    }
    const wanted = expectation.row;
    if (wanted === null) {
      if (rows.length > 0) say(`wrote ${rows.map((entry) => entry.type).join(', ')}; a refusal without an actor writes no row`);
    } else {
      if (rows.length !== 1) say(`wrote ${rows.length} audit rows (${rows.map((entry) => entry.type).join(', ')}), not exactly one ${wanted.type}`);
      const [only] = rows;
      if (only !== undefined) {
        if (only.type !== wanted.type) say(`the row is ${only.type}, not ${wanted.type}`);
        // RB-4: `ACCESS_DENIED` is a row of category SECURITY.
        if (only.type === 'ACCESS_DENIED' && only.category !== 'SECURITY') say(`the ACCESS_DENIED row has the category ${only.category}, not SECURITY`);
        if (only.actorId !== wanted.actorId) say(`the row names the actor ${only.actorId}, not ${wanted.actorId}`);
        if (only.deviceId !== wanted.deviceId) say(`the row names the device ${only.deviceId}, not ${wanted.deviceId}`);
        for (const [name, value] of Object.entries(wanted.details)) {
          if (only.details[name] !== value) say(`details.${name} of the row is ${JSON.stringify(only.details[name])}, not ${JSON.stringify(value)}`);
        }
      }
    }
    // Nothing else changed: the row count of every table, the trail and the engine's timed table apart.
    const wantedEvents = wanted?.type === 'EXPORT_DENIED' ? 1 : 0;
    if ((after['events'] ?? 0) - (before['events'] ?? 0) !== wantedEvents) say(`wrote ${(after['events'] ?? 0) - (before['events'] ?? 0)} events, not ${wantedEvents}`);
    if ((after['audit_log'] ?? 0) - (before['audit_log'] ?? 0) !== rows.length) say('the row count of audit_log does not follow the rows read');
    for (const [table, count] of Object.entries(after)) {
      if (TRAIL_TABLES.includes(table) || ENGINE_TIMED_TABLES.includes(table)) continue;
      if (count !== before[table]) say(`the row count of ${table} went from ${before[table]} to ${count}`);
    }
  }

  const cell: Cell = {
    table: options.table,
    column: caller.id,
    number: row.number,
    operationId: operation.operationId,
    mode,
    expected: describeExpectation(expectation),
    allowed: expectation.allowed,
    expectsRow: !expectation.allowed && expectation.row !== null,
    status,
    code,
    reason,
    places,
    passed,
    rows: rows.map((entry) => entry.type),
    problems,
  };
  cells.push(cell);
  return cell;
}

/** The cells of one caller over the given operations, in registry order. */
async function runColumn(server: Server, caller: Caller, operations: readonly CoreApiRegistryOperation[], options: CellOptions): Promise<Cell[]> {
  const column: Cell[] = [];
  for (const operation of operations) column.push(await runCell(server, caller, operation, options));
  return column;
}

/** The cells that differ from the specification, one line each. */
const wrongOf = (column: readonly Cell[]): string[] =>
  column.filter((cell) => cell.problems.length > 0).map((cell) => `${cell.number} ${cell.operationId} as ${cell.column} (expected ${cell.expected}): ${cell.problems.join('; ')}`);

function summaryOf(column: readonly Cell[]): string {
  const count = (test: (cell: Cell) => boolean): number => column.filter(test).length;
  return (
    `${column.length} cells: ${count((cell) => cell.passed)} let through by stage 6, ${count((cell) => !cell.passed && cell.status === 401)} × 401, ` +
    `${count((cell) => !cell.passed && cell.status === 403)} × 403; ${count((cell) => cell.rows.some((type) => DENIAL_ROW_TYPES.includes(type)))} with a denial row; ` +
    `${count((cell) => cell.status === 429)} × 429; ${count((cell) => cell.problems.length > 0)} not as specified`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// The registry against the specification (an independent check of the registry itself)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('the contract registry against the composed operation tables: all 119 rows, read from the documents', () => {
  it('the composed document holds operations 1 to 119 and the registry holds the same 119, each once', () => {
    // R1 (D44): 75 rows of the closed task-2 §7 base + 14 rows of C3 §2.2 + 3 rows of C3 §2.5 (the
    // STT configuration operations 90 to 92, task 3 row 113) + 5 rows of C3 §2.6 (the camera search,
    // the connection test, the adoption and the local-input re-read, 93 to 97; task 3 row 132,
    // decision D106), composed by the reader. The total C3 §10.1 states is 97; task 4 (blueprint
    // row 63, integration pass I-2) added the two sound-card rows 98 and 99 to the table of §2.6: 99.
    // Task 4 (blueprint row 194) added the row of operation 100, the confirmed re-address: 100.
    // Task 4 (blueprint row 102) added the seven rows of the commissioning operations 101 to 107: 107.
    // Task 4 (row V3; blueprint row 146) added the row of operation 108, the stored-credential connection test: 108.
    // Task 4 (blueprint row 116) added the two rows of operations 109 and 110, the installation acceptance and its revocation: 110.
    // Task 4 (row RD2) added the row of operation 111, the retirement of a device: 111.
    // C3 §2.7 (transcribed 2026-11-04 by the first full db-suite run) added the six rows of
    // RB-9 as amended (D54: 112 to 117) and the two of D57c (118, 119): 119.
    expect(spec.operations.map((operation) => operation.number)).toEqual(Array.from({ length: 119 }, (_unused, index) => index + 1));
    expect(CORE_API_OPERATIONS).toHaveLength(119);
    expect(CORE_API_OPERATIONS.map((operation) => operation.operationId).sort()).toEqual(spec.operations.map((operation) => operation.operationId).sort());
    expect(new Set(CORE_API_OPERATIONS.map((operation) => operation.operationId)).size).toBe(119);
  });

  it('every registry entry has the method, the path, the access rule, the conditions and the audit rule of its row', () => {
    const registry = CORE_API_OPERATIONS.map((operation) => ({
      number: specRowOf(operation).number,
      operationId: operation.operationId,
      method: methodOf(operation),
      path: operation.path,
      access: describeCoreApiAccess(operation.access),
      conditions: conditionsOf(operation),
      auditSuccess: operation.audit.success,
      auditDenial: operation.audit.denial,
    })).sort((a, b) => a.number - b.number);
    const document = spec.operations.map(({ number, operationId, method, path, access, conditions, auditSuccess, auditDenial }) => ({
      number,
      operationId,
      method,
      path,
      access,
      conditions: [...conditions],
      auditSuccess,
      auditDenial,
    }));
    expect(registry).toEqual(document);
  });

  it('the access rules are 5 PUBLIC, 5 DEVICE, 32 AUTHENTICATED, 74 with one permission and 3 any-of, in the registry and in the composed document', () => {
    const kindOfMarker = (marker: string): string => {
      if (marker === 'PUBLIC' || marker === 'DEVICE' || marker === 'AUTHENTICATED') return marker;
      return marker.startsWith('ANY-OF(') ? CoreApiAccessKind.ANY_OF : CoreApiAccessKind.PERMISSION;
    };
    const tally = (kinds: readonly string[]): Record<string, number> => kinds.reduce<Record<string, number>>((counts, kind) => ({ ...counts, [kind]: (counts[kind] ?? 0) + 1 }), {});
    const registry = tally(CORE_API_OPERATIONS.map((operation) => operation.access.kind));
    expect(registry).toEqual(tally(spec.operations.map((operation) => kindOfMarker(operation.access))));
    // C3 §2.5: operation 90 is AUTHENTICATED (29 -> 30), 91 and 92 need CAPTURE_CONFIG (50 -> 52).
    // C3 §2.6: the five of 93 to 97 need CAPTURE_CONFIG too (52 -> 57); no new permission (R-9 AC-12).
    // Task 4 row 63: the two sound-card operations 98 and 99 need CAPTURE_CONFIG as well (57 -> 59).
    // Task 4 row 194: operation 100 needs CAPTURE_CONFIG as well (59 -> 60).
    // Task 4 row 102: the seven commissioning operations 101 to 107 need CAPTURE_COMMISSION (60 -> 67).
    // Task 4 row V3: operation 108 needs CAPTURE_CONFIG (67 -> 68).
    // Task 4 row 116: operations 109 and 110 need CAPTURE_COMMISSION (68 -> 70).
    // Task 4 row RD2: operation 111 needs CAPTURE_COMMISSION (70 -> 71).
    // C3 §2.7 (2026-11-04): 117 PUBLIC (4 -> 5), 118 and 119 AUTHENTICATED (30 -> 32), the USER_ADMIN
    // trio (71 -> 74) and the two any-of 115 and 116 (1 -> 3).
    expect(registry).toEqual({ PUBLIC: 5, DEVICE: 5, AUTHENTICATED: 32, PERMISSION: 74, ANY_OF: 3 });
    // Every permission a rule names is one of the fifteen of the composed matrix (C3 §2.1).
    for (const operation of CORE_API_OPERATIONS) {
      for (const permission of coreApiAccessPermissions(operation.access)) expect(spec.permissions, operation.operationId).toContain(permission);
    }
  });

  it('each permission is enforced at exactly the operations spec §4.3 lists for it', () => {
    const registry: Record<string, number[]> = Object.fromEntries(spec.permissions.map((permission) => [permission, []]));
    for (const operation of CORE_API_OPERATIONS) {
      for (const permission of coreApiAccessPermissions(operation.access)) registry[permission]?.push(specRowOf(operation).number);
    }
    for (const numbers of Object.values(registry)) numbers.sort((a, b) => a - b);
    expect(registry).toEqual(spec.enforcedAt);
    // Every permission has at least one enforcement point (spec §4.3) - with ONE named exception:
    // the commissioning permission of task 4 (row 100, decision U10) is stored and granted before
    // its operations exist, because a stored permission lands with the schema set that carries its
    // rows (plan review P12-F07). The contract package of the commissioning operations (blueprint
    // row 102) gives it its operations and EMPTIES this list; a second name here is a finding.
    expect(Object.entries(registry).filter(([, numbers]) => numbers.length === 0).map(([permission]) => permission)).toEqual(NOT_YET_ENFORCED);
  });

  it('the denial row is EXPORT_DENIED on the three exports of RB-5 and nowhere else, and FORBIDDEN is the code of exportEvidence alone', () => {
    const exports = CORE_API_OPERATIONS.filter((operation) => operation.audit.denial === 'EXPORT_DENIED').map((operation) => specRowOf(operation).number).sort((a, b) => a - b);
    expect(exports).toEqual(spec.exportOperations);
    expect(spec.exportOperations).toHaveLength(3);
    // The code of a refusal for a missing permission: the document's row, the text of the registry's
    // 403 answer and the registry's own 403 examples agree. An operation whose permission every
    // seeded role holds has no such example (contract C, finding F-8): no example is not a difference.
    const guarded = CORE_API_OPERATIONS.filter((operation) => coreApiAccessPermissions(operation.access).length > 0);
    const differing = guarded
      .map((operation) => ({
        operationId: operation.operationId,
        document: specRowOf(operation).denialCode,
        text: (['NOT_PERMITTED', 'FORBIDDEN'] as const).filter((code) => (operation.responses[403]?.description ?? '').includes(code)),
        examples: exampleCodesOf(operation.operationId, 403).filter((code) => code === 'NOT_PERMITTED' || code === 'FORBIDDEN'),
      }))
      .filter((entry) => entry.text.join() !== entry.document || entry.examples.some((code) => code !== entry.document));
    expect(differing).toEqual([]);
    expect(guarded.filter((operation) => specRowOf(operation).denialCode === 'FORBIDDEN').map((operation) => operation.operationId)).toEqual(['exportEvidence']);
    console.info(`[w47] spec §7 (revision ${spec.revision}, ${spec.lines} lines) against the registry: 75 of 75 rows equal in method, path, access rule, conditions and audit rule; exports ${exports.join(', ')}`);
  });

  it('the condition WEB_CONSOLE_SESSION (C3 §0, §2.6, §3.1, §4; D80(3)): the reason of its refusal is the same in the document and in the registry, and it stands on the three operations whose body carries a camera credential and on the two sound-card operations', () => {
    expect(spec.webConsoleOnlyReason).toBe(WEB_CONSOLE_ONLY_REASON);
    const carrying = CORE_API_OPERATIONS.filter((operation) => conditionsOf(operation).includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION));
    // From the DOCUMENT: the access cells of §2.6 (operations 95 and 96) and the changed row of §3.1 (operation 89).
    const documented = spec.operations.filter((operation) => operation.conditions.includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION));
    expect(documented.map((operation) => [operation.number, operation.operationId])).toEqual([
      [89, 'setCaptureDeviceCredential'],
      [95, 'testCaptureCandidateConnection'],
      [96, 'adoptCaptureCandidate'],
      // Task 4 row 63: the two rows the table of §2.6 gained, web console only (design addendum 4.2).
      [98, 'searchCaptureAudioCards'],
      [99, 'registerCaptureAudioInput'],
      // Task 4 row 194: the row of the confirmed re-address, with the access of operation 96.
      [100, 'confirmCaptureDeviceAddress'],
      // Task 4 row 102: the seven rows of the commissioning operations, web console only (decision U10).
      [101, 'getCaptureNetworkConfig'],
      [102, 'updateCaptureNetworkConfig'],
      [103, 'scanFactoryCameras'],
      [104, 'getHostAlias'],
      [105, 'removeHostAlias'],
      [106, 'setCameraNetwork'],
      [107, 'getCameraNetworkJob'],
      // Task 4 row V3 (blueprint row 146): the row of the stored-credential connection test, with the access of operation 95.
      [108, 'testCaptureDeviceConnection'],
      // Task 4 row 116: the two rows of the installation acceptance and its revocation, web console only (decision U10).
      [109, 'acceptInstallation'],
      [110, 'revokeInstallationAcceptance'],
      // Task 4 row RD2: the row of the retirement of a device, web console only (decision C147, Q1).
      [111, 'retireCaptureDevice'],
    ]);
    expect(carrying.map((operation) => operation.operationId).sort()).toEqual(documented.map((operation) => operation.operationId).sort());
    // It adds to a permission: CAPTURE_CONFIG, or CAPTURE_COMMISSION for the seven of task 4 row 102
    // and the two of row 116 (109, 110). It is defined on no marker without one.
    expect(carrying.filter((operation) => !['CAPTURE_CONFIG', 'CAPTURE_COMMISSION'].includes(describeCoreApiAccess(operation.access))).map((operation) => operation.operationId)).toEqual([]);
    expect(carrying.filter((operation) => describeCoreApiAccess(operation.access) === 'CAPTURE_COMMISSION').map((operation) => specRowOf(operation).number)).toEqual([101, 102, 103, 104, 105, 106, 107, 109, 110, 111]); // + 111 (task 4 row RD2)
    // The model of this file: a holder of the permission on the web console is allowed, the same holder
    // on a paired device is refused 403 NOT_PERMITTED with the reason and one ACCESS_DENIED row.
    const technicianWeb = world.callers['TECHNICIAN'] ?? ANONYMOUS;
    const technicianDevice = world.callers['TECHNICIAN@DEVICE'] ?? ANONYMOUS;
    for (const operation of carrying) {
      expect(expectationFor(operation, technicianWeb, world.stored, true).allowed, operation.operationId).toBe(true);
      const onDevice = expectationFor(operation, technicianDevice, world.stored, true);
      expect(onDevice.allowed, operation.operationId).toBe(false);
      if (onDevice.allowed) continue;
      expect([onDevice.status, onDevice.code, onDevice.details['reason'], onDevice.row?.type, onDevice.row?.details['reason']], operation.operationId).toEqual([
        403,
        'NOT_PERMITTED',
        spec.webConsoleOnlyReason,
        'ACCESS_DENIED',
        spec.webConsoleOnlyReason,
      ]);
    }
    // Negative control: an operation of the same permission without the condition is allowed on the device.
    const search = CORE_API_OPERATIONS.find((operation) => operation.operationId === 'startCaptureDiscovery');
    expect(search).toBeDefined();
    if (search !== undefined) expect(expectationFor(search, technicianDevice, world.stored, true).allowed).toBe(true);
    console.info(`[w47] WEB_CONSOLE_SESSION (reason ${spec.webConsoleOnlyReason}) on: ${carrying.map((operation) => `${specRowOf(operation).number} ${operation.operationId}`).join(', ')}`);
  });

  it('the condition DEVICE_CREDENTIAL (decision D118): the reason of its refusal is the same in the document (§7.2) and in the registry, and it stands only on the marker DEVICE', () => {
    expect(spec.deviceCredentialReason).toBe(DEVICE_CREDENTIAL_REQUIRED_REASON);
    const carrying = CORE_API_OPERATIONS.filter((operation) => conditionsOf(operation).includes(CoreApiAccessCondition.DEVICE_CREDENTIAL));
    // The rows that say "needs the device's own credential" are these operations: the comparison of every row above holds that.
    expect(carrying.map((operation) => operation.operationId).sort()).toEqual(
      spec.operations.filter((operation) => operation.conditions.includes(CoreApiAccessCondition.DEVICE_CREDENTIAL)).map((operation) => operation.operationId).sort(),
    );
    expect(carrying.length).toBeGreaterThan(0);
    // Spec §4.2: it takes the second half of the marker `DEVICE` away; it is defined on no other marker.
    expect(carrying.filter((operation) => operation.access.kind !== CoreApiAccessKind.DEVICE).map((operation) => operation.operationId)).toEqual([]);
    console.info(`[w47] DEVICE_CREDENTIAL (reason ${spec.deviceCredentialReason}) on: ${carrying.map((operation) => `${specRowOf(operation).number} ${operation.operationId}`).join(', ')}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// The stored role matrix
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('the role matrix the server decides from (spec §4.4 composed with C3 §2.1)', () => {
  it('the stored grants equal the composed table and the shared role table: 3 roles, 15 permissions, 23 grants', async () => {
    const { owner } = world.server;
    const roles = (await owner.query<{ id: string }>('SELECT id FROM public.roles ORDER BY sort_order')).rows.map((row) => row.id);
    const permissions = (await owner.query<{ id: string }>('SELECT id FROM public.permissions ORDER BY sort_order')).rows.map((row) => row.id);
    expect([...roles].sort()).toEqual([...spec.roles].sort());
    expect([...permissions].sort()).toEqual([...spec.permissions].sort());
    expect(grantNames(world.stored)).toEqual(grantNames(spec.grants));
    const shared: Grant[] = Object.entries(ROLE_PERMISSIONS).flatMap(([role, held]) => held.map((permission) => ({ role, permission })));
    expect(grantNames(world.stored)).toEqual(grantNames(shared));
    expect([spec.roles.length, spec.permissions.length, world.stored.length]).toEqual([3, 15, 23]);
    // Task 4 row 100 (decision U10): the commissioning permission is held by ONE role, the technician.
    expect(world.stored.filter((grant) => grant.permission === 'CAPTURE_COMMISSION').map((grant) => grant.role)).toEqual(['TECHNICIAN']);
    // The count the document states under its table, per role.
    expect(Object.fromEntries(spec.roles.map((role) => [role, world.stored.filter((grant) => grant.role === role).length]))).toEqual(spec.statedGrantCounts);
  });

  it("the denied cells: AC-B-16's counts stand over the base operations, and C3's rows add exactly the recomputed cells", () => {
    const deniedOf = (role: string): string[] =>
      CORE_API_OPERATIONS.filter((operation) => {
        const expectation = expectationFor(operation, world.callers[role] ?? ANONYMOUS, world.stored, true);
        return !expectation.allowed && expectation.row !== null;
      }).map((operation) => operation.operationId);
    const denied = Object.fromEntries(spec.roles.map((role) => [role, deniedOf(role).length]));
    // R3 (D44): AC-B-16's stated 22/31 covers the closed base of task 2 (75). The claim is
    // checked over that base with the model; the C3 rows are then counted FROM THEIR MARKERS
    // against the composed grant table (deniedCellsFromTable over the twenty-two delta rows: the
    // fourteen of C3 §2.2, the three of C3 §2.5 and the five of C3 §2.6) and added. No literal for the grown total - it
    // is base(stated) + delta(recomputed) per role.
    const baseOps = CORE_API_OPERATIONS.filter((operation) => !isApiContractSection(specRowOf(operation).section));
    expect(baseOps).toHaveLength(75);
    const deniedBase = Object.fromEntries(spec.roles.map((role) => [role, deniedOf(role).filter((operationId) => baseOps.some((operation) => operation.operationId === operationId)).length]));
    expect(deniedBase).toMatchObject(spec.statedDeniedCells);
    const deltaRows = spec.operations.filter((operation) => isApiContractSection(operation.section));
    // Task 4 row 63: and the two sound-card rows of C3 §2.6 (98, 99), 22 + 2. Task 4 row 194: and the row of 100, 24 + 1.
    // Task 4 row 102: and the seven rows of 101 to 107, 25 + 7.
    // Task 4 row V3: and the row of 108, 32 + 1.
    // Task 4 row 116: and the two rows of 109 and 110, 33 + 2.
    // Task 4 row RD2: and the row of 111, 35 + 1.
    expect(deltaRows).toHaveLength(36);
    const deniedDelta = deniedCellsFromTable(deltaRows, spec.grants, spec.roles);
    expect(denied).toEqual(Object.fromEntries(spec.roles.map((role) => [role, (deniedBase[role] ?? 0) + (deniedDelta[role] ?? 0)])));
    console.info(`[w47] denied cells over the composed 97: ${JSON.stringify(denied)} (base ${JSON.stringify(deniedBase)} + C3 delta ${JSON.stringify(deniedDelta)})`);
    // The operations whose permission every role holds have no denied operator cell on stored data.
    const heldByAll = spec.permissions.filter((permission) => spec.roles.every((role) => world.stored.some((grant) => grant.role === role && grant.permission === permission)));
    const neverDenied = CORE_API_OPERATIONS.filter((operation) => {
      const needed = coreApiAccessPermissions(operation.access);
      return needed.length > 0 && needed.every((permission) => heldByAll.includes(permission));
    });
    expect(neverDenied).toHaveLength(9); // six of the base + the three EVIDENCE_VIEW reads C3 adds (84, 86, 88)
    console.info(`[w47] denied cells per role on the stored matrix: ${JSON.stringify(denied)}; permissions every role holds: ${heldByAll.join(', ')} (operations ${neverDenied.map((operation) => specRowOf(operation).number).sort((a, b) => a - b).join(', ')})`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// The matrix
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe.each([
  ['AC-B-15: an unauthenticated caller, an unpaired device and the three roles', AC_B_15_COLUMNS],
  ['a paired device, and the three roles signed in on it (the bearer path)', PAIRED_DEVICE_COLUMNS],
  ['a retired device: a REVOKED one by its credential and by a session on it, an UNPAIRED one by its old credential (spec §4.1, §6.6, RB-6)', RETIRED_DEVICE_COLUMNS],
  ['AC-B-81: the credential-misuse callers over every operation', MISUSE_COLUMNS],
])('the matrix, every routed operation: %s', (_group, columns) => {
  it.each(columns.map((column) => [column, COLUMN_TITLES[column] ?? column]))('%s: %s', async (column) => {
    const caller = world.callers[column];
    if (caller === undefined) throw new Error(`no caller for the column ${column}`);
    const run = await runColumn(world.server, caller, routedOperations(), { table: 'MATRIX', grants: world.stored });
    console.info(`[w47] ${column}: ${summaryOf(run)}`);
    expect(wrongOf(run)).toEqual([]);
    expect(run).toHaveLength(routedOperations().length);
  });
});

describe('the matrix as a whole', () => {
  const matrix = (): Cell[] => cells.filter((cell) => cell.table === 'MATRIX');
  const of = (columns: readonly string[]): Cell[] => matrix().filter((cell) => columns.includes(cell.column));

  it('the deferred set is named: exactly the operations whose routes land with later rows are out of every walk', () => {
    // R4 (D44): the walk set equals the registry MINUS the fourteen later-milestone operations,
    // named with the row that owns each route. A route landing for one of them moves it into
    // every walk automatically and fails this naming until the set is revised.
    const routed = new Set(routedOperations().map((operation) => operation.operationId));
    expect([...routed].sort()).toEqual(CORE_API_OPERATIONS.filter((operation) => !Object.keys(DEFERRED_ROUTE).includes(operation.operationId)).map((operation) => operation.operationId).sort());
    expect(Object.keys(DEFERRED_ROUTE).sort()).toEqual(CORE_API_OPERATIONS.map((operation) => operation.operationId).filter((id) => !routed.has(id)).sort());
    for (const [operationId, milestone] of Object.entries(DEFERRED_ROUTE)) {
      const operation = CORE_API_OPERATIONS.find((entry) => entry.operationId === operationId);
      expect(operation, operationId).toBeDefined();
      expect(milestone.length, operationId).toBeGreaterThan(0);
    }
  });

  it('89 routed cells for each of the five callers of AC-B-15, and 89 for the brief columns: each equal to the specification', () => {
    // The 75 of the closed base and the three STT configuration operations (C3 §2.5), which are
    // routed since task 3 row 113; the fourteen of C3 §2.2 join as their rows land (DEFERRED_ROUTE):
    // blueprint row 66 landed the five selector operations 76 to 80, 78 + 5 = 83; rows 132, 133 and
    // 142 routed operation 89 and operations 93 to 97 (C3 §2.6), 83 + 6 = 89; rows 71b, 91 and 90
    // routed operations 81, 87 and 88 (wave D), 89 + 3 = 92; integration pass D4 routed operations
    // 82, 84, 85 and 86, 92 + 4 = 96; row 82b routed operation 83, 96 + 1 = 97. The registry holds
    // 99 since task 4 row 63; row 70 routed operations 98 and 99 (decision C31), 97 + 2 = 99.
    // The registry holds 100 since task 4 row 194; operation 100 is routed by row 197 (DEFERRED_ROUTE), so 99 stays.
    // Task 4 row 197 routed operation 100 (the confirmed re-address), 99 + 1 = 100.
    // Task 4 row 108 routed operations 101 and 102 (the camera network configuration), 100 + 2 = 102.
    // Task 4 row 146b routed operation 108 (the stored-credential connection test), 102 + 1 = 103.
    // Task 4 row 107 routed operation 103 (the commissioning scan), 103 + 1 = 104.
    // Task 4 row 117 routed operations 109 and 110 (the installation acceptance and its revocation), 104 + 2 = 106. (Moved by this row's delta only.)
    // Task 4 row 106b routed operations 104 and 105 (the alias state and its removal), 106 + 2 = 108. (Moved by this row's delta only.)
    // Task 4 row 111 routed operations 106 and 107 (the set-IP job and its state), 108 + 2 = 110. (Moved by this row's delta only.)
    expect(routedOperations()).toHaveLength(110);
    expect(routedOperations()).toHaveLength(CORE_API_OPERATIONS.length - Object.keys(DEFERRED_ROUTE).length);
    for (const columns of [AC_B_15_COLUMNS, BRIEF_COLUMNS]) {
      const five = of(columns);
      expect(five).toHaveLength(routedOperations().length * 5);
      expect(new Set(five.map((cell) => `${cell.operationId} ${cell.column}`)).size).toBe(routedOperations().length * 5);
      expect(wrongOf(five)).toEqual([]);
    }
    expect(matrix()).toHaveLength(routedOperations().length * (AC_B_15_COLUMNS.length + PAIRED_DEVICE_COLUMNS.length + RETIRED_DEVICE_COLUMNS.length + MISUSE_COLUMNS.length));
  });

  it('AC-B-16: every denied cell of an operator wrote exactly one row, ACCESS_DENIED or EXPORT_DENIED on the three exports, and a permitted call wrote none', () => {
    const operators = of([...ROLES, ...ROLES.map((role) => `${role}@DEVICE`)]);
    const denied = operators.filter((cell) => cell.expectsRow);
    expect(denied.filter((cell) => cell.rows.length !== 1)).toEqual([]);
    const types = denied.map((cell) => [cell.number, cell.rows[0]] as const);
    expect(types.filter(([number, type]) => type !== (spec.exportOperations.includes(number) ? 'EXPORT_DENIED' : 'ACCESS_DENIED'))).toEqual([]);
    // Per role, on each transport: the counts AC-B-16 states over the closed base, plus the cells
    // the ROUTED rows of C3 add, recomputed from their markers against the composed grant table
    // (R3, D44: no literal for the grown total). Today those are the STT configuration operations
    // 91 and 92 (`CAPTURE_CONFIG`: denied to an INVESTIGATOR, held by SUPERVISOR and TECHNICIAN),
    // and since blueprint row 66 the three selector edits 78, 79 and 80 (the same permission): 2 + 3.
    const routedIds = new Set(routedOperations().map((operation) => operation.operationId));
    const routedDelta = deniedCellsFromTable(spec.operations.filter((operation) => isApiContractSection(operation.section) && routedIds.has(operation.operationId)), spec.grants, spec.roles);
    // Rows 132, 133 and 142 routed operation 89 and operations 93 to 97, all on `CAPTURE_CONFIG`:
    // six more cells an INVESTIGATOR is denied, 5 + 6 = 11.
    // Wave D and integration pass D4, EVERY cell by operation and role against the access table of
    // C3 §2.2 (rows 81 to 88) and the grants of C3 §0 / spec §6:
    //   81 switchAudioSource         `SESSION_START` + condition `SESSION_HOLDER`. INVESTIGATOR +1:
    //                                the role HOLDS the permission and is refused by the CONDITION -
    //                                the holder is the operator who created the open session, and
    //                                this fixture has no open session (C3 §2.2 access note: "an
    //                                operator who holds SESSION_START but is neither is refused 403").
    //                                (This count is the TABLE's, without a session. In the run, the
    //                                column that created the open session is its holder and passes:
    //                                `runCell` reads the creator before the call - pass D6.)
    //                                `deniedCellsFromTable` counts a SESSION_HOLDER row for every
    //                                role but SUPERVISOR for that reason. TECHNICIAN +1: the same
    //                                condition (and the role does not hold SESSION_START either).
    //   87 getEvidenceExportJob      `EVIDENCE_EXPORT`, granted to SUPERVISOR only: INVESTIGATOR +1,
    //                                TECHNICIAN +1.
    //   85 createTranscriptRevision  `TRANSCRIPT_REVISE`, granted to INVESTIGATOR and SUPERVISOR
    //                                (OD-15): TECHNICIAN +1.
    //   82 listAudioSourceIntervals  AUTHENTICATED: no cell.
    //   84, 86, 88                   `EVIDENCE_VIEW`, which every role holds: no cell.
    // INVESTIGATOR 11 + 2 = 13; SUPERVISOR 0; TECHNICIAN 0 + 3 = 3.
    // Task 4 row 70 routed operations 98 and 99, both on `CAPTURE_CONFIG` (SUPERVISOR, TECHNICIAN):
    // two more cells an INVESTIGATOR is denied, 13 + 2 = 15.
    // Task 4 row 108 routed operations 101 and 102, both on `CAPTURE_COMMISSION` (TECHNICIAN only, decision U10):
    // two more cells an INVESTIGATOR is denied, 15 + 2 = 17, and the first two a SUPERVISOR is denied, 0 + 2 = 2.
    // (Moved by this row's delta only: the cell of operation 100, routed by row 197, is that row's to add.)
    // Task 4 row 197 routed operation 100 on `CAPTURE_CONFIG` (SUPERVISOR, TECHNICIAN): one more cell an INVESTIGATOR is denied, 17 + 1 = 18.
    // Task 4 row 107 routed operation 103 on `CAPTURE_COMMISSION` (TECHNICIAN only): one more cell an INVESTIGATOR is denied, 18 + 1 = 19,
    // and one more a SUPERVISOR is denied, 2 + 1 = 3. (Moved by this row's delta only.)
    // Task 4 row 146b routed operation 108 on `CAPTURE_CONFIG` (SUPERVISOR, TECHNICIAN): one more cell an INVESTIGATOR is denied, 19 + 1 = 20.
    // (Moved by this row's delta only.)
    // Task 4 row 117 routed operations 109 and 110 on `CAPTURE_COMMISSION` (TECHNICIAN only): two more cells an INVESTIGATOR is denied, 20 + 2 = 22,
    // and two more a SUPERVISOR is denied, 3 + 2 = 5. (Moved by this row's delta only.)
    // Task 4 row 106b routed operations 104 and 105 on `CAPTURE_COMMISSION` (TECHNICIAN only): two more cells an INVESTIGATOR is denied, 22 + 2 = 24,
    // and two more a SUPERVISOR is denied, 5 + 2 = 7. (Moved by this row's delta only.)
    // Task 4 row 111 routed operations 106 and 107 on `CAPTURE_COMMISSION` (TECHNICIAN only): two more cells an INVESTIGATOR is denied, 24 + 2 = 26,
    // and two more a SUPERVISOR is denied, 7 + 2 = 9. (Moved by this row's delta only.)
    expect(routedDelta).toEqual({ INVESTIGATOR: 26, SUPERVISOR: 9, TECHNICIAN: 3 });
    const cellsOf = (role: string): string[] =>
      spec.operations
        .filter((operation) => isApiContractSection(operation.section) && routedIds.has(operation.operationId))
        .filter((operation) => (deniedCellsFromTable([operation], spec.grants, [role])[role] ?? 0) === 1)
        .map((operation) => operation.operationId);
    // The same account, by name: the cells that joined since the literal read 11 / 0 / 0.
    const sinceEleven = ['switchAudioSource', 'getEvidenceExportJob', 'createTranscriptRevision'];
    expect(cellsOf('INVESTIGATOR').filter((operationId) => sinceEleven.includes(operationId)).sort()).toEqual(['getEvidenceExportJob', 'switchAudioSource']);
    expect(cellsOf('TECHNICIAN').sort()).toEqual(['createTranscriptRevision', 'getEvidenceExportJob', 'switchAudioSource']);
    // Task 4 row 108: the two configuration operations are the only cells a SUPERVISOR is denied by permission.
    // Task 4 row 107: and the commissioning scan (operation 103).
    // Task 4 row 117: and the installation acceptance and its revocation (operations 109 and 110).
    // Task 4 row 106b: and the alias state and its removal (operations 104 and 105).
    // Task 4 row 111: and the set-IP job and its state (operations 106 and 107).
    expect(cellsOf('SUPERVISOR').sort()).toEqual(['acceptInstallation', 'getCameraNetworkJob', 'getCaptureNetworkConfig', 'getHostAlias', 'removeHostAlias', 'revokeInstallationAcceptance', 'scanFactoryCameras', 'setCameraNetwork', 'updateCaptureNetworkConfig']);
    // On a paired device the condition WEB_CONSOLE_SESSION (C3 §0; D80(3)) adds one denied cell per
    // ROUTED operation that carries it, for a role that HOLDS its permission. None is routed today
    // (operations 89, 95 and 96 land with row 142): the count is derived, so it follows their routes.
    const webOnlyOnDevice = (role: string): number =>
      routedOperations().filter(
        (operation) =>
          conditionsOf(operation).includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION) &&
          coreApiAccessPermissions(operation.access).some((permission) => world.stored.some((grant) => grant.role === role && grant.permission === permission)),
      ).length;
    // Pass D6: a SESSION_HOLDER cell the MODEL allowed (the column created the open session; the fact
    // is read from the database before the call, `runCell`) is no denied cell of that column. Counted
    // from the expectation, never from the answer.
    const holderOperations = CORE_API_OPERATIONS.filter((operation) => conditionsOf(operation).includes(CoreApiAccessCondition.SESSION_HOLDER)).map((operation) => operation.operationId);
    const heldBy = (column: string): number => matrix().filter((cell) => cell.column === column && holderOperations.includes(cell.operationId) && cell.expected === 'allowed' && !column.startsWith('SUPERVISOR')).length;
    for (const [role, stated] of Object.entries(spec.statedDeniedCells)) {
      expect(denied.filter((cell) => cell.column === role)).toHaveLength(stated + (routedDelta[role] ?? 0) - heldBy(role));
      expect(denied.filter((cell) => cell.column === `${role}@DEVICE`)).toHaveLength(stated + (routedDelta[role] ?? 0) + webOnlyOnDevice(role) - heldBy(`${role}@DEVICE`));
    }
    // The holder rule is exercised on BOTH sides in this run: a column that is refused by it, and one that holds.
    expect(matrix().filter((cell) => holderOperations.includes(cell.operationId) && cell.expected !== 'allowed' && cell.column.startsWith('INVESTIGATOR') || holderOperations.includes(cell.operationId) && cell.column.startsWith('TECHNICIAN')).length).toBeGreaterThan(0);
    expect(operators.filter((cell) => cell.allowed && cell.rows.some((type) => DENIAL_ROW_TYPES.includes(type)))).toEqual([]);
    // A 401 and a DEVICE_NOT_PAIRED wrote none, in any column.
    expect(matrix().filter((cell) => !cell.allowed && (cell.status === 401 || cell.code === 'DEVICE_NOT_PAIRED') && cell.rows.length > 0)).toEqual([]);
    expect(matrix().filter((cell) => cell.code === 'DEVICE_NOT_PAIRED').length).toBeGreaterThan(0);
    console.info(`[w47] denied operator cells: ${denied.length}, each with one row (${denied.filter((cell) => cell.rows[0] === 'EXPORT_DENIED').length} EXPORT_DENIED)`);
  });

  it('AC-B-81, SR-73: the four credential-misuse cells answer 401 CREDENTIAL_CONFLICT, 403, 401 and 401, resolve no principal and change nothing', async () => {
    // An operation that is not public: the first of spec §7 that any signed-in operator may call.
    const target = spec.operations.find((operation) => operation.access === 'AUTHENTICATED' && operation.conditions.length === 0);
    const four = MISUSE_COLUMNS.map((column) => matrix().find((cell) => cell.column === column && cell.operationId === target?.operationId));
    expect(four.map((cell) => [cell?.column, cell?.status, cell?.code, cell?.reason, cell?.passed, cell?.rows])).toEqual([
      ['COOKIE_AND_BEARER', 401, 'NOT_SIGNED_IN', 'CREDENTIAL_CONFLICT', false, []],
      ['BEARER_WITH_WEB_ORIGIN', 403, 'ORIGIN_NOT_ALLOWED', null, false, []],
      ['DEVICE_TOKEN_AS_COOKIE', 401, 'NOT_SIGNED_IN', null, false, []],
      ['WEB_TOKEN_AS_BEARER', 401, 'NOT_SIGNED_IN', null, false, []],
    ]);
    // The first is told apart from a plain 401 by its reason. "No principal" and "nothing changed" are asserted in
    // each cell. Both early refusals are answers the contract defines for every operation.
    const envelope: readonly CoreApiEnvelopeResponse[] = CORE_API_ENVELOPE_RESPONSES;
    for (const column of MISUSE_COLUMNS) {
      const early = world.callers[column]?.early;
      if (early === null || early === undefined) continue;
      const documented = envelope.filter((answer) => answer.status === early.status && (answer.codes as readonly string[]).includes(early.code) && (answer.reason ?? null) === early.reason);
      expect(documented, column).toHaveLength(1);
    }
    expect(wrongOf(of(MISUSE_COLUMNS))).toEqual([]);
    // No misuse caller reached a handler of an operation that needs a principal, and none wrote a denial row.
    const guarded = of(MISUSE_COLUMNS).filter((cell) => specOf.get(cell.operationId)?.access !== 'PUBLIC');
    expect(guarded.filter((cell) => cell.passed || cell.rows.length > 0)).toEqual([]);
    // Routed operations again (R4): the misuse columns walk the routes that exist; the eleven
    // non-public operations of C3 join this count when their rows register their routes.
    expect(guarded).toHaveLength(MISUSE_COLUMNS.length * routedOperations().filter((operation) => specOf.get(operation.operationId)?.access !== 'PUBLIC').length);
    // The two sessions whose tokens the misuse callers borrowed are still open, each on its own transport.
    const { app } = world.server;
    expect((await app.inject({ method: 'GET', url: AUTH_SESSION, headers: world.supervisorWeb })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: AUTH_SESSION, headers: world.investigatorDevice })).statusCode).toBe(200);
    console.info(`[w47] AC-B-81 on ${target?.operationId}: ${four.map((cell) => `${cell?.column} ${printed(cell)}`).join(' | ')}`);
  });

  it("decision D118, the condition DEVICE_CREDENTIAL: on every operation that carries it the device itself passes; a session of an operator on the device is refused with 403 DEVICE_NOT_PAIRED and the reason, no row and no place in the denial budget; a web session is refused by the marker, without a reason", () => {
    // Whichever operations the document gives the condition to, however many.
    const carrying = needDeviceCredential();
    expect(carrying.length).toBeGreaterThan(0);
    const on = (columns: readonly string[]): Cell[] => of(columns).filter((cell) => carrying.includes(cell.operationId));
    const facts = (cell: Cell): unknown[] => [cell.status, cell.code, cell.reason, cell.rows.length, cell.places, cell.passed];

    // The device itself, with its own credential: let through.
    const device = on(['DEVICE']);
    expect(device.map((cell) => cell.operationId).sort()).toEqual([...carrying].sort());
    // "Let through" is all that is said of it here: what its handler then answers and writes is the handler's
    // (a sign-in with the registry's example token is a failed attempt, with its own row and its own place).
    expect(device.map((cell) => [cell.passed, cell.rows.some((type) => DENIAL_ROW_TYPES.includes(type))])).toEqual(device.map(() => [true, false]));
    // The session of an operator who is signed in on the device: the three roles alike, whatever they hold.
    const sessions = on(ROLES.map((role) => `${role}@DEVICE`));
    expect(sessions).toHaveLength(carrying.length * ROLES.length);
    expect(sessions.map(facts)).toEqual(sessions.map(() => [403, 'DEVICE_NOT_PAIRED', spec.deviceCredentialReason, 0, 0, false]));
    // A web console session: refused by the marker before any condition is looked at. Same code, no reason.
    const web = on(ROLES);
    expect(web.map(facts)).toEqual(web.map(() => [403, 'DEVICE_NOT_PAIRED', null, 0, 0, false]));
    // A retired device is decided before the condition: its row and its place, as on every other operation.
    const retired = on(RETIRED_DEVICE_COLUMNS);
    expect(retired.map(facts)).toEqual(retired.map(() => [403, 'DEVICE_REVOKED', 'DEVICE_REVOKED', 1, 1, false]));
    // Nobody: 401, as on every operation of the marker.
    const nobody = on(['ANONYMOUS', 'UNPAIRED_DEVICE']);
    expect(nobody.map(facts)).toEqual(nobody.map(() => [401, 'NOT_SIGNED_IN', null, 0, 0, false]));
    expect(wrongOf(on([...AC_B_15_COLUMNS, ...PAIRED_DEVICE_COLUMNS, ...RETIRED_DEVICE_COLUMNS, ...MISUSE_COLUMNS]))).toEqual([]);
    console.info(`[w47] D118 on ${carrying.join(', ')}: DEVICE ${printed(device[0])} | a session on the device ${printed(sessions[0])}, rows 0, places 0 | a web session ${printed(web[0])} | a retired device ${printed(retired[0])}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// The six operations no seeded role is denied on
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Changes the stored grants of the clone as `dems_owner`, runs `body`, and puts the stored matrix back. */
async function withGrantChange<T>(server: Server, change: { readonly add?: readonly Grant[]; readonly remove?: readonly Grant[] }, body: (grants: Grant[]) => Promise<T>): Promise<T> {
  const before = await storedGrants(server.owner);
  try {
    for (const grant of change.remove ?? []) await server.owner.query('DELETE FROM public.role_permissions WHERE role_id = $1 AND permission_id = $2', [grant.role, grant.permission]);
    for (const grant of change.add ?? []) await server.owner.query('INSERT INTO public.role_permissions (role_id, permission_id) VALUES ($1, $2)', [grant.role, grant.permission]);
    server.counts = await countTables(server);
    return await body(await storedGrants(server.owner));
  } finally {
    for (const grant of change.add ?? []) await server.owner.query('DELETE FROM public.role_permissions WHERE role_id = $1 AND permission_id = $2', [grant.role, grant.permission]);
    for (const grant of change.remove ?? []) await server.owner.query('INSERT INTO public.role_permissions (role_id, permission_id) VALUES ($1, $2)', [grant.role, grant.permission]);
    expect(grantNames(await storedGrants(server.owner))).toEqual(grantNames(before));
    server.counts = await countTables(server);
  }
}

describe('the operations whose permission every seeded role holds: their denied cells, with a grant removed in the clone after the boot', () => {
  it('a role that loses the permission is refused with 403 and exactly one ACCESS_DENIED row on each of them, at its next request, on the web and on the device', async () => {
    const { server } = world;
    const heldByAll = spec.permissions.filter((permission) => spec.roles.every((role) => world.stored.some((grant) => grant.role === role && grant.permission === permission)));
    // Routed only: of the operations gated solely on the permission every role holds, the three
    // transcript/evidence reads C3 adds (84, 86, 88) answer no route until their rows land (R4);
    // they join this block by themselves when a row registers their routes.
    const operations = routedOperations().filter((operation) => {
      const needed = coreApiAccessPermissions(operation.access);
      return needed.length > 0 && needed.every((permission) => heldByAll.includes(permission));
    });
    const run: Cell[] = [];
    for (const role of ROLES) {
      await withGrantChange(server, { remove: heldByAll.map((permission) => ({ role, permission })) }, async (grants) => {
        for (const column of [role, `${role}@DEVICE`]) {
          const caller = world.callers[column];
          if (caller === undefined) throw new Error(`no caller for the column ${column}`);
          run.push(...(await runColumn(server, caller, operations, { table: 'GRANT_REMOVED', grants })));
        }
      });
    }
    expect(wrongOf(run)).toEqual([]);
    expect(run).toHaveLength(operations.length * ROLES.length * 2);
    expect(run.map((cell) => [cell.status, cell.code, cell.rows.join()])).toEqual(run.map(() => [403, 'NOT_PERMITTED', 'ACCESS_DENIED']));
    // The grants are back: the same callers are let through again.
    const again: Cell[] = [];
    for (const role of ROLES) {
      const caller = world.callers[role];
      if (caller !== undefined) again.push(...(await runColumn(server, caller, operations, { table: 'GRANT_RESTORED', grants: world.stored, probeOnly: true })));
    }
    expect(wrongOf(again)).toEqual([]);
    expect(again.filter((cell) => !cell.passed)).toEqual([]);
    console.info(`[w47] grant removed (${heldByAll.join(', ')}): ${summaryOf(run)}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// The demo flag off
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('the demo operations with the demo flag OFF (DC-1, DC-2; AC-B-56): a second server on a second clone', () => {
  it('a holder of DEMO_CONTROL gets 403 DEMO_DISABLED and no row; the other roles 403 NOT_PERMITTED and one row, whatever the flag; nobody 401', async () => {
    const off = await startServer(await db.another(), false);
    const stored = await storedGrants(off.owner);
    const callers: Caller[] = [ANONYMOUS];
    for (const role of ROLES) {
      const { cookie } = await signInOnWeb(off, role);
      callers.push(webOperator(role, cookie));
      off.sessions.push({ origin: WEB_ORIGIN, ...cookie });
    }
    await nextWindow(off);
    const operations = CORE_API_OPERATIONS.filter((operation) => conditionsOf(operation).includes('DEMO_FLAG'));
    expect(operations.map((operation) => specRowOf(operation).section)).toEqual(operations.map(() => '7.16'));
    const startedWith = await datasetMark(off.owner);
    const run: Cell[] = [];
    for (const caller of callers) run.push(...(await runColumn(off, caller, operations, { table: 'FLAG_OFF', grants: stored })));
    expect(wrongOf(run)).toEqual([]);
    expect(run).toHaveLength(5 * 4);
    // Nobody passed stage 6: no handler of a demo operation ran, and nothing was reset.
    expect(run.filter((cell) => cell.passed)).toEqual([]);
    expect(await datasetMark(off.owner)).toEqual(startedWith);
    const holders = ROLES.filter((role) => stored.some((grant) => grant.role === role && grant.permission === 'DEMO_CONTROL'));
    expect(run.filter((cell) => holders.includes(cell.column)).map((cell) => [cell.status, cell.code, cell.rows.length])).toEqual(operations.flatMap(() => holders.map(() => [403, 'DEMO_DISABLED', 0])));
    expect(off.budgetProblems).toEqual([]);
    console.info(`[w47] demo flag off: ${summaryOf(run)}`);
  });

  it('with the flag ON the same holder passes stage 6 on all five, and neither loadScenario nor resetDemo ran: the epoch and the lineage of discarded chains are as they were', async () => {
    const { server } = world;
    const demo = cells.filter((cell) => cell.table === 'MATRIX' && specOf.get(cell.operationId)?.section === '7.16');
    const holders = ROLES.filter((role) => world.stored.some((grant) => grant.role === role && grant.permission === 'DEMO_CONTROL'));
    const held = demo.filter((cell) => holders.includes(cell.column) || holders.map((role) => `${role}@DEVICE`).includes(cell.column));
    expect(held).toHaveLength(5 * 2 * holders.length);
    expect(held.filter((cell) => !cell.passed)).toEqual([]);
    // The two that would replace the dataset were sent with a body that is no JSON: no handler ran.
    const replacing = held.filter((cell) => cell.mode === 'PROBE');
    expect([...new Set(replacing.map((cell) => cell.operationId))].sort()).toEqual(['loadScenario', 'resetDemo']);
    expect(replacing.map((cell) => [cell.status, cell.code])).toEqual(replacing.map(() => [400, 'INVALID_JSON']));
    expect(cells.filter((cell) => cell.rows.includes('SCENARIO_LOADED'))).toEqual([]);
    expect(await datasetMark(server.owner)).toEqual(world.startedWith);
    expect(world.startedWith.epoch).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Can it fail?
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('can the matrix fail? The clone or the caller is changed, the expectation is not', () => {
  /** The operations on which the expectation of a role differs between two sets of grants. */
  function affectedBy(role: string, changed: readonly Grant[]): string[] {
    const caller = world.callers[role] ?? ANONYMOUS;
    const describeWith = (operation: CoreApiRegistryOperation, grants: readonly Grant[]): string =>
      describeExpectation(expectationFor(operation, caller, grants, true));
    // Routed operations only: a cell of an operation whose route lands with a later row cannot
    // turn red here (R4), and the walk above runs exactly this set.
    const routed = new Set(routedOperations().map((operation) => operation.operationId));
    return CORE_API_OPERATIONS
      .filter((operation) => routed.has(operation.operationId))
      .filter((operation) => describeWith(operation, changed) !== describeWith(operation, spec.grants))
      .map((operation) => operation.operationId);
  }

  /** The grant change (a role and a permission, from the tables of spec §4.4) that moves the most cells. */
  function widestChange(kind: 'add' | 'remove'): { readonly grant: Grant; readonly affected: string[] } {
    let widest: { grant: Grant; affected: string[] } | undefined;
    for (const role of spec.roles) {
      for (const permission of spec.permissions) {
        const held = spec.grants.some((grant) => grant.role === role && grant.permission === permission);
        if (held === (kind === 'add')) continue;
        const grant = { role, permission };
        const changed = kind === 'add' ? [...spec.grants, grant] : spec.grants.filter((candidate) => candidate.role !== role || candidate.permission !== permission);
        const affected = affectedBy(role, changed);
        if (widest === undefined || affected.length > widest.affected.length) widest = { grant, affected };
      }
    }
    if (widest === undefined) throw new Error('spec §4.4 leaves no grant to change');
    return widest;
  }

  const redOperations = (run: readonly Cell[]): string[] => run.filter((cell) => cell.problems.length > 0).map((cell) => cell.operationId);

  it('a permission granted to a role that should not have it (in the clone, after the boot): exactly the cells that grant opens go red', async () => {
    const { grant, affected } = widestChange('add');
    const caller = world.callers[grant.role];
    if (caller === undefined) throw new Error(`no caller for the role ${grant.role}`);
    const run = await withGrantChange(world.server, { add: [grant] }, () => runColumn(world.server, caller, routedOperations(), { table: 'CAN_IT_FAIL', grants: spec.grants, probeOnly: true }));
    expect(affected.length).toBeGreaterThan(0);
    expect(redOperations(run)).toEqual(affected);
    // Each of them was let through where the specification refuses: no 403, no row.
    expect(run.filter((cell) => affected.includes(cell.operationId)).map((cell) => [cell.passed, cell.rows.length])).toEqual(affected.map(() => [true, 0]));
    console.info(`[w47] can it fail, a grant added (${grant.role}: ${grant.permission}): ${affected.length} of ${routedOperations().length} cells red (${affected.join(', ')})`);
  });

  it('a permission taken from a role that should have it: exactly the cells that grant opened go red', async () => {
    const { grant, affected } = widestChange('remove');
    const caller = world.callers[grant.role];
    if (caller === undefined) throw new Error(`no caller for the role ${grant.role}`);
    const run = await withGrantChange(world.server, { remove: [grant] }, () => runColumn(world.server, caller, routedOperations(), { table: 'CAN_IT_FAIL', grants: spec.grants, probeOnly: true }));
    expect(affected.length).toBeGreaterThan(0);
    expect(redOperations(run)).toEqual(affected);
    expect(run.filter((cell) => affected.includes(cell.operationId)).map((cell) => [cell.status, cell.passed])).toEqual(affected.map(() => [403, false]));
    console.info(`[w47] can it fail, a grant removed (${grant.role}: ${grant.permission}): ${affected.length} of ${routedOperations().length} cells red (${affected.join(', ')})`);
  });

  it('a retired device presented where the cell expects a PAIRED one: every cell is red, and the device operations answer 403 DEVICE_REVOKED', async () => {
    const paired = world.callers['DEVICE'];
    const retired = world.callers['RETIRED_DEVICE'];
    if (paired === undefined || retired === undefined) throw new Error('the device callers are missing');
    // The expectation of the PAIRED device, the credential and the throttle key of the retired one.
    const impostor: Caller = { ...paired, headersFor: retired.headersFor, keyFor: retired.keyFor };
    const run = await runColumn(world.server, impostor, routedOperations(), { table: 'CAN_IT_FAIL', grants: world.stored, probeOnly: true, holderFact: false });
    expect(redOperations(run)).toHaveLength(routedOperations().length);
    const deviceOperations = CORE_API_OPERATIONS.filter((operation) => operation.access.kind === CoreApiAccessKind.DEVICE).map((operation) => operation.operationId);
    expect(run.filter((cell) => deviceOperations.includes(cell.operationId)).map((cell) => [cell.expected, cell.status, cell.code])).toEqual(deviceOperations.map(() => ['allowed', 403, 'DEVICE_REVOKED']));
    console.info(`[w47] can it fail, a retired device in the PAIRED column: ${redOperations(run).length} of ${routedOperations().length} cells red`);
  });

  it("the session of an operator on the device presented where the cell expects the device itself: every cell is red, and an operation that needs the device's own credential answers 403 with the reason, no row and no place in the budget", async () => {
    const device = world.callers['DEVICE'];
    const session = world.callers[`${ROLES[0]}@DEVICE`];
    if (device === undefined || session === undefined) throw new Error('the callers of the paired device are missing');
    // The expectation of the DEVICE principal, the credential and the throttle key of the session.
    const impostor: Caller = { ...device, headersFor: session.headersFor, keyFor: session.keyFor };
    const run = await runColumn(world.server, impostor, routedOperations(), { table: 'CAN_IT_FAIL', grants: world.stored, probeOnly: true });
    expect(redOperations(run)).toHaveLength(routedOperations().length);
    const carrying = needDeviceCredential();
    const open = CORE_API_OPERATIONS.filter((operation) => operation.access.kind === CoreApiAccessKind.DEVICE)
      .map((operation) => operation.operationId)
      .filter((operationId) => !carrying.includes(operationId));
    expect(carrying.length).toBeGreaterThan(0);
    // Where the device's own credential is needed, the session is refused: this is what the condition adds.
    expect(run.filter((cell) => carrying.includes(cell.operationId)).map((cell) => [cell.expected, cell.status, cell.code, cell.reason, cell.rows.length, cell.places, cell.passed])).toEqual(
      carrying.map(() => ['allowed', 403, 'DEVICE_NOT_PAIRED', spec.deviceCredentialReason, 0, 0, false]),
    );
    // The other operations of the marker are open to the session too: red only by who stage 4 resolved.
    expect(run.filter((cell) => open.includes(cell.operationId) && !cell.passed)).toEqual([]);
    console.info(`[w47] can it fail, a session on the device in the column of the DEVICE: ${routedOperations().length} of ${routedOperations().length} cells red; refused for the device's own credential: ${carrying.join(', ')}`);
  });

  it('the session of one role presented where the cell expects another: every cell is red, and where both are refused the row names the wrong actor and the wrong role', async () => {
    const denies = (role: string, operation: CoreApiRegistryOperation): boolean => {
      const expectation = expectationFor(operation, world.callers[role] ?? ANONYMOUS, world.stored, true);
      return !expectation.allowed && expectation.row !== null;
    };
    // The two roles that are refused on the most operations together.
    let pair: { expected: string; presented: string; both: string[] } | undefined;
    for (const expected of ROLES) {
      for (const presented of ROLES) {
        if (expected === presented) continue;
        const both = CORE_API_OPERATIONS.filter((operation) => denies(expected, operation) && denies(presented, operation)).map((operation) => operation.operationId);
        if (pair === undefined || both.length > pair.both.length) pair = { expected, presented, both };
      }
    }
    const expected = pair === undefined ? undefined : world.callers[pair.expected];
    const presented = pair === undefined ? undefined : world.callers[pair.presented];
    if (pair === undefined || expected === undefined || presented === undefined) throw new Error('spec §4.4 names fewer than two roles');
    const impostor: Caller = { ...expected, headersFor: presented.headersFor, keyFor: presented.keyFor };
    const run = await runColumn(world.server, impostor, routedOperations(), { table: 'CAN_IT_FAIL', grants: world.stored, probeOnly: true, holderFact: false });
    expect(redOperations(run)).toHaveLength(routedOperations().length);
    const refusedForBoth = run.filter((cell) => pair.both.includes(cell.operationId));
    expect(refusedForBoth.length).toBeGreaterThan(0);
    // Same status and same code as expected, and exactly one row: only what the row and the answer NAME is wrong.
    expect(refusedForBoth.filter((cell) => cell.status !== 403 || cell.rows.length !== 1)).toEqual([]);
    for (const needle of ['the row names the actor', 'details.role of the row', 'error.details.role']) {
      expect(refusedForBoth.filter((cell) => !cell.problems.some((problem) => problem.includes(needle)))).toEqual([]);
    }
    console.info(`[w47] can it fail, the session of the ${pair.presented} in the column of the ${pair.expected}: ${routedOperations().length} of ${routedOperations().length} cells red; ${refusedForBoth.length} of them only by the actor and the role their row and their answer name`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// The denial budget, and the printed matrix
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** One cell of the printed matrix: the status, the code and the rows written. */
function printed(cell: Cell | undefined): string {
  if (cell === undefined) return '';
  const rows = cell.rows.length === 0 ? '' : ` · ${cell.rows.join(' + ')}`;
  const probe = cell.mode === 'PROBE' && cell.passed ? ' (no JSON)' : '';
  const reason = cell.reason === null || cell.reason === cell.code ? '' : ` (${cell.reason})`;
  return `${cell.status}${cell.code === null ? '' : ` ${cell.code}`}${reason}${probe}${rows}`;
}

function tableOf(table: string, columns: readonly string[], rowsOf: readonly SpecOperation[]): string[] {
  const lines = [`| # | Operation | Access rule | ${columns.join(' | ')} |`, `|--:|---|---|${columns.map(() => '---').join('|')}|`];
  for (const operation of rowsOf) {
    const row = columns.map((column) => printed(cells.find((cell) => cell.table === table && cell.column === column && cell.operationId === operation.operationId)));
    if (row.every((text) => text === '')) continue;
    // The marker of the row and, where it has any, its conditions.
    const rule = [operation.access, ...operation.conditions].map((part) => `\`${part}\``).join(' + ');
    lines.push(`| ${operation.number} | \`${operation.operationId}\` | ${rule} | ${row.join(' | ')} |`);
  }
  return lines;
}

function matrixDocument(server: Server): string {
  const matrix = cells.filter((cell) => cell.table === 'MATRIX');
  const permitted = spec.operations.map((operation) => {
    const answers = matrix.filter((cell) => cell.operationId === operation.operationId && cell.passed);
    const kinds = [...new Set(answers.map((cell) => `${cell.status}${cell.code === null ? '' : ` ${cell.code}`}`))].sort();
    const entry = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operation.operationId);
    const mode = answers[0]?.mode ?? (entry === undefined ? '' : cellModeOf(entry));
    return `| ${operation.number} | \`${operation.operationId}\` | ${mode} | ${answers.length} | ${kinds.join(', ')} |`;
  });
  return [
    '# Role-by-endpoint matrix: what each cell answered',
    '',
    `Written by \`apps/core-server/test/acceptance/rbac-matrix.test.ts\`. Specification revision ${spec.revision}. `,
    'A cell reads `status code · audit rows the call wrote`. Rows in the order of spec §7.',
    '`(no JSON)`: the command was sent with a body that is no JSON, so stage 7 answered and no handler ran.',
    '',
    `Cells: ${cells.length} in all, ${matrix.length} in the matrix; not as specified: ${cells.filter((cell) => cell.table !== 'CAN_IT_FAIL' && cell.problems.length > 0).length}; answered 429: ${cells.filter((cell) => cell.status === 429).length}; windows of 60 s used: ${server.windows}.`,
    '',
    '## 1. The five callers of AC-B-15',
    '',
    ...tableOf('MATRIX', AC_B_15_COLUMNS, spec.operations),
    '',
    '## 2. A paired device, and the three roles signed in on it',
    '',
    ...tableOf('MATRIX', PAIRED_DEVICE_COLUMNS, spec.operations),
    '',
    '## 3. A retired device: a REVOKED one by its credential and by a session on it, an UNPAIRED one by its old credential',
    '',
    ...tableOf('MATRIX', RETIRED_DEVICE_COLUMNS, spec.operations),
    '',
    '## 4. The four credential-misuse callers of AC-B-81',
    '',
    ...tableOf('MATRIX', MISUSE_COLUMNS, spec.operations),
    '',
    '## 5. The demo operations with the demo flag off (a second server on a second clone)',
    '',
    ...tableOf('FLAG_OFF', ['ANONYMOUS', ...ROLES], spec.operations),
    '',
    '## 6. The operations every seeded role may call, with the grant removed in the clone',
    '',
    ...tableOf('GRANT_REMOVED', [...ROLES, ...ROLES.map((role) => `${role}@DEVICE`)], spec.operations),
    '',
    '## 7. What a permitted call was answered, per operation (all columns of the matrix)',
    '',
    '| # | Operation | How the command was sent | Cells let through | Answers |',
    '|--:|---|---|--:|---|',
    ...permitted,
    '',
  ].join('\n');
}

describe('the denial budget and the throttle (F25, GS-20)', () => {
  it('no cell of this file was answered 429, no limit was reached, and the server counted the refusals of every key as the test did', async () => {
    const { server } = world;
    // The open window too, before the last count is dropped.
    await nextWindow(server);
    expect(cells.filter((cell) => cell.status === 429 || cell.code === 'RATE_LIMITED')).toEqual([]);
    expect(server.log.lines().filter((line) => line['msg'] === 'rate limit reached')).toEqual([]);
    expect(server.budgetProblems).toEqual([]);
    expect(server.windows).toBeGreaterThan(1);
    // The whole file, the three "can it fail" columns apart, equals the specification.
    expect(wrongOf(cells.filter((cell) => cell.table !== 'CAN_IT_FAIL'))).toEqual([]);
    const tables = [...new Set(cells.map((cell) => cell.table))].map((table) => `${table} ${cells.filter((cell) => cell.table === table).length}`);
    console.info(`[w47] ${cells.length} cells (${tables.join(', ')}); 429: 0; windows of ${spec.windowMs / 1000} s used: ${server.windows}; limits: ${spec.denialBudget} refusals and ${spec.strictLimit} requests per key and window`);
    // The tables a refused call is not held to, as they moved over the whole file: the trail, and the engine's timed table.
    const moved = [...TRAIL_TABLES, ...ENGINE_TIMED_TABLES].map((table) => `${table} ${world.startedCounts[table]} to ${server.counts[table]}`);
    console.info(
      `[w47] row counts from the first cell to the last: ${moved.join(', ')}; ` +
        `${ENGINE_TIMED_TABLES.join(', ')} gained a row in ${server.timedTableMoves.permitted} permitted and ${server.timedTableMoves.refused} refused cells`,
    );
    // The matrix as a document, when the run asks for it (the report's asset). Nothing is written otherwise.
    const file = process.env['DEMS_W47_MATRIX_FILE'];
    if (file !== undefined && file !== '') writeFileSync(file, matrixDocument(server));
  });
});
