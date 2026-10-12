// AppProviders (04_mobile_specs §3.2) and BootGate (§3.2 splash hold, M-MB-05).
// Gesture Handler's own jest mocks, first: GestureHandlerRootView installs a native module that jest
// lacks. (Hand-over note for step 67/73: add this import to jest.setup.ts so every suite gets it.)
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useTranslation } from 'react-i18next';
import { Dimensions, Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { useHeartbeat, type SocketLike } from '@dems/shared/realtime';
import { NAV_DIMENSIONS, useLayoutClass } from '@/layout';
import { toastAreaOffsets, toastContentWrapper } from './toast-area';
import { AppProviders, BootGate, MAX_FONT_SIZE_MULTIPLIER, SPLASH_MAX_HOLD_MS, heroUIConfig } from '@/providers';
import { RuntimeContractProvider, createRuntimeContract, useAuth, useCoreLink } from '@/runtime';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => undefined),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};

class FakeSocket implements SocketLike {
  readyState = 1;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

/** Reads one value from every provider layer. */
function Probe() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const heartbeat = useHeartbeat();
  const auth = useAuth();
  const coreLink = useCoreLink();
  const { layoutClass } = useLayoutClass();
  return (
    <Text testID="probe">
      {[
        t('mobile.nav.home'),
        queryClient ? 'query' : 'no-query',
        heartbeat.state,
        auth.isAuthenticated ? 'in' : 'out',
        coreLink.source,
        layoutClass,
      ].join('|')}
    </Text>
  );
}

describe('heroUIConfig', () => {
  it('caps font scaling and puts toasts at the top', () => {
    expect(heroUIConfig(false)).toEqual({
      textProps: { maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER },
      toast: { defaultProps: { placement: 'top' }, contentWrapper: toastContentWrapper },
    });
  });

  // Fix wave Q (CT-04: the critical toast covered the page title, the clock, the bell, the account button and the
  // rail's "Home" and "Sessions"): the toast area is the content area of the window's layout class.
  it('CT-04: the toast area lies under the header row and beside the navigation rail; a phone has no rail and keeps its tab bar free (top toasts)', () => {
    const header = NAV_DIMENSIONS.headerHeight;
    // The tablet of the finding (1280 x 800 dp, extended rail) and its portrait; the phone both ways.
    expect(toastAreaOffsets(1280, 800)).toEqual({ top: header, start: NAV_DIMENSIONS.extendedRail });
    expect(toastAreaOffsets(800, 1280)).toEqual({ top: header, start: NAV_DIMENSIONS.rail });
    expect(toastAreaOffsets(411, 923)).toEqual({ top: header, start: 0 });
    expect(toastAreaOffsets(923, 411)).toEqual({ top: header, start: NAV_DIMENSIONS.compactRail });
    expect(header).toBeGreaterThan(0);
    expect(NAV_DIMENSIONS.extendedRail).toBeGreaterThan(0);

    const area = render(toastContentWrapper(<Text testID="a-toast">toast</Text>));
    const view = area.getByTestId('toast-area');
    // It takes no touch itself, and offsets its own box (the kit positions toasts against it).
    expect(view.props.pointerEvents).toBe('box-none');
    expect(view.props.style).toMatchObject({ flex: 1, marginTop: header });
    expect(area.getByTestId('a-toast')).toBeTruthy();
  });

  it("switches every kit animation off under reduced motion ('disable-all', VM-04)", () => {
    expect(heroUIConfig(true).animation).toBe('disable-all');
  });
});

describe('AppProviders', () => {
  it('provides i18n, Query, heartbeat, the runtime stub and safe areas to the app', () => {
    // dems_phone portrait window (04 §2.1); jest's default window is 750 x 1334 dp.
    Dimensions.set({
      window: { width: 411, height: 923, scale: 2.625, fontScale: 1 },
      screen: { width: 411, height: 923, scale: 2.625, fontScale: 1 },
    });
    const socket = new FakeSocket();
    render(
      <AppProviders safeAreaMetrics={METRICS} heartbeatSocketFactory={() => socket}>
        <Probe />
      </AppProviders>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('Home|query|CONNECTING|out|SIMULATED|compact');
  });

  it('renders under reduced motion too', () => {
    render(
      <AppProviders reducedMotion safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new FakeSocket()}>
        <Text>reduced</Text>
      </AppProviders>,
    );
    expect(screen.getByText('reduced')).toBeTruthy();
  });

  it('refreshes the health query and calls onHeartbeatResync after a reconnect', () => {
    const sockets: FakeSocket[] = [];
    const onHeartbeatResync = jest.fn();
    jest.useFakeTimers();
    try {
      render(
        <AppProviders
          safeAreaMetrics={METRICS}
          heartbeatSocketFactory={() => {
            const socket = new FakeSocket();
            sockets.push(socket);
            return socket;
          }}
          onHeartbeatResync={onHeartbeatResync}
        >
          <Text>app</Text>
        </AppProviders>,
      );
      const beat = (seq: number) =>
        JSON.stringify({ type: 'heartbeat', v: 1, seq, serverTime: '2026-10-01T02:00:00.000Z', uptimeMs: 1, intervalMs: 1000, clients: 1, sessionState: null });

      act(() => sockets[0]!.onmessage?.({ data: beat(1) }));
      act(() => sockets[0]!.onclose?.({}));
      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      const latest = sockets[sockets.length - 1]!;
      act(() => latest.onmessage?.({ data: beat(2) }));
      expect(sockets.length).toBeGreaterThan(1);
      expect(onHeartbeatResync).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('BootGate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function renderGate(ready: boolean) {
    const ui = (isReady: boolean) => (
      <AppProviders safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new FakeSocket()}>
        <RuntimeContractProvider value={createRuntimeContract({ status: { ready: isReady, implementation: 'stub' } })}>
          <BootGate>
            <Text>app ready</Text>
          </BootGate>
        </RuntimeContractProvider>
      </AppProviders>
    );
    const utils = render(ui(ready));
    return { ...utils, setReady: (next: boolean) => utils.rerender(ui(next)) };
  }

  it('renders the app and hides the splash at once when the runtime is ready (stub)', () => {
    renderGate(true);
    expect(screen.getByText('app ready')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('holds the splash up to 2 s, then shows the boot skeleton until ready', () => {
    const { setReady } = renderGate(false);
    expect(screen.queryByText('app ready')).toBeNull();
    expect(screen.queryByTestId('screen-boot')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(SPLASH_MAX_HOLD_MS);
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(screen.getByTestId('screen-boot')).toBeTruthy();
    expect(screen.getByLabelText('Starting DEMS Edge Client')).toBeTruthy();

    setReady(true);
    expect(screen.getByText('app ready')).toBeTruthy();
    expect(screen.queryByTestId('screen-boot')).toBeNull();
  });
});
