/**
 * THE GATE OF A macOS HELPER'S START, and THE COUNT OF A PRE-CHECK (task 4 row N9; masterplan/06
 * revision 3 sections 4.6 and 4.7; review SM-04 (2), SM-14, SM-16 (1) to (3); decisions U23 (2),
 * C104 (3), C110, C118; the ruling on row N8's D1 in `delegation_progress/file_ownership.md`).
 *
 * PURE: no process, no clock, no file, no log. The macOS microphone adapter (`usb-audio-macos.ts`)
 * hands in the state of the reader of the helper's lines (`macos-helper-lines.ts`, rows N8 and
 * N8b) and what the listing of THIS launch said of the device; this file answers WAIT, PASS or a
 * named refusal. It reads no text: the reader has already turned every line into kinds, whole
 * numbers and closed words.
 *
 * THE RULES, in the order they are asked (design 4.6 rows 1 to 3, then the outputs):
 *
 *   the input's place     the reader's fold reads the input's statement only inside the block of
 *                         the launch's own `Input #0 ... 'none:<n>'`. A header of another index is
 *                         another device: refused. The place closed (`Stream mapping:` or an
 *                         `Output #` line) without a statement: refused, `NO_STREAM_LINE`.
 *   1  THE RATE           exactly 48,000 Hz, or `AUDIO_CARD_RATE_UNSUPPORTED` with the detail
 *                         `HELPER_STATES_OTHER_RATE`. Nothing is resampled without a word: at
 *                         96,000 Hz the program converts silently, which is why the refusal stands
 *                         on the INPUT's own line (MF6; decision U23 (2)).
 *   2  THE LAYOUT WORD    a word of the reader's closed table whose channel count EQUALS the
 *                         listing's input count of this launch. A word MEASURED on a device (`5.1`)
 *                         and a word of the pinned build's own table (`BUILD_TABLE`) are both
 *                         admitted ONLY when the counts agree - two sources, not one (the ruling on
 *                         N8's D1). A count that differs: `AUDIO_CARD_MOVED` / `CHANNELS_DIFFER`. A
 *                         count without a word (`<n> channels`) or a word outside the table:
 *                         `AUDIO_CARD_MOVED` / `LAYOUT_WORD_UNKNOWN`.
 *   3  THE FORMAT         `pcm_f32le` with `flt`, or `AUDIO_HELPER_ENDED_AT_START` /
 *                         `STREAM_NOT_AS_EXPECTED`. A statement the reader withdrew or could not
 *                         read (cut, not the form, stated twice) is the same refusal.
 *   4  THE OUTPUTS        the launch's k outputs, indexes 0 to k-1, each stated once in its own
 *                         block as `pcm_f32le`, 48,000 Hz, `mono`, `flt`; as many mapping lines as
 *                         outputs; no stream or mapping line out of its place. Until all k have
 *                         stated themselves: WAIT (row N8b: the blocks come after the input's, in
 *                         either order, each when its writer starts). Anything else:
 *                         `AUDIO_HELPER_ENDED_AT_START` / `OUTPUT_NOT_AS_EXPECTED`.
 *
 * What the gate is worth, stated (design 4.6 row 2): the built-in input has 1 channel and cannot
 * state `5.1`, so a helper that opened it is refused; two devices of equal channel count are NOT
 * told apart by it (the third listing of the launch is the check beside it).
 */
import type { HelperLinesState, HelperStreamStatement } from './macos-helper-lines';

/** The one rate of the path: the transport's and the evidence form's (decision U12 A1, U23 (2)). */
export const MACOS_MIC_RATE_HZ = 48_000;

/** What a refusal of the gate is reported as: the code of `UsbAudioRefusal` and a detail word. */
export type MacosGateRefusalCode = 'AUDIO_CARD_RATE_UNSUPPORTED' | 'AUDIO_CARD_MOVED' | 'AUDIO_HELPER_ENDED_AT_START';

export const MacosGateDetail = {
  HELPER_STATES_OTHER_RATE: 'HELPER_STATES_OTHER_RATE',
  CHANNELS_DIFFER: 'CHANNELS_DIFFER',
  LAYOUT_WORD_UNKNOWN: 'LAYOUT_WORD_UNKNOWN',
  STREAM_NOT_AS_EXPECTED: 'STREAM_NOT_AS_EXPECTED',
  NO_STREAM_LINE: 'NO_STREAM_LINE',
  INPUT_OF_ANOTHER_INDEX: 'INPUT_OF_ANOTHER_INDEX',
  OUTPUT_NOT_AS_EXPECTED: 'OUTPUT_NOT_AS_EXPECTED',
} as const;
export type MacosGateDetail = (typeof MacosGateDetail)[keyof typeof MacosGateDetail];

export type MacosGateVerdict =
  | { readonly verdict: 'WAIT' }
  | { readonly verdict: 'PASS' }
  | { readonly verdict: 'REFUSE'; readonly code: MacosGateRefusalCode; readonly detail: MacosGateDetail };

/** What the listing of THIS launch said, and how many outputs the launch's list holds. */
export interface MacosGateExpectation {
  /** The input channel count of the device in the system list of the launch's listing. */
  readonly channelCount: number;
  /** The output sections of the launch's list: 1 or 2 (a pre-check has 1). */
  readonly outputs: number;
}

const WAIT: MacosGateVerdict = Object.freeze({ verdict: 'WAIT' });
const PASS: MacosGateVerdict = Object.freeze({ verdict: 'PASS' });
const refuse = (code: MacosGateRefusalCode, detail: MacosGateDetail): MacosGateVerdict => Object.freeze({ verdict: 'REFUSE', code, detail });

/** Rules 1 to 3 on the input's statement. Null: it passes. */
function inputRefusal(stream: HelperStreamStatement, channelCount: number): MacosGateVerdict | null {
  if (!stream.known) return refuse('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.STREAM_NOT_AS_EXPECTED);
  if (stream.rateHz !== MACOS_MIC_RATE_HZ) return refuse('AUDIO_CARD_RATE_UNSUPPORTED', MacosGateDetail.HELPER_STATES_OTHER_RATE);
  if (stream.layout.kind !== 'NAMED') return refuse('AUDIO_CARD_MOVED', MacosGateDetail.LAYOUT_WORD_UNKNOWN);
  if (stream.layout.channels !== channelCount) return refuse('AUDIO_CARD_MOVED', MacosGateDetail.CHANNELS_DIFFER);
  if (stream.format !== 'PCM_F32LE_FLT') return refuse('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.STREAM_NOT_AS_EXPECTED);
  return null;
}

/** An output's own statement as the launch's list makes it: mono 32-bit float at the one rate. */
function outputAsListed(statement: HelperStreamStatement): boolean {
  return statement.known && statement.format === 'PCM_F32LE_FLT' && statement.rateHz === MACOS_MIC_RATE_HZ && statement.layout.kind === 'NAMED' && statement.layout.word === 'mono' && statement.layout.channels === 1;
}

/**
 * The gate, asked after every line the reader read. WAIT until the helper has said enough; then
 * PASS or REFUSE, and the adapter asks no more. Throws on an expectation that is not of its shape:
 * a programming error, never data.
 */
export function judgeHelperStart(state: HelperLinesState, expected: MacosGateExpectation): MacosGateVerdict {
  if (!Number.isInteger(expected.channelCount) || expected.channelCount < 1 || expected.channelCount > 64) throw new RangeError('the channel count of a launch is a whole number from 1 to 64');
  if (!Number.isInteger(expected.outputs) || expected.outputs < 1 || expected.outputs > 2) throw new RangeError('a launch has one or two outputs');
  if (state.counts.inputHeadersOfAnotherIndex > 0) return refuse('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.INPUT_OF_ANOTHER_INDEX);
  if (state.stream === null) return state.section === 'MAPPING' || state.section === 'CLOSED' ? refuse('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.NO_STREAM_LINE) : WAIT;
  const input = inputRefusal(state.stream, expected.channelCount);
  if (input !== null) return input;
  // The input's block must be over before its statement is believed: a second stream line in it would withdraw it.
  if (state.section === 'BEFORE_INPUT' || state.section === 'INPUT') return WAIT;
  const { counts } = state;
  if (counts.streamLinesOutOfPlace > 0 || counts.mappingLinesOutOfPlace > 0 || counts.mappingLines > expected.outputs) return refuse('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.OUTPUT_NOT_AS_EXPECTED);
  for (const entry of state.outputs) {
    if (entry.output >= expected.outputs || !outputAsListed(entry.statement)) return refuse('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.OUTPUT_NOT_AS_EXPECTED);
  }
  if (state.outputs.length < expected.outputs) return WAIT;
  if (counts.mappingLines !== expected.outputs) return refuse('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.OUTPUT_NOT_AS_EXPECTED);
  return PASS;
}

// ── The count of a pre-check (design 4.6, "AT LEAST ONE NON-ZERO SAMPLE PER ASSIGNED CHANNEL") ──

/** One second of 48,000 samples of 4 bytes is 192,000 bytes; what comes beyond twice that is not counted. */
export const MACOS_PRECHECK_COUNT_BYTES_MAX = 2 * MACOS_MIC_RATE_HZ * 4;

export interface MacosSampleCount {
  /** Whole samples counted (bytes of a cut last sample are not one). */
  readonly samples: number;
  /** Samples that were finite and not exactly zero. "Exactly zero" and not a level: a converter in a quiet room does not deliver exact zeros; a denied grant, a system mute and a dead input do. */
  readonly nonZero: number;
  /** True when more bytes came than the bound: the rest was not counted. */
  readonly overBound: boolean;
}

export interface MacosSampleCounter {
  /** One chunk of the pre-check's standard output, as it arrives. Nothing of it is kept. */
  push(chunk: Uint8Array): void;
  count(): MacosSampleCount;
}

/**
 * Counts 32-bit little-endian floats across chunks, in memory, within `maxBytes`. It keeps the
 * three numbers and at most three bytes of a sample cut between two chunks; no sample is stored.
 */
export function createSampleCounter(maxBytes: number = MACOS_PRECHECK_COUNT_BYTES_MAX): MacosSampleCounter {
  let taken = 0;
  let samples = 0;
  let nonZero = 0;
  let overBound = false;
  const carry = new Uint8Array(4);
  let carried = 0;
  const view = new DataView(carry.buffer);
  return {
    push(chunk) {
      for (let at = 0; at < chunk.length; at += 1) {
        if (taken >= maxBytes) {
          overBound = true;
          return;
        }
        taken += 1;
        carry[carried] = chunk[at] ?? 0;
        carried += 1;
        if (carried === 4) {
          carried = 0;
          samples += 1;
          const value = view.getFloat32(0, true);
          if (Number.isFinite(value) && value !== 0) nonZero += 1;
        }
      }
    },
    count: () => Object.freeze({ samples, nonZero, overBound }),
  };
}
