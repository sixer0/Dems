// The export doors of the engine host on PostgreSQL (fix pass F-M8; review findings R93-03, R93-05):
// `engine.completeEvidenceExport` and `engine.noteEvidenceExportDownload`, as `dems_app`, with the
// stored rows read as `dems_owner`.
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { exportDoorsOf } from '../export-doors';
import { engineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

describe('the export doors', () => {
  it('a DEFERRED request stores no status and no custody entry; the completion stores EXPORTED and one entry; a download stores its row and never a second export record', async () => {
    const host = await engineApp(db, db.run.dataDir);
    await host.app.readiness.boot();
    const owner = db.ownerPool();
    const supervisor = host.principal('SUPERVISOR');
    const evidenceId = host.engine.slice('evidence').find((item) => item.status === 'SEALED')?.id ?? '';
    expect(evidenceId).not.toBe('');
    const stored = async (): Promise<{ status: string; custody: string[]; exports: number }> => ({
      status: (await owner.query<{ status: string }>('SELECT status FROM public.evidence_items WHERE id = $1', [evidenceId])).rows[0]?.status ?? '',
      custody: (await owner.query<{ action: string }>('SELECT action FROM public.evidence_custody WHERE evidence_id = $1 ORDER BY seq', [evidenceId])).rows.map((row) => row.action),
      exports: (await owner.query('SELECT 1 FROM public.exports WHERE evidence_id = $1', [evidenceId])).rows.length,
    });
    const before = await stored();

    const request = { reason: 'Prosecutor request', destination: 'Case file transfer', completion: 'DEFERRED' as const };
    const accepted = (await host.engine.command(supervisor, 'exportEvidence', evidenceId, request)).value;
    if (!accepted.ok) throw new Error('the export request was refused');
    await host.app.pipeline.drain();
    // The request: its export record, and NOTHING of the item.
    expect(await stored()).toEqual({ ...before, exports: before.exports + 1 });

    expect((await exportDoorsOf(host.engine).completeEvidenceExport({ evidenceId, exportId: accepted.exportId, operatorId: supervisor.operatorId, destination: 'Case file transfer' })).value).toBe(true);
    await host.app.pipeline.drain();
    expect(await stored()).toEqual({ status: 'EXPORTED', custody: [...before.custody, 'EXPORTED'], exports: before.exports + 1 });

    expect((await exportDoorsOf(host.engine).noteEvidenceExportDownload({ evidenceId, jobId: `EXPJ-${accepted.exportId.slice(4)}`, operatorId: supervisor.operatorId, deviceId: null, bytes: 4_096 })).value).toBe(true);
    await host.app.pipeline.drain();
    expect(await stored()).toEqual({ status: 'EXPORTED', custody: [...before.custody, 'EXPORTED', 'EXPORT_DOWNLOADED'], exports: before.exports + 1 });
    const row = (await owner.query<{ type: string; details: Record<string, unknown>; actor_id: string }>('SELECT type, details, actor_id FROM public.audit_log WHERE evidence_id = $1 ORDER BY seq DESC LIMIT 1', [evidenceId])).rows[0];
    expect(row).toMatchObject({ type: 'EVIDENCE_EXPORTED', actor_id: supervisor.operatorId, details: { reason: 'EXPORT_DOWNLOADED', bytes: 4_096 } });
    expect(row?.details).not.toHaveProperty('exportId');

    // An unknown item is the mapped refusal of a hosted action: nothing is written.
    await expect(exportDoorsOf(host.engine).completeEvidenceExport({ evidenceId: 'EV-20990101-0001', exportId: 'EXP-000999', operatorId: null, destination: '' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
