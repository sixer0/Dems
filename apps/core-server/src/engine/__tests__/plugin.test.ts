// The engine unit in the app, without PostgreSQL (plan row W26; P25; decision D40): what the seam
// offers before a start, where the boot step stands, and what a database that cannot give a state
// does to a start. The engine on a real database is in the `*.db.test.ts` files of this folder.
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { PipelineFailure } from '../../core';
import { standInDatabase } from '../../../test/support/core';
import { captureLog, createFakePool, unitTestConfig } from '../../../test/support/config';
import { ApiFailure } from '../../plugins/error-envelope';
import { BootError } from '../../plugins/readiness';
import { EngineError } from '../errors';
import { ENGINE_BOOT_STEP, engineControl, type EngineHost } from '../index';
import { manualTimer } from './support';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function appWith(options: Partial<Parameters<typeof buildApp>[0]> = {}) {
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'debug' }), logStream: log.stream, createPool: () => createFakePool().pool, ...options });
  apps.push(app);
  await app.ready();
  return { app, log };
}

const rejection = (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => {
      throw new Error('the promise resolved; a rejection was expected');
    },
    (error: unknown) => error,
  );

const OPERATOR = { kind: 'OPERATOR', operatorId: 'OPR-001', sessionId: 's', deviceId: null, role: 'SUPERVISOR', permissions: [] } as const;

describe('the seam before a start', () => {
  it('app.engine is the host: stopped, epoch 0, revision 0; building the app opens no connection and schedules nothing', async () => {
    const fake = createFakePool();
    const { app } = await appWith({ createPool: () => fake.pool });
    const engine = engineControl(app);
    expect(engine).toBe(app.engine);
    expect(engine).toMatchObject({ running: false, epoch: 0, revision: 0 });
    expect(engine.stats()).toMatchObject({ phase: 'stopped', ticks: 0, commands: 0, publications: 0 });
    expect(engine.simulator()).toBeNull();
    expect(fake.queries).toEqual([]);
    expect(app.readiness.snapshot()).toEqual({ database: false, engine: false });
  });

  it('a command, a read and the tablet link answer 503 NOT_READY; nothing is submitted to the pipeline', async () => {
    const { app } = await appWith();
    const engine = app.engine;
    for (const work of [
      engine.command(OPERATOR, 'updateSettings', { timeFormat: '12' }),
      engine.run('test.unit', () => 1),
      engine.setTabletLink('CONNECTED'),
      engine.mirrorOperators(),
    ]) {
      const error = await rejection(work);
      expect(error).toBeInstanceOf(ApiFailure);
      expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    }
    expect(() => engine.state()).toThrow(ApiFailure);
    expect(() => engine.slice('session')).toThrow(ApiFailure);
    // The newest meter frame is a read like the state: the host has the member, and refuses while stopped.
    expect(() => engine.meters()).toThrow(expect.objectContaining({ statusCode: 503, code: 'NOT_READY' }));
    expect(app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 0, pending: 0, running: null });
  });

  it('stop on a host that never started does nothing, twice; closing the app submits no unit', async () => {
    const { app } = await appWith();
    await app.engine.stop();
    await app.engine.stop();
    await app.close();
    expect(app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 0 });
  });

  it('engineControl refuses an object that a test put behind the seam', async () => {
    const { app } = await appWith();
    app.seams.replace('engine', { epoch: 7, revision: 3 } as unknown as EngineHost);
    expect(() => engineControl(app)).toThrow('the seam was replaced');
    expect(app.engine.epoch).toBe(7);
  });
});

describe('the boot step', () => {
  it('is named engine.rehydrate and runs after the checks: a boot that stops at B-2 never reaches it', async () => {
    expect(ENGINE_BOOT_STEP).toBe('engine.rehydrate');
    // By-design change (decision D87, finding F53; fix round A of checkpoint CP-B1): boot step
    // B-1 also reads the search path of a pooled connection. The core's stand-in answers B-1 as a
    // database does and none of the checks after it, so the boot still stops at B-2.
    const { app, log } = await appWith({ createPool: () => standInDatabase().pool });
    const error = await rejection(app.readiness.boot());
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('B-2');
    expect(log.lines().some((line) => line['msg'] === 'engine not started' || line['msg'] === 'engine started')).toBe(false);
    expect(app.engine.running).toBe(false);
    expect(app.pipeline.snapshot()).toMatchObject({ completed: 0, failed: 0 });
  });

  it('a database that answers and holds no state: the start is refused by code, nothing is written, nothing is scheduled, the server stays not ready', async () => {
    const database = standInDatabase();
    const { app, log } = await appWith({ createPool: () => database.pool });
    const timer = manualTimer();
    engineControl(app).useTimer(timer.timer);

    const error = await rejection(app.engine.start('boot'));
    expect(error).toBeInstanceOf(EngineError);
    expect(error).toMatchObject({ code: 'ENGINE_STATE_UNREADABLE', detail: { rule: 'ROW_SHAPE' } });

    // The unit opened its transaction, read, and was rolled back: no statement that writes.
    // By-design change (decision D87; fix round A of checkpoint CP-B1): the third statement of a
    // unit also pins the search path. Its exact text is the core's to pin (`pipeline.test.ts`);
    // here: the transaction opens, the chain lock is taken, and the unit's settings follow.
    expect(database.statements.slice(0, 2)).toEqual(['BEGIN ISOLATION LEVEL READ COMMITTED', 'SELECT seq, hash FROM public.audit_chain_lock()']);
    expect(database.statements[2]).toMatch(/^SELECT set_config\('statement_timeout', \$1, true\)/);
    expect(database.statements.at(-1)).toBe('ROLLBACK');
    expect(database.statements.filter((text) => /^(insert|update|delete)/i.test(text))).toEqual([]);
    expect(database.connections).toMatchObject({ opened: 1, released: 1, destroyed: 0 });

    expect(app.engine.stats().phase).toBe('stopped');
    expect(app.readiness.snapshot().engine).toBe(false);
    expect(timer.registered()).toBe(0);
    const line = log.lines().find((entry) => entry['msg'] === 'engine not started');
    expect(line).toMatchObject({ level: 50, step: 'engine.rehydrate', mode: 'boot', code: 'ENGINE_STATE_UNREADABLE', rule: 'ROW_SHAPE' });

    // The host can be asked again: it is stopped, not broken.
    expect(await rejection(app.engine.start('boot'))).toMatchObject({ code: 'ENGINE_STATE_UNREADABLE' });
    expect(await rejection(app.engine.reload())).toMatchObject({ code: 'ENGINE_STATE_UNREADABLE' });
  });

  it('a database that does not answer: the start is the pipeline\'s own 503 NOT_READY, not a failed read of a table', async () => {
    const database = standInDatabase({ connectError: Object.assign(new Error('MARK-driver-text-0c4d'), { code: 'ECONNREFUSED' }) });
    const { app, log } = await appWith({ createPool: () => database.pool });
    const error = await rejection(app.engine.start('boot'));
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'DATABASE_UNAVAILABLE' });
    expect(log.lines().find((entry) => entry['msg'] === 'engine not started')).toMatchObject({ code: 'DATABASE_UNAVAILABLE', step: 'engine.rehydrate' });
    expect(log.text()).not.toContain('MARK-driver-text-0c4d');
    expect(app.engine.running).toBe(false);
    expect(app.readiness.snapshot().engine).toBe(false);
  });

  it('the timer is replaced only while the host is stopped, and a stopped host accepts it', async () => {
    const { app } = await appWith();
    const engine = engineControl(app);
    expect(() => engine.useTimer(manualTimer().timer)).not.toThrow();
    engine.fire();
    await engine.idle();
    await engine.settled();
    expect(engine.stats().ticks).toBe(0);
  });
});
