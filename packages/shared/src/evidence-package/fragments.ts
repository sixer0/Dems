/**
 * `fragments/fragments.json` (spec §A.1 "fragments.json coverage", §B.6; SEC35-11).
 *
 * It is NOT an independent document: its `files[].fragments[]` is the exact serialization of the
 * manifest's `files[].fragments[]` records. Both are written from one value by one serializer
 * (canonical JSON), and `fragmentsJsonMatchesManifest` is the byte comparison verify V-02 needs.
 *
 * THE SEAM TO THE WRITER (row 59). The fMP4 writer does not exist yet. `FragmentTableInput` is the
 * typed value its fragment table (or the `recording_fragments` rows) is turned into; nothing here
 * reads a file or a database.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';
import { canonicalJson, canonicalJsonBytes } from './canonical';
import { EvidencePackageError, EvidencePackageRefusal } from './errors';
import { isSealedAudioTrackList, isSealedTrackList } from './layout';
import { ManifestAudioFileSchema, ManifestFileSchema, type ManifestAudioFile, type ManifestFile } from './manifest';

export const FRAGMENTS_JSON_SCHEMA_ID = 'dems.fragments/1';

/**
 * D5 (spec S5 §5.2): the file list carries the audio files of the pairs AFTER the camera files, with
 * the same entry shape and the audio track id (`audioFiles[]` of the manifest). A package without
 * audio files serialises byte-identically to before.
 */
export const FragmentsJsonSchema = z.strictObject({
  schema: z.literal(FRAGMENTS_JSON_SCHEMA_ID),
  files: z.array(z.union([ManifestFileSchema, ManifestAudioFileSchema])),
});
export type FragmentsJson = z.output<typeof FragmentsJsonSchema>;

/** What the writer's fragment table is handed over as: one record list per camera file. */
export type FragmentTableInput = readonly ManifestFile[];

function members(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.')))];
}

/** Validates a fragment table and returns the manifest's `files[]` value (the sealed camera files, one to four in track order since D60 of 2026-11-04). */
export function manifestFilesFromFragmentTable(table: FragmentTableInput): ManifestFile[] {
  const parsed = z.array(ManifestFileSchema).safeParse(table);
  if (!parsed.success) throw new EvidencePackageError(EvidencePackageRefusal.FRAGMENTS_INVALID, members(parsed.error));
  const files = parsed.data;
  // One record per SEALED camera file: one to four in track order, the manifest's own list (F-M7 R88-01; widened by D60 of 2026-11-04 - a two-track package names its two).
  if (!isSealedTrackList(files.map((file) => file.trackId))) {
    throw new EvidencePackageError(EvidencePackageRefusal.FRAGMENTS_INVALID, ['files']);
  }
  return files;
}

/** D5: validates the audio fragment table and returns the manifest's `audioFiles[]` value (one to four, ascending AUDIO order). */
export function manifestAudioFilesFromFragmentTable(table: readonly ManifestAudioFile[]): ManifestAudioFile[] {
  const parsed = z.array(ManifestAudioFileSchema).safeParse(table);
  if (!parsed.success) throw new EvidencePackageError(EvidencePackageRefusal.FRAGMENTS_INVALID, members(parsed.error));
  if (!isSealedAudioTrackList(parsed.data.map((file) => file.trackId))) {
    throw new EvidencePackageError(EvidencePackageRefusal.FRAGMENTS_INVALID, ['audioFiles']);
  }
  return parsed.data;
}

/**
 * The records `fragments.json` holds for a manifest, in order: `files[]`, then `audioFiles[]` (D5).
 * The comparison of verify V-02 (`fragmentsJsonMatchesManifest`) is over this list.
 */
export function fragmentsJsonFilesOf(manifest: { readonly files: readonly ManifestFile[]; readonly audioFiles?: readonly ManifestAudioFile[] | undefined }): (ManifestFile | ManifestAudioFile)[] {
  return [...manifest.files, ...(manifest.audioFiles ?? [])];
}

/** The bytes of `fragments/fragments.json` for the manifest's `files[]` value, and since D5 its `audioFiles[]` value after it. */
export function serializeFragmentsJson(files: readonly ManifestFile[], audioFiles?: readonly ManifestAudioFile[]): Uint8Array {
  const audio = audioFiles === undefined || audioFiles.length === 0 ? [] : manifestAudioFilesFromFragmentTable(audioFiles);
  return canonicalJsonBytes({ schema: FRAGMENTS_JSON_SCHEMA_ID, files: [...manifestFilesFromFragmentTable(files), ...audio] });
}

/** Parses `fragments.json` text strictly. */
export function parseFragmentsJson(text: string): FragmentsJson {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new EvidencePackageError(EvidencePackageRefusal.FRAGMENTS_INVALID, ['']);
  }
  const parsed = FragmentsJsonSchema.safeParse(value);
  if (!parsed.success) throw new EvidencePackageError(EvidencePackageRefusal.FRAGMENTS_INVALID, members(parsed.error));
  return parsed.data;
}

/**
 * SEC35-11: the records of `fragments.json` are byte-identical to the manifest's
 * `files[].fragments[]`. The comparison is over the canonical form of the PARSED file (so a file
 * with an extra member, which the strict parser refuses, never passes) and returns false, never
 * throws, on anything that is not exactly that.
 */
export function fragmentsJsonMatchesManifest(fragmentsJsonText: string, manifestFiles: unknown): boolean {
  try {
    const expected = canonicalJson({ schema: FRAGMENTS_JSON_SCHEMA_ID, files: manifestFiles });
    // The stored bytes themselves must be the canonical serialization, not merely an equal value.
    return fragmentsJsonText === expected && canonicalJson(parseFragmentsJson(fragmentsJsonText)) === expected;
  } catch {
    return false;
  }
}

/** `chain_0 = SHA-256("")` (S1 §3.1). */
export const FRAGMENT_CHAIN_GENESIS = bytesToHex(sha256(utf8ToBytes('')));

/** `chain_n = SHA-256(chain_{n-1} raw32 || frag_sha_n raw32)` (S1 §3.1; spec §B.6). */
export function nextFragmentChainHash(previousChainHash: string, fragmentSha256: string): string {
  return bytesToHex(sha256(concatBytes(hexToBytes(previousChainHash), hexToBytes(fragmentSha256))));
}
