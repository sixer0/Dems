/**
 * A strict reader of the property-list text the USB tree row prints on macOS (task 4 row N6;
 * design `masterplan/06_design_macos_microphone.md` 2.3, row L1; review SM-02, decision C96 (2)).
 *
 * WHY THIS FORM. The text form of the USB tree prints a device's own strings unescaped, so a
 * product string can write a header and a location of its own. In the property-list form an
 * integer is an `<integer>` element and a string is ONE `<string>` element whatever it holds.
 *
 * WHAT IS READ. Only the subset the system program writes, as measured on this Mac (form only):
 * the fixed three-line head, one top value, the fixed foot; the elements `dict`, `array`, `key`,
 * `string`, `integer`, `real`, `date`, `data`, `true`, `false`; no attribute but the one of the
 * fixed head; the five predefined character entities and no other.
 *
 * WHAT IS REFUSED, each as a closed word and never repaired: a text over the bound; another head
 * (so: any other document type, an internal subset, an entity declaration); a comment, a
 * processing instruction, a CDATA section, an attribute, an unknown element; any `&` that is not
 * one of the five entities (so: no numeric reference, no declared entity); a key twice in one
 * dictionary; an integer that is not plain decimal; text between elements; a depth or a count of
 * elements beyond the bounds; anything after the top value; a cut text (no foot).
 *
 * It starts no process, reads no file, keeps no state and logs nothing. No ready-made parser is
 * used: the only property-list parser in the repository's lockfile belongs to the mobile tool
 * chain, is no dependency of this workspace, and reads through a general XML parser that is not
 * bounded. No dependency is added.
 *
 * RESIDUAL, stated: that a string stays one element rests on the system program escaping `<` and
 * `&` in the strings it prints. Measured: no entity and no markup inside a string on this Mac; a
 * device with hostile strings was not connected (hardware list).
 */

/**
 * THE SIZE OF THE USB TREE ROW, in bytes (task 4 row N5b, decision C131 (2)): ONE constant for the
 * cap of the row (`MACOS_LISTING_ROW_LIMITS.USB_TREE.capBytes` of the fence, handed to the production
 * door per call) and the bound of this reader, so the two cannot drift apart. Measured 2026-10-14:
 * 45,342 bytes for 5 devices, 6,722 to 12,435 each; 512 KiB holds the listing's 32 devices
 * (`CAPTURE_AUDIO_CARD_MAX_ENTRIES`) of the LARGEST measured size (397,920 bytes) with room. The
 * text is never cut: a longer one is refused whole, by the runner and by this reader alike.
 */
export const MACOS_USB_TREE_TEXT_BYTES = 512 * 1024;

export const MACOS_PLIST_LIMITS = Object.freeze({
  /**
   * The row's cap above: a longer text is not read at all, never cut. A text the runner admits has
   * fewer BYTES than the cap, so it has fewer characters than this bound. (Before row N5b: the
   * door's 64 KiB, `CARD_LISTING_LIMITS.textCharacters`.)
   */
  textCharacters: MACOS_USB_TREE_TEXT_BYTES,
  /** Nested containers. Measured: 6 for the USB tree at depth 2. */
  depth: 12,
  /**
   * Elements of the whole text. Measured: about 1,400 for five devices (about 32 characters each).
   * Row N5b moved it IN STEP with the text bound (8,192 for 65,536 characters before; the same one
   * element per 8 characters now): the old count would have refused a tree of about 260 KB.
   */
  nodes: 65_536,
  keyCharacters: 256,
});

export const PlistRefusal = {
  NOT_TEXT: 'NOT_TEXT',
  TOO_LONG: 'TOO_LONG',
  /** Not the fixed head: another declaration, another document type, an internal subset. */
  HEAD: 'HEAD',
  /** Not the fixed foot: a cut text, or something after the end. */
  FOOT: 'FOOT',
  /** An element outside the closed set, an attribute, a comment, an instruction, a CDATA section, text between elements. */
  MARKUP: 'MARKUP',
  /** An `&` that is not one of the five predefined entities. */
  ENTITY: 'ENTITY',
  /** A key that is empty, over-long or stated twice in its dictionary. */
  KEY: 'KEY',
  /** The content of a number, a date or a data element is not of its form. */
  VALUE: 'VALUE',
  DEPTH: 'DEPTH',
  NODES: 'NODES',
} as const;
export type PlistRefusal = (typeof PlistRefusal)[keyof typeof PlistRefusal];

/**
 * A value of the text, BY TYPE. A dictionary is a map (a key of the text is never a property name
 * of an object). `integer` holds the number, or null when it is beyond the whole numbers a double
 * holds exactly: such a value is an integer of the text and no number a caller may use. A real, a
 * date, a data element and a truth value are `other`: no reader of this folder reads one.
 */
export type PlistValue =
  | { readonly kind: 'dict'; readonly members: ReadonlyMap<string, PlistValue> }
  | { readonly kind: 'array'; readonly items: readonly PlistValue[] }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'integer'; readonly value: number | null }
  | { readonly kind: 'other' };

export type PlistResult = { readonly ok: true; readonly value: PlistValue } | { readonly ok: false; readonly reason: PlistRefusal };

/** The head as the system program writes it. Compared as a whole: nothing of it is parsed. */
const HEAD = ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', '<plist version="1.0">', ''].join('\n');
const FOOT = '\n</plist>\n';

const ENTITIES: ReadonlyMap<string, string> = new Map([
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&amp;', '&'],
  ['&quot;', '"'],
  ['&apos;', "'"],
]);

const OTHER: PlistValue = Object.freeze({ kind: 'other' });
const LEAF_FORM: Readonly<Record<'integer' | 'real' | 'date' | 'data', RegExp>> = Object.freeze({
  integer: /^-?[0-9]{1,20}$/,
  real: /^[-+0-9.eE]{1,40}$/,
  date: /^[0-9TZ:-]{1,32}$/,
  data: /^[A-Za-z0-9+/=\t\n\r ]*$/,
});

class Refused extends Error {
  readonly reason: PlistRefusal;
  constructor(reason: PlistRefusal) {
    super('the property list is refused');
    this.reason = reason;
  }
}

/** The text of a leaf with its entities replaced. Any other `&` refuses the whole text. */
function decoded(raw: string): string {
  if (!raw.includes('&')) return raw;
  let out = '';
  let at = 0;
  while (at < raw.length) {
    const amp = raw.indexOf('&', at);
    if (amp < 0) {
      out += raw.slice(at);
      break;
    }
    out += raw.slice(at, amp);
    const end = raw.indexOf(';', amp);
    const replaced = end < 0 || end - amp > 5 ? undefined : ENTITIES.get(raw.slice(amp, end + 1));
    if (replaced === undefined) throw new Refused(PlistRefusal.ENTITY);
    out += replaced;
    at = end + 1;
  }
  return out;
}

/**
 * Reads one property list. `text` is the whole output of the program, unchanged. The answer is
 * the top value by type, or one closed word; a partial value is never answered.
 */
export function parseMacosPlist(text: unknown): PlistResult {
  if (typeof text !== 'string') return { ok: false, reason: PlistRefusal.NOT_TEXT };
  if (text.length > MACOS_PLIST_LIMITS.textCharacters) return { ok: false, reason: PlistRefusal.TOO_LONG };
  if (!text.startsWith(HEAD)) return { ok: false, reason: PlistRefusal.HEAD };
  if (!text.endsWith(FOOT) || text.length < HEAD.length + FOOT.length) return { ok: false, reason: PlistRefusal.FOOT };
  const body = text.slice(HEAD.length, text.length - FOOT.length);
  let at = 0;
  let nodes = 0;

  const space = (): void => {
    while (at < body.length && (body[at] === ' ' || body[at] === '\t' || body[at] === '\n' || body[at] === '\r')) at += 1;
  };
  const takes = (token: string): boolean => {
    if (!body.startsWith(token, at)) return false;
    at += token.length;
    return true;
  };
  /** The raw text up to the closing tag of `name`. A `<` inside it is markup the element may not hold. */
  const leaf = (name: string): string => {
    const close = body.indexOf('<', at);
    if (close < 0 || !body.startsWith(`</${name}>`, close)) throw new Refused(PlistRefusal.MARKUP);
    const raw = body.slice(at, close);
    at = close + name.length + 3;
    return raw;
  };
  const value = (depth: number): PlistValue => {
    nodes += 1;
    if (nodes > MACOS_PLIST_LIMITS.nodes) throw new Refused(PlistRefusal.NODES);
    if (takes('<string>')) return Object.freeze({ kind: 'string', value: decoded(leaf('string')) });
    if (takes('<string/>')) return Object.freeze({ kind: 'string', value: '' });
    if (takes('<integer>')) {
      const raw = leaf('integer');
      if (!LEAF_FORM.integer.test(raw)) throw new Refused(PlistRefusal.VALUE);
      const number = Number(raw);
      return Object.freeze({ kind: 'integer', value: Number.isSafeInteger(number) ? number : null });
    }
    if (takes('<true/>') || takes('<false/>') || takes('<data/>')) return OTHER;
    for (const name of ['real', 'date', 'data'] as const) {
      if (!takes(`<${name}>`)) continue;
      if (!LEAF_FORM[name].test(leaf(name))) throw new Refused(PlistRefusal.VALUE);
      return OTHER;
    }
    if (takes('<array/>')) return Object.freeze({ kind: 'array', items: Object.freeze([]) });
    if (takes('<dict/>')) return Object.freeze({ kind: 'dict', members: new Map() });
    const container = takes('<array>') ? 'array' : takes('<dict>') ? 'dict' : null;
    if (container === null) throw new Refused(PlistRefusal.MARKUP);
    if (depth > MACOS_PLIST_LIMITS.depth) throw new Refused(PlistRefusal.DEPTH);
    if (container === 'array') {
      const items: PlistValue[] = [];
      for (;;) {
        space();
        if (takes('</array>')) return Object.freeze({ kind: 'array', items: Object.freeze(items) });
        items.push(value(depth + 1));
      }
    }
    const members = new Map<string, PlistValue>();
    for (;;) {
      space();
      if (takes('</dict>')) return Object.freeze({ kind: 'dict', members });
      if (!takes('<key>')) throw new Refused(PlistRefusal.MARKUP);
      nodes += 1;
      if (nodes > MACOS_PLIST_LIMITS.nodes) throw new Refused(PlistRefusal.NODES);
      const key = decoded(leaf('key'));
      if (key.length === 0 || key.length > MACOS_PLIST_LIMITS.keyCharacters || members.has(key)) throw new Refused(PlistRefusal.KEY);
      space();
      members.set(key, value(depth + 1));
    }
  };

  try {
    space();
    const top = value(1);
    space();
    // Whatever stands after the top value is not of the form: a second value, text, a stray tag.
    if (at !== body.length) throw new Refused(PlistRefusal.MARKUP);
    return { ok: true, value: top };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, reason: error.reason };
    throw error;
  }
}
