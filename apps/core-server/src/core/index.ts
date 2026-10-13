/**
 * Core services (plan row W21; spec §2.2, §2.3 stages 8 to 10, §8.2 to §8.4, §13; database
 * contract §5.6, §6.4, §7.4; decisions D20, D40).
 *
 * This unit fills three seams of the scaffold (P25) and registers the boot checks:
 *
 *   `app.clock`        the server clock (`clock.ts`): the wall clock, never moving backwards. A
 *                      test replaces it with the shared manual clock.
 *   `app.pipeline`     the serial unit-of-work queue (`pipeline.ts`), shared by the engine host
 *                      and every server-native module (SR-72).
 *   `app.auditWriter`  the audit writer in the scaffold's signature. The writers themselves hang
 *                      on the unit: `unit.audit` (`audit-writer.ts`) and `unit.events`
 *                      (`event-writer.ts`).
 *   boot steps         B-2 to B-9 (`boot-checks.ts`), after B-1 of the pool plugin.
 *
 * HOW A SERVER-NATIVE HANDLER USES IT. One unit: check, change rows, audit, event, commit,
 * answer.
 *
 *     const outcome = await app.pipeline.run('pairing.revokeDevice', async (unit) => {
 *       // check and change in one statement whose row count decides (AT-3)
 *       const changed = await unit.query('UPDATE paired_devices SET state = $2 ... WHERE id = $1 AND state = $3 RETURNING id', [...]);
 *       if (changed.rowCount === 0) throw new ApiFailure(409, 'DEVICE_NOT_PAIRED', '...');   // rolls back
 *       const row = await unit.audit.append({ type: 'DEVICE_REVOKED', actorId, deviceId, message: 'Device revoked.', details: { reason, sessionsEnded } });
 *       await unit.events.append({ type: 'UNPAIRED', message: 'Device revoked.', deviceId });
 *       unit.afterCommit(() => app.publish({ kind: 'device.revoked', ... }));               // after the commit, in commit order
 *       return { seq: row.seq };
 *     });
 *     return reply.code(204).send();                                                        // the commit has happened
 *
 * A refusal that is audited takes its place in the denial budget first, outside the unit:
 * `await app.denialBudget.consume(request)`, then the unit that appends the row, then the throw.
 *
 * HOW THE ENGINE HOST USES IT. A tick or a command is one unit; nothing is sent to the database
 * unless something durable changed. The rows come from the one mapping (`db/mapping`):
 *
 *     await app.pipeline.run('engine.tick', async (unit) => {
 *       sim.tick();
 *       const next = pickDurable(sim.store.getState());
 *       const changes = diffSlices(written, next, app.clock.now());
 *       if (changes.length === 0) return;                           // no transaction was opened
 *       await unit.audit.appendPrepared(newAuditRows(written, next));   // AP-6
 *       await unit.events.appendPrepared(newEvents(written, next));
 *       await applyChanges(unit.db, changes.filter((change) => change.table !== 'auditLog' && change.table !== 'events'));
 *       unit.afterCommit(() => { written = next; app.publish(...); });
 *     });
 *
 * The two tables are the writers' alone: an insert into them through `unit.db` or `unit.query`
 * is refused. `app.pipeline.onCommit(...)` tells the host which rows the server-native units
 * appended, so that its ring continues the one chain.
 *
 * Rules of the scaffold that hold here: the plugin function opens no database connection (the
 * pool is read when a unit starts; the boot checks are boot steps), and nothing is kept across
 * `app.db.generation` changes.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `corePlugin`, `Clock`, `Pipeline`,
 * `UnitOfWork`, `AuditWriter` and `AuditEntry` keep their names.
 */
import type { FastifyPluginAsync } from 'fastify';
import { registerBootChecks } from './boot-checks';
import { createSystemClock, followClock } from './clock';
import { createPipeline } from './pipeline';
import type { AuditWriter, UnitContext, UnitOfWork } from './types';
import { stateOf } from './unit-of-work';

export { CAPTURE_CREDENTIAL_REVEAL_REASONS, SERVER_AUDIT_DETAIL_RULES, SYSTEM_BOOT_SIGNING_DETAIL_RULES, PAIRING_CODE_CLOSE_REASONS, detailRulesOf, type CaptureCredentialRevealReason, type DetailRule, type ServerAuditType } from './audit-details';
export { REPORTED_BOOT_CHECK, registerBootChecks, runDatabaseBootChecks } from './boot-checks';
export { createSystemClock, followClock, raiseClockFloor, stampOf, type Clock, type FloorClock } from './clock';
export {
  CoreError,
  CoreErrorCode,
  PipelineFailure,
  PipelineRefusal,
  SqlState,
  driverErrorOf,
  isConnectionFailure,
  isConnectionFailureCode,
  sqlStateOf,
} from './errors';
export {
  EVENT_COUNTER_NAME,
  NATIVE_PAYLOAD_KEYS_MAX,
  NATIVE_TEXT_MAX_LENGTH,
  PIPELINE_CLOSE_TIMEOUT_MS,
  PIPELINE_MAX_PENDING,
  PIPELINE_UNIT_TIMEOUT_MS,
  REFERENCE_MAX_LENGTH,
  UNIT_LABEL_MAX_LENGTH,
  UNIT_LABEL_PATTERN,
} from './limits';
export { looksLikeSecret } from './payload-rules';
export { PIPELINE_LIMITS, createPipeline, type PipelineDependencies, type PipelineLimits } from './pipeline';
export { UnitStatementRule, unitStatementRefusal } from './unit-statement';
export { counterName, createFixedWindows, retryAfterSeconds, type FixedWindows, type OpenWindow } from './windows';
export { createSweeper, type Sweeper, type SweeperOptions } from './sweeper';
export type {
  AuditEntry,
  AuditWriter,
  ChainHead,
  CommittedUnit,
  EventEntry,
  Pipeline,
  PipelineSnapshot,
  UnitAuditWriter,
  UnitContext,
  UnitDatabase,
  UnitEventWriter,
  UnitOfWork,
  RegistryOperationId,
} from './types';

/**
 * The unit's tools for a function that was handed the bare handle (`UnitOfWork`). Throws
 * `UNIT_NOT_ACTIVE` for an object the pipeline did not issue.
 */
export function unitContextOf(unit: UnitOfWork): UnitContext {
  return stateOf(unit).context;
}

export const corePlugin: FastifyPluginAsync = async (app) => {
  app.seams.provide('clock', createSystemClock());

  const pipeline = createPipeline({
    pool: () => app.db.pool,
    // Read through the seam each time: a clock that a test puts in place is the one that stamps.
    clock: followClock(() => app.clock),
    log: app.log,
    errorLog: app.errorLog,
    onConnectionLost: () => {
      // A unit lost its connection: not ready from now on, as after an error on an idle
      // connection of the pool. The pool plugin sets the flag off, forgets its last probe result
      // and starts a probe; the flag is on again as soon as the database answers.
      app.db.connectionLost();
    },
    onDatabaseFailure: () => {
      // Readiness follows the pool (ENG-5). The probe reports its own failure and never rejects.
      void app.db.probe({ fresh: true });
    },
  });
  app.seams.provide('pipeline', pipeline);

  const auditWriter: AuditWriter = {
    async append(unit, entry) {
      await stateOf(unit).context.audit.append(entry);
    },
  };
  app.seams.provide('auditWriter', auditWriter);

  registerBootChecks(app);

  // `onClose` hooks run in reverse order of registration: after the engine, the realtime
  // channel and the modules, which may still submit units while they stop, and before the
  // pool's, which closes last (spec §8.6 "Stop": the pipeline is drained, then the pool closes).
  app.addHook('onClose', async () => {
    await pipeline.close();
  });
};
