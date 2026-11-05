/**
 * On-disk layout of one sealed v2 package (evidence package spec §A.1, §A.2; register NM-08).
 * Names only: this file opens nothing.
 */
export const MANIFEST_V2_SCHEMA_ID = 'dems.evidence-manifest/2';
/**
 * THE MANIFEST SCHEMA VERSION STEP OF D5 (audit 2026-11-05, decision D30 K-2; spec S5 §5.2): a
 * package that seals the per-pair audio files (`audioTracks` / `audioFiles`, fields 159-174) or
 * states a missing paired microphone (`audioTracksMissing`, fields 175-179) names THIS schema id in
 * field 1; every other v2 package keeps `dems.evidence-manifest/2`, so the packages sealed before
 * D5 keep their id, their bytes and their digest. The step is on field 1 and NOT on field 5
 * (`manifestVersion` stays 2): field 5 is the package generation the Core's item rows, the database
 * (`evidence_items_manifest_version_check IN (1, 2)`) and every client read as "a v2 package".
 */
export const MANIFEST_V2_1_SCHEMA_ID = 'dems.evidence-manifest/2.1';
/** Every schema id a v2 manifest may carry, in step order. A new verifier reads both. */
export const MANIFEST_V2_SCHEMA_IDS = [MANIFEST_V2_SCHEMA_ID, MANIFEST_V2_1_SCHEMA_ID] as const;
export type ManifestV2SchemaId = (typeof MANIFEST_V2_SCHEMA_IDS)[number];
export const MANIFEST_V1_SCHEMA_ID = 'dems.evidence-manifest/1';
export const MANIFEST_V2_VERSION = 2;

export const PACKAGE_FOLDER_PREFIX = 'SESSION-';
export const VIDEO_TRACK_IDS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const; // D60 (2026-11-04): four simultaneous tracks; a manifest's own list (a non-empty prefix) still decides what a package holds, so two-track packages verify unchanged.
export type PackageVideoTrackId = (typeof VIDEO_TRACK_IDS)[number];
/**
 * THE TRACK LIST OF ONE SEALED PACKAGE (spec §B.4, erratum of fix pass F-M7 / decision D178; widened
 * by D60 of 2026-11-04): the camera files that EXIST - one to four, each once, in track order
 * (VIDEO-01 before VIDEO-02 before VIDEO-03 before VIDEO-04). A session that recorded with fewer
 * cameras is sealed with exactly its own files - a package sealed under the two-track shape names
 * its two and verifies unchanged (the list reads as a prefix of the widened order).
 * Never none, never another order.
 */
export function isSealedTrackList(trackIds: readonly string[]): trackIds is readonly PackageVideoTrackId[] {
  if (trackIds.length < 1 || trackIds.length > VIDEO_TRACK_IDS.length) return false;
  let last = -1;
  for (const trackId of trackIds) {
    const at = (VIDEO_TRACK_IDS as readonly string[]).indexOf(trackId);
    if (at <= last) return false;
    last = at;
  }
  return true;
}
export const SESSION_AUDIO_TRACK_ID = 'AUDIO-01';
export const CAMERA_FILE_MEDIA_TYPE = 'video/mp4';

/**
 * D5 (audit 2026-11-05; decisions D27, D28, D30; spec S5 §5.1, register N-16..N-19): the audio file
 * of each camera-microphone pair. Pair N is `VIDEO-0N` <-> `MIC-0N` <-> `AUDIO-0N`, fixed by number
 * (N-04); the four ids equal the domain's `AUDIO_TRACK_IDS` (held equal by a test).
 */
export const AUDIO_FILE_TRACK_IDS = ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const;
export type PackageAudioTrackId = (typeof AUDIO_FILE_TRACK_IDS)[number];
/** The microphone channels of the four pairs, by number (`MIC-0N` of `AUDIO-0N`). */
export const PAIR_MIC_CHANNELS = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;
export type PackageMicChannel = (typeof PAIR_MIC_CHANNELS)[number];
/** N-18: the media type of an audio file of a pair (an AAC track in MP4, `.m4a`). */
export const AUDIO_FILE_MEDIA_TYPE = 'audio/mp4';

/** The microphone channel of an audio track's pair: `AUDIO-0N` -> `MIC-0N` (N-04). */
export function pairedMicChannelOfAudioTrack(trackId: PackageAudioTrackId): PackageMicChannel {
  return PAIR_MIC_CHANNELS[AUDIO_FILE_TRACK_IDS.indexOf(trackId)] as PackageMicChannel;
}

/** The camera track of an audio track's pair: `AUDIO-0N` -> `VIDEO-0N` (N-04). */
export function pairedVideoTrackOfAudioTrack(trackId: PackageAudioTrackId): PackageVideoTrackId {
  return VIDEO_TRACK_IDS[AUDIO_FILE_TRACK_IDS.indexOf(trackId)] as PackageVideoTrackId;
}

/** The audio track list of a D5 package: one to four audio ids, each once, in ascending order (the rule of `isSealedTrackList`). */
export function isSealedAudioTrackList(trackIds: readonly string[]): trackIds is readonly PackageAudioTrackId[] {
  if (trackIds.length < 1 || trackIds.length > AUDIO_FILE_TRACK_IDS.length) return false;
  let last = -1;
  for (const trackId of trackIds) {
    const at = (AUDIO_FILE_TRACK_IDS as readonly string[]).indexOf(trackId);
    if (at <= last) return false;
    last = at;
  }
  return true;
}

/** Relative paths inside the package folder, with `/` on every platform. */
export const PackageFile = {
  MANIFEST: 'session-manifest.json',
  SIGNATURE: 'signature.sig',
  CERTIFICATE: 'device-certificate.pem',
  FRAGMENTS_DIR: 'fragments',
  FRAGMENTS_JSON: 'fragments/fragments.json',
  TRANSCRIPT_DIR: 'transcript',
  TRANSCRIPT_JSON: 'transcript/transcript.json',
  TRANSCRIPT_SRT: 'transcript/transcript.srt',
  TRANSCRIPT_VTT: 'transcript/transcript.vtt',
  TRANSCRIPT_REVISIONS: 'transcript/transcript-revisions.json',
  AUDIT_EXTRACT: 'audit-session-extract.jsonl',
  COMPOSITE_DIR: 'composite',
  COMPOSITE_FILE: 'composite/composite.mp4',
  EXPORT_DIR: 'export',
  EXPORT_MANIFEST: 'export/export-manifest.json',
  EXPORT_MANIFEST_SIGNATURE: 'export/export-manifest.sig',
} as const;

/** `SESSION-<sessionId>` (spec §A.2; the v1 naming, so the demo assets and the store agree). */
export function packageFolderName(sessionId: string): string {
  return `${PACKAGE_FOLDER_PREFIX}${sessionId}`;
}

/** `VIDEO-01.mp4`: the bare name, as `tracks[].file` holds it. */
export function cameraFileName(trackId: PackageVideoTrackId): string {
  return `${trackId}.mp4`;
}

/** `fragments/VIDEO-01.mp4`: where the camera file lies in the package. */
export function cameraFilePath(trackId: PackageVideoTrackId): string {
  return `${PackageFile.FRAGMENTS_DIR}/${cameraFileName(trackId)}`;
}

/** N-16: `AUDIO-01.m4a`, the bare name, as `audioTracks[].file` holds it. */
export function audioFileName(trackId: PackageAudioTrackId): string {
  return `${trackId}.m4a`;
}

/** N-17: `fragments/AUDIO-01.m4a`, where the audio file of a pair lies in the package. */
export function audioFilePath(trackId: PackageAudioTrackId): string {
  return `${PackageFile.FRAGMENTS_DIR}/${audioFileName(trackId)}`;
}

/** `KID-<sessionId>` (spec §B.6 field 77). */
export function sessionKeyId(sessionId: string): string {
  return `KID-${sessionId}`;
}

/** `export/EXP-<id>.zip` (spec §A.2). */
export function exportArchivePath(exportId: string): string {
  return `${PackageFile.EXPORT_DIR}/${exportId}.zip`;
}

/**
 * Every clear file a sealed package declares; the transcript files only when STT was enabled. The
 * camera files are those of `tracks` (the manifest's own track list, F-M7 R88-01); without a list -
 * a caller that has no manifest to read - all four camera files are declared (D60, 2026-11-04).
 * N-19 (D5): the audio files of `audioTracks` (the manifest's `audioTracks[].trackId`) follow the
 * camera files. Without the option NO audio file is declared - not all four - so every caller of
 * before, and every package sealed before D5, gets the same list as before.
 */
export function declaredPackageFiles(options: {
  transcript: boolean;
  tracks?: readonly PackageVideoTrackId[];
  audioTracks?: readonly PackageAudioTrackId[];
}): readonly string[] {
  return Object.freeze([
    PackageFile.MANIFEST,
    PackageFile.SIGNATURE,
    PackageFile.CERTIFICATE,
    ...(options.tracks ?? VIDEO_TRACK_IDS).map(cameraFilePath),
    ...(options.audioTracks ?? []).map(audioFilePath),
    PackageFile.FRAGMENTS_JSON,
    ...(options.transcript
      ? [PackageFile.TRANSCRIPT_JSON, PackageFile.TRANSCRIPT_SRT, PackageFile.TRANSCRIPT_VTT, PackageFile.TRANSCRIPT_REVISIONS]
      : []),
    PackageFile.AUDIT_EXTRACT,
  ]);
}
