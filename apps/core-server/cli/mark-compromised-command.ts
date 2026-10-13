/**
 * `npm run evidence:mark-compromised -w @dems/core-server -- --data-dir <absolute directory> --key-id <key id>`
 * (task 4 row 226, package X1-4; decisions U19, U20, UD-5; security review F1-6, SX-09 (e); the
 * compromise runbook step (b) of the evidence package spec).
 *
 * WHAT IT DOES. It sets the compromise mark of ONE NAMED key of `<data directory>/signer`, through
 * the store's EXISTING function `markSigningKeyCompromised` and nothing else: one new file
 * `<key id>.compromised`, created exclusively and synced, that holds the fact and the instant.
 * From then on the key loads for nobody. When it is the ACTIVE key, the Core refuses to start
 * (boot check 4, `KEY_COMPROMISED`) and seals nothing until `evidence:rotate-key` has made a new
 * key the active one.
 *
 * WHAT IT NEVER DOES. The key file, the wrap secret and the certificate of the marked key STAY:
 * the certificate is needed to verify again what the key signed, and nothing that was sealed is
 * rewritten. No file is replaced, removed or renamed; the pointer is not touched. The mark cannot
 * be taken back by any command. This file holds no call that removes, renames, cuts or copies a
 * file and imports no cryptography module; no byte of key material crosses into it.
 *
 * THE KEY IS NAMED, NEVER GUESSED: `--key-id` is required (no default to the active key), and the
 * summary shows the certificate of that key - subject and fingerprint - before the word
 * `COMPROMISED` is asked. A key id of which nothing is in the store is refused: a mark is not
 * made for a key that was never there. A key that is marked already is said to be, with exit 0,
 * and nothing is written or asked.
 *
 * THE LOOK BEFORE THE MARK (task 4 row 226d; review 230 caution R-6). Before anything is asked or
 * written the command asks THE STORE what it holds of that key id (`lookAtSigningKeyStore`: the
 * directory as before every read, the entries by name) and SHOWS it - key file, wrap secret,
 * certificate and mark, each present or absent, and whether it is the active key. Refused there,
 * with nothing written: a store the signer unit does not take - a link, another user's, reachable
 * by others, or one that cannot be listed (`STORE_NOT_TAKEN`, with the store's code); no store;
 * nothing of that key id. AFTER the word the look is taken AGAIN: a person may wait at the prompt,
 * and what he was shown must still be what is there (`STORE_CHANGED` otherwise; nothing written).
 * The store's own function looks at the directory once more before it writes.
 *
 * THE DATABASE: NOT TOUCHED. The command opens no connection, so there is nothing a connected
 * Core could be tested by; it CANNOT see a running Core. A running Core asks the store before each
 * signature (rows 226b, 226c): with the mark set it signs nothing more with this key
 * (`KEY_COMPROMISED`) - a seal, an export and a transcript revision alike. STOP IT all the same:
 * the summary and the result say so.
 *
 * Exit status: 0 marked (or marked already), 1 refused or failed, 2 usage.
 */
import { isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { SignerError, activeSigningKeyId, loadSoftwareSigner, lookAtSigningKeyStore, markSigningKeyCompromised, readStoredCertificate, signingKeySeriesNumber, type SigningCertificate, type SigningKeyStoreLook } from '../src/capture';
import { loadSealingSigner, sealingSignerDir } from '../src/sealing/signing';
import { directoryRefusal, inspectEntry, utcText, type EntryFacts, type ProductionKeyPorts, type ProductionKeyRefusal } from './production-key-command';

export const MARK_COMPROMISED_COMMAND = 'evidence:mark-compromised';
/** The word the installer types before the mark is written. */
export const COMPROMISED_WORD = 'COMPROMISED';

export const MarkCompromisedExit = { MARKED: 0, REFUSED: 1, USAGE: 2 } as const;
export type MarkCompromisedExit = (typeof MarkCompromisedExit)[keyof typeof MarkCompromisedExit];

/** Why the command refused, beside the words of the directory rule (`ProductionKeyRefusal`). */
export const MarkCompromisedRefusal = {
  ROOT_REFUSED: 'ROOT_REFUSED',
  USER_UNKNOWN: 'USER_UNKNOWN',
  /** No signer store in the data directory. */
  NO_STORE: 'NO_STORE',
  /** Row 226d (R-6): the signer unit does not take the store - a link, another user's, reachable by others, or not listable. Nothing was written. */
  STORE_NOT_TAKEN: 'STORE_NOT_TAKEN',
  /** Row 226d (R-6): after the word the store no longer holds what was shown before it. Nothing was written. */
  STORE_CHANGED: 'STORE_CHANGED',
  /** Nothing of that key id is in the store: no mark is made for a key that was never there. */
  KEY_NOT_IN_STORE: 'KEY_NOT_IN_STORE',
  NOT_A_TERMINAL: 'NOT_A_TERMINAL',
  NOT_CONFIRMED: 'NOT_CONFIRMED',
  /** The store did not write the mark. */
  NOT_MARKED: 'NOT_MARKED',
  /** After the mark: the entry is not a file of the caller with the mode it was written with. */
  MARK_NOT_AS_WRITTEN: 'MARK_NOT_AS_WRITTEN',
  /** After the mark: the key still loads, or is refused for another reason than the mark. */
  MARK_NOT_EFFECTIVE: 'MARK_NOT_EFFECTIVE',
} as const;
export type MarkCompromisedRefusal = (typeof MarkCompromisedRefusal)[keyof typeof MarkCompromisedRefusal] | ProductionKeyRefusal;

/** The ports of the production key command: a clock, the caller, one echoed line, the output, the entry facts. */
export type MarkCompromisedPorts = ProductionKeyPorts;

export interface MarkCompromisedRun {
  readonly code: MarkCompromisedExit;
  readonly lines: readonly string[];
  /** The refusal, or null when the key is marked or the arguments were not usable. */
  readonly refusal: MarkCompromisedRefusal | null;
}

const PUBLIC_FILE_MODE = 0o644;
const PERMISSION_BITS = 0o777;
const USAGE = `${MARK_COMPROMISED_COMMAND}: usage: ${MARK_COMPROMISED_COMMAND} --data-dir <absolute directory> --key-id <key id of the store> (both required, no other option; the directory is written in full, without a link and without a trailing separator)`;

/** What the mark means. Printed before the word and after the mark. */
export const COMPROMISE_NOTES: readonly string[] = Object.freeze([
  'The mark cannot be taken back by any command: from now on this key loads for nobody.',
  'The key file and the certificate STAY in the store, and nothing that was sealed is rewritten: the certificate is needed to verify again what the key signed.',
  'STOP the Core of this data directory: a running Core signs nothing more with a marked key (its next signature is refused, KEY_COMPROMISED), and this command cannot see a process.',
  'There is no revocation channel: tell everyone who received the fingerprint of this certificate, by a person, that the key is compromised and from when.',
  'A package signed with a compromised key is not proven by its signature alone any more: the holder of the key can state any signing instant.',
  'The command reads and writes no database.',
]);

const codeOf = (error: unknown): string => (error instanceof SignerError ? error.code : 'UNREADABLE');

/** The command without a process: arguments and ports in, an exit code and the lines out. Never throws. */
export async function runMarkCompromisedCommand(args: readonly string[], ports: MarkCompromisedPorts): Promise<MarkCompromisedRun> {
  const lines: string[] = [];
  const say = (...text: string[]): void => {
    for (const line of text) {
      lines.push(line);
      ports.out(line);
    }
  };
  const refuse = (refusal: MarkCompromisedRefusal, ...detail: string[]): MarkCompromisedRun => {
    say(`${MARK_COMPROMISED_COMMAND}: REFUSED, ${refusal}`, ...detail);
    return { code: MarkCompromisedExit.REFUSED, lines, refusal };
  };
  const inspect: (path: string) => EntryFacts | null = ports.inspect ?? inspectEntry;
  const R = MarkCompromisedRefusal;

  // 1. The arguments: the directory and ONE key id of the series, both as written.
  let dataDir: string;
  let keyId: string;
  try {
    const parsed = parseArgs({ args: [...args], options: { 'data-dir': { type: 'string' }, 'key-id': { type: 'string' } }, strict: true, allowPositionals: false });
    const given = parsed.values['data-dir'];
    const named = parsed.values['key-id'];
    if (given === undefined || given === '' || !isAbsolute(given) || resolve(given) !== given) throw new Error('usage');
    if (named === undefined || signingKeySeriesNumber(named) === null) throw new Error('usage');
    dataDir = given;
    keyId = named;
  } catch {
    say(USAGE);
    return { code: MarkCompromisedExit.USAGE, lines, refusal: null };
  }

  // 2. The caller.
  const uid = ports.uid();
  if (uid === 0) return refuse(R.ROOT_REFUSED, '  Run it as the OS user the Core runs as, never as root.');
  if (!Number.isSafeInteger(uid) || uid < 0) return refuse(R.USER_UNKNOWN);

  // 3. The directory rule of the production key command. A refusal writes nothing.
  const directory = directoryRefusal(dataDir, uid, inspect);
  if (directory !== null) {
    return refuse(directory, '  The data directory must exist as a real directory of the calling user (no link), not writable by group or others, below directories of root or that user that group and others cannot write.');
  }
  const signerDir = sealingSignerDir(dataDir);
  if (inspect(signerDir) === null) return refuse(R.NO_STORE, '  There is no signer store here.');

  // 4. THE LOOK (row 226d, R-6): what the STORE holds of that key id, asked of the signer unit before anything is asked
  //    of a person or written. A store the unit does not take is refused here, by the store's own code.
  const look = (): SigningKeyStoreLook | string | null => {
    try {
      return lookAtSigningKeyStore({ dir: signerDir, keyId });
    } catch (error) {
      return codeOf(error);
    }
  };
  const notTaken = (code: string): MarkCompromisedRun =>
    refuse(R.STORE_NOT_TAKEN, `  the store says: ${code}`, '  The signer store must be a real directory of the calling user that group and others cannot reach, and it must be listable. Nothing was written.');
  const found = look();
  if (typeof found === 'string') return notTaken(found);
  if (found === null) return refuse(R.NO_STORE, '  There is no signer store here.');
  const state = (there: boolean): string => (there ? 'present' : 'absent');
  const foundLine = `  found:          key file ${state(found.key)}, wrap secret ${state(found.opener)}, certificate ${state(found.certificate)}, mark ${state(found.mark)}`;

  // The key: something of that id is in the store.
  const markPath = join(signerDir, `${keyId}.compromised`);
  const present = ['p8', 'wrap', 'crt'].filter((extension) => inspect(join(signerDir, `${keyId}.${extension}`)) !== null);
  const alreadyMarked = inspect(markPath) !== null;
  if (present.length === 0 && !alreadyMarked) return refuse(R.KEY_NOT_IN_STORE, `  Nothing of the key id ${keyId} is in the store: no mark is made for a key that was never there.`);
  let certificate: SigningCertificate | null = null;
  try {
    certificate = readStoredCertificate({ dir: signerDir, keyId });
  } catch {
    certificate = null;
  }
  // Whether it is the active key. A pointer that cannot be taken does not keep a key from being marked: it is said.
  let active: string;
  try {
    active = activeSigningKeyId({ dir: signerDir }) === keyId ? 'yes' : 'no';
  } catch (error) {
    active = `cannot be told (${codeOf(error)})`;
  }
  const facts = [
    `  directory:      ${signerDir}`,
    `  key id:         ${keyId}`,
    `  subject:        ${certificate === null ? '(the certificate cannot be read from this store)' : certificate.subject}`,
    `  certificate:    ${certificate === null ? '(the certificate cannot be read from this store)' : `sha256 ${certificate.sha256}`}`,
    foundLine,
    `  the active key: ${active}`,
  ];
  const consequence =
    active === 'no'
      ? '  It is not the active key: the Core goes on with the active one. What this key signed is still to be verified again.'
      : '  The Core REFUSES TO START (boot check 4: KEY_COMPROMISED) and seals nothing until evidence:rotate-key has made a new key the active one.';
  if (alreadyMarked) {
    say(`${MARK_COMPROMISED_COMMAND}: the key is MARKED COMPROMISED already; nothing was written`, ...facts, consequence);
    return { code: MarkCompromisedExit.MARKED, lines, refusal: null };
  }

  // 5. The summary and the word.
  say(`${MARK_COMPROMISED_COMMAND}: about to mark an evidence signing key COMPROMISED`, ...facts, consequence, ...COMPROMISE_NOTES.map((line) => `  ${line}`));
  const word = await ports.ask(`Type ${COMPROMISED_WORD} to set the mark (anything else ends the command and nothing is written): `);
  if (word === null) return refuse(R.NOT_A_TERMINAL, '  The command is run by a person at a terminal of the Core host.');
  if (word !== COMPROMISED_WORD) return refuse(R.NOT_CONFIRMED, '  Nothing was written.');

  // 6. The look AGAIN (row 226d, R-6): a person may have waited at the prompt. What was shown must still be what is there.
  const again = look();
  if (typeof again === 'string') return notTaken(again);
  if (again === null || again.key !== found.key || again.opener !== found.opener || again.certificate !== found.certificate || again.mark !== found.mark) {
    return refuse(R.STORE_CHANGED, '  The store no longer holds what was shown above. Nothing was written: run the command again and read the summary.');
  }

  // The mark, by the store's existing function (which looks at the directory once more before it writes). Nothing else is written, and nothing is ever removed.
  const at = ports.now();
  try {
    markSigningKeyCompromised({ dir: signerDir, keyId, at });
  } catch (error) {
    return refuse(R.NOT_MARKED, `  the store says: ${codeOf(error)}`, '  Whether the mark is there is what the store shows: look at it before the Core is started.');
  }
  const written = inspect(markPath);
  if (written === null || written.kind !== 'file' || written.ownerUid !== uid || (written.mode & PERMISSION_BITS) !== PUBLIC_FILE_MODE) return refuse(R.MARK_NOT_AS_WRITTEN, '  What was written is LEFT as it is.');

  // 7. The mark holds: the key, asked for by its id, loads for nobody - and so does the store itself when it is the active key.
  const refusedWith = (load: () => unknown): string => {
    try {
      load();
      return 'loads';
    } catch (error) {
      return codeOf(error);
    }
  };
  const byId = refusedWith(() => loadSoftwareSigner({ dir: signerDir, keyId, now: ports.now() }));
  if (byId !== 'KEY_COMPROMISED') return refuse(R.MARK_NOT_EFFECTIVE, `  the loader says of the key: ${byId}`);
  if (active === 'yes') {
    const store = refusedWith(() => loadSealingSigner({ dataDir, now: ports.now() }));
    if (store !== 'KEY_COMPROMISED') return refuse(R.MARK_NOT_EFFECTIVE, `  the loader says of the store: ${store}`);
  }

  say(`${MARK_COMPROMISED_COMMAND}: OK, the key is MARKED COMPROMISED and loads for nobody`, ...facts, `  marked at (UTC): ${utcText(at)}`, consequence, ...COMPROMISE_NOTES.map((line) => `  ${line}`), '  Keep this output with the installation papers.');
  return { code: MarkCompromisedExit.MARKED, lines, refusal: null };
}
