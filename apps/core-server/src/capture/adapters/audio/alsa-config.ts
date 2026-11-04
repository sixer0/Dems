/**
 * The generator of the shared-capture configuration of the sound cards (task 4 row 65, WP-08;
 * specification S3-4; hardware logic H-15; requirement AD-07 of the security addendum).
 *
 * WHY IT EXISTS. One ALSA card admits one opener. Two microphones of a room - the primary and the
 * standby of the earlier eras, any two of the four numbered channels since D61 (2026-11-04) -
 * can be two inputs of one interface, each with its own helper and its own pipe, so the card is
 * opened through a SHARED capture: per card a `dsnoop` device that opens the hardware once, with
 * ALL its channels, in its NATIVE format, at ONE rate, and a `plug` device above it that converts
 * to what a helper asks. This is the scheme input-av ran (`nvr/audio.py:442-445, 463-488`); the
 * text below is that generator's text, line for line.
 *
 * WHAT DIFFERS FROM input-av, AND WHY (AD-07 (2)). input-av named the card by the kernel's short
 * name: `dems_<card>_<dev>`, `hw:CARD=<card>,DEV=<dev>` and a key hashed from the two. The short
 * name is derived by the kernel from the text the USB device announces, so here NOTHING of it is
 * used. The input of this file is integers and one member of a closed set:
 *
 *   card index, device index     the kernel's numbers of THIS listing (0 to 31 each)
 *   channel count                the card's native count (1 to 64): all channels are opened
 *   rate                         the ONE rate of the card, in Hz
 *   format                       one of S32_LE, S24_3LE, S24_LE, S16_LE (the card's native one)
 *
 * and the output is made of the literals of this file and the decimal digits of those integers.
 * No name, no product, no USB id and no port of a card can reach the text or the file name: the
 * functions do not take them, and an object that carries them is read for the five members only.
 * Because a card index is the number of ONE listing (it moves when cards are plugged in another
 * order), the text is generated again from the live listing at every open and never stored.
 *
 * DETERMINISTIC. The same cards give the same bytes, whatever the order they are given in: the
 * entries are written by card index, then device index.
 *
 * This file imports no module of the host: it computes text. The ONE file that writes it is
 * `alsa-config-writer.ts` (static rule G-R2 as amended by SR-1, entry 2). It does not log (the
 * capture folder logs in one place): a refusal is an `AlsaConfigError` with a code and no value.
 *
 * NOT PROVEN ON THIS HOST (there is no ALSA on macOS): that the library accepts this text, that
 * `hw:CARD=<index>,DEV=<index>` opens the card, that two helpers share one card, and the period
 * and buffer figures against the worker's placement by arrival. Hardware checks `9A/H-07`, `9A/H-08`.
 */
import { CARD_DEFAULT_RATE_HZ, CARD_FORMAT_PREFERENCE, CARD_LISTING_LIMITS, cardSampleRate, type CaptureCard, type CardSampleFormat } from './card-listing';

/** The variable the sound library reads the path of its configuration from. Handed to a helper explicitly, by the production door, and to nothing else. */
export const ALSA_CONFIG_ENVIRONMENT_KEY = 'ALSA_CONFIG_PATH';
/** Where the file lives below the Core's run directory (`audio.py:395`: `alsa/dems-alsa.conf` below the data directory there). */
export const ALSA_CONFIG_SUBPATH = 'alsa/dems-alsa.conf';
/** The first line: the system's own configuration is read first (`audio.py:466`). */
export const ALSA_SYSTEM_INCLUDE = '</usr/share/alsa/alsa.conf>';
/** The lowest key of a shared capture (`audio.py:472` starts its keys at the same number). */
export const ALSA_IPC_KEY_BASE = 52_000;
/** Who may attach to the shared capture, as input-av wrote it (`audio.py:474`). */
export const ALSA_IPC_PERMISSION = '0660';
/** The period and the buffer of the hardware side, in frames (`audio.py:478`). */
export const ALSA_PERIOD_FRAMES = 1_024;
export const ALSA_BUFFER_FRAMES = 8_192;
/** The rates a card can be given (`routers/audio.py:25-26` of input-av; the range the listing assumes for a card that states none). */
export const ALSA_RATE_RANGE_HZ = Object.freeze({ minHz: 8_000, maxHz: 192_000 });

export const AlsaConfigRefusal = {
  CARD_INDEX: 'CARD_INDEX',
  DEVICE_INDEX: 'DEVICE_INDEX',
  CHANNELS: 'CHANNELS',
  RATE: 'RATE',
  FORMAT: 'FORMAT',
  /** One card and device named twice: a card has one shared capture and one rate. */
  DUPLICATE: 'DUPLICATE',
  ENTRIES: 'ENTRIES',
  RUN_DIRECTORY: 'RUN_DIRECTORY',
} as const;
export type AlsaConfigRefusal = (typeof AlsaConfigRefusal)[keyof typeof AlsaConfigRefusal];

export const ALSA_CONFIG_REFUSED = 'ALSA_CONFIG_REFUSED';

/** A value the generator does not take. Fixed text: the value itself is never put into the message. */
export class AlsaConfigError extends Error {
  readonly code: typeof ALSA_CONFIG_REFUSED = ALSA_CONFIG_REFUSED;
  readonly what: AlsaConfigRefusal;
  constructor(what: AlsaConfigRefusal) {
    super('a value of the shared-capture configuration is not of its shape');
    this.name = 'AlsaConfigError';
    this.what = what;
  }
}

/** The whole input of one card: four integers and one member of the closed set of formats. */
export interface SharedCaptureCard {
  readonly cardIndex: number;
  readonly deviceIndex: number;
  /** The card's NATIVE channel count. Opening with fewer makes the library mix the inputs. */
  readonly channelCount: number;
  /** The one rate of the card, in Hz. */
  readonly rateHz: number;
  readonly format: CardSampleFormat;
}

const wholeIn = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function indexes(cardIndex: unknown, deviceIndex: unknown): readonly [number, number] {
  if (!wholeIn(cardIndex, 0, CARD_LISTING_LIMITS.cardIndexMax)) throw new AlsaConfigError(AlsaConfigRefusal.CARD_INDEX);
  if (!wholeIn(deviceIndex, 0, CARD_LISTING_LIMITS.deviceIndexMax)) throw new AlsaConfigError(AlsaConfigRefusal.DEVICE_INDEX);
  return [cardIndex, deviceIndex];
}

/**
 * The name of the shared capture of one card and device: `dems_<card index>_<device index>`.
 * This is what a helper opens (the Linux argument table of row 66 calls this function): two
 * integers and the literals of this line, nothing else.
 */
export function sharedPcmName(cardIndex: number, deviceIndex: number): string {
  const [card, device] = indexes(cardIndex, deviceIndex);
  return `dems_${String(card)}_${String(device)}`;
}

/** The shape of a name `sharedPcmName` builds, for a caller that must hold an argument to it. */
export const SHARED_PCM_NAME = /^dems_(?:[0-9]|[12][0-9]|3[01])_(?:[0-9]|[12][0-9]|3[01])$/;

/**
 * The key of the shared capture of one card and device. input-av hashed the card's name into
 * 9,000 keys, where two cards can meet; here the key is the base plus the two integers placed
 * side by side, so two different cards or devices of one listing NEVER share a key
 * (52,000 to 53,023).
 */
export function sharedCaptureKey(cardIndex: number, deviceIndex: number): number {
  const [card, device] = indexes(cardIndex, deviceIndex);
  return ALSA_IPC_KEY_BASE + card * (CARD_LISTING_LIMITS.deviceIndexMax + 1) + device;
}

/** The five members of one entry, each held to its shape. Anything else an object carries is not read. */
function entryOf(card: SharedCaptureCard): SharedCaptureCard {
  const [cardIndex, deviceIndex] = indexes(card.cardIndex, card.deviceIndex);
  const { channelCount, rateHz } = card;
  if (!wholeIn(channelCount, 1, CARD_LISTING_LIMITS.channels)) throw new AlsaConfigError(AlsaConfigRefusal.CHANNELS);
  if (!wholeIn(rateHz, ALSA_RATE_RANGE_HZ.minHz, ALSA_RATE_RANGE_HZ.maxHz)) throw new AlsaConfigError(AlsaConfigRefusal.RATE);
  // The format is taken from the closed list of this unit, never from the value handed in.
  const format = CARD_FORMAT_PREFERENCE.find((known) => known === card.format);
  if (format === undefined) throw new AlsaConfigError(AlsaConfigRefusal.FORMAT);
  return { cardIndex, deviceIndex, channelCount, rateHz, format };
}

/** The two devices of one card, as input-av wrote them (`audio.py:473-479`). */
function block(card: SharedCaptureCard): string {
  const name = sharedPcmName(card.cardIndex, card.deviceIndex);
  return (
    `pcm.${name}_shared {\n  type dsnoop\n  ipc_key ${String(sharedCaptureKey(card.cardIndex, card.deviceIndex))}\n  ipc_perm ${ALSA_IPC_PERMISSION}\n` +
    `  slave { pcm "hw:CARD=${String(card.cardIndex)},DEV=${String(card.deviceIndex)}" channels ${String(card.channelCount)} ` +
    `rate ${String(card.rateHz)} ` +
    `format ${card.format} ` +
    `period_size ${String(ALSA_PERIOD_FRAMES)} buffer_size ${String(ALSA_BUFFER_FRAMES)} }\n}\n` +
    `pcm.${name} { type plug slave.pcm "${name}_shared" }`
  );
}

/**
 * The text of the configuration for the cards given: the include line, then two devices per
 * card, by card index and device index, one line end after the last line. No card gives the
 * include line alone. A card and device named twice is refused, as is more than the listing's
 * bound of entries.
 */
export function alsaConfigText(cards: readonly SharedCaptureCard[]): string {
  if (!Array.isArray(cards) || cards.length > CARD_LISTING_LIMITS.entries) throw new AlsaConfigError(AlsaConfigRefusal.ENTRIES);
  const entries = cards.map(entryOf).sort((a, b) => a.cardIndex - b.cardIndex || a.deviceIndex - b.deviceIndex);
  if (entries.some((entry, index) => index > 0 && entries[index - 1]?.cardIndex === entry.cardIndex && entries[index - 1]?.deviceIndex === entry.deviceIndex)) {
    throw new AlsaConfigError(AlsaConfigRefusal.DUPLICATE);
  }
  return `${[ALSA_SYSTEM_INCLUDE, ...entries.map(block)].join('\n')}\n`;
}

/**
 * The entry of a card of the live listing: its two indexes, its native channel count, its native
 * format and the ONE rate it is opened with (`cardSampleRate`: the wanted rate when the card
 * offers it, else 48,000, else its lowest). The text members of the card are not read.
 */
export function sharedCaptureOfCard(
  card: Pick<CaptureCard, 'cardIndex' | 'deviceIndex' | 'channelCount' | 'nativeFormat' | 'ratesHz' | 'rateRangeHz'>,
  wantedRateHz: number = CARD_DEFAULT_RATE_HZ,
): SharedCaptureCard {
  if (!wholeIn(wantedRateHz, ALSA_RATE_RANGE_HZ.minHz, ALSA_RATE_RANGE_HZ.maxHz)) throw new AlsaConfigError(AlsaConfigRefusal.RATE);
  return entryOf({ cardIndex: card.cardIndex, deviceIndex: card.deviceIndex, channelCount: card.channelCount, rateHz: cardSampleRate(card, wantedRateHz), format: card.nativeFormat });
}

/** The shape of a run directory: absolute, the characters of a pipe path's directories, bounded. */
const RUN_DIRECTORY = /^\/[A-Za-z0-9._ +:/-]*$/;

/**
 * `<runDir>/alsa/dems-alsa.conf`. A pure join: it touches nothing. The run directory is the
 * Core's own (`<dataDir>/run/capture`); a relative path, a dot-dot segment, an empty segment or a
 * character outside the set is refused, so the result cannot leave the run directory. The file
 * name is a literal: no value of a card is part of any path.
 */
export function alsaConfigPath(runDir: string): string {
  const base = typeof runDir === 'string' ? runDir.replace(/\/+$/, '') : '';
  if (base.length === 0 || base.length > 900 || !RUN_DIRECTORY.test(base) || base.includes('//') || base.split('/').includes('..') || base.split('/').includes('.')) {
    throw new AlsaConfigError(AlsaConfigRefusal.RUN_DIRECTORY);
  }
  return `${base}/${ALSA_CONFIG_SUBPATH}`;
}

/**
 * The writer the generator is given. `replace` puts `text` at `path` as a whole or not at all,
 * readable and writable by the Core's account only. The product's one writer is
 * `createAlsaConfigWriter` of `alsa-config-writer.ts`; a test hands in its own.
 */
export interface AlsaConfigWriter {
  replace(path: string, text: string): Promise<void>;
}

/** What an open needs after the file is written. */
export interface AlsaConfigResult {
  /** The file that was written. */
  readonly path: string;
  /** What the production door hands to a helper, and nothing else: one key, the path. */
  readonly environment: Readonly<Record<typeof ALSA_CONFIG_ENVIRONMENT_KEY, string>>;
  /** The name a helper opens, per card, in the order of the text. */
  readonly pcms: readonly { readonly cardIndex: number; readonly deviceIndex: number; readonly name: string }[];
  readonly text: string;
}

/**
 * Generates the configuration for the cards of the live listing and has it written below the run
 * directory. The text is complete before the writer is called: a refused value writes nothing.
 * The file is replaced at every call (input-av compared first and wrote on a difference; a
 * replacement by rename is whole either way, and this unit then needs no read of the file).
 */
export async function ensureAlsaConfig(writer: AlsaConfigWriter, runDir: string, cards: readonly SharedCaptureCard[]): Promise<AlsaConfigResult> {
  const path = alsaConfigPath(runDir);
  const text = alsaConfigText(cards);
  const pcms = cards
    .map(entryOf)
    .sort((a, b) => a.cardIndex - b.cardIndex || a.deviceIndex - b.deviceIndex)
    .map((card) => Object.freeze({ cardIndex: card.cardIndex, deviceIndex: card.deviceIndex, name: sharedPcmName(card.cardIndex, card.deviceIndex) }));
  await writer.replace(path, text);
  return Object.freeze({ path, environment: Object.freeze({ [ALSA_CONFIG_ENVIRONMENT_KEY]: path }), pcms: Object.freeze(pcms), text });
}
