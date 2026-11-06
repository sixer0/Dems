/**
 * The software Ed25519 key of the Core on this machine (blueprint row 83; evidence package spec
 * §C.2, §C.3; OD-04; SEC35-06, SEC35-07).
 *
 * THIS IS THE ONE FILE of the capture folder that imports the file system and the cryptography
 * module for the signer (pinned by name in `capture/__tests__/static.test.ts`, G-R2 and G-R8).
 * Everything that touches private key material is in this file and nowhere else.
 *
 * AT REST (SEC35-07).
 *   <dir>/                  mode 0700
 *     <keyId>.p8            the private key: PKCS#8, ENCRYPTED (PBES2, AES-256-CBC), mode 0600
 *     <keyId>.wrap          the 32-byte secret that opens it, mode 0600 — only with the built-in
 *                           `fileWrapSecrets`; another `KeyWrapSecrets` keeps it elsewhere
 *     <keyId>.crt           the self-signed certificate (public), mode 0644
 *     <keyId>.compromised   present = the key signs nothing any more (runbook step b)
 * `<dir>` is the caller's choice; it belongs under the git-ignored data directory, apart from the
 * media store and from the database. The honest limit: with the built-in file source the wrap
 * secret lies on the same volume as the key file, so the encryption defends against a copied key
 * FILE (a backup, a stray archive), not against whoever can read the whole directory as the
 * Core's user. Keeping the secret in the OS keychain or in the Core credential store is the
 * `KeyWrapSecrets` seam.
 *
 * FAIL CLOSED (CS-22). `loadSoftwareSigner` never creates anything: an absent, reachable-by-others,
 * unreadable or compromised key throws, and so does a certificate that is not this key's.
 * Provisioning is the separate, explicit `provisionSigningKey`, which never replaces a key.
 *
 * THE READ PATH (task 4 row 210, package X1-3; S99-06; SX-16 first half). Every stored file is read
 * through ONE function, `readStored`:
 *   - the store directory is looked at as it IS (`lstat`): a link or anything that is no directory
 *     is refused, and so is a directory of another user or one that group or others can reach;
 *   - the file is opened WITHOUT following a link, and the questions - a regular file, the owner,
 *     the mode, the size - are asked of the OPEN HANDLE; the bytes are read from that same handle,
 *     so what was checked is what is read;
 *   - at most `STORE_FILE_MAX_BYTES` are read: a larger file is refused, not read.
 * A private file may have no bit for group or others; the certificate (public) may be read by
 * them but not written. The refusals are the existing codes: `KEY_MODE` for "another user can
 * reach it" (owner or mode), `KEY_UNREADABLE` for a link, a non-file or a file that is too large,
 * `CERTIFICATE_INVALID` for the certificate. THE LIMIT, stated: the directories ABOVE the store
 * are not walked here (the production key command holds them to its rule before it provisions,
 * row 206), and between the look at the directory and the open of a file the directory could be
 * exchanged by whoever may write its parent - there is no `openat` to close that.
 *
 * THE WRITE PATH. A new file is created exclusively without following a link, set to its mode on
 * the handle, written and SYNCED; after the files of a provisioning the directory is synced too,
 * so a loss of power after "provisioned" cannot leave a store that was reported and is not there.
 *
 * THE ACTIVE KEY ID (task 4 row 225, package X1-4; security review SX-09 (a), (b), (e); UD-5). The
 * store holds a SERIES of key ids, `CORE-KEY-EVSIGN-01`, `-02`, ...; one of them is active. WHICH
 * ONE is answered by ONE function, `activeSigningKeyId`, and by nothing else: `loadSoftwareSigner`
 * and `readStoredCertificate` ask it whenever no key id is handed to them, and no caller of the
 * product hands one - so the boot checks, the seal, the transcript revisions and the verify cannot
 * disagree about the key (held by `sealing/__tests__/active-key-call-sites.test.ts`).
 *     <dir>/ACTIVE          the pointer: exactly one key id of the series and a line end, mode 0600
 *   - NO pointer = the FIRST key id: a store made before rotation existed loads as it always did;
 *   - the pointer is read as a private key file is (`readStored`: no link followed, the owner and
 *     the mode asked of the open handle, read from that handle); a pointer that is there and
 *     cannot be taken - a link, a foreign owner, a bit for group or others, anything but one key id
 *     of the series - REFUSES (`ACTIVE_KEY_POINTER_INVALID`). It never falls back to the first id;
 *   - it is written by `activateSigningKey` alone: a new private file, synced, then ONE rename onto
 *     the pointer's name, then the directory synced - after a stop at any point the pointer is the
 *     old one or the new one, whole. It only moves FORWARD in the series;
 *   - A KEY ID IS NEVER USED FOR A SECOND KEY: provisioning refuses an id of which ANY entry is
 *     left in the store, and an id at or before the one the pointer names, also when its files
 *     are gone; `nextSigningKeyId` answers the id after the highest the store has ever named.
 *
 * A LOADED SIGNER ASKS THE STORE AGAIN BEFORE EACH SIGNATURE (task 4 row 226b; decision C69 (1)).
 * A Core keeps the signer it loaded for as long as it runs, and the commands that mark a key or
 * rotate it cannot see a process. So the mark's own words - "the key signs nothing any more" - are
 * held by the signer itself, not by the moment of the load. Before every signature:
 *   - the store directory is looked at as at a load (absent: `KEY_ABSENT`; a link, a foreign owner,
 *     reachable by others: the codes of a load);
 *   - `<keyId>.compromised` present: `KEY_COMPROMISED`. Nothing is signed;
 *   - a signer that was loaded WITHOUT a key id - as THE ACTIVE key, the only form the product
 *     uses - reads the pointer again under its rules: a pointer that cannot be taken is
 *     `ACTIVE_KEY_POINTER_INVALID`, a pointer that names ANOTHER id is `ACTIVE_KEY_CHANGED`.
 * A running Core does NOT go over to the new key by itself: boot checks 4 and 4b judged the key it
 * started with and its `SYSTEM_BOOT` entry names that key, so a seal after a rotation is refused by
 * name until the Core is started again (the rotation command says so). A signer loaded BY its key
 * id (the two host commands, tests) is held to the mark and not to the pointer: it never claimed
 * to be the active key. The cost is three small reads of the store per signature. THE LIMIT,
 * stated: the mark is asked BEFORE the signature, not during it; a mark set in that instant is
 * seen by the next one.
 *
 * A RUNNING CORE HOLDS ITS SIGNER TO ITS BOOT (task 4 row 226c; decision C81; `signerHeldToBoot`).
 * The questions above are asked by a signer of ITS OWN load. Two things they cannot know:
 *   - WHICH KEY THE BOOT JUDGED. A Core that loads its signer at the first use, after a rotation,
 *     loads the NEW active key - a key no boot check of that process judged and its `SYSTEM_BOOT`
 *     entry does not name. The hold is handed the key id of the boot's one loaded certificate: a
 *     signer of another id is refused `ACTIVE_KEY_CHANGED`, when it is taken and before each
 *     signature, whatever the order of load and rotation;
 *   - WHAT TIME IT IS. A load is handed an instant, not a clock, so a signer loaded while its
 *     certificate was valid went on signing after its end - into packages the verify then faults
 *     (`CERTIFICATE_NOT_VALID_AT_SIGNING`). The hold is handed the Core's clock: outside the
 *     certificate's validity nothing is signed, `CERTIFICATE_NOT_VALID_NOW` - the code of a load and
 *     the reason of boot check 4.
 * The hold opens nothing and reads nothing of the store: it compares, and then the signer's own
 * questions follow (the mark, the pointer).
 *
 * NEVER SHOWN. The private key lives in a closure as a non-extractable-by-accident `KeyObject`;
 * the signer object has no member that holds it; no error carries a location, the secret or an
 * error text of the cryptography library.
 */
import { X509Certificate, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify, type KeyObject } from 'node:crypto';
import { chmodSync, closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, renameSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildSelfSignedCertificate, certificateDer, certificatePem, type CertificateSubject } from './der';
import { CORE_EVIDENCE_SIGNING_KEY_ID, SignerError, SignerRefusal, type KeyWrapSecrets, type Signer, type SigningCertificate } from './types';

const KEY_ID = /^[A-Z0-9][A-Z0-9-]{2,62}$/;
const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIR_MODE = 0o700;
const PUBLIC_FILE_MODE = 0o644;
const WRAP_SECRET_BYTES = 32;
const DAY_MS = 86_400_000;
/** Default validity of a provisioned certificate. Rotation issues a new key id (spec §C.3). */
export const SIGNING_CERTIFICATE_VALIDITY_DAYS = 1_825;
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const DEFAULT_SUBJECT = { organization: 'DEMS Core', organizationalUnit: 'Evidence signing' } as const;

interface Places {
  readonly key: string;
  readonly wrap: string;
  readonly certificate: string;
  readonly compromised: string;
}

function placesOf(dir: string, keyId: string): Places {
  if (!KEY_ID.test(keyId)) throw new SignerError(SignerRefusal.KEY_ID_INVALID);
  return { key: join(dir, `${keyId}.p8`), wrap: join(dir, `${keyId}.wrap`), certificate: join(dir, `${keyId}.crt`), compromised: join(dir, `${keyId}.compromised`) };
}

/** No stored file of the signer comes near this: a wrapped Ed25519 key is about 150 bytes, a certificate about 600. */
const STORE_FILE_MAX_BYTES = 16 * 1024;
const GROUP_OR_OTHER_ANY = 0o077;
const GROUP_OR_OTHER_WRITE = 0o022;
// Absent on a platform without them: the store's modes mean nothing there either.
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCKING = constants.O_NONBLOCK ?? 0;

/** The user this process runs as; -1 on a platform that has none (the owner is then not asked). */
const processUid = (): number => (typeof process.getuid === 'function' ? process.getuid() : -1);

const errorCodeOf = (error: unknown): string | null => (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : null);

/** True when the name is taken, by whatever it is: a link that leads nowhere is an entry too. */
function entryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * The store directory as it IS. `false` when there is none (nothing is stored: the caller says
 * "absent"). Refused: a link or a non-directory (`KEY_UNREADABLE`), a directory of another user or
 * one that group or others can reach (`KEY_MODE`).
 */
function storeDirectoryPresent(dir: string, keyId: string, ownerUid: number): boolean {
  let status;
  try {
    status = lstatSync(dir);
  } catch {
    return false;
  }
  if (status.isSymbolicLink() || !status.isDirectory()) throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  if (ownerUid >= 0 && status.uid !== ownerUid) throw new SignerError(SignerRefusal.KEY_MODE, keyId);
  if ((status.mode & GROUP_OR_OTHER_ANY) !== 0) throw new SignerError(SignerRefusal.KEY_MODE, keyId);
  return true;
}

interface StoredKind {
  /** The mode bits the file may not have. */
  readonly forbidden: number;
  /** The code of "another user can reach it": the owner, or a forbidden bit. */
  readonly reachable: SignerRefusal;
  /** The code of "not a readable regular file of the allowed size". */
  readonly unreadable: SignerRefusal;
}
const PRIVATE_FILE: StoredKind = { forbidden: GROUP_OR_OTHER_ANY, reachable: SignerRefusal.KEY_MODE, unreadable: SignerRefusal.KEY_UNREADABLE };
const PUBLIC_FILE: StoredKind = { forbidden: GROUP_OR_OTHER_WRITE, reachable: SignerRefusal.CERTIFICATE_INVALID, unreadable: SignerRefusal.CERTIFICATE_INVALID };

/**
 * THE ONE READER of a stored file (see the file header). Null when the directory or the file is
 * not there; a refusal for everything else. Check and read are on one handle; no link is followed.
 */
function readStored(dir: string, file: string, keyId: string, ownerUid: number, kind: StoredKind): Buffer | null {
  if (!storeDirectoryPresent(dir, keyId, ownerUid)) return null;
  let handle: number;
  try {
    // Without following a link (a link is refused by the open itself), and without waiting on a pipe.
    handle = openSync(file, constants.O_RDONLY | NO_FOLLOW | NON_BLOCKING);
  } catch (error) {
    if (errorCodeOf(error) === 'ENOENT') return null;
    throw new SignerError(kind.unreadable, keyId);
  }
  const buffer = Buffer.alloc(STORE_FILE_MAX_BYTES + 1);
  try {
    const status = fstatSync(handle);
    if (!status.isFile()) throw new SignerError(kind.unreadable, keyId);
    if (ownerUid >= 0 && status.uid !== ownerUid) throw new SignerError(kind.reachable, keyId);
    if ((status.mode & kind.forbidden) !== 0) throw new SignerError(kind.reachable, keyId);
    if (status.size > STORE_FILE_MAX_BYTES) throw new SignerError(kind.unreadable, keyId);
    let length = 0;
    for (;;) {
      const read = readSync(handle, buffer, length, buffer.length - length, null);
      if (read === 0) break;
      length += read;
      // The file grew after the size was read: still not read past the bound.
      if (length > STORE_FILE_MAX_BYTES) throw new SignerError(kind.unreadable, keyId);
    }
    return Buffer.from(buffer.subarray(0, length));
  } catch (error) {
    // The operating system's own text is dropped on purpose.
    throw error instanceof SignerError ? error : new SignerError(kind.unreadable, keyId);
  } finally {
    buffer.fill(0);
    closeSync(handle);
  }
}

/** A new file: created exclusively without following a link, set to its mode on the handle, written and synced. */
function writeNew(file: string, bytes: Uint8Array | string, mode: number, keyId: string): void {
  let handle: number | null = null;
  try {
    handle = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NO_FOLLOW, mode);
    // The process mask may have cleared bits, never added any; set the mode explicitly all the same.
    fchmodSync(handle, mode);
    const data = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes;
    for (let written = 0; written < data.length; ) written += writeSync(handle, data, written, data.length - written);
    fsyncSync(handle);
  } catch (error) {
    throw new SignerError(errorCodeOf(error) === 'EEXIST' ? SignerRefusal.KEY_EXISTS : SignerRefusal.KEY_UNREADABLE, keyId);
  } finally {
    if (handle !== null) closeSync(handle);
  }
}

/** Syncs a directory, so that the names created in it survive a loss of power (SX-16). */
function syncDirectory(dir: string, keyId: string): void {
  let handle: number | null = null;
  try {
    handle = openSync(dir, constants.O_RDONLY);
    fsyncSync(handle);
  } catch {
    throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  } finally {
    if (handle !== null) closeSync(handle);
  }
}

/**
 * Syncs the directory that holds a directory this unit just made. Not a refusal when it cannot be
 * opened: the store itself is synced and loads; a parent the Core's user may enter but not read is
 * a legitimate place for a data directory, and the answer of a provisioning must not depend on it.
 */
function syncParentOf(createdDirectory: string): void {
  let handle: number | null = null;
  try {
    handle = openSync(dirname(createdDirectory), constants.O_RDONLY);
    fsyncSync(handle);
  } catch {
    // See above: the one place of this file where a failure is not a refusal.
  } finally {
    if (handle !== null) closeSync(handle);
  }
}

/** The name of the pointer in the store directory (see the file header, "THE ACTIVE KEY ID"). */
export const ACTIVE_KEY_POINTER_NAME = 'ACTIVE';
const KEY_SERIES_PREFIX = 'CORE-KEY-EVSIGN-';
const KEY_SERIES = /^CORE-KEY-EVSIGN-(\d{2})$/;
const KEY_SERIES_ANYWHERE = /CORE-KEY-EVSIGN-(\d{2})(?!\d)/g;
const KEY_SERIES_LAST = 99;
/** The pointer is held to the rules of a private key file; every refusal of it is the one code. */
const POINTER_FILE: StoredKind = { forbidden: GROUP_OR_OTHER_ANY, reachable: SignerRefusal.ACTIVE_KEY_POINTER_INVALID, unreadable: SignerRefusal.ACTIVE_KEY_POINTER_INVALID };

/** The place of a key id in the series (`CORE-KEY-EVSIGN-01` = 1 ... `-99` = 99), or null for an id outside it. */
export function signingKeySeriesNumber(keyId: string): number | null {
  const match = KEY_SERIES.exec(keyId);
  const place = match === null ? 0 : Number(match[1]);
  return place >= 1 ? place : null;
}

const seriesKeyId = (place: number): string => `${KEY_SERIES_PREFIX}${String(place).padStart(2, '0')}`;

/**
 * The key id the pointer names, or null when the store has no pointer (or there is no store).
 * A pointer that is there and cannot be taken is `ACTIVE_KEY_POINTER_INVALID`; the store directory
 * itself is refused as for every stored file, with the codes it always had.
 */
function pointedKeyId(dir: string, ownerUid: number): string | null {
  let bytes: Buffer | null;
  try {
    bytes = readStored(dir, join(dir, ACTIVE_KEY_POINTER_NAME), CORE_EVIDENCE_SIGNING_KEY_ID, ownerUid, POINTER_FILE);
  } catch (error) {
    // The refusal of the pointer names no key id: no key id was read.
    if (error instanceof SignerError && error.code === SignerRefusal.ACTIVE_KEY_POINTER_INVALID) throw new SignerError(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
    throw error;
  }
  if (bytes === null) return null;
  // Exactly one key id of the series and one line end: nothing before, between or after.
  const text = bytes.toString('latin1');
  const keyId = text.slice(0, -1);
  if (!text.endsWith('\n') || signingKeySeriesNumber(keyId) === null) throw new SignerError(SignerRefusal.ACTIVE_KEY_POINTER_INVALID);
  return keyId;
}

/**
 * THE ONE RESOLVER OF THE ACTIVE KEY ID (row 225, SX-09 (a), (b)). No pointer: the first key id.
 * A pointer: the id it names. A pointer that cannot be taken: a `SignerError`, never a fall-back.
 * It reads the pointer and nothing else: whether the key of that id loads is the loader's question.
 */
export function activeSigningKeyId(options: { readonly dir: string; readonly ownerUid?: number }): string {
  return pointedKeyId(options.dir, options.ownerUid ?? processUid()) ?? CORE_EVIDENCE_SIGNING_KEY_ID;
}

/** The names of the entries of the store directory; none when it cannot be listed (the caller has looked at the directory before). */
function storeEntryNames(dir: string): readonly string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * SX-09 (e): true when the key id has been used in this store - ANY entry of that id is left (a
 * key file, a certificate, a mark, a record), or the pointer names that id or a later one of the
 * series. An id that was used is never provisioned again, also when its key files are gone.
 *
 * ALSO IN A STORE EDITED BY HAND (task 4 row 226d; review 230 caution R-5). The two questions above
 * look at entries of THAT id and at the pointer. A store from which the pointer and every entry of
 * an early id were removed, copied away or renamed, while entries of LATER ids remain, answered
 * "not spent" - and a second key was made under an id that once named another. So, for an id of
 * the series: ANY entry whose name holds an id of the series AT OR AFTER it spends it - a key file,
 * a certificate, a mark, a record, a staged pointer. The series is only ever handed out upwards
 * (`nextSigningKeyId`), so a later id in the store means every earlier one was used. THE LIMIT,
 * stated: a store emptied of EVERYTHING of the series has no memory; that is an empty store.
 */
function keyIdSpent(dir: string, keyId: string, ownerUid: number): boolean {
  const entries = storeEntryNames(dir);
  if (entries.some((name) => name.startsWith(`${keyId}.`))) return true;
  const place = signingKeySeriesNumber(keyId);
  const pointed = pointedKeyId(dir, ownerUid);
  if (place === null) return false;
  if (pointed !== null && place <= (signingKeySeriesNumber(pointed) ?? 0)) return true;
  return entries.some((name) => [...name.matchAll(KEY_SERIES_ANYWHERE)].some((match) => Number(match[1]) >= place));
}

/**
 * The key id a rotation provisions: the one after the HIGHEST the store has ever named - in the
 * name of any entry or in the pointer. An empty or absent store answers the first id. Refused:
 * `KEY_SERIES_EXHAUSTED` after `-99`, and whatever the pointer or the directory is refused with.
 */
export function nextSigningKeyId(options: { readonly dir: string; readonly ownerUid?: number }): string {
  const ownerUid = options.ownerUid ?? processUid();
  const pointed = pointedKeyId(options.dir, ownerUid);
  let highest = pointed === null ? 0 : (signingKeySeriesNumber(pointed) ?? 0);
  for (const name of storeEntryNames(options.dir)) {
    for (const match of name.matchAll(KEY_SERIES_ANYWHERE)) highest = Math.max(highest, Number(match[1]));
  }
  if (highest >= KEY_SERIES_LAST) throw new SignerError(SignerRefusal.KEY_SERIES_EXHAUSTED);
  return seriesKeyId(highest + 1);
}

/**
 * The built-in wrap-secret source: one private file per key id beside the key file. `ownerUid` is
 * the user the store must belong to (default: the user of this process; see `KeyStoreOptions`).
 */
export function fileWrapSecrets(dir: string, ownerUid: number = processUid()): KeyWrapSecrets {
  return Object.freeze({
    get(keyId: string): Uint8Array | null {
      return readStored(dir, placesOf(dir, keyId).wrap, keyId, ownerUid, PRIVATE_FILE);
    },
    put(keyId: string, secret: Uint8Array): void {
      writeNew(placesOf(dir, keyId).wrap, secret, PRIVATE_FILE_MODE, keyId);
    },
  });
}

function rawPublicKey(key: KeyObject): Buffer {
  const spki = key.export({ format: 'der', type: 'spki' });
  return Buffer.from(spki.subarray(spki.length - 32));
}

function publicKeyObject(raw: Uint8Array): KeyObject {
  return createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw]), format: 'der', type: 'spki' });
}

/** True when `signature` is the Ed25519 signature of `message` under the raw 32-byte public key. */
export function verifyEd25519(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  if (publicKey.length !== 32 || signature.length !== 64) return false;
  try {
    return verify(null, message, publicKeyObject(publicKey), signature);
  } catch {
    return false;
  }
}

/**
 * Reads a certificate as public data: parses it, checks its self-signature, and returns what the
 * manifest and a verifier need. A receiver without the Core's key uses exactly this (OD-16).
 */
export function readSigningCertificate(pem: string, keyId: string): SigningCertificate {
  const der = certificateDer(pem);
  if (der === null) throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  let parsed: X509Certificate;
  let publicKey: Buffer;
  try {
    parsed = new X509Certificate(der);
    if (parsed.publicKey.asymmetricKeyType !== 'ed25519' || !parsed.verify(parsed.publicKey)) throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
    publicKey = rawPublicKey(parsed.publicKey);
  } catch {
    throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  }
  return Object.freeze({
    keyId,
    pemText: certificatePem(der),
    sha256: createHash('sha256').update(der).digest('hex'),
    subject: parsed.subject.split('\n').reverse().join(','),
    serialNumber: parsed.serialNumber.toUpperCase(),
    notBefore: parsed.validFromDate.getTime(),
    notAfter: parsed.validToDate.getTime(),
    publicKey,
  });
}

function softwareSigner(keyId: string, privateKey: KeyObject, stillSigns: () => void): Signer {
  const publicRaw = rawPublicKey(createPublicKey(privateKey));
  return Object.freeze({
    algorithm: 'Ed25519' as const,
    keyId,
    // Row 226b: the store is asked again before EACH signature (see the file header, "A LOADED SIGNER").
    sign: (message: Uint8Array): Uint8Array => {
      stillSigns();
      return new Uint8Array(sign(null, message, privateKey));
    },
    publicKey: (): Uint8Array => new Uint8Array(publicRaw),
  });
}

export interface KeyStoreOptions {
  /** The signer store directory (under the data directory; never the media store). */
  readonly dir: string;
  /** Default `CORE-KEY-EVSIGN-01`. */
  readonly keyId?: string;
  /** Default: `fileWrapSecrets(dir)`. */
  readonly wrapSecrets?: KeyWrapSecrets;
  /**
   * The user the store must belong to. Default, and the only value of the product: the user of
   * this process. It is ONE number and not a replaceable `stat`, so that no caller can change what
   * the file system says about a key file; a test states another user to see a store of a foreign
   * owner refused (row 210).
   */
  readonly ownerUid?: number;
}

export interface ProvisionOptions extends KeyStoreOptions {
  /** The instant the certificate becomes valid (the server clock's, epoch milliseconds). */
  readonly now: number;
  readonly validityDays?: number;
  readonly subject?: Partial<CertificateSubject>;
}

/**
 * Creates a new key and its certificate. Explicit, once per key id: it refuses when anything of
 * that key id is already there. Returns the certificate (public data); the key never leaves.
 */
export function provisionSigningKey(options: ProvisionOptions): SigningCertificate {
  const keyId = options.keyId ?? CORE_EVIDENCE_SIGNING_KEY_ID;
  const places = placesOf(options.dir, keyId);
  const ownerUid = options.ownerUid ?? processUid();
  const wrapSecrets = options.wrapSecrets ?? fileWrapSecrets(options.dir, ownerUid);
  let created: string | undefined;
  try {
    created = mkdirSync(options.dir, { recursive: true, mode: PRIVATE_DIR_MODE });
    // `mkdir` and `chmod` follow a link: the entry is looked at as it IS before its mode is set (SX-05).
    const status = lstatSync(options.dir);
    if (status.isSymbolicLink() || !status.isDirectory()) throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
    if (ownerUid >= 0 && status.uid !== ownerUid) throw new SignerError(SignerRefusal.KEY_MODE, keyId);
    chmodSync(options.dir, PRIVATE_DIR_MODE);
  } catch (error) {
    throw error instanceof SignerError ? error : new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  }
  if (entryExists(places.key) || entryExists(places.certificate) || entryExists(places.compromised) || wrapSecrets.get(keyId) !== null) {
    throw new SignerError(SignerRefusal.KEY_EXISTS, keyId);
  }
  // SX-09 (e): an id that was ever used in this store is not given to a second key.
  if (keyIdSpent(options.dir, keyId, ownerUid)) throw new SignerError(SignerRefusal.KEY_EXISTS, keyId);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicRaw = rawPublicKey(publicKey);
  const secret = randomBytes(WRAP_SECRET_BYTES);
  try {
    const wrapped = privateKey.export({ format: 'der', type: 'pkcs8', cipher: 'aes-256-cbc', passphrase: secret });
    const der = buildSelfSignedCertificate(
      {
        subject: { ...DEFAULT_SUBJECT, commonName: keyId, ...options.subject },
        serial: randomBytes(16),
        notBefore: options.now,
        notAfter: options.now + (options.validityDays ?? SIGNING_CERTIFICATE_VALIDITY_DAYS) * DAY_MS,
        publicKey: publicRaw,
        keyIdentifier: createHash('sha256').update(publicRaw).digest().subarray(0, 20),
      },
      (tbs) => sign(null, tbs, privateKey),
    );
    wrapSecrets.put(keyId, secret);
    writeNew(places.key, wrapped, PRIVATE_FILE_MODE, keyId);
    writeNew(places.certificate, certificatePem(der), PUBLIC_FILE_MODE, keyId);
    // SX-16: each file was synced as it was written; now the names. The directory itself is new to
    // its parent when this call made it: that name is synced as well (where the parent can be opened).
    syncDirectory(options.dir, keyId);
    if (created !== undefined) syncParentOf(created);
    return readSigningCertificate(certificatePem(der), keyId);
  } finally {
    secret.fill(0);
  }
}

export interface LoadedSigner {
  readonly signer: Signer;
  readonly certificate: SigningCertificate;
}

/**
 * Opens the key of that id. Fails closed with a `SignerError`; creates nothing. With `now`, a
 * certificate whose validity does not cover that instant is refused as well.
 */
export function loadSoftwareSigner(options: KeyStoreOptions & { readonly now?: number }): LoadedSigner {
  const ownerUid = options.ownerUid ?? processUid();
  // No key id handed in = the ACTIVE one, by the one resolver (row 225): the first id for a store without a pointer.
  const keyId = options.keyId ?? activeSigningKeyId({ dir: options.dir, ownerUid });
  const places = placesOf(options.dir, keyId);
  // The directory first, as it is: a link, a foreign owner or a mode others can reach is refused before any file is looked at.
  if (!storeDirectoryPresent(options.dir, keyId, ownerUid)) throw new SignerError(SignerRefusal.KEY_ABSENT, keyId);
  if (entryExists(places.compromised)) throw new SignerError(SignerRefusal.KEY_COMPROMISED, keyId);
  const wrapped = readStored(options.dir, places.key, keyId, ownerUid, PRIVATE_FILE);
  if (wrapped === null) throw new SignerError(SignerRefusal.KEY_ABSENT, keyId);
  const secret = (options.wrapSecrets ?? fileWrapSecrets(options.dir, ownerUid)).get(keyId);
  if (secret === null) throw new SignerError(SignerRefusal.KEY_ABSENT, keyId);
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({ key: wrapped, format: 'der', type: 'pkcs8', passphrase: Buffer.from(secret) });
  } catch {
    // The library's own text is dropped on purpose.
    throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  const pem = readStored(options.dir, places.certificate, keyId, ownerUid, PUBLIC_FILE);
  if (pem === null) throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  const certificate = readSigningCertificate(pem.toString('utf8'), keyId);
  // Row 226b: what the signer asks of the store before each signature. A load without a key id is a
  // load of THE ACTIVE key, and only such a signer is held to the pointer.
  const loadedAsActive = options.keyId === undefined;
  const stillSigns = (): void => {
    if (!storeDirectoryPresent(options.dir, keyId, ownerUid)) throw new SignerError(SignerRefusal.KEY_ABSENT, keyId);
    if (entryExists(places.compromised)) throw new SignerError(SignerRefusal.KEY_COMPROMISED, keyId);
    if (loadedAsActive && activeSigningKeyId({ dir: options.dir, ownerUid }) !== keyId) throw new SignerError(SignerRefusal.ACTIVE_KEY_CHANGED, keyId);
  };
  const signer = softwareSigner(keyId, privateKey, stillSigns);
  if (!Buffer.from(certificate.publicKey).equals(Buffer.from(signer.publicKey()))) throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  if (options.now !== undefined && (options.now < certificate.notBefore || options.now > certificate.notAfter)) {
    throw new SignerError(SignerRefusal.CERTIFICATE_NOT_VALID_NOW, keyId);
  }
  return Object.freeze({ signer, certificate });
}

/** What a running Core holds its loaded signer to, besides the store's own questions (row 226c; see the file header). */
export interface SignerHold {
  /**
   * The key id of the ONE certificate the boot checks of this process loaded and judged (checks 4,
   * 4b, 4b-2). Null: no boot check of this process loaded a key of the store - there is nothing to
   * hold the signer to, and it is held to the clock and to its own questions only. Row 226d: the
   * signer host of a running Core never hands such a hold in - `refuseHoldWithoutBootKey` first.
   */
  readonly bootKeyId: string | null;
  /** The Core's clock, epoch milliseconds: the clock the boot check asked the certificate's validity on. */
  readonly now: () => number;
}

/**
 * THE HOLD (task 4 row 226c; decision C81). `loaded` is a signer loaded as THE ACTIVE key - the
 * only form the product loads. The answer signs with the same key and asks FIRST, when it is made
 * and before EACH signature:
 *   - `ACTIVE_KEY_CHANGED` when the signer is not of the key id the boot judged. Together with the
 *     signer's own question (the pointer names its id) this is: the store's active key id equals
 *     the boot's, or nothing is signed until the Core is started again;
 *   - `CERTIFICATE_NOT_VALID_NOW` when the clock is outside the certificate's validity.
 * A refusal when the hold is MADE means the caller never gets a signer, nor the certificate, of a
 * key the boot did not judge. Pure: no file is opened and nothing is kept but what was handed in.
 */
export function signerHeldToBoot(loaded: LoadedSigner, hold: SignerHold): LoadedSigner {
  const { certificate } = loaded;
  const inner = loaded.signer;
  const keyId = inner.keyId;
  const stillHeld = (): void => {
    if (hold.bootKeyId !== null && keyId !== hold.bootKeyId) throw new SignerError(SignerRefusal.ACTIVE_KEY_CHANGED, hold.bootKeyId);
    const at = hold.now();
    if (at < certificate.notBefore || at > certificate.notAfter) throw new SignerError(SignerRefusal.CERTIFICATE_NOT_VALID_NOW, keyId);
  };
  stillHeld();
  const held: Signer = Object.freeze({
    algorithm: inner.algorithm,
    keyId,
    sign: (message: Uint8Array): Promise<Uint8Array> | Uint8Array => {
      stillHeld();
      return inner.sign(message);
    },
    publicKey: (): Uint8Array => inner.publicKey(),
  });
  return Object.freeze({ signer: held, certificate });
}

/**
 * THE NULL DOOR REFUSES (task 4 row 226d; review 230 caution R-7). `signerHeldToBoot` takes a hold
 * without a boot key as "nothing to hold to" - right for a unit that has no boot. A RUNNING CORE of
 * an operation whose boot judges a key (both real ones) is never in that case: there a hold
 * without a boot key means that no boot check of this process has judged a key - the step has not
 * passed, was refused, or loaded no key of the store. Its signer host asks THIS first, before it
 * loads anything: `BOOT_KEY_NOT_JUDGED`, and no signer is taken unheld. Pure; names no key id (none
 * was judged).
 */
export function refuseHoldWithoutBootKey(hold: SignerHold): void {
  if (hold.bootKeyId === null) throw new SignerError(SignerRefusal.BOOT_KEY_NOT_JUDGED);
}

/**
 * Makes the key of `keyId` the ACTIVE one (row 225; the pointer's ONE writer; the command of row
 * 226 is its caller). Everything that can refuse is asked first: the id is of the series and LATER
 * than the active one (the pointer only moves forward; a pointer that cannot be taken is refused,
 * never repaired here), and the key of that id LOADS at `now` - the pointer never names a key that
 * does not sign. Then the write, which is the pointer's own and replaces nothing else:
 *
 *   1. a NEW private file `ACTIVE.<key id>.next`, created exclusively, written and synced;
 *   2. ONE rename of it onto `ACTIVE`;
 *   3. the directory synced.
 *
 * A stop before 2 leaves the old pointer (or none) and the staged file, which nothing reads and
 * nothing removes; a stop after 2 leaves the new pointer. There is no state in which `ACTIVE`
 * holds part of an id.
 */
export function activateSigningKey(options: KeyStoreOptions & { readonly keyId: string; readonly now: number }): void {
  const { dir, keyId } = options;
  const ownerUid = options.ownerUid ?? processUid();
  const place = signingKeySeriesNumber(keyId);
  if (place === null) throw new SignerError(SignerRefusal.KEY_ID_INVALID);
  if (!storeDirectoryPresent(dir, keyId, ownerUid)) throw new SignerError(SignerRefusal.KEY_ABSENT, keyId);
  const active = activeSigningKeyId({ dir, ownerUid });
  if (place <= (signingKeySeriesNumber(active) ?? 0)) throw new SignerError(SignerRefusal.ACTIVE_KEY_NOT_NEWER, keyId);
  loadSoftwareSigner(options);
  const staged = join(dir, `${ACTIVE_KEY_POINTER_NAME}.${keyId}.next`);
  // Exclusive: a staged file left by an interrupted activation of this very id is not written over (`KEY_EXISTS`).
  writeNew(staged, `${keyId}\n`, PRIVATE_FILE_MODE, keyId);
  try {
    renameSync(staged, join(dir, ACTIVE_KEY_POINTER_NAME));
  } catch {
    throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  }
  syncDirectory(dir, keyId);
}

/**
 * Runbook step (b): marks a key compromised. From then on it loads for nobody. The key file and
 * the certificate stay: the certificate is needed to re-verify what the key signed (step d), and
 * nothing that was sealed is rewritten (OD-15). Idempotent. The mark holds the fact and the
 * instant, nothing else.
 *
 * THE DIRECTORY IS LOOKED AT FIRST, as before every read (task 4 row 226d; review 230 caution
 * R-6). The mark was the one act of this file that wrote without that look: into a store that is a
 * link, of another user or reachable by others, the mark went to a place the loader then refuses
 * for another reason - written, and not in force. Now: no store is `KEY_ABSENT`; a link or a
 * non-directory `KEY_UNREADABLE`; a foreign owner or a bit for group or others `KEY_MODE`. Each
 * refuses BEFORE anything is written, also when a mark is already there.
 */
export function markSigningKeyCompromised(options: { readonly dir: string; readonly keyId?: string; readonly at: number; readonly ownerUid?: number }): void {
  const keyId = options.keyId ?? CORE_EVIDENCE_SIGNING_KEY_ID;
  const places = placesOf(options.dir, keyId);
  if (!storeDirectoryPresent(options.dir, keyId, options.ownerUid ?? processUid())) throw new SignerError(SignerRefusal.KEY_ABSENT, keyId);
  if (entryExists(places.compromised)) return;
  writeNew(places.compromised, `${JSON.stringify({ keyId, compromisedAt: options.at })}\n`, PUBLIC_FILE_MODE, keyId);
  // The mark must not be lost with the power: from here on the key signs nothing.
  syncDirectory(options.dir, keyId);
}

/** What the store holds of ONE key id: names only, no content (row 226d). */
export interface SigningKeyStoreLook {
  /** `<key id>.p8` is there. */
  readonly key: boolean;
  /** `<key id>.wrap` is there (the built-in wrap-secret source). */
  readonly opener: boolean;
  /** `<key id>.crt` is there. */
  readonly certificate: boolean;
  /** `<key id>.compromised` is there: the key is marked. */
  readonly mark: boolean;
}

/**
 * THE LOOK BEFORE A MARK (task 4 row 226d; review 230 caution R-6): what the store holds of that
 * key id, by entry NAME - no file is opened. Null when there is no store. The directory is looked
 * at as before every read (a link, a foreign owner, reachable by others: the codes of a load), and
 * a directory that cannot be LISTED is `KEY_UNREADABLE` - never "nothing found".
 */
export function lookAtSigningKeyStore(options: { readonly dir: string; readonly keyId: string; readonly ownerUid?: number }): SigningKeyStoreLook | null {
  const { dir, keyId } = options;
  placesOf(dir, keyId);
  if (!storeDirectoryPresent(dir, keyId, options.ownerUid ?? processUid())) return null;
  let entries: ReadonlySet<string>;
  try {
    entries = new Set(readdirSync(dir));
  } catch {
    throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  }
  const has = (extension: string): boolean => entries.has(`${keyId}.${extension}`);
  return Object.freeze({ key: has('p8'), opener: has('wrap'), certificate: has('crt'), mark: has('compromised') });
}

/**
 * The certificate of a key id as public data, also of a compromised or rotated-out key
 * (re-verification). Without a key id: the certificate of the ACTIVE key, by the one resolver.
 */
export function readStoredCertificate(options: { readonly dir: string; readonly keyId?: string; readonly ownerUid?: number }): SigningCertificate {
  const ownerUid = options.ownerUid ?? processUid();
  let keyId = options.keyId ?? CORE_EVIDENCE_SIGNING_KEY_ID;
  let pem: Buffer | null;
  try {
    // A pointer that cannot be taken names no key: the certificate of "the active key" was not read (this function's one code).
    if (options.keyId === undefined) keyId = activeSigningKeyId({ dir: options.dir, ownerUid });
    pem = readStored(options.dir, placesOf(options.dir, keyId).certificate, keyId, ownerUid, PUBLIC_FILE);
  } catch (error) {
    // This function's one code: whatever is wrong with the store, the certificate was not read from it.
    if (error instanceof SignerError && error.code === SignerRefusal.KEY_ID_INVALID) throw error;
    throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  }
  if (pem === null) throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  return readSigningCertificate(pem.toString('utf8'), keyId);
}

/** One certificate of the retained set: public data, and whether its key carries the compromise mark. */
export interface RetainedCertificate {
  readonly certificate: SigningCertificate;
  /** `<keyId>.compromised` is in the store: what this key signed is not proven by its signature alone. */
  readonly compromised: boolean;
}

/** Why a certificate file of the store is NOT in the retained set. */
export const RetainedCertificateRefusal = {
  /** Not a regular file of this user that others cannot write, too large, not a certificate, or its self-signature does not verify. */
  CERTIFICATE_INVALID: 'CERTIFICATE_INVALID',
  /** A key id LATER than the active one: provisioned and never made active (a rotation that stopped). Nothing was sealed under it. */
  NEVER_ACTIVE: 'NEVER_ACTIVE',
  /** A name that is no key id of the series `CORE-KEY-EVSIGN-NN`: no key the Core could have loaded. */
  NOT_OF_THE_SERIES: 'NOT_OF_THE_SERIES',
} as const;
export type RetainedCertificateRefusal = (typeof RetainedCertificateRefusal)[keyof typeof RetainedCertificateRefusal];

export interface RetainedCertificateSet {
  /** In the order of the series. Each was parsed and its self-signature verified. */
  readonly certificates: readonly RetainedCertificate[];
  /** The certificate files that were left out, by the name before `.crt` (a file name, never a content) and the reason. */
  readonly refused: readonly { readonly name: string; readonly reason: RetainedCertificateRefusal }[];
}

/**
 * THE RETAINED CERTIFICATE SET (task 4 row 227, package X1-4; security review SX-09 (c); Known limit
 * 30): the certificates of every key that IS or WAS the active key of this store - what the Core's
 * own verify may hold a package or a transcript revision to after a rotation. Public data only: no
 * key file and no wrap secret is opened.
 *
 * A certificate is in the set only when ALL of this holds:
 *   - its file is `<key id>.crt` with a key id of the series, AT OR BEFORE the active one (the one
 *     resolver). A key that was provisioned and never made active signed nothing the Core sealed:
 *     its certificate is left out (`NEVER_ACTIVE`);
 *   - the file is read as every stored certificate is (`readStored`: no link followed, a regular
 *     file of this user that group and others cannot write, bounded);
 *   - it PARSES and its SELF-SIGNATURE VERIFIES (`readSigningCertificate`).
 * Everything else in the directory - the pointer, a staged pointer, a provisioning record, key
 * files - is not looked at. A certificate that is left out is named in `refused`; it never makes
 * the read fail, and it is never trusted.
 *
 * WHAT IT DOES NOT JUDGE: whether a certificate is a development one, and what a compromise mark
 * means for a verdict - the caller's rules (`sealing/signing.ts`, `evidence-verify`).
 *
 * THROWS, as a load does, when the STORE cannot be taken: a directory that is a link, of another
 * user or reachable by others, and a pointer that cannot be read (`ACTIVE_KEY_POINTER_INVALID`) -
 * then no set exists and the caller trusts nothing. An absent store is the empty set.
 */
export function readRetainedCertificates(options: { readonly dir: string; readonly ownerUid?: number }): RetainedCertificateSet {
  const ownerUid = options.ownerUid ?? processUid();
  if (!storeDirectoryPresent(options.dir, CORE_EVIDENCE_SIGNING_KEY_ID, ownerUid)) return Object.freeze({ certificates: Object.freeze([]), refused: Object.freeze([]) });
  const activePlace = signingKeySeriesNumber(activeSigningKeyId({ dir: options.dir, ownerUid })) ?? 0;
  const certificates: { readonly place: number; readonly entry: RetainedCertificate }[] = [];
  const refused: { readonly name: string; readonly reason: RetainedCertificateRefusal }[] = [];
  for (const entryName of [...storeEntryNames(options.dir)].sort()) {
    if (!entryName.endsWith('.crt')) continue;
    const name = entryName.slice(0, -'.crt'.length);
    const place = signingKeySeriesNumber(name);
    if (place === null) {
      refused.push({ name, reason: RetainedCertificateRefusal.NOT_OF_THE_SERIES });
      continue;
    }
    if (place > activePlace) {
      refused.push({ name, reason: RetainedCertificateRefusal.NEVER_ACTIVE });
      continue;
    }
    try {
      const certificate = readStoredCertificate({ dir: options.dir, keyId: name, ownerUid });
      certificates.push({ place, entry: Object.freeze({ certificate, compromised: entryExists(placesOf(options.dir, name).compromised) }) });
    } catch {
      refused.push({ name, reason: RetainedCertificateRefusal.CERTIFICATE_INVALID });
    }
  }
  certificates.sort((left, right) => left.place - right.place);
  return Object.freeze({ certificates: Object.freeze(certificates.map((item) => item.entry)), refused: Object.freeze(refused.map((item) => Object.freeze(item))) });
}
