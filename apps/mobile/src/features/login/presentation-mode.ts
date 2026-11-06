/**
 * Presentation mode, as the Login screen reads it (04_mobile_specs §4.1 L10: the Demo operators
 * list is hidden in presentation mode, D28/Q14; §5.3: the flag lives in `dems.mobile.prefs.v1`).
 *
 * The Settings screen (step 88, §4.15 "Switch Presentation mode") owns the field and writes it by
 * merge (D57). Until then no writer exists, so the field name is fixed here and handed to step 88:
 * `presentationMode: boolean` (hand-over H-S75-1). This module only READS the shared key, once per
 * Login mount; it never writes it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { MOBILE_PREFS_KEY } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';

/** The field of `dems.mobile.prefs.v1` that holds presentation mode (owner: Settings, step 88). */
export const PRESENTATION_MODE_FIELD = 'presentationMode';

/** Reads the flag from a stored prefs value; a missing or non-boolean field is `false`. Throws on non-objects. */
export function parsePresentationMode(raw: string | null): boolean {
  if (raw == null) return false;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${MOBILE_PREFS_KEY} is not a JSON object`);
  }
  return (value as Record<string, unknown>)[PRESENTATION_MODE_FIELD] === true;
}

export async function readPresentationMode(): Promise<boolean> {
  return parsePresentationMode(await AsyncStorage.getItem(MOBILE_PREFS_KEY));
}

/**
 * `null` until the stored value is read (the demo list stays unrendered meanwhile, so it never
 * flashes in presentation mode), then the flag. A read failure is logged and treated as "on":
 * the demo credentials are then withheld rather than shown by mistake.
 */
export function usePresentationMode(): boolean | null {
  const [mode, setMode] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    readPresentationMode()
      .then((value) => {
        if (live) setMode(value);
      })
      .catch((error: unknown) => {
        reportRuntimeIssue('warn', 'login.presentationMode.read', error, { key: MOBILE_PREFS_KEY });
        if (live) setMode(true);
      });
    return () => {
      live = false;
    };
  }, []);
  return mode;
}
