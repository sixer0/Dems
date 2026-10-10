// Test support of verify v2 (blueprint row 85): a small builder of REAL sealed v2 packages on
// disk, and the tamper tools.
//
// What is real: the bytes of both camera files in a throw-away folder, every SHA-256, the fragment
// chain, AES-256-GCM per fragment (Node `crypto`, a random key and nonce per run), the manifest
// (row 83's builder and strict schema), the Ed25519 signature and the X.509 certificate of a
// throw-away key (row 83's signer). What is NOT: the media (random bytes, not fMP4 - the writer
// is row 59), the key store (the key is a Buffer of this file; the store is row 84) and the
// database (the item is a value). Nothing here is evidence.
//
// THE FRAGMENT CIPHER OF THIS FILE IS A TEST DOUBLE of row 84's `fragment-cipher.ts`: the same
// algorithm and the AAD layout its header states, written again here so that this row's tests do
// not import the credential store (its users are a pinned list). It proves the verifier's use of
// the `FragmentOpener` seam, not the product cipher.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EXAMPLE_SOURCE_ROWS,
  FRAGMENT_CHAIN_GENESIS,
  PackageFile,
  buildUnsignedManifest,
  cameraFilePath,
  canonicalJsonBytes,
  computeManifestSha256,
  detachedSignatureOf,
  exampleManifestInput,
  nextFragmentChainHash,
  serializeDetachedSignature,
  serializeFragmentsJson,
  serializeManifest,
  sessionKeyId,
  type ManifestFile,
  type ManifestFragment,
  type ManifestV2,
  type ManifestV2Input,
  type PackageVideoTrackId,
  type SessionCaptureSourceRow,
} from '@dems/shared/evidence-package';
import {
  TRANSCRIPT_REVISIONS_SCHEMA_ID,
  retainedCertificatePath,
  type FragmentOpener,
  type SealedRangeRecord,
  type TranscriptRevisionRecord,
} from '@dems/shared/evidence-verify';
import { deviceCertificateBlock, loadSoftwareSigner, provisionSigningKey, signManifest, signatureBlock, verifyEd25519, type LoadedSigner } from '../../capture';
import type { RealEvidenceItem } from '../index';

export const NOW = 1_791_500_000_000;
const SIGNED_AT = NOW + 8_500;
export const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const made: string[] = [];
/** A throw-away folder below the system temporary folder. */
export function scratch(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `dems-row85-${label}-`));
  made.push(dir);
  return dir;
}
export function removeScratch(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/** A throw-away signing key with its certificate, through row 83's signer. */
export function throwAwaySigner(keyId?: string): LoadedSigner {
  const dir = join(scratch('signer'), 'store');
  provisionSigningKey({ dir, now: NOW, ...(keyId === undefined ? {} : { keyId }) });
  return loadSoftwareSigner({ dir, now: NOW + 1_000, ...(keyId === undefined ? {} : { keyId }) });
}

// ── The test double of the fragment cipher ─────────────────────────────────────────────────────

/** `"dems.fragment-aad/1" 0x00 | u16 len, trackId | u64 seq | u64 byteOffset | u16 len, keyId` (row 84's stated layout). */
function aadOf(position: { trackId: string; seq: number; byteOffset: number; keyId: string }): Buffer {
  const track = Buffer.from(position.trackId, 'ascii');
  const keyId = Buffer.from(position.keyId, 'ascii');
  const numbers = Buffer.alloc(16);
  numbers.writeBigUInt64BE(BigInt(position.seq), 0);
  numbers.writeBigUInt64BE(BigInt(position.byteOffset), 8);
  const trackLength = Buffer.alloc(2);
  trackLength.writeUInt16BE(track.byteLength, 0);
  const keyLength = Buffer.alloc(2);
  keyLength.writeUInt16BE(keyId.byteLength, 0);
  return Buffer.concat([Buffer.from('dems.fragment-aad/1\u0000', 'utf8'), trackLength, track, numbers, keyLength, keyId]);
}

/** A `FragmentOpener` over keys held in memory: real AES-256-GCM, tag and AAD verified. */
export function testOpener(keys: ReadonlyMap<string, Buffer>): FragmentOpener & { readonly opened: SealedRangeRecord[] } {
  const opened: SealedRangeRecord[] = [];
  return {
    opened,
    hasKey: (keyId) => keys.has(keyId),
    open(record, stored) {
      const key = keys.get(record.keyId);
      if (key === undefined) throw new Error('no key');
      opened.push(record);
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.gcmIv, 'hex'), { authTagLength: 16 });
      decipher.setAAD(aadOf(record));
      decipher.setAuthTag(Buffer.from(record.gcmTag, 'hex'));
      // Throws when the tag does not verify.
      return new Uint8Array(Buffer.concat([decipher.update(stored), decipher.final()]));
    },
  };
}

// ── The builder ────────────────────────────────────────────────────────────────────────────────

export interface BuildOptions {
  readonly signer?: LoadedSigner;
  /** Fragments per camera file (default 5) and the bytes of each (default 700; all equal, so ranges can be swapped). */
  readonly fragments?: number;
  readonly fragmentBytes?: number;
  /** Clear bytes before the first sealed range (the container header) and after the last. */
  readonly headerBytes?: number;
  readonly tailBytes?: number;
  readonly transcript?: 'ASSEMBLED' | 'DISABLED';
  /** The backend of the session and the model it sealed (pass D10, D160). Default: the example's `cpu-local` model with all four members. */
  readonly transcriptModel?: { readonly backend: 'omlx-server' | 'cpu-local'; readonly model: { readonly name: string | null; readonly version: string | null; readonly quantisation: string | null; readonly modelSha256: string | null } };
  /** The bytes of `transcript/transcript.json` instead of the document that says what the manifest says (a document that disagrees). */
  readonly transcriptDocument?: string;
  /** Signed revisions appended to the transcript. */
  readonly revisions?: number;
  /**
   * ANOTHER CIPHER than the double of this file (integration pass A: row 84's product sealer). It
   * is given the position a fragment is sealed with and returns the stored bytes and the three
   * values of its record. The built package's own `key` / `opener` then do not open it.
   */
  readonly sealer?: (position: { trackId: string; seq: number; byteOffset: number }, plaintext: Uint8Array) => { ciphertext: Uint8Array; gcmIv: string; gcmTag: string; keyId: string };
  /** The position a fragment is SEALED with, when it is not its own (a relocated ciphertext). */
  readonly sealAs?: (trackId: PackageVideoTrackId, seq: number, byteOffset: number) => { trackId: string; seq: number; byteOffset: number } | null;
  /** Changes the manifest input after the files exist and BEFORE the hash and the signature: a package that is sealed wrong. */
  readonly beforeSeal?: (input: ManifestV2Input) => void;
  readonly signedAt?: number;
  /** Row 141: the item the package is of (default: the example's), set before the key ID is derived. */
  readonly sessionId?: string;
  readonly evidenceId?: string;
  /**
   * Row 141: the four `session_capture_sources` rows the classes are computed from (default: the
   * example's, all FAKE). The builder never takes a class: it takes the rows, as the seal does.
   */
  readonly sourceRows?: readonly SessionCaptureSourceRow[];
  /** Row 141: the manifest folder is `<scratch>/<folderName>` (default: the session ID). */
  readonly folderName?: string;
}

export interface BuiltPackage {
  /** The package folder. */
  readonly dir: string;
  readonly manifest: ManifestV2;
  readonly signer: LoadedSigner;
  readonly item: RealEvidenceItem;
  readonly keyId: string;
  readonly key: Buffer;
  readonly opener: ReturnType<typeof testOpener>;
  readonly path: (relative: string) => string;
  /** The record of one fragment. */
  readonly fragment: (trackId: PackageVideoTrackId, seq: number) => ManifestFragment;
}

/**
 * The canonical document as far as verify reads it (V-10, pass D10): the header states the backend
 * and the model, which must be the manifest's (`configSnapshot.backend`, `model.*`).
 */
export function transcriptDocumentText(backend: string, model: { readonly name: string | null; readonly version: string | null; readonly quantisation: string | null; readonly modelSha256: string | null }): string {
  return `${JSON.stringify({ documentVersion: 'dems.transcript/1', header: { backend, model: { name: model.name, version: model.version, quantisation: model.quantisation, sha256: model.modelSha256 } }, segments: [] })}\n`;
}

const TRANSCRIPT_TEXT = { srt: '1\n00:00:00,000 --> 00:00:01,000\nexample\n', vtt: 'WEBVTT\n\n00:00.000 --> 00:01.000\nexample\n' };

function write(dir: string, relative: string, bytes: Uint8Array | string): void {
  const target = join(dir, ...relative.split('/'));
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, bytes);
}

/**
 * One signed revision record over a canonical body. The body carries the members verify V-11 holds
 * the record to (`REVISION_BOUND_MEMBERS`, pass D6): the item, the machine transcript, the number,
 * the parent, who, why and when.
 */
export function revisionRecord(
  signer: LoadedSigner,
  of: { readonly evidenceId: string; readonly transcript: { readonly sha256: string | null } },
  revisionNo: number,
  parentSha256: string,
  certificateSha256: string | null = signer.certificate.sha256,
): TranscriptRevisionRecord {
  const authorId = 'OP-0001';
  const reason = 'a correction for the test';
  const createdAt = SIGNED_AT + revisionNo * 1_000;
  const body = {
    evidenceId: of.evidenceId,
    machineTranscriptSha256: of.transcript.sha256,
    revisionNo,
    parentSha256,
    authorId,
    reason,
    createdAt,
    changes: [{ segmentIndex: 0, from: 'example', to: `example ${revisionNo}` }],
  };
  const digest = sha256Hex(canonicalJsonBytes(body));
  const value = Buffer.from(signer.signer.sign(Buffer.from(digest, 'hex')) as Uint8Array).toString('hex');
  return { revisionNo, parentSha256, sha256: digest, authorId, reason, createdAt, signature: { algorithm: 'Ed25519', keyId: signer.signer.keyId, value, certificateSha256 }, body };
}

export function writeRevisions(dir: string, manifest: ManifestV2, revisions: readonly TranscriptRevisionRecord[]): void {
  write(dir, PackageFile.TRANSCRIPT_REVISIONS, canonicalJsonBytes({ schema: TRANSCRIPT_REVISIONS_SCHEMA_ID, evidenceId: manifest.evidenceId, machineTranscriptSha256: manifest.transcript.sha256, revisions }));
}

/** Builds, seals and writes one package. */
export async function buildPackage(options: BuildOptions = {}): Promise<BuiltPackage> {
  const signer = options.signer ?? throwAwaySigner();
  const input = exampleManifestInput();
  if (options.sessionId !== undefined) input.sessionId = options.sessionId;
  if (options.evidenceId !== undefined) input.evidenceId = options.evidenceId;
  const dir = join(scratch('package'), options.folderName ?? input.sessionId);
  mkdirSync(dir, { recursive: true });
  const keyId = sessionKeyId(input.sessionId);
  const key = randomBytes(32);
  const count = options.fragments ?? 5;
  const length = options.fragmentBytes ?? 700;
  const header = randomBytes(options.headerBytes ?? 129);
  const tail = randomBytes(options.tailBytes ?? 17);

  const files: ManifestFile[] = [];
  for (const [index, trackId] of (['VIDEO-01', 'VIDEO-02'] as const).entries()) {
    const stored: Buffer[] = [header];
    const plain: Buffer[] = [header];
    const fragments: ManifestFragment[] = [];
    let chain = FRAGMENT_CHAIN_GENESIS;
    let byteOffset = header.byteLength;
    for (let seq = 1; seq <= count; seq += 1) {
      const plaintext = randomBytes(length);
      const position = options.sealAs?.(trackId, seq, byteOffset) ?? { trackId, seq, byteOffset };
      let sealed: { ciphertext: Buffer; gcmIv: string; gcmTag: string; keyId: string };
      if (options.sealer !== undefined) {
        const made = options.sealer(position, plaintext);
        sealed = { ...made, ciphertext: Buffer.from(made.ciphertext) };
      } else {
        const nonce = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
        cipher.setAAD(aadOf({ ...position, keyId }));
        const bytes = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        sealed = { ciphertext: bytes, gcmIv: nonce.toString('hex'), gcmTag: cipher.getAuthTag().toString('hex'), keyId };
      }
      const ciphertext = sealed.ciphertext;
      const fragmentSha = sha256Hex(ciphertext);
      chain = nextFragmentChainHash(chain, fragmentSha);
      stored.push(ciphertext);
      plain.push(plaintext);
      fragments.push({
        seq,
        byteOffset,
        byteLength: length,
        mediaStartMs: (seq - 1) * 2_000,
        mediaDurationMs: 2_000,
        sha256: fragmentSha,
        sha256Plain: sha256Hex(plaintext),
        chainHash: chain,
        prefixSha256: sha256Hex(Buffer.concat(stored)),
        keyframe: true,
        interrupted: false,
        truncated: false,
        gcmIv: sealed.gcmIv,
        gcmTag: sealed.gcmTag,
        keyId: sealed.keyId,
        durableAt: NOW + 2_000 + seq * 2_000,
      });
      byteOffset += length;
    }
    stored.push(tail);
    plain.push(tail);
    const file = Buffer.concat(stored);
    write(dir, cameraFilePath(trackId), file);
    files.push({ trackId, fragments });
    const track = input.tracks[index];
    if (track === undefined) throw new Error('the example has two tracks');
    Object.assign(track, { bytes: file.byteLength, sha256: sha256Hex(file), sha256Plain: sha256Hex(Buffer.concat(plain)), fragmentChainHead: chain, fragmentCount: count, durationMs: count * 2_000 });
  }
  input.files = files;

  if ((options.transcript ?? 'ASSEMBLED') === 'DISABLED') {
    input.transcript = {
      ...input.transcript,
      file: null,
      docVersion: null,
      sha256: null,
      srtSha256: null,
      vttSha256: null,
      model: { name: null, version: null, quantisation: null, modelSha256: null },
      diarization: { numSpeakers: null, status: null, confidence: null },
      speakerState: null,
      state: 'DISABLED',
      failedChunks: null,
      revisionHead: null,
      disabledReason: 'DISABLED_BY_CONFIGURATION',
      configSnapshot: { ...input.transcript.configSnapshot, enabled: false },
    };
  } else {
    // The model of the session: `options.transcriptModel` (a server session states the name only), else the example's.
    if (options.transcriptModel !== undefined) {
      input.transcript.model = { ...options.transcriptModel.model };
      input.transcript.configSnapshot = { ...input.transcript.configSnapshot, backend: options.transcriptModel.backend, model: options.transcriptModel.model.name ?? input.transcript.configSnapshot.model };
    }
    const documentText = options.transcriptDocument ?? transcriptDocumentText(input.transcript.configSnapshot.backend, input.transcript.model);
    write(dir, PackageFile.TRANSCRIPT_JSON, documentText);
    write(dir, PackageFile.TRANSCRIPT_SRT, TRANSCRIPT_TEXT.srt);
    write(dir, PackageFile.TRANSCRIPT_VTT, TRANSCRIPT_TEXT.vtt);
    input.transcript.sha256 = sha256Hex(Buffer.from(documentText));
    input.transcript.srtSha256 = sha256Hex(Buffer.from(TRANSCRIPT_TEXT.srt));
    input.transcript.vttSha256 = sha256Hex(Buffer.from(TRANSCRIPT_TEXT.vtt));
  }

  input.signature = signatureBlock(signer.signer, signer.certificate, options.signedAt ?? SIGNED_AT);
  input.device.certificate = deviceCertificateBlock(signer.certificate);
  options.beforeSeal?.(input);

  const { manifest, detached } = await signManifest(signer.signer, buildUnsignedManifest(input, options.sourceRows ?? EXAMPLE_SOURCE_ROWS), verifyEd25519);
  write(dir, PackageFile.MANIFEST, serializeManifest(manifest));
  write(dir, PackageFile.SIGNATURE, serializeDetachedSignature(detached));
  write(dir, PackageFile.CERTIFICATE, signer.certificate.pemText);
  write(dir, PackageFile.FRAGMENTS_JSON, serializeFragmentsJson(manifest.files));
  write(dir, PackageFile.AUDIT_EXTRACT, '{"type":"SESSION_STARTED"}\n');

  let revisions = 0;
  if (manifest.transcript.state !== 'DISABLED' && manifest.transcript.sha256 !== null) {
    const records: TranscriptRevisionRecord[] = [];
    let parent = manifest.transcript.sha256;
    for (let revisionNo = 1; revisionNo <= (options.revisions ?? 0); revisionNo += 1) {
      const record = revisionRecord(signer, manifest, revisionNo, parent);
      records.push(record);
      parent = record.sha256;
    }
    revisions = records.length;
    writeRevisions(dir, manifest, records);
  }

  return {
    dir,
    manifest,
    signer,
    keyId,
    key,
    opener: testOpener(new Map([[keyId, key]])),
    item: { evidenceId: manifest.evidenceId, sessionId: manifest.sessionId, manifestSha256: manifest.manifestSha256, transcriptSha256: manifest.transcript.sha256, revisionCount: revisions },
    path: (relative) => join(dir, ...relative.split('/')),
    fragment: (trackId, seq) => {
      const found = manifest.files.find((file) => file.trackId === trackId)?.fragments.find((fragment) => fragment.seq === seq);
      if (found === undefined) throw new Error(`no fragment ${trackId} ${seq}`);
      return found;
    },
  };
}

// ── The tamper tools: what somebody without the Core's key can do to a package on disk ──────────

/** Inverts one byte of a file. */
export function flipByte(file: string, offset: number): void {
  const bytes = readFileSync(file);
  if (offset >= bytes.byteLength) throw new Error('offset outside the file');
  bytes[offset] = (bytes[offset] ?? 0) ^ 0xff;
  writeFileSync(file, bytes);
}

export function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/**
 * Rewrites the manifest with a change and RECOMPUTES `manifestSha256` (and `signedDigest` of
 * `signature.sig`): what an editor does who hides the edit from the hash. The signature is left
 * as it was, or made anew with `resignWith` (a key that is not the Core's).
 */
export function editManifest(
  built: Pick<BuiltPackage, 'dir'>,
  change: (manifest: Record<string, any>) => void,
  options: { readonly recomputeHash?: boolean; readonly resignWith?: LoadedSigner; readonly replaceCertificate?: boolean; readonly rewriteFragmentsJson?: boolean } = {},
): void {
  const file = join(built.dir, PackageFile.MANIFEST);
  const manifest = readJson(file) as Record<string, any>;
  change(manifest);
  const other = options.resignWith;
  if (other !== undefined && options.replaceCertificate === true) {
    manifest.signature.certificate.sha256 = other.certificate.sha256;
    manifest.device.certificate = deviceCertificateBlock(other.certificate);
    writeFileSync(join(built.dir, PackageFile.CERTIFICATE), other.certificate.pemText);
  }
  if (options.recomputeHash === true || other !== undefined) manifest.manifestSha256 = computeManifestSha256(manifest);
  if (other !== undefined) manifest.signature.value = Buffer.from(other.signer.sign(Buffer.from(manifest.manifestSha256 as string, 'hex')) as Uint8Array).toString('hex');
  writeFileSync(file, serializeManifest(manifest));
  if (options.recomputeHash === true || other !== undefined) {
    writeFileSync(join(built.dir, PackageFile.SIGNATURE), serializeDetachedSignature(detachedSignatureOf(manifest as unknown as ManifestV2)));
  }
  if (options.rewriteFragmentsJson === true) writeFileSync(join(built.dir, PackageFile.FRAGMENTS_JSON), serializeFragmentsJson(manifest.files as ManifestFile[]));
}

/** Writes a certificate into the retained set of a package. */
export function retainCertificate(built: Pick<BuiltPackage, 'dir'>, signer: LoadedSigner): void {
  write(built.dir, retainedCertificatePath(signer.certificate.sha256), signer.certificate.pemText);
}
