/**
 * `db:status`: prints the state of a project database, as the owner role (database contract
 * §8.4; LN-4; decision D38).
 *
 *   npm run db:status -w @dems/core-server -- --database <name>
 *
 * It prints: the database's owner, encoding and locale; the schema version and contract
 * revision; the migration ledger (each file's SHA-256 against the hash stored when it was
 * applied); `seeded_at` and `last_reset_at`; the row count of every table; the audit head; the
 * mode of the three audit triggers; the number of lineage rows and the newest one.
 *
 * Exit code 0: the database exists, every migration file is applied with its own hash, and the
 * schema version is the one this code expects. Exit code 1: anything else, with the reason in
 * the last lines. The migrator itself does not notice an applied file that was edited or a file
 * it would skip (it decides by journal time, D38); this command does, and that is why its exit
 * code is the check a start procedure or a gate builds on.
 *
 * It reads only. It prints no hash of a secret: the head hash of the audit chain and a
 * migration file's hash are integrity values, not secrets.
 */
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import type { Pool } from 'pg';
import * as schema from '../schema';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../schema';
import { isEntryPoint, main, readDatabaseFacts, runCommand, type CommandOptions, type DatabaseFacts } from './cli';
import { inspectLedger, readSchemaVersion, type LedgerReport, type SchemaVersion } from './migrations';
import { DbCommandError, OWNER_ROLE } from './owner-connection';

const COMMAND = 'db:status';

/** The 30 table names of the typed schema, sorted. Statement text is built from these constants only. */
export const SCHEMA_TABLE_NAMES: readonly string[] = Object.freeze(
  (Object.values(schema) as unknown[])
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => getTableName(table))
    .sort(),
);

/** The three triggers boot check B-5 expects, each in the mode `'A'` (ENABLE ALWAYS). */
export const AUDIT_TRIGGER_NAMES = [
  'audit_chain_history_append_only',
  'audit_log_append_only',
  'audit_log_chain_guard',
] as const;

export interface LineageSummary {
  readonly resetNo: number;
  readonly epoch: number;
  readonly rowCount: number;
  readonly headHash: string;
  readonly resetAt: number;
  readonly actorId: string | null;
  readonly reason: string;
  readonly scenario: string;
}

export interface DatabaseStatus {
  readonly database: string;
  readonly facts: DatabaseFacts;
  readonly serverVersion: string;
  readonly schema: SchemaVersion | null;
  readonly ledger: LedgerReport;
  /** Present only when the schema exists. */
  readonly content: {
    readonly seededAt: number | null;
    readonly lastResetAt: number | null;
    readonly rowCounts: ReadonlyArray<{ readonly table: string; readonly rows: number }>;
    readonly auditHead: { readonly seq: number; readonly hash: string } | null;
    readonly triggers: ReadonlyArray<{ readonly name: string; readonly mode: string }>;
    readonly lineageRows: number;
    readonly newestLineage: LineageSummary | null;
  } | null;
  /** Why the exit code is 1; empty when it is 0. */
  readonly problems: readonly string[];
}

const iso = (ms: number | null): string => (ms === null ? 'never' : `${new Date(ms).toISOString()} (${ms})`);

/** Reads everything `db:status` prints, through an owner pool on the target database. */
export async function collectStatus(
  pool: Pool,
  database: string,
  facts: DatabaseFacts,
  serverVersion: string,
  migrationsFolder?: string,
): Promise<DatabaseStatus> {
  const version = await readSchemaVersion(pool);
  const ledger = await inspectLedger(pool, migrationsFolder);
  const problems: string[] = [...ledger.problems];

  if (facts.owner !== OWNER_ROLE) {
    problems.push(`The database belongs to ${facts.owner}, not to ${OWNER_ROLE} (OW-1).`);
  }
  if (ledger.pending.length > 0) {
    problems.push(`${ledger.pending.length} migration(s) are not applied: ${ledger.pending.join(', ')}. Run "npm run db:migrate".`);
  }
  if (version === null) {
    if (ledger.pending.length === 0) problems.push('The table schema_meta has no row, although no migration is pending.');
  } else if (version.schemaVersion !== DB_SCHEMA_VERSION || version.contractRevision !== DB_CONTRACT_REVISION) {
    problems.push(
      `The database is at schema version ${version.schemaVersion} (${version.contractRevision}); this code expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). Run "npm run db:migrate" with the code that matches the database, or migrate the database.`,
    );
  }

  let content: DatabaseStatus['content'] = null;
  if (version !== null) {
    const counts = await pool.query<{ t: string; rows: string }>(
      SCHEMA_TABLE_NAMES.map((table) => `SELECT '${table}' AS t, count(*) AS rows FROM public.${table}`).join(' UNION ALL ') +
        ' ORDER BY t',
    );
    const state = await pool.query<{ seeded_at: string; last_reset_at: string | null }>(
      'SELECT seeded_at, last_reset_at FROM public.core_state',
    );
    const head = await pool.query<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_head');
    const triggers = await pool.query<{ name: string; mode: string }>(
      'SELECT tgname::text AS name, tgenabled::text AS mode FROM pg_trigger ' +
        "WHERE tgrelid IN ('public.audit_log'::regclass, 'public.audit_chain_history'::regclass) AND NOT tgisinternal " +
        'ORDER BY tgname',
    );
    const lineageCount = await pool.query<{ rows: string }>('SELECT count(*) AS rows FROM public.audit_chain_history');
    const newest = await pool.query<{
      reset_no: string;
      epoch: string;
      row_count: string;
      head_hash: string;
      reset_at: string;
      actor_id: string | null;
      reason: string;
      scenario: string;
    }>(
      'SELECT reset_no, epoch, row_count, head_hash, reset_at, actor_id, reason, scenario ' +
        'FROM public.audit_chain_history ORDER BY reset_no DESC LIMIT 1',
    );

    const found = triggers.rows.map((row) => `${row.name}=${row.mode}`).join(', ');
    const expected = AUDIT_TRIGGER_NAMES.map((name) => `${name}=A`).join(', ');
    if (found !== expected) {
      problems.push(`The audit triggers are "${found}"; expected "${expected}" (three triggers, each ENABLE ALWAYS).`);
    }

    const stateRow = state.rows[0];
    const headRow = head.rows[0];
    const newestRow = newest.rows[0];
    content = {
      seededAt: stateRow === undefined ? null : Number(stateRow.seeded_at),
      lastResetAt: stateRow === undefined || stateRow.last_reset_at === null ? null : Number(stateRow.last_reset_at),
      rowCounts: counts.rows.map((row) => ({ table: row.t, rows: Number(row.rows) })),
      auditHead: headRow === undefined ? null : { seq: Number(headRow.seq), hash: headRow.hash },
      triggers: triggers.rows,
      lineageRows: Number(lineageCount.rows[0]?.rows ?? 0),
      newestLineage:
        newestRow === undefined
          ? null
          : {
              resetNo: Number(newestRow.reset_no),
              epoch: Number(newestRow.epoch),
              rowCount: Number(newestRow.row_count),
              headHash: newestRow.head_hash,
              resetAt: Number(newestRow.reset_at),
              actorId: newestRow.actor_id,
              reason: newestRow.reason,
              scenario: newestRow.scenario,
            },
    };
  }

  return { database, facts, serverVersion, schema: version, ledger, content, problems };
}

/** The lines `db:status` prints, without the command prefix. */
export function formatStatus(status: DatabaseStatus): string[] {
  const lines: string[] = [];
  lines.push(`database         ${status.database} on PostgreSQL ${status.serverVersion}`);
  lines.push(`owner            ${status.facts.owner}; encoding ${status.facts.encoding}; locale ${status.facts.collate}`);
  lines.push(
    status.schema === null
      ? `schema version   none (not migrated); this code expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION})`
      : `schema version   ${status.schema.schemaVersion}; contract revision ${status.schema.contractRevision}; this code expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION})`,
  );
  lines.push(`migrations       ${status.ledger.entries.length} file(s); ledger ${status.ledger.ok ? 'matches' : 'DOES NOT MATCH'}`);
  for (const entry of status.ledger.entries) {
    const stored = entry.storedHash === null ? '-' : entry.storedHash;
    lines.push(`  ${entry.tag.padEnd(20)} ${entry.state.padEnd(8)} file sha256 ${entry.sha256}  stored ${stored}`);
  }
  for (const row of status.ledger.unknownApplied) {
    lines.push(`  (no file)            unknown  stored ${row.hash}  journal time ${row.createdAt}`);
  }

  const content = status.content;
  if (content !== null) {
    lines.push(`seeded_at        ${content.seededAt === null ? 'not seeded' : iso(content.seededAt)}`);
    lines.push(`last_reset_at    ${iso(content.lastResetAt)}`);
    lines.push(
      content.auditHead === null
        ? 'audit head       missing'
        : `audit head       seq ${content.auditHead.seq}; hash ${content.auditHead.hash.slice(0, 16)}...`,
    );
    lines.push(`audit triggers   ${content.triggers.map((trigger) => `${trigger.name}=${trigger.mode}`).join(', ') || 'none'}`);
    const lineage = content.newestLineage;
    lines.push(
      lineage === null
        ? `lineage          ${content.lineageRows} row(s)`
        : `lineage          ${content.lineageRows} row(s); newest: reset_no ${lineage.resetNo}, epoch ${lineage.epoch}, rows ${lineage.rowCount}, head ${lineage.headHash.slice(0, 16)}..., reset_at ${iso(lineage.resetAt)}, actor ${lineage.actorId ?? 'none (command line)'}, reason ${lineage.reason}, scenario ${lineage.scenario}`,
    );
    lines.push(`row counts       ${content.rowCounts.length} table(s)`);
    for (const row of content.rowCounts) lines.push(`  ${row.table.padEnd(24)} ${row.rows}`);
  }
  return lines;
}

export async function runStatus(argv: readonly string[], options: CommandOptions = {}): Promise<number> {
  return runCommand(COMMAND, argv, options, async ({ io, target, withPool, withMaintenancePool }) => {
    const facts = await withMaintenancePool((pool) => readDatabaseFacts(pool, target));
    if (facts === null) {
      throw new DbCommandError(
        'DATABASE_MISSING',
        `The database ${target} does not exist. Create it with: npm run db:create -w @dems/core-server -- --database ${target}`,
      );
    }
    return withPool(target, async (pool, session) => {
      const status = await collectStatus(pool, target, facts, session.serverVersion, options.migrationsFolder);
      for (const line of formatStatus(status)) io.out(line);
      if (status.problems.length === 0) {
        io.out(`${COMMAND}: OK: ${target} is at the schema version this code expects and the ledger matches the files.`);
        return 0;
      }
      for (const problem of status.problems) io.err(`${COMMAND}: ${problem}`);
      io.err(`${COMMAND}: NOT OK: ${status.problems.length} problem(s) on ${target}.`);
      return 1;
    });
  });
}

if (isEntryPoint(import.meta.url)) await main(runStatus);
