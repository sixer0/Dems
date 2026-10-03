/**
 * Types and fixed vocabularies of the DEMO evidence packages (blueprint step 93; D50, D51, D61).
 *
 * The packages live in packages/shared/assets/demo-evidence/ and are written only by
 * scripts/gen-demo-evidence.ts. Every path in this module is relative to packages/shared/assets/
 * (the package export `@dems/shared/assets/*`), so a consumer maps it to a URL or a bundled
 * module itself. The module is framework-free and platform-neutral: no DOM, no Node built-ins.
 *
 * Everything here is DEMO data: the signing key is derived from a published seed, the certificate
 * is self-signed and labelled DEMO, and precomputed verification results say so.
 */
import type { TrackId } from '../domain';
import type { EvidenceStatus, OperatorRole, SubjectType } from '../sim/vocabulary';

/** Schema tag of the generated index. */
export const DEMO_EVIDENCE_INDEX_SCHEMA = 'dems.demo-evidence-index/1' as const;

/** The join key shared with the simulator and the media index (D61). */
export const DEMO_EVIDENCE_JOIN_KEY = 'evidenceSuffix' as const;

/** Folder of the packages inside packages/shared/assets/. */
export const DEMO_EVIDENCE_FOLDER = 'demo-evidence' as const;

/** Folder of the step-92 media inside packages/shared/assets/. */
export const DEMO_MEDIA_FOLDER = 'demo-media' as const;

/**
 * Design book §11.2 "Evidence Package Concept": the files every `SESSION-<ID>/` folder holds.
 * `evidence-container.json` stands in for the (encrypted) media payload: it references the media.
 */
export const PACKAGE_ITEM_FILES = {
  container: 'evidence-container.json',
  metadata: 'metadata.json',
  manifest: 'manifest.json',
  signature: 'signature.sig',
  certificate: 'device-certificate.pem',
  auditExtract: 'audit-session-extract.jsonl',
} as const;
export type PackageItemKey = keyof typeof PACKAGE_ITEM_FILES;

/** Design book §11.3 "Manifest Minimum Fields": number, the manifest.json key, and the book's wording. */
export const MANIFEST_FIELDS = [
  { n: 1, key: 'sessionId', label: 'Session ID' },
  { n: 2, key: 'device', label: 'Device ID and certificate identifier' },
  { n: 3, key: 'operator', label: 'Operator/investigator identifier' },
  { n: 4, key: 'subject', label: 'Subject/witness metadata as authorized' },
  { n: 5, key: 'caseReference', label: 'Document/case reference number' },
  { n: 6, key: 'timestamps', label: 'Start/stop timestamps' },
  { n: 7, key: 'timeSource', label: 'Active time-source status' },
  { n: 8, key: 'cameras', label: 'Camera/device identifiers' },
  { n: 9, key: 'microphones', label: 'MIC 1 and MIC 2 track identifiers' },
  { n: 10, key: 'tracks', label: 'Per-track cryptographic hashes' },
  { n: 11, key: 'encryption', label: 'Encryption algorithm identifier' },
  { n: 12, key: 'signature', label: 'Digital signature and certificate chain reference' },
  { n: 13, key: 'finalizationStatus', label: 'Finalization status' },
] as const;
export type ManifestFieldKey = (typeof MANIFEST_FIELDS)[number]['key'];

/** Design book §19.2 "Export Package": number, the export-manifest.json key, and the book's wording. */
export const EXPORT_MANIFEST_ITEMS = [
  { n: 1, key: 'payload', label: 'Evidence payload or approved interoperable representation' },
  { n: 2, key: 'sessionManifest', label: 'Session manifest and per-track hash values' },
  { n: 3, key: 'signature', label: 'Digital signature and certificate-chain reference' },
  { n: 4, key: 'export', label: 'Export identifier, export timestamp and exporting operator identity' },
  { n: 5, key: 'source', label: 'Source device identity and source session identifier' },
  { n: 6, key: 'destination', label: 'Destination identifier or approved media identifier' },
  { n: 7, key: 'package', label: 'Export-package hash and verification result' },
  { n: 8, key: 'authorization', label: 'Purpose/reason and authorization reference' },
] as const;
export type ExportManifestItemKey = (typeof EXPORT_MANIFEST_ITEMS)[number]['key'];

/** The checks a package verification runs, in display order. */
export type DemoTrackCheckId = `track:${TrackId}`;
export type DemoCheckId =
  | DemoTrackCheckId
  | 'manifest'
  | 'signature'
  | 'certificate'
  | 'auditChain'
  | 'exportPackage'
  | 'exportSignature';

/** Where a check result came from: recomputed now, or taken from the generator's DEMO precomputation. */
export type DemoCheckSource = 'computed' | 'precomputed';

export interface DemoCheckResult {
  id: DemoCheckId;
  ok: boolean;
  /** What the sealed record says (a hash, a key or a verdict), or null when not applicable. */
  expected: string | null;
  /** What was found, or null when the check could not produce a value. */
  actual: string | null;
  source: DemoCheckSource;
  /** Short English detail for tooltips and logs. */
  detail?: string;
}

export type DemoVerdict = 'PASS' | 'FAIL';

export interface DemoVerificationReport {
  evidenceSuffix: string;
  evidenceId: string;
  result: DemoVerdict;
  checks: DemoCheckResult[];
  /** IDs of the failed checks (empty on PASS). */
  failed: DemoCheckId[];
  /** Always true: the key, certificate and packages are DEMO. */
  demo: true;
  /** Human label for the UI, e.g. "DEMO - precomputed". */
  label: string;
}

/** The generator's own verification (Node crypto at generation time), stored in the index. */
export interface DemoPrecomputedVerification extends DemoVerificationReport {
  /** The `--as-of` instant (ISO-8601 at +07:00); the check itself ran at generation time. */
  verifiedAt: string;
  verifiedBy: string;
}

/** A file inside packages/shared/assets/ with its size and SHA-256 (lowercase hex). */
export interface DemoFileRef {
  path: string;
  bytes: number;
  sha256: string;
}

/** A step-92 still or rendition that is shown, not verified (no hash: never hard-code or check one). */
export interface DemoAssetRef {
  path: string;
  bytes: number;
}

/** A step-92 mobile rendition (640x360 or 24 kHz): `file` is the flat name step 72 copies into the app. */
export interface DemoMobileAssetRef extends DemoAssetRef {
  file: string;
}

export interface DemoTrackEntry {
  trackId: TrackId;
  label: string;
  /** Logical file name inside the payload and the export zip, e.g. `VIDEO-01.mp4`. */
  file: string;
  mediaType: 'video/mp4' | 'audio/mp4';
  durationSec: number;
  /** The hash the sealed manifest records for this track. */
  sealedSha256: string;
  /** The stored media file the container points to (an altered copy for the tampered track). */
  stored: DemoFileRef;
  /** True only for the tampered package's altered track. */
  altered: boolean;
  poster: DemoAssetRef | null;
  thumbnail: DemoAssetRef | null;
  mobile: { media: DemoMobileAssetRef; poster: DemoMobileAssetRef | null } | null;
}

export type DemoPackageOrigin = 'DATASET' | 'RECORDING_SCENARIO';
export type DemoFinalizationStatus = 'SEALED' | 'INCOMPLETE';
export type DemoSignaturePurpose = 'SEAL' | 'RECOVERY_ATTESTATION';

export interface DemoSignatureEntry {
  algorithm: 'Ed25519';
  keyId: string;
  purpose: DemoSignaturePurpose;
  /** ISO-8601 at +07:00. */
  signedAt: string;
  /** SHA-256 of manifest.json (lowercase hex): the 32 bytes the signature covers. */
  signedDigest: string;
  /** The 64-byte Ed25519 signature, lowercase hex. */
  signatureHex: string;
}

export interface DemoAuditExtractSummary {
  rows: number;
  firstSeq: number;
  lastSeq: number;
  /** Hash of the last row. */
  lastHash: string;
  /** Places where rows of other sessions were left out (seq jumps). */
  gaps: number;
}

export interface DemoExportEntry {
  exportId: string;
  /** ISO-8601 at +07:00. */
  exportedAt: string;
  exportedBy: string;
  exportedByName: string;
  exportedByRole: OperatorRole;
  destination: string;
  reason: string;
  /** Audit row ID of the EVIDENCE_EXPORTED event (the authorization reference). */
  authorizationRef: string;
  zip: DemoFileRef;
  manifest: DemoFileRef;
  signature: DemoFileRef;
  /** Ed25519 signature of SHA-256(export-manifest.json), lowercase hex. */
  signatureHex: string;
  /** Number of entries in the zip. */
  entries: number;
}

export interface DemoEvidencePackage {
  /** `NNNN` of `EV-YYYYMMDD-NNNN`: the join key (D61). */
  evidenceSuffix: string;
  /** `NNNN` of `SES-YYYYMMDD-NNNN`. Note that session 0014 and evidence 0014 are different items. */
  sessionSuffix: string;
  evidenceId: string;
  sessionId: string;
  caseNumber: string;
  origin: DemoPackageOrigin;
  /** Status in the simulator dataset at `asOf` (the recording-scenario item: SEALED once sealed). */
  status: EvidenceStatus;
  finalizationStatus: DemoFinalizationStatus;
  subjectName: string;
  subjectType: SubjectType;
  investigatorId: string;
  investigatorName: string;
  /** ISO-8601 at +07:00. */
  createdAt: string;
  startedAt: string;
  endedAt: string;
  sealedAt: string | null;
  recordingDurationMs: number;
  /** Length of the DEMO media excerpt every track covers (step 92 excerpt rule). */
  excerptDurationMs: number;
  tampered: boolean;
  tamperedTrackId: TrackId | null;
  /** `demo-evidence/SESSION-<sessionId>`. */
  folder: string;
  files: Record<PackageItemKey, DemoFileRef>;
  tracks: DemoTrackEntry[];
  signature: DemoSignatureEntry;
  audit: DemoAuditExtractSummary;
  export: DemoExportEntry | null;
  verification: DemoPrecomputedVerification;
}

export interface DemoSigningKeyInfo {
  keyId: string;
  algorithm: 'Ed25519';
  /** Raw 32-byte public key, lowercase hex. */
  publicKeyHex: string;
  /** The published phrase the DEMO private key is derived from (seed = SHA-256 of its UTF-8 bytes). */
  seedPhrase: string;
  derivation: string;
  notice: string;
}

export interface DemoCertificateInfo {
  path: string;
  /** SHA-256 of the DER bytes, lowercase hex. */
  sha256: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  selfSigned: true;
}

export interface DemoApiExamplePayloads {
  /** `POST /api/v1/session` body of the recording-scenario session (validates with `sessionCreateSchema`). */
  sessionCreate: {
    request: {
      caseNumber: string;
      subjectType: SubjectType;
      subjectName: string;
      investigatorId: string;
      room: string;
      profileId: string;
    };
  };
  /** `POST /api/v1/evidence/{id}/export` of the exported item (validates with the export schemas). */
  evidenceExport: {
    evidenceId: string;
    request: { reason: string; destination: string };
    response: { exportId: string; evidenceId: string; status: 'EXPORTED' };
  };
}

export interface DemoEvidenceIndex {
  schema: typeof DEMO_EVIDENCE_INDEX_SCHEMA;
  demo: true;
  notice: string;
  generator: string;
  /** The `--as-of` argument (WIB), e.g. `2026-10-01T10:00`. */
  asOf: string;
  /** The same instant as ISO-8601 at +07:00. */
  datasetNow: string;
  timezone: '+07:00';
  joinKey: typeof DEMO_EVIDENCE_JOIN_KEY;
  /** Every `path` is relative to this folder of the repository. */
  assetRoot: 'packages/shared/assets';
  folder: typeof DEMO_EVIDENCE_FOLDER;
  key: DemoSigningKeyInfo;
  certificate: DemoCertificateInfo;
  tamperedEvidenceSuffix: string;
  exportedEvidenceSuffixes: string[];
  /** The recording scenario: its session suffix, and the evidence suffix it seals into. */
  liveSession: { sessionSuffix: string; evidenceSuffixWhenSealed: string };
  packages: DemoEvidencePackage[];
  apiExamples: DemoApiExamplePayloads;
}

/** Text of a package's JSON and signature files, for viewers that cannot load files (mobile). */
export interface DemoEvidenceDocuments {
  /** Exact bytes of manifest.json as UTF-8 text (hashing this text gives `signature.signedDigest`). */
  manifestJson: string;
  metadataJson: string;
  signatureSig: string;
  exportManifestJson: string | null;
}
