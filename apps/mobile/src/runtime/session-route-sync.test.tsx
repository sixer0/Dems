// SessionRouteSync (04_mobile_specs §3.7 triggers 2 and 3): forced navigation only on a heartbeat
// resync and on simulator-driven flow transitions; never on mount, never for a plain state change.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { resetAuthPrefsForTests } from '@/auth';
import { createRuntimeContract, RuntimeContractProvider, type ActiveSessionInfo } from './contract';
import { resetCoreLinkPrefsForTests } from './core-link';
import { RuntimeInternalsContext } from './internals';
import { createResyncBus } from './resync-bus';
import { SessionRouteSync } from './session-route-sync';
import { RuntimeTestProviders, createTestSim, flushAsync } from './testing/test-sim';

const mockReplace = jest.fn();
const mockRoute = { pathname: '/home' };

jest.mock('expo-router/build/hooks', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockRoute.pathname,
}));

beforeEach(async () => {
  mockReplace.mockClear();
  mockRoute.pathname = '/home';
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetAuthPrefsForTests();
});

/** SessionRouteSync over a fake contract the test changes. */
function renderWithFakeSession(initial: ActiveSessionInfo) {
  const { sim } = createTestSim();
  const bus = createResyncBus();
  const ui = (session: ActiveSessionInfo) => (
    <RuntimeInternalsContext.Provider value={{ sim, resyncBus: bus }}>
      <RuntimeContractProvider value={createRuntimeContract({ session })}>
        <SessionRouteSync />
      </RuntimeContractProvider>
    </RuntimeInternalsContext.Provider>
  );
  const utils = render(ui(initial));
  return { bus, setSession: (session: ActiveSessionInfo) => utils.rerender(ui(session)) };
}

const session = (state: ActiveSessionInfo['state'], extra: Partial<ActiveSessionInfo> = {}): ActiveSessionInfo => ({
  state,
  sessionId: state ? 'SES-20261001-0024' : null,
  startedAtMs: null,
  ...extra,
});

describe('SessionRouteSync with a fake contract', () => {
  it('does not navigate on mount (sign-in routing is the boot router’s, §3.3)', () => {
    renderWithFakeSession(session('RECORDING'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('never yanks the operator for a recording that starts or keeps going (the mini-bar shows instead)', () => {
    mockRoute.pathname = '/evidence';
    const { setSession } = renderWithFakeSession(session(null));
    setSession(session('ARMED'));
    setSession(session('RECORDING'));
    setSession(session('STOPPING'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('follows STOPPING → FINALIZING → SEALED to the finalizing screen and then the summary', () => {
    mockRoute.pathname = '/session/live';
    const { setSession } = renderWithFakeSession(session('STOPPING'));
    setSession(session('FINALIZING'));
    expect(mockReplace).toHaveBeenLastCalledWith('/session/finalizing');
    mockRoute.pathname = '/session/finalizing';
    setSession(session('SEALED', { summaryAcknowledged: false }));
    expect(mockReplace).toHaveBeenLastCalledWith('/session/summary/SES-20261001-0024');
    expect(mockReplace).toHaveBeenCalledTimes(2);
  });

  it('sends any state that faults to the recovery screen, wherever the operator is', () => {
    mockRoute.pathname = '/evidence';
    const { setSession } = renderWithFakeSession(session('RECORDING'));
    setSession(session('FAULT'));
    expect(mockReplace).toHaveBeenCalledWith('/session/recovery');
  });

  it('does not navigate when already on the target', () => {
    mockRoute.pathname = '/session/finalizing';
    const { setSession } = renderWithFakeSession(session('STOPPING'));
    setSession(session('FINALIZING'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('resyncs on the heartbeat signal (§5.5) to where the session belongs', () => {
    mockRoute.pathname = '/evidence';
    const { bus, setSession } = renderWithFakeSession(session('RECORDING'));
    act(() => bus.emit());
    expect(mockReplace).toHaveBeenCalledWith('/session/live');
    mockReplace.mockClear();
    mockRoute.pathname = '/session/live';
    setSession(session('RECORDING')); // a route change re-renders the component (usePathname)
    act(() => bus.emit());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('SessionRouteSync over the real simulator runtime', () => {
  it('moves from the finalizing screen to the sealed summary when the simulator seals the evidence', async () => {
    const { sim, advance } = createTestSim({ scenario: 'finalizing' });
    mockRoute.pathname = '/session/finalizing';
    render(
      <RuntimeTestProviders sim={sim}>
        <SessionRouteSync />
      </RuntimeTestProviders>,
    );
    await flushAsync();
    expect(sim.store.getState().session?.state).toBe('FINALIZING');
    expect(mockReplace).not.toHaveBeenCalled();

    act(() => advance(8_000));
    expect(sim.store.getState().session?.state).toBe('SEALED');
    expect(mockReplace).toHaveBeenCalledWith(`/session/summary/${sim.store.getState().session!.id}`);
  });
});
