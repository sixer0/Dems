// Operation 60 `verifyAuditChain` against PostgreSQL, on clones of the seed (plan row W39; spec
// §7.13 "The stored check is incremental", SD-27; SR-81; AC-B-88; module gate MODG).
//
// The real app, booted, with every stage. The pool is the query spy of `support.ts`: every
// statement with the number of rows it returned. "Audit rows read" is what the ONE statement of
// the stored-chain check that returns audit rows returned (`CHAIN_READ`); every other statement
// of a call that names the audit table is listed where it matters.
//
// The tests of the first block run in order: the first call after the boot is the full pass.
import { validateCoreApiResponse, type AuditChainStatus, type AuditPage } from '@dems/shared/api';
import { FaultKind, appendAudit, chainHash, auditBody, type AuditInput, type AuditLogSlice, type AuditRow } from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase, type TestDatabase } from '../../../../test/helpers/db';
import { readTrail, recordingErrorLog, testLogger } from '../../../../test/support/core';
import { auditRowToRow } from '../../../db/mapping';
import { auditLog } from '../../../db/schema';
import { createStoredChainVerifier } from '../stored-chain';
import {
  AUDIT,
  AUDIT_CHAIN,
  CHAIN_READ,
  NAMES_AUDIT_LOG,
  auditApp,
  chainReads,
  countOf,
  outcomeOf,
  spyingPool,
  storedHead,
  type AuditApp,
  type Headers,
} from './support';

const db = useTestDatabase({ template: 'seed' });
let host: AuditApp;
let owner: Pool;
let investigator: Headers;
let supervisor: Headers;
let technician: Headers;

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

async function chain(session: Headers = investigator): Promise<AuditChainStatus> {
  const response = await host.get(AUDIT_CHAIN, session);
  expect(response.statusCode).toBe(200);
  expect(validateCoreApiResponse('verifyAuditChain', 200, response.json())).toEqual({ ok: true });
  return response.json();
}

const mark = (): number => host.database.statements.length;
/** The statements since `from` that name the audit table, as `[first words, rows returned]`. */
const auditStatements = (from: number): Array<[string, number]> =>
  host.database.statements
    .slice(from)
    .filter((entry) => NAMES_AUDIT_LOG.test(entry.text))
    .map((entry) => [entry.text.slice(0, 24), entry.rows]);

describe('operation 60: the first call after the boot is the full pass, and later calls read only what was appended', () => {
  it('nothing is remembered before the first call', () => {
    expect(host.chainStats()).toMatchObject({ calls: 0, runs: 0, fullPasses: 0, incrementalPasses: 0, rowsRead: 0, verifiedThrough: 0 });
  });

  it('the first call reads EVERY stored audit row once, and answers view, stored and an empty lineage', async () => {
    const head = await storedHead(owner);
    const from = mark();
    const status = await chain();
    expect(status).toStrictEqual({
      view: { ok: true, checked: head.seq, head: head.hash },
      stored: { ok: true, checked: head.seq, head: head.hash, firstBadSeq: null },
      lineage: [],
      lineageTotal: 0,
    });
    expect(Object.keys(status)).toEqual(['view', 'stored', 'lineage', 'lineageTotal']);
    expect(chainReads(host.database.statements, from)).toEqual([head.seq]);
    expect(host.chainStats()).toMatchObject({ calls: 1, runs: 1, fullPasses: 1, incrementalPasses: 0, rowsRead: head.seq, verifiedThrough: head.seq, firstBadSeq: null });
    console.info(`[w39] first call after the boot: full pass over ${head.seq} stored rows`);
  });

  it('a call with nothing appended reads NO audit row: one lookup of the remembered row by its key, which returns a truth value', async () => {
    const head = await storedHead(owner);
    const from = mark();
    const status = await chain();
    expect(status.stored).toEqual({ ok: true, checked: head.seq, head: head.hash, firstBadSeq: null });
    expect(chainReads(host.database.statements, from)).toEqual([]);
    expect(auditStatements(from)).toEqual([['SELECT EXISTS (SELECT 1 ', 1]]);
    expect(host.chainStats()).toMatchObject({ fullPasses: 1, incrementalPasses: 0 });
  });

  it.each([1, 4, 9])('after %i appended row(s) the call reads exactly that many audit rows', async (k) => {
    const before = host.chainStats();
    const appended = await host.appendRows(k);
    const head = await storedHead(owner);
    expect(head.seq).toBe(before.verifiedThrough + k);
    const from = mark();
    const status = await chain(supervisor);
    expect(status.stored).toEqual({ ok: true, checked: head.seq, head: appended.at(-1)?.hash, firstBadSeq: null });
    expect(chainReads(host.database.statements, from)).toEqual([k]);
    // Every statement of the call that names the audit table: the lookup of the remembered row (a truth value) and the k rows.
    expect(auditStatements(from)).toEqual([
      ['SELECT EXISTS (SELECT 1 ', 1],
      ['SELECT seq, id, at, type', k],
    ]);
    const after = host.chainStats();
    expect(after.rowsRead - before.rowsRead).toBe(k);
    expect(after.incrementalPasses - before.incrementalPasses).toBe(1);
    expect(after.fullPasses).toBe(1);
    expect(after.verifiedThrough).toBe(head.seq);
    console.info(`[w39] query spy: ${k} row(s) appended after a verification -> the next call read ${chainReads(host.database.statements, from).join()} audit row(s)`);
  });

  it('rows the ENGINE appends are read the same way: a hosted command that writes one row, then a call that reads one', async () => {
    const before = await storedHead(owner);
    await host.engine.command(host.principal('SUPERVISOR'), 'exportAudit', { reason: 'Quarterly audit review' });
    await host.app.pipeline.drain();
    expect((await storedHead(owner)).seq).toBe(before.seq + 1);
    const from = mark();
    expect((await chain()).stored).toMatchObject({ ok: true, checked: before.seq + 1 });
    expect(chainReads(host.database.statements, from)).toEqual([1]);
  });

  it('the statements of one incremental call, in order: the hosted view in its unit, the snapshot of the stored check, the lineage', async () => {
    await host.appendRows(2);
    const from = mark();
    await chain();
    const sent = host.database.statements.slice(from).map((entry) => entry.text.replace(/\s+/g, ' ').slice(0, 60));
    const snapshot = sent.slice(sent.indexOf('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
    expect(snapshot.map((text) => text.slice(0, 34))).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE R',
      'SELECT seq, hash FROM public.audit',
      'SELECT EXISTS (SELECT 1 FROM publi',
      'SELECT seq, id, at, type, category',
      'SELECT head_hash, row_count FROM a',
      'COMMIT',
      'select "epoch", "row_count", "head',
    ]);
    console.info(`[w39] one incremental call sent ${sent.length} statements:\n${sent.map((text, index) => `  ${index + 1}. ${text}`).join('\n')}`);
  });

  it('the GET changes nothing: no audit row, no event, no revision; the hosted view ran as one unit that wrote nothing', async () => {
    const before = { rows: await countOf(owner, 'audit_log'), events: await countOf(owner, 'events'), revision: host.engine.revision, units: host.app.pipeline.snapshot().completed };
    const publications = host.publications.length;
    const response = await host.get(AUDIT_CHAIN, investigator);
    expect(response.statusCode).toBe(200);
    // API-7 names the two headers for a POST; a GET carries none.
    expect(response.headers['x-dems-epoch']).toBeUndefined();
    expect(response.headers['x-dems-revision']).toBeUndefined();
    expect({ rows: await countOf(owner, 'audit_log'), events: await countOf(owner, 'events'), revision: host.engine.revision }).toEqual({ rows: before.rows, events: before.events, revision: before.revision });
    expect(host.app.pipeline.snapshot().completed).toBe(before.units + 1);
    expect(host.publications.length).toBe(publications);
  });

  it('every signed-in role may call it; a caller without a session is refused with 401, and neither the engine nor the table is asked', async () => {
    for (const session of [investigator, supervisor, technician]) expect((await host.get(AUDIT_CHAIN, session)).statusCode).toBe(200);
    const calls = host.chainStats().calls;
    const commands = host.engine.stats().commands;
    const refused = await host.get(AUDIT_CHAIN);
    expect(outcomeOf(refused)).toEqual([401, 'NOT_SIGNED_IN']);
    expect(validateCoreApiResponse('verifyAuditChain', 401, refused.json())).toEqual({ ok: true });
    expect(host.chainStats().calls).toBe(calls);
    expect(host.engine.stats().commands).toBe(commands);
  });
});

describe('operation 60: two calls that arrive together run ONE verification', () => {
  it('the second call awaits the first: one snapshot, one read of the appended rows, the same stored answer', async () => {
    await host.appendRows(3);
    const before = host.chainStats();
    const from = mark();
    const held = host.database.hold(CHAIN_READ);
    const first = host.get(AUDIT_CHAIN, investigator);
    await held.reached();
    // The first call's pass waits for its rows. The second call arrives, runs its own view and reaches the stored check.
    const second = host.get(AUDIT_CHAIN, supervisor);
    for (let turn = 0; turn < 500 && host.chainStats().calls < before.calls + 2; turn += 1) await new Promise((resolve) => setImmediate(resolve));
    expect(host.chainStats()).toMatchObject({ calls: before.calls + 2, runs: before.runs + 1 });
    held.release();

    const [a, b] = await Promise.all([first, second]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    const [x, y] = [a.json() as AuditChainStatus, b.json() as AuditChainStatus];
    expect(y.stored).toEqual(x.stored);
    expect(x.stored).toMatchObject({ ok: true, checked: before.verifiedThrough + 3 });
    // ONE snapshot and ONE read of three rows for the two calls.
    expect(host.database.statements.slice(from).filter((entry) => entry.text.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'))).toHaveLength(1);
    expect(chainReads(host.database.statements, from)).toEqual([3]);
    const after = host.chainStats();
    expect([after.runs - before.runs, after.incrementalPasses - before.incrementalPasses, after.rowsRead - before.rowsRead]).toEqual([1, 1, 3]);
    console.info(`[w39] two concurrent calls: ${after.calls - before.calls} calls, ${after.runs - before.runs} run, ${after.rowsRead - before.rowsRead} audit rows read once`);
  });

  it('ten calls at once: ten answers, and the appended rows are read once', async () => {
    await host.appendRows(5);
    const before = host.chainStats();
    const held = host.database.hold(CHAIN_READ);
    const pending = Array.from({ length: 10 }, (_, index) => host.get(AUDIT_CHAIN, [investigator, supervisor, technician][index % 3]));
    await held.reached();
    for (let turn = 0; turn < 2_000 && host.chainStats().calls < before.calls + 10; turn += 1) await new Promise((resolve) => setImmediate(resolve));
    held.release();
    const answers = await Promise.all(pending);
    expect(answers.map((answer) => answer.statusCode)).toEqual(Array<number>(10).fill(200));
    const after = host.chainStats();
    expect(after.calls - before.calls).toBe(10);
    expect(after.runs - before.runs).toBe(1);
    expect(after.rowsRead - before.rowsRead).toBe(5);
    expect(new Set(answers.map((answer) => JSON.stringify((answer.json() as AuditChainStatus).stored))).size).toBe(1);
  });
});

describe('operation 60: `view` is the engine\'s ring, `stored` is the table', () => {
  it('the demo fault AUDIT_TAMPER breaks the view and cannot reach the table: view fails at the altered row, stored verifies, and the list still delivers the stored row', async () => {
    const operator = host.principal('SUPERVISOR');
    await host.engine.command(operator, 'inject', FaultKind.AUDIT_TAMPER);
    await host.app.pipeline.drain();
    const head = await storedHead(owner);

    const tampered = await chain();
    const view = tampered.view;
    if (view.ok) throw new Error('the view verifies although the fault is active');
    expect(view).toEqual({ ok: false, checked: view.index, index: view.index, seq: view.seq, reason: 'HASH_MISMATCH' });
    expect(tampered.stored).toEqual({ ok: true, checked: head.seq, head: head.hash, firstBadSeq: null });
    expect(validateCoreApiResponse('verifyAuditChain', 200, tampered)).toEqual({ ok: true });

    // The ring's row is altered; the stored row, which the list delivers, is not.
    const ringRow = host.engine.slice('audit').rows.find((row) => row.seq === view.seq);
    const page: AuditPage = (await host.get(`${AUDIT}?order=DESC&limit=200`, investigator)).json();
    const listRow = page.rows.find((row) => row.seq === ringRow?.seq);
    expect(ringRow?.message).toMatch(/\[altered\]$/);
    expect(listRow?.message).not.toMatch(/\[altered\]$/);
    expect(chainHash(listRow?.prevHash ?? '', auditBody(listRow as AuditRow))).toBe(listRow?.hash);

    await host.engine.command(operator, 'clearFault', FaultKind.AUDIT_TAMPER);
    await host.app.pipeline.drain();
    const cleared = await chain();
    expect(cleared.view.ok).toBe(true);
    expect(cleared.stored.ok).toBe(true);
    console.info(`[w39] AUDIT_TAMPER: view ok=false at seq ${view.seq} (HASH_MISMATCH), stored ok=true through ${tampered.stored.checked}; after the fault was cleared both verify`);
  });
});

describe('operation 60: a new epoch drops what was remembered', () => {
  it('after a stop and a start of the engine the next call is a full pass again, and the one after it reads nothing', async () => {
    const epoch = host.engine.epoch;
    const before = host.chainStats();
    expect(before.verifiedThrough).toBeGreaterThan(82);
    await host.engine.stop();
    await host.engine.start('boot');
    await host.engine.idle();
    await host.app.pipeline.drain();
    expect(host.engine.epoch).toBe(epoch + 1);

    const head = await storedHead(owner);
    const from = mark();
    expect((await chain()).stored).toEqual({ ok: true, checked: head.seq, head: head.hash, firstBadSeq: null });
    expect(chainReads(host.database.statements, from)).toEqual([head.seq]);
    const after = host.chainStats();
    expect(after.fullPasses - before.fullPasses).toBe(1);
    expect(after.positionsForgotten).toBe(before.positionsForgotten);

    const again = mark();
    await chain();
    expect(chainReads(host.database.statements, again)).toEqual([]);
    console.info(`[w39] epoch ${epoch} -> ${epoch + 1}: the next call read all ${head.seq} rows again (full pass); the call after it read 0`);
  });
});

describe('operation 60: a reopened pool drops what was remembered, whatever the epoch', () => {
  it('after the pool was closed and opened again the next call is a full pass', async () => {
    const epoch = host.engine.epoch;
    await host.app.pipeline.drain();
    await host.app.db.reopen();
    expect(await host.app.db.probe({ fresh: true })).toBe(true);
    expect(host.engine.epoch).toBe(epoch);
    const head = await storedHead(owner);
    const from = mark();
    expect((await chain()).stored).toEqual({ ok: true, checked: head.seq, head: head.hash, firstBadSeq: null });
    expect(chainReads(host.database.statements, from)).toEqual([head.seq]);
  });
});

// ── The stored check against PostgreSQL, without the app ───────────────────────────────────────
//
// A stored row whose digest is wrong, and a table whose chain is not the one that was verified,
// cannot be produced through the server: the audit writer checks every digest, and no role can
// change a stored row. They are produced here as `dems_owner`, on clones nothing else uses,
// through the append protocol (the chain lock, a row that continues the head).

interface Clone {
  readonly target: TestDatabase;
  readonly owner: Pool;
  /** A spied pool of the runtime role on the clone. */
  readonly pool: Pool;
  readonly sent: ReturnType<typeof spyingPool>['statements'];
}

async function clone(slug: string): Promise<Clone> {
  const target = await db.another({ slug });
  const spy = spyingPool();
  const pool = spy.factory(target.runtime);
  target.onCleanup(() => pool.end());
  return { target, owner: target.ownerPool(), pool, sent: spy.statements };
}

/**
 * Appends rows as the owner, through the chain lock. `alter` changes a row AFTER its hash was
 * computed: its link is right (the guard trigger accepts it) and its digest is not.
 */
async function ownerAppend(pool: Pool, inputs: readonly AuditInput[], at: number, alter: (row: AuditRow) => AuditRow = (row) => row): Promise<AuditRow[]> {
  const written: AuditRow[] = [];
  await drizzle(pool).transaction(async (transaction) => {
    const head = await transaction.execute<{ seq: string; hash: string }>('SELECT seq, hash FROM public.audit_chain_lock()');
    const start = head.rows[0];
    if (start === undefined) throw new Error('no chain head');
    let log: AuditLogSlice = { rows: [], head: start.hash, total: Number(start.seq), dropped: Number(start.seq) };
    for (const input of inputs) {
      const appended = appendAudit(log, input, at, 1);
      log = appended.log;
      const stored = alter(appended.row);
      await transaction.insert(auditLog).values(auditRowToRow(stored));
      written.push(stored);
    }
  });
  return written;
}

const NOTE = (text: string): AuditInput => ({ type: 'NOTE_ADDED', message: text, actorId: 'OPR-001', details: {} });
const AT = Date.UTC(2026, 9, 1, 4, 0, 0);

describe('the stored check against PostgreSQL: a break is found where it is, and remembered', () => {
  const logger = testLogger('debug');
  afterAll(() => logger.close());

  it('a stored row whose hash is not its digest: firstBadSeq is that row, checked the row before it; repeating the call reads no audit row', async () => {
    const { owner: cloneOwner, pool, sent } = await clone('w39_break');
    await ownerAppend(cloneOwner, [NOTE('one'), NOTE('two'), NOTE('three')], AT, (row) => (row.message === 'two' ? { ...row, message: 'two [changed after hashing]' } : row));
    const head = await storedHead(cloneOwner);
    expect(head.seq).toBe(85);
    expect((await readTrail(cloneOwner)).map((row) => row.seq)).toEqual(Array.from({ length: 85 }, (_, index) => index + 1));

    const errorLog = recordingErrorLog();
    const verifier = createStoredChainVerifier({ chain: () => 'one', log: logger.log, errorLog });
    expect(await verifier.status(pool)).toEqual({ ok: false, checked: 83, head: head.hash, firstBadSeq: 84 });
    expect(chainReads(sent)).toEqual([85]);
    expect(errorLog.entries).toEqual([expect.objectContaining({ code: 'STORED_CHAIN_NOT_VERIFIED', context: { firstBadSeq: 84, headSeq: 85, kind: 'BROKEN' } })]);

    const from = sent.length;
    for (let call = 0; call < 3; call += 1) expect(await verifier.status(pool)).toEqual({ ok: false, checked: 83, head: head.hash, firstBadSeq: 84 });
    expect(sent.slice(from).map((entry) => entry.text)).toEqual(Array<string>(3).fill('SELECT seq, hash FROM public.audit_chain_head'));
    expect(errorLog.entries).toHaveLength(1);
  });

  it('a break in rows appended AFTER a verification: the incremental pass finds it at its own sequence and reads only the new rows', async () => {
    const { owner: cloneOwner, pool, sent } = await clone('w39_break_late');
    const verifier = createStoredChainVerifier({ chain: () => 'one', log: logger.log, errorLog: recordingErrorLog() });
    expect(await verifier.status(pool)).toMatchObject({ ok: true, checked: 82 });
    await ownerAppend(cloneOwner, [NOTE('one'), NOTE('two'), NOTE('three'), NOTE('four')], AT, (row) => (row.message === 'three' ? { ...row, details: { changed: true } } : row));
    const from = sent.length;
    expect(await verifier.status(pool)).toMatchObject({ ok: false, checked: 84, firstBadSeq: 85 });
    expect(chainReads(sent, from)).toEqual([4]);
  });

  it('the remembered position no longer names its stored row: another chain stands under the same name; a full pass runs and verifies what is there', async () => {
    const first = await clone('w39_chain_a');
    const second = await clone('w39_chain_b');
    await ownerAppend(first.owner, [NOTE('a1'), NOTE('a2'), NOTE('a3')], AT);
    await ownerAppend(second.owner, [NOTE('b1'), NOTE('b2'), NOTE('b3'), NOTE('b4'), NOTE('b5')], AT + 1);
    const verifier = createStoredChainVerifier({ chain: () => 'the same chain, as far as the server knows', log: logger.log, errorLog: recordingErrorLog() });

    expect(await verifier.status(first.pool)).toMatchObject({ ok: true, checked: 85 });
    // The same verifier, now on a table whose row 85 has another hash.
    const head = await storedHead(second.owner);
    expect(await verifier.status(second.pool)).toEqual({ ok: true, checked: 87, head: head.hash, firstBadSeq: null });
    // Not the two rows above sequence 85: all 87.
    expect(chainReads(second.sent)).toEqual([87]);
    expect(verifier.stats()).toMatchObject({ positionsForgotten: 1, fullPasses: 2, incrementalPasses: 0, verifiedThrough: 87 });
  });

  it('... and when that other chain has a break, the full pass reports it as the break it is', async () => {
    const first = await clone('w39_chain_c');
    const second = await clone('w39_chain_d');
    await ownerAppend(first.owner, [NOTE('c1'), NOTE('c2'), NOTE('c3')], AT);
    await ownerAppend(second.owner, [NOTE('d1'), NOTE('d2'), NOTE('d3'), NOTE('d4')], AT + 1, (row) => (row.message === 'd1' ? { ...row, message: 'd1 [changed after hashing]' } : row));
    const verifier = createStoredChainVerifier({ chain: () => 'one', log: logger.log, errorLog: recordingErrorLog() });
    expect(await verifier.status(first.pool)).toMatchObject({ ok: true, checked: 85 });
    expect(await verifier.status(second.pool)).toMatchObject({ ok: false, checked: 82, firstBadSeq: 83 });
    expect(chainReads(second.sent)).toEqual([86]);
  });
});
