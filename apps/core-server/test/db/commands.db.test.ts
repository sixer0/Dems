// The three database commands against the real server (database contract §8.4; decision D38;
// AC-B-01): `db:create`, `db:migrate`, `db:status`, each through the function its command-line
// entry calls, with its exit code and its printed lines.
//
// They are proven on databases of this test run, never on `dems_demo` (TI-17): the test passes
// `allowTestDatabase`, which no command-line entry sets. A database created here carries the
// run prefix, so the helper drops it (here, and again at teardown if a test fails).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { CommandOptions } from '../../src/db/commands/cli';
import { runCreate } from '../../src/db/commands/create';
import { runMigrate } from '../../src/db/commands/migrate';
import { INITIAL_MIGRATION_TAGS, MIGRATIONS_FOLDER, assertLedgerCurrent, readMigrationSet } from '../../src/db/commands/migrations';
import { runStatus } from '../../src/db/commands/status';
import { useTestDatabase } from '../helpers/db';
import { coreState, insertRbac, insertRow, lineageRow } from './fixtures';
import { EMPTY_DATABASE } from './support';

const db = useTestDatabase({ template: 'schema' });
const scratch: string[] = [];

afterAll(() => {
  for (const folder of scratch) rmSync(folder, { recursive: true, force: true });
});

/** Runs a command function and captures what it prints. */
async function run(command: (argv: readonly string[], options?: CommandOptions) => Promise<number>, argv: string[], options: CommandOptions = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const exitCode = await command(argv, {
    allowTestDatabase: true,
    dataDir: db.run.dataDir,
    io: { out: (line) => out.push(line), err: (line) => err.push(line) },
    ...options,
  });
  return { exitCode, out, err, text: [...out, ...err].join('\n') };
}

/** A copy of the migration folder that a test may edit. */
function copyOfMigrations(): string {
  const folder = mkdtempSync(join(tmpdir(), 'dems-w17-migrations-'));
  scratch.push(folder);
  cpSync(MIGRATIONS_FOLDER, folder, { recursive: true });
  return folder;
}

const created = (): string => `${db.run.identity.prefix}x_cmd_created`;

describe('db:create', () => {
  it('creates the database as dems_owner from the empty template, UTF8, locale C, and creates no role', async () => {
    const name = created();
    const rolesBefore = (await db.ownerPool().query('SELECT count(*)::int AS roles FROM pg_roles')).rows;
    const result = await run(runCreate, ['--database', name]);
    expect(result.err).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.out[0]).toMatch(new RegExp(`^db:create: created ${name} \\(owner dems_owner, encoding UTF8, locale C\\) on PostgreSQL 18\\.4 as dems_owner\\.$`));
    expect(result.out[1]).toBe(`db:create: next: npm run db:migrate -w @dems/core-server -- --database ${name}`);

    const facts = await db.ownerPool().query(
      `SELECT pg_get_userbyid(datdba)::text AS owner, pg_encoding_to_char(encoding)::text AS encoding, datcollate::text AS collate,
              datctype::text AS ctype, datistemplate AS template FROM pg_database WHERE datname = $1`,
      [name],
    );
    expect(facts.rows).toEqual([{ owner: 'dems_owner', encoding: 'UTF8', collate: 'C', ctype: 'C', template: false }]);
    expect((await db.ownerPool().query('SELECT count(*)::int AS roles FROM pg_roles')).rows).toEqual(rolesBefore);
  });

  it('a second run leaves the database as it is and says so', async () => {
    const result = await run(runCreate, [`--database=${created()}`]);
    expect(result.exitCode).toBe(0);
    expect(result.out).toEqual([`db:create: ${created()} already exists (owner dems_owner, encoding UTF8, locale C); nothing to do.`]);
  });
});

describe('db:migrate (AC-B-01)', () => {
  it('a database that does not exist: exit 1, naming db:create', async () => {
    const name = `${db.run.identity.prefix}x_cmd_absent`;
    const result = await run(runMigrate, ['--database', name]);
    expect(result.exitCode).toBe(1);
    expect(result.err).toEqual([
      `db:migrate: The database ${name} does not exist. Create it first: npm run db:create -w @dems/core-server -- --database ${name}`,
    ]);
  });

  it('first run on the empty database: applies the thirty-four files; prints the version before and after', async () => {
    const result = await run(runMigrate, ['--database', created()]);
    expect(result.err).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.out).toEqual([
      `db:migrate: ${created()} on PostgreSQL 18.4 as dems_owner`,
      'db:migrate: schema version before: none (not migrated)',
      `db:migrate: applied ${INITIAL_MIGRATION_TAGS.length} migration(s): ${INITIAL_MIGRATION_TAGS.join(', ')}`,
      'db:migrate: schema version after: 15 (dbc-16)',
    ]);
  });

  it('second run: no pending migration, nothing applied, exit 0', async () => {
    const result = await run(runMigrate, ['--database', created()]);
    expect(result.exitCode).toBe(0);
    expect(result.out).toEqual([
      `db:migrate: ${created()} on PostgreSQL 18.4 as dems_owner`,
      'db:migrate: schema version before: 15 (dbc-16)',
      'db:migrate: no pending migration; nothing was applied.',
      'db:migrate: schema version after: 15 (dbc-16)',
    ]);
  });
});

describe('db:status', () => {
  it('a migrated, unseeded database: exit 0; prints version, ledger, owner, triggers, head, lineage and 48 row counts', async () => {
    const result = await run(runStatus, ['--database', created()]);
    expect(result.err).toEqual([]);
    expect(result.exitCode).toBe(0);
    const files = readMigrationSet();
    expect(result.out.slice(0, 38)).toEqual([
      `database         ${created()} on PostgreSQL 18.4`,
      'owner            dems_owner; encoding UTF8; locale C',
      'schema version   15; contract revision dbc-16; this code expects 15 (dbc-16)',
      `migrations       ${INITIAL_MIGRATION_TAGS.length} file(s); ledger matches`,
      ...files.map((file) => `  ${file.tag.padEnd(20)} applied  file sha256 ${file.sha256}  stored ${file.sha256}`),
    ]);
    expect(result.out).toContain('seeded_at        not seeded');
    expect(result.out).toContain('last_reset_at    never');
    expect(result.out).toContain('audit head       seq 0; hash 0000000000000000...');
    expect(result.out).toContain('audit triggers   audit_chain_history_append_only=A, audit_log_append_only=A, audit_log_chain_guard=A');
    expect(result.out).toContain('lineage          0 row(s)');
    expect(result.out).toContain('row counts       48 table(s)');
    expect(result.out.filter((line) => /^ {2}[a-z_]+ +\d+$/.test(line))).toHaveLength(48);
    expect(result.out).toContain('  audit_chain_head         1');
    expect(result.out).toContain('  schema_meta              1');
    expect(result.out.at(-1)).toBe(`db:status: OK: ${created()} is at the schema version this code expects and the ledger matches the files.`);
  });

  it('prints seeded_at, last_reset_at and the newest lineage row once they exist (LN-4)', async () => {
    const pool = db.run.poolOn(created(), 'owner');
    try {
      await insertRbac(pool);
      await insertRow(pool, 'core_state', coreState({ last_reset_at: 1_791_000_000_000 }));
      await insertRow(pool, 'audit_chain_history', lineageRow(1));
      await insertRow(pool, 'audit_chain_history', lineageRow(2, { actor_id: 'OPR-002', reason: 'SCENARIO_LOAD', scenario: 'recording' }));
    } finally {
      await db.run.endPool(pool);
    }
    const result = await run(runStatus, ['--database', created()]);
    expect(result.exitCode).toBe(0);
    expect(result.out).toContain('seeded_at        2026-10-01T03:00:00.000Z (1790823600000)');
    expect(result.out).toContain('last_reset_at    2026-10-03T04:00:00.000Z (1791000000000)');
    expect(result.out.find((line) => line.startsWith('lineage'))).toMatch(
      /^lineage {10}2 row\(s\); newest: reset_no 2, epoch 1, rows 82, head [0-9a-f]{16}\.\.\., reset_at .* actor OPR-002, reason SCENARIO_LOAD, scenario recording$/,
    );
    expect(result.out).toContain('  audit_chain_history      2');
  });

  it('a database that exists and is not migrated: exit 1, thirty-four pending migrations', async () => {
    const empty = await db.another({ template: EMPTY_DATABASE, slug: 'cmd_empty' });
    const result = await run(runStatus, ['--database', empty.name]);
    expect(result.exitCode).toBe(1);
    expect(result.out).toContain('schema version   none (not migrated); this code expects 15 (dbc-16)');
    expect(result.out.filter((line) => / pending /.test(line))).toHaveLength(INITIAL_MIGRATION_TAGS.length);
    expect(result.err).toEqual([
      `db:status: ${INITIAL_MIGRATION_TAGS.length} migration(s) are not applied: ${INITIAL_MIGRATION_TAGS.join(', ')}. Run "npm run db:migrate".`,
      `db:status: NOT OK: 1 problem(s) on ${empty.name}.`,
    ]);
  });

  it('a database that does not exist: exit 1, naming db:create', async () => {
    const name = `${db.run.identity.prefix}x_cmd_absent`;
    const result = await run(runStatus, ['--database', name]);
    expect(result.exitCode).toBe(1);
    expect(result.err).toEqual([`db:status: The database ${name} does not exist. Create it with: npm run db:create -w @dems/core-server -- --database ${name}`]);
  });
});

describe('D38: an applied migration file that was edited is noticed by db:status and stops db:migrate', () => {
  it('the migrator alone does not notice; db:status reports the mismatch and exits 1; db:migrate refuses; the ledger check fails', async () => {
    const folder = copyOfMigrations();
    appendFileSync(join(folder, '0001_tables.sql'), '\n-- edited after it was applied\n');
    const original = readMigrationSet().find((file) => file.tag === '0001_tables');
    const edited = readMigrationSet(folder).find((file) => file.tag === '0001_tables');
    expect(edited?.sha256).not.toBe(original?.sha256);

    const status = await run(runStatus, ['--database', created()], { migrationsFolder: folder });
    expect(status.exitCode).toBe(1);
    expect(status.out).toContain(`migrations       ${INITIAL_MIGRATION_TAGS.length} file(s); ledger DOES NOT MATCH`);
    expect(status.out).toContain(`  ${'0001_tables'.padEnd(20)} edited   file sha256 ${edited?.sha256}  stored ${original?.sha256}`);
    expect(status.out.filter((line) => / applied {2}file sha256 /.test(line))).toHaveLength(INITIAL_MIGRATION_TAGS.length - 1);
    expect(status.err).toEqual([
      `db:status: 0001_tables.sql was edited after it was applied: the file's SHA-256 is ${edited?.sha256.slice(0, 16)}..., the stored hash is ${original?.sha256.slice(0, 16)}.... An applied file is never edited; a correction is a new file (MG-4).`,
      `db:status: NOT OK: 1 problem(s) on ${created()}.`,
    ]);

    const migrate = await run(runMigrate, ['--database', created()], { migrationsFolder: folder });
    expect(migrate.exitCode).toBe(1);
    expect(migrate.out).toEqual([]);
    expect(migrate.err).toHaveLength(1);
    expect(migrate.err[0]).toContain('db:migrate: 0001_tables.sql was edited after it was applied');

    // The check built on the ledger (for the reset routine and a start procedure) fails as well.
    const pool = db.run.poolOn(created(), 'owner');
    try {
      await expect(assertLedgerCurrent(pool, folder)).rejects.toMatchObject({ code: 'MIGRATION_LEDGER_MISMATCH' });
      await expect(assertLedgerCurrent(pool)).resolves.toMatchObject({ ok: true, pending: [] });
    } finally {
      await db.run.endPool(pool);
    }
    // With the real files the same database is fine again: nothing in it was changed.
    expect((await run(runStatus, ['--database', created()])).exitCode).toBe(0);
  });

  it('a file the migrator would skip (journal time older than the newest applied one) is reported, not applied silently', async () => {
    const folder = copyOfMigrations();
    const journalFile = join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as { entries: Array<{ idx: number; when: number; tag: string; version: string; breakpoints: boolean }> };
    const second = journal.entries[1]!;
    journal.entries.splice(2, 0, { idx: 2, version: '7', when: second.when + 1, tag: '0001_inserted_later', breakpoints: true });
    journal.entries.forEach((entry, index) => {
      entry.idx = index;
    });
    writeFileSync(journalFile, JSON.stringify(journal, null, 2));
    writeFileSync(join(folder, '0001_inserted_later.sql'), 'CREATE TABLE public.w17_never_created (id integer PRIMARY KEY);\n');

    const status = await run(runStatus, ['--database', created()], { migrationsFolder: folder });
    expect(status.exitCode).toBe(1);
    expect(status.out.find((line) => line.includes('0001_inserted_later'))).toMatch(/ skipped {2}file sha256 [0-9a-f]{64} {2}stored -$/);
    expect(status.err[0]).toBe(
      'db:status: 0001_inserted_later.sql is not applied and never will be: its journal time is not newer than the newest applied migration, so the migrator skips it without a message.',
    );
    const migrate = await run(runMigrate, ['--database', created()], { migrationsFolder: folder });
    expect(migrate.exitCode).toBe(1);
    const pool = db.run.poolOn(created(), 'owner');
    try {
      expect((await pool.query("SELECT to_regclass('public.w17_never_created') IS NULL AS absent")).rows).toEqual([{ absent: true }]);
    } finally {
      await db.run.endPool(pool);
    }
  });

  it('an applied migration that no file accounts for is reported', async () => {
    const folder = copyOfMigrations();
    const journalFile = join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as { entries: unknown[] };
    journal.entries.pop();
    writeFileSync(journalFile, JSON.stringify(journal, null, 2));
    const status = await run(runStatus, ['--database', created()], { migrationsFolder: folder });
    expect(status.exitCode).toBe(1);
    expect(status.out.find((line) => line.startsWith('  (no file)'))).toMatch(/unknown {2}stored [0-9a-f]{64} {2}journal time \d+$/);
    expect(status.err[0]).toMatch(/^db:status: The database holds an applied migration \(hash [0-9a-f]{16}\.\.\., journal time \d+\) that no file of this migration set accounts for\.$/);
  });

  it('a set whose journal times do not rise is refused before anything is compared', async () => {
    const folder = copyOfMigrations();
    const journalFile = join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as { entries: Array<{ when: number }> };
    journal.entries[3]!.when = journal.entries[0]!.when - 1;
    writeFileSync(journalFile, JSON.stringify(journal, null, 2));
    const status = await run(runStatus, ['--database', created()], { migrationsFolder: folder });
    expect(status.exitCode).toBe(1);
    expect(status.err[0]).toContain('entry 0003_privileges is out of order');
  });
});

describe('a failing migration set leaves nothing behind (one transaction, D38)', () => {
  it('the last file fails: no table, no migrator row, no schema version; the corrected set then applies', async () => {
    const empty = await db.another({ template: EMPTY_DATABASE, slug: 'cmd_failing' });
    const folder = copyOfMigrations();
    appendFileSync(join(folder, '0003_privileges.sql'), '\n--> statement-breakpoint\nSELECT 1 / 0;\n');
    const failed = await run(runMigrate, ['--database', empty.name], { migrationsFolder: folder });
    expect(failed.exitCode).toBe(1);
    expect(failed.err).toHaveLength(1);
    expect(failed.err[0]).toMatch(/^db:migrate: failed \(.*22012/);

    const state = await empty.ownerPool().query(
      `SELECT (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public') AS tables,
              (SELECT count(*)::int FROM pg_proc WHERE pronamespace = 'public'::regnamespace) AS functions,
              (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS applied`,
    );
    expect(state.rows).toEqual([{ tables: 0, functions: 0, applied: 0 }]);

    const ok = await run(runMigrate, ['--database', empty.name]);
    expect(ok.exitCode).toBe(0);
    expect(ok.out[2]).toBe(`db:migrate: applied ${INITIAL_MIGRATION_TAGS.length} migration(s): ${INITIAL_MIGRATION_TAGS.join(', ')}`);
  });
});

describe('cleanup', () => {
  it('the database created by db:create is dropped through the helper', async () => {
    await db.run.dropDatabase(created());
    const { rows } = await db.ownerPool().query('SELECT count(*)::int AS rows FROM pg_database WHERE datname = $1', [created()]);
    expect(rows).toEqual([{ rows: 0 }]);
  });
});
