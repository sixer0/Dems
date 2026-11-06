/**
 * THE ONE STATEMENT OF SYSTEM STATE OF THE WEB CONSOLE (fix wave J, driver J-W; findings JW-04, JW-05,
 * JT-01, JT-03; truth rule 3c of `delegation_progress/fix_brief_wave_j.md`).
 *
 * Before this module the header pill, the Dashboard ring and the pre-check each derived their own
 * answer: the pill read "SECURE - All systems operational" while its own popover said "Not reported",
 * while a capture camera was unreachable and its alert stood on the bell, and while the Core link
 * was lost. `systemStatementOf` is ONE pure function of the Core's facts; the pill, the ring and the
 * pre-check's security row read it and nothing else decides the word.
 *
 * | # | Fact (first that holds wins) | Statement | Tone |
 * |---|---|---|---|
 * | 1 | the state is not hydrated | UNKNOWN | unknown |
 * | 2 | the Live link is lost (OFFLINE / STALE) | CORE_OFFLINE - "state unknown": nothing below is known any more | unknown |
 * | 3 | a critical flag, a blocked seal, or an active CRITICAL alert | CRITICAL | critical |
 * | 4 | a warning flag | ATTENTION | attention |
 * | 5 | the Core runs a seal again by itself | SEAL_RETRYING | attention |
 * | 6 | an active WARNING alert no flag stands for (an unreachable capture source, an empty search) | ALERT_ACTIVE | attention |
 * | 7 | an active unsealable notice (a recording in quarantine; recording is not blocked) | OPEN_NOTICE | attention |
 * | 7b | none of the above, and the shared `systemTruthOf(state).allOperational` is false | ATTENTION | attention |
 * | 8 | none of the above, and the Core states `security.platformNotReported` | NO_FAULT_REPORTED - never "SECURE": no Core computed a posture | neutral |
 * | 9 | none of the above | SECURE | secure |
 *
 * An active INFO alert (a note of the running session) changes no statement: it is on the bell.
 */
import { LiveLinkState } from '@dems/shared/live'
import { openUnsealableNoticesOf, sealBlockedNoticeOf, selectSystemSeverity, systemTruthOf, useSim, useSimReady, type SimState } from '@dems/shared/sim'
import { useLiveLink } from '@dems/shared/live'
import { isPlatformNotReportedCore } from './own-capture'
import { sealRetryingSessionOf } from './seal-attention'

export type SystemStatementKind =
  | 'UNKNOWN'
  | 'CORE_OFFLINE'
  | 'CRITICAL'
  | 'ATTENTION'
  | 'SEAL_RETRYING'
  | 'ALERT_ACTIVE'
  | 'OPEN_NOTICE'
  | 'NO_FAULT_REPORTED'
  | 'SECURE'

/** The colour family of a statement: what the pill's `data-state` and the ring's state follow. */
export type SystemStatementTone = 'UNKNOWN' | 'CRITICAL' | 'ATTENTION' | 'NEUTRAL' | 'SECURE'

export interface SystemFacts {
  /** The state is hydrated (the simulator's store, or the first snapshot of the Core). */
  readonly ready: boolean
  /** The Live link is lost (OFFLINE or STALE). False in Simulated mode. */
  readonly linkLost: boolean
  /** The worst system flag (`selectSystemSeverity`). */
  readonly severity: 'OK' | 'WARNING' | 'CRITICAL'
  /** The Core reports a blocked seal (`sealBlockedNoticeOf`). */
  readonly sealBlocked: boolean
  /** The Core runs a seal again by itself (`sealRetryingSessionOf`). */
  readonly sealRetrying: boolean
  /** Active CRITICAL alerts no flag stands for (kind SYSTEM, not the blocked seal's own). */
  readonly criticalAlerts: number
  /** Active WARNING alerts no flag stands for (kind SYSTEM, not an unsealable notice). */
  readonly warningAlerts: number
  /** Active unsealable notices (`openUnsealableNoticesOf`). */
  readonly openNotices: number
  /** The Core states that it computes no platform posture (`security.platformNotReported`). */
  readonly platformNotReported: boolean
  /**
   * `systemTruthOf(state).allOperational` of `@dems/shared/sim` (`contract_wave_j.md`): true exactly when a surface
   * may write "All systems operational". The shared reader and this table agree on every fact above; the member is
   * the guard that keeps them agreeing - a fact the shared reader learns later can never read SECURE here.
   */
  readonly allOperational: boolean
}

export interface SystemStatement {
  readonly kind: SystemStatementKind
  readonly tone: SystemStatementTone
}

const TONE: Record<SystemStatementKind, SystemStatementTone> = {
  UNKNOWN: 'UNKNOWN',
  CORE_OFFLINE: 'UNKNOWN',
  CRITICAL: 'CRITICAL',
  ATTENTION: 'ATTENTION',
  SEAL_RETRYING: 'ATTENTION',
  ALERT_ACTIVE: 'ATTENTION',
  OPEN_NOTICE: 'ATTENTION',
  NO_FAULT_REPORTED: 'NEUTRAL',
  SECURE: 'SECURE',
}

/** The table of the module comment, as code. Pure. */
export function systemStatementKindOf(facts: SystemFacts): SystemStatementKind {
  if (!facts.ready) return 'UNKNOWN'
  if (facts.linkLost) return 'CORE_OFFLINE'
  if (facts.severity === 'CRITICAL' || facts.sealBlocked || facts.criticalAlerts > 0) return 'CRITICAL'
  if (facts.severity === 'WARNING') return 'ATTENTION'
  if (facts.sealRetrying) return 'SEAL_RETRYING'
  if (facts.warningAlerts > 0) return 'ALERT_ACTIVE'
  if (facts.openNotices > 0) return 'OPEN_NOTICE'
  if (!facts.allOperational) return 'ATTENTION'
  if (facts.platformNotReported) return 'NO_FAULT_REPORTED'
  return 'SECURE'
}

export function systemStatementOf(facts: SystemFacts): SystemStatement {
  const kind = systemStatementKindOf(facts)
  return { kind, tone: TONE[kind] }
}

/** `true` only for the one statement that may be worded "secure" / "all systems operational". */
export function statesSecure(kind: SystemStatementKind): boolean {
  return kind === 'SECURE'
}

type StateFacts = Omit<SystemFacts, 'ready' | 'linkLost'>

/**
 * The facts the state holds. Alerts: an alert of a FAULT kind is already a system flag (the severity);
 * a SYSTEM alert is counted here unless it is the unsealable notice (its own row of the table) - the
 * blocked seal's alert is CRITICAL either way.
 */
export function systemFactsOfState(s: Pick<SimState, 'alerts' | 'session' | 'security'> & SimState): StateFacts {
  const unsealable = new Set(openUnsealableNoticesOf(s).map((notice) => notice.alertId))
  let criticalAlerts = 0
  let warningAlerts = 0
  for (const alert of s.alerts) {
    if (!alert.active || alert.kind !== 'SYSTEM' || unsealable.has(alert.id)) continue
    if (alert.severity === 'CRITICAL') criticalAlerts += 1
    else if (alert.severity === 'WARNING') warningAlerts += 1
  }
  return {
    severity: selectSystemSeverity(s),
    sealBlocked: sealBlockedNoticeOf(s) !== null,
    sealRetrying: sealRetryingSessionOf(s) !== null,
    criticalAlerts,
    warningAlerts,
    openNotices: unsealable.size,
    platformNotReported: isPlatformNotReportedCore(s),
    allOperational: systemTruthOf(s).allOperational,
  }
}

/** The statement of the state alone (hydrated, link up): one primitive, stable under `useSim`. */
export function selectSystemStatementKind(s: SimState): SystemStatementKind {
  return systemStatementKindOf({ ready: true, linkLost: false, ...systemFactsOfState(s) })
}

/** The newest active WARNING / CRITICAL alert no flag stands for: what ALERT_ACTIVE names. '' when none. */
export function selectStatedAlertMessage(s: SimState): string {
  const unsealable = new Set(openUnsealableNoticesOf(s).map((notice) => notice.alertId))
  let newest: { at: number; message: string } | null = null
  for (const alert of s.alerts) {
    if (!alert.active || alert.kind !== 'SYSTEM' || unsealable.has(alert.id) || alert.severity === 'INFO') continue
    if (newest === null || alert.at > newest.at) newest = { at: alert.at, message: alert.message }
  }
  return newest?.message ?? ''
}

/** The number of active WARNING / CRITICAL alerts no flag stands for. */
export function selectStatedAlertCount(s: SimState): number {
  const facts = systemFactsOfState(s)
  return facts.criticalAlerts + facts.warningAlerts
}

/** OFFLINE and STALE are a lost link; CONNECTING decides nothing by itself (`isLinkLost` of the shell). */
export function linkLostOf(link: LiveLinkState | null): boolean {
  return link === LiveLinkState.OFFLINE || link === LiveLinkState.STALE
}

/** The one statement, for the pill, the ring and every other surface that words the system's state. */
export function useSystemStatement(): SystemStatement {
  const ready = useSimReady()
  const link = useLiveLink()
  const kind = useSim(selectSystemStatementKind)
  if (!ready) return { kind: 'UNKNOWN', tone: 'UNKNOWN' }
  if (linkLostOf(link)) return { kind: 'CORE_OFFLINE', tone: 'UNKNOWN' }
  return { kind, tone: TONE[kind] }
}
