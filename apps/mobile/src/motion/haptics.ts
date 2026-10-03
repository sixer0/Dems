/**
 * Haptics service (04_mobile_specs §7.6; MA-20). This is the ONLY module that calls `expo-haptics`;
 * everything else triggers a semantic event (`haptics.trigger('tabSelect')` or `useHaptics()`).
 *
 * Rules (§7.6):
 * - at most one haptic per 400 ms, coalesced: the first event of a window fires at once; later
 *   events in the window collapse into one pending event (the strongest), which fires when the
 *   window ends only if it is stronger than the one that already fired (so a selection burst gives
 *   one tick, and an Error right after a tap is still felt, ≤ 400 ms later);
 * - never tied to 20 Hz data (the window caps any caller at 2.5 Hz);
 * - off when the in-app Haptics switch is off;
 * - NOT reduced by reduce motion (a separate preference).
 */
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { reportMotionIssue } from './log';
import { motionStore } from './policy';
import { SPEC_LITERALS } from './tokens';

/** The seven expo-haptics calls the §7.6 map uses. */
export type HapticKind = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/** The §7.6 map: semantic event → haptic kind (one row of the table per group). */
export const HAPTIC_EVENTS = {
  // Row 1 — tab, rail, filter chip, segmented or stepper selection; Switch toggle → selectionAsync()
  tabSelect: 'selection',
  railSelect: 'selection',
  filterChipSelect: 'selection',
  segmentSelect: 'selection',
  stepperSelect: 'selection',
  switchToggle: 'selection',
  // Row 2 — primary button press (Sign In, Next, Save) → impactAsync(Light)
  primaryPress: 'light',
  // M-C-19 — hold to confirm: light at 0 % and 50 % (heavy at 100 % is endSessionHold)
  holdProgress: 'light',
  // 01_specs §5.5 — the row-18 proof screen's "Show test toast" button (selectionAsync); lets that
  // screen route its haptic through this service with a one-line change (MA-20)
  stackCheckTap: 'selection',
  // Row 3 — Start Recording → impactAsync(Medium)
  recordStart: 'medium',
  // Row 4 — End Session hold completes → impactAsync(Heavy)
  endSessionHold: 'heavy',
  // Row 5 — sign-in success, pairing success, Verify PASS, SEALED stamp → notificationAsync(Success)
  signInSuccess: 'success',
  pairingSuccess: 'success',
  verifyPass: 'success',
  sealedStamp: 'success',
  // Row 6 — gate WARN, MIC clip latch, Storage LOW, Core link lost → notificationAsync(Warning)
  gateWarn: 'warning',
  micClip: 'warning',
  storageLow: 'warning',
  coreLinkLost: 'warning',
  // Row 7 — sign-in failure, lockout, gate BLOCK, critical FAULT, Verify FAIL → notificationAsync(Error)
  signInFailure: 'error',
  lockout: 'error',
  gateBlock: 'error',
  criticalFault: 'error',
  verifyFail: 'error',
} as const satisfies Record<string, HapticKind>;

export type HapticEvent = keyof typeof HAPTIC_EVENTS;

/** Strength order used when events coalesce (notifications outrank impacts; Error is strongest). */
export const HAPTIC_PRIORITY: Readonly<Record<HapticKind, number>> = {
  selection: 0,
  light: 1,
  medium: 2,
  heavy: 3,
  success: 4,
  warning: 5,
  error: 6,
};

export const HAPTIC_MIN_GAP_MS = SPEC_LITERALS.hapticMinGapMs;

/** What one trigger did (tests and logs). */
export type HapticOutcome = 'fired' | 'queued' | 'dropped' | 'disabled';

/** Plays one haptic kind. The default driver maps kinds onto expo-haptics (§7.6 "Call" column). */
export type HapticsDriver = (kind: HapticKind) => Promise<void>;

export const expoHapticsDriver: HapticsDriver = (kind) => {
  switch (kind) {
    case 'selection':
      return Haptics.selectionAsync();
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'heavy':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

export interface HapticsServiceOptions {
  driver?: HapticsDriver;
  /** The in-app Haptics switch; default reads the motion store. */
  isEnabled?: () => boolean;
  /** Clock in ms; default `Date.now`. */
  now?: () => number;
  minGapMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface HapticsService {
  trigger(event: HapticEvent): HapticOutcome;
  /** Drops a pending coalesced haptic (for example when a screen unmounts). */
  cancelPending(): void;
  /** Drops the pending haptic and closes the current window (tests; app-state resets). */
  reset(): void;
}

export function createHapticsService(options: HapticsServiceOptions = {}): HapticsService {
  const driver = options.driver ?? expoHapticsDriver;
  const isEnabled = options.isEnabled ?? (() => motionStore.getState().hapticsEnabled);
  // Looked up per call, so a replaced clock (tests' fake timers) is honoured.
  const now = options.now ?? (() => Date.now());
  const gap = options.minGapMs ?? HAPTIC_MIN_GAP_MS;
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let windowEndsAt = Number.NEGATIVE_INFINITY;
  let firedPriority = -1;
  let pending: HapticKind | null = null;
  let timer: unknown = null;

  function play(kind: HapticKind): void {
    windowEndsAt = now() + gap;
    firedPriority = HAPTIC_PRIORITY[kind];
    try {
      driver(kind).catch((error: unknown) => reportMotionIssue('warn', 'motion.haptics.play', error, { kind }));
    } catch (error) {
      reportMotionIssue('warn', 'motion.haptics.play', error, { kind });
    }
  }

  function cancelPending(): void {
    if (timer !== null) clearTimer(timer);
    timer = null;
    pending = null;
  }

  function flush(): void {
    timer = null;
    const kind = pending;
    pending = null;
    if (kind !== null && isEnabled()) play(kind);
  }

  return {
    trigger(event) {
      const kind = HAPTIC_EVENTS[event];
      if (!isEnabled()) return 'disabled';
      if (now() >= windowEndsAt) {
        play(kind);
        return 'fired';
      }
      const priority = HAPTIC_PRIORITY[kind];
      if (priority <= firedPriority || (pending !== null && priority <= HAPTIC_PRIORITY[pending])) return 'dropped';
      pending = kind;
      if (timer === null) timer = setTimer(flush, Math.max(0, windowEndsAt - now()));
      return 'queued';
    },
    cancelPending,
    reset() {
      cancelPending();
      windowEndsAt = Number.NEGATIVE_INFINITY;
      firedPriority = -1;
    },
  };
}

/** The app-wide service (reads the Haptics switch from the motion store). */
export const haptics: HapticsService = createHapticsService();

/** Convenience for non-React callers. */
export function triggerHaptic(event: HapticEvent): HapticOutcome {
  return haptics.trigger(event);
}

/** Stable trigger function for components. */
export function useHaptics(): (event: HapticEvent) => HapticOutcome {
  return useCallback((event: HapticEvent) => haptics.trigger(event), []);
}
