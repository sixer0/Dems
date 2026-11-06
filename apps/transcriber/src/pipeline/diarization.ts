/**
 * SPEAKER LABELLING, 2 SPEAKERS, WITHOUT A SEGMENTATION MODEL (transcript spec §A.4; blueprint
 * row 78 / M6-W3; R-5, D226 labels part: "speaker labels when possible"; controller ruling D90).
 *
 * A POST-PASS: it runs after the last chunk is committed, reads the committed segments and the
 * audio, and never blocks, changes or removes the STT text. Its whole answer is one of two states:
 *
 *   LABELLED     every transcript segment long enough to be judged carries `A` or `B`;
 *   UNAVAILABLE  NO segment carries a label, the document carries the exact flag
 *                `speaker labels unavailable`, and a REASON CODE says why.
 *
 * HOW. The committed transcript segments ARE the units (§A.4 "Input": the committed segment set +
 * PCM; "Output": a per-segment label). For every segment of at least `DIARIZATION_MIN_EMBED_MS`
 * the engine computes ONE speaker embedding (the 3D-Speaker CAM++ model, run by the sherpa-onnx C
 * API on the CPU provider — `native/speaker-embed.c`). The embeddings are split into two clusters
 * by a deterministic spherical 2-means (`clusterInTwo`); no segmentation model exists anywhere.
 *
 * UNAVAILABLE IS A VALID PRODUCT STATE; A GUESSED LABEL IS NOT. LABELLED needs ALL of:
 *   - at least `DIARIZATION_MIN_SEGMENTS` segments with an embedding;
 *   - two clusters of at least two segments each (no speaker that is one single segment);
 *   - the two cluster centres at least `DIARIZATION_CLUSTER_THRESHOLD` apart in cosine distance
 *     (closer: one voice, or voices this model cannot tell apart);
 *   - inside each cluster a mean cosine distance BELOW that threshold (a "speaker" whose own
 *     segments lie as far apart as two speakers do is a third voice folded in, or a voice that is
 *     not the same from turn to turn);
 *   - a mean assignment confidence (the silhouette of the segments, in cosine distance) at or
 *     above `DIARIZATION_CLUSTER_THRESHOLD` (lower: the segments do not fall into two voices —
 *     three speakers, or a voice that is not the same from turn to turn).
 * Everything else — switched off, no engine, an absent or uncleared model, an engine that fails or
 * cannot be lowered in priority or prints something unreadable — is UNAVAILABLE with its reason.
 * Nothing here throws at the caller: a failure is logged and becomes the state (§A.4 "Failure
 * behaviour": never aborts the transcript, never fabricates a speaker).
 *
 * LIMITS, STATED. (1) One embedding per transcript segment: a segment in which two people speak
 * (overlap, or an STT segment that spans a turn change) gets the label of the voice that dominates
 * its embedding; there is no overlap detection. (2) A segment shorter than the minimum carries no
 * label even in a LABELLED document (`speaker: null`): it is not given its neighbour's. (3) The
 * split is always into two: a third speaker is not counted, it lowers the confidence, and below
 * the threshold the document is UNAVAILABLE. (4) Both thresholds are the spec's PROPOSAL value;
 * calibration on real interview audio is class C.
 *
 * DETERMINISM: no random number is used. The two starting centres are the two embeddings that lie
 * farthest apart (first such pair in segment order); `A` is the speaker of the first labelled
 * segment. The same audio and segments give the same labels and the same document bytes.
 *
 * THE ENGINE is started through the ONE engine starter of `backends/cpu-local.ts` (lowered
 * priority, no shell, the fixed environment, the sibling rule against the capture worker, §C).
 * Engine and model paths come from configuration only. LICENCE GUARD (row 77 finding): a model
 * file is refused when the marker `DO_NOT_USE__LICENCE_NOT_CLEARED.txt` lies in its directory or
 * the one above, or when its SHA-256 is on the list of files not cleared for production use.
 *
 * TEMPORARY AUDIO: the pass writes the segments' samples to one work file for the engine; it is
 * unencrypted session audio and is removed when the pass ends, however it ends. Nothing here
 * measures or records how long a run took (D230).
 */
import { createHash } from 'node:crypto';
import { accessSync, closeSync, constants, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { getPriority } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { executableFile, judgeAgainstCaptureWorker, probeEngineNice, runLoweredProcess, type CaptureWorkerPid } from '../backends/cpu-local';
import { DEFAULT_NICE_PATH, ENGINE_TIMEOUT_MS, type EnginePriorityMode } from '../config';
import { STT_NICE, engineIsLowered } from '../cpu-priority';
import { blankText, type TranscriberLog } from '../log';
import { TranscriberError, TranscriberErrorCode } from '../types';
import type { PcmSource } from './audio-source';
import { DIARIZATION_CLUSTER_THRESHOLD, DIARIZATION_MAX_SPEAKERS, DIARIZATION_MIN_EMBED_MS, DIARIZATION_MIN_SEGMENTS } from './constants';
import type { AudioTimeline, SampleRange } from './media-time';

export const SpeakerState = { LABELLED: 'LABELLED', UNAVAILABLE: 'UNAVAILABLE' } as const;
export type SpeakerState = (typeof SpeakerState)[keyof typeof SpeakerState];

/** The two labels of a labelled transcript. `A` is whoever speaks first. */
export type SpeakerLabel = 'A' | 'B';

/** Why a transcript is sealed unlabelled. One code, recorded in the document. */
export const SpeakerUnavailableReason = {
  /** The STT configuration of the session has diarization switched off (R-8). */
  DISABLED_BY_CONFIGURATION: 'DISABLED_BY_CONFIGURATION',
  /** No speaker-embedding engine is configured on this Core. */
  ENGINE_NOT_CONFIGURED: 'ENGINE_NOT_CONFIGURED',
  /** `nice` or the engine executable is absent or not executable. */
  ENGINE_NOT_FOUND: 'ENGINE_NOT_FOUND',
  /** The model file is absent or not a readable file (CS-22). */
  MODEL_ABSENT: 'MODEL_ABSENT',
  /** The model file is marked, or known, as not cleared for production use. */
  MODEL_LICENCE_NOT_CLEARED: 'MODEL_LICENCE_NOT_CLEARED',
  /** The host cannot lower the priority of the engine and the configuration requires it (§C). */
  PRIORITY_NOT_APPLIED: 'PRIORITY_NOT_APPLIED',
  /** The engine would not run below the capture worker (§C). */
  ENGINE_NOT_BELOW_CAPTURE_WORKER: 'ENGINE_NOT_BELOW_CAPTURE_WORKER',
  /** The engine could not be started, ended with an error (a model that does not load), or was stopped at its bound. */
  ENGINE_FAILED: 'ENGINE_FAILED',
  /** The engine printed something this module does not fully understand. */
  ENGINE_OUTPUT_UNREADABLE: 'ENGINE_OUTPUT_UNREADABLE',
  /** The audio of the session could not be read for the pass. */
  AUDIO_UNAVAILABLE: 'AUDIO_UNAVAILABLE',
  /** Fewer than `DIARIZATION_MIN_SEGMENTS` segments are long enough to carry a speaker embedding. */
  TOO_FEW_SEGMENTS: 'TOO_FEW_SEGMENTS',
  /** Not two voices: the clusters lie closer than the threshold (one speaker, or voices that cannot be told apart), or one "speaker" is itself as spread out as two (more than two voices). */
  NOT_TWO_SPEAKERS: 'NOT_TWO_SPEAKERS',
  /** One of the two speakers would be one single segment. */
  SINGLETON_CLUSTER: 'SINGLETON_CLUSTER',
  /** The mean assignment confidence is below `DIARIZATION_CLUSTER_THRESHOLD`. */
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
} as const;
export type SpeakerUnavailableReason = (typeof SpeakerUnavailableReason)[keyof typeof SpeakerUnavailableReason];

/** What ran, for the header of the document. Identifiers and a hash; never a path. */
export interface DiarizationEngineFacts {
  readonly engine: string;
  readonly embeddingModel: string;
  readonly embeddingModelSha256: string;
}

/** A speaker embedding; null when the engine had too little audio for one. */
export type SpeakerEmbedding = readonly number[] | null;

export interface SpeakerEmbeddingEngine {
  /**
   * One embedding per span of a raw mono signed 16-bit little-endian PCM file, in span order.
   * Throws `DIARIZATION_FAILED` whose `detail.reason` is a `SpeakerUnavailableReason`.
   */
  embed(pcmPath: string, sampleRateHz: number, spans: readonly SampleRange[], correlationId?: string): Promise<{ readonly vectors: readonly SpeakerEmbedding[]; readonly facts: DiarizationEngineFacts }>;
}

/** The outcome of the pass: what the document and the `transcripts` row carry. */
export interface SpeakerLabelling {
  readonly state: SpeakerState;
  /** Null exactly when the state is LABELLED. */
  readonly reason: SpeakerUnavailableReason | null;
  /** 2 when two speakers were told apart, 1 when the voices were not separable, 0 when nothing was clustered. */
  readonly numSpeakers: number;
  /** The mean assignment confidence, three decimals, or null when nothing was clustered. */
  readonly confidence: number | null;
  /** One entry per transcript segment, in order. All null when the state is UNAVAILABLE. */
  readonly labels: readonly (SpeakerLabel | null)[];
  readonly engine: DiarizationEngineFacts | null;
}

export interface LabelledSpan {
  readonly startMs: number;
  readonly endMs: number;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

function unavailable(reason: SpeakerUnavailableReason, segments: number, numSpeakers = 0, confidence: number | null = null, engine: DiarizationEngineFacts | null = null): SpeakerLabelling {
  return { state: SpeakerState.UNAVAILABLE, reason, numSpeakers, confidence, labels: Array.from({ length: segments }, () => null), engine };
}

// ───────────────────────────────────────────────────────────────────────────────────────
// The rule: two clusters, and when they are believed
// ───────────────────────────────────────────────────────────────────────────────────────

function unit(vector: readonly number[]): number[] | null {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const length = Math.sqrt(sum);
  return Number.isFinite(length) && length > 0 ? vector.map((value) => value / length) : null;
}

const dot = (a: readonly number[], b: readonly number[]): number => {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += (a[index] ?? 0) * (b[index] ?? 0);
  return sum;
};

const KMEANS_MAX_PASSES = 100;

export interface TwoClusters {
  /** 0 or 1 per vector, in the order given. */
  readonly assignment: readonly (0 | 1)[];
  /** Cosine distance between the two cluster centres: 0 the same direction, 1 unrelated, 2 opposite. */
  readonly separation: number;
  /** The mean silhouette of the vectors in cosine distance: 1 two tight far-apart groups, 0 no structure, below 0 wrong. */
  readonly confidence: number;
  readonly sizes: readonly [number, number];
  /** Per cluster: the mean cosine distance between two of its members (0 for a cluster of one). */
  readonly spread: readonly [number, number];
}

/**
 * Splits unit vectors into two clusters. DETERMINISTIC: the starting centres are the two vectors
 * farthest apart (the first such pair in order), then spherical 2-means until no vector moves.
 * Null for fewer than two vectors or vectors of unequal length.
 */
export function clusterInTwo(vectors: readonly (readonly number[])[]): TwoClusters | null {
  const count = vectors.length;
  const width = vectors[0]?.length ?? 0;
  if (count < 2 || width < 1 || vectors.some((vector) => vector.length !== width)) return null;
  let first = 0;
  let second = 1;
  let lowest = Infinity;
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      const similarity = dot(vectors[i] as number[], vectors[j] as number[]);
      if (similarity < lowest) [lowest, first, second] = [similarity, i, j];
    }
  }
  let centres: [number[], number[]] = [[...(vectors[first] as number[])], [...(vectors[second] as number[])]];
  let assignment: (0 | 1)[] = [];
  for (let pass = 0; pass < KMEANS_MAX_PASSES; pass += 1) {
    // A tie goes to cluster 0: fixed, so that the outcome never depends on anything but the input.
    const next = vectors.map((vector): 0 | 1 => (dot(vector, centres[1]) > dot(vector, centres[0]) ? 1 : 0));
    if (pass > 0 && next.every((value, index) => value === assignment[index])) break;
    assignment = next;
    const sums: [number[], number[]] = [Array.from({ length: width }, () => 0), Array.from({ length: width }, () => 0)];
    vectors.forEach((vector, index) => {
      const sum = sums[assignment[index] as 0 | 1];
      for (let d = 0; d < width; d += 1) sum[d] = (sum[d] ?? 0) + (vector[d] ?? 0);
    });
    centres = [unit(sums[0]) ?? centres[0], unit(sums[1]) ?? centres[1]];
  }
  const sizes: [number, number] = [assignment.filter((value) => value === 0).length, assignment.filter((value) => value === 1).length];
  // Silhouette in cosine distance. A vector alone in its cluster has silhouette 0 by definition.
  let silhouette = 0;
  const inside: [number, number] = [0, 0];
  for (let i = 0; i < count; i += 1) {
    let own = 0;
    let other = 0;
    for (let j = 0; j < count; j += 1) {
      if (i === j) continue;
      const distance = 1 - dot(vectors[i] as number[], vectors[j] as number[]);
      if (assignment[j] === assignment[i]) own += distance;
      else other += distance;
    }
    inside[assignment[i] as 0 | 1] += own;
    const ownSize = sizes[assignment[i] as 0 | 1] - 1;
    const otherSize = sizes[assignment[i] === 0 ? 1 : 0];
    if (ownSize < 1 || otherSize < 1) continue;
    const a = own / ownSize;
    const b = other / otherSize;
    const widest = Math.max(a, b);
    if (widest > 0) silhouette += (b - a) / widest;
  }
  const pairs = (size: number): number => size * (size - 1);
  const spread: [number, number] = [sizes[0] > 1 ? inside[0] / pairs(sizes[0]) : 0, sizes[1] > 1 ? inside[1] / pairs(sizes[1]) : 0];
  return { assignment, separation: 1 - dot(centres[0], centres[1]), confidence: silhouette / count, sizes, spread };
}

/**
 * THE LABELLING RULE (§A.4 "When LABELLED is produced" / "When UNAVAILABLE is produced"). Pure.
 * `embeddings` has one entry per transcript segment: a vector, or null for a segment that was not
 * embedded (too short, or the engine had too little audio). The conditions are in the head of this
 * file. `A` is the speaker of the first labelled segment.
 */
export function labelSegments(embeddings: readonly SpeakerEmbedding[], engine: DiarizationEngineFacts | null = null): SpeakerLabelling {
  const count = embeddings.length;
  const usable: { index: number; vector: number[] }[] = [];
  embeddings.forEach((embedding, index) => {
    const vector = embedding === null ? null : unit(embedding);
    if (vector !== null) usable.push({ index, vector });
  });
  if (usable.length < DIARIZATION_MIN_SEGMENTS) return unavailable(SpeakerUnavailableReason.TOO_FEW_SEGMENTS, count, 0, null, engine);
  const clusters = clusterInTwo(usable.map((entry) => entry.vector));
  if (clusters === null) return unavailable(SpeakerUnavailableReason.ENGINE_OUTPUT_UNREADABLE, count, 0, null, engine);
  const confidence = round3(clusters.confidence);
  if (clusters.separation < DIARIZATION_CLUSTER_THRESHOLD) return unavailable(SpeakerUnavailableReason.NOT_TWO_SPEAKERS, count, 1, confidence, engine);
  if (Math.min(...clusters.sizes) < 2) return unavailable(SpeakerUnavailableReason.SINGLETON_CLUSTER, count, DIARIZATION_MAX_SPEAKERS, confidence, engine);
  // A "speaker" whose own segments lie as far from each other as two speakers do is not ONE voice:
  // a third speaker was folded in, or the voice changes from turn to turn.
  if (Math.max(...clusters.spread) >= DIARIZATION_CLUSTER_THRESHOLD) return unavailable(SpeakerUnavailableReason.NOT_TWO_SPEAKERS, count, DIARIZATION_MAX_SPEAKERS, confidence, engine);
  if (confidence < DIARIZATION_CLUSTER_THRESHOLD) return unavailable(SpeakerUnavailableReason.LOW_CONFIDENCE, count, DIARIZATION_MAX_SPEAKERS, confidence, engine);

  const labels: (SpeakerLabel | null)[] = Array.from({ length: count }, () => null);
  const firstCluster = clusters.assignment[0];
  usable.forEach((entry, position) => {
    labels[entry.index] = clusters.assignment[position] === firstCluster ? 'A' : 'B';
  });
  return { state: SpeakerState.LABELLED, reason: null, numSpeakers: DIARIZATION_MAX_SPEAKERS, confidence, labels, engine };
}

// ───────────────────────────────────────────────────────────────────────────────────────
// The engine: the speaker-embedding helper on the sherpa-onnx C API
// ───────────────────────────────────────────────────────────────────────────────────────

/** The marker a model directory (or the one above it) carries when its licence is not cleared. */
export const LICENCE_NOT_CLEARED_MARKER = 'DO_NOT_USE__LICENCE_NOT_CLEARED.txt';

/**
 * Model files not cleared for production use, by SHA-256: the two files of the non-production
 * segmentation asset of row 77, and the two files of the export of the gated, excluded weights
 * (ruling D90). A copy of one of them under any name or in any directory is refused.
 */
export const NOT_CLEARED_MODEL_SHA256: readonly string[] = Object.freeze([
  '8249e2e323f8fb0566a387d94b40a73d0b75d54ee60d02dcd729a56a5ba8ecea',
  'b9d683988380daa45cade934279c456003a43c48a5b5d6f213b3b3d134b25027',
  '220ad67ca923bef2fa91f2390c786097bf305bceb5e261d4af67b38e938e1079',
  'd582f4b4c6b48205de7e0643c57df0df5615a3c176189be3fc461e9d18827b5d',
]);

/** What the host knows about the speaker-embedding engine. Never an operator-edited value. */
export interface SpeakerEmbedderRuntime {
  /** The absolute path of the `dems-speaker-embed` executable (`native/speaker-embed.c`). */
  readonly binaryPath: string;
  /** The absolute path of the speaker-embedding model file, and the identifier the document names it by. */
  readonly embeddingModelPath: string;
  readonly embeddingModel: string;
  readonly nicePath?: string;
  readonly priority?: EnginePriorityMode;
  /** Stops a hung engine. A bound, never a measurement. */
  readonly timeoutMs?: number;
}

export interface SpeakerEmbedderConfig extends Required<SpeakerEmbedderRuntime> {}

export function resolveSpeakerEmbedderConfig(runtime: SpeakerEmbedderRuntime): SpeakerEmbedderConfig {
  const refuse = (message: string, reason: string): never => {
    throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, message, { reason });
  };
  const nicePath = runtime.nicePath ?? DEFAULT_NICE_PATH;
  for (const [path, reason] of [
    [runtime.binaryPath, 'DIARIZATION_BINARY_PATH_NOT_ABSOLUTE'],
    [runtime.embeddingModelPath, 'EMBEDDING_MODEL_PATH_NOT_ABSOLUTE'],
    [nicePath, 'NICE_PATH_NOT_ABSOLUTE'],
  ] as const) {
    if (!isAbsolute(path)) refuse('a path of the speaker-embedding engine must be absolute', reason);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(runtime.embeddingModel)) refuse('the embedding model identifier is not a plain name', 'DIARIZATION_MODEL_ID_INVALID');
  const priority = runtime.priority ?? 'required';
  if (priority !== 'required' && priority !== 'best-effort') refuse('the engine priority mode is not one of the two', 'PRIORITY_MODE_UNKNOWN');
  return Object.freeze({ ...runtime, nicePath, priority, timeoutMs: runtime.timeoutMs ?? ENGINE_TIMEOUT_MS });
}

/** The argument list of one run. Pure: the test of the command shape calls it directly. */
export function buildEmbedArgs(config: SpeakerEmbedderConfig, pcmPath: string, sampleRateHz: number, spansPath: string): string[] {
  return ['--model', config.embeddingModelPath, '--rate', String(sampleRateHz), '--pcm', pcmPath, '--spans', spansPath];
}

const OUTPUT_HEAD = 'dems-speaker-embed 1';

/**
 * Reads what the helper printed: the head line, `dim D`, one line per span in order (`i ok` and D
 * finite numbers, or `i short`), and `end N`. Anything else returns null: an output this module
 * does not fully understand is not used in part.
 */
export function parseEmbedOutput(printed: string, spans: number): SpeakerEmbedding[] | null {
  const lines = printed.split('\n').filter((line) => line !== '');
  if (lines.length !== spans + 3 || lines[0] !== OUTPUT_HEAD || lines[lines.length - 1] !== `end ${spans}`) return null;
  const dim = /^dim ([1-9][0-9]{0,4})$/.exec(lines[1] ?? '');
  if (dim === null) return null;
  const width = Number(dim[1]);
  const vectors: SpeakerEmbedding[] = [];
  for (let index = 0; index < spans; index += 1) {
    const parts = (lines[index + 2] ?? '').split(' ');
    if (parts[0] !== String(index)) return null;
    if (parts[1] === 'short' && parts.length === 2) {
      vectors.push(null);
      continue;
    }
    if (parts[1] !== 'ok' || parts.length !== width + 2) return null;
    const values = parts.slice(2).map((text) => (/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text) ? Number(text) : Number.NaN));
    if (values.some((value) => !Number.isFinite(value))) return null;
    vectors.push(values);
  }
  return vectors;
}

function readableFile(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** True when the marker lies beside the model file or one directory above it. */
export function licenceMarkerNear(modelPath: string): boolean {
  const directory = dirname(modelPath);
  return existsSync(join(directory, LICENCE_NOT_CLEARED_MARKER)) || existsSync(join(dirname(directory), LICENCE_NOT_CLEARED_MARKER));
}

export interface SpeakerEmbedderDeps {
  readonly log: TranscriberLog;
  /** The capture worker the engine must stay below (§C): a function, or the explicit `NO_CAPTURE_WORKER`. */
  readonly captureWorkerPid: CaptureWorkerPid;
  readonly onEngineStart?: (engine: { readonly pid: number }) => void;
  /** Told the command of every finished run. No time. */
  readonly onEngineRun?: (run: { readonly argv: readonly string[]; readonly status: number | null; readonly vectors: number | null; readonly nice: number | null }) => void;
}

const SOURCE = 'transcriber.diarization';
const ENGINE_NAME = 'sherpa-onnx';

export function createSpeakerEmbedder(config: SpeakerEmbedderConfig, deps: SpeakerEmbedderDeps): SpeakerEmbeddingEngine {
  const { log } = deps;
  let lowers: boolean | null = null;
  let engineNice: number | null = null;
  let facts: DiarizationEngineFacts | null = null;

  async function embed(pcmPath: string, sampleRateHz: number, spans: readonly SampleRange[], correlationId?: string): Promise<{ vectors: readonly SpeakerEmbedding[]; facts: DiarizationEngineFacts }> {
    const fail = (reason: SpeakerUnavailableReason, detail: Record<string, string | number | boolean | null> = {}): TranscriberError => {
      const error = new TranscriberError(TranscriberErrorCode.DIARIZATION_FAILED, 'the speaker-embedding engine gave no usable answer', { reason, ...detail });
      log.error({ source: `${SOURCE}.engine`, message: 'speaker labelling failed; the transcript is sealed unlabelled', error, context: { reason, embeddingModel: config.embeddingModel, ...detail }, correlationId });
      return error;
    };
    if (!executableFile(config.nicePath)) throw fail(SpeakerUnavailableReason.ENGINE_NOT_FOUND, { missing: 'NICE' });
    if (!executableFile(config.binaryPath)) throw fail(SpeakerUnavailableReason.ENGINE_NOT_FOUND, { missing: 'ENGINE' });
    if (!readableFile(config.embeddingModelPath)) throw fail(SpeakerUnavailableReason.MODEL_ABSENT);
    if (licenceMarkerNear(config.embeddingModelPath)) throw fail(SpeakerUnavailableReason.MODEL_LICENCE_NOT_CLEARED, { by: 'MARKER' });
    if (facts === null) {
      const embeddingModelSha256 = createHash('sha256').update(readFileSync(config.embeddingModelPath)).digest('hex');
      if (NOT_CLEARED_MODEL_SHA256.includes(embeddingModelSha256)) throw fail(SpeakerUnavailableReason.MODEL_LICENCE_NOT_CLEARED, { by: 'SHA256' });
      facts = Object.freeze({ engine: ENGINE_NAME, embeddingModel: config.embeddingModel, embeddingModelSha256 });
    }

    if (lowers === null) {
      engineNice = probeEngineNice(config.nicePath);
      lowers = engineNice !== null && engineIsLowered(getPriority(), engineNice);
    }
    if (!lowers) {
      if (config.priority === 'required') throw fail(SpeakerUnavailableReason.PRIORITY_NOT_APPLIED);
      log.warn({ source: SOURCE, message: 'the speaker-embedding engine priority could not be lowered', context: { reason: 'PRIORITY_NOT_APPLIED', mode: config.priority }, correlationId });
    }
    const verdict = judgeAgainstCaptureWorker(deps.captureWorkerPid, lowers ? engineNice : null);
    if (!verdict.ok) throw fail(SpeakerUnavailableReason.ENGINE_NOT_BELOW_CAPTURE_WORKER, { workerNice: verdict.workerNice, engineNice: verdict.engineNice });

    const spansPath = `${pcmPath}.spans`;
    try {
      writeFileSync(spansPath, spans.map((span) => `${span.from} ${span.to}\n`).join(''), { mode: 0o600 });
      const args = buildEmbedArgs(config, pcmPath, sampleRateHz, spansPath);
      const argv = [config.nicePath, '-n', String(STT_NICE), config.binaryPath, ...args];
      const nice = lowers ? engineNice : null;
      let exit: Awaited<ReturnType<typeof runLoweredProcess>>;
      try {
        exit = await runLoweredProcess(config, args, deps.onEngineStart, true);
      } catch {
        throw fail(SpeakerUnavailableReason.ENGINE_FAILED, { cause: 'SPAWN_FAILED' });
      }
      if (exit.timedOut) {
        deps.onEngineRun?.({ argv, status: null, vectors: null, nice });
        throw fail(SpeakerUnavailableReason.ENGINE_FAILED, { cause: 'ENGINE_TIMEOUT' });
      }
      if (exit.code !== 0) {
        deps.onEngineRun?.({ argv, status: exit.code, vectors: null, nice });
        throw fail(SpeakerUnavailableReason.ENGINE_FAILED, { cause: 'ENGINE_EXIT_NON_ZERO', exitCode: exit.code, signal: exit.signal, stderrTail: blankText(exit.stderrTail.replace(/\s+/g, ' ').trim().slice(-400)) });
      }
      const vectors = parseEmbedOutput(exit.captured, spans.length);
      deps.onEngineRun?.({ argv, status: exit.code, vectors: vectors?.length ?? null, nice });
      if (vectors === null) throw fail(SpeakerUnavailableReason.ENGINE_OUTPUT_UNREADABLE);
      return { vectors, facts };
    } finally {
      rmSync(spansPath, { force: true });
    }
  }

  return Object.freeze({ embed });
}

// ───────────────────────────────────────────────────────────────────────────────────────
// The post-pass
// ───────────────────────────────────────────────────────────────────────────────────────

export interface DiarizationPassOptions {
  /** `diarization` of the session's STT configuration snapshot (R-8). False: no engine is started. */
  readonly enabled: boolean;
  /** Null: no speaker-embedding engine is configured on this Core. */
  readonly engine: SpeakerEmbeddingEngine | null;
  readonly source: PcmSource;
  readonly timeline: AudioTimeline;
  /** The committed transcript segments, in order, in media time of the sealed file. */
  readonly segments: readonly LabelledSpan[];
  /** A directory for the one audio file of the pass; the file is removed when the pass ends. */
  readonly workDir: string;
  readonly log: TranscriberLog;
  readonly correlationId?: string;
}

/** The file of the pass: the samples of the segments to embed, one after the other. Unencrypted session audio. */
export const DIARIZATION_WORK_FILE = 'diarization-segments.pcm';

/** The source samples of a span of media time: the origin of the timeline taken off again, kept inside what exists. */
function samplesOf(timeline: AudioTimeline, span: LabelledSpan, available: number): SampleRange {
  const from = Math.round((span.startMs * timeline.sampleRateHz) / 1000) - timeline.originSamples;
  const to = Math.round((span.endMs * timeline.sampleRateHz) / 1000) - timeline.originSamples;
  return { from: Math.max(0, Math.min(available, from)), to: Math.max(0, Math.min(available, to)) };
}

/**
 * The whole post-pass. NEVER THROWS for a labelling reason: every failure is a logged UNAVAILABLE
 * with its reason. (A programming error of this module is not caught on purpose.)
 */
export async function runDiarizationPass(options: DiarizationPassOptions): Promise<SpeakerLabelling> {
  const { segments, log, correlationId, timeline, source } = options;
  const count = segments.length;
  const done = (labelling: SpeakerLabelling): SpeakerLabelling => {
    log.info({
      source: `${SOURCE}.pass`,
      message: labelling.state === SpeakerState.LABELLED ? 'speaker labels written' : 'the transcript is sealed without speaker labels',
      context: { state: labelling.state, reason: labelling.reason, numSpeakers: labelling.numSpeakers, confidence: labelling.confidence, segments: count, labelled: labelling.labels.filter((label) => label !== null).length },
      correlationId,
    });
    return labelling;
  };
  if (!options.enabled) return done(unavailable(SpeakerUnavailableReason.DISABLED_BY_CONFIGURATION, count));
  if (options.engine === null) return done(unavailable(SpeakerUnavailableReason.ENGINE_NOT_CONFIGURED, count));
  // Which segments are long enough to carry an embedding. Too few: no engine is started.
  const long = segments.map((segment, index) => ({ index, segment })).filter((entry) => entry.segment.endMs - entry.segment.startMs >= DIARIZATION_MIN_EMBED_MS);
  if (long.length < DIARIZATION_MIN_SEGMENTS) return done(unavailable(SpeakerUnavailableReason.TOO_FEW_SEGMENTS, count));

  const path = join(options.workDir, DIARIZATION_WORK_FILE);
  try {
    const spans: SampleRange[] = [];
    try {
      mkdirSync(options.workDir, { recursive: true });
      const available = source.availableSamples();
      const descriptor = openSync(path, 'w', 0o600);
      try {
        let written = 0;
        for (const entry of long) {
          const range = samplesOf(timeline, entry.segment, available);
          if (range.to <= range.from) throw new TranscriberError(TranscriberErrorCode.TRANSCRIPT_AUDIO_UNAVAILABLE, 'a committed segment has no audio any more', { reason: 'AUDIO_RANGE_NOT_AVAILABLE' });
          const samples = source.read(range);
          writeSync(descriptor, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
          spans.push({ from: written, to: written + samples.length });
          written += samples.length;
        }
      } finally {
        closeSync(descriptor);
      }
    } catch (error) {
      log.error({ source: `${SOURCE}.pass`, message: 'the audio for the speaker-labelling pass could not be prepared', error, context: { reason: SpeakerUnavailableReason.AUDIO_UNAVAILABLE }, correlationId });
      return done(unavailable(SpeakerUnavailableReason.AUDIO_UNAVAILABLE, count));
    }
    let answer: Awaited<ReturnType<SpeakerEmbeddingEngine['embed']>>;
    try {
      answer = await options.engine.embed(path, source.sampleRateHz, spans, correlationId);
    } catch (error) {
      const known = Object.values(SpeakerUnavailableReason) as string[];
      const stated = error instanceof TranscriberError ? String(error.detail['reason'] ?? '') : '';
      // The engine module logged its own typed failure; anything else is logged here.
      if (!(error instanceof TranscriberError)) log.error({ source: `${SOURCE}.pass`, message: 'the speaker-embedding engine ended unexpectedly', error, context: { reason: SpeakerUnavailableReason.ENGINE_FAILED }, correlationId });
      return done(unavailable(known.includes(stated) ? (stated as SpeakerUnavailableReason) : SpeakerUnavailableReason.ENGINE_FAILED, count));
    }
    if (answer.vectors.length !== long.length) return done(unavailable(SpeakerUnavailableReason.ENGINE_OUTPUT_UNREADABLE, count, 0, null, answer.facts));
    const embeddings: SpeakerEmbedding[] = Array.from({ length: count }, () => null);
    long.forEach((entry, position) => {
      embeddings[entry.index] = answer.vectors[position] ?? null;
    });
    return done(labelSegments(embeddings, answer.facts));
  } finally {
    rmSync(path, { force: true });
  }
}
