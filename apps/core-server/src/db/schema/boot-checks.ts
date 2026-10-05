/**
 * Boot checks B-2 to B-9 of the database contract (§7.4), as pure async functions over a pool
 * (plan row W17; decision D40).
 *
 * WHO CALLS THEM. This module registers nothing. The core-services row (W21) adds them to the
 * server's boot steps with `app.readiness.addBootStep({ id, run })`, in the order B-2 to B-9,
 * after B-1 ("the database answers"), which the pool plugin already adds. The reset routine
 * repeats B-5 and B-9 before it swaps a database in (R-6).
 *
 *   for (const check of BLOCKING_BOOT_CHECKS) {
 *     app.readiness.addBootStep({ id: check.id, run: () => check.run(app.db.pool) });
 *   }
 *
 * B-8 is reported, not blocking: `checkStoredChain` returns a report and never throws for a
 * chain that does not verify. In the order of the contract it runs between B-7 and B-9.
 *
 * WHAT THEY NEED. Every statement is one the RUNTIME role may run: the pool is the server's own
 * (`dems_app`). A blocking check that fails throws a `BootCheckError` whose `checkId` names it;
 * the server then refuses to start, with one log line and no listener. A message never holds a
 * credential: it names a role, a table, a trigger, a number.
 *
 * WHAT THEY DO NOT COVER. The migration files against the hashes stored when they were applied:
 * the migrator's table is in schema `drizzle`, on which the runtime role has no privilege
 * (OW-5), so that comparison needs the owner role and belongs to `db:status` and `db:migrate`
 * (`../commands/migrations.ts`). B-3 compares the schema version that the last migration file
 * wrote into `schema_meta`.
 */
import type { Pool } from 'pg';
import type { AuditLogRow } from './audit';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from './meta';

/** What a check needs of a pool. A test may pass a stand-in. */
export type Queryable = Pick<Pool, 'query'>;

export const BOOT_CHECK_IDS = ['B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-8', 'B-9'] as const;
export type BootCheckId = (typeof BOOT_CHECK_IDS)[number];

/** The runtime role and the owner role, as the checks expect them (§7.1). */
export const EXPECTED_RUNTIME_ROLE = 'dems_app';
export const EXPECTED_OWNER_ROLE = 'dems_owner';
/** PostgreSQL major version and encoding the contract was written for (B-2). */
export const EXPECTED_SERVER_MAJOR = 18;
export const EXPECTED_SERVER_ENCODING = 'UTF8';
/** The three triggers of migration `0002_audit_guards`, each `ENABLE ALWAYS` (`tgenabled = 'A'`). */
export const EXPECTED_AUDIT_TRIGGERS = [
  'audit_chain_history_append_only',
  'audit_log_append_only',
  'audit_log_chain_guard',
] as const;
export const TRIGGER_MODE_ALWAYS = 'A';
/** 64 zero digits: the head of an empty chain (`constants.ts:44`). */
export const GENESIS_HASH = '0'.repeat(64);
/** B-8 checks the rows the engine's ring holds at start: the newest 1,000 (MR-4). */
export const STORED_CHAIN_CHECK_ROWS = 1_000;

/** A blocking boot check failed. `checkId` goes into the server's one log line. */
export class BootCheckError extends Error {
  readonly checkId: BootCheckId;

  constructor(checkId: BootCheckId, message: string) {
    super(`${checkId}: ${message}`);
    this.name = 'BootCheckError';
    this.checkId = checkId;
  }
}

function sqlState(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

const UNDEFINED_TABLE = '42P01';

// ── B-2 ────────────────────────────────────────────────────────────────────────────────────────

/** B-2: server version and encoding. Pass: major version 18; `UTF8`. */
export async function checkServerVersion(pool: Queryable): Promise<void> {
  const version = await pool.query<{ server_version_num: string }>('SHOW server_version_num');
  const encoding = await pool.query<{ server_encoding: string }>('SHOW server_encoding');
  const versionNum = Number(version.rows[0]?.server_version_num);
  const major = Math.floor(versionNum / 10_000);
  const serverEncoding = encoding.rows[0]?.server_encoding;
  if (!Number.isFinite(versionNum) || major !== EXPECTED_SERVER_MAJOR) {
    throw new BootCheckError('B-2', `the server reports version number ${versionNum}; PostgreSQL ${EXPECTED_SERVER_MAJOR} is expected.`);
  }
  if (serverEncoding !== EXPECTED_SERVER_ENCODING) {
    throw new BootCheckError('B-2', `the database encoding is ${String(serverEncoding)}; ${EXPECTED_SERVER_ENCODING} is expected.`);
  }
}

// ── B-3 ────────────────────────────────────────────────────────────────────────────────────────

export interface ExpectedSchema {
  readonly schemaVersion: number;
  readonly contractRevision: string;
}

/**
 * B-3: the schema version. Pass: the row of `schema_meta` equals the constants of the server
 * code. The failure message names both numbers and the migrate command. The server never
 * applies a migration itself.
 */
export async function checkSchemaVersion(
  pool: Queryable,
  expected: ExpectedSchema = { schemaVersion: DB_SCHEMA_VERSION, contractRevision: DB_CONTRACT_REVISION },
): Promise<void> {
  const command = 'npm run db:migrate -w @dems/core-server -- --database <name>';
  let rows: Array<{ schema_version: number; contract_revision: string }>;
  try {
    ({ rows } = await pool.query<{ schema_version: number; contract_revision: string }>(
      'SELECT schema_version, contract_revision FROM schema_meta',
    ));
  } catch (error) {
    if (sqlState(error) === UNDEFINED_TABLE) {
      throw new BootCheckError(
        'B-3',
        `the database has no schema (no table schema_meta); this server expects schema version ${expected.schemaVersion} (${expected.contractRevision}). Apply the migrations: ${command}`,
      );
    }
    throw error;
  }
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    throw new BootCheckError(
      'B-3',
      `schema_meta holds ${rows.length} row(s); this server expects schema version ${expected.schemaVersion} (${expected.contractRevision}). Apply the migrations: ${command}`,
    );
  }
  if (row.schema_version !== expected.schemaVersion || row.contract_revision !== expected.contractRevision) {
    throw new BootCheckError(
      'B-3',
      `the database is at schema version ${row.schema_version} (${row.contract_revision}); this server expects ${expected.schemaVersion} (${expected.contractRevision}). Apply the migrations: ${command}`,
    );
  }
}

// ── B-4 ────────────────────────────────────────────────────────────────────────────────────────

/**
 * B-4: the runtime role is not privileged. Pass: `rolname` is `dems_app` and all five flags are
 * false. A pool that was configured with the owner role fails here (`rolcreatedb` is true).
 */
export async function checkRuntimeRole(pool: Queryable): Promise<void> {
  const { rows } = await pool.query<{
    rolname: string;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
  }>(
    'SELECT rolname::text AS rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls ' +
      'FROM pg_roles WHERE rolname = current_user',
  );
  const row = rows[0];
  if (row === undefined) throw new BootCheckError('B-4', 'the session has no row in pg_roles.');
  const flags = (['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolbypassrls'] as const).filter(
    (flag) => row[flag] !== false,
  );
  if (row.rolname !== EXPECTED_RUNTIME_ROLE || flags.length > 0) {
    throw new BootCheckError(
      'B-4',
      `the pool is connected as ${row.rolname}${flags.length > 0 ? ` with ${flags.join(', ')}` : ''}; the server runs as ${EXPECTED_RUNTIME_ROLE}, which has none of the five role attributes.`,
    );
  }
}

// ── B-5 ────────────────────────────────────────────────────────────────────────────────────────

/**
 * B-5: the audit table and the lineage table are protected. Pass: the session holds no UPDATE,
 * DELETE or TRUNCATE on `audit_log` and `audit_chain_history`, no INSERT on
 * `audit_chain_history` (D18), no UPDATE on `audit_chain_head`; and exactly three triggers
 * exist on the two tables, each with `tgenabled = 'A'` (SD-06).
 *
 * UPDATE and INSERT are asked with `has_any_column_privilege` as well as with
 * `has_table_privilege`: a grant on a single column would otherwise go unnoticed, and a
 * column-level UPDATE grant is enough for `SELECT ... FOR UPDATE` (PG-25).
 */
export async function checkAuditProtection(pool: Queryable): Promise<void> {
  const privileges = await pool.query<{ object: string; privilege: string; granted: boolean }>(
    `SELECT x.table_name AS object, x.privilege_name AS privilege,
            has_table_privilege(current_user, x.table_name, x.privilege_name)
              OR (x.privilege_name IN ('UPDATE', 'INSERT')
                  AND has_any_column_privilege(current_user, x.table_name, x.privilege_name)) AS granted
       FROM (VALUES ('public.audit_log', 'UPDATE'), ('public.audit_log', 'DELETE'), ('public.audit_log', 'TRUNCATE'),
                    ('public.audit_chain_history', 'UPDATE'), ('public.audit_chain_history', 'DELETE'),
                    ('public.audit_chain_history', 'TRUNCATE'), ('public.audit_chain_history', 'INSERT'),
                    ('public.audit_chain_head', 'UPDATE')) AS x(table_name, privilege_name)
      ORDER BY 1, 2`,
  );
  const held = privileges.rows.filter((row) => row.granted !== false).map((row) => `${row.privilege} on ${row.object}`);
  if (privileges.rows.length !== 8 || held.length > 0) {
    throw new BootCheckError(
      'B-5',
      held.length > 0
        ? `the session holds ${held.join(', ')}; the runtime role must hold none of them.`
        : 'the privilege question returned an unexpected number of rows.',
    );
  }

  const triggers = await pool.query<{ tgname: string; tgenabled: string }>(
    'SELECT tgname::text AS tgname, tgenabled::text AS tgenabled FROM pg_trigger ' +
      "WHERE tgrelid IN ('public.audit_log'::regclass, 'public.audit_chain_history'::regclass) AND NOT tgisinternal " +
      'ORDER BY tgname',
  );
  const found = triggers.rows.map((row) => `${row.tgname}=${row.tgenabled}`);
  const expected = EXPECTED_AUDIT_TRIGGERS.map((name) => `${name}=${TRIGGER_MODE_ALWAYS}`);
  if (found.length !== expected.length || found.some((entry, index) => entry !== expected[index])) {
    throw new BootCheckError(
      'B-5',
      `the triggers on audit_log and audit_chain_history are [${found.join(', ')}]; expected exactly [${expected.join(', ')}].`,
    );
  }
}

// ── B-6 ────────────────────────────────────────────────────────────────────────────────────────

/** B-6: the database is seeded. Pass: `core_state` has one row. The message names the seed command. */
export async function checkSeeded(pool: Queryable): Promise<void> {
  const { rows } = await pool.query<{ rows: string }>('SELECT count(*) AS rows FROM core_state');
  const count = Number(rows[0]?.rows);
  if (count !== 1) {
    throw new BootCheckError(
      'B-6',
      `core_state holds ${count} row(s); a seeded database holds one. Seed it: npm run db:seed -w @dems/core-server -- --database <name>`,
    );
  }
}

// ── B-7 ────────────────────────────────────────────────────────────────────────────────────────

/**
 * B-7: the chain head agrees with the table. Pass: the head's sequence equals the highest
 * sequence of `audit_log` (or both mean "empty") and the hashes are equal.
 */
export async function checkChainHead(pool: Queryable): Promise<void> {
  const { rows } = await pool.query<{ seq: string; hash: string; max_seq: string | null; last_hash: string | null }>(
    'SELECT h.seq, h.hash, (SELECT max(seq) FROM audit_log) AS max_seq, ' +
      '(SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1) AS last_hash FROM audit_chain_head h',
  );
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    throw new BootCheckError('B-7', `audit_chain_head holds ${rows.length} row(s); it must hold one.`);
  }
  const headSeq = Number(row.seq);
  if (row.max_seq === null) {
    if (headSeq !== 0 || row.hash !== GENESIS_HASH) {
      throw new BootCheckError('B-7', `the audit log is empty, but the chain head is at sequence ${headSeq}.`);
    }
    return;
  }
  const maxSeq = Number(row.max_seq);
  if (headSeq !== maxSeq || row.hash !== row.last_hash) {
    throw new BootCheckError(
      'B-7',
      `the chain head is at sequence ${headSeq}, the newest audit row at ${maxSeq}${headSeq === maxSeq ? ', and their hashes differ' : ''}.`,
    );
  }
}

// ── B-8 (reported, not blocking) ───────────────────────────────────────────────────────────────

export interface DigestVerdict {
  readonly ok: boolean;
  /** For example the sequence of the first row whose digest is wrong. Never row content. */
  readonly reason?: string;
}

export interface StoredChainOptions {
  /** How many of the newest rows to check. Default 1,000: the rows of the engine's ring (MR-4). */
  readonly limit?: number;
  /**
   * The shared digest check. The database checks that each row continues its predecessor, not
   * that its `hash` is `sha256(prevHash ‖ canonicalJSON(body))` (GD-01); that needs the shared
   * `verifyAuditChain`, which the caller passes in (with the one mapping of rows to the shared
   * shape, MR-1). `dropped` is the number of older rows that were not read.
   */
  readonly verifyDigests?: (rows: readonly AuditLogRow[], context: { readonly dropped: number; readonly head: string }) => DigestVerdict;
}

export interface StoredChainReport {
  /** True when nothing below is wrong. A false value is logged as an error; the server still starts. */
  readonly ok: boolean;
  readonly rowsChecked: number;
  readonly firstSeq: number | null;
  readonly lastSeq: number | null;
  /** Rows, among those checked, that do not continue their predecessor (sequence or previous hash). */
  readonly linkBreaks: number;
  readonly digests: 'ok' | 'failed' | 'not-checked';
  /** LN-3: the newest lineage row agrees with one `SCENARIO_LOADED` row of the chain. `none`: no lineage row. */
  readonly lineage: 'ok' | 'mismatch' | 'none';
  readonly problems: readonly string[];
}

interface AuditRecord {
  seq: string;
  id: string;
  at: string;
  type: string;
  category: string;
  severity: string;
  actor_id: string | null;
  message: string;
  session_id: string | null;
  evidence_id: string | null;
  device_id: string | null;
  details: AuditLogRow['details'];
  prev_hash: string;
  hash: string;
}

function toAuditLogRow(record: AuditRecord): AuditLogRow {
  return {
    seq: Number(record.seq),
    id: record.id,
    at: Number(record.at),
    type: record.type,
    category: record.category as AuditLogRow['category'],
    severity: record.severity as AuditLogRow['severity'],
    actorId: record.actor_id,
    message: record.message,
    sessionId: record.session_id,
    evidenceId: record.evidence_id,
    deviceId: record.device_id,
    details: record.details,
    prevHash: record.prev_hash,
    hash: record.hash,
  };
}

/**
 * B-8: the stored chain verifies. REPORTED ONLY: the server cannot repair a stored row in any
 * case (GD-01), so a failure is logged as an error and shown by `verifyAuditChain` (`stored`),
 * and the server still starts. The function throws only when the database itself fails.
 *
 * It reads the newest `limit` rows in sequence order and checks (1) the links in SQL terms:
 * each row's sequence is its predecessor's plus one and its `prev_hash` is the predecessor's
 * `hash`; (2) the digests, when the caller passes the shared check; (3) the lineage rule LN-3.
 */
export async function checkStoredChain(pool: Queryable, options: StoredChainOptions = {}): Promise<StoredChainReport> {
  const limit = options.limit ?? STORED_CHAIN_CHECK_ROWS;
  const problems: string[] = [];

  const read = await pool.query<AuditRecord>(
    'SELECT seq, id, at, type, category, severity, actor_id, message, session_id, evidence_id, device_id, details, prev_hash, hash ' +
      'FROM (SELECT * FROM audit_log ORDER BY seq DESC LIMIT $1) AS newest ORDER BY seq',
    [limit],
  );
  const rows = read.rows.map(toAuditLogRow);
  const first = rows[0];
  const last = rows[rows.length - 1];

  let linkBreaks = 0;
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    if (previous !== undefined && (row.seq !== previous.seq + 1 || row.prevHash !== previous.hash)) linkBreaks += 1;
  });
  if (first !== undefined && first.seq === 1 && first.prevHash !== GENESIS_HASH) linkBreaks += 1;
  if (linkBreaks > 0) problems.push(`${linkBreaks} stored audit row(s) do not continue their predecessor.`);

  let digests: StoredChainReport['digests'] = 'not-checked';
  if (options.verifyDigests !== undefined && first !== undefined && last !== undefined) {
    const verdict = options.verifyDigests(rows, { dropped: first.seq - 1, head: last.hash });
    digests = verdict.ok ? 'ok' : 'failed';
    if (!verdict.ok) problems.push(`the stored chain does not verify${verdict.reason === undefined ? '' : ` (${verdict.reason})`}.`);
  } else if (options.verifyDigests !== undefined) {
    digests = 'ok';
  }

  let lineage: StoredChainReport['lineage'] = 'none';
  const newest = await pool.query<{ head_hash: string; row_count: string }>(
    'SELECT head_hash, row_count FROM audit_chain_history ORDER BY reset_no DESC LIMIT 1',
  );
  const entry = newest.rows[0];
  if (entry !== undefined) {
    const loaded = await pool.query<{ previous_rows: string | null }>(
      "SELECT details ->> 'previousRows' AS previous_rows FROM audit_log " +
        "WHERE type = 'SCENARIO_LOADED' AND details ->> 'previousHead' = $1",
      [entry.head_hash],
    );
    const agrees = loaded.rows.length === 1 && loaded.rows[0]?.previous_rows === entry.row_count;
    lineage = agrees ? 'ok' : 'mismatch';
    if (!agrees) {
      problems.push('the newest lineage row does not agree with exactly one SCENARIO_LOADED row of the chain (LN-3).');
    }
  }

  return {
    ok: problems.length === 0,
    rowsChecked: rows.length,
    firstSeq: first?.seq ?? null,
    lastSeq: last?.seq ?? null,
    linkBreaks,
    digests,
    lineage,
    problems,
  };
}

// ── B-9 ────────────────────────────────────────────────────────────────────────────────────────

/**
 * B-9: the owner role is not a superuser, and it owns the guarded objects. Pass: one role row
 * for `dems_owner` with all four flags false; the database, the three guarded tables and the
 * two SECURITY DEFINER functions belong to `dems_owner`. A database that was created or
 * migrated by a superuser by mistake fails here.
 */
export async function checkOwnerRole(pool: Queryable): Promise<void> {
  const role = await pool.query<{
    rolsuper: boolean;
    rolcreaterole: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
  }>('SELECT rolsuper, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = $1', [EXPECTED_OWNER_ROLE]);
  const row = role.rows[0];
  if (role.rows.length !== 1 || row === undefined) {
    throw new BootCheckError('B-9', `pg_roles has ${role.rows.length} row(s) for ${EXPECTED_OWNER_ROLE}; it must have one.`);
  }
  const flags = (['rolsuper', 'rolcreaterole', 'rolreplication', 'rolbypassrls'] as const).filter((flag) => row[flag] !== false);
  if (flags.length > 0) {
    throw new BootCheckError('B-9', `the owner role ${EXPECTED_OWNER_ROLE} has ${flags.join(', ')}; it must have none of them.`);
  }

  const owners = await pool.query<{ object: string; owner: string }>(
    `SELECT 'database ' || datname::text AS object, pg_get_userbyid(datdba)::text AS owner
       FROM pg_database WHERE datname = current_database()
     UNION ALL
     SELECT 'table ' || relname::text, pg_get_userbyid(relowner)::text
       FROM pg_class
      WHERE oid IN ('public.audit_log'::regclass, 'public.audit_chain_head'::regclass, 'public.audit_chain_history'::regclass)
     UNION ALL
     SELECT 'function ' || proname::text, pg_get_userbyid(proowner)::text
       FROM pg_proc
      WHERE oid IN ('public.audit_chain_lock()'::regprocedure, 'public.audit_log_guard_insert()'::regprocedure)
     ORDER BY 1`,
  );
  const foreign = owners.rows.filter((entry) => entry.owner !== EXPECTED_OWNER_ROLE).map((entry) => `${entry.object} (${entry.owner})`);
  if (owners.rows.length !== 6 || foreign.length > 0) {
    throw new BootCheckError(
      'B-9',
      foreign.length > 0
        ? `not owned by ${EXPECTED_OWNER_ROLE}: ${foreign.join(', ')}.`
        : `expected the database, three tables and two functions; found ${owners.rows.length} object(s).`,
    );
  }
}

// ── The list ───────────────────────────────────────────────────────────────────────────────────

export interface BlockingBootCheck {
  readonly id: Exclude<BootCheckId, 'B-8'>;
  /** What the check establishes, for a log line. */
  readonly title: string;
  run(pool: Queryable): Promise<void>;
}

/**
 * The seven blocking checks in the order of the contract. B-1 comes before them (the pool
 * plugin); B-8 (`checkStoredChain`, reported only) belongs between B-7 and B-9.
 */
export const BLOCKING_BOOT_CHECKS: readonly BlockingBootCheck[] = Object.freeze([
  { id: 'B-2', title: 'server version and encoding', run: checkServerVersion },
  { id: 'B-3', title: 'schema version', run: (pool: Queryable) => checkSchemaVersion(pool) },
  { id: 'B-4', title: 'the runtime role is not privileged', run: checkRuntimeRole },
  { id: 'B-5', title: 'the audit table and the lineage table are protected', run: checkAuditProtection },
  { id: 'B-6', title: 'the database is seeded', run: checkSeeded },
  { id: 'B-7', title: 'the chain head agrees with the table', run: checkChainHead },
  { id: 'B-9', title: 'the owner role is not a superuser and owns the guarded objects', run: checkOwnerRole },
] as const);
