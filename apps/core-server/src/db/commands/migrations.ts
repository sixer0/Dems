/**
 * The migration set and its ledger (database contract §8.1, §8.2; decision D38; plan row W17).
 *
 * The files live in `../migrations`: four files for schema version 1, written by `drizzle-kit`
 * 0.31.11 (`generate` and `generate --custom`) and applied in journal order by the Drizzle
 * migrator, as the owner role (MG-9), in ONE transaction for the whole pending set.
 *
 * WHY THIS MODULE COMPARES HASHES ITSELF (D38). The migrator decides what is pending by the
 * journal time of a file, not by its name or content: a file that was edited after it was
 * applied is not noticed, and a file whose journal time is older than the newest applied one is
 * skipped without a message. Rule MG-4 ("an applied file is never edited") is therefore not
 * enforced by the tool. `inspectLedger` enforces it: it compares the SHA-256 of every file with
 * the hash the migrator stored when it applied the file. `db:status` reports the result and
 * exits non-zero on a mismatch; `db:migrate` refuses to run on one.
 *
 * The migrator's bookkeeping table is `drizzle.__drizzle_migrations`, owned by the owner role.
 * The runtime role has no privilege on that schema (OW-5), so this check needs an OWNER pool;
 * the server's own boot check reads `schema_meta` instead (B-3).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../schema';
import { DbCommandError } from './owner-connection';

/** Absolute path of the migration folder (`src/db/migrations`). */
export const MIGRATIONS_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
/** The migrator's default bookkeeping table: the one exception to "everything is in `public`" (D38). */
export const MIGRATIONS_SCHEMA = 'drizzle';
export const MIGRATIONS_TABLE = '__drizzle_migrations';
/**
 * The ten files of schema version 3, in order: dbc-3 §A.1, the R-8 pair (§B.13 / row 112), and
 * migration set 4 of dbc-4 §N.8 (row 129) - `0008` generated, `0009` hand-written. The eleventh
 * file is migration set 5 (row 129a, erratum PE-129a-01): `0010`, hand-written, schema version 4.
 * Files twelve and thirteen are migration set 6 (row 129b, erratum PE-129b-01): `0011` generated,
 * `0012` hand-written, schema version 5. Files fourteen and fifteen are migration set 7 (erratum
 * PE-0013-01; rulings D146, D162, D166): `0013` generated, `0014` hand-written, schema version 6.
 * Files sixteen and seventeen are migration set 8 (schema set A of task 4, contract revision
 * `dbc-8`): `0015` generated, `0016` hand-written, schema version 7. Files eighteen and nineteen
 * are migration set 9 (schema set B of task 4, contract revision `dbc-9`): `0017` generated,
 * `0018` hand-written, schema version 8. Files twenty and twenty-one are migration set 10 (task 4
 * package X-C, contract revision `dbc-10`): `0019` generated, `0020` hand-written, schema version 9.
 * Files twenty-two to twenty-four are migration set 11 (the element CHECK on
 * `capture_devices.profiles`, contract revision `dbc-11`): `0021` hand-written (the data step,
 * which must run before the CHECK), `0022` generated, `0023` hand-written, schema version 10.
 * Files twenty-five and twenty-six are migration set 12 (schema set C of task 4, contract revision
 * `dbc-12`): `0024` generated, `0025` hand-written, schema version 11. Files twenty-seven and
 * twenty-eight are migration set 13 (the honest removal reasons of a temporary host address,
 * contract revision `dbc-13`): `0026` generated, `0027` hand-written, schema version 12. Files
 * twenty-nine and thirty are migration set 14 (the further removal reason `ADD_UNCONFIRMED`,
 * contract revision `dbc-14`): `0028` generated, `0029` hand-written, schema version 13. Files
 * thirty-one and thirty-two are migration set 15 (the allowed ONVIF ports of the network settings
 * and the widened form of an interface name, contract revision `dbc-15`): `0030` generated,
 * `0031` hand-written, schema version 14. Files thirty-three and thirty-four are migration set 16
 * (retiring a capture device, design 07 of task 4, decision C147, contract revision `dbc-16`):
 * `0032` generated, `0033` hand-written, schema version 15.
 */
export const INITIAL_MIGRATION_TAGS = [
  '0000_prelude',
  '0001_tables',
  '0002_audit_guards',
  '0003_privileges',
  '0004_capture',
  '0005_capture_privileges',
  '0006_stt_config',
  '0007_stt_config_privileges',
  '0008_capture_sources',
  '0009_capture_sources_privileges',
  '0010_credential_replace_privileges',
  '0011_session_stt_config',
  '0012_session_stt_config_privileges',
  '0013_key_id_fault_reason_media_root',
  '0014_key_id_fault_reason_media_root_privileges',
  '0015_capture_streams_audio_inputs',
  '0016_capture_streams_audio_inputs_privileges',
  '0017_network_commissioning',
  '0018_network_commissioning_privileges',
  '0019_credential_replaced_reason',
  '0020_credential_replaced_reason_privileges',
  '0021_profile_codes_data',
  '0022_profile_codes',
  '0023_profile_codes_privileges',
  '0024_installation_acceptance',
  '0025_installation_acceptance_privileges',
  '0026_alias_removal_reasons',
  '0027_alias_removal_reasons_privileges',
  '0028_alias_removal_reason_unconfirmed',
  '0029_alias_removal_reason_unconfirmed_privileges',
  '0030_network_config_onvif_ports',
  '0031_network_config_onvif_ports_privileges',
  '0032_capture_device_retirement',
  '0033_capture_device_retirement_privileges',
  '0034_capture_config_supervisor_revocation',
  '0035_operator_administration_privileges',
  '0036_operator_purge',
  '0037_operator_credential_creation',
  '0038_operator_purge_reseal_correction',
  '0039_four_video_tracks', // D60 (2026-11-04): four simultaneous video tracks
  '0040_four_audio_channels', // D61 (2026-11-04): four simultaneous microphone channels
  '0041_capture_widening_privileges', // D60/D61 follow-up (2026-11-05): the column UPDATE of the six new selector columns, missing from the widening
  '0042_capture_config_constraint_repair', // KD-46 / DF-30 (2026-11-05, D22(1)): idempotent repair of the selector key names an edit of applied 0039/0040 left behind
  '0043_operator_purge_scope', // DF-28 (2026-11-05, D22(4), D38 DR-1, D43; row 95): the purge keeps the evidence-chain audit types and a disabled account row when they name it
  '0044_recording_fragments_audio_tracks', // D28 DQ-1 = S1 (2026-11-05, row 146): recording_fragments takes the AUDIO-01..04 channel files, same fragment-hash protection as the camera files
] as const;

export interface MigrationFile {
  readonly idx: number;
  /** The file name without `.sql`. */
  readonly tag: string;
  /** The journal time: what the migrator stores as `created_at` and decides "pending" by. */
  readonly when: number;
  /** SHA-256 of the file's text, computed exactly as the migrator computes its stored hash. */
  readonly sha256: string;
  readonly bytes: number;
  readonly file: string;
}

interface JournalEntry {
  readonly idx?: unknown;
  readonly when?: unknown;
  readonly tag?: unknown;
}

/**
 * Reads the journal and the files of a migration folder, in journal order. Throws when the set
 * itself is unusable: no journal, a missing file, or journal times that do not rise with the
 * index (the migrator would then skip a file silently).
 */
export function readMigrationSet(folder: string = MIGRATIONS_FOLDER): MigrationFile[] {
  const journalFile = join(folder, 'meta', '_journal.json');
  if (!existsSync(journalFile)) {
    throw new DbCommandError('MIGRATION_SET_INVALID', `${journalFile} does not exist: there is no migration set to read.`);
  }
  let entries: JournalEntry[];
  try {
    const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as { entries?: JournalEntry[] };
    entries = Array.isArray(journal.entries) ? journal.entries : [];
  } catch {
    throw new DbCommandError('MIGRATION_SET_INVALID', `${journalFile} is not valid JSON.`);
  }

  const files: MigrationFile[] = [];
  for (const entry of entries) {
    const { idx, when, tag } = entry;
    if (typeof idx !== 'number' || typeof when !== 'number' || typeof tag !== 'string' || !/^[0-9]{4}_[a-z0-9_]+$/.test(tag)) {
      throw new DbCommandError('MIGRATION_SET_INVALID', `${journalFile}: an entry has no valid idx, when or tag.`);
    }
    const file = join(folder, `${tag}.sql`);
    if (!existsSync(file)) {
      throw new DbCommandError('MIGRATION_SET_INVALID', `${file} is named by the journal and does not exist.`);
    }
    const text = readFileSync(file).toString();
    files.push({
      idx,
      tag,
      when,
      sha256: createHash('sha256').update(text).digest('hex'),
      bytes: Buffer.byteLength(text),
      file,
    });
  }

  files.forEach((file, position) => {
    const previous = files[position - 1];
    if (file.idx !== position || (previous !== undefined && file.when <= previous.when)) {
      throw new DbCommandError(
        'MIGRATION_SET_INVALID',
        `${journalFile}: entry ${file.tag} is out of order (index ${file.idx} at position ${position}, or a journal time that does not rise). The migrator would skip it without a message.`,
      );
    }
  });
  return files;
}

export interface AppliedMigration {
  readonly id: number;
  readonly hash: string;
  readonly createdAt: number;
}

/** The rows of the migrator's table, oldest first; `null` when the table does not exist yet. */
export async function readAppliedMigrations(pool: Pool): Promise<AppliedMigration[] | null> {
  const present = await pool.query<{ present: boolean }>('SELECT to_regclass($1) IS NOT NULL AS present', [
    `${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`,
  ]);
  if (present.rows[0]?.present !== true) return null;
  const { rows } = await pool.query<{ id: number; hash: string; created_at: string | null }>(
    `SELECT id, hash, created_at FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} ORDER BY created_at, id`,
  );
  return rows.map((row) => ({ id: row.id, hash: row.hash, createdAt: Number(row.created_at) }));
}

export type LedgerState = 'applied' | 'pending' | 'edited' | 'skipped';

export interface LedgerEntry extends MigrationFile {
  /**
   * `applied`: the stored hash equals the file's. `pending`: not applied, and the migrator will
   * apply it. `edited`: applied, and the file's hash differs from the stored one (MG-4 broken).
   * `skipped`: not applied, and the migrator would never apply it (its journal time is not newer
   * than the newest applied migration).
   */
  readonly state: LedgerState;
  readonly storedHash: string | null;
}

export interface LedgerReport {
  /** False while the migrator's table does not exist: nothing was ever applied. */
  readonly tablePresent: boolean;
  readonly entries: readonly LedgerEntry[];
  /** Applied rows that no file of the set accounts for. */
  readonly unknownApplied: readonly AppliedMigration[];
  readonly pending: readonly string[];
  /** One sentence per problem. Empty when the ledger and the files agree. */
  readonly problems: readonly string[];
  readonly ok: boolean;
}

const short = (hash: string): string => hash.slice(0, 16);

/** Pure: compares a migration set with the rows of the migrator's table. */
export function compareLedger(files: readonly MigrationFile[], applied: readonly AppliedMigration[] | null): LedgerReport {
  const rows = applied ?? [];
  const byTime = new Map(rows.map((row) => [row.createdAt, row] as const));
  const newest = rows.reduce((max, row) => Math.max(max, row.createdAt), Number.NEGATIVE_INFINITY);
  const problems: string[] = [];

  const entries = files.map((file): LedgerEntry => {
    const row = byTime.get(file.when);
    if (row !== undefined) {
      if (row.hash === file.sha256) return { ...file, state: 'applied', storedHash: row.hash };
      problems.push(
        `${file.tag}.sql was edited after it was applied: the file's SHA-256 is ${short(file.sha256)}..., the stored hash is ${short(row.hash)}.... An applied file is never edited; a correction is a new file (MG-4).`,
      );
      return { ...file, state: 'edited', storedHash: row.hash };
    }
    if (file.when <= newest) {
      problems.push(
        `${file.tag}.sql is not applied and never will be: its journal time is not newer than the newest applied migration, so the migrator skips it without a message.`,
      );
      return { ...file, state: 'skipped', storedHash: null };
    }
    return { ...file, state: 'pending', storedHash: null };
  });

  const known = new Set(files.map((file) => file.when));
  const unknownApplied = rows.filter((row) => !known.has(row.createdAt));
  for (const row of unknownApplied) {
    problems.push(
      `The database holds an applied migration (hash ${short(row.hash)}..., journal time ${row.createdAt}) that no file of this migration set accounts for.`,
    );
  }

  return {
    tablePresent: applied !== null,
    entries,
    unknownApplied,
    pending: entries.filter((entry) => entry.state === 'pending').map((entry) => entry.tag),
    problems,
    ok: problems.length === 0,
  };
}

/** Reads both sides and compares them. Needs an owner pool (the runtime role cannot read the table). */
export async function inspectLedger(pool: Pool, folder: string = MIGRATIONS_FOLDER): Promise<LedgerReport> {
  return compareLedger(readMigrationSet(folder), await readAppliedMigrations(pool));
}

/**
 * A check built on the ledger: resolves when every file of the set is applied with its own
 * hash, and throws `MIGRATION_LEDGER_MISMATCH` or `SCHEMA_NOT_CURRENT` otherwise. It needs an
 * OWNER pool, so it is a check of the commands, of the reset routine (R-6) and of the tests,
 * not one of the runtime role's boot checks.
 */
export async function assertLedgerCurrent(pool: Pool, folder: string = MIGRATIONS_FOLDER): Promise<LedgerReport> {
  const report = await inspectLedger(pool, folder);
  if (!report.ok) throw new DbCommandError('MIGRATION_LEDGER_MISMATCH', report.problems.join(' '));
  if (report.pending.length > 0) {
    throw new DbCommandError(
      'SCHEMA_NOT_CURRENT',
      `${report.pending.length} migration(s) are not applied (${report.pending.join(', ')}). Run "npm run db:migrate".`,
    );
  }
  return report;
}

export interface SchemaVersion {
  readonly schemaVersion: number;
  readonly contractRevision: string;
}

/** The row of `schema_meta`; `null` when the table or its row does not exist (not migrated). */
export async function readSchemaVersion(pool: Pool): Promise<SchemaVersion | null> {
  const present = await pool.query<{ present: boolean }>("SELECT to_regclass('public.schema_meta') IS NOT NULL AS present");
  if (present.rows[0]?.present !== true) return null;
  const { rows } = await pool.query<{ schema_version: number; contract_revision: string }>(
    'SELECT schema_version, contract_revision FROM public.schema_meta',
  );
  const row = rows[0];
  return row === undefined ? null : { schemaVersion: row.schema_version, contractRevision: row.contract_revision };
}

export interface MigrateResult {
  readonly versionBefore: SchemaVersion | null;
  readonly versionAfter: SchemaVersion;
  /** The tags this call applied, in order. Empty for a second run (MG-10, AC-B-01). */
  readonly applied: readonly string[];
  readonly ledger: LedgerReport;
}

/**
 * Applies the pending migrations of `folder` through an OWNER pool on the target database.
 *
 * Before: the ledger must agree with the files (an edited or skipped file stops the call; the
 * migrator alone would not notice). After: every file is applied with its own hash and
 * `schema_meta` holds the version this code expects. A failure inside the set rolls the whole
 * pending set back: the migrator runs it in one transaction.
 */
export async function applyMigrations(pool: Pool, folder: string = MIGRATIONS_FOLDER): Promise<MigrateResult> {
  const versionBefore = await readSchemaVersion(pool);
  const before = await inspectLedger(pool, folder);
  if (!before.ok) throw new DbCommandError('MIGRATION_LEDGER_MISMATCH', before.problems.join(' '));

  await migrate(drizzle(pool), { migrationsFolder: folder });

  const ledger = await assertLedgerCurrent(pool, folder);
  const versionAfter = await readSchemaVersion(pool);
  if (
    versionAfter === null ||
    versionAfter.schemaVersion !== DB_SCHEMA_VERSION ||
    versionAfter.contractRevision !== DB_CONTRACT_REVISION
  ) {
    throw new DbCommandError(
      'SCHEMA_VERSION_MISMATCH',
      `After the migration the database is at schema version ${versionAfter?.schemaVersion ?? 'none'} (${versionAfter?.contractRevision ?? 'none'}); this code expects ${DB_SCHEMA_VERSION} (${DB_CONTRACT_REVISION}). The last file of a migration set sets the version (MG-5).`,
    );
  }
  return { versionBefore, versionAfter, applied: before.pending, ledger };
}
