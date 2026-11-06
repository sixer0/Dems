/**
 * The Core link (04_mobile_specs §4.4 step 2, §5.2 "Core link", §5.5; Q-M8 approved in D38).
 *
 * - **SIMULATED (retired on this device):** the in-app simulator is the Core. The link is the simulator's
 *   `tabletLink` (CONNECTED → ONLINE), which demo controls can drop (`setTabletLink('OFFLINE')`).
 * - **HEARTBEAT (alternative):** the link follows the mock-core heartbeat over `adb reverse`
 *   (`ws://127.0.0.1:4400/ws`): LIVE → ONLINE, anything else → OFFLINE. The runtime then drives the
 *   simulator's `tabletLink` from it, so the precheck CORE check blocks while mock-core is down
 *   (MA-10, S32-5) and the Devices screen shows the tablet offline.
 * - **LIVE (the only source since 2026-11-05):** the Core server is the
 *   Core (`ws://127.0.0.1:4420/ws` over `adb reverse`). The data is the server's replica, not the
 *   simulator's, and the link follows the heartbeat of that one socket: LIVE → ONLINE, anything
 *   else → OFFLINE. SIMULATED and HEARTBEAT remain in the type for the shared simulator and the
 *   web console; on this device they are no longer selectable and a stored value of them is read
 *   as LIVE.
 *
 * The source is a user preference in the shared key `dems.mobile.prefs.v1`, field `coreLinkSource`.
 * This module owns only that field and writes it with `AsyncStorage.mergeItem` (D57: every writer
 * of the key merges, so the motion and rail fields survive).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import type { CoreLinkState, HeartbeatState } from '@dems/shared/domain';
import type { TabletLinkState } from '@dems/shared/sim';
import { MOBILE_PREFS_KEY } from '@/motion/prefs';
import type { CoreLinkSource } from './contract';
import { reportRuntimeIssue } from './log';

export const DEFAULT_CORE_LINK_SOURCE: CoreLinkSource = 'LIVE';
/** What the device offers: one source. Settings builds its control from this list. */
export const CORE_LINK_SOURCES: readonly CoreLinkSource[] = ['LIVE'];
/** Every name that still runs: the older sources stay reachable to the debug `core=` link and the tests. */
export const KNOWN_CORE_LINK_SOURCES: readonly CoreLinkSource[] = ['SIMULATED', 'HEARTBEAT', 'LIVE'];

/**
 * Whether a source can be used in this build (register L5, RT-1, D163). LIVE is available in every
 * build type, and a release build allows LIVE only. A debug build (and jest, where `__DEV__` is
 * true) keeps the older sources of `KNOWN_CORE_LINK_SOURCES` reachable to the debug `core=` link
 * and to the tests, never to a UI control: Settings builds its control from `CORE_LINK_SOURCES`.
 */
export function isCoreLinkSourceAvailable(source: CoreLinkSource, isDevBuild: boolean = __DEV__): boolean {
  return source === 'LIVE' || (isDevBuild && KNOWN_CORE_LINK_SOURCES.includes(source));
}

/** The source the build actually uses: an unavailable stored or requested choice → the default. */
export function effectiveCoreLinkSource(source: CoreLinkSource, isDevBuild: boolean = __DEV__): CoreLinkSource {
  return isCoreLinkSourceAvailable(source, isDevBuild) ? source : DEFAULT_CORE_LINK_SOURCE;
}

/**
 * The link state the app shows for a source (pure; 04 §5.2). HEARTBEAT and LIVE follow the
 * heartbeat they are given (mock-core's, or the Core server's socket); SIMULATED follows the
 * simulator's tablet link. In LIVE mode `tabletLink` is the server's own statement about paired
 * devices and says nothing about this app's link, so it is not read.
 */
export function coreLinkStateFor(
  source: CoreLinkSource,
  heartbeat: HeartbeatState,
  tabletLink: TabletLinkState,
): CoreLinkState {
  if (source === 'HEARTBEAT' || source === 'LIVE') return heartbeat === 'LIVE' ? 'ONLINE' : 'OFFLINE';
  return tabletLink === 'CONNECTED' ? 'ONLINE' : 'OFFLINE';
}

/**
 * The simulator tablet link a heartbeat state implies, or `null` for "leave it": CONNECTING is a
 * transient (first connect, or between reconnect attempts), so it never writes an audit row.
 */
export function tabletLinkForHeartbeat(heartbeat: HeartbeatState): TabletLinkState | null {
  switch (heartbeat) {
    case 'LIVE':
      return 'CONNECTED';
    case 'STALE':
    case 'OFFLINE':
      return 'OFFLINE';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// The preference (`dems.mobile.prefs.v1` → `coreLinkSource`)
// ---------------------------------------------------------------------------------------------

/** Reads `coreLinkSource` from a stored prefs value; missing or unknown → the default. */
export function parseCoreLinkSource(raw: string | null): CoreLinkSource {
  if (raw == null) return DEFAULT_CORE_LINK_SOURCE;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${MOBILE_PREFS_KEY} is not a JSON object`);
  }
  const source = (value as Record<string, unknown>).coreLinkSource;
  return source === 'LIVE' ? source : DEFAULT_CORE_LINK_SOURCE;
}

export async function readCoreLinkSource(): Promise<CoreLinkSource> {
  return parseCoreLinkSource(await AsyncStorage.getItem(MOBILE_PREFS_KEY));
}

/** Merges `coreLinkSource` into the shared key; every other field stays (D57). */
export async function writeCoreLinkSource(source: CoreLinkSource): Promise<void> {
  await AsyncStorage.mergeItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: source }));
}

interface CoreLinkPrefsState {
  source: CoreLinkSource;
  hydrated: boolean;
  /** A failed read or write; the in-memory value still applies (Settings shows a toast). */
  error: 'read' | 'write' | null;
}

// Named `use…` because it is a hook: the React Compiler (on in the Metro build via app.json
// `experiments.reactCompiler`, off in jest) treats a call to a function without the `use` prefix as
// a pure call it may memoize and skip, which changes the hook order on the next render (step 73
// found this on the device).
const useCoreLinkPrefsStore = create<CoreLinkPrefsState>(() => ({
  source: DEFAULT_CORE_LINK_SOURCE,
  hydrated: false,
  error: null,
}));

let hydration: Promise<void> | null = null;

/** Reads the stored source once per process (the runtime's hydration gate waits for it). */
export function hydrateCoreLinkSource(): Promise<void> {
  hydration ??= readCoreLinkSource()
    .then((source) => {
      // A choice made before the read finished wins over the stored value.
      // A SIMULATED or HEARTBEAT value stored by an older build is read as LIVE.
      if (!useCoreLinkPrefsStore.getState().hydrated) {
        useCoreLinkPrefsStore.setState({ source: effectiveCoreLinkSource(source), hydrated: true });
      }
    })
    .catch((error: unknown) => {
      reportRuntimeIssue('warn', 'runtime.coreLink.readPrefs', error, { key: MOBILE_PREFS_KEY });
      useCoreLinkPrefsStore.setState({ hydrated: true, error: 'read' });
    });
  return hydration;
}

/** Sets the source now and persists it by merge. */
export function setCoreLinkSource(source: CoreLinkSource): void {
  if (!isCoreLinkSourceAvailable(source)) {
    // A release build allows LIVE only (L5, RT-1); Settings offers LIVE alone in every build.
    reportRuntimeIssue('warn', 'runtime.coreLink.unavailableSource', new Error(`${source} is not available in this build`), { source });
    return;
  }
  useCoreLinkPrefsStore.setState({ source, hydrated: true, error: null });
  writeCoreLinkSource(source).catch((error: unknown) => {
    reportRuntimeIssue('warn', 'runtime.coreLink.writePrefs', error, { key: MOBILE_PREFS_KEY, source });
    useCoreLinkPrefsStore.setState({ error: 'write' });
  });
}

export interface CoreLinkSourceSetting {
  readonly source: CoreLinkSource;
  readonly hydrated: boolean;
  readonly error: 'read' | 'write' | null;
  setSource(source: CoreLinkSource): void;
}

/** True once the stored source has been read (or the read failed) in this process. */
export function isCoreLinkSourceHydrated(): boolean {
  return useCoreLinkPrefsStore.getState().hydrated;
}

/** The source as it stands now, outside React (the runtime's source decision, the debug hooks). */
export function getCoreLinkSource(): CoreLinkSource {
  return useCoreLinkPrefsStore.getState().source;
}

/**
 * The current source only. Re-renders only when the source changes, not when hydration finishes
 * with the default value (the runtime's hydration gate waits for `hydrateCoreLinkSource()` instead).
 */
export function useCoreLinkSource(): CoreLinkSource {
  return useCoreLinkPrefsStore((s) => s.source);
}

/** Settings → App Preferences → "Core link source" (step 88 binds its control to this). */
export function useCoreLinkSourceSetting(): CoreLinkSourceSetting {
  const source = useCoreLinkPrefsStore((s) => s.source);
  const hydrated = useCoreLinkPrefsStore((s) => s.hydrated);
  const error = useCoreLinkPrefsStore((s) => s.error);
  useEffect(() => {
    void hydrateCoreLinkSource();
  }, []);
  const setSource = useCallback((next: CoreLinkSource) => setCoreLinkSource(next), []);
  return { source, hydrated, error, setSource };
}

/** Test hook: forget the hydrated value so the next read goes to storage again. */
export function resetCoreLinkPrefsForTests(): void {
  hydration = null;
  useCoreLinkPrefsStore.setState({ source: DEFAULT_CORE_LINK_SOURCE, hydrated: false, error: null });
}
