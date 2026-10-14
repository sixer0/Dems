// THE GATE of a macOS helper's start and THE COUNT of a pre-check (task 4 row N9;
// masterplan/06 revision 3 section 4.6; SM-04 (2), SM-14, SM-16 (1) to (3); the ruling on row N8's D1).
//
// The lines are the recorded starts of row N8b (`fixtures/macos-helper-starts/`: device lines, the
// pinned build's lines, one composed start - each says so in its head), read by the real reader of
// rows N8 / N8b; the gate is asked after every line as the adapter asks it. Each rule names the
// mutant it was seen RED on (record: implementation/n9_macos_usb_audio_adapter.md section 5).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readHelperLine, startHelperLines, type HelperLinesState } from '../macos-helper-lines';
import { MACOS_MIC_RATE_HZ, MACOS_PRECHECK_COUNT_BYTES_MAX, MacosGateDetail, createSampleCounter, judgeHelperStart, type MacosGateExpectation, type MacosGateVerdict } from '../macos-launch-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const MARK = '--- helper standard error ---\n';
function startLines(name: string): string[] {
  const text = readFileSync(resolve(HERE, 'fixtures', 'macos-helper-starts', `${name}.txt`), 'utf8');
  return text.slice(text.indexOf(MARK) + MARK.length, -1).split('\n');
}

/** Folds the lines and asks the gate after each one; answers the FIRST verdict that is not WAIT (as the adapter takes it), else WAIT. */
function gateOf(lines: readonly string[], expected: MacosGateExpectation, index = 0): MacosGateVerdict {
  let state: HelperLinesState = startHelperLines(index);
  for (const text of lines) {
    state = readHelperLine(state, { text, cut: false }).state;
    const verdict = judgeHelperStart(state, expected);
    if (verdict.verdict !== 'WAIT') return verdict;
  }
  return { verdict: 'WAIT' };
}

const SIX = { channelCount: 6, outputs: 1 } as const;
const SIX_TWO = { channelCount: 6, outputs: 2 } as const;
const refusal = (code: string, detail: string): MacosGateVerdict => ({ verdict: 'REFUSE', code, detail }) as MacosGateVerdict;
/** The two-output start of the device, the input's stream line replaced. */
const twoWith = (streamLine: string): string[] => startLines('device-two-outputs-48k-queue-lines').map((line) => (line.includes(', start ') && line.startsWith('  Stream #0:0: Audio:') ? streamLine : line));

describe('the gate on recorded starts', () => {
  it('the device start with two outputs and its queue lines, and the interleaved one: PASS for six channels and two outputs', () => {
    expect(gateOf(startLines('device-two-outputs-48k-queue-lines'), SIX_TWO)).toEqual({ verdict: 'PASS' });
    expect(gateOf(startLines('device-two-outputs-48k-interleaved'), SIX_TWO)).toEqual({ verdict: 'PASS' });
    expect(gateOf(startLines('composed-one-output-48k'), SIX)).toEqual({ verdict: 'PASS' });
  });

  it('PASS is never given before every output has stated itself (row N8b: the blocks come after the input\'s)', () => {
    const lines = startLines('device-two-outputs-48k-queue-lines');
    const outputOne = lines.findIndex((line) => line.startsWith('  Stream #1:0:'));
    // Every prefix that ends before output 1's own line waits; with it, the start passes. Mutant G-4 (PASS on `outputs.length >= 1`): RED.
    expect(gateOf(lines.slice(0, outputOne), SIX_TWO)).toEqual({ verdict: 'WAIT' });
    expect(gateOf(lines.slice(0, outputOne + 1), SIX_TWO)).toEqual({ verdict: 'PASS' });
    // Only the input's block: WAIT, also with the input's line read. Mutant G-5 (no wait for the end of the input's block) is
    // EQUIVALENT, measured: inside the input's block no output can have stated itself, so the output rule waits anyway.
    expect(gateOf(lines.slice(0, 3), SIX_TWO)).toEqual({ verdict: 'WAIT' });
  });

  it('RULE 1: a device at 96,000 Hz is refused on the INPUT\'s own line, though every output states 48,000 (MF6: the program converts without a word)', () => {
    // Mutant G-1 (the rate rule removed): RED - the recorded 96 kHz start then passes.
    expect(gateOf(startLines('device-one-output-96k'), SIX)).toEqual(refusal('AUDIO_CARD_RATE_UNSUPPORTED', MacosGateDetail.HELPER_STATES_OTHER_RATE));
    expect(gateOf(twoWith('  Stream #0:0: Audio: pcm_f32le, 44100 Hz, 5.1, flt, 8467 kb/s, start 399163.910563'), SIX_TWO)).toEqual(refusal('AUDIO_CARD_RATE_UNSUPPORTED', 'HELPER_STATES_OTHER_RATE'));
    expect(MACOS_MIC_RATE_HZ).toBe(48_000);
  });

  it('RULE 2: the layout word\'s count must EQUAL the listing\'s; a build-table word is admitted only so; a count without a word and an unknown word are refused', () => {
    // The listing says two channels, the helper states `5.1`: another device than the listed one. Mutant G-2 (count not compared): RED.
    expect(gateOf(startLines('device-two-outputs-48k-queue-lines'), { channelCount: 2, outputs: 2 })).toEqual(refusal('AUDIO_CARD_MOVED', MacosGateDetail.CHANNELS_DIFFER));
    // A word of the build's table (not measured on a device) whose count agrees: admitted (the ruling on N8's D1).
    expect(gateOf(twoWith('  Stream #0:0: Audio: pcm_f32le, 48000 Hz, 7.1, flt, 12288 kb/s, start 399163.910563'), { channelCount: 8, outputs: 2 })).toEqual({ verdict: 'PASS' });
    expect(gateOf(twoWith('  Stream #0:0: Audio: pcm_f32le, 48000 Hz, 7.1, flt, 12288 kb/s, start 399163.910563'), SIX_TWO)).toEqual(refusal('AUDIO_CARD_MOVED', 'CHANNELS_DIFFER'));
    // A count without a word, and a word outside the table. Mutant G-3 (COUNT_ONLY admitted by its count): RED.
    expect(gateOf(twoWith('  Stream #0:0: Audio: pcm_f32le, 48000 Hz, 6 channels, flt, 9216 kb/s, start 399163.910563'), SIX_TWO)).toEqual(refusal('AUDIO_CARD_MOVED', MacosGateDetail.LAYOUT_WORD_UNKNOWN));
    expect(gateOf(twoWith('  Stream #0:0: Audio: pcm_f32le, 48000 Hz, 6.0(back), flt, 9216 kb/s, start 399163.910563'), SIX_TWO)).toEqual(refusal('AUDIO_CARD_MOVED', 'LAYOUT_WORD_UNKNOWN'));
    // The built-in input (one channel, `mono`) cannot pass for the six-channel interface.
    expect(gateOf(twoWith('  Stream #0:0: Audio: pcm_f32le, 48000 Hz, mono, flt, 1536 kb/s, start 399163.910563'), SIX_TWO)).toEqual(refusal('AUDIO_CARD_MOVED', 'CHANNELS_DIFFER'));
  });

  it('RULE 3: another codec or sample format, a withdrawn statement and a line that is not the form are refused', () => {
    expect(gateOf(twoWith('  Stream #0:0: Audio: pcm_s16le, 48000 Hz, 5.1, s16, 4608 kb/s, start 399163.910563'), SIX_TWO)).toEqual(refusal('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.STREAM_NOT_AS_EXPECTED));
    const lines = startLines('device-two-outputs-48k-queue-lines');
    // A second stream line in the input's block withdraws the statement (row N8's D2): refused.
    expect(gateOf([...lines.slice(0, 3), lines[2] ?? '', ...lines.slice(3)], SIX_TWO)).toEqual(refusal('AUDIO_HELPER_ENDED_AT_START', 'STREAM_NOT_AS_EXPECTED'));
    expect(gateOf(twoWith('  Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt'), SIX_TWO)).toEqual(refusal('AUDIO_HELPER_ENDED_AT_START', 'STREAM_NOT_AS_EXPECTED'));
  });

  it('the input\'s place: a header of another index, and a place closed without a statement, are refused; a refused open is WAIT (the adapter reads its end)', () => {
    expect(gateOf(startLines('device-two-outputs-48k-queue-lines'), SIX_TWO, 2)).toEqual(refusal('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.INPUT_OF_ANOTHER_INDEX));
    const lines = startLines('device-two-outputs-48k-queue-lines').filter((line) => !(line.startsWith('  Stream #0:0: Audio:') && line.includes(', start ')));
    expect(gateOf(lines, SIX_TWO)).toEqual(refusal('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.NO_STREAM_LINE));
    expect(gateOf(startLines('device-refused-open'), SIX)).toEqual({ verdict: 'WAIT' });
  });

  it('RULE 4: the outputs - one the list does not hold, an output that is not mono 48,000, more mapping lines than outputs', () => {
    // The two-output start against a launch of ONE output: output 1 is not the launch's.
    expect(gateOf(startLines('device-two-outputs-48k-queue-lines'), SIX)).toEqual(refusal('AUDIO_HELPER_ENDED_AT_START', MacosGateDetail.OUTPUT_NOT_AS_EXPECTED));
    const stereo = startLines('device-two-outputs-48k-queue-lines').map((line) => (line.startsWith('  Stream #1:0:') ? '  Stream #1:0: Audio: pcm_f32le, 48000 Hz, stereo, flt, 3072 kb/s' : line));
    expect(gateOf(stereo, SIX_TWO)).toEqual(refusal('AUDIO_HELPER_ENDED_AT_START', 'OUTPUT_NOT_AS_EXPECTED'));
    const resampled = startLines('device-two-outputs-48k-queue-lines').map((line) => (line.startsWith('  Stream #1:0:') ? '  Stream #1:0: Audio: pcm_f32le, 44100 Hz, mono, flt, 1411 kb/s' : line));
    expect(gateOf(resampled, SIX_TWO)).toEqual(refusal('AUDIO_HELPER_ENDED_AT_START', 'OUTPUT_NOT_AS_EXPECTED'));
  });

  it('an expectation that is not of its shape is a programming error', () => {
    expect(() => judgeHelperStart(startHelperLines(0), { channelCount: 0, outputs: 1 })).toThrow(RangeError);
    expect(() => judgeHelperStart(startHelperLines(0), { channelCount: 6, outputs: 3 })).toThrow(RangeError);
  });
});

describe('the count of a pre-check: one non-zero sample, counted in memory, within a bound of bytes', () => {
  const floats = (values: readonly number[]): Uint8Array => {
    const bytes = new Uint8Array(values.length * 4);
    const view = new DataView(bytes.buffer);
    values.forEach((value, at) => view.setFloat32(at * 4, value, true));
    return bytes;
  };

  it('samples cut between two chunks are counted once, whole; exact zeros, minus zero and a non-finite value are not "non-zero"', () => {
    const counter = createSampleCounter();
    const bytes = floats([0, -0, Number.NaN, Number.POSITIVE_INFINITY, 0.25, 0]);
    // Cut at every awkward place: 1, 3, 5 ... bytes.
    for (let at = 0; at < bytes.length; at += 3) counter.push(bytes.subarray(at, Math.min(at + 3, bytes.length)));
    // Mutant C-1 (`value !== 0` dropped): RED - nonZero becomes 6 or 3.
    expect(counter.count()).toEqual({ samples: 6, nonZero: 1, overBound: false });
  });

  it('a silent second: 48,000 zeros counted, none non-zero; a cut last sample is no sample', () => {
    const counter = createSampleCounter();
    counter.push(new Uint8Array(48_000 * 4 + 3));
    expect(counter.count()).toEqual({ samples: 48_000, nonZero: 0, overBound: false });
  });

  it('beyond the bound nothing is counted, and it says so', () => {
    const counter = createSampleCounter(8);
    counter.push(floats([1, 2, 3]));
    expect(counter.count()).toEqual({ samples: 2, nonZero: 2, overBound: true });
    expect(MACOS_PRECHECK_COUNT_BYTES_MAX).toBe(384_000);
  });
});
