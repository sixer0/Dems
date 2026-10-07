/**
 * The pairing code, as the portal handles it (plan row W32; spec §6.1, §6.2 T1, T3, T4, §7.7
 * operations 15 to 17; SR-26, SR-28, SR-30; database contract §4.7, §5.6 AT-3, AT-5).
 *
 *   issue    a new code: six digits from the platform's random source, valid 300 s. ONE code is
 *            active at a time: the unit first closes the one that stands (expired, if its time
 *            has passed; cancelled by this operator, otherwise), then inserts the new one. The
 *            unique index `pairing_codes_one_active_key` is the last line: a second ACTIVE row
 *            is refused by the database, whatever ran before;
 *   status   what an operator may read of the active code: never the code, never its hash;
 *   cancel   the active code becomes CANCELLED; nothing is written when none is active;
 *   sweep    the active code whose 300 s have passed becomes EXPIRED (the timer of `index.ts`;
 *            a redeem, an issue and a cancel do the same in their own unit, so the row is
 *            there whether the timer ran or not).
 *
 * THE CODE is returned once, in the answer of the issue, and exists nowhere else: the row holds
 * the SHA-256 of the code ID and the code, the audit row and the publication name the code ID.
 *
 * Every state change is one unit of the serial pipeline with its audit row (ENG-23); each
 * transition is one compare-and-set statement whose returned row decides (ENG-25).
 */
import { PairingCodeCloseReason, type ActivePairingCode, type PairingCodeIssued } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import type { UnitContext } from '../../core';
import { appendActivity, codeClosed, codeIssued } from './activity';
import { readDatabase } from './database';
import { PAIRING_CODE_LIFETIME_MS, PAIRING_CODE_MAX_FAILED_REDEEMS } from './limits';
import { newPairingCode, pairingCodeHash, qrPayloadOf } from './secrets';
import { anyExpiredCode, cancelActiveCode, expireActiveCode, insertCode, nextRegistryNumber, pairingCodeIdOf, readActiveCode } from './store';

/** After the commit: the portal's Paired Devices page reads the code status again. */
function publishCodeChanged(app: FastifyInstance, unit: UnitContext): void {
  unit.afterCommit(() => app.publish({ kind: 'admin.changed', resource: 'PAIRING_CODE' }));
}

/**
 * Inside a unit: the active code becomes EXPIRED if its time has passed, with its row (T4).
 * Returns the ID of the code it closed, or null.
 */
export async function closeExpiredCode(unit: UnitContext, now: number): Promise<string | null> {
  const expired = await expireActiveCode(unit, now);
  if (expired !== null) await appendActivity(unit, codeClosed({ codeId: expired, reason: PairingCodeCloseReason.EXPIRED, operatorId: null }));
  return expired;
}

/** Operation 15. `operatorId` is the caller of the session, never a request field. */
export function issueCode(app: FastifyInstance, operatorId: string): Promise<PairingCodeIssued> {
  return app.pipeline.run('pairing.issueCode', async (unit) => {
    const now = app.clock.now();
    // One active code at a time (PR-P3): what stands is closed first, each with its own row.
    await closeExpiredCode(unit, now);
    const replaced = await cancelActiveCode(unit, now, operatorId);
    if (replaced !== null) await appendActivity(unit, codeClosed({ codeId: replaced, reason: PairingCodeCloseReason.CANCELLED, operatorId }));

    const codeId = pairingCodeIdOf(await nextRegistryNumber(unit, 'pairingCode'));
    const code = newPairingCode();
    const expiresAt = now + PAIRING_CODE_LIFETIME_MS;
    await insertCode(unit, { id: codeId, codeHash: pairingCodeHash(codeId, code), issuedBy: operatorId, issuedAt: now, expiresAt });
    await appendActivity(unit, codeIssued({ operatorId, codeId, expiresAt }));
    publishCodeChanged(app, unit);
    return { codeId, code, qrPayload: qrPayloadOf(code), issuedAt: now, expiresAt, attemptsAllowed: PAIRING_CODE_MAX_FAILED_REDEEMS };
  });
}

/** Operation 16: a read on the pool. A code past its time is not active, whether it was swept or not. */
export async function activeCodeStatus(app: FastifyInstance): Promise<ActivePairingCode> {
  const active = await readDatabase(app, 'pairing.getPairingCodeStatus', (db) => readActiveCode(db, app.clock.now()));
  if (active === null) return { active: null };
  return {
    active: {
      codeId: active.id,
      issuedBy: active.issuedBy,
      issuedAt: active.issuedAt,
      expiresAt: active.expiresAt,
      attemptsRemaining: Math.max(0, PAIRING_CODE_MAX_FAILED_REDEEMS - active.failedAttempts),
    },
  };
}

/** Operation 17. A code past its time is recorded as EXPIRED, not as cancelled. */
export function cancelCode(app: FastifyInstance, operatorId: string): Promise<void> {
  return app.pipeline.run('pairing.cancelCode', async (unit) => {
    const now = app.clock.now();
    const expired = await closeExpiredCode(unit, now);
    const cancelled = await cancelActiveCode(unit, now, operatorId);
    if (cancelled !== null) await appendActivity(unit, codeClosed({ codeId: cancelled, reason: PairingCodeCloseReason.CANCELLED, operatorId }));
    if (expired !== null || cancelled !== null) publishCodeChanged(app, unit);
  });
}

/**
 * One expiry sweep at the server clock's time. Returns the ID of the code it closed, or null.
 * The timer of a listening server calls it every 5 s; a test calls it after moving the clock.
 */
export async function sweepCodes(app: FastifyInstance): Promise<string | null> {
  const asked = app.clock.now();
  // A read first: a sweep that finds nothing opens no transaction and takes no chain lock. It
  // decides nothing: the unit's statement states the predicate again.
  const pending = await readDatabase(app, 'pairing.sweepCodes', (db) => anyExpiredCode(db, asked));
  if (!pending) return null;
  return app.pipeline.run('pairing.sweepCodes', async (unit) => {
    const expired = await closeExpiredCode(unit, app.clock.now());
    if (expired !== null) publishCodeChanged(app, unit);
    return expired;
  });
}
