/**
 * The live paths of operations 76 to 80 (blueprint row 66 / M4-W2; contract C3 §2.2 to §2.4, §4
 * `CAPTURE_CONFIG_LOCKED`, §5.2 `CAPTURE_CONFIG_CHANGED`, §6 slices 29 and 30; specs R-1; checks
 * M4-SEL-W/T/P server half, M4-LOCK-1).
 *
 *   #   operationId             method and path                          access (registry)   audit on success
 *   76  getCaptureConfig        GET  /api/v1/capture/config              AUTHENTICATED       none (a read)
 *   77  getCaptureDevices       GET  /api/v1/capture/devices             AUTHENTICATED       none (a read)
 *   78  updateCaptureConfig     POST /api/v1/capture/config              CAPTURE_CONFIG      CAPTURE_CONFIG_CHANGED
 *   79  setCaptureCameraSource  POST /api/v1/capture/cameras/{id}/source CAPTURE_CONFIG      CAPTURE_CONFIG_CHANGED
 *   80  setPrimaryMic           POST /api/v1/capture/mics/{id}/primary   CAPTURE_CONFIG      CAPTURE_CONFIG_CHANGED
 *
 * READS answer from the engine's COMMITTED state (`app.engine.slice`), as the device reads do: the
 * two slices are replicated slices of that state (the mapping stores them in `capture_config` and
 * `capture_devices`), so a read, a snapshot of the realtime channel and a delta always say the
 * same. `locked` of operation 76 is computed per answer from the open session (OD-10): the stored
 * slice never holds it.
 *
 * WRITES are ONE unit of the engine (`app.engine.run`), in which the lock is read and the hosted
 * simulator action `setCaptureConfig` runs under the caller's identity: the new selector, its
 * CAPTURE_CONFIG_CHANGED row(s) and the publication of slice `captureConfig` commit together or
 * not at all. The engine's units run one at a time, so no session can open between the lock read
 * and the write.
 *
 * REFUSALS, in the simulator's order:
 *   403  stage 6 (`plugins/permission-guard`): a role without CAPTURE_CONFIG, with the one
 *        ACCESS_DENIED row. Not built here.
 *   422  the schema stage: a body or a path ID outside the contract's schema.
 *   404  operations 79 and 80: the path names no camera / no mic input of the registry.
 *   409  `CAPTURE_CONFIG_LOCKED`: a session is open. NO audit row at all and no state change
 *        (SEC35-19; M4-LOCK-1) - the unit is left before the action is called.
 *   422  `INVALID_INPUT`: a line of operation 78 names no registered device of the right class (a
 *        discovery candidate is never one), a profile that is no code, one microphone behind both
 *        inputs, one camera on both tracks with one profile, a replacing mic pair (lines with
 *        `role`, decision D133 (1)) that is not one PRIMARY and one STANDBY line; a device the adapter registry refuses
 *        for the running operation carries the reason of THAT refusal in `details.reason`
 *        (`CaptureAssignmentRefusal`; fix wave I - it was `DEVELOPMENT_SOURCE_NOT_ALLOWED` for all of them).
 *        A body of operation 78 that clears a slot (`unassign`) and fills the same slot: by the
 *        schema where it can see it (path `unassign`), by the action otherwise
 *        (`details.reason: SLOT_UNASSIGNED_AND_ASSIGNED`).
 *   503  the engine is not running, or the unit did not commit.
 *
 * `unassign` OF OPERATION 78 (task 4 row 29; decisions C14, C18, C25; security requirement AD-10).
 * The member names the slots the edit CLEARS (`VIDEO-01`, `VIDEO-02`, `PRIMARY`, `STANDBY`); the
 * route hands it to the hosted action unchanged and adds no rule of its own:
 *   - the SAME permission (`CAPTURE_CONFIG`) and the same client kinds as every body of
 *     operation 78: the registry entry is not changed;
 *   - the SAME lock, read in the same unit BEFORE the action: while a session is open (any state
 *     but SEALED) the answer is `409 CAPTURE_CONFIG_LOCKED` with no row and no change, so a clear
 *     can never take a source from a running or a sealing session;
 *   - the SAME audit type: one `CAPTURE_CONFIG_CHANGED` row per slot that held a source (`scope`,
 *     `field: SOURCE`, `trackId` or `inputId`, `from`; no `to`, no `deviceId`), none for a slot
 *     that was empty already - that edit changes nothing and answers the selector as it is;
 *   - it ASSIGNS nothing, so rule RG-3 of the adapter registry has no device to ask about.
 * The answer is the selector WITHOUT the line of a cleared slot (an unassigned slot is an absent
 * line, never a line with an empty device); the stored row holds NULL in the columns of that slot.
 *
 * ERRORS. The module catches nothing it cannot answer: an unexpected failure reaches the error
 * envelope, which writes it to the log and to the persistent error log; a unit that fails is
 * logged and persisted by the engine host.
 */
import {
  ApiErrorCode,
  CAPTURE_CONFIG_CHANGE_OPERATIONS,
  CAPTURE_CONFIG_OPERATIONS,
  CaptureCameraSourceRequestSchema,
  CaptureConfigSliceSchema,
  CaptureConfigUpdateRequestSchema,
  CaptureDevicesSliceSchema,
  type CaptureConfigSliceBody,
  type CaptureDevicesSliceBody,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import { isSessionActive, type CaptureConfigChange } from '@dems/shared/sim';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CaptureAdapterError, CaptureAdapterRefusal, sourceClassOfOperation, type CaptureDeviceRegistry, type CaptureOperation } from '../../capture/adapters';
import type { DurableSlices } from '../../db/mapping';
import { ApiFailure } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import { readMicTransports } from './store';

/** The operations this module answers, in registry order (operations 76 to 80). */
export const CAPTURE_CONFIG_MODULE_OPERATIONS = ['getCaptureConfig', 'getCaptureDevices', 'updateCaptureConfig', 'setCaptureCameraSource', 'setPrimaryMic'] as const;
export type CaptureConfigModuleOperation = (typeof CAPTURE_CONFIG_MODULE_OPERATIONS)[number];

/** `details.reason` of a DEVELOPMENT device named on a Core that does not run development sources (C3 §4). */
export const DEVELOPMENT_SOURCE_NOT_ALLOWED = 'DEVELOPMENT_SOURCE_NOT_ALLOWED';

/**
 * EVERY REFUSAL OF THE ADAPTER REGISTRY UNDER ITS OWN REASON (fix wave I; re-gate 70, finding
 * G70b-01). Until this wave every refusal was answered as `DEVELOPMENT_SOURCE_NOT_ALLOWED`, so a
 * camera the registry simply did not serve yet read "this source can only be used in the
 * development configuration" on a development Core. `details.reason` of the 422 is now one of:
 *
 *   DEVELOPMENT_SOURCE_NOT_ALLOWED   a development source, and the Core does not run development sources
 *   PRODUCTION_SOURCE_NOT_ALLOWED    a production source, and the Core runs development sources
 *   CAPTURE_DEVICE_NOT_SERVED        registered, but no capture adapter of the running Core serves it
 *   CAPTURE_DEVICE_CLASS_MISMATCH    not a device of the class the line asks for
 *
 * and, for a refusal this table does not name, the adapter layer's own code (a fixed word, rule CR-4).
 */
export const CaptureAssignmentRefusal = {
  DEVELOPMENT_SOURCE_NOT_ALLOWED,
  PRODUCTION_SOURCE_NOT_ALLOWED: 'PRODUCTION_SOURCE_NOT_ALLOWED',
  CAPTURE_DEVICE_NOT_SERVED: 'CAPTURE_DEVICE_NOT_SERVED',
  CAPTURE_DEVICE_CLASS_MISMATCH: 'CAPTURE_DEVICE_CLASS_MISMATCH',
} as const;

type SourceClassName = 'PRODUCTION' | 'DEVELOPMENT';
const SOURCE_CLASS_REASON: Readonly<Record<SourceClassName, string>> = Object.freeze({
  DEVELOPMENT: CaptureAssignmentRefusal.DEVELOPMENT_SOURCE_NOT_ALLOWED,
  PRODUCTION: CaptureAssignmentRefusal.PRODUCTION_SOURCE_NOT_ALLOWED,
});

/**
 * The reason of one refusal. `stored` is the source class the registry SLICE states for the
 * device (absent on a built-in), `operation` the capture operation the registry was built for
 * (absent for a registry that does not say: the earlier reading stands).
 *   - a class refusal names the class of the DEVICE: the one that is not the operation's;
 *   - a device the registry does not know is a class refusal when its stored class is not the
 *     operation's (a production camera on a development Core has no adapter there), and
 *     "not served" otherwise.
 */
export function captureAssignmentRefusalOf(code: CaptureAdapterRefusal, stored: SourceClassName | undefined, operation: CaptureOperation | undefined): string {
  const wanted: SourceClassName | null = operation === undefined ? null : sourceClassOfOperation(operation);
  const other = (name: SourceClassName): SourceClassName => (name === 'PRODUCTION' ? 'DEVELOPMENT' : 'PRODUCTION');
  if (code === CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED) return SOURCE_CLASS_REASON[stored ?? (wanted === null ? 'DEVELOPMENT' : other(wanted))];
  if (code === CaptureAdapterRefusal.DEVICE_UNKNOWN) {
    return wanted !== null && stored !== undefined && stored !== wanted ? SOURCE_CLASS_REASON[stored] : CaptureAssignmentRefusal.CAPTURE_DEVICE_NOT_SERVED;
  }
  if (code === CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH) return CaptureAssignmentRefusal.CAPTURE_DEVICE_CLASS_MISMATCH;
  return code;
}

const LOCKED_TEXT = 'The capture configuration cannot be changed while a session is open.';
const UNKNOWN_DEVICE_TEXT = 'The capture registry has no such device.';
const NOT_ASSIGNABLE_TEXT = 'This device cannot be assigned in the running capture operation.';
const MIC_SLOT_TEXT = 'A microphone input holds the microphone of the same ID.';
const CHANGED = 'capture configuration changed';
const SOURCE = 'captureConfig.edit';

/** What the routes need of the module: the adapter registry, once the wiring provides one. */
export interface CaptureConfigRouteSeams {
  /** The device registry of the adapter layer, or null while none is provided (`SIMULATED`: no adapter is registered). */
  deviceRegistry(): AssignmentRegistry | null;
}

/** What an edit asks of the adapter registry: rule RG-3, and (when the registry says it) the operation it was built for. */
export type AssignmentRegistry = Pick<CaptureDeviceRegistry, 'assertAssignable'> & { readonly operation?: CaptureOperation };

/** The registry entry of one of this module's operations. Throws at load for a name the registry does not hold. */
export function captureConfigOperation(operationId: CaptureConfigModuleOperation): CoreApiRegistryOperation {
  const operation: CoreApiRegistryOperation | undefined = CAPTURE_CONFIG_OPERATIONS.find((candidate) => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** The `{id}` of operations 79 and 80, held to the pattern the registry entry gives for it. */
function deviceParamsOf(operation: CoreApiRegistryOperation) {
  if (operation.pathParam === undefined) throw new Error(`the registry entry of ${operation.operationId} has no path parameter`);
  return z.object({ id: z.string().regex(operation.pathParam.pattern) });
}

/** 409 of an edit while a session is open (OD-10). No audit row: a state refusal, not an access one (SEC35-19). */
export function captureConfigLocked(): ApiFailure {
  return new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, LOCKED_TEXT);
}

const unknownDevice = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, UNKNOWN_DEVICE_TEXT);

/**
 * The mic rows in input order, ascending input ID (acceptance criterion AC-B-70; decision
 * D106 (1)): the SAME array when it is in that order. The hosted action keeps the order on every
 * edit and the durable mapping reads the rows back in it (`db/mapping/rows.ts`,
 * `captureConfigFromRow`, since row 129b), so for a state the engine committed this is a no-op.
 * It stays as the answer's own guarantee for a state that was put in place otherwise: the case
 * `AC-B-70` of `__tests__/routes.test.ts` holds it (integration pass C1: not removed for that reason).
 */
function micsInInputOrder<Mic extends { readonly inputId: string }>(mics: Mic[]): Mic[] {
  const ordered = mics.every((mic, index) => index === 0 || (mics[index - 1]?.inputId ?? '') <= mic.inputId);
  return ordered ? mics : [...mics].sort((left, right) => (left.inputId < right.inputId ? -1 : left.inputId > right.inputId ? 1 : 0));
}

/** Slice 29 as operations 76 and 78 to 80 answer it: `locked` from the open session, never from the stored slice. */
export function captureConfigAnswer(state: Pick<DurableSlices, 'captureConfig' | 'session'>): CaptureConfigSliceBody {
  return { ...state.captureConfig, mics: micsInInputOrder(state.captureConfig.mics), locked: isSessionActive(state.session) };
}

/**
 * What the selector's stored row cannot hold (`dbc-3 §B.1`: `mic_primary_id` / `mic_standby_id`
 * are DEVICE IDs; the input of a slot is read back as that ID). A mic line whose device is not
 * the microphone of the input's own ID would be stored, and then refused by the next start of the
 * server (`CAPTURE_MIC_INPUT_UNKNOWN`). Refused here, before the unit, until the stored selector
 * has input slots (decision for rows 129 / 136; D83 D-DB-13).
 */
function assertStorable(change: CaptureConfigChange): void {
  if (change.kind !== 'UPDATE') return;
  if ((change.mics ?? []).some((line) => line.deviceId !== line.inputId)) {
    throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, MIC_SLOT_TEXT, { details: { in: 'body' } });
  }
}

/**
 * Rule RG-3 of the adapter registry for the devices an edit ASSIGNS, when a registry is provided:
 * an assignment is refused when the device's source class is not the class of the running
 * capture operation, or when no adapter of that operation serves it. Only devices the committed
 * registry slice holds with the right class are asked: everything else is the action's own 404 or
 * 422. A role change (operation 80) assigns nothing.
 */
function assertAssignable(registry: AssignmentRegistry | null, state: DurableSlices, change: CaptureConfigChange): void {
  if (registry === null || change.kind === 'PRIMARY_MIC') return;
  const assigned: readonly { readonly deviceClass: 'CAMERA' | 'MIC'; readonly deviceId: string }[] =
    change.kind === 'CAMERA_SOURCE'
      ? [{ deviceClass: 'CAMERA', deviceId: change.deviceId }]
      : [...(change.cameras ?? []).map((line) => ({ deviceClass: 'CAMERA' as const, deviceId: line.deviceId })), ...(change.mics ?? []).map((line) => ({ deviceClass: 'MIC' as const, deviceId: line.deviceId }))];
  for (const { deviceClass, deviceId } of assigned) {
    const stored = state.captureDevices.devices.find((device) => device.id === deviceId && device.kind === deviceClass);
    if (stored === undefined) continue;
    try {
      registry.assertAssignable(deviceClass, deviceId);
    } catch (cause) {
      if (!(cause instanceof CaptureAdapterError)) throw cause;
      if (cause.code === CaptureAdapterRefusal.REGISTRY_LOCKED) throw captureConfigLocked();
      // The error's own text is a fixed sentence and its device ID a registry ID (rule CR-4).
      // Fix wave I: each refusal under its own reason (`captureAssignmentRefusalOf`).
      throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, NOT_ASSIGNABLE_TEXT, { details: { in: 'body', reason: captureAssignmentRefusalOf(cause.code, stored.sourceClass, registry.operation), deviceId }, cause });
    }
  }
}

/**
 * PAIR REPLACEMENT (operation 78 with `role` on its mic lines; decision D133 (1)): a line that
 * names no transport, for an input the selector does not hold yet, takes the transport of its
 * registry row. The replicated device slice has no transport member, so without this the new slot
 * would say a code the stored row does not - and a restarted Core would publish another selector.
 * One read of the registry, only for such a line; a line of the earlier form is returned as it is.
 */
async function withRegisteredTransports(app: FastifyInstance, change: CaptureConfigChange): Promise<CaptureConfigChange> {
  if (change.kind !== 'UPDATE' || change.mics === undefined || !change.mics.some((line) => line.role !== undefined)) return change;
  const held = new Set(app.engine.slice('captureConfig').mics.map((mic) => mic.inputId));
  if (change.mics.every((line) => line.transport !== undefined || held.has(line.inputId))) return change;
  const transports = await readMicTransports(app.db.pool);
  return {
    ...change,
    mics: change.mics.map((line) => {
      const transport = line.transport ?? (held.has(line.inputId) ? undefined : transports.get(line.deviceId));
      return transport === undefined ? line : { ...line, transport };
    }),
  };
}

/** Registers operations 76 to 80 on the app. Called once, by the module's plugin. */
export function registerCaptureConfigRoutes(app: FastifyInstance, seams: CaptureConfigRouteSeams): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  /** One edit as one unit of the engine. Resolves, after the commit, with the selector as it is stored. */
  const edit = async (request: FastifyRequest, operationId: CaptureConfigModuleOperation, requested: CaptureConfigChange): Promise<CaptureConfigSliceBody> => {
    assertStorable(requested);
    const change = await withRegisteredTransports(app, requested);
    const outcome = await app.engine.run(`captureConfig.${operationId}`, async (scope) => {
      const before = scope.pending();
      // The simulator's order: an unknown path ID is 404 also while the selector is locked.
      if (change.kind === 'CAMERA_SOURCE' && !before.captureDevices.devices.some((device) => device.id === change.deviceId && device.kind === 'CAMERA')) throw unknownDevice();
      if (change.kind === 'PRIMARY_MIC' && !before.captureConfig.mics.some((mic) => mic.inputId === change.inputId)) throw unknownDevice();
      // OD-10 / M4-LOCK-1: left BEFORE the action - no state change, no CAPTURE_CONFIG_CHANGED row.
      if (isSessionActive(before.session)) throw captureConfigLocked();
      assertAssignable(seams.deviceRegistry(), before, change);
      await scope.command(request.principal, 'setCaptureConfig', change);
      const after = scope.pending();
      return { captureConfig: after.captureConfig, changed: after.captureConfig !== before.captureConfig };
    });
    if (outcome.value.changed) {
      // Names and codes only: the operation, the kind of change, the position of the state.
      request.log.info({ code: 'CAPTURE_CONFIG_CHANGED', source: SOURCE, operationId, kind: change.kind, epoch: outcome.epoch, revision: outcome.revision }, CHANGED);
    }
    // No session is open: the unit read it. The stored slice never holds the lock.
    return captureConfigAnswer({ captureConfig: outcome.value.captureConfig, session: null });
  };

  // 76 getCaptureConfig
  routes.route({
    ...routeOfOperation(captureConfigOperation('getCaptureConfig')),
    schema: { response: { 200: CaptureConfigSliceSchema } },
    handler: async (): Promise<CaptureConfigSliceBody> => captureConfigAnswer(app.engine.state()),
  });

  // 77 getCaptureDevices
  routes.route({
    ...routeOfOperation(captureConfigOperation('getCaptureDevices')),
    schema: { response: { 200: CaptureDevicesSliceSchema } },
    handler: async (): Promise<CaptureDevicesSliceBody> => app.engine.slice('captureDevices'),
  });

  // 78 updateCaptureConfig
  routes.route({
    ...routeOfOperation(captureConfigOperation(CAPTURE_CONFIG_CHANGE_OPERATIONS.UPDATE)),
    schema: { body: CaptureConfigUpdateRequestSchema, response: { 200: CaptureConfigSliceSchema } },
    handler: async (request): Promise<CaptureConfigSliceBody> =>
      edit(request, CAPTURE_CONFIG_CHANGE_OPERATIONS.UPDATE, {
        kind: 'UPDATE',
        ...(request.body.cameras === undefined ? {} : { cameras: request.body.cameras }),
        ...(request.body.mics === undefined ? {} : { mics: request.body.mics }),
        // Task 4 row 29 (decision C14; AD-10): the slots the body CLEARS go to the hosted action.
        // Until this line the schema accepted the member and the Core answered 200 with nothing changed.
        ...(request.body.unassign === undefined ? {} : { unassign: request.body.unassign }),
      }),
  });

  // 79 setCaptureCameraSource
  const cameraSource = captureConfigOperation(CAPTURE_CONFIG_CHANGE_OPERATIONS.CAMERA_SOURCE);
  routes.route({
    ...routeOfOperation(cameraSource),
    schema: { params: deviceParamsOf(cameraSource), body: CaptureCameraSourceRequestSchema, response: { 200: CaptureConfigSliceSchema } },
    handler: async (request): Promise<CaptureConfigSliceBody> =>
      edit(request, CAPTURE_CONFIG_CHANGE_OPERATIONS.CAMERA_SOURCE, { kind: 'CAMERA_SOURCE', deviceId: request.params.id, trackId: request.body.trackId }),
  });

  // 80 setPrimaryMic
  const primaryMic = captureConfigOperation(CAPTURE_CONFIG_CHANGE_OPERATIONS.PRIMARY_MIC);
  routes.route({
    ...routeOfOperation(primaryMic),
    schema: { params: deviceParamsOf(primaryMic), response: { 200: CaptureConfigSliceSchema } },
    handler: async (request): Promise<CaptureConfigSliceBody> => edit(request, CAPTURE_CONFIG_CHANGE_OPERATIONS.PRIMARY_MIC, { kind: 'PRIMARY_MIC', inputId: request.params.id }),
  });
}
