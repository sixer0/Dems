/**
 * Tablet pairing (SCR-02; 04_mobile_specs.md §4.2, §6.5; book §20.1 "certificate-bound
 * pairing … preferred").
 *
 * Policy (demo, mirroring the auth lockout):
 * - The 6-digit demo code is `DEMO_PAIRING_CODE`. The code never reaches state, events or
 *   audit rows.
 * - 3 failures within 5 min → locked for 60 s. Every attempt writes one audit row:
 *   PAIRING_SUCCESS, PAIRING_FAILED (the third one carries `lockedUntil`) or PAIRING_LOCKED.
 * - `pair()` while PAIRED is a no-op success; `unpair()` while not paired is a no-op.
 */
import { AUTH_FAILURE_WINDOW_MS, PAIRING_CODE_LENGTH, PAIRING_LOCKOUT_MS, PAIRING_MAX_FAILURES } from './constants';
import { DEMO_PAIRING_CODE } from './dataset';
import { recordActivity } from './events';
import { signedInOperatorId } from './session-machine';
import type { EpochMs, PairResult, SimState } from './types';
import { PairingState } from './vocabulary';

export function pairTransition(state: SimState, now: EpochMs, code: string): { state: SimState; result: PairResult } {
  const pairing = state.pairing;
  if (pairing.state === PairingState.PAIRED) {
    return { state, result: { ok: true, pairedAt: pairing.pairedAt ?? now } };
  }
  const actorId = signedInOperatorId(state);
  if (pairing.lockedUntil !== null && now < pairing.lockedUntil) {
    const retryInMs = pairing.lockedUntil - now;
    return {
      result: { ok: false, reason: 'LOCKED', lockedUntil: pairing.lockedUntil, retryInMs },
      state: {
        ...state,
        ...recordActivity(state, now, {
          audit: {
            type: 'PAIRING_LOCKED',
            message: 'Pairing rejected: locked after repeated failures',
            severity: 'WARNING',
            actorId,
            deviceId: 'TABLET',
            details: { retryInMs, lockedUntil: pairing.lockedUntil },
          },
        }),
      },
    };
  }
  // An expired lockout starts a fresh count.
  const failures =
    pairing.lockedUntil !== null ? [] : pairing.failures.filter((at) => now - at < AUTH_FAILURE_WINDOW_MS);
  const valid =
    typeof code === 'string' &&
    code.length === PAIRING_CODE_LENGTH &&
    /^\d+$/.test(code) &&
    code === DEMO_PAIRING_CODE;

  if (valid) {
    const next: SimState = {
      ...state,
      pairing: { ...pairing, state: PairingState.PAIRED, pairedAt: now, failures: [], lockedUntil: null },
    };
    return {
      result: { ok: true, pairedAt: now },
      state: {
        ...next,
        ...recordActivity(next, now, {
          audit: {
            type: 'PAIRING_SUCCESS',
            message: `Tablet paired with ${pairing.coreDeviceId} (simulated)`,
            actorId,
            deviceId: 'TABLET',
            details: { coreDeviceId: pairing.coreDeviceId, certificateFingerprint: pairing.certificateFingerprint },
          },
          event: {
            type: 'PAIRED',
            message: `Tablet paired · ${pairing.coreName}`,
            severity: 'SUCCESS',
            deviceId: 'TABLET',
          },
        }),
      },
    };
  }

  const allFailures = [...failures, now];
  const locks = allFailures.length >= PAIRING_MAX_FAILURES;
  const lockedUntil = locks ? now + PAIRING_LOCKOUT_MS : null;
  const attemptsRemaining = Math.max(0, PAIRING_MAX_FAILURES - allFailures.length);
  const next: SimState = {
    ...state,
    pairing: {
      ...pairing,
      state: PairingState.FAILED,
      failures: locks ? [] : allFailures,
      lockedUntil,
    },
  };
  return {
    result:
      locks && lockedUntil !== null
        ? { ok: false, reason: 'LOCKED', lockedUntil, retryInMs: PAIRING_LOCKOUT_MS }
        : { ok: false, reason: 'INVALID_CODE', attemptsRemaining },
    state: {
      ...next,
      ...recordActivity(next, now, {
        audit: {
          type: 'PAIRING_FAILED',
          message: locks ? 'Pairing failed; locked for 60 s' : 'Pairing failed: invalid code',
          severity: 'WARNING',
          actorId,
          deviceId: 'TABLET',
          details: { attemptsRemaining, lockedUntil },
        },
        event: {
          type: 'PAIRING_FAILED',
          message: locks ? 'Pairing failed — locked for 60 s' : 'Pairing failed',
          severity: 'WARNING',
          deviceId: 'TABLET',
          params: { attemptsRemaining },
        },
      }),
    },
  };
}

export function unpairTransition(state: SimState, now: EpochMs): SimState {
  if (state.pairing.state !== PairingState.PAIRED) return state;
  const next: SimState = {
    ...state,
    pairing: { ...state.pairing, state: PairingState.UNPAIRED, pairedAt: null, failures: [], lockedUntil: null },
  };
  return {
    ...next,
    ...recordActivity(next, now, {
      audit: {
        type: 'UNPAIRED',
        message: `Tablet unpaired from ${state.pairing.coreDeviceId}`,
        actorId: signedInOperatorId(state),
        deviceId: 'TABLET',
      },
      event: { type: 'UNPAIRED', message: 'Tablet unpaired', severity: 'WARNING', deviceId: 'TABLET' },
    }),
  };
}
