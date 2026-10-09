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
 * What it does not do: guess that a bare `value: x` in a text that names no credential is one.
 * `value` is the name of ordinary members too, and a rule that blanked them all would leave no log.
 */

/** What a blanked value becomes. */
export const CREDENTIAL_BLANK = '***';

/** A session token, a device credential and a biometric token start with these (01_specs §5.3). */
const TOKEN = /\b(ses|dvc|bio)_[A-Za-z0-9_-]+/g;

// `Bearer` as a header writes it takes any value; in lower case (the scheme is case-insensitive)
// it must look like a token (8 characters or more, one of them not a letter), so that prose such
// as "a bearer of news" stays as it is. A token of this server keeps rule 1.
const BEARER_VALUE =
  /\b(Bearer|BEARER)\s+(?!(?:ses|dvc|bio)_)[A-Za-z0-9._~+/=-]+|\b(bearer)\s+(?!(?:ses|dvc|bio)_)(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{8,}/g;

/** The names of rule 3. No look-behind: a name that ENDS in one of them is one of them. */
const CREDENTIAL_NAME = 'api[-_]?key|authorization|credential(?:Value|Ref|_ref|\\.value|\\.ref)?|secret(?:_ciphertext)?';
/** The names of rule 4, which count only in a text that mentions a credential. */
const CONTEXT_NAME = 'value|ref';
/** After a name: its closing quote (escaped or not), then `:` or `=`. */
const SEPARATOR = '\\\\*["\']?\\s*[:=]\\s*';

const mention = (names: string): RegExp => new RegExp(`(${names})(?![A-Za-z0-9])${SEPARATOR}`, 'gi');
const CREDENTIAL_MENTION = mention(CREDENTIAL_NAME);
const ANY_MENTION = new RegExp(`(?:(${CREDENTIAL_NAME})|(?<![A-Za-z0-9_-])(${CONTEXT_NAME}))(?![A-Za-z0-9])${SEPARATOR}`, 'gi');
/** The `kind` of a credential write, in any quoting. Case-sensitive: `credentialKind` is not it. */
const CREDENTIAL_KIND = /(?<![A-Za-z0-9_])kind\\*["']?\s*[:=]\s*\\*["']?(?:SECRET|REFERENCE)\b/;
const AUTHORIZATION = /^authorization$/i;
/** Where an unquoted value ends. */
const UNQUOTED_END = /[,;&})\]\n"']/;

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

function blankMembers(text: string, pattern: RegExp): string {
  let out = '';
  let cursor = 0;
  pattern.lastIndex = 0;
  for (let found = pattern.exec(text); found !== null; found = pattern.exec(text)) {
    const span = valueSpan(text, found.index + found[0].length, AUTHORIZATION.test(found[1] ?? ''));
    if (span === null) continue;
    out += text.slice(cursor, span.start) + CREDENTIAL_BLANK;
    cursor = span.end;
    // Nothing inside a blanked value is read as a member.
    pattern.lastIndex = Math.max(pattern.lastIndex, span.end);
  }
  return out + text.slice(cursor);
}

/** A text as a log may keep it: rules 1 to 4 of this file. Never throws; a text that is none comes back as it is. */
export function redactCredentialText(text: string): string {
  if (typeof text !== 'string' || text === '') return text;
  const tokens = text
    .replace(TOKEN, `$1_${CREDENTIAL_BLANK}`)
    .replace(BEARER_VALUE, (_match, upper: string | undefined, lower: string | undefined) => `${upper ?? lower ?? 'Bearer'} ${CREDENTIAL_BLANK}`);
  CREDENTIAL_MENTION.lastIndex = 0;
  const mentionsCredential = CREDENTIAL_MENTION.test(tokens) || CREDENTIAL_KIND.test(tokens);
  if (!mentionsCredential) return tokens;
  return blankMembers(tokens, ANY_MENTION);
}

/** True for a member name that says credential: the names of rule 3, in any case and with `-`, `_`, `.` or none. */
export function isCredentialKeyName(key: string): boolean {
  const name = key.toLowerCase().replace(/[-_.\s]/g, '');
  return (
    name.endsWith('apikey') ||
    name.endsWith('authorization') ||
    name.endsWith('secret') ||
    name === 'secretciphertext' ||
    name === 'credential' ||
    name === 'credentialvalue' ||
    name === 'credentialref'
  );
}

/** True for the `kind` of a credential write (`updateSttConfig`): beside it, `value` and `ref` are the credential. */
export function isCredentialWriteKind(kind: unknown): boolean {
  return kind === 'SECRET' || kind === 'REFERENCE';
}

/** How deep an object is walked. What lies deeper is blanked whole: never returned as it came. */
export const CREDENTIAL_WALK_DEPTH = 12;

/** A value as a log may keep it: texts by `redactCredentialText`, members by name at any depth. */
export function redactCredentialValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactCredentialText(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= CREDENTIAL_WALK_DEPTH) return CREDENTIAL_BLANK;
  if (Array.isArray(value)) return value.map((entry) => redactCredentialValue(entry, depth + 1));
  const members = value as Record<string, unknown>;
  const write = isCredentialWriteKind(members['kind']);
  return Object.fromEntries(
    Object.entries(members).map(([key, entry]) => [
      key,
      isCredentialKeyName(key) || (write && (key === 'value' || key === 'ref')) ? CREDENTIAL_BLANK : redactCredentialValue(entry, depth + 1),
    ]),
  );
}
