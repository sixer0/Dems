// Finding F53 against the real PostgreSQL, as `dems_app` (checkpoint CP-B1, finding CPB1-3;
// decision D87): a temporary table that is called like a real one, left on a pooled connection,
// must not stand in for the real table inside a unit of work.
//
// The hazard is real and is shown first: on a connection with PostgreSQL's default search path a
// statement that names `audit_log` without its schema finds the temporary table. Then the unit:
// on that same connection (the pool has ONE), with temporary tables `audit_log` and `events` in
// place, an audit row and an event appended through the unit's writers are in the PUBLIC tables,
// and the chain verifies. The pool of these tests is built WITHOUT the start-up option of the
// runtime pool, so what is tested here is the unit's own pin and nothing else. The pool's option
// is tested in `plugins/db/__tests__/search-path.db.test.ts`.
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { coreState, insertRbac, insertRow } from '../../../test/db/fixtures';
import { runtimePool } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import { createPipeline } from '../pipeline';
import type { Pipeline } from '../types';
import { coreApp, linkProblems, readEvents, readHead, readTrail, verifyTrail, type CoreApp } from './support';

const db = useTestDatabase({ template: 'schema' });
let core: CoreApp;
let owner: Pool;

/** The value the unit pins, written out: this file must also run against the code before the fix. */
const PINNED = 'public,pg_temp';

beforeAll(async () => {
  owner = db.ownerPool();
  await insertRbac(owner);
  await insertRow(owner, 'core_state', coreState());
  await insertRow(owner, 'engine_counters', { name: 'event', next_value: 1 });
  core = await coreApp(db, db.run.dataDir, 'info');
});

const entry = (message: string) => ({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message, details: {} }) as const;

/** A pool of `dems_app` with ONE connection and PostgreSQL's default search path, and a pipeline on it. */
function singleConnection(): { pool: Pool; pipeline: Pipeline } {
  const pool = runtimePool(db.runtime, 1, 'dems-cpb1a-path');
  db.onCleanup(() => pool.end());
  return { pool, pipeline: createPipeline({ pool: () => pool, clock: core.clock, log: core.app.log, errorLog: core.app.errorLog }) };
}

const backend = async (pool: Pick<Pool, 'query'>): Promise<number> => Number((await pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid);
const count = async (pool: Pick<Pool, 'query'>, table: string): Promise<number> => Number((await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`)).rows[0]?.n);

describe('the hazard (finding F53), shown on the real server', () => {
  it('with the default search path a temporary table called audit_log is found before the real one', async () => {
    const { pool } = singleConnection();
    expect((await pool.query<{ path: string }>("SELECT current_setting('search_path') AS path")).rows[0]?.path).toBe('"$user", public');
    // The runtime role may create temporary tables: nothing in the database refuses this.
    await pool.query('CREATE TEMP TABLE audit_log (LIKE public.audit_log)');
    // Which table a statement means by the bare name: the temporary one.
    const named = await pool.query<{ real: boolean; schema: string }>(
      "SELECT 'audit_log'::regclass = 'public.audit_log'::regclass AS real, " +
        "(SELECT relnamespace::regnamespace::text FROM pg_class WHERE oid = 'audit_log'::regclass) AS schema",
    );
    expect(named.rows[0]?.real).toBe(false);
    expect(named.rows[0]?.schema).toMatch(/^pg_temp_\d+$/);
  });
});

describe('a unit of work on a connection that holds temporary tables called audit_log and events', () => {
  it('appends to the PUBLIC tables: the rows are stored, the temporary tables stay empty, the chain verifies', async () => {
    const { pool, pipeline } = singleConnection();
    // Outside a unit, on the one connection of the pool: what a careless program could leave.
    await pool.query('CREATE TEMP TABLE audit_log (LIKE public.audit_log)');
    await pool.query('CREATE TEMP TABLE events (LIKE public.events)');
    const pid = await backend(pool);
    const before = { head: await readHead(owner), rows: (await readTrail(owner)).length, events: (await readEvents(owner)).length };

    const outcome = await pipeline.run('test.shadowed', async (unit) => {
      const inside = await unit.query<{ pid: number; path: string }>("SELECT pg_backend_pid() AS pid, current_setting('search_path') AS path");
      const row = await unit.audit.append(entry('Appended on a connection with a temporary audit_log'));
      const event = await unit.events.append({ type: 'AUTOSAVE', message: 'Appended on a connection with a temporary events' });
      return { inside: inside.rows[0], row, event };
    });

    // The same connection, and the pinned path inside the unit.
    expect(outcome.inside).toEqual({ pid, path: PINNED });
    // The row and the event are in the real tables, read on another connection as another role.
    const rows = await readTrail(owner);
    const head = await readHead(owner);
    expect(rows).toHaveLength(before.rows + 1);
    expect(rows.at(-1)).toEqual(outcome.row);
    expect(outcome.row.seq).toBe(before.head.seq + 1);
    expect(head).toEqual({ seq: outcome.row.seq, hash: outcome.row.hash });
    const stored = await readEvents(owner);
    expect(stored).toHaveLength(before.events + 1);
    expect(stored.at(-1)).toMatchObject({ seq: outcome.event.seq, type: 'AUTOSAVE' });
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });

    // The temporary tables are still there on that connection, and empty.
    expect(await backend(pool)).toBe(pid);
    expect(await count(pool, 'pg_temp.audit_log')).toBe(0);
    expect(await count(pool, 'pg_temp.events')).toBe(0);
    // The pin ended with the transaction: the session has the path it had.
    expect((await pool.query<{ path: string }>("SELECT current_setting('search_path') AS path")).rows[0]?.path).toBe('"$user", public');
  });

  it('the query builder on the unit reads and changes the real tables too', async () => {
    const { pool, pipeline } = singleConnection();
    await pool.query('CREATE TEMP TABLE operators (LIKE public.operators)');
    await pool.query('CREATE TEMP TABLE audit_chain_head (LIKE public.audit_chain_head)');
    const real = await count(owner, 'public.operators');
    expect(real).toBeGreaterThan(0);
    const seen = await pipeline.run('test.builder', async (unit) => {
      const { rows } = await unit.query<{ n: string }>('SELECT count(*)::text AS n FROM operators');
      const head = await unit.audit.head();
      return { operators: Number(rows[0]?.n), head };
    });
    expect(seen.operators).toBe(real);
    expect(seen.head).toEqual(await readHead(owner));
    expect(await count(pool, 'operators')).toBe(0);
  });

  it('a unit that rolls back leaves the path of the session as it was, and the next unit pins it again', async () => {
    const { pool, pipeline } = singleConnection();
    await pool.query('CREATE TEMP TABLE audit_log (LIKE public.audit_log)');
    const before = (await readTrail(owner)).length;
    await pipeline
      .run('test.rollback', async (unit) => {
        await unit.audit.append(entry('Rolled back'));
        throw new Error('roll it back');
      })
      .catch(() => undefined);
    expect((await pool.query<{ path: string }>("SELECT current_setting('search_path') AS path")).rows[0]?.path).toBe('"$user", public');
    expect((await readTrail(owner)).length).toBe(before);
    expect(await count(pool, 'pg_temp.audit_log')).toBe(0);
    const row = await pipeline.run('test.next', (unit) => unit.audit.append(entry('The next unit')));
    expect((await readTrail(owner)).at(-1)).toEqual(row);
    expect(await count(pool, 'pg_temp.audit_log')).toBe(0);
  });
});

describe('at the end of the file', () => {
  it('the chain of this database verifies over all rows', async () => {
    const rows = await readTrail(owner);
    const head = await readHead(owner);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
  });
});
