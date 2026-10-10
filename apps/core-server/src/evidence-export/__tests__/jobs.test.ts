// The export jobs (blueprint row 91): operation 42's background side and what operation 87 polls.
// Real packages from the verify-v2 builder, a host of doubles; the job's answers are held to the
// contract schema of operation 87, and the failure row to the detail keys of C3 §5.2 (M8-XAU-1).
import { EXPORT_JOB_ID_PATTERN, EvidenceExportJobSchema } from '@dems/shared/api';
import { AuditType } from '@dems/shared/sim';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackage, removeScratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { coreExportDirectory, exportFailedEntry } from '../host';
import { createEvidenceExportRuntime, exportIdOfJob, exportJobIdOf, type EvidenceExportHost, type ExportRequestRecord } from '../jobs';
import type { ExportPorts } from '../package-export';
import { EXPORTED_AT, portsOf, standInEncoder } from './support';

afterEach(removeScratch);

interface Bed {
  readonly host: EvidenceExportHost;
  readonly failures: Parameters<EvidenceExportHost['recordFailure']>[0][];
  readonly errors: Parameters<EvidenceExportHost['reportError']>[0][];
  readonly requests: Map<string, ExportRequestRecord>;
  /** The deferred starts of jobs: the test runs them when it wants. */
  readonly pending: (() => void)[];
  failRecording: boolean;
}

function bed(built: BuiltPackage, ports: Partial<ExportPorts> = {}): Bed {
  const failures: Bed['failures'] = [];
  const errors: Bed['errors'] = [];
  const requests = new Map<string, ExportRequestRecord>();
  const pending: (() => void)[] = [];
  const self: Bed = {
    failures,
    errors,
    requests,
    pending,
    failRecording: false,
    host: {
      now: () => EXPORTED_AT,
      findItem: (evidenceId) => (evidenceId === built.item.evidenceId ? built.item : null),
      packageDirOf: () => built.dir,
      requestOf: (exportId) => requests.get(exportId) ?? null,
      ports: () => portsOf(built, ports),
      recordFailure: async (failure) => {
        if (self.failRecording) throw new Error('the database is away');
        failures.push(failure);
      },
      reportError: (entry) => void errors.push(entry),
      defer: (work) => void pending.push(work),
    },
  };
  return self;
}

const requestRow = (built: BuiltPackage, exportId: string, kind: ExportRequestRecord['kind'] = null): ExportRequestRecord => ({
  exportId,
  evidenceId: built.item.evidenceId,
  auditId: 'AUD-000101',
  at: EXPORTED_AT - 1_000,
  operatorId: 'OPR-002',
  destination: 'Case file transfer',
  reason: 'Prosecutor request',
  kind,
});

const start = (test: Bed): void => {
  const work = test.pending.shift();
  if (work === undefined) throw new Error('no job is waiting');
  work();
};

describe('the IDs', () => {
  it('a job has the digits of its export, both ways; a job ID no export can have maps to none', () => {
    expect(exportJobIdOf('EXP-000032')).toBe('EXPJ-000032');
    expect(exportIdOfJob('EXPJ-000032')).toBe('EXP-000032');
    expect(exportIdOfJob('EXPJ-0000000032')).toBe('EXP-000032');
    expect(exportIdOfJob('EXPJ-1000032')).toBeNull();
    expect(exportIdOfJob('EXP-000032')).toBeNull();
    expect(() => exportJobIdOf('EXPJ-000032')).toThrow();
  });
});

describe('operation 42 -> a job -> operation 87', () => {
  it('QUEUED, then COMPLETE with the export manifest hash and signature; every answer fits the contract schema; the item takes no second request meanwhile', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    const id = built.item.evidenceId;

    const ticket = runtime.begin(id);
    expect(ticket).not.toBeNull();
    // Between the ticket and the hand-over the item is taken: EXPORT_IN_PROGRESS for a second request.
    expect(runtime.begin(id)).toBeNull();
    test.requests.set('EXP-000032', requestRow(built, 'EXP-000032'));
    expect(await ticket?.accepted({ exportId: 'EXP-000032', kind: 'PACKAGE' })).toBe('QUEUED');

    const queued = await runtime.job('EXPJ-000032');
    expect(EvidenceExportJobSchema.safeParse(queued).success).toBe(true);
    expect(queued).toEqual({ jobId: 'EXPJ-000032', evidenceId: id, kind: 'PACKAGE', status: 'QUEUED', progressPct: 0, etaMs: null, derived: false, createdAt: EXPORTED_AT - 1_000, completedAt: null });
    expect(runtime.inProgress(id)).toBe(true);
    expect(runtime.begin(id)).toBeNull();
    expect(existsSync(built.path('export'))).toBe(false);

    start(test);
    await runtime.idle();
    const done = await runtime.job('EXPJ-000032');
    expect(EvidenceExportJobSchema.safeParse(done).success).toBe(true);
    expect(done).toMatchObject({ status: 'COMPLETE', progressPct: 100, etaMs: 0, derived: false, completedAt: EXPORTED_AT });
    expect(done?.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(done?.signature).toMatch(/^[0-9a-f]{128}$/);
    expect(existsSync(built.path('export/EXP-000032.zip'))).toBe(true);
    expect(test.failures).toEqual([]);
    expect(test.errors).toEqual([]);
    // The item is free again.
    expect(runtime.inProgress(id)).toBe(false);
    runtime.begin(id)?.cancel();
    expect(runtime.inProgress(id)).toBe(false);
  });

  it('an item that is no real package gets no job and is not held; a refused request frees the item', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    const other = 'EV-20260930-0004';
    expect(await runtime.begin(other)?.accepted({ exportId: 'EXP-000040', kind: 'PACKAGE' })).toBe('NOT_A_REAL_PACKAGE');
    expect(runtime.inProgress(other)).toBe(false);
    expect(await runtime.job('EXPJ-000040')).toBeNull();
    expect(test.pending).toEqual([]);

    const ticket = runtime.begin(built.item.evidenceId);
    ticket?.cancel();
    expect(runtime.inProgress(built.item.evidenceId)).toBe(false);
    // A cancelled ticket queues nothing afterwards.
    expect(await ticket?.accepted({ exportId: 'EXP-000041', kind: 'PACKAGE' })).toBe('NOT_A_REAL_PACKAGE');
    expect(test.pending).toEqual([]);
  });

  it('M8-XAU-1 (failure row): a failed job is FAILED with its code, audited with exactly the three detail keys, and leaves no artefact', async () => {
    const built = await buildPackage();
    // The licence gate as the product has it: no encoder.
    const test = bed(built, { composite: null });
    const runtime = createEvidenceExportRuntime(test.host);
    test.requests.set('EXP-000033', requestRow(built, 'EXP-000033'));
    await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000033', kind: 'COMPOSITE' });
    start(test);
    await runtime.idle();

    const failed = await runtime.job('EXPJ-000033');
    expect(EvidenceExportJobSchema.safeParse(failed).success).toBe(true);
    expect(failed).toMatchObject({ kind: 'COMPOSITE', status: 'FAILED', derived: true, failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED', etaMs: 0 });
    expect(failed).not.toHaveProperty('manifestHash');
    expect(test.failures).toEqual([{ jobId: 'EXPJ-000033', evidenceId: built.item.evidenceId, kind: 'COMPOSITE', reason: 'COMPOSITE_ENCODER_NOT_SELECTED', operatorId: 'OPR-002' }]);
    expect(existsSync(built.path('export'))).toBe(false);

    const entry = exportFailedEntry(test.failures[0]!);
    expect(entry.type).toBe(AuditType.EVIDENCE_EXPORT_FAILED);
    expect(Object.keys(entry.details).sort()).toEqual(['jobId', 'kind', 'reason']);
    expect(String(entry.details['jobId'])).toMatch(EXPORT_JOB_ID_PATTERN);
    expect(String(entry.details['reason'])).toMatch(/^[A-Z][A-Z0-9_]*$/);
    expect(entry).toMatchObject({ actorId: 'OPR-002', evidenceId: built.item.evidenceId, deviceId: null });
    // Nothing of the request's text is in the row.
    expect(JSON.stringify(entry)).not.toMatch(/Prosecutor|Case file/);

    // The item is free: the request can be made again, and with an encoder it completes as COMPOSITE.
    const again = bed(built, { composite: standInEncoder() });
    const second = createEvidenceExportRuntime(again.host);
    again.requests.set('EXP-000034', requestRow(built, 'EXP-000034'));
    await second.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000034', kind: 'COMPOSITE' });
    start(again);
    await second.idle();
    expect(await second.job('EXPJ-000034')).toMatchObject({ kind: 'COMPOSITE', status: 'COMPLETE', derived: true });
  });

  it('a failure whose audit row cannot be written goes to the persistent error log, with IDs and a code only; a job without its request row fails', async () => {
    const built = await buildPackage();
    const test = bed(built, { signer: null });
    test.failRecording = true;
    const runtime = createEvidenceExportRuntime(test.host);
    test.requests.set('EXP-000035', requestRow(built, 'EXP-000035'));
    await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000035', kind: 'PACKAGE' });
    start(test);
    await runtime.idle();
    expect(await runtime.job('EXPJ-000035')).toMatchObject({ status: 'FAILED', failureReason: 'SIGNER_UNAVAILABLE' });
    expect(test.errors).toEqual([
      { source: 'evidence-export.jobs.recordFailure', code: 'EXPORT_FAILURE_NOT_AUDITED', message: 'the audit row of a failed export job could not be written', context: { jobId: 'EXPJ-000035', evidenceId: built.item.evidenceId, reason: 'SIGNER_UNAVAILABLE' } },
    ]);

    test.failRecording = false;
    await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000036', kind: 'PACKAGE' });
    start(test);
    await runtime.idle();
    expect(await runtime.job('EXPJ-000036')).toMatchObject({ status: 'FAILED', failureReason: 'EXPORT_REQUEST_NOT_FOUND' });
    expect(test.failures.at(-1)).toMatchObject({ jobId: 'EXPJ-000036', reason: 'EXPORT_REQUEST_NOT_FOUND', operatorId: null });
  });

  it('jobs run one after the other, in the order they were accepted', async () => {
    const first = await buildPackage({ sessionId: 'SES-20261009-0002', evidenceId: 'EV-20261009-0002' });
    const test = bed(first);
    const runtime = createEvidenceExportRuntime(test.host);
    test.requests.set('EXP-000050', requestRow(first, 'EXP-000050'));
    test.requests.set('EXP-000051', requestRow(first, 'EXP-000051'));
    await runtime.begin(first.item.evidenceId)?.accepted({ exportId: 'EXP-000050', kind: 'PACKAGE' });
    expect(test.pending).toHaveLength(1);
    start(test);
    await runtime.idle();
    await runtime.begin(first.item.evidenceId)?.accepted({ exportId: 'EXP-000051', kind: 'PACKAGE' });
    start(test);
    await runtime.idle();
    expect((await runtime.job('EXPJ-000050'))?.status).toBe('COMPLETE');
    expect((await runtime.job('EXPJ-000051'))?.status).toBe('COMPLETE');
  });
});

describe('after a restart: what is durable about a job', () => {
  it('a finished export is COMPLETE from the package folder; an unfinished one is FAILED EXPORT_INTERRUPTED; an unknown ID is none', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    test.requests.set('EXP-000032', requestRow(built, 'EXP-000032'));
    await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000032', kind: 'PACKAGE' });
    start(test);
    await runtime.idle();
    const live = await runtime.job('EXPJ-000032');

    // A new process: the same folder and trail, an empty memory.
    const restarted = createEvidenceExportRuntime(test.host);
    const fromDisk = await restarted.job('EXPJ-000032');
    expect(EvidenceExportJobSchema.safeParse(fromDisk).success).toBe(true);
    expect(fromDisk).toMatchObject({ status: 'COMPLETE', kind: 'PACKAGE', manifestHash: live?.manifestHash, signature: live?.signature, derived: false });

    test.requests.set('EXP-000037', requestRow(built, 'EXP-000037', 'COMPOSITE'));
    const interrupted = await restarted.job('EXPJ-000037');
    expect(EvidenceExportJobSchema.safeParse(interrupted).success).toBe(true);
    expect(interrupted).toMatchObject({ status: 'FAILED', kind: 'COMPOSITE', derived: true, failureReason: 'EXPORT_INTERRUPTED' });
    expect(await restarted.job('EXPJ-000099')).toBeNull();
    expect(restarted.inProgress(built.item.evidenceId)).toBe(false);
  });
});

describe('the request directory over the engine state', () => {
  it('finds the newest EVIDENCE_EXPORTED row of an export ID with the operator, the audit ID and the kind; and the seal of an item', () => {
    const row = (seq: number, type: string, details: Record<string, unknown>, evidenceId: string | null = 'EV-20260930-0004') => ({ id: `AUD-${String(seq).padStart(6, '0')}`, seq, at: 1_000 + seq, type, actorId: 'OPR-002', evidenceId, details });
    const state = {
      audit: {
        rows: [
          row(1, 'EVIDENCE_EXPORTED', { exportId: 'EXP-000031', destination: 'A', reason: 'first reason' }),
          row(2, 'AUDIT_EXPORTED', { exportId: 'EXP-000032', destination: 'B', reason: 'audit export' }, null),
          row(3, 'EVIDENCE_EXPORTED', { exportId: 'EXP-000033', destination: 'C', reason: 'third reason', kind: 'COMPOSITE' }),
        ],
      },
      evidence: [{ id: 'EV-20260930-0004', manifestHash: 'a'.repeat(64), signature: { value: 'b'.repeat(128) } }],
    };
    const directory = coreExportDirectory({ engine: { state: () => state } } as unknown as Parameters<typeof coreExportDirectory>[0]);
    expect(directory.requestOf('EXP-000031')).toEqual({ exportId: 'EXP-000031', evidenceId: 'EV-20260930-0004', auditId: 'AUD-000001', at: 1_001, operatorId: 'OPR-002', destination: 'A', reason: 'first reason', kind: null });
    expect(directory.requestOf('EXP-000033')?.kind).toBe('COMPOSITE');
    // An audit-log export is no evidence export.
    expect(directory.requestOf('EXP-000032')).toBeNull();
    expect(directory.requestOf('EXP-000099')).toBeNull();
    expect(directory.sealOf('EV-20260930-0004')).toEqual({ manifestHash: 'a'.repeat(64), signatureValue: 'b'.repeat(128) });
    expect(directory.sealOf('EV-20260930-0009')).toBeNull();
  });
});
