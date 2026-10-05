// The parts of the biometric token that need no database (plan row W41; spec §5.1 ID-P11, §5.6;
// SR-36, SR-37; database contract §5.1): the token and its hash, what a failed claim is refused
// for, what a refused enrolment answers, and the rows.
//
// The values built here are made-up examples of a FORM, from one repeated letter or from a
// counting random source; none is a token any server issued.
import { createHash } from 'node:crypto';
import { ApiErrorSchema, BIOMETRIC_TOKEN_PATTERN, DEVICE_CREDENTIAL_PATTERN, SESSION_TOKEN_PATTERN } from '@dems/shared/api';
import { describe, expect, it, vi } from 'vitest';
import { AUDIT_DETAIL_FORBIDDEN_KEYS } from '../../../../db/schema/value-sets';
import { detailRulesOf, looksLikeSecret } from '../../../../core';
import type { ApiFailure } from '../../../../plugins/error-envelope';
import { TokenRefusalReason, enrolmentChanged, failureReported, lockedOut, tokenRefused, tokenSignedIn } from '../activity';
import { enrolmentRefusal, notADeviceSession, passwordSessionRequired } from '../enrolment';
import { refusalOfToken, tokenNotAccepted } from '../sign-in';
import type { EnrolmentSession, TokenState } from '../store';
import {
  BIOMETRIC_TOKEN_BYTES,
  BIOMETRIC_TOKEN_LIFETIME_MS,
  BIOMETRIC_TOKEN_PREFIX,
  biometricTokenHash,
  newBiometricToken,
  newFamilyId,
} from '../tokens';

const NOW = Date.UTC(2031, 0, 1);

describe('the token (SR-36): 256 bits of the platform\'s random source in the contract\'s form', () => {
  it('is `bio_` and 43 base64url characters: 47 in all, the form of the contract and of no other credential', () => {
    const token = newBiometricToken();
    expect(token).toHaveLength(47);
    expect(BIOMETRIC_TOKEN_PATTERN.test(token)).toBe(true);
    expect(SESSION_TOKEN_PATTERN.test(token)).toBe(false);
    expect(DEVICE_CREDENTIAL_PATTERN.test(token)).toBe(false);
    expect(token.startsWith(BIOMETRIC_TOKEN_PREFIX)).toBe(true);
  });

  it('asks its random source for 32 bytes, once, and is those bytes: nothing else goes into it', () => {
    const random = vi.fn((size: number) => Buffer.alloc(size, 0xab));
    const token = newBiometricToken(random);
    expect(random).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledWith(32);
    expect(BIOMETRIC_TOKEN_BYTES).toBe(32);
    expect(Buffer.from(token.slice(4), 'base64url')).toEqual(Buffer.alloc(32, 0xab));
  });

  it('two thousand tokens and two thousand families are all different', () => {
    expect(new Set(Array.from({ length: 2_000 }, () => newBiometricToken())).size).toBe(2_000);
    const families = Array.from({ length: 2_000 }, () => newFamilyId());
    expect(new Set(families).size).toBe(2_000);
    for (const family of families.slice(0, 50)) expect(family).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('is stored as the SHA-256 of the WHOLE value, prefix included: 32 bytes', () => {
    const token = `bio_${'A'.repeat(43)}`;
    const hash = biometricTokenHash(token);
    expect(hash).toHaveLength(32);
    expect(hash.equals(createHash('sha256').update(token, 'utf8').digest())).toBe(true);
    expect(hash.equals(createHash('sha256').update(token.slice(4), 'utf8').digest())).toBe(false);
    // Whatever was sent is hashed, of the form or not: every attempt does the same work.
    for (const value of ['x', 'not a token', `ses_${'A'.repeat(43)}`, 'é'.repeat(256)]) expect(biometricTokenHash(value)).toHaveLength(32);
    expect(biometricTokenHash('a').equals(biometricTokenHash('b'))).toBe(false);
  });

  it('ID-P11: 30 days', () => {
    expect(BIOMETRIC_TOKEN_LIFETIME_MS).toBe(2_592_000_000);
  });
});

describe('what a failed claim is refused for (spec §5.6 step 6; database contract §5.2)', () => {
  const stored = (over: Partial<TokenState> = {}): TokenState => ({
    id: 'token-row',
    familyId: 'family-1',
    deviceId: 'DEV-0001',
    operatorId: 'OPR-001',
    usedAt: null,
    revokedAt: null,
    revokeReason: null,
    expiresAt: NOW + 1_000,
    ...over,
  });
  const reused = { familyId: 'family-1', deviceId: 'DEV-0001', operatorId: 'OPR-001' };

  it('no stored token: nobody is named, no reason', () => {
    expect(refusalOfToken(null, 'DEV-0001', NOW)).toEqual({ operatorId: null, reason: null, reused: null });
  });

  it('a token that was used before is a REUSE, whoever presents it and whatever else is true of it', () => {
    const expected = { operatorId: 'OPR-001', reason: 'TOKEN_REUSE', reused };
    expect(refusalOfToken(stored({ usedAt: NOW - 5 }), 'DEV-0001', NOW)).toEqual(expected);
    // Presented by another device: the family, the device and the operator are the TOKEN's.
    expect(refusalOfToken(stored({ usedAt: NOW - 5 }), 'DEV-0002', NOW)).toEqual(expected);
    expect(refusalOfToken(stored({ usedAt: NOW - 5, revokedAt: NOW - 1, revokeReason: 'TOKEN_REUSE' }), 'DEV-0001', NOW)).toEqual(expected);
    expect(refusalOfToken(stored({ usedAt: NOW - 5, revokedAt: NOW - 1, revokeReason: 'USER_DISABLED' }), 'DEV-0001', NOW)).toEqual(expected);
    expect(refusalOfToken(stored({ usedAt: NOW - 5, expiresAt: NOW - 1 }), 'DEV-0001', NOW)).toEqual(expected);
    // Used at the very instant of the question (the concurrent use) is used.
    expect(refusalOfToken(stored({ usedAt: NOW }), 'DEV-0001', NOW)).toEqual(expected);
    expect(refusalOfToken(stored({ usedAt: 0 }), 'DEV-0001', NOW)).toEqual(expected);
  });

  it('a LIVE token that another device presents is the same REUSE: the family, the device and the operator are the TOKEN\'s (CPS1-7)', () => {
    const expected = { operatorId: 'OPR-001', reason: 'TOKEN_REUSE', reused };
    expect(refusalOfToken(stored(), 'DEV-0002', NOW)).toEqual(expected);
    // Live to its last millisecond: `expires_at > now` is what the claim states.
    expect(refusalOfToken(stored({ expiresAt: NOW + 1 }), 'DEV-0002', NOW)).toEqual(expected);
    // Whoever the other device is; the token's own device is never named by the request.
    expect(refusalOfToken(stored({ deviceId: 'DEV-0007' }), 'DEV-0001', NOW)).toEqual({ ...expected, reused: { ...reused, deviceId: 'DEV-0007' } });
  });

  it('an unused token that is no longer live: another device, then revoked, then expired; each names the token\'s operator and changes nothing', () => {
    const named = (reason: string | null): unknown => ({ operatorId: 'OPR-001', reason, reused: null });
    // Another device comes first: a revoked or an expired token of another device is that. It is
    // dead already, so there is nothing to revoke and no session of its family to end.
    expect(refusalOfToken(stored({ revokedAt: NOW, revokeReason: 'DISABLED', expiresAt: NOW - 1 }), 'DEV-0002', NOW)).toEqual(named('OTHER_DEVICE'));
    for (const revokeReason of ['DISABLED', 'REENROLLED', 'TOKEN_REUSE', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED', 'USER_DISABLED'] as const) {
      expect(refusalOfToken(stored({ revokedAt: NOW - 1, revokeReason }), 'DEV-0002', NOW), revokeReason).toEqual(named('OTHER_DEVICE'));
    }
    // The limit itself is past, on another device as on its own.
    expect(refusalOfToken(stored({ expiresAt: NOW }), 'DEV-0002', NOW)).toEqual(named('OTHER_DEVICE'));
    expect(refusalOfToken(stored({ expiresAt: NOW - 1 }), 'DEV-0002', NOW)).toEqual(named('OTHER_DEVICE'));
    expect(refusalOfToken(stored({ revokedAt: NOW - 1, revokeReason: 'USER_DISABLED' }), 'DEV-0001', NOW)).toEqual(named('USER_DISABLED'));
    for (const revokeReason of ['DISABLED', 'REENROLLED', 'TOKEN_REUSE', 'DEVICE_REVOKED', 'DEVICE_UNPAIRED'] as const) {
      expect(refusalOfToken(stored({ revokedAt: NOW - 1, revokeReason }), 'DEV-0001', NOW), revokeReason).toEqual(named('TOKEN_REVOKED'));
    }
    // Revoked comes before expired.
    expect(refusalOfToken(stored({ revokedAt: NOW - 1, revokeReason: 'DISABLED', expiresAt: NOW - 1 }), 'DEV-0001', NOW)).toEqual(named('TOKEN_REVOKED'));
    // The limit itself is past: `expires_at > now` is what the claim states.
    expect(refusalOfToken(stored({ expiresAt: NOW }), 'DEV-0001', NOW)).toEqual(named('TOKEN_EXPIRED'));
    expect(refusalOfToken(stored({ expiresAt: NOW - 1 }), 'DEV-0001', NOW)).toEqual(named('TOKEN_EXPIRED'));
  });

  it('a token that looks usable and was not claimed is still no use: named, without a reason', () => {
    expect(refusalOfToken(stored({ expiresAt: NOW + 1 }), 'DEV-0001', NOW)).toEqual({ operatorId: 'OPR-001', reason: null, reused: null });
  });

  it('the reasons are a closed set of six codes', () => {
    expect(Object.values(TokenRefusalReason).sort()).toEqual(['DEVICE_NOT_PAIRED', 'OTHER_DEVICE', 'TOKEN_EXPIRED', 'TOKEN_REUSE', 'TOKEN_REVOKED', 'USER_DISABLED']);
  });
});

describe('what a refused enrolment answers', () => {
  const session = (over: Partial<EnrolmentSession> = {}): EnrolmentSession => ({ open: true, method: 'PASSWORD', operatorEnabled: true, deviceState: 'PAIRED', ...over });
  const answer = (failure: ApiFailure): [number, string, unknown] => [failure.statusCode, failure.code, failure.details ?? null];

  it('no session, an ended session, a disabled operator: 401 NOT_SIGNED_IN, whatever else holds', () => {
    expect(answer(enrolmentRefusal(null))).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(answer(enrolmentRefusal(session({ open: false })))).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(answer(enrolmentRefusal(session({ open: false, method: 'BIOMETRIC', deviceState: 'REVOKED' })))).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(answer(enrolmentRefusal(session({ operatorEnabled: false })))).toEqual([401, 'NOT_SIGNED_IN', null]);
    expect(answer(enrolmentRefusal(session({ operatorEnabled: false, method: 'BIOMETRIC' })))).toEqual([401, 'NOT_SIGNED_IN', null]);
  });

  it('a session without a device: 403 DEVICE_NOT_PAIRED; a device that is not PAIRED: 403 DEVICE_REVOKED', () => {
    expect(answer(enrolmentRefusal(session({ deviceState: null })))).toEqual([403, 'DEVICE_NOT_PAIRED', null]);
    expect(enrolmentRefusal(session({ deviceState: null })).message).toBe(notADeviceSession().message);
    for (const deviceState of ['REVOKED', 'UNPAIRED'] as const) {
      expect(answer(enrolmentRefusal(session({ deviceState })))).toEqual([403, 'DEVICE_REVOKED', { reason: 'DEVICE_REVOKED' }]);
      expect(answer(enrolmentRefusal(session({ deviceState, method: 'BIOMETRIC' })))).toEqual([403, 'DEVICE_REVOKED', { reason: 'DEVICE_REVOKED' }]);
    }
  });

  it('a session that was created with a token: 403 DEVICE_NOT_PAIRED with details.reason PASSWORD_SESSION_REQUIRED, as the contract words it', () => {
    expect(answer(enrolmentRefusal(session({ method: 'BIOMETRIC' })))).toEqual([403, 'DEVICE_NOT_PAIRED', { reason: 'PASSWORD_SESSION_REQUIRED' }]);
    expect(passwordSessionRequired().message).toBe('Sign in with your password to turn biometric sign-in on.');
  });

  it('a session that fits every condition and still got no token: 401, never a token', () => {
    expect(answer(enrolmentRefusal(session()))).toEqual([401, 'NOT_SIGNED_IN', null]);
  });
});

describe('the answers of a refused token', () => {
  it('one text, one code, the attempts that remain, and nothing about why', () => {
    const failure = tokenNotAccepted(3);
    expect([failure.statusCode, failure.code, failure.message, failure.details]).toEqual([
      401,
      'INVALID_CREDENTIALS',
      'Biometric sign-in was not accepted. Sign in with the password.',
      { attemptsRemaining: 3 },
    ]);
    expect(ApiErrorSchema.safeParse({ error: { code: failure.code, message: failure.message, details: failure.details } }).success).toBe(true);
  });
});

describe('the rows (SR-54, ENG-12)', () => {
  const forbidden = new Set(AUDIT_DETAIL_FORBIDDEN_KEYS.map((key) => key.toLowerCase()));
  const clean = (entry: { message: string; details?: object; params?: object }): void => {
    const payload = entry.details ?? entry.params ?? {};
    for (const key of Object.keys(payload)) expect(forbidden.has(key.toLowerCase()), key).toBe(false);
    for (const text of [entry.message, ...Object.values(payload)]) if (typeof text === 'string') expect(looksLikeSecret(text)).toBe(false);
  };

  it('BIOMETRIC_ENROLLMENT_CHANGED: the operator, the device, enabled; exactly the keys the audit writer allows for the type; no event', () => {
    const on = enrolmentChanged({ operatorId: 'OPR-001', deviceId: 'DEV-0001', enabled: true });
    const off = enrolmentChanged({ operatorId: 'OPR-001', deviceId: 'DEV-0001', enabled: false });
    expect(on).toEqual({
      type: 'BIOMETRIC_ENROLLMENT_CHANGED',
      message: 'Biometric sign-in turned on (DEV-0001)',
      actorId: 'OPR-001',
      deviceId: 'DEV-0001',
      details: { enabled: true, deviceId: 'DEV-0001' },
    });
    expect(off).toMatchObject({ message: 'Biometric sign-in turned off (DEV-0001)', details: { enabled: false, deviceId: 'DEV-0001' } });
    expect(Object.keys(detailRulesOf('BIOMETRIC_ENROLLMENT_CHANGED') ?? {}).sort()).toEqual(['deviceId', 'enabled']);
    clean(on);
    clean(off);
  });

  it('a sign-in with a token: AUTH_SUCCESS and AUTH_LOGIN with the method, and never `replaced`: no session is presented with a biometric sign-in (decision D118)', () => {
    const plain = tokenSignedIn({ operatorId: 'OPR-001', displayName: 'AKP Budi Santoso', deviceId: 'DEV-0001' });
    expect(plain.audit).toEqual({
      type: 'AUTH_SUCCESS',
      message: 'Operator signed in (AKP Budi Santoso) via biometric',
      actorId: 'OPR-001',
      deviceId: 'DEV-0001',
      details: { method: 'BIOMETRIC' },
    });
    expect(plain.event).toMatchObject({ type: 'AUTH_LOGIN', params: { operatorId: 'OPR-001', method: 'BIOMETRIC' }, deviceId: 'DEV-0001' });
    // The builder takes no such member: a caller cannot make the row say that a session was replaced.
    expect(Object.keys(plain.audit.details ?? {})).toEqual(['method']);
    clean(plain.audit);
    clean(plain.event);
  });

  it('a refused token: AUTH_FAILED as a failed password attempt, with the reason and, for a reuse, what it ended', () => {
    const unknown = tokenRefused({ operatorId: null, deviceId: 'DEV-0001', attemptsRemaining: 4, lockedUntil: null, reason: null, sessionsEnded: null });
    expect(unknown.audit).toEqual({
      type: 'AUTH_FAILED',
      message: 'Sign-in failed: invalid credentials',
      severity: 'WARNING',
      actorId: null,
      deviceId: 'DEV-0001',
      details: { method: 'BIOMETRIC', knownOperator: false, attemptsRemaining: 4, lockedUntil: null },
    });
    expect(unknown.event).toMatchObject({ type: 'AUTH_FAILED', severity: 'WARNING', params: { attemptsRemaining: 4 }, deviceId: 'DEV-0001' });

    const reuse = tokenRefused({ operatorId: 'OPR-001', deviceId: 'DEV-0001', attemptsRemaining: 0, lockedUntil: NOW + 60_000, reason: 'TOKEN_REUSE', sessionsEnded: 2 });
    expect(reuse.audit).toMatchObject({
      actorId: 'OPR-001',
      message: 'Sign-in failed; console locked for 60 s',
      details: { method: 'BIOMETRIC', knownOperator: true, attemptsRemaining: 0, lockedUntil: NOW + 60_000, reason: 'TOKEN_REUSE', sessionsEnded: 2 },
    });
    // `sessionsEnded: 0` is said, not left out; a reason without sessions has no such member.
    expect(tokenRefused({ operatorId: 'OPR-001', deviceId: 'DEV-0001', attemptsRemaining: 3, lockedUntil: null, reason: 'TOKEN_REUSE', sessionsEnded: 0 }).audit.details).toMatchObject({ sessionsEnded: 0 });
    const expired = tokenRefused({ operatorId: 'OPR-001', deviceId: 'DEV-0001', attemptsRemaining: 3, lockedUntil: null, reason: 'TOKEN_EXPIRED', sessionsEnded: null });
    expect(Object.keys(expired.audit.details).sort()).toEqual(['attemptsRemaining', 'knownOperator', 'lockedUntil', 'method', 'reason']);
    for (const activity of [unknown, reuse, expired]) {
      clean(activity.audit);
      clean(activity.event);
    }
  });

  it('a reported failure and an attempt during the lock: the actor is what the caller of the builder decided, the device is the reporting one', () => {
    expect(failureReported({ operatorId: null, deviceId: 'DEV-0002', attemptsRemaining: 2, lockedUntil: null }).audit).toMatchObject({
      type: 'AUTH_FAILED',
      actorId: null,
      deviceId: 'DEV-0002',
      details: { method: 'BIOMETRIC', knownOperator: false, attemptsRemaining: 2, lockedUntil: null },
    });
    expect(failureReported({ operatorId: 'OPR-003', deviceId: 'DEV-0002', attemptsRemaining: 2, lockedUntil: null }).audit).toMatchObject({ actorId: 'OPR-003', details: { knownOperator: true } });
    const locked = lockedOut({ operatorId: null, deviceId: 'DEV-0002', lockedUntil: NOW + 60_000, retryInMs: 60_000 });
    expect(locked.audit).toEqual({
      type: 'AUTH_LOCKED',
      message: 'Sign-in rejected: console locked after repeated failures',
      severity: 'WARNING',
      actorId: null,
      deviceId: 'DEV-0002',
      details: { method: 'BIOMETRIC', retryInMs: 60_000, lockedUntil: NOW + 60_000 },
    });
    expect(locked.event).toMatchObject({ type: 'AUTH_LOCKED', params: { retryInMs: 60_000 }, deviceId: 'DEV-0002' });
  });
});
