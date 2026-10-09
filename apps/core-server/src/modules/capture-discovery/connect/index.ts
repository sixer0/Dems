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
 *                            `provideTester` (the adapter barrel does not export it yet: request filed);
 *   the secret sealer        the Core credential store (row 84), taken when the app is ready; a
 *                            sealer handed to `provideSealer` wins over it (a test);
 *   the device registrar     the engine action that adds a device to the replicated registry,
 *                            `provideRegistrar` (the contract has no such action yet: request filed).
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
  type CaptureCandidateAdoption,
  type CaptureConfigSliceBody,
  type CaptureConnectionTest,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createSystemTimers } from '../../../capture';
import { sealCredential } from '../../../capture/adapters';
import { coreCredentialStore } from '../../../credential-store';
import { notSignedIn } from '../../../plugins/authenticate';
import { ApiFailure } from '../../../plugins/error-envelope';
import { routeOfOperation } from '../../../plugins/permission-guard';
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
export { INSERT_CAPTURE_CREDENTIAL, UPSERT_CAPTURE_CREDENTIAL } from './statements';

/** The operations this folder answers. */
export const CAPTURE_CONNECT_OPERATIONS = ['testCaptureCandidateConnection', 'adoptCaptureCandidate', 'setCaptureDeviceCredential'] as const;

/** The longest account name the table takes (`capture_device_credentials_username_check`); the contract's schema allows 255. */
export const CAPTURE_CREDENTIAL_USERNAME_MAX_CHARS = 120;

const STORE_SOURCE = 'captureConnect.credentialStore';
const STORE_REFUSED = 'the Core credential store refuses to work: a camera credential cannot be stored';

/** What this folder offers beside its routes: the providers of its seams, and its limits. */
export interface CaptureConnectControl {
  provideCandidates(directory: CandidateDirectory): void;
  provideTester(tester: ConnectionTester): void;
  provideSealer(sealer: CameraSecretSealer): void;
  provideRegistrar(registrar: DeviceRegistrar): void;
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
  const provide = <Key extends 'candidates' | 'tester' | 'sealer' | 'registrar'>(key: Key, value: NonNullable<ControlState[Key]>): void => {
    if (control[key] !== null) throw new Error(`the ${key} seam of the connect flow was provided twice`);
    control[key] = value;
  };
  const control: ControlState = {
    candidates: null,
    tester: null,
    sealer: null,
    storeSealer: null,
    registrar: null,
    limits: options.limits ?? createConnectionTestLimits({ now: () => app.clock.now() }),
    provideCandidates: (directory) => provide('candidates', directory),
    provideTester: (tester) => provide('tester', tester),
    provideSealer: (sealer) => provide('sealer', sealer),
    provideRegistrar: (registrar) => provide('registrar', registrar),
    replaceForTest: (parts) => {
      if (parts.candidates !== undefined) control.candidates = parts.candidates;
      if (parts.tester !== undefined) control.tester = parts.tester;
      if (parts.registrar !== undefined) control.registrar = parts.registrar;
      if (parts.limits !== undefined) control.limits = parts.limits;
    },
  };
  controls.set(app.stages, control);

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
    registrar: () => control.registrar,
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
