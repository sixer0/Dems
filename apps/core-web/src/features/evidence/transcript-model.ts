/**
 * The transcript pane: the pure rules (blueprint row 92, M8-W3; UX spec flow 6; R-5; API contract
 * C3 §2.3 ops 84, 85, 86; decision OD-15). No React, no clock, no request.
 *
 * | Rule | Where |
 * |------|-------|
 * | The sealed machine transcript is IMMUTABLE: a revision never overwrites a segment. The pane shows the original and, beside it, the newest revision of that segment as DERIVED | `deriveSegments` |
 * | Speaker labels default to UNAVAILABLE: a label is shown only when the document says LABELLED and the segment carries one. No speaker is ever invented | `readTranscriptDocument` |
 * | The pane state is one of ASSEMBLED / PARTIAL / UNAVAILABLE / DISABLED / UNKNOWN, and is the item summary's: never assumed (R80-01) | `paneStateOf`, `sealedWithoutDocument` |
 * | A revision is built on the CURRENT revision number (`baseRevision`); a mismatch is the Core's 409 | `revisionRequestOf`, `reviseRefusalOf` |
 * | An answer is read defensively: a document or a revision that cannot be read whole is not drawn in part | `readTranscriptDocument`, `readTranscriptRevisions` |
 */
import { readRevisionReason } from '@dems/shared/evidence-rules'
import type { ItemTranscriptSummary } from './item-v2'

export type SpeakerState = 'LABELLED' | 'UNAVAILABLE'

export interface TranscriptSegment {
  readonly index: number
  readonly startMs: number
  readonly endMs: number
  readonly text: string
  /** null unless the document is LABELLED and the Core labelled this segment. */
  readonly speaker: string | null
}

export interface TranscriptDocument {
  readonly speakerState: SpeakerState
  readonly segments: readonly TranscriptSegment[]
  /** Hash of the SEALED machine transcript; no revision changes it. */
  readonly machineTranscriptHash: string | null
  readonly assembledAt: number | null
  /** The current max revision number as the Core answered it; 0: none. */
  readonly revision: number
}

export interface TranscriptChange {
  readonly segmentIndex: number
  readonly from: string
  readonly to: string
}

export interface TranscriptRevision {
  readonly revisionId: string
  readonly number: number
  readonly authorId: string
  readonly baseRevision: number
  readonly signedBy: string
  /** True for the simulator's stand-in signature; false for the Core's Ed25519 signature. */
  readonly simulated: boolean
  readonly createdAt: number | null
  readonly changes: readonly TranscriptChange[]
  /** Fix wave K (G81b-09): why the revision was made, when the revision itself carries it (`reason`); null: the answer has no such member. */
  readonly reason: string | null
}

/** The longest corrected text and note the form accepts (the note bound is the contract's). */
export const REVISION_TEXT_MAX = 4000
export const REVISION_NOTE_MAX = 500
/** The shortest reason the Core stores (operation 85: `note`, 5 to 500 characters after trimming; pass D6). */
export const REVISION_NOTE_MIN = 5
const MAX_SEGMENTS = 20_000
const MAX_REVISIONS = 500
const MAX_CHANGES = 2_000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const whole = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null)
const label = (value: unknown, max = 64): string | null => (typeof value === 'string' && value.length > 0 && value.length <= max ? value : null)
const hash = (value: unknown): string | null => (typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null)

/** The document of operation 84, or null when it cannot be read whole. */
export function readTranscriptDocument(value: unknown): TranscriptDocument | null {
  if (!isRecord(value) || !Array.isArray(value.segments) || value.segments.length > MAX_SEGMENTS) return null
  // Default UNAVAILABLE: only the exact word LABELLED turns labels on.
  const speakerState: SpeakerState = value.speakerState === 'LABELLED' ? 'LABELLED' : 'UNAVAILABLE'
  const segments: TranscriptSegment[] = []
  for (const entry of value.segments) {
    if (!isRecord(entry)) return null
    const index = whole(entry.index)
    const startMs = whole(entry.startMs)
    const endMs = whole(entry.endMs)
    if (index === null || startMs === null || endMs === null || typeof entry.text !== 'string') return null
    segments.push({ index, startMs, endMs, text: entry.text, speaker: speakerState === 'LABELLED' ? label(entry.speaker, 120) : null })
  }
  return {
    speakerState,
    segments,
    machineTranscriptHash: hash(value.machineTranscriptHash),
    assembledAt: typeof value.assembledAt === 'number' && Number.isFinite(value.assembledAt) ? value.assembledAt : null,
    revision: whole(value.revision) ?? 0,
  }
}

function readChange(value: unknown): TranscriptChange | null {
  if (!isRecord(value)) return null
  const segmentIndex = whole(value.segmentIndex)
  if (segmentIndex === null || typeof value.from !== 'string' || typeof value.to !== 'string') return null
  return { segmentIndex, from: value.from, to: value.to }
}

/** One revision (the answer of operation 85, an element of operation 86), or null. */
export function readTranscriptRevision(value: unknown): TranscriptRevision | null {
  if (!isRecord(value) || !Array.isArray(value.changes) || value.changes.length > MAX_CHANGES) return null
  const revisionId = label(value.revisionId, 32)
  const number = whole(value.number)
  const authorId = label(value.authorId)
  const baseRevision = whole(value.baseRevision)
  if (revisionId === null || number === null || number < 1 || authorId === null || baseRevision === null) return null
  const changes: TranscriptChange[] = []
  for (const entry of value.changes) {
    const change = readChange(entry)
    if (change === null) return null
    changes.push(change)
  }
  const signature = isRecord(value.signature) ? value.signature : {}
  return {
    revisionId,
    number,
    authorId,
    baseRevision,
    signedBy: label(value.signedBy) ?? label(signature.keyId) ?? '',
    // Real only when the Core says so in so many words; anything else reads as the stand-in.
    simulated: !(signature.simulated === false && signature.algorithm === 'Ed25519'),
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : null,
    changes,
    // THE SHARED READING (batch N; R101-03, ruling D241): trimmed, 1 to 500 characters after trimming - the same on the mobile apps.
    reason: readRevisionReason(value),
  }
}

/**
 * The stated reason of each revision of an item (fix wave K, G81b-09). Operations 85 / 86 carry
 * `reason` on every revision entry (`contract_wave_k.md` KR section 2). The revision's own member
 * wins. Only for an entry WITHOUT the member (a Core older than the member) the audit row of the
 * revision (`TRANSCRIPT_REVISED`: `details.revisionId`, `details.reason`) is read, in the console's
 * audit slice for a role that reads it, for the SAME item and revision id; else null - "Reason:
 * not reported", never a guess.
 */
export function revisionReasons(
  revisions: readonly Pick<TranscriptRevision, 'revisionId' | 'reason'>[],
  evidenceId: string,
  auditRows: readonly { readonly type: string; readonly evidenceId?: string | null; readonly details: Readonly<Record<string, unknown>> }[],
): ReadonlyMap<string, string> {
  const reasons = new Map<string, string>()
  for (const revision of revisions) if (revision.reason !== null) reasons.set(revision.revisionId, revision.reason)
  for (const row of auditRows) {
    if (row.type !== 'TRANSCRIPT_REVISED' || row.evidenceId !== evidenceId) continue
    const { revisionId, reason } = row.details
    if (typeof revisionId !== 'string' || typeof reason !== 'string' || reason.trim() === '' || reasons.has(revisionId)) continue
    if (revisions.some((revision) => revision.revisionId === revisionId)) reasons.set(revisionId, reason)
  }
  return reasons
}

/** The page of operation 86, newest first, or null when any element cannot be read (a list with a hole hides a revision). */
export function readTranscriptRevisions(value: unknown): TranscriptRevision[] | null {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > MAX_REVISIONS) return null
  const revisions: TranscriptRevision[] = []
  for (const entry of value.items) {
    const revision = readTranscriptRevision(entry)
    if (revision === null) return null
    revisions.push(revision)
  }
  return revisions.sort((a, b) => b.number - a.number)
}

export type TranscriptPaneState = 'ASSEMBLED' | 'PARTIAL' | 'UNAVAILABLE' | 'DISABLED' | 'UNKNOWN'

/**
 * The state the pane names IS THE STATE THE ITEM'S SUMMARY REPORTS - what the seal signed in the
 * manifest (code review row 80, finding R80-01). Nothing is inferred from a document having arrived:
 *
 *   no summary            UNKNOWN ("Transcript state not reported"), with or without a document.
 *                         NEVER ASSEMBLED: an item that reports no state has none a reader may assume;
 *   DISABLED              transcription was turned off: there is no document to ask for;
 *   PARTIAL               parts of the audio have no text - also when NO document was sealed
 *                         (unavailable at the seal: `sealedWithoutDocument`);
 *   READY + a document    ASSEMBLED - the only way to that word;
 *   anything else         UNAVAILABLE (not ready, failed, refused, not loaded yet).
 */
export function paneStateOf(summary: Pick<ItemTranscriptSummary, 'state'> | null, hasDocument: boolean): TranscriptPaneState {
  if (summary === null) return 'UNKNOWN'
  if (summary.state === 'DISABLED') return 'DISABLED'
  if (summary.state === 'PARTIAL') return 'PARTIAL'
  return summary.state === 'READY' && hasDocument ? 'ASSEMBLED' : 'UNAVAILABLE'
}

/**
 * True when the summary DECLARES that no transcript document was sealed: disabled by configuration,
 * or PARTIAL without a hash (unavailable at the seal). Nothing is then asked of the Core - operation
 * 84 could only refuse, and "not available yet" would promise a document that will never come.
 */
export function sealedWithoutDocument(summary: Pick<ItemTranscriptSummary, 'state' | 'sha256'> | null): boolean {
  return summary !== null && (summary.state === 'DISABLED' || (summary.state === 'PARTIAL' && summary.sha256 === null))
}

export interface DerivedSegment {
  /** The sealed original, never altered. */
  readonly segment: TranscriptSegment
  /** The newest revision that corrects this segment, or null. Derived: not part of the sealed transcript. */
  readonly revised: { readonly number: number; readonly authorId: string; readonly text: string } | null
}

/** Each sealed segment with the newest correction of it. The originals are returned as they were read. */
export function deriveSegments(document: Pick<TranscriptDocument, 'segments'>, revisions: readonly TranscriptRevision[]): DerivedSegment[] {
  const newest = new Map<number, { number: number; authorId: string; text: string }>()
  for (const revision of [...revisions].sort((a, b) => a.number - b.number)) {
    for (const change of revision.changes) newest.set(change.segmentIndex, { number: revision.number, authorId: revision.authorId, text: change.to })
  }
  return document.segments.map((segment) => ({ segment, revised: newest.get(segment.index) ?? null }))
}

/** The revision number a new revision is built on: the greatest the client has seen. */
export function currentRevisionNumber(document: Pick<TranscriptDocument, 'revision'> | null, revisions: readonly TranscriptRevision[]): number {
  return revisions.reduce((max, revision) => Math.max(max, revision.number), document?.revision ?? 0)
}

export type RevisionFieldError = 'unchanged' | 'tooLong'

/** The form check before a request: the text must differ from the current one and fit the bound. */
export function validateRevisionText(current: string, typed: string): RevisionFieldError | null {
  if (typed.length > REVISION_TEXT_MAX) return 'tooLong'
  return typed === current ? 'unchanged' : null
}

export interface RevisionRequest {
  readonly baseRevision: number
  readonly changes: readonly TranscriptChange[]
  readonly note: string
}

/** The reason as it is sent: trimmed. */
export const revisionNoteOf = (note: string): string => note.trim()

/** A revision needs a stated reason: {@link REVISION_NOTE_MIN} to {@link REVISION_NOTE_MAX} characters after trimming. The form keeps Save disabled until then. */
export function revisionNoteOk(note: string): boolean {
  const length = revisionNoteOf(note).length
  return length >= REVISION_NOTE_MIN && length <= REVISION_NOTE_MAX
}

/** The body of operation 85 for one corrected segment. `from` is the text the operator saw, for the record. The note is always sent (the contract requires it). */
export function revisionRequestOf(baseRevision: number, segmentIndex: number, from: string, to: string, note: string): RevisionRequest {
  return { baseRevision, changes: [{ segmentIndex, from, to }], note: revisionNoteOf(note).slice(0, REVISION_NOTE_MAX) }
}

export type ReviseRefusal = 'CONFLICT' | 'NOT_READY' | 'DENIED' | 'OTHER'

/** What a refused operation 85 is (UX §7.2 step 7, §7.4). */
export function reviseRefusalOf(status: number | null, code: string): ReviseRefusal {
  if (status === 409 && code === 'TRANSCRIPT_REVISION_CONFLICT') return 'CONFLICT'
  if (status === 409 && code === 'TRANSCRIPT_NOT_READY') return 'NOT_READY'
  if (status === 403) return 'DENIED'
  return 'OTHER'
}

export type TranscriptReadRefusal = 'NOT_READY' | 'DENIED' | 'FAILED'

/** What a refused operation 84 / 86 is. */
export function readRefusalOf(status: number | null, code: string): TranscriptReadRefusal {
  if (status === 409 && code === 'TRANSCRIPT_NOT_READY') return 'NOT_READY'
  if (status === 403) return 'DENIED'
  return 'FAILED'
}
