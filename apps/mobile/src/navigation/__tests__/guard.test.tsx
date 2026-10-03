// T-M03 (04_mobile_specs §10.1; MA-05, step 70): the Stack.Protected guard on the useAuth
// contract, the pending href and the §3.3 post-sign-in order (resync target, pending href, Home).
// Step 91a: the screens are real now (D88/D90/D108), so the param checks read the real screens'
// testIDs; a screen that reads a record or the session state gets a deterministic simulator in
// that state (`routeTestSim`).
// The harness must be the first import (see its header).
import { FakeRuntime, renderApp, resetShellState, routeTestSim, type RouteTestSimState } from '../testing/router-harness';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { SessionState } from '@dems/shared/domain';
import { router } from 'expo-router';
import { peekPendingHref } from '@/navigation/pending-href';
import { redirectSystemPath } from '../../app/+native-intent';

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

// The step every render of the real Start Session screen receives from its route (what step 70's
// stub printed as `stub-param-step`); the real screen still renders underneath.
const mockSessionNewSteps: number[] = [];
jest.mock('@/features/session-new/session-new-screen', () => {
  const actual = jest.requireActual<typeof import('@/features/session-new/session-new-screen')>('@/features/session-new/session-new-screen');
  return {
    ...actual,
    SessionNewScreen: (props: Parameters<typeof actual.SessionNewScreen>[0]) => {
      mockSessionNewSteps.push(props.step);
      return <actual.SessionNewScreen {...props} />;
    },
  };
});

const originalFetch = global.fetch;

beforeEach(() => {
  resetShellState();
  mockSessionNewSteps.length = 0;
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('T-M03 auth guard', () => {
  it('sends an unauthenticated /evidence to /login and keeps /evidence as the pending href', () => {
    const app = renderApp('/evidence', { runtime: new FakeRuntime() });
    expect(app.getPathname()).toBe('/login');
    expect(screen.getByTestId('screen-login')).toBeTruthy();
    expect(screen.queryByTestId('screen-evidence')).toBeNull();
    expect(peekPendingHref()).toBe('/evidence');
  });

  it('opens the pending href after sign-in, then forgets it', () => {
    const runtime = new FakeRuntime();
    const app = renderApp('/evidence', { runtime });
    runtime.signInAs();
    expect(app.getPathname()).toBe('/evidence');
    expect(screen.getByTestId('screen-evidence')).toBeTruthy();
    expect(peekPendingHref()).toBeNull();
  });

  it('keeps the query of the pending href but drops the global motion switches', () => {
    const runtime = new FakeRuntime();
    const app = renderApp('/evidence?selected=EV-20261001-0007&motion=off&debug=1', { runtime, window: 'tabletLandscape', sim: routeTestSim() });
    expect(peekPendingHref()).toBe('/evidence?selected=EV-20261001-0007');
    runtime.signInAs();
    expect(app.getPathname()).toBe('/evidence');
    expect(app.getSearchParams()).toEqual({ selected: 'EV-20261001-0007' });
    // The real list opens the selection in its detail pane (tablet, 04 §2.5).
    expect(within(screen.getByTestId('pane-detail')).getByTestId('evidence-detail-id')).toHaveTextContent('EV-20261001-0007');
  });

  it('lets the resync target win over the pending href while a session is recording', () => {
    const runtime = new FakeRuntime();
    const app = renderApp('/evidence', { runtime });
    runtime.setSession('RECORDING', 'S-20261001-0009', Date.now());
    runtime.signInAs();
    expect(app.getPathname()).toBe('/session/live');
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    expect(peekPendingHref()).toBeNull();
  });

  const resyncCases: [SessionState, string, number | null][] = [
    ['CREATE', '/session/new', 1],
    ['PRECHECK', '/session/new', 2],
    ['ARMED', '/session/new', 3],
    ['FINALIZING', '/session/finalizing', null],
    ['FAULT', '/session/recovery', null],
  ];

  it.each(resyncCases)('resyncs a %s session to %s after sign-in', (state, pathname, step) => {
    const runtime = new FakeRuntime();
    // The real wizard reads the simulator's session, so it is driven to the same state.
    const sim = step ? routeTestSim(state as RouteTestSimState) : undefined;
    const app = renderApp('/login', { runtime, sim });
    runtime.setSession(state);
    runtime.signInAs();
    expect(app.getPathname()).toBe(pathname);
    if (step) {
      // The resync target's step reached the screen, and the real wizard shows that step.
      expect(new Set(mockSessionNewSteps)).toEqual(new Set([step]));
      expect(screen.getByTestId(`session-new-step-${step}`)).toBeTruthy();
    }
  });

  it('opens the pending href after a sign-in that started over a public screen', () => {
    // A guarded link reaching the running app on /stack-check: +native-intent keeps it pending
    // and opens /login over the public screen, which is still underneath after the sign-in.
    const runtime = new FakeRuntime();
    const app = renderApp('/stack-check', { runtime });
    expect(redirectSystemPath({ path: 'demsdemo:///audit', initial: false })).toBe('/login');
    act(() => router.push('/login'));
    expect(app.getPathname()).toBe('/login');
    runtime.signInAs();
    expect(app.getPathname()).toBe('/audit');
    expect(screen.getByTestId('screen-audit')).toBeTruthy();
  });

  it('lands on /home after sign-in when nothing is pending or active', () => {
    const runtime = new FakeRuntime();
    const app = renderApp('/', { runtime });
    expect(app.getPathname()).toBe('/login');
    runtime.signInAs();
    expect(app.getPathname()).toBe('/home');
    expect(screen.getByTestId('screen-home')).toBeTruthy();
  });

  it('returns to /login on sign-out, and a later sign-in does not reuse an old link', () => {
    const runtime = new FakeRuntime();
    const app = renderApp('/audit', { runtime });
    runtime.signInAs();
    expect(app.getPathname()).toBe('/audit');
    runtime.signOut();
    expect(app.getPathname()).toBe('/login');
    runtime.signInAs();
    expect(app.getPathname()).toBe('/home');
  });

  it('never shows /login to a signed-in operator', () => {
    const runtime = new FakeRuntime();
    runtime.signInAs();
    const app = renderApp('/login', { runtime });
    expect(app.getPathname()).toBe('/home');
    expect(screen.queryByTestId('screen-login')).toBeNull();
  });

  it('keeps the public routes open while signed out', () => {
    for (const [url, id] of [
      ['/pair', 'pair'],
      ['/stack-check', 'stack-check'],
      ['/?motion=slow', 'stack-check'],
    ] as const) {
      const app = renderApp(url, { runtime: new FakeRuntime() });
      expect(screen.getByTestId(`screen-${id}`)).toBeTruthy();
      app.unmount();
    }
  });

  it('signs in through the Login form and then opens the pending href', async () => {
    // Step 75 (D69) replaced the development-only placeholder button with the real Login screen.
    const runtime = new FakeRuntime();
    const app = renderApp('/devices', { runtime });
    expect(app.getPathname()).toBe('/login');
    fireEvent.changeText(screen.getByTestId('login-username'), 'budi.santoso');
    fireEvent.changeText(screen.getByTestId('login-password'), 'any-password');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });
    expect(runtime.signInCalls).toEqual(['budi.santoso']);
    expect(app.getPathname()).toBe('/devices');
    expect(screen.getByTestId('screen-devices')).toBeTruthy();
  });
});

describe('session deep-link policies (04 §3.5)', () => {
  it('redirects /session/live to /home when nothing is recording', () => {
    const runtime = new FakeRuntime();
    runtime.signInAs();
    const app = renderApp('/session/live', { runtime });
    expect(app.getPathname()).toBe('/home');
  });

  it('refuses /session/new while a session is recording and opens the monitor instead', () => {
    const runtime = new FakeRuntime();
    runtime.signInAs();
    runtime.setSession('RECORDING', 'S-20261001-0009', Date.now());
    const app = renderApp('/session/new?step=1', { runtime });
    expect(app.getPathname()).toBe('/session/live');
    expect(screen.queryByTestId('screen-session-new')).toBeNull();
  });

  it('keeps the wizard open for its own states (ARMED on step 3)', () => {
    const runtime = new FakeRuntime();
    runtime.signInAs();
    runtime.setSession('ARMED');
    const app = renderApp('/session/new?step=3', { runtime, sim: routeTestSim('ARMED') });
    expect(app.getPathname()).toBe('/session/new');
    expect(new Set(mockSessionNewSteps)).toEqual(new Set([3]));
    expect(screen.getByTestId('session-new-step-3')).toBeTruthy();
  });
});
