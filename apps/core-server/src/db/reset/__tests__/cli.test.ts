// `db:reset`: the wrong calls and the pure parts (plan row W29; database contract §8.4).
// Database-free: every call below is refused BEFORE a connection is opened, so no test of this
// file can reach a database. The names `dems_demo` and `dems_lane_3` appear only in calls that
// stop at the owner connection file of a directory that does not exist.
import { describe, expect, it } from 'vitest';
import type { CommandIo } from '../../commands/cli';
import { ResetUsageError, formatResetReport, parseResetArguments, resetUsage, runReset } from '../cli';
import type { ResetReport } from '../routine';

function capture(): { io: CommandIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

/** A data directory that does not exist: if a call got as far as the owner file, it would say so. */
const NO_DATA_DIR = '/nonexistent/dems-w29';
const USAGE =
  'usage: npm run db:reset -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3> [--scenario <idle|recording|finalizing|fault-demo>] [--discard-unsealed-fake-recordings]';

describe('db:reset: the arguments', () => {
  it('--database is required; --scenario is optional; both forms of each are accepted', () => {
    expect(resetUsage()).toBe(USAGE);
    expect(parseResetArguments(['--database', 'dems_lane_1'])).toEqual({ database: 'dems_lane_1', scenario: undefined });
    expect(parseResetArguments(['--database=dems_lane_1'])).toEqual({ database: 'dems_lane_1', scenario: undefined });
    expect(parseResetArguments(['--database', 'dems_lane_1', '--scenario', 'recording'])).toEqual({ database: 'dems_lane_1', scenario: 'recording' });
    expect(parseResetArguments(['--scenario=fault-demo', '--database=dems_demo'])).toEqual({ database: 'dems_demo', scenario: 'fault-demo' });
  });

  it.each([
    ['no argument', []],
    ['--database without a name', ['--database']],
    ['--database followed by another option', ['--database', '--scenario', 'idle']],
    ['an empty name', ['--database=']],
    ['the name given twice', ['--database', 'dems_lane_1', '--database', 'dems_lane_2']],
    ['the scenario given twice', ['--database', 'dems_lane_1', '--scenario', 'idle', '--scenario=recording']],
    ['--scenario without a name', ['--database', 'dems_lane_1', '--scenario']],
    ['only a scenario', ['--scenario', 'idle']],
    ['a positional argument', ['dems_lane_1']],
    ['an unknown option', ['--database', 'dems_lane_1', '--force']],
    ['an actor option (the command line has no actor)', ['--database', 'dems_lane_1', '--actor', 'OPR-002']],
  ])('%s: usage', (_label, argv) => {
    expect(() => parseResetArguments(argv)).toThrow(ResetUsageError);
  });
});

describe('db:reset: a wrong call exits 2 before anything is read', () => {
  it.each([
    ['no argument', []],
    ['an unknown option', ['--database', 'dems_lane_1', '--force']],
    ['the name given twice', ['--database', 'dems_lane_1', '--database', 'dems_lane_2']],
  ])('%s: usage', async (_label, argv) => {
    const { io, out, err } = capture();
    let clockReads = 0;
    const code = await runReset(argv, { io, dataDir: NO_DATA_DIR, clock: () => ((clockReads += 1), 1) });
    expect(code).toBe(2);
    expect(out).toEqual([]);
    expect(err[0]).toContain(USAGE);
    expect(clockReads).toBe(0);
  });

  it.each(['postgres', 'template0', 'template1', 'dems_demo_next', 'dems_lane_1_prev', 'dems_lane_4', 'dems_test_local_abc12345_f01_x', 'DEMS_DEMO', 'dems_demo; --'])(
    'the database name %s is refused before any connection, and is not echoed',
    async (name) => {
      const { io, out, err } = capture();
      const code = await runReset(['--database', name], { io, dataDir: NO_DATA_DIR });
      expect(code).toBe(2);
      expect(out).toEqual([]);
      expect(err).toHaveLength(1);
      expect(err[0]).toMatch(/^db:reset: refused before any connection: .* A reset takes one of dems_demo, dems_lane_1, dems_lane_2, dems_lane_3\.$/);
      if (name.length > 9) expect(err[0]).not.toContain(name);
    },
  );

  it('an unknown scenario is refused before any connection', async () => {
    const { io, out, err } = capture();
    const code = await runReset(['--database', 'dems_lane_3', '--scenario', 'night'], { io, dataDir: NO_DATA_DIR });
    expect(code).toBe(2);
    expect(out).toEqual([]);
    expect(err).toEqual(['db:reset: refused: scenario must be one of idle, recording, finalizing, fault-demo.']);
  });

  it('an accepted name with no owner connection file exits 1, names the provisioning command, and says that nothing changed', async () => {
    const { io, out, err } = capture();
    const code = await runReset(['--database', 'dems_lane_3'], { io, dataDir: NO_DATA_DIR });
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toHaveLength(2);
    expect(err[0]).toMatch(/^db:reset: .*cannot be read \(ENOENT\)\. It is created with the cluster: run "npm run pg:init"\.$/);
    expect(err[1]).toBe('db:reset: NOT RESET (RESET_OWNER_CREDENTIALS at R-0); the database is unchanged.');
  });

  it('for dems_demo the command first says that it runs under the migrate lock', async () => {
    const { io, out, err } = capture();
    // The call stops at the owner file of a directory that does not exist: nothing is connected to.
    const code = await runReset(['--database', 'dems_demo'], { io, dataDir: NO_DATA_DIR });
    expect(code).toBe(1);
    expect(out).toEqual([
      'db:reset: dems_demo is reset under the migrate lock: this command must be run as "/usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset ...".',
    ]);
    expect(err.at(-1)).toBe('db:reset: NOT RESET (RESET_OWNER_CREDENTIALS at R-0); the database is unchanged.');
  });
});

describe('db:reset: the lines of a finished reset', () => {
  const counts = { audit_chain_history: 2, audit_log: 83, auth_sessions: 3, events: 60, operators: 3, alerts: 0 };
  const report: ResetReport = {
    database: 'dems_lane_2',
    role: 'dems_owner',
    serverVersion: '18.4',
    firstBuild: false,
    now: Date.UTC(2026, 9, 1, 4, 0, 0),
    scenario: 'idle',
    reason: 'RESET',
    actorId: null,
    previousEpoch: 6,
    epoch: 7,
    kept: { registry_counters: 2, console_settings: 1, pairing_codes: 5, paired_devices: 2, device_credentials: 2, auth_sessions: 3, biometric_tokens: 3, audit_chain_history: 1 },
    cancelledPairingCodes: 1,
    operatorsWithSignIn: 2,
    lineage: {
      carried: 1,
      appended: {
        resetNo: '2',
        epoch: '6',
        headHash: 'c'.repeat(64),
        rowCount: '95',
        firstSeq: '1',
        lastSeq: '95',
        resetAt: String(Date.UTC(2026, 9, 1, 4, 0, 0)),
        actorId: null,
        reason: 'RESET',
        scenario: 'idle',
      },
      total: 2,
    },
    scenarioLoadedSeq: 83,
    auditHead: { seq: 83, hash: 'd'.repeat(64) },
    counts,
    leftoversRemoved: ['dems_lane_2_prev'],
    previousDropped: true,
    stepMs: { 'R-0': 4.2, 'R-1': 1, 'R-2': 60, 'R-3': 6, 'R-4': 35, 'R-5': 120, 'R-6': 7, 'R-7': 2, 'R-8': 60, 'R-9': 0 },
    totalMs: 295.4,
  };

  it('a reset: the epoch, the kept tables, the discarded chain with its whole head hash, the counts', () => {
    expect(formatResetReport(report)).toEqual([
      'db:reset: dems_lane_2 on PostgreSQL 18.4 as dems_owner',
      'db:reset: dataset as of 2026-10-01T04:00:00.000Z (1790827200000); scenario idle; reason RESET; actor none (command line)',
      'db:reset: epoch 6 -> 7',
      'db:reset: kept tables carried over unchanged (rows): registry_counters 2, console_settings 1, pairing_codes 5, paired_devices 2, device_credentials 2, auth_sessions 3, biometric_tokens 3, audit_chain_history 1',
      'db:reset: pairing codes that were ACTIVE, now CANCELLED: 1; operators with a last sign-in from a kept session: 2',
      `db:reset: discarded chain: reset_no 2, epoch 6, rows 95, first_seq 1, last_seq 95, head ${'c'.repeat(64)}`,
      'db:reset: SCENARIO_LOADED is audit row 83 of the new chain',
      'db:reset: removed leftovers of an earlier run: dems_lane_2_prev',
      'db:reset: done in 295 ms (R-0 4, R-1 1, R-2 60, R-3 6, R-4 35, R-5 120, R-6 7, R-7 2, R-8 60, R-9 0); the database now holds 151 row(s) in 5 of 6 table(s)',
      'row counts       6 table(s)',
      '  audit_chain_history      2',
      '  audit_log                83',
      '  auth_sessions            3',
      '  events                   60',
      '  operators                3',
      '  alerts                   0',
      'audit head       seq 83; hash dddddddddddddddd...',
      'lineage          2 row(s); 1 carried over, 1 appended',
    ]);
  });

  it('a first build: nothing carried, nothing discarded', () => {
    const lines = formatResetReport({
      ...report,
      firstBuild: true,
      previousEpoch: null,
      epoch: 0,
      lineage: { carried: 0, appended: null, total: 0 },
      scenarioLoadedSeq: null,
      leftoversRemoved: [],
      previousDropped: null,
    });
    expect(lines[2]).toBe('db:reset: first build: dems_lane_2 did not exist. Nothing was carried over and no chain was discarded; epoch 0.');
    expect(lines.filter((line) => line.includes('discarded chain') || line.includes('kept tables') || line.includes('leftovers'))).toEqual([]);
    expect(lines.at(-1)).toBe('lineage          0 row(s); 0 carried over, 0 appended');
  });

  it('a previous database that could not be dropped is said', () => {
    expect(formatResetReport({ ...report, previousDropped: false })).toContain('db:reset: the previous database could not be dropped; the next reset removes it');
  });
});
