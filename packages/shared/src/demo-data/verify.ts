/**
 * Pure verification helpers for the DEMO evidence packages (blueprint step 93; D50, D51).
 *
 * - Hashes use `@noble/hashes` (pure JS; the same library the simulator's audit chain uses), so
 *   they run the same on the web, in Hermes and in tests.
 * - Ed25519 checks use WebCrypto (`crypto.subtle`, algorithm "Ed25519") when the runtime offers it.
 *   Where it does not (Hermes, older browsers), the helpers return `null` and `verifyDemoPackage`
 *   falls back to the generator's precomputed result for that check, marked `source: 'precomputed'`.
 * - No DOM and no Node built-ins: callers pass file bytes in through a loader.
 *
 * Check rules (the same as the generator's own Node-crypto verification and the step-93 test):
 * - `track:<ID>`: SHA-256 of the stored media file equals the sealed manifest's hash for that track.
 * - `manifest`: SHA-256 of manifest.json equals the digest recorded in signature.sig.
 * - `signature`: the Ed25519 signature verifies over the 32 digest bytes of manifest.json, with the
 *   public key of the package's device certificate.
 * - `certificate`: the certificate's SHA-256 matches the index, its self-signature verifies, its key is
 *   the DEMO key, and its validity covers the signing time.
 * - `auditChain`: every row of the session extract recomputes with the simulator's chain rule
 *   `hash = sha256(prevHash ‖ canonicalJSON(body))`, seq numbers increase, and consecutive rows link.
 * - `exportPackage` / `exportSignature` (exported items only): SHA-256 of the zip equals the hash in
 *   export-manifest.json, and the export manifest's Ed25519 signature verifies.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import type { TrackId } from '../domain';
import { auditBody, chainHash } from '../sim/events';
import type { AuditRow } from '../sim/types';
import type {
  DemoCheckId,
  DemoCheckResult,
  DemoEvidencePackage,
  DemoVerificationReport,
} from './types';

/** Label of a report whose checks were all recomputed by the caller. */
export const DEMO_RECOMPUTED_LABEL = 'DEMO - recomputed';
/** Label of a report that uses at least one precomputed check. */
export const DEMO_PARTLY_PRECOMPUTED_LABEL = 'DEMO - recomputed (some checks precomputed)';
/** Label of the generator's precomputed report (mobile shows it as "verified by the Core"). */
export const DEMO_PRECOMPUTED_LABEL = 'DEMO - precomputed';

// ── Hashing ──────────────────────────────────────────────────────────────────────────────────

/** Lowercase hex SHA-256 of bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

/** Lowercase hex SHA-256 of a string's UTF-8 bytes. */
export function sha256HexOfText(text: string): string {
  return sha256Hex(utf8ToBytes(text));
}

/** Decodes UTF-8 bytes without a global TextDecoder (some Hermes builds lack it). */
export function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; ) {
    const byte = bytes[index] ?? 0;
    let size = 1;
    let code = byte;
    if (byte >= 0xf0) [code, size] = [byte & 0x07, 4];
    else if (byte >= 0xe0) [code, size] = [byte & 0x0f, 3];
    else if (byte >= 0xc0) [code, size] = [byte & 0x1f, 2];
    for (let k = 1; k < size; k += 1) code = (code << 6) | ((bytes[index + k] ?? 0) & 0x3f);
    out += String.fromCodePoint(code);
    index += size;
  }
  return out;
}

// ── Base64, PEM and a minimal DER reader (certificates only) ─────────────────────────────────

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUE: Record<string, number> = Object.fromEntries(
  Array.from(BASE64_ALPHABET, (char, index) => [char, index] as const),
);

/** Decodes standard base64 (whitespace ignored). Returns null on a character outside the alphabet. */
export function decodeBase64(text: string): Uint8Array | null {
  const clean = text.replace(/\s+/g, '').replace(/=+$/, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE64_VALUE[char];
    if (value === undefined) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** DER bytes of the first `-----BEGIN <label>-----` block, or null. */
export function pemToDer(pem: string, label = 'CERTIFICATE'): Uint8Array | null {
  const match = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`).exec(pem);
  return match?.[1] === undefined ? null : decodeBase64(match[1]);
}

interface Tlv {
  tag: number;
  start: number;
  headerLength: number;
  end: number;
}

function readTlv(bytes: Uint8Array, offset: number): Tlv | null {
  if (offset + 2 > bytes.length) return null;
  const tag = bytes[offset] ?? 0;
  let length = bytes[offset + 1] ?? 0;
  let headerLength = 2;
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4 || offset + 2 + count > bytes.length) return null;
    length = 0;
    for (let index = 0; index < count; index += 1) length = length * 256 + (bytes[offset + 2 + index] ?? 0);
    headerLength = 2 + count;
  }
  const end = offset + headerLength + length;
  return end > bytes.length ? null : { tag, start: offset, headerLength, end };
}

function childrenOf(bytes: Uint8Array, parent: Tlv): Tlv[] | null {
  const out: Tlv[] = [];
  let offset = parent.start + parent.headerLength;
  while (offset < parent.end) {
    const child = readTlv(bytes, offset);
    if (!child) return null;
    out.push(child);
    offset = child.end;
  }
  return out;
}

function contentOf(bytes: Uint8Array, tlv: Tlv): Uint8Array {
  return bytes.subarray(tlv.start + tlv.headerLength, tlv.end);
}

/** UTCTime `YYMMDDHHMMSSZ` or GeneralizedTime `YYYYMMDDHHMMSSZ` → epoch ms. */
function derTime(bytes: Uint8Array, tlv: Tlv): number | null {
  const text = String.fromCharCode(...contentOf(bytes, tlv));
  const match = tlv.tag === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(text) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(text);
  if (!match) return null;
  const rawYear = Number(match[1]);
  const year = tlv.tag === 0x17 ? (rawYear < 50 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
  return Date.UTC(year, Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
}

/** Ed25519 SubjectPublicKeyInfo algorithm: SEQUENCE { OID 1.3.101.112 }. */
const ED25519_ALGORITHM = [0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70] as const;

function isEd25519Algorithm(bytes: Uint8Array, tlv: Tlv): boolean {
  const slice = bytes.subarray(tlv.start, tlv.end);
  return slice.length === ED25519_ALGORITHM.length && ED25519_ALGORITHM.every((value, index) => slice[index] === value);
}

export interface ParsedDemoCertificate {
  /** DER of the TBSCertificate (the bytes the self-signature covers). */
  tbs: Uint8Array;
  signature: Uint8Array;
  /** Raw 32-byte Ed25519 public key. */
  publicKey: Uint8Array;
  notBefore: number;
  notAfter: number;
}

/**
 * Reads the fields an Ed25519 self-signed certificate check needs. Returns null for anything that
 * is not an X.509 v3 certificate with an Ed25519 key and signature.
 */
export function parseEd25519Certificate(der: Uint8Array): ParsedDemoCertificate | null {
  const certificate = readTlv(der, 0);
  if (!certificate || certificate.tag !== 0x30 || certificate.end !== der.length) return null;
  const outer = childrenOf(der, certificate);
  const [tbsTlv, algorithmTlv, signatureTlv] = outer ?? [];
  if (!tbsTlv || !algorithmTlv || !signatureTlv || signatureTlv.tag !== 0x03) return null;
  if (!isEd25519Algorithm(der, algorithmTlv)) return null;
  const tbsFields = childrenOf(der, tbsTlv);
  if (!tbsFields) return null;
  const offset = tbsFields[0]?.tag === 0xa0 ? 1 : 0;
  const validity = tbsFields[offset + 3];
  const spki = tbsFields[offset + 5];
  if (!validity || !spki) return null;
  const times = childrenOf(der, validity);
  const spkiParts = childrenOf(der, spki);
  const [keyAlgorithm, keyBits] = spkiParts ?? [];
  if (!times || times.length !== 2 || !keyAlgorithm || !keyBits || keyBits.tag !== 0x03) return null;
  if (!isEd25519Algorithm(der, keyAlgorithm)) return null;
  const notBefore = derTime(der, times[0] as Tlv);
  const notAfter = derTime(der, times[1] as Tlv);
  const keyContent = contentOf(der, keyBits);
  const signatureContent = contentOf(der, signatureTlv);
  if (notBefore === null || notAfter === null || keyContent.length !== 33 || signatureContent.length !== 65) return null;
  return {
    tbs: der.subarray(tbsTlv.start, tbsTlv.end),
    signature: signatureContent.subarray(1),
    publicKey: keyContent.subarray(1),
    notBefore,
    notAfter,
  };
}

// ── WebCrypto (optional) ─────────────────────────────────────────────────────────────────────

/** Bytes backed by a plain ArrayBuffer (what WebCrypto's `BufferSource` accepts). */
export type PlainBytes = Uint8Array<ArrayBuffer>;

/**
 * The part of `SubtleCrypto` the Ed25519 checks use. Structural, so no DOM types are needed; the
 * runtime's `crypto.subtle` (browser, or the WebCrypto object of the test runtime) satisfies it.
 */
export interface SubtleLike {
  importKey(
    format: 'raw',
    keyData: PlainBytes,
    algorithm: { name: 'Ed25519' },
    extractable: boolean,
    keyUsages: 'verify'[],
  ): Promise<unknown>;
  verify(algorithm: { name: 'Ed25519' }, key: unknown, signature: PlainBytes, data: PlainBytes): Promise<boolean>;
}

/** A copy of `bytes` in its own ArrayBuffer. */
function plain(bytes: Uint8Array): PlainBytes {
  return new Uint8Array(bytes);
}

/** The runtime's `crypto.subtle`, or null (Hermes has none). */
export function defaultSubtle(): SubtleLike | null {
  const holder = globalThis as { crypto?: { subtle?: SubtleLike } };
  return holder.crypto?.subtle ?? null;
}

/**
 * Verifies an Ed25519 signature with WebCrypto. Returns null when the runtime cannot (no
 * `crypto.subtle`, or no Ed25519 support), so the caller can fall back to a precomputed result.
 */
export async function verifyEd25519(
  subtle: SubtleLike | null,
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array,
): Promise<boolean | null> {
  if (!subtle) return null;
  let key: unknown;
  try {
    key = await subtle.importKey('raw', plain(publicKey), { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return null;
  }
  try {
    return await subtle.verify({ name: 'Ed25519' }, key, plain(signature), plain(message));
  } catch {
    return false;
  }
}

// ── Single checks ────────────────────────────────────────────────────────────────────────────

export function trackCheckId(trackId: TrackId): DemoCheckId {
  return `track:${trackId}`;
}

function computed(id: DemoCheckId, expected: string | null, actual: string | null, ok: boolean, detail?: string): DemoCheckResult {
  return detail === undefined ? { id, ok, expected, actual, source: 'computed' } : { id, ok, expected, actual, source: 'computed', detail };
}

/** `track:<ID>`: the stored media bytes against the sealed manifest hash. */
export function checkTrack(pkg: DemoEvidencePackage, trackId: TrackId, mediaBytes: Uint8Array): DemoCheckResult {
  const track = pkg.tracks.find((item) => item.trackId === trackId);
  const actual = sha256Hex(mediaBytes);
  if (!track) return computed(trackCheckId(trackId), null, actual, false, 'Track not in the package');
  const ok = actual === track.sealedSha256;
  return computed(trackCheckId(trackId), track.sealedSha256, actual, ok, ok ? undefined : 'Stored media differs from the sealed hash');
}

/** `manifest`: SHA-256 of manifest.json against the digest the signature covers. */
export function checkManifest(pkg: DemoEvidencePackage, manifestBytes: Uint8Array): DemoCheckResult {
  const actual = sha256Hex(manifestBytes);
  const ok = actual === pkg.signature.signedDigest;
  return computed('manifest', pkg.signature.signedDigest, actual, ok, ok ? undefined : 'manifest.json differs from the signed digest');
}

/**
 * `signature`: Ed25519 over the SHA-256 digest of the manifest bytes as found (not as recorded),
 * with the certificate's key. Null when WebCrypto cannot verify Ed25519.
 */
export async function checkSignature(
  pkg: DemoEvidencePackage,
  manifestBytes: Uint8Array,
  certificateDer: Uint8Array,
  subtle: SubtleLike | null = defaultSubtle(),
): Promise<DemoCheckResult | null> {
  const parsed = parseEd25519Certificate(certificateDer);
  if (!parsed) return computed('signature', 'VALID', 'NO_KEY', false, 'Certificate has no Ed25519 key');
  const verdict = await verifyEd25519(subtle, parsed.publicKey, hexToBytes(pkg.signature.signatureHex), sha256(manifestBytes));
  if (verdict === null) return null;
  return computed('signature', 'VALID', verdict ? 'VALID' : 'INVALID', verdict, verdict ? undefined : 'Signature does not verify');
}

/**
 * `certificate`: fingerprint against the index, self-signature, DEMO key, and validity at the signing
 * time. Null when WebCrypto cannot verify Ed25519.
 */
export async function checkCertificate(
  pkg: DemoEvidencePackage,
  certificateDer: Uint8Array,
  expected: { sha256: string; publicKeyHex: string },
  subtle: SubtleLike | null = defaultSubtle(),
): Promise<DemoCheckResult | null> {
  const actualSha = sha256Hex(certificateDer);
  if (actualSha !== expected.sha256) return computed('certificate', expected.sha256, actualSha, false, 'Certificate fingerprint differs');
  const parsed = parseEd25519Certificate(certificateDer);
  if (!parsed) return computed('certificate', expected.sha256, actualSha, false, 'Not an Ed25519 X.509 certificate');
  if (bytesToHex(parsed.publicKey) !== expected.publicKeyHex) {
    return computed('certificate', expected.publicKeyHex, bytesToHex(parsed.publicKey), false, 'Certificate key is not the DEMO key');
  }
  const signedAt = Date.parse(pkg.signature.signedAt);
  if (!(signedAt >= parsed.notBefore && signedAt <= parsed.notAfter)) {
    return computed('certificate', expected.sha256, actualSha, false, 'Certificate not valid at the signing time');
  }
  const selfSigned = await verifyEd25519(subtle, parsed.publicKey, parsed.signature, parsed.tbs);
  if (selfSigned === null) return null;
  return computed('certificate', expected.sha256, actualSha, selfSigned, selfSigned ? undefined : 'Self-signature does not verify');
}

/** Parses audit-session-extract.jsonl (one simulator AuditRow per line). */
export function parseAuditExtract(text: string): AuditRow[] {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AuditRow);
}

/** `auditChain`: every row recomputes; seq increases; consecutive rows link; the last hash matches the index. */
export function checkAuditExtract(pkg: DemoEvidencePackage, text: string): DemoCheckResult {
  let rows: AuditRow[];
  try {
    rows = parseAuditExtract(text);
  } catch {
    return computed('auditChain', pkg.audit.lastHash, null, false, 'Extract is not valid JSON lines');
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] as AuditRow;
    if (chainHash(row.prevHash, auditBody(row)) !== row.hash) {
      return computed('auditChain', pkg.audit.lastHash, `seq ${row.seq}`, false, `Row seq ${row.seq} does not recompute`);
    }
    const previous = index > 0 ? rows[index - 1] : undefined;
    if (previous && row.seq <= previous.seq) {
      return computed('auditChain', pkg.audit.lastHash, `seq ${row.seq}`, false, `Row seq ${row.seq} out of order`);
    }
    if (previous && row.seq === previous.seq + 1 && row.prevHash !== previous.hash) {
      return computed('auditChain', pkg.audit.lastHash, `seq ${row.seq}`, false, `Row seq ${row.seq} does not link`);
    }
  }
  const last = rows[rows.length - 1];
  const actual = last?.hash ?? null;
  const ok = actual === pkg.audit.lastHash && rows.length === pkg.audit.rows;
  return computed('auditChain', pkg.audit.lastHash, actual, ok, ok ? undefined : 'Extract head or row count differs');
}

/** `exportPackage`: SHA-256 of the export zip against the hash its export manifest records. */
export function checkExportPackage(zipBytes: Uint8Array, exportManifestBytes: Uint8Array): DemoCheckResult {
  const actual = sha256Hex(zipBytes);
  let expected: string | null = null;
  try {
    const manifest = JSON.parse(decodeUtf8(exportManifestBytes)) as { package?: { sha256?: unknown } };
    expected = typeof manifest.package?.sha256 === 'string' ? manifest.package.sha256 : null;
  } catch {
    expected = null;
  }
  const ok = expected !== null && actual === expected;
  return computed('exportPackage', expected, actual, ok, ok ? undefined : 'Export zip differs from its export manifest');
}

/** `exportSignature`: Ed25519 over SHA-256(export-manifest.json). Null when WebCrypto cannot verify. */
export async function checkExportSignature(
  pkg: DemoEvidencePackage,
  exportManifestBytes: Uint8Array,
  certificateDer: Uint8Array,
  subtle: SubtleLike | null = defaultSubtle(),
): Promise<DemoCheckResult | null> {
  if (!pkg.export) return null;
  const parsed = parseEd25519Certificate(certificateDer);
  if (!parsed) return computed('exportSignature', 'VALID', 'NO_KEY', false, 'Certificate has no Ed25519 key');
  const verdict = await verifyEd25519(subtle, parsed.publicKey, hexToBytes(pkg.export.signatureHex), sha256(exportManifestBytes));
  if (verdict === null) return null;
  return computed('exportSignature', 'VALID', verdict ? 'VALID' : 'INVALID', verdict, verdict ? undefined : 'Export signature does not verify');
}

// ── Reports ──────────────────────────────────────────────────────────────────────────────────

/** Display order of the checks. */
export function checkOrder(pkg: DemoEvidencePackage): DemoCheckId[] {
  const ids: DemoCheckId[] = pkg.tracks.map((track) => trackCheckId(track.trackId));
  ids.push('manifest', 'signature', 'certificate', 'auditChain');
  if (pkg.export) ids.push('exportPackage', 'exportSignature');
  return ids;
}

/** Builds a report from checks (in display order). */
export function buildReport(pkg: DemoEvidencePackage, checks: DemoCheckResult[], label: string): DemoVerificationReport {
  const failed = checks.filter((check) => !check.ok).map((check) => check.id);
  return {
    evidenceSuffix: pkg.evidenceSuffix,
    evidenceId: pkg.evidenceId,
    result: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failed,
    demo: true,
    label,
  };
}

/** The generator's precomputed report (what the mobile app shows, labelled "verified by the Core"). */
export function precomputedReport(pkg: DemoEvidencePackage): DemoVerificationReport {
  return buildReport(
    pkg,
    pkg.verification.checks.map((check) => ({ ...check, source: 'precomputed' as const })),
    DEMO_PRECOMPUTED_LABEL,
  );
}

function precomputedCheck(pkg: DemoEvidencePackage, id: DemoCheckId): DemoCheckResult {
  const stored = pkg.verification.checks.find((check) => check.id === id);
  return stored
    ? { ...stored, source: 'precomputed' }
    : { id, ok: false, expected: null, actual: null, source: 'precomputed', detail: 'No precomputed result' };
}

/** Loads a file by its path relative to packages/shared/assets/ (fetch on the web, fs in tests). */
export type DemoAssetLoader = (assetPath: string) => Promise<Uint8Array>;

export interface VerifyDemoPackageOptions {
  /** WebCrypto to use; default `crypto.subtle` of the runtime, null forces the precomputed fallback. */
  subtle?: SubtleLike | null;
  /** Certificate fingerprint and DEMO public key from the index (`DEMO_EVIDENCE_INDEX.certificate` / `.key`). */
  trust: { certificateSha256: string; publicKeyHex: string };
  /** Called after each check, e.g. to animate the integrity list. */
  onCheck?: (check: DemoCheckResult) => void;
}

/**
 * Re-verifies a package from its files: every track hash, the manifest hash, the audit chain and the
 * export zip are always recomputed; the Ed25519 signature and certificate checks are recomputed with
 * WebCrypto where supported and otherwise taken from the precomputed result (marked as such).
 */
export async function verifyDemoPackage(
  pkg: DemoEvidencePackage,
  load: DemoAssetLoader,
  options: VerifyDemoPackageOptions,
): Promise<DemoVerificationReport> {
  const subtle = options.subtle === undefined ? defaultSubtle() : options.subtle;
  const checks: DemoCheckResult[] = [];
  const push = (check: DemoCheckResult): void => {
    checks.push(check);
    options.onCheck?.(check);
  };

  for (const track of pkg.tracks) push(checkTrack(pkg, track.trackId, await load(track.stored.path)));
  const manifestBytes = await load(pkg.files.manifest.path);
  push(checkManifest(pkg, manifestBytes));
  const certificatePem = decodeUtf8(await load(pkg.files.certificate.path));
  const certificateDer = pemToDer(certificatePem) ?? new Uint8Array(0);
  push((await checkSignature(pkg, manifestBytes, certificateDer, subtle)) ?? precomputedCheck(pkg, 'signature'));
  push(
    (await checkCertificate(
      pkg,
      certificateDer,
      { sha256: options.trust.certificateSha256, publicKeyHex: options.trust.publicKeyHex },
      subtle,
    )) ?? precomputedCheck(pkg, 'certificate'),
  );
  push(checkAuditExtract(pkg, decodeUtf8(await load(pkg.files.auditExtract.path))));
  if (pkg.export) {
    const exportManifestBytes = await load(pkg.export.manifest.path);
    push(checkExportPackage(await load(pkg.export.zip.path), exportManifestBytes));
    push(
      (await checkExportSignature(pkg, exportManifestBytes, certificateDer, subtle)) ??
        precomputedCheck(pkg, 'exportSignature'),
    );
  }
  const anyPrecomputed = checks.some((check) => check.source === 'precomputed');
  return buildReport(pkg, checks, anyPrecomputed ? DEMO_PARTLY_PRECOMPUTED_LABEL : DEMO_RECOMPUTED_LABEL);
}
