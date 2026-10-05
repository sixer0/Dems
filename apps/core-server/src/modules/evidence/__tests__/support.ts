/**
 * Test support of the evidence module (plan row W35; not a test file). Nothing here imports
 * Vitest.
 *
 * `evidenceApp` is the real app factory on a clone, as `dems_app`, with EVERY stage as the
 * server has it (the Origin guard, `authenticate`, the throttle, the access rule), on a manual
 * clock, BOOTED as the entry point boots it: the engine runs, on a manual timer, so it ticks
 * only when a test fires it (decision D77, finding F60). No listener: every request is
 * `app.inject`. The one stand-in is behind the seam `deviceResolver` (the pairing module is
 * another row's), and what the app publishes is collected instead of sent.
 *
 * Operators are the seeded ones, signed in on the web console with the shared demo password
 * (imported by name by the identity row's support, never printed). A session cookie is handed
 * on as a header object; none is written to a log, a test name or a message of an assertion.
 *
 * The readers run as `dems_owner` and only SELECT.
 */
import { EVIDENCE_ID_PATTERN } from '@dems/shared/api';
import {
  OPERATORS,
  ROLE_PERMISSIONS,
  createManualClock,
  type AuditRow,
  type ControllableClock,
  type EvidenceItem,
  type OperatorRole,
  type SessionCreateInput,
  type SimOperator,
} from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../../../app';
import type { DatabaseConnection, LogLevel } from '../../../config';
import { readTrail } from '../../../../test/support/core';
import { engineControl, type EngineControl, type EngineHost } from '../../../engine';
import { FIXED_NOW, TICK_MS, countingPool, manualTimer, type CountingPool, type ManualTimer } from '../../../../test/support/engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { throttleControl } from '../../../plugins/throttle';
import type { Publication } from '../../../realtime';
import { identityControl } from '../../identity';
import { WEB_ORIGIN, cookieValue, deviceRegistryDouble, webSignIn, type DeviceRegistryDouble, type Headers } from '../../../../test/support/identity';

export { FIXED_NOW } from '../../../../test/support/engine';
export { WEB_ORIGIN, errorOf, type Headers } from '../../../../test/support/identity';

export const EVIDENCE = '/api/v1/evidence';
export const itemUrl = (id: string): string => `${EVIDENCE}/${id}`;
export const verifyUrl = (id: string): string => `${EVIDENCE}/${id}/verify`;
export const exportUrl = (id: string): string => `${EVIDENCE}/${id}/export`;
export const archiveUrl = (id: string): string => `${EVIDENCE}/${id}/archive`;

/** An ID of the right form that no template holds. */
export const UNKNOWN_EVIDENCE_ID = 'EV-20261001-9999';

export interface EvidenceAppTarget {
  /** Role `dems_app` on the clone. */
  readonly runtime: DatabaseConnection;
  onCleanup(close: () => Promise<unknown> | unknown): void;
}

export interface EvidenceAppOptions {
  /** Where the manual clock starts. Default: the fixed instant of the seed and of the bulk template. */
  readonly startAt?: number;
  readonly logLevel?: LogLevel;
  /** Called after `ready()` and before the boot: for a test that replaces a stage. */
  readonly beforeBoot?: (app: FastifyInstance) => void;
  /** Wraps the pool factory (the counting pool's): for a test that holds a statement back. */
  readonly wrapPool?: (factory: PoolFactory) => PoolFactory;
}

export type PoolFactory = (connection: DatabaseConnection) => Pool;

export interface EvidenceApp {
  readonly app: FastifyInstance;
  readonly engine: EngineHost & EngineControl;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ControllableClock;
  readonly timer: ManualTimer;
  readonly log: CapturedLog;
  /** The runtime pool, with every statement of every checked-out connection recorded. */
  readonly database: CountingPool;
  /** Everything handed to `app.publish`, in order. */
  readonly publications: Publication[];
  /** The device registry behind the seam `deviceResolver`: the pairing module is another row's. */
  readonly devices: DeviceRegistryDouble;
  /** Advances the clock, fires the timer after each step and waits for the tick's unit: the engine at real cadence. */
  drive(ms: number, stepMs?: number): Promise<void>;
  /** Signs a seeded operator of this role in on the web console; the header that carries the session. */
  signIn(role: OperatorRole): Promise<Headers>;
  /** The seeded operator of a role. */
  operator(role: OperatorRole): SimOperator;
  /** A GET as the web console sends it: the cookie, no `Origin`. */
  get(url: string, session?: Headers): Promise<LightMyRequestResponse>;
  /** A POST as the web console sends it: the cookie and the web console `Origin`. */
  post(url: string, session?: Headers, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse>;
  /** Fresh throttle windows, denial budgets and sign-in lockouts: for a test that is not about them. */
  forgetCounters(): void;
}

/**
 * The real app on a clone, ready and booted, with the engine running on a manual timer. It is
 * closed before the clone is dropped.
 */
export async function evidenceApp(target: EvidenceAppTarget, dataDir: string, options: EvidenceAppOptions = {}): Promise<EvidenceApp> {
  const log = captureLog();
  const database = countingPool();
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir, logLevel: options.logLevel ?? 'info' }),
    logStream: log.stream,
    createPool: options.wrapPool === undefined ? database.factory : options.wrapPool(database.factory),
  });
  target.onCleanup(() => app.close());
  await app.ready();
  const clock = createManualClock(options.startAt ?? FIXED_NOW);
  app.seams.replace('clock', clock);
  const devices = deviceRegistryDouble();
  app.seams.replace('deviceResolver', devices.resolver);
  const publications: Publication[] = [];
  app.seams.replace('publish', (publication) => void publications.push(publication));
  const engine = engineControl(app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);
  options.beforeBoot?.(app);
  await app.readiness.boot();
  await engine.idle();
  await app.pipeline.drain();

  const cookieName = app.config.sessionCookieName;
  const operator = (role: OperatorRole): SimOperator => {
    const found = OPERATORS.find((candidate) => candidate.role === role);
    if (found === undefined) throw new Error(`no seeded operator has the role ${role}`);
    return found;
  };

  return {
    app,
    engine,
    clock,
    timer,
    log,
    database,
    publications,
    devices,
    async drive(ms, stepMs = TICK_MS) {
      for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
        clock.advance(stepMs);
        timer.fire();
        await engine.idle();
      }
    },
    async signIn(role) {
      const response = await webSignIn(app, operator(role).username);
      const token = response.statusCode === 200 ? cookieValue(response, cookieName) : null;
      if (token === null) throw new Error(`the web sign-in of the ${role} answered ${response.statusCode}`);
      return { cookie: `${cookieName}=${token}` };
    },
    operator,
    get: (url, session = {}) => app.inject({ method: 'GET', url, headers: session }),
    post: (url, session = {}, payload) =>
      app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...session }, ...(payload === undefined ? {} : { payload }) }),
    forgetCounters() {
      throttleControl(app).reset();
      identityControl(app).lockout.reset();
    },
  };
}

export type OperatorPrincipal = Extract<Principal, { kind: 'OPERATOR' }>;

/**
 * A principal as stage 4 builds it for the seeded operator of a role: for a call of the engine
 * host itself (a demo fault, a session driven to its seal). `permissions` defaults to the role's.
 */
export function principalOf(role: OperatorRole, permissions: OperatorPrincipal['permissions'] = ROLE_PERMISSIONS[role]): OperatorPrincipal {
  const operator = OPERATORS.find((candidate) => candidate.role === role);
  if (operator === undefined) throw new Error(`no seeded operator has the role ${role}`);
  return { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'test-session', deviceId: null, role, permissions };
}

// ── Evidence made by the engine ────────────────────────────────────────────────────────────────

export const LIVE_SESSION: Omit<SessionCreateInput, 'investigatorId'> = {
  caseNumber: 'LP/2026/1001-0099',
  subjectType: 'SAKSI',
  subjectName: 'Test Subject',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

/**
 * Records one session from create to seal through hosted commands of the ENGINE HOST only (no
 * route of the sessions module is used: that module is another row's), and returns the evidence
 * item the seal produced. The summary is acknowledged, so the next call can create a session.
 */
export async function sealSession(host: EvidenceApp, input: Omit<SessionCreateInput, 'investigatorId'> = LIVE_SESSION, recordMs = 3_000): Promise<EvidenceItem> {
  const investigator = principalOf('INVESTIGATOR');
  await host.engine.setTabletLink('CONNECTED');
  const created = await host.engine.command(investigator, 'createSession', { ...input, investigatorId: investigator.operatorId });
  if (!created.value.ok || !created.value.created) throw new Error('the engine did not create the session');
  const sessionId = created.value.sessionId;
  await host.engine.command(investigator, 'beginPrecheck');
  await host.drive(5_000);
  if (host.engine.slice('session')?.state === 'PRECHECK') await host.engine.command(investigator, 'acknowledgePrecheckWarnings');
  await host.engine.command(investigator, 'startRecording');
  await host.drive(recordMs);
  await host.engine.command(investigator, 'stopRecording', 'Interview completed');
  await host.drive(20_000);
  const item = host.engine.slice('evidence').find((entry) => entry.sessionId === sessionId);
  if (item === undefined || item.status !== 'SEALED') throw new Error(`the session did not seal into evidence (session state ${String(host.engine.slice('session')?.state)})`);
  await host.engine.command(investigator, 'acknowledgeSummary', sessionId);
  await host.app.pipeline.drain();
  return item;
}

// ── The order of the list ──────────────────────────────────────────────────────────────────────

/** "Newest recording first": `recorded_at DESC, id DESC`, as the list orders. IDs compare by byte. */
export function inListOrder<Item extends Pick<EvidenceItem, 'recordedAt' | 'id'>>(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => b.recordedAt - a.recordedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

/** A value as it travels: what `JSON.stringify` keeps of it (`-0` is `0`, an absent member stays absent). */
export const onTheWire = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;

// ── What is stored, as `dems_owner` (SELECT only) ──────────────────────────────────────────────

export interface StoredDigest {
  /** SHA-256 over the rows below, in a fixed order, as PostgreSQL prints them. */
  readonly digest: string;
  /** How many rows went into it. */
  readonly rows: number;
}

/**
 * The SEALED content of an item as the tables hold it, digested by PostgreSQL itself:
 *
 *   - the item's row WITHOUT the seven columns the runtime role may update (`status`,
 *     `lifecycle_stage`, `verification_status`, `verification_at`, `tampered`,
 *     `tampered_track_id`, `updated_at`): what is left includes the manifest hash, the four
 *     signature columns, the recording instants, the size and the descriptive columns;
 *   - its four track rows whole: ID, position, label, size and SHA-256.
 *
 * Each row is taken as `to_jsonb(row)::text`, which prints every column with its name in the
 * order of the keys, so the digest changes when any byte of any of those columns changes.
 */
export async function sealedDigest(owner: Pick<Pool, 'query'>, evidenceId: string): Promise<StoredDigest> {
  const { rows } = await owner.query<{ digest: string; lines: string }>(
    `WITH sealed AS (
       SELECT 0 AS part, 0 AS place,
              (to_jsonb(i) - 'status' - 'lifecycle_stage' - 'verification_status' - 'verification_at' - 'tampered' - 'tampered_track_id' - 'updated_at')::text AS line
         FROM public.evidence_items AS i WHERE i.id = $1
       UNION ALL
       SELECT 1, t.position, to_jsonb(t)::text FROM public.evidence_tracks AS t WHERE t.evidence_id = $1
     )
     SELECT encode(sha256(convert_to(coalesce(string_agg(line, E'\\n' ORDER BY part, place), ''), 'UTF8')), 'hex') AS digest, count(*)::text AS lines FROM sealed`,
    [evidenceId],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('the digest statement returned no row');
  return { digest: row.digest, rows: Number(row.lines) };
}

/**
 * The same digest over EVERY item and EVERY track of the database: the sealed part of all item
 * rows in ID order, then all track rows by item and position. For "no other item was touched".
 */
export async function allSealedDigest(owner: Pick<Pool, 'query'>): Promise<StoredDigest> {
  const { rows } = await owner.query<{ digest: string; lines: string }>(
    `WITH sealed AS (
       SELECT 0 AS part, i.id AS item, 0 AS place,
              (to_jsonb(i) - 'status' - 'lifecycle_stage' - 'verification_status' - 'verification_at' - 'tampered' - 'tampered_track_id' - 'updated_at')::text AS line
         FROM public.evidence_items AS i
       UNION ALL
       SELECT 1, t.evidence_id, t.position, to_jsonb(t)::text FROM public.evidence_tracks AS t
     )
     SELECT encode(sha256(convert_to(coalesce(string_agg(line, E'\\n' ORDER BY part, item, place), ''), 'UTF8')), 'hex') AS digest, count(*)::text AS lines FROM sealed`,
  );
  const row = rows[0];
  if (row === undefined) throw new Error('the digest statement returned no row');
  return { digest: row.digest, rows: Number(row.lines) };
}

/**
 * The row VERSION of each track row of an item: the transaction that wrote it and its place in
 * the table. An UPDATE writes a new version even when it assigns the values a row already has,
 * so equal versions mean that no statement rewrote the row at all.
 */
export async function trackRowVersions(owner: Pick<Pool, 'query'>, evidenceId: string): Promise<string[]> {
  const { rows } = await owner.query<{ version: string }>(
    "SELECT track_id || ' xmin ' || xmin::text || ' ctid ' || ctid::text AS version FROM public.evidence_tracks WHERE evidence_id = $1 ORDER BY position",
    [evidenceId],
  );
  return rows.map((row) => row.version);
}

/** The sealed members of an item, read one by one: for an assertion that names what it compares. */
export interface SealedMembers {
  readonly manifestHash: string;
  readonly signature: { readonly value: string; readonly keyId: string; readonly algorithm: string; readonly simulated: boolean };
  readonly tracks: ReadonlyArray<{ readonly trackId: string; readonly position: number; readonly label: string; readonly sizeBytes: number; readonly sha256: string }>;
}

export async function sealedMembers(owner: Pick<Pool, 'query'>, evidenceId: string): Promise<SealedMembers> {
  const item = await owner.query<{ manifest_hash: string; signature_value: string; signature_key_id: string; signature_algorithm: string; signature_simulated: boolean }>(
    'SELECT manifest_hash, signature_value, signature_key_id, signature_algorithm, signature_simulated FROM public.evidence_items WHERE id = $1',
    [evidenceId],
  );
  const tracks = await owner.query<{ track_id: string; position: number; label: string; size_bytes: string; sha256: string }>(
    'SELECT track_id, position, label, size_bytes, sha256 FROM public.evidence_tracks WHERE evidence_id = $1 ORDER BY position',
    [evidenceId],
  );
  const row = item.rows[0];
  if (row === undefined) throw new Error('no such evidence item is stored');
  return {
    manifestHash: row.manifest_hash,
    signature: { value: row.signature_value, keyId: row.signature_key_id, algorithm: row.signature_algorithm, simulated: row.signature_simulated },
    tracks: tracks.rows.map((track) => ({ trackId: track.track_id, position: track.position, label: track.label, sizeBytes: Number(track.size_bytes), sha256: track.sha256 })),
  };
}

export interface StoredCustody {
  readonly seq: number;
  readonly at: number;
  readonly action: string;
  readonly actorId: string | null;
  readonly detail: string | null;
}

export async function storedCustody(owner: Pick<Pool, 'query'>, evidenceId: string): Promise<StoredCustody[]> {
  const { rows } = await owner.query<{ seq: number; at: string; action: string; actor_id: string | null; detail: string | null }>(
    'SELECT seq, at, action, actor_id, detail FROM public.evidence_custody WHERE evidence_id = $1 ORDER BY seq',
    [evidenceId],
  );
  return rows.map((row) => ({ seq: row.seq, at: Number(row.at), action: row.action, actorId: row.actor_id, detail: row.detail }));
}

export interface StoredState {
  readonly status: string;
  readonly lifecycleStage: string;
  readonly verificationStatus: string;
  readonly verificationAt: number | null;
  readonly tampered: boolean;
  readonly tamperedTrackId: string | null;
}

/** The six columns of an item that a command or a demo fault may change. */
export async function storedState(owner: Pick<Pool, 'query'>, evidenceId: string): Promise<StoredState> {
  const { rows } = await owner.query<{ status: string; lifecycle_stage: string; verification_status: string; verification_at: string | null; tampered: boolean; tampered_track_id: string | null }>(
    'SELECT status, lifecycle_stage, verification_status, verification_at, tampered, tampered_track_id FROM public.evidence_items WHERE id = $1',
    [evidenceId],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('no such evidence item is stored');
  return {
    status: row.status,
    lifecycleStage: row.lifecycle_stage,
    verificationStatus: row.verification_status,
    verificationAt: row.verification_at === null ? null : Number(row.verification_at),
    tampered: row.tampered,
    tamperedTrackId: row.tampered_track_id,
  };
}

/** The stored audit rows after position `from` of the trail (its length at an earlier moment). */
export async function trailSince(owner: Pick<Pool, 'query'>, from: number): Promise<AuditRow[]> {
  return (await readTrail(owner)).slice(from);
}

export async function trailLength(owner: Pick<Pool, 'query'>): Promise<number> {
  return (await readTrail(owner)).length;
}

export async function countOf(owner: Pick<Pool, 'query'>, table: 'evidence_items' | 'evidence_tracks' | 'evidence_custody' | 'exports' | 'events'): Promise<number> {
  // The table name is one of five constants of this file, never a value of a test.
  const { rows } = await owner.query<{ rows: string }>(`SELECT count(*)::text AS rows FROM public.${table}`);
  return Number(rows[0]?.rows);
}

/** True for a value of the form of an evidence ID. */
export const isEvidenceId = (value: string): boolean => EVIDENCE_ID_PATTERN.test(value);

// ── Answers ────────────────────────────────────────────────────────────────────────────────────

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
export function outcomeOf(response: LightMyRequestResponse): [number, string | null] {
  let code: string | null = null;
  try {
    code = (response.json() as { error?: { code?: string } }).error?.code ?? null;
  } catch {
    // No JSON body: a 204.
  }
  return [response.statusCode, code];
}

/** The track IDs of every track list in an answer, list by list: an item's `tracks`, a verdict's `tracks`. */
export function trackListsOf(body: unknown): string[][] {
  const lists: string[][] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, member] of Object.entries(value)) {
      if (key === 'tracks' && Array.isArray(member)) lists.push(member.map((track) => String((track as { trackId?: unknown }).trackId)));
      visit(member);
    }
  };
  visit(body);
  return lists;
}
