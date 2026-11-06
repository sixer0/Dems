// Row M1 (decision D159; finding F-1 of W66, DN-1): the first render of the "Core server unreachable"
// notice is seeded from the runtime's own knowledge, the app's connection banner, so a screen first
// opened while the socket reconnects after an outage shows the notice at once instead of "Core Live"
// for one reconnect step. Row M0's rule (`link-notice.ts`) decides every render after the first.
//
//  1. `initialOfflineNotice`: every view and banner kind; it equals the notice of a screen mounted
//     from the start, after every history of link changes and resyncs of LIVE mode; M0's first
//     snippet did not (the F-1 histories are counted).
//  2. `useCoreLinkNotice()` over a fake runtime: a first render while down shows the notice; a first
//     render while settling after a down keeps it; a first render while up, or at a cold start, does
//     not; outside LIVE nothing shows; after the first render only the view moves it.
//  3. W66's chip over the same fake runtime: "Offline" when first rendered during a reconnect.
//  4. End to end on the app's real Live source (W66's bed): a screen mounted during a reconnect
//     attempt after an outage shows the notice at its first render; M0's unseeded first snippet,
//     mounted at the same moment, did not.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, renderHook, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Text } from 'react-native';
import type { HeartbeatState } from '@dems/shared/domain';
import { createHomeBed, flush, type HomeBed } from '@/features/dashboard/testing/live-home-bed';
import { useCoreLinkChip } from '@/features/more/use-core-link-chip';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import {
  initialOfflineNotice as barrelInitialOfflineNotice,
  useCoreLinkNotice as barrelUseCoreLinkNotice,
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  resetDebugLaunchForTests,
} from '@/runtime';
import { ConnectionBannerContext, bannerKindAfterResync, connectionBannerFor, nextBannerKind, useConnectionBanner, type ConnectionBannerKind } from './connection-banner';
import { RuntimeContractProvider, createRuntimeContract, useCoreLink, type CoreLinkInfo, type CoreLinkSource } from './contract';
import { coreLinkStateFor } from './core-link';
import { coreLinkViewOf, initialOfflineNotice, offlineNoticeAfter, type CoreLinkView } from './link-notice';
import { useCoreLinkNotice, type CoreLinkNotice } from './use-core-link-notice';

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

const VIEWS: readonly CoreLinkView[] = ['up', 'settling', 'down', 'none'];
const BANNERS: readonly ConnectionBannerKind[] = ['hidden', 'offline', 'resynced'];
const HEARTBEATS: readonly HeartbeatState[] = ['CONNECTING', 'LIVE', 'STALE', 'OFFLINE'];
const SOURCES: readonly CoreLinkSource[] = ['SIMULATED', 'HEARTBEAT', 'LIVE'];

/** The runtime's link of a source that follows a heartbeat, as `sim-runtime-provider.tsx` builds it. */
const linkOf = (source: CoreLinkSource, heartbeat: HeartbeatState): CoreLinkInfo => ({
  source,
  state: coreLinkStateFor(source, heartbeat, 'CONNECTED'),
  ...(source === 'SIMULATED' ? {} : { heartbeat }),
});
const live = (heartbeat: HeartbeatState): CoreLinkInfo => linkOf('LIVE', heartbeat);

// ── 1. The pure seed ─────────────────────────────────────────────────────────────────────────

describe('initialOfflineNotice: the first render (row M1)', () => {
  it('down shows, up and none hide, settling shows exactly while the banner says the link is lost', () => {
    for (const view of VIEWS) {
      for (const banner of BANNERS) {
        const expected = view === 'down' || (view === 'settling' && banner === 'offline');
        expect([view, banner, initialOfflineNotice(view, banner)]).toEqual([view, banner, expected]);
      }
    }
  });

  it('LIVE: a first render while down shows; while settling after a down keeps it; while up does not', () => {
    expect(initialOfflineNotice(live('OFFLINE'), 'offline')).toBe(true);
    expect(initialOfflineNotice(live('STALE'), 'offline')).toBe(true);
    expect(initialOfflineNotice(live('CONNECTING'), 'offline')).toBe(true);
    expect(initialOfflineNotice(live('LIVE'), 'resynced')).toBe(false);
    expect(initialOfflineNotice(live('LIVE'), 'hidden')).toBe(false);
    // A cold start: CONNECTING before the first heartbeat, the banner hidden: nothing flashes.
    expect(initialOfflineNotice(live('CONNECTING'), 'hidden')).toBe(false);
  });

  it('outside LIVE nothing shows, whatever the banner says (HEARTBEAT mode has a banner too)', () => {
    for (const source of ['SIMULATED', 'HEARTBEAT'] as const) {
      for (const heartbeat of HEARTBEATS) {
        for (const banner of BANNERS) expect([source, heartbeat, banner, initialOfflineNotice(linkOf(source, heartbeat), banner)]).toEqual([source, heartbeat, banner, false]);
      }
    }
    expect(initialOfflineNotice(null, 'offline')).toBe(false);
    expect(initialOfflineNotice(undefined, 'offline')).toBe(false);
  });

  it('equals the notice of a screen mounted from the start, after every LIVE history of up to five link changes and resyncs; M0\'s first snippet did not', () => {
    type Event = HeartbeatState | 'resync' | 'resynced-elapsed';
    const events: readonly Event[] = [...HEARTBEATS, 'resync', 'resynced-elapsed'];
    let histories = 0;
    let m0Wrong = 0;
    const walk = (heartbeat: HeartbeatState, banner: ConnectionBannerKind, shownFromStart: boolean, depth: number): void => {
      histories += 1;
      const link = live(heartbeat);
      expect([heartbeat, banner, initialOfflineNotice(link, banner)]).toEqual([heartbeat, banner, shownFromStart]);
      if (offlineNoticeAfter(false, coreLinkViewOf(link)) !== shownFromStart) m0Wrong += 1;
      if (depth === 5) return;
      for (const event of events) {
        if (event === 'resync') walk(heartbeat, bannerKindAfterResync(banner), shownFromStart, depth + 1);
        else if (event === 'resynced-elapsed') walk(heartbeat, banner === 'resynced' ? 'hidden' : banner, shownFromStart, depth + 1);
        else walk(event, nextBannerKind(banner, live(event)), offlineNoticeAfter(shownFromStart, live(event)), depth + 1);
      }
    };
    // The runtime starts its banner from `nextBannerKind('hidden', link)` and a screen mounted then from "not shown".
    for (const first of HEARTBEATS) walk(first, nextBannerKind('hidden', live(first)), offlineNoticeAfter(false, live(first)), 1);
    expect(histories).toBe(4 * (1 + 6 + 6 ** 2 + 6 ** 3 + 6 ** 4));
    // F-1: M0's first snippet was wrong exactly where the link settles after an outage.
    expect(m0Wrong).toBeGreaterThan(0);
  });

  it('is the barrel\'s function, and the file stays pure (no React, no clock, no timer)', () => {
    expect(barrelInitialOfflineNotice).toBe(initialOfflineNotice);
    expect(barrelUseCoreLinkNotice).toBe(useCoreLinkNotice);
    const code = readFileSync(join(__dirname, 'link-notice.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(?<!:)\/\/.*$/gm, '');
    expect(code).toMatch(/import type \{ ConnectionBannerKind \} from '\.\/connection-banner';/);
    expect(/from\s+'react'|\buse[A-Z]\w*\s*\(|\bDate\b|\bset(?:Timeout|Interval)\b/.test(code)).toBe(false);
  });
});

// ── 2. The hook over a fake runtime ──────────────────────────────────────────────────────────

function mountNotice(first: CoreLinkInfo, banner: ConnectionBannerKind) {
  const holder = { link: first, banner };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RuntimeContractProvider value={createRuntimeContract({ coreLink: holder.link })}>
      <ConnectionBannerContext.Provider value={connectionBannerFor(holder.banner)}>{children}</ConnectionBannerContext.Provider>
    </RuntimeContractProvider>
  );
  const view = renderHook(() => useCoreLinkNotice(), { wrapper });
  return {
    current: (): CoreLinkNotice => view.result.current,
    show(link: CoreLinkInfo, nextBanner: ConnectionBannerKind = nextBannerKind(holder.banner, link)): CoreLinkNotice {
      holder.link = link;
      holder.banner = nextBanner;
      view.rerender({});
      return view.result.current;
    },
  };
}

describe('useCoreLinkNotice(): M0\'s rule in one call, its first render seeded', () => {
  it('a first render while down shows the notice', () => {
    expect(mountNotice(live('OFFLINE'), 'offline').current()).toEqual({ view: 'down', offline: true });
    expect(mountNotice(live('STALE'), 'offline').current()).toEqual({ view: 'down', offline: true });
  });

  it('a first render while settling after a down keeps it, and M0\'s rule follows from there: no flicker', () => {
    const notice = mountNotice(live('CONNECTING'), 'offline');
    expect(notice.current()).toEqual({ view: 'settling', offline: true });
    const steps: HeartbeatState[] = ['OFFLINE', 'CONNECTING', 'OFFLINE', 'CONNECTING', 'LIVE', 'LIVE'];
    expect(steps.map((beat) => notice.show(live(beat)).offline)).toEqual([true, true, true, true, false, false]);
  });

  it('a first render while up does not show it; nor does a cold start (CONNECTING, banner hidden)', () => {
    expect(mountNotice(live('LIVE'), 'hidden').current()).toEqual({ view: 'up', offline: false });
    expect(mountNotice(live('LIVE'), 'resynced').current()).toEqual({ view: 'up', offline: false });
    const cold = mountNotice(live('CONNECTING'), 'hidden');
    expect(cold.current()).toEqual({ view: 'settling', offline: false });
    expect(cold.show(live('OFFLINE')).offline).toBe(true);
    expect(cold.show(live('CONNECTING')).offline).toBe(true);
  });

  it('outside LIVE the view is none and nothing shows, even with the banner offline', () => {
    expect(mountNotice(linkOf('HEARTBEAT', 'CONNECTING'), 'offline').current()).toEqual({ view: 'none', offline: false });
    expect(mountNotice(linkOf('HEARTBEAT', 'OFFLINE'), 'offline').current()).toEqual({ view: 'none', offline: false });
    expect(mountNotice({ source: 'SIMULATED', state: 'OFFLINE' }, 'offline').current()).toEqual({ view: 'none', offline: false });
  });

  it('after the first render only the view moves it: a banner change alone does not', () => {
    const notice = mountNotice(live('LIVE'), 'hidden');
    expect(notice.show(live('LIVE'), 'offline').offline).toBe(false);
    expect(notice.show(live('CONNECTING'), 'offline').offline).toBe(false);
    expect(notice.show(live('OFFLINE'), 'offline').offline).toBe(true);
    expect(notice.show(live('OFFLINE'), 'hidden').offline).toBe(true);
  });

  it('every source: only LIVE can show it', () => {
    for (const source of SOURCES) {
      const shows = HEARTBEATS.some((heartbeat) => BANNERS.some((banner) => mountNotice(linkOf(source, heartbeat), banner).current().offline));
      expect([source, shows]).toEqual([source, source === 'LIVE']);
    }
  });

  it('the hook holds its state with the render-time adjustment: no effect, no ref, no timer, no clock', () => {
    const code = readFileSync(join(__dirname, 'use-core-link-notice.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(?<!:)\/\/.*$/gm, '');
    expect(/\buse(?:Effect|LayoutEffect|Ref)\b|\bset(?:Timeout|Interval)\b|\bDate\b|\.now\s*\(/.test(code)).toBe(false);
    expect(code).toMatch(/useState\(\(\) => initialOfflineNotice\(view, banner\)\)/);
    expect(code).toMatch(/setOffline\(offlineNoticeAfter\(offline, view\)\)/);
  });
});

// ── 3. W66's chip ────────────────────────────────────────────────────────────────────────────

describe("W66's Core link chip takes the same first render", () => {
  function chipOf(link: CoreLinkInfo, banner: ConnectionBannerKind) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RuntimeContractProvider value={createRuntimeContract({ coreLink: link })}>
        <ConnectionBannerContext.Provider value={connectionBannerFor(banner)}>{children}</ConnectionBannerContext.Provider>
      </RuntimeContractProvider>
    );
    return renderHook(() => useCoreLinkChip(), { wrapper }).result.current.word;
  }

  it('first rendered during a reconnect after an outage: "Offline"; at a cold start or while up: "Live"', () => {
    expect(chipOf(live('CONNECTING'), 'offline')).toBe('offline');
    expect(chipOf(live('CONNECTING'), 'hidden')).toBe('live');
    expect(chipOf(live('LIVE'), 'resynced')).toBe('live');
    expect(chipOf(linkOf('HEARTBEAT', 'LIVE'), 'offline')).toBe('simulated');
  });
});

// ── 4. End to end on the app's real Live source ──────────────────────────────────────────────

/** Row M0's first snippet as the page rows pasted it before row M1 (gateway_check/09a §10): the control. */
function useM0FirstSnippet(): boolean {
  const view = coreLinkViewOf(useCoreLink());
  const [viewSeen, setViewSeen] = useState(view);
  const [offline, setOffline] = useState(() => offlineNoticeAfter(false, view));
  if (viewSeen !== view) {
    setViewSeen(view);
    setOffline(offlineNoticeAfter(offline, view));
  }
  return offline;
}

const gate = { open: false, listeners: new Set<() => void>() };
function openGate(open: boolean): void {
  act(() => {
    gate.open = open;
    for (const listener of gate.listeners) listener();
  });
}
const subscribeGate = (listener: () => void) => {
  gate.listeners.add(listener);
  return () => gate.listeners.delete(listener);
};

function NoticeProbe() {
  const { view, offline } = useCoreLinkNotice();
  const m0 = useM0FirstSnippet();
  const chip = useCoreLinkChip();
  const banner = useConnectionBanner().kind;
  return <Text testID="notice-probe">{`view=${view} offline=${offline} m0=${m0} chip=${chip.word} banner=${banner}`}</Text>;
}

/** A screen opened later: nothing until the test opens the gate, then a first render. */
function LateScreen() {
  const open = useSyncExternalStore(subscribeGate, () => gate.open);
  return open ? <NoticeProbe /> : null;
}

const probe = (): string => screen.getByTestId('notice-probe').props.children as string;
let bed: HomeBed | null = null;

async function signedInBed(): Promise<HomeBed> {
  bed = createHomeBed();
  bed.mount(<LateScreen />);
  await bed.signIn();
  expect(screen.getByTestId('bed-probe').props.children).toMatch(/link=LIVE\/ONLINE\/LIVE$/);
  return bed;
}

/** Advances the fake Core clock in small steps until the newest heartbeat is `state`. */
async function until(current: HomeBed, state: HeartbeatState, limitMs = 20_000): Promise<void> {
  for (let waited = 0; waited < limitMs; waited += 50) {
    if (current.heartbeats[current.heartbeats.length - 1] === `LIVE/${state}`) return;
    await current.elapse(50, 50);
  }
  throw new Error(`the link never reached ${state}`);
}

describe('end to end: a screen opened while the socket reconnects after an outage (F-1)', () => {
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
    gate.open = false;
    gate.listeners.clear();
  });

  afterEach(() => {
    if (bed !== null) {
      bed.stop();
      bed.fake.assertNoViolations();
      bed = null;
    }
    cleanup();
  });

  it('shows the notice at its first render (M0\'s first snippet showed "Live"), keeps it through the attempts, hides it at the first heartbeat', async () => {
    const current = await signedInBed();
    current.goDown();
    await flush();
    await until(current, 'CONNECTING');
    openGate(true);
    expect(probe()).toBe('view=settling offline=true m0=false chip=offline banner=offline');
    await until(current, 'OFFLINE');
    expect(probe()).toBe('view=down offline=true m0=true chip=offline banner=offline');
    await until(current, 'CONNECTING');
    expect(probe()).toBe('view=settling offline=true m0=true chip=offline banner=offline');
    current.comeBack();
    await until(current, 'LIVE');
    expect(probe()).toMatch(/^view=up offline=false m0=false chip=live banner=(?:resynced|hidden)$/);
  });

  it('a screen opened while the link is up shows nothing', async () => {
    await signedInBed();
    openGate(true);
    expect(probe()).toBe('view=up offline=false m0=false chip=live banner=hidden');
  });
});
