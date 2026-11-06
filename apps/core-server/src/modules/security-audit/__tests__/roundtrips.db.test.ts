// Measured round trips of one call of each operation (plan row W39; rule M13 of the gate
// report). The real app on a clone of the seed; the query spy lists every statement the server
// sent for ONE request, over every connection: stage 4's session lookup, the read or the unit of
// work, the answer. The counts are asserted as upper bounds, so that a statement added by another
// row's stage does not turn this file red; the lists are printed for the document.
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { AUDIT, AUDIT_CHAIN, AUDIT_EXPORT, EVENTS, LOGS_EXPORT, SECURITY_STATUS, auditApp, storedHead, type AuditApp, type Headers, type SentStatement } from './support';

const db = useTestDatabase({ template: 'seed' });
let host: AuditApp;
let owner: Pool;
let supervisor: Headers;

beforeAll(async () => {
  owner = db.ownerPool();
  host = await auditApp(db, db.run.dataDir);
  supervisor = await host.signIn('SUPERVISOR');
  await host.app.pipeline.drain();
});

beforeEach(() => {
  host.forgetCounters();
});

const short = (entry: SentStatement): string => `${entry.text.replace(/\s+/g, ' ').slice(0, 78)} [${entry.rows}]`;

async function measured(label: string, send: () => Promise<{ statusCode: number }>, expected: number, atMost: number): Promise<SentStatement[]> {
  await host.app.pipeline.drain();
  const from = host.database.statements.length;
  const began = performance.now();
  const response = await send();
  const elapsed = performance.now() - began;
  await host.app.pipeline.drain();
  const sent = host.database.statements.slice(from);
  expect(response.statusCode, label).toBe(expected);
  expect(sent.length, label).toBeLessThanOrEqual(atMost);
  console.info(`[w39] round trips, ${label}: ${sent.length} statements, ${elapsed.toFixed(1)} ms in-process\n${sent.map((entry, index) => `    ${String(index + 1).padStart(2)}. ${short(entry)}`).join('\n')}`);
  return sent;
}

describe('one call of each operation, statement by statement', () => {
  it('58 getSecurityStatus: the session lookup and ONE statement of the module', async () => {
    const sent = await measured('58 getSecurityStatus', () => host.get(SECURITY_STATUS, supervisor), 200, 4);
    expect(sent.filter((entry) => /audit_chain_head/.test(entry.text))).toHaveLength(1);
  });

  it('59 listAuditRows: one snapshot of three or four statements between begin and commit', async () => {
    const first = await measured('59 listAuditRows, first page of 50', () => host.get(AUDIT, supervisor), 200, 8);
    expect(first.filter((entry) => /"audit_log"/.test(entry.text))).toHaveLength(1);
    const page = (await host.get(`${AUDIT}?limit=5`, supervisor)).json() as { nextCursor: string };
    const next = await measured('59 listAuditRows, a page of 5 with a cursor', () => host.get(`${AUDIT}?limit=5&cursor=${page.nextCursor}`, supervisor), 200, 9);
    expect(next.filter((entry) => /"audit_log"/.test(entry.text))).toHaveLength(2);
  });

  it('63 listEvents: one snapshot', async () => {
    const sent = await measured('63 listEvents, first page of 50', () => host.get(EVENTS, supervisor), 200, 7);
    expect(sent.filter((entry) => /"events"/.test(entry.text))).toHaveLength(1);
  });

  it('60 verifyAuditChain: the unit of the view, the snapshot of the stored check, the lineage', async () => {
    const head = await storedHead(owner);
    const full = await measured(`60 verifyAuditChain, first call (full pass over ${head.seq} rows)`, () => host.get(AUDIT_CHAIN, supervisor), 200, 16);
    expect(full.some((entry) => entry.rows === head.seq)).toBe(true);
    await host.appendRows(2);
    await measured('60 verifyAuditChain, after 2 appended rows', () => host.get(AUDIT_CHAIN, supervisor), 200, 17);
    await measured('60 verifyAuditChain, nothing appended', () => host.get(AUDIT_CHAIN, supervisor), 200, 16);
  });

  it('61 exportAudit and 62 exportLogs: ONE unit of work each, written by the engine host', async () => {
    const audit = await measured('61 exportAudit, accepted', () => host.post(AUDIT_EXPORT, supervisor, { reason: 'Quarterly audit review' }), 202, 16);
    expect(audit.filter((entry) => entry.text.startsWith('BEGIN'))).toHaveLength(1);
    await measured('62 exportLogs, accepted', () => host.post(LOGS_EXPORT, supervisor, { reason: 'Quarterly audit review' }), 202, 16);
    const refused = await measured('61 exportAudit, without a reason (422 INVALID_REASON)', () => host.post(AUDIT_EXPORT, supervisor, {}), 422, 12);
    expect(refused.some((entry) => /insert/i.test(entry.text))).toBe(false);
  });
});
