/**
 * Test support of the administration module (plan row W33; not a test file).
 *
 * Database tests (`*.db.test.ts`, project `db`): the real app factory on the file's own clone,
 * connected as `dems_app`, on a manual clock, with EVERY stage as the server has it (the Origin
 * guard, `authenticate`, the throttle, the access rule). The one stand-in is behind the seam
 * `deviceResolver`, whose owner is the pairing row. No listener: every request is `app.inject`.
 *
 * A BOOTED app has a running engine (decision D77): it gets the manual timer before the boot, so
 * the engine ticks only when a test fires it, and every count of rows is taken relative to the
 * trail after the boot (the first start on a fresh seed writes one `TABLET_LINK_CHANGED` row).
 *
 * Credentials. A test signs the seeded operators in with the shared constant
 * `DEMO_OPERATOR_PASSWORD`, through the helpers of the identity row; a cookie value or a token
 * is handed on and never written to a test name, a message of an assertion or the output (P19).
 */
import { OPERATORS, createManualClock, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { buildApp } from '../../../app';
import type { DatabaseConnection, ListenPort, LogLevel } from '../../../config';
import { engineControl } from '../../../engine';
import { manualTimer, type ManualTimer } from '../../../../test/support/engine';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { createRuntimePool, type PoolFactory } from '../../../plugins/db';
import { throttleControl } from '../../../plugins/throttle';
import type { Publication } from '../../../realtime';
import { identityControl } from '../../identity';
import {
  CLOCK_START,
  WEB_ORIGIN,
  bearer,
  cookieValue,
  deviceRegistryDouble,
  deviceSignIn,
  webSignIn,
  type DeviceRegistryDouble,
  type Headers,
} from '../../../../test/support/identity';

// The URLs of the administration operations are used by other rows too: they live in the
// neutral folder `test/support/admin.ts` (fix round B1, review finding CPB1-12) and are
// re-exported here, so that every existing import of this path keeps working.
export { USERS, disableUrl, enableUrl, roleUrl } from '../../../../test/support/admin';

/** The three seeded operators: `OPR-001` INVESTIGATOR, `OPR-002` SUPERVISOR, `OPR-003` TECHNICIAN. */
export const INVESTIGATOR = OPERATORS[0]!;
export const SUPERVISOR = OPERATORS[1]!;
export const TECHNICIAN = OPERATORS[2]!;

export interface AdminTarget {
  /** Role `dems_app` on the clone. */
  readonly runtime: DatabaseConnection;
  readonly run: { readonly dataDir: string };
  onCleanup(close: () => Promise<unknown> | unknown): void;
}

export interface AdminAppOptions {
  /** 4420 (the main instance) unless a test wants a second instance beside it. */
  readonly port?: ListenPort;
  readonly logLevel?: LogLevel;
  /** Replaces the pool factory, for a test that records the statements. Default: the runtime pool. */
  readonly createPool?: PoolFactory;
  /**
   * True (the default): booted as the entry point boots it, with the engine on a manual timer.
   * False: ready, with the readiness flag of the engine set by hand; the engine does not run, so
   * `app.engine.mirrorOperators()` refuses.
   */
  readonly boot?: boolean;
  /** Where the manual clock starts. Default: 2031-01-01, later than every template's rows. */
  readonly startAt?: number;
}

export interface AdminApp {
  readonly app: FastifyInstance;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ReturnType<typeof createManualClock>;
  readonly log: CapturedLog;
  /** `dems_session_<listen port>`. */
  readonly cookieName: string;
  /** The device registry behind the seam `deviceResolver`. */
  readonly devices: DeviceRegistryDouble;
  /** Everything handed to `app.publish` since the app was built, in order. */
  readonly published: Publication[];
  /** The engine's timer: nothing ticks unless a test fires it. */
  readonly timer: ManualTimer;
}

/** The real app on a clone, as `dems_app`, with every stage unreplaced. Closed before the clone is dropped. */
export async function adminApp(target: AdminTarget, options: AdminAppOptions = {}): Promise<AdminApp> {
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({
      database: target.runtime,
      dataDir: target.run.dataDir,
      logLevel: options.logLevel ?? 'info',
      port: options.port ?? 4420,
    }),
    logStream: log.stream,
    ...(options.createPool === undefined ? {} : { createPool: options.createPool }),
  });
  target.onCleanup(() => app.close());
  const clock = createManualClock(options.startAt ?? CLOCK_START);
  app.seams.replace('clock', clock);
  const devices = deviceRegistryDouble();
  app.seams.replace('deviceResolver', devices.resolver);
  const published: Publication[] = [];
  app.seams.replace('publish', (publication) => void published.push(publication));
  await app.ready();
  const timer = manualTimer();
  if (options.boot ?? true) {
    engineControl(app).useTimer(timer.timer);
    await app.readiness.boot();
    await engineControl(app).idle();
    await app.pipeline.drain();
  } else {
    if (!(await app.db.probe({ fresh: true }))) throw new Error('the clone does not answer as dems_app');
    app.readiness.set('engine', true);
  }
  return { app, clock, log, cookieName: app.config.sessionCookieName, devices, published, timer };
}

/** Starts the console lockout, every throttle window and every denial budget afresh. */
export function forgetCounters(admin: AdminApp): void {
  identityControl(admin.app).lockout.reset();
  throttleControl(admin.app).reset();
}

// ── Sessions and requests ──────────────────────────────────────────────────────────────────────

/** Signs an operator in on the web console and returns the header that carries the session: the cookie. */
export async function signInWeb(admin: AdminApp, username: string): Promise<Headers> {
  const response = await webSignIn(admin.app, username);
  const token = response.statusCode === 200 ? cookieValue(response, admin.cookieName) : null;
  if (token === null) throw new Error(`the web sign-in of the test operator answered ${response.statusCode}`);
  return { cookie: `${admin.cookieName}=${token}` };
}

/** Signs an operator in on a paired device and returns the header that carries the session: the bearer value. */
export async function signInDevice(admin: AdminApp, deviceCredential: string, username: string): Promise<Headers> {
  const response = await deviceSignIn(admin.app, deviceCredential, username);
  const token = response.statusCode === 200 ? (response.json() as { sessionToken?: string }).sessionToken : undefined;
  if (token === undefined) throw new Error(`the device sign-in of the test operator answered ${response.statusCode}`);
  return bearer(token);
}

/** A request of the web console: the cookie, and for a command the web console `Origin`. */
export function web(
  app: FastifyInstance,
  session: Headers,
  method: 'GET' | 'POST',
  url: string,
  payload?: InjectOptions['payload'],
): Promise<LightMyRequestResponse> {
  return app.inject({ method, url, headers: method === 'POST' ? { ...session, origin: WEB_ORIGIN } : session, ...(payload === undefined ? {} : { payload }) });
}

/** `[status, error code]` of an answer; the code is null for an answer that is no error envelope. */
export function outcome(response: LightMyRequestResponse): [number, string | null] {
  let code: string | null = null;
  try {
    code = (response.json() as { error?: { code?: string } }).error?.code ?? null;
  } catch {
    // No JSON body.
  }
  return [response.statusCode, code];
}

// ── The stored operators, as `dems_owner` (fixtures and assertions only) ────────────────────────

export interface StoredOperator {
  readonly id: string;
  readonly role: OperatorRole;
  readonly enabled: boolean;
  readonly lastSignInAt: number | null;
  readonly roleChangedAt: number | null;
  readonly updatedAt: number;
}

/** Every operator row, in ID order, with the columns this module may change. */
export async function storedOperators(owner: Pick<Pool, 'query'>): Promise<StoredOperator[]> {
  const { rows } = await owner.query<{
    id: string;
    role_id: OperatorRole;
    enabled: boolean;
    last_sign_in_at: string | null;
    role_changed_at: string | null;
    updated_at: string;
  }>('SELECT id, role_id, enabled, last_sign_in_at, role_changed_at, updated_at FROM public.operators ORDER BY id');
  return rows.map((row) => ({
    id: row.id,
    role: row.role_id,
    enabled: row.enabled,
    lastSignInAt: row.last_sign_in_at === null ? null : Number(row.last_sign_in_at),
    roleChangedAt: row.role_changed_at === null ? null : Number(row.role_changed_at),
    updatedAt: Number(row.updated_at),
  }));
}

export async function storedOperator(owner: Pick<Pool, 'query'>, operatorId: string): Promise<StoredOperator> {
  const found = (await storedOperators(owner)).find((operator) => operator.id === operatorId);
  if (found === undefined) throw new Error(`no operator ${operatorId}`);
  return found;
}

/** A fixture: puts an operator into a state directly, as `dems_owner`, behind the server's back. */
export async function putOperator(owner: Pick<Pool, 'query'>, operatorId: string, state: { role: OperatorRole; enabled: boolean }): Promise<void> {
  await owner.query('UPDATE public.operators SET role_id = $2, enabled = $3 WHERE id = $1', [operatorId, state.role, state.enabled]);
}

/** The enabled operators whose role holds `USER_ADMIN`, read from the tables with one statement. */
export async function storedAdministrators(owner: Pick<Pool, 'query'>): Promise<string[]> {
  const { rows } = await owner.query<{ id: string }>(
    "SELECT o.id FROM public.operators o WHERE o.enabled AND o.role_id IN (SELECT role_id FROM public.role_permissions WHERE permission_id = 'USER_ADMIN') ORDER BY o.id",
  );
  return rows.map((row) => row.id);
}

// ── Publications, as one line each ─────────────────────────────────────────────────────────────

/**
 * What was handed to `app.publish`, one text per publication, in order: the kind, and for a
 * state change its cause and its operations. Meter frames are left out. No value of a session or
 * of a token is part of a publication, so none can be part of a line.
 */
export function publicationLines(published: readonly Publication[]): string[] {
  const lines: string[] = [];
  for (const publication of published) {
    switch (publication.kind) {
      case 'meters':
        break;
      case 'state': {
        const ops = publication.change.ops.map((op) => (op.op === 'append' ? `append ${op.slice}[${op.rows.map((row) => row.type).join(',')}]` : `replace ${op.slice}`));
        lines.push(`state ${publication.change.cause} r${publication.change.revision}: ${ops.join('; ')}`);
        break;
      }
      case 'session.updated':
        lines.push(`session.updated ${publication.operatorId} ${publication.role} [${publication.permissions.length} permissions]`);
        break;
      case 'session.ended':
        lines.push(`session.ended ${publication.reason} [${publication.sessionIds.length} sessions]`);
        break;
      case 'device.revoked':
        lines.push(`device.revoked ${publication.deviceId} ${publication.reason}`);
        break;
      case 'admin.changed':
        lines.push(`admin.changed ${publication.resource}`);
        break;
    }
  }
  return lines;
}

// ── The statements a request sends, in order ───────────────────────────────────────────────────

/**
 * The runtime pool, recording: every statement the app asks for is put on `timeline` with the
 * name `nameOf` gives it, `pool  …` for one on the pool and `unit  …` for one on a unit's
 * connection. A unit's connection is handed out behind a proxy, so the pooled client itself is
 * not changed. Pass as `adminApp(target, { createPool: recordingPool(timeline, nameOf) })`.
 */
export function recordingPool(timeline: string[], nameOf: (text: string, values: readonly unknown[]) => string): PoolFactory {
  const named = (query: unknown, values: unknown): string => {
    const text = typeof query === 'string' ? query : (query as { text: string }).text;
    const parameters = (Array.isArray(values) ? values : ((query as { values?: unknown[] }).values ?? [])) as unknown[];
    return nameOf(text, parameters);
  };
  return (connection) => {
    const pool = createRuntimePool(connection);
    const query = pool.query.bind(pool) as (...args: unknown[]) => unknown;
    const connect = pool.connect.bind(pool) as (...args: unknown[]) => unknown;
    Object.assign(pool, {
      query(text: unknown, values?: unknown) {
        timeline.push(`pool  ${named(text, values)}`);
        return query(text, values);
      },
      connect(...args: unknown[]) {
        // The pool's own `query` connects with a callback: that statement is recorded above.
        if (args.length > 0) return connect(...args);
        return (connect() as Promise<PoolClient>).then(
          (client) =>
            new Proxy(client, {
              get(target, property) {
                if (property === 'query') {
                  return (text: unknown, values?: unknown) => {
                    timeline.push(`unit  ${named(text, values)}`);
                    return (target.query as (...inner: unknown[]) => unknown)(text, values);
                  };
                }
                const member = Reflect.get(target, property) as unknown;
                return typeof member === 'function' ? (member as (...inner: unknown[]) => unknown).bind(target) : member;
              },
            }),
        );
      },
    });
    return pool;
  };
}
