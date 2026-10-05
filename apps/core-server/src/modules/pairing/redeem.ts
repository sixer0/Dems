/**
 * The redeem of a pairing code (plan row W32; spec §6.1 PR-P4 to PR-P6, §6.2 T2 and T5, §6.3 T6,
 * §6.4 step 3, §7.3 line 9, §8.2 ENG-23 to ENG-25; SR-26 to SR-31, SR-71, SR-72; database
 * contract §5.2, §5.6 AT-1 to AT-5, AT-C2, AT-C3; decision D16, review SD-03 and SD-04).
 *
 * A REDEEM IS ONE UNIT OF WORK of the serial pipeline, one PostgreSQL transaction:
 *
 *   1  `lock.take`                ONE ATTEMPT IS TAKEN from the redeem lock (3 in 300 s, then
 *                                 60 s), before anything is read. Redeeming locked: nothing is
 *                                 compared; `PAIRING_LOCKED`; 423.
 *   2  EXPIRE_ACTIVE_CODE         a code past its 300 s is closed first, with its row.
 *   3  CONSUME_REDEEM_ATTEMPT     THE CONSUMING COMPARE-AND-SET: one attempt is taken from the
 *                                 active code and its row is locked, BEFORE the comparison. No
 *                                 row means no usable code; nothing is compared then.
 *   4  the comparison             in this process, in constant time, only by the request to
 *                                 which statement 3 returned a row (AT-4).
 *   5a REDEEM_CODE and the rest   the code becomes REDEEMED where it is still ACTIVE (the row
 *                                 count decides) and gets its attempt back; the Core's own
 *                                 identity is read for the answer; the device number, the
 *                                 device row, the credential row with the hash of a new
 *                                 credential, `PAIRING_SUCCESS`, the event `PAIRED`. After the
 *                                 commit the redeem lock is cleared.
 *   5b a failure                  the attempt stays counted on the code; the fifth closes it
 *                                 (EXHAUSTED) with its row; the failure is counted on the redeem
 *                                 lock (the third locks); `PAIRING_FAILED`.
 *
 * Nothing is read or awaited between the handler and the unit, so redeems that arrive together
 * take their attempts in the order of their arrival. Each is a counted attempt, on the lock and
 * on the code, and of two redeems of the right code exactly one finds the code ACTIVE.
 *
 * ONE FAILURE ANSWER (SR-29). A wrong, an expired, a used, a cancelled and an absent code get
 * the same 401 `INVALID_CODE` with the same text. `details.attemptsRemaining` is the count of
 * the redeem lock, which does not depend on a code, so the answer says nothing about one. The
 * failure that locks answers 423 `LOCKED`, as every attempt during the lock does.
 *
 * THE DENIAL BUDGET (SR-71). `PAIRING_FAILED` and `PAIRING_LOCKED` are audited refusals: each
 * takes its place in the budget of the caller's key BEFORE its row is written. Whether a redeem
 * is a refusal is known only inside the unit, so the place is taken there. With no place left
 * the attempt answers 429 and writes no refusal row, but it stays counted, on the lock and on
 * the code: the unit commits what it counted and the 429 is thrown after it.
 *
 * THE CREDENTIAL is generated here, returned once in the answer, and stored as its SHA-256. The
 * presented code goes to the comparison and nowhere else. Neither reaches a row, an event, a
 * publication or a log line (SR-28, SR-31).
 */
import { ApiErrorCode, type PairingRedeemRequest, type PairingRedeemed } from '@dems/shared/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { looksLikeSecret } from '../../core';
import { authenticationOf, pairedDeviceOf } from '../../plugins/authenticate';
import { ApiFailure, invalidInput, notReady } from '../../plugins/error-envelope';
import { appendActivity, codeClosed, paired, redeemFailed, redeemLocked } from './activity';
import { closeExpiredCode } from './codes';
import { PAIRING_CODE_MAX_FAILED_REDEEMS } from './limits';
import type { RedeemFailure, RedeemLock, RedeemLockRefusal } from './redeem-lock';
import { deviceCredentialHash, newDeviceCredential, pairingCodeMatches } from './secrets';
import {
  consumeRedeemAttempt,
  deviceIdOf,
  exhaustCode,
  insertDevice,
  insertDeviceCredential,
  nextRegistryNumber,
  readCoreIdentity,
  redeemCode,
  type CoreIdentityRow,
} from './store';

/** The one answer of a redeem that paired nothing (SR-29). */
export function invalidCode(attemptsRemaining: number): ApiFailure {
  return new ApiFailure(401, ApiErrorCode.INVALID_CODE, 'The pairing code is not valid.', { details: { attemptsRemaining } });
}

/** The answer while redeeming is locked, and of the failure that locked it. */
export function redeemingLocked(lockedUntil: number, retryInMs: number): ApiFailure {
  return new ApiFailure(423, ApiErrorCode.LOCKED, 'Too many failed pairing attempts. Try again shortly.', {
    details: { lockedUntil, retryInMs },
  });
}

/** What the unit decided. `limited` is the 429 of the denial budget when a refusal found no place left. */
type RedeemOutcome =
  | { readonly kind: 'PAIRED'; readonly deviceId: string; readonly credential: string; readonly pairedAt: number; readonly core: CoreIdentityRow }
  | { readonly kind: 'FAILED'; readonly failure: RedeemFailure; readonly limited: unknown }
  | { readonly kind: 'LOCKED'; readonly refusal: RedeemLockRefusal; readonly limited: unknown };

/**
 * The texts a redeeming caller sends are stored in the registry and shown on the portal. None
 * may carry a secret there: not something of the form of a credential, and not the very code
 * that is being presented beside it (NL-2). Such a body does not match the expected input.
 */
function refuseSecretInText(input: PairingRedeemRequest): void {
  for (const text of [input.deviceName, input.platform, input.appVersion]) {
    if (looksLikeSecret(text) || text.includes(input.code)) throw invalidInput('body');
  }
}

export async function redeemPairingCode(
  app: FastifyInstance,
  lock: RedeemLock,
  request: FastifyRequest,
  input: PairingRedeemRequest,
): Promise<PairingRedeemed> {
  refuseSecretInText(input);
  // Who the rows name: the operator of the caller's session and the device it already is, if
  // any. A caller without a credential, the usual case, is neither.
  const caller = { operatorId: authenticationOf(request).session?.operatorId ?? null, deviceId: pairedDeviceOf(request) };

  /** One place in the denial budget for one refusal row. Null: taken. Otherwise the 429 to answer after the unit. */
  const placeInBudget = async (): Promise<unknown> => {
    try {
      await app.denialBudget.consume(request);
      return null;
    } catch (refused) {
      return refused;
    }
  };

  const outcome = await app.pipeline.run('pairing.redeem', async (unit): Promise<RedeemOutcome> => {
    const now = app.clock.now();

    // 1. The attempt is taken BEFORE anything is read or compared (ENG-24).
    const attempt = await lock.take(now);
    if (attempt.kind === 'LOCKED') {
      const limited = await placeInBudget();
      if (limited === null) await appendActivity(unit, redeemLocked({ ...caller, lockedUntil: attempt.lockedUntil, retryInMs: attempt.retryInMs }));
      return { kind: 'LOCKED', refusal: attempt, limited };
    }

    // 2 and 3. The same two statements for every attempt that was taken, in this order.
    const expired = await closeExpiredCode(unit, now);
    const consumed = await consumeRedeemAttempt(unit, now);

    // 4 and 5a. Only the request that took an attempt from the code compares, and the
    // compare-and-set decides whether the code is still there to redeem (ENG-25).
    if (consumed !== null && pairingCodeMatches(consumed.codeHash, consumed.codeId, input.code) && (await redeemCode(unit, now, consumed.codeId))) {
      // The Core this device is now paired with, for the answer and the row. A database
      // without it was never seeded: nothing is stored and the server says it is not ready.
      const core = await readCoreIdentity(unit);
      if (core === null) throw notReady();
      const deviceId = deviceIdOf(await nextRegistryNumber(unit, 'device'));
      const credential = newDeviceCredential();
      await insertDevice(unit, {
        id: deviceId,
        name: input.deviceName,
        platform: input.platform,
        appVersion: input.appVersion,
        pairedAt: now,
        pairedWithCodeId: consumed.codeId,
      });
      await insertDeviceCredential(unit, deviceId, deviceCredentialHash(credential));
      await appendActivity(unit, paired({ operatorId: caller.operatorId, deviceId, codeId: consumed.codeId, core }));
      unit.afterCommit(() => {
        // A success clears the count and the lock of redeeming.
        lock.succeed();
        app.publish({ kind: 'admin.changed', resource: 'DEVICES' });
        app.publish({ kind: 'admin.changed', resource: 'PAIRING_CODE' });
      });
      return { kind: 'PAIRED', deviceId, credential, pairedAt: now, core };
    }

    // 5b. The attempt stays counted. The fifth failed attempt of a code closes it.
    const exhausted = consumed !== null && consumed.failedAttempts >= PAIRING_CODE_MAX_FAILED_REDEEMS && (await exhaustCode(unit, now, consumed.codeId));
    const failure = await lock.fail(attempt, now);
    const limited = await placeInBudget();
    if (limited === null) {
      await appendActivity(unit, redeemFailed({ ...caller, attemptsRemaining: failure.attemptsRemaining, lockedUntil: failure.lockedUntil }));
    }
    if (consumed !== null && exhausted) await appendActivity(unit, codeClosed({ codeId: consumed.codeId, reason: 'EXHAUSTED', operatorId: null }));
    if (consumed !== null || expired !== null) unit.afterCommit(() => app.publish({ kind: 'admin.changed', resource: 'PAIRING_CODE' }));
    return { kind: 'FAILED', failure, limited };
  });

  if (outcome.kind === 'PAIRED') {
    return { deviceId: outcome.deviceId, deviceCredential: outcome.credential, pairedAt: outcome.pairedAt, core: outcome.core };
  }
  // The unit has committed what it counted. No place in the denial budget: 429, and no refusal row.
  if (outcome.limited !== null) throw outcome.limited;
  if (outcome.kind === 'LOCKED') throw redeemingLocked(outcome.refusal.lockedUntil, outcome.refusal.retryInMs);
  const { failure } = outcome;
  throw failure.lockedUntil === null ? invalidCode(failure.attemptsRemaining) : redeemingLocked(failure.lockedUntil, failure.retryInMs);
}
