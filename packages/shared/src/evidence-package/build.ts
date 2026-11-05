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
  type ManifestAudioTrack,
  type ManifestTrack,
  type ManifestV2,
  type UnsignedManifestV2,
} from './manifest';
import { MANIFEST_V2_1_SCHEMA_ID } from './layout';
import { deriveDevelopmentSources, sessionSourceClasses, type ManifestSourceClass, type SessionCaptureSourceRow } from './source-class';

export type ManifestTrackInput = Omit<ManifestTrack, 'sourceClass'>;
export type ManifestAudioIntervalInput = Omit<ManifestAudioInterval, 'sourceClass'>;
/** D5 (fields 159-171): an audio file record of a pair without its class; field 172 is computed here, as fields 124 and 125. */
export type ManifestAudioTrackInput = Omit<ManifestAudioTrack, 'sourceClass'>;

/** Everything of a manifest that the sealing pipeline supplies. No source class, no flag, no hash. */
export type ManifestV2Input = Omit<UnsignedManifestV2, 'developmentSources' | 'manifestSha256' | 'tracks' | 'audio' | 'audioTracks'> & {
  readonly tracks: readonly ManifestTrackInput[];
  readonly audioTracks?: readonly ManifestAudioTrackInput[] | undefined;
  readonly audio: Omit<UnsignedManifestV2['audio'], 'sourceIntervals'> & { readonly sourceIntervals: readonly ManifestAudioIntervalInput[] };
};

function members(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join('.')))];
}

/** `BUILD_MANIFEST`: deterministic for the same input and the same source rows. */
export function buildUnsignedManifest(input: ManifestV2Input, sourceRows: readonly SessionCaptureSourceRow[]): UnsignedManifestV2 {
  // D5 (row 153): a `/2.1` build holds the start rows to the plan of one microphone per camera (no mic slot required).
  const classes = sessionSourceClasses(sourceRows, { pairedAudio: input.schema === MANIFEST_V2_1_SCHEMA_ID });
  // Fields 134-138 (row R1b): the third optional member, by the rule of the two below - a track handed
  // without an absence, or with `undefined`, has NO such key (`undefined` has no canonical form).
  const tracks = input.tracks.map(({ absentInSession, ...track }) => ({ ...track, sourceClass: classes.video[track.trackId], ...(absentInSession === undefined ? {} : { absentInSession }) }));
  const sourceIntervals = input.audio.sourceIntervals.map((interval, index) => {
    const sourceClass = classes.micByDeviceId.get(interval.micDeviceId);
    // MR-S2: every interval's microphone is one of the session's two MIC rows.
    if (sourceClass === undefined) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_NOT_RECORDED, [`audio.sourceIntervals.${index}.micDeviceId`]);
    return { ...interval, sourceClass };
  });
  // D60 (2026-11-04): the class map covers the tracks the session's own start record carries - a
  // manifest naming a track the plan did not record is refused HERE, as SOURCE_NOT_RECORDED.
  const unclassed = tracks.find((track) => track.sourceClass === undefined);
  if (unclassed !== undefined) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_NOT_RECORDED, ['tracks']);
  // D5 (fields 159-172, optional): the class of each pair microphone is that of its start row, as
  // for an interval (MR-S2); a microphone the session did not record is refused. Left out or
  // `undefined` gives NO key, so a package without the member is the manifest of before.
  const { audioTracks: audioTracksInput, audioFiles, audioTracksMissing, ...rest } = input;
  const audioTracks = audioTracksInput?.map((record, index) => {
    const sourceClass = classes.micByDeviceId.get(record.micDeviceId);
    if (sourceClass === undefined) throw new EvidencePackageError(EvidencePackageRefusal.SOURCE_NOT_RECORDED, [`audioTracks.${index}.micDeviceId`]);
    return { ...record, sourceClass };
  });
  const developmentSources = deriveDevelopmentSources([
    ...tracks.map((track) => track.sourceClass as ManifestSourceClass),
    ...sourceIntervals.map((interval) => interval.sourceClass),
    ...(audioTracks ?? []).map((record) => record.sourceClass),
  ]);
  // Fields 129-132 (row V4): the one optional member. A caller with no restart gap leaves the key
  // out or hands `undefined`; either way the manifest has NO such key (never `undefined`, which has
  // no canonical form, and never an empty list, which the schema refuses).
  // Fields 139-158 (row N2): the fourth optional member, by the same rule - left out or `undefined`
  // gives NO key; and inside a record `insertedRuns` left out or `undefined` gives NO key there.
  const { absentOnRestart, samplesNotReceived, ...audio } = input.audio;
  // Anything that is no list of records is handed on AS IT IS, for the schema to refuse: only `undefined` is "no member".
  const handed: unknown = samplesNotReceived;
  const shortfall: unknown = Array.isArray(handed)
    ? handed.map((record: unknown) => {
        if (record === null || typeof record !== 'object' || Array.isArray(record)) return record;
        const { insertedRuns, ...rest } = record as Record<string, unknown>;
        return { ...rest, ...(insertedRuns === undefined ? {} : { insertedRuns }) };
      })
    : handed;
  // Field 133 (row P1): the second optional member, by the same rule - left out or `undefined` gives NO key.
  const { hostProfileNotAsked, ...body } = rest;
  const draft = {
    ...body,
    developmentSources,
    tracks,
    audio: { ...audio, sourceIntervals, ...(absentOnRestart === undefined ? {} : { absentOnRestart }), ...(shortfall === undefined ? {} : { samplesNotReceived: shortfall }) },
    ...(hostProfileNotAsked === undefined ? {} : { hostProfileNotAsked }),
    ...(audioTracks === undefined ? {} : { audioTracks }),
    ...(audioFiles === undefined ? {} : { audioFiles }),
    ...(audioTracksMissing === undefined ? {} : { audioTracksMissing }),
  };
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
