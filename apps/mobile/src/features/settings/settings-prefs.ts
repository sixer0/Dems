/**
 * Settings-owned fields of the shared preferences key `dems.mobile.prefs.v1` (04_mobile_specs §5.3).
 *
 * The key is shared (D57): the motion kit owns `reduceMotion` and `haptics`, the runtime owns
 * `coreLinkSource`, the navigation shell owns `railCollapsed`. Settings owns:
 *
 * - `presentationMode: boolean` (D88, hand-over H-S75-1): the Login screen reads it through
 *   `@/features/login/presentation-mode` to hide the demo operators; Settings also hides the Demo
 *   controls with it (§4.15);
 * - `meterSize: 'card' | 'compact'`: the session monitor's default meter size (brief; hand-over
 *   H-S88-2: the monitor keeps its own local choice until it reads this field);
 * - `notifications: { devices, storage, time, system }`: the alert-toast switches (§4.15
 *   `notifications`; hand-over H-S88-3: no alert-toast consumer reads them yet).
 *
 * Every write goes through `AsyncStorage.mergeItem` with only these fields, so no other owner's
 * field is ever dropped (D57: never `setItem` the whole object).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { PRESENTATION_MODE_FIELD } from '@/features/login/presentation-mode';
import { MOBILE_PREFS_KEY } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CATEGORIES,
  type MeterSize,
  type NotificationCategory,
  type NotificationPrefs,
} from './settings-model';

export interface SettingsPrefs {
  readonly presentationMode: boolean;
  readonly meterSize: MeterSize;
  readonly notifications: NotificationPrefs;
}

export const DEFAULT_SETTINGS_PREFS: SettingsPrefs = {
  presentationMode: false,
  meterSize: 'card',
  notifications: DEFAULT_NOTIFICATION_PREFS,
};

/** The stored patch shape (the presentation-mode field name is the Login reader's). */
type StoredPatch = Partial<Record<typeof PRESENTATION_MODE_FIELD, boolean>> & { -readonly [K in Exclude<keyof SettingsPrefs, 'presentationMode'>]?: SettingsPrefs[K] };

/**
 * Picks the Settings fields out of a stored prefs value. Unknown or mistyped fields count as
 * absent; a partial `notifications` object fills the rest from the defaults. Throws on a value
 * that is not a JSON object (the caller logs it).
 */
export function parseSettingsPrefs(raw: string | null): Partial<SettingsPrefs> {
  if (raw == null) return {};
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${MOBILE_PREFS_KEY} is not a JSON object`);
  }
  const record = value as Record<string, unknown>;
  const result: { -readonly [K in keyof SettingsPrefs]?: SettingsPrefs[K] } = {};
  const presentation = record[PRESENTATION_MODE_FIELD];
  if (typeof presentation === 'boolean') result.presentationMode = presentation;
  if (record.meterSize === 'card' || record.meterSize === 'compact') result.meterSize = record.meterSize;
  const stored = record.notifications;
  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
    const entries = stored as Record<string, unknown>;
    const notifications: Record<NotificationCategory, boolean> = { ...DEFAULT_NOTIFICATION_PREFS };
    for (const category of NOTIFICATION_CATEGORIES) {
      const flag = entries[category];
      if (typeof flag === 'boolean') notifications[category] = flag;
    }
    result.notifications = notifications;
  }
  return result;
}

export async function readSettingsPrefs(): Promise<Partial<SettingsPrefs>> {
  return parseSettingsPrefs(await AsyncStorage.getItem(MOBILE_PREFS_KEY));
}

/** Merges only the given Settings fields into the shared key; every other field stays (D57). */
export async function writeSettingsPrefs(patch: Partial<SettingsPrefs>): Promise<void> {
  const stored: StoredPatch = {};
  if (patch.presentationMode !== undefined) stored[PRESENTATION_MODE_FIELD] = patch.presentationMode;
  if (patch.meterSize !== undefined) stored.meterSize = patch.meterSize;
  // The whole sub-object: Settings owns it, and a nested merge is then never needed.
  if (patch.notifications !== undefined) stored.notifications = patch.notifications;
  await AsyncStorage.mergeItem(MOBILE_PREFS_KEY, JSON.stringify(stored));
}

interface SettingsPrefsState extends SettingsPrefs {
  hydrated: boolean;
  /** A failed read or write; the in-memory value still applies (the screen shows a toast). */
  error: 'read' | 'write' | null;
  /** Fields the operator changed in this process: a late read never overrides them. */
  touched: readonly (keyof SettingsPrefs)[];
}

// Named `use…`: the React Compiler (on in the Metro build) treats calls without the prefix as pure
// calls it may skip, which changes the hook order (D66 ruling a).
const useSettingsPrefsStore = create<SettingsPrefsState>(() => ({ ...DEFAULT_SETTINGS_PREFS, hydrated: false, error: null, touched: [] }));

let hydration: Promise<void> | null = null;

/** Reads the stored fields once per process. */
export function hydrateSettingsPrefs(): Promise<void> {
  hydration ??= readSettingsPrefs()
    .then((stored) => {
      const { touched } = useSettingsPrefsStore.getState();
      const kept = Object.fromEntries(Object.entries(stored).filter(([key]) => !touched.includes(key as keyof SettingsPrefs)));
      useSettingsPrefsStore.setState({ ...kept, hydrated: true });
    })
    .catch((error: unknown) => {
      reportRuntimeIssue('warn', 'settings.prefs.read', error, { key: MOBILE_PREFS_KEY });
      useSettingsPrefsStore.setState({ hydrated: true, error: 'read' });
    });
  return hydration;
}

/** Applies a change now and persists it by merge; a failed write is logged and flagged. */
export function setSettingsPrefs(patch: Partial<SettingsPrefs>): void {
  const state = useSettingsPrefsStore.getState();
  const fields = Object.keys(patch) as (keyof SettingsPrefs)[];
  useSettingsPrefsStore.setState({ ...patch, error: null, touched: [...new Set([...state.touched, ...fields])] });
  writeSettingsPrefs(patch).catch((error: unknown) => {
    reportRuntimeIssue('warn', 'settings.prefs.write', error, { key: MOBILE_PREFS_KEY, fields });
    useSettingsPrefsStore.setState({ error: 'write' });
  });
}

export interface SettingsPrefsView extends SettingsPrefs {
  readonly hydrated: boolean;
  readonly error: 'read' | 'write' | null;
  setPresentationMode(on: boolean): void;
  setMeterSize(size: MeterSize): void;
  setNotification(category: NotificationCategory, on: boolean): void;
}

const setPresentationMode = (on: boolean) => setSettingsPrefs({ presentationMode: on });
const setMeterSize = (size: MeterSize) => setSettingsPrefs({ meterSize: size });
const setNotification = (category: NotificationCategory, on: boolean) =>
  setSettingsPrefs({ notifications: { ...useSettingsPrefsStore.getState().notifications, [category]: on } });

/** The Settings fields, their setters and the read/write error (hydrates on first use). */
export function useSettingsPrefs(): SettingsPrefsView {
  const view = useSettingsPrefsStore(
    useShallow((s) => ({
      presentationMode: s.presentationMode,
      meterSize: s.meterSize,
      notifications: s.notifications,
      hydrated: s.hydrated,
      error: s.error,
    })),
  );
  useEffect(() => {
    void hydrateSettingsPrefs();
  }, []);
  return { ...view, setPresentationMode, setMeterSize, setNotification };
}

/** Test hook: forget the hydrated values so the next read goes to storage again. */
export function resetSettingsPrefsForTests(): void {
  hydration = null;
  useSettingsPrefsStore.setState({ ...DEFAULT_SETTINGS_PREFS, hydrated: false, error: null, touched: [] });
}
