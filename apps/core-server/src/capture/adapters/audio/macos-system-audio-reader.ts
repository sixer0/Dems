/**
 * The reader of the system's audio list on macOS (task 4 row N6; design 2.3 row L2; review
 * SM-11, SM-13): from the JSON text of the system row to the audio items with the FOUR members
 * the design names. Pure: the text is HANDED IN by the unit that owns the production door.
 *
 * WHY A READER OF ITS OWN and not the language's JSON reader. Three things the built-in reader
 * cannot say: whether a number was written as an INTEGER (it answers 6 for `6` and for `6.0`; a
 * channel count written as a float is refused here, never rounded - SM-11), whether a key stood
 * TWICE in an object (it silently keeps the last), and how deep the text nests before it is
 * built. So: the size is checked first, then one pass with a depth bound, a count bound, keys
 * held in a map (a key of the text is never a property name of an object) and a key twice refused.
 *
 * THE FORM, as measured on this Mac (form only): ONE top member `SPAudioDataType`, a list of ONE
 * object, whose `_items` is the list of devices. The text ends WITHOUT a line end, so the rule
 * "a last line without a line end is a cut line" of the Linux texts does not apply: a cut text is
 * no JSON and is refused by the reader as such.
 *
 * OF AN ITEM only these are read, each BY TYPE:
 *
 *   _name                        a string: text the device (or a local driver) chose; RAW, for the
 *                                tie's comparison alone
 *   coreaudio_device_input       absent: the item is no input. An integer 1 to 64: its channels.
 *                                Anything else (0, a float, a string): the item is UNREADABLE
 *   coreaudio_device_srate       for an input: an integer 8,000 to 192,000, else UNREADABLE
 *   coreaudio_device_transport   compared to the ONE word of a USB device; a missing, unknown or
 *                                non-string word is "not USB"
 *
 * The manufacturer and the source members are never read (SM-12 (1)).
 *
 * EMPTY IS NOT "NONE" (SM-13): a confined process is answered an empty list. This reader answers
 * it as what it is - a list of no item - and the tie makes every USB audio device of the tree
 * undecided (`NO_SYSTEM_INPUT`); it is never "no card".
 */
import { CAPTURE_AUDIO_CARD_MAX_CHANNELS, CAPTURE_AUDIO_CARD_MAX_ENTRIES } from '@dems/shared/api';
import { CARD_LISTING_LIMITS } from './card-listing';

export const MACOS_SYSTEM_AUDIO_LIMITS = Object.freeze({
  textCharacters: CARD_LISTING_LIMITS.textCharacters,
  /** Nested containers. Measured: 5. */
  depth: 8,
  /** Values of the whole text. Measured: about 40 for three devices. */
  nodes: 4_096,
  items: CAPTURE_AUDIO_CARD_MAX_ENTRIES,
  channels: CAPTURE_AUDIO_CARD_MAX_CHANNELS,
  rateMinHz: 8_000,
  rateMaxHz: 192_000,
});

/** The one transport word of a USB audio device. Every other word, and no word, is "not USB". */
export const MACOS_USB_TRANSPORT_WORD = 'coreaudio_device_type_usb';
const TOP_MEMBER = 'SPAudioDataType';

export const MacosSystemAudioRefusal = {
  NOT_TEXT: 'NOT_TEXT',
  TOO_LONG: 'TOO_LONG',
  /** No JSON of the strict form: cut, a key twice, a raw control character, something after the value. */
  NOT_JSON: 'NOT_JSON',
  DEPTH: 'DEPTH',
  NODES: 'NODES',
  /** JSON of another shape than the system list's. */
  NOT_THE_LIST: 'NOT_THE_LIST',
  TOO_MANY_ITEMS: 'TOO_MANY_ITEMS',
  /** An item that is no object, or whose name is no string: its place in the list cannot be compared. */
  ITEM_FORM: 'ITEM_FORM',
} as const;
export type MacosSystemAudioRefusal = (typeof MacosSystemAudioRefusal)[keyof typeof MacosSystemAudioRefusal];

export interface MacosSystemAudioItem {
  /** RAW text of the list. For the tie's comparison only: never shown, stored or logged. */
  readonly name: string;
  /** True when the item states input channels at all, readable or not. */
  readonly input: boolean;
  /** False when a count or a rate of an input is not of its type and range: the item is then no input the tie may use. */
  readonly readable: boolean;
  readonly inputChannels: number | null;
  readonly rateHz: number | null;
  readonly usb: boolean;
}

export type MacosSystemAudio = { readonly ok: true; readonly items: readonly MacosSystemAudioItem[] } | { readonly ok: false; readonly reason: MacosSystemAudioRefusal };

// ── A strict, bounded JSON reader ─────────────────────────────────────────────────────────────

export type StrictJsonValue =
  | { readonly kind: 'object'; readonly members: ReadonlyMap<string, StrictJsonValue> }
  | { readonly kind: 'array'; readonly items: readonly StrictJsonValue[] }
  | { readonly kind: 'string'; readonly value: string }
  /** A number written without a fraction and without an exponent, inside the exact whole numbers. */
  | { readonly kind: 'integer'; readonly value: number }
  /** Any other number: a fraction, an exponent, a whole number too large. Never rounded into an integer. */
  | { readonly kind: 'number' }
  | { readonly kind: 'other' };

export type StrictJsonRefusal = 'NOT_TEXT' | 'TOO_LONG' | 'NOT_JSON' | 'DEPTH' | 'NODES';
export type StrictJsonResult = { readonly ok: true; readonly value: StrictJsonValue } | { readonly ok: false; readonly reason: StrictJsonRefusal };

class Refused extends Error {
  readonly reason: StrictJsonRefusal;
  constructor(reason: StrictJsonRefusal) {
    super('the text is refused');
    this.reason = reason;
  }
}

const NUMBER = /-?(?:0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?/y;
const ESCAPES: ReadonlyMap<string, string> = new Map([
  ['"', '"'],
  ['\\', '\\'],
  ['/', '/'],
  ['b', '\b'],
  ['f', '\f'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
]);
const JSON_OTHER: StrictJsonValue = Object.freeze({ kind: 'other' });

/** Reads one JSON text under the bounds given. Exported for its own tests; the system list is its one user. */
export function parseStrictJson(text: unknown, limits: { readonly textCharacters: number; readonly depth: number; readonly nodes: number } = MACOS_SYSTEM_AUDIO_LIMITS): StrictJsonResult {
  if (typeof text !== 'string') return { ok: false, reason: 'NOT_TEXT' };
  if (text.length > limits.textCharacters) return { ok: false, reason: 'TOO_LONG' };
  let at = 0;
  let nodes = 0;
  const bad = (): never => {
    throw new Refused('NOT_JSON');
  };
  const space = (): void => {
    while (at < text.length && (text[at] === ' ' || text[at] === '\t' || text[at] === '\n' || text[at] === '\r')) at += 1;
  };
  const string = (): string => {
    at += 1;
    let out = '';
    for (;;) {
      const char = text[at];
      if (char === undefined || char < ' ') return bad();
      at += 1;
      if (char === '"') return out;
      if (char !== '\\') {
        out += char;
        continue;
      }
      const mark = text[at] ?? '';
      at += 1;
      if (mark === 'u') {
        const digits = text.slice(at, at + 4);
        if (!/^[0-9A-Fa-f]{4}$/.test(digits)) return bad();
        out += String.fromCharCode(Number.parseInt(digits, 16));
        at += 4;
        continue;
      }
      const plain = ESCAPES.get(mark);
      if (plain === undefined) return bad();
      out += plain;
    }
  };
  const value = (depth: number): StrictJsonValue => {
    nodes += 1;
    if (nodes > limits.nodes) throw new Refused('NODES');
    const char = text[at];
    if (char === '"') return Object.freeze({ kind: 'string', value: string() });
    if (char === '{' || char === '[') {
      if (depth > limits.depth) throw new Refused('DEPTH');
      at += 1;
      space();
      if (char === '[') {
        const items: StrictJsonValue[] = [];
        if (text[at] === ']') at += 1;
        else
          for (;;) {
            items.push(value(depth + 1));
            space();
            const next = text[at];
            at += 1;
            if (next === ']') break;
            if (next !== ',') return bad();
            space();
          }
        return Object.freeze({ kind: 'array', items: Object.freeze(items) });
      }
      const members = new Map<string, StrictJsonValue>();
      if (text[at] === '}') at += 1;
      else
        for (;;) {
          if (text[at] !== '"') return bad();
          const key = string();
          if (members.has(key)) return bad();
          space();
          if (text[at] !== ':') return bad();
          at += 1;
          space();
          members.set(key, value(depth + 1));
          space();
          const next = text[at];
          at += 1;
          if (next === '}') break;
          if (next !== ',') return bad();
          space();
        }
      return Object.freeze({ kind: 'object', members });
    }
    for (const word of ['true', 'false', 'null']) {
      if (text.startsWith(word, at)) {
        at += word.length;
        return JSON_OTHER;
      }
    }
    NUMBER.lastIndex = at;
    const number = NUMBER.exec(text);
    if (number === null) return bad();
    at += number[0].length;
    const whole = number[1] === undefined && number[2] === undefined ? Number(number[0]) : null;
    return whole !== null && Number.isSafeInteger(whole) ? Object.freeze({ kind: 'integer', value: whole }) : Object.freeze({ kind: 'number' });
  };
  try {
    space();
    const top = value(1);
    space();
    if (at !== text.length) bad();
    return { ok: true, value: top };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, reason: error.reason };
    throw error;
  }
}

// ── The system list ───────────────────────────────────────────────────────────────────────────

const integerIn = (value: StrictJsonValue | undefined, min: number, max: number): number | null => (value !== undefined && value.kind === 'integer' && value.value >= min && value.value <= max ? value.value : null);

function readItem(members: ReadonlyMap<string, StrictJsonValue>): MacosSystemAudioItem | null {
  const name = members.get('_name');
  if (name === undefined || name.kind !== 'string') return null;
  const transport = members.get('coreaudio_device_transport');
  const usb = transport !== undefined && transport.kind === 'string' && transport.value === MACOS_USB_TRANSPORT_WORD;
  const stated = members.get('coreaudio_device_input');
  if (stated === undefined) return Object.freeze({ name: name.value, input: false, readable: true, inputChannels: null, rateHz: null, usb });
  const inputChannels = integerIn(stated, 1, MACOS_SYSTEM_AUDIO_LIMITS.channels);
  const rateHz = integerIn(members.get('coreaudio_device_srate'), MACOS_SYSTEM_AUDIO_LIMITS.rateMinHz, MACOS_SYSTEM_AUDIO_LIMITS.rateMaxHz);
  const readable = inputChannels !== null && rateHz !== null;
  return Object.freeze({ name: name.value, input: true, readable, inputChannels: readable ? inputChannels : null, rateHz: readable ? rateHz : null, usb });
}

/** Reads the output of the system row. See the head of the file for every rule. */
export function parseMacosSystemAudio(text: unknown): MacosSystemAudio {
  const refuse = (reason: MacosSystemAudioRefusal): MacosSystemAudio => Object.freeze({ ok: false, reason });
  const parsed = parseStrictJson(text);
  if (!parsed.ok) return refuse(parsed.reason);
  const top = parsed.value;
  if (top.kind !== 'object' || top.members.size !== 1) return refuse(MacosSystemAudioRefusal.NOT_THE_LIST);
  const list = top.members.get(TOP_MEMBER);
  if (list === undefined || list.kind !== 'array' || list.items.length > 1) return refuse(MacosSystemAudioRefusal.NOT_THE_LIST);
  const [holder] = list.items;
  // No object at all, or one without `_items`: a list of no item (the confined answer), not another shape.
  if (holder === undefined) return Object.freeze({ ok: true, items: Object.freeze([]) });
  if (holder.kind !== 'object') return refuse(MacosSystemAudioRefusal.NOT_THE_LIST);
  const stated = holder.members.get('_items');
  if (stated === undefined) return Object.freeze({ ok: true, items: Object.freeze([]) });
  if (stated.kind !== 'array') return refuse(MacosSystemAudioRefusal.NOT_THE_LIST);
  if (stated.items.length > MACOS_SYSTEM_AUDIO_LIMITS.items) return refuse(MacosSystemAudioRefusal.TOO_MANY_ITEMS);
  const items: MacosSystemAudioItem[] = [];
  for (const entry of stated.items) {
    const item = entry.kind === 'object' ? readItem(entry.members) : null;
    if (item === null) return refuse(MacosSystemAudioRefusal.ITEM_FORM);
    items.push(item);
  }
  return Object.freeze({ ok: true, items: Object.freeze(items) });
}
