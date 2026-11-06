// Plan row W18: the hooks of the light Live API (04_client_integration_spec §2.3 CL-12, CL-15;
// §12.1 TS-2, TS-3; AC-C-06, identity part). Rendered for real, under the simulator's own
// `SimProvider`: with a simulator in the context `useCoreActions()` returns `sim.actions` itself.
//
// Renderer: `react-test-renderer` at the version of `react` (both pinned by the root overrides).
// It needs no DOM, so this file runs in the package's `node` environment like every other test.
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi, type MockInstance } from 'vitest';
import {
  CoreMode,
  LiveLinkState,
  settle,
  useCoreActions,
  useCoreMode,
  useCorePermission,
  useLive,
  useLiveLink,
  type CoreActions,
  type LiveHandle,
  type LiveSessionHint,
} from '../src/live';
import {
  createManualClock,
  createSim,
  DEMO_OPERATOR_PASSWORD,
  Permission,
  selectCan,
  SimProvider,
  useSim,
  useSimActions,
  type ScenarioName,
  type Sim,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB
const DEPRECATION = 'react-test-renderer is deprecated';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function simulator(scenario: ScenarioName = 'idle'): Sim {
  return createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario });
}

/** A stand-in for the Live source of row W44: the `Sim` members plus the members of `LiveHandle`. */
function fakeLive(start: { link?: LiveLinkState; session?: LiveSessionHint | null } = {}) {
  const listeners = new Set<() => void>();
  const state = { link: start.link ?? LiveLinkState.CONNECTING, session: start.session ?? null };
  const live = {
    ...simulator(),
    coreMode: CoreMode.LIVE,
    get link() {
      return state.link;
    },
    get session() {
      return state.session;
    },
    onLiveChange(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const set = (patch: Partial<typeof state>): void => {
    Object.assign(state, patch);
    for (const listener of listeners) listener();
  };
  const sim: Sim = live;
  return { sim, live, set, listeners };
}

/** Renders `useValue` under `SimProvider` and records what it returned on every render. */
function renderHook<T>(sim: Sim, useValue: () => T) {
  const seen: T[] = [];
  function Probe(): null {
    seen.push(useValue());
    return null;
  }
  const tree = () => createElement(SimProvider, { sim }, createElement(Probe));
  let root!: ReactTestRenderer;
  act(() => {
    root = create(tree());
  });
  return {
    seen,
    last: (): T => seen[seen.length - 1] as T,
    rerender: () => act(() => root.update(tree())),
    unmount: () => act(() => root.unmount()),
  };
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  // React reports misuse (a snapshot that is not stable, an update outside act) on this channel.
  // Only the renderer's own deprecation notice is expected.
  const unexpected = consoleError.mock.calls.filter(([first]) => !String(first).startsWith(DEPRECATION));
  consoleError.mockRestore();
  vi.unstubAllGlobals();
  expect(unexpected).toEqual([]);
});

describe('Simulated mode: a simulator in SimContext (AC-C-06 identity part, TS-2, TS-3)', () => {
  it('useCoreActions() returns sim.actions itself', () => {
    const sim = simulator();
    const hook = renderHook(sim, () => useCoreActions());
    expect(hook.last()).toBe(sim.actions);
    hook.unmount();
  });

  it('useCoreActions() returns the very object useSimActions() returns, on every render', () => {
    const sim = simulator();
    const hook = renderHook(sim, () => ({ core: useCoreActions(), simulator: useSimActions() }));
    hook.rerender();
    hook.rerender();
    expect(hook.seen).toHaveLength(3);
    for (const { core, simulator: own } of hook.seen) {
      expect(core).toBe(own);
      expect(core).toBe(sim.actions);
    }
    hook.unmount();
  });

  it('an action taken through the hook answers at once: a plain value, the effect already rendered state', () => {
    const sim = simulator();
    const hook = renderHook(sim, () => useCoreActions());
    const order: string[] = [];
    act(() => {
      settle(() => hook.last().signIn('budi.santoso', DEMO_OPERATOR_PASSWORD), {
        ok: (result) => order.push(`ok ${String(result.ok)} ${sim.store.getState().auth.status}`),
        fail: () => order.push('fail'),
        done: () => order.push('done'),
      });
      order.push('after settle');
    });
    expect(order).toEqual(['ok true SIGNED_IN', 'done', 'after settle']);
    hook.unmount();
  });

  it('useCoreMode() is SIMULATED, useLive() is null, useLiveLink() is null', () => {
    const sim = simulator('recording');
    const hook = renderHook(sim, () => ({ mode: useCoreMode(), live: useLive(), link: useLiveLink() }));
    expect(hook.last()).toEqual({ mode: 'SIMULATED', live: null, link: null });
    hook.unmount();
  });

  it('useCorePermission() is false while the simulator\'s own hint (selectCan) stays as it is', () => {
    const sim = simulator();
    sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    const hook = renderHook(sim, () => ({
      core: useCorePermission(Permission.SESSION_START),
      simulator: useSim((state) => selectCan(state, Permission.SESSION_START)),
    }));
    expect(hook.last()).toEqual({ core: false, simulator: true });
    hook.unmount();
  });

  it('the light API calls no network function and builds no connection object', () => {
    const fetchSpy = vi.fn();
    let connections = 0;
    class Connection {
      constructor() {
        connections += 1;
      }
    }
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', Connection);
    vi.stubGlobal('XMLHttpRequest', Connection);
    vi.stubGlobal('EventSource', Connection);

    const sim = simulator('recording');
    sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    const hook = renderHook(sim, () => ({
      actions: useCoreActions(),
      mode: useCoreMode(),
      live: useLive(),
      link: useLiveLink(),
      allowed: useCorePermission(Permission.SESSION_START),
    }));
    act(() => {
      settle(() => hook.last().actions.addMarker('Light API check'), { fail: (error) => { throw error; } });
      settle(() => hook.last().actions.snapshot(), { fail: (error) => { throw error; } });
    });
    hook.rerender();
    hook.unmount();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(connections).toBe(0);
  });
});

describe('Live mode: a Live source in SimContext (CL-15)', () => {
  it('useCoreMode() is LIVE and useLive() returns the source itself', () => {
    const { sim, live } = fakeLive();
    const hook = renderHook(sim, () => ({ mode: useCoreMode(), live: useLive() }));
    expect(hook.last().mode).toBe('LIVE');
    expect(hook.last().live).toBe(live);
    hook.unmount();
  });

  it('useCoreActions() returns the source\'s actions object itself', () => {
    const { sim, live } = fakeLive();
    const hook = renderHook(sim, () => useCoreActions());
    expect(hook.last()).toBe(live.actions);
    hook.unmount();
  });

  it('useLiveLink() shows the link and renders again on every change', () => {
    const { sim, set } = fakeLive();
    const hook = renderHook(sim, () => useLiveLink());
    expect(hook.seen).toEqual(['CONNECTING']);
    act(() => set({ link: 'ONLINE' }));
    act(() => set({ link: 'OFFLINE' }));
    act(() => set({ link: 'RESYNCING' }));
    expect(hook.seen).toEqual(['CONNECTING', 'ONLINE', 'OFFLINE', 'RESYNCING']);
    hook.unmount();
  });

  it('useCorePermission() follows the session: signed out, granted, role changed, signed out', () => {
    const { sim, set } = fakeLive({ link: 'ONLINE' });
    const hook = renderHook(sim, () => useCorePermission(Permission.DEVICE_MANAGE));
    expect(hook.last()).toBe(false);
    act(() => set({ session: { permissions: [Permission.DEVICE_MANAGE, Permission.MAINTENANCE] } }));
    expect(hook.last()).toBe(true);
    act(() => set({ session: { permissions: [Permission.SESSION_START] } }));
    expect(hook.last()).toBe(false);
    act(() => set({ session: { permissions: [Permission.DEVICE_MANAGE] } }));
    expect(hook.last()).toBe(true);
    act(() => set({ session: null }));
    expect(hook.last()).toBe(false);
    expect(hook.seen).toEqual([false, true, false, true, false]);
    hook.unmount();
  });

  it('does not render again when a change leaves the value as it was', () => {
    const { sim, set } = fakeLive({ link: 'ONLINE', session: { permissions: [Permission.DEVICE_MANAGE] } });
    const permission = renderHook(sim, () => useCorePermission(Permission.DEVICE_MANAGE));
    const link = renderHook(sim, () => useLiveLink());
    act(() => set({ link: 'STALE' }));
    act(() => set({ session: { permissions: [Permission.DEVICE_MANAGE, Permission.AUDIT_EXPORT] } }));
    expect(permission.seen).toEqual([true]);
    expect(link.seen).toEqual(['ONLINE', 'STALE']);
    permission.unmount();
    link.unmount();
  });

  it('subscribes once per hook and ends the subscription on unmount', () => {
    const { sim, set, listeners } = fakeLive();
    const hook = renderHook(sim, () => ({ link: useLiveLink(), allowed: useCorePermission(Permission.MAINTENANCE) }));
    expect(listeners.size).toBe(2);
    hook.rerender();
    expect(listeners.size).toBe(2);
    hook.unmount();
    expect(listeners.size).toBe(0);
    set({ link: 'ONLINE' });
    expect(hook.seen).toHaveLength(2);
  });
});

describe('hooks: provider and types', () => {
  it('needs a SimProvider, as useSimActions() does', () => {
    function Bare(): null {
      useCoreActions();
      return null;
    }
    expect(() =>
      act(() => {
        create(createElement(Bare));
      }),
    ).toThrow('inside <SimProvider>');
    // React reports the same error on the console as well; that report is expected here.
    consoleError.mockClear();
  });

  it('types', () => {
    interface FullLive extends LiveHandle {
      readonly lastSessionEnd: string | null;
    }
    expectTypeOf(useCoreActions).returns.toEqualTypeOf<CoreActions>();
    expectTypeOf(useCoreMode).returns.toEqualTypeOf<CoreMode>();
    expectTypeOf(useLive).returns.toEqualTypeOf<LiveHandle | null>();
    expectTypeOf(useLive<FullLive>).returns.toEqualTypeOf<FullLive | null>();
    expectTypeOf(useLiveLink).returns.toEqualTypeOf<LiveLinkState | null>();
    expectTypeOf(useCorePermission).parameters.toEqualTypeOf<[permission: Permission]>();
    expectTypeOf(useCorePermission).returns.toBeBoolean();
  });
});
