/**
 * What operations 109 and 110 do (task 4 blueprint row 117, package WP-26b; contract
 * `packages/shared/src/api/installation-acceptance.ts`, row 116; schema set C, row 114; decisions
 * U10, U11 (OQ-2), C2, C61 (2), C80; security finding S13-13).
 *
 * OPERATION 109 `acceptInstallation`, in this order, each refusal storing NOTHING and writing NO
 * audit row (the body was held to its strict schema before this file is reached: `422`):
 *
 *   409 CAPTURE_CONFIG_LOCKED                                   a session is open (asked before the unit and again inside it)
 *   409 INVALID_STATE  INSTALLATION_DIAGNOSTICS_NOT_COMPLETE    the Core holds no diagnostics run, or one that has not ended
 *   409 INVALID_STATE  INSTALLATION_DIAGNOSTICS_NOT_STORABLE    the Core's own run does not fit the record after its texts were
 *                                                               made one line (a member outside the closed key lists, a size)
 *   409 INVALID_STATE  INSTALLATION_SITE_NOT_STORABLE           the Core's id, name, room or version is outside its one-line
 *                                                               bound (never cut: it is a point-in-time copy)
 *   409 INVALID_STATE  INSTALLATION_ACCEPTANCE_IN_FORCE         THE DATABASE refused the row: one is in force (23505 by
 *                                                               `installation_acceptances_in_force_key`)
 *   409 INVALID_STATE  INSTALLATION_CLOCK_BEHIND_RECORD         THE STATEMENT wrote nothing: a stored instant is later than
 *                                                               the clock of the Core (row V6b, R119-08; the contract lists
 *                                                               the reason for 109 since row R1b, answered since pass I-9b).
 *                                                               Told apart from "in force" by the statement's own result:
 *                                                               an error 23505 is the index, an empty RETURNING the guard
 *   422 INVALID_INPUT  INSTALLATION_STEPS_NOT_THE_LIST          the steps are not the contract's closed list, each check
 *                                                               once (row V6, R119-07); judged first, before the idle lock
 *   200                                                      ONE unit of work: the row and ONE INSTALLATION_ACCEPTED entry
 *
 * OPERATION 110 `revokeInstallationAcceptance`:
 *
 *   409 CAPTURE_CONFIG_LOCKED                                   a session is open
 *   409 INVALID_STATE  INSTALLATION_ACCEPTANCE_NOT_IN_FORCE     the ONE statement changed no row: none is in force
 *   409 INVALID_STATE  INSTALLATION_CLOCK_BEHIND_RECORD         THE DATABASE refused the statement by
 *                                                               `installation_acceptances_revoked_at_check` (23514): the
 *                                                               clock reads earlier than the acceptance (row V6, R119-08);
 *                                                               no value is named, nothing is persisted as a defect
 *   200                                                         ONE unit of work: the three revoke columns of the row in
 *                                                               force and ONE INSTALLATION_ACCEPTANCE_REVOKED entry
 *
 * "ONE IN FORCE" IS NEVER ASKED HERE. No statement of this folder reads whether an acceptance is
 * in force before it writes: a question followed by a write is a race between two requests. The
 * INSERT is sent, and the database's index answers; the UPDATE is sent, and its row count answers.
 * The INSERT's own condition (row V6b) reads the stored INSTANTS, inside the one statement, and
 * never whether a row is in force: with no row answered, the clock is behind the record.
 * An acceptance in force is therefore the LAST refusal of operation 109, after the Core's own facts.
 *
 * WHAT THE CLIENT DOES NOT SEND. Who (the operator of the session), when (the server clock), the
 * software version (the constant of this Core), the copy of the Core's id, name and room, and the
 * diagnostics run are read HERE, from the state the unit sees. The diagnostics are the Core's own
 * copy (decision C80): each `label`, `detail` and text value of `params` is made one line of at
 * most 200 characters, then the whole run is held to the contract's closed key lists. Nothing of
 * the run is dropped silently: a member the lists do not name refuses the acceptance.
 *
 * THE AUDIT ENTRIES name the record and counts: `acceptanceId`, `stepCount`, `passedCount`; the
 * revocation `acceptanceId` only. Never a step, a site text, a diagnostics text or the typed
 * reason - those stay in the table row.
 *
 * RECORDING IS NOT GATED ON AN ACCEPTANCE (design addendum section 10, item 6). Nothing outside
 * this folder reads the table, and this folder reads it only through the answer of its own writes.
 *
 * A DATABASE ERROR THAT IS NOT THE IN-FORCE ANSWER (a CHECK of the table, 23514, included) is a
 * defect, not a refusal: the contract's bounds are the table's. It is written to the persistent
 * error log with its SQLSTATE and constraint name and leaves as it is (`500`); nothing is stored.
 *
 * No refusal and no log line of this file quotes a step, an address, a reason or a device text.
 */
import {
  ApiErrorCode,
  INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES,
  INSTALLATION_STEP_LIST_RULE_MESSAGE,
  InstallationAcceptRequestSchema,
  InstallationAcceptanceDiagnosticsSchema,
  InstallationAcceptanceReason,
  InstallationAcceptanceSchema,
  InstallationAcceptanceStepResult,
  installationAcceptanceTextOf,
  type InstallationAcceptRequest,
  type InstallationAcceptance,
  type InstallationAcceptanceDiagnostics,
  type InstallationAcceptanceRevokeRequest,
} from '@dems/shared/api';
import { AuditType, Permission, type DiagnosticsRun } from '@dems/shared/sim';
import type { AuditEntry } from '../../../core';
import { ApiFailure } from '../../../plugins/error-envelope';
import { isClockBehindViolation, isInForceViolation, type AcceptanceWrite, type InstallationAcceptanceStore, type Queryable, type StoredAcceptance } from './store';

/** The operator behind a request, as stage 4 resolved it. */
export interface InstallationAcceptanceCaller {
  readonly operatorId: string;
  readonly deviceId: string | null;
}

/** The Core's own facts an acceptance copies, as the state of the unit holds them. */
export interface InstallationFacts {
  /** `core_device`: the id, the name and the room of this Core. */
  readonly device: { readonly id: string; readonly name: string; readonly room: string };
  /** The newest diagnostics run, or null when none was ever started. */
  readonly diagnostics: DiagnosticsRun | null;
}

/** The unit of work of an operation, as far as this file uses it. `index.ts` builds it on a unit of the engine. */
export interface InstallationAcceptanceUnit {
  readonly db: Queryable;
  /** True when a session is open in the state this unit sees. */
  sessionOpen(): boolean;
  /** The Core's own facts in the state this unit sees. */
  facts(): InstallationFacts;
  audit(entry: AuditEntry): Promise<void>;
}

export interface InstallationAcceptanceHost {
  now(): number;
  /** The software version of this Core: its one constant. */
  softwareVersion(): string;
  sessionOpen(): boolean;
  /** One unit of work: everything `work` writes commits together or not at all. Rejects with what `work` threw. */
  unit<Value>(label: string, work: (unit: InstallationAcceptanceUnit) => Promise<Value>): Promise<Value>;
  /** A line of the log: codes, the record id and counts only. */
  note(fields: Record<string, unknown>, message: string): void;
  /** A failure for the log AND the persistent error log. */
  failed(source: string, message: string, error: unknown): void;
}

export interface InstallationAcceptanceSeams {
  readonly host: InstallationAcceptanceHost;
  readonly store: InstallationAcceptanceStore;
}

export const INSTALLATION_ACCEPT_UNIT_LABEL = 'installationAcceptance.accept';
export const INSTALLATION_REVOKE_UNIT_LABEL = 'installationAcceptance.revoke';
export const INSTALLATION_ACCEPTED_MESSAGE = 'Installation accepted';
export const INSTALLATION_ACCEPTANCE_REVOKED_MESSAGE = 'Installation acceptance revoked';
const SOURCE = 'installationAcceptance';
const WRITE_FAILED = 'the installation acceptance could not be written: the database refused the statement for a reason that is not "one is in force"; nothing was stored';
const REVOKE_FAILED = 'the installation acceptance could not be revoked: the database refused the statement; nothing was changed';

// ── Refusals: fixed texts that quote nothing of the request ────────────────────────────────────

const R = InstallationAcceptanceReason;
const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, 'The capture configuration cannot be changed while a session is open.');
const refused = (reason: InstallationAcceptanceReason): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES[reason], { details: { reason } });

// ── The Core's own facts ───────────────────────────────────────────────────────────────────────

/** A text of the Core's own run made storable: one line, at most 200 characters. Anything that is no text is left as it is. */
const storable = (value: unknown): unknown => (typeof value === 'string' ? installationAcceptanceTextOf(value) : value);

/** The `params` of a check with every text value made storable. A member without a value is not sent, so it is not kept. */
function paramsOf(params: unknown): unknown {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) return params;
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, storable(value)]),
  );
}

/**
 * THE CORE'S OWN COPY OF ITS DIAGNOSTICS RUN, held to the contract: null when the run cannot be
 * stored. Every member of the run and of each check is carried (none is dropped), so a member the
 * closed key lists do not name is refused by the strict schema instead of being lost.
 */
export function storableDiagnosticsOf(run: DiagnosticsRun): InstallationAcceptanceDiagnostics | null {
  const candidate = {
    ...run,
    checks: run.checks.map((check) => {
      const { params, resolvesAt, ...rest } = check;
      return {
        ...rest,
        label: storable(check.label),
        detail: storable(check.detail),
        ...(params === undefined ? {} : { params: paramsOf(params) }),
        ...(resolvesAt === undefined ? {} : { resolvesAt }),
      };
    }),
  };
  const parsed = InstallationAcceptanceDiagnosticsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

const SITE = InstallationAcceptanceSchema.shape;
/** True when the four copies fit their one-line bounds: the contract's own rules for the stored record. */
function siteStorable(write: Pick<AcceptanceWrite, 'softwareVersion' | 'coreDeviceId' | 'siteName' | 'room'>): boolean {
  return (
    SITE.softwareVersion.safeParse(write.softwareVersion).success &&
    SITE.coreDeviceId.safeParse(write.coreDeviceId).success &&
    SITE.siteName.safeParse(write.siteName).success &&
    SITE.room.safeParse(write.room).success
  );
}

// ── The answer ─────────────────────────────────────────────────────────────────────────────────

/** The body of operations 109 and 110 from the stored row. The route's response schema holds it to the contract. */
export function installationAcceptanceOf(stored: StoredAcceptance): InstallationAcceptance {
  return {
    acceptanceId: stored.id,
    acceptedAt: stored.acceptedAt,
    acceptedBy: stored.acceptedBy,
    softwareVersion: stored.softwareVersion,
    coreDeviceId: stored.coreDeviceId,
    siteName: stored.siteName,
    room: stored.room,
    siteAddress: stored.siteAddress,
    // As stored: the checks of the closed list - or, for a record stored before the list, the steps of the first contract.
    steps: stored.steps as InstallationAcceptance['steps'],
    diagnostics: stored.diagnostics as InstallationAcceptanceDiagnostics,
    revokedAt: stored.revokedAt,
    revokedBy: stored.revokedBy,
    revokeReason: stored.revokeReason,
  };
}

// ── Operation 109 ──────────────────────────────────────────────────────────────────────────────

/**
 * THE STEP LIST IS THE CONTRACT'S (row V6; caution R119-07, decision C94 (h)). The route held the
 * body to the request schema before this file is reached; the steps are held to it HERE AGAIN, so
 * that no caller of this function - a route of another form, a test, a later module - stores steps
 * a client chose: every check of the closed list exactly once, each with a result of the closed
 * set and a note where one is required. Anything else is the contract's own `422`, quoting nothing.
 */
const STEPS = InstallationAcceptRequestSchema.shape.steps;
const stepsRefused = (): ApiFailure => new ApiFailure(422, ApiErrorCode.INVALID_INPUT, INSTALLATION_STEP_LIST_RULE_MESSAGE, { details: { in: 'body', reason: INSTALLATION_STEPS_NOT_THE_LIST } });
/** `details.reason` of the `422` of a step list that is not the contract's. */
export const INSTALLATION_STEPS_NOT_THE_LIST = 'INSTALLATION_STEPS_NOT_THE_LIST';

/**
 * THE REASON OPERATION 109 ANSWERS FOR A CLOCK BEHIND THE STORED RECORD (row V6b; caution R119-08,
 * decision C105 (5)) - a DRIVER DECISION, to be moved by ONE contract step. The contract lists
 * `INSTALLATION_CLOCK_BEHIND_RECORD` for operation 110 only; the 409 of operation 109 names five
 * reasons and this row may not edit the contract. The nearest of the five is answered: the stored
 * record refuses a new acceptance. It is exact when the later instant is the acceptance in force,
 * and NOT exact when it is an earlier record's revocation (none is in force then): the log line of
 * that refusal names the true cause. When the contract lists the clock reason for operation 109,
 * this constant becomes `InstallationAcceptanceReason.INSTALLATION_CLOCK_BEHIND_RECORD`.
 *
 * PASS I-9b: THE CONTRACT LISTS IT (row R1b), so the interim above is over and the true reason is
 * answered. The two refusals cannot be confused: the statement answers "one is in force" as the
 * ERROR 23505 of the in-force index (caught above this constant's one use) and "the clock is
 * behind" as NO ROW from its own condition. A clock behind an acceptance that IS in force never
 * reaches the index (the condition writes nothing first), and it is the clock reason that is true
 * of it: correcting the clock is what the technician has to do before anything else.
 */
const ACCEPT_CLOCK_BEHIND_REASON = InstallationAcceptanceReason.INSTALLATION_CLOCK_BEHIND_RECORD;

export async function acceptInstallation(seams: InstallationAcceptanceSeams, caller: InstallationAcceptanceCaller, body: InstallationAcceptRequest): Promise<InstallationAcceptance> {
  const { host, store } = seams;
  const steps = STEPS.safeParse(body.steps);
  if (!steps.success) throw stepsRefused();
  if (host.sessionOpen()) throw locked();

  const stored = await host.unit(INSTALLATION_ACCEPT_UNIT_LABEL, async (unit) => {
    // A session that opened meanwhile: idle only.
    if (unit.sessionOpen()) throw locked();

    const facts = unit.facts();
    const run = facts.diagnostics;
    if (run === null || run.completedAt === null) throw refused(R.INSTALLATION_DIAGNOSTICS_NOT_COMPLETE);
    const diagnostics = storableDiagnosticsOf(run);
    if (diagnostics === null) throw refused(R.INSTALLATION_DIAGNOSTICS_NOT_STORABLE);

    const write: AcceptanceWrite = {
      acceptedAt: host.now(),
      acceptedBy: caller.operatorId,
      softwareVersion: host.softwareVersion(),
      coreDeviceId: facts.device.id,
      siteName: facts.device.name,
      room: facts.device.room,
      siteAddress: body.siteAddress ?? null,
      steps: steps.data,
      diagnostics,
    };
    if (!siteStorable(write)) throw refused(R.INSTALLATION_SITE_NOT_STORABLE);

    let row: StoredAcceptance | null;
    try {
      row = await store.insert(unit.db, write);
    } catch (error) {
      // THE DATABASE'S ANSWER: one is in force. The unit is lost with the statement; it is left by this refusal.
      if (isInForceViolation(error)) throw refused(R.INSTALLATION_ACCEPTANCE_IN_FORCE);
      host.failed(`${SOURCE}.accept`, WRITE_FAILED, error);
      throw error;
    }
    // THE STATEMENT WROTE NOTHING (row V6b, R119-08): a stored instant is later than this clock. Nothing is stored, no
    // entry is written, no instant is bent, nothing is persisted as a defect; one line at warning level names the cause.
    if (row === null) {
      host.note({ code: R.INSTALLATION_CLOCK_BEHIND_RECORD, source: SOURCE, level: 'warn' }, 'installation not accepted: the clock is behind the stored record');
      throw refused(ACCEPT_CLOCK_BEHIND_REASON);
    }

    await unit.audit({
      type: AuditType.INSTALLATION_ACCEPTED,
      message: INSTALLATION_ACCEPTED_MESSAGE,
      actorId: caller.operatorId,
      deviceId: caller.deviceId,
      details: {
        acceptanceId: row.id,
        stepCount: steps.data.length,
        passedCount: steps.data.filter((step) => step.result === InstallationAcceptanceStepResult.PASS).length,
        operationId: 'acceptInstallation',
        permission: Permission.CAPTURE_COMMISSION,
      },
    });
    return row;
  });

  // The record id and counts. Never a step, a site text or a diagnostics text.
  host.note({ code: AuditType.INSTALLATION_ACCEPTED, source: SOURCE, acceptanceId: stored.id, stepCount: steps.data.length }, 'installation accepted');
  return installationAcceptanceOf(stored);
}

// ── Operation 110 ──────────────────────────────────────────────────────────────────────────────

export async function revokeInstallationAcceptance(seams: InstallationAcceptanceSeams, caller: InstallationAcceptanceCaller, body: InstallationAcceptanceRevokeRequest): Promise<InstallationAcceptance> {
  const { host, store } = seams;
  if (host.sessionOpen()) throw locked();

  const stored = await host.unit(INSTALLATION_REVOKE_UNIT_LABEL, async (unit) => {
    if (unit.sessionOpen()) throw locked();

    let row: StoredAcceptance | null;
    try {
      // `body.reason` is the TRIMMED text the contract's schema answered (decision DD-7 of row 116).
      row = await store.revoke(unit.db, { revokedAt: host.now(), revokedBy: caller.operatorId, revokeReason: body.reason });
    } catch (error) {
      // THE DATABASE'S ANSWER (row V6, R119-08): the revocation would stand BEFORE the acceptance it revokes - the clock
      // of the Core reads earlier than `accepted_at`. A state the Core can name: 409, no value, nothing changed. It is
      // noted as a warning (a clock that went back is worth a line), not persisted as a defect.
      if (isClockBehindViolation(error)) {
        host.note({ code: R.INSTALLATION_CLOCK_BEHIND_RECORD, source: SOURCE, level: 'warn' }, 'installation acceptance not revoked: the clock is behind the record');
        throw refused(R.INSTALLATION_CLOCK_BEHIND_RECORD);
      }
      host.failed(`${SOURCE}.revoke`, REVOKE_FAILED, error);
      throw error;
    }
    // The statement changed no row: none is in force. Nothing was written, so no entry is.
    if (row === null) throw refused(R.INSTALLATION_ACCEPTANCE_NOT_IN_FORCE);

    await unit.audit({
      type: AuditType.INSTALLATION_ACCEPTANCE_REVOKED,
      message: INSTALLATION_ACCEPTANCE_REVOKED_MESSAGE,
      actorId: caller.operatorId,
      deviceId: caller.deviceId,
      details: { acceptanceId: row.id, operationId: 'revokeInstallationAcceptance', permission: Permission.CAPTURE_COMMISSION },
    });
    return row;
  });

  host.note({ code: AuditType.INSTALLATION_ACCEPTANCE_REVOKED, source: SOURCE, acceptanceId: stored.id }, 'installation acceptance revoked');
  return installationAcceptanceOf(stored);
}
