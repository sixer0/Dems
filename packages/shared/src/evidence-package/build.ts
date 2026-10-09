/**
 * Building a v2 manifest (spec §B, §B.10, §B.12; sealing steps `BUILD_MANIFEST` and
 * `SIGN_MANIFEST` of §E.1). Pure: values in, values out.
 *
 *   buildUnsignedManifest(input, sourceRows)  -> the manifest without `signature.value`, with the
 *                                                source classes, `developmentSources` and
 *                                                `manifestSha256` filled in by THIS unit
 *   attachSignature(unsigned, signatureBytes) -> the sealed manifest
 *
 * WHY THE INPUT HAS NO SOURCE CLASS. Fields 124-126 are not accepted from the caller: the input
 * type has no such member, and the classes are computed here from the session-start source
 * record (spec §B.12 rule 1 "the Core writes the class; nobody else can"). A caller cannot pass
 * PRODUCTION by hand, and a missing record throws before anything can be signed.
 *
 * `signature.value` is outside the digest, so `manifestSha256` is final before the signer runs
 * and a re-sign after a restart signs the same digest (§E.1 `SIGN_MANIFEST` resume rule).
 */
import { bytesToHex } from '@noble/hashes/utils.js';
import type { z } from 'zod';
import { EvidencePackageError, EvidencePackageRefusal } from './errors';
import { computeManifestSha256 } from './hash';
import {
  ManifestV2Schema,
  UnsignedManifestV2Schema,
  type ManifestAudioInterval,
  type ManifestTrack,
  type ManifestV2,
  type UnsignedManifestV2,
} from './manifest';
import { deriveDevelopmentSources, sessionSourceClasses, type SessionCaptureSourceRow } from './source-class';

export type ManifestTrackInput = Omit<ManifestTrack, 'sourceClass'>;
export type ManifestAudioIntervalInput = Omit<ManifestAudioInterval, 'sourceClass'>;

/** Everything of a manifest that the sealing pipeline supplies. No source class, no flag, no hash. */
export type ManifestV2Input = Omit<UnsignedManifestV2, 'developmentSources' | 'manifestSha256' | 'tracks' | 'audio'> & {
  readonly tracks: readonly ManifestTrackInput[];
  readonly audio: Omit<UnsignedManifestV2['audio'], 'sourceIntervals'> & { readonly sourceIntervals: readonly ManifestAudioIntervalInput[] };
};

function members(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.')))];
}

/** `BUILD_MANIFEST`: deterministic for the same input and the same source rows. */
export function buildUnsignedManifest(input: ManifestV2Input, sourceRows: readonly SessionCaptureSourceRow[]): UnsignedManifestV2 {
  const classes = sessionSourceClasses(sourceRows);
  const tracks = input.tracks.map((track) => ({ ...track, sourceClass: classes.video[track.trackId] }));
  const sourceIntervals = input.audio.sourceIntervals.map((interval, index) => {
    const sourceClass = classes.micByDeviceId.get(interval.micDeviceId);
    // MR-S2: every interval's microphone is one of the session's two MIC rows.
    if (sourceClass === undefined) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_NOT_RECORDED, [`audio.sourceIntervals.${index}.micDeviceId`]);
    return { ...interval, sourceClass };
  });
  if (tracks.some((track) => track.sourceClass === undefined)) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_NOT_RECORDED, ['tracks']);
  const developmentSources = deriveDevelopmentSources([...tracks.map((track) => track.sourceClass), ...sourceIntervals.map((interval) => interval.sourceClass)]);
  const draft = { ...input, developmentSources, tracks, audio: { ...input.audio, sourceIntervals } };
  // The digest is taken over the draft; the placeholder below is replaced, and the canonical body
  // sets the member to null in any case.
  const manifestSha256 = computeManifestSha256({ ...draft, manifestSha256: null });
  const parsed = UnsignedManifestV2Schema.safeParse({ ...draft, manifestSha256 });
  if (!parsed.success) throw new EvidencePackageError(EvidencePackageRefusal.MANIFEST_INVALID, members(parsed.error));
  return parsed.data;
}

/** `SIGN_MANIFEST`: adds the signature bytes (as lowercase hex) and validates the sealed manifest. */
export function attachSignature(unsigned: UnsignedManifestV2, signature: Uint8Array): ManifestV2 {
  const expected = unsigned.signature.algorithm === 'Ed25519' ? signature.length === 64 : signature.length >= 64 && signature.length <= 72;
  if (!expected) throw new EvidencePackageError(EvidencePackageRefusal.SIGNATURE_ENCODING, ['signature.value']);
  const parsed = ManifestV2Schema.safeParse({ ...unsigned, signature: { ...unsigned.signature, value: bytesToHex(signature) } });
  if (!parsed.success) throw new EvidencePackageError(EvidencePackageRefusal.MANIFEST_INVALID, members(parsed.error));
  // The value is outside the digest: the hash of the sealed manifest is the hash that was signed.
  if (computeManifestSha256(parsed.data) !== unsigned.manifestSha256) throw new EvidencePackageError(EvidencePackageRefusal.MANIFEST_INVALID, ['manifestSha256']);
  return parsed.data;
}

/** Strict parse of a sealed manifest value. Throws `MANIFEST_INVALID` with the member paths. */
export function parseManifestV2(value: unknown): ManifestV2 {
  const parsed = ManifestV2Schema.safeParse(value);
  if (!parsed.success) throw new EvidencePackageError(EvidencePackageRefusal.MANIFEST_INVALID, members(parsed.error));
  return parsed.data;
}
