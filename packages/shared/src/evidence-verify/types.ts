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
  REVISION_SIGNATURE_INVALID: { check: 'V-11', failureClass: 'TAMPERED' },
  // V-12
  INTERRUPTED_PREFIX_NOT_VERIFIED: { check: 'V-12', failureClass: 'TAMPERED' },
  // V-13
  CERTIFICATE_MISSING: { check: 'V-13', failureClass: 'MISSING' },
  CERTIFICATE_UNREADABLE: { check: 'V-13', failureClass: 'UNREADABLE' },
  CERTIFICATE_HASH_MISMATCH: { check: 'V-13', failureClass: 'TAMPERED' },
  CERTIFICATE_NOT_VALID_AT_SIGNING: { check: 'V-13', failureClass: 'TAMPERED' },
  CERTIFICATE_NOT_TRUSTED: { check: 'V-13', failureClass: 'TAMPERED' },
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
     * The certificate subject the manifest records (field 25) carries the development-key mark
     * (`DEVELOPMENT_KEY_SUBJECT_MARK`; decision D147). A FACT ABOUT THE KEY, not a verdict: `ok`
     * above passes or fails on its own merits. Null when no manifest could be read.
     */
    readonly developmentKey: boolean | null;
    /** OD-03: the stored-bytes checks (V-04, V-06, V-07) need no key of any kind. */
    readonly integrityCheckedWithoutKey: true;
  };
  /** V-12: the package is a sealed durable prefix of an interrupted recording (OD-08). A state, not a failure. */
  readonly interrupted: boolean;
  /** True when the plaintext hashes were computed (a session key was there). */
  readonly plaintextChecked: boolean;
}

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
