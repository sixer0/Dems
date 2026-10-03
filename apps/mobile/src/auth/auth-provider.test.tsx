// AuthProvider (04_mobile_specs §6): the simulator auth behind `useAuth()`, the §6.1 lockout, the
// heartbeat-mode Core-offline gate, the idle lock, Lock console, and the biometric offer / sign-in.
import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AUTH_IDLE_TIMEOUT_MS } from '@dems/shared/sim';
import { resetCoreLinkPrefsForTests, runtimeLog, setCoreLinkSource, useAuth, type AuthContract, type SignInResult } from '@/runtime';
import { RuntimeTestProviders, createTestSim, flushAsync } from '@/runtime/testing/test-sim';
import { MOBILE_AUTH_KEY, resetAuthPrefsForTests } from './auth-prefs';
import { useAuthSession, type AuthSession } from './auth-provider';

const WRONG = 'wrong-pass-7731';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetAuthPrefsForTests();
});

/** Mounts the providers and exposes the latest `useAuth()` and `useAuthSession()` values. */
async function mount(options: { scenario?: 'recording' } = {}) {
  const test = createTestSim(options.scenario ? { scenario: options.scenario } : {});
  const latest: { auth: AuthContract | null; session: AuthSession | null } = { auth: null, session: null };
  function Probe() {
    latest.auth = useAuth();
    latest.session = useAuthSession();
    return <Text testID="who">{latest.auth.operator?.displayName ?? 'signed out'}</Text>;
  }
  render(
    <RuntimeTestProviders sim={test.sim}>
      <Probe />
    </RuntimeTestProviders>,
  );
  await flushAsync();
  const signIn = async (username: string, password: string) => {
    let result: SignInResult | undefined;
    await act(async () => {
      result = await latest.auth!.signIn(username, password);
    });
    return result!;
  };
  return { ...test, latest, signIn };
}

describe('sign-in through the simulator (§6.1)', () => {
  it('locks the console after 5 failures within 5 min, with a live countdown, and never keeps the password', async () => {
    const { sim, latest, signIn, advance } = await mount();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(signIn('budi.santoso', WRONG)).resolves.toEqual({
        ok: false,
        reason: 'INVALID_CREDENTIALS',
        attemptsRemaining: 5 - attempt,
      });
    }
    const fifth = await signIn('budi.santoso', WRONG);
    expect(fifth).toMatchObject({ ok: false, reason: 'LOCKED' });
    act(() => advance(100));
    expect(latest.session!.lockout).toMatchObject({ locked: true, retryInSeconds: 60, attemptsRemaining: 0 });

    // Even the right password is refused while locked (AUTH_LOCKED).
    await expect(signIn('budi.santoso', 'demo-2026')).resolves.toMatchObject({ ok: false, reason: 'LOCKED' });
    const types = sim.store.getState().audit.rows.slice(-6).map((row) => row.type);
    expect(types).toEqual(['AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_FAILED', 'AUTH_LOCKED']);

    act(() => advance(30_000));
    expect(latest.session!.lockout.retryInSeconds).toBe(30);
    act(() => advance(30_000));
    expect(latest.session!.lockout.locked).toBe(false);
    await expect(signIn('budi.santoso', 'demo-2026')).resolves.toMatchObject({ ok: true, operator: { id: 'OPR-001' } });

    // The password is nowhere: not in the state, the audit rows, the runtime log or storage.
    expect(JSON.stringify(sim.store.getState())).not.toContain(WRONG);
    expect(JSON.stringify(runtimeLog.records())).not.toContain(WRONG);
    const stored = await AsyncStorage.multiGet(await AsyncStorage.getAllKeys());
    expect(JSON.stringify(stored)).not.toContain(WRONG);
    expect(JSON.stringify(stored)).not.toContain('budi.santoso');
  });

  it('refuses sign-in while the Core is offline in heartbeat mode (§4.1 L6), without an audit row', async () => {
    setCoreLinkSource('HEARTBEAT'); // no heartbeat arrives: the link is not LIVE
    const { sim, signIn } = await mount();
    const before = sim.store.getState().audit.total;
    await expect(signIn('budi.santoso', 'demo-2026')).resolves.toEqual({ ok: false, reason: 'CORE_OFFLINE' });
    expect(sim.store.getState().audit.total).toBe(before);
  });
});

describe('sign-out, Lock console and the idle lock (§3.3, §6.4, §4.19)', () => {
  it('Lock console signs out with reason LOCK and never touches the recording', async () => {
    const { sim, latest, signIn } = await mount({ scenario: 'recording' });
    await signIn('andi.pratama', 'demo-2026');
    act(() => latest.session!.lockConsole());
    expect(latest.auth!.isAuthenticated).toBe(false);
    expect(latest.session!.lastSignOut).toBe('LOCK');
    expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'AUTH_SIGNED_OUT', details: { reason: 'LOCK' } });
    expect(sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('expires the sign-in after 15 min without a touch and opens "Session expired"; recording continues', async () => {
    const { sim, latest, signIn, advance } = await mount({ scenario: 'recording' });
    await signIn('budi.santoso', 'demo-2026');
    act(() => advance(AUTH_IDLE_TIMEOUT_MS + 1_000, 1_000));
    expect(sim.store.getState().auth.status).toBe('EXPIRED');
    expect(latest.auth!.isAuthenticated).toBe(false);
    expect(latest.session!.lastSignOut).toBe('IDLE');
    expect(screen.getByTestId('idle-lock-dialog')).toBeTruthy();
    expect(screen.getByText('Session expired')).toBeTruthy();
    expect(sim.store.getState().session?.state).toBe('RECORDING');

    fireEvent.press(screen.getByTestId('idle-lock-confirm'));
    expect(screen.queryByTestId('idle-lock-dialog')).toBeNull();
    await signIn('budi.santoso', 'demo-2026');
    expect(latest.session!.lastSignOut).toBeNull();
  });

  it('counts a touch anywhere in the app as activity', async () => {
    const { sim, latest, signIn, advance } = await mount();
    await signIn('rina.wijaya', 'demo-2026');
    act(() => advance(10 * 60_000, 1_000));
    fireEvent(screen.getByTestId('auth-activity-boundary'), 'touchStart', {});
    act(() => advance(10 * 60_000, 1_000)); // 20 min after sign-in, 10 after the touch
    expect(sim.store.getState().auth.status).toBe('SIGNED_IN');
    expect(latest.auth!.operator?.role).toBe('TECHNICIAN');
  });
});

describe('biometric enable offer and sign-in (§6.3)', () => {
  it('offers biometrics after a password sign-in; Enable binds the operator; the fingerprint then signs in', async () => {
    const { sim, latest, signIn } = await mount();
    await signIn('budi.santoso', 'demo-2026');
    await flushAsync();
    expect(screen.getByTestId('biometric-offer-dialog')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('biometric-offer-enable'));
    });
    expect(screen.queryByTestId('biometric-offer-dialog')).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(MOBILE_AUTH_KEY))!)).toEqual({ lastOperatorId: 'OPR-001', biometricEnabled: true });
    expect(latest.session!.biometric).toMatchObject({
      availability: 'available',
      enabled: true,
      lastOperatorId: 'OPR-001',
      lastOperator: { displayName: 'AKP Budi Santoso' },
    });

    act(() => latest.auth!.signOut());
    let result: Awaited<ReturnType<AuthSession['signInWithBiometric']>> | undefined;
    await act(async () => {
      result = await latest.session!.signInWithBiometric();
    });
    expect(result).toEqual({ kind: 'signed-in', operatorId: 'OPR-001' });
    expect(latest.auth!.operator?.id).toBe('OPR-001');
    expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'AUTH_SUCCESS', details: { method: 'BIOMETRIC' } });

    // Signing in again by password as the same operator does not offer again.
    act(() => latest.auth!.signOut());
    await signIn('budi.santoso', 'demo-2026');
    await flushAsync();
    expect(screen.queryByTestId('biometric-offer-dialog')).toBeNull();
  });

  it('Not now stores nothing; the fingerprint button stays unavailable', async () => {
    const { latest, signIn } = await mount();
    await signIn('budi.santoso', 'demo-2026');
    await flushAsync();
    fireEvent.press(screen.getByTestId('biometric-offer-decline'));
    expect(await AsyncStorage.getItem(MOBILE_AUTH_KEY)).toBeNull();
    let result: Awaited<ReturnType<AuthSession['signInWithBiometric']>> | undefined;
    await act(async () => {
      result = await latest.session!.signInWithBiometric();
    });
    expect(result).toEqual({ kind: 'unavailable' });
  });
});
