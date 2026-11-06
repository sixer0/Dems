// Test support of row 119 (`M7-STTCFG-VERIFY`): a builder of REAL sealed v2 packages on disk whose
// transcript block is the one the seal step answered, and the tamper tool. Not a test file.
//
// It is the minimum of row 85's builder (`src/evidence-verify/__tests__/support.ts`), written again
// here because that file belongs to another unit's tests. What is real: the bytes of both camera
// files in a throw-away folder, every SHA-256, the fragment chain, AES-256-GCM per fragment (Node
// `crypto`, a random key and nonce per run), the manifest (row 83's builder and strict schema),
// the Ed25519 signature and the X.509 certificate of a throw-away key (row 83's signer). What is
// NOT: the media (random bytes, not fMP4), the key store (the key is a Buffer of this file) and
// the database (the item is a value). Nothing here is evidence.
//
// THE FRAGMENT CIPHER IS A TEST DOUBLE, as in row 85's support: the algorithm and AAD layout that
// row 84 states, so that the plaintext check (V-05) runs and all 14 checks can pass.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
} from '@dems/shared/evidence-package';
import { TRANSCRIPT_REVISIONS_SCHEMA_ID, type FragmentOpener, type VerifyExpectations } from '@dems/shared/evidence-verify';
import { deviceCertificateBlock, loadSoftwareSigner, provisionSigningKey, signManifest, signatureBlock, verifyEd25519, type LoadedSigner } from '../../capture';
import type { TranscriptFiles } from '../index';

export const PACKAGE_NOW = 1_791_500_000_000;
const SIGNED_AT = PACKAGE_NOW + 8_500;
export const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const made: string[] = [];
function scratch(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `dems-row119-${label}-`));
  made.push(dir);
  return dir;
}
export function removePackages(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/** A throw-away signing key with its certificate, through row 83's signer. */
export function throwAwaySigner(): LoadedSigner {
  const dir = join(scratch('signer'), 'store');
  provisionSigningKey({ dir, now: PACKAGE_NOW });
  return loadSoftwareSigner({ dir, now: PACKAGE_NOW + 1_000 });
}

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

function openerOf(keyId: string, key: Buffer): FragmentOpener {
  return {
    hasKey: (asked) => asked === keyId,
    open(record, stored) {
      if (record.keyId !== keyId) throw new Error('no key');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.gcmIv, 'hex'), { authTagLength: 16 });
      decipher.setAAD(aadOf(record));
      decipher.setAuthTag(Buffer.from(record.gcmTag, 'hex'));
      return new Uint8Array(Buffer.concat([decipher.update(stored), decipher.final()]));
    },
  };
}

function write(dir: string, relative: string, bytes: Uint8Array | string): void {
  const target = join(dir, ...relative.split('/'));
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, bytes);
}

export interface SealedPackage {
  readonly dir: string;
  readonly manifest: ManifestV2;
  readonly signer: LoadedSigner;
  readonly opener: FragmentOpener;
  /** What the Core holds of the item outside its package: the anchors of verify. */
  readonly anchors: VerifyExpectations;
  readonly path: (relative: string) => string;
}

export interface SealOptions {
  /** The transcript block of the manifest: what `FINALIZE_TRANSCRIPT` answered. */
  readonly transcript: ManifestV2Input['transcript'];
  /** The three files the seal step handed over; null when the step sealed no document. They are COPIED into `transcript/`. */
  readonly files: TranscriptFiles | null;
  readonly signer?: LoadedSigner;
}

/** Builds, seals and writes one package around the transcript block of a seal step. */
export async function sealPackage(options: SealOptions): Promise<SealedPackage> {
  const signer = options.signer ?? throwAwaySigner();
  const dir = join(scratch('package'), 'SES-20261009-0001');
  mkdirSync(dir, { recursive: true });
  const input = exampleManifestInput();
  const keyId = sessionKeyId(input.sessionId);
  const key = randomBytes(32);
  const header = randomBytes(129);
  const tail = randomBytes(17);

  const files: ManifestFile[] = [];
  for (const [index, trackId] of (['VIDEO-01', 'VIDEO-02'] as const).entries()) {
    const stored: Buffer[] = [header];
    const plain: Buffer[] = [header];
    const fragments: ManifestFragment[] = [];
    let chain = FRAGMENT_CHAIN_GENESIS;
    let byteOffset = header.byteLength;
    for (let seq = 1; seq <= 3; seq += 1) {
      const plaintext = randomBytes(500);
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      cipher.setAAD(aadOf({ trackId, seq, byteOffset, keyId }));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const fragmentSha = sha256Hex(ciphertext);
      chain = nextFragmentChainHash(chain, fragmentSha);
      stored.push(ciphertext);
      plain.push(plaintext);
      fragments.push({
        seq,
        byteOffset,
        byteLength: plaintext.byteLength,
        mediaStartMs: (seq - 1) * 2_000,
        mediaDurationMs: 2_000,
        sha256: fragmentSha,
        sha256Plain: sha256Hex(plaintext),
        chainHash: chain,
        prefixSha256: sha256Hex(Buffer.concat(stored)),
        keyframe: true,
        interrupted: false,
        truncated: false,
        gcmIv: nonce.toString('hex'),
        gcmTag: cipher.getAuthTag().toString('hex'),
        keyId,
        durableAt: PACKAGE_NOW + 2_000 + seq * 2_000,
      });
      byteOffset += plaintext.byteLength;
    }
    stored.push(tail);
    plain.push(tail);
    const file = Buffer.concat(stored);
    write(dir, cameraFilePath(trackId), file);
    files.push({ trackId, fragments });
    const track = input.tracks[index];
    if (track === undefined) throw new Error('the example has two tracks');
    Object.assign(track, { bytes: file.byteLength, sha256: sha256Hex(file), sha256Plain: sha256Hex(Buffer.concat(plain)), fragmentChainHead: chain, fragmentCount: fragments.length, durationMs: fragments.length * 2_000 });
  }
  input.files = files;

  // THE TRANSCRIPT: the block of the seal step, unchanged, and the files it handed over, byte for byte.
  input.transcript = options.transcript;
  if (options.files !== null) {
    mkdirSync(join(dir, PackageFile.TRANSCRIPT_DIR), { recursive: true });
    copyFileSync(options.files.json, join(dir, ...PackageFile.TRANSCRIPT_JSON.split('/')));
    copyFileSync(options.files.srt, join(dir, ...PackageFile.TRANSCRIPT_SRT.split('/')));
    copyFileSync(options.files.vtt, join(dir, ...PackageFile.TRANSCRIPT_VTT.split('/')));
  }

  input.signature = signatureBlock(signer.signer, signer.certificate, SIGNED_AT);
  input.device.certificate = deviceCertificateBlock(signer.certificate);

  const { manifest, detached } = await signManifest(signer.signer, buildUnsignedManifest(input, EXAMPLE_SOURCE_ROWS), verifyEd25519);
  write(dir, PackageFile.MANIFEST, serializeManifest(manifest));
  write(dir, PackageFile.SIGNATURE, serializeDetachedSignature(detached));
  write(dir, PackageFile.CERTIFICATE, signer.certificate.pemText);
  write(dir, PackageFile.FRAGMENTS_JSON, serializeFragmentsJson(manifest.files));
  write(dir, PackageFile.AUDIT_EXTRACT, '{"type":"SESSION_STARTED"}\n');
  // The revision list exists exactly when a machine transcript is sealed (no revision yet).
  if (options.files !== null) write(dir, PackageFile.TRANSCRIPT_REVISIONS, canonicalJsonBytes({ schema: TRANSCRIPT_REVISIONS_SCHEMA_ID, evidenceId: manifest.evidenceId, machineTranscriptSha256: manifest.transcript.sha256, revisions: [] }));

  return {
    dir,
    manifest,
    signer,
    opener: openerOf(keyId, key),
    anchors: {
      evidenceId: manifest.evidenceId,
      sessionId: manifest.sessionId,
      manifestSha256: manifest.manifestSha256,
      transcriptSha256: manifest.transcript.sha256,
      revisionCount: 0,
      trustedCertificateSha256: [signer.certificate.sha256],
    },
    path: (relative) => join(dir, ...relative.split('/')),
  };
}

/**
 * WHAT SOMEBODY WITHOUT THE CORE'S KEY CAN DO TO THE MANIFEST ON DISK.
 *
 *   RAW        the member is changed and nothing else: the hash in the file is the old one
 *   REHASHED   `manifestSha256` is recomputed and `signature.sig` rewritten to match: the edit is
 *              hidden from the hash; the signature is the old one (there is no key to make another)
 *   RESIGNED   as REHASHED, and signed with ANOTHER key; the Core's certificate stays in place
 *   FORGED     as RESIGNED, and the certificate of that other key is put in place of the Core's:
 *              a package that is consistent with itself
 */
export type TamperDepth = 'RAW' | 'REHASHED' | 'RESIGNED' | 'FORGED';

export function tamperManifest(sealed: Pick<SealedPackage, 'dir'>, depth: TamperDepth, change: (manifest: Record<string, any>) => void, other?: LoadedSigner): void {
  const file = join(sealed.dir, PackageFile.MANIFEST);
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, any>;
  change(manifest);
  if ((depth === 'RESIGNED' || depth === 'FORGED') && other === undefined) throw new Error('another signer is needed');
  if (depth === 'FORGED' && other !== undefined) {
    manifest.signature.certificate.sha256 = other.certificate.sha256;
    manifest.signature.keyId = other.signer.keyId;
    manifest.device.certificate = deviceCertificateBlock(other.certificate);
    writeFileSync(join(sealed.dir, PackageFile.CERTIFICATE), other.certificate.pemText);
  }
  if (depth !== 'RAW') manifest.manifestSha256 = computeManifestSha256(manifest);
  if ((depth === 'RESIGNED' || depth === 'FORGED') && other !== undefined) {
    manifest.signature.value = Buffer.from(other.signer.sign(Buffer.from(manifest.manifestSha256 as string, 'hex')) as Uint8Array).toString('hex');
  }
  writeFileSync(file, serializeManifest(manifest));
  if (depth !== 'RAW') writeFileSync(join(sealed.dir, PackageFile.SIGNATURE), serializeDetachedSignature(detachedSignatureOf(manifest as unknown as ManifestV2)));
}
