// A connection that is lost in the middle of a unit of work, database-free (checkpoint CP-B1,
// finding CPB1-6; spec §2.3 stage 9, ENG-5): the unit answers 503 `NOT_READY`, nothing of it is
// stored, its connection never goes back to the pool, and readiness is set off until a probe
// succeeds.
//
// The connection is a stand-in whose statements reject with the shapes the driver produces: an
// SQLSTATE of the connection class, a socket error, and the driver's own error without a code
// together with the `error` event of the client. What was provoked against the real server is in
// `connection-lost.db.test.ts`.
import { createManualClock } from '@dems/shared/sim';
import { DrizzleQueryError } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { auditChainHead } from '../../db/schema';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { ApiFailure } from '../../plugins/error-envelope';
import { PipelineFailure, isConnectionFailure, isConnectionFailureCode } from '../errors';
import { createPipeline } from '../pipeline';
import { CLOCK_START, recordingErrorLog, standInDatabase, testLogger, type StandInOptions } from './support';

const logger = testLogger('trace');
afterAll(() => logger.close());

const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

const caught = <T>(work: Promise<T>): Promise<unknown> =>
  work.then(
    () => null,
    (error: unknown) => error,
  );

const entry = (message: string) => ({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message, details: {} }) as const;

const MARK = 'MARK-driver-text-5e1b';
const coded = (code: string): Error => Object.assign(new Error(`${MARK} ${code}`), { code });

function rig(options: StandInOptions = {}) {
  const database = standInDatabase(options);
  const errorLog = recordingErrorLog();
  const told: string[] = [];
  const from = logger.captured.lines().length;
  const pipeline = createPipeline({
    pool: () => database.pool,
    clock: createManualClock(CLOCK_START),
    log: logger.log,
    errorLog,
    onConnectionLost: () => void told.push('lost'),
    onDatabaseFailure: () => void told.push('failure'),
  });
  return { database, pipeline, errorLog, told, lines: () => logger.captured.lines().slice(from) };
}

/** The connection class: SQLSTATE class 08, the three codes of a server that goes away, the socket. */
const CONNECTION_CODES = ['08000', '08003', '08006', '08001', '08004', '08007', '08P01', '57P01', '57P02', '57P03', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTCONN'];
/** Failures of a statement that say nothing about the connection. */
const STATEMENT_CODES = ['22012', '23505', '23503', '40001', '40P01', '42P01', '25P02', '53300', '57000', 'ZA001', 'ERR_INVALID_ARG_TYPE'];

describe('which failures mean that the connection or the server went away', () => {
  it('SQLSTATE class 08, 57P01 to 57P03 and the socket errors of the driver; nothing else', () => {
    for (const code of CONNECTION_CODES) {
      expect(isConnectionFailureCode(code), code).toBe(true);
      expect(isConnectionFailure(coded(code)), code).toBe(true);
      // Also when the query builder wrapped it.
      expect(isConnectionFailure(new DrizzleQueryError('select 1', [], coded(code))), code).toBe(true);
    }
    for (const code of [...STATEMENT_CODES, '57014', '08', '0800', '080061', 'econnreset']) {
      expect(isConnectionFailureCode(code), code).toBe(false);
    }
    expect(isConnectionFailureCode(undefined)).toBe(false);
    expect(isConnectionFailure(new Error('Connection terminated unexpectedly'))).toBe(false);
    expect(isConnectionFailure(undefined)).toBe(false);
  });
});

describe('a statement of a unit fails with a code of the connection class', () => {
  it.each(CONNECTION_CODES)('%s: 503 DATABASE_UNAVAILABLE with the driver\'s error as cause; readiness is told; the connection is closed', async (code) => {
    const failure = coded(code);
    const { pipeline, database, told, errorLog, lines } = rig({ failOn: (text) => (text.startsWith('UPDATE public.operators') ? failure : undefined) });
    const error = await caught(
      pipeline.run('test.lost', async (unit) => {
        await unit.audit.append(entry('Written before the connection went away'));
        await unit.query('UPDATE public.operators SET enabled = false WHERE id = $1', ['OPR-003']);
      }),
    );
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'DATABASE_UNAVAILABLE' });
    expect((error as PipelineFailure).cause).toBe(failure);
    expect(told).toEqual(['lost', 'failure']);
    // Nothing is said to a connection that is gone, and it does not go back to the pool.
    expect(database.statements).not.toContain('COMMIT');
    expect(database.statements).not.toContain('ROLLBACK');
    expect(database.connections).toEqual({ opened: 1, released: 0, destroyed: 1 });
    expect(database.committed.auditSeqs).toEqual([]);
    // One error line and one persistent entry, by the two codes; never the driver's text.
    const line = lines().find((candidate) => candidate['msg'] === 'unit not committed');
    expect(line).toMatchObject({ level: 50, label: 'test.lost', code: 'DATABASE_UNAVAILABLE', cause: code });
    expect(errorLog.entries).toHaveLength(1);
    expect(errorLog.entries[0]).toMatchObject({ level: 'error', source: 'core.pipeline', code, context: { label: 'test.lost', reason: 'DATABASE_UNAVAILABLE' } });
    expect(JSON.stringify([lines(), errorLog.entries])).not.toContain(MARK);
    expect(pipeline.snapshot()).toMatchObject({ failed: 1, completed: 0, timedOut: 0 });
  });

  it('through the query builder: the caller of the unit gets the 503, not the wrapper that quotes the statement', async () => {
    const failure = coded('57P01');
    const { pipeline, told } = rig({ failOn: (text) => (text.startsWith('select ') ? failure : undefined) });
    const error = await caught(pipeline.run('test.builder', (unit) => unit.db.select().from(auditChainHead)));
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, reason: 'DATABASE_UNAVAILABLE' });
    expect((error as PipelineFailure).cause).toBe(failure);
    expect(String((error as Error).message)).not.toContain('Failed query');
    expect(told).toEqual(['lost', 'failure']);
  });

  it('the work caught the failure and returned, or threw a refusal of its own: the answer is still 503', async () => {
    const failure = coded('08006');
    const returned = rig({ failOn: (text) => (text === 'SELECT 1' ? failure : undefined) });
    const afterReturn = await caught(
      returned.pipeline.run('test.swallowed', async (unit) => {
        await unit.query('SELECT 1').catch(() => undefined);
        return 'the work returned normally';
      }),
    );
    expect(afterReturn).toMatchObject({ statusCode: 503, reason: 'DATABASE_UNAVAILABLE' });
    expect((afterReturn as PipelineFailure).cause).toBe(failure);

    const refused = rig({ failOn: (text) => (text === 'SELECT 1' ? failure : undefined) });
    const afterRefusal = await caught(
      refused.pipeline.run('test.refused', async (unit) => {
        const found = await unit.query('SELECT 1').catch(() => ({ rowCount: 0 }));
        if (found.rowCount === 0) throw new ApiFailure(409, 'DEVICE_NOT_PAIRED', 'The device is not paired.');
      }),
    );
    // The 409 was decided on a statement that never answered: it is not what the caller is told.
    expect(afterRefusal).toBeInstanceOf(PipelineFailure);
    expect(afterRefusal).toMatchObject({ statusCode: 503, reason: 'DATABASE_UNAVAILABLE' });
    expect(refused.told).toEqual(['lost', 'failure']);
  });
});

describe('the connection reports an error while the unit holds it', () => {
  it('the driver\'s error without a code, as a closed socket gives it: 503, whatever the statement then rejects with', async () => {
    const terminated = new Error(`Connection terminated unexpectedly ${MARK}`);
    const { pipeline, database, told, lines } = rig({ failOn: (text) => (text === 'SELECT 2' ? terminated : undefined) });
    const error = await caught(
      pipeline.run('test.socket', async (unit) => {
        await unit.query('SELECT 1');
        // The driver emits `error` on the client first and rejects the statement in the next turn.
        database.breakConnection(terminated);
        await unit.query('SELECT 2');
      }),
    );
    expect(error).toMatchObject({ statusCode: 503, reason: 'DATABASE_UNAVAILABLE' });
    expect((error as PipelineFailure).cause).toBe(terminated);
    expect(told).toEqual(['lost', 'failure']);
    expect(database.connections).toEqual({ opened: 1, released: 0, destroyed: 1 });
    // No code: the line names the error.
    expect(lines().find((candidate) => candidate['msg'] === 'unit not committed')).toMatchObject({ code: 'DATABASE_UNAVAILABLE', cause: 'Error' });
    expect(JSON.stringify(lines())).not.toContain(MARK);
  });

  it('between two statements, and the work returns: no COMMIT is sent, 503', async () => {
    const { pipeline, database, told } = rig();
    const lost = coded('57P01');
    const error = await caught(
      pipeline.run('test.idle', async (unit) => {
        await unit.audit.append(entry('Before the connection was lost'));
        database.breakConnection(lost);
        return 'returned';
      }),
    );
    expect(error).toMatchObject({ statusCode: 503, reason: 'DATABASE_UNAVAILABLE' });
    expect((error as PipelineFailure).cause).toBe(lost);
    expect(told).toEqual(['lost', 'failure']);
    expect(database.statements).not.toContain('COMMIT');
    expect(database.connections.destroyed).toBe(1);
  });
});

describe('what stays as it was', () => {
  it.each(STATEMENT_CODES)('a statement that fails with %s is the caller\'s failure: the same error, a rollback, readiness is not told', async (code) => {
    const failure = coded(code);
    const { pipeline, database, told } = rig({ failOn: (text) => (text === 'SELECT 1' ? failure : undefined) });
    const error = await caught(pipeline.run('test.statement', (unit) => unit.query('SELECT 1')));
    expect(error).toBe(failure);
    expect(told).toEqual([]);
    expect(database.statements.at(-1)).toBe('ROLLBACK');
    expect(database.connections).toEqual({ opened: 1, released: 1, destroyed: 0 });
  });

  it('a failure without a code and without an error of the connection (a value the driver cannot send) is not a loss', async () => {
    const failure = new TypeError('the driver could not serialise a value');
    const { pipeline, told } = rig({ failOn: (text) => (text === 'SELECT $1' ? failure : undefined) });
    expect(await caught(pipeline.run('test.bind', (unit) => unit.query('SELECT $1', [1])))).toBe(failure);
    expect(told).toEqual([]);
  });

  it('what the work throws without any failed statement reaches the caller as it is', async () => {
    const { pipeline, told } = rig();
    const refusal = new ApiFailure(409, 'LAST_ADMIN', 'At least one administrator must remain.');
    expect(
      await caught(
        pipeline.run('test.refusal', async (unit) => {
          await unit.query('SELECT 1');
          throw refusal;
        }),
      ),
    ).toBe(refusal);
    expect(told).toEqual([]);
  });

  it('the statement limit of the unit (57014) is still the time-out refusal, and no connection at the start is still told once', async () => {
    const cancelled = rig({ failOn: (text) => (text.includes('pg_sleep') ? coded('57014') : undefined) });
    expect(await caught(cancelled.pipeline.run('test.cancelled', (unit) => unit.query('SELECT pg_sleep(60)')))).toMatchObject({ reason: 'UNIT_TIMEOUT' });
    expect(cancelled.told).toEqual([]);

    const offline = rig({ connectError: coded('ECONNREFUSED') });
    expect(await caught(offline.pipeline.run('test.offline', (unit) => unit.query('SELECT 1')))).toMatchObject({ reason: 'DATABASE_UNAVAILABLE' });
    // The unit never held a connection: nothing was lost, the failure is told as before.
    expect(offline.told).toEqual(['failure']);
  });
});

describe('in the app: the answer and readiness', () => {
  async function appOn(options: StandInOptions) {
    const database = standInDatabase(options);
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => database.pool, logStream: log.stream });
    apps.push(app);
    app.post('/api/v1/scratch/change', async () =>
      app.pipeline.run('test.change', async (unit) => {
        await unit.audit.append(entry('A change'));
        await unit.query('UPDATE public.operators SET enabled = false WHERE id = $1', ['OPR-003']);
        return { ok: true };
      }),
    );
    await app.ready();
    for (const stage of ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const) app.stages.replace(stage, () => {});
    const readinessLines = (): unknown[] =>
      log
        .lines()
        .filter((line) => line['msg'] === 'readiness changed' && line['part'] === 'database')
        .map((line) => line['ready']);
    return { app, database, log, readinessLines };
  }

  it('the request answers 503 NOT_READY, not 500; the flag goes off at once and on again when the next probe succeeds', async () => {
    let lose = true;
    const { app, log, readinessLines } = await appOn({ failOn: (text) => (lose && text.startsWith('UPDATE public.operators') ? coded('57P01') : undefined) });
    expect(await app.db.probe({ fresh: true })).toBe(true);
    expect(readinessLines()).toEqual([true]);

    const response = await app.inject({ method: 'POST', url: '/api/v1/scratch/change' });
    expect(response.statusCode).toBe(503);
    expect((response.json() as { error: { code: string } }).error.code).toBe('NOT_READY');
    // Off at the loss; the probe that was started with it has set it on again: the database answers.
    expect(await app.db.probe({ fresh: true })).toBe(true);
    expect(readinessLines()).toEqual([true, false, true]);
    expect(app.readiness.snapshot().database).toBe(true);
    // No "unexpected error" entry with a stack: this is not a defect of the server.
    expect(log.lines().some((line) => line['msg'] === 'unexpected error while handling a request')).toBe(false);
    expect(log.lines().find((line) => line['msg'] === 'request completed')).toMatchObject({ status: 503, code: 'NOT_READY' });
    expect(log.text()).not.toContain(MARK);

    // The next unit takes a new connection and commits.
    lose = false;
    expect((await app.inject({ method: 'POST', url: '/api/v1/scratch/change' })).statusCode).toBe(200);
  });

  it('while the database stays away the flag stays off', async () => {
    let down = false;
    const { app, readinessLines } = await appOn({
      failOn: (text) => (down && text.startsWith('UPDATE public.operators') ? coded('08006') : undefined),
      failOnPool: () => (down ? coded('ECONNREFUSED') : undefined),
    });
    expect(await app.db.probe({ fresh: true })).toBe(true);
    down = true;
    expect((await app.inject({ method: 'POST', url: '/api/v1/scratch/change' })).statusCode).toBe(503);
    // No earlier probe result is reused after a loss: the answer of a moment ago does not count.
    expect(await app.db.probe()).toBe(false);
    expect(await app.db.probe({ fresh: true })).toBe(false);
    expect(readinessLines()).toEqual([true, false]);
    expect(app.readiness.snapshot().database).toBe(false);
    down = false;
    expect(await app.db.probe({ fresh: true })).toBe(true);
    expect(readinessLines()).toEqual([true, false, true]);
  });
});
