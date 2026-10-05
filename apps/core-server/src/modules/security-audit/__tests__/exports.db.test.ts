// Operations 61 `exportAudit` and 62 `exportLogs` against PostgreSQL, on a clone of the seed
// (plan row W39; spec §7.13, §7.2, §7.3; RB-5; decisions D83 DN-4, D92 DN-2; module gate MODG).
//
// The real app, booted, with every stage. Counts are relative to the state before each call.
import { EPOCH_HEADER_NAME, EXPORT_ID_PATTERN, REVISION_HEADER_NAME, validateCoreApiResponse, type AuditExportAccepted, type AuditPage } from '@dems/shared/api';
import { DEFAULT_AUDIT_EXPORT_DESTINATION, FaultKind, type AuditRow, type SimEvent } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readEvents, readTrail } from '../../../../test/support/core';
import { AUDIT, AUDIT_EXPORT, EVENTS, LOGS_EXPORT, auditApp, countOf, errorOf, outcomeOf, storedHead, walkAudit, walkEvents, type AuditApp, type Headers } from './support';

const db = useTestDatabase({ template: 'seed' });
let host: AuditApp;
let owner: Pool;
let investigator: Headers;
let supervisor: Headers;
let technician: Headers;

const FACE = '\u{1F600}';
const REASON = 'Quarterly audit review';
const OPERATIONS = [
  { operationId: 'exportAudit', url: AUDIT_EXPORT, scope: 'AUDIT', label: 'Audit export' },
  { operationId: 'exportLogs', url: LOGS_EXPORT, scope: 'LOGS', label: 'Log export' },
] as const;

beforeAll(async () => {
  owner = db.ownerPool();
  host = await auditApp(db, db.run.dataDir);
  investigator = await host.signIn('INVESTIGATOR');
  supervisor = await host.signIn('SUPERVISOR');
  technician = await host.signIn('TECHNICIAN');
  await host.app.pipeline.drain();
});

beforeEach(() => {
  host.forgetCounters();
});

interface Stored {
  readonly trail: AuditRow[];
  readonly events: Array<SimEvent & { category: string }>;
  readonly exports: number;
  readonly commands: number;
  readonly revision: number;
}

async function state(): Promise<Stored> {
  await host.app.pipeline.drain();
  return {
    trail: await readTrail(owner),
    events: await readEvents(owner),
    exports: await countOf(owner, 'exports'),
    commands: host.engine.stats().commands,
    revision: host.engine.revision,
  };
}

async function exportRecord(id: string): Promise<Record<string, unknown> | undefined> {
  const { rows } = await owner.query<Record<string, unknown>>('SELECT id, scope, evidence_id, operator_id, reason, destination, at::text AS at FROM public.exports WHERE id = $1', [id]);
  return rows[0];
}

describe.each(OPERATIONS)('operation $operationId: an accepted export', ({ operationId, url, scope }) => {
  it('answers 202 with the export ID, the scope and the chain the export covers, after the commit, with the state position', async () => {
    const before = await state();
    const head = await storedHead(owner);
    const response = await host.post(url, supervisor, { reason: `  ${REASON}  ` });
    expect(response.statusCode).toBe(202);
    const body: AuditExportAccepted = response.json();
    expect(validateCoreApiResponse(operationId, 202, body)).toEqual({ ok: true });
    expect(Object.keys(body)).toEqual(['exportId', 'scope', 'rows', 'head']);
    expect(body.exportId).toMatch(EXPORT_ID_PATTERN);
    expect(body.scope).toBe(scope);
    // The chain the export covers: every stored row before the export's own row.
    expect([body.rows, body.head]).toEqual([head.seq, head.hash]);

    const after = await state();
    // API-7: the epoch, and the revision of the change that holds the command's effect.
    expect(response.headers[EPOCH_HEADER_NAME]).toBe(String(host.engine.epoch));
    expect(Number(response.headers[REVISION_HEADER_NAME])).toBe(after.revision);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.commands).toBe(before.commands + 1);

    // What the hosted action wrote: ONE audit row, by the session's operator, and the record derived from it.
    const added = after.trail.slice(before.trail.length);
    expect(added).toHaveLength(1);
    const row = added[0] as AuditRow;
    expect(row).toMatchObject({ seq: head.seq + 1, type: 'AUDIT_EXPORTED', actorId: host.operator('SUPERVISOR').id, prevHash: head.hash, at: host.clock.now() });
    expect(row.details).toEqual({
      exportId: body.exportId,
      rows: host.engine.slice('audit').rows.length - 1,
      head: head.hash,
      chainOk: true,
      eventKind: 'EXPORT',
      reason: REASON,
      destination: DEFAULT_AUDIT_EXPORT_DESTINATION,
      ...(scope === 'LOGS' ? { scope: 'LOGS', events: before.events.length } : {}),
    });
    expect(await exportRecord(body.exportId)).toEqual({
      id: body.exportId,
      scope,
      evidence_id: null,
      operator_id: host.operator('SUPERVISOR').id,
      reason: REASON,
      destination: DEFAULT_AUDIT_EXPORT_DESTINATION,
      at: String(host.clock.now()),
    });
    expect(after.exports).toBe(before.exports + 1);
    // The simulator emits no operational event for an accepted audit or log export.
    expect(after.events.length).toBe(before.events.length);
  });

  it('a client that walks the audit list up to `rows` ends on the row whose hash is `head`; the export\'s own row is the next one', async () => {
    const body: AuditExportAccepted = (await host.post(url, supervisor, { reason: REASON })).json();
    const walked = (await walkAudit(host, supervisor, '?limit=200')).flatMap((page) => page.rows);
    expect(walked[body.rows - 1]).toMatchObject({ seq: body.rows, hash: body.head });
    expect(walked[body.rows]).toMatchObject({ seq: body.rows + 1, type: 'AUDIT_EXPORTED', prevHash: body.head });
    expect(walked[body.rows]?.details['exportId']).toBe(body.exportId);
    if (scope === 'LOGS') {
      // The log bundle is the chain and the events: both lists are there for the client to page.
      expect((await walkEvents(host, supervisor, '?limit=200')).flatMap((page) => page.events).length).toBe(walked[body.rows]?.details['events']);
    }
  });

  it('a destination is recorded as sent (trimmed); 120 code units pass; none means the action\'s default', async () => {
    const named: AuditExportAccepted = (await host.post(url, supervisor, { reason: REASON, destination: '  Audit vault B-2  ' })).json();
    expect((await exportRecord(named.exportId))?.['destination']).toBe('Audit vault B-2');
    const longest = `${'d'.repeat(118)}${FACE}`;
    const long: AuditExportAccepted = (await host.post(url, supervisor, { reason: REASON, destination: longest })).json();
    expect((await exportRecord(long.exportId))?.['destination']).toBe(longest);
    const blank: AuditExportAccepted = (await host.post(url, supervisor, { reason: REASON, destination: '   ' })).json();
    expect((await exportRecord(blank.exportId))?.['destination']).toBe(DEFAULT_AUDIT_EXPORT_DESTINATION);
    // IDs are minted once each, in order.
    expect([named.exportId, long.exportId, blank.exportId]).toEqual([...new Set([named.exportId, long.exportId, blank.exportId])].sort());
    // Each export covers the export before it: one row more each time.
    expect([long.rows - named.rows, blank.rows - long.rows]).toEqual([1, 1]);
  });

  it('nothing of the request reaches the log: not the reason, not the destination', async () => {
    const lines = host.log.lines().length;
    await host.post(url, supervisor, { reason: 'MARK-reason-41c for the review', destination: 'MARK-destination-7aa' });
    const text = JSON.stringify(host.log.lines().slice(lines));
    expect(text).not.toContain('MARK-');
  });
});

describe.each(OPERATIONS)('operation $operationId: without a reason', ({ operationId, url }) => {
  const missing: ReadonlyArray<readonly [label: string, payload: unknown]> = [
    ['no body at all', undefined],
    ['an empty object', {}],
    ['a destination and no reason', { destination: 'Audit vault' }],
    ['an empty reason', { reason: '' }],
    ['a blank reason', { reason: '       ' }],
    ['four characters', { reason: 'abcd' }],
    ['three two-unit characters, which the simulator alone would accept', { reason: FACE.repeat(3) }],
  ];

  it.each(missing)('%s answers 422 INVALID_REASON, decided by the hosted action, and nothing is stored', async (_label, payload) => {
    const before = await state();
    const response = await host.post(url, supervisor, payload as never);
    expect(outcomeOf(response)).toEqual([422, 'INVALID_REASON']);
    expect(validateCoreApiResponse(operationId, 422, response.json())).toEqual({ ok: true });
    expect(errorOf(response)).toMatchObject({ message: 'An export reason of at least 5 characters is required.', details: { simCode: 'REASON_TOO_SHORT' } });
    expect(response.headers[REVISION_HEADER_NAME]).toBeUndefined();
    const after = await state();
    // The action ran (it is the one that refuses), and it wrote nothing.
    expect(after.commands).toBe(before.commands + 1);
    expect([after.trail.length, after.events.length, after.exports, after.revision]).toEqual([before.trail.length, before.events.length, before.exports, before.revision]);
  });
});

describe.each(OPERATIONS)('operation $operationId: a body that does not match its schema', ({ operationId, url }) => {
  const invalid: ReadonlyArray<readonly [label: string, payload: unknown]> = [
    ['a reason that is a number', { reason: 12_345 }],
    ['a reason of 501 code units', { reason: 'r'.repeat(501) }],
    ['a reason that holds U+0000', { reason: 'abc\u0000def' }],
    ['a destination of 121 code units', { reason: REASON, destination: 'd'.repeat(121) }],
    ['a destination that is a number', { reason: REASON, destination: 7 }],
    ['a short reason AND a destination that is too long', { reason: 'ab', destination: 'd'.repeat(121) }],
  ];

  it.each(invalid)('%s answers 422 INVALID_INPUT before the engine runs', async (_label, payload) => {
    const before = await state();
    const response = await host.post(url, supervisor, payload as never);
    expect(outcomeOf(response)).toEqual([422, 'INVALID_INPUT']);
    expect(validateCoreApiResponse(operationId, 422, response.json())).toEqual({ ok: true });
    expect(errorOf(response).details).toEqual({ in: 'body' });
    const after = await state();
    expect([after.commands, after.trail.length, after.exports]).toEqual([before.commands, before.trail.length, before.exports]);
  });

  it('a body that is not a JSON object answers 400 INVALID_JSON', async () => {
    const before = await state();
    for (const payload of ['[1, 2]', '"text"', '{"reason": ']) {
      const response = await host.app.inject({ method: 'POST', url, headers: { ...supervisor, origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' }, payload });
      expect(outcomeOf(response), payload).toEqual([400, 'INVALID_JSON']);
      expect(validateCoreApiResponse(operationId, 400, response.json())).toEqual({ ok: true });
    }
    expect((await state()).commands).toBe(before.commands);
  });
});

describe.each(OPERATIONS)('operation $operationId: a caller without AUDIT_EXPORT (RB-5; decision D83 DN-4)', ({ operationId, url, scope, label }) => {
  it.each(['INVESTIGATOR', 'TECHNICIAN'] as const)('the %s is refused with 403 NOT_PERMITTED and exactly one EXPORT_DENIED row and event, the guard\'s; the hosted action does not run', async (role) => {
    const session = role === 'INVESTIGATOR' ? investigator : technician;
    const before = await state();
    const response = await host.post(url, session, { reason: REASON });
    expect(outcomeOf(response)).toEqual([403, 'NOT_PERMITTED']);
    expect(validateCoreApiResponse(operationId, 403, response.json())).toEqual({ ok: true });
    expect(errorOf(response).details).toEqual({ operationId, permission: 'AUDIT_EXPORT', role });

    const after = await state();
    expect(after.commands).toBe(before.commands);
    expect(after.exports).toBe(before.exports);
    const rows = after.trail.slice(before.trail.length);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'EXPORT_DENIED', severity: 'WARNING', actorId: host.operator(role).id, message: `${label} denied: role ${role} lacks AUDIT_EXPORT` });
    // `operationId` and `permission` are what the guard adds to the simulator's row: this row is the guard's.
    expect(rows[0]?.details).toEqual({ operationId, permission: 'AUDIT_EXPORT', role, scope, eventKind: 'UNAUTHORIZED_EXPORT' });
    const events = after.events.slice(before.events.length);
    expect(events.map((event) => [event.type, event.severity])).toEqual([['EXPORT_DENIED', 'WARNING']]);
  });

  it('the refusal does not depend on the body: no body, a short reason and a body that breaks the schema are refused the same way, one row each', async () => {
    const before = await state();
    for (const payload of [undefined, { reason: 'ab' }, { reason: 7, destination: 'd'.repeat(500) }]) {
      host.forgetCounters();
      expect(outcomeOf(await host.post(url, investigator, payload as never))).toEqual([403, 'NOT_PERMITTED']);
    }
    const after = await state();
    expect(after.trail.slice(before.trail.length).map((row) => row.type)).toEqual(['EXPORT_DENIED', 'EXPORT_DENIED', 'EXPORT_DENIED']);
    expect(after.commands).toBe(before.commands);
  });

  it('a caller without a session answers 401; the SUPERVISOR\'s cookie without the web console Origin answers 403 ORIGIN_NOT_ALLOWED; neither writes a row', async () => {
    const before = await state();
    const anonymous = await host.post(url, {}, { reason: REASON });
    expect(outcomeOf(anonymous)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse(operationId, 401, anonymous.json())).toEqual({ ok: true });
    const noOrigin = await host.app.inject({ method: 'POST', url, headers: supervisor, payload: { reason: REASON } });
    expect(outcomeOf(noOrigin)).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    expect(validateCoreApiResponse(operationId, 403, noOrigin.json())).toEqual({ ok: true });
    const after = await state();
    expect([after.trail.length, after.exports, after.commands]).toEqual([before.trail.length, before.exports, before.commands]);
  });
});

describe('the two exports and the rest of the area', () => {
  it('an export is listed: the AUDIT_EXPORTED row is the newest row of the audit list, with its reason and its export ID', async () => {
    const body: AuditExportAccepted = (await host.post(AUDIT_EXPORT, supervisor, { reason: 'Inspection by the directorate' })).json();
    const page: AuditPage = (await host.get(`${AUDIT}?type=AUDIT_EXPORTED&order=DESC&limit=1`, investigator)).json();
    expect(page.rows[0]?.details).toMatchObject({ exportId: body.exportId, reason: 'Inspection by the directorate' });
    expect(page.rows[0]?.actorId).toBe(host.operator('SUPERVISOR').id);
  });

  it('a denied export is listed too, in the audit list and in the events', async () => {
    await host.post(LOGS_EXPORT, technician, { reason: REASON });
    const audit: AuditPage = (await host.get(`${AUDIT}?type=EXPORT_DENIED&order=DESC&limit=1`, supervisor)).json();
    expect(audit.rows[0]).toMatchObject({ actorId: host.operator('TECHNICIAN').id, details: { operationId: 'exportLogs', scope: 'LOGS' } });
    const events = (await walkEvents(host, supervisor, '?type=EXPORT_DENIED')).flatMap((page) => page.events);
    expect(events.at(-1)).toMatchObject({ type: 'EXPORT_DENIED', severity: 'WARNING' });
    expect((await host.get(`${EVENTS}?category=EXPORT&limit=200`, supervisor)).json().events.some((event: SimEvent) => event.type === 'EXPORT_DENIED')).toBe(true);
  });

  it('while the demo fault AUDIT_TAMPER is active the export is still accepted, and its row records that the VIEW did not verify', async () => {
    const operator = host.principal('SUPERVISOR');
    await host.engine.command(operator, 'inject', FaultKind.AUDIT_TAMPER);
    const head = await storedHead(owner);
    const response = await host.post(AUDIT_EXPORT, supervisor, { reason: REASON });
    expect(response.statusCode).toBe(202);
    const body: AuditExportAccepted = response.json();
    // The answer names the STORED chain, which the fault cannot reach.
    expect([body.rows, body.head]).toEqual([head.seq, head.hash]);
    const row = (await readTrail(owner)).at(-1);
    expect(row?.details).toMatchObject({ exportId: body.exportId, chainOk: false });
    await host.engine.command(operator, 'clearFault', FaultKind.AUDIT_TAMPER);
  });
});
