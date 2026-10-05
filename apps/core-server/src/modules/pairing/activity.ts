/**
 * The audit rows and events of the pairing module (plan row W32; spec §6.2, §6.3, §13.1, §13.2;
 * SR-28, SR-30, SR-54; ENG-8, ENG-12).
 *
 * Eight audit types. Four are the shared simulator's (`packages/shared/src/sim/pairing.ts`) and
 * keep its events and detail keys, so the Live trail reads like the Simulated one; four are the
 * server's own, whose detail keys are the closed list of the audit writer (`core/audit-details.ts`):
 *
 *   audit                       event           when
 *   PAIRING_CODE_ISSUED         -               a code was issued (T1)
 *   PAIRING_CODE_CLOSED         -               a code was cancelled, expired or exhausted (T3 to T5)
 *   PAIRING_SUCCESS             PAIRED          a redeem that created a device (T2, T6)
 *   PAIRING_FAILED              PAIRING_FAILED  a redeem that was compared and refused, or found no usable code
 *   PAIRING_LOCKED              -               a redeem while redeeming is locked (not compared)
 *   DEVICE_REVOKED              UNPAIRED        an operator revoked a device (T8)
 *   UNPAIRED                    UNPAIRED        a device ended its own pairing (T9)
 *   DEVICE_CREDENTIAL_ROTATED   -               a device asked for its next credential (T7)
 *
 * WHAT A ROW NEVER HOLDS (SR-28, SR-54): a pairing code, a QR payload, a device credential or a
 * hash. A code is named by its ID (`PCD-NNNNNN`), a device by its registry ID (`DEV-NNNN`). The
 * functions below do not even take a secret, and none takes a text that a redeeming caller sent.
 * The one free text is the reason an operator typed for a revoke.
 *
 * The rows go through the unit's writers, which add the sequence, the hash and the time of the
 * server clock; nothing here can set a time (SR-65).
 */
import type { AuditEntry, EventEntry, PAIRING_CODE_CLOSE_REASONS, UnitContext } from '../../core';
import { PAIRING_CODE_MAX_FAILED_REDEEMS } from './limits';
import type { CoreIdentityRow } from './store';

/** One audit row and the event that goes with it, if any. */
export interface Activity {
  readonly audit: AuditEntry;
  readonly event: EventEntry | null;
}

/** Appends both parts in the caller's unit of work. */
export async function appendActivity(unit: UnitContext, activity: Activity): Promise<void> {
  await unit.audit.append(activity.audit);
  if (activity.event !== null) await unit.events.append(activity.event);
}

export type CodeCloseReason = (typeof PAIRING_CODE_CLOSE_REASONS)[number];

export function codeIssued(input: { readonly operatorId: string; readonly codeId: string; readonly expiresAt: number }): Activity {
  return {
    audit: {
      type: 'PAIRING_CODE_ISSUED',
      message: `Pairing code ${input.codeId} issued`,
      actorId: input.operatorId,
      deviceId: null,
      details: { codeId: input.codeId, expiresAt: input.expiresAt },
    },
    event: null,
  };
}

const CLOSE_MESSAGE: Readonly<Record<CodeCloseReason, (codeId: string) => string>> = {
  CANCELLED: (codeId) => `Pairing code ${codeId} cancelled`,
  EXPIRED: (codeId) => `Pairing code ${codeId} expired`,
  EXHAUSTED: (codeId) => `Pairing code ${codeId} closed after ${PAIRING_CODE_MAX_FAILED_REDEEMS} failed attempts`,
};

/** `operatorId` is the cancelling operator; null for an expiry or an exhaustion (the system). */
export function codeClosed(input: { readonly codeId: string; readonly reason: CodeCloseReason; readonly operatorId: string | null }): Activity {
  return {
    audit: {
      type: 'PAIRING_CODE_CLOSED',
      message: CLOSE_MESSAGE[input.reason](input.codeId),
      ...(input.reason === 'EXHAUSTED' ? { severity: 'WARNING' as const } : {}),
      actorId: input.operatorId,
      deviceId: null,
      details: { codeId: input.codeId, reason: input.reason },
    },
    event: null,
  };
}

export interface Paired {
  /** The operator of the caller's session, if the redeem came with one; else null (the device). */
  readonly operatorId: string | null;
  /** The new device. */
  readonly deviceId: string;
  readonly codeId: string;
  readonly core: CoreIdentityRow;
}

export function paired(input: Paired): Activity {
  return {
    audit: {
      type: 'PAIRING_SUCCESS',
      message: `Device ${input.deviceId} paired with ${input.core.deviceId}`,
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: { coreDeviceId: input.core.deviceId, certificateFingerprint: input.core.certificateFingerprint, codeId: input.codeId },
    },
    event: {
      type: 'PAIRED',
      message: `Device paired · ${input.core.name}`,
      severity: 'SUCCESS',
      deviceId: input.deviceId,
    },
  };
}

export interface RedeemFailed {
  readonly operatorId: string | null;
  /** The paired device the caller already is, if any; null for a caller without a credential. */
  readonly deviceId: string | null;
  /** Failures left before redeeming locks. Never the attempts left of a code: the row says nothing about one. */
  readonly attemptsRemaining: number;
  /** Set when this failure locked redeeming. */
  readonly lockedUntil: number | null;
}

export function redeemFailed(input: RedeemFailed): Activity {
  const locks = input.lockedUntil !== null;
  return {
    audit: {
      type: 'PAIRING_FAILED',
      message: locks ? 'Pairing failed; locked for 60 s' : 'Pairing failed: invalid code',
      severity: 'WARNING',
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: { attemptsRemaining: input.attemptsRemaining, lockedUntil: input.lockedUntil },
    },
    event: {
      type: 'PAIRING_FAILED',
      message: locks ? 'Pairing failed — locked for 60 s' : 'Pairing failed',
      severity: 'WARNING',
      params: { attemptsRemaining: input.attemptsRemaining },
      deviceId: input.deviceId,
    },
  };
}

export interface RedeemLocked {
  readonly operatorId: string | null;
  readonly deviceId: string | null;
  readonly lockedUntil: number;
  readonly retryInMs: number;
}

export function redeemLocked(input: RedeemLocked): Activity {
  return {
    audit: {
      type: 'PAIRING_LOCKED',
      message: 'Pairing rejected: locked after repeated failures',
      severity: 'WARNING',
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: { retryInMs: input.retryInMs, lockedUntil: input.lockedUntil },
    },
    event: null,
  };
}

export interface DeviceRevoked {
  readonly operatorId: string;
  readonly deviceId: string;
  /** What the operator typed, 5 to 500 characters. */
  readonly reason: string;
  readonly sessionsEnded: number;
}

export function deviceRevoked(input: DeviceRevoked): Activity {
  return {
    audit: {
      type: 'DEVICE_REVOKED',
      message: `Device ${input.deviceId} revoked`,
      severity: 'WARNING',
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: { reason: input.reason, sessionsEnded: input.sessionsEnded },
    },
    event: { type: 'UNPAIRED', message: 'Device revoked', severity: 'WARNING', deviceId: input.deviceId },
  };
}

export interface DeviceUnpaired {
  /** The operator signed in on the device, if any (spec §6.3 T9). */
  readonly operatorId: string | null;
  readonly deviceId: string;
  readonly sessionsEnded: number;
}

export function deviceUnpaired(input: DeviceUnpaired): Activity {
  return {
    audit: {
      type: 'UNPAIRED',
      message: `Device ${input.deviceId} unpaired`,
      actorId: input.operatorId,
      deviceId: input.deviceId,
      details: { sessionsEnded: input.sessionsEnded },
    },
    event: { type: 'UNPAIRED', message: 'Device unpaired', severity: 'WARNING', deviceId: input.deviceId },
  };
}

/**
 * Spec §13.1: the actor is none, the row carries the device. No client of this release calls
 * the operation, so the row is written at WARNING: outside the server's own tests it deserves a
 * look (spec §6.3).
 */
export function credentialRotated(input: { readonly deviceId: string }): Activity {
  return {
    audit: {
      type: 'DEVICE_CREDENTIAL_ROTATED',
      message: `Device ${input.deviceId} asked for a new credential`,
      severity: 'WARNING',
      actorId: null,
      deviceId: input.deviceId,
      details: {},
    },
    event: null,
  };
}
