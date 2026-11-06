/**
 * The sealed-transcript store: the database side of a sealed machine transcript and of its signed
 * revisions (blueprint row 78 / M6-W3; dbc-3 §B.8, §B.9, §B.11; transcript spec §A.5, §A.6;
 * evidence package spec §B.7).
 *
 * WHO CALLS IT. The seal's composition (`sealing-host`, through `commitSealedTranscript` of row 79; the item
 * insert of rows 82/83) calls `writeSealedTranscript` INSIDE THE UNIT OF WORK THAT INSERTS THE
 * EVIDENCE ITEM; the revise operation (op 85, the row that mounts it with the `Signer` of row 83)
 * calls `revisionHead` and `appendRevision` inside its own unit of work. This store opens,
 * commits and rolls back nothing: the caller owns the transaction, so the item, its
 * `transcript_sha256` and its `transcripts` row are committed together or not at all.
 *
 * ONE UNIT OF WORK, THREE WRITES (the row text: "`transcripts` / `transcript_revisions` /
 * `evidence_items.transcript_sha256` writes"):
 *
 *   evidence_items.transcript_sha256  written by the INSERT of the item (the runtime role has no
 *                                     UPDATE on it): the caller's insert carries the hash of the
 *                                     document the transcriber assembled (`TranscriptSealRecord`);
 *   transcripts                       `writeSealedTranscript` inserts revision 0 AFTER reading the
 *                                     item back in the same transaction and REFUSING unless the
 *                                     item is bound to exactly this document hash;
 *   transcript_revisions              `appendRevision`, later, any number of times.
 *
 * A refusal throws; the caller's transaction is then rolled back by the caller, and neither the
 * item nor the transcript exists. No half of the pair can be committed alone through this store.
 *
 * THE REVISION CHAIN (dbc-3 §B.9; SEC35-21). `revision_no` = current head + 1, minted inside the
 * transaction, no sequence. `parent_sha256` of the first revision is `transcripts.json_sha256`
 * (the machine transcript), of every later one the `sha256` of the revision before it. The caller
 * states the head it built its revision on (`baseRevision`) and the parent hash it signed
 * (`parentSha256`); either one not matching the stored head is `TRANSCRIPT_REVISION_CONFLICT`, and
 * so is losing a race for the number (the primary key decides it). WHAT THIS ROW DOES NOT BUILD:
 * the canonical body of a revision, its signature (the `Signer`, row 83), the operation and its
 * permission check, and the package-side `transcript-revisions.json`; this store stores a revision
 * that arrives already hashed and signed, and the table's own CHECKs judge its signature columns.
 *
 * FAILURES ARE TYPED AND NEVER SWALLOWED: a `TranscriptStoreError` with a code, the SQLSTATE and
 * the constraint name, never a value of a row. This module has no log of its own; its caller logs
 * the failure of its unit of work to the persistent error log.
 */
import {
  INSERT_TRANSCRIPT,
  INSERT_TRANSCRIPT_REVISION,
  READ_ITEM_TRANSCRIPT_BINDING,
  READ_REVISION_HEAD,
  READ_TRANSCRIPT,
  READ_TRANSCRIPT_REVISIONS,
  type Queryable,
  type TranscriptLabelsStatusValue,
  type TranscriptRevisionAlgorithmValue,
} from './statements';

export type { Queryable, TranscriptLabelsStatusValue, TranscriptRevisionAlgorithmValue } from './statements';

/** The row of `transcripts` for one item. `model` and `diarization` are the manifest objects (ev §B.7 fields 84-90). */
export interface SealedTranscript {
  readonly evidenceId: string;
  /** SHA-256 of the canonical `dems.transcript/1` document; also `evidence_items.transcript_sha256`. */
  readonly jsonSha256: string;
  readonly srtSha256: string;
  readonly vttSha256: string;
  readonly model: Readonly<Record<string, unknown>>;
  readonly diarization: Readonly<Record<string, unknown>>;
  readonly labelsStatus: TranscriptLabelsStatusValue;
  /** Epoch milliseconds. An instant. */
  readonly createdAt: number;
}

/** A revision as it arrives: already hashed and signed by its caller. */
export interface NewTranscriptRevision {
  readonly evidenceId: string;
  /** The head the caller built on: the newest `revision_no` it saw, 0 when it saw none (op 85 `baseRevision`). */
  readonly baseRevision: number;
  /** The parent hash the caller put into the signed body. */
  readonly parentSha256: string;
  /** SHA-256 of the canonical revision body. */
  readonly sha256: string;
  readonly authorId: string;
  readonly reason: string;
  readonly signatureValue: string;
  readonly signatureKeyId: string;
  readonly signatureAlgorithm: TranscriptRevisionAlgorithmValue;
  readonly signatureSimulated: boolean;
  readonly signatureCertificateSha256: string | null;
  readonly createdAt: number;
}

export interface TranscriptRevision extends Omit<NewTranscriptRevision, 'baseRevision'> {
  readonly revisionNo: number;
}

/** The head of an item's chain: what the next revision must be built on. */
export interface RevisionHead {
  /** 0 when the item has no revision yet. */
  readonly revisionNo: number;
  /** The hash the next revision names as its parent. */
  readonly parentSha256: string;
}

export type TranscriptStoreErrorCode =
  /** The item does not exist in this unit of work: the transcript has nothing to hang off. */
  | 'ITEM_NOT_FOUND'
  /** The item is bound to another document hash (or to none) than the transcript that is being stored. */
  | 'TRANSCRIPT_HASH_NOT_BOUND'
  /** The item already has its machine transcript: revision 0 is written once. */
  | 'TRANSCRIPT_ALREADY_SEALED'
  /** The item has no machine transcript, so it can have no revision. */
  | 'TRANSCRIPT_NOT_FOUND'
  /** The caller's base revision or parent hash is not the stored head, or another revision took the number. */
  | 'TRANSCRIPT_REVISION_CONFLICT'
  | 'WRITE_FAILED'
  | 'READ_FAILED';

export class TranscriptStoreError extends Error {
  readonly code: TranscriptStoreErrorCode;
  /** The SQLSTATE of the database, when it gave one. */
  readonly sqlState: string | null;
  /** The constraint the database named, when it named one. */
  readonly constraint: string | null;

  constructor(code: TranscriptStoreErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'TranscriptStoreError';
    this.code = code;
    const fields = (cause ?? {}) as { code?: unknown; constraint?: unknown };
    this.sqlState = typeof fields.code === 'string' ? fields.code : null;
    this.constraint = typeof fields.constraint === 'string' ? fields.constraint : null;
  }
}

export interface TranscriptStore {
  /**
   * Inserts the machine transcript of an item. Call it inside the unit of work that inserted the
   * item. Refuses (and writes nothing) unless the item exists there and its `transcript_sha256`
   * equals `jsonSha256`.
   */
  writeSealedTranscript(transcript: SealedTranscript): Promise<void>;
  read(evidenceId: string): Promise<SealedTranscript | null>;
  /** The head of the item's revision chain. Throws `TRANSCRIPT_NOT_FOUND` for an item without a transcript. */
  revisionHead(evidenceId: string): Promise<RevisionHead>;
  /** Appends one signed revision and returns it with the number it was given. Call it inside a unit of work. */
  appendRevision(revision: NewTranscriptRevision): Promise<TranscriptRevision>;
  readRevisions(evidenceId: string): Promise<TranscriptRevision[]>;
}

interface TranscriptRow {
  evidence_id: string;
  json_sha256: string;
  srt_sha256: string;
  vtt_sha256: string;
  model: unknown;
  diarization: unknown;
  labels_status: string;
  created_at: string | number;
}

interface RevisionRow {
  evidence_id: string;
  revision_no: number;
  parent_sha256: string;
  sha256: string;
  author_id: string;
  reason: string;
  signature_value: string;
  signature_key_id: string;
  signature_algorithm: string;
  signature_simulated: boolean;
  signature_certificate_sha256: string | null;
  created_at: string | number;
}

const UNIQUE_VIOLATION = '23505';
const sqlStateOf = (error: unknown): string | null => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
};

const toTranscript = (row: TranscriptRow): SealedTranscript => ({
  evidenceId: row.evidence_id,
  jsonSha256: row.json_sha256,
  srtSha256: row.srt_sha256,
  vttSha256: row.vtt_sha256,
  model: row.model as Record<string, unknown>,
  diarization: row.diarization as Record<string, unknown>,
  labelsStatus: row.labels_status as TranscriptLabelsStatusValue,
  createdAt: Number(row.created_at),
});

const toRevision = (row: RevisionRow): TranscriptRevision => ({
  evidenceId: row.evidence_id,
  revisionNo: Number(row.revision_no),
  parentSha256: row.parent_sha256,
  sha256: row.sha256,
  authorId: row.author_id,
  reason: row.reason,
  signatureValue: row.signature_value,
  signatureKeyId: row.signature_key_id,
  signatureAlgorithm: row.signature_algorithm as TranscriptRevisionAlgorithmValue,
  signatureSimulated: row.signature_simulated,
  signatureCertificateSha256: row.signature_certificate_sha256,
  createdAt: Number(row.created_at),
});

export function createTranscriptStore(connection: Queryable): TranscriptStore {
  async function read(evidenceId: string): Promise<SealedTranscript | null> {
    try {
      const row = (await connection.query<TranscriptRow>(READ_TRANSCRIPT, [evidenceId])).rows[0];
      return row === undefined ? null : toTranscript(row);
    } catch (error) {
      throw new TranscriptStoreError('READ_FAILED', 'the transcript row could not be read', error);
    }
  }

  async function revisionHead(evidenceId: string): Promise<RevisionHead> {
    const transcript = await read(evidenceId);
    if (transcript === null) throw new TranscriptStoreError('TRANSCRIPT_NOT_FOUND', 'the item has no sealed machine transcript');
    let head: { revision_no: number; sha256: string } | undefined;
    try {
      head = (await connection.query<{ revision_no: number; sha256: string }>(READ_REVISION_HEAD, [evidenceId])).rows[0];
    } catch (error) {
      throw new TranscriptStoreError('READ_FAILED', 'the revision head could not be read', error);
    }
    // The parent of the first revision is the machine transcript itself (mapping rule MR, dbc-3 §B.9).
    return head === undefined ? { revisionNo: 0, parentSha256: transcript.jsonSha256 } : { revisionNo: Number(head.revision_no), parentSha256: head.sha256 };
  }

  return Object.freeze({
    read,
    revisionHead,

    async writeSealedTranscript(transcript: SealedTranscript): Promise<void> {
      let binding: { transcript_sha256: string | null } | undefined;
      try {
        binding = (await connection.query<{ transcript_sha256: string | null }>(READ_ITEM_TRANSCRIPT_BINDING, [transcript.evidenceId])).rows[0];
      } catch (error) {
        throw new TranscriptStoreError('READ_FAILED', 'the evidence item could not be read', error);
      }
      if (binding === undefined) throw new TranscriptStoreError('ITEM_NOT_FOUND', 'the evidence item of the transcript does not exist in this unit of work');
      if (binding.transcript_sha256 !== transcript.jsonSha256) {
        throw new TranscriptStoreError('TRANSCRIPT_HASH_NOT_BOUND', 'the evidence item is not bound to the hash of this transcript document');
      }
      try {
        await connection.query(INSERT_TRANSCRIPT, [
          transcript.evidenceId,
          transcript.jsonSha256,
          transcript.srtSha256,
          transcript.vttSha256,
          JSON.stringify(transcript.model),
          JSON.stringify(transcript.diarization),
          transcript.labelsStatus,
          transcript.createdAt,
        ]);
      } catch (error) {
        if (sqlStateOf(error) === UNIQUE_VIOLATION) throw new TranscriptStoreError('TRANSCRIPT_ALREADY_SEALED', 'the item already has its machine transcript; it is written once', error);
        throw new TranscriptStoreError('WRITE_FAILED', 'the transcript row could not be inserted', error);
      }
    },

    async appendRevision(revision: NewTranscriptRevision): Promise<TranscriptRevision> {
      const head = await revisionHead(revision.evidenceId);
      if (head.revisionNo !== revision.baseRevision || head.parentSha256 !== revision.parentSha256) {
        throw new TranscriptStoreError('TRANSCRIPT_REVISION_CONFLICT', 'the revision was not built on the current head of the chain');
      }
      const revisionNo = head.revisionNo + 1;
      try {
        await connection.query(INSERT_TRANSCRIPT_REVISION, [
          revision.evidenceId,
          revisionNo,
          revision.parentSha256,
          revision.sha256,
          revision.authorId,
          revision.reason,
          revision.signatureValue,
          revision.signatureKeyId,
          revision.signatureAlgorithm,
          revision.signatureSimulated,
          revision.signatureCertificateSha256,
          revision.createdAt,
        ]);
      } catch (error) {
        if (sqlStateOf(error) === UNIQUE_VIOLATION) throw new TranscriptStoreError('TRANSCRIPT_REVISION_CONFLICT', 'another revision took this number first', error);
        throw new TranscriptStoreError('WRITE_FAILED', 'the transcript revision could not be inserted', error);
      }
      const { baseRevision: _base, ...stored } = revision;
      return { ...stored, revisionNo };
    },

    async readRevisions(evidenceId: string): Promise<TranscriptRevision[]> {
      try {
        return (await connection.query<RevisionRow>(READ_TRANSCRIPT_REVISIONS, [evidenceId])).rows.map(toRevision);
      } catch (error) {
        throw new TranscriptStoreError('READ_FAILED', 'the transcript revisions could not be read', error);
      }
    },
  });
}
