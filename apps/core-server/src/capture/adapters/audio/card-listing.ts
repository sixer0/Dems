/**
 * The card listing of a Linux host (task 4 row 64, WP-07a; design addendum 4.2; security addendum
 * AD-07; specs S3-2). It turns the TEXT a host gives about its capture cards into a bounded list
 * of facts, behind an injected source of that text. Ported from the scheme input-av was tested
 * with (`apps/input-av/nvr/audio.py`, `nvr/recorder.py`):
 *
 *   - a USB Audio Class card of any brand: nothing here knows a product;
 *   - the card is opened in its NATIVE format, the first of S32_LE, S24_3LE, S24_LE, S16_LE that
 *     it lists, and with ONE sample rate per card;
 *   - ALL channels of the device are opened, and inputs are then SELECTED by their number, never
 *     mixed (opening fewer channels makes the sound layer mix the inputs down);
 *   - one input of a card belongs to one registered microphone.
 *
 * WHAT IT DOES NOT DO. It starts no process, opens no device, reads no file (the one reader is
 * `card-listing-reader.ts`), keeps no state between two calls and CHOOSES NO CARD: a card is
 * named by the caller with its card id and device index, or nothing is returned. The generic
 * "whichever USB card is plugged" source of input-av is deliberately not ported (specs section 5,
 * last row; addendum 4.2 "nothing chooses a card").
 *
 * DEVICE TEXT IS UNTRUSTED (AD-07 (1)). A product name is text the USB device chose, and the
 * card's long name and bracket name are derived from it. Every string of a listing passes
 * `cardText`, `cardUsbId` or the card id rule before it is returned; a string that fails is
 * replaced by a fixed word, never repaired and never passed on. INTEGERS AND TEXT ARE RETURNED
 * APART (AD-07 (2)): `cardIndex`, `deviceIndex` and the channel numbers are what a later row
 * builds a helper argument from; no text of a `CaptureCard` may reach an argument.
 */
import {
  CAPTURE_AUDIO_CARD_DEVICE_INDEX_MAX,
  CAPTURE_AUDIO_CARD_ID_PATTERN,
  CAPTURE_AUDIO_CARD_MAX_CHANNELS,
  CAPTURE_AUDIO_CARD_MAX_ENTRIES,
  CAPTURE_AUDIO_CARD_TEXT_PATTERN,
  CAPTURE_AUDIO_USB_ID_PATTERN,
} from '@dems/shared/api';
import { AudioInputBeyondCardError } from '../types';

// ── Bounds and fixed words ────────────────────────────────────────────────────────────────────

/** What replaces a product or card name that fails the character rule (AD-07 (1)). */
export const CARD_TEXT_REPLACEMENT = 'UNKNOWN';
/**
 * What replaces a USB id that fails its form. It has the form itself, so the answer and the
 * stored row stay valid, and it is the id of no device (vendor 0000 is not assigned).
 */
export const CARD_USB_ID_REPLACEMENT = '0000:0000';

/** The native formats a card may be opened in, in the order of preference of input-av (`audio.py:396`). */
export const CARD_FORMAT_PREFERENCE = Object.freeze(['S32_LE', 'S24_3LE', 'S24_LE', 'S16_LE'] as const);
export type CardSampleFormat = (typeof CARD_FORMAT_PREFERENCE)[number];
/** The format assumed for a card that lists none of the four (`audio.py:414`). */
export const CARD_DEFAULT_FORMAT: CardSampleFormat = 'S32_LE';
/** The channel count assumed for a card that states none (`audio.py:145`). Marked `ASSUMED` in the result. */
export const CARD_ASSUMED_CHANNELS = 2;
/** The rate a card falls back to when the wanted one is not offered (`audio.py:433`). */
export const CARD_DEFAULT_RATE_HZ = 48_000;
/** The range assumed for a card that states no rate at all (`audio.py:438`). */
export const CARD_ASSUMED_RATE_RANGE = Object.freeze({ minHz: 8_000, maxHz: 192_000 });

export const CARD_LISTING_LIMITS = Object.freeze({
  /** A text longer than this is not read at all: a text cut at a bound could state a wrong number. */
  textCharacters: 65_536,
  /** A longer line is not read. */
  lineCharacters: 512,
  lines: 2_048,
  /** The kernel numbers its cards 0 to 31. */
  cardIndexMax: 31,
  deviceIndexMax: CAPTURE_AUDIO_CARD_DEVICE_INDEX_MAX,
  channels: CAPTURE_AUDIO_CARD_MAX_CHANNELS,
  entries: CAPTURE_AUDIO_CARD_MAX_ENTRIES,
  rates: 32,
  portCharacters: 64,
});

const SAMPLE_BITS_OF_FORMAT: Readonly<Record<CardSampleFormat, 16 | 24 | 32>> = Object.freeze({ S32_LE: 32, S24_3LE: 24, S24_LE: 24, S16_LE: 16 });
export type CardSampleBits = 16 | 24 | 32;

// ── The rule for device text (AD-07 (1)) ──────────────────────────────────────────────────────

/** The two marks a tag is written with. Printable, and still never passed on. */
const MARKUP = /[<>]/;
/** The port a USB card sits on, as the kernel writes it after `usb-`. */
const USB_PORT = /^[A-Za-z0-9:._-]{1,64}$/;

/**
 * The ONE function a product or card name passes before it leaves this file. Printable ASCII
 * (U+0020 to U+007E), 1 to 64 characters after the spaces at both ends are dropped, no `<` and no
 * `>`. Anything else (a control character, a bidirectional or zero-width mark, any character
 * beyond ASCII, an over-long or empty text, a value that is no string) gives the fixed word.
 * The text is never cut to fit and never cleaned: a cut name would be a name the device did not announce.
 */
export function cardText(raw: unknown): string {
  if (typeof raw !== 'string') return CARD_TEXT_REPLACEMENT;
  const text = raw.replace(/^ +/, '').replace(/ +$/, '');
  return CAPTURE_AUDIO_CARD_TEXT_PATTERN.test(text) && !MARKUP.test(text) ? text : CARD_TEXT_REPLACEMENT;
}

/** Four lower-case hexadecimal digits, a colon, four more; anything else gives the fixed id. */
export function cardUsbId(raw: unknown): string {
  return typeof raw === 'string' && CAPTURE_AUDIO_USB_ID_PATTERN.test(raw) ? raw : CARD_USB_ID_REPLACEMENT;
}

/** True for a card id in the kernel's own form (letters, digits, the underscore; 1 to 32). */
export function isKernelCardId(raw: unknown): raw is string {
  return typeof raw === 'string' && CAPTURE_AUDIO_CARD_ID_PATTERN.test(raw);
}

/**
 * The complete lines of a text. A text that is no string or is longer than the bound gives no
 * line. The LAST line counts only when the text ends with a line end: every source of a listing
 * (the program's output, the files of the kernel) ends its lines, so a last line without an end
 * is a cut one, and a cut `Channels: 1` of `Channels: 16` must not be read as a fact.
 */
function completeLines(text: string | null | undefined): string[] {
  if (typeof text !== 'string' || text.length > CARD_LISTING_LIMITS.textCharacters) return [];
  const parts = text.split('\n');
  parts.pop();
  return parts
    .slice(0, CARD_LISTING_LIMITS.lines)
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length <= CARD_LISTING_LIMITS.lineCharacters);
}

const integerIn = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

// ── `arecord -l`: which capture devices exist (`audio.py:29-32`) ──────────────────────────────

/** One capture device as the list names it. `cardName` is RAW device text: it goes through `cardText` before it is returned by `buildCaptureCard`. */
export interface ListedCaptureDevice {
  readonly cardIndex: number;
  readonly deviceIndex: number;
  readonly cardId: string;
  readonly cardName: string;
}

export interface ListedCaptureDevices {
  readonly entries: readonly ListedCaptureDevice[];
  /** Lines that begin like an entry and were refused: a number out of range, a card id not of the kernel's form, a repeated or contradicting entry. */
  readonly skipped: number;
}

/** The start of an entry: the card index and the card id stand BEFORE any text a device chose. */
const LISTED_HEAD = /^card (\d{1,3}): (\S{1,64}) \[/;
/** The device index stands after the card's name. The LAST such mark of the line is taken: a name that carries a mark of its own stands before the real one. */
const LISTED_DEVICE = /\], device (\d{1,3}): /g;

/**
 * Reads the list of capture devices. A line that is no entry is passed over (the heading, the
 * sub-device lines, the program's "no soundcards found"). Text that is no list gives no entry.
 */
export function parseCaptureDeviceList(text: string | null | undefined): ListedCaptureDevices {
  const entries: ListedCaptureDevice[] = [];
  let skipped = 0;
  for (const line of completeLines(text)) {
    if (!line.startsWith('card ')) continue;
    const head = LISTED_HEAD.exec(line);
    const marks = [...line.matchAll(LISTED_DEVICE)];
    const mark = marks[marks.length - 1];
    if (head === null || mark === undefined || mark.index < head[0].length) {
      skipped += 1;
      continue;
    }
    const cardIndex = Number(head[1]);
    const deviceIndex = Number(mark[1]);
    const cardId = head[2];
    const consistent = entries.every((entry) => (entry.cardIndex === cardIndex) === (entry.cardId === cardId) && !(entry.cardIndex === cardIndex && entry.deviceIndex === deviceIndex));
    if (!integerIn(cardIndex, 0, CARD_LISTING_LIMITS.cardIndexMax) || !integerIn(deviceIndex, 0, CARD_LISTING_LIMITS.deviceIndexMax) || !isKernelCardId(cardId) || !consistent) {
      skipped += 1;
      continue;
    }
    entries.push(Object.freeze({ cardIndex, deviceIndex, cardId, cardName: line.slice(head[0].length, mark.index) }));
  }
  return Object.freeze({ entries: Object.freeze(entries), skipped });
}

// ── `/proc/asound/cards`: which cards are present (`audio.py:328-335`) ────────────────────────

export interface PresentCard {
  readonly cardIndex: number;
  readonly cardId: string;
  /** The rest of the card's line (driver and name), through `cardText`. */
  readonly description: string;
}

export interface PresentCards {
  readonly cards: readonly PresentCard[];
  readonly skipped: number;
}

const PRESENT_LINE = /^ {0,3}(\d{1,3}) \[(\S{1,64}) *\]: (.*)$/;

/** Reads the card table of the kernel. Its second lines (the long names) and `--- no soundcards ---` are passed over. */
export function parsePresentCards(text: string | null | undefined): PresentCards {
  const cards: PresentCard[] = [];
  let skipped = 0;
  for (const line of completeLines(text)) {
    const match = PRESENT_LINE.exec(line);
    if (match === null) continue;
    const cardIndex = Number(match[1]);
    const cardId = match[2];
    if (!integerIn(cardIndex, 0, CARD_LISTING_LIMITS.cardIndexMax) || !isKernelCardId(cardId) || cards.some((card) => card.cardIndex === cardIndex || card.cardId === cardId)) {
      skipped += 1;
      continue;
    }
    cards.push(Object.freeze({ cardIndex, cardId, description: cardText(match[3]) }));
  }
  return Object.freeze({ cards: Object.freeze(cards), skipped });
}

// ── The identity of a USB card (`audio.py:82-89`) ─────────────────────────────────────────────

export interface CardUsbIdentity {
  /** True when the kernel shows a USB id file for the card, whatever it holds. */
  readonly usb: boolean;
  /** `vvvv:pppp`, the fixed id when the file's text is not of that form, null for a card that is not USB. */
  readonly usbId: string | null;
  /** The port the card sits on (the kernel's text after `usb-`), or null. For the match of a stored row to a live card (AD-07 (4)). */
  readonly usbPort: string | null;
  /** The product name through `cardText`, or null for a card that is not USB. */
  readonly product: string | null;
}

const NOT_USB: CardUsbIdentity = Object.freeze({ usb: false, usbId: null, usbPort: null, product: null });
const AT_PORT = ' at usb-';

/**
 * `usbIdText` is the card's USB id file (null: the card has none, so it is not USB);
 * `firstStreamText` is the card's first stream file, whose first line is
 * `<product> at usb-<port>, <speed> : <device name>`. The LAST ` at usb-` of that line is taken,
 * so that a product name carrying those words cannot state a port of its own.
 */
export function parseUsbIdentity(usbIdText: string | null | undefined, firstStreamText: string | null | undefined): CardUsbIdentity {
  if (typeof usbIdText !== 'string') return NOT_USB;
  const first = completeLines(firstStreamText)[0] ?? '';
  const at = first.lastIndexOf(AT_PORT);
  const port = at < 0 ? '' : (first.slice(at + AT_PORT.length).split(',')[0] ?? '');
  return Object.freeze({
    usb: true,
    usbId: cardUsbId(completeLines(usbIdText)[0]),
    usbPort: USB_PORT.test(port) ? port : null,
    product: cardText(at < 0 ? first : first.slice(0, at)),
  });
}

// ── What a capture device can do (`audio.py:118-145`, `:401-414`, `:430-439`) ─────────────────

export interface CardStreamFacts {
  /** The largest channel count of the capture side: the NATIVE count, the one the device is opened with. */
  readonly channelCount: number;
  /** The formats of the closed set that the card lists, in the order of preference. */
  readonly formats: readonly CardSampleFormat[];
  readonly sampleBits: readonly CardSampleBits[];
  /** The rates the card lists, ascending. Empty when it lists none. */
  readonly ratesHz: readonly number[];
}

const preferred = (tokens: readonly string[]): CardSampleFormat[] => CARD_FORMAT_PREFERENCE.filter((format) => tokens.includes(format));
const bitsOf = (bits: readonly number[], formats: readonly CardSampleFormat[]): CardSampleBits[] => {
  const stated = bits.filter((value): value is CardSampleBits => value === 16 || value === 24 || value === 32);
  const all = stated.length > 0 ? stated : formats.map((format) => SAMPLE_BITS_OF_FORMAT[format]);
  return [...new Set(all)].sort((a, b) => a - b);
};

/**
 * Reads the capture side of a stream file of the kernel (it stays readable while the device is
 * in use). Only the lines between `Capture:` and a following `Playback:` are read, so the
 * playback side never states a capture fact. No `Capture:` part, or no channel count in it: null.
 */
export function parseStreamCapture(text: string | null | undefined): CardStreamFacts | null {
  const lines = completeLines(text);
  const start = lines.findIndex((line) => line.trim() === 'Capture:');
  if (start < 0) return null;
  const channels: number[] = [];
  const tokens: string[] = [];
  const bits: number[] = [];
  const rates = new Set<number>();
  for (const line of lines.slice(start + 1)) {
    const field = line.trim();
    if (field === 'Playback:') break;
    const channel = /^Channels: (\d{1,3})$/.exec(field);
    if (channel !== null) channels.push(Number(channel[1]));
    const format = /^Format: (\S{1,32})$/.exec(field);
    if (format !== null) tokens.push(format[1] ?? '');
    const bit = /^Bits: (\d{1,2})$/.exec(field);
    if (bit !== null) bits.push(Number(bit[1]));
    if (field.startsWith('Rates: ')) for (const rate of field.match(/\b\d{4,6}\b/g) ?? []) rates.add(Number(rate));
  }
  const present = channels.filter((count) => count >= 1);
  if (present.length === 0) return null;
  const formats = preferred(tokens);
  return Object.freeze({
    channelCount: Math.max(...present),
    formats: Object.freeze(formats),
    sampleBits: Object.freeze(bitsOf(bits, formats)),
    ratesHz: Object.freeze([...rates].sort((a, b) => a - b).slice(0, CARD_LISTING_LIMITS.rates)),
  });
}

export interface CardHwParams {
  readonly channelCount: number;
  readonly formats: readonly CardSampleFormat[];
  /** The range of rates the dump states, or null. */
  readonly rateRangeHz: { readonly minHz: number; readonly maxHz: number } | null;
}

/**
 * Reads the hardware parameter dump of the listing program, the second source for a card with
 * no stream file (a card that is not USB). The dump fails while the device is in use; then the
 * text holds no `CHANNELS` line and the answer is null.
 */
export function parseHwParams(text: string | null | undefined): CardHwParams | null {
  let channelCount: number | null = null;
  let formats: CardSampleFormat[] = [];
  let rateRangeHz: CardHwParams['rateRangeHz'] = null;
  for (const line of completeLines(text)) {
    const channels = /^CHANNELS: \[?(\d{1,3})(?: (\d{1,3}))?\]?/.exec(line);
    if (channels !== null && channelCount === null) channelCount = Number(channels[2] ?? channels[1]);
    const format = /^FORMAT:\s+(.*)$/.exec(line);
    if (format !== null && formats.length === 0) formats = preferred((format[1] ?? '').split(/\s+/));
    const rate = /^RATE:\s+\[?(\d{4,6})(?:\s+(\d{4,6}))?\]?/.exec(line);
    if (rate !== null && rateRangeHz === null) rateRangeHz = Object.freeze({ minHz: Number(rate[1]), maxHz: Number(rate[2] ?? rate[1]) });
  }
  if (channelCount === null || channelCount < 1) return null;
  return Object.freeze({ channelCount, formats: Object.freeze(formats), rateRangeHz });
}

// ── One card of the answer ────────────────────────────────────────────────────────────────────

/** Where the channel count of a card comes from. `ASSUMED` is a guess of 2: a caller that stores a count refuses it. */
export const CardFactsSource = { STREAM: 'STREAM', HW_PARAMS: 'HW_PARAMS', ASSUMED: 'ASSUMED' } as const;
export type CardFactsSource = (typeof CardFactsSource)[keyof typeof CardFactsSource];

/**
 * One capture device of one sound card.
 *
 * THE INTEGERS (`cardIndex`, `deviceIndex`, `channelCount`, the rates) are the only members a
 * helper argument may be built from. THE TEXT (`cardId`, `usbId`, `usbPort`, `product`) has
 * passed the rule above and is for the screen, the store and the match of a stored row; it
 * forms no part of an argument (AD-07 (2); static rule G-R12 as amended by SR-4).
 */
export interface CaptureCard {
  /** The kernel's number of the card at THIS listing. It changes when cards are plugged in another order: never stored. */
  readonly cardIndex: number;
  readonly deviceIndex: number;
  /** The card's short name, in the kernel's own form. With the device index it names the card in a request. */
  readonly cardId: string;
  readonly usb: boolean;
  readonly usbId: string | null;
  readonly usbPort: string | null;
  readonly product: string;
  /** The native channel count: inputs are numbered 1 to this value. */
  readonly channelCount: number;
  readonly factsSource: CardFactsSource;
  readonly formats: readonly CardSampleFormat[];
  /** The format the card is opened in: the first of the preference it lists, else `S32_LE`. */
  readonly nativeFormat: CardSampleFormat;
  readonly sampleBits: readonly CardSampleBits[];
  readonly ratesHz: readonly number[];
  readonly rateRangeHz: { readonly minHz: number; readonly maxHz: number } | null;
}

/**
 * Composes one card from what was read about it. Null when the channel count is beyond the
 * bound: such a card cannot be opened with all its channels by this unit, so it is not offered.
 */
export function buildCaptureCard(listed: ListedCaptureDevice, identity: CardUsbIdentity, stream: CardStreamFacts | null, hwParams: CardHwParams | null): CaptureCard | null {
  const channelCount = stream?.channelCount ?? hwParams?.channelCount ?? CARD_ASSUMED_CHANNELS;
  if (!integerIn(channelCount, 1, CARD_LISTING_LIMITS.channels) || !isKernelCardId(listed.cardId)) return null;
  const formats = stream?.formats ?? hwParams?.formats ?? [];
  const name = cardText(listed.cardName);
  return Object.freeze({
    cardIndex: listed.cardIndex,
    deviceIndex: listed.deviceIndex,
    cardId: listed.cardId,
    usb: identity.usb,
    usbId: identity.usbId,
    usbPort: identity.usbPort,
    product: identity.product === null || identity.product === CARD_TEXT_REPLACEMENT ? name : identity.product,
    channelCount,
    factsSource: stream !== null ? CardFactsSource.STREAM : hwParams !== null ? CardFactsSource.HW_PARAMS : CardFactsSource.ASSUMED,
    formats: Object.freeze([...formats]),
    nativeFormat: formats[0] ?? CARD_DEFAULT_FORMAT,
    sampleBits: stream?.sampleBits ?? Object.freeze(bitsOf([], formats)),
    ratesHz: stream?.ratesHz ?? Object.freeze([]),
    rateRangeHz: stream === null ? (hwParams?.rateRangeHz ?? null) : null,
  });
}

// ── The injected source and the enumerator ────────────────────────────────────────────────────

/**
 * Where the text comes from. EVERY argument is an integer: a path or a program argument is
 * built from the two numbers and from nothing a device announced. An absent file is `null`.
 * A text is handed over UNCHANGED, its line ends included: a last line without a line end is
 * read as a cut line and states nothing (so a source must not strip the text it read).
 * On a Linux host this is `card-listing-reader.ts` with the listing program behind the
 * production door; in a test it is a table of fixed texts.
 */
export interface CardListingSource {
  /** What the listing program prints for its list of capture hardware. */
  captureDevices(): Promise<string>;
  /** The card table of the kernel, or null when the host has none. With it, an entry of the list must name a card of the table. */
  presentCards(): Promise<string | null>;
  /** The USB id file of a card; null for a card that is not USB. */
  usbId(cardIndex: number): Promise<string | null>;
  /** A stream file of a card. */
  stream(cardIndex: number, deviceIndex: number): Promise<string | null>;
  /** The hardware parameter dump of one device, for a card with no stream file. Optional: without it such a card is `ASSUMED`. */
  hwParams?(cardIndex: number, deviceIndex: number): Promise<string | null>;
}

export interface CardListing {
  /** At most 32 entries, in the order of the list. */
  readonly cards: readonly CaptureCard[];
  /** True when the host listed more entries than the bound. */
  readonly truncated: boolean;
  /** Entries that were refused (see `ListedCaptureDevices.skipped`), that name no card of the kernel's table, that are a USB device with no stream file, or whose channel count is beyond the bound. */
  readonly skipped: number;
}

export interface CardEnumerator {
  /** Reads the host once. Nothing is kept: two calls are two readings. A failure of the source is passed on unchanged. */
  list(): Promise<CardListing>;
}

export function createCardEnumerator(source: CardListingSource): CardEnumerator {
  return {
    async list() {
      const listed = parseCaptureDeviceList(await source.captureDevices());
      const table = await source.presentCards();
      const present = table === null ? null : parsePresentCards(table).cards;
      const identities = new Map<number, CardUsbIdentity>();
      const cards: CaptureCard[] = [];
      let skipped = listed.skipped;
      let truncated = false;
      for (const entry of listed.entries) {
        if (present !== null && !present.some((card) => card.cardIndex === entry.cardIndex && card.cardId === entry.cardId)) {
          skipped += 1;
          continue;
        }
        if (cards.length >= CARD_LISTING_LIMITS.entries) {
          truncated = true;
          break;
        }
        let identity = identities.get(entry.cardIndex);
        if (identity === undefined) {
          const usbIdText = await source.usbId(entry.cardIndex);
          identity = parseUsbIdentity(usbIdText, usbIdText === null ? null : await source.stream(entry.cardIndex, 0));
          identities.set(entry.cardIndex, identity);
        }
        const streamText = await source.stream(entry.cardIndex, entry.deviceIndex);
        // A capture device of a USB card always has its stream file: without it the entry is not believed.
        if (identity.usb && streamText === null) {
          skipped += 1;
          continue;
        }
        const stream = parseStreamCapture(streamText);
        const hwParams = stream === null && source.hwParams !== undefined ? parseHwParams(await source.hwParams(entry.cardIndex, entry.deviceIndex)) : null;
        const card = buildCaptureCard(entry, identity, stream, hwParams);
        if (card === null) skipped += 1;
        else cards.push(card);
      }
      return Object.freeze({ cards: Object.freeze(cards), truncated, skipped });
    },
  };
}

/**
 * The card a caller NAMED, or null. Exactly one entry must carry the card id and the device
 * index; none or more than one gives null. There is no other way to obtain a card from a
 * listing: no function of this file returns "a" card.
 */
export function findCaptureCard(listing: CardListing, cardId: string, deviceIndex: number): CaptureCard | null {
  const found = listing.cards.filter((card) => card.cardId === cardId && card.deviceIndex === deviceIndex);
  return found.length === 1 ? (found[0] ?? null) : null;
}

// ── Inputs of a card: selection and the one-room rules (`recorder.py:92-116`, `routers/audio.py:83-118`) ──

const inputNumbers = (inputs: readonly number[]): void => {
  if (inputs.length === 0 || inputs.some((input) => !integerIn(input, 1, Number.MAX_SAFE_INTEGER)) || new Set(inputs).size !== inputs.length) {
    throw new RangeError('an input number is a whole number from 1, named once');
  }
};

export interface CardInputSelection {
  /** The channel count the device is opened with: ALL channels of the card, always. */
  readonly openChannels: number;
  /** Per selected input, in the order given, the channel it is taken from: the input number minus 1, 0 to 63. */
  readonly channelIndexes: readonly number[];
  /** True when every channel of a card of 1 or 2 channels is taken in order: nothing needs selecting. */
  readonly whole: boolean;
}

/**
 * The inputs of a card to record, as integers. Raises `AUDIO_INPUT_BEYOND_CARD` when an input
 * number is greater than the card's native channel count: the device is never opened with more
 * channels than it has, and an absent input is never replaced by another.
 */
export function selectCardInputs(card: Pick<CaptureCard, 'channelCount'>, inputs: readonly number[], deviceId: string | null = null): CardInputSelection {
  inputNumbers(inputs);
  if (inputs.some((input) => input > card.channelCount)) throw new AudioInputBeyondCardError(deviceId);
  const whole = card.channelCount <= 2 && inputs.length === card.channelCount && inputs.every((input, index) => input === index + 1);
  return Object.freeze({ openChannels: card.channelCount, channelIndexes: Object.freeze(inputs.map((input) => input - 1)), whole });
}

/** A registered microphone that holds an input of the same card and device. */
export interface CardInputHolder {
  readonly deviceId: string;
  readonly inputNumber: number;
  readonly sampleRateHz: number;
}

export const CardAllocationRefusal = { INPUT_TAKEN: 'INPUT_TAKEN', RATE_DIFFERS: 'RATE_DIFFERS' } as const;
export type CardAllocationRefusal = (typeof CardAllocationRefusal)[keyof typeof CardAllocationRefusal];

export type CardAllocation =
  | { readonly ok: true; readonly selection: CardInputSelection }
  | { readonly ok: false; readonly reason: CardAllocationRefusal; /** The microphone that holds the input or states the other rate. */ readonly heldBy: string };

/**
 * The one-room rules of a shared card: one input belongs to one microphone, and every microphone
 * of a card uses one sample rate (the shared capture of a card has one). `holders` are the
 * ENABLED microphones of the same card and device; the one named by `request.deviceId` is the
 * requester itself and is passed over. An input beyond the card raises the named error first.
 */
export function allocateCardInput(
  card: Pick<CaptureCard, 'channelCount'>,
  request: { readonly inputNumber: number; readonly sampleRateHz: number; readonly deviceId?: string | null },
  holders: readonly CardInputHolder[],
): CardAllocation {
  const selection = selectCardInputs(card, [request.inputNumber], request.deviceId ?? null);
  const others = holders.filter((holder) => holder.deviceId !== (request.deviceId ?? null));
  const taken = others.find((holder) => holder.inputNumber === request.inputNumber);
  if (taken !== undefined) return { ok: false, reason: CardAllocationRefusal.INPUT_TAKEN, heldBy: taken.deviceId };
  const other = others.find((holder) => holder.sampleRateHz !== request.sampleRateHz);
  if (other !== undefined) return { ok: false, reason: CardAllocationRefusal.RATE_DIFFERS, heldBy: other.deviceId };
  return { ok: true, selection };
}

/**
 * The ONE rate a card is opened with (`audio.py:430-439`): the wanted rate when the card offers
 * it, else 48 000 when it offers that, else its lowest; for a card that states only a range, the
 * same within the range.
 */
export function cardSampleRate(card: Pick<CaptureCard, 'ratesHz' | 'rateRangeHz'>, wantedHz: number): number {
  if (card.ratesHz.length > 0) {
    if (card.ratesHz.includes(wantedHz)) return wantedHz;
    return card.ratesHz.includes(CARD_DEFAULT_RATE_HZ) ? CARD_DEFAULT_RATE_HZ : (card.ratesHz[0] ?? CARD_DEFAULT_RATE_HZ);
  }
  const { minHz, maxHz } = card.rateRangeHz ?? CARD_ASSUMED_RATE_RANGE;
  if (wantedHz >= minHz && wantedHz <= maxHz) return wantedHz;
  return CARD_DEFAULT_RATE_HZ >= minHz && CARD_DEFAULT_RATE_HZ <= maxHz ? CARD_DEFAULT_RATE_HZ : minHz;
}
