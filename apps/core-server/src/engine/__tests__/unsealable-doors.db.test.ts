// The unsealable door of the engine host on PostgreSQL (fix pass F-M7b; review R88-02 (c)):
// `engine.endSessionUnsealable`, as `dems_app`, with the stored rows read as `dems_owner`.
// A session whose seal failed is ENDED: the session row is gone, the history says INCOMPLETE, ONE
// audit row and ONE alert say UNSEALABLE with the cause, and a new session can be created.
import { validateCoreApiResponse } from '@dems/shared/api';
import { passCaptureStart } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { readHistoryPage, readUnsealableCauses } from '../../modules/sessions/history';
import { sealDoorsOf } from '../seal-doors';
import { unsealableDoorsOf } from '../unsealable-doors';
import { engineApp } from './support';

const db = useTestDatabase({ template: 'seed' });
const STEPS = ['CLOSE_TRACKS', 'FINALIZE_HASHES', 'FINALIZE_TRANSCRIPT', 'BUILD_MANIFEST', 'SIGN_MANIFEST', 'STORE_SEALED_PACKAGE'] as const;
const INPUT = { caseNumber: 'LP/2026/1010-0001', subjectType: 'SAKSI', subjectName: 'Unsealable Test', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

describe('the unsealable door', () => {
  it('ends a session whose seal failed as INCOMPLETE / UNSEALABLE: one audit row, one CRITICAL alert, no open session, and the Core takes a new session', async () => {
    const host = await engineApp(db, db.run.dataDir);
    await host.app.readiness.boot();
    const owner = db.ownerPool();
    const investigator = host.principal('INVESTIGATOR');
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
    // The Core's pipeline reports a seal whose first step failed: the session is FINALIZING with a step in error.
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: STEPS.map((id, index) => ({ id, status: index === 0 ? ('FAILED' as const) : ('PENDING' as const), progress: 0, etaMs: null, attempt: 1, detail: null })) });
    expect(host.engine.state().session?.state).toBe('FINALIZING');
    await host.app.pipeline.drain();
    const auditBefore = (await owner.query('SELECT 1 FROM public.audit_log WHERE session_id = $1', [sessionId])).rows.length;
    const itemsBefore = (await owner.query('SELECT 1 FROM public.evidence_items')).rows.length;

    // CONTROL: another session ID is the mapped refusal; nothing is written.
    await expect(unsealableDoorsOf(host.engine).endSessionUnsealable({ sessionId: 'SES-20990101-0001', cause: 'NOTHING_SEALABLE' })).rejects.toMatchObject({ statusCode: 409 });
    expect(host.engine.state().session?.id).toBe(sessionId);

    expect((await unsealableDoorsOf(host.engine).endSessionUnsealable({ sessionId, cause: 'NOTHING_SEALABLE', quarantinedFiles: 2 })).value).toBe(true);
    await host.app.pipeline.drain();

    expect(host.engine.state().session).toBeNull();
    expect((await owner.query('SELECT 1 FROM public.active_session')).rows).toHaveLength(0);
    expect((await owner.query<{ outcome: string }>('SELECT outcome FROM public.session_history WHERE id = $1', [sessionId])).rows).toEqual([{ outcome: 'INCOMPLETE' }]);
    expect(host.engine.state().sessionHistory[0]).toMatchObject({ id: sessionId, outcome: 'INCOMPLETE', evidenceId: null });
    const audit = (await owner.query<{ type: string; severity: string; details: Record<string, unknown> }>('SELECT type, severity, details FROM public.audit_log WHERE session_id = $1 ORDER BY seq', [sessionId])).rows;
    expect(audit).toHaveLength(auditBefore + 1);
    expect(audit[audit.length - 1]).toMatchObject({ type: 'SESSION_INCOMPLETE', severity: 'CRITICAL', details: { reason: 'UNSEALABLE', cause: 'NOTHING_SEALABLE', quarantinedFiles: 2 } });
    const alerts = (await owner.query<{ kind: string; severity: string; reason: string | null; target: string | null; active: boolean }>("SELECT kind, severity, reason, target, active FROM public.alerts WHERE reason = 'UNSEALABLE'")).rows;
    expect(alerts).toEqual([{ kind: 'SYSTEM', severity: 'CRITICAL', reason: 'UNSEALABLE', target: sessionId, active: true }]);
    expect((await owner.query('SELECT 1 FROM public.evidence_items')).rows).toHaveLength(itemsBefore);

    // Fix wave J round two (JW-22, remainder): operation 38's entry of THIS session states the stored cause -
    // read from the audit row above as `dems_app`, no column - and the entry validates against the contract.
    const auditAfterEnd = (await owner.query('SELECT 1 FROM public.audit_log')).rows.length;
    const page = await host.app.db.read('test.listSessionHistory', (pool) => readHistoryPage(pool, null, 50));
    const entry = page.items.find((item) => item.id === sessionId);
    expect(entry).toMatchObject({ outcome: 'INCOMPLETE', evidenceId: null, unsealableCause: 'NOTHING_SEALABLE' });
    expect(validateCoreApiResponse('listSessionHistory', 200, JSON.parse(JSON.stringify(page)))).toEqual({ ok: true });
    // CONTROLS: no other entry of the page has the member (a sealed session, an interrupted one with an item), ...
    expect(page.items.filter((item) => item.id !== sessionId && 'unsealableCause' in item)).toEqual([]);
    expect(page.items.length).toBeGreaterThan(1);
    // ... a session the trail holds no such row for gets none, a row that names no code is not answered, and the read wrote nothing.
    expect([...(await host.app.db.read('test.readUnsealableCauses', (pool) => readUnsealableCauses(pool, [sessionId, 'SES-20990101-0001'])))]).toEqual([[sessionId, 'NOTHING_SEALABLE']]);
    expect((await host.app.db.read('test.readUnsealableCauses', (pool) => readUnsealableCauses(pool, []))).size).toBe(0);
    expect((await owner.query('SELECT 1 FROM public.audit_log')).rows).toHaveLength(auditAfterEnd);

    // A second call finds no session: the mapped refusal, nothing more is written.
    await expect(unsealableDoorsOf(host.engine).endSessionUnsealable({ sessionId, cause: 'NOTHING_SEALABLE' })).rejects.toMatchObject({ statusCode: 409 });

    // THE CORE IS FREE: a new session is created.
    const again = (await host.engine.command(investigator, 'createSession', { ...INPUT, investigatorId: investigator.operatorId, caseNumber: 'LP/2026/1010-0002' })).value;
    expect(again.ok).toBe(true);
  });
});
