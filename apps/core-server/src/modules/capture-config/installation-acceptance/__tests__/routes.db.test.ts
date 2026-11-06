// Operations 109 and 110 on a booted Core, as `dems_app`, against PostgreSQL (task 4 blueprint
// row 117, WP-26b; contract `packages/shared/src/api/installation-acceptance.ts`, row 116; schema
// set C, row 114; decisions U10, U11, C2, C61 (2), C80; security finding S13-13).
//
// WHAT IS REAL: the app factory with every stage (stage 6 enforces CAPTURE_COMMISSION and
// `WEB_CONSOLE_SESSION`), booted as the entry point boots it on a throw-away clone of the seed; the
// two routes; the two statements as the runtime role (the grants of migration 0025); the table with
// its in-force index and its CHECKs; the engine's unit of work and the audit chain; the Core's own
// diagnostics run, started by the hosted action and ended by the engine's ticks.
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the Core               SIMULATED capture: a Core that has the table stores the record as any
//                          Core does (the contract's point 7). Not proven here: a production Core's
//                          diagnostics run, whose texts and `params` come from real devices.
//   the clock and the timer  moved by this file, so that a run ends when the test says so.
//   a failing store        the folder's own store with a failure after its statement, or with a
//                          document the route would never send - put in through `replaceForTest`.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INSTALLATION_ACCEPTANCE_STEP_IDS, validateCoreApiResponse } from '@dems/shared/api';
import { OPERATORS, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { readTrail } from '../../../../../test/support/core';
import { manualTimer } from '../../../../../test/support/engine';
import { buildGuardApp, deviceOperator, webOperator, type GuardApp } from '../../../../../test/support/guard';
import { CLOCK_START, WEB_ORIGIN, insertPairedDevice, type Headers } from '../../../../../test/support/identity';
import { captureFenceControl } from '../../../../capture/fence';
import { engineControl } from '../../../../engine';
import type { Principal } from '../../../../plugins/authenticate';
import { throttleControl } from '../../../../plugins/throttle';
import { CORE_SERVER_VERSION } from '../../../../version';
import { identityControl } from '../../../identity';
import { installationAcceptanceControl } from '../../index';
import { createInstallationAcceptanceStore, isInForceViolation, type AcceptanceWrite, type InstallationAcceptanceStore, type Queryable } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row117' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row117-db-'));
const logDir = mkdtempSync(join(tmpdir(), 'dems-row117-log-'));
const errorLogFile = join(logDir, 'errors.log');

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const TECHNICIAN = OPERATORS[2]!;
const TABLET = 'DEV-0117';
const ACCEPT = '/api/v1/installation/acceptance';
const REVOKE = '/api/v1/installation/acceptance/revoke';
/** THE CONTRACT'S CLOSED LIST (row V6, R119-07): every check once - one failed with its reason, the others passed. */
const STEPS = INSTALLATION_ACCEPTANCE_STEP_IDS.map((id) => (id === '9A/H-11' ? { id, result: 'FAIL', detail: 'Microphone 2 was left out on purpose.' } : { id, result: 'PASS', detail: null }));
const ADDRESS = 'Example street 117\nExample city';
const REASON = 'The Core was moved to another room.';
/** Every text an operator typed in this file: none may be in an audit row, a log line or a refusal. */
const TYPED = /Microphone 2|Example street|moved to another room|row117-not-a-secret/;

let guard: GuardApp;
let owner: Pool;
let fire: () => void;
let supervisor: Headers;
let technician: Headers;
let investigator: Headers;
let technicianOnTablet: Headers;
const realStore = createInstallationAcceptanceStore();

async function post(url: string, session: Headers | null, payload: unknown): Promise<LightMyRequestResponse> {
  const headers = session === null ? { origin: WEB_ORIGIN } : { ...session, ...('cookie' in session ? { origin: WEB_ORIGIN } : {}) };
  const response = await guard.app.inject({ method: 'POST', url, headers: { ...headers, ...(typeof payload === 'string' ? { 'content-type': 'application/json' } : {}) }, payload: payload as object });
  await guard.app.pipeline.drain();
  return response;
}
const accept = (session: Headers | null, payload: unknown = { steps: STEPS }): Promise<LightMyRequestResponse> => post(ACCEPT, session, payload);
const revoke = (session: Headers | null, payload: unknown = { reason: REASON }): Promise<LightMyRequestResponse> => post(REVOKE, session, payload);
const errorOf = (response: LightMyRequestResponse): { code?: string; details?: Record<string, unknown> } => (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error ?? {};
const reasonOf = (response: LightMyRequestResponse): [number, unknown, unknown] => [response.statusCode, errorOf(response).code, errorOf(response).details?.['reason'] ?? null];
const trail = (): Promise<AuditRow[]> => readTrail(owner);
const since = async (from: number): Promise<AuditRow[]> => (await trail()).slice(from);
const ownTypes = (rows: readonly AuditRow[]): string[] => rows.map((row) => row.type).filter((type) => type.startsWith('INSTALLATION_'));
/** The table as the owner reads it, oldest first. */
async function stored(): Promise<Record<string, unknown>[]> {
  const { rows } = await owner.query(
    'SELECT id, accepted_at::float8 AS accepted_at, accepted_by, software_version, core_device_id, site_name, room, site_address, steps, diagnostics, ' +
      'revoked_at::float8 AS revoked_at, revoked_by, revoke_reason FROM public.installation_acceptances ORDER BY accepted_at, id',
  );
  return rows as Record<string, unknown>[];
}
const inForce = async (): Promise<number> => (await stored()).filter((row) => row['revoked_at'] === null).length;
const errorLog = (): string => {
  try {
    return readFileSync(errorLogFile, 'utf8');
  } catch {
    return '';
  }
};
/** Moves the server clock and lets the engine tick, until `ms` have passed. */
async function drive(ms: number, stepMs = 250): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    guard.clock.advance(stepMs);
    fire();
    await engineControl(guard.app).idle();
  }
  await guard.app.pipeline.drain();
}
/** A connection of this file as the store takes one. */
const on = (connection: Pick<Pool, 'query'>): Queryable => ({ query: (text, values) => connection.query(text, values) });
const principalOf =(operator: (typeof OPERATORS)[number]): Principal => ({ kind: 'OPERATOR', operatorId: operator.id, sessionId: `row117-${operator.id}`, deviceId: null, role: operator.role }) as Principal;
const run = (): { id: string; completedAt: number | null } | null => guard.app.engine.state().diagnostics;

beforeAll(async () => {
  owner = db.ownerPool();
  guard = buildGuardApp({ runtime: db.runtime, run: { dataDir }, onCleanup: (close) => db.onCleanup(close) }, { errorLogFile, logLevel: 'trace' });
  await guard.app.ready();
  const manual = manualTimer();
  fire = manual.fire;
  engineControl(guard.app).useTimer(manual.timer);
  await guard.app.readiness.boot();
  await engineControl(guard.app).idle();

  await insertPairedDevice(owner, TABLET, TECHNICIAN.id, CLOCK_START);
  const tablet = guard.devices.pair(TABLET);
  supervisor = await webOperator(guard, SUPERVISOR.username);
  technician = await webOperator(guard, TECHNICIAN.username);
  investigator = await webOperator(guard, INVESTIGATOR.username);
  technicianOnTablet = await deviceOperator(guard, tablet, TECHNICIAN.username);
  await guard.app.pipeline.drain();
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(logDir, { recursive: true, force: true });
});

beforeEach(() => {
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
  installationAcceptanceControl(guard.app).replaceForTest({ store: realStore });
});

describe('the Core this file runs on, and who may accept', () => {
  it('after the boot: the runtime role, simulated capture, an empty table and no diagnostics run', async () => {
    expect(((await guard.app.db.pool.query('SELECT current_user AS role')).rows[0] as { role: string }).role).toBe('dems_app');
    expect(captureFenceControl(guard.app).operation).toBe('SIMULATED');
    expect(await stored()).toEqual([]);
    expect(run()).toBeNull();
  });

  it('RBAC: 401 without a session; 403 for INVESTIGATOR and SUPERVISOR; 403 WEB_CONSOLE_ONLY for the TECHNICIAN on a tablet - ONE ACCESS_DENIED row each, before the body is used, nothing stored', async () => {
    for (const [operationId, url, payload] of [
      ['acceptInstallation', ACCEPT, { steps: STEPS }],
      ['revokeInstallationAcceptance', REVOKE, { reason: REASON }],
    ] as const) {
      expect((await post(url, null, payload)).statusCode, operationId).toBe(401);
      for (const [session, operator] of [
        [investigator, INVESTIGATOR],
        [supervisor, SUPERVISOR],
      ] as const) {
        const from = (await trail()).length;
        const denied = await post(url, session, payload);
        expect([denied.statusCode, errorOf(denied).code, errorOf(denied).details?.['permission']], `${operationId} ${operator.role}`).toEqual([403, 'NOT_PERMITTED', 'CAPTURE_COMMISSION']);
        const rows = await since(from);
        expect(rows.map((row) => row.type), `${operationId} ${operator.role}`).toEqual(['ACCESS_DENIED']);
        expect(rows[0], `${operationId} ${operator.role}`).toMatchObject({ actorId: operator.id, details: { operationId, permission: 'CAPTURE_COMMISSION' } });
      }
      const from = (await trail()).length;
      expect(reasonOf(await post(url, technicianOnTablet, payload)), operationId).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      const rows = await since(from);
      expect(rows.map((row) => row.type), operationId).toEqual(['ACCESS_DENIED']);
      expect(rows[0], operationId).toMatchObject({ actorId: TECHNICIAN.id, deviceId: TABLET, details: { operationId, reason: 'WEB_CONSOLE_ONLY' } });
      // A body that is no JSON: the refusal is the same, before the body is used.
      expect(reasonOf(await post(url, technicianOnTablet, '{"steps": ['))).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      expect((await post(url, supervisor, '{"steps": [')).statusCode).toBe(403);
    }
    expect(await stored()).toEqual([]);
    expect(ownTypes(await trail())).toEqual([]);
  });
});

describe('operation 109 on the database: every refusal stores nothing and writes no entry', () => {
  it('400 for a body that is no JSON; 422 BY THE ROUTE, before any statement, for a denied key name in a step, in the body and at depth, for a member outside the list, the Core\'s own facts, 33 steps, a text of two lines and steps that are too large together; the refusals quote nothing', async () => {
    const from = (await trail()).length;
    expect((await accept(technician, '{"steps": [')).statusCode).toBe(400);
    // Row V6 (R119-07): a body names EVERY check of the contract's list once. `listWith` is that whole list with one
    // step in the place of its first check, so that each refusal below is refused for ITS reason, not for a short list.
    const step = { id: STEPS[0]!.id, result: 'PASS', detail: null };
    const listWith = (first: unknown): unknown[] => [first, ...STEPS.slice(1)];
    // The control: the whole list is past the route's schema (here it meets the next refusal - no diagnostics run has ended).
    expect(reasonOf(await accept(technician, { steps: listWith(step) }))).toEqual([409, 'INVALID_STATE', 'INSTALLATION_DIAGNOSTICS_NOT_COMPLETE']);
    const outside: readonly unknown[] = [
      {},
      { steps: 'none' },
      { steps: listWith({ ...step, password: 'row117-not-a-secret' }) },
      { steps: listWith({ ...step, code: 'X1' }) },
      { steps: listWith({ ...step, token: 'row117-not-a-secret' }) },
      { steps: STEPS, credential: { username: 'admin', secret: 'row117-not-a-secret' } },
      { steps: listWith({ ...step, detail: { password: 'row117-not-a-secret' } }) },
      { steps: listWith({ id: step.id, result: { nested: { token: 'row117-not-a-secret' } }, detail: null }) },
      { steps: listWith({ ...step, note: 'x' }) },
      { steps: listWith({ id: 'cameras assigned', result: 'PASS', detail: null }) },
      { steps: STEPS, diagnostics: { id: 'DIAG-000001', startedAt: 1, completedAt: 2, checks: [] } },
      { steps: STEPS, acceptedBy: 'OPR-001' },
      { steps: STEPS, softwareVersion: '9.9.9' },
      { steps: Array.from({ length: 33 }, (_unused, index) => ({ id: STEPS[index % STEPS.length]!.id, result: 'PASS', detail: null })) },
      { steps: listWith({ ...step, detail: 'Microphone 2\nsecond line' }) },
      { steps: listWith({ ...step, detail: 'x'.repeat(201) }) },
      { steps: STEPS.map((listed) => ({ id: listed.id, result: 'PASS', detail: '\u{1F600}'.repeat(200) })) },
      { steps: STEPS, siteAddress: '' },
      { steps: STEPS, siteAddress: 'x'.repeat(501) },
      // THE STEP LIST IS THE CONTRACT'S: what a client of the first contract could send, and what the list refuses.
      { steps: [] },
      { steps: [{ id: 'CAMERAS_ASSIGNED', passed: true, detail: null }] },
      { steps: listWith({ id: 'CAMERAS_ASSIGNED', result: 'PASS', detail: null }) },
      { steps: listWith({ id: '9A/H-28', result: 'PASS', detail: null }) },
      { steps: listWith({ id: step.id, passed: true, detail: null }) },
      { steps: STEPS.slice(1) },
      { steps: listWith(STEPS[1]) },
      { steps: [...STEPS, step] },
      { steps: listWith({ ...step, result: 'OK' }) },
      { steps: listWith({ ...step, result: 'FAIL', detail: null }) },
      { steps: listWith({ ...step, result: 'NOT_RUN', detail: ' ' }) },
    ];
    for (const payload of outside) {
      const response = await accept(technician, payload);
      expect([response.statusCode, errorOf(response).code], JSON.stringify(payload).slice(0, 90)).toEqual([422, 'INVALID_INPUT']);
      expect(response.body, JSON.stringify(payload).slice(0, 90)).not.toMatch(TYPED);
    }
    expect(await stored()).toEqual([]);
    expect(await since(from)).toEqual([]);
    // No statement reached the table: the persistent error log names no failure of this folder.
    expect(errorLog()).not.toContain('installationAcceptance');
  });

  it('409 INSTALLATION_DIAGNOSTICS_NOT_COMPLETE with no run and with a run that has not ended; 409 INSTALLATION_ACCEPTANCE_NOT_IN_FORCE for a revocation of nothing; then the run ends', async () => {
    const from = (await trail()).length;
    expect(reasonOf(await accept(technician))).toEqual([409, 'INVALID_STATE', 'INSTALLATION_DIAGNOSTICS_NOT_COMPLETE']);
    expect(reasonOf(await revoke(technician))).toEqual([409, 'INVALID_STATE', 'INSTALLATION_ACCEPTANCE_NOT_IN_FORCE']);
    expect(await since(from)).toEqual([]);

    await guard.app.engine.command(principalOf(TECHNICIAN), 'runDiagnostics');
    await guard.app.pipeline.drain();
    expect(run()).toMatchObject({ completedAt: null });
    const started = (await trail()).length;
    expect(reasonOf(await accept(technician))).toEqual([409, 'INVALID_STATE', 'INSTALLATION_DIAGNOSTICS_NOT_COMPLETE']);
    expect(await since(started)).toEqual([]);
    expect(await stored()).toEqual([]);

    await drive(8_000);
    expect(run()?.completedAt).not.toBeNull();
  });
});

describe('a committed acceptance, the one in force, and its revocation', () => {
  it('the acceptance stores ONE row as dems_app - the Core\'s own facts and the body\'s steps and address - and writes exactly ONE INSTALLATION_ACCEPTED row of the record id and two counts; on a Core in simulated capture', async () => {
    const from = (await trail()).length;
    const state = guard.app.engine.state();
    const response = await accept(technician, { siteAddress: ADDRESS, steps: STEPS });
    expect(response.statusCode).toBe(200);
    const answer = response.json() as Record<string, unknown>;
    expect(validateCoreApiResponse('acceptInstallation', 200, answer)).toEqual({ ok: true });

    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: answer['acceptanceId'],
      accepted_at: guard.clock.now(),
      accepted_by: TECHNICIAN.id,
      software_version: CORE_SERVER_VERSION,
      core_device_id: state.device.id,
      site_name: state.device.name,
      room: state.device.room,
      site_address: ADDRESS,
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
    });
    expect(rows[0]?.['steps']).toEqual(STEPS);
    // The Core's own run, as it was: the id and the instants of the state, check for check.
    const diagnostics = rows[0]?.['diagnostics'] as { id: string; completedAt: number; checks: { id: string; status: string }[] };
    expect([diagnostics.id, diagnostics.completedAt]).toEqual([state.diagnostics?.id, state.diagnostics?.completedAt]);
    expect(diagnostics.checks.map((check) => [check.id, check.status])).toEqual(state.diagnostics?.checks.map((check) => [check.id, check.status]));
    expect(diagnostics.checks.length).toBeGreaterThan(0);
    expect(answer).toMatchObject({ acceptedBy: TECHNICIAN.id, softwareVersion: CORE_SERVER_VERSION, siteAddress: ADDRESS, steps: STEPS, revokedAt: null });

    const written = await since(from);
    expect(written.map((row) => row.type)).toEqual(['INSTALLATION_ACCEPTED']);
    expect(written[0]).toMatchObject({ actorId: TECHNICIAN.id, category: 'SYSTEM' });
    expect(written[0]?.details).toEqual({ acceptanceId: answer['acceptanceId'], stepCount: 27, passedCount: 26, operationId: 'acceptInstallation', permission: 'CAPTURE_COMMISSION' });
    expect(JSON.stringify(written)).not.toMatch(TYPED);
    expect(guard.log.text()).not.toMatch(TYPED);
  });

  it('A SECOND ACCEPTANCE IN FORCE IS REFUSED BY THE DATABASE: 409 INSTALLATION_ACCEPTANCE_IN_FORCE, one row, no entry, no failure in the error log; the Core goes on working', async () => {
    const from = (await trail()).length;
    const before = await stored();
    const response = await accept(technician);
    expect(reasonOf(response)).toEqual([409, 'INVALID_STATE', 'INSTALLATION_ACCEPTANCE_IN_FORCE']);
    expect(await stored()).toEqual(before);
    expect(await since(from)).toEqual([]);
    expect(errorLog()).not.toContain('installationAcceptance');
    // The unit that lost its statement was left cleanly: the engine still commits.
    await drive(500);
    expect(engineControl(guard.app).stats().suspended).toBe(false);
  });

  it('RECORDING IS NOT GATED, and both operations are IDLE ONLY: a session opens with an acceptance in force; while it is open both answer 409 CAPTURE_CONFIG_LOCKED with no entry', async () => {
    const created = await guard.app.engine.command(principalOf(INVESTIGATOR), 'createSession', { caseNumber: 'LP/2026/1013-0117', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: INVESTIGATOR.id });
    expect(created.value).toMatchObject({ ok: true });
    await guard.app.pipeline.drain();
    const from = (await trail()).length;
    const before = await stored();
    expect(reasonOf(await accept(technician))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect(reasonOf(await revoke(technician))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect(await stored()).toEqual(before);
    expect(await since(from)).toEqual([]);
    await guard.app.engine.command(principalOf(INVESTIGATOR), 'cancel');
    await guard.app.pipeline.drain();
  });

  it('the revocation sets the three revoke columns of the row in force - the TRIMMED reason - rewrites nothing that was accepted, and writes exactly ONE INSTALLATION_ACCEPTANCE_REVOKED row WITHOUT the reason; a second revocation is refused', async () => {
    const [before] = await stored();
    guard.clock.advance(5_000);
    const from = (await trail()).length;
    for (const payload of [{}, { reason: 'abc' }, { reason: '          ' }, { reason: REASON, acceptanceId: before?.['id'] }, { reason: 'x'.repeat(501) }]) {
      expect([(await revoke(technician, payload)).statusCode, await inForce()], JSON.stringify(payload).slice(0, 60)).toEqual([422, 1]);
    }
    expect(await since(from)).toEqual([]);

    const response = await revoke(technician, { reason: `   ${REASON}  ` });
    expect(response.statusCode).toBe(200);
    const answer = response.json() as Record<string, unknown>;
    expect(validateCoreApiResponse('revokeInstallationAcceptance', 200, answer)).toEqual({ ok: true });
    expect(answer).toMatchObject({ acceptanceId: before?.['id'], revokedAt: guard.clock.now(), revokedBy: TECHNICIAN.id, revokeReason: REASON });
    expect(await stored()).toEqual([{ ...before, revoked_at: guard.clock.now(), revoked_by: TECHNICIAN.id, revoke_reason: REASON }]);

    const written = await since(from);
    expect(written.map((row) => row.type)).toEqual(['INSTALLATION_ACCEPTANCE_REVOKED']);
    expect(written[0]?.details).toEqual({ acceptanceId: before?.['id'], operationId: 'revokeInstallationAcceptance', permission: 'CAPTURE_COMMISSION' });
    expect(JSON.stringify(written)).not.toMatch(TYPED);

    const again = (await trail()).length;
    expect(reasonOf(await revoke(technician, { reason: 'A second reason that is long enough.' }))).toEqual([409, 'INVALID_STATE', 'INSTALLATION_ACCEPTANCE_NOT_IN_FORCE']);
    expect(await since(again)).toEqual([]);
    expect((await stored())[0]?.['revoke_reason']).toBe(REASON);
    expect(guard.log.text()).not.toMatch(TYPED);
  });

  it('RECORDING IS NOT GATED: with NO acceptance in force a session opens all the same', async () => {
    expect(await inForce()).toBe(0);
    const created = await guard.app.engine.command(principalOf(INVESTIGATOR), 'createSession', { caseNumber: 'LP/2026/1013-0118', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: INVESTIGATOR.id });
    expect(created.value).toMatchObject({ ok: true });
    await guard.app.engine.command(principalOf(INVESTIGATOR), 'cancel');
    await guard.app.pipeline.drain();
  });
});

describe('two acceptances at the same moment: the database lets one win', () => {
  it('THROUGH THE ROUTE: of two requests sent together exactly one is 200 and the other is 409 INSTALLATION_ACCEPTANCE_IN_FORCE; one row in force, ONE entry', async () => {
    expect(await inForce()).toBe(0);
    const from = (await trail()).length;
    const rowsBefore = (await stored()).length;
    guard.clock.advance(1_000);
    const answers = await Promise.all([accept(technician, { steps: STEPS }), accept(technician, { steps: [...STEPS].reverse() })]);
    expect(answers.map(reasonOf).sort((left, right) => left[0] - right[0])).toEqual([
      [200, undefined, null],
      [409, 'INVALID_STATE', 'INSTALLATION_ACCEPTANCE_IN_FORCE'],
    ]);
    expect([(await stored()).length - rowsBefore, await inForce()]).toEqual([1, 1]);
    expect(ownTypes(await since(from))).toEqual(['INSTALLATION_ACCEPTED']);
    expect(reasonOf(await revoke(technician))[0]).toBe(200);
  });

  it('ON TWO OPEN TRANSACTIONS of the runtime role, with the folder\'s own statement: the second INSERT waits for the first, and when the first commits it is refused by the in-force index (23505)', async () => {
    expect(await inForce()).toBe(0);
    const write: AcceptanceWrite = { acceptedAt: guard.clock.now(), acceptedBy: TECHNICIAN.id, softwareVersion: CORE_SERVER_VERSION, coreDeviceId: 'DEMS-ROW-117', siteName: 'Row 117', room: 'R-117', siteAddress: null, steps: [], diagnostics: { id: 'DIAG-000117', startedAt: 1, completedAt: 2, checks: [] } };
    const pool = db.appPool();
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query('BEGIN');
      await second.query('BEGIN');
      const won = await realStore.insert(on(first), write);
      // Row V6b: the statement carries the clock floor; at the clock's own instant it writes (no row would be "clock behind").
      if (won === null) throw new Error('row117: the first INSERT wrote no row');
      let settled = false;
      const lost = realStore.insert(on(second), { ...write, siteName: 'Row 117, the other request' }).then(
        (row) => (row === null ? 'NOT_WRITTEN' : 'STORED'),
        (error: unknown) => (isInForceViolation(error) ? 'IN_FORCE' : `OTHER ${String((error as { code?: unknown }).code)}`),
      );
      void lost.then(() => void (settled = true));
      await new Promise((resolve) => setTimeout(resolve, 150));
      // The index holds the second writer back: nothing is decided before the first transaction ends.
      expect(settled).toBe(false);
      await first.query('COMMIT');
      expect(await lost).toBe('IN_FORCE');
      await second.query('ROLLBACK');
      expect(await inForce()).toBe(1);
      // By its id (row V6): this row shares `accepted_at` with the acceptance of the case before (the clock of the file did
      // not move), and `stored()` breaks that tie by a random id - "the last row" was this one in one run of two.
      expect((await stored()).find((row) => row['id'] === won.id)).toMatchObject({ id: won.id, site_name: 'Row 117', revoked_at: null });
    } finally {
      first.release();
      second.release();
    }
    // The row of this case was written without an operation: it is revoked through the route, which names it by "in force".
    const revoked = await revoke(technician);
    expect(revoked.statusCode).toBe(200);
    expect(await inForce()).toBe(0);
  });
});

describe('the database is the backstop behind the route, and a failed unit stores nothing', () => {
  const DIAGNOSTICS = { id: 'DIAG-000117', startedAt: 1, completedAt: 2, checks: [] };
  const direct = (overrides: Partial<AcceptanceWrite>): AcceptanceWrite => ({ acceptedAt: guard.clock.now(), acceptedBy: TECHNICIAN.id, softwareVersion: CORE_SERVER_VERSION, coreDeviceId: 'DEMS-ROW-117', siteName: 'Row 117', room: 'R-117', siteAddress: null, steps: [], diagnostics: DIAGNOSTICS, ...overrides });
  const refusedBy = async (write: AcceptanceWrite): Promise<[unknown, unknown]> => {
    try {
      await realStore.insert(on(db.appPool()), write);
    } catch (error) {
      const { code, constraint } = error as { code?: unknown; constraint?: unknown };
      return [code, constraint];
    }
    return ['STORED', null];
  };

  it('a denied key name that got PAST the route would be refused by the table: in a step, and at the fourth level of the diagnostics (23514 by the two no-secret-keys CHECKs); a two-line text and a nested step too', async () => {
    const rows = (await stored()).length;
    expect(await refusedBy(direct({ steps: [{ id: 'A', passed: true, detail: null, password: 'x' }] }))).toEqual(['23514', 'installation_acceptances_steps_no_secret_keys_check']);
    expect(await refusedBy(direct({ diagnostics: { ...DIAGNOSTICS, checks: [{ id: 'CPU', label: 'CPU', status: 'PASS', detail: null, params: { token: 'x' } }] } }))).toEqual(['23514', 'installation_acceptances_diagnostics_no_secret_keys_check']);
    expect(await refusedBy(direct({ steps: [{ id: 'A', passed: true, detail: 'two\nlines' }] }))).toEqual(['23514', 'installation_acceptances_steps_bound_check']);
    expect(await refusedBy(direct({ steps: [{ id: 'A', passed: true, detail: { nested: true } }] }))).toEqual(['23514', 'installation_acceptances_steps_check']);
    expect((await stored()).length).toBe(rows);
  });

  it('THROUGH THE ROUTE with a store that sends what the route never would: 500, the failure persisted with the SQLSTATE and the constraint name, no row, no entry', async () => {
    const from = (await trail()).length;
    const rows = (await stored()).length;
    const faulty: InstallationAcceptanceStore = { ...realStore, insert: (connection, write) => realStore.insert(connection, { ...write, steps: [{ id: 'A', passed: true, detail: null, password: 'x' }] }) };
    installationAcceptanceControl(guard.app).replaceForTest({ store: faulty });
    const response = await accept(technician);
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toMatch(/password|installation_acceptances/);
    expect((await stored()).length).toBe(rows);
    expect(await since(from)).toEqual([]);
    const persisted = errorLog();
    expect(persisted).toContain('installationAcceptance.accept');
    expect(persisted).toContain('23514');
    expect(persisted).toContain('installation_acceptances_steps_no_secret_keys_check');
  });

  // Row V6 (R119-08; decision C94 (i)): before this row the answer was 500 with a persisted failure.
  it('a revocation stamped BEFORE the acceptance (a server clock that went back) is refused by the table, not stored, and NAMED: 409 INSTALLATION_CLOCK_BEHIND_RECORD with no value, nothing persisted as a defect, the acceptance stays in force, no entry; with the clock past it the revocation is taken', async () => {
    expect(await inForce()).toBe(0);
    const acceptedAt = guard.clock.now() + 60_000;
    await realStore.insert(on(db.appPool()), direct({ acceptedAt }));
    const from = (await trail()).length;
    const logged = errorLog().length;
    const refused = await revoke(technician);
    expect(reasonOf(refused)).toEqual([409, 'INVALID_STATE', 'INSTALLATION_CLOCK_BEHIND_RECORD']);
    expect(validateCoreApiResponse('revokeInstallationAcceptance', 409, refused.json())).toMatchObject({ ok: true });
    // No value: neither instant, nor a difference of the two.
    expect(refused.body).not.toContain(String(acceptedAt));
    expect(refused.body).not.toContain(String(guard.clock.now()));
    expect(Object.keys(refused.json<{ error: { details: Record<string, unknown> } }>().error.details)).toEqual(['reason']);
    expect(await inForce()).toBe(1);
    expect(await since(from)).toEqual([]);
    // A state the Core names is no defect: the persistent error log gains no line.
    expect(errorLog().length).toBe(logged);
    // The Core goes on working: the unit that lost its statement was left cleanly.
    expect(engineControl(guard.app).stats().suspended).toBe(false);
    guard.clock.advance(120_000);
    expect((await revoke(technician)).statusCode).toBe(200);
    expect(ownTypes(await since(from))).toEqual(['INSTALLATION_ACCEPTANCE_REVOKED']);
  });

  // Row V6b (R119-08 for operation 109; decision C105 (5)): before this row such an acceptance was stored, its instants out of order.
  it('an ACCEPTANCE stamped BEFORE a stored instant (a server clock that went back) writes NOTHING and is NAMED: 409 with a reason and no value, no row, no entry, nothing persisted as a defect - behind the revocation of the record before it, and behind an acceptance in force; the statement itself answers no row; with the clock past the record an acceptance is taken as before', async () => {
    expect(await inForce()).toBe(0);
    const newest = Math.max(guard.clock.now(), ...(await stored()).flatMap((row) => [Number(row['accepted_at']), Number(row['revoked_at'] ?? 0)]));
    // A record of the past of this table whose revocation lies AHEAD of the clock of the Core: accepted at +30 s, revoked at +60 s.
    const revokedAt = newest + 60_000;
    expect(await realStore.insert(on(db.appPool()), direct({ acceptedAt: newest + 30_000 }))).not.toBeNull();
    expect(await realStore.revoke(on(db.appPool()), { revokedAt, revokedBy: TECHNICIAN.id, revokeReason: 'Row V6b: a record ahead of the clock.' })).not.toBeNull();
    expect(await inForce()).toBe(0);
    const rows = (await stored()).length;
    const from = (await trail()).length;
    const logged = errorLog().length;
    expect(guard.clock.now()).toBeLessThan(revokedAt);

    // THE STATEMENT, on the runtime role: one instant before the revocation it answers NO ROW and no error; nothing is written.
    expect(await realStore.insert(on(db.appPool()), direct({ acceptedAt: revokedAt - 1 }))).toBeNull();
    expect((await stored()).length).toBe(rows);

    // THROUGH THE ROUTE, none in force: the clock reason, which the contract lists for operation 109 (row R1b; answered since pass I-9b).
    const refused = await accept(technician);
    expect(reasonOf(refused)).toEqual([409, 'INVALID_STATE', 'INSTALLATION_CLOCK_BEHIND_RECORD']);
    expect(validateCoreApiResponse('acceptInstallation', 409, refused.json())).toMatchObject({ ok: true });
    // No value: neither instant, nor a difference of the two.
    expect(refused.body).not.toContain(String(revokedAt));
    expect(refused.body).not.toContain(String(guard.clock.now()));
    expect(Object.keys(refused.json<{ error: { details: Record<string, unknown> } }>().error.details)).toEqual(['reason']);
    expect([(await stored()).length, await inForce()]).toEqual([rows, 0]);
    expect(await since(from)).toEqual([]);
    // A state the Core names is no defect: the persistent error log gains no line, and the unit was left cleanly.
    expect(errorLog().length).toBe(logged);
    expect(engineControl(guard.app).stats().suspended).toBe(false);

    // ONE IN FORCE, accepted at the revocation's own instant (not "behind"), and the clock of the Core still behind it.
    // The guard writes nothing before the index is ever asked, so the answer is the clock's (the index's answer follows below, with the clock right).
    expect(await realStore.insert(on(db.appPool()), direct({ acceptedAt: revokedAt }))).not.toBeNull();
    expect(reasonOf(await accept(technician))).toEqual([409, 'INVALID_STATE', 'INSTALLATION_CLOCK_BEHIND_RECORD']);
    expect([(await stored()).length, await inForce()]).toEqual([rows + 1, 1]);
    expect(await since(from)).toEqual([]);
    expect(errorLog().length).toBe(logged);

    // The clock past the record: one in force is the index's answer, a revocation is taken, and the next acceptance is stored as before.
    guard.clock.advance(revokedAt - guard.clock.now() + 1_000);
    expect(reasonOf(await accept(technician))).toEqual([409, 'INVALID_STATE', 'INSTALLATION_ACCEPTANCE_IN_FORCE']);
    expect((await revoke(technician)).statusCode).toBe(200);
    const taken = await accept(technician);
    expect(taken.statusCode).toBe(200);
    expect(taken.json<{ acceptedAt: number; revokedAt: number | null }>()).toMatchObject({ acceptedAt: guard.clock.now(), revokedAt: null });
    expect([(await stored()).length, await inForce()]).toEqual([rows + 2, 1]);
    expect(ownTypes(await since(from))).toEqual(['INSTALLATION_ACCEPTANCE_REVOKED', 'INSTALLATION_ACCEPTED']);
    expect((await revoke(technician)).statusCode).toBe(200);
    expect(await inForce()).toBe(0);
    expect(errorLog().length).toBe(logged);
  });

  it('a failure AFTER the statement rolls the unit back: no row and no entry for the acceptance; the acceptance stays in force and no entry is written for the revocation', async () => {
    const failing = (): never => {
      throw Object.assign(new Error('row117: a failure injected after the write'), { code: 'ROW117_INJECTED' });
    };
    const rows = (await stored()).length;
    let from = (await trail()).length;
    installationAcceptanceControl(guard.app).replaceForTest({
      store: {
        ...realStore,
        async insert(connection, write) {
          await realStore.insert(connection, write);
          return failing();
        },
      },
    });
    expect((await accept(technician)).statusCode).toBe(500);
    expect([(await stored()).length, await inForce()]).toEqual([rows, 0]);
    expect(await since(from)).toEqual([]);

    // CONTROL: with the folder's own store the same call is taken, with its one entry.
    installationAcceptanceControl(guard.app).replaceForTest({ store: realStore });
    expect((await accept(technician)).statusCode).toBe(200);
    expect(ownTypes(await since(from))).toEqual(['INSTALLATION_ACCEPTED']);

    from = (await trail()).length;
    installationAcceptanceControl(guard.app).replaceForTest({
      store: {
        ...realStore,
        async revoke(connection, write) {
          await realStore.revoke(connection, write);
          return failing();
        },
      },
    });
    expect((await revoke(technician)).statusCode).toBe(500);
    expect(await inForce()).toBe(1);
    expect(await since(from)).toEqual([]);
    expect(errorLog()).toContain('installationAcceptance.revoke');

    installationAcceptanceControl(guard.app).replaceForTest({ store: realStore });
    expect((await revoke(technician)).statusCode).toBe(200);
    expect(ownTypes(await since(from))).toEqual(['INSTALLATION_ACCEPTANCE_REVOKED']);
    // The whole file: every committed change wrote exactly one entry, and nothing else of this folder is in the trail.
    const all = await stored();
    const entries = ownTypes(await trail());
    // Two rows of this file were written by a statement of the test itself, without an operation: they have no INSTALLATION_ACCEPTED row.
    // Row V6b: + two rows of its clock case, written the same way (the record ahead of the clock and the one in force behind it), and
    // the first of them was REVOKED by a statement of the test too: it has no INSTALLATION_ACCEPTANCE_REVOKED row either.
    expect(entries.filter((type) => type === 'INSTALLATION_ACCEPTED')).toHaveLength(all.length - 4);
    expect(entries.filter((type) => type === 'INSTALLATION_ACCEPTANCE_REVOKED')).toHaveLength(all.filter((row) => row['revoked_at'] !== null).length - 1);
    expect(await inForce()).toBe(0);
  });
});
