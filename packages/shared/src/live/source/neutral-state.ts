/**
 * The state a Live client holds while it holds no Core data (HB-14; backend task
 * 04_client_integration_spec §2.3, "Where each of the 33 slices comes from", column "When signed
 * out").
 *
 * A signed-out client, and a client whose session ended, holds no Core data: the server sends an
 * anonymous connection `hello` and `heartbeat` and nothing else (01_specs §9.2). The store still
 * needs a value of `SimState` shape, because the selectors and the screens read it. This file
 * builds that value: empty lists, no session, an empty device identity, the simulator's defaults
 * where a member is a closed value set. Nothing in it comes from the demo dataset.
 *
 * It also builds the five slices the server never sends as a slice (01_specs §3.2):
 *
 * | Slice | Built from |
 * |-------|-----------|
 * | `clock` | The Live clock (`./clock`) |
 * | `auth` | The caller's own session (`AuthSessionInfo`) and the control messages |
 * | `authLockout` | `SignInStatus`, so that the shared `lockoutStatus()` answers what the server said |
 * | `pairing` | `PairingRedeemed`, `DeviceRegistration`; the web console keeps the neutral value |
 * | `audio` | The `meters` frames; a flat "no signal" frame while there is none |
 *
 * Pure and framework-free. It imports constants and types of the simulator, and none of its code.
 */
import type { AuthSessionInfo, SignInStatus } from '../../api/identity';
import type { CoreIdentity } from '../../api/pairing';
import {
  AUDIO_FLOOR_DBFS,
  AUTH_IDLE_TIMEOUT_MS,
  AUTH_MAX_FAILURES,
  GENESIS_HASH,
  PAIRING_MAX_FAILURES,
  SIM_TZ,
  SIM_TZ_OFFSET_MINUTES,
} from '../../sim/constants';
import type { AudioFrame, AudioSlice, AuthLockoutSlice, AuthSlice, ClockSlice, EpochMs, PairingSlice, SimState } from '../../sim/types';
import { AuthStatus, PairingState } from '../../sim/vocabulary';

/** One flat −90 dBFS frame: what a meter shows while no frame arrives, so it never freezes on a stale level. */
export function noSignalFrame(at: EpochMs): AudioFrame {
  return { seq: 0, at, dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, clip: false, noSignal: true };
}

/** The `audio` slice with both channels on "no signal". */
export function silentAudio(at: EpochMs): AudioSlice {
  return { channels: { 'AUDIO-01': noSignalFrame(at), 'AUDIO-02': noSignalFrame(at) } };
}

/** True when both channels already show "no signal": resetting them again would only change references. */
export function isSilentAudio(audio: AudioSlice): boolean {
  return audio.channels['AUDIO-01'].noSignal && audio.channels['AUDIO-02'].noSignal;
}

export function clockSliceAt(now: EpochMs): ClockSlice {
  return { now, tz: SIM_TZ, tzOffsetMinutes: SIM_TZ_OFFSET_MINUTES };
}

/** The `auth` slice of a client that is not signed in: SIGNED_OUT, or EXPIRED after an expiry. */
export function signedOutAuthSlice(status: typeof AuthStatus.SIGNED_OUT | typeof AuthStatus.EXPIRED = AuthStatus.SIGNED_OUT): AuthSlice {
  return { status, operatorId: null, method: null, issuedAt: null, lastActivityAt: null };
}

/** The `auth` slice of a signed-in client, from the caller's own session (01_specs §7.18). */
export function authSliceOf(session: AuthSessionInfo): AuthSlice {
  return {
    status: AuthStatus.SIGNED_IN,
    operatorId: session.operator.id,
    method: session.method,
    issuedAt: session.issuedAt,
    lastActivityAt: session.lastActivityAt,
  };
}

/**
 * `lastActivityAt` as the server holds it after a touch: its idle expiry minus the idle time-out (ID-P4).
 *
 * F66-5 (local adapter): `AuthSessionExpiry` (operation 6) carries no `lastActivityAt`, so it is
 * derived here. It holds while the server's idle time-out is the shared constant
 * `AUTH_IDLE_TIMEOUT_MS`; if the contract ever returns the member, read it and delete this function.
 */
export function lastActivityOf(idleExpiresAt: EpochMs): EpochMs {
  return idleExpiresAt - AUTH_IDLE_TIMEOUT_MS;
}

/**
 * The `authLockout` slice that makes the shared `lockoutStatus(slice, now)` answer the server's
 * `locked`, `lockedUntil` and `attemptsRemaining` (§2.3; AC-C-39): `lockedUntil` is copied, and
 * `failures` holds one entry, stamped `at`, for every attempt that is used up.
 */
export function lockoutSliceOf(status: Pick<SignInStatus, 'lockedUntil' | 'attemptsRemaining'>, at: EpochMs): AuthLockoutSlice {
  const used = Math.min(AUTH_MAX_FAILURES, Math.max(0, AUTH_MAX_FAILURES - Math.floor(status.attemptsRemaining)));
  return { failures: Array.from({ length: used }, () => at), lockedUntil: status.lockedUntil };
}

/** The attempts left that a slice built by `lockoutSliceOf` stands for: its inverse, for an answer that names none. */
export function attemptsRemainingOf(slice: AuthLockoutSlice): number {
  return Math.max(0, AUTH_MAX_FAILURES - slice.failures.length);
}

export const NEUTRAL_LOCKOUT: AuthLockoutSlice = { failures: [], lockedUntil: null };

/** The `pairing` slice of a client that is not paired, and of the web console, which no screen reads in Live mode. */
export function neutralPairing(): PairingSlice {
  return {
    state: PairingState.UNPAIRED,
    coreDeviceId: '',
    coreName: '',
    certificateFingerprint: '',
    pairedAt: null,
    failures: [],
    lockedUntil: null,
  };
}

/** The `pairing` slice of a paired device, from the Core identity the server returned (MP-6, MP-10). */
export function pairedSlice(core: CoreIdentity, pairedAt: EpochMs): PairingSlice {
  return {
    state: PairingState.PAIRED,
    coreDeviceId: core.deviceId,
    coreName: core.name,
    certificateFingerprint: core.certificateFingerprint,
    pairedAt,
    failures: [],
    lockedUntil: null,
  };
}

/** The `pairing` slice after a refused redeem: FAILED, with the server's counters in the simulator's form. */
export function failedPairing(
  current: PairingSlice,
  at: EpochMs,
  refusal: { attemptsRemaining: number | null; lockedUntil: EpochMs | null },
): PairingSlice {
  const used =
    refusal.attemptsRemaining === null
      ? current.failures.length
      : Math.min(PAIRING_MAX_FAILURES, Math.max(0, PAIRING_MAX_FAILURES - Math.floor(refusal.attemptsRemaining)));
  return {
    ...current,
    state: PairingState.FAILED,
    pairedAt: null,
    failures: refusal.lockedUntil === null ? Array.from({ length: used }, () => at) : [],
    lockedUntil: refusal.lockedUntil,
  };
}

/**
 * A `SimState` with no Core data in it. The 28 replicated slices are empty or hold the neutral
 * member of their value set; the five client-built slices are signed out, unlocked, unpaired,
 * silent, and at `now`.
 */
export function createNeutralState(now: EpochMs): SimState {
  return {
    meta: {
      schemaVersion: 1,
      seed: 0,
      scenario: 'idle',
      epoch: 0,
      createdAt: now,
      counters: { event: 1, session: 1, caseNumber: 1, evidence: 1, item: 1 },
    },
    clock: clockSliceAt(now),
    device: {
      id: '',
      name: '',
      room: '',
      productName: '',
      softwareVersion: '',
      identity: {
        serialNumber: '',
        hardwareUuid: '',
        chassisRevision: '',
        somPartRevision: '',
        audioBoardRevision: '',
        poeBoardRevision: '',
        powerBoardRevision: '',
        bspVersion: '',
        coreSoftwareVersion: '',
        tabletAppVersion: '',
        tpmModelFirmware: '',
        cameraModelFirmware: '',
        provisioningRecordId: '',
        deviceCertificateId: '',
      },
    },
    operators: [],
    auth: signedOutAuthSlice(),
    authLockout: NEUTRAL_LOCKOUT,
    pairing: neutralPairing(),
    tabletLink: { state: 'OFFLINE', changedAt: now },
    session: null,
    lastSealedSessionId: null,
    lastSealedAcknowledged: true,
    sessionHistory: [],
    activeCameraId: 'VIDEO-01',
    cameras: [],
    mics: [],
    audio: silentAudio(now),
    storage: {
      state: 'READY',
      volumes: [],
      writeBytesPerSec: 0,
      bitrateMbps: 0,
      history: [],
      lastWriteVerifiedAt: null,
      simulatedFillBytes: 0,
      writeRateHistory: [],
    },
    storagePolicy: { retentionPolicy: 'DAYS_90', retentionDays: 90, autoArchive: true },
    time: {
      source: 'RTC',
      locked: false,
      stratum: 0,
      offsetMs: 0,
      lastSyncAt: now,
      gnss: { locked: false, satellites: 0 },
      ntp: { server: '', reachable: false, stratum: 0 },
      rtc: { driftPpm: 0 },
      history: [],
    },
    network: {
      ip: '',
      lanName: '',
      gateway: '',
      linkUp: false,
      linkSpeedMbps: 0,
      poe: { activePorts: 0, totalPorts: 0, budgetW: 0, drawW: 0, poweredPorts: 0, sparePorts: 0 },
      bandwidth: { downMbps: 0, upMbps: 0, history: [] },
      domains: [],
    },
    security: {
      state: 'READY',
      posture: 'UNKNOWN',
      tpm: { model: '', ok: false },
      secureBoot: false,
      encryption: 'AES-256-GCM',
      hashAlgorithm: 'SHA-256',
      tamper: false,
      controls: [],
      keys: [],
    },
    services: [],
    health: { cpuPercent: 0, cpuTempC: 0, storageTempC: 0, ambientTempC: 0, fanRpm: 0, fanOk: true, series: [], micLevels: [] },
    otherDevices: [],
    ports: [],
    evidence: [],
    events: [],
    alerts: [],
    audit: { rows: [], head: GENESIS_HASH, total: 0, dropped: 0 },
    faults: { active: [] },
    diagnostics: null,
    update: { currentVersion: '', availableVersion: null, activeSlot: 'A', state: 'IDLE', steps: [], startedAt: null, completedAt: null },
    settings: { presentationMode: false, timeFormat: '24', notifyWarnings: true, notifySound: false },
  };
}
