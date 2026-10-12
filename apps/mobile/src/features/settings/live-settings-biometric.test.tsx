// Backend task, plan row W82: the biometric switch of Settings → Security & Privacy in LIVE mode —
// finding CPM1-1 of gateway_check/09 and AC-C-68 (04_client_integration_spec §9.3 MB-1, MB-2, MB-6a (3)).
//
// - In a session created by password the switch enrols through operation 7 (once per press) and turns
//   biometric sign-in off through operation 7 again; a change the Core or the storage did not take is
//   one truthful toast (nothing changed).
// - In a session created with the fingerprint the switch is disabled with the MB-1 sentence, and a
//   press sends nothing.
// - The description never says "simulated" and never claims hardware protection: it is worded on how
//   the token is stored (`biometric.protected`). SIMULATED keeps "Simulated identity binding".
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/settings-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { renderLiveSettings, renderSimulatedSettings, resetLiveSettingsBed, type LiveSettingsBed, type LiveSettingsBedOptions } from './testing/live-settings-bed';

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

const SCREEN_LOCK = "Biometric sign-in asks for this device's screen-lock check.";
const PROTECTED = "Biometric sign-in asks for this device's screen-lock check before the stored sign-in token can be read.";
const PASSWORD_REQUIRED = 'Sign in with your password to change biometric sign-in.';
/** MB-6a (3): what no text may say while the token is not protected (the auth layer's own test pattern). */
const HARDWARE_CLAIM = /hardware|keystore|secure (?:enclave|element|chip)|protected by|encrypted/i;

const switchOf = () => screen.getByTestId('settings-biometric');
const descriptionText = (): string => {
  const texts = screen.getAllByText(/biometric sign-in|Fingerprint enrolled/i).map((node) => node.props.children as unknown);
  return texts.filter((text): text is string => typeof text === 'string').join(' | ');
};

/**
 * The switch's own change handler, called as an accessibility action or a stray event would call it: a
 * disabled kit Switch does not pass a press on, so this is the only way to reach the handler.
 */
async function reachHandler(on: boolean, b: LiveSettingsBed): Promise<void> {
  const owner = screen.UNSAFE_getAllByProps({ testID: 'settings-biometric' }).find((node) => typeof node.props.onSelectedChange === 'function');
  if (owner === undefined) throw new Error('biometric test: the switch has no change handler');
  await act(async () => {
    (owner.props.onSelectedChange as (value: boolean) => void)(on);
  });
  await b.flush();
  await b.elapse(500);
}

async function openSecurity(options: LiveSettingsBedOptions = {}): Promise<LiveSettingsBed> {
  const b = await renderLiveSettings(options);
  bed = b;
  await b.open('/settings/security');
  expect(screen.getByTestId('settings-security')).toBeTruthy();
  await b.flush();
  return b;
}

async function toggle(on: boolean, b: LiveSettingsBed): Promise<void> {
  await act(async () => {
    fireEvent(switchOf(), 'onSelectedChange', on);
  });
  await b.flush();
  await b.elapse(500);
}

describe('a session created by password on this tablet (MB-1, MB-2)', () => {
  it('not enrolled: the switch is usable; its description is the screen-lock sentence, never "simulated", never a hardware claim', async () => {
    await openSecurity();
    expect(switchOf().props.accessibilityState).toMatchObject({ disabled: false, checked: false });
    expect(screen.getByText(`Fingerprint enrolled on this device. ${SCREEN_LOCK}`)).toBeTruthy();
    expect(screen.queryAllByText(/simulat/i)).toHaveLength(0);
    expect(HARDWARE_CLAIM.test(descriptionText())).toBe(false);
  });

  it('turning it on calls operation 7 once and stores the token and its marker; the switch is then on (AC-C-68)', async () => {
    const b = await openSecurity();
    await toggle(true, b);
    expect(b.requests('setBiometricEnrollment').map((call) => call.body)).toEqual([{ enabled: true }]);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(true);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.biometricMarker)!)).toMatchObject({ operatorId: 'OPR-002', protected: false });
    expect(switchOf().props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    // Nothing of it reaches AsyncStorage (MP-2) or the simulated binding.
    expect(await AsyncStorage.getItem('dems.mobile.auth.v1')).toBeNull();
  });

  it('enrolled: turning it off calls operation 7 with `enabled: false` and deletes both items', async () => {
    const b = await openSecurity({ enrolled: { protectedItem: false } });
    expect(switchOf().props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    await toggle(false, b);
    expect(b.requests('setBiometricEnrollment').map((call) => call.body)).toEqual([{ enabled: false }]);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(false);
    expect(store().has(SECURE_ITEM_KEYS.biometricMarker)).toBe(false);
    expect(switchOf().props.accessibilityState).toMatchObject({ checked: false });
  });

  it('the Core cannot be told (outage): one truthful toast — nothing changed — and both items stay', async () => {
    const b = await openSecurity({ enrolled: { protectedItem: false } });
    b.fake.failOnce('setBiometricEnrollment');
    await toggle(false, b);
    expect(screen.getAllByText('Biometric sign-in was not changed on this device. Try again.').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/applies until the app restarts/)).toHaveLength(0);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(true);
    expect(switchOf().props.accessibilityState).toMatchObject({ checked: true });
  });

  it('the marker says `protected: true`: the description says the token is read only after the device\'s check — still no hardware claim', async () => {
    await openSecurity({ enrolled: { protectedItem: true } });
    expect(screen.getByText(`Fingerprint enrolled on this device. ${PROTECTED}`)).toBeTruthy();
    expect(HARDWARE_CLAIM.test(PROTECTED)).toBe(false);
    expect(screen.queryAllByText(/simulat/i)).toHaveLength(0);
  });
});

describe('a session created with the fingerprint (AC-C-68)', () => {
  it('the switch is disabled with the MB-1 sentence, and a press sends nothing', async () => {
    const b = await openSecurity({ enrolled: { protectedItem: false }, signedOut: true });
    expect(await b.fingerprint()).toBe('signed-in');
    expect(b.requests('signInWithBiometric')).toHaveLength(1);
    expect(b.mobile.live.session?.method).toBe('BIOMETRIC');
    expect(b.session().biometric.changeBlocked).toBe(true);
    await b.flush();
    expect(switchOf().props.accessibilityState).toMatchObject({ disabled: true, checked: true });
    expect(screen.getByText(PASSWORD_REQUIRED)).toBeTruthy();
    expect(screen.queryAllByText(/simulat/i)).toHaveLength(0);
    // A press does not get through the disabled switch, and even one that reaches its handler changes
    // nothing: MB-1 forbids both directions in a biometric session (and the auth layer enrols only in a
    // password session).
    await toggle(false, b);
    await reachHandler(false, b);
    await reachHandler(true, b);
    expect(b.requests('setBiometricEnrollment')).toHaveLength(0);
    expect(store().has(SECURE_ITEM_KEYS.biometricToken)).toBe(true);
  });
});

describe('SIMULATED keeps its words (CPM1-1 changes the LIVE wording only)', () => {
  it('the switch reads "… Simulated identity binding." exactly as before, and none of the LIVE sentences shows', async () => {
    await renderSimulatedSettings({ initialUrl: '/settings/security' });
    expect(screen.getByTestId('settings-security')).toBeTruthy();
    expect(screen.getByText('Fingerprint enrolled on this device. Simulated identity binding.')).toBeTruthy();
    expect(screen.queryByText(new RegExp(SCREEN_LOCK.replace(/[.']/g, '.')))).toBeNull();
    expect(screen.queryByText(PASSWORD_REQUIRED)).toBeNull();
  });
});
