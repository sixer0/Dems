// Blueprint row 77 Verification on the REAL `cpu-local` engine (the product path, D222):
//
//   M6-TF-1 (criteria 1-4 of transcript spec §E.1; 5 and 6 belong to rows 78/79): the pipeline —
//            real Silero VAD chunking, `whisper-cli -ng` per chunk, clamp, checkpoints — on the
//            sealed two-voice fixture: a transcript, non-empty with timestamps, at least one
//            segment per scripted sentence, language `id`, `-ng` in every quoted command.
//   M6-KR-1 on the real engine: the pipeline PROCESS is killed (SIGKILL) while `whisper-cli`
//            decodes the second chunk; a new process resumes; the committed chunk survives byte
//            for byte, no committed chunk is decoded twice, and the finished transcript equals the
//            transcript of the run that was never interrupted.
//
// Run 1 is the uninterrupted run; run 2 is the killed-and-resumed one: M6-TF-1 has its two runs.
// No duration is measured or written anywhere (D230).
//
// Run alone, outside the sandbox, on a quiet host:  npm run test:real:row77:cpu-local -w @dems/transcriber
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getPriority } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { expectedEngineNice } from '../../src/cpu-priority';
import { CheckpointSchema, type Checkpoint } from '../../src/pipeline/checkpoint';
import { QaFlag, TRANSCRIPT_CHECKPOINT_FILE, VAD_MAX_CHUNK_MS } from '../../src/pipeline/constants';
import { FIXTURE_END_MS, MODEL_DIR, SCRIPTED_SENTENCES, SEALED_FIXTURE, VAD_BINARY, VAD_MODEL_ID, VAD_MODEL_SHA256, WHISPER_CLI, ROW77_RUNS_DIR, createRunDir, writeEvidence } from './real-support';

const WORKSPACE = resolve(import.meta.dirname, '..', '..');
const CHILD = join(import.meta.dirname, 'sealed-fixture-pipeline-child.ts');
const EVIDENCE_DIR = createRunDir('row77-cpu-local', ROW77_RUNS_DIR);
const PARENT_NICE = getPriority();

interface JournalLine {
  readonly event: string;
  readonly seq?: number;
  readonly pid?: number;
  readonly argv?: string[];
  readonly status?: number | null;
  readonly rawSha256?: string;
  readonly nice?: number | null;
  readonly spans?: number | null;
}

const journalOf = (scratch: string): JournalLine[] => {
  try {
    return readFileSync(join(scratch, 'engine-journal.jsonl'), 'utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as JournalLine);
  } catch {
    return [];
  }
};
const stored = (scratch: string): Checkpoint | null => {
  try {
    return CheckpointSchema.parse(JSON.parse(readFileSync(join(scratch, TRANSCRIPT_CHECKPOINT_FILE), 'utf8')));
  } catch {
    return null;
  }
};
const reportOf = (scratch: string, name: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(readFileSync(join(scratch, name), 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
};

function startPipeline(scratch: string, reportName: string): { exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>; kill: () => void } {
  const child = spawn(process.execPath, ['--import', 'tsx', CHILD, scratch, reportName], { cwd: WORKSPACE, stdio: 'ignore' });
  return { exit: new Promise((done) => child.once('exit', (code, signal) => done({ code, signal }))), kill: () => child.kill('SIGKILL') };
}

const segmentsOf = (checkpoint: Checkpoint): { startMs: number; endMs: number; text: string }[] =>
  checkpoint.chunks.flatMap((chunk) => (chunk.segments ?? []).map((segment) => ({ startMs: segment.startMs, endMs: segment.endMs, text: segment.text })));

/** The functional criteria 1-4 of §E.1 on a finished checkpoint, plus the row-77 clamp and chunk rules. */
function expectFunctionalTranscript(checkpoint: Checkpoint, journal: JournalLine[]): void {
  expect(checkpoint.audioComplete).toBe(true);
  expect(checkpoint.backend).toBe('cpu-local');
  expect(checkpoint.language).toBe('id');
  expect(checkpoint.audio).toEqual({ kind: 'DECODED_FILE', sampleRateHz: 24_000, originSamples: 0, gridSamples: 1 });
  expect(checkpoint.qaFlags).not.toContain(QaFlag.VAD_FALLBACK);
  expect(checkpoint.chunks.length).toBeGreaterThanOrEqual(2);
  expect(checkpoint.chunks.map((chunk) => chunk.status)).toEqual(checkpoint.chunks.map(() => 'DONE'));
  for (const chunk of checkpoint.chunks) {
    expect(chunk.endMs - chunk.startMs).toBeLessThanOrEqual(VAD_MAX_CHUNK_MS + 1);
    expect(chunk.endMs).toBeLessThanOrEqual(FIXTURE_END_MS);
  }
  const segments = segmentsOf(checkpoint);
  // 2. non-empty, every segment with start, end and text.
  expect(segments.length).toBeGreaterThan(0);
  for (const segment of segments) {
    expect(segment.endMs).toBeGreaterThan(segment.startMs);
    expect(segment.text.trim()).not.toBe('');
  }
  // 3. at least one segment per scripted sentence.
  expect(segments.length).toBeGreaterThanOrEqual(SCRIPTED_SENTENCES);
  // Row 77: no committed segment ends after the audio, and segments are in timeline order.
  expect(segments.filter((segment) => segment.endMs > FIXTURE_END_MS)).toEqual([]);
  expect(segments.map((segment) => segment.startMs)).toEqual(segments.map((segment) => segment.startMs).sort((a, b) => a - b));
  // 1. the quoted command: `-ng`, the GPU-off build, the lowered start; one finished run per chunk.
  const runs = journal.filter((line) => line.event === 'stt-run');
  for (const run of runs) {
    expect(run.argv!.slice(0, 7)).toEqual(['/usr/bin/nice', '-n', '10', WHISPER_CLI, '-m', join(MODEL_DIR, 'ggml-large-v3-turbo.bin'), '-ng']);
    expect(run.argv).toContain('-ng');
    expect(run.argv!.slice(7, 12)).toEqual(['-t', '8', '-l', 'id', '-oj']);
    expect(run.status).toBe(0);
    expect(run.nice).toBe(expectedEngineNice(PARENT_NICE));
  }
  // The VAD ran once, with the real model, lowered, and never with a GPU switch.
  const vadRuns = journal.filter((line) => line.event === 'vad-run');
  expect(vadRuns).toHaveLength(1);
  expect(vadRuns[0]!.argv!.slice(0, 4)).toEqual(['/usr/bin/nice', '-n', '10', VAD_BINARY]);
  expect(vadRuns[0]!.argv).toContain(join(MODEL_DIR, `${VAD_MODEL_ID}.bin`));
  expect(vadRuns[0]!.argv!.filter((arg) => arg === '-ug' || arg === '--use-gpu')).toEqual([]);
  expect(vadRuns[0]!.status).toBe(0);
  expect(vadRuns[0]!.spans).toBeGreaterThanOrEqual(SCRIPTED_SENTENCES);
}

let uninterrupted: Checkpoint | null = null;

describe('row 77 on cpu-local, real engines: M6-TF-1 and M6-KR-1 on the sealed fixture', () => {
  it('the VAD model in the model directory is the downloaded Silero file (sha256 recorded by the row)', () => {
    const bytes = readFileSync(join(MODEL_DIR, `${VAD_MODEL_ID}.bin`));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(VAD_MODEL_SHA256);
    expect(bytes.length).toBe(885_098);
  });

  it('M6-TF-1 run 1 — uninterrupted: VAD chunks, whisper-cli -ng per chunk, a transcript with timestamps in Indonesian', async () => {
    const scratch = join(EVIDENCE_DIR, 'run1');
    const run = startPipeline(scratch, 'report.json');
    expect(await run.exit).toEqual({ code: 0, signal: null });
    const report = reportOf(scratch, 'report.json');
    const checkpoint = stored(scratch)!;
    const journal = journalOf(scratch);
    expect(report).toMatchObject({ failed: 0, reused: 0, remaining: 0, paused: false, complete: true });
    expect(report!['planned']).toBe(checkpoint.chunks.length);
    expect(report!['decoded']).toBe(checkpoint.chunks.length);
    expectFunctionalTranscript(checkpoint, journal);
    expect(journal.filter((line) => line.event === 'stt-run')).toHaveLength(checkpoint.chunks.length);
    uninterrupted = checkpoint;

    writeEvidence(EVIDENCE_DIR, 'run1.checkpoint.json', checkpoint);
    writeEvidence(EVIDENCE_DIR, 'run1.evidence.json', {
      check: 'row 77 M6-TF-1 on cpu-local, run 1 (uninterrupted), sealed fixture',
      audioChunked: 'DECODED_FILE: the sealed fixture WAV, already in file time (origin 0)',
      report,
      chunks: checkpoint.chunks.map((chunk) => ({ chunkIndex: chunk.chunkIndex, seq: chunk.seq, startMs: chunk.startMs, endMs: chunk.endMs, status: chunk.status, segments: chunk.segments?.length })),
      segments: segmentsOf(checkpoint).length,
      scriptedSentences: SCRIPTED_SENTENCES,
      segmentsEndingAfterAudioEnd: segmentsOf(checkpoint).filter((segment) => segment.endMs > FIXTURE_END_MS).length,
      language: checkpoint.language,
      qaFlags: checkpoint.qaFlags,
      vadCommand: journal.find((line) => line.event === 'vad-run')?.argv,
      vadSpeechRuns: journal.find((line) => line.event === 'vad-run')?.spans,
      sttCommands: journal.filter((line) => line.event === 'stt-run').map((line) => ({ seq: line.seq, argv: line.argv, exitCode: line.status, rawSha256: line.rawSha256, nice: line.nice })),
      everyCommandHasNoGpuFlag: journal.filter((line) => line.event === 'stt-run').every((line) => line.argv!.includes('-ng')),
      parentNice: PARENT_NICE,
      fixture: SEALED_FIXTURE,
    });
  });

  it('M6-KR-1 + M6-TF-1 run 2 — the pipeline process is KILLED while whisper-cli decodes chunk 2; a new process resumes; nothing committed is lost or decoded twice; the transcript equals run 1', async () => {
    expect(uninterrupted, 'run 1 must have passed').not.toBeNull();
    const scratch = join(EVIDENCE_DIR, 'run2');
    const first = startPipeline(scratch, 'report-killed.json');
    // Wait until chunk 1 is committed AND the engine of chunk 2 exists.
    for (let tries = 0; tries < 360_000; tries += 1) {
      const journal = journalOf(scratch);
      if (journal.some((line) => line.event === 'stt-start' && line.seq === 2)) break;
      if (reportOf(scratch, 'report-killed.json') !== null) throw new Error('the pipeline finished before it could be killed');
      await wait(50);
    }
    const atKill = stored(scratch)!;
    first.kill();
    expect(await first.exit).toEqual({ code: null, signal: 'SIGKILL' });
    // The engine the killed pipeline left behind is stopped as well.
    const orphan = journalOf(scratch).find((line) => line.event === 'stt-start' && line.seq === 2)!;
    let orphanWasAlive = true;
    try {
      process.kill(orphan.pid!, 'SIGKILL');
    } catch {
      orphanWasAlive = false;
    }
    await wait(500);

    const afterKill = stored(scratch)!;
    expect(reportOf(scratch, 'report-killed.json')).toBeNull();
    expect(afterKill).toEqual(atKill);
    expect(afterKill.audioComplete).toBe(true);
    expect(afterKill.chunks.map((chunk) => chunk.status).slice(0, 2)).toEqual(['DONE', 'RUNNING']);
    expect(afterKill.chunks.slice(2).every((chunk) => chunk.status === 'PENDING')).toBe(true);
    const committedAtKill = JSON.stringify(afterKill.chunks[0]);
    const startsBefore = journalOf(scratch).filter((line) => line.event === 'stt-start').map((line) => line.seq);
    expect(startsBefore).toEqual([1, 2]);

    const second = startPipeline(scratch, 'report-resumed.json');
    expect(await second.exit).toEqual({ code: 0, signal: null });
    const report = reportOf(scratch, 'report-resumed.json');
    const final = stored(scratch)!;
    const journal = journalOf(scratch);
    expect(report).toMatchObject({ planned: 0, decoded: final.chunks.length - 1, failed: 0, reused: 1, remaining: 0, complete: true });
    // The committed chunk survived byte for byte; the plan was not made again.
    expect(JSON.stringify(final.chunks[0])).toBe(committedAtKill);
    expect(final.chunks.map((chunk) => [chunk.seq, chunk.fromSample, chunk.toSample])).toEqual(afterKill.chunks.map((chunk) => [chunk.seq, chunk.fromSample, chunk.toSample]));
    expect(journal.filter((line) => line.event === 'vad-run')).toHaveLength(1);
    // Engine starts per chunk row: 1 once, 2 twice (killed, then decoded), every later one once.
    const starts: Record<string, number> = {};
    for (const line of journal.filter((entry) => entry.event === 'stt-start')) starts[String(line.seq)] = (starts[String(line.seq)] ?? 0) + 1;
    expect(starts).toEqual(Object.fromEntries(final.chunks.map((chunk) => [String(chunk.seq), chunk.seq === 2 ? 2 : 1])));
    // FINISHED engine runs: exactly one per chunk. No committed chunk was decoded twice.
    const finished = journal.filter((line) => line.event === 'stt-run').map((line) => line.seq);
    expect(finished).toEqual(final.chunks.map((chunk) => chunk.seq));
    expectFunctionalTranscript(final, journal);

    // The same audio, the same plan, the same engine: the resumed transcript IS the uninterrupted one.
    expect(final.chunks.map((chunk) => [chunk.fromSample, chunk.toSample])).toEqual(uninterrupted!.chunks.map((chunk) => [chunk.fromSample, chunk.toSample]));
    expect(segmentsOf(final)).toEqual(segmentsOf(uninterrupted!));

    writeEvidence(EVIDENCE_DIR, 'run2.checkpoint.json', final);
    writeEvidence(EVIDENCE_DIR, 'run2.checkpoint-at-kill.json', afterKill);
    writeEvidence(EVIDENCE_DIR, 'run2.evidence.json', {
      check: 'row 77 M6-KR-1 on cpu-local (real kill, real engine) and M6-TF-1 run 2, sealed fixture',
      killedWith: 'SIGKILL of the pipeline process while whisper-cli decoded chunk seq 2',
      engineLeftBehindWasStillRunning: orphanWasAlive,
      statusesAtKill: afterKill.chunks.map((chunk) => chunk.status),
      resumedReport: report,
      committedChunkByteIdenticalAfterResume: JSON.stringify(final.chunks[0]) === committedAtKill,
      engineStartsPerChunkRow: starts,
      finishedEngineRunsPerChunkRow: finished,
      vadRunsOverBothProcesses: journal.filter((line) => line.event === 'vad-run').length,
      transcriptEqualsUninterruptedRun: JSON.stringify(segmentsOf(final)) === JSON.stringify(segmentsOf(uninterrupted!)),
      segments: segmentsOf(final).length,
      sttCommands: journal.filter((line) => line.event === 'stt-run').map((line) => ({ seq: line.seq, argv: line.argv, exitCode: line.status, rawSha256: line.rawSha256, nice: line.nice })),
      everyCommandHasNoGpuFlag: journal.filter((line) => line.event === 'stt-run').every((line) => line.argv!.includes('-ng')),
    });
  });
});
