// The stored role matrix, the boot step `rbac.matrix` and operation 10, against PostgreSQL (plan
// row W28; spec §4.3, §4.4, §4.6 RB-1, RB-3, RB-7, RB-9, §7.6; SR-43; AC-B-12, AC-B-16 (unit
// form against the stored matrix), AC-B-17; module gate MODG; decision D82).
//
// The real app factory on clones of the seed, as `dems_app`, with every stage as the server has
// it. An app that is BOOTED here gets the engine on a manual timer (decision D77): the engine
// ticks only when a test fires it, and every count is relative to the trail after the boot.
//
// THE APP HAS NO DOMAIN MODULE (decision D85): `without-domain-modules` is the first import, so
// the domain modules and the realtime channel add no route, whichever of them have landed. The
// operations a test calls get a stand-in route built from their registry entry. Nothing here
// pins the list of boot steps either: a later row may add one.
import '../../../plugins/permission-guard/__tests__/without-domain-modules';
import { ADMINISTRATION_EXAMPLES, CORE_API_OPERATIONS, CoreApiAccessCondition, CoreApiAccessKind, validateCoreApiResponse, type CoreApiRegistryOperation } from '@dems/shared/api';
import { OPERATORS, OperatorRole, Permission, ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase, type TestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { engineControl } from '../../../engine';
import { manualTimer } from '../../../../test/support/engine';
import type { Principal } from '../../../plugins/authenticate';
import {
  AccessRuleError,
  AccessRuleErrorCode,
  decideAccess,
  isAccessRule,
  permissionGuard,
  readStoredMatrix,
  type AccessRule,
  type StoredMatrix,
} from '../../../plugins/permission-guard';
import { buildGuardApp, deviceOperator, outcome, webOperator, type GuardApp, type GuardAppOptions } from '../../../../test/support/guard';
import { BootError } from '../../../plugins/readiness';
import { throttleControl } from '../../../plugins/throttle';
import type { Publication } from '../../../realtime';
import { SESSION, WEB_ORIGIN, bearer, errorOf, insertPairedDevice, type Headers } from '../../../../test/support/identity';
import { identityControl } from '../../identity';
import { RBAC_BOOT_STEP } from '../index';

const db = useTestDatabase({ template: 'seed' });
let guard: GuardApp;
let owner: Pool;
const published: Publication[] = [];
/** The length of the trail once the app has booted: what the seed holds and what the first start wrote. */
let rowsAfterBoot = 0;

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const MATRIX = '/api/v1/rbac/matrix';
const ROLES = Object.values(OperatorRole);
const PERMISSIONS = Object.values(Permission);
/** The steps this row's step comes after: the nine database checks and the engine's. */
const STEPS_BEFORE = ['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-8', 'B-9', 'engine.rehydrate'];

const passedSteps = (app: GuardApp): unknown[] =>
  app.log
    .lines()
    .filter((line) => line['msg'] === 'boot step passed')
    .map((line) => line['step']);

/** The app on a database, ready, with the engine on a manual timer, booted as the entry point boots it. */
async function boot(target: Parameters<typeof buildGuardApp>[0], options: GuardAppOptions = {}): Promise<{ app: GuardApp; stopped: BootError | null }> {
  const app = buildGuardApp(target, options);
  await app.app.ready();
  engineControl(app.app).useTimer(manualTimer().timer);
  const stopped = await app.app.readiness.boot().then(
    () => null,
    (error: unknown) => {
      expect(error).toBeInstanceOf(BootError);
      return error as BootError;
    },
  );
  return { app, stopped };
}

/** Another untouched clone of the seed, as a target for an app of its own. */
async function clone(slug: string): Promise<{ target: Parameters<typeof buildGuardApp>[0]; database: TestDatabase }> {
  const database = await db.another({ slug });
  return { database, target: { runtime: database.runtime, run: db.run, onCleanup: (close) => database.onCleanup(close) } };
}

beforeAll(async () => {
  owner = db.ownerPool();
  const booted = await boot(db, { standIns: ['startSession', 'listUsers', 'setStoragePolicy'] });
  expect(booted.stopped).toBeNull();
  guard = booted.app;
  guard.app.seams.replace('publish', (publication) => void published.push(publication));
  await engineControl(guard.app).idle();
  await guard.app.pipeline.drain();
  rowsAfterBoot = (await readTrail(owner)).length;
});

beforeEach(() => {
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
});

describe('the boot step rbac.matrix on a seeded database', () => {
  it('passes, after the nine checks and the engine; the server is ready and has not listened', () => {
    const passed = passedSteps(guard);
    expect(passed.filter((step) => step === RBAC_BOOT_STEP)).toHaveLength(1);
    for (const step of STEPS_BEFORE) {
      expect(passed).toContain(step);
      expect(passed.indexOf(step)).toBeLessThan(passed.indexOf(RBAC_BOOT_STEP));
    }
    expect(guard.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(guard.app.server.listening).toBe(false);
    expect(guard.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });

  it('loaded the stored matrix: 3 roles, 12 permissions and 18 grants, in the stored order, stamped by the server clock', () => {
    const loaded = permissionGuard(guard.app).matrix();
    expect(loaded?.roles).toEqual(ROLES);
    expect(loaded?.permissions).toEqual(PERMISSIONS);
    expect(loaded?.grants).toHaveLength(18);
    expect(loaded?.loadedAt).toBe(guard.clock.now());
    expect(permissionGuard(guard.app).routeProblems()).toEqual([]);
  });

  it('AC-B-17, RB-7: the stored matrix equals the shared ROLE_PERMISSIONS table, grant by grant', async () => {
    const stored = await readStoredMatrix(owner);
    for (const role of ROLES) {
      const held = stored.grants.filter((grant) => grant.role === role).map((grant) => grant.permission);
      expect([role, [...held].sort()]).toEqual([role, [...ROLE_PERMISSIONS[role]].sort()]);
      // By permission order within the role.
      expect(held).toEqual(PERMISSIONS.filter((permission) => held.includes(permission)));
    }
    expect(ROLES.map((role) => stored.grants.filter((grant) => grant.role === role).length)).toEqual([4, 10, 4]);
    // By role order across the list.
    const inRoleOrder = stored.grants.map((grant) => grant.role).sort((a, b) => ROLES.indexOf(a as OperatorRole) - ROLES.indexOf(b as OperatorRole));
    expect(stored.grants.map((grant) => grant.role)).toEqual(inRoleOrder);
  });
});

describe('AC-B-16, unit form: the decision for all 75 operations with a principal of each role, against the STORED matrix', () => {
  let stored: StoredMatrix;
  const ruleOf = (operationId: string): AccessRule => {
    const resolved = permissionGuard(guard.app).rules.ruleOf(operationId);
    if (!isAccessRule(resolved)) throw new Error(`${operationId} has no rule`);
    return resolved;
  };
  /** An OPERATOR as stage 4 builds it from the stored tables: the grants of the role, in permission order. */
  const operator = (role: OperatorRole, deviceId: string | null): Principal => ({
    kind: 'OPERATOR',
    operatorId: OPERATORS[ROLES.indexOf(role)]!.id,
    sessionId: 'session',
    deviceId,
    role,
    permissions: stored.grants.filter((grant) => grant.role === role).map((grant) => grant.permission as Permission),
  });

  /** What spec §4.2 says, read from the registry entry and the stored grants, without the code under test. */
  function expected(operation: CoreApiRegistryOperation, principal: Extract<Principal, { kind: 'OPERATOR' }>): string {
    const { access } = operation;
    if (access.kind === CoreApiAccessKind.PUBLIC) return 'ALLOW';
    if (access.kind === CoreApiAccessKind.DEVICE) {
      // An operator on a device holds the marker; the device's own credential (finding CPS1-3,
      // decision D113) an operator's session never holds. Read from the registry entry.
      const ownCredential = (access.conditions ?? []).includes(CoreApiAccessCondition.DEVICE_CREDENTIAL);
      return principal.deviceId === null || ownCredential ? 'DEVICE_NOT_PAIRED' : 'ALLOW';
    }
    if (access.kind === CoreApiAccessKind.AUTHENTICATED) {
      return (access.conditions ?? []).includes(CoreApiAccessCondition.DEVICE_SESSION) && principal.deviceId === null ? 'DEVICE_NOT_PAIRED' : 'ALLOW';
    }
    const needed: readonly string[] = access.kind === CoreApiAccessKind.PERMISSION ? [access.permission] : access.permissions;
    const holds = stored.grants.some((grant) => grant.role === principal.role && needed.includes(grant.permission));
    return holds ? 'ALLOW' : 'NOT_PERMITTED';
  }

  beforeAll(async () => {
    stored = await readStoredMatrix(owner);
  });

  it.each(ROLES.flatMap((role) => [[role, null] as const, [role, 'DEV-0001'] as const]))('%s (session device %s): every operation answers what the registry rule and the stored grants say', (role, deviceId) => {
    const principal = operator(role, deviceId) as Extract<Principal, { kind: 'OPERATOR' }>;
    const wrong: string[] = [];
    for (const operation of CORE_API_OPERATIONS) {
      const decision = decideAccess(ruleOf(operation.operationId), { principal, consoleIdentity: true, demoControls: true });
      const got = decision.allowed ? 'ALLOW' : decision.refusal.kind;
      const want = expected(operation, principal);
      if (got !== want) wrong.push(`${operation.operationId}: ${got}, expected ${want}`);
    }
    expect(wrong).toEqual([]);
  });

  it('the denied cells of an operator are 22 (INVESTIGATOR), 3 (SUPERVISOR) and 31 (TECHNICIAN): the numbers of spec AC-B-16', () => {
    const denied = (role: OperatorRole): number =>
      CORE_API_OPERATIONS.filter((operation) => {
        const decision = decideAccess(ruleOf(operation.operationId), { principal: operator(role, null), consoleIdentity: true, demoControls: true });
        return !decision.allowed && decision.refusal.kind === 'NOT_PERMITTED';
      }).length;
    expect(ROLES.map(denied)).toEqual([22, 3, 31]);
  });

  it('every permission a registry rule names is stored, and every stored permission is named by at least one rule', () => {
    const named = new Set(CORE_API_OPERATIONS.flatMap((operation) => ruleOf(operation.operationId).permissions));
    expect([...named].sort()).toEqual([...stored.permissions].sort());
  });
});

describe('operation 10 getRoleMatrix (MODG: success and refusal; it has no body and no permission)', () => {
  let sessions: Record<OperatorRole, Headers>;

  beforeAll(async () => {
    sessions = {
      INVESTIGATOR: await webOperator(guard, INVESTIGATOR.username),
      SUPERVISOR: await webOperator(guard, SUPERVISOR.username),
      TECHNICIAN: await webOperator(guard, TECHNICIAN.username),
    };
  });

  it.each(ROLES)('%s reads the matrix: 200, valid against the contract, equal to what is stored and to the contract example', async (role) => {
    const before = (await readTrail(owner)).length;
    const response = await guard.app.inject({ method: 'GET', url: MATRIX, headers: sessions[role] });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { roles: string[]; permissions: string[]; grants: Array<{ role: string; permission: string }>; editable: boolean };
    expect(validateCoreApiResponse('getRoleMatrix', 200, body)).toEqual({ ok: true });
    expect(body).toEqual({ ...(await readStoredMatrix(owner)), editable: false });
    expect(body.roles).toEqual(ROLES);
    expect(body.permissions).toEqual(PERMISSIONS);
    expect(body.grants).toHaveLength(18);
    // The contract example holds the same roles, permissions and 18 grants. Within SUPERVISOR it
    // lists them in the order of the shared ROLE_PERMISSIONS array; the server answers in the
    // stored order (role, then permission, each by its sort_order).
    const example = ADMINISTRATION_EXAMPLES['getRoleMatrix']?.responses?.[200]?.['seeded']?.value as typeof body;
    const byName = (a: { role: string; permission: string }, b: { role: string; permission: string }): number =>
      `${a.role} ${a.permission}`.localeCompare(`${b.role} ${b.permission}`);
    expect({ ...body, grants: [...body.grants].sort(byName) }).toEqual({ ...example, grants: [...example.grants].sort(byName) });
    expect(body.grants.map((grant) => grant.role)).toEqual([...Array<string>(4).fill('INVESTIGATOR'), ...Array<string>(10).fill('SUPERVISOR'), ...Array<string>(4).fill('TECHNICIAN')]);
    for (const granted of ROLES.map((held) => body.grants.filter((grant) => grant.role === held).map((grant) => grant.permission))) {
      expect(granted).toEqual(PERMISSIONS.filter((permission) => granted.includes(permission)));
    }
    // A read: no audit row (NONE-R), no cookie, no state revision header.
    expect((await readTrail(owner)).length).toBe(before);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['x-dems-revision']).toBeUndefined();
  });

  it('a session on a paired device reads it too', async () => {
    await insertPairedDevice(owner, 'DEV-0001', INVESTIGATOR.id, guard.clock.now());
    const onDevice = await deviceOperator(guard, guard.devices.pair('DEV-0001'), TECHNICIAN.username);
    const response = await guard.app.inject({ method: 'GET', url: MATRIX, headers: onDevice });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { grants: unknown[] }).grants).toHaveLength(18);
  });

  it('refusals are the guard\'s: nobody without a session (401, no row), a paired device without an operator (401), a retired device (403 with its row), a foreign Origin (403)', async () => {
    const before = (await readTrail(owner)).length;
    expect(outcome(await guard.app.inject({ method: 'GET', url: MATRIX }))).toEqual([401, 'NOT_SIGNED_IN']);
    await insertPairedDevice(owner, 'DEV-0002', INVESTIGATOR.id, guard.clock.now());
    const paired = bearer(guard.devices.pair('DEV-0002'));
    expect(outcome(await guard.app.inject({ method: 'GET', url: MATRIX, headers: paired }))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcome(await guard.app.inject({ method: 'GET', url: MATRIX, headers: { ...sessions.SUPERVISOR, origin: 'http://evil.example' } }))).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    expect((await readTrail(owner)).length).toBe(before);

    guard.devices.retire('DEV-0002');
    const retired = await guard.app.inject({ method: 'GET', url: MATRIX, headers: paired });
    expect(outcome(retired)).toEqual([403, 'DEVICE_REVOKED']);
    expect(validateCoreApiResponse('getRoleMatrix', 403, retired.json())).toEqual({ ok: true });
    const rows = (await readTrail(owner)).slice(before);
    expect(rows.map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([['ACCESS_DENIED', null, 'DEV-0002', { operationId: 'getRoleMatrix', reason: 'DEVICE_REVOKED' }]]);
  });

  it('RB-9: the matrix cannot be changed through the API: no method but GET on the path, and the runtime role cannot write the three tables', async () => {
    const post = await guard.app.inject({ method: 'POST', url: MATRIX, headers: { ...sessions.SUPERVISOR, origin: WEB_ORIGIN }, payload: {} });
    expect(outcome(post)).toEqual([405, 'METHOD_NOT_ALLOWED']);
    expect(post.headers['allow']).toBe('GET');
    const app = db.appPool();
    for (const statement of [
      "INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'USER_ADMIN')",
      "DELETE FROM public.role_permissions WHERE role_id = 'SUPERVISOR'",
      "UPDATE public.permissions SET sort_order = sort_order + 100",
      "INSERT INTO public.roles (id, sort_order) VALUES ('SUPERVISOR', 9)",
    ]) {
      await expect(app.query(statement)).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('answers what is stored at the moment of the call: a grant that is taken away is gone from the next answer, and back in the one after it is restored', async () => {
    const grants = async (): Promise<number> => ((await guard.app.inject({ method: 'GET', url: MATRIX, headers: sessions.INVESTIGATOR })).json() as { grants: unknown[] }).grants.length;
    expect(await grants()).toBe(18);
    await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'TECHNICIAN' AND permission_id = 'MAINTENANCE'");
    try {
      expect(await grants()).toBe(17);
      // The guard decides on the same tables with the same request: the TECHNICIAN lost the any-of operation.
      expect(outcome(await guard.app.inject({ method: 'POST', url: '/api/v1/storage/policy', headers: { ...sessions.TECHNICIAN, origin: WEB_ORIGIN } }))).toEqual([403, 'NOT_PERMITTED']);
    } finally {
      await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'MAINTENANCE')");
    }
    expect(await grants()).toBe(18);
    expect((await guard.app.inject({ method: 'POST', url: '/api/v1/storage/policy', headers: { ...sessions.TECHNICIAN, origin: WEB_ORIGIN } })).statusCode).toBe(200);
  });

  it('with the engine running: a denial row continues the one chain, reaches the engine as a state change, and the head never diverges', async () => {
    await guard.app.pipeline.drain();
    const before = (await readTrail(owner)).length;
    expect(before).toBeGreaterThanOrEqual(rowsAfterBoot);
    published.length = 0;
    const denied = await guard.app.inject({ method: 'POST', url: '/api/v1/session/SES-20261001-0001/start', headers: { ...sessions.TECHNICIAN, origin: WEB_ORIGIN } });
    expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(denied).details).toEqual({ operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' });
    await guard.app.pipeline.drain();

    const rows = await readTrail(owner);
    expect(rows.slice(before).map((row) => row.type)).toEqual(['ACCESS_DENIED']);
    expect(linkProblems(rows)).toEqual([]);
    const head = await readHead(owner);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
    // The engine took the row into its ring: a client that reads the audit slice sees the refusal.
    expect(guard.app.engine.slice('audit').rows.at(-1)).toMatchObject({ type: 'ACCESS_DENIED', actorId: TECHNICIAN.id, seq: rows.at(-1)?.seq });
    const appended = published.flatMap((publication) => {
      if (publication.kind !== 'state') return [];
      const change = publication.change as { ops?: ReadonlyArray<{ op: string; slice: string; rows?: ReadonlyArray<{ type: string }> }> };
      return (change.ops ?? []).filter((op) => op.op === 'append' && op.slice === 'audit').flatMap((op) => (op.rows ?? []).map((row) => row.type));
    });
    expect(appended).toEqual(['ACCESS_DENIED']);
    expect(guard.log.lines().filter((line) => line['msg'] === 'audit head diverged')).toEqual([]);
    expect((await guard.app.inject({ method: 'GET', url: SESSION, headers: sessions.TECHNICIAN })).statusCode).toBe(200);
  });
});

describe('reloadMatrix: the stored matrix read again', () => {
  /** What a reload rejects with, or null when it passes. */
  const reloadError = (): Promise<unknown> =>
    permissionGuard(guard.app)
      .reloadMatrix()
      .then(
        () => null,
        (thrown: unknown) => thrown,
      );

  it('reads the matrix anew and stamps it; decision D88: a grant that was changed is refused at the reload, by its direction, role and permission, and the last good matrix is kept', async () => {
    const control = permissionGuard(guard.app);
    const good = control.matrix();
    guard.clock.advance(5_000);
    const again = await control.reloadMatrix();
    expect(again.grants).toEqual(good?.grants);
    expect(again.loadedAt).toBe(guard.clock.now());
    expect(control.matrix()).toBe(again);

    // A grant of the shared table that is no longer stored.
    await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'INVESTIGATOR' AND permission_id = 'SESSION_NOTE'");
    try {
      const error = await reloadError();
      expect(error).toBeInstanceOf(AccessRuleError);
      expect(error).toMatchObject({
        code: AccessRuleErrorCode.STORED_GRANTS_MISMATCH,
        problems: [{ code: 'STORED_GRANTS_MISMATCH', operationId: null, route: null, detail: 'missing grant: INVESTIGATOR SESSION_NOTE' }],
      });
      expect(control.matrix()).toBe(again);
    } finally {
      await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('INVESTIGATOR', 'SESSION_NOTE')");
    }
    // A stored grant the shared table lacks.
    await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'USER_ADMIN')");
    try {
      expect(await reloadError()).toMatchObject({
        code: AccessRuleErrorCode.STORED_GRANTS_MISMATCH,
        problems: [{ detail: 'extra grant: TECHNICIAN USER_ADMIN' }],
      });
      expect(control.matrix()).toBe(again);
    } finally {
      await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'TECHNICIAN' AND permission_id = 'USER_ADMIN'");
    }
    // The log line of a refusal holds the code and the three names, and nothing else of the matrix.
    const lines = guard.log.lines().filter((line) => line['msg'] === 'the stored role matrix does not fit the access rules');
    expect(lines.map((line) => [line['level'], line['code'], line['problems']])).toEqual([
      [50, 'STORED_GRANTS_MISMATCH', [{ code: 'STORED_GRANTS_MISMATCH', operationId: null, route: null, detail: 'missing grant: INVESTIGATOR SESSION_NOTE' }]],
      [50, 'STORED_GRANTS_MISMATCH', [{ code: 'STORED_GRANTS_MISMATCH', operationId: null, route: null, detail: 'extra grant: TECHNICIAN USER_ADMIN' }]],
    ]);
    const restored = await control.reloadMatrix();
    expect(restored.grants).toEqual(good?.grants);
  });

  it('the grants assertion is a check at boot and at a reload, not per request: after a grant was changed in the running server, requests are decided by what is stored', async () => {
    const technician = await webOperator(guard, TECHNICIAN.username);
    const policy = { method: 'POST', url: '/api/v1/storage/policy', headers: { ...technician, origin: WEB_ORIGIN } } as const;
    expect((await guard.app.inject(policy)).statusCode).toBe(200);
    await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'TECHNICIAN' AND permission_id = 'MAINTENANCE'");
    try {
      // No reload, no restart: the next request is refused, with its row.
      expect(outcome(await guard.app.inject(policy))).toEqual([403, 'NOT_PERMITTED']);
      // And a reload now would refuse the matrix.
      expect(await reloadError()).toMatchObject({ code: AccessRuleErrorCode.STORED_GRANTS_MISMATCH, problems: [{ detail: 'missing grant: TECHNICIAN MAINTENANCE' }] });
    } finally {
      await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'MAINTENANCE')");
    }
    expect((await guard.app.inject(policy)).statusCode).toBe(200);
    expect(await reloadError()).toBeNull();
  });

  it('keeps the last good matrix when the stored vocabulary no longer fits', async () => {
    const control = permissionGuard(guard.app);
    const restored = await control.reloadMatrix();

    // A permission the server does not know.
    await owner.query("INSERT INTO public.permissions (id, sort_order) VALUES ('WARP_DRIVE', 13)");
    try {
      const error = await control.reloadMatrix().then(
        () => null,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(AccessRuleError);
      expect(error).toMatchObject({
        code: AccessRuleErrorCode.STORED_MATRIX_MISMATCH,
        problems: [{ code: 'STORED_MATRIX_MISMATCH', operationId: null, detail: 'permissions stored and unknown to the server: WARP_DRIVE' }],
      });
      expect(control.matrix()).toBe(restored);
    } finally {
      await owner.query("DELETE FROM public.permissions WHERE id = 'WARP_DRIVE'");
    }
    expect((await control.reloadMatrix()).permissions).toEqual(PERMISSIONS);
  });
});

describe('a boot that the matrix step stops (each on a clone of its own)', () => {
  it('a permission that the rule of a registered route names is not stored: the boot stops at rbac.matrix and names the operation', async () => {
    const { target, database } = await clone('matrix_missing');
    const admin = database.ownerPool();
    await admin.query("DELETE FROM public.role_permissions WHERE permission_id = 'USER_ADMIN'");
    await admin.query("DELETE FROM public.permissions WHERE id = 'USER_ADMIN'");

    const { app, stopped } = await boot(target, { standIns: ['listUsers', 'assignUserRole', 'startSession'] });
    expect(stopped?.stepId).toBe(RBAC_BOOT_STEP);
    expect(passedSteps(app)).toEqual(expect.arrayContaining(STEPS_BEFORE));
    expect(passedSteps(app)).not.toContain(RBAC_BOOT_STEP);
    expect(stopped?.cause).toBeInstanceOf(AccessRuleError);
    // One problem for every registered route whose rule names USER_ADMIN, in the order the
    // routes were registered, then the mismatch of the vocabulary.
    const naming = permissionGuard(app.app)
      .registeredRules()
      .filter((rule) => rule.permissions.includes(Permission.USER_ADMIN));
    expect(naming.map((rule) => rule.operationId)).toEqual(expect.arrayContaining(['listUsers', 'assignUserRole']));
    expect(stopped?.cause).toMatchObject({
      code: AccessRuleErrorCode.PERMISSION_NOT_STORED,
      problems: [
        ...naming.map((rule) => ({ code: 'PERMISSION_NOT_STORED', operationId: rule.operationId, route: `${rule.method} ${rule.url}` })),
        { code: 'STORED_MATRIX_MISMATCH', operationId: null, detail: 'permissions not stored: USER_ADMIN' },
      ],
    });
    const cause = stopped?.cause;
    expect(cause instanceof AccessRuleError ? cause.problems : []).toContainEqual(
      expect.objectContaining({ code: 'PERMISSION_NOT_STORED', operationId: 'listUsers', route: 'GET /api/v1/admin/users' }),
    );
    expect(app.app.server.listening).toBe(false);
    expect(permissionGuard(app.app).matrix()).toBeNull();
    const line = app.log.lines().find((entry) => entry['msg'] === 'the stored role matrix does not fit the access rules');
    expect(line).toMatchObject({ level: 50, code: 'PERMISSION_NOT_STORED' });
  });

  it('a permission that no registered route names is missing: still refused, the stored vocabulary must be exactly the shared one', async () => {
    const { target, database } = await clone('matrix_vocabulary');
    const admin = database.ownerPool();
    await admin.query("DELETE FROM public.role_permissions WHERE permission_id = 'DEMO_CONTROL'");
    await admin.query("DELETE FROM public.permissions WHERE id = 'DEMO_CONTROL'");
    const { app, stopped } = await boot(target);
    expect(stopped?.stepId).toBe(RBAC_BOOT_STEP);
    expect(permissionGuard(app.app).registeredRules().filter((rule) => rule.permissions.includes(Permission.DEMO_CONTROL))).toEqual([]);
    expect(stopped?.cause).toMatchObject({ code: AccessRuleErrorCode.STORED_MATRIX_MISMATCH, problems: [{ detail: 'permissions not stored: DEMO_CONTROL' }] });
  });

  it.each([
    ['one extra grant', "INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('INVESTIGATOR', 'MAINTENANCE')", 'extra grant: INVESTIGATOR MAINTENANCE'],
    ['one missing grant', "DELETE FROM public.role_permissions WHERE role_id = 'SUPERVISOR' AND permission_id = 'EVIDENCE_EXPORT'", 'missing grant: SUPERVISOR EVIDENCE_EXPORT'],
  ])('decision D88: a clone whose grants were changed BEFORE the boot (%s) does not boot: STORED_GRANTS_MISMATCH names the first difference', async (label, change, detail) => {
    const { target, database } = await clone(`matrix_grants_${label.split(' ')[1]}`);
    await database.ownerPool().query(change);

    const { app, stopped } = await boot(target, { standIns: ['listUsers', 'setStoragePolicy'] });
    expect(stopped?.stepId).toBe(RBAC_BOOT_STEP);
    expect(passedSteps(app)).toEqual(expect.arrayContaining(STEPS_BEFORE));
    expect(passedSteps(app)).not.toContain(RBAC_BOOT_STEP);
    expect(stopped?.cause).toBeInstanceOf(AccessRuleError);
    expect(stopped?.cause).toMatchObject({
      code: AccessRuleErrorCode.STORED_GRANTS_MISMATCH,
      problems: [{ code: 'STORED_GRANTS_MISMATCH', operationId: null, route: null, detail }],
    });
    expect(app.app.server.listening).toBe(false);
    expect(permissionGuard(app.app).matrix()).toBeNull();
    // One log line: the code, the direction, the role and the permission; no other grant, no list.
    const lines = app.log.lines().filter((entry) => entry['msg'] === 'the stored role matrix does not fit the access rules');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 50, code: 'STORED_GRANTS_MISMATCH', problems: [{ detail }] });
    expect(JSON.stringify(lines[0])).not.toContain('SESSION_START');
  });

  it('decision D82: a route that was added before the plugins ran passes app.ready() and stops the boot at rbac.matrix, before any listener', async () => {
    const { target } = await clone('matrix_scratch_route');
    const { app, stopped } = await boot(target, {
      topLevel: (instance) => {
        instance.get('/api/v1/scratch', async () => ({ open: true }));
      },
    });
    expect(stopped?.stepId).toBe(RBAC_BOOT_STEP);
    expect(stopped?.cause).toMatchObject({ code: AccessRuleErrorCode.ROUTE_WITHOUT_RULES, problems: [{ route: 'GET /api/v1/scratch', operationId: null }] });
    expect(passedSteps(app)).toEqual(expect.arrayContaining(STEPS_BEFORE));
    expect(passedSteps(app)).not.toContain(RBAC_BOOT_STEP);
    expect(app.app.server.listening).toBe(false);
    // And it is refused at request time all the same.
    expect((await app.app.inject({ method: 'GET', url: '/api/v1/scratch' })).statusCode).toBe(500);
  });

  it('a route that a plugin registers without a rule never gets as far as the boot steps: app.ready() rejects', async () => {
    const { target } = await clone('matrix_plugin_route');
    const app = buildGuardApp(target, { routes: (instance) => instance.get('/api/v1/scratch', async () => ({ open: true })) });
    await expect(app.app.ready()).rejects.toMatchObject({ name: 'AccessRuleError', code: AccessRuleErrorCode.ROUTE_WITHOUT_RULES });
    expect(passedSteps(app)).toEqual([]);
  });
});
