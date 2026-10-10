/**
 * What a demo reset needs of the server, bound to the seams of the app (plan row W43; the
 * `ResetHost` of `reset.ts`).
 *
 * Every member reads its seam through `app` at the moment it is used: the pool a reset reopens
 * is a new object (`app.db.pool` is a getter), and what a test puts behind a seam after
 * `ready()` is what runs.
 *
 *   hold            `app.readiness.hold`: stage 2 answers 503 to every other request
 *   drain           `app.pipeline.drain`: the units that run or wait have ended
 *   operatorRoles   one read on the runtime pool (`app.db.read`)
 *   realEvidence    the caller-side reset guard (`findRealSealedEvidence` of `src/db/reset`): one
 *                   read on the runtime pool and a listing of the evidence store - the media root
 *                   of the configuration, which is also handed to the routine (decision D165)
 *   auditRefusal    one unit of work (`app.pipeline.run`): the `ACCESS_DENIED` row of a reset the
 *                   guard refused (integration pass D11; the one row this module writes itself)
 *   stopEngine      `app.engine.stop`: the scheduler is off, the last snapshot is written
 *   closePool       `app.db.close`: the pool of the runtime role is ended
 *   reopenPool      `app.db.reopen`: a new pool from the same configuration, so with the same
 *                   start-up options as the first one
 *   bootChecks      B-1 to B-9 on the reopened pool (below)
 *   reloadMatrix    `permissionGuard(app).reloadMatrix`: the stored matrix, read and checked again
 *   reloadEngine    `app.engine.reload`: rehydrates and takes the stored epoch as it is
 *   resyncEngine    `app.engine.start('resync')`: rehydrates under the stored epoch plus 1 and
 *                   touches nothing else (no restart fault: that is a process start's)
 *
 * THE BOOT CHECKS AFTER A RESET are the ones of a start (database contract §7.4; §8.5 R-9), run
 * again on the pool that was reopened: B-1 with both of its halves (the database answers; a
 * pooled connection has the pinned path of the runtime role), then B-2 to B-9 in the order of
 * the contract, B-8 reported and never blocking. They cannot be run through
 * `app.readiness.boot()`: that would also run the engine's boot step, which is a process start
 * and adds 1 to the epoch a second time (decision D74 DN-5). The core owns the one runner of
 * them (`runDatabaseBootChecks`, decision D101): this file calls it and names the check that
 * did not pass in the module's own failure. B-8 is reported with the core's two lines, as at a
 * start.
 */
import type { FastifyInstance } from 'fastify';
import { AuditType, Severity } from '@dems/shared/sim';
import { runDatabaseBootChecks } from '../../core';
import { findRealSealedEvidence } from '../../db/reset';
import { permissionGuard } from '../../plugins/permission-guard';
import { BootError } from '../../plugins/readiness';
import { RESET_HOLD_NAME, ResumeFailure, type OperatorRoleRow, type ResetHost, type ResetRoutine } from './reset';

/** The roles the operators table holds. Operator IDs and role names are identifiers, not secrets. */
export const READ_OPERATOR_ROLES = 'SELECT id, role_id AS role FROM public.operators ORDER BY id';
/** `source` of the read above in a log line. */
export const OPERATOR_ROLES_SOURCE = 'demo.operatorRoles';
/** `source` of the read of the caller-side reset guard in a log line. */
export const REAL_EVIDENCE_SOURCE = 'demo.realEvidence';
/** Label of the unit of work that writes the audit row of a refused reset. */
export const RESET_REFUSAL_UNIT_LABEL = 'demo.reset.refused';

/**
 * B-1 to B-9 on the current pool, in the order of the contract. Rejects with a `ResumeFailure`
 * that names the first check that did not pass; the caller logs and persists it once.
 */
export async function runBootChecks(app: FastifyInstance): Promise<void> {
  try {
    await runDatabaseBootChecks(app);
  } catch (error) {
    throw error instanceof BootError ? new ResumeFailure(error.stepId, error.cause) : error;
  }
}

/**
 * The host of a reset on this app. `routine` is asked for at each reset: production gives the
 * routine of `src/db/reset` as it is; a test may put one in place through the module's control.
 */
export function createResetHost(app: FastifyInstance, routine: () => ResetRoutine): ResetHost {
  const host: ResetHost = {
    get database() {
      // The database follows the listen port (`config.ts`): one of the four project databases.
      return app.config.database.database;
    },
    get dataDir() {
      return app.config.dataDir;
    },
    get mediaStoreDir() {
      // What the sealing composition writes to (`sealing-host/index.ts`: `app.config.mediaStoreDir`).
      return app.config.mediaStoreDir;
    },
    now: () => app.clock.now(),
    epoch: () => app.engine.epoch,
    routine: (options) => routine()(options),
    hold: () => app.readiness.hold(RESET_HOLD_NAME),
    drain: () => app.pipeline.drain(),
    operatorRoles: () => app.db.read(OPERATOR_ROLES_SOURCE, async (pool) => (await pool.query<OperatorRoleRow>(READ_OPERATOR_ROLES)).rows),
    // The same two sides the routine asks at R-3, with the same store root: the configured media root (decision D165).
    realEvidence: () => app.db.read(REAL_EVIDENCE_SOURCE, (pool) => findRealSealedEvidence(pool, { database: host.database, storeRoot: host.mediaStoreDir })),
    async auditRefusal({ operation, actorId, reason }) {
      await app.pipeline.run(RESET_REFUSAL_UNIT_LABEL, (unit) =>
        unit.audit.append({
          type: AuditType.ACCESS_DENIED,
          severity: Severity.WARNING,
          message: `Demo reset refused: real sealed evidence exists (${operation})`,
          actorId,
          deviceId: null,
          details: { operationId: operation, reason },
        }),
      );
    },
    stopEngine: () => app.engine.stop(),
    closePool: () => app.db.close(),
    reopenPool: () => app.db.reopen(),
    bootChecks: () => runBootChecks(app),
    reloadMatrix: async () => (await permissionGuard(app).reloadMatrix()).grants,
    reloadEngine: () => app.engine.reload(),
    resyncEngine: () => app.engine.start('resync'),
    publish: (publication) => app.publish(publication),
    persist: (entry) => app.errorLog.append(entry),
  };
  return host;
}
