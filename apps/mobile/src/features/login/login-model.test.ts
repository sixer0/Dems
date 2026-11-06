// Login view model and ambient maths (step 75; 04_mobile_specs §4.1, §6.1–§6.3, §7.3): the pure
// state table behind T-M04, the ring tone, the biometric button, the seeded dust and the beam.
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CORE_ADDRESS, formatCoreAddress, type CoreLinkInfo } from '@/runtime';
import { BEAM_LENGTH, DUST_COUNT, beamOpacity, beamWindows, dustPosition, dustSeeds } from './login-ambient.math';
import {
  alertStatusFor,
  biometricButtonFor,
  coreAddress,
  coreChipFor,
  isCoreBlocked,
  isSubmitDisabled,
  loginSchema,
  noticeFor,
  ringSizeFor,
  ringStateFor,
  splitAroundToken,
} from './login-model';
import { parsePresentationMode } from './presentation-mode';

const SIMULATED: CoreLinkInfo = { source: 'SIMULATED', state: 'ONLINE' };
const HB_LIVE: CoreLinkInfo = { source: 'HEARTBEAT', state: 'ONLINE', heartbeat: 'LIVE' };
const HB_STALE: CoreLinkInfo = { source: 'HEARTBEAT', state: 'OFFLINE', heartbeat: 'STALE' };
const HB_OFFLINE: CoreLinkInfo = { source: 'HEARTBEAT', state: 'OFFLINE', heartbeat: 'OFFLINE' };
const SIM_OFFLINE: CoreLinkInfo = { source: 'SIMULATED', state: 'OFFLINE' };
const UNLOCKED = { locked: false, retryInSeconds: 0 };

describe('loginSchema (§5.7: two required strings)', () => {
  it('trims the username and keeps the password verbatim', () => {
    expect(loginSchema.parse({ username: '  budi.santoso ', password: ' pw ' })).toEqual({ username: 'budi.santoso', password: ' pw ' });
  });
  it('rejects empty fields with the shared i18n keys', () => {
    const result = loginSchema.safeParse({ username: '   ', password: '' });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message).sort();
    expect(messages).toEqual(['login.password.required', 'login.username.required']);
  });
});

describe('L2 ring tone and L11 chip', () => {
  it('maps the lockout, the Core link and a stale heartbeat', () => {
    expect(ringStateFor({ coreLink: SIMULATED, locked: false })).toBe('ready');
    expect(ringStateFor({ coreLink: HB_LIVE, locked: false })).toBe('ready');
    expect(ringStateFor({ coreLink: SIM_OFFLINE, locked: false })).toBe('critical');
    expect(ringStateFor({ coreLink: HB_OFFLINE, locked: false })).toBe('critical');
    expect(ringStateFor({ coreLink: { source: 'HEARTBEAT', state: 'ONLINE', heartbeat: 'STALE' }, locked: false })).toBe('attention');
    // The lockout wins: amber (M-C-22).
    expect(ringStateFor({ coreLink: HB_OFFLINE, locked: true })).toBe('attention');
  });
  it('gives the chip its kind and tone', () => {
    expect(coreChipFor(SIMULATED)).toEqual({ kind: 'ONLINE', tone: 'success' });
    expect(coreChipFor(HB_STALE)).toEqual({ kind: 'OFFLINE', tone: 'danger' });
    expect(coreChipFor({ source: 'HEARTBEAT', state: 'ONLINE', heartbeat: 'STALE' })).toEqual({ kind: 'STALE', tone: 'warning' });
  });
  it('blocks sign-in only in heartbeat mode with the Core offline (L6)', () => {
    expect(isCoreBlocked(HB_OFFLINE)).toBe(true);
    expect(isCoreBlocked(SIM_OFFLINE)).toBe(false);
    expect(isCoreBlocked(HB_LIVE)).toBe(false);
    expect(isSubmitDisabled({ locked: false, pending: false, coreBlocked: false })).toBe(false);
    expect(isSubmitDisabled({ locked: true, pending: false, coreBlocked: false })).toBe(true);
    expect(isSubmitDisabled({ locked: false, pending: true, coreBlocked: false })).toBe(true);
    expect(isSubmitDisabled({ locked: false, pending: false, coreBlocked: true })).toBe(true);
  });
  it('prints the Core address without the scheme', () => {
    // D263 (row 236): the default is the configured Core server address of the runtime (its default here); an origin
    // given (the heartbeat source's mock-core) is printed without its scheme, as before. Moved pin: was '127.0.0.1:4400'.
    expect(coreAddress()).toBe(formatCoreAddress(DEFAULT_CORE_ADDRESS));
    expect(coreAddress('http://127.0.0.1:4400')).toBe('127.0.0.1:4400');
    expect(coreAddress('ws://127.0.0.1:4400/')).toBe('127.0.0.1:4400');
  });
});

describe('L9 notice priority (§6.2)', () => {
  const invalid = { kind: 'invalid', attemptsRemaining: 2 } as const;
  it('shows the lockout first, then Core offline, then the attempt, then the sign-out notice', () => {
    expect(noticeFor({ lockout: { locked: true, retryInSeconds: 42 }, coreBlocked: true, lastAttempt: invalid, lastSignOut: 'USER' })).toEqual({
      kind: 'locked',
      retryInSeconds: 42,
    });
    expect(noticeFor({ lockout: UNLOCKED, coreBlocked: true, lastAttempt: invalid, lastSignOut: 'USER' })).toEqual({ kind: 'core-offline' });
    expect(noticeFor({ lockout: UNLOCKED, coreBlocked: false, lastAttempt: invalid, lastSignOut: 'USER' })).toEqual(invalid);
    expect(noticeFor({ lockout: UNLOCKED, coreBlocked: false, lastAttempt: null, lastSignOut: 'LOCK' })).toEqual({ kind: 'signed-out', reason: 'LOCK' });
    expect(noticeFor({ lockout: UNLOCKED, coreBlocked: false, lastAttempt: null, lastSignOut: 'IDLE' })).toEqual({ kind: 'expired' });
    expect(noticeFor({ lockout: UNLOCKED, coreBlocked: false, lastAttempt: null, lastSignOut: null })).toBeNull();
  });
  it('drops a Core-offline attempt once the Core is back', () => {
    expect(noticeFor({ lockout: UNLOCKED, coreBlocked: false, lastAttempt: { kind: 'core-offline' }, lastSignOut: null })).toBeNull();
  });
  it('picks the Alert status per state', () => {
    expect(alertStatusFor({ kind: 'locked', retryInSeconds: 1 })).toBe('warning');
    expect(alertStatusFor({ kind: 'biometric-lockout' })).toBe('warning');
    expect(alertStatusFor({ kind: 'core-offline' })).toBe('danger');
    expect(alertStatusFor(invalid)).toBe('danger');
    expect(alertStatusFor({ kind: 'signed-out', reason: 'USER' })).toBe('accent');
    expect(alertStatusFor({ kind: 'expired' })).toBe('accent');
  });
});

describe('L7 biometric button (§6.3 step 2)', () => {
  const base = { enabled: true, hasOperator: true, blocked: false };
  it('is hidden without hardware or before the OS answers', () => {
    expect(biometricButtonFor({ ...base, availability: 'unavailable' })).toEqual({ kind: 'hidden' });
    expect(biometricButtonFor({ ...base, availability: 'unknown' })).toEqual({ kind: 'hidden' });
  });
  it('is disabled with a caption when not enrolled or not bound yet', () => {
    expect(biometricButtonFor({ ...base, availability: 'not-enrolled' })).toEqual({ kind: 'disabled', captionKey: 'mobile.biometric.notEnrolled' });
    expect(biometricButtonFor({ ...base, availability: 'available', enabled: false })).toEqual({
      kind: 'disabled',
      captionKey: 'features.login.biometric.notBound',
    });
    expect(biometricButtonFor({ ...base, availability: 'available', hasOperator: false }).kind).toBe('disabled');
  });
  it('follows Sign In while blocked, else is enabled', () => {
    expect(biometricButtonFor({ ...base, availability: 'available', blocked: true })).toEqual({ kind: 'disabled', captionKey: 'mobile.biometric.button' });
    expect(biometricButtonFor({ ...base, availability: 'available' })).toEqual({ kind: 'enabled' });
  });
});

describe('text and layout helpers', () => {
  it('splits a sentence around the live value', () => {
    expect(splitAroundToken((token) => `Try again in ${token}.`)).toEqual({ before: 'Try again in ', after: '.' });
    expect(splitAroundToken(() => 'No token')).toEqual({ before: 'No token', after: '' });
  });
  it('sizes the ring per class (C-1 login mode 200–340)', () => {
    expect(ringSizeFor('compact')).toBe(200);
    expect(ringSizeFor('compact-landscape')).toBe(200);
    expect(ringSizeFor('medium')).toBe(240);
    expect(ringSizeFor('expanded')).toBe(340);
  });
  it('reads presentation mode from the shared prefs value', () => {
    expect(parsePresentationMode(null)).toBe(false);
    expect(parsePresentationMode('{"reduceMotion":true}')).toBe(false);
    expect(parsePresentationMode('{"presentationMode":true,"haptics":false}')).toBe(true);
    expect(parsePresentationMode('{"presentationMode":"yes"}')).toBe(false);
    expect(() => parsePresentationMode('[1]')).toThrow(TypeError);
  });
});

describe('ambient maths (M-C-23)', () => {
  it('seeds at most 24 deterministic particles in three layers', () => {
    const a = dustSeeds(40, 7);
    expect(a).toHaveLength(DUST_COUNT);
    expect(dustSeeds(DUST_COUNT, 7)).toEqual(a);
    expect(new Set(a.map((seed) => seed.layer))).toEqual(new Set([0, 1, 2]));
    for (const seed of a) {
      expect([1, 2]).toContain(seed.speed);
      expect(seed.x).toBeGreaterThanOrEqual(0);
      expect(seed.x).toBeLessThan(1);
    }
  });
  it('loops seamlessly: the position at t = 1 equals the position at t = 0', () => {
    for (const seed of dustSeeds(DUST_COUNT, 11)) {
      const start = dustPosition(seed, 0, 400, 900);
      const end = dustPosition(seed, 1, 400, 900);
      expect(end.x).toBeCloseTo(start.x, 6);
      expect(end.y).toBeCloseTo(start.y, 6);
    }
  });
  it('keeps the beam one segment long and wraps it past the end of the outline', () => {
    expect(beamWindows(0.2)).toEqual({ head: [0.2, 0.2 + BEAM_LENGTH], tail: [0, 0] });
    const wrapped = beamWindows(0.95);
    expect(wrapped.head).toEqual([0.95, 1]);
    expect(wrapped.tail[1]).toBeCloseTo(0.95 + BEAM_LENGTH - 1, 6);
    expect(beamOpacity(0)).toBe(0);
    expect(beamOpacity(0.5)).toBe(1);
    expect(beamOpacity(1)).toBe(0);
  });
});
