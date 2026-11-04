/**
 * `export/export-manifest.json` and `export/export-manifest.sig` of a v2 export (blueprint row 91
 * / M8-W2; evidence package spec §B.11, §G.1, §G.3; OD-16).
 *
 * THE EXPORT MANIFEST describes ONE export: the archive beside it (its length, its SHA-256 and
 * every entry with its own hash), the sealed manifest it carries unchanged, the decrypted camera
 * files, who exported, to where and on which authorisation, and - when asked for - the composite.
 * It carries the eight items of the design book §19.2 (the v1 keys `payload`, `sessionManifest`,
 * `signature`, `export`, `source`, `destination`, `package`, `authorization`) and, as its `export`
 * member, the nine fields 112-120 of spec §B.11 in the closed schema of the shared package.
 *
 * ITS OWN HASH (field 120, `export.manifestSha256`). The spec's "SHA-256 of export-manifest.json"
 * cannot include itself, so the rule of the sealed manifest (§B.10) is applied: the digest is
 * SHA-256 of the canonical JSON of the export manifest with `export.manifestSha256` set to null.
 * The file holds the canonical JSON with the digest filled in. Decision D-91-2.
 *
 * THE EXPORT SIGNATURE is the Core signer's signature over the 32 raw bytes of that digest
 * (§G.1 "Ed25519 over SHA-256(export-manifest.json)"). `export-manifest.sig` is a
 * `dems.detached-signature/2` document with `purpose: EXPORT`; the seal's own `signature.sig`
 * (purpose SEAL) is another document and travels unchanged inside the archive.
 *
 * WHAT THE SIGNATURE DOES NOT PROVE (SEC35-06, as for the seal): a receiver that takes the
 * certificate from the archive learns only that the export is self-consistent. The trust anchor
 * is the Core's certificate received out of band.
 *
 * Pure: no file, no clock, no key. The signer comes in through the `Signer` interface.
 */
import {
  ManifestSignatureAlgorithm,
  ManifestV2ExportBlockSchema,
  PackageFile,
  VIDEO_TRACK_IDS,
  isSealedTrackList,
  canonicalJson,
  canonicalJsonBytes,
  manifestSignedMessage,
  sha256Hex,
  type ManifestV2ExportBlock,
} from '@dems/shared/evidence-package';
import { z } from 'zod';
import type { Signer, SigningCertificate } from '../capture';

export const EXPORT_MANIFEST_SCHEMA_ID = 'dems.export-manifest/2';
export const EXPORT_SIGNATURE_SCHEMA_ID = 'dems.detached-signature/2';
/** The bare names of the two files beside the archive (spec §A.2). */
export const EXPORT_MANIFEST_FILE = 'export-manifest.json';
export const EXPORT_SIGNATURE_FILE = 'export-manifest.sig';
/** Where the composite lies inside the archive (spec §A.2). */
export const COMPOSITE_ENTRY = PackageFile.COMPOSITE_FILE;
export const EXPORT_REPRESENTATION = 'DECRYPTED_COPY';
export const EXPORT_PERMISSION = 'EVIDENCE_EXPORT';
/** Row V5 (C84 R-3): the two fixed words of `sourceSigningKey`, the export's statement of a compromise mark. */
export const EXPORT_SOURCE_KEY_STATE = 'MARKED_COMPROMISED';
export const EXPORT_SOURCE_VERIFIED_AS = 'STORED_DIGEST';

const text = z.string().min(1);
const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const count = z.number().int().min(0);
const entryPath = z.string().regex(/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/);

export const ExportManifestSchema = z.strictObject({
  schema: z.literal(EXPORT_MANIFEST_SCHEMA_ID),
  /** §19.2 item 1: the decrypted camera files, each with the plaintext hash the SEALED manifest records. */
  payload: z.strictObject({
    representation: z.literal(EXPORT_REPRESENTATION),
    // ONE TO FOUR camera files, as the sealed package holds them (R88-01, decision D178; D60 of 2026-11-04 widened the shared rule of the sealed track list to four - a two-track package still lists its own two).
    files: z
      .array(z.strictObject({ trackId: z.enum(VIDEO_TRACK_IDS), path: entryPath, bytes: count, sha256Plain: hex64 }))
      .min(1)
      .max(VIDEO_TRACK_IDS.length)
      .refine((files) => isSealedTrackList(files.map((file) => file.trackId)), 'the camera files of a sealed package: one to four (D60), each once, in file order'),
  }),
  /** §19.2 item 2: the sealed manifest, carried byte for byte (§G.2). */
  sessionManifest: z.strictObject({
    path: z.literal(PackageFile.MANIFEST),
    /** SHA-256 of the file's bytes. */
    sha256: hex64,
    /** The sealed manifest's own `manifestSha256` (the digest the seal signed). */
    manifestSha256: hex64,
    manifestVersion: z.literal(2),
    /** The signed development-source mark of the sealed manifest, repeated under the export signature (spec §B.12, §G.2). */
    developmentSources: z.boolean(),
  }),
  /** §19.2 item 3: the seal's signature and certificate, as the archive holds them. */
  signature: z.strictObject({
    path: z.literal(PackageFile.SIGNATURE),
    algorithm: z.enum(ManifestSignatureAlgorithm),
    keyId: text,
    certificate: z.literal(PackageFile.CERTIFICATE),
    certificateSha256: hex64,
  }),
  /** §19.2 item 4 and spec §B.11: fields 112 to 120. */
  export: ManifestV2ExportBlockSchema,
  /** §19.2 item 5. */
  source: z.strictObject({ evidenceId: text, sessionId: text, deviceId: text }),
  /** §19.2 item 6. */
  destination: z.strictObject({ id: text }),
  /**
   * §19.2 item 7: the archive. SINCE WAVE H (gate finding G94-03, ruling D200) THE ARCHIVE IS
   * SELF-CONTAINED: this manifest and its signature are entries of the archive
   * (`export/EXP-<id>.manifest.json` / `.sig`), and an archive cannot contain its own hash - so
   * `bytes` and `sha256` are ABSENT, and the archive's hash is stated outside it (the job answer of
   * operation 87 and the audit row of a download). `entries` covers every OTHER entry of the
   * archive, each with its own hash; the signature covers this manifest. An export written before
   * wave H carries both members: its manifest lies BESIDE the archive and names the archive's hash.
   */
  package: z.strictObject({
    file: z.string().regex(/^EXP-[A-Za-z0-9-]+\.zip$/),
    bytes: count.optional(),
    hashAlgorithm: z.literal('SHA-256'),
    sha256: hex64.optional(),
    entries: z.array(z.strictObject({ path: entryPath, bytes: count, sha256: hex64 })).min(1),
  }),
  /** §19.2 item 8. `reference` is the ID of the audit row of the export request. */
  authorization: z.strictObject({ purpose: text, reference: text, permission: z.literal(EXPORT_PERMISSION) }),
  /** The composite of §G.3: null unless one was asked for. Always marked derived. */
  composite: z
    .strictObject({
      derived: z.literal(true),
      path: z.literal(COMPOSITE_ENTRY),
      bytes: count,
      sha256: hex64,
      encoder: text,
      // The sources a composite names are camera files of the package (the same list rule). The encoder seam composes TWO.
      sources: z
        .array(z.enum(VIDEO_TRACK_IDS))
        .min(1)
        .max(VIDEO_TRACK_IDS.length)
        .refine((sources) => isSealedTrackList(sources), 'the sources of a composite: camera files of the package, each once, in file order'),
    })
    .nullable(),
  /**
   * Task 4 row V5 (decision C84, caution R-3 of security review 230; SX-09 (d)): THE EXPORT'S OWN
   * STATEMENT THAT THE SOURCE IS UNDER A SIGNING KEY MARKED COMPROMISED. Present ONLY in an export
   * of a package whose seal - or one of whose transcript revisions - is signed by a key that the
   * exporting Core held as marked compromised when the export was made (`export.exportedAt`).
   *
   *   state              `MARKED_COMPROMISED`
   *   certificateSha256  the fingerprints (SHA-256 of the DER of the PUBLIC certificate, the form of
   *                      the hand-over record) of the marked certificates this package rests on,
   *                      ascending, each once. Each lies in the archive: the seal's own
   *                      `device-certificate.pem`, or a retained `certificates/<sha256>.pem`
   *   verifiedAs         `STORED_DIGEST`: the exporting Core verified the source against the manifest
   *                      digest (and the head of the transcript revisions) its database recorded at
   *                      the seal - the only way such a package passes there. The signature of the
   *                      marked key proves nothing any more; THIS manifest is signed by the Core's
   *                      ACTIVE key, which is not the marked one (a marked key signs nothing)
   *
   * THE MANIFEST'S ONE OPTIONAL TOP-LEVEL MEMBER: absent in every export made before this step and
   * in every export of a package no mark touches, so the canonical bytes, the digest and what such
   * an export verifies as do not change. A receiver's verifier that predates the member refuses a
   * manifest that CARRIES it (strict schema) - a failure, never a plain pass.
   */
  sourceSigningKey: z
    .strictObject({
      state: z.literal(EXPORT_SOURCE_KEY_STATE),
      certificateSha256: z
        .array(hex64)
        .min(1)
        .max(100)
        .refine((digests) => digests.every((digest, index) => index === 0 || digest > (digests[index - 1] as string)), 'the marked fingerprints: ascending, each once'),
      verifiedAs: z.literal(EXPORT_SOURCE_VERIFIED_AS),
    })
    .optional(),
});
export type ExportManifest = z.output<typeof ExportManifestSchema>;

/** True for the self-contained form (wave H): the manifest names no hash of the archive it lies in. Both members or neither. */
export function isSelfContainedExport(manifest: ExportManifest): boolean {
  return manifest.package.sha256 === undefined && manifest.package.bytes === undefined;
}
export type ExportManifestInput = Omit<ExportManifest, 'schema' | 'export'> & { readonly export: Omit<ManifestV2ExportBlock, 'manifestSha256'> };

export const ExportSignatureSchema = z.strictObject({
  schema: z.literal(EXPORT_SIGNATURE_SCHEMA_ID),
  purpose: z.literal('EXPORT'),
  algorithm: z.enum(ManifestSignatureAlgorithm),
  keyId: text,
  signedFile: z.literal(EXPORT_MANIFEST_FILE),
  digestAlgorithm: z.literal('SHA-256'),
  /** = `export.manifestSha256` of the export manifest. */
  signedDigest: hex64,
  /** Lowercase hex of the raw signature. */
  signature: z.string().regex(/^([0-9a-f]{2}){64,72}$/),
  signedAt: count,
  /** SHA-256 of the DER bytes of the signing certificate; the certificate itself lies in the archive. */
  certificateSha256: hex64,
});
export type ExportSignature = z.output<typeof ExportSignatureSchema>;

/** What is wrong with an export manifest or its signature: a code, never a value. */
export class ExportManifestError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'ExportManifestError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `export.manifestSha256` of an export manifest VALUE (it need not be schema-valid: an altered one is what this is for). */
export function computeExportManifestSha256(manifest: unknown): string {
  if (!isRecord(manifest) || !isRecord(manifest.export)) throw new ExportManifestError('EXPORT_MANIFEST_INVALID');
  return sha256Hex(canonicalJsonBytes({ ...manifest, export: { ...manifest.export, manifestSha256: null } }));
}

/**
 * The export manifest of an input, with its own digest. The marking of §G.3 is not left to the
 * caller: a manifest whose `export.derived`, `export.composite` and `composite` members do not
 * say the same thing is refused.
 */
export function buildExportManifest(input: ExportManifestInput): ExportManifest {
  const unhashed = { schema: EXPORT_MANIFEST_SCHEMA_ID, ...input, export: { ...input.export, manifestSha256: '0'.repeat(64) } };
  const manifestSha256 = computeExportManifestSha256(unhashed);
  const parsed = ExportManifestSchema.safeParse({ ...unhashed, export: { ...input.export, manifestSha256 } });
  if (!parsed.success) throw new ExportManifestError('EXPORT_MANIFEST_INVALID');
  const manifest = parsed.data;
  if (!compositeMarkingHolds(manifest)) throw new ExportManifestError('EXPORT_COMPOSITE_MARKING');
  // The archive hash: both members (the detached form) or neither (the self-contained form).
  if ((manifest.package.sha256 === undefined) !== (manifest.package.bytes === undefined)) throw new ExportManifestError('EXPORT_MANIFEST_INVALID');
  return manifest;
}

/**
 * §G.3: `export.derived` is true exactly when a composite is included; an included composite has
 * its block (marked derived) with the same encoder and hash as the export block, and its archive
 * entry with the same hash and length; no composite means no block, no encoder, no hash, no entry.
 */
export function compositeMarkingHolds(manifest: ExportManifest): boolean {
  const block = manifest.export.composite;
  const entry = manifest.package.entries.find((candidate) => candidate.path === COMPOSITE_ENTRY);
  if (manifest.export.derived !== block.included) return false;
  if (!block.included) return manifest.composite === null && block.encoder === null && block.sha256 === null && entry === undefined;
  const composite = manifest.composite;
  if (composite === null || entry === undefined) return false;
  return composite.sha256 === block.sha256 && composite.encoder === block.encoder && entry.sha256 === composite.sha256 && entry.bytes === composite.bytes;
}

/** The bytes of `export-manifest.json`: the canonical JSON of the whole manifest. */
export function serializeExportManifest(manifest: ExportManifest): Uint8Array {
  return canonicalJsonBytes(manifest);
}

/** Reads `export-manifest.json`. Refuses a text that is not the canonical form of a valid manifest. */
export function parseExportManifest(fileText: string): ExportManifest {
  let value: unknown;
  try {
    value = JSON.parse(fileText);
  } catch {
    throw new ExportManifestError('EXPORT_MANIFEST_UNREADABLE');
  }
  const parsed = ExportManifestSchema.safeParse(value);
  if (!parsed.success) throw new ExportManifestError('EXPORT_MANIFEST_INVALID');
  if (canonicalJson(parsed.data) !== fileText) throw new ExportManifestError('EXPORT_MANIFEST_NOT_CANONICAL');
  return parsed.data;
}

export type RawSignatureVerifier = (publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array) => boolean;

/**
 * Signs an export manifest. Refuses a certificate of another key, and a signature that does not
 * verify with the signer's own public key (a broken signer yields no export).
 */
export async function signExportManifest(
  signing: Signer,
  certificate: SigningCertificate,
  manifest: ExportManifest,
  signedAt: number,
  verifier: RawSignatureVerifier,
): Promise<ExportSignature> {
  if (certificate.keyId !== signing.keyId) throw new ExportManifestError('SIGNER_MISMATCH');
  const message = manifestSignedMessage(manifest.export.manifestSha256);
  let raw: Uint8Array;
  try {
    raw = await signing.sign(message);
  } catch {
    throw new ExportManifestError('SIGNATURE_FAILED');
  }
  if (!verifier(signing.publicKey(), message, raw)) throw new ExportManifestError('SIGNATURE_FAILED');
  const parsed = ExportSignatureSchema.safeParse({
    schema: EXPORT_SIGNATURE_SCHEMA_ID,
    purpose: 'EXPORT',
    algorithm: signing.algorithm,
    keyId: signing.keyId,
    signedFile: EXPORT_MANIFEST_FILE,
    digestAlgorithm: 'SHA-256',
    signedDigest: manifest.export.manifestSha256,
    signature: Buffer.from(raw).toString('hex'),
    signedAt,
    certificateSha256: certificate.sha256,
  });
  if (!parsed.success) throw new ExportManifestError('SIGNATURE_FAILED');
  return parsed.data;
}

export function serializeExportSignature(signature: ExportSignature): Uint8Array {
  return canonicalJsonBytes(signature);
}

export function parseExportSignature(fileText: string): ExportSignature {
  let value: unknown;
  try {
    value = JSON.parse(fileText);
  } catch {
    throw new ExportManifestError('EXPORT_SIGNATURE_UNREADABLE');
  }
  const parsed = ExportSignatureSchema.safeParse(value);
  if (!parsed.success) throw new ExportManifestError('EXPORT_SIGNATURE_INVALID');
  return parsed.data;
}
