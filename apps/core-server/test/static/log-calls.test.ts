// Static guard: an error is logged as `{ err }` (checkpoint CP-B1, finding CPB1-2; SR-48, SR-50;
// standing rules M5 and M8).
//
// The logger makes an error safe under any key (`safeLogObject`), so nothing leaks when this
// convention is broken. The convention is still worth keeping: under `err` the line has one shape
// that every reader of the log knows, and the serializer of that key is the oldest and best
// tested path. So, server-wide, in production sources:
//
//   1. the object literal of a log call holds no member named `error`, `cause`, `e` or `reason`,
//      neither in the short form `{ error }` nor as `{ error: value }`, at any depth of the
//      literal. An error goes under `err`; its code goes under `code`. A keyed member whose value
//      is fixed in the source (a string, a number, a constant in capitals) cannot be something
//      that was caught and is not refused: `{ reason: CREDENTIAL_CONFLICT_REASON }`;
//   2. no child logger is created: the bindings of a child are serialised when it is created and
//      pass no formatter, so an error in them would be written as it is.
//
// The names of rule 1 are the ones a caught value usually has. A member of that name that holds
// no error would be listed below with what it holds (the list names the file, the key and how
// many times, never a line, so an owner can move code without touching it). The list is EMPTY
// since fix round B1: its one entry, the name of a readiness hold logged under `reason`, was
// renamed to `hold` (decision D96, ruling 2). Rename a key rather than list it.
import { describe, expect, it } from 'vitest';
import { childLoggerCalls, isFixedValue, logCalls, loggedKeys } from './log-calls';
import { WORKSPACE, codeOnly, isProductionSource, readTree, stripComments } from './scan';

const ERROR_NAMES: ReadonlySet<string> = new Set(['error', 'cause', 'e', 'reason']);

interface Allowed {
  readonly path: string;
  readonly key: string;
  /** At most this many members of that key in log calls of that file. */
  readonly atMost: number;
  /** What the member holds, and why it is not an error. */
  readonly holds: string;
}

/**
 * Members of one of the four names that hold no error. Empty: no production source of the
 * server, foundation or module, logs under one of the four names (decision D96, ruling 2).
 */
const ALLOWED: readonly Allowed[] = [];

const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path)));

function refused(): string[] {
  const uses = loggedKeys(production, ERROR_NAMES);
  const counted = new Map<string, number>();
  const out: string[] = [];
  for (const use of uses) {
    const allowed = ALLOWED.find((entry) => entry.path === use.path && entry.key === use.key);
    const seen = (counted.get(`${use.path} ${use.key}`) ?? 0) + 1;
    counted.set(`${use.path} ${use.key}`, seen);
    if (allowed !== undefined && seen <= allowed.atMost) continue;
    out.push(`${use.path}:${use.line} { ${use.form === 'shorthand' ? use.key : `${use.key}: ...`} }`);
  }
  return out;
}

describe('the scan itself', () => {
  it('finds the log calls of a text and the members of the objects they log (positive control)', () => {
    const text = stripComments(
      [
        "request.log.warn({ error }, 'short form');",
        "app.log.error({ where, cause: thrown, code: 'X' }, 'keyed');",
        'log.debug({ ...where, e }, `template ${value}`);',
        "logger.fatal({ context: { reason: failure, kept: 1 }, list: [{ error }, 2] }, 'nested');",
        "reply.log.info({ 'error': x, [\"cause\"]: y }, 'quoted keys');",
        "log.info({ err: error, code: reason ?? 'none', label: `a, ${b}`, text: 'e, error' }, 'the convention');",
        "log.warn({ reason: CREDENTIAL_CONFLICT_REASON, cause: 'TIMEOUT', error: PipelineRefusal.CLOSED, e: 3 }, 'fixed values');",
        "log.warn({ reason: reasonOf(x), cause: `${thrown}`, error: failure.cause, e: refusal }, 'values that are not fixed');",
        "log.warn('no object', error);",
        'log.error(error);',
        '// log.warn({ error }) in a comment',
        'const line = { cause: 1 }; log.error(line, "an object in a variable is not followed");',
        'log.trace(',
        '  {',
        '    unit: 1,',
        '    error,',
        '  },',
        "  'over several lines',",
        ');',
        "log.warn({ ...(flag ? { cause: thrown } : {}), ...{ reason: failure }, ok: true }, 'members through a spread');",
      ].join('\n'),
    );
    const calls = logCalls(text);
    expect(calls.map((call) => `${call.line} ${call.level} ${call.members.map((member) => `${member.key}/${member.form}`).join(',')}`)).toEqual([
      '1 warn error/shorthand',
      '2 error where/shorthand,cause/keyed,code/keyed',
      '3 debug e/shorthand',
      '4 fatal context/keyed,reason/keyed,kept/keyed,list/keyed,error/shorthand',
      '5 info error/keyed,cause/keyed',
      '6 info err/keyed,code/keyed,label/keyed,text/keyed',
      '7 warn reason/keyed,cause/keyed,error/keyed,e/keyed',
      '8 warn reason/keyed,cause/keyed,error/keyed,e/keyed',
      '9 warn ',
      '10 error ',
      '12 error ',
      '13 trace unit/keyed,error/shorthand',
      '20 warn cause/keyed,reason/keyed,ok/keyed',
    ]);
    const found = loggedKeys([{ path: 'src/planted.ts', text }], ERROR_NAMES);
    expect(found.map((use) => `${use.path}:${use.line} ${use.key} ${use.form}`)).toEqual([
      'src/planted.ts:1 error shorthand',
      'src/planted.ts:2 cause keyed',
      'src/planted.ts:3 e shorthand',
      'src/planted.ts:4 reason keyed',
      'src/planted.ts:4 error shorthand',
      'src/planted.ts:5 error keyed',
      'src/planted.ts:5 cause keyed',
      // Line 7 holds the four names with fixed values: not refused. Line 8 holds them with values that could be caught.
      'src/planted.ts:8 reason keyed',
      'src/planted.ts:8 cause keyed',
      'src/planted.ts:8 error keyed',
      'src/planted.ts:8 e keyed',
      'src/planted.ts:16 error shorthand',
      // A forbidden key that arrives through a spread of an inline object literal (finding of D123a).
      'src/planted.ts:20 cause keyed',
      'src/planted.ts:20 reason keyed',
    ]);
  });

  it('knows a value that is fixed in the source from one that could have been caught', () => {
    for (const fixed of ["'IDLE'", '"x, y"', '`plain`', '42', '-1.5', 'true', 'null', 'CREDENTIAL_CONFLICT_REASON', 'PipelineRefusal.CLOSED', 'ApiErrorCode.NOT_SIGNED_IN']) {
      expect(isFixedValue(fixed), fixed).toBe(true);
    }
    for (const open of ['error', 'reason', 'failure.cause', 'codeOf(error)', '`${error}`', "'a' + error", 'thrown as Error', 'Reason', 'error.code ?? X']) {
      expect(isFixedValue(open), open).toBe(false);
    }
  });

  it('finds a child logger', () => {
    const text = stripComments("const scoped = request.log.child({ error });\nconst other = log . child({});\n// log.child() in a comment\nchildren.child();");
    expect(childLoggerCalls(text)).toEqual([1, 2]);
  });

  it('reads the production sources of the server, the module folders included', () => {
    const paths = production.map((file) => file.path);
    for (const folder of ['src/core/', 'src/engine/', 'src/plugins/', 'src/modules/', 'src/db/']) {
      expect(paths.some((path) => path.startsWith(folder)), folder).toBe(true);
    }
    // The scan sees real calls: the server does log.
    const calls = production.flatMap((file) => logCalls(file.text));
    expect(calls.length).toBeGreaterThan(50);
    expect(calls.filter((call) => call.members.some((member) => member.key === 'err')).length).toBeGreaterThan(3);
  });
});

describe('CPB1-2: an error is logged as { err }', () => {
  it('the list of exceptions is explicit, and it is empty: the one hold name of the foundation is logged under the key hold now', () => {
    expect(ALLOWED.map((entry) => `${entry.path} ${entry.key} ${entry.atMost}`)).toEqual([]);
    for (const entry of ALLOWED) expect(entry.holds.length, entry.path).toBeGreaterThan(10);
    const readiness = production.find((file) => file.path === 'src/plugins/readiness/index.ts')?.text ?? '';
    const holdLines = logCalls(readiness).filter((call) => call.members.some((member) => member.key === 'held'));
    expect(holdLines.map((call) => call.members.map((member) => member.key))).toEqual([
      ['hold', 'held'],
      ['hold', 'held'],
    ]);
  });

  it('no log call of a production source holds a member named error, cause, e or reason', () => {
    expect(refused()).toEqual([]);
  });

  it('no production source creates a child logger', () => {
    const found = production.flatMap((file) => childLoggerCalls(file.text).map((line) => `${file.path}:${line}`));
    expect(found).toEqual([]);
  });
});
