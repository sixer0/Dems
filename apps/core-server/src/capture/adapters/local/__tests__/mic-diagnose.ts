// The attended DIAGNOSTIC of the local microphone's rate (integration pass D3; decisions D128,
// D133 (3)). The user's run delivered 42,666 samples/s where 48,000 are declared: exactly 8/9. This
// file holds what the diagnostic is made of, as pure functions an agent can prove on generated
// numbers: the VARIANT TABLE (candidate helper arguments, none of them in production), the reader of
// the input format FFmpeg reports, and the arithmetic of one variant's result. `e2e/local-mic-capture.ts
// --diagnose` runs it; only the USER runs that with the device. Not shipped.
//
// WHAT THE VARIANTS DECIDE (each is 5 s of microphone at most):
//   A PRODUCTION      the production argument list, unchanged but for three things a measurement
//                     needs: the log level (so the program prints the input format), no progress
//                     report, standard output in place of the pipe. Reproduces the 8/9.
//   B RAW_PACKETS     the device's packets copied out untouched (no decoder, no filter, no resampler,
//                     no encoder). Rate here = buffers the program READ from the device x frames per
//                     buffer. Same deficit as A -> the samples are lost before anything of the
//                     output line runs (the device input). Full rate here -> the loss is in the
//                     output line (resampler / encoder), and A's arguments are at fault.
//   C FILL_BY_DEVICE_TIME   A plus a resampler that fills by the packets' own timestamps. Rate back
//                     at 48,000 WITH exact zeros (about 1/9 of the samples) -> the timestamps carry
//                     the holes: real buffers are missing. Rate unchanged -> the timestamps are
//                     contiguous: the device itself runs at the lower rate (a relabelled format).
//   D FILL_BY_WALL_CLOCK    the same with the packets stamped by the host clock at reading. A stop-gap
//                     candidate only: it would restore the RATE (the worker's +-5000 ppm bound) but
//                     not the missing sound.
// Reported input rate 44,100 with an observed 44,100 in B would be the third reading: the device is
// not a 48 kHz device and the program resamples (then A must read 48,000 and something else is wrong).
import { MIC_HELPER_TABLE, micPushArguments, type MicSource } from '../mic-helper-args';
import { PROGRESS_ARGUMENTS } from '../camera-helper-args';
import { judgeArrivalRate, type ChunkArrival } from './mic-stream-check';

export const MIC_DIAGNOSE_VARIANT_IDS = ['PRODUCTION', 'RAW_PACKETS', 'FILL_BY_DEVICE_TIME', 'FILL_BY_WALL_CLOCK'] as const;
export type MicDiagnoseVariantId = (typeof MIC_DIAGNOSE_VARIANT_IDS)[number];

/** How long one variant reads, and the latest moment its helper is killed: the microphone is open no longer than the second figure. */
export const MIC_DIAGNOSE_READ_MS = 5_000;
export const MIC_DIAGNOSE_KILL_MS = 5_750;
/** The most the microphone is open in one diagnostic run: every variant at its kill bound. */
export const MIC_DIAGNOSE_MAX_OPEN_SECONDS = (MIC_DIAGNOSE_VARIANT_IDS.length * MIC_DIAGNOSE_KILL_MS) / 1000;

export interface MicDiagnoseVariant {
  readonly id: MicDiagnoseVariantId;
  readonly letter: 'A' | 'B' | 'C' | 'D';
  /** The whole argument list; standard output carries the samples. */
  readonly args: readonly string[];
  /** The rate the variant's output declares; `INPUT` = whatever FFmpeg reports for the device (raw packets). */
  readonly declaredRate: number | 'INPUT';
  /** True when the output is the production format (float 32, mono): zeros can then be counted. */
  readonly float32Mono: boolean;
}

const STDOUT = 'pipe:1';
/** A path of the pipe's shape, only to ask the production table for its list; it is replaced by standard output and never created. */
const SHAPE_ONLY_PIPE = '/diagnose/SES-DIAGNOSE/MIC-03.pcm';
/** Fills by timestamp: a hole of 5 ms or more becomes exact zeros; smaller differences are stretched (at most 1,000 samples per second). */
const RESAMPLER_FILL = ['-af', 'aresample=async=1000:min_hard_comp=0.005'] as const;
const WALL_CLOCK = ['-use_wallclock_as_timestamps', '1'] as const;
const RAW_OUTPUT = ['-vn', '-map', '0:a:0', '-c:a', 'copy', '-f', 'data', '-flush_packets', '1', '-y'] as const;

/**
 * The production list as a measurement needs it: `-loglevel warning` -> `level+info` (the input
 * format is printed, every line carries its level), the progress pair removed (standard output is
 * the samples), the pipe path -> standard output. Nothing else differs; a test holds that.
 */
export function measuredProductionArguments(source: MicSource): string[] {
  const args = [...micPushArguments({ source, pipePath: SHAPE_ONLY_PIPE })];
  const level = args.indexOf('-loglevel');
  args[level + 1] = 'level+info';
  const progress = args.indexOf(PROGRESS_ARGUMENTS[0]);
  args.splice(progress, PROGRESS_ARGUMENTS.length);
  args[args.length - 1] = STDOUT;
  return args;
}

/**
 * The generated inputs of the PROOF (no device; an agent runs these): the same variant lists with the
 * input section swapped. Each delivers 512-frame buffers paced by the filter `arealtime`, like a device.
 *   TRUE_48K      48,000 frames/s, labelled 48,000.
 *   LOSSY_8_OF_9  the same with every ninth buffer removed, timestamps kept (holes): 42,667 frames/s.
 *   RELABEL_441   44,100 frames/s delivered in real time and LABELLED 48,000, timestamps contiguous.
 */
export const MIC_DIAGNOSE_GENERATED = Object.freeze({
  TRUE_48K: "sine=frequency=880:sample_rate=48000,asetnsamples=512,arealtime",
  LOSSY_8_OF_9: "sine=frequency=880:sample_rate=48000,asetnsamples=512,aselect='mod(n,9)',arealtime",
  RELABEL_441: 'sine=frequency=880:sample_rate=44100,asetnsamples=512,arealtime,asetrate=48000',
} as const);
export type MicDiagnoseGenerated = keyof typeof MIC_DIAGNOSE_GENERATED;

/** The device source of production, or one of the generated proofs. */
export type MicDiagnoseSource = { readonly kind: 'DEVICE'; readonly name: string } | { readonly kind: 'PROOF'; readonly generated: MicDiagnoseGenerated };

/** The four variants for a source. The device lists come from the production table; a proof swaps ONLY the input section. */
export function micDiagnoseVariants(source: MicDiagnoseSource): readonly MicDiagnoseVariant[] {
  const production = measuredProductionArguments(source.kind === 'DEVICE' ? source : { kind: 'GENERATED', tone: 'TONE_880' });
  const quietLength = MIC_HELPER_TABLE.quietLength - PROGRESS_ARGUMENTS.length;
  const outputAt = production.length - 1 - MIC_HELPER_TABLE.outputLength;
  const quiet = production.slice(0, quietLength);
  const input = source.kind === 'DEVICE' ? production.slice(quietLength, outputAt) : ['-f', 'lavfi', '-i', MIC_DIAGNOSE_GENERATED[source.generated]];
  const output = production.slice(outputAt); // the production output line + standard output
  const inputAt = input.indexOf('-i');
  const stamped = [...input.slice(0, inputAt), ...WALL_CLOCK, ...input.slice(inputAt)];
  return Object.freeze([
    { id: 'PRODUCTION', letter: 'A', args: Object.freeze([...quiet, ...input, ...output]), declaredRate: 48_000, float32Mono: true },
    { id: 'RAW_PACKETS', letter: 'B', args: Object.freeze([...quiet, ...input, ...RAW_OUTPUT, STDOUT]), declaredRate: 'INPUT', float32Mono: false },
    { id: 'FILL_BY_DEVICE_TIME', letter: 'C', args: Object.freeze([...quiet, ...input, ...RESAMPLER_FILL, ...output]), declaredRate: 48_000, float32Mono: true },
    { id: 'FILL_BY_WALL_CLOCK', letter: 'D', args: Object.freeze([...quiet, ...stamped, ...RESAMPLER_FILL, ...output]), declaredRate: 48_000, float32Mono: true },
  ] as const);
}

// ── What FFmpeg says about the input ───────────────────────────────────────────────────────────

export interface ReportedInput {
  /** The sample rate of the first audio stream of the input, as the program printed it; null when it printed none. */
  readonly sampleRateHz: number | null;
  readonly channels: number | null;
  /** The codec name the program printed (`pcm_f32le`, ...): the device's sample format. */
  readonly codec: string | null;
  /** Bytes of one sample of that codec; null when it is not a plain PCM name. */
  readonly bytesPerSample: number | null;
  /** Lines of level warning or worse (the program's own diagnostics); the text is never printed. */
  readonly diagnosticLines: number;
  readonly errorLines: number;
}

const CHANNELS: Readonly<Record<string, number>> = Object.freeze({ mono: 1, stereo: 2 });

/** Reads the program's standard error (log level `level+info`): the input's audio stream line and the count of warning / error lines. */
export function reportedInputOf(diagnostics: string): ReportedInput {
  let sampleRateHz: number | null = null;
  let channels: number | null = null;
  let codec: string | null = null;
  let diagnosticLines = 0;
  let errorLines = 0;
  let inInput = false;
  for (const line of diagnostics.split('\n')) {
    if (/\[(?:warning|error|fatal|panic)\]/.test(line)) diagnosticLines += 1;
    if (/\[(?:error|fatal|panic)\]/.test(line)) errorLines += 1;
    if (/Input #0,/.test(line)) inInput = true;
    else if (/Output #0,/.test(line)) inInput = false;
    if (!inInput || sampleRateHz !== null) continue;
    const stream = /Stream #0:\d+[^:]*: Audio: ([a-z0-9_]+)[^,]*, (\d+) Hz, ([^,\n]+)/.exec(line);
    if (stream === null) continue;
    codec = stream[1] ?? null;
    sampleRateHz = Number(stream[2]);
    const layout = (stream[3] ?? '').trim();
    const counted = /^(\d+) channels/.exec(layout);
    channels = CHANNELS[layout] ?? (counted === null ? null : Number(counted[1]));
  }
  const bits = codec === null ? null : /^pcm_[a-z]+?(8|16|24|32|64)/.exec(codec);
  return { sampleRateHz, channels, codec, bytesPerSample: bits === null || bits === undefined ? null : Number(bits[1]) / 8, diagnosticLines, errorLines };
}

// ── The arithmetic of one variant ──────────────────────────────────────────────────────────────

/** One chunk of standard output as it arrived: when, and how many BYTES. */
export interface ByteArrival {
  readonly atMs: number;
  readonly bytes: number;
}

export interface MicVariantNumbers {
  readonly variant: MicDiagnoseVariantId;
  /** The rate the output declares (the reported input rate for raw packets); null when FFmpeg reported none. */
  readonly declaredRate: number | null;
  /** Frames after the first chunk / time from the first to the last chunk; null when under 2 s arrived. */
  readonly observedRate: number | null;
  /** observed / declared, three decimals. */
  readonly ratio: number | null;
  /** The small fraction the ratio equals within 0.4 % (`1/1`, `8/9`, `147/160` = 44.1 / 48, ...); null when none does. */
  readonly ratioIs: string | null;
  readonly medianArrivalIntervalMs: number | null;
  /** What the modal chunk would take at the declared rate. */
  readonly expectedArrivalIntervalMs: number | null;
  readonly modalChunkFrames: number | null;
  readonly chunks: number;
  readonly frames: number;
  readonly openingLatencyMs: number | null;
  readonly spanMs: number;
  readonly ffmpegDiagnosticLines: number;
  readonly ffmpegErrorLines: number;
  readonly reportedInputRate: number | null;
  readonly reportedInputChannels: number | null;
  readonly reportedInputCodec: string | null;
  /** Float 32 mono outputs only: exact-zero samples per thousand, and the longest run of them. */
  readonly zeroPermille: number | null;
  readonly longestZeroRunMs: number | null;
}

/** The fractions a ratio is named by. 147/160 is 44,100 / 48,000; 160/147 its inverse; 8/9 the user's run. */
const NAMED_RATIOS: ReadonlyArray<readonly [string, number]> = [['1/1', 1], ['8/9', 8 / 9], ['147/160', 147 / 160], ['160/147', 160 / 147], ['9/8', 9 / 8], ['1/2', 1 / 2], ['1/3', 1 / 3], ['2/1', 2]];
const RATIO_NAME_TOLERANCE = 0.004;

export function nameOfRatio(ratio: number | null): string | null {
  if (ratio === null) return null;
  const named = NAMED_RATIOS.find(([, value]) => Math.abs(ratio - value) / value <= RATIO_NAME_TOLERANCE);
  return named === undefined ? null : named[0];
}

export interface MicVariantInput {
  readonly variant: Pick<MicDiagnoseVariant, 'id' | 'declaredRate' | 'float32Mono'>;
  /** The start of the helper, on the clock of the arrivals. */
  readonly startedAtMs: number;
  readonly arrivals: readonly ByteArrival[];
  readonly reported: ReportedInput;
  /** Float 32 mono outputs: the zeros counted while reading. */
  readonly zeroSamples?: number;
  readonly longestZeroRunSamples?: number;
}

/**
 * The numbers of one variant. Bytes become frames by the output's frame size: 4 bytes for the
 * production format; for raw packets, the reported bytes per sample x reported channels (no number
 * when FFmpeg reported neither - never a guess).
 */
export function micVariantNumbers(input: MicVariantInput): MicVariantNumbers {
  const { variant, reported, arrivals } = input;
  const declaredRate = variant.declaredRate === 'INPUT' ? reported.sampleRateHz : variant.declaredRate;
  const frameBytes = variant.float32Mono ? 4 : reported.bytesPerSample !== null && reported.channels !== null ? reported.bytesPerSample * reported.channels : null;
  const round = (value: number, digits: number): number => Math.round(value * 10 ** digits) / 10 ** digits;
  const base = {
    variant: variant.id,
    declaredRate,
    ffmpegDiagnosticLines: reported.diagnosticLines,
    ffmpegErrorLines: reported.errorLines,
    reportedInputRate: reported.sampleRateHz,
    reportedInputChannels: reported.channels,
    reportedInputCodec: reported.codec,
  };
  if (frameBytes === null || declaredRate === null) {
    return { ...base, observedRate: null, ratio: null, ratioIs: null, medianArrivalIntervalMs: null, expectedArrivalIntervalMs: null, modalChunkFrames: null, chunks: arrivals.length, frames: 0, openingLatencyMs: null, spanMs: 0, zeroPermille: null, longestZeroRunMs: null };
  }
  const chunks: ChunkArrival[] = arrivals.map((arrival) => ({ atMs: arrival.atMs, samples: arrival.bytes / frameBytes }));
  const judged = judgeArrivalRate({ startedAtMs: input.startedAtMs, arrivals: chunks, expectedSamplesPerSecond: declaredRate });
  const ratio = judged.observedSamplesPerSecond === null ? null : round(judged.observedSamplesPerSecond / declaredRate, 3);
  const frames = Math.floor(judged.samples);
  const zeros = variant.float32Mono && input.zeroSamples !== undefined && frames > 0;
  return {
    ...base,
    observedRate: judged.observedSamplesPerSecond,
    ratio,
    ratioIs: nameOfRatio(ratio),
    medianArrivalIntervalMs: judged.medianArrivalIntervalMs,
    expectedArrivalIntervalMs: judged.modalChunkSamples === null ? null : round((judged.modalChunkSamples * 1000) / declaredRate, 2),
    modalChunkFrames: judged.modalChunkSamples,
    chunks: judged.chunks,
    frames,
    openingLatencyMs: judged.openingLatencyMs,
    spanMs: judged.spanMs,
    zeroPermille: zeros ? round(((input.zeroSamples as number) * 1000) / frames, 1) : null,
    longestZeroRunMs: zeros ? round(((input.longestZeroRunSamples ?? 0) * 1000) / declaredRate, 1) : null,
  };
}

/**
 * What the results say together, as one closed word (the report's sentence is the reader's). Derived
 * from the numbers only; it names no fix.
 */
export type MicDiagnoseReading =
  | 'NO_DEFICIT' // A reads the declared rate: nothing to explain in this run
  | 'LOST_IN_OUTPUT_LINE' // B reads the reported rate in full, A is short: the output line's arguments lose samples
  | 'DEVICE_REPORTS_ANOTHER_RATE' // FFmpeg reports an input rate that is not the declared one, and B agrees with what is reported
  | 'BUFFERS_MISSING_BEFORE_OUTPUT_LINE' // A and B short alike, input reported at the declared rate, and C fills the holes with zeros: whole buffers never reached the program's reader
  | 'SOURCE_SLOWER_THAN_ITS_LABEL' // A, B and C short alike: timestamps contiguous, the source delivers fewer frames than the rate it reports
  | 'SHORT_BEFORE_OUTPUT_LINE' // A and B short alike, C did not decide between the two readings above
  | 'UNDECIDED';

const NEAR = 0.02;
const near = (a: number, b: number): boolean => Math.abs(a - b) <= NEAR;

export function readingOf(results: readonly MicVariantNumbers[]): MicDiagnoseReading {
  const of = (id: MicDiagnoseVariantId): MicVariantNumbers | undefined => results.find((result) => result.variant === id);
  const a = of('PRODUCTION');
  const b = of('RAW_PACKETS');
  const c = of('FILL_BY_DEVICE_TIME');
  if (a === undefined || a.ratio === null) return 'UNDECIDED';
  if (near(a.ratio, 1)) return 'NO_DEFICIT';
  if (b === undefined || b.ratio === null) return 'UNDECIDED';
  if (near(b.ratio, 1)) return b.reportedInputRate !== a.declaredRate ? 'DEVICE_REPORTS_ANOTHER_RATE' : 'LOST_IN_OUTPUT_LINE';
  if (b.reportedInputRate !== a.declaredRate || !near(b.ratio, a.ratio)) return 'UNDECIDED';
  if (c === undefined || c.ratio === null) return 'SHORT_BEFORE_OUTPUT_LINE';
  if (near(c.ratio, 1) && (c.zeroPermille ?? 0) >= 50) return 'BUFFERS_MISSING_BEFORE_OUTPUT_LINE';
  if (near(c.ratio, a.ratio)) return 'SOURCE_SLOWER_THAN_ITS_LABEL';
  return 'SHORT_BEFORE_OUTPUT_LINE';
}
