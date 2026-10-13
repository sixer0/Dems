// Start, stop, rehydration and the restart fault of the hosted engine, against PostgreSQL as
// `dems_app` (plan row W26; spec §8.6, §12.3, §12.4; database contract §7.4, §8.5; decisions D14,
// D28 D-1, D62, D72, D74).
//
// A "restart" here is what it is in production: the app is closed (or abandoned), and a NEW app
// is built on the same database and booted with `app.readiness.boot()`.
import { recordingBytes, verifyAuditChain, type ScenarioName, CORE_NOT_RUNNING_SENTENCE, createManualClock, type AuditRow, STOPPING_MS, CORE_NOT_RUNNING_CLEARED_SENTENCE, type CompleteSealInput, type SealingStepReport } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase, type TestDatabase } from '../../../test/helpers/db';
import { BOOT_CHECKS, passedAmong, readHead, readTrail, sleep, verifyTrail, linkProblems } from '../../../test/support/core';
import { createSystemClock } from '../../core';
import { SNAPSHOT_SLICE_KEYS, pickDurable, type DurableSlices } from '../../db/mapping';
import { resetDatabase } from '../../db/reset';
import { discard, maintenancePool } from '../../../test/support/reset';
import { tableChecksums, withoutNegativeZeros } from '../../../test/support/seed';
import { BootError } from '../../plugins/readiness';
import { changedSlices } from '../delta';
import { EngineError } from '../errors';
import { FIXED_NOW, engineApp, seedScenario, stateChanges, storedSlices, tableCounts, type EngineApp, manualTimer } from './support';
import { SecuritySliceSchema, CORE_NOT_RUNNING_FAULT_EXAMPLE, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { buildApp } from '../../app';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../capture/fence';
import { engineControl } from '../index';
import { SEALING_STEP_ORDER } from '../../sealing';
import { sealDoorsOf } from '../seal-doors';
import { STREAM_PROFILE_DIFFERS_REASON, sealingNoticeDoorsOf } from '../sealing-notice-doors';

const db = useTestDatabase({ template: 'seed' });

const STOP_MS = 90_000;
/**
 * The steps this file is about: the nine boot checks, then the engine's own step.
 *
 * By-design change (checkpoint CP-B1, finding CPB1-13; standing rule M10): this was the list of
 * EVERY boot step of the server (it ended with the step of the RBAC row) and broke whenever a
 * unit added one. A test here asks which of THESE passed, in which order: a step of another
 * unit, wherever it runs, does not change the answer.
 */
const BOOT_STEPS: readonly string[] = [...BOOT_CHECKS, 'engine.rehydrate'];

const passedSteps = (host: EngineApp): string[] =>
  passedAmong(
    host.log
      .lines()
      .filter((line) => line['msg'] === 'boot step passed')
      .map((line) => line['step']),
    BOOT_STEPS,
  );

async function bootError(host: EngineApp): Promise<BootError> {
  const error = await host.app.readiness.boot().then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(BootError);
  return error as BootError;
}

const storedEpoch = async (pool: Pool): Promise<number> => Number((await pool.query<{ epoch: string }>('SELECT epoch::text AS epoch FROM public.core_state')).rows[0]?.epoch);

/** A schema-only clone seeded with a scenario: the state a scenario load leaves. */
async function scenarioClone(scenario: ScenarioName, slug: string): Promise<TestDatabase> {
  const target = await db.another({ template: 'schema', slug });
  await seedScenario(target, scenario);
  return target;
}

describe('the boot step (decision D40) and the epoch (spec §8.6, D14)', () => {
  it('on a seeded database the nine checks pass, then engine.rehydrate: the engine runs, the server is ready, the epoch is the stored one plus 1', async () => {
    const target = await db.another({ slug: 'w26_boot' });
    const owner = target.ownerPool();
    expect(await storedEpoch(owner)).toBe(0);
    const before = await readHead(owner);

    const first = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 60_000 });
    expect(first.app.readiness.snapshot()).toEqual({ database: false, engine: false });
    expect(first.engine.running).toBe(false);
    expect(first.engine.epoch).toBe(0);
    const began = performance.now();
    await first.app.readiness.boot();
    const bootMs = performance.now() - began;
    const rehydration = [...first.database.statements];

    expect(passedSteps(first)).toEqual(BOOT_STEPS);
    expect(first.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(first.app.readiness.isReady()).toBe(true);
    expect(first.engine).toMatchObject({ running: true, epoch: 1, revision: 0 });
    expect(await storedEpoch(owner)).toBe(1);
    expect(first.engine.slice('meta').epoch).toBe(1);
    expect(stateChanges(first.publications)).toEqual([{ epoch: 1, revision: 0, at: FIXED_NOW + 60_000, cause: 'start', records: false, ops: [] }]);
    expect(first.log.lines().find((line) => line['msg'] === 'engine started')).toMatchObject({
      mode: 'boot',
      epoch: 1,
      session: null,
      restartFault: null,
      tabletLinkReset: true,
      auditRows: 1,
    });
    // The tablet link: no device is connected after a start, and the row says so truthfully.
    const boot = (await readTrail(owner)).filter((row) => row.seq > before.seq);
    expect(boot.map((row) => [row.type, row.actorId, row.at])).toEqual([['TABLET_LINK_CHANGED', null, FIXED_NOW + 60_000]]);
    expect(first.timer.active()).toBe(1);

    // Stop and start in the same process: stopped means not ready, and a start adds 1 again.
    await first.engine.stop();
    expect(first.app.readiness.snapshot().engine).toBe(false);
    expect(first.timer.active()).toBe(0);
    await first.engine.start('boot');
    expect(first.engine).toMatchObject({ running: true, epoch: 2, revision: 0 });
    await first.app.close();

    // A new process on the same database: plus 1 again, and nothing is written twice.
    const second = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 120_000 });
    await second.app.readiness.boot();
    expect(passedSteps(second)).toEqual(BOOT_STEPS);
    expect(second.engine.epoch).toBe(3);
    expect(await storedEpoch(owner)).toBe(3);
    expect((await readHead(owner)).seq).toBe(before.seq + 1);
    expect(second.log.lines().find((line) => line['msg'] === 'engine started')).toMatchObject({ epoch: 3, tabletLinkReset: false, auditRows: 0 });
    // The rehydration is one unit: the unit's three statements, 18 reads, the writes, the commit.
    // (RECON-B2a R5: the 16 reads of the dataset plus `capture_config` and `capture_devices` -
    // the two durable slices that joined the replicated set with rows 47 and 52.)
    expect(rehydration[0]).toBe('BEGIN ISOLATION LEVEL READ COMMITTED');
    expect(rehydration.at(-1)).toBe('COMMIT');
    expect(rehydration.filter((text) => text.startsWith('BEGIN'))).toHaveLength(1);
    expect(rehydration.filter((text) => text.startsWith('select '))).toHaveLength(18);
    console.info(
      `[w26] boot on a seeded clone: B-1 to B-9, engine.rehydrate; epoch 0 -> 1 (start), -> 2 (stop + start), -> 3 (new process); ` +
        `the whole boot ${bootMs.toFixed(0)} ms, the rehydration unit ${rehydration.length} statements (18 reads; writes: ${rehydration
          .filter((text) => /^(insert|update|UPDATE)/.test(text))
          .map((text) => text.split('"')[1] ?? 'engine_counters')
          .join(', ')})`,
    );
  });

  it('a start while the host is started is refused', async () => {
    const target = await db.another({ slug: 'w26_boot_twice' });
    const host = await engineApp(target, db.run.dataDir);
    await host.app.readiness.boot();
    const error = await host.engine.start('boot').then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toMatchObject({ code: 'ENGINE_ALREADY_STARTED' });
    expect(host.engine).toMatchObject({ running: true, epoch: 1 });
    // Nor is the timer of a running scheduler replaced.
    expect(() => host.engine.useTimer(host.timer.timer)).toThrow(EngineError);
    expect(host.timer.active()).toBe(1);
  });
});

describe('a database the engine cannot start from: the server does not come up on it', () => {
  it('an unseeded database is refused by B-6, before the engine\'s step; asked directly, the engine refuses it by code and writes nothing', async () => {
    const target = await db.another({ template: 'schema', slug: 'w26_unseeded' });
    const host = await engineApp(target, db.run.dataDir);
    const counts = await tableCounts(target.ownerPool());

    const error = await bootError(host);
    expect(error.stepId).toBe('B-6');
    expect(passedSteps(host)).toEqual(['B-1', 'B-2', 'B-3', 'B-4', 'B-5']);
    expect(host.engine.running).toBe(false);
    expect(host.app.readiness.isReady()).toBe(false);

    // The step itself, on the same database: a coded refusal that names the command, no state invented.
    const refusal = await host.engine.start('boot').then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(refusal).toBeInstanceOf(EngineError);
    expect(refusal).toMatchObject({ code: 'ENGINE_STATE_UNREADABLE', detail: { rule: 'ROW_SHAPE' } });
    const line = host.log.lines().find((entry) => entry['msg'] === 'engine not started');
    expect(line).toMatchObject({ level: 50, step: 'engine.rehydrate', mode: 'boot', code: 'ENGINE_STATE_UNREADABLE', rule: 'ROW_SHAPE' });
    expect(String(line?.['detail'])).toContain('npm run db:seed');
    expect(host.engine.stats().phase).toBe('stopped');
    expect(host.app.readiness.snapshot().engine).toBe(false);
    expect(await tableCounts(target.ownerPool())).toEqual(counts);
    expect(host.timer.active()).toBe(0);
  });

  it('a database with a state row and no engine state passes the nine checks and is refused by engine.rehydrate', async () => {
    const target = await db.another({ template: 'schema', slug: 'w26_half_seeded' });
    // What the fixtures of the boot-check tests hold: enough for B-6, not a seeded state.
    await target.ownerPool().query(
      `INSERT INTO public.core_state (seed, sim_schema_version, scenario, epoch, created_at, seeded_at, last_sealed_acknowledged, updated_at)
       VALUES (20261001, 2, 'idle', 0, $1, $1, true, $1)`,
      [FIXED_NOW],
    );
    const host = await engineApp(target, db.run.dataDir);
    const error = await bootError(host);
    expect(error.stepId).toBe('engine.rehydrate');
    expect(error.cause).toMatchObject({ code: 'ENGINE_STATE_UNREADABLE' });
    expect(passedSteps(host)).toEqual(BOOT_STEPS.slice(0, 9));
    expect(host.app.readiness.snapshot()).toEqual({ database: true, engine: false });
    expect(await storedEpoch(target.ownerPool())).toBe(0);
  });

  it('a stored state that a slice schema REJECTS is fatal: the boot stops, nothing is written, and the log has the code and the slice, not the value', async () => {
    const target = await db.another({ slug: 'w26_rejected' });
    const owner = target.ownerPool();
    const MARK = 'MARK-stored-health-6e2b';
    // A value the table accepts (a JSON object) and the contract's schema of the slice does not.
    await owner.query('UPDATE public.hardware_snapshot SET health = jsonb_build_object($1::text, $2::text)', ['marker', MARK]);
    const head = await readHead(owner);
    const checksums = await tableChecksums(owner);

    const host = await engineApp(target, db.run.dataDir);
    const error = await bootError(host);
    expect(error.stepId).toBe('engine.rehydrate');
    expect(error.cause).toBeInstanceOf(EngineError);
    expect(error.cause).toMatchObject({ code: 'ENGINE_SNAPSHOT_REJECTED', detail: { slices: 'health', rejected: 1, firstSlice: 'health' } });
    expect(passedSteps(host)).toEqual(BOOT_STEPS.slice(0, 9));

    // Not ready, nothing scheduled, nothing written: not the epoch, not a row.
    expect(host.engine.running).toBe(false);
    expect(host.app.readiness.isReady()).toBe(false);
    expect(host.timer.active()).toBe(0);
    expect(await readHead(owner)).toEqual(head);
    expect(await tableChecksums(owner)).toEqual(checksums);
    expect(await storedEpoch(owner)).toBe(0);

    const line = host.log.lines().find((entry) => entry['msg'] === 'engine not started');
    expect(line).toMatchObject({ level: 50, step: 'engine.rehydrate', code: 'ENGINE_SNAPSHOT_REJECTED', slices: 'health' });
    expect(host.log.text()).not.toContain(MARK);
    expect(JSON.stringify((error.cause as EngineError).detail)).not.toContain(MARK);
    expect(() => host.engine.state()).toThrow();
  });
});

describe('a rehydrated engine equals the state before the stop (AC-B-04, engine part)', () => {
  it('after a day of commands and ticks, a stop and a new process: every durable slice is equal, only the epoch moved', async () => {
    const target = await db.another({ slug: 'w26_rehydrate' });
    const owner = target.ownerPool();
    const first = await engineApp(target, db.run.dataDir);
    await first.app.readiness.boot();
    const investigator = first.principal('INVESTIGATOR');
    const supervisor = first.principal('SUPERVISOR');

    // A session from create to seal, a policy change, a settings change, an export, a fault and its clearing.
    await first.engine.setTabletLink('CONNECTED');
    await first.engine.command(investigator, 'createSession', {
      caseNumber: 'LP/2026/1001-0099',
      subjectType: 'SAKSI',
      subjectName: 'Test Subject',
      investigatorId: investigator.operatorId,
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    await first.engine.command(investigator, 'beginPrecheck');
    await first.drive(5_000);
    await first.engine.command(investigator, 'startRecording');
    await first.drive(45_000);
    await first.engine.command(investigator, 'addMarker', 'Key statement');
    await first.engine.command(investigator, 'addNote', 'Subject asked for a break');
    await first.engine.command(supervisor, 'inject', 'FAN_STALL');
    await first.drive(10_000);
    await first.engine.command(supervisor, 'clearFault', 'FAN_STALL');
    await first.engine.command(investigator, 'stopRecording', 'Interview completed');
    await first.drive(20_000);
    expect(first.engine.slice('session')?.state).toBe('SEALED');
    const sealedId = first.engine.slice('lastSealedSessionId') ?? '';
    await first.engine.command(supervisor, 'exportEvidence', first.engine.slice('evidence').find((item) => item.sessionId === sealedId)?.id ?? '', {
      reason: 'Prosecutor request',
      destination: 'Case file transfer',
    });
    await first.engine.command(supervisor, 'setStoragePolicy', { retentionDays: 365 });
    await first.engine.command(supervisor, 'updateSettings', { timeFormat: '12', notifySound: false });
    await first.engine.setTabletLink('OFFLINE');
    await first.drive(7_350);

    // The working state of the engine at the stop, and what a reader saw.
    const working = pickDurable(first.engine.simulator()?.store.getState() as DurableSlices);
    const stoppedAt = first.clock.now();
    await first.app.close();
    const checksums = await tableChecksums(owner);
    // The stop wrote what a tick had left for the next second: the tables hold the working state.
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(working));

    const second = await engineApp(target, db.run.dataDir, { startAt: stoppedAt + STOP_MS });
    await second.app.readiness.boot();
    const expected = withoutNegativeZeros({ ...working, meta: { ...working.meta, epoch: working.meta.epoch + 1 } });
    expect(second.engine.state()).toStrictEqual(expected);
    expect(pickDurable(second.engine.simulator()?.store.getState() as DurableSlices)).toStrictEqual(expected);
    expect(second.log.lines().find((line) => line['msg'] === 'engine started')).toMatchObject({ restartFault: null, tabletLinkReset: false, auditRows: 0, session: 'SEALED' });

    // The tables: only the state row moved (the epoch).
    const after = await tableChecksums(owner);
    const moved = Object.keys(after).filter((table) => after[table] !== checksums[table]);
    expect(moved).toEqual(['core_state']);

    // No activity is invented for the time the server was down, and the engine goes on on the stored chain.
    const head = await readHead(owner);
    await second.drive(10_000);
    await second.engine.command(second.principal('INVESTIGATOR'), 'acknowledgeSummary', sealedId);
    const trail = await readTrail(owner);
    expect(trail.filter((row) => row.seq > head.seq).every((row) => row.at > stoppedAt + STOP_MS)).toBe(true);
    expect(trail.some((row) => row.at > stoppedAt && row.at <= stoppedAt + STOP_MS)).toBe(false);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(second.engine.state()));
    console.info(`[w26] rehydration: ${trail.length} audit rows; 30 slices equal before the stop and after a new process (negative zero as zero); only core_state.epoch moved`);
  });
});

describe('the restart fault (spec §8.6; decision D28 D-1)', () => {
  it('a session in RECORDING at the stop is in FAULT after rehydration: one FAULT_RAISED row without an actor, at the last committed instant; the stop is not counted as recording', async () => {
    const target = await scenarioClone('recording', 'w26_fault_rec');
    const owner = target.ownerPool();
    const first = await engineApp(target, db.run.dataDir);
    await first.engine.reload();
    await first.drive(30_000);
    expect(first.engine.slice('session')?.state).toBe('RECORDING');
    const stoppedAt = first.clock.now();
    const startedAt = first.engine.slice('session')?.startedAt ?? 0;
    const sessionId = first.engine.slice('session')?.id;
    await first.app.close();
    const before = await readHead(owner);

    const now = stoppedAt + STOP_MS;
    const second = await engineApp(target, db.run.dataDir, { startAt: now });
    await second.app.readiness.boot();

    expect(second.log.lines().find((line) => line['msg'] === 'engine started')).toMatchObject({ mode: 'boot', restartFault: 'RECORDING', session: 'FAULT', epoch: 1 });
    expect(second.engine.slice('session')).toMatchObject({ state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: 'RECORDING', at: stoppedAt } });
    const rows = (await readTrail(owner)).filter((row) => row.seq > before.seq);
    expect(rows.map((row) => [row.type, row.actorId, row.at])).toEqual([
      ['FAULT_RAISED', null, stoppedAt],
      ['TABLET_LINK_CHANGED', null, now],
    ]);
    expect(rows[0]).toMatchObject({ sessionId, severity: 'CRITICAL', details: { kind: 'POWER_FAIL', fromState: 'RECORDING' } });

    // The bytes are those of the last committed instant: 90 s of downtime would be 205 MB more.
    const session = await owner.query<{ state: string; bytes: string; updated: string }>(
      'SELECT state, bytes_written::text AS bytes, updated_at::text AS updated FROM public.active_session',
    );
    expect(session.rows[0]?.state).toBe('FAULT');
    expect(Number(session.rows[0]?.bytes)).toBe(recordingBytes(stoppedAt - startedAt));
    expect(recordingBytes(now - startedAt) - Number(session.rows[0]?.bytes)).toBeGreaterThan(200_000_000);

    // A critical alert, the fault flag, and a health snapshot row for the raise.
    expect(second.engine.slice('faults').active.map((fault) => fault.kind)).toEqual(['POWER_FAIL']);
    expect(second.engine.slice('alerts').some((alert) => alert.active && alert.severity === 'CRITICAL')).toBe(true);
    const health = await owner.query<{ cause: string; fault_kind: string | null; session_state: string | null }>(
      "SELECT cause, fault_kind, session_state FROM public.health_snapshots WHERE cause <> 'INTERVAL'",
    );
    expect(health.rows).toEqual([{ cause: 'FAULT_RAISED', fault_kind: 'POWER_FAIL', session_state: 'FAULT' }]);
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(second.engine.state()));

    // It stays in FAULT until an operator recovers it; then it is closed as INCOMPLETE, never sealed.
    await second.drive(5_000);
    expect(second.engine.slice('session')?.state).toBe('FAULT');
    const investigator = second.principal('INVESTIGATOR');
    const beforeRecovery = await readHead(owner);
    await second.engine.command(investigator, 'recover');
    expect(second.engine.slice('session')?.state).toBe('RECOVERY');
    await second.drive(4_000);
    const recovery = (await readTrail(owner)).filter((row) => row.seq > beforeRecovery.seq);
    expect(recovery.map((row) => row.type)).toEqual(expect.arrayContaining(['SYSTEM_BOOT', 'RECOVERY_STARTED', 'FAULT_CLEARED', 'SESSION_INCOMPLETE', 'RECOVERY_COMPLETED']));
    expect(recovery.find((row) => row.type === 'RECOVERY_STARTED')?.actorId).toBe(investigator.operatorId);
    expect(second.engine.slice('session')).toBeNull();
    expect(second.engine.slice('sessionHistory')[0]).toMatchObject({ id: sessionId, outcome: 'INCOMPLETE', faultKind: 'POWER_FAIL' });
    expect(second.engine.slice('evidence').find((item) => item.sessionId === sessionId)).toMatchObject({ status: 'RECORDED', sealedAt: null });
    expect(verifyAuditChain(second.engine.slice('audit'))).toMatchObject({ ok: true });
    expect(verifyTrail(await readTrail(owner), await readHead(owner))).toMatchObject({ ok: true });
    console.info(
      `[w26] restart fault: RECORDING at the stop -> FAULT after rehydration; FAULT_RAISED at the last committed instant (${STOP_MS / 1000} s before the restart), ` +
        `bytes ${session.rows[0]?.bytes} (not ${recordingBytes(now - startedAt)}); recover -> INCOMPLETE, evidence RECORDED`,
    );
  });

  it('a process that died without a stop: the fault is stamped at the last write the tables hold, not at what the engine had in memory', async () => {
    const target = await scenarioClone('recording', 'w26_fault_crash');
    const owner = target.ownerPool();
    const first = await engineApp(target, db.run.dataDir);
    await first.engine.reload();
    // 30.45 s on the engine's clock; the tables hold what the last write stored, some time before.
    await first.drive(30_450);
    const instants = await owner.query<{ at: string }>(
      `SELECT greatest(
         (SELECT written_at FROM public.hardware_snapshot),
         (SELECT updated_at FROM public.active_session),
         (SELECT max(at) FROM public.audit_log),
         (SELECT max(at) FROM public.events))::text AS at`,
    );
    const lastWrite = Number(instants.rows[0]?.at);
    expect(lastWrite).toBe(FIXED_NOW + 30_000);
    expect(first.clock.now() - lastWrite).toBe(450);
    const before = await readHead(owner);

    // The first app is NOT closed: its process is gone as far as the database knows.
    const now = first.clock.now() + STOP_MS;
    const second = await engineApp(target, db.run.dataDir, { startAt: now });
    await second.app.readiness.boot();
    expect(second.engine.slice('session')).toMatchObject({ state: 'FAULT', fault: { fromState: 'RECORDING', at: lastWrite } });
    const raised = (await readTrail(owner)).find((row) => row.seq === before.seq + 1);
    expect(raised).toMatchObject({ type: 'FAULT_RAISED', actorId: null, at: lastWrite });

    // The abandoned app, closed late: whatever it still held is not stored over the new process's rows.
    const head = await readHead(owner);
    const checksums = await tableChecksums(owner);
    await first.app.close();
    expect(await readHead(owner)).toEqual(head);
    expect(await tableChecksums(owner)).toEqual(checksums);
    expect(second.engine.running).toBe(true);
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(second.engine.state()));
  });

  it.each([
    ['finalizing', 'FINALIZING'],
  ] as const)('a session in %s at the stop is in FAULT too', async (scenario, state) => {
    const target = await scenarioClone(scenario, `w26_fault_${scenario}`);
    const host = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + STOP_MS });
    await host.app.readiness.boot();
    expect(host.log.lines().find((line) => line['msg'] === 'engine started')).toMatchObject({ restartFault: state, session: 'FAULT' });
    expect(host.engine.slice('session')).toMatchObject({ state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: state } });
    const trail = await readTrail(target.ownerPool());
    expect(trail.filter((row) => row.type === 'FAULT_RAISED' && row.at >= FIXED_NOW).at(-1)).toMatchObject({ actorId: null, details: { kind: 'POWER_FAIL', fromState: state } });
  });

  it('a session that was already in FAULT stays as it was: no second fault, no row for it', async () => {
    const target = await scenarioClone('recording', 'w26_fault_stays');
    const owner = target.ownerPool();
    const first = await engineApp(target, db.run.dataDir);
    await first.engine.reload();
    await first.drive(5_000);
    await first.engine.command(first.principal('SUPERVISOR'), 'inject', 'POWER_FAIL');
    const session = first.engine.slice('session');
    expect(session?.state).toBe('FAULT');
    await first.app.close();
    const before = await readHead(owner);

    const second = await engineApp(target, db.run.dataDir, { startAt: first.clock.now() + STOP_MS });
    await second.app.readiness.boot();
    expect(second.engine.slice('session')).toStrictEqual(session);
    expect(second.log.lines().find((line) => line['msg'] === 'engine started')).toMatchObject({ restartFault: null, session: 'FAULT' });
    expect((await readTrail(owner)).filter((row) => row.seq > before.seq).map((row) => row.type)).toEqual(['TABLET_LINK_CHANGED']);
  });

  it('a reload after a scenario load does NOT fault a running recording: only a process start does', async () => {
    const target = await scenarioClone('recording', 'w26_fault_reload');
    const host = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + STOP_MS });
    const before = await readHead(target.ownerPool());
    await host.engine.reload();
    expect(host.engine.slice('session')?.state).toBe('RECORDING');
    expect(host.engine).toMatchObject({ epoch: 0, revision: 0 });
    expect(host.engine.slice('tabletLink').state).toBe('CONNECTED');
    expect(await readHead(target.ownerPool())).toEqual(before);
    expect(host.log.lines().find((line) => line['msg'] === 'engine started')).toMatchObject({ mode: 'reset', restartFault: null, auditRows: 0 });
  });
});

describe('a reset inside a running server (spec §12.4; decision D74)', () => {
  it('stop, the reset routine, reload: the epoch is the one the routine wrote, not one more; a stop and a start add 1', async () => {
    const target = await db.another({ slug: 'w26_reset' });
    const maintenance = maintenancePool(db.run.dataDir);
    try {
      await resetCycle(target);
    } finally {
      // A database that a reset has just built is where autovacuum goes next, and the helper's
      // forced drop is refused while such a worker is connected (the reset row's finding): the
      // plain drop of the reset tests is used for this one database.
      await discard(maintenance, target, db.run.identity.prefix);
      await maintenance.end();
    }
  });

  async function resetCycle(target: TestDatabase): Promise<void> {
    const host = await engineApp(target, db.run.dataDir);
    await host.app.readiness.boot();
    const supervisor = host.principal('SUPERVISOR');
    await host.engine.command(supervisor, 'updateSettings', { timeFormat: '12' });
    await host.drive(2_450);
    expect(host.engine.epoch).toBe(1);

    // The quiesce order of the caller (contract §8.5 R-1): readiness off, the pipeline drained,
    // the engine stopped and its snapshot written, the runtime pool closed.
    const release = host.app.readiness.hold('reset');
    const report = await resetDatabase(
      {
        database: target.name,
        clock: () => host.clock.now(),
        actorId: supervisor.operatorId,
        reason: 'SCENARIO_LOAD',
        scenario: 'recording',
        dataDir: db.run.dataDir,
        quiesce: async () => {
          await host.app.pipeline.drain();
          await host.engine.stop();
          expect(host.timer.active()).toBe(0);
          expect(host.app.pipeline.snapshot()).toMatchObject({ running: null, pending: 0 });
          await host.app.db.close();
        },
      },
      { testRunPrefix: db.run.identity.prefix },
    );
    expect(report).toMatchObject({ previousEpoch: 1, epoch: 2, scenario: 'recording' });
    expect(host.engine.running).toBe(false);

    // The pool reopened on the new database (the caller runs the boot checks here; B-1 is this
    // probe), then the reload: the stored epoch AS IT IS.
    await host.app.db.reopen();
    expect(await host.app.db.probe({ fresh: true })).toBe(true);
    await host.engine.reload();
    release();
    expect(host.engine).toMatchObject({ running: true, epoch: report.epoch, revision: 0 });
    expect(host.app.readiness.isReady()).toBe(true);
    const owner = target.ownerPool();
    expect(await storedEpoch(owner)).toBe(report.epoch);
    expect(stateChanges(host.publications).at(-1)).toMatchObject({ cause: 'start', epoch: report.epoch, revision: 0, ops: [] });
    // The scenario's recording runs: no restart fault. Settings are kept by a reset.
    expect(host.engine.slice('session')?.state).toBe('RECORDING');
    expect(host.engine.slice('settings').timeFormat).toBe('12');
    // A fresh ring on the stored head and the stored event counter: the next rows continue both.
    expect(host.engine.slice('audit')).toMatchObject({ total: report.auditHead.seq, head: report.auditHead.hash });
    await host.engine.command(host.principal('INVESTIGATOR'), 'addMarker', 'After the reset');
    await host.drive(10_000);
    const trail = await readTrail(owner);
    expect(trail[report.auditHead.seq]).toMatchObject({ seq: report.auditHead.seq + 1, type: 'MARKER_ADDED', prevHash: report.auditHead.hash });
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));

    // The other entry: a stop and a START add 1.
    await host.engine.stop();
    await host.engine.start('boot');
    expect(host.engine.epoch).toBe(report.epoch + 1);
    expect(await storedEpoch(owner)).toBe(report.epoch + 1);
    console.info(`[w26] reset inside a running server: epoch ${report.previousEpoch} -> ${report.epoch} by the routine; after reload ${report.epoch} (no second increment); after stop + start ${report.epoch + 1}`);
    await host.app.close();
  }
});

describe('the tamper overlay does not survive a start, in any mode (finding F73; decision D106)', () => {
  /** What the fault list, the alert list and the audit view of the engine say about AUDIT_TAMPER. */
  const observe = (host: EngineApp) => ({
    listed: host.engine.slice('faults').active.some((fault) => fault.kind === 'AUDIT_TAMPER'),
    alert: host.engine.slice('alerts').some((alert) => alert.kind === 'AUDIT_TAMPER' && alert.active),
    viewVerifies: verifyAuditChain(host.engine.slice('audit')).ok,
  });
  const healthRows = async (owner: Pool) =>
    (await owner.query<{ cause: string; kind: string | null; at: string }>("SELECT cause, fault_kind AS kind, at::text AS at FROM public.health_snapshots WHERE cause <> 'INTERVAL' ORDER BY at, cause DESC, fault_kind")).rows;

  /** A booted server with AUDIT_TAMPER and a fault of the hardware (GNSS_LOSS) active, both stored. */
  async function tampered(slug: string) {
    const target = await db.another({ slug });
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir);
    await host.app.readiness.boot();
    const supervisor = host.principal('SUPERVISOR');
    await host.engine.command(supervisor, 'inject', 'GNSS_LOSS');
    await host.engine.command(supervisor, 'inject', 'AUDIT_TAMPER');
    await host.drive(2_000);
    return { target, owner, host, supervisor };
  }

  it.each([
    ['boot', 1, 'a new process start'],
    ['resync', 1, 'the reload after a diverged head or a failed reset'],
    ['reset', 0, 'the reload after a demo reset'],
  ] as const)('stop, then a start in the mode %s (epoch + %i; %s): the fault is not listed, its alert is not active, the view verifies, and the clearing is stored', async (mode, epochs, _what) => {
    const { owner, host, supervisor } = await tampered(`b2a_tamper_${mode}`);
    // Before: the list and the view agree that the trail is tampered. What is STORED is the fault, its alert and the
    // chain as it was appended: the altered row exists in the engine's ring only.
    expect(observe(host)).toEqual({ listed: true, alert: true, viewVerifies: false });
    const storedBefore = await readTrail(owner);
    expect(verifyTrail(storedBefore, await readHead(owner))).toMatchObject({ ok: true, checked: storedBefore.length });
    expect((await storedSlices(owner)).faults.active.map((fault) => fault.kind).sort()).toEqual(['AUDIT_TAMPER', 'GNSS_LOSS']);
    const epoch = host.engine.epoch;
    const healthBefore = await healthRows(owner);

    await host.engine.stop();
    host.clock.advance(STOP_MS);
    const now = host.clock.now();
    await host.engine.start(mode);

    // After: the list and the view agree that it is not. Only the overlay's fault went: the hardware's stays.
    expect(observe(host)).toEqual({ listed: false, alert: false, viewVerifies: true });
    expect(host.engine.slice('faults').active.map((fault) => fault.kind)).toEqual(['GNSS_LOSS']);
    expect(host.engine.epoch).toBe(epoch + epochs);
    expect(host.engine.revision).toBe(0);
    // The clearing is a row of the one chain, without an actor, at the start instant; nothing else was appended.
    const stored = await readTrail(owner);
    expect(stored.slice(0, storedBefore.length)).toEqual(storedBefore);
    expect(stored.slice(storedBefore.length).map((row) => [row.type, row.actorId, row.at, row.details['kind']])).toEqual([['FAULT_CLEARED', null, now, 'AUDIT_TAMPER']]);
    expect(verifyTrail(stored, await readHead(owner))).toMatchObject({ ok: true, checked: stored.length });
    // One health snapshot for the clearing, at the same instant.
    expect((await healthRows(owner)).slice(healthBefore.length)).toEqual([{ cause: 'FAULT_CLEARED', kind: 'AUDIT_TAMPER', at: String(now) }]);
    // What the tables hold is what the engine serves: the fault list, the resolved alert, the trail.
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
    expect(host.log.lines().filter((line) => line['msg'] === 'engine started').at(-1)).toMatchObject({ mode, tamperCleared: true, restartFault: null, auditRows: 1 });
    expect(stateChanges(host.publications).at(-1)).toMatchObject({ cause: 'start', epoch: epoch + epochs, revision: 0, ops: [] });

    // The demo fault works again on the rebuilt ring: injected, the two agree; cleared by the action, they agree.
    await host.engine.command(supervisor, 'inject', 'AUDIT_TAMPER');
    expect(observe(host)).toEqual({ listed: true, alert: true, viewVerifies: false });
    await host.engine.command(supervisor, 'clearFault', 'AUDIT_TAMPER');
    expect(observe(host)).toEqual({ listed: false, alert: false, viewVerifies: true });
    expect(verifyTrail(await readTrail(owner), await readHead(owner))).toMatchObject({ ok: true });
  });

  it.each(['resync', 'reset'] as const)('a start in the mode %s with no tamper fault active appends nothing: a fault of the hardware is not the overlay\'s', async (mode) => {
    const target = await db.another({ slug: `b2a_untampered_${mode}` });
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir);
    await host.app.readiness.boot();
    await host.engine.command(host.principal('SUPERVISOR'), 'inject', 'GNSS_LOSS');
    await host.drive(2_000);
    await host.engine.stop();
    const head = await readHead(owner);
    const health = await healthRows(owner);
    host.clock.advance(STOP_MS);
    await host.engine.start(mode);
    expect(await readHead(owner)).toEqual(head);
    expect(await healthRows(owner)).toEqual(health);
    expect(host.engine.slice('faults').active.map((fault) => fault.kind)).toEqual(['GNSS_LOSS']);
    expect(host.log.lines().filter((line) => line['msg'] === 'engine started').at(-1)).toMatchObject({ mode, tamperCleared: false, auditRows: 0 });
  });
});

describe('the tablet link at a start: the first state of an epoch says what the open sockets say (finding F78; decision D119; spec §6.8, §8.6, §12.4)', () => {
  type Link = DurableSlices['tabletLink'];
  interface Start {
    readonly epoch: number;
    readonly link: Link;
    readonly tablet: { online: boolean; status: string } | undefined;
  }
  const tabletOf = (host: EngineApp) => host.engine.slice('otherDevices').find((device) => device.id === 'TABLET');
  const startedLine = (host: EngineApp) => host.log.lines().filter((line) => line['msg'] === 'engine started').at(-1);
  /** The statements of a unit that change a row. */
  const writesOf = (statements: readonly string[]): string[] => statements.filter((text) => /^\s*(?:insert|update|delete|merge)\b/i.test(text));

  /**
   * At every publication of a start, the link a reader gets AT THAT MOMENT: what the realtime
   * channel puts into the snapshot of the new epoch (it reads `engine.state()` when it is told).
   */
  function watchStarts(host: EngineApp): Start[] {
    const starts: Start[] = [];
    host.app.seams.replace('publish', (publication) => {
      host.publications.push(publication);
      if (publication.kind !== 'state' || publication.change.cause !== 'start') return;
      const tablet = tabletOf(host);
      starts.push({ epoch: publication.change.epoch, link: host.engine.slice('tabletLink'), tablet: tablet === undefined ? undefined : { online: tablet.online, status: tablet.status } });
    });
    return starts;
  }

  /** A server that booted on a seeded clone: a process start, so the link is OFFLINE. */
  async function bootedServer(target: TestDatabase) {
    const host = await engineApp(target, db.run.dataDir);
    const starts = watchStarts(host);
    await host.app.readiness.boot();
    await host.drive(1_000);
    return { host, starts };
  }

  /**
   * What the realtime channel does when the first socket of a paired device opens: the hosted
   * action with no actor. From then on a device socket is PRESENT, across every stop of the engine.
   */
  async function deviceSocketOpens(host: EngineApp): Promise<void> {
    host.clock.advance(1_000);
    await host.engine.setTabletLink('CONNECTED');
  }

  /** What the channel does at its next pace step after a start: it sets the link only when it is not what the sockets say. */
  async function paceStep(host: EngineApp, socketsSay: Link['state']): Promise<{ statements: number; revisions: number }> {
    const sent = host.database.statements.length;
    const revision = host.engine.revision;
    if (host.engine.slice('tabletLink').state !== socketsSay) await host.engine.setTabletLink(socketsSay);
    return { statements: host.database.statements.length - sent, revisions: host.engine.revision - revision };
  }

  it('a process start (no socket can be open): the stored CONNECTED becomes OFFLINE in the start\'s own unit, with the truthful row (§8.6); a new process holds no link of an earlier one', async () => {
    const target = await db.another({ slug: 'b2a_link_process' });
    const owner = target.ownerPool();
    expect((await storedSlices(owner)).tabletLink.state).toBe('CONNECTED');
    const first = await bootedServer(target);
    expect(first.starts).toEqual([{ epoch: 1, link: { state: 'OFFLINE', changedAt: FIXED_NOW }, tablet: { online: false, status: 'OFFLINE' } }]);
    expect(startedLine(first.host)).toMatchObject({ mode: 'boot', tabletLinkReset: true, tabletLinkCarried: false, auditRows: 1 });
    expect((await readTrail(owner)).at(-1)).toMatchObject({ type: 'TABLET_LINK_CHANGED', actorId: null, at: FIXED_NOW, details: { state: 'OFFLINE' } });

    // A device connects, and the process ends with the link CONNECTED in the tables.
    await deviceSocketOpens(first.host);
    await first.host.app.close();
    expect((await storedSlices(owner)).tabletLink.state).toBe('CONNECTED');
    const rows = (await readTrail(owner)).length;

    // The next process: its sockets are its own, and none is open at its start.
    const second = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + STOP_MS });
    const starts = watchStarts(second);
    await second.app.readiness.boot();
    expect(starts).toEqual([{ epoch: 2, link: { state: 'OFFLINE', changedAt: FIXED_NOW + STOP_MS }, tablet: { online: false, status: 'OFFLINE' } }]);
    expect(startedLine(second)).toMatchObject({ mode: 'boot', tabletLinkReset: true, tabletLinkCarried: false });
    const added = (await readTrail(owner)).slice(rows);
    expect(added.map((row) => [row.type, row.actorId, row.details['state']])).toEqual([['TABLET_LINK_CHANGED', null, 'OFFLINE']]);
  });

  it.each([
    ['boot', true],
    ['boot', false],
    ['resync', true],
    ['resync', false],
  ] as const)('a start in the mode %s of a process that ran, device socket present: %s. The first state of the epoch holds the link the engine held; no row, and the next pace step has nothing to set', async (mode, present) => {
    const target = await db.another({ slug: `b2a_link_${mode}_${present ? 'with' : 'without'}` });
    const owner = target.ownerPool();
    const { host, starts } = await bootedServer(target);
    if (present) await deviceSocketOpens(host);
    await host.drive(1_000);
    const held = host.engine.slice('tabletLink');
    expect(held.state).toBe(present ? 'CONNECTED' : 'OFFLINE');
    const epoch = host.engine.epoch;

    await host.engine.stop();
    const trail = await readTrail(owner);
    const events = (await storedSlices(owner)).events.length;
    host.clock.advance(STOP_MS);
    const mark = host.database.statements.length;
    await host.engine.start(mode);

    // What the snapshot of the new epoch holds: the link of the sockets, and the tablet's entry derived from it.
    expect(starts.at(-1)).toEqual({ epoch: epoch + 1, link: held, tablet: { online: present, status: held.state } });
    expect(host.engine.slice('tabletLink')).toEqual(held);
    // Nothing was appended for the link: the stored state was this Core's own, and it was already true.
    expect(await readTrail(owner)).toEqual(trail);
    expect((await storedSlices(owner)).events).toHaveLength(events);
    expect(writesOf(host.database.statements.slice(mark)).filter((text) => !text.startsWith('update "core_state"'))).toEqual([]);
    expect(startedLine(host)).toMatchObject({ mode, tabletLinkReset: false, tabletLinkCarried: false, auditRows: 0 });
    // The channel's next pace step compares and has nothing to set: no delta follows the snapshot.
    expect(await paceStep(host, held.state)).toEqual({ statements: 0, revisions: 0 });
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
  });

  /** The reset of a running server by the real routine, and the reload (the order of spec §12.4 and contract §8.5). */
  async function resetAndReload(host: EngineApp, target: TestDatabase) {
    const release = host.app.readiness.hold('reset');
    const report = await resetDatabase(
      {
        database: target.name,
        clock: () => host.clock.now(),
        actorId: host.principal('SUPERVISOR').operatorId,
        reason: 'RESET',
        scenario: 'idle',
        dataDir: db.run.dataDir,
        quiesce: async () => {
          await host.app.pipeline.drain();
          await host.engine.stop();
          await host.app.db.close();
        },
      },
      { testRunPrefix: db.run.identity.prefix },
    );
    await host.app.db.reopen();
    expect(await host.app.db.probe({ fresh: true })).toBe(true);
    // What the routine built: the dataset's link, which is CONNECTED whatever the sockets say.
    const built = await storedSlices(host.app.db.pool);
    const mark = host.database.statements.length;
    await host.engine.reload();
    release();
    return { report, built, reloadStatements: host.database.statements.slice(mark) };
  }

  it.each([
    [false, 'no paired device holds a socket: the snapshot of the new epoch says OFFLINE, not the dataset\'s CONNECTED'],
    [true, 'a paired device holds a socket: the snapshot says CONNECTED, since the instant it connected'],
  ] as const)('a demo reset and the reload (mode reset), device socket present: %s. %s; no row describes a change, and the next pace step has nothing to set', async (present, _what) => {
    const target = await db.another({ slug: `b2a_link_reset_${present ? 'with' : 'without'}` });
    const maintenance = maintenancePool(db.run.dataDir);
    try {
      const { host, starts } = await bootedServer(target);
      if (present) await deviceSocketOpens(host);
      await host.drive(2_000);
      const held = host.engine.slice('tabletLink');
      expect(held).toEqual(present ? { state: 'CONNECTED', changedAt: FIXED_NOW + 2_000 } : { state: 'OFFLINE', changedAt: FIXED_NOW });
      const epoch = host.engine.epoch;

      const { report, built, reloadStatements } = await resetAndReload(host, target);
      const resetAt = host.clock.now();
      expect(report).toMatchObject({ previousEpoch: epoch, epoch: epoch + 1, scenario: 'idle' });
      // The premise of the finding: the rebuilt database says CONNECTED since the reset instant, for everybody.
      expect(built.tabletLink).toEqual({ state: 'CONNECTED', changedAt: resetAt });
      expect(resetAt).toBeGreaterThan(held.changedAt);

      // The first state of the new epoch: the link of the open sockets, whole, with the instant it changed at.
      expect(starts.at(-1)).toEqual({ epoch: report.epoch, link: held, tablet: { online: present, status: held.state } });
      expect(host.engine).toMatchObject({ running: true, epoch: report.epoch, revision: 0 });
      expect(startedLine(host)).toMatchObject({ mode: 'reset', tabletLinkReset: false, tabletLinkCarried: true, auditRows: 0 });

      // No row and no event describes a change of the link: nothing connected or disconnected. The chain is the
      // seed history and the routine's one row, and the reload wrote one thing: the hardware snapshot.
      const owner = target.ownerPool();
      const trail = await readTrail(owner);
      expect(trail.at(-1)).toMatchObject({ seq: report.auditHead.seq, type: 'SCENARIO_LOADED', hash: report.auditHead.hash });
      expect(host.engine.slice('audit')).toMatchObject({ total: report.auditHead.seq, head: report.auditHead.hash });
      expect(host.engine.slice('events')).toEqual(built.events);
      expect(host.engine.slice('meta').counters).toEqual(built.meta.counters);
      expect(writesOf(reloadStatements)).toEqual([expect.stringMatching(/^update "hardware_snapshot"/)]);
      // Nothing else of the rebuilt state moved: every other slice is the routine's.
      const moved = changedSlices(built, withoutNegativeZeros(host.engine.state()) as DurableSlices, [...SNAPSHOT_SLICE_KEYS]).filter(
        (key) => JSON.stringify(built[key]) !== JSON.stringify(host.engine.state()[key]),
      );
      expect(moved.sort()).toEqual(present ? ['tabletLink'] : ['otherDevices', 'tabletLink']);
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));

      // The channel's next pace step compares and has nothing to set: no delta follows the snapshot.
      expect(await paceStep(host, held.state)).toEqual({ statements: 0, revisions: 0 });
      expect(stateChanges(host.publications).at(-1)).toMatchObject({ cause: 'start', epoch: report.epoch, revision: 0, ops: [] });

      // A change that DOES happen afterwards has its row: the device disconnects, or one connects.
      host.clock.advance(5_000);
      await host.engine.setTabletLink(present ? 'OFFLINE' : 'CONNECTED');
      const after = await readTrail(owner);
      expect(after.slice(trail.length).map((row) => [row.type, row.actorId, row.at, row.details['state']])).toEqual([
        ['TABLET_LINK_CHANGED', null, host.clock.now(), present ? 'OFFLINE' : 'CONNECTED'],
      ]);
      expect(verifyTrail(after, await readHead(owner))).toMatchObject({ ok: true, checked: after.length });

      // The link the engine holds is the one of its LAST stop: a second stop and start begin with the changed one.
      const changed = host.engine.slice('tabletLink');
      expect(changed).toEqual({ state: present ? 'OFFLINE' : 'CONNECTED', changedAt: host.clock.now() });
      await host.engine.stop();
      host.clock.advance(STOP_MS);
      await host.engine.start('resync');
      expect(starts.at(-1)).toEqual({ epoch: report.epoch + 1, link: changed, tablet: { online: !present, status: changed.state } });
      expect(startedLine(host)).toMatchObject({ mode: 'resync', tabletLinkCarried: false, auditRows: 0 });
      expect(await readTrail(owner)).toEqual(after);
      await host.app.close();
    } finally {
      await discard(maintenance, target, db.run.identity.prefix);
      await maintenance.end();
    }
  });

  it('the FIRST start of a process in the mode reset or resync holds no link of its own: the stored one stays, and nothing is written for it', async () => {
    for (const mode of ['reset', 'resync'] as const) {
      const target = await db.another({ slug: `b2a_link_first_${mode}` });
      const owner = target.ownerPool();
      const before = await storedSlices(owner);
      const host = await engineApp(target, db.run.dataDir);
      const starts = watchStarts(host);
      const head = await readHead(owner);
      await host.engine.start(mode);
      expect(starts).toEqual([{ epoch: mode === 'reset' ? 0 : 1, link: before.tabletLink, tablet: { online: true, status: 'CONNECTED' } }]);
      expect(startedLine(host)).toMatchObject({ mode, tabletLinkReset: false, tabletLinkCarried: false, auditRows: 0 });
      expect(await readHead(owner)).toEqual(head);
      await host.app.close();
    }
  });
});

describe('the server clock (ENG-13, ENG-14)', () => {
  it('a server clock that is behind the stored state never stamps a row before a stored one', async () => {
    const target = await db.another({ slug: 'w26_clock_behind' });
    const owner = target.ownerPool();
    const newest = Math.max(...(await readTrail(owner)).map((row) => row.at));
    const host = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW - 3_600_000 });
    // ONE time base (decision D110; `clock-floor.db.test.ts`): the floor is the SERVER clock's.
    // The server's own clock, on the test's manual clock as system time and timer, can take it.
    const read = (): number => host.clock.now();
    host.app.seams.replace('clock', createSystemClock(read, read));
    await host.app.readiness.boot();
    expect(host.log.lines().find((line) => line['code'] === 'ENGINE_CLOCK_BEHIND')).toMatchObject({ level: 40 });
    const last = (await readTrail(owner)).at(-1);
    expect(last?.type).toBe('TABLET_LINK_CHANGED');
    expect(last?.at).toBeGreaterThanOrEqual(newest);
    // What every module reads is what the engine stamped that row with, an hour past the system time.
    expect(host.clock.now()).toBe(FIXED_NOW - 3_600_000);
    expect(host.app.clock.now()).toBe(last?.at);
    await host.drive(2_000);
    const written = await owner.query<{ at: string }>('SELECT written_at::text AS at FROM public.hardware_snapshot');
    expect(Number(written.rows[0]?.at)).toBeGreaterThanOrEqual(newest);
  });
});

describe('shutdown (spec §8.6 "Stop")', () => {
  it('the stop writes what a tick left for the next second, and leaves no timer, no queued unit and no open client', async () => {
    const target = await db.another({ slug: 'w26_shutdown' });
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir);
    await host.app.readiness.boot();
    await host.engine.command(host.principal('TECHNICIAN'), 'runDiagnostics');

    // Tick until the engine holds a snapshot slice that is not written yet.
    let pending: string[] = [];
    for (let tick = 0; tick < 400 && pending.length === 0; tick += 1) {
      await host.drive(50);
      pending = changedSlices(host.engine.state(), pickDurable(host.engine.simulator()?.store.getState() as DurableSlices), SNAPSHOT_SLICE_KEYS);
    }
    expect(pending.length).toBeGreaterThan(0);
    const working = pickDurable(host.engine.simulator()?.store.getState() as DurableSlices);
    expect(await storedSlices(owner)).not.toStrictEqual(withoutNegativeZeros(working));
    const stoppedAt = host.clock.now();

    await host.app.close();

    // The last unit wrote it: the tables hold the engine's working state, stamped at the stop.
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(working));
    const written = await owner.query<{ at: string }>('SELECT written_at::text AS at FROM public.hardware_snapshot');
    expect(Number(written.rows[0]?.at)).toBe(stoppedAt);
    expect(host.log.lines().filter((line) => line['msg'] === 'engine stopped')).toHaveLength(1);
    expect(host.log.lines().find((line) => line['msg'] === 'pipeline closed')).toMatchObject({ drained: true, abandoned: 0 });

    // Nothing is left: no timer, no connection checked out, no session of the runtime role.
    expect(host.timer.active()).toBe(0);
    expect(host.database.connections.inUse).toBe(0);
    // By-design change (checkpoint CP-B1, finding CPB1-14; finding F63 lesson 2): the driver's
    // `pool.end()` resolves before the server has removed the backends, so one read right after
    // the close can still see a session. The question is asked until the answer is 0, for five
    // seconds at most. It is keyed by this test's own database (lesson 1).
    const openSessions = async (): Promise<string | undefined> =>
      (
        await owner.query<{ open: string }>(
          "SELECT count(*)::text AS open FROM pg_stat_activity WHERE datname = current_database() AND usename = 'dems_app'",
        )
      ).rows[0]?.open;
    let open = await openSessions();
    for (let attempt = 0; attempt < 100 && open !== '0'; attempt += 1) {
      await sleep(50);
      open = await openSessions();
    }
    expect(open).toBe('0');
    expect(host.engine.stats().phase).toBe('stopped');

    // A late timer call, and a second close, do nothing.
    const sent = host.database.statements.length;
    host.timer.fire();
    host.engine.fire();
    await host.engine.stop();
    expect(host.database.statements).toHaveLength(sent);
  });
});

// ═══ Moved here from `pass-j-restart-recording.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// CLOSING PASS J of fix wave I, on a BOOTED Core and the STORED audit chain (rulings D217 (5), (7)).
//
//   G75b-03, the states driver A2 left: a Core stopped while its session was RECORDING and started
//   again in capture mode `real` still moves that session to FAULT (kind `POWER_FAIL`, `fromState`
//   RECORDING - what an interrupted seal reads is unchanged), but the STORED row says "The Core was
//   not running while this session was active" and carries `coreNotRunning: true`. Nothing stored
//   says "power fail".
//   G75b-06 at its source: the state such a Core serves says `security.platformNotReported: true`
//   (and `time.hostClock`), and the slice still passes the contract.
//   The same stop and start of a SIMULATED Core keeps the simulator's words and its slice (control).
//
// The stored state is made by a first process in simulated capture (no worker, no media), closed
// while RECORDING. The second process is the real app factory in REAL_DEVELOPMENT on the same
// database (row 61's boot fixture: a stand-in worker script, a test signing key, `/bin/echo` as the
// helper program - no camera and no microphone is listed, opened or asked for).
describe('G75b-03, G75b-06: a restart while RECORDING, on a booted Core in real capture and in simulated capture', () => {
  const fixture = realBootFixture('passj_restart');
  fixture.provisionKey();
  // Task 4 row 228b: the fixture is a temporary directory and goes with the block, passed or failed.
  afterAll(() => fixture.remove());
  vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

  const SESSION_INPUT = { caseNumber: 'LP/2026/1010-0301', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;
  type Target = Awaited<ReturnType<typeof db.another>>;

  /** A first process in simulated capture, closed while its session is RECORDING. */
  async function closedWhileRecording(target: Target): Promise<{ sessionId: string; closedAt: number; rows: number }> {
    await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
    const first = await engineApp(target, db.run.dataDir);
    await first.app.readiness.boot();
    const investigator = first.principal('INVESTIGATOR');
    await first.engine.setTabletLink('CONNECTED');
    await first.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
    await first.engine.command(investigator, 'beginPrecheck');
    await first.drive(5_000);
    if (first.engine.slice('session')?.state === 'PRECHECK') await first.engine.command(investigator, 'acknowledgePrecheckWarnings');
    await first.engine.command(investigator, 'startRecording');
    await first.drive(3_000);
    expect(first.engine.slice('session')?.state).toBe('RECORDING');
    const sessionId = first.engine.slice('session')?.id ?? '';
    await first.app.pipeline.drain();
    const closedAt = first.clock.now();
    await first.app.close();
    return { sessionId, closedAt, rows: (await readTrail(target.ownerPool())).length };
  }

  const since = async (target: Target, from: number): Promise<AuditRow[]> => (await readTrail(target.ownerPool())).slice(from) as unknown as AuditRow[];

  describe('a start of the Core with a session that was RECORDING when it stopped', () => {
    it('REAL capture: the stored fault row says the Core was not running (kind and fromState unchanged), and the served state says the platform is not reported', async () => {
      const target = await db.another({ template: 'seed', slug: 'passj_restart_real' });
      const { sessionId, closedAt, rows } = await closedWhileRecording(target);

      const log = captureLog();
      const app = buildApp({
        config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-passj-restart', 'capture-worker/0.4.0') }),
        logStream: log.stream,
      });
      target.onCleanup(() => app.close());
      await app.ready();
      app.seams.replace('clock', createManualClock(closedAt + 60_000));
      app.seams.replace('publish', () => {});
      engineControl(app).useTimer(manualTimer().timer);
      await app.readiness.boot();
      await app.pipeline.drain();
      expect(captureFenceControl(app).operation).toBe('REAL_DEVELOPMENT');

      // G75b-03: the stored rows.
      const written = await since(target, rows);
      const raised = written.filter((row) => row.type === 'FAULT_RAISED' && row.details['kind'] === 'POWER_FAIL');
      expect(raised.map((row) => row.message)).toEqual([CORE_NOT_RUNNING_SENTENCE]);
      expect(raised[0]).toMatchObject({ sessionId, details: { kind: 'POWER_FAIL', fromState: 'RECORDING', ...CORE_NOT_RUNNING_FAULT_EXAMPLE } });
      expect(written.filter((row) => /power\s*fail/i.test(row.message))).toEqual([]);

      // What an interrupted seal reads did not move; the member is on every record of the fault.
      const state = app.engine.state();
      const fault = state.session?.id === sessionId ? state.session.fault : null;
      if (fault !== null && fault !== undefined) expect(fault).toMatchObject({ kind: 'POWER_FAIL', fromState: 'RECORDING', coreNotRunning: true });
      const alert = state.alerts.findLast((candidate) => candidate.kind === 'POWER_FAIL');
      expect(alert).toMatchObject({ message: CORE_NOT_RUNNING_SENTENCE, params: { kind: 'POWER_FAIL', coreNotRunning: true } });
      expect(state.alerts.filter((candidate) => /power\s*fail/i.test(candidate.message) && candidate.at >= closedAt)).toEqual([]);

      // G75b-06 at its source: the Core's own statement, in the served slice, within the contract.
      expect(state.security).toMatchObject(SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE);
      expect(SecuritySliceSchema.safeParse(state.security).success).toBe(true);
      expect(state.time.hostClock).toBe(true);

      const trail = await readTrail(target.ownerPool());
      expect(linkProblems(trail)).toEqual([]);
      expect(verifyTrail(trail, await readHead(target.ownerPool())).ok).toBe(true);
    });

    it('CONTROL - SIMULATED capture keeps the simulator\'s words and its security slice', async () => {
      const target = await db.another({ template: 'seed', slug: 'passj_restart_sim' });
      const { sessionId, closedAt, rows } = await closedWhileRecording(target);
      const second = await engineApp(target, db.run.dataDir, { startAt: closedAt + 60_000 });
      await second.app.readiness.boot();
      await second.app.pipeline.drain();
      expect(second.engine.slice('session')).toMatchObject({ id: sessionId, state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: 'RECORDING' } });
      expect(second.engine.slice('session')?.fault).not.toHaveProperty('coreNotRunning');
      const raised = (await since(target, rows)).filter((row) => row.type === 'FAULT_RAISED');
      expect(raised.map((row) => row.message)).toEqual(['Power fail detected — recovery marker written']);
      expect(raised[0]?.details).not.toHaveProperty('coreNotRunning');
      expect(second.engine.slice('security')).not.toHaveProperty('platformNotReported');
      expect(second.engine.slice('security')).toMatchObject({ posture: 'SECURE', tpm: { ok: true }, secureBoot: true });
    });
  });
});

// ═══ Moved here from `wave-i-a2-graceful-restart.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// FIX WAVE I, DRIVER A2 - finding G75b-03 of re-gate 75, ruling D216 (3), on a BOOTED Core and the
// STORED audit chain: a Core that is stopped with `app.close()` (what SIGTERM of `lane.sh stop`
// runs) while a session is FINALIZING, and started again in capture mode `real`, writes no
// power-failure row and no tablet row. The same stop and start of a SIMULATED Core keeps the
// simulator's restart model (control).
//
// The stored state is made by a first process in simulated capture (no worker, no media: the
// session is stopped by its operator and the process is closed while it is FINALIZING, with the
// tablet link CONNECTED). The second process is the real app factory in REAL_DEVELOPMENT on the
// same database (row 61's boot fixture: a stand-in worker script, a test signing key, `/bin/echo`
// as the helper program - no camera and no microphone is listed, opened or asked for).
describe('G75b-03: a graceful restart while FINALIZING, on a booted Core in real capture and in simulated capture', () => {
  const fixture = realBootFixture('waveia2_restart');
  fixture.provisionKey();
  afterAll(() => fixture.remove());
  vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

  const SESSION_INPUT = { caseNumber: 'LP/2026/1010-0201', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;
  type Target = Awaited<ReturnType<typeof db.another>>;

  /** A first process in simulated capture, closed while its session is FINALIZING and the tablet link is CONNECTED. */
  async function closedWhileFinalizing(target: Target): Promise<{ sessionId: string; closedAt: number; rows: number }> {
    await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
    const first = await engineApp(target, db.run.dataDir);
    await first.app.readiness.boot();
    const investigator = first.principal('INVESTIGATOR');
    await first.engine.setTabletLink('CONNECTED');
    await first.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
    await first.engine.command(investigator, 'beginPrecheck');
    await first.drive(5_000);
    if (first.engine.slice('session')?.state === 'PRECHECK') await first.engine.command(investigator, 'acknowledgePrecheckWarnings');
    await first.engine.command(investigator, 'startRecording');
    await first.drive(3_000);
    await first.engine.command(investigator, 'stopRecording', 'Interview complete');
    await first.drive(STOPPING_MS + 100, 100);
    expect(first.engine.slice('session')?.state).toBe('FINALIZING');
    expect(first.engine.slice('tabletLink').state).toBe('CONNECTED');
    const sessionId = first.engine.slice('session')?.id ?? '';
    await first.app.pipeline.drain();
    const closedAt = first.clock.now();
    // THE GRACEFUL STOP: the hooks SIGTERM runs.
    await first.app.close();
    return { sessionId, closedAt, rows: (await readTrail(target.ownerPool())).length };
  }

  const since = async (target: Target, from: number): Promise<AuditRow[]> => (await readTrail(target.ownerPool())).slice(from) as unknown as AuditRow[];

  describe('G75b-03: a graceful stop and a start of the Core with a session that is FINALIZING', () => {
    it('REAL capture: the start writes no FAULT_RAISED "Power fail", no TABLET_LINK_CHANGED and raises no alert; the session is still FINALIZING and the chain verifies', async () => {
      const target = await db.another({ template: 'seed', slug: 'waveia2_restart_real' });
      const { sessionId, closedAt, rows } = await closedWhileFinalizing(target);

      const log = captureLog();
      const app = buildApp({
        config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-waveia2-restart', 'capture-worker/0.4.0') }),
        logStream: log.stream,
      });
      target.onCleanup(() => app.close());
      await app.ready();
      app.seams.replace('clock', createManualClock(closedAt + 60_000));
      app.seams.replace('publish', () => {});
      engineControl(app).useTimer(manualTimer().timer);
      await app.readiness.boot();
      await app.pipeline.drain();
      expect(captureFenceControl(app).operation).toBe('REAL_DEVELOPMENT');

      const written = await since(target, rows);
      expect(written.filter((row) => row.type === 'FAULT_RAISED')).toEqual([]);
      expect(written.filter((row) => row.type === 'TABLET_LINK_CHANGED')).toEqual([]);
      expect(written.filter((row) => /power fail|tablet control offline/i.test(row.message))).toEqual([]);
      // What a real boot does write is said by name: the one boot row of the capture fence.
      expect(written.filter((row) => row.type === 'SYSTEM_BOOT').map((row) => row.details['captureOperation'])).toEqual(['REAL_DEVELOPMENT']);
      const state = app.engine.state();
      expect(state.faults.active.map((fault) => fault.kind)).not.toContain('POWER_FAIL');
      expect(state.alerts.filter((alert) => alert.active && /power fail/i.test(alert.message))).toEqual([]);
      expect(state.tabletLink.state).toBe('OFFLINE');
      // The session was not faulted by the start: it is the session the seal resumes, or - here, where the first
      // process recorded no media - the one the sealing unit ends by its own rule. Never FAULT from a power failure.
      expect(state.session?.fault?.kind ?? null).not.toBe('POWER_FAIL');
      if (state.session !== null) expect([state.session.id, state.session.state]).toEqual([sessionId, 'FINALIZING']);
      expect(log.lines().some((line) => line['msg'] === 'engine started' && line['restartFault'] === null && line['tabletLinkOfflineUnwritten'] === true)).toBe(true);
      const trail = await readTrail(target.ownerPool());
      expect(linkProblems(trail)).toEqual([]);
      expect(verifyTrail(trail, await readHead(target.ownerPool())).ok).toBe(true);
    });

    it('CONTROL - SIMULATED capture keeps its restart model: the same stop and start write the restart fault from FINALIZING and the tablet row', async () => {
      const target = await db.another({ template: 'seed', slug: 'waveia2_restart_sim' });
      const { sessionId, closedAt, rows } = await closedWhileFinalizing(target);
      const second = await engineApp(target, db.run.dataDir, { startAt: closedAt + 60_000 });
      await second.app.readiness.boot();
      await second.app.pipeline.drain();
      expect(second.engine.slice('session')).toMatchObject({ id: sessionId, state: 'FAULT', fault: { kind: 'POWER_FAIL', fromState: 'FINALIZING' } });
      const written = await since(target, rows);
      expect(written.map((row) => row.type)).toEqual(['FAULT_RAISED', 'TABLET_LINK_CHANGED']);
      expect(written[0]).toMatchObject({ sessionId, details: { kind: 'POWER_FAIL', fromState: 'FINALIZING' } });
    });
  });
});

// ═══ Moved here from `wave-k-s1-restart-fault.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// FIX WAVE K, driver S1 - re-gate 75 finding G75c-01 (MAJOR), on BOOTED Cores and the STORED chain.
//
// One database, four processes:
//   1  simulated capture, closed while its session is RECORDING (the stored state of a stopped Core);
//   2  REAL_DEVELOPMENT: the start raises the restart fault ("The Core was not running ..."); the
//      session is then sealed through the engine's own door (`completeSeal`, what the sealing
//      pipeline calls) - ONE `FAULT_CLEARED` row commits with the seal and the alert is resolved;
//   3  REAL_DEVELOPMENT, no session open: the start raises nothing and clears nothing;
//   4  the same again (the "second clean restart" of the gate): still nothing.
// The pure rule, its control (the tree before the fix leaves the fault) and the heal of a stored
// stuck fault are in the G75c-01 cases of `rehydrate.test.ts`.
//
// The real processes use row 61's boot fixture: a stand-in worker script, a test signing key,
// `/bin/echo` as the helper program - no camera and no microphone is listed, opened or asked for.
describe('G75c-01: the life of the restart fault over four processes on one database', () => {
  const fixture = realBootFixture('wavek_s1_restart');
  fixture.provisionKey();
  afterAll(() => fixture.remove());
  vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

  const SESSION_INPUT = { caseNumber: 'LP/2026/1011-0401', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;
  type Target = Awaited<ReturnType<typeof db.another>>;
  const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);

  /** A first process in simulated capture, closed while its session is RECORDING. */
  async function closedWhileRecording(target: Target): Promise<{ sessionId: string; closedAt: number; rows: number }> {
    await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
    const first = await engineApp(target, db.run.dataDir);
    await first.app.readiness.boot();
    const investigator = first.principal('INVESTIGATOR');
    await first.engine.setTabletLink('CONNECTED');
    await first.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
    await first.engine.command(investigator, 'beginPrecheck');
    await first.drive(5_000);
    if (first.engine.slice('session')?.state === 'PRECHECK') await first.engine.command(investigator, 'acknowledgePrecheckWarnings');
    await first.engine.command(investigator, 'startRecording');
    await first.drive(3_000);
    expect(first.engine.slice('session')?.state).toBe('RECORDING');
    const sessionId = first.engine.slice('session')?.id ?? '';
    await first.app.pipeline.drain();
    const closedAt = first.clock.now();
    await first.app.close();
    return { sessionId, closedAt, rows: (await readTrail(target.ownerPool())).length };
  }

  /** A REAL_DEVELOPMENT process on the same database, booted at `at`. */
  async function realCore(target: Target, at: number, name: string) {
    const log = captureLog();
    const app = buildApp({
      config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker(name, 'capture-worker/0.4.0') }),
      logStream: log.stream,
    });
    let closed = false;
    const close = async (): Promise<void> => {
      if (closed) return;
      closed = true;
      await app.close();
    };
    target.onCleanup(close);
    await app.ready();
    const clock = createManualClock(at);
    app.seams.replace('clock', clock);
    app.seams.replace('publish', () => {});
    engineControl(app).useTimer(manualTimer().timer);
    await app.readiness.boot();
    await app.pipeline.drain();
    expect(captureFenceControl(app).operation).toBe('REAL_DEVELOPMENT');
    return { app, clock, log, close };
  }

  const steps = (running: number): SealingStepReport[] =>
    SEALING_STEP_ORDER.map((id, index) => ({ id, status: index < running ? 'DONE' : index === running ? 'RUNNING' : 'PENDING', progress: index < running ? 100 : 0, etaMs: null, attempt: 1 }));

  const sealInput = (sessionId: string, at: number): CompleteSealInput => ({
    sessionId,
    sealedAt: at,
    manifestSha256: hex('ab'),
    signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
    tracks: [
      { trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: hex('01') },
      { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: hex('02') },
    ],
    interrupted: true,
    durableEndAt: at - 1_000,
    transcriptSha256: null,
    labelsStatus: null,
    developmentSources: true,
  });

  const trail = async (target: Target): Promise<AuditRow[]> => (await readTrail(target.ownerPool())) as unknown as AuditRow[];
  const ofRestart = (rows: readonly AuditRow[], type: string) => rows.filter((row) => row.type === type && row.details['kind'] === 'POWER_FAIL');

  describe('G75c-01: the restart fault over two restarts of a real-capture Core', () => {
    it('raised at the start, cleared ONCE with the seal of its session, alert resolved; the next two starts (no session open) raise nothing and clear nothing', async () => {
      const target = await db.another({ template: 'seed', slug: 'wavek_s1_restart' });
      const { sessionId, closedAt, rows } = await closedWhileRecording(target);

      // Process 2: the restart fault is raised and stays while its session is open.
      const second = await realCore(target, closedAt + 60_000, 'worker-wavek-restart-2');
      const raised = ofRestart((await trail(target)).slice(rows), 'FAULT_RAISED');
      expect(raised.map((row) => row.message)).toEqual([CORE_NOT_RUNNING_SENTENCE]);
      const open = second.app.engine.state();
      expect(open.session).toMatchObject({ id: sessionId, state: 'FAULT', fault: { kind: 'POWER_FAIL', coreNotRunning: true } });
      expect(open.faults.active.filter((fault) => fault.kind === 'POWER_FAIL')).toHaveLength(1);
      const alertId = open.alerts.findLast((alert) => alert.kind === 'POWER_FAIL' && alert.active)?.id ?? '';
      expect(alertId).not.toBe('');
      expect(ofRestart((await trail(target)).slice(rows), 'FAULT_CLEARED')).toEqual([]);

      // The interrupted seal, through the engine's doors (what the sealing pipeline calls).
      await sealDoorsOf(second.app.engine).applySealingProgress({ sessionId, steps: steps(5) });
      expect(second.app.engine.state().faults.active.filter((fault) => fault.kind === 'POWER_FAIL')).toHaveLength(1);
      await sealDoorsOf(second.app.engine).completeSeal(sealInput(sessionId, second.clock.now()));
      await second.app.pipeline.drain();

      const sealed = second.app.engine.state();
      expect(sealed.session).toMatchObject({ id: sessionId, state: 'SEALED' });
      expect(sealed.faults.active.filter((fault) => fault.kind === 'POWER_FAIL')).toEqual([]);
      expect(sealed.alerts.find((alert) => alert.id === alertId)).toMatchObject({ active: false });
      expect(sealed.alerts.filter((alert) => alert.active && alert.severity === 'CRITICAL')).toEqual([]);
      const afterSeal = await trail(target);
      const cleared = ofRestart(afterSeal.slice(rows), 'FAULT_CLEARED');
      expect(cleared.map((row) => row.message)).toEqual([CORE_NOT_RUNNING_CLEARED_SENTENCE]);
      expect(cleared[0]).toMatchObject({ sessionId, details: { kind: 'POWER_FAIL', coreNotRunning: true } });
      // In the unit of the seal: after EVIDENCE_SEALED, nothing of another unit between them.
      const types = afterSeal.slice(rows).map((row) => row.type);
      expect(types.indexOf('FAULT_CLEARED')).toBeGreaterThan(types.indexOf('EVIDENCE_SEALED'));
      // G89b-01 (the same wave): the WARNING notice "the stream is not the configured profile" is written through its
      // door, stored, and read back by the next start (a start refuses a stored state it cannot map).
      const noticed = await sealingNoticeDoorsOf(second.app.engine).noteStreamProfileDiffers?.({ sessionId, tracks: [{ trackId: 'VIDEO-01', configured: 'H264_1080P25', stream: 'H264_720P30' }] });
      expect(noticed?.value).toBe(true);
      await second.app.pipeline.drain();
      expect(second.app.engine.state().alerts.findLast((alert) => alert.params?.['reason'] === STREAM_PROFILE_DIFFERS_REASON)).toMatchObject({ severity: 'WARNING', active: false, target: sessionId });
      const sealedAt = second.clock.now();
      await second.close();

      // Processes 3 and 4: no session open. Nothing raised, nothing cleared, the alert stays resolved.
      let from = (await trail(target)).length;
      for (const [index, name] of ['worker-wavek-restart-3', 'worker-wavek-restart-4'].entries()) {
        const next = await realCore(target, sealedAt + (index + 1) * 60_000, name);
        const written = (await trail(target)).slice(from);
        expect(written.filter((row) => row.type === 'FAULT_RAISED' || row.type === 'FAULT_CLEARED')).toEqual([]);
        const state = next.app.engine.state();
        expect(state.faults.active).toEqual([]);
        expect(state.alerts.findLast((alert) => alert.params?.['reason'] === STREAM_PROFILE_DIFFERS_REASON)).toMatchObject({ severity: 'WARNING', active: false, target: sessionId, params: { tracks: 'VIDEO-01:H264_720P30:H264_1080P25' } });
        expect(state.alerts.find((alert) => alert.id === alertId)).toMatchObject({ active: false });
        expect(state.alerts.filter((alert) => alert.active && alert.severity === 'CRITICAL')).toEqual([]);
        expect(next.log.text()).not.toContain('"restartFaultEnded":true');
        from = (await trail(target)).length;
        await next.close();
      }

      const whole = await readTrail(target.ownerPool());
      expect(ofRestart(whole as unknown as AuditRow[], 'FAULT_CLEARED')).toHaveLength(1);
      expect(linkProblems(whole)).toEqual([]);
      expect(verifyTrail(whole, await readHead(target.ownerPool())).ok).toBe(true);
    });
  });
});
