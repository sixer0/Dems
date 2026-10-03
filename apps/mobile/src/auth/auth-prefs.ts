/**
 * Biometric preferences (04_mobile_specs §5.3 key `dems.mobile.auth.v1`, §6.3).
 *
 * Holds exactly `{ lastOperatorId, biometricEnabled }`: an operator id such as "OPR-001" and a
 * flag. Never a username, a password, a token or a biometric template (the OS keeps those). This
 * module is the key's only writer.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { reportRuntimeIssue } from '@/runtime';

export const MOBILE_AUTH_KEY = 'dems.mobile.auth.v1';

export interface AuthPrefs {
  /** The operator the fingerprint button signs in (the "simulated identity binding", §6.3). */
  readonly lastOperatorId: string | null;
  readonly biometricEnabled: boolean;
}

export const DEFAULT_AUTH_PREFS: AuthPrefs = { lastOperatorId: null, biometricEnabled: false };

/** Operator ids of the dataset (`OPR-001`); anything else is ignored. */
const OPERATOR_ID = /^[A-Z]{2,5}-\d{1,6}$/;

/** Parses a stored value; unknown fields are dropped, a bad field falls back to its default. Throws on non-JSON. */
export function parseAuthPrefs(raw: string | null): AuthPrefs {
  if (raw == null) return DEFAULT_AUTH_PREFS;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${MOBILE_AUTH_KEY} is not a JSON object`);
  }
  const record = value as Record<string, unknown>;
  const lastOperatorId =
    typeof record.lastOperatorId === 'string' && OPERATOR_ID.test(record.lastOperatorId) ? record.lastOperatorId : null;
  return { lastOperatorId, biometricEnabled: record.biometricEnabled === true && lastOperatorId !== null };
}

export async function readAuthPrefs(): Promise<AuthPrefs> {
  return parseAuthPrefs(await AsyncStorage.getItem(MOBILE_AUTH_KEY));
}

export async function writeAuthPrefs(prefs: AuthPrefs): Promise<void> {
  await AsyncStorage.setItem(
    MOBILE_AUTH_KEY,
    JSON.stringify({ lastOperatorId: prefs.lastOperatorId, biometricEnabled: prefs.biometricEnabled }),
  );
}

// ---------------------------------------------------------------------------------------------
// In-memory copy, read once per process (Login, Settings and the offer dialog share it)
// ---------------------------------------------------------------------------------------------

interface AuthPrefsState extends AuthPrefs {
  readonly hydrated: boolean;
  /** A failed read or write; the in-memory value still applies (Settings shows a toast). */
  readonly error: 'read' | 'write' | null;
}

// Named `use…` because it is a hook: the React Compiler (on in the Metro build via app.json
// `experiments.reactCompiler`, off in jest) treats a call to a function without the `use` prefix as
// a pure call it may memoize and skip, which changes the hook order on the next render (step 73
// found this on the device).
const useAuthPrefsStore = create<AuthPrefsState>(() => ({ ...DEFAULT_AUTH_PREFS, hydrated: false, error: null }));

let hydration: Promise<void> | null = null;

/** Reads `dems.mobile.auth.v1` once per process; a failure keeps the defaults (logged). */
export function hydrateAuthPrefs(): Promise<void> {
  hydration ??= readAuthPrefs()
    .then((stored) => {
      // A choice made before the read finished wins over the stored value.
      if (!useAuthPrefsStore.getState().hydrated) useAuthPrefsStore.setState({ ...stored, hydrated: true });
    })
    .catch((error: unknown) => {
      reportRuntimeIssue('warn', 'auth.prefs.read', error, { key: MOBILE_AUTH_KEY });
      useAuthPrefsStore.setState({ hydrated: true, error: 'read' });
    });
  return hydration;
}

/** The current preferences (sync). */
export function getAuthPrefs(): AuthPrefs {
  const { lastOperatorId, biometricEnabled } = useAuthPrefsStore.getState();
  return { lastOperatorId, biometricEnabled };
}

/** Sets the preferences now and persists them. Never rejects (a failure sets `error`, logged). */
export async function setAuthPrefs(next: AuthPrefs): Promise<void> {
  useAuthPrefsStore.setState({ ...next, hydrated: true, error: null });
  try {
    await writeAuthPrefs(next);
  } catch (error) {
    reportRuntimeIssue('warn', 'auth.prefs.write', error, { key: MOBILE_AUTH_KEY });
    useAuthPrefsStore.setState({ error: 'write' });
  }
}

export interface AuthPrefsView extends AuthPrefs {
  readonly error: 'read' | 'write' | null;
}

/** The preferences as primitives: re-renders only when a value changes, not on hydration alone. */
export function useAuthPrefs(): AuthPrefsView {
  const lastOperatorId = useAuthPrefsStore((s) => s.lastOperatorId);
  const biometricEnabled = useAuthPrefsStore((s) => s.biometricEnabled);
  const error = useAuthPrefsStore((s) => s.error);
  useEffect(() => {
    void hydrateAuthPrefs();
  }, []);
  return useMemo(() => ({ lastOperatorId, biometricEnabled, error }), [lastOperatorId, biometricEnabled, error]);
}

/** Test hook: forget the in-memory copy so the next read goes to storage again. */
export function resetAuthPrefsForTests(): void {
  hydration = null;
  useAuthPrefsStore.setState({ ...DEFAULT_AUTH_PREFS, hydrated: false, error: null });
}
