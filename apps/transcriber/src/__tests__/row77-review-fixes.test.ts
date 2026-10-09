// The row-77 review fixes that landed with row 78 (navigator findings N-1, N-5, N-6, N-9, N-10 and
// the temporary-audio rule D-77-1; `delegation_progress/pair_77_navigator.md`). N-2 (the orphan
// engine) is in `kill-resume.test.ts`, D-77-6 / N-14 in `media-time.test.ts`. Each finding is
// shown as the scenario the navigator ran, with the outcome it must have now and a control.
import { existsSync, mkdirSync, readdirSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembleTranscript } from '../pipeline/assembly';
import { openPcmSource } from '../pipeline/audio-source';
import { CLAMP_MIN_REMAINDER_MS, DropReason, clampSegments } from '../pipeline/clamp';
import { TRANSCRIPT_CHECKPOINT_FILE } from '../pipeline/constants';
import { captureTapTimeline, decodedFileTimeline } from '../pipeline/media-time';
import { createMemoryChunkMirror } from '../pipeline/mirror';
import { NO_TAP_SIGNAL, createTranscriptRunner, discardTranscriptAudio } from '../pipeline/runner';
import { TranscriberError, TranscriberErrorCode } from '../types';
import { MODEL_PROVENANCE, transcriptOf } from './diarization-support';
import { SESSION, TAP_RATE, createStubAdapter, createStubVad, growTap, tonePcm, writeTap } from './pipeline-support';
import { errorRecords, scratchDir } from './support';

const SECOND = TAP_RATE;
/** Two runs of speech that cannot be joined: two chunks. */
const TWO = [
  { from: 1 * SECOND, to: 9 * SECOND },
  { from: 50 * SECOND, to: 58 * SECOND },
];

describe('N-1: the tap signal is STICKY — one `true` at any step makes the session PARTIAL for good', () => {
  it('lost while recording, "back" at the end (the navigator\'s scenario): PARTIAL / TRANSCRIPT_AUDIO_UNAVAILABLE, latched in the file at the step that saw it', async () => {
    let lost = false;
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, runner: { tapLost: () => lost } });
    lost = true;
    const mid = await transcript.runner.step({ final: false });
    expect(mid.transcriptState).toBe('PENDING');
    expect(transcript.stored().audioUnavailable).toBe(true); // on the disk already, not only in memory
    lost = false; // a worker that is gone after the stop has no telemetry to say `true` with
    const end = await transcript.runner.step({ final: true });
    expect([end.complete, end.transcriptState, end.partialReason]).toEqual([true, 'PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE']);
    expect(errorRecords(transcript.log).filter((record) => record.context['code'] === 'TRANSCRIPT_AUDIO_UNAVAILABLE')).toHaveLength(1);
  });

  it('…and a NEW runner on the same directory (a restart) still knows it, with a signal that now says false', async () => {
    let lost = true;
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, runner: { tapLost: () => lost } });
    await transcript.runner.step({ final: false });
    lost = false;
    const resumed = createTranscriptRunner({ sessionId: SESSION, adapter: transcript.adapter, timeline: transcript.identity.timeline, source: transcript.source, vad: createStubVad(), sessionScratchDir: transcript.dir, log: transcript.log, tapLost: NO_TAP_SIGNAL });
    expect((await resumed.step({ final: true })).transcriptState).toBe('PARTIAL');
  });

  it('NEGATIVE CONTROL: a signal that never says true ends READY', async () => {
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, runner: { tapLost: () => false } });
    await transcript.runner.step({ final: false });
    expect((await transcript.runner.step({ final: true })).transcriptState).toBe('READY');
  });
});

describe('N-9: audio that goes missing after it was planned is missing AUDIO, never READY and never "the engine failed"', () => {
  it('(a) a tap truncated below the cursor between two steps: PARTIAL / TRANSCRIPT_AUDIO_UNAVAILABLE', async () => {
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false });
    await transcript.runner.step({ final: false });
    expect(transcript.stored().cursorSample).toBeGreaterThan(20 * SECOND);
    truncateSync(transcript.tapPath, 10 * SECOND * 2);
    const end = await transcript.runner.step({ final: true });
    expect([end.transcriptState, end.partialReason, transcript.stored().audioUnavailable]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', true]);
  });

  it('(b) the tap removed after the plan: the chunks fail on their audio, and the reason is TRANSCRIPT_AUDIO_UNAVAILABLE, not CHUNKS_FAILED', async () => {
    let hold = true;
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, runner: { shouldPause: () => hold } });
    const planned = await transcript.runner.step({ final: true });
    expect([planned.planned, planned.decoded, planned.paused]).toEqual([2, 0, true]);
    rmSync(transcript.tapPath);
    hold = false;
    const end = await transcript.runner.step({ final: true });
    expect(transcript.stored().chunks.map((chunk) => [chunk.status, chunk.errorCode])).toEqual([
      ['FAILED', 'TRANSCRIPT_AUDIO_UNAVAILABLE'],
      ['FAILED', 'TRANSCRIPT_AUDIO_UNAVAILABLE'],
    ]);
    expect([end.transcriptState, end.partialReason, transcript.stored().audioUnavailable]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', true]);
    // …and the document carries that reason (row 78), with no text.
    const assembled = await assembleTranscript({ sessionScratchDir: transcript.dir, identity: transcript.identity, source: transcript.source, diarization: { enabled: true, engine: null }, model: MODEL_PROVENANCE, intervals: [], log: transcript.log });
    expect([assembled.document.header.state, assembled.document.header.partial_reason, assembled.document.header.failed_chunks, assembled.document.segments]).toEqual(['PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE', 2, []]);
  });

  it('NEGATIVE CONTROL: an ENGINE failure on a chunk whose audio is there stays CHUNKS_FAILED', async () => {
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false, prepare: (adapter) => void (adapter.answer = () => { throw new TranscriberError(TranscriberErrorCode.ENGINE_FAILED, 'stand-in', { reason: 'STAND_IN_FAILURE' }); }) });
    const end = await transcript.runner.step({ final: true });
    expect([end.transcriptState, end.partialReason, transcript.stored().audioUnavailable]).toEqual(['PARTIAL', 'CHUNKS_FAILED', false]);
  });

  it('control: a tap that GROWS between two steps is the ordinary case', async () => {
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false });
    await transcript.runner.step({ final: false });
    growTap(transcript.tapPath, new Int16Array(5 * SECOND));
    expect((await transcript.runner.step({ final: true })).transcriptState).toBe('READY');
  });
});

describe('N-10: a live session states its signals — nothing is off by omission', () => {
  const build = (overrides: Record<string, unknown>) => {
    const dir = scratchDir('n10');
    const path = writeTap(dir, tonePcm(10 * SECOND, []));
    return () => createTranscriptRunner({ sessionId: SESSION, adapter: createStubAdapter(), timeline: captureTapTimeline(), source: openPcmSource({ container: 'raw', path, sampleRateHz: TAP_RATE }), vad: createStubVad(), sessionScratchDir: dir, log: transcriptLog, tapLost: NO_TAP_SIGNAL, ...overrides } as never);
  };
  const transcriptLog = { error: () => undefined, warn: () => undefined, info: () => undefined, protect: () => undefined };
  const reason = (make: () => unknown): unknown => {
    try {
      make();
      return null;
    } catch (error) {
      return [(error as TranscriberError).code, (error as TranscriberError).detail['reason']];
    }
  };

  it('a tap timeline without a tap signal is CONFIG_INVALID / TAP_SIGNAL_NOT_STATED', () => {
    expect(reason(build({ tapLost: undefined }))).toEqual(['CONFIG_INVALID', 'TAP_SIGNAL_NOT_STATED']);
  });

  it('a tap timeline with an adapter that was composed without its capture worker is CONFIG_INVALID / CAPTURE_WORKER_NOT_STATED', () => {
    expect(reason(build({ adapter: { ...createStubAdapter(), captureWorkerStated: false } }))).toEqual(['CONFIG_INVALID', 'CAPTURE_WORKER_NOT_STATED']);
    expect(reason(build({ adapter: { ...createStubAdapter(), captureWorkerStated: undefined } }))).toEqual(['CONFIG_INVALID', 'CAPTURE_WORKER_NOT_STATED']);
  });

  it('…and so is a VAD engine that was composed without it', () => {
    expect(reason(build({ vad: { detect: async () => [], captureWorkerStated: false } }))).toEqual(['CONFIG_INVALID', 'CAPTURE_WORKER_NOT_STATED']);
  });

  it('control: with the explicit "none" values the same composition is accepted; a finished FILE (the fixture checks) needs neither', () => {
    expect(reason(build({}))).toBeNull();
    const dir = scratchDir('n10');
    const path = writeTap(dir, tonePcm(SECOND, []));
    expect(() => createTranscriptRunner({ sessionId: SESSION, adapter: { ...createStubAdapter(), captureWorkerStated: false }, timeline: decodedFileTimeline(TAP_RATE), source: openPcmSource({ container: 'raw', path, sampleRateHz: TAP_RATE }), vad: null, sessionScratchDir: dir, log: transcriptLog })).not.toThrow();
  });
});

describe('N-5: a short answer really said twice at the end of a chunk is kept; the phantom tail is still dropped', () => {
  const file = decodedFileTimeline(24_000);
  const tenSeconds = { from: 0, to: 24_000 * 10 };

  it('the navigator\'s case: "Ya." 5.0-7.5, then "ya" 7.9-10.03 — both kept, the second clamped to the audio end', () => {
    const result = clampSegments([{ id: 0, start: 5, end: 7.5, text: 'Ya.' }, { id: 1, start: 7.9, end: 10.03, text: 'ya' }], file, tenSeconds);
    expect(result.dropped).toEqual([]);
    expect(result.segments.map((segment) => [segment.startMs, segment.endMs, segment.text])).toEqual([[5000, 7500, 'Ya.'], [7900, 10_000, 'ya']]);
  });

  it('however far the engine overshoots: 2.1 s of real repeated speech inside the audio are never dropped for their text', () => {
    const result = clampSegments([{ id: 0, start: 5, end: 7.5, text: 'Ya.' }, { id: 1, start: 7.9, end: 40, text: 'ya' }], file, tenSeconds);
    expect([result.dropped, result.segments.at(-1)?.endMs]).toEqual([[], 10_000]);
  });

  it('the stated minimum is a boundary: a repeated remainder of 499 ms is dropped, one of 500 ms is kept', () => {
    expect(CLAMP_MIN_REMAINDER_MS).toBe(500);
    const at = (start: number) => clampSegments([{ id: 0, start: 5, end: 7.5, text: 'Ya.' }, { id: 1, start, end: 40, text: 'ya' }], file, tenSeconds).dropped;
    expect(at(9.501)).toEqual([{ reason: DropReason.CLAMPED_TAIL_REPEATS_PREVIOUS, index: 1 }]);
    expect(at(9.5)).toEqual([]);
  });

  it('the phantom tail of the stored engine answer (starts 181 ms before the audio end, ends 29.8 s after it, repeats the previous text) is dropped as before', () => {
    const whole = { from: 0, to: 1_577_280 };
    const result = clampSegments([{ id: 15, start: 63.74, end: 65.54, text: 'Terima kasih atas kerjasamanya.' }, { id: 16, start: 65.54, end: 95.52000000000001, text: 'Terima kasih atas kerjasamanya.' }], file, whole);
    expect(result.dropped).toEqual([{ reason: DropReason.CLAMPED_TAIL_REPEATS_PREVIOUS, index: 1 }]);
    expect(result.segments.map((segment) => segment.endMs)).toEqual([65_540]);
  });
});

describe('N-6: a lost checkpoint FILE is rebuilt in NEW rows — an old row never gets new segments under its old range', () => {
  it('the table keeps the rows of the lost file untouched; the rebuilt transcript takes row numbers above them; the rebuild is logged', async () => {
    const mirror = createMemoryChunkMirror();
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, runner: { mirror } });
    const before = (await mirror.read(SESSION)).map((row) => ({ ...row }));
    expect(before.map((row) => row.seq)).toEqual([1, 2]);
    rmSync(join(transcript.dir, TRANSCRIPT_CHECKPOINT_FILE));
    // The second run plans OTHER ranges (no VAD: fixed windows), as in the navigator's scenario.
    const rebuilt = createTranscriptRunner({ sessionId: SESSION, adapter: transcript.adapter, timeline: transcript.identity.timeline, source: transcript.source, vad: null, sessionScratchDir: transcript.dir, log: transcript.log, mirror, tapLost: NO_TAP_SIGNAL });
    expect((await rebuilt.step({ final: true })).complete).toBe(true);
    const after = await mirror.read(SESSION);
    expect(after.filter((row) => row.seq <= 2)).toEqual(before); // byte for byte what the lost file had written
    expect(after.filter((row) => row.seq > 2).map((row) => row.seq)).toEqual(rebuilt.checkpoint().chunks.map((chunk) => chunk.seq));
    expect(rebuilt.checkpoint().chunks.every((chunk) => chunk.seq > 2)).toBe(true);
    // Every row's segments lie inside that row's own range.
    for (const row of after) for (const segment of row.segments ?? []) expect(segment.startMs >= row.audioFromMs && segment.endMs <= row.audioToMs).toBe(true);
    expect(transcript.log.records().filter((record) => record.context['reason'] === 'CHECKPOINT_REBUILT')).toMatchObject([{ level: 'warn', context: { staleRows: 2, nextSeq: 3 } }]);
  });

  it('control: a resume WITH its checkpoint file takes no new row and logs no rebuild', async () => {
    const mirror = createMemoryChunkMirror();
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, runner: { mirror } });
    const resumed = createTranscriptRunner({ sessionId: SESSION, adapter: transcript.adapter, timeline: transcript.identity.timeline, source: transcript.source, vad: createStubVad(), sessionScratchDir: transcript.dir, log: transcript.log, mirror, tapLost: NO_TAP_SIGNAL });
    await resumed.step({ final: true });
    expect((await mirror.read(SESSION)).map((row) => row.seq)).toEqual([1, 2]);
    expect(transcript.log.records().filter((record) => record.context['reason'] === 'CHECKPOINT_REBUILT')).toEqual([]);
  });
});

describe('temporary audio (D-77-1): unencrypted session audio does not stay behind', () => {
  it('at the end of a run the work directory is gone', async () => {
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND });
    expect(existsSync(join(transcript.dir, 'work'))).toBe(false);
  });

  it('what a killed pipeline left (a chunk file, a VAD window, a labelling file, an engine record) is removed before a resume does anything, and said in the log', async () => {
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND, finish: false });
    mkdirSync(join(transcript.dir, 'work'), { recursive: true });
    for (const name of ['chunk-2.wav', 'vad-window.wav', 'diarization-segments.pcm', 'engine.json']) writeFileSync(join(transcript.dir, 'work', name), 'session audio');
    const decodedBefore = transcript.adapter.decodedOffsets.length;
    createTranscriptRunner({ sessionId: SESSION, adapter: transcript.adapter, timeline: transcript.identity.timeline, source: transcript.source, vad: createStubVad(), sessionScratchDir: transcript.dir, log: transcript.log, tapLost: NO_TAP_SIGNAL });
    expect(readdirSync(join(transcript.dir, 'work'))).toEqual([]);
    expect(transcript.adapter.decodedOffsets.length).toBe(decodedBefore);
    expect(transcript.log.records().filter((record) => record.context['reason'] === 'STALE_WORK_CLEARED')).toMatchObject([{ level: 'warn', context: { files: 4, engineStopped: false } }]);
  });

  it('on abandon or after the assembly: `discardTranscriptAudio` removes the work directory and the raw tap copy, and NOT the checkpoint or the transcript', async () => {
    const transcript = await transcriptOf({ bursts: TWO, total: 60 * SECOND });
    await assembleTranscript({ sessionScratchDir: transcript.dir, identity: transcript.identity, source: transcript.source, diarization: { enabled: true, engine: null }, model: MODEL_PROVENANCE, intervals: [], log: transcript.log });
    mkdirSync(join(transcript.dir, 'work'), { recursive: true });
    writeFileSync(join(transcript.dir, 'work', 'chunk-9.wav'), 'session audio');
    discardTranscriptAudio(transcript.dir, transcript.tapPath);
    expect(readdirSync(transcript.dir).sort()).toEqual(['transcript-checkpoint.json', 'transcript.json', 'transcript.srt', 'transcript.vtt']);
    // Twice is harmless.
    expect(() => discardTranscriptAudio(transcript.dir, transcript.tapPath)).not.toThrow();
  });
});
