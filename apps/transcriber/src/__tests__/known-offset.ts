// THE KNOWN-OFFSET CHECK of row 77 (report §0 rule 3; pair-76 §3.8; D72(d)) — shared by the test
// that must pass and by the negative control that must fail (not a test file).
//
// A synthetic PCM tap holds silence and ONE burst of tone that starts at a KNOWN tap sample. The
// whole pipeline runs on it (intake, VAD, chunk plan, STT stand-in, clamp, checkpoint). What comes
// out must place the burst at the media time of the SEALED FILE that the capture contract gives
// for that tap sample:
//
//     file time of tap sample n = (n + 1024) / 48000 s          (capture spec §F "File time 0")
//
// THE EXPECTED VALUES BELOW ARE WRITTEN AS NUMBERS, ON PURPOSE. They do not import the shared
// constant: a check that computed its expectation from the constant it checks could not fail.
import { expect } from 'vitest';
import { createMemoryLog } from '../log';
import { openPcmSource } from '../pipeline/audio-source';
import type { AudioTimeline } from '../pipeline/media-time';
import { createMemoryChunkMirror } from '../pipeline/mirror';
import { NO_TAP_SIGNAL, createTranscriptRunner } from '../pipeline/runner';
import { SESSION, TAP_RATE, burstsOfWav, createStubAdapter, createStubVad, tonePcm, writeTap } from './pipeline-support';
import { scratchDir } from './support';

/** Tap sample 95,232 is file sample 96,256 = frame 94 of the file: a boundary of the AAC grid. */
export const BURST_FROM_TAP_SAMPLE = 95_232;
/** 1.5 s of tone: 72,000 samples, ending at tap sample 167,232 = file sample 168,256 (not on the grid). */
export const BURST_TO_TAP_SAMPLE = 167_232;
export const TAP_TOTAL_SAMPLES = 288_000;

/** (95232 + 1024) / 48000 s = 2.005333… s. */
export const EXPECTED_CHUNK_START_MS = 2_005;
/** The end snaps UP to file sample 168,960 (frame 165): 3.52 s. */
export const EXPECTED_CHUNK_END_MS = 3_520;
/**
 * The stand-in engine reports the tone where it hears it in the chunk. The onset of the tone is
 * tap sample 95,232 = 2.005333… s of the file; its end is tap sample 167,232 = (167232 + 1024) /
 * 48000 s = 3.505333… s. THE SEGMENT IS THE CHECK: wherever the chunk was cut, the tone must be
 * reported at the media time a player shows for it.
 */
export const EXPECTED_SEGMENT_START_MS = 2_005;
export const EXPECTED_SEGMENT_END_MS = 3_505;

export interface KnownOffsetObservation {
  readonly chunkStartMs: number;
  readonly chunkEndMs: number;
  readonly segmentStartMs: number;
  readonly segmentEndMs: number;
  readonly mirrorFromMs: number;
  readonly mirrorToMs: number;
  readonly fromSample: number;
}

/** Runs the pipeline on the known tap with `timeline` and says where it put the burst. */
export async function observeKnownOffset(timeline: AudioTimeline): Promise<KnownOffsetObservation> {
  const dir = scratchDir('known-offset');
  const tap = writeTap(dir, tonePcm(TAP_TOTAL_SAMPLES, [{ from: BURST_FROM_TAP_SAMPLE, to: BURST_TO_TAP_SAMPLE }]));
  const adapter = createStubAdapter();
  // The stand-in engine HEARS: it reports the tone where it finds it in the audio of the chunk it
  // was handed, in seconds from the first sample of that chunk, as a real engine does.
  adapter.answer = (chunk) => {
    if (chunk.audio.kind !== 'file') throw new Error('the pipeline hands the engine a file');
    const heard = burstsOfWav(chunk.audio.path);
    return heard.map((span, id) => ({ id, start: span.fromMs / 1000, end: span.toMs / 1000, text: 'nada uji' }));
  };
  const mirror = createMemoryChunkMirror();
  const runner = createTranscriptRunner({
    sessionId: SESSION,
    adapter,
    timeline,
    source: openPcmSource({ container: 'raw', path: tap, sampleRateHz: TAP_RATE }),
    vad: createStubVad(),
    sessionScratchDir: dir,
    log: createMemoryLog(),
    mirror,
    tapLost: NO_TAP_SIGNAL,
  });
  const report = await runner.step({ final: true });
  expect(report).toMatchObject({ planned: 1, decoded: 1, failed: 0, complete: true });
  const chunk = runner.checkpoint().chunks[0]!;
  const row = mirror.rows()[0]!;
  return {
    chunkStartMs: chunk.startMs,
    chunkEndMs: chunk.endMs,
    segmentStartMs: chunk.segments![0]!.startMs,
    segmentEndMs: chunk.segments![0]!.endMs,
    mirrorFromMs: row.audioFromMs,
    mirrorToMs: row.audioToMs,
    fromSample: chunk.fromSample,
  };
}

/** THE CHECK. Throws (an assertion error) when the burst is not where the capture contract puts it. */
export async function expectKnownOffset(timeline: AudioTimeline): Promise<KnownOffsetObservation> {
  const seen = await observeKnownOffset(timeline);
  expect(seen).toEqual({
    chunkStartMs: EXPECTED_CHUNK_START_MS,
    chunkEndMs: EXPECTED_CHUNK_END_MS,
    segmentStartMs: EXPECTED_SEGMENT_START_MS,
    segmentEndMs: EXPECTED_SEGMENT_END_MS,
    mirrorFromMs: EXPECTED_CHUNK_START_MS,
    mirrorToMs: EXPECTED_CHUNK_END_MS,
    fromSample: BURST_FROM_TAP_SAMPLE,
  });
  return seen;
}
