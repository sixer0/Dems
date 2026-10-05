/**
 * Jest harness for the navigation shell (step 70; T-M02, T-M03 and the chrome tests). Test-only:
 * never import it from app code.
 *
 * - Renders the REAL route tree in `src/app` the way Expo Router's `renderRouter` does, with only the
 *   root `_layout` swapped for a test root: the real `AppProviders` (fixed safe-area metrics, a
 *   fake heartbeat socket) around a fake runtime contract and the real `RootNavigator`.
 * - The fake runtime is a small external store, so tests sign in and out and change the session
 *   the way the step-73 runtime will (`RuntimeContractProvider`, step 68).
 * - The screens are the real ones (steps 75-88 replaced step 70's stubs) and read the simulator.
 *   `routeTestSim()` (step 91a) gives them a deterministic one (the D61 dataset at `TEST_START`, so
 *   record IDs are stable on any day) whose session state can match the fake runtime's.
 * - Import this module FIRST in a test file: its first import (`router-testing-setup`) prepares
 *   the module mocks the route tree needs before anything else loads.
 */
import './router-testing-setup';

import { QueryClient } from '@tanstack/react-query';
import { ExpoRoot } from 'expo-router';
import { store } from 'expo-router/build/global-state/router-store';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { act, render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import type { SessionState } from '@dems/shared/domain';
import type { SocketLike } from '@dems/shared/realtime';
import { DEMO_OPERATOR_PASSWORD, PRECHECK_TOTAL_MAX_MS, type Sim } from '@dems/shared/sim';
import { resetPendingHrefForTests, setSignedInSnapshot } from '@/navigation/pending-href';
import { resetRailPrefsForTests } from '@/navigation/rail-prefs';
import { RootNavigator } from '@/navigation/root-navigator';
import { AppProviders } from '@/providers';
import {
  RuntimeContractProvider,
  createRuntimeContract,
  initialsFor,
  type ActiveSessionInfo,
  type AuthContract,
  type AuthOperator,
  type PairingInfo,
} from '@/runtime';
import { createTestSim } from '@/runtime/testing/test-sim';

export const APP_DIR = path.resolve(__dirname, '../../app');

/** Window sizes of the two AVDs (04_mobile_specs §2.1, VM-22) in dp. */
export const WINDOWS = {
  phonePortrait: { width: 411, height: 923 },
  phoneLandscape: { width: 923, height: 411 },
  tabletPortrait: { width: 800, height: 1280 },
  tabletLandscape: { width: 1280, height: 800 },
} as const;
export type WindowName = keyof typeof WINDOWS;

/** Safe-area insets used by the tests (a status bar, a gesture bar, a landscape cutout). */
export const TEST_INSETS = { top: 24, right: 0, bottom: 16, left: 32 } as const;

export function setWindow(name: WindowName): void {
  const { width, height } = WINDOWS[name];
  act(() => {
    Dimensions.set({
      window: { width, height, scale: 2, fontScale: 1 },
      screen: { width, height, scale: 2, fontScale: 1 },
    });
  });
}

class FakeSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

export interface FakeRuntimeState {
  operator: AuthOperator | null;
  session: ActiveSessionInfo;
  /** The pairing-required gate (MP-9). `undefined` = the contract has none (SIMULATED / HEARTBEAT). */
  pairing?: PairingInfo;
}

const IDLE: ActiveSessionInfo = { state: null, sessionId: null, startedAtMs: null };

/** A controllable runtime contract (auth + active session + pairing gate) for route tests. */
export class FakeRuntime {
  private state: FakeRuntimeState;
  private readonly listeners = new Set<() => void>();
  readonly signInCalls: string[] = [];

  constructor(initial: Partial<FakeRuntimeState> = {}) {
    this.state = { operator: initial.operator ?? null, session: initial.session ?? IDLE, ...(initial.pairing ? { pairing: initial.pairing } : {}) };
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.state;

  private set(next: Partial<FakeRuntimeState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  signInAs(id = 'budi.santoso') {
    act(() => this.set({ operator: { id, displayName: id, initials: initialsFor(id), role: 'INVESTIGATOR' } }));
  }

  signOut() {
    act(() => this.set({ operator: null }));
  }

  setSession(state: SessionState | null, sessionId: string | null = state ? 'S-20261001-0001' : null, startedAtMs: number | null = null) {
    act(() => this.set({ session: { state, sessionId, startedAtMs } }));
  }

  /** Set the pairing gate (MP-9): LIVE mode drives it; SIMULATED / HEARTBEAT leave it `undefined`. */
  setPairing(pairing: PairingInfo | undefined) {
    act(() => this.set({ pairing }));
  }

  /** The auth part of the contract (signIn succeeds for any non-empty pair, like the stub). */
  auth(): AuthContract {
    const { operator } = this.state;
    return {
      isAuthenticated: operator !== null,
      operator,
      signIn: async (username: string) => {
        this.signInCalls.push(username);
        this.set({ operator: { id: username, displayName: username, initials: initialsFor(username), role: 'INVESTIGATOR' } });
        return { ok: true, operator: this.state.operator! };
      },
      signOut: () => this.set({ operator: null }),
    };
  }
}

function FakeRuntimeProvider({ runtime, children }: { runtime: FakeRuntime; children: ReactNode }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const value = createRuntimeContract({ auth: runtime.auth(), session: state.session, ...(state.pairing ? { pairing: state.pairing } : {}) });
  return <RuntimeContractProvider value={value}>{children}</RuntimeContractProvider>;
}

function testRoot(runtime: FakeRuntime | null, window: WindowName, sim: Sim | undefined): ComponentType {
  const { width, height } = WINDOWS[window];
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function TestRootLayout() {
    const navigator = <RootNavigator />;
    return (
      <AppProviders
        safeAreaMetrics={metrics}
        queryClient={queryClient}
        heartbeatSocketFactory={() => new FakeSocket()}
        {...(sim ? { sim } : {})}
      >
        {runtime ? <FakeRuntimeProvider runtime={runtime}>{navigator}</FakeRuntimeProvider> : navigator}
      </AppProviders>
    );
  };
}

export interface RenderAppOptions {
  /** `null` uses the real step-68 stub runtime from `AppProviders`. */
  runtime?: FakeRuntime | null;
  window?: WindowName;
  /** The simulator the real screens read; default: the one `AppProviders` creates (real clock). */
  sim?: Sim;
}

/** Session states `routeTestSim` can drive the simulator to (the Start Session flow's own states). */
export type RouteTestSimState = 'IDLE' | 'CREATE' | 'PRECHECK' | 'ARMED';

/**
 * A deterministic simulator for route tests (step 91a): the manual-clock test simulator at
 * `TEST_START`, so the D61 dataset IDs (`SES-20261001-0017`, `EV-20261001-0007`, ...) exist on any
 * day. For a session state it drives the flow the way Start Session does (`createSession` →
 * `beginPrecheck` → the checks pass → ARMED), signed in as the demo investigator: since step 54 the
 * session commands throw `SimPermissionError` (NOT_SIGNED_IN / NOT_PERMITTED) without an operator
 * holding SESSION_START. The fake runtime still owns the guard's auth; this only feeds the screens.
 */
export function routeTestSim(state: RouteTestSimState = 'IDLE'): Sim {
  const test = createTestSim();
  if (state === 'IDLE') return test.sim;
  const signIn = test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
  if (!signIn.ok) throw new Error('routeTestSim: demo sign-in failed');
  const created = test.sim.actions.createSession({
    caseNumber: 'LP/2026/1001-0008',
    subjectType: 'SAKSI',
    subjectName: 'Rahmat Hidayat',
    investigatorId: signIn.operatorId,
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  });
  if (!created.ok) throw new Error(`routeTestSim: createSession failed: ${created.reason}`);
  if (state === 'CREATE') return test.sim;
  test.sim.actions.beginPrecheck();
  if (state === 'ARMED') test.advance(PRECHECK_TOTAL_MAX_MS);
  const reached = test.sim.store.getState().session?.state;
  if (reached !== state) throw new Error(`routeTestSim: expected ${state}, the simulator is in ${String(reached)}`);
  return test.sim;
}

/**
 * Renders the app's route tree at `initialUrl`. `initialUrl` also passes through the app's
 * `+native-intent` (`redirectSystemPath`), as a launch deep link does on a device.
 */
export function renderApp(initialUrl: string, { runtime = new FakeRuntime(), window = 'phonePortrait', sim }: RenderAppOptions = {}) {
  setWindow(window);
  // On a device the launch URL always meets a signed-out app (auth is memory-only, 04 §6.4); a
  // test that starts signed in seeds the snapshot the root navigator keeps up to date afterwards.
  setSignedInSnapshot(runtime?.getSnapshot().operator != null);
  return renderRoutes(appContext({ _layout: testRoot(runtime, window, sim) }), initialUrl);
}

/**
 * Expo Router's `renderRouter` (expo-router/testing-library) without its Reanimated mock: the same
 * synchronous route import mode and `ExpoRoot` render, plus the route-info getters the tests use.
 */
export function renderRoutes(context: RouteModules, initialUrl: string) {
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  const mockContext = getMockContext(context as Parameters<typeof getMockContext>[0]);
  const result = render(<ExpoRoot context={mockContext} location={initialUrl} />);
  return Object.assign(result, {
    getPathname: () => store.getRouteInfo().pathname,
    getPathnameWithParams: () => store.getRouteInfo().pathnameWithParams,
    getSearchParams: () => store.getRouteInfo().params,
    getSegments: () => store.getRouteInfo().segments,
  });
}

type RouteModules = Record<string, unknown>;

function routeFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return routeFiles(path.join(dir, entry.name), rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

/**
 * Every file of `src/app` as an in-memory route context, loaded lazily, with `overrides` replacing
 * entries by route key (`_layout`). Expo Router's `{ appDir, overrides }` form strips the `./`
 * prefix and the extension from every key, so its own `+native-intent` detection no longer
 * matches and route discovery rejects the file; the in-memory form keeps the `./<key>.js` shape
 * both expect, so the app's real `+native-intent` runs in tests as it does on a device.
 */
export function appContext(overrides: RouteModules = {}): RouteModules {
  const context: RouteModules = {};
  for (const file of routeFiles(APP_DIR)) {
    const key = file.replace(/\.tsx?$/, '');
    if (key in overrides) continue;
    Object.defineProperty(context, key, {
      enumerable: true,
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy route modules, as require.context loads them
      get: () => require(path.join(APP_DIR, file)) as unknown,
    });
  }
  return Object.assign(context, overrides);
}

/** Resets the module-level shell state between tests (pending href, rail preference). */
export function resetShellState(): void {
  resetPendingHrefForTests();
  resetRailPrefsForTests();
}
