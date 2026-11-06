/**
 * The extended rail's collapse preference (04_mobile_specs §2.3 "collapse toggle persisted in
 * AsyncStorage `dems.mobile.prefs.v1`"; §5.3).
 *
 * The key is shared with the motion kit (`reduceMotion`, `haptics`), the Core link source and
 * presentation mode. This module owns one field, `railCollapsed`, and writes it only through
 * `AsyncStorage.mergeItem`, so it never drops another owner's field (D57: every writer merges).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { MOBILE_PREFS_KEY } from '@/motion';
import { reportNavigationIssue } from './log';

/** Reads `railCollapsed` from a stored prefs value; a missing or non-boolean field is `false`. */
export function parseRailCollapsed(raw: string | null): boolean {
  if (raw == null) return false;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${MOBILE_PREFS_KEY} is not a JSON object`);
  }
  return (value as Record<string, unknown>).railCollapsed === true;
}

export async function readRailCollapsed(): Promise<boolean> {
  return parseRailCollapsed(await AsyncStorage.getItem(MOBILE_PREFS_KEY));
}

/** Merges `railCollapsed` into the shared key; other fields stay as they are. */
export async function writeRailCollapsed(collapsed: boolean): Promise<void> {
  await AsyncStorage.mergeItem(MOBILE_PREFS_KEY, JSON.stringify({ railCollapsed: collapsed }));
}

interface RailPrefsState {
  collapsed: boolean;
  hydrated: boolean;
  /** Set when a read or write failed; the rail still works with the in-memory value. */
  error: 'read' | 'write' | null;
}

// A zustand bound store is a hook, so its name starts with `use`: the React Compiler (app.json
// `reactCompiler`) memoises calls to non-hook functions, which would skip this hook on a re-render
// and change the hook order (seen on the device in step 70's first session).
const useRailPrefsStore = create<RailPrefsState>(() => ({ collapsed: false, hydrated: false, error: null }));

let hydration: Promise<void> | null = null;

function hydrateOnce(): Promise<void> {
  hydration ??= readRailCollapsed()
    .then((collapsed) => {
      // A toggle made before hydration finished wins over the stored value.
      if (!useRailPrefsStore.getState().hydrated) useRailPrefsStore.setState({ collapsed, hydrated: true });
    })
    .catch((error: unknown) => {
      reportNavigationIssue('warn', 'navigation.railPrefs.read', error, { key: MOBILE_PREFS_KEY });
      useRailPrefsStore.setState({ hydrated: true, error: 'read' });
    });
  return hydration;
}

export interface RailCollapse {
  readonly collapsed: boolean;
  readonly error: 'read' | 'write' | null;
  toggle(): void;
}

/** The persisted collapse flag of the extended rail and its toggle. */
export function useRailCollapse(): RailCollapse {
  const collapsed = useRailPrefsStore((s) => s.collapsed);
  const error = useRailPrefsStore((s) => s.error);

  useEffect(() => {
    void hydrateOnce();
  }, []);

  const toggle = useCallback(() => {
    const next = !useRailPrefsStore.getState().collapsed;
    useRailPrefsStore.setState({ collapsed: next, hydrated: true, error: null });
    writeRailCollapsed(next).catch((writeError: unknown) => {
      reportNavigationIssue('warn', 'navigation.railPrefs.write', writeError, { key: MOBILE_PREFS_KEY });
      useRailPrefsStore.setState({ error: 'write' });
    });
  }, []);

  return { collapsed, error, toggle };
}

/** Test hook: forget the hydrated value so the next hook mount reads storage again. */
export function resetRailPrefsForTests(): void {
  hydration = null;
  useRailPrefsStore.setState({ collapsed: false, hydrated: false, error: null });
}
