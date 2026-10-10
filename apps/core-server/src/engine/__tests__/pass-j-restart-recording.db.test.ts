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
import { SecuritySliceSchema, CORE_NOT_RUNNING_FAULT_EXAMPLE, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api';
import { CORE_NOT_RUNNING_SENTENCE, createManualClock, type AuditRow } from '@dems/shared/sim';
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { engineApp, manualTimer } from '../../../test/support/engine';
import { buildApp } from '../../app';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../capture/fence';
import { engineControl } from '../index';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('passj_restart');
fixture.provisionKey();
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

describe('pass J: a start of the Core with a session that was RECORDING when it stopped', () => {
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
