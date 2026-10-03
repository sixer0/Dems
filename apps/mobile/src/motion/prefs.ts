/**
 * Motion preferences persistence (04_mobile_specs §5.3 key `dems.mobile.prefs.v1`, §7.6, §7.7).
 *
 * The key is shared: it also holds presentation mode, the Core link source and the rail collapse
 * flag, which other modules own. The motion kit therefore reads the whole object but writes only
 * its own two fields, through `AsyncStorage.mergeItem`, so a write never drops another owner's
 * field. Field names: `reduceMotion` (the in-app override) and `haptics` (the Haptics switch).
 * No credentials or personal data live here (§5.3).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MOBILE_PREFS_KEY = 'dems.mobile.prefs.v1';

export interface MotionPrefs {
  /** Settings → App Preferences → Reduce motion (§7.7). Default false. */
  readonly reduceMotion: boolean;
  /** Settings → App Preferences → Haptics (§7.6). Default true. */
  readonly haptics: boolean;
}

export const DEFAULT_MOTION_PREFS: MotionPrefs = { reduceMotion: false, haptics: true };

/**
 * Picks the motion fields out of a stored prefs value. Unknown fields are ignored; a field of the
 * wrong type counts as absent. Throws on a value that is not a JSON object.
 */
export function parseMotionPrefs(raw: string | null): Partial<MotionPrefs> {
  if (raw == null) return {};
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${MOBILE_PREFS_KEY} is not a JSON object`);
  }
  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.reduceMotion === 'boolean' ? { reduceMotion: record.reduceMotion } : {}),
    ...(typeof record.haptics === 'boolean' ? { haptics: record.haptics } : {}),
  };
}

/** Reads the stored motion fields; rejects on a storage or JSON failure (the caller logs it). */
export async function readMotionPrefs(): Promise<Partial<MotionPrefs>> {
  return parseMotionPrefs(await AsyncStorage.getItem(MOBILE_PREFS_KEY));
}

/** Merges the given motion fields into the shared key, keeping every other owner's fields. */
export async function writeMotionPrefs(patch: Partial<MotionPrefs>): Promise<void> {
  await AsyncStorage.mergeItem(MOBILE_PREFS_KEY, JSON.stringify(patch));
}
