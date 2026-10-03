/**
 * Simulator errors. Plain `Error` subclasses (no parameter properties: erasable syntax only).
 *
 * Every error carries a machine-readable `code` (step 54, review 40 m8), so a UI picks an i18n
 * key from the code and never shows the English `message`. The constructors keep their step-31
 * signatures; the code is an optional trailing argument with a sensible default.
 */

/** Machine-readable reasons a simulator action refused or failed. */
export const SimErrorCode = {
  /** The session machine does not allow this action in the current state (AC-52). */
  ILLEGAL_STATE: 'ILLEGAL_STATE',
  /** A stop reason (or export reason) shorter than 5 characters (S21). */
  REASON_TOO_SHORT: 'REASON_TOO_SHORT',
  /** A note outside 1-2000 characters. */
  NOTE_INVALID: 'NOTE_INVALID',
  /** The precheck gate is still resolving. */
  CHECKS_RUNNING: 'CHECKS_RUNNING',
  /** The precheck gate has no WARN outcome to acknowledge. */
  NO_WARNINGS: 'NO_WARNINGS',
  /** A session is active (software update, services restart). */
  SESSION_ACTIVE: 'SESSION_ACTIVE',
  /** A device restart while a recording runs (D79). */
  RECORDING_ACTIVE: 'RECORDING_ACTIVE',
  /** A retention policy or day count outside the allowed range. */
  POLICY_RANGE: 'POLICY_RANGE',
  /** An unsealed (RECORDED) evidence item cannot be archived. */
  UNSEALED_EVIDENCE: 'UNSEALED_EVIDENCE',
  /** The device does not accept this command. */
  COMMAND_UNSUPPORTED: 'COMMAND_UNSUPPORTED',
  /** An evidence item, device or alert the store does not hold. */
  NOT_FOUND: 'NOT_FOUND',
  /** No operator is signed in. */
  NOT_SIGNED_IN: 'NOT_SIGNED_IN',
  /** The signed-in role lacks the permission. */
  NOT_PERMITTED: 'NOT_PERMITTED',
  /** Session input the shared schema rejects (D62). */
  INVALID_INPUT: 'INVALID_INPUT',
  /** Deprecated: no action throws it any more. */
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;
export type SimErrorCode = (typeof SimErrorCode)[keyof typeof SimErrorCode];

/**
 * @deprecated No simulator action throws this since step 32 (every action is implemented,
 * S32-18). Kept exported for backwards compatibility.
 */
export class SimNotImplementedError extends Error {
  readonly action: string;
  readonly owner: string;
  readonly code: SimErrorCode = SimErrorCode.NOT_IMPLEMENTED;

  constructor(action: string, owner = 'step 32') {
    super(`Simulator action "${action}" is not implemented yet (owner: ${owner}).`);
    this.name = 'SimNotImplementedError';
    this.action = action;
    this.owner = owner;
  }
}

/** An illegal session-machine transition (AC-52: disallowed transitions throw), or a refused action. */
export class SimTransitionError extends Error {
  readonly from: string | null;
  readonly event: string;
  readonly code: SimErrorCode;

  constructor(from: string | null, event: string, detail?: string, code: SimErrorCode = SimErrorCode.ILLEGAL_STATE) {
    super(
      `Illegal session transition: ${event} from ${from ?? 'IDLE'}${detail ? ` (${detail})` : ''}.`,
    );
    this.name = 'SimTransitionError';
    this.from = from;
    this.event = event;
    this.code = code;
  }
}

/** An action named an evidence item, alert or device the store does not hold (step 32). */
export class SimNotFoundError extends Error {
  readonly entity: string;
  readonly entityId: string;
  readonly code: SimErrorCode = SimErrorCode.NOT_FOUND;

  constructor(entity: string, entityId: string) {
    super(`Simulator ${entity} "${entityId}" not found.`);
    this.name = 'SimNotFoundError';
    this.entity = entity;
    this.entityId = entityId;
  }
}

/**
 * No operator is signed in, or the signed-in role lacks the permission for a void action
 * (steps 32 and 54). Actions with a result type (createSession, exportEvidence, exportAudit)
 * report this in the result instead; this error is for UI paths that should have been disabled
 * (S20). `code` is NOT_SIGNED_IN or NOT_PERMITTED.
 */
export class SimPermissionError extends Error {
  readonly action: string;
  readonly permission: string;
  readonly code: SimErrorCode;

  constructor(action: string, permission: string, code: SimErrorCode = SimErrorCode.NOT_PERMITTED) {
    super(
      code === SimErrorCode.NOT_SIGNED_IN
        ? `Simulator action "${action}" needs a signed-in operator.`
        : `Simulator action "${action}" needs permission ${permission}.`,
    );
    this.name = 'SimPermissionError';
    this.action = action;
    this.permission = permission;
    this.code = code;
  }
}

/** The machine-readable code of a simulator error, or null for any other value. */
export function simErrorCode(error: unknown): SimErrorCode | null {
  if (
    error instanceof SimTransitionError ||
    error instanceof SimNotFoundError ||
    error instanceof SimPermissionError ||
    error instanceof SimNotImplementedError
  ) {
    return error.code;
  }
  return null;
}

/** Normalises an unknown thrown value into message and stack. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return error.stack ? { message: error.message, stack: error.stack } : { message: error.message };
  }
  return { message: typeof error === 'string' ? error : 'Unknown error' };
}
