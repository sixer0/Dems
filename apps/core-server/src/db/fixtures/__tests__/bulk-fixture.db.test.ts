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
// every table of the schema, 40 since dbc-3); what the loader refuses; what the runtime role may and may not do; the variant
// with a recording session; and the build, clone and load times.
import { asc } from 'drizzle-orm';
import type { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { AuditType, verifyAuditChain } from '@dems/shared/sim';
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

describe('the bulk template: the minimums of contract §11 as revised by dbc-3 §G', () => {
  it('every one of the 48 tables holds at least its minimum (entity, minimum, loaded)', async () => {
    const counts = await countAllTables(drizzle(db.ownerPool()));
    const comparison = compareWithMinimums(counts);
    expect(comparison).toHaveLength(48);
    expect(Object.keys(counts).sort()).toEqual(BULK_MINIMUMS.map((entry) => entry.table).sort());
    console.log(
      [
        `[test:db] bulk fixture on ${db.name}: entity -> minimum -> loaded`,
        ...comparison.map((entry) => `[test:db]   ${entry.table.padEnd(22)} ${String(entry.minimum).padStart(6)} ${String(entry.loaded).padStart(6)}  ${entry.met ? 'met' : 'BELOW'}`),
      ].join('\n'),
    );
    expect(comparison.filter((entry) => !entry.met)).toEqual([]);
    // The tables the contract leaves as seeded hold exactly one row; the three RBAC tables are
    // unchanged from the seed, which schema v2 grew to the 14/22 of dbc-3 §G and task 4 row 100
    // to 15/23 (the commissioning permission and its one grant).
    for (const table of ['storage_policy', 'console_settings', 'core_device', 'core_state', 'hardware_snapshot', 'schema_meta', 'audit_chain_head', 'capture_config', 'stt_config']) {
      expect(counts[table], table).toBe(1);
    }
    expect([counts['roles'], counts['permissions'], counts['role_permissions']]).toEqual([3, 15, 23]);
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
    // RECON-B2a R5: the fixture writes every audit type of the shared vocabulary - 62 since row
    // 47's SH-12 landed and the extended server allow-list (audit-details, build, writers). The
    // count is derived from that vocabulary, never written down here.
    expect(await count(pool, 'SELECT count(DISTINCT type) FROM audit_log')).toBe(Object.values(AuditType).length);
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
    // Exactly four tracks per SEALED item, both audio tracks among them; at least two custody entries per item.
    // Fix wave J (truth rule 3a): an item that was never sealed (`sealed_at` NULL) has NO track row, the null digest and no verdict.
    expect(await count(pool, 'SELECT count(*) FROM evidence_items e WHERE e.sealed_at IS NOT NULL AND (SELECT count(*) FROM evidence_tracks t WHERE t.evidence_id = e.id) <> 4')).toBe(0);
    expect(await count(pool, 'SELECT count(*) FROM evidence_items e WHERE e.sealed_at IS NULL AND (SELECT count(*) FROM evidence_tracks t WHERE t.evidence_id = e.id) <> 0')).toBe(0);
    expect(await count(pool, "SELECT count(*) FROM evidence_items e WHERE e.sealed_at IS NULL AND (e.manifest_hash <> repeat('0', 64) OR e.signature_value <> repeat('0', 64) OR e.verification_status <> 'NOT_RUN')")).toBe(0);
    expect(await count(pool, "SELECT count(*) FROM evidence_items e WHERE e.sealed_at IS NULL")).toBeGreaterThan(0);
    expect(await count(pool, "SELECT count(*) FROM evidence_items e WHERE e.sealed_at IS NOT NULL AND e.manifest_hash = repeat('0', 64)")).toBe(0);
    expect(
      await count(pool, "SELECT count(*) FROM evidence_items e WHERE e.sealed_at IS NOT NULL AND (SELECT count(*) FROM evidence_tracks t WHERE t.evidence_id = e.id AND t.track_id IN ('AUDIO-01', 'AUDIO-02')) <> 2"),
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
      // Schema v2 (dbc-3 §G, CS-20): the instants of the pipeline rows stay on this side of the clock.
      ['session_audio_intervals', 'from_at'],
      ['session_audio_intervals', 'to_at'],
      ['recording_fragments', 'durable_at'],
      ['transcript_chunks', 'computed_at'],
      ['transcripts', 'created_at'],
      ['transcript_revisions', 'created_at'],
      ['sealing_jobs', 'started_at'],
      ['sealing_jobs', 'updated_at'],
      ['capture_devices', 'last_seen_at'],
      ['capture_device_credentials', 'rotated_at'],
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

describe('the bulk template: the v2 rows of dbc-3 §G (CS-20)', () => {
  it('the six pipeline tables and the capture rows reach the §G minimums as loaded', async () => {
    const counts = await countAllTables(drizzle(db.ownerPool()));
    const minimums: Record<string, number> = {
      session_audio_intervals: 720,
      recording_fragments: 6_500,
      transcript_chunks: 2_000,
      transcripts: 400,
      transcript_revisions: 30,
      sealing_jobs: 3_000,
      capture_devices: 8,
      capture_device_credentials: 2,
    };
    for (const [table, minimum] of Object.entries(minimums)) expect(counts[table], table).toBeGreaterThanOrEqual(minimum);
  });

  it('intervals: one per sealed session at least, the switched 50 with their MANUAL rows, none open in the template', async () => {
    const pool = db.ownerPool();
    expect(await count(pool, 'SELECT count(*) FROM session_history s WHERE s.outcome = \'SEALED\' AND NOT EXISTS (SELECT 1 FROM session_audio_intervals i WHERE i.session_id = s.id)')).toBe(0);
    // Seeded sealed sessions too: the same rule over the union through the evidence side is
    // enforced by the builder's validate; the DB proves the counts.
    expect(await count(pool, "SELECT count(*) FROM session_audio_intervals WHERE reason = 'MANUAL' AND switched_by IS NULL")).toBe(0);
    expect(await count(pool, "SELECT count(*) FROM (SELECT session_id FROM session_audio_intervals WHERE reason = 'MANUAL' GROUP BY 1 HAVING count(*) BETWEEN 2 AND 3) AS s")).toBeGreaterThanOrEqual(BULK_MIX.sessionAudioIntervals.switchedSessions);
    expect(await count(pool, "SELECT count(*) FROM session_audio_intervals WHERE reason = 'MANUAL'")).toBeGreaterThanOrEqual(BULK_MIX.sessionAudioIntervals.manualRows);
    expect(await count(pool, 'SELECT count(*) FROM session_audio_intervals WHERE to_media_ms IS NULL OR to_at IS NULL')).toBe(0);
    // Every interval names a microphone that exists (the FK proves it), and the seq runs from 1.
    expect(await count(pool, 'SELECT count(*) FROM (SELECT session_id, count(*) AS n, max(seq) AS m FROM session_audio_intervals GROUP BY 1) AS s WHERE n <> m')).toBe(0);
  });

  it('fragments: no sequence gap anywhere, and the head of the 40 newest sessions equals the track column', async () => {
    const pool = db.ownerPool();
    expect(await count(pool, 'SELECT count(*) FROM (SELECT session_id, track_id, count(*) AS n, max(seq) AS m FROM recording_fragments GROUP BY 1, 2) AS c WHERE n <> m')).toBe(0);
    expect(await count(pool, "SELECT count(*) FROM recording_fragments WHERE seq = 1 AND chain_hash <> 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'")).toBe(0);
    expect(await count(pool, 'SELECT count(*) FROM evidence_tracks WHERE fragment_chain_head IS NOT NULL')).toBe(BULK_MIX.recordingFragments.fullChainSessions * BULK_MIX.recordingFragments.tracksPerChain);
    // "head equals fragment_chain_head": the stored head is the last chain_hash of that track's chain.
    expect(
      await count(
        pool,
        `SELECT count(*) FROM evidence_tracks t
           JOIN evidence_items e ON e.id = t.evidence_id
           JOIN LATERAL (SELECT f.chain_hash FROM recording_fragments f WHERE f.session_id = e.session_id AND f.track_id = t.track_id ORDER BY f.seq DESC LIMIT 1) AS last ON true
          WHERE t.fragment_chain_head IS NOT NULL AND t.fragment_chain_head <> last.chain_hash`,
      ),
    ).toBe(0);
    // And the count on the row is the number of fragments of that track.
    expect(
      await count(
        pool,
        `SELECT count(*) FROM evidence_tracks t JOIN evidence_items e ON e.id = t.evidence_id
          WHERE t.fragment_count IS NOT NULL
            AND t.fragment_count <> (SELECT count(*) FROM recording_fragments f WHERE f.session_id = e.session_id AND f.track_id = t.track_id)`,
      ),
    ).toBe(0);
  });

  it('chunks, transcripts, revisions and jobs: the §G mix, counted in SQL', async () => {
    const pool = db.ownerPool();
    expect(await count(pool, "SELECT count(*) FROM transcript_chunks WHERE status = 'DONE' AND (segments IS NULL OR jsonb_typeof(segments) <> 'array' OR computed_at IS NULL)")).toBe(0);
    const chunkCounts = await pool.query<{ total: string; done: string }>('SELECT count(*) AS total, count(*) FILTER (WHERE status = \'DONE\') AS done FROM transcript_chunks');
    expect(Number(chunkCounts.rows[0]?.done ?? 0) / Number(chunkCounts.rows[0]?.total ?? 1)).toBeGreaterThanOrEqual(BULK_MIX.transcriptChunks.doneSegmentsPercent / 100);
    expect(
      await count(
        pool,
        `SELECT count(*) FROM transcript_chunks c JOIN transcript_chunks p ON p.session_id = c.session_id AND p.seq = c.seq - 1
          WHERE p.status = 'FAILED' AND c.audio_from_ms = p.audio_from_ms AND c.audio_to_ms = p.audio_to_ms`,
      ),
    ).toBeGreaterThanOrEqual(BULK_MIX.transcriptChunks.failedRerunPairs);
    // One transcript per SEALED item, and no transcript anywhere else.
    expect(await count(pool, "SELECT count(*) FROM evidence_items e WHERE e.status = 'SEALED' AND NOT EXISTS (SELECT 1 FROM transcripts t WHERE t.evidence_id = e.id)")).toBe(0);
    expect(await count(pool, "SELECT count(*) FROM transcripts t JOIN evidence_items e ON e.id = t.evidence_id WHERE e.status <> 'SEALED'")).toBe(0);
    expect(await count(pool, "SELECT count(*) FROM transcripts WHERE labels_status = 'UNAVAILABLE'")).toBeGreaterThanOrEqual(BULK_MIX.transcripts.unavailableLabels);
    expect(await count(pool, 'SELECT count(DISTINCT labels_status) FROM transcripts')).toBe(BULK_MIX.transcripts.labelsValues);
    // Revisions: Ed25519 form, and revision 1 of every chain hangs on the transcript's own hash.
    expect(await count(pool, "SELECT count(*) FROM transcript_revisions WHERE signature_algorithm <> 'Ed25519' OR signature_simulated OR char_length(signature_value) <> 128")).toBe(0);
    expect(
      await count(
        pool,
        `SELECT count(*) FROM transcript_revisions r JOIN transcripts t ON t.evidence_id = r.evidence_id WHERE r.revision_no = 1 AND r.parent_sha256 <> t.json_sha256`,
      ),
    ).toBe(0);
    expect(await count(pool, 'SELECT count(*) FROM (SELECT evidence_id FROM transcript_revisions GROUP BY 1 HAVING max(revision_no) >= 2) AS c')).toBeGreaterThanOrEqual(BULK_MIX.transcriptRevisions.chainedItems);
    // Sealing jobs: every sealed session carries all six steps, every step DONE.
    expect(
      await count(
        pool,
        `SELECT count(*) FROM session_history s WHERE s.outcome = 'SEALED' AND (SELECT count(*) FROM sealing_jobs j WHERE j.session_id = s.id AND j.status = 'DONE') <> 6`,
      ),
    ).toBe(0);
    expect(await count(pool, 'SELECT count(*) FROM sealing_jobs WHERE attempt >= 2 AND status = \'DONE\'')).toBeGreaterThanOrEqual(BULK_MIX.sealingJobs.resumedAtLeast);
    expect(await count(pool, 'SELECT count(*) FROM sealing_jobs WHERE checkpoint IS NOT NULL')).toBeGreaterThanOrEqual(BULK_MIX.sealingJobs.checkpointedAtLeast);
    expect(await count(pool, "SELECT count(*) FROM sealing_jobs WHERE status = 'RUNNING'")).toBe(0);
  });

  it('M4-MT-15 (fixture): the adapter mix of the 12 devices and the 4-per-session source record of dbc-4 §N.10', async () => {
    const pool = db.ownerPool();
    const mix = await pool.query('SELECT kind, adapter_kind, count(*)::int AS n FROM capture_devices GROUP BY 1, 2 ORDER BY 1, 2');
    expect(mix.rows).toEqual([
      { kind: 'CAMERA', adapter_kind: 'FAKE', n: 2 },
      { kind: 'CAMERA', adapter_kind: 'LOCAL_DEVICE', n: 1 },
      { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', n: 3 },
      { kind: 'MIC', adapter_kind: 'FAKE', n: 2 },
      { kind: 'MIC', adapter_kind: 'LOCAL_DEVICE', n: 1 },
      { kind: 'MIC', adapter_kind: 'USB_AUDIO', n: 2 },
      { kind: 'POE', adapter_kind: 'FAKE', n: 1 },
    ]);
    expect(await count(pool, "SELECT count(DISTINCT onvif_uuid) FROM capture_devices WHERE adapter_kind = 'ONVIF_RTSP'")).toBe(3);
    expect(await count(pool, "SELECT count(*) FROM capture_device_credentials c JOIN capture_devices d ON d.id = c.device_id WHERE d.adapter_kind = 'ONVIF_RTSP'")).toBe(2);

    const sources = await count(pool, 'SELECT count(*) FROM session_capture_sources');
    expect(sources).toBeGreaterThanOrEqual(1_600);
    // Exactly four rows per session, and exactly the sessions that have an interval or a fragment row.
    expect(await count(pool, 'SELECT count(*) FROM (SELECT session_id FROM session_capture_sources GROUP BY 1 HAVING count(*) <> 4) AS odd')).toBe(0);
    expect(
      await count(
        pool,
        `SELECT count(*) FROM (
           (SELECT session_id FROM session_audio_intervals UNION SELECT session_id FROM recording_fragments)
           EXCEPT SELECT session_id FROM session_capture_sources) AS missing`,
      ),
    ).toBe(0);
    expect(
      await count(
        pool,
        `SELECT count(*) FROM (
           SELECT session_id FROM session_capture_sources
           EXCEPT (SELECT session_id FROM session_audio_intervals UNION SELECT session_id FROM recording_fragments)) AS extra`,
      ),
    ).toBe(0);
    // The three shapes; no session mixes a production kind with a development kind (RG-3).
    const shapes = await pool.query<{ shape: string; n: number }>(
      `SELECT shape, count(*)::int AS n FROM (
         SELECT session_id, string_agg(adapter_kind, ',' ORDER BY slot) AS shape FROM session_capture_sources GROUP BY 1) AS s
        GROUP BY 1 ORDER BY 1`,
    );
    // Slot order of the aggregate: MIC-PRIMARY, MIC-STANDBY, VIDEO-01, VIDEO-02.
    const byShape = Object.fromEntries(shapes.rows.map((row) => [row.shape, row.n]));
    expect(Object.keys(byShape).sort()).toEqual(['FAKE,FAKE,FAKE,FAKE', 'LOCAL_DEVICE,FAKE,LOCAL_DEVICE,FAKE', 'USB_AUDIO,USB_AUDIO,ONVIF_RTSP,ONVIF_RTSP']);
    expect(byShape['LOCAL_DEVICE,FAKE,LOCAL_DEVICE,FAKE']).toBeGreaterThanOrEqual(BULK_MIX.sessionCaptureSources.developmentSessions);
    expect(byShape['USB_AUDIO,USB_AUDIO,ONVIF_RTSP,ONVIF_RTSP']).toBeGreaterThanOrEqual(BULK_MIX.sessionCaptureSources.productionSessions);
    // MR-S2: every interval names one of the two microphone rows of its session.
    expect(
      await count(
        pool,
        `SELECT count(*) FROM session_audio_intervals i
          WHERE NOT EXISTS (SELECT 1 FROM session_capture_sources s WHERE s.session_id = i.session_id AND s.slot LIKE 'MIC-%' AND s.device_id = i.mic_device_id)`,
      ),
    ).toBe(0);
    // MR-S3 in a real run: the recorded kind is the registry's kind of that device.
    expect(await count(pool, 'SELECT count(*) FROM session_capture_sources s JOIN capture_devices d ON d.id = s.device_id WHERE d.adapter_kind <> s.adapter_kind')).toBe(0);
    // §N.4: NULL on every v1 item; the fixture holds no v2 item until SH-24 regenerates the dataset.
    expect(await count(pool, 'SELECT count(*) FROM evidence_items WHERE manifest_version = 1 AND development_sources IS NOT NULL')).toBe(0);
    expect(await count(pool, 'SELECT count(*) FROM evidence_items WHERE manifest_version = 2 AND development_sources IS NULL')).toBe(0);
  });

  it('capture rows: the discovered devices over the seeded five, one dual-profile camera, two fake credentials with a rotation', async () => {
    const pool = db.ownerPool();
    expect(await count(pool, "SELECT count(*) FROM capture_devices WHERE id IN ('CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH')")).toBe(5);
    // dbc-4 §N.10: 12 = 5 built-ins + 3 ONVIF cameras + 2 USB microphones + the local camera and microphone.
    expect(await count(pool, 'SELECT count(*) FROM capture_devices')).toBe(12);
    expect(await count(pool, 'SELECT count(*) FROM capture_devices WHERE jsonb_array_length(profiles) >= 2')).toBeGreaterThanOrEqual(BULK_MIX.captureDevices.dualProfileCameras);
    expect(await count(pool, 'SELECT count(*) FROM capture_device_credentials c WHERE c.device_id IN (\'CAM-01\', \'CAM-02\', \'MIC-01\', \'MIC-02\', \'POE-SWITCH\')')).toBe(0);
    const rotated = await pool.query<{ n: string }>('SELECT count(*) AS n FROM capture_device_credentials c WHERE EXISTS (SELECT 1 FROM capture_device_credentials o WHERE o.rotated_at < c.rotated_at)');
    expect(Number(rotated.rows[0]?.n ?? 0)).toBeGreaterThanOrEqual(BULK_MIX.captureDeviceCredentials.rotatedAtLeast);
  });

  it('alerts carry every fault kind of §G with MIC_SILENT at ten', async () => {
    const pool = db.ownerPool();
    expect(await count(pool, "SELECT count(*) FROM alerts WHERE kind = 'MIC_SILENT'")).toBeGreaterThanOrEqual(BULK_MIX.alerts.micSilent);
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
    // The contract's counts as landed: 231 named CHECKs, 48 foreign keys, 48 primary keys (the
    // composed inventory; dbc-3 §0.1 + §B.13 + dbc-4 §N.11). None invalid - the loader switched nothing off.
    expect(byKind['c']).toEqual({ rows: 231, invalid: 0 });
    expect(byKind['f']).toEqual({ rows: 48, invalid: 0 });
    expect(byKind['p']).toEqual({ rows: 48, invalid: 0 });
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
    'is deterministic: a second load on a fresh seed clone gives equal rows in every one of the 48 tables, and the pure builder announces the same digest',
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
      expect(lines).toHaveLength(51);
      expect(lines[lines.length - 1]).toContain('every minimum of the 48 tables is met');
      console.log(lines.map((line) => `[test:db] ${line}`).join('\n'));

      // Equal rows, table by table, generated identifiers and hash columns included.
      const first = await tableDigests(db.ownerPool());
      const again = await tableDigests(second.ownerPool());
      // The digest covers every table of the schema: 42 since PE-129b-01 (41 since dbc-4); since CS-20 (row 55) the
      // six pipeline tables digest with the rows their §G builders synthesised.
      expect(Object.keys(first)).toHaveLength(48);
      expect(again).toEqual(first);
      console.log(`[test:db] bulk fixture: digest over a stable ordered dump of all 48 tables, template clone and second load: ${overallDigest(first)} = ${overallDigest(again)}`);

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
    // The two §G variant rows: the open interval of the RECORDING session and the RUNNING job.
    expect(await count(pool, 'SELECT count(*) FROM session_audio_intervals WHERE to_media_ms IS NULL')).toBe(BULK_MIX.sessionAudioIntervals.openInRecordingVariant);
    expect(await count(pool, "SELECT count(*) FROM sealing_jobs WHERE status = 'RUNNING'")).toBe(BULK_MIX.sealingJobs.runningInRecoveryVariant);
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
  it('dems_app reads every table but the credential store (the §G fixture rows there are reveal-only), and the counts are the owner\'s', async () => {
    // dbc-3 §D: the credential store holds no table-level SELECT for the runtime role at all -
    // reading it is the reveal function's job (SEC35-02). All 39 other tables read equal.
    const asOwner = await countAllTables(drizzle(db.ownerPool()));
    const readable = Object.fromEntries(Object.entries(asOwner).filter(([table]) => table !== 'capture_device_credentials'));
    const asApp = Object.fromEntries(await Promise.all(Object.keys(readable).map(async (table) => {
      const { rows } = await db.appPool().query<{ n: string }>(`SELECT count(*)::text AS n FROM public.${table}`);
      return [table, rows[0]?.n ?? ''] as const;
    })));
    expect(Object.fromEntries(Object.entries(asApp).map(([table, n]) => [table, Number(n)]))).toEqual(readable);
    // Row 129a (0010): the key column is readable, so the count answers; the credential columns do not.
    await expect(db.appPool().query('SELECT username, secret_ciphertext, nonce, key_ref FROM public.capture_device_credentials')).rejects.toMatchObject({ code: '42501' });
    await expect(db.appPool().query('SELECT * FROM public.capture_device_credentials')).rejects.toMatchObject({ code: '42501' });
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
    expect(Object.keys(held)).toHaveLength(48);
    // Read-only for the runtime role: the RBAC tables, the chain head, the lineage, the schema version.
    for (const table of ['roles', 'permissions', 'role_permissions', 'audit_chain_head', 'audit_chain_history', 'schema_meta']) expect(held[table], table).toBe('S');
    // Append-only by privilege: insert and read, nothing else.
    for (const table of ['audit_log', 'events', 'session_history', 'evidence_tracks', 'evidence_custody', 'exports', 'health_snapshots']) expect(held[table], table).toBe('S,I');
    // No INSERT on the operators (no operation creates a user), and DELETE on the active session only.
    expect(held['operators']).toBe('S,U');
    expect(held['operator_credentials']).toBe('S,U');
    expect(held['active_session']).toBe('S,I,U,D');
    // schema v2 (dbc-3 §D): the capture selector and devices carry UPDATE only on their own
    // columns; the credential store is INSERT+UPDATE with NO read (the reveal function serves it);
    // stt_config likewise carries no table-level SELECT (0007's column lists) - the flags below
    // ask has_table_privilege, so stt_config reads as column-UPDATE only.
    expect(held['capture_config']).toBe('S,U');
    expect(held['capture_devices']).toBe('S,I,U');
    expect(held['capture_device_credentials']).toBe('I,U');
    expect(held['session_audio_intervals']).toBe('S,I,U');
    expect(held['recording_fragments']).toBe('S,I');
    expect(held['transcript_chunks']).toBe('S,I,U');
    expect(held['transcripts']).toBe('S,I');
    expect(held['transcript_revisions']).toBe('S,I');
    expect(held['sealing_jobs']).toBe('S,I,U');
    expect(held['stt_config']).toBe('U');
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
