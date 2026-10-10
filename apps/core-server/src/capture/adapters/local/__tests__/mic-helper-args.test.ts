// The argument tables of the microphone helper (blueprint row 135; capture spec §A.7.1 "Mic helper -
// exact pipeline shape", ML-1, ML-4; §G.1 G-R12; check M4-SEC-HELPER-1). A table that cannot fail is
// no check: each rule has a planted violation that must be found.
import { describe, expect, it } from 'vitest';
import { MIC_TRANSPORTS, micPipePath } from '../../mic-transport';
import { isUsableDeviceName } from '../device-list';
import {
  LOCAL_MIC_DEVICE_NAME,
  MIC_HELPER_TABLE,
  MIC_OUTPUT_ARGUMENTS,
  MicGeneratedTone,
  MicHelperArgumentError,
  isMicPipeArgument,
  isSpeechFixtureArgument,
  micOutputPromise,
  micPrecheckArguments,
  micPushArguments,
  speechFixturePath,
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
