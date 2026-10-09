/**
 * The manifest's own hash and the signed bytes (spec §B.10, §C.1).
 *
 *   canonical body  = the manifest with `manifestSha256` set to null and `signature.value` left
 *                     out, as canonical JSON (sorted keys, UTF-8)
 *   manifestSha256  = SHA-256(canonical body), 64 lowercase hex
 *   signed message  = the 32 raw bytes of that digest
 *
 * The two exclusions are the only ones: every other member, the source-class fields 124-128
 * included, is inside the digest and so under the signature.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { canonicalJsonBytes } from './canonical';
import { EvidencePackageError, EvidencePackageRefusal } from './errors';

/** Lowercase hex SHA-256 of bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The canonical body of a manifest value. It takes any JSON object with a `signature` object, so a
 * verifier can hash a manifest it has not validated yet (and one that was altered).
 */
export function manifestCanonicalBody(manifest: unknown): Uint8Array {
  if (!isRecord(manifest)) throw new EvidencePackageError(EvidencePackageRefusal.MANIFEST_INVALID, ['']);
  const signature = manifest.signature;
  if (!isRecord(signature)) throw new EvidencePackageError(EvidencePackageRefusal.MANIFEST_INVALID, ['signature']);
  const { value: _excluded, ...signatureBody } = signature;
  return canonicalJsonBytes({ ...manifest, manifestSha256: null, signature: signatureBody });
}

/** `manifestSha256` of a manifest value: 64 lowercase hex. */
export function computeManifestSha256(manifest: unknown): string {
  return bytesToHex(sha256(manifestCanonicalBody(manifest)));
}

/** The message a `Signer` signs for a seal: the 32 raw digest bytes (spec §C.1). */
export function manifestSignedMessage(manifestSha256: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(manifestSha256)) throw new EvidencePackageError(EvidencePackageRefusal.MANIFEST_INVALID, ['manifestSha256']);
  return hexToBytes(manifestSha256);
}

/** True when the manifest's recorded `manifestSha256` is the hash of its canonical body (V-03, first half). */
export function manifestHashMatches(manifest: unknown): boolean {
  return isRecord(manifest) && typeof manifest.manifestSha256 === 'string' && manifest.manifestSha256 === computeManifestSha256(manifest);
}

/** The bytes of `session-manifest.json`: the canonical JSON of the whole manifest. */
export function serializeManifest(manifest: unknown): Uint8Array {
  return canonicalJsonBytes(manifest);
}
