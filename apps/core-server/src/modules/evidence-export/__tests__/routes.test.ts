// Operation 87 (this module) and the row-91 seam of operation 42 (`modules/evidence`) on the real
// app factory, in process, without a database: the REAL stages 2, 3, 5 and 6; stage 4 is a
// stand-in that gives the request the principal a test names; the engine is a stub; the export
// jobs are a double that records what the routes hand it.
import { CoreApiAccessKind, validateCoreApiResponse, type EvidenceExportJobBody } from '@dems/shared/api';
import { ROLE_PERMISSIONS, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { WEB_ORIGIN } from '../../../../test/support/identity';
import { buildApp } from '../../../app';
import type { EngineHost } from '../../../engine';
import { READ_STORED_EXPORT_FAILURE, READ_STORED_EXPORT_REQUEST, evidenceExport, replaceExportServicePartsForTest, type EvidenceExportRuntime } from '../../../evidence-export';
import type { Principal } from '../../../plugins/authenticate';
import { permissionGuard } from '../../../plugins/permission-guard';
import { EVIDENCE_EXPORT_MODULE_OPERATIONS } from '../index';

const ID = 'EV-20260930-0004';
const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

const operator = (role: OperatorRole): Principal => ({ kind: 'OPERATOR', operatorId: role === 'SUPERVISOR' ? 'OPR-002' : 'OPR-001', sessionId: 'session', deviceId: null, role, permissions: ROLE_PERMISSIONS[role] });

interface Bed {
  readonly app: FastifyInstance;
  readonly commands: unknown[][];
  actAs(principal: Principal): void;
  engineAnswers(answer: unknown): void;
  /** The audit entries the routes asked a unit to append (a stand-in pipeline: no database here). */
  readonly appended: Array<Record<string, unknown>>;
  get(url: string): Promise<LightMyRequestResponse>;
  post(url: string, payload: Record<string, unknown>): Promise<LightMyRequestResponse>;
}

const REQUEST_ROW = { id: 'AUD-000101', seq: 101, at: 1_790_824_500_000, type: 'EVIDENCE_EXPORTED', actorId: 'OPR-002', evidenceId: ID, details: { exportId: 'EXP-000032', destination: 'Case file transfer', reason: 'Prosecutor request' } };
/** A dataset item: no sealed package here. Its simulated export completed inside its request (the custody entry of that instant). */
const SIMULATED_ITEM = {
  id: ID,
  sessionId: 'SES-20260930-0004',
  investigatorId: 'OPR-001',
  integritySource: 'DEMO_PACKAGE',
  manifestVersion: 1,
  manifestHash: 'a'.repeat(64),
  signature: { value: 'b'.repeat(128), algorithm: 'SIMULATED-SHA256', simulated: true },
  custody: [{ at: REQUEST_ROW.at, action: 'EXPORTED', actorId: 'OPR-002', detail: 'Case file transfer' }],
};
/** The same item as a REAL sealed v2 package of this Core's store, held by OPR-001; a request row and NO custody entry of an export. */
const REAL_ITEM = { ...SIMULATED_ITEM, integritySource: 'REAL', manifestVersion: 2, signature: { value: 'b'.repeat(128), algorithm: 'Ed25519', simulated: false, keyId: 'CORE-KEY-EVSIGN-01' }, custody: [] };
type State = { audit: { rows: unknown[] }; evidence: unknown[] };
const STATE: State = { audit: { rows: [REQUEST_ROW] }, evidence: [SIMULATED_ITEM] };
const REAL_STATE: State = { audit: { rows: [REQUEST_ROW] }, evidence: [REAL_ITEM] };

/**
 * What the stand-in pool answers to the two READ statements of the stored export trail (R93-11:
 * a request or a failure the audit ring does not hold is read from the stored rows). Default: the
 * stored trail holds nothing more than the ring. `'DOWN'`: those reads fail like every other statement.
 */
type StoredTrail = 'DOWN' | { readonly requests?: Record<string, Record<string, unknown>>; readonly failures?: Record<string, Record<string, unknown>> };

async function bed(state: State = STATE, stored: StoredTrail = {}): Promise<Bed> {
  const failure = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
  const pool = {
    connect: async () => Promise.reject(failure),
    // No database here: every statement fails, except the two reads of the stored export trail.
    query: async (text: unknown, values?: unknown[]) => {
      const key = String(values?.[0]);
      if (stored !== 'DOWN' && text === READ_STORED_EXPORT_REQUEST) return { rows: [stored.requests?.[key]].filter((row) => row !== undefined) };
      if (stored !== 'DOWN' && text === READ_STORED_EXPORT_FAILURE) return { rows: [stored.failures?.[key]].filter((row) => row !== undefined) };
      return Promise.reject(failure);
    },
    on: () => pool,
    end: async () => {},
  };
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => pool as unknown as Pool, logStream: captureLog().stream });
  apps.push(app);
  let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  const commands: unknown[][] = [];
  let answer: unknown = undefined;
  app.seams.replace('engine', {
    epoch: 7,
    revision: 42,
    running: true,
    state: () => state,
    async command(_principal: Principal, ...args: unknown[]) {
      commands.push(args);
      if (answer instanceof Error) throw answer;
      return { value: answer, epoch: 7, revision: 42 };
    },
  } as unknown as EngineHost);
  const appended: Bed['appended'] = [];
  app.seams.replace('pipeline', {
    run: async (label: string, work: (unit: unknown) => unknown) => work({ label, audit: { append: async (entry: Record<string, unknown>) => void appended.push({ ...entry, unit: label }) } }),
  } as unknown as FastifyInstance['pipeline']);
  return {
    app,
    commands,
    appended,
    actAs: (principal) => void (current = principal),
    engineAnswers: (next) => void (answer = next),
    get: (url) => app.inject({ method: 'GET', url }),
    post: (url, payload) => app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN }, payload }),
  };
}

const jobUrl = (id: string): string => `/api/v1/evidence/exports/${id}`;
const exportUrl = (id: string): string => `/api/v1/evidence/${id}/export`;
const outcomeOf = (response: LightMyRequestResponse): [number, string | undefined] => [response.statusCode, (response.json() as { error?: { code?: string } }).error?.code];

interface Double {
  readonly runtime: EvidenceExportRuntime;
  readonly log: string[];
  busy: boolean;
  job: EvidenceExportJobBody | null;
}
function double(): Double {
  const self: Double = {
    log: [],
    busy: false,
    job: null,
    runtime: {
      inProgress: () => self.busy,
      begin(evidenceId) {
        if (self.busy) {
          self.log.push(`begin ${evidenceId} -> refused`);
          return null;
        }
        self.log.push(`begin ${evidenceId}`);
        return {
          cancel: () => void self.log.push('cancel'),
          accepted: async (request) => {
            self.log.push(`accepted ${request.exportId} ${request.kind}${request.deferred === true ? ' deferred' : ''}`);
            return 'QUEUED';
          },
        };
      },
      job: async (jobId) => {
        self.log.push(`job ${jobId}`);
        return self.job;
      },
      idle: async () => undefined,
      stop: async () => undefined,
    },
  };
  return self;
}

describe('operation 87 getEvidenceExportJob', () => {
  it('is the one operation of the module, and its access is the registry rule: 401 without a session, 403 without EVIDENCE_EXPORT', async () => {
    expect(EVIDENCE_EXPORT_MODULE_OPERATIONS).toEqual(['getEvidenceExportJob']);
    const test = await bed();
    expect(outcomeOf(await test.get(jobUrl('EXPJ-000032')))[0]).toBe(401);
    test.actAs(operator('INVESTIGATOR'));
    // The guard refuses before the handler; without a database its denial row cannot be written
    // (503 here, 403 against PostgreSQL - the acceptance walk). What is held here is the rule itself.
    expect((await test.get(jobUrl('EXPJ-000032'))).statusCode).toBeGreaterThanOrEqual(400);
    const rule = permissionGuard(test.app).registeredRules().find((entry) => entry.operationId === 'getEvidenceExportJob');
    expect([rule?.method, rule?.url, rule?.kind, rule?.permissions]).toEqual(['GET', '/api/v1/evidence/exports/:id', CoreApiAccessKind.PERMISSION, ['EVIDENCE_EXPORT']]);
  });

  it('an export of an item that is no real package answers as Simulated mode does: COMPLETE, from the committed request row', async () => {
    const test = await bed();
    test.actAs(operator('SUPERVISOR'));
    const response = await test.get(jobUrl('EXPJ-000032'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ jobId: 'EXPJ-000032', evidenceId: ID, kind: 'PACKAGE', status: 'COMPLETE', progressPct: 100, etaMs: 0, manifestHash: 'a'.repeat(64), signature: 'b'.repeat(128), derived: false, createdAt: REQUEST_ROW.at, completedAt: REQUEST_ROW.at });
    expect(validateCoreApiResponse('getEvidenceExportJob', 200, response.json())).toEqual({ ok: true });

    const unknown = await test.get(jobUrl('EXPJ-000099'));
    expect(outcomeOf(unknown)).toEqual([404, 'NOT_FOUND']);
    expect(validateCoreApiResponse('getEvidenceExportJob', 404, unknown.json())).toEqual({ ok: true });
    for (const bad of ['EXP-000032', 'EXPJ-12', 'x']) {
      const invalid = await test.get(jobUrl(bad));
      expect(invalid.statusCode, bad).toBe(422);
      expect(validateCoreApiResponse('getEvidenceExportJob', 422, invalid.json())).toEqual({ ok: true });
    }
  });

  it('a job of the export jobs is answered as they hold it - a FAILED job is a 200', async () => {
    const test = await bed();
    const jobs = double();
    evidenceExport(test.app).provide(jobs.runtime);
    test.actAs(operator('SUPERVISOR'));
    jobs.job = { jobId: 'EXPJ-000032', evidenceId: ID, kind: 'COMPOSITE', status: 'FAILED', progressPct: 30, etaMs: 0, derived: true, createdAt: 1, completedAt: 2, failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED' };
    const response = await test.get(jobUrl('EXPJ-000032'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(jobs.job);
    expect(validateCoreApiResponse('getEvidenceExportJob', 200, response.json())).toEqual({ ok: true });
    expect(jobs.log).toEqual(['job EXPJ-000032']);
  });
});

describe('operation 42 exportEvidence with export jobs provided (the seam of row 91)', () => {
  it('an accepted request is handed over with its export ID and its kind, after the hosted action; the answer is unchanged', async () => {
    const test = await bed();
    const jobs = double();
    evidenceExport(test.app).provide(jobs.runtime);
    test.actAs(operator('SUPERVISOR'));
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });
    // Fix wave J: THIS Core can produce a composite (a test part; the build selects no encoder) - only then is a COMPOSITE handed on.
    replaceExportServicePartsForTest(test.app, { compositeAvailable: () => true });
    const response = await test.post(exportUrl(ID), { reason: 'Prosecutor request', kind: 'COMPOSITE', composite: {} });
    expect(response.statusCode).toBe(202);
    // R93-06: the job operation 87 polls is named in the answer, as the contract and the simulator have it.
    expect(response.json()).toEqual({ exportId: 'EXP-000032', evidenceId: ID, status: 'QUEUED', jobId: 'EXPJ-000032', archiveOnCore: false }); // fix wave K (G94b-06): a dataset item - no archive
    expect(validateCoreApiResponse('exportEvidence', 202, response.json())).toEqual({ ok: true });
    expect(jobs.log).toEqual([`begin ${ID}`, 'accepted EXP-000032 COMPOSITE']);
    // R93-06: the kind the body named is on the request the hosted action commits; an item without a package here is not deferred.
    expect(test.commands[0]).toEqual(['exportEvidence', ID, { reason: 'Prosecutor request', destination: '', kind: 'COMPOSITE', compositeAvailable: true }]);
    expect(test.commands).toHaveLength(1);

    jobs.log.length = 0;
    await test.post(exportUrl(ID), { reason: 'Prosecutor request' });
    expect(jobs.log).toEqual([`begin ${ID}`, 'accepted EXP-000032 PACKAGE']);
    // A body that names no kind writes none.
    expect(test.commands[1]).toEqual(['exportEvidence', ID, { reason: 'Prosecutor request', destination: '' }]);
  });

  it('fix wave J (truth rule 3d; JA2-03 / JW-03): a COMPOSITE this build cannot produce is refused BEFORE the ticket, the hosted action and any job - 409 COMMAND_UNSUPPORTED with its reason', async () => {
    const test = await bed();
    const jobs = double();
    evidenceExport(test.app).provide(jobs.runtime);
    test.actAs(operator('SUPERVISOR'));
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });
    // No part is replaced: the build's own answer (`selectedCompositeEncoder()` is null - the licence gate).
    const response = await test.post(exportUrl(ID), { reason: 'Prosecutor request', kind: 'COMPOSITE', composite: {} });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'COMMAND_UNSUPPORTED', message: 'Composite video is not available in this build.', details: { reason: 'COMPOSITE_ENCODER_NOT_SELECTED' } } });
    expect(validateCoreApiResponse('exportEvidence', 409, response.json())).toEqual({ ok: true });
    // Nothing ran: no ticket was taken, no hosted action, so no export id, no request row and no "Evidence exported" event exist.
    expect(jobs.log).toEqual([]);
    expect(test.commands).toEqual([]);
    // CONTROL: the same request as a PACKAGE is accepted, by the same bed.
    const accepted = await test.post(exportUrl(ID), { reason: 'Prosecutor request', kind: 'PACKAGE' });
    expect(accepted.statusCode).toBe(202);
    expect(jobs.log).toEqual([`begin ${ID}`, 'accepted EXP-000032 PACKAGE']);
    expect(test.commands).toHaveLength(1);
  });

  it('409 EXPORT_IN_PROGRESS while a job of the item is unfinished: the hosted action is not run, so no second request row is written', async () => {
    const test = await bed();
    const jobs = double();
    evidenceExport(test.app).provide(jobs.runtime);
    test.actAs(operator('SUPERVISOR'));
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000033' });
    jobs.busy = true;
    const response = await test.post(exportUrl(ID), { reason: 'Prosecutor request' });
    expect(outcomeOf(response)).toEqual([409, 'EXPORT_IN_PROGRESS']);
    expect((response.json() as { error: { message: string } }).error.message).toBe('An export job is already running for this evidence item.');
    expect(validateCoreApiResponse('exportEvidence', 409, response.json())).toEqual({ ok: true });
    expect(test.commands).toEqual([]);
    expect(jobs.log).toEqual([`begin ${ID} -> refused`]);
    // CONTROL: the same request passes once the item is free.
    jobs.busy = false;
    expect((await test.post(exportUrl(ID), { reason: 'Prosecutor request' })).statusCode).toBe(202);
  });

  it('a refused request and a failed unit give the ticket back; a body that is invalid, and a caller without the permission, take none', async () => {
    const test = await bed();
    const jobs = double();
    evidenceExport(test.app).provide(jobs.runtime);
    test.actAs(operator('SUPERVISOR'));
    test.engineAnswers({ ok: false, status: 409, reason: 'NOT_SEALED' });
    expect(outcomeOf(await test.post(exportUrl(ID), { reason: 'Prosecutor request' }))).toEqual([409, 'NOT_SEALED']);
    test.engineAnswers(new Error('the unit was not committed'));
    expect((await test.post(exportUrl(ID), { reason: 'Prosecutor request' })).statusCode).toBe(500);
    expect(jobs.log).toEqual([`begin ${ID}`, 'cancel', `begin ${ID}`, 'cancel']);

    jobs.log.length = 0;
    expect((await test.post(exportUrl(ID), { reason: 7 })).statusCode).toBe(422);
    test.actAs(operator('INVESTIGATOR'));
    expect((await test.post(exportUrl(ID), { reason: 'Prosecutor request' })).statusCode).toBeGreaterThanOrEqual(400);
    expect(jobs.log).toEqual([]);
  });

  it('CONTROL: without export jobs provided operation 42 is what it was before this row', async () => {
    const test = await bed();
    test.actAs(operator('SUPERVISOR'));
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });
    const response = await test.post(exportUrl(ID), { reason: 'Prosecutor request' });
    expect(response.statusCode).toBe(202);
    expect(test.commands).toHaveLength(1);
  });
});

// Fix pass F-M8 (review findings R93-01, R93-03, R93-06; controller ruling D178).
const exporterOf = (operatorId: string): Principal => ({ kind: 'OPERATOR', operatorId, sessionId: 'session', deviceId: null, role: 'INVESTIGATOR', permissions: [...ROLE_PERMISSIONS.INVESTIGATOR, 'EVIDENCE_EXPORT'] });
const detailsOf = (response: LightMyRequestResponse): Record<string, unknown> | undefined => (response.json() as { error?: { details?: Record<string, unknown> } }).error?.details;

describe('R93-01: an item with a sealed package in this store is never given the simulated export', () => {
  it('CONTROL (the provider absent): operation 42 is REFUSED by name and NOTHING is marked - the hosted action does not run', async () => {
    const test = await bed(REAL_STATE);
    test.actAs(operator('SUPERVISOR'));
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });
    const response = await test.post(exportUrl(ID), { reason: 'Prosecutor request' });
    expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
    expect(detailsOf(response)).toEqual({ reason: 'EXPORT_JOBS_NOT_AVAILABLE' });
    expect(test.commands).toEqual([]);
  });

  it('operation 87 without a job record of such an item is FAILED with a code - never COMPLETE, never the seal\'s manifest hash or signature', async () => {
    const test = await bed(REAL_STATE);
    test.actAs(operator('SUPERVISOR'));
    const response = await test.get(jobUrl('EXPJ-000032'));
    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(body).toEqual({ jobId: 'EXPJ-000032', evidenceId: ID, kind: 'PACKAGE', status: 'FAILED', progressPct: 0, etaMs: 0, derived: false, createdAt: REQUEST_ROW.at, completedAt: null, failureReason: 'EXPORT_JOBS_NOT_AVAILABLE' });
    expect(body).not.toHaveProperty('manifestHash');
    expect(body).not.toHaveProperty('signature');
    expect(validateCoreApiResponse('getEvidenceExportJob', 200, body)).toEqual({ ok: true });

    // With export jobs composed that hold no record of it (a restart, no artefact): the same, with the jobs' own code.
    const second = await bed(REAL_STATE);
    const jobs = double();
    evidenceExport(second.app).provide(jobs.runtime);
    second.actAs(operator('SUPERVISOR'));
    expect(await second.get(jobUrl('EXPJ-000032')).then((answer) => answer.json())).toMatchObject({ status: 'FAILED', failureReason: 'EXPORT_INTERRUPTED' });
  });

  it('a simulated export is COMPLETE only by its own record: without the custody entry of its request it is not', async () => {
    const test = await bed({ audit: { rows: [REQUEST_ROW] }, evidence: [{ ...SIMULATED_ITEM, custody: [] }] });
    test.actAs(operator('SUPERVISOR'));
    expect(await test.get(jobUrl('EXPJ-000032')).then((answer) => answer.json())).toMatchObject({ status: 'FAILED' });
  });
});

describe('R93-03: a request for a sealed package is committed DEFERRED; the completion is the job\'s', () => {
  it('the hosted action gets `completion: DEFERRED` for a sealed package, and the hand-over says so; a dataset item is not deferred', async () => {
    const test = await bed(REAL_STATE);
    const jobs = double();
    evidenceExport(test.app).provide(jobs.runtime);
    test.actAs(operator('SUPERVISOR'));
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });
    const accepted = await test.post(exportUrl(ID), { reason: 'Prosecutor request' });
    expect(accepted.statusCode).toBe(202);
    // Fix wave K (G94b-06): a JOB of this Core writes the archive into its store - the answer says so (a dataset item answers false, above).
    expect((accepted.json() as { archiveOnCore?: boolean }).archiveOnCore).toBe(true);
    // G94-10 (wave H C1): the request of a JOB says its kind on the row also when the body left it to the default
    // (C3 §5.2 `details.kind: PACKAGE|COMPOSITE`). Until wave H this pinned a request WITHOUT `kind`: the gate's finding.
    expect(test.commands[0]).toEqual(['exportEvidence', ID, { reason: 'Prosecutor request', destination: '', kind: 'PACKAGE', completion: 'DEFERRED' }]);
    expect(jobs.log).toEqual([`begin ${ID}`, 'accepted EXP-000032 PACKAGE deferred']);
  });

  it('a client cannot ask for or switch off the deferral: `completion` in a body never reaches the action', async () => {
    const test = await bed();
    test.actAs(operator('SUPERVISOR'));
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });
    await test.post(exportUrl(ID), { reason: 'Prosecutor request', completion: 'DEFERRED' });
    expect(test.commands[0]).toEqual(['exportEvidence', ID, { reason: 'Prosecutor request', destination: '' }]);
  });
});

describe('the REAL-evidence case scope on operations 42 and 87 (SEC35-16; the one predicate of src/media-stream)', () => {
  it('a caller with EVIDENCE_EXPORT who neither holds the case nor is a SUPERVISOR is refused on both, audited; the holder and a SUPERVISOR pass', async () => {
    const test = await bed(REAL_STATE);
    const jobs = double();
    evidenceExport(test.app).provide(jobs.runtime);
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });

    test.actAs(exporterOf('OPR-009'));
    const refused = await test.post(exportUrl(ID), { reason: 'Prosecutor request' });
    expect(outcomeOf(refused)).toEqual([403, 'NOT_PERMITTED']);
    expect(detailsOf(refused)).toMatchObject({ operationId: 'exportEvidence', reason: 'EVIDENCE_CASE_SCOPE' });
    expect(test.commands).toEqual([]);
    const poll = await test.get(jobUrl('EXPJ-000032'));
    expect(outcomeOf(poll)).toEqual([403, 'NOT_PERMITTED']);
    expect(detailsOf(poll)).toMatchObject({ operationId: 'getEvidenceExportJob', reason: 'EVIDENCE_CASE_SCOPE' });
    expect(test.appended.map((entry) => [entry['type'], entry['actorId'], entry['evidenceId'], (entry['details'] as Record<string, unknown>)['reason']])).toEqual([
      ['ACCESS_DENIED', 'OPR-009', ID, 'EVIDENCE_CASE_SCOPE'],
      ['ACCESS_DENIED', 'OPR-009', ID, 'EVIDENCE_CASE_SCOPE'],
    ]);

    // The holder of the case, and a SUPERVISOR: both operations answer.
    for (const inside of [exporterOf('OPR-001'), operator('SUPERVISOR')]) {
      test.actAs(inside);
      expect((await test.post(exportUrl(ID), { reason: 'Prosecutor request' })).statusCode).toBe(202);
      expect((await test.get(jobUrl('EXPJ-000032'))).statusCode).toBe(200);
    }
    expect(test.appended).toHaveLength(2);
  });

  it('CONTROL: an item that is not REAL evidence has no case scope - the same caller is answered', async () => {
    const test = await bed();
    test.actAs(exporterOf('OPR-009'));
    test.engineAnswers({ ok: true, status: 202, exportId: 'EXP-000032' });
    expect((await test.post(exportUrl(ID), { reason: 'Prosecutor request' })).statusCode).toBe(202);
    expect((await test.get(jobUrl('EXPJ-000032'))).statusCode).toBe(200);
    expect(test.appended).toEqual([]);
  });
});

// Closing pass F-X (review finding R93-11, second half): operation 87 does not depend on the audit ring.
describe('R93-11: a request and a failure the audit ring no longer holds are read from the stored rows', () => {
  const EMPTY_RING = (item: unknown): State => ({ audit: { rows: [] }, evidence: [item] });
  const STORED_REQUEST = { evidence_id: ID, operator_id: 'OPR-002', destination: 'Case file transfer', reason: 'Prosecutor request', audit_id: 'AUD-000101', at: String(REQUEST_ROW.at), details: { exportId: 'EXP-000032', destination: 'Case file transfer', reason: 'Prosecutor request', kind: 'COMPOSITE' } };

  it('an empty ring and a stored request: the job is answered (not 404), FAILED with the reason of its STORED failure row; without one, EXPORT_INTERRUPTED', async () => {
    const test = await bed(EMPTY_RING(REAL_ITEM), { requests: { 'EXP-000032': STORED_REQUEST }, failures: { 'EXPJ-000032': { details: { jobId: 'EXPJ-000032', kind: 'COMPOSITE', reason: 'COMPOSITE_ENCODER_NOT_SELECTED' } } } });
    test.actAs(operator('SUPERVISOR'));
    const response = await test.get(jobUrl('EXPJ-000032'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ jobId: 'EXPJ-000032', evidenceId: ID, kind: 'COMPOSITE', status: 'FAILED', progressPct: 0, etaMs: 0, derived: true, createdAt: REQUEST_ROW.at, completedAt: null, failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED' });
    expect(validateCoreApiResponse('getEvidenceExportJob', 200, response.json())).toEqual({ ok: true });
    // CONTROL: another export ID is in neither place.
    expect(outcomeOf(await test.get(jobUrl('EXPJ-000033')))).toEqual([404, 'NOT_FOUND']);

    // No stored failure row: the default code, as before.
    const second = await bed(EMPTY_RING(REAL_ITEM), { requests: { 'EXP-000032': STORED_REQUEST } });
    evidenceExport(second.app).provide(double().runtime);
    second.actAs(operator('SUPERVISOR'));
    expect(await second.get(jobUrl('EXPJ-000032')).then((answer) => answer.json())).toMatchObject({ status: 'FAILED', kind: 'COMPOSITE', failureReason: 'EXPORT_INTERRUPTED' });
  });

  it('an empty ring and a stored request of an item without a package here: the simulated export is COMPLETE as its custody chain says', async () => {
    const test = await bed(EMPTY_RING(SIMULATED_ITEM), { requests: { 'EXP-000032': { ...STORED_REQUEST, details: { exportId: 'EXP-000032' } } } });
    test.actAs(operator('SUPERVISOR'));
    const response = await test.get(jobUrl('EXPJ-000032'));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ jobId: 'EXPJ-000032', kind: 'PACKAGE', status: 'COMPLETE', createdAt: REQUEST_ROW.at, completedAt: REQUEST_ROW.at });
  });

  it('stored rows that cannot be read are 503 NOT_READY with a persisted error entry - never "no such job"', async () => {
    const test = await bed(EMPTY_RING(REAL_ITEM), 'DOWN');
    const spy = vi.spyOn(test.app.errorLog, 'append');
    test.actAs(operator('SUPERVISOR'));
    const response = await test.get(jobUrl('EXPJ-000032'));
    expect(outcomeOf(response)).toEqual([503, 'NOT_READY']);
    const persisted = spy.mock.calls.map(([entry]) => entry);
    expect(persisted.map((entry) => [entry.level, entry.source])).toContainEqual(['error', 'evidenceExport.storedRequest']);
    // Nothing of the statement is in the entry: a code and IDs.
    expect(JSON.stringify(persisted)).not.toContain('SELECT');
  });
});
