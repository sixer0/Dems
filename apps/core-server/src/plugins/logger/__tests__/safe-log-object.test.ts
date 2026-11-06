// `safeLogObject`, `loggedError` and `codedCauseOf` (checkpoint CP-B1, findings CPB1-2 and
// CPB1-7): the function that makes the object of a log line safe before it is serialised, its
// limits, and the one walk over a `cause` chain that the logger folder exports.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import {
  CAUSE_CHAIN_DEPTH,
  LOG_DEPTH_LIMIT,
  LOG_MEMBER_LIMIT,
  NOT_LOGGED,
  buildLoggerOptions,
  codedCauseOf,
  createErrorLog,
  describeError,
  loggedError,
  safeLogObject,
} from '../index';

const SECRET = 'MARK-secret-in-an-error-4c7a';

function driverError(code = '23505'): DatabaseError {
  return Object.assign(new DatabaseError(`refused ${SECRET}`, 10, 'error'), { code, detail: `Key (hash)=(${SECRET})` });
}

const wrapped = (): DrizzleQueryError => new DrizzleQueryError(`select '${SECRET}'`, [SECRET], driverError());

describe('loggedError', () => {
  it('is what the err serializer writes: type, code, message (the code or the name) and the frames', () => {
    const description = loggedError(wrapped());
    expect(description).toMatchObject({ type: 'Error', code: '23505', causeType: 'error', message: '23505' });
    expect(description.stack).toContain('safe-log-object.test.ts');
    expect(JSON.stringify(description)).not.toContain(SECRET);
    expect(loggedError(new TypeError(SECRET))).toMatchObject({ type: 'TypeError', code: undefined, message: 'TypeError' });
    expect(loggedError('not an error')).toEqual({ type: 'string', code: undefined, message: 'string', stack: '' });
    expect(buildLoggerOptions({ level: 'info' }).serializers?.['err']).toBe(loggedError);
  });
});

describe('safeLogObject', () => {
  it('returns the same object when it holds no error, and never changes the object it was given', () => {
    const clean = { unit: 1, label: 'x', nested: { list: [1, 'two', { three: 3 }], at: new Date(0) }, nothing: null, missing: undefined };
    expect(safeLogObject(clean)).toBe(clean);

    const error = wrapped();
    const inner = { failure: error, kept: 'as it is' };
    const given = { context: inner, list: [error], code: 'X' };
    const safe = safeLogObject(given) as Record<string, unknown>;
    expect(safe).not.toBe(given);
    // The caller's objects still hold the error: nothing was replaced in place.
    expect(given.context).toBe(inner);
    expect(inner.failure).toBe(error);
    expect(given.list[0]).toBe(error);
    expect(JSON.stringify(safe)).not.toContain(SECRET);
    expect(safe).toMatchObject({ code: 'X', context: { kept: 'as it is', failure: { code: '23505' } }, list: [{ code: '23505' }] });
  });

  it('leaves req, res and err at the top to their serializers, and nowhere else', () => {
    const error = wrapped();
    const marker = { raw: 'a request object' };
    const safe = safeLogObject({ err: error, req: marker, res: marker, nested: { err: error, req: { inner: error } } }) as Record<string, unknown>;
    expect(safe['err']).toBe(error);
    expect(safe['req']).toBe(marker);
    expect(safe['res']).toBe(marker);
    expect(safe['nested']).toMatchObject({ err: { code: '23505', type: 'Error' }, req: { inner: { code: '23505' } } });
  });

  it('describes an error at any depth it reads, and does not write what lies deeper than the limit', () => {
    let deep: Record<string, unknown> = { failure: wrapped(), leaf: SECRET };
    for (let level = 0; level < LOG_DEPTH_LIMIT + 3; level += 1) deep = { next: deep };
    const safe = safeLogObject({ deep });
    const text = JSON.stringify(safe);
    expect(text).not.toContain(SECRET);
    expect(text).toContain(NOT_LOGGED);

    // At the limit itself an object is still read.
    let atLimit: Record<string, unknown> = { failure: wrapped() };
    for (let level = 0; level < LOG_DEPTH_LIMIT - 1; level += 1) atLimit = { next: atLimit };
    const read = JSON.stringify(safeLogObject({ atLimit }));
    expect(read).not.toContain(SECRET);
    expect(read).toContain('23505');
    expect(read).not.toContain(NOT_LOGGED);
  });

  it('a structure that refers to itself ends', () => {
    const loop: Record<string, unknown> = { failure: wrapped() };
    loop['self'] = loop;
    const safe = safeLogObject({ loop });
    expect(JSON.stringify(safe)).not.toContain(SECRET);
    expect(JSON.stringify(safe)).toContain(NOT_LOGGED);
  });

  it('a container with more members than the limit is not written, so nothing unread is', () => {
    const many = Array.from({ length: LOG_MEMBER_LIMIT + 5 }, (_, index) => index);
    const safe = safeLogObject({ many, after: { failure: wrapped() } }) as Record<string, unknown>;
    expect(safe['many']).toBe(NOT_LOGGED);
    expect(safe['after']).toBe(NOT_LOGGED);
    expect(JSON.stringify(safe)).not.toContain(SECRET);
    // A list of ordinary size is written as it is.
    const some = Array.from({ length: 50 }, (_, index) => index);
    expect((safeLogObject({ some }) as { some: unknown }).some).toBe(some);
  });

  it('reads what an object gives as its JSON form, and a member that throws is not written', () => {
    const error = wrapped();
    const withJson = { toJSON: () => ({ inner: error }) };
    const throwing = Object.defineProperty({}, 'boom', {
      enumerable: true,
      get(): never {
        throw new Error(SECRET);
      },
    });
    const safe = safeLogObject({ withJson, throwing, when: new Date(0) }) as Record<string, unknown>;
    expect(safe['withJson']).toMatchObject({ inner: { code: '23505' } });
    expect(safe['throwing']).toBe(NOT_LOGGED);
    expect(JSON.stringify(safe)).toContain('1970-01-01T00:00:00.000Z');
    expect(JSON.stringify(safe)).not.toContain(SECRET);
  });

  it('an object that is not plain is read like the serialiser reads it: its own members', () => {
    class Outcome {
      readonly ok = false;
      readonly failure = wrapped();
    }
    const safe = safeLogObject({ outcome: new Outcome(), map: new Map([['k', wrapped()]]) }) as Record<string, unknown>;
    expect(safe['outcome']).toMatchObject({ ok: false, failure: { code: '23505' } });
    expect(JSON.stringify(safe)).not.toContain(SECRET);
  });
});

describe('through the logger', () => {
  it('a line at every level, and a line of a request, are written safe', async () => {
    const captured = captureLog();
    const app = buildApp({ config: unitTestConfig({ logLevel: 'trace' }), logStream: captured.stream });
    app.get('/api/v1/logs', async (request) => {
      request.log.info({ error: wrapped(), source: 'a handler' }, 'from a request');
      return {};
    });
    await app.ready();
    for (const stage of ['readiness', 'originGuard', 'authenticate', 'throttle', 'accessRule'] as const) app.stages.replace(stage, () => {});
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const) app.log[level]({ error: wrapped(), cause: driverError() }, `at ${level}`);
    expect((await app.inject({ method: 'GET', url: '/api/v1/logs' })).statusCode).toBe(200);
    await app.close();

    const lines = captured.lines();
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) {
      expect(lines.find((line) => line['msg'] === `at ${level}`)).toMatchObject({ error: { code: '23505' }, cause: { code: '23505', type: 'error' } });
    }
    const fromRequest = lines.find((line) => line['msg'] === 'from a request');
    expect(fromRequest).toMatchObject({ source: 'a handler', error: { code: '23505', type: 'Error', causeType: 'error' } });
    expect(typeof fromRequest?.['reqId']).toBe('string');
    expect(captured.text()).not.toContain(SECRET);
  });

  it('the persistent error log gets the code and the name of the cause, and nothing of the error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dems-cpb1a-log-'));
    try {
      const file = join(dir, 'errors.log');
      const errorLog = createErrorLog(file);
      errorLog.append({ level: 'error', source: 'test.read', message: 'a fixed text', ...describeError(wrapped()), context: { unit: 3 } });
      const text = readFileSync(file, 'utf8');
      expect(text).not.toContain(SECRET);
      expect(JSON.parse(text)).toMatchObject({
        level: 'error',
        source: 'test.read',
        message: 'a fixed text',
        errorName: 'Error',
        code: '23505',
        causeName: 'error',
        context: { unit: 3 },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('codedCauseOf: the one walk over a cause chain', () => {
  it('gives the error that carries the code, its code and how far down it was', () => {
    const driver = driverError('40001');
    const error = new DrizzleQueryError('select 1', [], driver);
    expect(codedCauseOf(error)).toEqual({ error: driver, code: '40001', depth: 1 });
    expect(codedCauseOf(driver)).toEqual({ error: driver, code: '40001', depth: 0 });
    expect(codedCauseOf(new Error('none'))).toBeUndefined();
    expect(codedCauseOf(undefined)).toBeUndefined();
    expect(codedCauseOf('text')).toBeUndefined();
    expect(codedCauseOf(null)).toBeUndefined();
  });

  it('reads at most CAUSE_CHAIN_DEPTH errors', () => {
    expect(CAUSE_CHAIN_DEPTH).toBe(4);
    let error: Error = driverError();
    for (let level = 0; level < CAUSE_CHAIN_DEPTH - 1; level += 1) error = new Error('wrap', { cause: error });
    expect(codedCauseOf(error)).toMatchObject({ code: '23505', depth: CAUSE_CHAIN_DEPTH - 1 });
    expect(codedCauseOf(new Error('one more', { cause: error }))).toBeUndefined();
  });
});
