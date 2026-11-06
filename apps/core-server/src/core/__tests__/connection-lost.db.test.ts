// A connection that is lost in the middle of a unit of work, against the real PostgreSQL as
// `dems_app` (checkpoint CP-B1, finding CPB1-6; spec §2.3 stage 9, ENG-5).
//
// WHAT IS PROVOKED FOR REAL HERE: the loss of the unit's own connection, by closing its socket
// from this side (the stream of the driver's client is destroyed) while the unit holds an open
// transaction with the chain lock. The driver then reports what it reports when a connection
// ends without notice: an `error` event on the client and a rejection without an SQLSTATE. The
// server sees the socket close and rolls the transaction back.
//
// WHAT IS NOT PROVOKED HERE: a server that stops (57P01 to 57P03) or refuses a connection
// (class 08). PostgreSQL is never stopped by a test, and the roles of this project may not end a
// backend of another role. Those error shapes are tested on a stand-in connection in
// `connection-lost.test.ts`.
import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { coreState, insertRbac, insertRow } from '../../../test/db/fixtures';
import { runtimePool } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import { buildApp } from '../../app';
import type { DatabaseConnection } from '../../config';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { createRuntimePool } from '../../plugins/db';
import { PipelineFailure, sqlStateOf } from '../errors';
import { createPipeline } from '../pipeline';
import { coreApp, linkProblems, readHead, readTrail, verifyTrail, type CoreApp } from './support';

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

interface Watched {
  readonly pool: Pool;
  /** Closes the socket of the connection that was handed out last, from this side. */
  cut(): void;
}

/** `pool`, remembering the client it hands out, so that a test can close that client's socket. */
function watched(pool: Pool): Watched {
  let last: PoolClient | undefined;
  const proxy = new Proxy(pool, {
    get(target, property, receiver) {
      if (property === 'connect') {
        return async () => {
          last = await target.connect();
          return last;
        };
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  return {
    pool: proxy,
    cut() {
      const stream = (last as unknown as { connection?: { stream?: { destroy(): void } } } | undefined)?.connection?.stream;
      if (stream === undefined) throw new Error('no connection was handed out');
      stream.destroy();
    },
  };
}

describe('the socket of the unit\'s connection is closed while the unit holds the chain lock', () => {
  it('during a statement: 503 DATABASE_UNAVAILABLE, nothing stored, the lock is free at once, and the next unit commits on a new connection', async () => {
    const lane = watched(runtimePool(db.runtime, 1, 'dems-cpb1a-lost'));
    db.onCleanup(() => lane.pool.end());
    const told: string[] = [];
    const pipeline = createPipeline({
      pool: () => lane.pool,
      clock: core.clock,
      log: core.app.log,
      errorLog: core.app.errorLog,
      onConnectionLost: () => void told.push('lost'),
      onDatabaseFailure: () => void told.push('failure'),
    });
    const before = { head: await readHead(owner), rows: (await readTrail(owner)).length };
    const from = core.log.lines().length;
    let backend = 0;

    const error = await caught(
      pipeline.run('test.cut', async (unit) => {
        backend = Number((await unit.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid);
        await unit.audit.append(entry('Written before the socket was closed'));
        lane.cut();
        // The statement after the cut never gets an answer.
        await unit.query('SELECT pg_sleep(30)');
      }),
    );

    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'DATABASE_UNAVAILABLE' });
    // What the driver reports for a connection that ended without notice: no SQLSTATE at all.
    const cause = (error as PipelineFailure).cause;
    expect(cause).toBeInstanceOf(Error);
    expect(sqlStateOf(cause)).toBeUndefined();
    expect(told).toEqual(['lost', 'failure']);

    // The server rolled the transaction back: the row is not stored and the head did not move.
    expect(await readHead(owner)).toEqual(before.head);
    expect((await readTrail(owner)).length).toBe(before.rows);

    // The chain lock is free: a unit on another connection gets it without waiting for anything.
    const started = performance.now();
    const next = await pipeline.run('test.afterCut', async (unit) => ({
      pid: Number((await unit.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid),
      row: await unit.audit.append(entry('The unit after the lost connection')),
    }));
    expect(performance.now() - started).toBeLessThan(3_000);
    expect(next.pid).not.toBe(backend);
    expect(next.row.seq).toBe(before.head.seq + 1);
    expect(next.row.prevHash).toBe(before.head.hash);

    // The log: one error line by the codes, nothing of the driver's text.
    const lines = core.log.lines().slice(from);
    expect(lines.filter((line) => line['msg'] === 'unit not committed')).toHaveLength(1);
    expect(lines.find((line) => line['msg'] === 'unit not committed')).toMatchObject({ level: 50, label: 'test.cut', code: 'DATABASE_UNAVAILABLE' });
    expect(JSON.stringify(lines)).not.toMatch(/terminated|pg_sleep/i);
    expect(pipeline.snapshot()).toMatchObject({ failed: 1, completed: 1, timedOut: 0 });
    console.info(`[cpb1-6] the driver's error for a closed socket: name ${(cause as Error).name}, code ${String(sqlStateOf(cause))}; the next unit committed seq ${next.row.seq} on backend ${next.pid === backend ? 'the same' : 'another'}`);
  });

  it('between two statements, and the work returns normally: no commit, 503', async () => {
    const lane = watched(runtimePool(db.runtime, 1, 'dems-cpb1a-idle'));
    db.onCleanup(() => lane.pool.end());
    const pipeline = createPipeline({ pool: () => lane.pool, clock: core.clock, log: core.app.log, errorLog: core.app.errorLog });
    const before = await readHead(owner);
    const error = await caught(
      pipeline.run('test.cutIdle', async (unit) => {
        await unit.audit.append(entry('Written, then the socket is closed while the unit thinks'));
        lane.cut();
        // The driver notices in a later turn of the event loop.
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'the work returned normally';
      }),
    );
    expect(error).toMatchObject({ statusCode: 503, reason: 'DATABASE_UNAVAILABLE' });
    expect(await readHead(owner)).toEqual(before);
  });
});

describe('in the app, on the runtime pool', () => {
  it('the request answers 503 NOT_READY; ready.database goes off and, because the database answers, on again; the next request commits', async () => {
    let lane: Watched | undefined;
    const log = captureLog();
    const app: FastifyInstance = buildApp({
      config: unitTestConfig({ database: db.runtime, dataDir: db.run.dataDir, logLevel: 'info' }),
      logStream: log.stream,
      createPool: (connection: DatabaseConnection) => {
        lane = watched(createRuntimePool(connection));
        return lane.pool;
      },
    });
    db.onCleanup(() => app.close());
    let cut = true;
    app.post('/api/v1/scratch/change', async () =>
      app.pipeline.run('test.change', async (unit) => {
        const row = await unit.audit.append(entry('A change of a handler'));
        if (cut) {
          lane?.cut();
          await unit.query('SELECT pg_sleep(30)');
        }
        return { seq: row.seq };
      }),
    );
    await app.ready();
    for (const stage of ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const) app.stages.replace(stage, () => {});
    expect(await app.db.probe({ fresh: true })).toBe(true);
    const before = await readHead(owner);

    const lost = await app.inject({ method: 'POST', url: '/api/v1/scratch/change' });
    expect(lost.statusCode).toBe(503);
    expect((lost.json() as { error: { code: string } }).error.code).toBe('NOT_READY');
    // The probe the pool started at the loss has answered: the database is there.
    expect(await app.db.probe({ fresh: true })).toBe(true);
    const flags = log
      .lines()
      .filter((line) => line['msg'] === 'readiness changed' && line['part'] === 'database')
      .map((line) => line['ready']);
    expect(flags).toEqual([true, false, true]);
    expect(log.lines().some((line) => line['msg'] === 'unexpected error while handling a request')).toBe(false);
    expect(await readHead(owner)).toEqual(before);

    cut = false;
    const again = await app.inject({ method: 'POST', url: '/api/v1/scratch/change' });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ seq: before.seq + 1 });
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
