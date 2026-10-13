/**
 * Verify v2 — the result shape and the ports (blueprint row 85 / M7-W4; evidence package spec §D).
 *
 * Pure and platform neutral: this folder reads no file, opens no key and makes no signature
 * check of its own. Everything outside a value comes through a port:
 *
 *   PackageReader        the bytes of the package folder (the Core: the file system)
 *   FragmentOpener       stored bytes -> plaintext of ONE sealed range (the Core: the per-fragment
 *                        AES-256-GCM of the credential store, row 84). Absent = no session key.
 *   CertificateReader    a PEM certificate -> its public key and validity, self-signature checked
 *   SignatureVerifier    Ed25519 / ECDSA verification
 *   HashFactory          incremental SHA-256 (default: `@noble/hashes`; the Core hands in its own)
 *
 * V-15 (row 141; spec §B.12, §D.1): the fifteenth check reads the development-source mark, and the
 * result carries what the package says of its sources (`sources`). A class other than PRODUCTION
 * is never a failure; a missing or inconsistent mark is.
 */
import type { ManifestSourceClass } from '../evidence-package';

export const VERIFY_RESULT_SCHEMA_ID = 'dems.verify-result/2';

/** The 15 checks of spec §D, in their order (V-01 to V-14: row 85; V-15: row 141). */
export const VERIFY_V2_CHECKS = [
  { id: 'V-01', name: 'Manifest structure' },
  { id: 'V-02', name: 'Manifest internal consistency' },
  { id: 'V-03', name: 'Manifest hash' },
  { id: 'V-04', name: 'Per-fragment stored-bytes hash' },
  { id: 'V-05', name: 'Plaintext hash after decryption' },
  { id: 'V-06', name: 'Chain-hash continuity' },
  { id: 'V-07', name: 'Sequence contiguity' },
  { id: 'V-08', name: 'One-fragment tamper expectation' },
  { id: 'V-09', name: 'Signature verification' },
  { id: 'V-10', name: 'Transcript hash match' },
  { id: 'V-11', name: 'Revision signatures' },
  { id: 'V-12', name: 'Interrupted-seal flag' },
  { id: 'V-13', name: 'Certificate validity' },
  { id: 'V-14', name: 'File completeness' },
  { id: 'V-15', name: 'Source class' },
] as const;
export type VerifyCheckId = (typeof VERIFY_V2_CHECKS)[number]['id'];

/** Spec §D: the four failure classes. */
export const VerifyFailureClass = { TAMPERED: 'TAMPERED', CORRUPT: 'CORRUPT', MISSING: 'MISSING', UNREADABLE: 'UNREADABLE' } as const;
export type VerifyFailureClass = (typeof VerifyFailureClass)[keyof typeof VerifyFailureClass];

export const VerifyCheckStatus = { PASS: 'PASS', FAIL: 'FAIL', SKIPPED: 'SKIPPED' } as const;
export type VerifyCheckStatus = (typeof VerifyCheckStatus)[keyof typeof VerifyCheckStatus];

/**
 * Why a check did not run. `BLOCKED`: another check failed first and this one has nothing to
 * read (it never stands alone: the verdict is already a failure). `KEY_UNAVAILABLE`: there is no
 * session key and the caller allowed that (`plaintext: 'WHEN_KEY_AVAILABLE'`). `OUT_OF_SCOPE`: the
 * caller asked for the manifest and its seal only (`scope: 'MANIFEST'`); such a run is never `ok`.
 */
export const VerifySkipReason = { BLOCKED: 'BLOCKED', KEY_UNAVAILABLE: 'KEY_UNAVAILABLE', OUT_OF_SCOPE: 'OUT_OF_SCOPE' } as const;
export type VerifySkipReason = (typeof VerifySkipReason)[keyof typeof VerifySkipReason];

/** The failure codes, each with the check that reports it and its class. */
export const VERIFY_FAILURES = {
  // V-01
  MANIFEST_MISSING: { check: 'V-01', failureClass: 'MISSING' },
  MANIFEST_UNREADABLE: { check: 'V-01', failureClass: 'UNREADABLE' },
  MANIFEST_VERSION_UNSUPPORTED: { check: 'V-01', failureClass: 'UNREADABLE' },
  MANIFEST_FIELD_MISSING: { check: 'V-01', failureClass: 'MISSING' },
  MANIFEST_FIELD_INVALID: { check: 'V-01', failureClass: 'UNREADABLE' },
  // V-02
  FRAGMENT_COUNT_MISMATCH: { check: 'V-02', failureClass: 'CORRUPT' },
  CHAIN_HEAD_MISMATCH: { check: 'V-02', failureClass: 'CORRUPT' },
  BYTE_RANGE_INVALID: { check: 'V-02', failureClass: 'CORRUPT' },
  FRAGMENTS_JSON_MISSING: { check: 'V-02', failureClass: 'MISSING' },
  FRAGMENTS_JSON_MISMATCH: { check: 'V-02', failureClass: 'TAMPERED' },
  GCM_RECORD_MISMATCH: { check: 'V-02', failureClass: 'CORRUPT' },
  // V-03
  MANIFEST_HASH_MISMATCH: { check: 'V-03', failureClass: 'TAMPERED' },
  MANIFEST_NOT_CANONICAL: { check: 'V-03', failureClass: 'TAMPERED' },
  SIGNED_DIGEST_MISMATCH: { check: 'V-03', failureClass: 'TAMPERED' },
  MANIFEST_NOT_OF_ITEM: { check: 'V-03', failureClass: 'TAMPERED' },
  // V-04
  CAMERA_FILE_MISSING: { check: 'V-04', failureClass: 'MISSING' },
  CAMERA_FILE_UNREADABLE: { check: 'V-04', failureClass: 'UNREADABLE' },
  FILE_SIZE_MISMATCH: { check: 'V-04', failureClass: 'TAMPERED' },
  FILE_HASH_MISMATCH: { check: 'V-04', failureClass: 'TAMPERED' },
  FRAGMENT_HASH_MISMATCH: { check: 'V-04', failureClass: 'TAMPERED' },
  FRAGMENT_BYTES_TRUNCATED: { check: 'V-04', failureClass: 'TAMPERED' },
  // V-05
  SESSION_KEY_UNAVAILABLE: { check: 'V-05', failureClass: 'MISSING' },
  PLAINTEXT_HASH_NOT_RECORDED: { check: 'V-05', failureClass: 'MISSING' },
  PLAINTEXT_HASH_MISMATCH: { check: 'V-05', failureClass: 'TAMPERED' },
  FRAGMENT_PLAINTEXT_HASH_MISMATCH: { check: 'V-05', failureClass: 'TAMPERED' },
  FRAGMENT_TOO_LARGE: { check: 'V-05', failureClass: 'CORRUPT' },
  // V-06
  CHAIN_BROKEN: { check: 'V-06', failureClass: 'TAMPERED' },
  CHAIN_RECORD_INCONSISTENT: { check: 'V-06', failureClass: 'CORRUPT' },
  // V-07
  SEQUENCE_NOT_CONTIGUOUS: { check: 'V-07', failureClass: 'CORRUPT' },
  OFFSET_NOT_INCREASING: { check: 'V-07', failureClass: 'CORRUPT' },
  // V-08
  FRAGMENT_TAMPERED: { check: 'V-08', failureClass: 'TAMPERED' },
  STORED_BYTES_INCONSISTENT: { check: 'V-08', failureClass: 'CORRUPT' },
  // V-09
  SIGNATURE_FILE_MISSING: { check: 'V-09', failureClass: 'MISSING' },
  SIGNATURE_FILE_UNREADABLE: { check: 'V-09', failureClass: 'UNREADABLE' },
  SIGNATURE_FILE_MISMATCH: { check: 'V-09', failureClass: 'TAMPERED' },
  SIGNATURE_KEY_UNAVAILABLE: { check: 'V-09', failureClass: 'MISSING' },
  SIGNATURE_INVALID: { check: 'V-09', failureClass: 'TAMPERED' },
  // V-10
  TRANSCRIPT_FILE_MISSING: { check: 'V-10', failureClass: 'MISSING' },
  TRANSCRIPT_FILE_UNREADABLE: { check: 'V-10', failureClass: 'UNREADABLE' },
  TRANSCRIPT_HASH_MISMATCH: { check: 'V-10', failureClass: 'TAMPERED' },
  TRANSCRIPT_NOT_OF_ITEM: { check: 'V-10', failureClass: 'TAMPERED' },
  /** The header of the sealed document and the manifest disagree on the backend or on a model member, or the document's own model breaks the provenance rule (D160). */
  TRANSCRIPT_MODEL_MISMATCH: { check: 'V-10', failureClass: 'TAMPERED' },
  // V-11
  REVISIONS_FILE_MISSING: { check: 'V-11', failureClass: 'MISSING' },
  REVISIONS_FILE_UNREADABLE: { check: 'V-11', failureClass: 'UNREADABLE' },
  REVISIONS_NOT_OF_ITEM: { check: 'V-11', failureClass: 'TAMPERED' },
  REVISION_SEQUENCE_BROKEN: { check: 'V-11', failureClass: 'TAMPERED' },
  REVISION_COUNT_MISMATCH: { check: 'V-11', failureClass: 'TAMPERED' },
  REVISION_PARENT_MISMATCH: { check: 'V-11', failureClass: 'TAMPERED' },
  REVISION_BODY_MISSING: { check: 'V-11', failureClass: 'MISSING' },
  REVISION_BODY_HASH_MISMATCH: { check: 'V-11', failureClass: 'TAMPERED' },
  REVISION_MEMBER_MISMATCH: { check: 'V-11', failureClass: 'TAMPERED' },
  REVISION_CERTIFICATE_MISSING: { check: 'V-11', failureClass: 'MISSING' },
  REVISION_CERTIFICATE_NOT_TRUSTED: { check: 'V-11', failureClass: 'TAMPERED' },
  /** Row V5: the certificate of a revision is one the verifier was TOLD is marked compromised (`VerifyExpectations.compromisedCertificateSha256`). Never raised without that input. */
  REVISION_CERTIFICATE_KEY_COMPROMISED: { check: 'V-11', failureClass: 'TAMPERED' },
  REVISION_SIGNATURE_INVALID: { check: 'V-11', failureClass: 'TAMPERED' },
  // V-12
  INTERRUPTED_PREFIX_NOT_VERIFIED: { check: 'V-12', failureClass: 'TAMPERED' },
  // V-13
  CERTIFICATE_MISSING: { check: 'V-13', failureClass: 'MISSING' },
  CERTIFICATE_UNREADABLE: { check: 'V-13', failureClass: 'UNREADABLE' },
  CERTIFICATE_HASH_MISMATCH: { check: 'V-13', failureClass: 'TAMPERED' },
  CERTIFICATE_NOT_VALID_AT_SIGNING: { check: 'V-13', failureClass: 'TAMPERED' },
  CERTIFICATE_NOT_TRUSTED: { check: 'V-13', failureClass: 'TAMPERED' },
  /**
   * Row V5 (decision C84, caution R-2): the certificate of the seal is one the verifier was TOLD is
   * marked compromised (`VerifyExpectations.compromisedCertificateSha256`). Never raised without
   * that input. Its class is the class of every certificate that is not to be relied on; the STATE
   * is `signature.compromisedKey` and the notice `SIGNED_BY_COMPROMISED_KEY`: the signature may be
   * valid, and that proves nothing any more - not a pass.
   */
  CERTIFICATE_KEY_COMPROMISED: { check: 'V-13', failureClass: 'TAMPERED' },
  /** Manifest field 25 / 26 (`device.certificate.subject` / `.serialNumber`) is not what the certificate itself says (F-M7 R88-08). */
  CERTIFICATE_SUBJECT_MISMATCH: { check: 'V-13', failureClass: 'TAMPERED' },
  // V-14
  DECLARED_FILE_MISSING: { check: 'V-14', failureClass: 'MISSING' },
  DECLARED_FILE_UNREADABLE: { check: 'V-14', failureClass: 'UNREADABLE' },
  UNEXPECTED_FILE: { check: 'V-14', failureClass: 'TAMPERED' },
  PACKAGE_UNLISTABLE: { check: 'V-14', failureClass: 'UNREADABLE' },
  // V-15 (spec §D: (a) not well-formed = MISSING, (b) not consistent = CORRUPT)
  SOURCE_CLASS_MISSING: { check: 'V-15', failureClass: 'MISSING' },
  SOURCE_CLASS_INVALID: { check: 'V-15', failureClass: 'MISSING' },
  DEVELOPMENT_FLAG_MISSING: { check: 'V-15', failureClass: 'MISSING' },
  DEVELOPMENT_FLAG_INVALID: { check: 'V-15', failureClass: 'MISSING' },
  DEVELOPMENT_FLAG_INCONSISTENT: { check: 'V-15', failureClass: 'CORRUPT' },
  MIC_SOURCE_CLASS_INCONSISTENT: { check: 'V-15', failureClass: 'CORRUPT' },
} as const satisfies Record<string, { check: VerifyCheckId; failureClass: VerifyFailureClass }>;
export type VerifyFailureCode = keyof typeof VERIFY_FAILURES;

/**
 * One thing a check found. It names WHERE (a track, a fragment, a file of the package, a member
 * path of the manifest, a revision number) and never WHAT: no value of the package, no hash, no
 * key material and no host path is ever in a finding.
 */
export interface VerifyFinding {
  readonly code: VerifyFailureCode;
  readonly failureClass: VerifyFailureClass;
  readonly trackId?: string;
  readonly seq?: number;
  /** A path inside the package folder, `/` separated. */
  readonly file?: string;
  /** A dotted member path of the manifest; with `revisionNo`, a member of that revision's record. */
  readonly member?: string;
  readonly revisionNo?: number;
}

export interface VerifyCheckResult {
  readonly id: VerifyCheckId;
  readonly name: string;
  readonly status: VerifyCheckStatus;
  /** The class of the check's first finding; null unless `status` is FAIL. */
  readonly failureClass: VerifyFailureClass | null;
  readonly skipped: VerifySkipReason | null;
  readonly findings: readonly VerifyFinding[];
}

/** A fragment that did not verify. Fragments that verified are counted, not listed. */
export interface FragmentVerifyResult {
  readonly trackId: string;
  readonly seq: number;
  readonly ok: false;
  readonly reason: VerifyFailureClass;
  readonly storedOk: boolean;
  /** null: not checked (no key, or the stored bytes already failed). */
  readonly plainOk: boolean | null;
}

export interface FileVerifyResult {
  readonly trackId: string;
  readonly file: string;
  readonly fragmentCount: number;
  /** The whole file and every fragment hash to the sealed stored-bytes values (V-04). */
  readonly storedOk: boolean;
  /** The decrypted file and every decrypted fragment hash to the sealed plaintext values (V-05); null: not checked. */
  readonly plainOk: boolean | null;
  /** The recorded chain is consistent and the chain over the bytes on disk equals it (V-06). */
  readonly chainOk: boolean;
  readonly sequenceOk: boolean;
  /** The first fragment at which the chain over the bytes on disk leaves the recorded chain. */
  readonly chainBrokenFromSeq: number | null;
  /** Only the fragments that did not verify. */
  readonly fragments: readonly FragmentVerifyResult[];
}

export type VerifyOverall = 'PASS' | VerifyFailureClass;

/**
 * WHAT A VERIFIED PACKAGE SAYS OF ITS TRANSCRIPT (row 119; spec §B.7a, §D; decision D110). A
 * state, not a check: a package without a transcript document verifies PASS when the manifest
 * DECLARES the absence, and the report says which absence it is.
 *
 *   READY                         a transcript document is sealed, every chunk committed
 *   PARTIAL                       a document is sealed; chunks failed or audio was missing
 *   PARTIAL_BACKEND_UNREACHABLE   the same, and the configured backend could not be reached
 *   DISABLED_BY_CONFIGURATION     no document: STT was off in the session's snapshot
 *   UNAVAILABLE_AT_SEAL           no document: STT was ON and no transcript could be handed over
 *                                 at the bound of the seal. Never reported as disabled
 *   NOT_TRUSTWORTHY               the manifest is not the signed one (V-03, V-09 or V-13 failed):
 *                                 what it says of the transcript is not repeated as fact
 *   UNKNOWN                       there is no readable manifest
 */
export const VerifiedTranscriptState = {
  READY: 'READY',
  PARTIAL: 'PARTIAL',
  PARTIAL_BACKEND_UNREACHABLE: 'PARTIAL_BACKEND_UNREACHABLE',
  DISABLED_BY_CONFIGURATION: 'DISABLED_BY_CONFIGURATION',
  UNAVAILABLE_AT_SEAL: 'UNAVAILABLE_AT_SEAL',
  NOT_TRUSTWORTHY: 'NOT_TRUSTWORTHY',
  UNKNOWN: 'UNKNOWN',
} as const;
export type VerifiedTranscriptState = (typeof VerifiedTranscriptState)[keyof typeof VerifiedTranscriptState];

/** The report line of each state (English; a client shows its own wording by `code`). */
export const TRANSCRIPT_STATE_REPORT: Readonly<Record<VerifiedTranscriptState, string>> = Object.freeze({
  READY: 'Transcript sealed',
  PARTIAL: 'Transcript partial',
  PARTIAL_BACKEND_UNREACHABLE: 'Transcript partial \u2014 backend unreachable',
  DISABLED_BY_CONFIGURATION: 'Transcript disabled by configuration',
  UNAVAILABLE_AT_SEAL: 'Transcript unavailable at seal',
  NOT_TRUSTWORTHY: 'Transcript state: not trustworthy \u2014 the manifest was altered',
  UNKNOWN: 'Transcript state: unknown \u2014 the manifest cannot be read',
});

/**
 * The model of the sealed transcript, for the report (ruling D160; integration pass D10). What the
 * Core could know of the model depends on the backend the session's configuration snapshot names
 * (manifest field 123): of a model file it read itself (`cpu-local`) the name, the declared
 * version, the quantisation and the SHA-256 of the file; of a SERVER backend the name the server
 * reported and nothing else - the three other members are null there, and ONLY there. The report
 * line says which of the two it is, so a reader never takes a reported name for a verified file.
 */
export interface TranscriptModelReport {
  readonly name: string;
  readonly version: string | null;
  readonly quantisation: string | null;
  readonly modelSha256: string | null;
  /** True when the snapshot's backend is a server: the name is the server's word, nothing of the model was verified by the Core. */
  readonly reportedByServer: boolean;
  /** The report line (`transcriptModelLineOf`). */
  readonly report: string;
}

/** The report line of a transcript model. English; a client words its own from the members. */
export function transcriptModelLineOf(model: Pick<TranscriptModelReport, 'name' | 'version' | 'quantisation' | 'modelSha256' | 'reportedByServer'>): string {
  return model.reportedByServer
    ? `Transcript model: ${model.name} (reported by the STT server; version, quantisation and file hash are not available to the Core and were not verified)`
    : `Transcript model: ${model.name}, version ${model.version ?? 'not recorded'} (declared by the installation), quantisation ${model.quantisation ?? 'not recorded'}, file SHA-256 ${model.modelSha256 ?? 'not recorded'}`;
}

export interface TranscriptStateReport {
  readonly code: VerifiedTranscriptState;
  /** `TRANSCRIPT_STATE_REPORT[code]`. */
  readonly report: string;
  /** Manifest field 92. The five members below are null unless the manifest is the signed one. */
  readonly sealedState: 'ASSEMBLED' | 'PARTIAL' | 'DISABLED' | null;
  /** Manifest field 121: why no document is sealed; null when one is. */
  readonly reason: 'DISABLED_BY_CONFIGURATION' | 'TRANSCRIPT_UNAVAILABLE_AT_SEAL' | null;
  /** True when the manifest declares a transcript document (then V-10, V-11 and V-14 hold it). */
  readonly documentSealed: boolean | null;
  /** Manifest field 93. */
  readonly failedChunks: number | null;
  /** Manifest field 122. */
  readonly backendUnreachable: boolean | null;
}

/**
 * WHAT A VERIFIED PACKAGE SAYS OF ITS SOURCES (row 141; spec §B.12, §D.1, §H.5).
 *
 *   DEVELOPMENT           at least one source is `LOCAL_DEVICE` or `FAKE`. Not a failure.
 *   DECLARED_PRODUCTION   every source reads `PRODUCTION`. A statement of the Core that sealed the
 *                         package, covered by its signature - never a fact the verifier proved (§H.5)
 *   NOT_TRUSTWORTHY       the manifest is not the signed one, or its mark is missing or inconsistent
 *                         (V-01, V-03, V-09, V-13 or V-15 did not pass): no class is repeated as fact
 *   UNKNOWN               there is no readable v2 manifest
 *
 * Absence is never read as production: only DECLARED_PRODUCTION says so, and only from a manifest
 * that passed those five checks.
 */
export const VerifiedSourcesState = {
  DEVELOPMENT: 'DEVELOPMENT',
  DECLARED_PRODUCTION: 'DECLARED_PRODUCTION',
  NOT_TRUSTWORTHY: 'NOT_TRUSTWORTHY',
  UNKNOWN: 'UNKNOWN',
} as const;
export type VerifiedSourcesState = (typeof VerifiedSourcesState)[keyof typeof VerifiedSourcesState];

/** The report line of each state (English, spec §D.1; a client shows its own wording by `code`). */
export const SOURCES_STATE_REPORT: Readonly<Record<VerifiedSourcesState, string>> = Object.freeze({
  DEVELOPMENT: 'DEVELOPMENT SOURCES \u2014 this package was not recorded from production devices.',
  DECLARED_PRODUCTION: 'Sources: declared as production devices by the Core that sealed this package.',
  NOT_TRUSTWORTHY: 'Sources: not trustworthy \u2014 the manifest was altered',
  UNKNOWN: 'Sources: unknown \u2014 the manifest cannot be read',
});

export interface SourcesReport {
  /** V-15 passed: the mark is there, well-formed and consistent. Says nothing of its value. */
  readonly ok: boolean;
  readonly code: VerifiedSourcesState;
  /**
   * Recomputed by the verifier from the classes, never copied from field 126. null exactly when
   * `code` is NOT_TRUSTWORTHY or UNKNOWN: nothing is stated, and null is never "production".
   */
  readonly development: boolean | null;
  /** `SOURCES_STATE_REPORT[code]`: the FIRST line of a report (`verifyReportLines`). */
  readonly report: string;
  /** One entry per source, in words (spec §D.1). Empty unless `code` is DEVELOPMENT. */
  readonly lines: readonly string[];
  /** Field 124 of each camera file. Empty when nothing is stated. */
  readonly tracks: readonly { readonly trackId: string; readonly deviceId: string; readonly sourceClass: ManifestSourceClass }[];
  /** Field 125 of each interval of the session audio track. Empty when nothing is stated. */
  readonly audioIntervals: readonly { readonly seq: number; readonly micDeviceId: string; readonly sourceClass: ManifestSourceClass }[];
}

export interface PackageVerifyResult {
  readonly schema: typeof VERIFY_RESULT_SCHEMA_ID;
  /** The conjunction of the checks. */
  readonly ok: boolean;
  /** PASS, or the gravest class among the findings (TAMPERED, then MISSING, CORRUPT, UNREADABLE). */
  readonly overall: VerifyOverall;
  /** Exactly 15 entries, V-01 to V-15, in order. */
  readonly checks: readonly VerifyCheckResult[];
  readonly files: readonly FileVerifyResult[];
  /** Every fragment that did not verify, over both files (spec §D V-08 "names the fragment"). */
  readonly fragments: readonly FragmentVerifyResult[];
  /**
   * The outcome of V-10 / V-11. DISABLED and UNAVAILABLE: the manifest declares that no document
   * is sealed (by configuration / none could be handed over at the seal), so there was nothing to hash.
   */
  readonly transcript: { readonly state: 'VERIFIED' | 'FAILED' | 'DISABLED' | 'UNAVAILABLE' | 'NOT_CHECKED'; readonly revisions: number | null };
  /** What the package says of its transcript, for the report (row 119). Never turns a pass into a failure. */
  readonly transcriptState: TranscriptStateReport;
  /** The model of the sealed transcript (D160). Null unless the manifest is the signed one AND declares a document. */
  readonly transcriptModel: TranscriptModelReport | null;
  /** What the package says of its sources (row 141, V-15). A development class never turns a pass into a failure. */
  readonly sources: SourcesReport;
  readonly signature: {
    readonly ok: boolean;
    readonly algorithm: string | null;
    readonly keyId: string | null;
    readonly simulated: boolean | null;
    /**
     * The subject of the CERTIFICATE THAT VERIFIED THE SIGNATURE carries the development-key mark
     * (`DEVELOPMENT_KEY_SUBJECT_MARK`; decisions D147, D178 / F-M7 R88-08). A FACT ABOUT THE KEY,
     * not a verdict. `true` / `false` ONLY when the manifest is the signed one and its certificate
     * holds (V-01, V-03, V-09 and V-13 passed) and the reader stated the certificate's subject.
     * `null` otherwise: NOT ESTABLISHED - never `false` from bytes that were not verified.
     */
    readonly developmentKey: boolean | null;
    /**
     * Task 4 row V4 (decision C77): whether the key the signature verified under is one the
     * verifier was told is MARKED COMPROMISED (`VerifiedSigningKeyMark`). OPTIONAL, and ABSENT in
     * every result of a verifier that is told of no marked key - every result of `verifyPackageV2`
     * that was not handed `expected.compromisedCertificateSha256` (row V5), so no existing result
     * changes. Absent is `NOT_ESTABLISHED`: never "not compromised".
     */
    readonly compromisedKey?: VerifiedSigningKeyMark;
    /** OD-03: the stored-bytes checks (V-04, V-06, V-07) need no key of any kind. */
    readonly integrityCheckedWithoutKey: true;
  };
  /** V-12: the package is a sealed durable prefix of an interrupted recording (OD-08). A state, not a failure. */
  readonly interrupted: boolean;
  /** True when the plaintext hashes were computed (a session key was there). */
  readonly plaintextChecked: boolean;
  /**
   * WHAT THE FORMAT DOES NOT COVER (fix pass F-M7, R88-06): named statements that fail nothing and
   * are never collapsed by a report. Every v2 result carries `AUDIT_EXTRACT_NOT_SIGNED`. ONE member
   * is of another kind (row V4): `SIGNED_BY_COMPROMISED_KEY` states the mark of the signing key
   * beside a verdict that already took it into account - see `SIGNED_BY_COMPROMISED_KEY_REPORT`.
   */
  readonly notices: readonly VerifyNotice[];
}

/**
 * THE NOTICES OF A v2 RESULT. `AUDIT_EXTRACT_NOT_SIGNED`: `audit-session-extract.jsonl` is a
 * declared file of the package (V-14 asks that it is there) and NO member of the manifest holds
 * its hash, so its CONTENT is covered by no hash and no signature: it can be altered and all 15
 * checks pass. Until a manifest revision gives it a field, a verifier says so, every time.
 */
export const VERIFY_NOTICE = {
  AUDIT_EXTRACT_NOT_SIGNED: 'AUDIT_EXTRACT_NOT_SIGNED',
  EXPORT_FOLDER_UNEXPECTED_FILE: 'EXPORT_FOLDER_UNEXPECTED_FILE',
  REVISION_APPEND_PENDING: 'REVISION_APPEND_PENDING',
  /** Task 4 row V4 (decision C77; SX-09 (d)): see `SIGNED_BY_COMPROMISED_KEY_REPORT`. */
  SIGNED_BY_COMPROMISED_KEY: 'SIGNED_BY_COMPROMISED_KEY',
  /** Task 4 row V6 (decision C97; the request of row P1): see `hostProfileNotAskedReport`. */
  HOST_PROFILE_NOT_ASKED: 'HOST_PROFILE_NOT_ASKED',
  /** Task 4 row R1b (decision C99): see `videoAbsentInSessionReport`. */
  VIDEO_ABSENT_IN_SESSION: 'VIDEO_ABSENT_IN_SESSION',
  /** Task 4 pass I-9b: see `audioAbsentOnRestartReport`. */
  AUDIO_ABSENT_ON_RESTART: 'AUDIO_ABSENT_ON_RESTART',
} as const;
export type VerifyNoticeCode = (typeof VERIFY_NOTICE)[keyof typeof VERIFY_NOTICE];
export interface VerifyNotice {
  readonly code: VerifyNoticeCode;
  /** The report line (English; a client shows its own wording by the code). */
  readonly report: string;
}
/**
 * `EXPORT_FOLDER_UNEXPECTED_FILE` (fix pass F-M7b; controller decision D185 (a)). V-14 does not
 * judge what lies under `export/`: an export is derived and lies beside the sealed set (spec §A.1,
 * §G). The FINISHED artefacts of an export are expected there (`EXPORT_ARTEFACT_NAME`); anything
 * else - a `.partial` a stopped export left, a name no export writes, anything in a sub-folder -
 * is said by this ONE notice, which fails nothing. Present only when there is such a file.
 */
export const EXPORT_ARTEFACT_NAME = /^(?:EXP-[0-9]{6}\.(?:zip|manifest\.json|manifest\.sig)|export-manifest\.(?:json|sig))$/;
/** A file name that may be PRINTED in the notice: a plain name of a closed alphabet. Any other name is counted, never shown. */
export const EXPORT_NOTICE_PRINTABLE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** How many names the notice prints before "and N more". */
export const EXPORT_NOTICE_MAX_NAMES = 3;

/** The report line of `EXPORT_FOLDER_UNEXPECTED_FILE` for the paths (relative to `export/`) that are no finished export. */
export function exportFolderNoticeReport(unexpected: readonly string[]): string {
  const printable = unexpected.filter((name) => EXPORT_NOTICE_PRINTABLE_NAME.test(name)).sort();
  const shown = printable.slice(0, EXPORT_NOTICE_MAX_NAMES);
  const more = unexpected.length - shown.length;
  const names = shown.length === 0 ? '' : ` (${shown.join(', ')}${more > 0 ? `, and ${more} more` : ''})`;
  return `Export folder: ${unexpected.length} file${unexpected.length === 1 ? '' : 's'} that ${unexpected.length === 1 ? 'is' : 'are'} no finished export${names}. ${unexpected.length === 1 ? 'It is' : 'They are'} not part of the sealed package.`;
}

/**
 * `REVISION_APPEND_PENDING` (fix pass F-M7c; controller decision D187). The revision writer of the
 * Core stages the next revision list under THIS EXACT NAME in the package folder before it commits
 * the revision (the table is the journal; a staged file is judged against the table at a start).
 * While it lies there the package is intact: the name is no V-14 failure, it is said by this ONE
 * notice, which fails nothing. Only this name, and only in a package that declares a transcript:
 * every other unexpected name is `UNEXPECTED_FILE` as before. V-11 reads the committed list only.
 */
export const REVISION_APPEND_PENDING_FILE = 'transcript/transcript-revisions.json.next';
/** THE WORDING SOURCE of the notice: the report line both clients draw. */
export const REVISION_APPEND_PENDING_REPORT = 'A transcript revision is being written; verify again shortly.';

/**
 * `HOST_PROFILE_NOT_ASKED` (task 4 row V6; decisions U21 (2), C97; the request of row P1 "the
 * member is not shown in the verdicts"). The manifest carries the optional signed member
 * `hostProfileNotAsked` (field 133): the package was sealed by a PRODUCTION Core on a platform
 * where the checks of the host profile are not run (today `darwin`). A reader of the package saw it
 * only in the manifest; a verifier now SAYS it, in the verdict lines of the Core's own verification
 * and of the receiver's command.
 *
 * IT FAILS NOTHING AND CHANGES NO VERDICT: a package with the member verifies exactly as before,
 * with this one line more; a package without it (every package sealed on Linux, in development, and
 * every package sealed before field 133) gets no line and reads as before. It is raised from the
 * manifest the verifier READ - also when another check of the same package fails.
 *
 * THE PLATFORM in the line is the manifest's own word, printed only when it is one lower-case word
 * of the form a platform name has; anything else is stated without a name.
 */
export const HOST_PROFILE_NOT_ASKED_PLATFORM = /^[a-z][a-z0-9]{0,15}$/;
/** THE WORDING SOURCE of the notice: the report line both clients and the receiver's command draw. */
export function hostProfileNotAskedReport(platform: unknown): string {
  const named = typeof platform === 'string' && HOST_PROFILE_NOT_ASKED_PLATFORM.test(platform) ? ` on ${platform}` : '';
  return `Host profile: NOT ASKED. This package was sealed by a production Core${named}, where the checks of the host profile are not run.`;
}

/**
 * `VIDEO_ABSENT_IN_SESSION` (task 4 row R1b; decision C99). The manifest carries the optional
 * signed member `tracks[].absentInSession` (fields 134-138) on at least one track: the camera of
 * that track stopped delivering pictures inside the session and the Core states how often, for how
 * long (the two measured bounds) and whether the last absence ended. A verifier SAYS it, in the
 * verdict lines of the Core's own verification and of the receiver's command.
 *
 * IT FAILS NOTHING AND CHANGES NO VERDICT: a package with the member verifies exactly as before,
 * with this one line more; a package without it gets no line and reads as before. It is raised
 * from the manifest the verifier READ - also when another check of the same package fails.
 *
 * ONE LINE for the whole package, at most two tracks, numbers and the track ids of the closed list
 * only; it stays below the contract's bound of a report line (256) for the largest numbers a
 * manifest can state. A sum is "not measured" when one of its absences states no such bound.
 */
export interface VideoAbsenceOfTrack {
  readonly trackId: string;
  readonly absences: readonly { readonly absentAtLeastMs: number | null; readonly absentAtMostMs: number | null; readonly ended: string }[];
}
/** A track id that may be PRINTED in the line: the form of the closed list. Any other is stated as "a track". */
export const VIDEO_ABSENT_TRACK_ID = /^VIDEO-0[1-9]$/;
/** THE WORDING SOURCE of the notice: the report line both clients and the receiver's command draw. Empty input: the empty string (no notice). */
export function videoAbsentInSessionReport(tracks: readonly VideoAbsenceOfTrack[]): string {
  const sumOf = (values: readonly (number | null)[]): string => {
    let sum = 0;
    for (const value of values) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return 'not measured';
      sum += value;
    }
    return `${String(sum)} ms`;
  };
  const parts = tracks
    .filter((track) => track.absences.length > 0)
    .slice(0, 2)
    .map((track) => {
      const count = track.absences.length;
      const open = track.absences.at(-1)?.ended === 'NOT_RE_OPENED';
      const named = VIDEO_ABSENT_TRACK_ID.test(track.trackId) ? track.trackId : 'a track';
      return `${named} ${String(count)} time${count === 1 ? '' : 's'}, at least ${sumOf(track.absences.map((absence) => absence.absentAtLeastMs))}, at most ${sumOf(track.absences.map((absence) => absence.absentAtMostMs))}${open ? ', not re-opened' : ''}`;
    });
  if (parts.length === 0) return '';
  const said = `Video: CAMERA ABSENT INSIDE THE SESSION. ${parts.join('; ')}.`;
  const line = `${said} No picture was recorded in that time.`;
  // The closing sentence is the first thing given up for the contract's bound; the numbers never are, short of the bound itself.
  return line.length <= VIDEO_ABSENT_REPORT_MAX ? line : said.slice(0, VIDEO_ABSENT_REPORT_MAX);
}
/** The contract's bound of a notice's report line (`trimmedText(256)` of the verify answer). */
export const VIDEO_ABSENT_REPORT_MAX = 256;

/**
 * `AUDIO_ABSENT_ON_RESTART` (task 4 integration pass I-9b; the audio twin of `VIDEO_ABSENT_IN_SESSION`,
 * in its pattern). The manifest carries the optional signed member `audio.absentOnRestart` (fields
 * 129-132; rows 191c and V4, decisions C73, C83): the capture worker was replaced inside the session
 * and the Core states, per restart, the two measured bounds of the time without sound. Until this
 * pass the member was signed and verified (V-01 is the schema) and SAID by no verifier.
 *
 * IT FAILS NOTHING AND CHANGES NO VERDICT: a package with the member verifies exactly as before,
 * with this one line more; a package without it gets no line and reads as before. It is raised
 * from the manifest the verifier READ - also when another check of the same package fails.
 *
 * ONE LINE for the whole package: the count of restarts and the sums of both bounds, numbers only.
 * A sum is "not measured" when one of its records states no such bound.
 */
export interface AudioRestartGapStated {
  readonly absentAtLeastMs: number | null;
  readonly absentAtMostMs: number | null;
}
/** THE WORDING SOURCE of the notice: the report line both clients and the receiver's command draw. Empty input: the empty string (no notice). */
export function audioAbsentOnRestartReport(gaps: readonly AudioRestartGapStated[]): string {
  if (gaps.length === 0) return '';
  const sumOf = (values: readonly (number | null)[]): string => {
    let sum = 0;
    for (const value of values) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return 'not measured';
      sum += value;
    }
    return `${String(sum)} ms`;
  };
  const count = gaps.length;
  const said = `Audio: ABSENT ACROSS A RESTART OF THE CAPTURE. ${String(count)} time${count === 1 ? '' : 's'}, at least ${sumOf(gaps.map((gap) => gap.absentAtLeastMs))}, at most ${sumOf(gaps.map((gap) => gap.absentAtMostMs))}.`;
  const line = `${said} No sound was recorded in that time.`;
  // The closing sentence is the first thing given up for the contract's bound; the numbers never are, short of the bound itself.
  return line.length <= VIDEO_ABSENT_REPORT_MAX ? line : said.slice(0, VIDEO_ABSENT_REPORT_MAX);
}

export const AUDIT_EXTRACT_NOT_SIGNED_REPORT = Object.freeze({
  PRESENT: 'Audit extract: present, NOT covered by the package signature.',
  MISSING: 'Audit extract: missing; it is NOT covered by the package signature.',
});

/**
 * `SIGNED_BY_COMPROMISED_KEY` (task 4 row V4; decision C77; security requirement SX-09 (d); rows
 * 227, 227b): the manifest - or a transcript revision - is signed by a key that was LATER MARKED
 * COMPROMISED. After a compromise the holder of the key can sign anything, so the signature alone
 * proves nothing any more and such a package is NEVER A PLAIN PASS.
 *
 * UNLIKE THE OTHER NOTICES THIS ONE IS NOT "FAILS NOTHING": it stands beside a verdict that
 * already took the mark into account, and it says which. The three lines, by what the verifier
 * could hold the package to:
 *   COMPROMISED_KEY_STORED_DIGEST      the Core's own verification (operation 41): the package is the
 *                                      one this Core sealed - its manifest digest and the head of its
 *                                      revisions equal what the Core's database stored. A PASS, said so.
 *   COMPROMISED_KEY_NOT_STORED_DIGEST  the Core's own verification: NOT what the database stored. A FAILURE.
 *   COMPROMISED_KEY_NO_RECORD          a RECEIVER's verifier (no database of the Core): the STATE alone -
 *                                      it has no record to hold the package to. Since row V5 (C84 R-2)
 *                                      the verifier is told the marked fingerprints through
 *                                      `VerifyExpectations.compromisedCertificateSha256`, and its
 *                                      verdict in this state is NOT A PASS (V-13 / V-11 fail by name).
 *
 * THE WORDING SOURCE: the first two are, character for character, what the Core server sends in
 * `notices[]` of operation 41 since row 227 (`COMPROMISED_KEY_NOTICE_REPORT` of its
 * `evidence-verify` unit). `verifyPackageV2` raises the notice with the third line, and only when
 * it was handed the list of marked fingerprints and the package rests on one of them.
 */
export const SIGNED_BY_COMPROMISED_KEY_REPORT = Object.freeze({
  COMPROMISED_KEY_STORED_DIGEST:
    'Signing key: MARKED COMPROMISED after this package was sealed. The signature alone proves nothing any more; the package passes because its manifest digest is the one this Core recorded when it sealed the item.',
  COMPROMISED_KEY_NOT_STORED_DIGEST: 'Signing key: MARKED COMPROMISED, and the package is not the one this Core recorded when it sealed the item: not verified.',
  COMPROMISED_KEY_NO_RECORD:
    'Signing key: MARKED COMPROMISED. The signature alone proves nothing any more, and this verifier holds no record of the Core that sealed the item to hold the package to.',
} as const);
export type SignedByCompromisedKeyReport = keyof typeof SIGNED_BY_COMPROMISED_KEY_REPORT;

/**
 * WHAT A VERIFIER SAYS OF THE SIGNING KEY'S MARK (task 4 row V4; decision C77): the state a
 * RECEIVER's verifier shows, as a member of the result (`PackageVerifyResult.signature.
 * compromisedKey`). A fact about the key the signature verified under, not a verdict.
 *   NOT_ESTABLISHED  nothing is said: the verifier was told of no marked key, or the manifest is not
 *                    the signed one / its certificate did not hold. NEVER read as "not compromised".
 *   NOT_MARKED       the verifier was told which certificates are marked, and the one that verified
 *                    the signature is none of them.
 *   COMPROMISED      the certificate of the seal - or of a transcript revision - is one the verifier was
 *                    told is marked compromised: "signed by a key later marked compromised". Stated
 *                    whenever the package rests on a listed certificate (row V5), whatever else failed.
 */
export const VerifiedSigningKeyMark = {
  NOT_ESTABLISHED: 'NOT_ESTABLISHED',
  NOT_MARKED: 'NOT_MARKED',
  COMPROMISED: 'COMPROMISED',
} as const;
export type VerifiedSigningKeyMark = (typeof VerifiedSigningKeyMark)[keyof typeof VerifiedSigningKeyMark];

// ── Ports ──────────────────────────────────────────────────────────────────────────────────────

export type PackageEntry = { readonly kind: 'FILE'; readonly size: number } | { readonly kind: 'ABSENT' } | { readonly kind: 'UNREADABLE' };

export interface PackageReader {
  /** What is at this path of the package. Anything that is not a plain file is UNREADABLE. */
  entry(path: string): Promise<PackageEntry>;
  /** A small clear file as UTF-8 text. Rejects when it is larger than `maxBytes`, not UTF-8 or cannot be read. */
  readText(path: string, maxBytes: number): Promise<string>;
  /**
   * Hands `[offset, offset + length)` to `onChunk`, in order, in pieces no larger than the
   * reader's chunk size. Resolves with the number of bytes handed over: fewer than `length` when
   * the file ends early. A chunk is valid only during its call. Rejects when the file cannot be read.
   */
  readRange(path: string, offset: number, length: number, onChunk: (chunk: Uint8Array) => void): Promise<number>;
  /** Every file below the package folder (`/` separated), or null when there are more than `limit` or the folder cannot be listed. */
  list(limit: number): Promise<readonly string[] | null>;
}

/** What opening needs of a fragment record (spec §B.6 fields 62 to 65, 75 to 77). */
export interface SealedRangeRecord {
  readonly trackId: string;
  readonly seq: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly gcmIv: string;
  readonly gcmTag: string;
  readonly keyId: string;
}

/**
 * THE ONE SEAM to the per-fragment encryption (row 84). `open` returns the plaintext of one sealed
 * range, as long as the stored bytes, or throws when the range does not authenticate (altered
 * bytes, nonce, tag, position or key ID: the AAD of SEC35-10 is recomputed by the opener from the
 * record). No key ever crosses this interface.
 */
export interface FragmentOpener {
  /** True when the session key of that ID can be used. */
  hasKey(keyId: string): boolean | Promise<boolean>;
  open(record: SealedRangeRecord, stored: Uint8Array): Uint8Array | Promise<Uint8Array>;
}

export interface CertificateFacts {
  /** The raw public key. */
  readonly publicKey: Uint8Array;
  /** Epoch milliseconds. */
  readonly notBefore: number;
  readonly notAfter: number;
  /**
   * The subject of the certificate ITSELF, in the text form manifest field 25 holds
   * (`CN=...,OU=...,O=...`), and its serial number as field 26 holds it (upper-case hex). Fix pass
   * F-M7 (R88-08): V-13 holds the two manifest fields to them, and the development-key mark is
   * read from THIS subject - the certificate that verified the signature - never from the
   * manifest's text. A reader that cannot state them leaves them out: nothing is compared, and
   * the mark is then "not established" (null), never `false`.
   */
  readonly subject?: string | null;
  readonly serialNumber?: string | null;
}

/** Parses a PEM certificate and checks its self-signature. null: not a certificate, or the self-signature fails. */
export type CertificateReader = (pemText: string) => CertificateFacts | null;

export type SignatureVerifier = (
  algorithm: 'Ed25519' | 'ECDSA-P256-SHA256',
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
) => boolean | Promise<boolean>;

export interface IncrementalHash {
  update(chunk: Uint8Array): void;
  /** 64 lowercase hex. Called once. */
  digestHex(): string;
}
export type HashFactory = () => IncrementalHash;

export interface VerifyPorts {
  readonly reader: PackageReader;
  readonly readCertificate: CertificateReader;
  readonly verifySignature: SignatureVerifier;
  /** null: this verifier holds no session key at all. */
  readonly opener: FragmentOpener | null;
  /** Default: `@noble/hashes` SHA-256. */
  readonly sha256?: HashFactory;
}

/**
 * What the caller knows from OUTSIDE the package. A package is self-consistent by construction, so
 * a whole package swapped for another validly signed one, or re-signed with a key and certificate
 * of the attacker's own, verifies against itself: only these anchors catch it (SEC35-06).
 */
export interface VerifyExpectations {
  readonly evidenceId?: string;
  readonly sessionId?: string;
  /** The manifest hash recorded when the item was sealed (`evidence_items.manifest_hash`). */
  readonly manifestSha256?: string;
  /** `transcripts.json_sha256` / `evidence_items.transcript_sha256` (V-10). */
  readonly transcriptSha256?: string | null;
  /** The number of revisions the database holds (V-11): a dropped last revision is not visible from the package alone. */
  readonly revisionCount?: number;
  /** SHA-256 of every certificate the verifier trusts, received out of band (spec §C.3). */
  readonly trustedCertificateSha256?: readonly string[];
  /**
   * Task 4 row V5 (decision C84, caution R-2 of security review 230; SX-09 (d)): THE MARKED
   * FINGERPRINTS - SHA-256 of every certificate whose key the verifier was told, OUT OF BAND, is
   * marked compromised (the form of the hand-over record: SHA-256 of the DER of the public
   * certificate). A package cannot say this of itself: after a compromise the holder of the key can
   * sign anything, a clean-looking package included.
   *
   * OPTIONAL. ABSENT: nothing of the result changes - no finding, no notice, no `signature.
   * compromisedKey` member (every result before this step). PRESENT, the empty list included:
   *   - the seal's certificate is listed -> V-13 fails `CERTIFICATE_KEY_COMPROMISED`;
   *   - a revision's certificate is listed -> V-11 fails `REVISION_CERTIFICATE_KEY_COMPROMISED`;
   *   - either -> the notice `SIGNED_BY_COMPROMISED_KEY` with the line `COMPROMISED_KEY_NO_RECORD`;
   *   - `signature.compromisedKey` is stated (`VerifiedSigningKeyMark`).
   * THE VERDICT of this verifier for such a package is therefore NEVER A PASS: "signature valid, key
   * reported compromised by the list supplied - not a pass", a state of its own (`compromisedKey:
   * COMPROMISED`). It has no record of the Core to hold the package to; the Core, which has one,
   * does not use this input - it passes such a package only as the digest it stored
   * (`COMPROMISED_KEY_STORED_DIGEST`). A listed certificate is not relied on even when it is also
   * in `trustedCertificateSha256`: the mark wins.
   */
  readonly compromisedCertificateSha256?: readonly string[];
}

export interface VerifyOptions {
  readonly expected?: VerifyExpectations;
  /**
   * REQUIRED (default; the Core): no usable session key fails V-05 (`SESSION_KEY_UNAVAILABLE`).
   * WHEN_KEY_AVAILABLE (a holder of the ciphertext only, OD-03): V-05 is skipped and reported so.
   */
  readonly plaintext?: 'REQUIRED' | 'WHEN_KEY_AVAILABLE';
  /**
   * PACKAGE (default): all 15 checks. MANIFEST: only the manifest and its seal are read - V-01,
   * V-03, V-09, V-13 and V-15; every other check is SKIPPED (`OUT_OF_SCOPE`) and `ok` is false,
   * because nothing of the media was verified. For a caller that needs the signed mark and
   * nothing else (the reset guard's disk side, decision D98(1)).
   */
  readonly scope?: 'PACKAGE' | 'MANIFEST';
  /** The largest sealed range that is opened (it is held whole in memory). Default 64 MiB. */
  readonly maxOpenFragmentBytes?: number;
}
