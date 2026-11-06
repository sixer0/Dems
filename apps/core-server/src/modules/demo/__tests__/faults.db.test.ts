// Operations 71, 73 and 74 against PostgreSQL and the REAL engine (plan row W43; module gate
// MODG; spec §7.16, §12.2, §12.3; SR-59; AC-B-57, first half; decision D28 D-3).
//
// The real app factory on a clone of the seed, as `dems_app`, with the demo flag ON and EVERY
// stage as the server has it. The engine is booted and runs on a manual clock and a manual
// timer. The three seeded operators are signed in on the web console. What is stored is read as
// `dems_owner`.
//
// What is proven here: a fault is raised and cleared with its rows and its alert; the rows name
// no actor and one info line names the operator; `AUDIT_TAMPER` breaks the VIEW the engine holds
// and leaves the STORED chain intact, row for row, and clearing it restores the view.
import { validateCoreApiResponse } from '@dems/shared/api';
import { verifyAuditChain, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readHead, verifyTrail } from '../../../../test/support/core';
import { verifyStoredAuditRows } from '../../../db/mapping';
import { dropOwn, dumpTable, maintenancePool } from '../../../../test/support/reset';
import { checkStoredChain } from '../../../db/schema/boot-checks';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { storedSlices } from '../../../../test/support/engine';
import { credentialLeaks } from '../../../../test/support/config';
import { FAULTS, FAULTS_CLEAR, STATUS, bodyOf, demoApp, errorOf, outcome, trailOf, type DemoApp } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'w43f' });

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let server: DemoApp;
let maintenance: Pool;

beforeAll(async () => {
  maintenance = maintenancePool(db.run.dataDir);
  server = await demoApp(db, { demoControls: true, dataDir: db.run.dataDir });
});

afterAll(async () => {
  await server?.app.close();
  await db.database.closeResources();
  await dropOwn(maintenance, db.name, db.run.identity.prefix);
  await maintenance.end();
});

const owner = (): Pool => db.ownerPool();
const lastState = () => server.stateChanges().at(-1);
const linesOf = (text: string) => server.log.lines().filter((line) => line['msg'] === text);

interface StatusBody {
  scenario: string;
  activeFaults: Array<{ kind: string; since: number; target: string | null }>;
  seededAt: number;
  lastResetAt: number | null;
  epoch: number;
}

describe('operation 71 getDemoStatus on the booted server', () => {
  it('answers the loaded scenario, no fault, the seed instant of the database, no reset, and the engine\'s epoch', async () => {
    const stored = await owner().query<{ seeded_at: string; last_reset_at: string | null; scenario: string; epoch: string }>(
      'SELECT seeded_at::text AS seeded_at, last_reset_at::text AS last_reset_at, scenario, epoch::text AS epoch FROM public.core_state',
    );
    const response = await server.get('SUPERVISOR', STATUS);
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('getDemoStatus', 200, response.json())).toEqual({ ok: true });
    expect(response.json()).toEqual({
      scenarios: ['idle', 'recording', 'finalizing', 'fault-demo'],
      scenario: 'idle',
      activeFaults: [],
      seededAt: Number(stored.rows[0]?.seeded_at),
      lastResetAt: null,
      epoch: 1,
    });
    expect(stored.rows[0]).toMatchObject({ scenario: 'idle', epoch: '1', last_reset_at: null });
    expect(server.engine.epoch).toBe(1);
  });
});

describe('AC-B-57: a fault is raised and cleared with its rows and its alert', () => {
  it('injectFault MIC_NO_SIGNAL on AUDIO-02: 204, one FAULT_RAISED row without an actor, one active alert, the fault in the status, one info line with the operator', async () => {
    const before = await trailOf(owner());
    const statements = server.sql.length;
    const at = server.clock.now();

    const response = await server.post('SUPERVISOR', FAULTS, { kind: 'MIC_NO_SIGNAL', target: { channel: 'AUDIO-02' } });
    expect(outcome(response)).toEqual([204, null]);
    expect(validateCoreApiResponse('injectFault', 204, bodyOf(response))).toEqual({ ok: true });
    expect(response.headers['x-dems-epoch']).toBe('1');
    expect(Number(response.headers['x-dems-revision'])).toBe(server.engine.revision);
    expect(lastState()).toMatchObject({ cause: 'command', epoch: 1, revision: server.engine.revision });

    const added = (await trailOf(owner())).slice(before.length);
    expect(added.map((row) => row.type)).toEqual(['FAULT_RAISED']);
    // Decision D28 D-3: the simulator's row names no actor.
    expect(added[0]).toMatchObject({ actorId: null, at, details: { kind: 'MIC_NO_SIGNAL', target: 'AUDIO-02' } });
    const alerts = server.engine.slice('alerts').filter((alert) => alert.kind === 'MIC_NO_SIGNAL');
    expect(alerts).toMatchObject([{ active: true, acknowledged: false, target: 'AUDIO-02', resolvedAt: null }]);
    const storedAlerts = await owner().query<{ active: boolean; kind: string }>("SELECT active, kind FROM public.alerts WHERE kind = 'MIC_NO_SIGNAL'");
    expect(storedAlerts.rows).toEqual([{ active: true, kind: 'MIC_NO_SIGNAL' }]);

    const status = (await server.get('SUPERVISOR', STATUS)).json() as StatusBody;
    expect(status.activeFaults).toEqual([{ kind: 'MIC_NO_SIGNAL', since: at, target: 'AUDIO-02' }]);

    // The one record of WHO: the module's info line.
    const line = linesOf('demo fault injected').at(-1);
    expect(line).toMatchObject({ level: 30, operationId: 'injectFault', operatorId: 'OPR-002', kind: 'MIC_NO_SIGNAL', target: { channel: 'AUDIO-02' }, epoch: 1 });
    expect(line?.['err']).toBeUndefined();

    // M13: the round trips of one fault command: every statement the runtime role sent for the
    // request and for the test's own status read after it (the last two).
    const sent = server.sql.slice(statements);
    const short = (text: string): string => text.replace(/\s+/g, ' ').slice(0, 88);
    console.info(`[w43] injectFault MIC_NO_SIGNAL and one getDemoStatus: ${sent.length} statements of the runtime role; ${added.length} audit row; revision ${response.headers['x-dems-revision']}\n${sent.map((text) => `        ${short(text)}`).join('\n')}`);
    expect(sent.filter((text) => text.startsWith('unit: insert into "audit_log"'))).toHaveLength(1);
    expect(sent.filter((text) => text === 'unit: COMMIT').length).toBeGreaterThanOrEqual(1);
    expect(sent.slice(-2)).toEqual([expect.stringMatching(/^read: SELECT s\.id, s\.operator_id/), 'read: SELECT seeded_at::text AS seeded_at, last_reset_at::text AS last_reset_at FROM public.core_state']);
  });

  it('the same fault again: 204, nothing is written (it is already active)', async () => {
    const before = (await trailOf(owner())).length;
    const revision = server.engine.revision;
    const response = await server.post('SUPERVISOR', FAULTS, { kind: 'MIC_NO_SIGNAL', target: { channel: 'AUDIO-02' } });
    expect(outcome(response)).toEqual([204, null]);
    expect(Number(response.headers['x-dems-revision'])).toBe(revision);
    expect(await trailOf(owner())).toHaveLength(before);
    expect(server.engine.slice('faults').active).toHaveLength(1);
  });

  it('clearFault: 204, one FAULT_CLEARED row without an actor, the alert resolved, the status empty; a second clear writes nothing', async () => {
    const before = await trailOf(owner());
    const response = await server.post('SUPERVISOR', FAULTS_CLEAR, { kind: 'MIC_NO_SIGNAL', target: { channel: 'AUDIO-02' } });
    expect(outcome(response)).toEqual([204, null]);
    expect(validateCoreApiResponse('clearFault', 204, bodyOf(response))).toEqual({ ok: true });
    expect(response.headers['x-dems-epoch']).toBe('1');

    const added = (await trailOf(owner())).slice(before.length);
    expect(added.map((row) => row.type)).toEqual(['FAULT_CLEARED']);
    expect(added[0]).toMatchObject({ actorId: null, details: { kind: 'MIC_NO_SIGNAL', target: 'AUDIO-02' } });
    expect(server.engine.slice('alerts').filter((alert) => alert.kind === 'MIC_NO_SIGNAL')).toMatchObject([{ active: false, resolvedAt: server.clock.now() }]);
    expect(((await server.get('SUPERVISOR', STATUS)).json() as StatusBody).activeFaults).toEqual([]);
    expect(linesOf('demo fault cleared').at(-1)).toMatchObject({ level: 30, operationId: 'clearFault', operatorId: 'OPR-002', kind: 'MIC_NO_SIGNAL' });

    const again = await server.post('SUPERVISOR', FAULTS_CLEAR, { kind: 'MIC_NO_SIGNAL' });
    expect(outcome(again)).toEqual([204, null]);
    expect(await trailOf(owner())).toHaveLength(before.length + 1);
  });

  it('a TAMPER fault for evidence the Core does not have: 404 NOT_FOUND, nothing is written, no line names an injection', async () => {
    const before = (await trailOf(owner())).length;
    const injected = linesOf('demo fault injected').length;
    const response = await server.post('SUPERVISOR', FAULTS, { kind: 'TAMPER', target: { evidenceId: 'EV-20991231-9999' } });
    expect(outcome(response)).toEqual([404, 'NOT_FOUND']);
    expect(errorOf(response).details).toMatchObject({ simCode: 'NOT_FOUND' });
    expect(validateCoreApiResponse('injectFault', 404, response.json())).toEqual({ ok: true });
    expect(await trailOf(owner())).toHaveLength(before);
    expect(server.engine.slice('faults').active).toEqual([]);
    expect(linesOf('demo fault injected')).toHaveLength(injected);
  });

  it.each([
    ['an unknown kind', { kind: 'NOT_A_FAULT' }, 422, 'INVALID_INPUT'],
    ['a body that is no JSON', '{"kind":', 400, 'INVALID_JSON'],
  ] as const)('%s: %i %s from the schema stage, nothing is written', async (_label, payload, status, code) => {
    const before = (await trailOf(owner())).length;
    const response = await server.app.inject({
      method: 'POST',
      url: FAULTS,
      headers: { ...server.sessions.SUPERVISOR, origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' },
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
    expect(outcome(response)).toEqual([status, code]);
    expect(validateCoreApiResponse('injectFault', status, response.json())).toEqual({ ok: true });
    expect(await trailOf(owner())).toHaveLength(before);
  });
});

describe('SR-59, AC-B-57: AUDIT_TAMPER breaks the view and leaves the stored chain intact', () => {
  let storedBefore: string[];
  let tamperedSeq: number;

  const view = () => verifyAuditChain(server.engine.slice('audit'));
  const stored = () => checkStoredChain(server.app.db.pool, { verifyDigests: verifyStoredAuditRows });
  const altered = (rows: readonly AuditRow[]): AuditRow[] => rows.filter((row) => row.message.endsWith(' [altered]'));

  it('before the fault the view verifies and the stored chain verifies', async () => {
    expect(view()).toMatchObject({ ok: true });
    expect(await stored()).toMatchObject({ ok: true, linkBreaks: 0, digests: 'ok' });
    storedBefore = await dumpTable(owner(), 'audit_log', 'seq');
    expect(storedBefore.length).toBeGreaterThan(82);
  });

  it('injectFault AUDIT_TAMPER: 204; the view-level verification reports the break; every stored row is byte-equal and the stored chain verifies with its digests', async () => {
    const response = await server.post('SUPERVISOR', FAULTS, { kind: 'AUDIT_TAMPER' });
    expect(outcome(response)).toEqual([204, null]);
    expect(validateCoreApiResponse('injectFault', 204, bodyOf(response))).toEqual({ ok: true });

    // ── The view: one row of the engine's ring is altered, and the shared check finds it.
    const ring = server.engine.slice('audit');
    const changed = altered(ring.rows);
    expect(changed).toHaveLength(1);
    tamperedSeq = changed[0]!.seq;
    const broken = view();
    expect(broken).toMatchObject({ ok: false, seq: tamperedSeq, reason: 'HASH_MISMATCH' });
    // The realtime channel is told to replace the audit slice whole: a ring row changed in place.
    expect(lastState()?.ops.some((op) => op.op === 'replace' && op.slice === 'audit')).toBe(true);

    // ── The stored chain: the rows that were there are the rows that are there, text for text.
    const storedNow = await dumpTable(owner(), 'audit_log', 'seq');
    expect(storedNow.slice(0, storedBefore.length)).toEqual(storedBefore);
    expect(storedNow).toHaveLength(storedBefore.length + 1);
    const trail = await trailOf(owner());
    expect(altered(trail)).toEqual([]);
    expect(trail.at(-1)).toMatchObject({ type: 'AUDIT_CHAIN_DISCONTINUITY', actorId: null, severity: 'CRITICAL', details: { kind: 'AUDIT_TAMPER', seq: tamperedSeq } });
    expect(await stored()).toMatchObject({ ok: true, rowsChecked: trail.length, linkBreaks: 0, digests: 'ok', problems: [] });
    expect(verifyTrail(trail, await readHead(owner()))).toMatchObject({ ok: true, checked: trail.length });
    // The row the view altered is stored with its own text and its own hash.
    const original = trail.find((row) => row.seq === tamperedSeq);
    expect(original?.message.endsWith(' [altered]')).toBe(false);
    expect(original?.hash).toBe(changed[0]?.hash);
    expect(`${original?.message} [altered]`).toBe(changed[0]?.message);

    const status = (await server.get('SUPERVISOR', STATUS)).json() as StatusBody;
    expect(status.activeFaults).toEqual([{ kind: 'AUDIT_TAMPER', since: server.clock.now(), target: `seq:${tamperedSeq}` }]);
    expect(linesOf('demo fault injected').at(-1)).toMatchObject({ operatorId: 'OPR-002', kind: 'AUDIT_TAMPER', target: null });
    console.info(`[w43] AUDIT_TAMPER: view ${JSON.stringify(broken)}; stored ok, ${trail.length} rows, digests ok, no altered row`);
  });

  it('while the view is broken, the engine goes on writing: the stored chain grows and still verifies', async () => {
    const before = (await trailOf(owner())).length;
    expect(outcome(await server.post('SUPERVISOR', FAULTS, { kind: 'FAN_STALL' }))).toEqual([204, null]);
    await server.drive(1_000);
    const trail = await trailOf(owner());
    expect(trail.length).toBeGreaterThan(before);
    expect(altered(trail)).toEqual([]);
    expect(await stored()).toMatchObject({ ok: true, digests: 'ok', linkBreaks: 0 });
    expect(view()).toMatchObject({ ok: false, seq: tamperedSeq });
  });

  it('clearFault AUDIT_TAMPER: the view verifies again; the stored chain was never touched', async () => {
    const before = await trailOf(owner());
    const response = await server.post('SUPERVISOR', FAULTS_CLEAR, { kind: 'AUDIT_TAMPER' });
    expect(outcome(response)).toEqual([204, null]);

    expect(view()).toMatchObject({ ok: true });
    expect(altered(server.engine.slice('audit').rows)).toEqual([]);
    const trail = await trailOf(owner());
    expect(trail.slice(before.length).map((row) => row.type)).toEqual(['FAULT_CLEARED']);
    expect(trail.at(-1)).toMatchObject({ actorId: null, details: { kind: 'AUDIT_TAMPER', target: `seq:${tamperedSeq}` } });
    expect((await dumpTable(owner(), 'audit_log', 'seq')).slice(0, storedBefore.length)).toEqual(storedBefore);
    expect(await stored()).toMatchObject({ ok: true, rowsChecked: trail.length, linkBreaks: 0, digests: 'ok' });
    expect(server.engine.slice('audit')).toMatchObject({ total: trail.length, head: trail.at(-1)?.hash });

    expect(outcome(await server.post('SUPERVISOR', FAULTS_CLEAR, { kind: 'FAN_STALL' }))).toEqual([204, null]);
    expect(((await server.get('SUPERVISOR', STATUS)).json() as StatusBody).activeFaults).toEqual([]);
  });

  it('afterwards what the tables hold is the committed state of the engine, and no credential is in the log', async () => {
    await server.app.pipeline.drain();
    expect(await storedSlices(owner())).toStrictEqual(withoutNegativeZeros(server.engine.state()));
    expect(credentialLeaks(server.log.text())).toEqual([]);
  });
});
