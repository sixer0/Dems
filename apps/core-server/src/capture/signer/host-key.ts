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
 * NEVER SHOWN. The private key lives in a closure as a non-extractable-by-accident `KeyObject`;
 * the signer object has no member that holds it; no error carries a location, the secret or an
 * error text of the cryptography library.
 */
import { X509Certificate, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify, type KeyObject } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** Reads a private file. Refuses, before reading, one that group or others can reach. */
function readPrivate(file: string, keyId: string): Buffer | null {
  let mode: number;
  try {
    mode = statSync(file).mode & 0o777;
  } catch {
    return null;
  }
  if ((mode & 0o077) !== 0) throw new SignerError(SignerRefusal.KEY_MODE, keyId);
  try {
    return readFileSync(file);
  } catch {
    throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  }
}

function writeNew(file: string, bytes: Uint8Array | string, mode: number, keyId: string): void {
  try {
    writeFileSync(file, bytes, { mode, flag: 'wx' });
    // The process mask may have cleared bits, never added any; set the mode explicitly all the same.
    chmodSync(file, mode);
  } catch (error) {
    const exists = typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
    throw new SignerError(exists ? SignerRefusal.KEY_EXISTS : SignerRefusal.KEY_UNREADABLE, keyId);
  }
}

/** The built-in wrap-secret source: one private file per key id beside the key file. */
export function fileWrapSecrets(dir: string): KeyWrapSecrets {
  return Object.freeze({
    get(keyId: string): Uint8Array | null {
      return readPrivate(placesOf(dir, keyId).wrap, keyId);
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

function softwareSigner(keyId: string, privateKey: KeyObject): Signer {
  const publicRaw = rawPublicKey(createPublicKey(privateKey));
  return Object.freeze({
    algorithm: 'Ed25519' as const,
    keyId,
    sign: (message: Uint8Array): Uint8Array => new Uint8Array(sign(null, message, privateKey)),
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
  const wrapSecrets = options.wrapSecrets ?? fileWrapSecrets(options.dir);
  try {
    mkdirSync(options.dir, { recursive: true, mode: PRIVATE_DIR_MODE });
    chmodSync(options.dir, PRIVATE_DIR_MODE);
  } catch {
    throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  }
  if (existsSync(places.key) || existsSync(places.certificate) || existsSync(places.compromised) || wrapSecrets.get(keyId) !== null) {
    throw new SignerError(SignerRefusal.KEY_EXISTS, keyId);
  }
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
  const keyId = options.keyId ?? CORE_EVIDENCE_SIGNING_KEY_ID;
  const places = placesOf(options.dir, keyId);
  if (existsSync(places.compromised)) throw new SignerError(SignerRefusal.KEY_COMPROMISED, keyId);
  const wrapped = readPrivate(places.key, keyId);
  if (wrapped === null) throw new SignerError(SignerRefusal.KEY_ABSENT, keyId);
  const secret = (options.wrapSecrets ?? fileWrapSecrets(options.dir)).get(keyId);
  if (secret === null) throw new SignerError(SignerRefusal.KEY_ABSENT, keyId);
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({ key: wrapped, format: 'der', type: 'pkcs8', passphrase: Buffer.from(secret) });
  } catch {
    // The library's own text is dropped on purpose.
    throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new SignerError(SignerRefusal.KEY_UNREADABLE, keyId);
  let pem: string;
  try {
    pem = readFileSync(places.certificate, 'utf8');
  } catch {
    throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  }
  const certificate = readSigningCertificate(pem, keyId);
  const signer = softwareSigner(keyId, privateKey);
  if (!Buffer.from(certificate.publicKey).equals(Buffer.from(signer.publicKey()))) throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  if (options.now !== undefined && (options.now < certificate.notBefore || options.now > certificate.notAfter)) {
    throw new SignerError(SignerRefusal.CERTIFICATE_NOT_VALID_NOW, keyId);
  }
  return Object.freeze({ signer, certificate });
}

/**
 * Runbook step (b): marks a key compromised. From then on it loads for nobody. The key file and
 * the certificate stay: the certificate is needed to re-verify what the key signed (step d), and
 * nothing that was sealed is rewritten (OD-15). Idempotent. The mark holds the fact and the
 * instant, nothing else.
 */
export function markSigningKeyCompromised(options: { readonly dir: string; readonly keyId?: string; readonly at: number }): void {
  const keyId = options.keyId ?? CORE_EVIDENCE_SIGNING_KEY_ID;
  const places = placesOf(options.dir, keyId);
  if (existsSync(places.compromised)) return;
  writeNew(places.compromised, `${JSON.stringify({ keyId, compromisedAt: options.at })}\n`, PUBLIC_FILE_MODE, keyId);
}

/** The certificate of a key id as public data, also of a compromised or rotated-out key (re-verification). */
export function readStoredCertificate(options: { readonly dir: string; readonly keyId?: string }): SigningCertificate {
  const keyId = options.keyId ?? CORE_EVIDENCE_SIGNING_KEY_ID;
  let pem: string;
  try {
    pem = readFileSync(placesOf(options.dir, keyId).certificate, 'utf8');
  } catch {
    throw new SignerError(SignerRefusal.CERTIFICATE_INVALID, keyId);
  }
  return readSigningCertificate(pem, keyId);
}
