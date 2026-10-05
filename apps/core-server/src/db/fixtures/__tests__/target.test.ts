// The name guard of the bulk fixture (plan row W25; BF-1, TI-13, TI-17): the loader runs on a
// test database of the helper and on nothing else, and it decides on the NAME, before a
// connection is opened and before a statement is sent. Database-free: nothing here connects.
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { PROJECT_DATABASES } from '../../commands/database-names';
import { CLOSED_PORT } from '../../../../test/support/config';
import { loadBulkFixture } from '../load';
import { BulkFixtureError, assertBulkFixtureTarget, configuredDatabase, isBulkFixtureTarget } from '../target';

const REFUSED: readonly unknown[] = [
  'dems_demo',
  'dems_lane_1',
  'dems_lane_2',
  'dems_lane_3',
  'postgres',
  'template0',
  'template1',
  'dems_demo_next',
  'dems_demo_prev',
  'dems_lane_1_next',
  'dems_proof_drizzle',
  'dems_trial',
  'dems_test_',
  'dems_test',
  'DEMS_TEST_STEP_47',
  'dems_test_Step_47',
  'dems_test_step-47',
  'dems_test_step_47; SELECT 1',
  ' dems_test_step_47',
  'dems_test_step_47\n',
  'xdems_test_step_47',
  `dems_test_${'a'.repeat(60)}`,
  '',
  undefined,
  null,
  47,
  { database: 'dems_test_step_47' },
];

/** A stand-in for a pool that records every call: a refused load must leave it untouched. */
function recordingPool(database: unknown): { pool: Pool; calls: string[] } {
  const calls: string[] = [];
  const pool = {
    options: { database },
    query: async () => {
      calls.push('query');
      return { rows: [] };
    },
    connect: async () => {
      calls.push('connect');
      throw new Error('the stand-in pool was asked for a connection');
    },
  };
  return { pool: pool as unknown as Pool, calls };
}

describe('the name guard', () => {
  it('accepts the databases of the test helper: templates and per-file clones', () => {
    for (const name of [
      'dems_test_step_47_tmd8esp8_tpl_bulk',
      'dems_test_step_47_tmd8esp8_tpl_seed',
      'dems_test_step_47_tmd8esp8_f01_bulk_fixture',
      'dems_test_local_tmd008ab_f99_a',
      `dems_test_${'a'.repeat(53)}`,
    ]) {
      expect(isBulkFixtureTarget(name), name).toBe(true);
      expect(assertBulkFixtureTarget(name)).toBe(name);
    }
  });

  it.each(REFUSED.map((name) => [name]))('refuses %j', (name) => {
    expect(isBulkFixtureTarget(name)).toBe(false);
    expect(() => assertBulkFixtureTarget(name)).toThrow(BulkFixtureError);
  });

  it('refuses every project database and its two copies by name', () => {
    for (const name of PROJECT_DATABASES) {
      for (const candidate of [name, `${name}_next`, `${name}_prev`]) expect(isBulkFixtureTarget(candidate), candidate).toBe(false);
    }
  });

  it('the refusal carries the code TARGET_REFUSED and never echoes the refused value', () => {
    const marker = 'dems_demo_SECRETLOOKING_value';
    let caught: unknown;
    try {
      assertBulkFixtureTarget(marker);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BulkFixtureError);
    expect((caught as BulkFixtureError).code).toBe('TARGET_REFUSED');
    expect((caught as BulkFixtureError).message).not.toContain(marker);
    expect((caught as BulkFixtureError).message).toContain('dems_test_');
    expect((caught as BulkFixtureError).message).toContain('refused before any connection');
  });

  it('reads the configured database of a pool without connecting', () => {
    expect(configuredDatabase({ options: { database: 'dems_demo' } })).toBe('dems_demo');
    expect(configuredDatabase({ options: {} })).toBeUndefined();
    expect(configuredDatabase({})).toBeUndefined();
    expect(configuredDatabase(null)).toBeUndefined();
    expect(configuredDatabase('dems_test_x')).toBeUndefined();
  });
});

describe('the loader refuses before anything is sent', () => {
  it.each([['dems_demo'], ['dems_lane_1'], ['postgres'], ['dems_demo_next'], ['template1'], [undefined]])(
    'a pool configured for %j: TARGET_REFUSED, and the pool was never asked for a connection or a statement',
    async (database) => {
      const { pool, calls } = recordingPool(database);
      await expect(loadBulkFixture(pool, { now: 1 })).rejects.toMatchObject({ name: 'BulkFixtureError', code: 'TARGET_REFUSED' });
      expect(calls).toEqual([]);
    },
  );

  it.each([['dems_demo'], ['dems_lane_1'], ['postgres']])(
    'a real driver pool configured for %s is refused with no connection opened',
    async (database) => {
      // The port is one nothing listens on, and the password function throws: had the loader tried
      // to connect, the failure would be a refused connection, not TARGET_REFUSED.
      const pool = new Pool({
        host: '127.0.0.1',
        port: CLOSED_PORT,
        database,
        user: 'dems_owner',
        password: () => {
          throw new Error('the driver asked for the password');
        },
        ssl: false,
        max: 1,
        connectionTimeoutMillis: 500,
      });
      pool.on('error', () => undefined);
      try {
        await expect(loadBulkFixture(pool, { now: 1 })).rejects.toMatchObject({ code: 'TARGET_REFUSED' });
        expect([pool.totalCount, pool.idleCount, pool.waitingCount]).toEqual([0, 0, 0]);
      } finally {
        await pool.end();
      }
    },
  );

  it('a pool on a test database passes the guard and gets as far as the first statement', async () => {
    const { pool, calls } = recordingPool('dems_test_step_47_tmd8esp8_f01_x');
    // The stand-in answers the role question with no row: the loader stops at the role check.
    await expect(loadBulkFixture(pool, { now: 1 })).rejects.toMatchObject({ code: 'OWNER_ROLE_REFUSED' });
    expect(calls).toEqual(['query']);
  });
});
