// T-M02 (04_mobile_specs §10.1; MA-04, step 70): every route of the §3.1 tree renders its
// `screen-<id>` root, with its params parsed. Step 70 proved the parsing on placeholder stubs
// (`stub-param-<name>`); the screens are real now (D88/D90/D108), so step 91a asserts what each real
// screen shows for its params, on a deterministic simulator (`routeTestSim`, stable dataset IDs).
// The harness must be the first import (see its header).
import { FakeRuntime, renderApp, resetShellState, routeTestSim, type RouteTestSimState } from '../testing/router-harness';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROUTE_SCREENS } from '@/navigation/routes';

// Skia is proven on device (AC-31), not in jest (the N-1 precedent).
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

// The step every render of the real Start Session screen receives from its route (the zod parse
// step 70's stub printed as `stub-param-step`); the real screen still renders underneath.
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

const APP = path.resolve(__dirname, '../../app');
const FEATURES = path.resolve(__dirname, '../../features');

/** What the real screen shows for the parsed params: a testID, and the text it must contain. */
interface ParamProof {
  testID: string;
  text?: string;
}

/**
 * A concrete URL for every §3.1 route pattern, and how the real screen proves its params: `shows`
 * (rendered, with the parsed value), `hides` (an absent selection opens no detail on a phone) and,
 * for the wizard, `stepProp` (the step its route hands over). IDs are the D61 dataset's at
 * `TEST_START` (`SES-20261001-0017` holds `EV-20261001-0007`).
 */
const CASES: readonly {
  pattern: (typeof ROUTE_SCREENS)[number]['pattern'];
  url: string;
  signedIn: boolean;
  recording?: boolean;
  /** The session state of both the fake runtime (guard) and the simulator (the real screen). */
  sessionState?: Exclude<RouteTestSimState, 'IDLE'>;
  shows?: readonly ParamProof[];
  hides?: readonly string[];
  stepProp?: number;
}[] = [
  { pattern: '/', url: '/?motion=slow', signedIn: false },
  { pattern: '/stack-check', url: '/stack-check', signedIn: false },
  { pattern: '/pair', url: '/pair', signedIn: false },
  { pattern: '/login', url: '/login', signedIn: false },
  { pattern: '/home', url: '/home', signedIn: true },
  { pattern: '/sessions', url: '/sessions', signedIn: true, shows: [{ testID: 'sessions-list' }], hides: ['screen-session-detail'] },
  { pattern: '/sessions/[sessionId]', url: '/sessions/SES-20261001-0017', signedIn: true, shows: [{ testID: 'session-detail-id', text: 'SES-20261001-0017' }] },
  { pattern: '/evidence', url: '/evidence', signedIn: true, shows: [{ testID: 'evidence-list' }], hides: ['screen-evidence-detail'] },
  { pattern: '/evidence/[evidenceId]', url: '/evidence/EV-20261001-0007', signedIn: true, shows: [{ testID: 'evidence-detail-id', text: 'EV-20261001-0007' }] },
  { pattern: '/devices', url: '/devices', signedIn: true, shows: [{ testID: 'devices-list' }], hides: ['screen-device-detail'] },
  { pattern: '/devices/[deviceId]', url: '/devices/CAM-01', signedIn: true, shows: [{ testID: 'device-detail-id', text: 'CAM-01' }] },
  { pattern: '/storage', url: '/storage', signedIn: true },
  { pattern: '/network-time', url: '/network-time', signedIn: true },
  { pattern: '/audit', url: '/audit', signedIn: true },
  { pattern: '/settings', url: '/settings', signedIn: true, shows: [{ testID: 'settings-list' }], hides: ['screen-settings-section'] },
  { pattern: '/settings/[section]', url: '/settings/about', signedIn: true, shows: [{ testID: 'settings-section-about' }, { testID: 'settings-about' }] },
  { pattern: '/more', url: '/more', signedIn: true },
  // ARMED is the one state where the requested step decides what the wizard shows (2, else 3).
  { pattern: '/session/new', url: '/session/new?step=2', signedIn: true, sessionState: 'ARMED', shows: [{ testID: 'session-new-step-2' }], stepProp: 2 },
  { pattern: '/session/live', url: '/session/live', signedIn: true, recording: true },
  { pattern: '/session/finalizing', url: '/session/finalizing', signedIn: true },
  { pattern: '/session/summary/[sessionId]', url: '/session/summary/SES-20261001-0017', signedIn: true, shows: [{ testID: 'summary-session-id', text: 'SES-20261001-0017' }] },
  { pattern: '/session/recovery', url: '/session/recovery', signedIn: true },
];

const originalFetch = global.fetch;

beforeEach(() => {
  resetShellState();
  mockSessionNewSteps.length = 0;
  // The proof screen's health query (row 18) reads mock-core; nothing leaves the test.
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('T-M02 route tree', () => {
  it('covers every route of the registry', () => {
    expect(CASES.map((c) => c.pattern).sort()).toEqual(ROUTE_SCREENS.map((r) => r.pattern).sort());
  });

  it('has a feature screen file for every route (screen steps own them, P6)', () => {
    for (const route of ROUTE_SCREENS) {
      expect(existsSync(path.join(FEATURES, route.folder, route.file))).toBe(true);
    }
  });

  it('keeps test files out of src/app (Expo Router bundles every file there as a route)', () => {
    expect(existsSync(path.join(APP, '__tests__'))).toBe(false);
  });

  it.each(CASES)('$url renders screen-<id>', ({ pattern, url, signedIn, recording, sessionState, shows, hides, stepProp }) => {
    const route = ROUTE_SCREENS.find((r) => r.pattern === pattern)!;
    const runtime = new FakeRuntime();
    if (signedIn) runtime.signInAs();
    if (recording) runtime.setSession('RECORDING', 'S-20261001-0009', Date.now());
    if (sessionState) runtime.setSession(sessionState);

    const result = renderApp(url, { runtime, sim: routeTestSim(sessionState) });

    expect(screen.getByTestId(`screen-${route.id}`)).toBeTruthy();
    for (const { testID, text } of shows ?? []) {
      const node = screen.getByTestId(testID);
      if (text !== undefined) expect(node).toHaveTextContent(text);
    }
    for (const testID of hides ?? []) expect(screen.queryByTestId(testID)).toBeNull();
    if (stepProp !== undefined) expect(new Set(mockSessionNewSteps)).toEqual(new Set([stepProp]));
    // The route is really the one requested (no guard or policy redirect happened).
    const expectedPath = url.split('?')[0];
    expect(result.getPathname()).toBe(expectedPath);
    result.unmount();
  });

  it('shows the not-found screen for an unknown URL', () => {
    renderApp('/no/such/route');
    expect(screen.getByTestId('screen-not-found')).toBeTruthy();
  });

  it('parses params with zod: an out-of-range step falls back to 1', () => {
    const runtime = new FakeRuntime();
    runtime.signInAs();
    renderApp('/session/new?step=9', { runtime, sim: routeTestSim() });
    expect(mockSessionNewSteps.length).toBeGreaterThan(0);
    expect(new Set(mockSessionNewSteps)).toEqual(new Set([1]));
    expect(screen.getByTestId('session-new-step-1')).toBeTruthy();
  });

  it('sends a malformed id back to its list, and an unknown settings section to Settings', () => {
    const runtime = new FakeRuntime();
    runtime.signInAs();
    const evidence = renderApp('/evidence/bad%20id', { runtime });
    expect(evidence.getPathname()).toBe('/evidence');
    expect(screen.getByTestId('screen-evidence')).toBeTruthy();
    evidence.unmount();

    const settings = renderApp('/settings/firmware', { runtime });
    expect(settings.getPathname()).toBe('/settings');
    expect(screen.getByTestId('screen-settings')).toBeTruthy();
  });
});
