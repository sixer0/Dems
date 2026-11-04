/**
 * On-disk layout of one sealed v2 package (evidence package spec §A.1, §A.2; register NM-08).
 * Names only: this file opens nothing.
 */
export const MANIFEST_V2_SCHEMA_ID = 'dems.evidence-manifest/2';
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
 */
export function declaredPackageFiles(options: { transcript: boolean; tracks?: readonly PackageVideoTrackId[] }): readonly string[] {
  return Object.freeze([
    PackageFile.MANIFEST,
    PackageFile.SIGNATURE,
    PackageFile.CERTIFICATE,
    ...(options.tracks ?? VIDEO_TRACK_IDS).map(cameraFilePath),
    PackageFile.FRAGMENTS_JSON,
    ...(options.transcript
      ? [PackageFile.TRANSCRIPT_JSON, PackageFile.TRANSCRIPT_SRT, PackageFile.TRANSCRIPT_VTT, PackageFile.TRANSCRIPT_REVISIONS]
      : []),
    PackageFile.AUDIT_EXTRACT,
  ]);
}
