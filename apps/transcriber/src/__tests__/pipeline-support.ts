// Stand-ins for the pipeline tests of row 77 (not a test file). No real engine, model or server:
//
//   - a synthetic "tap": 48 kHz mono signed 16-bit samples in a raw file, silence with bursts of a
//     tone at KNOWN sample positions (so that a time on the timeline can be checked to the sample);
//   - a stand-in VAD that finds those bursts by reading the WAV it is handed (in process), and a
//     stand-in VAD PROGRAM that prints what whisper.cpp's `vad-speech-segments` prints;
//   - a stand-in STT engine PROGRAM for the kill harness: it writes one line per start into a
//     journal, so a test can count how often every chunk was decoded, and it can be told to hold
//     or to fail on a chunk;
//   - an in-process adapter for the tests that need no process.
import { appendFileSync, chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TranscriberAdapter } from '../adapter';
import { SerialQueue } from '../cpu-priority';
import { tableRefusal, type ChunkMirror, type ChunkMirrorRow } from '../pipeline/mirror';
import type { SpeechSpan, VoiceActivityDetector } from '../pipeline/silero-vad';
import { TranscriberError, TranscriberErrorCode, type TranscribeResult, type TranscriberChunk } from '../types';
import { readWavFacts } from '../wav';
import { TEST_PRIORITY_MODE, scratchDir } from './support';

export const TAP_RATE = 48_000;
export const SESSION = 'SES-20261009-0077';

/** A burst of tone inside silence: `[from, to)` in samples. */
export interface Burst {
  readonly from: number;
  readonly to: number;
}

/** PCM of `total` samples: zero, with a tone inside every burst. */
export function tonePcm(total: number, bursts: readonly Burst[]): Int16Array {
  const samples = new Int16Array(total);
  for (const burst of bursts) for (let index = burst.from; index < Math.min(burst.to, total); index += 1) samples[index] = 4_000 + Math.round(2_000 * Math.sin(index / 7));
  return samples;
}

export function pcmBytes(samples: Int16Array): Buffer {
  const bytes = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index += 1) bytes.writeInt16LE(samples[index] ?? 0, index * 2);
  return bytes;
}

/** Writes a raw tap file and returns its path. */
export function writeTap(dir: string, samples: Int16Array, name = 'tap.pcm'): string {
  const path = join(dir, name);
  writeFileSync(path, pcmBytes(samples));
  return path;
}

/** Appends samples to a tap file, as the capture worker does while it records. */
export function growTap(path: string, samples: Int16Array): void {
  appendFileSync(path, pcmBytes(samples));
}

/** The runs of non-zero samples of a WAV file, as speech spans in milliseconds from its first sample. */
export function burstsOfWav(path: string): SpeechSpan[] {
  const bytes = readFileSync(path);
  const facts = readWavFacts(bytes);
  const count = facts.dataBytes / 2;
  const spans: SpeechSpan[] = [];
  let start = -1;
  for (let index = 0; index <= count; index += 1) {
    const loud = index < count && bytes.readInt16LE(facts.dataOffset + index * 2) !== 0;
    if (loud && start < 0) start = index;
    if (!loud && start >= 0) {
      spans.push({ fromMs: (start * 1000) / facts.sampleRateHz, toMs: (index * 1000) / facts.sampleRateHz });
      start = -1;
    }
  }
  return spans;
}

export interface StubVad extends VoiceActivityDetector {
  /** How many windows the VAD was asked about. */
  readonly calls: number[];
}

/** A VAD that answers with the tone bursts of the window. `failing`: it throws `VAD_FAILED` instead. */
export function createStubVad(options: { failing?: boolean } = {}): StubVad {
  const calls: number[] = [];
  return {
    calls,
    async detect(wavPath) {
      calls.push(calls.length);
      if (options.failing === true) throw new TranscriberError(TranscriberErrorCode.VAD_FAILED, 'the VAD engine gave no usable answer', { reason: 'STAND_IN_FAILURE' });
      return burstsOfWav(wavPath);
    },
  };
}

export interface StubAdapter extends TranscriberAdapter {
  /** The media-time offset of every chunk the adapter was asked to decode, in call order. */
  readonly decodedOffsets: number[];
  /** Makes the next `count` calls for the chunk at `offsetMs` fail. */
  failChunk(offsetMs: number, count: number): void;
  /** What the engine answers for a chunk: default, one segment over the whole chunk. */
  answer: (chunk: TranscriberChunk) => TranscribeResult['segments'];
}

export function createStubAdapter(backend: TranscriberAdapter['backend'] = 'cpu-local', model = 'stand-in-model'): StubAdapter {
  const decodedOffsets: number[] = [];
  const failures = new Map<number, number>();
  const queue = new SerialQueue();
  const adapter: StubAdapter = {
    backend,
    model,
    queue,
    // An in-process stand-in starts no engine: there is no worker to outrank, and it says so (N-10).
    captureWorkerStated: true,
    decodedOffsets,
    answer: (chunk) => [{ id: 0, start: 0, end: chunk.durationMs / 1000, text: `ucapan pada ${chunk.offsetMs}` }],
    failChunk(offsetMs, count) {
      failures.set(offsetMs, count);
    },
    transcribe: (chunk) =>
      queue.run(async () => {
        decodedOffsets.push(chunk.offsetMs);
        const left = failures.get(chunk.offsetMs) ?? 0;
        if (left > 0) {
          failures.set(chunk.offsetMs, left - 1);
          throw new TranscriberError(TranscriberErrorCode.ENGINE_FAILED, 'the stand-in engine ended with an error', { reason: 'STAND_IN_FAILURE' });
        }
        const segments = adapter.answer(chunk);
        return { engine: backend, model, language: 'id' as const, text: segments.map((segment) => segment.text).join(' '), segments };
      }),
  };
  return adapter;
}

// ───────────────────────────────────────────────────────────────────────────────────────
// Stand-in PROGRAMS (real processes)
// ───────────────────────────────────────────────────────────────────────────────────────

const JOURNAL_ENGINE = `#!${process.execPath}
// A stand-in for whisper-cli that keeps a journal. One line per START: the name of the chunk file,
// the SHA-256 of its bytes, its own process id and the niceness it finds itself at.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const home = path.dirname(process.argv[1]);
const audio = value('-f');
const name = path.basename(audio);
if (!args.includes('-ng')) { process.stderr.write('refusing to run without -ng'); process.exit(9); }
const bytes = fs.readFileSync(audio);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
fs.appendFileSync(path.join(home, 'journal.jsonl'), JSON.stringify({ name, sha, pid: process.pid, nice: os.getPriority() }) + '\\n');
let control = {};
try { control = JSON.parse(fs.readFileSync(path.join(home, 'control.json'), 'utf8')); } catch {}
if (control.holdOn === name) { setInterval(() => {}, 1000); return; }
if ((control.failOn || []).includes(name)) { process.stderr.write('engine fault'); process.exit(3); }
const seconds = (bytes.length - 44) / 2 / bytes.readUInt32LE(24);
fs.writeFileSync(value('-of') + '.json', JSON.stringify({
  result: { language: value('-l') },
  transcription: [{ offsets: { from: 0, to: Math.round(seconds * 1000) }, text: ' ucapan ' + sha.slice(0, 12) }],
}));
`;

const VAD_PROGRAM = `#!${process.execPath}
// A stand-in for whisper.cpp's vad-speech-segments: it prints the runs of non-zero samples of the
// WAV it is given, in CENTISECONDS, in the program's own output form. It behaves by the NAME of
// the model file.
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const home = path.dirname(process.argv[1]);
fs.writeFileSync(path.join(home, 'vad-last-argv.json'), JSON.stringify(args));
fs.writeFileSync(path.join(home, 'vad-last-nice.json'), JSON.stringify(require('node:os').getPriority()));
const model = path.basename(value('-vm') || '');
if (model.includes('exit3')) { process.stderr.write('vad fault'); process.exit(3); }
if (model.includes('garbage')) { process.stdout.write('Detected 2 speech segments:\\nSpeech segment 0: start = 1.00, end = 2.00\\n'); process.exit(0); }
if (model.includes('backwards')) { process.stdout.write('Detected 1 speech segments:\\nSpeech segment 0: start = 9.00, end = 2.00\\n'); process.exit(0); }
const bytes = fs.readFileSync(value('-f'));
const rate = bytes.readUInt32LE(24);
const count = (bytes.length - 44) / 2;
const spans = [];
let start = -1;
for (let i = 0; i <= count; i += 1) {
  const loud = i < count && bytes.readInt16LE(44 + i * 2) !== 0;
  if (loud && start < 0) start = i;
  if (!loud && start >= 0) { spans.push([start * 100 / rate, i * 100 / rate]); start = -1; }
}
let out = '\\nDetected ' + spans.length + ' speech segments:\\n';
spans.forEach((span, i) => { out += 'Speech segment ' + i + ': start = ' + span[0].toFixed(2) + ', end = ' + span[1].toFixed(2) + '\\n'; });
process.stdout.write(out + '\\n');
`;

export interface JournalEntry {
  readonly name: string;
  readonly sha: string;
  readonly pid: number;
  readonly nice: number;
}

export interface ProgramHome {
  readonly root: string;
  readonly engineBinary: string;
  readonly vadBinary: string;
  readonly modelDir: string;
  readonly workDir: string;
  /** Creates the (empty) model file of this identifier and returns the identifier. */
  model(id: string): string;
  journal(): JournalEntry[];
  control(value: { holdOn?: string; failOn?: string[] }): void;
  vadLastArgv(): string[] | null;
  vadLastNice(): number | null;
  readonly priority: typeof TEST_PRIORITY_MODE;
}

export function createProgramHome(root: string = scratchDir('pipeline')): ProgramHome {
  const engineBinary = join(root, 'journal-whisper-cli');
  const vadBinary = join(root, 'stand-in-vad');
  const modelDir = join(root, 'models');
  const workDir = join(root, 'work');
  mkdirSync(modelDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  writeFileSync(engineBinary, JOURNAL_ENGINE);
  chmodSync(engineBinary, 0o755);
  writeFileSync(vadBinary, VAD_PROGRAM);
  chmodSync(vadBinary, 0o755);
  const readJson = <T>(name: string): T | null => {
    try {
      return JSON.parse(readFileSync(join(root, name), 'utf8')) as T;
    } catch {
      return null;
    }
  };
  return {
    root,
    engineBinary,
    vadBinary,
    modelDir,
    workDir,
    priority: TEST_PRIORITY_MODE,
    model(id) {
      writeFileSync(join(modelDir, `${id}.bin`), '');
      return id;
    },
    journal() {
      try {
        return readFileSync(join(root, 'journal.jsonl'), 'utf8')
          .split('\n')
          .filter((line) => line !== '')
          .map((line) => JSON.parse(line) as JournalEntry);
      } catch {
        return [];
      }
    },
    control(value) {
      writeFileSync(join(root, 'control.json'), JSON.stringify(value));
    },
    vadLastArgv: () => readJson<string[]>('vad-last-argv.json'),
    vadLastNice: () => readJson<number>('vad-last-nice.json'),
  };
}

/**
 * A mirror that keeps its rows in a FILE, for the kill harness: what a killed process wrote is
 * still there for the next one, as rows of a database are. It refuses what the table refuses.
 */
export function createFileChunkMirror(path: string): ChunkMirror & { rows(): ChunkMirrorRow[] } {
  const rows = (): ChunkMirrorRow[] => {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as ChunkMirrorRow[];
    } catch {
      return [];
    }
  };
  const store = (next: ChunkMirrorRow[]): void => {
    for (const row of next) {
      const refusal = tableRefusal(row);
      if (refusal !== null) throw Object.assign(new Error(`new row violates check constraint "${refusal}"`), { code: '23514', constraint: refusal });
    }
    writeFileSync(`${path}.next`, JSON.stringify(next.sort((a, b) => a.seq - b.seq)));
    renameSync(`${path}.next`, path);
  };
  return {
    rows,
    async insertMissing(incoming) {
      const current = rows();
      store([...current, ...incoming.filter((row) => !current.some((known) => known.sessionId === row.sessionId && known.seq === row.seq))]);
    },
    async update(sessionId, seq, patch) {
      const current = rows();
      if (!current.some((row) => row.sessionId === sessionId && row.seq === seq)) throw new Error('no such row');
      store(current.map((row) => (row.sessionId === sessionId && row.seq === seq ? { ...row, ...patch } : row)));
    },
    async read(sessionId) {
      return rows().filter((row) => row.sessionId === sessionId);
    },
  };
}
