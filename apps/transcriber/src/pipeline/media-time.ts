/**
 * MEDIA TIME (transcript spec §A.2 "Timeline mapping", erratum PE-111-08; decision D72(d)).
 *
 * Every chunk and every segment this pipeline writes is in MEDIA TIME OF THE SEALED FILE: the
 * millisecond a player shows when the camera file is replayed. Two kinds of audio can be chunked,
 * and they count from different instants:
 *
 *   PCM_TAP       the capture worker's PCM tap: 48 kHz mono signed 16-bit samples counted from the
 *                 host instant T0 (tap sample `n` was captured at T0 + n / 48000 s). The file
 *                 starts EARLIER than T0, by the media-time origin of the capture contract, so
 *
 *                     file time of tap sample n = (n + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES) / 48000 s
 *
 *                 THIS IS THE AUDIO THE PIPELINE CHUNKS WHILE A SESSION RECORDS (row 77): the
 *                 sealed file does not exist yet, and the transcript is incremental (R-5).
 *   DECODED_FILE  audio decoded from a file (the sealed fixture of the functional checks, or a
 *                 finished `AUDIO-01` track): its sample 0 IS file time 0. No offset.
 *
 * The origin is IMPORTED from `@dems/shared`; its value is written nowhere in this workspace (a
 * static rule holds that for this folder). It follows the mux flags of the capture worker and
 * would change with them.
 *
 * THE GRID. Chunk boundaries of the tap snap outwards to the AAC frame grid of the file (§A.2).
 * Under the pinned mux flags the origin is exactly the priming of ONE AAC frame, so the step of
 * the grid is the same shared constant. If the capture contract ever sets the origin to 0 there is
 * no step to take from it: `captureTapTimeline` then refuses instead of inventing one.
 */
import { CAPTURE_AUDIO_SAMPLE_RATE_HZ, CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES } from '@dems/shared/api';
import { TranscriberError, TranscriberErrorCode } from '../types';

export const AudioSourceKind = { PCM_TAP: 'PCM_TAP', DECODED_FILE: 'DECODED_FILE' } as const;
export type AudioSourceKind = (typeof AudioSourceKind)[keyof typeof AudioSourceKind];

export interface AudioTimeline {
  readonly kind: AudioSourceKind;
  readonly sampleRateHz: number;
  /** File time of source sample 0, in samples at `sampleRateHz`. */
  readonly originSamples: number;
  /** The step chunk boundaries snap to, in FILE-time samples at `sampleRateHz`. 1 = every sample. */
  readonly gridSamples: number;
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/**
 * The timeline of the capture worker's PCM tap. `originSamples` is a parameter ONLY so that the
 * known-offset check can show a wrong value failing; production code calls it with no argument.
 */
export function captureTapTimeline(originSamples: number = CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES): AudioTimeline {
  if (!positiveInteger(originSamples)) {
    throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'the media-time origin of the capture contract gives no frame grid', { reason: 'MEDIA_TIME_ORIGIN_NOT_A_FRAME' });
  }
  return Object.freeze({ kind: AudioSourceKind.PCM_TAP, sampleRateHz: CAPTURE_AUDIO_SAMPLE_RATE_HZ, originSamples, gridSamples: originSamples });
}

/** The timeline of audio decoded from a file: already in file time, every sample is a boundary. */
export function decodedFileTimeline(sampleRateHz: number): AudioTimeline {
  if (!positiveInteger(sampleRateHz)) {
    throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'the sample rate of the audio must be a positive integer', { reason: 'SAMPLE_RATE_INVALID' });
  }
  return Object.freeze({ kind: AudioSourceKind.DECODED_FILE, sampleRateHz, originSamples: 0, gridSamples: 1 });
}

/** Media time of the sealed file, in whole milliseconds, of source sample `sample`. Rounded: engine and frame times are not whole. */
export function sampleToMediaMs(timeline: AudioTimeline, sample: number): number {
  return Math.round(((sample + timeline.originSamples) * 1000) / timeline.sampleRateHz);
}

/** A span of milliseconds as a count of source samples (rounded). */
export function msToSamples(timeline: AudioTimeline, ms: number): number {
  return Math.round((ms * timeline.sampleRateHz) / 1000);
}

export interface SampleRange {
  /** First source sample, inclusive. */
  readonly from: number;
  /** Last source sample, exclusive. */
  readonly to: number;
}

/**
 * Snaps a range of SOURCE samples outwards to the grid of the FILE (start down, end up), and keeps
 * it inside what exists (`0 .. available`). The grid is counted from file time 0, so a tap range
 * is moved by the origin before it is snapped and moved back afterwards.
 */
export function snapToGrid(timeline: AudioTimeline, range: SampleRange, available: number): SampleRange {
  const grid = timeline.gridSamples;
  const origin = timeline.originSamples;
  const from = Math.floor((range.from + origin) / grid) * grid - origin;
  const to = Math.ceil((range.to + origin) / grid) * grid - origin;
  return { from: Math.max(0, from), to: Math.min(available, to) };
}

/**
 * A time the engine reported INSIDE a chunk (seconds from the first sample of the chunk), as media
 * time of the sealed file in whole milliseconds. `chunkFromSample` is the first source sample of
 * the chunk.
 */
export function chunkSecondsToMediaMs(timeline: AudioTimeline, chunkFromSample: number, seconds: number): number {
  return Math.round(((chunkFromSample + timeline.originSamples) * 1000) / timeline.sampleRateHz + seconds * 1000);
}
