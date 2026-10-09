// The items of the row-77 review that were carried to row 79 (decisions D90, D97;
// `delegation_progress/pair_77_navigator.md` N-4 and N-7), and the D-EV-1 rule of the sealing
// spec as far as the TRANSCRIBER holds it:
//
//   N-4     a speaker who does not pause no longer stops the incremental transcript: the maximum
//           chunk length cuts while the session records, at every step, in the real runner;
//   N-7     `failed_chunks` of the document counts CHUNKS: a chunk that failed and was then decoded
//           is not a failed chunk, although its FAILED row stays in the mirror;
//   D-EV-1  a chunk that ended FAILED has NO text in the document — no placeholder, no borrowed
//           neighbour — and the document says PARTIAL with the count.
//
// No engine, no model: the runner, the chunker, the mirror stand-in and the assembly are the real ones.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assembleTranscript, type AssembledTranscript } from '../pipeline/assembly';
import { QaFlag, VAD_MAX_CHUNK_MS, VAD_OVERLAP_MS, VAD_TAIL_GUARD_MS, VAD_WINDOW_MAX_MS } from '../pipeline/constants';
import { createMemoryChunkMirror } from '../pipeline/mirror';
import { MODEL_PROVENANCE, transcriptOf, type FinishedTranscript } from './diarization-support';
import { TAP_RATE, growTap, tonePcm, type Burst } from './pipeline-support';

const SECOND = TAP_RATE;
const MAX = (VAD_MAX_CHUNK_MS / 1000) * SECOND;

const assemble = (transcript: FinishedTranscript): Promise<AssembledTranscript> =>
  assembleTranscript({ sessionScratchDir: transcript.dir, identity: transcript.identity, source: transcript.source, diarization: { enabled: true, engine: null }, model: MODEL_PROVENANCE, intervals: [], log: transcript.log });

describe('N-4: an unbroken speech run while the session records', () => {
  const MINUTE = 60 * SECOND;
  /** One run of speech from second 1 to the end of seven minutes: longer than a capped VAD window. */
  const TOTAL = 7 * MINUTE;
  const RUN: Burst[] = [{ from: SECOND, to: TOTAL }];

  it('every step while recording plans and decodes chunks, the cursor moves, and no fixed-window fallback is needed', async () => {
    expect(TOTAL).toBeGreaterThan((VAD_WINDOW_MAX_MS / 1000) * SECOND);
    const all = tonePcm(TOTAL, RUN);
    const transcript = await transcriptOf({ bursts: RUN, total: MINUTE, finish: false });
    // The stand-in engine: one segment over the chunk it is given.
    transcript.adapter.answer = (chunk) => [{ id: 0, start: 0, end: chunk.durationMs / 1000, text: `ucapan pada ${chunk.offsetMs}` }];

    const cursors: number[] = [];
    for (let minute = 1; minute <= 7; minute += 1) {
      if (minute > 1) growTap(transcript.tapPath, all.subarray((minute - 1) * MINUTE, minute * MINUTE));
      const report = await transcript.runner.step({ final: false });
      // THE FINDING: eleven steps of `planned 0, decoded 0` with the cursor at 1 s. Now every step moves.
      expect(report.planned).toBeGreaterThan(0);
      expect(report.decoded).toBe(report.planned);
      expect(report.complete).toBe(false);
      cursors.push(transcript.stored().cursorSample);
    }
    expect(cursors.every((cursor, index) => index === 0 || cursor > (cursors[index - 1] ?? 0))).toBe(true);
    // THE BOUND: what is not yet in a chunk is less than one maximum plus the guard at the end.
    const lag = 7 * MINUTE - (cursors[cursors.length - 1] ?? 0);
    expect(lag).toBeLessThanOrEqual(MAX + (VAD_TAIL_GUARD_MS / 1000) * SECOND);

    const end = await transcript.runner.step({ final: true });
    expect([end.complete, end.transcriptState]).toEqual([true, 'READY']);
    expect(end.qaFlags).not.toContain(QaFlag.VAD_FALLBACK);

    const chunks = transcript.stored().chunks;
    // NO AUDIO OF THE RUN IS OUTSIDE A CHUNK: the chunks cover it from its first sample to its
    // last without a gap, each within the maximum, each seam shared by two chunks.
    expect(chunks[0]?.fromSample).toBeLessThanOrEqual(SECOND);
    expect(chunks[chunks.length - 1]?.toSample).toBeGreaterThanOrEqual(TOTAL);
    chunks.forEach((chunk, index) => {
      expect(chunk.toSample - chunk.fromSample).toBeLessThanOrEqual(MAX + 2 * 1024);
      const before = chunks[index - 1];
      if (before !== undefined) {
        expect(chunk.fromSample).toBeLessThan(before.toSample);
        expect(before.toSample - chunk.fromSample).toBeLessThanOrEqual((VAD_OVERLAP_MS / 1000) * SECOND + 2 * 1024);
      }
    });
    // A committed chunk was never decoded twice.
    expect(new Set(transcript.adapter.decodedOffsets).size).toBe(transcript.adapter.decodedOffsets.length);
    expect(transcript.stored().openRunUntilSample).toBeUndefined();
  }, 60_000);

  it('a pause in the speech is still where a chunk ends: two ordinary runs are planned as before (control)', async () => {
    const two: Burst[] = [
      { from: 1 * SECOND, to: 9 * SECOND },
      { from: 50 * SECOND, to: 58 * SECOND },
    ];
    const transcript = await transcriptOf({ bursts: two, total: 60 * SECOND });
    expect(transcript.stored().chunks.map((chunk) => [Math.round(chunk.fromSample / SECOND), Math.round(chunk.toSample / SECOND)])).toEqual([
      [1, 9],
      [50, 58],
    ]);
  });
});

/** Three runs of speech that cannot be joined: three chunks. */
const THREE: Burst[] = [
  { from: 1 * SECOND, to: 9 * SECOND },
  { from: 50 * SECOND, to: 58 * SECOND },
  { from: 100 * SECOND, to: 108 * SECOND },
];
const THREE_TOTAL = 110 * SECOND;

describe('N-7: `failed_chunks` counts chunks, not attempts', () => {
  it('a chunk that failed and was then decoded is NOT a failed chunk: the document is ASSEMBLED with 0, while its FAILED row stays in the mirror', async () => {
    const mirror = createMemoryChunkMirror();
    const transcript = await transcriptOf({ bursts: THREE, total: THREE_TOTAL, finish: false, runner: { mirror } });
    // The middle chunk fails every attempt of the first run (1 + STT_CHUNK_RETRIES).
    const original = transcript.adapter.transcribe.bind(transcript.adapter);
    let failing = true;
    transcript.adapter.transcribe = async (chunk, options) => {
      if (failing && chunk.offsetMs > 40_000 && chunk.offsetMs < 60_000) throw new Error('the stand-in engine fails this chunk');
      return original(chunk, options);
    };
    const first = await transcript.runner.step({ final: true });
    expect([first.complete, first.transcriptState, first.partialReason, first.failed]).toEqual([true, 'PARTIAL', 'CHUNKS_FAILED', 1]);

    failing = false;
    expect(transcript.runner.retryFailed()).toBe(1);
    const second = await transcript.runner.step({ final: true });
    expect([second.complete, second.transcriptState, second.decoded]).toEqual([true, 'READY', 1]);

    const assembled = await assemble(transcript);
    expect(assembled.document.header).toMatchObject({ state: 'ASSEMBLED', partial_reason: null, chunks: 3, failed_chunks: 0 });
    expect(assembled.record.failedChunks).toBe(0);
    expect(assembled.document.segments).toHaveLength(3);

    // THE MIRROR HOLDS ATTEMPTS: four rows for three chunks, one of them FAILED, with the SAME range as the DONE row after it.
    const rows = mirror.rows();
    expect(rows.map((row) => row.status)).toEqual(['DONE', 'FAILED', 'DONE', 'DONE']);
    const failedRow = rows[1];
    const rerun = rows.find((row) => row.status === 'DONE' && row.audioFromMs === failedRow?.audioFromMs && row.audioToMs === failedRow?.audioToMs);
    expect(rerun?.seq).toBeGreaterThan(failedRow?.seq ?? Infinity);
    // The naive count of the package spec (`status = 'FAILED'`) would say 1: it over-states (negative control).
    expect(rows.filter((row) => row.status === 'FAILED')).toHaveLength(1);
  });

  it('a chunk that failed, was retried and failed again is ONE failed chunk, with two FAILED rows', async () => {
    const mirror = createMemoryChunkMirror();
    const transcript = await transcriptOf({ bursts: THREE, total: THREE_TOTAL, finish: false, runner: { mirror } });
    const original = transcript.adapter.transcribe.bind(transcript.adapter);
    transcript.adapter.transcribe = async (chunk, options) => {
      if (chunk.offsetMs > 40_000 && chunk.offsetMs < 60_000) throw new Error('the stand-in engine fails this chunk');
      return original(chunk, options);
    };
    await transcript.runner.step({ final: true });
    expect(transcript.runner.retryFailed()).toBe(1);
    await transcript.runner.step({ final: true });
    const assembled = await assemble(transcript);
    expect(assembled.document.header).toMatchObject({ state: 'PARTIAL', partial_reason: 'CHUNKS_FAILED', chunks: 3, failed_chunks: 1 });
    expect(mirror.rows().filter((row) => row.status === 'FAILED')).toHaveLength(2);
  });
});

describe('D-EV-1: a chunk that failed has NO text in the document', () => {
  it('PARTIAL with the count; the segments are exactly those of the committed chunks; nothing stands where the failed chunk was', async () => {
    const transcript = await transcriptOf({
      bursts: THREE,
      total: THREE_TOTAL,
      finish: false,
      prepare: (adapter) => {
        const original = adapter.transcribe.bind(adapter);
        adapter.transcribe = async (chunk, options) => {
          if (chunk.offsetMs > 40_000 && chunk.offsetMs < 60_000) throw new Error('the stand-in engine fails this chunk');
          return original(chunk, options);
        };
      },
    });
    const report = await transcript.runner.step({ final: true });
    expect([report.transcriptState, report.partialReason]).toEqual(['PARTIAL', 'CHUNKS_FAILED']);
    const assembled = await assemble(transcript);
    const stored = transcript.stored();
    const failed = stored.chunks.filter((chunk) => chunk.status === 'FAILED');
    expect(failed).toHaveLength(1);
    const gap = failed[0];
    expect(gap?.segments).toBeNull();

    const { document } = assembled;
    expect(document.header).toMatchObject({ state: 'PARTIAL', partial_reason: 'CHUNKS_FAILED', chunks: 3, failed_chunks: 1 });
    // Two committed chunks, one segment each: two segments, and not three.
    expect(document.segments).toHaveLength(2);
    // NO SEGMENT LIES IN THE AUDIO OF THE FAILED CHUNK.
    for (const segment of document.segments) expect(segment.end_ms <= (gap?.startMs ?? 0) || segment.start_ms >= (gap?.endMs ?? 0)).toBe(true);
    // EVERY SEGMENT IS A COMMITTED ONE, text for text: nothing was written by the assembly itself.
    const committed = stored.chunks.flatMap((chunk) => (chunk.status === 'DONE' ? (chunk.segments ?? []) : [])).map((segment) => `${segment.startMs}|${segment.endMs}|${segment.text}`);
    expect(document.segments.map((segment) => `${segment.start_ms}|${segment.end_ms}|${segment.text}`)).toEqual(committed);
    // The files say the same: two cues, and no text that is not a committed segment's.
    const srt = readFileSync(assembled.files.srt, 'utf8');
    expect(srt.split('\n\n').filter((cue) => cue.trim() !== '')).toHaveLength(2);
    const texts = new Set(document.segments.map((segment) => segment.text));
    const json = JSON.parse(readFileSync(assembled.files.json, 'utf8')) as { segments: { text: string }[] };
    expect(json.segments.every((segment) => texts.has(segment.text))).toBe(true);
    expect(json.segments).toHaveLength(2);
  });
});
