/**
 * The ONE rule set of the client log-blanking lists (task 3 blueprint row 113, fix round 1,
 * navigator finding N-1; C3 §2.5; SEC35-13/14; E-31).
 *
 * Two callers, one implementation: the web error sink (`apps/core-web/src/runtime/error-sink.ts`)
 * and the mobile runtime log (`apps/mobile/src/runtime/log.ts`). Both are the SECOND line: no
 * client code puts a request body or a header into a report. This file is what stands when one
 * does. It has no dependency, so a log module can load it first.
 *
 * WHAT IS BLANKED IN A TEXT (`redactCredentialText`)
 *
 *   1. A token of this server, by its prefix: `ses_…`, `dvc_…`, `bio_…` become `ses_***` (01_specs §5.3).
 *   2. Whatever follows the `Bearer` scheme.
 *   3. The value of a member whose NAME says credential, wherever it stands and however it is
 *      written: `apiKey`, `api_key`, `x-api-key`, `authorization`, `credential`,
 *      `credentialValue`, `credentialRef`, `credential.value`, `secret`, a name that ends in one
 *      of them (`client_secret`), with `:` or `=`, quoted with `"` or `'` or not at all, and with
 *      the quotes escaped any number of times (JSON inside a JSON string).
 *   4. In a text that mentions a credential at all (a name of rule 3, or the `kind` of a
 *      credential write: `SECRET`, `REFERENCE`), ALSO the value of `value` and of `ref`, in
 *      whatever order the members stand.
 *
 * IT FAILS CLOSED. A quoted value runs to its closing quote, with escaped quotes inside it; one
 * that never closes is blanked to the end of the text. An `authorization` value is blanked to the
 * end of its line, whatever the scheme. An unquoted value runs to the next `,` `;` `&` `}` `)` `]`
 * or line end, spaces included. The price is a text that loses more than the secret; a log line
 * is worth less than a key.
 *
 * WHAT IS BLANKED IN AN OBJECT (`redactCredentialValue`): every text by the rules above; the
 * whole value of a member whose name says credential, at ANY depth; `value` and `ref` beside a
 * credential `kind`; and anything nested deeper than the walk goes, whole.
 *
 * FIX ROUND 2 (navigator re-check R-1, R-2). One predicate, `isCredentialKeyName`, decides a name
 * for the text rule AND the object rule: any name that holds `credential` (but not the three flags
 * `credentialSet` / `credentialKind` / `credentialChanged`), `apikey`, `secret`, `password`,
 * `passphrase`, `authorization`, or that ends in `token`. A scheme `Bearer` / `Basic` in any case,
 * with a quoted value or a token of any characters; a header written as a tuple
 * (`["authorization","…"]`); `kind` / `value` / `ref` in any case; a URL-encoded body (judged, and
 * returned, decoded). The object walk is BOUNDED: a reference back to an object the walk is inside
 * of is blanked, and after `CREDENTIAL_WALK_NODE_BUDGET` nodes everything not yet reached is
 * blanked whole.
 *
 * What it does not do: guess that a bare `value: x` in a text that names no credential is one, or
 * that `key: x` is a secret (`key` names storage keys and list keys in every log), or read prose
 * (`Basic authentication`, `the credential x was rejected`). An unquoted value ends at the next
 * `,` `;` `&`: one that holds such a character is cut there.
 */

/** What a blanked value becomes. */
export const CREDENTIAL_BLANK = '***';

/** A session token, a device credential and a biometric token start with these (01_specs §5.3). */
const TOKEN = /\b(ses|dvc|bio)_[A-Za-z0-9_-]+/g;

/**
 * An authentication scheme and what follows it. Written as a header writes it (`Bearer`, `Basic`,
 * or all capitals) it takes any value. In any other case (`bearer`, `BeArEr`, `basic`) the value
 * must look like a token, so that prose ("a bearer of news", "basic information") stays as it is.
 * `Basic` is held to the token test in every case: "Basic authentication" is a phrase. A token of
 * this server after the scheme keeps rule 1 (`Bearer ses_***`).
 */
const SCHEME = /\b(bearer|basic)(\s+)(?!(?:ses|dvc|bio)_)(?:(["'])([^"'\n]*)\3|([^\s"',;)\]}]+))/gi;
/** Looks like a token, not a word: 8 characters or more, with a character that is no letter or a capital after the first. */
const tokenLike = (value: string): boolean => value.length >= 8 && (/[^A-Za-z]/.test(value) || /[A-Z]/.test(value.slice(1)));

function blankSchemes(text: string): string {
  return text.replace(SCHEME, (whole: string, scheme: string, gap: string, quote: string | undefined, quoted: string | undefined, bare: string | undefined) => {
    const asHeader = scheme === 'Bearer' || scheme === 'BEARER';
    const value = quoted ?? bare ?? '';
    if (!asHeader && !tokenLike(value)) return whole;
    if (bare === CREDENTIAL_BLANK) return whole;
    return quote === undefined ? `${scheme}${gap}${CREDENTIAL_BLANK}` : `${scheme}${gap}${quote}${CREDENTIAL_BLANK}${quote}`;
  });
}

/**
 * A member name and its separator: `name:` or `name=`, the name of one word or two (`API Key`),
 * with dots, dashes and brackets (`body.credential.value`, `credential[value]`), its closing quote
 * escaped or not. Which names count is `isCredentialKeyName`'s decision, not this pattern's.
 */
const MEMBER = /([A-Za-z_][A-Za-z0-9_.[\]-]{0,63})(?: ([A-Za-z_][A-Za-z0-9_.[\]-]{0,31}))?\\*["']?\s*[:=]\s*/g;
/**
 * A header written as a tuple: `["authorization","…"]`. The name is the first text, the value the
 * second. Header names only (`isHeaderName`): in `"kind":"SECRET","value":…` the text `SECRET`
 * is followed by a comma and a quoted text too, and is no name.
 */
const TUPLE = /(\\*["'])([A-Za-z][A-Za-z0-9_-]{0,63})\1(\s*,\s*)(?=\\*["'])/g;
/** The `kind` of a credential write, in any quoting and any case. `credentialKind` is not it. */
const CREDENTIAL_KIND = /(?<![A-Za-z0-9_])kind\\*["']?\s*[:=]\s*\\*["']?(?:secret|reference)\b/i;
const AUTHORIZATION = /authorization$/;
/** Where an unquoted value ends. */
const UNQUOTED_END = /[,;&})\]\n"']/;

const normalised = (name: string): string => name.toLowerCase().replace(/[-_.\s[\]]/g, '');

/**
 * True for a member name that says credential. THE predicate of both rules (text and object), in
 * any case and with `-`, `_`, `.`, a space or brackets in it.
 */
export function isCredentialKeyName(key: string): boolean {
  const name = normalised(key);
  if (name.includes('credential')) return !/credential(?:set|kind|changed)$/.test(name);
  if (name.includes('secret')) return !name.includes('secretar');
  return name.includes('apikey') || name.includes('authorization') || name.includes('password') || name.includes('passphrase') || name.endsWith('token');
}

/** The header names a tuple may carry: an authorization header or an API-key header. */
const isHeaderName = (name: string): boolean => {
  const plain = normalised(name);
  return plain.includes('authorization') || plain.includes('apikey');
};

/** `value` and `ref`: the credential itself beside a credential `kind`, ordinary members anywhere else. */
const isContextName = (name: string): boolean => {
  const plain = normalised(name);
  return plain === 'value' || plain === 'ref' || plain.endsWith('credentialvalue') || plain.endsWith('credentialref');
};

/** The part of `text` from `from` that is the value of a member: `[start, end)` without its quotes, or null when there is none. */
function valueSpan(text: string, from: number, toLineEnd: boolean): { start: number; end: number } | null {
  const opener = /^(\\*)(["'])/.exec(text.slice(from, from + 64));
  if (opener !== null) {
    const escapes = opener[1]?.length ?? 0;
    const quote = opener[2] ?? '"';
    const start = from + opener[0].length;
    for (let index = text.indexOf(quote, start); index !== -1; index = text.indexOf(quote, index + 1)) {
      let run = 0;
      while (index - run - 1 >= start && text[index - run - 1] === '\\') run += 1;
      // The closing quote carries the escapes of the opening one; a quote INSIDE the value carries more.
      const closes = escapes === 0 ? run % 2 === 0 : run <= escapes;
      if (closes) return { start, end: index - (escapes === 0 ? 0 : Math.min(run, escapes)) };
    }
    return { start, end: text.length };
  }
  const first = text[from];
  // An object or a list: its members are named themselves, and are found by their own names.
  if (first === undefined || first === '{' || first === '[') return null;
  const rest = text.slice(from);
  const stop = toLineEnd ? rest.indexOf('\n') : rest.search(UNQUOTED_END);
  const end = from + (stop === -1 ? rest.length : stop);
  return end > from ? { start: from, end } : null;
}

/** The name a member match stands for, when it is one to blank: the two words together, or the last one alone. */
function blankedName(found: RegExpExecArray, context: boolean): string | null {
  const first = found[1] ?? '';
  const second = found[2];
  const candidates = second === undefined ? [first] : [`${first} ${second}`, second];
  return candidates.find((name) => isCredentialKeyName(name) || (context && isContextName(name))) ?? null;
}

/** True when a text names a credential at all: a credential member, a header tuple of one, or the kind of a credential write. */
function mentionsCredential(text: string): boolean {
  if (CREDENTIAL_KIND.test(text)) return true;
  MEMBER.lastIndex = 0;
  for (let found = MEMBER.exec(text); found !== null; found = MEMBER.exec(text)) if (blankedName(found, false) !== null) return true;
  TUPLE.lastIndex = 0;
  for (let found = TUPLE.exec(text); found !== null; found = TUPLE.exec(text)) if (isHeaderName(found[2] ?? '')) return true;
  return false;
}

function blankSpans(text: string, pattern: RegExp, toBlank: (found: RegExpExecArray) => { from: number; toLineEnd: boolean } | null): string {
  let out = '';
  let cursor = 0;
  pattern.lastIndex = 0;
  for (let found = pattern.exec(text); found !== null; found = pattern.exec(text)) {
    const target = toBlank(found);
    if (target === null) continue;
    const span = valueSpan(text, target.from, target.toLineEnd);
    if (span === null || span.start < cursor) continue;
    out += text.slice(cursor, span.start) + CREDENTIAL_BLANK;
    cursor = span.end;
    // Nothing inside a blanked value is read as a member.
    pattern.lastIndex = Math.max(pattern.lastIndex, span.end);
  }
  return out + text.slice(cursor);
}

/** A URL-encoded text, decoded; the text itself when it holds no escape or cannot be decoded. */
function urlDecoded(text: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(text)) return text;
  try {
    return decodeURIComponent(text);
  } catch {
    // Not valid percent-encoding as a whole: decode the escapes that are (ASCII only), leave the rest.
    return text.replace(/%([0-7][0-9A-Fa-f])/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
  }
}

/** A text as a log may keep it: the rules of this file. Never throws; a text that is none comes back as it is. */
export function redactCredentialText(text: string): string {
  if (typeof text !== 'string' || text === '') return text;
  // A URL-encoded body hides its member names: when the decoded text names a credential, the
  // decoded text is what is judged and returned. Otherwise the text stays byte for byte.
  const decoded = urlDecoded(text);
  const source = decoded !== text && mentionsCredential(decoded) ? decoded : text;
  const schemes = blankSchemes(source.replace(TOKEN, `$1_${CREDENTIAL_BLANK}`));
  if (!mentionsCredential(schemes)) return schemes;
  const members = blankSpans(schemes, MEMBER, (found) => {
    const name = blankedName(found, true);
    return name === null ? null : { from: found.index + found[0].length, toLineEnd: AUTHORIZATION.test(normalised(name)) };
  });
  return blankSpans(members, TUPLE, (found) => (isHeaderName(found[2] ?? '') ? { from: found.index + found[0].length, toLineEnd: false } : null));
}

/** True for the `kind` of a credential write (`updateSttConfig`), in any case: beside it, `value` and `ref` are the credential. */
export function isCredentialWriteKind(kind: unknown): boolean {
  if (typeof kind !== 'string') return false;
  const upper = kind.toUpperCase();
  return upper === 'SECRET' || upper === 'REFERENCE';
}

/** How deep an object is walked. What lies deeper is blanked whole: never returned as it came. */
export const CREDENTIAL_WALK_DEPTH = 12;
/**
 * How many objects and lists one walk enters (navigator re-check R-2). What the walk has not
 * reached by then - object, list or text - is blanked whole: an object too large to judge is not
 * returned as it came, and a log call cannot hold its caller up.
 */
export const CREDENTIAL_WALK_NODE_BUDGET = 2_000;

interface Walk {
  /** The objects the walk is inside of: a reference back to one of them is a cycle. */
  readonly inside: Set<object>;
  entered: number;
}

function walk(value: unknown, depth: number, state: Walk): unknown {
  const spent = state.entered >= CREDENTIAL_WALK_NODE_BUDGET;
  if (typeof value === 'string') return spent ? CREDENTIAL_BLANK : redactCredentialText(value);
  if (value === null || typeof value !== 'object') return value;
  if (spent || depth >= CREDENTIAL_WALK_DEPTH || state.inside.has(value)) return CREDENTIAL_BLANK;
  state.entered += 1;
  state.inside.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => walk(entry, depth + 1, state));
    const members = Object.entries(value as Record<string, unknown>);
    const write = members.some(([key, entry]) => key.toLowerCase() === 'kind' && isCredentialWriteKind(entry));
    return Object.fromEntries(
      members.map(([key, entry]) => [key, isCredentialKeyName(key) || (write && isContextName(key)) ? CREDENTIAL_BLANK : walk(entry, depth + 1, state)]),
    );
  } finally {
    state.inside.delete(value);
  }
}

/** A value as a log may keep it: texts by `redactCredentialText`, members by name at any depth, within a bounded walk. */
export function redactCredentialValue(value: unknown, depth = 0): unknown {
  return walk(value, depth, { inside: new Set<object>(), entered: 0 });
}
