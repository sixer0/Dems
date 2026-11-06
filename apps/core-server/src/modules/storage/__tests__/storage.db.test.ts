// The storage module against PostgreSQL and the REAL engine host (plan row W37; spec §7.11,
// §7.17 member 34, §4.6 RB-2 to RB-4, §8.6; module gate MODG; AC-B-68; rule 2 of the row).
//
// The real app factory on clones of the seed, as `dems_app`, with EVERY stage as the server has
// it: operators sign in with the seeded credential and the access rule reads their grants from
// PostgreSQL with each request. No route is a stand-in. The app is BOOTED as the entry point
// boots it; the engine is on a manual clock and a manual timer, so it ticks only when a test
// fires it, and every count is relative to the trail after the boot (the first start on a fresh
// seed writes one TABLET_LINK_CHANGED row).
//
// No credential is printed: a cookie or a token is taken from an answer and handed on in a header.
import { CORE_API_EXAMPLES, EPOCH_HEADER_NAME, REVISION_HEADER_NAME, validateCoreApiResponse } from '@dems/shared/api';
import { Permission, type AuditRow, type OperatorRole } from '@dems/shared/sim';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { countChanges, engineApp, tableCounts } from '../../../../test/support/engine';
import { ApiFailure } from '../../../plugins/error-envelope';
import { readStoredMatrix } from '../../../plugins/permission-guard';
import { deviceOperator, webOperator, type GuardTarget } from '../../../../test/support/guard';
import { throttleControl } from '../../../plugins/throttle';
import { identityControl } from '../../identity';
import { bearer, cookieValue, insertPairedDevice, webSignIn, type Headers } from '../../../../test/support/identity';
import { storageStatusOf } from '../index';
import {
  CLOCK_START,
  INVESTIGATOR,
  ROLES,
  SUPERVISOR,
  TECHNICIAN,
  WEB_ORIGIN,
  appendedAuditTypes,
  bootedApp,
  errorOf,
  operatorOf,
  outcome,
  type BootedApp,
} from './support';

const db = useTestDatabase({ template: 'seed' });
let booted: BootedApp;
let owner: Pool;
/** The sessions of the three seeded operators on the web console: the cookie header of each. */
let sessions: Record<OperatorRole, Headers>;

const STATUS = '/api/v1/storage/status';
const DETAIL = '/api/v1/storage/detail';
const POLICY = '/api/v1/storage/policy';
const SEEDED_POLICY = { retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true } as const;

interface StoredPolicy {
  readonly retentionPolicy: string;
  readonly retentionDays: number;
  readonly autoArchive: boolean;
  readonly updatedAt: number;
}

/** The one row of `storage_policy`, as `dems_owner`. */
async function storedPolicy(pool: Pick<Pool, 'query'>): Promise<StoredPolicy> {
  const { rows } = await pool.query<{ retention_policy: string; retention_days: number; auto_archive: boolean; updated_at: string }>(
    'SELECT retention_policy, retention_days, auto_archive, updated_at FROM public.storage_policy',
  );
  expect(rows).toHaveLength(1);
  const row = rows[0]!;
  return { retentionPolicy: row.retention_policy, retentionDays: row.retention_days, autoArchive: row.auto_archive, updatedAt: Number(row.updated_at) };
}

/** A request of the web console: the cookie, and for a command the web console `Origin`. */
function web(app: BootedApp, session: Headers, method: 'GET' | 'POST', url: string, payload?: InjectOptions['payload']): Promise<LightMyRequestResponse> {
  return app.app.inject({ method, url, headers: method === 'POST' ? { ...session, origin: WEB_ORIGIN } : session, ...(payload === undefined ? {} : { payload }) });
}

const trailLength = async (pool: Pick<Pool, 'query'> = owner): Promise<number> => (await readTrail(pool)).length;
const since = async (from: number, pool: Pick<Pool, 'query'> = owner): Promise<AuditRow[]> => (await readTrail(pool)).slice(from);

/** Another untouched clone of the seed, as a target for an app of its own. */
async function clone(slug: string): Promise<{ target: GuardTarget; pool: Pool }> {
  const database = await db.another({ slug });
  return { target: { runtime: database.runtime, run: db.run, onCleanup: (close) => database.onCleanup(close) }, pool: database.ownerPool() };
}

async function signInAll(app: BootedApp): Promise<Record<OperatorRole, Headers>> {
  return {
    INVESTIGATOR: await webOperator(app, INVESTIGATOR.username),
    SUPERVISOR: await webOperator(app, SUPERVISOR.username),
    TECHNICIAN: await webOperator(app, TECHNICIAN.username),
  };
}

beforeAll(async () => {
  owner = db.ownerPool();
  booted = await bootedApp(db);
  sessions = await signInAll(booted);
  await booted.app.pipeline.drain();
});

beforeEach(() => {
  throttleControl(booted.app).reset();
  identityControl(booted.app).lockout.reset();
});

describe('the booted server', () => {
  it('runs the real engine on the manual clock, with the seeded policy and no error line', async () => {
    expect(booted.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(booted.engine.running).toBe(true);
    expect(booted.engine.epoch).toBe(1);
    expect(booted.clock.now()).toBe(CLOCK_START);
    expect(booted.engine.slice('storagePolicy')).toEqual(SEEDED_POLICY);
    expect(await storedPolicy(owner)).toMatchObject(SEEDED_POLICY);
    expect(booted.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
    expect(booted.app.server.listening).toBe(false);
  });

  it('the stored matrix decides: SUPERVISOR holds EVIDENCE_REVIEW only, TECHNICIAN holds MAINTENANCE only, INVESTIGATOR holds neither', async () => {
    const { grants } = await readStoredMatrix(owner);
    const holds = (role: OperatorRole, permission: Permission): boolean => grants.some((grant) => grant.role === role && grant.permission === permission);
    expect(ROLES.map((role) => [role, holds(role, Permission.EVIDENCE_REVIEW), holds(role, Permission.MAINTENANCE)])).toEqual([
      ['INVESTIGATOR', false, false],
      ['SUPERVISOR', true, false],
      ['TECHNICIAN', false, true],
    ]);
  });
});

describe('operations 53 and 54: the reads', () => {
  it.each(ROLES)('%s reads the summary and the detail: 200, valid against the contract, equal to the committed state; no row is written', async (role) => {
    const before = await trailLength();
    const status = await web(booted, sessions[role], 'GET', STATUS);
    expect(status.statusCode).toBe(200);
    expect(validateCoreApiResponse('getStorageStatus', 200, status.json())).toEqual({ ok: true });
    // Three references that do not use this module's code: the hosted simulator's own REST answer
    // (what a client gets in Simulated mode), the example the contract gives for the idle dataset,
    // and then the module's projection of the committed state.
    expect(status.json()).toEqual(booted.engine.simulator()?.request({ method: 'GET', path: STATUS }).body);
    expect(status.json()).toEqual(CORE_API_EXAMPLES['getStorageStatus']?.responses?.[200]?.['atLoad']?.value);
    expect(status.json()).toEqual(storageStatusOf(booted.engine.state()));

    const detail = await web(booted, sessions[role], 'GET', DETAIL);
    expect(detail.statusCode).toBe(200);
    expect(validateCoreApiResponse('getStorageDetail', 200, detail.json())).toEqual({ ok: true });
    const state = booted.engine.state();
    expect(detail.json()).toEqual(JSON.parse(JSON.stringify({ storage: state.storage, storagePolicy: state.storagePolicy })));

    await booted.app.pipeline.drain();
    expect(await trailLength()).toBe(before);
    for (const response of [status, detail]) {
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    }
  });

  it('the refusals are the guard\'s: nobody without a session (401, no row), a foreign Origin (403, no row), a retired device (403 with its one row)', async () => {
    const before = await trailLength();
    for (const url of [STATUS, DETAIL]) {
      expect(outcome(await booted.app.inject({ method: 'GET', url }))).toEqual([401, 'NOT_SIGNED_IN']);
      expect(outcome(await booted.app.inject({ method: 'GET', url, headers: { ...sessions.SUPERVISOR, origin: 'http://evil.example' } }))).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    }
    expect(outcome(await booted.app.inject({ method: 'POST', url: POLICY, headers: { origin: WEB_ORIGIN }, payload: { retentionDays: 30 } }))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(await trailLength()).toBe(before);

    await insertPairedDevice(owner, 'DEV-0007', SUPERVISOR.id, booted.clock.now());
    const credential = bearer(booted.devices.pair('DEV-0007'));
    booted.devices.retire('DEV-0007');
    const retired = await booted.app.inject({ method: 'GET', url: DETAIL, headers: credential });
    expect(outcome(retired)).toEqual([403, 'DEVICE_REVOKED']);
    expect(validateCoreApiResponse('getStorageDetail', 403, retired.json())).toEqual({ ok: true });
    await booted.app.pipeline.drain();
    expect((await since(before)).map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['ACCESS_DENIED', null, 'DEV-0007', { operationId: 'getStorageDetail', reason: 'DEVICE_REVOKED' }],
    ]);
  });
});

describe('operation 53 while a recording runs, under a demo fault and with a changed policy (a clone of its own)', () => {
  it('the summary is the hosted simulator\'s own answer in every state: recording, READY, LOW and FULL, and with a changed policy', async () => {
    const { target } = await clone('storage_faults');
    const app = await bootedApp(target);
    const technician = await webOperator(app, TECHNICIAN.username);
    const supervisor = operatorOf('SUPERVISOR');
    type Summary = { state: string; usedPercent: number; usedBytes: number; writeBytesPerSec: number; retention: unknown };
    const read = async (): Promise<Summary> => {
      const response = await web(app, technician, 'GET', STATUS);
      expect(response.statusCode).toBe(200);
      expect(validateCoreApiResponse('getStorageStatus', 200, response.json())).toEqual({ ok: true });
      expect(response.json()).toEqual(app.engine.simulator()?.request({ method: 'GET', path: STATUS }).body);
      return response.json() as Summary;
    };
    expect(await read()).toMatchObject({ state: 'READY', usedPercent: 20, writeBytesPerSec: 0 });

    // A recording, run through the engine (the session operations are another module's; here they
    // only bring the state about): the evidence volume fills second by second.
    const investigator = operatorOf('INVESTIGATOR');
    await app.app.engine.setTabletLink('CONNECTED');
    await app.app.engine.command(investigator, 'createSession', {
      caseNumber: 'LP/2026/1001-0099',
      subjectType: 'SAKSI',
      subjectName: 'Test Subject',
      investigatorId: investigator.operatorId,
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    });
    await app.app.engine.command(investigator, 'beginPrecheck');
    await app.drive(5_000);
    await app.app.engine.command(investigator, 'startRecording');
    expect(app.engine.slice('session')?.state).toBe('RECORDING');
    const used: number[] = [];
    for (let second = 0; second < 4; second += 1) {
      await app.drive(1_000);
      const recording = await read();
      expect(recording.writeBytesPerSec).toBeGreaterThan(0);
      used.push(recording.usedBytes);
    }
    expect(new Set(used).size).toBe(4);
    expect(used).toEqual([...used].sort((a, b) => a - b));
    await app.app.engine.command(investigator, 'stopRecording', 'Interview completed');
    await app.drive(20_000);
    expect(app.engine.slice('session')?.state).toBe('SEALED');
    expect(await read()).toMatchObject({ state: 'READY', writeBytesPerSec: 0 });

    // The demo faults are hosted actions of another module too.
    await app.app.engine.command(supervisor, 'inject', 'STORAGE_LOW');
    const low = await read();
    expect(low.state).toBe('LOW');
    expect(low.usedPercent).toBeGreaterThanOrEqual(85);
    expect((await web(app, technician, 'GET', DETAIL)).json()).toMatchObject({ storage: { state: 'LOW' } });

    await app.app.engine.command(supervisor, 'inject', 'STORAGE_FULL');
    const full = await read();
    expect(full.state).toBe('FULL');
    expect(full.usedPercent).toBeGreaterThanOrEqual(98);

    await app.app.engine.command(supervisor, 'clearFault', 'STORAGE_FULL');
    await app.app.engine.command(supervisor, 'clearFault', 'STORAGE_LOW');
    await app.app.engine.command(supervisor, 'setStoragePolicy', { retentionDays: 1_234, autoArchive: false });
    expect(await read()).toMatchObject({ state: 'READY', retention: { policy: 'DAYS_90', days: 1_234, autoArchive: false } });
  });
});

describe('operation 55 setStoragePolicy: the any-of through the real stages', () => {
  it('a holder of EVIDENCE_REVIEW changes the policy: one STORAGE_POLICY_CHANGED row with the session\'s actor, one event, the stored row, and the revision of the change in the header', async () => {
    booted.clock.advance(60_000);
    await booted.app.pipeline.drain();
    const before = await trailLength();
    const events = (await readEvents(owner)).length;
    const counts = await tableCounts(owner);
    const revision = booted.engine.revision;
    booted.publications.length = 0;

    const response = await web(booted, sessions.SUPERVISOR, 'POST', POLICY, { retentionPolicy: 'YEAR_1' });
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('setStoragePolicy', 200, response.json())).toEqual({ ok: true });
    expect(response.json()).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true });
    await booted.app.pipeline.drain();

    // Exactly one audit row and one event; nothing else was inserted anywhere.
    expect(countChanges(counts, await tableCounts(owner))).toEqual({ audit_log: 1, events: 1 });
    const rows = await since(before);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'STORAGE_POLICY_CHANGED',
      actorId: SUPERVISOR.id,
      deviceId: 'HDD-EVIDENCE',
      sessionId: null,
      at: booted.clock.now(),
      message: 'Retention policy set to YEAR_1 (365 days)',
      details: { retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true },
    });
    expect((await readEvents(owner)).slice(events)).toMatchObject([{ type: 'STORAGE_POLICY_CHANGED', at: booted.clock.now(), params: { retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true } }]);
    // The table: the three values, stamped by the server clock.
    expect(await storedPolicy(owner)).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: true, updatedAt: booted.clock.now() });
    // The committed state of the engine is what the answer held.
    expect(booted.engine.slice('storagePolicy')).toEqual(response.json());

    // API-7: the headers are the epoch and the revision of the ONE published change that holds the effect.
    const changes = booted.publications.flatMap((publication) => (publication.kind === 'state' && publication.change.cause === 'command' ? [publication.change] : []));
    expect(changes).toHaveLength(1);
    expect(changes[0]?.ops).toEqual(expect.arrayContaining([{ op: 'replace', slice: 'storagePolicy', value: response.json() }]));
    expect(appendedAuditTypes(booted.publications)).toEqual(['STORAGE_POLICY_CHANGED']);
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(booted.engine.epoch));
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(changes[0]?.revision));
    expect(changes[0]?.revision).toBe(revision + 1);
    expect(booted.engine.revision).toBe(revision + 1);

    // One chain: the row continues the head, and every stored row verifies.
    const stored = await readTrail(owner);
    expect(linkProblems(stored)).toEqual([]);
    expect(verifyTrail(stored, await readHead(owner))).toMatchObject({ ok: true });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('a holder of MAINTENANCE changes it too, with the same single row under that operator', async () => {
    booted.clock.advance(30_000);
    const before = await trailLength();
    const response = await web(booted, sessions.TECHNICIAN, 'POST', POLICY, { autoArchive: false, retentionDays: 400 });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 400, autoArchive: false });
    await booted.app.pipeline.drain();
    expect((await since(before)).map((row) => [row.type, row.actorId, row.at, row.details])).toEqual([
      ['STORAGE_POLICY_CHANGED', TECHNICIAN.id, booted.clock.now(), { retentionPolicy: 'YEAR_1', retentionDays: 400, autoArchive: false }],
    ]);
    expect(await storedPolicy(owner)).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 400, autoArchive: false, updatedAt: booted.clock.now() });
  });

  it('a holder of neither is refused by the guard, before the body is read: 403 and one ACCESS_DENIED row that names both permissions as one code; the policy stays', async () => {
    const policy = await storedPolicy(owner);
    for (const payload of [{ retentionPolicy: 'DAYS_30' }, { retentionDays: 0 }, undefined]) {
      const before = await trailLength();
      const denied = await web(booted, sessions.INVESTIGATOR, 'POST', POLICY, payload);
      expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(denied).details).toEqual({ operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'INVESTIGATOR' });
      expect(validateCoreApiResponse('setStoragePolicy', 403, denied.json())).toEqual({ ok: true });
      expect(denied.headers[REVISION_HEADER_NAME]).toBeUndefined();
      await booted.app.pipeline.drain();
      const rows = await since(before);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'ACCESS_DENIED',
        severity: 'WARNING',
        actorId: INVESTIGATOR.id,
        deviceId: null,
        message: 'Access denied: role INVESTIGATOR holds none of EVIDENCE_REVIEW, MAINTENANCE (setStoragePolicy)',
        details: { operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'INVESTIGATOR' },
      });
    }
    expect(await storedPolicy(owner)).toEqual(policy);
    expect(booted.engine.slice('storagePolicy')).toMatchObject({ retentionPolicy: policy.retentionPolicy, retentionDays: policy.retentionDays });
  });

  it('a body that changes nothing answers 200 with the policy and writes nothing: no row, no event, no publication, the same revision', async () => {
    const current = booted.engine.slice('storagePolicy');
    const policy = await storedPolicy(owner);
    booted.clock.advance(15_000);
    await booted.app.pipeline.drain();
    const counts = await tableCounts(owner);
    const revision = booted.engine.revision;
    booted.publications.length = 0;
    for (const payload of [{}, { ...current }, undefined]) {
      const response = await web(booted, sessions.SUPERVISOR, 'POST', POLICY, payload);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(current);
      expect(response.headers[REVISION_HEADER_NAME]).toBe(String(revision));
      expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(booted.engine.epoch));
    }
    await booted.app.pipeline.drain();
    expect(countChanges(counts, await tableCounts(owner))).toEqual({});
    expect(booted.publications.filter((publication) => publication.kind === 'state' && publication.change.cause === 'command')).toEqual([]);
    // Not even the time of the row moved.
    expect(await storedPolicy(owner)).toEqual(policy);
  });

  it('422 INVALID_INPUT for a value outside the bounds: nothing is written and the engine is not asked', async () => {
    const policy = await storedPolicy(owner);
    const before = await trailLength();
    const commands = booted.engine.stats().commands;
    for (const payload of [{ retentionDays: 0 }, { retentionDays: 3_651 }, { retentionPolicy: 'FOREVER' }, { autoArchive: 'no' }]) {
      const response = await web(booted, sessions.TECHNICIAN, 'POST', POLICY, payload);
      expect(outcome(response)).toEqual([422, 'INVALID_INPUT']);
      expect(validateCoreApiResponse('setStoragePolicy', 422, response.json())).toEqual({ ok: true });
    }
    const invalidJson = await booted.app.inject({ method: 'POST', url: POLICY, headers: { ...sessions.TECHNICIAN, origin: WEB_ORIGIN, 'content-type': 'application/json' }, payload: '[30]' });
    expect(outcome(invalidJson)).toEqual([400, 'INVALID_JSON']);
    await booted.app.pipeline.drain();
    expect(await trailLength()).toBe(before);
    expect(await storedPolicy(owner)).toEqual(policy);
    expect(booted.engine.stats().commands).toBe(commands);
  });

  it('the bounds are the simulator\'s on the real host too: asked directly, the hosted action refuses 0 days with 422 and its own code, and nothing is stored', async () => {
    const policy = await storedPolicy(owner);
    const before = await trailLength();
    const revision = booted.engine.revision;
    const refusal = await booted.app.engine.command(operatorOf('SUPERVISOR'), 'setStoragePolicy', { retentionDays: 0 }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refusal).toBeInstanceOf(ApiFailure);
    expect(refusal).toMatchObject({ statusCode: 422, code: 'INVALID_INPUT', details: { simCode: 'POLICY_RANGE', event: 'setStoragePolicy' } });
    await booted.app.pipeline.drain();
    expect(await trailLength()).toBe(before);
    expect(await storedPolicy(owner)).toEqual(policy);
    expect(booted.engine.revision).toBe(revision);
    expect(booted.engine.simulator()?.store.getState().auth.operatorId).toBeNull();
  });

  it('an operator on a paired device changes the policy with the bearer session and no Origin; the row names that operator', async () => {
    await insertPairedDevice(owner, 'DEV-0001', SUPERVISOR.id, booted.clock.now());
    const onDevice = await deviceOperator(booted, booted.devices.pair('DEV-0001'), TECHNICIAN.username);
    booted.clock.advance(10_000);
    await booted.app.pipeline.drain();
    const before = await trailLength();
    const response = await booted.app.inject({ method: 'POST', url: POLICY, headers: onDevice, payload: { retentionPolicy: 'DAYS_30' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ retentionPolicy: 'DAYS_30', retentionDays: 30 });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect((await booted.app.inject({ method: 'GET', url: STATUS, headers: onDevice })).json()).toMatchObject({ retention: { policy: 'DAYS_30', days: 30 } });
    expect((await booted.app.inject({ method: 'GET', url: DETAIL, headers: onDevice })).statusCode).toBe(200);
    await booted.app.pipeline.drain();
    expect((await since(before)).map((row) => [row.type, row.actorId, row.deviceId])).toEqual([['STORAGE_POLICY_CHANGED', TECHNICIAN.id, 'HDD-EVIDENCE']]);
  });
});

describe('the stored matrix decides, request by request (a test-only change of role_permissions in the clone, as dems_owner)', () => {
  it('a TECHNICIAN whose role loses MAINTENANCE holds neither: refused by the guard with one row; with the grant back, allowed again', async () => {
    const policy = await storedPolicy(owner);
    await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'TECHNICIAN' AND permission_id = 'MAINTENANCE'");
    try {
      const before = await trailLength();
      const denied = await web(booted, sessions.TECHNICIAN, 'POST', POLICY, { retentionDays: 77 });
      expect(outcome(denied)).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(denied).details).toEqual({ operationId: 'setStoragePolicy', permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE', role: 'TECHNICIAN' });
      await booted.app.pipeline.drain();
      expect((await since(before)).map((row) => [row.type, row.actorId])).toEqual([['ACCESS_DENIED', TECHNICIAN.id]]);
      expect(await storedPolicy(owner)).toEqual(policy);
    } finally {
      await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('TECHNICIAN', 'MAINTENANCE')");
    }
    const allowed = await web(booted, sessions.TECHNICIAN, 'POST', POLICY, { retentionDays: 77 });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({ retentionDays: 77 });
  });

  it('finding F-W37-1: a stored grant the shared table does not have passes the guard and is refused by the hosted action itself: 403 with the simulator\'s code, no row, nothing changed', async () => {
    const policy = await storedPolicy(owner);
    await owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('INVESTIGATOR', 'MAINTENANCE')");
    try {
      const before = await trailLength();
      const response = await web(booted, sessions.INVESTIGATOR, 'POST', POLICY, { retentionDays: 55 });
      expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
      // Not the guard's answer: the simulator's, mapped by the engine host (spec §7.2).
      expect(errorOf(response).details).toEqual({ simCode: 'NOT_PERMITTED', permission: 'EVIDENCE_REVIEW | MAINTENANCE' });
      expect(validateCoreApiResponse('setStoragePolicy', 403, response.json())).toEqual({ ok: true });
      await booted.app.pipeline.drain();
      expect(await since(before)).toEqual([]);
      expect(await storedPolicy(owner)).toEqual(policy);
    } finally {
      await owner.query("DELETE FROM public.role_permissions WHERE role_id = 'INVESTIGATOR' AND permission_id = 'MAINTENANCE'");
    }
    expect(outcome(await web(booted, sessions.INVESTIGATOR, 'POST', POLICY, { retentionDays: 55 }))).toEqual([403, 'NOT_PERMITTED']);
  });
});

describe('a policy change is durable: it is there after the engine stopped, the app closed and a new app started on the same database', () => {
  it('the policy, its STORAGE_POLICY_CHANGED row and the chain are what the first process left; the next change continues the chain', async () => {
    const { target, pool } = await clone('storage_restart');
    const first = await bootedApp(target);
    const supervisor = await webOperator(first, SUPERVISOR.username);
    first.clock.advance(120_000);
    const changed = await web(first, supervisor, 'POST', POLICY, { retentionPolicy: 'CASE_CLOSURE', autoArchive: false });
    expect(changed.statusCode).toBe(200);
    const policy = changed.json() as Record<string, unknown>;
    expect(policy).toEqual({ retentionPolicy: 'CASE_CLOSURE', retentionDays: 3_650, autoArchive: false });
    const changedAt = first.clock.now();
    await first.app.pipeline.drain();
    const row = (await readTrail(pool)).at(-1);
    expect(row).toMatchObject({ type: 'STORAGE_POLICY_CHANGED', actorId: SUPERVISOR.id, at: changedAt });
    const firstEpoch = first.engine.epoch;

    // The process ends: the engine stops, the app closes (the pool with it).
    first.clock.advance(30_000);
    await first.engine.stop();
    expect(outcome(await web(first, supervisor, 'POST', POLICY, { retentionDays: 10 }))).toEqual([503, 'NOT_READY']);
    expect(outcome(await web(first, supervisor, 'GET', STATUS))).toEqual([503, 'NOT_READY']);
    expect(outcome(await web(first, supervisor, 'GET', DETAIL))).toEqual([503, 'NOT_READY']);
    await first.app.close();
    const trailAtStop = await readTrail(pool);
    const stoppedAt = first.clock.now();

    // A new app on the same database, 90 s later on its own clock.
    const second = await bootedApp(target, { startAt: stoppedAt + 90_000 });
    expect(second.app).not.toBe(first.app);
    expect(second.engine.epoch).toBe(firstEpoch + 1);
    expect(second.engine.slice('storagePolicy')).toEqual(policy);
    expect(await storedPolicy(pool)).toEqual({ ...policy, updatedAt: changedAt });

    // Through the API, with a new session of another role.
    const technician = await webOperator(second, TECHNICIAN.username);
    const detail = await web(second, technician, 'GET', DETAIL);
    expect(detail.statusCode).toBe(200);
    expect((detail.json() as { storagePolicy: unknown }).storagePolicy).toEqual(policy);
    expect(validateCoreApiResponse('getStorageDetail', 200, detail.json())).toEqual({ ok: true });
    expect((await web(second, technician, 'GET', STATUS)).json()).toMatchObject({ retention: { policy: 'CASE_CLOSURE', days: 3_650, autoArchive: false } });

    // The audit row is the stored one, unchanged, and it is in the ring the new engine rehydrated.
    await second.app.pipeline.drain();
    const trail = await readTrail(pool);
    expect(trail.slice(0, trailAtStop.length)).toEqual(trailAtStop);
    expect(trail.filter((candidate) => candidate.type === 'STORAGE_POLICY_CHANGED')).toEqual([row]);
    expect(second.engine.slice('audit').rows.find((candidate) => candidate.seq === row?.seq)).toEqual(row);
    // The restart itself changed nothing of the policy: the rows after the stop are the new sign-in's.
    expect(trail.slice(trailAtStop.length).map((candidate) => candidate.type)).toEqual(['AUTH_SUCCESS']);
    expect(linkProblems(trail)).toEqual([]);
    expect(verifyTrail(trail, await readHead(pool))).toMatchObject({ ok: true });

    // The next change continues the same chain, in the new epoch.
    second.clock.advance(5_000);
    const again = await web(second, technician, 'POST', POLICY, { retentionPolicy: 'DAYS_90', autoArchive: true });
    expect(again.statusCode).toBe(200);
    expect(again.headers[EPOCH_HEADER_NAME]).toBe(String(firstEpoch + 1));
    await second.app.pipeline.drain();
    const after = await readTrail(pool);
    expect(after.at(-1)).toMatchObject({ type: 'STORAGE_POLICY_CHANGED', actorId: TECHNICIAN.id, at: second.clock.now(), prevHash: trail.at(-1)?.hash, seq: trail.length + 1 });
    expect(verifyTrail(after, await readHead(pool))).toMatchObject({ ok: true });
    expect(await storedPolicy(pool)).toEqual({ retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true, updatedAt: second.clock.now() });
    expect(second.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });
});

describe('measured: the statements of one command (M13)', () => {
  it('a policy change is ONE transaction of the pipeline; an unchanged policy sends the unit\'s frame and no write', async () => {
    const database = await db.another({ slug: 'storage_round_trips' });
    const host = await engineApp({ runtime: database.runtime, onCleanup: (close) => database.onCleanup(close) }, db.run.dataDir, { startAt: CLOCK_START, logLevel: 'info' });
    await host.app.readiness.boot();
    await host.engine.idle();
    const signedIn = await webSignIn(host.app, SUPERVISOR.username);
    expect(signedIn.statusCode).toBe(200);
    const token = cookieValue(signedIn, host.app.config.sessionCookieName);
    const session: Headers = { cookie: `${host.app.config.sessionCookieName}=${token ?? ''}`, origin: WEB_ORIGIN };
    await host.app.pipeline.drain();

    const short = (text: string): string => text.replace(/\s+/g, ' ').slice(0, 72);

    // A change.
    host.clock.advance(1_000);
    let mark = host.database.statements.length;
    const changed = await host.app.inject({ method: 'POST', url: POLICY, headers: session, payload: { retentionPolicy: 'YEAR_1' } });
    expect(changed.statusCode).toBe(200);
    await host.app.pipeline.drain();
    const changeStatements = host.database.statements.slice(mark);
    for (const text of changeStatements) console.info(`[w37]   a change: ${short(text)}`);
    // The last transaction of the request is the command's unit.
    const lastUnit = (statements: readonly string[]): string[] => statements.slice(statements.findLastIndex((text) => /^BEGIN\b/.test(text)));
    const commandUnit = lastUnit(changeStatements);
    expect(commandUnit[0]).toMatch(/^BEGIN\b/);
    expect(commandUnit.filter((text) => /^BEGIN\b/.test(text))).toHaveLength(1);
    expect(commandUnit.at(-1)).toBe('COMMIT');
    expect(commandUnit.filter((text) => /update "storage_policy"/i.test(text))).toHaveLength(1);
    expect(commandUnit.filter((text) => /insert into "audit_log"/i.test(text))).toHaveLength(1);
    expect(commandUnit.filter((text) => /insert into "events"/i.test(text))).toHaveLength(1);
    console.info(`[w37] round trips of POST /api/v1/storage/policy (a change): ${changeStatements.length} statements in the request, ${commandUnit.length} in the command's transaction`);

    // No change.
    mark = host.database.statements.length;
    const same = await host.app.inject({ method: 'POST', url: POLICY, headers: session, payload: { retentionPolicy: 'YEAR_1' } });
    expect(same.statusCode).toBe(200);
    await host.app.pipeline.drain();
    const sameStatements = host.database.statements.slice(mark);
    const sameUnit = lastUnit(sameStatements);
    expect(sameUnit.filter((text) => /storage_policy|audit_log|"events"/i.test(text))).toEqual([]);
    expect(sameUnit.at(-1)).toBe('COMMIT');
    console.info(`[w37] round trips of POST /api/v1/storage/policy (unchanged): ${sameStatements.length} statements in the request, ${sameUnit.length} in the command's transaction`);
    for (const text of sameStatements) console.info(`[w37]   unchanged: ${short(text)}`);

    // The reads send no statement of their own: the committed state is in memory.
    mark = host.database.statements.length;
    expect((await host.app.inject({ method: 'GET', url: STATUS, headers: { cookie: session['cookie'] ?? '' } })).statusCode).toBe(200);
    expect((await host.app.inject({ method: 'GET', url: DETAIL, headers: { cookie: session['cookie'] ?? '' } })).statusCode).toBe(200);
    const readStatements = host.database.statements.slice(mark);
    console.info(`[w37] round trips of the two reads: ${readStatements.length} statements on a pipeline connection (the session lookup of stage 4 runs on the pool)`);
    expect(readStatements.filter((text) => /storage_policy|hardware_snapshot/i.test(text))).toEqual([]);
  });
});
