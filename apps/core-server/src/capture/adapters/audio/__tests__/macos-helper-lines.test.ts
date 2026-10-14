// The reader of the helper's lines on macOS (task 4, masterplan/06 revision 3, row N8).
//
// THE DOUBLE. No helper is started and no device is opened: the lines are TEXT, copied from the
// records of rows MM, MM2 and MM3 (`test/mm_macos_microphone_measurement.md`,
// `test/mm2_macos_microphone_48k.md`, `test/mm3_macos_microphone_loss.md`). The records print a
// pointer as `0x<ptr>` and a device name as `<USB-AUDIO-1>`; here the pointer is a synthetic
// number and the name a synthetic text. What stays unproven: that the helper prints these lines
// on another interface, at another channel count or in another build - the user's own session
// (design 9.3) and the hardware package.
//
// MUTATIONS each rule was seen RED on are named at the rule (record: implementation/n8_helper_line_reader.md s5).
//
// ROW N8b (decision C118). The cases above the block "complete starts" read lines one at a time or
// in short folds; none of them held a COMPLETE start, and the reader withdrew the statement on
// every real one (the block `Stream mapping:`). The blocks at the end read WHOLE standard-error
// texts from `fixtures/macos-helper-starts/`: each file says in its head what it is - recorded on
// the device, recorded on the pinned build with a generated source, or COMPOSED - and what was
// changed (pointers and paths; no device name stands in a line). Mutations N1 to N10 are named at
// the rule (record: implementation/n8b_helper_line_reader_real_starts.md s5).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  HELPER_EXIT_STATUS_AFTER_SIGNAL,
  HELPER_EXIT_STATUS_OPEN_REFUSED,
  HELPER_LAYOUT_TABLE,
  HELPER_LINE_MAX_CHARS,
  classifyHelperLine,
  readHelperLayout,
  readHelperLine,
  startHelperLines,
  type HelperLine,
  type HelperLinesState,
} from '../macos-helper-lines';

const whole = (text: string): HelperLine => ({ text, cut: false });
const read = (text: string) => classifyHelperLine(whole(text));
const PTR = '0x600003a1c000';

// The measured lines, verbatim (pointer synthetic).
const HEADER_0 = "Input #0, avfoundation, from 'none:0':";
const DURATION_48 = '  Duration: N/A, start: 398060.445104, bitrate: 9216 kb/s';
const STREAM_48 = '  Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt, 9216 kb/s, start 398060.445104';
const STREAM_96 = '  Stream #0:0: Audio: pcm_f32le, 96000 Hz, 5.1, flt, 18432 kb/s, start 396415.197563';
const OUTPUT_STREAM = '  Stream #0:0: Audio: pcm_f32le, 48000 Hz, mono, flt, 1536 kb/s';
const QUEUE_FULL = `[fifo @ ${PTR}] FIFO queue full`;
const QUEUE_FLUSHED = `[fifo @ ${PTR}] FIFO queue flushed`;
const REFUSED = `[in#0 @ ${PTR}] audio format is not supported`;
const REFUSED_FOLLOWERS = [`[in#0 @ ${PTR}] Error opening input: Input/output error`, 'Error opening input file none:0.', 'Error opening input files: Input/output error'];
const ENDED_15 = 'Exiting normally, received signal 15.';
const ENDED_2 = 'Exiting normally, received signal 2.';

const FIVE_ONE = { kind: 'NAMED', word: '5.1', channels: 6, basis: 'MEASURED' };
// Row N8b: what each output of the product's list says of itself, and the two mapping lines of a start with two outputs.
const MONO_48 = { known: true, format: 'PCM_F32LE_FLT', rateHz: 48000, layout: { kind: 'NAMED', word: 'mono', channels: 1, basis: 'BUILD_TABLE' } };
const INPUT_48 = { known: true, format: 'PCM_F32LE_FLT', rateHz: 48000, layout: FIVE_ONE };
const MAPPING_HEADER = 'Stream mapping:';
const MAPPING_0 = '  Stream #0:0 -> #0:0 (pcm_f32le (native) -> pcm_f32le (native))';
const MAPPING_1 = '  Stream #0:0 -> #1:0 (pcm_f32le (native) -> pcm_f32le (native))';
const OUTPUT_STREAM_1 = '  Stream #1:0: Audio: pcm_f32le, 48000 Hz, mono, flt, 1536 kb/s';
const FIFO_0 = "Output #0, fifo, to '/synthetic/run/MIC-01.pcm':";
const FIFO_1 = "Output #1, fifo, to '/synthetic/run/MIC-02.pcm':";

const HERE = dirname(fileURLToPath(import.meta.url));
const STARTS = resolve(HERE, 'fixtures', 'macos-helper-starts');
const START_MARK = '--- helper standard error ---\n';
/** The lines of a fixture's standard-error text (everything after the mark), and the head before it. */
function start(name: string): { head: string; lines: string[] } {
  const text = readFileSync(resolve(STARTS, `${name}.txt`), 'utf8');
  const at = text.indexOf(START_MARK);
  if (at === -1 || !text.endsWith('\n')) throw new Error(`fixture ${name}: no mark or no final line end`);
  return { head: text.slice(0, at), lines: text.slice(at + START_MARK.length, -1).split('\n') };
}

function fold(lines: readonly (string | HelperLine)[], index = 0): HelperLinesState {
  let state = startHelperLines(index);
  for (const line of lines) state = readHelperLine(state, typeof line === 'string' ? whole(line) : line).state;
  return state;
}

describe('the measured lines, verbatim', () => {
  // Mutation M1 (the rate group read as `[0-9.]{1,7}`): the decimal near-miss below goes RED; these stay the anchor of the form.
  it('the stream line at 48,000 Hz: format, rate as a whole number, the layout word through the table', () => {
    expect(read(STREAM_48)).toEqual({ kind: 'STREAM', statement: { known: true, format: 'PCM_F32LE_FLT', rateHz: 48000, layout: FIVE_ONE } });
  });

  it('the stream line at 96,000 Hz is read as what it states - the adapter can refuse `rateHz !== 48000`', () => {
    const fact = read(STREAM_96);
    expect(fact).toEqual({ kind: 'STREAM', statement: { known: true, format: 'PCM_F32LE_FLT', rateHz: 96000, layout: FIVE_ONE } });
    expect(fact.kind === 'STREAM' && fact.statement.known && fact.statement.rateHz !== 48000).toBe(true);
  });

  it('the input header states the index of the argument, 0 to 31, and nothing else', () => {
    expect(read(HEADER_0)).toEqual({ kind: 'INPUT_HEADER', deviceIndex: 0 });
    expect(read("Input #0, avfoundation, from 'none:31':")).toEqual({ kind: 'INPUT_HEADER', deviceIndex: 31 });
    for (const text of [
      "Input #0, avfoundation, from 'none:32':",
      "Input #0, avfoundation, from 'none:01':",
      "Input #0, avfoundation, from 'none:-1':",
      "Input #0, avfoundation, from 'none:Synthetic Interface':",
      "Input #1, avfoundation, from 'none:0':",
      "Input #0, avfoundation, from '0:none':",
      ` ${HEADER_0}`,
    ]) {
      expect(read(text), text).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
    }
  });

  // Mutation M3 (the `$` taken off the queue-full form): the trailing-text case goes RED.
  it('the two queue lines: typed, and they state NO output and no amount (decision C110 (5))', () => {
    expect(read(QUEUE_FULL)).toEqual({ kind: 'QUEUE_FULL', output: 'NOT_STATED' });
    expect(read(QUEUE_FLUSHED)).toEqual({ kind: 'QUEUE_FLUSHED', output: 'NOT_STATED' });
    for (const text of [
      `${QUEUE_FULL} (512 packets)`,
      `${QUEUE_FLUSHED} `,
      '[fifo @ 0x<ptr>] FIFO queue full', // the record's redacted form is not what a helper prints
      '[fifo @ 0xZZ] FIFO queue full',
      `[fifo @ ${PTR}] FIFO queue Full`,
      'FIFO queue full',
      `[out#0/fifo @ ${PTR}] FIFO queue full`,
      `x ${QUEUE_FLUSHED}`,
    ]) {
      expect(read(text), text).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
    }
  });

  // Mutation M4 (the `^` taken off the refusal form): the line with text before it goes RED.
  it('the refusal line, and the three lines after it are not it', () => {
    expect(read(REFUSED)).toEqual({ kind: 'OPEN_REFUSED', statedCause: 'AUDIO_FORMAT_NOT_SUPPORTED' });
    expect(HELPER_EXIT_STATUS_OPEN_REFUSED).toBe(251);
    for (const text of [...REFUSED_FOLLOWERS, `note: ${REFUSED}`, `${REFUSED}.`, 'audio format is not supported', `[in#1 @ ${PTR}] audio format is not supported`]) {
      expect(read(text), text).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
    }
  });

  // Mutation M5 (the signal group read as `[0-9]+`): signal 9 goes RED.
  it('the two ending lines, signals 15 and 2 only', () => {
    expect(read(ENDED_15)).toEqual({ kind: 'ENDED_ON_SIGNAL', signal: 15 });
    expect(read(ENDED_2)).toEqual({ kind: 'ENDED_ON_SIGNAL', signal: 2 });
    expect(HELPER_EXIT_STATUS_AFTER_SIGNAL).toBe(255);
    for (const text of ['Exiting normally, received signal 9.', 'Exiting normally, received signal 15', 'Exiting normally, received signal 152.', `${ENDED_2} `]) {
      expect(read(text), text).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
    }
  });

  it('every other measured line is UNRECOGNISED', () => {
    for (const text of [DURATION_48, `[in#0 @ ${PTR}] audio device 'Synthetic Interface' opened`, 'Stream #0:0, 1, 1/1000000: Audio: pcm_f32le, 96000 Hz, 5.1, flt, 18432 kb/s, start 396415.197563', 'progress=end', '']) {
      expect(read(text), text).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
    }
  });
});

describe('the stream line, near-misses', () => {
  const unknown = { kind: 'STREAM', statement: { known: false, reason: 'NOT_THE_FORM' } };

  // Mutation M1 (the rate group read as `[0-9.]{1,7}`): RED here (`48000.0` was read as 48,000; `48000.5` stayed refused by the whole-number check behind the form).
  it('a rate with a decimal, a leading zero, a sign, no digits or eight digits is not a rate', () => {
    for (const rate of ['48000.5', '48000.0', '048000', '-48000', '+48000', '', '48 000', '48,000', '4.8e4', '12345678', '0']) {
      expect(read(STREAM_48.replace('48000 Hz', `${rate} Hz`)), rate).toEqual(unknown);
    }
  });

  // Mutation M2 (` Hz` read as ` ?Hz`): RED here.
  it('`48000Hz` without the space, two spaces, `kHz` and `hz` are not the form', () => {
    for (const unit of ['48000Hz', '48000  Hz', '48 kHz', '48000 hz']) {
      expect(read(STREAM_48.replace('48000 Hz', unit)), unit).toEqual(unknown);
    }
  });

  // Mutation M6 (the `$` taken off the stream form): RED here (text after the start value was accepted).
  it('the form holds to the last character and from the first', () => {
    for (const text of [
      `${STREAM_48} `,
      `${STREAM_48}' opened`,
      `${STREAM_48}, extra`,
      STREAM_48.replace('#0:0', '#0:1'),
      STREAM_48.replace('#0:0', '#1:0'),
      STREAM_48.replace('Audio', 'Video'),
      STREAM_48.replace('398060.445104', '398060'),
      STREAM_48.replace('9216 kb/s', 'N/A'),
    ]) {
      expect(read(text), text).toEqual(unknown);
    }
    // ROW N8b: the two entries this list held until then (the line without its start value, and
    // an output's own line) pinned "an output's line is not read". It is its own kind now, and in
    // the input's block it is still not the input's form (the block "complete starts" below).
    expect(read(STREAM_48.replace(', start 398060.445104', ''))).toMatchObject({ kind: 'OUTPUT_STREAM', output: 0 });
    expect(read(OUTPUT_STREAM)).toMatchObject({ kind: 'OUTPUT_STREAM', output: 0 });
    expect(fold([HEADER_0, OUTPUT_STREAM]).stream).toEqual({ known: false, reason: 'NOT_THE_FORM' });
    // Other indentation: not even a stream line.
    expect(read(STREAM_48.slice(1))).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
    expect(read(` ${STREAM_48}`)).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
  });

  // Mutation M7 (the format compared on the codec word alone): RED here (`pcm_f32le` with `s16` was the expected format).
  it('another codec or sample format is OTHER - the adapter can refuse it; no word of it leaves', () => {
    for (const [from, to] of [
      ['pcm_f32le,', 'pcm_s16le,'],
      [', flt,', ', s16,'],
      ['pcm_f32le,', 'pcm_f32be,'],
    ] as const) {
      const fact = read(STREAM_48.replace(from, to));
      expect(fact, to).toEqual({ kind: 'STREAM', statement: { known: true, format: 'OTHER', rateHz: 48000, layout: FIVE_ONE } });
      expect(JSON.stringify(fact)).not.toContain(to.replace(/[ ,]/g, ''));
    }
    expect(read(STREAM_48.replace(', flt,', ', s32 (24 bit),'))).toEqual(unknown);
    expect(read(STREAM_48.replace('pcm_f32le,', 'PCM_F32LE,'))).toEqual(unknown);
  });

  // Mutation M8 (the layout looked up by its first word, `word.split(' ')[0]`): RED here.
  it('a layout word with trailing text, another case or a parenthesis the table does not hold is UNKNOWN', () => {
    for (const word of ['5.1 (custom)', '5.1 extra', '5.1x', ' 5.1', '5.1 ', 'Stereo', 'MONO', '5.1(rear)', 'constructor', 'toString', '__proto__', '6 channels (FL+FR+FC+LFE+SL+SR)', 'x'.repeat(40)]) {
      const fact = read(STREAM_48.replace(', 5.1,', `, ${word},`));
      expect(fact, word).toEqual({ kind: 'STREAM', statement: { known: true, format: 'PCM_F32LE_FLT', rateHz: 48000, layout: { kind: 'UNKNOWN' } } });
    }
    // 41 characters or a comma inside: the line is not the form at all.
    expect(read(STREAM_48.replace(', 5.1,', `, ${'x'.repeat(41)},`))).toEqual(unknown);
    expect(read(STREAM_48.replace(', 5.1,', ', 5.1, 5.1,'))).toEqual(unknown);
  });

  // Mutation M9 (the count form read as `^([0-9]+) channels`): RED here (`06 channels` was a count of 6) and in the case `6 channels (FL+...)` of the test above.
  it('`<n> channels` is read only in that exact form, 1 to 64', () => {
    const count = (word: string) => {
      const fact = read(STREAM_48.replace(', 5.1,', `, ${word},`));
      return fact.kind === 'STREAM' && fact.statement.known ? fact.statement.layout : null;
    };
    expect(count('3 channels')).toEqual({ kind: 'COUNT_ONLY', channels: 3 });
    expect(count('1 channels')).toEqual({ kind: 'COUNT_ONLY', channels: 1 });
    expect(count('64 channels')).toEqual({ kind: 'COUNT_ONLY', channels: 64 });
    for (const word of ['0 channels', '65 channels', '06 channels', '100 channels', '6 channel', '6  channels', '6 channels ', '6 Channels', '6.0 channels', '-6 channels', '6 channels (FL+FR)']) {
      expect(count(word), word).toEqual({ kind: 'UNKNOWN' });
    }
  });

  // Mutation M10 (the cut mark not looked at: `whole` taken as true): RED here.
  it('a cut stream line is UNKNOWN, never half-parsed - also when what is left looks complete', () => {
    expect(classifyHelperLine({ text: STREAM_48, cut: true })).toEqual({ kind: 'STREAM', statement: { known: false, reason: 'CUT' } });
    expect(classifyHelperLine({ text: STREAM_48.slice(0, 44), cut: true })).toEqual({ kind: 'STREAM', statement: { known: false, reason: 'CUT' } });
    const long = `${STREAM_48}${' '.repeat(HELPER_LINE_MAX_CHARS)}`;
    expect(classifyHelperLine(whole(long))).toEqual({ kind: 'STREAM', statement: { known: false, reason: 'CUT' } });
  });

  // Mutation M11 (the printable check taken out of the stream reader AND `[^,]` left as it is): RED here.
  it('a control character, a mark or a non-ASCII letter anywhere in a stream line: UNKNOWN', () => {
    for (const bad of ['\u0000', '\t', '\r', '\u001b[31m', '\u007f', '‮', '​', 'é']) {
      expect(read(STREAM_48.replace(', 5.1,', `, 5.1${bad},`)), JSON.stringify(bad)).toEqual(unknown);
      expect(read(`${STREAM_48}${bad}`), JSON.stringify(bad)).toEqual(unknown);
    }
  });
});

describe('lines that are not read', () => {
  // Mutation M12 (the printable check taken out of `classifyHelperLine`): RED here BY THE REASON ONLY (`NO_FORM` for `NOT_PRINTABLE`): the anchored
  // forms refuse these lines by themselves, the check is the second guard. No line became a queue event or a refusal under the mutant.
  it('a control character in any line: UNRECOGNISED, whatever it looks like', () => {
    for (const text of [`${QUEUE_FULL}\r`, `\u001b[33m${QUEUE_FULL}`, `${REFUSED}\u0000`, `${ENDED_15}\n`, `${HEADER_0}\t`, `${QUEUE_FLUSHED} `]) {
      expect(read(text), JSON.stringify(text)).toEqual({ kind: 'UNRECOGNISED', reason: 'NOT_PRINTABLE' });
    }
  });

  // Mutation M13 (the length bound raised to 100,000): RED here.
  it('a 10,000-character line is not read; 512 is read and 513 is not', () => {
    expect(read('x'.repeat(10_000))).toEqual({ kind: 'UNRECOGNISED', reason: 'TOO_LONG' });
    expect(read(`${QUEUE_FULL}${' '.repeat(10_000)}`)).toEqual({ kind: 'UNRECOGNISED', reason: 'TOO_LONG' });
    expect(read('x'.repeat(HELPER_LINE_MAX_CHARS))).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
    expect(read('x'.repeat(HELPER_LINE_MAX_CHARS + 1))).toEqual({ kind: 'UNRECOGNISED', reason: 'TOO_LONG' });
    // Bounded work on a hostile long line that begins as a stream line.
    const hostile = `${STREAM_48.slice(0, 40)}${'9'.repeat(10_000)}`;
    expect(read(hostile)).toEqual({ kind: 'STREAM', statement: { known: false, reason: 'CUT' } });
  });

  // Mutation M14 (the cut mark not looked at for the other forms): RED here.
  it('a cut line that is not a stream line: UNRECOGNISED, also when what is left is a whole form', () => {
    for (const text of [QUEUE_FULL, QUEUE_FLUSHED, REFUSED, ENDED_15, HEADER_0, 'anything']) {
      expect(classifyHelperLine({ text, cut: true }), text).toEqual({ kind: 'UNRECOGNISED', reason: 'CUT' });
    }
  });

  it('`Output #` ends the place of the input by its first eight characters, cut or not, and nothing of its path is read', () => {
    expect(read("Output #0, f32le, to '/synthetic/pipe-a':")).toEqual({ kind: 'OUTPUT_HEADER' });
    expect(classifyHelperLine({ text: `Output #1, f32le, to '/${'p'.repeat(600)}`, cut: true })).toEqual({ kind: 'OUTPUT_HEADER' });
    expect(read(' Output #0')).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
  });
});

describe('the place of the stream line (design 4.6 row 1)', () => {
  const OUTPUT_0 = "Output #0, f32le, to '/synthetic/pipe-a':";

  it('the measured open: header, duration, stream line, output', () => {
    const state = fold([HEADER_0, DURATION_48, STREAM_48, 'Stream mapping:', OUTPUT_0, OUTPUT_STREAM]);
    expect(state.section).toBe('CLOSED');
    expect(state.stream).toEqual({ known: true, format: 'PCM_F32LE_FLT', rateHz: 48000, layout: FIVE_ONE });
    // ROW N8b: until then this pinned `unrecognised: 2, streamLinesOutOfPlace: 1` - the line
    // `Stream mapping:` as noise and the output's own line as out of place. Both are read now.
    expect(state.counts).toEqual({
      lines: 6,
      unrecognised: 1,
      streamLinesOutOfPlace: 0,
      mappingLines: 0,
      mappingLinesOutOfPlace: 0,
      outputHeaders: 1,
      inputHeadersOfAnotherIndex: 0,
      queueFull: 0,
      queueFlushed: 0,
      openRefused: 0,
      endedOnSignal: 0,
    });
    expect(state.outputs).toEqual([{ output: 0, statement: MONO_48 }]);
  });

  it('the effect of each line is said once', () => {
    let state = startHelperLines(0);
    const effects: string[] = [];
    for (const text of [HEADER_0, DURATION_48, STREAM_48, OUTPUT_0, OUTPUT_STREAM]) {
      const reading = readHelperLine(state, whole(text));
      effects.push(reading.effect);
      expect(Object.isFrozen(state) || reading.state !== state).toBe(true);
      state = reading.state;
    }
    expect(effects).toEqual(['NONE', 'NONE', 'STREAM_STATED', 'NONE', 'NONE']);
  });

  // Mutation M15 (the fold takes a stream line in ANY section): RED in the three cases below.
  it('a stream line before the header states nothing', () => {
    const state = fold([STREAM_48]);
    expect(state.stream).toBeNull();
    expect(state.counts.streamLinesOutOfPlace).toBe(1);
  });

  it('a stream line after an `Output #` line states nothing, with or without a header', () => {
    expect(fold([HEADER_0, OUTPUT_0, STREAM_48]).stream).toBeNull();
    expect(fold([OUTPUT_0, HEADER_0, STREAM_48]).stream).toEqual({ known: false, reason: 'STATED_MORE_THAN_ONCE' });
    expect(fold([OUTPUT_0, STREAM_48]).stream).toBeNull();
  });

  // Mutation M16 (the header's index not compared with the launch's): RED here.
  it('a header of another index opens no place: the stream line of ANOTHER device is not this launch`s', () => {
    const state = fold(["Input #0, avfoundation, from 'none:1':", STREAM_48], 0);
    expect(state.section).toBe('BEFORE_INPUT');
    expect(state.stream).toBeNull();
    expect(state.counts.inputHeadersOfAnotherIndex).toBe(1);
    expect(fold(["Input #0, avfoundation, from 'none:1':", STREAM_48], 1).stream).toMatchObject({ known: true, rateHz: 48000 });
  });

  // Mutation M17 (a second stream line ignored, "the first wins"): RED here.
  it('a SECOND `Audio:` line in the place withdraws the statement - also when both say the same', () => {
    for (const second of [STREAM_96, STREAM_48, STREAM_48.replace('#0:0', '#0:1'), { text: STREAM_48, cut: true }]) {
      let state = fold([HEADER_0, STREAM_48]);
      const reading = readHelperLine(state, typeof second === 'string' ? whole(second) : second);
      state = reading.state;
      expect(reading.effect).toBe('STREAM_WITHDRAWN');
      expect(state.stream).toEqual({ known: false, reason: 'STATED_MORE_THAN_ONCE' });
      // ... and it never becomes known again.
      expect(readHelperLine(state, whole(STREAM_48)).state.stream).toEqual({ known: false, reason: 'STATED_MORE_THAN_ONCE' });
    }
    // A wrong first line is not repaired by a right second one.
    expect(fold([HEADER_0, STREAM_48.replace('48000 Hz', '48000Hz'), STREAM_48]).stream).toEqual({ known: false, reason: 'STATED_MORE_THAN_ONCE' });
    // A second header of the same index.
    expect(fold([HEADER_0, STREAM_96, HEADER_0]).stream).toEqual({ known: false, reason: 'STATED_MORE_THAN_ONCE' });
  });

  it('a cut or malformed stream line in its place is the statement: UNKNOWN', () => {
    expect(fold([HEADER_0, { text: STREAM_48, cut: true }]).stream).toEqual({ known: false, reason: 'CUT' });
    expect(fold([HEADER_0, STREAM_48.replace('48000 Hz', '48000.5 Hz')]).stream).toEqual({ known: false, reason: 'NOT_THE_FORM' });
  });

  it('the refused open (MM2 s3), the queue pair (MM3 s8.2) and the ordered end (MM s6) are counted where they come', () => {
    const refused = fold([REFUSED, ...REFUSED_FOLLOWERS]);
    expect(refused.stream).toBeNull();
    expect(refused.counts).toMatchObject({ lines: 4, openRefused: 1, unrecognised: 3 });
    const session = fold([HEADER_0, DURATION_48, STREAM_48, OUTPUT_0, OUTPUT_STREAM, QUEUE_FULL, QUEUE_FLUSHED, QUEUE_FULL, ENDED_15]);
    expect(session.counts).toMatchObject({ queueFull: 2, queueFlushed: 1, endedOnSignal: 1, openRefused: 0 });
    expect(session.stream).toMatchObject({ known: true, rateHz: 48000 });
  });

  it('the index of a launch is a whole number 0 to 31', () => {
    for (const bad of [-1, 32, 0.5, Number.NaN]) expect(() => startHelperLines(bad)).toThrow(RangeError);
    expect(startHelperLines(31).expectedDeviceIndex).toBe(31);
  });
});

describe('nothing device-chosen leaves as text (AD-06, SM-12 (3))', () => {
  const NAME = 'Synthetic-Interface-7Q';

  // Mutation M18 (an UNRECOGNISED fact given a `text` member holding the line): RED here.
  it('a device name in a line, also a name that carries a whole stream line, leaves no character of itself', () => {
    const lines = [
      `[in#0 @ ${PTR}] audio device '${NAME}' opened`,
      // The stream line INSIDE a name, in one line: not at the start of the line, so not a stream line.
      `[in#0 @ ${PTR}] audio device '${NAME}${STREAM_96}' opened`,
      `[in#0 @ ${PTR}] audio device '${NAME} ${QUEUE_FULL}' opened`,
      `Input #0, avfoundation, from 'none:${NAME}':`,
      HEADER_0,
      DURATION_48,
      `  Stream #0:0: Audio: pcm_f32le, 48000 Hz, ${NAME}, flt, 9216 kb/s, start 398060.445104`,
      `Output #0, f32le, to '/${NAME}':`,
      { text: `[in#0 @ ${PTR}] audio device '${NAME}`, cut: true },
      `${NAME}${'x'.repeat(10_000)}`,
    ];
    let state = startHelperLines(0);
    const seen: string[] = [];
    for (const line of lines) {
      const reading = readHelperLine(state, typeof line === 'string' ? whole(line) : line);
      seen.push(JSON.stringify(reading));
      state = reading.state;
    }
    const all = seen.join('\n');
    expect(all).not.toContain(NAME);
    expect(all).not.toContain('Synthetic');
    expect(all).not.toContain(PTR);
    expect(all).not.toContain('96000');
    expect(state.stream).toEqual({ known: true, format: 'PCM_F32LE_FLT', rateHz: 48000, layout: { kind: 'UNKNOWN' } });
    expect(state.counts.queueFull).toBe(0);
    // Every string anywhere in a reading is a word of a closed set.
    const CLOSED_WORDS = new Set([
      ...HELPER_LAYOUT_TABLE.map((entry) => entry.word),
      ...['INPUT_HEADER', 'OUTPUT_HEADER', 'STREAM', 'QUEUE_FULL', 'QUEUE_FLUSHED', 'OPEN_REFUSED', 'ENDED_ON_SIGNAL', 'UNRECOGNISED'],
      ...['CUT', 'TOO_LONG', 'NOT_PRINTABLE', 'NO_FORM', 'NOT_THE_FORM', 'STATED_MORE_THAN_ONCE'],
      ...['PCM_F32LE_FLT', 'OTHER', 'NAMED', 'COUNT_ONLY', 'UNKNOWN', 'MEASURED', 'BUILD_TABLE', 'NOT_STATED', 'AUDIO_FORMAT_NOT_SUPPORTED'],
      ...['BEFORE_INPUT', 'INPUT', 'CLOSED', 'STREAM_STATED', 'STREAM_WITHDRAWN', 'NONE'],
    ]);
    const strings: string[] = [];
    JSON.parse(`[${seen.join(',')}]`, (_key, value: unknown) => {
      if (typeof value === 'string') strings.push(value);
      return value;
    });
    expect(strings.length).toBeGreaterThan(20);
    expect(strings.filter((word) => !CLOSED_WORDS.has(word))).toEqual([]);
  });

  it('a name that carries line breaks is several lines: a planted header and stream line withdraw the statement instead of making it', () => {
    // What the door would hand on for a name `X\n<header>\n<stream line at 96 kHz>\nY` printed before the true statement.
    const state = fold([`[in#0 @ ${PTR}] audio device 'X`, HEADER_0, STREAM_96, "Y' opened", HEADER_0, DURATION_48, STREAM_48]);
    expect(state.stream).toEqual({ known: false, reason: 'STATED_MORE_THAN_ONCE' });
  });
});

describe('the layout table against the pinned build', () => {
  // The section "Standard channel layouts" of `<helper> -hide_banner -layouts`, pinned FFmpeg 9.0.2,
  // run once by row N8 on 2026-10-14, verbatim (40 rows).
  const BUILD_LIST = `
mono           FC
stereo         FL+FR
2.1            FL+FR+LFE
3.0            FL+FR+FC
3.0(back)      FL+FR+BC
4.0            FL+FR+FC+BC
quad           FL+FR+BL+BR
quad(side)     FL+FR+SL+SR
3.1            FL+FR+FC+LFE
5.0            FL+FR+FC+BL+BR
5.0(side)      FL+FR+FC+SL+SR
4.1            FL+FR+FC+LFE+BC
5.1            FL+FR+FC+LFE+BL+BR
5.1(side)      FL+FR+FC+LFE+SL+SR
6.0            FL+FR+FC+BC+SL+SR
6.0(front)     FL+FR+FLC+FRC+SL+SR
3.1.2          FL+FR+FC+LFE+TFL+TFR
hexagonal      FL+FR+FC+BL+BR+BC
6.1            FL+FR+FC+LFE+BC+SL+SR
6.1(back)      FL+FR+FC+LFE+BL+BR+BC
6.1(front)     FL+FR+LFE+FLC+FRC+SL+SR
7.0            FL+FR+FC+BL+BR+SL+SR
7.0(front)     FL+FR+FC+FLC+FRC+SL+SR
7.1            FL+FR+FC+LFE+BL+BR+SL+SR
7.1(wide)      FL+FR+FC+LFE+BL+BR+FLC+FRC
7.1(wide-side) FL+FR+FC+LFE+FLC+FRC+SL+SR
5.1.2          FL+FR+FC+LFE+SL+SR+TFL+TFR
5.1.2(back)    FL+FR+FC+LFE+BL+BR+TFL+TFR
octagonal      FL+FR+FC+BL+BR+BC+SL+SR
cube           FL+FR+BL+BR+TFL+TFR+TBL+TBR
5.1.4          FL+FR+FC+LFE+SL+SR+TFL+TFR+TBL+TBR
7.1.2          FL+FR+FC+LFE+BL+BR+SL+SR+TFL+TFR
7.1.4          FL+FR+FC+LFE+BL+BR+SL+SR+TFL+TFR+TBL+TBR
7.2.3          FL+FR+FC+LFE+BL+BR+SL+SR+TFL+TFR+TBC+LFE2
9.1.4          FL+FR+FC+LFE+BL+BR+FLC+FRC+SL+SR+TFL+TFR+TBL+TBR
9.1.6          FL+FR+FC+LFE+BL+BR+FLC+FRC+SL+SR+TFL+TFR+TBL+TBR+TSL+TSR
hexadecagonal  FL+FR+FC+BL+BR+BC+SL+SR+TFL+TFC+TFR+TBL+TBC+TBR+WL+WR
binaural       BIL+BIR
downmix        DL+DR
22.2           FL+FR+FC+LFE+BL+BR+FLC+FRC+BC+SL+SR+TC+TFL+TFC+TFR+TBL+TBC+TBR+LFE2+TSL+TSR+BFC+BFL+BFR
`;
  const built = BUILD_LIST.trim()
    .split('\n')
    .map((row) => {
      const [word, decomposition] = row.split(/ +/) as [string, string];
      return { word, channels: decomposition.split('+').length };
    });

  // Mutation M19 (`5.1` given 5 channels in the table): RED here and in every measured stream line.
  // Mutation M20 (the row `7.1(wide-side)` taken out of the table): RED here.
  it('the same words, in the same order, each with the count of its decomposition', () => {
    expect(built).toHaveLength(40);
    expect(HELPER_LAYOUT_TABLE.map(({ word, channels }) => ({ word, channels }))).toEqual(built);
    expect(new Set(HELPER_LAYOUT_TABLE.map((entry) => entry.word)).size).toBe(40);
  });

  it('every word of the build is read to its count, inside 1 to 64; only `5.1` is MEASURED', () => {
    for (const { word, channels } of built) {
      const layout = readHelperLayout(word);
      expect(layout, word).toMatchObject({ kind: 'NAMED', word, channels });
      expect(channels).toBeGreaterThanOrEqual(1);
      expect(channels).toBeLessThanOrEqual(64);
      const fact = read(STREAM_48.replace(', 5.1,', `, ${word},`));
      expect(fact, word).toMatchObject({ kind: 'STREAM', statement: { known: true, layout: { kind: 'NAMED', word, channels } } });
    }
    expect(HELPER_LAYOUT_TABLE.filter((entry) => entry.basis === 'MEASURED').map((entry) => entry.word)).toEqual(['5.1']);
    expect(Object.isFrozen(HELPER_LAYOUT_TABLE)).toBe(true);
    expect(Object.isFrozen(HELPER_LAYOUT_TABLE[0])).toBe(true);
  });

  it('the names of single channels are not layout words', () => {
    for (const word of ['FL', 'FC', 'LFE', 'BIL', '']) expect(readHelperLayout(word), word).toEqual({ kind: 'UNKNOWN' });
  });
});

// ---- row N8b (decision C118): the three kinds with the stream prefix, and complete starts ----

describe('the block `Stream mapping:` and an output`s own line are their own kinds (row N8b)', () => {
  const unknown = { kind: 'STREAM', statement: { known: false, reason: 'NOT_THE_FORM' } };

  // Mutation N2 (the `$` taken off the mapping form): RED here (the lines with text after the last parenthesis were mapping lines).
  it('a mapping line is that form to its last character; it states the output index and nothing else', () => {
    expect(read(MAPPING_0)).toEqual({ kind: 'MAPPING', output: 0 });
    expect(read(MAPPING_1)).toEqual({ kind: 'MAPPING', output: 1 });
    expect(read(MAPPING_0.replace('#0:0 (', '#3:0 ('))).toEqual({ kind: 'MAPPING', output: 3 });
    // The generated source of row N4b: another codec word on the left.
    expect(read('  Stream #0:0 -> #1:0 (pcm_f64le (native) -> pcm_f32le (native))')).toEqual({ kind: 'MAPPING', output: 1 });
    for (const text of [
      `${MAPPING_0} `,
      `${MAPPING_0}, 48000 Hz`,
      `${MAPPING_0}  Stream #0:0: Audio: pcm_f32le, 96000 Hz, 5.1, flt, 18432 kb/s, start 1.000000`,
      MAPPING_0.replace('#0:0 (', '#4:0 ('),
      MAPPING_0.replace('#0:0 (', '#0:1 ('),
      MAPPING_0.replace('#0:0 ->', '#0:1 ->'),
      MAPPING_0.replace('#0:0 ->', '#1:0 ->'),
      '  Stream #0:0 -> #0:0 (copy)',
      '  Stream #0:0 -> #0:0 (pcm_f32le (native) -> pcm_f32le (libsynthetic))',
      '  Stream #0:0 -> #0:0',
      '  Stream #0:0 ->',
    ]) {
      expect(read(text), text).toEqual(unknown);
    }
    expect(read(MAPPING_0.slice(1))).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
  });

  it('the line `Stream mapping:` is those fifteen characters', () => {
    expect(read(MAPPING_HEADER)).toEqual({ kind: 'MAPPING_HEADER' });
    for (const text of ['Stream mapping', 'Stream mapping: ', ' Stream mapping:', 'stream mapping:', 'Stream mapping: #0:0']) {
      expect(read(text), text).toEqual({ kind: 'UNRECOGNISED', reason: 'NO_FORM' });
    }
  });

  // Mutation N7, two runs. (a) the `$` taken off the output's form: RED here AND in 13 cases of row N8 above (in a run shared with N2, N5, N6,
  // N9, N10; none of the 13 was RED in the same run without it) - the INPUT's own line, which only goes on after the bit rate, became an output's line. (b) ` (default)` admitted before the `$`: RED here and in the
  // case "in an output`s block a cut, malformed or input-form line" below.
  it('an output`s line: the form WITHOUT a start value, to its last character, outputs 0 to 3; stated as what it says', () => {
    expect(read(OUTPUT_STREAM)).toEqual({ kind: 'OUTPUT_STREAM', output: 0, statement: MONO_48 });
    expect(read(OUTPUT_STREAM_1)).toEqual({ kind: 'OUTPUT_STREAM', output: 1, statement: MONO_48 });
    expect(read(OUTPUT_STREAM.replace('#0:0', '#3:0'))).toMatchObject({ kind: 'OUTPUT_STREAM', output: 3 });
    // Not mono, not 48,000, not f32le: read as what it states - the adapter refuses it.
    expect(read('  Stream #1:0: Audio: pcm_s16le, 44100 Hz, stereo, s16, 1411 kb/s')).toEqual({
      kind: 'OUTPUT_STREAM',
      output: 1,
      statement: { known: true, format: 'OTHER', rateHz: 44100, layout: { kind: 'NAMED', word: 'stereo', channels: 2, basis: 'BUILD_TABLE' } },
    });
    for (const text of [
      `${OUTPUT_STREAM} (default)`,
      `${OUTPUT_STREAM}, extra`,
      `${OUTPUT_STREAM} `,
      OUTPUT_STREAM.replace('#0:0', '#4:0'),
      OUTPUT_STREAM.replace('#0:0', '#0:1'),
      OUTPUT_STREAM.replace('48000 Hz', '48000.0 Hz'),
      OUTPUT_STREAM.replace('1536 kb/s', 'N/A'),
      // What a line of another thread run into it would leave (seen between two filter lines on the device, MM3 s8.2).
      `  Stream #0:0: Audio: pcm_f32le, 48000 Hz, [Parsed_pan_0 @ ${PTR}] Pure channel mapping detected: 0`,
    ]) {
      expect(read(text), text).toEqual(unknown);
    }
  });

  // Mutation N6 (`whole &&` taken off the test before the two forms): RED here.
  it('a CUT line with the stream prefix is never a mapping line or an output`s line, also when what is left looks whole', () => {
    const cut = { kind: 'STREAM', statement: { known: false, reason: 'CUT' } };
    expect(classifyHelperLine({ text: MAPPING_0, cut: true })).toEqual(cut);
    expect(classifyHelperLine({ text: OUTPUT_STREAM, cut: true })).toEqual(cut);
    expect(classifyHelperLine(whole(`${MAPPING_0}${' '.repeat(HELPER_LINE_MAX_CHARS)}`))).toEqual(cut);
    expect(classifyHelperLine({ text: MAPPING_HEADER, cut: true })).toEqual({ kind: 'UNRECOGNISED', reason: 'CUT' });
    expect(read(`${MAPPING_0.slice(0, 20)}\u0000${MAPPING_0.slice(20)}`)).toEqual(unknown);
  });
});

describe('where each of them counts (row N8b)', () => {
  const INPUT_BLOCK = [HEADER_0, DURATION_48, STREAM_48];
  const TO_MAPPING = [...INPUT_BLOCK, MAPPING_HEADER, MAPPING_0, MAPPING_1];
  const withdrawn = { known: false, reason: 'STATED_MORE_THAN_ONCE' };

  // Mutation N1 (THE FAULT OF ROW N8: a mapping line read as a stream line again): RED here and in every complete start below.
  it('the mapping lines do not withdraw the input`s statement', () => {
    const state = fold([...TO_MAPPING, FIFO_0]);
    expect(state.stream).toEqual(INPUT_48);
    expect(state.counts).toMatchObject({ mappingLines: 2, mappingLinesOutOfPlace: 0, streamLinesOutOfPlace: 0 });
  });

  // Mutation N3 (a line with the stream prefix in the mapping block only counted): RED here.
  it('a line with the stream prefix in the mapping block that is NOT a mapping line withdraws the input`s statement', () => {
    for (const second of [STREAM_96, STREAM_48, OUTPUT_STREAM, '  Stream #0:0 -> #0:0 (copy)', `${MAPPING_0} `, { text: MAPPING_0, cut: true }]) {
      let state = fold([...INPUT_BLOCK, MAPPING_HEADER, MAPPING_0]);
      const reading = readHelperLine(state, typeof second === 'string' ? whole(second) : second);
      state = reading.state;
      expect(reading.effect, JSON.stringify(second)).toBe('STREAM_WITHDRAWN');
      expect(state.stream, JSON.stringify(second)).toEqual(withdrawn);
      expect(state.counts.streamLinesOutOfPlace).toBe(1);
      // ... for good: the rest of a clean start does not bring it back.
      expect(fold([MAPPING_1, FIFO_0, OUTPUT_STREAM], 0).stream).toBeNull();
      for (const text of [MAPPING_1, FIFO_0, OUTPUT_STREAM]) state = readHelperLine(state, whole(text)).state;
      expect(state.stream).toEqual(withdrawn);
    }
  });

  // Mutation N9 (the line `Stream mapping:` leaves the section as it is): RED here (the line after it was the statement).
  it('`Stream mapping:` ends the block of the input: a stream line after it states nothing, a header after it withdraws', () => {
    const late = fold([HEADER_0, MAPPING_HEADER, STREAM_48]);
    expect(late.section).toBe('MAPPING');
    expect(late.stream).toBeNull();
    expect(late.counts.streamLinesOutOfPlace).toBe(1);
    expect(fold([MAPPING_HEADER, HEADER_0, STREAM_48]).stream).toEqual(withdrawn);
    // A second line `Stream mapping:` and a mapping line outside the block are counted and change nothing.
    const twice = fold([...TO_MAPPING, MAPPING_HEADER, FIFO_0, MAPPING_0]);
    expect(twice.stream).toEqual(INPUT_48);
    expect(twice.counts).toMatchObject({ mappingLines: 2, mappingLinesOutOfPlace: 2 });
    expect(fold([...INPUT_BLOCK, MAPPING_0]).counts).toMatchObject({ mappingLines: 0, mappingLinesOutOfPlace: 1 });
  });

  it('a SECOND `Input #` block after a complete start still withdraws (decision D2 of row N8, for what it was meant for)', () => {
    const clean = [...TO_MAPPING, FIFO_0, OUTPUT_STREAM, FIFO_1, OUTPUT_STREAM_1];
    expect(fold(clean).stream).toEqual(INPUT_48);
    expect(fold([...clean, HEADER_0]).stream).toEqual(withdrawn);
    expect(fold([...clean, HEADER_0, STREAM_48]).stream).toEqual(withdrawn);
    expect(fold([...INPUT_BLOCK, HEADER_0, ...TO_MAPPING.slice(3)]).stream).toEqual(withdrawn);
    expect(fold([...INPUT_BLOCK, STREAM_48, ...TO_MAPPING.slice(3)]).stream).toEqual(withdrawn);
  });

  // Mutation N4 (an output's line states the output IT names, whatever block is open): RED here (`[{ output: 1, known }]`, and an entry with no block open).
  it('an output is stated by the line of ITS OWN block only', () => {
    expect(fold([...TO_MAPPING, FIFO_0, OUTPUT_STREAM, FIFO_1, OUTPUT_STREAM_1]).outputs).toEqual([
      { output: 0, statement: MONO_48 },
      { output: 1, statement: MONO_48 },
    ]);
    // The blocks in the other order, as the pinned build also prints them (row N4b).
    expect(fold([...TO_MAPPING, FIFO_1, OUTPUT_STREAM_1, FIFO_0, OUTPUT_STREAM]).outputs.map((entry) => entry.output)).toEqual([1, 0]);
    // The line of output 1 in the block of output 0: output 0 is UNKNOWN, output 1 has no entry.
    expect(fold([...TO_MAPPING, FIFO_0, OUTPUT_STREAM_1]).outputs).toEqual([{ output: 0, statement: { known: false, reason: 'NOT_THE_FORM' } }]);
    // No block open: nothing is stated.
    const early = fold([...TO_MAPPING, OUTPUT_STREAM]);
    expect(early.outputs).toEqual([]);
    expect(early.stream).toEqual(withdrawn);
    expect(fold([OUTPUT_STREAM]).outputs).toEqual([]);
    // A block whose line never came has no entry: the adapter that launched two asks for two.
    expect(fold([...TO_MAPPING, FIFO_0, OUTPUT_STREAM, FIFO_1]).outputs).toHaveLength(1);
  });

  // Mutation N5 (a second line in an output's block ignored, "the first wins"): RED here.
  it('a SECOND line with the stream prefix in an output`s block withdraws that output, and only that one', () => {
    for (const second of [OUTPUT_STREAM, OUTPUT_STREAM_1, STREAM_48, MAPPING_0, `${OUTPUT_STREAM} (default)`]) {
      const state = fold([...TO_MAPPING, FIFO_1, OUTPUT_STREAM_1, FIFO_0, OUTPUT_STREAM, second]);
      if (second === MAPPING_0) {
        // A mapping line is not a statement: counted out of its place, the output stays.
        expect(state.outputs[1]).toEqual({ output: 0, statement: MONO_48 });
        continue;
      }
      expect(state.outputs, second).toEqual([
        { output: 1, statement: MONO_48 },
        { output: 0, statement: withdrawn },
      ]);
      expect(fold([...TO_MAPPING, FIFO_1, OUTPUT_STREAM_1, FIFO_0, OUTPUT_STREAM, second, OUTPUT_STREAM]).outputs[1]?.statement).toEqual(withdrawn);
      expect(state.stream).toEqual(INPUT_48);
    }
    // A second block of the same output: its line is a second statement of that output.
    expect(fold([...TO_MAPPING, FIFO_0, OUTPUT_STREAM, FIFO_0, OUTPUT_STREAM]).outputs).toEqual([{ output: 0, statement: withdrawn }]);
  });

  // Mutation N8 (in an output's block a line that is not the output's form is only counted): RED here (the output had no entry, or stayed known).
  it('in an output`s block a cut, malformed or input-form line makes THAT output unknown and leaves the input`s statement', () => {
    const garbled = `  Stream #0:0: Audio: pcm_f32le, 48000 Hz, [Parsed_pan_0 @ ${PTR}] Pure channel mapping detected: 0`;
    for (const [line, reason] of [
      [whole(STREAM_48), 'NOT_THE_FORM'],
      [whole(garbled), 'NOT_THE_FORM'],
      [whole(`${OUTPUT_STREAM} (default)`), 'NOT_THE_FORM'],
      [{ text: OUTPUT_STREAM, cut: true }, 'CUT'],
    ] as const) {
      const state = fold([...TO_MAPPING, FIFO_0, line]);
      expect(state.outputs, line.text).toEqual([{ output: 0, statement: { known: false, reason } }]);
      expect(state.stream).toEqual(INPUT_48);
      expect(state.counts.streamLinesOutOfPlace).toBe(0);
    }
  });

  // Mutation N10 (the index of an `Output #` line read from a cut line too): RED here.
  it('an `Output #` line that was cut, or names an output above 3, opens no block: its lines state nothing', () => {
    for (const header of [{ text: FIFO_0, cut: true }, whole("Output #4, fifo, to '/synthetic/run/MIC-05.pcm':"), whole("Output #01, fifo, to '/synthetic/x':"), whole('Output #0')]) {
      const state = fold([...TO_MAPPING, header, OUTPUT_STREAM]);
      expect(state.section, header.text).toBe('CLOSED');
      expect(state.openOutput, header.text).toBeNull();
      expect(state.outputs, header.text).toEqual([]);
      expect(state.counts).toMatchObject({ outputHeaders: 1, streamLinesOutOfPlace: 1 });
    }
    expect(fold([...TO_MAPPING, FIFO_1]).openOutput).toBe(1);
  });
});

describe('complete starts: whole standard-error texts (row N8b, decision C118)', () => {
  const NAMES = [
    'composed-one-output-48k',
    'device-one-output-96k',
    'device-one-output-96k-signal-15',
    'device-refused-open',
    'device-two-outputs-48k-interleaved',
    'device-two-outputs-48k-queue-lines',
    'generated-two-outputs-48k',
    'generated-two-outputs-signal-15',
  ];
  const INPUT_96 = { known: true, format: 'PCM_F32LE_FLT', rateHz: 96000, layout: FIVE_ONE };
  const ZERO = { streamLinesOutOfPlace: 0, mappingLinesOutOfPlace: 0, inputHeadersOfAnotherIndex: 0, queueFull: 0, queueFlushed: 0, openRefused: 0, endedOnSignal: 0 };
  const readings = (name: string) => {
    let state = startHelperLines(0);
    return start(name).lines.map((text) => {
      const reading = readHelperLine(state, whole(text));
      state = reading.state;
      return reading;
    });
  };
  const end = (name: string): HelperLinesState => readings(name).at(-1)!.state;

  it('the fixtures: each says what it is, holds no name, no home path and no redaction mark, and every line is one the door would hand on whole', () => {
    expect(readdirSync(STARTS).sort()).toEqual(NAMES.map((name) => `${name}.txt`).sort());
    for (const name of NAMES) {
      const { head, lines } = start(name);
      expect(head, name).toMatch(/^FIXTURE {2}[a-z0-9-]+\nBASIS {4}(DEVICE_VERBATIM|DEVICE_ABRIDGED|GENERATED_SOURCE_VERBATIM|COMPOSED - NOT A RECORDED START)/);
      expect(head.split('\n')[0], name).toBe(`FIXTURE  ${name}`);
      expect(head, name).toContain('\nCHANGED  ');
      expect(lines.length, name).toBeGreaterThanOrEqual(4);
      for (const text of lines) {
        expect(text.length, name).toBeLessThanOrEqual(HELPER_LINE_MAX_CHARS);
        expect(text, name).toMatch(/^[\x20-\x7e]+$/);
        expect(text, name).not.toMatch(/\/Users\/|0x<ptr>|<work>|<USB|\.cache/);
      }
      // The only quoted texts of a line are the device word of the header, a generated source and a synthetic path.
      for (const quoted of lines.join('\n').match(/'[^']*'/g) ?? []) {
        expect(quoted, name).toMatch(/^'(none:0|aevalsrc=[^']+|\/synthetic\/run\/[A-Za-z0-9.-]+)'$/);
      }
    }
    // The one that is not a record says so, and what must confirm it.
    expect(start('composed-one-output-48k').head).toContain('ONE REAL START MUST CONFIRM IT');
  });

  // Mutation N1 (THE FAULT OF ROW N8): RED in the five cases below that state an input - `STATED_MORE_THAN_ONCE` on every one.
  it('on the device, TWO outputs at 48,000 Hz with the two queue lines in the middle of the run (MM2 capture 15): every fact', () => {
    expect(end('device-two-outputs-48k-queue-lines')).toEqual({
      expectedDeviceIndex: 0,
      section: 'CLOSED',
      stream: INPUT_48,
      outputs: [
        { output: 0, statement: MONO_48 },
        { output: 1, statement: MONO_48 },
      ],
      openOutput: 1,
      counts: { ...ZERO, lines: 25, unrecognised: 14, mappingLines: 2, outputHeaders: 2, queueFull: 1, queueFlushed: 1 },
    });
    const kinds = readings('device-two-outputs-48k-queue-lines').map((reading) => reading.fact.kind);
    expect(kinds.slice(0, 6)).toEqual(['INPUT_HEADER', 'UNRECOGNISED', 'STREAM', 'MAPPING_HEADER', 'MAPPING', 'MAPPING']);
    expect(kinds.slice(20, 22)).toEqual(['QUEUE_FULL', 'QUEUE_FLUSHED']);
  });

  it('on the device, ONE output at 96,000 Hz (MM capture 6): the input states 96,000 - the adapter can refuse it - and the output 48,000 mono', () => {
    const state = end('device-one-output-96k');
    expect(state.stream).toEqual(INPUT_96);
    expect(state.outputs).toEqual([{ output: 0, statement: MONO_48 }]);
    expect(state.counts).toEqual({ ...ZERO, lines: 14, unrecognised: 8, mappingLines: 1, outputHeaders: 1 });
  });

  it('on the device, ended by signal 15 (MM capture 15): the ending line is counted after a start that stands', () => {
    const state = end('device-one-output-96k-signal-15');
    expect(state.stream).toEqual(INPUT_96);
    expect(state.outputs).toEqual([{ output: 0, statement: MONO_48 }]);
    expect(state.counts).toEqual({ ...ZERO, lines: 15, unrecognised: 8, mappingLines: 1, outputHeaders: 1, endedOnSignal: 1 });
    expect(readings('device-one-output-96k-signal-15').at(-1)!.fact).toEqual({ kind: 'ENDED_ON_SIGNAL', signal: 15 });
  });

  it('on the device, a refused open (MM2 capture 13): the refusal, no statement of anything', () => {
    expect(end('device-refused-open')).toEqual({
      expectedDeviceIndex: 0,
      section: 'BEFORE_INPUT',
      stream: null,
      outputs: [],
      openOutput: null,
      counts: { ...ZERO, lines: 4, unrecognised: 3, mappingLines: 0, outputHeaders: 0, openRefused: 1 },
    });
  });

  it('on the device, two filter lines run into each other (MM3 capture 33, abridged): they are noise, the start stands', () => {
    const state = end('device-two-outputs-48k-interleaved');
    expect(state.stream).toEqual(INPUT_48);
    expect(state.outputs).toEqual([
      { output: 0, statement: MONO_48 },
      { output: 1, statement: MONO_48 },
    ]);
    expect(state.counts).toEqual({ ...ZERO, lines: 26, unrecognised: 15, mappingLines: 2, outputHeaders: 2, queueFull: 1, queueFlushed: 1 });
  });

  it('COMPOSED, the product`s ONE output at 48,000 Hz: the same facts as a record would give - to be confirmed by one real start (row N9)', () => {
    const state = end('composed-one-output-48k');
    expect(state.stream).toEqual(INPUT_48);
    expect(state.outputs).toEqual([{ output: 0, statement: MONO_48 }]);
    expect(state.counts).toEqual({ ...ZERO, lines: 14, unrecognised: 8, mappingLines: 1, outputHeaders: 1 });
  });

  // Mutation N11 (an output's form in the input's block taken as the input's statement): RED in the case `fold([HEADER_0, OUTPUT_STREAM])` of the block "near-misses".
  it('the pinned build on a GENERATED source (row N4b): no input of the capture layer, so NO input statement; the outputs as stated, block 1 before block 0', () => {
    const state = end('generated-two-outputs-48k');
    expect(state.stream).toBeNull();
    expect(state.section).toBe('CLOSED');
    expect(state.outputs).toEqual([
      { output: 1, statement: MONO_48 },
      { output: 0, statement: MONO_48 },
    ]);
    // The source's own stream line stands before any header of the capture layer: out of place.
    expect(state.counts).toEqual({ ...ZERO, lines: 23, unrecognised: 15, streamLinesOutOfPlace: 1, mappingLines: 2, outputHeaders: 2 });
    const stopped = end('generated-two-outputs-signal-15');
    expect(stopped.outputs.map((entry) => entry.output)).toEqual([0, 1]);
    expect(stopped.counts).toEqual({ ...ZERO, lines: 24, unrecognised: 15, streamLinesOutOfPlace: 1, mappingLines: 2, outputHeaders: 2, endedOnSignal: 1 });
  });

  it('no line of a clean start withdraws anything, and the input is stated by its third line', () => {
    for (const name of NAMES) {
      const effects = readings(name).map((reading) => reading.effect);
      expect(effects.filter((effect) => effect === 'STREAM_WITHDRAWN'), name).toEqual([]);
      const stated = effects.indexOf('STREAM_STATED');
      expect(stated, name).toBe(name.startsWith('device-refused') || name.startsWith('generated-') ? -1 : 2);
      expect(effects.filter((effect) => effect === 'STREAM_STATED').length, name).toBe(stated === -1 ? 0 : 1);
    }
  });

  it('nothing of a line leaves as text: no pointer, no path, no codec word, no encoder word; every string is a word of a closed set', () => {
    const CLOSED_WORDS = new Set([
      ...['INPUT_HEADER', 'OUTPUT_HEADER', 'STREAM', 'MAPPING_HEADER', 'MAPPING', 'OUTPUT_STREAM', 'QUEUE_FULL', 'QUEUE_FLUSHED', 'OPEN_REFUSED', 'ENDED_ON_SIGNAL', 'UNRECOGNISED'],
      // `OTHER`: the generated source's own line (pcm_f64le, dbl), read as an output's form and out of place.
      ...['NO_FORM', 'NOT_THE_FORM', 'PCM_F32LE_FLT', 'OTHER', 'NAMED', 'MEASURED', 'BUILD_TABLE', 'NOT_STATED', 'AUDIO_FORMAT_NOT_SUPPORTED'],
      ...['BEFORE_INPUT', 'INPUT', 'MAPPING', 'CLOSED', 'STREAM_STATED', 'NONE', '5.1', 'mono'],
    ]);
    for (const name of NAMES) {
      const all = JSON.stringify(readings(name));
      for (const text of ['0x', 'synthetic', 'pcm_', 'Lav', 'fifo', 'aevalsrc', 'none:']) expect(all, `${name} ${text}`).not.toContain(text);
      const strings: string[] = [];
      JSON.parse(all, (_key, value: unknown) => {
        if (typeof value === 'string') strings.push(value);
        return value;
      });
      expect(strings.filter((word) => !CLOSED_WORDS.has(word)), name).toEqual([]);
    }
  });
});
