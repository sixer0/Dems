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
import { VIDEO_TRACK_IDS } from './layout';
import { ManifestFileSchema, type ManifestFile } from './manifest';

export const FRAGMENTS_JSON_SCHEMA_ID = 'dems.fragments/1';

export const FragmentsJsonSchema = z.strictObject({
  schema: z.literal(FRAGMENTS_JSON_SCHEMA_ID),
  files: z.array(ManifestFileSchema),
});
export type FragmentsJson = z.output<typeof FragmentsJsonSchema>;

/** What the writer's fragment table is handed over as: one record list per camera file. */
export type FragmentTableInput = readonly ManifestFile[];

function members(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.')))];
}

/** Validates a fragment table and returns the manifest's `files[]` value (VIDEO-01 then VIDEO-02). */
export function manifestFilesFromFragmentTable(table: FragmentTableInput): ManifestFile[] {
  const parsed = z.array(ManifestFileSchema).safeParse(table);
  if (!parsed.success) throw new EvidencePackageError(EvidencePackageRefusal.FRAGMENTS_INVALID, members(parsed.error));
  const files = parsed.data;
  if (files.length !== VIDEO_TRACK_IDS.length || files.some((file, index) => file.trackId !== VIDEO_TRACK_IDS[index])) {
    throw new EvidencePackageError(EvidencePackageRefusal.FRAGMENTS_INVALID, ['files']);
  }
  return files;
}

/** The bytes of `fragments/fragments.json` for the manifest's `files[]` value. */
export function serializeFragmentsJson(files: readonly ManifestFile[]): Uint8Array {
  return canonicalJsonBytes({ schema: FRAGMENTS_JSON_SCHEMA_ID, files: manifestFilesFromFragmentTable(files) });
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
