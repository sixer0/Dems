/**
 * THE SINGLE KEY-LOADER (SEC35-14; transcript spec §B.2 "API key handling"; D7(d)).
 *
 * This is the only module of `apps/transcriber` that names or reads the oMLX settings file, and the
 * only one that ever holds the key as text (static rule `src/__tests__/static.test.ts`). The key is:
 *
 *   - referenced by a pointer (`omlx-settings:auth.api_key`), never copied into DEMS configuration;
 *   - read into memory only, when a backend is built;
 *   - handed out as an opaque `Credential` that prints as `***` under `String()`,
 *     `JSON.stringify`, template text and `util.inspect`;
 *   - turned into text in exactly one function, `bearerHeaderValue`, which the HTTP client of the
 *     `omlx-server` backend calls to build the `Authorization` header of a loopback request;
 *   - never logged, never placed in an argument list, an environment variable, a file or an error.
 *
 * A failure to read says WHICH reference failed and why in a code. It never quotes the file.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { CREDENTIAL_BLANK } from '@dems/shared/api';
import { TranscriberError, TranscriberErrorCode } from './types';

/**
 * What every rendering of a credential shows: the one blank of the shared rule set
 * (`CREDENTIAL_BLANK` of `@dems/shared/api`), so that a line blanked by value and then read by the
 * by-position rules holds nothing those rules could take for a member name.
 */
export const CREDENTIAL_PLACEHOLDER: string = CREDENTIAL_BLANK;

/** The one store this loader reads, and the one member of it. */
export const OMLX_SETTINGS_STORE = 'omlx-settings';
export const OMLX_API_KEY_POINTER = 'auth.api_key';
/** The reference a configuration row stores for the oMLX key (`STT_CREDENTIAL_REF_PATTERN`). */
export const OMLX_CREDENTIAL_REF = `${OMLX_SETTINGS_STORE}:${OMLX_API_KEY_POINTER}`;

const values = new WeakMap<Credential, string>();

/** An opaque holder. It has no enumerable member; the text lives in a module-private WeakMap. */
export class Credential {
  toString(): string {
    return CREDENTIAL_PLACEHOLDER;
  }

  toJSON(): string {
    return CREDENTIAL_PLACEHOLDER;
  }

  [inspect.custom](): string {
    return CREDENTIAL_PLACEHOLDER;
  }
}

function hold(value: string): Credential {
  const credential = new Credential();
  values.set(credential, value);
  return Object.freeze(credential);
}

export interface KeyLoaderOptions {
  /** The settings file. Default: `.omlx/settings.json` under the home directory. Tests pass their own. */
  readonly settingsPath?: string;
}

/** The default place of the oMLX settings file. A path, never content. */
export function defaultOmlxSettingsPath(): string {
  return join(homedir(), '.omlx', 'settings.json');
}

/**
 * Loads the credential a reference points at. `null` when the store holds an empty key (a server
 * without authentication). Throws `CREDENTIAL_REF_UNSUPPORTED` for any other store or member and
 * `CREDENTIAL_UNAVAILABLE` when the file cannot be read or parsed.
 */
export function loadCredential(ref: string, options: KeyLoaderOptions = {}): Credential | null {
  if (ref !== OMLX_CREDENTIAL_REF) {
    throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_REF_UNSUPPORTED, 'the credential reference is not one this transcriber reads', {
      supported: OMLX_CREDENTIAL_REF,
    });
  }
  const path = options.settingsPath ?? defaultOmlxSettingsPath();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    // The cause is reduced to its code: a JSON syntax error quotes the text around the fault.
    const reason = error instanceof SyntaxError ? 'NOT_JSON' : ((error as NodeJS.ErrnoException).code ?? 'UNREADABLE');
    throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'the referenced credential store could not be read', { ref, reason });
  }
  const auth = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>)['auth'] : undefined;
  const value = typeof auth === 'object' && auth !== null ? (auth as Record<string, unknown>)['api_key'] : undefined;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'the referenced credential is not text', { ref, reason: 'NOT_TEXT' });
  }
  return hold(value);
}

/**
 * THE OPENER PATH (integration pass A; SEC35-14, D68(c)): a credential the Core stores `ENCRYPTED`.
 *
 * This workspace knows no credential store and imports none. The COMPOSITION that builds a probe
 * or an adapter states that the stored credential is an encrypted one by handing in an
 * `EncryptedCredentialSource`; its `open` is a function of the composition that returns the key
 * text (in the Core: the opener of the one credential store, over the sealed envelope it read).
 *
 *   - no `open`: `CREDENTIAL_UNAVAILABLE` (`NO_OPENER`) - nothing is opened, nothing is connected;
 *   - `open` throws: `CREDENTIAL_UNAVAILABLE` (`OPEN_FAILED`). The thrown value is NOT kept as a
 *     cause and its message is not read: only a `code` of the form of a code is passed on;
 *   - the text it returns goes straight into the opaque holder; it is never a member of anything.
 */
export type CredentialOpener = () => string;

export interface EncryptedCredentialSource {
  /** Absent: the composition has no opener, and the credential is unavailable. */
  readonly open?: CredentialOpener;
}

const CODE_FORM = /^[A-Z][A-Z0-9_]{0,63}$/;

/** Opens an `ENCRYPTED` credential through the opener handed in. Never null: an encrypted credential that opens to nothing is a fault. */
export function openCredential(source: EncryptedCredentialSource): Credential {
  const open = source.open;
  if (typeof open !== 'function') {
    throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'the stored credential is encrypted and no opener was handed in', { reason: 'NO_OPENER' });
  }
  let value: unknown;
  try {
    value = open();
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'the stored credential could not be opened', {
      reason: 'OPEN_FAILED',
      ...(typeof code === 'string' && CODE_FORM.test(code) ? { openerCode: code } : {}),
    });
  }
  if (typeof value !== 'string') throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'the opened credential is not text', { reason: 'NOT_TEXT' });
  if (value === '') throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'the opened credential is empty', { reason: 'EMPTY' });
  return hold(value);
}

/**
 * THE ONE WAY a backend or a probe gets its credential: by reference (the settings file), through
 * the opener (an encrypted one), or none. Both at once is refused: one request has one credential.
 */
export function credentialOf(config: { readonly credentialRef: string | null; readonly settingsPath: string | null }, encrypted?: EncryptedCredentialSource): Credential | null {
  if (encrypted !== undefined) {
    if (config.credentialRef !== null) {
      throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'a credential reference and an encrypted credential were both stated', { reason: 'AMBIGUOUS' });
    }
    return openCredential(encrypted);
  }
  return config.credentialRef === null ? null : loadCredential(config.credentialRef, config.settingsPath === null ? {} : { settingsPath: config.settingsPath });
}

/**
 * Ends the life of a holder: its text is forgotten, and it gives no header afterwards. The probe
 * calls it for an OPENED credential when its one request is over (request scope).
 */
export function releaseCredential(credential: Credential | null): void {
  if (credential !== null) values.delete(credential);
}

/** Holds a credential that did not come from a file (a test value). The same opacity applies. */
export function credentialFromValue(value: string): Credential {
  if (value === '') throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'an empty credential cannot be held', { reason: 'EMPTY' });
  return hold(value);
}

/**
 * The value of the `Authorization` header. THE ONLY FUNCTION THAT TURNS A CREDENTIAL INTO TEXT; its
 * only caller is `backends/omlx-http.ts` (static rule).
 */
export function bearerHeaderValue(credential: Credential): string {
  const value = values.get(credential);
  if (value === undefined) throw new TranscriberError(TranscriberErrorCode.CREDENTIAL_UNAVAILABLE, 'the credential holder is not one of this loader', { reason: 'FOREIGN' });
  return `Bearer ${value}`;
}

/** The forms one text takes on its way into a log line: as it is, inside a JSON text (once, twice), in a URL. */
function writtenForms(value: string): string[] {
  const once = JSON.stringify(value).slice(1, -1);
  const twice = JSON.stringify(once).slice(1, -1);
  const forms = [value, once, twice, encodeURIComponent(value), Buffer.from(value, 'utf8').toString('base64')];
  // Longest first, so that a longer form is not broken by the replacement of a shorter one inside it.
  return [...new Set(forms)].filter((form) => form !== '').sort((a, b) => b.length - a.length);
}

/**
 * Replaces every occurrence of the credential in `text`: as it is, AND as it is written inside a
 * JSON text (a `"`, a `\` or a non-ASCII character in a key becomes an escape there; navigator
 * finding N-10), URL-encoded, and as base64. The log-blanking rule uses it.
 */
export function scrubCredential(text: string, credential: Credential | null): string {
  if (credential === null) return text;
  const value = values.get(credential);
  if (value === undefined || value === '') return text;
  let out = text;
  for (const form of writtenForms(value)) out = out.split(form).join(CREDENTIAL_PLACEHOLDER);
  return out;
}
