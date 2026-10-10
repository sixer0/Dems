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
import { STOPPING_MS, createManualClock, type AuditRow } from '@dems/shared/sim';
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
const fixture = realBootFixture('waveia2_restart');
fixture.provisionKey();
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
