// Operations 64 to 68 against PostgreSQL and the REAL engine (plan row W40; module gate MODG;
// spec §7.2, §7.3, §7.14, §7.17, §13.2; SR-82, AC-B-89; engine host finding F-11).
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has
// it: nothing of the request pipeline is replaced. The engine is booted and runs on a manual
// clock and a manual timer, so it ticks exactly when a test fires it. The three seeded operators
// are signed in on the web console with the seeded credential; a request carries the cookie, a
// command also the web console `Origin`. What is stored is read as `dems_owner`.
//
// Every count is relative to the trail AFTER the boot and the three sign-ins (the first start on
// a fresh seed writes a row of its own). No credential is printed.
//
// A session is opened through hosted commands of the engine (`app.engine.command`): the session
// routes are another module's. What a command does over time is in `effects.db.test.ts`.
import { EPOCH_HEADER_NAME, REVISION_HEADER_NAME, validateCoreApiResponse } from '@dems/shared/api';
import {
  DEFAULT_SETTINGS,
  SERVICES_RESTART_SCOPE,
  createRngStreams,
  restartServicesTransition,
  runDiagnosticsTransition,
  startSoftwareUpdateTransition,
  verifyAuditChain,
  type AuditRow,
  type OperatorRole,
  type SettingsSlice,
  type SimState,
} from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { actorAuth } from '../../../engine';
import { CORE_SERVER_VERSION } from '../../../version';
import { countChanges, storedSlices, tableCounts } from '../../../../test/support/engine';
import { FOREIGN_ORIGIN } from '../../../../test/support/identity';
import { SETTINGS_CHANGED_MESSAGE } from '../index';
import {
  DIAGNOSTICS,
  ROLES,
  SERVICES_RESTART,
  SETTINGS,
  SYSTEM_STATUS,
  servicesAsRead,
  UPDATE,
  bodyOf,
  bootedServer,
  errorOf,
  linesWith,
  memberNames,
  outcome,
  ownMembers,
  stringValues,
  whole,
  type BootedServer,
  type LogLine,
  type ServerTarget,
} from './support';

// On a loaded host a database test can pass the runner's default limit: a cap, not a wait.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed' });
let server: BootedServer;

beforeAll(async () => {
  server = await bootedServer(db);
});

const wire = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;
const operatorId = (role: OperatorRole): string => server.principal(role).operatorId;
const denials = (rows: readonly AuditRow[]): AuditRow[] => rows.filter((row) => row.type === 'ACCESS_DENIED');
const SETTINGS_KEYS = ['notifySound', 'notifyWarnings', 'presentationMode', 'timeFormat'] as const;

/** Another clone of the seed with a booted server of its own. */
async function anotherServer(slug: string): Promise<{ target: ServerTarget; server: BootedServer }> {
  const clone = await db.another({ template: 'seed', slug });
  const target: ServerTarget = { runtime: clone.runtime, run: db.run, onCleanup: (close) => clone.onCleanup(close), ownerPool: () => clone.ownerPool() };
  return { target, server: await bootedServer(target) };
}

interface StoredSettings extends SettingsSlice {
  readonly updatedAt: number;
}

/** The one row of `console_settings`, as `dems_owner`. */
async function storedSettings(owner: Pool): Promise<StoredSettings> {
  const { rows } = await owner.query<{ presentation_mode: boolean; time_format: '24' | '12'; notify_warnings: boolean; notify_sound: boolean; updated_at: string }>(
    'SELECT presentation_mode, time_format, notify_warnings, notify_sound, updated_at FROM public.console_settings',
  );
  expect(rows).toHaveLength(1);
  const row = rows[0];
  if (row === undefined) throw new Error('console_settings has no row');
  return { presentationMode: row.presentation_mode, timeFormat: row.time_format, notifyWarnings: row.notify_warnings, notifySound: row.notify_sound, updatedAt: Number(row.updated_at) };
}

/** The lines the log gained while `work` ran. */
async function logged(on: BootedServer, work: () => Promise<unknown>): Promise<LogLine[]> {
  const before = on.log.lines().length;
  await work();
  return on.log.lines().slice(before);
}

const settingsLines = (lines: readonly LogLine[]): LogLine[] => lines.filter((line) => line['msg'] === SETTINGS_CHANGED_MESSAGE);

/** What the tables hold equals the committed state of the engine, and the stored chain verifies. */
async function expectStoredEqualsCommitted(on: BootedServer): Promise<void> {
  await on.app.pipeline.drain();
  expect(await storedSlices(on.owner)).toStrictEqual(withoutNegativeZeros(on.engine.state()));
  const rows = await readTrail(on.owner);
  const head = await readHead(on.owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
  expect(on.engine.slice('audit')).toMatchObject({ total: head.seq, head: head.hash });
  expect(verifyAuditChain(on.engine.slice('audit'))).toMatchObject({ ok: true });
}

describe('the booted server', () => {
  it('is ready with a running engine on the manual timer, listens on no port, and holds the idle seed', () => {
    expect(server.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(server.engine.running).toBe(true);
    expect(server.timer.active()).toBe(1);
    expect(server.app.server.listening).toBe(false);
    expect(server.engine.slice('session')).toBeNull();
    expect(server.engine.slice('diagnostics')).toBeNull();
    expect(server.engine.slice('update')).toMatchObject({ state: 'IDLE', currentVersion: '2.4.1', availableVersion: '2.5.0', activeSlot: 'A' });
    expect(server.engine.slice('services')).toHaveLength(17);
    expect(server.engine.slice('settings')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('operation 64 getSystemStatus', () => {
  it.each(ROLES)('%s reads the five slices of the committed state: 200, valid against the contract', async (role) => {
    const response = await server.get(role, SYSTEM_STATUS);
    expect(response.statusCode).toBe(200);
    // The expectation is the five slices themselves, picked here: not the module's own projection.
    const { device, services, update, diagnostics, settings } = server.engine.state();
    // Row 62 (CS-10): two entries of `services` stand for real processes and are laid over the slice by the read.
    expect(response.json()).toEqual(wire({ device, services: servicesAsRead(services, server.app), update, diagnostics, settings, components: (response.json() as { components: unknown }).components }));
    expect((response.json() as { components: { core: { version: string } } }).components.core.version).toBe(CORE_SERVER_VERSION);
    expect(validateCoreApiResponse('getSystemStatus', 200, response.json())).toEqual({ ok: true });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('what the read answers is what the tables hold: the five slices equal the stored ones', async () => {
    await server.app.pipeline.drain();
    const stored = await storedSlices(server.owner);
    const answer = (await server.get('TECHNICIAN', SYSTEM_STATUS)).json() as Record<string, unknown>;
    for (const slice of ['device', 'update', 'diagnostics', 'settings'] as const) expect(answer[slice], slice).toEqual(wire(stored[slice]));
    // Row 62 (CS-10): `services` is the stored slice with the capture worker and the transcriber laid over it; the tables keep the engine's.
    expect(answer['services']).toEqual(wire(servicesAsRead(stored.services, server.app)));
    expect(answer['services']).not.toEqual(wire(stored.services));
    expect(await storedSettings(server.owner)).toMatchObject(DEFAULT_SETTINGS);
  });

  it('the read opens no unit of work, sends no statement, writes no row and publishes nothing', async () => {
    await server.app.pipeline.drain();
    const before = { rows: await server.trailLength(), statements: server.database.statements.length, publications: server.publications.length, revision: server.engine.revision };
    for (const role of ROLES) expect((await server.get(role, SYSTEM_STATUS)).statusCode).toBe(200);
    await server.app.pipeline.drain();
    expect({ rows: await server.trailLength(), statements: server.database.statements.length, publications: server.publications.length, revision: server.engine.revision }).toEqual(before);
  });

  it('nobody without a session reads it: 401 NOT_SIGNED_IN, and no row', async () => {
    const before = await server.trailLength();
    const response = await server.get(null, SYSTEM_STATUS);
    expect(outcome(response)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('getSystemStatus', 401, response.json())).toEqual({ ok: true });
    expect(await server.trailLength()).toBe(before);
  });
});

describe('operation 68 updateSettings: no audit row, one log line (SR-82, AC-B-89)', () => {
  it.each([
    ['INVESTIGATOR', { timeFormat: '12' }, ['timeFormat']],
    ['SUPERVISOR', { presentationMode: true, notifySound: true }, ['notifySound', 'presentationMode']],
    ['TECHNICIAN', { notifyWarnings: false, timeFormat: '24', presentationMode: true }, ['notifyWarnings', 'timeFormat']],
  ] as const)('%s changes settings: 200 with the committed slice, the stored row, ONE published change, NO audit row, NO event, and exactly ONE log line with the operator ID and the changed names', async (role, body, changedKeys) => {
    server.clock.advance(30_000);
    await server.app.pipeline.drain();
    const expected = { ...server.engine.slice('settings'), ...body };
    const counts = await tableCounts(server.owner);
    const trail = await server.trailLength();
    const events = (await readEvents(server.owner)).length;
    const revision = server.engine.revision;
    const publications = server.publications.length;

    let status = 0;
    let answer: unknown;
    let headers: Record<string, unknown> = {};
    const lines = await logged(server, async () => {
      const response = await server.post(role, SETTINGS, body);
      status = response.statusCode;
      answer = response.json();
      headers = response.headers;
      await server.app.pipeline.drain();
    });
    expect(status).toBe(200);
    expect(answer).toEqual(expected);
    expect(validateCoreApiResponse('updateSettings', 200, answer)).toEqual({ ok: true });

    // Durable: the committed slice and the one row of the kept table, stamped by the server clock.
    expect(server.engine.slice('settings')).toEqual(expected);
    expect(await storedSettings(server.owner)).toEqual({ ...expected, updatedAt: server.clock.now() });

    // NO audit row and no event: not one row was inserted anywhere.
    expect(await server.trailLength()).toBe(trail);
    expect((await readEvents(server.owner)).length).toBe(events);
    expect(countChanges(counts, await tableCounts(server.owner))).toEqual({});

    // API-7: ONE published change, a replacement of the `settings` slice, and its revision in the header.
    const changes = server.publications.slice(publications).flatMap((publication) => (publication.kind === 'state' ? [publication.change] : []));
    expect(changes.map((change) => [change.cause, change.ops.map((op) => [op.op, op.slice])])).toEqual([['command', [['replace', 'settings']]]]);
    expect(changes[0]?.revision).toBe(revision + 1);
    expect(headers[REVISION_HEADER_NAME]).toBe(String(revision + 1));
    expect(headers[EPOCH_HEADER_NAME]).toBe(String(server.engine.epoch));

    // EXACTLY ONE line of the module, with the operator ID and the names, and the request's ID.
    const own = settingsLines(lines);
    expect(own).toHaveLength(1);
    expect(ownMembers(own[0] ?? {})).toEqual({ operatorId: operatorId(role), changedKeys: [...changedKeys] });
    expect(own[0]?.['level']).toBe(30);
    const requestLine = lines.find((line) => line['msg'] === 'request completed');
    expect(requestLine).toMatchObject({ route: SETTINGS, status: 200, principal: `operator:${operatorId(role)}` });
    expect(own[0]?.['reqId']).toBe(requestLine?.['reqId']);
    // No value of a setting in any line of the call: no member is named after a setting, no line
    // holds the body, the slice or the patch, and the time format is in no string.
    for (const key of SETTINGS_KEYS) expect([...memberNames(lines)], key).not.toContain(key);
    for (const member of ['body', 'settings', 'patch', 'value', 'values', 'before', 'after']) expect([...memberNames(lines)], member).not.toContain(member);
    expect(lines.flatMap((line) => stringValues(line)).filter((value) => value === '12' || value === '24')).toEqual([]);
    expect(Object.values(ownMembers(own[0] ?? {})).filter((value) => typeof value === 'boolean')).toEqual([]);
    console.info(`[w40] updateSettings by ${role}: 200; audit rows +0, events +0, tables +{}; published ${JSON.stringify(changes.map((change) => change.ops.map((op) => `${op.op} ${op.slice}`)))}; log line ${JSON.stringify(ownMembers(own[0] ?? {}))} "${String(own[0]?.['msg'])}" level ${String(own[0]?.['level'])}`);
  });

  it.each([
    ['the values the settings already have', 'same'],
    ['an empty object', {}],
    ['only a key the settings do not have', { theme: 'w40-dark-value' }],
  ] as const)('a call that changes nothing (%s): 200 with the settings as they are, no statement of a write, no publication, no row, NO line', async (_name, given) => {
    await server.app.pipeline.drain();
    const current = server.engine.slice('settings');
    const body = given === 'same' ? { ...current } : given;
    const before = { rows: await server.trailLength(), publications: server.publications.length, revision: server.engine.revision, stored: await storedSettings(server.owner) };
    let status = 0;
    let answer: unknown;
    const lines = await logged(server, async () => {
      const response = await server.post('SUPERVISOR', SETTINGS, body);
      status = response.statusCode;
      answer = response.json();
      expect(response.headers[REVISION_HEADER_NAME]).toBe(String(before.revision));
      await server.app.pipeline.drain();
    });
    expect(status).toBe(200);
    expect(answer).toEqual(current);
    expect(server.engine.slice('settings')).toBe(current);
    expect({ rows: await server.trailLength(), publications: server.publications.length, revision: server.engine.revision, stored: await storedSettings(server.owner) }).toEqual(before);
    expect(settingsLines(lines)).toEqual([]);
    expect(JSON.stringify(lines)).not.toContain('w40-dark-value');
  });

  it.each([
    ['a text for a switch', { presentationMode: 'yes' }],
    ['a time format that does not exist', { timeFormat: 'w40-bad-format' }],
    ['a number for the time format', { timeFormat: 12 }],
  ] as const)('a wrong type or value (%s) is refused by the contract\'s schema: 422 INVALID_INPUT, nothing changed, no row, NO line', async (_name, body) => {
    await server.app.pipeline.drain();
    const before = { rows: await server.trailLength(), revision: server.engine.revision, settings: server.engine.slice('settings'), stored: await storedSettings(server.owner) };
    const lines = await logged(server, async () => {
      const response = await server.post('TECHNICIAN', SETTINGS, body);
      expect(outcome(response)).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(response).details).toMatchObject({ in: 'body' });
      expect(validateCoreApiResponse('updateSettings', 422, response.json())).toEqual({ ok: true });
      expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
      await server.app.pipeline.drain();
    });
    expect({ rows: await server.trailLength(), revision: server.engine.revision, settings: server.engine.slice('settings'), stored: await storedSettings(server.owner) }).toEqual(before);
    expect(settingsLines(lines)).toEqual([]);
    expect(JSON.stringify(lines)).not.toContain('w40-bad-format');
  });

  it('nobody without a session changes a setting: 401, nothing changed, no row, NO line', async () => {
    const before = { rows: await server.trailLength(), settings: server.engine.slice('settings') };
    const lines = await logged(server, async () => {
      const response = await server.post(null, SETTINGS, { timeFormat: '12' });
      expect(outcome(response)).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse('updateSettings', 401, response.json())).toEqual({ ok: true });
      await server.app.pipeline.drain();
    });
    expect({ rows: await server.trailLength(), settings: server.engine.slice('settings') }).toEqual(before);
    expect(settingsLines(lines)).toEqual([]);
  });

  it('two consoles change DIFFERENT settings at the same time: each call has its own line with its own name, and both changes are stored', async () => {
    await server.post('SUPERVISOR', SETTINGS, { ...DEFAULT_SETTINGS });
    await server.app.pipeline.drain();
    const trail = await server.trailLength();
    const lines = await logged(server, async () => {
      const [first, second] = await Promise.all([server.post('INVESTIGATOR', SETTINGS, { timeFormat: '12' }), server.post('TECHNICIAN', SETTINGS, { notifySound: true })]);
      expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
      await server.app.pipeline.drain();
    });
    expect(server.engine.slice('settings')).toEqual({ ...DEFAULT_SETTINGS, timeFormat: '12', notifySound: true });
    expect(await storedSettings(server.owner)).toMatchObject({ ...DEFAULT_SETTINGS, timeFormat: '12', notifySound: true });
    const own = settingsLines(lines).map(ownMembers);
    expect(own).toHaveLength(2);
    expect(own).toEqual(
      expect.arrayContaining([
        { operatorId: operatorId('INVESTIGATOR'), changedKeys: ['timeFormat'] },
        { operatorId: operatorId('TECHNICIAN'), changedKeys: ['notifySound'] },
      ]),
    );
    expect(await server.trailLength()).toBe(trail);
  });

  it('three consoles set the SAME setting to the same value at the same time: one of them changed it, so there is exactly ONE line', async () => {
    await server.post('SUPERVISOR', SETTINGS, { ...DEFAULT_SETTINGS });
    await server.app.pipeline.drain();
    const revision = server.engine.revision;
    const lines = await logged(server, async () => {
      const responses = await Promise.all(ROLES.map((role) => server.post(role, SETTINGS, { presentationMode: true })));
      expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200]);
      for (const response of responses) expect(response.json()).toEqual({ ...DEFAULT_SETTINGS, presentationMode: true });
      await server.app.pipeline.drain();
    });
    const own = settingsLines(lines).map(ownMembers);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ changedKeys: ['presentationMode'] });
    expect(ROLES.map(operatorId)).toContain(own[0]?.['operatorId']);
    expect(server.engine.revision).toBe(revision + 1);
    console.info(`[w40] three simultaneous updateSettings with the same value: 200, 200, 200; one unit changed the setting; log lines of the module: ${own.length} (${JSON.stringify(own[0])})`);
  });

  it('measured: the statements of one updateSettings', async () => {
    await server.post('SUPERVISOR', SETTINGS, { ...DEFAULT_SETTINGS });
    server.clock.advance(5_000);
    await server.app.pipeline.drain();
    const measure = async (body: Partial<SettingsSlice>): Promise<string[]> => {
      const from = server.database.statements.length;
      expect((await server.post('SUPERVISOR', SETTINGS, body)).statusCode).toBe(200);
      await server.app.pipeline.drain();
      return server.database.statements.slice(from);
    };
    const changed = await measure({ timeFormat: '12' });
    const unchanged = await measure({ timeFormat: '12' });
    const short = (text: string): string => text.replace(/\s+/g, ' ').slice(0, 70);
    console.info(`[w40] statements of POST /api/v1/settings, a change (${changed.length}):\n${changed.map(short).join('\n')}`);
    console.info(`[w40] statements of POST /api/v1/settings, unchanged (${unchanged.length}):\n${unchanged.map(short).join('\n')}`);
    expect(changed.filter((text) => /update "console_settings"/i.test(text))).toHaveLength(1);
    expect(changed.filter((text) => /insert into "(audit_log|events)"/i.test(text))).toEqual([]);
    expect(unchanged.filter((text) => /^(update|insert|delete)\b/i.test(text.trim()) && !/auth_sessions/.test(text))).toEqual([]);
    expect(changed.filter((text) => text === 'COMMIT').length).toBeGreaterThanOrEqual(1);
  });

  it('engine host F-11: the hosted action `setPresentationMode`, which shares operation 68, runs against PostgreSQL through the same seam: the stored row moves, and no row is written', async () => {
    await server.post('SUPERVISOR', SETTINGS, { ...DEFAULT_SETTINGS });
    await server.app.pipeline.drain();
    const trail = await server.trailLength();
    const outcomeOf = await server.engine.command(server.principal('INVESTIGATOR'), 'setPresentationMode', true);
    await server.app.pipeline.drain();
    expect(outcomeOf.value).toBeUndefined();
    expect(server.engine.slice('settings')).toEqual({ ...DEFAULT_SETTINGS, presentationMode: true });
    expect(await storedSettings(server.owner)).toMatchObject({ ...DEFAULT_SETTINGS, presentationMode: true });
    expect(await server.trailLength()).toBe(trail);
    // The route gives the same state with the action that takes any member.
    await server.post('SUPERVISOR', SETTINGS, { presentationMode: false });
    const viaRoute = await server.post('INVESTIGATOR', SETTINGS, { presentationMode: true });
    expect(viaRoute.json()).toEqual({ ...DEFAULT_SETTINGS, presentationMode: true });
  });
});

describe('operation 65 runDiagnostics', () => {
  it('a run by each role in turn: 202 with the run ID; while it is in progress another caller gets the same ID and nothing is written; the stored row is the shared transition\'s, hash for hash', async () => {
    server.clock.advance(10_000);
    await server.app.pipeline.drain();
    const at = server.clock.now();
    const principal = server.principal('INVESTIGATOR');
    const committed = server.engine.state();
    // The simulator's own transition on what the server holds, with this caller as the actor and
    // the engine's random streams (its seed and its epoch; no run has drawn from them yet).
    const built = runDiagnosticsTransition({ ...committed, auth: actorAuth(principal.operatorId, at) } as SimState, at, createRngStreams(committed.meta.seed, server.engine.epoch));
    const expectedRow = built.state.audit.rows.at(-1);
    if (expectedRow === undefined) throw new Error('the transition appended no row');

    const trail = await server.trailLength();
    const revision = server.engine.revision;
    const response = await server.post('INVESTIGATOR', DIAGNOSTICS);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ runId: built.runId });
    expect(validateCoreApiResponse('runDiagnostics', 202, response.json())).toEqual({ ok: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(revision + 1));
    await server.app.pipeline.drain();
    const stored = await server.since(trail);
    expect(stored.map(whole)).toEqual([whole(expectedRow)]);
    expect(stored[0]).toMatchObject({ type: 'DIAGNOSTICS_RUN', actorId: principal.operatorId, at, details: { runId: built.runId, checks: 8 } });
    // The run itself: check for check and instant for instant what the transition scheduled.
    expect(server.engine.slice('diagnostics')).toEqual(built.state.diagnostics);
    expect((await storedSlices(server.owner)).diagnostics).toEqual(built.state.diagnostics);

    // In progress: the same ID for another caller, no row, no revision.
    await server.drive(500);
    const again = await server.post('SUPERVISOR', DIAGNOSTICS);
    expect(again.statusCode).toBe(202);
    expect(again.json()).toEqual({ runId: built.runId });
    await server.app.pipeline.drain();
    expect((await server.since(trail)).map((row) => row.type)).toEqual(['DIAGNOSTICS_RUN']);

    // Completed: the next caller starts the next run under its own name.
    await server.drive(6_000, 250);
    expect(server.engine.slice('diagnostics')?.completedAt).not.toBeNull();
    const next = await server.post('TECHNICIAN', DIAGNOSTICS);
    expect(next.statusCode).toBe(202);
    expect((next.json() as { runId: string }).runId).not.toBe(built.runId);
    await server.app.pipeline.drain();
    expect((await server.since(trail)).map((row) => [row.type, row.actorId])).toEqual([
      ['DIAGNOSTICS_RUN', operatorId('INVESTIGATOR')],
      ['DIAGNOSTICS_RUN', operatorId('TECHNICIAN')],
    ]);
    await server.drive(6_000, 250);
    console.info(`[w40] runDiagnostics: 202 ${JSON.stringify(response.json())}; stored row = the shared transition's (seq ${expectedRow.seq}, hash ${expectedRow.hash.slice(0, 12)}…); in progress: the same ID, no row; after completion a new run ${JSON.stringify(next.json())}`);
  });
});

describe('operations 66 restartServices and 67 startSoftwareUpdate: who may call', () => {
  it.each([
    ['restartServices', SERVICES_RESTART],
    ['startSoftwareUpdate', UPDATE],
  ] as const)('%s: INVESTIGATOR and SUPERVISOR are refused by the guard with 403 NOT_PERMITTED and ONE ACCESS_DENIED row each; nothing else is written and nothing changed', async (operationId, url) => {
    server.clock.advance(61_000);
    await server.app.pipeline.drain();
    const before = { trail: await server.trailLength(), revision: server.engine.revision, services: server.engine.slice('services'), update: server.engine.slice('update') };
    for (const role of ['INVESTIGATOR', 'SUPERVISOR'] as const) {
      const response = await server.post(role, url);
      expect(outcome(response), role).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(response).details, role).toMatchObject({ permission: 'MAINTENANCE' });
      expect(validateCoreApiResponse(operationId, 403, response.json()), role).toEqual({ ok: true });
    }
    await server.app.pipeline.drain();
    const rows = await server.since(before.trail);
    expect(rows.map((row) => [row.type, row.actorId, row.details['operationId'], row.details['permission']])).toEqual([
      ['ACCESS_DENIED', operatorId('INVESTIGATOR'), operationId, 'MAINTENANCE'],
      ['ACCESS_DENIED', operatorId('SUPERVISOR'), operationId, 'MAINTENANCE'],
    ]);
    expect(server.engine.slice('services')).toBe(before.services);
    expect(server.engine.slice('update')).toBe(before.update);
  });

  it('66: a TECHNICIAN restarts the services: 200 with 17; the stored DEVICE_COMMAND row is the shared transition\'s, hash for hash; every service started now, in the tables too', async () => {
    server.clock.advance(5_000);
    await server.app.pipeline.drain();
    const at = server.clock.now();
    const principal = server.principal('TECHNICIAN');
    const committed = server.engine.state();
    const built = restartServicesTransition({ ...committed, auth: actorAuth(principal.operatorId, at) } as SimState, at);
    const expectedRow = built.state.audit.rows.at(-1);
    if (expectedRow === undefined) throw new Error('the transition appended no row');
    const trail = await server.trailLength();
    const revision = server.engine.revision;

    const response = await server.post('TECHNICIAN', SERVICES_RESTART);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ restarted: built.result });
    expect(response.json()).toEqual({ restarted: 17 });
    expect(validateCoreApiResponse('restartServices', 200, response.json())).toEqual({ ok: true });
    expect(response.headers[REVISION_HEADER_NAME]).toBe(String(revision + 1));
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(server.engine.epoch));
    await server.app.pipeline.drain();

    const stored = await server.since(trail);
    expect(stored.map(whole)).toEqual([whole(expectedRow)]);
    expect(stored[0]).toMatchObject({ type: 'DEVICE_COMMAND', actorId: principal.operatorId, at, details: { command: 'RESTART', scope: SERVICES_RESTART_SCOPE, services: 17 } });
    expect(server.engine.slice('services')).toEqual(built.state.services);
    expect(server.engine.slice('services').map((service) => service.startedAt)).toEqual(Array.from({ length: 17 }, () => at));
    expect((await storedSlices(server.owner)).services).toEqual(built.state.services);
    expect(denials(stored)).toEqual([]);
  });

  it('67: a TECHNICIAN starts the update: 202 without a body; the stored UPDATE_STARTED row and the schedule of the six steps are the shared transition\'s; a second call changes nothing', async () => {
    server.clock.advance(5_000);
    await server.app.pipeline.drain();
    const at = server.clock.now();
    const principal = server.principal('TECHNICIAN');
    const committed = server.engine.state();
    const built = startSoftwareUpdateTransition({ ...committed, auth: actorAuth(principal.operatorId, at) } as SimState, at, createRngStreams(committed.meta.seed, server.engine.epoch));
    const expectedRow = built.audit.rows.at(-1);
    if (expectedRow === undefined) throw new Error('the transition appended no row');
    const trail = await server.trailLength();
    const events = (await readEvents(server.owner)).length;

    const response = await server.post('TECHNICIAN', UPDATE);
    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
    expect(validateCoreApiResponse('startSoftwareUpdate', 202, bodyOf(response))).toEqual({ ok: true });
    await server.app.pipeline.drain();
    const stored = await server.since(trail);
    expect(stored.map(whole)).toEqual([whole(expectedRow)]);
    expect(stored[0]).toMatchObject({ type: 'UPDATE_STARTED', actorId: principal.operatorId, at, details: { from: '2.4.1', to: '2.5.0', targetSlot: 'B' } });
    expect((await readEvents(server.owner)).slice(events).map((event) => event.type)).toEqual(['UPDATE_STARTED']);
    expect(server.engine.slice('update')).toEqual(built.update);
    expect((await storedSlices(server.owner)).update).toEqual(built.update);

    const revision = server.engine.revision;
    const again = await server.post('TECHNICIAN', UPDATE);
    expect(again.statusCode).toBe(202);
    expect(again.headers[REVISION_HEADER_NAME]).toBe(String(revision));
    await server.app.pipeline.drain();
    expect(await server.trailLength()).toBe(trail + 1);
  });
});

describe('the four commands from an origin that is not the web console\'s', () => {
  it('403 ORIGIN_NOT_ALLOWED at stage 3 for each, valid against the contract; no row, nothing changed, no line of the module', async () => {
    await server.app.pipeline.drain();
    const before = { rows: await server.trailLength(), revision: server.engine.revision, state: server.engine.state() };
    const lines = await logged(server, async () => {
      for (const [operationId, url, payload] of [
        ['runDiagnostics', DIAGNOSTICS, undefined],
        ['restartServices', SERVICES_RESTART, undefined],
        ['startSoftwareUpdate', UPDATE, undefined],
        ['updateSettings', SETTINGS, { presentationMode: false, timeFormat: '24' }],
      ] as const) {
        const response = await server.app.inject({ method: 'POST', url, headers: { ...server.sessions.TECHNICIAN, origin: FOREIGN_ORIGIN }, ...(payload === undefined ? {} : { payload }) });
        expect(outcome(response), operationId).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
        expect(validateCoreApiResponse(operationId, 403, response.json()), operationId).toEqual({ ok: true });
      }
      await server.app.pipeline.drain();
    });
    expect({ rows: await server.trailLength(), revision: server.engine.revision, state: server.engine.state() }).toEqual(before);
    expect(server.engine.state()).toBe(before.state);
    expect(settingsLines(lines)).toEqual([]);
  });
});

describe('restartServices and startSoftwareUpdate while a session is open', () => {
  const SESSION_INPUT = {
    caseNumber: 'LP/2026/1001-0099',
    subjectType: 'SAKSI',
    subjectName: 'Test Subject',
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  } as const;

  let busy: BootedServer;

  beforeAll(async () => {
    busy = (await anotherServer('w40_session')).server;
  });

  /** Both commands are refused with the simulator's code, and nothing at all moved. */
  async function expectBothRefused(from: string): Promise<void> {
    await busy.app.pipeline.drain();
    const technician = busy.principal('TECHNICIAN').operatorId;
    const before = { rows: await busy.trailLength(), revision: busy.engine.revision, state: busy.engine.state() };
    for (const [operationId, url] of [
      ['restartServices', SERVICES_RESTART],
      ['startSoftwareUpdate', UPDATE],
    ] as const) {
      const response = await busy.post('TECHNICIAN', url);
      expect(outcome(response), `${operationId} from ${from}`).toEqual([409, 'SESSION_ACTIVE']);
      expect(errorOf(response).details, `${operationId} from ${from}`).toEqual({ simCode: 'SESSION_ACTIVE', from, event: operationId });
      expect(validateCoreApiResponse(operationId, 409, response.json()), `${operationId} from ${from}`).toEqual({ ok: true });
      expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
      expect(response.headers[EPOCH_HEADER_NAME]).toBeUndefined();
    }
    await busy.app.pipeline.drain();
    // Nothing was written and nothing moved: no row names the TECHNICIAN, the session is as it was.
    expect({ rows: await busy.trailLength(), revision: busy.engine.revision }).toEqual({ rows: before.rows, revision: before.revision });
    expect(busy.engine.state()).toBe(before.state);
    expect((await busy.since(busy.rowsAtStart)).filter((row) => row.actorId === technician)).toEqual([]);
    expect(busy.engine.slice('update').state).toBe('IDLE');
    // Nobody is left signed in on the engine after the refusals (ENG-7, AC-B-53).
    expect(busy.engine.simulator()?.store.getState().auth).toMatchObject({ status: 'SIGNED_OUT', operatorId: null });
  }

  it('409 SESSION_ACTIVE with the simulator\'s code in every state of an open session: CREATE, PRECHECK, ARMED, RECORDING, and while it stops and finalises; no row, no revision', async () => {
    const investigator = busy.principal('INVESTIGATOR');
    const seen: string[] = [];
    const check = async (): Promise<void> => {
      const state = String(busy.engine.slice('session')?.state);
      seen.push(state);
      await expectBothRefused(state);
    };
    // Before a session exists both would run: asserted at the end, on the sealed session.
    await busy.engine.setTabletLink('CONNECTED');
    const created = await busy.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
    expect(created.value).toMatchObject({ ok: true, created: true });
    await check();
    await busy.engine.command(investigator, 'beginPrecheck');
    await check();
    await busy.drive(5_000);
    if (busy.engine.slice('session')?.state === 'PRECHECK') await busy.engine.command(investigator, 'acknowledgePrecheckWarnings');
    await check();
    await busy.engine.command(investigator, 'startRecording');
    await busy.drive(1_000);
    await check();
    await busy.engine.command(investigator, 'stopRecording', 'End of the interview');
    await check();
    expect(seen.slice(0, 4)).toEqual(['CREATE', 'PRECHECK', 'ARMED', 'RECORDING']);
    expect(['STOPPING', 'FINALIZING']).toContain(seen[4]);
    console.info(`[w40] restartServices and startSoftwareUpdate with an open session: 409 SESSION_ACTIVE, details { simCode: SESSION_ACTIVE, from: <state>, event: <action> }, from ${seen.join(', ')}; no row, no revision`);
  });

  it('once the session is SEALED it blocks nothing: the services restart (200) and the update starts (202), each with its row', async () => {
    await busy.drive(25_000, 250);
    expect(busy.engine.slice('session')?.state).toBe('SEALED');
    await busy.app.pipeline.drain();
    const trail = await busy.trailLength();
    const restarted = await busy.post('TECHNICIAN', SERVICES_RESTART);
    expect(restarted.statusCode).toBe(200);
    expect(restarted.json()).toEqual({ restarted: 17 });
    const started = await busy.post('TECHNICIAN', UPDATE);
    expect(started.statusCode).toBe(202);
    await busy.app.pipeline.drain();
    expect((await busy.since(trail)).map((row) => [row.type, row.actorId])).toEqual([
      ['DEVICE_COMMAND', busy.principal('TECHNICIAN').operatorId],
      ['UPDATE_STARTED', busy.principal('TECHNICIAN').operatorId],
    ]);
    expect(busy.engine.slice('session')?.state).toBe('SEALED');
    await expectStoredEqualsCommitted(busy);
  });
});

describe('a settings change is durable (the kept table `console_settings`)', () => {
  it('it is present after `engine.stop()`, `app.close()` and a new app on the same clone; no audit row was ever written for it; the new process changes it again with its own line', async () => {
    const { target, server: first } = await anotherServer('w40_restart');
    first.clock.advance(20_000);
    const changed: SettingsSlice = { presentationMode: true, timeFormat: '12', notifyWarnings: false, notifySound: true };
    const changedAt = first.clock.now();
    const firstLines = await logged(first, async () => {
      expect((await first.post('SUPERVISOR', SETTINGS, changed)).json()).toEqual(changed);
      await first.app.pipeline.drain();
    });
    expect(settingsLines(firstLines).map(ownMembers)).toEqual([{ operatorId: first.principal('SUPERVISOR').operatorId, changedKeys: [...SETTINGS_KEYS] }]);
    expect(await storedSettings(first.owner)).toEqual({ ...changed, updatedAt: changedAt });
    const epoch = first.engine.epoch;

    // The stop: every operation of the module answers 503, and the app is closed.
    await first.engine.stop();
    expect(outcome(await first.get('SUPERVISOR', SYSTEM_STATUS))).toEqual([503, 'NOT_READY']);
    for (const url of [DIAGNOSTICS, SERVICES_RESTART, UPDATE]) expect(outcome(await first.post('TECHNICIAN', url)), url).toEqual([503, 'NOT_READY']);
    const refused = await logged(first, async () => {
      expect(outcome(await first.post('TECHNICIAN', SETTINGS, { timeFormat: '24' }))).toEqual([503, 'NOT_READY']);
    });
    expect(settingsLines(refused)).toEqual([]);
    const trailAtStop = await readTrail(first.owner);
    await first.app.close();
    expect(await storedSettings(first.owner)).toEqual({ ...changed, updatedAt: changedAt });

    // A new process on the same database, 90 s later on its clock.
    const second = await bootedServer(target, { startAt: first.clock.now() + 90_000 });
    expect(second.engine.epoch).toBe(epoch + 1);
    expect(second.engine.slice('settings')).toEqual(changed);
    expect(await storedSettings(second.owner)).toEqual({ ...changed, updatedAt: changedAt });
    const read = await second.get('TECHNICIAN', SYSTEM_STATUS);
    expect(read.statusCode).toBe(200);
    expect((read.json() as { settings: SettingsSlice }).settings).toEqual(changed);
    expect(validateCoreApiResponse('getSystemStatus', 200, read.json())).toEqual({ ok: true });

    // The trail up to the stop is byte-equal, and no row of either process is about a setting.
    const trail = await readTrail(second.owner);
    expect(trail.slice(0, trailAtStop.length)).toEqual(trailAtStop);
    expect(trail.filter((row) => /setting/i.test(`${row.type} ${row.message}`))).toEqual([]);

    // The new process changes a setting: its own line, the stored row at its own clock, still no audit row.
    second.clock.advance(1_000);
    const length = await second.trailLength();
    const secondLines = await logged(second, async () => {
      const response = await second.post('INVESTIGATOR', SETTINGS, { presentationMode: false });
      expect(response.json()).toEqual({ ...changed, presentationMode: false });
      await second.app.pipeline.drain();
    });
    expect(settingsLines(secondLines).map(ownMembers)).toEqual([{ operatorId: second.principal('INVESTIGATOR').operatorId, changedKeys: ['presentationMode'] }]);
    expect(await storedSettings(second.owner)).toEqual({ ...changed, presentationMode: false, updatedAt: second.clock.now() });
    expect(await second.trailLength()).toBe(length);
    await expectStoredEqualsCommitted(second);
    console.info(`[w40] settings across a restart: epoch ${epoch} -> ${second.engine.epoch}; console_settings ${JSON.stringify(changed)} with updated_at unchanged; audit rows about settings: 0; a change in the new process logged ${JSON.stringify(settingsLines(secondLines).map(ownMembers))}`);
  });
});

describe('the end state of the file\'s server', () => {
  it('what the tables hold is the committed state, the chain verifies, and no line of level error was written', async () => {
    await expectStoredEqualsCommitted(server);
    const rows = await server.since(server.rowsAtStart);
    const byType: Record<string, number> = {};
    for (const row of rows) byType[row.type] = (byType[row.type] ?? 0) + 1;
    // No row of this file is about a setting: the settings were changed many times.
    expect(Object.keys(byType).sort()).toEqual(['ACCESS_DENIED', 'DEVICE_COMMAND', 'DIAGNOSTICS_RUN', 'UPDATE_STARTED']);
    const lines = server.log.lines();
    expect(lines.filter((line) => line['msg'] === 'audit head diverged')).toEqual([]);
    expect(lines.filter((line) => Number(line['level']) >= 50)).toEqual([]);
    console.info(`[w40] rows written by this file after boot and sign-in: ${JSON.stringify(byType)}; settings lines: ${linesWith(server.log, SETTINGS_CHANGED_MESSAGE).length}; stored = committed; chain ok over ${(await readTrail(server.owner)).length} rows`);
  });
});
