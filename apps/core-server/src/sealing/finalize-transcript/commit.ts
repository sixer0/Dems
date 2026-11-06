/**
 * COMMITTING A CONSUMED TRANSCRIPT WITH ITS ITEM, AND ITS SUMMARY FOR THE EVIDENCE SLICE
 * (blueprint row 79; dbc-3 §B.8, §B.11; evidence package spec §E.1 `BUILD_MANIFEST` /
 * `STORE_SEALED_PACKAGE`; API contract C3 §3 op 39 "transcript summary").
 *
 * WHEN. `FINALIZE_TRANSCRIPT` runs before the evidence item exists, and `transcripts` hangs off
 * the item, so the step cannot write the row itself. The unit of work that INSERTS THE ITEM
 * (rows 82 / 83) does two things with the answer of the step, in this order:
 *
 *   1. its item INSERT carries `transcript.itemColumns` — the runtime role has no UPDATE on
 *      `manifest_version`, `transcript_sha256`, `labels_status`: they are written then or never;
 *   2. it calls `commitSealedTranscript` with a store bound to the same unit of work.
 *
 * IDEMPOTENT. Called again for an item that already has this transcript, it writes nothing and
 * says so: one row, the same hashes. An item that has ANOTHER transcript is refused
 * (`SEALED_TRANSCRIPT_DIFFERS`); the machine transcript of an item is never replaced (OD-15).
 * A disabled transcript has no row: nothing is written, and the item carries no hash.
 *
 * The store refuses a transcript whose item is not bound to exactly its hash
 * (`TRANSCRIPT_HASH_NOT_BOUND`, row 78); that refusal is passed on untouched, and the caller's
 * rollback then removes the item too.
 */
import type { EvidenceItemBody } from '@dems/shared/api';
import type { CompleteSealInput } from '@dems/shared/sim';
import type { SealedTranscript } from '../../modules/transcripts';
import { FinalizeTranscriptError, FinalizeTranscriptFailure, type FinalizedTranscript, type ManifestTranscriptBlock } from './contract';

/** The two members of the sealed-transcript store this needs (`createTranscriptStore(unitOfWork)`). */
export interface SealedTranscriptWriter {
  read(evidenceId: string): Promise<SealedTranscript | null>;
  writeSealedTranscript(transcript: SealedTranscript): Promise<void>;
}

export interface CommitSealedTranscriptInput {
  readonly evidenceId: string;
  readonly transcript: FinalizedTranscript;
  /** Epoch milliseconds: `transcripts.created_at`, the Core instant of the seal. */
  readonly createdAt: number;
}

export type CommitSealedTranscriptResult =
  /** No transcript document is sealed (STT disabled, or unavailable at the seal): the item has no transcript row. */
  | { readonly outcome: 'NO_TRANSCRIPT' }
  | { readonly outcome: 'WRITTEN'; readonly jsonSha256: string }
  /** The item already had exactly this transcript; nothing was written. */
  | { readonly outcome: 'ALREADY_COMMITTED'; readonly jsonSha256: string };

export async function commitSealedTranscript(store: SealedTranscriptWriter, input: CommitSealedTranscriptInput): Promise<CommitSealedTranscriptResult> {
  const row = input.transcript.transcriptRow;
  if (row === null) return { outcome: 'NO_TRANSCRIPT' };
  // Read first: inside a unit of work a refused INSERT would end the whole transaction.
  const existing = await store.read(input.evidenceId);
  if (existing !== null) {
    if (existing.jsonSha256 !== row.jsonSha256 || existing.srtSha256 !== row.srtSha256 || existing.vttSha256 !== row.vttSha256) {
      throw new FinalizeTranscriptError(FinalizeTranscriptFailure.SEALED_TRANSCRIPT_DIFFERS, 'the item already has a machine transcript, and it is another one', { evidenceId: input.evidenceId });
    }
    return { outcome: 'ALREADY_COMMITTED', jsonSha256: existing.jsonSha256 };
  }
  await store.writeSealedTranscript({ evidenceId: input.evidenceId, jsonSha256: row.jsonSha256, srtSha256: row.srtSha256, vttSha256: row.vttSha256, model: row.model, diarization: row.diarization, labelsStatus: row.labelsStatus, createdAt: input.createdAt });
  return { outcome: 'WRITTEN', jsonSha256: row.jsonSha256 };
}

/** The transcript summary of an evidence item in the `evidence` slice (`@dems/shared/api`). */
export type EvidenceTranscriptSummary = NonNullable<EvidenceItemBody['transcript']>;

const SLICE_STATE = { ASSEMBLED: 'READY', PARTIAL: 'PARTIAL', DISABLED: 'DISABLED' } as const;

/**
 * THE SUMMARY IS A PROJECTION OF THE MANIFEST'S TRANSCRIPT BLOCK, and of nothing else but the
 * head of the revision chain: what the list pane shows is what was signed. Its two callers (fix
 * pass F-M6, R80-01): THE SEAL (`sealInputWithTranscriptSummary` below, in the unit that commits
 * the item) and the boot step that reads the sealed manifest back after a start of the Core
 * (`modules/transcripts/heads.ts`; no column holds the summary).
 *
 *   manifest `ASSEMBLED` -> `READY`     every chunk committed
 *   manifest `PARTIAL`   -> `PARTIAL`   with `failedChunks`, and `backendUnreachable` when so
 *   manifest `DISABLED`  -> `DISABLED`  no hash, no speaker state
 *   manifest `PARTIAL` without a document (row 119, `TRANSCRIPT_UNAVAILABLE_AT_SEAL`)
 *                        -> `PARTIAL`   no hash, no speaker state; `failedChunks` when the plan is
 *                                       known. The slice has no member for the reason yet (request
 *                                       filed by row 119): `sha256: null` beside PARTIAL is the sign.
 *
 * `sha256` and `machineTranscriptHash` are both the hash of the sealed machine transcript: a
 * revision never changes it (OD-15). `revision` is the current head of the chain, 0 when none.
 */
export function evidenceTranscriptSummary(manifest: ManifestTranscriptBlock, revisionHead: number): EvidenceTranscriptSummary {
  return {
    state: SLICE_STATE[manifest.state],
    sha256: manifest.sha256,
    machineTranscriptHash: manifest.sha256,
    labelsStatus: manifest.speakerState,
    revision: revisionHead,
    ...(manifest.failedChunks === null ? {} : { failedChunks: manifest.failedChunks }),
    backendUnreachable: manifest.backendUnreachable,
  };
}

/**
 * THE SEAL'S INPUT WITH THE SUMMARY OF ITS ITEM (fix pass F-M6, R80-01): what the composition
 * hands the engine's `completeSeal`, so the item is committed and published WITH its transcript
 * state - a client never sees a sealed item of a Core without one. Head 0: a seal has no revision.
 */
export function sealInputWithTranscriptSummary(input: CompleteSealInput, transcript: FinalizedTranscript): CompleteSealInput {
  return { ...input, transcript: evidenceTranscriptSummary(transcript.manifest, 0) };
}
