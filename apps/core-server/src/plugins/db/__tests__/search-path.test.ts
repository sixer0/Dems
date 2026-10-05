// The search path of the runtime pool, database-free (checkpoint CP-B1, finding CPB1-3; finding
// F53, decision D87): the start-up option every pooled connection is opened with, and the second
// half of boot step B-1, which reads the setting back and stops the boot when it is not exactly
// the pinned value. Against PostgreSQL: `search-path.db.test.ts`.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { captureLog, createFakePool, unitTestConfig } from '../../../../test/support/config';
import { describeError } from '../../logger';
import { BootError } from '../../readiness';
import {
  BOOT_STEP_DATABASE_ANSWERS,
  DatabaseBootError,
  RUNTIME_CONNECTION_OPTIONS,
  RUNTIME_SEARCH_PATH,
  SEARCH_PATH_NOT_PINNED,
  SEARCH_PATH_QUESTION,
  createRuntimePool,
} from '../index';

const apps: FastifyInstance[] = [];
const dirs: string[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** An app whose pool answers the probe, and the search-path question with `rows`. */
async function bootWith(answer: (text: string) => Promise<{ rows: unknown[] }>) {
  const log = captureLog();
  const dir = mkdtempSync(join(tmpdir(), 'dems-cpb1a-path-'));
  dirs.push(dir);
  const errorLogFile = join(dir, 'errors.log');
  const fake = createFakePool(answer);
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => fake.pool, logStream: log.stream, errorLogFile });
  apps.push(app);
  await app.ready();
  const error: unknown = await app.readiness.boot().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  const passed = log
    .lines()
    .filter((line) => line['msg'] === 'boot step passed')
    .map((line) => line['step']);
  const persisted = (): Array<Record<string, unknown>> => {
    try {
      return readFileSync(errorLogFile, 'utf8')
        .split('\n')
        .filter((row) => row !== '')
        .map((row) => JSON.parse(row) as Record<string, unknown>);
    } catch {
      return [];
    }
  };
  return { app, log, fake, error, passed, persisted };
}

const pathIs = (value: unknown) => async (text: string) => (text === SEARCH_PATH_QUESTION ? { rows: [{ search_path: value }] } : { rows: [] });

describe('the pinned value', () => {
  it('is the project schema, then the temporary schema, named so that it comes last', () => {
    expect(RUNTIME_SEARCH_PATH).toBe('public,pg_temp');
    expect(RUNTIME_SEARCH_PATH.split(',')).toEqual(['public', 'pg_temp']);
    // The start-up option is split at white space by the server: the value holds none.
    expect(RUNTIME_SEARCH_PATH).not.toMatch(/\s/);
    expect(RUNTIME_CONNECTION_OPTIONS).toBe('-c search_path=public,pg_temp');
    expect(SEARCH_PATH_QUESTION).toBe("SELECT current_setting('search_path') AS search_path");
  });

  it('is an option of every connection the runtime pool opens', async () => {
    const pool = createRuntimePool(unitTestConfig().database);
    // Written out: this must not pass by comparing two values that are both missing.
    expect(pool.options.options).toBe('-c search_path=public,pg_temp');
    expect(RUNTIME_CONNECTION_OPTIONS).toBe(pool.options.options);
    await pool.end();
  });
});

describe('boot step B-1, second half: a pooled connection has exactly the pinned search path', () => {
  it('passes when it has: the boot goes on to B-2, and B-1 is two statements', async () => {
    const { error, passed, fake, log } = await bootWith(pathIs(RUNTIME_SEARCH_PATH));
    expect((error as BootError).stepId).toBe('B-2');
    expect(passed).toEqual([BOOT_STEP_DATABASE_ANSWERS]);
    expect(fake.queries.slice(0, 2)).toEqual(['SELECT 1', SEARCH_PATH_QUESTION]);
    expect(log.lines().some((line) => line['code'] === SEARCH_PATH_NOT_PINNED)).toBe(false);
  });

  it.each([
    ['the default of PostgreSQL', '"$user", public'],
    ['the temporary schema first', 'pg_temp,public'],
    ['the same schemas with a space', 'public, pg_temp'],
    ['only the project schema', 'public'],
    ['another schema before it', 'other,public,pg_temp'],
    ['an empty path', ''],
  ])('%s (%s): the boot stops at B-1 with the code SEARCH_PATH_NOT_PINNED', async (_name, found) => {
    const { app, error, passed, log, persisted } = await bootWith(pathIs(found));
    expect(error).toBeInstanceOf(BootError);
    expect((error as BootError).stepId).toBe(BOOT_STEP_DATABASE_ANSWERS);
    const cause = (error as BootError).cause;
    expect(cause).toBeInstanceOf(DatabaseBootError);
    expect(cause).toMatchObject({ name: 'DatabaseBootError', code: SEARCH_PATH_NOT_PINNED });
    expect(passed).toEqual([]);
    // The entry point logs the BootError under `err`: the code is found down its cause.
    expect(describeError(error)).toMatchObject({ errorName: 'BootError', code: SEARCH_PATH_NOT_PINNED, causeName: 'DatabaseBootError' });
    expect(log.lines().find((line) => line['msg'] === 'boot check failed')).toMatchObject({
      level: 50,
      step: 'B-1',
      code: SEARCH_PATH_NOT_PINNED,
      expected: 'public,pg_temp',
      found,
    });
    expect(persisted()).toHaveLength(1);
    expect(persisted()[0]).toMatchObject({
      level: 'fatal',
      source: 'db.boot',
      code: SEARCH_PATH_NOT_PINNED,
      context: { step: 'B-1', database: 'dems_unit_test', generation: 1, expected: 'public,pg_temp', found },
    });
    expect(String(persisted()[0]?.['message'])).toContain('createRuntimePool');
    expect(app.readiness.isReady()).toBe(false);
  });

  it('a pool that gives no row, or a value that is not a text: refused the same way, with nothing found', async () => {
    for (const answer of [async () => ({ rows: [] as unknown[] }), pathIs(undefined), pathIs(null), pathIs(['public', 'pg_temp'])]) {
      const { error, log } = await bootWith(answer);
      expect((error as BootError).stepId).toBe('B-1');
      expect((error as BootError).cause).toMatchObject({ code: SEARCH_PATH_NOT_PINNED });
      expect(log.lines().find((line) => line['msg'] === 'boot check failed')).toMatchObject({ step: 'B-1', found: null });
    }
  });

  it('a long value is cut in the log', async () => {
    const { log } = await bootWith(pathIs(`public,${'x'.repeat(500)}`));
    expect(String(log.lines().find((line) => line['msg'] === 'boot check failed')?.['found'])).toHaveLength(120);
  });

  it('the question itself fails: B-1 fails as "the database does not answer", by the driver\'s code', async () => {
    const MARK = 'MARK-driver-text-a91c';
    const { app, error, passed, log } = await bootWith(async (text) => {
      if (text === SEARCH_PATH_QUESTION) throw Object.assign(new Error(`terminating connection ${MARK}`), { code: '57P01' });
      return { rows: [] };
    });
    expect((error as BootError).stepId).toBe('B-1');
    expect((error as BootError).cause).not.toBeInstanceOf(DatabaseBootError);
    expect(describeError(error)).toMatchObject({ code: '57P01' });
    expect(passed).toEqual([]);
    expect(app.readiness.snapshot().database).toBe(false);
    expect(log.lines().find((line) => line['msg'] === 'the database does not answer')).toMatchObject({ code: '57P01' });
    expect(log.text()).not.toContain(MARK);
  });
});
