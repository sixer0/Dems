/**
 * Support for the database tests of plan row W17 (not a test file).
 *
 * Roles (TI-9, TI-17): `db.appPool()` and the pools built here from `db.runtime` are the runtime
 * role `dems_app`, exactly as the server connects; `db.ownerPool()` is `dems_owner` and is used
 * for fixtures and assertions only. Nothing connects as the bootstrap superuser.
 */
import { createHash } from 'node:crypto';
import { Client, Pool, type PoolClient } from 'pg';
import { expect } from 'vitest';
import type { DatabaseConnection } from '../../src/config';
import type { TemplateDefinition } from '../helpers/db';

/** What a refused statement reports: the SQLSTATE and, where there is one, the constraint. */
export interface Refusal {
  readonly code: string | undefined;
  readonly constraint: string | undefined;
  readonly message: string;
}

/**
 * The SQLSTATE of a failure. The driver puts `code` and `constraint` on the error itself;
 * drizzle-orm wraps the driver error, so the same fields are on `error.cause` (D38).
 */
export function refusalOf(error: unknown): Refusal {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string') {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined,
        message: typeof candidate.message === 'string' ? candidate.message : '',
      };
    }
    current = candidate.cause;
  }
  return { code: undefined, constraint: undefined, message: error instanceof Error ? error.message : String(error) };
}

/** Runs `work` and returns how it was refused. Fails the test when it was NOT refused. */
export async function refused(work: () => Promise<unknown>): Promise<Refusal> {
  try {
    await work();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error('the statement was expected to be refused, and it succeeded');
}

/** Expects `work` to be refused with exactly this SQLSTATE (and constraint, when given). */
export async function expectRefused(work: () => Promise<unknown>, code: string, constraint?: string): Promise<Refusal> {
  const refusal = await refused(work);
  expect(refusal.code, refusal.message).toBe(code);
  if (constraint !== undefined) expect(refusal.constraint, refusal.message).toBe(constraint);
  return refusal;
}

/** SQLSTATE values the tests name. */
export const SQLSTATE = {
  insufficientPrivilege: '42501',
  checkViolation: '23514',
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  /** PostgreSQL 18 reports this, not 23503, for a delete refused by ON DELETE RESTRICT (D38). */
  restrictViolation: '23001',
  notNullViolation: '23502',
  chainDiscontinuity: 'ZA001',
  appendOnly: 'ZA002',
} as const;

/** SHA-256 of a text, as 32 bytes: the stored form of a token, a credential or a code (§5.1). */
export function sha256(text: string): Buffer {
  return createHash('sha256').update(text, 'utf8').digest();
}

export function sha256Hex(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}

/** A pool of the runtime role on a clone, larger than the helper's (the concurrency tests need it). */
export function runtimePool(runtime: DatabaseConnection, max: number, applicationName = 'dems-w17-test'): Pool {
  const pool = new Pool({
    host: runtime.host,
    port: runtime.port,
    database: runtime.database,
    user: runtime.user,
    password: () => runtime.password.reveal(),
    ssl: false,
    application_name: applicationName,
    max,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', () => undefined);
  return pool;
}

/** One dedicated connection of a role: a session of its own, for tests about locks. */
export async function connect(connection: DatabaseConnection, applicationName = 'dems-w17-session'): Promise<Client> {
  const client = new Client({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: () => connection.password.reveal(),
    ssl: false,
    application_name: applicationName,
    connectionTimeoutMillis: 5_000,
  });
  await client.connect();
  return client;
}

/** Runs `work` in one transaction on one connection; rolls back when it throws. */
export async function inTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * A checksum of a table's content: the SHA-256 of its rows as text, in key order. Used to show
 * that refused statements changed nothing.
 */
export async function tableChecksum(pool: Pool, table: string, orderBy: string): Promise<string> {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_, ]+$/.test(orderBy)) throw new Error('tableChecksum takes plain identifiers');
  const { rows } = await pool.query<{ digest: string | null; rows: string }>(
    `SELECT encode(sha256(convert_to(coalesce(string_agg(t::text, E'\\n' ORDER BY ${orderBy}), ''), 'UTF8')), 'hex') AS digest,
            count(*) AS rows
       FROM public.${table} AS t`,
  );
  return `${rows[0]?.rows ?? '?'}:${rows[0]?.digest ?? '?'}`;
}

/** How many sessions wait for a lock in this database (visible to every role in `pg_locks`). */
export async function waitingLocks(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ waiting: string }>(
    'SELECT count(*) AS waiting FROM pg_locks AS l WHERE NOT l.granted ' +
      'AND l.pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())',
  );
  return Number(rows[0]?.waiting ?? 0);
}

/** Waits until `probe` returns true, or fails after `timeoutMs`. */
export async function until(probe: () => Promise<boolean>, what: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await probe()) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The fixed instant the shared suites use: 2026-10-01 10:00:00 WIB (ENG-20). */
export const FIXED_NOW = Date.UTC(2026, 9, 1, 3, 0, 0);

/**
 * A private template with nothing in it: an empty database (`template0`, UTF8, locale C), for the
 * tests that apply the migrations themselves. One definition for every file that uses it.
 */
export const EMPTY_DATABASE: TemplateDefinition = Object.freeze({ key: 'x_w17empty', base: 'empty', build: async () => {} });
