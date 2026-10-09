/**
 * `signature.sig`: the detached signature of a sealed v2 package (spec §A.1, §B.10, §C.1).
 *
 * v1 wrote `dems.detached-signature/1` with a base64 signature over the digest of the manifest
 * FILE. v2 signs the digest of the canonical BODY and stores the signature as lowercase hex, the
 * encoding of `evidence_items.signature_value` (D-DB-03), so the three places that hold it agree
 * byte for byte. The schema id steps to `/2`; the v1 files are not touched.
 */
import { z } from 'zod';
import { canonicalJsonBytes } from './canonical';
import { EvidencePackageError, EvidencePackageRefusal } from './errors';
import { PackageFile } from './layout';
import { ManifestSignatureAlgorithm, type ManifestV2 } from './manifest';

export const DETACHED_SIGNATURE_V2_SCHEMA_ID = 'dems.detached-signature/2';
/** `signature.covers` (field 107): what the signed bytes are. */
export const MANIFEST_SIGNATURE_COVERS =
  'The 32 raw bytes of manifestSha256: SHA-256 of the canonical body of session-manifest.json (sorted keys, UTF-8, manifestSha256 set to null, signature.value left out)';

export const DetachedSignatureV2Schema = z.strictObject({
  schema: z.literal(DETACHED_SIGNATURE_V2_SCHEMA_ID),
  purpose: z.literal('SEAL'),
  algorithm: z.enum(ManifestSignatureAlgorithm),
  keyId: z.string().min(1),
  signedFile: z.literal(PackageFile.MANIFEST),
  digestAlgorithm: z.literal('SHA-256'),
  /** = the manifest's `manifestSha256` (spec §B.10; verify V-03). */
  signedDigest: z.string().regex(/^[0-9a-f]{64}$/),
  /** = the manifest's `signature.value`. */
  signature: z.string().regex(/^([0-9a-f]{2}){64,72}$/),
  signedAt: z.number().int().min(0),
  certificate: z.literal(PackageFile.CERTIFICATE),
  certificateSha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type DetachedSignatureV2 = z.output<typeof DetachedSignatureV2Schema>;

/** The `signature.sig` value of a sealed manifest: nothing in it that the manifest does not say. */
export function detachedSignatureOf(manifest: ManifestV2): DetachedSignatureV2 {
  return {
    schema: DETACHED_SIGNATURE_V2_SCHEMA_ID,
    purpose: 'SEAL',
    algorithm: manifest.signature.algorithm,
    keyId: manifest.signature.keyId,
    signedFile: PackageFile.MANIFEST,
    digestAlgorithm: 'SHA-256',
    signedDigest: manifest.manifestSha256,
    signature: manifest.signature.value,
    signedAt: manifest.signature.signedAt,
    certificate: PackageFile.CERTIFICATE,
    certificateSha256: manifest.signature.certificate.sha256,
  };
}

export function serializeDetachedSignature(signature: DetachedSignatureV2): Uint8Array {
  return canonicalJsonBytes(signature);
}

export function parseDetachedSignature(text: string): DetachedSignatureV2 {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new EvidencePackageError(EvidencePackageRefusal.SIGNATURE_FILE_INVALID, ['']);
  }
  const parsed = DetachedSignatureV2Schema.safeParse(value);
  if (!parsed.success) {
    throw new EvidencePackageError(EvidencePackageRefusal.SIGNATURE_FILE_INVALID, [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]);
  }
  return parsed.data;
}
