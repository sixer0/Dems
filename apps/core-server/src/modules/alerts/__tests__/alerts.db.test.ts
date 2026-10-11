// Operations 69 and 70 against PostgreSQL and the REAL engine (plan row W40; module gate MODG;
// spec §7.2, §7.3, §7.15, §7.17 member 29, §13.2; AC-B-71; SR-82, AC-B-89; engine host F-11).
//
// The real app factory on a clone, as `dems_app`, with EVERY stage as the server has it. The
// engine is booted and runs on a manual clock and a manual timer. The three seeded operators are
// signed in on the web console; a request carries the cookie, a command also the web console
// `Origin`. What is stored is read as `dems_owner`.
//
// HOW AN ALERT IS RAISED HERE. Through the engine, never by this module and never through the
// demo-control routes (another row's): the hosted action `inject` run with `app.engine.command`,
// and the engine host's own restart rule (a recording that was running when the process stopped
// is moved to FAULT at the next start).
import { EPOCH_HEADER_NAME, REVISION_HEADER_NAME, validateCoreApiResponse } from '@dems/shared/api';
import { ALERT_RING_SIZE, FaultKind, acknowledgeAlertTransition, verifyAuditChain, type AuditRow, type FaultTarget, type OperatorRole, type SimAlert, type SimState, passCaptureStart, openUnsealableNoticesOf } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useFurtherDatabase, useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readEvents, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { countChanges, storedSlices, tableCounts, engineApp } from '../../../../test/support/engine';
import { FOREIGN_ORIGIN } from '../../../../test/support/identity';
import {
  ALERTS,
  ROLES,
  acknowledge,
  bodyOf,
  bootedServer,
  errorOf,
  linesWith,
  memberNames,
  outcome,
  ownMembers,
  stringValues,
  type BootedServer,
  type LogLine,
  type ServerTarget,
} from '../../system/__tests__/support';
import { ALERT_ACKNOWLEDGED_MESSAGE } from '../index';
import { sealDoorsOf } from '../../../engine/seal-doors';
import { unsealableDoorsOf } from '../../../engine/unsealable-doors';

// On a loaded host a database test can pass the runner's default limit: a cap, not a wait.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed' });
/** This file's database under a second name: a describe that keeps a further clone of its own calls that one `db`. */
const home = db;
let server: BootedServer;

beforeAll(async () => {
  server = await bootedServer(db);
});

const wire = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;
const operatorId = (role: OperatorRole): string => server.principal(role).operatorId;
const acknowledgementLines = (lines: readonly LogLine[]): LogLine[] => lines.filter((line) => line['msg'] === ALERT_ACKNOWLEDGED_MESSAGE);

async function anotherServer(slug: string, template: 'seed' | 'bulk' = 'seed'): Promise<{ target: ServerTarget; server: BootedServer }> {
  const clone = await db.another({ template, slug });
  const target: ServerTarget = { runtime: clone.runtime, run: db.run, onCleanup: (close) => clone.onCleanup(close), ownerPool: () => clone.ownerPool() };
  return { target, server: await bootedServer(target) };
}

/** Raises an alert through the engine: the hosted action `inject`, one clock second after the last. */
async function raise(on: BootedServer, kind: FaultKind, target?: FaultTarget): Promise<SimAlert> {
  on.clock.advance(1_000);
  const before = on.engine.slice('alerts').length;
  await on.engine.command(on.principal('SUPERVISOR'), 'inject', kind, target);
  const alerts = on.engine.slice('alerts');
  const alert = alerts.at(-1);
  if (alert === undefined || alerts.length !== before + 1) throw new Error(`injecting ${kind} raised no alert`);
  return alert;
}

/** The alerts of an answer of operation 69. */
async function listed(on: BootedServer, role: OperatorRole = 'INVESTIGATOR'): Promise<SimAlert[]> {
  const response = await on.get(role, ALERTS);
  expect(response.statusCode).toBe(200);
  expect(validateCoreApiResponse('listAlerts', 200, response.json())).toEqual({ ok: true });
  return (response.json() as { alerts: SimAlert[] }).alerts;
}

interface StoredAlert {
  readonly id: string;
  readonly at: number;
  readonly kind: string;
  readonly active: boolean;
  readonly acknowledged: boolean;
  readonly resolvedAt: number | null;
}

/** The rows of `alerts`, as `dems_owner`, oldest first (the order of the slice). */
async function storedAlerts(owner: Pool): Promise<StoredAlert[]> {
  const { rows } = await owner.query<{ id: string; at: string; kind: string; active: boolean; acknowledged: boolean; resolved_at: string | null }>(
    'SELECT id, at, kind, active, acknowledged, resolved_at FROM public.alerts ORDER BY at, id',
  );
  return rows.map((row) => ({ id: row.id, at: Number(row.at), kind: row.kind, active: row.active, acknowledged: row.acknowledged, resolvedAt: row.resolved_at === null ? null : Number(row.resolved_at) }));
}

const asStored = (alert: SimAlert): StoredAlert => ({ id: alert.id, at: alert.at, kind: alert.kind, active: alert.active, acknowledged: alert.acknowledged, resolvedAt: alert.resolvedAt });

/** The lines the log gained while `work` ran. */
async function logged(on: BootedServer, work: () => Promise<unknown>): Promise<LogLine[]> {
  const before = on.log.lines().length;
  await work();
  return on.log.lines().slice(before);
}

/**
 * AC-B-71 for a list of alerts against the stored trail: the audit row of each alert, by the
 * alert's identity in the row (kind, target, instant, text, severity). The audit row does not
 * hold the alert's ID: the simulator gives the alert its ID and writes the row from the fault.
 */
function rowsOfAlerts(alerts: readonly SimAlert[], trail: readonly AuditRow[]): Array<{ alert: SimAlert; rows: AuditRow[] }> {
  return alerts.map((alert) => ({
    alert,
    rows: trail.filter(
      (row) =>
        row.type === (alert.kind === 'AUDIT_TAMPER' ? 'AUDIT_CHAIN_DISCONTINUITY' : 'FAULT_RAISED') &&
        row.at === alert.at &&
        row.details['kind'] === alert.kind &&
        row.message === alert.message &&
        row.severity === alert.severity &&
        (alert.kind === 'AUDIT_TAMPER' || (row.details['target'] ?? null) === (alert.target ?? null)),
    ),
  }));
}

/** What the tables hold equals the committed state of the engine, and the stored chain verifies. */
async function expectStoredEqualsCommitted(on: BootedServer): Promise<void> {
  await on.app.pipeline.drain();
  expect(await storedSlices(on.owner)).toStrictEqual(withoutNegativeZeros(on.engine.state()));
  const rows = await readTrail(on.owner);
  const head = await readHead(on.owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
  expect(verifyAuditChain(on.engine.slice('audit'))).toMatchObject({ ok: true });
}

describe('operation 69 listAlerts on the idle seed', () => {
  it.each(ROLES)('%s reads an empty list under the slice name: the seed holds no alert', async (role) => {
    const response = await server.get(role, ALERTS);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ alerts: [] });
    expect(validateCoreApiResponse('listAlerts', 200, response.json())).toEqual({ ok: true });
    expect(await storedAlerts(server.owner)).toEqual([]);
  });

  it('the read opens no unit of work, sends no statement, writes no row and publishes nothing', async () => {
    await server.app.pipeline.drain();
    const before = { rows: await server.trailLength(), statements: server.database.statements.length, publications: server.publications.length, revision: server.engine.revision };
    for (const role of ROLES) expect((await server.get(role, ALERTS)).statusCode).toBe(200);
    await server.app.pipeline.drain();
    expect({ rows: await server.trailLength(), statements: server.database.statements.length, publications: server.publications.length, revision: server.engine.revision }).toEqual(before);
  });

  it('nobody without a session reads the alerts: 401 NOT_SIGNED_IN, and no row', async () => {
    const before = await server.trailLength();
    const response = await server.get(null, ALERTS);
    expect(outcome(response)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('listAlerts', 401, response.json())).toEqual({ ok: true });
    expect(await server.trailLength()).toBe(before);
  });
});

describe('AC-B-71: every raised alert has a FAULT_RAISED audit row', () => {
  it('thirteen faults raised through the engine (every kind, and a tampered evidence item): every alert of the list has exactly ONE stored row of its fault, and no such row is without an alert', async () => {
    const evidenceId = server.engine.slice('evidence')[0]?.id;
    if (evidenceId === undefined) throw new Error('the seed holds no evidence item');
    const faults: ReadonlyArray<readonly [FaultKind, FaultTarget | undefined]> = [
      [FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-02' }],
      [FaultKind.MIC_NO_SIGNAL, { channel: 'AUDIO-02' }],
      [FaultKind.MIC_CLIP, { channel: 'AUDIO-01' }],
      [FaultKind.STORAGE_LOW, undefined],
      [FaultKind.STORAGE_FULL, undefined],
      [FaultKind.GNSS_LOSS, { fallback: 'RTC' }],
      [FaultKind.TAMPER, undefined],
      [FaultKind.TAMPER, { evidenceId, trackId: 'VIDEO-01' }],
      [FaultKind.FAN_STALL, undefined],
      [FaultKind.POWER_FAIL, undefined],
      [FaultKind.TPM_FAILURE, undefined],
      [FaultKind.SECURITY_FAULT, undefined],
      [FaultKind.AUDIT_TAMPER, undefined],
    ];
    const raised: SimAlert[] = [];
    for (const [kind, target] of faults) raised.push(await raise(server, kind, target));
    await server.app.pipeline.drain();

    // The list, for every role: the thirteen alerts, oldest first, active and not acknowledged.
    for (const role of ROLES) expect(await listed(server, role)).toEqual(wire(raised));
    const alerts = await listed(server);
    expect(alerts.map((alert) => alert.kind)).toEqual(faults.map(([kind]) => kind));
    expect(alerts.every((alert) => alert.active && !alert.acknowledged && alert.resolvedAt === null)).toBe(true);
    expect(new Set(alerts.map((alert) => alert.id)).size).toBe(13);
    // What the list answers is what the table holds.
    expect(await storedAlerts(server.owner)).toEqual(alerts.map(asStored));

    // Every alert: exactly one stored row of its fault, with the alert's kind, target, instant, text and severity.
    const trail = await server.since(server.rowsAtStart);
    const matched = rowsOfAlerts(alerts, trail);
    for (const { alert, rows } of matched) expect(rows, `${alert.id} ${alert.kind} ${String(alert.target)}`).toHaveLength(1);
    // The one kind whose row is not FAULT_RAISED is the demo tamper of the audit view (spec §7.16, operation 73).
    expect(matched.map(({ rows }) => rows[0]?.type)).toEqual([...Array.from({ length: 12 }, () => 'FAULT_RAISED'), 'AUDIT_CHAIN_DISCONTINUITY']);
    // No row without an alert: the rows of the two types are exactly the matched ones, one per alert.
    const faultRows = trail.filter((row) => row.type === 'FAULT_RAISED' || row.type === 'AUDIT_CHAIN_DISCONTINUITY');
    expect(faultRows.map((row) => row.seq)).toEqual(matched.map(({ rows }) => rows[0]?.seq));
    // A fault is raised with no actor (the simulator's row; decision D28 D-3).
    expect(faultRows.every((row) => row.actorId === null)).toBe(true);
    console.info(
      `[w40] AC-B-71: ${alerts.length} alerts listed; audit rows: ${faultRows.filter((row) => row.type === 'FAULT_RAISED').length} FAULT_RAISED + ${faultRows.filter((row) => row.type === 'AUDIT_CHAIN_DISCONTINUITY').length} AUDIT_CHAIN_DISCONTINUITY (kind AUDIT_TAMPER); one row per alert:\n` +
        matched.map(({ alert, rows }) => `  ${alert.id} ${alert.kind} target ${String(alert.target ?? null)} -> seq ${rows[0]?.seq} ${rows[0]?.type}`).join('\n'),
    );

    // The demo tamper of the audit view is cleared again: its alert stays in the list, resolved.
    server.clock.advance(1_000);
    await server.engine.command(server.principal('SUPERVISOR'), 'clearFault', FaultKind.AUDIT_TAMPER);
    const afterwards = await listed(server);
    expect(afterwards.at(-1)).toMatchObject({ kind: 'AUDIT_TAMPER', active: false, resolvedAt: server.clock.now(), acknowledged: false });
    await expectStoredEqualsCommitted(server);
  });
});

describe('operation 70 acknowledgeAlert: no audit row, one log line (SR-82, AC-B-89)', () => {
  it.each(ROLES)('%s acknowledges an alert: 204, the alert as the simulator leaves it, the stored row, ONE published change, NO audit row, NO event, and exactly ONE log line with the operator ID and the alert ID', async (role) => {
    server.clock.advance(10_000);
    await server.app.pipeline.drain();
    const alert = server.engine.slice('alerts').find((candidate) => !candidate.acknowledged);
    if (alert === undefined) throw new Error('no alert is left to acknowledge');
    const committed = server.engine.state();
    const expected = acknowledgeAlertTransition(committed as SimState, alert.id).alerts;
    const counts = await tableCounts(server.owner);
    const trail = await server.trailLength();
    const events = (await readEvents(server.owner)).length;
    const revision = server.engine.revision;
    const publications = server.publications.length;

    let status = 0;
    let body: unknown = 'not read';
    let headers: Record<string, unknown> = {};
    const lines = await logged(server, async () => {
      const response = await server.post(role, acknowledge(alert.id));
      status = response.statusCode;
      body = bodyOf(response);
      headers = response.headers;
      await server.app.pipeline.drain();
    });
    expect(status).toBe(204);
    expect(body).toBeUndefined();
    expect(validateCoreApiResponse('acknowledgeAlert', 204, body)).toEqual({ ok: true });

    // As the simulator does: that alert acknowledged, still active, its fault not cleared; no other alert moved.
    expect(server.engine.slice('alerts')).toEqual(expected);
    expect(server.engine.slice('alerts').find((candidate) => candidate.id === alert.id)).toEqual({ ...alert, acknowledged: true });
    expect(server.engine.slice('faults')).toBe(committed.faults);
    expect(await storedAlerts(server.owner)).toEqual(expected.map(asStored));

    // NO audit row and no event: not one row was inserted anywhere.
    expect(await server.trailLength()).toBe(trail);
    expect((await readEvents(server.owner)).length).toBe(events);
    expect(countChanges(counts, await tableCounts(server.owner))).toEqual({});

    // API-7: ONE published change, a replacement of the `alerts` slice, and its revision in the header.
    const changes = server.publications.slice(publications).flatMap((publication) => (publication.kind === 'state' ? [publication.change] : []));
    expect(changes.map((change) => [change.cause, change.ops.map((op) => [op.op, op.slice])])).toEqual([['command', [['replace', 'alerts']]]]);
    expect(headers[REVISION_HEADER_NAME]).toBe(String(revision + 1));
    expect(headers[EPOCH_HEADER_NAME]).toBe(String(server.engine.epoch));

    // EXACTLY ONE line of the module, with the operator ID and the alert ID, and the request's ID.
    const own = acknowledgementLines(lines);
    expect(own).toHaveLength(1);
    expect(ownMembers(own[0] ?? {})).toEqual({ operatorId: operatorId(role), alertId: alert.id });
    expect(own[0]?.['level']).toBe(30);
    const requestLine = lines.find((line) => line['msg'] === 'request completed');
    expect(requestLine).toMatchObject({ route: '/api/v1/alerts/:id/acknowledge', status: 204, principal: `operator:${operatorId(role)}` });
    expect(own[0]?.['reqId']).toBe(requestLine?.['reqId']);
    // Nothing else of the alert in any line of the call.
    for (const member of ['kind', 'severity', 'target', 'params', 'alert', 'alerts', 'acknowledged', 'active']) expect([...memberNames(lines)], member).not.toContain(member);
    expect(lines.flatMap((line) => stringValues(line))).not.toContain(alert.message);
    console.info(`[w40] acknowledgeAlert by ${role}: 204; audit rows +0, events +0, tables +{}; published ${JSON.stringify(changes.map((change) => change.ops.map((op) => `${op.op} ${op.slice}`)))}; log line ${JSON.stringify(ownMembers(own[0] ?? {}))} "${String(own[0]?.['msg'])}" level ${String(own[0]?.['level'])}`);
  });

  it('a call that changes nothing writes no line: the alert again, an alert the Core does not have; 204 each, the same revision, no statement of a write', async () => {
    await server.app.pipeline.drain();
    const done = server.engine.slice('alerts').find((candidate) => candidate.acknowledged);
    if (done === undefined) throw new Error('no alert is acknowledged yet');
    const before = { rows: await server.trailLength(), publications: server.publications.length, revision: server.engine.revision, alerts: server.engine.slice('alerts'), stored: await storedAlerts(server.owner) };
    const lines = await logged(server, async () => {
      for (const id of [done.id, 'ALR-999999']) {
        const response = await server.post('SUPERVISOR', acknowledge(id));
        expect(response.statusCode, id).toBe(204);
        expect(response.headers[REVISION_HEADER_NAME], id).toBe(String(before.revision));
      }
      await server.app.pipeline.drain();
    });
    expect({ rows: await server.trailLength(), publications: server.publications.length, revision: server.engine.revision, alerts: server.engine.slice('alerts'), stored: await storedAlerts(server.owner) }).toEqual(before);
    expect(server.engine.slice('alerts')).toBe(before.alerts);
    expect(acknowledgementLines(lines)).toEqual([]);
  });

  it('a refused call writes no line: an `{id}` outside the pattern (422), and a caller without a session (401); nothing changed', async () => {
    const open = server.engine.slice('alerts').find((candidate) => !candidate.acknowledged);
    if (open === undefined) throw new Error('no alert is left to acknowledge');
    const before = { rows: await server.trailLength(), revision: server.engine.revision, alerts: server.engine.slice('alerts') };
    const lines = await logged(server, async () => {
      for (const id of ['ALR-00001', 'alr-000001', 'ALR-000001x']) {
        const response = await server.post('TECHNICIAN', acknowledge(id));
        expect(outcome(response), id).toEqual([422, 'INVALID_INPUT']);
        expect(errorOf(response).details, id).toMatchObject({ in: 'params' });
        expect(validateCoreApiResponse('acknowledgeAlert', 422, response.json()), id).toEqual({ ok: true });
      }
      const anonymous = await server.post(null, acknowledge(open.id));
      expect(outcome(anonymous)).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse('acknowledgeAlert', 401, anonymous.json())).toEqual({ ok: true });
      await server.app.pipeline.drain();
    });
    expect({ rows: await server.trailLength(), revision: server.engine.revision, alerts: server.engine.slice('alerts') }).toEqual(before);
    expect(acknowledgementLines(lines)).toEqual([]);
  });

  it('from an origin that is not the web console\'s: 403 ORIGIN_NOT_ALLOWED at stage 3, valid against the contract; nothing changed, no line', async () => {
    const open = server.engine.slice('alerts').find((candidate) => !candidate.acknowledged);
    if (open === undefined) throw new Error('no alert is left to acknowledge');
    const before = { rows: await server.trailLength(), revision: server.engine.revision, alerts: server.engine.slice('alerts') };
    const lines = await logged(server, async () => {
      const response = await server.app.inject({ method: 'POST', url: acknowledge(open.id), headers: { ...server.sessions.SUPERVISOR, origin: FOREIGN_ORIGIN } });
      expect(outcome(response)).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
      expect(validateCoreApiResponse('acknowledgeAlert', 403, response.json())).toEqual({ ok: true });
      await server.app.pipeline.drain();
    });
    expect({ rows: await server.trailLength(), revision: server.engine.revision, alerts: server.engine.slice('alerts') }).toEqual(before);
    expect(acknowledgementLines(lines)).toEqual([]);
  });

  it('measured: the statements of one acknowledgeAlert', async () => {
    const open = server.engine.slice('alerts').find((candidate) => !candidate.acknowledged);
    if (open === undefined) throw new Error('no alert is left to acknowledge');
    server.clock.advance(5_000);
    await server.app.pipeline.drain();
    const measure = async (id: string): Promise<string[]> => {
      const from = server.database.statements.length;
      expect((await server.post('SUPERVISOR', acknowledge(id))).statusCode).toBe(204);
      await server.app.pipeline.drain();
      return server.database.statements.slice(from);
    };
    const changed = await measure(open.id);
    const unchanged = await measure(open.id);
    const short = (text: string): string => text.replace(/\s+/g, ' ').slice(0, 70);
    console.info(`[w40] statements of POST /api/v1/alerts/{id}/acknowledge, a change (${changed.length}):\n${changed.map(short).join('\n')}`);
    console.info(`[w40] statements of POST /api/v1/alerts/{id}/acknowledge, unchanged (${unchanged.length}):\n${unchanged.map(short).join('\n')}`);
    expect(changed.filter((text) => /update "alerts"/i.test(text))).toHaveLength(1);
    expect(changed.filter((text) => /insert into "(audit_log|events)"/i.test(text))).toEqual([]);
    expect(unchanged.filter((text) => /^(update|insert|delete)\b/i.test(text.trim()) && !/auth_sessions/.test(text))).toEqual([]);
  });

  it('three consoles acknowledge the SAME alert at the same time: one of them acknowledged it, so there is exactly ONE line', async () => {
    const alert = server.engine.slice('alerts').find((candidate) => !candidate.acknowledged);
    if (alert === undefined) throw new Error('no alert is left to acknowledge');
    const revision = server.engine.revision;
    const lines = await logged(server, async () => {
      const responses = await Promise.all(ROLES.map((role) => server.post(role, acknowledge(alert.id))));
      expect(responses.map((response) => response.statusCode)).toEqual([204, 204, 204]);
      await server.app.pipeline.drain();
    });
    const own = acknowledgementLines(lines).map(ownMembers);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ alertId: alert.id });
    expect(ROLES.map(operatorId)).toContain(own[0]?.['operatorId']);
    expect(server.engine.revision).toBe(revision + 1);
    expect(server.engine.slice('alerts').find((candidate) => candidate.id === alert.id)?.acknowledged).toBe(true);
    console.info(`[w40] three simultaneous acknowledgeAlert of ${alert.id}: 204, 204, 204; one unit acknowledged it; log lines of the module: ${own.length} (${JSON.stringify(own[0])})`);
  });

  it('two consoles acknowledge DIFFERENT alerts at the same time: each call has its own line with its own alert', async () => {
    const [first, second] = server.engine.slice('alerts').filter((candidate) => !candidate.acknowledged);
    if (first === undefined || second === undefined) throw new Error('fewer than two alerts are left to acknowledge');
    const lines = await logged(server, async () => {
      const responses = await Promise.all([server.post('INVESTIGATOR', acknowledge(first.id)), server.post('TECHNICIAN', acknowledge(second.id))]);
      expect(responses.map((response) => response.statusCode)).toEqual([204, 204]);
      await server.app.pipeline.drain();
    });
    const own = acknowledgementLines(lines).map(ownMembers);
    expect(own).toHaveLength(2);
    expect(own).toEqual(
      expect.arrayContaining([
        { operatorId: operatorId('INVESTIGATOR'), alertId: first.id },
        { operatorId: operatorId('TECHNICIAN'), alertId: second.id },
      ]),
    );
  });

  it('an acknowledgement is kept when the fault is cleared: the alert becomes resolved and stays acknowledged, in the list and in the table', async () => {
    const alert = server.engine.slice('alerts').find((candidate) => candidate.acknowledged && candidate.active && candidate.kind === 'CAMERA_LOSS');
    if (alert === undefined) throw new Error('the camera alert is not acknowledged and active');
    server.clock.advance(1_000);
    await server.engine.command(server.principal('TECHNICIAN'), 'clearFault', FaultKind.CAMERA_LOSS, { cameraId: 'VIDEO-02' });
    await server.app.pipeline.drain();
    const after = (await listed(server, 'SUPERVISOR')).find((candidate) => candidate.id === alert.id);
    expect(after).toEqual(wire({ ...alert, active: false, resolvedAt: server.clock.now() }));
    expect((await storedAlerts(server.owner)).find((candidate) => candidate.id === alert.id)).toEqual(asStored({ ...alert, active: false, resolvedAt: server.clock.now() }));
  });

  it('the end state: what the tables hold is the committed state, the chain verifies, no row is about an acknowledgement, and no line of level error was written', async () => {
    await expectStoredEqualsCommitted(server);
    const rows = await server.since(server.rowsAtStart);
    const byType: Record<string, number> = {};
    for (const row of rows) byType[row.type] = (byType[row.type] ?? 0) + 1;
    expect(Object.keys(byType).sort()).toEqual(['AUDIT_CHAIN_DISCONTINUITY', 'FAULT_CLEARED', 'FAULT_RAISED']);
    expect(rows.filter((row) => /acknowledg/i.test(`${row.type} ${row.message}`))).toEqual([]);
    const lines = server.log.lines();
    expect(lines.filter((line) => line['msg'] === 'audit head diverged')).toEqual([]);
    expect(lines.filter((line) => Number(line['level']) >= 50)).toEqual([]);
    const acknowledged = server.engine.slice('alerts').filter((alert) => alert.acknowledged).length;
    // One line per alert that became acknowledged, over the whole file.
    expect(linesWith(server.log, ALERT_ACKNOWLEDGED_MESSAGE)).toHaveLength(acknowledged);
    console.info(`[w40] rows written by this file after boot and sign-in: ${JSON.stringify(byType)}; alerts acknowledged ${acknowledged} of ${server.engine.slice('alerts').length}; lines "${ALERT_ACKNOWLEDGED_MESSAGE}": ${linesWith(server.log, ALERT_ACKNOWLEDGED_MESSAGE).length}; stored = committed`);
  });
});

describe('an acknowledgement survives a restart, and the engine\'s own alert has its row too', () => {
  const SESSION_INPUT = {
    caseNumber: 'LP/2026/1001-0099',
    subjectType: 'SAKSI',
    subjectName: 'Test Subject',
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  } as const;

  it('after `engine.stop()`, `app.close()` and a new app on the same clone the alerts are as they were; the recording that was running raised a POWER_FAIL alert at the start, with its FAULT_RAISED row; the new process acknowledges on', async () => {
    const { target, server: first } = await anotherServer('w40_alerts_restart');
    // A recording, through hosted commands of the engine (the session routes are another module's).
    const investigator = first.principal('INVESTIGATOR');
    await first.engine.setTabletLink('CONNECTED');
    const created = await first.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
    expect(created.value).toMatchObject({ ok: true, created: true });
    await first.engine.command(investigator, 'beginPrecheck');
    await first.drive(5_000);
    if (first.engine.slice('session')?.state === 'PRECHECK') await first.engine.command(investigator, 'acknowledgePrecheckWarnings');
    await first.engine.command(investigator, 'startRecording');
    await first.drive(2_000);
    expect(first.engine.slice('session')?.state).toBe('RECORDING');

    // Two faults that do not end the recording, and one acknowledgement.
    const silent = await raise(first, FaultKind.MIC_NO_SIGNAL, { channel: 'AUDIO-02' });
    const fan = await raise(first, FaultKind.FAN_STALL);
    expect(first.engine.slice('session')?.state).toBe('RECORDING');
    const firstLines = await logged(first, async () => {
      expect((await first.post('SUPERVISOR', acknowledge(silent.id))).statusCode).toBe(204);
      await first.app.pipeline.drain();
    });
    expect(acknowledgementLines(firstLines).map(ownMembers)).toEqual([{ operatorId: first.principal('SUPERVISOR').operatorId, alertId: silent.id }]);
    await first.drive(1_000);
    const before = await listed(first);
    expect(before.map((alert) => [alert.id, alert.kind, alert.active, alert.acknowledged])).toEqual([
      [silent.id, 'MIC_NO_SIGNAL', true, true],
      [fan.id, 'FAN_STALL', true, false],
    ]);
    const epoch = first.engine.epoch;

    // The stop: both operations answer 503 and nothing is logged for the refused acknowledgement.
    await first.engine.stop();
    expect(outcome(await first.get('SUPERVISOR', ALERTS))).toEqual([503, 'NOT_READY']);
    const refused = await logged(first, async () => {
      expect(outcome(await first.post('TECHNICIAN', acknowledge(fan.id)))).toEqual([503, 'NOT_READY']);
    });
    expect(acknowledgementLines(refused)).toEqual([]);
    const trailAtStop = await readTrail(first.owner);
    const stoppedAt = first.clock.now();
    await first.app.close();
    expect(await storedAlerts(first.owner)).toEqual(before.map(asStored));

    // A new process on the same database, two minutes later on its clock.
    const second = await bootedServer(target, { startAt: stoppedAt + 120_000 });
    expect(second.engine.epoch).toBe(epoch + 1);
    const after = await listed(second, 'TECHNICIAN');
    // The two alerts are as they were: the acknowledgement survived.
    expect(after.slice(0, 2)).toEqual(before);
    // The engine's restart rule moved the recording to FAULT and raised its alert, stamped before the stop.
    expect(after).toHaveLength(3);
    const power = after[2];
    expect(power).toMatchObject({ kind: 'POWER_FAIL', active: true, acknowledged: false, severity: 'CRITICAL' });
    expect(power?.at).toBeLessThanOrEqual(stoppedAt);
    expect(second.engine.slice('session')?.state).toBe('FAULT');
    expect(await storedAlerts(second.owner)).toEqual(after.map(asStored));

    // AC-B-71 in the new process: every alert of the list, whoever raised it, has exactly one FAULT_RAISED row.
    const trail = await readTrail(second.owner);
    expect(trail.slice(0, trailAtStop.length)).toEqual(trailAtStop);
    const matched = rowsOfAlerts(after, trail);
    expect(matched.map(({ rows }) => rows.map((row) => row.type))).toEqual([['FAULT_RAISED'], ['FAULT_RAISED'], ['FAULT_RAISED']]);
    expect(matched[2]?.rows[0]).toMatchObject({ actorId: null, at: power?.at, details: { kind: 'POWER_FAIL' } });
    expect(matched[2]?.rows[0]?.seq).toBeGreaterThan(trailAtStop.length);
    // Counted from the first process's start: the seeded history holds a FAULT_RAISED row of an earlier day.
    expect(trail.slice(first.rowsAtStart).filter((row) => row.type === 'FAULT_RAISED')).toHaveLength(3);

    // The new process acknowledges the other two: its own lines, the stored rows, still no audit row.
    const length = await second.trailLength();
    const secondLines = await logged(second, async () => {
      expect((await second.post('INVESTIGATOR', acknowledge(fan.id))).statusCode).toBe(204);
      expect((await second.post('TECHNICIAN', acknowledge(power?.id ?? ''))).statusCode).toBe(204);
      expect((await second.post('TECHNICIAN', acknowledge(silent.id))).statusCode).toBe(204);
      await second.app.pipeline.drain();
    });
    expect(acknowledgementLines(secondLines).map(ownMembers)).toEqual([
      { operatorId: second.principal('INVESTIGATOR').operatorId, alertId: fan.id },
      { operatorId: second.principal('TECHNICIAN').operatorId, alertId: power?.id },
    ]);
    expect((await storedAlerts(second.owner)).map((alert) => alert.acknowledged)).toEqual([true, true, true]);
    expect(await second.trailLength()).toBe(length);
    await expectStoredEqualsCommitted(second);
    console.info(
      `[w40] alerts across a restart: epoch ${epoch} -> ${second.engine.epoch}; before the stop ${JSON.stringify(before.map((alert) => [alert.id, alert.kind, alert.acknowledged]))}; after the start the same two and ${power?.id} POWER_FAIL (raised by the engine's restart rule, at ${(power?.at ?? 0) - stoppedAt} ms from the stop) with FAULT_RAISED seq ${matched[2]?.rows[0]?.seq}, actor null; ` +
        `one FAULT_RAISED row per alert: ${matched.map(({ alert, rows }) => `${alert.id} -> seq ${rows[0]?.seq}`).join(', ')}`,
    );
  });
});

describe('operation 69 on the bulk template: 250 stored alerts', () => {
  let bulk: BootedServer;

  beforeAll(async () => {
    bulk = (await anotherServer('w40_alerts_bulk', 'bulk')).server;
  });

  it(`the list is the engine's ring: the newest ${ALERT_RING_SIZE} of the stored alerts by instant and ID, oldest first, valid against the contract`, async () => {
    const stored = await storedAlerts(bulk.owner);
    expect(stored).toHaveLength(250);
    for (const role of ROLES) {
      const alerts = await listed(bulk, role);
      expect(alerts).toHaveLength(ALERT_RING_SIZE);
      expect(alerts.map(asStored)).toEqual(stored.slice(-ALERT_RING_SIZE));
    }
    const alerts = await listed(bulk);
    expect(alerts).toEqual(wire(bulk.engine.slice('alerts')));
    const kinds = new Set(alerts.map((alert) => alert.kind));
    // Informative, for AC-B-71: the fixture's alerts are not raised by a server; the fixture decides which have a row.
    const trail = await readTrail(bulk.owner);
    const faultAlerts = alerts.filter((alert) => alert.kind !== 'SYSTEM');
    const withRow = rowsOfAlerts(faultAlerts, trail).filter(({ rows }) => rows.length > 0).length;
    const faultRows = trail.filter((row) => row.type === 'FAULT_RAISED' || row.type === 'AUDIT_CHAIN_DISCONTINUITY');
    const byKindAndInstant = faultAlerts.filter((alert) => faultRows.some((row) => row.at === alert.at && row.details['kind'] === alert.kind)).length;
    const byKind = faultAlerts.filter((alert) => faultRows.some((row) => row.details['kind'] === alert.kind)).length;
    console.info(
      `[w40] bulk template: ${stored.length} stored alerts, ${alerts.length} listed (the ring); listed: ${alerts.filter((alert) => alert.active).length} active, ${alerts.filter((alert) => alert.acknowledged).length} acknowledged, kinds ${[...kinds].sort().join(', ')}; ` +
        `of the ${faultAlerts.length} listed fault alerts of the fixture, ${withRow} have a FAULT_RAISED row with the alert's kind, target, instant and text, ${byKindAndInstant} one with its kind and instant, ${byKind} one with its kind at any instant; ` +
        `the stored trail holds ${faultRows.length} rows of type FAULT_RAISED or AUDIT_CHAIN_DISCONTINUITY (the fixture's own data, not raised by a server)`,
    );
  });

  it('an alert of the ring is acknowledged with its line; a stored alert that is older than the ring is unknown to the engine: 204, nothing changes, no line', async () => {
    const stored = await storedAlerts(bulk.owner);
    const inRing = bulk.engine.slice('alerts').find((alert) => !alert.acknowledged);
    const outside = stored.slice(0, stored.length - ALERT_RING_SIZE).find((alert) => !alert.acknowledged);
    if (inRing === undefined || outside === undefined) throw new Error('the fixture has no unacknowledged alert inside and outside the ring');
    const trail = await bulk.trailLength();
    const lines = await logged(bulk, async () => {
      expect((await bulk.post('SUPERVISOR', acknowledge(inRing.id))).statusCode).toBe(204);
      expect((await bulk.post('SUPERVISOR', acknowledge(outside.id))).statusCode).toBe(204);
      await bulk.app.pipeline.drain();
    });
    expect(acknowledgementLines(lines).map(ownMembers)).toEqual([{ operatorId: bulk.principal('SUPERVISOR').operatorId, alertId: inRing.id }]);
    const after = await storedAlerts(bulk.owner);
    expect(after.find((alert) => alert.id === inRing.id)?.acknowledged).toBe(true);
    expect(after.find((alert) => alert.id === outside.id)?.acknowledged).toBe(false);
    expect(after.filter((alert) => alert.acknowledged)).toHaveLength(stored.filter((alert) => alert.acknowledged).length + 1);
    expect(await bulk.trailLength()).toBe(trail);
    console.info(`[w40] bulk template: acknowledging ${inRing.id} (in the ring) stored it and logged one line; acknowledging ${outside.id} (stored, older than the newest ${ALERT_RING_SIZE}) answered 204 and changed nothing`);
  });
});

// ═══ Moved here from `wave-l-s-unsealable-ack.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// Fix wave L, driver L-S - re-check 75 finding G75d-01, ruling D228 (2), on PostgreSQL and the REAL
// engine host (as `dems_app`; what is stored is read as `dems_owner`).
//
// The alert of a session that ended UNSEALABLE is an open notice: it stays ACTIVE - through an
// acknowledgement of a role that may not close it, through the next session and through a restart
// of the Core - until a SUPERVISOR acknowledges it. That acknowledgement resolves it and writes ONE
// audit row that names the session of the NOTICE.
//
// | Step | What is held |
// |------|--------------|
// | 1 | CONTROL (the finding): the investigator's acknowledgement stores `acknowledged`, the alert stays active, no row |
// | 2 | a NEW session is created and cancelled, the process is closed and a second one boots: still active, still no row |
// | 3 | the supervisor acknowledges in the second process: resolved in the state and in the table, ONE `FAULT_CLEARED` row of the unsealable session with the supervisor as actor, the chain holds |
// | 4 | a third process: the alert comes back resolved; nothing more is written |
describe('G75d-01, D228 (2): the unsealable notice over three processes on one database', () => {
  vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

  const db = useFurtherDatabase(home, { template: 'seed' });
  const STEPS = ['CLOSE_TRACKS', 'FINALIZE_HASHES', 'FINALIZE_TRANSCRIPT', 'BUILD_MANIFEST', 'SIGN_MANIFEST', 'STORE_SEALED_PACKAGE'] as const;
  const INPUT = { caseNumber: 'LP/2026/1011-0041', subjectType: 'SAKSI', subjectName: 'Unsealable Notice Test', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;
  const CAUSE = 'SESSION_KEY_NOT_OF_SESSION';

  interface StoredAlert {
    id: string;
    active: boolean;
    acknowledged: boolean;
    resolved_at: string | null;
    target: string | null;
  }

  describe('G75d-01: the open notice of an unsealable session, on the real engine', () => {
    it('stays active through another role\'s acknowledgement, a later session and a restart; a supervisor\'s acknowledgement resolves it with ONE audit row of its own session', async () => {
      const owner = db.ownerPool();
      const stored = async (): Promise<StoredAlert[]> => (await owner.query<StoredAlert>("SELECT id, active, acknowledged, resolved_at, target FROM public.alerts WHERE reason = 'UNSEALABLE' ORDER BY id")).rows;
      const cleared = async (): Promise<Array<{ type: string; session_id: string | null; actor_id: string | null; device_id: string | null; details: Record<string, unknown> }>> =>
        (await owner.query<{ type: string; session_id: string | null; actor_id: string | null; device_id: string | null; details: Record<string, unknown> }>("SELECT type, session_id, actor_id, device_id, details FROM public.audit_log WHERE type = 'FAULT_CLEARED' AND details->>'reason' = 'UNSEALABLE' ORDER BY seq")).rows;

      // ── Process 1: a session ends UNSEALABLE ──
      const first = await engineApp(db, db.run.dataDir);
      await first.app.readiness.boot();
      const investigator = first.principal('INVESTIGATOR');
      await first.engine.setTabletLink('CONNECTED');
      const created = (await first.engine.command(investigator, 'createSession', { ...INPUT, investigatorId: investigator.operatorId })).value;
      if (!created.ok) throw new Error('the session was not created');
      const sessionId = created.sessionId;
      await first.engine.command(investigator, 'beginPrecheck');
      await first.drive(5_000);
      if (first.engine.slice('session')?.state === 'PRECHECK') await first.engine.command(investigator, 'acknowledgePrecheckWarnings');
      await first.engine.command(investigator, 'startRecording');
      await passCaptureStart((ms) => first.drive(ms));
      await first.drive(2_000);
      await first.engine.command(investigator, 'stopRecording', 'Interview complete - test stop');
      await sealDoorsOf(first.engine).applySealingProgress({ sessionId, steps: STEPS.map((id, index) => ({ id, status: index === 0 ? ('FAILED' as const) : ('PENDING' as const), progress: 0, etaMs: null, attempt: 3, detail: null })) });
      await unsealableDoorsOf(first.engine).endSessionUnsealable({ sessionId, cause: CAUSE, quarantinedFiles: 5 });
      await first.app.pipeline.drain();
      const notice = openUnsealableNoticesOf(first.engine.state() as SimState)[0];
      if (notice === undefined) throw new Error('the unsealable end left no open notice');
      expect(notice).toMatchObject({ sessionId, cause: CAUSE, acknowledged: false });
      const alertId = notice.alertId;

      // 1. CONTROL (the finding): the investigator acknowledges - stored, and the alert is still active. No row.
      await first.engine.command(investigator, 'acknowledgeAlert', alertId);
      await first.app.pipeline.drain();
      expect(await stored()).toEqual([{ id: alertId, active: true, acknowledged: true, resolved_at: null, target: sessionId }]);
      expect(await cleared()).toEqual([]);

      // 2. The Core is free: a new session is created (and cancelled). The notice is not its state, and it does not end the notice.
      const again = (await first.engine.command(investigator, 'createSession', { ...INPUT, investigatorId: investigator.operatorId, caseNumber: 'LP/2026/1011-0042' })).value;
      if (!again.ok) throw new Error('a new session could not be created while the notice is open');
      expect(openUnsealableNoticesOf(first.engine.state() as SimState).map((open) => open.sessionId)).toEqual([sessionId]);
      expect(again.sessionId).not.toBe(sessionId);
      await first.engine.command(investigator, 'cancel');
      await first.app.pipeline.drain();
      const closedAt = first.clock.now();
      await first.app.close();

      // A restart keeps it active until acknowledged.
      const second = await engineApp(db, db.run.dataDir, { startAt: closedAt + 60_000 });
      await second.app.readiness.boot();
      expect(openUnsealableNoticesOf(second.engine.state() as SimState)).toEqual([expect.objectContaining({ alertId, sessionId, acknowledged: true })]);
      expect(await cleared()).toEqual([]);

      // 3. The supervisor acknowledges: resolved, with its row.
      const supervisor = second.principal('SUPERVISOR');
      const rowsBefore = (await readTrail(owner)).length;
      await second.engine.command(supervisor, 'acknowledgeAlert', alertId);
      await second.app.pipeline.drain();
      expect(openUnsealableNoticesOf(second.engine.state() as SimState)).toEqual([]);
      expect(second.engine.slice('alerts').find((alert) => alert.id === alertId)).toMatchObject({ active: false, acknowledged: true, resolvedAt: expect.any(Number) });
      const after = await stored();
      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({ id: alertId, active: false, acknowledged: true, target: sessionId });
      expect(after[0]?.resolved_at).not.toBeNull();
      expect(await cleared()).toEqual([{ type: 'FAULT_CLEARED', session_id: sessionId, actor_id: supervisor.operatorId, device_id: null, details: { reason: 'UNSEALABLE', cause: CAUSE, alertId, operationId: 'acknowledgeAlert' } }]);
      const trail = await readTrail(owner);
      expect(trail).toHaveLength(rowsBefore + 1);
      expect(verifyTrail(trail, await readHead(owner)).ok).toBe(true);
      // Once: acknowledging again changes nothing.
      await second.engine.command(supervisor, 'acknowledgeAlert', alertId);
      await second.app.pipeline.drain();
      expect(await readTrail(owner)).toHaveLength(rowsBefore + 1);
      const closedAgainAt = second.clock.now();
      await second.app.close();

      // 4. Resolved for good: the next process reads it resolved and writes nothing about it.
      const third = await engineApp(db, db.run.dataDir, { startAt: closedAgainAt + 60_000 });
      await third.app.readiness.boot();
      expect(openUnsealableNoticesOf(third.engine.state() as SimState)).toEqual([]);
      expect(third.engine.slice('alerts').find((alert) => alert.id === alertId)).toMatchObject({ active: false, acknowledged: true });
      expect(await cleared()).toHaveLength(1);
      await third.app.close();
    });
  });
});
