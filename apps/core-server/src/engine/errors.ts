/**
 * Errors of the engine host (plan row W26), and the one table that turns a refusal of a hosted
 * simulator action into the answer of the API (spec §7.2, ENG-7).
 *
 * Three kinds reach a caller of the host:
 *
 *   `ApiFailure` with `details.simCode`   the hosted action REFUSED (a thrown `Sim*Error`). Nothing
 *                                         changed. Status and code are the table below.
 *   `PipelineFailure` (503 `NOT_READY`)   the server could not run or commit the unit. Nothing is
 *                                         stored, and the engine's state was set back (ENG-5).
 *   `EngineError`                         the host itself: it is not started, a start could not
 *                                         read or accept the stored state, or the calling code
 *                                         named an action that is not hosted. Not an `ApiFailure`
 *                                         except `ENGINE_NOT_READY`, which the host throws as the
 *                                         envelope's 503.
 *
 * A message of this file is a fixed text. It never quotes a state, a row or an input (SR-48).
 */
import { SimErrorCode, SimPermissionError, SimTransitionError, simErrorCode } from '@dems/shared/sim';
import { ApiFailure, notReady, type ErrorDetails } from '../plugins/error-envelope';

export const EngineErrorCode = {
  /** `start()` while the host is started or starting. */
  ALREADY_STARTED: 'ENGINE_ALREADY_STARTED',
  /** The stored rows do not form a state (no state row, a head that disagrees, another shape version). */
  STATE_UNREADABLE: 'ENGINE_STATE_UNREADABLE',
  /** The stored state was read and then REJECTED by the slice schemas or by the simulator's own test. */
  SNAPSHOT_REJECTED: 'ENGINE_SNAPSHOT_REJECTED',
  /** The action is not one of the hosted actions (spec §7.17). */
  ACTION_NOT_HOSTED: 'ENGINE_ACTION_NOT_HOSTED',
  /** The timer was changed while the scheduler runs. */
  TIMER_IN_USE: 'ENGINE_TIMER_IN_USE',
  /** The clock behind the seam `clock` is behind the stored state and has no floor to raise (decision D110). */
  CLOCK_WITHOUT_FLOOR: 'ENGINE_CLOCK_WITHOUT_FLOOR',
} as const;
export type EngineErrorCode = (typeof EngineErrorCode)[keyof typeof EngineErrorCode];

/** A failure of the engine host. `detail` holds names and counts only (a slice name, a rule). */
export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly detail: Readonly<Record<string, string | number | boolean | null>>;

  constructor(code: EngineErrorCode, message: string, detail: Readonly<Record<string, string | number | boolean | null>> = {}, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'EngineError';
    this.code = code;
    this.detail = detail;
  }
}

/** 503 `NOT_READY`: the engine is not started, is stopping, or is reloading its state. */
export function engineNotReady(): ApiFailure {
  return notReady();
}

/** 401 `NOT_SIGNED_IN`: a hosted action needs an operator. The permission guard refuses first; this is the backstop. */
export function operatorRequired(): ApiFailure {
  return new ApiFailure(401, 'NOT_SIGNED_IN', 'Sign in to continue.');
}

interface RefusalRule {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

/**
 * How a thrown simulator error becomes an answer (spec §7.2, the table "How a thrown simulator
 * error becomes an answer"). `details.simCode` always names the simulator's own code, so the Live
 * source can rebuild the simulator's error class. `NOT_IMPLEMENTED` has no line: no action throws
 * it, and anything without a line is an unexpected failure (500 `INTERNAL_ERROR`).
 */
export const SIM_REFUSAL_RULES = {
  [SimErrorCode.NOT_SIGNED_IN]: { status: 401, code: 'NOT_SIGNED_IN', message: 'Sign in to continue.' },
  [SimErrorCode.NOT_PERMITTED]: { status: 403, code: 'NOT_PERMITTED', message: 'Your role does not allow this action.' },
  [SimErrorCode.NOT_FOUND]: { status: 404, code: 'NOT_FOUND', message: 'The requested item was not found.' },
  [SimErrorCode.ILLEGAL_STATE]: { status: 409, code: 'INVALID_STATE', message: 'The action is not allowed in the current state.' },
  [SimErrorCode.NO_WARNINGS]: { status: 409, code: 'INVALID_STATE', message: 'The pre-check has no warning to acknowledge.' },
  [SimErrorCode.CHECKS_RUNNING]: { status: 409, code: 'PRECHECK_RUNNING', message: 'Pre-recording checks are still running.' },
  [SimErrorCode.SESSION_ACTIVE]: { status: 409, code: 'SESSION_ACTIVE', message: 'A session is active.' },
  [SimErrorCode.RECORDING_ACTIVE]: { status: 409, code: 'RECORDING_ACTIVE', message: 'A recording is running.' },
  [SimErrorCode.COMMAND_UNSUPPORTED]: { status: 409, code: 'COMMAND_UNSUPPORTED', message: 'The device does not support this command.' },
  [SimErrorCode.UNSEALED_EVIDENCE]: { status: 409, code: 'NOT_SEALED', message: 'The evidence item is not sealed.' },
  [SimErrorCode.REASON_TOO_SHORT]: { status: 422, code: 'INVALID_REASON', message: 'A reason of at least 5 characters is required.' },
  [SimErrorCode.NOTE_INVALID]: { status: 422, code: 'INVALID_INPUT', message: 'The request does not match the expected input.' },
  [SimErrorCode.POLICY_RANGE]: { status: 422, code: 'INVALID_INPUT', message: 'The request does not match the expected input.' },
  [SimErrorCode.INVALID_INPUT]: { status: 422, code: 'INVALID_INPUT', message: 'The request does not match the expected input.' },
} as const satisfies Partial<Record<SimErrorCode, RefusalRule>>;

type RefusedSimCode = keyof typeof SIM_REFUSAL_RULES;

function isRefusedSimCode(code: SimErrorCode): code is RefusedSimCode {
  return Object.hasOwn(SIM_REFUSAL_RULES, code);
}

/**
 * The answer for what a hosted action threw, or null when it is not a refusal of the simulator
 * (an unexpected failure: the caller lets it propagate and the request answers 500).
 *
 * `details` carries `simCode` and, as spec §7.2 lists them, `permission` of a permission refusal
 * and `from` and `event` of a refused transition: names of the vocabulary, never a part of the
 * input. `message`, when given, replaces the general text (a module knows its own wording).
 */
export function simRefusal(error: unknown, message?: string): ApiFailure | null {
  const simCode = simErrorCode(error);
  if (simCode === null || !isRefusedSimCode(simCode)) return null;
  const rule = SIM_REFUSAL_RULES[simCode];
  const details: Record<string, string | number | boolean | null> = { simCode };
  if (error instanceof SimPermissionError && simCode === SimErrorCode.NOT_PERMITTED) details['permission'] = error.permission;
  if (error instanceof SimTransitionError) {
    details['from'] = error.from;
    details['event'] = error.event;
  }
  return new ApiFailure(rule.status, rule.code, message ?? rule.message, { details: details as ErrorDetails, cause: error });
}

/** The simulator code of a refusal the host threw (`details.simCode`), or null. */
export function simCodeOf(error: unknown): string | null {
  if (!(error instanceof ApiFailure)) return null;
  const code = error.details?.['simCode'];
  return typeof code === 'string' ? code : null;
}
