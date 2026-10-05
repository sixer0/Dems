// The routes of the identity core against the contract registry (plan row W24; module gate MODG;
// spec §7.5, §7.3; RB-1). In-process, no database: the route table of the real app factory.
import { CORE_API_OPERATIONS, CoreApiTag, IDENTITY_OPERATIONS, matchCoreApiOperation } from '@dems/shared/api';
import type { FastifyInstance, RouteOptions } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app';
import { createFakePool, unitTestConfig } from '../../../../test/support/config';
import { IDENTITY_CORE_OPERATIONS } from '../routes';

const WEB_ORIGIN = 'http://127.0.0.1:5173';

let app: FastifyInstance;
const registered: RouteOptions[] = [];

beforeAll(async () => {
  app = buildApp({ config: unitTestConfig(), createPool: () => createFakePool().pool });
  // Before the units load: every route they add is seen.
  app.addHook('onRoute', (route) => void registered.push(route));
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
});

afterAll(() => app.close());

/** `METHOD path` of a route, with the path as the registry writes it. */
const signature = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;

describe('MODG: the route list of the module equals the registry operations it owns', () => {
  it('registers operations 2 to 6 with the method, the path and the operation ID of the registry, and nothing else under /api/v1/auth outside /api/v1/auth/biometric', () => {
    const fromRegistry = IDENTITY_OPERATIONS.filter((operation) => (IDENTITY_CORE_OPERATIONS as readonly string[]).includes(operation.operationId)).map(
      (operation) => `${signature(operation.method, operation.path)} ${operation.operationId}`,
    );
    const fromModule = registered
      .filter((route) => route.url.startsWith('/api/v1/auth') && !route.url.startsWith('/api/v1/auth/biometric'))
      .map((route) => `${signature(String(route.method), route.url)} ${String(route.config?.operationId)}`);

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'POST /api/v1/auth/sign-in signIn',
      'GET /api/v1/auth/status getSignInStatus',
      'GET /api/v1/auth/session getAuthSession',
      'POST /api/v1/auth/sign-out signOut',
      'POST /api/v1/auth/touch touchSession',
    ]);
    console.info(`[w24] MODG routes of src/modules/identity: ${fromModule.join(' | ')}`);
    console.info(`[w24] MODG registry, operations 2 to 6:    ${fromRegistry.join(' | ')}`);
  });

  it('the area has eight operations in the registry: 2 to 6 are this module\'s, 7 to 9 are the biometric row\'s (W41)', () => {
    const area = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.IDENTITY).map((operation) => operation.operationId);
    expect(area).toEqual([...IDENTITY_CORE_OPERATIONS, 'setBiometricEnrollment', 'signInWithBiometric', 'reportBiometricFailure']);
    // The registry states the specification's number of each operation in its `source`.
    const numberOf = (operationId: string): number =>
      Number(/operation (\d+)/.exec(CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId)?.source ?? '')?.[1]);
    expect(area.map(numberOf)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('every route of the module is found by the registry\'s own matcher under its operation ID', () => {
    for (const route of registered.filter((candidate) => candidate.url.startsWith('/api/v1/auth'))) {
      expect(matchCoreApiOperation(String(route.method), route.url)?.operation.operationId).toBe(route.config?.operationId);
    }
  });

  it('no route carries an identity check of its own in onRequest: who may call is stage 6, alone (decision D83 DN-8)', () => {
    const own = (operationId: string): number => {
      const route = registered.find((candidate) => candidate.config?.operationId === operationId);
      const hooks = route?.onRequest;
      return hooks === undefined ? 0 : Array.isArray(hooks) ? hooks.length : 1;
    };
    expect(IDENTITY_CORE_OPERATIONS.map((operationId) => [operationId, own(operationId)])).toEqual([
      ['signIn', 0],
      ['getSignInStatus', 0],
      ['getAuthSession', 0],
      ['signOut', 0],
      ['touchSession', 0],
    ]);
  });
});

describe('spec §7.3: who the caller is comes before what the body holds', () => {
  it('operations 4 to 6 without a session answer 401 NOT_SIGNED_IN, also with a body that breaks its schema or is no JSON', async () => {
    const requests = [
      { method: 'GET' as const, url: '/api/v1/auth/session' },
      { method: 'POST' as const, url: '/api/v1/auth/touch', headers: { origin: WEB_ORIGIN } },
      { method: 'POST' as const, url: '/api/v1/auth/sign-out', headers: { origin: WEB_ORIGIN }, payload: { reason: 'NOT-A-REASON' } },
      { method: 'POST' as const, url: '/api/v1/auth/sign-out', headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' }, payload: '{"reason": ' },
    ];
    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
      expect((response.json() as { error: { code: string } }).error.code).toBe('NOT_SIGNED_IN');
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('signIn without a console identity answers 403 DEVICE_NOT_PAIRED, also with a body that is no JSON', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      headers: { 'content-type': 'application/json' },
      payload: '{"username": ',
    });
    expect(response.statusCode).toBe(403);
    expect((response.json() as { error: { code: string } }).error.code).toBe('DEVICE_NOT_PAIRED');
  });

  it('getSignInStatus needs no console identity: a GET without an Origin reads the web console\'s lock state', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/status' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5 });
  });
});
