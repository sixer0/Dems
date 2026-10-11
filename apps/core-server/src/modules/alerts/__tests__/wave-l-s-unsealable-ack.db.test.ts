// Fix wave L, driver L-S - re-check 75 finding G75d-01, ruling D228 (2), on PostgreSQL and the REAL
// engine host (as `dems_app`; what is stored is read as `dems_owner`).
//
// The alert of a session that ended UNSEALABLE is an open notice: it stays ACTIVE - through an
// acknowledgement of a role that may not close it, through the next session and through a restart
// of the Core - until a SUPERVISOR acknowledges it. That acknowledgement resolves it and writes ONE
// audit row that names the session of the NOTICE.
//
// | Step | What is held |
// |------|--------------|
// | 1 | CONTROL (the finding): the investigator's acknowledgement stores `acknowledged`, the alert stays active, no row |
// | 2 | a NEW session is created and cancelled, the process is closed and a second one boots: still active, still no row |
// | 3 | the supervisor acknowledges in the second process: resolved in the state and in the table, ONE `FAULT_CLEARED` row of the unsealable session with the supervisor as actor, the chain holds |
// | 4 | a third process: the alert comes back resolved; nothing more is written |
import { passCaptureStart, openUnsealableNoticesOf, type SimState } from '@dems/shared/sim';
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { engineApp } from '../../../../test/support/engine';
import { sealDoorsOf } from '../../../engine/seal-doors';
import { unsealableDoorsOf } from '../../../engine/unsealable-doors';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed' });
const STEPS = ['CLOSE_TRACKS', 'FINALIZE_HASHES', 'FINALIZE_TRANSCRIPT', 'BUILD_MANIFEST', 'SIGN_MANIFEST', 'STORE_SEALED_PACKAGE'] as const;
const INPUT = { caseNumber: 'LP/2026/1011-0041', subjectType: 'SAKSI', subjectName: 'Unsealable Notice Test', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;
const CAUSE = 'SESSION_KEY_NOT_OF_SESSION';

interface StoredAlert {
  id: string;
  active: boolean;
  acknowledged: boolean;
  resolved_at: string | null;
  target: string | null;
}

describe('G75d-01: the open notice of an unsealable session, on the real engine', () => {
  it('stays active through another role\'s acknowledgement, a later session and a restart; a supervisor\'s acknowledgement resolves it with ONE audit row of its own session', async () => {
    const owner = db.ownerPool();
    const stored = async (): Promise<StoredAlert[]> => (await owner.query<StoredAlert>("SELECT id, active, acknowledged, resolved_at, target FROM public.alerts WHERE reason = 'UNSEALABLE' ORDER BY id")).rows;
    const cleared = async (): Promise<Array<{ type: string; session_id: string | null; actor_id: string | null; device_id: string | null; details: Record<string, unknown> }>> =>
      (await owner.query<{ type: string; session_id: string | null; actor_id: string | null; device_id: string | null; details: Record<string, unknown> }>("SELECT type, session_id, actor_id, device_id, details FROM public.audit_log WHERE type = 'FAULT_CLEARED' AND details->>'reason' = 'UNSEALABLE' ORDER BY seq")).rows;

    // ── Process 1: a session ends UNSEALABLE ──
    const first = await engineApp(db, db.run.dataDir);
    await first.app.readiness.boot();
    const investigator = first.principal('INVESTIGATOR');
    await first.engine.setTabletLink('CONNECTED');
    const created = (await first.engine.command(investigator, 'createSession', { ...INPUT, investigatorId: investigator.operatorId })).value;
    if (!created.ok) throw new Error('the session was not created');
    const sessionId = created.sessionId;
    await first.engine.command(investigator, 'beginPrecheck');
    await first.drive(5_000);
    if (first.engine.slice('session')?.state === 'PRECHECK') await first.engine.command(investigator, 'acknowledgePrecheckWarnings');
    await first.engine.command(investigator, 'startRecording');
    await passCaptureStart((ms) => first.drive(ms));
    await first.drive(2_000);
    await first.engine.command(investigator, 'stopRecording', 'Interview complete - test stop');
    await sealDoorsOf(first.engine).applySealingProgress({ sessionId, steps: STEPS.map((id, index) => ({ id, status: index === 0 ? ('FAILED' as const) : ('PENDING' as const), progress: 0, etaMs: null, attempt: 3, detail: null })) });
    await unsealableDoorsOf(first.engine).endSessionUnsealable({ sessionId, cause: CAUSE, quarantinedFiles: 5 });
    await first.app.pipeline.drain();
    const notice = openUnsealableNoticesOf(first.engine.state() as SimState)[0];
    if (notice === undefined) throw new Error('the unsealable end left no open notice');
    expect(notice).toMatchObject({ sessionId, cause: CAUSE, acknowledged: false });
    const alertId = notice.alertId;

    // 1. CONTROL (the finding): the investigator acknowledges - stored, and the alert is still active. No row.
    await first.engine.command(investigator, 'acknowledgeAlert', alertId);
    await first.app.pipeline.drain();
    expect(await stored()).toEqual([{ id: alertId, active: true, acknowledged: true, resolved_at: null, target: sessionId }]);
    expect(await cleared()).toEqual([]);

    // 2. The Core is free: a new session is created (and cancelled). The notice is not its state, and it does not end the notice.
    const again = (await first.engine.command(investigator, 'createSession', { ...INPUT, investigatorId: investigator.operatorId, caseNumber: 'LP/2026/1011-0042' })).value;
    if (!again.ok) throw new Error('a new session could not be created while the notice is open');
    expect(openUnsealableNoticesOf(first.engine.state() as SimState).map((open) => open.sessionId)).toEqual([sessionId]);
    expect(again.sessionId).not.toBe(sessionId);
    await first.engine.command(investigator, 'cancel');
    await first.app.pipeline.drain();
    const closedAt = first.clock.now();
    await first.app.close();

    // A restart keeps it active until acknowledged.
    const second = await engineApp(db, db.run.dataDir, { startAt: closedAt + 60_000 });
    await second.app.readiness.boot();
    expect(openUnsealableNoticesOf(second.engine.state() as SimState)).toEqual([expect.objectContaining({ alertId, sessionId, acknowledged: true })]);
    expect(await cleared()).toEqual([]);

    // 3. The supervisor acknowledges: resolved, with its row.
    const supervisor = second.principal('SUPERVISOR');
    const rowsBefore = (await readTrail(owner)).length;
    await second.engine.command(supervisor, 'acknowledgeAlert', alertId);
    await second.app.pipeline.drain();
    expect(openUnsealableNoticesOf(second.engine.state() as SimState)).toEqual([]);
    expect(second.engine.slice('alerts').find((alert) => alert.id === alertId)).toMatchObject({ active: false, acknowledged: true, resolvedAt: expect.any(Number) });
    const after = await stored();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: alertId, active: false, acknowledged: true, target: sessionId });
    expect(after[0]?.resolved_at).not.toBeNull();
    expect(await cleared()).toEqual([{ type: 'FAULT_CLEARED', session_id: sessionId, actor_id: supervisor.operatorId, device_id: null, details: { reason: 'UNSEALABLE', cause: CAUSE, alertId, operationId: 'acknowledgeAlert' } }]);
    const trail = await readTrail(owner);
    expect(trail).toHaveLength(rowsBefore + 1);
    expect(verifyTrail(trail, await readHead(owner)).ok).toBe(true);
    // Once: acknowledging again changes nothing.
    await second.engine.command(supervisor, 'acknowledgeAlert', alertId);
    await second.app.pipeline.drain();
    expect(await readTrail(owner)).toHaveLength(rowsBefore + 1);
    const closedAgainAt = second.clock.now();
    await second.app.close();

    // 4. Resolved for good: the next process reads it resolved and writes nothing about it.
    const third = await engineApp(db, db.run.dataDir, { startAt: closedAgainAt + 60_000 });
    await third.app.readiness.boot();
    expect(openUnsealableNoticesOf(third.engine.state() as SimState)).toEqual([]);
    expect(third.engine.slice('alerts').find((alert) => alert.id === alertId)).toMatchObject({ active: false, acknowledged: true });
    expect(await cleared()).toHaveLength(1);
    await third.app.close();
  });
});
