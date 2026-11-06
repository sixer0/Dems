/**
 * The biometric token storage of LIVE mode (backend task W56; 04_client_integration_spec §9.1,
 * §9.3 MB-1 to MB-8; 01_specs §5.6; implementation/41 section 8; finding F72).
 *
 * In LIVE mode the Core never takes "the fingerprint matched" as a sign-in. It takes a single-use
 * token: issued once at enrolment (operation 7), sent with operation 8, replaced by the next one
 * in the same answer. This module is where that token lives on the tablet: the two secure-store
 * items `dems.live.bio.v1` (the token) and `dems.live.bio.meta.v1` (the marker: whose it is, on
 * which device, and how it is stored), through the one wrapper (`@/runtime/secure-credentials`).
 * It never logs, returns to a screen or keeps a token: a value passes through `token()` into the
 * Live source's request and through `sessionIssued()` into the store, and nothing here holds it.
 *
 * **Loaded by a debug build only** (MD-6): `./live-auth-provider.tsx` requires it behind a literal
 * `__DEV__` test, as the runtime requires the wrapper, so neither is part of a release bundle.
 *
 * **One token, one presentation (finding F72).** A used token that is presented again is a reuse:
 * the Core revokes the family and ends the session it had just issued. So:
 * - a token leaves the store only inside an attempt the auth layer opened (`begin`), once per
 *   attempt, and while one attempt is open no second one can be opened (a double tap is one);
 * - the next token is written inside `sessionIssued`, which the Live source awaits BEFORE the
 *   sign-in action settles (MB-6): with the same options as the old one; if that write fails, both
 *   items are deleted and the session stays;
 * - when the attempt ends and the token was not replaced, `end('spent')` deletes both items. The
 *   caller passes `kept` only for the answers that say the Core did not look at the token
 *   (`biometricTokenFate`); a lost answer is `spent`: the token is never sent a second time.
 *
 * | How the token is stored (MB-5, MB-6a; decision D71 DN37-2) | Where |
 * |---|---|
 * | `unprotected`: without the authentication requirement; the existing OS prompt is the gate | Where MB-6a allows it: not a physical device, or a debug build. That is every build that can run LIVE mode today |
 * | `protected`: with it; a failing write stores nothing and biometric sign-in stays off | Anywhere else (a physical device in a build that is not a debug build) |
 */
import * as Device from 'expo-device';
import { reportRuntimeIssue, type LiveBiometricPort } from '@/runtime';
import {
  deleteBiometric,
  isUnprotectedBiometricItemAllowed,
  readBiometricMarker,
  readBiometricToken,
  rotateBiometricToken,
  writeBiometricToken,
  type BiometricMarker,
  type BiometricOwner,
  type BiometricWriteMode,
  type BiometricWriteResult,
  type SecureStoreFailure,
} from '@/runtime/secure-credentials';
import type { BiometricPromptOutcome } from './biometric';
import { biometricPromptPlan, type BiometricPromptPlan, type BiometricTokenFate } from './live-auth-model';

const SOURCE = 'auth.biometric.store';

/**
 * How a new token is written (MB-5, MB-6a). Decision D71 DN37-2: `unprotected` wherever MB-6a
 * allows it (on the three emulators a protected write is refused without an enrolled fingerprint,
 * and with one Android asks at every protected write: a second prompt per sign-in). Where it is
 * not allowed the write is `protected`, and a failing one turns biometric sign-in off (AC-C-105).
 * The decision is revisited after the re-probe with a device lock: this function is its one place.
 */
export function biometricWriteMode(): BiometricWriteMode {
  return isUnprotectedBiometricItemAllowed() ? 'unprotected' : 'protected';
}

/** What `token()` did for an attempt. */
export type BiometricRelease =
  /** The token was handed to the Live source: it counts as presented from here on. */
  | { readonly kind: 'released' }
  /** No enrolment of this operator on this pairing: nothing to hand out. */
  | { readonly kind: 'absent' }
  /** The OS check of a protected read did not pass (MB-5 case a): the item is as it was. */
  | { readonly kind: 'check'; readonly outcome: Exclude<BiometricPromptOutcome, 'success' | 'error'> }
  /** The item can never be read again; both items were deleted (MB-6a: no silent fallback). */
  | { readonly kind: 'unreadable' };

/** What became of the stored token when the attempt ended. */
export type BiometricTokenEnd =
  /** No token left the store. */
  | 'untouched'
  /** The next token is stored (or its write is still running). */
  | 'rotated'
  /** The token that was sent is still the one for the next time. */
  | 'kept'
  /** Both items are deleted: biometric sign-in is off until the operator enrols again. */
  | 'deleted';

export interface BiometricAttempt {
  /**
   * Closes the attempt. `fate` is what the sign-in action's answer means for the token that was
   * sent; it is ignored when no token left the store, and when the next one was already written.
   */
  end(fate: BiometricTokenFate): Promise<{ readonly release: BiometricRelease | null; readonly token: BiometricTokenEnd }>;
}

export interface LiveBiometricStoreOptions {
  /** The Core's ID of this device while it is paired (`mobile.getPairing().deviceId`), else `null`. */
  deviceId(): string | null;
}

export interface LiveBiometricStore {
  /** What the runtime registers with the Live source's secrets port (`setBiometricPort`). */
  readonly port: LiveBiometricPort;
  /**
   * The marker of this pairing, read without a prompt; `null` when biometric sign-in is not set up
   * here. A marker of an earlier pairing, and one that cannot be parsed, is deleted with its token.
   */
  marker(): Promise<BiometricMarker | null>;
  /** MB-5: which check the operator sees for a token stored like `marker`'s. */
  promptPlan(marker: Pick<BiometricMarker, 'protected'>): BiometricPromptPlan;
  /** MB-1: stores the token of an enrolment and its marker. On a failure nothing is kept. */
  enrol(token: string, owner: BiometricOwner, promptTitle: string): Promise<BiometricWriteResult>;
  /** MB-2, §6.5: deletes the token and the marker. True when both are gone. */
  remove(): Promise<boolean>;
  /**
   * Opens the one attempt in which `port.token()` may hand a token out. `null` while another
   * attempt is open: the caller must not send a second sign-in.
   */
  begin(promptTitle: string): BiometricAttempt | null;
}

interface OpenAttempt {
  readonly promptTitle: string;
  /** `token()` ran: it runs once per attempt. */
  asked: boolean;
  release: BiometricRelease | null;
  /** A token left the store. */
  out: boolean;
  /** The next token arrived and its write was started. */
  rotated: boolean;
  /** The write of the next token failed: the wrapper deleted both items. */
  rotationFailed: boolean;
}

/** What a failed read of the token means (MB-4, MB-5, MB-6a). The failure holds codes only. */
function releaseOfFailure(failure: SecureStoreFailure): BiometricRelease {
  if (failure.code !== 'AUTHENTICATION') return { kind: 'unreadable' };
  switch (failure.reason) {
    case 'USER_CANCELED':
    // The prompt could not be shown now: nothing was checked, the operator stays where they are.
    case 'IN_PROGRESS':
    case 'NOT_IN_FOREGROUND':
      return { kind: 'check', outcome: 'cancel' };
    case 'LOCKOUT':
      return { kind: 'check', outcome: 'lockout' };
    case 'NO_BIOMETRICS_ENROLLED':
      return { kind: 'check', outcome: 'not-enrolled' };
    case 'NO_BIOMETRIC_HARDWARE':
      return { kind: 'check', outcome: 'unavailable' };
    // The key of the item was invalidated (the device's biometrics changed): it is gone for good.
    case 'KEY_INVALIDATED':
      return { kind: 'unreadable' };
    default:
      return { kind: 'check', outcome: 'failed' };
  }
}

export function createLiveBiometricStore(options: LiveBiometricStoreOptions): LiveBiometricStore {
  let current: OpenAttempt | null = null;

  const marker = async (): Promise<BiometricMarker | null> => {
    const deviceId = options.deviceId();
    // Not paired, or not known yet: no biometric sign-in, and the storage is not asked. The runtime
    // reads the device credential first (MP-10) and deletes these items with it (MB-2).
    if (deviceId === null) return null;
    const read = await readBiometricMarker();
    if (!read.ok) {
      // The wrapper logged it by code. A marker that cannot be parsed never will be: both items go.
      if (read.code === 'CORRUPT_ITEM') await deleteBiometric();
      return null;
    }
    if (read.value === null) return null;
    if (read.value.deviceId !== deviceId) {
      // An enrolment of an earlier pairing of this tablet: the Core revoked its token with that device.
      reportRuntimeIssue('warn', `${SOURCE}.marker`, 'A biometric enrolment of an earlier pairing was deleted', {
        storedFor: read.value.deviceId,
        deviceId,
      });
      await deleteBiometric();
      return null;
    }
    return read.value;
  };

  const port: LiveBiometricPort = {
    token: async (operatorId) => {
      const open = current;
      // Not asked by the auth layer, or asked a second time in one attempt: nothing is handed out.
      if (open === null || open.asked) return null;
      open.asked = true;
      const stored = await marker();
      if (stored === null || stored.operatorId !== operatorId) {
        open.release = { kind: 'absent' };
        return null;
      }
      // With a protected item this read is the OS prompt (MB-5 case a); else it shows nothing.
      const read = await readBiometricToken(open.promptTitle);
      if (!read.ok) {
        open.release = releaseOfFailure(read);
        // MB-6a: an item that cannot be read turns biometric sign-in off; nothing falls back silently.
        if (open.release.kind === 'unreadable') await deleteBiometric();
        return null;
      }
      if (read.value === null) {
        // A marker without its token: the enrolment is void.
        await deleteBiometric();
        open.release = { kind: 'unreadable' };
        return null;
      }
      open.out = true;
      open.release = { kind: 'released' };
      return read.value;
    },
    sessionIssued: async (issued) => {
      const open = current;
      // A password sign-in, or a sign-in this store handed no token to: nothing of it changes.
      if (open === null || !open.out) return;
      // The token that was sent is used up. Without a next one, `end` deletes it.
      if (issued.biometricToken === null) return;
      open.rotated = true;
      // MB-6: the same options as the old one (the marker's); on a failure the wrapper deletes both.
      const written = await rotateBiometricToken(issued.biometricToken, open.promptTitle);
      if (!written.ok) {
        open.rotationFailed = true;
        // `errorCode`: the log drops a member named `code`.
        reportRuntimeIssue('warn', `${SOURCE}.rotation`, 'The next biometric token was not stored; biometric sign-in is off, the session stays', {
          errorCode: written.code,
          reason: written.reason,
          nativeCode: written.nativeCode,
        });
      }
    },
  };

  return {
    port,
    marker,
    promptPlan: (stored) => biometricPromptPlan(stored.protected, Device.isDevice === true),
    enrol: (token, owner, promptTitle) => writeBiometricToken(token, owner, biometricWriteMode(), promptTitle),
    remove: async () => (await deleteBiometric()).ok,
    begin(promptTitle) {
      if (current !== null) return null;
      const open: OpenAttempt = { promptTitle, asked: false, release: null, out: false, rotated: false, rotationFailed: false };
      current = open;
      return {
        async end(fate) {
          if (current === open) current = null;
          if (!open.out) return { release: open.release, token: 'untouched' };
          if (open.rotated) return { release: open.release, token: open.rotationFailed ? 'deleted' : 'rotated' };
          if (fate === 'kept') return { release: open.release, token: 'kept' };
          // Used up, refused for good, or not known: it is never sent again.
          await deleteBiometric();
          return { release: open.release, token: 'deleted' };
        },
      };
    },
  };
}
