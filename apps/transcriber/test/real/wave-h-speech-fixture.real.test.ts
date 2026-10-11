// Fix wave H, driver E (ruling D198 on gate 81; condition C1, the ENGINE HALF of `M6-TF-1` outside
// a session): the transcript pipeline's own entry - real Silero VAD chunking, `whisper-cli -ng` per
// chunk through the adapter, checkpoints - on the SPEECH FIXTURE the development speech microphone
// plays (`.data/dev-fixtures/speech-mic/dialogue.wav`, synthetic speech made on this machine by
// `npm run capture:dev-setup`).
//
// It proves, on the real engine and the CPU: chunks are planned (> 0), segments come back (> 0),
// language `id`, and `-ng` is in every command the pipeline issued. It compares the words with the
// reference text kept beside the fixture and writes the DIFFERING WORDS, nothing else: no duration,
// no speed, no rate is measured or written anywhere (D230).
//
// NOT proven here: anything of a product SESSION (the tap, the per-chunk audio source, the seal).
//
// ONE run, alone, outside the sandbox, under the heavy-host lock:
//   /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock npx vitest run --root apps/transcriber --config vitest.real.config.ts test/real/wave-h-speech-fixture.real.test.ts
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { getPriority } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectedEngineNice } from '../../src/cpu-priority';
import { CheckpointSchema } from '../../src/pipeline/checkpoint';
import { QaFlag, TRANSCRIPT_CHECKPOINT_FILE } from '../../src/pipeline/constants';
import { MODEL_DIR, SPEECH_MIC_FIXTURE, SPEECH_MIC_REFERENCE, VAD_BINARY, WAVE_H_RUNS_DIR, WHISPER_CLI, createRunDir, writeEvidence } from './real-support';

const WORKSPACE = resolve(import.meta.dirname, '..', '..');
const CHILD = join(import.meta.dirname, 'speech-fixture-pipeline-child.ts');
const PRESENT = existsSync(SPEECH_MIC_FIXTURE) && existsSync(SPEECH_MIC_REFERENCE);

interface Reference {
  readonly sha256: string;
  readonly bytes: number;
  readonly language: string;
  readonly turns: readonly { readonly id: string; readonly speaker: string; readonly text: string }[];
  readonly text: string;
}
interface JournalLine {
  readonly event: string;
  readonly seq?: number;
  readonly argv?: string[];
  readonly status?: number | null;
  readonly rawSha256?: string;
  readonly nice?: number | null;
  readonly spans?: number | null;
}

/** Words as a reader compares them: lower case, no punctuation. */
export const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter((word) => word !== '');

/** The words of `reference` that `heard` lacks and the words `heard` adds, by the longest common subsequence. */
export function differingWords(reference: readonly string[], heard: readonly string[]): { readonly missing: string[]; readonly added: string[] } {
  const rows = reference.length + 1;
  const columns = heard.length + 1;
  const table = new Uint32Array(rows * columns);
  for (let row = reference.length - 1; row >= 0; row -= 1) {
    for (let column = heard.length - 1; column >= 0; column -= 1) {
      table[row * columns + column] = reference[row] === heard[column] ? (table[(row + 1) * columns + column + 1] ?? 0) + 1 : Math.max(table[(row + 1) * columns + column] ?? 0, table[row * columns + column + 1] ?? 0);
    }
  }
  const missing: string[] = [];
  const added: string[] = [];
  let row = 0;
  let column = 0;
  while (row < reference.length && column < heard.length) {
    if (reference[row] === heard[column]) {
      row += 1;
      column += 1;
    } else if ((table[(row + 1) * columns + column] ?? 0) >= (table[row * columns + column + 1] ?? 0)) {
      missing.push(reference[row] ?? '');
      row += 1;
    } else {
      added.push(heard[column] ?? '');
      column += 1;
    }
  }
  missing.push(...reference.slice(row));
  added.push(...heard.slice(column));
  return { missing, added };
}

describe('the word comparison itself (it must be able to find a difference)', () => {
  it('equal texts differ in nothing; a changed, a dropped and an added word are each named', () => {
    expect(differingWords(wordsOf('Selamat pagi, terima kasih.'), wordsOf('selamat pagi terima kasih'))).toEqual({ missing: [], added: [] });
    expect(differingWords(wordsOf('kerja sama yang baik'), wordsOf('kerjasama baik sekali'))).toEqual({ missing: ['kerja', 'sama', 'yang'], added: ['kerjasama', 'sekali'] });
  });
});

describe.skipIf(!PRESENT)('wave H: the pipeline on cpu-local over the speech fixture of the development speech microphone', () => {
  it('chunks are planned, every chunk is decoded by `whisper-cli -ng`, segments come back in Indonesian; the differing words are written, no timing', async () => {
    const reference = JSON.parse(readFileSync(SPEECH_MIC_REFERENCE, 'utf8')) as Reference;
    const bytes = readFileSync(SPEECH_MIC_FIXTURE);
    // The audio is the one its reference text was written for.
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(reference.sha256);
    expect(bytes.length).toBe(reference.bytes);
    expect(reference.language).toBe('id');

    const evidenceDir = createRunDir('wave-h-speech-fixture', WAVE_H_RUNS_DIR);
    const scratch = join(evidenceDir, 'run1');
    const parentNice = getPriority();
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((done) => {
      const child = spawn(process.execPath, ['--import', 'tsx', CHILD, scratch, 'report.json'], { cwd: WORKSPACE, stdio: 'ignore' });
      child.once('exit', (code, signal) => done({ code, signal }));
    });
    expect(exit).toEqual({ code: 0, signal: null });

    const report = JSON.parse(readFileSync(join(scratch, 'report.json'), 'utf8')) as Record<string, unknown>;
    const checkpoint = CheckpointSchema.parse(JSON.parse(readFileSync(join(scratch, TRANSCRIPT_CHECKPOINT_FILE), 'utf8')));
    const journal = readFileSync(join(scratch, 'engine-journal.jsonl'), 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as JournalLine);
    const runs = journal.filter((line) => line.event === 'stt-run');
    const vadRuns = journal.filter((line) => line.event === 'vad-run');
    const segments = checkpoint.chunks.flatMap((chunk) => chunk.segments ?? []);

    // Chunks planned > 0, each decoded once, none failed.
    expect(report).toMatchObject({ failed: 0, remaining: 0, paused: false, complete: true });
    expect(checkpoint.chunks.length).toBeGreaterThan(0);
    expect(report['planned']).toBe(checkpoint.chunks.length);
    expect(checkpoint.chunks.map((chunk) => chunk.status)).toEqual(checkpoint.chunks.map(() => 'DONE'));
    expect(runs).toHaveLength(checkpoint.chunks.length);
    expect(checkpoint.backend).toBe('cpu-local');
    expect(checkpoint.language).toBe('id');
    expect(checkpoint.qaFlags).not.toContain(QaFlag.VAD_FALLBACK);
    // Segments > 0, each with a span and text.
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(segment.endMs).toBeGreaterThan(segment.startMs);
      expect(segment.text.trim()).not.toBe('');
    }
    // The command the pipeline issued: through `nice`, the GPU-off build, `-ng` on EVERY run.
    for (const run of runs) {
      expect(run.argv?.slice(0, 7)).toEqual(['/usr/bin/nice', '-n', '10', WHISPER_CLI, '-m', join(MODEL_DIR, 'ggml-large-v3-turbo.bin'), '-ng']);
      expect(run.argv).toContain('-ng');
      expect(run.argv?.slice(7, 12)).toEqual(['-t', '8', '-l', 'id', '-oj']);
      expect(run.status).toBe(0);
      expect(run.nice).toBe(expectedEngineNice(parentNice));
    }
    // The voice-activity engine ran once, lowered, with no GPU switch.
    expect(vadRuns).toHaveLength(1);
    expect(vadRuns[0]?.argv?.slice(0, 4)).toEqual(['/usr/bin/nice', '-n', '10', VAD_BINARY]);
    expect(vadRuns[0]?.argv?.filter((argument) => argument === '-ug' || argument === '--use-gpu')).toEqual([]);
    expect(vadRuns[0]?.status).toBe(0);

    const heard = segments.map((segment) => segment.text.trim()).join(' ');
    const difference = differingWords(wordsOf(reference.text), wordsOf(heard));
    writeEvidence(evidenceDir, 'evidence.json', {
      check: 'fix wave H driver E: the engine half of M6-TF-1 on cpu-local, outside a session, on the speech fixture of the development speech microphone',
      audio: 'DECODED_FILE: .data/dev-fixtures/speech-mic/dialogue.wav (synthetic speech made on this machine; read, never played)',
      fixtureSha256: reference.sha256,
      report,
      chunksPlanned: checkpoint.chunks.length,
      chunkStatuses: checkpoint.chunks.map((chunk) => chunk.status),
      segments: segments.length,
      scriptedSentences: reference.turns.length,
      language: checkpoint.language,
      qaFlags: checkpoint.qaFlags,
      vadCommand: vadRuns[0]?.argv,
      vadSpeechRuns: vadRuns[0]?.spans,
      sttCommands: runs.map((run) => ({ seq: run.seq, argv: run.argv, exitCode: run.status, rawSha256: run.rawSha256, nice: run.nice })),
      everyCommandHasNoGpuFlag: runs.every((run) => run.argv?.includes('-ng') === true),
      referenceWords: wordsOf(reference.text).length,
      heardWords: wordsOf(heard).length,
      differingWords: difference,
      heardText: heard,
    });
    // The transcript is the dialogue, not noise: most reference words were heard. A bound for "it is this text", not a quality figure.
    expect(difference.missing.length).toBeLessThan(wordsOf(reference.text).length / 2);
  });
});
