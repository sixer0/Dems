/**
 * THE CANONICAL BODY OF A TRANSCRIPT REVISION (task 3 integration pass D4; transcript spec §A.6;
 * evidence package spec §C.1 "Signed message (revision): the 32-byte digest of the canonical
 * revision body", §D V-11; OD-15).
 *
 * No specification fixes the members of the body (the transcript spec calls its record "a
 * proposal"; row 85 read the package file as the columns of `transcript_revisions` plus an
 * optional `body`). This is the body the Core writes, and the rule behind it is one sentence:
 *
 *     EVERYTHING A READER IS SHOWN ABOUT A REVISION IS INSIDE THE BODY THAT IS HASHED AND SIGNED.
 *
 * Who revised, why, when, what was changed, on which revision it was built and which machine
 * transcript it corrects: all of it is a member below. `sha256` of the stored row and of the
 * package record is the SHA-256 of the canonical JSON of this object (`canonicalJsonBytes`, the
 * manifest's own canonical form), and the Core key signs those 32 bytes. The record of the package
 * file repeats `authorId`, `reason`, `createdAt` at its top level for verify V-11's schema; the
 * copies are written from this body and never from anywhere else.
 *
 * WHAT A REVISION IS NOT. It is not a new transcript. `machineTranscriptSha256` names the sealed
 * machine transcript, which no code path of this module writes: the runtime role has no UPDATE on
 * `transcripts` or on `evidence_items.transcript_sha256`, and the package's `transcript.json` is
 * only ever read here.
 *
 * Pure: no file, no statement, no clock, no key.
 */
import { canonicalJsonBytes } from '@dems/shared/evidence-package';
import { createHash } from 'node:crypto';

export const TRANSCRIPT_REVISION_BODY_SCHEMA_ID = 'dems.transcript-revision/1';

/** The bounds of `transcript_revisions.reason` (`transcript_revisions_reason_check`, dbc-3 §B.9). */
export const REVISION_REASON_MIN = 5;
export const REVISION_REASON_MAX = 500;

export interface RevisionChange {
  readonly segmentIndex: number;
  readonly from: string;
  readonly to: string;
}

export interface RevisionBody {
  readonly schema: typeof TRANSCRIPT_REVISION_BODY_SCHEMA_ID;
  readonly evidenceId: string;
  /** 1 for the first revision of an item. */
  readonly revisionNo: number;
  /** The head the author built on: `revisionNo - 1` (SEC35-21). */
  readonly baseRevision: number;
  /** Revision 1: the machine transcript's hash. Later: the `sha256` of the revision before. */
  readonly parentSha256: string;
  /** The sealed machine transcript this revision corrects; never changed by it (OD-15). */
  readonly machineTranscriptSha256: string;
  readonly authorId: string;
  readonly reason: string;
  /** Epoch milliseconds, the Core's clock. */
  readonly createdAt: number;
  readonly changes: readonly RevisionChange[];
}

export interface RevisionBodyInput {
  readonly evidenceId: string;
  readonly baseRevision: number;
  readonly parentSha256: string;
  readonly machineTranscriptSha256: string;
  readonly authorId: string;
  readonly reason: string;
  readonly createdAt: number;
  readonly changes: readonly RevisionChange[];
}

/** The body of the revision that follows `baseRevision`. The members are copied, never shared. */
export function revisionBodyOf(input: RevisionBodyInput): RevisionBody {
  return Object.freeze({
    schema: TRANSCRIPT_REVISION_BODY_SCHEMA_ID,
    evidenceId: input.evidenceId,
    revisionNo: input.baseRevision + 1,
    baseRevision: input.baseRevision,
    parentSha256: input.parentSha256,
    machineTranscriptSha256: input.machineTranscriptSha256,
    authorId: input.authorId,
    reason: input.reason,
    createdAt: input.createdAt,
    changes: Object.freeze(input.changes.map((change) => Object.freeze({ segmentIndex: change.segmentIndex, from: change.from, to: change.to }))),
  });
}

/** The 32 bytes the Core key signs: SHA-256 of the canonical JSON of the body. */
export function revisionDigestOf(body: RevisionBody): Uint8Array {
  return new Uint8Array(createHash('sha256').update(canonicalJsonBytes(body)).digest());
}

export function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/** `TRV-000004` for revision 4 of an item (C3 §3; the audit rule's form). */
export function revisionIdOf(revisionNo: number): string {
  return `TRV-${String(revisionNo).padStart(6, '0')}`;
}

/**
 * The reason of a revision as it may be stored, or null. The contract's `note` is optional; the
 * table's `reason` is NOT NULL and 5 to 500 characters. A revision is a correction of evidence:
 * the Core stores the author's own words or refuses, and never writes a reason of its own.
 */
export function storableReasonOf(note: string | undefined): string | null {
  if (note === undefined) return null;
  const reason = note.trim();
  return reason.length >= REVISION_REASON_MIN && reason.length <= REVISION_REASON_MAX ? reason : null;
}

/** The changes of a body as it was read back from a package record, or null when it is not this row's body. */
export function changesOfStoredBody(body: unknown, expected: { evidenceId: string; revisionNo: number; sha256: string }): readonly RevisionChange[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const members = body as Partial<Record<keyof RevisionBody, unknown>>;
  if (members.schema !== TRANSCRIPT_REVISION_BODY_SCHEMA_ID || members.evidenceId !== expected.evidenceId || members.revisionNo !== expected.revisionNo) return null;
  let digest: string;
  try {
    digest = hexOf(new Uint8Array(createHash('sha256').update(canonicalJsonBytes(body)).digest()));
  } catch {
    return null;
  }
  if (digest !== expected.sha256 || !Array.isArray(members.changes)) return null;
  const changes: RevisionChange[] = [];
  for (const entry of members.changes as unknown[]) {
    const change = entry as Partial<RevisionChange> | null;
    if (change === null || typeof change !== 'object' || !Number.isSafeInteger(change.segmentIndex) || typeof change.from !== 'string' || typeof change.to !== 'string') return null;
    changes.push({ segmentIndex: change.segmentIndex as number, from: change.from, to: change.to });
  }
  return changes;
}
