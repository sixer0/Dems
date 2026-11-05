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
// 2026-11-04 (D57c/D59 follow-through): the fake LCD panel backend of this file (the §2.7 pair below).
import { createServer as createHttpTestServer } from 'node:http';
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
import { CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS, CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS, INSTALLATION_ACCEPTANCE_STEP_IDS } from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ROLE_PERMISSIONS, VENDOR_ROOT_EXTRA_PERMISSIONS, createManualClock, type ControllableClock, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { cameraPreview } from '../../src/camera-preview';
import type { DatabaseConnection } from '../../src/config';
import { BULK_TEMPLATE_NOW } from '../../src/db/fixtures/__tests__/template-hook.bulk';
import { createSystemTimers } from '../../src/capture';
import { createOnvifDiscoveryAdapter, sealCredential, type OnvifDiscoveryAdapter, type WsDiscoveryResult } from '../../src/capture/adapters';
import { delay, installLoopbackGuard, type LoopbackGuard } from '../../src/capture/adapters/camera/__tests__/support';
import { engineControl, readdressCaptureDeviceIn } from '../../src/engine';
import { DestinationPurpose, decideDestination } from '../../src/capture/destination-rule';
import { captureFactoryScanControl, captureNetworkConfigControl } from '../../src/modules/capture-config';
import { captureHostAliasControl } from '../../src/modules/capture-config';
import { captureCameraNetworkControl } from '../../src/modules/capture-config';
import { decideNewCameraAddress } from '../../src/capture/destination-rule';
import { createConnectionTestLimits } from '../../src/modules/capture-discovery/connect';
import { createFactoryScanGate } from '../../src/modules/capture-config/factory-scan';
import { adoptedCameraTestControl, captureDiscoveryControl, captureReaddressControl } from '../../src/modules/capture-discovery';
import { captureAudioCardsControl } from '../../src/modules/capture-inputs/audio-cards';
import { DUO, SIX, TWO_CARDS, fakeHost } from '../../src/modules/capture-inputs/audio-cards/__tests__/fixtures';
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
import { loopbackDestination } from '../support/loopback-destination';
import { dropOwn, maintenancePool, resetApplicationName } from '../support/reset';
import { loopbackStoredCameraAddress } from '../support/stored-camera-address';
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
/**
 * Decisions D51 / D53 (row 90P, carried by the RB-9 checkpoint `f85e9c01`; pinned by this sweep on
 * 2026-11-04): `GET /preview/{token}`, the live camera preview stream, is the fourth route outside
 * the registry. The guard gives it the rule of operation 115, the operation that issues its tokens
 * (entry 5 of `plugins/permission-guard/access-rules.ts`; the module is `src/modules/camera-preview`).
 */
const PREVIEW_ROUTE = routeKey('GET', '/preview/{token}');
const EXTERNAL_ROUTES: readonly string[] = [CHANNEL_ROUTE, MEDIA_ROUTE, EXPORT_DOWNLOAD_ROUTE, PREVIEW_ROUTE];

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
// Task 4 row 70 (decision C31, the condition on DD-2 of pass I-2): both routes landed
// (`modules/capture-inputs/audio-cards`) and both entries left the list. Nothing is unrouted: every
// walk of this file calls all 99 operations, and the coverage block holds 98 and 99 like any other.
// Task 4 (blueprint row 194, WP-12): the contract of operation 100 `confirmCaptureDeviceAddress`
// landed before its route (the server's rule is built behind seams, row 97). Row 197 (the wiring of
// the re-address: the route edge, the engine door of row 196) routes it and takes the entry out:
//   100 confirmCaptureDeviceAddress                                task 4 row 197
// `UNROUTED_UNTIL` names the row of every entry; the two lists are held equal in block 1.
// Task 4 row 197: operation 100 is routed (`modules/capture-discovery/readdress-route.ts`, behind the
// engine door of row 196) and its entry left both lists; the camera-search area of this file produces
// its statuses with real requests against the fake ONVIF stub.
// Task 4 (blueprint row 102, WP-23b): the contract of the seven commissioning operations 101 to 107
// landed before their routes (CONTRACT ONLY: no Core route, no job, no screen). Each entry leaves
// with the row that routes it, in the order `compareRoutes` reports (sorted):
//   104 getHostAlias, 105 removeHostAlias                          task 4 row 106 (the alias lifecycle)
//   101 getCaptureNetworkConfig, 102 updateCaptureNetworkConfig    task 4 row 108 (the configuration operations)
//   107 getCameraNetworkJob, 106 setCameraNetwork                  task 4 row 111 (the set-IP job)
//   103 scanFactoryCameras                                         task 4 row 107 (the commissioning scan)
// Task 4 row 108 (WP-19d): the two configuration operations 101 and 102 are routed
// (`modules/capture-config/network`) and their two entries left both lists; the area "the camera
// network configuration" of this file produces their statuses with real requests.
// Task 4 row V3 (the third contract step; blueprint row 146, decisions C58, C62): the contract of
// operation 108 `testCaptureDeviceConnection` landed before its route. The server's function is built
// and proven behind seams (`modules/capture-discovery/adopted-test.ts`); the route edge that calls
// `adoptedCameraTestControl(app).test(...)` routes it and takes the entry out:
//   108 testCaptureDeviceConnection                                task 4 row 146b (the route of the stored-credential connection test)
// Task 4 row 146b: operation 108 is routed (`modules/capture-discovery/adopted-test-route.ts`, one handler that
// calls `adoptedCameraTestControl(app).test(...)`) and its entry left both lists; the camera-search area of this
// file produces its statuses with real requests against the fake ONVIF stub, and area 4 its idle lock.
// Task 4 row 107 (WP-19c): operation 103 `scanFactoryCameras` is routed (`modules/capture-config/factory-scan`)
// and its entry left both lists; the area "the commissioning scan" of this file produces its statuses with real
// requests. The parts the composition will hand in (rule, temporary address, probe) are doubles of that area.
// Task 4 (blueprint row 116, WP-26b): the contract of the installation acceptance and its revocation,
// operations 109 and 110, landed before their routes (CONTRACT ONLY: no Core route, no screen). Both
// entries leave with the row that routes them:
//   109 acceptInstallation, 110 revokeInstallationAcceptance      task 4 row 117 (the acceptance routes)
// Task 4 row 117 (WP-26b): operations 109 and 110 are routed (`modules/capture-config/installation-acceptance`)
// and their two entries left both lists; the area "the installation acceptance" of this file produces their
// statuses with real requests on the Core's own diagnostics run.
// Task 4 row 106b (decision C74): operations 104 `getHostAlias` and 105 `removeHostAlias` are routed
// (`modules/capture-config/host-alias`) and their two entries left both lists; the area "the alias state and its
// removal" of this file produces their statuses with real requests. The lifecycle is a double of that area.
// Task 4 row 111 (WP-22b): operations 106 `setCameraNetwork` and 107 `getCameraNetworkJob` are routed
// (`modules/capture-config/camera-network`) and their two entries left both lists, which are EMPTY now; the area
// "the set-IP job" of this file produces their statuses with real requests. The camera, the alias address and the
// host's observations are doubles of that area.
// Task 4 row RD2 (design 07; decision C147): the contract of operation 111 `retireCaptureDevice` landed before its
// route (CONTRACT ONLY: the shared transition, the simulator, the audit rule; no Core route, no screen). Its entry
// leaves with the row that routes it:
//   111 retireCaptureDevice                                        task 4 row RD3 (the Core's retire unit)
const LANDED_UNROUTED: readonly string[] = ['POST /api/v1/capture/devices/{id}/retire'];
const UNROUTED_UNTIL: Readonly<Record<string, string>> = { 'POST /api/v1/capture/devices/{id}/retire': 'task 4 row RD3' };
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
/** The engine resolves the twelve checks within 4.9 s, finalises in at most 7.2 s and recovers in 3 s. */
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

/**
 * THE FAKE LCD PANEL BACKEND OF THIS FILE (2026-11-04; D57c/D59 follow-through). The panel proxy of
 * `src/lcd/setup.ts` and the firmware reader of `src/lcd/panel-info.ts` ask the backend over the
 * loopback bridge URL, and the bridge of `src/lcd/bridge.ts` heartbeats there while the engine runs.
 * Every server of this file stands behind one fake backend, so the §2.7 pair answers through the
 * real handler chain and the bridge finds a panel that answers. It holds the two identity words and
 * the logo queue in memory and nothing else; no production value passes through it.
 */
interface PanelBackend {
  readonly url: string;
  close(): Promise<void>;
}
let panelBackend: PanelBackend | null = null;

async function startPanelBackend(): Promise<PanelBackend> {
  const identity = { satker: 'LP acceptance', client: 'W52' };
  const logos = { client: true, splash: false };
  const server = createHttpTestServer((request, response) => {
    const url = request.url ?? '';
    const send = (status: number, value: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    if (url === '/api/dems/status') {
      // The bridge's status (n, health, last_req_ms, tx) and the firmware words of operation 117 together.
      send(200, { n: 2, health: 'ok', last_req_ms: Date.now(), tx: 1, panel_fw: 'FW-TEST', verdict: 'ok' });
      return;
    }
    if (url === '/api/dems/identity') {
      send(200, { satker: identity.satker, client: identity.client });
      return;
    }
    if (url === '/api/dems/logo') {
      send(200, { logo: { client: { tersimpan: logos.client }, splash: { tersimpan: logos.splash } } });
      return;
    }
    if (url === '/api/dems/setup' && request.method === 'POST') {
      let text = '';
      request.on('data', (chunk: Buffer) => { text += String(chunk); });
      request.on('end', () => {
        const body = JSON.parse(text) as { satker?: string; client?: string; logo_base64?: string; logo_target?: string };
        const changed = { satker: body.satker !== undefined, client: body.client !== undefined, logo: body.logo_base64 !== undefined };
        if (body.satker !== undefined) identity.satker = body.satker;
        if (body.client !== undefined) identity.client = body.client;
        if (body.logo_base64 !== undefined) {
          const target = body.logo_target ?? 'client';
          if (target === 'client' || target === 'both') logos.client = true;
          if (target === 'splash' || target === 'both') logos.splash = true;
        }
        send(200, { ok: true, satker: identity.satker, client: identity.client, logo: { client: { tersimpan: logos.client }, splash: { tersimpan: logos.splash } }, changed });
      });
      return;
    }
    if (/^\/api\/dems\/ch\/[1-4]\/status$/.test(url) && request.method === 'POST') {
      request.resume();
      send(200, { v: 2, n: 2, health: 'ok' });
      return;
    }
    send(404, { error: 'unknown route of the fake panel backend' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error === undefined ? resolve() : reject(error)))),
  };
}

/** A process start: the real app factory on the database, as `dems_app`, booted as the entry point boots it. */
async function startServer(name: string, target: Target, options: { demoControls: boolean; at?: number }): Promise<Server> {
  const app = buildApp({
    // 2026-11-04 (§2.7 sweep): every server of this file stands behind the fake panel backend — the panel pair of
    // D57c reads it through the real proxy, and the LCD bridge of `mountLcdBridge` heartbeats there as on a panel unit.
    config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, mediaStoreDir: ownMediaRoot(name), logLevel: 'info', port: 4420, demoControls: options.demoControls, lcdBackendUrl: panelBackend?.url ?? null }),
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
/**
 * True when a caller of that role is refused every one of the permissions. D55 (as amended): the vendor root
 * holds `VENDOR_ROOT_EXTRA_PERMISSIONS` by IDENTITY, and the §2.7 area of this file renames the seeded SUPERVISOR
 * into `root` - from that area on, that account is no longer lacking where its role is (2026-11-04).
 */
const lacksAllOf = (role: OperatorRole, permissions: readonly string[]): boolean =>
  !holdsOneOf(role, permissions) && !(role === 'SUPERVISOR' && VENDOR_ROOT_EXTRA_PERMISSIONS.some((extra) => permissions.includes(String(extra))));

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
/** The set-IP job the area "the set-IP job" starts (operation 106; task 4 row 111), for the walk of the reads: a job is data of the TECHNICIAN's web session. */
let cameraNetworkJobId = '';
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
  panelBackend = await startPanelBackend(); // the §2.7 panel pair reads and changes it through the real proxy
  main = await startServer('main', db.database, { demoControls: true });
});

afterAll(async () => {
  transcriptItem?.remove();
  await main?.app.close();
  await panelBackend?.close();
  panelBackend = null;
  rmSync(mediaScratch(), { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 1. The routes and the operations (AC-B-09; decision D83 DN-11)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-09: every registered route is an operation, every operation is registered', () => {
  it('the registry holds exactly 119 operations, 41 GET and 78 POST, each with one access rule and one audit rule', () => {
    // 75 in the closed task-2 contract; C3 grew the registry to 89 with schema v2 (ops 76 to 89:
    // the six capture-config and credential operations, the three audio-source and sealing ones,
    // the five transcript, media-session and export-job ones), and to 92 with the confirmed R-8
    // (C3 §2.5: the STT configuration operations 90 to 92; task 3 row 113), and to 97 with R-9..R-11
    // (C3 §2.6, §10.1: the camera search, the connection test, the adoption and the local-input
    // re-read, 93 to 97; task 3 row 132, decision D106). R1 (D44): acceptance reads the CURRENT
    // registry, the closed document never. Task 4 (blueprint row 63): the two sound-card operations
    // 98 and 99, both POST: 97 + 2 = 99, 36 GET / 63 POST. Task 4 (blueprint row 194): the confirmed
    // re-address, operation 100, POST: 99 + 1 = 100, 36 GET / 64 POST.
    // Task 4 (blueprint row 102): the seven commissioning operations 101 to 107, three GET and four
    // POST: 100 + 7 = 107, 39 GET / 68 POST.
    // Task 4 row V3 (blueprint row 146): the stored-credential connection test, operation 108, POST:
    // 107 + 1 = 108, 39 GET / 69 POST.
    // Task 4 (blueprint row 116): the installation acceptance and its revocation, operations 109 and
    // 110, both POST: 108 + 2 = 110, 39 GET / 71 POST.
    // Task 4 row RD2: the retirement of a device, operation 111, POST: 110 + 1 = 111, 39 GET / 72 POST.
    // C3 §2.7 (transcribed 2026-11-04 by the first full db-suite run): the six of RB-9 as amended
    // (D54: 112-117, two GET among them) and the D57 pair (118 GET, 119 POST): 111 + 8 = 119,
    // 41 GET / 78 POST.
    expect(CORE_API_OPERATION_TABLE).toHaveLength(119);
    expect(OPERATIONS).toHaveLength(119);
    expect(new Set(OPERATIONS.map((operation) => operation.operationId)).size).toBe(119);
    expect(new Set(REGISTRY_ROUTES).size).toBe(119);
    expect(OPERATIONS.filter((operation) => operation.method === 'get')).toHaveLength(41);
    expect(OPERATIONS.filter((operation) => operation.method === 'post')).toHaveLength(78);
    // Task 4 row 70: the named deferral of operations 98 and 99 is gone.
    // Task 4 row 194: ONE named deferral, pinned by literal - operation 100 has no route until row 197.
    // Task 4 row 102: SEVEN more, pinned by literal - operations 101 to 107 have no route until rows 106, 107, 108 and 111.
    // Task 4 row 108: operations 101 and 102 are routed; their two entries left the literal.
    // Task 4 row 197: operation 100 is routed; its entry left the literal.
    // Task 4 row V3: ONE more, pinned by literal - operation 108 has no route until row 146b (the route edge of `adopted-test.ts`).
    // Task 4 row 146b: operation 108 is routed; its entry left the literal.
    // Task 4 row 107: operation 103 is routed; its entry left the literal.
    // Task 4 row 116: TWO more, pinned by literal - operations 109 and 110 have no route until row 117 (the acceptance routes).
    // Task 4 row 117: operations 109 and 110 are routed; their two entries left the literal.
    // Task 4 row 106b: operations 104 and 105 are routed; their two entries left the literal.
    // Task 4 row 111: operations 106 and 107 are routed; their two entries left the literal, which is empty.
    // Task 4 row RD2: ONE more, pinned by literal - operation 111 has no route until row RD3 (the Core's retire unit).
    expect(UNROUTED_OPERATIONS.map((operation) => operation.operationId)).toEqual(['retireCaptureDevice']);
    expect(Object.keys(UNROUTED_UNTIL)).toEqual([...LANDED_UNROUTED]);
    for (const operation of OPERATIONS) {
      expect(describeCoreApiAccess(operation.access), operation.operationId).not.toBe('');
      expect(operation.audit.success, operation.operationId).toBeDefined();
      expect(['ACCESS_DENIED', 'EXPORT_DENIED'], operation.operationId).toContain(operation.audit.denial);
    }
  });

  it('the router of the booted server and the guard register exactly the registry\'s routes; the four routes outside it are the named ones', () => {
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
    console.info(`[w52] the routes outside the registry: ${router.filter((route) => !REGISTRY_ROUTES.includes(route)).join(', ')}`);
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
    // Task 4 row 70: the two sound-card routes landed, 100 + 2 = 102 (99 of the registry and the three outside it).
    // Task 4 row 194: the registry holds 100; its one unrouted operation is not in the router, so 102 stays.
    // Task 4 row 102: the registry holds 107; its eight unrouted operations are not in the router, so 102 stays.
    // Task 4 row 108: the two configuration routes landed, 102 + 2 = 104.
    // Task 4 row 197: the route of operation 100 landed, 104 + 1 = 105.
    // Task 4 row 146b: the route of operation 108 landed, 105 + 1 = 106.
    // Task 4 row 107: the route of operation 103 landed, 106 + 1 = 107.
    // Task 4 row 117: the two acceptance routes landed (operations 109 and 110), 107 + 2 = 109. (Both lines, by this row's delta only.)
    // Task 4 row 106b: the two alias routes landed (operations 104 and 105), 109 + 2 = 111. (Both lines, by this row's delta only.)
    // Task 4 row 111: the two routes of the set-IP job landed (operations 106 and 107), 111 + 2 = 113. (Both lines, by this row's delta only.)
    // C3 §2.7 + the RB-9 checkpoint (D54 as amended, D57c; pinned by this sweep 2026-11-04): the registry holds 119
    // with one unrouted (operation 111), and the preview route joined the outside - 119 - 1 + 4 = 122.
    expect(router).toHaveLength(122);
    expect(new Set(router).size).toBe(122); // moved with the line above by row 116's pin pass: row 107's delta (106 -> 107) had reached one of the two lines only
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
      if (routeKey(rule.method, templateOf(rule.url)) === PREVIEW_ROUTE) {
        // Decisions D51 / D53 (rule entry 5): the rule of operation 115, under the route's own name.
        expect(rule.marker).toBe(describeCoreApiAccess(operationOf('createCameraPreviewSession').access));
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

  it('the committed openapi.json lists the same 119 operations with two security schemes, and equals what the generator produces now', () => {
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
    expect(documented).toHaveLength(119); // C3 §2.7 (transcribed 2026-11-04): the document holds the eight of RB-9 as amended and D57c with the rest
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
    // D59 (revocation row of §2.1, 2026-11-04): CAPTURE_CONFIG went from SUPERVISOR - the holder that edits is the TECHNICIAN.
    const stale = await expectCall(main, 'updateSttConfig', technician, 'the revision of the body is the one before', { payload: { revision, enabled: false } }, 409, 'INVALID_STATE');
    expect(detailsOf(stale)['reason']).toBe('REVISION_CONFLICT');
    const lan = await expectCall(main, 'updateSttConfig', technician, 'an endpoint that is not on loopback', { payload: { revision: revision + 1, backend: 'omlx-server', endpoint: 'http://192.168.1.20:8000' } }, 422, 'INVALID_INPUT');
    expect(detailsOf(lan)['reason']).toBe('ENDPOINT_NOT_LOOPBACK');
    await expectCall(main, 'updateSttConfig', technician, 'a body without its revision', { payload: { enabled: false } }, 422, 'INVALID_INPUT');
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

  it('the capture selector (operations 76 to 80; C3 §2.4, task 3 row 66; D59): the reads, the edits of the holder of CAPTURE_CONFIG, their refusals', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const technician = web.TECHNICIAN;
    // D60/D61 (2026-11-04): four video tracks and four numbered microphone channels — the mic line names its CHANNEL (was the PRIMARY/STANDBY role).
    interface Selector { cameras: { trackId: string; deviceId: string }[]; mics: { inputId: string; channel: string }[]; locked: boolean }
    const seededCameras = [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }, { trackId: 'VIDEO-03', deviceId: 'CAM-03' }, { trackId: 'VIDEO-04', deviceId: 'CAM-04' }]; // D60: four built-in cameras
    const seededMics = [{ inputId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-02', channel: 'MIC-02' }, { inputId: 'MIC-03', channel: 'MIC-03' }, { inputId: 'MIC-04', channel: 'MIC-04' }]; // D61: four numbered channels
    // Every role reads both slices; neither answer holds a credential member.
    for (const caller of [web.INVESTIGATOR, supervisor, technician]) {
      const config = await expectCall(main, 'getCaptureConfig', caller, 'every role reads the selector', {}, 200);
      expect(bodyOf<Selector>(config)).toMatchObject({ locked: false, cameras: seededCameras, mics: seededMics });
      const devices = await expectCall(main, 'getCaptureDevices', caller, 'every role reads the capture registry', {}, 200);
      expect(JSON.stringify([bodyOf(config), bodyOf(devices)])).not.toMatch(/secret|password|username|credential/i);
    }
    // 80: a holder of CAPTURE_CONFIG moves the transcription channel (D61, 2026-11-04: operation 80 moves the CHANNEL — the named input
    // takes `MIC-01`, the input that held channel 1 takes the named input's old channel; was the PRIMARY/STANDBY role swap).
    const primary = await expectCall(main, 'setPrimaryMic', technician, 'a TECHNICIAN makes MIC-02 the transcription input', { id: 'MIC-02' }, 200);
    expect(bodyOf<Selector>(primary).mics).toMatchObject([{ inputId: 'MIC-01', channel: 'MIC-02' }, { inputId: 'MIC-02', channel: 'MIC-01' }, { inputId: 'MIC-03', channel: 'MIC-03' }, { inputId: 'MIC-04', channel: 'MIC-04' }]);
    await expectCall(main, 'setPrimaryMic', technician, 'an input the selector does not hold', { id: 'MIC-09' }, 404, 'NOT_FOUND');
    await expectCall(main, 'setPrimaryMic', technician, 'a malformed {id}', { id: 'mic-02' }, 422, 'INVALID_INPUT');
    // 78: the whole selector; here two of the four cameras change tracks in one edit (D60, 2026-11-04: four tracks answer). D59 (revocation row of §2.1):
    // the grant went from SUPERVISOR on 2026-10-29 (migration 0034) - the editor of the topology is the TECHNICIAN.
    const swapped = await expectCall(main, 'updateCaptureConfig', technician, 'a TECHNICIAN swaps the two cameras', { payload: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] } }, 200);
    expect(bodyOf<Selector>(swapped).cameras).toMatchObject([{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }, { trackId: 'VIDEO-03', deviceId: 'CAM-03' }, { trackId: 'VIDEO-04', deviceId: 'CAM-04' }]);
    await expectCall(main, 'updateCaptureConfig', technician, 'a device the capture registry does not hold (a discovery candidate is never one)', { payload: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-77' }] } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'updateCaptureConfig', technician, 'a track outside the value set', { payload: { cameras: [{ trackId: 'VIDEO-09', deviceId: 'CAM-01' }] } }, 422, 'INVALID_INPUT');
    // 79: a camera device to a video track.
    await expectCall(main, 'setCaptureCameraSource', technician, 'one camera on both tracks with one profile', { id: 'CAM-01', payload: { trackId: 'VIDEO-01' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'setCaptureCameraSource', technician, 'a camera the capture registry does not hold', { id: 'CAM-99', payload: { trackId: 'VIDEO-01' } }, 404, 'NOT_FOUND');
    await expectCall(main, 'setCaptureCameraSource', technician, 'a track outside the value set', { id: 'CAM-01', payload: { trackId: 'VIDEO-09' } }, 422, 'INVALID_INPUT');
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
    await expectCall(main, 'updateCaptureConfig', technician, 'the two cameras back on their tracks', { payload: { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }] } }, 200);
    const restored = await expectCall(main, 'setPrimaryMic', technician, 'MIC-01 is the transcription input again', { id: 'MIC-01' }, 200);
    expect(bodyOf<Selector>(restored)).toMatchObject({ cameras: seededCameras, mics: seededMics });
    // 79, accepted (integration pass D4: the cell was never produced): the camera on the track it holds.
    await expectCall(main, 'setCaptureCameraSource', technician, 'a camera on the track it already feeds', { id: 'CAM-01', payload: { trackId: 'VIDEO-01' } }, 200);
    settle();
  });

  it('camera search, connect and the mic re-read (operations 89 and 93 to 97; C3 §2.6, task 3 rows 132, 133, 142): one search, one test, one adoption against the fake ONVIF stub on loopback', async () => {
    fresh(main);
    const technician = web.TECHNICIAN;
    // D59 (revocation row of §2.1, migration 0034): SUPERVISOR no longer holds CAPTURE_CONFIG, so the cells that
    // name "another session" of a CAPTURE_CONFIG holder take a second web session of the TECHNICIAN - the state of
    // the discovery flow is keyed by the sign-in session, not by the operator.
    const spareTechnician = await signInWeb(main, 'TECHNICIAN');
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
      // 94 before any search: nothing, for every holder of CAPTURE_CONFIG - since D59 the seeded holder and a second session of it.
      for (const caller of [technician, spareTechnician]) expect(bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', caller, 'a holder of CAPTURE_CONFIG reads the empty state', {}, 200))).toMatchObject({ search: null, candidates: [] });

      // 93 with a typed address (task 4 row 96; the 422 the contract documents since row 94). A body outside its
      // schema, then an address of the form that the Core may not dial: refused before anything is built - no
      // datagram, no search, no place taken in a bound, so the search below still starts with 202.
      const notAnAddress = await expectCall(main, 'startCaptureDiscovery', technician, 'a typed address that is a name', { payload: { address: 'camera.example' } }, 422, 'INVALID_INPUT');
      expect(detailsOf(notAnAddress)['reason']).toBeUndefined();
      const notAllowed = await expectCall(main, 'startCaptureDiscovery', technician, 'a typed address the Core may not dial', { payload: { address: '127.0.0.1' } }, 422, 'INVALID_INPUT');
      expect(detailsOf(notAllowed)).toEqual({ in: 'body', reason: 'DISCOVERY_ADDRESS_NOT_ALLOWED' });
      expect(JSON.stringify(notAllowed.body)).not.toContain('127.0.0.1');
      expect(guard.datagrams()).toEqual([]);
      expect(captureDiscoveryControl(main.app).searchesStarted()).toBe(0);
      expect(bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', technician, 'no search was started by a refused typed address', {}, 200))).toMatchObject({ search: null, candidates: [] });

      // 93: a new search (202); the caller's own running search again (200, no second probe); another session meanwhile (409).
      const started = await expectCall(main, 'startCaptureDiscovery', technician, 'a TECHNICIAN starts a search', {}, 202);
      const searchId = bodyOf<{ searchId: string; created: boolean }>(started).searchId;
      expect(bodyOf<{ created: boolean }>(started).created).toBe(true);
      const again = await expectCall(main, 'startCaptureDiscovery', technician, 'the same session while its search runs', {}, 200);
      expect(bodyOf<{ searchId: string; created: boolean }>(again)).toMatchObject({ searchId, created: false });
      const busy = await expectCall(main, 'startCaptureDiscovery', spareTechnician, 'another session while that search runs', {}, 409, 'INVALID_STATE');
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
      expect(bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', spareTechnician, 'another session reads its own (empty) state', {}, 200)).candidates).toEqual([]);
      const candidateId = listed.candidates[0]?.candidateId ?? '';
      const unknownId = candidateId === 'CND-0000000000AA' ? 'CND-0000000000AB' : 'CND-0000000000AA';

      // 95 and 96 before a test, and for an id that is unknown or another session's: one answer, no request to any device.
      const requests = stub.requestLog().length;
      const untested = await expectCall(main, 'adoptCaptureCandidate', technician, 'adoption before a connection test', { id: candidateId, payload: { credential: account } }, 409, 'INVALID_STATE');
      expect(detailsOf(untested)['reason']).toBe('CANDIDATE_NOT_TESTED');
      await expectCall(main, 'testCaptureCandidateConnection', technician, 'an id no search listed', { id: unknownId, payload: { credential: account } }, 404, 'NOT_FOUND');
      await expectCall(main, 'adoptCaptureCandidate', technician, 'an id no search listed', { id: unknownId, payload: { credential: account } }, 404, 'NOT_FOUND');
      await expectCall(main, 'testCaptureCandidateConnection', spareTechnician, 'the candidate of another session\'s search', { id: candidateId, payload: { credential: account } }, 404, 'NOT_FOUND');
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
      // D60 (2026-11-04): the seed carries FOUR built-in cameras, so the adopted one takes the next free number, CAM-05.
      main.clock.advance(30 * SECOND);
      const adopted = await expectCall(main, 'adoptCaptureCandidate', technician, 'the tested candidate with the same account', { id: candidateId, payload: { credential: account } }, 201);
      const adoption = bodyOf<{ deviceId: string; credentialSet: boolean; device: Record<string, unknown> }>(adopted);
      expect(adoption).toMatchObject({ deviceId: 'CAM-05', credentialSet: true, device: { id: 'CAM-05', kind: 'CAMERA', adapter: 'FAKE', sourceClass: 'DEVELOPMENT' } });
      await written();
      main.clock.advance(30 * SECOND);
      for (const operationId of ['adoptCaptureCandidate', 'testCaptureCandidateConnection'] as const) {
        const repeat = await expectCall(main, operationId, technician, 'the candidate is a registered device now', { id: candidateId, payload: { credential: account } }, 409, 'INVALID_STATE');
        expect(detailsOf(repeat)).toMatchObject({ reason: 'CANDIDATE_ALREADY_REGISTERED', deviceId: 'CAM-05' });
      }
      expect(bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', technician, 'the candidate reads REGISTERED', {}, 200)).candidates.map((candidate) => [candidate.status, candidate.deviceId])).toEqual([['REGISTERED', 'CAM-05']]);

      // 89: the credential of a registered camera is replaced; the answer is the selector and echoes neither field.
      const replaced = await expectCall(main, 'setCaptureDeviceCredential', technician, 'the holder of CAPTURE_CONFIG replaces the credential of the adopted camera', { id: 'CAM-05', payload: account }, 200);
      await expectCall(main, 'setCaptureDeviceCredential', technician, 'a device the capture registry does not hold', { id: 'CAM-99', payload: account }, 404, 'NOT_FOUND');
      await expectCall(main, 'setCaptureDeviceCredential', technician, 'a malformed {id}', { id: 'cam 03', payload: account }, 422, 'INVALID_INPUT');
      // (Its 409 CAPTURE_CONFIG_LOCKED needs an open session: produced by the connect flow's own
      // database test today, and by area 4 of this file once its route walk is whole again - the
      // same place the selector's 409 of operations 78 to 80 waits for.)

      // 108 (task 4 rows 146, V3, 146b): the connection test of a REGISTERED camera with its STORED credential. NO BODY:
      // the device is the id of the path and nothing else is read. This Core has no production composition, so no
      // reader was handed in: the envelope's 503, before anything is read.
      const storedTestNotReady = await expectCall(main, 'testCaptureDeviceConnection', technician, 'no reader of the stored credential was handed in', { id: 'CAM-05' }, 503, 'NOT_READY');
      expect(detailsOf(storedTestNotReady)['reason']).toBe('DISCOVERY_NOT_READY');
      // THE READER IS A DOUBLE OF THIS FILE (static rule R-6: only the tests of `modules/capture-config` import the wiring
      // of the credential holders; the real reader, its reveal entry, the relay and the two audit entries of a test are
      // proven in `modules/capture-config/__tests__/adopted-camera-test.db.test.ts`). It answers the stub's own account
      // of this run as the opaque credential and counts its calls; the address rule is the test rule of `test/support`.
      let storedReads = 0;
      adoptedCameraTestControl(main.app).provide({
        reader: {
          connectionTest: async () => {
            storedReads += 1;
            return sealCredential(account);
          },
        },
        storedAddress: loopbackStoredCameraAddress,
      });
      const requestsBeforeStoredTest = stub.requestLog().length;
      await expectCall(main, 'testCaptureDeviceConnection', technician, 'a device the capture registry does not hold', { id: 'CAM-99' }, 404, 'NOT_FOUND');
      await expectCall(main, 'testCaptureDeviceConnection', technician, 'a registered device that is no camera', { id: 'MIC-01' }, 404, 'NOT_FOUND');
      await expectCall(main, 'testCaptureDeviceConnection', technician, 'a malformed {id}', { id: 'cam 03' }, 422, 'INVALID_INPUT');
      // CAM-05 was adopted from the stub as a DEVELOPMENT source (adapter FAKE): it has no stored-credential test.
      const developmentSource = await expectCall(main, 'testCaptureDeviceConnection', technician, 'a development source', { id: 'CAM-05' }, 409, 'INVALID_STATE');
      expect(detailsOf(developmentSource)).toEqual({ reason: 'CANDIDATE_NOT_TESTABLE' });
      // Every refusal stood before the read: the reader was not called and nothing was sent to the stub.
      expect(storedReads).toBe(0);
      expect(stub.requestLog().length).toBe(requestsBeforeStoredTest);
      // AS A FIXTURE the stored row is given the production adapter kind for one call (the test reads the stored facts at
      // EVERY call): the Core tests the stub at its STORED address with what the reader answered. A body is not read: a
      // decoy address in it changes nothing. This Core has no relay program, so the answer is the ONVIF half's own.
      await owner().query("UPDATE public.capture_devices SET adapter_kind = 'ONVIF_RTSP' WHERE id = 'CAM-05'");
      let storedTest: Answer;
      try {
        main.clock.advance(30 * SECOND);
        storedTest = await expectCall(main, 'testCaptureDeviceConnection', technician, 'the adopted camera, as a production camera at its stored address', { id: 'CAM-05', payload: { address: '192.168.50.99', credential: { username: 'decoy', secret: 'decoy' } } }, 200);
      } finally {
        await owner().query("UPDATE public.capture_devices SET adapter_kind = 'FAKE' WHERE id = 'CAM-05'");
      }
      expect(bodyOf<Record<string, unknown>>(storedTest)).toMatchObject({ deviceId: 'CAM-05', outcome: 'REACHABLE', authenticated: true });
      expect(storedReads).toBe(1);
      expect(stub.requestLog().length).toBeGreaterThan(requestsBeforeStoredTest);
      console.info(`[w52] operation 108 on the stub: ${String(bodyOf<{ outcome: string }>(storedTest).outcome)}; reads of the stored credential ${storedReads}; requests at the stub +${stub.requestLog().length - requestsBeforeStoredTest}`);
      await written();
      main.clock.advance(30 * SECOND);

      // 100 (task 4 rows 194, 196, 197): the operator-confirmed re-address of the adopted camera. The body is a
      // confirmation, not a target: the Core takes the address from the caller's own search state. Nothing is sent
      // to any device by this operation.
      const shownAddress = String(adoption.device['host']);
      const readdress = (candidate: string, deviceId = 'CAM-05', address = shownAddress): Options => ({ payload: { deviceId, candidateId: candidate, address } });
      const sentBeforeReaddress = stub.requestLog().length;
      const unmoved = await expectCall(main, 'confirmCaptureDeviceAddress', technician, 'the registered camera answers from its stored address', readdress(candidateId), 409, 'INVALID_STATE');
      expect(detailsOf(unmoved)).toEqual({ reason: 'READDRESS_NOT_THE_REGISTERED_CAMERA' });
      await expectCall(main, 'confirmCaptureDeviceAddress', technician, 'an id no search listed', readdress(unknownId), 404, 'NOT_FOUND');
      await expectCall(main, 'confirmCaptureDeviceAddress', spareTechnician, 'the candidate of another session\'s search', readdress(candidateId), 404, 'NOT_FOUND');
      await expectCall(main, 'confirmCaptureDeviceAddress', technician, 'a device the capture registry does not hold', readdress(candidateId, 'CAM-99'), 404, 'NOT_FOUND');
      await expectCall(main, 'confirmCaptureDeviceAddress', technician, 'an address that is a name', readdress(candidateId, 'CAM-05', 'camera.example'), 422, 'INVALID_INPUT');
      // THE CAMERA "MOVES" (fixture): its stored address becomes another one through the engine's own door, in the
      // row and in the running engine together; the next search lists it as the registered camera at a changed address.
      await main.app.engine.run('w52.fixture.cameraMoved', async (scope) => {
        await readdressCaptureDeviceIn(scope, { deviceId: 'CAM-05', address: '192.168.50.20' });
      });
      await written();
      main.clock.advance(130 * SECOND);
      await expectCall(main, 'startCaptureDiscovery', technician, 'a search after the camera moved', {}, 202);
      await delay(3_400);
      await written();
      const movedList = bodyOf<Discovery>(await expectCall(main, 'getCaptureDiscovery', technician, 'the registered camera at a changed address', {}, 200)).candidates;
      expect(movedList.map((candidate) => [candidate.status, candidate.deviceId])).toEqual([['REGISTERED', 'CAM-05']]);
      const movedId = movedList[0]?.candidateId ?? '';
      const otherAddress = await expectCall(main, 'confirmCaptureDeviceAddress', technician, 'another address than the one the search shows', readdress(movedId, 'CAM-05', '192.168.50.21'), 409, 'INVALID_STATE');
      expect(detailsOf(otherAddress)).toEqual({ reason: 'READDRESS_CONFIRMATION_MISMATCH' });
      // The destination rule of this Core (no network facts were handed in: it refuses every address): one sentence, never the address.
      const ruledOut = await expectCall(main, 'confirmCaptureDeviceAddress', technician, 'an address the destination rule refuses', readdress(movedId), 422, 'INVALID_INPUT');
      expect(detailsOf(ruledOut)).toEqual({ in: 'body', reason: 'DISCOVERY_ADDRESS_NOT_ALLOWED' });
      expect(JSON.stringify(ruledOut.body)).not.toContain('127.0.0.1');
      // The stub lives on loopback, which the product's rule refuses on any facts: the permissive rule of a test (AD-02 (2)) for ONE call.
      captureReaddressControl(main.app).replaceForTest({ addressRule: (host, port) => loopbackDestination(host, port ?? 80) });
      const confirmed = await expectCall(main, 'confirmCaptureDeviceAddress', technician, 'the operator confirms the address the search shows', readdress(movedId), 200);
      expect(bodyOf<Record<string, unknown>>(confirmed)).toMatchObject({ deviceId: 'CAM-05', device: { id: 'CAM-05', kind: 'CAMERA', host: shownAddress } });
      await written();
      // (Still under the test's rule: the product's rule stands before the unit and would refuse first.)
      const confirmedTwice = await expectCall(main, 'confirmCaptureDeviceAddress', technician, 'the same confirmation again', readdress(movedId), 409, 'INVALID_STATE');
      captureReaddressControl(main.app).replaceForTest({ addressRule: null });
      expect(detailsOf(confirmedTwice)).toEqual({ reason: 'READDRESS_ADDRESS_UNCHANGED' });
      await expectCall(main, 'confirmCaptureDeviceAddress', CONSOLE, 'the web console without a session', readdress(movedId), 401, 'NOT_SIGNED_IN');
      // The second search probed; no request of operation 100 reached the device service.
      expect(stub.requestLog().slice(sentBeforeReaddress).every((entry) => entry.channel === 'discovery')).toBe(true);

      // 97: the registered microphones re-read; no network is involved.
      for (const caller of [technician, spareTechnician]) {
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

      // Without a session: every one of the seven (task 4 row 146b: operation 108 among them).
      for (const [operationId, options] of [
        ['startCaptureDiscovery', {}],
        ['getCaptureDiscovery', {}],
        ['testCaptureCandidateConnection', { id: candidateId, payload: { credential: account } }],
        ['adoptCaptureCandidate', { id: candidateId, payload: { credential: account } }],
        ['setCaptureDeviceCredential', { id: 'CAM-05', payload: account }],
        ['testCaptureDeviceConnection', { id: 'CAM-05' }],
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

  it('the sound cards (operations 98 and 99; task 4 row 70, decision C31): one listing, one registration, its repeat and their refusals, on fixed listing texts', async () => {
    fresh(main);
    const technician = web.TECHNICIAN;
    // THIS CORE IS SIMULATED: of itself the module has no enumerator and answers the envelope's 503.
    // Its place is taken, once, by the real enumerator of row 64 over a table of fixed texts (no
    // host is read, no process starts). The 503, the roles, the rollback and the audit keys are the
    // module's tests.
    //
    // THE REGISTRAR IS THE PRODUCT'S (task 4 rows 185 and 190; decision C43 (2); integration pass
    // I-7): the plugin hands it in itself and nothing replaces it here. The microphone it registers
    // enters the replicated registry and stays there for the rest of this file, so operation 77
    // lists MIC-01, MIC-02 AND the registered microphone - rule AC-B-70 at the end of this file
    // says so for the device registry and keeps the pair rule for every other list of audio.
    const host = fakeHost(TWO_CARDS);
    captureAudioCardsControl(main.app).replaceForTest({ enumerator: host.enumerator });
    /** Past the spacing of the search (the server clock decides): this file produces no 429 of the operation. */
    const spaced = (): void => main.clock.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    interface Search { cards: { cardId: string; channelCount: number; registered: { inputNumber: number; deviceId: string }[]; boundTo: string | null }[]; truncated: boolean }
    interface Registration { deviceId: string; change: string; inputNumber: number; channelCount: number; releasedDeviceId: string | null }

    // 98: the listing, for the holder of CAPTURE_CONFIG on the web console (D59: SUPERVISOR's grant is revoked,
    // the refusal cell is held by the generated walk of AC-B-14). R-FLEX (row 138, AU-L1): every card
    // names the microphone that holds it (`boundTo`), here none.
    for (const caller of [technician]) {
      spaced();
      const listed = bodyOf<Search>(await expectCall(main, 'searchCaptureAudioCards', caller, 'a holder of CAPTURE_CONFIG lists the sound cards', {}, 200));
      expect(listed.cards.map((card) => [card.cardId, card.channelCount, card.registered, card.boundTo])).toEqual([[DUO.cardId, 2, [], null], [SIX.cardId, 6, [], null]]);
    }
    // 98: a second call while a listing runs (409), then the first one answers.
    spaced();
    const before = host.listings();
    const release = host.holdOnce();
    const running = expectCall(main, 'searchCaptureAudioCards', technician, 'a listing that is held by the host', {}, 200);
    for (let turn = 0; turn < 200 && host.listings() === before; turn += 1) await delay(5);
    const busy = await expectCall(main, 'searchCaptureAudioCards', technician, 'another call while that listing runs (the gate is one per Core)', {}, 409, 'INVALID_STATE');
    expect(detailsOf(busy)['reason']).toBe('AUDIO_CARD_SEARCH_IN_PROGRESS');
    release();
    await running;

    // 99: a new microphone (201), the same input again (200, no second device), and the refusals.
    const payload = { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 3 };
    const registered = bodyOf<Registration>(await expectCall(main, 'registerCaptureAudioInput', technician, 'the third input of the six-input interface', { payload }, 201));
    expect(registered).toMatchObject({ change: 'REGISTERED', inputNumber: 3, channelCount: 6, releasedDeviceId: null });
    const again = bodyOf<Registration>(await expectCall(main, 'registerCaptureAudioInput', technician, 'the same input again', { payload }, 200));
    expect(again).toEqual({ ...registered, change: 'REENABLED' });
    await expectCall(main, 'registerCaptureAudioInput', technician, 'a card the listing does not hold', { payload: { ...payload, cardId: 'NoSuchCard' } }, 404, 'NOT_FOUND');
    const beyond = await expectCall(main, 'registerCaptureAudioInput', technician, 'an input beyond the card', { payload: { ...payload, inputNumber: 7 } }, 409, 'INVALID_STATE');
    expect(detailsOf(beyond)['reason']).toBe('AUDIO_INPUT_BEYOND_CARD');
    await expectCall(main, 'registerCaptureAudioInput', technician, 'a member the body does not have', { payload: { ...payload, product: 'x' } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'registerCaptureAudioInput', technician, 'a release that is no boolean', { payload: { ...payload, release: 'true' } }, 422, 'INVALID_INPUT');
    spaced();
    const held = bodyOf<Search>(await expectCall(main, 'searchCaptureAudioCards', technician, 'the listing names the registered input and its holder', {}, 200));
    expect(held.cards.map((card) => [card.registered, card.boundTo])).toEqual([[[], null], [[{ inputNumber: 3, deviceId: registered.deviceId }], registered.deviceId]]);
    // 77 (decision C43 (2), (3)): the registered microphone is in the registry every role reads, once
    // (the repeat made no second device), after the built-in FOUR channels (D61, 2026-11-04: the pair became the four
    // numbered channels MIC-01..MIC-04) and with the capability they state.
    const registry = bodyOf<{ devices: { id: string; kind: string; capabilities: string[]; adapter?: string }[] }>(await expectCall(main, 'getCaptureDevices', web.INVESTIGATOR, 'the registry lists the registered microphone', {}, 200));
    const microphones = registry.devices.filter((device) => device.kind === 'MIC');
    expect(microphones.map((device) => device.id)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', registered.deviceId]); // D61: four built-ins, then the registered one
    expect(microphones.map((device) => device.capabilities)).toEqual([['AUDIO'], ['AUDIO'], ['AUDIO'], ['AUDIO'], ['AUDIO']]);
    expect(microphones.at(-1)?.adapter).toBe('USB_AUDIO');
    // 99, D48 (2026-10-23, reverses D10 (1) / Q96-01 a; was row 138's "one microphone per card": another input refused
    // AUDIO_CARD_ALREADY_BOUND, the holder moved with `release: true`): ONE MICROPHONE PER INPUT of a card. Another input of the
    // held card is a SECOND microphone (201, no release); the same input again is its microphone (200 REENABLED, also with
    // `release: true`, nothing released). Asked AFTER the registry read above, so that AC-B-70 still sees the pair and one
    // registered microphone there.
    const second = bodyOf<Registration>(await expectCall(main, 'registerCaptureAudioInput', technician, 'another input of the card a microphone holds', { payload: { ...payload, inputNumber: 4 } }, 201));
    expect(second).toMatchObject({ change: 'REGISTERED', inputNumber: 4, channelCount: 6, releasedDeviceId: null });
    expect(second.deviceId).not.toBe(registered.deviceId);
    const secondAgain = bodyOf<Registration>(await expectCall(main, 'registerCaptureAudioInput', technician, 'the second input again, with a release', { payload: { ...payload, inputNumber: 4, release: true } }, 200));
    expect(secondAgain).toEqual({ ...second, change: 'REENABLED' });
    spaced();
    const both = bodyOf<Search>(await expectCall(main, 'searchCaptureAudioCards', technician, 'the listing names both microphones of the card', {}, 200));
    expect(both.cards.map((card) => [card.registered, card.boundTo])).toEqual([[[], null], [[{ inputNumber: 3, deviceId: registered.deviceId }, { inputNumber: 4, deviceId: second.deviceId }], registered.deviceId]]);

    // Without a session: both.
    await expectCall(main, 'searchCaptureAudioCards', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'registerCaptureAudioInput', CONSOLE, 'the web console without a session', { payload }, 401, 'NOT_SIGNED_IN');
    await main.app.pipeline.drain();
    settle();
  });

  it('the camera network configuration (operations 101 and 102; task 4 row 108): the read, one change, its repeat and the refusals, on a table of interfaces of this file', async () => {
    fresh(main);
    const technician = web.TECHNICIAN;
    interface Config { configured: boolean; interfaceName: string | null; cameraSubnet: string | null; revision: number; updatedAt: number | null }

    // 101: nobody has written it - the defaults, no interface, no subnet. The Core chooses neither.
    const unwritten = bodyOf<Config>(await expectCall(main, 'getCaptureNetworkConfig', technician, 'the configuration nobody has written yet', {}, 200));
    expect(unwritten).toMatchObject({ configured: false, interfaceName: null, cameraSubnet: null, revision: 1, updatedAt: null });
    // THIS CORE IS SIMULATED: of itself a change is refused (the Core cannot commission) and nothing is stored.
    const notAvailable = await expectCall(main, 'updateCaptureNetworkConfig', technician, 'a change on a Core that is not in production capture', { payload: { revision: 1, interfaceName: 'eth1' } }, 409, 'INVALID_STATE');
    expect(detailsOf(notAvailable)['reason']).toBe('COMMISSIONING_NOT_AVAILABLE');
    // Its place is taken, once: this Core accepts a change, and the host is a table of this file (no
    // interface of this machine is read). The roles, the rollback, the audit keys and the reader of
    // the network facts are the folder's own tests.
    captureNetworkConfigControl(main.app).replaceForTest({
      available: true,
      interfaces: () => [
        { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
        // R-FLEX (row 138, D23; RG-13): an address without a non-zero hardware address is not eligible.
        { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24, mac: '02:00:5E:00:53:01' }] },
      ],
    });

    // 102: the refusals, each storing nothing.
    const stale = await expectCall(main, 'updateCaptureNetworkConfig', technician, 'a stale revision', { payload: { revision: 9, interfaceName: 'eth1' } }, 409, 'INVALID_STATE');
    expect(detailsOf(stale)['reason']).toBe('REVISION_CONFLICT');
    const notAllowed = await expectCall(main, 'updateCaptureNetworkConfig', technician, 'an interface the host does not have', { payload: { revision: 1, interfaceName: 'eth9' } }, 422, 'INVALID_INPUT');
    expect(detailsOf(notAllowed)['reason']).toBe('NETWORK_CONFIG_NOT_ALLOWED');
    await expectCall(main, 'updateCaptureNetworkConfig', technician, 'a member the body does not have', { payload: { revision: 1, port: 80 } }, 422, 'INVALID_INPUT');
    // 102: the change (200), and the same body again (200, the revision stays).
    const changed = bodyOf<Config>(await expectCall(main, 'updateCaptureNetworkConfig', technician, 'the interface and the subnet are chosen', { payload: { revision: 1, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' } }, 200));
    expect(changed).toMatchObject({ configured: true, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24', revision: 2 });
    const again = bodyOf<Config>(await expectCall(main, 'updateCaptureNetworkConfig', technician, 'the same settings again', { payload: { revision: 2, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' } }, 200));
    expect(again).toEqual(changed);
    expect(bodyOf<Config>(await expectCall(main, 'getCaptureNetworkConfig', technician, 'the configuration after the change', {}, 200))).toEqual(changed);

    // Without a session: both.
    await expectCall(main, 'getCaptureNetworkConfig', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'updateCaptureNetworkConfig', CONSOLE, 'the web console without a session', { payload: { revision: 2 } }, 401, 'NOT_SIGNED_IN');
    await main.app.pipeline.drain();
    settle();
  });

  it('the commissioning scan (operation 103; task 4 row 107): refused on this Core of itself; with the parts of this file in the place of the composition, the refusals and one scan', async () => {
    fresh(main);
    const technician = web.TECHNICIAN;
    const scanControl = captureFactoryScanControl(main.app);
    interface Scan { addressCount: number; alias: unknown; synthetic: boolean; devices: { address: string; endpointCount: number | null; deviceCount: string }[] }

    // THIS CORE IS SIMULATED and was handed no parts: of itself it scans nothing.
    const notAvailable = await expectCall(main, 'scanFactoryCameras', technician, 'a scan on a Core that is not in production capture', {}, 409, 'INVALID_STATE');
    expect(detailsOf(notAvailable)['reason']).toBe('COMMISSIONING_NOT_AVAILABLE');

    // Its place is taken, once: this Core scans; the host is a table of this file; the temporary address is a
    // recording double that puts the address on that table; the probe answers for ONE address. The rule is the
    // capture unit's own. Nothing is sent anywhere. The order, the refusals before any packet, the device text
    // and "not stored" are the folder's own tests.
    let onPort: string | null = null;
    const asked: string[] = [];
    captureNetworkConfigControl(main.app).replaceForTest({
      available: true,
      interfaces: () => [
        { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
        // R-FLEX (row 138, D23; RG-13): every non-loopback address states a non-zero hardware address (the alias sits on eth1).
        { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24, mac: '02:00:5E:00:53:01' }, ...(onPort === null ? [] : [{ address: onPort, prefixLength: 24, mac: '02:00:5E:00:53:01' }])] },
      ],
    });
    scanControl.replaceForTest({
      available: true,
      gate: createFactoryScanGate(0),
      parts: {
        rule: (address, facts) => decideDestination({ purpose: DestinationPurpose.COMMISSIONING_SCAN, address }, facts),
        alias: {
          helper: async () => null,
          add: async (request) => ((onPort = request.address), { refusal: null, effect: 'DONE' }),
          remove: async () => ((onPort = null), { refusal: null, effect: 'DONE' }),
        },
        probe: async (destination) => (asked.push(`${destination.address} from ${destination.sourceAddress}`), { answered: destination.address === '192.168.7.9', onvifReachable: true }),
      },
    });
    // The camera network is stated (by the area before this one, or here).
    const config = bodyOf<{ configured: boolean; revision: number }>(await expectCall(main, 'getCaptureNetworkConfig', technician, 'the configuration the scan reads', {}, 200));
    if (!config.configured) await expectCall(main, 'updateCaptureNetworkConfig', technician, 'the interface and the subnet are chosen for the scan', { payload: { revision: config.revision, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' } }, 200);

    // The refusals of the body, each asking nothing.
    await expectCall(main, 'scanFactoryCameras', technician, 'a member the body does not have', { payload: { address: '192.168.1.64', port: 8080 } }, 422, 'INVALID_INPUT');
    const refused = await expectCall(main, 'scanFactoryCameras', technician, 'a typed address the destination rule refuses: the Core\'s own', { payload: { address: '192.168.50.1' } }, 422, 'INVALID_INPUT');
    expect(detailsOf(refused)['reason']).toBe('COMMISSIONING_ADDRESS_NOT_ALLOWED');
    expect(asked).toEqual([]);

    // The scan: the stored list and one typed address; the temporary address is gone when it answers.
    const scan = bodyOf<Scan>(await expectCall(main, 'scanFactoryCameras', technician, 'the stored list and one typed address', { payload: { address: '192.168.7.9' } }, 200));
    expect(scan).toMatchObject({ addressCount: 5, alias: null, synthetic: false, devices: [{ address: '192.168.7.9', endpointCount: null, deviceCount: 'NOT_KNOWN' }] });
    // Row V6 (R119-03): the scan states what it KNOWS - the probe did not count, so no answer says "one" or "no conflict".
    expect(JSON.stringify(scan)).not.toContain('"conflict"');
    expect(asked).toContain('192.168.7.9 from 192.168.7.253');
    expect(onPort).toBeNull();

    // Without a session.
    await expectCall(main, 'scanFactoryCameras', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    // The parts of this file are taken out again: the Core is as it booted.
    scanControl.replaceForTest({ available: false, parts: null });
    await main.app.pipeline.drain();
    settle();
  });

  it('the alias state and its removal (operations 104 and 105; task 4 row 106b): the plain read; a removal refused on this Core of itself; with a lifecycle of this file in the place of the composition, the refusals and one removal', async () => {
    fresh(main);
    const technician = web.TECHNICIAN;
    const aliasControl = captureHostAliasControl(main.app);

    // 104: a plain read of the journal's one open row, on every Core. None is in place on this one.
    expect(bodyOf<{ alias: unknown }>(await expectCall(main, 'getHostAlias', technician, 'no alias address is in place', {}, 200))).toEqual({ alias: null });
    // THIS CORE IS SIMULATED and was handed no lifecycle: of itself it removes nothing.
    const notAvailable = await expectCall(main, 'removeHostAlias', technician, 'a removal on a Core that is not in production capture', {}, 409, 'INVALID_STATE');
    expect(detailsOf(notAvailable)['reason']).toBe('COMMISSIONING_NOT_AVAILABLE');

    // Its place is taken, once: this Core removes, and the lifecycle is a double of this file that answers from a
    // list. Nothing is asked of any helper. The lifecycle, its helper double, its two audit entries per action and the
    // refusal while a session is open are the folder's own tests and the composition's (`capture-composition.db.test.ts`).
    const answers: ({ ok: true; removed: boolean } | { ok: false; refusal: string; stillInPlace: boolean })[] = [
      { ok: true, removed: false },
      { ok: false, refusal: 'HELPER_TIMED_OUT', stillInPlace: true },
      { ok: true, removed: true },
    ];
    const asked: unknown[] = [];
    aliasControl.replaceForTest({
      available: true,
      remover: {
        release: async (request) => (asked.push(request.removeReason), answers.shift() ?? { ok: true, removed: false }),
        shutdown: async () => undefined,
      },
    });
    const none = await expectCall(main, 'removeHostAlias', technician, 'none is in place', {}, 409, 'INVALID_STATE');
    expect(detailsOf(none)['reason']).toBe('HOST_ALIAS_NOT_PRESENT');
    const failed = await expectCall(main, 'removeHostAlias', technician, 'the helper did not remove it', {}, 409, 'INVALID_STATE');
    expect([detailsOf(failed)['reason'], detailsOf(failed)['cause']]).toEqual(['HOST_ALIAS_REMOVE_FAILED', 'HELPER_TIMED_OUT']);
    expect(bodyOf<{ alias: unknown }>(await expectCall(main, 'removeHostAlias', technician, 'the alias address is removed', {}, 200))).toEqual({ alias: null });
    expect(asked).toEqual(['MANUAL', 'MANUAL', 'MANUAL']);

    // Without a session: both.
    await expectCall(main, 'getHostAlias', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'removeHostAlias', CONSOLE, 'the web console without a session', {}, 401, 'NOT_SIGNED_IN');
    // The double is taken out again: the Core is as it booted.
    aliasControl.replaceForTest({ available: false, remover: null });
    await main.app.pipeline.drain();
    settle();
  });

  it('the set-IP job (operations 106 and 107; task 4 row 111): refused on this Core of itself; with the parts of this file in the place of the composition, the refusals, one job and its read', async () => {
    fresh(main);
    const technician = web.TECHNICIAN;
    const jobControl = captureCameraNetworkControl(main.app);
    // What "the technician types" in this area: drawn at run time, written nowhere.
    const typed = { username: `fixture${randomUUID().replaceAll('-', '').slice(0, 12)}`, secret: `fixture ${randomUUID()}` };
    const FROM = '192.168.1.64';
    const MAC = '02:00:5E:00:53:11';
    interface Job { jobId: string; state: string; step: string; fromAddress: string; toAddress: string | null; neighbourMac: string | null; confirmedMac: string | null; deviceId: string | null; failure: string | null }

    // THIS CORE IS SIMULATED and was handed no parts: of itself it changes no camera.
    const notAvailable = await expectCall(main, 'setCameraNetwork', technician, 'a job on a Core that is not in production capture', { payload: { fromAddress: FROM, scannedMac: MAC, credential: typed } }, 409, 'INVALID_STATE');
    expect(detailsOf(notAvailable)['reason']).toBe('COMMISSIONING_NOT_AVAILABLE');

    // Its place is taken, once: this Core changes a camera address; the host is a table of this file; the camera, the
    // alias address, the neighbour table and "does it answer" are doubles; the two rules are the capture unit's own and
    // the guard is a limits object of the connection tests on the wall clock. Nothing is sent anywhere. The order, every
    // way out, the guard and the count-only search for what was typed are the folder's own tests.
    let onPort: string | null = null;
    let moved = false;
    const asked: string[] = [];
    const guard = createConnectionTestLimits({ now: () => Date.now() });
    captureNetworkConfigControl(main.app).replaceForTest({
      available: true,
      interfaces: () => [
        { name: 'lo', internal: true, addresses: [{ address: '127.0.0.1', prefixLength: 8 }] },
        // R-FLEX (row 138, D23; RG-13): every non-loopback address states a non-zero hardware address (the alias sits on eth1).
        { name: 'eth1', internal: false, addresses: [{ address: '192.168.50.1', prefixLength: 24, mac: '02:00:5E:00:53:01' }, ...(onPort === null ? [] : [{ address: onPort, prefixLength: 24, mac: '02:00:5E:00:53:01' }])] },
      ],
    });
    jobControl.replaceForTest({
      available: true,
      // Row V6 (R119-03): as the product's scan today, the count of the camera's address is NOT KNOWN; the row showed its hardware address.
      scan: {
        claim: () => () => undefined,
        // The scan is "just made" on the Core's own clock: the job holds its age to that clock (`CAMERA_SCAN_TOO_OLD`).
        lastScanOf: (address) =>
          address === FROM ? { deviceCount: 'NOT_KNOWN', mac: MAC, scannedAt: main.app.clock.now() } : address === '192.168.1.108' ? { deviceCount: 'MORE_THAN_ONE', mac: MAC, scannedAt: main.app.clock.now() } : null,
      },
      parts: {
        camera: {
          rule: (address, facts) => decideDestination({ purpose: DestinationPurpose.SET_IP, address }, facts),
          newAddress: (request, context) => decideNewCameraAddress(request, context),
          poll: async (destination) => (asked.push(`poll ${destination.address} from ${String(destination.sourceAddress)}`), { answered: destination.address === FROM ? !moved : moved }),
          set: async (call) => {
            asked.push(`set ${call.address} -> ${call.assignment.address}/${String(call.assignment.prefixLength)}`);
            if (!call.admitHwAddress(MAC)) return { outcome: 'NOT_SET', reason: 'HW_ADDRESS_REFUSED', rejectedCredentialRequests: 0 };
            moved = true;
            return { outcome: 'SET', reason: null, rejectedCredentialRequests: 0 };
          },
        },
        alias: {
          helper: async () => null,
          add: async (request) => ((onPort = request.address), { refusal: null, effect: 'DONE' }),
          remove: async () => ((onPort = null), { refusal: null, effect: 'DONE' }),
        },
        guard: () => guard,
        inputs: { neighbour: async () => MAC, answers: async (address) => address === FROM },
      },
    });
    // The camera network is stated (by an area before this one, or here).
    const config = bodyOf<{ configured: boolean; revision: number }>(await expectCall(main, 'getCaptureNetworkConfig', technician, 'the configuration the job reads', {}, 200));
    if (!config.configured) await expectCall(main, 'updateCaptureNetworkConfig', technician, 'the interface and the subnet are chosen for the job', { payload: { revision: config.revision, interfaceName: 'eth1', cameraSubnet: '192.168.50.0/24' } }, 200);

    // The refusals, each asking nothing of the camera.
    await expectCall(main, 'setCameraNetwork', technician, 'a member the body does not have', { payload: { fromAddress: FROM, scannedMac: MAC, credential: typed, prefixLength: 16 } }, 422, 'INVALID_INPUT');
    // Row V6 (R119-04): the hardware address of the scan row is a REQUIRED member; the body of the first contract is refused.
    await expectCall(main, 'setCameraNetwork', technician, 'a body without the hardware address the technician saw', { payload: { fromAddress: FROM, credential: typed } }, 422, 'INVALID_INPUT');
    const unbound = await expectCall(main, 'setCameraNetwork', technician, 'another hardware address than the scan row showed', { payload: { fromAddress: FROM, scannedMac: '02:00:5E:00:53:99', credential: typed } }, 409, 'INVALID_STATE');
    expect(detailsOf(unbound)['reason']).toBe('CAMERA_HARDWARE_ADDRESS_NOT_BOUND');
    const own = await expectCall(main, 'setCameraNetwork', technician, 'a present address the destination rule refuses: the Core\'s own', { payload: { fromAddress: '192.168.50.1', scannedMac: MAC, credential: typed } }, 422, 'INVALID_INPUT');
    expect(detailsOf(own)['reason']).toBe('COMMISSIONING_ADDRESS_NOT_ALLOWED');
    const conflict = await expectCall(main, 'setCameraNetwork', technician, 'the last scan saw more than one device at the present address', { payload: { fromAddress: '192.168.1.108', scannedMac: MAC, credential: typed } }, 409, 'INVALID_STATE');
    expect(detailsOf(conflict)['reason']).toBe('CAMERA_ADDRESS_CONFLICT');
    expect(asked).toEqual([]);

    // The job: the next free address of the camera subnet; the alias address is gone when it has ended.
    const started = bodyOf<Job>(await expectCall(main, 'setCameraNetwork', technician, 'the camera at a factory address, the next free address', { payload: { fromAddress: FROM, scannedMac: MAC, credential: typed } }, 202));
    expect(started).toMatchObject({ state: 'RUNNING', fromAddress: FROM, scannedMac: MAC, deviceCount: 'NOT_KNOWN', deviceId: null, failure: null });
    expect(JSON.stringify(started)).not.toContain(typed.secret);
    await jobControl.idle();
    cameraNetworkJobId = started.jobId;
    const ended = bodyOf<Job>(await expectCall(main, 'getCameraNetworkJob', technician, 'the job, after it ended', { id: started.jobId }, 200));
    expect(ended).toMatchObject({ jobId: started.jobId, state: 'COMPLETED', step: 'DONE', fromAddress: FROM, toAddress: started.toAddress, neighbourMac: MAC, confirmedMac: MAC, deviceId: null, failure: null });
    expect(asked[0]).toBe(`poll ${FROM} from 192.168.1.253`);
    expect(asked).toContain(`set ${FROM} -> ${String(started.toAddress)}/24`);
    expect(onPort).toBeNull();

    // The read: an id nobody was given, and an id that is none.
    await expectCall(main, 'getCameraNetworkJob', technician, 'an id no job has', { id: started.jobId === 'CNJ-000000' ? 'CNJ-000001' : 'CNJ-000000' }, 404, 'NOT_FOUND');
    await expectCall(main, 'getCameraNetworkJob', technician, 'a malformed {id}', { id: 'cnj-1' }, 422, 'INVALID_INPUT');
    // Without a session: both.
    await expectCall(main, 'setCameraNetwork', CONSOLE, 'the web console without a session', { payload: { fromAddress: FROM, scannedMac: MAC, credential: typed } }, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'getCameraNetworkJob', CONSOLE, 'the web console without a session', { id: started.jobId }, 401, 'NOT_SIGNED_IN');
    // The doubles are taken out again: the Core is as it booted.
    jobControl.replaceForTest({ available: false, parts: null, scan: null });
    await main.app.pipeline.drain();
    settle();
  });

  it('the installation acceptance (operations 109 and 110; task 4 row 117): on the Core\'s own diagnostics run - the refusals, one acceptance, the second one the database refuses, its revocation', async () => {
    fresh(main);
    const technician = web.TECHNICIAN;
    interface Acceptance { acceptanceId: string; acceptedBy: string; revokedAt: number | null; revokeReason: string | null; diagnostics: { completedAt: number } }
    // Row V6 (R119-07): the steps are the contract's closed list, every check once with its result.
    const steps = INSTALLATION_ACCEPTANCE_STEP_IDS.map((id) => ({ id, result: 'PASS', detail: null }));

    // A run that has not ended is not recorded: the Core copies a run as it WAS, so one must have ended.
    await expectCall(main, 'runDiagnostics', technician, 'a diagnostics run for the acceptance', {}, 202);
    const notComplete = await expectCall(main, 'acceptInstallation', technician, 'an acceptance while the diagnostics run', { payload: { steps } }, 409, 'INVALID_STATE');
    expect(detailsOf(notComplete)['reason']).toBe('INSTALLATION_DIAGNOSTICS_NOT_COMPLETE');
    const nothing = await expectCall(main, 'revokeInstallationAcceptance', technician, 'a revocation with no acceptance in force', { payload: { reason: 'The Core was moved to another room.' } }, 409, 'INVALID_STATE');
    expect(detailsOf(nothing)['reason']).toBe('INSTALLATION_ACCEPTANCE_NOT_IN_FORCE');
    await main.drive(10 * SECOND);

    // The refusals of the bodies (no free JSON: a member outside the closed key list), each storing nothing.
    await expectCall(main, 'acceptInstallation', technician, 'a step with a member outside its key list', { payload: { steps: [{ ...steps[0], code: 'X1' }, ...steps.slice(1)] } }, 422, 'INVALID_INPUT');
    // THE STEP LIST IS THE CONTRACT'S: an empty list, the steps of the first contract, a missing and an unknown check are each refused.
    await expectCall(main, 'acceptInstallation', technician, 'an empty step list', { payload: { steps: [] } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'acceptInstallation', technician, 'a step a client chose', { payload: { steps: [{ id: 'CAMERAS_ASSIGNED', passed: true, detail: null }] } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'acceptInstallation', technician, 'a check of the list is missing', { payload: { steps: steps.slice(1) } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'acceptInstallation', technician, 'a check outside the list', { payload: { steps: [{ id: '9A/H-28', result: 'PASS', detail: null }, ...steps.slice(1)] } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'acceptInstallation', technician, 'the diagnostics sent by the client', { payload: { steps, diagnostics: {} } }, 422, 'INVALID_INPUT');
    await expectCall(main, 'revokeInstallationAcceptance', technician, 'a reason of three characters', { payload: { reason: 'abc' } }, 422, 'INVALID_INPUT');

    // The acceptance (200), and a second one, which the DATABASE refuses while the first is in force.
    const accepted = bodyOf<Acceptance>(await expectCall(main, 'acceptInstallation', technician, 'the steps and the address of the site', { payload: { siteAddress: 'Example street 1\nExample city', steps } }, 200));
    expect(accepted).toMatchObject({ acceptedBy: operatorIdOf('TECHNICIAN'), revokedAt: null, revokeReason: null });
    expect(accepted.diagnostics.completedAt).toBeGreaterThan(0);
    const inForce = await expectCall(main, 'acceptInstallation', technician, 'a second acceptance while one is in force', { payload: { steps } }, 409, 'INVALID_STATE');
    expect(detailsOf(inForce)['reason']).toBe('INSTALLATION_ACCEPTANCE_IN_FORCE');

    // The revocation (200): the same record, with who, when and why; then nothing is in force again.
    const revoked = bodyOf<Acceptance>(await expectCall(main, 'revokeInstallationAcceptance', technician, 'the acceptance in force is revoked', { payload: { reason: 'The Core was moved to another room.' } }, 200));
    expect(revoked).toMatchObject({ acceptanceId: accepted.acceptanceId, revokeReason: 'The Core was moved to another room.' });
    expect(revoked.revokedAt).not.toBeNull();

    // Without a session: both. (The idle lock of both is area 4, where a session is open; the roles,
    // the rollback, two requests at the same moment and the audit rows are the folder's own tests.)
    await expectCall(main, 'acceptInstallation', CONSOLE, 'the web console without a session', { payload: { steps } }, 401, 'NOT_SIGNED_IN');
    await expectCall(main, 'revokeInstallationAcceptance', CONSOLE, 'the web console without a session', { payload: { reason: 'The Core was moved to another room.' } }, 401, 'NOT_SIGNED_IN');
    await main.app.pipeline.drain();
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
    await expectCall(main, 'beginPrecheck', investigator, 'the twelve checks start', { id: blockedId }, 202);
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
    // D59 (revocation row of §2.1): the holder that reaches the lock is the TECHNICIAN - SUPERVISOR is refused by stage 6 first.
    await expectCall(main, 'updateCaptureConfig', technician, 'a selector edit during a session', { payload: { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] } }, 409, 'CAPTURE_CONFIG_LOCKED');
    await expectCall(main, 'setCaptureCameraSource', technician, 'a camera assignment during a session', { id: 'CAM-01', payload: { trackId: 'VIDEO-01' } }, 409, 'CAPTURE_CONFIG_LOCKED');
    await expectCall(main, 'setPrimaryMic', technician, 'a primary microphone change during a session', { id: 'MIC-01' }, 409, 'CAPTURE_CONFIG_LOCKED');
    await expectCall(main, 'setCaptureDeviceCredential', technician, 'a camera credential during a session', { id: 'CAM-03', payload: exampleBody(operationOf('setCaptureDeviceCredential')) }, 409, 'CAPTURE_CONFIG_LOCKED');
    // Task 4 row 146b: and the stored-credential connection test (operation 108) - a second connection to a camera that may be recording.
    await expectCall(main, 'testCaptureDeviceConnection', technician, 'a stored-credential connection test during a session', { id: 'CAM-03' }, 409, 'CAPTURE_CONFIG_LOCKED');
    // Task 4 row 117: and the installation acceptance and its revocation (operations 109 and 110) - idle only.
    await expectCall(main, 'acceptInstallation', web.TECHNICIAN, 'an installation acceptance during a session', { payload: { steps: INSTALLATION_ACCEPTANCE_STEP_IDS.map((id) => ({ id, result: 'PASS', detail: null })) } }, 409, 'CAPTURE_CONFIG_LOCKED');
    await expectCall(main, 'revokeInstallationAcceptance', web.TECHNICIAN, 'a revocation of the acceptance during a session', { payload: { reason: 'The Core was moved to another room.' } }, 409, 'CAPTURE_CONFIG_LOCKED');

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

  it('C3 §2.7 (operations 112 to 119; RB-9 as amended by D54, the D57c panel pair, D59): the vendor trio, the preview session and its refusals, the idle-meters lease, the panel words', async () => {
    fresh(main);
    const supervisor = web.SUPERVISOR;
    const technician = web.TECHNICIAN;
    // THE SEED HOLDS NO VENDOR ACCOUNT, so this file renames the seeded SUPERVISOR into `root` - the pattern of
    // `modules/admin/__tests__/vendor-trio.db.test.ts` (RB-9 as amended; D59: the identity rules are facts of the
    // ACCOUNT, applied by the handler units, not by stage 6). The rename stands for the rest of the file: block 4
    // reads the panel setup as the same account, and no later walk names the old username.
    await owner().query("UPDATE public.operators SET username = 'root' WHERE id = $1", [operatorIdOf('SUPERVISOR')]);

    // ── 112 to 114: the vendor trio. A created account is born without a credential (U19) and is deleted again.
    const NEW = { username: 'w52.vendor', name: 'Vendor Testaccount', displayName: 'Vendor Testaccount', initials: 'VT', role: 'INVESTIGATOR', reason: 'Acceptance walk of the RB-9 trio' };
    const created = await expectCall(main, 'createUser', supervisor, 'the vendor root creates an account', { payload: NEW }, 200);
    expect(bodyOf<{ username: string; enabled: boolean }>(created)).toMatchObject({ username: 'w52.vendor', enabled: true });
    const newId = bodyOf<{ id: string }>(created).id;
    const profiled = await expectCall(main, 'updateUser', supervisor, 'the profile of the new account', { id: newId, payload: { name: 'Vendor Renamed', reason: 'Acceptance walk of the RB-9 trio' } }, 200);
    expect(bodyOf<{ name: string }>(profiled).name).toBe('Vendor Renamed');
    await expectCall(main, 'updateUser', supervisor, 'an operator the Core does not have', { id: 'OPR-999', payload: { name: 'Nobody' } }, 404, 'NOT_FOUND');
    // The second gate of D54 as amended: a holder of USER_ADMIN whose account is not `root` never reaches a unit.
    await expectCall(main, 'assignUserRole', supervisor, 'the INVESTIGATOR covers as a SUPERVISOR', { id: operatorIdOf('INVESTIGATOR'), payload: { role: 'SUPERVISOR', reason: 'Covers the interview shift this week' } }, 200);
    const gated = await expectCall(main, 'createUser', web.INVESTIGATOR, 'USER_ADMIN without the root username is the identity refusal (no row)', { payload: { ...NEW, username: 'w52.gate' } }, 403, 'NOT_PERMITTED');
    expect(bodyOf<{ error: { message: string } }>(gated).error.message).toBe('Only the root account may create, edit or delete an operator.');
    await expectCall(main, 'assignUserRole', supervisor, 'and an INVESTIGATOR again', { id: operatorIdOf('INVESTIGATOR'), payload: { role: 'INVESTIGATOR' } }, 200);
    const removed = await expectCall(main, 'deleteUser', supervisor, 'the test account goes again', { id: newId, payload: { confirm: 'w52.vendor', reason: 'Acceptance walk of the RB-9 trio' } }, 200);
    expect(bodyOf<{ operatorId: string; username: string; credentialsRemoved: number }>(removed)).toMatchObject({ operatorId: newId, username: 'w52.vendor', credentialsRemoved: 0 });
    await expectCall(main, 'deleteUser', supervisor, 'an operator the Core does not have', { id: 'OPR-999', payload: { confirm: 'nobody' } }, 404, 'NOT_FOUND');
    // RB-8 stands over the delete too: the last enabled USER_ADMIN holder cannot go.
    await expectCall(main, 'deleteUser', supervisor, 'the last holder of USER_ADMIN cannot be deleted', { id: operatorIdOf('SUPERVISOR'), payload: { confirm: 'root', reason: 'Acceptance walk of the RB-9 trio' } }, 409, 'LAST_ADMIN');

    // Row 133 cycle 3 (decision D107, finding F-DBW2-1): the two 409s row 133 documented, PRODUCED here.
    // (a) D51: an account whose purge KEEPS it (it wrote an evidence-chain row, D38 DR-1) is terminal - op 13 refuses it.
    //     The evidence-chain row is written through the Core's own unit of work (one of the simulator's types, as the
    //     purge db test does), so the chain and the engine's ring stay one; the purge re-seals and the engine adopts it (row 94).
    const keptCreated = await expectCall(main, 'createUser', supervisor, 'an account that will write an evidence-chain row', { payload: { ...NEW, username: 'w52.kept' } }, 200);
    const keptId = bodyOf<{ id: string }>(keptCreated).id;
    await main.app.pipeline.run('w52.fixture.keptRow', (unit) => unit.audit.append({ type: 'AUDIT_EXPORTED', message: 'Audit log exported.', actorId: keptId, deviceId: null, details: {} }));
    await main.app.pipeline.drain();
    const keptPurge = await expectCall(main, 'deleteUser', supervisor, 'its purge keeps the account, disabled (D38 DR-1)', { id: keptId, payload: { confirm: 'w52.kept', reason: 'Acceptance walk of D51' } }, 200);
    expect(bodyOf<{ accountKept: boolean }>(keptPurge).accountKept).toBe(true);
    const terminal = await expectCall(main, 'enableUser', supervisor, 'a purge-kept account is terminal (D51)', { id: keptId, payload: { reason: 'Acceptance walk of D51' } }, 409, 'INVALID_STATE');
    expect(detailsOf(terminal)['reason']).toBe('PURGE_KEPT');
    // (b) DF-29: the system principal OPR-000 is never edited. The seed holds no such row, so the installer's row (D62:
    //     `system`, no credential) is put in for this one call and taken out again; a refusal writes nothing that names it.
    const systemInserted = (await owner().query(
      "INSERT INTO public.operators (id, username, name, display_name, initials, role_id, enabled, created_at, updated_at) SELECT 'OPR-000', 'system', 'System', 'System', 'SYS', 'TECHNICIAN', true, created_at, created_at FROM public.operators WHERE id = $1 ON CONFLICT DO NOTHING RETURNING id",
      [operatorIdOf('SUPERVISOR')],
    )).rows.length;
    const systemEdit = await expectCall(main, 'updateUser', supervisor, 'the system principal OPR-000 is never edited (DF-29)', { id: 'OPR-000', payload: { name: 'Renamed System', reason: 'Acceptance walk of DF-29' } }, 409, 'INVALID_STATE');
    expect(detailsOf(systemEdit)['reason']).toBe('SYSTEM_PRINCIPAL');
    if (systemInserted === 1) await owner().query("DELETE FROM public.operators WHERE id = 'OPR-000'");

    // ── 115 and the preview route's issuer: refusals first, then one session with the manager of production
    // capture taken from the composition's place (its parts are doubles of this file; the stream itself, the
    // token's binding and the cut rules are `src/camera-preview`'s own tests).
    await expectCall(main, 'createCameraPreviewSession', technician, 'a malformed {id}', { id: 'cam 01' }, 422, 'INVALID_INPUT');
    await expectCall(main, 'createCameraPreviewSession', technician, 'a device the capture registry does not hold', { id: 'CAM-99' }, 404, 'NOT_FOUND');
    const noPreview = await expectCall(main, 'createCameraPreviewSession', technician, 'a Core with no live preview (nothing was provided)', { id: 'CAM-01' }, 409, 'INVALID_STATE');
    expect(detailsOf(noPreview)['reason']).toBe('PREVIEW_NOT_AVAILABLE');
    // ── 113: the lease of the idle meters - the same order: refused on this Core of itself, then with the double.
    const noMeters = await expectCall(main, 'holdIdleMeters', supervisor, 'a Core with no idle meters (nothing was provided)', {}, 409, 'INVALID_STATE');
    expect(detailsOf(noMeters)['reason']).toBe('IDLE_METERS_NOT_AVAILABLE');
    cameraPreview(main.app).replaceForTest({
      manager: () => ({ join: () => ({ joined: false, reason: 'IDLE' }), wouldRefuse: () => null }),
      idleMeters: () => ({ hold: () => ({ expiresAt: main.clock.now() + 60_000 }) }),
    });
    // AS A FIXTURE the built-in camera takes the production adapter kind for this call (the same fixture the
    // stored-credential test of operation 108 uses above): a live preview is made of an ONVIF_RTSP camera.
    await owner().query("UPDATE public.capture_devices SET adapter_kind = 'ONVIF_RTSP' WHERE id = 'CAM-01'");
    try {
      const opened = await expectCall(main, 'createCameraPreviewSession', technician, 'a preview session of the production camera', { id: 'CAM-01' }, 201);
      expect(String(bodyOf<{ url: string }>(opened).url)).toMatch(/^http:\/\/127\.0\.0\.1:4420\/preview\/cps_[A-Za-z0-9_-]{43}$/);
      expect(typeof bodyOf<{ expiresAt: number }>(opened).expiresAt).toBe('number');
      const lease = await expectCall(main, 'holdIdleMeters', supervisor, 'the idle-meters lease of the operator', {}, 200);
      expect(typeof bodyOf<{ expiresAt: number }>(lease).expiresAt).toBe('number');
    } finally {
      await owner().query("UPDATE public.capture_devices SET adapter_kind = 'FAKE' WHERE id = 'CAM-01'");
      cameraPreview(main.app).replaceForTest({ manager: () => null, idleMeters: () => null }); // the Core is as it booted
    }
    // (The preview route `GET /preview/{token}` streams what the manager joins: registry-external, held to the
    // rule of operation 115 by block 1, and walked by `src/camera-preview`'s own tests - no documented status
    // of the registry waits on it here.)

    // ── 117 to 119: the panel words, through the fake backend every server of this file stands behind.
    const firmware = await expectCall(main, 'getPanelFirmware', CONSOLE, 'the panel states its own word (no session: PUBLIC)', {}, 200);
    expect(bodyOf<{ panelFirmware: string; verdict: string }>(firmware)).toEqual({ panelFirmware: 'FW-TEST', verdict: 'ok' });
    const setup = await expectCall(main, 'getPanelSetup', supervisor, 'the vendor account reads the pre-delivery setup', {}, 200);
    expect(bodyOf<{ satker: string; clientLogoSaved: boolean }>(setup)).toMatchObject({ satker: 'LP acceptance', clientLogoSaved: true });
    const changed = await expectCall(main, 'setPanelSetup', supervisor, 'the vendor account changes the unit word', { payload: { satker: 'LP W52', reason: 'Acceptance walk of the panel module' } }, 200);
    expect(bodyOf<{ satker: string }>(changed).satker).toBe('LP W52');
    expect(bodyOf<{ satker: string }>(await expectCall(main, 'getPanelSetup', supervisor, 'the read after the change', {}, 200)).satker).toBe('LP W52');
    // The identity gate of D57c on the panel pair: a signed-in web console that is no vendor account is refused
    // before a byte is forwarded (no row) - the INVESTIGATOR reaches the route and stops at the gate.
    await expectCall(main, 'getPanelSetup', web.INVESTIGATOR, 'a signed-in account that is no vendor account', {}, 403, 'NOT_PERMITTED');
    await main.app.pipeline.drain();
    settle();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 3. The answers every operation shares: generated from the registry (AC-B-14)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-14: the refusals of the stages, generated for every operation of the registry', () => {
  it('401 NOT_SIGNED_IN: every operation that is not PUBLIC, called without a credential', async () => {
    const guarded = OPERATIONS.filter((operation) => operation.access.kind !== CoreApiAccessKind.PUBLIC);
    // 119 operations, five of them PUBLIC since the D54 panel-firmware read joined them (C3 §2.7, operation 117):
    // the pin read 71 of the 75 of the base; 103 of 107 until task 4 row V3 added operation 108;
    // 104 of 108 until task 4 row 116 added operations 109 and 110; 106 of 110 until task 4 row RD2 added operation 111;
    // 114 of 119 since C3 §2.7 (the eight of RB-9 as amended and D57c, one PUBLIC among them).
    expect(OPERATIONS.length - guarded.length).toBe(5);
    expect(guarded).toHaveLength(114);
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
      const lacking = ROLES.find((role) => permissions.length > 0 && lacksAllOf(role, permissions));
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

  it('403 DEMO_DISABLED: the five demo operations on a server whose demo flag is off; 403 NOT_PERMITTED on the eleven operations whose permission every seeded role holds, with the grant taken away in the clone', async () => {
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

    // Finding F49: every seeded role holds EVIDENCE_VIEW and DIAGNOSTICS_RUN, and since C3 §2.7 the two
    // any-of cells of D54 (the preview session, the idle-meters lease) are reachable by every role on one of
    // SESSION_START, CAPTURE_CONFIG or DEVICE_MANAGE - eleven operations have no denied caller on a seeded
    // server. The grants are read from PostgreSQL with every request (RB-2): taken away in THIS clone, as
    // `dems_owner` - EVIDENCE_VIEW, DIAGNOSTICS_RUN and SESSION_START from the INVESTIGATOR, the three that
    // close all eleven rules - the next request is refused.
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
      // C3 §2.7 (D54): the two any-of cells every role reaches on one of its permissions.
      'createCameraPreviewSession',
      'holdIdleMeters',
    ]);
    for (const permission of ['EVIDENCE_VIEW', 'DIAGNOSTICS_RUN', 'SESSION_START']) {
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
    // Task 4 row 102: the registry held 39 GET operations; three of them (the configuration read, the
    // alias state and the job state: operations 101, 104, 107) had no route yet (`LANDED_UNROUTED`,
    // rows 108, 106 and 111) and answered the router's 404, which is no answer of a handler. The walk is
    // over the ROUTED reads, and both counts are pinned: a read that gains its route joins the walk.
    // C3 §2.7 (2026-11-04): the panel pair of D54/D57c - operations 117 and 118 - are two more reads, 41;
    // the registry holds one unrouted operation and it is a POST, so all 41 are walked.
    expect(OPERATIONS.filter((operation) => operation.method === 'get')).toHaveLength(41);
    // Task 4 row 108: the configuration read (operation 101) has its route and joined the walk: two unrouted reads, 37 walked.
    // Task 4 row 106b: the alias state (operation 104) has its route and joined the walk: one unrouted read, 38 walked.
    // Task 4 row 111: the job state (operation 107) has its route and joined the walk: no unrouted read, 39 walked.
    expect(UNROUTED_OPERATIONS.filter((operation) => operation.method === 'get').map((operation) => operation.operationId)).toEqual([]);
    const reads = ROUTED_OPERATIONS.filter((operation) => operation.method === 'get');
    // The 41 routed GET operations (the pin read 27, the base's; AC-B-09's first block holds 41 / 78 for the registry).
    expect(reads).toHaveLength(41);
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
    const ids: Readonly<Record<string, string>> = { getEvidence: sealedEvidenceId, listAudioSourceIntervals: openSessionId, getSealingProgress: openSessionId, getEvidenceExportJob: exportJobId, getTranscript: transcriptEvidenceId, listTranscriptRevisions: transcriptEvidenceId, getCameraNetworkJob: cameraNetworkJobId };
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
        // C3 §2.7 (2026-11-04): a rule whose conditions refuse a tablet session is not read from one - the panel
        // setup of D57c is web-console-only and vendor-account-only, and the rule itself says so.
        const refusesTablet = (operation.access.conditions ?? []).some((condition) => condition === CoreApiAccessCondition.WEB_CONSOLE_SESSION || condition === CoreApiAccessCondition.VENDOR_ACCOUNT || condition === CoreApiAccessCondition.DEVICE_SESSION);
        if (operation.access.kind === CoreApiAccessKind.AUTHENTICATED && !refusesTablet) callers.push(tabletSession);
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

    // Task 4 row 102 (NAMED DEFERRAL, pinned by literal): a free-text member of an operation that has
    // no route yet cannot be refused by its route - the router answers 404. The members below are
    // walked when their operation is routed (`setCameraNetwork`: task 4 row 111) and this list is
    // then empty; a member that appears here or leaves it without that row fails the equality.
    // Task 4 row 116 (NAMED DEFERRAL, pinned by literal): the three free-text members of operations 109
    // and 110 - the site address, a step's note and the reason of a revocation - are walked when row
    // 117 routes `acceptInstallation` and `revokeInstallationAcceptance`, and leave this list then.
    // Task 4 row 117: both are routed; the three members left the literal and are walked below.
    const unroutedFreeText = freeText.filter((member) => UNROUTED_OPERATIONS.some((operation) => operation.operationId === member.operationId));
    // Task 4 row 111: `setCameraNetwork` is routed; its two members left the literal and are walked below.
    expect(unroutedFreeText.map((member) => `${member.operationId} ${member.where}.${member.path.join('.')}`)).toEqual([]);
    const walkedFreeText = freeText.filter((member) => !unroutedFreeText.includes(member));
    const ordered = [...walkedFreeText].sort((a, b) => Number(['addSessionNote', 'revokeDevice', 'redeemPairingCode'].includes(b.operationId)) - Number(['addSessionNote', 'revokeDevice', 'redeemPairingCode'].includes(a.operationId)));
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
    expect(refused).toBe(walkedFreeText.filter((member) => member.where === 'body').length * 2 + walkedFreeText.filter((member) => member.where === 'query').length);
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
// Task 4 (blueprint row 96): the list is EMPTY. Row 96 built the typed-address probe; the Core answers
// operation 93's 422 for a body outside its schema and for an address its destination rule refuses, and
// the camera-search area of this file produces both with real requests. The entry
// `'startCaptureDiscovery 422'` was taken out with that row, as this comment announced.
const LANDED_UNANSWERED: Readonly<Record<string, string>> = {};
// Row 133 cycle 3 (decision D107, finding F-DBW2-1): a documented response that only a Core in its OWN capture
// answers (op 50's 409 COMMAND_UNSUPPORTED / DEVICE_COMMAND_NOT_AVAILABLE, rows 125 cycle 2 and CS2). This file
// runs the simulated lane, where `isOwnCaptureCoreState` is false, so the cell cannot be produced here; the refusal
// itself is held by the unit tests of the devices module. A produced cell makes the entry `stale` and fails.
const OWN_CAPTURE_ONLY: Readonly<Record<string, string>> = {
  'identifyDevice 409': 'refused only on an own-capture Core; the acceptance harness runs the simulated lane',
};
const NOT_PRODUCED: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    UNROUTED_OPERATIONS.flatMap((operation) =>
      listCoreApiResponseStatuses(operation, 'all').map((status) => [`${operation.operationId} ${status}`, `no route until ${UNROUTED_UNTIL[routeKey(operation.method, operation.path)] ?? 'a row that is not named'} (LANDED_UNROUTED)`]),
    ),
  ),
  ...LANDED_UNANSWERED,
  ...OWN_CAPTURE_ONLY,
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
  it('AC-B-70: every answer that lists audio lists exactly the four session tracks or the four mic channels (SH-17, D61); the device registry of operation 77 lists the four built-ins first and then every registered microphone', () => {
    // Schema v2 re-keys the audio READS by the physical inputs (C3 §3, ops 44/45: `audio[]` and
    // `channels[]` carry `inputId`, never merged), while the session tracks are the sealed
    // AUDIO-01..AUDIO-04. D61 (2026-11-04, ruling of the four simultaneous microphone channels):
    // both lists carry FOUR members in order and nothing else.
    //
    // CORRECTED BY DECISION C43 (2) (task 4 rows 185 / 190; integration pass I-7). The device
    // REGISTRY (operation 77, `devices`) is no list of the inputs of a recording: it is every
    // device the Core holds, and a microphone registered through operation 99 is one of them. Its
    // microphones are held to their own rule - the built-in FOUR channels first, in order (D61),
    // then registered microphones `MIC-NN` in rising number, none twice - and this file must have
    // seen the registry WITH a registered microphone, so that the rule is not met by an empty case.
    const REGISTRY_PLACE = 'getCaptureDevices devices';
    const registryRule = (ids: readonly string[]): boolean => {
      const numbers = ids.map((id) => /^MIC-(\d{2,})$/.exec(id)?.[1]).map((digits) => (digits === undefined ? Number.NaN : Number(digits)));
      // D61 (2026-11-04): the pair became the four numbered built-ins.
      return ids[0] === 'MIC-01' && ids[1] === 'MIC-02' && ids[2] === 'MIC-03' && ids[3] === 'MIC-04' && numbers.every((number, index) => Number.isInteger(number) && (index === 0 || number > (numbers[index - 1] ?? Number.NaN)));
    };
    const registries: string[] = [];
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
      if (place === REGISTRY_PLACE) {
        registries.push(pair);
        expect(registryRule(list.ids), `${list.operationId} ${list.path}: ${pair}`).toBe(true);
        continue;
      }
      // D61 (2026-11-04): the ordered pair became the ordered FOUR — the sealed tracks AUDIO-01..04 or
      // the mic channels MIC-01..04. BACKWARD COMPATIBILITY IS THE RULING'S OTHER HALF (D60): an item
      // sealed under the two-track era names its OWN list, read as a prefix of the new order — so a
      // gapless run of AUDIO- ids that is the pair of that era or the four of this one is the item's
      // truth, never a violation.
      const prefixRun = (ids: readonly string[], prefix: readonly string[]): boolean =>
        ids.length >= 2 && ids.length <= prefix.length && ids.every((id, index) => id === prefix[index]);
      const ok = prefixRun(list.ids, ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04']) || JSON.stringify(list.ids) === '["MIC-01","MIC-02","MIC-03","MIC-04"]';
      expect(ok, `${list.operationId} ${list.path}: ${pair}`).toBe(true);
    }
    // The registry was read before any registration (the four built-ins alone) and after one (the four and the registered microphone).
    expect(registries).toContain('["MIC-01","MIC-02","MIC-03","MIC-04"]'); // D61 (2026-11-04): the pair became the four numbered channels
    expect(registries).toContain('["MIC-01","MIC-02","MIC-03","MIC-04","MIC-05"]');
    // CONTROL of the registry rule: the four built-ins alone and the four with later microphones pass; a missing or swapped member of the four, a repeat, a falling number and an id of another form do not.
    expect([['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'], ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'MIC-05'], ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'MIC-05', 'MIC-11']].map(registryRule)).toEqual([true, true, true]); // D61: four built-ins
    expect([['MIC-01', 'MIC-02', 'MIC-03'], ['MIC-02', 'MIC-01', 'MIC-03', 'MIC-04'], ['MIC-01', 'MIC-02', 'MIC-04', 'MIC-03'], ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'MIC-04'], ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'AUDIO-01'], []].map(registryRule)).toEqual([false, false, false, false, false, false]); // D61: the four-channel forms
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
    // Task 4 row 96: none is deferred any more (the literal stays, so that a new entry needs this second, visible edit).
    expect(deferred).toEqual([]);
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
