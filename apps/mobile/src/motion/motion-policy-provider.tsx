/**
 * MotionPolicyProvider (04_mobile_specs §3.2 item 6, §7.7; D43).
 *
 * Feeds the motion store and applies the policy app-wide:
 * - OS reduce motion: Reanimated's start-time value (`useReducedMotion`, VM-05) seeds the first
 *   render, then `AccessibilityInfo.isReduceMotionEnabled()` and the `reduceMotionChanged`
 *   listener keep it live (VM-06);
 * - the persisted Settings switches (`dems.mobile.prefs.v1`: `reduceMotion`, `haptics`);
 * - deep-link switches on every incoming URL: `?motion=off` (D43 test switch: ambient loops off so
 *   uiautomator / Maestro reach idle), `?motion=slow` (proof ×10), `?motion=full`, `?debug=1|0`;
 * - app state: loops pause in the background;
 * - renders `<ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.Never}>`
 *   (explicit modes, because `System` would only use the start-time value, VM-05);
 * - mounts the `?debug=1` overlay.
 *
 * The HeroUI Native `animation: 'disable-all'` switch lives in `AppProviders` (step 68,
 * `heroUIConfig(reducedMotion)`). The root layout (step 70) passes the policy through the render
 * prop, because a hook cannot read a provider that the same component renders:
 *
 *   <MotionPolicyProvider>
 *     {(policy) => <AppProviders reducedMotion={policy === 'reduced'}>…</AppProviders>}
 *   </MotionPolicyProvider>
 *
 * `kitAnimation(policy)` gives the same value for any other kit root.
 */
import * as Linking from 'expo-linking';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, LogBox } from 'react-native';
import { ReduceMotion, ReducedMotionConfig, useReducedMotion } from 'react-native-reanimated';
import { MotionDebugOverlay } from './debug-overlay';
import { reportMotionIssue } from './log';
import { motionStore } from './policy';
import { MOBILE_PREFS_KEY, readMotionPrefs } from './prefs';
import type { MotionPolicy } from './tokens';
import { useMotionPolicy } from './use-motion-policy';

// Reanimated prints one dev warning when ReducedMotionConfig overrides the system value. The
// override is intended (explicit modes, VM-05), so the LogBox banner, which would cover the bottom
// bar in screencaps and Maestro taps, is suppressed for this exact message; Metro still logs it.
LogBox.ignoreLogs(['[Reanimated] Reduced motion setting is overwritten with mode']);

/** The `ReducedMotionConfig` mode for a policy. */
export function reducedMotionMode(policy: MotionPolicy): ReduceMotion {
  return policy === 'reduced' ? ReduceMotion.Always : ReduceMotion.Never;
}

export interface MotionPolicyProviderProps {
  /** Children, or a render function that receives the policy (for `AppProviders reducedMotion`). */
  children: ReactNode | ((policy: MotionPolicy) => ReactNode);
  /** Mount the `?debug=1` overlay here (default true). Pass false to mount `MotionDebugOverlay` elsewhere. */
  debugOverlay?: boolean;
}

export function MotionPolicyProvider({ children, debugOverlay = true }: MotionPolicyProviderProps) {
  const startTimeReduced = useReducedMotion();
  const url = Linking.useLinkingURL();

  // Seed once, before the children's first render, so the first frame already follows the OS
  // setting and a launch deep link (`?motion=off`). Both setters are no-ops when nothing changes.
  useState(() => {
    const store = motionStore.getState();
    store.setOsReduceMotion(startTimeReduced);
    store.applyLinkingUrl(url);
    return true;
  });

  // Later deep links (the app already running).
  useEffect(() => {
    motionStore.getState().applyLinkingUrl(url);
  }, [url]);

  // Live OS reduce-motion setting.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) motionStore.getState().setOsReduceMotion(enabled);
      })
      .catch((error: unknown) => reportMotionIssue('warn', 'motion.provider.osReduceMotion', error));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      motionStore.getState().setOsReduceMotion(enabled);
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  // Foreground / background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      motionStore.getState().setAppActive(state !== 'background');
    });
    return () => subscription.remove();
  }, []);

  // Persisted Settings switches.
  useEffect(() => {
    let alive = true;
    readMotionPrefs()
      .then((prefs) => {
        if (alive) motionStore.getState().hydratePrefs(prefs);
      })
      .catch((error: unknown) => {
        reportMotionIssue('warn', 'motion.provider.readPrefs', error, { key: MOBILE_PREFS_KEY });
        if (alive) motionStore.getState().hydratePrefs({}, 'read');
      });
    return () => {
      alive = false;
    };
  }, []);

  const policy = useMotionPolicy();

  return (
    <>
      <ReducedMotionConfig mode={reducedMotionMode(policy)} />
      {typeof children === 'function' ? children(policy) : children}
      {debugOverlay ? <MotionDebugOverlay /> : null}
    </>
  );
}
