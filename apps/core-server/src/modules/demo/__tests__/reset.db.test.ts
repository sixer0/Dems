// Operations 72 and 75 against PostgreSQL, the REAL engine and the REAL reset routine (plan row
// W43; spec §12.4 DC-4 to DC-7; AC-B-57, AC-B-72; SR-58, SR-68; database contract §8.5 R-1, R-9;
// decisions D14, D74 DN-5, D83 DN-2).
//
// The real app factory on a clone of the seed, as `dems_app`, with the demo flag ON and EVERY
// stage as the server has it; the engine booted on a manual clock and a manual timer; the three
// seeded operators signed in on the web console. A reset is asked for through HTTP, by the
// SUPERVISOR's web session.
//
// WHICH DATABASE IS RESET. This file's own clone, created by the test helper, and nothing else:
// `testRoutine` gives the routine the seam that accepts a database of this run. The routine reads
// the owner connection file itself; this file reads no credential.
//
// What is stored is read as `dems_owner`, through pools the helper hands out and closes before
// each reset; during a reset the test asks the server only on the maintenance database.
import { validateCoreApiResponse } from '@dems/shared/api';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readHead, verifyTrail } from '../../../../test/support/core';
import { verifyStoredAuditRows } from '../../../db/mapping';
import { KEPT_TABLE_NAMES, RESET_CHECKPOINTS, type ResetCheckpoint, type ResetReport } from '../../../db/reset';
import {
  ACTIVE_CODE_ID,
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
  resetApplicationName,
  sessionsOf,
  untilNoSession,
} from '../../../../test/support/reset';
import { rewritesAppendOnlyTable } from '../../../db/reset/__tests__/pools';
import { BLOCKING_BOOT_CHECKS, checkStoredChain } from '../../../db/schema/boot-checks';
import { seedDatabase } from '../../../db/seed';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { storedSlices } from '../../../../test/support/engine';
import { credentialLeaks } from '../../../../test/support/config';
import { RUNTIME_SEARCH_PATH } from '../../../plugins/db';
import { FAULTS, FAULTS_CLEAR, RESET, SCENARIO, STATUS, bodyOf, demoApp, outcome, testRoutine, trailOf, useRoutine, type DemoApp } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'w43r' });

// A reset under load takes a few times longer than on a quiet host: the limits are caps.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

/** Kept tables whose every row must be byte-equal after any reset. `pairing_codes` joins them once no code is ACTIVE. */
const UNCHANGED_TABLES = ['registry_counters', 'console_settings', 'paired_devices', 'device_credentials', 'auth_sessions', 'biometric_tokens'];
/** Tables that are rebuilt and compared with a fresh seed for the same instant, with no exception. */
const NOT_COMPARED_WITH_SEED = new Set([
  ...KEPT_TABLE_NAMES,
  'operator_credentials', // fresh salts per seed (SD-4)
  'operators', // compared without last_sign_in_at
  'audit_log', // the seed rows plus SCENARIO_LOADED
  'audit_chain_head',
  'events', // the seed events plus SCENARIO_LOADED
  'engine_counters', // the event counter moved by one
]);

interface Observed {
  readonly checkpoint: ResetCheckpoint;
  /** What another request of the SUPERVISOR is answered at this moment. */
  readonly status: number;
  readonly health: number;
  readonly ready: unknown;
  /** The sessions of the routine: `role (superuser) on database`. */
  readonly routine: string[];
  /** Sessions of the runtime role on the target. */
  readonly runtime: number;
  /** How many statements the runtime role had sent by this moment. */
  readonly statements: number;
}

let server: DemoApp;
let maintenance: Pool;
let applicationName: string;
let observed: Observed[] = [];
let report: ResetReport | null = null;
let pathBefore: string;
let afterFirst: { lineage: string[]; kept: Record<string, string[]>; epoch: number };

const owner = (): Pool => db.ownerPool();
const names = (): string[] => [db.name, `${db.name}_next`, `${db.name}_prev`];
/** The report of the last reset: the routine of this file hands it over when it resolves. */
function lastReport(): ResetReport {
  if (report === null) throw new Error('no reset has resolved yet');
  return report;
}

async function pathOf(pool: Pick<Pool, 'query'>): Promise<string> {
  const answer = await pool.query<{ path: string }>("SELECT current_setting('search_path') AS path");
  return answer.rows[0]?.path ?? '';
}

/** What the server lists about the routine's own connections, by the run-unique application name. */
async function routineSessions(): Promise<string[]> {
  const { rows } = await maintenance.query<{ role: string; superuser: boolean; database: string }>(
    'SELECT a.usename::text AS role, r.rolsuper AS superuser, a.datname::text AS database FROM pg_stat_activity AS a JOIN pg_roles AS r ON r.rolname = a.usename ' +
      'WHERE a.application_name = $1 ORDER BY 3',
    [applicationName],
  );
  return rows.map((row) => `${row.role} (superuser ${row.superuser}) on ${row.database === db.name ? '<t>' : row.database.replace(db.name, '<t>')}`);
}

/** The order of what happened, read from the server's own log lines and the checkpoints written between them. */
function marksSince(from: number): string[] {
  return server.log
    .lines()
    .slice(from)
    .flatMap((line) => {
      const text = line['msg'];
      if (text === 'w43 checkpoint') return [`routine ${String(line['checkpoint'])}`];
      if (text === 'readiness hold') return [`hold ${String(line['hold'])} ${String(line['held'])}`];
      if (text === 'readiness changed') return [`ready.${String(line['part'])} ${String(line['ready'])}`];
      if (text === 'engine stopped') return ['engine stopped'];
      if (text === 'engine started') return [`engine started (${String(line['mode'])}, epoch ${String(line['epoch'])})`];
      if (text === 'the stored audit chain verifies') return ['boot checks passed (B-8 reported)'];
      if (text === 'demo reset requested' || text === 'demo reset done') return [text];
      return [];
    });
}

const SUCCESS_MARKS = (epoch: number): string[] => [
  'demo reset requested',
  'routine R-0',
  'routine R-1',
  'hold demo-reset true',
  'ready.engine false',
  'engine stopped',
  'ready.database false',
  ...RESET_CHECKPOINTS.slice(2).map((checkpoint) => `routine ${checkpoint}`),
  'ready.database true',
  'boot checks passed (B-8 reported)',
  `engine started (reset, epoch ${epoch})`,
  'ready.engine true',
  'hold demo-reset false',
  'demo reset done',
];

beforeAll(async () => {
  maintenance = maintenancePool(db.run.dataDir);
  applicationName = resetApplicationName(db.run.identity.stamp, 'w43r');
  server = await demoApp(db, { demoControls: true, dataDir: db.run.dataDir });
  useRoutine(
    server.app,
    testRoutine(db.database, {
      runPrefix: db.run.identity.prefix,
      applicationName,
      maintenance,
      async onCheckpoint(checkpoint) {
        // Written into the server's own log, so that the order of both can be read from it.
        server.app.log.info({ checkpoint }, 'w43 checkpoint');
        const other = await server.get('SUPERVISOR', STATUS);
        const health = await server.get(null, '/api/v1/health');
        const runtime = (await sessionsOf(maintenance, { databases: [db.name] })).filter((row) => row.role === 'dems_app').length;
        observed.push({ checkpoint, status: other.statusCode, health: health.statusCode, ready: (health.json() as { ready: unknown }).ready, routine: await routineSessions(), runtime, statements: server.sql.length });
      },
      afterResolve(resolved) {
        report = resolved;
      },
    }),
  );
});

afterAll(async () => {
  await server?.app.close();
  await db.database.closeResources();
  // A plain removal of this file's own databases, before the helper's forced one.
  for (const name of names().reverse()) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
});

describe('AC-B-72: the roles of the running server', () => {
  it('the pool reports the runtime role, which is no superuser, on the pinned path; the flag is on', async () => {
    const who = await server.app.db.pool.query<{ role: string; superuser: boolean }>('SELECT current_user::text AS role, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser');
    expect(who.rows).toEqual([{ role: 'dems_app', superuser: false }]);
    pathBefore = await pathOf(server.app.db.pool);
    expect(pathBefore).toBe(RUNTIME_SEARCH_PATH);
    expect(server.app.config.demoControls).toBe(true);
    expect(server.app.db.generation).toBe(1);
    expect(server.engine.epoch).toBe(1);
  });
});

describe('AC-B-57: resetDemo through the routine, inside the running server', () => {
  it('rebuilds the database, keeps the twelve kept tables, closes the ACTIVE code, raises the epoch by exactly 1, publishes the new epoch, and answers 200 to the same request', async () => {
    // ── A used Core. Kept rows: two devices, credentials, five pairing codes of which one is
    // ACTIVE, sessions, biometric tokens, changed settings, moved counters. Not kept: OPR-003 is
    // made a SUPERVISOR and disabled; a fault is raised, so the chain is not the seed's any more.
    await plantKeptRows(owner());
    await server.drive(2_000);
    expect((await server.get('TECHNICIAN', '/api/v1/auth/session')).statusCode).toBe(401);
    // A command of the SUPERVISOR after the clock moved: it is activity, so it moves the last-seen
    // instant of that session NOW. The reset request, at the same instant, then finds nothing to
    // move, and the kept rows can be compared as they are.
    expect(outcome(await server.post('SUPERVISOR', FAULTS, { kind: 'FAN_STALL' }))).toEqual([204, null]);
    await server.app.pipeline.drain();

    const resetNow = server.clock.now();
    const epochBefore = server.engine.epoch;
    const before = {
      kept: await dumpKept(owner()),
      checksums: Object.fromEntries(await Promise.all(KEPT_TABLE_NAMES.map(async (table) => [table, await contractChecksum(owner(), table)] as const))),
      chain: await chainFacts(owner()),
      catalog: await catalogOf(maintenance, names()),
      sessions: await owner().query<{ id: string }>('SELECT id::text AS id FROM public.auth_sessions WHERE ended_at IS NULL ORDER BY 1'),
    };
    expect(before.chain.epoch).toBe(String(epochBefore));
    expect(Number(before.chain.rowCount)).toBeGreaterThan(83);
    expect(before.kept['audit_chain_history']).toEqual([]);
    expect(before.kept['pairing_codes']).toHaveLength(5);
    // Three planted sessions and the three of the signed-in operators.
    expect(before.kept['auth_sessions']).toHaveLength(6);
    const publicationsBefore = server.publications.length;
    const linesBefore = server.log.lines().length;
    const statementsBefore = server.sql.length;
    observed = [];
    report = null;

    // ── The request.
    const response = await server.post('SUPERVISOR', RESET);
    const statementsAfter = server.sql.length;
    expect(outcome(response)).toEqual([200, null]);
    expect(response.json()).toEqual({ epoch: epochBefore + 1 });
    expect(validateCoreApiResponse('resetDemo', 200, response.json())).toEqual({ ok: true });
    // API-7: the new epoch at its first revision.
    expect(response.headers['x-dems-epoch']).toBe(String(epochBefore + 1));
    expect(response.headers['x-dems-revision']).toBe('0');

    // ── The order, as the server's own log has it.
    const marks = marksSince(linesBefore);
    expect(marks).toEqual(SUCCESS_MARKS(epochBefore + 1));
    console.info(`[w43] resetDemo, the order as logged: ${marks.join(' | ')}`);

    // ── DC-4: from the quiesce on, every other request answers 503; before it, a refusal at R-0
    // would have disturbed nobody. Health answers throughout.
    expect(observed.map((entry) => entry.checkpoint)).toEqual([...RESET_CHECKPOINTS]);
    expect(observed.map((entry) => entry.status)).toEqual([200, 200, ...RESET_CHECKPOINTS.slice(2).map(() => 503)]);
    expect(observed.every((entry) => entry.health === 200)).toBe(true);
    expect(observed.slice(0, 2).map((entry) => entry.ready)).toEqual([{ database: true, engine: true }, { database: true, engine: true }]);
    expect(observed.slice(2).every((entry) => JSON.stringify(entry.ready) === JSON.stringify({ database: false, engine: false }))).toBe(true);
    // The pool was closed in the quiesce: from R-2 on the runtime role has no session on the database.
    expect(observed.slice(0, 2).every((entry) => entry.runtime > 0)).toBe(true);
    expect(observed.slice(2).map((entry) => entry.runtime)).toEqual(RESET_CHECKPOINTS.slice(2).map(() => 0));

    // ── AC-B-72, SR-58: every connection of the reset is the owner role, which is no superuser.
    expect(lastReport()).toMatchObject({ role: 'dems_owner', database: db.name, firstBuild: false, previousEpoch: epochBefore, epoch: epochBefore + 1, actorId: 'OPR-002', reason: 'RESET', scenario: 'idle', now: resetNow, cancelledPairingCodes: 1, previousDropped: true });
    const routineRoles = [...new Set(observed.flatMap((entry) => entry.routine))].sort();
    expect(routineRoles.length).toBeGreaterThan(0);
    expect(routineRoles.every((entry) => entry.startsWith('dems_owner (superuser false) on '))).toBe(true);
    expect(observed.find((entry) => entry.checkpoint === 'R-0')?.routine).toEqual([]);
    console.info(`[w43] the reset's connections, as the server lists them: ${routineRoles.join('; ')}`);
    // After the call none of them is left. The driver reports "closed" before the server has
    // dropped the backend, so the question is asked until the answer is "none" (finding F63).
    await untilNoSession(maintenance, { applications: [applicationName] }, 'connections of the reset after the answer');
    expect(await routineSessions()).toEqual([]);
    // The report holds counts, names and integrity values: no connection field at all.
    expect(Object.keys(lastReport()).sort()).toEqual(
      ['actorId', 'auditHead', 'cancelledPairingCodes', 'counts', 'database', 'epoch', 'firstBuild', 'kept', 'leftoversRemoved', 'lineage', 'now', 'operatorsWithSignIn', 'previousDropped', 'previousEpoch', 'reason', 'role', 'scenario', 'scenarioLoadedSeq', 'serverVersion', 'stepMs', 'totalMs'].sort(),
    );
    // The driver was left no variable of its own to read a credential from.
    expect(Object.keys(process.env).filter((name) => name.startsWith('PG'))).toEqual([]);

    // ── The database behind the name is a new one; nothing of the routine is left.
    const catalog = await catalogOf(maintenance, names());
    expect(catalog[db.name]?.owner).toBe('dems_owner');
    expect(catalog[db.name]?.oid).not.toBe(before.catalog[db.name]?.oid);
    expect(catalog[`${db.name}_next`]).toBeUndefined();
    expect(catalog[`${db.name}_prev`]).toBeUndefined();

    // ── The reopened pool: the runtime role again, with the start-up options of the first pool.
    expect(server.app.db.generation).toBe(2);
    expect(server.database.connections.pools).toBe(2);
    const who = await server.app.db.pool.query<{ role: string; superuser: boolean; database: string }>(
      'SELECT current_user::text AS role, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser, current_database()::text AS database',
    );
    expect(who.rows).toEqual([{ role: 'dems_app', superuser: false, database: db.name }]);
    expect(await pathOf(server.app.db.pool)).toBe(pathBefore);
    expect(server.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(server.app.readiness.isReady()).toBe(true);

    // ── Kept, unchanged: six tables as a whole, by a record dump and by the contract's checksum.
    const kept = await dumpKept(owner());
    for (const table of UNCHANGED_TABLES) {
      expect(kept[table], table).toEqual(before.kept[table]);
      expect(await contractChecksum(owner(), table), table).toBe(before.checksums[table]);
      expect(kept[table]?.length, table).toBeGreaterThan(0);
    }
    console.info(`[w43] kept tables, rows before = after the reset: ${[...UNCHANGED_TABLES, 'pairing_codes'].map((table) => `${table} ${kept[table]?.length}`).join('; ')}; audit_chain_history ${before.kept['audit_chain_history']?.length} -> ${kept['audit_chain_history']?.length}`);

    // ── Pairing codes: four rows byte-equal; the one that was ACTIVE is CANCELLED by the caller.
    const codesBefore = before.kept['pairing_codes'] ?? [];
    const codesAfter = kept['pairing_codes'] ?? [];
    expect(codesAfter).toHaveLength(5);
    expect(codesAfter.slice(0, 4)).toEqual(codesBefore.slice(0, 4));
    const closed = await owner().query('SELECT state, closed_at::text AS closed_at, closed_by_operator_id FROM public.pairing_codes WHERE id = $1', [ACTIVE_CODE_ID]);
    expect(closed.rows).toEqual([{ state: 'CANCELLED', closed_at: String(resetNow), closed_by_operator_id: 'OPR-002' }]);
    expect((await owner().query("SELECT count(*)::int AS rows FROM public.pairing_codes WHERE state = 'ACTIVE'")).rows).toEqual([{ rows: 0 }]);

    // ── The new chain: the seed history, then ONE SCENARIO_LOADED row, written by the routine
    // with the caller as its actor. The module added no row; no row names the closed code.
    const audit = await dumpTable(owner(), 'audit_log', 'seq');
    expect(audit).toHaveLength(83);
    expect(occurrences(audit.join('\n'), ACTIVE_CODE_ID)).toBe(0);
    expect(occurrences(audit.join('\n'), 'PAIRING_CODE')).toBe(0);
    const trail = await trailOf(owner());
    expect(trail.filter((row) => row.type === 'SCENARIO_LOADED')).toHaveLength(1);
    expect(trail.at(-1)).toMatchObject({
      seq: 83,
      type: 'SCENARIO_LOADED',
      actorId: 'OPR-002',
      at: resetNow,
      details: { scenario: 'idle', reset: true, previousRows: Number(before.chain.rowCount), previousHead: before.chain.headHash },
    });
    expect(lastReport().auditHead).toEqual({ seq: 83, hash: trail.at(-1)?.hash });

    // ── The lineage: one more row, and it holds what the old database really held.
    expect(await lineageRows(owner())).toEqual([
      {
        reset_no: '1',
        epoch: String(epochBefore),
        head_hash: before.chain.headHash,
        row_count: before.chain.rowCount,
        first_seq: '1',
        last_seq: before.chain.headSeq,
        reset_at: String(resetNow),
        actor_id: 'OPR-002',
        reason: 'RESET',
        scenario: 'idle',
      },
    ]);

    // ── The epoch: previous + 1, once. The routine's, the stored one, the engine's and the answer agree.
    const state = await owner().query('SELECT epoch::text AS epoch, seeded_at::text AS seeded_at, last_reset_at::text AS last_reset_at, scenario FROM public.core_state');
    expect(state.rows).toEqual([{ epoch: String(epochBefore + 1), seeded_at: String(resetNow), last_reset_at: String(resetNow), scenario: 'idle' }]);
    expect(server.engine).toMatchObject({ running: true, epoch: epochBefore + 1, revision: 0 });

    // ── Operators are rebuilt: the seed's roles, all enabled.
    const operators = await owner().query('SELECT id, role_id, enabled, role_changed_at FROM public.operators ORDER BY id');
    expect(operators.rows).toEqual([
      { id: 'OPR-001', role_id: 'INVESTIGATOR', enabled: true, role_changed_at: null },
      { id: 'OPR-002', role_id: 'SUPERVISOR', enabled: true, role_changed_at: null },
      { id: 'OPR-003', role_id: 'TECHNICIAN', enabled: true, role_changed_at: null },
    ]);

    // ── Everything else equals a seed of an empty database for the same instant and epoch.
    const reference = await db.another({ template: 'schema', slug: 'w43ref' });
    await seedDatabase(reference.ownerPool(), { now: resetNow, scenario: 'idle', epoch: epochBefore + 1, lastResetAt: resetNow, target: 'test' });
    // The tablet link is recomputed from the open sockets (spec §12.4; finding F78; decision D127): no paired device holds
    // one here, so the link and the tablet's entry among the other devices are not the dataset's. They are asserted below.
    const exceptLink = { without: { hardware_snapshot: ['tablet_link', 'other_devices'] } };
    const built = await digestAll(owner(), exceptLink);
    const seeded = await digestAll(reference.ownerPool(), exceptLink);
    const rebuilt = Object.keys(seeded).filter((table) => !NOT_COMPARED_WITH_SEED.has(table));
    // 23 (was 13 in the 30-table era, 22 in dbc-3): the seed report of §9.4 now names all 41
    // tables - `session_capture_sources` of dbc-4 is rebuilt (emptied) by a reset - and the
    // seven v2 data tables (intervals, fragments, chunks, transcripts, revisions, sealing jobs,
    // stt_config) join the tables a reset must rebuild to the seed's shape. The per-table equality
    // loop below is the real check; this pin guards the list's size.
    expect(rebuilt).toHaveLength(29); // + T-42 `session_stt_config`, rebuilt (PE-129b-01, row 129b); + T-44, T-45 of task 4 set A, T-46, T-47 of set B and T-48 of set C, not carried by a reset yet
    for (const table of rebuilt) expect(built[table], table).toBe(seeded[table]);
    // What the two columns ARE: the link the engine held (no device socket: OFFLINE), stored as the engine holds it.
    const heldLink = server.engine.slice('tabletLink');
    expect(heldLink.state).toBe('OFFLINE');
    const storedLink = await owner().query('SELECT tablet_link, other_devices FROM public.hardware_snapshot');
    expect(storedLink.rows).toEqual([{ tablet_link: heldLink, other_devices: server.engine.slice('otherDevices') }]);
    const withoutSignIn = { without: { operators: ['last_sign_in_at'] } };
    expect((await digestAll(owner(), withoutSignIn))['operators']).toBe((await digestAll(reference.ownerPool(), withoutSignIn))['operators']);
    expect(audit.slice(0, 82)).toEqual(await dumpTable(reference.ownerPool(), 'audit_log', 'seq'));
    const events = await dumpTable(owner(), 'events', 'seq');
    expect(events.slice(0, -1)).toEqual(await dumpTable(reference.ownerPool(), 'events', 'seq'));
    expect(events.at(-1)).toContain('SCENARIO_LOADED');
    console.info(`[w43] domain tables equal to a fresh seed at the reset's instant and epoch: ${rebuilt.length} of ${rebuilt.length} (${rebuilt.join(', ')})`);
    await discard(maintenance, reference, db.run.identity.prefix);

    // ── What the engine holds is what the tables hold; the stored chain verifies with its lineage.
    expect(await storedSlices(owner())).toStrictEqual(withoutNegativeZeros(server.engine.state()));
    expect(server.engine.slice('audit')).toMatchObject({ total: 83, head: trail.at(-1)?.hash });
    expect(server.engine.slice('faults').active).toEqual([]);
    for (const check of BLOCKING_BOOT_CHECKS) await check.run(db.appPool());
    expect(await checkStoredChain(db.appPool(), { verifyDigests: verifyStoredAuditRows })).toMatchObject({ ok: true, rowsChecked: 83, linkBreaks: 0, digests: 'ok', lineage: 'ok' });

    // ── The publications, on the seam: one new epoch for every operator socket (RT-7), the
    // operator whose role the seed put back, and the two lists of the portal that changed.
    const published = server.publications.slice(publicationsBefore);
    const starts = published.flatMap((publication) => (publication.kind === 'state' && publication.change.cause === 'start' ? [publication.change] : []));
    expect(starts).toMatchObject([{ cause: 'start', epoch: epochBefore + 1, revision: 0, ops: [] }]);
    const technician = (await owner().query<{ permission: string }>(
      "SELECT rp.permission_id AS permission FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role_id = 'TECHNICIAN' ORDER BY p.sort_order",
    )).rows.map((row) => row.permission);
    expect(published.filter((publication) => publication.kind !== 'state' && publication.kind !== 'meters')).toEqual([
      { kind: 'session.updated', operatorId: 'OPR-003', role: 'TECHNICIAN', permissions: technician },
      { kind: 'admin.changed', resource: 'USERS' },
      { kind: 'admin.changed', resource: 'PAIRING_CODE' },
    ]);
    // The new epoch is published before anything else of the reset, and nothing of the old epoch follows it.
    const firstStart = published.findIndex((publication) => publication.kind === 'state' && publication.change.cause === 'start');
    expect(published.slice(firstStart).every((publication) => publication.kind !== 'state' || publication.change.epoch === epochBefore + 1)).toBe(true);

    // ── Nobody was signed out: the open sessions are the rows they were.
    const sessions = await owner().query<{ id: string }>('SELECT id::text AS id FROM public.auth_sessions WHERE ended_at IS NULL ORDER BY 1');
    expect(sessions.rows).toEqual(before.sessions.rows);

    // ── What the runtime role itself sent for this request. While the routine worked (R-2 to
    // R-9) it sent nothing at all: its pool was closed, and nothing of the server asked for one.
    const quiet = observed.slice(2).map((entry) => entry.statements);
    expect(new Set(quiet).size).toBe(1);
    const closedAt = quiet[0] ?? 0;
    const beforeClose = server.sql.slice(statementsBefore, closedAt);
    const afterReopen = server.sql.slice(closedAt, statementsAfter);
    // The last statement before the pool closed is the read of the operators' roles (the engine
    // had nothing left to write), and the first on the reopened pool is the probe of B-1.
    expect(beforeClose.at(-1)).toBe('read: SELECT id, role_id AS role FROM public.operators ORDER BY id');
    expect(afterReopen.slice(0, 2)).toEqual(['read: SELECT 1', "read: SELECT current_setting('search_path') AS search_path"]);
    expect(afterReopen.at(-1)).toBe('read: SELECT id, role_id AS role FROM public.operators ORDER BY id');
    // No statement of the runtime role changes a row of the audit table or the lineage table, ever.
    expect(server.sql.filter((text) => rewritesAppendOnlyTable(text.replace(/^(?:read|unit): /, '')))).toEqual([]);
    expect(rewritesAppendOnlyTable('update "audit_log" set "message" = $1')).toBe(true);
    const short = (text: string): string => text.replace(/\s+/g, ' ').slice(0, 96);
    console.info(`[w43] resetDemo: routine ${Math.round(lastReport().totalMs)} ms (${Object.entries(lastReport().stepMs).map(([step, ms]) => `${step} ${Math.round(ms)}`).join(', ')})`);
    console.info(`[w43] statements of the runtime role for the reset request, before its pool closed (${beforeClose.length}):\n${beforeClose.map((text) => `        ${short(text)}`).join('\n')}`);
    console.info(`[w43] statements of the runtime role on the reopened pool, up to the answer (${afterReopen.length}):\n${afterReopen.map((text) => `        ${short(text)}`).join('\n')}`);

    afterFirst = { lineage: await dumpTable(owner(), 'audit_chain_history', 'reset_no'), kept, epoch: epochBefore + 1 };
  });

  it('the session of the operator who reset still resolves, and the operator the seed re-enabled is served again with the seed\'s role', async () => {
    const status = await server.get('SUPERVISOR', STATUS);
    expect(status.statusCode).toBe(200);
    expect(validateCoreApiResponse('getDemoStatus', 200, status.json())).toEqual({ ok: true });
    expect(status.json()).toMatchObject({ scenario: 'idle', activeFaults: [], epoch: afterFirst.epoch, lastResetAt: lastReport().now, seededAt: lastReport().now });

    const session = await server.get('SUPERVISOR', '/api/v1/auth/session');
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({ operator: { id: 'OPR-002', role: 'SUPERVISOR' }, demoControls: true });
    // OPR-003 was disabled and a SUPERVISOR before the reset: 401 then. The same cookie now.
    const technician = await server.get('TECHNICIAN', '/api/v1/auth/session');
    expect(technician.statusCode).toBe(200);
    expect(technician.json()).toMatchObject({ operator: { id: 'OPR-003', role: 'TECHNICIAN' } });
    expect(outcome(await server.get('TECHNICIAN', STATUS))).toEqual([403, 'NOT_PERMITTED']);
    // The settings a reset keeps are the ones the engine reloaded.
    expect(server.engine.slice('settings')).toMatchObject({ presentationMode: true, timeFormat: '12' });
  });

  it('a unit of work after the reset works on the reopened pool: the next rows continue the NEW chain', async () => {
    const head = await readHead(owner());
    expect(head.seq).toBe(84);
    // (the 84th row is the ACCESS_DENIED of the TECHNICIAN's call above: the guard's unit ran on the reopened pool)
    const response = await server.post('SUPERVISOR', FAULTS, { kind: 'FAN_STALL' });
    expect(outcome(response)).toEqual([204, null]);
    expect(response.headers['x-dems-epoch']).toBe(String(afterFirst.epoch));
    expect(validateCoreApiResponse('injectFault', 204, bodyOf(response))).toEqual({ ok: true });
    await server.drive(1_500);
    const trail = await trailOf(owner());
    expect(trail[83]).toMatchObject({ seq: 84, type: 'ACCESS_DENIED', actorId: 'OPR-003', prevHash: lastReport().auditHead.hash });
    expect(trail[84]).toMatchObject({ seq: 85, type: 'FAULT_RAISED', prevHash: head.hash });
    expect(verifyTrail(trail, await readHead(owner()))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(owner())).toStrictEqual(withoutNegativeZeros(server.engine.state()));
    expect(outcome(await server.post('SUPERVISOR', FAULTS_CLEAR, { kind: 'FAN_STALL' }))).toEqual([204, null]);
    expect(await pathOf(server.app.db.pool)).toBe(pathBefore);
  });
});

describe('loadScenario, and a reset while a recording runs', () => {
  it('loadScenario recording: epoch + 1 again, two lineage rows of which the first is byte-equal, every kept table byte-equal, the recording runs with no restart fault', async () => {
    const chain = await chainFacts(owner());
    const keptBefore = await dumpKept(owner());
    const resetNow = server.clock.now();
    const linesBefore = server.log.lines().length;
    const publicationsBefore = server.publications.length;
    observed = [];

    const response = await server.post('SUPERVISOR', SCENARIO, { name: 'recording' });
    expect(outcome(response)).toEqual([200, null]);
    expect(response.json()).toEqual({ epoch: afterFirst.epoch + 1 });
    expect(validateCoreApiResponse('loadScenario', 200, response.json())).toEqual({ ok: true });
    expect(response.headers['x-dems-epoch']).toBe(String(afterFirst.epoch + 1));
    expect(marksSince(linesBefore)).toEqual(SUCCESS_MARKS(afterFirst.epoch + 1));
    expect(lastReport()).toMatchObject({ previousEpoch: afterFirst.epoch, epoch: afterFirst.epoch + 1, reason: 'SCENARIO_LOAD', scenario: 'recording', actorId: 'OPR-002', cancelledPairingCodes: 0 });
    expect(lastReport().lineage).toMatchObject({ carried: 1, total: 2 });

    // The lineage: the first row as it was, a second one for the chain this load discarded.
    const lineage = await dumpTable(owner(), 'audit_chain_history', 'reset_no');
    expect(lineage).toHaveLength(2);
    expect(lineage[0]).toBe(afterFirst.lineage[0]);
    expect((await lineageRows(owner()))[1]).toEqual({
      reset_no: '2',
      epoch: String(afterFirst.epoch),
      head_hash: chain.headHash,
      row_count: chain.rowCount,
      first_seq: '1',
      last_seq: chain.headSeq,
      reset_at: String(resetNow),
      actor_id: 'OPR-002',
      reason: 'SCENARIO_LOAD',
      scenario: 'recording',
    });

    // Every kept table, pairing codes included (none is ACTIVE any more), is what it was.
    const kept = await dumpKept(owner());
    for (const table of [...UNCHANGED_TABLES, 'pairing_codes']) expect(kept[table], table).toEqual(keptBefore[table]);

    // The scenario runs: RECORDING, not FAULT (a reload after a reset is no process start).
    expect(server.engine).toMatchObject({ running: true, epoch: afterFirst.epoch + 2 - 1, revision: 0 });
    expect(server.engine.slice('session')?.state).toBe('RECORDING');
    expect((await server.get('SUPERVISOR', STATUS)).json()).toMatchObject({ scenario: 'recording', epoch: afterFirst.epoch + 1, lastResetAt: resetNow });
    const loaded = (await trailOf(owner())).filter((row) => row.type === 'SCENARIO_LOADED');
    expect(loaded).toMatchObject([{ actorId: 'OPR-002', details: { scenario: 'recording', reset: false, previousHead: chain.headHash } }]);
    const starts = server.publications.slice(publicationsBefore).flatMap((publication) => (publication.kind === 'state' && publication.change.cause === 'start' ? [publication.change] : []));
    expect(starts).toMatchObject([{ epoch: afterFirst.epoch + 1, revision: 0, ops: [] }]);
    // No role changed and no code was closed: only the user list is announced.
    expect(server.publications.slice(publicationsBefore).filter((publication) => publication.kind !== 'state' && publication.kind !== 'meters')).toEqual([{ kind: 'admin.changed', resource: 'USERS' }]);

    // The engine ticks on the rebuilt database: the recording goes on and what is stored follows.
    await server.drive(3_000);
    expect(server.engine.slice('session')?.state).toBe('RECORDING');
    expect(await storedSlices(owner())).toStrictEqual(withoutNegativeZeros(server.engine.state()));
  });

  it('resetDemo while the recording runs is not refused (spec §12.4 names no state in which a reset is): the session is gone with its chain, the epoch moves by 1, the lineage has a third row', async () => {
    expect(server.engine.slice('session')?.state).toBe('RECORDING');
    const chain = await chainFacts(owner());
    const epochBefore = server.engine.epoch;
    const resetNow = server.clock.now();

    const response = await server.post('SUPERVISOR', RESET);
    expect(outcome(response)).toEqual([200, null]);
    expect(response.json()).toEqual({ epoch: epochBefore + 1 });
    expect(lastReport()).toMatchObject({ previousEpoch: epochBefore, epoch: epochBefore + 1, reason: 'RESET', scenario: 'idle' });

    expect(server.engine.slice('session')).toBeNull();
    expect((await owner().query('SELECT count(*)::int AS rows FROM public.active_session')).rows).toEqual([{ rows: 0 }]);
    expect((await server.get('SUPERVISOR', STATUS)).json()).toMatchObject({ scenario: 'idle', epoch: epochBefore + 1, lastResetAt: resetNow });
    const lineage = await lineageRows(owner());
    expect(lineage).toHaveLength(3);
    expect(lineage[2]).toMatchObject({ reset_no: '3', epoch: String(epochBefore), head_hash: chain.headHash, row_count: chain.rowCount, reason: 'RESET', scenario: 'idle', actor_id: 'OPR-002' });
    expect((await dumpTable(owner(), 'audit_chain_history', 'reset_no'))[0]).toBe(afterFirst.lineage[0]);
    expect(await checkStoredChain(db.appPool(), { verifyDigests: verifyStoredAuditRows })).toMatchObject({ ok: true, digests: 'ok', lineage: 'ok' });
    // Three resets: the epoch moved by exactly 3 since the boot, and the pool was opened four times.
    expect(server.engine.epoch).toBe(4);
    expect(server.app.db.generation).toBe(4);
  });

  it('after three resets: no connection of the reset is left, the pool is the runtime role on its pinned path, and no credential is in the log', async () => {
    await untilNoSession(maintenance, { applications: [applicationName] }, 'connections of the reset after three resets');
    const sessions = await sessionsOf(maintenance, { databases: names() });
    // Apart from the fixture pools of this test, the only sessions on the database are the server's own.
    expect([...new Set(sessions.map((row) => `${row.role} ${row.application}`))].filter((entry) => !/ dems-test-(?:fixture|app)$/.test(entry))).toEqual(['dems_app dems-core-server']);
    expect(await pathOf(server.app.db.pool)).toBe(RUNTIME_SEARCH_PATH);
    expect(credentialLeaks(server.log.text())).toEqual([]);
    expect(server.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
    expect(server.log.text()).not.toMatch(/password|passwd|secret/i);
  });
});
