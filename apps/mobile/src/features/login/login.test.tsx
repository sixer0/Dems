// T-M04 (04_mobile_specs §10.1; MA-06) plus the §4.1 / §6 behaviour of the mobile Login (step 75):
// generic error with attempts left, 5 failures → locked Alert with a live countdown, the Core-offline
// Alert with its rate-limited Retry, no demo-credentials disclosure (L10 dropped), the biometric
// button states and a fingerprint sign-in, the signed-out notice, and no credential anywhere.
//
// The Login renders through the REAL route tree and guard (step 70) over the REAL simulator auth
// (step 73) with a manual clock, so the lockout countdown runs on the simulator clock as on a device.
// The router harness must be the first import (it prepares the module mocks the tree needs).
import { appContext, renderRoutes, resetShellState, setWindow, type WindowName, WINDOWS } from '@/navigation/testing/router-harness';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { StyleSheet } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { en } from '@dems/shared/i18n';
import { AUTH_IDLE_TIMEOUT_MS, AUTH_LOCKOUT_MS, OPERATORS, type Sim } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests, MOBILE_PREFS_KEY } from '@/motion';
import { setSignedInSnapshot } from '@/navigation/pending-href';
import { RootNavigator } from '@/navigation/root-navigator';
import { AppProviders } from '@/providers';
import { resetCoreLinkPrefsForTests, runtimeLog, setCoreLinkSource, useAuth, type AuthContract } from '@/runtime';
import { FakeHeartbeatSocket, createTestSim, flushAsync, type TestSim } from '@/runtime/testing/test-sim';
import { MOBILE_AUTH_KEY, resetAuthPrefsForTests, setAuthPrefs } from '@/auth';
import { LOGIN_SUBMIT_CLEARANCE } from './login-screen';

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

const WRONG = 'wrong-pass-7731';
const DEMO_PASSWORD = 'demo-2026';
const originalFetch = global.fetch;

interface Mounted extends TestSim {
  sockets: FakeHeartbeatSocket[];
  app: ReturnType<typeof renderRoutes>;
  /** The contract the app sees (`useAuth()` under the real AuthProvider), for sign-out. */
  auth: () => AuthContract;
}

/** The app's route tree at `url`, with the real providers around the given simulator. */
async function mountLogin(url = '/login', window: WindowName = 'phonePortrait', options: { scenario?: 'recording' } = {}): Promise<Mounted> {
  const test = createTestSim(options.scenario ? { scenario: options.scenario } : {});
  const sockets: FakeHeartbeatSocket[] = [];
  setWindow(window);
  setSignedInSnapshot(false);
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const sim: Sim = test.sim;
  const latest: { auth: AuthContract | null } = { auth: null };
  function AuthProbe() {
    latest.auth = useAuth();
    return null;
  }
  function TestRoot() {
    return (
      <AppProviders
        sim={sim}
        safeAreaMetrics={metrics}
        queryClient={queryClient}
        heartbeatSocketFactory={() => {
          const socket = new FakeHeartbeatSocket();
          sockets.push(socket);
          return socket;
        }}
      >
        <AuthProbe />
        <RootNavigator />
      </AppProviders>
    );
  }
  const app = renderRoutes(appContext({ _layout: TestRoot }), url);
  await flushAsync();
  return { ...test, sockets, app, auth: () => latest.auth! };
}

async function typeCredentials(username: string, password: string) {
  fireEvent.changeText(screen.getByTestId('login-username'), username);
  fireEvent.changeText(screen.getByTestId('login-password'), password);
  await act(async () => {
    fireEvent.press(screen.getByTestId('login-submit'));
  });
  await flushAsync();
}

function auditTypes(sim: Sim, last: number): string[] {
  return sim.store
    .getState()
    .audit.rows.slice(-last)
    .map((row) => row.type);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetShellState();
  resetCoreLinkPrefsForTests();
  // The device default is LIVE since 2026-11-05; this file proves the simulator-backed Login.
  setCoreLinkSource('SIMULATED');
  resetAuthPrefsForTests();
  // D43 test switch: reduced motion, so the entrance is instant and no loop runs.
  resetMotionStateForTests({ linkMotion: 'off' });
  resetMissingKeys();
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
  jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(true);
  jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);
  jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('T-M04 Login (MA-06)', () => {
  it('renders the MB 1 regions in order and keeps screen-login as the root', async () => {
    await mountLogin();
    expect(screen.getByTestId('screen-login')).toBeTruthy();
    const order = ['login-ring', 'login-username', 'login-password', 'login-submit', 'login-biometric-caption', 'login-trust-line', 'login-version'];
    for (const id of order) expect(screen.getByTestId(id)).toBeTruthy();
    expect(screen.getByText('DEMS')).toBeTruthy();
    expect(screen.getByText('EDGE CLIENT')).toBeTruthy();
    expect(screen.getByText('Digital Evidence Recording Controller')).toBeTruthy();
    expect(screen.getByTestId('login-version')).toHaveTextContent('v2.4.1');
    expect(screen.getByTestId('login-trust-text')).toHaveTextContent('Core: DEMS-IR-01 • paired (simulated)');
    // Fix wave J (JA2-13, N-05): a paired device's link is named for what it opens; no "tablet" on a phone.
    expect(screen.getByTestId('login-pair-link')).toHaveTextContent('Pairing details');
    expect(screen.queryByText(/tablet/i)).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('asks for both fields before any attempt (Validating), with no audit row', async () => {
    const { sim } = await mountLogin();
    const before = sim.store.getState().audit.total;
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    await waitFor(() => expect(screen.getByTestId('login-username-error')).toHaveTextContent('Enter your username.'));
    expect(screen.getByTestId('login-password-error')).toHaveTextContent('Enter your password.');
    expect(sim.store.getState().audit.total).toBe(before);
  });

  it('shows the generic error with the attempts left and clears the password', async () => {
    const { sim } = await mountLogin();
    // Fix wave J (JA2-15): Sign In carries its own name (so the platform rebuilds its description when
    // the state changes) and is not busy once the attempt has ended.
    expect(screen.getByTestId('login-submit').props.accessibilityLabel).toBe('Sign In');
    await typeCredentials('budi.santoso', WRONG);
    expect(screen.getByTestId('login-alert-invalid')).toBeTruthy();
    expect(screen.getByTestId('login-submit').props.accessibilityLabel).toBe('Sign In');
    expect(screen.getByTestId('login-submit').props.accessibilityState).toMatchObject({ busy: false });
    expect(screen.getByText('Invalid username or password.')).toBeTruthy();
    expect(screen.getByText('4 attempts remaining')).toBeTruthy();
    expect(screen.getByTestId('login-password').props.value).toBe('');
    expect(auditTypes(sim, 1)).toEqual(['AUTH_FAILED']);
    // An unknown username gets exactly the same message (no account enumeration, §6.1).
    await typeCredentials('nobody.here', WRONG);
    expect(screen.getByText('Invalid username or password.')).toBeTruthy();
    expect(screen.getByText('3 attempts remaining')).toBeTruthy();
  });

  it('locks after 5 failures with a live countdown, then re-enables Sign In at zero', async () => {
    const { sim, advance } = await mountLogin();
    for (let attempt = 0; attempt < 5; attempt += 1) await typeCredentials('budi.santoso', WRONG);
    act(() => advance(100));
    expect(screen.getByTestId('login-alert-locked')).toBeTruthy();
    expect(screen.getByText('Too many attempts')).toBeTruthy();
    expect(screen.getByLabelText('Too many attempts. Try again in 60 seconds.')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toBeDisabled();
    expect(auditTypes(sim, 5)).toEqual(['AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED']);

    act(() => advance(30_000, 5_000));
    expect(screen.getByLabelText('Too many attempts. Try again in 30 seconds.')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toBeDisabled();

    act(() => advance(AUTH_LOCKOUT_MS - 30_000, 5_000));
    expect(screen.queryByTestId('login-alert-locked')).toBeNull();
    expect(screen.getByTestId('login-submit')).not.toBeDisabled();
    await typeCredentials('budi.santoso', DEMO_PASSWORD);
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy());
    expect(auditTypes(sim, 1)).toEqual(['AUTH_SUCCESS']);
  }, 30_000);

  it('shows the Core-offline Alert in heartbeat mode, disables Sign In, and rate-limits Retry', async () => {
    setCoreLinkSource('HEARTBEAT'); // no heartbeat arrives: the Core link is OFFLINE
    const { sim, sockets } = await mountLogin();
    const before = sim.store.getState().audit.total;
    expect(screen.getByTestId('login-alert-core-offline')).toBeTruthy();
    expect(screen.getByText('Core service unreachable')).toBeTruthy();
    expect(screen.getByText('Core service unreachable at 127.0.0.1:4400.')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toBeDisabled();
    expect(screen.getByTestId('login-core-chip')).toHaveTextContent('Core offline');

    const opened = sockets.length;
    fireEvent.press(screen.getByTestId('login-core-retry'));
    expect(sockets.length).toBe(opened + 1); // the heartbeat reconnects now, not after its backoff
    expect(screen.getByText('Retry in 3s')).toBeTruthy();
    expect(screen.getByTestId('login-core-retry')).toBeDisabled();
    expect(sim.store.getState().audit.total).toBe(before); // nothing reached the simulator
  });

  // M3-01 (S62 §3.15 #7, D160 KD-15): the HOLD deleted "lists the 3 demo operators ... signs in"; rewritten
  // as its negative, in BOTH presentation modes (the HOLD kept only the presentation-mode-on half).
  it.each([true, false])('draws no "Demo operators" control and no demo user name, in either presentation mode (L10 dropped; presentation mode %s)', async (presentationMode) => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ presentationMode, haptics: true }));
    await mountLogin();
    await flushAsync();
    expect(screen.queryByTestId('login-demo-operators')).toBeNull();
    expect(screen.queryByTestId('login-demo-trigger')).toBeNull();
    expect(screen.queryByText('Demo operators')).toBeNull();
    expect(screen.queryByText(`Demo password: ${DEMO_PASSWORD}`)).toBeNull();
    for (const operator of OPERATORS) {
      expect(screen.queryByTestId(`login-demo-operator-${operator.username}`)).toBeNull();
      expect(screen.queryByText(operator.username)).toBeNull();
    }
    // The Login still works without them: the form is there to type into (L4, L5).
    expect(screen.getByTestId('login-username')).toBeTruthy();
    expect(screen.getByTestId('login-password')).toBeTruthy();
  });
});

describe('biometric sign-in on the Login (§6.3, L7)', () => {
  it('hides the fingerprint button without hardware', async () => {
    jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValue(false);
    await mountLogin();
    await flushAsync();
    expect(screen.queryByTestId('login-biometric')).toBeNull();
  });

  it('disables it with "Biometrics not set up on this device" when nothing is enrolled', async () => {
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(false);
    await mountLogin();
    await flushAsync();
    expect(screen.getByTestId('login-biometric')).toBeDisabled();
    expect(screen.getByTestId('login-biometric-caption')).toHaveTextContent('Biometrics not set up on this device');
  });

  it('asks for one password sign-in before biometrics are bound to an operator', async () => {
    await mountLogin();
    await flushAsync();
    expect(screen.getByTestId('login-biometric')).toBeDisabled();
    expect(screen.getByTestId('login-biometric-caption')).toHaveTextContent(
      'Sign in with your password once to enable biometric sign-in on this device.',
    );
  });

  it('signs in with the fingerprint once enabled (audit AUTH_SUCCESS, method BIOMETRIC)', async () => {
    await setAuthPrefs({ lastOperatorId: 'OPR-001', biometricEnabled: true });
    const { sim } = await mountLogin();
    await flushAsync();
    expect(screen.getByTestId('login-biometric-caption')).toHaveTextContent('Use biometric login');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-biometric'));
    });
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy());
    const row = sim.store.getState().audit.rows.at(-1);
    expect(row?.type).toBe('AUTH_SUCCESS');
    expect(JSON.stringify(row?.details)).toContain('BIOMETRIC');
    expect(jest.mocked(LocalAuthentication.authenticateAsync)).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: 'Sign in to DEMS', promptSubtitle: 'AKP Budi Santoso', cancelLabel: 'Use password' }),
    );
  });

  it('counts a rejected fingerprint toward the lockout and shows the attempts left', async () => {
    await setAuthPrefs({ lastOperatorId: 'OPR-001', biometricEnabled: true });
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: false, error: 'authentication_failed' });
    const { sim } = await mountLogin();
    await flushAsync();
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-biometric'));
    });
    await flushAsync();
    expect(screen.getByText('Fingerprint not recognised')).toBeTruthy();
    expect(screen.getByText('4 attempts remaining')).toBeTruthy();
    expect(auditTypes(sim, 1)).toEqual(['AUTH_FAILED']);
  });

  it('shows "Biometrics locked — use your password" when the OS locks biometrics', async () => {
    await setAuthPrefs({ lastOperatorId: 'OPR-001', biometricEnabled: true });
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: false, error: 'lockout' });
    await mountLogin();
    await flushAsync();
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-biometric'));
    });
    await flushAsync();
    expect(screen.getByTestId('login-alert-biometric-lockout')).toBeTruthy();
    expect(screen.getByText('Biometrics locked — use your password')).toBeTruthy();
  });
});

describe('sign-out notice and credential hygiene (§3.3, §6.1)', () => {
  it('returns to /login with "You have been signed out." after a sign-out (M-APP-02 entrance)', async () => {
    const { auth } = await mountLogin();
    await typeCredentials('rina.wijaya', DEMO_PASSWORD);
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy());
    // Decline the biometric offer the provider shows after a password sign-in.
    if (screen.queryByTestId('biometric-offer-decline')) fireEvent.press(screen.getByTestId('biometric-offer-decline'));
    act(() => auth().signOut('USER'));
    await waitFor(() => expect(screen.getByTestId('screen-login')).toBeTruthy());
    expect(screen.getByTestId('login-alert-signed-out')).toBeTruthy();
    expect(screen.getByText('You have been signed out.')).toBeTruthy();
    // The notice goes once the operator makes an attempt.
    await typeCredentials('rina.wijaya', WRONG);
    expect(screen.queryByTestId('login-alert-signed-out')).toBeNull();
    expect(screen.getByTestId('login-alert-invalid')).toBeTruthy();
  });

  // Round two, ruling (c) (JT-18 / JA2-35): "Lock console" still ends the sign-in; the Login then says it was a lock.
  // Closing pass J4, item 2: the words are the SHARED key `login.notices.consoleLocked` (the web console reads the same key);
  // this test pins the key, not a literal, plus the ruled words once so that a change of the sentence is seen here too.
  it('JT-18: after "Lock console" the Login reads the shared lock sentence ("Console locked — sign in to continue") - not the sign-out notice', async () => {
    const { auth } = await mountLogin();
    await typeCredentials('rina.wijaya', DEMO_PASSWORD);
    await waitFor(() => expect(screen.getByTestId('screen-home')).toBeTruthy());
    if (screen.queryByTestId('biometric-offer-decline')) fireEvent.press(screen.getByTestId('biometric-offer-decline'));
    // `lockConsole()` of the auth session is this call (auth-provider.tsx: `signOut('LOCK')`).
    act(() => auth().signOut('LOCK'));
    await waitFor(() => expect(screen.getByTestId('screen-login')).toBeTruthy());
    expect(auth().isAuthenticated).toBe(false);
    expect(screen.getByTestId('login-alert-signed-out')).toBeTruthy();
    expect(en.login.notices.consoleLocked).toBe('Console locked — sign in to continue');
    expect(screen.getByText(en.login.notices.consoleLocked)).toBeTruthy();
    expect(screen.queryByText(en.login.notices.signedOut)).toBeNull();
  });

  it('shows the expiry notice after 15 min without activity; recording is untouched', async () => {
    const { sim, advance } = await mountLogin('/login', 'phonePortrait', { scenario: 'recording' });
    await typeCredentials('budi.santoso', DEMO_PASSWORD);
    if (screen.queryByTestId('biometric-offer-decline')) fireEvent.press(screen.getByTestId('biometric-offer-decline'));
    act(() => advance(AUTH_IDLE_TIMEOUT_MS + 1_000, 1_000));
    await waitFor(() => expect(screen.getByTestId('screen-login')).toBeTruthy());
    expect(screen.getByTestId('login-alert-expired')).toBeTruthy();
    expect(screen.getByText('Your session expired after 15 minutes without activity. Sign in again.')).toBeTruthy();
    expect(sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('keeps the password out of the state, the audit rows, the runtime log and storage', async () => {
    const { sim } = await mountLogin();
    await typeCredentials('budi.santoso', WRONG);
    expect(JSON.stringify(sim.store.getState())).not.toContain(WRONG);
    expect(JSON.stringify(runtimeLog.records())).not.toContain(WRONG);
    const stored = await AsyncStorage.multiGet(await AsyncStorage.getAllKeys());
    expect(JSON.stringify(stored)).not.toContain(WRONG);
    expect(await AsyncStorage.getItem(MOBILE_AUTH_KEY)).toBeNull();
  });
});

const LAYOUT_CASES: [WindowName, string][] = [
  ['phoneLandscape', 'compact-landscape'],
  ['tabletPortrait', 'medium'],
  ['tabletLandscape', 'expanded'],
];

describe('JA2-14: the Login footer on a phone, and Sign In above the keyboard', () => {
  // Both motion modes: the footer is layout, not an animation, and must not depend on reduced motion.
  const MOTION_MODES: readonly (readonly [string, 'off' | 'default'])[] = [
    ['reduced motion (the test switch)', 'off'],
    ['full motion (the normal launch)', 'default'],
  ];
  it.each(MOTION_MODES)('phone portrait, %s: the trust line and the version sit in a pinned row above the bottom safe area, outside the scroll area', async (_name, linkMotion) => {
    resetMotionStateForTests({ linkMotion });
    await mountLogin('/login', 'phonePortrait');
    const scroll = screen.getByTestId('login-scroll');
    const footer = screen.getByTestId('login-footer');
    // The scroll area holds the brand, the card and the demo operators; never the footer.
    expect(within(scroll).getByTestId('login-card')).toBeTruthy();
    expect(within(scroll).queryByTestId('login-version')).toBeNull();
    expect(within(scroll).queryByTestId('login-trust-line')).toBeNull();
    expect(within(footer).getByTestId('login-trust-line')).toBeTruthy();
    expect(within(footer).getByTestId('login-pair-link')).toBeTruthy();
    expect(within(footer).getByTestId('login-version')).toHaveTextContent('v2.4.1');
    // The row clears the gesture bar (the harness gives a bottom inset of 16) and the version keeps a full line.
    expect(StyleSheet.flatten(footer.props.style).paddingBottom).toBeGreaterThanOrEqual(16 + 8);
    const version = StyleSheet.flatten(screen.getByTestId('login-version').props.style);
    expect(version.minHeight).toBeGreaterThanOrEqual(version.lineHeight);
    expect(version.flexShrink).toBe(0);
    // The keyboard pattern of the Pair screen: room for the Sign In button under the focused field.
    expect(scroll.props.bottomOffset).toBe(LOGIN_SUBMIT_CLEARANCE);
    expect(LOGIN_SUBMIT_CLEARANCE).toBeGreaterThanOrEqual(56 + 16);

    // A notice grows the card inside the scroll area; the footer stays where it is.
    await typeCredentials('budi.santoso', WRONG);
    expect(within(screen.getByTestId('login-scroll')).getByTestId('login-alert-invalid')).toBeTruthy();
    expect(within(screen.getByTestId('login-footer')).getByTestId('login-pair-link')).toBeTruthy();
    expect(within(screen.getByTestId('login-scroll')).queryByTestId('login-version')).toBeNull();
  });

  it.each(['phoneLandscape', 'tabletPortrait', 'tabletLandscape'] as const)('%s keeps the footer under the card, with the same keyboard clearance and the full version line', async (window) => {
    await mountLogin('/login', window);
    expect(screen.queryByTestId('login-footer')).toBeNull();
    const scroll = screen.getByTestId('login-scroll');
    expect(within(scroll).getByTestId('login-trust-line')).toBeTruthy();
    expect(scroll.props.bottomOffset).toBe(LOGIN_SUBMIT_CLEARANCE);
    const version = StyleSheet.flatten(within(scroll).getByTestId('login-version').props.style);
    expect(version.minHeight).toBeGreaterThanOrEqual(version.lineHeight);
  });
});

describe('layouts (§2.4, D17)', () => {
  it.each(LAYOUT_CASES)('renders the brand and auth panes on %s (%s)', async (window) => {
    await mountLogin('/login', window);
    expect(screen.getByTestId('pane-brand')).toBeTruthy();
    expect(screen.getByTestId('pane-auth')).toBeTruthy();
    expect(screen.getByTestId('login-card')).toBeTruthy();
  });
});
