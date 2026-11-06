/**
 * Test support of the security-audit module (plan row W39; not a test file). Nothing here
 * imports Vitest.
 *
 * `auditApp` is the real app factory on a clone, as `dems_app`, with EVERY stage as the server
 * has it (the Origin guard, `authenticate`, the throttle, the access rule), on a manual clock,
 * BOOTED as the entry point boots it: the engine runs, on a manual timer, so it ticks only when
 * a test fires it (decision D77, finding F60). No listener: every request is `app.inject`. What
 * the app publishes is collected instead of sent.
 *
 * THE QUERY SPY. The pool is the runtime pool behind a proxy that records every statement of
 * every connection and of the pool itself, with the number of rows it returned. So a test can
 * say how many audit rows a call read. A statement can also be held back until the test lets
 * it go, to make two calls overlap.
 *
 * Operators are the seeded ones, signed in on the web console with the shared demo password
 * (imported by name by the identity row's support, never printed). A session cookie is handed
 * on as a header object; none is written to a log, a test name or a message of an assertion.
 *
 * The readers run as `dems_owner` and only SELECT.
 */
import {
  BIOMETRIC_TOKEN_PATTERN,
  DEVICE_CREDENTIAL_PATTERN,
  PAIRING_QR_PAYLOAD_PATTERN,
  SESSION_TOKEN_PATTERN,
  type AuditPage,
  type EventPage,
} from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ROLE_PERMISSIONS, createManualClock, type AuditRow, type ControllableClock, type OperatorRole, type SimOperator } from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Pool, PoolClient, QueryConfig } from 'pg';
import { buildApp } from '../../../app';
import type { DatabaseConnection, LogLevel } from '../../../config';
import { looksLikeSecret } from '../../../core';
import { AUDIT_DETAIL_FORBIDDEN_KEYS } from '../../../db/schema';
import { engineControl, type EngineControl, type EngineHost } from '../../../engine';
import { FIXED_NOW, TICK_MS, manualTimer, type ManualTimer } from '../../../../test/support/engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { createRuntimePool } from '../../../plugins/db';
import { throttleControl } from '../../../plugins/throttle';
import type { Publication } from '../../../realtime';
import { identityControl } from '../../identity';
import { WEB_ORIGIN, cookieValue, webSignIn, type Headers } from '../../../../test/support/identity';
import { securityAuditControl, type StoredChainStats } from '../index';

export { FIXED_NOW } from '../../../../test/support/engine';
export { WEB_ORIGIN, errorOf, type Headers } from '../../../../test/support/identity';

export const SECURITY_STATUS = '/api/v1/security/status';
export const AUDIT = '/api/v1/audit';
export const AUDIT_CHAIN = '/api/v1/audit/chain';
export const AUDIT_EXPORT = '/api/v1/audit/export';
export const LOGS_EXPORT = '/api/v1/logs/export';
export const EVENTS = '/api/v1/events';

// ── The query spy ──────────────────────────────────────────────────────────────────────────────

export interface SentStatement {
  readonly text: string;
  /** Rows the statement returned. */
  readonly rows: number;
}

export interface Hold {
  /** Resolves when a matching statement has arrived and waits. */
  reached(): Promise<void>;
  release(): void;
}

export interface SpyingPool {
  /** Pass as `buildApp({ createPool: spy.factory })`. A new real pool at every call (a reopen after a reset). */
  readonly factory: (connection: DatabaseConnection) => Pool;
  /** Every statement that was answered, in the order of the answers, over every pool and connection. */
  readonly statements: SentStatement[];
  /** The next statement whose text matches is sent only after `release()`. */
  hold(pattern: RegExp): Hold;
}

const textOf = (query: string | QueryConfig): string => (typeof query === 'string' ? query : query.text);

export function spyingPool(): SpyingPool {
  const statements: SentStatement[] = [];
  const holds: Array<{ pattern: RegExp; gate: Promise<void>; arrived: () => void }> = [];

  type Send = (query: string | QueryConfig, values?: unknown[]) => Promise<{ rowCount: number | null; rows?: unknown[] }>;

  function spied(send: Send): Send {
    return async (query, values) => {
      const text = textOf(query);
      const held = holds.findIndex((entry) => entry.pattern.test(text));
      if (held >= 0) {
        const [entry] = holds.splice(held, 1);
        entry?.arrived();
        await entry?.gate;
      }
      const result = await (values === undefined ? send(query) : send(query, values));
      statements.push({ text, rows: result.rowCount ?? result.rows?.length ?? 0 });
      return result;
    };
  }

  function wrapClient(client: PoolClient): PoolClient {
    return new Proxy(client, {
      get(target, property, receiver) {
        if (property === 'query') return spied(target.query.bind(target) as unknown as Send);
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });
  }

  function factory(connection: DatabaseConnection): Pool {
    return new Proxy(createRuntimePool(connection), {
      get(target, property, receiver) {
        if (property === 'connect') return async () => wrapClient(await target.connect());
        if (property === 'query') return spied(target.query.bind(target) as unknown as Send);
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });
  }

  return {
    factory,
    statements,
    hold(pattern) {
      let release = (): void => {};
      let arrived = (): void => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const reached = new Promise<void>((resolve) => {
        arrived = resolve;
      });
      holds.push({ pattern, gate, arrived });
      return { release, reached: () => reached };
    },
  };
}

/** The statement of the ONE stored-chain check that reads audit rows (`checkStoredChain`). */
export const CHAIN_READ = /FROM \(SELECT \* FROM audit_log ORDER BY seq DESC LIMIT \$1\)/;
/** Any statement that names the audit table. */
export const NAMES_AUDIT_LOG = /\baudit_log\b/;

/** How many audit rows each chain read since position `from` of the statement list returned. */
export function chainReads(statements: readonly SentStatement[], from = 0): number[] {
  return statements
    .slice(from)
    .filter((entry) => CHAIN_READ.test(entry.text))
    .map((entry) => entry.rows);
}

// ── The app ────────────────────────────────────────────────────────────────────────────────────

export interface AuditAppTarget {
  /** Role `dems_app` on the clone. */
  readonly runtime: DatabaseConnection;
  onCleanup(close: () => Promise<unknown> | unknown): void;
}

export interface AuditAppOptions {
  /** Where the manual clock starts. Default: the fixed instant of the seed and of the bulk template. */
  readonly startAt?: number;
  readonly logLevel?: LogLevel;
}

export type OperatorPrincipal = Extract<Principal, { kind: 'OPERATOR' }>;

export interface AuditApp {
  readonly app: FastifyInstance;
  readonly engine: EngineHost & EngineControl;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ControllableClock;
  readonly timer: ManualTimer;
  readonly log: CapturedLog;
  /** The runtime pool, with every statement recorded. */
  readonly database: SpyingPool;
  /** Everything handed to `app.publish`, in order. */
  readonly publications: Publication[];
  /** Advances the clock, fires the timer after each step and waits for the tick's unit. */
  drive(ms: number, stepMs?: number): Promise<void>;
  /** Signs a seeded operator of this role in on the web console; the header that carries the session. */
  signIn(role: OperatorRole): Promise<Headers>;
  operator(role: OperatorRole): SimOperator;
  /** A principal as stage 4 builds it for the seeded operator of a role: for a call of the engine host itself. */
  principal(role: OperatorRole): OperatorPrincipal;
  /** A GET as the web console sends it: the cookie, no `Origin`. */
  get(url: string, session?: Headers): Promise<LightMyRequestResponse>;
  /** A POST as the web console sends it: the cookie and the web console `Origin`. */
  post(url: string, session?: Headers, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse>;
  /** Fresh throttle windows, denial budgets and sign-in lockouts: for a test that is not about them. */
  forgetCounters(): void;
  /** Appends `count` audit rows in ONE server-native unit of work, through the core's audit writer. */
  appendRows(count: number, label?: string): Promise<AuditRow[]>;
  /** The counters of the module's stored-chain check. */
  chainStats(): StoredChainStats;
}

/** The real app on a clone, ready and booted, with the engine running on a manual timer. It is closed before the clone is dropped. */
export async function auditApp(target: AuditAppTarget, dataDir: string, options: AuditAppOptions = {}): Promise<AuditApp> {
  const log = captureLog();
  const database = spyingPool();
  const app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir, logLevel: options.logLevel ?? 'info' }),
    logStream: log.stream,
    createPool: database.factory,
  });
  target.onCleanup(() => app.close());
  await app.ready();
  const clock = createManualClock(options.startAt ?? FIXED_NOW);
  app.seams.replace('clock', clock);
  const publications: Publication[] = [];
  app.seams.replace('publish', (publication) => void publications.push(publication));
  const engine = engineControl(app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);
  await app.readiness.boot();
  await engine.idle();
  await app.pipeline.drain();

  const cookieName = app.config.sessionCookieName;
  const operator = (role: OperatorRole): SimOperator => {
    const found = OPERATORS.find((candidate) => candidate.role === role);
    if (found === undefined) throw new Error(`no seeded operator has the role ${role}`);
    return found;
  };
  let appended = 0;

  return {
    app,
    engine,
    clock,
    timer,
    log,
    database,
    publications,
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
    principal: (role) => ({ kind: 'OPERATOR', operatorId: operator(role).id, sessionId: 'test-session', deviceId: null, role, permissions: ROLE_PERMISSIONS[role] }),
    get: (url, session = {}) => app.inject({ method: 'GET', url, headers: session }),
    post: (url, session = {}, payload) =>
      app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...session }, ...(payload === undefined ? {} : { payload }) }),
    forgetCounters() {
      throttleControl(app).reset();
      identityControl(app).lockout.reset();
    },
    async appendRows(count, label = 'securityAudit.testAppend') {
      const rows = await app.pipeline.run(label, (unit) =>
        unit.audit.appendMany(
          Array.from({ length: count }, () => {
            appended += 1;
            return { type: 'MARKER_ADDED' as const, actorId: null, deviceId: null, message: `Test marker ${appended}`, details: { index: appended } };
          }),
        ),
      );
      await engine.idle();
      return rows;
    },
    chainStats: () => securityAuditControl(app).storedChainStats(),
  };
}

// ── What is stored, as `dems_owner` (SELECT only) ──────────────────────────────────────────────

export async function storedHead(owner: Pick<Pool, 'query'>): Promise<{ seq: number; hash: string }> {
  const { rows } = await owner.query<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_head');
  const row = rows[0];
  if (row === undefined) throw new Error('audit_chain_head has no row');
  return { seq: Number(row.seq), hash: row.hash };
}

export async function countOf(owner: Pick<Pool, 'query'>, table: 'audit_log' | 'events' | 'exports' | 'audit_chain_history', where = 'TRUE', values: readonly unknown[] = []): Promise<number> {
  // The table name is one of four constants and `where` a constant of a test file, never a value of a request.
  const { rows } = await owner.query<{ rows: string }>(`SELECT count(*)::text AS rows FROM public.${table} WHERE ${where}`, [...values]);
  return Number(rows[0]?.rows);
}

// ── Answers ────────────────────────────────────────────────────────────────────────────────────

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
export function outcomeOf(response: LightMyRequestResponse): [number, string | null] {
  let code: string | null = null;
  try {
    code = (response.json() as { error?: { code?: string } }).error?.code ?? null;
  } catch {
    // No JSON body.
  }
  return [response.statusCode, code];
}

/** A value as it travels: what `JSON.stringify` keeps of it (`-0` is `0`, an absent member stays absent). */
export const onTheWire = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;

export type Walk<Page> = { readonly pages: Page[] };

/** Walks the audit list from its first page to the page without a cursor. `between` runs after each page that has a successor. */
export async function walkAudit(host: AuditApp, session: Headers, query: string, between?: (page: AuditPage, index: number) => Promise<void>): Promise<AuditPage[]> {
  const pages: AuditPage[] = [];
  let cursor: string | null = null;
  do {
    host.forgetCounters();
    const separator: string = query === '' ? '?' : '&';
    const response: LightMyRequestResponse = await host.get(`${AUDIT}${cursor === null ? query : `${query}${separator}cursor=${cursor}`}`, session);
    if (response.statusCode !== 200) throw new Error(`page ${pages.length + 1} of the audit list answered ${response.statusCode}`);
    const page = response.json() as AuditPage;
    pages.push(page);
    cursor = page.nextCursor;
    if (cursor !== null) await between?.(page, pages.length - 1);
    if (pages.length > 1_000) throw new Error('the walk does not end');
  } while (cursor !== null);
  return pages;
}

export async function walkEvents(host: AuditApp, session: Headers, query: string): Promise<EventPage[]> {
  const pages: EventPage[] = [];
  let cursor: string | null = null;
  do {
    host.forgetCounters();
    const separator: string = query === '' ? '?' : '&';
    const response: LightMyRequestResponse = await host.get(`${EVENTS}${cursor === null ? query : `${query}${separator}cursor=${cursor}`}`, session);
    if (response.statusCode !== 200) throw new Error(`page ${pages.length + 1} of the events answered ${response.statusCode}`);
    const page = response.json() as EventPage;
    pages.push(page);
    cursor = page.nextCursor;
    if (pages.length > 1_000) throw new Error('the walk does not end');
  } while (cursor !== null);
  return pages;
}

// ── The secret scan ────────────────────────────────────────────────────────────────────────────

/** The same form without its anchors, so that it is found inside a longer text too. */
const anywhere = (anchored: RegExp): RegExp => new RegExp(anchored.source.replace(/^\^/, '').replace(/\$$/, ''), 'g');

const SECRET_SHAPES: ReadonlyArray<readonly [name: string, form: RegExp]> = [
  ['a session token', anywhere(SESSION_TOKEN_PATTERN)],
  ['a device credential', anywhere(DEVICE_CREDENTIAL_PATTERN)],
  ['a biometric token', anywhere(BIOMETRIC_TOKEN_PATTERN)],
  ['a pairing QR payload', anywhere(PAIRING_QR_PAYLOAD_PATTERN)],
  // A password hash in the PHC string format, whatever the function.
  ['a password hash', /\$(?:argon2(?:id|i|d)|scrypt|pbkdf2[a-z0-9-]*|2[aby])\$[^\s"]+/g],
  // 32 random bytes as base64url, with or without a prefix: the body of every bearer secret.
  ['43 characters of base64url', /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g],
];

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(AUDIT_DETAIL_FORBIDDEN_KEYS.map((key) => key.toLowerCase()));

export interface SecretFinding {
  /** Where in the answer: a path of member names and indexes. */
  readonly at: string;
  /** What kind of thing was found. Never the value. */
  readonly what: string;
}

/**
 * Scans a JSON value for anything secret-shaped: a text in one of the forms above, the shared
 * demo password, or a key of the audit writer's forbidden list under `details` or `params`.
 * A finding names the place and the kind, never the value.
 */
export function secretFindings(value: unknown, at = '$'): SecretFinding[] {
  const found: SecretFinding[] = [];
  const visit = (node: unknown, path: string, inPayload: boolean): void => {
    if (typeof node === 'string') {
      for (const [name, form] of SECRET_SHAPES) {
        form.lastIndex = 0;
        if (form.test(node)) found.push({ at: path, what: name });
      }
      if (looksLikeSecret(node)) found.push({ at: path, what: 'a credential form of the contract' });
      if (node.includes(DEMO_OPERATOR_PASSWORD)) found.push({ at: path, what: 'the demo password' });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${path}[${index}]`, inPayload));
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, member] of Object.entries(node)) {
      if (inPayload && FORBIDDEN_KEYS.has(key.toLowerCase())) found.push({ at: `${path}.${key}`, what: 'a forbidden payload key' });
      visit(member, `${path}.${key}`, inPayload || key === 'details' || key === 'params');
    }
  };
  visit(value, at, false);
  return found;
}
