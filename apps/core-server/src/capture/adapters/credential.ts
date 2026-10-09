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
 * A credential is wrapped at the edge (`sealCredential`) and travels as an opaque object: turned
 * into text, into JSON or into an inspection it gives a fixed mark, it has no enumerable member,
 * and it cannot be cloned or spread into a log line. It cannot be erased from memory (CR-3: no
 * zeroing is claimed); what is guaranteed is that no path but `credentialAtInjection` and
 * `usingCredential` reads it.
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
 * Checks that a stream locator is the host-and-path form and returns it unchanged: the stream
 * scheme, a host, an optional port, a path without a trailing slash (S1 SP-1), and NO user part,
 * query or fragment. The refusal names no part of the input.
 */
export function credentialFreeLocator(locator: string, deviceId: string | null = null): string {
  const refuse = (): never => {
    throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID, deviceId);
  };
  if (typeof locator !== 'string' || locator.length === 0 || locator.length > LOCATOR_MAX_CHARS) return refuse();
  // A user part is refused on the raw text as well as on the parsed form: no parser quirk decides it.
  if (locator.includes('@') || /[\s\\]/.test(locator)) return refuse();
  let parsed: URL;
  try {
    parsed = new URL(locator);
  } catch {
    return refuse();
  }
  if (parsed.protocol !== STREAM_SCHEME || parsed.hostname === '') return refuse();
  if (parsed.username !== '' || parsed.password !== '' || parsed.search !== '' || parsed.hash !== '') return refuse();
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

/** What the process that opens a stream is started with: the locator and, apart from it, the two values. */
export interface InjectedStreamAccess {
  readonly locator: string;
  readonly username: string;
  readonly secret: string;
}

/**
 * THE injection point (SEC35-04). The only place where a locator and a credential are put into
 * one value. The result goes into the start message of the process that opens the stream and
 * nowhere else: it is not logged, not audited, not stored, not put into an error.
 */
export function credentialAtInjection(locator: string, sealed: SealedCredential): InjectedStreamAccess {
  const credential = reveal(sealed);
  return Object.freeze({ locator: credentialFreeLocator(locator), username: credential.username, secret: credential.secret });
}

/** A user part inside any locator-shaped text: scheme, two slashes, anything up to an `@` before the next slash. */
const USER_PART = /([a-z][a-z0-9+.-]*:\/\/)[^/\s'"<>@]*@/gi;

/**
 * Removes the user part of every locator in a text (the camera-credential form of spec §G G-R4).
 * For text the Core did not write itself — a device's or a process's error text, which is parsed
 * for its failure and never logged raw (§A.6): what is kept of it passes through here first.
 */
export function blankCredentialLocators(text: string): string {
  return text.replace(USER_PART, `$1${CREDENTIAL_MARK}@`);
}
