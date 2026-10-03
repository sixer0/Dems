/**
 * Motion policy state (04_mobile_specs §7.7; 03_motion_spec §8; D43).
 *
 * One module-level store, so the policy is readable from React (`useMotionPolicy`), from
 * non-React code (the haptics service) and without a provider in unit tests (default: full
 * motion, haptics on). `MotionPolicyProvider` feeds it: the OS reduce-motion setting (live),
 * the persisted in-app override and Haptics switch, the deep-link switches and the app state.
 *
 * Policy = `'reduced'` when ANY of these holds, else `'full'`:
 * - the OS setting (`AccessibilityInfo.isReduceMotionEnabled()`, which Android derives from
 *   `transition_animation_scale == 0`, VM-06);
 * - the in-app override (Settings → App Preferences → Reduce motion, persisted);
 * - the D43 test switch `?motion=off` on any deep link (pauses every ambient loop so uiautomator
 *   and Maestro can reach idle).
 *
 * Proof mode `?motion=slow` (§7.1, M-PX-02) multiplies durations ×10 while the policy is full.
 * `?debug=1` shows the performance overlay (§3.5, §7.8). Deep-link switches are sticky for the
 * app process: a later link changes them only if it carries the parameter (`?motion=full`,
 * `?debug=0` switch them back).
 */
import { createStore } from 'zustand/vanilla';
import { reportMotionIssue } from './log';
import { DEFAULT_MOTION_PREFS, writeMotionPrefs, type MotionPrefs } from './prefs';
import type { MotionPolicy, MotionSettings } from './tokens';

/** The `?motion=` deep-link switch. `default` = no switch. */
export type LinkMotionMode = 'default' | 'slow' | 'off';

/** Why the policy is reduced (for the debug overlay and logs). */
export type ReducedReason = 'os' | 'override' | 'test';

export interface MotionStateData {
  /** Live OS reduce-motion setting. */
  readonly osReduceMotion: boolean;
  /** In-app override, persisted in `dems.mobile.prefs.v1` (`reduceMotion`). */
  readonly reduceMotionOverride: boolean;
  /** In-app Haptics switch, persisted (`haptics`). Not affected by reduce motion (§7.6). */
  readonly hapticsEnabled: boolean;
  /** `?motion=` switch from the latest deep link that carried it. */
  readonly linkMotion: LinkMotionMode;
  /** Performance overlay: `?debug=1`, or the Settings switch (session only, §4.15). */
  readonly debugOverlay: boolean;
  /** False while the app is in the background: ambient loops pause (§7.1 Loops). */
  readonly appActive: boolean;
  /** True once the persisted prefs were read (or the read failed). */
  readonly prefsHydrated: boolean;
  /** Last persistence failure, for Settings to show a toast; `null` when fine. */
  readonly prefsError: 'read' | 'write' | null;
}

export interface MotionActions {
  setOsReduceMotion(enabled: boolean): void;
  /** Settings → Reduce motion. Persists `reduceMotion` (merge, §5.3). */
  setReduceMotionOverride(enabled: boolean): void;
  /** Settings → Haptics switch; persists `haptics` (merge, §5.3). */
  setHapticsEnabled(enabled: boolean): void;
  /** Settings → Performance overlay (debug builds). Session only. */
  setDebugOverlay(enabled: boolean): void;
  setAppActive(active: boolean): void;
  /** Applies the `motion` and `debug` query parameters of a deep link, if present. */
  applyLinkingUrl(url: string | null | undefined): void;
  /** Applies persisted prefs, except fields the user changed before hydration finished. */
  hydratePrefs(prefs: Partial<MotionPrefs>, error?: 'read'): void;
}

export type MotionState = MotionStateData & MotionActions;

export const INITIAL_MOTION_STATE: MotionStateData = {
  osReduceMotion: false,
  reduceMotionOverride: DEFAULT_MOTION_PREFS.reduceMotion,
  hapticsEnabled: DEFAULT_MOTION_PREFS.haptics,
  linkMotion: 'default',
  debugOverlay: false,
  appActive: true,
  prefsHydrated: false,
  prefsError: null,
};

// ---------------------------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------------------------

export function reducedReasons(s: Pick<MotionStateData, 'osReduceMotion' | 'reduceMotionOverride' | 'linkMotion'>): ReducedReason[] {
  const reasons: ReducedReason[] = [];
  if (s.osReduceMotion) reasons.push('os');
  if (s.reduceMotionOverride) reasons.push('override');
  if (s.linkMotion === 'off') reasons.push('test');
  return reasons;
}

/** `'reduced'` when the OS setting, the override or the D43 test switch is on (§7.7). */
export function resolvePolicy(s: Pick<MotionStateData, 'osReduceMotion' | 'reduceMotionOverride' | 'linkMotion'>): MotionPolicy {
  return reducedReasons(s).length > 0 ? 'reduced' : 'full';
}

/** Proof mode applies only under full motion. */
export function resolveSlow(s: Pick<MotionStateData, 'osReduceMotion' | 'reduceMotionOverride' | 'linkMotion'>): boolean {
  return s.linkMotion === 'slow' && resolvePolicy(s) === 'full';
}

export function resolveSettings(s: Pick<MotionStateData, 'osReduceMotion' | 'reduceMotionOverride' | 'linkMotion'>): MotionSettings {
  return { policy: resolvePolicy(s), slow: resolveSlow(s) };
}

/** HeroUI Native global animation switch for a policy (§3.2 item 7, VM-04). */
export function kitAnimation(policy: MotionPolicy): 'disable-all' | undefined {
  return policy === 'reduced' ? 'disable-all' : undefined;
}

export interface MotionLinkFlags {
  readonly motion?: LinkMotionMode;
  readonly debug?: boolean;
}

const MOTION_VALUES: Readonly<Record<string, LinkMotionMode>> = {
  slow: 'slow',
  off: 'off',
  reduced: 'off',
  none: 'off',
  full: 'default',
  on: 'default',
  normal: 'default',
  default: 'default',
};

function decode(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' '));
  } catch {
    return part;
  }
}

/**
 * Reads `motion` and `debug` from a deep link's query string, for example
 * `demsdemo:///home?motion=off&debug=1`. Pure; unknown values are ignored. Hermes' `URL` lacks
 * `searchParams`, so the query is split by hand.
 */
export function parseMotionLink(url: string | null | undefined): MotionLinkFlags {
  if (!url) return {};
  const q = url.indexOf('?');
  if (q < 0) return {};
  const hash = url.indexOf('#', q);
  const query = url.slice(q + 1, hash < 0 ? undefined : hash);
  let motionFlag: LinkMotionMode | undefined;
  let debugFlag: boolean | undefined;
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decode(eq < 0 ? pair : pair.slice(0, eq)).trim().toLowerCase();
    const value = decode(eq < 0 ? '' : pair.slice(eq + 1)).trim().toLowerCase();
    if (key === 'motion' && value in MOTION_VALUES) motionFlag = MOTION_VALUES[value];
    if (key === 'debug') {
      if (value === '1' || value === 'true') debugFlag = true;
      else if (value === '0' || value === 'false') debugFlag = false;
    }
  }
  return {
    ...(motionFlag !== undefined ? { motion: motionFlag } : {}),
    ...(debugFlag !== undefined ? { debug: debugFlag } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------------------------

/** Fields the user changed before the persisted prefs arrived; hydration must not undo them. */
const touchedBeforeHydration = new Set<keyof MotionPrefs>();

function persist(patch: Partial<MotionPrefs>, onError: () => void): void {
  writeMotionPrefs(patch).catch((error: unknown) => {
    reportMotionIssue('warn', 'motion.prefs.write', error, { fields: Object.keys(patch) });
    onError();
  });
}

export const motionStore = createStore<MotionState>()((set, get) => ({
  ...INITIAL_MOTION_STATE,

  setOsReduceMotion(enabled) {
    if (get().osReduceMotion !== enabled) set({ osReduceMotion: enabled });
  },

  setReduceMotionOverride(enabled) {
    if (!get().prefsHydrated) touchedBeforeHydration.add('reduceMotion');
    if (get().reduceMotionOverride !== enabled) set({ reduceMotionOverride: enabled });
    persist({ reduceMotion: enabled }, () => set({ prefsError: 'write' }));
  },

  setHapticsEnabled(enabled) {
    if (!get().prefsHydrated) touchedBeforeHydration.add('haptics');
    if (get().hapticsEnabled !== enabled) set({ hapticsEnabled: enabled });
    persist({ haptics: enabled }, () => set({ prefsError: 'write' }));
  },

  setDebugOverlay(enabled) {
    if (get().debugOverlay !== enabled) set({ debugOverlay: enabled });
  },

  setAppActive(active) {
    if (get().appActive !== active) set({ appActive: active });
  },

  applyLinkingUrl(url) {
    const flags = parseMotionLink(url);
    const patch: { linkMotion?: LinkMotionMode; debugOverlay?: boolean } = {};
    if (flags.motion !== undefined && flags.motion !== get().linkMotion) patch.linkMotion = flags.motion;
    if (flags.debug !== undefined && flags.debug !== get().debugOverlay) patch.debugOverlay = flags.debug;
    if (Object.keys(patch).length > 0) set(patch);
  },

  hydratePrefs(prefs, error) {
    const s = get();
    set({
      reduceMotionOverride: touchedBeforeHydration.has('reduceMotion')
        ? s.reduceMotionOverride
        : (prefs.reduceMotion ?? s.reduceMotionOverride),
      hapticsEnabled: touchedBeforeHydration.has('haptics') ? s.hapticsEnabled : (prefs.haptics ?? s.hapticsEnabled),
      prefsHydrated: true,
      prefsError: error ?? s.prefsError,
    });
    touchedBeforeHydration.clear();
  },
}));

/** Test helper: back to the initial state (every test file shares the module store). */
export function resetMotionStateForTests(overrides: Partial<MotionStateData> = {}): void {
  touchedBeforeHydration.clear();
  motionStore.setState({ ...INITIAL_MOTION_STATE, ...overrides });
}

/** Current settings, for non-React callers. */
export function getMotionSettings(): MotionSettings {
  return resolveSettings(motionStore.getState());
}
