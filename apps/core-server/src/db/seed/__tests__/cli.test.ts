// `db:seed`: the wrong calls and the pure parts (plan row W20; database contract §8.4).
// Database-free: every call below is refused BEFORE a file is read or a connection is opened,
// so no test of this file can reach a database.
import { DEFAULT_SEED, buildScenarioState, createIdleState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import type { CommandIo } from '../../commands/cli';
import { MappingError } from '../../mapping';
import { formatSeedReport, runSeed } from '../cli';
import { DatasetOptionError, buildSeedState, resolveDatasetOptions } from '../dataset';
import { SeedError, prepareSeed, type SeedReport } from '../seed';
import { EXPECTED_SEED_COUNTS, FIXED_NOW, SCENARIOS } from '../../../../test/support/seed';

function capture(): { io: CommandIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

/** A data directory that does not exist: if a call got as far as the owner file, it would say so. */
const NO_DATA_DIR = '/nonexistent/dems-w20';

describe('db:seed: a wrong call exits 2 before anything is read', () => {
  it.each([
    ['no argument', []],
    ['--database without a name', ['--database']],
    ['an unknown option', ['--database', 'dems_lane_1', '--scenario', 'recording']],
    ['the name given twice', ['--database', 'dems_lane_1', '--database', 'dems_lane_2']],
    ['a positional argument', ['dems_lane_1']],
  ])('%s: usage', async (_label, argv) => {
    const { io, out, err } = capture();
    let clockReads = 0;
    const code = await runSeed(argv, { io, dataDir: NO_DATA_DIR, clock: () => ((clockReads += 1), FIXED_NOW) });
    expect(code).toBe(2);
    expect(out).toEqual([]);
    expect(err[0]).toMatch(/^db:seed: usage: npm run db:seed -w @dems\/core-server -- --database <dems_demo\|dems_lane_1\|dems_lane_2\|dems_lane_3>/);
    expect(clockReads).toBe(0);
  });

  it.each(['postgres', 'template1', 'dems_demo_next', 'dems_test_local_abc12345_f01_x', 'DEMS_DEMO', 'dems_demo; --'])(
    'the database name %s is refused before any connection, and is not echoed',
    async (name) => {
      const { io, out, err } = capture();
      const code = await runSeed(['--database', name], { io, dataDir: NO_DATA_DIR });
      expect(code).toBe(2);
      expect(out).toEqual([]);
      expect(err).toEqual([
        'db:seed: refused before any connection: the database name is not one of dems_demo, dems_lane_1, dems_lane_2, dems_lane_3. Test databases are reachable only through the test helper.',
      ]);
    },
  );

  it('an accepted name with no owner connection file exits 1 and names the provisioning command', async () => {
    const { io, out, err } = capture();
    const code = await runSeed(['--database', 'dems_lane_3'], { io, dataDir: NO_DATA_DIR });
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toHaveLength(1);
    expect(err[0]).toMatch(/cannot be read \(ENOENT\)\. It is created with the cluster: run "npm run pg:init"\.$/);
  });
});

describe('the lines of a finished seed', () => {
  const report: SeedReport = {
    database: 'dems_demo',
    role: 'dems_owner',
    serverVersion: '18.4',
    now: FIXED_NOW,
    seed: DEFAULT_SEED,
    scenario: 'idle',
    epoch: 0,
    counts: EXPECTED_SEED_COUNTS,
    auditHead: { seq: 82, hash: 'ab'.repeat(32) },
    demoPackages: { status: 'NOT_ASKED', reason: null, message: null, items: [] },
    demoPlacement: null,
    prepareMs: 61.4,
    writeMs: 38.2,
    totalMs: 104.9,
  };

  it('name the database, the instant, the totals, every table and the audit head', () => {
    const lines = formatSeedReport(report);
    expect(lines.slice(0, 4)).toEqual([
      'db:seed: dems_demo on PostgreSQL 18.4 as dems_owner',
      'db:seed: dataset as of 2026-10-01T03:00:00.000Z (1790823600000); scenario idle; seed 20261001; epoch 0',
      'db:seed: seeded in 105 ms (dataset and hashes 61 ms, transaction 38 ms); the database now holds 312 row(s) in 24 of 48 table(s)',
      'row counts       48 table(s)',
    ]);
    // Four header lines, one line per table in the counts map (30 in v1; the map now names all 42 - T-41 of dbc-4 and T-42 of PE-129b-01 joined with 0 rows:
    // dbc-3's three capture tables and the seven v2 data tables, the last holding the single
    // stt_config row of R-8), then the audit-head line.
    expect(lines).toHaveLength(4 + Object.keys(EXPECTED_SEED_COUNTS).length + 1);
    expect(lines).toContain('  audit_log                82');
    expect(lines).toContain('  events                   59');
    expect(lines).toContain('  audit_chain_history      0');
    expect(lines.at(-1)).toBe('audit head       seq 82; hash abababababababab...');
    // 314 rows: the landed seed total (was 301 in contract §9.4 of the closed task-2 docs; the
    // v2 additions are +2 permissions, +4 grants — rows 47/49 — the capture selector row and the
    // five built-in devices — rows 49/52 — and the stt_config singleton — row 114). The cli.db
    // suite measures exactly this total on a throw-away first build; 312 are written by the seed
    // and the rows of audit_chain_head and schema_meta come from the migrations.
    // Fix wave J (truth rule 3a): 310 - the seed's never-sealed item has no track row (4 fewer than 314).
    // Task 4 row 100: 312 - the commissioning permission and its one grant (+1 permission, +1 grant).
    expect(Object.values(EXPECTED_SEED_COUNTS).reduce((sum, rows) => sum + rows, 0)).toBe(312);
  });
});

describe('the dataset of a seed (SD-2)', () => {
  it('is createIdleState for idle and buildScenarioState on that baseline for the three others', () => {
    for (const scenario of SCENARIOS) {
      const expected = buildScenarioState(scenario, createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED }));
      expect(buildSeedState({ now: FIXED_NOW, scenario })).toStrictEqual(expected);
    }
    expect(buildSeedState({ now: FIXED_NOW })).toStrictEqual(createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED }));
  });

  it('the defaults: the shared seed, scenario idle, epoch 0; an epoch is carried into meta', () => {
    expect(resolveDatasetOptions({ now: FIXED_NOW })).toEqual({ now: FIXED_NOW, seed: DEFAULT_SEED, scenario: 'idle', epoch: 0 });
    expect(buildSeedState({ now: FIXED_NOW, epoch: 4 }).meta.epoch).toBe(4);
    expect(buildSeedState({ now: FIXED_NOW, seed: 7 }).meta.seed).toBe(7);
  });

  it.each([
    ['a now that is not a whole number', { now: 1.5 }],
    ['a now of zero', { now: 0 }],
    ['a now that is not a number', { now: Number.NaN }],
    ['an unknown scenario', { now: FIXED_NOW, scenario: 'paused' as never }],
    ['a negative epoch', { now: FIXED_NOW, epoch: -1 }],
    ['a seed that is not an integer', { now: FIXED_NOW, seed: 0.5 }],
  ])('refuses %s', (_label, options) => {
    expect(() => resolveDatasetOptions(options)).toThrow(DatasetOptionError);
  });
});

describe('prepareSeed: everything a seed writes, before a transaction is open', () => {
  it('hands the hasher the demo password once per operator and puts only the hash record into a row', async () => {
    const received: string[] = [];
    const prepared = await prepareSeed(
      { now: FIXED_NOW },
      {
        hashPassword: async (password) => {
          received.push(password);
          const marker = received.length;
          return { algorithm: 'argon2id', memoryKib: 19_456, passes: 2, parallelism: 1, salt: Buffer.alloc(16, marker), hash: Buffer.alloc(32, marker) };
        },
      },
    );
    expect(received).toHaveLength(3);
    expect(new Set(received).size).toBe(1);
    const password = received[0] ?? '';
    expect(password.length).toBeGreaterThan(0);

    expect(prepared.credentials.map((row) => row.operatorId)).toEqual(['OPR-001', 'OPR-002', 'OPR-003']);
    expect(prepared.credentials.map((row) => row.salt[0])).toEqual([1, 2, 3]);
    expect(prepared.credentials.every((row) => row.hashedAt === FIXED_NOW && row.algorithm === 'argon2id')).toBe(true);
    // Nothing that was prepared holds the password: not as text, not as the bytes of the text.
    const everything = JSON.stringify({ ...prepared, state: prepared.state, credentials: prepared.credentials.map((row) => ({ ...row, salt: row.salt.toString('latin1'), hash: row.hash.toString('latin1') })) });
    expect(everything.split(password).length - 1).toBe(0);
    expect(prepared.registryCounters).toEqual([
      { name: 'device', nextValue: 1 },
      { name: 'pairingCode', nextValue: 1 },
    ]);
    expect(prepared.expectedHead).toEqual({ seq: 82, hash: prepared.state.audit.head });
    expect(prepared.options).toEqual({ now: FIXED_NOW, seed: DEFAULT_SEED, scenario: 'idle', epoch: 0, lastResetAt: null });
  });

  it('the real hasher gives three records with three different salts', async () => {
    const prepared = await prepareSeed({ now: FIXED_NOW });
    expect(prepared.credentials).toHaveLength(3);
    expect(new Set(prepared.credentials.map((row) => row.salt.toString('hex'))).size).toBe(3);
    expect(prepared.credentials.every((row) => row.salt.length === 16 && row.hash.length === 32 && row.memoryKib === 19_456)).toBe(true);
  });

  it('a failing hasher gives an error with a code and nothing of the input', async () => {
    const failing = prepareSeed({ now: FIXED_NOW }, { hashPassword: () => Promise.reject(Object.assign(new Error('boom: the input was …'), { code: 'DERIVATION_FAILED' })) });
    await expect(failing).rejects.toBeInstanceOf(SeedError);
    await expect(failing).rejects.toMatchObject({
      code: 'HASH_FAILED',
      message: 'the password hash of operator OPR-001 could not be derived (DERIVATION_FAILED).',
    });
  });

  it('a dataset option the builders cannot use is a SeedError, not a crash', async () => {
    await expect(prepareSeed({ now: -5 })).rejects.toMatchObject({ code: 'DATASET_INVALID' });
    expect(new MappingError('ROW_SHAPE', 'x', 'y')).toBeInstanceOf(Error);
  });
});
