// Database tests of the bulk fixture (plan row W25; database contract §11, BF-1 to BF-6, TI-13).
//
// The file's own database is a clone of `tpl_bulk`: the helper builds that template at this
// file's request, by cloning `tpl_seed` and running `template-hook.bulk.ts`, which loads the
// fixture as `dems_owner`. Everything asserted on it is therefore a statement about what every
// later test file gets from `useTestDatabase({ template: 'bulk' })`.
//
// What is checked: every minimum of the contract's table; the required mix, counted in SQL; that
// no constraint, trigger or index is switched off (the load itself proves that every row passes
// every constraint); the audit chain over ALL rows, links and digests; that a server can start on
// the database (the boot checks, the rehydration); determinism (a second load gives equal rows in
// all 30 tables); what the loader refuses; what the runtime role may and may not do; the variant
// with a recording session; and the build, clone and load times.
import { asc } from 'drizzle-orm';
import type { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { verifyAuditChain } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { useTestDatabase, type TestDatabase } from '../../../../test/helpers/db';
import { fromRows, verifyStoredAuditRows } from '../../mapping';
import * as schema from '../../schema';
import { BLOCKING_BOOT_CHECKS, checkStoredChain } from '../../schema/boot-checks';
import { ALL_TABLES, countAllTables, readStoredRows } from '../../store';
import { buildBulkFixture } from '../build';
import { loadBulkFixture, vacuumFixtureTables } from '../load';
import { BULK_MINIMUMS, BULK_MIX, compareWithMinimums } from '../minimums';
import { formatBulkFixtureReport } from '../report';
import { BulkFixtureError } from '../target';
import { UNICODE_SAMPLE } from '../world';
import { count, overallDigest, pureBase, sqlStateOf, tableDigests } from './support';
import { BULK_TEMPLATE_NOW, BULK_TEMPLATE_SEED } from './template-hook.bulk';

const db = useTestDatabase({ template: 'bulk' });

const LONG = 60_000;
const INSUFFICIENT_PRIVILEGE = '42501';

/**
 * Drops a clone this file loaded the fixture into. A database that has just taken thousands of
 * inserts attracts an autovacuum worker, and the owner role may not end that worker: the helper's
 * forced drop is then refused ("permission denied to terminate process"). The worker leaves by
 * itself within moments, so the drop is tried again a few times.
 */
async function dropWhenQuiet(database: TestDatabase): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await database.drop();
      return;
    } catch (error) {
      const refused = error instanceof Error && /permission denied to terminate process/.test(error.message);
      if (!refused || attempt === 8) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

describe('the bulk template: the minimums of contract §11', () => {
  it('every one of the 30 tables holds at least its minimum (entity, minimum, loaded)', async () => {
    const counts = await countAllTables(drizzle(db.ownerPool()));
    const comparison = compareWithMinimums(counts);
    expect(comparison).toHaveLength(30);
    expect(Object.keys(counts).sort()).toEqual(BULK_MINIMUMS.map((entry) => entry.table).sort());
    console.log(
      [
        `[test:db] bulk fixture on ${db.name}: entity -> minimum -> loaded`,
        ...comparison.map((entry) => `[test:db]   ${entry.table.padEnd(22)} ${String(entry.minimum).padStart(6)} ${String(entry.loaded).padStart(6)}  ${entry.met ? 'met' : 'BELOW'}`),
      ].join('\n'),
    );
    expect(comparison.filter((entry) => !entry.met)).toEqual([]);
    // The tables the contract leaves as seeded hold exactly one row; the three RBAC tables are unchanged.
    for (const table of ['storage_policy', 'console_settings', 'core_device', 'core_state', 'hardware_snapshot', 'schema_meta', 'audit_chain_head']) {
      expect(counts[table], table).toBe(1);
    }
    expect([counts['roles'], counts['permissions'], counts['role_permissions']]).toEqual([3, 12, 18]);
    expect(counts['active_session']).toBe(0);
  });

  it('operators and credentials: the mix, synthetic names, one credential row each', async () => {
    const pool = db.ownerPool();
    expect(await count(pool, "SELECT count(*) FROM operators WHERE enabled AND role_id = 'SUPERVISOR'")).toBeGreaterThanOrEqual(BULK_MIX.operators.enabledSupervisors + 1);
    expect(await count(pool, 'SELECT count(*) FROM operators WHERE NOT enabled')).toBeGreaterThanOrEqual(BULK_MIX.operators.disabled);
    expect(await count(pool, 'SELECT count(DISTINCT role_id) FROM operators')).toBe(BULK_MIX.operators.roles);
    expect(await count(pool, 'SELECT count(*) FROM operators o WHERE NOT EXISTS (SELECT 1 FROM operator_credentials c WHERE c.operator_id = o.id)')).toBe(0);
    // BF-4: every operator above the seeded three is a fixture operator, by its generated username.
    const fixture = await pool.query<{ id: string; username: string }>("SELECT id, username FROM operators WHERE id > 'OPR-003' ORDER BY id");
    expect(fixture.rows).toHaveLength(9);
    for (const row of fixture.rows) expect(row.username).toBe(`fixture.operator.${row.id.slice(4)}`);
  });

  it('auth sessions: open ones, every end reason, the reuse rule', async () => {
    const pool = db.ownerPool();
    const mix = BULK_MIX.authSessions;
    expect(await count(pool, 'SELECT count(*) FROM auth_sessions WHERE ended_at IS NULL')).toBeGreaterThanOrEqual(mix.open);
    expect(await count(pool, 'SELECT count(*) FROM auth_sessions WHERE ended_at IS NULL AND device_id IS NOT NULL')).toBeGreaterThanOrEqual(mix.openDeviceBound);
    expect(await count(pool, "SELECT count(*) FROM auth_sessions WHERE ended_at IS NULL AND method = 'BIOMETRIC'")).toBeGreaterThanOrEqual(mix.openBiometric);
    const reasons = await pool.query<{ end_reason: string; rows: string }>('SELECT end_reason, count(*) AS rows FROM auth_sessions WHERE end_reason IS NOT NULL GROUP BY 1 ORDER BY 1');
    expect(reasons.rows).toHaveLength(mix.endReasons);
    for (const row of reasons.rows) expect(Number(row.rows), row.end_reason).toBeGreaterThanOrEqual(mix.perEndReason);
    expect(await count(pool, "SELECT count(*) FROM auth_sessions WHERE end_reason = 'TOKEN_REUSE' AND (method <> 'BIOMETRIC' OR device_id IS NULL)")).toBe(0);
    // An open session is alive at the clock of the template: inside both limits, operator enabled, device paired.
    expect(
      await count(
        pool,
        `SELECT count(*) FROM auth_sessions s JOIN operators o ON o.id = s.operator_id LEFT JOIN paired_devices d ON d.id = s.device_id
          WHERE s.ended_at IS NULL AND (s.absolute_expires_at <= $1 OR s.last_seen_at < $1 - 900000 OR NOT o.enabled OR (s.device_id IS NOT NULL AND d.state <> 'PAIRED'))`,
        [BULK_TEMPLATE_NOW],
      ),
    ).toBe(0);
  });

  it('pairing codes, devices, credentials and biometric tokens: the mix', async () => {
    const pool = db.ownerPool();
    const states = async (table: string): Promise<Record<string, number>> => {
      const { rows } = await pool.query<{ state: string; rows: string }>(`SELECT state, count(*) AS rows FROM ${table} GROUP BY 1`);
      return Object.fromEntries(rows.map((row) => [row.state, Number(row.rows)]));
    };
    const codes = await states('pairing_codes');
    expect(codes['ACTIVE'] ?? 0).toBeLessThanOrEqual(BULK_MIX.pairingCodes.activeAtMost);
    expect(codes['ACTIVE']).toBe(1);
    expect(codes['REDEEMED']).toBeGreaterThanOrEqual(BULK_MIX.pairingCodes.redeemed);
    for (const state of ['CANCELLED', 'EXPIRED', 'EXHAUSTED']) expect(codes[state], state).toBeGreaterThanOrEqual(5);
    const devices = await states('paired_devices');
    expect(devices['PAIRED']).toBeGreaterThanOrEqual(BULK_MIX.pairedDevices.paired);
    expect(devices['REVOKED']).toBeGreaterThanOrEqual(BULK_MIX.pairedDevices.revoked);
    expect(devices['UNPAIRED']).toBeGreaterThanOrEqual(BULK_MIX.pairedDevices.unpaired);
    expect(await count(pool, 'SELECT count(*) FROM paired_devices d WHERE NOT EXISTS (SELECT 1 FROM device_credentials c WHERE c.device_id = d.id)')).toBe(0);
    expect(await count(pool, 'SELECT count(*) FROM device_credentials WHERE next_hash IS NOT NULL')).toBeGreaterThanOrEqual(BULK_MIX.deviceCredentials.withNextHash);

    const tokens = BULK_MIX.biometricTokens;
    const now = [BULK_TEMPLATE_NOW];
    expect(await count(pool, 'SELECT count(*) FROM biometric_tokens WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > $1', now)).toBeGreaterThanOrEqual(tokens.live);
    expect(await count(pool, 'SELECT count(*) FROM biometric_tokens WHERE used_at IS NOT NULL AND revoked_at IS NULL')).toBeGreaterThanOrEqual(tokens.used);
    expect(await count(pool, 'SELECT count(*) FROM biometric_tokens WHERE revoked_at IS NOT NULL')).toBeGreaterThanOrEqual(tokens.revoked);
    expect(await count(pool, 'SELECT count(DISTINCT revoke_reason) FROM biometric_tokens')).toBe(tokens.revokeReasons);
    expect(await count(pool, 'SELECT count(*) FROM biometric_tokens WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at <= $1', now)).toBeGreaterThanOrEqual(tokens.pastExpiry);

    // The registry counters are above the highest minted number.
    expect(await count(pool, "SELECT next_value - (SELECT max(substring(id from 5)::int) FROM paired_devices) FROM registry_counters WHERE name = 'device'")).toBeGreaterThanOrEqual(1);
    expect(await count(pool, "SELECT next_value - (SELECT max(substring(id from 5)::int) FROM pairing_codes) FROM registry_counters WHERE name = 'pairingCode'")).toBeGreaterThanOrEqual(1);
  });

  it('the audit log, the events and the lineage: the mix', async () => {
    const pool = db.ownerPool();
    const audit = BULK_MIX.auditLog;
    expect(await count(pool, 'SELECT count(DISTINCT type) FROM audit_log')).toBeGreaterThanOrEqual(audit.types);
    expect(await count(pool, 'SELECT count(DISTINCT type) FROM audit_log')).toBe(53);
    expect(await count(pool, 'SELECT count(DISTINCT category) FROM audit_log')).toBe(audit.categories);
    expect(await count(pool, 'SELECT max(rows) FROM (SELECT count(*) AS rows FROM audit_log WHERE session_id IS NOT NULL GROUP BY session_id) AS s')).toBeGreaterThanOrEqual(audit.rowsOfOneSession);
    expect(await count(pool, "SELECT count(*) FROM audit_log WHERE type = 'ACCESS_DENIED'")).toBeGreaterThanOrEqual(audit.accessDenied);
    expect(await count(pool, 'SELECT count(DISTINCT actor_id) FROM audit_log')).toBeGreaterThanOrEqual(audit.actors);
    expect(await count(pool, 'SELECT count(*) FROM audit_log WHERE evidence_id IS NOT NULL')).toBeGreaterThan(500);
    // The head: `seq` equals the row count.
    expect(await count(pool, 'SELECT (SELECT seq FROM audit_chain_head) - (SELECT count(*) FROM audit_log)')).toBe(0);

    expect(await count(pool, 'SELECT count(DISTINCT category) FROM events')).toBe(BULK_MIX.events.categories);
    expect(await count(pool, 'SELECT count(DISTINCT severity) FROM events')).toBe(BULK_MIX.events.severities);
    expect(await count(pool, "SELECT (SELECT next_value FROM engine_counters WHERE name = 'event') - (SELECT max(seq) FROM events)")).toBe(1);

    const lineage = BULK_MIX.auditChainHistory;
    const rows = await count(pool, 'SELECT count(*) FROM audit_chain_history');
    expect(await count(pool, 'SELECT max(reset_no) FROM audit_chain_history')).toBe(rows);
    expect(await count(pool, 'SELECT count(*) FROM (SELECT epoch - lag(epoch) OVER (ORDER BY reset_no) AS step FROM audit_chain_history) AS s WHERE step <= 0')).toBe(0);
    for (const reason of ['RESET', 'SCENARIO_LOAD']) {
      expect(await count(pool, 'SELECT count(*) FROM audit_chain_history WHERE reason = $1', [reason]), reason).toBeGreaterThanOrEqual(lineage.perReason);
    }
    expect(await count(pool, 'SELECT count(*) FROM audit_chain_history WHERE actor_id IS NULL')).toBeGreaterThanOrEqual(lineage.withoutActor);
    expect(await count(pool, 'SELECT count(DISTINCT scenario) FROM audit_chain_history')).toBeGreaterThanOrEqual(lineage.scenarios);
    expect(await count(pool, 'SELECT count(*) FROM audit_chain_history WHERE last_seq > row_count')).toBe(lineage.notIntact);
    expect(await count(pool, 'SELECT (SELECT epoch FROM core_state) - (SELECT max(epoch) FROM audit_chain_history)')).toBeGreaterThanOrEqual(1);
    // LN-3: the newest lineage row agrees with exactly one SCENARIO_LOADED row of the chain.
    expect(
      await count(
        pool,
        `SELECT count(*) FROM audit_log a, (SELECT head_hash, row_count FROM audit_chain_history ORDER BY reset_no DESC LIMIT 1) AS n
          WHERE a.type = 'SCENARIO_LOADED' AND a.details ->> 'previousHead' = n.head_hash AND a.details ->> 'previousRows' = n.row_count::text`,
      ),
    ).toBe(1);
  });

  it('sessions, evidence, tracks, custody and exports: the mix', async () => {
    const pool = db.ownerPool();
    const sessions = BULK_MIX.sessionHistory;
    expect(await count(pool, "SELECT count(*) FROM session_history WHERE outcome = 'SEALED'")).toBeGreaterThanOrEqual(sessions.sealed);
    expect(await count(pool, "SELECT count(*) FROM session_history WHERE outcome = 'INCOMPLETE'")).toBeGreaterThanOrEqual(sessions.incomplete);
    expect(await count(pool, 'SELECT count(*) FROM session_history s WHERE NOT EXISTS (SELECT 1 FROM evidence_items e WHERE e.session_id = s.id)')).toBeGreaterThanOrEqual(sessions.withoutEvidence);

    const evidence = BULK_MIX.evidenceItems;
    const byStatus = await pool.query<{ status: string; rows: string }>('SELECT status, count(*) AS rows FROM evidence_items GROUP BY 1');
    const status = Object.fromEntries(byStatus.rows.map((row) => [row.status, Number(row.rows)]));
    expect(status['SEALED']).toBeGreaterThanOrEqual(evidence.sealed);
    expect(status['EXPORTED']).toBeGreaterThanOrEqual(evidence.exported);
    expect(status['ARCHIVED']).toBeGreaterThanOrEqual(evidence.archived);
    expect(status['UNDER_REVIEW']).toBeGreaterThanOrEqual(evidence.underReview);
    expect(status['RECORDED']).toBeGreaterThanOrEqual(evidence.recorded);
    expect(await count(pool, 'SELECT count(*) FROM evidence_items WHERE tampered')).toBeGreaterThanOrEqual(evidence.tampered);
    expect(await count(pool, 'SELECT count(DISTINCT case_type) FROM evidence_items')).toBe(evidence.caseTypes);
    // Exactly four tracks per item, both audio tracks among them; at least two custody entries per item.
    expect(await count(pool, 'SELECT count(*) FROM evidence_items e WHERE (SELECT count(*) FROM evidence_tracks t WHERE t.evidence_id = e.id) <> 4')).toBe(0);
    expect(
      await count(pool, "SELECT count(*) FROM evidence_items e WHERE (SELECT count(*) FROM evidence_tracks t WHERE t.evidence_id = e.id AND t.track_id IN ('AUDIO-01', 'AUDIO-02')) <> 2"),
    ).toBe(0);
    expect(await count(pool, 'SELECT count(*) FROM evidence_items e WHERE (SELECT count(*) FROM evidence_custody c WHERE c.evidence_id = e.id) < 2')).toBe(0);
    expect(await count(pool, 'SELECT count(DISTINCT rows) FROM (SELECT count(*) AS rows FROM evidence_custody GROUP BY evidence_id) AS c')).toBeGreaterThanOrEqual(3);

    const exports = BULK_MIX.exports;
    expect(await count(pool, "SELECT count(*) FROM exports WHERE scope = 'EVIDENCE'")).toBeGreaterThanOrEqual(exports.evidence);
    expect(await count(pool, "SELECT count(*) FROM exports WHERE scope = 'AUDIT'")).toBeGreaterThanOrEqual(exports.audit);
    expect(await count(pool, "SELECT count(*) FROM exports WHERE scope = 'LOGS'")).toBeGreaterThanOrEqual(exports.logs);
    // Every export record has its audit row (the record is derived from it), and every EXPORTED item its record.
    expect(await count(pool, "SELECT count(*) FROM exports x WHERE NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.details ->> 'exportId' = x.id AND a.at = x.at)")).toBe(0);
    expect(await count(pool, "SELECT count(*) FROM evidence_items e WHERE e.status = 'EXPORTED' AND NOT EXISTS (SELECT 1 FROM exports x WHERE x.evidence_id = e.id)")).toBe(0);

    // The engine counters are above the highest minted number, and the export row is present.
    const counter = (name: string, highest: string): Promise<number> => count(pool, `SELECT next_value - (${highest}) FROM engine_counters WHERE name = $1`, [name]);
    expect(await counter('session', 'SELECT max(right(id, 4)::int) FROM session_history')).toBeGreaterThanOrEqual(1);
    expect(await counter('evidence', 'SELECT max(right(id, 4)::int) FROM evidence_items')).toBeGreaterThanOrEqual(1);
    expect(await counter('caseNumber', 'SELECT max(right(case_number, 4)::int) FROM session_history')).toBeGreaterThanOrEqual(1);
    expect(await counter('item', 'SELECT max(substring(id from 5)::int) FROM alerts')).toBeGreaterThanOrEqual(1);
    expect(await counter('export', 'SELECT max(substring(id from 5)::int) FROM exports')).toBeGreaterThanOrEqual(1);
    // The identifier formats bound the fixture: session and evidence suffixes stay below 9,999.
    expect(await count(pool, "SELECT next_value FROM engine_counters WHERE name = 'session'")).toBeLessThan(9_999);
  });

  it('alerts and health snapshots: the mix, and no contradiction with the seeded hardware snapshot', async () => {
    const pool = db.ownerPool();
    expect(await count(pool, 'SELECT count(*) FROM alerts WHERE active')).toBeGreaterThanOrEqual(BULK_MIX.alerts.active);
    expect(await count(pool, 'SELECT count(*) FROM alerts WHERE acknowledged')).toBeGreaterThanOrEqual(BULK_MIX.alerts.acknowledged);
    expect(await count(pool, "SELECT count(DISTINCT kind) FROM alerts WHERE kind <> 'SYSTEM'")).toBe(BULK_MIX.alerts.faultKinds);
    // The seeded snapshot holds no active fault: an active alert is a notice, never a fault.
    expect(await count(pool, "SELECT jsonb_array_length(faults -> 'active') FROM hardware_snapshot")).toBe(0);
    expect(await count(pool, "SELECT count(*) FROM alerts WHERE active AND kind <> 'SYSTEM'")).toBe(0);

    const day = [BULK_TEMPLATE_NOW - 86_400_000, BULK_TEMPLATE_NOW];
    expect(await count(pool, "SELECT count(*) FROM health_snapshots WHERE cause = 'INTERVAL'")).toBeGreaterThanOrEqual(BULK_MIX.healthSnapshots.interval);
    expect(await count(pool, "SELECT count(*) FROM health_snapshots WHERE cause <> 'INTERVAL'")).toBeGreaterThanOrEqual(BULK_MIX.healthSnapshots.fault);
    // One day of snapshots, one a minute, the newest at the clock of the template.
    expect(await count(pool, "SELECT count(*) FROM health_snapshots WHERE cause = 'INTERVAL' AND at > $1 AND at <= $2", day)).toBe(1_440);
    expect(await count(pool, "SELECT max(at) - min(at) FROM health_snapshots WHERE cause = 'INTERVAL'")).toBe(1_439 * 60_000);
  });

  it('nothing is dated after the clock of the template, and text outside ASCII and outside the BMP is stored exactly', async () => {
    const pool = db.ownerPool();
    const now = [BULK_TEMPLATE_NOW];
    for (const [table, column] of [
      ['audit_log', 'at'],
      ['events', 'at'],
      ['auth_sessions', 'issued_at'],
      ['auth_sessions', 'last_seen_at'],
      ['auth_sessions', 'ended_at'],
      ['pairing_codes', 'issued_at'],
      ['paired_devices', 'last_seen_at'],
      ['biometric_tokens', 'issued_at'],
      ['session_history', 'ended_at'],
      ['evidence_items', 'updated_at'],
      ['evidence_custody', 'at'],
      ['exports', 'at'],
      ['alerts', 'at'],
      ['health_snapshots', 'at'],
      ['audit_chain_history', 'reset_at'],
    ] as const) {
      expect(await count(pool, `SELECT count(*) FROM ${table} WHERE ${column} > $1`, now), `${table}.${column}`).toBe(0);
    }
    // The sample travels as a bind parameter and comes back from text and JSON columns unchanged.
    const sample = [`%${UNICODE_SAMPLE}%`];
    for (const [table, expression] of [
      ['operators', 'name'],
      ['paired_devices', 'revoke_reason'],
      ['session_history', 'subject_name'],
      ['evidence_items', 'subject_name'],
      ['evidence_items', 'notes::text'],
      ['evidence_custody', 'detail'],
      ['exports', 'reason'],
      ['exports', 'destination'],
      ['alerts', 'message'],
      ['audit_log', 'message'],
      ['audit_log', "details ->> 'reason'"],
    ] as const) {
      expect(await count(pool, `SELECT count(*) FROM ${table} WHERE ${expression} LIKE $1`, sample), `${table}: ${expression}`).toBeGreaterThanOrEqual(1);
    }
    expect([...UNICODE_SAMPLE].some((character) => (character.codePointAt(0) ?? 0) > 0xffff)).toBe(true);
    const stored = await pool.query<{ name: string; length: number }>("SELECT name, char_length(name) AS length FROM operators WHERE name LIKE $1", sample);
    expect(stored.rows[0]?.name.endsWith(`(${UNICODE_SAMPLE})`)).toBe(true);
    expect(stored.rows[0]?.length).toBe([...(stored.rows[0]?.name ?? '')].length);
  });
});

describe('the bulk template: every constraint holds, and nothing was switched off', () => {
  it('no constraint is NOT VALID, no trigger is disabled, no index is invalid; the three audit triggers are ENABLE ALWAYS', async () => {
    const pool = db.ownerPool();
    const constraints = await pool.query<{ kind: string; rows: string; invalid: string }>(
      `SELECT c.contype::text AS kind, count(*) AS rows, count(*) FILTER (WHERE NOT c.convalidated) AS invalid
         FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace
        WHERE n.nspname = 'public' GROUP BY 1 ORDER BY 1`,
    );
    const byKind = Object.fromEntries(constraints.rows.map((row) => [row.kind, { rows: Number(row.rows), invalid: Number(row.invalid) }]));
    // The contract's counts: 98 named CHECKs, 25 foreign keys, 30 primary keys.
    expect(byKind['c']).toEqual({ rows: 98, invalid: 0 });
    expect(byKind['f']).toEqual({ rows: 25, invalid: 0 });
    expect(byKind['p']).toEqual({ rows: 30, invalid: 0 });
    expect(constraints.rows.reduce((sum, row) => sum + Number(row.invalid), 0)).toBe(0);

    const triggers = await pool.query<{ name: string; mode: string; internal: boolean }>(
      `SELECT t.tgname::text AS name, t.tgenabled::text AS mode, t.tgisinternal AS internal
         FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid JOIN pg_namespace n ON n.oid = r.relnamespace
        WHERE n.nspname = 'public' ORDER BY 1`,
    );
    // 'D' is a disabled trigger. The foreign keys' own triggers are internal and in the default mode 'O'.
    expect(triggers.rows.filter((row) => row.mode === 'D')).toEqual([]);
    expect(triggers.rows.filter((row) => !row.internal)).toEqual([
      { name: 'audit_chain_history_append_only', mode: 'A', internal: false },
      { name: 'audit_log_append_only', mode: 'A', internal: false },
      { name: 'audit_log_chain_guard', mode: 'A', internal: false },
    ]);
    expect(triggers.rows.filter((row) => row.internal && row.mode !== 'O')).toEqual([]);

    expect(
      await count(pool, "SELECT count(*) FROM pg_index i JOIN pg_class r ON r.oid = i.indrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND NOT (i.indisvalid AND i.indisready)"),
    ).toBe(0);
  });

  it('the fixture did not update or delete an audit row: the append-only triggers refuse the owner too', async () => {
    const pool = db.ownerPool();
    const before = await tableDigests(pool);
    expect(await sqlStateOf(pool, "UPDATE audit_log SET message = 'x' WHERE false")).toBe('ZA002');
    expect(await sqlStateOf(pool, 'DELETE FROM audit_chain_history WHERE false')).toBe('ZA002');
    const after = await tableDigests(pool);
    expect(after['audit_log']).toBe(before['audit_log']);
    expect(after['audit_chain_history']).toBe(before['audit_chain_history']);
  });
});

describe('the bulk template: the audit chain verifies over all rows (BF-6)', () => {
  it('links and digests of every stored row, from the genesis hash to the head, with the shared check', async () => {
    const rows = await drizzle(db.appPool()).select().from(schema.auditLog).orderBy(asc(schema.auditLog.seq));
    const head = (await drizzle(db.appPool()).select().from(schema.auditChainHead))[0];
    expect(rows.length).toBeGreaterThanOrEqual(5_000);
    expect(head).toEqual({ singleton: true, seq: rows.length, hash: rows[rows.length - 1]?.hash });
    expect(rows[0]?.seq).toBe(1);
    // `dropped: 0`: the first row must link to the genesis hash, and every digest is recomputed.
    const verdict = verifyStoredAuditRows(rows, { dropped: 0, head: head?.hash ?? '' });
    expect(verdict).toEqual({ ok: true });
    console.log(`[test:db] bulk fixture: verifyAuditChain over all ${rows.length} stored audit rows: ok (head seq ${head?.seq}, hash ${head?.hash.slice(0, 16)}...)`);

    // The check is able to fail: one altered message in a copy, and the digest of that row is wrong.
    const altered = rows.map((row, index) => (index === 2_500 ? { ...row, message: `${row.message} [altered]` } : row));
    expect(verifyStoredAuditRows(altered, { dropped: 0, head: head?.hash ?? '' })).toEqual({ ok: false, code: 'HASH_MISMATCH', seq: 2501, reason: 'HASH_MISMATCH at sequence 2501' });
  });

  it('boot check B-8 as the runtime role, over the whole table: links, digests and the lineage rule', async () => {
    const total = await count(db.appPool(), 'SELECT count(*) FROM audit_log');
    const report = await checkStoredChain(db.appPool(), { limit: total, verifyDigests: verifyStoredAuditRows });
    expect(report).toEqual({ ok: true, rowsChecked: total, firstSeq: 1, lastSeq: total, linkBreaks: 0, digests: 'ok', lineage: 'ok', problems: [] });
    // And with the default window, the engine's ring: the newest 1,000 rows.
    const ring = await checkStoredChain(db.appPool(), { verifyDigests: verifyStoredAuditRows });
    expect(ring).toMatchObject({ ok: true, rowsChecked: 1_000, firstSeq: total - 999, lastSeq: total, digests: 'ok', lineage: 'ok' });
  });

  it('a server can start on the database: the blocking boot checks pass as the runtime role, and the state reads back', async () => {
    for (const check of BLOCKING_BOOT_CHECKS) await expect(check.run(db.appPool()), check.id).resolves.toBeUndefined();
    const slices = fromRows(await readStoredRows(drizzle(db.appPool())));
    // The rings hold the newest rows; the chain of the ring verifies with the shared check.
    expect(slices.audit.rows).toHaveLength(1_000);
    expect(slices.audit.dropped).toBe(slices.audit.total - 1_000);
    expect(verifyAuditChain(slices.audit)).toMatchObject({ ok: true, checked: 1_000 });
    expect(slices.events).toHaveLength(500);
    expect(slices.alerts).toHaveLength(100);
    expect(slices.sessionHistory.length).toBeGreaterThanOrEqual(520);
    expect(slices.evidence.length).toBeGreaterThanOrEqual(505);
    expect(slices.session).toBeNull();
    expect(slices.faults.active).toEqual([]);
    expect(slices.meta.counters.export).toBeGreaterThan(31);
    // In the ring, `at` never decreases: the engine's own order.
    expect(slices.audit.rows.every((row, index, all) => index === 0 || row.at >= (all[index - 1]?.at ?? 0))).toBe(true);
    expect(slices.events.every((event, index, all) => index === 0 || event.at >= (all[index - 1]?.at ?? 0))).toBe(true);
    // Over the whole table it decreases exactly once: after the reset marker, where the fixture's history starts.
    expect(await count(db.appPool(), 'SELECT count(*) FROM (SELECT at - lag(at) OVER (ORDER BY seq) AS step FROM audit_log) AS s WHERE step < 0')).toBe(1);
    expect(await count(db.appPool(), 'SELECT count(*) FROM (SELECT at - lag(at) OVER (ORDER BY seq) AS step FROM events) AS s WHERE step < 0')).toBe(1);
  });
});

describe('the loader', () => {
  it(
    'is deterministic: a second load on a fresh seed clone gives equal rows in all 30 tables, and the pure builder announces the same digest',
    async () => {
      const second = await db.another({ template: 'seed', slug: 'bulk_second_load' });
      const lines: string[] = [];
      const report = await loadBulkFixture(second.ownerPool(), { now: BULK_TEMPLATE_NOW, seed: BULK_TEMPLATE_SEED, log: (line) => lines.push(line) });
      const vacuumStarted = performance.now();
      await vacuumFixtureTables(second.ownerPool());
      const vacuumMs = performance.now() - vacuumStarted;
      expect(report.met).toBe(true);
      expect(report.minimums.filter((entry) => !entry.met)).toEqual([]);
      expect(report.database).toBe(second.name);
      expect(report.role).toBe('dems_owner');
      expect(lines).toEqual(formatBulkFixtureReport(report));
      expect(lines).toHaveLength(33);
      expect(lines[lines.length - 1]).toContain('every minimum of the 30 tables is met');
      console.log(lines.map((line) => `[test:db] ${line}`).join('\n'));

      // Equal rows, table by table, generated identifiers and hash columns included.
      const first = await tableDigests(db.ownerPool());
      const again = await tableDigests(second.ownerPool());
      expect(Object.keys(first)).toHaveLength(30);
      expect(again).toEqual(first);
      console.log(`[test:db] bulk fixture: digest over a stable ordered dump of all 30 tables, template clone and second load: ${overallDigest(first)} = ${overallDigest(again)}`);

      // The rows are a function of the seed, the clock and the seeded dataset alone: the builder gives the same digest with no database.
      expect(report.digest).toBe(buildBulkFixture({ now: BULK_TEMPLATE_NOW, seed: BULK_TEMPLATE_SEED }, pureBase(BULK_TEMPLATE_NOW)).digest);
      expect(report.counts).toEqual(await countAllTables(drizzle(db.ownerPool())));

      // Another seed gives other rows.
      const third = await db.another({ template: 'seed', slug: 'bulk_other_seed' });
      const other = await loadBulkFixture(third.ownerPool(), { now: BULK_TEMPLATE_NOW, seed: BULK_TEMPLATE_SEED + 1 });
      await vacuumFixtureTables(third.ownerPool());
      expect(other.met).toBe(true);
      expect(other.digest).not.toBe(report.digest);
      expect((await tableDigests(third.ownerPool()))['auth_sessions']).not.toBe(first['auth_sessions']);

      const build = db.run.templateTimings.find((timing) => timing.key === 'bulk');
      const sizeKb = async (pool: Pool): Promise<number> => Math.round((await count(pool, 'SELECT pg_database_size(current_database())')) / 1024);
      console.log(`[test:db] bulk fixture size: a clone of tpl_bulk ${await sizeKb(db.ownerPool())} kB; a clone of tpl_seed with the fixture loaded and vacuumed ${await sizeKb(second.ownerPool())} kB`);
      console.log(
        `[test:db] bulk fixture times: tpl_bulk ${build === undefined ? 'was built by another worker' : `built in ${Math.round(build.totalMs)} ms (create ${Math.round(build.createMs)} ms, hook ${Math.round(build.hookMs)} ms)`}; ` +
          `clone of tpl_bulk ${Math.round(db.timings.cloneMs)} ms (lock wait ${Math.round(db.timings.lockWaitMs)} ms); clone of tpl_seed ${Math.round(second.timings.cloneMs)} ms; ` +
          `second load ${Math.round(report.totalMs)} ms (build ${Math.round(report.buildMs)} ms, write ${Math.round(report.writeMs)} ms), vacuum and analyze ${Math.round(vacuumMs)} ms`,
      );
      await dropWhenQuiet(third);
      await dropWhenQuiet(second);
    },
    LONG,
  );

  it('refuses a database that already holds the fixture, and one that holds no seed; nothing is written', async () => {
    const before = overallDigest(await tableDigests(db.ownerPool()));
    await expect(loadBulkFixture(db.ownerPool(), { now: BULK_TEMPLATE_NOW })).rejects.toMatchObject({ name: 'BulkFixtureError', code: 'BASE_UNEXPECTED' });
    expect(overallDigest(await tableDigests(db.ownerPool()))).toBe(before);

    const empty = await db.another({ template: 'schema', slug: 'bulk_no_seed' });
    await expect(loadBulkFixture(empty.ownerPool(), { now: BULK_TEMPLATE_NOW })).rejects.toMatchObject({ code: 'NOT_SEEDED' });
    expect(await count(empty.ownerPool(), 'SELECT (SELECT count(*) FROM operators) + (SELECT count(*) FROM audit_log) + (SELECT count(*) FROM auth_sessions)')).toBe(0);
    await dropWhenQuiet(empty);
  }, LONG);

  it('refuses a clock before the seed instant, and a session that is not the owner role', async () => {
    const fresh = await db.another({ template: 'seed', slug: 'bulk_refusals' });
    const before = overallDigest(await tableDigests(fresh.ownerPool()));
    const early = loadBulkFixture(fresh.ownerPool(), { now: BULK_TEMPLATE_NOW - 1 });
    await expect(early).rejects.toBeInstanceOf(BulkFixtureError);
    await expect(early).rejects.toMatchObject({ code: 'OPTION_INVALID' });
    // The runtime role is refused by the role check, before the fixture reads or writes anything.
    await expect(loadBulkFixture(fresh.appPool(), { now: BULK_TEMPLATE_NOW })).rejects.toMatchObject({ code: 'OWNER_ROLE_REFUSED' });
    expect(overallDigest(await tableDigests(fresh.ownerPool()))).toBe(before);
    await dropWhenQuiet(fresh);
  }, LONG);

  it('the variant: one session in RECORDING with a full 200-item timeline', async () => {
    const variant = await db.another({ template: 'seed', slug: 'bulk_variant' });
    const report = await loadBulkFixture(variant.ownerPool(), { now: BULK_TEMPLATE_NOW, seed: BULK_TEMPLATE_SEED, activeSession: true });
    expect(report.met).toBe(true);
    expect(report.counts['active_session']).toBe(1);
    const pool = variant.ownerPool();
    const session = await pool.query<{ id: string; state: string; items: number; markers: number; bytes: string }>(
      'SELECT id, state, jsonb_array_length(timeline) AS items, marker_count AS markers, bytes_written AS bytes FROM active_session',
    );
    expect(session.rows[0]).toMatchObject({ state: 'RECORDING', items: BULK_MIX.activeSessionVariant.timelineItems });
    expect(await count(pool, "SELECT next_value - (SELECT right(id, 4)::int FROM active_session) FROM engine_counters WHERE name = 'session'")).toBeGreaterThanOrEqual(1);
    expect(await count(pool, 'SELECT count(*) FROM session_history s JOIN active_session a ON a.id = s.id')).toBe(0);
    // The largest row of the schema reads back through the mapping, and the chain still verifies.
    const slices = fromRows(await readStoredRows(drizzle(variant.appPool())));
    expect(slices.session?.timeline).toHaveLength(200);
    expect(slices.session?.state).toBe('RECORDING');
    const total = await count(pool, 'SELECT count(*) FROM audit_log');
    expect(await checkStoredChain(variant.appPool(), { limit: total, verifyDigests: verifyStoredAuditRows })).toMatchObject({ ok: true, rowsChecked: total, digests: 'ok', lineage: 'ok' });
    await vacuumFixtureTables(pool);
    // The statistics are there: the planner knows the audit log holds thousands of rows.
    expect(await count(pool, "SELECT reltuples::int FROM pg_class WHERE oid = 'public.audit_log'::regclass")).toBeGreaterThanOrEqual(5_000);
    await dropWhenQuiet(variant);
  }, LONG);
});

describe('a clone of the bulk template, read back as the runtime role', () => {
  it('dems_app reads every one of the 30 tables, and the counts are the owner\'s', async () => {
    const asApp = await countAllTables(drizzle(db.appPool()));
    expect(asApp).toEqual(await countAllTables(drizzle(db.ownerPool())));
    const who = await db.appPool().query<{ role: string; database: string }>('SELECT current_user::text AS role, current_database()::text AS database');
    expect(who.rows[0]).toEqual({ role: 'dems_app', database: db.name });
  });

  it('and nothing else: the privilege matrix of the clone is the contract\'s, and the refusals are real', async () => {
    const app = db.appPool();
    const privileges = await app.query<{ table_name: string; held: string }>(
      `SELECT t.table_name::text AS table_name,
              concat_ws(',', CASE WHEN has_table_privilege(current_user, 'public.' || t.table_name, 'SELECT') THEN 'S' END,
                             CASE WHEN has_table_privilege(current_user, 'public.' || t.table_name, 'INSERT') THEN 'I' END,
                             CASE WHEN has_any_column_privilege(current_user, 'public.' || t.table_name, 'UPDATE') THEN 'U' END,
                             CASE WHEN has_table_privilege(current_user, 'public.' || t.table_name, 'DELETE') THEN 'D' END,
                             CASE WHEN has_table_privilege(current_user, 'public.' || t.table_name, 'TRUNCATE') THEN 'T' END) AS held
         FROM unnest($1::text[]) AS t(table_name) ORDER BY 1`,
      [ALL_TABLES.map((entry) => entry.sqlName)],
    );
    const held = Object.fromEntries(privileges.rows.map((row) => [row.table_name, row.held]));
    expect(Object.keys(held)).toHaveLength(30);
    // Read-only for the runtime role: the RBAC tables, the chain head, the lineage, the schema version.
    for (const table of ['roles', 'permissions', 'role_permissions', 'audit_chain_head', 'audit_chain_history', 'schema_meta']) expect(held[table], table).toBe('S');
    // Append-only by privilege: insert and read, nothing else.
    for (const table of ['audit_log', 'events', 'session_history', 'evidence_tracks', 'evidence_custody', 'exports', 'health_snapshots']) expect(held[table], table).toBe('S,I');
    // No INSERT on the operators (no operation creates a user), and DELETE on the active session only.
    expect(held['operators']).toBe('S,U');
    expect(held['operator_credentials']).toBe('S,U');
    expect(held['active_session']).toBe('S,I,U,D');
    expect(Object.entries(held).filter(([, value]) => value.includes('D') || value.includes('T'))).toEqual([['active_session', 'S,I,U,D']]);

    // The refusals, on rows the fixture wrote. Each is refused by privilege, before any row is touched.
    expect(await sqlStateOf(app, "UPDATE audit_log SET message = 'x' WHERE seq = 5000")).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlStateOf(app, 'DELETE FROM audit_log WHERE seq = 5000')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlStateOf(app, 'DELETE FROM evidence_items')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlStateOf(app, 'DELETE FROM auth_sessions')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlStateOf(app, "UPDATE audit_chain_history SET scenario = 'idle'")).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlStateOf(app, 'UPDATE audit_chain_head SET seq = 0')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlStateOf(app, 'UPDATE evidence_items SET manifest_hash = manifest_hash')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlStateOf(app, 'SELECT count(*) FROM drizzle.__drizzle_migrations')).toBe(INSUFFICIENT_PRIVILEGE);
    // What it may do, it can: read one page of the audit log by the type index, newest first.
    const page = await app.query<{ seq: string }>("SELECT seq FROM audit_log WHERE type = 'ACCESS_DENIED' AND seq < $1 ORDER BY seq DESC LIMIT 50", [1_000_000]);
    expect(page.rows).toHaveLength(50);
    // The sessions on the databases of this run are the helper's role and the runtime role, and no other.
    expect((await db.run.sessionRoles()).sort()).toEqual(['dems_app', 'dems_owner']);
  });
});
