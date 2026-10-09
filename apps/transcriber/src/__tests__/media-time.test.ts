// Media time of the sealed file (row 77; transcript spec §A.2 "Timeline mapping", PE-111-08;
// D72(d)). The known-offset check passes with the shared constant and FAILS with any other origin
// (report §0 rule 3). The companion file `media-time-wrong-constant.test.ts` replaces the constant
// of `@dems/shared` itself and shows the same check failing.
import { CAPTURE_AUDIO_SAMPLE_RATE_HZ, CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { AudioSourceKind, captureTapTimeline, chunkSecondsToMediaMs, decodedFileTimeline, msToSamples, sampleToMediaMs, snapToGrid, type AudioTimeline } from '../pipeline/media-time';
import { TranscriberError } from '../types';
import { BURST_FROM_TAP_SAMPLE, EXPECTED_SEGMENT_START_MS, expectKnownOffset, observeKnownOffset } from './known-offset';

describe('row 77 known-offset check: a burst at a known tap sample lands at its media time of the sealed file', () => {
  it('with the shared constant: chunk, segment and mirror row are where the capture contract puts them', async () => {
    const seen = await expectKnownOffset(captureTapTimeline());
    // Said once more in the terms of the contract, with the numbers written out: (n + 1024) / 48000 s.
    expect(seen.segmentStartMs).toBe(Math.round(((BURST_FROM_TAP_SAMPLE + 1024) * 1000) / 48000));
    expect(seen.segmentStartMs).toBe(2005);
  });

  it('the tap timeline IS the shared constant: origin and grid are the imported value, the rate is the capture rate', () => {
    const timeline = captureTapTimeline();
    expect(timeline).toEqual({ kind: AudioSourceKind.PCM_TAP, sampleRateHz: CAPTURE_AUDIO_SAMPLE_RATE_HZ, originSamples: CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES, gridSamples: CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES });
    expect(Object.isFrozen(timeline)).toBe(true);
  });

  const wrongOrigins: readonly (readonly [string, AudioTimeline])[] = [
    ['no origin at all (the tap read as if it were file time)', { kind: 'PCM_TAP', sampleRateHz: 48_000, originSamples: 0, gridSamples: 1024 }],
    ['twice the origin', captureTapTimeline(2048)],
    ['half the origin', captureTapTimeline(512)],
    ['an origin of 960 samples (another codec frame)', captureTapTimeline(960)],
    ['the origin with the wrong sign', { kind: 'PCM_TAP', sampleRateHz: 48_000, originSamples: -1024, gridSamples: 1024 }],
  ];

  it.each(wrongOrigins)('NEGATIVE CONTROL — %s: the same check FAILS', async (_label, timeline) => {
    await expect(expectKnownOffset(timeline)).rejects.toThrow();
  });

  it('negative control, quantified: without the origin the tone is reported 21 ms early, with twice the origin 22 ms late', async () => {
    const none = await observeKnownOffset({ kind: 'PCM_TAP', sampleRateHz: 48_000, originSamples: 0, gridSamples: 1024 });
    const twice = await observeKnownOffset(captureTapTimeline(2048));
    expect(none.segmentStartMs).toBe(1984);
    expect(EXPECTED_SEGMENT_START_MS - none.segmentStartMs).toBe(21);
    expect(twice.segmentStartMs).toBe(2027); // (95232 + 2048) / 48000 s = 2.026666… s
    expect(twice.segmentStartMs - EXPECTED_SEGMENT_START_MS).toBe(22);
  });

  it('the resolution of the check, said plainly: the output is whole milliseconds, so an origin wrong by ONE sample (0.02 ms) is not seen', async () => {
    const seen = await observeKnownOffset(captureTapTimeline(1025));
    expect(seen.segmentStartMs).toBe(EXPECTED_SEGMENT_START_MS);
    // …but 24 samples (half a millisecond) and more are: the smallest origin error that moves the rounded onset.
    const half = await observeKnownOffset(captureTapTimeline(1024 + 24));
    expect(half.segmentStartMs).not.toBe(EXPECTED_SEGMENT_START_MS);
  });

  it('an origin that gives no frame grid is refused, never replaced by a guess', () => {
    for (const origin of [0, -1, 1.5, Number.NaN]) expect(() => captureTapTimeline(origin)).toThrow(TranscriberError);
  });
});

describe('media time: the conversions', () => {
  const tap = captureTapTimeline();

  it('tap sample 0 is one AAC frame into the file; a decoded file starts at 0', () => {
    expect(sampleToMediaMs(tap, 0)).toBe(21);
    expect(sampleToMediaMs(tap, 48_000)).toBe(1021);
    expect(sampleToMediaMs(decodedFileTimeline(24_000), 0)).toBe(0);
    expect(sampleToMediaMs(decodedFileTimeline(24_000), 24_000)).toBe(1000);
  });

  it('boundaries snap OUTWARDS to the frame grid of the FILE, and stay inside what exists', () => {
    // File frame boundaries are tap samples 0, 1024, 2048, … minus nothing: tap n is file n + 1024.
    expect(snapToGrid(tap, { from: 1500, to: 2500 }, 100_000)).toEqual({ from: 1024, to: 3072 });
    expect(snapToGrid(tap, { from: 1024, to: 2048 }, 100_000)).toEqual({ from: 1024, to: 2048 });
    expect(snapToGrid(tap, { from: 10, to: 2500 }, 2600)).toEqual({ from: 0, to: 2600 });
    for (const range of [snapToGrid(tap, { from: 77_777, to: 99_999 }, 1_000_000)]) {
      expect((range.from + 1024) % 1024).toBe(0);
      expect((range.to + 1024) % 1024).toBe(0);
      expect(range.from).toBeLessThanOrEqual(77_777);
      expect(range.to).toBeGreaterThanOrEqual(99_999);
    }
    // A decoded file has no grid: every sample is a boundary.
    expect(snapToGrid(decodedFileTimeline(24_000), { from: 7, to: 13 }, 100)).toEqual({ from: 7, to: 13 });
  });

  it('engine times are floating-point seconds and are ROUNDED to whole milliseconds', () => {
    const file = decodedFileTimeline(24_000);
    expect(chunkSecondsToMediaMs(file, 0, 95.52000000000001)).toBe(95_520);
    expect(chunkSecondsToMediaMs(file, 0, 65.53999999999999)).toBe(65_540);
    expect(chunkSecondsToMediaMs(file, 24_000, 0.0004)).toBe(1000);
    expect(chunkSecondsToMediaMs(tap, 95_232, 0.25)).toBe(2255);
    expect(msToSamples(tap, 30_000)).toBe(1_440_000);
  });
});
