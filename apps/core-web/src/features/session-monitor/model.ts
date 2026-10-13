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
  recordingEndOf,
  selectCan,
  alertBlocksRecording,
  selectWorstAlert,
  storageSummary,
  type FaultKind,
  type SimState,
} from '@dems/shared/sim'
import { camerasNotConnectedOf, captureFailedStartOf, captureNoticeOf, type CaptureFailedStart } from '@/lib/capture-notices'
import { isSelfCaptureCore } from '@/lib/own-capture'

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

/**
 * Whether the capture of `session` has its first durable fragment (decisions D84, D91 ruling R-1
 * option A; ux §8 step 5, erratum PE-128-79). The stored state stays `RECORDING` from the accepted
 * start; the session payload member `captureDurable` is `false` until the first durable fragment,
 * and until then the console reads "Connecting cameras…", never "Recording".
 *
 * The member is not in the shared session schema yet (request filed by blueprint row 72), so this
 * ONE helper reads it defensively: only an explicit `false` means "not durable yet". A session
 * without the member (the simulator, a Core before rows 66/71) reads as durable, as before.
 */
export function captureDurableOf(session: unknown): boolean {
  if (typeof session !== 'object' || session === null) return true
  return (session as { captureDurable?: unknown }).captureDurable !== false
}

/** RECORDING and durable: the only state the console presents as "recording". */
export const selectRecordingDurable = (s: SimState): boolean =>
  s.session?.state === SessionState.RECORDING && captureDurableOf(s.session)

/** RECORDING, before the first durable fragment: "Connecting cameras…". */
export const selectConnectingCameras = (s: SimState): boolean =>
  s.session?.state === SessionState.RECORDING && !captureDurableOf(s.session)

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
  /** RECORDING before the first durable fragment (D84): "Connecting cameras…", never "Recording". */
  | 'CONNECTING'
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
  CONNECTING: 'accent',
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
  CONNECTING: 0,
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
  /** The open session of the banner (wave H driver B: the surface reads its interrupted fact by this id). */
  sessionId: string | null
  recoveryStage: BootRecoveryState | null
  /**
   * Row 139 (ux §8e.2 situation C): FAULT of a session that recorded NOTHING (`captureDurable: false`).
   * The banner then says "Nothing was recorded." and offers no recovery of evidence.
   */
  failedStart: CaptureFailedStart | null
  /** D158: the Core is closing that failed start (the store passes through RECOVERY): the same words, no control. */
  failedStartClosing: boolean
  /** Wave M (G75e-05): FAULT of an interrupted recording the Core is sealing by itself - no "Start recovery" is offered. */
  coreSealing: boolean
}

/**
 * Fix wave M (G75e-05; the rule the mobile driver built for G75d-08, note 155): THE CORE IS SEALING THE
 * INTERRUPTED PREFIX BY ITSELF - known from the session payload alone.
 *
 * | Member of the session | What it says |
 * |---|---|
 * | `state: 'FAULT'`, `fault.fromState: 'RECORDING'`, `startedAt` set | a recording was interrupted |
 * | `captureDurable: true` | the Core ran its own capture for this session and holds durable media of it (`false`: a failed start, nothing was recorded) |
 *
 * A Core in its own capture hands every interrupted recording with durable media to its seal: the
 * session goes FAULT -> FINALIZING -> SEALED without an operator. For the 0.1 - 0.3 s the payload still
 * says FAULT, "Start recovery" (which closes a session as incomplete and never seals it) would be a
 * false offer. False for every other session: the simulator's fault, a failed start, a fault before
 * the recording started.
 */
export function coreSealsInterruptedPrefix(session: { readonly state?: string | null; readonly startedAt?: number | null; readonly fault?: { readonly fromState?: string | null } | null; readonly captureDurable?: unknown } | null | undefined): boolean {
  if (session === null || session === undefined) return false
  return session.state === SessionState.FAULT && session.fault?.fromState === SessionState.RECORDING && session.startedAt !== null && session.startedAt !== undefined && session.captureDurable === true
}

/** The rule above on a Core in its own capture (`isSelfCaptureCore`): the simulator's session may carry the member too. */
export const selectCoreSealsInterrupted = (s: SimState): boolean => isSelfCaptureCore(s) && coreSealsInterruptedPrefix(s.session)

/**
 * Row 139 (ux §8e.2 "C, degraded"): the alert the banner escalated on, when it is a no-device notice.
 * The stored alert object itself (stable between store updates); the banner words it with
 * `captureNoticeLine`, naming the device by label and id, instead of the alert's own text.
 */
export function selectBannerNoticeAlert(s: SimState) {
  if (!selectRecordingDurable(s)) return null
  const worst = selectWorstAlert(s)
  return worst !== null && captureNoticeOf(worst) !== null ? worst : null
}

/**
 * Wave H driver B (gate 75, G75-07 (a)): the degraded-start warning that the banner does NOT say because
 * a more severe alert took it - the stored alert object (stable between store updates), or null. The
 * banner draws it in a line of its own, so a camera a session records without is always named there.
 */
export function selectCoveredDegradedNotice(s: SimState) {
  if (!selectRecordingDurable(s)) return null
  const degraded = s.alerts.find((alert) => alert.active && alert.kind === 'SYSTEM' && alert.params?.['reason'] === 'CAPTURE_DEVICE_UNREACHABLE' && alert.params['phase'] === 'SESSION_START')
  if (degraded === undefined || captureNoticeOf(degraded) === null) return null
  return selectWorstAlert(s) === degraded ? null : degraded
}

/** Row 139: the failed start of the open session, or `null` (flat, for a selector). */
export const selectFailedStart = (s: SimState): CaptureFailedStart | null => captureFailedStartOf(s.session, s.alerts)

/**
 * Integration pass D7 follow-up (decision D158; ux §8e.2 situation C, OP-125-5): a failed start the Core
 * is CLOSING. "Close session" is the Core's recovery of a session that recorded nothing, so the store
 * passes through RECOVERY with `captureDurable` still `false` — only a failed start can be there (a
 * recording that was interrupted is durable). The console presents no recovery for it: the failed-start
 * words stay until the session has left the store. The cause is read as for the FAULT.
 */
export const selectFailedStartClosing = (s: SimState): CaptureFailedStart | null =>
  s.session?.state === SessionState.RECOVERY && !captureDurableOf(s.session)
    ? captureFailedStartOf({ state: SessionState.FAULT, captureDurable: false }, s.alerts)
    : null

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
    sessionId: session?.id ?? null,
    recoveryStage: null,
    failedStart: null,
    failedStartClosing: false,
    coreSealing: false,
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
      return { ...base, kind: 'FAULT', reasonKind: session?.fault?.kind ?? null, failedStart: selectFailedStart(s), coreSealing: selectCoreSealsInterrupted(s) }
    case 'RECOVERY': {
      // D158: the close of a failed start is no recovery of evidence — the fault banner keeps its words.
      const closing = selectFailedStartClosing(s)
      if (closing !== null) return { ...base, kind: 'FAULT', reasonKind: session?.fault?.kind ?? null, failedStart: closing, failedStartClosing: true }
      return { ...base, kind: 'RECOVERY', recoveryStage: session?.recovery?.stage ?? null }
    }
    case 'RECORDING': {
      // D84: nothing claims to record before the first durable fragment, an alert's
      // "Recording continues" included.
      if (!captureDurableOf(session)) return { ...base, kind: 'CONNECTING' }
      // Fix wave L (G75d-01; `contract_wave_l.md` section 1): the worst ACTIVE alert of the whole Core is not a fault of
      // the session that records. The unsealable notice of session X was drawn as "FAULT / Recording continues" over a
      // healthy session Y. An alert is a condition of the open session only when it does not say otherwise.
      const worst = worstAlertOfSession(s, session?.id ?? null)
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
    // Wave H driver B (G75-08): where the recording ended - the stop, or the fault that ended it. Never a clock that runs on.
    stoppedAt: recordingEndOf(session),
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
  // Integration pass D7 item 4 (row 139's leftover; D84): "recording" is the durable recording only. While the
  // cameras connect nothing is written, so "Storage Write Verified" reads Standby, not Continuous.
  const recording = selectRecordingDurable(s)
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
  /** Null (row V6, S-01): no stream statement is stored for the track; the tile then reads "Not stated". */
  resolution: string | null
  /** Null: the stream states no rate; the tile then shows no format line. */
  fps: number | null
  /** Null (row V6, S-01): no stream statement is stored for the track. */
  codec: string | null
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
  /**
   * Row 54 (P12-F08): the three facts as the camera slice states them. `resolution` and `codec` are null when
   * the slice carries no camera for the active track (nothing is stated then); `fps` is also null for a stream
   * that states no rate.
   */
  resolution: string | null
  fps: number | null
  codec: SimState['cameras'][number]['codec'] | null
  startedAt: number | null
  recording: boolean
  snapshotCount: number
  /** Row 139 (D84): RECORDING before the first durable fragment. Nothing is presented as live or recording. */
  connecting: boolean
  /** Row 139: the open session recorded nothing (situation C), or `null`. */
  failedStart: CaptureFailedStart | null
}

/** Row 139: whether the camera behind a video track is named by an active session-start notice. */
function trackNotConnected(s: SimState, trackId: string): boolean {
  const missing = camerasNotConnectedOf(s.alerts)
  if (missing.length === 0) return false
  const deviceId = s.captureConfig.cameras.find((camera) => camera.trackId === trackId)?.deviceId
  return deviceId !== undefined && missing.includes(deviceId)
}

export function selectFeed(s: SimState): FeedModel {
  // Task 4 row W4 (review 060c R-05): the camera OF THE ACTIVE TRACK, or none. Until row W4 a track the slice does not
  // carry fell back to the first camera, whose name, room, signal state and facts then stood under the other track.
  const camera = s.cameras.find((c) => c.id === s.activeCameraId)
  // D84: the REC indicator and the timer start with the first durable fragment.
  const recording = selectRecordingDurable(s)
  return {
    activeCameraId: s.activeCameraId,
    cameraName: camera?.name ?? s.activeCameraId,
    room: camera?.room ?? '',
    // Row 139 ("C, degraded"): the camera the Core says did not connect at this session start reads NO SIGNAL.
    noSignal: (camera ? !camera.online || camera.lens === 'FAULT' : true) || trackNotConnected(s, s.activeCameraId),
    resolution: camera?.resolution ?? null,
    fps: camera?.fps ?? null,
    codec: camera?.codec ?? null,
    startedAt: s.session?.startedAt ?? null,
    recording,
    snapshotCount: s.session?.snapshotCount ?? 0,
    connecting: selectConnectingCameras(s),
    // D158: held while the Core closes the failed start.
    failedStart: selectFailedStart(s) ?? selectFailedStartClosing(s),
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

/**
 * Fix wave L (G75d-01): THE WORST ALERT THAT IS A CONDITION OF THE OPEN SESSION. The exact test of
 * `contract_wave_l.md` section 1, before an alert is drawn as a state of a session:
 *   `alertBlocksRecording(alert) === false`  -> never (it is the open notice of another recording);
 *   the alert names a session (`params.sessionId` is a string) -> only when it is the open session.
 * Every other active alert is read as before (`selectWorstAlert`'s order: the first of the highest severity).
 */
export function worstAlertOfSession(s: SimState, sessionId: string | null): SimState['alerts'][number] | null {
  const rank = { CRITICAL: 2, WARNING: 1 } as Record<string, number>
  let worst: SimState['alerts'][number] | null = null
  for (const alert of s.alerts) {
    if (!alert.active) continue
    if (alertBlocksRecording(alert) === false) continue
    const named = alert.params?.['sessionId']
    if (typeof named === 'string' && named !== sessionId) continue
    if (worst === null || (rank[alert.severity] ?? 0) > (rank[worst.severity] ?? 0)) worst = alert
  }
  return worst
}
