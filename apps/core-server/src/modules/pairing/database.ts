/**
 * Reads of the pairing module on the runtime pool (plan row W32; spec §2.3; SR-48, SR-50).
 *
 * A read that changes nothing needs no unit of work: it runs on the runtime pool, through the
 * one helper of the pool plugin (`app.db.read`; review finding CPB1-8), which hands over the
 * CURRENT pool each time (a demo reset replaces the pool). A read that FAILS is the database's
 * failure, not the caller's: the helper logs it as `{ err }` (the logger keeps the name, the
 * code and the stack frames of an error, never its message, which can quote a statement and its
 * parameters), writes it to the persistent error log, tells readiness, and answers
 * 503 `NOT_READY`.
 */
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { ReadContext } from '../../plugins/db';
import type { Queryable } from './store';

/** The pool as a connection of the statements. */
export function onPool(pool: Pool): Queryable {
  return { query: (text, values) => pool.query(text, values === undefined ? [] : [...values]) };
}

/**
 * `work` gets the pool as a connection of this module's statements. `source` names the read for
 * the log, for example `pairing.resolveCredential`. A name, never request data. `context` is the
 * request the read belongs to, when the caller has one: the helper's line and entry then carry
 * its request ID.
 */
export function readDatabase<T>(app: FastifyInstance, source: string, work: (db: Queryable) => Promise<T>, context?: ReadContext): Promise<T> {
  return app.db.read(source, (pool) => work(onPool(pool)), context);
}
