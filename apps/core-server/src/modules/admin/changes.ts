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
import { ApiErrorCode, type AdminUser } from '@dems/shared/api';
import { Permission, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import type { UnitContext } from '../../core';
import { ApiFailure } from '../../plugins/error-envelope';
import { revokeBiometricTokens } from '../identity/biometric';
import { leavesNoAdministrator } from './rule';
import {
  assignRole,
  disableOperator,
  enableOperator,
  lockOperator,
  lockOperators,
  readRolePermissions,
  readRolesHolding,
  readUser,
} from './statements';

/** The labels of the three units. They appear in the pipeline's log lines. */
export const ADMIN_UNIT_LABEL = {
  assignUserRole: 'admin.assignUserRole',
  enableUser: 'admin.enableUser',
  disableUser: 'admin.disableUser',
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
    // SR-12: the sessions end in the same transaction. The registry writes no row and publishes
    // nothing; this unit's row counts them and this unit publishes after its commit.
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
