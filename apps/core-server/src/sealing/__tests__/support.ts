// Test support of the sealing unit (blueprint rows 79 and 116). Not a test file.
//
// THE REAL TRANSCRIBER, WITH STAND-IN ENGINES. A session is run through `@dems/transcriber` as it
// is: runner, VAD chunking, checkpoint file, mirror port, diarization post-pass, assembly. Only
// the three engines are in-process stand-ins (no model, no process, no oMLX): a VAD that knows
// where the tone bursts are, an STT engine that answers one segment per burst, an embedder with
// two made-up voices.
//
// `transcriberSeam` is the adapter rows 82 / 115 write in production: `AssembledTranscriptSource`
// on `assembleTranscript` and the checkpoint file. It is here so that this row's tests exercise
// the step against the real assembly, and as the reference for that wiring.
//
// ROW 116. `closeOut` of the seam is here on the transcriber's PUBLIC pipeline only: a second
// runner on the same scratch directory whose engine refuses every chunk at once. The runner's own
// rule then gives every chunk that is not committed up (its retries, FAILED, no text, the row
// mirrored) and ends the plan; the real assembly follows. Nothing reaches into a checkpoint.
// `manualClock` is the clock the bounds of the step are counted on in a test: it moves only when
// the test moves it.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NO_TAP_SIGNAL,
  SerialQueue,
  TRANSCRIPT_DOCUMENT_FILE,
  TRANSCRIPT_SRT_FILE,
  TRANSCRIPT_VTT_FILE,
  TranscriberError,
  assembleTranscript,
  createCheckpointStore,
  createMemoryLog,
  createTranscriptRunner,
  decodedFileTimeline,
  encodeWavPcm16,
  openPcmSource,
  type AssembleTranscriptOptions,
  type Checkpoint,
  type ChunkMirror,
  type SpeakerEmbeddingEngine,
  type TranscriberAdapter,
  type TranscriberBackendId,
  type TranscriptRunner,
  type VoiceActivityDetector,
} from '@dems/transcriber';
import type { ErrorLog, ErrorLogEntry } from '../../plugins/logger';
import type { AssembledTranscriptSource, SealingStepJournal, SealingStepRecord, SealingStepWrite, StepTimer, SttConfigSnapshot, TranscriptFiles } from '../index';

export const RATE = 16_000;
/** Three runs of "speech", 8 s each, too far apart to be joined: three chunks. */
export const RUNS = [
  { fromMs: 1_000, toMs: 9_000 },
  { fromMs: 50_000, toMs: 58_000 },
  { fromMs: 100_000, toMs: 108_000 },
] as const;
const TOTAL_MS = 110_000;
export const hex = (seed: string): string => seed.padEnd(64, '0').slice(0, 64).replace(/[^0-9a-f]/g, 'a');
export const MODEL = { name: 'whisper-large-v3-turbo', version: 'ggml-v1', quantisation: 'none', sha256: hex('c0de') };

export const snapshotOf = (overrides: Partial<SttConfigSnapshot> = {}): SttConfigSnapshot => ({ enabled: true, backend: 'cpu-local', model: 'ggml-large-v3-turbo', diarization: true, revision: 3, ...overrides });

const vad: VoiceActivityDetector = { detect: async () => RUNS.map((run) => ({ ...run })) };
const FACTS = { engine: 'stand-in-embedder', embeddingModel: 'stand-in-embedding', embeddingModelSha256: hex('e0bed') };
/** Two made-up voices taking turns. Six segments are needed for a label; `RUNS_SIX` gives them. */
const twoSpeakers: SpeakerEmbeddingEngine = { embed: async (_path, _rate, spans) => ({ vectors: spans.map((_, index) => (index % 2 === 0 ? [1, 0] : [0, 1])), facts: FACTS }) };

export interface SessionOptions {
  readonly backend?: TranscriberBackendId;
  /** Asked for every chunk attempt: a returned error is thrown by the stand-in engine. */
  readonly fail?: (offsetMs: number) => Error | null;
  readonly tapLost?: boolean;
  /** `null`: this Core has no speaker engine. Default: the two made-up voices. */
  readonly diarizer?: SpeakerEmbeddingEngine | null;
  readonly mirror: ChunkMirror;
  /** How many segments the stand-in engine answers per run of speech (default 2: six segments in all). */
  readonly segmentsPerRun?: number;
  /** Asked before every chunk; true holds the runner back (a transcript that is not finished yet). */
  readonly shouldPause?: () => boolean;
  /**
   * Row 116: awaited by the stand-in engine before it answers a chunk attempt. A promise that
   * never settles is a backend that hangs; one that settles late is a backend that answers late.
   */
  readonly engineGate?: (offsetMs: number) => Promise<void>;
}

/** The seam of a test, with its counters. */
export type CountingSeam = AssembledTranscriptSource & { assembleCalls: number; locateCalls: number; closeOutCalls: number; closeOutCodes: string[] };

export interface TranscribedSession {
  readonly sessionId: string;
  readonly dir: string;
  readonly runner: TranscriptRunner;
  /** Runs the transcript to its end (`final: true`). */
  finish(): Promise<void>;
  /** The seam the step is given. `assembleCalls` counts how often the transcriber was asked to assemble. */
  readonly seam: CountingSeam;
  /** A second seam on the same scratch directory: what a restarted Core would build. */
  freshSeam(): CountingSeam;
  readonly files: TranscriptFiles;
  checkpoint(): Checkpoint;
  readonly assembly: AssembleTranscriptOptions;
  /** The offsets of every chunk attempt the engine was asked for, in order. */
  readonly decoded: number[];
  /** The offsets of every chunk attempt the close-out refused (row 116). The engine was not asked for these. */
  readonly refused: number[];
}

/** The production adapter of the transcriber seam (rows 82 / 115), on the real assembly. */
export function transcriberSeam(assembly: AssembleTranscriptOptions, giveUp: (chunkCode: string) => Promise<boolean> = async () => false): CountingSeam {
  const files: TranscriptFiles = { json: join(assembly.sessionScratchDir, TRANSCRIPT_DOCUMENT_FILE), srt: join(assembly.sessionScratchDir, TRANSCRIPT_SRT_FILE), vtt: join(assembly.sessionScratchDir, TRANSCRIPT_VTT_FILE) };
  const seam = {
    assembleCalls: 0,
    locateCalls: 0,
    closeOutCalls: 0,
    closeOutCodes: [] as string[],
    /** `giveUp` ends the plan with every chunk that is not committed FAILED; then the real assembly. */
    async closeOut(_sessionId: string, options: { readonly chunkCode: string }) {
      seam.closeOutCalls += 1;
      seam.closeOutCodes.push(options.chunkCode);
      if (!(await giveUp(options.chunkCode))) return { kind: 'NOT_READY' as const };
      seam.assembleCalls -= 1;
      return seam.assemble();
    },
    async assemble() {
      seam.assembleCalls += 1;
      try {
        const assembled = await assembleTranscript(assembly);
        const checkpoint = createCheckpointStore(assembly.sessionScratchDir).load(assembly.identity);
        const failedChunkCodes = (checkpoint?.chunks ?? []).filter((chunk) => chunk.status === 'FAILED').map((chunk) => chunk.errorCode ?? 'UNKNOWN');
        return { kind: 'ASSEMBLED' as const, record: assembled.record, files: assembled.files, failedChunkCodes };
      } catch (error) {
        if (error instanceof TranscriberError && error.code === 'ASSEMBLY_REFUSED' && error.detail['reason'] === 'TRANSCRIPT_NOT_COMPLETE') return { kind: 'NOT_READY' as const };
        throw error;
      }
    },
    locate() {
      seam.locateCalls += 1;
      return files;
    },
  };
  return seam;
}

export function transcribedSession(sessionId: string, options: SessionOptions): TranscribedSession {
  const dir = mkdtempSync(join(tmpdir(), 'dems-row79-'));
  const samples = new Int16Array((TOTAL_MS * RATE) / 1000);
  for (const run of RUNS) for (let index = (run.fromMs * RATE) / 1000; index < (run.toMs * RATE) / 1000; index += 1) samples[index] = 3_000;
  const path = join(dir, 'audio.wav');
  writeFileSync(path, encodeWavPcm16(samples, RATE));

  const backend = options.backend ?? 'cpu-local';
  const perRun = options.segmentsPerRun ?? 2;
  const decoded: number[] = [];
  const refused: number[] = [];
  const queue = new SerialQueue();
  const adapter: TranscriberAdapter = {
    backend,
    model: 'ggml-large-v3-turbo',
    queue,
    transcribe: (chunk) =>
      queue.run(async () => {
        decoded.push(chunk.offsetMs);
        await options.engineGate?.(chunk.offsetMs);
        const failure = options.fail?.(chunk.offsetMs) ?? null;
        if (failure !== null) throw failure;
        const inside = RUNS.filter((run) => run.fromMs >= chunk.offsetMs && run.toMs <= chunk.offsetMs + chunk.durationMs);
        const segments = inside.flatMap((run) => {
          const length = (run.toMs - run.fromMs) / perRun;
          return Array.from({ length: perRun }, (_, part) => ({ start: (run.fromMs + part * length - chunk.offsetMs) / 1000, end: (run.fromMs + (part + 1) * length - chunk.offsetMs) / 1000, text: `Keterangan saksi ${run.fromMs / 1000}-${part}.` }));
        });
        return { engine: backend, model: 'ggml-large-v3-turbo', language: 'id' as const, text: 'ucapan', segments: segments.map((segment, id) => ({ id, ...segment })) };
      }),
  };
  const timeline = decodedFileTimeline(RATE);
  const source = openPcmSource({ container: 'wav', path, sampleRateHz: RATE });
  const log = createMemoryLog();
  const runner = createTranscriptRunner({ sessionId, adapter, timeline, source, vad, sessionScratchDir: dir, log, mirror: options.mirror, tapLost: options.tapLost === true ? () => true : NO_TAP_SIGNAL, ...(options.shouldPause === undefined ? {} : { shouldPause: options.shouldPause }) });
  const assembly: AssembleTranscriptOptions = {
    sessionScratchDir: dir,
    identity: { sessionId, backend: adapter.backend, model: adapter.model, timeline },
    source,
    diarization: { enabled: true, engine: options.diarizer === undefined ? twoSpeakers : options.diarizer },
    // Decision D160: a SERVER backend states the model NAME only (version / quantisation / hash are null); `cpu-local` (the default here) carries all four.
    model: backend === 'omlx-server' ? { name: MODEL.name, version: null, quantisation: null, sha256: null } : MODEL,
    intervals: [{ source: 'MIC-01', fromMs: 0, toMs: null }],
    log,
  };
  /**
   * THE CLOSE-OUT (row 116), on the public pipeline: a NEW runner on the same scratch directory,
   * with an engine that refuses every chunk at once and its own queue (the engine of the session
   * may be hanging in the other one). It decodes nothing; `refused` counts what it was asked.
   */
  const giveUp = async (chunkCode: string): Promise<boolean> => {
    const refusing: TranscriberAdapter = {
      backend,
      model: adapter.model,
      queue: new SerialQueue(),
      transcribe: async (chunk) => {
        refused.push(chunk.offsetMs);
        throw new TranscriberError(chunkCode as ConstructorParameters<typeof TranscriberError>[0], 'the seal stopped waiting for this chunk', { reason: 'SEAL_WAIT_LIMIT' });
      },
    };
    const closing = createTranscriptRunner({ sessionId, adapter: refusing, timeline, source, vad, sessionScratchDir: dir, log, mirror: options.mirror, tapLost: options.tapLost === true ? () => true : NO_TAP_SIGNAL });
    return (await closing.step({ final: true })).complete;
  };
  const seam = transcriberSeam(assembly, giveUp);
  return {
    sessionId,
    dir,
    runner,
    finish: async () => {
      const report = await runner.step({ final: true });
      if (!report.complete) throw new Error('the stand-in transcript did not finish');
    },
    seam,
    freshSeam: () => transcriberSeam(assembly, giveUp),
    files: { json: join(dir, TRANSCRIPT_DOCUMENT_FILE), srt: join(dir, TRANSCRIPT_SRT_FILE), vtt: join(dir, TRANSCRIPT_VTT_FILE) },
    checkpoint: () => {
      const stored = createCheckpointStore(dir).load(assembly.identity);
      if (stored === null) throw new Error('no checkpoint');
      return stored;
    },
    assembly,
    decoded,
    refused,
  };
}

/**
 * THE CLOCK OF A TEST (row 116): `now` and the timers of the step's bounds on one hand-moved
 * time. Nothing here waits on the wall clock; `advance` fires what became due, in order.
 */
export interface ManualClock {
  readonly timer: StepTimer;
  now(): number;
  /** Moves the time by `ms` (a negative value sets the clock back; no timer fires then). */
  advance(ms: number): void;
  /** Moves the time to the earliest armed timer and fires it. */
  fireNext(): void;
  /** Timers armed and not yet fired or cancelled. */
  armed(): number;
  /** Resolves once at least one timer is armed (the step is waiting on a bound). No wall time is asserted. */
  untilArmed(): Promise<void>;
}

export function manualClock(start = 1_791_529_000_000): ManualClock {
  let time = start;
  let order = 0;
  const timers = new Map<number, { readonly at: number; readonly fire: () => void }>();
  const clock: ManualClock = {
    timer: {
      after(ms, fire) {
        const id = (order += 1);
        timers.set(id, { at: time + ms, fire });
        return () => void timers.delete(id);
      },
    },
    now: () => time,
    advance(ms) {
      const until = time + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (due === undefined) break;
        timers.delete(due[0]);
        time = Math.max(time, due[1].at);
        due[1].fire();
      }
      time = until;
    },
    fireNext() {
      const next = [...timers.values()].sort((a, b) => a.at - b.at)[0];
      if (next !== undefined) clock.advance(Math.max(0, next.at - time));
    },
    armed: () => timers.size,
    async untilArmed() {
      while (timers.size === 0) await new Promise<void>((resolve) => setImmediate(resolve));
    },
  };
  return clock;
}

/** `closeOut` of a stand-in seam that a test never lets reach its waiting limit. */
export const noCloseOut = async (): Promise<never> => {
  throw new Error('this test does not close a transcript out');
};

/** The persistent error log of the Core, kept in memory. */
export function memoryErrorLog(): ErrorLog & { readonly entries: ErrorLogEntry[] } {
  const entries: ErrorLogEntry[] = [];
  return { file: null, entries, append: (entry) => void entries.push(entry) };
}

/** `sealing_jobs` in memory, with the table's rule that `started_at` is written once. */
export function memoryJournal(): SealingStepJournal & { readonly rows: Map<string, SealingStepRecord>; readonly writes: SealingStepWrite[]; failNextWrite: ((write: SealingStepWrite) => boolean) | null } {
  const rows = new Map<string, SealingStepRecord>();
  const writes: SealingStepWrite[] = [];
  const journal = {
    rows,
    writes,
    failNextWrite: null as ((write: SealingStepWrite) => boolean) | null,
    async read(sessionId: string, step: string) {
      const row = rows.get(`${sessionId}#${step}`);
      return row === undefined ? null : structuredClone(row);
    },
    async write(write: SealingStepWrite) {
      if (journal.failNextWrite?.(write) === true) {
        journal.failNextWrite = null;
        throw new Error('the process was stopped before this write');
      }
      writes.push(structuredClone(write));
      const { at, ...record } = structuredClone(write);
      const key = `${write.sessionId}#${write.step}`;
      rows.set(key, { ...record, startedAt: rows.get(key)?.startedAt ?? at, updatedAt: at });
    },
  };
  return journal;
}
