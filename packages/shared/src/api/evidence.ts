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
import { TrackId, VIDEO_TRACK_IDS } from '../domain/enums'; // VIDEO_TRACK_IDS: D60 (2026-11-04)
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
import { EvidenceItemSchema, type EvidenceTranscriptModel } from './state-slices';

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
    // Wave H C1 (gate finding G94-01): what a Core states beside the source. Both optional: Simulated mode states neither.
    // D60 (2026-11-04): the Core records four video tracks; a package sealed under two names two (the manifest's own list).
    fileIds: z
      .array(z.enum(VIDEO_TRACK_IDS))
      .min(1)
      .max(VIDEO_TRACK_IDS.length)
      .optional()
      .describe('Core server only, with LIVE_STREAM: the camera files the sealed package of the item really holds (one to four, D60 - a package sealed before the widening holds its own two), in file order - the `fileId` values operation 88 accepts for it.'),
    reason: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{0,63}$/)
      .optional()
      .describe(
        'Core server only, with NONE: why no media can be played, as a code. `NOT_SEALED` (the item was never sealed: an interrupted or unsealable recording), `NOT_A_SEALED_PACKAGE` (no sealed package of this item lies in the Core\'s store and no bundled demo package belongs to it), `DEMONSTRATION_RECORD` (fix wave J: the item is the record of a session of a Core in SIMULATED capture - a demonstration that recorded no media; a client says so and never "no sealed package in the evidence store"), or a code of the package itself: `PACKAGE_MISSING` (the folder is gone, e.g. quarantined), `MANIFEST_UNREADABLE`, `MANIFEST_NOT_OF_ITEM`, `CAMERA_FILE_MISSING`, `CAMERA_FILE_SIZE_MISMATCH`, `FRAGMENT_TABLE_INVALID`, `FRAGMENT_TOO_LARGE`, `SESSION_KEY_UNAVAILABLE`. An open set.',
      ),
  })
  .refine((ref) => (ref.source === EvidenceMediaSource.DEMO_PACKAGE) === (ref.packageSuffix !== null), {
    error: 'packageSuffix is set exactly when the source is DEMO_PACKAGE.',
    path: ['packageSuffix'],
  })
  .refine((ref) => ref.fileIds === undefined || ref.source === EvidenceMediaSource.LIVE_STREAM, { error: 'fileIds are stated only with LIVE_STREAM.', path: ['fileIds'] })
  .refine((ref) => ref.reason === undefined || ref.source === EvidenceMediaSource.NONE, { error: 'a reason is stated only with NONE.', path: ['reason'] })
  .describe(
    'Which media belongs to an evidence item. It names no file and no path: playback travels through the signed media session of operation 88 (E-31; the v1 MS-1 reading stays true for Simulated mode).',
  );
export type EvidenceMediaRef = z.output<typeof EvidenceMediaRefSchema>;

/** One finished export of an item, as operation 40 lists it (wave H C1; gate finding G94-05). */
export const EvidenceFinishedExportSchema = z
  .strictObject({
    exportId: z.string().regex(/^EXP-[0-9]{6}$/).describe('`EXP-NNNNNN` of operation 42.'),
    jobId: trimmedText(32).describe('`EXPJ-NNNNNN`: the `{id}` of operation 87, which answers a fresh signed download path for it.'),
    kind: z.enum(['PACKAGE', 'COMPOSITE']),
    completedAt: epochMs().describe('`export.exportedAt` of the signed export manifest.'),
    exportedBy: trimmedText(64).describe('The operator ID the signed export manifest names (`export.exportedBy`).'),
    archiveBytes: count().describe('The length of the archive file as it lies on the Core.'),
    archiveSha256: sha256Hex().optional().describe('SHA-256 of the archive file, when the Core has computed it in this run; operation 87 always answers it (`archive.sha256`).'),
  })
  .describe('One finished export of an evidence item: the archive lies in the Core\'s store.');
export type EvidenceFinishedExport = z.output<typeof EvidenceFinishedExportSchema>;

export const EvidenceDetailSchema = z
  .strictObject({
    evidence: EvidenceItemSchema,
    media: EvidenceMediaRefSchema,
    // Wave H C1 (gate notes G81-07, G94-06; finding G94-05). Optional: Simulated mode states neither.
    access: z
      .strictObject({
        play: z.boolean().describe('This caller may open a media session for the item (operation 88): false for REAL evidence the caller does not hold (SEC35-16). A client that reads false does not ask.'),
        readTranscript: z.boolean().describe('This caller is inside the case scope the transcript operations (84, 86) hold for the item.'),
        export: z.boolean().describe('This caller has EVIDENCE_EXPORT and is inside the case scope of the item (operations 42, 87 and the download).'),
      })
      .optional()
      .describe('Core server only: what THIS caller may do with the item, so that a page view asks for nothing it would be refused (a refusal is an audited row).'),
    exports: z
      .array(EvidenceFinishedExportSchema)
      .max(100)
      .optional()
      .describe('Core server only, and only for a caller with `access.export`: the finished exports of the item whose archive lies in the Core\'s store, newest first. Each can be downloaded again through operation 87 by its `jobId`. Archives are kept until the package is removed; none is deleted by the product.'),
    // Fix wave K, driver S2 (re-gate 94 notes G94b-11, G94b-12): ONE default destination, the Core's, true to its mode.
    exportDestinationDefault: trimmedText(120)
      .optional()
      .describe(
        'Core server only: the destination text the Core records for an export request that names none - `Case file transfer` on a Core in its own capture, `Case file transfer (simulated)` on a Core in simulated capture. A client pre-selects the destination whose recorded text equals it, so that every client offers the same default.',
      ),
    // Fix wave J (truth rule 3d; findings JA2-03 / JW-03): which export outputs THIS Core can produce, stated before a request.
    exportKinds: z
      .array(
        z.strictObject({
          kind: z.enum(['PACKAGE', 'COMPOSITE']),
          available: z.boolean().describe('True: a request of this kind is accepted. False: it is refused (`409 COMMAND_UNSUPPORTED`) before any job.'),
          reason: z
            .string()
            .regex(/^[A-Z][A-Z0-9_]{2,63}$/)
            .optional()
            .describe('Present exactly when `available` is false: why, as a code - `COMPOSITE_ENCODER_NOT_SELECTED` (no encoder is selected in this build).'),
        }),
      )
      .max(2)
      .optional()
      .describe(
        'Core server only: the export outputs of operation 42 and whether this Core can produce each. A client offers a kind ENABLED only when its entry says `available: true`, and draws an unavailable kind disabled with its reason. Absent (Simulated mode, an older Core): only PACKAGE is offered.',
      ),
  })
  .describe('One evidence item and the reference to its media.');
export type EvidenceDetail = z.output<typeof EvidenceDetailSchema>;

// ── The verify-v2 report members of operation 41 (rows 85, 119, 141; D107(5), D113; `ev` §D, §D.1) ──
// The value sets are the verifier's (`@dems/shared/evidence-verify`, `evidence-package`), restated
// here so that this module does not load the package format; a test holds them equal.
export const VERIFY_REPORT_OVERALL = ['PASS', 'TAMPERED', 'CORRUPT', 'MISSING', 'UNREADABLE'] as const;
export const VERIFY_REPORT_FAILURE_CLASSES = ['TAMPERED', 'CORRUPT', 'MISSING', 'UNREADABLE'] as const;
export const VERIFY_REPORT_CHECK_STATUSES = ['PASS', 'FAIL', 'SKIPPED'] as const;
export const VERIFY_REPORT_SKIP_REASONS = ['BLOCKED', 'KEY_UNAVAILABLE', 'OUT_OF_SCOPE'] as const;
export const VERIFY_REPORT_TRANSCRIPT_STATES = ['READY', 'PARTIAL', 'PARTIAL_BACKEND_UNREACHABLE', 'DISABLED_BY_CONFIGURATION', 'UNAVAILABLE_AT_SEAL', 'NOT_TRUSTWORTHY', 'UNKNOWN'] as const;
export const VERIFY_REPORT_SOURCES_STATES = ['DEVELOPMENT', 'DECLARED_PRODUCTION', 'NOT_TRUSTWORTHY', 'UNKNOWN'] as const;
/** The manifest's three source classes (`ev` §B.12 fields 124, 125) - not the two-valued class of the device shapes. */
export const VERIFY_REPORT_SOURCE_CLASSES = ['PRODUCTION', 'LOCAL_DEVICE', 'FAKE'] as const;
/** The most the answer carries; the Core cuts a longer list and says how many there were. */
export const VERIFY_REPORT_MAX_CHECKS = 32;
export const VERIFY_REPORT_MAX_FINDINGS = 64;
export const VERIFY_REPORT_MAX_FRAGMENTS = 256;
export const VERIFY_REPORT_MAX_INTERVALS = 4096;

const verifyFailureClass = () => z.enum(VERIFY_REPORT_FAILURE_CLASSES);
const verifySourceClass = () => z.enum(VERIFY_REPORT_SOURCE_CLASSES);
// D60 (2026-11-04): the track domain widened to four. The enum is a SUPERSET, so a v2 package whose manifest names
// its own two-track list still parses and verifies unchanged - the verifier reads that list as a prefix of the order.
const cameraTrackId = () => z.enum(VIDEO_TRACK_IDS);

const VerifyFindingSchema = z.strictObject({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/).describe('What was found, e.g. `FRAGMENT_TAMPERED`, `SOURCE_CLASS_MISSING`.'),
  failureClass: verifyFailureClass(),
  trackId: trimmedText(64).optional(),
  seq: count().optional().describe('The fragment the finding names.'),
  file: trimmedText(256).optional().describe('A path inside the package, `/` separated; never a host path.'),
  member: trimmedText(256).optional().describe('A dotted member path of the manifest.'),
  revisionNo: count().optional(),
});

const VerifyCheckSchema = z.strictObject({
  id: z.string().regex(/^V-[0-9]{2}$/).describe('`V-01` to `V-15` (`ev` §D).'),
  name: trimmedText(64),
  status: z.enum(VERIFY_REPORT_CHECK_STATUSES).describe('SKIPPED is never a pass.'),
  failureClass: verifyFailureClass().nullable().describe('The class of the first finding; null unless the status is FAIL.'),
  skipped: z.enum(VERIFY_REPORT_SKIP_REASONS).nullable(),
  findings: z.array(VerifyFindingSchema).max(VERIFY_REPORT_MAX_FINDINGS).describe('WHERE the check found something: names, never a value of the package.'),
  findingCount: count().optional().describe('How many findings the check has when `findings` was cut; absent when it lists them all.'),
});

const VerifyFragmentSchema = z.strictObject({
  trackId: cameraTrackId(),
  seq: count(),
  ok: z.literal(false),
  reason: verifyFailureClass(),
  storedOk: z.boolean().describe('The stored bytes of the fragment hash to the sealed value (V-04).'),
  plainOk: z.boolean().nullable().describe('The decrypted fragment hashes to the sealed value (V-05); null: not checked.'),
});

const VerifyTranscriptStateSchema = z.strictObject({
  code: z.enum(VERIFY_REPORT_TRANSCRIPT_STATES),
  report: trimmedText(160).describe('The English report line of the state; a client words the state by `code`.'),
  sealedState: z.enum(['ASSEMBLED', 'PARTIAL', 'DISABLED']).nullable(),
  reason: z.enum(['DISABLED_BY_CONFIGURATION', 'TRANSCRIPT_UNAVAILABLE_AT_SEAL']).nullable(),
  documentSealed: z.boolean().nullable(),
  failedChunks: count().nullable(),
  backendUnreachable: z.boolean().nullable(),
});

const VerifySourcesSchema = z.strictObject({
  ok: z.boolean().describe('V-15 passed: the mark is present, well-formed and consistent. It says nothing of the value of the mark.'),
  code: z
    .enum(VERIFY_REPORT_SOURCES_STATES)
    .describe(
      'DEVELOPMENT: at least one source is LOCAL_DEVICE or FAKE (not a failure). DECLARED_PRODUCTION: every source reads PRODUCTION - a statement of the Core that sealed the package, not a fact the verifier proved. NOT_TRUSTWORTHY: the manifest is not the signed one or its mark is missing or inconsistent; no class is stated. UNKNOWN: no readable v2 manifest.',
    ),
  development: z
    .boolean()
    .nullable()
    .describe('Recomputed by the verifier from the classes. null exactly when `code` is NOT_TRUSTWORTHY or UNKNOWN: nothing is stated, and null is never read as production.'),
  report: trimmedText(160).describe('The English source line, the first line of a verify report; a client words the state by `code`.'),
  tracks: z
    .array(z.strictObject({ trackId: cameraTrackId(), deviceId: trimmedText(64), sourceClass: verifySourceClass() }))
    // D60 (2026-11-04): a package holds the manifest's OWN track list - up to four lines now, and a legacy
    // two-track manifest still answers its two (the list is read as a prefix of VIDEO_TRACK_IDS).
    .max(VIDEO_TRACK_IDS.length)
    .describe('Manifest field 124 of each camera file the manifest names (one to four, D60); empty when nothing is stated.'),
  audioIntervals: z
    .array(z.strictObject({ seq: count(), micDeviceId: trimmedText(64), sourceClass: verifySourceClass() }))
    .max(VERIFY_REPORT_MAX_INTERVALS)
    .describe('Manifest field 125 of each interval of the session audio track; empty when nothing is stated.'),
});

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
          trackId: cameraTrackId(), // D60 (2026-11-04): the four-track domain; a two-file legacy package answers its own two lines
          storedOk: z.boolean().describe('Hash of the stored bytes matches the sealed value.'),
          plainOk: z.boolean().describe('Hash of the plaintext bytes matches the sealed value.'),
          plainChecked: z
            .boolean()
            .optional()
            .describe('Present and false when the plaintext check (V-05) did not run for this file: `plainOk: false` is then "not checked", not a failed comparison. Absent: `plainOk` is the result of the check.'),
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
    // Fix wave J (finding JA2-02): the verdict of the simulator says that it is one.
    demonstration: z
      .literal(true)
      .optional()
      .describe(
        'Present and true on every verdict the SIMULATOR computed (a `SIMULATED` item, a v1 `DEMO_PACKAGE` item): the hashes of a demonstration record were compared and no stored media was read. A client words such a verdict as a demonstration, never as a bare "verified by the Core". Absent on the verdict of a real sealed package.',
      ),
    // The verify-v2 report (rows 85, 119, 141). Every member is optional: a v1 answer carries none.
    overall: z.enum(VERIFY_REPORT_OVERALL).optional().describe('Schema v2: PASS, or the gravest failure class among the findings.'),
    interrupted: z.boolean().optional().describe('Schema v2: the package is the sealed durable prefix of an interrupted recording (V-12). A state, not a failure.'),
    checks: z
      .array(VerifyCheckSchema)
      .max(VERIFY_REPORT_MAX_CHECKS)
      .optional()
      .describe('Schema v2: the per-check report, V-01 to V-15 in order, so that a client can name the check that failed.'),
    fragments: z
      .array(VerifyFragmentSchema)
      .max(VERIFY_REPORT_MAX_FRAGMENTS)
      .optional()
      .describe('Schema v2: the fragments that did not verify, over both camera files (V-08 names the fragment). Fragments that verified are counted in `files`, not listed.'),
    failedFragmentCount: count().optional().describe('Schema v2: how many fragments did not verify; larger than `fragments.length` when the list was cut.'),
    transcriptState: VerifyTranscriptStateSchema.optional().describe('Schema v2: what the verified package says of its transcript (seven codes; D110).'),
    transcriptModel: z
      .strictObject({
        name: trimmedText(256).describe('The model name the sealed manifest records.'),
        version: trimmedText(256).nullable().describe('The version the installation declared; null for a server backend.'),
        quantisation: trimmedText(256).nullable().describe('The quantisation read from the model file; null for a server backend.'),
        modelSha256: sha256Hex().nullable().describe('SHA-256 of the model file as the Core hashed it; null for a server backend.'),
        reportedByServer: z.boolean().describe('True when the session\'s STT backend was a server: the name is what the server reported, and the Core verified nothing of the model.'),
        report: trimmedText(256).describe('The report line of the model.'),
      })
      .optional()
      .describe(
        'Schema v2 (decision D160): the model of the sealed transcript, from the signed manifest. For a server backend only the name exists, as reported by the STT server; version, quantisation and file hash are null and were not verified by the Core. Absent when no transcript document is sealed, for a v1 item, and when the manifest is not the signed one.',
      ),
    sources: VerifySourcesSchema.optional().describe(
      'Schema v2 (V-15; R-11): the source class of every recorded source. A development package verifies with `ok: true` at the top level and `sources.code: DEVELOPMENT`; the value of the mark never changes the verdict. Absent for a v1 item: its source class is not recorded, which is never read as production.',
    ),
    signature: z
      .strictObject({
        developmentKey: z
          .boolean()
          .nullable()
          .describe(
            'True when the subject of the certificate that VERIFIED the signature carries the development-key mark (`OU=DEVELOPMENT KEY - NOT FOR PRODUCTION`); false when it does not. `null`: NOT ESTABLISHED - the manifest, the signature or the certificate did not verify (never `false` from an unverified package). A client shows "Signed with a DEVELOPMENT key - not a production signature" for true and "not established" for null.',
          ),
      })
      .optional()
      .describe(
        'Schema v2 (decisions D147, D178): what the verified package says of its signing KEY. A fact about the key, never the verdict: `signatureOk` passes or fails on its own merits. `developmentKey` is nullable: `null` means NOT ESTABLISHED (the package did not verify), never "not a development key". Absent for a v1 item.',
      ),
    notices: z
      .array(
        z.strictObject({
          code: z
            .string()
            .regex(/^[A-Z][A-Z0-9_]{2,63}$/)
            .describe(
              '`AUDIT_EXTRACT_NOT_SIGNED` (every v2 result): `audit-session-extract.jsonl` is in the package and its content is covered by no hash and no signature. `EXPORT_FOLDER_UNEXPECTED_FILE` (only when there is such a file): the `export/` folder of the package holds a file that is no finished export - a `.partial` a stopped export left, a name no export writes, or anything in a sub-folder; the sealed set is not affected. `REVISION_APPEND_PENDING` (only while there is such a file): a transcript revision is being written - `transcript/transcript-revisions.json.next` lies in the package; it fails nothing; verify again shortly. `SIGNED_BY_COMPROMISED_KEY` (only for a package under such a key): the manifest or a transcript revision is signed by a key that was later MARKED COMPROMISED, so the signature alone proves nothing any more. **This notice is not "fails nothing"**: it stands beside a verdict that took the mark into account and its `report` says which - the answer is a pass ONLY when the package is the one this Core recorded when it sealed the item (its manifest digest and the head of its revisions equal what the Core stored), and a failure otherwise. An answer with this code is never a plain pass: a client shows it as a state of the signing key, not among what the signature does not cover. `HOST_PROFILE_NOT_ASKED` (only for a package whose manifest carries the member `hostProfileNotAsked`): the package was sealed by a production Core on a platform where the checks of the host profile are not run; it fails nothing and changes no verdict. `VIDEO_ABSENT_IN_SESSION` (only for a package whose manifest carries the member `absentInSession` on a track): a camera stopped delivering pictures inside the session; the line states per track how often, the two measured bounds of the time in ms, and whether the last absence ended; it fails nothing and changes no verdict. `AUDIO_ABSENT_ON_RESTART` (only for a package whose manifest carries the member `audio.absentOnRestart`): the capture was restarted inside the session and no sound was recorded across the restart; the line states how often and the two measured bounds of the time in ms; it fails nothing and changes no verdict. `AUDIO_SAMPLES_NOT_RECEIVED` (only for a package whose manifest carries the member `audio.samplesNotReceived`): the audio was captured on a path that does not deliver every sample (bench capture path of a Mac); the line states, in whole samples of the highest capture attempt, how many samples of the track arrived, how many are silence the recorder inserted, and the runs of 100 ms or more (listed, not listed, the longest) - or that the amount was measured up to a sample only, or not measured; sound that did not arrive is not in the recording, and the places of the inserted silence are not the places of the missing sound; it fails nothing and changes no verdict - a package can be untouched and its audio incomplete. `AUDIO_ONE_CAPTURE_GROUP` (only beside the previous one, when two of its records state the same capture group): PRIMARY and STANDBY were channels of one device recorded by one capture program, so a switch between them was not a switch to an independent source; it fails nothing and changes no verdict.',
            ),
          report: trimmedText(256).describe('The report line of the notice.'),
        }),
      )
      .max(9)
      .optional()
      .describe('Schema v2 (decision D178): what the package format does NOT cover. Named statements that fail nothing; a client shows each one and never collapses it. Absent for a v1 item.'),
  })
  .describe('The verdict of record of an integrity verification (schema v2: per-file chains, transcript hash, real signature).');
export type EvidenceVerifyResultBody = z.output<typeof EvidenceVerifyResultSchema>;

// ── Operations 84-88: transcript, revisions, export job, media session ────────────────────────
// (task 3 M2-W7, blueprint row 48; register SH-14; C3 §2.2/§2.3/§2.4; OD-15/OD-16; NM-06/NM-11/NM-12)

// Task 4 row N2 (design 06 revision 3, section 8.6; decisions C110 (2), C112 (1), (2)): the two
// OPTIONAL members a transcript of a session whose audio is not sample-continuous carries in this
// answer - the statement at its head and the mark on a segment. Absent for every other transcript,
// so the answer of every other item is the answer of before. The sealed document `dems.transcript/1`
// gains no member: these two are made when the answer is made. The bounds are the manifest's
// (`@dems/shared/evidence-package`), restated here and held equal by a test.
/** One day at 48,000 Hz: the largest sample count the statement can hold (the manifest's `MANIFEST_AUDIO_DAY_SAMPLES`). */
export const TRANSCRIPT_AUDIO_DAY_SAMPLES = 4_147_200_000;
/** The most runs a manifest lists per capture attempt (the manifest's `MANIFEST_AUDIO_INSERTED_RUNS_MAX`). */
export const TRANSCRIPT_LISTED_RUNS_MAX = 1_024;
/** The longest inserted silence a segment can be marked with (ms): one day. */
export const TRANSCRIPT_INSERTED_SILENCE_MAX_MS = 86_400_000;
const samplesOfADay = () => z.int().min(0).max(TRANSCRIPT_AUDIO_DAY_SAMPLES);

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
    insertedSilenceMs: z
      .int()
      .min(1)
      .max(TRANSCRIPT_INSERTED_SILENCE_MAX_MS)
      .optional()
      .describe(
        'THE MARK ON THE SEGMENT (Core server only; task 4 row N2): this many whole milliseconds of the segment (`startMs` to `endMs`) are SILENCE THE RECORDER INSERTED, in runs of 100 ms or more that the signed manifest of the item lists with their positions (`audio.samplesNotReceived[].insertedRuns`). No audio arrived from the microphone in that time; the text of the segment is the engine\'s and is not cut - the segment is marked, not split. A client shows the mark at the segment and never joins two segments into one line or paragraph across a listed run. ABSENT: no listed run overlaps the segment - never to be read as "this segment holds every word that was spoken".',
      ),
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
    audioNotSampleContinuous: z
      .strictObject({
        arrivedSamples: samplesOfADay().nullable().describe('Samples of the track that arrived (`trackSamples` less `insertedSamples`); null when the amount was not measured.'),
        trackSamples: samplesOfADay().nullable().describe('Samples the session\'s own clock expected up to the recorder\'s last account: the length of the track when that account closed it. null when the amount was not measured.'),
        insertedSamples: samplesOfADay().nullable().describe('Samples of the track that are silence the recorder inserted, not sound; null when the amount was not measured.'),
        listedRuns: z.int().min(0).max(TRANSCRIPT_LISTED_RUNS_MAX).describe('Runs of inserted silence of 100 ms or more that the signed manifest lists with their positions; the segments they overlap carry `insertedSilenceMs`.'),
        runsNotListed: count().describe('Runs of 100 ms or more that the manifest counts and does NOT list: they have no position and mark no segment.'),
      })
      .optional()
      .describe(
        'THE STATEMENT AT THE HEAD OF THE TRANSCRIPT (Core server only; task 4 row N2; decisions U25 (3), C110 (2)): the audio this text was made from is NOT SAMPLE-CONTINUOUS - it was captured on a path that does not deliver every sample (bench capture path of a Mac). Sound that did not arrive is not in the recording. Silence of the same total length was inserted by the recorder; its places are not the places of the missing sound. The numbers are whole samples of the highest capture attempt, the ones of the verify notice `AUDIO_SAMPLES_NOT_RECEIVED`, read from the SIGNED manifest of the item. A client shows this statement with its numbers at the head of the transcript and never collapses it; a transcript of such audio does not hold every word that was spoken. ABSENT: the manifest of the item states no measured shortfall - never to be read as "the audio is complete".',
      ),
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
          from: apiText().describe(
            'The text being replaced. It MUST be the CURRENT text of the segment: the `to` of the newest revision that changed the segment, else the sealed text. Anything else answers `422 INVALID_INPUT` with `details.reason: REVISION_FROM_NOT_CURRENT_TEXT`; nothing is signed and nothing is appended (ruling D221 (2)).',
          ),
          to: apiText().describe('The corrected text.'),
        }),
      )
      .min(1)
      .describe('The corrections, applied in order.'),
    note: boundedText(500, 5).describe(
      'REQUIRED (pass D6): why the revision was made, 5 to 500 characters after trimming. It is stored as the revision\'s `reason` (dbc-3 §B.9: NOT NULL, 5..500), is inside the signed revision body, and travels to the audit row as `reason`. A revision of evidence without a stated reason is refused: 422 INVALID_INPUT.',
    ),
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
    reason: apiText()
      .optional()
      .describe('Why the revision was made: the note its author gave, as stored and as signed with the revision (op 85 `note`). Absent only where the stored revision holds none. Never a default.'),
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
    jobId: trimmedText(32).describe('`EXPJ-NNNNNN`: `EXPJ-` and the six digits of the export ID of operation 42 (`EXP-000012` -> `EXPJ-000012`).'),
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
    archive: z
      .strictObject({ bytes: count(), sha256: sha256Hex() })
      .optional()
      .describe('Core server only, on a COMPLETE job whose archive lies in the Core\'s store (wave H C1; ruling D200): the length and SHA-256 of the archive FILE. The archive carries its export manifest and signature inside and therefore cannot contain its own hash: this answer and the download\'s audit row are where it is stated. `npm run evidence:verify-export -- <archive> --sha256 <this value>` holds a received file to it.'),
    failureReason: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional()
      .describe(
        'SCREAMING_SNAKE cause when FAILED; the EVIDENCE_EXPORT_FAILED row carries the same code. An open set of codes. Among them: `COMPOSITE_ENCODER_NOT_SELECTED` (a COMPOSITE was asked for and no encoder is selected), `EXPORT_INTERRUPTED` (the server stopped while the job ran; the job is not resumed - ask again), `SESSION_KEY_UNAVAILABLE`, `SOURCE_VERIFY_FAILED`, `SOURCE_SIGNED_BY_COMPROMISED_KEY` (the package rests on a signing key marked compromised and is not the one the Core recorded at the seal; a package under such a key that IS the one of record is exported, and its export manifest states the mark in `sourceSigningKey`), `PLAINTEXT_HASH_MISMATCH`, `EXPORT_WRITE_FAILED`, `EXPORT_FAILED`.',
      ),
    download: z
      .strictObject({
        path: z
          .string()
          .regex(/^\/exports\/exs_[A-Za-z0-9_-]{60,96}$/)
          .describe('Same-origin path of the registry-external `GET /exports/<token>`. A BEARER value: never logged, never audited, never stored, never a cache key.'),
        expiresAt: epochMs().describe('Core instant the path dies (`EVIDENCE_MEDIA_SESSION_TTL_MS` after this answer). Poll again for a fresh one.'),
      })
      .optional()
      .describe(
        'Core server only, and only on a COMPLETE job of an item whose sealed package lies in the Core\'s store: a short-lived signed path that serves the finished archive as an attachment (ruling D178). Bound to the caller\'s operator and sign-in session and to this export; the request needs EVIDENCE_EXPORT and, for REAL evidence, the case scope of SEC35-16. Each download is audited. Absent in Simulated mode and for a simulated export.',
      ),
  })
  .describe('The background export job of op 42/87 (NM-12; OD-16).');
export type EvidenceExportJobBody = z.output<typeof EvidenceExportJobSchema>;

/**
 * Optional request body of op 88 (ruling D140; the server of row 90): which camera file the session
 * plays. No body, or `{}`, is `VIDEO-01`. Strict: any other member or value is `422 INVALID_INPUT`.
 * One session plays one file, so two synchronised players ask twice.
 */
export const EvidenceMediaSessionRequestSchema = z
  .strictObject({
    fileId: z.enum(VIDEO_TRACK_IDS).optional().describe('The camera file to play (D60: one of the four tracks; a legacy package offers its own two); absent: `VIDEO-01`.'), // D60 (2026-11-04)
    seekIndex: z
      .literal(true)
      .optional()
      .describe(
        'Fix wave K Z1 (ruling D224 (1)): asks for the INDEXED VIEW of the file - the same decrypted bytes plus ONE segment index (`sidx`) built from the signed manifest fragment table, for a player that cannot seek a fragmented file without one. Absent: the stream as before. The answer states whether the session serves it.',
      ),
  })
  .describe('Optional request body of `POST /api/v1/evidence/{id}/media-sessions` (op 88): the camera file of the session.');
export type EvidenceMediaSessionRequest = z.output<typeof EvidenceMediaSessionRequestSchema>;

/**
 * Success of op 88: the short-lived signed media session (NM-11; SEC35-12/13). The URL is a BEARER
 * value: bound to `(operatorId, sessionId, evidenceId, fileId)`, HMAC-signed with the separate
 * media-session key, TTL `EVIDENCE_MEDIA_SESSION_TTL_MS`, prefix `mts_` — and it never enters a
 * log or an audit row (E-31). Loopback only (N-4): the pattern below enforces it on the wire.
 */
export const EvidenceMediaSessionSchema = z
  .strictObject({
    evidenceId: evidenceId(),
    fileId: z.enum(VIDEO_TRACK_IDS).describe('Which camera file this session plays (D60, 2026-11-04: the package\'s own list, up to four).'), // D60
    url: z
      .string()
      .regex(/^http:\/\/127\.0\.0\.1(?::\d{1,5})?\//)
      .describe('Signed loopback URL with the mts_ token (SEC35-13). Bearer value: never logged, never audited, never replicated (E-31).'),
    expiresAt: epochMs().describe('Core instant the URL dies; the replay window is exactly this TTL (SEC35-12).'),
    ranges: z.literal(true).describe('The route answers Range requests (NM-11 playback).'),
    seekIndex: z
      .literal(true)
      .optional()
      .describe(
        'Fix wave K Z1 (ruling D224 (1)): present, always `true`, exactly when the URL of THIS session serves the INDEXED VIEW of the file (the request asked `seekIndex: true` and the signed fragment table yields an exact index): the same decrypted bytes plus one segment index between the init segment and the first fragment; lengths and Range offsets of the URL are those of the view. Absent: the stream as sealed - a player that needs an index cannot seek it. Nothing of the sealed package, the export or Verify differs.',
      ),
  })
  .describe('A short-lived signed evidence-media session (op 88; live-only — Simulated mode plays the bundled demo media instead).');
export type EvidenceMediaSessionBody = z.output<typeof EvidenceMediaSessionSchema>;

/**
 * Fix wave K Z1 (ruling D224 (1); `delegation_progress/contract_wave_k.md` "Z1"): the answer of op 88
 * for a session of the INDEXED VIEW. A consumer test imports it and reads `seekIndex` BY NAME. The
 * token is a PLACEHOLDER (a real signed URL is a bearer value and never an example; E-31).
 */
export const EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE = {
  evidenceId: 'EV-20260930-0001',
  fileId: 'VIDEO-01',
  url: 'http://127.0.0.1:4420/media/mts_000000000000000000000000000000000000000000000',
  expiresAt: 1_790_825_000_000,
  ranges: true,
  seekIndex: true,
} as const satisfies EvidenceMediaSessionBody;
/** The body that asks for it. */
export const EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE = { fileId: 'VIDEO-01', seekIndex: true } as const satisfies EvidenceMediaSessionRequest;

/** The schemas operations 84-88 add (merged into `CORE_API_SCHEMAS`). */
export const TRANSCRIPT_MEDIA_SCHEMAS = {
  TranscriptSegment: TranscriptSegmentSchema,
  TranscriptDocument: TranscriptDocumentSchema,
  TranscriptRevisionRequest: TranscriptRevisionRequestSchema,
  TranscriptRevision: TranscriptRevisionSchema,
  TranscriptRevisionPage: TranscriptRevisionPageSchema,
  EvidenceExportJob: EvidenceExportJobSchema,
  EvidenceMediaSessionRequest: EvidenceMediaSessionRequestSchema,
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
      'Writes EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED, by the verdict, and adds a custody entry. The files, the hashes, the manifest hash and the signature are not changed (I11). A verdict formed under a signing key marked compromised is recorded as such: the row carries `details.notice: SIGNED_BY_COMPROMISED_KEY` (a pass is then a WARNING row and its custody entry says that it passed as the digest recorded at the seal) - never as a plain pass.',
      'An item that was never sealed (`sealedAt: null`, status RECORDED: the record of an interrupted session) is refused `409 NOT_SEALED`: it has no track hash, no manifest and no signature. A verdict the simulator computed over a demonstration record carries `demonstration: true`.',
      hostedNote('verify'),
    ].join('\n\n'),
    source: backendSource(SECTION, 41),
    pathParam: EVIDENCE_PARAM,
    responses: {
      200: { description: 'The verdict, passed or failed.', schema: 'EvidenceVerifyResult' },
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      404: UNKNOWN_EVIDENCE,
      // Fix wave J (truth rule 3a): a never-sealed item has nothing a verification could compare. No verdict, no row, no custody entry.
      409: { description: 'The item is RECORDED: it was never sealed, so there is nothing sealed to verify (NOT_SEALED). Nothing is written.', schema: 'ApiError' },
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
      'Needs EVIDENCE_VIEW (every role). REAL evidence is case-scoped (SEC35-16; review finding R93-02): a caller who neither holds the case (the session\'s investigator) nor is a SUPERVISOR is refused `403 NOT_PERMITTED` with `details.reason: EVIDENCE_CASE_SCOPE`, with one ACCESS_DENIED row, before anything of the item is read. Evidence that is not REAL has no such scope.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 84; register SH-14/NM-06 (not in the design book)',
    pathParam: EVIDENCE_PARAM,
    responses: {
      200: { description: 'The transcript document.', schema: 'TranscriptDocument' },
      401: NOT_SIGNED_IN,
      // RECON-A (row 51a §5 B2b): every seeded role holds EVIDENCE_VIEW, so no role is refused this
      // read by its permission; the 403 is the Origin / revoked-device guard and, for REAL evidence,
      // the case scope (closing pass F-X) - all three only the Core server sends (01_specs §7.19).
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
      'REAL evidence is case-scoped (SEC35-16; review finding R93-02): a caller who neither holds the case (the session\'s investigator) nor is a SUPERVISOR is refused `403 NOT_PERMITTED` with `details.reason: EVIDENCE_CASE_SCOPE`, with one ACCESS_DENIED row, before anything of the item is read. Evidence that is not REAL has no such scope.',
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
      'Needs EVIDENCE_VIEW (every role). REAL evidence is case-scoped (SEC35-16; review finding R93-02): a caller who neither holds the case (the session\'s investigator) nor is a SUPERVISOR is refused `403 NOT_PERMITTED` with `details.reason: EVIDENCE_CASE_SCOPE`, with one ACCESS_DENIED row, before anything of the item is read. Evidence that is not REAL has no such scope.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 86; register SH-02/SH-14/NM-06 (not in the design book)',
    pathParam: EVIDENCE_PARAM,
    query: { schema: 'PageQuery' },
    responses: {
      200: { description: 'One page of revisions.', schema: 'TranscriptRevisionPage' },
      401: NOT_SIGNED_IN,
      // RECON-A (row 51a §5 B2b): every seeded role holds EVIDENCE_VIEW, so no role is refused this
      // read by its permission; the 403 is the Origin / revoked-device guard and, for REAL evidence,
      // the case scope (closing pass F-X) - all three only the Core server sends (01_specs §7.19).
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
      'Needs EVIDENCE_EXPORT (SUPERVISOR), like the export request. REAL evidence is case-scoped (SEC35-16; review finding R93-02): a caller who neither holds the case (the session\'s investigator) nor is a SUPERVISOR is refused `403 NOT_PERMITTED` with `details.reason: EVIDENCE_CASE_SCOPE`, with one ACCESS_DENIED row, before anything of the item is read. Evidence that is not REAL has no such scope. The same rule holds on the export request (operation 42) and on the signed download `GET /exports/{token}`.',
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
      'Request (ruling D140; widened by D60, 2026-11-04): an OPTIONAL body `{ fileId: VIDEO-01 | VIDEO-02 | VIDEO-03 | VIDEO-04 }`; no body or `{}` plays `VIDEO-01` (a legacy two-track package accepts only its own two files). Refusals of this operation: `403 NOT_PERMITTED` with `details.reason: EVIDENCE_CASE_SCOPE` (REAL evidence of a case the caller does not hold; one ACCESS_DENIED row); `409 MEDIA_NOT_AVAILABLE`, for a package that cannot be played with `details.reason` one of `NOT_A_SEALED_PACKAGE`, `PACKAGE_MISSING`, `MANIFEST_UNREADABLE`, `MANIFEST_NOT_OF_ITEM`, `CAMERA_FILE_MISSING`, `CAMERA_FILE_SIZE_MISMATCH`, `FRAGMENT_TABLE_INVALID`, `FRAGMENT_TOO_LARGE`, `SESSION_KEY_UNAVAILABLE`, `FRAGMENT_NOT_AUTHENTIC`; `503 NOT_READY` (`details.reason: CREDENTIAL_STORE_NOT_READY`) at envelope level. The media route itself (registry-external, `GET /media/{token}`) refuses with `403 NOT_PERMITTED` and `details.reason: MEDIA_SESSION_INVALID` (not a token of this Core, an altered one, or one bound to another operator or session; one ACCESS_DENIED row) or `MEDIA_SESSION_EXPIRED` (an authentic token past its lifetime; no row - ask operation 88 again).',
      'Writes EVIDENCE_MEDIA_SERVED: fileId, bytesServed, the optional range markers, signed, expiresAt — never the URL and never a byte of media (`C3 §5.2`). For REAL evidence the caller must additionally own the case/session or be a SUPERVISOR once SEC35-16 is confirmed (provisional; M8).',
      CORE_SERVER_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M2-W7; C3 §2.2 operation 88; register NM-11/WB-04/MB-07/E-31 (not in the design book)',
    pathParam: EVIDENCE_PARAM,
    requestBody: { schema: 'EvidenceMediaSessionRequest', required: false },
    responses: {
      201: { description: 'The signed media session.', schema: 'EvidenceMediaSession' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: VIEW_REFUSED,
      404: UNKNOWN_EVIDENCE,
      409: { description: 'No playback media is available for this evidence item (MEDIA_NOT_AVAILABLE); `details.reason` says why a sealed package cannot be played.', schema: 'ApiError' },
      422: INVALID_INPUT,
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
  // Fix wave J (JA2-02): the simulator's verdict over a demonstration record says that it is one.
  demonstration: true,
};

/**
 * The verdict of the Core for a schema-v2 item recorded in development mode (D74(2)): this Mac's
 * camera and microphone in slot 1, the test sources in slot 2, one microphone switch. It PASSES:
 * the source class is reported, never judged (`ev` §D.1). No simulator item answers this shape
 * yet (the demo dataset is v1 until SH-24 regenerates it).
 */
const VERIFY_PASSED_DEVELOPMENT: EvidenceVerifyResultBody = {
  evidenceId: 'EV-20261009-0001',
  ok: true,
  at: 1_791_500_000_000,
  tracks: [],
  files: (['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => ({ fileId: `fragments/${trackId}.mp4`, trackId, storedOk: true, plainOk: true, chainOk: true, fragmentCount: 5, ok: true })),
  transcriptOk: true,
  manifestOk: true,
  signatureOk: true,
  overall: 'PASS',
  interrupted: false,
  checks: [
    'Manifest structure',
    'Manifest internal consistency',
    'Manifest hash',
    'Per-fragment stored-bytes hash',
    'Plaintext hash after decryption',
    'Chain-hash continuity',
    'Sequence contiguity',
    'One-fragment tamper expectation',
    'Signature verification',
    'Transcript hash match',
    'Revision signatures',
    'Interrupted-seal flag',
    'Certificate validity',
    'File completeness',
    'Source class',
  ].map((name, index) => ({ id: `V-${String(index + 1).padStart(2, '0')}`, name, status: 'PASS' as const, failureClass: null, skipped: null, findings: [] })),
  fragments: [],
  failedFragmentCount: 0,
  transcriptState: { code: 'READY', report: 'Transcript sealed', sealedState: 'ASSEMBLED', reason: null, documentSealed: true, failedChunks: 0, backendUnreachable: false },
  sources: {
    ok: true,
    code: 'DEVELOPMENT',
    development: true,
    report: 'DEVELOPMENT SOURCES \u2014 this package was not recorded from production devices.',
    tracks: [
      { trackId: 'VIDEO-01', deviceId: 'CAM-03', sourceClass: 'LOCAL_DEVICE' },
      { trackId: 'VIDEO-02', deviceId: 'CAM-02', sourceClass: 'FAKE' },
    ],
    audioIntervals: [
      { seq: 1, micDeviceId: 'MIC-03', sourceClass: 'LOCAL_DEVICE' },
      { seq: 2, micDeviceId: 'MIC-02', sourceClass: 'FAKE' },
    ],
  },
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
  demonstration: true,
};

/**
 * FIX WAVE J, driver J-S (truth rule 3a; findings JA2-01 / JW-01): THE ITEM OF A RECORDING THAT WAS
 * NEVER SEALED, as operations 39 and 40 and the slice `evidence` carry it on every lane. `sealedAt`
 * is null: that is the fact (`hasSealedValues` of `@dems/shared/sim` reads it). It has NO track, the
 * two required members hold the null digest (64 zeros, the digest of nothing) and a placeholder
 * signature, and its verification is NOT_RUN. A client shows none of them and offers no Verify.
 */
export const EVIDENCE_NOT_SEALED_DIGEST_EXAMPLE = '0'.repeat(64);
export const EVIDENCE_NOT_SEALED_ITEM_EXAMPLE = {
  ...EXAMPLE_EVIDENCE_ITEM,
  id: STATE_EXAMPLE_IDS.recordedEvidenceId,
  sessionId: 'SES-20260930-0016',
  caseNumber: 'LP/2026/0930-0006',
  subjectName: 'Hendra Wijaya',
  sealedAt: null,
  status: 'RECORDED',
  lifecycleStage: 'RECORDING',
  tracks: [],
  manifestHash: EVIDENCE_NOT_SEALED_DIGEST_EXAMPLE,
  signature: { value: EVIDENCE_NOT_SEALED_DIGEST_EXAMPLE, keyId: 'NOT-SEALED', algorithm: 'SIMULATED-SHA256', simulated: true },
  custody: [
    { at: 1_790_758_800_000, action: 'RECORDING_STARTED', actorId: 'OPR-001', detail: null },
    { at: 1_790_760_240_000, action: 'SESSION_INCOMPLETE', actorId: null, detail: 'POWER_FAIL; recovered' },
  ],
  verification: { status: 'NOT_RUN', at: null },
  tampered: false,
  tamperedTrackId: null,
  integritySource: 'SIMULATED',
} satisfies EvidenceDetail['evidence'];

/**
 * FIX WAVE J, ROUND TWO (findings JT-11 / JW-13 / JA2-08): what the operator added to a session, as the
 * item carries it after the seal - the members `markers` and `notes` of `EvidenceItem` (operations 39 and
 * 40, slice `evidence`). They exist since schema v1 and are written when the item is made, from the
 * session the Core held: every marker of the recording, every note written during it, and - new - the
 * session form's "Notes" as the first note (`origin: 'SESSION_FORM'`). A snapshot is a mark on the
 * session's timeline and an audit row; no picture exists and the item carries none.
 */
export const EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE = {
  markers: [{ id: 'TL-000412', at: 1_790_819_160_000, index: 1, label: 'Key statement' }],
  notes: [
    { id: 'NOTE-FORM', at: 1_790_819_040_000, authorId: 'OPR-001', text: 'Second interview; counsel present.', origin: 'SESSION_FORM' },
    { id: 'NOTE-000413', at: 1_790_819_220_000, authorId: 'OPR-001', text: 'Subject asked for a break.' },
  ],
} as const satisfies Pick<EvidenceDetail['evidence'], 'markers' | 'notes'>;

/**
 * FIX WAVE J (finding JA2-02): the media reference of an item a Core in SIMULATED capture sealed
 * itself - a demonstration record without media. `reason` is the new value of the open code set.
 */
export const EVIDENCE_MEDIA_DEMONSTRATION_RECORD_REASON = 'DEMONSTRATION_RECORD';
export const EVIDENCE_MEDIA_DEMONSTRATION_RECORD_EXAMPLE = { source: 'NONE', packageSuffix: null, reason: EVIDENCE_MEDIA_DEMONSTRATION_RECORD_REASON } as const satisfies EvidenceMediaRef;

/**
 * FIX WAVE J (truth rule 3d; findings JA2-03 / JW-03): `exportKinds` of operation 40 as every Core
 * of this build states it - a PACKAGE can be produced, a COMPOSITE cannot (no encoder is selected).
 */
export const EXPORT_COMPOSITE_UNAVAILABLE_REASON = 'COMPOSITE_ENCODER_NOT_SELECTED';
export const EXPORT_KINDS_EXAMPLE = [
  { kind: 'PACKAGE', available: true },
  { kind: 'COMPOSITE', available: false, reason: EXPORT_COMPOSITE_UNAVAILABLE_REASON },
] as const satisfies NonNullable<EvidenceDetail['exportKinds']>;

/**
 * FIX WAVE J (truth rule 3a): operation 41 for a never-sealed item - `409 NOT_SEALED`, nothing written.
 * The in-app simulator throws `SimTransitionError` with `code: UNSEALED_EVIDENCE` for the same item.
 */
export const VERIFY_NOT_SEALED_TEXT = 'This item was never sealed: there is nothing sealed to verify.';
export const VERIFY_NOT_SEALED_EXAMPLE = simRefusalExample(
  `${STATE_EXAMPLE_IDS.recordedEvidenceId}: incomplete session, never sealed`,
  'NOT_SEALED',
  VERIFY_NOT_SEALED_TEXT,
  'UNSEALED_EVIDENCE',
  { from: null, event: 'verify' },
);

/** FIX WAVE J (JA2-02): a verdict of the simulator, as operation 41 answers it for a demonstration record. */
export const VERIFY_DEMONSTRATION_EXAMPLE: EvidenceVerifyResultBody = VERIFY_PASSED;

/**
 * The item of the `getEvidence.productSealed` example: what a Core answers for an item it sealed itself
 * (wave H C1). A constant since reconcile pass R, so that the other real-shape examples below restate it
 * member for member and the two clients' tests import the SAME objects (no client hand-writes one).
 */
const EXAMPLE_PRODUCT_SEALED_ITEM = {
  ...EXAMPLE_EVIDENCE_ITEM,
  integritySource: 'REAL',
  manifestVersion: 2,
  transcriptSha256: null,
  labelsStatus: null,
  developmentSources: true,
  tampered: false,
  tamperedTrackId: null,
  tracks: EXAMPLE_EVIDENCE_ITEM.tracks.filter((track) => track.trackId === TrackId.VIDEO_01 || track.trackId === TrackId.VIDEO_02),
  signature: { value: 'c4'.repeat(64), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false, developmentKey: true },
  sealedPackage: 'PRESENT',
  interrupted: false,
  files: [
    { trackId: TrackId.VIDEO_01, fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 68_363_781, sha256: '1a'.repeat(32), fragmentCount: 67, sha256Plain: '2b'.repeat(32), fragmentChainHead: '3c'.repeat(32) },
    { trackId: TrackId.VIDEO_02, fileName: 'fragments/VIDEO-02.mp4', sizeBytes: 67_588_980, sha256: '4d'.repeat(32), fragmentCount: 67, sha256Plain: '5e'.repeat(32), fragmentChainHead: '6f'.repeat(32) },
  ],
  audioSourceIntervals: [
    { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 17_601, reason: 'START', sourceClass: 'FAKE' },
    { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 17_601, toMs: 49_001, reason: 'MANUAL', sourceClass: 'FAKE' },
    { seq: 3, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 49_001, toMs: 134_145, reason: 'MANUAL', sourceClass: 'FAKE' },
  ],
  transcript: { state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0 },
} satisfies EvidenceDetail['evidence'];

/**
 * FIX WAVE L, driver L-S (re-check 89 finding G89c-04; ruling D229 (3)): the format of each camera
 * file AS SIGNED, on the item (`evidence.files[].profile` - the manifest's `tracks[].profile`, field
 * 36). Spread into an item with `sealedPackage: 'PRESENT'`: it restates the `files` of the product-sealed
 * example with the member. It is NOT `profileId` (the session's input, untouched).
 */
export const EVIDENCE_SEALED_PROFILE_EXAMPLE = {
  files: EXAMPLE_PRODUCT_SEALED_ITEM.files.map((file) => ({ ...file, profile: 'H264_720P30' })),
} satisfies Pick<EvidenceDetail['evidence'], 'files'>;

/**
 * FIX WAVE L, driver L-S (G89c-04): the notice of a session whose recorded stream was not the
 * configured profile, as the item of operation 40 carries it (`evidence.streamProfileNotice`).
 * Absent on an item whose session has no such notice in the Core's alert list.
 */
export const EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE = {
  streamProfileNotice: {
    tracks: [
      { trackId: 'VIDEO-01', stream: 'H264_720P30', configured: 'H264_1080P25' },
      { trackId: 'VIDEO-02', stream: 'H264_720P30', configured: 'H264_1080P25' },
    ],
  },
} satisfies Pick<EvidenceDetail['evidence'], 'streamProfileNotice'>;

/**
 * FIX WAVE L, driver L-S (re-check 94 finding G94c-01): the refusal of the media route
 * (`GET /media/{token}`) for a range that begins in a fragment that does not authenticate - the
 * `409` a player reads when it asks from the byte at which a stream was cut. The body the Core
 * sends, member for member (`apps/core-server/src/media-stream/service.ts`); `fileId` and `seq`
 * name the camera file and the fragment. The media route is no registry operation, so this example
 * hangs on no operation: the clients' player tests import it.
 */
export const MEDIA_FRAGMENT_NOT_AUTHENTIC_REASON = 'FRAGMENT_NOT_AUTHENTIC';
export const MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE = {
  status: 409,
  body: {
    error: {
      code: 'MEDIA_NOT_AVAILABLE',
      message: 'This recording did not pass its integrity check and cannot be played. Verify the evidence item.',
      details: { simCode: 'MEDIA_NOT_AVAILABLE', reason: MEDIA_FRAGMENT_NOT_AUTHENTIC_REASON, fileId: 'VIDEO-02', seq: 3 },
      requestId: 'req-000001',
    },
  },
} as const;

/**
 * FIX WAVE K, driver S2 (re-gate 81 finding G81b-06; decision D160): the model of a sealed
 * transcript as an ITEM carries it (`evidence.transcriptModel` of operation 40, the items of slice
 * `evidence`) - the shape of operation 41's member. A LOCAL backend states all four members.
 */
export const EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE = {
  name: 'ggml-large-v3-turbo',
  version: 'large-v3-turbo',
  quantisation: 'f16',
  modelSha256: '7e'.repeat(32),
  reportedByServer: false,
  report: `Transcript model: ggml-large-v3-turbo, version large-v3-turbo (declared by the installation), quantisation f16, file SHA-256 ${'7e'.repeat(32)}`,
} satisfies EvidenceTranscriptModel;

/** The same member for a SERVER backend (D160): the name the server reported, and nothing the Core verified. */
export const EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE = {
  name: 'whisper-large-v3-turbo',
  version: null,
  quantisation: null,
  modelSha256: null,
  reportedByServer: true,
  report: 'Transcript model: whisper-large-v3-turbo (reported by the STT server; version, quantisation and file hash are not available to the Core and were not verified)',
} satisfies EvidenceTranscriptModel;

/** Fix wave K (G94b-11 / -12): `exportDestinationDefault` of operation 40 on a Core in its own capture. */
/**
 * Fix wave K (G89b-06): the file rows of operation 41 for a package with one tampered fragment in
 * `VIDEO-02`. The stored bytes of that file did not verify, so its plaintext check (V-05) did NOT
 * run: `plainOk` is false AND `plainChecked` is false - a client draws "Not run" for the decrypted
 * bytes of that row, never "FAIL". The first row was checked: the member is absent.
 */
export const VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE: NonNullable<EvidenceVerifyResultBody['files']> = [
  { fileId: 'fragments/VIDEO-01.mp4', trackId: 'VIDEO-01', storedOk: true, plainOk: true, chainOk: true, fragmentCount: 5, ok: true },
  { fileId: 'fragments/VIDEO-02.mp4', trackId: 'VIDEO-02', storedOk: false, plainOk: false, plainChecked: false, chainOk: false, fragmentCount: 5, ok: false },
];

/**
 * Fix wave K (G81b-09): `reason` of a transcript revision as operations 85 and 86 answer it - the
 * note its author gave (operation 85 `note`), as stored and as signed. The two revision examples
 * of the registry (`createTranscriptRevision` 201, `listTranscriptRevisions` 200) carry it.
 */
export const TRANSCRIPT_REVISION_REASON_EXAMPLE = 'Koreksi nama jalan';

export const EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE = 'Case file transfer';

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
        // Fix wave J (truth rule 3a): the record of an interrupted session, on every lane.
        neverSealed: {
          summary: 'A recording that was never sealed (the item of an INCOMPLETE session): no track, no manifest, no signature - the two required members hold the null digest - and nothing to verify',
          value: {
            evidence: EVIDENCE_NOT_SEALED_ITEM_EXAMPLE,
            media: { source: 'NONE', packageSuffix: null, reason: 'NOT_SEALED' },
            exportKinds: [...EXPORT_KINDS_EXAMPLE],
          } satisfies EvidenceDetail,
        },
        // Fix wave J (JA2-02): what a Core in SIMULATED capture says of a session it sealed itself.
        simulatedSealed: {
          summary: 'An item a Core in SIMULATED capture sealed: a demonstration record without media',
          value: {
            evidence: { ...EXAMPLE_EVIDENCE_ITEM, status: 'SEALED', lifecycleStage: 'SEALED_LOCAL_EVIDENCE', integritySource: 'SIMULATED' },
            media: EVIDENCE_MEDIA_DEMONSTRATION_RECORD_EXAMPLE,
            exportKinds: [...EXPORT_KINDS_EXAMPLE],
          } satisfies EvidenceDetail,
        },
        // Wave H C1 (gate finding G94-01; request of wave H C2): what a Core answers for an item it sealed itself.
        productSealed: {
          summary: 'A product-sealed item on a Core server: its sealed camera files play through a media session (operation 88); the sealed facts, what this caller may do and the finished exports are stated',
          value: {
            evidence: EXAMPLE_PRODUCT_SEALED_ITEM,
            media: { source: 'LIVE_STREAM', packageSuffix: null, fileIds: [TrackId.VIDEO_01, TrackId.VIDEO_02] },
            access: { play: true, readTranscript: true, export: true },
            exports: [{ exportId: 'EXP-000033', jobId: 'EXPJ-000033', kind: 'PACKAGE', completedAt: 1_791_620_071_205, exportedBy: 'OPR-002', archiveBytes: 136_096_844, archiveSha256: '7a'.repeat(32) }],
            // Fix wave K (G94b-11 / -12): the Core's one default destination, true to its mode.
            exportDestinationDefault: EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE,
            // Fix wave J (JA2-03 / JW-03): what this Core can export.
            exportKinds: [...EXPORT_KINDS_EXAMPLE],
          } satisfies EvidenceDetail,
        },
        // Reconcile pass R (decisions D205, D207): the other kinds of item a Core answers. Every evidence-item
        // test of the two clients that asks "what does a real item look like" imports THESE - none hand-writes one.
        productSealedInterrupted: {
          summary: 'A product-sealed item whose recording did not end by a stop: the sealed manifest says `interrupted`, the cause is the code of the item\'s custody entry RECORDING_INTERRUPTED, and the durable prefix plays like any sealed package',
          value: {
            evidence: {
              ...EXAMPLE_PRODUCT_SEALED_ITEM,
              status: 'SEALED',
              lifecycleStage: 'SEALED_LOCAL_EVIDENCE',
              interrupted: true,
              interruptedCause: 'CAPTURE_FAULT',
              custody: [
                { at: EXAMPLE_PRODUCT_SEALED_ITEM.recordedAt, action: 'RECORDING_STARTED', actorId: 'OPR-001', detail: null },
                { at: EXAMPLE_PRODUCT_SEALED_ITEM.endedAt, action: 'RECORDING_INTERRUPTED', actorId: null, detail: 'CAPTURE_FAULT' },
                { at: EXAMPLE_PRODUCT_SEALED_ITEM.sealedAt ?? EXAMPLE_PRODUCT_SEALED_ITEM.endedAt, action: 'SEALED', actorId: null, detail: 'Durable prefix sealed (interrupted)' },
              ],
            },
            media: { source: 'LIVE_STREAM', packageSuffix: null, fileIds: [TrackId.VIDEO_01, TrackId.VIDEO_02] },
            access: { play: true, readTranscript: true, export: false },
          } satisfies EvidenceDetail,
        },
        productSealedOneCamera: {
          summary: 'A product-sealed item of a one-camera session: the package holds ONE camera file and operation 88 accepts that `fileId` only',
          value: {
            evidence: {
              ...EXAMPLE_PRODUCT_SEALED_ITEM,
              tracks: EXAMPLE_PRODUCT_SEALED_ITEM.tracks.filter((track) => track.trackId === TrackId.VIDEO_01),
              files: EXAMPLE_PRODUCT_SEALED_ITEM.files.filter((file) => file.trackId === TrackId.VIDEO_01),
            },
            media: { source: 'LIVE_STREAM', packageSuffix: null, fileIds: [TrackId.VIDEO_01] },
            access: { play: true, readTranscript: true, export: false },
          } satisfies EvidenceDetail,
        },
        noMedia: {
          summary: 'A REAL item whose sealed package cannot be read in the Core\'s store: no media, with the reason as a code; the item states no sealed fact (`sealedPackage: NOT_READABLE`)',
          value: {
            evidence: (({ files: _files, audioSourceIntervals: _intervals, interrupted: _interrupted, ...item }) => ({
              ...item,
              signature: { value: item.signature.value, keyId: item.signature.keyId, algorithm: item.signature.algorithm, simulated: item.signature.simulated },
              sealedPackage: 'NOT_READABLE' as const,
            }))(EXAMPLE_PRODUCT_SEALED_ITEM),
            media: { source: 'NONE', packageSuffix: null, reason: 'PACKAGE_MISSING' },
            access: { play: true, readTranscript: true, export: false },
          } satisfies EvidenceDetail,
        },
        outsideCaseScope: {
          summary: 'A product-sealed item read by an operator who does not hold the case: the page is answered, and `access` says what a page view must not ask for (SEC35-16)',
          value: {
            evidence: EXAMPLE_PRODUCT_SEALED_ITEM,
            media: { source: 'LIVE_STREAM', packageSuffix: null, fileIds: [TrackId.VIDEO_01, TrackId.VIDEO_02] },
            access: { play: false, readTranscript: false, export: false },
          } satisfies EvidenceDetail,
        },
        seedSealedDemo: {
          summary: 'A demonstration item the seed SEALED on this Core with the development key (decision D205): a real sealed package of a generated test picture. It plays through operation 88 like any sealed package and is marked by its own members (DEMO_PACKAGE, development sources, development key); no bundled media belongs to it',
          value: {
            evidence: {
              ...EXAMPLE_PRODUCT_SEALED_ITEM,
              integritySource: 'DEMO_PACKAGE',
              developmentSources: true,
              status: 'SEALED',
              lifecycleStage: 'SEALED_LOCAL_EVIDENCE',
            },
            media: { source: 'LIVE_STREAM', packageSuffix: null, fileIds: [TrackId.VIDEO_01, TrackId.VIDEO_02] },
            access: { play: true, readTranscript: true, export: true },
            exports: [],
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
        passedDevelopmentSources: {
          summary: 'Schema v2, recorded from development sources: every check passes and the source class is reported (V-15)',
          value: VERIFY_PASSED_DEVELOPMENT,
        },
      },
      401: SIGNED_OUT,
      403: VIEW_DENIED,
      404: NOT_FOUND,
      409: { notSealed: VERIFY_NOT_SEALED_EXAMPLE },
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
            reason: TRANSCRIPT_REVISION_REASON_EXAMPLE,
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
                reason: TRANSCRIPT_REVISION_REASON_EXAMPLE,
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
    request: {
      secondCamera: { summary: 'The session of the second camera file', value: { fileId: 'VIDEO-02' } satisfies EvidenceMediaSessionRequest },
      indexedView: { summary: 'The indexed view of the first camera file (a player that needs a segment index to seek)', value: EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE },
    },
    responses: {
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
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
        indexedView: {
          summary: 'The same session serving the indexed view: one segment index after the init segment (token placeholder)',
          value: { ...EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE, evidenceId: STATE_EXAMPLE_IDS.evidenceId },
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
        packageMissing: simRefusalExample(
          'Core server: the sealed package of the item is not in the evidence store',
          'MEDIA_NOT_AVAILABLE',
          'No playback media is available for this evidence item.',
          'MEDIA_NOT_AVAILABLE',
          { reason: 'PACKAGE_MISSING' },
        ),
      },
      422: { ...BAD_PATH, invalidInput: ERROR_EXAMPLES.invalidInput },
    },
  },
};
