/**
 * Operation 9 `reportBiometricFailure`: a device says that its operating system's biometric
 * check failed (plan row W41; spec §5.6 step 7, §7.5 with its note; SR-37, SR-65, SR-71, SR-72;
 * review SD-11).
 *
 * WHAT IT CAN DO: add one failure toward the lockout of THE DEVICE THAT REPORTS, and write one
 * row. It issues nothing and it reads no token: no path of this file reaches a session.
 *
 * WHAT IT CANNOT DO.
 *   - Name an operator of its choosing. `operatorId` is what the app believes; the server does
 *     not take it as an actor (SR-65). The row names that operator ONLY where the operator is
 *     enabled and has an enrolment on the reporting device (a biometric token of the pair that
 *     was not revoked). Otherwise the actor is null and the row carries the device ID only: a
 *     report never names an operator who was disabled (security checkpoint CPS1-8).
 *   - Learn whether an operator exists, or is enrolled. The answer is the device's own lock
 *     state and holds nothing else; it is the same for a known, an unknown and no operator, and
 *     the same statement runs for all three.
 *   - Lock another console. The lockout key is the device the credential of the request
 *     resolved to at stage 4, never a request field: a device locks itself, and nothing else.
 *
 * ONE UNIT OF WORK, `identity.biometric.failure`:
 *
 *   1  `lockout.take`     one attempt of the device's counter; while the device is locked nothing
 *                         is counted
 *   2  `lockout.fail`     a taken attempt is a failure at once: there is nothing to verify
 *   3  FIND_ENROLMENT     may the row name the operator?
 *   4  the row            `AUTH_FAILED`, or `AUTH_LOCKED` while the device is locked, after its
 *                         place in the denial budget was taken
 *
 * The answer is 200 with the lock state after the count, also while the device is locked: the
 * contract documents no 423 for this operation. With no place left in the denial budget the
 * failure stays counted, no row is written, and the answer is the budget's 429.
 */
import type { SignInStatus } from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { appendActivity, type Activity } from '../activity';
import type { ConsoleLockout } from '../lockout';
import { failureReported, lockedOut } from './activity';
import { hasEnrolment } from './store';

/** The label of the unit. It appears in the pipeline's log lines. */
export const FAILURE_UNIT_LABEL = 'identity.biometric.failure';

/** An operator ID that no row has: the same statement runs when the report names nobody. */
const NO_OPERATOR = '';

/** What the unit decided. `limited` is the 429 of the denial budget when the row found no place left. */
interface ReportOutcome {
  readonly status: SignInStatus;
  readonly limited: unknown;
}

export async function reportBiometricFailure(
  app: FastifyInstance,
  lockout: ConsoleLockout,
  request: FastifyRequest,
  deviceId: string,
  believedOperatorId: string | null,
): Promise<SignInStatus> {
  /** One place in the denial budget for one refusal row. Null: taken. Otherwise the 429 to answer after the unit. */
  const placeInBudget = async (): Promise<unknown> => {
    try {
      await app.denialBudget.consume(request);
      return null;
    } catch (refused) {
      return refused;
    }
  };

  const outcome = await app.pipeline.run(FAILURE_UNIT_LABEL, async (unit): Promise<ReportOutcome> => {
    const now = app.clock.now();

    // 1 and 2. Counted against the device that reports, and against nothing else.
    const attempt = await lockout.take(deviceId, now);
    let rowFor: (operatorId: string | null) => Activity;
    if (attempt.kind === 'LOCKED') {
      rowFor = (operatorId) => lockedOut({ operatorId, deviceId, lockedUntil: attempt.lockedUntil, retryInMs: attempt.retryInMs });
    } else {
      const failure = await lockout.fail(deviceId, attempt, now);
      rowFor = (operatorId) => failureReported({ operatorId, deviceId, attemptsRemaining: failure.attemptsRemaining, lockedUntil: failure.lockedUntil });
    }

    // 3. SR-37: the operator is named only where an enrolment of this device exists and the operator is enabled.
    const enrolled = await hasEnrolment(unit, deviceId, believedOperatorId ?? NO_OPERATOR);

    // 4. The place in the denial budget, then the row.
    const limited = await placeInBudget();
    if (limited === null) await appendActivity(unit, rowFor(enrolled ? believedOperatorId : null));
    return { status: { ...(await lockout.status(deviceId, now)), serverTime: now }, limited };
  });

  // The unit has committed what it counted. No place in the denial budget: 429, and no row.
  if (outcome.limited !== null) throw outcome.limited;
  return outcome.status;
}
