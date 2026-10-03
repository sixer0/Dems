/**
 * Session Monitor view models (01_specs §14.5.2; research/04 §3.2 K–T).
 *
 * Pure reads over `SimState`. Every selector returns primitives or a flat object of primitives,
 * so `useSim` (zustand `useShallow`) re-renders a panel only when one of its own fields changes,
 * never on the 10 Hz clock or the 20 Hz audio slice (03_motion_spec §9.3; D70 page rule).
 */
import { SessionState, type BootRecoveryState } from '@dems/shared/domain'
import {
  Permission,
  selectCan,
  selectWorstAlert,
  storageSummary,
  type FaultKind,
  type SimState,
} from '@dems/shared/sim'

// ── Session phase ────────────────────────────────────────────────────────────────────────
export type SessionPhase =
  | 'IDLE'
  | 'SETUP'
  | 'RECORDING'
  | 'FINALIZING'
  | 'SEALED'
  | 'FAULT'
  | 'RECOVERY'

export function phaseOf(state: SessionState | null): SessionPhase {
  switch (state) {
    case null:
      return 'IDLE'
    case SessionState.CREATE:
    case SessionState.PRECHECK:
    case SessionState.ARMED:
      return 'SETUP'
    case SessionState.RECORDING:
      return 'RECORDING'
    case SessionState.STOPPING:
    case SessionState.FINALIZING:
      return 'FINALIZING'
    case SessionState.SEALED:
      return 'SEALED'
    case SessionState.FAULT:
      return 'FAULT'
    case SessionState.RECOVERY:
      return 'RECOVERY'
    default:
      return 'IDLE'
  }
}

/** The fields the page shell needs; changes only on a session transition. */
export interface PageModel {
  state: SessionState | null
  phase: SessionPhase
  sessionId: string | null
  evidenceId: string | null
  canStart: boolean
  canNote: boolean
}

export function selectPageModel(s: SimState): PageModel {
  const state = s.session?.state ?? null
  return {
    state,
    phase: phaseOf(state),
    sessionId: s.session?.id ?? null,
    evidenceId: s.session?.evidenceId ?? null,
    canStart: selectCan(s, Permission.SESSION_START),
    canNote: selectCan(s, Permission.SESSION_NOTE),
  }
}

// ── K: status banner ─────────────────────────────────────────────────────────────────────
export type BannerKind =
  | 'ACTIVE'
  | 'ATTENTION'
  | 'FAULT'
  | 'NO_SESSION'
  | 'FINALIZING'
  | 'SETUP'
  | 'SEALED'
  | 'RECOVERY'

export type BannerTone = 'success' | 'warning' | 'danger' | 'default' | 'accent' | 'sealed'

export const BANNER_TONE: Record<BannerKind, BannerTone> = {
  ACTIVE: 'success',
  ATTENTION: 'warning',
  FAULT: 'danger',
  NO_SESSION: 'default',
  FINALIZING: 'accent',
  SETUP: 'accent',
  SEALED: 'sealed',
  RECOVERY: 'warning',
}

/** Escalation rank for R8 (one pulse on a rise only). */
export const BANNER_RANK: Record<BannerKind, number> = {
  NO_SESSION: 0,
  SEALED: 0,
  SETUP: 0,
  ACTIVE: 0,
  FINALIZING: 0,
  ATTENTION: 1,
  RECOVERY: 1,
  FAULT: 2,
}

export interface BannerModel {
  kind: BannerKind
  /** While recording: an alert that escalated the banner (CRITICAL keeps REC; `recordingContinues`). */
  whileRecording: boolean
  /** `common.faultKind.<kind>` when known; else `reasonText`. */
  reasonKind: FaultKind | null
  reasonText: string | null
  sessionState: SessionState | null
  /** FINALIZING: 1-based active step and the total. */
  current: number
  total: number
  stopping: boolean
  evidenceId: string | null
  recoveryStage: BootRecoveryState | null
}

export function selectBanner(s: SimState): BannerModel {
  const session = s.session
  const state = session?.state ?? null
  const phase = phaseOf(state)
  const base: BannerModel = {
    kind: 'NO_SESSION',
    whileRecording: false,
    reasonKind: null,
    reasonText: null,
    sessionState: state,
    current: 0,
    total: 0,
    stopping: false,
    evidenceId: session?.evidenceId ?? null,
    recoveryStage: null,
  }
  switch (phase) {
    case 'IDLE':
      return base
    case 'SETUP':
      return { ...base, kind: 'SETUP' }
    case 'SEALED':
      return { ...base, kind: 'SEALED' }
    case 'FINALIZING': {
      const steps = session?.finalization.steps ?? []
      const done = steps.filter((step) => step.status === 'done').length
      const active = steps.findIndex((step) => step.status === 'active')
      return {
        ...base,
        kind: 'FINALIZING',
        stopping: state === SessionState.STOPPING,
        current: active >= 0 ? active + 1 : Math.min(steps.length, done + 1),
        total: steps.length,
      }
    }
    case 'FAULT':
      return { ...base, kind: 'FAULT', reasonKind: session?.fault?.kind ?? null }
    case 'RECOVERY':
      return { ...base, kind: 'RECOVERY', recoveryStage: session?.recovery?.stage ?? null }
    case 'RECORDING': {
      const worst = selectWorstAlert(s)
      if (!worst) return { ...base, kind: 'ACTIVE' }
      const reasonKind = worst.kind === 'SYSTEM' ? null : worst.kind
      if (worst.severity === 'CRITICAL') {
        return { ...base, kind: 'FAULT', whileRecording: true, reasonKind, reasonText: worst.message }
      }
      if (worst.severity === 'WARNING') {
        return { ...base, kind: 'ATTENTION', whileRecording: true, reasonKind, reasonText: worst.message }
      }
      return { ...base, kind: 'ACTIVE' }
    }
  }
}

// ── M: session details ───────────────────────────────────────────────────────────────────
export interface DetailsModel {
  sessionId: string | null
  caseNumber: string | null
  investigatorId: string | null
  investigatorName: string | null
  subjectType: string | null
  subjectName: string | null
  room: string | null
  profileId: string | null
  startedAt: number | null
  stoppedAt: number | null
  evidenceId: string | null
  state: SessionState | null
}

export function selectDetails(s: SimState): DetailsModel {
  const session = s.session
  const investigatorId = session?.input.investigatorId ?? null
  const operator = investigatorId ? s.operators.find((op) => op.id === investigatorId) : undefined
  return {
    sessionId: session?.id ?? null,
    caseNumber: session?.input.caseNumber ?? null,
    investigatorId,
    investigatorName: operator?.displayName ?? investigatorId,
    subjectType: session?.input.subjectType ?? null,
    subjectName: session?.input.subjectName ?? null,
    room: session?.input.room ?? null,
    profileId: session?.input.profileId ?? null,
    startedAt: session?.startedAt ?? null,
    stoppedAt: session?.stoppedAt ?? null,
    evidenceId: session?.evidenceId ?? null,
    state: session?.state ?? null,
  }
}

// ── N: evidence integrity ────────────────────────────────────────────────────────────────
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'idle'

export interface IntegrityModel {
  encryption: CheckStatus
  hashChain: CheckStatus
  timestamp: CheckStatus
  storageWrite: CheckStatus
  timeSource: string
  recording: boolean
  chainHead: string
  /** Rows ever appended; a change means a new audit row (the verification sweep, M-PG-SM). */
  auditTotal: number
}

export function selectIntegrity(s: SimState): IntegrityModel {
  const recording = s.session?.state === SessionState.RECORDING
  const chainBroken = s.faults.active.some((fault) => fault.kind === 'AUDIT_TAMPER')
  const storageState = s.storage.state
  return {
    encryption: s.security.state === 'FAULT' || !s.security.tpm.ok ? 'fail' : 'pass',
    hashChain: chainBroken ? 'fail' : 'pass',
    timestamp: s.time.source === 'RTC' || !s.time.locked ? 'warn' : 'pass',
    storageWrite:
      storageState === 'FULL' ? 'fail' : storageState === 'LOW' ? 'warn' : recording ? 'pass' : 'idle',
    timeSource: s.time.source,
    recording,
    chainHead: s.audit.head,
    auditTotal: s.audit.total,
  }
}

// ── O and R: devices ─────────────────────────────────────────────────────────────────────
export interface CameraTileModel {
  id: 'VIDEO-01' | 'VIDEO-02'
  name: string
  room: string
  ready: boolean
  online: boolean
  resolution: string
  fps: number
  codec: string
}

/**
 * Pure mapping over the store's `cameras` array. Use it as `useMemo(() => cameraTiles(cameras))`
 * after `useSim((s) => s.cameras)`: a selector that returns fresh objects makes `useShallow`
 * loop (review 40 M1/R1).
 */
export function cameraTiles(cameras: SimState['cameras']): CameraTileModel[] {
  return cameras.map((camera) => ({
    id: camera.id,
    name: camera.name,
    room: camera.room,
    ready: camera.online && camera.lens === 'READY',
    online: camera.online,
    resolution: camera.resolution,
    fps: camera.fps,
    codec: camera.codec,
  }))
}

export interface MicTileModel {
  id: 'AUDIO-01' | 'AUDIO-02'
  /** The simulator's track name, "MIC 1 – Interviewer", the same label as the step-92/93 demo tracks (D50). */
  name: string
  state: 'READY' | 'NO_SIGNAL' | 'CLIP'
  clipLatched: boolean
}

/** Pure mapping over the store's `mics` array (see `cameraTiles` for why it is not a selector). */
export function micTiles(mics: SimState['mics']): MicTileModel[] {
  return mics.map((mic) => ({ id: mic.id, name: mic.name, state: mic.state, clipLatched: mic.clipLatched }))
}

/** Dot tone of a microphone (research/04 §3.2 O: READY, NO SIGNAL, CLIP). */
export function micTone(mic: MicTileModel): 'success' | 'warning' | 'danger' | 'muted' {
  if (mic.state === 'NO_SIGNAL') return 'muted'
  if (mic.state === 'CLIP' || mic.clipLatched) return 'danger'
  return 'success'
}

/** L: the active camera and its feed state (flat primitives). */
export interface FeedModel {
  activeCameraId: 'VIDEO-01' | 'VIDEO-02'
  cameraName: string
  room: string
  noSignal: boolean
  resolution: string
  fps: number
  codec: string
  startedAt: number | null
  recording: boolean
  snapshotCount: number
}

export function selectFeed(s: SimState): FeedModel {
  const camera = s.cameras.find((c) => c.id === s.activeCameraId) ?? s.cameras[0]
  const recording = s.session?.state === SessionState.RECORDING
  return {
    activeCameraId: s.activeCameraId,
    cameraName: camera?.name ?? s.activeCameraId,
    room: camera?.room ?? '',
    noSignal: camera ? !camera.online || camera.lens === 'FAULT' : true,
    resolution: camera?.resolution ?? '1080p',
    fps: camera?.fps ?? 25,
    codec: camera?.codec ?? 'H.264',
    startedAt: s.session?.startedAt ?? null,
    recording,
    snapshotCount: s.session?.snapshotCount ?? 0,
  }
}

// ── S: storage during session ────────────────────────────────────────────────────────────
/**
 * Display values, not raw bytes: the bytes grow every simulator second while recording, but the
 * shown text ("3.2 TB", "2.6 GB", "389h 26m") changes far less often, so the panel re-renders only
 * when something visible changes (§9.3).
 */
export interface StorageModel {
  usedPercent: number
  freeValue: string
  freeUnit: ByteUnit
  totalValue: string
  totalUnit: ByteUnit
  remainingHours: number
  remainingMinutes: number
  writeMbps: string
  /** null before anything was written in this session. */
  sessionValue: string | null
  sessionUnit: ByteUnit
  state: 'READY' | 'LOW' | 'FULL'
}

export function selectStorage(s: SimState): StorageModel {
  const summary = storageSummary(s)
  const free = formatBytesParts(summary.freeBytes)
  const total = formatBytesParts(summary.totalBytes)
  const sessionBytes = s.session?.bytesWritten ?? 0
  const session = formatBytesParts(sessionBytes)
  const remaining = hoursMinutes(summary.estimatedRemainingMs)
  return {
    usedPercent: summary.usedPercent,
    freeValue: free.value,
    freeUnit: free.unit,
    totalValue: total.value,
    totalUnit: total.unit,
    remainingHours: remaining.hours,
    remainingMinutes: remaining.minutes,
    writeMbps: (s.storage.writeBytesPerSec / 1e6).toFixed(1),
    sessionValue: sessionBytes > 0 ? session.value : null,
    sessionUnit: session.unit,
    state: summary.state,
  }
}

/** Tone for the storage ring (Q1 thresholds are the simulator's). */
export function storageTone(state: StorageModel['state']): 'accent' | 'warning' | 'danger' {
  return state === 'FULL' ? 'danger' : state === 'LOW' ? 'warning' : 'accent'
}

// ── Formatting helpers (decimal units, D28/Q1: 4.0 TB = 4,000 GB) ────────────────────────
export type ByteUnit = 'tb' | 'gb' | 'mb'

export function formatBytesParts(bytes: number): { value: string; unit: ByteUnit } {
  if (bytes >= 1e12) return { value: (bytes / 1e12).toFixed(1), unit: 'tb' }
  if (bytes >= 1e9) return { value: (bytes / 1e9).toFixed(1), unit: 'gb' }
  return { value: (bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1), unit: 'mb' }
}

export function hoursMinutes(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

/** First `length` hex characters of a hash, for compact display. */
export function shortHash(hash: string, length = 8): string {
  return hash.replace(/^sha256:/i, '').slice(0, length)
}
