// Decision D170 (finding F-1 of row W68, `implementation/68_mobile_session_live.md`; probes
// `assets/68_banner_probe_*`): after an outage the runtime's connection banner fell back to "offline"
// after showing "Resynced", although the Core link was ONLINE. It showed in jest when wall-clock time
// passed during the outage with a 1 Hz meter interval mounted (`useAudioAccessibilityValue`).
//
// The cause (measured while building the fix, `gateway_check/09b_m1_mobile_consolidation.md`, follow-up 3):
// the link reaches the banner hook through `useSyncExternalStore` (a sync update), the resync signal
// through a `setState` from a socket callback (a lower lane). When the signal's functional updater of
// `kind` was skipped by the render that applied the link change, React later rebased it over that
// render's own `setKind(resynced)` and undid it. W68's screen hit it with the wall-clock wait; the
// scheduling cases below force the lanes directly on the REAL hook (`useConnectionBannerState`), so they
// fail on the old hook and pass on the fixed one, independent of what else is mounted.
//
// Then the Live source end to end (W66's bed, `features/dashboard/testing/live-home-bed.tsx`): a probe
// of `useConnectionBanner()` and the runtime's 1 Hz `useAudioAccessibilityValue`, the interval W68 isolated.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { startTransition, useEffect, useState, useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import { createHomeBed, flush, type HomeBed } from '@/features/dashboard/testing/live-home-bed';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { RESYNCED_BANNER_MS, useConnectionBanner } from './connection-banner';
import { useCoreLink, type CoreLinkInfo } from './contract';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from './index';
import { createResyncBus, type ResyncBus } from './resync-bus';
import { useConnectionBannerState } from './sim-runtime-provider';
import { useAudioAccessibilityValue } from './use-audio-shared-values';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

function BannerProbe() {
  const banner = useConnectionBanner();
  const link = useCoreLink();
  return <Text testID="banner-probe">{`${banner.kind} ${link.state}/${link.heartbeat ?? '-'}`}</Text>;
}

/** The runtime's 1 Hz accessible meter value, as every meter on a screen mounts it. */
function MeterProbe() {
  const value = useAudioAccessibilityValue('AUDIO-01', { noSignalText: 'NO SIGNAL' });
  return <Text testID="meter-probe">{value.text}</Text>;
}

const probe = (): string => screen.getByTestId('banner-probe').props.children as string;
/** Real time passes (the 1 Hz interval fires) while the fake Core clock stands still. */
const wallClock = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

let bed: HomeBed | null = null;

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
});

afterEach(() => {
  if (bed !== null) {
    bed.stop();
    bed.fake.assertNoViolations();
    bed = null;
  }
  cleanup();
});

async function signedIn(): Promise<HomeBed> {
  bed = createHomeBed();
  bed.mount(
    <>
      <BannerProbe />
      <MeterProbe />
    </>,
  );
  await bed.signIn();
  await flush();
  expect(probe()).toBe('hidden ONLINE/LIVE');
  return bed;
}

describe('the connection banner follows the link through an outage (D170, W68 F-1)', () => {
  it('with the 1 Hz meter interval running and wall-clock time passing during the outage: "Resynced" when the link is back, never "offline" again while ONLINE', async () => {
    const b = await signedIn();
    b.goDown();
    await flush();
    await b.elapse(1_000, 250);
    expect(probe()).toMatch(/^offline OFFLINE\//);
    await wallClock(1_100);
    expect(probe()).toMatch(/^offline OFFLINE\//);
    b.comeBack();
    const seen: string[] = [];
    for (let step = 0; step < 16; step += 1) {
      await b.elapse(250, 250);
      seen.push(probe());
    }
    // Once the link is ONLINE again, the banner is never "offline".
    const online = seen.filter((entry) => entry.endsWith('ONLINE/LIVE'));
    expect(online.length).toBeGreaterThan(0);
    expect(online.filter((entry) => entry.startsWith('offline'))).toEqual([]);
    expect(probe()).toBe('resynced ONLINE/LIVE');
  });

  it('the same outage without the wall-clock wait: "Resynced" (the case that always worked)', async () => {
    const b = await signedIn();
    b.goDown();
    await flush();
    await b.elapse(1_000, 250);
    b.comeBack();
    for (let step = 0; step < 16; step += 1) await b.elapse(250, 250);
    expect(probe()).toBe('resynced ONLINE/LIVE');
  });

  it('"Resynced" hides after RESYNCED_BANNER_MS of real time; an outage while it shows turns it "offline" at once', async () => {
    const b = await signedIn();
    b.goDown();
    await flush();
    await b.elapse(1_000, 250);
    b.comeBack();
    for (let step = 0; step < 16; step += 1) await b.elapse(250, 250);
    expect(probe()).toBe('resynced ONLINE/LIVE');
    await wallClock(3_200);
    expect(probe()).toBe('hidden ONLINE/LIVE');
    b.goDown();
    await flush();
    expect(probe()).toMatch(/^offline OFFLINE\//);
  });
});

// ── The scheduling, forced on the real hook ──────────────────────────────────────────────────

const OFFLINE: CoreLinkInfo = { source: 'LIVE', state: 'OFFLINE', heartbeat: 'OFFLINE' };
const CONNECTING: CoreLinkInfo = { source: 'LIVE', state: 'OFFLINE', heartbeat: 'CONNECTING' };
const ONLINE: CoreLinkInfo = { source: 'LIVE', state: 'ONLINE', heartbeat: 'LIVE' };

/** The link as the runtime gets it: an external store read with `useSyncExternalStore`. */
function linkStore(initial: CoreLinkInfo) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: CoreLinkInfo) {
      value = next;
      for (const listener of Array.from(listeners)) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const kinds: string[] = [];
function BannerHost({ store, bus }: { store: ReturnType<typeof linkStore>; bus: ResyncBus }) {
  const link = useSyncExternalStore(store.subscribe, store.get, store.get);
  const banner = useConnectionBannerState(link, bus);
  kinds.push(banner.kind);
  return <Text testID="banner-host">{banner.kind}</Text>;
}
let bumpOther: (() => void) | null = null;
function Other() {
  const [, setCount] = useState(0);
  useEffect(() => {
    bumpOther = () => setCount((count) => count + 1);
  }, []);
  return null;
}

async function outageThenBack(signal: (store: ReturnType<typeof linkStore>, bus: ResyncBus) => void): Promise<string> {
  const store = linkStore(ONLINE);
  const bus = createResyncBus();
  const view = render(
    <>
      <BannerHost store={store} bus={bus} />
      <Other />
    </>,
  );
  act(() => store.set(OFFLINE));
  act(() => store.set(CONNECTING));
  act(() => store.set(OFFLINE));
  expect(screen.getByTestId('banner-host').props.children).toBe('offline');
  kinds.length = 0;
  signal(store, bus);
  await act(async () => {
    await Promise.resolve();
  });
  const result = screen.getByTestId('banner-host').props.children as string;
  view.unmount();
  return result;
}

describe('the banner kind under any scheduling of the link change and the resync signal (D170)', () => {
  it('the signal in a LOWER lane than the link change (the case that undid "Resynced"): "resynced", never "offline" after it', async () => {
    expect(await outageThenBack((store, bus) => act(() => {
      store.set(ONLINE);
      startTransition(() => bus.emit());
    }))).toBe('resynced');
    const afterResynced = kinds.slice(kinds.indexOf('resynced'));
    expect(afterResynced.length).toBeGreaterThan(0);
    expect(afterResynced).not.toContain('offline');
  });

  it('the signal queued in a lower lane BEFORE the link change: "resynced"', async () => {
    expect(await outageThenBack((store, bus) => act(() => {
      startTransition(() => bus.emit());
      store.set(ONLINE);
    }))).toBe('resynced');
  });

  it('both in one lane, either order, and with an unrelated update pending elsewhere: "resynced"', async () => {
    expect(await outageThenBack((store, bus) => act(() => {
      store.set(ONLINE);
      bus.emit();
    }))).toBe('resynced');
    expect(await outageThenBack((store, bus) => act(() => {
      bus.emit();
      store.set(ONLINE);
    }))).toBe('resynced');
    expect(await outageThenBack((store, bus) => act(() => {
      startTransition(() => bumpOther?.());
      store.set(ONLINE);
      bus.emit();
    }))).toBe('resynced');
  });

  it('a resync with the link up (no outage before it: a gap or an epoch on the same socket) shows "Resynced"', async () => {
    const store = linkStore(ONLINE);
    const bus = createResyncBus();
    const view = render(<BannerHost store={store} bus={bus} />);
    expect(screen.getByTestId('banner-host').props.children).toBe('hidden');
    act(() => startTransition(() => bus.emit()));
    expect(screen.getByTestId('banner-host').props.children).toBe('resynced');
    view.unmount();
  });

  it('"Resynced" ending in the same turn as the link drops: "offline" (the end of "Resynced" never hides an outage)', async () => {
    jest.useFakeTimers();
    try {
      const store = linkStore(ONLINE);
      const bus = createResyncBus();
      const view = render(<BannerHost store={store} bus={bus} />);
      act(() => store.set(OFFLINE));
      act(() => store.set(ONLINE));
      expect(screen.getByTestId('banner-host').props.children).toBe('resynced');
      act(() => {
        jest.advanceTimersByTime(RESYNCED_BANNER_MS);
        store.set(OFFLINE);
      });
      expect(screen.getByTestId('banner-host').props.children).toBe('offline');
      act(() => store.set(ONLINE));
      expect(screen.getByTestId('banner-host').props.children).toBe('resynced');
      act(() => jest.advanceTimersByTime(RESYNCED_BANNER_MS));
      expect(screen.getByTestId('banner-host').props.children).toBe('hidden');
      view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a resync never hides an outage: the signal while the link is still down keeps "offline"', async () => {
    expect(await outageThenBack((_store, bus) => act(() => {
      startTransition(() => bus.emit());
    }))).toBe('offline');
  });
});
