/**
 * Motion policy hooks (04_mobile_specs §7.7, §7.8).
 *
 * - `useMotionPolicy()` → `'full' | 'reduced'`: pass it to the compositions' `motion` prop.
 * - `useMotionSettings()` → `{ policy, slow }`: pass it to the builders (`./builders`).
 * - `useAmbientLoop(name, …)` → whether a loop may run now; registers it for the overlay.
 * - `useMotionPreferences()` → the Settings switches (Reduce motion, Haptics) and their setters.
 */
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { registerAmbientLoop } from './loops';
import { motionStore, reducedReasons, resolvePolicy, resolveSlow, type MotionState, type ReducedReason } from './policy';
import type { MotionPolicy, MotionSettings } from './tokens';

/** Any slice of the motion state (re-renders only when the selected value changes). */
export function useMotionState<T>(selector: (state: MotionState) => T): T {
  return useStore(motionStore, selector);
}

/** `'reduced'` when the OS setting, the in-app override or the D43 test switch is on. */
export function useMotionPolicy(): MotionPolicy {
  return useStore(motionStore, resolvePolicy);
}

/** Policy plus proof mode, stable between renders while neither changes. */
export function useMotionSettings(): MotionSettings {
  const policy = useStore(motionStore, resolvePolicy);
  const slow = useStore(motionStore, resolveSlow);
  const still = useStore(motionStore, (s) => s.uiRuntimeStalled);
  return useMemo(() => (still ? { policy, slow, still } : { policy, slow }), [policy, slow, still]);
}

/** Why the policy is reduced (empty under full motion). */
export function useReducedReasons(): ReducedReason[] {
  return useStore(motionStore, useShallow(reducedReasons));
}

export interface AmbientLoopOptions {
  /** The loop's own condition (for example "recording"); default true. */
  active?: boolean;
  /** Pause from the caller, for example `!useIsFocused()` or an off-screen canvas. */
  paused?: boolean;
}

/**
 * Whether an ambient loop may run: full motion, active, not paused, app in the foreground
 * (§7.1 Loops, 03M R10). While it may run it is registered by `name` for the `?debug=1` overlay
 * and the P3 cap check. Loops stop under reduced motion and under the D43 `?motion=off` switch.
 */
export function useAmbientLoop(name: string, options: AmbientLoopOptions = {}): boolean {
  const policy = useMotionPolicy();
  const appActive = useStore(motionStore, (s) => s.appActive);
  const running = policy === 'full' && (options.active ?? true) && !options.paused && appActive;
  useEffect(() => {
    if (!running) return undefined;
    return registerAmbientLoop(name);
  }, [running, name]);
  return running;
}

export interface MotionPreferences {
  readonly reduceMotionOverride: boolean;
  readonly hapticsEnabled: boolean;
  readonly osReduceMotion: boolean;
  readonly debugOverlay: boolean;
  readonly hydrated: boolean;
  readonly error: 'read' | 'write' | null;
  setReduceMotionOverride(enabled: boolean): void;
  setHapticsEnabled(enabled: boolean): void;
  setDebugOverlay(enabled: boolean): void;
}

/** The Settings → App Preferences switches (step 88 renders them; §4.15). */
export function useMotionPreferences(): MotionPreferences {
  return useStore(
    motionStore,
    useShallow((s) => ({
      reduceMotionOverride: s.reduceMotionOverride,
      hapticsEnabled: s.hapticsEnabled,
      osReduceMotion: s.osReduceMotion,
      debugOverlay: s.debugOverlay,
      hydrated: s.prefsHydrated,
      error: s.prefsError,
      setReduceMotionOverride: s.setReduceMotionOverride,
      setHapticsEnabled: s.setHapticsEnabled,
      setDebugOverlay: s.setDebugOverlay,
    })),
  );
}
