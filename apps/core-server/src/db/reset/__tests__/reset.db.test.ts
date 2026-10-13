// The reset routine on real databases of the test run (plan row W29; database contract §8.5,
// T-RS-1, T-RS-3, T-RS-5, T-RS-6; spec AC-B-57 (routine), AC-B-72 (role), AC-B-87 (table level)).
//
// Every reset below targets a database the test helper created for this file, or a name of this
// run that does not exist yet. `dems_demo` and the lanes are never named (TI-17). The routine is
// called through its function with the seam `testRunPrefix`, which no entry point sets.
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { verifyStoredAuditRows } from '../../mapping';
import { BLOCKING_BOOT_CHECKS, checkStoredChain } from '../../schema/boot-checks';
import { seedDatabase } from '../../seed';
import type { ResetCheckpoint } from '../errors';
import { KEPT_TABLE_NAMES } from '../kept-tables';
import { resetDatabase, type ResetInternals, type ResetLogEntry, type ResetReport } from '../routine';
import { watchedPools } from './pools';
import {
  ACTIVE_CODE_ID,
  AWKWARD_DEVICE_NAME,
  AWKWARD_REVOKE_REASON,
  BEYOND_DOUBLE,
  DEVICE_SESSION_TOKEN,
  ENDED_SESSION_TOKEN,
  FIRST_RESET_NOW,
  RECORDED_SESSION_ROWS,
  PATIENT_MS,
  SECOND_RESET_NOW,
  SEED_NOW,
  WEB_SESSION_TOKEN,
  appendAuditRows,
  catalogOf,
  chainFacts,
  contractChecksum,
  digestAll,
  discard,
  dropOwn,
  dumpKept,
  dumpTable,
  lineageRows,
  maintenancePool,
  occurrences,
  plantKeptRows,
  quiet,
  resetApplicationName,
  sessionsOf,
  sha256,
  untilNoSession,
  type SessionRow,
} from '../../../../test/support/reset';

const db = useTestDatabase({ template: 'seed', slug: 'rs' });

// A reset under load takes a few times longer than on a quiet host: the limits are caps.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const MINUTE = 60_000;
/** Kept tables whose every row must be byte-equal after any reset. `pairing_codes` joins them once no code is ACTIVE. */
const UNCHANGED_TABLES = ['registry_counters', 'console_settings', 'paired_devices', 'device_credentials', 'auth_sessions', 'biometric_tokens'];
/** Tables that are rebuilt and must equal a fresh seed for the same instant, with no exception. */
const NOT_COMPARED_WITH_SEED = new Set([
  ...KEPT_TABLE_NAMES,
  'operator_credentials', // fresh salts per seed (SD-4)
  'operators', // compared without last_sign_in_at
  'audit_log', // the seed rows plus SCENARIO_LOADED
  'audit_chain_head',
  'events', // the seed events plus SCENARIO_LOADED
  'engine_counters', // the event counter moved by one
]);

let maintenance: Pool;
let internals: ResetInternals;

beforeAll(() => {
  maintenance = maintenancePool(db.run.dataDir);
  internals = { testRunPrefix: db.run.identity.prefix };
});

afterAll(async () => {
  // A plain drop of this file's own databases, before the helper's forced one (see `discard`).
  await db.database.closeResources();
  for (const name of [`${db.name}_next`, `${db.name}_prev`, `${db.name}_fb`, db.name]) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
});

async function sessionByToken(pool: Pool, token: string): Promise<{ id: string; operator_id: string } | undefined> {
  const { rows } = await pool.query<{ id: string; operator_id: string }>(
    'SELECT id::text AS id, operator_id FROM public.auth_sessions WHERE token_hash = $1 AND ended_at IS NULL',
    [sha256(token)],
  );
  return rows[0];
}

function show(label: string, report: ResetReport): void {
  console.log(
    `[w29] ${label}: ${report.database} epoch ${String(report.previousEpoch)} -> ${report.epoch}; kept ${JSON.stringify(report.kept)}; ` +
      `cancelled codes ${report.cancelledPairingCodes}; lineage ${report.lineage.carried} carried + ${report.lineage.appended === null ? 0 : 1} appended; ` +
      `audit head seq ${report.auditHead.seq}; ${Math.round(report.totalMs)} ms (${Object.entries(report.stepMs)
        .map(([step, ms]) => `${step} ${Math.round(ms)}`)
        .join(', ')})`,
  );
}

describe('T-RS-1: two resets of a used database', () => {
  let afterFirst: { lineage: string[]; kept: Record<string, string[]>; checksums: Record<string, string> };

  it('the first reset keeps the twelve kept tables byte-equal, closes the ACTIVE code, rebuilds the rest, and records the discarded chain', async () => {
    // A used Core: devices, credentials, codes (one ACTIVE), sessions, tokens, settings, a changed
    // role, and a chain that is no longer the seed's.
    await plantKeptRows(db.ownerPool());
    await appendAuditRows(db.ownerPool(), RECORDED_SESSION_ROWS, SEED_NOW + 30 * MINUTE);

    const names = [db.name, `${db.name}_next`, `${db.name}_prev`];
    const before = {
      kept: await dumpKept(db.ownerPool()),
      checksums: Object.fromEntries(await Promise.all(KEPT_TABLE_NAMES.map(async (table) => [table, await contractChecksum(db.ownerPool(), table)] as const))),
      chain: await chainFacts(db.ownerPool()),
      web: await sessionByToken(db.ownerPool(), WEB_SESSION_TOKEN),
      device: await sessionByToken(db.ownerPool(), DEVICE_SESSION_TOKEN),
      catalog: await catalogOf(maintenance, names),
    };
    expect(before.chain).toEqual({ headSeq: '84', headHash: expect.stringMatching(/^[0-9a-f]{64}$/), rowCount: '84', firstSeq: '1', epoch: '0' });
    expect(before.kept['audit_chain_history']).toEqual([]);
    expect(before.kept['pairing_codes']).toHaveLength(5);
    expect(before.kept['auth_sessions']).toHaveLength(3);
    expect(before.web?.operator_id).toBe('OPR-002');
    expect(before.device?.operator_id).toBe('OPR-001');

    // The routine refuses a database that is in use; the test's own pools are sessions too.
    await quiet(maintenance, db.database);
    const logged: ResetLogEntry[] = [];
    const report = await resetDatabase(
      { database: db.name, clock: () => FIRST_RESET_NOW, actorId: 'OPR-002', reason: 'RESET', scenario: 'idle', dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS, log: (entry) => logged.push(entry) },
      internals,
    );
    show('T-RS-1 first reset', report);

    // The database behind the name is a new one; nothing of the routine is left.
    const catalog = await catalogOf(maintenance, names);
    expect(catalog[db.name]?.owner).toBe('dems_owner');
    expect(catalog[db.name]?.oid).not.toBe(before.catalog[db.name]?.oid);
    expect(catalog[`${db.name}_next`]).toBeUndefined();
    expect(catalog[`${db.name}_prev`]).toBeUndefined();
    expect(report).toMatchObject({ firstBuild: false, previousEpoch: 0, epoch: 1, role: 'dems_owner', previousDropped: true, cancelledPairingCodes: 1, leftoversRemoved: [] });

    // ── Kept, unchanged: six tables as a whole, by a record dump and by the contract's checksum.
    const owner = db.ownerPool();
    const kept = await dumpKept(owner);
    const checksums = Object.fromEntries(await Promise.all(KEPT_TABLE_NAMES.map(async (table) => [table, await contractChecksum(owner, table)] as const)));
    for (const table of UNCHANGED_TABLES) {
      expect(kept[table], table).toEqual(before.kept[table]);
      expect(checksums[table], table).toBe(before.checksums[table]);
      expect(kept[table]?.length, table).toBeGreaterThan(0);
    }
    console.log(
      `[w29] kept tables, rows and checksum before = after the first reset: ${UNCHANGED_TABLES.map((table) => `${table} ${kept[table]?.length} ${checksums[table]}`).join('; ')}`,
    );

    // ── Pairing codes: four rows byte-equal; the one that was ACTIVE is CANCELLED by the reset.
    const codesBefore = before.kept['pairing_codes'] ?? [];
    const codesAfter = kept['pairing_codes'] ?? [];
    expect(codesAfter).toHaveLength(5);
    expect(codesAfter.slice(0, 4)).toEqual(codesBefore.slice(0, 4));
    expect(codesAfter[4]).not.toBe(codesBefore[4]);
    const closed = await owner.query(
      "SELECT state, closed_at::text AS closed_at, closed_by_operator_id, (to_jsonb(c) - 'state' - 'closed_at' - 'closed_by_operator_id')::text AS rest FROM public.pairing_codes AS c WHERE id = $1",
      [ACTIVE_CODE_ID],
    );
    expect(closed.rows[0]).toMatchObject({ state: 'CANCELLED', closed_at: String(FIRST_RESET_NOW), closed_by_operator_id: 'OPR-002' });
    expect(closed.rows[0]?.rest).toContain(`"failed_attempts": 2`);
    const stillActive = await owner.query("SELECT count(*)::int AS rows FROM public.pairing_codes WHERE state = 'ACTIVE'");
    expect(stillActive.rows[0]?.rows).toBe(0);

    // ── No audit row for the closed code (GS-25): the new chain is the seed history plus one row.
    const audit = await dumpTable(owner, 'audit_log', 'seq');
    expect(audit).toHaveLength(83);
    expect(occurrences(audit.join('\n'), ACTIVE_CODE_ID)).toBe(0);
    expect(occurrences(audit.join('\n'), 'PAIRING_CODE')).toBe(0);
    const last = await owner.query('SELECT a.seq::text AS seq, a.type, a.actor_id, a.at::text AS at, a.details FROM public.audit_log AS a ORDER BY a.seq DESC LIMIT 1');
    expect(last.rows[0]).toEqual({
      seq: '83',
      type: 'SCENARIO_LOADED',
      actor_id: 'OPR-002',
      at: String(FIRST_RESET_NOW),
      details: { scenario: 'idle', reset: true, previousRows: 84, previousHead: before.chain.headHash },
    });
    expect(report.scenarioLoadedSeq).toBe(83);

    // ── The lineage row holds what the old database really held (LN-2).
    const lineage = await lineageRows(owner);
    expect(lineage).toEqual([
      {
        reset_no: '1',
        epoch: '0',
        head_hash: before.chain.headHash,
        row_count: '84',
        first_seq: '1',
        last_seq: '84',
        reset_at: String(FIRST_RESET_NOW),
        actor_id: 'OPR-002',
        reason: 'RESET',
        scenario: 'idle',
      },
    ]);
    expect(logged.filter((entry) => entry.code === 'RESET_CHAIN_DISCARDED')).toHaveLength(1);
    expect(logged.find((entry) => entry.code === 'RESET_CHAIN_DISCARDED')?.details).toMatchObject({ headHash: before.chain.headHash, rowCount: '84', resetNo: '1' });

    // ── The epoch continues; the state is the seed's as of the reset's clock.
    const state = await owner.query('SELECT epoch::text AS epoch, seeded_at::text AS seeded_at, last_reset_at::text AS last_reset_at, scenario FROM public.core_state');
    expect(state.rows).toEqual([{ epoch: '1', seeded_at: String(FIRST_RESET_NOW), last_reset_at: String(FIRST_RESET_NOW), scenario: 'idle' }]);

    // ── Operators are rebuilt: the seed's role, enabled; the last sign-in from the kept sessions.
    const operators = await owner.query('SELECT id, role_id, enabled, last_sign_in_at::text AS last_sign_in_at, role_changed_at FROM public.operators ORDER BY id');
    expect(operators.rows).toEqual([
      { id: 'OPR-001', role_id: 'INVESTIGATOR', enabled: true, last_sign_in_at: String(SEED_NOW + 20 * MINUTE), role_changed_at: null },
      { id: 'OPR-002', role_id: 'SUPERVISOR', enabled: true, last_sign_in_at: String(SEED_NOW + 5 * MINUTE), role_changed_at: null },
      { id: 'OPR-003', role_id: 'TECHNICIAN', enabled: true, last_sign_in_at: null, role_changed_at: null },
    ]);
    expect(report.operatorsWithSignIn).toBe(2);

    // ── Nobody is signed out: each token still resolves to the same open session.
    expect(await sessionByToken(owner, WEB_SESSION_TOKEN)).toEqual(before.web);
    expect(await sessionByToken(owner, DEVICE_SESSION_TOKEN)).toEqual(before.device);
    // ── No value went through a JavaScript number: a bigint beyond 2^53 kept its last digit.
    expect(String(Number(BEYOND_DOUBLE))).not.toBe(BEYOND_DOUBLE);
    const beyond = await owner.query('SELECT absolute_expires_at::text AS value FROM public.auth_sessions WHERE token_hash = $1', [sha256(ENDED_SESSION_TOKEN)]);
    expect(beyond.rows).toEqual([{ value: BEYOND_DOUBLE }]);
    // ── Awkward text (quotes, a backslash, an astral character, a line break, a tab) is the same text.
    const awkward = await owner.query('SELECT (SELECT name FROM public.paired_devices WHERE id = $1) AS name, (SELECT revoke_reason FROM public.paired_devices WHERE id = $2) AS reason', ['DEV-0001', 'DEV-0002']);
    expect(awkward.rows).toEqual([{ name: AWKWARD_DEVICE_NAME, reason: AWKWARD_REVOKE_REASON }]);

    // ── Everything else equals a seed of an empty database for the same instant and epoch (AC-B-57).
    const reference = await db.another({ template: 'schema', slug: 'rsref1' });
    await seedDatabase(reference.ownerPool(), { now: FIRST_RESET_NOW, scenario: 'idle', epoch: 1, lastResetAt: FIRST_RESET_NOW, target: 'test' });
    const built = await digestAll(owner);
    const seeded = await digestAll(reference.ownerPool());
    const rebuilt = Object.keys(seeded).filter((table) => !NOT_COMPARED_WITH_SEED.has(table));
    // 22 (was 16 on the 30-table schema): the six v2 data tables - intervals, fragments, chunks,
    // transcripts, revisions, sealing jobs - join the rebuilt set; stt_config is KEPT (§B.13) and
    // the capture trio is upsert-kept (§E.1), so they stay out of this list.
    // 23 since dbc-4: `session_capture_sources` (T-41) is rebuilt, never kept.
    // 24 since PE-129b-01: `session_stt_config` (T-42) is rebuilt too.
    // 26 since task 4 schema set A: T-44 `capture_device_streams` and T-45 `capture_audio_inputs` are
    // counted here because a reset does not carry them yet (the kept set is still 13; the reset row
    // that carries them with `capture_devices` takes them out of this list again).
    // 28 since task 4 schema set B: T-46 `capture_network_config` and T-47 `host_network_aliases`,
    // for the same reason - the design keeps both across a reset, the reset does not carry them yet.
    // 29 since task 4 schema set C: T-48 `installation_acceptances`, for the same reason again.
    expect(rebuilt).toHaveLength(29);
    for (const table of rebuilt) expect(built[table], table).toBe(seeded[table]);
    const withoutSignIn = { without: { operators: ['last_sign_in_at'] } };
    expect((await digestAll(owner, withoutSignIn))['operators']).toBe((await digestAll(reference.ownerPool(), withoutSignIn))['operators']);
    expect(audit.slice(0, 82)).toEqual(await dumpTable(reference.ownerPool(), 'audit_log', 'seq'));
    const events = await dumpTable(owner, 'events', 'seq');
    expect(events).toHaveLength(60);
    expect(events.slice(0, 59)).toEqual(await dumpTable(reference.ownerPool(), 'events', 'seq'));
    expect(events[59]).toContain('SCENARIO_LOADED');
    const counters = await owner.query("SELECT next_value::text AS next_value FROM public.engine_counters WHERE name = 'event'");
    expect(counters.rows[0]?.next_value).toBe('61');
    await discard(maintenance, reference, db.run.identity.prefix);

    // ── The new database is one the server starts on: the boot checks pass as the runtime role.
    for (const check of BLOCKING_BOOT_CHECKS) await check.run(db.appPool());
    const chain = await checkStoredChain(db.appPool(), { verifyDigests: verifyStoredAuditRows });
    expect(chain).toMatchObject({ ok: true, rowsChecked: 83, linkBreaks: 0, digests: 'ok', lineage: 'ok' });

    afterFirst = { lineage: await dumpTable(owner, 'audit_chain_history', 'reset_no'), kept, checksums };
    expect(afterFirst.lineage).toHaveLength(1);
  });

  it('the second reset, with another scenario: two lineage rows, the first byte-equal; every kept table byte-equal; the epoch grows by one again', async () => {
    const owner = db.ownerPool();
    const chain = await chainFacts(owner);
    expect(chain).toMatchObject({ headSeq: '83', rowCount: '83', firstSeq: '1', epoch: '1' });
    const web = await sessionByToken(owner, WEB_SESSION_TOKEN);
    const lineageChecksum = await contractChecksum(owner, 'audit_chain_history');

    await quiet(maintenance, db.database);
    const report = await resetDatabase(
      { database: db.name, clock: () => SECOND_RESET_NOW, actorId: null, reason: 'SCENARIO_LOAD', scenario: 'recording', dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS },
      internals,
    );
    show('T-RS-1 second reset', report);
    expect(report).toMatchObject({ firstBuild: false, previousEpoch: 1, epoch: 2, cancelledPairingCodes: 0, previousDropped: true });
    expect(report.lineage).toMatchObject({ carried: 1, total: 2 });

    const after = db.ownerPool();
    // AC-B-87, table level: two rows; the first is byte-equal before and after the second reset.
    const lineageDump = await dumpTable(after, 'audit_chain_history', 'reset_no');
    expect(lineageDump).toHaveLength(2);
    expect(lineageDump[0]).toBe(afterFirst.lineage[0]);
    const firstRowChecksum = await after.query<{ digest: string }>(
      "SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY t.reset_no), '')) AS digest FROM public.audit_chain_history AS t WHERE reset_no = 1",
    );
    expect(firstRowChecksum.rows[0]?.digest).toBe(lineageChecksum);
    console.log(`[w29] lineage row 1 before the second reset: ${afterFirst.lineage[0]}`);
    console.log(`[w29] lineage row 1 after the second reset:  ${lineageDump[0]}`);
    console.log(`[w29] lineage row 2:                         ${lineageDump[1]}`);

    const lineage = await lineageRows(after);
    expect(lineage[1]).toEqual({
      reset_no: '2',
      epoch: '1',
      head_hash: chain.headHash,
      row_count: '83',
      first_seq: '1',
      last_seq: '83',
      reset_at: String(SECOND_RESET_NOW),
      actor_id: null,
      reason: 'SCENARIO_LOAD',
      scenario: 'recording',
    });
    // Each row names the head and the count that were in the database before its reset.
    expect(lineage.map((row) => [row.row_count, row.last_seq, row.epoch])).toEqual([
      ['84', '84', '0'],
      ['83', '83', '1'],
    ]);

    // Every kept table, pairing codes included (none was ACTIVE), is byte-equal.
    const kept = await dumpKept(after);
    for (const table of [...UNCHANGED_TABLES, 'pairing_codes']) {
      expect(kept[table], table).toEqual(afterFirst.kept[table]);
      expect(await contractChecksum(after, table), table).toBe(afterFirst.checksums[table]);
    }
    expect(await sessionByToken(after, WEB_SESSION_TOKEN)).toEqual(web);

    // The scenario was loaded as of the second instant; the new chain names the chain before it (LN-3).
    const state = await after.query('SELECT epoch::text AS epoch, last_reset_at::text AS last_reset_at, scenario FROM public.core_state');
    expect(state.rows).toEqual([{ epoch: '2', last_reset_at: String(SECOND_RESET_NOW), scenario: 'recording' }]);
    const active = await after.query('SELECT count(*)::int AS rows FROM public.active_session');
    expect(active.rows[0]?.rows).toBe(1);
    const loaded = await after.query<{ seq: string; actor_id: string | null; details: Record<string, unknown> }>(
      "SELECT seq::text AS seq, actor_id, details FROM public.audit_log WHERE type = 'SCENARIO_LOADED' AND details ->> 'previousHead' = $1",
      [chain.headHash],
    );
    expect(loaded.rows).toHaveLength(1);
    expect(loaded.rows[0]).toMatchObject({ actor_id: null, details: { scenario: 'recording', reset: false, previousRows: 83, previousHead: chain.headHash } });
    const head = await chainFacts(after);
    expect(head.headSeq).toBe(loaded.rows[0]?.seq);
    expect(head.headSeq).toBe(head.rowCount);

    const reference = await db.another({ template: 'schema', slug: 'rsref2' });
    await seedDatabase(reference.ownerPool(), { now: SECOND_RESET_NOW, scenario: 'recording', epoch: 2, lastResetAt: SECOND_RESET_NOW, target: 'test' });
    const built = await digestAll(after);
    const seeded = await digestAll(reference.ownerPool());
    for (const table of Object.keys(seeded).filter((name) => !NOT_COMPARED_WITH_SEED.has(name))) expect(built[table], table).toBe(seeded[table]);
    await discard(maintenance, reference, db.run.identity.prefix);

    const stored = await checkStoredChain(db.appPool(), { verifyDigests: verifyStoredAuditRows });
    expect(stored).toMatchObject({ ok: true, linkBreaks: 0, digests: 'ok', lineage: 'ok' });
  });
});

describe('T-RS-3: the runtime role cannot do any step of a reset', () => {
  it('CREATE DATABASE, DROP DATABASE and ALTER DATABASE ... RENAME as dems_app each fail with 42501', async () => {
    const app = db.appPool();
    const other = await db.another({ template: 'schema', slug: 'rs3' });
    const attempt = async (statement: string): Promise<string | undefined> =>
      app.query(statement).then(
        () => 'succeeded',
        (error: { code?: string }) => error.code,
      );
    expect(await attempt(`CREATE DATABASE "${db.run.identity.prefix}f98_rs3_made"`)).toBe('42501');
    expect(await attempt(`DROP DATABASE "${other.name}"`)).toBe('42501');
    expect(await attempt(`DROP DATABASE "${db.name}"`)).toBe('42501');
    expect(await attempt(`ALTER DATABASE "${other.name}" RENAME TO "${db.run.identity.prefix}f98_rs3_renamed"`)).toBe('42501');
    expect(await attempt(`ALTER DATABASE "${db.name}" RENAME TO "${db.run.identity.prefix}f98_rs3_renamed"`)).toBe('42501');
    const who = await app.query('SELECT current_user::text AS role');
    expect(who.rows[0]?.role).toBe('dems_app');
    const names = (await db.run.listDatabases()).map((row) => row.name);
    expect(names).toContain(other.name);
    expect(names.filter((name) => name.includes('rs3_made') || name.includes('rs3_renamed'))).toEqual([]);
    await discard(maintenance, other, db.run.identity.prefix);
  });
});

describe('T-RS-5: the sessions of the routine', () => {
  it('are dems_owner only, at most two connections at a time, and none is left after R-9', async () => {
    await quiet(maintenance, db.database);
    // Unique to this run and this file: another run of the same file shares the maintenance database.
    const application = resetApplicationName(db.run.identity.stamp, 't5');
    const databases = [db.name, `${db.name}_next`, `${db.name}_prev`];
    const watched = watchedPools(db.run.dataDir);
    const samples: Array<{ checkpoint: ResetCheckpoint; open: string[]; own: SessionRow[]; onTarget: SessionRow[] }> = [];

    const report = await resetDatabase(
      {
        database: db.name,
        clock: () => SECOND_RESET_NOW + MINUTE,
        dataDir: db.run.dataDir,
        applicationName: application,
        sessionDrainMs: PATIENT_MS,
        async onCheckpoint(checkpoint) {
          samples.push({
            checkpoint,
            // The routine's connections as the driver has them: opened and not yet closed.
            open: watched.connections.filter((connection) => !connection.ended).map((connection) => connection.database),
            // The same as the server lists them, read by a second dems_owner connection, the
            // test's own (application dems-test-reset). A backend leaves this list a moment after
            // its connection was closed, so it says WHO is connected, not how many at one instant.
            own: await sessionsOf(maintenance, { applications: [application] }),
            onTarget: (await sessionsOf(maintenance, { databases })).filter((session) => session.application !== 'dems-test-reset'),
          });
        },
      },
      { ...internals, openPool: watched.openPool },
    );
    // Read at once: the state of the routine's connections at the moment its promise resolved.
    const openAtTheEnd = watched.connections.filter((connection) => !connection.ended).map((connection) => connection.database);
    show('T-RS-5', report);

    expect(samples.map((sample) => sample.checkpoint)).toEqual([
      'R-0', 'R-1', 'R-2', 'R-3', 'R-4', 'R-5a', 'R-5b', 'R-5c', 'R-5d', 'R-5e', 'R-5f', 'R-5:commit', 'R-6', 'R-7', 'R-7:rename', 'R-8', 'R-9',
    ]);

    // WHO: every session the server listed for the routine, and every session on the three
    // databases, is dems_owner.
    const roles = new Set(samples.flatMap((sample) => [...sample.own, ...sample.onTarget].map((session) => session.role)));
    expect([...roles]).toEqual(['dems_owner']);
    expect(roles.has('dems_admin')).toBe(false);
    expect(roles.has('dems_app')).toBe(false);
    for (const sample of samples.slice(1)) {
      // One session on the maintenance database from R-1 on, and nothing outside the four databases.
      expect(sample.own.filter((session) => session.database === 'postgres'), sample.checkpoint).toHaveLength(1);
      for (const session of sample.own) expect(['postgres', ...databases], sample.checkpoint).toContain(session.database);
    }

    // HOW MANY: the connections the driver holds open at each checkpoint. One on the maintenance
    // database throughout; a second on <t> only inside R-3, and on <t>_next from R-5a to R-6.
    const one = ['postgres'];
    const two = ['postgres', `${db.name}_next`];
    expect(samples.map((sample) => sample.open)).toEqual([[], one, one, one, one, one, two, two, two, two, two, two, two, one, one, one, one]);
    expect(watched.connections.map((connection) => connection.database)).toEqual(['postgres', db.name, `${db.name}_next`]);
    expect(Math.max(...samples.map((sample) => sample.open.length))).toBe(2);
    console.log(`[w29] T-RS-5 connections of the routine per checkpoint (driver): ${samples.map((sample) => `${sample.checkpoint}=[${sample.open.map((name) => name.replace(db.name, '<t>')).join(', ')}]`).join(' ')}`);
    console.log(`[w29] T-RS-5 sessions of the routine per checkpoint (server): ${samples.map((sample) => `${sample.checkpoint}=[${sample.own.map((session) => `${session.role}@${session.database.replace(db.name, '<t>')}`).join(', ')}]`).join(' ')}`);

    // After R-9. The routine's promise has resolved: the driver has closed all three connections.
    expect(openAtTheEnd).toEqual([]);
    // The server then drops the backends: no session of the routine remains, and none on the target.
    await untilNoSession(maintenance, { applications: [application] }, `sessions of the routine (${application}) after R-9`);
    await untilNoSession(maintenance, { databases }, 'sessions on the target and its copies after R-9');
    expect(report.lineage.total).toBe(3);
  });
});

describe('T-RS-6: nothing discarded, no lineage row', () => {
  it('a database that was migrated but never seeded is built with no lineage row', async () => {
    const empty = await db.another({ template: 'schema', slug: 'rs6' });
    const before = await chainFacts(empty.ownerPool());
    expect(before).toEqual({ headSeq: '0', headHash: '0'.repeat(64), rowCount: '0', firstSeq: null, epoch: null });
    await quiet(maintenance, empty);

    const report = await resetDatabase({ database: empty.name, clock: () => FIRST_RESET_NOW, dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS }, internals);
    show('T-RS-6 never seeded', report);
    expect(report).toMatchObject({ firstBuild: false, previousEpoch: null, epoch: 0, cancelledPairingCodes: 0, operatorsWithSignIn: 0, previousDropped: true });
    expect(report.lineage).toEqual({ carried: 0, appended: null, total: 0 });
    expect(Object.values(report.kept).every((rows) => rows === 0)).toBe(true);

    const pool = empty.ownerPool();
    expect(await lineageRows(pool)).toEqual([]);
    expect(report.counts).toMatchObject({ audit_chain_history: 0, registry_counters: 2, console_settings: 1, core_state: 1, operators: 3, auth_sessions: 0 });
    // The new chain says that it replaced an empty one.
    const loaded = await pool.query("SELECT details FROM public.audit_log WHERE type = 'SCENARIO_LOADED'");
    expect(loaded.rows).toEqual([{ details: { scenario: 'idle', reset: true, previousRows: 0, previousHead: '0'.repeat(64) } }]);
    await discard(maintenance, empty, db.run.identity.prefix);
  });

  it('a database that does not exist yet is created, migrated and seeded: a first build, exactly the seed', async () => {
    const name = `${db.name}_fb`;
    expect((await catalogOf(maintenance, [name]))[name]).toBeUndefined();
    try {
      const report = await resetDatabase({ database: name, clock: () => FIRST_RESET_NOW, dataDir: db.run.dataDir, sessionDrainMs: PATIENT_MS }, internals);
      show('T-RS-6 first build', report);
      expect(report).toMatchObject({ firstBuild: true, previousEpoch: null, epoch: 0, previousDropped: null, scenarioLoadedSeq: null, leftoversRemoved: [] });
      expect(report.lineage).toEqual({ carried: 0, appended: null, total: 0 });
      expect(report.auditHead.seq).toBe(82);

      const catalog = await catalogOf(maintenance, [name, `${name}_next`, `${name}_prev`]);
      expect(catalog[name]?.owner).toBe('dems_owner');
      expect(catalog[`${name}_next`]).toBeUndefined();
      expect(catalog[`${name}_prev`]).toBeUndefined();

      // Exactly what `db:seed` writes for the same instant, table for table (salts aside).
      const reference = await db.another({ template: 'schema', slug: 'rsref6' });
      await seedDatabase(reference.ownerPool(), { now: FIRST_RESET_NOW, scenario: 'idle', epoch: 0, lastResetAt: FIRST_RESET_NOW, target: 'test' });
      const built = db.run.poolOn(name, 'owner');
      try {
        const builtDigests = await digestAll(built);
        const seededDigests = await digestAll(reference.ownerPool());
        for (const table of Object.keys(seededDigests).filter((entry) => entry !== 'operator_credentials')) {
          expect(builtDigests[table], table).toBe(seededDigests[table]);
        }
        expect(await lineageRows(built)).toEqual([]);
        expect(report.counts).toMatchObject({ audit_log: 82, events: 59, audit_chain_history: 0, operators: 3, evidence_items: 13 });
      } finally {
        await built.end();
      }
      await discard(maintenance, reference, db.run.identity.prefix);
    } finally {
      await dropOwn(maintenance, name, db.run.identity.prefix);
    }
  });
});
