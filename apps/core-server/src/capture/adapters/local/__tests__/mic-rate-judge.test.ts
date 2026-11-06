// The microphone rate judge of the attended run (integration pass C2; decision D117). GENERATED
// arrival sequences only: no device, no process. The judge is `judgeArrivalRate` of
// `mic-stream-check.ts`, the function `e2e/local-mic-capture.ts` prints its verdict from.
import { describe, expect, it } from 'vitest';
import { MIC_RATE_TOLERANCE, judgeArrivalRate, type ChunkArrival } from './mic-stream-check';

/**
 * A generated source: `rateHz` true samples per second, delivered in chunks of `chunk` samples, the
 * first chunk `lateMs` after the helper's start, for `seconds` of delivery. `jitterMs` moves each
 * arrival by a fixed pattern (no randomness: the same sequence every run).
 */
function source(options: { rateHz: number; lateMs: number; seconds?: number; chunk?: number; jitterMs?: number; startedAtMs?: number }): { startedAtMs: number; arrivals: ChunkArrival[] } {
  const chunk = options.chunk ?? 512;
  const startedAtMs = options.startedAtMs ?? 5_000;
  const periodMs = (chunk * 1000) / options.rateHz;
  const count = Math.floor(((options.seconds ?? 10) * 1000) / periodMs) + 1;
  const arrivals: ChunkArrival[] = [];
  for (let index = 0; index < count; index += 1) {
    const wobble = index === 0 || index === count - 1 ? 0 : (options.jitterMs ?? 0) * (((index * 7) % 5) - 2) * 0.5;
    arrivals.push({ atMs: startedAtMs + options.lateMs + index * periodMs + wobble, samples: chunk });
  }
  return { startedAtMs, arrivals };
}
const judge = (generated: ReturnType<typeof source>, settleMs = 0) => judgeArrivalRate({ ...generated, expectedSamplesPerSecond: 48_000, settleMs });

describe('the rate is judged between the first and the last chunk; the opening time is its own number', () => {
  it('a true 48 kHz source that starts 1.1 s late PASSES and reports about 1.1 s of opening latency', () => {
    const verdict = judge(source({ rateHz: 48_000, lateMs: 1_100 }));
    expect(verdict.ratePass).toBe(true);
    expect(verdict.observedSamplesPerSecond).toBe(48_000);
    expect(verdict.openingLatencyMs).toBe(1_100);
    expect(verdict.spanMs).toBeGreaterThan(9_990);
  });

  it('the same source read over a window from the helper start would read about 43 kHz: that number is shown, never judged', () => {
    const verdict = judge(source({ rateHz: 48_000, lateMs: 1_100 }));
    expect(verdict.rateOverWindowFromStart).toBeGreaterThan(42_500);
    expect(verdict.rateOverWindowFromStart).toBeLessThan(43_600);
    expect(Math.abs((verdict.rateOverWindowFromStart as number) - 48_000) / 48_000).toBeGreaterThan(MIC_RATE_TOLERANCE);
    expect(verdict.ratePass).toBe(true);
  });

  it('a true 44.1 kHz source still FAILS, late or not', () => {
    for (const lateMs of [0, 1_100]) {
      const verdict = judge(source({ rateHz: 44_100, lateMs }));
      expect(verdict.ratePass, String(lateMs)).toBe(false);
      expect(verdict.observedSamplesPerSecond).toBe(44_100);
    }
  });

  it('the tolerance is the 2 % the check defines: 48 kHz +/- 1.9 % passes, +/- 2.1 % fails', () => {
    expect(MIC_RATE_TOLERANCE).toBe(0.02);
    for (const [rateHz, pass] of [[48_000 * 1.019, true], [48_000 * 0.981, true], [48_000 * 1.021, false], [48_000 * 0.979, false]] as const) {
      expect(judge(source({ rateHz, lateMs: 300 })).ratePass, String(rateHz)).toBe(pass);
    }
  });

  it('arrival jitter of a few milliseconds does not change the verdict', () => {
    expect(judge(source({ rateHz: 48_000, lateMs: 1_100, jitterMs: 8 })).ratePass).toBe(true);
    expect(judge(source({ rateHz: 44_100, lateMs: 1_100, jitterMs: 8 })).ratePass).toBe(false);
  });

  it('the shape the attended run printed (D117) - chunks of 512 samples arriving evenly every 12 ms from the first chunk on - FAILS: a late start does not explain it', () => {
    // 426,496 samples in a 10 s window counted FROM THE FIRST CHUNK, 833 chunks, largest gap 23 ms: 512 samples every 12 ms is 42,667 per second.
    const verdict = judge(source({ rateHz: 42_667, lateMs: 1_100 }));
    expect(verdict.ratePass).toBe(false);
    expect(verdict.observedSamplesPerSecond).toBeGreaterThan(42_600);
    expect(verdict.observedSamplesPerSecond).toBeLessThan(42_750);
    expect(verdict.modalChunkSamples).toBe(512);
    expect(verdict.medianArrivalIntervalMs).toBeCloseTo(12, 1);
    // A 48 kHz device hands the same chunk every 10.67 ms: the interval is the number that tells the two apart.
    expect(judge(source({ rateHz: 48_000, lateMs: 1_100 })).medianArrivalIntervalMs).toBeCloseTo(10.67, 1);
  });

  it('a generated input bursts half a second at the start: judged from the first chunk it reads high, judged after 1 s of settling it passes', () => {
    const paced = source({ rateHz: 48_000, lateMs: 200 });
    // Half a second of audio (47 chunks of 512) handed over at once with the first chunk.
    const burst: ChunkArrival[] = Array.from({ length: 47 }, (_unused, index) => ({ atMs: paced.startedAtMs + 200 + index * 0.05, samples: 512 }));
    const arrivals = [...burst, ...paced.arrivals.map((chunk) => ({ ...chunk, atMs: chunk.atMs + 3 }))];
    expect(judgeArrivalRate({ startedAtMs: paced.startedAtMs, arrivals, expectedSamplesPerSecond: 48_000 }).ratePass).toBe(false);
    expect(judgeArrivalRate({ startedAtMs: paced.startedAtMs, arrivals, expectedSamplesPerSecond: 48_000, settleMs: 1_000 }).ratePass).toBe(true);
  });

  it('nothing, one chunk, or less than 2 s of chunks form no rate and do not pass', () => {
    expect(judgeArrivalRate({ startedAtMs: 0, arrivals: [], expectedSamplesPerSecond: 48_000 })).toMatchObject({ ratePass: false, observedSamplesPerSecond: null, openingLatencyMs: null, chunks: 0 });
    expect(judgeArrivalRate({ startedAtMs: 0, arrivals: [{ atMs: 900, samples: 512 }], expectedSamplesPerSecond: 48_000 })).toMatchObject({ ratePass: false, observedSamplesPerSecond: null, openingLatencyMs: 900 });
    expect(judge(source({ rateHz: 48_000, lateMs: 100, seconds: 1.5 }))).toMatchObject({ ratePass: false, observedSamplesPerSecond: null });
  });
});
