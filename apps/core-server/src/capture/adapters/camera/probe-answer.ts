/**
 * Reading ONE WS-Discovery answer (blueprint row 131; capture spec §A.6.1 DS-8, DS-9, DS-16;
 * security review SEC35-29, SEC35-32 (2), SEC35-48).
 *
 * An answer is an unauthenticated claim from the network (WS-Discovery 1.1 §8.1). Everything here
 * is a pure function of the bytes: no socket, no timer, no log. This is the ONLY file of the Core
 * that imports the XML parser, and its options are pinned below (DS-16):
 *
 *   - the size cap is applied to the BYTE length, and a document type or entity declaration is
 *     refused on the bytes, before any text is made;
 *   - the nesting depth is counted by a loop before the parser sees the text;
 *   - the parser runs synchronously; its callback stores two values and decides nothing, so no
 *     code of ours can throw inside it;
 *   - the parsed answer is read by FIXED PATHS only: no walk of the tree, no serialisation, no
 *     clone, and it never leaves this file;
 *   - every device text is cleaned and cut before it is returned (SEC35-48).
 *
 * `readProbeAnswer` returns a result for every input. It is still called inside the one
 * `try` / `catch` of the datagram handler (`ws-discovery.ts`).
 */
import xml2js from 'xml2js';

/** DS-8: the largest datagram that is read (16 KiB). */
export const PROBE_ANSWER_MAX_BYTES = 16 * 1024;
/** Deeper than any ProbeMatches message (Envelope / Body / ProbeMatches / ProbeMatch / EndpointReference / Address is 6). */
export const PROBE_ANSWER_MAX_DEPTH = 24;
/** The cap of `endpointRef` (contract C3 §2.6; erratum PE-128-50). */
export const ENDPOINT_REF_MAX_CHARS = 120;
/** SEC35-48: every device text is cut to this many characters. */
export const DEVICE_TEXT_MAX_CHARS = 120;
/** DS-16: a hint list holds at most this many entries. */
export const HINT_LIST_MAX_ENTRIES = 8;
/** `ProbeMatch` children read from one message (a discovery proxy may send several, WS-Discovery 1.1 §5.3). */
export const PROBE_MATCHES_PER_MESSAGE = 8;
/** SEC35-32 (2): the longest path of a service address. */
export const SERVICE_PATH_MAX_CHARS = 128;

const PROBE_MATCHES_ACTION = 'http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches';
const SCOPE_TOKENS_READ = 64;
const XADDR_TOKENS_READ = 8;
const XADDR_MAX_CHARS = 320;

/** Why an answer was not used. Counted, never logged with content (DS-12). */
export const ProbeAnswerDrop = {
  OVERSIZED: 'OVERSIZED',
  DECLARATION: 'DECLARATION',
  TOO_DEEP: 'TOO_DEEP',
  NOT_XML: 'NOT_XML',
  NOT_PROBE_MATCHES: 'NOT_PROBE_MATCHES',
  NO_RELATES_TO: 'NO_RELATES_TO',
  NO_PROBE_MATCH: 'NO_PROBE_MATCH',
} as const;
export type ProbeAnswerDrop = (typeof ProbeAnswerDrop)[keyof typeof ProbeAnswerDrop];

/** One `ProbeMatch`, cleaned. Every member is what the device announced; nothing was asked of it (D80(1)). */
export interface ProbeMatchData {
  readonly endpointRef: string;
  readonly types: readonly string[];
  /** The announced service addresses, as written. Judged against the datagram source by `serviceAddressFor`. */
  readonly xaddrs: readonly string[];
  readonly name: string | null;
  readonly model: string | null;
  /** Null unless a non-standard scope states it: ONVIF has no manufacturer category (spec §A.6.1 V-9). */
  readonly vendor: string | null;
  readonly profileHints: readonly string[];
  readonly locationHints: readonly string[];
  readonly macHint: string | null;
  readonly serialHint: string | null;
}

export interface ProbeAnswer {
  readonly relatesTo: string;
  readonly matches: readonly ProbeMatchData[];
  /** `ProbeMatch` children without a usable endpoint reference, or beyond the per-message cap. */
  readonly matchesSkipped: number;
}

export type ProbeAnswerReading = { readonly ok: true; readonly answer: ProbeAnswer } | { readonly ok: false; readonly drop: ProbeAnswerDrop };

/** DS-16, pinned: strict, repeated elements always arrays, synchronous, no value or attribute processor. */
const PARSER_OPTIONS = Object.freeze({
  strict: true,
  explicitArray: true,
  explicitRoot: true,
  async: false,
  ignoreAttrs: true,
  normalize: false,
  trim: true,
  // Devices choose their own prefixes (`d:`, `wsdd:`, `SOAP-ENV:`): the fixed paths below use local names.
  tagNameProcessors: Object.freeze([xml2js.processors.stripPrefix]),
});

/**
 * A character that never reaches a candidate: C0 and C1 controls, the Arabic letter mark,
 * zero-width and direction marks, line and paragraph separators, embeddings, overrides and
 * isolates, the byte-order mark, interlinear annotations, and half of a surrogate pair.
 */
const unsafeCodePoint = (code: number): boolean =>
  code <= 0x1f ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0x61c ||
  (code >= 0x200b && code <= 0x200f) ||
  (code >= 0x2028 && code <= 0x202e) ||
  (code >= 0x2060 && code <= 0x2069) ||
  (code >= 0xd800 && code <= 0xdfff) ||
  code === 0xfeff ||
  (code >= 0xfff9 && code <= 0xfffb);

/**
 * Untrusted device text as one plain line (SEC35-48): line breaks become a space, control,
 * direction-override and zero-width characters are removed, the rest is cut to `max` characters.
 * Markup is NOT removed: it stays text, and a client draws it as text.
 */
export function cleanDeviceText(raw: string, max: number = DEVICE_TEXT_MAX_CHARS): string {
  let flat = '';
  // By code point: a valid pair is one character, a lone half is unsafe and dropped.
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) flat += ' ';
    else if (!unsafeCodePoint(code)) flat += character;
  }
  flat = flat.replace(/ {2,}/g, ' ').trim();
  if (flat.length <= max) return flat;
  // By code point again, so that a cut never leaves half of a surrogate pair.
  return Array.from(flat).slice(0, max).join('').trim();
}

/** True when the bytes hold a `<!` that opens neither a comment nor a CDATA section: a document type, an entity, a notation. */
function hasDeclaration(bytes: Buffer): boolean {
  for (let at = bytes.indexOf('<!'); at !== -1; at = bytes.indexOf('<!', at + 2)) {
    const comment = bytes[at + 2] === 0x2d && bytes[at + 3] === 0x2d;
    const cdata = bytes.subarray(at + 2, at + 9).toString('latin1') === '[CDATA[';
    if (!comment && !cdata) return true;
  }
  return false;
}

/** Counts element nesting with one pass and no recursion; true as soon as it passes `limit`. */
function deeperThan(text: string, limit: number): boolean {
  const length = text.length;
  let depth = 0;
  let at = 0;
  while (at < length) {
    const open = text.indexOf('<', at);
    if (open === -1) return false;
    const next = text.charCodeAt(open + 1);
    if (next === 0x2f) {
      depth -= 1;
      const close = text.indexOf('>', open);
      if (close === -1) return false;
      at = close + 1;
    } else if (next === 0x3f) {
      const close = text.indexOf('?>', open);
      if (close === -1) return false;
      at = close + 2;
    } else if (next === 0x21) {
      const terminator = text.startsWith('<!--', open) ? '-->' : text.startsWith('<![CDATA[', open) ? ']]>' : '>';
      const close = text.indexOf(terminator, open);
      if (close === -1) return false;
      at = close + terminator.length;
    } else {
      let end = open + 1;
      let quote = 0;
      for (; end < length; end += 1) {
        const code = text.charCodeAt(end);
        if (quote !== 0) {
          if (code === quote) quote = 0;
        } else if (code === 0x22 || code === 0x27) quote = code;
        else if (code === 0x3e) break;
      }
      if (end >= length) return false;
      if (text.charCodeAt(end - 1) !== 0x2f) {
        depth += 1;
        if (depth > limit) return true;
      }
      at = end + 1;
    }
  }
  return false;
}

// ── Fixed-path reads ──────────────────────────────────────────────────────────────────────────

const own = (node: unknown, name: string): unknown => (node !== null && typeof node === 'object' && !Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, name) ? (node as Record<string, unknown>)[name] : undefined);

/** The children of that name, as the parser lists them (always an array, `explicitArray`). */
function children(node: unknown, name: string): readonly unknown[] {
  const list = own(node, name);
  return Array.isArray(list) ? list : [];
}

const child = (node: unknown, name: string): unknown => children(node, name)[0];

/** The text of an element: the element itself when it has no child, else its character member. */
function textOf(node: unknown): string | null {
  if (typeof node === 'string') return node;
  const characters = own(node, '_');
  return typeof characters === 'string' ? characters : null;
}

const tokens = (text: string | null, limit: number): string[] => (text === null ? [] : text.split(/\s+/, limit + 1).filter((token) => token !== '').slice(0, limit));

const SCOPE = /^onvif:\/\/www\.onvif\.org\/([a-z]+)\/(.+)$/i;

function scopeValue(raw: string): string {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Not a valid escape sequence: the text is kept as it was announced.
  }
  return cleanDeviceText(decoded);
}

function readMatch(node: unknown): ProbeMatchData | null {
  const announced = textOf(child(child(node, 'EndpointReference'), 'Address'));
  if (announced === null) return null;
  const endpointRef = announced.trim();
  // A reference is an identifier, not a label: one that is empty, too long or would change when cleaned is not used.
  if (endpointRef === '' || endpointRef.length > ENDPOINT_REF_MAX_CHARS || cleanDeviceText(endpointRef, ENDPOINT_REF_MAX_CHARS) !== endpointRef || /\s/.test(endpointRef)) return null;

  const first: Record<string, string | null> = { name: null, hardware: null, mac: null, serial: null, manufacturer: null, vendor: null };
  const lists: Record<string, string[]> = { profile: [], location: [] };
  for (const token of tokens(textOf(child(node, 'Scopes')), SCOPE_TOKENS_READ)) {
    const scope = SCOPE.exec(token);
    const category = scope?.[1]?.toLowerCase();
    if (scope === null || category === undefined) continue;
    const value = scopeValue(scope[2] ?? '');
    if (value === '') continue;
    if (Object.prototype.hasOwnProperty.call(first, category)) first[category] ??= value;
    else if (Object.prototype.hasOwnProperty.call(lists, category)) {
      const list = lists[category];
      if (list !== undefined && list.length < HINT_LIST_MAX_ENTRIES) list.push(value);
    }
  }
  return Object.freeze({
    endpointRef,
    types: Object.freeze(tokens(textOf(child(node, 'Types')), HINT_LIST_MAX_ENTRIES).map((type) => cleanDeviceText(type)).filter((type) => type !== '')),
    xaddrs: Object.freeze(tokens(textOf(child(node, 'XAddrs')), XADDR_TOKENS_READ).filter((entry) => entry.length <= XADDR_MAX_CHARS)),
    name: first.name ?? null,
    model: first.hardware ?? null,
    vendor: first.manufacturer ?? first.vendor ?? null,
    profileHints: Object.freeze(lists.profile ?? []),
    locationHints: Object.freeze(lists.location ?? []),
    macHint: first.mac ?? null,
    serialHint: first.serial ?? null,
  });
}

const dropped = (drop: ProbeAnswerDrop): ProbeAnswerReading => ({ ok: false, drop });

/** Reads one datagram. Never throws on any input; `ws-discovery.ts` still calls it inside its one `try`. */
export function readProbeAnswer(bytes: Buffer): ProbeAnswerReading {
  if (bytes.length > PROBE_ANSWER_MAX_BYTES) return dropped(ProbeAnswerDrop.OVERSIZED);
  if (hasDeclaration(bytes)) return dropped(ProbeAnswerDrop.DECLARATION);
  const text = bytes.toString('utf8');
  if (deeperThan(text, PROBE_ANSWER_MAX_DEPTH)) return dropped(ProbeAnswerDrop.TOO_DEEP);

  let failure: Error | null = null;
  let parsed: unknown = null;
  try {
    // The callback stores and returns: nothing in it can throw (SEC35-29).
    new xml2js.Parser(PARSER_OPTIONS).parseString(text, (error, result) => {
      failure = failure ?? error;
      parsed = result;
    });
  } catch {
    return dropped(ProbeAnswerDrop.NOT_XML);
  }
  if (failure !== null || parsed === null || parsed === undefined) return dropped(ProbeAnswerDrop.NOT_XML);

  const envelope = own(parsed, 'Envelope');
  const header = child(envelope, 'Header');
  if (textOf(child(header, 'Action'))?.trim() !== PROBE_MATCHES_ACTION) return dropped(ProbeAnswerDrop.NOT_PROBE_MATCHES);
  const relatesTo = textOf(child(header, 'RelatesTo'))?.trim() ?? '';
  if (relatesTo === '') return dropped(ProbeAnswerDrop.NO_RELATES_TO);

  const announced = children(child(child(envelope, 'Body'), 'ProbeMatches'), 'ProbeMatch');
  if (announced.length === 0) return dropped(ProbeAnswerDrop.NO_PROBE_MATCH);
  const matches: ProbeMatchData[] = [];
  let matchesSkipped = Math.max(0, announced.length - PROBE_MATCHES_PER_MESSAGE);
  for (let index = 0; index < announced.length && index < PROBE_MATCHES_PER_MESSAGE; index += 1) {
    const match = readMatch(announced[index]);
    if (match === null) matchesSkipped += 1;
    else matches.push(match);
  }
  if (matches.length === 0) return dropped(ProbeAnswerDrop.NO_PROBE_MATCH);
  return { ok: true, answer: Object.freeze({ relatesTo, matches: Object.freeze(matches), matchesSkipped }) };
}

// ── The service address (DS-9; SEC35-32 (2)) ──────────────────────────────────────────────────

/** A dotted IPv4 literal in its one canonical spelling, as an unsigned 32-bit number; null for anything else. */
export function ipv4ToNumber(text: string): number | null {
  const parts = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (parts === null) return null;
  let value = 0;
  for (let index = 1; index <= 4; index += 1) {
    const part = parts[index] ?? '';
    const octet = Number(part);
    if (octet > 255 || String(octet) !== part) return null;
    value = value * 256 + octet;
  }
  return value;
}

/** Scheme, an IPv4 literal, an optional port, an optional path of URL-path characters: no user part, no query, no fragment, no name. */
const SERVICE_ADDRESS = new RegExp('^https?:[/][/](\\d{1,3}(?:[.]\\d{1,3}){3})(?::(\\d{1,5}))?([/][A-Za-z0-9._~!$&()*+,;=:%/-]*)?$');

export const ServiceAddressReason = { NO_SERVICE_ADDRESS: 'NO_SERVICE_ADDRESS', ADDRESS_MISMATCH: 'ADDRESS_MISMATCH' } as const;
export type ServiceAddressReason = (typeof ServiceAddressReason)[keyof typeof ServiceAddressReason];

export type ServiceAddressChoice = { readonly serviceAddress: string; readonly reason: null } | { readonly serviceAddress: null; readonly reason: ServiceAddressReason };

/**
 * The anti-steering rule (DS-9; D80(11)): the first announced address whose host is an IPv4
 * literal EQUAL to the address the datagram came from. No name is resolved and no other host is
 * ever returned: a later step may contact only a host the kernel named.
 */
export function serviceAddressFor(xaddrs: readonly string[], sourceHost: string): ServiceAddressChoice {
  const source = ipv4ToNumber(sourceHost);
  let wellFormed = 0;
  for (const entry of xaddrs) {
    const parts = SERVICE_ADDRESS.exec(entry);
    if (parts === null) continue;
    const host = ipv4ToNumber(parts[1] ?? '');
    const port = parts[2];
    if (host === null) continue;
    if (port !== undefined && (String(Number(port)) !== port || Number(port) < 1 || Number(port) > 65_535)) continue;
    if ((parts[3] ?? '').length > SERVICE_PATH_MAX_CHARS) continue;
    wellFormed += 1;
    if (source !== null && host === source) return { serviceAddress: entry, reason: null };
  }
  return { serviceAddress: null, reason: wellFormed === 0 ? ServiceAddressReason.NO_SERVICE_ADDRESS : ServiceAddressReason.ADDRESS_MISMATCH };
}
