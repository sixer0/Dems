/**
 * Camera credentials and stream locators (blueprint row 65; SEC35-04; capture spec §A.6 "Credential
 * handling", §A.6.3 rules CR-1 to CR-7 and "What the recording process receives"; specs C-N8).
 *
 * THE RULE. A stream locator is the host-and-path form and never carries a user part. A
 * credential is a pair of separate values beside it. The two meet in exactly ONE function,
 * `credentialAtInjection`, whose result is handed to the channel that starts the process which
 * opens the stream (the start message on its standard input: never an argument list, never an
 * environment variable). Nothing in the Core composes the user-part form of a locator, and the
 * injection result itself keeps the two apart, as §A.6.3 rules.
 *
 * As built, no process takes a credential: recording a real camera is class C-2. So
 * `credentialAtInjection` has no caller in the product yet; a static test holds it to "this file
 * and nothing else reads the two members of a credential".
 *
 * The injection result is opaque too (security addendum AD-03 point 6): it prints as the mark,
 * and ONE function, `startMessageBytes`, reads it - into the bytes of the start message, which
 * the process door writes and zero-fills. No text of a start message is ever made.
 *
 * A credential is wrapped at the edge (`sealCredential`) and travels as an opaque object: turned
 * into text, into JSON or into an inspection it gives a fixed mark, it has no enumerable member,
 * and it cannot be cloned or spread into a log line. It cannot be erased from memory (CR-3: no
 * zeroing is claimed); what is guaranteed is that no path but `startMessageBytes` (through the
 * result of `credentialAtInjection`) and `usingCredential` reads it.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from './errors';

/** What an operator enters (C3 op 95, 96, 89: `{ username, secret }`). Lives for one request (CR-1). */
export interface CameraCredential {
  readonly username: string;
  readonly secret: string;
}

/** What a sealed credential shows wherever it is printed. */
export const CREDENTIAL_MARK = '[credential]';

const INSPECT = Symbol.for('nodejs.util.inspect.custom');
const VAULT = new WeakMap<object, CameraCredential>();

/** An opaque credential. It has no member a serialiser could read. */
export class SealedCredential {
  constructor(credential: CameraCredential) {
    VAULT.set(this, Object.freeze({ username: credential.username, secret: credential.secret }));
    Object.freeze(this);
  }
  toString(): string {
    return CREDENTIAL_MARK;
  }
  toJSON(): string {
    return CREDENTIAL_MARK;
  }
  [INSPECT](): string {
    return CREDENTIAL_MARK;
  }
}

export function sealCredential(credential: CameraCredential): SealedCredential {
  return new SealedCredential(credential);
}

function reveal(sealed: SealedCredential): CameraCredential {
  const credential = VAULT.get(sealed);
  // Unreachable for an object this file made; a forged one names nothing.
  if (credential === undefined) throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID);
  return credential;
}

/**
 * Hands the two values to the one call that authenticates toward a device (the connection test
 * of §A.6.2, built by row 142). The values exist inside `use` only; what `use` returns or throws
 * is the caller's to keep free of them.
 */
export function usingCredential<T>(sealed: SealedCredential, use: (credential: CameraCredential) => T): T {
  return use(reveal(sealed));
}

/** The scheme of a stream locator, as the parser names it. */
const STREAM_SCHEME = 'rtsp:';
const LOCATOR_MAX_CHARS = 256;

/**
 * THE QUERY RULE of a stream locator (task 4 row 174, decision C24; moved here from
 * `camera/onvif-session.ts` by row 46, so that the read of a locator and the injection point judge
 * a query by ONE function). Common cameras name their stream with a query (a channel, a
 * sub-stream, a transport word), so a query is admitted - under a CLOSED rule, judged on the
 * device's own text with no decoding and no parser:
 *
 *   length      the whole locator at most `LOCATOR_MAX_CHARS`, the query (after its `?`) 1 to
 *               `QUERY_MAX_CHARS` characters, at most `QUERY_MAX_PARAMETERS` parameters;
 *   characters  a parameter is `name` or `name=value`, parameters are joined by `&`; a name is 1
 *               to 32 and a value 0 to 64 characters of `A-Z a-z 0-9 . _ ~ -`. Nothing else: no
 *               `%` (so no name can hide behind an encoding), no `+`, no `;`, no second `?`, no
 *               second `=` in a parameter, no empty parameter;
 *   names       no parameter name (letter case folded) may CONTAIN a part of
 *               `CREDENTIAL_LIKE_PARTS` or BE a word of `CREDENTIAL_LIKE_WHOLE_NAMES`, unless it is a
 *               stream parameter of `STREAM_PARAMETER_EXCEPTIONS` with the value form stated there;
 *               and no name may appear twice (two readers could disagree on which one counts).
 *
 * A VALUE is not judged (but an exception's): `mode=password` names a mode.
 *
 * Row 174b (decision C127, caution C-4 of the security review of row 86): the names were compared
 * WHOLE against a list of ten, which let `passwd`, `pw`, `usr`, `login`, `loginuse`, `loginpas`,
 * `account`, `apikey`, `access_token` through. A name is now refused by the CLASS of a part it
 * contains: `apikey` holds `key`, `access_token` holds `token`, `loginpas` holds `login` and `pass`.
 * The short words `pw`, `usr`, `account` are refused only as the whole name: as a part they stand
 * inside harmless names (`pwm`, `busrate`) and add no class the parts above do not already hold.
 * ONE exception, for a stream address a camera itself states: `sessiontimeout` (an ONVIF stream
 * address of the form `.../media.amp?profile=...&sessiontimeout=60&streamtype=unicast`) contains
 * `session`; it is admitted with a value of 1 to 6 digits only, so it can carry no text.
 */
const QUERY_MAX_CHARS = 128;
const QUERY_MAX_PARAMETERS = 8;
const QUERY_PARAMETER = /^([A-Za-z0-9._~-]{1,32})(?:=([A-Za-z0-9._~-]{0,64}))?$/;
// One text each, split: these are names to REFUSE, not accounts (static rule G-R14 reads a quoted account word as a default account).
const CREDENTIAL_LIKE_PARTS: readonly string[] = Object.freeze('pass pwd token key secret auth user login session'.split(' '));
const CREDENTIAL_LIKE_WHOLE_NAMES: ReadonlySet<string> = new Set('pw usr account'.split(' '));
/** A stream parameter a camera states that contains a part above: admitted only with a value of this form (never without a value). */
const STREAM_PARAMETER_EXCEPTIONS: ReadonlyMap<string, RegExp> = new Map([['sessiontimeout', /^[0-9]{1,6}$/]]);

/** True when a (case-folded) parameter name reads as a credential, judged with its value only for an exception. */
function credentialLikeName(name: string, value: string | undefined): boolean {
  const exception = STREAM_PARAMETER_EXCEPTIONS.get(name);
  if (exception !== undefined) return value === undefined || !exception.test(value);
  return CREDENTIAL_LIKE_WHOLE_NAMES.has(name) || CREDENTIAL_LIKE_PARTS.some((part) => name.includes(part));
}

/** True when the text after the `?` of a stream locator is inside the query rule. It answers yes or no: no part of the text is kept. */
function queryAllowed(query: string): boolean {
  if (query.length === 0 || query.length > QUERY_MAX_CHARS) return false;
  const parameters = query.split('&');
  if (parameters.length > QUERY_MAX_PARAMETERS) return false;
  const seen = new Set<string>();
  for (const parameter of parameters) {
    const match = QUERY_PARAMETER.exec(parameter);
    const name = match?.[1]?.toLowerCase();
    if (name === undefined || credentialLikeName(name, match?.[2]) || seen.has(name)) return false;
    seen.add(name);
  }
  return true;
}

/**
 * Checks that a stream locator is the host-and-path form and returns it unchanged: the stream
 * scheme, a host, an optional port, a path without a trailing slash (S1 SP-1), NO user part and
 * NO fragment; a query only inside the query rule above (a bare `?` is refused with the rest).
 * The refusal names no part of the input.
 */
export function credentialFreeLocator(locator: string, deviceId: string | null = null): string {
  const refuse = (): never => {
    throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID, deviceId);
  };
  if (typeof locator !== 'string' || locator.length === 0 || locator.length > LOCATOR_MAX_CHARS) return refuse();
  // A user part is refused on the raw text as well as on the parsed form: no parser quirk decides it.
  if (locator.includes('@') || /[\s\\]/.test(locator)) return refuse();
  // So are a fragment mark and a query outside its rule: the parser reports a bare trailing mark of either kind as empty.
  if (locator.includes('#')) return refuse();
  const mark = locator.indexOf('?');
  if (mark !== -1 && !queryAllowed(locator.slice(mark + 1))) return refuse();
  let parsed: URL;
  try {
    parsed = new URL(locator);
  } catch {
    return refuse();
  }
  if (parsed.protocol !== STREAM_SCHEME || parsed.hostname === '') return refuse();
  if (parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') return refuse();
  if (parsed.pathname.length < 2 || parsed.pathname.endsWith('/')) return refuse();
  return locator;
}

/**
 * Builds the host-and-path locator of a stream from its parts and checks it. The one composer of
 * a stream locator in the Core: it takes no user part and cannot produce one.
 */
export function streamLocator(parts: { readonly host: string; readonly port?: number | null; readonly path: string }, deviceId: string | null = null): string {
  const authority = parts.port === undefined || parts.port === null ? parts.host : `${parts.host}:${parts.port}`;
  return credentialFreeLocator(`${STREAM_SCHEME}//${authority}/${parts.path.replace(/^\/+/, '')}`, deviceId);
}

const ACCESS = new WeakMap<object, { readonly locator: string; readonly credential: CameraCredential }>();

/**
 * What the process that opens a stream is started with: the locator and, apart from it, the two
 * values (security addendum AD-03 point 6, weakness W-2). It is opaque as a `SealedCredential`
 * is: no member, own or inherited, holds a value, so turned into text, into JSON or into an
 * inspection, spread, cloned or carried as the cause of an error it gives the mark. Its one
 * reader is `startMessageBytes`.
 */
export class InjectedStreamAccess {
  constructor(locator: string, sealed: SealedCredential) {
    ACCESS.set(this, Object.freeze({ locator: credentialFreeLocator(locator), credential: reveal(sealed) }));
    Object.freeze(this);
  }
  toString(): string {
    return CREDENTIAL_MARK;
  }
  toJSON(): string {
    return CREDENTIAL_MARK;
  }
  [INSPECT](): string {
    return CREDENTIAL_MARK;
  }
}

/**
 * THE injection point (SEC35-04). The only place where a locator and a credential are put into
 * one value. The result goes into the start message of the process that opens the stream and
 * nowhere else: it is not logged, not audited, not stored, not put into an error - and if it is,
 * it shows the mark.
 */
export function credentialAtInjection(locator: string, sealed: SealedCredential): InjectedStreamAccess {
  return new InjectedStreamAccess(locator, sealed);
}

/** A member of a start message beside the stream access: a plain value, never a container. */
export type StartMessagePlainMember = string | number | boolean | null;
/**
 * A start message: flat, its members plain values and at most ONE stream access (the result of
 * `credentialAtInjection`), under the name the receiving process expects.
 */
export type StartMessage = Readonly<Record<string, StartMessagePlainMember | InjectedStreamAccess>>;

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const HEX = '0123456789abcdef';

/** The UTF-8 bytes of a text in memory of their own (never a slice of the shared pool), so that a zero-fill clears every copy this file made. */
function ownBytes(text: string): Buffer {
  const bytes = Buffer.alloc(Buffer.byteLength(text, 'utf8'));
  bytes.write(text, 'utf8');
  return bytes;
}

/** Length of a raw value as a JSON string: two quotes, 2 bytes for a quote or a backslash, 6 for a control byte. */
function quotedLength(raw: Buffer): number {
  let length = 2;
  for (const byte of raw) length += byte === QUOTE || byte === BACKSLASH ? 2 : byte < 0x20 ? 6 : 1;
  return length;
}

/** Writes a raw value as a JSON string, byte by byte: no text of the value is made. Returns the next offset. */
function writeQuoted(out: Buffer, start: number, raw: Buffer): number {
  let at = start;
  out[at++] = QUOTE;
  for (const byte of raw) {
    if (byte === QUOTE || byte === BACKSLASH) {
      out[at++] = BACKSLASH;
      out[at++] = byte;
    } else if (byte < 0x20) {
      // A control byte (a line end among them) leaves as its six-byte escape: the message stays one line.
      at += out.write('\\u00', at, 'latin1');
      out[at++] = HEX.charCodeAt(byte >> 4);
      out[at++] = HEX.charCodeAt(byte & 0x0f);
    } else {
      out[at++] = byte;
    }
  }
  out[at++] = QUOTE;
  return at;
}

/** A text with a surrogate that has no partner has no UTF-8 form: it would leave as another value. */
function wellFormed(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/**
 * THE serialiser of a start message (security addendum AD-03 point 6), and the one reader of a
 * stream access. It returns the bytes of one line - a JSON object in the order of the message's
 * members, the stream access as an object of `locator`, `username`, `secret`, then a line feed -
 * in memory of its own, which the process door writes to the child's standard input and then
 * zero-fills. No text of the message is made on the way: every value is copied byte by byte, and
 * the copies this function makes are zero-filled before it returns, also when it refuses. (The
 * credential's own two texts cannot be erased, CR-3; nothing here adds a third.)
 *
 * It refuses, by a code that names no part of the message: a member that is not a plain value or
 * a stream access made by this file, a second stream access, a number that is not finite, a text
 * without a UTF-8 form.
 */
export function startMessageBytes(message: StartMessage): Buffer {
  const refuse = (): never => {
    throw new CaptureAdapterError(CaptureAdapterRefusal.START_MESSAGE_INVALID);
  };
  /** The message as pieces: structure and plain literals as ASCII text, every text value as raw bytes to be quoted. */
  const pieces: (string | Buffer)[] = [];
  const text = (value: string): void => {
    if (!wellFormed(value)) refuse();
    pieces.push(ownBytes(value));
  };
  try {
    let accesses = 0;
    let separator = '{';
    for (const [name, member] of Object.entries(message)) {
      pieces.push(separator);
      separator = ',';
      text(name);
      pieces.push(':');
      if (member === null || typeof member === 'boolean') pieces.push(String(member));
      else if (typeof member === 'number') pieces.push(Number.isFinite(member) ? String(member) : refuse());
      else if (typeof member === 'string') text(member);
      else {
        const access = ACCESS.get(member);
        if (access === undefined || (accesses += 1) > 1) return refuse();
        pieces.push('{"locator":');
        text(access.locator);
        pieces.push(',"username":');
        text(access.credential.username);
        pieces.push(',"secret":');
        text(access.credential.secret);
        pieces.push('}');
      }
    }
    pieces.push(separator === '{' ? '{}\n' : '}\n');
    let length = 0;
    for (const piece of pieces) length += typeof piece === 'string' ? piece.length : quotedLength(piece);
    const out = Buffer.alloc(length);
    let at = 0;
    for (const piece of pieces) at = typeof piece === 'string' ? at + out.write(piece, at, 'latin1') : writeQuoted(out, at, piece);
    return out;
  } finally {
    for (const piece of pieces) if (typeof piece !== 'string') piece.fill(0);
  }
}

/**
 * A user part inside any locator-shaped text: scheme, two slashes, anything up to an `@` before the next slash.
 *
 * LINEAR (row N5c, decision C138; request of row N5b). The form before, `([a-z][a-z0-9+.-]*:\/\/)...`,
 * was tried at EVERY letter of a run of scheme characters and scanned to the run's end each time:
 * quadratic in a run not followed by `://` (64 KiB of letters about 2.5 to 4.4 s on this Mac, one
 * device-chosen base64 run inside the door's kept text). A match now starts only where a run of
 * scheme characters starts (the look-behind), and the group takes the run's leading digits and
 * signs, which the form before left in front of its match unchanged: the output is the same
 * (differential fuzz, 500,000 texts, 0 differences) and each character is passed a bounded number
 * of times (1 MiB of letters under 10 ms).
 */
const USER_PART = /(?<![a-z0-9+.-])([0-9+.-]*[a-z][a-z0-9+.-]*:\/\/)[^/\s'"<>@]*@/gi;

/**
 * Removes the user part of every locator in a text (the camera-credential form of spec §G G-R4).
 * For text the Core did not write itself — a device's or a process's error text, which is parsed
 * for its failure and never logged raw (§A.6): what is kept of it passes through here first.
 */
export function blankCredentialLocators(text: string): string {
  return text.replace(USER_PART, `$1${CREDENTIAL_MARK}@`);
}
