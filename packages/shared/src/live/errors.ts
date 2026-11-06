/**
 * Errors of a Live action (HB-15; backend task 04_client_integration_spec §2.5 CL-20, CL-21;
 * research/03_analysis.md ADQ-3 rule 1: "same error classes").
 *
 * A Live action that the Core refuses rejects with the SIMULATOR'S OWN class, rebuilt from the
 * error envelope (CL-20). So an existing `instanceof SimPermissionError`, `SimTransitionError`
 * or `SimNotFoundError` branch needs no change. The three classes are re-exported below
 * unchanged: there is one class object, whichever module a file takes it from.
 *
 * Two classes are new, for answers the simulator never gives (CL-21):
 * - `LiveTransportError`: the Core server gave no usable answer.
 * - `CoreRefusalError`: the Core refused with a code that no simulator class and no result
 *   union carries.
 * Neither extends a simulator class, so neither is caught by an existing branch by mistake.
 *
 * Plain `Error` subclasses, erasable syntax only, as `../sim/errors`. A UI picks its text from
 * `reason`, `code` and `status`; `message` is English for a log line and never holds a secret.
 */
export { SimNotFoundError, SimPermissionError, SimTransitionError } from '../sim/errors';

/** Why the Core server gave no usable answer: the two reasons the mobile sign-in contract already has. */
export const LiveTransportReason = {
  /** No answer, a time-out, 503 `NOT_READY`, or the Live link is not ONLINE (CL-22). */
  CORE_OFFLINE: 'CORE_OFFLINE',
  /** 429, 500, or an answer outside the contract (`CONTRACT_VIOLATION`). */
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type LiveTransportReason = (typeof LiveTransportReason)[keyof typeof LiveTransportReason];

/** What the Live source knows about the answer behind an error. Every member may be left out. */
export interface LiveErrorDetails {
  /** HTTP status of the answer; `null` when there was none. */
  status?: number | null;
  /** The request ID of the answer, for the caller's log line. Never shown to the user. */
  requestId?: string | null;
}

export interface LiveTransportDetails extends LiveErrorDetails {
  /**
   * What stood behind the reason: the envelope code of the answer (`RATE_LIMITED`, `NOT_READY`,
   * `CONTRACT_VIOLATION`), or the client's own word when there was no answer (`TIMEOUT`,
   * `NETWORK`). It lets a time-out be worded apart from a command that was never sent (LB-7).
   */
  code?: string | null;
  /** `retry-after` in whole seconds, kept so that a 429 reads as a limit and not as an outage (LB-10). */
  retryAfterSeconds?: number | null;
  /**
   * `error.details.reason` of the answer, when it is a code (closing pass J): a `503 NOT_READY` of
   * `startSession` names why the start was refused (`START_REFUSED_REASONS` of `@dems/shared/sim`,
   * read by `startRefusedReasonOf`), and that is not "the Core server is starting".
   */
  detailReason?: string | null;
}

/** The Core server gave no usable answer; the command may not have been applied (CL-21, CL-22). */
export class LiveTransportError extends Error {
  readonly reason: LiveTransportReason;
  readonly status: number | null;
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;
  readonly requestId: string | null;
  /** `details.reason` of the answer, or null (see `LiveTransportDetails.detailReason`). */
  readonly detailReason: string | null;

  constructor(reason: LiveTransportReason, details: LiveTransportDetails = {}) {
    super(
      reason === LiveTransportReason.CORE_OFFLINE
        ? 'The Core server is unreachable (CORE_OFFLINE).'
        : 'The Core server could not answer the request (UNAVAILABLE).',
    );
    this.name = 'LiveTransportError';
    this.reason = reason;
    this.status = details.status ?? null;
    this.code = details.code ?? null;
    this.retryAfterSeconds = details.retryAfterSeconds ?? null;
    this.requestId = details.requestId ?? null;
    this.detailReason = typeof details.detailReason === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(details.detailReason) ? details.detailReason : null;
  }
}

/**
 * The Core refused, and the refusal has no simulator class and no result union: the envelope
 * codes `DEMO_DISABLED`, `LAST_ADMIN`, `DEVICE_NOT_PAIRED`, `ORIGIN_NOT_ALLOWED`, `LOCKED`,
 * `INVALID_CODE`, and the client's own `NOT_AVAILABLE` for an action without an operation.
 */
export class CoreRefusalError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(code: string, details: LiveErrorDetails = {}) {
    super(`The Core refused the action (${code}).`);
    this.name = 'CoreRefusalError';
    this.code = code;
    this.status = details.status ?? null;
    this.requestId = details.requestId ?? null;
  }
}
