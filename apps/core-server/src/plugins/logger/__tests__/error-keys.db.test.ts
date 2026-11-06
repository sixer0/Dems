// An error of the real PostgreSQL in the log, under every key (checkpoint CP-B1, findings CPB1-2
// and CPB1-7; findings F38, F53): a statement of the query builder that the database refuses
// with a unique violation. The error a module gets from `unit.db` is the query builder's wrapper
// (statement and parameters as members) around the driver's error (the server's DETAIL quotes the
// key). It is logged under the key of the convention and under the keys a careless line would
// use; the captured log and the persistent error log hold the SQLSTATE and nothing of the
// statement, its parameters or the DETAIL.
//
// The same table with errors built from the installed classes, database-free: `error-keys.test.ts`.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DrizzleQueryError } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { DatabaseError } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { coreState, insertRbac, insertRow } from '../../../../test/db/fixtures';
import { useTestDatabase } from '../../../../test/helpers/db';
import { buildApp } from '../../../app';
import { engineCounters } from '../../../db/schema';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { describeError } from '../index';

const db = useTestDatabase({ template: 'schema' });
const scratch = mkdtempSync(join(tmpdir(), 'dems-cpb1a-keys-'));
const errorLogFile = join(scratch, 'errors.log');

/** A value of the refused row: it is a parameter of the statement, so it must not be in a log. */
const PARAMETER = 918_273_645;

let app: FastifyInstance;
let log: CapturedLog;
/** What `unit.db` threw: caught once, logged many times. */
let thrown: unknown;

beforeAll(async () => {
  const owner = db.ownerPool();
  await insertRbac(owner);
  await insertRow(owner, 'core_state', coreState());
  await insertRow(owner, 'engine_counters', { name: 'event', next_value: 1 });
  log = captureLog();
  app = buildApp({ config: unitTestConfig({ database: db.runtime, dataDir: db.run.dataDir, logLevel: 'trace' }), logStream: log.stream, errorLogFile });
  db.onCleanup(() => app.close());
  await app.ready();
  thrown = await app.pipeline
    .run('test.unique', (unit) => unit.db.insert(engineCounters).values({ name: 'event', nextValue: PARAMETER }))
    .then(
      () => null,
      (error: unknown) => error,
    );
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** The parts of the real error that must never be written. */
function leaks(text: string): string[] {
  const parts: Array<[string, string | RegExp]> = [
    ['the statement', 'engine_counters'],
    ['the wrapper message', 'Failed query'],
    ['the parameter', String(PARAMETER)],
    ['the DETAIL', /already exists|Key \(/],
    ['the driver message', 'duplicate key value'],
    ['the constraint', 'engine_counters_pkey'],
  ];
  return parts.filter(([, part]) => (typeof part === 'string' ? text.includes(part) : part.test(text))).map(([name]) => name);
}

describe('the premise: what the database and the query builder really throw', () => {
  it('a wrapper that holds the statement and its parameters, around the driver\'s error with SQLSTATE 23505 and a DETAIL', () => {
    expect(thrown).toBeInstanceOf(DrizzleQueryError);
    const wrapper = thrown as DrizzleQueryError;
    expect(wrapper.query).toContain('insert into "engine_counters"');
    expect(wrapper.params).toContain(PARAMETER);
    expect(wrapper.message).toContain(String(PARAMETER));
    expect(wrapper.cause).toBeInstanceOf(DatabaseError);
    const driver = wrapper.cause as DatabaseError;
    expect(driver.code).toBe('23505');
    expect(driver.detail).toMatch(/^Key \(name\)=\(event\) already exists\.$/);
    // So every search below can find something: serialised as it is, the error holds all of it.
    expect(leaks(JSON.stringify({ error: wrapper, message: wrapper.message })).sort()).toEqual(
      ['the DETAIL', 'the constraint', 'the parameter', 'the statement', 'the wrapper message'].sort(),
    );
  });
});

describe('logged under any key: the SQLSTATE, and nothing of the statement, its parameters or the DETAIL', () => {
  it.each([
    ['err', (error: unknown) => ({ err: error }), ['err']],
    ['error', (error: unknown) => ({ error }), ['error']],
    ['cause', (error: unknown) => ({ cause: error }), ['cause']],
    ['nested', (error: unknown) => ({ context: { failure: error } }), ['context', 'failure']],
    ['in a list', (error: unknown) => ({ failures: [error] }), ['failures', '0']],
    ['the driver\'s error alone', (error: unknown) => ({ reason: (error as Error).cause }), ['reason']],
  ] as const)('key %s', (name, build, path) => {
    const message = `logged under ${name}`;
    app.log.error(build(thrown), message);
    const line = log.lines().find((entry) => entry['msg'] === message);
    expect(line).toBeDefined();
    expect(leaks(JSON.stringify(line))).toEqual([]);
    const described = path.reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], line);
    expect(described).toMatchObject({ code: '23505', message: '23505' });
  });

  it('the description: the wrapper\'s name, the driver\'s SQLSTATE and name, and frames only', () => {
    const description = describeError(thrown);
    expect(description).toMatchObject({ errorName: 'Error', code: '23505', causeName: 'error' });
    expect(leaks(JSON.stringify(description))).toEqual([]);
    for (const line of String(description.stackTrace).split('\n')) expect(line).toMatch(/^\s+at .+/);
  });

  it('the pipeline\'s own line for that unit carries the SQLSTATE too', () => {
    expect(log.lines().find((line) => line['msg'] === 'unit rolled back' && line['label'] === 'test.unique')).toMatchObject({ code: '23505' });
  });

  it('as an unexpected failure of a request: 500 without a detail; the log and the persistent error log hold the SQLSTATE only', async () => {
    const own = captureLog();
    const dir = mkdtempSync(join(tmpdir(), 'dems-cpb1a-keys-req-'));
    const file = join(dir, 'errors.log');
    const second = buildApp({ config: unitTestConfig({ database: db.runtime, dataDir: db.run.dataDir, logLevel: 'info' }), logStream: own.stream, errorLogFile: file });
    db.onCleanup(() => second.close());
    second.post('/api/v1/scratch/unique', async () =>
      second.pipeline.run('test.uniqueRequest', (unit) => unit.db.insert(engineCounters).values({ name: 'event', nextValue: PARAMETER })),
    );
    await second.ready();
    for (const stage of ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const) second.stages.replace(stage, () => {});
    const response = await second.inject({ method: 'POST', url: '/api/v1/scratch/unique' });
    expect(response.statusCode).toBe(500);
    expect(leaks(response.body)).toEqual([]);

    const line = own.lines().find((entry) => entry['msg'] === 'unexpected error while handling a request');
    expect(line?.['err']).toMatchObject({ type: 'Error', code: '23505', causeType: 'error', message: '23505' });
    const persisted = readFileSync(file, 'utf8');
    expect(JSON.parse(persisted.split('\n')[0] ?? '{}')).toMatchObject({ source: 'error-envelope.errorHandler', errorName: 'Error', code: '23505', causeName: 'error' });
    expect(leaks(own.text() + persisted)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('the whole captured log of this file holds none of it', () => {
    expect(log.lines().length).toBeGreaterThan(6);
    expect(leaks(log.text())).toEqual([]);
  });
});
