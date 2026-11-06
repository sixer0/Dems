// Static guard: what no program of the server may say to the database.
//
// 1. Nothing removes the audit protection (database contract T-AO-4, LN-6; spec SR-52). The
//    audit table and the lineage table are append-only by privilege and by triggers that are
//    enabled ALWAYS; the statements below are the ways around that.
//
//      never, anywhere under apps/core-server/:   switching a trigger off, dropping a trigger,
//                                                  changing a server setting;
//      the session setting that skips triggers:    only in the tests of test/db/ that expect
//                                                  its refusal (T-AO-2b, T-PV-2);
//      replacing a function or a trigger:          only in the migration folder;
//      dropping a database:                        only in the reset routine, the test helper and
//                                                  the test support of the reset routine, which
//                                                  drops databases of the test's own run.
//
// 2. Nothing makes the PostgreSQL log quote bound parameters (database contract NL-1, NL-5).
//    One logging setting can be changed by any role for its own session; with it, a statement
//    that fails would put its parameters (a token hash, a code hash) into the server log.
//
//      the setting that logs the parameters of a failed statement:
//                                                  only in the tests of test/db/, which read it
//                                                  to assert that it is at its default.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, occurrences, readTree, under, type SourceFile } from './scan';

/** Case-insensitive, and the words may be separated by any white space, also a line break. */
function statement(...words: string[]): RegExp {
  return new RegExp(`\\b${words.join('\\s+')}\\b`, 'gi');
}

const TRIGGER_OFF = statement('DISABLE', 'TRIGGER');
const TRIGGER_DROPPED = statement('DROP', 'TRIGGER');
const SERVER_SETTING = statement('ALTER', 'SYSTEM');
const TRIGGER_SKIP_SETTING = new RegExp(['session', 'replication', 'role'].join('_'), 'gi');
const REPLACED = statement('CREATE', 'OR', 'REPLACE');
const DATABASE_DROPPED = statement('DROP', 'DATABASE');
const PARAMETER_LOG_SETTING = new RegExp(['log', 'parameter', 'max', 'length', 'on', 'error'].join('_'), 'gi');

const TRIGGER_SKIP_PLACES = ['test/db/'];
const PARAMETER_LOG_PLACES = ['test/db/'];
const REPLACE_PLACES = ['src/db/migrations/'];
// `test/support/reset.ts` is the reset row's test support. It was under `src/db/reset/` (and so in
// the list by its folder) until fix round B1 moved it to the neutral folder, because other rows
// use it. One file, named: nothing else under `test/support/` may drop a database.
const DATABASE_DROP_PLACES = ['src/db/reset/', 'test/helpers/db/', 'test/global-setup.db.ts', 'test/support/reset.ts'];

const server = readTree(WORKSPACE);
const outside = (places: readonly string[]) => (path: string) => !under(path, places);

describe('T-AO-4: the audit protection is never removed', () => {
  it('finds each statement when it is present, across a line break and in lower case (positive control)', () => {
    const sql = (...words: string[]): string => words.join(' ');
    const planted: SourceFile[] = [
      { path: 'src/a.ts', text: `ALTER TABLE audit_log ${sql('DISABLE', 'TRIGGER')} ALL;` },
      { path: 'src/b.sql', text: `${'drop'}\n   ${'trigger'} audit_log_append_only on audit_log;` },
      { path: 'src/c.ts', text: `${sql('ALTER', 'SYSTEM')} SET fsync = off` },
      { path: 'src/d.ts', text: `SET ${['session', 'replication', 'role'].join('_')} = replica` },
      { path: 'src/e.ts', text: `${sql('CREATE', 'OR', 'REPLACE')} FUNCTION audit_log_guard_insert()` },
      { path: 'src/f.ts', text: `${sql('DROP', 'DATABASE')} dems_demo` },
    ];
    expect(occurrences(planted, TRIGGER_OFF)).toEqual(['src/a.ts:1']);
    expect(occurrences(planted, TRIGGER_DROPPED)).toEqual(['src/b.sql:1']);
    expect(occurrences(planted, SERVER_SETTING)).toEqual(['src/c.ts:1']);
    expect(occurrences(planted, TRIGGER_SKIP_SETTING)).toEqual(['src/d.ts:1']);
    expect(occurrences(planted, REPLACED)).toEqual(['src/e.ts:1']);
    expect(occurrences(planted, DATABASE_DROPPED)).toEqual(['src/f.ts:1']);
    // Enabling a trigger (what T-PV-3 does on its own clone) is not forbidden.
    expect(occurrences([{ path: 'x.ts', text: 'ALTER TABLE t ENABLE TRIGGER g' }], TRIGGER_OFF)).toEqual([]);
  });

  it.each([
    ['switches a trigger off', TRIGGER_OFF],
    ['drops a trigger', TRIGGER_DROPPED],
    ['changes a server setting', SERVER_SETTING],
  ])('no file under apps/core-server %s', (_label, pattern) => {
    expect(occurrences(server, pattern)).toEqual([]);
  });

  it('the session setting that skips triggers appears only in the database tests that expect its refusal', () => {
    expect(occurrences(server, TRIGGER_SKIP_SETTING, outside(TRIGGER_SKIP_PLACES))).toEqual([]);
  });

  it('a function or a trigger is replaced only by a migration', () => {
    expect(occurrences(server, REPLACED, outside(REPLACE_PLACES))).toEqual([]);
  });

  it('a database is dropped only by the reset routine, the test helper and the test support of the reset routine', () => {
    expect(occurrences(server, DATABASE_DROPPED, outside(DATABASE_DROP_PLACES))).toEqual([]);
  });
});

describe('NL-5: the PostgreSQL log never quotes bound parameters', () => {
  const setting = ['log', 'parameter', 'max', 'length', 'on', 'error'].join('_');

  it('finds the setting when it is present, in any case and in any kind of file (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/core/unit-of-work.ts', text: `await client.query('SET LOCAL ${setting} = -1');` },
      { path: 'src/db/migrations/0004_x.sql', text: `ALTER ROLE dems_app SET ${setting.toUpperCase()} = 1024;` },
      { path: 'drizzle.config.ts', text: `options: '-c ${setting}=-1'` },
      { path: 'test/db/pg-behaviours.db.test.ts', text: `WHERE name IN ('${setting}')` },
    ];
    expect(occurrences(planted, PARAMETER_LOG_SETTING)).toEqual([
      'src/core/unit-of-work.ts:1',
      'src/db/migrations/0004_x.sql:1',
      'drizzle.config.ts:1',
      'test/db/pg-behaviours.db.test.ts:1',
    ]);
    // The same exception as for the trigger-skipping setting: the database tests may name it.
    expect(occurrences(planted, PARAMETER_LOG_SETTING, outside(PARAMETER_LOG_PLACES))).toEqual([
      'src/core/unit-of-work.ts:1',
      'src/db/migrations/0004_x.sql:1',
      'drizzle.config.ts:1',
    ]);
    // A neighbouring setting of NL-5 with a similar name is not this one.
    expect(occurrences([{ path: 'x.sql', text: 'SHOW log_parameter_max_length;' }], PARAMETER_LOG_SETTING)).toEqual([]);
  });

  it('the setting that logs the parameters of a failed statement appears only in the database tests', () => {
    expect(occurrences(server, PARAMETER_LOG_SETTING, outside(PARAMETER_LOG_PLACES))).toEqual([]);
  });
});
