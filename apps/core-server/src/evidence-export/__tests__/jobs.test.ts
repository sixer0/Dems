// The export jobs (blueprint row 91): operation 42's background side and what operation 87 polls.
// Real packages from the verify-v2 builder, a host of doubles; the job's answers are held to the
// contract schema of operation 87, and the failure row to the detail keys of C3 §5.2 (M8-XAU-1).
import { EXPORT_JOB_ID_PATTERN, EvidenceExportJobSchema, EvidenceFinishedExportSchema } from '@dems/shared/api';
import { AuditType } from '@dems/shared/sim';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackage, removeScratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { coreExportDirectory, exportFailedEntry } from '../host';
import { createEvidenceExportRuntime, exportIdOfJob, exportJobIdOf, type EvidenceExportHost, type ExportRequestRecord } from '../jobs';
import type { ExportPorts } from '../package-export';
import { EXPORTED_AT, portsOf, standInEncoder } from './support';
import { createHash } from 'node:crypto';
import { archiveFactsOf, archiveFileOf, listFinishedExports } from '../finished';

afterEach(removeScratch);

interface Bed {
  readonly host: EvidenceExportHost;
  readonly failures: Parameters<EvidenceExportHost['recordFailure']>[0][];
  readonly errors: Parameters<EvidenceExportHost['reportError']>[0][];
  /** R93-03: what the jobs told the engine's export door, in order. */
  readonly completions: Parameters<EvidenceExportHost['completeExport']>[0][];
  /** R93-11: the reasons of `EVIDENCE_EXPORT_FAILED` rows the trail still holds, by job ID. */
  readonly recordedFailures: Map<string, string>;
  failCompletion: boolean;
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
  const completions: Bed['completions'] = [];
  const self: Bed = {
    failures,
    errors,
    completions,
    recordedFailures: new Map(),
    failCompletion: false,
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
      completeExport: async (completion) => {
        if (self.failCompletion) throw new Error('the database is away');
        completions.push(completion);
      },
      failureOf: (jobId) => self.recordedFailures.get(jobId) ?? null,
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

// Fix pass F-M8 (review findings R93-03, R93-11; ruling D178).
describe('R93-03: custody is written when the job has COMPLETED, never before and never for a failed job', () => {
  it('nothing is told to the engine while the job is queued; ONE completion with the operator and the destination of the request when the archive exists', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    test.requests.set('EXP-000032', requestRow(built, 'EXP-000032'));
    await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000032', kind: 'PACKAGE', deferred: true });
    expect(test.completions).toEqual([]);
    start(test);
    await runtime.idle();
    expect((await runtime.job('EXPJ-000032'))?.status).toBe('COMPLETE');
    expect(existsSync(built.path('export/EXP-000032.zip'))).toBe(true);
    expect(test.completions).toEqual([{ evidenceId: built.item.evidenceId, exportId: 'EXP-000032', operatorId: 'OPR-002', destination: 'Case file transfer' }]);
  });

  it('a job that fails tells the engine nothing: the item keeps its status, the one record is the failure row', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    test.requests.set('EXP-000033', requestRow(built, 'EXP-000033', 'COMPOSITE'));
    await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000033', kind: 'COMPOSITE', deferred: true });
    start(test);
    await runtime.idle();
    expect(await runtime.job('EXPJ-000033')).toMatchObject({ status: 'FAILED', failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED' });
    expect(test.completions).toEqual([]);
    expect(test.failures).toHaveLength(1);
  });

  it('a completion that cannot be recorded leaves the export COMPLETE (the archive exists) and says so in the persistent error log', async () => {
    const built = await buildPackage();
    const test = bed(built);
    test.failCompletion = true;
    const runtime = createEvidenceExportRuntime(test.host);
    test.requests.set('EXP-000032', requestRow(built, 'EXP-000032'));
    await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000032', kind: 'PACKAGE', deferred: true });
    start(test);
    await runtime.idle();
    expect((await runtime.job('EXPJ-000032'))?.status).toBe('COMPLETE');
    expect(test.errors.map((entry) => entry.code)).toEqual(['EXPORT_COMPLETION_NOT_RECORDED']);
    expect(test.failures).toEqual([]);
  });

  it('a DEFERRED request no job can be queued for ends FAILED with its row (EXPORT_NOT_QUEUED): it never stays open', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    const other = 'EV-20260930-0004';
    test.requests.set('EXP-000050', { ...requestRow(built, 'EXP-000050'), evidenceId: other });
    expect(await runtime.begin(other)?.accepted({ exportId: 'EXP-000050', kind: 'PACKAGE', deferred: true })).toBe('NOT_A_REAL_PACKAGE');
    expect(test.failures).toEqual([{ jobId: 'EXPJ-000050', evidenceId: other, kind: 'PACKAGE', reason: 'EXPORT_NOT_QUEUED', operatorId: 'OPR-002' }]);
    expect(await runtime.job('EXPJ-000050')).toMatchObject({ status: 'FAILED', failureReason: 'EXPORT_NOT_QUEUED' });
    expect(runtime.inProgress(other)).toBe(false);
    expect(test.completions).toEqual([]);
  });
});

describe('R93-11: the request of a job and the reason of a failure outlive a busy trail', () => {
  it('a queued job keeps the request it was handed: the row leaving the ring before the job runs does not fail it', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const runtime = createEvidenceExportRuntime(test.host);
    test.requests.set('EXP-000032', requestRow(built, 'EXP-000032'));
    await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000032', kind: 'PACKAGE' });
    // A thousand playback rows later the ring does not hold the request any more.
    test.requests.clear();
    start(test);
    await runtime.idle();
    expect(await runtime.job('EXPJ-000032')).toMatchObject({ status: 'COMPLETE' });
    expect(test.failures).toEqual([]);
  });

  it('after a restart a job that FAILED is answered with the reason of its failure row, not with EXPORT_INTERRUPTED', async () => {
    const built = await buildPackage();
    const test = bed(built);
    test.requests.set('EXP-000033', requestRow(built, 'EXP-000033', 'COMPOSITE'));
    test.recordedFailures.set('EXPJ-000033', 'COMPOSITE_ENCODER_NOT_SELECTED');
    // A new runtime: the server started again, the job map is empty.
    expect(await createEvidenceExportRuntime(test.host).job('EXPJ-000033')).toMatchObject({ status: 'FAILED', failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED', kind: 'COMPOSITE' });
    test.recordedFailures.clear();
    expect(await createEvidenceExportRuntime(test.host).job('EXPJ-000033')).toMatchObject({ status: 'FAILED', failureReason: 'EXPORT_INTERRUPTED' });
  });

  // Closing pass F-X: the host answers from the STORED rows (a read of the database: a promise, and it can fail).
  it('a host that reads the stored rows: its answers are awaited, and a read that fails is not answered as "no such job"', async () => {
    const built = await buildPackage();
    const test = bed(built);
    const stored: EvidenceExportHost = {
      ...test.host,
      requestOf: async (exportId) => (exportId === 'EXP-000033' ? requestRow(built, 'EXP-000033', 'COMPOSITE') : null),
      failureOf: async (jobId) => (jobId === 'EXPJ-000033' ? 'COMPOSITE_ENCODER_NOT_SELECTED' : null),
    };
    expect(await createEvidenceExportRuntime(stored).job('EXPJ-000033')).toMatchObject({ status: 'FAILED', failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED', kind: 'COMPOSITE', createdAt: EXPORTED_AT - 1_000 });
    expect(await createEvidenceExportRuntime(stored).job('EXPJ-000099')).toBeNull();

    const down: EvidenceExportHost = { ...test.host, requestOf: async () => Promise.reject(new Error('the database is away')) };
    await expect(createEvidenceExportRuntime(down).job('EXPJ-000033')).rejects.toThrow('the database is away');
    // A request that is handed over while the rows cannot be read: the job is queued, reads again when it runs, and ends FAILED with its row - never open, never outside its failure path.
    const runtime = createEvidenceExportRuntime(down);
    expect(await runtime.begin(built.item.evidenceId)?.accepted({ exportId: 'EXP-000034', kind: 'PACKAGE', deferred: true })).toBe('QUEUED');
    start(test);
    await runtime.idle();
    expect(await runtime.job('EXPJ-000034')).toMatchObject({ status: 'FAILED', failureReason: 'EXPORT_REQUEST_NOT_FOUND' });
    expect(test.failures).toEqual([{ jobId: 'EXPJ-000034', evidenceId: built.item.evidenceId, kind: 'PACKAGE', reason: 'EXPORT_REQUEST_NOT_FOUND', operatorId: null }]);
    expect(test.errors.map((entry) => [entry.source, entry.code])).toEqual([
      ['evidence-export.jobs.accepted', 'EXPORT_REQUEST_NOT_READ'],
      ['evidence-export.jobs.run', 'EXPORT_REQUEST_NOT_READ'],
    ]);
  });
});

describe('G94-05, G94-11, G94-12: the stop of the Core and the finished exports of an item (wave H, driver C1)', () => {
  // Wave H, driver C1 - the export jobs after gate 94 (findings G94-05, G94-11, G94-12; ruling D200):
  // a stop of the Core ends a running export at once; a finished export is listed from the package
  // folder and reachable by its job ID in a NEW run of the jobs (a restart); the job answer states
  // the archive's hash. Real packages from the verify-v2 builder, a host of doubles (the form of
  // `jobs.test.ts`).

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
});
