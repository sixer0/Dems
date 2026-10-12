/**
 * The 47 action bindings (HB-14; backend task 04_client_integration_spec §2.5 "The 42 action
 * bindings", CL-19; 01_specs §7.17; task 3 register SH-18 adds the three capture actions, and
 * blueprint row 66 the hosted pair `setCaptureConfig` / `switchAudioSource`).
 *
 * Every member of the simulator's `SimActions` has one entry here: which operation the Live
 * action calls, how its arguments become the request, what it resolves with, and which refusals
 * it resolves with instead of rejecting. The operation IDs are NOT written here: each entry reads
 * them from the contract's table `SIM_ACTION_OPERATIONS` (`../../api/sim-actions`), so the engine
 * host, the conformance test and this file read one definition. The table of this file is held to
 * `keyof SimActions` at compile time: an action added to the simulator does not compile until it
 * has a binding.
 *
 * | Flow | Bindings | How the Live source runs it (`./live-sim`) |
 * |------|---------:|--------------------------------------------|
 * | `command` | 35 | A POST through the atomicity gate: it settles in the turn in which the store reaches the revision the answer named (CL-16), or the epoch it named (CL-18) |
 * | `read` | 1 | A GET (`verifyAuditChain`): it settles with the answer |
 * | `sign-in` | 2 | `signIn`, `signInWithBiometric`: the answer, then a new socket, then the snapshot of that socket (§5.2) |
 * | `sign-out` | 1 | `signOut`: the answer ends the session and drops the Core data (WS-12) |
 * | `touch` | 1 | Throttled (CL-27) |
 * | `pair`, `unpair` | 2 | The device credential goes to, and is deleted by, the app's own storage (MP-6, MP-7) |
 * | `local` | 6 | No operation exists: `signInWithSecurityKey` is refused (X-1); `setTabletLink` (X-2), `applyCaptureTelemetry`, `raiseCaptureWarning` and `clearCaptureWarning` (SH-18) and `registerCaptureDevice` (R-9: the Core registers a camera inside operation 96) resolve |
 *
 * A binding of any flow may also answer by itself, without a request, where the simulator's action
 * changes nothing or throws before it looks at anything the server holds: `startRecording` outside
 * ARMED, a session command without an open session, a camera that is already the active one, a
 * `pair` on a paired tablet, an `unpair` on one that is not paired.
 *
 * **The input travels as the caller gave it.** A binding trims nothing, cuts nothing and validates
 * nothing: the Core server is the judge, in its own order (identity and permission first, with the
 * audit row of a denial, then the body). Where the simulator would cut a text (a marker label of
 * more than 80 code units, a destination of more than 120), the Core server refuses it with 422;
 * a form keeps the bounds of the contract.
 *
 * **Results** (CL-19). A simulator action that returns a result union resolves with that union,
 * also for a refusal: `refusal` maps the failure by status and code. When `refusal` is absent, or
 * returns `undefined`, the action rejects with the error `./rebuild-error` builds.
 *
 * Pure: nothing here calls the network or reads the store; a binding gets the state it reads as
 * an argument.
 */
import { exportJobIdOf } from '../../api/patterns';
import { DEFAULT_SESSION_ROOM } from '../../api/session-schema';
import { ApiErrorCode, type EvidenceExportAccepted, type SessionCommandResponse } from '../../api/core-api';
import type { DemoEpoch } from '../../api/demo-controls';
import type { EvidenceVerifyResultBody } from '../../api/evidence';
import type { SignInResponse, SignInStatus } from '../../api/identity';
import type { PairingRedeemed } from '../../api/pairing';
import type { AuditChainStatus, AuditExportAccepted } from '../../api/security-audit';
import type { CaseNumberScan } from '../../api/sessions';
import { CAPTURE_CONFIG_CHANGE_OPERATIONS, DEVICE_COMMAND_OPERATIONS, SIM_ACTION_OPERATIONS, type SimActionName } from '../../api/sim-actions';
import type { DiagnosticsRunStarted, ServicesRestarted } from '../../api/system';
import type { CoreCallFailure, CoreCallSuccess, CoreLooseCallInput } from '../../client/core-client';
import { AUTH_LOCKOUT_MS, PAIRING_LOCKOUT_MS } from '../../sim/constants';
import { SimErrorCode, SimTransitionError } from '../../sim/errors';
import type {
  AuditExportRequest,
  CaptureConfigChange,
  CreateSessionResult,
  EpochMs,
  ExportRequest,
  ExportResult,
  PairResult,
  SignInResult,
  SimActions,
  SimState,
} from '../../sim/types';
import { DeviceCommand, PairingState, SignOutReason } from '../../sim/vocabulary';
import { SessionState } from '../../domain/enums';
import { CoreRefusalError } from '../errors';
import { attemptsRemainingOf } from './neutral-state';
import { detailNumber, detailText, isRefusal } from './rebuild-error';
import type { ReplicaPosition } from './replica';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Model
// ═══════════════════════════════════════════════════════════════════════════════════════

export const LiveActionFlow = {
  COMMAND: 'command',
  READ: 'read',
  SIGN_IN: 'sign-in',
  SIGN_OUT: 'sign-out',
  TOUCH: 'touch',
  PAIR: 'pair',
  UNPAIR: 'unpair',
  LOCAL: 'local',
} as const;
export type LiveActionFlow = (typeof LiveActionFlow)[keyof typeof LiveActionFlow];

/** The code of the refusal of an action that has no operation in Live mode (X-1), or no port to run through. */
export const NOT_AVAILABLE = 'NOT_AVAILABLE';

/** What the redeem request says about the device (MP-5). No hardware identifier. */
export interface LiveDeviceDescription {
  readonly deviceName: string;
  readonly platform: string;
  readonly appVersion: string;
}

/** What a binding reads when it maps its input or a refusal: the store's state and the Live clock. */
export interface BindingView {
  readonly state: SimState;
  readonly now: EpochMs;
}

/** What the Live source obtained for a binding before it planned the request. Never kept. */
export interface BindingExtras {
  /** `signInWithBiometric`: the token the app's storage released. */
  readonly biometricToken?: string | null;
  /** `pair`: the device description. */
  readonly device?: LiveDeviceDescription | null;
}

/** What the request named, for a 404 (`SimNotFoundError(entity, id)`). */
export interface BindingEntity {
  readonly kind: 'session' | 'evidence' | 'device' | 'alert';
  readonly id: string;
}

export type BindingPlan<Result> =
  | { readonly kind: 'call'; readonly operationId: string; readonly input: CoreLooseCallInput; readonly entity: BindingEntity | null }
  | { readonly kind: 'resolve'; readonly value: Result }
  | { readonly kind: 'reject'; readonly error: Error };

export interface LiveBinding<Args extends readonly unknown[], Result> {
  readonly flow: LiveActionFlow;
  /** The request of the action, or its local answer. */
  plan(args: Args, view: BindingView, extras: BindingExtras): BindingPlan<Result>;
  /** The action's value for a 2xx answer (its body was parsed by the contract's schema, CL-4). */
  result(success: CoreCallSuccess, view: BindingView): Result;
  /** CL-19: the member of the result union for a refusal, or `undefined` when the action rejects. */
  refusal?(failure: CoreCallFailure, view: BindingView): Result | undefined;
  /** The simulator code a 422 without `details.simCode` stands for on this action. */
  readonly invalidInputCode?: SimErrorCode;
  /** CL-18: the position a success waits for when it is not the one of the answer's headers. */
  target?(success: CoreCallSuccess): ReplicaPosition | null;
}

export type LiveBindings = {
  readonly [Name in keyof SimActions]: LiveBinding<Parameters<SimActions[Name]>, ReturnType<SimActions[Name]>>;
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The operation an action reaches, from the contract's table. `index` picks one of `deviceCommand`'s three. */
export function operationOf(action: SimActionName, index = 0): string {
  const operations: readonly string[] = SIM_ACTION_OPERATIONS[action].operations;
  const operationId = operations[index];
  if (operationId === undefined) throw new Error(`The contract names no operation ${index} for the action "${action}".`);
  return operationId;
}

/**
 * Which of `deviceCommand`'s three operations a command reaches, as an index into the contract's list (48, 49, 50).
 *
 * Read from the contract's table `DEVICE_COMMAND_OPERATIONS` (W83 closed the local adapter of
 * gap 3; the name stays, it is part of this subpath's public API). A test holds each index
 * to the path of the operation it reaches.
 */
const DEVICE_COMMAND_OPERATION_LIST: readonly string[] = SIM_ACTION_OPERATIONS.deviceCommand.operations;
export const DEVICE_COMMAND_OPERATION_INDEX: Readonly<Record<DeviceCommand, number>> = {
  [DeviceCommand.RESTART]: DEVICE_COMMAND_OPERATION_LIST.indexOf(DEVICE_COMMAND_OPERATIONS.RESTART),
  [DeviceCommand.TEST_SIGNAL]: DEVICE_COMMAND_OPERATION_LIST.indexOf(DEVICE_COMMAND_OPERATIONS.TEST_SIGNAL),
  [DeviceCommand.IDENTIFY]: DEVICE_COMMAND_OPERATION_LIST.indexOf(DEVICE_COMMAND_OPERATIONS.IDENTIFY),
  // Task 3 M2-W7 (E-12; C3 §0): the PoE cycle reaches operation 48 too — the same index as RESTART;
  // the server decides the mode from the body and the camera's stream state (C3 §3 op 48).
  [DeviceCommand.POE_CYCLE]: DEVICE_COMMAND_OPERATION_LIST.indexOf(DEVICE_COMMAND_OPERATIONS.POE_CYCLE),
};

/** The operation index of a device command. Own keys only: a text that names an inherited member is no command. */
function deviceCommandIndex(command: unknown): number | undefined {
  return typeof command === 'string' && Object.prototype.hasOwnProperty.call(DEVICE_COMMAND_OPERATION_INDEX, command)
    ? DEVICE_COMMAND_OPERATION_INDEX[command as DeviceCommand]
    : undefined;
}

/**
 * Which of `setCaptureConfig`'s three operations a kind of change reaches, as an index into the
 * contract's list (78, 79, 80). Read from the contract's table `CAPTURE_CONFIG_CHANGE_OPERATIONS`.
 */
const CAPTURE_CONFIG_OPERATION_LIST: readonly string[] = SIM_ACTION_OPERATIONS.setCaptureConfig.operations;
export const CAPTURE_CONFIG_CHANGE_OPERATION_INDEX: Readonly<Record<CaptureConfigChange['kind'], number>> = {
  UPDATE: CAPTURE_CONFIG_OPERATION_LIST.indexOf(CAPTURE_CONFIG_CHANGE_OPERATIONS.UPDATE),
  CAMERA_SOURCE: CAPTURE_CONFIG_OPERATION_LIST.indexOf(CAPTURE_CONFIG_CHANGE_OPERATIONS.CAMERA_SOURCE),
  PRIMARY_MIC: CAPTURE_CONFIG_OPERATION_LIST.indexOf(CAPTURE_CONFIG_CHANGE_OPERATIONS.PRIMARY_MIC),
};

/** The operation index of a kind of change. Own keys only, as for a device command. */
function captureConfigChangeIndex(kind: unknown): number | undefined {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(CAPTURE_CONFIG_CHANGE_OPERATION_INDEX, kind)
    ? CAPTURE_CONFIG_CHANGE_OPERATION_INDEX[kind as CaptureConfigChange['kind']]
    : undefined;
}

const call = <Result>(operationId: string, input: CoreLooseCallInput = {}, entity: BindingEntity | null = null): BindingPlan<Result> => ({
  kind: 'call',
  operationId,
  input,
  entity,
});
const resolve = <Result>(value: Result): BindingPlan<Result> => ({ kind: 'resolve', value });
const reject = <Result>(error: Error): BindingPlan<Result> => ({ kind: 'reject', error });
const nothing = (): void => undefined;

/**
 * A command on the open session (operations with `{id}` under `/session`). The simulator's actions
 * take no ID: they act on the one session of the store. Here the ID is the replica's. Without an
 * open session there is nothing to name, and the action is refused as the simulator refuses it.
 */
function onSession(action: SimActionName, body?: unknown): (args: readonly unknown[], view: BindingView) => BindingPlan<void> {
  return (_args, view) => {
    const session = view.state.session;
    if (!session) return reject(new SimTransitionError(null, action));
    return call(operationOf(action), { params: { id: session.id }, ...(body === undefined ? {} : { body }) }, { kind: 'session', id: session.id });
  };
}

function signedIn(success: CoreCallSuccess): SignInResult {
  const { session } = success.data as SignInResponse;
  return { ok: true, operatorId: session.operator.id, role: session.operator.role, method: session.method };
}

/** The lock state of a console as the union the sign-in actions return for a failed attempt. */
export function attemptResult(status: Pick<SignInStatus, 'locked' | 'lockedUntil' | 'retryInMs' | 'attemptsRemaining'>): SignInResult {
  return status.locked && status.lockedUntil !== null
    ? { ok: false, reason: 'LOCKED', lockedUntil: status.lockedUntil, retryInMs: status.retryInMs }
    : { ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: status.attemptsRemaining };
}

function signInRefusal(failure: CoreCallFailure, view: BindingView): SignInResult | undefined {
  if (isRefusal(failure, 401, ApiErrorCode.INVALID_CREDENTIALS)) {
    // The server names the attempts left (ID-3). Without them, the view this client already holds stands.
    const attemptsRemaining = detailNumber(failure, 'attemptsRemaining') ?? attemptsRemainingOf(view.state.authLockout);
    return { ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining };
  }
  if (failure.status === 423) {
    const retryInMs = detailNumber(failure, 'retryInMs') ?? AUTH_LOCKOUT_MS;
    return { ok: false, reason: 'LOCKED', lockedUntil: detailNumber(failure, 'lockedUntil') ?? view.now + retryInMs, retryInMs };
  }
  return undefined;
}

/**
 * The reason of an export the Core refused with `409 EXPORT_IN_PROGRESS` (C3 §3 op 42, schema v2: a
 * job of the item is still QUEUED or RUNNING). Integration pass D5; a member of `ExportResult`
 * since pass D6. A client compares against this constant.
 */
export const EXPORT_IN_PROGRESS_REASON = 'EXPORT_IN_PROGRESS';
function exportInProgress(): ExportResult {
  return { ok: false, status: 409, reason: EXPORT_IN_PROGRESS_REASON };
}

/** What an accepted export of the Live source carries beyond `ExportResult`: the job operation 87 polls, when the 202 names it. */
export type LiveExportAccepted = Extract<ExportResult, { ok: true }> & {
  readonly jobId?: string;
  /**
   * Fix wave K (G94b-06): the server fact of operation 42, handed on BY NAME and only when the 202
   * states it as a boolean - `true` an export job of the Core writes an archive, `false` the
   * request was only recorded. Absent: the Core did not say (a client treats it as `false`).
   */
  readonly archiveOnCore?: boolean;
};

/** CL-19: 401 → NOT_SIGNED_IN, any 403 → FORBIDDEN, 404 → NOT_FOUND, 409 → EXPORT_IN_PROGRESS, SECURITY_FAULT or NOT_SEALED (409 COMMAND_UNSUPPORTED is thrown, not a result), 422 → INVALID_REASON. */
function exportRefusal(failure: CoreCallFailure): ExportResult | undefined {
  switch (failure.status) {
    case 401:
      return { ok: false, status: 401, reason: 'NOT_SIGNED_IN' };
    case 403:
      return { ok: false, status: 403, reason: 'FORBIDDEN' };
    case 404:
      return { ok: false, status: 404, reason: 'NOT_FOUND' };
    case 409:
      if (isRefusal(failure, 409, ApiErrorCode.EXPORT_IN_PROGRESS)) return exportInProgress();
      // Fix wave J (truth rule 3d; JA2-03 / JW-03): `409 COMMAND_UNSUPPORTED` is the refusal of an export output the
      // Core cannot produce (`details.reason: COMPOSITE_ENCODER_NOT_SELECTED`). It is NOT "not sealed": it is left to
      // the common rebuild, which throws the simulator's `SimTransitionError` (`COMMAND_UNSUPPORTED`, with the reason).
      if (isRefusal(failure, 409, ApiErrorCode.COMMAND_UNSUPPORTED)) return undefined;
      return { ok: false, status: 409, reason: isRefusal(failure, 409, ApiErrorCode.SECURITY_FAULT) ? 'SECURITY_FAULT' : 'NOT_SEALED' };
    case 422:
      return { ok: false, status: 422, reason: 'INVALID_REASON' };
    default:
      return undefined;
  }
}

/** The body of the three exports: the reason is mandatory in Live mode (01_specs §7.13), so it always travels. */
function exportBody(request: ExportRequest | AuditExportRequest | undefined): { reason: string; destination?: string } {
  return {
    reason: typeof request?.reason === 'string' ? request.reason : '',
    ...(typeof request?.destination === 'string' ? { destination: request.destination } : {}),
  };
}

/**
 * Operation 42 only (schema v2): the kind the request names travels; a request that names none sends
 * none, and the Core reads that as PACKAGE (so the body of a v1 caller is unchanged).
 */
function evidenceExportBody(request: ExportRequest | undefined): { reason: string; destination?: string; kind?: 'PACKAGE' | 'COMPOSITE' } {
  const kind = request?.kind;
  return { ...exportBody(request), ...(kind === 'PACKAGE' || kind === 'COMPOSITE' ? { kind } : {}) };
}

const exported = (success: CoreCallSuccess): ExportResult => ({
  ok: true,
  status: 202,
  exportId: (success.data as EvidenceExportAccepted | AuditExportAccepted).exportId,
});

/** Operation 42: as `exported`, with the job ID of the 202 when the Core names one (optional member; ruling D140). */
const evidenceExported = (success: CoreCallSuccess): ExportResult => {
  // The ONE rule (`exportJobIdOf`): with no export ID it answers the answered job ID, or null.
  const answered = exportJobIdOf('', (success.data as { jobId?: unknown }).jobId);
  const archiveOnCore = (success.data as { archiveOnCore?: unknown }).archiveOnCore;
  const accepted: LiveExportAccepted = {
    ...(exported(success) as LiveExportAccepted),
    ...(answered === null ? {} : { jobId: answered }),
    ...(typeof archiveOnCore === 'boolean' ? { archiveOnCore } : {}),
  };
  return accepted;
};

/** A scenario load and a reset start a new epoch: the action settles when the snapshot of that epoch is applied (CL-18). */
const newEpoch = (success: CoreCallSuccess): ReplicaPosition => ({ epoch: (success.data as DemoEpoch).epoch, revision: 0 });

// ═══════════════════════════════════════════════════════════════════════════════════════
// The table
// ═══════════════════════════════════════════════════════════════════════════════════════

export const LIVE_BINDINGS: LiveBindings = {
  // ── Auth: server-native (01_specs §7.5) ──
  signIn: {
    flow: LiveActionFlow.SIGN_IN,
    plan: ([username, password]) => call(operationOf('signIn'), { body: { username, password } }),
    result: signedIn,
    refusal: signInRefusal,
  },
  signInWithBiometric: {
    flow: LiveActionFlow.SIGN_IN,
    // The parameter list stays; the token comes from the app's storage through the injected port (§9.3).
    plan: (_args, _view, extras) =>
      typeof extras.biometricToken === 'string' && extras.biometricToken !== ''
        ? call(operationOf('signInWithBiometric'), { body: { token: extras.biometricToken } })
        : reject(new CoreRefusalError(NOT_AVAILABLE)),
    result: signedIn,
    refusal: signInRefusal,
  },
  recordBiometricFailure: {
    flow: LiveActionFlow.COMMAND,
    plan: ([operatorId]) => call(operationOf('recordBiometricFailure'), { body: { operatorId: operatorId ?? null } }),
    result: (success) => attemptResult(success.data as SignInStatus),
  },
  signInWithSecurityKey: {
    flow: LiveActionFlow.LOCAL,
    plan: () => reject(new CoreRefusalError(NOT_AVAILABLE)),
    result: (): SignInResult => {
      throw new CoreRefusalError(NOT_AVAILABLE);
    },
  },
  signOut: {
    flow: LiveActionFlow.SIGN_OUT,
    plan: ([reason]) => call(operationOf('signOut'), { body: { reason: reason ?? SignOutReason.USER } }),
    result: nothing,
  },
  touch: {
    flow: LiveActionFlow.TOUCH,
    plan: () => call(operationOf('touch')),
    result: nothing,
  },

  // ── Session machine (01_specs §7.8) ──
  createSession: {
    flow: LiveActionFlow.COMMAND,
    plan: ([input]) =>
      call(operationOf('createSession'), {
        // The simulator fills the device's room when the input has none; the contract requires one.
        body: typeof input === 'object' && input !== null && input.room === undefined ? { ...input, room: DEFAULT_SESSION_ROOM } : input,
      }),
    result: (success): CreateSessionResult => {
      const data = success.data as SessionCommandResponse;
      return { ok: true, sessionId: data.sessionId, created: data.created ?? success.status === 201 };
    },
    refusal: (failure, view): CreateSessionResult | undefined => {
      const open = view.state.session;
      const active = open !== null && open.state !== SessionState.SEALED ? open.id : null;
      if (isRefusal(failure, 401, ApiErrorCode.NOT_SIGNED_IN)) return { ok: false, reason: 'NOT_SIGNED_IN', sessionId: null };
      if (isRefusal(failure, 403, ApiErrorCode.NOT_PERMITTED)) return { ok: false, reason: 'NOT_PERMITTED', sessionId: null };
      if (isRefusal(failure, 409, ApiErrorCode.SESSION_ACTIVE)) {
        return { ok: false, reason: 'SESSION_ACTIVE', sessionId: detailText(failure, 'sessionId') ?? active };
      }
      if (failure.status === 422) return { ok: false, reason: 'INVALID_INPUT', sessionId: active };
      return undefined;
    },
  },
  beginPrecheck: { flow: LiveActionFlow.COMMAND, plan: onSession('beginPrecheck'), result: nothing },
  acknowledgePrecheckWarnings: { flow: LiveActionFlow.COMMAND, plan: onSession('acknowledgePrecheckWarnings'), result: nothing },
  retryPrecheck: { flow: LiveActionFlow.COMMAND, plan: onSession('retryPrecheck'), result: nothing },
  startRecording: {
    flow: LiveActionFlow.COMMAND,
    // Operation 25 is a composite on the server (it may run the pre-check too). The simulator's
    // action is the single step ARMED → RECORDING, so it is called only from ARMED (§2.5).
    plan: (args, view) => {
      const session = view.state.session;
      if (session?.state !== SessionState.ARMED) return reject(new SimTransitionError(session?.state ?? null, 'startRecording'));
      return onSession('startRecording')(args, view);
    },
    result: nothing,
  },
  stopRecording: {
    flow: LiveActionFlow.COMMAND,
    plan: ([reason], view) => onSession('stopRecording', { reason })([], view),
    result: nothing,
    invalidInputCode: SimErrorCode.REASON_TOO_SHORT,
  },
  cancel: { flow: LiveActionFlow.COMMAND, plan: onSession('cancel'), result: nothing },
  scanCaseNumber: {
    flow: LiveActionFlow.COMMAND,
    plan: () => call(operationOf('scanCaseNumber')),
    result: (success) => (success.data as CaseNumberScan).caseNumber,
  },
  recover: { flow: LiveActionFlow.COMMAND, plan: onSession('recover'), result: nothing },
  addMarker: {
    flow: LiveActionFlow.COMMAND,
    plan: ([label], view) => onSession('addMarker', label === undefined ? undefined : { label })([], view),
    result: nothing,
  },
  addNote: {
    flow: LiveActionFlow.COMMAND,
    plan: ([text], view) => onSession('addNote', { text })([], view),
    result: nothing,
    invalidInputCode: SimErrorCode.NOTE_INVALID,
  },
  snapshot: { flow: LiveActionFlow.COMMAND, plan: onSession('snapshot'), result: nothing },
  acknowledgeSummary: {
    flow: LiveActionFlow.COMMAND,
    plan: ([sessionId]) => call(operationOf('acknowledgeSummary'), { params: { id: sessionId } }, { kind: 'session', id: sessionId }),
    result: nothing,
  },

  // ── Evidence and audit (01_specs §7.9, §7.13) ──
  verify: {
    flow: LiveActionFlow.COMMAND,
    plan: ([evidenceId]) => call(operationOf('verify'), { params: { id: evidenceId } }, { kind: 'evidence', id: evidenceId }),
    result: (success) => success.data as EvidenceVerifyResultBody,
  },
  exportEvidence: {
    flow: LiveActionFlow.COMMAND,
    plan: ([evidenceId, request]) =>
      call(operationOf('exportEvidence'), { params: { id: evidenceId }, body: evidenceExportBody(request) }, { kind: 'evidence', id: evidenceId }),
    result: evidenceExported,
    refusal: exportRefusal,
  },
  archiveEvidence: {
    flow: LiveActionFlow.COMMAND,
    plan: ([evidenceId]) => call(operationOf('archiveEvidence'), { params: { id: evidenceId } }, { kind: 'evidence', id: evidenceId }),
    result: nothing,
  },
  exportAudit: {
    flow: LiveActionFlow.COMMAND,
    plan: ([request]) => call(operationOf('exportAudit'), { body: exportBody(request) }),
    result: exported,
    refusal: exportRefusal,
  },
  exportLogs: {
    flow: LiveActionFlow.COMMAND,
    plan: ([request]) => call(operationOf('exportLogs'), { body: exportBody(request) }),
    result: exported,
    refusal: exportRefusal,
  },
  verifyAuditChain: {
    flow: LiveActionFlow.READ,
    plan: () => call(operationOf('verifyAuditChain')),
    // The check over the audit view; `stored` and `lineage` stay on the Live handle (§2.5; section 8.2, A9).
    result: (success) => (success.data as AuditChainStatus).view,
  },

  // ── Faults and scenarios (01_specs §7.16) ──
  inject: {
    flow: LiveActionFlow.COMMAND,
    plan: ([kind, target]) =>
      call(
        operationOf('inject'),
        { body: { kind, ...(target === undefined ? {} : { target }) } },
        typeof target?.evidenceId === 'string' ? { kind: 'evidence', id: target.evidenceId } : null,
      ),
    result: nothing,
  },
  clearFault: {
    flow: LiveActionFlow.COMMAND,
    plan: ([kind, target]) => call(operationOf('clearFault'), { body: { kind, ...(target === undefined ? {} : { target }) } }),
    result: nothing,
  },
  resetClip: {
    flow: LiveActionFlow.COMMAND,
    plan: ([channel]) => call(operationOf('resetClip'), { body: { channel } }),
    result: nothing,
  },
  acknowledgeAlert: {
    flow: LiveActionFlow.COMMAND,
    plan: ([alertId]) => call(operationOf('acknowledgeAlert'), { params: { id: alertId } }, { kind: 'alert', id: alertId }),
    result: nothing,
  },
  loadScenario: {
    flow: LiveActionFlow.COMMAND,
    plan: ([name]) => call(operationOf('loadScenario'), { body: { name } }),
    result: nothing,
    target: newEpoch,
  },
  resetDemo: {
    flow: LiveActionFlow.COMMAND,
    plan: () => call(operationOf('resetDemo')),
    result: nothing,
    target: newEpoch,
  },

  // ── Devices, storage, maintenance (01_specs §7.10, §7.11, §7.14) ──
  runDiagnostics: {
    flow: LiveActionFlow.COMMAND,
    plan: () => call(operationOf('runDiagnostics')),
    result: (success) => (success.data as DiagnosticsRunStarted).runId,
  },
  deviceCommand: {
    flow: LiveActionFlow.COMMAND,
    plan: ([deviceId, command]) => {
      const index = deviceCommandIndex(command);
      if (index === undefined) return reject(new SimTransitionError(null, 'deviceCommand', undefined, SimErrorCode.COMMAND_UNSUPPORTED));
      // Task 3, decision D100 (2) (C3 §3 op 48; OD-22): a PoE cycle is a command a client issues only
      // after the operator confirmed it, and the Core takes it only with `{ confirm: true }`. RESTART
      // stays bodyless: for a camera the Core refuses it, for every other device it is the plain restart.
      const request = command === DeviceCommand.POE_CYCLE ? { params: { id: deviceId }, body: { confirm: true } } : { params: { id: deviceId } };
      return call(operationOf('deviceCommand', index), request, { kind: 'device', id: deviceId });
    },
    result: nothing,
  },
  setStoragePolicy: {
    flow: LiveActionFlow.COMMAND,
    plan: ([policy]) => call(operationOf('setStoragePolicy'), { body: policy }),
    result: nothing,
    invalidInputCode: SimErrorCode.POLICY_RANGE,
  },
  startSoftwareUpdate: { flow: LiveActionFlow.COMMAND, plan: () => call(operationOf('startSoftwareUpdate')), result: nothing },
  restartServices: {
    flow: LiveActionFlow.COMMAND,
    plan: () => call(operationOf('restartServices')),
    result: (success) => (success.data as ServicesRestarted).restarted,
  },
  setActiveCamera: {
    flow: LiveActionFlow.COMMAND,
    // The simulator does nothing when the camera is already the active one.
    plan: ([cameraId], view) =>
      view.state.activeCameraId === cameraId ? resolve(undefined) : call(operationOf('setActiveCamera'), { body: { cameraId } }),
    result: nothing,
  },

  // ── Console settings: both reach operation 68 ──
  setPresentationMode: {
    flow: LiveActionFlow.COMMAND,
    plan: ([enabled]) => call(operationOf('setPresentationMode'), { body: { presentationMode: enabled === true } }),
    result: nothing,
  },
  updateSettings: {
    flow: LiveActionFlow.COMMAND,
    plan: ([patch]) => call(operationOf('updateSettings'), { body: patch }),
    result: nothing,
  },

  // ── Pairing and the tablet link (01_specs §7.7) ──
  pair: {
    flow: LiveActionFlow.PAIR,
    plan: ([code], view, extras) => {
      const { pairing } = view.state;
      // The simulator answers a pair on a paired tablet with its pairing; a second redeem would register a second device.
      if (pairing.state === PairingState.PAIRED) return resolve<PairResult>({ ok: true, pairedAt: pairing.pairedAt ?? view.now });
      const device = extras.device;
      if (!device) return reject(new CoreRefusalError(NOT_AVAILABLE));
      return call(operationOf('pair'), {
        body: { code, deviceName: device.deviceName, platform: device.platform, appVersion: device.appVersion },
      });
    },
    result: (success): PairResult => ({ ok: true, pairedAt: (success.data as PairingRedeemed).pairedAt }),
    refusal: (failure, view): PairResult | undefined => {
      if (isRefusal(failure, 401, ApiErrorCode.INVALID_CODE)) {
        return { ok: false, reason: 'INVALID_CODE', attemptsRemaining: detailNumber(failure, 'attemptsRemaining') ?? 0 };
      }
      if (failure.status === 423) {
        const retryInMs = detailNumber(failure, 'retryInMs') ?? PAIRING_LOCKOUT_MS;
        return { ok: false, reason: 'LOCKED', lockedUntil: detailNumber(failure, 'lockedUntil') ?? view.now + retryInMs, retryInMs };
      }
      return undefined;
    },
  },
  unpair: {
    flow: LiveActionFlow.UNPAIR,
    // The simulator does nothing on a tablet that is not paired.
    plan: (_args, view) => (view.state.pairing.state === PairingState.PAIRED ? call(operationOf('unpair')) : resolve(undefined)),
    result: nothing,
  },
  setTabletLink: {
    flow: LiveActionFlow.LOCAL,
    // X-2: no client may set the link; the server sets it from real connections (01_specs §6.8).
    plan: () => resolve(undefined),
    result: nothing,
  },
  applyCaptureTelemetry: {
    flow: LiveActionFlow.LOCAL,
    // SH-18: no client feeds telemetry; the server takes it from its own capture supervisor.
    plan: () => resolve(undefined),
    result: nothing,
  },
  raiseCaptureWarning: {
    flow: LiveActionFlow.LOCAL,
    // SH-18: no client raises a capture warning; it arrives as an alert of the replicated state.
    plan: () => resolve(undefined),
    result: nothing,
  },
  clearCaptureWarning: {
    flow: LiveActionFlow.LOCAL,
    // SH-18: nor clears one. Operation 74 (`clearFault`) stays the demo control it was.
    plan: () => resolve(undefined),
    result: nothing,
  },
  applyStorageVolume: {
    flow: LiveActionFlow.LOCAL,
    // CS-09 (pass D6): no client states the evidence volume; the Core measures it at boot and it arrives in slice `storage`.
    plan: () => resolve(undefined),
    result: nothing,
  },

  // ── The capture selector and the mic switch (C3 §2.4, operations 78 to 81; register SH-18) ──
  setCaptureConfig: {
    flow: LiveActionFlow.COMMAND,
    plan: ([change]) => {
      const index = captureConfigChangeIndex(change?.kind);
      if (index === undefined) return reject(new SimTransitionError(null, 'setCaptureConfig', undefined, SimErrorCode.INVALID_INPUT));
      const operationId = operationOf('setCaptureConfig', index);
      if (change.kind === 'CAMERA_SOURCE') {
        return call(operationId, { params: { id: change.deviceId }, body: { trackId: change.trackId } }, { kind: 'device', id: change.deviceId });
      }
      if (change.kind === 'PRIMARY_MIC') return call(operationId, { params: { id: change.inputId } }, { kind: 'device', id: change.inputId });
      return call(operationId, {
        body: { ...(change.cameras === undefined ? {} : { cameras: change.cameras }), ...(change.mics === undefined ? {} : { mics: change.mics }) },
      });
    },
    result: nothing,
    invalidInputCode: SimErrorCode.INVALID_INPUT,
  },
  switchAudioSource: {
    flow: LiveActionFlow.COMMAND,
    plan: ([inputId], view) => onSession('switchAudioSource', { inputId })([], view),
    result: nothing,
  },
  registerCaptureDevice: {
    flow: LiveActionFlow.LOCAL,
    // R-9 (C3 §2.6): no client registers a capture device. The Core does it inside operation 96
    // (`adoptCaptureCandidate`), which a client calls as a request; the device then arrives in the
    // replicated `captureDevices` slice.
    plan: () => resolve(undefined),
    result: nothing,
  },
};

/** The names of the 47 bindings, in the order of `SimActions`. */
export const LIVE_BINDING_NAMES = Object.keys(LIVE_BINDINGS) as readonly SimActionName[];

/** The actions whose simulator signature returns a value: the other ones return nothing. */
type ValueActionName = { [Name in keyof SimActions]: ReturnType<SimActions[Name]> extends void ? never : Name }[keyof SimActions];

/** Held to `SimActions` at compile time in both directions: a name too few or too many does not compile. */
const VALUE_ACTIONS = {
  signIn: true,
  signInWithBiometric: true,
  recordBiometricFailure: true,
  signInWithSecurityKey: true,
  createSession: true,
  scanCaseNumber: true,
  verify: true,
  exportEvidence: true,
  exportAudit: true,
  exportLogs: true,
  verifyAuditChain: true,
  runDiagnostics: true,
  restartServices: true,
  pair: true,
} as const satisfies Record<ValueActionName, true>;

/**
 * The names of the actions that return a value in the simulator. A call site that still reads
 * such an action's Live result as that value is what the misuse report of the Live source looks
 * for (`./live-sim`, "Misuse").
 */
export const LIVE_VALUE_ACTION_NAMES = Object.keys(VALUE_ACTIONS) as readonly SimActionName[];

/**
 * The member every result union of the simulator carries (`SignInResult`, `CreateSessionResult`,
 * `ExportResult`, `PairResult`, the chain check). A read of it on a Live result is a certain
 * misuse: a promise-shaped result has no such member.
 */
export const LIVE_RESULT_DISCRIMINANT = 'ok';
