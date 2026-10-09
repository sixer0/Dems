// M6-KR-1 — chunk resume after a kill (test strategy `:223`; transcript spec §D.1, §D.2, §E.1-7):
// "kill mid-transcript: committed chunks survive, resume continues from the last checkpoint, no
// chunk recomputed twice".
//
// THE KILL IS REAL. The pipeline runs in its own operating-system process
// (`kill-harness-child.ts`); the stand-in engine holds on one chunk; the pipeline process is
// killed with SIGKILL while that engine is running; a NEW process is started on the same scratch
// directory. Every start of the engine writes a line into a journal, so "how often was each chunk
// decoded" is counted from the outside, not asked of the pipeline.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { CheckpointSchema, type Checkpoint } from '../pipeline/checkpoint';
import { TRANSCRIPT_CHECKPOINT_FILE } from '../pipeline/constants';
import { tableRefusal } from '../pipeline/mirror';
import { TAP_RATE, createFileChunkMirror, createProgramHome, tonePcm, writeTap, type ProgramHome } from './pipeline-support';
import { scratchDir } from './support';

const WORKSPACE = resolve(import.meta.dirname, '..', '..');
const CHILD = join(import.meta.dirname, 'kill-harness-child.ts');
const SECOND = TAP_RATE;
/** Five runs of speech that cannot be joined: five chunks, `chunk-1.wav` .. `chunk-5.wav`. */
const FIVE = [0, 1, 2, 3, 4].map((index) => ({ from: (2 + index * 31) * SECOND, to: (2 + index * 31 + 20) * SECOND }));

interface Child {
  readonly pid: number;
  readonly exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  kill(): void;
}

function startPipeline(home: ProgramHome, scratch: string, tap: string, reportName: string): Child {
  const child = spawn(process.execPath, ['--import', 'tsx', CHILD, home.root, scratch, tap, reportName], { cwd: WORKSPACE, stdio: 'ignore' });
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((done) => child.once('exit', (code, signal) => done({ code, signal })));
  return { pid: child.pid!, exit, kill: () => child.kill('SIGKILL') };
}

const stored = (scratch: string): Checkpoint => CheckpointSchema.parse(JSON.parse(readFileSync(join(scratch, TRANSCRIPT_CHECKPOINT_FILE), 'utf8')));
const report = (scratch: string, name: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(readFileSync(join(scratch, name), 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
};
const startsPerChunk = (home: ProgramHome): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const entry of home.journal()) counts[entry.name] = (counts[entry.name] ?? 0) + 1;
  return counts;
};

async function until(condition: () => boolean, what: string): Promise<void> {
  for (let tries = 0; tries < 3_000; tries += 1) {
    if (condition()) return;
    await wait(10);
  }
  throw new Error(`the harness waited in vain for: ${what}`);
}

describe('M6-KR-1: a kill mid-transcript, then a resume', () => {
  it.each([
    [3, ['DONE', 'DONE', 'RUNNING', 'PENDING', 'PENDING']],
    [1, ['RUNNING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']],
    [5, ['DONE', 'DONE', 'DONE', 'DONE', 'RUNNING']],
  ] as const)(
    'killed while chunk %i is being decoded: committed chunks survive byte for byte, the resume decodes only what was not committed, and no committed chunk is decoded twice',
    async (heldChunk, statusesAtKill) => {
      const home = createProgramHome();
      const scratch = scratchDir('kill');
      const tap = writeTap(scratch, tonePcm(160 * SECOND, FIVE));
      const held = `chunk-${heldChunk}.wav`;
      home.control({ holdOn: held });

      // ── run 1: until the engine is INSIDE the held chunk, then SIGKILL of the pipeline process ──
      const first = startPipeline(home, scratch, tap, 'report-1.json');
      await until(() => home.journal().some((entry) => entry.name === held), `the engine to start on ${held}`);
      const atKill = stored(scratch);
      first.kill();
      expect(await first.exit).toEqual({ code: null, signal: 'SIGKILL' });
      // The engine the killed pipeline left behind is stopped too (it would hold for ever).
      for (const entry of home.journal().filter((line) => line.name === held)) {
        try {
          process.kill(entry.pid, 'SIGKILL');
        } catch {
          // It has ended with its parent.
        }
      }

      // What the kill left: a readable checkpoint, the plan complete, nothing half-written.
      expect(report(scratch, 'report-1.json')).toBeNull();
      const afterKill = stored(scratch);
      expect(afterKill).toEqual(atKill);
      expect(afterKill.audioComplete).toBe(true);
      expect(afterKill.chunks.map((chunk) => chunk.status)).toEqual(statusesAtKill);
      expect(readdirSync(scratch).filter((name) => name.endsWith('.next'))).toEqual([]);
      const committedAtKill = afterKill.chunks.filter((chunk) => chunk.status === 'DONE').map((chunk) => JSON.stringify(chunk));
      expect(committedAtKill).toHaveLength(heldChunk - 1);
      expect(startsPerChunk(home)).toEqual(Object.fromEntries(Array.from({ length: heldChunk }, (_, index) => [`chunk-${index + 1}.wav`, 1])));
      // The mirror is what the killed process had written: never ahead of the file.
      const mirror = createFileChunkMirror(join(scratch, 'mirror.json'));
      expect(mirror.rows().map((row) => row.status)).toEqual(statusesAtKill);

      // ── run 2: a NEW process on the same scratch directory ──
      home.control({});
      const second = startPipeline(home, scratch, tap, 'report-2.json');
      expect(await second.exit).toEqual({ code: 0, signal: null });
      expect(report(scratch, 'report-2.json')).toMatchObject({ planned: 0, decoded: 6 - heldChunk, failed: 0, reused: heldChunk - 1, remaining: 0, complete: true, vadRuns: 0 });

      const final = stored(scratch);
      expect(final.chunks.map((chunk) => chunk.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'DONE']);
      // Committed chunks survive: byte for byte what they were at the kill.
      expect(final.chunks.slice(0, heldChunk - 1).map((chunk) => JSON.stringify(chunk))).toEqual(committedAtKill);
      // The plan was not made again: same boundaries, same rows.
      expect(final.chunks.map((chunk) => [chunk.seq, chunk.fromSample, chunk.toSample])).toEqual(afterKill.chunks.map((chunk) => [chunk.seq, chunk.fromSample, chunk.toSample]));
      // No chunk recomputed twice: every chunk was started ONCE, except the one the kill interrupted
      // (started, never committed, started again).
      const expectedStarts = Object.fromEntries([1, 2, 3, 4, 5].map((index) => [`chunk-${index}.wav`, index === heldChunk ? 2 : 1]));
      expect(startsPerChunk(home)).toEqual(expectedStarts);
      // The two starts of the interrupted chunk were given the SAME audio bytes.
      const heldRuns = home.journal().filter((entry) => entry.name === held);
      expect(new Set(heldRuns.map((entry) => entry.sha)).size).toBe(1);
      // The mirror is in line with the file, and every row is one the table accepts.
      expect(mirror.rows().map((row) => [row.seq, row.status, row.audioFromMs, row.audioToMs, row.segments?.length])).toEqual(final.chunks.map((chunk) => [chunk.seq, 'DONE', chunk.startMs, chunk.endMs, 1]));
      expect(mirror.rows().every((row) => tableRefusal(row) === null)).toBe(true);

      // ── run 3: once more, on a finished transcript: nothing is decoded ──
      const third = startPipeline(home, scratch, tap, 'report-3.json');
      expect(await third.exit).toEqual({ code: 0, signal: null });
      expect(report(scratch, 'report-3.json')).toMatchObject({ planned: 0, decoded: 0, reused: 5, complete: true });
      expect(startsPerChunk(home)).toEqual(expectedStarts);
      expect(readFileSync(join(scratch, TRANSCRIPT_CHECKPOINT_FILE), 'utf8')).toBe(`${JSON.stringify(final)}\n`);
    },
    120_000,
  );

  it('NEGATIVE CONTROL — the checkpoint file deleted after the kill: the resume has nothing to reuse, and the journal SHOWS the committed chunks decoded twice', async () => {
    const home = createProgramHome();
    const scratch = scratchDir('kill');
    const tap = writeTap(scratch, tonePcm(160 * SECOND, FIVE));
    home.control({ holdOn: 'chunk-3.wav' });
    const first = startPipeline(home, scratch, tap, 'report-1.json');
    await until(() => home.journal().some((entry) => entry.name === 'chunk-3.wav'), 'the engine to start on chunk-3.wav');
    first.kill();
    await first.exit;
    for (const entry of home.journal().filter((line) => line.name === 'chunk-3.wav')) {
      try {
        process.kill(entry.pid, 'SIGKILL');
      } catch {
        // It has ended with its parent.
      }
    }
    const { rmSync } = await import('node:fs');
    rmSync(join(scratch, TRANSCRIPT_CHECKPOINT_FILE));
    rmSync(join(scratch, 'mirror.json'));
    home.control({});
    const second = startPipeline(home, scratch, tap, 'report-2.json');
    expect(await second.exit).toEqual({ code: 0, signal: null });
    expect(report(scratch, 'report-2.json')).toMatchObject({ planned: 5, decoded: 5, reused: 0, vadRuns: 1 });
    // So the counting CAN tell: without the checkpoint, chunks 1 and 2 were decoded twice.
    expect(startsPerChunk(home)).toEqual({ 'chunk-1.wav': 2, 'chunk-2.wav': 2, 'chunk-3.wav': 2, 'chunk-4.wav': 1, 'chunk-5.wav': 1 });
  }, 120_000);
});
