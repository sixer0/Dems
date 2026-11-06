/**
 * The schema-v2 members of an evidence item, read defensively (blueprint row 92, M8-W3; API
 * contract C3 §3 ops 39 / 40; evidence package spec §B; UX spec flows 5, 6 and 12).
 *
 * ONE reader for this app (the other client keeps its own copy of the same rules: one helper per
 * app). It takes the item as `unknown`, because the replicated item is typed by the simulator's
 * `EvidenceItem`, which does not declare every member the Core sends (`audioSourceIntervals`,
 * `transcript`, `developmentSources`): the code compiles before and after a member is added to
 * that type, and an item without the member reads as "not stated".
 *
 * | Member | Rule |
 * |--------|------|
 * | `files[]` | One whole file per camera with BOTH hashes and its chain head; an entry that cannot be read is dropped (a hash is never invented) |
 * | `audioSourceIntervals[]` | Media-pts spans of the microphone that fed the session audio track; kept only when every entry reads |
 * | `transcript` | The summary inside the item; the body travels through operation 84 |
 * | `developmentSources` | `true` / `false` exactly as sent; anything else, also absent, is `null` = NOT RECORDED, which is never read as production (R-11) |
 * | `files[]` AUDIO-0N (row 207, M3-16 R1; web row 159) | The audio file of camera-microphone pair N (`/2.1` package), listed after the camera files; read into `pairAudioFiles` with the camera of its pair and whether that camera file is in the item (E10: by number, "in VIDEO-0N" only when that camera file is in `files`, R159-3) |
 * | `audioTracksMissing[]` (row 207, M3-16 R2; E7) | The signed statement that the microphone of a pair did not record (`NOT_ASSIGNED` / `NOT_OPENED`); kept only when every entry reads - a statement with a hole could hide the silent pair |
 */
import { TRANSCRIPT_MODEL_MEMBER, readTranscriptModel, type ItemTranscriptModel } from '@dems/shared/evidence-rules';
import { AUDIO_TRACK_IDS, VIDEO_TRACK_IDS, type AudioTrackId, type VideoTrackId } from '@dems/shared/domain';

// D60 (2026-11-04): a sealed package carries one to four camera files (shared fragments.ts, F-M7 R88-01 widened).
export const CAMERA_FILE_IDS = VIDEO_TRACK_IDS;
export type CameraFileId = (typeof CAMERA_FILE_IDS)[number];

export interface ItemFileV2 {
  readonly trackId: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  /** SHA-256 of the stored (encrypted) bytes of the whole file. */
  readonly sha256: string;
  /** SHA-256 of the plaintext bytes; null when the item does not state it. */
  readonly sha256Plain: string | null;
  readonly fragmentCount: number;
  readonly fragmentChainHead: string | null;
}

/**
 * Row 207 (M3-16 R1; E10; web row 159): the sealed audio file of one camera-microphone pair. Pair N is
 * `VIDEO-0N` <-> `MIC-0N` <-> `AUDIO-0N`, fixed by number (D27, `CAPTURE_PAIRS`). The camera file of the
 * pair holds this audio exactly when that camera file is in the item (the manifest's `containsIn` rule);
 * `inCamera` is null when it is not - the audio file is still sealed and hashed.
 */
export interface ItemPairAudioFile {
  readonly file: ItemFileV2;
  readonly trackId: AudioTrackId;
  readonly pair: number;
  readonly camera: VideoTrackId;
  /** The camera file that holds this audio (`VIDEO-0N`); null: that camera file is not in the item. */
  readonly inCamera: VideoTrackId | null;
}

export type ItemAudioMissingReason = 'NOT_ASSIGNED' | 'NOT_OPENED';

/** Row 207 (M3-16 R2; E7; D30 K-3): one pair whose microphone did not record, as the signed manifest states it. */
export interface ItemAudioTrackMissing {
  readonly trackId: AudioTrackId;
  readonly pair: number;
  readonly camera: VideoTrackId;
  /** The microphone that could not be opened; null for NOT_ASSIGNED. */
  readonly micDeviceId: string | null;
  /** The camera file that holds the SILENT audio track; null: that camera file is not in the item. */
  readonly silentIn: VideoTrackId | null;
  readonly reason: ItemAudioMissingReason;
}

export type AudioIntervalReason = 'START' | 'MANUAL' | 'STOP';

export interface ItemAudioInterval {
  readonly seq: number;
  /** The microphone input that fed the audio track (`MIC-01`, `MIC-02`, any `MIC-NN`). */
  readonly inputId: string;
  readonly fromMs: number;
  /** null: the interval runs to the end of the recording. */
  readonly toMs: number | null;
  readonly reason: AudioIntervalReason | null;
  /**
   * The source class of the microphone of this interval as the SEALED MANIFEST records it (the
   * item's own member `audioSourceIntervals[].sourceClass`, wave H C1); null / absent: not stated.
   * Fix wave K (G94b-07): the band legend marks a development microphone from this, without a verify run.
   */
  readonly sourceClass?: 'PRODUCTION' | 'LOCAL_DEVICE' | 'FAKE' | null;
}

export type ItemTranscriptState = 'PENDING' | 'PARTIAL' | 'READY' | 'FAILED' | 'DISABLED';
export type ItemLabelsStatus = 'LABELLED' | 'UNAVAILABLE';

export interface ItemTranscriptSummary {
  readonly state: ItemTranscriptState;
  readonly sha256: string | null;
  /** Hash of the SEALED machine transcript; no revision changes it. */
  readonly machineTranscriptHash: string | null;
  readonly labelsStatus: ItemLabelsStatus | null;
  readonly revision: number;
  readonly failedChunks: number;
  readonly backendUnreachable: boolean;
}

export interface ItemSignatureV2 {
  readonly algorithm: string;
  readonly keyId: string;
  /** True for the simulated stand-in; false for a real Ed25519 signature of the Core key. */
  readonly simulated: boolean;
}

export interface ItemV2 {
  /** The item carries sealed FILES (a legacy v1 item carries none). */
  readonly isV2: boolean;
  readonly files: readonly ItemFileV2[];
  readonly audioIntervals: readonly ItemAudioInterval[];
  readonly transcript: ItemTranscriptSummary | null;
  /** The sealed transcript hash of the item; null when the seal carries none. */
  readonly transcriptSha256: string | null;
  readonly labelsStatus: ItemLabelsStatus | null;
  readonly manifestVersion: 1 | 2 | null;
  /** `true` / `false` as the Core recorded it; `null`: not recorded. null is never production. */
  readonly developmentSources: boolean | null;
  readonly signature: ItemSignatureV2 | null;
  /** `transcriptModel` of the item as the Core states it (fix wave K, G81b-06); null / absent: not stated - nothing is drawn. */
  readonly transcriptModel?: ItemTranscriptModel | null;
  /** Row 207 (M3-16 R1): the AUDIO-0N files of `files`, in pair order; empty for every legacy item. */
  readonly pairAudioFiles: readonly ItemPairAudioFile[];
  /** Row 207 (M3-16 R2): the missing-microphone statement; empty when the item states none (every legacy item). */
  readonly audioTracksMissing: readonly ItemAudioTrackMissing[];
}

/**
 * Which model made the transcript of an item (contract_wave_k.md, S2 section 1): the member
 * `transcriptModel` of the item, the same name and shape as in operation 41's result.
 *   local backend   `reportedByServer: false`; name, the version the installation DECLARED, quantisation, file hash;
 *   server backend  `reportedByServer: true`; the name the server reported, and the Core's own sentence
 *                   `report` (ruling D160: reported by the STT server and not verified by the Core).
 */
export type { ItemTranscriptModel };

/** The ONE name of the member (the shared module's). */
export { TRANSCRIPT_MODEL_MEMBER };

const SHA256 = /^[0-9a-f]{64}$/;
const MIC_INPUT = /^MIC-\d{2}$/;
const REASONS: readonly string[] = ['START', 'MANUAL', 'STOP'];
const TRANSCRIPT_STATES: readonly string[] = ['PENDING', 'PARTIAL', 'READY', 'FAILED', 'DISABLED'];
const MAX_FILES = 8;
const MAX_INTERVALS = 4096;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 256): string | null => (typeof value === 'string' && value.length > 0 && value.length <= max ? value : null);
const whole = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
const hash = (value: unknown): string | null => (typeof value === 'string' && SHA256.test(value) ? value : null);
const labels = (value: unknown): ItemLabelsStatus | null => (value === 'LABELLED' || value === 'UNAVAILABLE' ? value : null);

function readFile(value: unknown): ItemFileV2 | null {
  if (!isRecord(value)) return null;
  const trackId = text(value.trackId, 64);
  const sha256 = hash(value.sha256);
  if (trackId === null || sha256 === null) return null;
  return {
    trackId,
    fileName: text(value.fileName) ?? trackId,
    sizeBytes: whole(value.sizeBytes) ?? 0,
    sha256,
    sha256Plain: hash(value.sha256Plain),
    fragmentCount: whole(value.fragmentCount) ?? 0,
    fragmentChainHead: hash(value.fragmentChainHead),
  };
}

function readInterval(value: unknown): ItemAudioInterval | null {
  if (!isRecord(value)) return null;
  const seq = whole(value.seq);
  const inputId = text(value.inputId, 16);
  const fromMs = whole(value.fromMs);
  const toMs = value.toMs === null || value.toMs === undefined ? null : whole(value.toMs);
  if (seq === null || inputId === null || !MIC_INPUT.test(inputId) || fromMs === null) return null;
  if (value.toMs !== null && value.toMs !== undefined && (toMs === null || toMs < fromMs)) return null;
  const sourceClass = value.sourceClass === 'PRODUCTION' || value.sourceClass === 'LOCAL_DEVICE' || value.sourceClass === 'FAKE' ? value.sourceClass : null;
  return { seq, inputId, fromMs, toMs, reason: typeof value.reason === 'string' && REASONS.includes(value.reason) ? (value.reason as AudioIntervalReason) : null, sourceClass };
}

/** The intervals, or none at all: a list with a hole would draw a band that shows the wrong microphone. */
function readIntervals(value: unknown): readonly ItemAudioInterval[] {
  if (!Array.isArray(value) || value.length > MAX_INTERVALS) return [];
  const intervals: ItemAudioInterval[] = [];
  for (const entry of value) {
    const interval = readInterval(entry);
    if (interval === null) return [];
    intervals.push(interval);
  }
  return intervals;
}

function readTranscript(value: unknown): ItemTranscriptSummary | null {
  if (!isRecord(value) || typeof value.state !== 'string' || !TRANSCRIPT_STATES.includes(value.state)) return null;
  return {
    state: value.state as ItemTranscriptState,
    sha256: hash(value.sha256),
    machineTranscriptHash: hash(value.machineTranscriptHash),
    labelsStatus: labels(value.labelsStatus),
    revision: whole(value.revision) ?? 0,
    failedChunks: whole(value.failedChunks) ?? 0,
    backendUnreachable: value.backendUnreachable === true,
  };
}

function readSignature(value: unknown): ItemSignatureV2 | null {
  if (!isRecord(value)) return null;
  const algorithm = text(value.algorithm, 32);
  const keyId = text(value.keyId, 64);
  if (algorithm === null || keyId === null || typeof value.simulated !== 'boolean') return null;
  return { algorithm, keyId, simulated: value.simulated };
}

/** Reads the v2 members of an evidence item. Never throws; a member it cannot read is "not stated". */
/**
 * Reads `transcriptModel`. Never throws; a member that is not the contract's shape is NOT STATED
 * (null) - never a default name, never "verified". THE SHARED READER (batch N; R101-03, ruling
 * D241): one set of bounds - the contract's - for these apps and the web console.
 */
export { readTranscriptModel };

const isAudioTrack = (value: unknown): value is AudioTrackId => (AUDIO_TRACK_IDS as readonly unknown[]).includes(value);
const isVideoTrack = (value: unknown): value is VideoTrackId => (VIDEO_TRACK_IDS as readonly unknown[]).includes(value);

/** Pair N of an audio track (E10): its number and its camera, by number (`CAPTURE_PAIRS`, D27). */
export function pairOfAudioTrack(trackId: AudioTrackId): { readonly pair: number; readonly camera: VideoTrackId } {
  const index = AUDIO_TRACK_IDS.indexOf(trackId);
  return { pair: index + 1, camera: VIDEO_TRACK_IDS[index] as VideoTrackId };
}

function readPairAudioFiles(files: readonly ItemFileV2[]): readonly ItemPairAudioFile[] {
  const named = new Set(files.map((file) => file.trackId));
  return AUDIO_TRACK_IDS.flatMap((trackId) => {
    const file = files.find((entry) => entry.trackId === trackId);
    if (file === undefined) return [];
    const { pair, camera } = pairOfAudioTrack(trackId);
    return [{ file, trackId, pair, camera, inCamera: named.has(camera) ? camera : null }];
  });
}

const MISSING_REASONS: readonly string[] = ['NOT_ASSIGNED', 'NOT_OPENED'];

/** The statement, or none at all: an entry that cannot be read could be the one pair that was silent. */
function readAudioTracksMissing(value: unknown): readonly ItemAudioTrackMissing[] {
  if (!Array.isArray(value) || value.length > AUDIO_TRACK_IDS.length) return [];
  const stated: ItemAudioTrackMissing[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !isAudioTrack(entry.trackId) || typeof entry.reason !== 'string' || !MISSING_REASONS.includes(entry.reason)) return [];
    const trackId = entry.trackId;
    const { pair, camera } = pairOfAudioTrack(trackId);
    const micDeviceId = entry.micDeviceId === null ? null : text(entry.micDeviceId, 16);
    if (entry.micDeviceId !== null && (micDeviceId === null || !MIC_INPUT.test(micDeviceId))) return [];
    // The contract: a microphone is named exactly when it was assigned and did not open.
    if ((micDeviceId === null) !== (entry.reason === 'NOT_ASSIGNED')) return [];
    const silentIn: unknown = entry.silentIn;
    // The silent track is in the camera of ITS pair, or in no camera file: anything else is not this statement.
    if (!Array.isArray(silentIn) || silentIn.length > 1 || !silentIn.every(isVideoTrack) || (silentIn.length === 1 && silentIn[0] !== camera)) return [];
    if (stated.some((held) => held.trackId === trackId)) return [];
    stated.push({ trackId, pair, camera, micDeviceId, silentIn: silentIn.length === 1 ? camera : null, reason: entry.reason as ItemAudioMissingReason });
  }
  return stated.sort((a, b) => a.pair - b.pair);
}

export function readItemV2(item: unknown): ItemV2 {
  const source = isRecord(item) ? item : {};
  const files = Array.isArray(source.files)
    ? source.files
        .slice(0, MAX_FILES)
        .map(readFile)
        .filter((file): file is ItemFileV2 => file !== null)
    : [];
  const transcript = readTranscript(source.transcript);
  return {
    isV2: files.length > 0,
    files,
    audioIntervals: readIntervals(source.audioSourceIntervals),
    transcript,
    transcriptSha256: hash(source.transcriptSha256) ?? transcript?.machineTranscriptHash ?? null,
    labelsStatus: labels(source.labelsStatus) ?? transcript?.labelsStatus ?? null,
    manifestVersion: source.manifestVersion === 1 || source.manifestVersion === 2 ? source.manifestVersion : null,
    developmentSources: typeof source.developmentSources === 'boolean' ? source.developmentSources : null,
    signature: readSignature(source.signature),
    transcriptModel: readTranscriptModel(source[TRANSCRIPT_MODEL_MEMBER]),
    pairAudioFiles: readPairAudioFiles(files),
    audioTracksMissing: readAudioTracksMissing(source.audioTracksMissing),
  };
}

/** The sealed camera file of a track, or null. */
export function cameraFileOf(item: ItemV2, trackId: CameraFileId): ItemFileV2 | null {
  return item.files.find((file) => file.trackId === trackId) ?? null;
}

/**
 * Whether the item badge "Development source" is drawn (UX §8f.2; decisions D83, D91 ruling R-2):
 * only from `developmentSources === true` as the Core recorded it, and only on Live data. Simulated
 * client mode draws none: its mode banner already says what the data is. `false` and `null` draw
 * nothing; `null` is still never worded as production anywhere.
 */
export function itemDevelopmentBadge(item: Pick<ItemV2, 'developmentSources'>, live: boolean): boolean {
  return live && item.developmentSources === true;
}
