// The sealing notice doors of the engine host on PostgreSQL (fix pass F-M7c; review R88-05 (c);
// ruling D186 (1) + (8)), as `dems_app`, with the stored rows read as `dems_owner`:
//
//   noteSealedPlaintextKept   ONE CRITICAL alert + ONE audit row naming the session; a second call
//                             while the alert is active writes nothing;
//   raiseSealBlocked          ONE CRITICAL alert for the open session, raised once;
//   resolveSealBlocked        that alert resolved;
//   noteSealRetryOnDemand     ONE audit row with who asked, the session and the cause.
import { passCaptureStart } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { sealDoorsOf } from '../seal-doors';
import { sealingNoticeDoorsOf } from '../sealing-notice-doors';
import { engineApp } from './support';

const db = useTestDatabase({ template: 'seed' });
const STEPS = ['CLOSE_TRACKS', 'FINALIZE_HASHES', 'FINALIZE_TRANSCRIPT', 'BUILD_MANIFEST', 'SIGN_MANIFEST', 'STORE_SEALED_PACKAGE'] as const;
const INPUT = { caseNumber: 'LP/2026/1010-0002', subjectType: 'SAKSI', subjectName: 'Notice Test', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

describe('the sealing notice doors', () => {
  it('a blocked seal is ONE alert raised once and resolved; a retry on demand is ONE audit row with the operator; kept plaintext is ONE alert + ONE audit row', async () => {
    const host = await engineApp(db, db.run.dataDir);
    await host.app.readiness.boot();
    const owner = db.ownerPool();
    const investigator = host.principal('INVESTIGATOR');
    const doors = sealingNoticeDoorsOf(host.engine);
    await host.engine.setTabletLink('CONNECTED');
    const created = (await host.engine.command(investigator, 'createSession', { ...INPUT, investigatorId: investigator.operatorId })).value;
    if (!created.ok) throw new Error('the session was not created');
    const sessionId = created.sessionId;
    await host.engine.command(investigator, 'beginPrecheck');
    await host.drive(5_000);
    if (host.engine.slice('session')?.state === 'PRECHECK') await host.engine.command(investigator, 'acknowledgePrecheckWarnings');
    await host.engine.command(investigator, 'startRecording');
    await passCaptureStart((ms) => host.drive(ms));
    await host.drive(2_000);
    await host.engine.command(investigator, 'stopRecording', 'Interview complete - test stop');
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: STEPS.map((id, index) => ({ id, status: index === 1 ? ('FAILED' as const) : index === 0 ? ('DONE' as const) : ('PENDING' as const), progress: index === 0 ? 100 : 0, etaMs: null, attempt: 1, detail: null })) });
    expect(host.engine.state().session?.state).toBe('FINALIZING');
    await host.app.pipeline.drain();
    const alertsOf = async (reason: string) => (await owner.query<{ kind: string; severity: string; target: string | null; active: boolean; message: string }>('SELECT kind, severity, target, active, message FROM public.alerts WHERE reason = $1 ORDER BY at', [reason])).rows;
    const auditOf = async () => (await owner.query<{ type: string; severity: string; actor_id: string | null; details: Record<string, unknown> }>('SELECT type, severity, actor_id, details FROM public.audit_log WHERE session_id = $1 ORDER BY seq', [sessionId])).rows;
    const auditBefore = (await auditOf()).length;

    // ── BLOCKED (D186 (1)) ─────────────────────────────────────────────────────────────────────
    const message = 'Sealing of this session is blocked. The session key could not be used. Restore the session key.';
    // CONTROL: another session ID is not the open session - nothing is written.
    expect((await doors.raiseSealBlocked({ sessionId: 'SES-20990101-0001', cause: 'FRAGMENT_NOT_OPENABLE', step: 'FINALIZE_HASHES', message })).value).toBe(false);
    expect((await doors.raiseSealBlocked({ sessionId, cause: 'FRAGMENT_NOT_OPENABLE', step: 'FINALIZE_HASHES', message })).value).toBe(true);
    // RAISED ONCE: a second exhaustion (the next start's retries) writes nothing.
    expect((await doors.raiseSealBlocked({ sessionId, cause: 'FRAGMENT_NOT_OPENABLE', step: 'FINALIZE_HASHES', message })).value).toBe(false);
    await host.app.pipeline.drain();
    expect(await alertsOf('SEAL_BLOCKED')).toEqual([{ kind: 'SYSTEM', severity: 'CRITICAL', target: sessionId, active: true, message }]);
    expect(host.engine.state().alerts.find((alert) => alert.params?.['reason'] === 'SEAL_BLOCKED')?.params).toMatchObject({ cause: 'FRAGMENT_NOT_OPENABLE', step: 'FINALIZE_HASHES', sessionId });
    // The session is still FINALIZING: the alert ends nothing.
    expect(host.engine.state().session).toMatchObject({ id: sessionId, state: 'FINALIZING' });
    expect(await auditOf()).toHaveLength(auditBefore);

    // ── RETRY ON DEMAND (D186 (8)) ─────────────────────────────────────────────────────────────
    expect((await doors.noteSealRetryOnDemand({ sessionId: 'SES-20990101-0001', actorId: investigator.operatorId, cause: 'FRAGMENT_NOT_OPENABLE', step: 'FINALIZE_HASHES' })).value).toBe(false);
    expect((await doors.noteSealRetryOnDemand({ sessionId, actorId: investigator.operatorId, cause: 'FRAGMENT_NOT_OPENABLE', step: 'FINALIZE_HASHES' })).value).toBe(true);
    await host.app.pipeline.drain();
    const afterRetry = await auditOf();
    expect(afterRetry).toHaveLength(auditBefore + 1);
    expect(afterRetry.at(-1)).toMatchObject({ type: 'RECOVERY_STARTED', actor_id: investigator.operatorId, details: { reason: 'SEAL_RETRY', cause: 'FRAGMENT_NOT_OPENABLE', step: 'FINALIZE_HASHES' } });

    // ── RESOLVED ───────────────────────────────────────────────────────────────────────────────
    expect((await doors.resolveSealBlocked({ sessionId })).value).toBe(true);
    expect((await doors.resolveSealBlocked({ sessionId })).value).toBe(false);
    await host.app.pipeline.drain();
    expect((await alertsOf('SEAL_BLOCKED')).map((alert) => alert.active)).toEqual([false]);

    // ── KEPT PLAINTEXT (R88-05 (c)) of a session that is NOT the open one ──────────────────────
    const old = 'SES-20261001-0007';
    const files = [{ trackId: 'VIDEO-02', name: 'VIDEO-02.mp4', reason: 'SEALED_FILE_NOT_PROVEN' }];
    expect((await doors.noteSealedPlaintextKept({ sessionId: old, files })).value).toBe(true);
    expect((await doors.noteSealedPlaintextKept({ sessionId: old, files })).value).toBe(false);
    await host.app.pipeline.drain();
    expect(await alertsOf('SEALED_PLAINTEXT_QUARANTINED')).toMatchObject([{ kind: 'SYSTEM', severity: 'CRITICAL', target: old, active: true }]);
    const kept = (await owner.query<{ type: string; severity: string; details: Record<string, unknown> }>('SELECT type, severity, details FROM public.audit_log WHERE session_id = $1 ORDER BY seq', [old])).rows;
    expect(kept).toEqual([{ type: 'FAULT_RAISED', severity: 'CRITICAL', details: { reason: 'SEALED_PLAINTEXT_QUARANTINED', files: 'VIDEO-02:SEALED_FILE_NOT_PROVEN', count: 1 } }]);
    // CONTROL: a file list that is not codes is refused; nothing is written.
    await expect(doors.noteSealedPlaintextKept({ sessionId: old, files: [{ trackId: '../x', name: 'x', reason: 'free text' }] })).rejects.toBeDefined();
  });
});
