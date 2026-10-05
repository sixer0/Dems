/**
 * Registration of the boot checks B-2 to B-9 (plan row W21, decision D40; database contract
 * §7.4; spec §8.6 "Start").
 *
 * The checks themselves are the migration row's (`src/db/schema/boot-checks.ts`): pure
 * functions over a pool. This file adds them to the server's boot steps, in the order of the
 * contract and with its failure behaviour:
 *
 *     B-1   the database answers                         the pool plugin (already first)
 *     B-2   server version and encoding                  blocking
 *     B-3   schema version                               blocking
 *     B-4   the runtime role is not privileged           blocking
 *     B-5   the audit and lineage tables are protected   blocking
 *     B-6   the database is seeded                       blocking
 *     B-7   the chain head agrees with the table         blocking
 *     B-8   the stored chain verifies                    REPORTED, never blocking
 *     B-9   the owner role                               blocking
 *
 * Blocking: the step throws, `app.readiness.boot()` rejects with a `BootError` that names the
 * check, and the entry point stops the process with one log line and no listener. Before it
 * throws, the step writes its own line: the check's ID and, for a `BootCheckError`, its text,
 * which names a role, a table, a trigger or a number and never a credential, and which tells
 * the operator the command that fixes it.
 *
 * B-8 cannot be repaired by the server (the database checks links, not digests; GD-01), so a
 * chain that does not verify is logged as an error and the server still starts. The digests are
 * checked with the shared `verifyAuditChain` through the mapping module's
 * `verifyStoredAuditRows` (the one mapping of stored rows to the shared shape, MR-1), passed
 * into the migration row's function.
 *
 * Nothing here runs when the plugin is registered: a step runs only in `boot()`, so the app
 * factory still works without PostgreSQL.
 */
import type { FastifyInstance } from 'fastify';
import { verifyStoredAuditRows } from '../db/mapping';
import { BLOCKING_BOOT_CHECKS, BOOT_CHECK_IDS, BootCheckError, checkStoredChain } from '../db/schema/boot-checks';
import { BOOT_STEP_DATABASE_ANSWERS, DatabaseBootError, RUNTIME_SEARCH_PATH, SEARCH_PATH_NOT_PINNED, SEARCH_PATH_QUESTION } from '../plugins/db';
import { describeError } from '../plugins/logger';
import { BootError } from '../plugins/readiness';

/** The step that is reported and never stops the boot. */
export const REPORTED_BOOT_CHECK = 'B-8';

/** Adds B-2 to B-9 to the boot steps of `app`, in the order of the contract. */
export function registerBootChecks(app: FastifyInstance): void {
  for (const id of BOOT_CHECK_IDS) {
    if (id === REPORTED_BOOT_CHECK) {
      app.readiness.addBootStep({ id, run: () => reportStoredChain(app) });
      continue;
    }
    const check = BLOCKING_BOOT_CHECKS.find((candidate) => candidate.id === id);
    if (check === undefined) throw new Error(`boot check ${id} is not exported by src/db/schema/boot-checks.ts`);
    app.readiness.addBootStep({
      id,
      async run() {
        try {
          await check.run(app.db.pool);
        } catch (error) {
          const description = describeError(error);
          const detail = error instanceof BootCheckError ? error.message : undefined;
          app.log.error(
            { step: id, code: description.code ?? description.errorName, ...(detail === undefined ? {} : { detail }) },
            'boot check failed',
          );
          app.errorLog.append({
            level: 'fatal',
            source: 'core.bootChecks',
            message: detail ?? 'a boot check could not be run',
            ...description,
            context: { step: id, title: check.title },
          });
          throw error;
        }
      },
    });
  }
}

/** B-8. Throws only when the database itself fails. */
async function reportStoredChain(app: FastifyInstance): Promise<void> {
  const report = await checkStoredChain(app.db.pool, { verifyDigests: verifyStoredAuditRows });
  const facts = {
    step: REPORTED_BOOT_CHECK,
    rowsChecked: report.rowsChecked,
    firstSeq: report.firstSeq,
    lastSeq: report.lastSeq,
    linkBreaks: report.linkBreaks,
    digests: report.digests,
    lineage: report.lineage,
  };
  if (report.ok) {
    app.log.info(facts, 'the stored audit chain verifies');
    return;
  }
  app.log.error(
    { ...facts, code: 'STORED_CHAIN_NOT_VERIFIED', problems: report.problems },
    'the stored audit chain does not verify; the server starts, the chain is not repaired',
  );
  app.errorLog.append({
    level: 'error',
    source: 'core.bootChecks',
    message: 'the stored audit chain does not verify',
    code: 'STORED_CHAIN_NOT_VERIFIED',
    context: { ...facts, problems: report.problems.join(' ') },
  });
}

/**
 * THE DATABASE BOOT CHECKS AGAIN: B-1 to B-9, in the order of the contract, on the pool the
 * server has NOW (decision D101; database contract §7.4, §8.5 R-9). For a caller that reopened
 * the pool of a running server (the demo reset): what a start checks, by the same functions, so
 * that there is one list of checks and one way to run each of them.
 *
 *   B-1          the pool plugin's own probe, which also sets `ready.database`; then a connection
 *                of the pool is asked for its search path, which must be the pinned one of the
 *                runtime role (decision D87). The question is the pool plugin's, and its one
 *                column is read by position: the setting is named in that plugin only;
 *   B-2 to B-9   the blocking checks of `registerBootChecks`, and B-8 reported exactly as at a
 *                start (the same two lines; a chain that does not verify never stops the run).
 *
 * Rejects at the first check that does not pass, with a `BootError` that names it (`stepId`)
 * and holds what it threw (`cause`: a `BootCheckError` whose text names a role, a table, a
 * trigger or a number and the command that fixes it; the driver's error for a statement that
 * failed), as `app.readiness.boot()` does.
 *
 * UNLIKE A BOOT STEP IT WRITES NO LINE FOR A CHECK THAT FAILED. At a start the step's own line
 * is all there is before the process stops. Here the server runs and the caller decides what
 * happens next, so the caller reports the failure ONCE, with the check's ID and the error, in
 * the log and in the persistent error log. A caller that drops the rejection drops the report.
 *
 * It adds no boot step, sets no flag but `ready.database` (through the probe) and starts
 * nothing: the engine is the caller's to reload afterwards.
 */
export async function runDatabaseBootChecks(app: FastifyInstance): Promise<void> {
  let step: string = BOOT_STEP_DATABASE_ANSWERS;
  try {
    if (!(await app.db.probe({ fresh: true }))) throw new Error('the database does not answer');
    const answer = await app.db.pool.query<unknown[]>({ text: SEARCH_PATH_QUESTION, rowMode: 'array' });
    if (answer.rows[0]?.[0] !== RUNTIME_SEARCH_PATH) {
      throw new DatabaseBootError(
        SEARCH_PATH_NOT_PINNED,
        `${BOOT_STEP_DATABASE_ANSWERS}: a connection of the pool does not have the search path ${RUNTIME_SEARCH_PATH} of the runtime role.`,
      );
    }

    for (const id of BOOT_CHECK_IDS) {
      step = id;
      if (id === REPORTED_BOOT_CHECK) {
        await reportStoredChain(app);
        continue;
      }
      const check = BLOCKING_BOOT_CHECKS.find((candidate) => candidate.id === id);
      if (check === undefined) throw new Error(`boot check ${id} is not exported by src/db/schema/boot-checks.ts`);
      await check.run(app.db.pool);
    }
  } catch (error) {
    throw new BootError(step, error);
  }
}
