// The microphone diagnostic of pass D3 (decisions D128, D133 (3)): the variant table and the
// arithmetic, on GENERATED numbers only - no device, no process. `e2e/local-mic-capture.ts --diagnose`
// prints what these functions return; its `--proof` runs prove the same on the real program.
import { describe, expect, it } from 'vitest';
import { LOCAL_MIC_DEVICE_NAME, micPushArguments } from '../mic-helper-args';
import {
  MIC_DIAGNOSE_KILL_MS,
  MIC_DIAGNOSE_MAX_OPEN_SECONDS,
  MIC_DIAGNOSE_READ_MS,
  MIC_DIAGNOSE_VARIANT_IDS,
  measuredProductionArguments,
  micDiagnoseVariants,
  micVariantNumbers,
  nameOfRatio,
  readingOf,
  reportedInputOf,
  type ByteArrival,
  type MicDiagnoseVariantId,
  type MicVariantNumbers,
  type ReportedInput,
} from './mic-diagnose';

const DEVICE = { kind: 'DEVICE', name: LOCAL_MIC_DEVICE_NAME } as const;

/** What the program prints at `-loglevel level+info` for an input, in its real shape (taken from a generated run). */
const inputText = (codec: string, rateHz: number, layout: string, extra: string[] = []): string =>
  [`[info] Input #0, avfoundation, from 'none:x':`, `[info]   Duration: N/A, start: 0.010667, bitrate: N/A`, `[info]   Stream #0:0: Audio: ${codec}, ${rateHz} Hz, ${layout}, flt, 1536 kb/s, start 0.010667`, `[info] Stream mapping:`, `[info]   Stream #0:0 -> #0:0 (${codec} (native) -> pcm_f32le (native))`, `[info] Output #0, f32le, to 'pipe:1':`, `[info]   Stream #0:0: Audio: pcm_f32le, 48000 Hz, mono, flt, 1536 kb/s`, ...extra].join('\n');
const REPORTED_48K: ReportedInput = reportedInputOf(inputText('pcm_f32le', 48_000, 'mono'));

/**
 * A generated source: buffers of `chunk` frames, one every `everyMs`, the first `lateMs` after the
 * start, for `seconds`; `frameBytes` bytes per frame. The 42,667 /s source is 512 frames every 12 ms.
 */
function arrivalsOf(options: { chunk?: number; everyMs: number; seconds?: number; lateMs?: number; frameBytes?: number }): { startedAtMs: number; arrivals: ByteArrival[] } {
  const startedAtMs = 9_000;
  const count = Math.floor(((options.seconds ?? 4.6) * 1000) / options.everyMs) + 1;
  const arrivals: ByteArrival[] = [];
  for (let index = 0; index < count; index += 1) arrivals.push({ atMs: startedAtMs + (options.lateMs ?? 337) + index * options.everyMs, bytes: (options.chunk ?? 512) * (options.frameBytes ?? 4) });
  return { startedAtMs, arrivals };
}
const variantOf = (id: MicDiagnoseVariantId) => ({ id, declaredRate: id === 'RAW_PACKETS' ? ('INPUT' as const) : 48_000, float32Mono: id !== 'RAW_PACKETS' });
const numbers = (id: MicDiagnoseVariantId, everyMs: number, reported: ReportedInput = REPORTED_48K, extra: { zeroSamples?: number; longestZeroRunSamples?: number } = {}): MicVariantNumbers =>
  micVariantNumbers({ variant: variantOf(id), ...arrivalsOf({ everyMs }), reported, ...extra });

describe('the variant table: production first, three candidates behind it, production arguments untouched', () => {
  it('variant A is the production list but for the log level, the progress pair and the target', () => {
    const production = [...micPushArguments({ source: DEVICE, pipePath: '/diagnose/SES-DIAGNOSE/MIC-03.pcm' })];
    const measured = measuredProductionArguments(DEVICE);
    expect(micDiagnoseVariants(DEVICE)[0]?.args).toEqual(measured);
    const expected = production.filter((argument) => argument !== '-progress' && argument !== 'pipe:1');
    expected[expected.indexOf('-loglevel') + 1] = 'level+info';
    expected[expected.length - 1] = 'pipe:1';
    expect(measured).toEqual(expected);
    // The production output line and the device argument are in it unchanged.
    expect(measured.join(' ')).toContain('-f avfoundation -i none:MacBook Air Microphone -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y pipe:1');
  });

  it('four variants, in order; each opens the same device argument once, writes to standard output only and binds nothing', () => {
    const variants = micDiagnoseVariants(DEVICE);
    expect(variants.map((variant) => variant.id)).toEqual([...MIC_DIAGNOSE_VARIANT_IDS]);
    expect(variants.map((variant) => variant.letter)).toEqual(['A', 'B', 'C', 'D']);
    for (const variant of variants) {
      expect(variant.args.filter((argument) => argument === '-i')).toHaveLength(1);
      expect(variant.args[variant.args.indexOf('-i') + 1]).toBe('none:MacBook Air Microphone');
      expect(variant.args[variant.args.length - 1]).toBe('pipe:1');
      expect(variant.args.join(' ')).not.toMatch(/-progress|\.pcm|\.wav|rtsp|udp|tcp|listen|Capture screen|:\/\//);
      expect(variant.args.join(' ')).toMatch(/^-hide_banner -nostdin -nostats -loglevel level\+info /);
    }
    expect(variants[1]?.args.join(' ')).toContain('-map 0:a:0 -c:a copy -f data');
    expect(variants[1]?.args.join(' ')).not.toMatch(/-ar |-ac |-af /);
    expect(variants[2]?.args.join(' ')).toContain('-af aresample=async=1000:min_hard_comp=0.005 -vn -ac 1 -ar 48000');
    expect(variants[2]?.args).not.toContain('-use_wallclock_as_timestamps');
    expect(variants[3]?.args.join(' ')).toContain('-f avfoundation -use_wallclock_as_timestamps 1 -i none:MacBook Air Microphone -af aresample=');
  });

  it('a proof swaps the input section only: no device name, no avfoundation', () => {
    for (const generated of ['TRUE_48K', 'LOSSY_8_OF_9', 'RELABEL_441'] as const) {
      const device = micDiagnoseVariants(DEVICE);
      micDiagnoseVariants({ kind: 'PROOF', generated }).forEach((variant, index) => {
        expect(variant.args.join(' ')).not.toMatch(/avfoundation|MacBook/);
        expect(variant.args.join(' ').replace(/-f lavfi (-use_wallclock_as_timestamps 1 )?-i \S+/, 'INPUT')).toBe((device[index]?.args.join(' ') ?? '').replace(/-f avfoundation (-use_wallclock_as_timestamps 1 )?-i none:MacBook Air Microphone/, 'INPUT'));
      });
    }
  });

  it('the microphone bound the first line states: 4 variants x 5.75 s = 23 s, under the 25 s of the brief', () => {
    expect(MIC_DIAGNOSE_READ_MS).toBe(5_000);
    expect(MIC_DIAGNOSE_KILL_MS).toBe(5_750);
    expect(MIC_DIAGNOSE_MAX_OPEN_SECONDS).toBe(23);
    expect(MIC_DIAGNOSE_MAX_OPEN_SECONDS).toBeLessThanOrEqual(25);
  });
});

describe('what FFmpeg reports about the input', () => {
  it('reads codec, rate and channels of the INPUT stream, not of the output; counts warning and error lines without keeping them', () => {
    expect(reportedInputOf(inputText('pcm_f32le', 48_000, 'mono'))).toEqual({ sampleRateHz: 48_000, channels: 1, codec: 'pcm_f32le', bytesPerSample: 4, diagnosticLines: 0, errorLines: 0 });
    expect(reportedInputOf(inputText('pcm_s16le', 44_100, 'stereo', ['[warning] something', '[error] worse', '[aist#0:0/pcm_s16le @ 0x1] [warning] again']))).toEqual({ sampleRateHz: 44_100, channels: 2, codec: 'pcm_s16le', bytesPerSample: 2, diagnosticLines: 3, errorLines: 1 });
    expect(reportedInputOf(inputText('pcm_s24le', 96_000, '3 channels')).channels).toBe(3);
    expect(reportedInputOf(inputText('pcm_s24le', 96_000, '3 channels')).bytesPerSample).toBe(3);
  });

  it('a program that printed no input (it could not open it) gives nulls and its error count - never a guessed format', () => {
    expect(reportedInputOf('[error] Error opening input: Input/output error\n[error] Error opening input files: Input/output error\n')).toEqual({ sampleRateHz: null, channels: null, codec: null, bytesPerSample: null, diagnosticLines: 2, errorLines: 2 });
    const none = micVariantNumbers({ variant: variantOf('RAW_PACKETS'), startedAtMs: 0, arrivals: [], reported: reportedInputOf('') });
    expect([none.declaredRate, none.observedRate, none.ratio, none.chunks]).toEqual([null, null, null, 0]);
  });
});

describe('the arithmetic on generated sources', () => {
  it('a true 48 kHz source: 512 frames every 10.667 ms reads 48,000, ratio 1/1, interval as expected', () => {
    const result = numbers('PRODUCTION', 512_000 / 48_000);
    expect(result.observedRate).toBe(48_000);
    expect([result.declaredRate, result.ratio, result.ratioIs, result.modalChunkFrames]).toEqual([48_000, 1, '1/1', 512]);
    expect(result.medianArrivalIntervalMs).toBe(10.67);
    expect(result.expectedArrivalIntervalMs).toBe(10.67);
    expect(result.openingLatencyMs).toBe(337);
  });

  it('the 42,667 /s source (512 frames every 12 ms, the run of D128): 8/9, median 12 ms against 10.67 expected', () => {
    const result = numbers('PRODUCTION', 12);
    expect(result.observedRate).toBe(42_667);
    expect([result.ratio, result.ratioIs]).toEqual([0.889, '8/9']);
    expect([result.medianArrivalIntervalMs, result.expectedArrivalIntervalMs, result.modalChunkFrames]).toEqual([12, 10.67, 512]);
  });

  it('a 44.1 kHz source relabelled 48 kHz reads 44,100 against a declared 48,000: 147/160, NOT 8/9', () => {
    const result = numbers('PRODUCTION', 512_000 / 44_100);
    expect(result.observedRate).toBe(44_100);
    expect([result.ratio, result.ratioIs]).toEqual([0.919, '147/160']);
    // The user's number (42,666) is 3.3 % away from this candidate: far outside the naming tolerance.
    expect(nameOfRatio(42_666 / 48_000)).toBe('8/9');
    expect(nameOfRatio(44_100 / 48_000)).toBe('147/160');
    expect(nameOfRatio(0.95)).toBeNull();
  });

  it('raw packets are counted in the frame size FFmpeg reports (16-bit stereo = 4 bytes, 24-bit mono = 3) against the REPORTED rate', () => {
    const stereo = micVariantNumbers({ variant: variantOf('RAW_PACKETS'), ...arrivalsOf({ everyMs: 512_000 / 44_100, frameBytes: 4 }), reported: reportedInputOf(inputText('pcm_s16le', 44_100, 'stereo')) });
    expect([stereo.declaredRate, stereo.observedRate, stereo.ratioIs, stereo.modalChunkFrames]).toEqual([44_100, 44_100, '1/1', 512]);
    const mono24 = micVariantNumbers({ variant: variantOf('RAW_PACKETS'), ...arrivalsOf({ everyMs: 12, frameBytes: 3 }), reported: reportedInputOf(inputText('pcm_s24le', 48_000, 'mono')) });
    expect([mono24.declaredRate, mono24.observedRate, mono24.ratioIs]).toEqual([48_000, 42_667, '8/9']);
  });

  it('under two seconds of arrivals no rate is formed', () => {
    const short = micVariantNumbers({ variant: variantOf('PRODUCTION'), ...arrivalsOf({ everyMs: 12, seconds: 1.5 }), reported: REPORTED_48K });
    expect([short.observedRate, short.ratio, short.ratioIs]).toEqual([null, null, null]);
  });

  it('zeros are reported per thousand and as the longest run, for the float mono outputs only', () => {
    const filled = numbers('FILL_BY_DEVICE_TIME', 512_000 / 48_000, REPORTED_48K, { zeroSamples: 24_576, longestZeroRunSamples: 512 });
    expect(filled.frames).toBe(221_184);
    expect([filled.zeroPermille, filled.longestZeroRunMs]).toEqual([111.1, 10.7]);
    expect(numbers('RAW_PACKETS', 12, REPORTED_48K, { zeroSamples: 10 }).zeroPermille).toBeNull();
  });
});

describe('the reading of a run: one closed word from the numbers', () => {
  const full = 512_000 / 48_000;
  it('true 48 kHz: NO_DEFICIT', () => {
    expect(readingOf([numbers('PRODUCTION', full), numbers('RAW_PACKETS', full)])).toBe('NO_DEFICIT');
  });
  it('A and B at 8/9 with the input reported at 48 kHz, C back at 48 kHz with a ninth of zeros: BUFFERS_MISSING_BEFORE_OUTPUT_LINE', () => {
    expect(readingOf([numbers('PRODUCTION', 12), numbers('RAW_PACKETS', 12), numbers('FILL_BY_DEVICE_TIME', full, REPORTED_48K, { zeroSamples: 24_576, longestZeroRunSamples: 512 })])).toBe('BUFFERS_MISSING_BEFORE_OUTPUT_LINE');
  });
  it('A, B and C short alike: SOURCE_SLOWER_THAN_ITS_LABEL (timestamps contiguous)', () => {
    const slow = 512_000 / 44_100;
    expect(readingOf([numbers('PRODUCTION', slow), numbers('RAW_PACKETS', slow), numbers('FILL_BY_DEVICE_TIME', slow, REPORTED_48K, { zeroSamples: 0 })])).toBe('SOURCE_SLOWER_THAN_ITS_LABEL');
  });
  it('B full at the reported 48 kHz while A is short: LOST_IN_OUTPUT_LINE', () => {
    expect(readingOf([numbers('PRODUCTION', 12), numbers('RAW_PACKETS', full)])).toBe('LOST_IN_OUTPUT_LINE');
  });
  it('B full at a reported 44.1 kHz while A is short: DEVICE_REPORTS_ANOTHER_RATE', () => {
    const reported = reportedInputOf(inputText('pcm_f32le', 44_100, 'mono'));
    expect(readingOf([numbers('PRODUCTION', 12), numbers('RAW_PACKETS', 512_000 / 44_100, reported)])).toBe('DEVICE_REPORTS_ANOTHER_RATE');
  });
  it('without B, or with A and B disagreeing, nothing is decided; without C the two readings stay together', () => {
    expect(readingOf([numbers('PRODUCTION', 12)])).toBe('UNDECIDED');
    expect(readingOf([numbers('PRODUCTION', 12), numbers('RAW_PACKETS', 11)])).toBe('UNDECIDED');
    expect(readingOf([numbers('PRODUCTION', 12), numbers('RAW_PACKETS', 12)])).toBe('SHORT_BEFORE_OUTPUT_LINE');
  });
});
