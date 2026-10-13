/**
 * Verify v2 (blueprint row 85 / M7-W4; evidence package spec §D, checks V-01 to V-14; row 141:
 * V-15, the development-source mark, spec §B.12 and §D.1).
 *
 * `verifyPackageV2(ports, options)` reads ONE sealed v2 package through its ports and answers the
 * verdict. It never throws for anything a package can contain: a missing, short, altered or
 * unreadable file is a FINDING. It writes nothing.
 *
 * HOW A VERDICT IS FORMED. Every check starts as PASS and becomes FAIL with its first finding. A
 * check that has nothing to read because another one failed is SKIPPED (`BLOCKED`), never PASS.
 * `ok` is true only when every check is PASS — the single exception is V-05 skipped for
 * `KEY_UNAVAILABLE`, which the caller must have asked for (`plaintext: 'WHEN_KEY_AVAILABLE'`).
 *
 * WHAT IS HELD IN MEMORY (the bound). The manifest, `fragments.json`, `signature.sig`, the
 * certificate and the revision list are read whole: they grow with the NUMBER of fragments, not
 * with the size of the recording, and each has a hard limit below. A camera file is never read
 * whole: its bytes pass through the hashes in the reader's chunks. With a session key, ONE sealed
 * range at a time is held (the stored bytes and their plaintext: AES-GCM authenticates a message
 * as a whole), at most `maxOpenFragmentBytes` (64 MiB) each; a larger range fails V-05 and is
 * still hashed in chunks. Without a key nothing but one chunk is held.
 *
 * THE CHAIN (V-06) is walked twice: over the RECORDED fragment hashes (is the manifest's own chain
 * consistent?) and over the hashes of the bytes ON DISK (does the file still produce it?). An
 * altered fragment breaks the second walk at that fragment and at every later one (spec §D V-08).
 *
 * BYTE RANGES (V-02). The spec's wording "gapless from file start; sum(bytes) == tracks[].bytes"
 * cannot hold together with its own example (§B.10: the first fragment at offset 1259, behind the
 * container header) and with the capture spec, which leaves clear boxes between sealed ranges.
 * This verifier requires the ranges to be ascending, non-overlapping and inside the file, and
 * closes the gap another way: the WHOLE file is hashed against `tracks[].sha256` and its length
 * against `tracks[].bytes`, so no byte outside a fragment range is unprotected. Decision D-85-2.
 *
 * THE SOURCE MARK (V-15). The strict manifest schema already refuses a manifest without a class or
 * with a flag that contradicts the classes, so on a manifest that parsed V-15 has nothing left to
 * find. It therefore reads the RAW JSON object too: when V-01 failed, V-15 says whether the mark is
 * what is wrong (MISSING / CORRUPT), and is SKIPPED - never PASS - when the mark looks right in a
 * manifest that is not a readable v2 manifest. A class other than PRODUCTION is never a finding.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, hexToBytes } from '@noble/hashes/utils.js';
import {
  EvidencePackageError,
  FRAGMENT_CHAIN_GENESIS,
  MANIFEST_SOURCE_CLASSES,
  MANIFEST_V1_SCHEMA_ID,
  MANIFEST_V2_SCHEMA_ID,
  ManifestSourceClass,
  PackageFile,
  cameraFilePath,
  canonicalJson,
  canonicalJsonBytes,
  declaredPackageFiles,
  detachedSignatureOf,
  fragmentsJsonMatchesManifest,
  manifestDeclaresTranscript,
  manifestHashMatches,
  manifestSignedMessage,
  nextFragmentChainHash,
  parseDetachedSignature,
  parseManifestV2,
  isServerSttBackend,
  transcriptModelFaults,
  type ManifestFragment,
  type ManifestTrack,
  type ManifestV2,
  type PackageVideoTrackId,
} from '../evidence-package';
import { isDevelopmentKeySubject } from './report';
import { RETAINED_CERTIFICATES_DIR, REVISION_BOUND_MEMBERS, TranscriptRevisionsFileSchema, retainedCertificatePath } from './revisions';
import {
  SOURCES_STATE_REPORT,
  TRANSCRIPT_STATE_REPORT,
  VERIFY_FAILURES,
  AUDIT_EXTRACT_NOT_SIGNED_REPORT,
  EXPORT_ARTEFACT_NAME,
  REVISION_APPEND_PENDING_FILE,
  REVISION_APPEND_PENDING_REPORT,
  exportFolderNoticeReport,
  audioAbsentOnRestartReport,
  hostProfileNotAskedReport,
  videoAbsentInSessionReport,
  VERIFY_NOTICE,
  VERIFY_RESULT_SCHEMA_ID,
  VERIFY_V2_CHECKS,
  SIGNED_BY_COMPROMISED_KEY_REPORT,
  VerifiedSigningKeyMark,
  VerifiedSourcesState,
  VerifiedTranscriptState,
  transcriptModelLineOf,
  type CertificateFacts,
  type TranscriptModelReport,
  type FileVerifyResult,
  type FragmentVerifyResult,
  type HashFactory,
  type PackageReader,
  type PackageVerifyResult,
  type SourcesReport,
  type TranscriptStateReport,
  type VerifyCheckId,
  type VerifyCheckResult,
  type VerifyFailureClass,
  type VerifyFailureCode,
  type VerifyFinding,
  type VerifyOptions,
  type VerifyOverall,
  type VerifyPorts,
  type VerifySkipReason,
} from './types';

/** Limits of the files that are read whole. A file beyond its limit is unreadable, not truncated. */
export const VERIFY_MAX_MANIFEST_BYTES = 64 * 1024 * 1024;
export const VERIFY_MAX_SMALL_FILE_BYTES = 1024 * 1024;
export const VERIFY_MAX_REVISIONS_BYTES = 16 * 1024 * 1024;
/** The largest transcript document whose header V-10 reads (the hash of the file is held whatever its size). */
export const VERIFY_MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;
export const VERIFY_MAX_OPEN_FRAGMENT_BYTES = 64 * 1024 * 1024;
/** The most entries of a package folder that are looked at, and the most unexpected ones that are named. */
export const VERIFY_MAX_LISTED_FILES = 10_000;
export const VERIFY_MAX_UNEXPECTED_NAMED = 50;

const nobleHash: HashFactory = () => {
  const state = sha256.create();
  return { update: (chunk) => void state.update(chunk), digestHex: () => bytesToHex(state.digest()) };
};

type Where = Omit<VerifyFinding, 'code' | 'failureClass'>;

/** The findings and skips of one run. */
class Verdict {
  private readonly found = new Map<VerifyCheckId, VerifyFinding[]>();
  private readonly skips = new Map<VerifyCheckId, VerifySkipReason>();

  add(code: VerifyFailureCode, where: Where = {}, failureClass?: VerifyFailureClass): void {
    const rule = VERIFY_FAILURES[code];
    const list = this.found.get(rule.check) ?? [];
    list.push(Object.freeze({ code, failureClass: failureClass ?? rule.failureClass, ...where }));
    this.found.set(rule.check, list);
  }

  skip(id: VerifyCheckId, reason: VerifySkipReason): void {
    if (!this.skips.has(id)) this.skips.set(id, reason);
  }

  failed(id: VerifyCheckId): boolean {
    return (this.found.get(id)?.length ?? 0) > 0;
  }

  findings(id: VerifyCheckId): readonly VerifyFinding[] {
    return this.found.get(id) ?? [];
  }

  checks(): VerifyCheckResult[] {
    return VERIFY_V2_CHECKS.map(({ id, name }) => {
      const findings = Object.freeze([...(this.found.get(id) ?? [])]);
      const first = findings[0];
      if (first !== undefined) return Object.freeze({ id, name, status: 'FAIL' as const, failureClass: first.failureClass, skipped: null, findings });
      const skipped = this.skips.get(id) ?? null;
      return Object.freeze({ id, name, status: skipped === null ? ('PASS' as const) : ('SKIPPED' as const), failureClass: null, skipped, findings });
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when the dotted member path exists in the value (`a.0.b`). */
function memberPresent(value: unknown, path: string): boolean {
  if (path === '') return true;
  let current: unknown = value;
  for (const key of path.split('.')) {
    if (Array.isArray(current)) current = current[Number(key)];
    else if (isRecord(current) && Object.hasOwn(current, key)) current = current[key];
    else return false;
    if (current === undefined) return false;
  }
  return true;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** SHA-256 of the DER bytes of the one certificate of a PEM text; null when it is not exactly one. */
export function pemCertificateSha256(pemText: string): string | null {
  const match = /^\s*-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----\s*$/.exec(pemText);
  if (match === null || match[1] === undefined) return null;
  const body = match[1].replace(/\s+/g, '');
  if (body.length === 0 || body.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return null;
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((body.length / 4) * 3 - padding);
  let at = 0;
  for (let index = 0; index < body.length; index += 4) {
    let word = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      const symbol = body.charAt(index + offset);
      word = (word << 6) | (symbol === '=' ? 0 : BASE64.indexOf(symbol));
    }
    for (const byte of [(word >> 16) & 0xff, (word >> 8) & 0xff, word & 0xff]) {
      if (at < out.length) {
        out[at] = byte;
        at += 1;
      }
    }
  }
  return bytesToHex(sha256(out));
}

interface LoadedManifest {
  readonly raw: unknown;
  readonly manifest: ManifestV2 | null;
  readonly text: string | null;
}

/** V-01. */
async function loadManifest(reader: PackageReader, verdict: Verdict): Promise<LoadedManifest> {
  const none: LoadedManifest = { raw: null, manifest: null, text: null };
  const entry = await reader.entry(PackageFile.MANIFEST);
  if (entry.kind === 'ABSENT') {
    verdict.add('MANIFEST_MISSING', { file: PackageFile.MANIFEST });
    return none;
  }
  let text: string;
  let raw: unknown;
  try {
    if (entry.kind !== 'FILE') throw new Error('unreadable');
    text = await reader.readText(PackageFile.MANIFEST, VERIFY_MAX_MANIFEST_BYTES);
    raw = JSON.parse(text);
  } catch {
    verdict.add('MANIFEST_UNREADABLE', { file: PackageFile.MANIFEST });
    return none;
  }
  if (isRecord(raw) && raw.schema === MANIFEST_V1_SCHEMA_ID) {
    verdict.add('MANIFEST_VERSION_UNSUPPORTED', { member: 'schema' });
    return { raw, manifest: null, text };
  }
  try {
    return { raw, manifest: parseManifestV2(raw), text };
  } catch (error) {
    const members = error instanceof EvidencePackageError ? error.members : [''];
    for (const member of members.length > 0 ? members : ['']) {
      verdict.add(memberPresent(raw, member) ? 'MANIFEST_FIELD_INVALID' : 'MANIFEST_FIELD_MISSING', { member });
    }
    return { raw, manifest: null, text };
  }
}

interface CertificateState {
  /** SHA-256 of the DER bytes of `device-certificate.pem`, when it could be read. */
  readonly sha256: string | null;
  readonly facts: CertificateFacts | null;
}

/** V-13. */
async function checkCertificate(ports: VerifyPorts, manifest: ManifestV2, options: VerifyOptions, verdict: Verdict): Promise<CertificateState> {
  const file = PackageFile.CERTIFICATE;
  const entry = await ports.reader.entry(file);
  if (entry.kind === 'ABSENT') {
    verdict.add('CERTIFICATE_MISSING', { file });
    return { sha256: null, facts: null };
  }
  let text: string;
  try {
    if (entry.kind !== 'FILE') throw new Error('unreadable');
    text = await ports.reader.readText(file, VERIFY_MAX_SMALL_FILE_BYTES);
  } catch {
    verdict.add('CERTIFICATE_UNREADABLE', { file });
    return { sha256: null, facts: null };
  }
  const digest = pemCertificateSha256(text);
  if (digest === null) {
    verdict.add('CERTIFICATE_UNREADABLE', { file });
    return { sha256: null, facts: null };
  }
  if (digest !== manifest.signature.certificate.sha256) verdict.add('CERTIFICATE_HASH_MISMATCH', { file, member: 'signature.certificate.sha256' });
  if (digest !== manifest.device.certificate.sha256) verdict.add('CERTIFICATE_HASH_MISMATCH', { file, member: 'device.certificate.sha256' });
  let facts: CertificateFacts | null = null;
  try {
    facts = ports.readCertificate(text);
  } catch {
    facts = null;
  }
  if (facts === null) {
    verdict.add('CERTIFICATE_UNREADABLE', { file });
    return { sha256: digest, facts: null };
  }
  const signedAt = manifest.signature.signedAt;
  if (signedAt < facts.notBefore || signedAt > facts.notAfter) verdict.add('CERTIFICATE_NOT_VALID_AT_SIGNING', { file, member: 'signature.signedAt' });
  const trusted = options.expected?.trustedCertificateSha256;
  if (trusted !== undefined && !trusted.includes(digest)) verdict.add('CERTIFICATE_NOT_TRUSTED', { file });
  // Row V5 (C84 R-2): a certificate the verifier was TOLD is marked compromised is not relied on - also when it is in the trusted list.
  const marked = options.expected?.compromisedCertificateSha256;
  if (marked !== undefined && marked.includes(digest)) verdict.add('CERTIFICATE_KEY_COMPROMISED', { file });
  // Fields 25 / 26 are texts the signer writes: they are held to the certificate itself (F-M7 R88-08).
  if (typeof facts.subject === 'string' && facts.subject !== manifest.device.certificate.subject) verdict.add('CERTIFICATE_SUBJECT_MISMATCH', { file, member: 'device.certificate.subject' });
  if (typeof facts.serialNumber === 'string' && facts.serialNumber !== manifest.device.certificate.serialNumber) verdict.add('CERTIFICATE_SUBJECT_MISMATCH', { file, member: 'device.certificate.serialNumber' });
  return { sha256: digest, facts };
}

/** V-09, and the `signedDigest` half of V-03. */
async function checkSignature(ports: VerifyPorts, manifest: ManifestV2, certificate: CertificateState, verdict: Verdict): Promise<void> {
  const file = PackageFile.SIGNATURE;
  const entry = await ports.reader.entry(file);
  if (entry.kind === 'ABSENT') verdict.add('SIGNATURE_FILE_MISSING', { file });
  else {
    try {
      if (entry.kind !== 'FILE') throw new Error('unreadable');
      const text = await ports.reader.readText(file, VERIFY_MAX_SMALL_FILE_BYTES);
      const stored = parseDetachedSignature(text);
      const sealed = detachedSignatureOf(manifest);
      if (stored.signedDigest !== sealed.signedDigest) verdict.add('SIGNED_DIGEST_MISMATCH', { file, member: 'signedDigest' });
      const members = (Object.keys(sealed) as (keyof typeof sealed)[]).filter((member) => member !== 'signedDigest' && stored[member] !== sealed[member]);
      for (const member of members) verdict.add('SIGNATURE_FILE_MISMATCH', { file, member });
      // The stored bytes are the canonical serialization, not merely an equal value.
      if (members.length === 0 && text !== canonicalJson(stored)) verdict.add('SIGNATURE_FILE_MISMATCH', { file });
    } catch {
      verdict.add('SIGNATURE_FILE_UNREADABLE', { file });
    }
  }
  if (certificate.facts === null) {
    verdict.add('SIGNATURE_KEY_UNAVAILABLE', { file: PackageFile.CERTIFICATE });
    return;
  }
  let verified = false;
  try {
    // The signed message is the RECORDED digest: whether that digest is the manifest's is V-03.
    verified =
      !manifest.signature.simulated &&
      (await ports.verifySignature(
        manifest.signature.algorithm,
        certificate.facts.publicKey,
        manifestSignedMessage(manifest.manifestSha256),
        hexToBytes(manifest.signature.value),
      )) === true;
  } catch {
    verified = false;
  }
  if (!verified) verdict.add('SIGNATURE_INVALID', { member: 'signature.value' });
}

interface Geometry {
  /** V-07 holds for the file and its ranges are ascending, apart and inside the file. */
  readonly walkable: boolean;
}

/** V-07 and the manifest-only part of V-02, for one camera file. */
function checkRecords(track: ManifestTrack, index: number, fragments: readonly ManifestFragment[], verdict: Verdict): Geometry {
  const trackId = track.trackId;
  let walkable = true;

  const gap = fragments.findIndex((fragment, position) => fragment.seq !== position + 1);
  if (gap !== -1) {
    verdict.add('SEQUENCE_NOT_CONTIGUOUS', { trackId, seq: fragments[gap]?.seq ?? gap + 1 });
    walkable = false;
  }
  const backwards = fragments.findIndex((fragment, position) => position > 0 && fragment.byteOffset <= (fragments[position - 1]?.byteOffset ?? -1));
  if (backwards !== -1) {
    verdict.add('OFFSET_NOT_INCREASING', { trackId, seq: fragments[backwards]?.seq ?? backwards + 1 });
    walkable = false;
  }

  if (track.fragmentCount !== fragments.length) verdict.add('FRAGMENT_COUNT_MISMATCH', { trackId, member: `tracks.${index}.fragmentCount` });
  const last = fragments.at(-1);
  const head = last === undefined ? FRAGMENT_CHAIN_GENESIS : last.chainHash;
  if (track.fragmentChainHead !== head && !(last === undefined && track.fragmentChainHead === null)) {
    verdict.add('CHAIN_HEAD_MISMATCH', { trackId, member: `tracks.${index}.fragmentChainHead` });
  }
  let previousEnd = 0;
  for (const fragment of fragments) {
    const end = fragment.byteOffset + fragment.byteLength;
    if (fragment.byteOffset < previousEnd || end > track.bytes || !Number.isSafeInteger(end)) {
      verdict.add('BYTE_RANGE_INVALID', { trackId, seq: fragment.seq });
      walkable = false;
      break;
    }
    previousEnd = end;
  }
  return { walkable };
}

interface FileContext {
  readonly ports: VerifyPorts;
  readonly newHash: HashFactory;
  readonly verdict: Verdict;
  readonly track: ManifestTrack;
  readonly fragments: readonly ManifestFragment[];
  readonly geometry: Geometry;
  /** A session key is there for every fragment of the file. */
  readonly keyReady: boolean;
  readonly maxOpenBytes: number;
}

interface FileOutcome {
  readonly result: FileVerifyResult;
  /** The plaintext of this file could not be computed although a key was there. */
  readonly plainBlocked: boolean;
}

/** The recorded chain against its own rule: the first fragment whose `chainHash` is not the rule's value. */
function recordedChainBreak(fragments: readonly ManifestFragment[]): number | null {
  let chain = FRAGMENT_CHAIN_GENESIS;
  for (const fragment of fragments) {
    chain = nextFragmentChainHash(chain, fragment.sha256);
    if (chain !== fragment.chainHash) return fragment.seq;
  }
  return null;
}

/** V-04, V-05, V-06, V-08 and the keyed part of V-02, for one camera file. */
async function checkCameraFile(context: FileContext): Promise<FileOutcome> {
  const { ports, newHash, verdict, track, fragments, geometry, keyReady } = context;
  const trackId = track.trackId;
  const path = cameraFilePath(trackId);
  const failed: FragmentVerifyResult[] = [];
  const inconsistentAt = recordedChainBreak(fragments);
  if (inconsistentAt !== null) verdict.add('CHAIN_RECORD_INCONSISTENT', { trackId, seq: inconsistentAt });

  const base = { trackId, file: path, fragmentCount: fragments.length, sequenceOk: !verdict.findings('V-07').some((finding) => finding.trackId === trackId) };
  const unread = (code: 'CAMERA_FILE_MISSING' | 'CAMERA_FILE_UNREADABLE'): FileOutcome => {
    verdict.add(code, { trackId, file: path });
    return {
      result: Object.freeze({ ...base, storedOk: false, plainOk: null, chainOk: inconsistentAt === null, chainBrokenFromSeq: null, fragments: Object.freeze([]) }),
      plainBlocked: true,
    };
  };

  const entry = await ports.reader.entry(path);
  if (entry.kind === 'ABSENT') return unread('CAMERA_FILE_MISSING');
  if (entry.kind !== 'FILE') return unread('CAMERA_FILE_UNREADABLE');
  if (entry.size !== track.bytes) verdict.add('FILE_SIZE_MISMATCH', { trackId, file: path });

  // The plaintext of the whole file is formed only on a walk in file order with a key.
  const plainWanted = keyReady && geometry.walkable && track.sha256Plain !== null;
  const fileHash = newHash();
  const plainFile = plainWanted ? newHash() : null;
  let plainBlocked = keyReady && !geometry.walkable;
  let plainMismatch = false;
  let chainActual = FRAGMENT_CHAIN_GENESIS;
  let actualBrokenFrom: number | null = null;
  let firstStoredFailure: number | null = null;
  const clear = (chunk: Uint8Array): void => {
    fileHash.update(chunk);
    plainFile?.update(chunk);
  };

  try {
    if (!geometry.walkable) await ports.reader.readRange(path, 0, entry.size, (chunk) => fileHash.update(chunk));
    let cursor = 0;
    for (const fragment of fragments) {
      const seq = fragment.seq;
      if (geometry.walkable && fragment.byteOffset > cursor) await ports.reader.readRange(path, cursor, fragment.byteOffset - cursor, clear);

      const opening = plainWanted && !plainBlocked;
      const holdable = fragment.byteLength <= context.maxOpenBytes;
      if (opening && !holdable) {
        verdict.add('FRAGMENT_TOO_LARGE', { trackId, seq });
        plainBlocked = true;
      }
      const parts: Uint8Array[] | null = opening && holdable ? [] : null;
      const fragmentHash = newHash();
      const delivered = await ports.reader.readRange(path, fragment.byteOffset, fragment.byteLength, (chunk) => {
        fragmentHash.update(chunk);
        if (geometry.walkable) fileHash.update(chunk);
        // A chunk is valid only during this call: what is kept is a copy.
        parts?.push(new Uint8Array(chunk));
      });
      const actual = fragmentHash.digestHex();
      const storedOk = delivered === fragment.byteLength && actual === fragment.sha256;
      if (!storedOk) {
        verdict.add(delivered < fragment.byteLength ? 'FRAGMENT_BYTES_TRUNCATED' : 'FRAGMENT_HASH_MISMATCH', { trackId, seq });
        firstStoredFailure ??= seq;
      }

      chainActual = nextFragmentChainHash(chainActual, actual);
      if (chainActual !== fragment.chainHash) actualBrokenFrom ??= seq;

      let plainOk: boolean | null = null;
      if (parts !== null) {
        if (!storedOk) {
          // These are not the sealed bytes: opening them proves nothing, and the plaintext of the file cannot be formed.
          plainBlocked = true;
        } else {
          let plain: Uint8Array | null = null;
          try {
            plain = await ports.opener!.open(
              { trackId, seq, byteOffset: fragment.byteOffset, byteLength: fragment.byteLength, gcmIv: fragment.gcmIv, gcmTag: fragment.gcmTag, keyId: fragment.keyId },
              concatBytes(...parts),
            );
            if (plain.byteLength !== fragment.byteLength) plain = null;
          } catch {
            plain = null;
          }
          if (plain === null) {
            // The stored bytes are the sealed ones, yet the range does not authenticate: its
            // nonce, tag, position or key ID is not what it was sealed with (SEC35-10).
            verdict.add('GCM_RECORD_MISMATCH', { trackId, seq });
            plainBlocked = true;
          } else {
            plainFile?.update(plain);
            if (fragment.sha256Plain !== null) {
              const one = newHash();
              one.update(plain);
              plainOk = one.digestHex() === fragment.sha256Plain;
              if (!plainOk) {
                verdict.add('FRAGMENT_PLAINTEXT_HASH_MISMATCH', { trackId, seq });
                plainMismatch = true;
              }
            }
          }
        }
      }
      if (!storedOk || plainOk === false) failed.push(Object.freeze({ trackId, seq, ok: false as const, reason: 'TAMPERED' as const, storedOk, plainOk }));
      cursor = fragment.byteOffset + fragment.byteLength;
    }
    if (geometry.walkable && entry.size > cursor) await ports.reader.readRange(path, cursor, entry.size - cursor, clear);
  } catch {
    return unread('CAMERA_FILE_UNREADABLE');
  }

  const fileStoredOk = fileHash.digestHex() === track.sha256;
  if (!fileStoredOk) verdict.add('FILE_HASH_MISMATCH', { trackId, file: path });

  // V-06: the chain over the bytes on disk. Reported as broken by the bytes only when a fragment
  // did not hash to its sealed value; a break without one is the recorded chain's own fault.
  if (actualBrokenFrom !== null && firstStoredFailure !== null) verdict.add('CHAIN_BROKEN', { trackId, seq: actualBrokenFrom });

  // V-08: an altered fragment fails that fragment and the chain from that fragment on. Anything
  // else that stored-bytes failures look like is not classified as tampering of a fragment.
  if (firstStoredFailure !== null) {
    if (actualBrokenFrom === firstStoredFailure && inconsistentAt === null) {
      for (const fragment of failed) if (!fragment.storedOk) verdict.add('FRAGMENT_TAMPERED', { trackId, seq: fragment.seq });
    } else verdict.add('STORED_BYTES_INCONSISTENT', { trackId, seq: firstStoredFailure });
  }

  // V-05: the decrypted file.
  let plainOk: boolean | null = null;
  if (keyReady) {
    if (track.sha256Plain === null) {
      verdict.add('PLAINTEXT_HASH_NOT_RECORDED', { trackId, member: 'sha256Plain' });
      plainOk = false;
    } else if (!plainBlocked && plainFile !== null) {
      plainOk = plainFile.digestHex() === track.sha256Plain;
      if (!plainOk) verdict.add('PLAINTEXT_HASH_MISMATCH', { trackId, file: path });
      if (plainMismatch) plainOk = false;
    } else if (plainMismatch) plainOk = false;
  }

  return {
    result: Object.freeze({
      ...base,
      storedOk: fileStoredOk && firstStoredFailure === null && entry.size === track.bytes,
      plainOk,
      chainOk: inconsistentAt === null && actualBrokenFrom === null,
      chainBrokenFromSeq: actualBrokenFrom,
      fragments: Object.freeze(failed),
    }),
    plainBlocked: keyReady && plainBlocked && track.sha256Plain !== null,
  };
}

/** SHA-256 of a whole file of the package, in chunks; null when it is absent, 'UNREADABLE' when it cannot be read. */
async function hashFile(reader: PackageReader, newHash: HashFactory, path: string): Promise<string | null | 'UNREADABLE'> {
  const entry = await reader.entry(path);
  if (entry.kind === 'ABSENT') return null;
  if (entry.kind !== 'FILE') return 'UNREADABLE';
  const hash = newHash();
  try {
    const delivered = await reader.readRange(path, 0, entry.size, (chunk) => hash.update(chunk));
    if (delivered !== entry.size) return 'UNREADABLE';
  } catch {
    return 'UNREADABLE';
  }
  return hash.digestHex();
}

/** V-10. */
async function checkTranscript(ports: VerifyPorts, newHash: HashFactory, manifest: ManifestV2, options: VerifyOptions, verdict: Verdict): Promise<void> {
  const transcript = manifest.transcript;
  const anchored = options.expected?.transcriptSha256;
  if (!manifestDeclaresTranscript(transcript)) {
    // A declared absence, not a failure: disabled by configuration (spec §B.7a) or unavailable at
    // the seal (decision D110). Nothing to hash. The anchor must agree: an item that HAS a
    // transcript is not the item of a package that declares none.
    if (typeof anchored === 'string') verdict.add('TRANSCRIPT_NOT_OF_ITEM', { member: 'transcript.sha256' });
    return;
  }
  if (anchored !== undefined && anchored !== transcript.sha256) verdict.add('TRANSCRIPT_NOT_OF_ITEM', { member: 'transcript.sha256' });
  const sealed: readonly (readonly [string, string | null])[] = [
    [PackageFile.TRANSCRIPT_JSON, transcript.sha256],
    [PackageFile.TRANSCRIPT_SRT, transcript.srtSha256],
    [PackageFile.TRANSCRIPT_VTT, transcript.vttSha256],
  ];
  let documentIsTheSealedOne = false;
  for (const [file, expected] of sealed) {
    const actual = await hashFile(ports.reader, newHash, file);
    if (actual === null) verdict.add('TRANSCRIPT_FILE_MISSING', { file });
    else if (actual === 'UNREADABLE') verdict.add('TRANSCRIPT_FILE_UNREADABLE', { file });
    else if (actual !== expected) verdict.add('TRANSCRIPT_HASH_MISMATCH', { file });
    else if (file === PackageFile.TRANSCRIPT_JSON) documentIsTheSealedOne = true;
  }
  // The header is held against the manifest only for the document the manifest's hash names: of
  // any other bytes the hash finding above is the whole truth.
  if (documentIsTheSealedOne) await checkTranscriptModel(ports, manifest, verdict);
}

/**
 * V-10, the model of the document (ruling D160; request of pass D9). The manifest and the sealed
 * document each state the backend and the model. They must say the same, member by member (null
 * equals null), and the document's own model must keep the provenance rule: version, quantisation
 * and file hash are null EXACTLY for a server backend. So the nulls pass only under the server
 * condition, in the manifest (V-01, its schema) AND in the document (here); for `cpu-local` a null
 * stays a failure in both. One finding per member that disagrees.
 */
async function checkTranscriptModel(ports: VerifyPorts, manifest: ManifestV2, verdict: Verdict): Promise<void> {
  const file = PackageFile.TRANSCRIPT_JSON;
  const mismatch = (member: string): void => verdict.add('TRANSCRIPT_MODEL_MISMATCH', { file, member });
  let header: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(await ports.reader.readText(file, VERIFY_MAX_TRANSCRIPT_BYTES));
    const candidate = (parsed as { header?: unknown } | null)?.header;
    if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) header = candidate as Record<string, unknown>;
  } catch {
    header = null;
  }
  const stated = header?.['model'];
  if (header === null || typeof header['backend'] !== 'string' || typeof stated !== 'object' || stated === null || Array.isArray(stated)) {
    // The sealed document states no backend or no model: there is nothing to hold the manifest's model against.
    mismatch('header');
    return;
  }
  const textOrNull = (value: unknown): string | null | undefined => (value === null || typeof value === 'string' ? value : undefined);
  const model = stated as Record<string, unknown>;
  const document = { name: textOrNull(model['name']), version: textOrNull(model['version']), quantisation: textOrNull(model['quantisation']), sha256: textOrNull(model['sha256']) };
  const sealed = manifest.transcript.model;
  const members = new Set<string>();
  if (header['backend'] !== manifest.transcript.configSnapshot.backend) members.add('backend');
  if (document.name !== sealed.name) members.add('model.name');
  if (document.version !== sealed.version) members.add('model.version');
  if (document.quantisation !== sealed.quantisation) members.add('model.quantisation');
  if (document.sha256 !== sealed.modelSha256) members.add('model.sha256');
  // The document's own rule, whatever the manifest says (a member that is no text and not null counts as stated).
  const own = { name: document.name ?? null, version: document.version === undefined ? '' : document.version, quantisation: document.quantisation === undefined ? '' : document.quantisation, sha256: document.sha256 === undefined ? '' : document.sha256 };
  for (const fault of transcriptModelFaults(header['backend'], own)) members.add(`model.${fault.member}`);
  for (const member of members) mismatch(member);
}

/** V-11. Resolves with the number of revisions, or null when the list could not be read. */
async function checkRevisions(ports: VerifyPorts, manifest: ManifestV2, certificate: CertificateState, options: VerifyOptions, verdict: Verdict): Promise<number | null> {
  // No machine transcript is sealed, so no revision can hang off one.
  if (!manifestDeclaresTranscript(manifest.transcript)) return null;
  const file = PackageFile.TRANSCRIPT_REVISIONS;
  const entry = await ports.reader.entry(file);
  if (entry.kind === 'ABSENT') {
    verdict.add('REVISIONS_FILE_MISSING', { file });
    return null;
  }
  let list;
  try {
    if (entry.kind !== 'FILE') throw new Error('unreadable');
    const parsed = TranscriptRevisionsFileSchema.safeParse(JSON.parse(await ports.reader.readText(file, VERIFY_MAX_REVISIONS_BYTES)));
    if (!parsed.success) throw new Error('invalid');
    list = parsed.data;
  } catch {
    verdict.add('REVISIONS_FILE_UNREADABLE', { file });
    return null;
  }
  if (list.evidenceId !== manifest.evidenceId) verdict.add('REVISIONS_NOT_OF_ITEM', { file, member: 'evidenceId' });
  if (list.machineTranscriptSha256 !== manifest.transcript.sha256) verdict.add('REVISIONS_NOT_OF_ITEM', { file, member: 'machineTranscriptSha256' });

  const expectedCount = options.expected?.revisionCount;
  if (list.revisions.length < (manifest.transcript.revisionHead ?? 0) || (expectedCount !== undefined && expectedCount !== list.revisions.length)) {
    verdict.add('REVISION_COUNT_MISMATCH', { file });
  }

  const trusted = options.expected?.trustedCertificateSha256;
  const marked = options.expected?.compromisedCertificateSha256;
  const known = new Map<string, CertificateFacts | null>();
  if (certificate.sha256 !== null) known.set(certificate.sha256, certificate.facts);
  /** SEC35-20: the certificate a revision names, out of the set the package retains. */
  const certificateOf = async (digest: string): Promise<CertificateFacts | null> => {
    if (known.has(digest)) return known.get(digest) ?? null;
    let facts: CertificateFacts | null = null;
    try {
      const text = await ports.reader.readText(retainedCertificatePath(digest), VERIFY_MAX_SMALL_FILE_BYTES);
      // The file is the certificate of that hash, whatever its name says.
      if (pemCertificateSha256(text) === digest) facts = ports.readCertificate(text);
    } catch {
      facts = null;
    }
    known.set(digest, facts);
    return facts;
  };

  let parent = manifest.transcript.sha256;
  for (const [index, revision] of list.revisions.entries()) {
    const revisionNo = revision.revisionNo;
    if (revisionNo !== index + 1) {
      // Nothing after a broken numbering is in a known order.
      verdict.add('REVISION_SEQUENCE_BROKEN', { revisionNo });
      break;
    }
    if (revision.parentSha256 !== parent) verdict.add('REVISION_PARENT_MISMATCH', { revisionNo });
    parent = revision.sha256;
    // The signature covers `sha256`; `sha256` must be the hash of a body that is IN the file, and what
    // the record says of the revision must be what that body says (pass D6, erratum PE-D6-01).
    if (revision.body === undefined) {
      verdict.add('REVISION_BODY_MISSING', { revisionNo });
    } else {
      let bodyOk = false;
      try {
        bodyOk = bytesToHex(sha256(canonicalJsonBytes(revision.body))) === revision.sha256;
      } catch {
        bodyOk = false;
      }
      if (!bodyOk) verdict.add('REVISION_BODY_HASH_MISMATCH', { revisionNo });
      const stated: Record<(typeof REVISION_BOUND_MEMBERS)[number], string | number | null> = {
        // The item and the transcript are the MANIFEST's (signed), not the list's own header.
        evidenceId: manifest.evidenceId,
        machineTranscriptSha256: manifest.transcript.sha256,
        revisionNo: revision.revisionNo,
        parentSha256: revision.parentSha256,
        authorId: revision.authorId,
        reason: revision.reason,
        createdAt: revision.createdAt,
      };
      for (const member of REVISION_BOUND_MEMBERS) {
        if (!Object.hasOwn(revision.body, member) || revision.body[member] !== stated[member]) verdict.add('REVISION_MEMBER_MISMATCH', { revisionNo, member });
      }
    }
    const digest = revision.signature.certificateSha256;
    const facts = digest === null ? null : await certificateOf(digest);
    if (digest === null || facts === null) {
      verdict.add('REVISION_CERTIFICATE_MISSING', { revisionNo });
      continue;
    }
    if (trusted !== undefined && !trusted.includes(digest)) verdict.add('REVISION_CERTIFICATE_NOT_TRUSTED', { revisionNo });
    // Row V5 (C84 R-2): a revision signed under a certificate the verifier was told is marked compromised.
    if (marked !== undefined && marked.includes(digest)) verdict.add('REVISION_CERTIFICATE_KEY_COMPROMISED', { revisionNo });
    let verified = false;
    try {
      verified = (await ports.verifySignature(revision.signature.algorithm, facts.publicKey, hexToBytes(revision.sha256), hexToBytes(revision.signature.value))) === true;
    } catch {
      verified = false;
    }
    if (!verified) verdict.add('REVISION_SIGNATURE_INVALID', { revisionNo });
  }
  return list.revisions.length;
}

/**
 * V-14. `transcript`: whether the transcript files are declared; null when the manifest could not
 * say. `tracks`: the camera files the manifest's own track list names (one or two, F-M7 R88-01);
 * null with an unreadable manifest, where both are held as declared.
 */
async function checkCompleteness(reader: PackageReader, transcript: boolean | null, tracks: readonly PackageVideoTrackId[] | null, verdict: Verdict, unexpectedExports: string[] = [], pending: { revisionAppend: boolean } = { revisionAppend: false }): Promise<void> {
  const declared = declaredPackageFiles({ transcript: transcript === true, ...(tracks === null ? {} : { tracks }) });
  for (const file of declared) {
    const entry = await reader.entry(file);
    if (entry.kind === 'ABSENT') verdict.add('DECLARED_FILE_MISSING', { file });
    else if (entry.kind !== 'FILE') verdict.add('DECLARED_FILE_UNREADABLE', { file });
  }
  // What else may lie in the folder cannot be said without the manifest.
  if (transcript === null) return;
  const listed = await reader.list(VERIFY_MAX_LISTED_FILES);
  if (listed === null) {
    verdict.add('PACKAGE_UNLISTABLE');
    return;
  }
  const allowed = new Set(declared);
  const retained = new RegExp(`^${RETAINED_CERTIFICATES_DIR}/[0-9a-f]{64}\\.pem$`);
  let named = 0;
  for (const file of [...listed].sort()) {
    // D185 (a): under `export/` only the finished artefacts of an export are expected; anything else is NAMED by a notice (it fails nothing).
    if (file.startsWith(`${PackageFile.EXPORT_DIR}/`) && !EXPORT_ARTEFACT_NAME.test(file.slice(PackageFile.EXPORT_DIR.length + 1))) unexpectedExports.push(file.slice(PackageFile.EXPORT_DIR.length + 1));
    // An export and an on-demand composite are derived and lie beside the sealed set (spec §A.1, §G).
    if (allowed.has(file) || file.startsWith(`${PackageFile.EXPORT_DIR}/`) || file.startsWith(`${PackageFile.COMPOSITE_DIR}/`) || retained.test(file)) continue;
    // D187: the staged revision list of a write under way - this EXACT name, in a package that declares a transcript - is NAMED by a notice and fails nothing.
    if (transcript === true && file === REVISION_APPEND_PENDING_FILE) {
      pending.revisionAppend = true;
      continue;
    }
    if (named < VERIFY_MAX_UNEXPECTED_NAMED) verdict.add('UNEXPECTED_FILE', { file });
    named += 1;
  }
}

/**
 * The model of the sealed transcript, for the report (D160). Only from the manifest the
 * certificate's key signed, and only when it declares a document; null otherwise - nothing an
 * unsigned manifest says of a model is repeated.
 */
function transcriptModelReport(manifest: ManifestV2 | null, trusted: boolean): TranscriptModelReport | null {
  if (manifest === null || !trusted || !manifestDeclaresTranscript(manifest.transcript)) return null;
  const { name, version, quantisation, modelSha256 } = manifest.transcript.model;
  // A document is declared, so the schema (V-01) holds a name; a manifest that passed it has one.
  if (name === null) return null;
  const facts = { name, version, quantisation, modelSha256, reportedByServer: isServerSttBackend(manifest.transcript.configSnapshot.backend) };
  return Object.freeze({ ...facts, report: transcriptModelLineOf(facts) });
}

/**
 * The transcript state of the report (row 119). `trusted`: V-01, V-03, V-09 and V-13 passed, so
 * the manifest read is the one the certificate's key signed. Otherwise nothing it says is repeated.
 */
function transcriptStateReport(manifest: ManifestV2 | null, trusted: boolean, hashFailed: boolean): TranscriptStateReport {
  const untold = (code: VerifiedTranscriptState): TranscriptStateReport =>
    Object.freeze({ code, report: TRANSCRIPT_STATE_REPORT[code], sealedState: null, reason: null, documentSealed: null, failedChunks: null, backendUnreachable: null });
  if (manifest === null) return untold(hashFailed ? VerifiedTranscriptState.NOT_TRUSTWORTHY : VerifiedTranscriptState.UNKNOWN);
  if (!trusted) return untold(VerifiedTranscriptState.NOT_TRUSTWORTHY);
  const transcript = manifest.transcript;
  const documentSealed = manifestDeclaresTranscript(transcript);
  let code: VerifiedTranscriptState;
  if (transcript.state === 'DISABLED') code = VerifiedTranscriptState.DISABLED_BY_CONFIGURATION;
  // STT was enabled and nothing could be sealed: its own state, never the disabled one.
  else if (!documentSealed) code = VerifiedTranscriptState.UNAVAILABLE_AT_SEAL;
  else if (transcript.state === 'ASSEMBLED') code = VerifiedTranscriptState.READY;
  else code = transcript.backendUnreachable ? VerifiedTranscriptState.PARTIAL_BACKEND_UNREACHABLE : VerifiedTranscriptState.PARTIAL;
  return Object.freeze({
    code,
    report: TRANSCRIPT_STATE_REPORT[code],
    sealedState: transcript.state,
    reason: transcript.disabledReason,
    documentSealed,
    failedChunks: transcript.failedChunks,
    backendUnreachable: transcript.backendUnreachable,
  });
}

const isSourceClass = (value: unknown): value is ManifestSourceClass => typeof value === 'string' && (MANIFEST_SOURCE_CLASSES as readonly string[]).includes(value);

/**
 * V-15 over the RAW manifest object (spec §D V-15). Returns false when the value is not a v2
 * manifest object at all: there is no mark to speak of and the check is blocked.
 *
 *   (a) well-formed, else MISSING: every `tracks[]` record and every `audio.sourceIntervals[]`
 *       record has a `sourceClass` out of the three values; `developmentSources` is a boolean.
 *       A manifest without a single camera record states no class and is refused the same way:
 *       "no source" is never read as "all production".
 *   (b) consistent, else CORRUPT: the flag equals "some source is not PRODUCTION"; one
 *       `micDeviceId` has one class.
 */
function checkSourceMark(raw: unknown, verdict: Verdict): boolean {
  if (!isRecord(raw) || raw.schema !== MANIFEST_V2_SCHEMA_ID) return false;
  const classes: ManifestSourceClass[] = [];
  let wellFormed = true;
  const classAt = (record: unknown, member: string): ManifestSourceClass | null => {
    if (!isRecord(record) || !Object.hasOwn(record, 'sourceClass')) verdict.add('SOURCE_CLASS_MISSING', { member });
    else if (!isSourceClass(record.sourceClass)) verdict.add('SOURCE_CLASS_INVALID', { member });
    else return record.sourceClass;
    wellFormed = false;
    return null;
  };

  if (!Array.isArray(raw.tracks) || raw.tracks.length === 0) {
    verdict.add('SOURCE_CLASS_MISSING', { member: 'tracks' });
    wellFormed = false;
  } else {
    for (const [index, track] of raw.tracks.entries()) {
      const sourceClass = classAt(track, `tracks.${index}.sourceClass`);
      if (sourceClass !== null) classes.push(sourceClass);
    }
  }

  const intervals: unknown = isRecord(raw.audio) ? raw.audio.sourceIntervals : undefined;
  const classOfMic = new Map<string, ManifestSourceClass>();
  const micClash: string[] = [];
  if (!Array.isArray(intervals)) {
    verdict.add('SOURCE_CLASS_MISSING', { member: 'audio.sourceIntervals' });
    wellFormed = false;
  } else {
    for (const [index, interval] of intervals.entries()) {
      const member = `audio.sourceIntervals.${index}.sourceClass`;
      const sourceClass = classAt(interval, member);
      if (sourceClass === null) continue;
      classes.push(sourceClass);
      const mic: unknown = isRecord(interval) ? interval.micDeviceId : undefined;
      if (typeof mic !== 'string') continue;
      const seen = classOfMic.get(mic);
      if (seen !== undefined && seen !== sourceClass) micClash.push(member);
      else classOfMic.set(mic, sourceClass);
    }
  }

  if (!Object.hasOwn(raw, 'developmentSources')) {
    verdict.add('DEVELOPMENT_FLAG_MISSING', { member: 'developmentSources' });
    wellFormed = false;
  } else if (typeof raw.developmentSources !== 'boolean') {
    verdict.add('DEVELOPMENT_FLAG_INVALID', { member: 'developmentSources' });
    wellFormed = false;
  }
  // (b) is asked only of a well-formed mark: a flag cannot agree with classes that are not there.
  if (!wellFormed) return true;
  const development = classes.some((sourceClass) => sourceClass !== ManifestSourceClass.PRODUCTION);
  if (raw.developmentSources !== development) verdict.add('DEVELOPMENT_FLAG_INCONSISTENT', { member: 'developmentSources' });
  for (const member of micClash) verdict.add('MIC_SOURCE_CLASS_INCONSISTENT', { member });
  return true;
}

const SOURCE_WORDS: Readonly<Record<ManifestSourceClass, { readonly camera: string; readonly microphone: string }>> = Object.freeze({
  PRODUCTION: { camera: 'declared production device', microphone: 'declared production device' },
  LOCAL_DEVICE: { camera: "this computer's camera", microphone: "this computer's microphone" },
  FAKE: { camera: 'fake source', microphone: 'fake source' },
});

/**
 * The `sources` block (spec §D.1). `trusted`: V-01, V-03, V-09, V-13 and V-15 passed, so the
 * classes read are the ones the certificate's key signed. Otherwise no class is repeated as fact
 * and `development` is null - never false, which a reader could take for "production".
 * `development` is recomputed from the classes, not copied from field 126.
 */
function sourcesReport(manifest: ManifestV2 | null, readable: boolean, trusted: boolean, ok: boolean): SourcesReport {
  if (manifest === null || !trusted) {
    const code = readable ? VerifiedSourcesState.NOT_TRUSTWORTHY : VerifiedSourcesState.UNKNOWN;
    return Object.freeze({ ok, code, development: null, report: SOURCES_STATE_REPORT[code], lines: Object.freeze([]), tracks: Object.freeze([]), audioIntervals: Object.freeze([]) });
  }
  const tracks = manifest.tracks.map((track) => Object.freeze({ trackId: track.trackId, deviceId: track.deviceId, sourceClass: track.sourceClass }));
  const audioIntervals = manifest.audio.sourceIntervals.map((interval) => Object.freeze({ seq: interval.seq, micDeviceId: interval.micDeviceId, sourceClass: interval.sourceClass }));
  const development = [...tracks, ...audioIntervals].some((source) => source.sourceClass !== ManifestSourceClass.PRODUCTION);
  const code = development ? VerifiedSourcesState.DEVELOPMENT : VerifiedSourcesState.DECLARED_PRODUCTION;
  const lines: string[] = [];
  if (development) {
    for (const track of tracks) lines.push(`${track.trackId}: ${track.deviceId}, ${SOURCE_WORDS[track.sourceClass].camera} (${track.sourceClass}).`);
    if (audioIntervals.length > 0) {
      const parts = audioIntervals.map((interval) => `interval ${interval.seq} ${interval.micDeviceId}, ${SOURCE_WORDS[interval.sourceClass].microphone} (${interval.sourceClass})`);
      lines.push(`${manifest.audio.trackId}: ${parts.join('; ')}.`);
    }
  }
  return Object.freeze({ ok, code, development, report: SOURCES_STATE_REPORT[code], lines: Object.freeze(lines), tracks: Object.freeze(tracks), audioIntervals: Object.freeze(audioIntervals) });
}

const GRAVITY: readonly VerifyFailureClass[] = ['TAMPERED', 'MISSING', 'CORRUPT', 'UNREADABLE'];
const BLOCKED_WITHOUT_MANIFEST: readonly VerifyCheckId[] = ['V-02', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13'];
/** `scope: 'MANIFEST'`: the checks that read more than the manifest and its seal. */
const OUTSIDE_MANIFEST_SCOPE: readonly VerifyCheckId[] = ['V-02', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-10', 'V-11', 'V-12', 'V-14'];

/** Verifies one sealed v2 package. See the head of this file. */
export async function verifyPackageV2(ports: VerifyPorts, options: VerifyOptions = {}): Promise<PackageVerifyResult> {
  const verdict = new Verdict();
  const newHash = ports.sha256 ?? nobleHash;
  const expected = options.expected ?? {};
  const files: FileVerifyResult[] = [];
  let revisions: number | null = null;
  let plaintextChecked = false;
  /** The subject the CERTIFICATE states of itself (V-13), or null when it was not read or the reader states none. */
  let certificateSubject: string | null = null;

  const manifestOnly = options.scope === 'MANIFEST';
  // R88-06: whether the audit extract is there. Its content is covered by nothing; the result says so.
  let auditExtractPresent = false;
  /** D185 (a): the paths under `export/` that are no finished export artefact (filled by V-14's listing). */
  const unexpectedExports: string[] = [];
  const pending = { revisionAppend: false };
  try {
    auditExtractPresent = (await ports.reader.entry(PackageFile.AUDIT_EXTRACT)).kind === 'FILE';
  } catch {
    auditExtractPresent = false;
  }

  const loaded = await loadManifest(ports.reader, verdict);
  const manifest = loaded.manifest;

  // V-15: the mark of the raw object. Without a v2 object there is nothing to read; a mark that
  // looks right in a manifest V-01 refused is not vouched for (SKIPPED, never PASS).
  const markReadable = checkSourceMark(loaded.raw, verdict);
  if (!markReadable || (manifest === null && !verdict.failed('V-15'))) verdict.skip('V-15', 'BLOCKED');

  if (manifest === null) {
    // V-03 can still speak about a JSON object that has the two members the hash rule names.
    if (isRecord(loaded.raw) && isRecord(loaded.raw.signature)) {
      let hashOk = false;
      try {
        hashOk = manifestHashMatches(loaded.raw);
      } catch {
        hashOk = false;
      }
      if (!hashOk) verdict.add('MANIFEST_HASH_MISMATCH', { member: 'manifestSha256' });
    } else verdict.skip('V-03', 'BLOCKED');
    for (const id of BLOCKED_WITHOUT_MANIFEST) verdict.skip(id, 'BLOCKED');
    if (manifestOnly) verdict.skip('V-14', 'OUT_OF_SCOPE');
    else await checkCompleteness(ports.reader, null, null, verdict);
  } else {
    // V-03
    let canonical = false;
    try {
      canonical = loaded.text === canonicalJson(manifest);
    } catch {
      canonical = false;
    }
    if (!canonical) verdict.add('MANIFEST_NOT_CANONICAL', { file: PackageFile.MANIFEST });
    if (!manifestHashMatches(manifest)) verdict.add('MANIFEST_HASH_MISMATCH', { member: 'manifestSha256' });
    if (expected.evidenceId !== undefined && expected.evidenceId !== manifest.evidenceId) verdict.add('MANIFEST_NOT_OF_ITEM', { member: 'evidenceId' });
    if (expected.sessionId !== undefined && expected.sessionId !== manifest.sessionId) verdict.add('MANIFEST_NOT_OF_ITEM', { member: 'sessionId' });
    if (expected.manifestSha256 !== undefined && expected.manifestSha256 !== manifest.manifestSha256) verdict.add('MANIFEST_NOT_OF_ITEM', { member: 'manifestSha256' });

    // V-13, V-09
    const certificate = await checkCertificate(ports, manifest, options, verdict);
    certificateSubject = certificate.facts?.subject ?? null;
    await checkSignature(ports, manifest, certificate, verdict);

    if (manifestOnly) for (const id of OUTSIDE_MANIFEST_SCOPE) verdict.skip(id, 'OUT_OF_SCOPE');
    else {
      // V-02 (`fragments.json`, SEC35-11)
      const fragmentsEntry = await ports.reader.entry(PackageFile.FRAGMENTS_JSON);
      if (fragmentsEntry.kind !== 'FILE') verdict.add('FRAGMENTS_JSON_MISSING', { file: PackageFile.FRAGMENTS_JSON }, fragmentsEntry.kind === 'ABSENT' ? 'MISSING' : 'UNREADABLE');
      else {
        let same = false;
        try {
          same = fragmentsJsonMatchesManifest(await ports.reader.readText(PackageFile.FRAGMENTS_JSON, VERIFY_MAX_MANIFEST_BYTES), manifest.files);
        } catch {
          same = false;
        }
        if (!same) verdict.add('FRAGMENTS_JSON_MISMATCH', { file: PackageFile.FRAGMENTS_JSON });
      }

      // V-02, V-04 to V-08, per camera file
      const mode = options.plaintext ?? 'REQUIRED';
      let anyKeyMissing = false;
      let anyPlainBlocked = false;
      for (const [index, track] of manifest.tracks.entries()) {
        const fragments = manifest.files[index]?.fragments ?? [];
        const geometry = checkRecords(track, index, fragments, verdict);
        let keyReady = ports.opener !== null;
        if (ports.opener !== null) {
          try {
            for (const keyId of new Set(fragments.map((fragment) => fragment.keyId))) if ((await ports.opener.hasKey(keyId)) !== true) keyReady = false;
          } catch {
            keyReady = false;
          }
        }
        if (!keyReady) {
          anyKeyMissing = true;
          if (mode === 'REQUIRED') verdict.add('SESSION_KEY_UNAVAILABLE', { trackId: track.trackId });
        }
        const outcome = await checkCameraFile({
          ports,
          newHash,
          verdict,
          track,
          fragments,
          geometry,
          keyReady,
          maxOpenBytes: options.maxOpenFragmentBytes ?? VERIFY_MAX_OPEN_FRAGMENT_BYTES,
        });
        files.push(outcome.result);
        if (outcome.plainBlocked) anyPlainBlocked = true;
      }
      if (anyPlainBlocked) verdict.skip('V-05', 'BLOCKED');
      else if (anyKeyMissing) verdict.skip('V-05', 'KEY_UNAVAILABLE');
      plaintextChecked = !anyKeyMissing && !anyPlainBlocked;

      // V-10, V-11
      await checkTranscript(ports, newHash, manifest, options, verdict);
      revisions = await checkRevisions(ports, manifest, certificate, options, verdict);

      // V-12: an interrupted package is verifiable and marked; its durable prefix must verify.
      if (manifest.timeline.interrupted) {
        const broken = (['V-04', 'V-06', 'V-07'] as const).flatMap((id) => verdict.findings(id));
        const first = broken[0];
        if (first !== undefined) verdict.add('INTERRUPTED_PREFIX_NOT_VERIFIED', first.trackId === undefined ? {} : { trackId: first.trackId }, first.failureClass);
      }

      // V-14
      // V-14: a transcript file is declared exactly when the manifest names a document. One that
      // lies in a package whose manifest declares none is a file nobody sealed (`UNEXPECTED_FILE`).
      await checkCompleteness(ports.reader, manifestDeclaresTranscript(manifest.transcript), manifest.tracks.map((track) => track.trackId), verdict, unexpectedExports, pending);
    }
  }

  const checks = verdict.checks();
  const ok = checks.every((check) => check.status === 'PASS' || (check.id === 'V-05' && check.skipped === 'KEY_UNAVAILABLE' && options.plaintext === 'WHEN_KEY_AVAILABLE'));
  const classes = new Set(checks.flatMap((check) => check.findings.map((finding) => finding.failureClass)));
  const overall: VerifyOverall = ok ? 'PASS' : (GRAVITY.find((failureClass) => classes.has(failureClass)) ?? 'UNREADABLE');
  const statusOf = (id: VerifyCheckId): VerifyCheckResult['status'] => checks.find((check) => check.id === id)?.status ?? 'SKIPPED';

  let transcriptState: PackageVerifyResult['transcript']['state'] = 'NOT_CHECKED';
  if (manifest !== null && !manifestOnly) {
    if (statusOf('V-10') === 'FAIL' || statusOf('V-11') === 'FAIL') transcriptState = 'FAILED';
    else if (manifest.transcript.state === 'DISABLED') transcriptState = 'DISABLED';
    else if (!manifestDeclaresTranscript(manifest.transcript)) transcriptState = 'UNAVAILABLE';
    else transcriptState = 'VERIFIED';
  }
  // The state is repeated as fact only from a manifest that is the signed one (spec §D.1, the rule
  // of the source mark, applied to the transcript state).
  const trusted = manifest !== null && (['V-01', 'V-03', 'V-09', 'V-13'] as const).every((id) => statusOf(id) === 'PASS');
  // Row V5 (C84 R-2): what the verifier says of the signing key's mark - ONLY when it was handed the list of marked
  // fingerprints. Without the list nothing below adds a member, a finding or a notice: the result is the one of before.
  // Row R1b (C99): the one line of the cameras that were absent inside the session, from the manifest as READ; '' = none stated.
  const videoAbsent = videoAbsentInSessionReport((manifest?.tracks ?? []).map((track) => ({ trackId: track.trackId, absences: track.absentInSession ?? [] })));
  // Pass I-9b: the one line of the sound that is absent across a worker restart, from the manifest as READ; '' = none stated.
  const audioAbsent = audioAbsentOnRestartReport(manifest?.audio.absentOnRestart ?? []);
  const toldOfMarks = expected.compromisedCertificateSha256 !== undefined;
  const underMarkedKey = toldOfMarks && checks.some((check) => check.findings.some((finding) => finding.code === 'CERTIFICATE_KEY_COMPROMISED' || finding.code === 'REVISION_CERTIFICATE_KEY_COMPROMISED'));
  const keyMark: VerifiedSigningKeyMark = underMarkedKey ? VerifiedSigningKeyMark.COMPROMISED : trusted ? VerifiedSigningKeyMark.NOT_MARKED : VerifiedSigningKeyMark.NOT_ESTABLISHED;

  return Object.freeze({
    schema: VERIFY_RESULT_SCHEMA_ID,
    ok,
    overall,
    checks: Object.freeze(checks),
    files: Object.freeze(files),
    fragments: Object.freeze(files.flatMap((file) => file.fragments)),
    transcript: Object.freeze({ state: transcriptState, revisions }),
    transcriptState: transcriptStateReport(manifest, trusted, statusOf('V-03') === 'FAIL'),
    transcriptModel: transcriptModelReport(manifest, trusted),
    sources: sourcesReport(manifest, markReadable, trusted && statusOf('V-15') === 'PASS', statusOf('V-15') === 'PASS'),
    signature: Object.freeze({
      ok: statusOf('V-09') === 'PASS',
      algorithm: manifest?.signature.algorithm ?? null,
      keyId: manifest?.signature.keyId ?? null,
      simulated: manifest?.signature.simulated ?? null,
      // FROM THE CERTIFICATE THAT VERIFIED THE SIGNATURE, and only when the manifest is the signed one
      // and its certificate holds (F-M7 R88-08): otherwise NOT ESTABLISHED - never `false` from unverified bytes.
      developmentKey: trusted && certificateSubject !== null ? isDevelopmentKeySubject(certificateSubject) : null,
      ...(toldOfMarks ? { compromisedKey: keyMark } : {}),
      integrityCheckedWithoutKey: true as const,
    }),
    interrupted: manifest?.timeline.interrupted ?? false,
    plaintextChecked,
    notices: Object.freeze([
      Object.freeze({ code: VERIFY_NOTICE.AUDIT_EXTRACT_NOT_SIGNED, report: auditExtractPresent ? AUDIT_EXTRACT_NOT_SIGNED_REPORT.PRESENT : AUDIT_EXTRACT_NOT_SIGNED_REPORT.MISSING }),
      ...(unexpectedExports.length === 0 ? [] : [Object.freeze({ code: VERIFY_NOTICE.EXPORT_FOLDER_UNEXPECTED_FILE, report: exportFolderNoticeReport(unexpectedExports) })]),
      ...(pending.revisionAppend ? [Object.freeze({ code: VERIFY_NOTICE.REVISION_APPEND_PENDING, report: REVISION_APPEND_PENDING_REPORT })] : []),
      // Row V5: the state beside the verdict - this verifier holds no record of the Core to hold such a package to.
      ...(underMarkedKey ? [Object.freeze({ code: VERIFY_NOTICE.SIGNED_BY_COMPROMISED_KEY, report: SIGNED_BY_COMPROMISED_KEY_REPORT.COMPROMISED_KEY_NO_RECORD })] : []),
      // Row V6 (C97; row P1's request): the manifest's optional member `hostProfileNotAsked` is SAID in the verdict. It fails nothing.
      ...(manifest?.hostProfileNotAsked === undefined ? [] : [Object.freeze({ code: VERIFY_NOTICE.HOST_PROFILE_NOT_ASKED, report: hostProfileNotAskedReport(manifest.hostProfileNotAsked.platform) })]),
      // Row R1b (C99): the manifest's optional member `tracks[].absentInSession` is SAID in the verdict. It fails nothing.
      ...(videoAbsent === '' ? [] : [Object.freeze({ code: VERIFY_NOTICE.VIDEO_ABSENT_IN_SESSION, report: videoAbsent })]),
      // Pass I-9b: the manifest's optional member `audio.absentOnRestart` is SAID in the verdict. It fails nothing.
      ...(audioAbsent === '' ? [] : [Object.freeze({ code: VERIFY_NOTICE.AUDIO_ABSENT_ON_RESTART, report: audioAbsent })]),
    ]),
  });
}
