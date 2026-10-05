// Names and the name guard of the test helper (database contract §10: TI-2, TI-3, TI-12;
// test idea T-TI-2 at the level of the guard). Pure: no database, no file.
import { describe, expect, it } from 'vitest';
import { MAX_IDENTIFIER_BYTES, STALE_AFTER_SECONDS } from '../constants';
import { DbGuardError, DbTestHelperError } from '../errors';
import {
  classifyForSweep,
  cloneCounterOf,
  createRunIdentity,
  fileDatabaseName,
  guardOwnDatabase,
  guardStaleDatabase,
  isTemplateName,
  livenessKey,
  lowestFreeCounter,
  newStamp,
  parseTestDatabaseName,
  protectedReason,
  runLabel,
  slugFromFile,
  stampSeconds,
  templateDatabaseName,
} from '../names';

const NOW_MS = Date.UTC(2026, 9, 4, 0, 30, 0);
const NOW_SECONDS = NOW_MS / 1000;
const HOUR = 3600;

function stampAt(seconds: number, tail = 'zz'): string {
  return `${seconds.toString(36).padStart(6, '0')}${tail}`;
}

const own = createRunIdentity('step_33', stampAt(NOW_SECONDS, 'a1'));

function code(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof DbTestHelperError) return error.code;
    throw error;
  }
  return 'NOT_REFUSED';
}

describe('TI-2: the run prefix', () => {
  it('labels a run "local" without DEMS_TEST_STEP and "step_<row>" with it', () => {
    expect(runLabel(undefined)).toBe('local');
    expect(runLabel('')).toBe('local');
    expect(runLabel('33')).toBe('step_33');
    expect(runLabel('W17')).toBe('step_w17');
    expect(runLabel('w01b')).toBe('step_w01b');
  });

  it.each(['3 3', '33;', 'step_33', '../x', 'a'.repeat(13), 'é'])('refuses the row label %j', (step) => {
    expect(code(() => runLabel(step))).toBe('RUN_LABEL_INVALID');
  });

  it('builds a stamp of eight base-36 characters: six for the second, two random', () => {
    const digits = [7, 35];
    const stamp = newStamp(NOW_MS, () => digits.shift() ?? 0);
    expect(stamp).toMatch(/^[0-9a-z]{8}$/);
    expect(stamp.slice(6)).toBe('7z');
    expect(stampSeconds(stamp)).toBe(NOW_SECONDS);
    // Two runs of one second differ by their random characters.
    expect(newStamp(NOW_MS, () => 1)).not.toBe(newStamp(NOW_MS, () => 2));
    expect(newStamp(NOW_MS + 999, () => 0)).toBe(newStamp(NOW_MS, () => 0));
  });

  it('gives the prefix dems_test_<label>_<stamp>_', () => {
    expect(own.prefix).toBe(`dems_test_step_33_${own.stamp}_`);
    expect(createRunIdentity('local', 'abcdefgh').prefix).toBe('dems_test_local_abcdefgh_');
    expect(code(() => createRunIdentity('step_', 'abcdefgh'))).toBe('NAME_INVALID');
    expect(code(() => createRunIdentity('local', 'ABCDEFGH'))).toBe('NAME_INVALID');
    expect(code(() => createRunIdentity('local', 'abc'))).toBe('NAME_INVALID');
  });

  it('names the three templates and a private one', () => {
    expect(templateDatabaseName(own, 'schema')).toBe(`${own.prefix}tpl_schema`);
    expect(templateDatabaseName(own, 'seed')).toBe(`${own.prefix}tpl_seed`);
    expect(templateDatabaseName(own, 'bulk')).toBe(`${own.prefix}tpl_bulk`);
    expect(templateDatabaseName(own, 'x_selftest')).toBe(`${own.prefix}tpl_x_selftest`);
    expect(code(() => templateDatabaseName(own, 'demo'))).toBe('NAME_INVALID');
    expect(code(() => templateDatabaseName(own, 'x_"; --'))).toBe('NAME_INVALID');
    expect(isTemplateName(`${own.prefix}tpl_seed`)).toBe(true);
    expect(isTemplateName(`${own.prefix}f01_tpl_seed`)).toBe(false);
  });

  it('reduces a test file name to [a-z0-9_]', () => {
    expect(slugFromFile('/x/src/modules/identity/__tests__/identity-login.db.test.ts')).toBe('identity_login');
    expect(slugFromFile('test/acceptance/Pairing Lifecycle.test.ts')).toBe('pairing_lifecycle');
    expect(slugFromFile('C:\\x\\audit.chain.db.test.ts')).toBe('audit_chain');
    expect(slugFromFile('---.db.test.ts')).toBe('file');
    expect(slugFromFile('')).toBe('file');
  });

  it('names a per-file database <prefix>f<nn>_<slug> and cuts it to 63 bytes', () => {
    expect(fileDatabaseName(own, 1, 'identity_login')).toBe(`${own.prefix}f01_identity_login`);
    expect(fileDatabaseName(own, 42, 'x')).toBe(`${own.prefix}f42_x`);
    const long = fileDatabaseName(createRunIdentity('step_abcdefghijkl', own.stamp), 99, 'a_very_long_test_file_name_that_does_not_fit_in_the_rest');
    expect(Buffer.byteLength(long)).toBeLessThanOrEqual(MAX_IDENTIFIER_BYTES);
    // 41 bytes of prefix and counter leave 22 for the slug; a trailing underscore is cut too.
    expect(long).toBe(`dems_test_step_abcdefghijkl_${own.stamp}_f99_a_very_long_test_file`);
    expect(code(() => fileDatabaseName(own, 0, 'x'))).toBe('NAME_INVALID');
    expect(code(() => fileDatabaseName(own, 100, 'x'))).toBe('NAME_INVALID');
    // Whatever the slug holds, the name stays inside the guard's alphabet.
    expect(fileDatabaseName(own, 1, 'x"; DROP')).toBe(`${own.prefix}f01_x_drop`);
  });

  it('hands out the lowest counter no database of the run uses', () => {
    const names = [`${own.prefix}tpl_schema`, `${own.prefix}f01_a`, `${own.prefix}f03_c`, 'dems_test_local_abcdefgh_f02_other'];
    expect(cloneCounterOf(`${own.prefix}f03_c`, own)).toBe(3);
    expect(cloneCounterOf(`${own.prefix}tpl_schema`, own)).toBeNull();
    expect(cloneCounterOf('dems_test_local_abcdefgh_f02_other', own)).toBeNull();
    expect(lowestFreeCounter(names, own)).toBe(2);
    expect(lowestFreeCounter([], own)).toBe(1);
    const full = Array.from({ length: 99 }, (_, i) => fileDatabaseName(own, i + 1, 'x'));
    expect(code(() => lowestFreeCounter(full, own))).toBe('CLONE_SLOTS_EXHAUSTED');
  });

  it('parses a name of the scheme and nothing else', () => {
    const parsed = parseTestDatabaseName(`${own.prefix}f01_identity_login`);
    expect(parsed?.run).toEqual(own);
    expect(parsed?.rest).toBe('f01_identity_login');
    expect(parsed?.startedAtSeconds).toBe(NOW_SECONDS);
    expect(parseTestDatabaseName('dems_test_local_abcdefgh_tpl_seed')?.run.label).toBe('local');
    for (const name of ['dems_demo', 'dems_test_', 'dems_test_x', 'dems_test_local_abc_f01_x', `${own.prefix}`, 'dems_test_step__abcdefgh_x']) {
      expect(parseTestDatabaseName(name), name).toBeNull();
    }
  });

  it('derives a liveness key from 1 to 2^30 - 1, never the clone lock key 0', () => {
    const keys = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const key = livenessKey(stampAt(NOW_SECONDS + i, (i % 1296).toString(36).padStart(2, '0')));
      expect(key).toBeGreaterThanOrEqual(1);
      expect(key).toBeLessThanOrEqual(0x3fffffff);
      keys.add(key);
    }
    expect(keys.size).toBeGreaterThan(1990);
    expect(livenessKey('abcdefgh')).toBe(livenessKey('abcdefgh'));
  });
});

describe('TI-3: the guard passes only a database of the own run', () => {
  it('passes the templates and the per-file databases of the run', () => {
    for (const name of [`${own.prefix}tpl_schema`, `${own.prefix}tpl_x_selftest`, `${own.prefix}f01_identity_login`]) {
      expect(guardOwnDatabase(name, own, 'drop')).toBe(name);
    }
  });

  it.each([
    ['dems_demo', 'GUARD_PROTECTED_DATABASE'],
    ['dems_demo_next', 'GUARD_PROTECTED_DATABASE'],
    ['dems_demo_prev', 'GUARD_PROTECTED_DATABASE'],
    ['dems_lane_1', 'GUARD_PROTECTED_DATABASE'],
    ['dems_lane_2', 'GUARD_PROTECTED_DATABASE'],
    ['dems_lane_3_next', 'GUARD_PROTECTED_DATABASE'],
    ['postgres', 'GUARD_PROTECTED_DATABASE'],
    ['template0', 'GUARD_PROTECTED_DATABASE'],
    ['template1', 'GUARD_PROTECTED_DATABASE'],
    ['dems_proof_drizzle_20261004003235_a', 'GUARD_PROTECTED_DATABASE'],
    ['dems_proof_anything', 'GUARD_PROTECTED_DATABASE'],
    ['dems_trial_a', 'GUARD_PROTECTED_DATABASE'],
    ['some_other_database', 'GUARD_NOT_A_TEST_DATABASE'],
    ['DEMS_TEST_LOCAL_ABCDEFGH_F01_X', 'GUARD_NOT_A_TEST_DATABASE'],
    ['dems_test_x"; DROP DATABASE dems_demo; --', 'GUARD_NOT_A_TEST_DATABASE'],
    ['dems_test_local_abcdefgh_f01 x', 'GUARD_NOT_A_TEST_DATABASE'],
    [`dems_test_${'a'.repeat(60)}`, 'GUARD_NOT_A_TEST_DATABASE'],
    ['', 'GUARD_NOT_A_TEST_DATABASE'],
    ['dems_test_', 'GUARD_NOT_A_TEST_DATABASE'],
  ])('refuses %j (%s)', (name, expected) => {
    for (const action of ['create', 'clone', 'lock', 'unlock', 'drop', 'connect to'] as const) {
      expect(code(() => guardOwnDatabase(name, own, action))).toBe(expected);
    }
  });

  it('refuses a value that is not a string', () => {
    for (const value of [undefined, null, 42, {}, ['dems_test_x']]) {
      expect(code(() => guardOwnDatabase(value, own, 'drop'))).toBe('GUARD_NOT_A_TEST_DATABASE');
    }
  });

  it('refuses a database of another run, younger or older, and says whose it is', () => {
    const younger = createRunIdentity('step_41', stampAt(NOW_SECONDS + 5, 'q9'));
    const older = createRunIdentity('local', stampAt(NOW_SECONDS - 9 * HOUR, 'b2'));
    for (const other of [younger, older]) {
      const name = `${other.prefix}f01_identity`;
      let thrown: unknown;
      try {
        guardOwnDatabase(name, own, 'drop');
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(DbGuardError);
      expect((thrown as DbGuardError).code).toBe('GUARD_FOREIGN_RUN');
      expect((thrown as DbGuardError).database).toBe(name);
      expect((thrown as DbGuardError).message).toContain('refused before any statement');
      expect((thrown as DbGuardError).message).toContain(other.prefix);
    }
    // The same label and second, other random characters: still another run.
    const twin = createRunIdentity(own.label, `${own.stamp.slice(0, 6)}zz`);
    expect(code(() => guardOwnDatabase(`${twin.prefix}tpl_schema`, own, 'unlock'))).toBe('GUARD_FOREIGN_RUN');
    // The bare prefix names no database of the run.
    expect(code(() => guardOwnDatabase(own.prefix, own, 'drop'))).toBe('GUARD_FOREIGN_RUN');
  });

  it('knows why a protected name is protected', () => {
    expect(protectedReason('dems_demo')).toContain('main instance');
    expect(protectedReason('dems_lane_2')).toContain('lane');
    expect(protectedReason('postgres')).toContain('maintenance');
    expect(protectedReason('template0')).toContain('template');
    expect(protectedReason('dems_proof_x')).toContain('proof');
    expect(protectedReason(`${own.prefix}f01_x`)).toBeNull();
  });
});

describe('TI-12: the stale sweep takes only old runs that are not alive', () => {
  const staleRun = createRunIdentity('step_29', stampAt(NOW_SECONDS - 7 * HOUR, 'k3'));
  const edgeRun = createRunIdentity('local', stampAt(NOW_SECONDS - STALE_AFTER_SECONDS, 'e0'));
  const youngRun = createRunIdentity('step_41', stampAt(NOW_SECONDS - 60, 'y7'));
  const futureRun = createRunIdentity('local', stampAt(NOW_SECONDS + 600, 'f1'));

  it('sorts the databases of a cluster', () => {
    const names = [
      'postgres',
      'template0',
      'template1',
      'dems_demo',
      'dems_lane_1',
      'dems_proof_drizzle_20261004003235_a',
      `${own.prefix}tpl_schema`,
      `${own.prefix}f01_a`,
      `${staleRun.prefix}tpl_schema`,
      `${staleRun.prefix}f01_a`,
      `${edgeRun.prefix}f01_a`,
      `${youngRun.prefix}f02_b`,
      `${futureRun.prefix}f01_c`,
      'dems_test_handmade',
    ];
    const plan = classifyForSweep(names, own, NOW_SECONDS);
    expect(plan.own).toEqual([`${own.prefix}f01_a`, `${own.prefix}tpl_schema`]);
    expect(plan.unrecognised).toEqual(['dems_test_handmade']);
    // Exactly six hours is not "more than six hours"; a stamp from the future is not old.
    expect([...plan.younger].sort()).toEqual([`${edgeRun.prefix}f01_a`, `${futureRun.prefix}f01_c`, `${youngRun.prefix}f02_b`].sort());
    expect(plan.stale).toHaveLength(1);
    expect(plan.stale[0]?.run).toEqual(staleRun);
    expect(plan.stale[0]?.ageSeconds).toBe(7 * HOUR);
    expect(plan.stale[0]?.databases).toEqual([`${staleRun.prefix}f01_a`, `${staleRun.prefix}tpl_schema`]);
    // Nothing without the test prefix is ever listed.
    const listed = [...plan.own, ...plan.younger, ...plan.unrecognised, ...plan.stale.flatMap((run) => run.databases)];
    expect(listed.every((name) => name.startsWith('dems_test_'))).toBe(true);
  });

  it('passes a database of a stale run whose liveness lock the sweep holds', () => {
    const name = `${staleRun.prefix}tpl_schema`;
    expect(guardStaleDatabase(name, own, { stamp: staleRun.stamp, nowSeconds: NOW_SECONDS })).toBe(name);
  });

  it('refuses a younger database of another run, whatever claim is shown', () => {
    for (const run of [youngRun, edgeRun, futureRun]) {
      const name = `${run.prefix}f01_a`;
      expect(code(() => guardStaleDatabase(name, own, { stamp: run.stamp, nowSeconds: NOW_SECONDS }))).toBe('GUARD_NOT_STALE');
    }
  });

  it('refuses a stale database without the liveness lock of its run', () => {
    const name = `${staleRun.prefix}f01_a`;
    expect(code(() => guardStaleDatabase(name, own, { stamp: youngRun.stamp, nowSeconds: NOW_SECONDS }))).toBe('GUARD_NOT_STALE');
  });

  it('refuses the own run, a protected name and a name outside the scheme', () => {
    const claim = { stamp: staleRun.stamp, nowSeconds: NOW_SECONDS };
    expect(code(() => guardStaleDatabase(`${own.prefix}f01_a`, own, claim))).toBe('GUARD_NOT_STALE');
    expect(code(() => guardStaleDatabase('dems_demo', own, claim))).toBe('GUARD_PROTECTED_DATABASE');
    expect(code(() => guardStaleDatabase('postgres', own, claim))).toBe('GUARD_PROTECTED_DATABASE');
    expect(code(() => guardStaleDatabase('dems_proof_drizzle_20261004003235_a', own, claim))).toBe('GUARD_PROTECTED_DATABASE');
    expect(code(() => guardStaleDatabase('dems_test_handmade', own, claim))).toBe('GUARD_NOT_A_TEST_DATABASE');
  });
});
