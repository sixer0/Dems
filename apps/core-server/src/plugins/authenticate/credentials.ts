/**
 * Which credential a request presents (plan row W24; spec §4.1, §5.2 ID-12, ID-13; SR-73;
 * decision D69, ruling D34-6 b). Pure: it reads the parsed cookies and one header, nothing else.
 *
 * A request presents AT MOST ONE credential:
 *
 *   this instance's cookie   `dems_session_<listen port>`: a web console's session token;
 *   `Authorization`          `Bearer ses_…` (a device's session token) or `Bearer dvc_…` (a
 *                            device credential).
 *
 * ONLY THIS INSTANCE'S COOKIE NAME COUNTS. Cookies are scoped by host, not by port: one browser
 * profile, and the cookie store of a mobile app's socket, send every cookie they hold for
 * 127.0.0.1. Another instance's `dems_session_<other port>` and any foreign cookie are therefore
 * neither a credential nor a conflict; they are not read at all. This is the same presence rule
 * the Origin guard applies at stage 3 (`plugins/origin-guard`), so both stages see one request
 * alike.
 *
 * Presence, not validity, makes the conflict (ID-12): this instance's cookie together with an
 * `Authorization` header is refused whatever either one holds. `bio_` values never travel in a
 * header (spec §5.6); a header that carries one, another scheme or anything else resolves to
 * nothing.
 *
 * A value is looked up only when it has the exact form of its kind (`api/patterns.ts`), so a
 * made-up value costs no query.
 */
import { DEVICE_CREDENTIAL_PATTERN, SESSION_TOKEN_PATTERN } from '@dems/shared/api';

export type PresentedCredential =
  /** Neither this instance's cookie nor an `Authorization` header. */
  | { readonly kind: 'NONE' }
  /** Both: refused at stage 4, nothing is resolved (ID-12). */
  | { readonly kind: 'CONFLICT' }
  /** This instance's cookie. `token` is null when its value has not the form of a session token. */
  | { readonly kind: 'COOKIE'; readonly token: string | null }
  /** `Authorization: Bearer ses_…`. */
  | { readonly kind: 'BEARER_SESSION'; readonly token: string }
  /** `Authorization: Bearer dvc_…`. */
  | { readonly kind: 'BEARER_DEVICE'; readonly credential: string }
  /** An `Authorization` header that carries neither form: it resolves to nothing. */
  | { readonly kind: 'BEARER_OTHER' };

/** The scheme is case-insensitive (RFC 9110 §11.1); the value is one run without white space. */
const BEARER = /^Bearer +([^\s]+)$/i;

/** The value of a `Bearer` header, or null for another scheme, an empty value or a repeated header. */
export function bearerValueOf(authorization: string | readonly string[] | undefined): string | null {
  if (typeof authorization !== 'string') return null;
  return BEARER.exec(authorization)?.[1] ?? null;
}

export function readCredential(
  cookies: Readonly<Record<string, string | undefined>>,
  authorization: string | readonly string[] | undefined,
  cookieName: string,
): PresentedCredential {
  // Presence, exactly as stage 3 reads it: this one name, whatever else the cookie header holds.
  const cookie = cookies[cookieName];
  const hasCookie = cookie !== undefined;
  const hasAuthorization = authorization !== undefined;
  if (hasCookie && hasAuthorization) return { kind: 'CONFLICT' };
  if (hasCookie) return { kind: 'COOKIE', token: SESSION_TOKEN_PATTERN.test(cookie) ? cookie : null };
  if (!hasAuthorization) return { kind: 'NONE' };
  const value = bearerValueOf(authorization);
  if (value === null) return { kind: 'BEARER_OTHER' };
  if (SESSION_TOKEN_PATTERN.test(value)) return { kind: 'BEARER_SESSION', token: value };
  if (DEVICE_CREDENTIAL_PATTERN.test(value)) return { kind: 'BEARER_DEVICE', credential: value };
  return { kind: 'BEARER_OTHER' };
}
