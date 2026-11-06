/**
 * The rules of the auth layer in LIVE mode, as pure functions (backend task W56;
 * 04_client_integration_spec §6.5, §8.5 S1-1, §9.2, §9.3; the biometric token's own rules:
 * implementation/41 section 8.2, finding F72).
 *
 * Nothing here calls the Core, a storage or React. It imports the light Live API (the error
 * classes) and types only, so it is part of every build; the storage of the token is
 * `./live-biometric.ts`, which a debug build alone loads.
 */
import type { CoreCallFailure } from '@dems/shared/client';
import { CoreRefusalError, LiveTransportError, SimPermissionError, SimTransitionError } from '@dems/shared/live';
import type { LiveSessionEnd } from '@dems/shared/live/source';
import type { SignInResult as SimSignInResult } from '@dems/shared/sim';
import { describeCoreError, type CoreErrorPresentation, type CoreLinkInfo, type SignInResult, type SignOutReason } from '@/runtime';

// ---------------------------------------------------------------------------------------------
// The sign-in block
// ---------------------------------------------------------------------------------------------

/**
 * §9.5 "Sign-in block": any source other than SIMULATED with the Core OFFLINE. HEARTBEAT as
 * before (04 §4.1 L6); LIVE: the link is ONLINE or OFFLINE, so "blocked while it is not ONLINE".
 */
export function isSignInBlockedBy(link: CoreLinkInfo): boolean {
  return link.source !== 'SIMULATED' && link.state === 'OFFLINE';
}

// ---------------------------------------------------------------------------------------------
// Why the last session ended (§6.5): the Login notice, the dialog, the Alert
// ---------------------------------------------------------------------------------------------

/** The Alerts the auth layer hands the Login screen in LIVE mode, beyond the three existing notices. */
export type AuthNoticeKind =
  /** §6.5: the Core ended the session because its biometric token was used a second time. */
  | 'token-reuse'
  /** MB-3, MB-6a: the stored token can never sign in again; both items are deleted. */
  | 'biometric-invalid'
  /** §6.4: an administrator disabled the account. */
  | 'user-disabled'
  /** WS-14: the session reached its 8-hour limit. */
  | 'absolute-expired';

export interface AuthNotice {
  readonly kind: AuthNoticeKind;
  /** The i18n key of the Alert's one sentence (`features.auth.notice.*`). */
  readonly textKey: string;
  /** The kit Alert status, by the Login screen's rule: an expiry is `accent`, a refusal `danger`. */
  readonly status: 'danger' | 'accent';
}

const NOTICES: Readonly<Record<AuthNoticeKind, AuthNotice>> = {
  'token-reuse': { kind: 'token-reuse', textKey: 'features.auth.notice.tokenReuse', status: 'danger' },
  'biometric-invalid': { kind: 'biometric-invalid', textKey: 'features.auth.notice.biometricInvalid', status: 'danger' },
  'user-disabled': { kind: 'user-disabled', textKey: 'features.auth.notice.userDisabled', status: 'danger' },
  'absolute-expired': { kind: 'absolute-expired', textKey: 'features.auth.notice.absoluteExpired', status: 'accent' },
};

/** The same object for the same kind, so a value built from it is stable between renders. */
export function authNotice(kind: AuthNoticeKind): AuthNotice {
  return NOTICES[kind];
}

/** An end of the operator's own session on this tablet; never the end of the pairing (the Pair screen's). */
function endedSession(end: LiveSessionEnd | null): LiveSessionEnd | null {
  return end !== null && end.kind === 'SESSION_ENDED' && end.wasSignedIn ? end : null;
}

/**
 * The existing Login notice of a session end (`lastSignOut`): "Console locked", "You have been
 * signed out", "Your session expired after 15 minutes". Read from why the session ended, not from
 * the outcome of the sign-out action (the Live source's brief list, row 16). `null`: no such
 * notice (an Alert of `noticeOfSessionEnd` says it, or the end has none, §6.5 last row).
 */
export function signOutReasonOf(end: LiveSessionEnd | null): SignOutReason | null {
  const session = endedSession(end);
  if (session === null) return null;
  if (session.signOut === 'LOCK') return 'LOCK';
  if (session.signOut === 'USER') return 'USER';
  if (session.reason === 'IDLE_EXPIRED') return 'IDLE';
  // The Core ended it as a sign-out (the operator signed out elsewhere, or a debt was paid).
  if (session.reason === 'SIGNED_OUT') return 'USER';
  return null;
}

/** The Alert of a session end that the three existing notices cannot say (§6.4, §6.5, WS-14). */
export function noticeOfSessionEnd(end: LiveSessionEnd | null): AuthNotice | null {
  switch (endedSession(end)?.reason) {
    case 'TOKEN_REUSE':
      return authNotice('token-reuse');
    case 'USER_DISABLED':
      return authNotice('user-disabled');
    case 'ABSOLUTE_EXPIRED':
      return authNotice('absolute-expired');
    default:
      return null;
  }
}

/** Which expiry ended the session, for the global "Session expired" dialog; `null` for any other end. */
export function expiryOf(end: LiveSessionEnd | null): 'IDLE' | 'ABSOLUTE' | null {
  const reason = endedSession(end)?.reason;
  return reason === 'IDLE_EXPIRED' ? 'IDLE' : reason === 'ABSOLUTE_EXPIRED' ? 'ABSOLUTE' : null;
}

/** §6.5: the Core says the session's biometric token was used a second time. The stored items go. */
export function isTokenReuse(end: LiveSessionEnd): boolean {
  return end.kind === 'SESSION_ENDED' && end.reason === 'TOKEN_REUSE';
}

// ---------------------------------------------------------------------------------------------
// A sign-in the Core did not accept (S1-1)
// ---------------------------------------------------------------------------------------------

export interface SignInRejection {
  /** The contract's result: `CORE_OFFLINE` for an outage, `UNAVAILABLE` for anything else. */
  readonly result: Extract<SignInResult, { ok: false }>;
  /** What the presenter would show; `null` when the error is not one of the Core's. */
  readonly presentation: CoreErrorPresentation | null;
  /** Whether the auth layer shows the presenter's toast (LB-10, and the refusals a login screen has no state for). */
  readonly toast: boolean;
}

/**
 * S1-1: what a rejected sign-in action is for the Login screen.
 *
 * | The action rejected with | Result | Toast |
 * |--------------------------|--------|-------|
 * | No answer, a time-out, a sign-in whose data did not arrive (`outage`) | `CORE_OFFLINE`: the Login screen's own "Core offline" state | none: one wording, the screen's |
 * | 429 (`LIMIT`) | `UNAVAILABLE` | the limit toast with the seconds of `retry-after` (LB-10): a limit is not a wrong password and not an outage |
 * | 5xx, a contract violation, no credential, a storage that failed, a refusal by code (`DEVICE_NOT_PAIRED`, ...) | `UNAVAILABLE` | the presenter's |
 * | 401 `NOT_SIGNED_IN` (the Core does not know this device's credential; the runtime asks operation 21) | `UNAVAILABLE` | none: "You are signed out" is no sentence for a login screen |
 * | `STOPPED` (the source was stopped), anything that is no error of the Core | `UNAVAILABLE` | none |
 */
export function rejectedSignIn(error: unknown): SignInRejection {
  const presentation = describeCoreError(error);
  if (presentation?.outage === true) return { result: { ok: false, reason: 'CORE_OFFLINE' }, presentation, toast: false };
  const silent = presentation === null || presentation.label === null || presentation.kind === 'SIGNED_OUT';
  return { result: { ok: false, reason: 'UNAVAILABLE' }, presentation, toast: !silent };
}

/**
 * The error class of an answer of `live.client.call` that is no success, so that one presenter
 * words a refused action and a refused call alike (operation 7 is no simulator action). The same
 * two classes the Live source builds: no usable answer, or a refusal by its envelope code. It
 * carries the status, the code, `retry-after` and the request ID; never the message or a body.
 */
export function errorOfCallFailure(failure: CoreCallFailure): LiveTransportError | CoreRefusalError {
  if (failure.transport !== null) {
    return new LiveTransportError(failure.transport, {
      status: failure.status,
      code: failure.error.code,
      retryAfterSeconds: failure.retryAfterSeconds,
      requestId: failure.requestId,
    });
  }
  return new CoreRefusalError(failure.error.code, { status: failure.status, requestId: failure.requestId });
}

// ---------------------------------------------------------------------------------------------
// The single-use biometric token: what an answer means for the token that was sent (F72)
// ---------------------------------------------------------------------------------------------

/**
 * `kept`: the Core did not look at the token, or nothing was sent: it is still the one for the
 * next time. `spent`: the Core used it, refused it for good, or may have used it (the answer is
 * not known): it is never sent again.
 */
export type BiometricTokenFate = 'kept' | 'spent';

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_NOT_READY = 503;
/** Envelope codes and the typed client's own words, as a `LiveTransportError` or a `CoreRefusalError` carries them. */
const CODE_RATE_LIMITED = 'RATE_LIMITED';
const CODE_NOT_READY = 'NOT_READY';
const CODE_DEVICE_NOT_PAIRED = 'DEVICE_NOT_PAIRED';
const NOTHING_SENT_CODES: readonly string[] = ['CREDENTIALS_UNAVAILABLE', 'CREDENTIALS_TIMEOUT'];

/**
 * What happened to a token that was handed to the Live source for operation 8, by what the
 * sign-in action then settled with (implementation/41 section 8.2). **The list of `kept` is
 * closed; everything else is `spent`.** A token is never presented twice (finding F72): after an
 * answer that got lost the Core may have used it, and a second presentation would be a reuse,
 * which revokes the family and ends the session of the lost answer. So "not known" costs the
 * enrolment here, on the tablet, and no second request is sent.
 *
 * | The action | The token | Fate |
 * |------------|-----------|------|
 * | resolved `ok` | Used up; the next one came with the answer and was stored before the action settled | `spent` |
 * | resolved `INVALID_CREDENTIALS` (401) | Dead for good, whatever the cause | `spent` |
 * | resolved `LOCKED` (423) | Not looked at during the lock; a refused one is dead and answers 401 next time | `kept` |
 * | rejected: 429 | Not looked at (stage 5), or refused | `kept` |
 * | rejected: 503 `NOT_READY` | Not used: the unit did not commit | `kept` |
 * | rejected: no credential for the request | Nothing was sent | `kept` |
 * | rejected: 401 `NOT_SIGNED_IN`; 403 `DEVICE_NOT_PAIRED`; 400, 422 | Not looked at: the request was refused before the token | `kept` |
 * | rejected: 403 `DEVICE_REVOKED` | Revoked with the device | `spent` |
 * | rejected: no answer, a time-out, another 5xx, an answer outside the contract, a stop, anything else | Not known | `spent` |
 */
export function biometricTokenFate(settled: { readonly result: SimSignInResult } | { readonly error: unknown }): BiometricTokenFate {
  if ('result' in settled) return !settled.result.ok && settled.result.reason === 'LOCKED' ? 'kept' : 'spent';
  const { error } = settled;
  if (error instanceof LiveTransportError) {
    if (error.status === HTTP_TOO_MANY_REQUESTS || error.code === CODE_RATE_LIMITED) return 'kept';
    if (error.status === HTTP_NOT_READY && error.code === CODE_NOT_READY) return 'kept';
    if (error.code !== null && NOTHING_SENT_CODES.includes(error.code)) return 'kept';
    return 'spent';
  }
  // 401 `NOT_SIGNED_IN`: the credential of the request did not resolve. A sign-in has no permission to lack.
  if (error instanceof SimPermissionError) return 'kept';
  // 422 (and a 409, which operation 8 does not have): the body was refused before the token was looked at.
  if (error instanceof SimTransitionError) return 'kept';
  if (error instanceof CoreRefusalError) {
    if (error.status === HTTP_BAD_REQUEST) return 'kept';
    if (error.status === HTTP_FORBIDDEN && error.code === CODE_DEVICE_NOT_PAIRED) return 'kept';
  }
  return 'spent';
}

/**
 * MB-5: which check the operator sees before the token leaves the storage. Exactly one.
 * - `os-prompt-first`: the existing `expo-local-authentication` prompt, then a read (cases b and c:
 *   an item without the authentication requirement, or an emulator).
 * - `read-is-prompt`: the protected read IS the prompt (case a: a physical device with a protected item).
 */
export type BiometricPromptPlan = 'os-prompt-first' | 'read-is-prompt';

export function biometricPromptPlan(protectedItem: boolean, isDevice: boolean): BiometricPromptPlan {
  return protectedItem && isDevice ? 'read-is-prompt' : 'os-prompt-first';
}
