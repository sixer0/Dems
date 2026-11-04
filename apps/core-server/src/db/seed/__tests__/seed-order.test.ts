// The statements of a seed, in order (plan row W20; database contract §9.5, AP-2, AP-4, SD-6).
// Database-free: `writeSeed` runs against an executor that records what it is asked to do.
import { GENESIS_HASH } from '@dems/shared/sim';
import { getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { prepareSeed, writeSeed, type PreparedSeed } from '../seed';
import type { RowExecutor } from '../../store';
import { FIXED_NOW } from '../../../../test/support/seed';

interface Recorded {
  readonly statement: 'lock' | 'select' | 'insert';
  readonly table: string;
  readonly rows: number;
  readonly firstSeq?: number;
}

/**
 * A stand-in executor. It answers the chain lock with `head`, the count of `core_state` with
 * `seeded`, and the final read of the chain head with whatever the audit inserts moved it to
 * (as the guard trigger does).
 */
function recorder(options: { head?: { seq: number; hash: string }; seeded?: number } = {}): { executor: RowExecutor; log: Recorded[] } {
  const log: Recorded[] = [];
  let head = options.head ?? { seq: 0, hash: GENESIS_HASH };
  const executor = {
    execute: async () => {
      log.push({ statement: 'lock', table: 'audit_chain_head', rows: 1 });
      return { rows: [{ seq: String(head.seq), hash: head.hash }] };
    },
    select: () => ({
      from: async (table: PgTable) => {
        const name = getTableName(table);
        log.push({ statement: 'select', table: name, rows: 1 });
        if (name === 'core_state') return [{ rows: String(options.seeded ?? 0) }];
        if (name === 'audit_chain_head') return [{ singleton: true, seq: head.seq, hash: head.hash }];
        return [];
      },
    }),
    insert: (table: PgTable) => ({
      values: async (value: Record<string, unknown> | Record<string, unknown>[]) => {
        const name = getTableName(table);
        const rows = Array.isArray(value) ? value : [value];
        const first = rows[0];
        if (name === 'audit_log' && first !== undefined) {
          // The guard trigger: a row must continue the head, which then moves.
          if (first['seq'] !== head.seq + 1 || first['prevHash'] !== head.hash) throw Object.assign(new Error('guard'), { code: 'ZA001' });
          head = { seq: first['seq'] as number, hash: first['hash'] as string };
        }
        log.push({ statement: 'insert', table: name, rows: rows.length, ...(name === 'audit_log' ? { firstSeq: first?.['seq'] as number } : {}) });
      },
    }),
  };
  return { executor: executor as unknown as RowExecutor, log };
}

const fastHasher = async () => ({ algorithm: 'argon2id' as const, memoryKib: 19_456, passes: 2, parallelism: 1, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2) });

/** Consecutive inserts into one table as one entry: `audit_log` is 82 single-row statements. */
function tablesInOrder(log: readonly Recorded[]): string[] {
  const tables: string[] = [];
  for (const entry of log) {
    if (entry.statement === 'insert' && tables[tables.length - 1] !== entry.table) tables.push(entry.table);
  }
  return tables;
}

describe('the write order of the seed is the contract\'s (§9.5)', () => {
  let prepared: PreparedSeed;

  it('scenario idle: 22 tables, in order; active_session and alerts are not written', async () => {
    prepared = await prepareSeed({ now: FIXED_NOW }, { hashPassword: fastHasher });
    const { executor, log } = recorder();
    await writeSeed(executor, prepared);
    expect(tablesInOrder(log)).toEqual([
      'roles',
      'permissions',
      'role_permissions',
      'operators',
      'operator_credentials',
      'core_device',
      'core_state',
      'storage_policy',
      'console_settings',
      'stt_config',
      'capture_devices',
      'capture_config',
      'engine_counters',
      'registry_counters',
      'hardware_snapshot',
      'session_history',
      'evidence_items',
      'evidence_tracks',
      'evidence_custody',
      'exports',
      'audit_log',
      'events',
    ]);
    // 312 rows: the 299 of contract §9.4 (v1 vocabulary) less the two rows the migrations wrote,
    // plus the 6 rows of the v2 RBAC vocabulary (14 permissions + 22 grants, dbc-3 §E.3; row 49),
    // the one `stt_config` row of row 114, and the six site-config rows of CS-21 (five built-in
    // devices and the one selector, dbc-3 §E.3).
    // Fix wave J (truth rule 3a): 308 since the seed's one never-sealed item writes no track row (4 fewer).
    // Task 4 row 100: 310 - the commissioning permission and its one grant (15 permissions + 23 grants).
    expect(log.filter((entry) => entry.statement === "insert").reduce((sum, entry) => sum + entry.rows, 0)).toBe(311); // D60 (2026-11-04): 311 - the four-track capture seed writes one insert row more than the two-track set (four built-in cameras on the widened selector row)
  });

  it('the chain lock is the first statement (AP-2), before the "not seeded yet" check and before any write (AP-7)', async () => {
    const { executor, log } = recorder();
    await writeSeed(executor, prepared);
    expect(log.slice(0, 3).map((entry) => `${entry.statement} ${entry.table}`)).toEqual(['lock audit_chain_head', 'select core_state', 'insert roles']);
    expect(log.filter((entry) => entry.statement === 'lock')).toHaveLength(1);
    // The last statement reads the head the guard trigger moved, to compare it with the dataset's.
    expect(log.at(-1)).toMatchObject({ statement: 'select', table: 'audit_chain_head' });
  });

  it('the audit rows: one INSERT per row, in ascending sequence 1 to 82 (AP-4); nothing is written to the lineage or the head', async () => {
    const { executor, log } = recorder();
    await writeSeed(executor, prepared);
    const audit = log.filter((entry) => entry.statement === 'insert' && entry.table === 'audit_log');
    expect(audit).toHaveLength(82);
    expect(audit.every((entry) => entry.rows === 1)).toBe(true);
    expect(audit.map((entry) => entry.firstSeq)).toEqual(Array.from({ length: 82 }, (_, index) => index + 1));
    const written = new Set(log.filter((entry) => entry.statement === 'insert').map((entry) => entry.table));
    expect(written.has('audit_chain_history')).toBe(false);
    expect(written.has('audit_chain_head')).toBe(false);
    expect(written.has('schema_meta')).toBe(false);
    for (const table of ['auth_sessions', 'pairing_codes', 'paired_devices', 'device_credentials', 'biometric_tokens', 'health_snapshots']) {
      expect(written.has(table), table).toBe(false);
    }
  });

  it.each([
    ['recording', ['active_session'], 218],
    ['finalizing', ['active_session'], 231],
    ['fault-demo', ['active_session', 'alerts'], 229],
  ] as const)('scenario %s: %j come after exports and before the audit log; %i audit rows', async (scenario, extra, auditRows) => {
    const scenarioSeed = await prepareSeed({ now: FIXED_NOW, scenario }, { hashPassword: fastHasher });
    const { executor, log } = recorder();
    await writeSeed(executor, scenarioSeed);
    const tables = tablesInOrder(log);
    expect(tables.slice(tables.indexOf('exports'))).toEqual(['exports', ...extra, 'audit_log', 'events']);
    expect(log.filter((entry) => entry.table === 'audit_log' && entry.statement === 'insert')).toHaveLength(auditRows);
  });

  it('a database whose chain is not at its genesis, or whose core_state has a row, is refused before the first write', async () => {
    for (const options of [{ head: { seq: 82, hash: 'a'.repeat(64) } }, { seeded: 1 }, { head: { seq: 0, hash: 'b'.repeat(64) } }]) {
      const { executor, log } = recorder(options);
      await expect(writeSeed(executor, prepared)).rejects.toMatchObject({ code: 'ALREADY_SEEDED' });
      expect(log.filter((entry) => entry.statement === 'insert')).toEqual([]);
    }
  });

  it('a head that does not end at the dataset\'s head after the last row fails the seed (the caller rolls back)', async () => {
    const { executor } = recorder();
    const wrong: PreparedSeed = { ...prepared, expectedHead: { seq: 82, hash: 'c'.repeat(64) } };
    await expect(writeSeed(executor, wrong)).rejects.toMatchObject({ code: 'VERIFY_FAILED' });
  });

  it('a refused statement becomes a SeedError that names the table and the SQLSTATE, and nothing of the row', async () => {
    const { executor } = recorder();
    const failing = {
      ...executor,
      insert: (table: PgTable) => ({
        values: async (value: unknown) => {
          if (getTableName(table) === 'operator_credentials') {
            throw Object.assign(new Error('Failed query: insert into "operator_credentials" ... params: OPR-001,argon2id,…'), {
              cause: Object.assign(new Error('new row violates check constraint'), { code: '23514', constraint: 'operator_credentials_lengths_check' }),
            });
          }
          return (executor as unknown as { insert: (t: PgTable) => { values: (v: unknown) => Promise<void> } }).insert(table).values(value);
        },
      }),
    } as unknown as RowExecutor;
    const attempt = writeSeed(failing, prepared);
    await expect(attempt).rejects.toMatchObject({ code: 'WRITE_FAILED' });
    await expect(attempt).rejects.toThrow(/^the seed was not written: WRITE_FAILED: operator_credentials: the statement was refused\.$/);
  });
});
