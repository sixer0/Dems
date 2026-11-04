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
 *        inputs, one camera on two tracks with one profile (pairwise since D60, 2026-11-04), a replacing mic pair (lines with
 *        `role`, decision D133 (1)) that is not one PRIMARY and one STANDBY line; a device the adapter registry refuses
 *        for the running operation carries the reason of THAT refusal in `details.reason`
 *        (`CaptureAssignmentRefusal`; fix wave I - it was `DEVELOPMENT_SOURCE_NOT_ALLOWED` for all of them).
 *        A body of operation 78 that clears a slot (`unassign`) and fills the same slot: by the
 *        schema where it can see it (path `unassign`), by the action otherwise
 *        (`details.reason: SLOT_UNASSIGNED_AND_ASSIGNED`).
 *        A PRODUCTION camera (adapter kind `ONVIF_RTSP`) on a Core in real capture, assigned by
 *        operation 78 or 79 with no profile for an empty slot (`details.reason:
 *        CAMERA_PROFILE_NOT_STATED`) or with a profile its stored row does not list
 *        (`CAMERA_PROFILE_NOT_OF_DEVICE`) - see "A production camera has a profile of its own".
 *   503  the engine is not running, or the unit did not commit.
 *
 * A PRODUCTION CAMERA HAS A PROFILE OF ITS OWN (task 4 row 187; controller ruling C36 (1); design
 * addendum 7, AD-06). The profile of a selector line says what the recorded stream IS; for a
 * production camera that is the statement of its own stream, minted when the camera was adopted and
 * listed in its stored row (`capture_devices.profiles`). The hosted action gives a camera that is
 * assigned into an empty slot without a profile a constant of the SIMULATOR
 * (`CAPTURE_CONFIG_EMPTY_SLOT_PROFILE`); that default is the simulator's and never stands in for a
 * production camera here: this file does not import it (no file of the Core does: a static rule of
 * this module), and the edit is REFUSED BEFORE THE ACTION instead. The rule, for every camera line
 * of operation 78 and for operation 79, when a device registry is provided (a real capture
 * operation) and the committed registry slice says the device's adapter is `ONVIF_RTSP`:
 *   - the profile in force after the edit is the line's own, or - for a slot that holds a line -
 *     the profile that slot keeps (operation 79 names none);
 *   - none (an empty slot, no profile named): `422 INVALID_INPUT`, `CAMERA_PROFILE_NOT_STATED`;
 *   - one that is no element of the device's stored list: `422 INVALID_INPUT`,
 *     `CAMERA_PROFILE_NOT_OF_DEVICE`;
 *   - (row S86a; caution C-1 of row 86, C127) one that is listed but has NO STORED STREAM ROW
 *     (`capture_device_streams`, what the camera adapter's open reads): `422 INVALID_INPUT`,
 *     `CAMERA_PROFILE_WITHOUT_STREAM` (`PROFILE_WITHOUT_STREAM_REASON`; row V7c, C130) with its own
 *     sentence: adopt the camera again (operation 108 cannot heal it).
 * Nothing changes on a refusal: no state, no audit row, the slot as it was. NOT touched: Simulated
 * mode (no registry is provided), a development or fake source, a built-in device (their adapter
 * is another kind or none), a microphone.
 *
 * ONE DEVICE FILLS TWO VIDEO SLOTS ONLY AS THE DUAL-LENS CASE (row R2; ruling C93 on review finding
 * F3-11; made PAIRWISE by D60 of 2026-11-04 over the four tracks, as `capture_config_selector_check`
 * of migration 0039 and `CapturePlanSchema` of the protocol now state): two lines of ONE device are
 * legal only when they name TWO DIFFERENT PROFILES (OD-05); the same device with the same profile on
 * a second track is refused. The simulator's rule already admitted the dual-lens case; the protocol
 * admits it since D60 (its pairing, telemetry and fault key stay per device AND profile).
 * So that no start meets the plan builder's refusal, an edit of operation 78 or 79 that would leave
 * the SAME device behind two tracks WITH THE SAME PROFILE is REFUSED BEFORE THE ACTION when a device
 * registry is provided (a real capture operation, development or production): `422 INVALID_INPUT`,
 * `details.reason: CAMERA_ON_BOTH_TRACKS` - the word the simulator already answers for one camera
 * on both tracks (`CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS`), with `deviceId` and the `trackId` of
 * the refused line. It is judged on the selector as the edit would leave it (`unassign` first,
 * then the camera lines, as the action orders them), so a swap of the cameras in one body and
 * a move after a clear are not refused. Nothing changes on a refusal. NOT touched: Simulated mode
 * (no registry is provided: no worker exists there, and the simulator's own rule stands); a
 * selector that already held the state before this rule and is edited elsewhere (the plan
 * builder's start rule refuses it, `assertRecordableSelector`).
 *
 * `unassign` OF OPERATION 78 (task 4 row 29; decisions C14, C18, C25; security requirement AD-10).
 * The member names the slots the edit CLEARS (`VIDEO-01` to `VIDEO-04`, `MIC-01` to `MIC-04` — the
 * eight-slot selector of D61, 2026-11-04; was the two mic roles `PRIMARY`/`STANDBY`); the
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
import { CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS, isSessionActive, type CaptureConfigChange } from '@dems/shared/sim';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CaptureAdapterError, CaptureAdapterKind, CaptureAdapterRefusal, sourceClassOfOperation, type CaptureDeviceRegistry, type CaptureOperation } from '../../capture/adapters';
import type { DurableSlices } from '../../db/mapping';
import { ApiFailure } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import { readCameraProfiles, readCameraStreamProfiles, readMicTransports } from './store';

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

/**
 * `details.reason` of a PRODUCTION camera assigned without a profile of its own (task 4 row 187;
 * ruling C36 (1)). Words of this module, as the assignment refusals above are: the wire code is
 * the contract's `INVALID_INPUT`.
 */
export const CaptureProfileRefusal = {
  /** An empty slot, and the edit names no profile: the Core has no default for a production camera. */
  CAMERA_PROFILE_NOT_STATED: 'CAMERA_PROFILE_NOT_STATED',
  /** The profile in force after the edit is no element of the profiles the camera's stored row lists. */
  CAMERA_PROFILE_NOT_OF_DEVICE: 'CAMERA_PROFILE_NOT_OF_DEVICE',
  /** Task 4 row V7c (C130): the profile is listed, but no stored stream row holds it (row S86a; `common.captureSlotRefusal.CAMERA_PROFILE_WITHOUT_STREAM`). */
  CAMERA_PROFILE_WITHOUT_STREAM: 'CAMERA_PROFILE_WITHOUT_STREAM',
} as const;
export type CaptureProfileRefusal = (typeof CaptureProfileRefusal)[keyof typeof CaptureProfileRefusal];

/**
 * A LISTED CODE WITHOUT ITS STORED STREAM ROW (task 4 row S86a; caution C-1 of the security review
 * row 86; decision C127). The camera adapter's open refuses such a code (`onvif-relay.ts`, the
 * stored stream facts, `CAPTURE_PROFILE_UNKNOWN`); the assignment now refuses it first, with a
 * sentence that names the one remedy: ADOPT THE CAMERA AGAIN. A connection test (operation 108)
 * cannot heal it - a listed code with no stream row is a difference there, and a difference stores
 * nothing (row PR, case (b); C117, C126).
 *
 * THE WORD (task 4 row V7c; decision C130): `details.reason` is `CAMERA_PROFILE_WITHOUT_STREAM`, whose
 * sentence the shared tree holds (`common.captureSlotRefusal.CAMERA_PROFILE_WITHOUT_STREAM`, the same
 * words as `PROFILE_WITHOUT_STREAM_TEXT`, the `message`). Until row V7c this seam answered the closest
 * existing word, `CAMERA_PROFILE_NOT_OF_DEVICE` (row S86a).
 */
export const PROFILE_WITHOUT_STREAM_REASON: CaptureProfileRefusal = CaptureProfileRefusal.CAMERA_PROFILE_WITHOUT_STREAM;
export const PROFILE_WITHOUT_STREAM_TEXT =
  'This camera was not assigned: the Core holds no stream facts for this profile, so the camera cannot record it. A connection test does not repair this. Adopt the camera again, then assign one of the profiles it states.';

/** What the profile rule found for one camera line: the three refusals, or none. */
export type OwnProfileFinding = 'NOT_STATED' | 'NOT_OF_DEVICE' | 'WITHOUT_STREAM';

/**
 * The judgement of the profile in force for a PRODUCTION camera (rows 187 and S86a), pure:
 *   none                               -> NOT_STATED
 *   not an element of the stored list  -> NOT_OF_DEVICE
 *   listed, and no stored stream row   -> WITHOUT_STREAM
 * `listed` is the camera's stored list, `streamed` the codes that have a stream row for THAT camera.
 */
export function ownProfileFindingOf(inForce: string | undefined, listed: readonly string[], streamed: ReadonlySet<string>): OwnProfileFinding | null {
  if (inForce === undefined) return 'NOT_STATED';
  if (!listed.includes(inForce)) return 'NOT_OF_DEVICE';
  return streamed.has(inForce) ? null : 'WITHOUT_STREAM';
}

const LOCKED_TEXT = 'The capture configuration cannot be changed while a session is open.';
const OWN_PROFILE_TEXT = 'A production camera is assigned with a profile of its own: one of the profiles it was registered with.';
const ONE_SLOT_TEXT = 'One camera fills one video slot with one profile: this camera is already assigned to another track with this profile (the dual-lens case needs two profiles).'; // D60 (2026-11-04): the rule is pairwise on (device, profile)
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
 * What the selector's stored row cannot hold (`dbc-3 §B.1`: `mic_01_id` .. `mic_04_id` — D61,
 * 2026-11-04, was `mic_primary_id` / `mic_standby_id` —
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

/** The camera lines an edit assigns, each with the profile it names (operation 79 names none). */
function cameraLinesOf(change: CaptureConfigChange): readonly { readonly trackId: string; readonly deviceId: string; readonly profile?: string | undefined }[] {
  if (change.kind === 'CAMERA_SOURCE') return [{ trackId: change.trackId, deviceId: change.deviceId }];
  return change.kind === 'UPDATE' ? (change.cameras ?? []) : [];
}

/**
 * ONE DEVICE FILLS TWO VIDEO SLOTS ONLY WITH TWO PROFILES (see the header; ruling C93, pairwise
 * since D60 of 2026-11-04): refuses, before the hosted action and only when a device registry is
 * provided, a camera line that would leave its device behind a second track WITH THE SAME PROFILE.
 * The selector is taken as the edit would leave it - the slots the edit clears first, then its
 * camera lines, in the action's own order; a line that states no profile keeps the profile the
 * slot already holds. Only a device the committed registry slice holds as a camera is judged:
 * anything else is the action's own 404 or 422.
 */
function assertOneSlotPerCamera(registry: AssignmentRegistry | null, state: DurableSlices, change: CaptureConfigChange): void {
  if (registry === null) return;
  const lines = cameraLinesOf(change);
  if (lines.length === 0) return;
  // D60 (2026-11-04): the pair (deviceId, profile) is the collision key, not the device alone.
  const held = new Map<string, { readonly deviceId: string; readonly profile: string | null }>(
    state.captureConfig.cameras.map((camera) => [camera.trackId, { deviceId: camera.deviceId, profile: camera.profile }]),
  );
  if (change.kind === 'UPDATE') for (const slot of change.unassign ?? []) held.delete(slot);
  for (const line of lines) held.set(line.trackId, { deviceId: line.deviceId, profile: line.profile ?? held.get(line.trackId)?.profile ?? null });
  for (const line of lines) {
    if (!state.captureDevices.devices.some((device) => device.id === line.deviceId && device.kind === 'CAMERA')) continue;
    const profile = held.get(line.trackId)?.profile ?? null;
    const twice = [...held].some(([trackId, entry]) => trackId !== line.trackId && entry.deviceId === line.deviceId && entry.profile === profile);
    if (twice) throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, ONE_SLOT_TEXT, { details: { in: 'body', reason: CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS, deviceId: line.deviceId, trackId: line.trackId } });
  }
}

/** True for a camera of the committed registry slice whose adapter is the production camera kind. */
const isProductionCamera = (state: Pick<DurableSlices, 'captureDevices'>, deviceId: string): boolean =>
  state.captureDevices.devices.some((device) => device.id === deviceId && device.kind === 'CAMERA' && device.adapter === CaptureAdapterKind.ONVIF_RTSP);

/** Each finding of the profile rule as the 422 answers it: `details.reason` and the sentence (row S86a: the seam above). */
const OWN_PROFILE_ANSWER: Readonly<Record<OwnProfileFinding, { readonly reason: CaptureProfileRefusal; readonly text: string }>> = Object.freeze({
  NOT_STATED: { reason: CaptureProfileRefusal.CAMERA_PROFILE_NOT_STATED, text: OWN_PROFILE_TEXT },
  NOT_OF_DEVICE: { reason: CaptureProfileRefusal.CAMERA_PROFILE_NOT_OF_DEVICE, text: OWN_PROFILE_TEXT },
  WITHOUT_STREAM: { reason: PROFILE_WITHOUT_STREAM_REASON, text: PROFILE_WITHOUT_STREAM_TEXT },
});
const NO_STREAM_ROWS: ReadonlySet<string> = new Set<string>();

/**
 * A PRODUCTION CAMERA HAS A PROFILE OF ITS OWN (see the header): refuses, before the hosted action,
 * a camera line that would leave a production camera with no profile, with one its stored row
 * does not list, or (row S86a) with a listed one that has no stored stream row. `ownProfiles` is the
 * stored list by camera and `streamed` the codes with a stream row by camera, both read for this
 * edit; a production camera they do not hold states nothing, so every profile is refused for it
 * (fail closed).
 */
function assertOwnProfile(
  registry: AssignmentRegistry | null,
  state: DurableSlices,
  change: CaptureConfigChange,
  ownProfiles: ReadonlyMap<string, readonly string[]> | null,
  streamed: ReadonlyMap<string, ReadonlySet<string>> | null,
): void {
  if (registry === null) return;
  for (const line of cameraLinesOf(change)) {
    if (!isProductionCamera(state, line.deviceId)) continue;
    // What the action would store: the line's own profile, else the one a held slot keeps. An empty slot has none.
    const inForce = line.profile ?? state.captureConfig.cameras.find((camera) => camera.trackId === line.trackId)?.profile;
    const finding = ownProfileFindingOf(inForce, ownProfiles?.get(line.deviceId) ?? [], streamed?.get(line.deviceId) ?? NO_STREAM_ROWS);
    if (finding === null) continue;
    const { reason, text } = OWN_PROFILE_ANSWER[finding];
    throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, text, { details: { in: 'body', reason, deviceId: line.deviceId, trackId: line.trackId } });
  }
}

/**
 * PAIR REPLACEMENT (operation 78 with `channel` on its mic lines; decision D133 (1), carried onto the
 * numbered channels by D61 of 2026-11-04): a line that
 * names no transport, for an input the selector does not hold yet, takes the transport of its
 * registry row. The replicated device slice has no transport member, so without this the new slot
 * would say a code the stored row does not - and a restarted Core would publish another selector.
 * One read of the registry, only for such a line; a line of the earlier form is returned as it is.
 * R-FLEX row 132 (T-13, risk R-2; D16 Q96-02 (B)): "held" is judged on the selector as the edit
 * would leave it - the channels the edit clears (`unassign`) first, as the action orders them and as
 * the camera rule does (`assertOneSlotPerCamera`). A microphone MOVED from one channel to another in one
 * edit is a new line of the cleared selector and takes its registered transport; before this, it
 * kept none (`UNKNOWN` committed, the registry's code stored).
 */
async function withRegisteredTransports(app: FastifyInstance, change: CaptureConfigChange): Promise<CaptureConfigChange> {
  if (change.kind !== 'UPDATE' || change.mics === undefined || !change.mics.some((line) => line.channel !== undefined)) return change; // D61 (2026-11-04): the role member became the channel member
  const cleared: ReadonlySet<string> = new Set(change.unassign ?? []);
  const held = new Set(app.engine.slice('captureConfig').mics.filter((mic) => !cleared.has(mic.channel)).map((mic) => mic.inputId));
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

  /**
   * True when the edit assigns a production camera on a Core in real capture, by the committed state. An engine that
   * cannot say (not running) is "no": the unit below then answers as it always did, and reads nothing first.
   */
  const assignsProductionCamera = (change: CaptureConfigChange): boolean => {
    if (seams.deviceRegistry() === null) return false;
    const lines = cameraLinesOf(change);
    if (lines.length === 0) return false;
    try {
      const committed = { captureDevices: app.engine.slice('captureDevices') };
      return lines.some((line) => isProductionCamera(committed, line.deviceId));
    } catch {
      return false;
    }
  };

  /** One edit as one unit of the engine. Resolves, after the commit, with the selector as it is stored. */
  const edit = async (request: FastifyRequest, operationId: CaptureConfigModuleOperation, requested: CaptureConfigChange): Promise<CaptureConfigSliceBody> => {
    assertStorable(requested);
    const change = await withRegisteredTransports(app, requested);
    // Row 187 (C36 (1)): the stored profile lists, read ONCE and only for an edit that assigns a production camera on a Core in real
    // capture (a registry is provided). Simulated mode and every development, fake or built-in camera make no read.
    const ownProfiles = assignsProductionCamera(change) ? await readCameraProfiles(app.db.pool) : null;
    // Row S86a (C-1 of row 86, C127): with them, and under the same condition, the codes that have a STORED STREAM ROW - what the
    // camera adapter's open reads. Simulated mode (no registry) and every non-production camera make no read, as above.
    const streamed = ownProfiles === null ? null : await readCameraStreamProfiles(app.db.pool);
    const outcome = await app.engine.run(`captureConfig.${operationId}`, async (scope) => {
      const before = scope.pending();
      // The simulator's order: an unknown path ID is 404 also while the selector is locked.
      if (change.kind === 'CAMERA_SOURCE' && !before.captureDevices.devices.some((device) => device.id === change.deviceId && device.kind === 'CAMERA')) throw unknownDevice();
      if (change.kind === 'PRIMARY_MIC' && !before.captureConfig.mics.some((mic) => mic.inputId === change.inputId)) throw unknownDevice();
      // OD-10 / M4-LOCK-1: left BEFORE the action - no state change, no CAPTURE_CONFIG_CHANGED row.
      if (isSessionActive(before.session)) throw captureConfigLocked();
      assertAssignable(seams.deviceRegistry(), before, change);
      // Row R2 (C93): after the registry's own refusals, BEFORE the profile rule (no profile makes one camera two) and before the action.
      assertOneSlotPerCamera(seams.deviceRegistry(), before, change);
      // Row 187 (C36 (1)): after the registry's own refusals (each keeps its reason), BEFORE the action - no default profile stands in.
      assertOwnProfile(seams.deviceRegistry(), before, change, ownProfiles, streamed);
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
