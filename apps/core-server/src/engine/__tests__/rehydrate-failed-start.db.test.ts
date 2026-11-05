// Closing pass F-X, item 4 (review row 74, finding R74-14 (1); fix pass F-M5 wired it without a test):
// THE HOST WIRING of `failedStartAtRehydrateTransition`. In capture mode `simulated` no column holds
// `captureDurable`, so a failed start that is still open (FAULT from RECORDING by the capture, no
// start instant) must read `captureDurable: false` again after a process start - otherwise both
// clients present a recovery of evidence for a session that recorded nothing.
//
// A "restart" is what it is in production: the app is closed and a NEW app is booted on the same
// database. The transition itself is pinned by `capture-session-parity.test.ts`; here it is the
// rehydrate's capture block (`host.ts`) that is asked.
import { CAPTURE_CONNECT_MS } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { engineApp, storedSlices, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

async function armed(host: EngineApp): Promise<void> {
  const investigator = host.principal('INVESTIGATOR');
  await host.engine.setTabletLink('CONNECTED');
  await host.engine.command(investigator, 'createSession', { caseNumber: 'LP/2026/1001-0097', subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId: investigator.operatorId, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
  await host.engine.command(investigator, 'beginPrecheck');
  await host.drive(5_000);
  expect(host.engine.slice('session')?.state).toBe('ARMED');
}

describe('R74-14 (1): a failed start after a restart of a Core in capture mode simulated', () => {
  it('still reads captureDurable false, although no stored slice holds the member', async () => {
    const target = await db.another({ template: 'seed', slug: 'fx_r7414_failed' });
    const first = await engineApp(target, db.run.dataDir);
    await first.app.readiness.boot();
    await armed(first);
    const supervisor = first.principal('SUPERVISOR');
    // D60 (2026-11-04): a start fails only when EVERY camera of the session is lost, and the
    // selector names FOUR tracks now - the two-track pair of losses became a degraded recording.
    await first.engine.command(supervisor, 'inject', 'CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    await first.engine.command(supervisor, 'inject', 'CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    await first.engine.command(supervisor, 'inject', 'CAMERA_LOSS', { cameraId: 'VIDEO-03' });
    await first.engine.command(supervisor, 'inject', 'CAMERA_LOSS', { cameraId: 'VIDEO-04' });
    await first.engine.command(first.principal('INVESTIGATOR'), 'startRecording');
    await first.drive(CAPTURE_CONNECT_MS + 500);
    expect(first.engine.slice('session')).toMatchObject({ state: 'FAULT', captureDurable: false, startedAt: null, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' } });
    const stoppedAt = first.clock.now();
    await first.app.close();
    // The premise: the stored session does not hold the member, so what the new process says comes from the rehydrate.
    expect((await storedSlices(target.ownerPool())).session).not.toHaveProperty('captureDurable');

    const second = await engineApp(target, db.run.dataDir, { startAt: stoppedAt + 60_000 });
    await second.app.readiness.boot();
    expect(second.engine.slice('session')).toMatchObject({ state: 'FAULT', captureDurable: false, startedAt: null, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' } });
  });

  it('CONTROL: an interrupted RECORDING (it keeps its start instant) is not made a failed start by the restart', async () => {
    const target = await db.another({ template: 'seed', slug: 'fx_r7414_control' });
    const first = await engineApp(target, db.run.dataDir);
    await first.app.readiness.boot();
    await armed(first);
    await first.engine.command(first.principal('INVESTIGATOR'), 'startRecording');
    await first.drive(CAPTURE_CONNECT_MS + 20_000);
    expect(first.engine.slice('session')?.state).toBe('RECORDING');
    const stoppedAt = first.clock.now();
    await first.app.close();

    const second = await engineApp(target, db.run.dataDir, { startAt: stoppedAt + 60_000 });
    await second.app.readiness.boot();
    const session = second.engine.slice('session');
    expect(session).toMatchObject({ state: 'FAULT', fault: { fromState: 'RECORDING' } });
    expect(session?.startedAt).not.toBeNull();
    expect(session?.captureDurable).not.toBe(false);
  });
});
