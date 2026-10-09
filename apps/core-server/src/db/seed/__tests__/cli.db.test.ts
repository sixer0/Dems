// `db:seed` end to end on databases of the test run (plan row W20; database contract §8.4, §9).
//
// The command is proven through the function its entry file calls, with the option
// `allowTestDatabase`, which no entry point sets and no argument or environment variable
// reaches. `dems_demo` and the lanes are never touched by a test (TI-17).
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import { describe, expect, it } from 'vitest';
import { useTestDatabase, type TemplateDefinition } from '../../../../test/helpers/db';
import type { CommandIo } from '../../commands/cli';
import { runSeed } from '../cli';
import { countAllTables } from '../../store';
import { EXPECTED_SEED_COUNTS, FIXED_NOW, tableChecksums } from '../../../../test/support/seed';

const db = useTestDatabase({ template: 'schema' });

/** A database with nothing in it: created, never migrated. */
const NOT_MIGRATED: TemplateDefinition = Object.freeze({ key: 'x_w20empty', base: 'empty', build: async () => {} });

function capture(): { io: CommandIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

describe('db:seed on a freshly migrated database', () => {
  it('exits 0, reads the clock once, prints the counts of contract §9.4, and no credential', async () => {
    const { io, out, err } = capture();
    let clockReads = 0;
    const code = await runSeed(['--database', db.name], {
      io,
      dataDir: db.run.dataDir,
      allowTestDatabase: true,
      clock: () => ((clockReads += 1), FIXED_NOW),
    });
    console.log(`[w20] db:seed on ${db.name}: exit ${code}\n${[...out, ...err].map((line) => `  ${line}`).join('\n')}`);
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(clockReads).toBe(1);

    expect(out[0]).toBe(`db:seed: ${db.name} on PostgreSQL 18.4 as dems_owner`);
    expect(out[1]).toBe('db:seed: dataset as of 2026-10-01T03:00:00.000Z (1790823600000); scenario idle; seed 20261001; epoch 0');
    expect(out[2]).toMatch(/^db:seed: seeded in \d+ ms \(dataset and hashes \d+ ms, transaction \d+ ms\); the database now holds 314 row\(s\) in 24 of 42 table\(s\)$/);
    for (const [table, rows] of Object.entries(EXPECTED_SEED_COUNTS)) expect(out).toContain(`  ${table.padEnd(24)} ${rows}`);
    expect(out.at(-2)).toMatch(/^audit head       seq 82; hash [0-9a-f]{16}\.\.\.$/);
    expect(out.at(-1)).toBe(`db:seed: OK: ${db.name} is seeded. State: npm run db:status -w @dems/core-server -- --database ${db.name}`);
    expect(await countAllTables(drizzle(db.ownerPool()))).toEqual(EXPECTED_SEED_COUNTS);

    // The output holds neither the password nor any stored salt or hash.
    const printed = out.join('\n');
    const password: string = DEMO_OPERATOR_PASSWORD;
    expect(printed.split(password).length - 1).toBe(0);
    const stored = await db.ownerPool().query<{ salt: string; hash: string }>("SELECT encode(salt, 'hex') AS salt, encode(hash, 'hex') AS hash FROM operator_credentials");
    expect(stored.rows).toHaveLength(3);
    for (const row of stored.rows) {
      expect(printed.includes(row.salt)).toBe(false);
      expect(printed.includes(row.hash)).toBe(false);
      expect(printed.includes(row.hash.slice(0, 16))).toBe(false);
    }
  });

  it('a second run exits 1, says that a repeat is a reset, and writes nothing', async () => {
    const before = await tableChecksums(db.ownerPool());
    const { io, out, err } = capture();
    const code = await runSeed(['--database', db.name], { io, dataDir: db.run.dataDir, allowTestDatabase: true, clock: () => FIXED_NOW + 60_000 });
    console.log(`[w20] db:seed again on ${db.name}: exit ${code}\n${[...out, ...err].map((line) => `  ${line}`).join('\n')}`);
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      `db:seed: the database ${db.name} is already seeded (seeded_at 2026-10-01T03:00:00.000Z). Nothing was written. Seeding again is a reset.`,
      `db:seed: to rebuild the dataset: npm run db:reset -w @dems/core-server -- --database ${db.name}`,
      'db:seed: NOT SEEDED (ALREADY_SEEDED).',
    ]);
    expect(await tableChecksums(db.ownerPool())).toEqual(before);
    const seededAt = await db.ownerPool().query('SELECT seeded_at FROM core_state');
    expect(seededAt.rows).toEqual([{ seeded_at: String(FIXED_NOW) }]);
  });
});

describe('db:seed on a database that is not ready', () => {
  it('not migrated: exits 1 and names the migrate command; nothing is created', async () => {
    const empty = await db.another({ template: NOT_MIGRATED, slug: 'w20_cli_empty' });
    const { io, out, err } = capture();
    const code = await runSeed(['--database', empty.name], { io, dataDir: db.run.dataDir, allowTestDatabase: true, clock: () => FIXED_NOW });
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      `db:seed: the database ${empty.name} has no schema. Apply the migrations first: npm run db:migrate -w @dems/core-server -- --database <name>`,
      'db:seed: NOT SEEDED (NOT_MIGRATED).',
    ]);
    const tables = await empty.ownerPool().query("SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public'");
    expect(tables.rows).toEqual([{ n: '0' }]);
  });

  it('does not exist: exits 1 and names the create command', async () => {
    const missing = `${db.run.identity.prefix}f99_w20_missing`;
    const { io, out, err } = capture();
    const code = await runSeed(['--database', missing], { io, dataDir: db.run.dataDir, allowTestDatabase: true });
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      `db:seed: The database ${missing} does not exist. Create and migrate it first: npm run db:create -w @dems/core-server -- --database ${missing}`,
    ]);
  });

  it('without the test option a test database is refused before any connection (exit 2)', async () => {
    const { io, err } = capture();
    const code = await runSeed(['--database', db.name], { io, dataDir: db.run.dataDir });
    expect(code).toBe(2);
    expect(err[0]).toMatch(/^db:seed: refused before any connection:/);
  });
});
