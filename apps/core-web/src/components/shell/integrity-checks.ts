/**
 * SECURE pill model (masterplan/01_specs.md §14.4 item 10; research/04 §2.1 #11).
 *
 * Read-only derivations over the simulator state. Since step 54 (D96, review 40 m5) both the pill
 * state and the checklist come from the simulator's own rule set, so they always agree with the
 * Dashboard ring and the Session Monitor:
 * - the pill reads `selectSystemSeverity` (the worst flag), which RECORDING never hides: a mic clip
 *   or a fan stall during a recording shows ATTENTION (amber), a critical fault CRITICAL;
 * - the checklist is `selectIntegrityChecklist`: every system flag lands on exactly one row
 *   (POWER_FAIL on `recording`), so the popover can never read all-OK under a CRITICAL ring.
 * Every selector returns primitives or a stable array, so `useSim` (shallow) stays stable.
 */
import type { TFunction } from 'i18next'
import {
  FaultKind,
  INTEGRITY_CHECKLIST_IDS,
  faultKindLabelKey,
  isCoreNotRunningKind,
  sealBlockedNoticeOf,
  selectIntegrityChecklist,
  selectSystemSeverity,
  selectSystemState,
  type IntegrityCheckStatus,
  type IntegrityChecklistId,
  type SimState,
} from '@dems/shared/sim'

export type PillState = 'SECURE' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN'
export type CheckStatus = IntegrityCheckStatus

/** The popover rows, in order (the simulator's checklist IDs). */
export const INTEGRITY_CHECK_IDS = INTEGRITY_CHECKLIST_IDS
export type IntegrityCheckId = IntegrityChecklistId

/**
 * CRITICAL on a critical flag, ATTENTION on a warning (also while RECORDING, D96), else SECURE.
 */
export function selectPillState(s: SimState): Exclude<PillState, 'UNKNOWN'> {
  const severity = selectSystemSeverity(s)
  // Closing pass J (item 4): a BLOCKED SEAL is critical by the Core's own alert (`sealBlockedNoticeOf`),
  // not by a fault flag - no flag stands for it, and the "power fail" row that once did is gone.
  if (severity === 'CRITICAL' || sealBlockedNoticeOf(s) !== null) return 'CRITICAL'
  if (severity === 'WARNING') return 'ATTENTION'
  return 'SECURE'
}

/**
 * One status per `INTEGRITY_CHECK_IDS` entry, in that order (a stable array). A blocked seal lands
 * on the `recording` row (closing pass J): the popover never reads all-OK under a CRITICAL pill.
 */
export function selectIntegrityChecks(s: SimState): CheckStatus[] {
  const stated = selectIntegrityChecklist(s)
  if (sealBlockedNoticeOf(s) === null) return stated
  const row = INTEGRITY_CHECK_IDS.indexOf('recording')
  if (stated[row] === 'CRITICAL') return stated
  return blockedSealChecks(stated, row)
}

/** The checklist with the `recording` row critical; one array per input array, so `useSim` (shallow) stays stable. */
const BLOCKED_CHECKS = new WeakMap<readonly CheckStatus[], CheckStatus[]>()
function blockedSealChecks(stated: CheckStatus[], row: number): CheckStatus[] {
  let made = BLOCKED_CHECKS.get(stated)
  if (made === undefined) {
    made = stated.map((status, index) => (index === row ? 'CRITICAL' : status))
    BLOCKED_CHECKS.set(stated, made)
  }
  return made
}

// ── What the CRITICAL pill says (fix wave I, driver B; finding G75b-07) ─────────────────────────────

/** The critical flags that ARE a failed integrity check: the audit chain and the security platform. */
const INTEGRITY_FLAGS: readonly string[] = ['AUDIT_CHAIN', 'SECURITY_FAULT']

/** The fault kind a critical flag stands for (`common.faultKind.<kind>`), or null when the flag names none. */
function kindOfFlag(flagId: string, s: SimState): FaultKind | null {
  if (flagId.startsWith('CAMERA_')) return FaultKind.CAMERA_LOSS
  if (flagId === 'SESSION_FAULT') return s.session?.fault?.kind ?? null
  return Object.prototype.hasOwnProperty.call(FaultKind, flagId) ? (flagId as FaultKind) : null
}

/**
 * The cause the pill names while CRITICAL, as one primitive (stable for `useSim`):
 *
 *   ''             not critical
 *   'INTEGRITY'    a critical flag of the audit chain or the security platform: "An integrity check failed"
 *   'KIND:<kind>'  every other critical flag stands for this ONE fault kind: "Critical fault: <its name>"
 *   'COUNT:<n>'    several kinds (or one the console cannot name): "<n> critical faults"
 *   'SEAL_BLOCKED' no critical flag, and the Core reports a blocked seal: "Sealing is blocked" (pass J)
 *   'CORE_NOT_RUNNING'  the one kind is the restart fault of a Core in its own capture
 *                  (`coreNotRunning`, pass J): "Critical fault: Core was not running", never "Power failure"
 *
 * The integrity sentence was said for ANY critical flag (a demo capture fault, a power fail): no
 * integrity check had failed there.
 */
export function selectPillCause(s: SimState): string {
  const critical = selectSystemState(s).flags.filter((flag) => flag.severity === 'CRITICAL')
  if (critical.length === 0) return sealBlockedNoticeOf(s) !== null ? 'SEAL_BLOCKED' : ''
  if (critical.some((flag) => INTEGRITY_FLAGS.includes(flag.id))) return 'INTEGRITY'
  const kinds = new Set<string>()
  let unnamed = 0
  for (const flag of critical) {
    const kind = kindOfFlag(flag.id, s)
    if (kind === null) unnamed += 1
    else kinds.add(kind)
  }
  // A SESSION_FAULT flag without a kind of its own is the session side of the named fault beside it.
  if (kinds.size === 1) return isCoreNotRunningKind(s, [...kinds][0]) ? 'CORE_NOT_RUNNING' : `KIND:${[...kinds][0]}`
  return `COUNT:${kinds.size === 0 ? unnamed : kinds.size}`
}

/** The pill's second line for `state` and the cause of `selectPillCause`. */
export function pillSubtitle(t: TFunction, state: PillState, cause: string): string {
  if (state === 'CRITICAL' && cause === 'SEAL_BLOCKED') return t('web.sealBlocked.title')
  if (state === 'CRITICAL' && cause === 'CORE_NOT_RUNNING') return t('web.securePill.criticalKind', { kind: t(faultKindLabelKey('POWER_FAIL', { coreNotRunning: true })) })
  if (state === 'CRITICAL' && cause.startsWith('KIND:')) {
    return t('web.securePill.criticalKind', { kind: t(`common.faultKind.${cause.slice(5) as FaultKind}`) })
  }
  if (state === 'CRITICAL' && cause.startsWith('COUNT:')) return t('web.securePill.criticalCount', { count: Number(cause.slice(6)) })
  return t(`shell.securePill.${state}.subtitle`)
}

/**
 * The checklist row of a Core in its own capture that states no checked fact (G75b-06): an OK
 * `platform` row would say "TPM 2.0 and Secure Boot OK" of a Core that reports neither, an OK
 * `timeSource` row "Trusted time source OK" of a host system clock. A row that already shows a
 * fault keeps it. Null = the row is drawn as the simulator's rule set states it.
 */
export function ownCoreRow(
  id: IntegrityCheckId,
  stated: CheckStatus | 'UNKNOWN',
  core: { readonly hostClock: boolean; readonly platformNotReported: boolean },
): 'NOT_REPORTED' | 'HOST_CLOCK' | null {
  if (stated !== 'OK') return null
  // Each row from its OWN member (closing pass J): the platform from `security.platformNotReported`, the time from `time.hostClock`.
  if (id === 'platform' && core.platformNotReported) return 'NOT_REPORTED'
  if (id === 'timeSource' && core.hostClock) return 'HOST_CLOCK'
  return null
}
