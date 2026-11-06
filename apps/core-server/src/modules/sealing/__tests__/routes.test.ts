// Operation 83 (this module) on the real app factory, in process, without a database: the REAL
// stages 2, 3, 5 and 6; stage 4 is a stand-in that gives the request the principal a test names;
// the engine is a stub that answers a committed state.
import { CoreApiAccessKind, findCoreApiOperation, validateCoreApiResponse } from '@dems/shared/api';
import { FINALIZATION_ORDER, ROLE_PERMISSIONS, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import type { EngineHost } from '../../../engine';
import type { Principal } from '../../../plugins/authenticate';
import { permissionGuard } from '../../../plugins/permission-guard';
import { sealingHost } from '../../../sealing-host';
import { evidenceVerification } from '../../evidence';
import { SEALING_MODULE_OPERATIONS } from '../index';

const SESSION = 'SES-20261009-0001';
const NOW = 1_791_529_000_000;
const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

const operator = (role: OperatorRole): Principal => ({ kind: 'OPERATOR', operatorId: 'OPR-001', sessionId: 'session', deviceId: null, role, permissions: ROLE_PERMISSIONS[role] });
const steps = (running: number, progress: number, etaMs: number | null) =>
  FINALIZATION_ORDER.map((id, index) => ({
    id,
    status: index < running ? 'done' : index === running ? 'active' : 'pending',
    startedAt: index <= running ? NOW - 5_000 : null,
    completedAt: index < running ? NOW - 4_000 : null,
    durationMs: index < running ? 1_000 : null,
    progress: index < running ? 100 : index === running ? progress : 0,
    etaMs: index === running ? etaMs : null,
    detail: null,
    attempt: 1,
  }));

interface Bed {
  readonly app: FastifyInstance;
  actAs(principal: Principal): void;
  sessionIs(session: unknown): void;
  get(id: string): Promise<LightMyRequestResponse>;
}

async function bed(): Promise<Bed> {
  const failure = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
  const pool = { connect: async () => Promise.reject(failure), query: async () => Promise.reject(failure), on: () => pool, end: async () => {} };
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => pool as unknown as Pool, logStream: captureLog().stream });
  apps.push(app);
  let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
  let session: unknown = null;
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  app.seams.replace('engine', { epoch: 7, revision: 42, running: true, state: () => ({ session, evidence: [] }) } as unknown as EngineHost);
  app.seams.replace('clock', { now: () => NOW } as FastifyInstance['clock']);
  return { app, actAs: (principal) => void (current = principal), sessionIs: (next) => void (session = next), get: (id) => app.inject({ method: 'GET', url: `/api/v1/session/${id}/sealing` }) };
}

describe('operation 83 getSealingProgress', () => {
  it('is registered from its registry entry, with the registry\'s access rule: any signed-in operator, nobody else', async () => {
    const b = await bed();
    expect(SEALING_MODULE_OPERATIONS).toEqual(['getSealingProgress']);
    const rule = permissionGuard(b.app).registeredRules().find((entry) => entry.operationId === 'getSealingProgress');
    expect(rule).toMatchObject({ method: 'GET', url: '/api/v1/session/:id/sealing' });
    expect(findCoreApiOperation('getSealingProgress')?.access.kind).toBe(CoreApiAccessKind.AUTHENTICATED);

    b.sessionIs({ id: SESSION, state: 'FINALIZING', finalization: { steps: steps(1, 50, 4_200), startedAt: NOW - 5_000, completedAt: null } });
    // CONTROL of the rule: the same request without a credential is refused by stage 6, before the handler.
    const anonymous = await b.get(SESSION);
    expect(anonymous.statusCode).toBe(401);
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      b.actAs(operator(role));
      expect((await b.get(SESSION)).statusCode, role).toBe(200);
    }
  });

  it('answers the pipeline\'s step states: per-step percent in progressPct, the RUNNING step\'s etaMs, in the contract\'s shape', async () => {
    const b = await bed();
    b.actAs(operator('INVESTIGATOR'));
    b.sessionIs({ id: SESSION, state: 'FINALIZING', finalization: { steps: steps(1, 50, 4_200), startedAt: NOW - 5_000, completedAt: null } });
    const answer = await b.get(SESSION);
    expect(answer.statusCode).toBe(200);
    expect(validateCoreApiResponse('getSealingProgress', 200, answer.json())).toMatchObject({ ok: true });
    expect(answer.json()).toMatchObject({ sessionId: SESSION, state: 'FINALIZING', progressPct: 25, etaMs: 4_200, resumed: false, updatedAt: NOW });
    expect(answer.json().steps.map((step: { status: string }) => step.status)).toEqual(['done', 'active', 'pending', 'pending', 'pending', 'pending']);

    b.sessionIs({ id: SESSION, state: 'FINALIZING', finalization: { steps: steps(3, 80, 120), startedAt: NOW - 5_000, completedAt: null } });
    expect((await b.get(SESSION)).json()).toMatchObject({ progressPct: 63, etaMs: 120 });
  });

  it('404 for a session that is not the open one, 409 before the finalization started, 422 for an ID that is none', async () => {
    const b = await bed();
    b.actAs(operator('SUPERVISOR'));
    expect((await b.get(SESSION)).statusCode).toBe(404);
    b.sessionIs({ id: 'SES-20261009-0002', state: 'FINALIZING', finalization: { steps: steps(1, 50, 4_200), startedAt: NOW, completedAt: null } });
    const other = await b.get(SESSION);
    expect(other.statusCode).toBe(404);
    expect(other.json().error.code).toBe('NOT_FOUND');

    b.sessionIs({ id: SESSION, state: 'RECORDING', finalization: { steps: [], startedAt: null, completedAt: null } });
    const early = await b.get(SESSION);
    expect(early.statusCode).toBe(409);
    expect(early.json().error).toMatchObject({ code: 'INVALID_STATE', details: { from: 'RECORDING', event: 'getSealingProgress' } });
    expect(validateCoreApiResponse('getSealingProgress', 409, early.json())).toMatchObject({ ok: true });

    expect((await b.get('not-a-session')).statusCode).toBe(422);
  });
});

describe('the mount of the sealing composition', () => {
  it('SIMULATED mode: nothing is composed - no host, no verification of real packages provided, no resume boot step; the route is still there', async () => {
    const b = await bed();
    expect(sealingHost(b.app)).toMatchObject({ mounted: false });
    expect(sealingHost(b.app).controller()).toBeNull();
    expect(evidenceVerification(b.app).current()).toBeNull();
    expect(permissionGuard(b.app).registeredRules().some((entry) => entry.operationId === 'getSealingProgress')).toBe(true);
  });
});
