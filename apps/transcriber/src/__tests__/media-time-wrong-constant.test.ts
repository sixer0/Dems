// NEGATIVE CONTROL of the known-offset check, at the import itself (row 77 Verification: "a
// known-offset test fails when the media-time constant is wrong"; report §0 rule 3).
//
// In THIS file the constant `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES` of `@dems/shared/api` is replaced
// by wrong values, everything else of the package is kept. The production code is unchanged: it
// imports the constant by name, so it now computes with the wrong one. The known-offset check of
// `media-time.test.ts` (the same function, the same written-out expectation) must then FAIL.
import { describe, expect, it, vi } from 'vitest';

const wrong = vi.hoisted(() => ({ value: 2048 }));

vi.mock('@dems/shared/api', async (original) => {
  const real = await original<typeof import('@dems/shared/api')>();
  return {
    ...real,
    get CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES() {
      return wrong.value;
    },
  };
});

describe('row 77 known-offset check, NEGATIVE CONTROL: with a wrong shared constant the check fails', () => {
  it.each([2048, 512, 960, 1536, 1100])('shared constant replaced by %i: the pipeline places the burst elsewhere and the check throws', async (value) => {
    wrong.value = value;
    const { captureTapTimeline } = await import('../pipeline/media-time');
    const { expectKnownOffset, observeKnownOffset, EXPECTED_SEGMENT_START_MS } = await import('./known-offset');
    // The production default: no argument, so the value comes from the (replaced) shared constant.
    const timeline = captureTapTimeline();
    expect(timeline.originSamples).toBe(value);
    await expect(expectKnownOffset(timeline)).rejects.toThrow();
    const seen = await observeKnownOffset(timeline);
    // The tone is reported at the media time the WRONG origin gives: (95232 + value) / 48000 s.
    expect(seen.segmentStartMs).toBe(Math.round(((95_232 + value) * 1000) / 48_000));
    expect(seen.segmentStartMs).not.toBe(EXPECTED_SEGMENT_START_MS);
  });

  it('control of the control: with the replaced value set to the real one, the same check passes in this file too', async () => {
    wrong.value = 1024;
    const { captureTapTimeline } = await import('../pipeline/media-time');
    const { expectKnownOffset } = await import('./known-offset');
    await expect(expectKnownOffset(captureTapTimeline())).resolves.toMatchObject({ chunkStartMs: 2005, segmentStartMs: 2005 });
  });
});
