// Wave H, driver C1 - the export jobs after gate 94 (findings G94-05, G94-11, G94-12; ruling D200):
// a stop of the Core ends a running export at once; a finished export is listed from the package
// folder and reachable by its job ID in a NEW run of the jobs (a restart); the job answer states
// the archive's hash. Real packages from the verify-v2 builder, a host of doubles (the form of
// `jobs.test.ts`).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { EvidenceExportJobSchema, EvidenceFinishedExportSchema } from '@dems/shared/api';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackage, removeScratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { archiveFactsOf, archiveFileOf, listFinishedExports } from '../finished';
import { createEvidenceExportRuntime, type EvidenceExportHost, type ExportRequestRecord } from '../jobs';
import type { ExportPorts } from '../package-export';
import { EXPORTED_AT, portsOf } from './support';

afterEach(removeScratch);

interface Bed {
  readonly host: EvidenceExportHost;
  readonly failures: Parameters<EvidenceExportHost['recordFailure']>[0][];
  readonly errors: Parameters<EvidenceExportHost['reportError']>[0][];
  readonly completions: Parameters<EvidenceExportHost['completeExport']>[0][];
  readonly requests: Map<string, ExportRequestRecord>;
  readonly pending: (() => void)[];
  failRecording: boolean;
  now: number;
}

function bed(built: BuiltPackage, ports: Partial<ExportPorts> = {}): Bed {
  const self: Bed = {
    failures: [],
    errors: [],
    completions: [],
    requests: new Map(),
    pending: [],
    failRecording: false,
    now: EXPORTED_AT,
    host: {
      now: () => self.now,
      findItem: (evidenceId) => (evidenceId === built.item.evidenceId ? built.item : null),
      packageDirOf: () => built.dir,
      requestOf: (exportId) => self.requests.get(exportId) ?? null,
      ports: () => portsOf(built, ports),
      recordFailure: async (failure) => {
        if (self.failRecording) throw new Error('the trail takes no row any more');
        self.failures.push(failure);
      },
      reportError: (entry) => void self.errors.push(entry),
      completeExport: async (completion) => void self.completions.push(completion),
      failureOf: () => null,
      defer: (work) => void self.pending.push(work),
    },
  };
  return self;
}

const requestRow = (built: BuiltPackage, exportId: string, operatorId = 'OPR-002'): ExportRequestRecord => ({ exportId, evidenceId: built.item.evidenceId, auditId: 'AUD-000101', at: EXPORTED_AT - 1_000, operatorId, destination: 'Case file transfer', reason: 'Prosecutor request', kind: 'PACKAGE' });

async function queue(test: Bed, runtime: ReturnType<typeof createEvidenceExportRuntime>, built: BuiltPackage, exportId: string, operatorId?: string): Promise<void> {
  test.requests.set(exportId, requestRow(built, exportId, operatorId));
  expect(await runtime.begin(built.item.evidenceId)?.accepted({ exportId, kind: 'PACKAGE', deferred: true })).toBe('QUEUED');
}
const start = (test: Bed): void => {
  const work = test.pending.shift();
  if (work === undefined) throw new Error('no job is waiting');
  work();
};

describe('G94-12: the stop of the Core stops an export job', () => {
  it('a job that is RUNNING when the Core stops ends FAILED EXPORT_INTERRUPTED with its row, and its partial is removed at once - nothing waits for the next start', async () => {
    const built = await buildPackage();
    let reached: () => void = () => undefined;
    const atArchive = new Promise<void>((resolve) => (reached = resolve));
    let release: () => void = () => undefined;
    // The job is held INSIDE its run, after the archive was written and before it is named: decrypted bytes lie in a `.partial`.
    const test = bed(built, {
      probe: async (step) => {
        if (step !== 'ARCHIVE_WRITTEN') return;
        reached();
        await new Promise<void>((resolve) => (release = resolve));
      },
    });
    const runtime = createEvidenceExportRuntime(test.host);
    await queue(test, runtime, built, 'EXP-000032');
    start(test);
    await atArchive;
    expect(readdirSync(built.path('export'))).toEqual(['EXP-000032.zip.partial']); // control: the partial is there while the job runs
    expect((await runtime.job('EXPJ-000032'))?.status).toBe('RUNNING');

    const stopped = runtime.stop();
    release();
    await stopped;

    const job = await runtime.job('EXPJ-000032');
    expect(EvidenceExportJobSchema.safeParse(job).success).toBe(true);
    expect(job).toMatchObject({ status: 'FAILED', failureReason: 'EXPORT_INTERRUPTED' });
    expect(test.failures).toEqual([{ jobId: 'EXPJ-000032', evidenceId: built.item.evidenceId, kind: 'PACKAGE', reason: 'EXPORT_INTERRUPTED', operatorId: 'OPR-002' }]);
    // Removed AT ONCE: the folder this run made is gone with its partial; the item was never marked exported.
    expect(existsSync(built.path('export'))).toBe(false);
    expect(test.completions).toEqual([]);
  });

  it('a job still QUEUED at the stop never runs: FAILED EXPORT_INTERRUPTED, nothing written; and when the trail takes no row any more the failure is in the persistent error log', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    await queue(test, runtime, built, 'EXP-000032');
    test.failRecording = true;
    const stopped = runtime.stop();
    start(test);
    await stopped;
    expect(await runtime.job('EXPJ-000032')).toMatchObject({ status: 'FAILED', failureReason: 'EXPORT_INTERRUPTED', progressPct: 0 });
    expect(existsSync(built.path('export'))).toBe(false);
    expect(test.failures).toEqual([]);
    expect(test.errors.map((entry) => entry.code)).toEqual(['EXPORT_FAILURE_NOT_AUDITED']);
  });

  it('CONTROL: without a stop the same held job completes', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    await queue(test, runtime, built, 'EXP-000032');
    start(test);
    await runtime.idle();
    expect((await runtime.job('EXPJ-000032'))?.status).toBe('COMPLETE');
  });
});

describe('G94-05 / G94-11: the finished exports of an item are listed and stay reachable', () => {
  it('two finished exports are listed newest first with who made them and the archive length; a partial, a stray file and an export of another item are not; the job answer states the archive hash - also in a NEW run of the jobs', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    await queue(test, runtime, built, 'EXP-000032', 'OPR-002');
    start(test);
    await runtime.idle();
    test.now = EXPORTED_AT + 60_000;
    await queue(test, runtime, built, 'EXP-000033', 'OPR-001');
    start(test);
    await runtime.idle();
    writeFileSync(built.path('export/EXP-000900.zip.partial'), 'a stopped export');
    writeFileSync(built.path('export/notes.txt'), 'a stray file');

    const sha256 = (exportId: string): string => createHash('sha256').update(readFileSync(archiveFileOf(built.dir, exportId))).digest('hex');
    const bytes = (exportId: string): number => readFileSync(archiveFileOf(built.dir, exportId)).byteLength;
    const listed = await listFinishedExports(built.dir, built.item.evidenceId);
    for (const entry of listed) expect(EvidenceFinishedExportSchema.safeParse(entry).success).toBe(true);
    expect(listed).toEqual([
      { exportId: 'EXP-000033', jobId: 'EXPJ-000033', kind: 'PACKAGE', completedAt: EXPORTED_AT + 60_000, exportedBy: 'OPR-001', archiveBytes: bytes('EXP-000033'), archiveSha256: sha256('EXP-000033') },
      { exportId: 'EXP-000032', jobId: 'EXPJ-000032', kind: 'PACKAGE', completedAt: EXPORTED_AT, exportedBy: 'OPR-002', archiveBytes: bytes('EXP-000032'), archiveSha256: sha256('EXP-000032') },
    ]);
    // Held to the item: the same folder read for ANOTHER evidence ID lists nothing.
    expect(await listFinishedExports(built.dir, 'EV-20261010-0999')).toEqual([]);
    // No retention rule exists (spec section G is silent): both archives are still there, none was removed by the second export.
    expect(readdirSync(built.path('export')).filter((name) => name.endsWith('.zip'))).toEqual(['EXP-000032.zip', 'EXP-000033.zip']);

    // The job answer states the hash of the archive FILE (ruling D200) ...
    const answered = await runtime.job('EXPJ-000032');
    expect(EvidenceExportJobSchema.safeParse(answered).success).toBe(true);
    expect(answered?.archive).toEqual({ bytes: bytes('EXP-000032'), sha256: sha256('EXP-000032') });
    // ... and so does a NEW run of the jobs (a restart: nothing in memory), for ANY finished export of the item.
    const restarted = createEvidenceExportRuntime(bed(built).host);
    expect(await restarted.job('EXPJ-000032')).toBeNull(); // control: without its stored request an ID is no job
    const after = bed(built);
    after.requests.set('EXP-000032', requestRow(built, 'EXP-000032'));
    after.requests.set('EXP-000033', requestRow(built, 'EXP-000033', 'OPR-001'));
    const again = createEvidenceExportRuntime(after.host);
    for (const exportId of ['EXP-000032', 'EXP-000033']) {
      const job = await again.job(`EXPJ-${exportId.slice(4)}`);
      expect(job).toMatchObject({ status: 'COMPLETE', archive: { bytes: bytes(exportId), sha256: sha256(exportId) } });
    }
  });

  it('the remembered hash follows the file: an archive that changed on disk is hashed again, never answered with the old value', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    await queue(test, runtime, built, 'EXP-000032');
    start(test);
    await runtime.idle();
    const file = archiveFileOf(built.dir, 'EXP-000032');
    const first = await archiveFactsOf(file, { hash: true });
    writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('x')]));
    const second = await archiveFactsOf(file, { hash: true });
    expect(second?.bytes).toBe((first?.bytes ?? 0) + 1);
    expect(second?.sha256).toBe(createHash('sha256').update(readFileSync(file)).digest('hex'));
    expect(second?.sha256).not.toBe(first?.sha256);
    expect(await archiveFactsOf(`${file}.missing`, { hash: true })).toBeNull();
  });
});
