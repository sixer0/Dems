// The core unit inside the app factory, database-free (plan row W21; P25; decisions D20, D40):
// the three seams it fills, the clock, the boot steps it registers, and what closing the app
// does. The same against PostgreSQL: the `*.db.test.ts` files of this folder.
import { appendAudit, createManualClock, type AuditRow } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { BOOT_CHECK_IDS, BootCheckError } from '../../db/schema/boot-checks';
import { DB_CONTRACT_REVISION, DB_SCHEMA_VERSION } from '../../db/schema/meta';
import { captureLog, createFakePool, unitTestConfig } from '../../../test/support/config';
import { RUNTIME_SEARCH_PATH } from '../../plugins/db';
import { ApiFailure } from '../../plugins/error-envelope';
import { BootError } from '../../plugins/readiness';
import { createSystemClock, followClock, stampOf } from '../clock';
import { CoreError, PipelineFailure } from '../errors';
import { REPORTED_BOOT_CHECK } from '../index';
import { BOOT_CHECKS, CLOCK_START, GENESIS, answersBootStepOne, passedAmong, sleep, standInDatabase } from './support';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

function build(options: Parameters<typeof buildApp>[0]): FastifyInstance {
  const app = buildApp(options);
  apps.push(app);
  return app;
}

describe('the server clock (ENG-13 to ENG-16)', () => {
  it('the system clock never moves backwards, also when the wall clock is set back', () => {
    const wall = [1_000, 1_005, 900, 950, 1_005, 1_006];
    const clock = createSystemClock(() => wall.shift() ?? 2_000);
    expect([clock.now(), clock.now(), clock.now(), clock.now(), clock.now(), clock.now()]).toEqual([1_000, 1_005, 1_005, 1_005, 1_005, 1_006]);
    const real = createSystemClock();
    const before = Date.now();
    expect(real.now()).toBeGreaterThanOrEqual(before);
  });

  it('a clock that follows another reads it each time; a stamp is a whole number of milliseconds', () => {
    let current = createManualClock(10);
    const follower = followClock(() => current);
    expect(follower.now()).toBe(10);
    current = createManualClock(99);
    expect(follower.now()).toBe(99);
    expect(stampOf({ now: () => 1_790_823_600_000 })).toBe(1_790_823_600_000);
    for (const value of [1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) {
      expect(() => stampOf({ now: () => value })).toThrow(CoreError);
    }
  });
});

describe('the seams of the core unit (P25)', () => {
  it('clock, pipeline and auditWriter are provided; the plugin opens no connection', async () => {
    const database = standInDatabase();
    const app = build({ config: unitTestConfig(), createPool: () => database.pool });
    await app.ready();
    expect(app.seams.has('clock') && app.seams.has('pipeline') && app.seams.has('auditWriter')).toBe(true);
    expect(app.pipeline.snapshot()).toEqual({ accepting: true, running: null, pending: 0, completed: 0, failed: 0, timedOut: 0, refused: 0 });
    expect(typeof app.auditWriter.append).toBe('function');
    expect(database.connections.opened).toBe(0);
    expect(database.statements).toEqual([]);
  });

  it('the writers stamp with the clock that is in the seam when they are called, also one replaced after ready()', async () => {
    const database = standInDatabase();
    const app = build({ config: unitTestConfig(), createPool: () => database.pool });
    await app.ready();
    const clock = createManualClock(CLOCK_START);
    app.seams.replace('clock', clock);
    const first = await app.pipeline.run('test.clock', (unit) =>
      unit.audit.append({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'First', details: {} }),
    );
    clock.advance(5_000);
    const second = await app.pipeline.run('test.clock', async (unit) => {
      await app.auditWriter.append(unit, { type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'Second', details: {} });
      return unit.audit.appended()[0];
    });
    expect([first.at, second?.at]).toEqual([CLOCK_START, CLOCK_START + 5_000]);
    expect(second?.prevHash).toBe(first.hash);
  });

  it('a unit that cannot reach the database answers 503 and readiness follows the pool (ENG-5)', async () => {
    // The default test configuration points a real pool at a closed loopback port.
    const app = build({ config: unitTestConfig() });
    await app.ready();
    app.readiness.set('database', true);
    const error = await app.pipeline.run('test.offline', (unit) => unit.query('SELECT 1')).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'DATABASE_UNAVAILABLE' });
    for (let attempt = 0; attempt < 100 && app.readiness.snapshot().database; attempt += 1) await sleep(10);
    expect(app.readiness.snapshot().database).toBe(false);
  });

  it('closing the app closes the pipeline: a unit in flight ends first, a later one is refused', async () => {
    const database = standInDatabase();
    const app = buildApp({ config: unitTestConfig(), createPool: () => database.pool });
    await app.ready();
    const inFlight = app.pipeline.run('test.inFlight', async (unit) => {
      await sleep(20);
      return unit.audit.append({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'In flight', details: {} });
    });
    await sleep(1);
    await app.close();
    expect((await inFlight).seq).toBe(1);
    expect(database.committed.auditSeqs).toEqual([1]);
    expect(app.pipeline.snapshot()).toMatchObject({ accepting: false, completed: 1 });
    await expect(app.pipeline.run('test.late', async () => 1)).rejects.toMatchObject({ reason: 'CLOSED' });
  });
});

describe('a handler and its unit (spec §2.3 stages 8 and 9)', () => {
  /** An app with three scratch routes, every request stage passed: only the handler is under test. */
  async function handlerApp() {
    const database = standInDatabase();
    const log = captureLog();
    const app = build({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => database.pool, logStream: log.stream });
    app.post('/api/v1/scratch/commit', async () => {
      const row = await app.pipeline.run('test.commit', (unit) =>
        unit.audit.append({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'From a handler', details: {} }),
      );
      // The commit has happened when the handler continues: the row is in what is committed.
      return { seq: row.seq, committedBeforeTheAnswer: database.committed.auditSeqs.includes(row.seq) };
    });
    app.post('/api/v1/scratch/refuse', async () =>
      app.pipeline.run('test.refuse', async (unit) => {
        await unit.audit.append({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'Rolled back', details: {} });
        throw new ApiFailure(409, 'SESSION_ACTIVE', 'A session is already active.');
      }),
    );
    app.post('/api/v1/scratch/defect', async () =>
      app.pipeline.run('test.defect', (unit) =>
        unit.audit.append({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'A defect', details: { password: 'MARK-defect-6d0c' } }),
      ),
    );
    await app.ready();
    for (const stage of ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const) app.stages.replace(stage, () => {});
    return { app, database, log };
  }

  const body = (response: { json: () => unknown }) => response.json() as { error?: { code: string; message: string; details?: unknown }; seq?: number; committedBeforeTheAnswer?: boolean };

  it('the answer is sent after the commit; a refusal thrown in the unit is the answer and nothing is stored', async () => {
    const { app, database } = await handlerApp();
    const committed = await app.inject({ method: 'POST', url: '/api/v1/scratch/commit' });
    expect(committed.statusCode).toBe(200);
    expect(body(committed)).toEqual({ seq: 1, committedBeforeTheAnswer: true });

    const refused = await app.inject({ method: 'POST', url: '/api/v1/scratch/refuse' });
    expect(refused.statusCode).toBe(409);
    expect(body(refused).error?.code).toBe('SESSION_ACTIVE');
    expect(database.committed.auditSeqs).toEqual([1]);
  });

  it('a refusal of the pipeline is the envelope\'s 503 NOT_READY; a broken rule of the writers is 500 without a detail', async () => {
    const { app, database, log } = await handlerApp();
    await app.pipeline.close();
    const closed = await app.inject({ method: 'POST', url: '/api/v1/scratch/commit' });
    expect(closed.statusCode).toBe(503);
    expect(body(closed).error).toMatchObject({ code: 'NOT_READY', message: 'The server is not ready. Try again shortly.' });
    expect(body(closed).error).not.toHaveProperty('details');

    const other = await handlerApp();
    const defect = await other.app.inject({ method: 'POST', url: '/api/v1/scratch/defect' });
    expect(defect.statusCode).toBe(500);
    expect(body(defect).error).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(defect.body).not.toContain('MARK-defect-6d0c');
    expect(defect.body).not.toContain('AUDIT_DETAIL_KEY_FORBIDDEN');
    expect(other.database.statements).toEqual([]);
    // The log has the code of the rule, from the writer and from the error handler; never the value.
    expect(other.log.lines().filter((line) => line['msg'] === 'audit row refused')).toHaveLength(1);
    expect(other.log.text()).toContain('AUDIT_DETAIL_KEY_FORBIDDEN');
    expect(other.log.text()).not.toContain('MARK-defect-6d0c');
    expect(database.committed.auditSeqs).toEqual([]);
    expect(log.text()).not.toContain('MARK');
  });
});

describe('the boot steps the core unit registers (decision D40)', () => {
  it('are B-2 to B-9 of the migration row, B-8 the reported one', () => {
    expect([...BOOT_CHECK_IDS]).toEqual(['B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-8', 'B-9']);
    expect(REPORTED_BOOT_CHECK).toBe('B-8');
  });

  /**
   * A pool that answers every statement of the nine checks as a good database does. `chain`
   * is what the audit table holds. No database: the order of the steps and the behaviour of the
   * reported one are what is tested; the checks themselves are the migration row's.
   */
  function goodDatabase(chain: AuditRow[] = []): (text: string) => Promise<{ rows: unknown[] }> {
    const last = chain.at(-1);
    const stored = chain.map((row) => ({
      seq: String(row.seq),
      id: row.id,
      at: String(row.at),
      type: row.type,
      category: row.category,
      severity: row.severity,
      actor_id: row.actorId,
      message: row.message,
      session_id: row.sessionId,
      evidence_id: row.evidenceId,
      device_id: row.deviceId,
      details: row.details,
      prev_hash: row.prevHash,
      hash: row.hash,
    }));
    const answers: Array<[RegExp, unknown[]]> = [
      [/^SELECT 1$/, [{ one: 1 }]],
      // The second half of B-1 (finding F53): a pooled connection has the pinned search path.
      [/current_setting\('search_path'\)/, [{ search_path: RUNTIME_SEARCH_PATH }]],
      [/server_version_num/, [{ server_version_num: '180004' }]],
      [/server_encoding/, [{ server_encoding: 'UTF8' }]],
      [/FROM schema_meta/, [{ schema_version: DB_SCHEMA_VERSION, contract_revision: DB_CONTRACT_REVISION }]],
      [/rolname = current_user/, [{ rolname: 'dems_app', rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false }]],
      [/has_table_privilege/, Array.from({ length: 8 }, (_, index) => ({ object: `table ${index}`, privilege: 'UPDATE', granted: false }))],
      [/FROM pg_trigger/, ['audit_chain_history_append_only', 'audit_log_append_only', 'audit_log_chain_guard'].map((tgname) => ({ tgname, tgenabled: 'A' }))],
      [/FROM core_state/, [{ rows: '1' }]],
      [/FROM audit_chain_head h/, [{ seq: String(last?.seq ?? 0), hash: last?.hash ?? GENESIS, max_seq: last === undefined ? null : String(last.seq), last_hash: last?.hash ?? null }]],
      [/FROM audit_log ORDER BY seq DESC LIMIT \$1/, stored],
      [/FROM audit_chain_history/, []],
      [/WHERE rolname = \$1/, [{ rolsuper: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false }]],
      [/pg_get_userbyid\(datdba\)/, Array.from({ length: 6 }, (_, index) => ({ object: `object ${index}`, owner: 'dems_owner' }))],
    ];
    return async (text) => {
      const found = answers.find(([pattern]) => pattern.test(text));
      if (found === undefined) throw new Error('no canned answer for a statement of the boot checks');
      return { rows: found[1] };
    };
  }

  async function booted(answer: (text: string) => Promise<{ rows: unknown[] }>) {
    const log = captureLog();
    const app = build({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => createFakePool(answer).pool, logStream: log.stream });
    await app.ready();
    const error = await app.readiness.boot().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    // The nine checks only, in the order in which they passed: a step that another unit adds to
    // the boot does not change this list (finding CPB1-13).
    const passed = passedAmong(
      log
        .lines()
        .filter((line) => line['msg'] === 'boot step passed')
        .map((line) => line['step']),
      BOOT_CHECKS,
    );
    return { app, log, error, passed };
  }

  it('run in the order of the contract after B-1, B-8 between B-7 and B-9', async () => {
    const { error, passed, log } = await booted(goodDatabase());
    // The nine checks pass. The boot then stops at a step of another unit (today the engine
    // host's, plan row W26, which rehydrates from rows this stand-in does not hold): by design,
    // and that unit's to test. Here: none of the nine stopped it (finding CPB1-13).
    expect(error).toBeInstanceOf(BootError);
    expect(BOOT_CHECKS as readonly string[]).not.toContain((error as BootError).stepId);
    expect(passed).toEqual([...BOOT_CHECKS]);
    expect(log.lines().find((line) => line['msg'] === 'the stored audit chain verifies')).toMatchObject({ step: 'B-8', rowsChecked: 0, digests: 'ok', lineage: 'none' });
  });

  it('B-8 is reported and never blocks: a stored row with a wrong digest is one error line, and B-9 still runs', async () => {
    const MARK = 'MARK-stored-message-b2e4';
    const first = appendAudit({ rows: [], head: GENESIS, total: 0, dropped: 0 }, { type: 'SYSTEM_BOOT', message: 'Booted' }, CLOCK_START);
    const second = appendAudit(first.log, { type: 'SYSTEM_BOOT', message: 'Booted again' }, CLOCK_START);
    const altered: AuditRow = { ...second.row, message: MARK };
    const { error, passed, log } = await booted(goodDatabase([first.row, altered]));
    // Not B-8 and not B-9 stop the boot: it goes on to a step of another unit.
    expect(error).toBeInstanceOf(BootError);
    expect(BOOT_CHECKS as readonly string[]).not.toContain((error as BootError).stepId);
    expect(passed).toEqual([...BOOT_CHECKS]);
    expect(log.lines().find((line) => line['code'] === 'STORED_CHAIN_NOT_VERIFIED')).toMatchObject({
      level: 50,
      step: 'B-8',
      rowsChecked: 2,
      linkBreaks: 0,
      digests: 'failed',
      problems: ['the stored chain does not verify (HASH_MISMATCH at sequence 2).'],
    });
    expect(log.text()).not.toContain(MARK);
  });

  it('a blocking check that fails stops the boot there: B-6 on a database that is not seeded', async () => {
    const good = goodDatabase();
    const { error, passed, log } = await booted(async (text) => (/FROM core_state/.test(text) ? { rows: [{ rows: '0' }] } : good(text)));
    expect((error as BootError).stepId).toBe('B-6');
    expect(passed).toEqual(['B-1', 'B-2', 'B-3', 'B-4', 'B-5']);
    const line = log.lines().find((entry) => entry['msg'] === 'boot check failed');
    expect(line).toMatchObject({ step: 'B-6', code: 'BootCheckError' });
    expect(String(line?.['detail'])).toContain('npm run db:seed');
  });

  it('follow B-1: with a pool that answers no check, the boot stops at B-2 and the log names it', async () => {
    const log = captureLog();
    // By-design change (decision D87, finding F53): B-1 also reads the search path of a pooled
    // connection, so the stand-in answers B-1 as a database does, and none of the checks after it.
    const pool = createFakePool(async (text) => answersBootStepOne(text) ?? { rows: [] });
    const app = build({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => pool.pool, logStream: log.stream });
    await app.ready();
    const error = await app.readiness.boot().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe('B-2');
    expect((error as BootError).cause).toBeInstanceOf(BootCheckError);
    const lines = log.lines();
    expect(passedAmong(lines.filter((line) => line['msg'] === 'boot step passed').map((line) => line['step']), BOOT_CHECKS)).toEqual(['B-1']);
    expect(lines.find((line) => line['msg'] === 'boot check failed')).toMatchObject({
      level: 50,
      step: 'B-2',
      code: 'BootCheckError',
      detail: 'B-2: the server reports version number NaN; PostgreSQL 18 is expected.',
    });
    expect(app.readiness.isReady()).toBe(false);
  });

  it('a check that cannot be run at all (the database fails under it) is logged by the driver\'s code, without a text', async () => {
    const log = captureLog();
    const failing = Object.assign(new Error('MARK-driver-message-77aa'), { code: '57P01' });
    // By-design change (decision D87): the stand-in answers both halves of B-1, then fails.
    const pool = createFakePool(async (text) => {
      const answer = answersBootStepOne(text);
      if (answer !== undefined) return answer;
      throw failing;
    });
    const app = build({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => pool.pool, logStream: log.stream });
    await app.ready();
    const error = await app.readiness.boot().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect((error as BootError).stepId).toBe('B-2');
    const line = log.lines().find((entry) => entry['msg'] === 'boot check failed');
    expect(line).toMatchObject({ step: 'B-2', code: '57P01' });
    expect(line).not.toHaveProperty('detail');
    expect(log.text()).not.toContain('MARK-driver-message-77aa');
  });
});
