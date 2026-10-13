/**
 * WHERE THE SEALING PIPELINE TAKES ITS SIGNING KEY FROM (blueprint row 82; controller ruling D138;
 * evidence package spec §C.2, §C.3; row 83's decision D-83-7).
 *
 * ONE LOCATION. The evidence signing key lives in `<dataDir>/signer` - the directory the capture
 * boot check reads (`SIGNING_STORE_SUBPATH` of `src/capture/boot/checks.ts`: a real-mode boot is
 * refused with `KEY_ABSENT` when no key is there). The pipeline loads the SAME directory through
 * row 83's `loadSoftwareSigner`, so the key the boot check accepted is the key that signs. The
 * two names are held equal by a test of this folder (`signing.test.ts`), which fails when either
 * side moves.
 *
 * A DEVELOPMENT KEY, AND ONLY THAT. `provisionDevelopmentSigningKey` makes a throw-away key for a
 * developer's machine. Its certificate says so in its SUBJECT - the organizational unit is
 * `DEVELOPMENT_KEY_UNIT` - and that subject is copied into every manifest the key signs (field
 * 25, `device.certificate.subject`, inside the signed digest) and stands in
 * `device-certificate.pem`. A package signed with it can therefore never read as signed by a
 * production key, whatever its source classes say. NO PRODUCTION KEY IS PROVISIONED BY ANYTHING
 * IN THIS FOLDER: that is a deployment act with its own runbook (row 83's note, §3), done by a
 * person at the host with the command of `cli/production-key-command.ts` (task 4 row 206), which
 * lies outside `src/` and is never loaded by the server.
 *
 * WHICH KEY OF THE DIRECTORY (task 4 row 225; SX-09 (a)). `loadSealingSigner` hands the store NO key
 * id: the store answers with its ACTIVE key (`activeSigningKeyId` of the signer store - the first
 * id for a store without a pointer), exactly as it does for boot checks 4 and 4b. Nothing in this
 * folder names a key id for a load; a test of this folder (`active-key-call-sites.test.ts`) fails
 * when a taker does.
 *
 * Nothing here prints, logs or returns key material; a failure is a code of the signer.
 */
import { join } from 'node:path';
import { CORE_EVIDENCE_SIGNING_KEY_ID, loadSoftwareSigner, provisionSigningKey, readRetainedCertificates, type LoadedSigner, type RetainedCertificateSet, type SigningCertificate } from '../capture';

/** `<dataDir>/signer`. Equal to the boot check's `SIGNING_STORE_SUBPATH` (held by `signing.test.ts`). */
export const SEALING_SIGNER_SUBPATH = 'signer';

/** The organizational unit of a development key's certificate subject. Never the unit of a production key. */
export const DEVELOPMENT_KEY_UNIT = 'DEVELOPMENT KEY - NOT FOR PRODUCTION';

export function sealingSignerDir(dataDir: string): string {
  return join(dataDir, SEALING_SIGNER_SUBPATH);
}

/** The signer of the sealing pipeline. Fails closed with a `SignerError`; creates nothing. */
export function loadSealingSigner(options: { readonly dataDir: string; readonly now: number }): LoadedSigner {
  return loadSoftwareSigner({ dir: sealingSignerDir(options.dataDir), now: options.now });
}

/** True for a certificate made by `provisionDevelopmentSigningKey` (its subject text carries the unit). */
export function isDevelopmentSigningCertificate(certificate: Pick<SigningCertificate, 'subject'>): boolean {
  return certificate.subject.includes(`OU=${DEVELOPMENT_KEY_UNIT}`);
}

/** What the Core's own verify holds a package's certificate to (task 4 row 227; SX-09 (c), (d)). */
export interface SealingVerifyTrust {
  /** SHA-256 of every retained certificate the Core trusts as it stands. */
  readonly trusted: readonly string[];
  /**
   * SHA-256 of every retained certificate whose key was MARKED COMPROMISED. Never in `trusted`:
   * a package under one of them is never a plain pass (`evidence-verify`, "UNDER A COMPROMISED KEY").
   */
  readonly compromised: readonly string[];
}

const NOTHING_TRUSTED: SealingVerifyTrust = Object.freeze({ trusted: Object.freeze([]), compromised: Object.freeze([]) });

/**
 * THE TRUST SET OF THE CORE'S OWN VERIFY (task 4 row 227, package X1-4; Known limit 30): the retained
 * certificates of `<dataDir>/signer` - every key that is or was the active one - so that a package
 * sealed before a rotation still verifies after it. Each certificate was parsed and its
 * self-signature verified by the store before it is listed here (`readRetainedCertificates`).
 *
 *   - `production: true` (a `REAL_PRODUCTION` Core): a certificate with the DEVELOPMENT mark is in
 *     NEITHER list - never trusted, whatever else is true of it;
 *   - a certificate whose key carries the compromise mark is in `compromised`, never in `trusted`.
 *
 * FAIL CLOSED: a store that cannot be taken (its directory, or a pointer that cannot be read)
 * trusts nothing - both lists are empty and V-13 fails by name. Reads public files only; no key
 * is opened; nothing is printed, logged or returned but certificate digests.
 */
export function sealingVerifyTrust(options: { readonly dataDir: string; readonly production: boolean }): SealingVerifyTrust {
  let retained: RetainedCertificateSet;
  try {
    retained = readRetainedCertificates({ dir: sealingSignerDir(options.dataDir) });
  } catch {
    return NOTHING_TRUSTED;
  }
  const trusted = new Set<string>();
  const compromised = new Set<string>();
  for (const entry of retained.certificates) {
    if (options.production && isDevelopmentSigningCertificate(entry.certificate)) continue;
    (entry.compromised ? compromised : trusted).add(entry.certificate.sha256);
  }
  // One certificate cannot be both: the mark wins.
  for (const digest of compromised) trusted.delete(digest);
  return Object.freeze({ trusted: Object.freeze([...trusted]), compromised: Object.freeze([...compromised]) });
}

/**
 * Makes the development key and its certificate under `<dataDir>/signer` (owner-only directory and
 * key file: row 83's store). Refuses with the signer's `KEY_EXISTS` when anything of that key ID
 * is there - a key is never replaced. Returns the certificate: public data only.
 */
export function provisionDevelopmentSigningKey(options: { readonly dataDir: string; readonly now: number }): SigningCertificate {
  return provisionSigningKey({ dir: sealingSignerDir(options.dataDir), now: options.now, keyId: CORE_EVIDENCE_SIGNING_KEY_ID, subject: { organizationalUnit: DEVELOPMENT_KEY_UNIT } });
}
