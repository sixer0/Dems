/**
 * Pure model of the Start New Session flow (01_specs §14.5.11; design book §5.3 gate; 13_sim_engine
 * §2.2–§2.3). No React: the page and the tests share these rules.
 *
 * - **Steps.** Which step the URL may show follows the simulator session: no session in setup →
 *   step 1 only; CREATE or PRECHECK → up to step 2; ARMED → up to step 3. Any other live state
 *   (RECORDING, STOPPING, FINALIZING, FAULT, RECOVERY) belongs to the Session Monitor (R4 n5).
 * - **Gate.** The simulator resolves the 8 checks (300–700 ms each, ≤ 4.9 s) and owns the policy
 *   (BLOCK: Core offline, lens fault, storage full, security fault; WARN: MIC no signal or clip,
 *   storage low, time on RTC, enclosure tamper). The page only reads the outcome: PASS arms the
 *   session by itself, WARN needs the acknowledgement checkbox, BLOCK disables Next.
 */
import { SessionState } from '@dems/shared/domain'
import { SESSION_CREATE_MESSAGES } from '@dems/shared/api'
import { cameraLinesInForce, isPrecheckNote, SECURITY_NOT_REPORTED_PRECHECK_RULE, SubjectType, type PrecheckCheckId, type PrecheckItem, type PrecheckSlice } from '@dems/shared/sim'
import type { StatusTone } from '@dems/shared/tokens'
import { PRECHECK_UNREACHABLE_VALUE } from '@/lib/capture-notices'

export type FlowStep = 1 | 2 | 3
export const FLOW_STEPS: readonly FlowStep[] = [1, 2, 3]

/** UI beat while "Creating session…" shows on Next (04 §5.7 "Creating the session shows a Spinner"). */
export const CREATE_BEAT_MS = 300
/** 3-2-1: one digit per second (M-PG-NEW), then Start. */
export const COUNTDOWN_FROM = 3
export const COUNTDOWN_STEP_MS = 1000

/** Session states the wizard owns (the cancellable setup states). */
const SETUP_STATES: readonly SessionState[] = [SessionState.CREATE, SessionState.PRECHECK, SessionState.ARMED]

export function isSetupState(state: SessionState | null): boolean {
  return state !== null && SETUP_STATES.includes(state)
}

/** A live session the wizard must not touch: the Session Monitor owns it (R4 n5). */
export function isLiveElsewhere(state: SessionState | null): boolean {
  return state !== null && state !== SessionState.SEALED && !isSetupState(state)
}

/** The furthest step the current session allows. */
export function maxStepFor(state: SessionState | null): FlowStep {
  if (state === SessionState.ARMED) return 3
  if (state === SessionState.CREATE || state === SessionState.PRECHECK) return 2
  return 1
}

/** The step to show for a requested `?step=` (never past what the session allows). */
export function effectiveStep(requested: FlowStep, state: SessionState | null): FlowStep {
  return Math.min(requested, maxStepFor(state)) as FlowStep
}

// ── Gate view (step 2) ───────────────────────────────────────────────────────────────────

export type GatePhase = 'idle' | 'running' | 'pass' | 'warn' | 'block'

export interface GateView {
  phase: GatePhase
  done: number
  total: number
  warnings: number
  blocks: number
  /** WARN outcome still waiting for the acknowledgement (the checkbox is shown). */
  needsAck: boolean
  /** Next may be pressed (PASS, WARN with the box ticked, or already ARMED). */
  canProceed: boolean
  /** "Re-run checks" may be pressed (a resolved BLOCK or WARN run, still in PRECHECK). */
  canRetry: boolean
}

const RESOLVED = new Set<PrecheckItem['status']>(['PASS', 'WARN', 'BLOCK'])

/**
 * The gate as the page shows it. `acknowledged` is the page's checkbox; once the session is ARMED
 * (PASS, or warnings already acknowledged) Next is always allowed.
 */
export function gateView(precheck: Pick<PrecheckSlice, 'items' | 'outcome' | 'warningsAcknowledged'> | null, state: SessionState | null, acknowledged: boolean): GateView {
  const items = precheck?.items ?? []
  const done = items.filter((item) => RESOLVED.has(item.status)).length
  // Wave H closing pass Z2 (Z1's line of 10:30:00Z): a NOTE (the host-clock TIME item of a Core in its own
  // capture) is at WARN level and is no warning to count or acknowledge.
  const warnings = items.filter((item) => item.status === 'WARN' && !isPrecheckNote(item)).length
  const blocks = items.filter((item) => item.status === 'BLOCK').length
  const armed = state === SessionState.ARMED
  const outcome = precheck?.outcome ?? null
  let phase: GatePhase
  if (!precheck || state === SessionState.CREATE || (outcome === null && precheck.items.every((item) => item.status === 'PENDING'))) phase = 'idle'
  else if (outcome === null) phase = 'running'
  else if (outcome === 'BLOCK') phase = 'block'
  else if (outcome === 'WARN') phase = 'warn'
  else phase = 'pass'
  if (armed && phase === 'idle') phase = 'pass'
  const needsAck = phase === 'warn' && !armed && !(precheck?.warningsAcknowledged ?? false)
  const canProceed = armed || phase === 'pass' || (phase === 'warn' && (acknowledged || !needsAck))
  const canRetry = state === SessionState.PRECHECK && (phase === 'block' || phase === 'warn')
  return { phase, done, total: items.length, warnings, blocks, needsAck, canProceed, canRetry }
}

// ── Reasons (the sim's `reasonCode`, step 54; the id/status/value mapping covers older items) ──

export type ReasonKey =
  | 'coreOffline'
  | 'lensFault'
  | 'micNoSignal'
  | 'micClip'
  | 'storageFull'
  | 'storageLow'
  | 'timeRtc'
  | 'securityFault'
  | 'securityTamper'

/** The i18n reason of each simulator reason code (step 54, W46-2). */
export const REASON_KEY_BY_CODE: Record<NonNullable<PrecheckItem['reasonCode']>, ReasonKey> = {
  CORE_OFFLINE: 'coreOffline',
  LENS_FAULT: 'lensFault',
  MIC_NO_SIGNAL: 'micNoSignal',
  MIC_CLIP: 'micClip',
  STORAGE_FULL: 'storageFull',
  STORAGE_LOW: 'storageLow',
  TIME_RTC: 'timeRtc',
  SECURITY_FAULT: 'securityFault',
  ENCLOSURE_TAMPER: 'securityTamper',
}

/**
 * The i18n reason for a resolved WARN or BLOCK check: from its `reasonCode` (step 54), else (an
 * item from before step 54) from its id, status and value.
 */
export function reasonKeyFor(item: Pick<PrecheckItem, 'id' | 'status' | 'value'> & Partial<Pick<PrecheckItem, 'reasonCode' | 'params'>>): ReasonKey | null {
  if (item.status !== 'WARN' && item.status !== 'BLOCK') return null
  // Wave H closing pass Z2: a NOTE has no reason of this table - without this branch the host-clock TIME
  // item (no reason code) fell through to the id switch below and read as the RTC FALLBACK. The step
  // words it from `params.rule` (`precheckNoteKey`).
  if (isPrecheckNote({ status: item.status, params: item.params ?? {} })) return null
  // Task 3 R-10 (blueprint row 137; decision D114): a source that did not answer the pre-check is
  // not a lens fault and not "no signal". It has no reason of this table: the step draws it from
  // `params.rule` (`unreachablePrecheckOf`, `lib/capture-notices.ts`).
  if (item.value === PRECHECK_UNREACHABLE_VALUE && !item.reasonCode) return null
  if (item.reasonCode) return REASON_KEY_BY_CODE[item.reasonCode]
  switch (item.id) {
    case 'CORE':
      return 'coreOffline'
    case 'LENS_1':
    case 'LENS_2':
      return 'lensFault'
    case 'MIC_1':
    case 'MIC_2':
    case 'MIC_PRIMARY':
    case 'MIC_STANDBY':
      return item.value === 'CLIP' ? 'micClip' : 'micNoSignal'
    case 'STORAGE':
      return item.status === 'BLOCK' ? 'storageFull' : 'storageLow'
    case 'TIME':
      return 'timeRtc'
    case 'SECURITY':
      return item.status === 'BLOCK' ? 'securityFault' : 'securityTamper'
    default:
      return null
  }
}

/**
 * The sentence of a pre-check NOTE (`isPrecheckNote`), or null for an item that is none. Two exist:
 * the TIME item of a Core in its own capture - the host system clock - and (fix wave J, JW-04;
 * `contract_wave_j.md` J-S 5) its SECURITY item: a Core that states `platformNotReported` checked no
 * TPM, Secure Boot or enclosure state, so the row is "Not reported", never "READY - PASS".
 */
export type PrecheckNoteKey = 'sessionNew.precheckNote.timeHostClock' | 'web.waveJ.precheck.securityNotReported'

export function precheckNoteKey(item: Pick<PrecheckItem, 'status' | 'params'>): PrecheckNoteKey | null {
  if (!isPrecheckNote(item)) return null
  return item.params?.['rule'] === SECURITY_NOT_REPORTED_PRECHECK_RULE ? 'web.waveJ.precheck.securityNotReported' : 'sessionNew.precheckNote.timeHostClock'
}

/** True for the SECURITY note of a Core that reports no platform: its chip reads "Not reported", not "NOTE". */
export function isSecurityNotReportedNote(item: Pick<PrecheckItem, 'status' | 'params'>): boolean {
  return precheckNoteKey(item) === 'web.waveJ.precheck.securityNotReported'
}

/** The device named inside a lens or MIC reason. */
export const CHECK_DEVICE_KEY = {
  LENS_1: 'common.devices.camera1',
  LENS_2: 'common.devices.camera2',
  MIC_1: 'common.devices.mic1',
  MIC_2: 'common.devices.mic2',
  // Schema v2 (SH-03; blueprint row 67): the role-keyed pair names the input by the role it holds.
  MIC_PRIMARY: 'sessionNew.devices.checks.MIC_PRIMARY',
  MIC_STANDBY: 'sessionNew.devices.checks.MIC_STANDBY',
} as const

/** The `common.enums.*` map that labels a check's `value`. */
export const CHECK_VALUE_ENUM = {
  CORE: 'coreLinkState',
  LENS_1: 'lensState',
  LENS_2: 'lensState',
  MIC_1: 'micState',
  MIC_2: 'micState',
  MIC_PRIMARY: 'micState',
  MIC_STANDBY: 'micState',
  STORAGE: 'storageState',
  TIME: 'timeSource',
  SECURITY: 'securityState',
} as const satisfies Record<PrecheckCheckId, string>

// ── Subject type tones (D28/Q3: Tersangka red, Saksi blue, Lainnya neutral) ─────────────

export const SUBJECT_TYPES = [SubjectType.TERSANGKA, SubjectType.SAKSI, SubjectType.LAINNYA] as const

export const SUBJECT_TONE = {
  TERSANGKA: 'danger',
  SAKSI: 'info',
  LAINNYA: 'default',
} as const satisfies Record<SubjectType, StatusTone>

// ── Schema messages (D62) ────────────────────────────────────────────────────────────────

export type SessionMessageKey = (typeof SESSION_CREATE_MESSAGES)[keyof typeof SESSION_CREATE_MESSAGES]
const MESSAGE_KEYS = new Set<string>(Object.values(SESSION_CREATE_MESSAGES))

/** True when a zod issue message is one of the schema's i18n keys. */
export function isSessionMessage(message: string | undefined): message is SessionMessageKey {
  return message !== undefined && MESSAGE_KEYS.has(message)
}

// ── The profile a new session records with (fix wave Q, CT-08) ───────────────────────────

/**
 * Fix wave Q (CT-08, the web's side; D228 (3)): on a Core in its own capture the form said "Recording Profile -
 * Standard (1080p / 25 fps)" - the label of the form's `profileId`, a choice of the simulator's model - for a
 * session whose configured and sealed profile is H264_720P30. The profile such a Core records with is what its
 * SELECTOR LINES IN FORCE say (`cameraLinesInForce`: the open session's snapshot, else the stored selector; a sealed
 * session's snapshot names nothing), one part per track - the same words as the Monitor's "Configured profile" row.
 * A primitive (a string), so a store selector never loops. '' = no line states a profile ("Not reported").
 */
export function selectorProfileLinesOf(state: Parameters<typeof cameraLinesInForce>[0]): string {
  const lines = cameraLinesInForce(state) as readonly { readonly trackId?: unknown; readonly profile?: unknown }[]
  return lines
    .filter((line): line is { readonly trackId: string; readonly profile: string } => typeof line.trackId === 'string' && typeof line.profile === 'string' && line.profile !== '' && line.profile.length <= 40)
    .toSorted((a, b) => a.trackId.localeCompare(b.trackId))
    .map((line) => `${line.trackId}: ${line.profile}`)
    .join(' · ')
}
