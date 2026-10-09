/**
 * Evidence signer (blueprint row 83 / M7-W2; register NM-08, CS-13; evidence package spec §C;
 * OD-04; SEC35-06, SEC35-07).
 *
 *   types.ts       the `Signer` interface (the seam a TPM / PKCS#11 adapter replaces, class C-8)
 *   host-key.ts    software Ed25519: the key at rest, provisioning, loading (fails closed),
 *                  the compromise mark; the ONE file with the file system and the cryptography
 *   der.ts         the self-signed certificate
 *   seal.ts        signing and checking a v2 manifest through the interface
 *   key-record.ts  CS-13: the real key record for the Security & Audit view
 *
 * What this unit does not do: it registers no route, logs nothing, reads no configuration and is
 * not called at boot yet. The sealing pipeline (row 82) and the boot checks (CS-22) are its callers.
 */
export { buildSelfSignedCertificate, certificateDer, certificatePem, subjectText, utcFields, type CertificateRequest, type CertificateSubject } from './der';
export {
  SIGNING_CERTIFICATE_VALIDITY_DAYS,
  fileWrapSecrets,
  loadSoftwareSigner,
  markSigningKeyCompromised,
  provisionSigningKey,
  readSigningCertificate,
  readStoredCertificate,
  verifyEd25519,
  type KeyStoreOptions,
  type LoadedSigner,
  type ProvisionOptions,
} from './host-key';
export { signingKeyRecords, type SecurityKeyRecord } from './key-record';
export {
  deviceCertificateBlock,
  signManifest,
  signatureBlock,
  verifyManifestSeal,
  type ManifestSignatureBlock,
  type SealVerification,
  type SealedManifest,
  type SignatureVerifier,
} from './seal';
export { CORE_EVIDENCE_SIGNING_KEY_ID, SignerError, SignerRefusal, type KeyWrapSecrets, type Signer, type SignerAlgorithm, type SigningCertificate } from './types';
