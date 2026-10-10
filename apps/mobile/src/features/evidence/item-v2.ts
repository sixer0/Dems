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
 */

export const CAMERA_FILE_IDS = ['VIDEO-01', 'VIDEO-02'] as const;
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

export type AudioIntervalReason = 'START' | 'MANUAL' | 'STOP';

export interface ItemAudioInterval {
  readonly seq: number;
  /** The microphone input that fed the audio track (`MIC-01`, `MIC-02`, any `MIC-NN`). */
  readonly inputId: string;
  readonly fromMs: number;
  /** null: the interval runs to the end of the recording. */
  readonly toMs: number | null;
  readonly reason: AudioIntervalReason | null;
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
}

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
  return { seq, inputId, fromMs, toMs, reason: typeof value.reason === 'string' && REASONS.includes(value.reason) ? (value.reason as AudioIntervalReason) : null };
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
