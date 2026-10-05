// Plan row W18: the mode helpers of the light Live API (04_client_integration_spec §3.1, MD-2;
// §12.1 TS-3; §2.3 CL-15; §6.1). The mode is derived from the object held in SimContext: a
// simulator means SIMULATED. Pure functions; the hooks are tested in live-light-hooks.test.ts.
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CORE_MODES,
  CoreMode,
  coreModeOf,
  corePermissionOf,
  DEFAULT_CORE_MODE,
  LiveLinkState,
  liveLinkOf,
  liveOf,
  parseCoreMode,
  type LiveHandle,
  type LiveSessionHint,
} from '../src/live';
import { createManualClock, createSim, DEMO_OPERATOR_PASSWORD, Permission, selectCan, type Sim } from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function simulator(): Sim {
  return createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario: 'idle' });
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

describe('mode values (§3.1)', () => {
  it('has two data modes and SIMULATED as the default', () => {
    expect(Object.values(CoreMode)).toEqual(['SIMULATED', 'LIVE']);
    expect(CORE_MODES).toEqual(['SIMULATED', 'LIVE']);
    expect(DEFAULT_CORE_MODE).toBe('SIMULATED');
  });

  it('has the five link states of the Live source (CL-15)', () => {
    expect(Object.values(LiveLinkState)).toEqual(['CONNECTING', 'ONLINE', 'STALE', 'OFFLINE', 'RESYNCING']);
  });
});

describe('parseCoreMode (MD-2: any other value counts as absent)', () => {
  it('accepts exactly the two stored values', () => {
    expect(parseCoreMode('SIMULATED')).toBe(CoreMode.SIMULATED);
    expect(parseCoreMode('LIVE')).toBe(CoreMode.LIVE);
  });

  it('answers null for anything else: another case, padding, another word, another type', () => {
    for (const value of ['live', 'Live', 'simulated', ' LIVE', 'LIVE ', '', 'HEARTBEAT', 'true', null, undefined, 1, true, {}, ['LIVE']]) {
      expect(parseCoreMode(value), JSON.stringify(value)).toBeNull();
    }
  });

  it('gives the default when the stored value is absent or invalid', () => {
    expect(parseCoreMode(null) ?? DEFAULT_CORE_MODE).toBe('SIMULATED');
    expect(parseCoreMode('garbage') ?? DEFAULT_CORE_MODE).toBe('SIMULATED');
  });
});

describe('a simulator means SIMULATED (TS-3)', () => {
  it('coreModeOf is SIMULATED; liveOf and liveLinkOf are null', () => {
    const sim = simulator();
    expect(coreModeOf(sim)).toBe('SIMULATED');
    expect(liveOf(sim)).toBeNull();
    expect(liveLinkOf(sim)).toBeNull();
  });

  it('corePermissionOf is false, signed out and signed in: the simulator keeps its own hint (selectCan)', () => {
    const sim = simulator();
    expect(corePermissionOf(sim, Permission.SESSION_START)).toBe(false);
    sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(selectCan(sim.store.getState(), Permission.SESSION_START)).toBe(true);
    expect(corePermissionOf(sim, Permission.SESSION_START)).toBe(false);
  });

  it('only the exact marker makes a Live source', () => {
    for (const marker of [{ coreMode: 'SIMULATED' }, { coreMode: 'live' }, { coreMode: true }, { mode: 'LIVE' }, { link: 'ONLINE' }]) {
      const almost = { ...simulator(), ...marker } as unknown as Sim;
      expect(coreModeOf(almost), JSON.stringify(marker)).toBe('SIMULATED');
      expect(liveOf(almost)).toBeNull();
    }
  });
});

describe('a Live source means LIVE', () => {
  it('coreModeOf is LIVE and liveOf returns the source itself', () => {
    const { sim, live } = fakeLive();
    expect(coreModeOf(sim)).toBe('LIVE');
    expect(liveOf(sim)).toBe(live);
  });

  it('liveLinkOf follows the link', () => {
    const { sim, set } = fakeLive();
    expect(liveLinkOf(sim)).toBe('CONNECTING');
    for (const link of Object.values(LiveLinkState)) {
      set({ link });
      expect(liveLinkOf(sim)).toBe(link);
    }
  });

  it('corePermissionOf reads the server\'s effective permission list; false while signed out', () => {
    const { sim, set } = fakeLive();
    expect(corePermissionOf(sim, Permission.DEVICE_MANAGE)).toBe(false);
    set({ session: { permissions: [Permission.DEVICE_MANAGE, Permission.MAINTENANCE] } });
    expect(corePermissionOf(sim, Permission.DEVICE_MANAGE)).toBe(true);
    expect(corePermissionOf(sim, Permission.SESSION_START)).toBe(false);
    set({ session: { permissions: [] } });
    expect(corePermissionOf(sim, Permission.DEVICE_MANAGE)).toBe(false);
    set({ session: null });
    expect(corePermissionOf(sim, Permission.MAINTENANCE)).toBe(false);
  });

  it('onLiveChange reports every change and stops after its unsubscribe', () => {
    const { sim, set, listeners } = fakeLive();
    const handle = liveOf(sim);
    let reports = 0;
    const stop = handle?.onLiveChange(() => {
      reports += 1;
    });
    set({ link: 'ONLINE' });
    set({ session: { permissions: [] } });
    expect(reports).toBe(2);
    stop?.();
    set({ link: 'OFFLINE' });
    expect(reports).toBe(2);
    expect(listeners.size).toBe(0);
  });
});

describe('mode helpers: types', () => {
  it('liveOf returns the light handle by default and the named shape with a type argument', () => {
    interface FullLive extends LiveHandle {
      readonly lastSessionEnd: string | null;
    }
    const sim = null as unknown as Sim;
    const check = (): void => {
      expectTypeOf(liveOf(sim)).toEqualTypeOf<LiveHandle | null>();
      expectTypeOf(liveOf<FullLive>(sim)).toEqualTypeOf<FullLive | null>();
      expectTypeOf(coreModeOf(sim)).toEqualTypeOf<CoreMode>();
      expectTypeOf(liveLinkOf(sim)).toEqualTypeOf<LiveLinkState | null>();
      expectTypeOf(parseCoreMode('LIVE')).toEqualTypeOf<CoreMode | null>();
    };
    expectTypeOf(check).toBeFunction();
    expectTypeOf(corePermissionOf).parameters.toEqualTypeOf<[sim: Sim, permission: Permission]>();
    expectTypeOf<LiveHandle['coreMode']>().toEqualTypeOf<'LIVE'>();
  });
});
