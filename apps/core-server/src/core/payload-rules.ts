/**
 * The rules both writers apply to a row BEFORE a statement is sent (plan row W21; spec §13,
 * SR-54, ENG-12; database contract §2.4 `FLAT` and `NO_SECRET_KEYS`, §5.5, NL-1, NL-2).
 *
 * Why before: the database has CHECKs for the same things, but a row that a CHECK refuses is
 * written, whole, into the PostgreSQL server log (finding F-1 of the migration row). In normal
 * operation no row may get that far. The rules here are at least as strict as the CHECKs:
 *
 *   flat            a payload map is a plain object whose values are strings, finite numbers,
 *                   booleans or null (`types.ts:68-69`);
 *   no secret key   none of the 17 key names of `AUDIT_DETAIL_FORBIDDEN_KEYS`, the constant the
 *                   CHECK is built from;
 *   no secret form  no text of a row holds something that has the FORM of a credential: a
 *                   session token, a device credential, a biometric token or the QR payload of
 *                   a pairing code, as the contract's own patterns define them. The database
 *                   has no such rule; this one is the writers' alone;
 *   storable text   no U+0000 and no unpaired surrogate. PostgreSQL cannot store the first, and
 *                   the driver would replace the second, so the stored row would no longer hash
 *                   to its chain hash. The rule itself is the mapping module's
 *                   (`isStorableText`, `db/mapping/guards.ts`); it is applied here, early, so
 *                   that a batch is refused as a whole before its first row is sent.
 *
 * Two modes. A NATIVE row is built from an entry of a server-native module: its keys follow a
 * grammar, its texts are bounded, and a forbidden key name is refused in any letter case. A
 * PREPARED row was built by the engine with the shared code: it gets the rules above exactly as
 * the database states them and nothing stricter, so that the Live audit sequence stays the
 * simulator's.
 *
 * What these rules cannot see: a secret that has no recognisable form (a six-digit code, a
 * password) inside a free text. That stays the calling module's duty (SR-54) and the subject of
 * the dump and log-capture tests of the identity and pairing rows.
 */
import {
  BIOMETRIC_TOKEN_PATTERN,
  DEVICE_CREDENTIAL_PATTERN,
  PAIRING_QR_PAYLOAD_PATTERN,
  SESSION_TOKEN_PATTERN,
} from '@dems/shared/api';
import type { Details } from '@dems/shared/sim';
import { isStorableText } from '../db/mapping';
import { AUDIT_DETAIL_FORBIDDEN_KEYS } from '../db/schema';
import { CoreError, type CoreErrorCode } from './errors';
import { NATIVE_PAYLOAD_KEYS_MAX, NATIVE_TEXT_MAX_LENGTH, REFERENCE_MAX_LENGTH } from './limits';

export type RowOrigin = 'native' | 'prepared';

/** The codes one writer uses for the rules of this file. */
export interface PayloadCodes {
  readonly notFlat: CoreErrorCode;
  readonly keyForbidden: CoreErrorCode;
  readonly valueInvalid: CoreErrorCode;
  readonly textInvalid: CoreErrorCode;
  readonly secretShaped: CoreErrorCode;
  readonly messageInvalid: CoreErrorCode;
  readonly referenceInvalid: CoreErrorCode;
}

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(AUDIT_DETAIL_FORBIDDEN_KEYS);
const FORBIDDEN_KEYS_FOLDED: ReadonlySet<string> = new Set(AUDIT_DETAIL_FORBIDDEN_KEYS.map((key) => key.toLowerCase()));

/** A key of a native payload: a camelCase name, as every key of the shared code is. */
const NATIVE_KEY_PATTERN = /^[a-z][A-Za-z0-9]{0,47}$/;
/** A reference: an identifier of the shared formats or of the hardware; never free text. */
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/;

/** The same form without its anchors, so that it is found inside a longer text too. */
function anywhere(anchored: RegExp): RegExp {
  const { source } = anchored;
  if (!source.startsWith('^') || !source.endsWith('$')) throw new Error('a contract pattern is expected to be anchored');
  return new RegExp(source.slice(1, -1));
}

/** The forms of a credential that the contract defines (`api/patterns.ts`). */
const SECRET_FORMS: readonly RegExp[] = [
  SESSION_TOKEN_PATTERN,
  DEVICE_CREDENTIAL_PATTERN,
  BIOMETRIC_TOKEN_PATTERN,
  PAIRING_QR_PAYLOAD_PATTERN,
].map(anywhere);

/** True when `text` holds something that has the form of a credential. */
export function looksLikeSecret(text: string): boolean {
  return SECRET_FORMS.some((form) => form.test(text));
}

/** A text that can be stored unchanged and holds no credential form. */
function checkStoredText(text: string, codes: PayloadCodes): void {
  if (!isStorableText(text)) {
    throw new CoreError(codes.textInvalid, 'a text of the row holds U+0000 or an unpaired surrogate and cannot be stored unchanged');
  }
  if (looksLikeSecret(text)) {
    throw new CoreError(codes.secretShaped, 'a text of the row has the form of a credential; a row never holds one (SR-54)');
  }
}

/** The message of a row. */
export function checkMessage(message: unknown, origin: RowOrigin, codes: PayloadCodes): string {
  if (typeof message !== 'string' || (origin === 'native' && (message === '' || message.length > NATIVE_TEXT_MAX_LENGTH))) {
    throw new CoreError(codes.messageInvalid, `the message of a row is a text of 1 to ${NATIVE_TEXT_MAX_LENGTH} characters`);
  }
  checkStoredText(message, codes);
  return message;
}

/** A soft reference of a row (session, evidence, device): an identifier or null. */
export function checkReference(value: unknown, codes: PayloadCodes): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > REFERENCE_MAX_LENGTH || !REFERENCE_PATTERN.test(value)) {
    throw new CoreError(codes.referenceInvalid, `a reference of a row is an identifier of at most ${REFERENCE_MAX_LENGTH} characters, or null`);
  }
  checkStoredText(value, codes);
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * The payload map of a row: `details` of an audit row, `params` of an event.
 *
 * Returns the map to store. For a native row that is a copy without the members whose value is
 * `undefined` (the canonical form and JSON both drop them), so the row that is returned to the
 * caller equals the stored one. A prepared row is returned as it is: it is already hashed.
 */
export function checkPayload(payload: unknown, origin: RowOrigin, codes: PayloadCodes): Details {
  if (!isPlainObject(payload)) {
    throw new CoreError(codes.notFlat, 'the payload map of a row is a plain object of flat values');
  }
  const keys = Object.keys(payload);
  if (origin === 'native' && keys.length > NATIVE_PAYLOAD_KEYS_MAX) {
    throw new CoreError(codes.notFlat, `the payload map of a row holds at most ${NATIVE_PAYLOAD_KEYS_MAX} keys`);
  }
  const stored: Record<string, string | number | boolean | null> = {};
  for (const key of keys) {
    const value = payload[key];
    if (FORBIDDEN_KEYS.has(key) || (origin === 'native' && FORBIDDEN_KEYS_FOLDED.has(key.toLowerCase()))) {
      throw new CoreError(codes.keyForbidden, 'the payload map of a row holds a key that may name a secret (database contract NO_SECRET_KEYS)');
    }
    if (origin === 'native' && !NATIVE_KEY_PATTERN.test(key)) {
      throw new CoreError(codes.notFlat, 'a key of the payload map is not a camelCase name');
    }
    if (!isStorableText(key)) {
      throw new CoreError(codes.textInvalid, 'a key of the payload map cannot be stored unchanged');
    }
    if (value === undefined) continue;
    if (typeof value === 'string') {
      if (origin === 'native' && value.length > NATIVE_TEXT_MAX_LENGTH) {
        throw new CoreError(codes.valueInvalid, `a text of the payload map holds at most ${NATIVE_TEXT_MAX_LENGTH} characters`);
      }
      checkStoredText(value, codes);
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new CoreError(codes.valueInvalid, 'a number of the payload map is not finite');
    } else if (typeof value !== 'boolean' && value !== null) {
      throw new CoreError(codes.notFlat, 'a value of the payload map is not a string, a number, a boolean or null');
    }
    stored[key] = value;
  }
  return origin === 'native' ? stored : (payload as Details);
}
