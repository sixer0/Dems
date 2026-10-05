/**
 * The stored-chain check of `verifyAuditChain`, result `stored` (plan row W39; spec §7.13 "The
 * stored check is incremental", SD-27; SR-81; AC-B-88; database contract §4.12, §6.1, GD-01;
 * decisions D62 DN-5, D67 DN-9).
 *
 * WHAT VERIFIES A ROW. One implementation, and it is not in this file: `checkStoredChain` of the
 * schema's boot checks reads the newest n stored rows in sequence order, and
 * `verifyStoredAuditRows` of the mapping module runs the shared chain check over them, link by
 * link and digest by digest (rule MR-1). This file CALLS them. It holds no hash function, no
 * comparison of a row with its predecessor and no mapping of a row.
 *
 * WHAT THIS FILE IS: the bookkeeping that makes the check incremental. The operation needs only
 * a signed-in operator, so a check of the whole table on every call would let any operator make
 * the server read every audit row again and again. The server therefore remembers, in memory,
 * the position the stored chain has verified through, and a call verifies the rows above it.
 *
 *   state, per chain             what a call does                               rows read
 *   ---------------------------  ---------------------------------------------  ---------
 *   nothing remembered           a FULL pass: every stored row from the first    all
 *   verified through (seq, hash) the position still names its stored row: an     k = head - seq
 *                                INCREMENTAL pass over the k rows above it
 *                                k = 0                                           none
 *                                the position names no stored row any more, or   all
 *                                the rows above it do not continue it: the
 *                                position is forgotten and a FULL pass runs,
 *                                which reports the break where it is
 *   a break is remembered        the remembered answer; an appended row cannot   none
 *                                mend a chain
 *
 *   A NEW CHAIN (the engine's epoch moved, or the pool was reopened: a start, a reset, a
 *   scenario load, a resync) forgets everything: the next call is a full pass.
 *
 * ONE SNAPSHOT. A pass runs in one READ ONLY transaction at REPEATABLE READ: the head, the
 * check of the remembered position and the rows are of one instant. "The newest k rows" are
 * then exactly the rows above the position, however many are appended while the pass runs.
 *
 * ONE RUN. Calls that arrive while a run is under way share it: the second awaits the first.
 *
 * WHAT A PASS MUST COVER. `checkStoredChain` verifies the rows it read; whether those rows are
 * the ones that were due is this file's question: the first row read must be the one right
 * above the position and name its hash, and the last must be the head. An incremental pass that
 * does not cover its rows proves nothing about the position, so the position is forgotten and a
 * full pass decides. A full pass that does not cover the chain has found a break (a row is
 * missing, or the head does not name the newest row).
 *
 * `checked` of the answer is the sequence the stored chain has verified through; `firstBadSeq`
 * is the first sequence that does not verify, or null.
 *
 * The lineage rule LN-3, which `checkStoredChain` also reports, is not part of the answer
 * (database contract §15.4); a mismatch is logged once per chain.
 *
 * The log of this file holds sequence numbers, counts and codes. Never the content of a row.
 */
import { GENESIS_HASH } from '@dems/shared/sim';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import { verifyStoredAuditRows, type StoredDigestVerdict } from '../../db/mapping';
import { checkStoredChain, type Queryable } from '../../db/schema/boot-checks';
import type { ErrorLog } from '../../plugins/logger';

/** `stored` of `AuditChainStatus`. */
export interface StoredChainStatus {
  readonly ok: boolean;
  /** The `seq` the stored chain has been verified through. */
  readonly checked: number;
  /** Head hash of the stored chain. */
  readonly head: string;
  /** `seq` of the first stored row that does not verify; null while the chain verifies. */
  readonly firstBadSeq: number | null;
}

/** Counters of the verifier, for the tests and the measurements. */
export interface StoredChainStats {
  /** Calls of `status`. */
  readonly calls: number;
  /** Runs: a call that found a run under way started none. */
  readonly runs: number;
  readonly fullPasses: number;
  readonly incrementalPasses: number;
  /** Audit rows the passes read, in all. */
  readonly rowsRead: number;
  /** How often a remembered position was given up (a new chain is not counted). */
  readonly positionsForgotten: number;
  /** The sequence verified through, as remembered now: the position, or the row before a remembered break. */
  readonly verifiedThrough: number;
  /** The remembered break, or null. */
  readonly firstBadSeq: number | null;
}

export interface StoredChainVerifierDependencies {
  /**
   * Names the chain the server reads now. A different name means a different chain: everything
   * remembered is forgotten. The module passes the engine's epoch and the pool's generation.
   */
  readonly chain: () => string;
  readonly log: FastifyBaseLogger;
  readonly errorLog: ErrorLog;
}

export interface StoredChainVerifier {
  /** The stored chain's status, on a connection of `pool`. Rejects only when the database fails. */
  status(pool: Pick<Pool, 'connect' | 'query'>): Promise<StoredChainStatus>;
  stats(): StoredChainStats;
}

/** A place in the chain: a row's sequence and hash. Sequence 0 is "before the first row". */
interface Position {
  readonly seq: number;
  readonly hash: string;
}

interface Break {
  readonly firstBadSeq: number;
}

/** What a pass read, as the digest check was handed it. */
interface Segment {
  readonly rows: number;
  readonly firstSeq: number;
  readonly firstPrevHash: string;
  readonly lastSeq: number;
  readonly lastHash: string;
}

type PassOutcome =
  | { readonly kind: 'VERIFIED' }
  /** A row of the pass does not verify. */
  | { readonly kind: 'BROKEN'; readonly firstBadSeq: number }
  /** The rows read are not the rows above the position up to the head. */
  | { readonly kind: 'NOT_COVERED'; readonly firstUncovered: number };

const BEFORE_FIRST_ROW: Position = Object.freeze({ seq: 0, hash: GENESIS_HASH });

const BEGIN_SNAPSHOT = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY';
const HEAD = 'SELECT seq, hash FROM public.audit_chain_head';
/** True when the table holds a row with this sequence AND this hash. One lookup by the primary key; no row is returned. */
const POSITION_HOLDS = 'SELECT EXISTS (SELECT 1 FROM public.audit_log WHERE seq = $1 AND hash = $2) AS holds';

const NOT_VERIFIED = 'the stored audit chain does not verify';
const POSITION_FORGOTTEN = 'the remembered position of the stored-chain check was given up: a full pass runs';
const LINEAGE_MISMATCH = 'the newest lineage row does not agree with the chain (LN-3)';
const VERDICT_UNREADABLE = 'the verdict of the digest check names no sequence: the first row of the pass is reported';

async function headOf(reader: Queryable): Promise<Position> {
  const { rows } = await reader.query<{ seq: string; hash: string }>(HEAD);
  const row = rows[0];
  // The migration writes the one row of the table, and no role can delete it.
  if (row === undefined) throw new Error('the audit chain has no head row');
  return { seq: Number(row.seq), hash: row.hash };
}

export function createStoredChainVerifier(dependencies: StoredChainVerifierDependencies): StoredChainVerifier {
  const { log, errorLog } = dependencies;

  let chain: string | null = null;
  let position: Position = BEFORE_FIRST_ROW;
  let broken: Break | null = null;
  let lineageReported = false;
  let running: Promise<StoredChainStatus> | null = null;
  const counters = { calls: 0, runs: 0, fullPasses: 0, incrementalPasses: 0, rowsRead: 0, positionsForgotten: 0 };

  const verified = (head: Position): StoredChainStatus => ({ ok: true, checked: head.seq, head: head.hash, firstBadSeq: null });
  const failed = (found: Break, head: Position): StoredChainStatus => ({
    ok: false,
    checked: found.firstBadSeq - 1,
    head: head.hash,
    firstBadSeq: found.firstBadSeq,
  });

  /**
   * One call of the stored-chain check over the rows above `from`, in the snapshot. Says whether
   * they verify, and whether they were the rows that were due.
   */
  async function pass(snapshot: Queryable, from: Position, head: Position): Promise<PassOutcome> {
    const due = head.seq - from.seq;
    let segment: Segment | null = null;
    let verdict: StoredDigestVerdict = { ok: true };
    const report = await checkStoredChain(snapshot, {
      limit: due,
      verifyDigests: (rows, context) => {
        const first = rows[0];
        const last = rows.at(-1);
        if (first !== undefined && last !== undefined) {
          segment = { rows: rows.length, firstSeq: first.seq, firstPrevHash: first.prevHash, lastSeq: last.seq, lastHash: last.hash };
        }
        verdict = verifyStoredAuditRows(rows, context);
        return verdict;
      },
    });
    counters.rowsRead += report.rowsChecked;
    if (report.lineage === 'mismatch' && !lineageReported) {
      lineageReported = true;
      log.warn({ code: 'LINEAGE_MISMATCH' }, LINEAGE_MISMATCH);
    }

    const read = segment as Segment | null;
    // Assigned inside the callback above, so the compiler has to be told that it may be either form.
    const checked = verdict as StoredDigestVerdict;
    // Nothing above the position, or rows that do not start right above it and name its hash.
    if (read === null) return { kind: 'NOT_COVERED', firstUncovered: from.seq + 1 };
    if (read.firstSeq !== from.seq + 1 || read.firstPrevHash !== from.hash) return { kind: 'NOT_COVERED', firstUncovered: Math.min(read.firstSeq, from.seq + 1) };
    // The digest check names the first bad row itself: a typed member of its verdict (finding F-2).
    if (!checked.ok) return { kind: 'BROKEN', firstBadSeq: checked.seq };
    if (report.linkBreaks > 0) {
      // Links the stored-chain check counted, with digests that verify: no verdict names a row.
      log.warn({ code: 'STORED_CHAIN_VERDICT_UNREADABLE', firstSeq: read.firstSeq }, VERDICT_UNREADABLE);
      return { kind: 'BROKEN', firstBadSeq: read.firstSeq };
    }
    // Verified rows that stop short of the head, go beyond it, or end in another hash than the head's.
    if (read.rows !== due || read.lastSeq !== head.seq) return { kind: 'NOT_COVERED', firstUncovered: Math.min(read.lastSeq, head.seq) + 1 };
    if (read.lastHash !== head.hash) return { kind: 'NOT_COVERED', firstUncovered: head.seq };
    return { kind: 'VERIFIED' };
  }

  /** The stored chain's status as of the snapshot, and what there is to remember of it. */
  async function advance(snapshot: Queryable, head: Position): Promise<{ readonly status: StoredChainStatus; readonly remember: () => void }> {
    let from = position;
    let forgotten = false;
    if (from.seq > 0) {
      // The remembered position must still name its stored row.
      const { rows } = await snapshot.query<{ holds: boolean }>(POSITION_HOLDS, [from.seq, from.hash]);
      if (rows[0]?.holds !== true) forgotten = true;
    }
    let outcome: PassOutcome = { kind: 'VERIFIED' };
    if (!forgotten && head.seq > from.seq) {
      counters[from.seq > 0 ? 'incrementalPasses' : 'fullPasses'] += 1;
      outcome = await pass(snapshot, from, head);
      // An incremental pass whose rows are not the ones due says nothing about the position.
      if (outcome.kind === 'NOT_COVERED' && from.seq > 0) forgotten = true;
    } else if (!forgotten && head.hash !== from.hash) {
      // No row is due, and the head is not the position: it names another hash, or a lower sequence.
      if (from.seq > 0) forgotten = true;
      else outcome = { kind: 'NOT_COVERED', firstUncovered: 1 };
    }
    if (forgotten) {
      counters.positionsForgotten += 1;
      log.warn({ code: 'STORED_CHAIN_POSITION_FORGOTTEN', rememberedSeq: from.seq, headSeq: head.seq }, POSITION_FORGOTTEN);
      from = BEFORE_FIRST_ROW;
      outcome = { kind: 'VERIFIED' };
      if (head.seq > 0) {
        counters.fullPasses += 1;
        outcome = await pass(snapshot, from, head);
      } else if (head.hash !== GENESIS_HASH) {
        outcome = { kind: 'NOT_COVERED', firstUncovered: 1 };
      }
    }

    if (outcome.kind === 'VERIFIED') {
      return {
        status: verified(head),
        remember: () => {
          position = head;
        },
      };
    }
    const found: Break = { firstBadSeq: outcome.kind === 'BROKEN' ? outcome.firstBadSeq : outcome.firstUncovered };
    return {
      status: failed(found, head),
      remember: () => {
        broken = found;
        const context = { firstBadSeq: found.firstBadSeq, headSeq: head.seq, kind: outcome.kind };
        log.error({ code: 'STORED_CHAIN_NOT_VERIFIED', ...context }, NOT_VERIFIED);
        errorLog.append({ level: 'error', source: 'securityAudit.storedChain', message: NOT_VERIFIED, code: 'STORED_CHAIN_NOT_VERIFIED', context });
      },
    };
  }

  async function run(pool: Pick<Pool, 'connect' | 'query'>): Promise<StoredChainStatus> {
    counters.runs += 1;
    const current = dependencies.chain();
    if (current !== chain) {
      chain = current;
      position = BEFORE_FIRST_ROW;
      broken = null;
      lineageReported = false;
    }
    // A remembered break: no audit row is read. Only the head is, for the answer.
    if (broken !== null) return failed(broken, await headOf(pool));

    const client = await pool.connect();
    let lost = false;
    try {
      await client.query(BEGIN_SNAPSHOT);
      const snapshot: Queryable = { query: client.query.bind(client) as Queryable['query'] };
      const result = await advance(snapshot, await headOf(snapshot));
      await client.query('COMMIT');
      // What was learnt is of the chain the run started on.
      if (dependencies.chain() === current) result.remember();
      return result.status;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The connection itself failed: it is not handed back to the pool.
        lost = true;
      }
      throw error;
    } finally {
      client.release(lost);
    }
  }

  return {
    status(pool) {
      counters.calls += 1;
      running ??= run(pool).finally(() => {
        running = null;
      });
      return running;
    },
    stats: () => ({ ...counters, verifiedThrough: broken === null ? position.seq : broken.firstBadSeq - 1, firstBadSeq: broken?.firstBadSeq ?? null }),
  };
}
