/**
 * The three state changes of user administration (plan row W33; spec §4.6 RB-8, §4.7, §7.6
 * operations 12 to 14, §8.2 ENG-23 and ENG-27, §13.1; database contract §5.6 AT-1 to AT-3 and
 * AT-C5; SR-12, SR-47, SR-72).
 *
 * EACH IS ONE UNIT OF WORK of the serial pipeline, committed in one transaction: the lock, the
 * check, the transition, what follows from it and the audit row commit together or not at all.
 *
 *   admin.assignUserRole   lock every operator row; unknown: 404; the same role: nothing;
 *                          the rule RB-8: 409; the role (compare-and-set); the new role's
 *                          permissions; ROLE_CHANGED; the operator as answered.
 *   admin.disableUser      lock every operator row; unknown: 404; disabled already: nothing;
 *                          the rule RB-8: 409; the flag (compare-and-set); the operator's open
 *                          sessions ended through `app.sessionRegistry` (reason USER_DISABLED);
 *                          the live biometric tokens revoked; USER_DISABLED with the number of
 *                          sessions ended; the operator as answered.
 *   admin.enableUser       lock the one operator row; unknown: 404; enabled already: nothing;
 *                          the flag (compare-and-set); USER_ENABLED; the operator as answered.
 *
 * A REFUSAL THROWS inside the unit, so the unit rolls back and nothing is stored: "409
 * `LAST_ADMIN` changes nothing" is the transaction's property, not a promise of the code. Neither
 * refusal is audited (the specification names no row for them), so neither takes a place in the
 * denial budget.
 *
 * WHAT GUARANTEES THE RULE UNDER CONCURRENCY. Inside one process the pipeline runs one unit at a
 * time (ENG-1, ENG-6). Across processes on one database two things order the units, each enough
 * on its own: every unit opens with the lock of the audit chain head (append protocol AP-2,
 * AT-2), and the rule's own lock point, `LOCK_OPERATORS`, which does not rely on the first. The
 * check is made on rows read under that lock, and the write is compare-and-set on what was read.
 *
 * PUBLICATIONS leave after the commit, in commit order (`unit.afterCommit`), and never for a unit
 * that rolled back. A change that changed nothing publishes nothing and writes no row.
 *
 * The actor of a row is the caller's session (`request.principal`), handed in by the route; a
 * reason is what the administrator typed, stored in the details only, never in the message.
 */
import { ApiErrorCode, type AdminUser, type CreateUserRequest, type DeleteUserRequest, type DeletedUser, type UpdateUserRequest } from '@dems/shared/api';
// Catatan: modul ini SENGAJA tidak mengimpor apa pun dari identity/password-hash. Sebuah akun baru
// lahir tanpa kredensial; sandi hanya ditulis perintah host lewat TTY (keputusan U19; aturan statis
// rule 6 modul ini). Yang boleh modul ini lakukan terhadap tabel kredensial hanyalah menghapus
// barisnya ketika akunnya sendiri dihapus, tanpa pernah membaca atau menulis nilai sandi.
import { Permission, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { UnitContext } from '../../core';
import { CoreError } from '../../core/errors';
import { ApiFailure } from '../../plugins/error-envelope';
import { revokeBiometricTokens } from '../identity/biometric';
import { isVendorRoot, leavesNoAdministrator, VENDOR_ROOT_USERNAME } from './rule';
import {
  assignRole,
  purgeForecast,
  purgeOperator,
  referencedBy,
  referenceTotal,
  resealChain,
  samePurge,
  disableOperator,
  enableOperator,
  insertOperator,
  lockOperator,
  lockOperators,
  nextOperatorId,
  readRolePermissions,
  readRolesHolding,
  readUser,
  readUsername,
  updateProfile,
  usernameTaken,
} from './statements';

/** The labels of the three units. They appear in the pipeline's log lines. */
export const ADMIN_UNIT_LABEL = {
  assignUserRole: 'admin.assignUserRole',
  enableUser: 'admin.enableUser',
  disableUser: 'admin.disableUser',
  createUser: 'admin.createUser',
  updateUser: 'admin.updateUser',
  deleteUser: 'admin.deleteUser',
} as const;

/**
 * The permission whose last enabled holder the rule RB-8 protects. It is named here as DATA of
 * the rule (which roles hold it is read from the stored matrix inside the unit); it is not a
 * check of the caller, which is stage 6's alone.
 */
export const ADMINISTRATION_PERMISSION = Permission.USER_ADMIN;

/** Who asked: the operator and the device of the caller's session, never a request field (SR-65). */
export interface Actor {
  readonly operatorId: string;
  readonly deviceId: string | null;
}

export interface ChangeOutcome {
  /** The operator after the unit, as `AdminUser`. */
  readonly user: AdminUser;
  /** False when the operator already was in the asked state: no row, no publication. */
  readonly changed: boolean;
}

/** 404: no operator has this ID. The text is fixed and names nothing of the request. */
export function unknownOperator(): ApiFailure {
  return new ApiFailure(404, ApiErrorCode.NOT_FOUND, 'No operator has this ID.');
}

/** 409 of RB-8. Nothing was changed. */
export function lastAdministrator(): ApiFailure {
  return new ApiFailure(409, ApiErrorCode.LAST_ADMIN, 'At least one enabled operator must keep user administration.');
}

/** The optional `reason` detail: present only when the administrator gave one. */
const reasonDetail = (reason: string | undefined): { reason?: string } => (reason === undefined ? {} : { reason });

/** The operator the unit answers with. The row is locked by this unit, so it is there. */
async function userOf(unit: UnitContext, operatorId: string): Promise<AdminUser> {
  const user = await readUser(unit, operatorId);
  if (user === null) throw new Error('an operator row that this unit holds locked was not found');
  return user;
}

/** A compare-and-set statement on a row this unit holds locked matched no row: that cannot be. */
function lockedRowChanged(): Error {
  return new Error('an operator row changed under the lock of the unit that changes it');
}

/** Operation 12. */
export function assignUserRole(
  app: FastifyInstance,
  actor: Actor,
  operatorId: string,
  role: OperatorRole,
  reason: string | undefined,
): Promise<ChangeOutcome> {
  return app.pipeline.run(ADMIN_UNIT_LABEL.assignUserRole, async (unit): Promise<ChangeOutcome> => {
    const now = app.clock.now();
    const operators = await lockOperators(unit);
    const target = operators.find((operator) => operator.id === operatorId);
    if (target === undefined) throw unknownOperator();
    if (target.role === role) return { user: await userOf(unit, operatorId), changed: false };

    const administratorRoles = await readRolesHolding(unit, ADMINISTRATION_PERMISSION);
    if (leavesNoAdministrator(operators, administratorRoles, { kind: 'ROLE', operatorId, role })) throw lastAdministrator();

    if (!(await assignRole(unit, operatorId, role, now, target.role))) throw lockedRowChanged();
    const permissions = await readRolePermissions(unit, role);
    await unit.audit.append({
      type: 'ROLE_CHANGED',
      message: `Role of ${operatorId} changed from ${target.role} to ${role}`,
      actorId: actor.operatorId,
      deviceId: actor.deviceId,
      details: { targetOperatorId: operatorId, from: target.role, to: role, ...reasonDetail(reason) },
    });
    const user = await userOf(unit, operatorId);
    unit.afterCommit(() => {
      // The sessions stay (spec §4.7): their sockets learn the new role, then the lists follow.
      app.publish({ kind: 'session.updated', operatorId, role, permissions });
      app.publish({ kind: 'admin.changed', resource: 'USERS' });
    });
    return { user, changed: true };
  });
}

/** Operation 14. */
export function disableUser(app: FastifyInstance, actor: Actor, operatorId: string, reason: string | undefined): Promise<ChangeOutcome> {
  return app.pipeline.run(ADMIN_UNIT_LABEL.disableUser, async (unit): Promise<ChangeOutcome> => {
    const now = app.clock.now();
    const operators = await lockOperators(unit);
    const target = operators.find((operator) => operator.id === operatorId);
    if (target === undefined) throw unknownOperator();
    if (!target.enabled) return { user: await userOf(unit, operatorId), changed: false };

    const administratorRoles = await readRolesHolding(unit, ADMINISTRATION_PERMISSION);
    if (leavesNoAdministrator(operators, administratorRoles, { kind: 'DISABLE', operatorId })) throw lastAdministrator();

    if (!(await disableOperator(unit, operatorId, now))) throw lockedRowChanged();
    // SR-12: the sessions end in the same transaction. The registry writes no row; it registers
    // only the device side (`device.session`, FX-C) for sessions bound to a paired device. This
    // unit's row counts the ended sessions and this unit publishes `session.ended` and
    // `admin.changed USERS` after its commit.
    const sessionIds = await app.sessionRegistry.endForOperator(unit, operatorId, 'USER_DISABLED');
    await revokeBiometricTokens(unit, { scope: 'OPERATOR', operatorId, reason: 'USER_DISABLED' }, now);
    await unit.audit.append({
      type: 'USER_DISABLED',
      message: `Operator ${operatorId} disabled; sessions ended: ${sessionIds.length}`,
      severity: 'WARNING',
      actorId: actor.operatorId,
      deviceId: actor.deviceId,
      details: { targetOperatorId: operatorId, sessionsEnded: sessionIds.length, ...reasonDetail(reason) },
    });
    const user = await userOf(unit, operatorId);
    unit.afterCommit(() => {
      if (sessionIds.length > 0) app.publish({ kind: 'session.ended', sessionIds, reason: 'USER_DISABLED' });
      app.publish({ kind: 'admin.changed', resource: 'USERS' });
    });
    return { user, changed: true };
  });
}

/** Operation 13. */
export function enableUser(app: FastifyInstance, actor: Actor, operatorId: string, reason: string | undefined): Promise<ChangeOutcome> {
  return app.pipeline.run(ADMIN_UNIT_LABEL.enableUser, async (unit): Promise<ChangeOutcome> => {
    const now = app.clock.now();
    const target = await lockOperator(unit, operatorId);
    if (target === null) throw unknownOperator();
    if (target.enabled) return { user: await userOf(unit, operatorId), changed: false };

    if (!(await enableOperator(unit, operatorId, now))) throw lockedRowChanged();
    await unit.audit.append({
      type: 'USER_ENABLED',
      message: `Operator ${operatorId} enabled`,
      actorId: actor.operatorId,
      deviceId: actor.deviceId,
      details: { targetOperatorId: operatorId, ...reasonDetail(reason) },
    });
    const user = await userOf(unit, operatorId);
    unit.afterCommit(() => {
      app.publish({ kind: 'admin.changed', resource: 'USERS' });
    });
    return { user, changed: true };
  });
}

// ── The vendor-only trio (RB-9 as amended by the principal, PT GSP, 02-11-2026) ───────────────
//
// All three open with the same lock point as the existing writes (`LOCK_OPERATORS`) and, before
// anything else, check the identity half of the narrowed access rule on the row it just locked:
// the caller's own username must be the vendor root account. The permission check of stage 6 has
// already passed by then; this is the rule the matrix cannot express, because a client's
// supervisor holds exactly the same USER_ADMIN as root does.
//
// A refusal inside these units rolls the transaction back: no row, no credential, no audit entry.

/** 403 of the narrowed rule. Fixed text: it names the role that may act, never the caller. */
export function notVendorRoot(): ApiFailure {
  return new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, `Only the ${VENDOR_ROOT_USERNAME} account may create, edit or delete an operator.`);
}

/** 422: the username of a create belongs to another operator. */
function usernameTakenFailure(): ApiFailure {
  return new ApiFailure(422, ApiErrorCode.INVALID_INPUT, 'That username is taken.');
}

/** 409: the `confirm` of a delete does not repeat the username of the operator named by the path. */
function deleteNotConfirmed(): ApiFailure {
  return new ApiFailure(409, ApiErrorCode.INVALID_STATE, 'The confirmation does not match this operator.');
}

/** The identity half of the access rule, read under the unit's own lock. */
async function requireVendorRoot(unit: UnitContext, operatorId: string): Promise<void> {
  if (!isVendorRoot(await readUsername(unit, operatorId))) throw notVendorRoot();
}

/** Operation 15. One unit: the ID allocation, the row, the optional credential, the audit rows. */
export function createUser(app: FastifyInstance, actor: Actor, input: CreateUserRequest, reason: string | undefined): Promise<ChangeOutcome> {
  return app.pipeline.run(ADMIN_UNIT_LABEL.createUser, async (unit): Promise<ChangeOutcome> => {
    const now = app.clock.now();
    // Lock the whole operator table first: the username uniqueness and the ID allocation below
    // must be serialised against any other create, even though no row is read from this lock.
    await lockOperators(unit);
    await requireVendorRoot(unit, actor.operatorId);
    if (await usernameTaken(unit, input.username)) throw usernameTakenFailure();

    const id = await nextOperatorId(unit);
    const displayName = input.displayName ?? input.name;
    if (!(await insertOperator(unit, { id, username: input.username, rank: input.rank ?? null, name: input.name, displayName, initials: input.initials, role: input.role }, now))) {
      throw new Error('the operator insert returned no row');
    }

    // No credential is written here, on purpose: the account exists but cannot sign in until the
    // host command sets a password (decision U19). The answer says so through `enabled` alone.
    await unit.audit.append({
      type: 'USER_CREATED',
      message: `Operator ${id} created with role ${input.role}`,
      actorId: actor.operatorId,
      deviceId: actor.deviceId,
      details: { targetOperatorId: id, role: input.role, ...reasonDetail(reason) },
    });

    const user = await userOf(unit, id);
    unit.afterCommit(() => {
      app.publish({ kind: 'admin.changed', resource: 'USERS' });
    });
    return { user, changed: true };
  });
}

/** Operation 16. The profile only; a request that changes nothing writes no row and publishes nothing. */
export function updateUser(app: FastifyInstance, actor: Actor, operatorId: string, input: UpdateUserRequest, reason: string | undefined): Promise<ChangeOutcome> {
  return app.pipeline.run(ADMIN_UNIT_LABEL.updateUser, async (unit): Promise<ChangeOutcome> => {
    const now = app.clock.now();
    const target = await lockOperator(unit, operatorId);
    if (target === null) throw unknownOperator();
    await requireVendorRoot(unit, actor.operatorId);
    const before = await userOf(unit, operatorId);

    const name = input.name ?? null;
    const displayName = input.displayName ?? null;
    const initials = input.initials ?? null;
    const rankProvided = input.rank !== undefined;
    const rank = input.rank ?? null;

    const changedFields = [
      name !== null && name !== before.name ? 'name' : null,
      displayName !== null && displayName !== before.displayName ? 'displayName' : null,
      initials !== null && initials !== before.initials ? 'initials' : null,
      rankProvided && rank !== (before.rank ?? null) ? 'rank' : null,
    ].filter((field): field is string => field !== null);

    if (changedFields.length === 0) return { user: before, changed: false };

    if (!(await updateProfile(unit, operatorId, { name, displayName, initials, rankProvided, rank }, now))) throw lockedRowChanged();
    await unit.audit.append({
      type: 'USER_UPDATED',
      message: `Profile of operator ${operatorId} updated: ${changedFields.join(',')}`,
      actorId: actor.operatorId,
      deviceId: actor.deviceId,
      details: { targetOperatorId: operatorId, fields: changedFields.join(','), ...reasonDetail(reason) },
    });
    const user = await userOf(unit, operatorId);
    unit.afterCommit(() => {
      // The engine mirrors the table: the `operators` slice carries the name and the initials that
      // a session header shows. A profile change alters that slice, so the mirror runs.
      app.publish({ kind: 'admin.changed', resource: 'USERS' });
    });
    return { user, changed: true };
  });
}

/**
 * Operation 17, as amended by the principal on 2026-11-02 (RB-9). A purge: the account goes together
 * with the history that belongs to it — its audit rows, its sign-ins, its credential and tokens —
 * and the chain is re-sealed over what survives. Records OF THE UNIT are never taken by this: they
 * keep their rows and lose their attribution, because deleting a recording or un-accepting a
 * commissioned installation is not what deleting a person means.
 *
 * What is given up is stated where the code can be read, not only in a ticket: after a purge the
 * chain no longer proves the erased account never existed. It still proves nothing else changed —
 * the seal refuses to alter a single non-hash column, verification recomputes the digest from the
 * stored rows so a dishonest seal fails loudly, and the erasure itself is announced by a
 * USER_DELETED row naming the acting root and the counts.
 */
export function deleteUser(app: FastifyInstance, actor: Actor, operatorId: string, input: DeleteUserRequest, reason: string | undefined): Promise<DeletedOutcome> {
  return app.pipeline.run(ADMIN_UNIT_LABEL.deleteUser, async (unit): Promise<DeletedOutcome> => {
    const now = app.clock.now();
    const operators = await lockOperators(unit);
    const target = operators.find((operator) => operator.id === operatorId);
    if (target === undefined) throw unknownOperator();
    await requireVendorRoot(unit, actor.operatorId);

    const before = await userOf(unit, operatorId);
    if (input.confirm.trim().toLowerCase() !== before.username) throw deleteNotConfirmed();

    // RB-8 first: a delete that would leave no enabled holder of user administration is refused.
    const administratorRoles = await readRolesHolding(unit, ADMINISTRATION_PERMISSION);
    if (leavesNoAdministrator(operators, administratorRoles, { kind: 'DELETE', operatorId })) throw lastAdministrator();

    // Purge, not merely removal (RB-9 as amended by the principal on 2026-11-02): the account goes
    // together with the history that belongs to it. What the account DID to the unit stays — the
    // evidence, the custody entries, the session records, the acceptance of the installation — with
    // its attribution dropped by the SET NULL rules of migration 0036. The count of those records is
    // what `references` holds, and it goes into the audit row so the erasure can be measured later.
    const references = await referencedBy(unit, operatorId);
    const forecast = await purgeForecast(unit, operatorId);

    const sessionsEnded = await app.sessionRegistry.endForOperator(unit, operatorId, 'USER_DISABLED');
    await revokeBiometricTokens(unit, { scope: 'OPERATOR', operatorId, reason: 'USER_DISABLED' }, now);

    // The order here is not free. Every audit row of this unit is written BEFORE the erasure, and
    // the chain is re-sealed AFTER it, with nothing appended afterwards: the unit read its chain head
    // when it began (AP-2) and the seal moves that head, so a later append would be refused by the
    // database's own guard rather than quietly accepted.
    const unattributed = referenceTotal(references);
    await unit.audit.append({
      type: 'USER_DELETED',
      message: `Operator ${operatorId} deleted with its history: ${forecast.auditRows} audit row(s) removed, ${forecast.signInRows} sign-in row(s), chain re-sealed${forecast.resealFromSeq === null ? ' untouched' : ` from ${forecast.resealFromSeq}`}`,
      severity: 'WARNING',
      actorId: actor.operatorId,
      deviceId: actor.deviceId,
      details: {
        targetOperatorId: operatorId,
        role: before.role,
        sessionsEnded: sessionsEnded.length,
        auditRowsRemoved: forecast.auditRows,
        signInRowsRemoved: forecast.signInRows,
        credentialsRemoved: forecast.credentialsRemoved,
        recordsLeftUnattributed: unattributed,
        ...reasonDetail(reason),
      },
    });

    const erased = await purgeOperator(unit, operatorId, actor.operatorId, reason ?? 'operator deleted');
    if (!samePurge(forecast, erased)) throw new CoreError('AUDIT_PURGE_FORECAST_MISMATCH', 'the purge erased a different set of rows than this unit counted and announced');
    await resealChain(unit, operatorId, erased.resealFromSeq);

    unit.afterCommit(() => {
      if (sessionsEnded.length > 0) app.publish({ kind: 'session.ended', sessionIds: sessionsEnded, reason: 'USER_DISABLED' });
      app.publish({ kind: 'admin.changed', resource: 'USERS' });
    });
    return { deleted: { operatorId, username: before.username, sessionsEnded: sessionsEnded.length, credentialsRemoved: erased.credentialsRemoved }, changed: true };
  });
}

/** What a delete answers: not an `AdminUser`, because the operator no longer exists. */
export interface DeletedOutcome {
  readonly deleted: DeletedUser;
  readonly changed: boolean;
}
