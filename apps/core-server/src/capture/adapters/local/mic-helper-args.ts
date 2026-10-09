/**
 * THE argument tables of the microphone helper (blueprint row 135; capture spec §A.7.1 "Mic helper
 * - exact pipeline shape", rules ML-1, ML-4, §A.6.4 HL-3, HL-12; §G.1 G-R12; checks
 * `M4-SEC-HELPER-1`, `M4-LOCAL-MIC-1`).
 *
 * The helper is the FFmpeg command-line program (9.0.2 on this host), started through the door of
 * this folder with one of the argument lists below, like the camera helper (`camera-helper-args.ts`).
 * Every argument is a literal of this file, except TWO values, each held to a strict shape before it
 * becomes an argument:
 *   1. the device name, which passes `isUsableDeviceName` and was found as exactly one entry of the
 *      AUDIO class of the device list (`device-list.ts`) before this table is asked. It becomes ONE
 *      argument, `none:<name>`; it can neither start with a dash nor carry a separator, so it cannot
 *      become an option of the program;
 *   2. the pipe path, `<runDir>/<sessionId>/<MIC-NN>.pcm`, built by `micPipePath` from two ids that
 *      passed their patterns (`mic-transport.ts`) and held again to that shape here.
 * No value typed by an operator, read from the database or taken from the network reaches an
 * argument. No table holds a screen-capture name or option, a network address, a listen option or a
 * datagram transport: the helper binds no socket at all.
 *
 * THE OUTPUT LINE is the transport the worker reads (`MIC_TRANSPORTS.PCM_FIFO`): 32-bit float,
 * little-endian, 48,000 Hz, mono, flushed per packet and with no filter that collects samples (ML-4:
 * the worker places a microphone by ARRIVAL, so the writer must not buffer). The helper does no clock
 * correction (ML-3): the worker resamples every microphone onto the host clock itself.
 */
import { MIC_TRANSPORTS } from '../mic-transport';
import { PROGRESS_ARGUMENTS } from './camera-helper-args';
import { isUsableDeviceName } from './device-list';

/** The microphone of this Mac (probe P-1: the only audio device listed). Never an index (ML-1). */
export const LOCAL_MIC_DEVICE_NAME = 'MacBook Air Microphone';

/**
 * The generated inputs of the development microphones that open no device: the standby tone of slot 2
 * (880 Hz, audibly different from a voice) and the primary fixture tone. The closed set IS the
 * table: a tone is chosen by key, never typed.
 */
export const MicGeneratedTone = { TONE_880: 'TONE_880', TONE_440: 'TONE_440' } as const;
export type MicGeneratedTone = (typeof MicGeneratedTone)[keyof typeof MicGeneratedTone];

export type MicSource =
  /** This Mac's microphone, by exact name. The first open of it is where macOS asks for permission. */
  | { readonly kind: 'DEVICE'; readonly name: string }
  /** A generated tone through the SAME output line: no device, no permission. */
  | { readonly kind: 'GENERATED'; readonly tone: MicGeneratedTone };

const QUIET = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning'] as const;
/** The device input. The device name follows `-i` as ONE argument, `none:<name>` (audio only; video `none`). */
const DEVICE_INPUT = ['-f', 'avfoundation', '-i'] as const;
const GENERATED_INPUT_HEAD = ['-re', '-f', 'lavfi', '-i'] as const;
const GENERATED_INPUT_SOURCE = {
  TONE_880: 'sine=frequency=880:sample_rate=48000',
  TONE_440: 'sine=frequency=440:sample_rate=48000',
} as const satisfies Record<MicGeneratedTone, string>;
/** What goes into the pipe: float 32 little-endian, 48 kHz, mono, flushed per packet. Held to the transport statement by a test. */
const OUTPUT = ['-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-y'] as const;
const PRECHECK_OUTPUT = ['-t', '0.2', '-vn', '-f', 'null', '-'] as const;
/** The progress report on standard output: how the Core learns that a first sample was written (the no-delivery bound of `camera-helper.ts`, H-18). Push lists only; the helper still binds no socket. */
const PROGRESS = PROGRESS_ARGUMENTS;

export class MicHelperArgumentError extends Error {
  readonly what: 'PIPE' | 'NAME' | 'TONE';
  constructor(what: 'PIPE' | 'NAME' | 'TONE') {
    super('a value of the microphone helper is not of its shape');
    this.name = 'MicHelperArgumentError';
    this.what = what;
  }
}

/**
 * The shape of a pipe path: `/…/<sessionId>/MIC-NN.pcm`, bounded (the plan allows 1,024). The
 * directories hold letters, digits, space and `. _ + : -` only: no shell mark, no user-info `@`, no
 * dot-dot segment (checked below), nothing a program could read as an option or a URL.
 */
const PIPE_PATH = /^\/(?:[A-Za-z0-9._ +:/-]+\/)?[A-Za-z0-9][A-Za-z0-9._:-]{0,79}\/MIC-[0-9]{2,}\.pcm$/;

/** True when `path` is a pipe path of the shape `micPipePath` builds. A pure check: it touches nothing. */
export function isMicPipeArgument(path: string): boolean {
  if (path.length > 1024 || !PIPE_PATH.test(path)) return false;
  return !path.split('/').includes('..') && !path.includes('//');
}

function deviceArgument(name: string): string {
  if (!isUsableDeviceName(name)) throw new MicHelperArgumentError('NAME');
  return `none:${name}`;
}

function inputArguments(source: MicSource): string[] {
  if (source.kind === 'DEVICE') return [...DEVICE_INPUT, deviceArgument(source.name)];
  const generated = (GENERATED_INPUT_SOURCE as Record<string, string | undefined>)[source.tone];
  if (generated === undefined) throw new MicHelperArgumentError('TONE');
  return [...GENERATED_INPUT_HEAD, generated];
}

export interface MicPushArguments {
  readonly source: MicSource;
  /** The pipe the worker reads (`AudioStreamHandle.input.path`). */
  readonly pipePath: string;
}

/** The argument list of a helper that writes the pipe. */
export function micPushArguments(input: MicPushArguments): readonly string[] {
  if (!isMicPipeArgument(input.pipePath)) throw new MicHelperArgumentError('PIPE');
  return Object.freeze([...QUIET, ...PROGRESS, ...inputArguments(input.source), ...OUTPUT, input.pipePath]);
}

/**
 * The pre-check: one short open of the device, nothing written (HL-12, applied to the microphone).
 * The FIRST open after boot is where macOS asks for permission, and the question is the user's.
 */
export function micPrecheckArguments(deviceName: string): readonly string[] {
  return Object.freeze([...QUIET, ...DEVICE_INPUT, deviceArgument(deviceName), ...PRECHECK_OUTPUT]);
}

/** The literals of the output line, for the test that holds them to the transport statement. */
export const MIC_OUTPUT_ARGUMENTS: readonly string[] = OUTPUT;

/** What the output line promises, read from the transport statement (a test holds the two together). */
export function micOutputPromise(): { readonly rateHz: number; readonly channels: number; readonly sampleFormat: 'F32LE' } {
  const statement = MIC_TRANSPORTS.PCM_FIFO;
  return { rateHz: statement.sampleRateHz, channels: statement.channels, sampleFormat: statement.sampleFormat };
}

/**
 * For the static argument test (G-R12): the literals of the tables, and where the input section of a
 * push list sits. The two computed values are the device argument and the pipe path.
 */
export const MIC_HELPER_TABLE = Object.freeze({
  literals: Object.freeze([...new Set<string>([...QUIET, ...DEVICE_INPUT, ...GENERATED_INPUT_HEAD, ...Object.values(GENERATED_INPUT_SOURCE), ...OUTPUT, ...PRECHECK_OUTPUT, ...PROGRESS])]),
  quietLength: QUIET.length + PROGRESS.length,
  deviceInputLength: DEVICE_INPUT.length + 1,
  generatedInputLength: GENERATED_INPUT_HEAD.length + 1,
  outputLength: OUTPUT.length,
});
