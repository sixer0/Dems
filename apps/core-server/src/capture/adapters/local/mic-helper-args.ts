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
import { PROGRESS_ARGUMENTS, deviceListArguments } from './camera-helper-args';
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

// ── The macOS production table (task 4 row N4; design masterplan/06 revision 3, sections 4.2 to 4.4; ──
// ── NAMED AMENDMENT SR-15 of static rule G-R12, final words, decision C110; decisions U23 to U25, C96, C107) ──
//
// The production microphone of kind `USB_AUDIO` on `darwin` is a CHANNEL of one USB audio interface.
// Its helper is the same program, started by the guard through the PRODUCTION door with an EMPTY
// environment, ONE HELPER PER DEVICE, with the lists below. They are a kind of list of their own:
// neither the development lists at the top of this file (which name a device by text and belong to
// the development class) nor the Linux lists. Nothing above this line is changed by this table.
//
// THE TWO LISTS ARE WHOLE TEMPLATES (SR-15 (2), (3)). The static rule compares each list word for
// word; there is no set of admitted words beside the template. `<D>`, `<S>`, `<P>` are the THREE
// COMPUTED PLACES, every other word is a literal of this table:
//
//   push       -hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i <D>
//              then ONE or TWO sections, in the ascending order of their selections, each
//              -map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le
//              -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <P>
//   pre-check  -hide_banner -nostdin -nostats -loglevel info -f avfoundation -i <D>
//              -t 1 -map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -
//
//   <D>  THE DEVICE WORD: one of the CLOSED SET of 32 words `none:0` to `none:31`, made by ONE
//        function from ONE whole number (`macMicDeviceWord`): the audio index of the device list read
//        for THIS launch. The video part is the literal `none` always. A NAME IS NEVER AN ARGUMENT:
//        the table has no parameter that is text (AD-07 (2) holds on macOS in its own words).
//   <S>  THE SELECTION: one of the 64 words of `linuxChannelSelection` - the SAME function as the
//        Linux row, no twin (review SM-09) - k = the registered input number minus 1, refused at or
//        above the LIVE channel count before any argument is built (`AUDIO_INPUT_BEYOND_CARD`).
//   <P>  THE PIPE, held to `isMicPipeArgument`, as in every list of this file.
//
// WHY THESE WORDS (the measured best form of row MM3, test/mm3 section 8; decision C107):
//   `-loglevel info`   a literal of these rows only: at `warning` the helper prints nothing and the
//                      stream line the product reads before a session is "recording" does not exist.
//   `-ar 48000`        a NO-OP GUARD, NOT THE CONTROL. The control is the adapter's refusal of any
//                      device whose own stream line does not state 48,000 Hz (design 4.6; decision
//                      U23 (2): nothing is resampled without a word). At that rate the option changes
//                      no sample.
//   `-f fifo` and its four fixed groups, in this order and with these values, and NO other option of
//                      that output format: the DROPPING queue in front of each output. Without it a
//                      reader of one output that stops for 3 s stops the other for 2.772 s without a
//                      line; with it the other loses 0 samples. `-drop_pkts_on_overflow` is NEVER `0`.
//   no `-progress`     what it reports follows the helper's own timestamps and reads 60.00 s for a
//                      minute with 5.8 s missing. Delivery is known from the worker, not the helper.
//   `-t 1`             in the PRE-CHECK list and in no other: one second of the SELECTED input to
//                      standard output, counted by the Core in memory and stored nowhere.
//
// NOTHING BETWEEN THE DEVICE AND THE PIPE PADS, STRETCHES, RE-TIMES, CUTS OR MIXES (SR-15 (5);
// design 4.2a). About a tenth of the samples never arrive on this path (MM3): what is missing STAYS
// missing in the pipe and the product says how much. This table therefore holds no filter but the one
// selection per output, no re-timing option, no padding, no second log level, no option that selects
// a device by another way and no layout option. No later row adds one without a named amendment.
//
// PROVISIONAL (SR-15 (3) and the one-section form of (2); design 4.3.3): no row has RUN the
// pre-check list to standard output or the push list with one section in these exact words. They
// are confirmed by one run of the pinned helper on a generated source. If that run shows that a word
// must change, that is a NEW AMENDMENT and goes back to the review; it is not a row's decision.
//
// NOT PROVEN WITHOUT A DEVICE: that another index than 0 opens another device (MM: one interface).

/** The highest audio index of the helper's device list a device word can name (32 words, `none:0` to `none:31`). */
export const MACOS_MIC_DEVICE_INDEX_MAX = 31;
/** One output section per registered input of the device that is open at the launch: one or two, never more. */
export const MACOS_MIC_SECTIONS_MAX = 2;

const MACOS_PUSH_HEAD = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-thread_queue_size', '1024', '-f', 'avfoundation', '-i'] as const;
const MACOS_SECTION_HEAD = ['-map', '0:a', '-af'] as const;
const MACOS_SECTION_TAIL = ['-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'fifo', '-fifo_format', 'f32le', '-drop_pkts_on_overflow', '1', '-queue_size', '32', '-format_opts', 'flush_packets=1', '-y'] as const;
const MACOS_PRECHECK_HEAD = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-f', 'avfoundation', '-i'] as const;
const MACOS_PRECHECK_SELECT = ['-t', '1', '-map', '0:a', '-af'] as const;
const MACOS_PRECHECK_TAIL = ['-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-'] as const;
/** THE CLOSED SET of device words: `MACOS_DEVICE_WORDS[n]` is `none:<n>` in canonical decimal, n from 0 to 31. Written from the number, never read from a text. */
const MACOS_DEVICE_WORDS: readonly string[] = Object.freeze(Array.from({ length: MACOS_MIC_DEVICE_INDEX_MAX + 1 }, (_unused, index) => `none:${String(index)}`));

export const MACOS_MIC_ARGUMENT_REFUSED = 'MACOS_MIC_ARGUMENT_REFUSED';
export type MacMicArgumentRefusal = 'DEVICE_INDEX' | 'CHANNEL_COUNT' | 'INPUT_NUMBER' | 'PIPE' | 'SECTION_COUNT' | 'INPUT_REPEATED' | 'PIPE_REPEATED';

/** A value the macOS production table does not take. Fixed text: the value itself is never put into the message. */
export class MacMicArgumentError extends Error {
  readonly code: typeof MACOS_MIC_ARGUMENT_REFUSED = MACOS_MIC_ARGUMENT_REFUSED;
  readonly what: MacMicArgumentRefusal;
  constructor(what: MacMicArgumentRefusal) {
    super('a value of the macOS microphone helper is not of its shape');
    this.name = 'MacMicArgumentError';
    this.what = what;
  }
}

/**
 * THE device word: `none:<n>`, taken from the closed set by ONE whole number 0 to 31 - the audio
 * index of the device list read for this launch. One number and nothing else; text in its place
 * (a name, `'0'`, `'default'`) makes nothing.
 */
export function macMicDeviceWord(audioIndex: number): string {
  const word = isWholeIn(audioIndex, 0, MACOS_MIC_DEVICE_INDEX_MAX) ? MACOS_DEVICE_WORDS[audioIndex] : undefined;
  if (word === undefined) throw new MacMicArgumentError('DEVICE_INDEX');
  return word;
}

/** The device of a launch, as two integers of the listing read for it. */
export interface MacMicDevice {
  /** The index of the device in the AUDIO section of the helper's own device list, 0 to 31. */
  readonly audioIndex: number;
  /** The LIVE input channel count of the device, 1 to 64 (the system list of the same listing). Never an argument: it bounds the selection. */
  readonly channelCount: number;
}

/** One registered input of the device: what one output section is made from. */
export interface MacMicInput {
  /** The input of the interface the microphone is registered on, numbered from 1. */
  readonly inputNumber: number;
  /** The registry id of the microphone (`MIC-NN`), for the named refusal only. Never an argument. */
  readonly deviceId?: string | null;
}

export interface MacMicSection extends MacMicInput {
  /** The pipe the worker reads for this input (`AudioStreamHandle.input.path`). */
  readonly pipePath: string;
}

export interface MacMicPushArguments extends MacMicDevice {
  /** ONE or TWO registered inputs of the one device, in any order: the list states them in the ascending order of their input numbers. A role is no member and no argument. */
  readonly sections: readonly MacMicSection[];
}

/** The two integers of the device, held to their ranges; answers the device word. */
function macDeviceWordOf(device: MacMicDevice): string {
  const word = macMicDeviceWord(device.audioIndex);
  if (!isWholeIn(device.channelCount, 1, LINUX_MIC_CHANNELS_MAX)) throw new MacMicArgumentError('CHANNEL_COUNT');
  return word;
}

/** The selection of one registered input: the Linux row's own function, below the live channel count. An absent input is never replaced by another. */
function macSelectionOf(device: MacMicDevice, input: MacMicInput): string {
  if (!isWholeIn(input.inputNumber, 1, LINUX_MIC_CHANNELS_MAX)) throw new MacMicArgumentError('INPUT_NUMBER');
  if (input.inputNumber > device.channelCount) throw new AudioInputBeyondCardError(input.deviceId ?? null);
  return linuxChannelSelection(input.inputNumber - 1);
}

/**
 * The argument list of THE ONE helper of a device: the head, then one output section per registered
 * input. Refusals, before any argument is built: an index or a channel count that is no whole number
 * of its range; no section or more than two; a pipe not of its shape; an input number that is no
 * whole number 1 to 64 (`MacMicArgumentError`); an input number above the live channel count
 * (`AudioInputBeyondCardError`, code `AUDIO_INPUT_BEYOND_CARD`); the same input or the same pipe in
 * two sections.
 */
export function macMicPushArguments(input: MacMicPushArguments): readonly string[] {
  const device = macDeviceWordOf(input);
  const given: readonly MacMicSection[] = Array.isArray(input.sections) ? input.sections : [];
  if (given.length < 1 || given.length > MACOS_MIC_SECTIONS_MAX) throw new MacMicArgumentError('SECTION_COUNT');
  const sections = given.map((section) => {
    if (typeof section.pipePath !== 'string' || !isMicPipeArgument(section.pipePath)) throw new MacMicArgumentError('PIPE');
    return { inputNumber: section.inputNumber, selection: macSelectionOf(input, section), pipePath: section.pipePath };
  });
  if (new Set(sections.map((section) => section.inputNumber)).size !== sections.length) throw new MacMicArgumentError('INPUT_REPEATED');
  if (new Set(sections.map((section) => section.pipePath)).size !== sections.length) throw new MacMicArgumentError('PIPE_REPEATED');
  const ascending = [...sections].sort((left, right) => left.inputNumber - right.inputNumber);
  return Object.freeze([...MACOS_PUSH_HEAD, device, ...ascending.flatMap((section) => [...MACOS_SECTION_HEAD, section.selection, ...MACOS_SECTION_TAIL, section.pipePath])]);
}

export interface MacMicPrecheckArguments extends MacMicDevice, MacMicInput {}

/**
 * The pre-check of ONE registered input: one second of the selected channel to standard output,
 * nothing kept. The same refusals as the push list for the device and the input; it takes no pipe.
 */
export function macMicPrecheckArguments(input: MacMicPrecheckArguments): readonly string[] {
  const device = macDeviceWordOf(input);
  return Object.freeze([...MACOS_PRECHECK_HEAD, device, ...MACOS_PRECHECK_SELECT, macSelectionOf(input, input), ...MACOS_PRECHECK_TAIL]);
}

/**
 * For the static argument test (SR-15): the literals of the two templates, the two closed sets of
 * computed words and the lengths. The test pins the templates in its OWN words and does not read
 * them from here.
 */
export const MIC_MACOS_HELPER_TABLE = Object.freeze({
  literals: Object.freeze([...new Set<string>([...MACOS_PUSH_HEAD, ...MACOS_SECTION_HEAD, ...MACOS_SECTION_TAIL, ...MACOS_PRECHECK_HEAD, ...MACOS_PRECHECK_SELECT, ...MACOS_PRECHECK_TAIL])]),
  /** The 32 words that may follow `-i`, in order: `deviceWords[n]` names audio index n. */
  deviceWords: Object.freeze([...MACOS_DEVICE_WORDS]) as readonly string[],
  /** The 64 words that may follow `-af`: the Linux table's own, the same array. */
  channelSelections: MIC_LINUX_HELPER_TABLE.channelSelections,
  headLength: MACOS_PUSH_HEAD.length + 1,
  sectionLength: MACOS_SECTION_HEAD.length + 1 + MACOS_SECTION_TAIL.length + 1,
  sectionsMax: MACOS_MIC_SECTIONS_MAX,
  precheckLength: MACOS_PRECHECK_HEAD.length + 1 + MACOS_PRECHECK_SELECT.length + 1 + MACOS_PRECHECK_TAIL.length,
});

// ── The three listing rows of macOS (task 4 row N4; design section 2.2 rows L1 to L3; SR-15 (6)) ──
//
// The list of the USB audio devices of a `darwin` host is the text of THREE programs, each a FIXED
// row WITHOUT A PARAMETER, started through the PRODUCTION door with an empty environment and without
// a start message, on `darwin` only, and killed at its own bound:
//
//   L1  `/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -a`      the USB tree: identity (vendor,
//        product, serial, location). `-a` is the PROPERTY-LIST form and belongs to the row: the TEXT
//        form is FORGEABLE by a device's own product string, which can write a whole new header
//        with a location the device chose (review SM-02; decision C96 (2)). It is not used.
//   L2  `/usr/sbin/system_profiler SPAudioDataType -json`       the audio facts: channel count,
//        rate, transport.
//   L3  the audio helper of the configuration with the EXISTING device-list row of the camera table,
//        unchanged: the index the device word is made from, read from the very program that opens
//        the device. Its program is the configured helper, vouched for by the path rule before the
//        start; this table names no program for it.
//
// The first two programs are absolute literals named by this file alone; no key of the
// configuration, no value of the database and no text of a listing reaches a program or a row.

/** The program that prints the USB tree (a system program of macOS). A literal: no key of the configuration names it. */
export const MACOS_USB_TREE_PROGRAM = '/usr/sbin/ioreg';
const MACOS_USB_TREE = ['-r', '-c', 'IOUSBHostDevice', '-l', '-d', '2', '-a'] as const;
/** The program that prints the audio facts of the system (a system program of macOS). A literal. */
export const MACOS_SYSTEM_AUDIO_PROGRAM = '/usr/sbin/system_profiler';
const MACOS_SYSTEM_AUDIO = ['SPAudioDataType', '-json'] as const;

/** THE argument list of row L1: its seven literals, the property-list form. It takes nothing. */
export function macUsbTreeArguments(): readonly string[] {
  return Object.freeze([...MACOS_USB_TREE]);
}

/** THE argument list of row L2: its two literals. It takes nothing. */
export function macSystemAudioArguments(): readonly string[] {
  return Object.freeze([...MACOS_SYSTEM_AUDIO]);
}

/** THE argument list of row L3: the device-list row of the camera table as it is (it opens no device). It takes nothing. */
export function macMicDeviceListArguments(): readonly string[] {
  return deviceListArguments();
}

/** For the static argument test (SR-15 (6)): the two programs, the literals of the three rows and the bound of each. */
export const MACOS_LISTING_HELPER_TABLE = Object.freeze({
  usbTree: Object.freeze({ program: MACOS_USB_TREE_PROGRAM, literals: Object.freeze<string[]>([...MACOS_USB_TREE]) as readonly string[], boundMs: 5_000 }),
  systemAudio: Object.freeze({ program: MACOS_SYSTEM_AUDIO_PROGRAM, literals: Object.freeze<string[]>([...MACOS_SYSTEM_AUDIO]) as readonly string[], boundMs: 10_000 }),
  /** Row L3 has no program of this table: the configured audio helper. */
  deviceList: Object.freeze({ literals: Object.freeze<string[]>([...deviceListArguments()]) as readonly string[], boundMs: 5_000 }),
});
