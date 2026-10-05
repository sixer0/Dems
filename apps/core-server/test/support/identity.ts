/**
 * Test support of the identity core (plan row W24; not a test file). Other rows import it: a
 * signed-in operator of each role, on the web console or on a device, comes from here.
 *
 * NEUTRAL TEST SUPPORT (fix round B1, review finding CPB1-12). This file lives in
 * `apps/core-server/test/support/` because tests of several rows use it; it moved here from
 * `src/modules/identity/__tests__/support.ts`, which re-exports it for one round. No production source imports
 * anything under `test/` (static test `test/static/imports.test.ts`).
 *
 * Database tests (`*.db.test.ts`, project `db`): the real app factory on the file's own clone of
 * the seed template, connected as `dems_app`, on a manual clock, with the REAL stages 3, 4 and 5
 * (the Origin guard, `authenticate`, the throttle). No listener: every request is `app.inject`.
 *
 * Credentials. A test signs the seeded operators in with the shared constant
 * `DEMO_OPERATOR_PASSWORD`, imported by name and never printed. A session token and a cookie
 * value are taken from an answer and handed on; none is ever written to a log, a test name, a
 * snapshot or a message of an assertion (P19). `expectAbsent` reports a count, never the value.
 */
import { createHash, randomBytes } from 'node:crypto';
import { DEMO_OPERATOR_PASSWORD, createManualClock } from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { expect, vi, type Mock } from 'vitest';
import { buildApp } from '../../src/app';
import type { DatabaseConnection, ListenPort, LogLevel } from '../../src/config';
import { captureLog, unitTestConfig, type CapturedLog } from './config';
import { passScratchRoutes } from './scratch-routes';
import type { PoolFactory } from '../../src/plugins/db';
import { throttleControl } from '../../src/plugins/throttle';
import { readDeviceState, type DeviceResolver, type ResolvedDevice } from '../../src/modules/pairing';
import { identityControl, type IdentityControl } from '../../src/modules/identity';
import { createPasswordHasher, deriveArgon2id, type Argon2idDerive } from '../../src/modules/identity/password-hash';

/** The main instance's web console origin, its own origin, and an origin in neither list. */
export const WEB_ORIGIN = 'http://127.0.0.1:5173';
export const OWN_ORIGIN = 'http://127.0.0.1:4420';
export const FOREIGN_ORIGIN = 'http://evil.example';

/** A start for the manual clock that no wall clock of this decade can give: 2031-01-01T00:00:00Z. */
export const CLOCK_START = Date.UTC(2031, 0, 1);
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export const AUTH = '/api/v1/auth';
export const SIGN_IN = `${AUTH}/sign-in`;
export const STATUS = `${AUTH}/status`;
export const SESSION = `${AUTH}/session`;
export const SIGN_OUT = `${AUTH}/sign-out`;
export const TOUCH = `${AUTH}/touch`;

export type ManualClock = ReturnType<typeof createManualClock>;

export interface IdentityTarget {
  /** Role `dems_app` on the clone. */
  readonly runtime: DatabaseConnection;
  readonly run: { readonly dataDir: string };
  onCleanup(close: () => Promise<unknown> | unknown): void;
}

export interface IdentityAppOptions {
  /** 4420 (the main instance) unless a test wants a lane instance beside it. */
  readonly port?: ListenPort;
  readonly logLevel?: LogLevel;
  /** Scratch routes, added before `ready()`. */
  readonly routes?: (app: FastifyInstance) => void;
  /** Replaces the pool factory, for a test that records the statements. Default: the runtime pool. */
  readonly createPool?: PoolFactory;
}

export interface IdentityApp {
  readonly app: FastifyInstance;
  /** The server clock of this app: it moves only when the test moves it (ENG-16). */
  readonly clock: ManualClock;
  readonly log: CapturedLog;
  readonly control: IdentityControl;
  /** `dems_session_<listen port>`. */
  readonly cookieName: string;
  /** Counts the Argon2id derivations of this app's sign-ins: the built-in, called through a spy. */
  readonly derive: Mock<Argon2idDerive>;
}

/**
 * The real app factory on a clone, as `dems_app`, ready, on a manual clock, with a counted
 * password hasher. It is closed before the clone is dropped.
 */
export async function identityApp(target: IdentityTarget, options: IdentityAppOptions = {}): Promise<IdentityApp> {
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
  options.routes?.(app);
  await app.ready();
  // By-design change (plan row W28): a test's scratch routes pass stage 6; operations 2 to 6 keep the real guard.
  if (options.routes !== undefined) passScratchRoutes(app);
  const clock = createManualClock(CLOCK_START);
  app.seams.replace('clock', clock);
  if (!(await app.db.probe({ fresh: true }))) throw new Error('the clone does not answer as dems_app');
  // The engine is not booted here: these tests are about identity, and a booted engine ticks.
  app.readiness.set('engine', true);
  const control = identityControl(app);
  const derive = vi.fn(deriveArgon2id);
  control.hasher = createPasswordHasher({ derive });
  return { app, clock, log, control, cookieName: app.config.sessionCookieName, derive };
}

/** Starts every console, throttle window and denial budget afresh: a test that is not about them. */
export function forgetCounters(identity: IdentityApp): void {
  identity.control.lockout.reset();
  throttleControl(identity.app).reset();
}

// ── Requests ───────────────────────────────────────────────────────────────────────────────────

export type Headers = Record<string, string>;

/** A web console's sign-in: a web console `Origin`, no `Authorization`. */
export function webSignIn(app: FastifyInstance, username: string, password: string = DEMO_OPERATOR_PASSWORD, headers: Headers = {}): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url: SIGN_IN, headers: { origin: WEB_ORIGIN, ...headers }, payload: { username, password } });
}

/** A paired device's sign-in: its credential as a bearer value, no `Origin`, no cookie (decision D69). */
export function deviceSignIn(app: FastifyInstance, credential: string, username: string, password: string = DEMO_OPERATOR_PASSWORD): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url: SIGN_IN, headers: bearer(credential), payload: { username, password } });
}

export const bearer = (value: string): Headers => ({ authorization: `Bearer ${value}` });

/** Every `Set-Cookie` header of an answer. */
export function setCookies(response: LightMyRequestResponse): string[] {
  const header = response.headers['set-cookie'];
  if (header === undefined) return [];
  return Array.isArray(header) ? header : [String(header)];
}

/** The value a `Set-Cookie` header gives the cookie `name`, or null. */
export function cookieValue(response: LightMyRequestResponse, name: string): string | null {
  for (const header of setCookies(response)) {
    const [pair] = header.split(';');
    if (pair !== undefined && pair.startsWith(`${name}=`)) return pair.slice(name.length + 1);
  }
  return null;
}

/** A signed-in web console: the cookie header to send, and the token inside it. */
export interface WebSession {
  readonly token: string;
  /** `{ cookie: 'dems_session_<port>=…' }`. */
  readonly cookie: Headers;
  readonly response: LightMyRequestResponse;
}

export async function signInOnWeb(identity: IdentityApp, username: string): Promise<WebSession> {
  const response = await webSignIn(identity.app, username);
  expect(response.statusCode).toBe(200);
  const token = cookieValue(response, identity.cookieName);
  if (token === null) throw new Error('the web sign-in set no session cookie');
  return { token, cookie: { cookie: `${identity.cookieName}=${token}` }, response };
}

/** A GET as a same-origin browser read sends it: the cookie and no `Origin`. */
export function get(app: FastifyInstance, url: string, headers: Headers = {}): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'GET', url, headers });
}

/** A POST of the web console: the cookie and the web console `Origin`. */
export function webPost(app: FastifyInstance, url: string, headers: Headers = {}, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...headers }, ...(payload === undefined ? {} : { payload }) });
}

export interface ErrorOf {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, string | number | boolean | null>;
  readonly requestId?: string;
}

export function errorOf(response: LightMyRequestResponse): ErrorOf {
  return (response.json() as { error: ErrorOf }).error;
}

// ── Paired devices: the registry is plan row W32's; these are its stand-ins ─────────────────────

/**
 * A stand-in for the device registry behind the seam `deviceResolver`: it knows the credentials
 * and the states a test gives it. The rows of `paired_devices` that a device session refers to
 * are inserted by `insertPairedDevice`.
 */
export interface DeviceRegistryDouble {
  readonly resolver: DeviceResolver;
  /** Registers a PAIRED device and returns its credential (a made-up `dvc_` value). */
  pair(deviceId: string): string;
  /** REVOKED or UNPAIRED: the credential and the device's sessions are retired. */
  retire(deviceId: string): void;
}

export function deviceRegistryDouble(): DeviceRegistryDouble {
  const states = new Map<string, ResolvedDevice['status']>();
  const credentials = new Map<string, string>();
  const resolved = (deviceId: string | undefined): ResolvedDevice | null => {
    const status = deviceId === undefined ? undefined : states.get(deviceId);
    return deviceId === undefined || status === undefined ? null : { status, deviceId };
  };
  return {
    resolver: {
      resolveCredential: async (credential) => resolved(credentials.get(credential)),
      resolveDevice: async (deviceId) => resolved(deviceId),
      // The read of another module's unit is the real statement, on the rows `insertPairedDevice` wrote.
      deviceState: (db, deviceId) => readDeviceState(db, deviceId),
    },
    pair(deviceId) {
      const credential = `dvc_${randomBytes(32).toString('base64url')}`;
      states.set(deviceId, 'PAIRED');
      credentials.set(credential, deviceId);
      return credential;
    },
    retire(deviceId) {
      states.set(deviceId, 'RETIRED');
    },
  };
}

/**
 * The rows a device session's foreign key needs, written as `dems_owner`: a redeemed pairing
 * code and the PAIRED device. Fixture rows; the code hash is not the hash of any code.
 */
export async function insertPairedDevice(owner: Pool, deviceId: string, issuedBy: string, at: number): Promise<void> {
  const number = deviceId.replace(/^DEV-/, '');
  const codeId = `PCD-${number.padStart(6, '0')}`;
  await owner.query(
    "INSERT INTO public.pairing_codes (id, code_hash, state, issued_by_operator_id, issued_at, expires_at, failed_attempts, closed_at) VALUES ($1, $2, 'REDEEMED', $3, $4, $5, 0, $4)",
    [codeId, Buffer.alloc(32, 7), issuedBy, at, at + 300_000],
  );
  await owner.query(
    "INSERT INTO public.paired_devices (id, name, platform, app_version, state, paired_at, paired_with_code_id, last_seen_at, updated_at) VALUES ($1, $2, 'android', '0.2.0', 'PAIRED', $3, $4, $3, $3)",
    [deviceId, `Test tablet ${number}`, at, codeId],
  );
}

// ── The stored sessions, as `dems_owner` ───────────────────────────────────────────────────────

export interface StoredSession {
  readonly id: string;
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly method: string;
  readonly issuedAt: number;
  readonly lastSeenAt: number;
  readonly absoluteExpiresAt: number;
  readonly endedAt: number | null;
  readonly endReason: string | null;
  /** Bytes of the stored token hash. The hash itself is not read into the test. */
  readonly tokenHashBytes: number;
}

/** Every row of `auth_sessions` in the order of issue, without the token hash. */
export async function storedSessions(owner: Pick<Pool, 'query'>): Promise<StoredSession[]> {
  const { rows } = await owner.query<{
    id: string;
    operator_id: string;
    device_id: string | null;
    method: string;
    issued_at: string;
    last_seen_at: string;
    absolute_expires_at: string;
    ended_at: string | null;
    end_reason: string | null;
    hash_bytes: number;
  }>(
    'SELECT id, operator_id, device_id, method, issued_at, last_seen_at, absolute_expires_at, ended_at, end_reason, octet_length(token_hash) AS hash_bytes ' +
      'FROM public.auth_sessions ORDER BY issued_at, id',
  );
  return rows.map((row) => ({
    id: row.id,
    operatorId: row.operator_id,
    deviceId: row.device_id,
    method: row.method,
    issuedAt: Number(row.issued_at),
    lastSeenAt: Number(row.last_seen_at),
    absoluteExpiresAt: Number(row.absolute_expires_at),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    endReason: row.end_reason,
    tokenHashBytes: row.hash_bytes,
  }));
}

/** The stored row of the session a token belongs to, found by the token's SHA-256 as the server finds it. */
export async function sessionOfToken(owner: Pick<Pool, 'query'>, token: string): Promise<StoredSession> {
  const digest = createHash('sha256').update(token, 'utf8').digest();
  const { rows } = await owner.query<{ id: string }>('SELECT id FROM public.auth_sessions WHERE token_hash = $1', [digest]);
  const id = rows[0]?.id;
  const session = (await storedSessions(owner)).find((candidate) => candidate.id === id);
  if (session === undefined) throw new Error('no session row has the hash of this token');
  return session;
}

/** Fixture clean-up between tests, as `dems_owner`: every open session is closed where it stands. */
export async function closeOpenSessions(owner: Pick<Pool, 'query'>): Promise<void> {
  await owner.query("UPDATE public.auth_sessions SET ended_at = issued_at, end_reason = 'SIGNED_OUT' WHERE ended_at IS NULL");
}

/** How often `needle` occurs in `haystack`. */
export function occurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) count += 1;
  return count;
}

/**
 * Asserts that none of the secrets occurs in the text, in any of the forms it could have been
 * written in. A failure names the secret by its label and the form, never by its value.
 */
export function expectAbsent(text: string, secrets: Readonly<Record<string, string>>): void {
  const found: string[] = [];
  for (const [label, secret] of Object.entries(secrets)) {
    const bytes = Buffer.from(secret, 'utf8');
    const forms: Record<string, string> = {
      plain: secret,
      hex: bytes.toString('hex'),
      base64: bytes.toString('base64'),
      base64url: bytes.toString('base64url'),
      json: JSON.stringify(secret).slice(1, -1),
      uri: encodeURIComponent(secret),
    };
    for (const [form, value] of Object.entries(forms)) {
      if (occurrences(text, value) > 0) found.push(`${label} as ${form}`);
    }
  }
  expect(found).toEqual([]);
}
