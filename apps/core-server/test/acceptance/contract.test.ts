// Acceptance test "contract conformance" of the DEMS Core server (plan row W52; success
// criterion SC6; AC-B-09, AC-B-10, AC-B-14, AC-B-70, AC-B-93; SR-76; spec §7.1 API-7 and API-13,
// §7.2, §7.3, §14.2 OR-9; decisions D64, D69, D83 DN-11).
//
// WHAT IS ASKED. The server IS what the contract registry and the committed OpenAPI document
// say: the same routes, and on every route only answers the contract documents.
//
// WHAT IS REAL. The real app factory on clones of the seed template, as `dems_app`, booted as
// the entry point boots it (the boot checks, then the engine's start). Every request is
// `app.inject` through the real stages 1 to 7 and the real handlers. The callers are the seeded
// operators, signed in through the sign-in route (on the web console and on a paired tablet), and
// devices that redeemed a pairing code the server issued. Two things only are the test's: the
// server clock (a manual clock behind the seam `clock`) and the engine's timer (a manual timer),
// so no test waits and the engine ticks exactly when a test fires it.
//
// HOW AN ANSWER IS JUDGED. EVERY answer this file receives goes through `Ledger.record`
// (`contract.support.ts`): `validateCoreApiResponse` for its operation and status, the five
// headers of OR-9 with their values, the two headers of API-7 on a 2xx POST, the cookie rule of
// decision D69, never a 500, and the error code against the codes the registry names for that
// status. A departure is collected, not thrown, so one run lists them all; each test ends by
// asserting that it collected none, and the last block prints the operation-by-status table.
//
// WHERE THE EXPECTED CODES COME FROM (finding F49: the validator checks a status by its schema).
// Two tables, both used. The case table is hand-keyed from the SPECIFICATION (§7.2, §7.3): what
// each kind of request must be answered with ("no credential: 401 NOT_SIGNED_IN"), written at
// each call. The code table is derived mechanically from the REGISTRY: the code words of each
// status description and the codes of its examples (`registryCodes`).
//
// THE COUNTERS BETWEEN BLOCKS. The request throttle allows 30 requests a minute to a caller
// without a principal and 600 to an operator, and the server clock of this file stands still
// unless a test moves it. `fresh()` starts the throttle windows, the denial budgets and the two
// lockouts afresh through the server's own test controls. The 429 and the 423 are produced on
// purpose, by real requests, in their own block.
//
// Secrets (P19). A cookie, a session token, a device credential, a biometric token and a pairing
// code are taken from an answer and handed on. None is printed, logged, put into a test name or
// compared in an assertion whose failure message would show it.
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOW_HEADER_NAME,
  API_BODY_LIMIT_BYTES,
  CORE_API_EXAMPLES,
  CORE_API_OPERATION_TABLE,
  CORE_API_SCHEMAS,
  CoreApiAccessCondition,
  CoreApiAccessKind,
  RETRY_AFTER_HEADER_NAME,
  WS_PATH,
  coreApiAccessPermissions,
  createOpenApiDocument,
  describeCoreApiAccess,
  listCoreApiOperations,
  listCoreApiResponseStatuses,
  listOpenApiOperations,
  serializeOpenApiDocument,
  validateCoreApiResponse,
  type CoreApiRegistryOperation,
  type OpenApiDocument,
} from '@dems/shared/api';
import { CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS } from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ROLE_PERMISSIONS, createManualClock, type ControllableClock, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app';
import type { DatabaseConnection } from '../../src/config';
import { BULK_TEMPLATE_NOW } from '../../src/db/fixtures/__tests__/template-hook.bulk';
import { createSystemTimers } from '../../src/capture';
import { createOnvifDiscoveryAdapter, type OnvifDiscoveryAdapter, type WsDiscoveryResult } from '../../src/capture/adapters';
import { delay, installLoopbackGuard, type LoopbackGuard } from '../../src/capture/adapters/camera/__tests__/support';
import { engineControl } from '../../src/engine';
import { captureDiscoveryControl } from '../../src/modules/capture-discovery';
import { testRoutine, useRoutine } from '../../src/modules/demo/__tests__/support';
import { identityControl } from '../../src/modules/identity';
import { pairingControl } from '../../src/modules/pairing';
import { sttConfigControl } from '../../src/modules/stt-config';
import { permissionGuard, routesOfPrintedTable } from '../../src/plugins/permission-guard';
import { throttleControl } from '../../src/plugins/throttle';
import { useTestDatabase } from '../helpers/db';
import { captureLog, unitTestConfig } from '../support/config';
import { FIXED_NOW, manualTimer } from '../support/engine';
import { createFakeOnvifStub, freeFakeOnvifPorts, type FakeOnvifStub } from '../support/fake-onvif-stub';
import { FOREIGN_ORIGIN, WEB_ORIGIN, cookieValue, type Headers } from '../support/identity';
import { dropOwn, maintenancePool, resetApplicationName } from '../support/reset';
import { sealRealItemWithTranscript, type RealTranscriptItem } from './contract.transcripts';
import {
  Ledger,
  OR9_HEADERS,
  compareRoutes,
  coverageOf,
  describeAnswer,
  describeSent,
  movedTables,
  ownCodes,
  readTables,
  registryCodes,
  routeKey,
  templateOf,
  textMembers,
  undocumentedMembers,
  withMember,
  type Answer,
  type CallerKind,
  type TableState,
} from './contract.support';

const db = useTestDatabase({ template: 'seed', slug: 'w52' });

// Caps, not waits (rule 9 of the row): a clone made inside a test waits for the clone lock, which
// the runs of other rows may hold on a loaded host.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const FILE_STARTED = performance.now();

// ── The registry, as the contract gives it ─────────────────────────────────────────────────────

const OPERATIONS: readonly CoreApiRegistryOperation[] = listCoreApiOperations('all');
const operationOf = (operationId: string): CoreApiRegistryOperation => {
  const operation = OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the registry has no operation ${operationId}`);
  return operation;
};
const methodOf = (operation: CoreApiRegistryOperation): 'GET' | 'POST' => (operation.method === 'get' ? 'GET' : 'POST');
/** The routes the registry documents, as `METHOD /path/{id}`. */
const REGISTRY_ROUTES = OPERATIONS.map((operation) => routeKey(operation.method, operation.path));
/** Decision D83 DN-3: `GET /ws` is the one route outside the registry. */
const CHANNEL_ROUTE = routeKey('GET', WS_PATH);
/**
 * Task 3 row 90 (C3 §2.4; controller ruling D140): `GET /media/{token}`, the evidence media route, is the second
 * route outside the registry. The guard gives it the rule of operation 88, the operation that issues its sessions.
 */
const MEDIA_ROUTE = routeKey('GET', '/media/{token}');
/**
 * Task 3 fix pass F-M8 (review finding R93-05; controller ruling D178): `GET /exports/{token}`, the signed download of
 * a finished export, is the third route outside the registry (the contract totals do not move). The guard gives it the
 * rule of operation 87, the operation that names the signed path.
 */
const EXPORT_DOWNLOAD_ROUTE = routeKey('GET', '/exports/{token}');
const EXTERNAL_ROUTES: readonly string[] = [CHANNEL_ROUTE, MEDIA_ROUTE, EXPORT_DOWNLOAD_ROUTE];

/**
 * The 14 registry routes whose handlers land with later rows (R4, ruling D44): ops 76-80 and 89
 * with row 66 / M4-W2 (capture-config), op 81 with M5, ops 82 and 83 with M5/M7, ops 84-88 with
 * M7/M8. As landed at M2 the router held 76 routes and the registry 89; since task 3 row 113 (the
 * STT configuration operations 90 to 92, which ARE routed) it is 79 and 92; the walks that CALL
 * these operations stay red until their rows land. Where a walk of this file must compare the
 * whole documented set, it names this list, so the deferral is exact and drift-guarded: a new
 * unrouted operation, or one of these getting its route, fails the equality. (Hoisted to module
 * scope by RECON-D row 55-F3: the committed-document walk needs the same named deferral the
 * detector already holds; the list itself is unchanged.)
 */
// Blueprint row 66 / M4-W2 landed the handlers of operations 76 to 80 (the capture-config module):
// their five routes left this list. Task 3 R-9..R-11 (decisions D106, D114): the registry gained
// operations 93 to 97; rows 132, 133 and 142 routed them and operation 89 (`modules/capture-discovery`
// with its `connect` routes, `modules/capture-inputs`), so none of the six is here. The list was 8.
// Wave D (decision D133; integration pass D1b): row 91 routed operation 87 (`GET
// /api/v1/evidence/exports/{id}`, the evidence-export unit) and row 71b operation 81 (`POST
// /api/v1/session/{id}/audio-source`): their two entries left the list. The list was 6.
// Integration pass D4 (decision D146) routed operation 82 (`modules/sessions`) and operations 84, 85
// and 86 (`modules/transcripts`): their four entries left the list. What is left is another row's.
// Row 90 (ruling D140) routed operation 88 (`modules/media-stream`): its entry left the list. The list was 5, by owner:
//   83 getSealingProgress          rows 82 / 86 (the sealing pipeline's progress)
//   82 listAudioSourceIntervals    the session wiring of row 71 (no route in wave D yet)
//   84 getTranscript, 85 createTranscriptRevision, 86 listTranscriptRevisions
//                                  the transcript read / revision routes (the server side of row 92's UI)
// Task 4 (blueprint row 63, WP-07b; integration pass I-2): the contract of the two sound-card
// operations 98 and 99 landed before their routes. Row 70 (the live path) routes them and takes both
// entries out again. In the order `compareRoutes` reports (sorted):
//   99 registerCaptureAudioInput, 98 searchCaptureAudioCards      task 4 row 70
const LANDED_UNROUTED: readonly string[] = [
  'POST /api/v1/capture/audio-cards/inputs',
  'POST /api/v1/capture/audio-cards/search',
];
/**
 * The operations of `LANDED_UNROUTED` and the rest. A walk of this file that CALLS every operation
 * calls the routed ones: an unrouted path answers the router's 404, which is no answer of the
 * operation. The split is drift-guarded by the equalities on `LANDED_UNROUTED` in block 1.
 */
const UNROUTED_OPERATIONS: readonly CoreApiRegistryOperation[] = OPERATIONS.filter((operation) => LANDED_UNROUTED.includes(routeKey(operation.method, operation.path)));
const ROUTED_OPERATIONS: readonly CoreApiRegistryOperation[] = OPERATIONS.filter((operation) => !UNROUTED_OPERATIONS.includes(operation));

const COMMITTED_OPENAPI = fileURLToPath(new URL('../../../../packages/shared/openapi/openapi.json', import.meta.url));

// ── Time: the manual clock and the manual timer only ───────────────────────────────────────────

const SECOND = 1_000;
const TICK_MS = 50;
/** The engine resolves the eight checks within 4.9 s, finalises in at most 7.2 s and recovers in 3 s. */
const PRECHECK_MS = 5 * SECOND;
const FINALIZE_MS = 20 * SECOND;
const RECOVERY_MS = 4 * SECOND;

// ── The server ─────────────────────────────────────────────────────────────────────────────────

interface Server {
  readonly name: string;
  readonly app: FastifyInstance;
  readonly clock: ControllableClock;
  /** Advances the clock by `ms`, `stepMs` at a time, fires the timer after each step and lets the engine finish. */
  drive(ms: number, stepMs?: number): Promise<void>;
}

interface Target {
  readonly runtime: DatabaseConnection;
}

/**
 * THE MEDIA ROOT OF THIS FILE'S SERVERS IS THEIR OWN (integration pass E3 item 5; pass D11's
 * finding, decision D166). Area 4b copies a REAL sealed package into the media root of the `main`
 * server. With the default root - `<run dataDir>/media/sessions`, which every db file of a run
 * shares - the reset guard of ANOTHER file's server found that package as "a REAL package no row
 * names" and refused (`RESET_BLOCKED_REAL_EVIDENCE`; `modules/demo/__tests__/reset.db.test.ts`
 * failed when it ran beside this file). Each server of this file therefore gets a directory of its
 * own below one per-file folder of the data directory; the folder is removed at the end.
 */
// Read at use: the run exists once the file's database hook has run.
const mediaScratch = (): string => join(db.run.dataDir, `test-contract-media-${process.pid}`);
const ownMediaRoot = (server: string): string => join(mediaScratch(), server.replace(/[^A-Za-z0-9]+/g, '-'), 'sessions');

/** A process start: the real app factory on the database, as `dems_app`, booted as the entry point boots it. */
async function startServer(name: string, target: Target, options: { demoControls: boolean; at?: number }): Promise<Server> {
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, mediaStoreDir: ownMediaRoot(name), logLevel: 'info', port: 4420, demoControls: options.demoControls }),
    logStream: captureLog().stream,
  });
  await app.ready();
  const clock = createManualClock(options.at ?? FIXED_NOW);
  app.seams.replace('clock', clock);
  // Operation 92 tests the STT connection through a PROVIDED probe (the transcriber runtime's, row
  // 115); without one a permitted caller gets the envelope's 503 `TRANSCRIBER_NOT_READY`. This
  // file asks what a permitted call is answered with, so it hands in a probe that contacts
  // nothing and says "unreachable" - a documented 200. The 503 is held by the module's own test.
  sttConfigControl(app).provideProbe(async () => ({ reachable: false, modelAvailable: false, detailCode: 'UNREACHABLE' }));
  const timer = manualTimer();
  const engine = engineControl(app);
  // Gate rule M9: the manual timer is in place before the boot.
  engine.useTimer(timer.timer);
  await app.readiness.boot();
  await engine.idle();
  await app.pipeline.drain();
  return {
    name,
    app,
    clock,
    async drive(ms, stepMs = TICK_MS) {
      for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
        clock.advance(stepMs);
        timer.fire();
        await engine.idle();
      }
    },
  };
}

/** Starts every throttle window, denial budget and lockout afresh (the server's own test controls). */
function fresh(server: Server): void {
  throttleControl(server.app).reset();
  identityControl(server.app).lockout.reset();
  pairingControl(server.app).lock.reset();
}

// ── Callers ────────────────────────────────────────────────────────────────────────────────────

interface Caller {
  /** For the printed lines: a role and where it is signed in. Never a credential. */
  readonly label: string;
  readonly kind: CallerKind;
  /** Sent with every request of the caller. */
  readonly headers: Headers;
  /** True for a web console: a POST carries the web console `Origin`, a GET none (a same-origin read). */
  readonly webOrigin: boolean;
}

/** What the mobile app sends (decision D69): no `Origin`, no cookie. */
const DEVICE_HEADERS: Headers = { host: '127.0.0.1:4420', 'user-agent': 'okhttp/4.12.0' };
const NOBODY: Caller = { label: 'nobody', kind: 'public', headers: {}, webOrigin: false };
/** A device that holds no credential yet: the caller of the pairing redeem. */
const UNPAIRED_DEVICE: Caller = { label: 'a device without a credential', kind: 'public', headers: DEVICE_HEADERS, webOrigin: false };
/** A web console on which nobody is signed in: the caller of the web sign-in. */
const CONSOLE: Caller = { label: 'a web console, signed out', kind: 'web', headers: { origin: WEB_ORIGIN }, webOrigin: true };
const bearerCaller = (label: string, value: string): Caller => ({ label, kind: 'device', headers: { ...DEVICE_HEADERS, authorization: `Bearer ${value}` }, webOrigin: false });

const ROLES = ['SUPERVISOR', 'INVESTIGATOR', 'TECHNICIAN'] as const satisfies readonly OperatorRole[];
const usernameOf = (role: OperatorRole): string => {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded operator with role ${role}`);
  return operator.username;
};
const operatorIdOf = (role: OperatorRole): string => OPERATORS.find((candidate) => candidate.role === role)?.id ?? '';
/** True when the shared role table grants the role one of the permissions. */
const holdsOneOf = (role: OperatorRole, permissions: readonly string[]): boolean => permissions.some((permission) => (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission));

// ── Requests: every one goes through the ledger ────────────────────────────────────────────────

const ledger = new Ledger(OPERATIONS);
/** What a call was expected to answer and did not: `settle()` asserts it empty at the end of each test. */
const misses: string[] = [];

interface Options {
  /** The `{id}` of the path. Default: the registry's example ID of the operation. */
  readonly id?: string;
  /** The query string, with its `?`. */
  readonly query?: string;
  readonly payload?: Record<string, unknown>;
  /** A body sent as it is, with `content-type: application/json`. */
  readonly raw?: string;
  readonly headers?: Headers;
  readonly knownGap?: string;
}

async function request(server: Server, operationId: string | null, method: string, url: string, caller: Caller, note: string, options: Options = {}): Promise<Answer> {
  const headers: Headers = {
    ...caller.headers,
    ...(caller.webOrigin && method === 'POST' ? { origin: WEB_ORIGIN } : {}),
    ...(options.raw === undefined ? {} : { 'content-type': 'application/json' }),
    ...options.headers,
  };
  const response = await server.app.inject({
    method: method as 'GET',
    url,
    headers,
    ...(options.raw !== undefined ? { payload: options.raw } : options.payload !== undefined ? { payload: options.payload } : {}),
  });
  let epoch = -1;
  let revision = -1;
  try {
    ({ epoch, revision } = server.app.engine);
  } catch {
    // The engine is stopped (a reset is running): no 2xx POST is judged against it then.
  }
  return ledger.record(
    { operationId, method, url, caller: caller.label, callerKind: caller.kind, note, ...(options.knownGap === undefined ? {} : { knownGap: options.knownGap }) },
    response,
    { epoch, revision, cookieName: server.app.config.sessionCookieName },
  );
}

const exampleId = (operation: CoreApiRegistryOperation): string => CORE_API_EXAMPLES[operation.operationId]?.pathParams?.['id'] ?? '';
const urlOf = (operation: CoreApiRegistryOperation, options: Options = {}): string => `${operation.path.replace('{id}', options.id ?? exampleId(operation))}${options.query ?? ''}`;

/** One call of a registry operation, by its method and path. */
function call(server: Server, operationId: string, caller: Caller, note: string, options: Options = {}): Promise<Answer> {
  const operation = operationOf(operationId);
  return request(server, operationId, methodOf(operation), urlOf(operation, options), caller, note, options);
}

/** A call and what the SPECIFICATION says it is answered with. A miss is collected; the answer is returned. */
async function expectCall(server: Server, operationId: string, caller: Caller, note: string, options: Options, status: number, code: string | null = null): Promise<Answer> {
  const answer = await call(server, operationId, caller, note, options);
  if (answer.status !== status || answer.code !== code) misses.push(`${describeAnswer(answer)}; the specification says ${status}${code === null ? '' : ` ${code}`}`);
  return answer;
}

/** The end of a test: nothing it expected was missed. */
function settle(): void {
  expect(misses.splice(0)).toEqual([]);
}

const bodyOf = <Body>(answer: Answer): Body => answer.body as Body;
const detailsOf = (answer: Answer): Record<string, unknown> => bodyOf<{ error?: { details?: Record<string, unknown> } }>(answer).error?.details ?? {};

// ── Signing in and pairing, through the routes ─────────────────────────────────────────────────

async function signInWeb(server: Server, role: OperatorRole): Promise<Caller> {
  const answer = await call(server, 'signIn', CONSOLE, `the ${role} signs in on the web console`, { payload: { username: usernameOf(role), password: DEMO_OPERATOR_PASSWORD } });
  const name = server.app.config.sessionCookieName;
  const token = answer.status === 200 ? cookieValue(answer.response, name) : null;
  if (token === null) throw new Error(`the web sign-in of the ${role} answered ${answer.status}`);
  // SR: the web answer carries no token in its body.
  expect(bodyOf<{ sessionToken?: unknown }>(answer).sessionToken).toBeUndefined();
  return { label: `${role} (web)`, kind: 'web', headers: { cookie: `${name}=${token}` }, webOrigin: true };
}

interface Tablet {
  readonly deviceId: string;
  /** The device's own credential as a bearer value. */
  credential: Caller;
}

async function pairTablet(server: Server, supervisor: Caller, name: string): Promise<Tablet> {
  const issued = await call(server, 'issuePairingCode', supervisor, 'a pairing code for a tablet');
  if (issued.status !== 201) throw new Error(`issuePairingCode answered ${issued.status}`);
  const redeemed = await call(server, 'redeemPairingCode', UNPAIRED_DEVICE, 'the tablet redeems its code', {
    payload: { code: bodyOf<{ code: string }>(issued).code, deviceName: name, platform: 'android', appVersion: '0.2.0' },
  });
  if (redeemed.status !== 201) throw new Error(`redeemPairingCode answered ${redeemed.status}`);
  const body = bodyOf<{ deviceId: string; deviceCredential: string }>(redeemed);
  return { deviceId: body.deviceId, credential: bearerCaller(`${name} (device credential)`, body.deviceCredential) };
}

/** An operator's sign-in on a paired tablet: the caller that sends the session as a bearer value. */
async function signInOnTablet(server: Server, tablet: Tablet, role: OperatorRole, name: string): Promise<Caller> {
  const answer = await call(server, 'signIn', tablet.credential, `the ${role} signs in on ${name}`, { payload: { username: usernameOf(role), password: DEMO_OPERATOR_PASSWORD } });
  const token = answer.status === 200 ? bodyOf<{ sessionToken?: string }>(answer).sessionToken : undefined;
  if (token === undefined) throw new Error(`the device sign-in of the ${role} answered ${answer.status}`);
  return bearerCaller(`${role} (session on ${name})`, token);
}

// ── The main server and its callers ────────────────────────────────────────────────────────────

let main: Server;
const web = {} as Record<OperatorRole, Caller>;
/** The paired tablet of the journey, and the INVESTIGATOR's session on it. */
let tablet: Tablet;
let tabletSession: Caller;
/** A tablet that was paired, used, and then revoked by the SUPERVISOR. */
let retired: Tablet;
let retiredSession: Caller;
/** The session and the sealed evidence of the journey. */
let sealedEvidenceId = '';
/** The job of the export area 5 makes (operation 87), for the walk of the reads. */
let exportJobId = '';
/** Integration pass D4: the REAL item with a sealed machine transcript (operations 84 to 86). */
let transcriptItem: RealTranscriptItem | null = null;
let unsealedEvidenceId = '';

const owner = (): Pool => db.ownerPool();

/** Who the access rule of an operation lets through, among the callers of this file. */
function allowedCaller(operation: CoreApiRegistryOperation): Caller {
  const { access } = operation;
  const conditions: readonly string[] = access.conditions ?? [];
  if (access.kind === CoreApiAccessKind.PUBLIC) {
    // The two entry points of a console (ID-1) come from a web console; the redeem from a device.
    if (operation.operationId === 'redeemPairingCode') return UNPAIRED_DEVICE;
    return operation.operationId === 'getServiceHealth' ? NOBODY : CONSOLE;
  }
  if (access.kind === CoreApiAccessKind.DEVICE) return tablet.credential;
  if (conditions.includes(CoreApiAccessCondition.DEVICE_SESSION)) return tabletSession;
  if (access.kind === CoreApiAccessKind.AUTHENTICATED) return web.SUPERVISOR;
  const permissions = coreApiAccessPermissions(access);
  const role = ROLES.find((candidate) => holdsOneOf(candidate, permissions));
  if (role === undefined) throw new Error(`no seeded role may call ${operation.operationId}`);
  return web[role];
}

/** A body the request schema of the operation accepts: the registry's own first example. */
function exampleBody(operation: CoreApiRegistryOperation): Record<string, unknown> {
  const first = Object.values(CORE_API_EXAMPLES[operation.operationId]?.request ?? {})[0];
  return { ...(first?.value as Record<string, unknown> | undefined) };
}

beforeAll(async () => {
  main = await startServer('main', db.database, { demoControls: true });
});

afterAll(async () => {
  transcriptItem?.remove();
  await main?.app.close();
  rmSync(mediaScratch(), { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 1. The routes and the operations (AC-B-09; decision D83 DN-11)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-09: every registered route is an operation, every operation is registered', () => {
  it('the registry holds exactly 99 operations, 36 GET and 63 POST, each with one access rule and one audit rule', () => {
    // 75 in the closed task-2 contract; C3 grew the registry to 89 with schema v2 (ops 76 to 89:
    // the six capture-config and credential operations, the three audio-source and sealing ones,
    // the five transcript, media-session and export-job ones), and to 92 with the confirmed R-8
    // (C3 §2.5: the STT configuration operations 90 to 92; task 3 row 113), and to 97 with R-9..R-11
    // (C3 §2.6, §10.1: the camera search, the connection test, the adoption and the local-input
    // re-read, 93 to 97; task 3 row 132, decision D106). R1 (D44): acceptance reads the CURRENT
    // registry, the closed document never. Task 4 (blueprint row 63): the two sound-card operations
    // 98 and 99, both POST: 97 + 2 = 99, 36 GET / 63 POST.
    expect(CORE_API_OPERATION_TABLE).toHaveLength(99);
    expect(OPERATIONS).toHaveLength(99);
    expect(new Set(OPERATIONS.map((operation) => operation.operationId)).size).toBe(99);
    expect(new Set(REGISTRY_ROUTES).size).toBe(99);
    expect(OPERATIONS.filter((operation) => operation.method === 'get')).toHaveLength(36);
    expect(OPERATIONS.filter((operation) => operation.method === 'post')).toHaveLength(63);
    expect(UNROUTED_OPERATIONS.map((operation) => operation.operationId)).toEqual(['searchCaptureAudioCards', 'registerCaptureAudioInput']);
    for (const operation of OPERATIONS) {
      expect(describeCoreApiAccess(operation.access), operation.operationId).not.toBe('');
      expect(operation.audit.success, operation.operationId).toBeDefined();
      expect(['ACCESS_DENIED', 'EXPORT_DENIED'], operation.operationId).toContain(operation.audit.denial);
    }
  });

  it('the router of the booted server and the guard register exactly the registry\'s routes; `GET /ws` is the one exception', () => {
    // The router's own table: every route of the router, whenever and by whomever it was added.
    const router = routesOfPrintedTable(main.app.printRoutes()).map((route) => routeKey(route.method, templateOf(route.url)));
    // The guard's table (decision D83 DN-11): the rule of every route registered once it was loaded.
    const rules = permissionGuard(main.app).registeredRules();
    const guarded = rules.map((rule) => routeKey(rule.method, templateOf(rule.url)));

    const byRouter = compareRoutes(router, REGISTRY_ROUTES, EXTERNAL_ROUTES);
    const byGuard = compareRoutes(guarded, REGISTRY_ROUTES, EXTERNAL_ROUTES);
    console.info(`[w52] routes of the router: ${router.length}; rules of the guard: ${guarded.length}; operations of the registry: ${REGISTRY_ROUTES.length}`);
    console.info(`[w52] undocumented routes (router against registry): ${JSON.stringify(byRouter.undocumented)}`);
    console.info(`[w52] undocumented routes (guard against registry): ${JSON.stringify(byGuard.undocumented)}`);
    console.info(`[w52] unregistered operations (registry against router): ${JSON.stringify(byRouter.unregistered)}`);
    console.info(`[w52] unregistered operations (registry against guard): ${JSON.stringify(byGuard.unregistered)}`);
    console.info(`[w52] the one route outside the registry: ${router.filter((route) => !REGISTRY_ROUTES.includes(route)).join(', ')}`);
    // Task 4 row 63: the two sound-card operations have no route until row 70 (LANDED_UNROUTED).
    expect(byRouter).toEqual({ undocumented: [], unregistered: LANDED_UNROUTED });
    expect(byGuard).toEqual({ undocumented: [], unregistered: LANDED_UNROUTED });
    // The 97 operations of the registry and the channel, each once; the exception is there and is
    // the only one. (The pin read 79 - the base, operations 90 to 92 and the channel - and was never
    // moved while the registry grew; it is reached only once nothing is unrouted, and then it is 98.)
    // Row 90 (ruling D140): and the evidence media route - two routes outside the registry, 99 in all.
    // Task 4 row 63: the registry holds 99; its two unrouted operations are not in the router, so 100 stays.
    expect(router).toHaveLength(REGISTRY_ROUTES.length - LANDED_UNROUTED.length + EXTERNAL_ROUTES.length);
    // Fix pass F-M8 (ruling D178): and the export download route - three routes outside the registry, 100 in all.
    expect(router).toHaveLength(100);
    expect(new Set(router).size).toBe(100);
    expect(router.filter((route) => !REGISTRY_ROUTES.includes(route)).sort()).toEqual([...EXTERNAL_ROUTES].sort());
    expect([...guarded].sort()).toEqual([...router].sort());
    expect(permissionGuard(main.app).routeProblems()).toEqual([]);

    // Each rule carries the operation ID of the registry entry with its method and path.
    for (const rule of rules) {
      if (routeKey(rule.method, templateOf(rule.url)) === CHANNEL_ROUTE) continue;
      if (routeKey(rule.method, templateOf(rule.url)) === MEDIA_ROUTE) {
        // Ruling D140: the rule of operation 88, under the route's own name.
        expect(rule.marker).toBe(describeCoreApiAccess(operationOf('createEvidenceMediaSession').access));
        continue;
      }
      if (routeKey(rule.method, templateOf(rule.url)) === EXPORT_DOWNLOAD_ROUTE) {
        // Ruling D178: the rule of operation 87, under the route's own name.
        expect(rule.marker).toBe(describeCoreApiAccess(operationOf('getEvidenceExportJob').access));
        continue;
      }
      const operation = operationOf(rule.operationId);
      expect(routeKey(rule.method, templateOf(rule.url)), rule.operationId).toBe(routeKey(operation.method, operation.path));
      expect(rule.marker, rule.operationId).toBe(describeCoreApiAccess(operation.access));
    }
    // And by Fastify's own question, without the printed table: every operation has its route.
    const missing = OPERATIONS.filter((operation) => !main.app.hasRoute({ method: methodOf(operation), url: operation.path.replace('{id}', ':id') })).map((operation) => operation.operationId);
    expect(missing).toEqual(UNROUTED_OPERATIONS.map((operation) => operation.operationId));
  });

  it('the committed openapi.json lists the same 99 operations with two security schemes, and equals what the generator produces now', () => {
    const text = readFileSync(COMMITTED_OPENAPI, 'utf8');
    const committed = JSON.parse(text) as OpenApiDocument;
    const documented = listOpenApiOperations(committed).map((entry) => routeKey(entry.method, entry.path));
    const router = routesOfPrintedTable(main.app.printRoutes()).map((route) => routeKey(route.method, templateOf(route.url)));
    const comparison = compareRoutes(router, documented, EXTERNAL_ROUTES);
    console.info(`[w52] undocumented routes (router against the committed openapi.json): ${JSON.stringify(comparison.undocumented)}`);
    console.info(`[w52] unregistered operations (committed openapi.json against router): ${JSON.stringify(comparison.unregistered)}`);
    // Row-55 F3: the document is no longer frozen at 75 - row 50 regenerated it to the 89 of the
    // registry at version 0.3.0, and the pins move with it (the sibling walk at :408 re-pinned the
    // same numbers in RECON-B2b). What still departs is the ROUTER: the 14 operations whose handlers
    // land with later milestone rows (R4, ruling D44). The walk names that deferral exactly, as the
    // detector of this file already does - undocumented stays empty (a route without a document is
    // refused outright), and unregistered must be precisely the fourteen, so one more or one less
    // unrouted operation fails here. The calls themselves stay red as their own deferrals.
    expect(comparison).toEqual({ undocumented: [], unregistered: LANDED_UNROUTED });
    expect(documented).toHaveLength(99);
    expect([...documented].sort()).toEqual([...REGISTRY_ROUTES].sort());
    // The same operation ID on the same method and path.
    for (const entry of listOpenApiOperations(committed)) {
      const operation = operationOf(entry.operation.operationId);
      expect(routeKey(entry.method, entry.path), entry.operation.operationId).toBe(routeKey(operation.method, operation.path));
      // Every status the registry documents is in the document, and no other.
      expect(Object.keys(entry.operation.responses).map(Number).sort((a, b) => a - b), entry.operation.operationId).toEqual(listCoreApiResponseStatuses(operation, 'all'));
    }
    expect(Object.keys(committed.components.securitySchemes ?? {}).sort()).toEqual(['bearerAuth', 'sessionCookie']);
    // 0.3.0 since the schema-v2 regeneration of row 50 (`gen-openapi` from the 89-operation
    // registry; row-55 F3 moved this pin off the 0.2.1 of the contract close-out W83/D184 DQ-8);
    // changed by design, and byte-stable: the generator check below proves the file is what it makes.
    expect(committed.info.version).toBe('0.3.0');
    // What `gen-openapi --check` compares: the file, byte for byte, with the document of scope `all`.
    expect(text === serializeOpenApiDocument(createOpenApiDocument({ scope: 'all' }))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Every operation, through the real stages (AC-B-10)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-10: every operation answers what the contract documents', () => {
  it('the callers: the three seeded operators on the web console, a paired tablet with an operator, a tablet that is revoked', async () => {
    fresh(main);
    const health = await expectCall(main, 'getServiceHealth', NOBODY, 'health, without a credential', {}, 200);
    // AC-B-08: the Core server names itself and is ready.
    expect(health.body).toEqual({ ...bodyOf<Record<string, unknown>>(health), service: 'dems-core-server', version: '0.2.0', ready: { database: true, engine: true } });
    for (const role of ROLES) web[role] = await signInWeb(main, role);
    tablet = await pairTablet(main, web.SUPERVISOR, 'Interview tablet 01');
    tabletSession = await signInOnTablet(main, tablet, 'INVESTIGATOR', 'Interview tablet 01');
    retired = await pairTablet(main, web.SUPERVISOR, 'Interview tablet 02');
    retiredSession = await signInOnTablet(main, retired, 'TECHNICIAN', 'Interview tablet 02');
    const revoked = await expectCall(main, 'revokeDevice', web.SUPERVISOR, 'the SUPERVISOR revokes the second tablet', { id: retired.deviceId, payload: { reason: 'Tablet reported lost by the investigator' } }, 200);
    expect(bodyOf<{ state?: string }>(revoked).state).toBe('REVOKED');
    settle();
  });

  it('area 1, identity (operations 2 to 9): sign-in, status, session, touch, sign-out, the biometric token', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    await expectCall(main, 'getSignInStatus', CONSOLE, 'the lock state of this console', {}, 200);
    const session = await expectCall(main, 'getAuthSession', supervisor, 'the caller\'s own session', {}, 200);
    expect(bodyOf<{ operator: { role: string }; demoControls: boolean }>(session)).toMatchObject({ operator: { role: 'SUPERVISOR' }, demoControls: true });
    await expectCall(main, 'getAuthSession', tabletSession, 'the same read from a tablet session', {}, 200);
    await expectCall(main, 'touchSession', supervisor, 'activity', {}, 200);

    // §7.2: a failed sign-in is the generic 401; no console identity is 403 DEVICE_NOT_PAIRED; a body outside the schema 422.
    await expectCall(main, 'signIn', CONSOLE, 'a wrong password', { payload: { username: usernameOf('SUPERVISOR'), password: 'not-the-password' } }, 401, 'INVALID_CREDENTIALS');
    await expectCall(main, 'signIn', NOBODY, 'no console identity: no web console Origin and no device credential', { payload: { username: usernameOf('SUPERVISOR'), password: DEMO_OPERATOR_PASSWORD } }, 403, 'DEVICE_NOT_PAIRED');
    await expectCall(main, 'signIn', CONSOLE, 'a body without the password', { payload: { username: usernameOf('SUPERVISOR') } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'signIn', retired.credential, 'the credential of a revoked device', { payload: { username: usernameOf('SUPERVISOR'), password: DEMO_OPERATOR_PASSWORD } }, 403, 'DEVICE_REVOKED');
    await expectCall(main, 'signIn', NOBODY, 'an Origin that is on no list', { payload: { username: usernameOf('SUPERVISOR'), password: DEMO_OPERATOR_PASSWORD }, headers: { origin: FOREIGN_ORIGIN } }, 403, 'ORIGIN_NOT_ALLOWED');
    fresh(main);

    // Sign-out: 204 without a body; a web sign-out clears the cookie, a device sign-out sets none (the ledger checks both).
    const spare = await signInWeb(main, 'TECHNICIAN');
    await expectCall(main, 'signOut', supervisor, 'a reason outside the value set', { payload: { reason: 'NOPE' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'signOut', spare, 'a web sign-out (Lock console)', { payload: { reason: 'LOCK' } }, 204);
    await expectCall(main, 'getAuthSession', spare, 'the session that was signed out', {}, 401, 'NOT_SIGNED_IN');
    const spareOnTablet = await signInOnTablet(main, tablet, 'SUPERVISOR', 'Interview tablet 01');
    await expectCall(main, 'signOut', spareOnTablet, 'a sign-out on the tablet', {}, 204);

    // The biometric token (operations 7 to 9), on the paired tablet.
    const enrolled = await expectCall(main, 'setBiometricEnrollment', tabletSession, 'biometric sign-in turned on, in a password session on the tablet', { payload: { enabled: true } }, 200);
    const token = bodyOf<{ enabled: boolean; token?: string }>(enrolled).token;
    expect(typeof token).toBe('string');
    await expectCall(main, 'setBiometricEnrollment', supervisor, 'a web session: the operation needs a session on a device', { payload: { enabled: true } }, 403, 'DEVICE_NOT_PAIRED');
    await expectCall(main, 'setBiometricEnrollment', tabletSession, 'a body outside the schema', { payload: { enabled: 'yes' } }, 422, 'INVALID_INPUT');
    const biometric = await expectCall(main, 'signInWithBiometric', tablet.credential, 'the token signs the operator in', { payload: { token: token ?? '' } }, 200);
    const signedIn = bodyOf<{ session: { method: string }; sessionToken?: string; biometricToken?: string }>(biometric);
    expect(signedIn.session.method).toBe('BIOMETRIC');
    expect(typeof signedIn.biometricToken).toBe('string');
    await expectCall(main, 'signInWithBiometric', tablet.credential, 'a token nobody was issued', { payload: { token: `bio_${'A'.repeat(43)}` } }, 401, 'INVALID_CREDENTIALS');
    await expectCall(main, 'signInWithBiometric', tablet.credential, 'a body without the token', { payload: {} }, 422, 'INVALID_INPUT');
    await expectCall(main, 'reportBiometricFailure', tablet.credential, 'a failed biometric prompt of a known operator', { payload: { operatorId: operatorIdOf('INVESTIGATOR') } }, 200);
    await expectCall(main, 'reportBiometricFailure', tablet.credential, 'a body outside the schema', { payload: { operatorId: 5 } }, 422, 'INVALID_INPUT');

    // Gap W41-2, closed by W83: turning it on in a session that no password opened is the same code with a reason, which the 403 text now names.
    const viaBiometric = bearerCaller('INVESTIGATOR (biometric session on Interview tablet 01)', signedIn.sessionToken ?? '');
    const refused = await expectCall(main, 'setBiometricEnrollment', viaBiometric, 'turned on in a session that a token opened', { payload: { enabled: true } }, 403, 'DEVICE_NOT_PAIRED');
    expect(detailsOf(refused)['reason']).toBe('PASSWORD_SESSION_REQUIRED');
    await expectCall(main, 'setBiometricEnrollment', tabletSession, 'biometric sign-in turned off', { payload: { enabled: false } }, 200);
    fresh(main);
    settle();
  });

  it('areas 2 and 3, the role matrix and administration (operations 10 to 14)', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const technicianId = operatorIdOf('TECHNICIAN');
    const supervisorId = operatorIdOf('SUPERVISOR');
    const matrix = await expectCall(main, 'getRoleMatrix', web.INVESTIGATOR, 'the matrix, read by any operator', {}, 200);
    // Gap 6, closed by W83 (the contract now says the grants are a set): the grants are the shared table's, as sets.
    const { grants } = bodyOf<{ grants: Array<{ role: OperatorRole; permission: string }> }>(matrix);
    for (const role of ROLES) expect(grants.filter((grant) => grant.role === role).map((grant) => grant.permission).sort(), role).toEqual([...ROLE_PERMISSIONS[role]].sort());
    await expectCall(main, 'listUsers', supervisor, 'the operators', {}, 200);

    await expectCall(main, 'assignUserRole', supervisor, 'the TECHNICIAN becomes an INVESTIGATOR', { id: technicianId, payload: { role: 'INVESTIGATOR', reason: 'Covers the interview shift this week' } }, 200);
    await expectCall(main, 'assignUserRole', supervisor, 'and a TECHNICIAN again', { id: technicianId, payload: { role: 'TECHNICIAN' } }, 200);
    await expectCall(main, 'assignUserRole', supervisor, 'an operator the Core does not have', { id: 'OPR-999', payload: { role: 'INVESTIGATOR' } }, 404, 'NOT_FOUND');
    await expectCall(main, 'assignUserRole', supervisor, 'the last holder of USER_ADMIN gives the role away (RB-8)', { id: supervisorId, payload: { role: 'INVESTIGATOR' } }, 409, 'LAST_ADMIN');
    await expectCall(main, 'assignUserRole', supervisor, 'a role outside the value set', { id: technicianId, payload: { role: 'NOPE' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'assignUserRole', supervisor, 'a malformed {id}', { id: 'OPR-3', payload: { role: 'INVESTIGATOR' } }, 422, 'INVALID_INPUT');

    await expectCall(main, 'disableUser', supervisor, 'the TECHNICIAN is disabled', { id: technicianId, payload: { reason: 'On leave until further notice' } }, 200);
    await expectCall(main, 'enableUser', supervisor, 'and enabled again', { id: technicianId, payload: { reason: 'Back from leave' } }, 200);
    await expectCall(main, 'disableUser', supervisor, 'an operator the Core does not have', { id: 'OPR-999' }, 404, 'NOT_FOUND');
    await expectCall(main, 'enableUser', supervisor, 'an operator the Core does not have', { id: 'OPR-999' }, 404, 'NOT_FOUND');
    await expectCall(main, 'disableUser', supervisor, 'the last holder of USER_ADMIN is disabled (RB-8)', { id: supervisorId }, 409, 'LAST_ADMIN');
    await expectCall(main, 'disableUser', supervisor, 'a malformed {id}', { id: 'x' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'enableUser', supervisor, 'a reason longer than 500 characters', { id: technicianId, payload: { reason: 'r'.repeat(501) } }, 422, 'INVALID_INPUT');
    // Disabling ended the TECHNICIAN's sessions: the operator signs in again.
    web.TECHNICIAN = await signInWeb(main, 'TECHNICIAN');
    settle();
  });

  it('area 3, pairing (operations 15 to 23): the code, the redeem, the registry, the device\'s own operations', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const issued = await expectCall(main, 'issuePairingCode', supervisor, 'a code', {}, 201);
    await expectCall(main, 'getPairingCodeStatus', supervisor, 'the active code, without its digits', {}, 200);
    await expectCall(main, 'listPairedDevices', supervisor, 'the registry', {}, 200);
    const code = bodyOf<{ code: string }>(issued).code;
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    await expectCall(main, 'redeemPairingCode', UNPAIRED_DEVICE, 'six digits that are not the code', { payload: { code: wrong, deviceName: 'Tablet', platform: 'android', appVersion: '0.2.0' } }, 401, 'INVALID_CODE');
    await expectCall(main, 'redeemPairingCode', UNPAIRED_DEVICE, 'a code of two digits', { payload: { code: '12', deviceName: 'Tablet', platform: 'android', appVersion: '0.2.0' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'redeemPairingCode', UNPAIRED_DEVICE, 'an Origin that is on no list', { payload: { code, deviceName: 'Tablet', platform: 'android', appVersion: '0.2.0' }, headers: { origin: FOREIGN_ORIGIN } }, 403, 'ORIGIN_NOT_ALLOWED');
    // Gap W32-2, closed by W83 (the description says it): a device name of the form of a credential is refused by the server.
    await expectCall(main, 'redeemPairingCode', UNPAIRED_DEVICE, 'a device name of the form of a credential', { payload: { code, deviceName: `dvc_${'A'.repeat(43)}`, platform: 'android', appVersion: '0.2.0' } }, 422, 'INVALID_INPUT');
    fresh(main);
    await expectCall(main, 'cancelPairingCode', supervisor, 'the code is cancelled', {}, 204);

    await expectCall(main, 'getDeviceRegistration', tablet.credential, 'the tablet reads its own registration', {}, 200);
    const rotated = await expectCall(main, 'rotateDeviceCredential', tablet.credential, 'the tablet rotates its credential', {}, 200);
    tablet.credential = bearerCaller('Interview tablet 01 (device credential)', bodyOf<{ deviceCredential: string }>(rotated).deviceCredential);
    await expectCall(main, 'getDeviceRegistration', tablet.credential, 'with the rotated credential', {}, 200);
    const third = await pairTablet(main, supervisor, 'Interview tablet 03');
    await expectCall(main, 'unpairDevice', third.credential, 'a tablet unpairs itself', {}, 204);

    await expectCall(main, 'revokeDevice', supervisor, 'a device the Core does not have', { id: 'DEV-9999', payload: { reason: 'Tablet reported lost' } }, 404, 'NOT_FOUND');
    await expectCall(main, 'revokeDevice', supervisor, 'a device that is revoked already', { id: retired.deviceId, payload: { reason: 'Tablet reported lost' } }, 409, 'INVALID_STATE');
    await expectCall(main, 'revokeDevice', supervisor, 'a malformed {id}', { id: 'x', payload: { reason: 'Tablet reported lost' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'revokeDevice', supervisor, 'a reason of three characters', { id: tablet.deviceId, payload: { reason: 'abc' } }, 422, 'INVALID_REASON');
    settle();
  });

  it('area 6, devices (operations 44 to 52): the reads and the commands', async () => {
    fresh(main);
    const technician = web.TECHNICIAN;
    const supervisor = web.SUPERVISOR;
    for (const operationId of ['getDeviceHealth', 'getAudioStatus', 'getVideoStatus', 'getDeviceInventory']) await expectCall(main, operationId, supervisor, 'a read', {}, 200);
    await expectCall(main, 'restartDevice', technician, 'a camera restarts', { id: 'CAM-01' }, 204);
    await expectCall(main, 'restartDevice', technician, 'a device the Core does not have', { id: 'CAM-99' }, 404, 'NOT_FOUND');
    await expectCall(main, 'restartDevice', technician, 'a platform device cannot be restarted', { id: 'GNSS' }, 409, 'COMMAND_UNSUPPORTED');
    await expectCall(main, 'restartDevice', technician, 'a malformed {id}', { id: 'cam-01' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'testDeviceSignal', technician, 'a test tone on a microphone', { id: 'MIC-02' }, 204);
    await expectCall(main, 'testDeviceSignal', technician, 'a device the Core does not have', { id: 'MIC-09' }, 404, 'NOT_FOUND');
    await expectCall(main, 'testDeviceSignal', technician, 'a platform device takes no test signal', { id: 'TPM' }, 409, 'COMMAND_UNSUPPORTED');
    await expectCall(main, 'testDeviceSignal', technician, 'a malformed {id}', { id: 'mic-02' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'identifyDevice', technician, 'a platform device is identified', { id: 'GNSS' }, 204);
    await expectCall(main, 'identifyDevice', technician, 'a device the Core does not have', { id: 'NOPE' }, 404, 'NOT_FOUND');
    await expectCall(main, 'identifyDevice', technician, 'a malformed {id}', { id: 'gnss' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'setActiveCamera', supervisor, 'the second camera', { payload: { cameraId: 'VIDEO-02' } }, 204);
    await expectCall(main, 'setActiveCamera', supervisor, 'a camera outside the value set', { payload: { cameraId: 'VIDEO-09' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'resetMicClip', supervisor, 'the clip latch of a channel', { payload: { channel: 'AUDIO-02' } }, 204);
    await expectCall(main, 'resetMicClip', supervisor, 'a channel outside the value set', { payload: { channel: 'AUDIO-09' } }, 422, 'INVALID_INPUT');
    // A restart and a test tone take a few seconds of the engine's time.
    await main.drive(20 * SECOND);
    settle();
  });

  it('areas 7 to 11: storage, network, time, security and audit, system, alerts (operations 53 to 70)', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const technician = web.TECHNICIAN;
    for (const operationId of ['getStorageStatus', 'getStorageDetail', 'getNetworkStatus', 'getTimeStatus', 'getSecurityStatus', 'verifyAuditChain', 'getSystemStatus', 'listAlerts']) {
      await expectCall(main, operationId, supervisor, 'a read', {}, 200);
    }
    await expectCall(main, 'setStoragePolicy', supervisor, 'a holder of EVIDENCE_REVIEW changes the policy', { payload: { retentionPolicy: 'YEAR_1' } }, 200);
    await expectCall(main, 'setStoragePolicy', technician, 'a holder of MAINTENANCE changes it too', { payload: { autoArchive: false } }, 200);
    await expectCall(main, 'setStoragePolicy', supervisor, 'a value outside the set', { payload: { retentionPolicy: 'NOPE' } }, 422, 'INVALID_INPUT');
    // Gap 5, closed by W83 (the example uses the same spelling): the denial of the any-of names both permissions, joined with `_OR_`.
    const anyOf = await expectCall(main, 'setStoragePolicy', web.INVESTIGATOR, 'a holder of neither permission', { payload: { autoArchive: true } }, 403, 'NOT_PERMITTED');
    expect(detailsOf(anyOf)['permission']).toBe('EVIDENCE_REVIEW_OR_MAINTENANCE');

    await expectCall(main, 'listAuditRows', supervisor, 'the newest rows first', { query: '?order=DESC&limit=50' }, 200);
    await expectCall(main, 'listAuditRows', supervisor, 'a limit outside 1 to 200', { query: '?limit=0' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'listEvents', supervisor, 'the events', { query: '?limit=50' }, 200);
    await expectCall(main, 'listEvents', supervisor, 'a limit outside 1 to 200', { query: '?limit=201' }, 422, 'INVALID_INPUT');
    for (const operationId of ['exportAudit', 'exportLogs']) {
      await expectCall(main, operationId, supervisor, 'an export with its reason', { payload: { reason: 'Quarterly audit review by the supervisor', destination: 'Audit archive (simulated)' } }, 202);
      await expectCall(main, operationId, supervisor, 'a reason of three characters', { payload: { reason: 'abc' } }, 422, 'INVALID_REASON');
      await expectCall(main, operationId, supervisor, 'a reason that is no text', { payload: { reason: 5 } }, 422, 'INVALID_INPUT');
    }

    await expectCall(main, 'runDiagnostics', technician, 'a diagnostics run', {}, 202);
    await main.drive(10 * SECOND);
    await expectCall(main, 'restartServices', technician, 'the services restart while no session is open', {}, 200);
    await expectCall(main, 'updateSettings', supervisor, 'presentation mode on', { payload: { presentationMode: true } }, 200);
    await expectCall(main, 'updateSettings', supervisor, 'a value outside the set', { payload: { timeFormat: '13' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'acknowledgeAlert', supervisor, 'an alert is acknowledged', { id: 'ALR-000001' }, 204);
    await expectCall(main, 'acknowledgeAlert', supervisor, 'a malformed {id}', { id: 'x' }, 422, 'INVALID_INPUT');
    settle();
  });

  it('the STT configuration (operations 90 to 92; C3 §2.5, task 3 row 113): the read, the change, its refusals, the test', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const technician = web.TECHNICIAN;
    // Every role reads it; the answer says whether a credential is set and never holds one.
    const read = await expectCall(main, 'getSttConfig', web.INVESTIGATOR, 'every role reads the STT configuration', {}, 200);
    const { revision } = bodyOf<{ revision: number }>(read);
    expect(Object.keys(bodyOf<Record<string, unknown>>(read)).filter((key) => /credential/i.test(key) && key !== 'credentialSet' && key !== 'credentialKind')).toEqual([]);
    const changed = await expectCall(main, 'updateSttConfig', technician, 'a holder of CAPTURE_CONFIG turns speaker labelling off', { payload: { revision, diarization: false } }, 200);
    // No session is open in this file at this point: the change applies at once.
    expect(bodyOf<{ appliesFrom?: string; revision?: number }>(changed)).toMatchObject({ appliesFrom: 'NOW', revision: revision + 1 });
    const stale = await expectCall(main, 'updateSttConfig', supervisor, 'the revision of the body is the one before', { payload: { revision, enabled: false } }, 409, 'INVALID_STATE');
    expect(detailsOf(stale)['reason']).toBe('REVISION_CONFLICT');
    const lan = await expectCall(main, 'updateSttConfig', supervisor, 'an endpoint that is not on loopback', { payload: { revision: revision + 1, backend: 'omlx-server', endpoint: 'http://192.168.1.20:8000' } }, 422, 'INVALID_INPUT');
    expect(detailsOf(lan)['reason']).toBe('ENDPOINT_NOT_LOOPBACK');
    await expectCall(main, 'updateSttConfig', supervisor, 'a body without its revision', { payload: { enabled: false } }, 422, 'INVALID_INPUT');
    const denied = await expectCall(main, 'updateSttConfig', web.INVESTIGATOR, 'a role without CAPTURE_CONFIG', { payload: { revision: revision + 1, enabled: false } }, 403, 'NOT_PERMITTED');
    expect(detailsOf(denied)['permission']).toBe('CAPTURE_CONFIG');
    await expectCall(main, 'testSttConnection', technician, 'a test of the stored configuration (a stand-in probe: nothing is contacted)', {}, 200);
    await expectCall(main, 'testSttConnection', web.INVESTIGATOR, 'a role without CAPTURE_CONFIG', {}, 403, 'NOT_PERMITTED');
    await expectCall(main, 'getSttConfig', supervisor, 'the read after the change and the test', {}, 200);
    // Without a credential: 401 on all three (also produced by the generated walk of AC-B-14, which
    // stops at the first unrouted operation until the rows of DEFERRED routes land).
    await expectCall(main, 'getSttConfig', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'updateSttConfig', CONSOLE, 'the web console without a session', { payload: { revision: revision + 1, enabled: false } }, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'testSttConnection', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    settle();
  });

  it('the capture selector (operations 76 to 80; C3 §2.4, task 3 row 66): the reads, the edits of SUPERVISOR and TECHNICIAN, their refusals', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const technician = web.TECHNICIAN;
    interface Selector { cameras: { trackId: string; deviceId: string }[]; mics: { inputId: string; role: string }[]; locked: boolean }
    // Every role reads both slices; neither answer holds a credential member.
    for (const caller of [web.INVESTIGATOR, supervisor, technician]) {
      const config = await expectCall(main, 'getCaptureConfig', caller, 'every role reads the selector', {}, 200);
      expect(bodyOf<Selector>(config)).toMatchObject({ locked: false, cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }], mics: [{ inputId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', role: 'STANDBY' }] });
      const devices = await expectCall(main, 'getCaptureDevices', caller, 'every role reads the capture registry', {}, 200);
      expect(JSON.stringify([bodyOf(config), bodyOf(devices)])).not.toMatch(/secret|password|username|credential/i);
    }
    // 80: a holder of CAPTURE_CONFIG makes the second input PRIMARY; the two inputs stay the ordered pair (AC-B-70).
    const primary = await expectCall(main, 'setPrimaryMic', technician, 'a TECHNICIAN makes MIC-02 the primary input', { id: 'MIC-02' }, 200);
    expect(bodyOf<Selector>(primary).mics).toMatchObject([{ inputId: 'MIC-01', role: 'STANDBY' }, { inputId: 'MIC-02', role: 'PRIMARY' }]);
    await expectCall(main, 'setPrimaryMic', technician, 'an input the selector does not hold', { id: 'MIC-09' }, 404, 'NOT_FOUND');
    await expectCall(main, 'setPrimaryMic', technician, 'a malformed {id}', { id: 'mic-02' }, 422, 'INVALID_INPUT');
    // 78: the whole selector; here the two cameras change tracks in one edit.
    const swapped = await expectCall(main, 'updateCaptureConfig', supervisor, 'a SUPERVISOR swaps the two cameras', { payload: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] } }, 200);
    expect(bodyOf<Selector>(swapped).cameras).toMatchObject([{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }]);
    await expectCall(main, 'updateCaptureConfig', supervisor, 'a device the capture registry does not hold (a discovery candidate is never one)', { payload: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-77' }] } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'updateCaptureConfig', supervisor, 'a track outside the value set', { payload: { cameras: [{ trackId: 'VIDEO-09', deviceId: 'CAM-01' }] } }, 422, 'INVALID_INPUT');
    // 79: a camera device to a video track.
    await expectCall(main, 'setCaptureCameraSource', supervisor, 'one camera on both tracks with one profile', { id: 'CAM-01', payload: { trackId: 'VIDEO-01' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'setCaptureCameraSource', supervisor, 'a camera the capture registry does not hold', { id: 'CAM-99', payload: { trackId: 'VIDEO-01' } }, 404, 'NOT_FOUND');
    await expectCall(main, 'setCaptureCameraSource', supervisor, 'a track outside the value set', { id: 'CAM-01', payload: { trackId: 'VIDEO-09' } }, 422, 'INVALID_INPUT');
    // The INVESTIGATOR lacks CAPTURE_CONFIG on all three edits.
    for (const [operationId, options] of [
      ['setPrimaryMic', { id: 'MIC-01' }],
      ['setCaptureCameraSource', { id: 'CAM-01', payload: { trackId: 'VIDEO-02' } }],
      ['updateCaptureConfig', { payload: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] } }],
    ] as const) {
      const denied = await expectCall(main, operationId, web.INVESTIGATOR, 'a role without CAPTURE_CONFIG', options, 403, 'NOT_PERMITTED');
      expect(detailsOf(denied)['permission']).toBe('CAPTURE_CONFIG');
      await expectCall(main, operationId, CONSOLE, 'the web console without a session', options, 401, 'NOT_SIGNED_IN');
    }
    await expectCall(main, 'getCaptureConfig', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'getCaptureDevices', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    // Back to the seeded selector: the walks after this one read the state the seed gave. (The 409
    // CAPTURE_CONFIG_LOCKED of an open session is produced where a session is open: the module's
    // own database test today, area 4 of this file once its route walk is whole again.)
    await expectCall(main, 'updateCaptureConfig', supervisor, 'the two cameras back on their tracks', { payload: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }] } }, 200);
    const restored = await expectCall(main, 'setPrimaryMic', supervisor, 'MIC-01 is the primary input again', { id: 'MIC-01' }, 200);
    expect(bodyOf<Selector>(restored)).toMatchObject({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }], mics: [{ inputId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', role: 'STANDBY' }] });
    // 79, accepted (integration pass D4: the cell was never produced): the camera on the track it holds.
    await expectCall(main, 'setCaptureCameraSource', supervisor, 'a camera on the track it already feeds', { id: 'CAM-01', payload: { trackId: 'VIDEO-01' } }, 200);
    settle();
  });

  it('camera search, connect and the mic re-read (operations 89 and 93 to 97; C3 §2.6, task 3 rows 132, 133, 142): one search, one test, one adoption against the fake ONVIF stub on loopback', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const technician = web.TECHNICIAN;
    interface Discovery { search: { searchId: string; state: string; created?: boolean } | null; candidates: { candidateId: string; status: string; testable: boolean; adapter: string; sourceClass: string; deviceId: string | null }[] }
    // THE ONLY NETWORK OF THIS AREA IS LOOPBACK. The module's own adapter (which probes the LAN of
    // the host) is never built here: its place is taken, once, by the real adapter of row 131 on the
    // loopback fixture of the fake ONVIF stub of row 60, and by an adapter that sends nothing once
    // the stub is stopped. The account is made here, for this stub only, and is printed nowhere.
    const account = { username: `fixture${randomUUID().replaceAll('-', '').slice(0, 12)}`, secret: `fixture ${randomUUID()}` };
    let stub: FakeOnvifStub | null = createFakeOnvifStub({ ports: await freeFakeOnvifPorts(), credential: account, devices: 1 });
    await stub.start();
    const nothing: WsDiscoveryResult = {
      candidates: [],
      responderCount: 0,
      interfaceCount: 0,
      truncated: false,
      counts: { datagramsReceived: 0, datagramsAccepted: 0, dropped: {}, repeats: 0, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 0, sendErrors: 0, handlerErrors: 0 },
    };
    captureDiscoveryControl(main.app).provideAdapter((lookup) =>
      stub === null
        ? ({ discover: async () => nothing } as unknown as OnvifDiscoveryAdapter)
        : createOnvifDiscoveryAdapter({ timers: createSystemTimers(), newMessageId: randomUUID, registered: lookup, loopbackFixture: stub.addresses().discovery }),
    );
    /** Lets the end of a search window, a test or an adoption be written. */
    const written = async (): Promise<void> => {
      for (let turn = 0; turn < 20; turn += 1) {
        await delay(10);
        await main.app.pipeline.drain();
        await engineControl(main.app).idle();
      }
    };
    let guard: LoopbackGuard | null = installLoopbackGuard();
    try {
      // 94 before any search: nothing, for every holder of CAPTURE_CONFIG.
      for (const caller of [supervisor, technician]) expect(bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', caller, 'no search was started', {}, 200))).toMatchObject({ search: null, candidates: [] });

      // 93: a new search (202); the caller's own running search again (200, no second probe); another session meanwhile (409).
      const started = await expectCall(main, 'startCaptureDiscovery', technician, 'a TECHNICIAN starts a search', {}, 202);
      const searchId = bodyOf<{ searchId: string; created: boolean }>(started).searchId;
      expect(bodyOf<{ created: boolean }>(started).created).toBe(true);
      const again = await expectCall(main, 'startCaptureDiscovery', technician, 'the same session while its search runs', {}, 200);
      expect(bodyOf<{ searchId: string; created: boolean }>(again)).toMatchObject({ searchId, created: false });
      const busy = await expectCall(main, 'startCaptureDiscovery', supervisor, 'another session while that search runs', {}, 409, 'INVALID_STATE');
      expect(detailsOf(busy)['reason']).toBe('DISCOVERY_IN_PROGRESS');
      // The window is three seconds of the capture timers (real time): the one wait of this area.
      await delay(3_400);
      await written();
      // Every datagram of the search went to 127.0.0.1, and the stub saw probes and nothing else.
      expect(new Set(guard.datagrams())).toEqual(new Set(['127.0.0.1']));
      expect(guard.refused()).toEqual([]);
      expect(new Set(stub.requestLog().map((entry) => `${entry.channel}/${entry.operation}/${String(entry.authPresent)}`))).toEqual(new Set(['discovery/Probe/false']));

      // 94: the caller's own list; another session reads none of it.
      const listed = bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', technician, 'the list of the caller\'s own search', {}, 200));
      expect(listed.search).toMatchObject({ searchId, state: 'COMPLETE' });
      expect(listed.candidates.map((candidate) => [candidate.status, candidate.testable, candidate.adapter, candidate.sourceClass, candidate.deviceId])).toEqual([['NEW', true, 'FAKE', 'DEVELOPMENT', null]]);
      expect(bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', supervisor, 'another session reads its own (empty) state', {}, 200)).candidates).toEqual([]);
      const candidateId = listed.candidates[0]?.candidateId ?? '';
      const unknownId = candidateId === 'CND-0000000000AA' ? 'CND-0000000000AB' : 'CND-0000000000AA';

      // 95 and 96 before a test, and for an id that is unknown or another session's: one answer, no request to any device.
      const requests = stub.requestLog().length;
      const untested = await expectCall(main, 'adoptCaptureCandidate', technician, 'adoption before a connection test', { id: candidateId, payload: { credential: account } }, 409, 'INVALID_STATE');
      expect(detailsOf(untested)['reason']).toBe('CANDIDATE_NOT_TESTED');
      await expectCall(main, 'testCaptureCandidateConnection', technician, 'an id no search listed', { id: unknownId, payload: { credential: account } }, 404, 'NOT_FOUND');
      await expectCall(main, 'adoptCaptureCandidate', technician, 'an id no search listed', { id: unknownId, payload: { credential: account } }, 404, 'NOT_FOUND');
      await expectCall(main, 'testCaptureCandidateConnection', supervisor, 'the candidate of another session\'s search', { id: candidateId, payload: { credential: account } }, 404, 'NOT_FOUND');
      await expectCall(main, 'testCaptureCandidateConnection', technician, 'a malformed {id}', { id: 'cnd-1', payload: { credential: account } }, 422, 'INVALID_INPUT');
      expect(stub.requestLog().length).toBe(requests);

      // The connection tester's HTTP client is refused by the guard of row 131 as it reads today
      // (row 132's note), so it is taken off here; the one candidate is the stub on 127.0.0.1.
      guard.restore();
      guard = null;

      // 95: one read-only attempt with the credential of this request; a failed test would be a result too.
      const tested = await expectCall(main, 'testCaptureCandidateConnection', technician, 'the stub\'s account', { id: candidateId, payload: { credential: account } }, 200);
      expect(bodyOf<Record<string, unknown>>(tested)).toMatchObject({ candidateId, outcome: 'REACHABLE', authenticated: true });

      // 96: the device, its credential and the audit rows in one unit; a repeat, and a test after it, are refused by name.
      main.clock.advance(30 * SECOND);
      const adopted = await expectCall(main, 'adoptCaptureCandidate', technician, 'the tested candidate with the same account', { id: candidateId, payload: { credential: account } }, 201);
      const adoption = bodyOf<{ deviceId: string; credentialSet: boolean; device: Record<string, unknown> }>(adopted);
      expect(adoption).toMatchObject({ deviceId: 'CAM-03', credentialSet: true, device: { id: 'CAM-03', kind: 'CAMERA', adapter: 'FAKE', sourceClass: 'DEVELOPMENT' } });
      await written();
      main.clock.advance(30 * SECOND);
      for (const operationId of ['adoptCaptureCandidate', 'testCaptureCandidateConnection'] as const) {
        const repeat = await expectCall(main, operationId, technician, 'the candidate is a registered device now', { id: candidateId, payload: { credential: account } }, 409, 'INVALID_STATE');
        expect(detailsOf(repeat)).toMatchObject({ reason: 'CANDIDATE_ALREADY_REGISTERED', deviceId: 'CAM-03' });
      }
      expect(bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', technician, 'the candidate reads REGISTERED', {}, 200)).candidates.map((candidate) => [candidate.status, candidate.deviceId])).toEqual([['REGISTERED', 'CAM-03']]);

      // 89: the credential of a registered camera is replaced; the answer is the selector and echoes neither field.
      const replaced = await expectCall(main, 'setCaptureDeviceCredential', supervisor, 'a SUPERVISOR replaces the credential of the adopted camera', { id: 'CAM-03', payload: account }, 200);
      await expectCall(main, 'setCaptureDeviceCredential', supervisor, 'a device the capture registry does not hold', { id: 'CAM-99', payload: account }, 404, 'NOT_FOUND');
      await expectCall(main, 'setCaptureDeviceCredential', supervisor, 'a malformed {id}', { id: 'cam 03', payload: account }, 422, 'INVALID_INPUT');
      // (Its 409 CAPTURE_CONFIG_LOCKED needs an open session: produced by the connect flow's own
      // database test today, and by area 4 of this file once its route walk is whole again - the
      // same place the selector's 409 of operations 78 to 80 waits for.)

      // 97: the registered microphones re-read; no network is involved.
      for (const caller of [supervisor, technician]) {
        // One accepted re-read per interval of the Core (the server clock decides).
        main.clock.advance(CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS);
        const rescanned = await expectCall(main, 'rescanCaptureInputs', caller, 'a holder of CAPTURE_CONFIG re-reads the local inputs', {}, 200);
        expect(JSON.stringify(bodyOf(rescanned))).toContain('MIC-01');
      }
      await written();

      // No answer of the area, and no line of the capture registry the clients read, holds the account.
      const everything = JSON.stringify([bodyOf(tested), adoption, bodyOf(replaced), bodyOf(await expectCall(main, 'getCaptureDevices', technician, 'the registry after the adoption', {}, 200))]);
      expect(everything).not.toContain(account.username);
      expect(everything).not.toContain(account.secret);
      // Nothing but the stub was ever dialled: its log holds the probes and the device-service calls of the two tests.
      expect(stub.requestLog().some((entry) => entry.channel !== 'discovery')).toBe(true);

      // Without a session: every one of the six.
      for (const [operationId, options] of [
        ['startCaptureDiscovery', {}],
        ['getCaptureDiscovery', {}],
        ['testCaptureCandidateConnection', { id: candidateId, payload: { credential: account } }],
        ['adoptCaptureCandidate', { id: candidateId, payload: { credential: account } }],
        ['setCaptureDeviceCredential', { id: 'CAM-03', payload: account }],
        ['rescanCaptureInputs', {}],
      ] as const) {
        await expectCall(main, operationId, CONSOLE, 'the web console without a session', options, 401, 'NOT_SIGNED_IN');
      }
    } finally {
      guard?.restore();
      await stub.stop();
      stub = null;
    }
    settle();
  });

  it('area 13, demo controls with the flag on (operations 71, 73, 74; the bodies of 72)', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    await expectCall(main, 'getDemoStatus', supervisor, 'the scenario and the active faults', {}, 200);
    await expectCall(main, 'injectFault', supervisor, 'a fan stall', { payload: { kind: 'FAN_STALL' } }, 204);
    const alerts = await expectCall(main, 'listAlerts', supervisor, 'the alert of that fault', {}, 200);
    const alertId = bodyOf<{ alerts: Array<{ id: string }> }>(alerts).alerts[0]?.id;
    if (alertId !== undefined) await expectCall(main, 'acknowledgeAlert', supervisor, 'the alert of the fault is acknowledged', { id: alertId }, 204);
    await expectCall(main, 'clearFault', supervisor, 'the fan stall is cleared', { payload: { kind: 'FAN_STALL' } }, 204);
    await expectCall(main, 'injectFault', supervisor, 'a kind outside the value set', { payload: { kind: 'NOPE' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'clearFault', supervisor, 'a kind outside the value set', { payload: { kind: 'NOPE' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'injectFault', supervisor, 'a tamper of evidence the Core does not have', { payload: { kind: 'TAMPER', target: { evidenceId: 'EV-20200101-0001' } } }, 404, 'NOT_FOUND');
    await expectCall(main, 'loadScenario', supervisor, 'a scenario outside the value set', { payload: { name: 'nope' } }, 422, 'INVALID_INPUT');
    settle();
  });

  it('area 4, sessions (operations 24 to 38): the {id}, the pre-check that blocks, the one that warns, a recording, a fault and its recovery, a sealed session', async () => {
    fresh(main);
    const investigator = web.INVESTIGATOR;
    const supervisor = web.SUPERVISOR;
    const technician = web.TECHNICIAN;
    const investigatorId = operatorIdOf('INVESTIGATOR');
    const input = (n: number): Record<string, unknown> => ({ caseNumber: `LP/2026/1001-00${90 + n}`, subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    const OTHER_SESSION = 'SES-20200101-0001';
    const onSession = OPERATIONS.filter((operation) => operation.path.startsWith('/api/v1/session/{id}'));
    // The eleven of the base and the three of schema v2 (operations 81, 82 and 83).
    expect(onSession).toHaveLength(14);

    // ── No session is open: the {id} of the path (decision D94 DN-11: 422 for a malformed one on all eleven).
    for (const operation of onSession) {
      const payload = operation.requestBody?.required === true ? exampleBody(operation) : undefined;
      const options = payload === undefined ? {} : { payload };
      await expectCall(main, operation.operationId, allowedCaller(operation), 'a malformed {id}', { ...options, id: 'not-a-session' }, 422, 'INVALID_INPUT');
      if (operation.responses[404] !== undefined) await expectCall(main, operation.operationId, allowedCaller(operation), 'a session that is not the open session', { ...options, id: OTHER_SESSION }, 404, 'NOT_FOUND');
    }
    await expectCall(main, 'acknowledgeSessionSummary', investigator, 'a summary of a session that is not open: nothing to do', { id: OTHER_SESSION }, 204);
    // Gap W34-3, closed by W83 (the all-scope text says so): the text of the 404 is fixed and quotes no part of the request.
    const notOpen = await expectCall(main, 'startSession', investigator, 'a session that is not the open session', { id: OTHER_SESSION }, 404, 'NOT_FOUND');
    const notOpenError = bodyOf<{ error: { message: string } }>(notOpen).error;
    expect(notOpenError.message).toBe('This session is not the open session.');
    expect(notOpenError.message).not.toContain(OTHER_SESSION);
    await expectCall(main, 'scanCaseNumber', investigator, 'a scanned case number', {}, 200);
    await expectCall(main, 'getCurrentSession', investigator, 'no session', {}, 200);
    await expectCall(main, 'listSessionHistory', investigator, 'the history', { query: '?limit=50' }, 200);
    await expectCall(main, 'listSessionHistory', investigator, 'a limit outside 1 to 200', { query: '?limit=0' }, 422, 'INVALID_INPUT');

    // ── The Core link is offline after a start: the pre-check blocks.
    const first = await expectCall(main, 'createSession', investigator, 'a session is created', { payload: input(1) }, 201);
    const blockedId = bodyOf<{ sessionId: string }>(first).sessionId;
    await expectCall(main, 'createSession', investigator, 'the same input again: the open session', { payload: input(1) }, 200);
    const active = await expectCall(main, 'createSession', investigator, 'another input while a session is open', { payload: input(2) }, 409, 'SESSION_ACTIVE');
    // Gap W34-1, closed by W83 (the envelope's `details` names `sessionId`): the 409 names the open session.
    expect(detailsOf(active)['sessionId']).toBe(blockedId);
    await expectCall(main, 'createSession', investigator, 'an input without its members', { payload: {} }, 422, 'INVALID_INPUT');
    await expectCall(main, 'beginPrecheck', investigator, 'the eight checks start', { id: blockedId }, 202);
    await expectCall(main, 'beginPrecheck', investigator, 'a pre-check that runs already', { id: blockedId }, 409, 'INVALID_STATE');
    await expectCall(main, 'startSession', investigator, 'while the checks run', { id: blockedId }, 409, 'PRECHECK_RUNNING');
    await expectCall(main, 'retryPrecheck', investigator, 'while the checks run', { id: blockedId }, 409, 'PRECHECK_RUNNING');
    await expectCall(main, 'acknowledgePrecheckWarnings', investigator, 'while the checks run', { id: blockedId }, 409, 'PRECHECK_RUNNING');
    await main.drive(PRECHECK_MS);
    await expectCall(main, 'startSession', investigator, 'the checks ended with a block', { id: blockedId }, 409, 'PRECHECK_BLOCKED');
    await expectCall(main, 'acknowledgePrecheckWarnings', investigator, 'a block is no warning', { id: blockedId }, 409, 'INVALID_STATE');
    // Gate rule M9: the tablet connects, as the realtime channel sets the link for a paired device's socket.
    await main.app.engine.setTabletLink('CONNECTED');
    await expectCall(main, 'retryPrecheck', supervisor, 'the checks run again', { id: blockedId }, 202);
    await main.drive(PRECHECK_MS);
    await expectCall(main, 'retryPrecheck', supervisor, 'the session is armed: nothing to retry', { id: blockedId }, 409, 'INVALID_STATE');
    await expectCall(main, 'stopSession', investigator, 'a stop of a session that does not record', { id: blockedId, payload: { reason: 'Interview completed' } }, 409, 'INVALID_STATE');
    await expectCall(main, 'recoverSession', investigator, 'no fault to recover from', { id: blockedId }, 409, 'INVALID_STATE');
    for (const [operationId, payload] of [['addSessionMarker', { label: 'Key statement' }], ['addSessionNote', { text: 'A note' }], ['takeSessionSnapshot', undefined]] as const) {
      await expectCall(main, operationId, investigator, 'a session that does not record', { id: blockedId, ...(payload === undefined ? {} : { payload }) }, 409, 'INVALID_STATE');
    }
    await expectCall(main, 'switchAudioSource', supervisor, 'a switch in a session that does not record', { id: blockedId, payload: { inputId: 'MIC-02' } }, 409, 'INVALID_STATE');
    await expectCall(main, 'cancelSession', supervisor, 'the armed session is cancelled', { id: blockedId }, 204);

    // ── A microphone without a signal: the pre-check ends with a warning.
    await expectCall(main, 'injectFault', supervisor, 'a microphone loses its signal', { payload: { kind: 'MIC_NO_SIGNAL' } }, 204);
    const second = await expectCall(main, 'createSession', investigator, 'a session is created', { payload: input(3) }, 201);
    const sessionId = bodyOf<{ sessionId: string }>(second).sessionId;
    await expectCall(main, 'startSession', investigator, 'the first start begins the pre-check', { id: sessionId }, 202);
    await main.drive(PRECHECK_MS);
    await expectCall(main, 'startSession', investigator, 'the checks ended with a warning', { id: sessionId }, 409, 'PRECHECK_WARNINGS');
    await expectCall(main, 'acknowledgePrecheckWarnings', supervisor, 'the warning is acknowledged', { id: sessionId }, 200);
    await expectCall(main, 'clearFault', supervisor, 'the microphone is back', { payload: { kind: 'MIC_NO_SIGNAL' } }, 204);
    await expectCall(main, 'startSession', investigator, 'the armed session starts to record', { id: sessionId }, 200);
    await main.drive(10 * SECOND);

    // ── While it records.
    await expectCall(main, 'getCurrentSession', tabletSession, 'the recording, read on the tablet', {}, 200);
    for (const operationId of ['getAudioStatus', 'getDeviceHealth', 'getVideoStatus', 'getStorageStatus']) await expectCall(main, operationId, tabletSession, 'a read while the session records', {}, 200);
    await expectCall(main, 'addSessionMarker', tabletSession, 'a marker from the tablet', { id: sessionId, payload: { label: 'Key statement' } }, 204);
    await expectCall(main, 'addSessionMarker', investigator, 'a marker without a label', { id: sessionId }, 204);
    await expectCall(main, 'addSessionMarker', investigator, 'a label of 81 characters', { id: sessionId, payload: { label: 'l'.repeat(81) } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'addSessionNote', supervisor, 'a note from the web console', { id: sessionId, payload: { text: 'Subject asked for a break' } }, 204);
    await expectCall(main, 'addSessionNote', supervisor, 'a note that is no text', { id: sessionId, payload: { text: 5 } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'takeSessionSnapshot', investigator, 'a snapshot', { id: sessionId }, 204);
    // Operations 81 and 82 (C3 §2.4 "Mic switch"; integration pass D4): the intervals before and after a switch.
    const oneInterval = await expectCall(main, 'listAudioSourceIntervals', tabletSession, 'the interval of the start, read on the tablet', { id: sessionId }, 200);
    expect(bodyOf<{ items: Array<{ inputId: string; reason: string }> }>(oneInterval).items.map((item) => [item.inputId, item.reason])).toEqual([['MIC-01', 'START']]);
    // C3 §2.2: the creator of the session or any SUPERVISOR. The CREATOR switches (pass D6: the guard's
    // holder fact reads the creator now); the SUPERVISOR switches back below.
    await expectCall(main, 'switchAudioSource', investigator, 'the standby microphone becomes the source, switched by the creator of the session', { id: sessionId, payload: { inputId: 'MIC-02' } }, 200);
    await expectCall(main, 'switchAudioSource', investigator, 'a well-formed input that is no input of the session', { id: sessionId, payload: { inputId: 'MIC-09' } }, 409, 'AUDIO_SOURCE_CONFLICT');
    const twoIntervals = await expectCall(main, 'listAudioSourceIntervals', technician, 'two intervals, newest first, one a page', { id: sessionId, query: '?limit=1' }, 200);
    expect(bodyOf<{ items: Array<{ inputId: string; reason: string }>; nextCursor: string | null }>(twoIntervals)).toMatchObject({ items: [{ inputId: 'MIC-02', reason: 'MANUAL' }], nextCursor: '2' });
    await expectCall(main, 'listAudioSourceIntervals', supervisor, 'a limit outside 1 to 200', { id: sessionId, query: '?limit=0' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'switchAudioSource', supervisor, 'an input ID of another form', { id: sessionId, payload: { inputId: 'MIC-2' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'switchAudioSource', supervisor, 'back to the first microphone', { id: sessionId, payload: { inputId: 'MIC-01' } }, 200);
    // Operation 83 (row 82b; the walk is pass D4's): no sealing has started while the session records.
    await expectCall(main, 'getSealingProgress', investigator, 'the sealing progress of a session that still records', { id: sessionId }, 409, 'INVALID_STATE');
    await expectCall(main, 'cancelSession', supervisor, 'a recording cannot be cancelled', { id: sessionId }, 409, 'INVALID_STATE');
    await expectCall(main, 'beginPrecheck', investigator, 'a recording has passed its pre-check', { id: sessionId }, 409, 'INVALID_STATE');
    await expectCall(main, 'startSession', investigator, 'a recording cannot be started', { id: sessionId }, 409, 'INVALID_STATE');
    await expectCall(main, 'startSession', investigator, 'a body outside the schema', { id: sessionId, payload: { acknowledgeWarnings: 'yes' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'stopSession', investigator, 'a reason of four characters (AC-B-50)', { id: sessionId, payload: { reason: 'Done' } }, 422, 'INVALID_REASON');
    // Gap W34-2, closed by W83: a reason that is no text is the schema stage's code, which the all-scope text of the status now names.
    await expectCall(main, 'stopSession', investigator, 'a reason that is no text', { id: sessionId, payload: { reason: null } }, 422, 'INVALID_INPUT');
    // Spec §7.14, operations 66 and 67, and §7.11, operation 48: refused while a session is open.
    await expectCall(main, 'restartServices', technician, 'a services restart during a session', {}, 409, 'SESSION_ACTIVE');
    await expectCall(main, 'startSoftwareUpdate', technician, 'a software update during a session', {}, 409, 'SESSION_ACTIVE');
    await expectCall(main, 'restartDevice', technician, 'a camera restart during a recording', { id: 'CAM-01' }, 409, 'RECORDING_ACTIVE');
    // C3 §2.4 (OD-10): the selector and the camera credential are locked while a session is open.
    await expectCall(main, 'updateCaptureConfig', supervisor, 'a selector edit during a session', { payload: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] } }, 409, 'CAPTURE_CONFIG_LOCKED');
    await expectCall(main, 'setCaptureCameraSource', supervisor, 'a camera assignment during a session', { id: 'CAM-01', payload: { trackId: 'VIDEO-01' } }, 409, 'CAPTURE_CONFIG_LOCKED');
    await expectCall(main, 'setPrimaryMic', supervisor, 'a primary microphone change during a session', { id: 'MIC-01' }, 409, 'CAPTURE_CONFIG_LOCKED');
    await expectCall(main, 'setCaptureDeviceCredential', supervisor, 'a camera credential during a session', { id: 'CAM-03', payload: exampleBody(operationOf('setCaptureDeviceCredential')) }, 409, 'CAPTURE_CONFIG_LOCKED');

    // ── A power failure moves the recording to FAULT; the recovery closes it as incomplete.
    await expectCall(main, 'injectFault', supervisor, 'the power fails', { payload: { kind: 'POWER_FAIL' } }, 204);
    await main.drive(SECOND);
    const faulted = await expectCall(main, 'getCurrentSession', investigator, 'the session in FAULT', {}, 200);
    expect(bodyOf<{ session: { state: string } | null }>(faulted).session?.state).toBe('FAULT');
    // Known difference SIM-GAP-W34-1 (decision D94 DN-5), printed and not pinned: the recording time of a faulted session keeps counting.
    await main.drive(2 * SECOND);
    const later = await expectCall(main, 'getCurrentSession', investigator, 'the session in FAULT, two seconds later', {}, 200);
    const elapsed = [faulted, later].map((answer) => bodyOf<{ session: { elapsedMs: number } | null }>(answer).session?.elapsedMs);
    console.info(`[w52] known difference SIM-GAP-W34-1: elapsedMs of the faulted session ${elapsed[0]} ms, and ${elapsed[1]} ms two seconds of the clock later`);
    await expectCall(main, 'recoverSession', supervisor, 'the recovery starts', { id: sessionId }, 202);
    await main.drive(RECOVERY_MS);
    await expectCall(main, 'clearFault', supervisor, 'the power is back', { payload: { kind: 'POWER_FAIL' } }, 204);
    await main.drive(SECOND);

    // ── A recording from create to SEALED evidence.
    const third = await expectCall(main, 'createSession', investigator, 'a session is created', { payload: input(4) }, 201);
    const sealedId = bodyOf<{ sessionId: string }>(third).sessionId;
    await expectCall(main, 'startSession', investigator, 'the first start begins the pre-check', { id: sealedId }, 202);
    await main.drive(PRECHECK_MS);
    await expectCall(main, 'startSession', investigator, 'the armed session starts to record', { id: sealedId }, 200);
    await main.drive(10 * SECOND);
    await expectCall(main, 'stopSession', investigator, 'the recording is stopped', { id: sealedId, payload: { reason: 'Interview completed' } }, 202);
    await main.drive(FINALIZE_MS);
    const sealed = await expectCall(main, 'getCurrentSession', investigator, 'the sealed session', {}, 200);
    const current = bodyOf<{ session: { state: string; evidenceId: string | null } | null }>(sealed).session;
    expect(current?.state).toBe('SEALED');
    const progress = await expectCall(main, 'getSealingProgress', tabletSession, 'the sealing progress of the sealed session, read on the tablet', { id: sealedId }, 200);
    expect(bodyOf<{ sessionId: string; progressPct: number }>(progress)).toMatchObject({ sessionId: sealedId, progressPct: 100 });
    sealedEvidenceId = current?.evidenceId ?? '';
    expect(sealedEvidenceId).not.toBe('');
    await expectCall(main, 'acknowledgeSessionSummary', investigator, 'the summary is acknowledged', { id: sealedId }, 204);
    settle();
  });

  it('the transcript (operations 84 to 86; C3 §2.4, integration pass D4): the sealed machine transcript of a REAL item, a signed revision, the revision list, their refusals', async () => {
    fresh(main);
    const investigator = web.INVESTIGATOR;
    const supervisor = web.SUPERVISOR;
    const UNKNOWN = 'EV-20200101-0001';
    // A recording of its own, stopped through the API and sealed as a REAL item (`contract.transcripts.ts`).
    const created = await expectCall(main, 'createSession', investigator, 'a session is created', { payload: { caseNumber: 'LP/2026/1001-0084', subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId: operatorIdOf('INVESTIGATOR'), room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } }, 201);
    const sessionId = bodyOf<{ sessionId: string }>(created).sessionId;
    await expectCall(main, 'startSession', investigator, 'the first start begins the pre-check', { id: sessionId }, 202);
    await main.drive(PRECHECK_MS);
    await expectCall(main, 'startSession', investigator, 'the armed session starts to record', { id: sessionId }, 200);
    await main.drive(3 * SECOND);
    await expectCall(main, 'stopSession', investigator, 'the recording is stopped', { id: sessionId, payload: { reason: 'Interview completed' } }, 202);
    transcriptItem = await sealRealItemWithTranscript(main.app, sessionId, db.run.dataDir);
    const id = transcriptItem.evidenceId;
    await expectCall(main, 'acknowledgeSessionSummary', investigator, 'the summary is acknowledged', { id: sessionId }, 204);
    const withoutTranscript = sealedEvidenceId;

    const read = await expectCall(main, 'getTranscript', tabletSession, 'the sealed machine transcript, read on the tablet', { id }, 200);
    const document = bodyOf<{ segments: Array<{ text: string }>; sha256: string; machineTranscriptHash: string; revision: number }>(read);
    expect([document.segments.length, document.revision, document.sha256 === document.machineTranscriptHash]).toEqual([2, 0, true]);
    await expectCall(main, 'getTranscript', supervisor, 'an item the Core does not have', { id: UNKNOWN }, 404, 'NOT_FOUND');
    await expectCall(main, 'getTranscript', supervisor, 'an item sealed without a machine transcript document', { id: withoutTranscript }, 409, 'TRANSCRIPT_NOT_READY');
    await expectCall(main, 'getTranscript', supervisor, 'a malformed {id}', { id: 'x' }, 422, 'INVALID_INPUT');

    await expectCall(main, 'listTranscriptRevisions', supervisor, 'no revision yet', { id }, 200);
    const revise = { baseRevision: 0, changes: [{ segmentIndex: 1, from: transcriptItem.segmentText, to: 'Terima kasih, Bu.' }], note: 'The witness addressed a woman officer.' };
    const revised = await expectCall(main, 'createTranscriptRevision', investigator, 'a signed revision by the INVESTIGATOR', { id, payload: revise }, 201);
    expect(bodyOf<{ number: number; baseRevision: number; machineTranscriptHash: string; signature: { simulated: boolean } }>(revised)).toMatchObject({ number: 1, baseRevision: 0, machineTranscriptHash: document.sha256, signature: { simulated: false } });
    await expectCall(main, 'createTranscriptRevision', supervisor, 'a revision built on a revision that is no longer current', { id, payload: revise }, 409, 'TRANSCRIPT_REVISION_CONFLICT');
    await expectCall(main, 'createTranscriptRevision', supervisor, 'an item sealed without a machine transcript document', { id: withoutTranscript, payload: revise }, 409, 'TRANSCRIPT_NOT_READY');
    await expectCall(main, 'createTranscriptRevision', supervisor, 'an item the Core does not have', { id: UNKNOWN, payload: revise }, 404, 'NOT_FOUND');
    await expectCall(main, 'createTranscriptRevision', supervisor, 'a revision without a reason', { id, payload: { baseRevision: 1, changes: revise.changes } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'createTranscriptRevision', web.TECHNICIAN, 'a role without TRANSCRIPT_REVISE', { id, payload: { ...revise, baseRevision: 1 } }, 403, 'NOT_PERMITTED');
    // The case scope of REAL evidence (SEC35-16; review finding R93-02, fix F-M6; closing pass F-X): an operator who
    // neither holds the case nor is a SUPERVISOR is refused `403 NOT_PERMITTED` with `details.reason:
    // EVIDENCE_CASE_SCOPE` on operations 84, 85, 86 and 88. Every seeded role holds EVIDENCE_VIEW, so the TECHNICIAN
    // reaches the scope on 84 / 86 / 88; on 85 the scope is reached only by a holder of TRANSCRIPT_REVISE who is not
    // the case's investigator: the TECHNICIAN while it covers as an INVESTIGATOR (the role is read per request).
    const SCOPE = { reason: 'EVIDENCE_CASE_SCOPE' };
    const scoped = async (operationId: string, caller: Caller, note: string, options: Options): Promise<void> => {
      const refused = await expectCall(main, operationId, caller, note, options, 403, 'NOT_PERMITTED');
      if (detailsOf(refused)['reason'] !== SCOPE.reason) misses.push(`${operationId} (${note}): 403 with details.reason ${JSON.stringify(detailsOf(refused)['reason'])}; the specification says ${SCOPE.reason}`);
    };
    await scoped('getTranscript', web.TECHNICIAN, 'REAL evidence of a case the caller does not hold', { id });
    await scoped('listTranscriptRevisions', web.TECHNICIAN, 'REAL evidence of a case the caller does not hold', { id });
    await scoped('createEvidenceMediaSession', web.TECHNICIAN, 'REAL evidence of a case the caller does not hold', { id, payload: { fileId: 'VIDEO-01' } });
    const coverId = operatorIdOf('TECHNICIAN');
    await expectCall(main, 'assignUserRole', supervisor, 'the TECHNICIAN covers as an INVESTIGATOR', { id: coverId, payload: { role: 'INVESTIGATOR', reason: 'Covers the interview shift this week' } }, 200);
    await scoped('createTranscriptRevision', web.TECHNICIAN, 'an INVESTIGATOR who does not hold the case', { id, payload: { ...revise, baseRevision: 1 } });
    await expectCall(main, 'assignUserRole', supervisor, 'and is a TECHNICIAN again', { id: coverId, payload: { role: 'TECHNICIAN' } }, 200);
    // CONTROL of the scope: an item that is not REAL evidence has none - the same TECHNICIAN reads past it (409: no document).
    await expectCall(main, 'getTranscript', web.TECHNICIAN, 'an item that is not REAL evidence has no case scope', { id: withoutTranscript }, 409, 'TRANSCRIPT_NOT_READY');
    // Operations 42 and 87 and the two registry-external routes (`GET /media/{token}`, `GET /exports/{token}`) hold the
    // SAME predicate, but no seeded role can reach it through this walk: EVIDENCE_EXPORT is the SUPERVISOR's alone, who
    // always passes, and both tokens are bound to the operator they were issued to. Their refusals are pinned at the
    // routes: `modules/evidence-export/__tests__/{routes,download}.test.ts`, `modules/media-stream/__tests__/routes.test.ts`.
    // The machine transcript is the same after the revision: only the head moved.
    const after = bodyOf<{ sha256: string; revision: number; segments: Array<{ text: string }> }>(await expectCall(main, 'getTranscript', supervisor, 'the machine transcript after a revision', { id }, 200));
    expect([after.sha256, after.revision, after.segments.map((segment) => segment.text)]).toEqual([document.sha256, 1, document.segments.map((segment) => segment.text)]);

    // (Read by the case's holder: since R93-02 a TECHNICIAN is refused this REAL item, see the scope walk above.)
    const listed = await expectCall(main, 'listTranscriptRevisions', investigator, 'the one revision, with its changes', { id }, 200);
    expect(bodyOf<{ items: Array<{ number: number; changes: Array<{ to: string }> }> }>(listed).items.map((item) => [item.number, item.changes[0]?.to])).toEqual([[1, 'Terima kasih, Bu.']]);
    await expectCall(main, 'listTranscriptRevisions', supervisor, 'an item the Core does not have', { id: UNKNOWN }, 404, 'NOT_FOUND');
    await expectCall(main, 'listTranscriptRevisions', supervisor, 'an item sealed without a machine transcript document', { id: withoutTranscript }, 409, 'TRANSCRIPT_NOT_READY');
    await expectCall(main, 'listTranscriptRevisions', supervisor, 'a limit outside 1 to 200', { id, query: '?limit=0' }, 422, 'INVALID_INPUT');
    // Operation 88, its 201 (pass D6): the REAL item of this block is playable (`contract.transcripts.ts`).
    await expectCall(main, 'createEvidenceMediaSession', supervisor, 'a media session of a real sealed item', { id, payload: { fileId: 'VIDEO-01' } }, 201);
    settle();
  });

  it('area 5, evidence (operations 39 to 43), and the software update', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const UNKNOWN = 'EV-20200101-0001';
    const export_ = { reason: 'Case file handover for prosecutor review', destination: 'Case file transfer (simulated)' };
    const list = await expectCall(main, 'listEvidence', supervisor, 'every item', { query: '?limit=200' }, 200);
    const items = bodyOf<{ items: Array<{ id: string; status: string; sealedAt: number | null }> }>(list).items;
    unsealedEvidenceId = items.find((item) => item.sealedAt === null)?.id ?? '';
    console.info(`[w52] evidence: ${items.length} items; statuses ${JSON.stringify([...new Set(items.map((item) => item.status))].sort())}; sealed by this file ${sealedEvidenceId}; never sealed ${unsealedEvidenceId}`);
    expect(unsealedEvidenceId).not.toBe('');
    await expectCall(main, 'listEvidence', supervisor, 'a limit outside 1 to 200', { query: '?limit=0' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'listEvidence', supervisor, 'a text search', { query: '?q=LP' }, 200);

    await expectCall(main, 'getEvidence', supervisor, 'the sealed item', { id: sealedEvidenceId }, 200);
    await expectCall(main, 'getEvidence', supervisor, 'an item the Core does not have', { id: UNKNOWN }, 404, 'NOT_FOUND');
    await expectCall(main, 'getEvidence', supervisor, 'a malformed {id}', { id: 'x' }, 422, 'INVALID_INPUT');
    const verified = await expectCall(main, 'verifyEvidence', supervisor, 'the sealed item verifies', { id: sealedEvidenceId }, 200);
    expect(bodyOf<{ ok: boolean }>(verified).ok).toBe(true);
    await expectCall(main, 'verifyEvidence', supervisor, 'an item the Core does not have', { id: UNKNOWN }, 404, 'NOT_FOUND');
    await expectCall(main, 'verifyEvidence', supervisor, 'a malformed {id}', { id: 'x' }, 422, 'INVALID_INPUT');
    // Fix wave J (truth rule 3a; JA2-01 / JW-01): an item that was never sealed has nothing sealed to verify.
    const unverifiable = await expectCall(main, 'verifyEvidence', supervisor, 'an item that was never sealed', { id: unsealedEvidenceId }, 409, 'NOT_SEALED');
    expect(detailsOf(unverifiable)).toEqual({ simCode: 'UNSEALED_EVIDENCE', from: null, event: 'verify' });

    // Spec §7.3 line 10 for the export: 404, then 409, then 422 (decision D92 DN-2).
    const exported = await expectCall(main, 'exportEvidence', supervisor, 'the sealed item is exported', { id: sealedEvidenceId, payload: export_ }, 202);
    // Operation 87 (row 91; integration pass D4 for the walk): the job of that export, by the rule of C3 §3 (`EXP-NNNNNN` -> `EXPJ-NNNNNN`).
    const exportId = bodyOf<{ exportId: string }>(exported).exportId;
    exportJobId = `EXPJ-${exportId.slice('EXP-'.length)}`;
    await expectCall(main, 'getEvidenceExportJob', supervisor, 'the job of the export', { id: exportJobId }, 200);
    await expectCall(main, 'getEvidenceExportJob', supervisor, 'a job the Core does not have', { id: 'EXPJ-999999' }, 404, 'NOT_FOUND');
    await expectCall(main, 'getEvidenceExportJob', supervisor, 'a malformed {id}', { id: 'x' }, 422, 'INVALID_INPUT');
    // Operation 88 (row 90): the refusals. Its 201 is in the transcript block, on the REAL item (pass D6).
    await expectCall(main, 'createEvidenceMediaSession', supervisor, 'an item the Core does not have', { id: UNKNOWN }, 404, 'NOT_FOUND');
    await expectCall(main, 'createEvidenceMediaSession', supervisor, 'an item without a sealed package to play', { id: sealedEvidenceId }, 409, 'MEDIA_NOT_AVAILABLE');
    await expectCall(main, 'createEvidenceMediaSession', supervisor, 'a malformed {id}', { id: 'x' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'exportEvidence', supervisor, 'an item the Core does not have', { id: UNKNOWN, payload: export_ }, 404, 'NOT_FOUND');
    await expectCall(main, 'exportEvidence', supervisor, 'an ID of another form (decision D92: 404 on this operation)', { id: 'x', payload: export_ }, 404, 'NOT_FOUND');
    await expectCall(main, 'exportEvidence', supervisor, 'an item that was never sealed', { id: unsealedEvidenceId, payload: export_ }, 409, 'NOT_SEALED');
    await expectCall(main, 'exportEvidence', supervisor, 'a reason of three characters', { id: sealedEvidenceId, payload: { reason: 'abc' } }, 422, 'INVALID_REASON');
    // Gap W35-2, closed by W83: a body that breaks the schema is INVALID_INPUT, which the all-scope text of the status now names.
    await expectCall(main, 'exportEvidence', supervisor, 'a reason that is no text', { id: sealedEvidenceId, payload: { reason: 5 } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'exportEvidence', web.INVESTIGATOR, 'a role without EVIDENCE_EXPORT (RB-5)', { id: sealedEvidenceId, payload: export_ }, 403, 'FORBIDDEN');

    // The other code of the 409: while security is in FAULT nothing is exported.
    await expectCall(main, 'injectFault', supervisor, 'a security fault', { payload: { kind: 'SECURITY_FAULT' } }, 204);
    await expectCall(main, 'exportEvidence', supervisor, 'an export while security is in FAULT', { id: sealedEvidenceId, payload: export_ }, 409, 'SECURITY_FAULT');
    await expectCall(main, 'clearFault', supervisor, 'the security fault is cleared', { payload: { kind: 'SECURITY_FAULT' } }, 204);
    await expectCall(main, 'exportEvidence', supervisor, 'an exported item is exported again', { id: sealedEvidenceId, payload: export_ }, 202);

    // Gap W35-1, closed by W83 (the example carries it too): the 409 of an archive carries the transition.
    const unsealed = await expectCall(main, 'archiveEvidence', supervisor, 'an item that was never sealed', { id: unsealedEvidenceId }, 409, 'NOT_SEALED');
    expect(detailsOf(unsealed)).toEqual({ simCode: 'UNSEALED_EVIDENCE', from: null, event: 'archiveEvidence' });
    await expectCall(main, 'archiveEvidence', supervisor, 'an item the Core does not have', { id: UNKNOWN }, 404, 'NOT_FOUND');
    await expectCall(main, 'archiveEvidence', supervisor, 'a malformed {id}', { id: 'x' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'archiveEvidence', supervisor, 'the exported item is archived', { id: sealedEvidenceId }, 204);

    // The update comes last of the journey: it takes the engine's time.
    await expectCall(main, 'startSoftwareUpdate', web.TECHNICIAN, 'a software update while no recording runs', {}, 202);
    await main.drive(30 * SECOND, SECOND);
    settle();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 3. The answers every operation shares: generated from the registry (AC-B-14)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-14: the refusals of the stages, generated for every operation of the registry', () => {
  it('401 NOT_SIGNED_IN: every operation that is not PUBLIC, called without a credential', async () => {
    const guarded = OPERATIONS.filter((operation) => operation.access.kind !== CoreApiAccessKind.PUBLIC);
    // 99 operations, four of them PUBLIC (the pin read 71 of the 75 of the base).
    expect(OPERATIONS.length - guarded.length).toBe(4);
    expect(guarded).toHaveLength(95);
    // The two unrouted operations (task 4 row 70) answer the router's 404: they are not called.
    for (const operation of guarded.filter((entry) => !UNROUTED_OPERATIONS.includes(entry))) {
      fresh(main);
      await expectCall(main, operation.operationId, NOBODY, 'no credential', {}, 401, 'NOT_SIGNED_IN');
    }
    // ID-12, §7.3 line 4: two credentials in one request.
    // It is decided at stage 4, before any access rule: also on an operation that is PUBLIC.
    fresh(main);
    const twice = { authorization: `Bearer ses_${'A'.repeat(43)}` };
    for (const [operationId, payload] of [
      ['getAuthSession', undefined],
      ['signIn', { username: usernameOf('SUPERVISOR'), password: DEMO_OPERATOR_PASSWORD }],
      ['redeemPairingCode', { code: '000000', deviceName: 'Tablet', platform: 'android', appVersion: '0.2.0' }],
    ] as const) {
      const both = await expectCall(main, operationId, web.SUPERVISOR, 'a session cookie and an Authorization header', { headers: twice, ...(payload === undefined ? {} : { payload }) }, 401, 'NOT_SIGNED_IN');
      expect(detailsOf(both)['reason'], operationId).toBe('CREDENTIAL_CONFLICT');
    }
    settle();
  });

  it('403: every operation that documents it, by the refusal its access rule gives (a sample of every access kind and condition)', async () => {
    const lines: string[] = [];
    for (const operation of ROUTED_OPERATIONS) {
      if (operation.responses[403] === undefined) continue;
      fresh(main);
      const { access, operationId } = operation;
      const conditions: readonly string[] = access.conditions ?? [];
      const permissions = coreApiAccessPermissions(access);
      const lacking = ROLES.find((role) => permissions.length > 0 && !holdsOneOf(role, permissions));
      const payload = operation.requestBody === undefined ? {} : { payload: exampleBody(operation) };
      let answer: Answer;
      if (operationId === 'signIn') {
        // ID-1: neither a web console Origin nor a device credential.
        answer = await expectCall(main, operationId, NOBODY, 'no console identity', payload, 403, 'DEVICE_NOT_PAIRED');
      } else if (operationId === 'getSignInStatus') {
        // §6.6, decision D78 DN-9: a retired device may call health and the redeem only.
        answer = await expectCall(main, operationId, retired.credential, 'the credential of a revoked device', {}, 403, 'DEVICE_REVOKED');
      } else if (access.kind === CoreApiAccessKind.PUBLIC) {
        answer = await expectCall(main, operationId, allowedCaller(operation), 'an Origin that is on no list', { ...payload, headers: { origin: FOREIGN_ORIGIN } }, 403, 'ORIGIN_NOT_ALLOWED');
      } else if (access.kind === CoreApiAccessKind.DEVICE || conditions.includes(CoreApiAccessCondition.DEVICE_SESSION)) {
        // §7.2: a device-only operation called by a web session.
        answer = await expectCall(main, operationId, web.SUPERVISOR, 'a web console session on a device-only operation', payload, 403, 'DEVICE_NOT_PAIRED');
      } else if (lacking !== undefined) {
        // §7.2: the role lacks the permission; `FORBIDDEN` stays the code of `exportEvidence` (RB-5).
        answer = await expectCall(main, operationId, web[lacking], `the ${lacking} lacks ${describeCoreApiAccess(access)}`, payload, 403, operationId === 'exportEvidence' ? 'FORBIDDEN' : 'NOT_PERMITTED');
      } else {
        // AUTHENTICATED, or a permission every seeded role holds (finding F49): the Origin guard's refusal.
        answer = await expectCall(main, operationId, web.SUPERVISOR, 'a session cookie with an Origin that is no web console origin', { ...payload, headers: { origin: FOREIGN_ORIGIN } }, 403, 'ORIGIN_NOT_ALLOWED');
      }
      lines.push(`${operationId} [${describeCoreApiAccess(access)}${conditions.length > 0 ? ` + ${conditions.join(' + ')}` : ''}]: ${answer.status} ${answer.code} (${answer.note})`);
    }
    console.info(`[w52] 403 per operation:\n${lines.map((line) => `[w52]   ${line}`).join('\n')}`);
    expect(lines).toHaveLength(ROUTED_OPERATIONS.filter((operation) => operation.responses[403] !== undefined).length);

    // A device that was revoked: its credential and the session an operator opened on it (RB-6).
    fresh(main);
    await expectCall(main, 'getDeviceRegistration', retired.credential, 'the credential of a revoked device', {}, 403, 'DEVICE_REVOKED');
    await expectCall(main, 'getCurrentSession', retiredSession, 'a session on a revoked device', {}, 403, 'DEVICE_REVOKED');
    await expectCall(main, 'touchSession', retiredSession, 'a session on a revoked device', {}, 403, 'DEVICE_REVOKED');
    // §6.6: a retired device may still ask for health.
    await expectCall(main, 'getServiceHealth', retired.credential, 'health, with the credential of a revoked device', {}, 200);
    fresh(main);
    settle();
  });

  it('400 INVALID_JSON and 413 PAYLOAD_TOO_LARGE: every operation with a request body, called by a caller its rule lets through', async () => {
    const withBody = ROUTED_OPERATIONS.filter((operation) => operation.requestBody !== undefined);
    console.info(`[w52] operations with a request body: ${withBody.length}`);
    for (const operation of withBody) {
      fresh(main);
      const caller = allowedCaller(operation);
      expect(operation.responses[400], operation.operationId).toBeDefined();
      await expectCall(main, operation.operationId, caller, 'a body that is no JSON', { raw: '{"w52": ' }, 400, 'INVALID_JSON');
      await expectCall(main, operation.operationId, caller, 'a body that is a JSON list', { raw: '[1]' }, 400, 'INVALID_JSON');
      // §7.2: over 65,536 bytes, whatever the body says.
      const large = { ...exampleBody(operation), w52: 'x'.repeat(API_BODY_LIMIT_BYTES) };
      await expectCall(main, operation.operationId, caller, `a body over ${API_BODY_LIMIT_BYTES} bytes`, { payload: large }, 413, 'PAYLOAD_TOO_LARGE');
    }
    // §7.3: 401 and 403 win over the body. An oversized and a malformed body of a caller the rule refuses.
    fresh(main);
    await expectCall(main, 'createSession', NOBODY, 'no credential, with a body that is no JSON', { raw: '{"w52": ' }, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'createSession', web.TECHNICIAN, 'a role without the permission, with a body over the limit', { payload: { w52: 'x'.repeat(API_BODY_LIMIT_BYTES) } }, 403, 'NOT_PERMITTED');
    fresh(main);
    settle();
  });

  it('gaps W36-1 and W40-1, closed by W83: a POST without a request body answers 400 INVALID_JSON to a body that is no JSON object, which the contract documents at envelope level', async () => {
    // Six of the seven: `restartDevice` left the no-body set when schema v2 gave it the optional
    // `confirm` body (OD-22 PoE cycle, devices.ts `RestartDeviceRequestSchema`); its answers are
    // walked under the body-validating rules instead. The W36-1/W40-1 pair, as landed.
    const named = ['testDeviceSignal', 'identifyDevice', 'runDiagnostics', 'restartServices', 'startSoftwareUpdate', 'acknowledgeAlert'];
    for (const operationId of named) {
      fresh(main);
      const operation = operationOf(operationId);
      expect(operation.requestBody, operationId).toBeUndefined();
      const answer = await call(main, operationId, allowedCaller(operation), 'a body that is a JSON list, on an operation without a request body', {
        raw: '[1]',
        knownGap: operationId === 'testDeviceSignal' || operationId === 'identifyDevice' ? 'gap W36-1' : 'gap W40-1',
      });
      // The server's behaviour is pinned here, and the validator's verdict on it is pinned below (W83 closed both gaps).
      expect([answer.status, answer.code], operationId).toEqual([400, 'INVALID_JSON']);
    }
    expect(ledger.gapVerdicts).toHaveLength(named.length);
    // W83: the envelope-level 400 makes each of these answers valid against the contract.
    expect(ledger.gapVerdicts.map((entry) => entry.verdict)).toEqual(named.map(() => JSON.stringify({ ok: true })));
    fresh(main);
  });

  it('404 of an unknown route, 405 with `allow` on every path of the registry, 400 INVALID_PATH: the answers that belong to no operation', async () => {
    fresh(main);
    for (const url of ['/api/v1/nope', '/api/v2/health', '/', '/api/v1/session/SES-20200101-0001/nope', '/api/v1/health/more']) {
      const answer = await request(main, null, 'GET', url, NOBODY, 'a path no operation has');
      expect([answer.status, answer.code], url).toEqual([404, 'NOT_FOUND']);
    }
    const unknownPost = await request(main, null, 'POST', '/api/v1/nope', web.SUPERVISOR, 'a path no operation has, with a session');
    expect([unknownPost.status, unknownPost.code]).toEqual([404, 'NOT_FOUND']);

    // Every path, with a method it does not have. `allow` lists exactly the path's methods.
    const paths = new Map<string, Set<string>>();
    for (const operation of ROUTED_OPERATIONS) paths.set(operation.path, (paths.get(operation.path) ?? new Set<string>()).add(methodOf(operation)));
    let refused = 0;
    for (const [path, methods] of paths) {
      fresh(main);
      const url = path.replace('{id}', exampleId(OPERATIONS.find((operation) => operation.path === path) ?? operationOf('getServiceHealth')));
      const others = ['DELETE', 'PUT', 'PATCH', 'OPTIONS', 'HEAD', ...(['GET', 'POST'] as const).filter((method) => !methods.has(method))];
      for (const method of others) {
        const answer = await request(main, null, method, url, NOBODY, `a known path with the method ${method}`);
        expect([answer.status, answer.code], `${method} ${url}`).toEqual([405, 'METHOD_NOT_ALLOWED']);
        const allow = String(answer.response.headers[ALLOW_HEADER_NAME] ?? '')
          .split(',')
          .map((method_) => method_.trim())
          .filter((method_) => method_ !== '')
          .sort();
        expect(allow, `${method} ${url}`).toEqual([...methods].sort());
        refused += 1;
      }
    }
    console.info(`[w52] 405: ${refused} requests over ${paths.size} paths (DELETE, PUT, PATCH, OPTIONS, HEAD and the method of GET and POST the path does not have), each with \`allow\` equal to the path's methods`);
    // The one route outside the registry answers another method the same way.
    const channel = await request(main, null, 'POST', WS_PATH, NOBODY, 'the channel route with the method POST');
    expect([channel.status, channel.code, channel.response.headers[ALLOW_HEADER_NAME]]).toEqual([405, 'METHOD_NOT_ALLOWED', 'GET']);

    // Answers this file does not judge by the contract (they are printed): the channel route
    // asked without an upgrade, and a body that is not sent as JSON.
    const aside = new Ledger(OPERATIONS);
    const probes: string[] = [];
    const facts = { epoch: main.app.engine.epoch, revision: main.app.engine.revision, cookieName: main.app.config.sessionCookieName };
    const plain = await main.app.inject({ method: 'GET', url: WS_PATH });
    const plainAnswer = aside.record({ operationId: null, method: 'GET', url: WS_PATH, caller: 'nobody', callerKind: 'public', note: 'the channel route without an upgrade', knownGap: 'outside the registry' }, plain, facts);
    probes.push(`GET ${WS_PATH} without an upgrade -> ${plainAnswer.status} ${plainAnswer.code}`);
    for (const contentType of ['text/plain', 'multipart/form-data; boundary=w52', 'application/x-www-form-urlencoded', 'application/octet-stream']) {
      fresh(main);
      const response = await main.app.inject({ method: 'POST', url: '/api/v1/settings', headers: { ...web.SUPERVISOR.headers, origin: WEB_ORIGIN, 'content-type': contentType }, payload: 'presentationMode=true' });
      const answer = aside.record({ operationId: 'updateSettings', method: 'POST', url: '/api/v1/settings', caller: web.SUPERVISOR.label, callerKind: 'web', note: `a body sent as ${contentType}`, knownGap: 'probe' }, response, facts);
      probes.push(`POST /api/v1/settings as ${contentType} -> ${answer.status} ${answer.code}; the validator says ${aside.gapVerdicts.at(-1)?.verdict}`);
    }
    console.info(`[w52] probes (headers, cookies and the 5xx rule judged; the contract verdict printed):\n${probes.map((line) => `[w52]   ${line}`).join('\n')}`);
    for (const problem of aside.problems) console.info(`[w52] PROBE PROBLEM ${problem.kind}: ${problem.text}`);
    expect(aside.problems).toEqual([]);

    fresh(main);
    const malformed = await request(main, null, 'GET', '/api/v1/evidence/%E0%A4%A', NOBODY, 'a path parameter that is no valid percent-encoding');
    expect([malformed.status, malformed.code]).toEqual([400, 'INVALID_PATH']);
    settle();
  });

  it('423 LOCKED on the three entry points that lock, with `lockedUntil` and `retryInMs`', async () => {
    const locks: string[] = [];
    /** Repeats a failing attempt until the entry point locks. The failure that locks answers 423 itself (known gaps W32-1, W41-3). */
    async function untilLocked(operationId: string, caller: Caller, payload: Record<string, unknown>, failure: string): Promise<void> {
      fresh(main);
      const statuses: string[] = [];
      for (let attempt = 1; attempt <= 12; attempt += 1) {
        const answer = await call(main, operationId, caller, `a failed attempt (${attempt})`, { payload });
        statuses.push(`${answer.status} ${answer.code}`);
        if (answer.status === 423) {
          expect(answer.code, operationId).toBe('LOCKED');
          const details = detailsOf(answer);
          expect(typeof details['lockedUntil'], operationId).toBe('number');
          expect(typeof details['retryInMs'], operationId).toBe('number');
          expect(Number(details['lockedUntil']), operationId).toBeGreaterThan(main.clock.now());
          break;
        }
        expect([answer.status, answer.code], `${operationId}, attempt ${attempt}`).toEqual([401, failure]);
      }
      locks.push(`${operationId}: ${statuses.join(', ')}`);
      expect(statuses.at(-1), operationId).toBe('423 LOCKED');
      // During the lock a valid attempt is not compared either.
    }
    await untilLocked('signIn', CONSOLE, { username: usernameOf('INVESTIGATOR'), password: 'not-the-password' }, 'INVALID_CREDENTIALS');
    const during = await expectCall(main, 'signIn', CONSOLE, 'the right password during the lock', { payload: { username: usernameOf('INVESTIGATOR'), password: DEMO_OPERATOR_PASSWORD } }, 423, 'LOCKED');
    expect(typeof detailsOf(during)['retryInMs']).toBe('number');
    const status = await expectCall(main, 'getSignInStatus', CONSOLE, 'the lock state of the locked console', {}, 200);
    expect(bodyOf<{ lockedUntil: number | null }>(status).lockedUntil).not.toBeNull();

    fresh(main);
    const issued = await expectCall(main, 'issuePairingCode', web.SUPERVISOR, 'a code to fail on', {}, 201);
    const code = bodyOf<{ code: string }>(issued).code;
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');
    await untilLocked('redeemPairingCode', UNPAIRED_DEVICE, { code: wrong, deviceName: 'Tablet', platform: 'android', appVersion: '0.2.0' }, 'INVALID_CODE');
    await untilLocked('signInWithBiometric', tablet.credential, { token: `bio_${'B'.repeat(43)}` }, 'INVALID_CREDENTIALS');
    console.info(`[w52] 423, the attempts until the lock (gaps W32-1 and W41-3, closed by W83: the contract says the failure that locks answers 423 itself):\n${locks.map((line) => `[w52]   ${line}`).join('\n')}`);
    fresh(main);
    await expectCall(main, 'cancelPairingCode', web.SUPERVISOR, 'the code is cancelled', {}, 204);
    settle();
  });

  it('429 RATE_LIMITED with `retry-after`: the request throttle, and the denial budget of an operator', async () => {
    fresh(main);
    // ID-P12: 30 requests in 60 s for a caller without a principal.
    const throttle: number[] = [];
    let limited: Answer | undefined;
    for (let sent = 1; sent <= 40 && limited === undefined; sent += 1) {
      const answer = await call(main, 'getAuthSession', NOBODY, `request ${sent} of a caller without a principal`);
      throttle.push(answer.status);
      if (answer.status === 429) limited = answer;
    }
    expect(limited?.code).toBe('RATE_LIMITED');
    expect(throttle.filter((status) => status === 401)).toHaveLength(30);
    expect(String(limited?.response.headers[RETRY_AFTER_HEADER_NAME])).toMatch(/^[1-9]\d*$/);
    // Health is not throttled away (spec §5.1 ID-P12; P11).
    await expectCall(main, 'getServiceHealth', NOBODY, 'health while the class bucket is used up', {}, 200);

    fresh(main);
    // ID-P13: 20 audited refusals of one key in 60 s; the 21st is answered 429 and writes no row.
    const budget: number[] = [];
    let spent: Answer | undefined;
    for (let sent = 1; sent <= 25 && spent === undefined; sent += 1) {
      const answer = await call(main, 'listUsers', web.INVESTIGATOR, `refusal ${sent} of one operator`);
      budget.push(answer.status);
      if (answer.status === 429) spent = answer;
    }
    expect(spent?.code).toBe('RATE_LIMITED');
    expect(budget.filter((status) => status === 403)).toHaveLength(20);
    expect(String(spent?.response.headers[RETRY_AFTER_HEADER_NAME])).toMatch(/^[1-9]\d*$/);
    // While the budget is used up, an allowed call of that operator answers 429 too (P11).
    await expectCall(main, 'getRoleMatrix', web.INVESTIGATOR, 'an allowed read while the denial budget is used up', {}, 429, 'RATE_LIMITED');
    console.info(`[w52] 429: the throttle answered ${throttle.length - 1} requests and refused the next; the denial budget wrote ${budget.length - 1} refusals and refused the next`);
    fresh(main);
    settle();
  });

  it('403 DEMO_DISABLED: the five demo operations on a server whose demo flag is off; 403 NOT_PERMITTED on the six operations whose permission every seeded role holds, with the grant taken away in the clone', async () => {
    const target = await db.another({ slug: 'w52off' });
    const off = await startServer('demo flag off', target, { demoControls: false });
    target.onCleanup(() => off.app.close());
    const supervisor = await signInWeb(off, 'SUPERVISOR');
    expect(bodyOf<{ demoControls: boolean }>(await expectCall(off, 'getAuthSession', supervisor, 'the flag as the session reports it', {}, 200)).demoControls).toBe(false);
    const demo = OPERATIONS.filter((operation) => (operation.access.conditions ?? []).some((condition) => condition === CoreApiAccessCondition.DEMO_FLAG));
    expect(demo).toHaveLength(5);
    for (const operation of demo) {
      const payload = operation.requestBody === undefined ? {} : { payload: exampleBody(operation) };
      await expectCall(off, operation.operationId, supervisor, 'a holder of DEMO_CONTROL while the flag is off', payload, 403, 'DEMO_DISABLED');
      // §7.3 line 7: the permission is decided before the flag.
      await expectCall(off, operation.operationId, NOBODY, 'no credential while the flag is off', payload, 401, 'NOT_SIGNED_IN');
    }
    const investigator = await signInWeb(off, 'INVESTIGATOR');
    await expectCall(off, 'getDemoStatus', investigator, 'a role without DEMO_CONTROL while the flag is off', {}, 403, 'NOT_PERMITTED');

    // Finding F49: every seeded role holds EVIDENCE_VIEW and DIAGNOSTICS_RUN, so six operations
    // have no denied caller on a seeded server. The grants are read from PostgreSQL with every
    // request (RB-2): taken away in THIS clone, as `dems_owner`, the next request is refused.
    const everyRole = OPERATIONS.filter((operation) => {
      const permissions = coreApiAccessPermissions(operation.access);
      return permissions.length > 0 && ROLES.every((role) => holdsOneOf(role, permissions));
    });
    // The six of the base, and the three of schema v2 that need EVIDENCE_VIEW alone (operations 84,
    // 86 and 88; the pin read the six only). The three are called below like the others: their
    // routes have landed (88 with row 90, 84 and 86 with integration pass D4), so the guard answers.
    expect(everyRole.map((operation) => operation.operationId)).toEqual([
      'listEvidence',
      'getEvidence',
      'verifyEvidence',
      'testDeviceSignal',
      'identifyDevice',
      'runDiagnostics',
      'getTranscript',
      'listTranscriptRevisions',
      'createEvidenceMediaSession',
    ]);
    for (const permission of ['EVIDENCE_VIEW', 'DIAGNOSTICS_RUN']) {
      const removed = await target.ownerPool().query('DELETE FROM public.role_permissions WHERE role_id = $1 AND permission_id = $2', ['INVESTIGATOR', permission]);
      expect(removed.rowCount, permission).toBe(1);
    }
    fresh(off);
    for (const operation of everyRole) await expectCall(off, operation.operationId, investigator, `the INVESTIGATOR without the grant of ${describeCoreApiAccess(operation.access)}`, {}, 403, 'NOT_PERMITTED');
    // The SUPERVISOR's grants were not touched.
    await expectCall(off, 'listEvidence', supervisor, 'a role that still holds the grant', {}, 200);
    settle();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 4. No GET handler writes (AC-B-09, SR-20)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-09, SR-20: no GET handler writes', () => {
  const counts = (state: TableState): { audit: number; events: number } => ({ audit: state.rows['audit_log'] ?? -1, events: state.rows['events'] ?? -1 });

  it('every GET operation, as each kind of caller its rule lets through: the audit count, the event count and the digest of every table are equal before and after', async () => {
    fresh(main);
    const reads = OPERATIONS.filter((operation) => operation.method === 'get');
    // The 36 GET operations of the registry (the pin read 27, the base's; AC-B-09's first block holds 36 / 61).
    expect(reads).toHaveLength(36);
    // Operations 82 and 83 read the OPEN session, and 83 one whose sealing has started: a session is
    // recorded and sealed for this walk (before the first reading) and its summary is acknowledged
    // after it. Operations 84 and 86 read the REAL item with a sealed transcript.
    const openForRead = await expectCall(main, 'createSession', web.INVESTIGATOR, 'a session is open for the reads', { payload: { caseNumber: 'LP/2026/1001-0082', subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId: operatorIdOf('INVESTIGATOR'), room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } }, 201);
    const openSessionId = bodyOf<{ sessionId: string }>(openForRead).sessionId;
    await expectCall(main, 'startSession', web.INVESTIGATOR, 'the first start begins the pre-check', { id: openSessionId }, 202);
    await main.drive(PRECHECK_MS);
    await expectCall(main, 'startSession', web.INVESTIGATOR, 'the armed session starts to record', { id: openSessionId }, 200);
    await main.drive(3 * SECOND);
    await expectCall(main, 'stopSession', web.INVESTIGATOR, 'the recording is stopped', { id: openSessionId, payload: { reason: 'Interview completed' } }, 202);
    await main.drive(FINALIZE_MS);
    const transcriptEvidenceId = transcriptItem?.evidenceId ?? '';
    expect(transcriptEvidenceId).not.toBe('');
    const ids: Readonly<Record<string, string>> = { getEvidence: sealedEvidenceId, listAudioSourceIntervals: openSessionId, getSealingProgress: openSessionId, getEvidenceExportJob: exportJobId, getTranscript: transcriptEvidenceId, listTranscriptRevisions: transcriptEvidenceId };
    const queries: Readonly<Record<string, string>> = { listSessionHistory: '?limit=200', listEvidence: '?limit=200&q=LP', listAuditRows: '?limit=200&order=DESC', listEvents: '?limit=200' };
    // Each caller has sent a request at this instant of the standing clock: what stage 4 writes
    // once a minute for a paired device (pairing row DN-8) is written before the first reading.
    await expectCall(main, 'getDeviceRegistration', tablet.credential, 'a request of the tablet, before the readings', {}, 200);
    await expectCall(main, 'getAuthSession', tabletSession, 'a request of the tablet session, before the readings', {}, 200);
    await expectCall(main, 'touchSession', web.SUPERVISOR, 'activity of the web session, before the readings', {}, 200);
    await main.app.pipeline.drain();

    const lines: string[] = [];
    let compared = 0;
    try {
      for (const operation of reads) {
        const callers = [allowedCaller(operation)];
        // The reads any operator may call are read from the tablet session too (a bearer value, stage 4's device path).
        if (operation.access.kind === CoreApiAccessKind.AUTHENTICATED) callers.push(tabletSession);
        for (const caller of callers) {
          const before = await readTables(owner());
          const answer = await call(main, operation.operationId, caller, 'a read between two readings of every table', { id: ids[operation.operationId] ?? exampleId(operation), query: queries[operation.operationId] ?? '' });
          await main.app.pipeline.drain();
          const after = await readTables(owner());
          expect(answer.status, `${operation.operationId} as ${caller.label}`).toBe(200);
          expect(movedTables(before, after), `${operation.operationId} as ${caller.label}`).toEqual([]);
          expect(counts(after), `${operation.operationId} as ${caller.label}`).toEqual(counts(before));
          compared += 1;
          if (caller === callers[0]) lines.push(`${operation.operationId} (${Object.keys(after.digests).length} tables, audit ${counts(after).audit}, events ${counts(after).events})`);
        }
      }
      console.info(`[w52] no GET handler writes: ${compared} reads of ${reads.length} GET operations, every table of schema public digested before and after each:\n[w52]   ${lines.join('; ')}`);
    } finally {
      // Whatever a read answered, the session of this walk does not stay open for the blocks that follow.
      // Nor does the REAL package of the transcript walk stay in the media store, which this file's servers share:
      // the reset block below runs the real routine on another database, whose guard would find a package
      // without an item of its own and refuse (fail-safe, by design). No block after this one reads a transcript.
      transcriptItem?.remove();
      await expectCall(main, 'acknowledgeSessionSummary', web.INVESTIGATOR, 'the summary of the session of the reads is acknowledged', { id: openSessionId }, 204);
    }
    expect(compared).toBeGreaterThanOrEqual(27);
    settle();
  });

  it('a refused GET writes what the guard writes and nothing else; the one write of stage 4 on a GET is named: `paired_devices.last_seen_at`, at most once a minute', async () => {
    fresh(main);
    // A 401 writes nothing at all.
    let before = await readTables(owner());
    await expectCall(main, 'listUsers', NOBODY, 'no credential', {}, 401, 'NOT_SIGNED_IN');
    expect(movedTables(before, await readTables(owner()))).toEqual([]);

    // The engine's own ticks write when the timer fires; the test fires it here and reads afterwards.
    await main.drive(61 * SECOND, SECOND);
    await main.app.pipeline.drain();
    before = await readTables(owner());
    await expectCall(main, 'getDeviceRegistration', tablet.credential, 'the first request of the tablet in a new minute', {}, 200);
    await main.app.pipeline.drain();
    const moved = movedTables(before, await readTables(owner()));
    console.info(`[w52] the first GET of a paired device in a new minute moves: ${JSON.stringify(moved)} (pairing row DN-8: last_seen_at, written by stage 4, not by a handler)`);
    expect(moved).toEqual(['paired_devices']);
    // The second one of that minute moves nothing.
    before = await readTables(owner());
    await expectCall(main, 'getDeviceRegistration', tablet.credential, 'the second request of the tablet in that minute', {}, 200);
    await main.app.pipeline.drain();
    expect(movedTables(before, await readTables(owner()))).toEqual([]);
    // A web session's read in a new minute moves nothing either.
    before = await readTables(owner());
    await expectCall(main, 'getRoleMatrix', web.SUPERVISOR, 'a read of a web session in a new minute', {}, 200);
    await main.app.pipeline.drain();
    expect(movedTables(before, await readTables(owner()))).toEqual([]);
    settle();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 5. The text rule API-13 (AC-B-93, SR-64)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-93, API-13: free text with U+0000 or an unpaired surrogate answers 422 INVALID_INPUT and writes no row', () => {
  const NUL = '\u0000';
  const HIGH = '\ud83d';
  /** The two values of the rule, inside ordinary text. */
  const ILL_FORMED: ReadonlyArray<readonly [name: string, value: string]> = [
    ['U+0000', `Interview${NUL}completed`],
    ['an unpaired surrogate', `Interview ${HIGH} completed`],
  ];
  const members = textMembers(OPERATIONS);
  const freeText = members.filter((member) => member.freeText);

  it('the free-text members, found mechanically in the request schemas of the registry', () => {
    const byOperation = new Map<string, string[]>();
    for (const member of freeText) byOperation.set(member.operationId, [...(byOperation.get(member.operationId) ?? []), `${member.where}.${member.path.join('.')}`]);
    console.info(
      `[w52] API-13: ${members.length} string members in the request and query schemas of ${new Set(members.map((member) => member.operationId)).size} operations; ` +
        `${freeText.length} are free text, in ${byOperation.size} operations:\n${[...byOperation].map(([operationId, paths]) => `[w52]   ${operationId}: ${paths.join(', ')}`).join('\n')}`,
    );
    console.info(`[w52] API-13: bound by a pattern (no rule of their own): ${members.filter((member) => !member.freeText).map((member) => `${member.operationId} ${member.where}.${member.path.join('.')}`).join(', ')}`);
    // The three the criterion names are among them.
    expect(byOperation.get('addSessionNote')).toEqual(['body.text']);
    expect(byOperation.get('revokeDevice')).toEqual(['body.reason']);
    expect(byOperation.get('redeemPairingCode')).toEqual(['body.deviceName', 'body.platform', 'body.appVersion']);
    expect(freeText.length).toBeGreaterThanOrEqual(20);
  });

  it('addSessionNote, revokeDevice and redeemPairingCode (the three of AC-B-93), then EVERY free-text member of the registry: 422 INVALID_INPUT, and no table moves', async () => {
    fresh(main);
    // Each caller is active at this instant, so nothing but a handler could write (see block 4).
    await expectCall(main, 'getDeviceRegistration', tablet.credential, 'a request of the tablet, before the readings', {}, 200);
    for (const role of ROLES) await expectCall(main, 'touchSession', web[role], 'activity, before the readings', {}, 200);
    await expectCall(main, 'touchSession', tabletSession, 'activity, before the readings', {}, 200);
    await main.app.pipeline.drain();

    // What makes the refusal count: without the ill-formed text each request below WOULD write. A
    // session records, a pairing code is active, the tablet is paired, the evidence can be exported.
    await main.app.engine.setTabletLink('CONNECTED');
    const investigator = web.INVESTIGATOR;
    const created = await expectCall(main, 'createSession', investigator, 'a session for the notes', { payload: { caseNumber: 'LP/2026/1001-0099', subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId: operatorIdOf('INVESTIGATOR'), room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } }, 201);
    const recordingId = bodyOf<{ sessionId: string }>(created).sessionId;
    await expectCall(main, 'startSession', investigator, 'the first start begins the pre-check', { id: recordingId }, 202);
    await main.drive(PRECHECK_MS);
    await expectCall(main, 'startSession', investigator, 'the armed session starts to record', { id: recordingId }, 200);
    await main.drive(2 * SECOND);
    const issued = await expectCall(main, 'issuePairingCode', web.SUPERVISOR, 'a code that could be redeemed', {}, 201);
    const evidence = await expectCall(main, 'listEvidence', web.SUPERVISOR, 'the items, for one that can be exported', { query: '?limit=200' }, 200);
    const exportable = bodyOf<{ items: Array<{ id: string; status: string }> }>(evidence).items.find((item) => item.status === 'SEALED')?.id ?? '';
    expect(exportable).not.toBe('');
    const ids: Readonly<Record<string, string>> = {
      stopSession: recordingId,
      addSessionMarker: recordingId,
      addSessionNote: recordingId,
      revokeDevice: tablet.deviceId,
      exportEvidence: exportable,
      assignUserRole: operatorIdOf('TECHNICIAN'),
      enableUser: operatorIdOf('TECHNICIAN'),
      disableUser: operatorIdOf('TECHNICIAN'),
    };
    const bases: Readonly<Record<string, Record<string, unknown>>> = {
      redeemPairingCode: { code: bodyOf<{ code: string }>(issued).code, deviceName: 'Interview tablet 04', platform: 'android', appVersion: '0.2.0' },
      signIn: { username: usernameOf('SUPERVISOR'), password: DEMO_OPERATOR_PASSWORD },
      createSession: { caseNumber: 'LP/2026/1001-0098', subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId: operatorIdOf('INVESTIGATOR'), room: 'Interview Room 1', profileId: 'STANDARD_1080P25' },
    };
    for (const role of ROLES) await expectCall(main, 'touchSession', web[role], 'activity, before the readings', {}, 200);
    await main.app.pipeline.drain();

    const ordered = [...freeText].sort((a, b) => Number(['addSessionNote', 'revokeDevice', 'redeemPairingCode'].includes(b.operationId)) - Number(['addSessionNote', 'revokeDevice', 'redeemPairingCode'].includes(a.operationId)));
    const lines: string[] = [];
    let refused = 0;
    for (const member of ordered) {
      const operation = operationOf(member.operationId);
      const caller = allowedCaller(operation);
      for (const [name, value] of ILL_FORMED) {
        fresh(main);
        const before = await readTables(owner());
        let answer: Answer;
        if (member.where === 'body') {
          const base = bases[member.operationId] ?? exampleBody(operation);
          answer = await expectCall(main, member.operationId, caller, `${member.path.join('.')} with ${name}`, { id: ids[member.operationId] ?? exampleId(operation), payload: withMember(base, member.path, value) }, 422, 'INVALID_INPUT');
        } else {
          // A query value travels percent-encoded: U+0000 as %00. An unpaired surrogate has no
          // percent-encoding (the WHATWG encoder writes U+FFFD for it), so only the first value
          // can reach the server in a URL.
          if (name !== 'U+0000') continue;
          answer = await expectCall(main, member.operationId, caller, `${member.path.join('.')} with ${name}`, { query: `?${member.path.join('.')}=Interview%00completed` }, 422, 'INVALID_INPUT');
        }
        await main.app.pipeline.drain();
        const after = await readTables(owner());
        expect(movedTables(before, after), describeSent(answer)).toEqual([]);
        expect([after.rows['audit_log'], after.rows['events']], describeSent(answer)).toEqual([before.rows['audit_log'], before.rows['events']]);
        refused += 1;
        lines.push(`${member.operationId} ${member.where}.${member.path.join('.')} (${name}): ${answer.status} ${answer.code}`);
      }
    }
    console.info(`[w52] API-13: ${refused} refused requests, every table of schema public equal before and after each:\n${lines.map((line) => `[w52]   ${line}`).join('\n')}`);
    expect(refused).toBe(freeText.filter((member) => member.where === 'body').length * 2 + freeText.filter((member) => member.where === 'query').length);
    // Nothing of what could have been written was: the tablet is paired, the code is active and
    // unused, the session records without a note or a marker.
    await expectCall(main, 'getDeviceRegistration', tablet.credential, 'the tablet whose revocation was refused', {}, 200);
    const code = await expectCall(main, 'getPairingCodeStatus', web.SUPERVISOR, 'the code whose redeem was refused', {}, 200);
    expect(bodyOf<{ active: { codeId: string; attemptsRemaining: number } | null }>(code).active).toMatchObject({ codeId: bodyOf<{ codeId: string }>(issued).codeId, attemptsRemaining: bodyOf<{ attemptsAllowed: number }>(issued).attemptsAllowed });
    const session = await expectCall(main, 'getCurrentSession', investigator, 'the session whose notes were refused', {}, 200);
    expect(bodyOf<{ session: { id: string; state: string } | null }>(session).session).toMatchObject({ id: recordingId, state: 'RECORDING' });
    // The same requests with well-formed text are accepted: the refusal was the text's.
    await expectCall(main, 'addSessionNote', investigator, 'the same note, well formed', { id: recordingId, payload: { text: 'Interview completed' } }, 204);
    await expectCall(main, 'cancelPairingCode', web.SUPERVISOR, 'the code is cancelled', {}, 204);
    await expectCall(main, 'stopSession', investigator, 'the recording is stopped', { id: recordingId, payload: { reason: 'Interview completed' } }, 202);
    await main.drive(FINALIZE_MS);
    await expectCall(main, 'acknowledgeSessionSummary', investigator, 'the summary is acknowledged', { id: recordingId }, 204);
    settle();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 6. Bulk data: every page of every list validates (decision D64; DF-1 not taken)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-10 on the bulk template: every page of every list validates', () => {
  it('the four lists are walked to their end as a seeded operator; every page validates and no row comes twice', async () => {
    const target = await db.another({ template: 'bulk', slug: 'w52bulk' });
    const bulk = await startServer('bulk', target, { demoControls: false, at: BULK_TEMPLATE_NOW });
    target.onCleanup(() => bulk.app.close());
    const supervisor = await signInWeb(bulk, 'SUPERVISOR');
    const walked: string[] = [];
    for (const [operationId, key] of [['listSessionHistory', 'id'], ['listEvidence', 'id'], ['listAuditRows', 'seq'], ['listEvents', 'seq']] as const) {
      const seen = new Set<string>();
      let cursor: string | null = null;
      let pages = 0;
      do {
        fresh(bulk);
        const query: string = `?limit=200${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}`;
        const page: Answer = await expectCall(bulk, operationId, supervisor, `page ${pages + 1}`, { query }, 200);
        const body = bodyOf<{ items?: Array<Record<string, unknown>>; rows?: Array<Record<string, unknown>>; events?: Array<Record<string, unknown>>; nextCursor: string | null }>(page);
        const rows = body.items ?? body.rows ?? body.events ?? [];
        for (const row of rows) {
          const id = String(row[key] ?? row['id']);
          expect(seen.has(id), `${operationId}: ${id} twice`).toBe(false);
          seen.add(id);
        }
        cursor = body.nextCursor;
        pages += 1;
      } while (cursor !== null && pages < 60);
      expect(cursor, `${operationId}: the walk ended`).toBeNull();
      walked.push(`${operationId}: ${seen.size} rows in ${pages} pages`);
    }
    for (const operationId of ['getStorageDetail', 'getSecurityStatus', 'verifyAuditChain', 'listAlerts', 'getDeviceInventory', 'getSystemStatus', 'listPairedDevices', 'listUsers']) {
      await expectCall(bulk, operationId, supervisor, 'a read on the bulk template', {}, 200);
    }
    // AC-B-70 on every item of the bulk template: its detail lists exactly the two audio tracks.
    const list = await expectCall(bulk, 'listEvidence', supervisor, 'the first page again', { query: '?limit=200' }, 200);
    const sample = bodyOf<{ items: Array<{ id: string }> }>(list).items.filter((_, index) => index % 10 === 0);
    for (const item of sample) {
      fresh(bulk);
      await expectCall(bulk, 'getEvidence', supervisor, 'the detail of an item of the bulk template', { id: item.id }, 200);
    }
    // Known difference SIM-GAP-W39-1 (decision D102 DN-2), printed and not pinned: the answer counts the stored chain, the audit row the simulator's ring.
    fresh(bulk);
    const exported = await expectCall(bulk, 'exportAudit', supervisor, 'an export over the long chain', { payload: { reason: 'Quarterly audit review by the supervisor' } }, 202);
    const newest = await expectCall(bulk, 'listAuditRows', supervisor, 'the row of that export', { query: '?order=DESC&limit=1' }, 200);
    const exportRow = bodyOf<{ rows: Array<{ type: string; details: Record<string, unknown> }> }>(newest).rows[0];
    console.info(`[w52] known difference SIM-GAP-W39-1: exportAudit answers rows ${bodyOf<{ rows: number }>(exported).rows}; its ${exportRow?.type} row says details.rows ${JSON.stringify(exportRow?.details['rows'])}`);
    console.info(`[w52] bulk template: ${walked.join('; ')}; ${sample.length} evidence details`);
    settle();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 7. The two operations that rebuild the database (operations 72 and 75), and the 503 of a reset
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('operations 72 and 75: a scenario load and a reset, through the real routine on this file\'s own clone', () => {
  let maintenance: Pool | undefined;
  let resetter: Server | undefined;
  let names: string[] = [];

  afterAll(async () => {
    await resetter?.app.close();
    if (maintenance === undefined) return;
    // A plain removal of this block's own databases, before the helper's forced one.
    for (const name of [...names].reverse()) await dropOwn(maintenance, name, db.run.identity.prefix);
    await maintenance.end();
  });

  it('loadScenario answers 200 with the new epoch, resetDemo too; while the database is rebuilt every other request answers 503 NOT_READY and health answers 200', async () => {
    const target = await db.another({ slug: 'w52r' });
    names = [target.name, `${target.name}_next`, `${target.name}_prev`];
    maintenance = maintenancePool(db.run.dataDir);
    const server = await startServer('reset', target, { demoControls: true });
    resetter = server;
    const supervisor = await signInWeb(server, 'SUPERVISOR');
    const during: Answer[] = [];
    useRoutine(
      server.app,
      testRoutine(target, {
        runPrefix: db.run.identity.prefix,
        applicationName: resetApplicationName(db.run.identity.stamp, 'w52r'),
        maintenance,
        async onCheckpoint() {
          during.push(await call(server, 'getDemoStatus', supervisor, 'another request while a reset runs'));
          during.push(await call(server, 'getServiceHealth', NOBODY, 'health while a reset runs'));
        },
      }),
    );

    // Pass D6 (coverage cell `resetDemo 409`): a database that holds a REAL sealed item is never
    // reset. FIRST in this block, while the owner pool still names this database (a rebuild swaps
    // databases under a pool). A sealed item of the seed is marked REAL / version 2 by `dems_owner`
    // (the reset guard reads the tables); the reset is refused, nothing is rebuilt, and the mark is
    // taken back so the two rebuilds below run as before.
    const ownerPool = target.ownerPool();
    const seededItem = (await ownerPool.query<{ id: string; integrity_source: string; manifest_version: number }>('SELECT id, integrity_source, manifest_version FROM public.evidence_items WHERE sealed_at IS NOT NULL ORDER BY id LIMIT 1')).rows[0];
    if (seededItem === undefined) throw new Error('the clone holds no sealed evidence item');
    await ownerPool.query("UPDATE public.evidence_items SET integrity_source = 'REAL', manifest_version = 2 WHERE id = $1", [seededItem.id]);
    // Pass D10 (pass D6 finding F-D6-1, closed): the module answers the guard's refusal with the
    // documented code. Pass D11: the module asks the guard on its OWN pool BEFORE the routine and
    // the quiesce, so a refused reset stops nothing - the epoch is the same, no request met a 503
    // meanwhile - and it is audited (C3 §3 op 75 "refuses ... and audits the refusal").
    const epochBeforeRefusal = server.app.engine.epoch;
    await expectCall(server, 'resetDemo', supervisor, 'a reset of a database that holds real sealed evidence', {}, 409, 'RESET_BLOCKED_REAL_EVIDENCE');
    expect(server.app.engine.epoch).toBe(epochBeforeRefusal);
    expect(server.app.readiness.isReady()).toBe(true);
    const refusalPage = await expectCall(server, 'listAuditRows', supervisor, 'the newest rows after the refused reset', { query: '?order=DESC&limit=5' }, 200);
    expect(bodyOf<{ rows: Array<{ type: string; details: Record<string, unknown> }> }>(refusalPage).rows.find((row) => row.type === 'ACCESS_DENIED')?.details).toMatchObject({ operationId: 'resetDemo', reason: 'RESET_BLOCKED_REAL_EVIDENCE' });
    // Nothing was rebuilt: the mark is still on the row of THIS database (a rebuilt seed would not carry it).
    expect((await target.ownerPool().query("SELECT count(*)::int AS n FROM public.evidence_items WHERE id = $1 AND integrity_source = 'REAL'", [seededItem.id])).rows[0]?.n).toBe(1);
    await target.ownerPool().query('UPDATE public.evidence_items SET integrity_source = $2, manifest_version = $3 WHERE id = $1', [seededItem.id, seededItem.integrity_source, seededItem.manifest_version]);
    during.length = 0;

    const epoch = server.app.engine.epoch;
    // Two cursors of the chain before the rebuild: one on a row of the seed, which the rebuilt
    // chain holds again with the same hash, and one on the newest row, which only this chain has.
    const seedPage = await expectCall(server, 'listAuditRows', supervisor, 'a page of the chain before the rebuild, from its start', { query: '?limit=10' }, 200);
    const seedCursor = bodyOf<{ nextCursor: string | null }>(seedPage).nextCursor ?? '';
    const newestPage = await expectCall(server, 'listAuditRows', supervisor, 'a page of the chain before the rebuild, from its end', { query: '?order=DESC&limit=1' }, 200);
    const staleCursor = bodyOf<{ nextCursor: string | null }>(newestPage).nextCursor ?? '';
    expect([seedCursor, staleCursor]).not.toContain('');
    /** `details.reset` of the newest SCENARIO_LOADED row (drift DR-10: the key is always there). */
    const loadedRow = async (note: string): Promise<unknown> => {
      const page = await expectCall(server, 'listAuditRows', supervisor, note, { query: '?order=DESC&limit=20' }, 200);
      return bodyOf<{ rows: Array<{ type: string; details: Record<string, unknown> }> }>(page).rows.find((row) => row.type === 'SCENARIO_LOADED')?.details['reset'];
    };
    const loaded = await expectCall(server, 'loadScenario', supervisor, 'the scenario `recording` is loaded', { payload: { name: 'recording' } }, 200);
    expect(bodyOf<{ epoch: number }>(loaded).epoch).toBe(epoch + 1);
    const afterLoad = await loadedRow('the newest rows after the scenario load');
    // Gap W39-1, closed by W83 (the 422 text says it): a cursor on a row the rebuilt chain does not hold is no cursor any more.
    await expectCall(server, 'listAuditRows', supervisor, 'a cursor of the chain that the rebuild discarded', { query: `?limit=10&cursor=${encodeURIComponent(staleCursor)}` }, 422, 'INVALID_INPUT');
    await expectCall(server, 'listAuditRows', supervisor, 'a cursor on a row of the seed, which the rebuilt chain holds again', { query: `?limit=10&cursor=${encodeURIComponent(seedCursor)}` }, 200);
    const status = await expectCall(server, 'getDemoStatus', supervisor, 'the loaded scenario', {}, 200);
    expect(bodyOf<{ scenario: string }>(status).scenario).toBe('recording');
    const reset = await expectCall(server, 'resetDemo', supervisor, 'the demo is reset', {}, 200);
    expect(bodyOf<{ epoch: number }>(reset).epoch).toBe(epoch + 2);
    const afterReset = await loadedRow('the newest rows after the reset');
    console.info(`[w52] drift DR-10: SCENARIO_LOADED carries details.reset ${JSON.stringify(afterLoad)} after a scenario load and ${JSON.stringify(afterReset)} after a reset`);
    expect([afterLoad, afterReset]).toEqual([false, true]);
    // Sessions are kept by a reset: the same cookie still names the SUPERVISOR.
    await expectCall(server, 'getAuthSession', supervisor, 'the session that was open before the two rebuilds', {}, 200);

    const refused = during.filter((answer) => answer.operationId === 'getDemoStatus' && answer.status === 503);
    const health = during.filter((answer) => answer.operationId === 'getServiceHealth');
    console.info(`[w52] during the two rebuilds: ${during.length} requests; getDemoStatus ${JSON.stringify(during.filter((answer) => answer.operationId === 'getDemoStatus').map((answer) => answer.status))}; health ${JSON.stringify(health.map((answer) => answer.status))}`);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((answer) => answer.code === 'NOT_READY')).toBe(true);
    expect(health.every((answer) => answer.status === 200)).toBe(true);

    settle();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 8. What the whole file received
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Documented statuses this file does not produce, with the reason. A status listed here that WAS
 * produced fails the last block, so the table cannot go stale.
 */
// Task 4 (blueprint row 63): every documented status of the two unrouted operations, by the list
// `LANDED_UNROUTED` itself - no entry is written by hand, and row 70 empties it with that list.
// Task 4 (blueprint row 94; fix pass I-5): a documented RESPONSE of a ROUTED operation that landed
// in the contract before the Core can answer it, each waiting for a named row. Operation 93 documents
// 422 for a typed `address` it refuses; the live Core accepts and ignores that optional member until
// row 96 builds the typed-address probe. Row 96 produces the 422 in this file and takes the entry out:
// the coverage block names the exact list, fails on an unproduced status that is not on it, and fails
// when a listed one is produced, so no entry outlives its row silently.
//   93 startCaptureDiscovery 422      task 4 row 96
const LANDED_UNANSWERED: Readonly<Record<string, string>> = {
  'startCaptureDiscovery 422': 'the Core ignores `address` until task 4 row 96 (LANDED_UNANSWERED)',
};
const NOT_PRODUCED: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    UNROUTED_OPERATIONS.flatMap((operation) => listCoreApiResponseStatuses(operation, 'all').map((status) => [`${operation.operationId} ${status}`, 'no route until task 4 row 70 (LANDED_UNROUTED)'])),
  ),
  ...LANDED_UNANSWERED,
};

/**
 * Error codes the server answers that the registry does not name for that operation and status,
 * each one a contract gap a row ALREADY reported. A mismatch that is not listed fails the block.
 * Emptied by the contract close-out W83 (decision D184): the seven entries it held (`stopSession`
 * and `exportEvidence` 422 `INVALID_INPUT`; `DEVICE_NOT_PAIRED` on operations 21, 22, 23, 8 and 9)
 * are now named by the registry, so the block itself proves the close-out.
 */
const KNOWN_CODE_GAPS: Readonly<Record<string, string>> = {};

describe('SC6: what the whole file received', () => {
  it('AC-B-70: every answer that lists audio lists exactly the two session tracks or the two mic inputs (SH-17)', () => {
    // Schema v2 re-keys the audio READS by the physical inputs (C3 §3, ops 44/45: `audio[]` and
    // `channels[]` carry `inputId` MIC-01/MIC-02, never merged), while the session tracks stay
    // AUDIO-01/AUDIO-02. A list of either kind must carry both members in order and nothing else.
    const lists: Array<{ operationId: string; path: string; ids: string[] }> = [];
    const walk = (value: unknown, path: string, answer: Answer): void => {
      if (Array.isArray(value)) {
        const ids = value.flatMap((element: unknown) => {
          if (typeof element !== 'object' || element === null) return [];
          const record = element as Record<string, unknown>;
          // An audio-source INTERVAL names the one microphone that fed the track over a span of
          // media time (operation 82; the item's `audioSourceIntervals`): a list of intervals is a
          // history, not a list of the two tracks or the two inputs, and is not held to the pair rule.
          if ('fromMs' in record && 'seq' in record) return [];
          return [record['trackId'], record['inputId'], record['id']].filter(
            (id): id is string => typeof id === 'string' && (id.startsWith('AUDIO-') || id.startsWith('MIC-')),
          );
        });
        if (ids.length > 0) lists.push({ operationId: answer.operationId ?? '', path, ids });
        value.forEach((element, index) => walk(element, `${path}[${index}]`, answer));
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, member] of Object.entries(value)) walk(member, path === '' ? key : `${path}.${key}`, answer);
      }
    };
    for (const answer of ledger.answers) if (answer.status >= 200 && answer.status < 300) walk(answer.body, '', answer);
    const byPlace = new Map<string, number>();
    for (const list of lists) {
      const place = `${list.operationId} ${list.path.replace(/\[\d+\]/g, '[]')}`;
      byPlace.set(place, (byPlace.get(place) ?? 0) + 1);
      const pair = JSON.stringify(list.ids);
      expect(pair === '["AUDIO-01","AUDIO-02"]' || pair === '["MIC-01","MIC-02"]', `${list.operationId} ${list.path}: ${pair}`).toBe(true);
    }
    console.info(`[w52] AC-B-70: ${lists.length} lists of audio (tracks or inputs) in the answers of this file, each the ordered pair:\n${[...byPlace].map(([place, count]) => `[w52]   ${place}: ${count}`).join('\n')}`);
    // The reads that list audio were all among them: the input-keyed reads and the track-keyed one.
    for (const operationId of ['getAudioStatus', 'getDeviceHealth', 'getEvidence']) expect([...byPlace.keys()].some((place) => place.startsWith(`${operationId} `)), operationId).toBe(true);
    expect(lists.length).toBeGreaterThan(50);
  });

  it('finding F66: the audio levels of operations 44 and 45 are inside the contract\'s bounds; the server\'s values are printed', () => {
    const levels = ledger.answers
      .filter((answer) => (answer.operationId === 'getAudioStatus' || answer.operationId === 'getDeviceHealth') && answer.status === 200)
      .flatMap((answer) => {
          const body = bodyOf<{ channels?: Array<{ trackId?: string; inputId?: string; dbfs: number; peak: number }>; audio?: Array<{ trackId?: string; inputId?: string; dbfs: number; peak: number }> }>(answer);
        return (body.channels ?? body.audio ?? []).map((channel) => `${channel.trackId ?? channel.inputId} ${channel.dbfs}/${channel.peak}`);
      });
    console.info(`[w52] finding F66: dbfs/peak of the audio reads in this file: ${JSON.stringify([...new Set(levels)].sort())}`);
    expect(levels.length).toBeGreaterThan(0);
  });

  it('AC-B-10, AC-B-14, SR-76: every answer validated against the contract and carried the five headers of OR-9; no 500; API-7 on every 2xx POST; the cookie rule', () => {
    const counts = ledger.statusCounts();
    console.info(`[w52] answers received: ${ledger.answers.length}; by status ${JSON.stringify(counts)}`);
    console.info(`[w52] judged: ${JSON.stringify(ledger.judged)}`);
    for (const problem of ledger.problems) console.info(`[w52] PROBLEM ${problem.kind}: ${problem.text}`);
    expect(ledger.problems).toEqual([]);
    expect(ledger.answers.length).toBeGreaterThan(600);
    // Each of these is produced once or more (the row's verification), and none is a 500.
    for (const status of [401, 403, 404, 405, 409, 413, 422, 423, 429]) expect(counts[status] ?? 0, `status ${status}`).toBeGreaterThan(0);
    expect(counts[500] ?? 0).toBe(0);
    expect(ledger.judged.headers).toBe(ledger.answers.length);
    expect(ledger.judged.members).toBeGreaterThan(600);
    expect(ledger.judged.api7).toBeGreaterThan(80);
    expect(ledger.judged.cookieSet).toBeGreaterThan(5);
    expect(ledger.judged.cookieCleared).toBe(1);
  });

  it('the error codes: every code the server answered is one the registry names for that operation and status, or a contract gap a row already reported', () => {
    const unknown = ledger.codeMismatches.filter((entry) => KNOWN_CODE_GAPS[`${entry.operationId} ${entry.status} ${entry.code}`] === undefined);
    for (const entry of ledger.codeMismatches) {
      const gap = KNOWN_CODE_GAPS[`${entry.operationId} ${entry.status} ${entry.code}`];
      console.info(`[w52] code ${gap === undefined ? 'NOT NAMED (new)' : `gap ${gap}`}: ${entry.operationId} ${entry.status} answers ${entry.code}; the registry names ${JSON.stringify(entry.named)}`);
    }
    expect(unknown).toEqual([]);
    // Every error status the registry documents names a code at all.
    const nameless = OPERATIONS.flatMap((operation) => listCoreApiResponseStatuses(operation, 'all').filter((status) => status >= 400 && registryCodes(operation, status).length === 0).map((status) => `${operation.operationId} ${status}`));
    expect(nameless).toEqual([]);
  });

  it('the coverage: every documented status of every operation was produced, or is listed with the reason why not', () => {
    const cells = coverageOf(OPERATIONS, ledger, NOT_PRODUCED);
    const table = OPERATIONS.map((operation) => {
      const row = cells
        .filter((cell) => cell.operationId === operation.operationId)
        .map((cell) => (cell.codes === null ? `${cell.status} NOT PRODUCED${cell.reason === null ? '' : ` (${cell.reason})`}` : `${cell.status}${cell.codes.length > 0 ? ` ${cell.codes.join('|')}` : ''}`));
      return `[w52]   ${operation.operationId}: ${row.join('; ')}`;
    });
    const produced = cells.filter((cell) => cell.codes !== null).length;
    console.info(`[w52] coverage, operation by documented status (${produced} of ${cells.length} cells produced):\n${table.join('\n')}`);
    // Statuses an operation was answered with that it does not document: the envelope-level ones.
    const extra = OPERATIONS.flatMap((operation) => {
      const documented = listCoreApiResponseStatuses(operation, 'all');
      return [...ledger.produced(operation.operationId).keys()].filter((status) => !documented.includes(status)).map((status) => `${operation.operationId} ${status}`);
    });
    console.info(`[w52] envelope-level statuses received per operation (documented once, not per operation): ${JSON.stringify([...new Set(extra.map((entry) => entry.split(' ')[1]))].sort())} on ${new Set(extra.map((entry) => entry.split(' ')[0])).size} operations`);
    // Code by code: what an operation's own entry names for a status and this file did not produce (printed, not required).
    const unproduced = OPERATIONS.flatMap((operation) =>
      listCoreApiResponseStatuses(operation, 'all')
        .filter((status) => status >= 400)
        .flatMap((status) => {
          const answered = ledger.produced(operation.operationId).get(status) ?? new Set<string>();
          return ownCodes(operation, status).filter((code) => !answered.has(code)).map((code) => `${operation.operationId} ${status} ${code}`);
        }),
    );
    const byCode = new Map<string, number>();
    for (const entry of unproduced) byCode.set(entry.split(' ')[2] ?? '', (byCode.get(entry.split(' ')[2] ?? '') ?? 0) + 1);
    console.info(`[w52] codes an entry names for a status that this file did not produce: ${unproduced.length} (${[...byCode].map(([code, count]) => `${code} on ${count}`).join(', ')}); other than DEVICE_REVOKED and ORIGIN_NOT_ALLOWED: ${JSON.stringify(unproduced.filter((entry) => !/ (DEVICE_REVOKED|ORIGIN_NOT_ALLOWED)$/.test(entry)))}`);
    const missing = cells.filter((cell) => cell.codes === null && cell.reason === null).map((cell) => `${cell.operationId} ${cell.status}`);
    const stale = cells.filter((cell) => cell.codes !== null && cell.reason !== null).map((cell) => `${cell.operationId} ${cell.status}`);
    expect(missing).toEqual([]);
    expect(stale).toEqual([]);
    // The deferred responses (LANDED_UNANSWERED): the documented cells that are not produced and wait
    // for a named row, by name. An entry added to the list, a listed entry that is no documented cell,
    // or one of an unrouted operation moves this equality; a listed entry that IS produced is `stale` above.
    const deferred = cells.filter((cell) => cell.codes === null && Object.hasOwn(LANDED_UNANSWERED, `${cell.operationId} ${cell.status}`)).map((cell) => `${cell.operationId} ${cell.status}`);
    console.info(`[w52] documented responses deferred to a named row (LANDED_UNANSWERED): ${JSON.stringify(deferred.map((entry) => `${entry}: ${LANDED_UNANSWERED[entry]}`))}`);
    expect(deferred).toEqual(['startCaptureDiscovery 422']);
    expect(Object.keys(LANDED_UNANSWERED)).toEqual(deferred);
    expect(UNROUTED_OPERATIONS.filter((operation) => deferred.some((entry) => entry.startsWith(`${operation.operationId} `))).map((operation) => operation.operationId)).toEqual([]);
    // The primary success status of each of the 97 routed operations (99 less the two of LANDED_UNROUTED).
    const withoutSuccess = ROUTED_OPERATIONS.filter((operation) => ![...ledger.produced(operation.operationId).keys()].some((status) => status >= 200 && status < 300)).map((operation) => operation.operationId);
    expect(withoutSuccess).toEqual([]);
    console.info(`[w52] duration of the file up to its last block: ${Math.round(performance.now() - FILE_STARTED)} ms`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 9. Can this test fail? By a change of its INPUT, never of a file in the tree (rule 9, M15)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('the checks of this file fail when their input departs from the contract', () => {
  it('an extra route on a scratch app is an undocumented route; an operation taken out of the expectation is an unregistered one', async () => {
    // The module-level LANDED_UNROUTED names the 6 registry routes whose handlers land with
    // later rows (R4, ruling D44); this file's own detector is checked against the landed
    // baseline: exactly those 6 are reported unregistered, no more. (Rows 132, 133 and 142
    // routed operations 89 and 93 to 97, decision D114: their six entries left the list.)
    const scratch = buildApp({ config: unitTestConfig() });
    // A route that is no operation of the registry, added by a plugin of this test. The guard
    // would stop the boot (RB-1), so its stage is taken out, as its own header says a test may.
    scratch.register(async (instance) => {
      instance.get('/api/v1/w52/extra', async () => ({ ok: true }));
    });
    scratch.stages.replace('accessRule', () => undefined);
    await scratch.ready();
    const router = routesOfPrintedTable(scratch.printRoutes()).map((route) => routeKey(route.method, templateOf(route.url)));
    await scratch.close();
    expect(compareRoutes(router, REGISTRY_ROUTES, EXTERNAL_ROUTES)).toEqual({ undocumented: ['GET /api/v1/w52/extra'], unregistered: LANDED_UNROUTED });

    // The registered routes of the real server against a registry that documents one operation more, and one less.
    const real = routesOfPrintedTable(main.app.printRoutes()).map((route) => routeKey(route.method, templateOf(route.url)));
    expect(compareRoutes(real, [...REGISTRY_ROUTES, 'POST /api/v1/w52/planned'], EXTERNAL_ROUTES)).toEqual({ undocumented: [], unregistered: [...LANDED_UNROUTED, 'POST /api/v1/w52/planned'] });
    expect(compareRoutes(real, REGISTRY_ROUTES.filter((route) => route !== 'GET /api/v1/health'), EXTERNAL_ROUTES)).toEqual({ undocumented: ['GET /api/v1/health'], unregistered: LANDED_UNROUTED });
    // Without the named exceptions the channel route and the evidence media route are reported.
    expect([...compareRoutes(real, REGISTRY_ROUTES).undocumented].sort()).toEqual([...EXTERNAL_ROUTES].sort());
  });

  it('a row that is rewritten with the values it had is a moved table; an empty ledger covers nothing; a listed status that was produced is reported', async () => {
    // The digest of block 4 on a clone of its own: an UPDATE that changes no value still moves the table.
    const target = await db.another({ slug: 'w52x' });
    const pool = target.ownerPool();
    const before = await readTables(pool);
    expect(movedTables(before, await readTables(pool))).toEqual([]);
    const rewritten = await pool.query('UPDATE public.storage_policy SET auto_archive = auto_archive');
    expect(rewritten.rowCount).toBe(1);
    const after = await readTables(pool);
    expect(movedTables(before, after)).toEqual(['storage_policy']);
    expect(after.rows).toEqual(before.rows);

    // The coverage of block 8 with nothing received: every documented cell is missing.
    const empty = coverageOf(OPERATIONS, new Ledger(OPERATIONS), {});
    expect(empty.length).toBeGreaterThan(300);
    expect(empty.every((cell) => cell.codes === null && cell.reason === null)).toBe(true);
    // And with a reason given for a status that WAS produced: the cell is both, which block 8 refuses.
    const listed = coverageOf(OPERATIONS, ledger, { 'getServiceHealth 200': 'made up' });
    expect(listed.filter((cell) => cell.codes !== null && cell.reason !== null).map((cell) => `${cell.operationId} ${cell.status}`)).toEqual(['getServiceHealth 200']);
  });

  it('an answer with a member the contract does not have, with a member missing, with another status, or with other headers is reported', () => {
    // A schema of contract C is strict (decision D64 DN-9): the validator refuses one member more.
    const detail = ledger.answers.find((answer) => answer.operationId === 'getStorageDetail' && answer.status === 200);
    const body = bodyOf<Record<string, unknown>>(detail ?? ({ body: {} } as Answer));
    expect(validateCoreApiResponse('getStorageDetail', 200, body)).toEqual({ ok: true });
    expect(validateCoreApiResponse('getStorageDetail', 200, { ...body, w52: true }).ok).toBe(false);
    const { storagePolicy: _storagePolicy, ...withoutPolicy } = body;
    expect(validateCoreApiResponse('getStorageDetail', 200, withoutPolicy).ok).toBe(false);
    expect(validateCoreApiResponse('getStorageDetail', 418, body)).toMatchObject({ ok: false, reason: 'UNDOCUMENTED_STATUS' });
    expect(validateCoreApiResponse('getStorageDetail', 200, { error: { code: 'NOT_FOUND', message: 'x' } }).ok).toBe(false);

    // A schema of the ten existing operations or of contract A is not strict: the validator
    // ACCEPTS one member more (finding of this row), and the ledger's own member check reports it.
    const health = ledger.answers.find((answer) => answer.operationId === 'getServiceHealth' && answer.status === 200);
    const healthBody = { ...bodyOf<Record<string, unknown>>(health ?? ({ body: {} } as Answer)), w52: true, ready: { database: true, engine: true, w52: 1 } };
    expect(validateCoreApiResponse('getServiceHealth', 200, healthBody)).toEqual({ ok: true });
    expect(undocumentedMembers(healthBody, CORE_API_SCHEMAS.HealthResponse.parse(healthBody)).sort()).toEqual(['ready.w52', 'w52']);
    const loose = new Ledger(OPERATIONS);
    const extended = { statusCode: 200, body: JSON.stringify(healthBody), headers: { ...OR9_HEADERS, 'content-type': 'application/json; charset=utf-8' }, json: () => healthBody } as unknown as Answer['response'];
    loose.record({ operationId: 'getServiceHealth', method: 'GET', url: '/api/v1/health', caller: 'a made-up caller', callerKind: 'public', note: 'a made-up answer with two members more' }, extended, { epoch: 1, revision: 1, cookieName: 'dems_session_4420' });
    expect(loose.problems.map((problem) => problem.kind)).toEqual(['contract']);
    expect(loose.problems[0]?.text).toMatch(/members the schema HealthResponse does not have: (ready\.w52, w52|w52, ready\.w52)$/);

    // The ledger on a made-up answer: a 500 with a foreign header value, a cookie and no revision headers.
    const probe = new Ledger(OPERATIONS);
    const made = {
      statusCode: 500,
      body: JSON.stringify({ error: { code: 'NOT_A_CODE_OF_THIS_STATUS', message: 'x' } }),
      headers: { 'content-type': 'text/plain', 'cache-control': 'public', 'set-cookie': 'a=b', 'strict-transport-security': 'max-age=1', 'x-dems-simulated': '1' },
      json: () => ({ error: { code: 'NOT_A_CODE_OF_THIS_STATUS', message: 'x' } }),
    } as unknown as Answer['response'];
    probe.record({ operationId: 'createSession', method: 'POST', url: '/api/v1/session', caller: 'a made-up caller', callerKind: 'device', note: 'a made-up answer' }, made, { epoch: 1, revision: 1, cookieName: 'dems_session_4420' });
    expect([...new Set(probe.problems.map((problem) => problem.kind))].sort()).toEqual(['content-type', 'contract', 'cookie', 'header', 'server-error']);
    expect(probe.codeMismatches).toHaveLength(1);
    // Four of the five headers are missing, one has another value, and the two that are never sent are there.
    expect(probe.problems.filter((problem) => problem.kind === 'header')).toHaveLength(7);
    // A 2xx POST without the two headers of API-7.
    const created = { statusCode: 204, body: '', headers: {}, json: () => undefined } as unknown as Answer['response'];
    probe.record({ operationId: 'cancelSession', method: 'POST', url: '/api/v1/session/x/cancel', caller: 'a made-up caller', callerKind: 'web', note: 'a made-up answer' }, created, { epoch: 1, revision: 1, cookieName: 'dems_session_4420' });
    expect(probe.problems.filter((problem) => problem.kind === 'api-7')).toHaveLength(2);
  });
});
