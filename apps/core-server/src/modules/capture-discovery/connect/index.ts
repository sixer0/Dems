/**
 * The routes of the credential-gated connect flow (blueprint row 142; contract C3 §2.2 operation
 * 89, §2.6 operations 95 and 96; decisions D80(3), D81, D106).
 *
 *   #   operationId                      method and path                                          success
 *   95  testCaptureCandidateConnection   POST /api/v1/capture/discovery/candidates/{id}/test      200 (a failed test is a 200 result)
 *   96  adoptCaptureCandidate            POST /api/v1/capture/discovery/candidates/{id}/adopt     201
 *   89  setCaptureDeviceCredential       POST /api/v1/capture/devices/{id}/credential             200 (the capture-config snapshot)
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry
 * (`routeOfOperation`). WHO MAY CALL is not checked here: `CAPTURE_CONFIG` and the condition
 * `WEB_CONSOLE_SESSION` are applied by stage 6 (`plugins/permission-guard`) before the body is
 * used; a session of a tablet or a phone is refused there with `403 NOT_PERMITTED`
 * (`WEB_CONSOLE_ONLY`) and one `ACCESS_DENIED` row. This folder reads no role and no permission.
 *
 * WHERE THE ROUTES LIVE. A subfolder of the search module (`modules/capture-discovery`, row 132),
 * and the home of operation 89 as well: the credential write of an adoption and the replace of
 * operation 89 are ONE write path (`service.ts`, `statements.ts`), so they stay in one folder; the
 * closed selector module (`modules/capture-config`, row 66) is not touched. `app.ts` is frozen
 * (P25): the plugin of the search module calls `registerCaptureConnectRoutes(app)` once.
 *
 * THE BODY IS NEVER LOGGED AND NEVER KEPT. The handler seals the body's credential at once
 * (`sealCredential`: an opaque object that prints a fixed mark) and hands on that object only.
 *
 * WHAT IS PROVIDED AND BY WHOM (`captureConnectControl(app)`):
 *   the candidate state      row 132's search module, `provideCandidates`;
 *   the connection tester    the read-only ONVIF test of `capture/adapters/camera/onvif-session.ts`,
 *                            `provideTester` (wired by the search module: `capture-discovery/index.ts`);
 *   the secret sealer        the Core credential store (row 84), taken when the app is ready; a
 *                            sealer handed to `provideSealer` wins over it (a test);
 *   the device registrar     the engine action that adds a device to the replicated registry,
 *                            `provideRegistrar` (wired by the search module with `adoption.ts`).
 * While one is missing, the operation that needs it answers `503 NOT_READY` before any request.
 */
import {
  ApiErrorCode,
  CAPTURE_CREDENTIAL_OPERATION,
  CAPTURE_DISCOVERY_OPERATIONS,
  CaptureCandidateAdoptRequestSchema,
  CaptureCandidateAdoptionSchema,
  CaptureConfigSliceSchema,
  CaptureConnectionTestRequestSchema,
  CaptureConnectionTestSchema,
  CaptureCredentialWriteRequestSchema,
  CaptureDiscoveryReason,
  type CaptureCandidateAdoption,
  type CaptureConfigSliceBody,
  type CaptureConnectionTest,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import { OperatorRole, Permission } from '@dems/shared/sim';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createSystemTimers } from '../../../capture';
import { CaptureAdapterKind, sealCredential, type StoredCameraAddressRule } from '../../../capture/adapters';
import { captureOperationOf, isProductionCaptureOperation } from '../../../capture/fence';
import { coreCredentialStore, isStoreSealedSecret } from '../../../credential-store';
import type { Principal } from '../../../plugins/authenticate';
import { notSignedIn } from '../../../plugins/authenticate';
import { ApiFailure } from '../../../plugins/error-envelope';
import { describeError } from '../../../plugins/logger';
import { routeOfOperation } from '../../../plugins/permission-guard';
import { SYSTEM_OWNER_SESSION_ID, ipInSegment, segmentCidrOctets } from '../segment-scan';
import { createConnectionTestLimits, type ConnectionTestLimits } from './limits';
import {
  adoptCandidate,
  operatorCredential,
  setCredential,
  testCandidate,
  type CameraSecretSealer,
  type CandidateDirectory,
  type CandidateTestRecord,
  type ConnectCaller,
  type ConnectCandidate,
  type ConnectHost,
  type ConnectSeams,
  type ConnectionTester,
  type DeviceRegistrar,
  type OperatorCredential,
} from './service';
import { insertSystemPrincipal, type SystemPrincipalRow } from './statements';

export { CONNECTION_TEST_BOUNDS, createConnectionTestLimits, type ConnectionTestBounds, type ConnectionTestLimits, type ConnectionTestRefusal, type GuardVerdict } from './limits';
export {
  SealedCameraSecretRefused,
  nextCameraId,
  type AdoptedDevice,
  type CameraSecretSealer,
  type CandidateDirectory,
  type CandidateTestRecord,
  type ConnectCandidate,
  type ConnectionAttempt,
  type ConnectionTester,
  type DeviceRegistrar,
  type SealedCameraSecret,
} from './service';
export { INSERT_CAPTURE_CREDENTIAL, INSERT_SYSTEM_PRINCIPAL, UPSERT_CAPTURE_CREDENTIAL, type SystemPrincipalRow } from './statements';

/**
 * The longest account name the table takes (`capture_device_credentials_username_check`). ONE bound
 * (decision D117; review row 69, finding R69-11): the shared constant `CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH`
 * and the request schema say the same 120, so the schema refuses a longer name first and the check
 * in `credentialOf` below is a second line that today's schema never reaches.
 */
export const CAPTURE_CREDENTIAL_USERNAME_MAX_CHARS = 120;

const STORE_SOURCE = 'captureConnect.credentialStore';
const STORE_REFUSED = 'the Core credential store refuses to work: a camera credential cannot be stored';

/**
 * D62b (2026-11-05): the LONGEST wait the SYSTEM flow accepts from the limiter's spacing ask
 * before it lets the refusal stand (the sweep retries the attach on a later pass, D62b of
 * `segment-scan.ts`). The spacing bucket can never ask for more than the contract's
 * `CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS` (5 s); the per-minute bucket can ask up to a minute,
 * and waiting a minute inside one sweep step would hold the single-flight sweep for half its
 * period. So: waits up to this cap, refuses honestly above it. This raises NO bound - it is the
 * limiter's own `retryAfterMs`, obeyed within a ceiling, never a widened `minIntervalMs`.
 */
export const AUTOATTACH_TEST_PACING_CAP_MS = 10_000;

/** What this folder offers beside its routes: the providers of its seams, and its limits. */
export interface CaptureConnectControl {
  provideCandidates(directory: CandidateDirectory): void;
  provideTester(tester: ConnectionTester): void;
  provideSealer(sealer: CameraSecretSealer): void;
  provideRegistrar(registrar: DeviceRegistrar): void;
  /**
   * DECISION D62 (2026-11-05) SMART ATTACH: operations 95 and 96 as the segment sweep runs them.
   * The flow is the routes' OWN (`service.ts`: same checks, same bounds, same lock-out guard, same
   * audit rows); the caller is the Core's SYSTEM identity, not a request's principal, and the
   * credential is the configured bench pair sealed exactly as a typed one is. The sweep owns the
   * candidate list under the session key `SYSTEM`, so this is the only caller that reaches it.
   * The credential is read once here and held sealed; it reaches no log line and no audit row.
   *
   * D62b (2026-11-05): THE SYSTEM FLOW PACES ITSELF. An auto-attach spends TWO connection tests on
   * one candidate by contract: operation 95's test and operation 96's re-verification, which run
   * back to back here where an operator's hands would put seconds between them. The Core's own
   * spacing bound (`CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS` per host AND per session key) refuses
   * the second one inside the same 5 s window - a first-attempt `429 RATE_LIMITED`,
   * `CONNECTION_TEST_RATE_LIMITED`. The fix is the limiter's own ask, not a raised bound: before
   * each step this door reads `limits.refusal` for the candidate's host and the `SYSTEM` session
   * key and, when the refusal is `CONNECTION_TEST_RATE_LIMITED` within
   * `AUTOATTACH_TEST_PACING_CAP_MS`, waits exactly that long first. An in-progress test and the
   * lock-out guard are NEVER waited out here (the guard protects the camera's own counter; the
   * sweep retries later), and every bound of `limits.ts` stands untouched for this caller too.
   * `pacing.wait` replaces the wait in a unit test (the manual clock of the limits advances with
   * it); production uses the system timer.
   */
  systemFlow(credential: { readonly username: string; readonly secret: string }, pacing?: { readonly wait?: (ms: number) => Promise<void> }): {
    testCandidate(candidateId: string): Promise<CaptureConnectionTest>;
    adoptCandidate(candidateId: string): Promise<CaptureCandidateAdoption>;
  };
  /**
   * Task 4 row 143c (decision C65): the destination rule on a camera address, bound to the host's
   * network facts - the ONE binding of the production composition, handed in ONCE. Under capture
   * operation `REAL_PRODUCTION` the test of a candidate is bound to the camera-interface address
   * this rule names, and WITHOUT the rule no candidate is tested (`503`). In any other capture
   * operation the rule is never asked.
   */
  provideCandidateRule(rule: StoredCameraAddressRule): void;
  /** The bounds of the connection tests of this Core, the lock-out guard among them. In memory. */
  readonly limits: ConnectionTestLimits;
  /**
   * A TEST puts its own parts in the place of what `modules/capture-discovery` provided at
   * registration (a scripted candidate list, a stand-in registrar, limits on a clock of its own).
   * No production file calls it: the module's static test holds that.
   */
  replaceForTest(parts: CaptureConnectTestParts): void;
}

/** What a test may put in the place of the module's own parts. */
export interface CaptureConnectTestParts {
  readonly candidates?: CandidateDirectory;
  readonly tester?: ConnectionTester;
  readonly registrar?: DeviceRegistrar;
  readonly limits?: ConnectionTestLimits;
}

interface ControlState extends CaptureConnectControl {
  limits: ConnectionTestLimits;
  candidates: CandidateDirectory | null;
  tester: ConnectionTester | null;
  sealer: CameraSecretSealer | null;
  storeSealer: CameraSecretSealer | null;
  registrar: DeviceRegistrar | null;
  candidateRule: StoredCameraAddressRule | null;
}

// Keyed by the app's stage registry: one object per app (the `sttConfigControl(app)` idiom).
const controls = new WeakMap<object, ControlState>();

/** The controls of an app. Available once the routes are registered. */
export function captureConnectControl(app: { readonly stages: object }): CaptureConnectControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the connect flow is not loaded: register its routes before app.ready()');
  return control;
}

function entryOf(operationId: 'testCaptureCandidateConnection' | 'adoptCaptureCandidate'): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_DISCOVERY_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** The `{id}` of a route, held to the pattern the registry entry gives for it. */
function paramsOf(operation: CoreApiRegistryOperation) {
  if (operation.pathParam === undefined) throw new Error(`the registry entry of ${operation.operationId} has no path parameter`);
  return z.object({ id: z.string().regex(operation.pathParam.pattern) });
}

/** Stage 6 lets only an operator reach these routes; the refusal here is the same backstop the engine host has. */
function callerOf(request: FastifyRequest): ConnectCaller {
  const { principal } = request;
  if (principal.kind !== 'OPERATOR') throw notSignedIn();
  return { principal };
}

/**
 * THE ROUTE EDGE: the credential of this request's body, sealed at once. The one caller of
 * `operatorCredential`. An account name the table cannot take is refused here, before any
 * request: the text is fixed and quotes nothing of the body (SEC35-34 (3)).
 */
function credentialOf(body: { readonly username: string; readonly secret: string } | undefined): OperatorCredential | null {
  if (body === undefined) return null;
  if (body.username.length > CAPTURE_CREDENTIAL_USERNAME_MAX_CHARS) {
    throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, `The user name is longer than ${CAPTURE_CREDENTIAL_USERNAME_MAX_CHARS} characters.`, { details: { in: 'body' } });
  }
  return operatorCredential(sealCredential({ username: body.username, secret: body.secret }));
}

/**
 * THE SYSTEM CALLER of the auto-attach path (decision D62, 2026-11-05). It is no session: it stands
 * for the Core itself, so that the flows of operations 95 and 96 write their rows as they always
 * do, with the actor `OPR-000` - the operator id the audit writer and the table take for a
 * system-written row when a hosted flow demands an actor (the bare audit rows of the sweep itself
 * carry none: `actorId: null`, the FAULT_CLEARED precedent). The D62 installer provisions that one
 * row in `operators` (no credential: it can never sign in) - and since audit row 134 the SYSTEM flow creates it,
 * with its `USER_CREATED` audit row, when it is missing (`provisionSystemPrincipal` below); without it the adoption transaction
 * fails its actor key at the database, the sweep says so at warn and nothing else moves. Its role
 * and permission state what the flows ask for and nothing more; no request ever resolves to this
 * principal.
 */
export const SYSTEM_OPERATOR_ID = 'OPR-000';
/**
 * Audit 2026-11-05 row 134 (DF-29; D20(d), D29 Q4 "OPR-000 restricted in code, no new role"): THE LEAST PRIVILEGE OF
 * THE SYSTEM PRINCIPAL, held in code. Whatever the TECHNICIAN role grants in the database (MAINTENANCE,
 * DEVICE_MANAGE, CAPTURE_COMMISSION among them), the principal the Core acts as here carries ONE permission:
 * `CAPTURE_CONFIG`, the one operations 95, 96 and 78 ask for. The list is frozen, so no caller can widen it at run time.
 */
export const SYSTEM_OPERATOR_PERMISSIONS: readonly Permission[] = Object.freeze([Permission.CAPTURE_CONFIG]);
const SYSTEM_CALLER: ConnectCaller = Object.freeze({
  principal: Object.freeze({
    kind: 'OPERATOR',
    operatorId: SYSTEM_OPERATOR_ID,
    sessionId: SYSTEM_OWNER_SESSION_ID,
    deviceId: null,
    role: OperatorRole.TECHNICIAN,
    permissions: SYSTEM_OPERATOR_PERMISSIONS,
  }) as Extract<Principal, { kind: 'OPERATOR' }>,
});

const SYSTEM_PRINCIPAL_SOURCE = 'captureConnect.systemPrincipal';
/** The `reason` of the `USER_CREATED` row that records a creation of the system principal's row (an existing detail key: no new audit type, no new detail). */
export const SYSTEM_PRINCIPAL_CREATED_REASON = 'System principal of camera auto-attach, created by the Core on first use (D62); no credential: it never signs in';

/**
 * Audit 2026-11-05 row 134 (DF-29; D20(d) "creation recorded in the audit chain going forward"): THE AUDITED CREATION
 * of the system principal's `operators` row. ONE unit: the row is inserted only when it is missing, and the same unit
 * appends `USER_CREATED` (actor none - the Core itself, the FAULT_CLEARED precedent; `targetOperatorId` OPR-000, role
 * TECHNICIAN, the fixed reason above), so a row without its audit entry cannot be committed. A row that is there
 * already - the production one, put in by the D62 installer - is never touched: not replaced, not re-enabled, not
 * disabled, not deleted; no audit row is written for it. The answer says what the unit did. The username `system`
 * held by another id fails the unit (unique violation): nothing is written, the error reaches the caller.
 */
export async function provisionSystemPrincipal(host: Pick<ConnectHost, 'now' | 'nativeUnit'>): Promise<SystemPrincipalRow> {
  return await host.nativeUnit(`${SYSTEM_PRINCIPAL_SOURCE}.provision`, async (unit) => {
    const role = SYSTEM_CALLER.principal.role;
    const row = await insertSystemPrincipal(unit, SYSTEM_OPERATOR_ID, role, host.now());
    if (row === 'CREATED') {
      await unit.audit.append({
        type: 'USER_CREATED',
        message: `Operator ${SYSTEM_OPERATOR_ID} created with role ${role}`,
        actorId: null,
        deviceId: null,
        details: { targetOperatorId: SYSTEM_OPERATOR_ID, role, reason: SYSTEM_PRINCIPAL_CREATED_REASON },
      });
    }
    return row;
  });
}

/** D62 (2026-11-05): the principal of the SYSTEM caller - the same one `systemFlow` runs operations 95 and 96 under, handed to the selector action of operation 78 by the sweep's wiring. */
export const SYSTEM_OPERATOR_PRINCIPAL: Extract<Principal, { kind: 'OPERATOR' }> = SYSTEM_CALLER.principal;

/** The candidate store of the search module (row 132), as far as the connect flow uses it: its three calls take the instant. */
export interface TimedCandidateStore {
  find(sessionId: string, candidateId: string, now: number): ConnectCandidate | null;
  recordTest(sessionId: string, candidateId: string, record: CandidateTestRecord, now: number): boolean;
  markRegistered(sessionId: string, candidateId: string, deviceId: string, now: number): boolean;
}

/** The search module's candidate store as this folder's `CandidateDirectory`, on the server clock. */
export function candidateDirectoryOf(store: TimedCandidateStore, now: () => number): CandidateDirectory {
  return {
    find: (sessionId, candidateId) => store.find(sessionId, candidateId, now()),
    recordTest: (sessionId, candidateId, record) => void store.recordTest(sessionId, candidateId, record, now()),
    markRegistered: (sessionId, candidateId, deviceId) => void store.markRegistered(sessionId, candidateId, deviceId, now()),
  };
}

export interface CaptureConnectOptions {
  /** A test passes limits on its own clock. */
  readonly limits?: ConnectionTestLimits;
}

/** Registers operations 95, 96 and 89 on the app. Called once, before `app.ready()`. */
export function registerCaptureConnectRoutes(app: FastifyInstance, options: CaptureConnectOptions = {}): CaptureConnectControl {
  const provide = <Key extends 'candidates' | 'tester' | 'sealer' | 'registrar' | 'candidateRule'>(key: Key, value: NonNullable<ControlState[Key]>): void => {
    if (control[key] !== null) throw new Error(`the ${key} seam of the connect flow was provided twice`);
    control[key] = value;
  };
  const control: ControlState = {
    candidates: null,
    tester: null,
    sealer: null,
    storeSealer: null,
    registrar: null,
    candidateRule: null,
    limits: options.limits ?? createConnectionTestLimits({ now: () => app.clock.now() }),
    provideCandidates: (directory) => provide('candidates', directory),
    provideTester: (tester) => provide('tester', tester),
    provideSealer: (sealer) => provide('sealer', sealer),
    provideRegistrar: (registrar) => provide('registrar', registrar),
    provideCandidateRule: (rule) => provide('candidateRule', rule),
    // D62 (2026-11-05): the auto-attach door - the flows of operations 95 and 96, bound to the SYSTEM caller and to
    // the sealed bench credential made HERE (the one caller of `operatorCredential` beside the route edge above). The
    // seams are read at each call, so a test's `replaceForTest` parts hold, as they do for the routes.
    // D62b (2026-11-05): each step first OBEYS the limiter's own spacing ask (see the interface's D62b note): the
    // back-to-back test and re-verification of one attach otherwise collide with `minIntervalMs` on the host and on
    // the `SYSTEM` session key - the true root of the bench's first-attempt `RATE_LIMITED`. Nothing is waited for an
    // in-progress test or the lock-out guard, and no bound moves.
    systemFlow: (credential, pacing) => {
      if (credential.username.length > CAPTURE_CREDENTIAL_USERNAME_MAX_CHARS) throw new Error('the SMART ATTACH bench user name is longer than the credential table takes');
      const sealed = operatorCredential(sealCredential(credential));
      // Audit 2026-11-05 row 103 (DF-26; D23 (3)): THE SCOPE OF THE BENCH CREDENTIAL, held again at the one door that spends
      // it. The pair is offered ONLY to a candidate whose host AND service address lie inside the configuration's
      // DEMS_CAMERA_SEGMENT_CIDR and that answered as ONVIF; anything else is refused BEFORE a step runs (the operators'
      // own 409 CANDIDATE_NOT_TESTABLE - no new word), so nothing is sent. No segment configured refuses every candidate.
      const segmentCidr: unknown = app.config.cameraSegmentCidr;
      const segment = typeof segmentCidr === 'string' ? segmentCidrOctets(segmentCidr) : null;
      const outOfScope = (camera: ConnectCandidate['camera']): boolean => {
        if (segment === null || camera.adapterKind !== CaptureAdapterKind.ONVIF_RTSP || !ipInSegment(camera.host, segment)) return true;
        if (camera.serviceAddress === null) return false; // the flow's own rule refuses an untestable candidate
        try {
          return !ipInSegment(new URL(camera.serviceAddress).hostname, segment);
        } catch {
          return true;
        }
      };
      const wait = pacing?.wait ?? ((ms: number) => new Promise<void>((resolve) => void timers.after(ms, resolve)));
      const paced = async <Value>(candidateId: string, step: () => Promise<Value>): Promise<Value> => {
        const candidate = control.candidates?.find(SYSTEM_OWNER_SESSION_ID, candidateId) ?? null;
        if (candidate !== null && outOfScope(candidate.camera)) {
          throw new ApiFailure(409, ApiErrorCode.INVALID_STATE, 'This device cannot be tested.', { details: { reason: CaptureDiscoveryReason.CANDIDATE_NOT_TESTABLE } });
        }
        // Audit 2026-11-05 row 134 (DF-29): the actor row of the steps below is there before the first one runs - created,
        // with its USER_CREATED row, when it is missing (`provisionSystemPrincipal`); once found, not asked again.
        if (!systemPrincipalFound) await findSystemPrincipal();
        if (candidate !== null) {
          const refusal = control.limits.refusal(candidate.camera.host, SYSTEM_OWNER_SESSION_ID);
          if (refusal !== null && refusal.reason === CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED && refusal.retryAfterMs > 0 && refusal.retryAfterMs <= AUTOATTACH_TEST_PACING_CAP_MS) {
            // One millisecond over the ask: the spacing rule refuses while the interval is NOT past, and a coarse clock must not re-refuse it.
            await wait(refusal.retryAfterMs + 1);
          }
        }
        return await step();
      };
      return {
        testCandidate: (candidateId) => paced(candidateId, () => testCandidate(seams, SYSTEM_CALLER, candidateId, sealed)),
        adoptCandidate: (candidateId) => paced(candidateId, () => adoptCandidate(seams, SYSTEM_CALLER, candidateId, sealed)),
      };
    },
    replaceForTest: (parts) => {
      if (parts.candidates !== undefined) control.candidates = parts.candidates;
      if (parts.tester !== undefined) control.tester = parts.tester;
      if (parts.registrar !== undefined) control.registrar = parts.registrar;
      if (parts.limits !== undefined) control.limits = parts.limits;
    },
  };
  controls.set(app.stages, control);

  // Audit 2026-11-05 row 134 (DF-29): the system principal's row, made sure of once per process by the SYSTEM flow only
  // (no route, no boot step: with SMART ATTACH off nothing is written). Present (enabled or not): found, nothing
  // changed - the Core never enables, disables or deletes it. A unit that fails (the username `system` held by another
  // id, a database fault): said at warn and in the persistent error log, the step is not run, and the next step asks again.
  let systemPrincipalFound = false;
  const findSystemPrincipal = async (): Promise<void> => {
    let row: SystemPrincipalRow;
    try {
      row = await provisionSystemPrincipal(host);
    } catch (error) {
      const message = 'the system principal of camera auto-attach could not be made sure of';
      app.log.warn({ code: 'SYSTEM_PRINCIPAL_UNCHECKED', operatorId: SYSTEM_OPERATOR_ID, source: SYSTEM_PRINCIPAL_SOURCE }, message);
      app.errorLog.append({ level: 'error', source: SYSTEM_PRINCIPAL_SOURCE, message, ...describeError(error), context: { operatorId: SYSTEM_OPERATOR_ID } });
      throw error;
    }
    if (row === 'CREATED') app.log.info({ code: 'SYSTEM_PRINCIPAL_CREATED', operatorId: SYSTEM_OPERATOR_ID, source: SYSTEM_PRINCIPAL_SOURCE }, 'the system principal of camera auto-attach was created and audited');
    systemPrincipalFound = true;
  };

  // THE CORE CREDENTIAL STORE (row 84; D80(7): one store, no second one). An app without a data
  // directory has none, and a credential write answers 503 (`CREDENTIAL_STORE_NOT_READY`). A store
  // that refuses to work is a fault of the host: said once, in the log and the persistent error log.
  app.addHook('onReady', async () => {
    const opened = coreCredentialStore(app);
    if (opened.status === 'READY') {
      control.storeSealer = { seal: (deviceId, secret) => opened.store.capture.seal(deviceId, secret) };
    } else if (opened.status === 'UNAVAILABLE') {
      app.log.error({ code: opened.code, source: STORE_SOURCE }, STORE_REFUSED);
      app.errorLog.append({ level: 'error', source: STORE_SOURCE, message: STORE_REFUSED, code: opened.code, context: { errno: opened.detail } });
    }
  });

  const timers = createSystemTimers();
  // The capture operation of this app, from its configuration (the fence's one decision): fixed for the app's life.
  const production = isProductionCaptureOperation(captureOperationOf(app.config));
  const host: ConnectHost = {
    now: () => app.clock.now(),
    state: () => app.engine.state(),
    engineUnit: (label, work) => app.engine.run(label, work),
    nativeUnit: (label, work) => app.pipeline.run(label, work),
    after: (delayMs, callback) => timers.after(delayMs, callback),
    note: (fields, message) => app.log.info(fields, message),
  };
  const seams: ConnectSeams = {
    host,
    // Read at each call: a test may have put limits of its own in (`replaceForTest`).
    get limits() {
      return control.limits;
    },
    candidates: () => control.candidates,
    tester: () => control.tester,
    sealer: () => control.sealer ?? control.storeSealer,
    // Question 2 of review row 69: only the store's own answer is written, whoever the sealer is.
    storeSealed: isStoreSealedSecret,
    registrar: () => control.registrar,
    // Task 4 row 143c (decision C65): ALWAYS stated. In production a candidate's test is bound to the camera interface
    // by the rule the composition handed in, and is refused while there is none; in any other operation it is as it was.
    candidateSource: () => (production ? { required: true, rule: control.candidateRule } : { required: false }),
  };
  const routes = app.withTypeProvider<ZodTypeProvider>();

  // 95 testCaptureCandidateConnection
  const test = entryOf('testCaptureCandidateConnection');
  routes.route({
    ...routeOfOperation(test),
    schema: { params: paramsOf(test), body: CaptureConnectionTestRequestSchema.optional(), response: { 200: CaptureConnectionTestSchema } },
    handler: async (request): Promise<CaptureConnectionTest> => testCandidate(seams, callerOf(request), request.params.id, credentialOf(request.body?.credential)),
  });

  // 96 adoptCaptureCandidate
  const adopt = entryOf('adoptCaptureCandidate');
  routes.route({
    ...routeOfOperation(adopt),
    schema: { params: paramsOf(adopt), body: CaptureCandidateAdoptRequestSchema.optional(), response: { 201: CaptureCandidateAdoptionSchema } },
    handler: async (request, reply): Promise<CaptureCandidateAdoption> => {
      const adoption = await adoptCandidate(seams, callerOf(request), request.params.id, credentialOf(request.body?.credential));
      void reply.code(201);
      return adoption;
    },
  });

  // 89 setCaptureDeviceCredential
  routes.route({
    ...routeOfOperation(CAPTURE_CREDENTIAL_OPERATION),
    schema: { params: paramsOf(CAPTURE_CREDENTIAL_OPERATION), body: CaptureCredentialWriteRequestSchema, response: { 200: CaptureConfigSliceSchema } },
    handler: async (request): Promise<CaptureConfigSliceBody> => {
      const credential = credentialOf(request.body);
      // The schema requires the body: the null is unreachable and refused all the same.
      if (credential === null) throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, 'A user name and a password are required.', { details: { in: 'body' } });
      return setCredential(seams, callerOf(request), request.params.id, credential);
    },
  });

  return control;
}
