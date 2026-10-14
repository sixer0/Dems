/**
 * The server side of a demo reset (plan row W43; spec §12.4 DC-4 to DC-7; database contract
 * §8.5 R-1 and R-9; `src/db/reset/index.ts` "for the server-side caller"; engine host §10;
 * decisions D74 DN-5, D77 DN-8, D83 DN-2, D95, D101).
 *
 * `loadScenario` and `resetDemo` rebuild the instance's database through the routine of
 * `src/db/reset`. The routine is the database half (R-0 to R-9, every statement as the owner
 * role). This file is the server half: what is stopped before the routine may touch anything,
 * and what is brought back afterwards. It talks to the server through `ResetHost` only, so the
 * order below is one function that a test can hold against a recording host.
 *
 * THE ORDER, and what is true after each step:
 *
 *    1  one reset at a time      a second call of this server is refused at once, before the
 *                                routine is asked: nothing of the first is disturbed
 *    1b the caller-side guard    `dbc-3` §E.2, asked on the server's OWN pool BEFORE the routine
 *       (integration pass D11)   and so before the quiesce: a REAL sealed package in the database
 *                                or on disk refuses here. NOTHING is stopped, the epoch does not
 *                                move, ONE audit row records the refusal, the answer is 409. The
 *                                routine's own pass at R-3 stays the authoritative one
 *    2  the routine, R-0         the name guard, the owner file, the role check, the advisory
 *                                lock. A refusal here has stopped nothing: the answer is 503 and
 *                                the server never noticed
 *    3  quiesce (the routine     a  hold        every other request answers 503 `NOT_READY`
 *       calls it at R-1)         b  drain       no unit of work runs or waits
 *                                c  roles       who holds which role, read while no writer can run
 *                                d  engine stop no tick, no command; the last snapshot is written
 *                                e  pool closed no connection of the runtime role is left
 *    4  the routine, R-1 to R-9  the database behind the name is rebuilt and swapped in, or the
 *                                routine rejects and the name still points at what it was
 *    5  resume, whenever step    a  pool reopened    the runtime role, on the name
 *       3d was reached           b  boot checks      B-1 to B-9 pass on what the name points at
 *                                c  matrix reloaded  the stored roles and grants are the shared ones
 *                                d  engine back      after a reset that HAPPENED: reloaded with the
 *                                                    stored epoch AS IT IS (the routine wrote
 *                                                    previous + 1). After one that did NOT:
 *                                                    resynchronised, which is the stored epoch
 *                                                    plus 1. Either way a NEW epoch is published
 *    6  release                  requests are served again: only when step 5 passed as a whole,
 *                                or when nothing was stopped
 *    7  publications, answer     the operators whose role the seed put back; then 200 with the
 *                                routine's epoch, or 503
 *
 * FAILURES. Whatever the routine rejects with, step 5 runs when step 3d was reached, and only
 * then: a reset restores exactly what it stopped itself. With the database untouched the engine
 * comes back on the state it had; if the swap's outcome is unknown, the boot checks and the
 * engine take whichever database the name points at.
 *
 * THE EPOCH (spec §12.4, AC-B-57; decisions D74 DN-5, D101). A reset that happened raises the
 * epoch by exactly 1: the routine wrote previous + 1 and the engine's reload adds nothing. A
 * reset that FAILED after the engine was stopped raises it by 1 as well, although nothing was
 * reset: the engine restarts its revisions at 0, and within one epoch a revision only grows, so
 * the clients must not be shown the epoch they hold again. The engine's resync start does that
 * (the stored epoch plus 1, nothing else touched), and one log line says that the epoch moved
 * without a reset. A reset that was refused before anything was stopped moves nothing.
 *
 * IF STEP 5 ITSELF FAILS the server does NOT go back to serving: a boot check did not pass, the
 * stored matrix is not the shared one (`STORED_MATRIX_MISMATCH`, `STORED_GRANTS_MISMATCH`: after
 * a reset the database is the seed's, so the build went wrong), or the engine did not come back.
 * The hold is KEPT, so every request but health answers 503 `NOT_READY` whatever the two
 * readiness flags say; one error line and one fatal entry of the error log name the step and the
 * code and say how the server recovers: it is started again, and a start runs the boot checks.
 *
 * THE ANSWER of every failure is 503 `NOT_READY` (spec §7.2: "demo reset in progress"), with
 * `details.reason` `RESET_IN_PROGRESS` (another reset holds the database: try again) or
 * `RESET_FAILED` (this reset did not happen: the server log says why). The routine's own code
 * and step go to the log and to the persistent error log, never into the answer.
 * ONE EXCEPTION (C3 §3 ops 72 / 75, §4; integration pass D10): the reset guard's refusal - a REAL
 * sealed package exists and a reset would destroy it - is `409 RESET_BLOCKED_REAL_EVIDENCE`. It is
 * a refusal of the request, not a failed reset: nothing was rebuilt, and trying again changes
 * nothing while the evidence exists.
 * Since integration pass D11 that refusal is made at step 1b, before anything is stopped, and it
 * is AUDITED as the contract says ("refuses ... and audits the refusal"): one `ACCESS_DENIED` row
 * with the operator as actor, `details.operationId` and `details.reason:
 * RESET_BLOCKED_REAL_EVIDENCE` (the contract names no type of its own for it; the denial row is
 * the one type whose rule carries an operation and a reason code). A row that could not be written
 * is in the error log; the refusal stands. A guard that could not be ASKED refuses with the 503 of
 * a reset that did not happen: the server never rebuilds on an answer it does not have. The 409
 * after the routine's own refusal (R-3) is kept for the case that evidence was sealed between the
 * two looks; that path stops and resumes the server as before.
 *
 * CREDENTIALS. Nothing here opens, receives or keeps a credential. The routine reads the owner
 * connection file itself, at R-0, into a local variable of its one call (HC-3); this file hands
 * it the DIRECTORY the configuration names, and gets a report of counts and integrity values.
 */
import { ApiErrorCode, DemoRebuildRefusalReason } from '@dems/shared/api';
import type { OperatorRole, Permission, ScenarioName } from '@dems/shared/sim';
import { OperatorRole as OperatorRoles, Permission as Permissions } from '@dems/shared/sim';
import type { FastifyBaseLogger } from 'fastify';
import { ResetError, realEvidenceDetails, type RealEvidenceFacts, type ResetOptions, type ResetReport } from '../../db/reset';
import { ApiFailure, EnvelopeCode } from '../../plugins/error-envelope';
import { describeError, type ErrorLogEntry } from '../../plugins/logger';
import type { Publication } from '../../realtime';
import { RESET_REASON_OF_OPERATION, type ResetOperation } from './operations';

/** The reset routine of the database, as this module calls it: one argument, no test seam. */
export type ResetRoutine = (options: ResetOptions) => Promise<ResetReport>;

/** One stored operator and the role the table gives it. */
export interface OperatorRoleRow {
  readonly id: string;
  readonly role: string;
}

/** One stored grant: the role holds the permission. In the order of the stored matrix. */
export interface GrantRow {
  readonly role: string;
  readonly permission: string;
}

/**
 * What a reset needs of the server. Every member is bound to a seam of the app in `host.ts`;
 * a test passes a recording stand-in.
 */
export interface ResetHost {
  /** The instance's own database: the one name the routine is asked to reset. */
  readonly database: string;
  /** The directory of the connection files. The routine, and only it, opens the owner file there. */
  readonly dataDir: string;
  /**
   * The media root of this server's configuration: where its sealing writes the packages. Both
   * reset guards read THIS directory, and the removal of a permitted reset works below it
   * (decision D165) - never a directory derived from the data directory.
   */
  readonly mediaStoreDir: string;
  /** The server clock. The routine reads it once, after the quiesce. */
  now(): number;
  /** The engine's epoch. */
  epoch(): number;
  routine: ResetRoutine;
  /**
   * The caller-side guard of `dbc-3` §E.2, on the server's own pool: both sides (the tables, the
   * evidence store) of this instant. A read; it stops nothing. Rejects when it could not be asked.
   */
  realEvidence(): Promise<RealEvidenceFacts>;
  /** The audit row of a reset the guard refused: one unit of work, the operator as actor. */
  auditRefusal(refusal: { readonly operation: ResetOperation; readonly actorId: string; /** The paired device that sent the request; null or absent for a web console (D216 (2)). */ readonly deviceId?: string | null; readonly reason: string }): Promise<void>;
  /** Refuses every other request until the returned function is called. */
  hold(): () => void;
  drain(): Promise<void>;
  /** The roles the operators table holds, by operator. A read on the runtime pool. */
  operatorRoles(): Promise<readonly OperatorRoleRow[]>;
  stopEngine(): Promise<void>;
  closePool(): Promise<void>;
  reopenPool(): Promise<void>;
  /** B-1 to B-9 on the reopened pool. Rejects with a `ResumeFailure` that names the check. */
  bootChecks(): Promise<void>;
  /** Reads and checks the stored matrix again; resolves with its grants. */
  reloadMatrix(): Promise<readonly GrantRow[]>;
  /** After a reset that happened: the engine rehydrates and takes the stored epoch as it is. */
  reloadEngine(): Promise<void>;
  /** After a reset that did not happen: the engine rehydrates under a NEW epoch, the stored one plus 1. */
  resyncEngine(): Promise<void>;
  /**
   * Integration pass I-9c (review 120b S2-01 case (c), request line `row NF`): reads the stored camera network
   * settings again into the reader the capture-config module holds in memory - its door
   * `captureNetworkConfigControl(app).reload()`, which never rejects. Asked after the engine is back and BEFORE the
   * hold is released, whether or not the reset happened (the database behind the name may be new). OPTIONAL: this
   * module may not import the capture-config module (rule 5 of `test/static/imports.test.ts`), so the server's host
   * has it only once the composition hands the door in; without it nothing is asked. Since I-9c the reset KEEPS
   * `capture_network_config`, so the row behind the reader is the row it held; the call is the proof, not the carry.
   */
  reloadNetworkFacts?(): Promise<void>;
  publish(publication: Publication): void;
  persist(entry: ErrorLogEntry): void;
}

export interface ResetCall {
  readonly operation: ResetOperation;
  readonly scenario: ScenarioName;
  /** The operator of the request: the actor of the lineage row and of the `SCENARIO_LOADED` row. */
  readonly actorId: string;
  /**
   * The paired device the operator's session is bound to, when a device sent the request; null or
   * absent for a web console session (decision D216 (2): an audit row of an action a paired device
   * sent names that device). It reaches the row of a REFUSED reset only: the lineage row has no
   * device column (schema 6), and the rows of a reset that ran are the routine's.
   */
  readonly deviceId?: string | null;
  /** The request ID: the correlation ID of the log lines and of the error-log entries. */
  readonly requestId: string;
  /** The request's logger. */
  readonly log: FastifyBaseLogger;
}

export interface DemoReset {
  /** True while a reset or a scenario load of this server runs. */
  readonly inFlight: boolean;
  /** Resolves with the routine's report after the server is back. Rejects with the 503 of a refused or failed reset. */
  run(call: ResetCall): Promise<ResetReport>;
}

/**
 * `details.reason` of the 503 of a reset that did not happen: the contract's
 * `DemoRebuildRefusalReason` (W83, gap W43-1; review finding W92-15), under this module's keys.
 */
export const ResetRefusal = {
  /** Another reset of this database is running: in this server, or from the command line. */
  IN_PROGRESS: DemoRebuildRefusalReason.RESET_IN_PROGRESS,
  /** This reset did not happen. The server log names the routine's code and step. */
  FAILED: DemoRebuildRefusalReason.RESET_FAILED,
} as const;
export type ResetRefusal = (typeof ResetRefusal)[keyof typeof ResetRefusal];

/** The name of the readiness hold of a reset; it appears in the two `readiness hold` log lines. */
export const RESET_HOLD_NAME = 'demo-reset';
/** `source` of this file's entries in the persistent error log. */
export const RESET_ERROR_SOURCE = 'demo.reset';

/** The steps of the resume after a reset that happened, in order, as they are named in a log line. */
export const RESUME_STEPS = ['pool.reopen', 'boot.checks', 'rbac.matrix', 'engine.reload'] as const;
/** The last step of the resume after a reset that did NOT happen: it stands where `engine.reload` stands. */
export const RESYNC_STEP = 'engine.resync';
export type ResumeStep = (typeof RESUME_STEPS)[number] | typeof RESYNC_STEP;

/** A step of the resume failed. `step` names it (a boot check by its own ID); `thrown` is what it threw. */
export class ResumeFailure extends Error {
  readonly step: string;
  readonly thrown: unknown;

  constructor(step: string, thrown: unknown) {
    super(`the server could not resume after a demo reset: ${step} failed`);
    this.name = 'ResumeFailure';
    this.step = step;
    this.thrown = thrown;
  }
}

const REQUESTED = 'demo reset requested';
const DONE = 'demo reset done';
const BUSY = 'demo reset refused: another reset of this server is running';
const QUIESCE_FAILED = 'the quiesce of a demo reset failed';
const REFUSED = 'demo reset refused by the routine; nothing was stopped';
const BLOCKED = 'demo reset refused: real sealed evidence exists and a reset would destroy it; nothing was stopped and the epoch did not move';
const GUARD_NOT_ASKED = 'demo reset refused: the real-evidence guard could not be asked; nothing was stopped';
const REFUSAL_NOT_AUDITED = 'the audit row of a refused demo reset could not be written; the reset stays refused';
const FAILED = 'demo reset failed after the server was quiesced; the server is brought back on the database the name points at';
const NEW_EPOCH = 'no reset was completed; the engine was reloaded under a new epoch, so that every client takes a fresh snapshot';
const NOT_RESUMED = 'the server could not resume after a demo reset; it stays not ready and answers 503 to every request but health';
/** How a server that could not resume is brought back; part of the log line and of the error-log entry. */
export const RECOVERY = 'restart the server: a start runs the boot checks';
const EPOCH_MISMATCH = 'the engine did not take the epoch the reset routine wrote';
const ROLES_NOT_READ = 'the operators could not be read after a demo reset; no role change was published';
const NETWORK_FACTS_NOT_RELOADED = 'the camera network settings could not be read again after a demo reset; the reader keeps what it held';
/** The code of the line and the entry above (I-9c). */
export const NETWORK_FACTS_NOT_RELOADED_CODE = 'DEMO_RESET_NETWORK_FACTS_NOT_RELOADED';

function refusal(reason: ResetRefusal): ApiFailure {
  return new ApiFailure(503, EnvelopeCode.NOT_READY, 'The server is not ready. Try again shortly.', { details: { reason } });
}

/** The routine's code of the reset guard (`src/db/reset/real-evidence.ts`): a REAL sealed package exists. */
const REAL_EVIDENCE_REFUSAL = 'RESET_BLOCKED_REAL_EVIDENCE';

/**
 * The answer of a reset the guard refused (C3 §3 ops 72 / 75, §4): `409` with the code of the
 * contract. The message is the contract's sentence; what the guard found (counts, places) went to
 * the log with the routine's own line and never into the answer.
 */
function blockedByRealEvidence(): ApiFailure {
  return new ApiFailure(409, ApiErrorCode.RESET_BLOCKED_REAL_EVIDENCE, 'The demo reset is blocked because real sealed evidence exists.');
}

/** The code of a failure for the log: the routine's own, else the error's code or its name. */
function codeOf(thrown: unknown): string {
  if (thrown instanceof ResetError) return thrown.code;
  const description = describeError(thrown);
  return description.code ?? description.errorName;
}

/** What may be said about a failed routine: its code, its step, and what the server answered. Names only. */
function routineFacts(thrown: unknown): Record<string, string | boolean | null> {
  if (!(thrown instanceof ResetError)) return { routineCode: codeOf(thrown), routineStep: null, targetUntouched: null };
  return {
    routineCode: thrown.code,
    routineStep: thrown.step,
    targetUntouched: thrown.targetUntouched,
    ...(thrown.sqlState === undefined ? {} : { sqlState: thrown.sqlState }),
    ...(thrown.constraint === undefined ? {} : { constraint: thrown.constraint }),
    ...(thrown.table === undefined ? {} : { table: thrown.table }),
  };
}

const ROLES: readonly string[] = Object.values(OperatorRoles);
const PERMISSIONS: readonly string[] = Object.values(Permissions);
const isRole = (value: string): value is OperatorRole => ROLES.includes(value);
const isPermission = (value: string): value is Permission => PERMISSIONS.includes(value);

/**
 * The operators whose stored role differs between two readings, with the role they have now and
 * what that role may do by the stored matrix. An operator that only one reading holds is left
 * out: the seed creates and removes none (DA-08).
 */
export function roleChanges(
  before: readonly OperatorRoleRow[],
  after: readonly OperatorRoleRow[],
  grants: readonly GrantRow[],
): Array<{ operatorId: string; role: OperatorRole; permissions: Permission[] }> {
  const was = new Map(before.map((operator) => [operator.id, operator.role] as const));
  const changes: Array<{ operatorId: string; role: OperatorRole; permissions: Permission[] }> = [];
  for (const operator of after) {
    const previous = was.get(operator.id);
    const role = operator.role;
    if (previous === undefined || previous === role || !isRole(role)) continue;
    const permissions = grants.filter((grant) => grant.role === role).map((grant) => grant.permission);
    changes.push({ operatorId: operator.id, role, permissions: permissions.filter(isPermission) });
  }
  return changes;
}

export function createDemoReset(host: ResetHost): DemoReset {
  let inFlight = false;

  async function perform(call: ResetCall): Promise<ResetReport> {
    const { log } = call;
    const who = { operation: call.operation, operatorId: call.actorId, scenario: call.scenario };
    const context = { requestId: call.requestId, ...who };
    const epochBefore = host.epoch();

    /** What the quiesce reached. A closure writes it, so it lives on an object. */
    const quiesced: {
      release: (() => void) | null;
      /** Step 3d was reached: the engine is stopped, or stopping. From here on the server must be resumed. */
      stopped: boolean;
      roles: readonly OperatorRoleRow[] | null;
    } = { release: null, stopped: false, roles: null };

    log.info(who, REQUESTED);

    // Step 1b (integration pass D11): the guard is asked FIRST. A refusal here has stopped nothing.
    let evidence: RealEvidenceFacts;
    try {
      evidence = await host.realEvidence();
    } catch (error) {
      log.warn({ err: error, code: 'DEMO_RESET_GUARD_NOT_ASKED', ...who }, GUARD_NOT_ASKED);
      host.persist({ level: 'error', source: RESET_ERROR_SOURCE, message: GUARD_NOT_ASKED, ...describeError(error), code: 'DEMO_RESET_GUARD_NOT_ASKED', context: { ...context, epochBefore } });
      throw refusal(ResetRefusal.FAILED);
    }
    if (evidence.blocked) {
      // Counts and names only (DC-7): what the guard found goes to the log, never into the answer.
      const found = realEvidenceDetails(evidence);
      log.warn({ code: REAL_EVIDENCE_REFUSAL, ...who, ...found, epochBefore, quiesced: false }, BLOCKED);
      host.persist({ level: 'warn', source: RESET_ERROR_SOURCE, message: BLOCKED, code: REAL_EVIDENCE_REFUSAL, context: { ...context, ...found, epochBefore, quiesced: false } });
      try {
        await host.auditRefusal({ operation: call.operation, actorId: call.actorId, ...(typeof call.deviceId === 'string' ? { deviceId: call.deviceId } : {}), reason: REAL_EVIDENCE_REFUSAL });
      } catch (error) {
        log.error({ err: error, code: 'DEMO_RESET_REFUSAL_NOT_AUDITED', ...who }, REFUSAL_NOT_AUDITED);
        host.persist({ level: 'error', source: RESET_ERROR_SOURCE, message: REFUSAL_NOT_AUDITED, ...describeError(error), code: 'DEMO_RESET_REFUSAL_NOT_AUDITED', context });
      }
      throw blockedByRealEvidence();
    }

    let report: ResetReport | null = null;
    let thrown: unknown;
    let rejected = false;
    try {
      report = await host.routine({
        database: host.database,
        dataDir: host.dataDir,
        evidenceStoreDir: host.mediaStoreDir,
        clock: () => host.now(),
        actorId: call.actorId,
        reason: RESET_REASON_OF_OPERATION[call.operation],
        scenario: call.scenario,
        quiesce: async () => {
          try {
            quiesced.release = host.hold();
            await host.drain();
            quiesced.roles = await host.operatorRoles();
            quiesced.stopped = true;
            await host.stopEngine();
            await host.closePool();
          } catch (error) {
            // The routine turns this into RESET_QUIESCE_FAILED and drops what was thrown.
            log.error({ err: error, ...who }, QUIESCE_FAILED);
            host.persist({ level: 'error', source: RESET_ERROR_SOURCE, message: QUIESCE_FAILED, ...describeError(error), context });
            throw error;
          }
        },
        log: (entry) => log[entry.level]({ code: entry.code, ...entry.details }, entry.message),
      });
    } catch (error) {
      rejected = true;
      thrown = error;
      const facts = routineFacts(error);
      const running = error instanceof ResetError && error.code === 'RESET_ALREADY_RUNNING';
      if (quiesced.stopped) log.error({ err: error, ...who, ...facts }, FAILED);
      else log.warn({ err: error, ...who, ...facts }, REFUSED);
      host.persist({
        level: quiesced.stopped ? 'error' : 'warn',
        source: RESET_ERROR_SOURCE,
        message: quiesced.stopped ? FAILED : REFUSED,
        ...describeError(error),
        code: codeOf(error),
        context: { ...context, ...facts, alreadyRunning: running },
      });
    }

    let grants: readonly GrantRow[] = [];
    if (quiesced.stopped) {
      let step: ResumeStep = 'pool.reopen';
      try {
        await host.reopenPool();
        step = 'boot.checks';
        await host.bootChecks();
        step = 'rbac.matrix';
        grants = await host.reloadMatrix();
        // Decision D101: the routine's epoch as it is after a reset that happened; a new epoch
        // after one that did not, because the engine's revisions start at 0 again.
        if (rejected) {
          step = RESYNC_STEP;
          await host.resyncEngine();
        } else {
          step = 'engine.reload';
          await host.reloadEngine();
        }
      } catch (error) {
        // The database behind the name could not be verified, or the engine did not come back
        // on it. The server must not serve on that: the hold is KEPT, so every request but
        // health answers 503 until the process is started again, and a start runs the boot
        // checks. The code is a plain field of the line (for the stored matrix:
        // STORED_MATRIX_MISMATCH or STORED_GRANTS_MISMATCH).
        const failure = error instanceof ResumeFailure ? error : new ResumeFailure(step, error);
        const code = codeOf(failure.thrown);
        log.error({ err: failure.thrown, ...who, step: failure.step, code, epochBefore, serving: false, recovery: RECOVERY }, NOT_RESUMED);
        host.persist({
          level: 'fatal',
          source: RESET_ERROR_SOURCE,
          message: NOT_RESUMED,
          ...describeError(failure.thrown),
          code,
          context: { ...context, step: failure.step, epochBefore, routine: rejected ? codeOf(thrown) : 'done', serving: false, recovery: RECOVERY },
        });
        throw refusal(ResetRefusal.FAILED);
      }
      // I-9c: the camera network reader follows the database behind the name, before any request is served. Its door
      // never rejects (a failed read leaves it at "not configured" with its own entry); a stand-in that throws is
      // stated here and does not fail a reset whose server is otherwise whole.
      if (host.reloadNetworkFacts !== undefined) {
        try {
          await host.reloadNetworkFacts();
        } catch (error) {
          log.warn({ err: error, code: NETWORK_FACTS_NOT_RELOADED_CODE, ...who }, NETWORK_FACTS_NOT_RELOADED);
          host.persist({ level: 'warn', source: RESET_ERROR_SOURCE, message: NETWORK_FACTS_NOT_RELOADED, ...describeError(error), code: NETWORK_FACTS_NOT_RELOADED_CODE, context });
        }
      }
    }
    // The server is whole again, or nothing of it was stopped: requests are served.
    quiesced.release?.();
    if (rejected && quiesced.stopped) {
      log.info({ code: 'DEMO_RESET_NEW_EPOCH', ...who, epochBefore, epoch: host.epoch(), ...routineFacts(thrown) }, NEW_EPOCH);
    }

    // The server is back. Whatever database the name points at, the operators are what it holds.
    if (quiesced.stopped && quiesced.roles !== null) {
      try {
        for (const change of roleChanges(quiesced.roles, await host.operatorRoles(), grants)) {
          host.publish({ kind: 'session.updated', ...change });
        }
      } catch (error) {
        log.warn({ err: error, ...who }, ROLES_NOT_READ);
        host.persist({ level: 'warn', source: RESET_ERROR_SOURCE, message: ROLES_NOT_READ, ...describeError(error), context });
      }
    }

    if (rejected || report === null) {
      // The reset guard's refusal (real sealed evidence exists) is an answer of its own, not a
      // reset that failed: 409 with the documented code (C3 §3 op 75, §4; pass D6 finding F-D6-1).
      if (thrown instanceof ResetError && thrown.code === REAL_EVIDENCE_REFUSAL) throw blockedByRealEvidence();
      const running = thrown instanceof ResetError && thrown.code === 'RESET_ALREADY_RUNNING';
      throw refusal(running ? ResetRefusal.IN_PROGRESS : ResetRefusal.FAILED);
    }

    const epoch = host.epoch();
    if (epoch !== report.epoch) {
      log.error({ code: 'DEMO_EPOCH_MISMATCH', ...who, routineEpoch: report.epoch, engineEpoch: epoch }, EPOCH_MISMATCH);
      host.persist({
        level: 'error',
        source: RESET_ERROR_SOURCE,
        message: EPOCH_MISMATCH,
        code: 'DEMO_EPOCH_MISMATCH',
        context: { ...context, routineEpoch: report.epoch, engineEpoch: epoch },
      });
    }

    // The lists of the portal changed under their readers: the operators are the seed's again,
    // and a pairing code that was ACTIVE is closed. A reader fetches them again.
    host.publish({ kind: 'admin.changed', resource: 'USERS' });
    if (report.cancelledPairingCodes > 0) host.publish({ kind: 'admin.changed', resource: 'PAIRING_CODE' });

    log.info(
      {
        ...who,
        previousEpoch: report.previousEpoch,
        epoch: report.epoch,
        auditHeadSeq: report.auditHead.seq,
        lineageRows: report.lineage.total,
        cancelledPairingCodes: report.cancelledPairingCodes,
        previousDropped: report.previousDropped,
        totalMs: Math.round(report.totalMs),
      },
      DONE,
    );
    return report;
  }

  return {
    get inFlight() {
      return inFlight;
    },
    async run(call) {
      if (inFlight) {
        call.log.warn({ code: 'DEMO_RESET_IN_PROGRESS', operation: call.operation, operatorId: call.actorId }, BUSY);
        throw refusal(ResetRefusal.IN_PROGRESS);
      }
      inFlight = true;
      try {
        return await perform(call);
      } finally {
        inFlight = false;
      }
    },
  };
}
