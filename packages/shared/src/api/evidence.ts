/**
 * Area 5 of the Core API: evidence (backend task: 2026-10-04 01_specs §7.9, §7.17, §7.18, §11; plan
 * row W27, contract C).
 *
 * Five operations make up the area. `exportEvidence` (42) is a design-book operation and lives in
 * `core-api.ts`; the four below are answered by the Core server only.
 *
 * | # | operationId | Access | Audit on success | Simulator action |
 * |--:|-------------|--------|------------------|------------------|
 * | 39 | `listEvidence` | EVIDENCE_VIEW | NONE-R | reads `evidence` |
 * | 40 | `getEvidence` | EVIDENCE_VIEW | NONE-R | reads `evidence` |
 * | 41 | `verifyEvidence` | EVIDENCE_VIEW | EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED, by the verdict | `verify` |
 * | 43 | `archiveEvidence` | EVIDENCE_REVIEW | EVIDENCE_ARCHIVED (none when already archived) | `archiveEvidence` |
 *
 * Domain rules (I11): no operation changes the tracks, the track hashes, the manifest hash or the
 * signature of an item; a status change adds a custody entry and an audit row. Schema v2 (task 3
 * M2-W7; C3 §3 op 39/41): v2 items carry per-FILE hashes and chains, no operation sets the status
 * UNDER_REVIEW.
 *
 * Media (schema v2; C3 §2.4; NM-11; E-31): `createEvidenceMediaSession` (op 88) opens a short-lived
 * signed loopback session to the decrypted camera file; the URL is a bearer value that never enters
 * a log or an audit row. Simulated mode still plays the bundled demo media and opens none (MS-1
 * stays true there); `getEvidence` says with `EvidenceMediaRef` whether a bundled package belongs
 * to the item or a live session can play it.
 */
import { z } from 'zod';
import { TrackId } from '../domain/enums';
import { AuditType, CaseType, EvidenceStatus, Permission } from '../sim/vocabulary';
import { API_BASE_PATH, API_PAGE_LIMIT_DEFAULT } from './constants';
import {
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, deniedExamples, simRefusalExample } from './example-parts';
import type { OperationExamples } from './examples';
import {
  CORE_SERVER_NOTE,
  INVALID_INPUT,
  INVALID_JSON,
  INVALID_PATH_PARAMETER,
  INVALID_QUERY,
  LIST_READ_NOTE,
  NOT_SIGNED_IN,
  SIM_V2_NOTE,
  backendSource,
  hostedNote,
  notPermitted,
} from './operation-parts';
import { DEMO_PACKAGE_SUFFIX_PATTERN, EVIDENCE_ID_PATTERN, EXPORT_JOB_ID_PATTERN } from './patterns';
import { boundedText, count, epochMs, evidenceId, nextCursor, nullableEpochMs, operatorId, pageCursor, pageLimit, sha256Hex, trimmedText } from './schema-parts';
import { apiText } from './text';
import { EXAMPLE_EVIDENCE_ITEM, STATE_EXAMPLE_IDS } from './state-examples';
import { EvidenceItemSchema } from './state-slices';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Longest search text of `listEvidence`, in characters and in UTF-16 code units. */
export const EVIDENCE_SEARCH_MAX_LENGTH = 100;

export const EvidenceListQuerySchema = z
  .object({
    status: z.enum(EvidenceStatus).optional().describe('Only items with this status.'),
    caseType: z.enum(CaseType).optional().describe('Only items of this case type (the subject type of the session).'),
    q: boundedText(EVIDENCE_SEARCH_MAX_LENGTH)
      .optional()
      .describe(
        `Search text, 1 to ${EVIDENCE_SEARCH_MAX_LENGTH} characters after trimming: matched without regard to case against the evidence ID, the session ID, the case number and the subject name.`,
      ),
    cursor: pageCursor(),
    limit: pageLimit(),
  })
  .describe('Query of `GET /api/v1/evidence`: filters, a search text and the paging members of API-9.');
export type EvidenceListQuery = z.output<typeof EvidenceListQuerySchema>;

export const EvidencePageSchema = z
  .strictObject({
    items: z.array(EvidenceItemSchema).describe('Evidence items, newest recording first: the elements of the `evidence` slice.'),
    nextCursor: nextCursor(),
  })
  .describe('One page of evidence items.');
export type EvidencePage = z.output<typeof EvidencePageSchema>;

/** Where the media of an evidence item comes from (01_specs §11, MS-2; schema v2 adds LIVE_STREAM — C3 §3 op 40). */
export const EvidenceMediaSource = { DEMO_PACKAGE: 'DEMO_PACKAGE', LIVE_STREAM: 'LIVE_STREAM', NONE: 'NONE' } as const;
export type EvidenceMediaSource = (typeof EvidenceMediaSource)[keyof typeof EvidenceMediaSource];

export const EvidenceMediaRefSchema = z
  .strictObject({
    source: z
      .enum(EvidenceMediaSource)
      .describe(
        'DEMO_PACKAGE: the demo package a client bundles belongs to this item. LIVE_STREAM (schema v2): a signed media session (op 88) can play the decrypted camera file. NONE: no media exists for it.',
      ),
    packageSuffix: z
      .string()
      .regex(DEMO_PACKAGE_SUFFIX_PATTERN)
      .nullable()
      .describe('The join key of the bundled package, e.g. `0004`; null when the source is not DEMO_PACKAGE.'),
  })
  .refine((ref) => (ref.source === EvidenceMediaSource.DEMO_PACKAGE) === (ref.packageSuffix !== null), {
    error: 'packageSuffix is set exactly when the source is DEMO_PACKAGE.',
    path: ['packageSuffix'],
  })
  .describe(
    'Which media belongs to an evidence item. It names no file and no path: playback travels through the signed media session of operation 88 (E-31; the v1 MS-1 reading stays true for Simulated mode).',
  );
export type EvidenceMediaRef = z.output<typeof EvidenceMediaRefSchema>;

export const EvidenceDetailSchema = z
  .strictObject({
    evidence: EvidenceItemSchema,
    media: EvidenceMediaRefSchema,
  })
  .describe('One evidence item and the reference to its media.');
export type EvidenceDetail = z.output<typeof EvidenceDetailSchema>;

export const EvidenceVerifyResultSchema = z
  .strictObject({
    evidenceId: evidenceId(),
    ok: z.boolean().describe('True when every file, the transcript hash, the manifest and the signature verify.'),
    at: epochMs().describe('When the verification ran, on the server clock.'),
    tracks: z
      .array(
        z.strictObject({
          trackId: z.enum(TrackId),
          expected: sha256Hex().describe('The sealed hash of the track.'),
          actual: sha256Hex().describe('The hash the verification computed.'),
          ok: z.boolean(),
        }),
      )
      .describe('One result per v1 track; a schema-v2 item answers `files` instead (C3 §3 op 41).'),
    // Schema v2 (C3 §3 op 41; OD-02/OD-03/OD-21): per-FILE fragment-chain verification.
    files: z
      .array(
        z.strictObject({
          fileId: trimmedText(64),
          trackId: z.enum([TrackId.VIDEO_01, TrackId.VIDEO_02]),
          storedOk: z.boolean().describe('Hash of the stored bytes matches the sealed value.'),
          plainOk: z.boolean().describe('Hash of the plaintext bytes matches the sealed value.'),
          chainOk: z.boolean().describe('Every fragment checkpoint continues the chain (V-11 idiom; one tampered fragment answers false — OD-02 L2).'),
          fragmentCount: count().nullable(),
          ok: z.boolean(),
        }),
      )
      .optional()
      .describe('Schema v2: one result per camera file, both hashes and the fragment chain.'),
    transcriptOk: z
      .boolean()
      .optional()
      .describe('Schema v2: the sealed transcript hash matches the stored document; absent for an item without a transcript.'),
    manifestOk: z.boolean(),
    signatureOk: z.boolean().describe('Schema v2: a real Ed25519 signature is verified with the Core public key (OD-02).'),
  })
  .describe('The verdict of record of an integrity verification (schema v2: per-file chains, transcript hash, real signature).');
export type EvidenceVerifyResultBody = z.output<typeof EvidenceVerifyResultSchema>;

// ── Operations 84-88: transcript, revisions, export job, media session ────────────────────────
// (task 3 M2-W7, blueprint row 48; register SH-14; C3 §2.2/§2.3/§2.4; OD-15/OD-16; NM-06/NM-11/NM-12)

/** One segment of the canonical document (`dems.transcript/1`; transcript-spec §A.5), REST camelCase. */
export const TranscriptSegmentSchema = z
  .strictObject({
    index: count().describe('Segment number within the document.'),
    startMs: count().describe('Media-pts start.'),
    endMs: count().describe('Media-pts end.'),
    text: apiText().describe('The spoken text; API-13 text rule.'),
    speaker: apiText()
      .min(1)
      .nullable()
      .describe('Speaker label when diarization labelled it; null when UNAVAILABLE (D226 labels part; never blocks text).'),
  })
  .describe('One transcript segment.');
export type TranscriptSegmentBody = z.output<typeof TranscriptSegmentSchema>;

/** Success of op 84: the machine transcript inside the seal plus its binding hashes (C3 §2.3). */
export const TranscriptDocumentSchema = z
  .strictObject({
    documentVersion: z
      .literal('dems.transcript/1')
      .describe('Canonical document version; the VALUE is owned by transcript-spec §0.2 (TRANSCRIPT_DOC_VERSION) — cited, not duplicated (J.9).'),
    language: z.literal('id').describe('Transcript language (D226; fixed for this phase).'),
    speakerState: z.enum(['LABELLED', 'UNAVAILABLE']).describe('Diarization state (transcript-spec §A.4).'),
    segments: z.array(TranscriptSegmentSchema),
    sha256: sha256Hex().describe('Hash of this canonical document as stored.'),
    machineTranscriptHash: sha256Hex().describe('Hash of the SEALED machine transcript; revisions never change it (OD-15).'),
    assembledAt: epochMs(),
    revision: count().describe('Current max(revision_no); 0 when no revision exists (SEC35-21).'),
  })
  .describe('The machine transcript of an evidence item (op 84).');
export type TranscriptDocumentBody = z.output<typeof TranscriptDocumentSchema>;

/** Request body of op 85: one signed correction set bound to the current revision (SEC35-21). */
export const TranscriptRevisionRequestSchema = z
  .strictObject({
    baseRevision: count().describe('The item\'s CURRENT max(revision_no) as the caller saw it (0 when none). A mismatch answers 409 TRANSCRIPT_REVISION_CONFLICT; the check runs inside the minting transaction (SEC35-21; dbc-3 §B.9).'),
    changes: z
      .array(
        z.strictObject({
          segmentIndex: count().describe('Which segment of the machine transcript to correct.'),
          from: apiText().describe('The text being replaced (for the record; not trusted as the current value).'),
          to: apiText().describe('The corrected text.'),
        }),
      )
      .min(1)
      .describe('The corrections, applied in order.'),
    note: boundedText(500).optional().describe('Why the revision was made; travels to the audit row as `reason`.'),
  })
  .describe('Request body of `POST /api/v1/evidence/{id}/transcript/revisions` (C3 §2.3 op 85).');
export type TranscriptRevisionRequest = z.output<typeof TranscriptRevisionRequestSchema>;

/** Success of op 85 / element of op 86's page: one appended, signed revision. */
export const TranscriptRevisionSchema = z
  .strictObject({
    revisionId: trimmedText(32).describe('`TRV-NNNNNN`.'),
    number: count().int().min(1).describe('The 1-based revision number (max+1 inside the minting transaction).'),
    authorId: operatorId().describe('Who revised (OD-15: author recorded; no approval flow).'),
    baseRevision: count().describe('The max(revision_no) this revision was built on (SEC35-21).'),
    machineTranscriptHash: sha256Hex().describe('The sealed machine transcript this revision binds to — byte-unchanged by it (OD-15).'),
    signedBy: trimmedText(64).describe('Id of the Core key that signed (OD-15: Core key signs; never the key itself).'),
    signature: z
      .strictObject({
        value: z.string().regex(/^(?:[0-9a-f]{64}|[0-9a-f]{128})$/),
        keyId: trimmedText(64),
        algorithm: z.enum(['Ed25519', 'SIMULATED-SHA256']),
        simulated: z.boolean(),
      })
      .describe('Signature over the revision (dbc-3 §B.9/§C.4 pairs; SEC35-20 certificate is server-side).'),
    createdAt: epochMs(),
    changes: z
      .array(
        z.strictObject({
          segmentIndex: count(),
          from: apiText(),
          to: apiText(),
        }),
      )
      .describe('The corrections as stored.'),
  })
  .describe('One signed transcript revision (append-only; V-11 walks the parent_sha256 chain).');
export type TranscriptRevisionBody = z.output<typeof TranscriptRevisionSchema>;

export const TranscriptRevisionPageSchema = z
  .strictObject({
    items: z.array(TranscriptRevisionSchema),
    nextCursor: nextCursor(),
  })
  .describe('One page of transcript revisions (op 86; API-9).');
export type TranscriptRevisionPage = z.output<typeof TranscriptRevisionPageSchema>;

/** Success of op 87: the export job (NM-12). A FAILED job is a 200 answer, not an HTTP error (§4). */
export const EvidenceExportJobSchema = z
  .strictObject({
    jobId: trimmedText(32).describe('`EXPJ-NNNNNN`.'),
    evidenceId: evidenceId(),
    kind: z.enum(['PACKAGE', 'COMPOSITE']),
    status: z.enum(['QUEUED', 'RUNNING', 'COMPLETE', 'FAILED']),
    progressPct: z.int().min(0).max(100),
    etaMs: nullableEpochMs(),
    manifestHash: sha256Hex().optional().describe('Set when COMPLETE.'),
    signature: z.string().regex(/^(?:[0-9a-f]{64}|[0-9a-f]{128})$/).optional().describe('Export-manifest signature when COMPLETE (OD-16).'),
    derived: z.boolean().describe('True for a COMPOSITE output: marked derived and hashed in the export manifest (OD-16).'),
    createdAt: epochMs(),
    completedAt: nullableEpochMs().optional(),
    failureReason: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional()
      .describe('SCREAMING_SNAKE cause when FAILED; the EVIDENCE_EXPORT_FAILED row carries the same code.'),
  })
  .describe('The background export job of op 42/87 (NM-12; OD-16).');
export type EvidenceExportJobBody = z.output<typeof EvidenceExportJobSchema>;

/**
 * Success of op 88: the short-lived signed media session (NM-11; SEC35-12/13). The URL is a BEARER
 * value: bound to `(operatorId, sessionId, evidenceId, fileId)`, HMAC-signed with the separate
 * media-session key, TTL `EVIDENCE_MEDIA_SESSION_TTL_MS`, prefix `mts_` — and it never enters a
 * log or an audit row (E-31). Loopback only (N-4): the pattern below enforces it on the wire.
 */
export const EvidenceMediaSessionSchema = z
  .strictObject({
    evidenceId: evidenceId(),
    fileId: z.enum([TrackId.VIDEO_01, TrackId.VIDEO_02]).describe('Which camera file this session plays.'),
    url: z
      .string()
      .regex(/^http:\/\/127\.0\.0\.1(?::\d{1,5})?\//)
      .describe('Signed loopback URL with the mts_ token (SEC35-13). Bearer value: never logged, never audited, never replicated (E-31).'),
    expiresAt: epochMs().describe('Core instant the URL dies; the replay window is exactly this TTL (SEC35-12).'),
    ranges: z.literal(true).describe('The route answers Range requests (NM-11 playback).'),
  })
  .describe('A short-lived signed evidence-media session (op 88; live-only — Simulated mode plays the bundled demo media instead).');
export type EvidenceMediaSessionBody = z.output<typeof EvidenceMediaSessionSchema>;

/** The schemas operations 84-88 add (merged into `CORE_API_SCHEMAS`). */
export const TRANSCRIPT_MEDIA_SCHEMAS = {
  TranscriptSegment: TranscriptSegmentSchema,
  TranscriptDocument: TranscriptDocumentSchema,
  TranscriptRevisionRequest: TranscriptRevisionRequestSchema,
  TranscriptRevision: TranscriptRevisionSchema,
  TranscriptRevisionPage: TranscriptRevisionPageSchema,
  EvidenceExportJob: EvidenceExportJobSchema,
  EvidenceMediaSession: EvidenceMediaSessionSchema,
} as const;

/** The named schemas of this area, by their `components.schemas` name. */
export const EVIDENCE_SCHEMAS = {
  EvidenceListQuery: EvidenceListQuerySchema,
  EvidencePage: EvidencePageSchema,
  EvidenceMediaRef: EvidenceMediaRefSchema,
  EvidenceDetail: EvidenceDetailSchema,
  EvidenceVerifyResult: EvidenceVerifyResultSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

const SECTION = '§7.9';
const EVIDENCE_PATH = `${API_BASE_PATH}/evidence`;
const EVIDENCE_VIEW = permissionAccess(Permission.EVIDENCE_VIEW);
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;
const EVIDENCE_PARAM = { name: 'id', description: 'Evidence ID `EV-{YYYYMMDD}-NNNN`.', pattern: EVIDENCE_ID_PATTERN } as const;
const VIEW_REFUSED = notPermitted(Permission.EVIDENCE_VIEW);
const UNKNOWN_EVIDENCE = { description: 'No evidence item has this ID (NOT_FOUND).', schema: 'ApiError' } as const;
/** Schema v2 (C3 §2.3 op 84/85/86): the transcript is not there yet. */
const TRANSCRIPT_NOT_READY = {
  description: 'The transcript is not available yet (TRANSCRIPT_NOT_READY).',
  schema: 'ApiError',
} as const;

export const EVIDENCE_OPERATIONS = [
  {
    operationId: 'listEvidence',
    method: 'get',
    path: EVIDENCE_PATH,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Evidence list',
    description: [
      `The evidence items, newest recording first, in pages of ${API_PAGE_LIMIT_DEFAULT} unless \`limit\` says otherwise. \`status\` and \`caseType\` filter; \`q\` searches the evidence ID, the session ID, the case number and the subject name.`,
      'Schema v2 (C3 §3 op 39; SH-07/SH-14): an item carries `files[]` — one whole fMP4 per camera with the stored-bytes and plaintext hashes and the fragment-chain head — `audioSourceIntervals[]`, the `transcript` summary, and a real Ed25519 signature; the v1 `tracks[]` shape stays readable until every producer is on v2 (rows 49/51).',
      LIST_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 39),
    query: { schema: 'EvidenceListQuery' },
    responses: {
      200: { description: 'One page of evidence items.', schema: 'EvidencePage' },
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      422: INVALID_QUERY,
    },
    access: EVIDENCE_VIEW,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getEvidence',
    method: 'get',
    path: `${EVIDENCE_PATH}/{id}`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Evidence item',
    description: [
      'One evidence item, and the reference to its media. Schema v2 (C3 §3 op 40): the source gains `LIVE_STREAM` — a signed media session (op 88) can play the decrypted camera file; `DEMO_PACKAGE` and `NONE` keep their v1 meaning.',
      'The answer holds no file, no path and no signed URL: playback travels through op 88, and the URL it returns is never logged or audited (E-31). For REAL evidence the read is additionally scoped to the caller\'s own case/session or a SUPERVISOR once SEC35-16 is confirmed (C3 §2.4 — provisional; M8).',
      LIST_READ_NOTE,
    ].join('\n\n'),
    source: backendSource(SECTION, 40),
    pathParam: EVIDENCE_PARAM,
    responses: {
      200: { description: 'The item and its media reference.', schema: 'EvidenceDetail' },
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      404: UNKNOWN_EVIDENCE,
      422: INVALID_PATH_PARAMETER,
    },
    access: EVIDENCE_VIEW,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'verifyEvidence',
    method: 'post',
    path: `${EVIDENCE_PATH}/{id}/verify`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Verify integrity',
    description: [
      'Runs the integrity verification of an item and returns the verdict of record. Schema v2 (C3 §3 op 41; OD-02/OD-03/OD-21): per-FILE fragment-chain verify — both hashes of every camera file and every checkpoint of its chain — plus the transcript hash and the real Ed25519 signature; one tampered fragment answers `ok: false` (OD-02 L2). A failed verification is an answer, not an error: `200` with `ok: false`.',
      'Writes EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED, by the verdict, and adds a custody entry. The files, the hashes, the manifest hash and the signature are not changed (I11).',
      hostedNote('verify'),
    ].join('\n\n'),
    source: backendSource(SECTION, 41),
    pathParam: EVIDENCE_PARAM,
    responses: {
      200: { description: 'The verdict, passed or failed.', schema: 'EvidenceVerifyResult' },
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      404: UNKNOWN_EVIDENCE,
      422: INVALID_PATH_PARAMETER,
    },
    access: EVIDENCE_VIEW,
    audit: { success: AuditType.EVIDENCE_VERIFIED, ...DENIED, also: [AuditType.EVIDENCE_VERIFY_FAILED] },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'archiveEvidence',
    method: 'post',
    path: `${EVIDENCE_PATH}/{id}/archive`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Archive evidence',
    description: [
      'Moves a sealed item to ARCHIVED and adds a custody entry. The sealed content is not changed.',
      'Schema v2 (C3 §3 op 43): the shape is unchanged and the operation is now valid for v2 items as well; `409 NOT_SEALED` keeps its meaning.',
      'Writes EVIDENCE_ARCHIVED. An item that is already archived changes nothing, writes nothing and still answers `204`.',
      hostedNote('archiveEvidence'),
    ].join('\n\n'),
    source: backendSource(SECTION, 43),
    pathParam: EVIDENCE_PARAM,
    responses: {
      204: { description: 'The item is archived.' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.EVIDENCE_REVIEW),
      404: UNKNOWN_EVIDENCE,
      409: { description: 'The item is RECORDED: it was never sealed (NOT_SEALED).', schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: permissionAccess(Permission.EVIDENCE_REVIEW),
    audit: { success: AuditType.EVIDENCE_ARCHIVED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations 84-88: transcript, revisions, export job, media session
// (task 3 M2-W7, blueprint row 48; register SH-14; C3 §2.2/§2.3/§2.4; OD-15/OD-16; NM-06/NM-11/NM-12)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const TRANSCRIPT_MEDIA_OPERATIONS = [
  {
    operationId: 'getTranscript',
    method: 'get',
    path: `${EVIDENCE_PATH}/{id}/transcript`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Machine transcript of an item',
    description: [
      'The machine transcript inside the seal (R-5; D222): the canonical `dems.transcript/1` document view — segments with speaker labels when diarization labelled them, `UNAVAILABLE` marked otherwise (D226) — plus the sealed machine-transcript hash the revisions bind to (OD-15).',
      'Not ready yet answers `409 TRANSCRIPT_NOT_READY`; audio that never reached the transcriber surfaces as `details.reason: TRANSCRIPT_AUDIO_UNAVAILABLE` while the package still seals `PARTIAL` without fabricated text (D-EV-1; transcript-spec §A.1/§E.5).',
      'Needs EVIDENCE_VIEW (every role). For REAL evidence the read is additionally case/session-scoped once SEC35-16 is confirmed (provisional; M8).',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 84; register SH-14/NM-06 (not in the design book)',
    pathParam: EVIDENCE_PARAM,
    responses: {
      200: { description: 'The transcript document.', schema: 'TranscriptDocument' },
      401: NOT_SIGNED_IN,
      // RECON-A (row 51a §5 B2b): every seeded role holds EVIDENCE_VIEW, so no role can be refused this
      // read; the 403 is the Origin / revoked-device guard only the Core server sends (01_specs §7.19).
      // The simulator answers an unknown `{id}` with 404 and does no path-parameter format check
      // (D-51a-6), so this 422 is produced only by the Core server's schema validation.
      403: { ...VIEW_REFUSED, services: CORE_SERVER_ONLY },
      404: UNKNOWN_EVIDENCE,
      409: TRANSCRIPT_NOT_READY,
      422: { ...INVALID_PATH_PARAMETER, services: CORE_SERVER_ONLY },
    },
    access: EVIDENCE_VIEW,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'createTranscriptRevision',
    method: 'post',
    path: `${EVIDENCE_PATH}/{id}/transcript/revisions`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Revise a transcript (signed, append-only)',
    description: [
      'Appends a signed revision (OD-15): TRANSCRIPT_REVISE — INVESTIGATOR and SUPERVISOR — the Core Ed25519 key signs, the author is recorded, there is NO approval flow. The sealed machine transcript stays byte-unchanged; `baseRevision` binds the revision to it.',
      '`baseRevision` is the item\'s current max(revision_no) (0 when none), read and compared INSIDE the INSERT transaction that mints max+1 (SEC35-21; dbc-3 §B.9 — no column, no sequence). A mismatch answers `409 TRANSCRIPT_REVISION_CONFLICT`.',
      'Writes TRANSCRIPT_REVISED: revisionId, authorId, number, baseRevision, changeCount, machineTranscriptHash, the optional reason and permission — never the transcript body or any segment text (`C3 §5.2`).',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 85; register SH-02/SH-03/SH-04/SH-14/NM-06 (not in the design book)',
    pathParam: EVIDENCE_PARAM,
    requestBody: { schema: 'TranscriptRevisionRequest', required: true },
    responses: {
      201: { description: 'The appended revision.', schema: 'TranscriptRevision' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.TRANSCRIPT_REVISE),
      404: UNKNOWN_EVIDENCE,
      409: {
        description:
          'The transcript is not available yet (TRANSCRIPT_NOT_READY), or baseRevision is no longer current (TRANSCRIPT_REVISION_CONFLICT — re-read op 84 and re-apply). A session whose audio never arrived surfaces details.reason TRANSCRIPT_AUDIO_UNAVAILABLE while the package seals PARTIAL (D-EV-1).',
        schema: 'ApiError',
      },
      422: INVALID_INPUT,
    },
    access: permissionAccess(Permission.TRANSCRIPT_REVISE),
    audit: { success: AuditType.TRANSCRIPT_REVISED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'listTranscriptRevisions',
    method: 'get',
    path: `${EVIDENCE_PATH}/{id}/transcript/revisions`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Transcript revisions of an item',
    description: [
      'The append-only revisions of the item, newest first, paged (API-9). V-11 verifies the parent_sha256 chain; this read lists it.',
      'Needs EVIDENCE_VIEW (every role; REAL-evidence scope per SEC35-16 provisional).',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 86; register SH-02/SH-14/NM-06 (not in the design book)',
    pathParam: EVIDENCE_PARAM,
    query: { schema: 'PageQuery' },
    responses: {
      200: { description: 'One page of revisions.', schema: 'TranscriptRevisionPage' },
      401: NOT_SIGNED_IN,
      // RECON-A (row 51a §5 B2b): every seeded role holds EVIDENCE_VIEW, so no role can be refused this
      // read; the 403 is the Origin / revoked-device guard only the Core server sends (01_specs §7.19).
      // The simulator ignores the query entirely, so the paged-read 422 is likewise Core-server-only (SR-64).
      403: { ...VIEW_REFUSED, services: CORE_SERVER_ONLY },
      404: UNKNOWN_EVIDENCE,
      409: TRANSCRIPT_NOT_READY,
      422: { ...INVALID_QUERY, services: CORE_SERVER_ONLY },
    },
    access: EVIDENCE_VIEW,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'getEvidenceExportJob',
    method: 'get',
    path: `${API_BASE_PATH}/evidence/exports/{id}`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Export job progress',
    description: [
      'Polls the background export job op 42 queued (NM-12; OD-16) to completion. A FAILED job is a `200` answer with `status: FAILED` — not an HTTP error; the failure is audited as EVIDENCE_EXPORT_FAILED by the job itself (`C3 §4/§5.2`).',
      'Needs EVIDENCE_EXPORT (SUPERVISOR), like the export request.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 87; register SH-14/NM-12/OD-16 (not in the design book)',
    pathParam: { name: 'id', description: 'Export job id `EXPJ-NNNNNN`.', pattern: EXPORT_JOB_ID_PATTERN },
    responses: {
      200: { description: 'The job.', schema: 'EvidenceExportJob' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.EVIDENCE_EXPORT),
      404: { description: 'No export job has this ID (NOT_FOUND).', schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: permissionAccess(Permission.EVIDENCE_EXPORT),
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'createEvidenceMediaSession',
    method: 'post',
    path: `${EVIDENCE_PATH}/{id}/media-sessions`,
    tag: CoreApiTag.EVIDENCE,
    mode: CoreApiMode.LIVE,
    summary: 'Open a signed media session',
    description: [
      'Returns a short-lived signed URL to the NM-11 media route, which serves the decrypted camera file with HTTP Range support (M8). The route is registry-external like `/ws`; it carries its own static rule and its token prefix `mts_` joins both log-blanking lists (SEC35-13; E-31; check M8-BLK-1).',
      'The URL is a bearer value (SEC35-12): HMAC-signed with the SEPARATE media-session signing key (`MEDIA_SESSION_SIGNING_KEY_ID`, never the evidence Signer key), bound to one `(operatorId, sessionId, evidenceId, fileId)` and rejected if any component differs, alive for exactly `EVIDENCE_MEDIA_SESSION_TTL_MS`. It never enters a log, an audit row or a replicated slice (E-31).',
      'LIVE only: Simulated mode plays the bundled demo media and opens no media session (NM-11; MS-1 stays true for Simulated mode). No playable decrypted file answers `409 MEDIA_NOT_AVAILABLE`.',
      'Writes EVIDENCE_MEDIA_SERVED: fileId, bytesServed, the optional range markers, signed, expiresAt — never the URL and never a byte of media (`C3 §5.2`). For REAL evidence the caller must additionally own the case/session or be a SUPERVISOR once SEC35-16 is confirmed (provisional; M8).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 88; register NM-11/WB-04/MB-07/E-31 (not in the design book)',
    pathParam: EVIDENCE_PARAM,
    responses: {
      201: { description: 'The signed media session.', schema: 'EvidenceMediaSession' },
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      404: UNKNOWN_EVIDENCE,
      409: { description: 'No playback media is available for this evidence item (MEDIA_NOT_AVAILABLE).', schema: 'ApiError' },
      422: INVALID_PATH_PARAMETER,
    },
    access: EVIDENCE_VIEW,
    audit: { success: AuditType.EVIDENCE_MEDIA_SERVED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

const ITEM = { id: STATE_EXAMPLE_IDS.evidenceId } as const;
const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
const BAD_PATH = { invalidPathParameter: ERROR_EXAMPLES.invalidPathParameter } as const;
const NOT_FOUND = { notFound: simRefusalExample('Unknown evidence ID', 'NOT_FOUND', 'Evidence not found.', 'NOT_FOUND') } as const;
/**
 * Every seeded role holds EVIDENCE_VIEW and the matrix is read-only, so no seeded operator can be
 * shown as refused for the permission: the 403 examples of the three operations are the two
 * refusals every operation shares.
 */
const VIEW_DENIED = BASIC_403_EXAMPLES;

/** The verdict of the simulator for `EV-20260930-0004` at the example instant: every track verifies. */
const VERIFY_PASSED: EvidenceVerifyResultBody = {
  evidenceId: STATE_EXAMPLE_IDS.evidenceId,
  ok: true,
  at: 1_790_823_600_000,
  tracks: EXAMPLE_EVIDENCE_ITEM.tracks.map((track) => ({ trackId: track.trackId, expected: track.sha256, actual: track.sha256, ok: true })),
  manifestOk: true,
  signatureOk: true,
};

/** The verdict of the simulator for `EV-20260930-0005`, whose AUDIO-02 track was altered. */
const VERIFY_FAILED: EvidenceVerifyResultBody = {
  evidenceId: STATE_EXAMPLE_IDS.tamperedEvidenceId,
  ok: false,
  at: 1_790_823_600_000,
  tracks: [
    {
      trackId: 'VIDEO-01',
      expected: '3c36139fc5d946d2290bd89d12e2a657a46a01a628ae0cb7776cd619794da903',
      actual: '3c36139fc5d946d2290bd89d12e2a657a46a01a628ae0cb7776cd619794da903',
      ok: true,
    },
    {
      trackId: 'VIDEO-02',
      expected: '91da7d0ea99c345ec08e57b645b9931c3fb9e0d97ab4d08a30b057230a8d9a70',
      actual: '91da7d0ea99c345ec08e57b645b9931c3fb9e0d97ab4d08a30b057230a8d9a70',
      ok: true,
    },
    {
      trackId: 'AUDIO-01',
      expected: 'd7e83d202d1fbb8652f1266461523488ee39f66237d268ba2b8e105a4fff5f2e',
      actual: 'd7e83d202d1fbb8652f1266461523488ee39f66237d268ba2b8e105a4fff5f2e',
      ok: true,
    },
    {
      trackId: 'AUDIO-02',
      expected: 'bb3af24347c7a036a7263bd660b1a37cd53bae699d885c3527eeac4394cd0d0c',
      actual: '6fdd78d18e15ca1cd7515332af712c2385164ae9cb6a0e0164ba23a49e5e91c8',
      ok: false,
    },
  ],
  manifestOk: true,
  signatureOk: true,
};

export const EVIDENCE_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  listEvidence: {
    responses: {
      200: {
        exported: {
          summary: 'Filtered by status EXPORTED: one item, the last page',
          value: { items: [EXAMPLE_EVIDENCE_ITEM], nextCursor: null } satisfies EvidencePage,
        },
        empty: { summary: 'Nothing matches', value: { items: [], nextCursor: null } satisfies EvidencePage },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      422: { invalidQuery: ERROR_EXAMPLES.invalidQuery },
    },
  },
  getEvidence: {
    pathParams: ITEM,
    responses: {
      200: {
        withPackage: {
          summary: 'A dataset item: the bundled demo package 0004 belongs to it',
          value: {
            evidence: EXAMPLE_EVIDENCE_ITEM,
            media: { source: 'DEMO_PACKAGE', packageSuffix: '0004' },
          } satisfies EvidenceDetail,
        },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      404: NOT_FOUND,
      422: BAD_PATH,
    },
  },
  verifyEvidence: {
    pathParams: ITEM,
    responses: {
      200: {
        passed: { summary: 'Every track, the manifest and the signature verify', value: VERIFY_PASSED },
        failed: { summary: `${STATE_EXAMPLE_IDS.tamperedEvidenceId}: AUDIO-02 does not match its sealed hash`, value: VERIFY_FAILED },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      404: NOT_FOUND,
      422: BAD_PATH,
    },
  },
  archiveEvidence: {
    pathParams: ITEM,
    responses: {
      401: SIGNED_OUT,
      403: deniedExamples('archiveEvidence', 'EVIDENCE_REVIEW', 'INVESTIGATOR'),
      404: NOT_FOUND,
      409: {
        notSealed: simRefusalExample(
          `${STATE_EXAMPLE_IDS.recordedEvidenceId}: incomplete session, never sealed`,
          'NOT_SEALED',
          'Unsealed evidence cannot be archived.',
          'UNSEALED_EVIDENCE',
          { from: null, event: 'archiveEvidence' },
        ),
      },
      422: BAD_PATH,
    },
  },
  // ── Operations 84-88 (task 3 M2-W7; C3 §2.2) ────────────────────────────────────────────────
  getTranscript: {
    pathParams: ITEM,
    responses: {
      200: {
        labelled: {
          summary: 'Two labelled segments of the canonical document',
          value: {
            documentVersion: 'dems.transcript/1',
            language: 'id',
            speakerState: 'LABELLED',
            segments: [
              { index: 0, startMs: 400, endMs: 4_200, text: 'Silakan mulai dari identitas Anda.', speaker: 'SPEAKER-1' },
              { index: 1, startMs: 4_600, endMs: 8_100, text: 'Baik, saya Ahmad Fauzi.', speaker: 'SPEAKER-2' },
            ],
            sha256: 'a'.repeat(64),
            machineTranscriptHash: 'b'.repeat(64),
            assembledAt: 1_790_823_600_000,
            revision: 0,
          } satisfies TranscriptDocumentBody,
        },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      404: NOT_FOUND,
      409: {
        notReady: simRefusalExample(
          'The transcript is still assembling',
          'TRANSCRIPT_NOT_READY',
          'The transcript is not available yet.',
          'TRANSCRIPT_NOT_READY',
        ),
      },
      422: BAD_PATH,
    },
  },
  createTranscriptRevision: {
    pathParams: ITEM,
    request: {
      one: {
        summary: 'Correct segment 1 (baseRevision 0)',
        value: {
          baseRevision: 0,
          changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fauzi.', to: 'Baik, saya Ahmad Fausi.' }],
          note: 'Koreksi nama jalan',
        } satisfies TranscriptRevisionRequest,
      },
    },
    responses: {
      201: {
        first: {
          summary: 'Revision 1 signed by the Core key',
          value: {
            revisionId: 'TRV-000001',
            number: 1,
            authorId: 'OPR-001',
            baseRevision: 0,
            machineTranscriptHash: 'b'.repeat(64),
            signedBy: 'KEY-EVSIGN-01',
            signature: { value: 'c'.repeat(128), keyId: 'KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false },
            createdAt: 1_790_824_500_000,
            changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fauzi.', to: 'Baik, saya Ahmad Fausi.' }],
          } satisfies TranscriptRevisionBody,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: deniedExamples('createTranscriptRevision', 'TRANSCRIPT_REVISE', 'TECHNICIAN'),
      404: NOT_FOUND,
      409: {
        conflict: simRefusalExample(
          'baseRevision 0 is no longer current',
          'TRANSCRIPT_REVISION_CONFLICT',
          'The transcript revision is based on a revision that is no longer current.',
          'TRANSCRIPT_REVISION_CONFLICT',
        ),
        notReady: simRefusalExample(
          'The transcript is still assembling',
          'TRANSCRIPT_NOT_READY',
          'The transcript is not available yet.',
          'TRANSCRIPT_NOT_READY',
        ),
      },
      422: { invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
  listTranscriptRevisions: {
    pathParams: ITEM,
    responses: {
      200: {
        newest: {
          summary: 'One revision on the last page',
          value: {
            items: [
              {
                revisionId: 'TRV-000001',
                number: 1,
                authorId: 'OPR-001',
                baseRevision: 0,
                machineTranscriptHash: 'b'.repeat(64),
                signedBy: 'KEY-EVSIGN-01',
                signature: { value: 'c'.repeat(128), keyId: 'KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false },
                createdAt: 1_790_824_500_000,
                changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fauzi.', to: 'Baik, saya Ahmad Fausi.' }],
              },
            ],
            nextCursor: null,
          } satisfies TranscriptRevisionPage,
        },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      404: NOT_FOUND,
      409: {
        notReady: simRefusalExample(
          'The transcript is still assembling',
          'TRANSCRIPT_NOT_READY',
          'The transcript is not available yet.',
          'TRANSCRIPT_NOT_READY',
        ),
      },
      422: { invalidQuery: ERROR_EXAMPLES.invalidQuery },
    },
  },
  getEvidenceExportJob: {
    pathParams: { id: 'EXPJ-000012' },
    responses: {
      200: {
        running: {
          summary: 'A composite job at half way; a FAILED job is this same 200 with status FAILED',
          value: {
            jobId: 'EXPJ-000012',
            evidenceId: STATE_EXAMPLE_IDS.evidenceId,
            kind: 'COMPOSITE',
            status: 'RUNNING',
            progressPct: 55,
            etaMs: 9_000,
            derived: true,
            createdAt: 1_790_824_500_000,
          } satisfies EvidenceExportJobBody,
        },
      },
      401: SIGNED_OUT,
      403: deniedExamples('getEvidenceExportJob', 'EVIDENCE_EXPORT', 'INVESTIGATOR'),
      404: { notFound: simRefusalExample('Unknown job ID', 'NOT_FOUND', 'No export job has this ID.', 'NOT_FOUND') },
      422: BAD_PATH,
    },
  },
  createEvidenceMediaSession: {
    pathParams: ITEM,
    responses: {
      201: {
        video01: {
          // The token is a PLACEHOLDER: a real signed URL is a bearer value and never an example
          // body (E-31); this one shows the shape and the loopback rule only.
          summary: 'Sixty seconds of loopback playback for VIDEO-01 (token placeholder)',
          value: {
            evidenceId: STATE_EXAMPLE_IDS.evidenceId,
            fileId: 'VIDEO-01',
            url: 'http://127.0.0.1:4420/media/mts_000000000000000000000000000000000000000000000',
            expiresAt: 1_790_825_000_000,
            ranges: true,
          } satisfies EvidenceMediaSessionBody,
        },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      404: NOT_FOUND,
      409: {
        unavailable: simRefusalExample(
          'No decrypted file exists',
          'MEDIA_NOT_AVAILABLE',
          'No playback media is available for this evidence item.',
          'MEDIA_NOT_AVAILABLE',
        ),
      },
      422: BAD_PATH,
    },
  },
};
