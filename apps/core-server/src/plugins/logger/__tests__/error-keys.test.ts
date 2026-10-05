// An error in a log line is safe at EVERY key (checkpoint CP-B1, findings CPB1-2, CPB1-7 and
// CPB1-23; SR-48, SR-50; findings F38, F53).
//
// The query builder wraps what the driver throws in an error that holds the statement, its
// parameters and the driver's error as plain members, and the driver's error holds the server's
// DETAIL, HINT and WHERE. A serialiser that is given such an error under a key it does not know
// writes all of it. The table below logs one such error, built with the installed classes, under
// the key of the convention and under the keys a careless line would use, and searches the
// captured log for every part of it.
//
// The table uses only what the logger offered before this fix (`buildApp`, `describeError`), so
// that it fails on the old code by its assertions and not by a missing export.
import { DrizzleQueryError } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { DatabaseError } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { describeError } from '../index';

const MARK = {
  statement: 'MARK-statement-51c0',
  statementLine: 'MARK-statement-line-77e2',
  parameter: 'MARK-parameter-0fa9',
  wrapperMessage: 'Failed query',
  driverMessage: 'MARK-driver-message-3b6d',
  detail: 'MARK-detail-c41e',
  hint: 'MARK-hint-9d02',
  where: 'MARK-where-6a15',
  internalQuery: 'MARK-internal-query-e8b3',
} as const;

/**
 * A statement of several lines. Its second line has the form of a stack frame: a filter that
 * keeps "every line that starts with white space and `at`" would keep it (CPB1-23).
 */
const STATEMENT = `insert into "device_credentials" ("id", "current_hash") values ($1, $2) /* ${MARK.statement} */\n    at ${MARK.statementLine} (statement.sql:1:1)`;
const PARAMETERS = ['DVC-000001', `\\x${MARK.parameter}`];

/** What the driver throws for a unique violation: the installed class, with the server's fields. */
function driverError(): DatabaseError {
  const error = new DatabaseError(`duplicate key value violates unique constraint "x" ${MARK.driverMessage}`, 180, 'error');
  return Object.assign(error, {
    severity: 'ERROR',
    code: '23505',
    detail: `Key (current_hash)=(\\x${MARK.detail}) already exists.`,
    hint: `See ${MARK.hint}.`,
    where: `SQL statement ${MARK.where}`,
    internalQuery: `select ${MARK.internalQuery}`,
    schema: 'public',
    table: 'device_credentials',
    constraint: 'device_credentials_current_hash_key',
    file: 'nbtinsert.c',
    line: '666',
    routine: '_bt_check_unique',
  });
}

/** What a module gets from `unit.db`: the installed wrapper around the driver's error. */
function wrappedError(): DrizzleQueryError {
  return new DrizzleQueryError(STATEMENT, PARAMETERS, driverError());
}

const apps: FastifyInstance[] = [];
afterAll(async () => {
  for (const app of apps.splice(0)) await app.close();
});

function logger() {
  const captured = captureLog();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'trace' }), logStream: captured.stream });
  apps.push(app);
  return { log: app.log, captured };
}

interface Row {
  readonly name: string;
  /** Writes one line with the message `name`. */
  write(log: FastifyInstance['log'], name: string): void;
  /** Where the description of the error is in the parsed line. */
  read(line: Record<string, unknown>): unknown;
  readonly code: string;
  readonly type: string;
}

const at = (value: unknown, ...path: Array<string | number>): unknown =>
  path.reduce<unknown>((current, key) => (typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[key] : undefined), value);

const ROWS: readonly Row[] = [
  { name: 'A key err', write: (log, name) => log.warn({ err: wrappedError() }, name), read: (line) => line['err'], code: '23505', type: 'Error' },
  { name: 'B key error', write: (log, name) => log.warn({ error: wrappedError() }, name), read: (line) => line['error'], code: '23505', type: 'Error' },
  { name: 'C key cause', write: (log, name) => log.warn({ cause: wrappedError() }, name), read: (line) => line['cause'], code: '23505', type: 'Error' },
  {
    name: 'D nested',
    write: (log, name) => log.warn({ context: { failure: wrappedError() } }, name),
    read: (line) => at(line, 'context', 'failure'),
    code: '23505',
    type: 'Error',
  },
  { name: 'E key err, driver error', write: (log, name) => log.warn({ err: driverError() }, name), read: (line) => line['err'], code: '23505', type: 'error' },
];

function leaks(text: string): string[] {
  return Object.entries(MARK)
    .filter(([, mark]) => text.includes(mark))
    .map(([what]) => what);
}

describe('CPB1-2: an error logged under any key is written as its name, its code and its frames', () => {
  it.each(ROWS)('$name: no statement, no parameter, no DETAIL; the SQLSTATE and the name are there', (row) => {
    const { log, captured } = logger();
    row.write(log, row.name);
    const line = captured.lines().find((entry) => entry['msg'] === row.name);
    expect(line).toBeDefined();
    expect(leaks(JSON.stringify(line))).toEqual([]);
    const described = row.read(line ?? {}) as Record<string, unknown>;
    expect(described).toMatchObject({ type: row.type, code: row.code, message: row.code });
    // Exactly the members of the safe description, whatever the error held.
    expect(Object.keys(described).filter((key) => !['type', 'code', 'causeType', 'message', 'stack'].includes(key))).toEqual([]);
    expect(String(described['stack'])).toContain('error-keys.test.ts');
  });

  it('the five lines of the table, as the review printed them', () => {
    const { log, captured } = logger();
    const printed = ROWS.map((row) => {
      row.write(log, row.name);
      const line = captured.lines().find((entry) => entry['msg'] === row.name) ?? {};
      const text = JSON.stringify(line);
      const described = row.read(line) as { code?: unknown; type?: unknown } | undefined;
      return (
        `${row.name.padEnd(24)}| statement:${String(text.includes(MARK.statement))} param:${String(text.includes(MARK.parameter))} ` +
        `pgDetail:${String(text.includes(MARK.detail))} code:${JSON.stringify(described?.code)} type:${JSON.stringify(described?.type)}`
      );
    });
    console.info(`[cpb1-2] the table of the review\n${printed.join('\n')}`);
    expect(printed).toEqual([
      'A key err               | statement:false param:false pgDetail:false code:"23505" type:"Error"',
      'B key error             | statement:false param:false pgDetail:false code:"23505" type:"Error"',
      'C key cause             | statement:false param:false pgDetail:false code:"23505" type:"Error"',
      'D nested                | statement:false param:false pgDetail:false code:"23505" type:"Error"',
      'E key err, driver error | statement:false param:false pgDetail:false code:"23505" type:"error"',
    ]);
  });

  it('two and more levels deep, inside arrays, under any name, beside other members', () => {
    const { log, captured } = logger();
    log.error(
      {
        unit: 7,
        label: 'pairing.redeem',
        e: wrappedError(),
        reason: driverError(),
        outcome: { attempts: [{ failure: wrappedError() }, 'text', 3], last: { thrown: { problem: driverError() } } },
        failures: [wrappedError(), driverError()],
      },
      'deep',
    );
    const line = captured.lines().find((entry) => entry['msg'] === 'deep') ?? {};
    expect(leaks(JSON.stringify(line))).toEqual([]);
    expect(line).toMatchObject({ unit: 7, label: 'pairing.redeem' });
    for (const path of [['e'], ['reason'], ['outcome', 'attempts', 0, 'failure'], ['outcome', 'last', 'thrown', 'problem'], ['failures', 0], ['failures', 1]]) {
      expect(at(line, ...path), path.join('.')).toMatchObject({ code: '23505', message: '23505' });
    }
    expect(at(line, 'outcome', 'attempts', 1)).toBe('text');
    expect(at(line, 'outcome', 'attempts', 2)).toBe(3);
  });

  it('a driver error under another key: no DETAIL, no HINT, no WHERE, no message', () => {
    const { log, captured } = logger();
    log.error({ error: driverError(), nested: { cause: driverError() } }, 'driver');
    const line = captured.lines().find((entry) => entry['msg'] === 'driver') ?? {};
    expect(leaks(JSON.stringify(line))).toEqual([]);
    expect(line['error']).toMatchObject({ type: 'error', code: '23505' });
    expect(JSON.stringify(line)).not.toContain('device_credentials');
  });

  it('an error given as a value for the text of a line is described the same way', () => {
    const { log, captured } = logger();
    log.warn('failed with %o and %s', wrappedError(), driverError());
    log.warn({ unit: 1 }, 'failed in a unit: %j', wrappedError());
    const text = captured.text();
    expect(text).toContain('failed with');
    expect(text).toContain('failed in a unit');
    expect(leaks(text)).toEqual([]);
    expect(text).toContain('23505');
  });

  it('the whole captured log of this file holds no part of the error', () => {
    const { log, captured } = logger();
    for (const row of ROWS) row.write(log, row.name);
    log.error(wrappedError());
    log.error({ err: wrappedError() });
    expect(captured.lines().length).toBe(ROWS.length + 2);
    expect(leaks(captured.text())).toEqual([]);
  });
});

describe('CPB1-7: the safe description follows `cause` for the code', () => {
  it('a wrapped database error: the SQLSTATE of the driver, the name of the driver\'s error, no text of the wrapper', () => {
    const description = describeError(wrappedError());
    expect(description).toMatchObject({ errorName: 'Error', code: '23505', causeName: 'error' });
    expect(Object.keys(description).sort()).toEqual(['causeName', 'code', 'errorName', 'stackTrace']);
    expect(leaks(JSON.stringify(description))).toEqual([]);
  });

  it('the error\'s own code comes first; a cause is read only when the error has none', () => {
    const own = Object.assign(new Error('outer', { cause: driverError() }), { code: 'OUTER_CODE' });
    expect(describeError(own)).toMatchObject({ errorName: 'Error', code: 'OUTER_CODE' });
    expect(describeError(own)).not.toHaveProperty('causeName');
    expect(describeError(driverError())).toMatchObject({ errorName: 'error', code: '23505' });
    expect(describeError(driverError())).not.toHaveProperty('causeName');
    expect(describeError(new Error('no code anywhere', { cause: new Error('nor here') }))).not.toHaveProperty('code');
  });

  it('the chain is read to a bounded depth, and a chain that loops ends', () => {
    const chain = (depth: number): Error => {
      let error: Error = driverError();
      for (let level = 0; level < depth; level += 1) error = new Error(`level ${level}`, { cause: error });
      return error;
    };
    // The error and three causes are read: a code four causes down is not.
    expect(describeError(chain(3))).toMatchObject({ code: '23505', causeName: 'error' });
    expect(describeError(chain(4))).not.toHaveProperty('code');
    const loop = new Error('loops');
    loop.cause = loop;
    expect(describeError(loop)).toMatchObject({ errorName: 'Error' });
    expect(describeError(loop)).not.toHaveProperty('code');
  });

  it('a cause that is not an error, or a code that is not a text, is not reported', () => {
    expect(describeError(new Error('x', { cause: 'a string' }))).not.toHaveProperty('code');
    expect(describeError(new Error('x', { cause: { code: 23505 } }))).not.toHaveProperty('code');
    expect(describeError(new Error('x', { cause: { code: 'E_PLAIN', name: 'PlainObject' } }))).toMatchObject({ code: 'E_PLAIN', causeName: 'PlainObject' });
  });
});

describe('CPB1-23: the frames of a stack, never a line of the message', () => {
  it('a line of the statement that has the form of a frame is not kept', () => {
    const error = wrappedError();
    // The premise: the stack as V8 wrote it does hold that line of the statement.
    expect(error.stack).toContain(MARK.statementLine);
    const { stackTrace } = describeError(error);
    expect(stackTrace).toBeDefined();
    expect(stackTrace).not.toContain(MARK.statementLine);
    expect(stackTrace).not.toContain(MARK.statement);
    expect(stackTrace).not.toContain(MARK.parameter);
    expect(stackTrace).toContain('error-keys.test.ts');
    for (const line of String(stackTrace).split('\n')) expect(line).toMatch(/^\s+at .+/);
  });

  it('an error whose message was changed after its stack was written: only lines in the form of a frame are kept', () => {
    const error = new Error(`first line\n    at ${MARK.statementLine} midnight\nparams: ${MARK.parameter}`);
    // The runtime writes the stack text when it is first read. Read here, it holds the first
    // message; the message is then replaced, so it can no longer be found in the stack and cut.
    expect(error.stack).toContain(MARK.statementLine);
    error.message = 'replaced afterwards';
    expect(error.stack).not.toContain('replaced afterwards');
    const { stackTrace } = describeError(error);
    expect(stackTrace).not.toContain(MARK.statementLine);
    expect(stackTrace).not.toContain(MARK.parameter);
    expect(stackTrace).toContain('error-keys.test.ts');
  });

  it('an error without a message, and one without a stack', () => {
    expect(describeError(new Error(''))).toMatchObject({ errorName: 'Error' });
    expect(describeError(new Error('')).stackTrace).toContain('error-keys.test.ts');
    const bare = new Error('no stack');
    delete bare.stack;
    expect(describeError(bare)).toEqual({ errorName: 'Error' });
  });
});
