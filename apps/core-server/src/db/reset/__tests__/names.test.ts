// Which databases a reset may touch, and its database-level statements (plan row W29; database
// contract §8.4, §8.5). Database-free: everything here is pure.
import { describe, expect, it } from 'vitest';
import { PROJECT_DATABASES, type TargetDatabase } from '../../commands/database-names';
import { STAGING_SUFFIX as SEED_STAGING_SUFFIX, assertSeedTarget } from '../../seed';
import { ResetError } from '../errors';
import {
  PREVIOUS_SUFFIX,
  PROTECTED_DATABASES,
  RESET_LOCK_CLASS,
  STAGING_SUFFIX,
  createStagingStatement,
  dropStatement,
  guardResetTarget,
  quoteDatabase,
  recoverStatement,
  swapStatements,
  type DisposableDatabase,
} from '../names';

const RUN = 'dems_test_step_51_abcd1234_';

function refusal(name: unknown, options: Parameters<typeof guardResetTarget>[1] = {}): ResetError {
  try {
    guardResetTarget(name, options);
  } catch (error) {
    if (error instanceof ResetError) return error;
    throw error;
  }
  throw new Error(`not refused: ${String(name)}`);
}

describe('the four project databases are the only targets', () => {
  it('each is accepted, with its staging and previous names and its lock slot (0 for dems_demo, 1 to 3 for the lanes)', () => {
    expect(PROJECT_DATABASES).toEqual(['dems_demo', 'dems_lane_1', 'dems_lane_2', 'dems_lane_3']);
    expect(PROJECT_DATABASES.map((name) => guardResetTarget(name))).toEqual([
      { name: 'dems_demo', staging: 'dems_demo_next', previous: 'dems_demo_prev', lockSlot: 0, kind: 'project' },
      { name: 'dems_lane_1', staging: 'dems_lane_1_next', previous: 'dems_lane_1_prev', lockSlot: 1, kind: 'project' },
      { name: 'dems_lane_2', staging: 'dems_lane_2_next', previous: 'dems_lane_2_prev', lockSlot: 2, kind: 'project' },
      { name: 'dems_lane_3', staging: 'dems_lane_3_next', previous: 'dems_lane_3_prev', lockSlot: 3, kind: 'project' },
    ]);
    expect(RESET_LOCK_CLASS).toBe(442001);
    expect(Object.isFrozen(guardResetTarget('dems_demo'))).toBe(true);
  });

  it('the staging suffix is the one the seed accepts for a project database', () => {
    expect(STAGING_SUFFIX).toBe(SEED_STAGING_SUFFIX);
    expect(PREVIOUS_SUFFIX).toBe('_prev');
    for (const name of PROJECT_DATABASES) expect(() => assertSeedTarget(guardResetTarget(name).staging, 'project')).not.toThrow();
  });

  it.each([
    ['the maintenance database', 'postgres'],
    ['a template of PostgreSQL', 'template0'],
    ['a template of PostgreSQL', 'template1'],
    ['a staging copy', 'dems_demo_next'],
    ['a previous copy', 'dems_lane_1_prev'],
    ['a staging copy of a staging copy', 'dems_demo_next_next'],
    ['a fourth lane', 'dems_lane_4'],
    ['lane zero', 'dems_lane_0'],
    ['another case', 'DEMS_DEMO'],
    ['a prefix of a project name', 'dems_dem'],
    ['a project name with a tail', 'dems_demo2'],
    ['a project name with a space', 'dems_demo '],
    ['an injected statement', 'dems_demo; DROP DATABASE postgres'],
    ['a quoted name', '"dems_demo"'],
    ['a name with a line break', 'dems_demo\npostgres'],
    ['a proof database', 'dems_proof_x'],
    ['a test database, with no test seam', `${RUN}f01_x`],
    ['an empty name', ''],
    ['no name', undefined],
    ['a number', 4432],
    ['null', null],
    ['an array', ['dems_demo']],
  ])('%s is refused before anything is read, at R-0, and is not echoed', (_label, name) => {
    const error = refusal(name);
    expect(error).toMatchObject({ code: 'RESET_TARGET_REFUSED', step: 'R-0', targetUntouched: true });
    expect(error.message).toMatch(/^refused before any connection: /);
    expect(error.message).toContain('A reset takes one of dems_demo, dems_lane_1, dems_lane_2, dems_lane_3.');
    if (typeof name === 'string' && name.length > 8 && !PROTECTED_DATABASES.includes(name as never)) expect(error.message).not.toContain(name);
  });

  it('the protected names are refused whatever the test seam says', () => {
    for (const name of PROTECTED_DATABASES) {
      expect(refusal(name, { testRunPrefix: RUN }).message).toContain('never reset');
      expect(refusal(name, { testRunPrefix: name }).code).toBe('RESET_TARGET_REFUSED');
    }
  });
});

describe('the test seam accepts only a per-file database of the caller\'s own run', () => {
  it('accepts <prefix>f<nn>_<slug> of that run, with a slot outside 0 to 3', () => {
    const target = guardResetTarget(`${RUN}f01_rs`, { testRunPrefix: RUN });
    expect(target).toMatchObject({ name: `${RUN}f01_rs`, staging: `${RUN}f01_rs_next`, previous: `${RUN}f01_rs_prev`, kind: 'test' });
    expect(target.lockSlot).toBeGreaterThanOrEqual(1_000);
    expect(target.lockSlot).toBeLessThan(2 ** 31);
    expect(Number.isInteger(target.lockSlot)).toBe(true);
    // The slot is stable for a name and differs between names.
    expect(guardResetTarget(`${RUN}f01_rs`, { testRunPrefix: RUN }).lockSlot).toBe(target.lockSlot);
    expect(guardResetTarget(`${RUN}f02_rs`, { testRunPrefix: RUN }).lockSlot).not.toBe(target.lockSlot);
  });

  it.each([
    ['a database of another run', 'dems_test_step_51_zzzz9999_f01_rs'],
    ['a database of another row', 'dems_test_step_43_abcd1234_f01_rs'],
    ['a template of the own run', `${RUN}tpl_seed`],
    ['a private template of the own run', `${RUN}tpl_x_w29empty`],
    ['the run prefix alone', RUN],
    ['a staging copy of an own database', `${RUN}f01_rs_next`],
    ['a previous copy of an own database', `${RUN}f01_rs_prev`],
    ['an own name with an upper-case letter', `${RUN}f01_Rs`],
    ['an own name without a counter', `${RUN}rs`],
  ])('%s is refused', (_label, name) => {
    expect(refusal(name, { testRunPrefix: RUN }).code).toBe('RESET_TARGET_REFUSED');
  });

  it('a prefix that is not a run prefix opens nothing', () => {
    for (const prefix of ['dems_test_', 'dems_', '', 'dems_test_step_51_', 'dems_test_step_51_abcd1234', 'dems_lane_']) {
      expect(refusal(`${RUN}f01_rs`, { testRunPrefix: prefix }).code).toBe('RESET_TARGET_REFUSED');
      expect(refusal('dems_test_x', { testRunPrefix: prefix }).code).toBe('RESET_TARGET_REFUSED');
    }
  });

  it('a name whose staging copy would not fit 63 bytes is refused', () => {
    const fits = `${RUN}f01_${'a'.repeat(27)}`;
    expect(`${fits}_next`).toHaveLength(63);
    expect(guardResetTarget(fits, { testRunPrefix: RUN }).staging).toBe(`${fits}_next`);
    const tooLong = `${RUN}f01_${'a'.repeat(28)}`;
    expect(refusal(tooLong, { testRunPrefix: RUN }).message).toContain('does not fit 63 bytes');
  });
});

describe('the database-level statements', () => {
  const lane = guardResetTarget('dems_lane_2');

  it('R-4 creates the staging database, empty, owned by the owner role', () => {
    expect(createStagingStatement(lane)).toBe(`CREATE DATABASE "dems_lane_2_next" OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`);
  });

  it('R-7 renames the target away and the staging database in; a first build has one rename', () => {
    expect(swapStatements(lane, true)).toEqual([
      'ALTER DATABASE "dems_lane_2" RENAME TO "dems_lane_2_prev"',
      'ALTER DATABASE "dems_lane_2_next" RENAME TO "dems_lane_2"',
    ]);
    expect(swapStatements(lane, false)).toEqual(['ALTER DATABASE "dems_lane_2_next" RENAME TO "dems_lane_2"']);
  });

  it('R-2 gives a previous database its name back', () => {
    expect(recoverStatement(lane)).toBe('ALTER DATABASE "dems_lane_2_prev" RENAME TO "dems_lane_2"');
  });

  it('a drop names a staging or previous database only, and is never forced', () => {
    expect(dropStatement(lane.staging)).toBe('DROP DATABASE "dems_lane_2_next"');
    expect(dropStatement(lane.previous)).toBe('DROP DATABASE "dems_lane_2_prev"');
    expect(dropStatement(lane.staging, { ifExists: true })).toBe('DROP DATABASE IF EXISTS "dems_lane_2_next"');
    for (const statement of [dropStatement(lane.staging), dropStatement(lane.previous), dropStatement(lane.staging, { ifExists: true })]) {
      expect(statement).not.toMatch(/FORCE/i);
    }
  });

  it('a drop of the target itself cannot be built, even with the type system switched off', () => {
    // The parameter type refuses a target name at compile time; this is the run-time net below it.
    for (const name of ['dems_lane_2', 'dems_demo', 'postgres', 'template1', `${RUN}f01_rs`]) {
      expect(() => dropStatement(name as unknown as DisposableDatabase)).toThrow(ResetError);
    }
  });

  it('a name is checked again where it becomes statement text', () => {
    for (const name of ['dems_demo"; DROP DATABASE postgres; --', 'dems demo', 'Dems_demo', '', '1dems', `dems_${'x'.repeat(60)}`]) {
      expect(() => quoteDatabase(name as unknown as TargetDatabase)).toThrow(ResetError);
    }
    expect(() => dropStatement('x"; DROP DATABASE dems_demo; --_next' as unknown as DisposableDatabase)).toThrow(ResetError);
    expect(quoteDatabase(lane.name)).toBe('"dems_lane_2"');
  });
});
