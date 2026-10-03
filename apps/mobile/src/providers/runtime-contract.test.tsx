// The runtime contract (src/runtime), exercised the way steps 70 and 73 use it. Step 68 wrote this
// file against its stub; step 73 replaced the stub with the simulator runtime and rewrote the
// stub-specific cases (same describe blocks; the contract names and the fake injection are unchanged).
import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { resetAuthPrefsForTests } from '@/auth';
import {
  KeepAwakeController,
  RUNTIME_IMPLEMENTATION,
  RuntimeContractProvider,
  SessionRouteSync,
  createRuntimeContract,
  initialsFor,
  resetCoreLinkPrefsForTests,
  useActiveSession,
  useAuth,
  useCoreLink,
  useRuntime,
  useRuntimeStatus,
} from '@/runtime';
import { RuntimeTestProviders, createTestSim, flushAsync } from '@/runtime/testing/test-sim';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetAuthPrefsForTests();
});

describe('runtime contract outside any provider', () => {
  it('is ready, signed out, cannot sign in, Core link SIMULATED/ONLINE, no session', async () => {
    const { result } = renderHook(() => useRuntime());
    expect(result.current.status).toEqual({ ready: true, implementation: 'simulator' });
    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(result.current.auth.operator).toBeNull();
    await expect(result.current.auth.signIn('budi.santoso', 'x')).resolves.toEqual({ ok: false, reason: 'UNAVAILABLE' });
    expect(result.current.coreLink).toEqual({ source: 'SIMULATED', state: 'ONLINE' });
    expect(result.current.session).toEqual({ state: null, sessionId: null, startedAtMs: null });
  });

  it('marks itself as the simulator implementation (the step-68 stub is gone)', () => {
    expect(RUNTIME_IMPLEMENTATION).toBe('simulator');
  });
});

describe('SimRuntimeProvider + AuthProvider (the simulator runtime)', () => {
  function setup() {
    const { sim } = createTestSim();
    const wrapper = ({ children }: { children: ReactNode }) => <RuntimeTestProviders sim={sim}>{children}</RuntimeTestProviders>;
    return { sim, wrapper };
  }

  it('signs in a dataset operator through the simulator and signs out', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await flushAsync();
    expect(result.current.isAuthenticated).toBe(false);

    let outcome: Awaited<ReturnType<typeof result.current.signIn>> | undefined;
    await act(async () => {
      outcome = await result.current.signIn('budi.santoso', 'demo-2026');
    });
    expect(outcome).toMatchObject({
      ok: true,
      operator: { id: 'OPR-001', displayName: 'AKP Budi Santoso', initials: 'BS', role: 'INVESTIGATOR', username: 'budi.santoso' },
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.operator?.id).toBe('OPR-001');

    act(() => result.current.signOut('USER'));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.operator).toBeNull();
  });

  it('refuses a wrong password with the attempts left, and an unknown user the same way (generic error)', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await expect(result.current.signIn('budi.santoso', 'wrong')).resolves.toEqual({
        ok: false,
        reason: 'INVALID_CREDENTIALS',
        attemptsRemaining: 4,
      });
      await expect(result.current.signIn('nobody', 'demo-2026')).resolves.toEqual({
        ok: false,
        reason: 'INVALID_CREDENTIALS',
        attemptsRemaining: 3,
      });
    });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('provides the hydrated status, the simulated Core link and the idle session', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => [useCoreLink(), useActiveSession(), useRuntimeStatus()] as const, { wrapper });
    await flushAsync();
    expect(result.current[0]).toEqual({ source: 'SIMULATED', state: 'ONLINE' });
    expect(result.current[1]).toEqual({ state: null, sessionId: null, startedAtMs: null, summaryAcknowledged: true });
    expect(result.current[2]).toMatchObject({ ready: true, implementation: 'simulator', restored: false });
  });
});

describe('RuntimeContractProvider (fake injection for T-M03 and debug tooling)', () => {
  it('overrides any part of the contract', () => {
    const value = createRuntimeContract({
      status: { ready: false, implementation: 'stub' },
      coreLink: { source: 'HEARTBEAT', state: 'OFFLINE' },
      session: { state: 'RECORDING', sessionId: 'SES-20261001-0024', startedAtMs: 1_000 },
    });
    const { result } = renderHook(() => useRuntime(), {
      wrapper: ({ children }) => <RuntimeContractProvider value={value}>{children}</RuntimeContractProvider>,
    });
    expect(result.current.status.ready).toBe(false);
    expect(result.current.coreLink).toEqual({ source: 'HEARTBEAT', state: 'OFFLINE' });
    expect(result.current.session).toEqual({ state: 'RECORDING', sessionId: 'SES-20261001-0024', startedAtMs: 1_000 });
    expect(result.current.auth.isAuthenticated).toBe(false);
  });
});

describe('controllers', () => {
  it('SessionRouteSync and KeepAwakeController render nothing', () => {
    render(
      <RuntimeContractProvider value={createRuntimeContract()}>
        <SessionRouteSync />
        <KeepAwakeController />
        <Text>content</Text>
      </RuntimeContractProvider>,
    );
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.toJSON()).toMatchObject({ type: 'Text' });
  });
});

describe('initialsFor', () => {
  it.each([
    ['AKP Budi Santoso', 'BS'],
    ['budi.santoso', 'BS'],
    ['Rina Wijaya', 'RW'],
    ['rina', 'R'],
    ['', '?'],
  ])('%s → %s', (name, initials) => {
    expect(initialsFor(name)).toBe(initials);
  });
});
