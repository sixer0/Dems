/**
 * Signing a v2 manifest (evidence package spec §B.9, §B.10, §C.1; sealing step `SIGN_MANIFEST`).
 * No key material here: this file works through the `Signer` interface and a verify function.
 *
 *   signatureBlock(signing, certificate, signedAt)  -> the manifest's `signature` member without
 *                                                     its value (needed BEFORE the hash: every
 *                                                     member but the value is under the signature)
 *   signManifest(signing, unsigned)                 -> the sealed manifest and the `signature.sig` value
 *   verifyManifestSeal(manifest, publicKey)        -> hash and signature of a manifest value
 *
 * The signed message is the 32 raw bytes of `manifestSha256`. Ed25519 is deterministic, so
 * signing the same digest again after a restart gives the same bytes (§E.1 resume rule).
 */
import {
  MANIFEST_SIGNATURE_COVERS,
  PackageFile,
  attachSignature,
  computeManifestSha256,
  detachedSignatureOf,
  manifestSignedMessage,
  type DetachedSignatureV2,
  type ManifestV2,
  type UnsignedManifestV2,
} from '@dems/shared/evidence-package';
import { SignerError, SignerRefusal, type Signer, type SigningCertificate } from './types';

export type ManifestSignatureBlock = UnsignedManifestV2['signature'];

/** The `signature` member of an unsigned manifest for this signer and certificate. */
export function signatureBlock(signing: Signer, certificate: SigningCertificate, signedAt: number): ManifestSignatureBlock {
  if (certificate.keyId !== signing.keyId) throw new SignerError(SignerRefusal.SIGNER_MISMATCH, signing.keyId);
  return {
    algorithm: signing.algorithm,
    keyId: signing.keyId,
    simulated: false,
    file: PackageFile.SIGNATURE,
    covers: MANIFEST_SIGNATURE_COVERS,
    certificate: { file: PackageFile.CERTIFICATE, sha256: certificate.sha256 },
    signedAt,
  };
}

/** The manifest's `device.certificate` member (fields 25-27) for this certificate. */
export function deviceCertificateBlock(certificate: SigningCertificate): { subject: string; serialNumber: string; sha256: string } {
  return { subject: certificate.subject, serialNumber: certificate.serialNumber, sha256: certificate.sha256 };
}

export type SignatureVerifier = (publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array) => boolean;

export interface SealedManifest {
  readonly manifest: ManifestV2;
  /** The value of `signature.sig`. */
  readonly detached: DetachedSignatureV2;
}

/**
 * `SIGN_MANIFEST`. Refuses a manifest that names another key or algorithm, and a signature that
 * does not verify with the signer's own public key (a broken signer never yields a sealed
 * manifest). Nothing is written anywhere: the caller stores the result.
 */
export async function signManifest(signing: Signer, unsigned: UnsignedManifestV2, verifier: SignatureVerifier): Promise<SealedManifest> {
  if (unsigned.signature.keyId !== signing.keyId || unsigned.signature.algorithm !== signing.algorithm) {
    throw new SignerError(SignerRefusal.SIGNER_MISMATCH, signing.keyId);
  }
  const message = manifestSignedMessage(unsigned.manifestSha256);
  let signature: Uint8Array;
  try {
    signature = await signing.sign(message);
  } catch (error) {
    // Row 226b: a refusal the signer NAMED (the key was marked compromised or is no longer the active
    // one while this Core runs) keeps its name - a code and a key id, nothing else. Anything else a
    // signer throws stays the one code, its text dropped.
    if (error instanceof SignerError) throw error;
    throw new SignerError(SignerRefusal.SIGNATURE_FAILED, signing.keyId);
  }
  if (!verifier(signing.publicKey(), message, signature)) throw new SignerError(SignerRefusal.SIGNATURE_FAILED, signing.keyId);
  const manifest = attachSignature(unsigned, signature);
  return Object.freeze({ manifest, detached: detachedSignatureOf(manifest) });
}

export interface SealVerification {
  /** The recorded `manifestSha256` is the hash of the canonical body (verify V-03). */
  readonly hashOk: boolean;
  /** The signature verifies over the recorded digest with that public key (verify V-09). */
  readonly signatureOk: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Hash and signature of a manifest VALUE (it need not be schema-valid: a tampered one is what
 * this is for). The two results are independent on purpose: changing a field breaks the hash;
 * recomputing the hash to hide it breaks the signature (spec §C.1).
 */
export function verifyManifestSeal(manifest: unknown, publicKey: Uint8Array, verifier: SignatureVerifier): SealVerification {
  if (!isRecord(manifest) || !isRecord(manifest.signature)) return { hashOk: false, signatureOk: false };
  const recorded = manifest.manifestSha256;
  const value = manifest.signature.value;
  let hashOk = false;
  let signatureOk = false;
  try {
    hashOk = typeof recorded === 'string' && computeManifestSha256(manifest) === recorded;
    if (typeof recorded === 'string' && typeof value === 'string' && /^([0-9a-f]{2})+$/.test(value)) {
      signatureOk = verifier(publicKey, manifestSignedMessage(recorded), Uint8Array.from(Buffer.from(value, 'hex')));
    }
  } catch {
    return { hashOk: false, signatureOk: false };
  }
  return { hashOk, signatureOk };
}
