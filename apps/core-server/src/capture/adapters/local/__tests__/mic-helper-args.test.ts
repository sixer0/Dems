// The argument tables of the microphone helper (blueprint row 135; capture spec §A.7.1 "Mic helper -
// exact pipeline shape", ML-1, ML-4; §G.1 G-R12; check M4-SEC-HELPER-1). A table that cannot fail is
// no check: each rule has a planted violation that must be found.
import { describe, expect, it } from 'vitest';
import { MIC_TRANSPORTS, micPipePath } from '../../mic-transport';
import { isUsableDeviceName } from '../device-list';
import { SHARED_PCM_NAME, sharedPcmName } from '../../audio/alsa-config';
import { AUDIO_INPUT_BEYOND_CARD, AudioInputBeyondCardError } from '../../types';
import {
  LINUX_MIC_ARGUMENT_REFUSED,
  LINUX_MIC_CHANNELS_MAX,
  LINUX_MIC_CHANNEL_INDEX_MAX,
  LOCAL_MIC_DEVICE_NAME,
  LinuxMicArgumentError,
  MIC_HELPER_TABLE,
  MIC_LINUX_HELPER_TABLE,
  MIC_OUTPUT_ARGUMENTS,
  MicGeneratedTone,
  MicHelperArgumentError,
  isMicPipeArgument,
  isSpeechFixtureArgument,
  linuxChannelSelection,
  linuxMicDeviceArgument,
  linuxMicPrecheckArguments,
  linuxMicPushArguments,
  micOutputPromise,
  micPrecheckArguments,
  micPushArguments,
  speechFixturePath,
  type LinuxMicPushArguments,
} from '../mic-helper-args';

const PIPE = micPipePath('/work/.data/run/capture', 'SES-20261009-0001', 'MIC-03');

describe('the exact pipeline shape of the spec', () => {
  it('device input: the microphone by exact name, video none, then the one output line into the pipe', () => {
    expect([...micPushArguments({ source: { kind: 'DEVICE', name: LOCAL_MIC_DEVICE_NAME }, pipePath: PIPE })]).toEqual([
      // quiet
      '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning',
      // added by pass C2 (H-18): the progress report on standard output, read by the no-sample bound
      '-progress', 'pipe:1',
      // input
      '-f', 'avfoundation', '-i', 'none:MacBook Air Microphone',
      // output line
      '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-y',
      PIPE,
    ]);
  });

  it('generated input: the same output line, the input of the fake microphone of slot 2', () => {
    expect([...micPushArguments({ source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 }, pipePath: PIPE })]).toEqual([
      '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning',
      '-progress', 'pipe:1',
      '-re', '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000',
      '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-y',
      PIPE,
    ]);
  });

  it('the pre-check opens the device for a fraction of a second and writes nothing', () => {
    const list = [...micPrecheckArguments(LOCAL_MIC_DEVICE_NAME)];
    expect(list.slice(-6)).toEqual(['-t', '0.2', '-vn', '-f', 'null', '-']);
    expect(list).toContain('none:MacBook Air Microphone');
    expect(list.some((argument) => argument.endsWith('.pcm'))).toBe(false);
  });

  it('the output line IS the transport the worker reads: float 32 little-endian, 48 kHz, mono, no buffering (ML-3, ML-4)', () => {
    const promise = micOutputPromise();
    expect(promise).toEqual({ rateHz: MIC_TRANSPORTS.PCM_FIFO.sampleRateHz, channels: MIC_TRANSPORTS.PCM_FIFO.channels, sampleFormat: MIC_TRANSPORTS.PCM_FIFO.sampleFormat });
    const out = [...MIC_OUTPUT_ARGUMENTS];
    const value = (flag: string): string | undefined => out[out.indexOf(flag) + 1];
    expect(value('-ar')).toBe(String(promise.rateHz));
    expect(value('-ac')).toBe(String(promise.channels));
    expect(promise.sampleFormat).toBe('F32LE');
    expect(value('-c:a')).toBe('pcm_f32le');
    expect(value('-f')).toBe('f32le');
    // ML-4: flushed per packet, and no filter that collects samples.
    expect(value('-flush_packets')).toBe('1');
    expect(out.some((argument) => ['-af', '-filter:a', '-filter_complex', '-async', '-aresample'].includes(argument))).toBe(false);
    // ML-3: the helper does no clock correction.
    expect(out.some((argument) => /^-(?:async|vsync|fps_mode|copyts)$/.test(argument))).toBe(false);
  });
});

/** G-R12 as a function of a list, so that the control can run it on a planted one. */
function violations(list: readonly string[], computed: readonly string[]): string[] {
  const literals = new Set(MIC_HELPER_TABLE.literals);
  const found: string[] = [];
  for (const argument of list) {
    if (literals.has(argument) || computed.includes(argument)) continue;
    found.push(`not a literal and not a computed value: ${argument}`);
  }
  for (const argument of list) {
    if (/0\.0\.0\.0|::|udp|listen|rtsp|tcp|@|[;|&$`<>\n\r\\]/i.test(argument)) found.push(`forbidden text: ${argument}`);
    if (/screen|desk view/i.test(argument)) found.push(`screen or desk-view name: ${argument}`);
  }
  return found;
}

describe('G-R12: every argument is a literal of the table or one of the two computed values', () => {
  const device = micPushArguments({ source: { kind: 'DEVICE', name: LOCAL_MIC_DEVICE_NAME }, pipePath: PIPE });
  const generated = micPushArguments({ source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_440 }, pipePath: PIPE });
  const precheck = micPrecheckArguments(LOCAL_MIC_DEVICE_NAME);

  it('holds for the device, the generated and the pre-check list', () => {
    expect(violations(device, [`none:${LOCAL_MIC_DEVICE_NAME}`, PIPE])).toEqual([]);
    expect(violations(generated, [PIPE])).toEqual([]);
    expect(violations(precheck, [`none:${LOCAL_MIC_DEVICE_NAME}`])).toEqual([]);
  });

  it('finds a planted extra option, a listen address, a datagram transport, a user part and a screen name (control)', () => {
    expect(violations([...device, '-rtsp_flags'], [`none:${LOCAL_MIC_DEVICE_NAME}`, PIPE]).length).toBeGreaterThan(0);
    expect(violations([...device, 'udp://0.0.0.0:5000'], [PIPE]).length).toBeGreaterThan(0);
    expect(violations([...device, 'tcp://x:y@host'], [PIPE]).length).toBeGreaterThan(0);
    expect(violations([...device, '-listen', '1'], [PIPE]).length).toBeGreaterThan(0);
    expect(violations([...device, 'Capture screen 0'], [PIPE]).length).toBeGreaterThan(0);
    expect(violations([...device, 'x; rm -rf /'], [PIPE]).length).toBeGreaterThan(0);
  });

  it('no literal of the tables names a screen, a Desk View camera, a network address or a socket option', () => {
    for (const literal of MIC_HELPER_TABLE.literals) {
      expect(literal, literal).not.toMatch(/screen|desk|rtsp|tcp|udp|listen|0\.0\.0\.0|::|@/i);
    }
  });
});

describe('ML-1: a crafted device name cannot become an option or a second input', () => {
  // Names the shape rule lets through are ONE argument after `-i`; the rest never reach the table.
  const REFUSED = ['', ' ', '-f', '-f lavfi', 'a:b', 'none', 'default', 'Capture screen 0', '0', '1:0', 'x,y', 'x\ny', '../x', 'x/y', 'x\\y', ' leading', 'trailing ', 'Mic;rm', 'Mic$(id)', 'Mic`id`', 'a'.repeat(121), '“Mic”'];

  it('refuses each of them before any argument is built', () => {
    for (const name of REFUSED) {
      expect(isUsableDeviceName(name), JSON.stringify(name)).toBe(false);
      expect(() => micPrecheckArguments(name), JSON.stringify(name)).toThrow(MicHelperArgumentError);
      expect(() => micPushArguments({ source: { kind: 'DEVICE', name }, pipePath: PIPE }), JSON.stringify(name)).toThrow(MicHelperArgumentError);
    }
  });

  it('a name that passes becomes exactly one argument that starts with "none:" and so can never start with a dash', () => {
    for (const name of ['MacBook Air Microphone', 'USB Mic (2)', 'Mic -f lavfi', "Mike's Mic", 'A.B+C_d-e']) {
      expect(isUsableDeviceName(name), name).toBe(true);
      const list = micPushArguments({ source: { kind: 'DEVICE', name }, pipePath: PIPE });
      const at = list.indexOf('-i');
      expect(list[at + 1]).toBe(`none:${name}`);
      expect(list.filter((argument) => argument.includes(name))).toEqual([`none:${name}`]);
      // Exactly one `-i`: no second input can be smuggled in by a name that contains the text "-i".
      expect(list.filter((argument) => argument === '-i')).toHaveLength(1);
    }
  });

  it('an unknown generated tone is refused (the closed set is the table)', () => {
    expect(() => micPushArguments({ source: { kind: 'GENERATED', tone: 'TONE_1000' as MicGeneratedTone }, pipePath: PIPE })).toThrow(MicHelperArgumentError);
  });
});

describe('the pipe argument has the shape micPipePath builds, and nothing else', () => {
  it('accepts what micPipePath builds', () => {
    expect(isMicPipeArgument(PIPE)).toBe(true);
    expect(isMicPipeArgument(micPipePath('/Users/Some User/DEMS/.data/run/capture', 'S:1.2_3-4', 'MIC-12'))).toBe(true);
  });

  it('refuses a relative path, a dot-dot segment, a double slash, a wrong name, a wrong extension and shell or URL text', () => {
    const refused = [
      'x/SES-1/MIC-03.pcm',
      '/work/../etc/SES-1/MIC-03.pcm',
      '/work//SES-1/MIC-03.pcm',
      '/work/SES-1/MIC-3.pcm',
      '/work/SES-1/MIC-03.txt',
      '/work/SES-1/CAM-03.pcm',
      '/work/SES-1/MIC-03.pcm\n',
      '/work/$(id)/SES-1/MIC-03.pcm',
      '/work/a@b/SES-1/MIC-03.pcm',
      '/work/;/SES-1/MIC-03.pcm',
      '/work/SES-1/../MIC-03.pcm',
      '/MIC-03.pcm',
      '-y',
      `/${'a'.repeat(1100)}/SES-1/MIC-03.pcm`,
    ];
    for (const path of refused) {
      expect(isMicPipeArgument(path), JSON.stringify(path)).toBe(false);
      expect(() => micPushArguments({ source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 }, pipePath: path })).toThrow(MicHelperArgumentError);
    }
  });
});

// Fix wave H (ruling D198 on gate 81, condition C1): the development SPEECH microphone. The generated
// tone carries no speech, so no chunk is ever planned in a development session; this source plays a
// file of synthetic speech through the SAME output line.
describe('the speech fixture input of the development speech microphone', () => {
  const FIXTURE = speechFixturePath('/work/.data');
  const speech = micPushArguments({ source: { kind: 'FIXTURE', path: FIXTURE }, pipePath: PIPE });
  const tone = micPushArguments({ source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_440 }, pipePath: PIPE });

  it('the exact list: paced by the timestamps of the file, started again at its end, read as WAV, then the one output line', () => {
    expect(FIXTURE).toBe('/work/.data/dev-fixtures/speech-mic/dialogue.wav');
    expect([...speech]).toEqual([
      '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning',
      '-progress', 'pipe:1',
      '-re', '-stream_loop', '-1', '-f', 'wav', '-i', FIXTURE,
      '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-y',
      PIPE,
    ]);
  });

  it('NO DEVICE: the list names no device layer, no device name and no second input', () => {
    expect(speech.some((argument) => /avfoundation|^none:|^default$|^[0-9]+(?::[0-9]+)?$/.test(argument) && argument !== '1' && argument !== '-1' && argument !== '48000')).toBe(false);
    expect(speech).not.toContain('avfoundation');
    expect(speech.filter((argument) => argument === '-i')).toHaveLength(1);
    // Control: the device list does name the device layer, so the assertion above can fail.
    expect(micPushArguments({ source: { kind: 'DEVICE', name: LOCAL_MIC_DEVICE_NAME }, pipePath: PIPE })).toContain('avfoundation');
  });

  it('REAL-TIME PACING and the SAME FORMAT as the tone source: `-re` leads the input, and everything after the input equals the tone list', () => {
    const inputAt = MIC_HELPER_TABLE.quietLength;
    expect(speech[inputAt]).toBe('-re');
    expect(tone[inputAt]).toBe('-re');
    expect(speech.slice(inputAt + MIC_HELPER_TABLE.fixtureInputLength)).toEqual(tone.slice(inputAt + MIC_HELPER_TABLE.generatedInputLength));
    expect(speech.slice(0, inputAt)).toEqual(tone.slice(0, inputAt));
    // Looped for as long as the session records: a session may outlast the file.
    expect(speech.slice(speech.indexOf('-stream_loop'), speech.indexOf('-stream_loop') + 2)).toEqual(['-stream_loop', '-1']);
  });

  it('G-R12 holds: every argument is a literal of the table or the fixture path / the pipe path', () => {
    expect(violations(speech, [FIXTURE, PIPE])).toEqual([]);
    // Control: the fixture path is NOT a literal - a list checked without it as a computed value is found.
    expect(violations(speech, [PIPE])).toEqual([`not a literal and not a computed value: ${FIXTURE}`]);
  });

  it('a path that is not of the fixture shape never becomes an argument', () => {
    const REFUSED = ['', 'dialogue.wav', '/work/.data/dev-fixtures/speech-mic/other.wav', '/work/.data/dev-fixtures/speech-mic/dialogue.wav.sdp', '/work/../etc/dev-fixtures/speech-mic/dialogue.wav', '/work//dev-fixtures/speech-mic/dialogue.wav', '-i/dev-fixtures/speech-mic/dialogue.wav', 'concat:/a/dev-fixtures/speech-mic/dialogue.wav', '/a;b/dev-fixtures/speech-mic/dialogue.wav', '/a$(id)/dev-fixtures/speech-mic/dialogue.wav', `/${'a'.repeat(1024)}/dev-fixtures/speech-mic/dialogue.wav`, 'rtsp://127.0.0.1/dev-fixtures/speech-mic/dialogue.wav'];
    for (const path of REFUSED) {
      expect(isSpeechFixtureArgument(path), JSON.stringify(path)).toBe(false);
      expect(() => micPushArguments({ source: { kind: 'FIXTURE', path }, pipePath: PIPE }), JSON.stringify(path)).toThrow(MicHelperArgumentError);
    }
    expect(isSpeechFixtureArgument('/Users/a b/DEMS/.data/dev-fixtures/speech-mic/dialogue.wav')).toBe(true);
  });
});

// ── The Linux table (task 4 blueprint row 66, WP-08; specification S3-5; SR-4; AD-07 (2)) ────────────
//
// THE DOUBLE. There is no ALSA on this host and no helper is started: the table is a function from
// integers to an argument list, and the test holds that list, word for word, to the lists of the
// tested input-av scheme (`apps/input-av/nvr/recorder.py:104-116, 205-215`, quoted below; the
// source is read by nobody at test time). Whether the program accepts the list and what the card
// then delivers is unproven here: record `implementation/066_linux_helper_args.md`, the container
// check of row 79 and the hardware checks 9A/H-07, 9A/H-08.

const QUIET_AND_PROGRESS = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning', '-progress', 'pipe:1'];
const OUTPUT_LINE = ['-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-y'];
/** A card with two inputs: card 1 of the listing, device 0. */
const DUO = { cardIndex: 1, deviceIndex: 0, channelCount: 2 } as const;
/** An interface with eight inputs: card 2 of the listing, device 0. */
const OCTO = { cardIndex: 2, deviceIndex: 0, channelCount: 8 } as const;

const linuxRefusal = (work: () => unknown): string => {
  try {
    work();
  } catch (error) {
    if (error instanceof LinuxMicArgumentError) return `${error.code}:${error.what}`;
    if (error instanceof AudioInputBeyondCardError) return error.code;
    throw error;
  }
  return 'accepted';
};

describe('the Linux table: the shared capture of the card with all its channels, one input selected, the one output line', () => {
  it('a 2-input card, input 2: both channels opened, channel 1 selected', () => {
    expect([...linuxMicPushArguments({ ...DUO, inputNumber: 2, pipePath: PIPE })]).toEqual([
      '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning',
      '-progress', 'pipe:1',
      // input: the tested list of input-av, the device named by two integers
      '-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-channels', '2', '-sample_rate', '48000', '-i', 'dems_1_0',
      // the selection
      '-af', 'pan=mono|c0=c1',
      // output line, unchanged
      '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-y',
      PIPE,
    ]);
    expect([...linuxMicPushArguments({ ...DUO, inputNumber: 1, pipePath: PIPE })].slice(7, 21)).toEqual(['-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-channels', '2', '-sample_rate', '48000', '-i', 'dems_1_0', '-af', 'pan=mono|c0=c0']);
  });

  it('a multi-input interface, input 3 of 8: all 8 channels opened, channel 2 alone selected', () => {
    expect([...linuxMicPushArguments({ ...OCTO, inputNumber: 3, pipePath: PIPE })]).toEqual([
      ...QUIET_AND_PROGRESS,
      '-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-channels', '8', '-sample_rate', '48000', '-i', 'dems_2_0',
      '-af', 'pan=mono|c0=c2',
      ...OUTPUT_LINE,
      PIPE,
    ]);
    // Whichever input is taken, the device is opened with the card's count: never with the input's number.
    for (let inputNumber = 1; inputNumber <= 8; inputNumber += 1) {
      const list = [...linuxMicPushArguments({ ...OCTO, inputNumber, pipePath: PIPE })];
      expect(list[list.indexOf('-channels') + 1], String(inputNumber)).toBe('8');
      expect(list[list.indexOf('-af') + 1], String(inputNumber)).toBe(`pan=mono|c0=c${String(inputNumber - 1)}`);
    }
  });

  it('two cards: two device arguments, each the name the configuration of row 65 gives that card', () => {
    const first = [...linuxMicPushArguments({ ...DUO, inputNumber: 1, pipePath: PIPE })];
    const second = [...linuxMicPushArguments({ ...OCTO, inputNumber: 1, pipePath: PIPE })];
    expect([first[first.indexOf('-i') + 1], second[second.indexOf('-i') + 1]]).toEqual(['dems_1_0', 'dems_2_0']);
    expect([linuxMicDeviceArgument(1, 0), linuxMicDeviceArgument(2, 0)]).toEqual([sharedPcmName(1, 0), sharedPcmName(2, 0)]);
    expect(linuxMicDeviceArgument(31, 31)).toBe('dems_31_31');
    expect(MIC_LINUX_HELPER_TABLE.deviceArgument.source).toBe(SHARED_PCM_NAME.source);
  });

  it('equals the lists of the tested input-av scheme as text, with integers where it had the card name', () => {
    // `recorder.py:212-215` (`_input_args`, format `alsa`, the defaults bits 24 and rate 48000) and
    // `recorder.py:115-116` (`audio_select_filter`, one input: layout `mono`, `c0=c<input - 1>`).
    const inputAv = (channels: number, device: string): string => `-thread_queue_size 1024 -f alsa -c:a pcm_s24le -channels ${String(channels)} -sample_rate 48000 -i ${device}`;
    const select = (input: number): string => `pan=mono|${[input].map((x, i) => `c${String(i)}=c${String(x - 1)}`).join('|')}`;
    const ours = (list: readonly string[]): string => list.slice(QUIET_AND_PROGRESS.length, list.indexOf('-vn')).join(' ');
    // The derived examples of the research record (`research/01_explore_input_av.md`, section TS-8): 6 channels with
    // input 3, 2 channels with input 2; and the manual command of the hand-over document, device `dems_EVO8_0` there.
    expect(ours(linuxMicPushArguments({ cardIndex: 0, deviceIndex: 0, channelCount: 6, inputNumber: 3, pipePath: PIPE }))).toBe(`${inputAv(6, 'dems_0_0')} -af ${select(3)}`);
    expect(ours(linuxMicPushArguments({ cardIndex: 0, deviceIndex: 0, channelCount: 6, inputNumber: 3, pipePath: PIPE }))).toBe('-thread_queue_size 1024 -f alsa -c:a pcm_s24le -channels 6 -sample_rate 48000 -i dems_0_0 -af pan=mono|c0=c2');
    expect(ours(linuxMicPushArguments({ ...DUO, inputNumber: 2, pipePath: PIPE }))).toBe(`${inputAv(2, 'dems_1_0')} -af ${select(2)}`);
    expect(linuxChannelSelection(0)).toBe('pan=mono|c0=c0');
    expect(linuxChannelSelection(63)).toBe('pan=mono|c0=c63');
  });

  it('the selection SELECTS and never mixes: one output channel, one source channel, no sum and no gain, for all 64', () => {
    expect(MIC_LINUX_HELPER_TABLE.channelSelections).toHaveLength(64);
    MIC_LINUX_HELPER_TABLE.channelSelections.forEach((text, index) => {
      expect(text).toBe(`pan=mono|c0=c${String(index)}`);
      expect(text).toBe(linuxChannelSelection(index));
      expect(text).toMatch(/^pan=mono\|c0=c(?:[0-9]|[1-5][0-9]|6[0-3])$/);
      expect(text).not.toMatch(/[+*<,;: ]|c1=/);
    });
    expect(new Set(MIC_LINUX_HELPER_TABLE.channelSelections).size).toBe(64);
  });

  it('what reaches the pipe is the transport the worker reads: the output line of the macOS table, unchanged, after the selection', () => {
    const list = [...linuxMicPushArguments({ ...OCTO, inputNumber: 8, pipePath: PIPE })];
    expect(list.slice(-1 - OUTPUT_LINE.length, -1)).toEqual([...MIC_OUTPUT_ARGUMENTS]);
    expect(list.slice(-1)).toEqual([PIPE]);
    const promise = micOutputPromise();
    expect([promise.rateHz, promise.channels, promise.sampleFormat]).toEqual([48_000, 1, 'F32LE']);
    // The card is asked for 24-bit samples: the widest the float of the pipe holds exactly (check E-6).
    expect(list[list.indexOf('alsa') + 2]).toBe(`pcm_s${String(MIC_TRANSPORTS.PCM_FIFO.sampleFormat === 'F32LE' ? 24 : 0)}le`);
    // One filter option, the selection; no option that corrects a clock or collects samples (ML-3, ML-4).
    expect(list.filter((argument) => ['-af', '-filter:a', '-filter_complex'].includes(argument))).toEqual(['-af']);
    expect(list.some((argument) => /^-(?:async|vsync|fps_mode|copyts|aresample)$/.test(argument))).toBe(false);
    expect([MIC_LINUX_HELPER_TABLE.quietLength, MIC_LINUX_HELPER_TABLE.inputLength, MIC_LINUX_HELPER_TABLE.selectLength, MIC_LINUX_HELPER_TABLE.outputLength, list.length]).toEqual([7, 12, 2, 12, 34]);
  });

  it('the pre-check opens the shared capture with all channels for a fraction of a second, selects and writes nothing', () => {
    expect([...linuxMicPrecheckArguments(OCTO)]).toEqual([
      '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning',
      '-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-channels', '8', '-sample_rate', '48000', '-i', 'dems_2_0',
      '-t', '0.2', '-vn', '-f', 'null', '-',
    ]);
  });

  it('the same integers give the same list, and a list cannot be changed by its reader', () => {
    const input: LinuxMicPushArguments = { ...OCTO, inputNumber: 3, pipePath: PIPE };
    expect([...linuxMicPushArguments(input)]).toEqual([...linuxMicPushArguments({ ...input })]);
    expect(linuxMicPushArguments(input).join('\u0000')).toBe(linuxMicPushArguments(input).join('\u0000'));
    expect(Object.isFrozen(linuxMicPushArguments(input))).toBe(true);
    expect(Object.isFrozen(linuxMicPrecheckArguments(OCTO))).toBe(true);
  });
});

describe('the Linux table: refusals before any argument is built', () => {
  it('an input beyond the card\'s channels is refused by name: AUDIO_INPUT_BEYOND_CARD', () => {
    expect(linuxRefusal(() => linuxMicPushArguments({ ...DUO, inputNumber: 3, pipePath: PIPE }))).toBe('AUDIO_INPUT_BEYOND_CARD');
    expect(linuxRefusal(() => linuxMicPushArguments({ ...OCTO, inputNumber: 9, pipePath: PIPE }))).toBe(AUDIO_INPUT_BEYOND_CARD);
    expect(linuxRefusal(() => linuxMicPushArguments({ ...OCTO, inputNumber: 8, pipePath: PIPE }))).toBe('accepted');
    // The refusal names the microphone by its registry id and nothing of the card.
    let raised: unknown = null;
    try {
      linuxMicPushArguments({ ...DUO, inputNumber: 3, pipePath: PIPE, deviceId: 'MIC-03' });
    } catch (error) {
      raised = error;
    }
    expect(raised).toBeInstanceOf(AudioInputBeyondCardError);
    expect([(raised as AudioInputBeyondCardError).deviceId, (raised as AudioInputBeyondCardError).message]).toEqual(['MIC-03', 'the sound card has no such input']);
  });

  it.each([
    ['an input number that is no whole number', { ...OCTO, inputNumber: 2.5 }, 'INPUT_NUMBER'],
    ['a negative input number', { ...OCTO, inputNumber: -1 }, 'INPUT_NUMBER'],
    ['input number 0 (inputs are numbered from 1)', { ...OCTO, inputNumber: 0 }, 'INPUT_NUMBER'],
    ['an input number above the maximum of 64', { cardIndex: 2, deviceIndex: 0, channelCount: 64, inputNumber: 65 }, 'INPUT_NUMBER'],
    ['an input number given as text', { ...OCTO, inputNumber: '3' }, 'INPUT_NUMBER'],
    ['an input number that is not a number', { ...OCTO, inputNumber: Number.NaN }, 'INPUT_NUMBER'],
    ['an input number that is a list', { ...OCTO, inputNumber: [1, 2] }, 'INPUT_NUMBER'],
    ['a channel count that is no whole number', { ...OCTO, channelCount: 7.5, inputNumber: 1 }, 'CHANNEL_COUNT'],
    ['no channel', { ...OCTO, channelCount: 0, inputNumber: 1 }, 'CHANNEL_COUNT'],
    ['a negative channel count', { ...OCTO, channelCount: -8, inputNumber: 1 }, 'CHANNEL_COUNT'],
    ['more channels than 64', { ...OCTO, channelCount: 65, inputNumber: 1 }, 'CHANNEL_COUNT'],
    ['a card index that is no whole number', { ...OCTO, cardIndex: 0.5, inputNumber: 1 }, 'CARD_INDEX'],
    ['a negative card index', { ...OCTO, cardIndex: -1, inputNumber: 1 }, 'CARD_INDEX'],
    ['a card index beyond 31', { ...OCTO, cardIndex: 32, inputNumber: 1 }, 'CARD_INDEX'],
    ['a card named by text', { ...OCTO, cardIndex: 'EVO8', inputNumber: 1 }, 'CARD_INDEX'],
    ['a device index that is no whole number', { ...OCTO, deviceIndex: 1.5, inputNumber: 1 }, 'DEVICE_INDEX'],
    ['a negative device index', { ...OCTO, deviceIndex: -1, inputNumber: 1 }, 'DEVICE_INDEX'],
    ['a device index beyond 31', { ...OCTO, deviceIndex: 32, inputNumber: 1 }, 'DEVICE_INDEX'],
  ])('%s', (_name, input, what) => {
    expect(linuxRefusal(() => linuxMicPushArguments({ ...(input as unknown as LinuxMicPushArguments), pipePath: PIPE }))).toBe(`${LINUX_MIC_ARGUMENT_REFUSED}:${what}`);
  });

  it('the selection function takes a whole number 0 to 63 and nothing else', () => {
    expect([LINUX_MIC_CHANNEL_INDEX_MAX, LINUX_MIC_CHANNELS_MAX]).toEqual([63, 64]);
    for (const bad of [-1, 64, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '3', null, undefined, [3], '0|c1=c1']) {
      expect(linuxRefusal(() => linuxChannelSelection(bad as number)), JSON.stringify(bad)).toBe(`${LINUX_MIC_ARGUMENT_REFUSED}:CHANNEL_INDEX`);
    }
    expect(linuxRefusal(() => linuxChannelSelection(0))).toBe('accepted');
    expect(linuxRefusal(() => linuxChannelSelection(63))).toBe('accepted');
  });

  it('a pipe path that is not of its shape, and the pre-check with a refused card', () => {
    expect(linuxRefusal(() => linuxMicPushArguments({ ...OCTO, inputNumber: 1, pipePath: '/tmp/x.pcm' }))).toBe(`${LINUX_MIC_ARGUMENT_REFUSED}:PIPE`);
    expect(linuxRefusal(() => linuxMicPushArguments({ ...OCTO, inputNumber: 1, pipePath: `${PIPE};x` }))).toBe(`${LINUX_MIC_ARGUMENT_REFUSED}:PIPE`);
    expect(linuxRefusal(() => linuxMicPrecheckArguments({ ...OCTO, channelCount: 65 }))).toBe(`${LINUX_MIC_ARGUMENT_REFUSED}:CHANNEL_COUNT`);
    expect(linuxRefusal(() => linuxMicPrecheckArguments({ ...OCTO, cardIndex: 32 }))).toBe(`${LINUX_MIC_ARGUMENT_REFUSED}:CARD_INDEX`);
    const error = new LinuxMicArgumentError('INPUT_NUMBER');
    expect([error.code, error.what, error.message]).toEqual(['LINUX_MIC_ARGUMENT_REFUSED', 'INPUT_NUMBER', 'a value of the Linux microphone helper is not of its shape']);
  });
});

describe('G-R12 as amended by SR-4, AD-07 (2): the Linux lists are literals, one device from two integers, one selection from one integer', () => {
  /** The rule over one Linux list: what each argument may be, and the one argument that may hold a bar. */
  function linuxViolations(list: readonly string[], pipe: string): string[] {
    const literals = new Set(MIC_LINUX_HELPER_TABLE.literals);
    const selections = new Set(MIC_LINUX_HELPER_TABLE.channelSelections);
    const found: string[] = [];
    list.forEach((argument, index) => {
      const selection = selections.has(argument) && list[index - 1] === '-af';
      const device = MIC_LINUX_HELPER_TABLE.deviceArgument.test(argument) && list[index - 1] === '-i';
      if (!literals.has(argument) && !selection && !device && argument !== pipe) found.push(`not of the table: ${argument}`);
      if (/0\.0\.0\.0|::|udp|listen|rtsp|tcp|@|[;&$`<>\n\r\\]/i.test(argument)) found.push(`forbidden text: ${argument}`);
      if (argument.includes('|') && !selection) found.push(`a bar outside the selection: ${argument}`);
    });
    if (list.filter((argument) => argument.includes('|')).length > 1) found.push('more than one argument with a bar');
    if (list.filter((argument) => argument === '-i').length !== 1) found.push('not exactly one input');
    return found;
  }

  /** What a hostile device could announce, and what the kernel would derive from it. */
  const HOSTILE = ['EVIL8', 'Evil Interface -i /etc/shadow', 'ffff:0666', 'usb-0000:00:14.0-9', 'hw:CARD=EVIL8,DEV=0', 'plughw:9,9', 'pan=mono|c0=c0+c1', '$(reboot)'];
  const hostile = (card: { cardIndex: number; deviceIndex: number; channelCount: number }, inputNumber: number): LinuxMicPushArguments =>
    ({
      ...card,
      inputNumber,
      pipePath: PIPE,
      cardId: 'EVIL8',
      product: 'Evil Interface -i /etc/shadow',
      usbId: 'ffff:0666',
      usbPort: 'usb-0000:00:14.0-9',
      device: 'hw:CARD=EVIL8,DEV=0',
      pcm: 'plughw:9,9',
      filter: 'pan=mono|c0=c0+c1',
      name: '$(reboot)',
    }) as LinuxMicPushArguments;

  it('holds for every card index, device index, channel count and input the table takes (sampled over the whole range)', () => {
    let lists = 0;
    for (const cardIndex of [0, 1, 9, 10, 31]) {
      for (const deviceIndex of [0, 1, 31]) {
        for (let channelCount = 1; channelCount <= LINUX_MIC_CHANNELS_MAX; channelCount += 1) {
          for (const inputNumber of new Set([1, Math.ceil(channelCount / 2), channelCount])) {
            const list = linuxMicPushArguments({ cardIndex, deviceIndex, channelCount, inputNumber, pipePath: PIPE });
            expect(linuxViolations(list, PIPE), list.join(' ')).toEqual([]);
            lists += 1;
          }
          expect(linuxViolations(linuxMicPrecheckArguments({ cardIndex, deviceIndex, channelCount }), PIPE)).toEqual([]);
        }
      }
    }
    expect(lists).toBeGreaterThan(2_000);
  });

  it('finds a card named by text, a second input, a mixing selection, a bar elsewhere and an extra option (control)', () => {
    const good = [...linuxMicPushArguments({ ...OCTO, inputNumber: 3, pipePath: PIPE })];
    const swap = (from: string, to: string): string[] => good.map((argument) => (argument === from ? to : argument));
    expect(linuxViolations(swap('dems_2_0', 'hw:CARD=EVIL8,DEV=0'), PIPE)).toEqual(['not of the table: hw:CARD=EVIL8,DEV=0']);
    expect(linuxViolations(swap('dems_2_0', 'dems_EVO8_0'), PIPE)).toEqual(['not of the table: dems_EVO8_0']);
    expect(linuxViolations(swap('dems_2_0', 'dems_32_0'), PIPE)).toEqual(['not of the table: dems_32_0']);
    expect(linuxViolations(swap('pan=mono|c0=c2', 'pan=mono|c0=c2+c3'), PIPE)).toEqual(['not of the table: pan=mono|c0=c2+c3', 'a bar outside the selection: pan=mono|c0=c2+c3']);
    expect(linuxViolations(swap('pan=mono|c0=c2', 'pan=mono|c0=c64'), PIPE)).toEqual(['not of the table: pan=mono|c0=c64', 'a bar outside the selection: pan=mono|c0=c64']);
    expect(linuxViolations(swap('pan=mono|c0=c2', 'pan=stereo|c0=c2|c1=c3'), PIPE).length).toBeGreaterThan(0);
    expect(linuxViolations([...good, 'pan=mono|c0=c1'], PIPE)).toEqual(['not of the table: pan=mono|c0=c1', 'a bar outside the selection: pan=mono|c0=c1', 'more than one argument with a bar']);
    expect(linuxViolations([...good, '-i', 'dems_1_0', '-shortest'], PIPE)).toEqual(['not of the table: -shortest', 'not exactly one input']);
    expect(linuxViolations(swap('8', '8 -i /etc/shadow'), PIPE)).toEqual(['not of the table: 8 -i /etc/shadow']);
    expect(linuxViolations(good, PIPE)).toEqual([]);
  });

  it('no text a device announced can reach an argument: a card that carries it gives exactly the list of the bare integers', () => {
    for (const [card, inputNumber] of [[DUO, 2], [OCTO, 3], [{ cardIndex: 31, deviceIndex: 31, channelCount: 64 }, 64]] as const) {
      const list = [...linuxMicPushArguments(hostile(card, inputNumber))];
      expect(list).toEqual([...linuxMicPushArguments({ ...card, inputNumber, pipePath: PIPE })]);
      for (const planted of HOSTILE) expect(list.some((argument) => argument.includes(planted)), planted).toBe(false);
      expect(linuxViolations(list, PIPE)).toEqual([]);
      const precheck = [...linuxMicPrecheckArguments(hostile(card, inputNumber))];
      expect(precheck).toEqual([...linuxMicPrecheckArguments(card)]);
      for (const planted of HOSTILE) expect(precheck.some((argument) => argument.includes(planted)), planted).toBe(false);
    }
  });

  it('text in the place of an integer is refused, never joined into an argument', () => {
    for (const text of ['EVO8', '1', '1,DEV=0', '0 -i x', '']) {
      expect(linuxRefusal(() => linuxMicDeviceArgument(text as unknown as number, 0)), text).toBe(`${LINUX_MIC_ARGUMENT_REFUSED}:CARD_INDEX`);
      expect(linuxRefusal(() => linuxMicDeviceArgument(0, text as unknown as number)), text).toBe(`${LINUX_MIC_ARGUMENT_REFUSED}:DEVICE_INDEX`);
    }
  });

  it('the literals of the Linux table name no network, no screen and no other device layer; the macOS table is as it was', () => {
    for (const literal of MIC_LINUX_HELPER_TABLE.literals) expect(literal, literal).not.toMatch(/screen|desk|rtsp|tcp|udp|listen|0\.0\.0\.0|::|@|\||avfoundation|lavfi|pulse|hw:/i);
    expect(MIC_LINUX_HELPER_TABLE.literals.filter((literal) => /^\d+$/.test(literal)).map(Number).sort((a, b) => a - b)).toEqual([...Array.from({ length: 64 }, (_unused, index) => index + 1), 1024, 48000]);
    // 0 changed results on the macOS side: its table holds no word of the Linux one and no bar.
    expect(MIC_HELPER_TABLE.literals.filter((literal) => /alsa|pcm_s24le|-channels|-sample_rate|-thread_queue_size|-af|\|/.test(literal))).toEqual([]);
    expect([MIC_HELPER_TABLE.quietLength, MIC_HELPER_TABLE.deviceInputLength, MIC_HELPER_TABLE.generatedInputLength, MIC_HELPER_TABLE.fixtureInputLength, MIC_HELPER_TABLE.outputLength]).toEqual([7, 4, 5, 7, 12]);
  });
});
