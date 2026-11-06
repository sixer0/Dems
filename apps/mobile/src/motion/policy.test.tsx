// T-M12 (04_mobile_specs §10.1; MA-18 unit part): OS reduce-motion or the in-app override → loops
// off and the kit's animation: 'disable-all'; plus the D43 `?motion=off` test switch, proof mode,
// persistence (merge into dems.mobile.prefs.v1) and the ReducedMotionConfig mode.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import { useCombinedAnimationDisabledState } from 'heroui-native/hooks';
import { AccessibilityInfo, AppState, Text, type AppStateStatus } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { heroUIConfig } from '@/providers';
import { activeLoopNames, resetLoopRegistryForTests } from './loops';
import { MotionPolicyProvider } from './motion-policy-provider';
import {
  kitAnimation,
  motionStore,
  parseMotionLink,
  resetMotionStateForTests,
  resolvePolicy,
  resolveSlow,
  type LinkMotionMode,
} from './policy';
import { MOBILE_PREFS_KEY } from './prefs';
import type { MotionPolicy } from './tokens';
import { useAmbientLoop, useMotionPolicy, useMotionSettings } from './use-motion-policy';

// Deep links: `useLinkingURL` returns whatever the test sets here (re-read on every render).
let mockLinkingUrl: string | null = null;
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockLinkingUrl }));

// Record the ReducedMotionConfig mode the provider renders (the real one only flips a global).
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...actual,
    __esModule: true,
    ReducedMotionConfig: ({ mode }: { mode: string }) =>
      React.createElement(RN.View, { testID: `reduced-motion-config-${mode}` }),
  };
});

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 800, height: 1280 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};

let osReduceMotion = false;
let reduceMotionListener: ((enabled: boolean) => void) | null = null;
let appStateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(async () => {
  resetMotionStateForTests();
  resetLoopRegistryForTests();
  mockLinkingUrl = null;
  osReduceMotion = false;
  reduceMotionListener = null;
  appStateListener = null;
  await AsyncStorage.clear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => osReduceMotion);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (v: boolean) => void) => {
    if (event === 'reduceMotionChanged') reduceMotionListener = handler;
    return { remove: jest.fn() };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((event: string, handler: (s: AppStateStatus) => void) => {
    if (event === 'change') appStateListener = handler;
    return { remove: jest.fn() };
  }) as unknown as typeof AppState.addEventListener);
  // Reanimated's one-time "Reduced motion setting is overwritten" dev warning.
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Kit probe: HeroUI Native's own combined "animations disabled" state. */
function KitProbe() {
  const disabled = useCombinedAnimationDisabledState(undefined);
  return <Text testID="kit">{disabled ? 'kit-disabled' : 'kit-animated'}</Text>;
}

function LoopProbe({ name }: { name: string }) {
  const running = useAmbientLoop(name);
  return <Text testID={`loop-${name}`}>{running ? 'on' : 'off'}</Text>;
}

function PolicyProbe() {
  const policy = useMotionPolicy();
  const { slow } = useMotionSettings();
  return <Text testID="policy">{`${policy}${slow ? ':slow' : ''}`}</Text>;
}

/** The root-layout wiring step 70 uses: the policy reaches the kit through the render prop. */
function App() {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <MotionPolicyProvider debugOverlay={false}>
        {(policy: MotionPolicy) => (
          <HeroUINativeProvider config={{ ...heroUIConfig(policy === 'reduced'), toast: false, devInfo: { stylingPrinciples: false } }}>
            <PolicyProbe />
            <KitProbe />
            <LoopProbe name="ring-rotate" />
            <LoopProbe name="glow-breath" />
          </HeroUINativeProvider>
        )}
      </MotionPolicyProvider>
    </SafeAreaProvider>
  );
}

async function renderApp() {
  const utils = render(<App />);
  await waitFor(() => expect(motionStore.getState().prefsHydrated).toBe(true));
  return utils;
}

function expectFull() {
  expect(screen.getByTestId('policy')).toHaveTextContent('full');
  expect(screen.getByTestId('reduced-motion-config-never')).toBeTruthy();
  expect(screen.getByTestId('kit')).toHaveTextContent('kit-animated');
  expect(screen.getByTestId('loop-ring-rotate')).toHaveTextContent('on');
  expect(activeLoopNames().sort()).toEqual(['glow-breath', 'ring-rotate']);
}

function expectReduced() {
  expect(screen.getByTestId('policy')).toHaveTextContent('reduced');
  expect(screen.getByTestId('reduced-motion-config-always')).toBeTruthy();
  expect(screen.getByTestId('kit')).toHaveTextContent('kit-disabled');
  expect(screen.getByTestId('loop-ring-rotate')).toHaveTextContent('off');
  expect(screen.getByTestId('loop-glow-breath')).toHaveTextContent('off');
  expect(activeLoopNames()).toEqual([]);
}

describe('T-M12 policy resolution (pure)', () => {
  const cases: readonly [boolean, boolean, LinkMotionMode, MotionPolicy][] = [
    [false, false, 'default', 'full'],
    [true, false, 'default', 'reduced'],
    [false, true, 'default', 'reduced'],
    [false, false, 'off', 'reduced'],
    [true, true, 'off', 'reduced'],
    [false, false, 'slow', 'full'],
    [true, false, 'slow', 'reduced'],
  ];
  it.each(cases)('os=%s override=%s link=%s → %s', (os, override, link, expected) => {
    expect(resolvePolicy({ osReduceMotion: os, reduceMotionOverride: override, linkMotion: link })).toBe(expected);
  });

  it('proof mode applies only under full motion', () => {
    expect(resolveSlow({ osReduceMotion: false, reduceMotionOverride: false, linkMotion: 'slow' })).toBe(true);
    expect(resolveSlow({ osReduceMotion: false, reduceMotionOverride: true, linkMotion: 'slow' })).toBe(false);
  });

  it("maps the policy to the kit's animation switch (VM-04) as AppProviders does", () => {
    expect(kitAnimation('reduced')).toBe('disable-all');
    expect(kitAnimation('full')).toBeUndefined();
    expect(heroUIConfig(true).animation).toBe(kitAnimation('reduced'));
    expect(heroUIConfig(false).animation).toBe(kitAnimation('full'));
  });

  it('parses the deep-link switches', () => {
    expect(parseMotionLink('demsdemo:///home?motion=off')).toEqual({ motion: 'off' });
    expect(parseMotionLink('demsdemo://?motion=slow')).toEqual({ motion: 'slow' });
    expect(parseMotionLink('demsdemo:///session/live?scenario=recording&debug=1')).toEqual({ debug: true });
    expect(parseMotionLink('demsdemo:///home?Motion=FULL&debug=0#x')).toEqual({ motion: 'default', debug: false });
    expect(parseMotionLink('demsdemo:///home?motion=sideways')).toEqual({});
    expect(parseMotionLink('demsdemo:///home')).toEqual({});
    expect(parseMotionLink(null)).toEqual({});
  });
});

describe('T-M12 MotionPolicyProvider', () => {
  it('runs full motion by default: ReducedMotionConfig Never, kit animated, loops registered', async () => {
    await renderApp();
    expectFull();
  });

  it('OS reduce motion at launch → reduced: loops off, kit disable-all, ReducedMotionConfig Always', async () => {
    osReduceMotion = true;
    await renderApp();
    await waitFor(() => expect(screen.getByTestId('policy')).toHaveTextContent('reduced'));
    expectReduced();
  });

  it('follows a live OS change (transition_animation_scale 0 → reduceMotionChanged) and back', async () => {
    await renderApp();
    expectFull();
    act(() => reduceMotionListener?.(true));
    expectReduced();
    act(() => reduceMotionListener?.(false));
    expectFull();
  });

  it('the in-app override → reduced, persisted by merge without touching other prefs fields', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'HEARTBEAT', railCollapsed: true }));
    await renderApp();
    expectFull();
    act(() => motionStore.getState().setReduceMotionOverride(true));
    expectReduced();
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY)) ?? '{}')).toEqual({
        coreLinkSource: 'HEARTBEAT',
        railCollapsed: true,
        reduceMotion: true,
      }),
    );
    act(() => motionStore.getState().setReduceMotionOverride(false));
    expectFull();
  });

  it('reads a persisted override at launch', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ reduceMotion: true, haptics: false }));
    await renderApp();
    expectReduced();
    expect(motionStore.getState().hapticsEnabled).toBe(false);
  });

  it('keeps a switch the user flipped before the stored prefs arrived', () => {
    motionStore.getState().setReduceMotionOverride(true);
    motionStore.getState().hydratePrefs({ reduceMotion: false, haptics: false });
    expect(motionStore.getState().reduceMotionOverride).toBe(true);
    expect(motionStore.getState().hapticsEnabled).toBe(false);
  });

  it('survives unreadable prefs: defaults stay, the error is flagged for Settings', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, 'not json');
    await renderApp();
    expectFull();
    expect(motionStore.getState().prefsError).toBe('read');
  });

  it('D43: a ?motion=off deep link pauses every ambient loop; it sticks until ?motion=full', async () => {
    mockLinkingUrl = 'demsdemo:///home?motion=off';
    const { rerender } = await renderApp();
    expectReduced();
    mockLinkingUrl = 'demsdemo:///evidence';
    rerender(<App />);
    expectReduced();
    mockLinkingUrl = 'demsdemo:///home?motion=full';
    rerender(<App />);
    expectFull();
  });

  it('?motion=slow turns on proof mode (×10) while the policy stays full', async () => {
    mockLinkingUrl = 'demsdemo://?motion=slow';
    await renderApp();
    expect(screen.getByTestId('policy')).toHaveTextContent('full:slow');
    expect(screen.getByTestId('reduced-motion-config-never')).toBeTruthy();
  });

  it('pauses loops while the app is in the background', async () => {
    await renderApp();
    act(() => appStateListener?.('background'));
    expect(screen.getByTestId('loop-ring-rotate')).toHaveTextContent('off');
    expect(screen.getByTestId('kit')).toHaveTextContent('kit-animated');
    expect(activeLoopNames()).toEqual([]);
    act(() => appStateListener?.('active'));
    expect(screen.getByTestId('loop-ring-rotate')).toHaveTextContent('on');
  });
});
