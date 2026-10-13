/**
 * The audit writer (plan row W21; spec §8.3 ENG-8 to ENG-12, §13, SR-52 to SR-54, SR-65;
 * database contract §6.4, the append protocol AP-1 to AP-7).
 *
 * THE ONLY code path of the server runtime that inserts into `audit_log`. A static test of this
 * folder keeps it so. It works inside the caller's unit of work; it has no transaction of its
 * own.
 *
 * The protocol, statement by statement (the first three are the unit's, `unit-of-work.ts`):
 *
 *   AP-1  the unit's transaction runs at READ COMMITTED;
 *   AP-2  its first statement is `SELECT seq, hash FROM public.audit_chain_lock()`: it waits
 *         while another writer holds the head, then returns the head to extend;
 *   AP-7  so the lock is held before any other table is written;
 *   AP-3  each row is built with the SHARED code: `appendAudit` of `@dems/shared/sim` over a log
 *         whose head and total are that head. It gives `seq = head.seq + 1`, `id = auditId(seq)`,
 *         the category of the shared map, `prevHash = head.hash` and
 *         `hash = chainHash(prevHash, body)`. Nothing of that is implemented here;
 *   AP-4  one INSERT per row, in ascending sequence, with bind parameters: the typed table of
 *         the schema, and the stored form of the row from the ONE mapping (`auditRowToRow` of
 *         `db/mapping`, MR-1). No column is named or bound here. The guard trigger checks the
 *         link and moves the head;
 *   AP-5  the other rows of the unit follow in the same transaction; its COMMIT releases the lock;
 *   AP-6  rows the engine built in memory (`appendPrepared`) must continue the head of AP-2. If
 *         they do not, another writer exists: one log line `audit head diverged` with both
 *         sequence numbers, and the unit fails with 503.
 *
 * Because the unit holds the head row from its first statement to its COMMIT, the rows of one
 * unit are contiguous, whether they come from one call or from several.
 *
 * Validation comes BEFORE the first statement of a call (`payload-rules.ts`,
 * `audit-details.ts`): a row that a CHECK would refuse never reaches the database, where it
 * would be written into the server log. What the mapping module already refuses (a number that
 * is not a safe integer, a value PostgreSQL cannot store exactly) is not repeated here: its
 * builder runs as the last step of the validation, and its `MappingError` is the refusal.
 *
 * `at` is the server clock's value when the call is made. An entry cannot carry a time, a
 * sequence, a category or a hash (SR-65).
 *
 * The log of this file holds a unit's number and label, a sequence, a type and a code. Never a
 * message, a detail, an actor or a reference of a row.
 */
import { OPERATOR_ID_PATTERN, SHA256_HEX_PATTERN } from '@dems/shared/api';
import {
  AUDIT_TYPE_CATEGORY,
  AuditType,
  Severity,
  appendAudit,
  auditBody,
  auditId,
  chainHash,
  type AuditInput,
  type AuditLogSlice,
  type AuditRow,
} from '@dems/shared/sim';
import type { FastifyBaseLogger } from 'fastify';
import { auditRowToRow } from '../db/mapping';
import { auditLog, type AuditLogRow } from '../db/schema';
import { describeError, type ErrorLog } from '../plugins/logger';
import { detailRulesOf, fixedSeverityOf, openDetailRulesOf } from './audit-details';
import { stampOf, type Clock } from './clock';
import { CoreError, PipelineFailure, PipelineRefusal, SqlState, driverErrorOf, sqlStateOf } from './errors';
import { checkMessage, checkPayload, checkReference, type PayloadCodes, type RowOrigin } from './payload-rules';
import type { AuditEntry, ChainHead, UnitAuditWriter } from './types';
import type { UnitState } from './unit-of-work';

/** The 53 shared audit types and the four severities. */
const AUDIT_TYPES: ReadonlySet<string> = new Set(Object.values(AuditType));
const SEVERITIES: ReadonlySet<string> = new Set(Object.values(Severity));

/** What an entry may carry. Everything else of a row is the writer's. */
const ENTRY_MEMBERS: ReadonlySet<string> = new Set([
  'type',
  'message',
  'severity',
  'actorId',
  'deviceId',
  'sessionId',
  'evidenceId',
  'details',
]);

const CODES: PayloadCodes = {
  notFlat: 'AUDIT_DETAILS_NOT_FLAT',
  keyForbidden: 'AUDIT_DETAIL_KEY_FORBIDDEN',
  valueInvalid: 'AUDIT_DETAIL_VALUE_INVALID',
  textInvalid: 'AUDIT_TEXT_INVALID',
  secretShaped: 'AUDIT_SECRET_SHAPED_VALUE',
  messageInvalid: 'AUDIT_MESSAGE_INVALID',
  referenceInvalid: 'AUDIT_REFERENCE_INVALID',
};

export interface AuditWriterDependencies {
  readonly clock: Clock;
  readonly log: FastifyBaseLogger;
  readonly errorLog: ErrorLog;
}

// ── Validation ─────────────────────────────────────────────────────────────────────────────────

function isAuditType(value: unknown): value is AuditType {
  return typeof value === 'string' && AUDIT_TYPES.has(value);
}

function checkSeverity(value: unknown): Severity {
  if (typeof value !== 'string' || !SEVERITIES.has(value)) {
    throw new CoreError('AUDIT_SEVERITY_INVALID', 'the severity of an audit row is INFO, SUCCESS, WARNING or CRITICAL');
  }
  return value as Severity;
}

/** The actor is an operator ID or null; the row's foreign key points at the operators table. */
function checkActor(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !OPERATOR_ID_PATTERN.test(value)) {
    throw new CoreError('AUDIT_ACTOR_INVALID', 'the actor of an audit row is an operator ID or null, never a name that was typed');
  }
  return value;
}

/** The typed allow-list of the nine server-written types (spec §13.1). */
function checkAllowList(type: AuditType, details: Readonly<Record<string, string | number | boolean | null>>): void {
  const rules = detailRulesOf(type);
  if (rules === undefined) return;
  const allowed = Object.keys(rules);
  for (const key of Object.keys(details)) {
    if (!Object.hasOwn(rules, key)) {
      throw new CoreError(
        'AUDIT_DETAIL_KEY_NOT_ALLOWED',
        `the details of ${type} hold a key that the specification does not name; allowed: ${allowed.join(', ') || '(none)'}`,
      );
    }
  }
  for (const key of allowed) {
    const rule = rules[key];
    if (rule === undefined) continue;
    const value = details[key];
    if (value === undefined) {
      if (rule.required) throw new CoreError('AUDIT_DETAIL_MISSING', `the details of ${type} must hold ${key}`);
      continue;
    }
    if (!rule.accepts(value)) {
      throw new CoreError('AUDIT_DETAIL_VALUE_INVALID', `${key} in the details of ${type} must be ${rule.form}`);
    }
  }
}

/**
 * What holds for a row of `type` WHOEVER wrote it (task 4 row V4; decisions C71 C-6, C72 F-04, C76
 * item 8): the open rule of the type - named members held to their form while every other key
 * stays free, today the two signing members of `SYSTEM_BOOT`, each of its form or JSON null - and
 * the fixed severity of the type, today WARNING for `OPERATOR_PASSWORD_SET`. Asked for a native
 * entry (`auditInputOf`) and for every row before it is stored (`checkAuditRow`, native and
 * prepared), so no writer of such a row is outside it. The refusal names the type and the key,
 * never the value.
 */
function checkTypeRules(type: AuditType, severity: Severity, details: Readonly<Record<string, string | number | boolean | null>>): void {
  const fixed = fixedSeverityOf(type);
  if (fixed !== undefined && severity !== fixed) {
    throw new CoreError('AUDIT_SEVERITY_INVALID', `the severity of ${type} is fixed: ${fixed}`);
  }
  const rules = openDetailRulesOf(type);
  if (rules === undefined) return;
  for (const [key, rule] of Object.entries(rules)) {
    const value = details[key];
    if (value === undefined) continue;
    if (!rule.accepts(value)) {
      throw new CoreError('AUDIT_DETAIL_VALUE_INVALID', `${key} in the details of ${type} must be ${rule.form}`);
    }
  }
}

/** An entry of a server-native module, as the shared input the row is built from. */
export function auditInputOf(entry: AuditEntry): AuditInput {
  if (typeof entry !== 'object' || entry === null) {
    throw new CoreError('AUDIT_ENTRY_INVALID', 'an audit entry is an object');
  }
  const members = entry as unknown as Record<string, unknown>;
  if (Object.keys(members).some((key) => !ENTRY_MEMBERS.has(key))) {
    throw new CoreError(
      'AUDIT_ENTRY_INVALID',
      'an audit entry holds a member the writer does not take; the sequence, the time, the category and the hashes are set by the writer (SR-65)',
    );
  }
  if (!Object.hasOwn(members, 'actorId') || !Object.hasOwn(members, 'deviceId')) {
    throw new CoreError('AUDIT_ENTRY_INVALID', 'an audit entry states its actor and its device; null means the system, or no device');
  }
  const type = members['type'];
  if (!isAuditType(type)) {
    throw new CoreError('AUDIT_TYPE_UNKNOWN', 'the type of an audit row is one of the shared audit types');
  }
  const details = checkPayload(members['details'], 'native', CODES);
  checkAllowList(type, details);
  const severity = members['severity'] === undefined ? Severity.INFO : checkSeverity(members['severity']);
  checkTypeRules(type, severity, details);
  return {
    type,
    message: checkMessage(members['message'], 'native', CODES),
    severity,
    actorId: checkActor(members['actorId']),
    sessionId: checkReference(members['sessionId'], CODES),
    evidenceId: checkReference(members['evidenceId'], CODES),
    deviceId: checkReference(members['deviceId'], CODES),
    details,
  };
}

const invalidRow = (what: string): CoreError => new CoreError('AUDIT_ROW_INVALID', `an audit row cannot be stored: ${what}`);

/**
 * Everything the table's CHECKs ask of a row, and the digest, which the database does not check
 * (GD-01). For a prepared row this is the whole validation; for a native row it confirms what
 * the shared code built.
 *
 * Returns the row in its stored form, built by the mapping module's `auditRowToRow`: the one
 * place that maps the shared row to the table (MR-1). That builder is also the rule for what
 * can be stored exactly (safe integers, storable text, finite numbers) and throws its own
 * `MappingError`; those rules are not written a second time here.
 */
export function checkAuditRow(row: AuditRow, origin: RowOrigin): AuditLogRow {
  if (typeof row !== 'object' || row === null) throw invalidRow('it is not an object');
  if (!(row.seq >= 1)) throw invalidRow('its sequence is not 1 or more');
  if (row.id !== auditId(row.seq)) throw invalidRow('its identifier is not the one of its sequence');
  if (!(row.at >= 0)) throw invalidRow('its time is before the epoch');
  if (!isAuditType(row.type)) throw new CoreError('AUDIT_TYPE_UNKNOWN', 'the type of an audit row is one of the shared audit types');
  if (row.category !== AUDIT_TYPE_CATEGORY[row.type]) throw invalidRow('its category is not the one the shared map gives its type');
  const severity = checkSeverity(row.severity);
  checkActor(row.actorId);
  checkMessage(row.message, origin, CODES);
  checkReference(row.sessionId, CODES);
  checkReference(row.evidenceId, CODES);
  checkReference(row.deviceId, CODES);
  checkTypeRules(row.type, severity, checkPayload(row.details, origin, CODES));
  if (typeof row.prevHash !== 'string' || !SHA256_HEX_PATTERN.test(row.prevHash)) throw invalidRow('its previous hash is not 64 hexadecimal digits');
  if (typeof row.hash !== 'string' || !SHA256_HEX_PATTERN.test(row.hash) || row.hash === row.prevHash) {
    throw invalidRow('its hash is not 64 hexadecimal digits, or equals its previous hash');
  }
  if (chainHash(row.prevHash, auditBody(row)) !== row.hash) {
    throw new CoreError('AUDIT_ROW_HASH_MISMATCH', 'the hash of an audit row is not the shared digest of its previous hash and its body');
  }
  return auditRowToRow(row);
}

// ── The writer of one unit ─────────────────────────────────────────────────────────────────────

export function createUnitAuditWriter(state: UnitState, dependencies: AuditWriterDependencies): UnitAuditWriter {
  const { clock, log, errorLog } = dependencies;
  const where = { unit: state.id, label: state.label };

  /** A refusal before any statement: one log line and one entry, by code. Then the caller gets it. */
  function refused(error: unknown): never {
    const description = describeError(error);
    log.warn({ ...where, code: description.code ?? description.errorName }, 'audit row refused');
    errorLog.append({
      level: 'error',
      source: 'core.auditWriter',
      message: 'an audit row was refused before it was sent',
      ...description,
      context: where,
    });
    throw error;
  }

  /**
   * AP-4 for one row: `stored` is its stored form from the mapping module. The guard's refusal
   * becomes a commit failure (database contract §6.3). What is handed on is the driver's error,
   * never the query builder's wrapper, whose message quotes the row.
   */
  async function insert(row: AuditRow, stored: AuditLogRow): Promise<void> {
    try {
      await state.writerDatabase.insert(auditLog).values(stored);
    } catch (wrapped) {
      const error = driverErrorOf(wrapped);
      if (sqlStateOf(error) !== SqlState.CHAIN_DISCONTINUITY) throw error;
      log.error({ ...where, code: SqlState.CHAIN_DISCONTINUITY, seq: row.seq }, 'the audit chain refused a row');
      errorLog.append({
        level: 'error',
        source: 'core.auditWriter',
        message: 'the audit chain refused a row',
        ...describeError(error),
        context: { ...where, seq: row.seq },
      });
      throw new PipelineFailure(PipelineRefusal.AUDIT_CHAIN_REFUSED, error);
    }
    state.recordAuditRow(row);
    log.debug({ ...where, seq: row.seq, type: row.type }, 'audit row appended');
  }

  async function appendEntries(entries: readonly AuditEntry[]): Promise<AuditRow[]> {
    state.assertOpen();
    let inputs: AuditInput[];
    let at: number;
    try {
      if (!Array.isArray(entries)) throw new CoreError('AUDIT_ENTRY_INVALID', 'a list of audit entries is expected');
      inputs = entries.map(auditInputOf);
      at = stampOf(clock);
    } catch (error) {
      return refused(error);
    }
    const rows: AuditRow[] = [];
    if (inputs.length === 0) return rows;
    let head: ChainHead = await state.chainHead();
    for (const input of inputs) {
      // AP-3, with the shared function: a log that holds nothing but the head to extend.
      const extended: AuditLogSlice = { rows: [], head: head.hash, total: head.seq, dropped: head.seq };
      const { row } = appendAudit(extended, input, at);
      let stored: AuditLogRow;
      try {
        stored = checkAuditRow(row, 'native');
      } catch (error) {
        return refused(error);
      }
      await insert(row, stored);
      rows.push(row);
      head = { seq: row.seq, hash: row.hash };
    }
    return rows;
  }

  async function appendPrepared(rows: readonly AuditRow[]): Promise<void> {
    state.assertOpen();
    let stored: AuditLogRow[];
    try {
      if (!Array.isArray(rows)) throw new CoreError('AUDIT_ROW_INVALID', 'a list of audit rows is expected');
      stored = rows.map((row) => checkAuditRow(row, 'prepared'));
    } catch (error) {
      return refused(error);
    }
    if (rows.length === 0) return;
    // AP-6: the rows must continue the head this unit extends, and each other.
    let head: ChainHead = await state.chainHead();
    for (const row of rows) {
      if (row.seq !== head.seq + 1 || row.prevHash !== head.hash) {
        log.error({ ...where, code: PipelineRefusal.AUDIT_HEAD_DIVERGED, headSeq: head.seq, rowSeq: row.seq }, 'audit head diverged');
        errorLog.append({
          level: 'error',
          source: 'core.auditWriter',
          message: 'audit head diverged',
          code: PipelineRefusal.AUDIT_HEAD_DIVERGED,
          context: { ...where, headSeq: head.seq, rowSeq: row.seq },
        });
        throw new PipelineFailure(PipelineRefusal.AUDIT_HEAD_DIVERGED);
      }
      head = { seq: row.seq, hash: row.hash };
    }
    for (const [index, row] of rows.entries()) await insert(row, stored[index] as AuditLogRow);
  }

  return {
    append: (entry) =>
      state.serial(async () => {
        const [row] = await appendEntries([entry]);
        if (row === undefined) throw new CoreError('AUDIT_ENTRY_INVALID', 'an audit entry is expected');
        return row;
      }),
    appendMany: (entries) => state.serial(() => appendEntries(entries)),
    appendPrepared: (rows) => state.serial(() => appendPrepared(rows)),
    head: () => state.serial(() => state.chainHead()),
    appended: () => [...state.auditRows],
  };
}
