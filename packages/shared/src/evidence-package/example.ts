/**
 * A complete, schema-valid example of the manifest INPUT (every one of the sealed fields has a
 * value), for tests and documentation. It describes no recording: every hash is a filler pattern,
 * every source is FAKE, and nothing here is evidence.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { ManifestTrackInput, ManifestV2Input } from './build';
import { FRAGMENT_CHAIN_GENESIS, nextFragmentChainHash } from './fragments';
import { CAMERA_FILE_MEDIA_TYPE, MANIFEST_V2_SCHEMA_ID, MANIFEST_V2_VERSION, PackageFile, SESSION_AUDIO_TRACK_ID, cameraFileName, sessionKeyId, type PackageVideoTrackId } from './layout';
import { TRANSCRIPT_DOC_VERSION, type ManifestFile, type ManifestFragment } from './manifest';
import { MANIFEST_SIGNATURE_COVERS } from './signature-file';
import type { SessionCaptureSourceRow } from './source-class';

const filler = (label: string): string => bytesToHex(sha256(utf8ToBytes(`dems.example.${label}`)));
const SESSION_ID = 'SES-20261009-0001';

/**
 * The session-start source rows of the example: fake sources in every slot of a TWO-track
 * (pre-D60) plan. D61 (2026-11-04): the two microphone roles became numbered channels — the data
 * migration renames these rows' slots (`MIC-PRIMARY`→`MIC-01`, `MIC-STANDBY`→`MIC-02`); the
 * example stays a pre-D60 four-row plan and verifies as one (prefix rule).
 */
export const EXAMPLE_SOURCE_ROWS: readonly SessionCaptureSourceRow[] = Object.freeze([
  { slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'FAKE' },
  { slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' },
  { slot: 'MIC-01', deviceId: 'MIC-01', adapterKind: 'FAKE' }, // D61: was MIC-PRIMARY
  { slot: 'MIC-02', deviceId: 'MIC-02', adapterKind: 'FAKE' }, // D61: was MIC-STANDBY
]);

function exampleFile(trackId: PackageVideoTrackId): ManifestFile {
  let chain = FRAGMENT_CHAIN_GENESIS;
  let byteOffset = 1259;
  const fragments: ManifestFragment[] = [1, 2].map((seq) => {
    const fragmentSha = filler(`${trackId}.fragment.${seq}`);
    chain = nextFragmentChainHash(chain, fragmentSha);
    const fragment: ManifestFragment = {
      seq,
      byteOffset,
      byteLength: 41_482,
      mediaStartMs: (seq - 1) * 2_000,
      mediaDurationMs: 2_000,
      sha256: fragmentSha,
      sha256Plain: filler(`${trackId}.fragment.${seq}.plain`),
      chainHash: chain,
      prefixSha256: filler(`${trackId}.prefix.${seq}`),
      keyframe: true,
      interrupted: false,
      truncated: false,
      gcmIv: filler(`${trackId}.iv.${seq}`).slice(0, 24),
      gcmTag: filler(`${trackId}.tag.${seq}`).slice(0, 32),
      keyId: sessionKeyId(SESSION_ID),
      durableAt: 1_791_500_002_000 + seq * 2_000,
    };
    byteOffset += fragment.byteLength;
    return fragment;
  });
  return { trackId, fragments };
}

/** A fresh, mutable copy on every call. */
export function exampleManifestInput(): ManifestV2Input {
  const files = [exampleFile('VIDEO-01'), exampleFile('VIDEO-02')];
  const track = (trackId: PackageVideoTrackId, deviceId: string, file: ManifestFile): ManifestTrackInput => ({
    trackId,
    deviceId,
    profile: 'main-1080p25',
    name: `Example camera ${deviceId}`,
    model: 'EXAMPLE-CAM',
    firmware: '0.0.0-example',
    clockOffsetMs: -3,
    file: cameraFileName(trackId),
    mediaType: CAMERA_FILE_MEDIA_TYPE,
    codec: 'H.264 + AAC-LC',
    bytes: 1259 + 2 * 41_482,
    durationMs: 4_000,
    sha256: filler(`${trackId}.stored`),
    sha256Plain: filler(`${trackId}.plain`),
    fragmentChainHead: file.fragments[file.fragments.length - 1]?.chainHash ?? null,
    fragmentCount: file.fragments.length,
    keyframeAligned: true,
    avOffsetMs: 0.5,
    firstVideoSamplePts: 3_600,
    firstVideoSampleTimescale: 90_000,
  });
  return {
    schema: MANIFEST_V2_SCHEMA_ID,
    evidenceId: 'EV-20261009-0001',
    sessionId: SESSION_ID,
    caseNumber: 'LP/2026/1009-0001',
    manifestVersion: MANIFEST_V2_VERSION,
    integrity: 'REAL',
    demo: false,
    notice: 'EXAMPLE - fake sources; not evidence.',
    timeline: {
      timezone: '+07:00',
      createdAt: 1_791_500_000_000,
      startedAt: 1_791_500_001_000,
      stoppedAt: 1_791_500_005_000,
      sealedAt: 1_791_500_009_000,
      recordingDurationMs: 4_000,
      interrupted: false,
      durableEndMs: 1_791_500_005_000,
      timeSource: { source: 'NTP', state: 'LOCKED', fallbackOrder: ['GNSS', 'NTP', 'RTC'] },
    },
    device: {
      deviceId: 'CORE-EXAMPLE-01',
      name: 'Example Core',
      serialNumber: 'EXAMPLE-SN-0001',
      hardwareUuid: '00000000-0000-4000-8000-000000000001',
      softwareVersion: '0.2.0',
      certificate: { subject: 'CN=Example Core', serialNumber: '01', sha256: filler('certificate') },
    },
    operator: { investigatorId: 'OP-0001', displayName: 'Example Investigator', role: 'INVESTIGATOR' },
    subject: { name: 'Example Subject', type: 'SAKSI', authorization: 'EXAMPLE-AUTH-0001' },
    tracks: [track('VIDEO-01', 'CAM-01', files[0] as ManifestFile), track('VIDEO-02', 'CAM-02', files[1] as ManifestFile)],
    audio: {
      trackId: SESSION_AUDIO_TRACK_ID,
      codec: 'AAC-LC mono 48 kHz',
      containsIn: ['VIDEO-01', 'VIDEO-02'],
      sourceIntervals: [
        { seq: 1, micDeviceId: 'MIC-01', role: 'PRIMARY', fromMs: 21, toMs: 2_021, reason: 'START', switchedBy: null },
        { seq: 2, micDeviceId: 'MIC-02', role: 'STANDBY', fromMs: 2_021, toMs: 4_000, reason: 'MANUAL', switchedBy: 'OP-0001' },
      ],
    },
    files,
    transcript: {
      file: PackageFile.TRANSCRIPT_JSON,
      docVersion: TRANSCRIPT_DOC_VERSION,
      sha256: filler('transcript.json'),
      srtSha256: filler('transcript.srt'),
      vttSha256: filler('transcript.vtt'),
      model: { name: 'example-model', version: '0', quantisation: 'none', modelSha256: filler('model') },
      diarization: { numSpeakers: 2, status: 'LABELLED', confidence: 0.75 },
      speakerState: 'LABELLED',
      state: 'ASSEMBLED',
      failedChunks: 0,
      revisionHead: 0,
      disabledReason: null,
      backendUnreachable: false,
      configSnapshot: { enabled: true, backend: 'cpu-local', model: 'example-model', diarization: true, revision: 1 },
    },
    sealing: {
      steps: [
        { step: 'CLOSE_TRACKS', status: 'DONE', progress: 100, etaMs: 0, attempt: 1, checkpoint: { tracks: 2 }, completedAt: 1_791_500_006_000 },
        { step: 'FINALIZE_HASHES', status: 'DONE', progress: 100, etaMs: 0, attempt: 1, checkpoint: { files: 2 }, completedAt: 1_791_500_007_000 },
        { step: 'FINALIZE_TRANSCRIPT', status: 'DONE', progress: 100, etaMs: 0, attempt: 1, checkpoint: { chunks: 1 }, completedAt: 1_791_500_008_000 },
      ],
    },
    signature: {
      algorithm: 'Ed25519',
      keyId: 'CORE-KEY-EVSIGN-01',
      simulated: false,
      file: PackageFile.SIGNATURE,
      covers: MANIFEST_SIGNATURE_COVERS,
      certificate: { file: PackageFile.CERTIFICATE, sha256: filler('certificate') },
      signedAt: 1_791_500_008_500,
    },
  };
}
