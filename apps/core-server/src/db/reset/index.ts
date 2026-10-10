/**
 * The reset and carry-over routine (plan row W29; hand-built element HB-3; database contract
 * §8.5).
 *
 *   routine.ts      `resetDatabase`: steps R-0 to R-9, every database step as `dems_owner`;
 *   names.ts        which databases a reset may touch, and its database-level statements;
 *   kept-tables.ts  the twelve kept tables: how a row is read, written and compared, unchanged;
 *   real-evidence.ts the R-0 guard: real sealed evidence in the database or on disk refuses the
 *                   reset (`RESET_BLOCKED_REAL_EVIDENCE`; dbc-3 §E.2, OD-19, RK-16);
 *   package-removal.ts the one place that removes a package folder: the containment rule (D133 (2));
 *   plan.ts         the epoch, the lineage row and the SCENARIO_LOADED row, from what R-3 read;
 *   errors.ts       `ResetError`: the code, the step, and whether the target is untouched;
 *   cli.ts          `db:reset` (not re-exported here: it is an entry file).
 *
 * FOR THE SERVER-SIDE CALLER (the demo-control module; operations `resetDemo` and
 * `loadScenario`). The routine is the database half of a reset. Around it the server does the
 * rest of R-1 and R-9 (contract §8.5; spec DC-4, DC-5, HC-2 to HC-4):
 *
 *   before   the permission and the demo flag were checked (DC-1, DC-2). With the flag off the
 *            routine is not called at all: it is the only code of the server that opens the
 *            owner connection file, and it does so at R-0, for one call.
 *
 *   call     await resetDatabase({
 *              database,                       // the instance's own database (it follows the port)
 *              clock: () => app.clock.now(),   // read ONCE by the routine, after the quiesce
 *              actorId,                        // the operator of the request
 *              reason,                         // 'RESET' for resetDemo, 'SCENARIO_LOAD' for loadScenario
 *              scenario,                       // 'idle' for resetDemo
 *              quiesce: async () => {          // R-1, called after R-0 passed
 *                // readiness off (every other request answers 503); the pipeline drained;
 *                // the engine stopped; the hardware snapshot written; the runtime pool CLOSED.
 *              },
 *              log: (entry) => app.log[entry.level]({ code: entry.code, ...entry.details }, entry.message),
 *            });
 *
 *            The routine ends nobody's session. If the runtime pool is still open when `quiesce`
 *            returns, it waits `sessionDrainMs` and then refuses with `RESET_TARGET_IN_USE`.
 *
 *   guard    BEFORE it quiesces, the server-side caller asks `assertNoRealSealedEvidence(client,
 *            { database })` (operation 75 and `loadScenario`; C3 §4 answers 409
 *            `RESET_BLOCKED_REAL_EVIDENCE`). It is the same SELECT-only question the routine asks
 *            at R-3 as `dems_owner`, so the refusal and the audit of the refusal happen while the
 *            server is still serving; the routine's own R-3 run stays authoritative for the
 *            command line, which has no hook to call first (`dbc-3` §E.2; OD-19; RK-16).
 *
 *   resolve  the database behind the name is the NEW one. The routine has released its lock and
 *            closed its connections: the promise settles, resolved or rejected, only after the
 *            driver has closed the owner connection (the server drops the backend from
 *            `pg_stat_activity` a moment later; nothing of the reset depends on that moment). The server opens its runtime pool again, runs the boot
 *            checks B-1 to B-9, rehydrates the engine (the epoch is `report.epoch`), sends a
 *            snapshot to every operator socket, turns readiness on and answers 200 with the
 *            epoch. `report.lineage.appended` holds the values of the one log line of DC-7,
 *            which the routine has already handed to `log`.
 *
 *   reject   a `ResetError`. With `targetUntouched` true (every failure before the swap) the
 *            database is exactly what it was: reopen the pool, turn readiness on, answer 503
 *            `NOT_READY`. `RESET_ROLE_PRIVILEGED` is a configuration defect and was logged with
 *            that code; `RESET_ALREADY_RUNNING` and a refusal at R-0 happen before `quiesce`,
 *            so nothing was stopped. With `targetUntouched` false (the connection was lost while
 *            the swap committed) the name points at the old or at the new database: the boot
 *            checks tell, and the next reset's R-2 removes what is left.
 *
 * The migrate lock of `dems_demo` (P16) is the caller's, as for `db:migrate`: the routine
 * starts no child process. What it takes itself is the advisory lock (442001, slot).
 */
export { RESET_CHECKPOINTS, RESET_STEPS, ResetError, stepOf, type ResetCheckpoint, type ResetErrorCode, type ResetStep } from './errors';
export { KEPT_TABLES, KEPT_TABLE_NAMES, CAPTURE_KEPT_TABLES, type CarryMode, type KeptTable } from './kept-tables';
export {
  DEVELOPMENT_ADAPTER_KINDS,
  MAX_NAMED_SESSIONS,
  REAL_SEALED_EVIDENCE_STATEMENT,
  SOURCE_ROWS_PER_SESSION,
  assertNoRealSealedEvidence,
  classifyRealSealedRows,
  clearedDevelopmentPackages,
  developmentPackagesMessage,
  evaluateRealEvidence,
  findRealSealedEvidence,
  realEvidenceDetails,
  realEvidenceMessage,
  removeClearedDevelopmentPackages,
  type DevelopmentPackageRemoval,
  type DevelopmentPackageRemovalOptions,
  type PackageKeptReason,
  type RealEvidenceFacts,
  type RealSealedEvidenceRow,
  type RealSealedRows,
  type RealEvidenceOptions,
  type RealEvidenceQueryable,
  type DevelopmentItem,
  type SealedSourceMarkReader,
} from './real-evidence';
export { PackageRemovalRefusal, REMOVABLE_PACKAGE_DIRECTORY, removePackageFolder, type PackageFolderRemover, type PackageRemoval } from './package-removal';
export {
  PREVIOUS_SUFFIX,
  PROTECTED_DATABASES,
  RESET_LOCK_CLASS,
  STAGING_SUFFIX,
  guardResetTarget,
  type DisposableDatabase,
  type ResetGuardOptions,
  type ResetTarget,
} from './names';
export { planReset, resolveRequest, scenarioLoadedActivity, type LineageRow, type ResetPlan, type ResetRequest, type SourceFacts } from './plan';
export {
  CONNECTION_CLOSE_WAIT_MS,
  DEFAULT_SESSION_DRAIN_MS,
  RESET_APPLICATION_NAME,
  ROLE_CHECK_STATEMENT,
  resetDatabase,
  type ResetCheckpointContext,
  type ResetInternals,
  type ResetLogEntry,
  type ResetOptions,
  type ResetReport,
} from './routine';
