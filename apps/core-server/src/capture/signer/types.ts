/**
 * The `Signer` seam (blueprint row 83; evidence package spec §C.1, §C.3; OD-04).
 *
 * The sealing pipeline and the transcript revisions sign through this interface and nothing else.
 * Today one implementation exists: software Ed25519 (`host-key.ts`). A TPM / PKCS#11 adapter
 * (class C, C-8) is a second implementation with `algorithm = 'ECDSA-P256-SHA256'`; nothing above
 * this interface changes when it arrives, and the database CHECK already names its algorithm.
 */

/** The Core's evidence signing key on this machine (spec §C.1). The v1 demo key has another id. */
export const CORE_EVIDENCE_SIGNING_KEY_ID = 'CORE-KEY-EVSIGN-01';

export type SignerAlgorithm = 'Ed25519' | 'ECDSA-P256-SHA256';

export interface Signer {
  readonly algorithm: SignerAlgorithm;
  readonly keyId: string;
  /** Signs the message and returns the raw signature bytes. */
  sign(message: Uint8Array): Promise<Uint8Array> | Uint8Array;
  /** The public key for the certificate and verification. */
  publicKey(): Uint8Array;
}

/** The public certificate of a signing key. Public data only. */
export interface SigningCertificate {
  readonly keyId: string;
  /** The bytes of `device-certificate.pem`. */
  readonly pemText: string;
  /** SHA-256 of the DER bytes, 64 lowercase hex (manifest fields 27 and 109). */
  readonly sha256: string;
  /** Manifest field 25. */
  readonly subject: string;
  /** Manifest field 26: uppercase hex. */
  readonly serialNumber: string;
  /** Epoch milliseconds. */
  readonly notBefore: number;
  readonly notAfter: number;
  /** The raw 32-byte Ed25519 public key the certificate carries. */
  readonly publicKey: Uint8Array;
}

/**
 * Where the secret that wraps the private-key file is kept. The key file is encrypted at rest
 * (SEC35-07); this is the other half. The built-in source is a private file; the Core credential
 * store (row 84) or an OS keychain can stand here instead without any change to the signer.
 */
export interface KeyWrapSecrets {
  /** The secret of that key id, or null when there is none. */
  get(keyId: string): Uint8Array | null;
  /** Stores a new secret. Must refuse to replace an existing one. */
  put(keyId: string, secret: Uint8Array): void;
}

export const SignerRefusal = {
  /** No private-key file, or no wrap secret: boot fails closed (CS-22). */
  KEY_ABSENT: 'KEY_ABSENT',
  /** A key or secret file that group or others can reach. Nothing was read. */
  KEY_MODE: 'KEY_MODE',
  /** The key file cannot be read or does not open with the wrap secret. */
  KEY_UNREADABLE: 'KEY_UNREADABLE',
  /** The key was marked compromised: it signs nothing (runbook step a). */
  KEY_COMPROMISED: 'KEY_COMPROMISED',
  /** Provisioning never replaces a key. */
  KEY_EXISTS: 'KEY_EXISTS',
  /** The certificate is absent, unreadable, not self-consistent or not of this key. */
  CERTIFICATE_INVALID: 'CERTIFICATE_INVALID',
  /** The certificate's validity does not cover the instant asked for. */
  CERTIFICATE_NOT_VALID_NOW: 'CERTIFICATE_NOT_VALID_NOW',
  /** A key id that is not a plain identifier. */
  KEY_ID_INVALID: 'KEY_ID_INVALID',
  /** The manifest names another key or algorithm than the signer's. */
  SIGNER_MISMATCH: 'SIGNER_MISMATCH',
  /** The signer returned something that does not verify. */
  SIGNATURE_FAILED: 'SIGNATURE_FAILED',
} as const;
export type SignerRefusal = (typeof SignerRefusal)[keyof typeof SignerRefusal];

/** A code and a key id. No message of this unit holds a location, a secret or key material. */
export class SignerError extends Error {
  readonly code: SignerRefusal;
  readonly keyId: string | null;
  constructor(code: SignerRefusal, keyId: string | null = null) {
    super(keyId === null ? code : `${code} (${keyId})`);
    this.name = 'SignerError';
    this.code = code;
    this.keyId = keyId;
  }
}
