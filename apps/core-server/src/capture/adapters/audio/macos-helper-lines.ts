/**
 * THE READER OF THE HELPER'S LINES on macOS (task 4, masterplan/06 revision 3, row N8; sections
 * 4.6 and 4.7; review SM-04 (2), SM-12 (3), SM-16 (1) to (3), SM-35 (4); decision C110 (5)).
 *
 * PURE: no process, no clock, no file, no log, no import. Text lines in, typed facts out.
 *
 * The capture helper (the pinned FFmpeg, input layer `avfoundation`) writes its own statements to
 * standard error. The production door hands them on line by line, each bounded (row N5). This file
 * reads a line against FIXED FORMS, every one of them a line MEASURED on the user's USB interface
 * by rows MM, MM2 and MM3 (`test/mm_macos_microphone_measurement.md` s2, s3, s5, s6;
 * `test/mm2_macos_microphone_48k.md` s1, s3, s5; `test/mm3_macos_microphone_loss.md` s3, s8.2):
 *
 *   Input #0, avfoundation, from 'none:0':
 *     Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt, 9216 kb/s, start 398060.445104
 *     Stream #0:0: Audio: pcm_f32le, 96000 Hz, 5.1, flt, 18432 kb/s, start 396415.197563
 *   [fifo @ 0x<pointer>] FIFO queue full
 *   [fifo @ 0x<pointer>] FIFO queue flushed
 *   [in#0 @ 0x<pointer>] audio format is not supported          (the helper then ends with status 251)
 *   Exiting normally, received signal 15.                       (status 255)
 *   Exiting normally, received signal 2.                        (status 255)
 *
 * and the one line that ENDS the place where a stream line counts, by its first eight characters:
 * `Output #`.
 *
 * A COMPLETE START (row N8b, decision C118; `implementation/n8b_helper_line_reader_real_starts.md`).
 * Between the input's block and the first output the helper prints MORE lines that begin with the
 * stream prefix, and after each `Output #` line one more. As recorded on the device (MM s5, MM2 s5,
 * MM3 s8.2) and on the pinned build with a generated source (N4b part A), in this order:
 *
 *   Input #0, avfoundation, from 'none:0':
 *     Duration: N/A, start: 398198.680521, bitrate: 9216 kb/s
 *     Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt, 9216 kb/s, start 398198.680521     THE INPUT'S STATEMENT
 *   Stream mapping:                                                                        ends the input's block
 *     Stream #0:0 -> #0:0 (pcm_f32le (native) -> pcm_f32le (native))                       a mapping line, one per output
 *     Stream #0:0 -> #1:0 (pcm_f32le (native) -> pcm_f32le (native))
 *   Output #0, fifo, to '<pipe>':
 *     Stream #0:0: Audio: pcm_f32le, 48000 Hz, mono, flt, 1536 kb/s                        OUTPUT 0's STATEMENT (no start value)
 *   Output #1, fifo, to '<pipe>':                                                          (the blocks also come as 1, then 0: N4b)
 *     Stream #1:0: Audio: pcm_f32le, 48000 Hz, mono, flt, 1536 kb/s                        OUTPUT 1's STATEMENT
 *
 * Row N8 read every line with the stream prefix as a stream line of the input, so the mapping
 * lines withdrew the statement on EVERY real start. Now each of the three is its own kind, and a
 * line with the stream prefix that is NONE of the three exact forms still counts against the
 * statement of the block it stands in (it is never noise).
 *
 * WHAT LEAVES THIS FILE. A device chooses its own name and the helper prints it (at debug level
 * `audio device '<name>' opened`). So nothing of a line leaves as text (AD-06, SM-12 (3)): a fact
 * holds a kind, whole numbers, and words of the closed sets declared below. A line that matches no
 * form is `UNRECOGNISED` with a closed reason; the fold below only COUNTS it.
 *
 * WHAT IS NOT HERE. The gate is the adapter's (row N9): that the rate is exactly 48,000, that the
 * layout's count equals the system list's, that the format is the expected one, the 3,000 ms
 * bound, the retry. This reader only makes those refusals possible: the rate is a number, the
 * layout is NAMED, COUNT_ONLY or UNKNOWN, the format is the expected pair or OTHER. The helper's
 * end statuses are stated as two constants because the records state them beside the lines; who
 * reads a status is the door and the adapter.
 *
 * A QUEUE LINE CARRIES NO AMOUNT AND NAMES NO OUTPUT: it names a pointer. The amount of a drop
 * comes from the worker's counts per microphone (decision C110 (5), SM-35 (1)); the fact says
 * `output: 'NOT_STATED'` so that no caller takes it for one.
 */

/** One line as the door's observer hands it on (row N5): bounded, and marked when it was cut at the bound. */
export interface HelperLine {
  readonly text: string;
  readonly cut: boolean;
}

/** A line longer than this is not read (design 4.6, SM-35 (7)). The door bounds lines to the same number; this file does not rely on it. */
export const HELPER_LINE_MAX_CHARS = 512;

/** Measured (MM s3, MM2 s3, MM3 s3): the helper's end status after the refusal line. */
export const HELPER_EXIT_STATUS_OPEN_REFUSED = 251;
/** Measured (MM s6): the helper's end status after either ending line. */
export const HELPER_EXIT_STATUS_AFTER_SIGNAL = 255;

/** The highest device index a header may state: the table of row N4 admits `none:0` to `none:31`. */
export const HELPER_DEVICE_INDEX_MAX = 31;
/** The highest channel count the reader states (the system list admits 1 to 64, design 2.3). */
export const HELPER_CHANNELS_MAX = 64;
/**
 * The highest output index the reader states. The product launches one or two outputs (0 and 1);
 * the widest recorded start had four (MM3 s8.2: two pipes and two measuring outputs). A line that
 * names a higher output is not one of the forms.
 */
export const HELPER_OUTPUT_INDEX_MAX = 3;

/**
 * THE LAYOUT TABLE: FFmpeg's layout word to the number of channels. A constant of THIS ONE FILE
 * (SM-04 (2) (a)). CLOSED: a word that is not here is UNKNOWN.
 *
 * Source: the pinned build's own table, `<helper> -hide_banner -layouts`, section "Standard
 * channel layouts", run once by row N8 on 2026-10-14 (no device is opened by it); quoted in full
 * in `implementation/n8_helper_line_reader.md` and held against that text by the test. The count
 * is the number of channels in the word's decomposition.
 *
 * `basis` says what stands behind an entry: `MEASURED` - a device stated the word in an open
 * (only `5.1`: MM s2, MM2 s1, 34 opens); `BUILD_TABLE` - the build lists the word, no device
 * stated it to this project. Design 4.6 row 2 wants measured entries only; the row's brief wants
 * the build's list. Both are kept: the basis leaves with the fact and the adapter decides.
 */
const LAYOUT_ROWS = [
  ['mono', 1, 'BUILD_TABLE'],
  ['stereo', 2, 'BUILD_TABLE'],
  ['2.1', 3, 'BUILD_TABLE'],
  ['3.0', 3, 'BUILD_TABLE'],
  ['3.0(back)', 3, 'BUILD_TABLE'],
  ['4.0', 4, 'BUILD_TABLE'],
  ['quad', 4, 'BUILD_TABLE'],
  ['quad(side)', 4, 'BUILD_TABLE'],
  ['3.1', 4, 'BUILD_TABLE'],
  ['5.0', 5, 'BUILD_TABLE'],
  ['5.0(side)', 5, 'BUILD_TABLE'],
  ['4.1', 5, 'BUILD_TABLE'],
  ['5.1', 6, 'MEASURED'],
  ['5.1(side)', 6, 'BUILD_TABLE'],
  ['6.0', 6, 'BUILD_TABLE'],
  ['6.0(front)', 6, 'BUILD_TABLE'],
  ['3.1.2', 6, 'BUILD_TABLE'],
  ['hexagonal', 6, 'BUILD_TABLE'],
  ['6.1', 7, 'BUILD_TABLE'],
  ['6.1(back)', 7, 'BUILD_TABLE'],
  ['6.1(front)', 7, 'BUILD_TABLE'],
  ['7.0', 7, 'BUILD_TABLE'],
  ['7.0(front)', 7, 'BUILD_TABLE'],
  ['7.1', 8, 'BUILD_TABLE'],
  ['7.1(wide)', 8, 'BUILD_TABLE'],
  ['7.1(wide-side)', 8, 'BUILD_TABLE'],
  ['5.1.2', 8, 'BUILD_TABLE'],
  ['5.1.2(back)', 8, 'BUILD_TABLE'],
  ['octagonal', 8, 'BUILD_TABLE'],
  ['cube', 8, 'BUILD_TABLE'],
  ['5.1.4', 10, 'BUILD_TABLE'],
  ['7.1.2', 10, 'BUILD_TABLE'],
  ['7.1.4', 12, 'BUILD_TABLE'],
  ['7.2.3', 12, 'BUILD_TABLE'],
  ['9.1.4', 14, 'BUILD_TABLE'],
  ['9.1.6', 16, 'BUILD_TABLE'],
  ['hexadecagonal', 16, 'BUILD_TABLE'],
  ['binaural', 2, 'BUILD_TABLE'],
  ['downmix', 2, 'BUILD_TABLE'],
  ['22.2', 24, 'BUILD_TABLE'],
] as const;

export type HelperLayoutWord = (typeof LAYOUT_ROWS)[number][0];
export type HelperLayoutBasis = 'MEASURED' | 'BUILD_TABLE';

export interface HelperLayoutEntry {
  readonly word: HelperLayoutWord;
  readonly channels: number;
  readonly basis: HelperLayoutBasis;
}

/** The table, in the order of the build's list. Frozen. */
export const HELPER_LAYOUT_TABLE: readonly HelperLayoutEntry[] = Object.freeze(
  LAYOUT_ROWS.map(([word, channels, basis]) => Object.freeze({ word, channels, basis })),
);

// A map and not an object: a word such as `constructor` must not find a member of a prototype.
const LAYOUT_BY_WORD: ReadonlyMap<string, HelperLayoutEntry> = new Map(HELPER_LAYOUT_TABLE.map((entry) => [entry.word, entry]));

/**
 * The layout of a stream line.
 *   NAMED       a word of the table.
 *   COUNT_ONLY  exactly `<n> channels`, n a whole number 1 to 64 without a leading zero: what the
 *               build prints for a layout that has no name. A count, no word.
 *   UNKNOWN     anything else (also `<n> channels (...)`, a word with trailing text, another case).
 */
export type HelperLayout =
  | { readonly kind: 'NAMED'; readonly word: HelperLayoutWord; readonly channels: number; readonly basis: HelperLayoutBasis }
  | { readonly kind: 'COUNT_ONLY'; readonly channels: number }
  | { readonly kind: 'UNKNOWN' };

/** `PCM_F32LE_FLT`: the codec word `pcm_f32le` AND the sample format word `flt` (design 4.6 row 3). Anything else of the same form: `OTHER`. */
export type HelperStreamFormat = 'PCM_F32LE_FLT' | 'OTHER';

/**
 * Why a stream line states nothing.
 *   CUT                    the line was cut at the door's bound or is longer than the bound: never half-parsed.
 *   NOT_THE_FORM           it begins as a stream line and is not the measured form to its last character.
 *   STATED_MORE_THAN_ONCE  (the fold only) a second stream line, or a second input header, where one is expected.
 */
export type HelperStreamUnknownReason = 'CUT' | 'NOT_THE_FORM' | 'STATED_MORE_THAN_ONCE';

export interface HelperKnownStreamStatement {
  readonly known: true;
  readonly format: HelperStreamFormat;
  readonly rateHz: number;
  readonly layout: HelperLayout;
}

export type HelperStreamStatement = HelperKnownStreamStatement | { readonly known: false; readonly reason: HelperStreamUnknownReason };

export type HelperUnrecognisedReason = 'CUT' | 'TOO_LONG' | 'NOT_PRINTABLE' | 'NO_FORM';

/**
 * What ONE line is, read by itself.
 *
 * Three kinds begin with the stream prefix `  Stream #`:
 *   MAPPING        `  Stream #0:0 -> #<n>:0 (<codec> (native) -> <codec> (native))`, whole, to its last
 *                  character: a line of the block `Stream mapping:`. It states the output index and
 *                  nothing else (the codec words do not leave).
 *   OUTPUT_STREAM  `  Stream #<n>:0: Audio: <codec>, <rate> Hz, <layout>, <format>, <n> kb/s`, whole, to
 *                  its last character and WITHOUT a start value: the form of an output's own line.
 *   STREAM         every other line with the prefix: the input's form (known) or UNKNOWN.
 * Where each of them counts is the fold's (`readHelperLine`).
 */
export type HelperLineFact =
  | { readonly kind: 'INPUT_HEADER'; readonly deviceIndex: number }
  | { readonly kind: 'OUTPUT_HEADER' }
  | { readonly kind: 'STREAM'; readonly statement: HelperStreamStatement }
  | { readonly kind: 'MAPPING_HEADER' }
  | { readonly kind: 'MAPPING'; readonly output: number }
  | { readonly kind: 'OUTPUT_STREAM'; readonly output: number; readonly statement: HelperKnownStreamStatement }
  | { readonly kind: 'QUEUE_FULL'; readonly output: 'NOT_STATED' }
  | { readonly kind: 'QUEUE_FLUSHED'; readonly output: 'NOT_STATED' }
  | { readonly kind: 'OPEN_REFUSED'; readonly statedCause: 'AUDIO_FORMAT_NOT_SUPPORTED' }
  | { readonly kind: 'ENDED_ON_SIGNAL'; readonly signal: 15 | 2 }
  | { readonly kind: 'UNRECOGNISED'; readonly reason: HelperUnrecognisedReason };

// ---- the fixed forms: each anchored at both ends, each quantifier bounded -------------------

const STREAM_PREFIX = '  Stream #';
const OUTPUT_PREFIX = 'Output #';
/** Space to tilde. A line with any other character is not read (control characters, marks, non-ASCII letters). */
const PRINTABLE = /^[\x20-\x7e]*$/;

const INPUT_HEADER = /^Input #0, avfoundation, from 'none:(0|[1-9][0-9]?)':$/;
/**
 * codec, rate, layout, sample format, bit rate, start. The rate is a whole number without a
 * leading zero, followed by ONE space and `Hz`. The layout is everything up to the next comma
 * (no word of the table and no `<n> channels` holds a comma); what it is, is decided after.
 */
const STREAM_LINE =
  /^ {2}Stream #0:0: Audio: ([a-z0-9_]{1,24}), ([1-9][0-9]{0,6}) Hz, ([^,]{1,40}), ([a-z0-9]{1,12}), [1-9][0-9]{0,6} kb\/s, start [0-9]{1,12}\.[0-9]{6}$/;
/** The line that opens the block of mapping lines: these fifteen characters and nothing else. */
const MAPPING_HEADER = 'Stream mapping:';
/**
 * A mapping line. The source is the input's one stream `#0:0`; the target is stream 0 of output
 * 0 to 3; both codec words are followed by ` (native)` as in every recorded start (a copy or a
 * codec of a library is another form, and the product's list makes neither).
 */
const MAPPING_LINE = /^ {2}Stream #0:0 -> #([0-3]):0 \([a-z0-9_]{1,24} \(native\) -> [a-z0-9_]{1,24} \(native\)\)$/;
/** An output's own stream line: the input's form with the output's index and WITHOUT `, start <value>`. */
const OUTPUT_STREAM_LINE = /^ {2}Stream #([0-3]):0: Audio: ([a-z0-9_]{1,24}), ([1-9][0-9]{0,6}) Hz, ([^,]{1,40}), ([a-z0-9]{1,12}), [1-9][0-9]{0,6} kb\/s$/;
/** The index of an `Output #` line, read by the fold from its first eleven characters; the path after it is not read. */
const OUTPUT_HEADER_INDEX = /^Output #([0-3]), /;
const COUNT_ONLY_LAYOUT = /^([1-9][0-9]?) channels$/;
const QUEUE_FULL = /^\[fifo @ 0x[0-9a-f]{1,16}\] FIFO queue full$/;
const QUEUE_FLUSHED = /^\[fifo @ 0x[0-9a-f]{1,16}\] FIFO queue flushed$/;
const OPEN_REFUSED = /^\[in#0 @ 0x[0-9a-f]{1,16}\] audio format is not supported$/;
const ENDED_ON_SIGNAL = /^Exiting normally, received signal (15|2)\.$/;

const UNKNOWN_LAYOUT: HelperLayout = Object.freeze({ kind: 'UNKNOWN' });

/** The layout word of a stream line. Closed: the table, the exact count form, or UNKNOWN. */
export function readHelperLayout(word: string): HelperLayout {
  if (word.length > 40) return UNKNOWN_LAYOUT;
  const entry = LAYOUT_BY_WORD.get(word);
  if (entry !== undefined) return { kind: 'NAMED', word: entry.word, channels: entry.channels, basis: entry.basis };
  const count = COUNT_ONLY_LAYOUT.exec(word);
  if (count !== null) {
    const channels = Number(count[1]);
    if (channels >= 1 && channels <= HELPER_CHANNELS_MAX) return { kind: 'COUNT_ONLY', channels };
  }
  return UNKNOWN_LAYOUT;
}

function readStreamLine(text: string, whole: boolean): HelperStreamStatement {
  if (!whole) return { known: false, reason: 'CUT' };
  if (!PRINTABLE.test(text)) return { known: false, reason: 'NOT_THE_FORM' };
  const parts = STREAM_LINE.exec(text);
  if (parts === null) return { known: false, reason: 'NOT_THE_FORM' };
  const rateHz = Number(parts[2]);
  if (!Number.isSafeInteger(rateHz)) return { known: false, reason: 'NOT_THE_FORM' };
  return {
    known: true,
    format: parts[1] === 'pcm_f32le' && parts[4] === 'flt' ? 'PCM_F32LE_FLT' : 'OTHER',
    rateHz,
    layout: readHelperLayout(parts[3] as string),
  };
}

/**
 * What one line is. Order of reading:
 *   1. its first characters against two fixed prefixes - `  Stream #` (whole and printable: a
 *      mapping line or an output's line when it is that form to its last character; otherwise a
 *      stream line: read strictly, or UNKNOWN; a cut one is UNKNOWN, never half-parsed) and
 *      `Output #` (the end of the input's place; the rest of that line holds a path and is not read);
 *   2. a line that was cut, is longer than the bound or holds a non-printable character: not read;
 *   3. the whole line against the remaining fixed forms.
 */
export function classifyHelperLine(line: HelperLine): HelperLineFact {
  const text = line.text;
  const tooLong = text.length > HELPER_LINE_MAX_CHARS;
  const whole = !line.cut && !tooLong;

  if (text.startsWith(STREAM_PREFIX)) {
    // A cut line is never half-parsed: only a WHOLE, printable line can be a mapping line or an
    // output's line. Everything else with the prefix stays a stream line (the input's form or UNKNOWN).
    if (whole && PRINTABLE.test(text)) {
      const mapping = MAPPING_LINE.exec(text);
      if (mapping !== null) return { kind: 'MAPPING', output: Number(mapping[1]) };
      const output = OUTPUT_STREAM_LINE.exec(text);
      if (output !== null) {
        return {
          kind: 'OUTPUT_STREAM',
          output: Number(output[1]),
          statement: {
            known: true,
            format: output[2] === 'pcm_f32le' && output[5] === 'flt' ? 'PCM_F32LE_FLT' : 'OTHER',
            rateHz: Number(output[3]),
            layout: readHelperLayout(output[4] as string),
          },
        };
      }
    }
    return { kind: 'STREAM', statement: readStreamLine(text, whole) };
  }
  if (text.startsWith(OUTPUT_PREFIX)) return { kind: 'OUTPUT_HEADER' };

  if (tooLong) return { kind: 'UNRECOGNISED', reason: 'TOO_LONG' };
  if (line.cut) return { kind: 'UNRECOGNISED', reason: 'CUT' };
  if (!PRINTABLE.test(text)) return { kind: 'UNRECOGNISED', reason: 'NOT_PRINTABLE' };
  if (text === MAPPING_HEADER) return { kind: 'MAPPING_HEADER' };

  const header = INPUT_HEADER.exec(text);
  if (header !== null) {
    const deviceIndex = Number(header[1]);
    if (deviceIndex <= HELPER_DEVICE_INDEX_MAX) return { kind: 'INPUT_HEADER', deviceIndex };
    return { kind: 'UNRECOGNISED', reason: 'NO_FORM' };
  }
  if (QUEUE_FULL.test(text)) return { kind: 'QUEUE_FULL', output: 'NOT_STATED' };
  if (QUEUE_FLUSHED.test(text)) return { kind: 'QUEUE_FLUSHED', output: 'NOT_STATED' };
  if (OPEN_REFUSED.test(text)) return { kind: 'OPEN_REFUSED', statedCause: 'AUDIO_FORMAT_NOT_SUPPORTED' };
  const ended = ENDED_ON_SIGNAL.exec(text);
  if (ended !== null) return { kind: 'ENDED_ON_SIGNAL', signal: ended[1] === '15' ? 15 : 2 };
  return { kind: 'UNRECOGNISED', reason: 'NO_FORM' };
}

// ---- the fold: where a stream line counts (design 4.6 row 1) --------------------------------

/**
 * Where the reading of one helper's lines stands.
 *   BEFORE_INPUT  no header `Input #0, avfoundation, from 'none:<n>':` with the launch's own <n> yet.
 *   INPUT         after that header: the block `Input #0`, the ONE place the input's stream line counts.
 *   MAPPING       the line `Stream mapping:` was read: the input's block is over, mapping lines are expected.
 *   CLOSED        an `Output #` line was read. Final. Each output's block states that output.
 */
export type HelperInputSection = 'BEFORE_INPUT' | 'INPUT' | 'MAPPING' | 'CLOSED';

/** What one output said of itself: the stream line of its own `Output #<n>` block. */
export interface HelperOutputStatement {
  readonly output: number;
  /** Once `known: false` it never becomes known again. */
  readonly statement: HelperStreamStatement;
}

export interface HelperLinesState {
  /** The `<n>` of the launch's argument `none:<n>`. */
  readonly expectedDeviceIndex: number;
  readonly section: HelperInputSection;
  /** THE INPUT's statement. `null`: no stream line read in its place yet. Once `known: false` it never becomes known again. */
  readonly stream: HelperStreamStatement | null;
  /**
   * THE OUTPUTS' statements, in the order their blocks stated them (the helper prints the blocks
   * in either order). An output whose block held no line with the stream prefix is NOT here: the
   * adapter that launched k outputs asks for k entries, indexes 0 to k-1, each known.
   */
  readonly outputs: readonly HelperOutputStatement[];
  /** The output whose block is open: the index of the last `Output #` line, `null` when none was read or its index was not readable (cut, or above 3). */
  readonly openOutput: number | null;
  readonly counts: {
    readonly lines: number;
    /** Lines that matched no form. Their text is not kept anywhere. */
    readonly unrecognised: number;
    /** Lines with the stream prefix that stood where no statement is read: before the input's header, in the block `Stream mapping:` (and not a mapping line), after an `Output #` line whose index was not readable. */
    readonly streamLinesOutOfPlace: number;
    /** Mapping lines read in the block `Stream mapping:`. */
    readonly mappingLines: number;
    /** A mapping line outside that block, or a second line `Stream mapping:`. */
    readonly mappingLinesOutOfPlace: number;
    /** `Output #` lines. */
    readonly outputHeaders: number;
    /** Headers that state another index than the launch's. */
    readonly inputHeadersOfAnotherIndex: number;
    readonly queueFull: number;
    readonly queueFlushed: number;
    readonly openRefused: number;
    readonly endedOnSignal: number;
  };
}

/**
 * What a line did to the INPUT's stream statement (an output's statement is read from `state.outputs`).
 *   STREAM_STATED     the first stream line in its place was read (known or not): `state.stream` is set.
 *   STREAM_WITHDRAWN  a second stream line or a second input header: `state.stream` is now UNKNOWN.
 *   NONE              nothing.
 */
export type HelperLineEffect = 'STREAM_STATED' | 'STREAM_WITHDRAWN' | 'NONE';

export interface HelperLineReading {
  readonly state: HelperLinesState;
  readonly fact: HelperLineFact;
  readonly effect: HelperLineEffect;
}

/** The start of a helper's reading. Throws on an index that is not a whole number 0 to 31: a programming error, never data. */
export function startHelperLines(expectedDeviceIndex: number): HelperLinesState {
  if (!Number.isInteger(expectedDeviceIndex) || expectedDeviceIndex < 0 || expectedDeviceIndex > HELPER_DEVICE_INDEX_MAX) {
    throw new RangeError('the device index of a helper is a whole number from 0 to 31');
  }
  return {
    expectedDeviceIndex,
    section: 'BEFORE_INPUT',
    stream: null,
    outputs: [],
    openOutput: null,
    counts: {
      lines: 0,
      unrecognised: 0,
      streamLinesOutOfPlace: 0,
      mappingLines: 0,
      mappingLinesOutOfPlace: 0,
      outputHeaders: 0,
      inputHeadersOfAnotherIndex: 0,
      queueFull: 0,
      queueFlushed: 0,
      openRefused: 0,
      endedOnSignal: 0,
    },
  };
}

const STATED_MORE_THAN_ONCE: HelperStreamStatement = Object.freeze({ known: false, reason: 'STATED_MORE_THAN_ONCE' });

const NOT_THE_FORM: HelperStreamStatement = Object.freeze({ known: false, reason: 'NOT_THE_FORM' });

/** The first statement of an output is taken as it is; a second one withdraws it, for good. */
function withOutputStatement(outputs: readonly HelperOutputStatement[], output: number, statement: HelperStreamStatement): readonly HelperOutputStatement[] {
  if (!outputs.some((entry) => entry.output === output)) return [...outputs, { output, statement }];
  return outputs.map((entry) => (entry.output === output ? { output, statement: STATED_MORE_THAN_ONCE } : entry));
}

/**
 * One line further. Pure: the state given is not changed.
 *
 * THE INPUT's statement is the FIRST line with the stream prefix INSIDE the block `Input #0`: after
 * the header of the launch's own index and before the line `Stream mapping:` or any `Output #`
 * line. Design 4.6 says "the first"; this fold is stricter (row N8, decision D2): a SECOND line
 * with the stream prefix in that block, or a second header of the same index anywhere, withdraws
 * the statement (a helper that states its input twice has not stated which one is true).
 *
 * THE BLOCK `Stream mapping:` (row N8b) holds mapping lines and states nothing. A line with the
 * stream prefix that is NOT a mapping line there (the input's form, an output's form, a cut or
 * malformed line) is a second word about the input: it withdraws the input's statement.
 *
 * AN OUTPUT's statement is the first line with the stream prefix in ITS OWN block: after
 * `Output #<n>` and before the next `Output #` line. It is known only when it is the output's
 * form with the block's own index <n>; any other line with the prefix there (another index, the
 * input's form, a cut or malformed line) makes that output's statement UNKNOWN, and a second one
 * withdraws it. A line in an output's block never changes the input's statement.
 *
 * WHEN IS A START COMPLETE. `section === 'CLOSED'` says the input's block is over. The outputs'
 * blocks come after it, each when its writer starts: the adapter that launched k outputs waits
 * for k entries in `outputs` (within its own bound) before it believes the start.
 */
export function readHelperLine(state: HelperLinesState, line: HelperLine): HelperLineReading {
  const fact = classifyHelperLine(line);
  const counts = { ...state.counts, lines: state.counts.lines + 1 };
  let section = state.section;
  let stream = state.stream;
  let outputs = state.outputs;
  let openOutput = state.openOutput;
  let effect: HelperLineEffect = 'NONE';

  switch (fact.kind) {
    case 'INPUT_HEADER':
      if (fact.deviceIndex !== state.expectedDeviceIndex) counts.inputHeadersOfAnotherIndex += 1;
      else if (section === 'BEFORE_INPUT') section = 'INPUT';
      else {
        stream = STATED_MORE_THAN_ONCE;
        effect = 'STREAM_WITHDRAWN';
      }
      break;
    case 'OUTPUT_HEADER': {
      section = 'CLOSED';
      counts.outputHeaders += 1;
      // The index is read from a WHOLE line only (a cut line is never half-parsed): the block of
      // a header whose index is not read states nothing, so that output has no entry.
      const index = line.cut || line.text.length > HELPER_LINE_MAX_CHARS ? null : OUTPUT_HEADER_INDEX.exec(line.text);
      openOutput = index === null ? null : Number(index[1]);
      break;
    }
    case 'MAPPING_HEADER':
      // It ends the input's block wherever it comes, as an `Output #` line does.
      if (section === 'BEFORE_INPUT' || section === 'INPUT') section = 'MAPPING';
      else counts.mappingLinesOutOfPlace += 1;
      break;
    case 'MAPPING':
      if (section === 'MAPPING') counts.mappingLines += 1;
      else counts.mappingLinesOutOfPlace += 1;
      break;
    case 'STREAM':
    case 'OUTPUT_STREAM':
      if (section === 'BEFORE_INPUT') counts.streamLinesOutOfPlace += 1;
      else if (section === 'INPUT') {
        if (stream === null) {
          // An output's form in the input's block is not the input's form.
          stream = fact.kind === 'STREAM' ? fact.statement : NOT_THE_FORM;
          effect = 'STREAM_STATED';
        } else {
          stream = STATED_MORE_THAN_ONCE;
          effect = 'STREAM_WITHDRAWN';
        }
      } else if (section === 'MAPPING') {
        counts.streamLinesOutOfPlace += 1;
        if (stream !== null) {
          stream = STATED_MORE_THAN_ONCE;
          effect = 'STREAM_WITHDRAWN';
        }
      } else if (openOutput === null) counts.streamLinesOutOfPlace += 1;
      else if (fact.kind === 'OUTPUT_STREAM') outputs = withOutputStatement(outputs, openOutput, fact.output === openOutput ? fact.statement : NOT_THE_FORM);
      else outputs = withOutputStatement(outputs, openOutput, fact.statement.known ? NOT_THE_FORM : fact.statement);
      break;
    case 'QUEUE_FULL':
      counts.queueFull += 1;
      break;
    case 'QUEUE_FLUSHED':
      counts.queueFlushed += 1;
      break;
    case 'OPEN_REFUSED':
      counts.openRefused += 1;
      break;
    case 'ENDED_ON_SIGNAL':
      counts.endedOnSignal += 1;
      break;
    case 'UNRECOGNISED':
      counts.unrecognised += 1;
      break;
  }
  return { state: { expectedDeviceIndex: state.expectedDeviceIndex, section, stream, outputs, openOutput, counts }, fact, effect };
}
