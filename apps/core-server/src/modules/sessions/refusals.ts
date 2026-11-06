/**
 * The refusals the sessions module answers itself (plan row W34; spec §7.2, §7.3, §7.8).
 *
 * A refusal of a hosted action that the simulator THROWS is not here: the engine host maps it
 * (`simRefusal`) and the handler lets it propagate. What is left for the module:
 *
 *   404 `NOT_FOUND`           the `{id}` of the path is not the open session. No action of the
 *                             simulator takes a session ID, so none can refuse a wrong one; its
 *                             REST layer makes this check, and so does this module, INSIDE the
 *                             unit that runs the action;
 *   409 `PRECHECK_RUNNING`,   the composite start (operation 25) on a session whose pre-check has
 *       `PRECHECK_WARNINGS`,  not ended, ended with a warning that was not acknowledged, or ended
 *       `PRECHECK_BLOCKED`    with a block: the three answers of the simulator's REST layer;
 *   the refusals `createSession` reports IN ITS RESULT: 409 `SESSION_ACTIVE`, 422
 *                             `INVALID_INPUT`, and the two a race with a role change can produce.
 *
 * `422 INVALID_REASON` of a stop is NOT here: a reason that is absent or too short is refused
 * by the hosted action itself, after the session and its state were looked at (decision D94;
 * `text-body.ts`), and that refusal is the engine host's to map like any other.
 *
 * Status and code of every answer are read from the engine's table `SIM_REFUSAL_RULES` (spec
 * §7.2), by the simulator code the answer stands for; `details.simCode` names that code, so the
 * Live source rebuilds the simulator's own error class. A text of this file quotes no input.
 */
import { ApiErrorCode } from '@dems/shared/api';
import { SessionState } from '@dems/shared/domain';
import { SimErrorCode, type CreateSessionResult, type PrecheckItem } from '@dems/shared/sim';
import { SIM_REFUSAL_RULES } from '../../engine';
import { ApiFailure, type ErrorDetails } from '../../plugins/error-envelope';

type RefusedSimCode = keyof typeof SIM_REFUSAL_RULES;

/** The answer spec §7.2 gives a simulator code, with `details.simCode` and the details given. */
function refusal(simCode: RefusedSimCode, options: { message?: string; code?: ApiErrorCode; details?: ErrorDetails } = {}): ApiFailure {
  const rule = SIM_REFUSAL_RULES[simCode];
  return new ApiFailure(rule.status, options.code ?? rule.code, options.message ?? rule.message, { details: { simCode, ...options.details } });
}

/** 404: the session named in the path is not the open session (spec §7.8). */
export function notOpenSession(): ApiFailure {
  return refusal(SimErrorCode.NOT_FOUND, { message: 'This session is not the open session.' });
}

// ── The composite start (operation 25; `sim/api.ts` "POST /api/v1/session/{id}/start") ─────────

/** What the simulator's `startRecording` would say of a session in PRECHECK: the transition it refuses. */
const START_FROM_PRECHECK = { from: SessionState.PRECHECK, event: 'startRecording' } as const;

/** 409: the twelve checks have not all ended. */
export function precheckRunning(): ApiFailure {
  return refusal(SimErrorCode.CHECKS_RUNNING, { details: START_FROM_PRECHECK });
}

/** 409: the pre-check ended with a warning; the start needs `acknowledgeWarnings: true`. */
export function precheckWarnings(): ApiFailure {
  return refusal(SimErrorCode.ILLEGAL_STATE, {
    code: ApiErrorCode.PRECHECK_WARNINGS,
    message: 'Acknowledge the warnings: send {"acknowledgeWarnings": true}.',
    details: START_FROM_PRECHECK,
  });
}

/**
 * 409: the pre-check ended with a block. The text names the blocking checks in the simulator's
 * own words (`Core link offline`, `Evidence storage full`, ...): they are members of the
 * `session` slice, which every operator reads, and no part of the request.
 */
export function precheckBlocked(items: readonly PrecheckItem[]): ApiFailure {
  const reasons = items.filter((item) => item.status === 'BLOCK').map((item) => item.reason ?? item.id);
  return refusal(SimErrorCode.ILLEGAL_STATE, {
    code: ApiErrorCode.PRECHECK_BLOCKED,
    message: `Start blocked: ${reasons.join('; ')}`,
    details: START_FROM_PRECHECK,
  });
}

// ── What `createSession` reports in its result (operation 24; AC-B-49) ─────────────────────────

/**
 * The answer for a create the simulator refused IN ITS RESULT. The unit has committed by then
 * (it changed nothing), so this is thrown after it, never inside it.
 *
 * `SESSION_ACTIVE` carries the ID of the open session as `details.sessionId`: it is a member of
 * the simulator's result, the Live source reads it from there, and the loser of two simultaneous
 * creates has no other way to learn it before the state change arrives.
 */
export function createRefusal(result: Extract<CreateSessionResult, { ok: false }>): ApiFailure {
  if (result.reason === SimErrorCode.SESSION_ACTIVE && result.sessionId !== null) {
    return refusal(SimErrorCode.SESSION_ACTIVE, { details: { sessionId: result.sessionId } });
  }
  return refusal(result.reason);
}
