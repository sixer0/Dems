/**
 * Error rebuilding (HB-14; backend task 04_client_integration_spec §2.5 CL-20, CL-21; 01_specs
 * §7.2: how a thrown simulator error becomes an answer, read backwards).
 *
 * A Live action that the Core refuses rejects with the simulator's OWN class, so an existing
 * `instanceof SimPermissionError` branch needs no change. The class is rebuilt from the typed
 * client's failure. The first matching row decides:
 *
 * | # | Failure | Error | Members |
 * |--:|---------|-------|---------|
 * | 1 | No usable answer: no answer, a time-out, 503, 429, 500, an answer outside the contract (`failure.transport` is set) | `LiveTransportError` | `reason` = `failure.transport`; `status`, `code`, `retryAfterSeconds`, `requestId` as the client gave them. **Never rebuilt into a simulator class** |
 * | 2 | 401 `NOT_SIGNED_IN` | `SimPermissionError` | `code: NOT_SIGNED_IN`; `permission` = `details.permission`, else the permission of the operation's access rule (`A | B` for an any-of, as the simulator writes it) |
 * | 3 | 403 `NOT_PERMITTED` or `FORBIDDEN` | `SimPermissionError` | `code: NOT_PERMITTED`; `permission` as in row 2 |
 * | 4 | 404, and the request named an entity | `SimNotFoundError` | `entity` and `entityId` are what the binding sent |
 * | 5 | 409 or 422 that stands for a simulator code | `SimTransitionError` | `code` = `details.simCode`; else, for a 422, the code the action gives its invalid input; else the envelope code read backwards (`ENVELOPE_SIM_CODE`). `from` = `details.from` when the envelope has that member, else the replica's session state. `event` = `details.event`, else the action's name |
 * | 6 | Any other refusal (`DEMO_DISABLED`, `LAST_ADMIN`, `DEVICE_NOT_PAIRED`, `DEVICE_REVOKED`, `ORIGIN_NOT_ALLOWED`, `LOCKED`, `INVALID_CODE`, `INVALID_JSON`, ...) | `CoreRefusalError` | The envelope `code`, `status`, `requestId` |
 *
 * An action whose simulator signature returns a result union does not come here for the refusals
 * of that union (CL-19): its binding maps them and the action resolves.
 *
 * **What an error carries.** Nothing of the envelope's `message` and no request body goes into an
 * error: the classes write their own fixed text, and a UI picks its copy from `code`. Three members
 * of `details` do travel (`from`, `event`, `permission`: state names and permission names), and a
 * `SimNotFoundError` names the entity ID the caller passed, in its message too. So a report of a
 * rejected action can hold an entity ID. It cannot hold a credential: the typed client refuses a
 * credential in a path parameter, and nothing else of the request reaches this file.
 *
 * **Envelope codes are the contract's.** Every code this file compares with or keys a table by is
 * a member of `ApiErrorCode` (`../../api/core-api`), so a code that is renamed there does not
 * compile here.
 *
 * Pure. It reads the operation registry for the access rule; it calls nothing.
 */
import { ApiErrorCode, coreApiAccessPermissions, findCoreApiOperation, permissionsOfDenialLabel } from '../../api/core-api';
import type { CoreCallFailure } from '../../client/core-client';
import { SimErrorCode, SimNotFoundError, SimPermissionError, SimTransitionError } from '../../sim/errors';
import { CoreRefusalError, LiveTransportError } from '../errors';

type FailureDetails = NonNullable<CoreCallFailure['error']['details']>;

const SIM_ERROR_CODES: readonly string[] = Object.values(SimErrorCode);

function isSimErrorCode(value: unknown): value is SimErrorCode {
  return typeof value === 'string' && SIM_ERROR_CODES.includes(value);
}

/**
 * The envelope codes of 409 and 422 that stand for a simulator code, read backwards from the
 * table of 01_specs §7.2. `PRECHECK_WARNINGS` and `PRECHECK_BLOCKED` are answers of the composite
 * start (operation 25) to a session that is not ARMED: the simulator's `startRecording` refuses
 * that state as an illegal transition.
 */
export const ENVELOPE_SIM_CODE: Readonly<Partial<Record<ApiErrorCode, SimErrorCode>>> = {
  [ApiErrorCode.INVALID_STATE]: SimErrorCode.ILLEGAL_STATE,
  [ApiErrorCode.PRECHECK_RUNNING]: SimErrorCode.CHECKS_RUNNING,
  [ApiErrorCode.PRECHECK_WARNINGS]: SimErrorCode.ILLEGAL_STATE,
  [ApiErrorCode.PRECHECK_BLOCKED]: SimErrorCode.ILLEGAL_STATE,
  [ApiErrorCode.NOT_SEALED]: SimErrorCode.UNSEALED_EVIDENCE,
  [ApiErrorCode.INVALID_REASON]: SimErrorCode.REASON_TOO_SHORT,
  [ApiErrorCode.SESSION_ACTIVE]: SimErrorCode.SESSION_ACTIVE,
  [ApiErrorCode.RECORDING_ACTIVE]: SimErrorCode.RECORDING_ACTIVE,
  [ApiErrorCode.COMMAND_UNSUPPORTED]: SimErrorCode.COMMAND_UNSUPPORTED,
  [ApiErrorCode.INVALID_INPUT]: SimErrorCode.INVALID_INPUT,
};

/** The simulator code an envelope code stands for. Own keys of the table only: a code that happens to name an inherited member stands for nothing. */
export function envelopeSimCodeOf(code: string): SimErrorCode | undefined {
  return Object.prototype.hasOwnProperty.call(ENVELOPE_SIM_CODE, code) ? ENVELOPE_SIM_CODE[code as ApiErrorCode] : undefined;
}

/** True when `failure` is the refusal `status` with the contract's envelope code `code`. */
export function isRefusal(failure: CoreCallFailure, status: number, code: ApiErrorCode): boolean {
  return failure.status === status && failure.error.code === code;
}

export function detailsOf(failure: CoreCallFailure): FailureDetails {
  return failure.error.details ?? {};
}

/** A member of `error.details` as text, or null when it is absent or not text. */
export function detailText(failure: CoreCallFailure, name: string): string | null {
  const value = detailsOf(failure)[name];
  return typeof value === 'string' && value !== '' ? value : null;
}

/** A member of `error.details` as a finite number, or null. */
export function detailNumber(failure: CoreCallFailure, name: string): number | null {
  const value = detailsOf(failure)[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The permission label of an operation's access rule, as the simulator writes it: `A`, `A | B`, or empty. */
export function permissionLabelOf(operationId: string): string {
  const operation = findCoreApiOperation(operationId);
  return operation ? coreApiAccessPermissions(operation.access).join(' | ') : '';
}

/** Row 1 of the table: the transport error of a failure, or null when the failure is a refusal. */
export function transportErrorOf(failure: CoreCallFailure): LiveTransportError | null {
  if (failure.transport === null) return null;
  return new LiveTransportError(failure.transport, {
    status: failure.status,
    code: failure.error.code,
    retryAfterSeconds: failure.retryAfterSeconds,
    requestId: failure.requestId,
    // Closing pass J: the Core's reason code of a 503 travels with it (a refused start is not "starting").
    detailReason: detailText(failure, 'reason'),
  });
}

export interface RefusalContext {
  /** The action's name: `action` of a permission error, `event` of a transition error. */
  readonly action: string;
  /** The operation that was called: its access rule names the permission when the envelope does not. */
  readonly operationId: string;
  /** What the request named, for a 404; null when the action names no entity. */
  readonly entity: { readonly kind: string; readonly id: string } | null;
  /** The replica's session state when the answer arrived: `from` when the envelope names none. */
  readonly sessionState: string | null;
  /** The simulator code a 422 without `details.simCode` stands for on this action. */
  readonly invalidInputCode?: SimErrorCode;
}

/** The error a void Live action rejects with for `failure` (the table above). */
export function rebuildRefusal(failure: CoreCallFailure, context: RefusalContext): Error {
  const transport = transportErrorOf(failure);
  if (transport) return transport;

  const { status } = failure;
  const { code } = failure.error;
  // One label for both clients (W83, ruling R-D1; finding F64): the any-of in any spelling becomes `A | B`.
  const permission = (): string => permissionsOfDenialLabel(detailText(failure, 'permission') ?? permissionLabelOf(context.operationId)).join(' | ');

  if (isRefusal(failure, 401, ApiErrorCode.NOT_SIGNED_IN)) {
    return new SimPermissionError(context.action, permission(), SimErrorCode.NOT_SIGNED_IN);
  }
  if (isRefusal(failure, 403, ApiErrorCode.NOT_PERMITTED) || isRefusal(failure, 403, ApiErrorCode.FORBIDDEN)) {
    return new SimPermissionError(context.action, permission(), SimErrorCode.NOT_PERMITTED);
  }
  if (status === 404 && context.entity !== null) {
    return new SimNotFoundError(context.entity.kind, context.entity.id);
  }
  if (status === 409 || status === 422) {
    const named = detailsOf(failure).simCode;
    const simCode = isSimErrorCode(named)
      ? named
      : status === 422 && context.invalidInputCode !== undefined
        ? context.invalidInputCode
        : envelopeSimCodeOf(code);
    if (simCode !== undefined) {
      const details = detailsOf(failure);
      const from = Object.prototype.hasOwnProperty.call(details, 'from')
        ? typeof details.from === 'string'
          ? details.from
          : null
        : context.sessionState;
      // Pass D6 (D156): the Core's `details.reason` travels on the rebuilt error (a code, never a value of the request).
      return new SimTransitionError(from, detailText(failure, 'event') ?? context.action, undefined, simCode, detailText(failure, 'reason'));
    }
  }
  return new CoreRefusalError(code, { status, requestId: failure.requestId });
}
