// Plan row W87 (step 109): Live tests that name sites S1-2 and S1-3 (04_client_integration_spec §8.5,
// §9.3; AC-C-56; MB-3 to MB-6; finding F72).
//
// S1-2 is `signInWithBiometric` (`auth/biometric.ts`, `applyBiometricOutcome`; in LIVE the auth layer's
// `live-auth-provider.tsx` sends it once the OS check passed): "`BiometricSimAuth` allows asynchronous
// results; `applyBiometricOutcome` awaits them". Operation 8 goes out under the DEVICE credential with
// the stored token; the rotated token is in the store before the action settles; a refusal keeps or
// deletes the token by what the Core said about it; an outage is never retried with the same token.
// S1-3 is `recordBiometricFailure` (operation 9, `auth/biometric.ts` `fromFailure`): a failed OS check
// reports the operator the marker names; the returned `SignInStatus` is mapped to the failure union.
// The test sits beside the Settings Live bed, which signs in through the auth layer's own biometric
// path over the app's real Live source; `auth/` itself is outside the write paths of this row.
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/settings-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as LocalAuthentication from 'expo-local-authentication';
import { FAKE_CREDENTIALS, OUTAGE, rateLimited, refusal } from '@dems/shared/live/testing';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { BIO_TOKENS, renderLiveSettings, resetLiveSettingsBed, type LiveSettingsBed } from './testing/live-settings-bed';

jest.setTimeout(30_000);

let bed: LiveSettingsBed | null = null;
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveSettingsBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  expect(getMissingKeys()).toEqual([]);
});

const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};

/** A signed-out tablet that holds an enrolment of the operator (token and marker), on the Live source. */
async function enrolledTablet(): Promise<LiveSettingsBed> {
  const b = await renderLiveSettings({ enrolled: { protectedItem: false }, signedOut: true });
  bed = b;
  await b.flush();
  expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO_TOKENS[0]);
  expect(b.mobile.live.session).toBeNull();
  return b;
}

describe('S1-2 `signInWithBiometric` (operation 8) in LIVE: awaited, mapped, and the token`s fate decided by the Core`s answer', () => {
  it('success: one request with the stored token under the device credential; the rotated token is stored; a BIOMETRIC session', async () => {
    const b = await enrolledTablet();
    expect(await b.fingerprint()).toBe('signed-in');
    const sent = b.requests('signInWithBiometric');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toEqual({ token: BIO_TOKENS[0] });
    expect(bearerOf(sent[0]!.headers)).toBe(FAKE_CREDENTIALS.deviceCredential);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO_TOKENS[1]);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(true);
    expect(b.mobile.live.session?.method).toBe('BIOMETRIC');
    expect(b.auth().isAuthenticated).toBe(true);
  });

  it('refusal 401: the token can never sign in again — `invalid`, the token and its marker deleted, the pairing kept; a second press sends nothing', async () => {
    const b = await enrolledTablet();
    b.fake.answerOnce('signInWithBiometric', b.fake.example('signInWithBiometric', 401));
    expect(await b.fingerprint()).toBe('invalid');
    expect(b.requests('signInWithBiometric')).toHaveLength(1);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(b.auth().isAuthenticated).toBe(false);
    expect(await b.fingerprint()).toBe('unavailable');
    expect(b.requests('signInWithBiometric')).toHaveLength(1);
  });

  it('refusal 423: the Core did not look at the token — `locked`, the token kept for the next attempt', async () => {
    const b = await enrolledTablet();
    const lockedUntil = b.fake.clock.now() + 18_000;
    b.fake.answerOnce('signInWithBiometric', refusal(423, 'LOCKED', 'Too many failed attempts. Try again shortly.', { lockedUntil, retryInMs: 18_000 }));
    expect(await b.fingerprint()).toBe('locked');
    expect(b.requests('signInWithBiometric')).toHaveLength(1);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO_TOKENS[0]);
    expect(b.auth().isAuthenticated).toBe(false);
  });

  it('outage: a request that got no answer may have used the token — `invalid`, both items deleted, never sent twice', async () => {
    const b = await enrolledTablet();
    b.fake.answerOnce('signInWithBiometric', OUTAGE);
    expect(await b.fingerprint()).toBe('invalid');
    expect(b.requests('signInWithBiometric')).toHaveLength(1);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(await b.fingerprint()).toBe('unavailable');
    expect(b.requests('signInWithBiometric').map((call) => (call.body as { token: string }).token)).toEqual([BIO_TOKENS[0]]);
  });
});

describe('S1-3 `recordBiometricFailure` (operation 9) in LIVE: a failed OS check is reported, mapped, and never sends the token', () => {
  const failCheck = () => jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValueOnce({ success: false, error: 'authentication_failed' });
  const markerOperator = (): unknown => (JSON.parse(store().peek(SECURE_ITEM_KEYS.biometricMarker)!) as { operatorId: unknown }).operatorId;

  it('success: one report with the operator the marker names, under the device credential; `failed`; no operation 8; the token kept', async () => {
    const b = await enrolledTablet();
    b.fake.answer('reportBiometricFailure', b.fake.example('reportBiometricFailure', 200, 'counted'));
    failCheck();
    expect(await b.fingerprint()).toBe('failed');
    const reported = b.requests('reportBiometricFailure');
    expect(reported).toHaveLength(1);
    expect(reported[0]!.body).toEqual({ operatorId: markerOperator() });
    expect(bearerOf(reported[0]!.headers)).toBe(FAKE_CREDENTIALS.deviceCredential);
    expect(b.requests('signInWithBiometric')).toHaveLength(0);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO_TOKENS[0]);
  });

  it('a report that locks the device (the `locked` status): `locked`; the token kept for after the lock', async () => {
    const b = await enrolledTablet();
    b.fake.answer('reportBiometricFailure', b.fake.example('reportBiometricFailure', 200, 'locked'));
    failCheck();
    expect(await b.fingerprint()).toBe('locked');
    expect(b.requests('reportBiometricFailure')).toHaveLength(1);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO_TOKENS[0]);
  });

  it('refusal: the Core limits the report (429) → `error`, no failure made up; the token kept', async () => {
    const b = await enrolledTablet();
    b.fake.answer('reportBiometricFailure', rateLimited(5));
    failCheck();
    expect(await b.fingerprint()).toBe('error');
    expect(b.requests('reportBiometricFailure')).toHaveLength(1);
    expect(b.requests('signInWithBiometric')).toHaveLength(0);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO_TOKENS[0]);
  });

  it('outage: the report gets no answer → `core-offline`; the token, never sent, is kept', async () => {
    const b = await enrolledTablet();
    b.fake.answer('reportBiometricFailure', OUTAGE);
    failCheck();
    expect(await b.fingerprint()).toBe('core-offline');
    expect(b.requests('reportBiometricFailure')).toHaveLength(1);
    expect(b.requests('signInWithBiometric')).toHaveLength(0);
    expect(store().peek(SECURE_ITEM_KEYS.biometricToken)).toBe(BIO_TOKENS[0]);
  });
});
