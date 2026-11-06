// AC-B-12 with a route a MODULE registers (plan row W28; spec §4.6 RB-1; SR-43): when the
// contract registry's entry of a registered route carries no access rule, or no audit rule, the
// application does not boot. The registry table is type-checked, so such an entry cannot be
// written there; here the table the guard reads is replaced by one in which an entry lost a
// rule, as a careless edit of the model's types would leave it.
//
// The app is built without the domain modules (decision D85; `./without-domain-modules`): the
// routes whose entry is changed here are those of the units that are always there (health, the
// identity core, this row's module), and the operation "whose route is not registered" is an
// entry this file adds to the table, which no module will ever register.
import './without-domain-modules';
import type { CoreApiRegistryOperation } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../app';
import { captureLog, createFakePool, unitTestConfig } from '../../../../test/support/config';
import { AccessRuleError, AccessRuleErrorCode, permissionGuard } from '../index';

type Table = readonly CoreApiRegistryOperation[];

const registry = vi.hoisted(() => ({ change: (table: unknown): unknown => table }));

vi.mock('@dems/shared/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@dems/shared/api')>();
  return {
    ...original,
    // What the guard builds its rule book from, read when the plugin is loaded.
    get CORE_API_OPERATIONS() {
      return registry.change(original.CORE_API_OPERATIONS);
    },
  };
});

const apps: FastifyInstance[] = [];

afterEach(async () => {
  registry.change = (table) => table;
  for (const app of apps.splice(0)) await app.close();
});

/** The table with one member of one entry removed, on top of what was removed before. */
function without(operationId: string, member: 'access' | 'audit'): void {
  const before = registry.change;
  registry.change = (table) =>
    (before(table) as Table).map((operation) => {
      if (operation.operationId !== operationId) return operation;
      const { [member]: _removed, ...rest } = operation;
      return rest;
    });
}

async function boot(prepare?: (app: FastifyInstance) => void): Promise<{ app: FastifyInstance; error: unknown; log: ReturnType<typeof captureLog> }> {
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => createFakePool().pool, logStream: log.stream });
  apps.push(app);
  prepare?.(app);
  const error = await app.ready().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  return { app, error, log };
}

describe('AC-B-12: a registered route whose registry entry lacks a rule', () => {
  it('the unchanged registry boots (control)', async () => {
    const { app, error } = await boot();
    expect(error).toBeNull();
    expect(permissionGuard(app).routeProblems()).toEqual([]);
  });

  it.each([
    ['getRoleMatrix', 'GET /api/v1/rbac/matrix'],
    ['signIn', 'POST /api/v1/auth/sign-in'],
    ['getServiceHealth', 'GET /api/v1/health'],
  ])('%s without an ACCESS rule: app.ready() rejects and names the operation', async (operationId, route) => {
    without(operationId, 'access');
    const { error, log } = await boot();
    expect(error).toBeInstanceOf(AccessRuleError);
    expect(error).toMatchObject({ code: AccessRuleErrorCode.ACCESS_RULE_MISSING, problems: [{ code: 'ACCESS_RULE_MISSING', operationId, route }] });
    expect(log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([
      expect.objectContaining({ code: 'ACCESS_RULE_MISSING', msg: 'a registered route has no access rule or no audit rule: the server does not start' }),
    ]);
  });

  it.each([
    ['getRoleMatrix', 'GET /api/v1/rbac/matrix'],
    ['touchSession', 'POST /api/v1/auth/touch'],
    ['getServiceHealth', 'GET /api/v1/health'],
  ])('%s without an AUDIT rule: app.ready() rejects and names the operation', async (operationId, route) => {
    without(operationId, 'audit');
    const { error } = await boot();
    expect(error).toBeInstanceOf(AccessRuleError);
    expect(error).toMatchObject({ code: AccessRuleErrorCode.AUDIT_RULE_MISSING, problems: [{ code: 'AUDIT_RULE_MISSING', operationId, route }] });
  });

  it('an entry of an operation whose route is NOT registered does not stop the boot: later rows add their routes one by one', async () => {
    // Two entries that no unit has a route for, each without one of its rules.
    registry.change = (table) => {
      const [model] = table as Table;
      if (model === undefined) throw new Error('the registry table is empty');
      const { audit: _audit, ...withoutAudit } = { ...model, operationId: 'w28NoRouteRead', path: '/api/v1/w28-no-route/read' };
      const { access: _access, ...withoutAccess } = { ...model, operationId: 'w28NoRouteCommand', method: 'post', path: '/api/v1/w28-no-route/command' };
      return [...(table as Table), withoutAudit, withoutAccess];
    };
    const { app, error } = await boot();
    expect(error).toBeNull();
    const guard = permissionGuard(app);
    expect(guard.registeredRules().map((rule) => rule.operationId)).not.toContain('w28NoRouteRead');
    // The rule book still says what is wrong with each, for the day its route arrives.
    expect(guard.rules.ruleOf('w28NoRouteRead')).toMatchObject({ code: 'AUDIT_RULE_MISSING', operationId: 'w28NoRouteRead' });
    expect(guard.rules.ruleOf('w28NoRouteCommand')).toMatchObject({ code: 'ACCESS_RULE_MISSING', operationId: 'w28NoRouteCommand' });
  });

  it('and on the day its route arrives, the boot stops: the same entry with a route', async () => {
    registry.change = (table) => {
      const [model] = table as Table;
      if (model === undefined) throw new Error('the registry table is empty');
      const { audit: _audit, ...withoutAudit } = { ...model, operationId: 'w28NoRouteRead', path: '/api/v1/w28-no-route/read' };
      return [...(table as Table), withoutAudit];
    };
    const { error } = await boot((app) => {
      void app.register(async (instance) => {
        instance.get('/api/v1/w28-no-route/read', { config: { operationId: 'w28NoRouteRead' } }, async () => ({}));
      });
    });
    expect(error).toMatchObject({ code: AccessRuleErrorCode.AUDIT_RULE_MISSING, problems: [{ operationId: 'w28NoRouteRead', route: 'GET /api/v1/w28-no-route/read' }] });
  });

  it('an operation that was removed from the registry leaves its route without rules', async () => {
    registry.change = (table) => (table as Table).filter((operation) => operation.operationId !== 'getRoleMatrix');
    const { error } = await boot();
    expect(error).toMatchObject({ code: AccessRuleErrorCode.ROUTE_WITHOUT_RULES, problems: [{ operationId: null, route: 'GET /api/v1/rbac/matrix' }] });
  });
});
