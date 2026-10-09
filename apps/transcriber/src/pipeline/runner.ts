/**
 * THE TRANSCRIPT RUNNER: audio intake, VAD chunking, STT per chunk, checkpoints and resume
 * (transcript spec §A.1-§A.3, §C, §D; blueprint row 77 / M6-W2).
 *
 * One runner belongs to one session and one adapter (the backend of a session never changes,
 * §B.4). `step()` does two things, in this order:
 *
 *   PLAN    the audio that exists beyond the cursor is given to the VAD; the chunks it closes are
 *           WRITTEN TO THE CHECKPOINT BEFORE ANY OF THEM IS DECODED (§A.2 "Checkpoint"). A VAD
 *           that fails or is absent gives fixed windows and the flag `vad_fallback`.
 *   DECODE  every chunk that is not committed is decoded, ONE AT A TIME (the adapter's queue, §C),
 *           in timeline order. After each chunk its segments (clamped, in media time of the sealed
 *           file) are written to the checkpoint and the chunk is DONE (§A.3 "Checkpoint"). A chunk
 *           whose engine fails is tried `STT_CHUNK_RETRIES` times more, then it is FAILED and the
 *           runner goes on: one chunk never stops a transcript, and no text is made up for it.
 *
 * A DONE CHUNK IS NEVER DECODED AGAIN, ON ANY BACKEND. Its text is what the transcript holds for
 * good; only a chunk that was not committed (PENDING, RUNNING at a kill, or re-queued after FAILED)
 * may come out with other text on a later attempt.
 *
 * RESUME IS THE SAME CALL. A new runner on the same scratch directory reads the checkpoint: DONE
 * chunks are kept as they are and never decoded again; the chunk a kill interrupted (RUNNING) and
 * the ones not started (PENDING) are decoded; the plan continues at the stored cursor (§D.2).
 *
 * WHILE A SESSION RECORDS the caller steps with `final: false` as the tap grows and may hold the
 * runner back between chunks (`shouldPause`, §C "Suspend/degrade under pressure"); after the stop
 * it steps with `final: true` until the report says `complete`.
 *
 * Nothing here measures or records how long anything took (D230). `computedAt` is the instant of a
 * commit, as `transcript_chunks.computed_at` asks for.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TranscriberAdapter } from '../adapter';
import type { EngineGuard } from '../backends/cpu-local';
import type { TranscriberLog } from '../log';
import { TRANSCRIBER_LANGUAGE, TranscriberError, TranscriberErrorCode } from '../types';
import { encodeWavPcm16 } from '../wav';
import type { PcmSource } from './audio-source';
import { ChunkStatus, createCheckpointStore, emptyCheckpoint, type Checkpoint, type CheckpointChunk } from './checkpoint';
import { planChunks } from './chunker';
import { clampSegments } from './clamp';
import { QaFlag, STT_CHUNK_RETRIES, VAD_MAX_CHUNK_MS, VAD_WINDOW_MAX_MS } from './constants';
import { AudioSourceKind, msToSamples, sampleToMediaMs, type AudioTimeline, type SampleRange } from './media-time';
import { toModelCode, type ChunkMirror, type ChunkMirrorRow } from './mirror';
import type { SpeechSpan, VoiceActivityDetector } from './silero-vad';

/** One row of `session_audio_intervals`, as far as a chunk needs it (§A.1). Media time, milliseconds. */
export interface AudioSourceInterval {
  readonly source: string;
  readonly fromMs: number;
  /** Null: the interval is still open. */
  readonly toMs: number | null;
}

export interface TranscriptRunnerOptions {
  readonly sessionId: string;
  readonly adapter: TranscriberAdapter;
  readonly timeline: AudioTimeline;
  readonly source: PcmSource;
  /** Null: no VAD engine is configured; fixed windows are used and flagged. */
  readonly vad: VoiceActivityDetector | null;
  /** `<session scratch>`: the checkpoint file and a `work` directory for chunk files live here. */
  readonly sessionScratchDir: string;
  readonly log: TranscriberLog;
  /** The mirror of the checkpoint in `transcript_chunks`. Absent: file only. */
  readonly mirror?: ChunkMirror;
  readonly now?: () => Date;
  readonly prompt?: string;
  /** The audio-source intervals of the session, when the caller has them (§A.1). */
  readonly intervals?: () => readonly AudioSourceInterval[];
  /**
   * THE TAP SIGNAL (pair-58 finding R-8; D58-15). True when the Core knows that the PCM tap of this
   * session is not being written: the capture worker reports `tapActive: false` in its telemetry
   * (a restarted worker that found an existing tap file records WITHOUT a tap; a tap that failed).
   * The Core (row 115) hands the latest value in; the transcriber never reads telemetry itself.
   *
   * STICKY (navigator finding N-1): it is asked at EVERY step, and ONE `true` is enough — the
   * session is then PARTIAL for good, even if a later answer is `false` (a worker that is gone
   * after the stop has no telemetry to say `true` with).
   *
   * NOT OPTIONAL FOR A LIVE SESSION (N-10): with a tap timeline the runner refuses to be built
   * without it (`CONFIG_INVALID`). A test or a development run states the explicit `NO_TAP_SIGNAL`.
   * Absent is allowed only where the audio is a finished file (the fixture checks), which cannot
   * be lost.
   */
  readonly tapLost?: () => boolean;
  /**
   * The engine guard of this session (`createEngineGuard`; navigator finding N-2). The runner
   * reaps what a killed pipeline left running BEFORE it plans or decodes anything, so that two
   * engines never work at the same time (§C). The composition hands the SAME guard's `record` to
   * the adapter, the VAD and the speaker embedder as `onEngineStart`.
   */
  readonly engineGuard?: EngineGuard;
  /** How much new audio a pass waits for while the audio still grows. Default: one maximum chunk. */
  readonly minPlanMs?: number;
  /** Asked before every chunk; true holds the runner back until the next `step` (§C). */
  readonly shouldPause?: () => boolean;
  /** Told what happens to a chunk, for a check that watches from outside. No time. */
  readonly onChunk?: (event: { readonly chunkIndex: number; readonly seq: number; readonly phase: 'reused' | 'running' | 'done' | 'failed' }) => void;
}

export interface StepReport {
  /** Chunks this step added to the plan. */
  readonly planned: number;
  /** Chunks this step decoded and committed. */
  readonly decoded: number;
  /** Chunks this step gave up on. */
  readonly failed: number;
  /** Committed chunks this step found and did not decode again. */
  readonly reused: number;
  /** Chunks still to decode. */
  readonly remaining: number;
  readonly paused: boolean;
  /** True when the plan covers the whole audio and no chunk is left to decode (FAILED chunks stay FAILED). */
  readonly complete: boolean;
  readonly qaFlags: readonly string[];
  /**
   * The state of the transcript, in the values of the session slice (`transcript.state` of
   * `@dems/shared/api`; this row adds no value): PENDING while work is left; READY when every chunk
   * of the whole audio is committed; PARTIAL when the work is over and something is missing — a
   * FAILED chunk, or audio that never reached the transcriber. Never READY for a session without
   * its audio. (FAILED of that value set is not produced by this row: D-EV-1 seals PARTIAL.)
   */
  readonly transcriptState: 'PENDING' | 'PARTIAL' | 'READY';
  /** Why the transcript is PARTIAL: `TRANSCRIPT_AUDIO_UNAVAILABLE` (the existing C3 reason), `CHUNKS_FAILED`, or null. */
  readonly partialReason: 'TRANSCRIPT_AUDIO_UNAVAILABLE' | 'CHUNKS_FAILED' | null;
}

export interface TranscriptRunner {
  step(options: { readonly final: boolean }): Promise<StepReport>;
  /** Gives every FAILED chunk a new attempt (a new row), to be decoded by the next `step`. Returns how many. */
  retryFailed(): number;
  /** A copy of the checkpoint as it is stored. */
  checkpoint(): Checkpoint;
}

const SOURCE = 'transcriber.runner';

/** The explicit statement "this run has no tap signal" (a test, a development run): never lost. See `tapLost`. */
export const NO_TAP_SIGNAL = (): boolean => false;
/** The same, under the name the tests use. */
export const NO_TAP = NO_TAP_SIGNAL;

/**
 * Removes the temporary audio of a session's transcript work: `work/` under the scratch directory
 * (chunk files, the VAD window, the speaker-labelling file, the engine record) and, when named,
 * the raw tap copy. ALL OF IT IS UNENCRYPTED SESSION AUDIO outside the sealed package (D-77-1): it
 * is removed at the end of a run, when a session is abandoned, and before a resume after a kill.
 * The checkpoint and the assembled transcript files are NOT touched.
 */
export function discardTranscriptAudio(sessionScratchDir: string, tapPath?: string): void {
  rmSync(join(sessionScratchDir, 'work'), { recursive: true, force: true });
  if (tapPath !== undefined) rmSync(tapPath, { force: true });
}

function mirrorRows(checkpoint: Checkpoint): ChunkMirrorRow[] {
  const modelId = toModelCode(checkpoint.model);
  const rows: ChunkMirrorRow[] = [];
  for (const chunk of checkpoint.chunks) {
    const range = { sessionId: checkpoint.sessionId, audioFromMs: chunk.startMs, audioToMs: chunk.endMs, embeddingRef: null, modelId };
    for (const seq of chunk.failedSeqs) rows.push({ ...range, seq, status: ChunkStatus.FAILED, segments: null, computedAt: null });
    rows.push({ ...range, seq: chunk.seq, status: chunk.status, segments: chunk.segments, computedAt: chunk.computedAt });
  }
  return rows.sort((a, b) => a.seq - b.seq);
}

const fingerprint = (row: Pick<ChunkMirrorRow, 'status' | 'computedAt'>): string => `${row.status}|${row.computedAt ?? ''}`;

export function createTranscriptRunner(options: TranscriptRunnerOptions): TranscriptRunner {
  const { adapter, timeline, source, log, sessionId } = options;
  const now = options.now ?? ((): Date => new Date());
  const store = createCheckpointStore(options.sessionScratchDir);
  const workDir = join(options.sessionScratchDir, 'work');
  const identity = { sessionId, backend: adapter.backend, model: adapter.model, timeline };
  if (source.sampleRateHz !== timeline.sampleRateHz) {
    throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'the audio source and its timeline state different sample rates', { reason: 'SAMPLE_RATE_MISMATCH' });
  }

  // A LIVE SESSION STATES ITS SIGNALS (N-10): on a tap timeline neither the tap signal nor the
  // capture worker of the sibling rule may be missing by omission.
  if (timeline.kind === AudioSourceKind.PCM_TAP) {
    const refuse = (reason: string): never => {
      throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'the runner of a live session was composed without a signal it must be given', { reason });
    };
    if (options.tapLost === undefined) refuse('TAP_SIGNAL_NOT_STATED');
    if (adapter.captureWorkerStated !== true) refuse('CAPTURE_WORKER_NOT_STATED');
    if (options.vad !== null && options.vad.captureWorkerStated === false) refuse('CAPTURE_WORKER_NOT_STATED');
  }

  // AFTER A KILL (N-2): the engine the dead pipeline started may still be decoding. It is stopped
  // before anything else happens, and the audio files it and the dead pipeline left are removed.
  const reaped = options.engineGuard?.reap() ?? null;
  let staleFiles: string[] = [];
  try {
    staleFiles = readdirSync(workDir);
  } catch {
    staleFiles = [];
  }
  for (const name of staleFiles) rmSync(join(workDir, name), { recursive: true, force: true });
  if (reaped !== null || staleFiles.length > 0) {
    log.warn({ source: `${SOURCE}.resume`, message: 'what a stopped pipeline left behind was cleared before the resume', context: { reason: 'STALE_WORK_CLEARED', engineStopped: reaped !== null, files: staleFiles.length }, correlationId: sessionId });
  }

  const stored = store.load(identity);
  let checkpoint: Checkpoint = stored ?? emptyCheckpoint(identity);
  /** True when this runner started without a checkpoint file: the mirror may still hold rows of a lost one (N-6). */
  let startedEmpty = stored === null;
  /** What the mirror is known to hold, by `seq`. Null: not known (not read yet, or a write failed). */
  let mirrored: Map<number, string> | null = null;

  const save = (): void => {
    store.save(checkpoint);
  };

  /**
   * Row 78 writes the label map and the document record into the SAME checkpoint file, after the
   * last chunk. A runner that is still held in memory takes them over before it writes again, so
   * a later write of this runner never drops them (they are written once and never changed).
   */
  const adoptPostPass = (): void => {
    let stored: Checkpoint | null;
    try {
      stored = store.load(identity);
    } catch {
      return; // a file this runner cannot read holds nothing to take over; its own copy stays the truth, as before
    }
    if (stored?.diarization !== undefined) checkpoint.diarization = stored.diarization;
    if (stored?.document !== undefined) checkpoint.document = stored.document;
  };

  async function syncMirror(): Promise<void> {
    const mirror = options.mirror;
    if (mirror === undefined) return;
    try {
      if (mirrored === null) mirrored = new Map((await mirror.read(sessionId)).map((row) => [row.seq, fingerprint(row)]));
      const known = mirrored;
      if (startedEmpty) {
        startedEmpty = false;
        // THE CHECKPOINT FILE WAS LOST BUT THE TABLE HOLDS ROWS OF IT (N-6). The file is the only
        // resume source: the transcript is planned and decoded again. The old rows keep their
        // ranges and are never given new segments: the new plan takes row numbers ABOVE them.
        if (known.size > 0 && checkpoint.chunks.length === 0) {
          checkpoint.nextSeq = Math.max(checkpoint.nextSeq, Math.max(...known.keys()) + 1);
          save();
          log.warn({ source: `${SOURCE}.mirror`, message: 'no checkpoint file, but transcript_chunks holds rows of this session: the transcript is rebuilt in new rows', context: { reason: 'CHECKPOINT_REBUILT', staleRows: known.size, nextSeq: checkpoint.nextSeq }, correlationId: sessionId });
        }
      }
      const desired = mirrorRows(checkpoint);
      const missing = desired.filter((row) => !known.has(row.seq));
      if (missing.length > 0) {
        await mirror.insertMissing(missing);
        for (const row of missing) known.set(row.seq, fingerprint(row));
      }
      for (const row of desired) {
        if (known.get(row.seq) === fingerprint(row)) continue;
        await mirror.update(sessionId, row.seq, { status: row.status, segments: row.segments, modelId: row.modelId, computedAt: row.computedAt });
        known.set(row.seq, fingerprint(row));
      }
    } catch (error) {
      // The file is the truth: the transcript goes on, and the rows are brought in line at the next write.
      mirrored = null;
      log.error({ source: `${SOURCE}.mirror`, message: 'the transcript_chunks mirror could not be written', error, context: { reason: 'MIRROR_WRITE_FAILED', chunks: checkpoint.chunks.length }, correlationId: sessionId });
    }
  }

  const flag = (value: string): void => {
    if (!checkpoint.qaFlags.includes(value)) checkpoint.qaFlags.push(value);
  };

  /**
   * "No (whole) audio for this session" is a RECORDED OUTCOME, written to the checkpoint and to the
   * persistent log, never an exception that leaves nothing behind and never an empty transcript
   * that looks complete (§A.1; D-EV-1: the package still seals, PARTIAL, with no made-up text).
   */
  function recordAudioUnavailable(reason: string): void {
    if (checkpoint.audioUnavailable) return;
    checkpoint.audioUnavailable = true;
    log.error({
      source: `${SOURCE}.intake`,
      message: 'the audio of the session did not reach the transcriber; the transcript is PARTIAL',
      context: { code: TranscriberErrorCode.TRANSCRIPT_AUDIO_UNAVAILABLE, reason, chunks: checkpoint.chunks.length },
      correlationId: sessionId,
    });
  }

  function audioSourceAt(startMs: number): string | null {
    const intervals = options.intervals?.() ?? [];
    const covering = intervals.filter((interval) => interval.fromMs <= startMs && (interval.toMs === null || startMs < interval.toMs));
    // None, or more than one (overlap): the interval map does not say which microphone this was (§A.1).
    if (covering.length !== 1) {
      flag(QaFlag.INTERVALS_INCOMPLETE);
      return null;
    }
    return covering[0]?.source ?? null;
  }

  function appendChunks(ranges: readonly SampleRange[]): number {
    for (const range of ranges) {
      const startMs = sampleToMediaMs(timeline, range.from);
      const endMs = Math.max(startMs + 1, sampleToMediaMs(timeline, range.to));
      checkpoint.chunks.push({
        chunkIndex: checkpoint.chunks.length,
        seq: checkpoint.nextSeq,
        failedSeqs: [],
        fromSample: range.from,
        toSample: range.to,
        startMs,
        endMs,
        audioSource: audioSourceAt(startMs),
        status: ChunkStatus.PENDING,
        segments: null,
        computedAt: null,
        errorCode: null,
      });
      checkpoint.nextSeq += 1;
    }
    return ranges.length;
  }

  async function detectSpeech(window: SampleRange): Promise<readonly SpeechSpan[] | null> {
    if (options.vad === null) {
      flag(QaFlag.VAD_FALLBACK);
      return null;
    }
    const path = join(workDir, 'vad-window.wav');
    try {
      mkdirSync(workDir, { recursive: true });
      writeFileSync(path, encodeWavPcm16(source.read(window), timeline.sampleRateHz), { mode: 0o600 });
      return await options.vad.detect(path, sessionId);
    } catch (error) {
      if (error instanceof TranscriberError && error.code === TranscriberErrorCode.TRANSCRIPT_AUDIO_UNAVAILABLE) throw error;
      // The VAD module logged its own failure; anything else is logged here. Either way: fixed windows.
      if (!(error instanceof TranscriberError)) log.error({ source: `${SOURCE}.plan`, message: 'the VAD window could not be prepared', error, context: { reason: 'VAD_WINDOW_FAILED' }, correlationId: sessionId });
      flag(QaFlag.VAD_FALLBACK);
      return null;
    } finally {
      rmSync(path, { force: true });
    }
  }

  /** PLAN. Returns how many chunks were added. Every change is in the checkpoint file before it returns. */
  async function plan(final: boolean): Promise<number> {
    let planned = 0;
    const maxWindow = msToSamples(timeline, VAD_WINDOW_MAX_MS);
    const minPlan = msToSamples(timeline, options.minPlanMs ?? VAD_MAX_CHUNK_MS);
    while (!checkpoint.audioComplete) {
      let available: number;
      try {
        available = source.availableSamples();
      } catch (error) {
        if (!(error instanceof TranscriberError) || error.code !== TranscriberErrorCode.TRANSCRIPT_AUDIO_UNAVAILABLE) throw error;
        // No tap file (yet). While the session records it may still appear; at the end it is an outcome.
        if (!final) break;
        available = checkpoint.cursorSample;
        recordAudioUnavailable(String(error.detail['reason'] ?? 'AUDIO_FILE_NOT_READABLE'));
      }
      if (final && available === 0) recordAudioUnavailable('AUDIO_EMPTY');
      // A tap never shrinks (`audio-source.ts`). One that holds less than was already planned was
      // truncated or replaced: what is left is not the session's audio any more (N-9).
      if (available < checkpoint.cursorSample) recordAudioUnavailable('AUDIO_SHRANK');
      const from = checkpoint.cursorSample;
      const to = Math.min(available, from + maxWindow);
      const last = final && to === available;
      if (to <= from) {
        if (last) checkpoint.audioComplete = true;
        break;
      }
      if (!last && to - from < minPlan) break;

      const window = { from, to };
      let spans = await detectSpeech(window);
      // A pass that cut an open run left the cursor inside it (N-4): this pass is told how far it reached.
      let result = planChunks({ timeline, window, spans, final: last, openRunUntil: checkpoint.openRunUntilSample ?? null });
      if (!last && final && result.chunks.length === 0 && result.nextCursor === from && spans !== null) {
        // A capped window in which the VAD closed nothing: it would be asked the same question for ever.
        flag(QaFlag.VAD_FALLBACK);
        spans = null;
        result = planChunks({ timeline, window, spans, final: last });
      }
      planned += appendChunks(result.chunks);
      const progressed = result.chunks.length > 0 || result.nextCursor > from;
      checkpoint.cursorSample = Math.max(from, result.nextCursor);
      if (result.openRunUntil !== null && result.openRunUntil > checkpoint.cursorSample) checkpoint.openRunUntilSample = result.openRunUntil;
      else delete checkpoint.openRunUntilSample;
      if (last) checkpoint.audioComplete = true;
      save();
      if (!final || !progressed) break;
    }
    if (checkpoint.audioComplete && checkpoint.chunks.length === 0 && !checkpoint.audioUnavailable && !checkpoint.qaFlags.includes(QaFlag.NO_SPEECH)) {
      flag(QaFlag.NO_SPEECH); // an empty transcript, flagged; not an error (§A.2)
    }
    save();
    if (planned > 0) log.info({ source: `${SOURCE}.plan`, message: 'chunk boundaries written before decode', context: { planned, chunks: checkpoint.chunks.length, audioComplete: checkpoint.audioComplete }, correlationId: sessionId });
    return planned;
  }

  /** DECODE one chunk. Returns true when it was committed. */
  async function decode(chunk: CheckpointChunk): Promise<boolean> {
    const range = { from: chunk.fromSample, to: chunk.toSample };
    const correlationId = `${sessionId}#${chunk.chunkIndex}`;
    chunk.status = ChunkStatus.RUNNING;
    chunk.errorCode = null;
    save();
    await syncMirror();
    options.onChunk?.({ chunkIndex: chunk.chunkIndex, seq: chunk.seq, phase: 'running' });

    const path = join(workDir, `chunk-${chunk.seq}.wav`);
    let lastCode: string = TranscriberErrorCode.ENGINE_FAILED;
    try {
      for (let attempt = 0; attempt <= STT_CHUNK_RETRIES; attempt += 1) {
        try {
          mkdirSync(workDir, { recursive: true });
          writeFileSync(path, encodeWavPcm16(source.read(range), timeline.sampleRateHz), { mode: 0o600 });
          const result = await adapter.transcribe(
            { audio: { kind: 'file', path }, sampleRateHz: timeline.sampleRateHz, offsetMs: chunk.startMs, durationMs: chunk.endMs - chunk.startMs },
            { language: TRANSCRIBER_LANGUAGE, correlationId, ...(options.prompt === undefined ? {} : { prompt: options.prompt }) },
          );
          const clamped = clampSegments(result.segments, timeline, range);
          if (clamped.clamped > 0 || clamped.dropped.length > 0) {
            log.warn({
              source: `${SOURCE}.clamp`,
              message: 'segments past the end of the chunk audio were clamped or dropped',
              context: { chunkIndex: chunk.chunkIndex, clamped: clamped.clamped, dropped: clamped.dropped.length, reasons: [...new Set(clamped.dropped.map((entry) => entry.reason))] },
              correlationId,
            });
          }
          options.engineGuard?.clear();
          chunk.segments = clamped.segments;
          chunk.computedAt = now().getTime();
          chunk.status = ChunkStatus.DONE;
          save();
          await syncMirror();
          options.onChunk?.({ chunkIndex: chunk.chunkIndex, seq: chunk.seq, phase: 'done' });
          return true;
        } catch (error) {
          lastCode = error instanceof TranscriberError ? error.code : 'UNEXPECTED';
          // A backend logs its own typed failure; what it did not see is logged here.
          if (!(error instanceof TranscriberError)) log.error({ source: `${SOURCE}.decode`, message: 'a chunk could not be decoded', error, context: { chunkIndex: chunk.chunkIndex, attempt }, correlationId });
          else log.warn({ source: `${SOURCE}.decode`, message: 'a chunk attempt failed', context: { chunkIndex: chunk.chunkIndex, attempt, code: error.code, retriesLeft: STT_CHUNK_RETRIES - attempt }, correlationId });
        }
      }
    } finally {
      rmSync(path, { force: true });
    }
    chunk.status = ChunkStatus.FAILED;
    chunk.segments = null;
    chunk.computedAt = null;
    chunk.errorCode = lastCode;
    // A chunk that failed because its AUDIO is gone is missing audio, not a failed engine (N-9).
    if (lastCode === TranscriberErrorCode.TRANSCRIPT_AUDIO_UNAVAILABLE) recordAudioUnavailable('CHUNK_AUDIO_NOT_READABLE');
    save();
    await syncMirror();
    log.error({ source: `${SOURCE}.decode`, message: 'a chunk was given up after its retries; the transcript goes on without it', context: { chunkIndex: chunk.chunkIndex, seq: chunk.seq, code: lastCode, reason: 'CHUNK_FAILED' }, correlationId });
    options.onChunk?.({ chunkIndex: chunk.chunkIndex, seq: chunk.seq, phase: 'failed' });
    return false;
  }

  const toDecode = (): CheckpointChunk[] => checkpoint.chunks.filter((chunk) => chunk.status === ChunkStatus.PENDING || chunk.status === ChunkStatus.RUNNING);

  async function step(stepOptions: { readonly final: boolean }): Promise<StepReport> {
    adoptPostPass();
    // THE TAP SIGNAL IS STICKY (N-1): asked at every step, latched in the checkpoint file at once.
    if (!checkpoint.audioUnavailable && options.tapLost?.() === true) {
      recordAudioUnavailable('TAP_NOT_ACTIVE');
      save();
    }
    // Committed work that exists when the step starts is reused, never decoded again (§D.2).
    const committedBefore = checkpoint.chunks.filter((chunk) => chunk.status === ChunkStatus.DONE);
    for (const chunk of committedBefore) options.onChunk?.({ chunkIndex: chunk.chunkIndex, seq: chunk.seq, phase: 'reused' });
    await syncMirror(); // a resume first brings the rows in line with the file

    const planned = await plan(stepOptions.final);
    await syncMirror();

    let decoded = 0;
    let failed = 0;
    let paused = false;
    for (const chunk of toDecode()) {
      if (options.shouldPause?.() === true) {
        paused = true;
        break;
      }
      if (await decode(chunk)) decoded += 1;
      else failed += 1;
    }
    const remaining = toDecode().length;
    const complete = checkpoint.audioComplete && remaining === 0;
    // END OF A RUN: no chunk file, VAD window or engine record stays behind (unencrypted session audio).
    if (complete) rmSync(workDir, { recursive: true, force: true });
    const anyFailed = checkpoint.chunks.some((chunk) => chunk.status === ChunkStatus.FAILED);
    const partialReason = !complete ? null : checkpoint.audioUnavailable ? ('TRANSCRIPT_AUDIO_UNAVAILABLE' as const) : anyFailed ? ('CHUNKS_FAILED' as const) : null;
    const transcriptState = !complete ? ('PENDING' as const) : partialReason === null ? ('READY' as const) : ('PARTIAL' as const);
    return { planned, decoded, failed, reused: committedBefore.length, remaining, paused, complete, qaFlags: [...checkpoint.qaFlags], transcriptState, partialReason };
  }

  function retryFailed(): number {
    adoptPostPass();
    if (checkpoint.diarization !== undefined || checkpoint.document !== undefined) {
      // The label map belongs to the committed segments as they are, and an assembled machine
      // transcript is never computed again (§D.3): a FAILED chunk stays FAILED, the document is PARTIAL.
      log.warn({ source: `${SOURCE}.retry`, message: 'failed chunks are not retried after the diarization pass or the assembly', context: { reason: 'TRANSCRIPT_ALREADY_FINALISED', assembled: checkpoint.document !== undefined }, correlationId: sessionId });
      return 0;
    }
    let count = 0;
    for (const chunk of checkpoint.chunks) {
      if (chunk.status !== ChunkStatus.FAILED) continue;
      chunk.failedSeqs.push(chunk.seq);
      chunk.seq = checkpoint.nextSeq;
      checkpoint.nextSeq += 1;
      chunk.status = ChunkStatus.PENDING;
      chunk.errorCode = null;
      count += 1;
    }
    if (count > 0) save();
    return count;
  }

  return Object.freeze({ step, retryFailed, checkpoint: () => structuredClone(checkpoint) });
}
