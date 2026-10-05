// Row M1 (decision D157 DN-9; W67 finding F-6): the `busy` prop of the §3.6 `BackGuardDialog`.
// LB-1 (04_client_integration_spec §8.1): while the leave action's command is out the leave button
// carries `accessibilityState.busy`, shows the kit's Spinner inside itself (nothing moves outside it),
// and a further press is ignored. Without the prop the dialog is exactly as before (W60's own test,
// `back-guard.test.tsx`, stays as it is). Harness first (see its header).
import { renderRoutes, resetShellState } from '../testing/router-harness';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Stack, router } from 'expo-router';
import { Dialog } from 'heroui-native';
import { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import type { SocketLike } from '@dems/shared/realtime';
import { BackGuardDialog, useBackGuard, type BackGuardDialogVariant } from '@/navigation/back-guard';
import { BackGuardDialog as BarrelBackGuardDialog } from '@/navigation';
import { AppProviders } from '@/providers';

class IdleSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {}
}

/** What the test sets: the variant, the screen's confirm action, and the two props (undefined = not passed). */
const config: { variant: BackGuardDialogVariant; onConfirm: jest.Mock<() => void> | undefined; busy: boolean | undefined; pending: boolean | undefined } = {
  variant: 'flow',
  onConfirm: undefined,
  busy: undefined,
  pending: undefined,
};
const listeners = new Set<() => void>();
let version = 0;
function setBusy(busy: boolean | undefined, pending?: boolean): void {
  act(() => {
    config.busy = busy;
    config.pending = pending;
    version += 1;
    for (const listener of listeners) listener();
  });
}

function Root() {
  return (
    <AppProviders
      safeAreaMetrics={{ frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}
      queryClient={new QueryClient()}
      heartbeatSocketFactory={() => new IdleSocket()}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

function Guarded() {
  // Re-render when the test changes `busy`.
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  const guard = useBackGuard({ enabled: true });
  return (
    <View testID="screen-guarded">
      <Text testID="prompting">{String(guard.isPrompting)}</Text>
      <BackGuardDialog
        guard={guard}
        variant={config.variant}
        {...(config.onConfirm ? { onConfirm: config.onConfirm } : {})}
        {...(config.busy === undefined ? {} : { busy: config.busy })}
        {...(config.pending === undefined ? {} : { pending: config.pending })}
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

function promptOnGuarded() {
  const app = renderRoutes(ROUTES, '/');
  act(() => router.push('/guarded' as never));
  act(() => router.back());
  expect(app.getPathname()).toBe('/guarded');
  expect(screen.getByTestId('prompting')).toHaveTextContent('true');
  return app;
}

const leave = () => screen.getByTestId('back-guard-leave');
/** Every test ID under the dialog that is not inside the leave button. */
function idsOutsideLeave(): string[] {
  const inside = new Set(within(leave()).queryAllByTestId(/.*/).map((node) => node));
  return within(screen.getByTestId('back-guard-dialog'))
    .queryAllByTestId(/.*/)
    .filter((node) => !inside.has(node) && node !== leave())
    .map((node) => String(node.props.testID))
    .sort();
}

beforeEach(() => {
  resetShellState();
  listeners.clear();
  version = 0;
  Object.assign(config, { variant: 'flow', onConfirm: jest.fn(), busy: undefined, pending: undefined });
});

describe('BackGuardDialog `busy` (LB-1; row M1)', () => {
  it('not passed, or false: the leave button is as before: no busy state, no spinner, a press runs the confirm action', () => {
    promptOnGuarded();
    expect(leave().props.accessibilityState?.busy).not.toBe(true);
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
    const before = idsOutsideLeave();
    setBusy(false);
    expect(leave().props.accessibilityState?.busy).not.toBe(true);
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
    expect(idsOutsideLeave()).toEqual(before);
    act(() => {
      fireEvent.press(leave());
    });
    expect(config.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('busy: the leave button is marked busy and shows the kit\'s Spinner inside itself; nothing is added outside it', () => {
    promptOnGuarded();
    const outside = idsOutsideLeave();
    setBusy(true);
    expect(leave().props.accessibilityState).toMatchObject({ busy: true });
    expect(within(leave()).getByTestId('back-guard-leave-spinner')).toBeTruthy();
    expect(idsOutsideLeave()).toEqual(outside);
    // The label stays.
    expect(within(leave()).getByText('Cancel session')).toBeTruthy();
  });

  it('busy: a second and a third press are ignored (flow: the confirm action does not run again)', () => {
    promptOnGuarded();
    act(() => {
      fireEvent.press(leave());
    });
    expect(config.onConfirm).toHaveBeenCalledTimes(1);
    setBusy(true);
    act(() => {
      fireEvent.press(leave());
      fireEvent.press(leave());
    });
    expect(config.onConfirm).toHaveBeenCalledTimes(1);
    // The answer came: not busy any more, the next press runs it again.
    setBusy(false);
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
    act(() => {
      fireEvent.press(leave());
    });
    expect(config.onConfirm).toHaveBeenCalledTimes(2);
  });

  it('busy, monitor variant: "Go to Home" does not leave while busy; it leaves once not busy', () => {
    config.variant = 'monitor';
    const app = promptOnGuarded();
    setBusy(true);
    act(() => {
      fireEvent.press(leave());
    });
    expect(app.getPathname()).toBe('/guarded');
    setBusy(false);
    act(() => {
      fireEvent.press(leave());
    });
    expect(app.getPathname()).toBe('/home');
  });

  it('busy holds the dialog (F5; S3-1, B-6): "Stay" is disabled and ignored; once not busy it drops the held attempt as before', () => {
    const app = promptOnGuarded();
    setBusy(true);
    expect(screen.getByTestId('back-guard-stay').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('back-guard-stay'));
    expect(screen.getByTestId('prompting')).toHaveTextContent('true');
    expect(screen.getByTestId('back-guard-dialog')).toBeTruthy();
    setBusy(false);
    expect(screen.getByTestId('back-guard-stay').props.accessibilityState?.disabled).not.toBe(true);
    fireEvent.press(screen.getByTestId('back-guard-stay'));
    expect(screen.getByTestId('prompting')).toHaveTextContent('false');
    expect(app.getPathname()).toBe('/guarded');
  });

  it('busy: a request to dismiss the dialog (the kit\'s onOpenChange(false): overlay, close part) is ignored; not busy it drops the attempt as before', () => {
    promptOnGuarded();
    const dismiss = () =>
      act(() => {
        (screen.UNSAFE_getByType(Dialog).props as { onOpenChange: (open: boolean) => void }).onOpenChange(false);
      });
    setBusy(true);
    dismiss();
    expect(screen.getByTestId('prompting')).toHaveTextContent('true');
    setBusy(false);
    dismiss();
    expect(screen.getByTestId('prompting')).toHaveTextContent('false');
  });

  it('not busy: "Stay" carries no disabled state (the default dialog is unchanged)', () => {
    promptOnGuarded();
    expect(screen.getByTestId('back-guard-stay').props.accessibilityState?.disabled).not.toBe(true);
    setBusy(false);
    expect(screen.getByTestId('back-guard-stay').props.accessibilityState?.disabled).not.toBe(true);
  });

  it('DN-4, busy at the press and the spinner late: `busy` without `pending` marks the button busy and shows no spinner; `pending` adds the Spinner', () => {
    promptOnGuarded();
    const outside = idsOutsideLeave();
    setBusy(true, false);
    expect(leave().props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
    expect(idsOutsideLeave()).toEqual(outside);
    act(() => {
      fireEvent.press(leave());
    });
    expect(config.onConfirm).not.toHaveBeenCalled();
    setBusy(true, true);
    expect(leave().props.accessibilityState).toMatchObject({ busy: true });
    expect(within(leave()).getByTestId('back-guard-leave-spinner')).toBeTruthy();
    expect(idsOutsideLeave()).toEqual(outside);
    setBusy(false, false);
    expect(leave().props.accessibilityState?.busy).not.toBe(true);
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
  });

  it('`pending` alone shows the Spinner but does not hold the button (the caller decides what is busy)', () => {
    promptOnGuarded();
    setBusy(undefined, true);
    expect(within(leave()).getByTestId('back-guard-leave-spinner')).toBeTruthy();
    expect(leave().props.accessibilityState?.busy).not.toBe(true);
  });

  it('`pending` omitted: the spinner follows `busy`, so a caller of the first form keeps its behaviour', () => {
    promptOnGuarded();
    setBusy(true);
    expect(within(leave()).getByTestId('back-guard-leave-spinner')).toBeTruthy();
    setBusy(false);
    expect(screen.queryByTestId('back-guard-leave-spinner')).toBeNull();
  });

  it('is the dialog the navigation barrel hands out', () => {
    expect(BarrelBackGuardDialog).toBe(BackGuardDialog);
  });
});
