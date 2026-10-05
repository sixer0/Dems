// Backend task W56: the pure rules of the auth layer in LIVE mode (`./live-auth-model.ts`): what
// an answer of operation 8 means for the single-use token (finding F72), what a rejected sign-in
// is for the Login screen (S1-1, LB-10), and which notice a session end gets (§6.5).
import { describe, expect, it } from '@jest/globals';
import type { CoreCallFailure } from '@dems/shared/client';
import { CoreRefusalError, LiveTransportError, SimNotFoundError, SimPermissionError, SimTransitionError } from '@dems/shared/live';
import type { LiveSessionEnd } from '@dems/shared/live/source';
import { SimErrorCode } from '@dems/shared/sim';
import type { CoreLinkInfo } from '@/runtime';
import { isSignInBlocked } from './auth-session';
import {
  authNotice,
  biometricPromptPlan,
  biometricTokenFate,
  errorOfCallFailure,
  expiryOf,
  isSignInBlockedBy,
  isTokenReuse,
  noticeOfSessionEnd,
  rejectedSignIn,
  signOutReasonOf,
} from './live-auth-model';

const transport = (reason: 'CORE_OFFLINE' | 'UNAVAILABLE', details: { status?: number | null; code?: string | null; retryAfterSeconds?: number | null } = {}) =>
  new LiveTransportError(reason, details);

describe('the single-use token after operation 8 (implementation/41 section 8.2, finding F72)', () => {
  it.each<[string, Parameters<typeof biometricTokenFate>[0], 'kept' | 'spent']>([
    ['200: used up (the next one came with the answer)', { result: { ok: true, operatorId: 'OPR-001', role: 'INVESTIGATOR', method: 'BIOMETRIC' } }, 'spent'],
    ['401 INVALID_CREDENTIALS: dead for good', { result: { ok: false, reason: 'INVALID_CREDENTIALS', attemptsRemaining: 4 } }, 'spent'],
    ['423 LOCKED: not looked at during the lock', { result: { ok: false, reason: 'LOCKED', lockedUntil: 1, retryInMs: 1 } }, 'kept'],
    ['429: a limit', { error: transport('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 30 }) }, 'kept'],
    ['429 by its code alone', { error: transport('UNAVAILABLE', { code: 'RATE_LIMITED' }) }, 'kept'],
    ['503 NOT_READY: the unit did not commit', { error: transport('CORE_OFFLINE', { status: 503, code: 'NOT_READY' }) }, 'kept'],
    ['no credential for the request: nothing was sent', { error: transport('CORE_OFFLINE', { code: 'CREDENTIALS_UNAVAILABLE' }) }, 'kept'],
    ['the credential did not come in time: nothing was sent', { error: transport('CORE_OFFLINE', { code: 'CREDENTIALS_TIMEOUT' }) }, 'kept'],
    ['401 NOT_SIGNED_IN: the request`s credential did not resolve', { error: new SimPermissionError('signInWithBiometric', '', SimErrorCode.NOT_SIGNED_IN) }, 'kept'],
    ['422: the body was refused before the token', { error: new SimTransitionError(null, 'signInWithBiometric', undefined, SimErrorCode.INVALID_INPUT) }, 'kept'],
    ['400 INVALID_JSON', { error: new CoreRefusalError('INVALID_JSON', { status: 400 }) }, 'kept'],
    ['403 DEVICE_NOT_PAIRED (`DEVICE_CREDENTIAL_REQUIRED`): refused before the token', { error: new CoreRefusalError('DEVICE_NOT_PAIRED', { status: 403 }) }, 'kept'],
    // Everything else is `spent`: the list of `kept` is closed.
    ['403 DEVICE_REVOKED: revoked with the device', { error: new CoreRefusalError('DEVICE_REVOKED', { status: 403 }) }, 'spent'],
    ['no answer', { error: transport('CORE_OFFLINE', { code: 'NETWORK' }) }, 'spent'],
    ['a time-out: the Core may have used it', { error: transport('CORE_OFFLINE', { code: 'TIMEOUT' }) }, 'spent'],
    ['the answer came and its data did not', { error: transport('CORE_OFFLINE', { code: 'SNAPSHOT_TIMEOUT' }) }, 'spent'],
    ['the source was stopped while the request was out', { error: transport('CORE_OFFLINE', { code: 'STOPPED' }) }, 'spent'],
    ['500', { error: transport('UNAVAILABLE', { status: 500, code: 'INTERNAL' }) }, 'spent'],
    ['a 503 that is not the Core`s NOT_READY (a gateway)', { error: transport('CORE_OFFLINE', { status: 503, code: 'NETWORK' }) }, 'spent'],
    ['an answer outside the contract', { error: transport('UNAVAILABLE', { status: 200, code: 'CONTRACT_VIOLATION' }) }, 'spent'],
    ['the storage port failed after the answer', { error: new CoreRefusalError('NOT_AVAILABLE') }, 'spent'],
    ['a refusal by a code nobody listed', { error: new CoreRefusalError('LOCKED', { status: 409 }) }, 'spent'],
    ['a 404, which operation 8 does not have', { error: new SimNotFoundError('session', 'x') }, 'spent'],
    ['a programming error', { error: new TypeError('x') }, 'spent'],
    ['something that is no error', { error: 'x' }, 'spent'],
    ['nothing', { error: undefined }, 'spent'],
  ])('%s', (_label, settled, fate) => {
    expect(biometricTokenFate(settled)).toBe(fate);
  });
});

describe('a rejected sign-in for the Login screen (S1-1, LB-10)', () => {
  it('an outage is CORE_OFFLINE without a toast: the Login screen has its own offline state', () => {
    for (const code of ['NETWORK', 'TIMEOUT', 'SNAPSHOT_TIMEOUT', null]) {
      const rejection = rejectedSignIn(transport('CORE_OFFLINE', { code }));
      expect(rejection.result).toEqual({ ok: false, reason: 'CORE_OFFLINE' });
      expect(rejection.toast).toBe(false);
      expect(rejection.presentation?.outage).toBe(true);
    }
  });

  it('a 429 is UNAVAILABLE with the limit toast and its seconds: never an outage, never a wrong password', () => {
    const rejection = rejectedSignIn(transport('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 12.2 }));
    expect(rejection.result).toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(rejection.toast).toBe(true);
    expect(rejection.presentation).toMatchObject({ kind: 'LIMIT', outage: false, retryAfterSeconds: 13 });
  });

  it.each<[string, unknown, string, boolean]>([
    ['500', transport('UNAVAILABLE', { status: 500 }), 'FAILED', true],
    ['no credential for the request', transport('CORE_OFFLINE', { code: 'CREDENTIALS_UNAVAILABLE' }), 'CREDENTIALS', true],
    ['the tablet`s storage failed', new CoreRefusalError('NOT_AVAILABLE'), 'NOT_AVAILABLE', true],
    ['403 DEVICE_NOT_PAIRED: an ordinary refused action', new CoreRefusalError('DEVICE_NOT_PAIRED', { status: 403 }), 'REFUSED', true],
    ['401 NOT_SIGNED_IN: no "you are signed out" on a login screen', new SimPermissionError('signIn', '', SimErrorCode.NOT_SIGNED_IN), 'SIGNED_OUT', false],
    ['the source was stopped', transport('CORE_OFFLINE', { code: 'STOPPED' }), 'STOPPED', false],
  ])('%s is UNAVAILABLE', (_label, error, kind, toast) => {
    const rejection = rejectedSignIn(error);
    expect(rejection.result).toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(rejection.presentation?.kind).toBe(kind);
    expect(rejection.toast).toBe(toast);
  });

  it('an error that is not the Core`s is UNAVAILABLE, without a presentation and without a toast', () => {
    expect(rejectedSignIn(new TypeError('x'))).toEqual({ result: { ok: false, reason: 'UNAVAILABLE' }, presentation: null, toast: false });
  });

  it('an answer of `live.client.call` becomes the error class the Live source would build, without its message', () => {
    const base = { ok: false as const, operationId: 'setBiometricEnrollment', kind: 'RATE_LIMITED' as const, requestId: 'r-1' };
    const limit = errorOfCallFailure({ ...base, status: 429, error: { code: 'RATE_LIMITED', message: 'MARKER-TEXT' }, retryAfterSeconds: 9, transport: 'UNAVAILABLE' } as CoreCallFailure);
    expect(limit).toBeInstanceOf(LiveTransportError);
    expect(limit).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 9, requestId: 'r-1' });
    const refused = errorOfCallFailure({ ...base, kind: 'FORBIDDEN', status: 403, error: { code: 'DEVICE_NOT_PAIRED', message: 'MARKER-TEXT' }, retryAfterSeconds: null, transport: null } as CoreCallFailure);
    expect(refused).toBeInstanceOf(CoreRefusalError);
    expect(refused).toMatchObject({ code: 'DEVICE_NOT_PAIRED', status: 403, requestId: 'r-1' });
    expect(`${limit.message} ${refused.message}`).not.toContain('MARKER-TEXT');
  });
});

describe('the sign-in block (§9.5)', () => {
  const links: readonly { readonly link: CoreLinkInfo; readonly blocked: boolean }[] = [
    { link: { source: 'SIMULATED', state: 'ONLINE' }, blocked: false },
    { link: { source: 'SIMULATED', state: 'OFFLINE' }, blocked: false },
    { link: { source: 'HEARTBEAT', state: 'ONLINE' }, blocked: false },
    { link: { source: 'HEARTBEAT', state: 'OFFLINE' }, blocked: true },
    { link: { source: 'LIVE', state: 'ONLINE' }, blocked: false },
    { link: { source: 'LIVE', state: 'OFFLINE' }, blocked: true },
  ];
  it.each(links)('$link.source with the Core $link.state → blocked $blocked', ({ link, blocked }) => {
    expect(isSignInBlockedBy(link)).toBe(blocked);
    expect(isSignInBlocked(link)).toBe(blocked);
  });
});

describe('why the session ended (§6.5)', () => {
  const end = (over: Partial<LiveSessionEnd>): LiveSessionEnd => ({
    kind: 'SESSION_ENDED',
    reason: null,
    source: 'CONTROL',
    signOut: null,
    wasSignedIn: true,
    sessionState: null,
    helloReason: null,
    principal: 'OPERATOR',
    at: 0,
    ...over,
  });

  it.each<[string, LiveSessionEnd | null, string | null, string | null, string | null]>([
    ['nothing ended', null, null, null, null],
    ['Lock console, answered', end({ reason: 'SIGNED_OUT', source: 'SIGN_OUT', signOut: 'LOCK' }), 'LOCK', null, null],
    ['Lock console with the link down (DR-11)', end({ reason: 'SIGNED_OUT', source: 'LOCAL', signOut: 'LOCK' }), 'LOCK', null, null],
    ['Sign out', end({ reason: 'SIGNED_OUT', source: 'SIGN_OUT', signOut: 'USER' }), 'USER', null, null],
    ['the Core ended it as a sign-out', end({ reason: 'SIGNED_OUT' }), 'USER', null, null],
    ['idle, said by the Core', end({ reason: 'IDLE_EXPIRED' }), 'IDLE', null, 'IDLE'],
    ['idle, reckoned here while the Core could not be asked', end({ reason: 'IDLE_EXPIRED', source: 'LOCAL' }), 'IDLE', null, 'IDLE'],
    ['the 8-hour limit', end({ reason: 'ABSOLUTE_EXPIRED' }), null, 'absolute-expired', 'ABSOLUTE'],
    ['a disabled account', end({ reason: 'USER_DISABLED' }), null, 'user-disabled', null],
    ['a reused biometric token', end({ reason: 'TOKEN_REUSE' }), null, 'token-reuse', null],
    ['an invalid credential (no notice, §6.5 last row)', end({ reason: null, source: 'CLOSE' }), null, null, null],
    ['only the socket`s credential was refused: nobody was signed in', end({ reason: 'IDLE_EXPIRED', wasSignedIn: false }), null, null, null],
    ['the pairing ended: the Pair screen`s, not the Login screen`s', end({ kind: 'DEVICE_REVOKED', reason: 'REVOKED' }), null, null, null],
    ['the tablet unpaired itself: still the Pair screen`s, whatever else the end carries', end({ kind: 'DEVICE_REVOKED', reason: 'UNPAIRED', source: 'UNPAIR', signOut: 'USER' }), null, null, null],
  ])('%s', (_label, ended, lastSignOut, notice, expiry) => {
    expect(signOutReasonOf(ended)).toBe(lastSignOut);
    expect(noticeOfSessionEnd(ended)?.kind ?? null).toBe(notice);
    expect(expiryOf(ended)).toBe(expiry);
  });

  it('a reuse is told by its reason, whoever was signed in', () => {
    expect(isTokenReuse(end({ reason: 'TOKEN_REUSE' }))).toBe(true);
    expect(isTokenReuse(end({ reason: 'USER_DISABLED' }))).toBe(false);
    expect(isTokenReuse(end({ kind: 'DEVICE_REVOKED', reason: 'REVOKED' }))).toBe(false);
  });

  it('a notice is one stable object with its sentence and its status', () => {
    expect(authNotice('token-reuse')).toBe(authNotice('token-reuse'));
    expect(noticeOfSessionEnd(end({ reason: 'TOKEN_REUSE' }))).toBe(authNotice('token-reuse'));
    expect(authNotice('token-reuse')).toEqual({ kind: 'token-reuse', textKey: 'features.auth.notice.tokenReuse', status: 'danger' });
    expect(authNotice('biometric-invalid')).toMatchObject({ textKey: 'features.auth.notice.biometricInvalid', status: 'danger' });
    expect(authNotice('user-disabled')).toMatchObject({ textKey: 'features.auth.notice.userDisabled', status: 'danger' });
    expect(authNotice('absolute-expired')).toMatchObject({ textKey: 'features.auth.notice.absoluteExpired', status: 'accent' });
  });
});

describe('which check the operator sees (MB-5)', () => {
  it.each<[boolean, boolean, string]>([
    [true, true, 'read-is-prompt'],
    [true, false, 'os-prompt-first'],
    [false, true, 'os-prompt-first'],
    [false, false, 'os-prompt-first'],
  ])('protected %s on a physical device %s → %s', (protectedItem, isDevice, plan) => {
    expect(biometricPromptPlan(protectedItem, isDevice)).toBe(plan);
  });
});
