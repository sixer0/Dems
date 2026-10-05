// The failure table of the reset routine, on real databases of the test run (plan row W29;
// database contract §8.5, the column "On failure"; T-RS-2).
//
// The rule under test: a failure before the swap has committed leaves the target EXACTLY as it
// was. "As it was" is checked three ways after every failure: the database behind the name is
// the same database (its OID), every one of its 30 tables has the same content digest, and
// nothing of the routine is left (no staging or previous database, no session, no lock).
//
// Two kinds of failure:
//   forced   an observer throws at a checkpoint, before the first statement of that part;
//   real     the server itself refuses a statement of the routine, or a check of the routine
//            finds what it must not find.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase, type TemplateDefinition, type TestDatabase } from '../../../../test/helpers/db';
import { RESET_CHECKPOINTS, ResetError, stepOf, type ResetCheckpoint, type ResetErrorCode } from '../errors';
import { guardResetTarget } from '../names';
import { resetDatabase, type ResetInternals, type ResetLogEntry, type ResetOptions, type ResetReport } from '../routine';
import { recordingPools, rewritesAppendOnlyTable, verbOf, watchedPools } from './pools';
import {
  FIRST_RESET_NOW,
  RECORDED_SESSION_ROWS,
  SEED_NOW,
  appendAuditRows,
  catalogOf,
  createLeftover,
  digestAll,
  discard,
  dropOwn,
  dumpKept,
  failAt,
  lineageRows,
  maintenancePool,
  PATIENT_MS,
  plantKeptRows,
  quiet,
  renameOwn,
  resetApplicationName,
  resetLockHeld,
  sessionsOf,
  sha256,
  untilNoSession,
} from '../../../../test/support/reset';

const db = useTestDatabase({ template: 'seed', slug: 'rf' });

// A reset under load takes a few times longer than on a quiet host, and several tests wait for
// the server to drop closed sessions: neither is a reason to fail. The limits below are caps.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const MINUTE = 60_000;
/**
 * How long the ROUTINE waits for sessions to end before it refuses (its `sessionDrainMs`; the
 * production default is 3 s and is not changed). A test that expects a reset to go through gives
 * it a generous bound, which costs nothing when no session is there; only a test that holds a
 * session ON PURPOSE and expects the refusal gives it a short one, so that the refusal is quick.
 */
const SHORT_DRAIN_MS = 400;
/** The `application_name` of the routine's connections in this file and this run: see `resetApplicationName`. */
let application = '';
/** A database with nothing in it: created, never migrated. */
const NOT_MIGRATED: TemplateDefinition = Object.freeze({ key: 'x_w29empty', base: 'empty', build: async () => {} });

let maintenance: Pool;
let internals: ResetInternals;

beforeAll(async () => {
  maintenance = maintenancePool(db.run.dataDir);
  internals = { testRunPrefix: db.run.identity.prefix };
  application = resetApplicationName(db.run.identity.stamp, 'rf');
  // A used Core, so that an "untouched" database has something to lose.
  await plantKeptRows(db.ownerPool());
  await appendAuditRows(db.ownerPool(), RECORDED_SESSION_ROWS, SEED_NOW + 30 * MINUTE);
});

afterAll(async () => {
  // A plain drop of this file's own databases, before the helper's forced one (see `discard`).
  await db.database.closeResources();
  for (const name of [`${db.name}_next`, `${db.name}_prev`, db.name]) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
});

interface Snapshot {
  readonly oid: string | undefined;
  readonly digests: Record<string, string>;
}

async function snapshot(database: TestDatabase): Promise<Snapshot> {
  const catalog = await catalogOf(maintenance, [database.name]);
  return { oid: catalog[database.name]?.oid, digests: await digestAll(database.ownerPool()) };
}

function options(database: TestDatabase, more: Partial<ResetOptions> = {}): ResetOptions {
  return { database: database.name, clock: () => FIRST_RESET_NOW, dataDir: db.run.dataDir, applicationName: application, sessionDrainMs: PATIENT_MS, ...more };
}

/** Runs a reset that must fail and returns its error. The test's own pools on the target are closed first. */
async function failing(database: TestDatabase, more: Partial<ResetOptions> = {}, seams: ResetInternals = internals): Promise<ResetError> {
  await quiet(maintenance, database);
  const outcome = await resetDatabase(options(database, more), seams).then(
    (report) => report,
    (error: unknown) => error,
  );
  if (!(outcome instanceof ResetError)) throw new Error(`the reset did not fail with a ResetError: ${outcome instanceof Error ? outcome.name : 'it succeeded'}`);
  return outcome;
}

/** Nothing of the routine is left: no staging or previous database, no session of it, its lock free. */
async function expectNothingLeft(database: TestDatabase): Promise<void> {
  const catalog = await catalogOf(maintenance, [`${database.name}_next`, `${database.name}_prev`]);
  expect(catalog[`${database.name}_next`], 'staging database').toBeUndefined();
  expect(catalog[`${database.name}_prev`], 'previous database').toBeUndefined();
  // The routine's promise has settled, so its connections are closed (R-9); the server drops the
  // backends a moment later. Only this run's own name is asked for.
  await untilNoSession(maintenance, { applications: [application] }, `sessions of the routine (${application}) after it settled`);
  const slot = guardResetTarget(database.name, internals).lockSlot;
  expect(await resetLockHeld(maintenance, slot), 'advisory lock').toBe(false);
}

async function expectUntouched(database: TestDatabase, before: Snapshot): Promise<void> {
  const after = await snapshot(database);
  expect(after.oid, 'the database behind the name').toBe(before.oid);
  expect(after.digests).toEqual(before.digests);
  await expectNothingLeft(database);
}

const EXPECTED_CODE: Readonly<Record<string, ResetErrorCode>> = {
  'R-0': 'RESET_DATABASE_UNREACHABLE',
  'R-1': 'RESET_QUIESCE_FAILED',
  'R-2': 'RESET_LEFTOVER_FAILED',
  'R-3': 'RESET_READ_FAILED',
  'R-4': 'RESET_CREATE_FAILED',
  'R-5': 'RESET_BUILD_FAILED',
  'R-6': 'RESET_VERIFY_FAILED',
  'R-7': 'RESET_SWAP_FAILED',
};

describe('a forced failure at every checkpoint before the swap leaves the target untouched', () => {
  const beforeSwap = RESET_CHECKPOINTS.filter((checkpoint) => checkpoint !== 'R-8' && checkpoint !== 'R-9');

  it('covers every checkpoint of the routine up to the renames', () => {
    expect(beforeSwap).toEqual(['R-0', 'R-1', 'R-2', 'R-3', 'R-4', 'R-5a', 'R-5b', 'R-5c', 'R-5d', 'R-5e', 'R-5f', 'R-5:commit', 'R-6', 'R-7', 'R-7:rename']);
  });

  it.each(beforeSwap)('%s', async (checkpoint: ResetCheckpoint) => {
    const before = await snapshot(db.database);
    const injected = failAt(checkpoint);
    const error = await failing(db.database, { onCheckpoint: injected.onCheckpoint });

    expect(error.step).toBe(stepOf(checkpoint));
    expect(error.code).toBe(EXPECTED_CODE[stepOf(checkpoint)]);
    expect(error.targetUntouched).toBe(true);
    // The routine stopped where it was told to: nothing after that checkpoint was reached.
    expect(injected.seen.at(-1)).toBe(checkpoint);
    expect(injected.seen).toEqual(RESET_CHECKPOINTS.slice(0, RESET_CHECKPOINTS.indexOf(checkpoint) + 1));
    await expectUntouched(db.database, before);
  });

  it('after fifteen failed resets the database is still the one it was, and one reset then succeeds', async () => {
    const before = await snapshot(db.database);
    expect((await lineageRows(db.ownerPool())).length).toBe(0);
    await quiet(maintenance, db.database);
    const report = await resetDatabase(options(db.database), internals);
    expect(report).toMatchObject({ firstBuild: false, previousEpoch: 0, epoch: 1, previousDropped: true, leftoversRemoved: [] });
    expect(report.lineage.appended).toMatchObject({ resetNo: '1', rowCount: '84', epoch: '0' });
    expect((await snapshot(db.database)).oid).not.toBe(before.oid);
    await expectNothingLeft(db.database);
  });
});

describe('after the swap a failure does not undo the reset', () => {
  it('R-8 forced: the reset succeeded, the previous database is left, and the next reset removes it at R-2', async () => {
    const before = await snapshot(db.database);
    await quiet(maintenance, db.database);
    const logged: ResetLogEntry[] = [];
    const report = await resetDatabase(options(db.database, { onCheckpoint: failAt('R-8').onCheckpoint, log: (entry) => logged.push(entry) }), internals);
    expect(report.previousDropped).toBe(false);
    expect(logged.map((entry) => entry.code)).toContain('RESET_PREVIOUS_LEFT');
    const names = [db.name, `${db.name}_prev`, `${db.name}_next`];
    const catalog = await catalogOf(maintenance, names);
    expect(catalog[db.name]?.oid).not.toBe(before.oid);
    // The old database still exists under the previous name: it is the same database as before.
    expect(catalog[`${db.name}_prev`]?.oid).toBe(before.oid);
    expect(catalog[`${db.name}_next`]).toBeUndefined();

    await quiet(maintenance, db.database);
    const next = await resetDatabase(options(db.database), internals);
    expect(next.leftoversRemoved).toEqual([`${db.name}_prev`]);
    expect(next.previousDropped).toBe(true);
    await expectNothingLeft(db.database);
  });

  it('R-9 forced: the report is returned and nothing is left open', async () => {
    await quiet(maintenance, db.database);
    const report = await resetDatabase(options(db.database, { onCheckpoint: failAt('R-9').onCheckpoint }), internals);
    expect(report.previousDropped).toBe(true);
    await expectNothingLeft(db.database);
  });

  it('R-8 real: a session on the previous database makes the drop fail; the reset still succeeded', async () => {
    const before = await snapshot(db.database);
    await quiet(maintenance, db.database);
    const previous = `${db.name}_prev`;
    let holder: Pool | undefined;
    const logged: ResetLogEntry[] = [];
    const report = await resetDatabase(
      options(db.database, {
        log: (entry) => logged.push(entry),
        async onCheckpoint(checkpoint) {
          if (checkpoint !== 'R-8') return;
          // The old database has just been renamed; somebody connects to it under its new name.
          holder = db.run.poolOn(previous, 'owner', 'dems-test-reset-holder');
          await holder.query('SELECT 1');
        },
      }),
      internals,
    );
    try {
      expect(report.previousDropped).toBe(false);
      const left = logged.find((entry) => entry.code === 'RESET_PREVIOUS_LEFT');
      expect(left?.message).toContain('SQLSTATE 55006');
      const catalog = await catalogOf(maintenance, [db.name, previous]);
      expect(catalog[previous]?.oid).toBe(before.oid);
      expect(catalog[db.name]?.oid).not.toBe(before.oid);
      // The routine ended nobody's session: the holder still answers.
      expect((await holder?.query('SELECT 1 AS one'))?.rows).toEqual([{ one: 1 }]);
    } finally {
      await holder?.end();
    }
    await quiet(maintenance, db.database);
    const next = await resetDatabase(options(db.database), internals);
    expect(next.leftoversRemoved).toEqual([previous]);
    await expectNothingLeft(db.database);
  });
});

describe('R-0: refusals before anything is touched', () => {
  it('the advisory lock is held by another session: RESET_ALREADY_RUNNING, and nothing was touched', async () => {
    const before = await snapshot(db.database);
    const slot = guardResetTarget(db.name, internals).lockSlot;
    const other: PoolClient = await maintenance.connect();
    try {
      await other.query('SELECT pg_advisory_lock(442001, $1::int)', [slot]);
      let quiesced = 0;
      const injected = failAt('R-9');
      const error = await failing(db.database, { quiesce: () => void (quiesced += 1), onCheckpoint: injected.onCheckpoint });
      expect(error).toMatchObject({ code: 'RESET_ALREADY_RUNNING', step: 'R-0', targetUntouched: true });
      expect(error.message).toContain(`(advisory lock 442001, ${slot})`);
      // R-1 was never reached: the caller was not asked to quiesce.
      expect(quiesced).toBe(0);
      expect(injected.seen).toEqual(['R-0']);
      // The other session still holds its lock: the refused reset did not release it.
      expect(await resetLockHeld(maintenance, slot)).toBe(true);
    } finally {
      await other.query('SELECT pg_advisory_unlock(442001, $1::int)', [slot]);
      other.release();
    }
    await expectUntouched(db.database, before);
  });

  it('two resets of one database at the same time: the second is refused, the first completes', async () => {
    const before = await snapshot(db.database);
    await quiet(maintenance, db.database);
    let release: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reachedCreate: () => void = () => undefined;
    const atCreate = new Promise<void>((resolve) => {
      reachedCreate = resolve;
    });
    const first = resetDatabase(
      options(db.database, {
        async onCheckpoint(checkpoint) {
          if (checkpoint !== 'R-4') return;
          reachedCreate();
          await paused;
        },
      }),
      internals,
    );
    await atCreate;
    // The first reset holds the lock and waits before CREATE DATABASE; the second arrives now.
    const second = await resetDatabase(options(db.database), internals).then(
      () => 'succeeded',
      (error: unknown) => error,
    );
    expect(second).toBeInstanceOf(ResetError);
    expect(second).toMatchObject({ code: 'RESET_ALREADY_RUNNING', step: 'R-0', targetUntouched: true });
    // Nothing of the second is in the way of the first.
    release();
    const report: ResetReport = await first;
    expect(report.previousDropped).toBe(true);
    expect((await snapshot(db.database)).oid).not.toBe(before.oid);
    await expectNothingLeft(db.database);
  });

  it('the owner connection file is missing: RESET_OWNER_CREDENTIALS, and the message names the file and the provisioning command', async () => {
    const before = await snapshot(db.database);
    const empty = mkdtempSync(join(tmpdir(), 'dems-w29-nofile-'));
    try {
      const error = await failing(db.database, { dataDir: empty });
      expect(error).toMatchObject({ code: 'RESET_OWNER_CREDENTIALS', step: 'R-0', targetUntouched: true });
      expect(error.message).toMatch(/pg\.owner\.env cannot be read \(ENOENT\)\. It is created with the cluster: run "npm run pg:init"\.$/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
    await expectUntouched(db.database, before);
  });
});

describe('R-1: a database in use is not reset, and nobody is disconnected', () => {
  it.each(['dems_app', 'dems_owner'] as const)('a session of %s on the target: RESET_TARGET_IN_USE', async (role) => {
    const before = await snapshot(db.database);
    await quiet(maintenance, db.database);
    // The server did not close its pool (or the lane backend still runs): one session stays.
    const pool = role === 'dems_app' ? db.appPool() : db.ownerPool();
    const held = await pool.connect();
    try {
      const pid = (await held.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
      const started = Date.now();
      // A session is held on purpose: the routine waits its drain time, then refuses.
      const outcome = await resetDatabase(options(db.database, { sessionDrainMs: SHORT_DRAIN_MS }), internals).then(
        () => 'succeeded',
        (error: unknown) => error,
      );
      expect(outcome).toBeInstanceOf(ResetError);
      expect(outcome).toMatchObject({ code: 'RESET_TARGET_IN_USE', step: 'R-1', targetUntouched: true });
      expect((outcome as ResetError).message).toContain(`1 of role ${role} on ${db.name}`);
      expect((outcome as ResetError).message).toContain("The reset ends nobody's session");
      // It waited for the session to go (the drain time of this call is 400 ms), then refused.
      expect(Date.now() - started).toBeGreaterThanOrEqual(350);
      // The session is the same backend as before and still answers: it was not ended.
      expect((await held.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid).toBe(pid);
      expect(await sessionsOf(maintenance, { databases: [db.name] })).toEqual([
        { database: db.name, role, application: role === 'dems_app' ? 'dems-test-app' : 'dems-test-fixture' },
      ]);
    } finally {
      held.release();
    }
    await expectUntouched(db.database, before);
  });

  it('a quiesce hook that throws: RESET_QUIESCE_FAILED, and nothing was read or built', async () => {
    const before = await snapshot(db.database);
    const injected = failAt('R-9');
    const error = await failing(db.database, {
      quiesce: () => {
        throw new Error('the pipeline did not drain');
      },
      onCheckpoint: injected.onCheckpoint,
    });
    expect(error).toMatchObject({ code: 'RESET_QUIESCE_FAILED', step: 'R-1', targetUntouched: true });
    expect(injected.seen).toEqual(['R-0', 'R-1']);
    await expectUntouched(db.database, before);
  });

  it('the quiesce hook runs after R-0 passed and before anything is read, and the clock is read once, after it', async () => {
    await quiet(maintenance, db.database);
    const order: string[] = [];
    const report = await resetDatabase(
      options(db.database, {
        quiesce: () => void order.push('quiesce'),
        clock: () => (order.push('clock'), FIRST_RESET_NOW + 5 * MINUTE),
        onCheckpoint: (checkpoint) => void order.push(checkpoint),
      }),
      internals,
    );
    expect(order.slice(0, 5)).toEqual(['R-0', 'R-1', 'quiesce', 'clock', 'R-2']);
    expect(order.filter((entry) => entry === 'clock')).toHaveLength(1);
    expect(order.filter((entry) => entry === 'quiesce')).toHaveLength(1);
    expect(report.now).toBe(FIRST_RESET_NOW + 5 * MINUTE);
  });
});

describe('R-2: leftovers of an earlier run', () => {
  it('a staging database that an earlier run left is dropped, and the reset goes on', async () => {
    const staging = `${db.name}_next`;
    await createLeftover(maintenance, staging, db.run.identity.prefix);
    const leftover = (await catalogOf(maintenance, [staging]))[staging]?.oid;
    expect(leftover).toBeDefined();
    await quiet(maintenance, db.database);
    const logged: ResetLogEntry[] = [];
    const report = await resetDatabase(options(db.database, { log: (entry) => logged.push(entry) }), internals);
    expect(report.leftoversRemoved).toEqual([staging]);
    expect(logged.map((entry) => entry.code)).toContain('RESET_LEFTOVER_REMOVED');
    await expectNothingLeft(db.database);
  });

  it('the target is missing and its previous database exists: it gets its name back, with its data, and the routine stops with RESET_RECOVERED_PREVIOUS', async () => {
    const before = await snapshot(db.database);
    await quiet(maintenance, db.database);
    // What a lost swap would leave: the old database under the previous name, and no target.
    await renameOwn(maintenance, db.name, `${db.name}_prev`, db.run.identity.prefix);
    expect((await catalogOf(maintenance, [db.name]))[db.name]).toBeUndefined();

    const error = await resetDatabase(options(db.database), internals).then(
      () => undefined,
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(ResetError);
    expect(error).toMatchObject({ code: 'RESET_RECOVERED_PREVIOUS', step: 'R-2', targetUntouched: true });
    // The same database, the same content, under its own name again.
    await expectUntouched(db.database, before);

    // "Run the reset again": now it goes through.
    await quiet(maintenance, db.database);
    const report = await resetDatabase(options(db.database), internals);
    expect(report.previousDropped).toBe(true);
    expect(report.leftoversRemoved).toEqual([]);
  });
});

describe('R-3: the target is not at the schema version of this code', () => {
  it('a database that was created and never migrated: RESET_SCHEMA_MISMATCH, and it stays as it is', async () => {
    const bare = await db.another({ template: NOT_MIGRATED, slug: 'rfbare' });
    const oid = (await catalogOf(maintenance, [bare.name]))[bare.name]?.oid;
    const error = await failing(bare);
    expect(error).toMatchObject({ code: 'RESET_SCHEMA_MISMATCH', step: 'R-3', targetUntouched: true });
    expect(error.message).toContain('has no schema');
    expect(error.message).toContain(`npm run db:migrate -w @dems/core-server -- --database ${bare.name}`);
    expect((await catalogOf(maintenance, [bare.name]))[bare.name]?.oid).toBe(oid);
    await expectNothingLeft(bare);
    await discard(maintenance, bare, db.run.identity.prefix);
  });

  it('a database at another schema version: RESET_SCHEMA_MISMATCH before anything is created', async () => {
    const other = await db.another({ template: 'seed', slug: 'rfver' });
    await other.ownerPool().query('UPDATE public.schema_meta SET schema_version = 2');
    const before = await snapshot(other);
    const injected = failAt('R-9');
    const error = await failing(other, { onCheckpoint: injected.onCheckpoint });
    expect(error).toMatchObject({ code: 'RESET_SCHEMA_MISMATCH', step: 'R-3' });
    expect(error.message).toContain('is at schema version 2 (dbc-2); this code builds version 1 (dbc-2)');
    expect(injected.seen).toEqual(['R-0', 'R-1', 'R-2', 'R-3']);
    await expectUntouched(other, before);
    await discard(maintenance, other, db.run.identity.prefix);
  });
});

describe('R-4: the staging database cannot be created', () => {
  it('a database of that name appears after R-2: CREATE fails with 42P04, the target is untouched', async () => {
    const before = await snapshot(db.database);
    const error = await failing(db.database, {
      async onCheckpoint(checkpoint) {
        if (checkpoint === 'R-4') await createLeftover(maintenance, `${db.name}_next`, db.run.identity.prefix);
      },
    });
    expect(error).toMatchObject({ code: 'RESET_CREATE_FAILED', step: 'R-4', sqlState: '42P04', targetUntouched: true });
    await expectUntouched(db.database, before);
  });
});

describe('R-5: the build fails; the live database was not touched', () => {
  it('T-RS-2: a carried session names an operator the seed does not create (23503)', async () => {
    const used = await db.another({ template: 'seed', slug: 'rf2' });
    await plantKeptRows(used.ownerPool());
    await used.ownerPool().query(
      "INSERT INTO public.operators (id, username, name, display_name, initials, role_id, created_at, updated_at) VALUES ('OPR-099', 'w29ghost', 'Fixture', 'Fixture', 'FX', 'TECHNICIAN', $1, $1)",
      [SEED_NOW],
    );
    const ghostToken = sha256('w29-fixture-ghost-session');
    await used
      .ownerPool()
      .query("INSERT INTO public.auth_sessions (token_hash, operator_id, method, issued_at, last_seen_at, absolute_expires_at) VALUES ($1, 'OPR-099', 'PASSWORD', $2, $2, $3)", [
        ghostToken,
        SEED_NOW + MINUTE,
        SEED_NOW + 600 * MINUTE,
      ]);
    const before = await snapshot(used);
    const keptBefore = await dumpKept(used.ownerPool());

    const injected = failAt('R-9');
    const error = await failing(used, { onCheckpoint: injected.onCheckpoint });
    expect(error).toMatchObject({
      code: 'RESET_BUILD_FAILED',
      step: 'R-5',
      sqlState: '23503',
      constraint: 'auth_sessions_operator_id_fkey',
      table: 'auth_sessions',
      targetUntouched: true,
    });
    // The carry-over began and stopped; the lineage row and the new chain's row were never written.
    expect(injected.seen.at(-1)).toBe('R-5c');
    // The message names the constraint, and neither the operator nor a hash.
    expect(error.message).toBe('R-5 failed: the server answered SQLSTATE 23503 (constraint auth_sessions_operator_id_fkey, table auth_sessions).');
    expect(error.message).not.toContain('OPR-099');
    expect(error.message).not.toContain(ghostToken.toString('hex'));
    expect(error.cause).toBeUndefined();

    await expectUntouched(used, before);
    expect(await dumpKept(used.ownerPool())).toEqual(keptBefore);
    expect(await lineageRows(used.ownerPool())).toEqual([]);
    await discard(maintenance, used, db.run.identity.prefix);
  });

  it('the migrations cannot be applied (R-5a): the staging database is dropped again', async () => {
    const before = await snapshot(db.database);
    const error = await failing(db.database, {}, { ...internals, migrationsFolder: '/nonexistent/dems-w29-migrations' });
    expect(error).toMatchObject({ code: 'RESET_BUILD_FAILED', step: 'R-5', targetUntouched: true });
    expect(error.message).toContain('there is no migration set to read');
    await expectUntouched(db.database, before);
  });

  it('a clock that is behind an ACTIVE code (R-5d): the close violates a CHECK (23514), nothing is swapped', async () => {
    const used = await db.another({ template: 'seed', slug: 'rf5d' });
    await plantKeptRows(used.ownerPool());
    const before = await snapshot(used);
    // The ACTIVE code was issued 40 minutes after the seed; this clock says 10.
    const error = await failing(used, { clock: () => SEED_NOW + 10 * MINUTE });
    expect(error).toMatchObject({ code: 'RESET_BUILD_FAILED', step: 'R-5', sqlState: '23514', constraint: 'pairing_codes_times_check', targetUntouched: true });
    await expectUntouched(used, before);
    await discard(maintenance, used, db.run.identity.prefix);
  });

  it('an actor the seed does not create (R-5d, R-5e): a foreign key refuses it (23503)', async () => {
    const before = await snapshot(db.database);
    const error = await failing(db.database, { actorId: 'OPR-777' });
    expect(error).toMatchObject({ code: 'RESET_BUILD_FAILED', step: 'R-5', sqlState: '23503', targetUntouched: true });
    expect(error.message).not.toContain('OPR-777');
    await expectUntouched(db.database, before);
  });
});

describe('R-6: a staging database that is not what R-3 read is not swapped in', () => {
  // Each case changes the staging database as its owner at the start of R-6, the way a defect
  // of the build would, on a clone of its own.
  it.each([
    ['a carried row was changed', "UPDATE public.paired_devices SET last_seen_at = last_seen_at + 1 WHERE id = 'DEV-0001'", 'paired_devices: row 1 differs from the row that was read.'],
    ['a carried row is missing', "DELETE FROM public.biometric_tokens WHERE device_id = 'DEV-0002'", 'biometric_tokens: 3 row(s) were read, 3 are expected and 2 are in the new database.'],
    ['a carried counter was changed', "UPDATE public.registry_counters SET next_value = next_value + 1 WHERE name = 'device'", 'registry_counters: row 1 differs from the row that was read.'],
    ['the code that was ACTIVE is ACTIVE again', "UPDATE public.pairing_codes SET state = 'ACTIVE', closed_at = NULL WHERE id = 'PCD-000005'", 'pairing_codes: the code that was ACTIVE (row 5) is not closed as CANCELLED by this reset.'],
    ['the runtime role may update the audit table', 'GRANT UPDATE ON public.audit_log TO dems_app', 'the runtime role dems_app holds UPDATE on public.audit_log; it must hold none of them (B-5).'],
    ['a guard trigger is no longer ENABLE ALWAYS', 'ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_append_only', 'the audit triggers are [audit_chain_history_append_only=A, audit_log_append_only=O, audit_log_chain_guard=A]'],
    ['the epoch is not the continued one', 'UPDATE public.core_state SET epoch = epoch + 5', 'core_state.epoch is'],
  ])('%s: RESET_VERIFY_FAILED', async (_label, statement, problem) => {
    const used = await db.another({ template: 'seed', slug: 'rf6' });
    await plantKeptRows(used.ownerPool());
    const before = await snapshot(used);
    await quiet(maintenance, used);
    const outcome = await resetDatabase(
      {
        ...options(used),
        async onCheckpoint(checkpoint) {
          if (checkpoint !== 'R-6') return;
          const pool = db.run.poolOn(`${used.name}_next`, 'owner', 'dems-test-reset-tamper');
          try {
            await pool.query(statement);
          } finally {
            await pool.end();
          }
        },
      },
      internals,
    ).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(outcome).toBeInstanceOf(ResetError);
    expect(outcome).toMatchObject({ code: 'RESET_VERIFY_FAILED', step: 'R-6', targetUntouched: true });
    expect((outcome as ResetError).message).toContain(problem);
    await expectUntouched(used, before);
    await discard(maintenance, used, db.run.identity.prefix);
  });
});

describe('R-7: a session that appears during the reset stops the swap', () => {
  it('found by the check before the renames: RESET_TARGET_IN_USE at R-7', async () => {
    const before = await snapshot(db.database);
    await quiet(maintenance, db.database);
    let held: PoolClient | undefined;
    const outcome = await resetDatabase(
      options(db.database, {
        // A session is held on purpose from R-7 on: the routine waits its drain time, then refuses.
        sessionDrainMs: SHORT_DRAIN_MS,
        async onCheckpoint(checkpoint) {
          // The server reopened its pool too early (or a lane backend was started meanwhile).
          if (checkpoint === 'R-7') held = await db.appPool().connect();
        },
      }),
      internals,
    ).then(
      () => undefined,
      (error: unknown) => error,
    );
    try {
      expect(outcome).toBeInstanceOf(ResetError);
      expect(outcome).toMatchObject({ code: 'RESET_TARGET_IN_USE', step: 'R-7', targetUntouched: true });
      expect((outcome as ResetError).message).toContain(`1 of role dems_app on ${db.name}`);
      expect((await held?.query('SELECT 1 AS one'))?.rows).toEqual([{ one: 1 }]);
    } finally {
      held?.release();
    }
    await expectUntouched(db.database, before);
  });

  it('found by PostgreSQL itself at the rename: 55006, the transaction rolls back, RESET_SWAP_FAILED', async () => {
    const before = await snapshot(db.database);
    await quiet(maintenance, db.database);
    let held: PoolClient | undefined;
    const outcome = await resetDatabase(
      options(db.database, {
        async onCheckpoint(checkpoint) {
          // After the routine's own check, immediately before BEGIN.
          if (checkpoint === 'R-7:rename') held = await db.appPool().connect();
        },
      }),
      internals,
    ).then(
      () => undefined,
      (error: unknown) => error,
    );
    try {
      expect(outcome).toBeInstanceOf(ResetError);
      expect(outcome).toMatchObject({ code: 'RESET_SWAP_FAILED', step: 'R-7', sqlState: '55006', targetUntouched: true });
      expect((outcome as ResetError).message).toContain('the transaction was rolled back');
      expect((await held?.query('SELECT 1 AS one'))?.rows).toEqual([{ one: 1 }]);
    } finally {
      held?.release();
    }
    await expectUntouched(db.database, before);
  });
});

describe('what the routine sends, statement by statement', () => {
  it('only the target and its two copies are created, renamed or dropped; no append-only table is rewritten; three databases are connected to', async () => {
    const used = await db.another({ template: 'seed', slug: 'rfwire' });
    await plantKeptRows(used.ownerPool());
    await quiet(maintenance, used);
    const recorder = recordingPools(db.run.dataDir);
    const report = await resetDatabase(options(used, { actorId: 'OPR-002' }), { ...internals, openPool: recorder.openPool });
    expect(report.cancelledPairingCodes).toBe(1);

    const [target, staging, previous] = [used.name, `${used.name}_next`, `${used.name}_prev`];
    // The connections: the maintenance database, the target (R-3), the staging database (R-5, R-6).
    expect(recorder.opened).toEqual(['postgres', target, staging]);
    console.log(`[w29] statements of one reset, by database: ${['postgres', target, staging].map((name) => `${name.replace(used.name, '<t>')} ${recorder.sent.filter((entry) => entry.database === name).length}`).join(', ')}`);
    expect(recorder.sent.length).toBeGreaterThan(150);

    const texts = recorder.sent.map((entry) => entry.text);
    const database = texts.filter((text) => /\b(?:CREATE|ALTER|DROP)\s+DATABASE\b/i.test(text));
    expect(database).toEqual([
      `CREATE DATABASE "${staging}" OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`,
      `ALTER DATABASE "${target}" RENAME TO "${previous}"`,
      `ALTER DATABASE "${staging}" RENAME TO "${target}"`,
      `DROP DATABASE "${previous}"`,
    ]);
    // The drop is the last database statement, after the swap committed: the old database goes last.
    expect(texts.indexOf(`DROP DATABASE "${previous}"`)).toBeGreaterThan(texts.lastIndexOf('COMMIT'));
    expect(database.filter((text) => /WITH\s*\(\s*FORCE\s*\)/i.test(text))).toEqual([]);

    // No UPDATE, DELETE or TRUNCATE of audit_log or audit_chain_history, in any of the statements
    // (the routine's own, the migrator's, the seed's).
    expect(texts.filter(rewritesAppendOnlyTable)).toEqual([]);
    // The classifier does find such a statement when there is one.
    expect(['UPDATE public.audit_log SET message = $1', 'delete from audit_chain_history', 'TRUNCATE public.audit_log, public.events'].every(rewritesAppendOnlyTable)).toBe(true);
    expect(rewritesAppendOnlyTable('CREATE TRIGGER x BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_log FOR EACH STATEMENT EXECUTE FUNCTION f()')).toBe(false);

    // On the old database the routine only reads.
    const onTarget = recorder.sent.filter((entry) => entry.database === target).map((entry) => verbOf(entry.text));
    expect([...new Set(onTarget)].sort()).toEqual(['BEGIN', 'COMMIT', 'SELECT']);
    expect(texts).toContain('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    // On the maintenance database: reads, the lock, and the four database statements.
    const onMaintenance = recorder.sent.filter((entry) => entry.database === 'postgres').map((entry) => verbOf(entry.text));
    expect([...new Set(onMaintenance)].sort()).toEqual(['ALTER', 'BEGIN', 'COMMIT', 'CREATE', 'DROP', 'SELECT']);
    // The first statement of every connection is the role check.
    for (const name of ['postgres', target, staging]) {
      expect(recorder.sent.find((entry) => entry.database === name)?.text, name).toBe('SELECT rolname::text AS rolname, rolsuper FROM pg_roles WHERE rolname = current_user');
    }
    // No statement ends, cancels or signals another session, and none changes a role or a setting.
    expect(texts.filter((text) => /pg_terminate_backend|pg_cancel_backend|\bCREATE\s+ROLE\b|\bALTER\s+ROLE\b|\bSET\s+ROLE\b|\bSET\s+SESSION\b/i.test(text))).toEqual([]);

    // ── A second reset of the same database, recorded too: now a lineage row is carried as well.
    const second = recordingPools(db.run.dataDir);
    const again = await resetDatabase(options(used, { actorId: 'OPR-002', clock: () => FIRST_RESET_NOW + MINUTE }), { ...internals, openPool: second.openPool });
    expect(again.lineage).toMatchObject({ carried: 1, total: 2 });

    // The whole trace, condensed: one line per statement, a run of equal lines counted.
    const trace: string[] = [];
    for (const entry of second.sent) {
      const line = `${entry.database.replace(used.name, '<t>').padEnd(9)} ${entry.text.replace(/\s+/g, ' ').slice(0, 96)}`;
      const last = trace.at(-1);
      const repeated = last === undefined ? null : /^(.*?)(?:  \[x(\d+)\])?$/.exec(last);
      if (repeated !== null && repeated[1] === line) trace[trace.length - 1] = `${line}  [x${Number(repeated[2] ?? 1) + 1}]`;
      else trace.push(line);
    }
    console.log(`[w29] trace of one reset (${second.sent.length} statements):\n${trace.map((line) => `  ${line}`).join('\n')}`);

    // R-5 is ONE transaction on the staging database, in the order of the contract.
    const build = second.sent.filter((entry) => entry.database === staging).map((entry) => entry.text);
    const transaction = build.slice(build.indexOf('BEGIN'), build.indexOf('COMMIT') + 1);
    expect(build.filter((text) => text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK')).toEqual(['BEGIN', 'COMMIT']);
    const first = (fragment: string): number => transaction.findIndex((text) => text.includes(fragment));
    const last = (fragment: string): number => transaction.findLastIndex((text) => text.includes(fragment));
    const order: Array<readonly [string, number]> = [
      ['BEGIN', first('BEGIN')],
      ['(b) the chain lock, the first statement of the transaction (AP-2)', first('audit_chain_lock()')],
      ['(b) the seed: roles', first('insert into "roles"')],
      ['(b) the seed: the first audit row', first('insert into "audit_log"')],
      ['(b) the seed: the last event', first('insert into "events"')],
      ['(c) UPDATE registry_counters', first('UPDATE public.registry_counters AS n SET')],
      ['(c) UPDATE console_settings', first('UPDATE public.console_settings AS n SET')],
      ['(c) INSERT pairing_codes', first('INSERT INTO public.pairing_codes (')],
      ['(c) INSERT paired_devices', first('INSERT INTO public.paired_devices (')],
      ['(c) INSERT device_credentials', first('INSERT INTO public.device_credentials (')],
      ['(c) INSERT auth_sessions', first('INSERT INTO public.auth_sessions (')],
      ['(c) INSERT biometric_tokens', first('INSERT INTO public.biometric_tokens (')],
      ['(c) INSERT audit_chain_history, the carried rows', first('INSERT INTO public.audit_chain_history ("reset_no"')],
      ['(d) the ACTIVE code is CANCELLED', first("UPDATE public.pairing_codes SET state = 'CANCELLED'")],
      ['(d) operators.last_sign_in_at', first('UPDATE public.operators AS o SET last_sign_in_at')],
      ['(e) the lineage row', first('INSERT INTO public.audit_chain_history (reset_no, epoch')],
      ['(f) the chain lock again (AP-2, AP-6)', last('audit_chain_lock()')],
      ['(f) the SCENARIO_LOADED audit row', last('insert into "audit_log"')],
      ['(f) the SCENARIO_LOADED event', last('insert into "events"')],
      ['COMMIT', last('COMMIT')],
    ];
    expect(order.filter(([, index]) => index < 0).map(([label]) => label)).toEqual([]);
    expect(order.map(([, index]) => index)).toEqual(order.map(([, index]) => index).sort((a, b) => a - b));
    expect(new Set(order.map(([, index]) => index)).size).toBe(order.length);
    expect(order[0]?.[1]).toBe(0);
    expect(order[1]?.[1]).toBe(1);
    expect(order.at(-1)?.[1]).toBe(transaction.length - 1);
    // After the COMMIT of the build, the staging database is only read (R-6).
    const afterCommit = build.slice(build.indexOf('COMMIT') + 1).map(verbOf);
    expect([...new Set(afterCommit)]).toEqual(['SELECT']);
    await discard(maintenance, used, db.run.identity.prefix);
  });
});

describe('more than nine earlier resets', () => {
  it('eleven carried lineage rows stay byte-equal and in order, and the appended row is number twelve', async () => {
    const used = await db.another({ template: 'seed', slug: 'rf11' });
    const head = 'a'.repeat(63);
    for (let number = 1; number <= 11; number += 1) {
      await used.ownerPool().query(
        "INSERT INTO public.audit_chain_history (reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason, scenario) VALUES ($1, $2, $3, 82, 1, 82, $4, NULL, 'RESET', 'idle')",
        [number, 100 + number, `${head}${(number % 16).toString(16)}`, SEED_NOW - (12 - number) * MINUTE],
      );
    }
    await used.ownerPool().query('UPDATE public.core_state SET epoch = 120');
    const carried = await dumpKept(used.ownerPool());
    await quiet(maintenance, used);
    const report = await resetDatabase(options(used), internals);
    expect(report).toMatchObject({ previousEpoch: 120, epoch: 121 });
    expect(report.lineage).toMatchObject({ carried: 11, total: 12 });
    expect(report.lineage.appended).toMatchObject({ resetNo: '12', epoch: '120', rowCount: '82' });
    const after = await dumpKept(used.ownerPool());
    expect(after['audit_chain_history']?.slice(0, 11)).toEqual(carried['audit_chain_history']);
    expect((await lineageRows(used.ownerPool())).map((row) => row.reset_no)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    await discard(maintenance, used, db.run.identity.prefix);
  });

  it('1,200 carried sessions cross in chunks and stay byte-equal', async () => {
    const used = await db.another({ template: 'seed', slug: 'rfbulk' });
    await used.ownerPool().query(
      "INSERT INTO public.auth_sessions (token_hash, operator_id, method, issued_at, last_seen_at, absolute_expires_at) " +
        "SELECT sha256(convert_to('w29-bulk-' || g, 'UTF8')), 'OPR-001', 'PASSWORD', $1::bigint + g, $1::bigint + g, $1::bigint + g + 1000 FROM generate_series(1, 1200) AS g",
      [SEED_NOW],
    );
    const carried = await dumpKept(used.ownerPool());
    expect(carried['auth_sessions']).toHaveLength(1200);
    await quiet(maintenance, used);
    const report = await resetDatabase(options(used), internals);
    expect(report.kept['auth_sessions']).toBe(1200);
    expect((await dumpKept(used.ownerPool()))['auth_sessions']).toEqual(carried['auth_sessions']);
    await discard(maintenance, used, db.run.identity.prefix);
  });
});

describe('R-9: when the routine settles, the driver has closed every connection it opened', () => {
  // Answered by the driver's own events in this process, read at once after the promise settled:
  // no polling, no wait, nothing a loaded host or another run could change.
  it('after a reset that succeeds: the three connections, each closed', async () => {
    const used = await db.another({ template: 'seed', slug: 'rfclose' });
    await quiet(maintenance, used);
    const watched = watchedPools(db.run.dataDir);
    const report = await resetDatabase(options(used), { ...internals, openPool: watched.openPool });
    const open = watched.connections.filter((connection) => !connection.ended).map((connection) => connection.database);
    expect(report.previousDropped).toBe(true);
    expect(watched.connections.map((connection) => connection.database)).toEqual(['postgres', used.name, `${used.name}_next`]);
    expect(open, 'connections the driver had not closed when the reset resolved').toEqual([]);
    await discard(maintenance, used, db.run.identity.prefix);
  });

  it.each(['R-1', 'R-3', 'R-5c', 'R-6', 'R-7:rename'] as const)('after a failure at %s: every connection opened so far is closed', async (checkpoint) => {
    const watched = watchedPools(db.run.dataDir);
    const error = await failing(db.database, { onCheckpoint: failAt(checkpoint).onCheckpoint }, { ...internals, openPool: watched.openPool });
    const open = watched.connections.filter((connection) => !connection.ended).map((connection) => connection.database);
    expect(error.step).toBe(stepOf(checkpoint));
    expect(watched.connections.length).toBeGreaterThanOrEqual(1);
    expect(watched.connections[0]?.database).toBe('postgres');
    expect(open, 'connections the driver had not closed when the reset rejected').toEqual([]);
  });
});
