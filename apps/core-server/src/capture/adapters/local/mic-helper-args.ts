/**
 * THE argument tables of the microphone helper (blueprint row 135; capture spec §A.7.1 "Mic helper
 * - exact pipeline shape", rules ML-1, ML-4, §A.6.4 HL-3, HL-12; §G.1 G-R12; checks
 * `M4-SEC-HELPER-1`, `M4-LOCAL-MIC-1`).
 *
 * The helper is the FFmpeg command-line program (9.0.2 on this host), started through the door of
 * this folder with one of the argument lists below, like the camera helper (`camera-helper-args.ts`).
 * Every argument is a literal of this file, except THREE values, each held to a strict shape before it
 * becomes an argument:
 *   1. the device name, which passes `isUsableDeviceName` and was found as exactly one entry of the
 *      AUDIO class of the device list (`device-list.ts`) before this table is asked. It becomes ONE
 *      argument, `none:<name>`; it can neither start with a dash nor carry a separator, so it cannot
 *      become an option of the program;
 *   2. the pipe path, `<runDir>/<sessionId>/<MIC-NN>.pcm`, built by `micPipePath` from two ids that
 *      passed their patterns (`mic-transport.ts`) and held again to that shape here;
 *   3. the SPEECH FIXTURE path of the development speech microphone (fix wave H; ruling D198),
 *      `<dataDir>/dev-fixtures/speech-mic/dialogue.wav`: built by `speechFixturePath` from the data
 *      directory of the configuration and two literals, and held to that shape here. It follows `-i`
 *      as ONE argument, after `-f wav`: the file is read as RIFF/WAVE audio or not at all.
 * No value typed by an operator, read from the database or taken from the network reaches an
 * argument. No table holds a screen-capture name or option, a network address, a listen option or a
 * datagram transport: the helper binds no socket at all.
 *
 * THE OUTPUT LINE is the transport the worker reads (`MIC_TRANSPORTS.PCM_FIFO`): 32-bit float,
 * little-endian, 48,000 Hz, mono, flushed per packet and with no filter that collects samples (ML-4:
 * the worker places a microphone by ARRIVAL, so the writer must not buffer). The helper does no clock
 * correction (ML-3): the worker resamples every microphone onto the host clock itself.
 */
import { AlsaConfigError, AlsaConfigRefusal, sharedPcmName } from '../audio/alsa-config';
import { MIC_TRANSPORTS } from '../mic-transport';
import { AudioInputBeyondCardError } from '../types';
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
  | { readonly kind: 'GENERATED'; readonly tone: MicGeneratedTone }
  /**
   * The development SPEECH microphone (fix wave H; ruling D198): a file of synthetic speech, read at
   * the pace of its own timestamps and started again when it ends, through the SAME output line. No
   * device, no permission, no socket.
   */
  | { readonly kind: 'FIXTURE'; readonly path: string };

const QUIET = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning'] as const;
/** The device input. The device name follows `-i` as ONE argument, `none:<name>` (audio only; video `none`). */
const DEVICE_INPUT = ['-f', 'avfoundation', '-i'] as const;
const GENERATED_INPUT_HEAD = ['-re', '-f', 'lavfi', '-i'] as const;
const GENERATED_INPUT_SOURCE = {
  TONE_880: 'sine=frequency=880:sample_rate=48000',
  TONE_440: 'sine=frequency=440:sample_rate=48000',
} as const satisfies Record<MicGeneratedTone, string>;
/**
 * The file input of the speech microphone. `-re`: read at the pace of the file's timestamps (real
 * time), as the tone is. `-stream_loop -1`: start again at the end, for as long as the session
 * records. `-f wav`: the demuxer is stated, never guessed from the file. The path follows `-i`.
 */
const FIXTURE_INPUT_HEAD = ['-re', '-stream_loop', '-1', '-f', 'wav', '-i'] as const;
/** What goes into the pipe: float 32 little-endian, 48 kHz, mono, flushed per packet. Held to the transport statement by a test. */
const OUTPUT = ['-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-y'] as const;
const PRECHECK_OUTPUT = ['-t', '0.2', '-vn', '-f', 'null', '-'] as const;
/** The progress report on standard output: how the Core learns that a first sample was written (the no-delivery bound of `camera-helper.ts`, H-18). Push lists only; the helper still binds no socket. */
const PROGRESS = PROGRESS_ARGUMENTS;

export class MicHelperArgumentError extends Error {
  readonly what: 'PIPE' | 'NAME' | 'TONE' | 'FIXTURE';
  constructor(what: 'PIPE' | 'NAME' | 'TONE' | 'FIXTURE') {
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

/** Where the speech fixture lives below the data directory. `npm run capture:dev-setup` writes it there. */
export const SPEECH_FIXTURE_SUBPATH = 'dev-fixtures/speech-mic/dialogue.wav';

/** `<dataDir>/dev-fixtures/speech-mic/dialogue.wav`. A pure join: it touches nothing. */
export function speechFixturePath(dataDir: string): string {
  return `${dataDir}/${SPEECH_FIXTURE_SUBPATH}`;
}

/** The shape of a fixture path: absolute, the directories of a pipe path, and the fixed tail. */
const FIXTURE_PATH = /^\/(?:[A-Za-z0-9._ +:/-]+\/)?dev-fixtures\/speech-mic\/dialogue\.wav$/;

/** True when `path` is a fixture path of the shape `speechFixturePath` builds. A pure check: it touches nothing. */
export function isSpeechFixtureArgument(path: string): boolean {
  if (path.length > 1024 || !FIXTURE_PATH.test(path)) return false;
  return !path.split('/').includes('..') && !path.includes('//');
}

function deviceArgument(name: string): string {
  if (!isUsableDeviceName(name)) throw new MicHelperArgumentError('NAME');
  return `none:${name}`;
}

function inputArguments(source: MicSource): string[] {
  if (source.kind === 'DEVICE') return [...DEVICE_INPUT, deviceArgument(source.name)];
  if (source.kind === 'FIXTURE') {
    if (!isSpeechFixtureArgument(source.path)) throw new MicHelperArgumentError('FIXTURE');
    return [...FIXTURE_INPUT_HEAD, source.path];
  }
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
 * push list sits. The three computed values are the device argument, the pipe path and the path of
 * the speech fixture.
 */
export const MIC_HELPER_TABLE = Object.freeze({
  literals: Object.freeze([...new Set<string>([...QUIET, ...DEVICE_INPUT, ...GENERATED_INPUT_HEAD, ...Object.values(GENERATED_INPUT_SOURCE), ...FIXTURE_INPUT_HEAD, ...OUTPUT, ...PRECHECK_OUTPUT, ...PROGRESS])]),
  quietLength: QUIET.length + PROGRESS.length,
  deviceInputLength: DEVICE_INPUT.length + 1,
  generatedInputLength: GENERATED_INPUT_HEAD.length + 1,
  fixtureInputLength: FIXTURE_INPUT_HEAD.length + 1,
  outputLength: OUTPUT.length,
});

// ── The Linux table (task 4 row 66, WP-08; specification S3-5; static rule G-R12 as amended by SR-4; AD-07 (2)) ──
//
// The microphone of a production room is one INPUT of a USB sound card on a Linux host. Its helper
// is the same program with the argument lists below, started through the PRODUCTION door with the
// path of the shared-capture configuration of row 65 in its environment. The lists are input-av's
// tested ones (`nvr/recorder.py:104-116, 205-215`): the card is opened through its shared capture
// with ALL its channels (opening with fewer makes the sound library MIX the inputs), and the one
// input of the microphone is then SELECTED by a `pan` filter that names one source channel and
// mixes nothing. After the input section comes the SAME output line as above, unchanged: 32-bit
// float, 48,000 Hz, mono, into the pipe. The card is asked for 24-bit samples, which the float of
// the pipe holds exactly (check E-6 of `mic-transport.ts`).
//
// Every argument is a literal of this table, except THREE values:
//   1. the device, `dems_<card index>_<device index>`: made by ONE function from TWO INTEGERS
//      (`linuxMicDeviceArgument`, which is `sharedPcmName` of row 65). No name, product, USB id or
//      port of a card forms any part of an argument: the table has no parameter that is text;
//   2. the channel selection, `pan=mono|c0=c<k>`: made by ONE function from ONE INTEGER, 0 to 63
//      (`linuxChannelSelection`). It is the only argument of any helper that holds a vertical bar;
//   3. the pipe path, as in the lists above.
// The channel count is NOT computed text: it is one of the 64 words of `LINUX_CHANNEL_LAYOUTS`
// (`1C` to `64C`), taken by its number. The integers are read from the LIVE card listing at the
// open; no value of the database and no text of the listing reaches an argument.
//
// The lists differ from input-av's in ONE place since row 79b: the channel option (see the row).
//
// PROVEN IN A CONTAINER ONLY (no ALSA on macOS; rows 79 and 79b, Ubuntu 24.04, the pinned
// program, ALSA `null` and `file` devices): that the program accepts these options for the device
// layer. NOT PROVEN: that the shared capture of a real card opens with this layout, and that the
// selected input is the one that is heard. Hardware checks `9A/H-07`, `9A/H-08`.

/** The most channels a card can be opened with, and the highest channel a microphone can take (index 0 to 63). */
export const LINUX_MIC_CHANNELS_MAX = 64;
export const LINUX_MIC_CHANNEL_INDEX_MAX = 63;
const LINUX_INDEX_MAX = 31;

// Task 4 row 79b (decision C89). The channel option of this row was `-channels <n>`, the word of
// input-av's older program. The pinned FFmpeg 9.0.2 has no option of that name on any platform
// (`Option channels not found`, 18 of 18 runs in the Ubuntu 24.04 container of row 79; the same
// refusal on macOS with the raw PCM input): its sound-device input has exactly two options of its
// own, `-sample_rate` and `-ch_layout`. The row therefore states the count as a channel LAYOUT,
// `-ch_layout <n>C`: n channels in the card's own order with no speaker position claimed (a
// capital C; a small c would name the DEFAULT layout of that count, which exists for a few counts
// only and is refused for the others). The selection after it names its source channel by INDEX
// (`c<k>`), which is what an unpositioned layout offers.
const LINUX_INPUT_HEAD = ['-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-ch_layout'] as const;
const LINUX_INPUT_TAIL = ['-sample_rate', '48000', '-i'] as const;
const LINUX_SELECT = ['-af'] as const;
/** The channel count as a word of the table: `LINUX_CHANNEL_LAYOUTS[n - 1]` is the layout of n unpositioned channels, `<n>C`, 1 to 64. */
const LINUX_CHANNEL_LAYOUTS: readonly string[] = Object.freeze(Array.from({ length: LINUX_MIC_CHANNELS_MAX }, (_unused, index) => `${String(index + 1)}C`));

export const LINUX_MIC_ARGUMENT_REFUSED = 'LINUX_MIC_ARGUMENT_REFUSED';
export type LinuxMicArgumentRefusal = 'PIPE' | 'CARD_INDEX' | 'DEVICE_INDEX' | 'CHANNEL_COUNT' | 'INPUT_NUMBER' | 'CHANNEL_INDEX';

/** A value the Linux table does not take. Fixed text: the value itself is never put into the message. */
export class LinuxMicArgumentError extends Error {
  readonly code: typeof LINUX_MIC_ARGUMENT_REFUSED = LINUX_MIC_ARGUMENT_REFUSED;
  readonly what: LinuxMicArgumentRefusal;
  constructor(what: LinuxMicArgumentRefusal) {
    super('a value of the Linux microphone helper is not of its shape');
    this.name = 'LinuxMicArgumentError';
    this.what = what;
  }
}

const isWholeIn = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/**
 * THE channel selection text: `pan=mono|c0=c<k>`, the output is one channel and it is source
 * channel k alone. One source channel, no sum and no gain, so it SELECTS and never mixes. k is a
 * whole number 0 to 63 (input number minus 1); anything else is refused.
 */
export function linuxChannelSelection(channelIndex: number): string {
  if (!isWholeIn(channelIndex, 0, LINUX_MIC_CHANNEL_INDEX_MAX)) throw new LinuxMicArgumentError('CHANNEL_INDEX');
  return `pan=mono|c0=c${String(channelIndex)}`;
}

/**
 * THE device argument: the name of the shared capture of row 65, from the card index and the
 * device index of the live listing (0 to 31 each). Two integers and nothing else.
 */
export function linuxMicDeviceArgument(cardIndex: number, deviceIndex: number): string {
  if (!isWholeIn(cardIndex, 0, LINUX_INDEX_MAX)) throw new LinuxMicArgumentError('CARD_INDEX');
  if (!isWholeIn(deviceIndex, 0, LINUX_INDEX_MAX)) throw new LinuxMicArgumentError('DEVICE_INDEX');
  try {
    return sharedPcmName(cardIndex, deviceIndex);
  } catch (error) {
    // The generator's own bounds, should they ever be narrower than this table's.
    if (error instanceof AlsaConfigError) throw new LinuxMicArgumentError(error.what === AlsaConfigRefusal.DEVICE_INDEX ? 'DEVICE_INDEX' : 'CARD_INDEX');
    throw error;
  }
}

/** The card of a microphone, as integers of the live listing. */
export interface LinuxMicCard {
  readonly cardIndex: number;
  readonly deviceIndex: number;
  /** The card's NATIVE channel count, 1 to 64: the count the device is opened with, always. */
  readonly channelCount: number;
}

function linuxInputArguments(card: LinuxMicCard): string[] {
  const device = linuxMicDeviceArgument(card.cardIndex, card.deviceIndex);
  const layout = isWholeIn(card.channelCount, 1, LINUX_MIC_CHANNELS_MAX) ? LINUX_CHANNEL_LAYOUTS[card.channelCount - 1] : undefined;
  if (layout === undefined) throw new LinuxMicArgumentError('CHANNEL_COUNT');
  return [...LINUX_INPUT_HEAD, layout, ...LINUX_INPUT_TAIL, device];
}

export interface LinuxMicPushArguments extends LinuxMicCard {
  /** The input of the card the microphone is registered on, numbered from 1. */
  readonly inputNumber: number;
  /** The pipe the worker reads (`AudioStreamHandle.input.path`). */
  readonly pipePath: string;
  /** The registry id of the microphone (`MIC-NN`), for the named refusal only. Never an argument. */
  readonly deviceId?: string | null;
}

/**
 * The argument list of a helper that writes one input of a sound card into the pipe. Refusals,
 * before any argument is built: a pipe path not of its shape; an index, a channel count or an
 * input number that is no whole number of its range (`LinuxMicArgumentError`); an input number
 * above the card's channel count (`AudioInputBeyondCardError`, code `AUDIO_INPUT_BEYOND_CARD`:
 * an absent input is never replaced by another).
 */
export function linuxMicPushArguments(input: LinuxMicPushArguments): readonly string[] {
  if (!isMicPipeArgument(input.pipePath)) throw new LinuxMicArgumentError('PIPE');
  const source = linuxInputArguments(input);
  if (!isWholeIn(input.inputNumber, 1, LINUX_MIC_CHANNELS_MAX)) throw new LinuxMicArgumentError('INPUT_NUMBER');
  if (input.inputNumber > input.channelCount) throw new AudioInputBeyondCardError(input.deviceId ?? null);
  return Object.freeze([...QUIET, ...PROGRESS, ...source, ...LINUX_SELECT, linuxChannelSelection(input.inputNumber - 1), ...OUTPUT, input.pipePath]);
}

/** The pre-check: one short open of the shared capture with all channels of the card; nothing is selected and nothing written. */
export function linuxMicPrecheckArguments(card: LinuxMicCard): readonly string[] {
  return Object.freeze([...QUIET, ...linuxInputArguments(card), ...PRECHECK_OUTPUT]);
}

/**
 * For the static argument test (G-R12 as amended by SR-4): the literals of the Linux table, the
 * 64 channel selections (the only arguments that may hold a vertical bar) and the shape of the
 * device argument.
 */
export const MIC_LINUX_HELPER_TABLE = Object.freeze({
  literals: Object.freeze([...new Set<string>([...QUIET, ...PROGRESS, ...LINUX_INPUT_HEAD, ...LINUX_INPUT_TAIL, ...LINUX_SELECT, ...LINUX_CHANNEL_LAYOUTS, ...OUTPUT, ...PRECHECK_OUTPUT])]),
  /** The 64 words that may follow `-ch_layout`, in order: `channelLayouts[n - 1]` opens n channels (row 79b). */
  channelLayouts: Object.freeze([...LINUX_CHANNEL_LAYOUTS]) as readonly string[],
  channelSelections: Object.freeze(Array.from({ length: LINUX_MIC_CHANNEL_INDEX_MAX + 1 }, (_unused, index) => linuxChannelSelection(index))),
  deviceArgument: /^dems_(?:[0-9]|[12][0-9]|3[01])_(?:[0-9]|[12][0-9]|3[01])$/,
  quietLength: QUIET.length + PROGRESS.length,
  inputLength: LINUX_INPUT_HEAD.length + 1 + LINUX_INPUT_TAIL.length + 1,
  selectLength: LINUX_SELECT.length + 1,
  outputLength: OUTPUT.length,
});

// ── The card listing row (task 4 row 85c; decision C60 (3); static rule G-R12 as amended by SR-4) ──
//
// The list of the capture hardware of a Linux host is the text of ONE program (`card-listing.ts`
// parses it; input-av asked the same program, `nvr/audio.py:29-32`). Its row of this table is
// FIXED: one program, one argument, both literals. It has NO parameter - no card index, no name,
// no value of the database, of the configuration or of a listing can reach the program or its
// argument list. It is started through the PRODUCTION door with an empty environment (so the
// wording of the list is the untranslated one) and without a start message.
//
// NOT PROVEN ON THIS HOST (no ALSA on macOS): that the program is at this path on the target
// host, what it prints and with which exit code when no card is there. Hardware check `9A/H-07`.

/** The program that lists the capture hardware (the sound utilities of the target host). A literal: no key of the configuration names it. */
export const LINUX_CARD_LISTING_PROGRAM = '/usr/bin/arecord';
const LINUX_CARD_LISTING = ['-l'] as const;

/** THE argument list of the card listing program: the one literal of its row. It takes nothing. */
export function linuxCardListingArguments(): readonly string[] {
  return Object.freeze([...LINUX_CARD_LISTING]);
}

/** For the static argument test (G-R12): the program and the literals of the card listing row. */
export const CARD_LISTING_HELPER_TABLE = Object.freeze({
  program: LINUX_CARD_LISTING_PROGRAM,
  literals: Object.freeze<string[]>([...LINUX_CARD_LISTING]) as readonly string[],
});

// ── The two commissioning rows (task 4 row 111b; decisions C78, C87; static rule G-R12 / SR-4) ──
//
// The host's own observations of the commissioning functions (the set-IP job and the factory
// scan) are the answers of TWO programs of a Linux host, each a row of this table started through
// the PRODUCTION door with an empty environment and without a start message:
//
//   the neighbour row   `/usr/sbin/ip -4 neigh show to <a.b.c.d>`    reads the kernel's neighbour
//                       table for ONE address. It sends nothing and changes nothing.
//   the echo row        `/usr/bin/ping -n -q -c 1 -W 1 <a.b.c.d>`    ONE echo request, one second
//                       of waiting, no name lookup (`-n`).
//
// Every argument is a literal of its row, except ONE value: THE ADDRESS, the last argument of each
// row. It is made by ONE function of this table (`commissioningAddressArgument`) from FOUR
// INTEGERS 0 to 255 - the form the address helper's request line is made in
// (`host-alias/protocol.ts`): the text handed in is read as one strict dotted quad, held to the
// three private ranges and to a host part of 1 to 254, and the argument is REBUILT from the four
// numbers. It is never the caller's text; it can neither start with a dash nor carry a separator,
// a prefix, a port or a name. The caller hands in only an address the destination rule admitted.
//
// NOT AN ARGUMENT: the camera interface. No row names an interface, so no name of the database
// or of a file reaches a program; the reader of the neighbour row COMPARES the interface the
// kernel prints with the stored one. The echo row therefore leaves by the route the kernel
// chooses for an address the rule admitted from a camera-interface source.
//
// NOT IN THIS TABLE: the duplicate-address tool of the host profile (HOST-18). It opens a packet
// socket, which the Core's unit cannot (HOST-38, HOST-39: no new privileges, no capability); the
// address helper runs it, as root, at every `add`.
//
// NOT PROVEN ON THIS HOST (macOS): the two paths, what each program prints and with which exit
// code, and that the echo program may open its socket as the service user. `9A/H-13`, `9A/H-14`.

/** The program that reads the neighbour table (the network utilities of the target host; the address helper names the same path). A literal. */
export const LINUX_NEIGHBOUR_PROGRAM = '/usr/sbin/ip';
const LINUX_NEIGHBOUR = ['-4', 'neigh', 'show', 'to'] as const;
/** The program that sends one echo request. A literal. */
export const LINUX_ECHO_PROGRAM = '/usr/bin/ping';
const LINUX_ECHO = ['-n', '-q', '-c', '1', '-W', '1'] as const;

/** An address the commissioning rows do not take. Fixed text: the value itself is never put into the message. */
export class CommissioningArgumentError extends Error {
  readonly code = 'COMMISSIONING_ARGUMENT_REFUSED' as const;
  constructor() {
    super('an address of a commissioning row is not of its shape');
    this.name = 'CommissioningArgumentError';
  }
}

const COMMISSIONING_QUAD = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;
const COMMISSIONING_QUAD_MAX_LENGTH = 15;

/**
 * THE address argument: four integers 0 to 255 of one strict dotted quad, inside 10.0.0.0/8,
 * 172.16.0.0/12 or 192.168.0.0/16, host part 1 to 254, written again from the four numbers.
 * Anything else is refused and nothing is made.
 */
export function commissioningAddressArgument(address: string): string {
  const match = typeof address === 'string' && address.length <= COMMISSIONING_QUAD_MAX_LENGTH ? COMMISSIONING_QUAD.exec(address) : null;
  if (match === null) throw new CommissioningArgumentError();
  const [a, b, c, d] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  if (a === undefined || b === undefined || c === undefined || d === undefined || a > 255 || b > 255 || c > 255 || d > 255) throw new CommissioningArgumentError();
  const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  if (!isPrivate || d < 1 || d > 254) throw new CommissioningArgumentError();
  return `${String(a)}.${String(b)}.${String(c)}.${String(d)}`;
}

/** THE argument list of the neighbour row: its four literals, then the one address. */
export function linuxNeighbourArguments(address: string): readonly string[] {
  return Object.freeze([...LINUX_NEIGHBOUR, commissioningAddressArgument(address)]);
}

/** THE argument list of the echo row: its six literals, then the one address. */
export function linuxEchoArguments(address: string): readonly string[] {
  return Object.freeze([...LINUX_ECHO, commissioningAddressArgument(address)]);
}

/** For the static argument test (G-R12): the programs, the literals of the two rows and the shape of the one computed argument. */
export const COMMISSIONING_HELPER_TABLE = Object.freeze({
  neighbour: Object.freeze({ program: LINUX_NEIGHBOUR_PROGRAM, literals: Object.freeze<string[]>([...LINUX_NEIGHBOUR]) as readonly string[] }),
  echo: Object.freeze({ program: LINUX_ECHO_PROGRAM, literals: Object.freeze<string[]>([...LINUX_ECHO]) as readonly string[] }),
  addressArgument: /^(?:10\.(?:0|[1-9]\d{0,2})|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.(?:0|[1-9]\d{0,2})\.(?:[1-9]\d{0,2})$/,
});
