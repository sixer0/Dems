// Back-guard infrastructure (04_mobile_specs §3.6; step 70): `useBackGuard` on Expo Router's
// `usePreventRemove`, and the `BackGuardDialog`. The session screens (steps 78, 79, 80) decide
// when it is on; T-M08 (step 79) covers the monitor itself. Harness first (see its header).
import { renderRoutes, resetShellState } from '../testing/router-harness';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Stack, router } from 'expo-router';
import { Text, View } from 'react-native';
import type { SocketLike } from '@dems/shared/realtime';
import { BackGuardDialog, useBackGuard, type BackGuardDialogVariant, type BackGuardMode } from '@/navigation/back-guard';
import { AppProviders } from '@/providers';

class IdleSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {}
}

const config: {
  enabled: boolean;
  mode: BackGuardMode;
  variant: BackGuardDialogVariant;
  onBlocked: jest.Mock<() => void>;
  onConfirm: jest.Mock<() => void> | undefined;
} = { enabled: true, mode: 'confirm', variant: 'monitor', onBlocked: jest.fn(), onConfirm: undefined };

function Root() {
  return (
    <AppProviders
      safeAreaMetrics={{ frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}
      queryClient={new QueryClient({ defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY } } })}
      heartbeatSocketFactory={() => new IdleSocket()}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

function Guarded() {
  const guard = useBackGuard({ enabled: config.enabled, mode: config.mode, onBlocked: config.onBlocked });
  return (
    <View testID="screen-guarded">
      <Text testID="prompting">{String(guard.isPrompting)}</Text>
      <BackGuardDialog
        guard={guard}
        variant={config.variant}
        {...(config.onConfirm
          ? {
              onConfirm: () => {
                config.onConfirm?.();
                guard.leave();
              },
            }
          : {})}
      />
    </View>
  );
}

const ROUTES = {
  _layout: Root,
  index: () => <Text testID="screen-index">index</Text>,
  home: () => <Text testID="screen-home">home</Text>,
  guarded: Guarded,
};

function openGuarded() {
  const app = renderRoutes(ROUTES, '/');
  act(() => router.push('/guarded' as never));
  expect(app.getPathname()).toBe('/guarded');
  return app;
}

beforeEach(() => {
  resetShellState();
  Object.assign(config, { enabled: true, mode: 'confirm', variant: 'monitor', onConfirm: undefined });
  config.onBlocked = jest.fn();
});

describe('useBackGuard', () => {
  it('holds Back while enabled and opens the monitor dialog; Stay keeps the screen', () => {
    const app = openGuarded();
    act(() => router.back());
    expect(app.getPathname()).toBe('/guarded');
    expect(screen.getByTestId('prompting')).toHaveTextContent('true');
    expect(screen.getByText('Recording continues on the Core. Leave the monitor?')).toBeTruthy();

    fireEvent.press(screen.getByTestId('back-guard-stay'));
    expect(screen.getByTestId('prompting')).toHaveTextContent('false');
    expect(app.getPathname()).toBe('/guarded');
  });

  it('"Go to Home" leaves the monitor for /home (04 §3.6)', () => {
    const app = openGuarded();
    act(() => router.back());
    act(() => {
      fireEvent.press(screen.getByTestId('back-guard-leave'));
    });
    expect(app.getPathname()).toBe('/home');
  });

  it('flow variant: "Cancel session" runs the screen action, then performs the held Back', () => {
    config.variant = 'flow';
    config.onConfirm = jest.fn();
    const app = openGuarded();
    act(() => router.back());
    expect(screen.getByText('Cancel this session?')).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByTestId('back-guard-leave'));
    });
    expect(config.onConfirm).toHaveBeenCalledTimes(1);
    expect(app.getPathname()).toBe('/');
  });

  it('block mode drops the attempt and reports it (FINALIZING toast)', () => {
    config.mode = 'block';
    const app = openGuarded();
    act(() => router.back());
    expect(app.getPathname()).toBe('/guarded');
    expect(config.onBlocked).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('prompting')).toHaveTextContent('false');
  });

  it('lets Back through when disabled', () => {
    config.enabled = false;
    const app = openGuarded();
    act(() => router.back());
    expect(app.getPathname()).toBe('/');
  });
});
