// The checker of a microphone stream (blueprint row 135; checks M4-LOCAL-MIC-1 support,
// M4-LOCAL-WORKER-1): given the bytes read from the pipe, does the stream have the format the mic
// transport states - 32-bit float little-endian, the rate, the channel count? The decision is made
// from NUMBERS only (a tone's period in samples), never by listening. Used by the generated-input test
// and by the attended script; not shipped.
import type { MicTransportStatement } from '../../mic-transport';

export interface StreamFacts {
  readonly bytes: number;
  readonly samples: number;
  readonly aligned: boolean;
  readonly finite: boolean;
  readonly peak: number;
  /** Rate implied by the period of a known tone, in samples per second; null when the tone is not there. */
  readonly impliedRateHz: number | null;
}

/** Reads `bytes` as float 32 little-endian and, given the frequency of the tone that was generated, the rate that tone implies. */
export function streamFacts(bytes: Buffer, toneHz: number): StreamFacts {
  const aligned = bytes.length % 4 === 0;
  const samples = Math.floor(bytes.length / 4);
  let finite = true;
  let peak = 0;
  const skip = Math.min(2_400, Math.floor(samples / 4));
  let crossings = 0;
  let previous = 0;
  for (let index = 0; index < samples; index += 1) {
    const value = bytes.readFloatLE(index * 4);
    if (!Number.isFinite(value)) {
      finite = false;
      continue;
    }
    if (Math.abs(value) > peak) peak = Math.abs(value);
    if (index >= skip && previous <= 0 && value > 0) crossings += 1;
    previous = value;
  }
  const measured = samples - skip;
  const impliedRateHz = finite && crossings >= 8 && measured > 0 ? (toneHz * measured) / crossings : null;
  return { bytes: bytes.length, samples, aligned, finite, peak, impliedRateHz };
}

/** The reasons the stream is not the transport's stream; empty when it is. */
export function streamRefusals(facts: StreamFacts, statement: MicTransportStatement): string[] {
  const reasons: string[] = [];
  if (statement.sampleFormat !== 'F32LE') reasons.push('the transport statement is not float 32');
  if (!facts.aligned) reasons.push('byte count is not a multiple of 4 (not 32-bit samples)');
  if (!facts.finite) reasons.push('samples are not all finite floats');
  if (facts.peak > 1.0001) reasons.push('samples outside [-1, 1] (not normalised float)');
  if (facts.peak < 0.01) reasons.push('silence: the tone is not in the stream');
  // The rate and the channel count are both read from the tone's period in sample slots: stereo would double the period, 44.1 kHz would shorten it.
  // Sample slots per second of an interleaved stream = rate x channels; the tone's period in slots gives that number.
  const expected = statement.sampleRateHz * statement.channels;
  if (facts.impliedRateHz === null) reasons.push('no tone period found');
  else if (Math.abs(facts.impliedRateHz - expected) / expected > 0.01) reasons.push(`period implies ${Math.round(facts.impliedRateHz)} sample slots per second, not ${expected} (${statement.channels} channel at ${statement.sampleRateHz} Hz)`);
  return reasons;
}

// ── The rate of a stream by ARRIVAL (integration pass C2; decision D117) ────────────────────────
//
// The attended run judges the microphone's rate from when its chunks arrive at the pipe. The rule:
//   rate = samples that arrived AFTER the reference chunk / time from the reference chunk to the last chunk.
// The reference chunk is the FIRST chunk (`settleMs` 0), so the time the device needs to open is never
// charged to the rate; that time is reported as its own number, `openingLatencyMs`. A generated input
// is judged with `settleMs` 1000 instead: the program paces a generated input with a burst of half a
// second at the start, which is not a property of any device.
// Reported beside the verdict, for a reader who must tell a late start from lost samples: the rate a
// whole window counted from the helper's start would give, the median interval between chunks and the
// most frequent chunk size.

/** One chunk as it arrived: when (milliseconds of one monotonic clock) and how many samples it held. */
export interface ChunkArrival {
  readonly atMs: number;
  readonly samples: number;
}

export interface ArrivalRateJudgement {
  readonly chunks: number;
  readonly samples: number;
  /** From the start of the helper to the first chunk; null when nothing arrived. */
  readonly openingLatencyMs: number | null;
  /** From the first to the last chunk. */
  readonly spanMs: number;
  /** The judged rate: samples after the reference chunk / time since it. Null when it cannot be formed. */
  readonly observedSamplesPerSecond: number | null;
  /** For comparison only: all samples / (last chunk - start of the helper). */
  readonly rateOverWindowFromStart: number | null;
  readonly medianArrivalIntervalMs: number | null;
  readonly maxArrivalGapMs: number | null;
  /** The chunk size that occurs most often, in samples. */
  readonly modalChunkSamples: number | null;
  readonly expectedSamplesPerSecond: number;
  readonly toleranceFraction: number;
  readonly ratePass: boolean;
}

/** The tolerance the attended check defines: 2 % of the stated rate. */
export const MIC_RATE_TOLERANCE = 0.02;
/** The judged span must be at least this long, or the rate is not formed (a fraction of a second proves nothing). */
export const MIC_RATE_MIN_SPAN_MS = 2_000;

export function judgeArrivalRate(input: { readonly startedAtMs: number; readonly arrivals: readonly ChunkArrival[]; readonly expectedSamplesPerSecond: number; readonly settleMs?: number; readonly toleranceFraction?: number }): ArrivalRateJudgement {
  const { arrivals, startedAtMs, expectedSamplesPerSecond } = input;
  const toleranceFraction = input.toleranceFraction ?? MIC_RATE_TOLERANCE;
  const settleMs = input.settleMs ?? 0;
  const samples = arrivals.reduce((sum, chunk) => sum + chunk.samples, 0);
  const first = arrivals[0];
  const last = arrivals[arrivals.length - 1];
  const nothing: ArrivalRateJudgement = { chunks: arrivals.length, samples, openingLatencyMs: null, spanMs: 0, observedSamplesPerSecond: null, rateOverWindowFromStart: null, medianArrivalIntervalMs: null, maxArrivalGapMs: null, modalChunkSamples: null, expectedSamplesPerSecond, toleranceFraction, ratePass: false };
  if (first === undefined || last === undefined) return nothing;

  // The reference chunk: the first one, or the first that arrived `settleMs` after it.
  let reference = 0;
  while (reference < arrivals.length - 1 && (arrivals[reference] as ChunkArrival).atMs - first.atMs < settleMs) reference += 1;
  const from = arrivals[reference] as ChunkArrival;
  let after = 0;
  for (let index = reference + 1; index < arrivals.length; index += 1) after += (arrivals[index] as ChunkArrival).samples;
  const judgedMs = last.atMs - from.atMs;
  const observed = judgedMs >= MIC_RATE_MIN_SPAN_MS ? (after * 1000) / judgedMs : null;

  const intervals: number[] = [];
  for (let index = 1; index < arrivals.length; index += 1) intervals.push((arrivals[index] as ChunkArrival).atMs - (arrivals[index - 1] as ChunkArrival).atMs);
  intervals.sort((a, b) => a - b);
  const sizes = new Map<number, number>();
  for (const chunk of arrivals) sizes.set(chunk.samples, (sizes.get(chunk.samples) ?? 0) + 1);
  const modal = [...sizes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const fromStartMs = last.atMs - startedAtMs;
  const round = (value: number, digits = 1): number => Math.round(value * 10 ** digits) / 10 ** digits;

  return {
    chunks: arrivals.length,
    samples,
    openingLatencyMs: round(first.atMs - startedAtMs),
    spanMs: round(last.atMs - first.atMs),
    observedSamplesPerSecond: observed === null ? null : Math.round(observed),
    rateOverWindowFromStart: fromStartMs > 0 ? Math.round((samples * 1000) / fromStartMs) : null,
    medianArrivalIntervalMs: intervals.length > 0 ? round(intervals[Math.floor(intervals.length / 2)] as number, 2) : null,
    maxArrivalGapMs: intervals.length > 0 ? round(intervals[intervals.length - 1] as number) : null,
    modalChunkSamples: modal === undefined ? null : modal[0],
    expectedSamplesPerSecond,
    toleranceFraction,
    ratePass: observed !== null && Math.abs(observed - expectedSamplesPerSecond) / expectedSamplesPerSecond <= toleranceFraction,
  };
}
