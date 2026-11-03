// The bookkeeping of the incremental stored-chain check (plan row W39; spec §7.13, SD-27;
// SR-81; AC-B-88). No database: the pool is an in-memory table that answers exactly the
// statements the verifier and the ONE stored-chain check (`checkStoredChain`, with the mapping
// module's digest check) send, and records each with the number of rows it returned. The rows
// are built by the shared chain code, so a row verifies or fails for the real reason.
//
// The same behaviour against PostgreSQL, through the route, is in `chain.db.test.ts`.
import { AuditType, GENESIS_HASH, appendAudit, type AuditLogSlice, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { recordingErrorLog, testLogger, type RecordingErrorLog } from '../../../../test/support/core';
import { auditRowToRow, verifyStoredAuditRows } from '../../../db/mapping';
import type { AuditLogRow } from '../../../db/schema';
import { createStoredChainVerifier, type StoredChainVerifier } from '../stored-chain';

const T0 = Date.UTC(2026, 9, 1, 3, 0, 0);

/** A valid chain of `count` rows, built by the shared code; `salt` makes another chain of the same length. */
function chainOf(count: number, salt = 'a'): AuditRow[] {
  let log: AuditLogSlice = { rows: [], head: GENESIS_HASH, total: 0, dropped: 0 };
  const rows: AuditRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const appended = appendAudit(log, { type: AuditType.MARKER_ADDED, message: `Marker ${index + 1} of chain ${salt}`, details: { index } }, T0 + index, count + 1);
    log = appended.log;
    rows.push(appended.row);
  }
  return rows;
}

/** Rows that continue `rows`. */
function extend(rows: readonly AuditRow[], more: number, salt = 'x'): AuditRow[] {
  const last = rows.at(-1);
  let log: AuditLogSlice = { rows: [], head: last?.hash ?? GENESIS_HASH, total: last?.seq ?? 0, dropped: last?.seq ?? 0 };
  const all = [...rows];
  for (let index = 0; index < more; index += 1) {
    const appended = appendAudit(log, { type: AuditType.NOTE_ADDED, message: `Note ${salt}${index}`, details: {} }, T0 + 10_000 + all.length, 1);
    log = appended.log;
    all.push(appended.row);
  }
  return all;
}

interface Sent {
  readonly text: string;
  /** Rows the statement returned. */
  readonly rows: number;
}

interface Table {
  rows: AuditLogRow[];
  head: { seq: number; hash: string };
  /** The newest lineage row, when the table has one. */
  lineage: { head_hash: string; row_count: string } | null;
}

interface FakeDatabase {
  readonly pool: Pick<Pool, 'connect' | 'query'>;
  readonly sent: Sent[];
  readonly table: Table;
  /** Replaces the stored chain; the head follows its newest row unless one is given. */
  store(rows: readonly AuditRow[], head?: { seq: number; hash: string }): void;
  /** The next statement whose text matches waits until `release` is called. */
  hold(pattern: RegExp): { release(): void; reached(): Promise<void> };
  /** The next statement whose text matches rejects with an error that carries `code`. */
  failNext(pattern: RegExp, code?: string): void;
  connections(): { opened: number; released: number; destroyed: number };
}

const CHAIN_READ = /FROM \(SELECT \* FROM audit_log ORDER BY seq DESC LIMIT \$1\)/;
/** The erasure ledger of migration 0036, read by the same check (B-8) right after the rows. */
const PURGE_LEDGER = 'SELECT first_seq, last_seq FROM public.audit_purge_log ORDER BY first_seq';

function record(row: AuditLogRow): Record<string, unknown> {
  return {
    seq: String(row.seq),
    id: row.id,
    at: String(row.at),
    type: row.type,
    category: row.category,
    severity: row.severity,
    actor_id: row.actorId,
    message: row.message,
    session_id: row.sessionId,
    evidence_id: row.evidenceId,
    device_id: row.deviceId,
    details: row.details,
    prev_hash: row.prevHash,
    hash: row.hash,
  };
}

function fakeDatabase(): FakeDatabase {
  const table: Table = { rows: [], head: { seq: 0, hash: GENESIS_HASH }, lineage: null };
  const sent: Sent[] = [];
  const holds: Array<{ pattern: RegExp; gate: Promise<void>; reached: () => void }> = [];
  const failures: Array<{ pattern: RegExp; code: string }> = [];
  const counts = { opened: 0, released: 0, destroyed: 0 };

  async function answer(view: Table, text: string, values: readonly unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> {
    const failing = failures.findIndex((entry) => entry.pattern.test(text));
    if (failing >= 0) {
      const [failure] = failures.splice(failing, 1);
      sent.push({ text, rows: 0 });
      throw Object.assign(new Error('statement failed by the test'), { code: failure?.code });
    }
    const held = holds.findIndex((entry) => entry.pattern.test(text));
    if (held >= 0) {
      const [entry] = holds.splice(held, 1);
      entry?.reached();
      await entry?.gate;
    }
    let rows: Record<string, unknown>[] = [];
    if (text === 'SELECT seq, hash FROM public.audit_chain_head') {
      rows = [{ seq: String(view.head.seq), hash: view.head.hash }];
    } else if (text.startsWith('SELECT EXISTS (SELECT 1 FROM public.audit_log WHERE seq = $1 AND hash = $2)')) {
      rows = [{ holds: view.rows.some((row) => row.seq === values[0] && row.hash === values[1]) }];
    } else if (CHAIN_READ.test(text)) {
      const limit = Number(values[0]);
      rows = (limit <= 0 ? [] : view.rows.slice(-limit)).map(record);
    } else if (text === PURGE_LEDGER) {
      // A chain without the ledger has never been purged: no range is named, so no gap is forgiven (0036).
      rows = [];
    } else if (text.includes('FROM audit_chain_history ORDER BY reset_no DESC LIMIT 1')) {
      rows = view.lineage === null ? [] : [view.lineage];
    } else if (text.includes("WHERE type = 'SCENARIO_LOADED'")) {
      rows = view.rows
        .filter((row) => row.type === 'SCENARIO_LOADED' && row.details['previousHead'] === values[0])
        .map((row) => ({ previous_rows: String(row.details['previousRows']) }));
    } else if (!/^(BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY|COMMIT|ROLLBACK)$/.test(text)) {
      throw new Error(`the fake database does not know this statement: ${text}`);
    }
    sent.push({ text, rows: rows.length });
    return { rows };
  }

  const pool = {
    query: (text: string, values?: readonly unknown[]) => answer(table, text, values),
    connect: async () => {
      counts.opened += 1;
      // A snapshot: what the table held when the transaction began.
      let view: Table = table;
      return {
        query: (text: string, values?: readonly unknown[]) => {
          if (text.startsWith('BEGIN')) view = { rows: [...table.rows], head: { ...table.head }, lineage: table.lineage };
          return answer(view, text, values);
        },
        release: (destroy?: boolean) => {
          counts.released += 1;
          if (destroy === true) counts.destroyed += 1;
        },
      };
    },
  } as unknown as Pick<Pool, 'connect' | 'query'>;

  return {
    pool,
    sent,
    table,
    store(rows, head) {
      table.rows = rows.map(auditRowToRow);
      const last = rows.at(-1);
      table.head = head ?? { seq: last?.seq ?? 0, hash: last?.hash ?? GENESIS_HASH };
    },
    hold(pattern) {
      let release = (): void => {};
      let reached = (): void => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const arrived = new Promise<void>((resolve) => {
        reached = resolve;
      });
      holds.push({ pattern, gate, reached });
      return { release, reached: () => arrived };
    },
    failNext: (pattern, code = '08006') => void failures.push({ pattern, code }),
    connections: () => ({ ...counts }),
  };
}

const logger = testLogger('debug');
afterAll(() => logger.close());

let database: FakeDatabase;
let errorLog: RecordingErrorLog;
let chainName: string;
let verifier: StoredChainVerifier;
let logStart: number;

beforeEach(() => {
  database = fakeDatabase();
  errorLog = recordingErrorLog();
  chainName = 'epoch-1:1';
  verifier = createStoredChainVerifier({ chain: () => chainName, log: logger.log, errorLog });
  logStart = logger.captured.lines().length;
});

/** The statements sent since `from`, with the rows each returned. */
const sentSince = (from: number): Sent[] => database.sent.slice(from);
/** Audit rows the chain statement returned since `from`. */
const chainRowsSince = (from: number): number[] => sentSince(from).filter((entry) => CHAIN_READ.test(entry.text)).map((entry) => entry.rows);
const logLines = (): Array<Record<string, unknown>> => logger.captured.lines().slice(logStart);
const codes = (): unknown[] => logLines().map((line) => line['code']).filter((code) => code !== undefined);

describe('what this file reads from the one digest check: a typed verdict', () => {
  it('a verdict of verifyStoredAuditRows names the reason code and the sequence of the first bad row as members of their own', () => {
    const rows = chainOf(6).map(auditRowToRow);
    const altered = rows.map((row) => (row.seq === 4 ? { ...row, message: `${row.message} [altered]` } : row));
    const last = rows.at(-1);
    expect(verifyStoredAuditRows(rows, { dropped: 0, head: last?.hash ?? '' })).toEqual({ ok: true });
    // `seq` is what `firstBadSeq` is taken from; the text is for a log line and is no longer read back (finding F-2).
    expect(verifyStoredAuditRows(altered, { dropped: 0, head: last?.hash ?? '' })).toEqual({ ok: false, code: 'HASH_MISMATCH', seq: 4, reason: 'HASH_MISMATCH at sequence 4' });
    expect(verifyStoredAuditRows([...rows.slice(0, 2), ...rows.slice(3)], { dropped: 0, head: last?.hash ?? '' })).toEqual({
      ok: false,
      code: 'PREV_LINK_BROKEN',
      seq: 4,
      reason: 'PREV_LINK_BROKEN at sequence 4',
    });
  });
});

describe('nothing remembered: a full pass from the first row', () => {
  it('an empty chain verifies without a pass: checked 0, the genesis head', async () => {
    expect(await verifier.status(database.pool)).toEqual({ ok: true, checked: 0, head: GENESIS_HASH, firstBadSeq: null });
    expect(chainRowsSince(0)).toEqual([]);
    expect(verifier.stats()).toMatchObject({ calls: 1, runs: 1, fullPasses: 0, incrementalPasses: 0, rowsRead: 0 });
  });

  it('the first call reads every stored row once, in one read-only snapshot, and remembers the head', async () => {
    const rows = chainOf(40);
    database.store(rows);
    const status = await verifier.status(database.pool);
    expect(status).toEqual({ ok: true, checked: 40, head: rows[39]?.hash, firstBadSeq: null });
    expect(database.sent.map((entry) => entry.text.split(' FROM ')[0])).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'SELECT seq, hash',
      'SELECT seq, id, at, type, category, severity, actor_id, message, session_id, evidence_id, device_id, details, prev_hash, hash',
      // REVISED 2026-11-02 (principal): B-8 now reads the erasure ledger of migration 0036 right after
      // its rows, so the pass sends one statement more — a chain with no ledger has no forgiven gap.
      'SELECT first_seq, last_seq',
      'SELECT head_hash, row_count',
      'COMMIT',
    ]);
    expect(chainRowsSince(0)).toEqual([40]);
    expect(verifier.stats()).toMatchObject({ fullPasses: 1, incrementalPasses: 0, rowsRead: 40, verifiedThrough: 40, firstBadSeq: null });
    expect(database.connections()).toEqual({ opened: 1, released: 1, destroyed: 0 });
  });
});

describe('verified through a position: a later call reads only the rows above it', () => {
  it.each([1, 3, 17])('after %i appended row(s) the call reads exactly that many audit rows', async (k) => {
    const rows = chainOf(40);
    database.store(rows);
    await verifier.status(database.pool);
    const longer = extend(rows, k);
    database.store(longer);
    const mark = database.sent.length;

    const status = await verifier.status(database.pool);
    expect(status).toEqual({ ok: true, checked: 40 + k, head: longer.at(-1)?.hash, firstBadSeq: null });
    expect(chainRowsSince(mark)).toEqual([k]);
    // One lookup of the remembered row by its key, which returns a truth value and no row body.
    expect(sentSince(mark).filter((entry) => entry.text.startsWith('SELECT EXISTS'))).toHaveLength(1);
    expect(verifier.stats()).toMatchObject({ fullPasses: 1, incrementalPasses: 1, rowsRead: 40 + k, verifiedThrough: 40 + k });
  });

  it('with nothing appended the call reads no audit row at all', async () => {
    const rows = chainOf(12);
    database.store(rows);
    await verifier.status(database.pool);
    const mark = database.sent.length;
    expect(await verifier.status(database.pool)).toEqual({ ok: true, checked: 12, head: rows[11]?.hash, firstBadSeq: null });
    expect(chainRowsSince(mark)).toEqual([]);
    expect(sentSince(mark).map((entry) => entry.text.slice(0, 13))).toEqual(['BEGIN ISOLATI', 'SELECT seq, h', 'SELECT EXISTS', 'COMMIT']);
    expect(verifier.stats()).toMatchObject({ fullPasses: 1, incrementalPasses: 0, rowsRead: 12 });
  });

  it('three calls with rows between them: 40, then 5, then 2 rows read; never a row twice', async () => {
    let rows = chainOf(40);
    database.store(rows);
    await verifier.status(database.pool);
    rows = extend(rows, 5, 'p');
    database.store(rows);
    await verifier.status(database.pool);
    rows = extend(rows, 2, 'q');
    database.store(rows);
    const status = await verifier.status(database.pool);
    expect(status).toMatchObject({ ok: true, checked: 47 });
    expect(chainRowsSince(0)).toEqual([40, 5, 2]);
  });

  it('rows appended WHILE a pass runs are not part of it: the snapshot is of the instant the pass began, and the next call reads them', async () => {
    const rows = chainOf(10);
    database.store(rows);
    await verifier.status(database.pool);
    const longer = extend(rows, 4);
    database.store(longer);
    const held = database.hold(CHAIN_READ);
    const pending = verifier.status(database.pool);
    await held.reached();
    // Three more rows land while the pass waits for its rows.
    const longest = extend(longer, 3, 'late');
    database.store(longest);
    held.release();
    expect(await pending).toMatchObject({ ok: true, checked: 14, head: longer.at(-1)?.hash });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 17, head: longest.at(-1)?.hash });
    expect(chainRowsSince(0)).toEqual([10, 4, 3]);
  });
});

describe('calls that arrive together run ONE verification', () => {
  it('the second call awaits the first: one snapshot, one read of the rows, the same answer', async () => {
    database.store(chainOf(25));
    const held = database.hold(CHAIN_READ);
    const first = verifier.status(database.pool);
    await held.reached();
    const second = verifier.status(database.pool);
    const third = verifier.status(database.pool);
    expect(verifier.stats()).toMatchObject({ calls: 3, runs: 1 });
    held.release();
    const answers = await Promise.all([first, second, third]);
    expect(answers[1]).toBe(answers[0]);
    expect(answers[2]).toBe(answers[0]);
    expect(answers[0]).toMatchObject({ ok: true, checked: 25 });
    expect(database.sent.filter((entry) => entry.text.startsWith('BEGIN'))).toHaveLength(1);
    expect(chainRowsSince(0)).toEqual([25]);
    expect(database.connections()).toEqual({ opened: 1, released: 1, destroyed: 0 });
  });

  it('a call after the run has ended starts a new one', async () => {
    database.store(chainOf(5));
    await Promise.all([verifier.status(database.pool), verifier.status(database.pool)]);
    await verifier.status(database.pool);
    expect(verifier.stats()).toMatchObject({ calls: 3, runs: 2, fullPasses: 1 });
  });

  it('a run that fails is shared too, and the next call starts afresh', async () => {
    database.store(chainOf(5));
    database.failNext(CHAIN_READ);
    const [first, second] = await Promise.allSettled([verifier.status(database.pool), verifier.status(database.pool)]);
    expect(first.status).toBe('rejected');
    expect(second.status).toBe('rejected');
    expect(verifier.stats()).toMatchObject({ calls: 2, runs: 1, verifiedThrough: 0 });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 5 });
  });
});

describe('a new chain forgets everything', () => {
  it('when the name of the chain changes (a start, a reset, a reload) the next call is a full pass', async () => {
    const rows = chainOf(30);
    database.store(rows);
    await verifier.status(database.pool);
    await verifier.status(database.pool);
    expect(chainRowsSince(0)).toEqual([30]);

    chainName = 'epoch-2:1';
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 30 });
    expect(chainRowsSince(0)).toEqual([30, 30]);
    expect(verifier.stats()).toMatchObject({ fullPasses: 2, positionsForgotten: 0 });
  });

  it('a remembered break is forgotten with the chain', async () => {
    const rows = chainOf(8);
    database.store(rows.map((row) => (row.seq === 3 ? { ...row, message: 'altered' } : row)));
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, firstBadSeq: 3 });
    chainName = 'epoch-2:2';
    database.store(chainOf(8, 'b'));
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 8, firstBadSeq: null });
  });

  it('what a run learnt is not kept when the chain changed while it ran', async () => {
    database.store(chainOf(9));
    const held = database.hold(CHAIN_READ);
    const pending = verifier.status(database.pool);
    await held.reached();
    chainName = 'epoch-2:1';
    held.release();
    expect(await pending).toMatchObject({ ok: true, checked: 9 });
    expect(verifier.stats().verifiedThrough).toBe(0);
  });
});

describe('the remembered position no longer names its stored row', () => {
  it('another chain of the same length stands in the table: the position is given up and a full pass verifies the chain that is there', async () => {
    database.store(chainOf(20, 'a'));
    await verifier.status(database.pool);
    const other = chainOf(23, 'b');
    database.store(other);
    const mark = database.sent.length;

    expect(await verifier.status(database.pool)).toEqual({ ok: true, checked: 23, head: other.at(-1)?.hash, firstBadSeq: null });
    // Not the 3 rows above sequence 20: all 23.
    expect(chainRowsSince(mark)).toEqual([23]);
    expect(verifier.stats()).toMatchObject({ positionsForgotten: 1, fullPasses: 2, incrementalPasses: 0, verifiedThrough: 23 });
    expect(codes()).toContain('STORED_CHAIN_POSITION_FORGOTTEN');
  });

  it('the full pass reports the break where it is, not at the remembered position', async () => {
    database.store(chainOf(20, 'a'));
    await verifier.status(database.pool);
    const other = chainOf(23, 'b').map((row) => (row.seq === 7 ? { ...row, message: 'altered' } : row));
    database.store(other);
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 6, firstBadSeq: 7 });
  });

  it('the table is shorter than the remembered position: given up, full pass', async () => {
    database.store(chainOf(20, 'a'));
    await verifier.status(database.pool);
    const shorter = chainOf(4, 'a');
    database.store(shorter);
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 4 });
    expect(verifier.stats()).toMatchObject({ positionsForgotten: 1, fullPasses: 2 });
  });

  it('the head has fallen below the position although its row is there: given up; the full pass cannot cover a chain whose head lags its rows', async () => {
    const rows = chainOf(20, 'a');
    database.store(rows);
    await verifier.status(database.pool);
    database.store(rows, { seq: 10, hash: rows[9]?.hash ?? '' });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, firstBadSeq: 1 });
    expect(verifier.stats()).toMatchObject({ positionsForgotten: 1, fullPasses: 2 });
  });

  it('the table is EMPTY where a position was verified: given up; an empty chain verifies only with the genesis head', async () => {
    database.store(chainOf(6, 'a'));
    await verifier.status(database.pool);
    // The head says "no row" and holds the genesis hash: an empty chain, which verifies.
    database.store([]);
    expect(await verifier.status(database.pool)).toEqual({ ok: true, checked: 0, head: GENESIS_HASH, firstBadSeq: null });
    expect(verifier.stats()).toMatchObject({ positionsForgotten: 1, fullPasses: 1, verifiedThrough: 0 });

    // The same with a head that says "no row" and holds another hash: a break at the first sequence.
    const second = createStoredChainVerifier({ chain: () => 'another', log: logger.log, errorLog });
    database.store(chainOf(6, 'a'));
    await second.status(database.pool);
    database.store([], { seq: 0, hash: 'c'.repeat(64) });
    expect(await second.status(database.pool)).toEqual({ ok: false, checked: 0, head: 'c'.repeat(64), firstBadSeq: 1 });
    expect(second.stats()).toMatchObject({ positionsForgotten: 1, firstBadSeq: 1 });
  });

  it('the rows above the position do not continue it: given up, and the full pass names the row that does not link', async () => {
    const rows = chainOf(10, 'a');
    database.store(rows);
    await verifier.status(database.pool);
    // Rows 11 to 13 of ANOTHER chain behind the ten that verified: row 11 names a hash that is not row 10's.
    const foreign = chainOf(13, 'b').slice(10);
    database.store([...rows, ...foreign]);
    const mark = database.sent.length;
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 10, firstBadSeq: 11 });
    // The incremental pass read 3 rows and proved nothing; the full pass read all 13.
    expect(chainRowsSince(mark)).toEqual([3, 13]);
    expect(verifier.stats()).toMatchObject({ positionsForgotten: 1, incrementalPasses: 1, fullPasses: 2 });
  });
});

describe('a break', () => {
  it('in the first full pass: the first bad sequence, verified through the row before it, one error line and one persistent entry', async () => {
    const rows = chainOf(30);
    database.store(rows.map((row) => (row.seq === 18 ? { ...row, message: `${row.message} [altered]` } : row)));
    expect(await verifier.status(database.pool)).toEqual({ ok: false, checked: 17, head: rows[29]?.hash, firstBadSeq: 18 });
    expect(verifier.stats()).toMatchObject({ firstBadSeq: 18, verifiedThrough: 17 });
    expect(logLines().filter((line) => line['code'] === 'STORED_CHAIN_NOT_VERIFIED')).toEqual([
      expect.objectContaining({ level: 50, firstBadSeq: 18, headSeq: 30, kind: 'BROKEN', msg: 'the stored audit chain does not verify' }),
    ]);
    expect(errorLog.entries).toEqual([
      {
        level: 'error',
        source: 'securityAudit.storedChain',
        message: 'the stored audit chain does not verify',
        code: 'STORED_CHAIN_NOT_VERIFIED',
        context: { firstBadSeq: 18, headSeq: 30, kind: 'BROKEN' },
      },
    ]);
  });

  it('is remembered: repeating the call reads no audit row, opens no snapshot and logs nothing more', async () => {
    const rows = chainOf(30);
    database.store(rows.map((row) => (row.seq === 18 ? { ...row, message: 'altered' } : row)));
    await verifier.status(database.pool);
    const mark = database.sent.length;
    for (let call = 0; call < 5; call += 1) expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 17, firstBadSeq: 18 });
    expect(sentSince(mark).map((entry) => entry.text)).toEqual(Array<string>(5).fill('SELECT seq, hash FROM public.audit_chain_head'));
    expect(database.connections().opened).toBe(1);
    expect(errorLog.entries).toHaveLength(1);
  });

  it('a remembered break still answers the CURRENT head hash', async () => {
    const rows = chainOf(6).map((row) => (row.seq === 2 ? { ...row, message: 'altered' } : row));
    database.store(rows);
    await verifier.status(database.pool);
    const longer = extend(rows, 2);
    database.store(longer);
    expect(await verifier.status(database.pool)).toEqual({ ok: false, checked: 1, head: longer.at(-1)?.hash, firstBadSeq: 2 });
  });

  it('in the rows above the position: found by the incremental pass, at its own sequence', async () => {
    const rows = chainOf(40);
    database.store(rows);
    await verifier.status(database.pool);
    const longer = extend(rows, 6).map((row) => (row.seq === 43 ? { ...row, details: { altered: true } } : row));
    database.store(longer);
    const mark = database.sent.length;
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 42, firstBadSeq: 43 });
    expect(chainRowsSince(mark)).toEqual([6]);
    expect(verifier.stats()).toMatchObject({ firstBadSeq: 43, verifiedThrough: 42 });
  });

  it('a row whose stored hash is not its digest and the row after it, which names that hash: the first of the two is reported', async () => {
    const rows = chainOf(5);
    const forged = 'f'.repeat(64);
    database.store(rows.map((row) => (row.seq === 3 ? { ...row, hash: forged } : row.seq === 4 ? { ...row, prevHash: forged } : row)));
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 2, firstBadSeq: 3 });
  });

  it('the first stored row does not start at the genesis hash', async () => {
    const rows = chainOf(4).map((row) => (row.seq === 1 ? { ...row, prevHash: 'e'.repeat(64) } : row));
    database.store(rows);
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 0, firstBadSeq: 1 });
  });
});

describe('a full pass that does not cover the chain has found a break', () => {
  it('the first rows are missing: reported at sequence 1', async () => {
    const rows = chainOf(9);
    database.store(rows.slice(2), { seq: 9, hash: rows[8]?.hash ?? '' });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 0, firstBadSeq: 1 });
    expect(logLines().find((line) => line['code'] === 'STORED_CHAIN_NOT_VERIFIED')).toMatchObject({ kind: 'NOT_COVERED' });
  });

  it('a row in the middle is missing: reported at the row after the gap, by the one chain check', async () => {
    const rows = chainOf(9);
    database.store([...rows.slice(0, 4), ...rows.slice(5)], { seq: 9, hash: rows[8]?.hash ?? '' });
    // 8 rows are stored and 9 are due; the newest 9 are those 8, whose fifth names sequence 6.
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 5, firstBadSeq: 6 });
  });

  it('the head names a sequence beyond the newest stored row', async () => {
    const rows = chainOf(9);
    database.store(rows.slice(0, 7), { seq: 9, hash: rows[8]?.hash ?? '' });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 7, firstBadSeq: 8 });
  });

  it('the head names another hash than the newest stored row', async () => {
    const rows = chainOf(9);
    database.store(rows, { seq: 9, hash: 'd'.repeat(64) });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 8, firstBadSeq: 9, head: 'd'.repeat(64) });
  });

  it('the head says the chain is empty and is not the genesis hash', async () => {
    database.store([], { seq: 0, hash: 'c'.repeat(64) });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 0, firstBadSeq: 1 });
  });

  it('the head says rows exist and the table holds none', async () => {
    database.store([], { seq: 3, hash: 'c'.repeat(64) });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 0, firstBadSeq: 1 });
  });

  it('after a verified position the head moves to another hash without a new row: given up, and the full pass reports the head', async () => {
    const rows = chainOf(6);
    database.store(rows);
    await verifier.status(database.pool);
    database.store(rows, { seq: 6, hash: 'b'.repeat(64) });
    expect(await verifier.status(database.pool)).toMatchObject({ ok: false, checked: 5, firstBadSeq: 6 });
    expect(verifier.stats()).toMatchObject({ positionsForgotten: 1 });
  });
});

describe('the database fails', () => {
  it('a statement of the pass fails: the call rejects, the transaction is rolled back, the connection goes back, nothing is remembered', async () => {
    database.store(chainOf(12));
    database.failNext(CHAIN_READ, '57014');
    await expect(verifier.status(database.pool)).rejects.toMatchObject({ code: '57014' });
    expect(database.sent.at(-1)?.text).toBe('ROLLBACK');
    expect(database.connections()).toEqual({ opened: 1, released: 1, destroyed: 0 });
    expect(verifier.stats()).toMatchObject({ verifiedThrough: 0, firstBadSeq: null });
    expect(errorLog.entries).toEqual([]);
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 12 });
  });

  it('the rollback fails too: the connection is not handed back to the pool', async () => {
    database.store(chainOf(12));
    database.failNext(/^SELECT seq, hash/);
    database.failNext(/^ROLLBACK$/);
    await expect(verifier.status(database.pool)).rejects.toMatchObject({ code: '08006' });
    expect(database.connections()).toEqual({ opened: 1, released: 1, destroyed: 1 });
  });

  it('a failure after a verified position keeps the position: the next call is incremental', async () => {
    const rows = chainOf(12);
    database.store(rows);
    await verifier.status(database.pool);
    database.store(extend(rows, 2));
    database.failNext(/^SELECT EXISTS/);
    await expect(verifier.status(database.pool)).rejects.toBeDefined();
    const mark = database.sent.length;
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 14 });
    expect(chainRowsSince(mark)).toEqual([2]);
  });
});

describe('the lineage rule LN-3 is logged, not answered', () => {
  it('a newest lineage row that no SCENARIO_LOADED row of the chain names: one warning per chain, and the chain still verifies', async () => {
    const rows = chainOf(5);
    database.store(rows);
    database.table.lineage = { head_hash: 'a'.repeat(64), row_count: '97' };
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 5 });
    database.store(extend(rows, 1));
    expect(await verifier.status(database.pool)).toMatchObject({ ok: true, checked: 6 });
    expect(codes().filter((code) => code === 'LINEAGE_MISMATCH')).toHaveLength(1);
    expect(errorLog.entries).toEqual([]);
  });
});

describe('what the log holds', () => {
  it('sequence numbers, counts and codes; never a message, a detail or a hash of a row', async () => {
    const rows = chainOf(8).map((row) => (row.seq === 5 ? { ...row, message: 'MARK-message-of-a-row' } : row));
    database.store(rows);
    await verifier.status(database.pool);
    const text = JSON.stringify([logLines(), errorLog.entries]);
    expect(text).not.toContain('MARK-');
    expect(text).not.toContain('Marker');
    for (const row of rows) expect(text).not.toContain(row.hash);
  });
});
