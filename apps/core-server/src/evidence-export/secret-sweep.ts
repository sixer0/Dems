/**
 * THE SECRET SWEEP of an export (blueprint row 91; evidence package spec §G.4 "Evidence export";
 * register E-31, CS-14; check M8-XAU-1).
 *
 * "No credential-shaped value is ever written into a signed package, its manifest, its audit
 * extract or the export manifest." The export job runs this sweep over every CLEAR TEXT file it
 * is about to hand out - the sealed manifest, the seal's signature file, `fragments.json`, the
 * audit extract, the transcript files, and the export manifest and signature it wrote itself -
 * BEFORE the artefact gets its final names. One hit fails the export closed
 * (`SECRET_SHAPE_FOUND`): nothing is handed out, the partial artefact is removed.
 *
 * WHAT IS LOOKED FOR (forms, not values):
 *
 *   CONTRACT_TOKEN   the credential forms of the contract: a session token, a device credential,
 *                    a biometric token, a pairing QR payload (`looksLikeSecret` of the core, the
 *                    rule every audit row is held to - SR-54)
 *   MEDIA_TOKEN      a signed media-session token: the prefix `mts_` (SEC35-13) and 16 or more
 *                    token characters
 *   URL_USERINFO     a URL that carries `user:password@` (the camera-credential form
 *                    `rtsp://user:pass@host`, SEC35-04; any scheme)
 *   PRIVATE_KEY      a PEM private-key block
 *
 * A finding names the file and the form. It never holds the text that matched, and nothing here
 * logs. The camera files are not swept: they are media, and the session key - 32 random bytes -
 * has no form a sweep could know (the tests of this unit, which know the key they made, search the
 * whole artefact for it).
 */
import { EVIDENCE_MEDIA_TOKEN_PREFIX } from '@dems/shared/api';
import { looksLikeSecret } from '../core';

export const SecretForm = {
  CONTRACT_TOKEN: 'CONTRACT_TOKEN',
  MEDIA_TOKEN: 'MEDIA_TOKEN',
  URL_USERINFO: 'URL_USERINFO',
  PRIVATE_KEY: 'PRIVATE_KEY',
} as const;
export type SecretForm = (typeof SecretForm)[keyof typeof SecretForm];

export interface SecretFinding {
  readonly file: string;
  readonly form: SecretForm;
}

const MEDIA_TOKEN = new RegExp(`(?:^|[^A-Za-z0-9_-])${EVIDENCE_MEDIA_TOKEN_PREFIX}[A-Za-z0-9_-]{16,}`);
const URL_USERINFO = /[A-Za-z][A-Za-z0-9+.-]{1,15}:\/\/[^\s/@:"']{1,128}:[^\s/@"']{1,256}@/;
const PRIVATE_KEY = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/;

/** The credential forms one text holds, each at most once, in a fixed order. */
export function secretFormsIn(text: string): readonly SecretForm[] {
  const found: SecretForm[] = [];
  if (looksLikeSecret(text)) found.push(SecretForm.CONTRACT_TOKEN);
  if (MEDIA_TOKEN.test(text)) found.push(SecretForm.MEDIA_TOKEN);
  if (URL_USERINFO.test(text)) found.push(SecretForm.URL_USERINFO);
  if (PRIVATE_KEY.test(text)) found.push(SecretForm.PRIVATE_KEY);
  return found;
}

/** The findings of a set of clear text files, in the order of the files. Empty: the sweep is clean. */
export function sweepForSecrets(files: ReadonlyArray<{ readonly file: string; readonly text: string }>): readonly SecretFinding[] {
  return files.flatMap(({ file, text }) => secretFormsIn(text).map((form) => ({ file, form })));
}
