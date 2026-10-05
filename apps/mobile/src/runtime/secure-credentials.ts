/**
 * Secure storage of the Live-mode credentials (backend task plan W15; 04_client_integration_spec
 * §9.1 MP-1, MP-4; §9.3 MB-5, MB-6, MB-6a; 01_specs SR-32).
 *
 * THE ONE MODULE THAT IMPORTS `expo-secure-store` (MP-1, AC-C-66; the static test is
 * `./secure-store-import.test.ts`). Everything else in the app calls the functions below.
 *
 * | Item | Key | Value | Authentication requirement |
 * |------|-----|-------|----------------------------|
 * | Device credential | `dems.live.device.v1` | JSON of `PairingRedeemed` (device ID, credential, `pairedAt`, Core identity) | none: the gate reads it at start |
 * | Biometric token | `dems.live.bio.v1` | the `bio_...` string | `requireAuthentication: true`; none only under MB-6a |
 * | Biometric marker | `dems.live.bio.meta.v1` | JSON: operator ID, display name, device ID, `protected` | none: it is not a secret |
 *
 * Rules this module keeps:
 * - A value is never logged, never put into an error, never returned inside a failure. A failure
 *   carries a code, a message class and the native error code. The native error text is read only
 *   to pick the message class; it is not passed on.
 * - Every failure is written to the persistent runtime log (`./log`), by code.
 * - The biometric token is written WITHOUT an authentication requirement only where
 *   `Device.isDevice` is false or the build is a debug build (MB-6a, AC-C-105). Anywhere else that
 *   write is refused and both biometric items are deleted: biometric sign-in is off.
 * - A failed biometric write never leaves a token behind: both biometric items are deleted (MB-6).
 * - Deleting the device credential deletes the biometric items too (MB-2).
 */
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import {
  BIOMETRIC_TOKEN_PATTERN,
  DEVICE_ID_PATTERN,
  OPERATOR_ID_PATTERN,
  PairingRedeemedSchema,
  type PairingRedeemed,
} from '@dems/shared/api';
import { reportRuntimeIssue } from './log';

/** The names of the three items (04_client_integration_spec §9.1; 02_plan §3.4). */
export const SECURE_ITEM_KEYS = {
  deviceCredential: 'dems.live.device.v1',
  biometricToken: 'dems.live.bio.v1',
  biometricMarker: 'dems.live.bio.meta.v1',
} as const;

export type SecureStoreErrorCode =
  /** The OS check did not pass or cannot run: cancelled, no enrolment, no hardware, lockout. */
  | 'AUTHENTICATION'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'DELETE_FAILED'
  /** The caller's value does not have the item's shape; the store was not called. */
  | 'INVALID_VALUE'
  /** The stored text does not have the item's shape. A caller treats the item as absent (MP-4). */
  | 'CORRUPT_ITEM'
  /** A rotation without an enrolment: there is no marker to take the options from. */
  | 'BIOMETRIC_NOT_STORED'
  /** MB-6a: an unprotected biometric item on a physical device in a build that is not a debug build. */
  | 'UNPROTECTED_NOT_ALLOWED';

/** The class of the native error text. Never the text itself. */
export type SecureStoreFailureReason =
  | 'NO_BIOMETRICS_ENROLLED'
  | 'NO_BIOMETRIC_HARDWARE'
  | 'USER_CANCELED'
  | 'LOCKOUT'
  | 'IN_PROGRESS'
  | 'NOT_IN_FOREGROUND'
  | 'KEY_INVALIDATED'
  | 'OTHER';

export interface SecureStoreFailure {
  readonly ok: false;
  readonly code: SecureStoreErrorCode;
  /** Set when the store itself threw; `null` for a refusal of this module. */
  readonly reason: SecureStoreFailureReason | null;
  /** The `code` member of the native error (for example `ERR_AUTHENTICATION`), or `null`. */
  readonly nativeCode: string | null;
}

/** Result of a write or a delete. */
export type SecureStoreOutcome = { readonly ok: true } | SecureStoreFailure;
/** Result of a read: `value` is `null` when the item is absent. */
export type SecureStoreRead<T> = { readonly ok: true; readonly value: T | null } | SecureStoreFailure;
/** Result of a biometric write: how the token item is stored now. */
export type BiometricWriteResult = { readonly ok: true; readonly protected: boolean } | SecureStoreFailure;

/** What is stored after pairing: exactly the answer of the redeem operation. */
export type StoredDeviceCredential = PairingRedeemed;

const BiometricOwnerSchema = z.object({
  operatorId: z.string().regex(OPERATOR_ID_PATTERN),
  displayName: z.string().min(1).max(200),
  deviceId: z.string().regex(DEVICE_ID_PATTERN),
});
const BiometricMarkerSchema = BiometricOwnerSchema.extend({ protected: z.boolean() });

/** Whose token it is: the operator and the device it was issued for (not a secret). */
export type BiometricOwner = z.output<typeof BiometricOwnerSchema>;
/** The marker item: the owner, and whether the token item carries the authentication requirement. */
export type BiometricMarker = z.output<typeof BiometricMarkerSchema>;

/**
 * How `writeBiometricToken` stores the token (MB-5):
 * - `protected`: with `requireAuthentication: true` (cases a and b). A failure stores nothing.
 * - `unprotected`: without it (case c). Refused outside the conditions of MB-6a.
 * - `protected-with-fallback`: protected first; if that write fails for another reason than a
 *   cancelled prompt, unprotected where MB-6a allows it. The fallback is logged, never silent.
 */
export type BiometricWriteMode = 'protected' | 'unprotected' | 'protected-with-fallback';

/** The title of the OS prompt when the caller passes none (Android refuses an empty one). */
const DEFAULT_PROMPT = 'Confirm your identity';
const NATIVE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const SOURCE = 'runtime.secureCredentials';

type Operation = 'read' | 'write' | 'delete';
const FALLBACK_CODE: Readonly<Record<Operation, SecureStoreErrorCode>> = {
  read: 'READ_FAILED',
  write: 'WRITE_FAILED',
  delete: 'DELETE_FAILED',
};

/** The message class of a native error text. The text holds key and keychain names, never a value. */
function reasonOf(text: string): SecureStoreFailureReason {
  const lower = text.toLowerCase();
  if (lower.includes('no biometrics')) return 'NO_BIOMETRICS_ENROLLED';
  if (lower.includes('no hardware') || lower.includes('hardware not present') || lower.includes('hardware unavailable') || lower.includes('unsupported')) {
    return 'NO_BIOMETRIC_HARDWARE';
  }
  if (lower.includes('user canceled') || lower.includes('user cancelled')) return 'USER_CANCELED';
  if (lower.includes('lockout')) return 'LOCKOUT';
  if (lower.includes('already in progress')) return 'IN_PROGRESS';
  if (lower.includes('not in the foreground')) return 'NOT_IN_FOREGROUND';
  if (lower.includes('invalidated')) return 'KEY_INVALIDATED';
  return 'OTHER';
}

function failureOf(error: unknown, operation: Operation): SecureStoreFailure {
  const rawCode = (error as { code?: unknown } | null)?.code;
  const nativeCode = typeof rawCode === 'string' && NATIVE_CODE.test(rawCode) ? rawCode : null;
  const text = error instanceof Error ? error.message : '';
  const reason = reasonOf(text);
  const authentication = nativeCode === 'ERR_AUTHENTICATION' || reason !== 'OTHER' || /authenticat/i.test(text);
  return { ok: false, code: authentication ? 'AUTHENTICATION' : FALLBACK_CODE[operation], reason, nativeCode };
}

function refusal(code: SecureStoreErrorCode): SecureStoreFailure {
  return { ok: false, code, reason: null, nativeCode: null };
}

/** Writes one failure to the persistent runtime log: codes and the item's name, never a value. */
function record(failure: SecureStoreFailure, operation: string, item: string): SecureStoreFailure {
  // A cancelled prompt is the operator's choice; a missing enrolment is a state of the device.
  const level = failure.reason === 'USER_CANCELED' ? 'info' : failure.code === 'AUTHENTICATION' ? 'warn' : 'error';
  reportRuntimeIssue(level, `${SOURCE}.${operation}`, `Secure storage ${operation} failed: ${failure.code}`, {
    item,
    code: failure.code,
    reason: failure.reason,
    nativeCode: failure.nativeCode,
  });
  return failure;
}

function optionsFor(protectedItem: boolean, prompt?: string): SecureStore.SecureStoreOptions {
  return protectedItem
    ? { requireAuthentication: true, authenticationPrompt: prompt && prompt.trim().length > 0 ? prompt : DEFAULT_PROMPT }
    : { requireAuthentication: false };
}

// The three primitives. They never throw and never report: the callers decide what is logged.

async function rawWrite(key: string, value: string, options: SecureStore.SecureStoreOptions): Promise<SecureStoreOutcome> {
  try {
    await SecureStore.setItemAsync(key, value, options);
    return { ok: true };
  } catch (error) {
    return failureOf(error, 'write');
  }
}

async function rawRead(key: string, options: SecureStore.SecureStoreOptions): Promise<SecureStoreRead<string>> {
  try {
    const value = await SecureStore.getItemAsync(key, options);
    return { ok: true, value: typeof value === 'string' ? value : null };
  } catch (error) {
    return failureOf(error, 'read');
  }
}

async function rawDelete(key: string): Promise<SecureStoreOutcome> {
  try {
    await SecureStore.deleteItemAsync(key);
    return { ok: true };
  } catch (error) {
    return failureOf(error, 'delete');
  }
}

/** Parses stored JSON with the item's schema; `null` when it is not of that shape. */
function parseStored<T>(schema: z.ZodType<T>, text: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    // Not JSON: the caller reports CORRUPT_ITEM by code. The text is not looked at further.
    return null;
  }
}

// ----------------------------------------------------------------------------------------------
// Device credential (`dems.live.device.v1`): no authentication requirement.
// ----------------------------------------------------------------------------------------------

/**
 * The stored device credential, or `null` when the device is not paired. A failure (`READ_FAILED`,
 * `CORRUPT_ITEM`) means the item cannot be used: the caller treats the device as unpaired (MP-4).
 */
export async function readDeviceCredential(): Promise<SecureStoreRead<StoredDeviceCredential>> {
  const key = SECURE_ITEM_KEYS.deviceCredential;
  const read = await rawRead(key, optionsFor(false));
  if (!read.ok) return record(read, 'readDeviceCredential', key);
  if (read.value === null) return { ok: true, value: null };
  const stored = parseStored(PairingRedeemedSchema, read.value);
  return stored === null ? record(refusal('CORRUPT_ITEM'), 'readDeviceCredential', key) : { ok: true, value: stored };
}

/** Stores the answer of the redeem operation. A value of another shape is refused and nothing is written. */
export async function writeDeviceCredential(value: StoredDeviceCredential): Promise<SecureStoreOutcome> {
  const key = SECURE_ITEM_KEYS.deviceCredential;
  const parsed = PairingRedeemedSchema.safeParse(value);
  if (!parsed.success) return record(refusal('INVALID_VALUE'), 'writeDeviceCredential', key);
  const written = await rawWrite(key, JSON.stringify(parsed.data), optionsFor(false));
  return written.ok ? written : record(written, 'writeDeviceCredential', key);
}

/**
 * Deletes the device credential and, with it, both biometric items (MB-2). All three deletes are
 * tried; the first failure is returned.
 */
export async function deleteDeviceCredential(): Promise<SecureStoreOutcome> {
  const key = SECURE_ITEM_KEYS.deviceCredential;
  const biometric = await deleteBiometric();
  const deleted = await rawDelete(key);
  if (!deleted.ok) record(deleted, 'deleteDeviceCredential', key);
  return biometric.ok ? deleted : biometric;
}

// ----------------------------------------------------------------------------------------------
// Biometric token (`dems.live.bio.v1`) and its marker (`dems.live.bio.meta.v1`).
// ----------------------------------------------------------------------------------------------

/**
 * MB-6a (2), AC-C-105: may the biometric token be stored without an authentication requirement?
 * Only where the app does not run on a physical device, or in a debug build. `__DEV__` is read at
 * call time; a release bundle holds the constant `false` in its place.
 */
export function isUnprotectedBiometricItemAllowed(): boolean {
  return Device.isDevice === false || __DEV__ === true;
}

/** The marker, or `null` when biometric sign-in is not set up. Shows no prompt. */
export async function readBiometricMarker(): Promise<SecureStoreRead<BiometricMarker>> {
  const key = SECURE_ITEM_KEYS.biometricMarker;
  const read = await rawRead(key, optionsFor(false));
  if (!read.ok) return record(read, 'readBiometricMarker', key);
  if (read.value === null) return { ok: true, value: null };
  const marker = parseStored(BiometricMarkerSchema, read.value);
  return marker === null ? record(refusal('CORRUPT_ITEM'), 'readBiometricMarker', key) : { ok: true, value: marker };
}

/**
 * The biometric token, read with the options it was written with (the marker's `protected`). With a
 * protected item the OS shows its prompt, titled `prompt`. `null` when no token is stored.
 * A failure deletes nothing: a cancelled prompt must leave the enrolment as it is (MB-4).
 */
export async function readBiometricToken(prompt?: string): Promise<SecureStoreRead<string>> {
  const key = SECURE_ITEM_KEYS.biometricToken;
  const marker = await readBiometricMarker();
  if (!marker.ok) return marker;
  if (marker.value === null) return { ok: true, value: null };
  const read = await rawRead(key, optionsFor(marker.value.protected, prompt));
  if (!read.ok) return record(read, 'readBiometricToken', key);
  if (read.value === null) return { ok: true, value: null };
  return BIOMETRIC_TOKEN_PATTERN.test(read.value) ? read : record(refusal('CORRUPT_ITEM'), 'readBiometricToken', key);
}

/** Deletes the token and the marker: biometric sign-in is off. Both deletes are tried. */
export async function deleteBiometric(): Promise<SecureStoreOutcome> {
  const token = await rawDelete(SECURE_ITEM_KEYS.biometricToken);
  if (!token.ok) record(token, 'deleteBiometric', SECURE_ITEM_KEYS.biometricToken);
  const marker = await rawDelete(SECURE_ITEM_KEYS.biometricMarker);
  if (!marker.ok) record(marker, 'deleteBiometric', SECURE_ITEM_KEYS.biometricMarker);
  return token.ok ? marker : token;
}

/** A failed biometric write leaves no token behind (MB-6): both items go, the failure is returned. */
async function biometricOff(failure: SecureStoreFailure): Promise<SecureStoreFailure> {
  await deleteBiometric();
  return failure;
}

async function storeTokenAndMarker(token: string, owner: BiometricOwner, protectedItem: boolean, prompt?: string): Promise<SecureStoreOutcome> {
  const written = await rawWrite(SECURE_ITEM_KEYS.biometricToken, token, optionsFor(protectedItem, prompt));
  if (!written.ok) return written;
  const marker: BiometricMarker = { ...owner, protected: protectedItem };
  return rawWrite(SECURE_ITEM_KEYS.biometricMarker, JSON.stringify(marker), optionsFor(false));
}

/**
 * Stores a new biometric token and its marker (enrolment, MB-1). `mode` says how (MB-5); the result
 * says how the token is stored now. On any failure both biometric items are deleted and nothing of
 * the token is kept.
 */
export async function writeBiometricToken(
  token: string,
  owner: BiometricOwner,
  mode: BiometricWriteMode,
  prompt?: string,
): Promise<BiometricWriteResult> {
  const key = SECURE_ITEM_KEYS.biometricToken;
  const parsedOwner = BiometricOwnerSchema.safeParse(owner);
  if (!BIOMETRIC_TOKEN_PATTERN.test(token) || !parsedOwner.success) {
    return biometricOff(record(refusal('INVALID_VALUE'), 'writeBiometricToken', key));
  }

  let protectedFailure: SecureStoreFailure | null = null;
  if (mode !== 'unprotected') {
    const stored = await storeTokenAndMarker(token, parsedOwner.data, true, prompt);
    if (stored.ok) return { ok: true, protected: true };
    protectedFailure = record(stored, 'writeBiometricToken', key);
    // No fallback when the caller did not ask for one, or when the operator declined the OS check.
    if (mode === 'protected' || stored.reason === 'USER_CANCELED') return biometricOff(stored);
  }

  if (!isUnprotectedBiometricItemAllowed()) {
    // MB-6a: never an unprotected token on a physical device outside a debug build.
    const refused = record(refusal('UNPROTECTED_NOT_ALLOWED'), 'writeBiometricToken', key);
    return biometricOff(protectedFailure ?? refused);
  }
  const stored = await storeTokenAndMarker(token, parsedOwner.data, false);
  if (!stored.ok) return biometricOff(record(stored, 'writeBiometricToken', key));
  if (protectedFailure !== null) {
    reportRuntimeIssue('warn', `${SOURCE}.biometricFallback`, 'Biometric token stored without an authentication requirement (MB-5 case c)', {
      item: key,
      code: protectedFailure.code,
      reason: protectedFailure.reason,
      nativeCode: protectedFailure.nativeCode,
      isDevice: Device.isDevice,
      debugBuild: __DEV__ === true,
    });
  }
  return { ok: true, protected: false };
}

/**
 * The write after a rotation (MB-6): the new token replaces the old one, with the same options (the
 * marker's `protected`); the marker stays. If the write fails, both items are deleted: the session
 * stays, biometric sign-in is off until the operator enrols again.
 */
export async function rotateBiometricToken(token: string, prompt?: string): Promise<BiometricWriteResult> {
  const key = SECURE_ITEM_KEYS.biometricToken;
  if (!BIOMETRIC_TOKEN_PATTERN.test(token)) return biometricOff(record(refusal('INVALID_VALUE'), 'rotateBiometricToken', key));
  const marker = await readBiometricMarker();
  if (!marker.ok) return biometricOff(marker);
  if (marker.value === null) return biometricOff(record(refusal('BIOMETRIC_NOT_STORED'), 'rotateBiometricToken', key));
  if (!marker.value.protected && !isUnprotectedBiometricItemAllowed()) {
    return biometricOff(record(refusal('UNPROTECTED_NOT_ALLOWED'), 'rotateBiometricToken', key));
  }
  const written = await rawWrite(key, token, optionsFor(marker.value.protected, prompt));
  return written.ok ? { ok: true, protected: marker.value.protected } : biometricOff(record(written, 'rotateBiometricToken', key));
}

// ----------------------------------------------------------------------------------------------
// Debug builds only: the device probe of `./dev-probes.ts` (early proof g).
// ----------------------------------------------------------------------------------------------

/**
 * What the secure-store probe needs beyond the three items: one fixed, non-secret probe item,
 * written with or without the authentication requirement, and the library's own capability check.
 * It reports nothing to the runtime log: the probe prints its own result lines.
 */
export interface SecureStoreDevProbe {
  /** The probe item's name (02_plan §3.4). It never holds a credential. */
  readonly itemKey: string;
  /** `SecureStore.canUseBiometricAuthentication()`, or `null` when the library does not offer it or it throws. */
  canUseBiometricAuthentication(): boolean | null;
  write(value: string, protectedItem: boolean): Promise<SecureStoreOutcome>;
  read(protectedItem: boolean): Promise<SecureStoreRead<string>>;
  remove(): Promise<SecureStoreOutcome>;
}

/**
 * `null` in a release build: the whole object, with the probe item's name, is under a literal
 * `__DEV__` test, which Metro folds away.
 */
export const secureStoreDevProbe: SecureStoreDevProbe | null = __DEV__
  ? {
      itemKey: 'dems.live.probe.v1',
      canUseBiometricAuthentication: () => {
        try {
          return typeof SecureStore.canUseBiometricAuthentication === 'function' ? SecureStore.canUseBiometricAuthentication() === true : null;
        } catch {
          // The probe prints `null` for "could not be asked"; nothing else is known here.
          return null;
        }
      },
      write: (value, protectedItem) => rawWrite('dems.live.probe.v1', value, optionsFor(protectedItem, 'DEMS secure-store probe')),
      read: (protectedItem) => rawRead('dems.live.probe.v1', optionsFor(protectedItem, 'DEMS secure-store probe')),
      remove: () => rawDelete('dems.live.probe.v1'),
    }
  : null;
