// VAD chunking and the phantom-tail clamp (row 77; transcript spec §A.2, §A.3). Pure functions:
// no file, no process. The clamp is checked on the numbers the REAL oMLX server answered with on
// the sealed fixture (row 12 §4.1; reproduced byte for byte by row 76), with the clamp taken away
// as the negative control.
import { describe, expect, it } from 'vitest';
import { planChunks } from '../pipeline/chunker';
import { CLAMP_ROUNDING_MS, DropReason, clampSegments, comparableText } from '../pipeline/clamp';
import { VAD_MAX_CHUNK_MS, VAD_OVERLAP_MS, VAD_TAIL_GUARD_MS } from '../pipeline/constants';
import { captureTapTimeline, chunkSecondsToMediaMs, decodedFileTimeline } from '../pipeline/media-time';
import type { TranscriptSegment } from '../types';

const tap = captureTapTimeline();
const SECOND = 48_000;
const span = (fromS: number, toS: number): { fromMs: number; toMs: number } => ({ fromMs: fromS * 1000, toMs: toS * 1000 });
const onGrid = (sample: number): boolean => (sample + 1024) % 1024 === 0;

describe('VAD chunking: from speech runs to chunks (§A.2)', () => {
  it('runs that follow each other are joined while the chunk stays within the maximum; a run that does not fit starts the next chunk', () => {
    const plan = planChunks({ timeline: tap, window: { from: 0, to: 100 * SECOND }, spans: [span(1, 9), span(10, 19), span(21, 29.5), span(33, 40), span(70, 71)], final: true });
    expect(plan.nextCursor).toBe(100 * SECOND);
    expect(plan.chunks).toHaveLength(3);
    // 1..29.5 fits (28.5 s); adding 33..40 would make 39 s; 33..40 and 70..71 would make 38 s.
    expect(plan.chunks.map((chunk) => [Math.round(chunk.from / SECOND), Math.round(chunk.to / SECOND)])).toEqual([[1, 30], [33, 40], [70, 71]]);
    for (const chunk of plan.chunks) {
      expect(chunk.to - chunk.from).toBeLessThanOrEqual((VAD_MAX_CHUNK_MS / 1000) * SECOND + 2 * 1024);
      expect(onGrid(chunk.from)).toBe(true);
      expect(onGrid(chunk.to)).toBe(true);
    }
    // Snapped OUTWARDS: a chunk never loses speech at its rims.
    expect(plan.chunks[0]!.from).toBeLessThanOrEqual(1 * SECOND);
    expect(plan.chunks[0]!.to).toBeGreaterThanOrEqual(29.5 * SECOND);
  });

  it('one run longer than the maximum is cut into windows that share the overlap', () => {
    const plan = planChunks({ timeline: tap, window: { from: 0, to: 80 * SECOND }, spans: [span(2, 75)], final: true });
    expect(plan.chunks).toHaveLength(3);
    const overlap = (VAD_OVERLAP_MS / 1000) * SECOND;
    expect(plan.chunks[0]!.to - plan.chunks[1]!.from).toBeGreaterThanOrEqual(overlap);
    expect(plan.chunks[0]!.to - plan.chunks[1]!.from).toBeLessThanOrEqual(overlap + 2 * 1024);
    expect(plan.chunks[2]!.to).toBeGreaterThanOrEqual(75 * SECOND);
  });

  it('no VAD answer: fixed windows of the maximum length over the whole window, sharing the overlap', () => {
    const plan = planChunks({ timeline: tap, window: { from: 0, to: 65 * SECOND }, spans: null, final: true });
    expect(plan.chunks).toHaveLength(3);
    expect(plan.chunks[0]).toEqual({ from: 0, to: Math.ceil((30 * SECOND + 1024) / 1024) * 1024 - 1024 });
    expect(plan.chunks[2]!.to).toBe(65 * SECOND);
    expect(plan.nextCursor).toBe(65 * SECOND);
  });

  it('no speech in complete audio: no chunk; the cursor is at the end', () => {
    expect(planChunks({ timeline: tap, window: { from: 0, to: 10 * SECOND }, spans: [], final: true })).toEqual({ chunks: [], nextCursor: 10 * SECOND });
  });

  describe('while the audio still grows (final: false)', () => {
    it('the last chunk stays open, and a run that reaches into the tail guard is not decided', () => {
      const window = { from: 0, to: 60 * SECOND };
      const plan = planChunks({ timeline: tap, window, spans: [span(1, 20), span(25, 44), span(46, 50), span(58.5, 60)], final: false });
      // 1..20 closed (25..44 does not fit with it); 25..50 is the last chunk: open. 58.5..60 touches the guard.
      expect(plan.chunks).toHaveLength(1);
      expect(plan.chunks[0]!.to).toBeGreaterThanOrEqual(20 * SECOND);
      expect(plan.nextCursor).toBe(25 * SECOND);
      expect(VAD_TAIL_GUARD_MS).toBeGreaterThan(0);
    });

    it('only silence so far: nothing is planned and the silence is skipped up to the guard', () => {
      const plan = planChunks({ timeline: tap, window: { from: 0, to: 40 * SECOND }, spans: [], final: false });
      expect(plan).toEqual({ chunks: [], nextCursor: 40 * SECOND - (VAD_TAIL_GUARD_MS / 1000) * SECOND });
    });

    it('fixed windows: only FULL windows are closed; the rest waits', () => {
      const plan = planChunks({ timeline: tap, window: { from: 0, to: 50 * SECOND }, spans: null, final: false });
      expect(plan.chunks).toHaveLength(1);
      expect(plan.nextCursor).toBe(30 * SECOND - (VAD_OVERLAP_MS / 1000) * SECOND);
    });

    it('the same audio planned in two passes and in one gives chunks that never overlap a committed one', () => {
      const spans = [span(1, 20), span(25, 44), span(46, 50)];
      const first = planChunks({ timeline: tap, window: { from: 0, to: 60 * SECOND }, spans, final: false });
      // Second pass: the VAD is asked again from the cursor; times are relative to the new window.
      const second = planChunks({ timeline: tap, window: { from: first.nextCursor, to: 60 * SECOND }, spans: [span(0, 19), span(21, 25)], final: true });
      const all = [...first.chunks, ...second.chunks];
      expect(all).toHaveLength(2);
      expect(all[1]!.from).toBeGreaterThanOrEqual(all[0]!.to);
    });
  });
});

describe('row 77 phantom-tail clamp (§A.3): the tail the oMLX server really answered with', () => {
  // The sealed fixture: 3,154,638 bytes = 44 header + 1,577,297 samples at 24 kHz = 65.7207… s.
  const file = decodedFileTimeline(24_000);
  const wholeFixture = { from: 0, to: 1_577_297 };
  const audioEndMs = 65_721;
  // Segments 14, 15 and 16 of the 17 the server returned (times and QA members as returned).
  const tail: TranscriptSegment[] = [
    { id: 14, start: 61.02, end: 63.4, text: 'Wawancara kita tutup dengan rekaman ini.', avgLogprob: -0.17308476567268372, noSpeechProb: 4.0241338039592733e-11 },
    { id: 15, start: 63.74, end: 65.54, text: 'Terima kasih atas kerjasamanya.', avgLogprob: -0.17308476567268372, noSpeechProb: 4.0241338039592733e-11 },
    { id: 16, start: 65.54, end: 95.52000000000001, text: 'Terima kasih atas kerjasamanya.', avgLogprob: -0.34606258685772234, noSpeechProb: 2.238288887568274e-9 },
  ];

  it('0 committed segments end after the audio end; the tail that repeats the previous text is dropped', () => {
    const result = clampSegments(tail, file, wholeFixture);
    expect(result.segments.filter((segment) => segment.endMs > audioEndMs)).toEqual([]);
    expect(result.segments.map((segment) => [segment.startMs, segment.endMs, segment.text])).toEqual([
      [61_020, 63_400, 'Wawancara kita tutup dengan rekaman ini.'],
      [63_740, 65_540, 'Terima kasih atas kerjasamanya.'],
    ]);
    expect(result.dropped).toEqual([{ reason: DropReason.CLAMPED_TAIL_REPEATS_PREVIOUS, index: 2 }]);
  });

  it('NEGATIVE CONTROL: the same answer converted WITHOUT the clamp has a segment that ends 29.8 s after the audio', () => {
    const unclamped = tail.map((segment) => ({ startMs: chunkSecondsToMediaMs(file, 0, segment.start), endMs: chunkSecondsToMediaMs(file, 0, segment.end) }));
    const past = unclamped.filter((segment) => segment.endMs > audioEndMs);
    expect(past).toEqual([{ startMs: 65_540, endMs: 95_520 }]);
  });

  it('the QA members of that tail would NOT have caught it (ordinary log-probability, near-zero no-speech probability)', () => {
    expect(tail[2]!.avgLogprob).toBeGreaterThan(-1);
    expect(tail[2]!.noSpeechProb).toBeLessThan(0.6);
  });

  it('a segment that starts at or after the audio end is dropped', () => {
    const result = clampSegments([{ id: 0, start: 1, end: 2, text: 'satu' }, { id: 1, start: 65.8, end: 70, text: 'hantu' }, { id: 2, start: 1_577_297 / 24_000, end: 66, text: 'tepat di ujung' }], file, wholeFixture);
    expect(result.segments.map((segment) => segment.text)).toEqual(['satu']);
    expect(result.dropped.map((entry) => entry.reason)).toEqual([DropReason.STARTS_PAST_AUDIO_END, DropReason.STARTS_PAST_AUDIO_END]);
  });

  it('a clamped tail with OTHER text is kept, ending exactly at the audio end', () => {
    const result = clampSegments([{ id: 0, start: 60, end: 65, text: 'kalimat terakhir' }, { id: 1, start: 65.1, end: 80, text: 'kalimat yang lain' }], file, wholeFixture);
    expect(result.clamped).toBe(1);
    expect(result.segments[1]).toEqual({ startMs: 65_100, endMs: audioEndMs, text: 'kalimat yang lain' });
  });

  it('a clamped tail whose own QA members say no speech is dropped, whatever its text', () => {
    const result = clampSegments([{ id: 0, start: 60, end: 65, text: 'kalimat terakhir' }, { id: 1, start: 65.1, end: 80, text: 'terima kasih telah menonton', avgLogprob: -1.4, noSpeechProb: 0.93 }], file, wholeFixture);
    expect(result.dropped).toEqual([{ reason: DropReason.CLAMPED_TAIL_NO_SPEECH, index: 1 }]);
  });

  it('an end inside the time resolution of the engine is clamped, and a REAL repeated sentence is kept', () => {
    const chunk = { from: 0, to: 24_000 * 10 };
    const result = clampSegments([{ id: 0, start: 7, end: 8.4, text: 'Ya.' }, { id: 1, start: 8.6, end: 10 + CLAMP_ROUNDING_MS / 1000, text: 'Ya.' }], file, chunk);
    expect(result.segments.map((segment) => [segment.startMs, segment.endMs])).toEqual([[7000, 8400], [8600, 10_000]]);
    expect(result.dropped).toEqual([]);
  });

  it('text is compared without case, white space and rim punctuation; an empty remainder is dropped', () => {
    expect(comparableText('  Terima kasih atas KERJASAMANYA. ')).toBe(comparableText('terima   kasih atas kerjasamanya'));
    expect(comparableText('Baik.')).not.toBe(comparableText('Baiklah.'));
    const result = clampSegments([{ id: 0, start: 1, end: 1.0002, text: 'kosong' }, { id: 1, start: 2, end: 3, text: '   ' }], file, wholeFixture);
    expect(result.dropped.map((entry) => entry.reason)).toEqual([DropReason.EMPTY, DropReason.EMPTY]);
  });

  it('on the tap timeline the clamp bound is the end of the CHUNK, in media time of the sealed file', () => {
    const chunk = { from: 95_232, to: 167_936 }; // 1.514666… s of audio
    const result = clampSegments([{ id: 0, start: 0.5, end: 9, text: 'ekor' }], tap, chunk);
    expect(result.segments).toEqual([{ startMs: 2505, endMs: 3520, text: 'ekor' }]);
  });
});
