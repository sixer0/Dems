// Operation 87 (this module) and the row-91 seam of operation 42 (`modules/evidence`) on the real
// app factory, in process, without a database: the REAL stages 2, 3, 5 and 6; stage 4 is a
// stand-in that gives the request the principal a test names; the engine is a stub; the export
// jobs are a double that records what the routes hand it.
import { CoreApiAccessKind, validateCoreApiResponse, type EvidenceExportJobBody } from '@dems/shared/api';
import { ROLE_PERMISSIONS, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { WEB_ORIGIN } from '../../../../test/support/identity';
import { buildApp } from '../../../app';
import type { EngineHost } from '../../../engine';
import { evidenceExport, type EvidenceExportRuntime } from '../../../evidence-export';
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
  get(url: string): Promise<LightMyRequestResponse>;
  post(url: string, payload: Record<string, unknown>): Promise<LightMyRequestResponse>;
}

const REQUEST_ROW = { id: 'AUD-000101', seq: 101, at: 1_790_824_500_000, type: 'EVIDENCE_EXPORTED', actorId: 'OPR-002', evidenceId: ID, details: { exportId: 'EXP-000032', destination: 'Case file transfer', reason: 'Prosecutor request' } };
const STATE = { audit: { rows: [REQUEST_ROW] }, evidence: [{ id: ID, manifestHash: 'a'.repeat(64), signature: { value: 'b'.repeat(128) } }] };

async function bed(): Promise<Bed> {
  const failure = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
  const pool = { connect: async () => Promise.reject(failure), query: async () => Promise.reject(failure), on: () => pool, end: async () => {} };
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
    state: () => STATE,
    async command(_principal: Principal, ...args: unknown[]) {
      commands.push(args);
      if (answer instanceof Error) throw answer;
      return { value: answer, epoch: 7, revision: 42 };
    },
  } as unknown as EngineHost);
  return {
    app,
    commands,
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
            self.log.push(`accepted ${request.exportId} ${request.kind}`);
            return 'QUEUED';
          },
        };
      },
      job: async (jobId) => {
        self.log.push(`job ${jobId}`);
        return self.job;
      },
      idle: async () => undefined,
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
    const response = await test.post(exportUrl(ID), { reason: 'Prosecutor request', kind: 'COMPOSITE', composite: {} });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ exportId: 'EXP-000032', evidenceId: ID, status: 'QUEUED' });
    expect(jobs.log).toEqual([`begin ${ID}`, 'accepted EXP-000032 COMPOSITE']);
    expect(test.commands).toHaveLength(1);

    jobs.log.length = 0;
    await test.post(exportUrl(ID), { reason: 'Prosecutor request' });
    expect(jobs.log).toEqual([`begin ${ID}`, 'accepted EXP-000032 PACKAGE']);
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
