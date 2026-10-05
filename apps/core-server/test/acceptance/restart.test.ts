// Acceptance test "restart and recovery" of the DEMS Core server (plan row W53; success
// criterion SC2; AC-B-04, AC-B-05, AC-B-06; SR-17; spec §5, §8.6; database contract §9.6).
//
// WHAT IS ASKED. What the server stored is what it serves after a restart, and a session that
// was in flight when the process stopped is recovered as the specification says.
//
// WHAT A RESTART IS HERE. What it is in production, without the listener: the app is closed
// (`app.close()`: the engine's last unit, the pipeline, the runtime pool), the test asks
// PostgreSQL until it lists no backend of the runtime role on the clone, and a NEW app is built
// by the real factory on the SAME database and booted through `app.readiness.boot()`: the boot
// checks, then the engine's `start('boot')`.
//
// WHAT IS REAL. Every request is `app.inject` through the real stages 2 to 7 and the real
// handlers of the modules; the device registry, the engine host and the realtime seam are the
// server's own. The callers are the seeded operators, signed in through the sign-in route, and a
// device that redeemed a pairing code the server issued. Two things only are the test's: the
// server clock (a manual clock behind the seam `clock`) and the engine's timer (a manual timer),
// so no test waits. The one real wait is the bounded poll for the backends after a close.
//
// WHAT IS COMPARED. The content checksum of contract §9.6 of EVERY table of schema `public`,
// taken from the stopped database and again after the start, as `dems_owner` (SELECT only). A
// table that a start may write is named with its reason, and the part of it that a start must
// not touch is compared too.
//
// Secrets (P19). A cookie, a session token, a device credential and a pairing code are taken
// from an answer and handed on. None is printed, logged, put into a test name or compared in an
// assertion whose failure message would show it.
import {
  validateCoreApiResponse,
  type ActivePairingCode,
  type AdminUserList,
  type AuditChainStatus,
  type AuditPage,
  type AuthSessionInfo,
  type CurrentSessionResponse,
  type EvidenceDetail,
  type EvidencePage,
  type EvidenceVerifyResultBody,
  type EventPage,
  type PairedDeviceList,
  type SecurityStatus,
  type SessionCommandResponse,
  type SessionHistoryPage,
  type StorageDetail,
} from '@dems/shared/api';
import { AUDIT_RING_SIZE, ROLE_PERMISSIONS, createManualClock, recordingBytes, type AuditRow, type ControllableClock, type OperatorRole, type SimOperator } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { linkProblems, readHead, readTrail, sleep, verifyTrail } from '../../src/core/__tests__/support';
import { BULK_TEMPLATE_NOW } from '../../src/db/fixtures/__tests__/template-hook.bulk';
import { tableChecksums, withoutNegativeZeros } from '../support/seed';
import { HEALTH_SNAPSHOT_INTERVAL_MS, engineControl } from '../../src/engine';
import { FIXED_NOW, manualTimer, storedSlices } from '../../src/engine/__tests__/support';
import { USERS, roleUrl } from '../../src/modules/admin/__tests__/support';
import { SESSION as AUTH_SESSION, SIGN_OUT, TOUCH, cookieValue, deviceSignIn, get, webPost, webSignIn, type Headers } from '../support/identity';
import { CODE, DEVICE, DEVICES, deviceGet, devicePost, expectContract, portalPost, redeem, revokeUrl, wrongCodeFor } from '../support/pairing';
import { CURRENT, HISTORY, SESSION, on, seeded, sessionInput } from '../../src/modules/sessions/__tests__/support';
import { captureLog, unitTestConfig, type CapturedLog } from '../support/config';
import { useTestDatabase, type TestDatabase } from '../helpers/db';

const db = useTestDatabase({ template: 'seed' });

// A cap, not a wait: a clone made inside a test waits for the clone lock, which the runs of
// other rows may hold on a loaded host (the reset and the sessions rows' files do the same).
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

// ── Time: the manual clock and the manual timer only ───────────────────────────────────────────

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
/** The engine's timer period: one timer call per 50 ms of the clock. */
const TICK_MS = 50;
/** How long the server is down in a restart of this file. Under the idle limit of a session. */
const STOP_MS = 90 * SECOND;
/** The engine resolves the eight checks within 4.9 s, stops in 1.5 s, finalises in at most 7.2 s and recovers in 3 s. */
const PRECHECK_MS = 5 * SECOND;
const FINALIZE_MS = 20 * SECOND;
const RECOVERY_MS = 4 * SECOND;
/** Spec §5, SR-11: a session is idle after 15 minutes without activity and ends 8 hours after its issue. */
const IDLE_LIMIT_MS = 15 * MINUTE;
const ABSOLUTE_LIMIT_MS = 8 * HOUR;
/** The cap of the one real wait of this file: the poll for the backends of a closed app. */
const BACKEND_WAIT_CAP_MS = 30 * SECOND;

/** An instant as seconds after the seed instant, for the printed lines. */
const rel = (at: number): string => `+${((at - FIXED_NOW) / SECOND).toFixed(2)} s`;

// ── The server ─────────────────────────────────────────────────────────────────────────────────

interface Server {
  readonly app: FastifyInstance;
  /** The server clock of this process: it moves only when the test moves it (ENG-16). */
  readonly clock: ControllableClock;
  readonly log: CapturedLog;
  /** The instant on the server clock at which this process was booted. */
  readonly startedAt: number;
  /** Advances the clock by `ms`, one timer period at a time, and lets the engine finish each tick. */
  drive(ms: number): Promise<void>;
}

/**
 * A process start: the real app factory on the database, as `dems_app`, booted as the entry
 * point boots it. The clock and the engine's timer are in place before the boot.
 */
async function startServer(target: TestDatabase, at: number): Promise<Server> {
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', port: 4420 }),
    logStream: log.stream,
  });
  target.onCleanup(() => app.close());
  await app.ready();
  const clock = createManualClock(at);
  app.seams.replace('clock', clock);
  const timer = manualTimer();
  const engine = engineControl(app);
  engine.useTimer(timer.timer);
  await app.readiness.boot();
  await engine.idle();
  await app.pipeline.drain();
  return {
    app,
    clock,
    log,
    startedAt: at,
    async drive(ms) {
      for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
        clock.advance(TICK_MS);
        timer.fire();
        await engine.idle();
      }
    },
  };
}

/**
 * A process stop: the app is closed, and the test asks the SERVER until no backend of the runtime
 * role is left on the clone. The driver's `pool.end()` resolves before PostgreSQL has removed the
 * backend (finding F63, lesson 2); the question is keyed by this test's own database, which no
 * other run has (lesson 1).
 */
async function stopServer(server: Server, owner: Pool): Promise<{ polls: number; waitedMs: number }> {
  await server.app.close();
  const began = performance.now();
  for (let polls = 0; ; polls += 1) {
    const { rows } = await owner.query<{ open: string }>(
      "SELECT count(*)::text AS open FROM pg_stat_activity WHERE datname = current_database() AND usename = 'dems_app'",
    );
    const waitedMs = performance.now() - began;
    if (rows[0]?.open === '0') return { polls, waitedMs };
    if (waitedMs > BACKEND_WAIT_CAP_MS) throw new Error(`the stopped server still has ${rows[0]?.open} backend(s) on the clone after ${Math.round(waitedMs)} ms`);
    await sleep(25);
  }
}

// ── Callers ────────────────────────────────────────────────────────────────────────────────────

/** A seeded operator signed in on the web console. */
interface Caller {
  readonly operator: SimOperator;
  /** `{ cookie: 'dems_session_<port>=…' }`. Handed on, never printed. */
  readonly cookie: Headers;
}

async function signIn(server: Server, role: OperatorRole): Promise<Caller> {
  const operator = seeded(role);
  const response = await webSignIn(server.app, operator.username);
  const cookieName = server.app.config.sessionCookieName;
  const token = response.statusCode === 200 ? cookieValue(response, cookieName) : null;
  if (token === null) throw new Error(`the web sign-in of the ${role} answered ${response.statusCode}`);
  return { operator, cookie: { cookie: `${cookieName}=${token}` } };
}

interface IssuedCode {
  readonly codeId: string;
  /** Held by the test only. */
  readonly code: string;
  readonly expiresAt: number;
  /** Failed redeems before the code is closed. */
  readonly attemptsAllowed: number;
}

/** Operation 15 by an operator who may manage pairing. */
async function issueCode(server: Server, caller: Caller): Promise<IssuedCode> {
  const response = await portalPost(server.app, CODE, caller.cookie);
  if (response.statusCode !== 201) throw new Error(`issuePairingCode answered ${response.statusCode}`);
  const body = response.json() as { codeId: string; code: string; expiresAt: number; attemptsAllowed: number };
  return { codeId: body.codeId, code: body.code, expiresAt: body.expiresAt, attemptsAllowed: body.attemptsAllowed };
}

interface PairedTablet {
  readonly deviceId: string;
  /** Held by the test only. */
  readonly credential: string;
}

/** Operation 18 from a device without a credential: a real paired device. */
async function redeemCode(server: Server, code: string, deviceName: string): Promise<PairedTablet> {
  const response = await redeem(server.app, code, { deviceName });
  if (response.statusCode !== 201) throw new Error(`redeemPairingCode answered ${response.statusCode}`);
  const body = response.json() as { deviceId: string; deviceCredential: string };
  return { deviceId: body.deviceId, credential: body.deviceCredential };
}

/** An operator's sign-in on a paired device: the bearer value of the session. */
async function signInOnDevice(server: Server, tablet: PairedTablet, role: OperatorRole): Promise<string> {
  const response = await deviceSignIn(server.app, tablet.credential, seeded(role).username);
  const token = response.statusCode === 200 ? (response.json() as { sessionToken?: string }).sessionToken : undefined;
  if (token === undefined) throw new Error(`the device sign-in answered ${response.statusCode}`);
  return token;
}

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
function outcome(response: LightMyRequestResponse): [number, string | null] {
  if (response.body === '') return [response.statusCode, null];
  return [response.statusCode, (response.json() as { error?: { code?: string } }).error?.code ?? null];
}

/** The caller's own session, as operation 4 answers it. */
async function sessionInfo(server: Server, cookie: Headers): Promise<AuthSessionInfo> {
  const response = await get(server.app, AUTH_SESSION, cookie);
  expect(response.statusCode, 'getAuthSession').toBe(200);
  return response.json() as AuthSessionInfo;
}

async function currentSession(server: Server, cookie: Headers): Promise<CurrentSessionResponse['session']> {
  const response = await get(server.app, CURRENT, cookie);
  expect(response.statusCode, 'getCurrentSession').toBe(200);
  expectContract('getCurrentSession', response);
  return (response.json() as CurrentSessionResponse).session;
}

// ── What the server serves: the read operations of the journey ─────────────────────────────────

const STORAGE_DETAIL = '/api/v1/storage/detail';
const STORAGE_POLICY = '/api/v1/storage/policy';
const EVIDENCE = '/api/v1/evidence';
const AUDIT = '/api/v1/audit';
const AUDIT_CHAIN = `${AUDIT}/chain`;

/** Read operations whose answers must survive a restart, by operation ID. All are GETs: none writes. */
const READS: ReadonlyArray<readonly [operationId: string, url: string]> = [
  ['getAuthSession', AUTH_SESSION],
  ['getRoleMatrix', '/api/v1/rbac/matrix'],
  ['listUsers', USERS],
  ['listPairedDevices', DEVICES],
  ['getPairingCodeStatus', CODE],
  ['getStorageDetail', STORAGE_DETAIL],
  ['getCurrentSession', CURRENT],
  ['listSessionHistory', `${HISTORY}?limit=200`],
  ['listEvidence', `${EVIDENCE}?limit=200`],
  ['listAuditRows', `${AUDIT}?limit=200`],
  ['listEvents', '/api/v1/events?limit=200'],
  ['verifyAuditChain', AUDIT_CHAIN],
  ['getSecurityStatus', '/api/v1/security/status'],
];
/** The reads that show the audit chain and the event list: a start that writes a row moves them. */
const TRAIL_READS: readonly string[] = ['listAuditRows', 'listEvents', 'verifyAuditChain', 'getSecurityStatus'];

/** A body without its `serverTime` members: the one value of an answer that follows the clock. */
function withoutServerTime(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutServerTime);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'serverTime')
        .map(([key, member]) => [key, withoutServerTime(member)]),
    );
  }
  return value;
}

type Served = Readonly<Record<string, unknown>>;

/** The answers of the read operations for one caller, each validated against the contract. */
async function served(server: Server, caller: Caller): Promise<Served> {
  const bodies: Record<string, unknown> = {};
  for (const [operationId, url] of READS) {
    const response = await get(server.app, url, caller.cookie);
    expect(response.statusCode, operationId).toBe(200);
    expect(validateCoreApiResponse(operationId, 200, response.json()), operationId).toEqual({ ok: true });
    bodies[operationId] = withoutServerTime(response.json());
  }
  return bodies;
}

const answerOf = <Body>(bodies: Served, operationId: string): Body => bodies[operationId] as Body;

// ── What PostgreSQL holds: the content checksum of contract §9.6, per table ────────────────────

/**
 * The recipe of contract §9.6 for the four tables the seed row's helper leaves out (it compares
 * two SEEDS; a restart keeps the database): `operator_credentials` by its primary key, and the
 * three tables keyed by a generated identifier as the contract writes them, the row image
 * without `id`, ordered by `issued_at, token_hash` or `at, cause`.
 */
const CONTRACT_RECIPES: Readonly<Record<string, { readonly image: string; readonly order: string }>> = {
  operator_credentials: { image: 'to_jsonb(t)', order: 't.operator_id' },
  auth_sessions: { image: "to_jsonb(t) - 'id'", order: 't.issued_at, t.token_hash' },
  biometric_tokens: { image: "to_jsonb(t) - 'id'", order: 't.issued_at, t.token_hash' },
  health_snapshots: { image: "to_jsonb(t) - 'id'", order: 't.at, t.cause' },
};

/** `md5(coalesce(string_agg(<image>::text, E'\n' ORDER BY <order>), ''))` over the rows that match. */
async function checksumOf(owner: Pool, table: string, image: string, order: string, where = 'true'): Promise<string> {
  const { rows } = await owner.query<{ digest: string }>(
    `SELECT md5(coalesce(string_agg((${image})::text, E'\\n' ORDER BY ${order}), '')) AS digest FROM public.${table} AS t WHERE ${where}`,
  );
  return rows[0]?.digest ?? '';
}

interface TableState {
  /** The contract's checksum of each table of schema `public`, by table name. */
  readonly checksums: Readonly<Record<string, string>>;
  readonly rows: Readonly<Record<string, number>>;
}

/**
 * The checksum and the row count of EVERY table the catalog lists in schema `public`. 26 come
 * from the seed row's `tableChecksums` (the contract's recipe by primary key), four from the
 * recipes above. A table that neither knows (one a later migration adds) is still compared: its
 * rows in the order of their images.
 */
async function readTables(owner: Pool): Promise<TableState> {
  const { rows: catalog } = await owner.query<{ name: string }>("SELECT tablename::text AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const byPrimaryKey = await tableChecksums(owner);
  const checksums: Record<string, string> = {};
  const rows: Record<string, number> = {};
  for (const { name } of catalog) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('a table of schema public has a name this test does not put into a statement');
    const recipe = CONTRACT_RECIPES[name];
    if (recipe !== undefined) checksums[name] = await checksumOf(owner, name, recipe.image, recipe.order);
    else checksums[name] = byPrimaryKey[name] ?? (await checksumOf(owner, name, 'to_jsonb(t)', 'to_jsonb(t)::text'));
    rows[name] = Number((await owner.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.${name}`)).rows[0]?.n);
  }
  return { checksums, rows };
}

/** The tables whose checksum differs between two readings, in name order. */
function movedTables(before: TableState, after: TableState): string[] {
  return Object.keys(after.checksums)
    .filter((table) => after.checksums[table] !== before.checksums[table])
    .sort();
}

// ── What a start may write (spec §8.6), and what it must not ───────────────────────────────────

/**
 * The three kinds of start in this file.
 *
 *   EPOCH   nothing was in flight and no tablet was connected: the start writes the epoch only;
 *   LINK    a tablet was connected at the stop: the start also writes the truthful
 *           `TABLET_LINK_CHANGED` row (no device is connected after a start);
 *   FAULT   a session was in flight and a tablet was connected: the restart fault, and that row.
 */
type StartKind = 'EPOCH' | 'LINK' | 'FAULT';

interface Mover {
  /** Why the table may differ between the stopped database and the started server. */
  readonly reason: string;
  /**
   * The part of the table a start must NOT touch: a row image and a row filter. Compared as a
   * checksum of its own. Absent where the whole table is the start's to write; the test that
   * knows the rows then asserts them.
   */
  readonly part?: { readonly image?: string; readonly where?: string };
}

interface RestFacts {
  readonly epoch: number;
  readonly auditSeq: number;
  readonly eventSeq: number;
  /**
   * The greatest stored write instant: of the hardware snapshot, of the active session, of the
   * newest audit row and of the newest event (spec §8.6; decision D28 D-1). Read by the test
   * from the stopped database, not taken from the engine.
   */
  readonly lastCommittedAt: number;
}

async function restFacts(owner: Pool): Promise<RestFacts> {
  const { rows } = await owner.query<{ epoch: string; audit_seq: string; event_seq: string; committed: string }>(
    `SELECT (SELECT epoch FROM public.core_state)::text AS epoch,
            (SELECT seq FROM public.audit_chain_head)::text AS audit_seq,
            (SELECT coalesce(max(seq), 0) FROM public.events)::text AS event_seq,
            greatest(
              (SELECT written_at FROM public.hardware_snapshot),
              (SELECT updated_at FROM public.active_session),
              (SELECT max(at) FROM public.audit_log),
              (SELECT max(at) FROM public.events))::text AS committed`,
  );
  const row = rows[0];
  if (row === undefined) throw new Error('the stopped database answered no row');
  return { epoch: Number(row.epoch), auditSeq: Number(row.audit_seq), eventSeq: Number(row.event_seq), lastCommittedAt: Number(row.committed) };
}

function moversOf(kind: StartKind, rest: RestFacts, startedAt: number): Readonly<Record<string, Mover>> {
  const movers: Record<string, Mover> = {
    core_state: {
      reason: 'the epoch is the stored one plus 1 at every start (decision D14); `updated_at` is the start instant',
      part: { image: "to_jsonb(t) - 'epoch' - 'updated_at'" },
    },
  };
  if (kind === 'EPOCH') return movers;
  const fault = kind === 'FAULT';
  movers['audit_log'] = {
    reason: fault ? 'the rows the start wrote: FAULT_RAISED (the restart fault) and TABLET_LINK_CHANGED' : 'the row the start wrote: TABLET_LINK_CHANGED (no device is connected after a start)',
    part: { where: `t.seq <= ${rest.auditSeq}` },
  };
  movers['audit_chain_head'] = { reason: 'follows the newest audit row' };
  movers['events'] = { reason: 'the events of those rows', part: { where: `t.seq <= ${rest.eventSeq}` } };
  movers['engine_counters'] = {
    reason: fault ? 'the counters those rows took: `event`, and `item` for the alert' : 'the counter those rows took: `event`',
    part: { where: fault ? "t.name NOT IN ('event', 'item')" : "t.name <> 'event'" },
  };
  movers['hardware_snapshot'] = fault
    ? { reason: 'the slices of the power-failure fault, the tablet link (OFFLINE after a start) and `written_at`' }
    : {
        reason: "the tablet link is OFFLINE after a start, with the tablet's entry among the other devices; `written_at` is the start instant",
        part: { image: "to_jsonb(t) - 'tablet_link' - 'other_devices' - 'written_at'" },
      };
  if (fault) {
    movers['active_session'] = { reason: 'the restart fault: the session is in FAULT, stamped at the last committed instant' };
    movers['alerts'] = { reason: 'the critical alert of the fault' };
    movers['health_snapshots'] = { reason: 'one row for the fault raise', part: { where: `t.at < ${startedAt}` } };
  }
  return movers;
}

async function partChecksums(owner: Pool, movers: Readonly<Record<string, Mover>>): Promise<Record<string, string>> {
  const parts: Record<string, string> = {};
  for (const [table, mover] of Object.entries(movers)) {
    if (mover.part === undefined) continue;
    const image = mover.part.image ?? 'to_jsonb(t)';
    parts[table] = await checksumOf(owner, table, image, `(${image})::text`, mover.part.where);
  }
  return parts;
}

/** The comparison as it goes into the test document: one line per table. */
function printComparison(label: string, atRest: TableState, started: TableState, movers: Readonly<Record<string, Mover>>): void {
  const tables = Object.keys(started.checksums);
  const width = Math.max(...tables.map((table) => table.length));
  const moved = movedTables(atRest, started);
  const lines = tables.map((table) => {
    const equal = atRest.checksums[table] === started.checksums[table];
    const counts = `${atRest.rows[table]} -> ${started.rows[table]}`.padEnd(10);
    const why = equal ? '' : `  ${movers[table]?.reason ?? 'NOT EXPECTED TO MOVE'}`;
    return `[w53]   ${table.padEnd(width)}  ${counts}  ${atRest.checksums[table]}  ${started.checksums[table]}  ${equal ? 'equal' : 'MOVED'}${why}`;
  });
  console.info(
    [
      `[w53] ${label}: content checksum of contract §9.6 per table, stopped -> started (${tables.length} tables: ${tables.length - moved.length} equal, ${moved.length} moved)`,
      `[w53]   ${'table'.padEnd(width)}  ${'rows'.padEnd(10)}  ${'stopped'.padEnd(32)}  ${'started'.padEnd(32)}`,
      ...lines,
    ].join('\n'),
  );
}

// ── A restart, with everything this file asserts about EVERY restart ───────────────────────────

interface Restarted {
  /** The new process. */
  readonly server: Server;
  /** The clock of the old process at its stop, and of the new one at its boot. */
  readonly stoppedAt: number;
  readonly startedAt: number;
  /** What the stopped database held. */
  readonly rest: RestFacts;
  readonly atRest: TableState;
  /** The newest audit row before the stop, and the rows the start itself wrote. */
  readonly lastRowBefore: AuditRow;
  readonly written: AuditRow[];
}

const rowLine = (row: AuditRow): string => `${row.seq} ${row.type} (${row.actorId ?? 'no actor'}, ${rel(row.at)})`;

/**
 * Stops `server` and starts a new process on the same database `downtimeMs` later on the clock.
 * Asserts what holds for every restart of this file:
 *
 *   the stop       writes at most the hardware snapshot (spec §8.6 "Stop");
 *   the tables     every table of schema `public` has the same checksum in the stopped database
 *                  and after the start, except the tables a start of this kind writes, and of
 *                  those the part it must not touch (AC-B-04);
 *   the epoch      is the stored one plus 1, in the engine and in the table (decision D14);
 *   the chain      the rows the start wrote continue the stored head without a gap, the head
 *                  row follows them, and the whole stored chain verifies.
 */
async function restart(label: string, target: TestDatabase, server: Server, kind: StartKind, downtimeMs: number = STOP_MS): Promise<Restarted> {
  const owner = target.ownerPool();
  await engineControl(server.app).idle();
  await server.app.pipeline.drain();
  const running = await readTables(owner);
  const epochBefore = server.app.engine.epoch;
  const stoppedAt = server.clock.now();

  const stop = await stopServer(server, owner);

  const atRest = await readTables(owner);
  expect(
    movedTables(running, atRest).filter((table) => table !== 'hardware_snapshot'),
    `${label}: a stop writes the hardware snapshot and nothing else`,
  ).toEqual([]);
  const rest = await restFacts(owner);
  expect(rest.epoch, `${label}: the stored epoch is the epoch of the stopped process`).toBe(epochBefore);
  expect(rest.lastCommittedAt, `${label}: nothing is stored after the stop instant`).toBeLessThanOrEqual(stoppedAt);
  const trailAtRest = await readTrail(owner);
  const lastRowBefore = trailAtRest.at(-1);
  if (lastRowBefore === undefined) throw new Error('the stopped database holds no audit row');
  const startedAt = stoppedAt + downtimeMs;
  const movers = moversOf(kind, rest, startedAt);
  const partsAtRest = await partChecksums(owner, movers);

  const next = await startServer(target, startedAt);

  const started = await readTables(owner);
  printComparison(label, atRest, started, movers);
  // AC-B-04: every table is equal, except those a start of this kind writes.
  expect(movedTables(atRest, started), `${label}: the tables that differ after the start`).toEqual(Object.keys(movers).sort());
  // ... and of those, the part a start must not touch.
  expect(await partChecksums(owner, movers), `${label}: the untouched part of the tables the start wrote`).toEqual(partsAtRest);

  // The epoch: previous plus 1, in the engine and in the table.
  const after = await restFacts(owner);
  expect(next.app.engine.epoch, `${label}: the epoch of the new process`).toBe(epochBefore + 1);
  expect(after.epoch, `${label}: the stored epoch`).toBe(epochBefore + 1);

  // The chain: gap-free on the stored head, the head row on the newest row, all rows verify.
  const trail = await readTrail(owner);
  const head = await readHead(owner);
  const written = trail.filter((row) => row.seq > rest.auditSeq);
  expect(trail.slice(0, trailAtRest.length), `${label}: the stored rows of before the stop`).toEqual(trailAtRest);
  expect(written[0]?.prevHash ?? lastRowBefore.hash, `${label}: the first row of the start links to the last row before the stop`).toBe(lastRowBefore.hash);
  expect(linkProblems(trail), `${label}: links of the stored chain`).toEqual([]);
  expect(head, `${label}: the head row`).toEqual({ seq: trail.at(-1)?.seq, hash: trail.at(-1)?.hash });
  expect(verifyTrail(trail, head), `${label}: the stored chain`).toMatchObject({ ok: true, checked: trail.length });

  console.info(
    `[w53] ${label}: stop at ${rel(stoppedAt)} (last committed instant ${rel(rest.lastCommittedAt)}), start at ${rel(startedAt)}; epoch ${epochBefore} -> ${next.app.engine.epoch}; ` +
      `no backend of dems_app left after ${stop.polls} poll(s), ${stop.waitedMs.toFixed(0)} ms; last row before the stop: ${rowLine(lastRowBefore)}; ` +
      `rows the start wrote: ${written.map(rowLine).join(', ') || 'none'}`,
  );
  return { server: next, stoppedAt, startedAt, rest, atRest, lastRowBefore, written };
}

/** The audit rows stored by `work`, in sequence order. */
async function writtenBy(owner: Pool, work: () => Promise<unknown>): Promise<AuditRow[]> {
  const before = await readHead(owner);
  await work();
  return (await readTrail(owner)).filter((row) => row.seq > before.seq);
}

const actors = (rows: readonly AuditRow[]): Array<[string, string | null]> => rows.map((row) => [row.type, row.actorId]);

/** The error lines of a server's log: none is expected in any process of this file. */
const errorLines = (server: Server): string[] =>
  server.log
    .lines()
    .filter((line) => Number(line['level']) >= 50)
    .map((line) => String(line['msg']));

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AC-B-04, SR-17: the journey
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-04, SR-17: a policy change, a paired device, a role change and a sealed session, then four restarts', () => {
  const NEW_POLICY = { retentionPolicy: 'CASE_CLOSURE', retentionDays: 3_650, autoArchive: false } as const;

  let target: TestDatabase;
  let owner: Pool;
  /** The five processes, in order: the first, and one per restart. */
  const servers: Server[] = [];
  const restarts: Restarted[] = [];
  const processOf = (index: number): Server => {
    const server = servers[index];
    if (server === undefined) throw new Error(`the journey did not get as far as process ${index + 1}`);
    return server;
  };
  const restartOf = (index: number): Restarted => {
    const entry = restarts[index];
    if (entry === undefined) throw new Error(`the journey did not get as far as restart ${index + 1}`);
    return entry;
  };

  let supervisor: Caller;
  let investigator: Caller;
  /** `OPR-003`: a TECHNICIAN at the sign-in, an INVESTIGATOR from the role change on. */
  let reassigned: Caller;
  /** A session that was signed out before the first stop. */
  let signedOut: Caller;
  let tablet: PairedTablet;
  /** The INVESTIGATOR's session on the tablet: a bearer value. */
  let tabletSession = '';
  /** A code that is still ACTIVE at the first stop, with one failed attempt on it. */
  let pendingCode: IssuedCode;
  /** The tablet that code pairs after the first restart; revoked before the fourth stop. */
  let secondTablet: PairedTablet;
  let sessionId = '';
  let evidenceId = '';
  /** What the read operations answered the SUPERVISOR before each stop. */
  const servedBefore: Served[] = [];

  beforeAll(async () => {
    target = db.database;
    owner = target.ownerPool();
    servers.push(await startServer(target, FIXED_NOW));
  });

  it('the journey before the first stop: the policy, a paired tablet, a code left active, the role, a recording sealed and verified', async () => {
    const server = processOf(0);
    supervisor = await signIn(server, 'SUPERVISOR');
    investigator = await signIn(server, 'INVESTIGATOR');
    reassigned = await signIn(server, 'TECHNICIAN');
    signedOut = await signIn(server, 'TECHNICIAN');
    expect(outcome(await webPost(server.app, SIGN_OUT, signedOut.cookie))).toEqual([204, null]);

    // The storage policy: changed by the SUPERVISOR, to something the seed does not hold.
    const seededPolicy = ((await get(server.app, STORAGE_DETAIL, supervisor.cookie)).json() as StorageDetail).storagePolicy;
    expect(seededPolicy).not.toEqual(NEW_POLICY);
    const policy = await webPost(server.app, STORAGE_POLICY, supervisor.cookie, { retentionPolicy: NEW_POLICY.retentionPolicy, autoArchive: NEW_POLICY.autoArchive });
    expect(policy.statusCode).toBe(200);
    expect(policy.json()).toEqual(NEW_POLICY);
    // A TECHNICIAN may change it too (MAINTENANCE); this body changes nothing.
    expect(outcome(await webPost(server.app, STORAGE_POLICY, reassigned.cookie, { autoArchive: NEW_POLICY.autoArchive }))).toEqual([200, null]);

    // A tablet: a code the SUPERVISOR issued, redeemed; the INVESTIGATOR signs in on it.
    tablet = await redeemCode(server, (await issueCode(server, supervisor)).code, 'Interview tablet 01');
    tabletSession = await signInOnDevice(server, tablet, 'INVESTIGATOR');
    // A second code, left ACTIVE, with one wrong attempt counted on it.
    pendingCode = await issueCode(server, supervisor);
    expect(outcome(await redeem(server.app, wrongCodeFor(pendingCode.code)))).toEqual([401, 'INVALID_CODE']);

    // The role of another operator: OPR-003 from TECHNICIAN to INVESTIGATOR.
    const role = await webPost(server.app, roleUrl(reassigned.operator.id), supervisor.cookie, { role: 'INVESTIGATOR', reason: 'Moved to interview duty' });
    expect(role.statusCode).toBe(200);
    expect(role.json()).toMatchObject({ id: reassigned.operator.id, role: 'INVESTIGATOR', enabled: true, roleChangedAt: server.clock.now() });
    // The same operator's NEXT request reflects it: the session stays, the permissions are the new role's.
    expect((await sessionInfo(server, reassigned.cookie)).operator.role).toBe('INVESTIGATOR');
    expect(outcome(await webPost(server.app, STORAGE_POLICY, reassigned.cookie, { autoArchive: NEW_POLICY.autoArchive }))).toEqual([403, 'NOT_PERMITTED']);

    // A session from create to SEALED evidence. The tablet is connected, as the realtime channel
    // sets the link when a paired device's socket is accepted: the pre-check needs the Core link.
    await server.app.engine.setTabletLink('CONNECTED');
    const created = await webPost(server.app, SESSION, investigator.cookie, sessionInput(investigator.operator.id));
    expect(created.statusCode).toBe(201);
    sessionId = (created.json() as SessionCommandResponse).sessionId;
    expect(outcome(await webPost(server.app, on(sessionId, 'start'), investigator.cookie))).toEqual([202, null]);
    await server.drive(PRECHECK_MS);
    expect(outcome(await webPost(server.app, on(sessionId, 'start'), investigator.cookie))).toEqual([200, null]);
    await server.drive(10 * SECOND);
    // A marker from the tablet (the INVESTIGATOR's bearer session), a note from the web console.
    expect(outcome(await devicePost(server.app, on(sessionId, 'markers'), tabletSession, { label: 'Key statement' }))).toEqual([204, null]);
    expect(outcome(await webPost(server.app, on(sessionId, 'notes'), supervisor.cookie, { text: 'Subject asked for a break' }))).toEqual([204, null]);
    expect(outcome(await webPost(server.app, on(sessionId, 'stop'), investigator.cookie, { reason: 'Interview completed' }))).toEqual([202, null]);
    await server.drive(FINALIZE_MS);
    const sealed = await currentSession(server, investigator.cookie);
    expect(sealed).toMatchObject({ id: sessionId, state: 'SEALED' });
    evidenceId = sealed?.evidenceId ?? '';
    expect(evidenceId).not.toBe('');

    // The sealed evidence verifies; the summary is acknowledged.
    const verified = await webPost(server.app, `${EVIDENCE}/${evidenceId}/verify`, supervisor.cookie);
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toMatchObject({ evidenceId, ok: true, manifestOk: true, signatureOk: true });
    expect(outcome(await webPost(server.app, on(sessionId, 'summary/acknowledge'), investigator.cookie))).toEqual([204, null]);
    // The stop comes between two seconds of the clock, 1.35 s later.
    await server.drive(1_350);
    expect(errorLines(server)).toEqual([]);
  });

  it('restart 1 (the tablet was connected): every table is equal before the stop and after the start, except what the start itself writes; the epoch is the previous plus 1', async () => {
    servedBefore[0] = await served(processOf(0), supervisor);
    const first = await restart('restart 1', target, processOf(0), 'LINK');
    restarts.push(first);
    servers.push(first.server);

    // The one row the start wrote: no device is connected after a start, and the row says so.
    expect(first.written.map((row) => [row.type, row.actorId, row.at, row.details])).toEqual([['TABLET_LINK_CHANGED', null, first.startedAt, { state: 'OFFLINE' }]]);
    // No session was in flight: no fault.
    expect(first.written.some((row) => row.type === 'FAULT_RAISED')).toBe(false);
    // The tablet link in the stored snapshot: OFFLINE since the start.
    const link = await owner.query<{ link: { state: string; changedAt: number }; written: string }>(
      'SELECT tablet_link AS link, written_at::text AS written FROM public.hardware_snapshot',
    );
    expect(link.rows[0]?.link).toEqual({ state: 'OFFLINE', changedAt: first.startedAt });
    expect(Number(link.rows[0]?.written)).toBe(first.startedAt);
  });

  it('what the restarted server serves through the routes is what was stored: the policy, the tablet, the active code, the role, the sealed evidence, the history', async () => {
    const server = processOf(1);
    const first = restartOf(0);
    const before = servedBefore[0] ?? {};
    // The SUPERVISOR's cookie is the one of before the stop: nobody signs in on this process.
    const after = await served(server, supervisor);

    // Every answer that does not show the trail is the answer of before the stop.
    for (const [operationId] of READS) {
      if (!TRAIL_READS.includes(operationId)) expect(after[operationId], operationId).toEqual(before[operationId]);
    }
    // Named one by one, what the row asks for.
    expect(answerOf<StorageDetail>(after, 'getStorageDetail').storagePolicy).toEqual(NEW_POLICY);
    expect(answerOf<PairedDeviceList>(after, 'listPairedDevices').devices).toMatchObject([
      { id: tablet.deviceId, name: 'Interview tablet 01', state: 'PAIRED', online: false, codeIssuedBy: supervisor.operator.id, signedInOperatorId: investigator.operator.id },
    ]);
    expect(answerOf<ActivePairingCode>(after, 'getPairingCodeStatus').active).toEqual({
      codeId: pendingCode.codeId,
      issuedBy: supervisor.operator.id,
      issuedAt: FIXED_NOW,
      expiresAt: pendingCode.expiresAt,
      // One failed attempt was counted on it before the stop: the count is stored, not remembered.
      attemptsRemaining: pendingCode.attemptsAllowed - 1,
    });
    expect(answerOf<AdminUserList>(after, 'listUsers').users.find((user) => user.id === reassigned.operator.id)).toMatchObject({ role: 'INVESTIGATOR', enabled: true, roleChangedAt: FIXED_NOW });
    expect(answerOf<EvidencePage>(after, 'listEvidence').items[0]).toMatchObject({ id: evidenceId, sessionId, status: 'SEALED' });
    expect(answerOf<EvidencePage>(after, 'listEvidence').items[0]?.sealedAt).not.toBeNull();
    expect(answerOf<SessionHistoryPage>(after, 'listSessionHistory').items[0]).toMatchObject({ id: sessionId, outcome: 'SEALED', evidenceId, durationMs: 10 * SECOND, faultKind: null });
    // The sealed session stays the open one until the next create (engine row finding F-7).
    expect(answerOf<CurrentSessionResponse>(after, 'getCurrentSession').session).toMatchObject({ id: sessionId, state: 'SEALED', evidenceId });

    // The trail: every row of before the stop, then the row of the start; the view the engine
    // rehydrated and the stored table both verify through it.
    const pageBefore = answerOf<AuditPage>(before, 'listAuditRows');
    const pageAfter = answerOf<AuditPage>(after, 'listAuditRows');
    expect(pageBefore.rows).toHaveLength(pageBefore.total);
    expect(pageAfter.rows.slice(0, pageBefore.rows.length)).toEqual(pageBefore.rows);
    expect(pageAfter.rows.slice(pageBefore.rows.length).map((row) => row.type)).toEqual(['TABLET_LINK_CHANGED']);
    expect(pageAfter.total).toBe(pageBefore.total + 1);
    const chain = answerOf<AuditChainStatus>(after, 'verifyAuditChain');
    expect(chain.view).toMatchObject({ ok: true, checked: pageAfter.total, head: pageAfter.head });
    expect(chain.stored).toMatchObject({ ok: true, checked: pageAfter.total, head: pageAfter.head, firstBadSeq: null });
    // The events: the same, and the one of the start. The security status: the same slice, the new head.
    const eventsBefore = answerOf<EventPage>(before, 'listEvents').events;
    const eventsAfter = answerOf<EventPage>(after, 'listEvents').events;
    expect(eventsAfter.slice(0, eventsBefore.length)).toEqual(eventsBefore);
    expect(eventsAfter.slice(eventsBefore.length).map((event) => [event.type, event.at])).toEqual([['TABLET_DISCONNECTED', first.startedAt]]);
    expect(answerOf<SecurityStatus>(after, 'getSecurityStatus')).toEqual({
      security: answerOf<SecurityStatus>(before, 'getSecurityStatus').security,
      auditHead: pageAfter.head,
      auditTotal: pageAfter.total,
    });

    // The role change is that operator's, in that operator's own session of before the stop.
    const own = await sessionInfo(server, reassigned.cookie);
    expect(own.operator).toMatchObject({ id: reassigned.operator.id, role: 'INVESTIGATOR' });
    expect([...own.permissions].sort()).toEqual([...ROLE_PERMISSIONS.INVESTIGATOR].sort());

    // Reading changed nothing: the tables are what they were right after the start.
    const now = await readTables(owner);
    expect(movedTables(first.atRest, now)).toEqual(Object.keys(moversOf('LINK', first.rest, first.startedAt)).sort());
    expect(errorLines(server)).toEqual([]);
  });

  it('SR-17: the SUPERVISOR session of before the stop works without a new sign-in; a session that was signed out stays ended, with its reason', async () => {
    const server = processOf(1);
    const first = restartOf(0);
    const before = answerOf<AuthSessionInfo>(servedBefore[0] ?? {}, 'getAuthSession');

    // The session is the stored row: issued before the stop, by the password, on the web console.
    const info = await sessionInfo(server, supervisor.cookie);
    expect(info).toMatchObject({ method: 'PASSWORD', deviceId: null, issuedAt: FIXED_NOW, absoluteExpiresAt: FIXED_NOW + ABSOLUTE_LIMIT_MS });
    expect(info.operator).toMatchObject({ id: supervisor.operator.id, role: 'SUPERVISOR' });
    expect([info.issuedAt, info.lastActivityAt, info.idleExpiresAt, info.absoluteExpiresAt]).toEqual([before.issuedAt, before.lastActivityAt, before.idleExpiresAt, before.absoluteExpiresAt]);
    expect(info.idleExpiresAt).toBe(info.lastActivityAt + IDLE_LIMIT_MS);
    expect(info.lastActivityAt).toBeLessThan(first.stoppedAt);
    // Nobody signed in on this process: the start wrote one row, and it is no sign-in.
    expect((await readTrail(owner)).filter((row) => row.seq > first.rest.auditSeq).map((row) => row.type)).toEqual(['TABLET_LINK_CHANGED']);

    // A command with it: accepted, answered in the epoch of the NEW process; it is activity, so
    // the one thing that moves is that session's last-seen instant.
    const tables = await readTables(owner);
    const others = await checksumOf(owner, 'auth_sessions', "to_jsonb(t) - 'last_seen_at'", 't.issued_at, t.token_hash');
    const touched = await webPost(server.app, TOUCH, supervisor.cookie);
    expect(touched.statusCode).toBe(200);
    expectContract('touchSession', touched);
    expect(touched.json()).toEqual({ idleExpiresAt: server.clock.now() + IDLE_LIMIT_MS, absoluteExpiresAt: before.absoluteExpiresAt });
    expect(touched.headers['x-dems-epoch']).toBe(String(server.app.engine.epoch));
    expect(server.app.engine.epoch).toBe(processOf(0).app.engine.epoch + 1);
    expect(movedTables(tables, await readTables(owner))).toEqual(['auth_sessions']);
    expect(await checksumOf(owner, 'auth_sessions', "to_jsonb(t) - 'last_seen_at'", 't.issued_at, t.token_hash')).toBe(others);

    // The other sessions of before the stop are open too.
    expect((await get(server.app, AUTH_SESSION, investigator.cookie)).statusCode).toBe(200);
    expect((await get(server.app, AUTH_SESSION, reassigned.cookie)).statusCode).toBe(200);
    // An ended session keeps its end and its reason: the cookie resolves to nothing.
    expect(outcome(await get(server.app, AUTH_SESSION, signedOut.cookie))).toEqual([401, 'NOT_SIGNED_IN']);
    const ended = await owner.query<{ operator_id: string; ended_at: string; end_reason: string }>(
      'SELECT operator_id, ended_at::text AS ended_at, end_reason FROM public.auth_sessions WHERE ended_at IS NOT NULL',
    );
    expect(ended.rows).toEqual([{ operator_id: signedOut.operator.id, ended_at: String(FIXED_NOW), end_reason: 'SIGNED_OUT' }]);
  });

  it('the first commands of the restarted process: the sealed evidence verifies; the audit chain goes on from the row the start wrote; the code of before the stop pairs a second tablet', async () => {
    const server = processOf(1);
    const first = restartOf(0);

    // The sealed evidence, as it was sealed in the first process: the item, and its verification.
    const before = answerOf<EvidencePage>(servedBefore[0] ?? {}, 'listEvidence').items[0];
    const detail = await get(server.app, `${EVIDENCE}/${evidenceId}`, supervisor.cookie);
    expectContract('getEvidence', detail);
    expect((detail.json() as EvidenceDetail).evidence).toEqual(before);
    const verifying = await writtenBy(owner, async () => {
      const verified = await webPost(server.app, `${EVIDENCE}/${evidenceId}/verify`, supervisor.cookie);
      expect(verified.statusCode).toBe(200);
      expectContract('verifyEvidence', verified);
      const verdict = verified.json() as EvidenceVerifyResultBody;
      expect(verdict).toMatchObject({ evidenceId, ok: true, manifestOk: true, signatureOk: true, at: server.clock.now() });
      expect(verdict.tracks.map((track) => [track.trackId, track.ok, track.actual === track.expected])).toEqual(
        (before?.tracks ?? []).map((track) => [track.trackId, true, true]),
      );
      expect(verdict.tracks.map((track) => track.expected)).toEqual((before?.tracks ?? []).map((track) => track.sha256));
      expect(verdict.tracks).toHaveLength(4);
      expect(verified.headers['x-dems-epoch']).toBe(String(server.app.engine.epoch));
    });

    // Across the restart, without a gap: the last row before the stop, the row the start wrote,
    // the first row of the next command.
    expect(actors(verifying)).toEqual([['EVIDENCE_VERIFIED', supervisor.operator.id]]);
    const trail = await readTrail(owner);
    const [last, link, next] = [trail[first.rest.auditSeq - 1], trail[first.rest.auditSeq], trail[first.rest.auditSeq + 1]];
    expect([last?.seq, link?.seq, next?.seq]).toEqual([first.rest.auditSeq, first.rest.auditSeq + 1, first.rest.auditSeq + 2]);
    expect(last).toEqual(first.lastRowBefore);
    expect([link?.type, link?.prevHash]).toEqual(['TABLET_LINK_CHANGED', last?.hash]);
    expect([next?.type, next?.prevHash, next?.at]).toEqual(['EVIDENCE_VERIFIED', link?.hash, server.clock.now()]);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true, checked: trail.length });
    console.info(
      `[w53] across restart 1: last row before the stop ${last === undefined ? '-' : rowLine(last)}; the start wrote ${link === undefined ? '-' : rowLine(link)}; ` +
        `first row of the next command ${next === undefined ? '-' : rowLine(next)}`,
    );

    // The code issued before the stop, still inside its 300 s, with its count of failed attempts:
    // it pairs a second tablet, and the device counter went on.
    expect(server.clock.now()).toBeLessThan(pendingCode.expiresAt);
    const pairing = await writtenBy(owner, async () => {
      secondTablet = await redeemCode(server, pendingCode.code, 'Interview tablet 02');
      expect(Number(secondTablet.deviceId.slice(-4))).toBe(Number(tablet.deviceId.slice(-4)) + 1);
    });
    expect(pairing.map((row) => row.type)).toEqual(['PAIRING_SUCCESS']);
    expect(((await get(server.app, CODE, supervisor.cookie)).json() as ActivePairingCode).active).toBeNull();
    expect((await deviceGet(server.app, DEVICE, secondTablet.credential)).statusCode).toBe(200);
    expect(errorLines(server)).toEqual([]);
  });

  it('restarts 2 and 3, one straight after the other: only the epoch moves, twice; every read operation answers what it answered before; the epoch is the second process\'s plus 2', async () => {
    servedBefore[1] = await served(processOf(1), supervisor);
    const second = await restart('restart 2', target, processOf(1), 'EPOCH');
    restarts.push(second);
    servers.push(second.server);
    expect(second.written).toEqual([]);
    // The third process only reads, and is stopped again at once.
    expect(await served(second.server, supervisor)).toEqual(servedBefore[1]);

    const third = await restart('restart 3', target, second.server, 'EPOCH');
    restarts.push(third);
    servers.push(third.server);
    expect(third.written).toEqual([]);
    expect(await served(third.server, supervisor)).toEqual(servedBefore[1]);

    // Nothing was written between the two: the stopped database is the same, table by table.
    expect(third.rest).toEqual({ ...second.rest, epoch: second.rest.epoch + 1 });
    expect(movedTables(second.atRest, third.atRest)).toEqual(['core_state']);
    expect(third.lastRowBefore).toEqual(second.lastRowBefore);
    expect(third.server.app.engine.epoch).toBe(processOf(1).app.engine.epoch + 2);
    expect([second.server, third.server].flatMap(errorLines)).toEqual([]);
  });

  it('the first commands after three restarts: the chain goes on from the last row before the second stop; the changed role decides; the tablets resolve; one is revoked', async () => {
    const server = processOf(3);
    const second = restartOf(1);

    // The changed role, three restarts later: refused where a TECHNICIAN was allowed (one denial
    // row by the guard, naming the new role), allowed where only an INVESTIGATOR is.
    const denial = await writtenBy(owner, async () => {
      const refused = await webPost(server.app, STORAGE_POLICY, reassigned.cookie, { autoArchive: true });
      expect(outcome(refused)).toEqual([403, 'NOT_PERMITTED']);
      expect((refused.json() as { error: { details: unknown } }).error.details).toMatchObject({ operationId: 'setStoragePolicy', role: 'INVESTIGATOR' });
    });
    expect(denial.map((row) => [row.type, row.actorId, row.details['role']])).toEqual([['ACCESS_DENIED', reassigned.operator.id, 'INVESTIGATOR']]);
    // Two starts wrote nothing: the first row of the fourth process is the next sequence number
    // on the hash of the last row the second process wrote.
    expect([denial[0]?.seq, denial[0]?.prevHash, denial[0]?.at]).toEqual([second.rest.auditSeq + 1, second.lastRowBefore.hash, server.clock.now()]);
    console.info(
      `[w53] across restarts 2 and 3: last row before the second stop ${rowLine(second.lastRowBefore)}; the two starts wrote nothing; first row of the next command ${denial[0] === undefined ? '-' : rowLine(denial[0])}`,
    );

    // The engine's own check of the investigator of a session reads the rehydrated operators (ENG-3).
    const creating = await writtenBy(owner, async () => {
      const created = await webPost(server.app, SESSION, reassigned.cookie, sessionInput(reassigned.operator.id, 'LP/2026/1001-0100'));
      expect(created.statusCode).toBe(201);
      const body = created.json() as SessionCommandResponse;
      // The session counter went on where the first process left it.
      expect(Number(body.sessionId.slice(-4))).toBe(Number(sessionId.slice(-4)) + 1);
      expect(body).toMatchObject({ state: 'CREATE', created: true });
    });
    expect(actors(creating)).toEqual([['SESSION_CREATED', reassigned.operator.id]]);

    // The tablet of the first process: its credential and the operator's session on it still resolve.
    const registration = await deviceGet(server.app, DEVICE, tablet.credential);
    expect(registration.statusCode).toBe(200);
    expect(registration.json()).toMatchObject({ deviceId: tablet.deviceId, state: 'PAIRED' });
    expect((await deviceGet(server.app, CURRENT, tabletSession)).statusCode).toBe(200);
    // The second tablet is revoked here: the next process must not know it as paired.
    const revoking = await writtenBy(owner, async () => {
      const response = await webPost(server.app, revokeUrl(secondTablet.deviceId), supervisor.cookie, { reason: 'Lost on site' });
      expect(response.statusCode).toBe(200);
      expectContract('revokeDevice', response);
    });
    expect(actors(revoking)).toEqual([['DEVICE_REVOKED', supervisor.operator.id]]);
    const devices = ((await get(server.app, DEVICES, supervisor.cookie)).json() as PairedDeviceList).devices;
    expect(devices.map((device) => [device.name, device.state, device.pairedWithCodeId]).sort()).toEqual([
      ['Interview tablet 01', 'PAIRED', devices.find((device) => device.id === tablet.deviceId)?.pairedWithCodeId],
      ['Interview tablet 02', 'REVOKED', pendingCode.codeId],
    ]);
    expect(errorLines(server)).toEqual([]);
  });

  it('restart 4, after commands of a rehydrated process and with a session in CREATE: stable again; a session in CREATE is not faulted; a revoked tablet stays revoked', async () => {
    servedBefore[2] = await served(processOf(3), supervisor);
    const fourth = await restart('restart 4', target, processOf(3), 'EPOCH');
    restarts.push(fourth);
    servers.push(fourth.server);

    expect(fourth.written).toEqual([]);
    const after = await served(fourth.server, supervisor);
    expect(after).toEqual(servedBefore[2]);
    expect(answerOf<CurrentSessionResponse>(after, 'getCurrentSession').session).toMatchObject({ state: 'CREATE', investigatorId: reassigned.operator.id, fault: null });
    expect(fourth.server.app.engine.epoch).toBe(processOf(0).app.engine.epoch + 4);
    // No restart of this journey raised a fault: no session was recording at a stop.
    expect((await readTrail(owner)).filter((row) => row.type === 'FAULT_RAISED' && row.at >= FIXED_NOW)).toEqual([]);

    // A restart resurrects no credential: the revoked tablet is refused, with the guard's one
    // row; the paired one is served.
    expect(answerOf<PairedDeviceList>(after, 'listPairedDevices').devices.find((device) => device.id === secondTablet.deviceId)).toMatchObject({
      state: 'REVOKED',
      revokedBy: supervisor.operator.id,
      revokeReason: 'Lost on site',
    });
    const refusal = await writtenBy(owner, async () => {
      expect(outcome(await deviceGet(fourth.server.app, DEVICE, secondTablet.credential))).toEqual([403, 'DEVICE_REVOKED']);
    });
    expect(refusal.map((row) => [row.type, row.deviceId])).toEqual([['ACCESS_DENIED', secondTablet.deviceId]]);
    expect((await deviceGet(fourth.server.app, DEVICE, tablet.credential)).statusCode).toBe(200);
  });

  it('no activity is invented for the time the server was down: no stored row is stamped inside a stop, and the engine goes on from the start instant', async () => {
    const server = processOf(4);
    const head = await readHead(owner);
    await server.drive(HEALTH_SNAPSHOT_INTERVAL_MS + SECOND);

    const windows = restarts.map((entry) => [entry.stoppedAt, entry.startedAt] as const);
    expect(windows).toHaveLength(4);
    const inside = (at: number): boolean => windows.some(([stoppedAt, startedAt]) => at > stoppedAt && at < startedAt);
    const trail = await readTrail(owner);
    expect(trail.filter((row) => inside(row.at)).map(rowLine)).toEqual([]);
    expect(trail.filter((row) => row.seq > head.seq).every((row) => row.at > server.startedAt)).toBe(true);
    const events = await owner.query<{ at: string }>('SELECT at::text AS at FROM public.events');
    expect(events.rows.filter((row) => inside(Number(row.at)))).toEqual([]);
    // The health snapshot of the interval: one, an interval after THIS start, none for the stops.
    const health = await owner.query<{ at: string; cause: string }>('SELECT at::text AS at, cause FROM public.health_snapshots ORDER BY at');
    expect(health.rows.filter((row) => inside(Number(row.at)))).toEqual([]);
    expect(health.rows.filter((row) => Number(row.at) > server.startedAt)).toEqual([{ at: String(server.startedAt + HEALTH_SNAPSHOT_INTERVAL_MS), cause: 'INTERVAL' }]);
    // The newest snapshot write is this process's: within the last second of its clock.
    const written = await owner.query<{ at: string }>('SELECT written_at::text AS at FROM public.hardware_snapshot');
    expect(Number(written.rows[0]?.at)).toBeGreaterThan(server.clock.now() - SECOND);
    expect(Number(written.rows[0]?.at)).toBeLessThanOrEqual(server.clock.now());
  });

  it('SR-17: the idle and the absolute limit still apply on the server clock to sessions that came through four restarts', async () => {
    const server = processOf(4);

    // IDLE: the INVESTIGATOR's web session did nothing since the first process.
    const idle = await sessionInfo(server, investigator.cookie);
    expect(idle.lastActivityAt).toBeLessThan(restartOf(0).stoppedAt);
    expect(idle.idleExpiresAt).toBe(idle.lastActivityAt + IDLE_LIMIT_MS);
    server.clock.set(idle.idleExpiresAt - 1);
    expect((await get(server.app, AUTH_SESSION, investigator.cookie)).statusCode).toBe(200);
    server.clock.set(idle.idleExpiresAt);
    const idled = await writtenBy(owner, async () => {
      expect(outcome(await get(server.app, AUTH_SESSION, investigator.cookie))).toEqual([401, 'NOT_SIGNED_IN']);
    });
    expect(idled.map((row) => [row.type, row.actorId, row.details['reason'], row.at])).toEqual([['AUTH_EXPIRED', investigator.operator.id, 'IDLE', idle.idleExpiresAt]]);

    // ABSOLUTE: the SUPERVISOR's session, kept active from now on every ten minutes, ends 8 hours
    // after its issue in the FIRST process. A restart does not renew it, and activity does not move it.
    const absolute = FIXED_NOW + ABSOLUTE_LIMIT_MS;
    let touches = 0;
    for (;;) {
      const touched = await webPost(server.app, TOUCH, supervisor.cookie);
      expect(touched.statusCode, `touch ${touches + 1} at ${rel(server.clock.now())}`).toBe(200);
      expect(touched.json()).toEqual({ idleExpiresAt: server.clock.now() + IDLE_LIMIT_MS, absoluteExpiresAt: absolute });
      touches += 1;
      if (server.clock.now() + 10 * MINUTE >= absolute) break;
      server.clock.advance(10 * MINUTE);
    }
    server.clock.set(absolute - 1);
    expect((await sessionInfo(server, supervisor.cookie)).absoluteExpiresAt).toBe(absolute);
    server.clock.set(absolute);
    const ended = await writtenBy(owner, async () => {
      expect(outcome(await get(server.app, AUTH_SESSION, supervisor.cookie))).toEqual([401, 'NOT_SIGNED_IN']);
    });
    expect(ended.map((row) => [row.type, row.actorId, row.details['reason'], row.at])).toEqual([['AUTH_EXPIRED', supervisor.operator.id, 'ABSOLUTE', absolute]]);

    const stored = await owner.query<{ operator_id: string; ended_at: string; end_reason: string }>(
      "SELECT operator_id, ended_at::text AS ended_at, end_reason FROM public.auth_sessions WHERE end_reason IN ('IDLE_EXPIRED', 'ABSOLUTE_EXPIRED') ORDER BY ended_at",
    );
    expect(stored.rows).toEqual([
      { operator_id: investigator.operator.id, ended_at: String(idle.idleExpiresAt), end_reason: 'IDLE_EXPIRED' },
      { operator_id: supervisor.operator.id, ended_at: String(absolute), end_reason: 'ABSOLUTE_EXPIRED' },
    ]);
    console.info(
      `[w53] SR-17: the SUPERVISOR session issued at ${rel(FIXED_NOW)} in process 1 answered in processes 2 to 5 without a sign-in; idle expiry of the INVESTIGATOR session at ${rel(idle.idleExpiresAt)} ` +
        `(last activity ${rel(idle.lastActivityAt)}, before the first stop); absolute expiry of the SUPERVISOR session at ${rel(absolute)} after ${touches} touches in process 5`,
    );
  });

  it('at the end: the chain verifies over the rows of all five processes, the tables hold what the engine serves, and no process logged an error', async () => {
    const server = processOf(4);
    const trail = await readTrail(owner);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(server.app.engine.state()));
    const firstEpoch = processOf(0).app.engine.epoch;
    expect(servers.map((entry) => entry.app.engine.epoch)).toEqual([0, 1, 2, 3, 4].map((step) => firstEpoch + step));
    expect(servers.flatMap(errorLines)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AC-B-05, AC-B-06: a session that was in flight when the process stopped
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-05, AC-B-06: a session in flight at the stop is in FAULT after the start, and recoverSession closes it as INCOMPLETE', () => {
  /** The rows of operation 33 and of the engine that completes the recovery (spec §8.6), with who each names. */
  const recoveryRows = (caller: Caller): Array<[string, string | null]> => [
    ['SYSTEM_BOOT', null],
    ['RECOVERY_STARTED', caller.operator.id],
    ['FAULT_CLEARED', null],
  ];
  const COMPLETION_ROWS: Array<[string, string | null]> = [
    ['SESSION_INCOMPLETE', null],
    ['RECOVERY_COMPLETED', null],
  ];
  const named = (rows: ReadonlyArray<[string, string | null]>): string => rows.map(([type, actor]) => `${type} (${actor ?? 'no actor'})`).join(', ');

  interface Flight {
    readonly target: TestDatabase;
    readonly owner: Pool;
    readonly server: Server;
    readonly investigator: Caller;
    readonly supervisor: Caller;
    readonly sessionId: string;
  }

  /** A fresh clone, a booted server, two operators signed in, the tablet connected, a session ARMED. */
  async function armed(slug: string): Promise<Flight> {
    const target = await db.another({ slug });
    const owner = target.ownerPool();
    const server = await startServer(target, FIXED_NOW);
    const investigator = await signIn(server, 'INVESTIGATOR');
    const supervisor = await signIn(server, 'SUPERVISOR');
    await server.app.engine.setTabletLink('CONNECTED');
    const created = await webPost(server.app, SESSION, investigator.cookie, sessionInput(investigator.operator.id));
    expect(created.statusCode).toBe(201);
    const { sessionId } = created.json() as SessionCommandResponse;
    expect(outcome(await webPost(server.app, on(sessionId, 'start'), investigator.cookie))).toEqual([202, null]);
    await server.drive(PRECHECK_MS);
    expect((await currentSession(server, investigator.cookie))?.state).toBe('ARMED');
    return { target, owner, server, investigator, supervisor, sessionId };
  }

  /** The recording of a flight: started, 10 s, a marker, then 2.45 s more, so a stop falls between two seconds. */
  async function record(flight: Flight): Promise<number> {
    const { server, investigator, sessionId } = flight;
    expect(outcome(await webPost(server.app, on(sessionId, 'start'), investigator.cookie))).toEqual([200, null]);
    const startedAt = server.clock.now();
    await server.drive(10 * SECOND);
    expect(outcome(await webPost(server.app, on(sessionId, 'markers'), investigator.cookie, { label: 'Key statement' }))).toEqual([204, null]);
    await server.drive(2_450);
    return startedAt;
  }

  const storedEvidence = async (owner: Pool, sessionId: string): Promise<Array<{ status: string; sealed_at: string | null }>> =>
    (await owner.query<{ status: string; sealed_at: string | null }>('SELECT status, sealed_at::text AS sealed_at FROM public.evidence_items WHERE session_id = $1', [sessionId])).rows;

  const newestHistory = async (server: Server, caller: Caller): Promise<SessionHistoryPage['items'][number] | undefined> => {
    const response = await get(server.app, `${HISTORY}?limit=1`, caller.cookie);
    expect(response.statusCode).toBe(200);
    expectContract('listSessionHistory', response);
    return (response.json() as SessionHistoryPage).items[0];
  };

  /** Operation 33 by `caller`: 202 RECOVERY in the epoch of this process, and the three rows of the recovery's start. */
  async function recover(flight: Flight, server: Server, caller: Caller): Promise<void> {
    const rows = await writtenBy(flight.owner, async () => {
      const response = await webPost(server.app, on(flight.sessionId, 'recover'), caller.cookie);
      expect(response.statusCode).toBe(202);
      expectContract('recoverSession', response);
      expect(response.json()).toEqual({ sessionId: flight.sessionId, state: 'RECOVERY' });
      expect(response.headers['x-dems-epoch']).toBe(String(server.app.engine.epoch));
    });
    expect(actors(rows)).toEqual(recoveryRows(caller));
    expect(rows.every((row) => row.at === server.clock.now())).toBe(true);
  }

  it('AC-B-05: RECORDING at the stop. FAULT at the last committed instant, not one byte of the stop counted; the fault survives a second restart; recoverSession ends in an INCOMPLETE entry and a RECORDED, never sealed, evidence item', async () => {
    const flight = await armed('w53_recording');
    const { target, owner, supervisor, sessionId } = flight;
    const startedAt = await record(flight);
    expect((await currentSession(flight.server, supervisor.cookie))?.state).toBe('RECORDING');
    expect(await storedEvidence(owner, sessionId)).toEqual([]);

    const first = await restart('RECORDING at the stop', target, flight.server, 'FAULT');
    const committed = first.rest.lastCommittedAt;
    // A recording is written once a second: at a stop less than a second of it is not committed.
    expect(first.stoppedAt - committed).toBeGreaterThanOrEqual(0);
    expect(first.stoppedAt - committed).toBeLessThan(SECOND);
    // The start wrote the fault, with no actor, at the last committed instant; then the link row.
    expect(first.written.map((row) => [row.type, row.actorId, row.at])).toEqual([
      ['FAULT_RAISED', null, committed],
      ['TABLET_LINK_CHANGED', null, first.startedAt],
    ]);
    expect(first.written[0]).toMatchObject({ sessionId, severity: 'CRITICAL', details: { kind: 'POWER_FAIL', fromState: 'RECORDING' } });

    // What the operator sees, with the cookie of before the stop: the session waits in FAULT.
    const faulted = await currentSession(first.server, supervisor.cookie);
    expect(faulted).toMatchObject({ id: sessionId, state: 'FAULT', stoppedAt: null, sealedAt: null, evidenceId: null, fault: { kind: 'POWER_FAIL', fromState: 'RECORDING' } });
    expect(Date.parse(faulted?.fault?.at ?? '')).toBe(committed);
    expect(Date.parse(faulted?.startedAt ?? '')).toBe(startedAt);
    // The recorded size is that of the last committed instant: 90 s of the stop would be 205 MB more.
    expect(faulted?.bytesWritten).toBe(recordingBytes(committed - startedAt));
    expect(recordingBytes(first.startedAt - startedAt) - (faulted?.bytesWritten ?? 0)).toBeGreaterThanOrEqual(recordingBytes(STOP_MS));
    const stored = await owner.query<{ state: string; bytes: string }>('SELECT state, bytes_written::text AS bytes FROM public.active_session');
    expect(stored.rows).toEqual([{ state: 'FAULT', bytes: String(recordingBytes(committed - startedAt)) }]);
    // The alert and the health snapshot of the raise; no evidence item yet.
    const alerts = await owner.query<{ kind: string; severity: string; active: boolean; at: string }>('SELECT kind, severity, active, at::text AS at FROM public.alerts');
    expect(alerts.rows).toEqual([{ kind: 'POWER_FAIL', severity: 'CRITICAL', active: true, at: String(committed) }]);
    const health = await owner.query<{ cause: string; fault_kind: string | null; session_state: string | null }>('SELECT cause, fault_kind, session_state FROM public.health_snapshots');
    expect(health.rows).toEqual([{ cause: 'FAULT_RAISED', fault_kind: 'POWER_FAIL', session_state: 'FAULT' }]);
    expect(await storedEvidence(owner, sessionId)).toEqual([]);

    // It stays in FAULT until an operator recovers it, also across ANOTHER stop and start: no
    // second fault, no row, the same instant and the same size.
    await first.server.drive(5 * SECOND);
    const second = await restart('FAULT at the stop', target, first.server, 'EPOCH');
    expect(second.written).toEqual([]);
    const still = await currentSession(second.server, supervisor.cookie);
    expect(still).toMatchObject({ id: sessionId, state: 'FAULT', bytesWritten: faulted?.bytesWritten, fault: faulted?.fault });
    console.info(
      `[w53] RECORDING at the stop: recording from ${rel(startedAt)}, stop at ${rel(first.stoppedAt)}, last committed instant ${rel(committed)}; after the start at ${rel(first.startedAt)}: FAULT at ${rel(committed)}, ` +
        `${faulted?.bytesWritten} bytes = recordingBytes(${committed - startedAt} ms), not ${recordingBytes(first.startedAt - startedAt)}; elapsedMs as served ${faulted?.elapsedMs} (SIM-GAP-W34-1); ` +
        `after a second restart at ${rel(second.startedAt)}: FAULT, the same instant and size, no row`,
    );

    // The recovery, by the SUPERVISOR, in the third process.
    await recover(flight, second.server, supervisor);
    expect((await currentSession(second.server, supervisor.cookie))?.state).toBe('RECOVERY');
    const closed = await writtenBy(owner, () => second.server.drive(RECOVERY_MS));
    expect(actors(closed)).toEqual(COMPLETION_ROWS);
    expect(await currentSession(second.server, supervisor.cookie)).toBeNull();

    // History: INCOMPLETE, with the fault and the recorded time and size of the last committed instant.
    const entry = await newestHistory(second.server, supervisor);
    expect(entry).toMatchObject({ id: sessionId, outcome: 'INCOMPLETE', faultKind: 'POWER_FAIL', startedAt, endedAt: committed, durationMs: committed - startedAt, sizeBytes: recordingBytes(committed - startedAt) });
    // Evidence: one item, RECORDED, never sealed, with its four tracks and the marker.
    expect(await storedEvidence(owner, sessionId)).toEqual([{ status: 'RECORDED', sealed_at: null }]);
    const detail = await get(second.server.app, `${EVIDENCE}/${entry?.evidenceId}`, supervisor.cookie);
    expect(detail.statusCode).toBe(200);
    expectContract('getEvidence', detail);
    const item = (detail.json() as EvidenceDetail).evidence;
    expect(item).toMatchObject({ sessionId, status: 'RECORDED', sealedAt: null, recordedAt: startedAt, endedAt: committed, durationMs: committed - startedAt, sizeBytes: recordingBytes(committed - startedAt) });
    expect(item.tracks).toHaveLength(4);
    expect((item.markers ?? []).map((marker) => marker.label)).toEqual(['Key statement']);
    expect(item.custody.at(-1)).toMatchObject({ action: 'SESSION_INCOMPLETE', actorId: null });

    // A third restart: the INCOMPLETE entry and the RECORDED item are what the next process serves.
    const servedBefore = await served(second.server, supervisor);
    const third = await restart('after the recovery', target, second.server, 'EPOCH');
    expect(third.written).toEqual([]);
    expect(await served(third.server, supervisor)).toEqual(servedBefore);
    expect(await newestHistory(third.server, supervisor)).toEqual(entry);
    console.info(
      `[w53] RECORDING at the stop, recovery: recoverSession 202 RECOVERY: ${named(recoveryRows(supervisor))}; then ${named(actors(closed))}; ` +
        `history INCOMPLETE ${entry?.durationMs} ms ${entry?.sizeBytes} bytes; evidence ${entry?.evidenceId} RECORDED, never sealed, 4 tracks; epoch of the fourth process ${third.server.app.engine.epoch}`,
    );
    expect([flight.server, first.server, second.server, third.server].flatMap(errorLines)).toEqual([]);
  });

  it('AC-B-06: FINALIZING at the stop. FAULT at the last committed instant, the recording time and size as stopped; recoverSession, then a stop DURING the recovery: the next process completes it as INCOMPLETE, evidence RECORDED, never sealed', async () => {
    const flight = await armed('w53_finalizing');
    const { target, owner, investigator, supervisor, sessionId } = flight;
    const startedAt = await record(flight);
    expect(outcome(await webPost(flight.server.app, on(sessionId, 'stop'), investigator.cookie, { reason: 'Interview completed' }))).toEqual([202, null]);
    const stoppedRecordingAt = flight.server.clock.now();
    // Into the finalisation, one second deep: some steps done, the seal not reached.
    for (let tick = 0; tick < 400 && (await currentSession(flight.server, supervisor.cookie))?.state !== 'FINALIZING'; tick += 1) await flight.server.drive(TICK_MS);
    await flight.server.drive(SECOND);
    const finalizing = await currentSession(flight.server, supervisor.cookie);
    expect(finalizing).toMatchObject({ id: sessionId, state: 'FINALIZING', sealedAt: null, elapsedMs: stoppedRecordingAt - startedAt, bytesWritten: recordingBytes(stoppedRecordingAt - startedAt) });
    expect(await storedEvidence(owner, sessionId)).toEqual([]);

    const first = await restart('FINALIZING at the stop', target, flight.server, 'FAULT');
    const committed = first.rest.lastCommittedAt;
    expect(first.stoppedAt - committed).toBeGreaterThanOrEqual(0);
    expect(first.stoppedAt - committed).toBeLessThan(SECOND);
    expect(first.written.map((row) => [row.type, row.actorId, row.at])).toEqual([
      ['FAULT_RAISED', null, committed],
      ['TABLET_LINK_CHANGED', null, first.startedAt],
    ]);
    expect(first.written[0]).toMatchObject({ sessionId, severity: 'CRITICAL', details: { kind: 'POWER_FAIL', fromState: 'FINALIZING' } });

    // The session waits in FAULT; its recording is the one that was stopped, by time and by size.
    const faulted = await currentSession(first.server, supervisor.cookie);
    expect(faulted).toMatchObject({
      id: sessionId,
      state: 'FAULT',
      sealedAt: null,
      elapsedMs: stoppedRecordingAt - startedAt,
      bytesWritten: recordingBytes(stoppedRecordingAt - startedAt),
      fault: { kind: 'POWER_FAIL', fromState: 'FINALIZING' },
    });
    expect(Date.parse(faulted?.fault?.at ?? '')).toBe(committed);
    expect(Date.parse(faulted?.stoppedAt ?? '')).toBe(stoppedRecordingAt);
    // Nothing was sealed: no evidence item exists for the session.
    expect(await storedEvidence(owner, sessionId)).toEqual([]);

    // The recovery starts, and the process stops one second into its three.
    await recover(flight, first.server, supervisor);
    const completesAt = first.server.app.engine.slice('session')?.recovery?.completesAt ?? 0;
    expect(completesAt).toBe(first.server.clock.now() + 3 * SECOND);
    await first.server.drive(SECOND);
    expect((await currentSession(first.server, supervisor.cookie))?.state).toBe('RECOVERY');

    // A session in RECOVERY at the stop is no fault: the start writes nothing for it, and the
    // timed transition fires at its first tick.
    const second = await restart('RECOVERY at the stop', target, first.server, 'EPOCH');
    expect(second.written).toEqual([]);
    expect((await currentSession(second.server, supervisor.cookie))?.state).toBe('RECOVERY');
    const closed = await writtenBy(owner, () => second.server.drive(TICK_MS));
    expect(actors(closed)).toEqual(COMPLETION_ROWS);
    // Spec §8.6: it "fires at its scheduled time at the first tick": the rows carry the deadline.
    expect(closed.map((row) => row.at)).toEqual([completesAt, completesAt]);
    expect(await currentSession(second.server, supervisor.cookie)).toBeNull();

    const entry = await newestHistory(second.server, supervisor);
    expect(entry).toMatchObject({
      id: sessionId,
      outcome: 'INCOMPLETE',
      faultKind: 'POWER_FAIL',
      startedAt,
      endedAt: stoppedRecordingAt,
      durationMs: stoppedRecordingAt - startedAt,
      sizeBytes: recordingBytes(stoppedRecordingAt - startedAt),
    });
    expect(await storedEvidence(owner, sessionId)).toEqual([{ status: 'RECORDED', sealed_at: null }]);
    const detail = await get(second.server.app, `${EVIDENCE}/${entry?.evidenceId}`, supervisor.cookie);
    expectContract('getEvidence', detail);
    const item = (detail.json() as EvidenceDetail).evidence;
    expect(item).toMatchObject({ sessionId, status: 'RECORDED', sealedAt: null, durationMs: stoppedRecordingAt - startedAt, sizeBytes: recordingBytes(stoppedRecordingAt - startedAt) });
    expect(item.tracks).toHaveLength(4);
    expect(item.custody.at(-1)).toMatchObject({ action: 'SESSION_INCOMPLETE', actorId: null });

    const trail = await readTrail(owner);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true, checked: trail.length });
    console.info(
      `[w53] FINALIZING at the stop: recording ${rel(startedAt)} to ${rel(stoppedRecordingAt)}, stop at ${rel(first.stoppedAt)}, last committed instant ${rel(committed)}; after the start at ${rel(first.startedAt)}: FAULT at ${rel(committed)}, ` +
        `elapsedMs ${faulted?.elapsedMs}, ${faulted?.bytesWritten} bytes; recoverSession 202: ${named(recoveryRows(supervisor))}; stop in RECOVERY at ${rel(second.stoppedAt)}, start at ${rel(second.startedAt)}; ` +
        `first tick: ${closed.map(rowLine).join(', ')} (the deadline ${rel(completesAt)} lies inside the stop); history INCOMPLETE ${entry?.durationMs} ms; evidence ${entry?.evidenceId} RECORDED, never sealed`,
    );
    expect([flight.server, first.server, second.server].flatMap(errorLines)).toEqual([]);
  });

  it('spec §8.6: ARMED at the stop (no recording had started). FAULT, recoverSession, an INCOMPLETE entry and NO evidence item', async () => {
    const flight = await armed('w53_armed');
    const { target, owner, supervisor, sessionId } = flight;

    const first = await restart('ARMED at the stop', target, flight.server, 'FAULT');
    expect(first.written.map((row) => [row.type, row.actorId, row.at])).toEqual([
      ['FAULT_RAISED', null, first.rest.lastCommittedAt],
      ['TABLET_LINK_CHANGED', null, first.startedAt],
    ]);
    expect(first.written[0]).toMatchObject({ sessionId, details: { kind: 'POWER_FAIL', fromState: 'ARMED' } });
    expect(await currentSession(first.server, supervisor.cookie)).toMatchObject({ id: sessionId, state: 'FAULT', startedAt: null, elapsedMs: 0, bytesWritten: 0, fault: { fromState: 'ARMED' } });

    await recover(flight, first.server, supervisor);
    const closed = await writtenBy(owner, () => first.server.drive(RECOVERY_MS));
    expect(actors(closed)).toEqual(COMPLETION_ROWS);
    expect(await currentSession(first.server, supervisor.cookie)).toBeNull();

    const entry = await newestHistory(first.server, supervisor);
    expect(entry).toMatchObject({ id: sessionId, outcome: 'INCOMPLETE', faultKind: 'POWER_FAIL', startedAt: null, durationMs: 0, sizeBytes: 0, evidenceId: null });
    expect(await storedEvidence(owner, sessionId)).toEqual([]);
    const listed = (await get(first.server.app, `${EVIDENCE}?limit=200`, supervisor.cookie)).json() as EvidencePage;
    expect(listed.items.filter((item) => item.sessionId === sessionId)).toEqual([]);
    console.info(`[w53] ARMED at the stop: FAULT (from ARMED) at ${rel(first.rest.lastCommittedAt)}; recoverSession, then ${named(actors(closed))}; history INCOMPLETE, 0 ms, no evidence item`);
    expect([flight.server, first.server].flatMap(errorLines)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// The instrument
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('the comparison is not blind, and the server serves what PostgreSQL holds', () => {
  it('a row changed in the stopped database, as the owner role: its table is reported as moved, and the started server serves the changed row', async () => {
    const target = await db.another({ slug: 'w53_control' });
    const owner = target.ownerPool();
    const first = await startServer(target, FIXED_NOW);
    const supervisor = await signIn(first, 'SUPERVISOR');
    const before = ((await get(first.app, STORAGE_DETAIL, supervisor.cookie)).json() as StorageDetail).storagePolicy;
    await stopServer(first, owner);
    const atRest = await readTables(owner);

    await owner.query('UPDATE public.storage_policy SET retention_days = retention_days + 1');

    const second = await startServer(target, first.clock.now() + STOP_MS);
    expect(movedTables(atRest, await readTables(owner))).toEqual(['core_state', 'storage_policy']);
    const after = ((await get(second.app, STORAGE_DETAIL, supervisor.cookie)).json() as StorageDetail).storagePolicy;
    expect(after).toEqual({ ...before, retentionDays: before.retentionDays + 1 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A Core with a long history
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe('AC-B-04 on a Core with a long history (the bulk fixture): more audit rows than the engine holds in its ring', () => {
  it('two restarts with a command between them: every table stable twice, every read answers the same, the view and the stored chain verify, the next row links', async () => {
    const target = await db.another({ template: 'bulk', slug: 'w53_bulk' });
    const owner = target.ownerPool();
    // The first process start on the fixture (its stored link is CONNECTED, as a seed's).
    const first = await startServer(target, BULK_TEMPLATE_NOW);
    const supervisor = await signIn(first, 'SUPERVISOR');
    await first.drive(3_350);
    const stored = await restFacts(owner);
    expect(stored.auditSeq).toBeGreaterThan(AUDIT_RING_SIZE);

    const servedFirst = await served(first, supervisor);
    const one = await restart('long history, restart 1', target, first, 'EPOCH');
    expect(one.written).toEqual([]);
    expect(await served(one.server, supervisor)).toEqual(servedFirst);

    // A command of the rehydrated process: its row is the stored head plus 1, on the stored hash.
    const rows = await writtenBy(owner, async () => {
      expect((await webPost(one.server.app, STORAGE_POLICY, supervisor.cookie, { retentionDays: 123 })).statusCode).toBe(200);
    });
    expect(rows.map((row) => [row.type, row.actorId, row.seq, row.prevHash])).toEqual([['STORAGE_POLICY_CHANGED', supervisor.operator.id, stored.auditSeq + 1, one.lastRowBefore.hash]]);
    await one.server.drive(2_350);

    const servedSecond = await served(one.server, supervisor);
    const two = await restart('long history, restart 2', target, one.server, 'EPOCH');
    expect(two.written).toEqual([]);
    const after = await served(two.server, supervisor);
    expect(after).toEqual(servedSecond);
    expect(two.server.app.engine.epoch).toBe(first.app.engine.epoch + 2);

    // The view is the engine's ring, rebuilt from the newest rows; the stored chain is all of them.
    const chain = answerOf<AuditChainStatus>(after, 'verifyAuditChain');
    expect(chain.view).toMatchObject({ ok: true, checked: AUDIT_RING_SIZE, head: rows[0]?.hash });
    expect(chain.stored).toEqual({ ok: true, checked: stored.auditSeq + 1, head: rows[0]?.hash, firstBadSeq: null });
    expect(chain.lineageTotal).toBe(Number((await owner.query<{ n: string }>('SELECT count(*)::text AS n FROM public.audit_chain_history')).rows[0]?.n));
    expect(answerOf<StorageDetail>(after, 'getStorageDetail').storagePolicy.retentionDays).toBe(123);
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(two.server.app.engine.state()));
    console.info(
      `[w53] long history: ${stored.auditSeq + 1} audit rows stored, ${AUDIT_RING_SIZE} in the engine's view, ${chain.lineageTotal} discarded chains in the lineage; epochs ${first.app.engine.epoch} -> ${two.server.app.engine.epoch}; ` +
        `the command between the restarts wrote row ${rows[0]?.seq} on the hash of row ${one.lastRowBefore.seq}`,
    );
    expect([first, one.server, two.server].flatMap(errorLines)).toEqual([]);
  });
});
