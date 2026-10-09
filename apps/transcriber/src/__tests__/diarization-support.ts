// Stand-ins for the speaker-labelling and assembly tests of row 78 (not a test file). No model and
// no real engine:
//
//   - an in-process `SpeakerEmbeddingEngine` that answers with the vectors a test hands it and
//     records what it was given (rate, spans, size of the audio file);
//   - a stand-in embedding PROGRAM (a real process) that prints what `dems-speaker-embed` prints,
//     keeps a journal of every start (arguments, niceness, spans) and behaves by the NAME of the
//     model file;
//   - a finished transcript: the real runner of row 77 over a synthetic tap with a stand-in VAD
//     and a stand-in adapter.
import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_CAPTURE_WORKER } from '../backends/cpu-local';
import { createMemoryLog, type MemoryLog } from '../log';
import { openPcmSource, type PcmSource } from '../pipeline/audio-source';
import { CheckpointSchema, type Checkpoint, type CheckpointIdentity } from '../pipeline/checkpoint';
import { TRANSCRIPT_CHECKPOINT_FILE } from '../pipeline/constants';
import type { DiarizationEngineFacts, SpeakerEmbedding, SpeakerEmbeddingEngine } from '../pipeline/diarization';
import type { TranscriptModelProvenance } from '../pipeline/document';
import { captureTapTimeline, type SampleRange } from '../pipeline/media-time';
import { NO_TAP, createTranscriptRunner, type TranscriptRunner, type TranscriptRunnerOptions } from '../pipeline/runner';
import { SESSION, TAP_RATE, createStubAdapter, createStubVad, tonePcm, writeTap, type Burst, type StubAdapter } from './pipeline-support';
import { TEST_PRIORITY_MODE, scratchDir } from './support';

export const STUB_FACTS: DiarizationEngineFacts = { engine: 'stand-in-embedder', embeddingModel: 'stand-in-embedding', embeddingModelSha256: 'b'.repeat(64) };

export const MODEL_PROVENANCE: TranscriptModelProvenance = { name: 'stand-in-model', version: '1', quantisation: 'none', sha256: 'c'.repeat(64) };

/**
 * A made-up "voice": a direction in four dimensions with a small, FIXED wobble per take (no random
 * number). Two takes of one voice have a cosine near 1; takes of voices 0 and 1 a cosine near 0.
 */
export function voice(which: 0 | 1 | 2, take = 0, wobble = 0.08): number[] {
  const vector = [0, 0, 0, 0];
  vector[which] = 3;
  vector[3] = wobble * 3 * (((take * 7) % 5) - 2);
  vector[(which + 1) % 3] = wobble * 3 * (((take * 3) % 4) - 1.5);
  return vector;
}

/** Voices 0 and 1 taking turns: the embeddings of a two-speaker conversation. */
export const alternatingVoices = (count: number, wobble = 0.08): number[][] => Array.from({ length: count }, (_, index) => voice((index % 2) as 0 | 1, index, wobble));

/**
 * Two voices that ARE two tight-enough groups far enough apart, yet not clearly enough for a
 * label: every take adds a direction of its own. By construction (3 takes per voice, centres 60
 * degrees apart, own part of length sqrt(2/3)): spread 0.4 inside a voice, separation 0.59,
 * silhouette 0.43 — the one condition that fails is the confidence.
 */
export function looseVoices(): number[][] {
  const own = Math.sqrt(2 / 3);
  return Array.from({ length: 6 }, (_, index) => {
    const vector: number[] = Array.from({ length: 8 }, () => 0);
    if (index % 2 === 0) vector[0] = 1;
    else [vector[0], vector[1]] = [0.5, Math.sqrt(0.75)];
    vector[2 + index] = own;
    return vector;
  });
}

export interface StubEmbedder extends SpeakerEmbeddingEngine {
  /** What every call was handed. */
  readonly calls: { sampleRateHz: number; spans: SampleRange[]; pcmBytes: number }[];
  vectors: readonly SpeakerEmbedding[];
  /** When set, the next calls throw it. */
  failure: Error | null;
}

export function createStubEmbedder(vectors: readonly SpeakerEmbedding[] = []): StubEmbedder {
  const engine: StubEmbedder = {
    calls: [],
    vectors,
    failure: null,
    async embed(pcmPath, sampleRateHz, spans) {
      engine.calls.push({ sampleRateHz, spans: spans.map((span) => ({ ...span })), pcmBytes: statSync(pcmPath).size });
      if (engine.failure !== null) throw engine.failure;
      return { vectors: engine.vectors.slice(0, spans.length), facts: STUB_FACTS };
    },
  };
  return engine;
}

const EMBED_PROGRAM = `#!${process.execPath}
// A stand-in for dems-speaker-embed. It prints the helper's own output form; the vectors come from
// vectors.json beside this file. It behaves by the NAME of the model file.
const fs = require('node:fs');
const path = require('node:path');
const home = path.dirname(process.argv[1]);
const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const spans = fs.readFileSync(value('--spans'), 'utf8').split('\\n').filter((line) => line !== '');
fs.appendFileSync(path.join(home, 'embed-journal.jsonl'), JSON.stringify({ args, nice: require('node:os').getPriority(), spans, pcmBytes: fs.statSync(value('--pcm')).size }) + '\\n');
const model = path.basename(value('--model') || '');
process.stderr.write('Creating a resampler\\n');
if (model.includes('exit3')) { process.stderr.write('the embedding model could not be loaded'); process.exit(3); }
if (model.includes('hold')) { setInterval(() => {}, 1000); return; }
const vectors = JSON.parse(fs.readFileSync(path.join(home, 'vectors.json'), 'utf8'));
let out = 'dems-speaker-embed 1\\ndim ' + (model.includes('baddim') ? 9 : 4) + '\\n';
spans.forEach((_, i) => { out += vectors[i] === null ? i + ' short\\n' : i + ' ok ' + vectors[i].join(' ') + '\\n'; });
if (model.includes('garbage')) out += 'something else\\n';
if (!model.includes('noend')) out += 'end ' + spans.length + '\\n';
process.stdout.write(out);
`;

export interface EmbedJournalEntry {
  readonly args: string[];
  readonly nice: number;
  readonly spans: string[];
  readonly pcmBytes: number;
}

export interface EmbedHome {
  readonly root: string;
  readonly binary: string;
  readonly priority: typeof TEST_PRIORITY_MODE;
  /** Creates a model file of this name (with these bytes) in a directory under the home and returns its path. */
  modelFile(name: string, content?: string, directory?: string): string;
  setVectors(vectors: readonly SpeakerEmbedding[]): void;
  journal(): EmbedJournalEntry[];
}

export function createEmbedHome(root: string = scratchDir('diarization')): EmbedHome {
  const binary = join(root, 'stand-in-speaker-embed');
  writeFileSync(binary, EMBED_PROGRAM);
  chmodSync(binary, 0o755);
  return {
    root,
    binary,
    priority: TEST_PRIORITY_MODE,
    modelFile(name, content = `model ${name}`, directory = 'models') {
      mkdirSync(join(root, directory), { recursive: true });
      const path = join(root, directory, name);
      writeFileSync(path, content);
      return path;
    },
    setVectors(vectors) {
      writeFileSync(join(root, 'vectors.json'), JSON.stringify(vectors));
    },
    journal() {
      try {
        return readFileSync(join(root, 'embed-journal.jsonl'), 'utf8')
          .split('\n')
          .filter((line) => line !== '')
          .map((line) => JSON.parse(line) as EmbedJournalEntry);
      } catch {
        return [];
      }
    },
  };
}

export { NO_CAPTURE_WORKER };

const SECOND = TAP_RATE;
/** Six bursts of 4 s of "speech", 1 s apart: one chunk whose stand-in answer is one segment per burst. */
export const SIX_BURSTS: readonly Burst[] = [0, 1, 2, 3, 4, 5].map((index) => ({ from: (1 + index * 5) * SECOND, to: (5 + index * 5) * SECOND }));
export const SIX_TOTAL = 32 * SECOND;

export interface FinishedTranscript {
  readonly dir: string;
  readonly tapPath: string;
  readonly identity: CheckpointIdentity;
  readonly source: PcmSource;
  readonly adapter: StubAdapter;
  readonly log: MemoryLog;
  readonly runner: TranscriptRunner;
  stored(): Checkpoint;
}

/**
 * The real runner over a synthetic tap. The stand-in adapter answers one segment per burst of the
 * chunk it is given (so a transcript of six bursts has six segments). `finish: false` leaves the
 * transcript planned but not decoded.
 */
export async function transcriptOf(options: { bursts?: readonly Burst[]; total?: number; finish?: boolean; runner?: Partial<TranscriptRunnerOptions>; prepare?: (adapter: StubAdapter) => void } = {}): Promise<FinishedTranscript> {
  const bursts = options.bursts ?? SIX_BURSTS;
  const dir = scratchDir('assembly');
  const tapPath = writeTap(dir, tonePcm(options.total ?? SIX_TOTAL, bursts));
  const timeline = captureTapTimeline();
  const adapter = createStubAdapter();
  // One segment per burst that lies inside the chunk: seconds from the first sample of the chunk.
  adapter.answer = (chunk) => {
    const originMs = (timeline.originSamples * 1000) / TAP_RATE;
    return bursts
      .map((burst) => ({ fromMs: (burst.from * 1000) / TAP_RATE + originMs, toMs: (burst.to * 1000) / TAP_RATE + originMs }))
      .filter((burst) => burst.fromMs >= chunk.offsetMs - 1 && burst.toMs <= chunk.offsetMs + chunk.durationMs + 1)
      .map((burst, id) => ({ id, start: Math.max(0, (burst.fromMs - chunk.offsetMs) / 1000), end: (burst.toMs - chunk.offsetMs) / 1000, text: `ucapan ke-${Math.round(burst.fromMs)}` }));
  };
  options.prepare?.(adapter);
  const log = createMemoryLog();
  const source = openPcmSource({ container: 'raw', path: tapPath, sampleRateHz: TAP_RATE });
  const identity: CheckpointIdentity = { sessionId: SESSION, backend: adapter.backend, model: adapter.model, timeline };
  const runner = createTranscriptRunner({ sessionId: SESSION, adapter, timeline, source, vad: createStubVad(), sessionScratchDir: dir, log, tapLost: NO_TAP, now: () => new Date('2026-10-09T08:00:00.000Z'), ...options.runner });
  if (options.finish !== false) await runner.step({ final: true });
  return { dir, tapPath, identity, source, adapter, log, runner, stored: () => CheckpointSchema.parse(JSON.parse(readFileSync(join(dir, TRANSCRIPT_CHECKPOINT_FILE), 'utf8'))) };
}
