// The statement guard of a unit of work against the real PostgreSQL, as `dems_app` (checkpoint
// CP-B1, finding CPB1-4; finding F53).
//
//   - the forms the review names (`SELECT ... INTO TEMP`, a `DO` block, the function that changes
//     a setting, a text with a second statement) are refused BEFORE they are sent: the unit's
//     transaction is not in the failed state afterwards, and the unit commits;
//   - what such a statement would have done without the guard is shown on a plain connection, so
//     that the refusals are known to matter;
//   - the second protection, the protocol: the server itself refuses a text with two commands
//     when it is sent with the extended protocol, and runs both with the simple one;
//   - row statements in the forms modules write still run.
import { eq, sql } from 'drizzle-orm';
import type { Pool, QueryConfig } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { coreState, insertRbac, insertRow } from '../../../test/db/fixtures';
import { runtimePool } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import { engineCounters, operators } from '../../db/schema';
import { sqlStateOf } from '../errors';
import { createPipeline } from '../pipeline';
import { coreApp, readHead, readTrail, type CoreApp } from './support';

const db = useTestDatabase({ template: 'schema' });
let core: CoreApp;
let owner: Pool;

beforeAll(async () => {
  owner = db.ownerPool();
  await insertRbac(owner);
  await insertRow(owner, 'core_state', coreState());
  await insertRow(owner, 'engine_counters', { name: 'event', next_value: 1 });
  core = await coreApp(db, db.run.dataDir, 'info');
});

const caught = <T>(work: Promise<T>): Promise<unknown> =>
  work.then(
    () => null,
    (error: unknown) => error,
  );

const entry = (message: string) => ({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message, details: {} }) as const;

/** The forms of finding CPB1-4, and their neighbours. None of them is a row statement of a unit. */
const REFUSED = [
  'SELECT * INTO TEMP audit_log FROM public.audit_log',
  'SELECT * INTO TEMPORARY TABLE events FROM public.events',
  'SELECT 1 AS seq INTO pg_temp.audit_log',
  "DO $$ BEGIN EXECUTE 'CREATE TEMP TABLE audit_log (seq bigint)'; END $$",
  "SELECT set_config('search_path', 'pg_temp, public', false)",
  "SELECT set_config('statement_timeout', '0', false)",
  'SET LOCAL search_path = pg_temp, public',
  'UPDATE public.operators SET enabled = enabled WHERE id = $1; COMMIT',
  'SELECT 1; SELECT 2',
  'SELECT 1; ROLLBACK',
  'CREATE TEMP TABLE audit_log (LIKE public.audit_log)',
  'LISTEN channel',
  'PREPARE leftover AS SELECT 1',
  'LOCK TABLE public.operators IN SHARE MODE',
] as const;

describe('what the guard refuses reaches no connection', () => {
  it('fourteen refusals inside one unit: the transaction is not failed, the unit commits, nothing is left on the connection', async () => {
    const pool = runtimePool(db.runtime, 1, 'dems-cpb1a-guard');
    db.onCleanup(() => pool.end());
    const pipeline = createPipeline({ pool: () => pool, clock: core.clock, log: core.app.log, errorLog: core.app.errorLog });
    const before = await readHead(owner);

    const codes = await pipeline.run('test.guard', async (unit) => {
      await unit.query('SELECT 1');
      const seen: Array<string | undefined> = [];
      for (const text of REFUSED) {
        seen.push(sqlStateOf(await caught(unit.query(text, text.includes('$1') ? ['OPR-001'] : undefined))));
        // After a statement the server refused, this would fail with SQLSTATE 25P02.
        expect((await unit.query<{ one: number }>('SELECT 1 AS one')).rows).toEqual([{ one: 1 }]);
      }
      // Through the query builder as well: its raw statement goes through the same guard.
      seen.push(sqlStateOf(await caught(unit.db.execute(sql`select 1; commit`))));
      await unit.audit.append(entry('The unit commits after the refusals'));
      return seen;
    });

    expect(codes).toEqual(Array.from({ length: REFUSED.length + 1 }, () => 'UNIT_STATEMENT_NOT_ALLOWED'));
    expect((await readHead(owner)).seq).toBe(before.seq + 1);
    // Nothing of the unit stayed on its connection: no temporary table, no prepared statement,
    // no channel, and the path and the statement limit of the session are the server's defaults.
    const left = await pool.query<{ temporary: string; prepared: string; channels: string; path: string; limit: string }>(
      'SELECT (SELECT count(*)::text FROM pg_class WHERE relnamespace = pg_my_temp_schema()) AS temporary, ' +
        '(SELECT count(*)::text FROM pg_prepared_statements) AS prepared, ' +
        '(SELECT count(*)::text FROM pg_listening_channels()) AS channels, ' +
        "current_setting('search_path') AS path, current_setting('statement_timeout') AS limit",
    );
    expect(left.rows[0]).toEqual({ temporary: '0', prepared: '0', channels: '0', path: '"$user", public', limit: '0' });
  });

  it('what two of them do on a plain connection, without the guard: a table that outlives the transaction, and a commit in the middle', async () => {
    const pool = runtimePool(db.runtime, 1, 'dems-cpb1a-plain');
    db.onCleanup(() => pool.end());
    await pool.query('BEGIN');
    await pool.query('SELECT * INTO TEMP audit_log FROM public.audit_log');
    await pool.query('COMMIT');
    // The temporary table is on the connection after the transaction, and the bare name means it.
    expect((await pool.query("SELECT 'audit_log'::regclass = 'public.audit_log'::regclass AS real")).rows[0]).toEqual({ real: false });

    // A text with a second statement, sent as the driver sends a text without values: both run,
    // so the COMMIT ends the transaction and the caller's own COMMIT finds none.
    const enabled = async (): Promise<unknown> => (await owner.query('SELECT enabled FROM public.operators WHERE id = $1', ['OPR-003'])).rows[0]?.enabled;
    expect(await enabled()).toBe(true);
    await pool.query('BEGIN');
    await pool.query("UPDATE public.operators SET enabled = false WHERE id = 'OPR-003'; COMMIT");
    expect(await enabled()).toBe(false);
    await pool.query('ROLLBACK');
    expect(await enabled()).toBe(false);
    await owner.query('UPDATE public.operators SET enabled = true WHERE id = $1', ['OPR-003']);
  });
});

describe('the second protection: the protocol', () => {
  it('the server refuses a text with two commands in the extended protocol (42601) and runs both in the simple one', async () => {
    const pool = runtimePool(db.runtime, 1, 'dems-cpb1a-protocol');
    db.onCleanup(() => pool.end());
    const twoCommands = 'SELECT 1 AS one; SELECT 2 AS two';

    const simple = (await pool.query(twoCommands)) as unknown;
    expect(Array.isArray(simple)).toBe(true);
    expect((simple as Array<{ rows: unknown[] }>).map((result) => result.rows)).toEqual([[{ one: 1 }], [{ two: 2 }]]);

    const extended: QueryConfig & { queryMode: 'extended' } = { text: twoCommands, queryMode: 'extended' };
    const refusal = await caught(pool.query(extended));
    expect(refusal).toMatchObject({ code: '42601' });
    // One command, the same way, runs: also a setting and a statement without values.
    const one: QueryConfig & { queryMode: 'extended' } = { text: 'SELECT 1 AS one;', queryMode: 'extended' };
    expect((await pool.query(one)).rows).toEqual([{ one: 1 }]);
  });
});

describe('row statements in the forms modules write still run', () => {
  it('through unit.query and through the query builder, with and without values', async () => {
    const before = (await readTrail(owner)).length;
    const outcome = await core.app.pipeline.run('test.rows', async (unit) => {
      await unit.query("SET LOCAL lock_timeout = '1s'");
      await unit.query('SET CONSTRAINTS ALL IMMEDIATE');
      const literal = await unit.query<{ text: string }>("SELECT 'a; COMMIT; -- not a comment' AS text");
      const union = await unit.query<{ n: number }>('(SELECT 1 AS n) UNION ALL (SELECT 2 AS n) ORDER BY n');
      const cte = await unit.query<{ id: string }>(
        'WITH changed AS (UPDATE public.operators SET updated_at = updated_at WHERE id = $1 RETURNING id) SELECT id FROM changed',
        ['OPR-001'],
      );
      const locked = await unit.query<{ id: string }>('SELECT id FROM public.operators WHERE id = $1 FOR UPDATE', ['OPR-001']);
      const built = await unit.db.select({ id: operators.id }).from(operators).where(eq(operators.id, 'OPR-002'));
      await unit.db
        .insert(engineCounters)
        .values({ name: 'session', nextValue: 5 })
        .onConflictDoUpdate({ target: engineCounters.name, set: { nextValue: 6 } });
      const inside = await unit.query<{ isolation: string; limit: string }>(
        "SELECT current_setting('transaction_isolation') AS isolation, current_setting('statement_timeout') AS limit",
      );
      const row = await unit.audit.append(entry('Row statements ran'));
      return { literal: literal.rows, union: union.rows, cte: cte.rows, locked: locked.rows, built, inside: inside.rows[0], seq: row.seq };
    });
    expect(outcome).toMatchObject({
      literal: [{ text: 'a; COMMIT; -- not a comment' }],
      union: [{ n: 1 }, { n: 2 }],
      cte: [{ id: 'OPR-001' }],
      locked: [{ id: 'OPR-001' }],
      built: [{ id: 'OPR-002' }],
      inside: { isolation: 'read committed', limit: '5s' },
    });
    expect((await readTrail(owner)).length).toBe(before + 1);
    expect((await owner.query("SELECT next_value::text AS v FROM public.engine_counters WHERE name = 'session'")).rows).toEqual([{ v: '5' }]);
  });
});
