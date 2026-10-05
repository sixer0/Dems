// The failure table of the caller of the reset routine, against PostgreSQL, the REAL engine and
// the REAL routine (plan row W43; spec §12.4 DC-4, DC-5; database contract §8.5 "On failure";
// reset routine §4, §11; decisions D74, D95, D101).
//
// One server on this file's own clone of the seed, with the demo flag ON; a reset is asked for
// through HTTP by the SUPERVISOR's web session. Each case makes the routine refuse or fail in a
// way the routine's own tests have proven (a held advisory lock, a failure at a checkpoint, a
// session on the target), and asserts what THIS module does about it: what was stopped, what was
// brought back, what the caller is answered, and that the server is fully usable afterwards.
// The last cases are the failures after which the server must NOT serve again.
//
// THE EPOCH (decision D101). A reset that happened raises it by exactly 1 (the routine's write;
// the engine reloads with it). A reset that FAILED after the engine was stopped raises it by 1 as
// well, through the engine's resync, although nothing was reset: both are asserted below.
//
// WHICH DATABASE IS RESET. This file's own clone, created by the test helper, and nothing else.
import { validateCoreApiResponse } from '@dems/shared/api';
import { verifyAuditChain } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readHead } from '../../../../test/support/core';
import { verifyStoredAuditRows } from '../../../db/mapping';
import { RESET_LOCK_CLASS, ResetError, guardResetTarget, type ResetCheckpoint, type ResetReport } from '../../../db/reset';
import { catalogOf, chainFacts, discard, dropOwn, dumpTable, maintenancePool, resetApplicationName, resetLockHeld, sessionsOf, untilNoSession } from '../../../../test/support/reset';
import { checkStoredChain } from '../../../db/schema/boot-checks';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { storedSlices } from '../../../../test/support/engine';
import { AccessRuleError } from '../../../plugins/permission-guard';
import { RECOVERY, demoControl } from '../index';
import { CALLS, FAULTS, FAULTS_CLEAR, RESET, SCENARIO, STATUS, demoApp, errorOf, outcome, testRoutine, trailOf, type DemoApp, type TestRoutineOptions } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'w43x' });

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let server: DemoApp;
let maintenance: Pool;
let applicationName: string;
let report: ResetReport | null = null;

const owner = (): Pool => db.ownerPool();
const names = (): string[] => [db.name, `${db.name}_next`, `${db.name}_prev`];
/** The report of the last reset that resolved: the routine of this file hands it over. */
function lastReport(): ResetReport {
  if (report === null) throw new Error('no reset has resolved yet');
  return report;
}

/** The routine of this file's resets, with what one case adds to it. */
function routineWith(extra: Partial<TestRoutineOptions> = {}): void {
  demoControl(server.app).replace({
    routine: testRoutine(db.database, {
      runPrefix: db.run.identity.prefix,
      applicationName,
      maintenance,
      afterResolve(resolved) {
        report = resolved;
      },
      ...extra,
    }),
  });
}

function marksSince(from: number): string[] {
  return server.log
    .lines()
    .slice(from)
    .flatMap((line) => {
      const text = line['msg'];
      if (text === 'readiness hold') return [`hold ${String(line['held'])}`];
      if (text === 'readiness changed') return [`ready.${String(line['part'])} ${String(line['ready'])}`];
      if (text === 'engine stopped') return ['engine stopped'];
      if (text === 'engine started') return [`engine started (${String(line['mode'])}, epoch ${String(line['epoch'])})`];
      return [];
    });
}

/** A reset that happened: the engine RELOADS with the epoch the routine wrote. */
const RESUMED = (epoch: number): string[] => ['hold true', 'ready.engine false', 'engine stopped', 'ready.database false', 'ready.database true', `engine started (reset, epoch ${epoch})`, 'ready.engine true', 'hold false'];
/** A reset that did not happen: the engine RESYNCHRONISES under a new epoch (decision D101). */
const RESUMED_AFTER_FAILURE = (epoch: number): string[] => ['hold true', 'ready.engine false', 'engine stopped', 'ready.database false', 'ready.database true', `engine started (resync, epoch ${epoch})`, 'ready.engine true', 'hold false'];

/** The `start` publications among those handed to the seam since `from`. */
function startsSince(from: number) {
  return server.publications.slice(from).flatMap((publication) => (publication.kind === 'state' && publication.change.cause === 'start' ? [publication.change] : []));
}

/** The server answers, the engine runs, and the next command is written to the chain the database holds. */
async function expectUsable(epoch: number): Promise<void> {
  expect(server.app.readiness.snapshot()).toEqual({ database: true, engine: true });
  expect(server.app.readiness.isReady()).toBe(true);
  expect(server.engine).toMatchObject({ running: true, epoch });
  expect(demoControl(server.app).resetInFlight).toBe(false);
  const head = await readHead(owner());
  const response = await server.post('SUPERVISOR', FAULTS, { kind: 'FAN_STALL' });
  expect(outcome(response)).toEqual([204, null]);
  expect(response.headers['x-dems-epoch']).toBe(String(epoch));
  const trail = await trailOf(owner());
  expect(trail.at(-1)).toMatchObject({ seq: head.seq + 1, type: 'FAULT_RAISED', prevHash: head.hash });
  expect(outcome(await server.post('SUPERVISOR', FAULTS_CLEAR, { kind: 'FAN_STALL' }))).toEqual([204, null]);
  await server.drive(1_000);
  const status = await server.get('SUPERVISOR', STATUS);
  expect(status.statusCode).toBe(200);
  expect(status.json()).toMatchObject({ epoch, activeFaults: [] });
  expect(await checkStoredChain(server.app.db.pool, { verifyDigests: verifyStoredAuditRows })).toMatchObject({ ok: true, digests: 'ok', linkBreaks: 0 });
  const who = await server.app.db.pool.query<{ role: string }>('SELECT current_user::text AS role');
  expect(who.rows).toEqual([{ role: 'dems_app' }]);
}

function routineLine(from: number) {
  return server.log
    .lines()
    .slice(from)
    .find((line) => line['routineCode'] !== undefined);
}

beforeAll(async () => {
  maintenance = maintenancePool(db.run.dataDir);
  applicationName = resetApplicationName(db.run.identity.stamp, 'w43x');
  server = await demoApp(db, { demoControls: true, dataDir: db.run.dataDir });
  routineWith();
});

afterAll(async () => {
  await server?.app.close();
  await db.database.closeResources();
  for (const name of names().reverse()) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
});

describe('refused at R-0: nothing of the server was stopped', () => {
  it('RESET_ALREADY_RUNNING: another session holds the reset lock of this database: 503 with RESET_IN_PROGRESS; no hold, engine and pool untouched; the next command works', async () => {
    const slot = guardResetTarget(db.name, { testRunPrefix: db.run.identity.prefix }).lockSlot;
    const holder = await maintenance.connect();
    try {
      await holder.query('SELECT pg_advisory_lock($1::int, $2::int)', [RESET_LOCK_CLASS, slot]);
      expect(await resetLockHeld(maintenance, slot)).toBe(true);
      const catalog = await catalogOf(maintenance, names());
      const linesBefore = server.log.lines().length;
      const publications = server.publications.length;

      const response = await server.post('SUPERVISOR', RESET);
      expect(outcome(response)).toEqual([503, 'NOT_READY']);
      expect(errorOf(response).details).toEqual({ reason: 'RESET_IN_PROGRESS' });
      expect(validateCoreApiResponse('resetDemo', 503, response.json())).toEqual({ ok: true });

      expect(routineLine(linesBefore)).toMatchObject({ level: 40, msg: 'demo reset refused by the routine; nothing was stopped', routineCode: 'RESET_ALREADY_RUNNING', routineStep: 'R-0', targetUntouched: true, operatorId: 'OPR-002' });
      expect(marksSince(linesBefore)).toEqual([]);
      expect(server.app.db.generation).toBe(1);
      expect(server.publications.slice(publications).filter((publication) => publication.kind !== 'meters')).toEqual([]);
      expect(await catalogOf(maintenance, names())).toEqual(catalog);
      await expectUsable(1);
    } finally {
      await holder.query('SELECT pg_advisory_unlock($1::int, $2::int)', [RESET_LOCK_CLASS, slot]);
      holder.release();
    }
  });

  it('two resets at once through HTTP: one runs, the other is answered 503; the epoch moves by exactly 1', async () => {
    const linesBefore = server.log.lines().length;
    const [first, second] = await Promise.all([server.post('SUPERVISOR', RESET), server.post('SUPERVISOR', SCENARIO, { name: 'idle' })]);
    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 503]);
    const refused = first.statusCode === 503 ? first : second;
    const done = first.statusCode === 200 ? first : second;
    expect(outcome(refused)).toEqual([503, 'NOT_READY']);
    expect(done.json()).toEqual({ epoch: 2 });
    // One quiesce and one resume: nothing was stopped twice, nothing was stopped for the loser.
    expect(marksSince(linesBefore)).toEqual(RESUMED(2));
    expect(server.log.lines().slice(linesBefore).filter((line) => line['msg'] === 'demo reset done')).toHaveLength(1);
    expect(server.app.db.generation).toBe(2);
    expect((await chainFacts(owner())).epoch).toBe('2');
    await untilNoSession(maintenance, { applications: [applicationName] }, 'connections of the reset after two requests');
    await expectUsable(2);
  });
});

describe('failed after the quiesce, the database untouched: the server is brought back on it under a NEW epoch (decision D101)', () => {
  it.each(['R-4', 'R-5c', 'R-6', 'R-7:rename'] as const satisfies readonly ResetCheckpoint[])(
    'a failure at %s: 503 with RESET_FAILED; pool reopened, engine resynchronised with epoch previous + 1 at revision 0, one start publication, hold released; the same database and the same state, and the next command continues its chain',
    async (checkpoint) => {
      await server.app.pipeline.drain();
      const catalog = await catalogOf(maintenance, names());
      const chain = await chainFacts(owner());
      const trailBefore = await dumpTable(owner(), 'audit_log', 'seq');
      const stateBefore = withoutNegativeZeros(server.engine.state());
      const epoch = server.engine.epoch;
      expect(chain.epoch).toBe(String(epoch));
      const generation = server.app.db.generation;
      const linesBefore = server.log.lines().length;
      const publications = server.publications.length;
      routineWith({
        onCheckpoint(point) {
          if (point === checkpoint) throw new Error(`forced by the test at ${checkpoint}`);
        },
      });

      const response = await server.post('SUPERVISOR', RESET);
      expect(outcome(response)).toEqual([503, 'NOT_READY']);
      expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });
      expect(validateCoreApiResponse('resetDemo', 503, response.json())).toEqual({ ok: true });
      expect(response.headers['x-dems-epoch']).toBeUndefined();

      expect(routineLine(linesBefore)).toMatchObject({
        level: 50,
        msg: 'demo reset failed after the server was quiesced; the server is brought back on the database the name points at',
        routineStep: checkpoint.slice(0, 3),
        targetUntouched: true,
      });
      expect(marksSince(linesBefore)).toEqual(RESUMED_AFTER_FAILURE(epoch + 1));
      expect(server.app.db.generation).toBe(generation + 1);

      // ── The epoch: previous + 1 although nothing was reset, at revision 0; the engine, the
      // table and the one log line agree, and ONE `start` was published with it.
      expect(server.engine).toMatchObject({ running: true, epoch: epoch + 1, revision: 0 });
      const published = server.publications.slice(publications).filter((publication) => publication.kind !== 'meters');
      expect(published.filter((publication) => publication.kind !== 'state')).toEqual([]);
      expect(startsSince(publications)).toMatchObject([{ cause: 'start', epoch: epoch + 1, revision: 0, ops: [] }]);
      // No publication of this request carries the old epoch at a revision that went backwards.
      expect(published.every((publication) => publication.kind !== 'state' || publication.change.epoch === epoch + 1 || publication.change.cause === 'stop')).toBe(true);
      const said = server.log
        .lines()
        .slice(linesBefore)
        .filter((line) => line['code'] === 'DEMO_RESET_NEW_EPOCH');
      expect(said).toMatchObject([
        { level: 30, msg: 'no reset was completed; the engine was reloaded under a new epoch, so that every client takes a fresh snapshot', operatorId: 'OPR-002', epochBefore: epoch, epoch: epoch + 1, targetUntouched: true },
      ]);

      // ── The database behind the name is the one it was: same OID, nothing left over, the same
      // audit rows text for text, the same head. Only the stored epoch moved.
      expect(await catalogOf(maintenance, names())).toEqual(catalog);
      expect(await chainFacts(owner())).toEqual({ ...chain, epoch: String(epoch + 1) });
      expect(await dumpTable(owner(), 'audit_log', 'seq')).toEqual(trailBefore);
      // ── The state is the state before the attempt: every durable slice, but for the epoch.
      const stateAfter = withoutNegativeZeros(server.engine.state());
      expect(stateAfter).toStrictEqual({ ...stateBefore, meta: { ...stateBefore.meta, epoch: epoch + 1 } });
      expect(await storedSlices(owner())).toStrictEqual(stateAfter);

      routineWith();
      await expectUsable(epoch + 1);
    },
  );

  it('RESET_TARGET_IN_USE: a session of somebody else is on the database: nobody is disconnected, 503, the server is brought back under a new epoch', async () => {
    const epoch = server.engine.epoch;
    const linesBefore = server.log.lines().length;
    const publications = server.publications.length;
    // A fixture connection of this test, held open on purpose; the routine waits 400 ms for it.
    const foreign = await owner().connect();
    try {
      const backend = (await foreign.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
      routineWith({ keepTestPools: true, sessionDrainMs: 400 });

      const response = await server.post('SUPERVISOR', RESET);
      expect(outcome(response)).toEqual([503, 'NOT_READY']);
      expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });
      expect(routineLine(linesBefore)).toMatchObject({ level: 50, routineCode: 'RESET_TARGET_IN_USE', routineStep: 'R-1', targetUntouched: true });
      expect(marksSince(linesBefore)).toEqual(RESUMED_AFTER_FAILURE(epoch + 1));
      expect(startsSince(publications)).toMatchObject([{ epoch: epoch + 1, revision: 0, ops: [] }]);
      // The other session is the same backend and still answers.
      expect((await foreign.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid).toBe(backend);
    } finally {
      foreign.release();
    }
    routineWith();
    await expectUsable(epoch + 1);
  });
});

describe('the swap\'s outcome is unknown (the routine rejects with the target NOT untouched)', () => {
  it('the name points at the NEW database: the boot checks pass on it, the engine resynchronises on it under an epoch no client was shown, and publishes it; the answer is still 503', async () => {
    const epoch = server.engine.epoch;
    const catalog = await catalogOf(maintenance, names());
    const linesBefore = server.log.lines().length;
    const publications = server.publications.length;
    routineWith({
      afterResolve() {
        // The routine did everything, and then reports what it reports when the connection is
        // lost while the swap commits.
        throw new ResetError('RESET_SWAP_FAILED', 'R-7', 'the connection was lost while the swap committed (a stand-in of the test)', { targetUntouched: false });
      },
    });

    const response = await server.post('SUPERVISOR', RESET);
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });
    expect(routineLine(linesBefore)).toMatchObject({ level: 50, routineCode: 'RESET_SWAP_FAILED', routineStep: 'R-7', targetUntouched: false });

    // The routine wrote previous + 1 into the new database, and the routine REJECTED, so the
    // engine takes the stored epoch plus 1: previous + 2. Whichever database the name points at
    // after a swap of unknown outcome, the epoch is one no client holds.
    expect(marksSince(linesBefore)).toEqual(RESUMED_AFTER_FAILURE(epoch + 2));
    expect((await catalogOf(maintenance, names()))[db.name]?.oid).not.toBe(catalog[db.name]?.oid);
    expect(startsSince(publications)).toMatchObject([{ epoch: epoch + 2, revision: 0, ops: [] }]);
    expect((await chainFacts(owner())).epoch).toBe(String(epoch + 2));
    expect(server.log.lines().slice(linesBefore).find((line) => line['code'] === 'DEMO_RESET_NEW_EPOCH')).toMatchObject({ epochBefore: epoch, epoch: epoch + 2, targetUntouched: false });
    routineWith();
    await untilNoSession(maintenance, { applications: [applicationName] }, 'connections of the reset after the stand-in failure');
    await expectUsable(epoch + 2);
  });
});

describe('after every failure above, a reset still works', () => {
  it('resetDemo: 200, the epoch moves by exactly 1, no connection of the routine is left', async () => {
    const epoch = server.engine.epoch;
    const linesBefore = server.log.lines().length;
    const publications = server.publications.length;
    report = null;
    const response = await server.post('SUPERVISOR', RESET);
    expect(outcome(response)).toEqual([200, null]);
    expect(response.json()).toEqual({ epoch: epoch + 1 });
    expect(lastReport()).toMatchObject({ previousEpoch: epoch, epoch: epoch + 1, role: 'dems_owner' });
    // A reset that HAPPENED: the engine reloads with the routine's epoch. Exactly 1, not 2.
    expect(marksSince(linesBefore)).toEqual(RESUMED(epoch + 1));
    expect(startsSince(publications)).toMatchObject([{ epoch: epoch + 1, revision: 0, ops: [] }]);
    expect(server.log.lines().slice(linesBefore).filter((line) => line['code'] === 'DEMO_RESET_NEW_EPOCH')).toEqual([]);
    expect((await chainFacts(owner())).epoch).toBe(String(epoch + 1));
    await untilNoSession(maintenance, { applications: [applicationName] }, 'connections of the reset after the last success');
    expect((await sessionsOf(maintenance, { databases: [`${db.name}_next`, `${db.name}_prev`] }))).toEqual([]);
    await expectUsable(epoch + 1);
  });
});

describe('finding F-5: an AUDIT_TAMPER fault across a reload of the engine that is no process start', () => {
  interface Observation {
    /** `faults.active` of the engine's committed state lists the fault. */
    readonly listed: boolean;
    /** An alert of the fault is active. */
    readonly alert: boolean;
    /** The shared check passes on the engine's audit ring: the view is NOT tampered. */
    readonly viewVerifies: boolean;
  }

  function observe(app: DemoApp): Observation {
    return {
      listed: app.engine.slice('faults').active.some((fault) => fault.kind === 'AUDIT_TAMPER'),
      alert: app.engine.slice('alerts').some((alert) => alert.kind === 'AUDIT_TAMPER' && alert.active),
      viewVerifies: verifyAuditChain(app.engine.slice('audit')).ok,
    };
  }
  /** Consistent: the fault is listed and the view is tampered, or the fault is cleared and the view is clean. */
  const consistent = (seen: Observation): boolean => seen.listed !== seen.viewVerifies && seen.alert === seen.listed;
  const show = (seen: Observation): string => `fault listed ${seen.listed}, alert active ${seen.alert}, view verifies ${seen.viewVerifies} (${consistent(seen) ? 'consistent' : 'NOT consistent'})`;

  /**
   * The reproduction WITHOUT this module, on a clone of its own: the fault through the engine's
   * own command, then the engine stopped and started in the mode `resync`, which is what the
   * engine does by itself after a diverged chain head, and what a failed reset asks for.
   */
  async function engineAlone(slug: string): Promise<{ before: Observation; after: Observation }> {
    const target = await db.another({ slug });
    const second = await demoApp(target, { demoControls: true, dataDir: db.run.dataDir });
    try {
      await second.app.engine.command(second.principal('SUPERVISOR'), 'inject', 'AUDIT_TAMPER');
      const before = observe(second);
      await second.app.pipeline.drain();
      await second.engine.stop();
      await second.engine.start('resync');
      return { before, after: observe(second) };
    } finally {
      await second.app.close();
      await discard(maintenance, target, db.run.identity.prefix);
    }
  }

  it('RUN through a failed reset: the stored chain is intact and the server is usable; what the fault list and the view say is printed; clearing the fault leaves both clean', async () => {
    const stored = await dumpTable(owner(), 'audit_log', 'seq');
    expect(outcome(await server.post('SUPERVISOR', FAULTS, { kind: 'AUDIT_TAMPER' }))).toEqual([204, null]);
    const before = observe(server);
    // Before the attempt the two agree: the fault is listed and the view is tampered.
    expect(before).toEqual({ listed: true, alert: true, viewVerifies: false });
    const epoch = server.engine.epoch;
    routineWith({
      onCheckpoint(point) {
        if (point === 'R-4') throw new Error('forced by the test at R-4');
      },
    });

    const response = await server.post('SUPERVISOR', RESET);
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(server.engine).toMatchObject({ running: true, epoch: epoch + 1, revision: 0 });
    const after = observe(server);
    const status = (await server.get('SUPERVISOR', STATUS)).json() as { activeFaults: Array<{ kind: string }> };
    console.info(`[w43] F-5, a failed reset with AUDIT_TAMPER active: before: ${show(before)}; after the resync: ${show(after)}; getDemoStatus lists the fault: ${status.activeFaults.some((fault) => fault.kind === 'AUDIT_TAMPER')}`);

    // Whatever the engine holds, the STORED chain was never touched: the rows that were there
    // are there text for text, two rows more (the discontinuity row of the injection and the
    // `FAULT_CLEARED` row of the resync), and it verifies.
    const storedNow = await dumpTable(owner(), 'audit_log', 'seq');
    expect(storedNow.slice(0, stored.length)).toEqual(stored);
    expect(storedNow).toHaveLength(stored.length + 2);
    // What the two rows are: neither has an actor, and the second clears the fault of the overlay.
    const added = (await trailOf(owner())).slice(stored.length);
    expect(added.map((row) => [row.type, row.actorId])).toEqual([
      ['AUDIT_CHAIN_DISCONTINUITY', null],
      ['FAULT_CLEARED', null],
    ]);
    expect(added[1]?.details).toMatchObject({ kind: 'AUDIT_TAMPER' });
    expect(storedNow.filter((row) => row.includes('[altered]'))).toEqual([]);
    expect(await checkStoredChain(server.app.db.pool, { verifyDigests: verifyStoredAuditRows })).toMatchObject({ ok: true, digests: 'ok', linkBreaks: 0 });

    // The way out works whichever of the two the engine does: clearing the fault leaves nothing
    // listed, no alert active and a view that verifies.
    expect(outcome(await server.post('SUPERVISOR', FAULTS_CLEAR, { kind: 'AUDIT_TAMPER' }))).toEqual([204, null]);
    expect(observe(server)).toEqual({ listed: false, alert: false, viewVerifies: true });
    routineWith();
    await expectUsable(epoch + 1);
  });

  it('RUN on the engine alone (no reset, no route of this module): stop, then start in the mode resync; what the fault list and the view say is printed', async () => {
    const { before, after } = await engineAlone('w43xt');
    expect(before).toEqual({ listed: true, alert: true, viewVerifies: false });
    console.info(`[w43] F-5, the engine alone, stop then start('resync') with AUDIT_TAMPER active: before: ${show(before)}; after: ${show(after)}`);
    // Not asserted here: which of the two consistent outcomes the engine should give is its
    // owner's to decide, and a test of this folder does not pin another folder's behaviour (M10).
    expect(typeof after.listed).toBe('boolean');
  });

  // PENDING, for the owner of `src/engine` (finding F-5 of this row; controller decision D101).
  // It fails today. Reproduction, exactly: boot the server on a seeded clone; run the hosted
  // action `inject('AUDIT_TAMPER')`; `await engine.stop(); await engine.start('resync')`. Then
  // `engine.slice('faults').active` still lists AUDIT_TAMPER and its alert is still active,
  // while `verifyAuditChain(engine.slice('audit'))` passes: the ring was rebuilt from the stored,
  // intact chain. `applyProcessStart` (`src/engine/rehydrate.ts`) clears the overlay's fault,
  // and `host.ts` calls it for the mode `boot` only (`mode === 'boot' ? applyProcessStart(...) :
  // NO_EFFECTS`). Remove `.skip` when the engine clears the fault (or puts the overlay back) in
  // every start that rebuilds the ring.
  it('PENDING (engine): after a start in the mode resync, the fault list and the audit view agree about AUDIT_TAMPER', async () => {
    const { after } = await engineAlone('w43xp');
    expect(consistent(after), show(after)).toBe(true);
  });
});

describe('decision D95: the stored matrix of the rebuilt database is refused', () => {
  it('reloadMatrix rejects with STORED_GRANTS_MISMATCH after a reset: 503, the hold is kept, every request but health answers 503, the log says the state and the recovery', async () => {
    const epoch = server.engine.epoch;
    const linesBefore = server.log.lines().length;
    const publications = server.publications.length;
    const mismatch = new AccessRuleError([{ code: 'STORED_GRANTS_MISMATCH', operationId: null, route: null, detail: 'extra grant: TECHNICIAN DEMO_CONTROL' }]);
    demoControl(server.app).replace({
      routine: testRoutine(db.database, { runPrefix: db.run.identity.prefix, applicationName, maintenance }),
      reloadMatrix: async () => {
        throw mismatch;
      },
    });

    const response = await server.post('SUPERVISOR', RESET);
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });
    expect(validateCoreApiResponse('resetDemo', 503, response.json())).toEqual({ ok: true });
    expect(response.body).not.toContain('STORED_GRANTS_MISMATCH');

    // The reset itself happened: the database is the rebuilt one. The server did not come back on it.
    expect((await chainFacts(owner())).epoch).toBe(String(epoch + 1));
    expect(marksSince(linesBefore)).toEqual(['hold true', 'ready.engine false', 'engine stopped', 'ready.database false', 'ready.database true']);
    expect(server.engine.running).toBe(false);
    expect(server.app.readiness.snapshot()).toEqual({ database: true, engine: false });
    expect(server.app.readiness.isReady()).toBe(false);
    expect(demoControl(server.app).resetInFlight).toBe(false);
    // No new epoch was published: no client is told about a state the server does not serve.
    expect(server.publications.slice(publications).filter((publication) => publication.kind === 'state' && publication.change.cause === 'start')).toEqual([]);

    const line = server.log
      .lines()
      .slice(linesBefore)
      .find((entry) => typeof entry['msg'] === 'string' && entry['msg'].startsWith('the server could not resume after a demo reset'));
    expect(line).toMatchObject({
      level: 50,
      msg: 'the server could not resume after a demo reset; it stays not ready and answers 503 to every request but health',
      step: 'rbac.matrix',
      code: 'STORED_GRANTS_MISMATCH',
      serving: false,
      recovery: RECOVERY,
      operatorId: 'OPR-002',
      err: { type: 'AccessRuleError', code: 'STORED_GRANTS_MISMATCH' },
    });
    expect(server.log.text()).not.toContain('extra grant');

    // Every operation of the module, for every caller, and a read of another module: 503. Health: 200.
    for (const entry of CALLS) expect(outcome(await server.call('SUPERVISOR', entry)), entry.operationId).toEqual([503, 'NOT_READY']);
    expect(outcome(await server.get('INVESTIGATOR', '/api/v1/auth/session'))).toEqual([503, 'NOT_READY']);
    const health = await server.get(null, '/api/v1/health');
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ ready: { database: true, engine: false } });

    // Even if something set the engine's flag, the hold alone keeps the server from serving.
    server.app.readiness.set('engine', true);
    expect(server.app.readiness.isReady()).toBe(false);
    expect(outcome(await server.get('SUPERVISOR', STATUS))).toEqual([503, 'NOT_READY']);
    server.app.readiness.set('engine', false);
    await untilNoSession(maintenance, { applications: [applicationName] }, 'connections of the reset after the refused matrix');
  });
});

describe('a boot check does not pass on the rebuilt database', () => {
  it('B-5 fails after the swap (the runtime role was granted UPDATE on the audit table): the server does not come back; the step is named; 503 on everything but health', async () => {
    // A second server on a second clone: this one cannot be used again afterwards.
    const target = await db.another({ slug: 'w43xb' });
    const second = await demoApp(target, { demoControls: true, dataDir: db.run.dataDir });
    const secondApplication = resetApplicationName(db.run.identity.stamp, 'w43xb');
    try {
      demoControl(second.app).replace({
        routine: testRoutine(target, {
          runPrefix: db.run.identity.prefix,
          applicationName: secondApplication,
          maintenance,
          async afterResolve() {
            // The rebuilt database, damaged by its owner before the server looks at it: what R-6
            // would have refused, had it been there before the swap.
            await target.ownerPool().query('GRANT UPDATE ON public.audit_log TO dems_app');
          },
        }),
      });
      const linesBefore = second.log.lines().length;

      const response = await second.post('SUPERVISOR', RESET);
      expect(outcome(response)).toEqual([503, 'NOT_READY']);
      expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });

      const line = second.log
        .lines()
        .slice(linesBefore)
        .find((entry) => typeof entry['msg'] === 'string' && entry['msg'].startsWith('the server could not resume after a demo reset'));
      expect(line).toMatchObject({ level: 50, step: 'B-5', code: 'BootCheckError', serving: false, recovery: RECOVERY, err: { type: 'BootCheckError' } });
      // The checks before it passed on the reopened pool; nothing after it ran: no matrix, no engine.
      expect(second.engine.running).toBe(false);
      expect(second.app.readiness.snapshot()).toEqual({ database: true, engine: false });
      expect(second.log.lines().slice(linesBefore).filter((entry) => entry['msg'] === 'engine started')).toEqual([]);
      expect(second.log.lines().slice(linesBefore).filter((entry) => entry['msg'] === 'readiness hold').map((entry) => entry['held'])).toEqual([true]);
      for (const entry of CALLS) expect(outcome(await second.call('SUPERVISOR', entry)), entry.operationId).toEqual([503, 'NOT_READY']);
      expect((await second.get(null, '/api/v1/health')).statusCode).toBe(200);
      await untilNoSession(maintenance, { applications: [secondApplication] }, 'connections of the reset after the failed boot check');
    } finally {
      await second.app.close();
      await discard(maintenance, target, db.run.identity.prefix);
    }
  });
});
