/**
 * The digest check of stored audit rows (plan row W20; database contract B-8, GD-01, ST-2).
 *
 * The database checks that each audit row continues its predecessor; it cannot check that a
 * row's `hash` really is `sha256(prev_hash ‖ canonicalJSON(body))`. That needs the shared code,
 * and the rows in the shared shape. Boot check B-8 (`../schema/boot-checks.ts`,
 * `checkStoredChain`) therefore takes the check as a parameter, and this is the function to
 * pass: it maps the stored rows with the one row mapping and runs the shared `verifyAuditChain`
 * over them.
 *
 *   const report = await checkStoredChain(pool, { verifyDigests: verifyStoredAuditRows });
 *
 * Pure. The verdict names a sequence number and a reason code, never the content of a row.
 *
 * THE VERDICT IS TYPED (plan row W39, finding F-2; decision DN-3; fix round B2b item 8). A
 * caller that needs the first bad sequence reads the member `seq`, and the reason as `code`.
 * `reason` holds both as one text for a log line, which is all `checkStoredChain` wants of it.
 * Until this round the text was the only form, and the security-audit module read the number
 * back out of it with a regular expression.
 */
import { verifyAuditChain, type ChainVerifyResult, type PurgedRange } from '@dems/shared/sim';
import type { AuditLogRow } from '../schema';
import { auditRowFromRow } from './rows';

/** Why the shared chain check stopped at a row: its own reason codes, not a second list. */
export type StoredDigestFailureCode = Extract<ChainVerifyResult, { ok: false }>['reason'];

export type StoredDigestVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /** The reason code of the shared chain check: `HASH_MISMATCH`, `PREV_LINK_BROKEN` or `SEQ_GAP`. */
      readonly code: StoredDigestFailureCode;
      /** The sequence number of the first row that does not verify. */
      readonly seq: number;
      /** Both as one text, for a log line: `HASH_MISMATCH at sequence 17`. */
      readonly reason: string;
    };

export interface StoredDigestContext {
  /** How many older rows were not read (the sequence of the first row read, minus one). */
  readonly dropped: number;
  /** Erasure ranges from `audit_purge_log`, read from the table by the caller (migration 0036). */
  readonly purged?: readonly PurgedRange[];
  /** The hash the chain must end in: the newest row's hash, or the chain head's. */
  readonly head: string;
}

/**
 * Verifies the digests of stored audit rows, given in ascending sequence. `context.dropped` lets
 * a caller check the newest rows only: the first row read then anchors the chain, as it does for
 * the engine's ring.
 */
export function verifyStoredAuditRows(rows: readonly AuditLogRow[], context: StoredDigestContext): StoredDigestVerdict {
  const result = verifyAuditChain({
    rows: rows.map(auditRowFromRow),
    head: context.head,
    total: context.dropped + rows.length,
    dropped: context.dropped,
  }, context.purged);
  return result.ok ? { ok: true } : { ok: false, code: result.reason, seq: result.seq, reason: `${result.reason} at sequence ${result.seq}` };
}
