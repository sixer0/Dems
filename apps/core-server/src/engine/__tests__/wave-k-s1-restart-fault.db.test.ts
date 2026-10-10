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
// stuck fault are in `wave-k-s1-restart-fault.test.ts`.
//
// The real processes use row 61's boot fixture: a stand-in worker script, a test signing key,
// `/bin/echo` as the helper program - no camera and no microphone is listed, opened or asked for.
import { CORE_NOT_RUNNING_CLEARED_SENTENCE, CORE_NOT_RUNNING_SENTENCE, createManualClock, type AuditRow, type CompleteSealInput, type SealingStepReport } from '@dems/shared/sim';
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { engineApp, manualTimer } from '../../../test/support/engine';
import { buildApp } from '../../app';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../capture/fence';
import { SEALING_STEP_ORDER } from '../../sealing';
import { engineControl } from '../index';
import { sealDoorsOf } from '../seal-doors';
import { STREAM_PROFILE_DIFFERS_REASON, sealingNoticeDoorsOf } from '../sealing-notice-doors';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('wavek_s1_restart');
fixture.provisionKey();
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
