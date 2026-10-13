/**
 * `npm run evidence:rotate-key -w @dems/core-server -- --data-dir <absolute directory>`
 * (task 4 row 226, package X1-4; decisions U19, U20, UD-5; security review SX-09 (e); the
 * requirements R-X1-1 to R-X1-8 of the production key command, for the NEW key).
 *
 * WHAT IT DOES. It makes a NEW evidence signing key under `<data directory>/signer` and makes it
 * the ACTIVE one. The new key gets the NEXT key id of the series - the one after the highest the
 * store has ever named, so a key id is never used for a second key - and is provisioned by the
 * rules of the production key command (row 206): the same directory rule, the same two typed
 * values under the same forms, a software Ed25519 key made by the signer store with the store's
 * own source of chance, a self-signed certificate that states organisation and installation. It
 * becomes active through the pointer of row 225, written by the store in one step
 * (`activateSigningKey`: a staged file, synced, ONE rename, the directory synced).
 *
 * WHAT IT NEVER DOES. Nothing of the earlier key is changed, replaced, removed or renamed: its key
 * file, its certificate and a compromise mark stay where they are, and the earlier certificate is
 * read again at the end to say so. Nothing that was sealed is rewritten. The only name whose
 * content changes is the pointer's. This file holds no call that removes, renames, cuts or copies
 * a file and imports no cryptography module; every byte of key material is made, written and read
 * by the signer store and never crosses into this file (asserted by the command's test).
 *
 * WHEN IT IS THE WAY OUT. The active key loads (a routine rotation before the certificate ends),
 * or it does not load because it is marked compromised, its certificate does not cover now, or its
 * files are gone or unreadable. It REFUSES a store whose pointer cannot be taken (it never repairs
 * a pointer), a store that group or others can reach, a store with nothing of an active key (the
 * first key is the production key command's), and a DEVELOPMENT store.
 *
 * THE DATABASE: NOT TOUCHED. The command opens no connection and reads no connection file, so
 * there is nothing a connected Core could be tested by; it CANNOT see a running Core. A running
 * Core keeps the signer it loaded until it is started again: the summary says to stop it first.
 *
 * THE ORDER. Everything that can refuse runs before anything is made; after the new key exists
 * nothing is removed - a failure names the state and leaves it to the installer:
 *
 *   1. arguments (`--data-dir` only)                                        -> exit 2
 *   2. the caller (never uid 0)   3. the directory rule of row 206
 *   4. the store: the pointer can be taken, an active key is there, it is no development key
 *   5. the next key id            6. the two typed values     7. the summary and the word `ROTATE`
 *      (row K6: 4 and 5 are everything the store can refuse a rotation for, and both end BEFORE the
 *      first prompt; an installation id of the boot checks' closed reserved list, decision C86, is
 *      refused as soon as it is typed, `INSTALLATION_ID_RESERVED`)
 *   8. the new key is provisioned, re-read as written (0700, 0600, 0600, 0644; the caller's) and
 *      LOADED by its id; its subject is the expected text, exactly
 *   9. the pointer is moved; the Core's own loader (`loadSealingSigner`: boot checks 4 and 4b, the
 *      seal) must now answer with the new key
 *  10. the two records of the new key (public facts only)
 *
 * A stop between 8 and 9 leaves a new key that is NOT active and the earlier one in force: the
 * next run takes the id after it. A stop inside 9 leaves the earlier pointer or the new one, whole.
 */
import { mkdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isDevelopmentKeySubject } from '@dems/shared/evidence-verify';
import {
  SIGNING_CERTIFICATE_VALIDITY_DAYS,
  SignerError,
  activateSigningKey,
  activeSigningKeyId,
  loadSoftwareSigner,
  nextSigningKeyId,
  provisionSigningKey,
  readStoredCertificate,
  subjectText,
  type SigningCertificate,
} from '../src/capture';
import { ENV_INSTALLATION_DEVICE_ID } from '../src/config';
import { isDevelopmentSigningCertificate, loadSealingSigner, sealingSignerDir } from '../src/sealing/signing';
import { CORE_SERVER_VERSION } from '../src/version';
import {
  HANDOVER_SUBPATH,
  ORGANISATION_MAX_LENGTH,
  ORGANISATION_MIN_LENGTH,
  PRODUCTION_KEY_COMMAND,
  PRODUCTION_KEY_UNIT_PREFIX,
  RESERVED_INSTALLATION_ID_NOTE,
  SELF_SIGNED_LIMITS,
  directoryRefusal,
  handoverRecordText,
  inspectEntry,
  installationDeviceIdOf,
  installationIdIsReserved,
  organisationOf,
  utcText,
  writeRecord,
  type EntryFacts,
  type ProductionKeyPorts,
  type ProductionKeyRefusal,
} from './production-key-command';

export const ROTATE_KEY_COMMAND = 'evidence:rotate-key';
/** The word the installer types before any new key exists. */
export const ROTATE_WORD = 'ROTATE';

export const RotateKeyExit = { ROTATED: 0, REFUSED: 1, USAGE: 2 } as const;
export type RotateKeyExit = (typeof RotateKeyExit)[keyof typeof RotateKeyExit];

/** Why the rotation refused, beside the words of the directory rule (`ProductionKeyRefusal`). */
export const RotateKeyRefusal = {
  ROOT_REFUSED: 'ROOT_REFUSED',
  USER_UNKNOWN: 'USER_UNKNOWN',
  /** No signer store: the first key of an installation is made by the production key command. */
  NO_STORE: 'NO_STORE',
  /** The store refuses to say which key is active (the pointer cannot be taken, or the directory is not private). Never repaired here. */
  STORE_REFUSED: 'STORE_REFUSED',
  /** Nothing of the active key id is in the store: there is no key to rotate from. */
  NOTHING_TO_ROTATE: 'NOTHING_TO_ROTATE',
  /** The active key is a development key: a production installation uses its own data directory. */
  DEVELOPMENT_STORE: 'DEVELOPMENT_STORE',
  /** The active key does not load for a reason a rotation is no answer to (others can reach the store). */
  ACTIVE_KEY_STATE: 'ACTIVE_KEY_STATE',
  KEY_SERIES_EXHAUSTED: 'KEY_SERIES_EXHAUSTED',
  /** A record of the next key id is there and no key is: nothing is replaced. */
  RECORD_EXISTS: 'RECORD_EXISTS',
  NOT_A_TERMINAL: 'NOT_A_TERMINAL',
  ORGANISATION_REFUSED: 'ORGANISATION_REFUSED',
  INSTALLATION_ID_REFUSED: 'INSTALLATION_ID_REFUSED',
  /** The typed installation id is one of the closed list the boot checks reserve for tests and demonstration data (decision C86). */
  INSTALLATION_ID_RESERVED: 'INSTALLATION_ID_RESERVED',
  NOT_CONFIRMED: 'NOT_CONFIRMED',
  /** The store did not make the new key. */
  NOT_PROVISIONED: 'NOT_PROVISIONED',
  STORE_NOT_AS_WRITTEN: 'STORE_NOT_AS_WRITTEN',
  LOAD_FAILED: 'LOAD_FAILED',
  SUBJECT_MISMATCH: 'SUBJECT_MISMATCH',
  /** The new key exists and loads; the pointer was not moved. The earlier key is still the active one. */
  NOT_ACTIVATED: 'NOT_ACTIVATED',
  /** The pointer was moved and the Core's loader does not answer with the new key. */
  ACTIVE_KEY_NOT_NEW: 'ACTIVE_KEY_NOT_NEW',
  /** The earlier certificate does not read as it did before the rotation. */
  EARLIER_CERTIFICATE_CHANGED: 'EARLIER_CERTIFICATE_CHANGED',
  RECORD_NOT_WRITTEN: 'RECORD_NOT_WRITTEN',
} as const;
export type RotateKeyRefusal = (typeof RotateKeyRefusal)[keyof typeof RotateKeyRefusal] | ProductionKeyRefusal;

/** The ports of the production key command: a clock, the caller, one echoed line, the output, the entry facts. */
export type RotateKeyPorts = ProductionKeyPorts;

export interface RotateKeyRun {
  readonly code: RotateKeyExit;
  readonly lines: readonly string[];
  /** The refusal, or null when the key was rotated or the arguments were not usable. */
  readonly refusal: RotateKeyRefusal | null;
}

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const PUBLIC_FILE_MODE = 0o644;
const PERMISSION_BITS = 0o777;
const DAY_MS = 86_400_000;
const USAGE = `${ROTATE_KEY_COMMAND}: usage: ${ROTATE_KEY_COMMAND} --data-dir <absolute directory> (no other option; the directory is written in full, without a link and without a trailing separator)`;

/** The states of an active key a rotation is the answer to. Every other reason of the loader is refused. */
const ROTATABLE_STATES: readonly string[] = ['KEY_COMPROMISED', 'CERTIFICATE_NOT_VALID_NOW', 'KEY_ABSENT', 'KEY_UNREADABLE', 'CERTIFICATE_INVALID'];

/** What a rotation does and does not do. Printed before the word and after the rotation. */
export const ROTATION_NOTES: readonly string[] = Object.freeze([
  'STOP the Core of this data directory first: a running Core does not go over to the new key - it signs nothing (ACTIVE_KEY_CHANGED) until it is started again, and this command cannot see a process.',
  'Nothing of the earlier key is changed, removed or renamed, and nothing that was sealed is rewritten.',
  'Packages sealed with the earlier key are verified against the EARLIER certificate: keep it, and keep its fingerprint with the installation papers.',
  'The command reads and writes no database.',
]);

/** The name of the provisioning record and of the hand-over record of a key id. */
export const provisioningRecordNameOf = (keyId: string): string => `${keyId}.provisioned.json`;
export const handoverRecordNameOf = (keyId: string): string => `${keyId}.handover.txt`;

const codeOf = (error: unknown): string => (error instanceof SignerError ? error.code : 'UNREADABLE');

function rotationRecordText(certificate: SigningCertificate, earlier: { readonly keyId: string; readonly certificateSha256: string | null; readonly state: string }, rotatedAt: number, uid: number): string {
  return `${JSON.stringify(
    {
      record: 'DEMS_EVIDENCE_SIGNING_KEY_ROTATED',
      note: 'A note of the installer, not evidence: this file can be rewritten by the user of the Core and no check reads it.',
      keyId: certificate.keyId,
      algorithm: 'Ed25519',
      selfSigned: true,
      certificateSha256: certificate.sha256,
      subject: certificate.subject,
      serialNumber: certificate.serialNumber,
      notBefore: utcText(certificate.notBefore),
      notAfter: utcText(certificate.notAfter),
      rotatedAt: utcText(rotatedAt),
      earlierKeyId: earlier.keyId,
      earlierCertificateSha256: earlier.certificateSha256,
      earlierKeyState: earlier.state,
      command: ROTATE_KEY_COMMAND,
      commandVersion: CORE_SERVER_VERSION,
      uid,
    },
    null,
    2,
  )}\n`;
}

/** The command without a process: arguments and ports in, an exit code and the lines out. Never throws. */
export async function runRotateKeyCommand(args: readonly string[], ports: RotateKeyPorts): Promise<RotateKeyRun> {
  const lines: string[] = [];
  const say = (...text: string[]): void => {
    for (const line of text) {
      lines.push(line);
      ports.out(line);
    }
  };
  const refuse = (refusal: RotateKeyRefusal, ...detail: string[]): RotateKeyRun => {
    say(`${ROTATE_KEY_COMMAND}: REFUSED, ${refusal}`, ...detail);
    return { code: RotateKeyExit.REFUSED, lines, refusal };
  };
  const inspect: (path: string) => EntryFacts | null = ports.inspect ?? inspectEntry;
  const R = RotateKeyRefusal;

  // 1. The arguments.
  let dataDir: string;
  try {
    const parsed = parseArgs({ args: [...args], options: { 'data-dir': { type: 'string' } }, strict: true, allowPositionals: false });
    const given = parsed.values['data-dir'];
    if (given === undefined || given === '' || !isAbsolute(given) || resolve(given) !== given) throw new Error('usage');
    dataDir = given;
  } catch {
    say(USAGE);
    return { code: RotateKeyExit.USAGE, lines, refusal: null };
  }

  // 2. The caller.
  const uid = ports.uid();
  if (uid === 0) return refuse(R.ROOT_REFUSED, '  Run it as the OS user the Core runs as, never as root.');
  if (!Number.isSafeInteger(uid) || uid < 0) return refuse(R.USER_UNKNOWN);

  // 3. The directory rule of the production key command. Nothing has been made yet, and a refusal makes nothing.
  const directory = directoryRefusal(dataDir, uid, inspect);
  if (directory !== null) {
    return refuse(directory, '  The data directory must exist as a real directory of the calling user (no link), not writable by group or others, below directories of root or that user that group and others cannot write.');
  }
  const signerDir = sealingSignerDir(dataDir);
  const handoverDir = join(dataDir, HANDOVER_SUBPATH);

  // 4. The store: which key is active, in what state, and whether a rotation is the answer to it.
  if (inspect(signerDir) === null) return refuse(R.NO_STORE, `  There is no signer store here. The first key of an installation is made by ${PRODUCTION_KEY_COMMAND}.`);
  let earlierKeyId: string;
  try {
    earlierKeyId = activeSigningKeyId({ dir: signerDir });
  } catch (error) {
    return refuse(
      R.STORE_REFUSED,
      `  the store says: ${codeOf(error)}`,
      '  The store does not say which key is active. This command never repairs, replaces or removes a pointer it cannot take:',
      '  what the entry is and how it came there is for the installer to find out, at the host.',
    );
  }
  let earlierState = 'loads';
  try {
    loadSealingSigner({ dataDir, now: ports.now() });
  } catch (error) {
    earlierState = codeOf(error);
  }
  let earlier: SigningCertificate | null = null;
  try {
    earlier = readStoredCertificate({ dir: signerDir, keyId: earlierKeyId });
  } catch {
    earlier = null;
  }
  const earlierEntries = ['p8', 'wrap', 'crt', 'compromised'].filter((extension) => inspect(join(signerDir, `${earlierKeyId}.${extension}`)) !== null);
  if (earlierEntries.length === 0) return refuse(R.NOTHING_TO_ROTATE, `  Nothing of the active key id ${earlierKeyId} is in the store. The first key of an installation is made by ${PRODUCTION_KEY_COMMAND}.`);
  if (earlier !== null && (isDevelopmentKeySubject(earlier.subject) || isDevelopmentSigningCertificate(earlier))) {
    return refuse(R.DEVELOPMENT_STORE, '  The active key is a DEVELOPMENT key: a production installation uses its own data directory.');
  }
  if (earlierState !== 'loads' && !ROTATABLE_STATES.includes(earlierState)) {
    return refuse(R.ACTIVE_KEY_STATE, `  the active key ${earlierKeyId} does not load: ${earlierState}`, '  A new key is no answer to this state of the store: put the store right first.');
  }

  // 5. The next key id: the one after the highest the store has ever named.
  let keyId: string;
  try {
    keyId = nextSigningKeyId({ dir: signerDir });
  } catch (error) {
    return refuse(codeOf(error) === R.KEY_SERIES_EXHAUSTED ? R.KEY_SERIES_EXHAUSTED : R.STORE_REFUSED, `  the store says: ${codeOf(error)}`);
  }
  if (inspect(join(handoverDir, handoverRecordNameOf(keyId))) !== null) return refuse(R.RECORD_EXISTS, `  A hand-over record of ${keyId} is there and no key is. Nothing is replaced.`);

  // 6. The two typed values, under the forms of the production key command. Neither is a secret; a refused value is not repeated.
  if (earlier !== null) say(`${ROTATE_KEY_COMMAND}: the active key is ${earlierKeyId}`, `  subject:           ${earlier.subject}`);
  const typedOrganisation = await ports.ask(`Organisation of the NEW key (${ORGANISATION_MIN_LENGTH} to ${ORGANISATION_MAX_LENGTH} characters: ASCII letters, digits, space, hyphen, full stop): `);
  if (typedOrganisation === null) return refuse(R.NOT_A_TERMINAL, '  The command is run by a person at a terminal of the Core host.');
  const organisation = organisationOf(typedOrganisation);
  if (organisation === null) return refuse(R.ORGANISATION_REFUSED);
  const typedId = await ports.ask(`Installation device id (exactly the value of ${ENV_INSTALLATION_DEVICE_ID}): `);
  if (typedId === null) return refuse(R.NOT_A_TERMINAL, '  The command is run by a person at a terminal of the Core host.');
  const installationDeviceId = installationDeviceIdOf(typedId);
  if (installationDeviceId === null) return refuse(R.INSTALLATION_ID_REFUSED);
  // Row K6 (decision C86): an id of the boot checks' closed list is refused as it is typed - a production start would refuse the installation.
  if (installationIdIsReserved(installationDeviceId)) return refuse(R.INSTALLATION_ID_RESERVED, ...RESERVED_INSTALLATION_ID_NOTE);
  const organizationalUnit = `${PRODUCTION_KEY_UNIT_PREFIX} ${installationDeviceId}`;
  const expectedSubject = subjectText({ organization: organisation, organizationalUnit, commonName: keyId });
  if (isDevelopmentKeySubject(expectedSubject) || isDevelopmentSigningCertificate({ subject: expectedSubject })) return refuse(R.ORGANISATION_REFUSED);

  // 7. The summary and the word.
  const now = ports.now();
  const earlierLines = [
    `  earlier key id:      ${earlierKeyId} (${earlierState === 'loads' ? 'loads' : `does not load: ${earlierState}`})`,
    `  earlier certificate: ${earlier === null ? 'cannot be read from this store: what that key signed cannot be verified from here' : `sha256 ${earlier.sha256} - KEPT`}`,
  ];
  say(
    `${ROTATE_KEY_COMMAND}: about to make a NEW evidence signing key the active one of this installation`,
    `  directory:           ${signerDir}`,
    ...earlierLines,
    `  new key id:          ${keyId}`,
    '  algorithm:           Ed25519, a software key in a file of this host, readable by its owner only',
    `  new subject:         ${expectedSubject}`,
    `  valid from (UTC):    ${utcText(now)}`,
    `  valid until (UTC):   ${utcText(now + SIGNING_CERTIFICATE_VALIDITY_DAYS * DAY_MS)}`,
    `  Check the clock of this host against the two instants, and the installation device id against ${ENV_INSTALLATION_DEVICE_ID}, character for character.`,
    ...ROTATION_NOTES.map((line) => `  ${line}`),
    ...SELF_SIGNED_LIMITS.map((line) => `  ${line}`),
  );
  const word = await ports.ask(`Type ${ROTATE_WORD} to make the new key and make it active (anything else ends the command and nothing is written): `);
  if (word === null) return refuse(R.NOT_A_TERMINAL);
  if (word !== ROTATE_WORD) return refuse(R.NOT_CONFIRMED, '  Nothing was written.');

  // From here on something exists, and nothing is ever removed: a failure names the state and leaves it to the installer.
  const left = '  What was written is LEFT as it is: nothing is removed by this command. Do not hand any fingerprint over.';
  const notActive = `  The earlier key ${earlierKeyId} is still the active one. The key id ${keyId} is spent: a later run takes the id after it.`;

  // 8. The new key: provisioned by the store, re-read as written, loaded BY ITS ID before the pointer names it.
  let certificate: SigningCertificate;
  try {
    certificate = provisionSigningKey({ dir: signerDir, now, keyId, subject: { organization: organisation, organizationalUnit } });
  } catch (error) {
    // A code of the signer, or a fixed word: never a text or a location of the operating system.
    return refuse(R.NOT_PROVISIONED, `  the store says: ${codeOf(error)}`, left, `  The earlier key ${earlierKeyId} is still the active one.`);
  }
  const expectedEntries: ReadonlyArray<readonly [string, EntryFacts['kind'], number]> = [
    [signerDir, 'directory', PRIVATE_DIR_MODE],
    [join(signerDir, `${keyId}.p8`), 'file', PRIVATE_FILE_MODE],
    [join(signerDir, `${keyId}.wrap`), 'file', PRIVATE_FILE_MODE],
    [join(signerDir, `${keyId}.crt`), 'file', PUBLIC_FILE_MODE],
  ];
  for (const [path, kind, mode] of expectedEntries) {
    const facts = inspect(path);
    if (facts === null || facts.kind !== kind || facts.ownerUid !== uid || (facts.mode & PERMISSION_BITS) !== mode) return refuse(R.STORE_NOT_AS_WRITTEN, left, notActive);
  }
  let made: SigningCertificate;
  try {
    made = loadSoftwareSigner({ dir: signerDir, keyId, now: ports.now() }).certificate;
  } catch (error) {
    return refuse(R.LOAD_FAILED, `  the loader says: ${codeOf(error)}`, left, notActive);
  }
  if (made.subject !== expectedSubject || made.sha256 !== certificate.sha256 || made.keyId !== keyId || isDevelopmentKeySubject(made.subject) || isDevelopmentSigningCertificate(made)) return refuse(R.SUBJECT_MISMATCH, left, notActive);

  // 9. The pointer, by the store's one writer; then the Core's own loader must answer with the new key.
  try {
    activateSigningKey({ dir: signerDir, keyId, now: ports.now() });
  } catch (error) {
    return refuse(R.NOT_ACTIVATED, `  the store says: ${codeOf(error)}`, left, '  Which key is active now is what the store answers: look at it before the Core is started.', `  If it is still ${earlierKeyId}, the key id ${keyId} is spent and a later run takes the id after it.`);
  }
  let loaded: SigningCertificate;
  try {
    loaded = loadSealingSigner({ dataDir, now: ports.now() }).certificate;
  } catch (error) {
    return refuse(R.ACTIVE_KEY_NOT_NEW, `  the loader says: ${codeOf(error)}`, left);
  }
  if (loaded.keyId !== keyId || loaded.sha256 !== certificate.sha256) return refuse(R.ACTIVE_KEY_NOT_NEW, left);
  // The earlier certificate, read again: it is what it was.
  if (earlier !== null) {
    let kept: string | null = null;
    try {
      kept = readStoredCertificate({ dir: signerDir, keyId: earlierKeyId }).sha256;
    } catch {
      kept = null;
    }
    if (kept !== earlier.sha256) return refuse(R.EARLIER_CERTIFICATE_CHANGED, left);
  }

  // 10. The two records of the new key: public facts only, each created exclusively.
  const facts = [
    `  directory:           ${signerDir}`,
    ...earlierLines,
    `  new key id:          ${loaded.keyId} - ACTIVE`,
    `  subject:             ${loaded.subject}`,
    `  certificate:         sha256 ${loaded.sha256}`,
    `  valid from (UTC):    ${utcText(loaded.notBefore)}`,
    `  valid until (UTC):   ${utcText(loaded.notAfter)}`,
  ];
  try {
    writeRecord(signerDir, provisioningRecordNameOf(keyId), rotationRecordText(loaded, { keyId: earlierKeyId, certificateSha256: earlier?.sha256 ?? null, state: earlierState }, now, uid));
    if (inspect(handoverDir) === null) mkdirSync(handoverDir, { mode: PRIVATE_DIR_MODE });
    writeRecord(handoverDir, handoverRecordNameOf(keyId), handoverRecordText(loaded));
  } catch {
    return refuse(R.RECORD_NOT_WRITTEN, '  The new key IS provisioned, loads and IS the active one; a record of it could not be written. Keep this output with the installation papers:', ...facts, left);
  }

  say(
    `${ROTATE_KEY_COMMAND}: OK, the new evidence signing key was provisioned, loads and is the ACTIVE one`,
    ...facts,
    `  hand-over record:    ${join(handoverDir, handoverRecordNameOf(keyId))}`,
    ...ROTATION_NOTES.map((line) => `  ${line}`),
    ...SELF_SIGNED_LIMITS.map((line) => `  ${line}`),
    '  Start the Core again: it loads the new key. Keep this output with the installation papers. Do not copy the signer directory into a backup: back up certificates only.',
  );
  return { code: RotateKeyExit.ROTATED, lines, refusal: null };
}
