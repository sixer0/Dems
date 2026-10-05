// Backend task W60 (blueprint step 82): the mobile pairing gate (04_client_integration_spec §9.4
// MP-11, MP-12, §6.6; Q5; GC-02; AC-C-31, AC-C-50, AC-C-73, AC-C-74, AC-C-78, AC-C-79).
//
// These are ROUTE tests: they render the real route tree (the same harness the auth-guard tests use)
// and drive the pairing-required gate through the runtime contract, exactly as the LIVE runtime does
// (`usePairing()` → `isPairingBlocked()`). They prove the gate's routing rules per route, the pending
// deep link while blocked, and the return to `/pair` on a revocation. The gate values themselves are
// produced by the real runtime over the contract-checked fake transport in `pairing-gate-live.test.tsx`.
//
// The gate is inert unless `pairing.required` is true, which happens only in LIVE mode; SIMULATED and
// HEARTBEAT leave `pairing` absent, so the guards behave as before (AC-C-74). The existing guard tests
// in `guard.test.tsx` are unchanged and cover that mode; here one case re-states it explicitly.
// The harness must be the first import (see its header).
import { FakeRuntime, renderApp, resetShellState, routeTestSim, type RouteTestSimState } from '../testing/router-harness';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { peekPendingHref } from '@/navigation/pending-href';
import { PAIRING_CHECKING, type PairingInfo } from '@/runtime';

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

const originalFetch = global.fetch;

beforeEach(() => {
  resetShellState();
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ---------------------------------------------------------------------------------------------
// The gate fixtures (MP-9 / MP-11). `required: true` is what only LIVE mode sets.
// ---------------------------------------------------------------------------------------------

const LIVE_UNPAIRED: PairingInfo = { required: true, state: 'UNPAIRED', notice: null, deviceId: null };
const LIVE_REVOKED: PairingInfo = { required: true, state: 'UNPAIRED', notice: 'revoked', deviceId: null };
const LIVE_UNKNOWN: PairingInfo = { required: true, state: 'UNPAIRED', notice: 'unknown', deviceId: null };
const LIVE_PAIRED: PairingInfo = { required: true, state: 'PAIRED', notice: null, deviceId: 'DEV-0003' };

/** A blocked runtime: LIVE mode, device not PAIRED. */
function blockedRuntime(pairing: PairingInfo = LIVE_UNPAIRED): FakeRuntime {
  return new FakeRuntime({ pairing });
}

describe('pairing gate: an unpaired device in LIVE mode boots to /pair (AC-C-73)', () => {
  it('boots / to /pair and shows only the Pair screen', () => {
    const app = renderApp('/', { runtime: blockedRuntime() });
    expect(app.getPathname()).toBe('/pair');
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
    expect(screen.queryByTestId('screen-login')).toBeNull();
  });

  const unreachable: [string, string][] = [
    ['/login', 'login'],
    ['/home', 'home'],
    ['/dev-gallery', 'dev-gallery'],
  ];
  it.each(unreachable)('does not let %s through while blocked (lands on /pair)', (url, id) => {
    const app = renderApp(url, { runtime: blockedRuntime() });
    expect(app.getPathname()).toBe('/pair');
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
    expect(screen.queryByTestId(`screen-${id}`)).toBeNull();
  });

  it('keeps /stack-check reachable while blocked', () => {
    renderApp('/stack-check', { runtime: blockedRuntime() });
    expect(screen.getByTestId('screen-stack-check')).toBeTruthy();
    expect(screen.queryByTestId('screen-pair')).toBeNull();
  });

  it('treats CHECKING (the credential still being read) as blocked too', () => {
    const app = renderApp('/home', { runtime: blockedRuntime(PAIRING_CHECKING) });
    expect(app.getPathname()).toBe('/pair');
  });

  const notices: [string, PairingInfo][] = [
    ['revoked', LIVE_REVOKED],
    ['unknown', LIVE_UNKNOWN],
  ];
  it.each(notices)('blocks with the %s notice set (the notice is the Pair screen’s, not the router’s)', (_label, pairing) => {
    const app = renderApp('/home', { runtime: blockedRuntime(pairing) });
    expect(app.getPathname()).toBe('/pair');
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
  });
});

describe('pairing gate: a guarded deep link while blocked stays pending (MP-12)', () => {
  it('records /evidence as pending and lands on /pair, then opens it after pairing and sign-in', () => {
    const runtime = blockedRuntime();
    const app = renderApp('/evidence', { runtime });
    // Blocked: the guarded link is kept, but the app lands on the one working screen.
    expect(app.getPathname()).toBe('/pair');
    expect(peekPendingHref()).toBe('/evidence');

    // Pairing releases the gate; the operator is still signed out. The Pair screen's hand-off
    // (W57) replaces '/' 2,400 ms after the answer; the boot router then picks /login, and the
    // pending href survives (it is used after BOTH the pairing and the sign-in).
    runtime.setPairing(LIVE_PAIRED);
    act(() => router.replace('/'));
    expect(app.getPathname()).toBe('/login');
    expect(peekPendingHref()).toBe('/evidence');

    // Sign-in now consumes it.
    act(() => runtime.signInAs());
    expect(app.getPathname()).toBe('/evidence');
    expect(screen.getByTestId('screen-evidence')).toBeTruthy();
    expect(peekPendingHref()).toBeNull();
  });

  it('drops the pending href on a sign-out, never resuming an old link across a re-pair', () => {
    const runtime = blockedRuntime();
    const app = renderApp('/audit', { runtime });
    expect(peekPendingHref()).toBe('/audit');
    // Pair and sign in: the pending link is consumed and the app is on a guarded screen.
    runtime.setPairing(LIVE_PAIRED);
    runtime.signInAs();
    expect(app.getPathname()).toBe('/audit');
    expect(peekPendingHref()).toBeNull();
    // A later sign-out clears any pending link; a fresh sign-in does not resurrect the old one.
    runtime.signOut();
    expect(peekPendingHref()).toBeNull();
  });
});

describe('pairing gate: pairing releases into Login and Home (AC-C-31, AC-C-50)', () => {
  it('a paired, signed-out device boots / to /login', () => {
    const app = renderApp('/', { runtime: new FakeRuntime({ pairing: LIVE_PAIRED }) });
    expect(app.getPathname()).toBe('/login');
    expect(screen.getByTestId('screen-login')).toBeTruthy();
  });

  it('a paired, signed-out device sends a guarded route to /login, not /pair', () => {
    const app = renderApp('/home', { runtime: new FakeRuntime({ pairing: LIVE_PAIRED }) });
    expect(app.getPathname()).toBe('/login');
    expect(screen.queryByTestId('screen-pair')).toBeNull();
  });

  it('a paired, signed-in device boots / to /home', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderApp('/', { runtime, sim: routeTestSim('IDLE' satisfies RouteTestSimState) });
    expect(app.getPathname()).toBe('/home');
    expect(screen.getByTestId('screen-home')).toBeTruthy();
  });

  it('releases /pair itself: a paired device still opens the Pair screen (Settings → Pairing details)', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderApp('/pair', { runtime, sim: routeTestSim('IDLE') });
    expect(app.getPathname()).toBe('/pair');
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
  });
});

describe('pairing gate: a revocation returns the app to /pair (AC-C-78, §6.6)', () => {
  it('a revocation of a signed-in paired device routes /home back to /pair', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderApp('/home', { runtime, sim: routeTestSim('IDLE') });
    expect(app.getPathname()).toBe('/home');

    // The Core revokes the pairing: the runtime signs the operator out and sets the gate UNPAIRED
    // with the `revoked` notice (§6.6). The guard removes both groups; the boot router opens /pair.
    act(() => {
      runtime.signOut();
      runtime.setPairing(LIVE_REVOKED);
    });
    expect(app.getPathname()).toBe('/pair');
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
    expect(screen.queryByTestId('screen-home')).toBeNull();
  });

  it('an unknown credential (401 on operation 21) likewise routes back to /pair (AC-C-79)', () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderApp('/home', { runtime, sim: routeTestSim('IDLE') });
    act(() => {
      runtime.signOut();
      runtime.setPairing(LIVE_UNKNOWN);
    });
    expect(app.getPathname()).toBe('/pair');
  });

  it('removes the app screens on the block alone, even while the session still reads signed-in (MP-11)', () => {
    // The `(app)` guard is "authenticated AND not blocked": a revocation that flips the gate before
    // the auth layer settles must still drop the app screens. Without the block term on `(app)` this
    // screen would stay up for an unpaired device.
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
    runtime.signInAs();
    const app = renderApp('/home', { runtime, sim: routeTestSim('IDLE') });
    expect(app.getPathname()).toBe('/home');
    act(() => runtime.setPairing(LIVE_REVOKED)); // gate blocks; operator not yet signed out
    expect(app.getPathname()).toBe('/pair');
    expect(screen.queryByTestId('screen-home')).toBeNull();
  });
});

describe('pairing gate: inert outside LIVE mode (AC-C-74)', () => {
  it('with no pairing member (SIMULATED / HEARTBEAT) the guards behave as before: /login is reachable', () => {
    // A bare FakeRuntime carries no `pairing`, exactly like every fake built before this row.
    const app = renderApp('/login', { runtime: new FakeRuntime() });
    expect(app.getPathname()).toBe('/login');
    expect(screen.getByTestId('screen-login')).toBeTruthy();
    expect(screen.queryByTestId('screen-pair')).toBeNull();
  });

  it('signs in through the Login form on a paired device and lands on the guarded route', async () => {
    const runtime = new FakeRuntime({ pairing: LIVE_PAIRED });
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

