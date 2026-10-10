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
 * IN THIS FOLDER: that is a deployment act with its own runbook (row 83's note, §3).
 *
 * Nothing here prints, logs or returns key material; a failure is a code of the signer.
 */
import { join } from 'node:path';
import { CORE_EVIDENCE_SIGNING_KEY_ID, loadSoftwareSigner, provisionSigningKey, type LoadedSigner, type SigningCertificate } from '../capture';

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

/**
 * Makes the development key and its certificate under `<dataDir>/signer` (owner-only directory and
 * key file: row 83's store). Refuses with the signer's `KEY_EXISTS` when anything of that key ID
 * is there - a key is never replaced. Returns the certificate: public data only.
 */
export function provisionDevelopmentSigningKey(options: { readonly dataDir: string; readonly now: number }): SigningCertificate {
  return provisionSigningKey({ dir: sealingSignerDir(options.dataDir), now: options.now, keyId: CORE_EVIDENCE_SIGNING_KEY_ID, subject: { organizationalUnit: DEVELOPMENT_KEY_UNIT } });
}
