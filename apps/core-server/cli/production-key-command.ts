/**
 * `npm run evidence:production-key -w @dems/core-server -- --data-dir <absolute directory>`
 * (task 4 row 206, package X1-1; decision U19; design `05_design_x1_x2.md` part A; security review
 * SX-05, SX-06, SX-07, SX-08; requirements R-X1-1 to R-X1-9).
 *
 * WHAT IT DOES. It provisions the PRODUCTION evidence signing key of ONE installation under
 * `<data directory>/signer`, through the existing `provisionSigningKey` of the signer store: a
 * software Ed25519 key, self-signed, valid 1,825 days. The certificate subject states the
 * organisation and the installation:
 *
 *     O  = the organisation, typed by the installer
 *     OU = `Evidence signing <installation device id>`
 *     CN = the key id
 *
 * THIS FILE IS THE COMMAND WITHOUT A PROCESS: arguments and four ports in, an exit code and the
 * lines out. The process entry is `cli/production-key.ts`. Nothing here reads the environment, the
 * system time or a terminal, and nothing here imports the cryptography module: every byte of key
 * material is made, written and read by the signer store (`capture/signer/host-key.ts`) and never
 * crosses into this file. The random source is the store's own; no parameter selects another
 * (R-X1-4).
 *
 * WHY IT LIES IN `cli/` AND NOT UNDER `src/` (H1 of the design, settled by row 206). Importing the
 * provisioning function through the capture unit's index is allowed. But the server's sources are
 * pinned folder by folder (a new unit must be listed as closed; the files of the sealing unit are
 * pinned by name; no source but the configuration names the installation setting), and this
 * command is not the server: no file under `src/` imports it, so the server cannot load it. The
 * properties the server's static rules would hold for it - no cryptography import, no read of the
 * environment, no call that removes or renames - are asserted for this file and its entry by the
 * command's own test.
 *
 * THE ORDER, and why. Everything that can refuse runs BEFORE any directory or file is made, so a
 * refused run leaves nothing behind:
 *
 *   1. the arguments (`--data-dir` only, required, absolute, as written: no default)   -> exit 2
 *   2. the caller: uid 0 is refused, and so is a host that cannot say who runs it
 *   3. the directory rule (R-X1-7, SX-05): the data directory is a real directory of the caller,
 *      not a link, not writable by group or others; every directory above it is a real directory
 *      of root or the caller that group and others cannot write; the entries `signer` and
 *      `handover`, where they exist, are real directories of the caller (`signer`: mode 0700)
 *   4. the store (R-X1-6, SX-07): when ANY of the four names of the key id exists the answer is
 *      `KEY_EXISTS`, with the names that exist and whether the store loads. Nothing is replaced,
 *      completed, removed or renamed - an incomplete store is the installer's to deal with.
 *      The same word when the key id is SPENT (row K6; review 230 R-5): the STORE is asked for
 *      its next key id (`nextSigningKeyId`), and any answer but the first id - a later key of the
 *      series is named by an entry or by the pointer - ends the command here, BEFORE the first
 *      prompt. A store that cannot say (a pointer that cannot be taken) is `STORE_REFUSED`
 *   5. the two typed values (SX-06, R-X1-5): ASCII, bounded, a closed character set. An
 *      installation id of the closed list `ReservedInstallationId` of the boot checks (decision
 *      C86) is refused as soon as it is typed, `INSTALLATION_ID_RESERVED`: a production start
 *      would refuse the installation, so no key is made for it
 *   6. the summary - subject, validity in UTC, directory, the limits of a self-signed
 *      certificate (SX-08) - and the word `PROVISION`
 *
 * AFTER the key exists nothing is ever removed either (R-X1-3): the command re-reads what was
 * written (modes 0700, 0600, 0600, 0644; owner = the caller), then LOADS the key through the
 * loader the seal uses (`loadSealingSigner`: the directory and the call of boot checks 4 and 4b)
 * and compares the parsed subject with the expected text, exactly. Only then does it write the two
 * records and say OK. "OK" therefore means: a `REAL_PRODUCTION` boot's checks 4 and 4b pass on
 * this store (proved by `src/sealing/__tests__/production-key.test.ts` with the boot step's own
 * readers).
 *
 * THE TWO RECORDS hold public facts only: `signer/<key id>.provisioned.json` (a note, not
 * evidence; no check reads it) and `handover/<key id>.handover.txt` (the certificate, its
 * fingerprint and the limits: the file the installer gives to whoever will verify).
 */
import { closeSync, constants, fchmodSync, fsyncSync, lstatSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isDevelopmentKeySubject } from '@dems/shared/evidence-verify';
import { CORE_EVIDENCE_SIGNING_KEY_ID, SIGNING_CERTIFICATE_VALIDITY_DAYS, SignerError, nextSigningKeyId, provisionSigningKey, subjectText, utcFields, type SigningCertificate } from '../src/capture';
import { isReservedInstallationId } from '../src/capture/boot/checks';
import { ENV_INSTALLATION_DEVICE_ID, parseInstallationDeviceId } from '../src/config';
import { DEVELOPMENT_KEY_UNIT, isDevelopmentSigningCertificate, loadSealingSigner, sealingSignerDir } from '../src/sealing/signing';
import { CORE_SERVER_VERSION } from '../src/version';

export const PRODUCTION_KEY_COMMAND = 'evidence:production-key';
/** The word the installer types before any key exists. */
export const PROVISION_WORD = 'PROVISION';
/** `<data directory>/handover`: where the hand-over record is written. */
export const HANDOVER_SUBPATH = 'handover';
/** The unit of a production certificate is this text, a space and the installation device id. */
export const PRODUCTION_KEY_UNIT_PREFIX = 'Evidence signing';
export const ORGANISATION_MIN_LENGTH = 2;
export const ORGANISATION_MAX_LENGTH = 64;

export const ProductionKeyExit = { PROVISIONED: 0, REFUSED: 1, USAGE: 2 } as const;
export type ProductionKeyExit = (typeof ProductionKeyExit)[keyof typeof ProductionKeyExit];

/** Why the command refused. A refusal line holds one of these words, never a text of the operating system. */
export const ProductionKeyRefusal = {
  /** uid 0: a Core does not run as root, and its key is not root's. */
  ROOT_REFUSED: 'ROOT_REFUSED',
  /** The host cannot say which user runs the command (no owner can be checked). */
  USER_UNKNOWN: 'USER_UNKNOWN',
  DATA_DIR_NOT_FOUND: 'DATA_DIR_NOT_FOUND',
  DATA_DIR_LINK: 'DATA_DIR_LINK',
  DATA_DIR_NOT_A_DIRECTORY: 'DATA_DIR_NOT_A_DIRECTORY',
  DATA_DIR_OWNER: 'DATA_DIR_OWNER',
  DATA_DIR_WRITABLE: 'DATA_DIR_WRITABLE',
  ANCESTOR_NOT_FOUND: 'ANCESTOR_NOT_FOUND',
  ANCESTOR_LINK: 'ANCESTOR_LINK',
  ANCESTOR_NOT_A_DIRECTORY: 'ANCESTOR_NOT_A_DIRECTORY',
  ANCESTOR_OWNER: 'ANCESTOR_OWNER',
  ANCESTOR_WRITABLE: 'ANCESTOR_WRITABLE',
  SIGNER_LINK: 'SIGNER_LINK',
  SIGNER_NOT_A_DIRECTORY: 'SIGNER_NOT_A_DIRECTORY',
  SIGNER_OWNER: 'SIGNER_OWNER',
  SIGNER_MODE: 'SIGNER_MODE',
  HANDOVER_LINK: 'HANDOVER_LINK',
  HANDOVER_NOT_A_DIRECTORY: 'HANDOVER_NOT_A_DIRECTORY',
  HANDOVER_OWNER: 'HANDOVER_OWNER',
  HANDOVER_WRITABLE: 'HANDOVER_WRITABLE',
  /** Something of the key id is in the store. Final: nothing is replaced or completed. */
  KEY_EXISTS: 'KEY_EXISTS',
  /** The store does not say which key id is next (its pointer cannot be taken). Never repaired here; refused before anything is asked. */
  STORE_REFUSED: 'STORE_REFUSED',
  /** A record of an earlier run is there and no key is: nothing is replaced. */
  RECORD_EXISTS: 'RECORD_EXISTS',
  /** No line could be read: the command is not run at a terminal, or the input ended. */
  NOT_A_TERMINAL: 'NOT_A_TERMINAL',
  ORGANISATION_REFUSED: 'ORGANISATION_REFUSED',
  INSTALLATION_ID_REFUSED: 'INSTALLATION_ID_REFUSED',
  /** The typed installation id is one of the closed list the boot checks reserve for tests and demonstration data (decision C86). */
  INSTALLATION_ID_RESERVED: 'INSTALLATION_ID_RESERVED',
  NOT_CONFIRMED: 'NOT_CONFIRMED',
  /** After provisioning: an entry is not of the kind, the owner or the mode it was written with. */
  STORE_NOT_AS_WRITTEN: 'STORE_NOT_AS_WRITTEN',
  /** After provisioning: the Core's loader does not load the key. */
  LOAD_FAILED: 'LOAD_FAILED',
  /** After provisioning: the loaded certificate is not the one that was made, or its subject is not the expected text. */
  SUBJECT_MISMATCH: 'SUBJECT_MISMATCH',
  /** After provisioning: a record could not be written. */
  RECORD_NOT_WRITTEN: 'RECORD_NOT_WRITTEN',
} as const;
export type ProductionKeyRefusal = (typeof ProductionKeyRefusal)[keyof typeof ProductionKeyRefusal];

/** What the directory rule asks about one entry, as it IS (a link is a link, never its target). */
export interface EntryFacts {
  readonly kind: 'directory' | 'file' | 'link' | 'other';
  readonly ownerUid: number;
  /** The permission bits, with the sticky and set-id bits. */
  readonly mode: number;
}

export interface ProductionKeyPorts {
  /** The host clock, epoch milliseconds: the instant the certificate becomes valid. */
  now(): number;
  /** The numeric id of the OS user that runs the command; negative when the host cannot say. */
  uid(): number;
  /**
   * One line typed at the terminal, echoed (neither value is a secret), without its line end and
   * otherwise as typed. Null when no line can be read: no terminal, or the input ended.
   */
  ask(prompt: string): Promise<string | null>;
  /** Every line of the command as it is produced; the same lines, in order, are in the result. */
  out(line: string): void;
  /** The facts of an entry, or null when there is none. Default: the file system (`lstat`). For tests. */
  readonly inspect?: (path: string) => EntryFacts | null;
}

export interface ProductionKeyRun {
  readonly code: ProductionKeyExit;
  readonly lines: readonly string[];
  /** The refusal, or null when the key was provisioned or the arguments were not usable. */
  readonly refusal: ProductionKeyRefusal | null;
}

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const PUBLIC_FILE_MODE = 0o644;
const GROUP_OR_OTHER_WRITE = 0o022;
const PERMISSION_BITS = 0o777;
const DAY_MS = 86_400_000;
const ORGANISATION_FORM = /^[A-Za-z0-9][A-Za-z0-9 .-]*$/;
const USAGE = `${PRODUCTION_KEY_COMMAND}: usage: ${PRODUCTION_KEY_COMMAND} --data-dir <absolute directory> (no other option; the directory is written in full, without a link and without a trailing separator)`;

/**
 * What a self-signed certificate does and does not say (SX-08). Printed before the confirmation,
 * after the key was made, and written into the hand-over record.
 */
export const SELF_SIGNED_LIMITS: readonly string[] = Object.freeze([
  'The certificate is SELF-SIGNED: no certificate authority stands behind it and there is no chain.',
  'The organisation and the installation in it are typed by the installer, not proven by anyone.',
  'The signing instant of a sealed package is the clock of the signer itself.',
  'There is no revocation channel: whoever received the fingerprint must be told by a person when the key is compromised.',
  'The fingerprint is handed over by a person, by another channel than the evidence packages; keep the list of everyone who received it.',
  'Hand the fingerprint over only after the first successful production start of this installation.',
]);

export const inspectEntry = (path: string): EntryFacts | null => {
  try {
    const status = lstatSync(path);
    return { kind: status.isSymbolicLink() ? 'link' : status.isDirectory() ? 'directory' : status.isFile() ? 'file' : 'other', ownerUid: status.uid, mode: status.mode & 0o7777 };
  } catch {
    return null;
  }
};

/** `2026-10-13T03:00:00Z`, computed without the system clock (the signer's own calendar function). */
export function utcText(epochMs: number): string {
  const { year, month, day, hour, minute, second } = utcFields(epochMs);
  const two = (value: number): string => String(value).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${two(month)}-${two(day)}T${two(hour)}:${two(minute)}:${two(second)}Z`;
}

/**
 * The organisation as typed, or null (SX-06): ASCII letters, digits, space, hyphen, full stop; 2
 * to 64 characters; begins with a letter or a digit; no trailing space, no two spaces in a row;
 * never the text of the development mark. A comma, `=`, a quote, a line break or any character
 * outside ASCII is outside the set, so none can reach the certificate or a log.
 */
export function organisationOf(typed: string): string | null {
  if (typed.length < ORGANISATION_MIN_LENGTH || typed.length > ORGANISATION_MAX_LENGTH) return null;
  if (!ORGANISATION_FORM.test(typed) || typed.endsWith(' ') || typed.includes('  ')) return null;
  if (typed.toUpperCase().includes(DEVELOPMENT_KEY_UNIT.toUpperCase())) return null;
  return typed;
}

/**
 * The installation device id as typed, or null: THE pattern the configuration loader applies to
 * `DEMS_INSTALLATION_DEVICE_ID` (`parseInstallationDeviceId` of `config.ts`), called, not copied.
 */
export function installationDeviceIdOf(typed: string): string | null {
  try {
    return parseInstallationDeviceId(typed);
  } catch {
    return null;
  }
}

/**
 * True when the installation id is one no installation may carry: THE closed list of the boot
 * checks (`ReservedInstallationId` of `capture/boot/checks.ts`; decision C86), asked, not copied.
 * A production start refuses such an installation (boot check 4b-3), so no key is made for it.
 * Also the question of the rotation command.
 */
export function installationIdIsReserved(installationDeviceId: string): boolean {
  return isReservedInstallationId(installationDeviceId);
}

/** What the installer is told after `INSTALLATION_ID_RESERVED`. The id is not repeated. */
export const RESERVED_INSTALLATION_ID_NOTE: readonly string[] = Object.freeze([
  '  This installation device id is reserved for tests and demonstration data: no installation may carry it, and a production start refuses it.',
  '  No key was made and nothing was written. Give the installation an id of its own and run the command again.',
]);

/** The subject text of the production certificate of that organisation and installation, as the Core reads it back. */
export function productionKeySubjectOf(organisation: string, installationDeviceId: string): string {
  return subjectText({ organization: organisation, organizationalUnit: `${PRODUCTION_KEY_UNIT_PREFIX} ${installationDeviceId}`, commonName: CORE_EVIDENCE_SIGNING_KEY_ID });
}

/** The four names of the key id in the store, in a fixed order. */
export const SIGNER_STORE_NAMES: readonly string[] = Object.freeze(['p8', 'wrap', 'crt', 'compromised'].map((extension) => `${CORE_EVIDENCE_SIGNING_KEY_ID}.${extension}`));
export const PROVISIONING_RECORD_NAME = `${CORE_EVIDENCE_SIGNING_KEY_ID}.provisioned.json`;
export const HANDOVER_RECORD_NAME = `${CORE_EVIDENCE_SIGNING_KEY_ID}.handover.txt`;

type Inspect = (path: string) => EntryFacts | null;

/** Step 3: the directory rule. The first refusal, or null. Reads facts only; makes nothing. Also the rule of the commands of row 226. */
export function directoryRefusal(dataDir: string, uid: number, inspect: Inspect): ProductionKeyRefusal | null {
  const R = ProductionKeyRefusal;
  // Every directory above the data directory, from the root down: a real directory of root or the caller that group and others cannot write.
  const above: string[] = [];
  for (let step = dirname(dataDir); ; step = dirname(step)) {
    above.unshift(step);
    if (dirname(step) === step) break;
  }
  for (const step of above) {
    const facts = inspect(step);
    if (facts === null) return R.ANCESTOR_NOT_FOUND;
    if (facts.kind === 'link') return R.ANCESTOR_LINK;
    if (facts.kind !== 'directory') return R.ANCESTOR_NOT_A_DIRECTORY;
    if (facts.ownerUid !== 0 && facts.ownerUid !== uid) return R.ANCESTOR_OWNER;
    if ((facts.mode & GROUP_OR_OTHER_WRITE) !== 0) return R.ANCESTOR_WRITABLE;
  }
  const data = inspect(dataDir);
  if (data === null) return R.DATA_DIR_NOT_FOUND;
  if (data.kind === 'link') return R.DATA_DIR_LINK;
  if (data.kind !== 'directory') return R.DATA_DIR_NOT_A_DIRECTORY;
  if (data.ownerUid !== uid) return R.DATA_DIR_OWNER;
  if ((data.mode & GROUP_OR_OTHER_WRITE) !== 0) return R.DATA_DIR_WRITABLE;
  // The two entries themselves (SX-05): `mkdir` and `chmod` of the store follow a link, so a link is refused HERE.
  const signer = inspect(sealingSignerDir(dataDir));
  if (signer !== null) {
    if (signer.kind === 'link') return R.SIGNER_LINK;
    if (signer.kind !== 'directory') return R.SIGNER_NOT_A_DIRECTORY;
    if (signer.ownerUid !== uid) return R.SIGNER_OWNER;
    if ((signer.mode & PERMISSION_BITS) !== PRIVATE_DIR_MODE) return R.SIGNER_MODE;
  }
  const handover = inspect(join(dataDir, HANDOVER_SUBPATH));
  if (handover !== null) {
    if (handover.kind === 'link') return R.HANDOVER_LINK;
    if (handover.kind !== 'directory') return R.HANDOVER_NOT_A_DIRECTORY;
    if (handover.ownerUid !== uid) return R.HANDOVER_OWNER;
    if ((handover.mode & GROUP_OR_OTHER_WRITE) !== 0) return R.HANDOVER_WRITABLE;
  }
  return null;
}

/** A new file, created exclusively, written, set to its mode and synced; then its directory is synced. Throws on any failure. */
export function writeRecord(directory: string, name: string, text: string): void {
  const file = openSync(join(directory, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), PUBLIC_FILE_MODE);
  try {
    fchmodSync(file, PUBLIC_FILE_MODE);
    const bytes = Buffer.from(text, 'utf8');
    for (let written = 0; written < bytes.length; ) written += writeSync(file, bytes, written, bytes.length - written);
    fsyncSync(file);
  } finally {
    closeSync(file);
  }
  const holder = openSync(directory, constants.O_RDONLY);
  try {
    fsyncSync(holder);
  } finally {
    closeSync(holder);
  }
}

function provisioningRecordText(certificate: SigningCertificate, provisionedAt: number, uid: number): string {
  return `${JSON.stringify(
    {
      record: 'DEMS_EVIDENCE_SIGNING_KEY_PROVISIONED',
      note: 'A note of the installer, not evidence: this file can be rewritten by the user of the Core and no check reads it.',
      keyId: certificate.keyId,
      algorithm: 'Ed25519',
      selfSigned: true,
      certificateSha256: certificate.sha256,
      subject: certificate.subject,
      serialNumber: certificate.serialNumber,
      notBefore: utcText(certificate.notBefore),
      notAfter: utcText(certificate.notAfter),
      provisionedAt: utcText(provisionedAt),
      command: PRODUCTION_KEY_COMMAND,
      commandVersion: CORE_SERVER_VERSION,
      uid,
    },
    null,
    2,
  )}\n`;
}

export function handoverRecordText(certificate: SigningCertificate): string {
  return [
    'DEMS - hand-over record of an evidence signing certificate',
    '',
    `key id:              ${certificate.keyId}`,
    `subject:             ${certificate.subject}`,
    `serial number:       ${certificate.serialNumber}`,
    `valid from (UTC):    ${utcText(certificate.notBefore)}`,
    `valid until (UTC):   ${utcText(certificate.notAfter)}`,
    `certificate sha256:  ${certificate.sha256}`,
    '',
    'What this certificate says and does not say:',
    ...SELF_SIGNED_LIMITS.map((line) => `  - ${line}`),
    '',
    'A receiver verifies an exported package against this fingerprint with:',
    `  npm run evidence:verify-export -- <archive.zip> --trust ${certificate.sha256}`,
    '',
    'The certificate (public):',
    certificate.pemText.trimEnd(),
    '',
  ].join('\n');
}

/** The command without a process: arguments and ports in, an exit code and the lines out. Never throws. */
export async function runProductionKeyCommand(args: readonly string[], ports: ProductionKeyPorts): Promise<ProductionKeyRun> {
  const lines: string[] = [];
  const say = (...text: string[]): void => {
    for (const line of text) {
      lines.push(line);
      ports.out(line);
    }
  };
  const refuse = (refusal: ProductionKeyRefusal, ...detail: string[]): ProductionKeyRun => {
    say(`${PRODUCTION_KEY_COMMAND}: REFUSED, ${refusal}`, ...detail);
    return { code: ProductionKeyExit.REFUSED, lines, refusal };
  };
  const inspect = ports.inspect ?? inspectEntry;
  const R = ProductionKeyRefusal;

  // 1. The arguments.
  let dataDir: string;
  try {
    const parsed = parseArgs({ args: [...args], options: { 'data-dir': { type: 'string' } }, strict: true, allowPositionals: false });
    const given = parsed.values['data-dir'];
    if (given === undefined || given === '' || !isAbsolute(given) || resolve(given) !== given) throw new Error('usage');
    dataDir = given;
  } catch {
    say(USAGE);
    return { code: ProductionKeyExit.USAGE, lines, refusal: null };
  }

  // 2. The caller.
  const uid = ports.uid();
  if (uid === 0) return refuse(R.ROOT_REFUSED, '  Run it as the OS user the Core runs as, never as root.');
  if (!Number.isSafeInteger(uid) || uid < 0) return refuse(R.USER_UNKNOWN);

  // 3. The directory rule. Nothing has been made yet, and a refusal makes nothing.
  const directory = directoryRefusal(dataDir, uid, inspect);
  if (directory !== null) {
    return refuse(directory, '  The data directory must exist as a real directory of the calling user (no link), not writable by group or others, below directories of root or that user that group and others cannot write.');
  }
  const signerDir = sealingSignerDir(dataDir);
  const handoverDir = join(dataDir, HANDOVER_SUBPATH);

  // 4. The store. Anything of the key id = KEY_EXISTS: nothing is replaced, completed, removed or renamed.
  const present = SIGNER_STORE_NAMES.filter((name) => inspect(join(signerDir, name)) !== null);
  if (present.length > 0) {
    let loads: string;
    try {
      const existing = loadSealingSigner({ dataDir, now: ports.now() });
      loads = isDevelopmentKeySubject(existing.certificate.subject) || isDevelopmentSigningCertificate(existing.certificate) ? 'yes - it is a DEVELOPMENT key: a production installation uses its own data directory' : 'yes';
    } catch (error) {
      loads = `no (${error instanceof SignerError ? error.code : 'UNREADABLE'})`;
    }
    const absent = SIGNER_STORE_NAMES.filter((name) => !present.includes(name));
    return refuse(
      R.KEY_EXISTS,
      `  present:     ${present.join(', ')}`,
      `  absent:      ${absent.length === 0 ? '(none)' : absent.join(', ')}`,
      `  store loads: ${loads}`,
      '  A key is never replaced, completed or removed by this command. A store that does not load is incomplete or damaged:',
      '  what to do with it is the decision of the installer, who alone knows whether its fingerprint was handed over.',
    );
  }
  if (inspect(join(signerDir, PROVISIONING_RECORD_NAME)) !== null || inspect(join(handoverDir, HANDOVER_RECORD_NAME)) !== null) {
    return refuse(R.RECORD_EXISTS, '  A record of an earlier run is there and no key is. Nothing is replaced.');
  }
  // The key id itself, asked of the STORE before anything is asked of the installer (row K6; review 230 R-5): the look above
  // names the first id's four files only, and the store refuses a spent id at the provisioning - after the word. Its next id
  // is the first one exactly when nothing of the series was ever named here, by an entry or by the pointer.
  let nextKeyId: string;
  try {
    nextKeyId = nextSigningKeyId({ dir: signerDir });
  } catch (error) {
    return refuse(
      R.STORE_REFUSED,
      `  the store says: ${error instanceof SignerError ? error.code : 'UNREADABLE'}`,
      '  The store does not say which key id is next. This command never repairs, replaces or removes what it cannot take:',
      '  what the entry is and how it came there is for the installer to find out, at the host. Nothing was asked and nothing was written.',
    );
  }
  if (nextKeyId !== CORE_EVIDENCE_SIGNING_KEY_ID) {
    return refuse(
      R.KEY_EXISTS,
      `  The key id ${CORE_EVIDENCE_SIGNING_KEY_ID} is SPENT: the store names a later key of the series, in an entry or in its pointer.`,
      '  A key id is never used for a second key, and this command makes the FIRST key of an installation only.',
      '  Nothing was asked and nothing was written. What was removed from a store by hand is put back by hand: no command repairs it.',
    );
  }

  // 5. The two typed values. Neither is a secret; a refused value is not repeated.
  const typedOrganisation = await ports.ask(`Organisation (${ORGANISATION_MIN_LENGTH} to ${ORGANISATION_MAX_LENGTH} characters: ASCII letters, digits, space, hyphen, full stop): `);
  if (typedOrganisation === null) return refuse(R.NOT_A_TERMINAL, '  The command is run by a person at a terminal of the Core host.');
  const organisation = organisationOf(typedOrganisation);
  if (organisation === null) return refuse(R.ORGANISATION_REFUSED);
  const typedId = await ports.ask(`Installation device id (exactly the value of ${ENV_INSTALLATION_DEVICE_ID}, for example DEMS-JKT-07): `);
  if (typedId === null) return refuse(R.NOT_A_TERMINAL, '  The command is run by a person at a terminal of the Core host.');
  const installationDeviceId = installationDeviceIdOf(typedId);
  if (installationDeviceId === null) return refuse(R.INSTALLATION_ID_REFUSED);
  if (installationIdIsReserved(installationDeviceId)) return refuse(R.INSTALLATION_ID_RESERVED, ...RESERVED_INSTALLATION_ID_NOTE);
  const expectedSubject = productionKeySubjectOf(organisation, installationDeviceId);
  if (isDevelopmentKeySubject(expectedSubject) || isDevelopmentSigningCertificate({ subject: expectedSubject })) return refuse(R.ORGANISATION_REFUSED);

  // 6. The summary and the word.
  const now = ports.now();
  say(
    `${PRODUCTION_KEY_COMMAND}: about to provision the PRODUCTION evidence signing key of this installation`,
    `  directory:         ${signerDir}`,
    `  key id:            ${CORE_EVIDENCE_SIGNING_KEY_ID}`,
    `  algorithm:         Ed25519, a software key in a file of this host, readable by its owner only`,
    `  subject:           ${expectedSubject}`,
    `  valid from (UTC):  ${utcText(now)}`,
    `  valid until (UTC): ${utcText(now + SIGNING_CERTIFICATE_VALIDITY_DAYS * DAY_MS)}`,
    `  Check the clock of this host against the two instants, and the installation device id against ${ENV_INSTALLATION_DEVICE_ID}, character for character.`,
    ...SELF_SIGNED_LIMITS.map((line) => `  ${line}`),
  );
  const word = await ports.ask(`Type ${PROVISION_WORD} to make the key (anything else ends the command and nothing is written): `);
  if (word === null) return refuse(R.NOT_A_TERMINAL);
  if (word !== PROVISION_WORD) return refuse(R.NOT_CONFIRMED, '  Nothing was written.');

  // From here on something exists, and nothing is ever removed: a failure names the state and leaves it to the installer.
  const left = '  What was written is LEFT as it is: nothing is removed by this command. Do not hand any fingerprint over.';
  let certificate: SigningCertificate;
  try {
    // Made here, exclusively and private, when it is not there: the store's own `mkdir` follows a link, this one does not.
    if (inspect(signerDir) === null) mkdirSync(signerDir, { mode: PRIVATE_DIR_MODE });
    certificate = provisionSigningKey({ dir: signerDir, now, keyId: CORE_EVIDENCE_SIGNING_KEY_ID, subject: { organization: organisation, organizationalUnit: `${PRODUCTION_KEY_UNIT_PREFIX} ${installationDeviceId}` } });
  } catch (error) {
    // A code of the signer, or a fixed word: never a text or a location of the operating system.
    say(`${PRODUCTION_KEY_COMMAND}: FAILED, ${error instanceof SignerError ? error.code : 'UNREADABLE'}`, left);
    return { code: ProductionKeyExit.REFUSED, lines, refusal: error instanceof SignerError && error.code === 'KEY_EXISTS' ? R.KEY_EXISTS : null };
  }

  // R-X1-3: what was written, as it is.
  const expectedEntries: ReadonlyArray<readonly [string, EntryFacts['kind'], number]> = [
    [signerDir, 'directory', PRIVATE_DIR_MODE],
    [join(signerDir, `${CORE_EVIDENCE_SIGNING_KEY_ID}.p8`), 'file', PRIVATE_FILE_MODE],
    [join(signerDir, `${CORE_EVIDENCE_SIGNING_KEY_ID}.wrap`), 'file', PRIVATE_FILE_MODE],
    [join(signerDir, `${CORE_EVIDENCE_SIGNING_KEY_ID}.crt`), 'file', PUBLIC_FILE_MODE],
  ];
  for (const [path, kind, mode] of expectedEntries) {
    const facts = inspect(path);
    if (facts === null || facts.kind !== kind || facts.ownerUid !== uid || (facts.mode & PERMISSION_BITS) !== mode) return refuse(R.STORE_NOT_AS_WRITTEN, left);
  }

  // SX-05: the REAL load, as a boot and the seal do it, and the parsed subject against the expected text, exactly.
  let loaded: SigningCertificate;
  try {
    loaded = loadSealingSigner({ dataDir, now: ports.now() }).certificate;
  } catch (error) {
    return refuse(R.LOAD_FAILED, `  the loader says: ${error instanceof SignerError ? error.code : 'UNREADABLE'}`, left);
  }
  if (loaded.subject !== expectedSubject || loaded.sha256 !== certificate.sha256 || isDevelopmentKeySubject(loaded.subject) || isDevelopmentSigningCertificate(loaded)) return refuse(R.SUBJECT_MISMATCH, left);

  // The two records: public facts only, each created exclusively.
  try {
    writeRecord(signerDir, PROVISIONING_RECORD_NAME, provisioningRecordText(loaded, now, uid));
    if (inspect(handoverDir) === null) mkdirSync(handoverDir, { mode: PRIVATE_DIR_MODE });
    writeRecord(handoverDir, HANDOVER_RECORD_NAME, handoverRecordText(loaded));
  } catch {
    return refuse(
      R.RECORD_NOT_WRITTEN,
      '  The key IS provisioned and loads; a record of it could not be written. Keep this output with the installation papers:',
      `  subject:     ${loaded.subject}`,
      `  certificate: sha256 ${loaded.sha256}`,
      left,
    );
  }

  say(
    `${PRODUCTION_KEY_COMMAND}: OK, the PRODUCTION evidence signing key was provisioned and loads`,
    `  directory:         ${signerDir}`,
    `  key id:            ${loaded.keyId}`,
    `  subject:           ${loaded.subject}`,
    `  certificate:       sha256 ${loaded.sha256}`,
    `  valid from (UTC):  ${utcText(loaded.notBefore)}`,
    `  valid until (UTC): ${utcText(loaded.notAfter)}`,
    `  hand-over record:  ${join(handoverDir, HANDOVER_RECORD_NAME)}`,
    ...SELF_SIGNED_LIMITS.map((line) => `  ${line}`),
    '  Keep this output with the installation papers. Do not copy the signer directory into a backup: back up certificates only.',
  );
  return { code: ProductionKeyExit.PROVISIONED, lines, refusal: null };
}
