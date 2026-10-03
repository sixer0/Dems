/**
 * System & Maintenance reads and writes over the simulator (step 52; simplified by step 54, which
 * closed W52-1..8 in `packages/shared/src/sim`):
 *
 * | Item | Simulator API (step 54) | Here |
 * |------|-------------------------|------|
 * | W52-1 service uptime | `ServiceEntry.startedAt`, `selectServicesSince` | re-exported; `uptimeAnchors` kept as the audit-row fallback |
 * | W52-2 settings | `settings` slice, `actions.updateSettings` | `useConsolePrefs`: the slice, mirrored to localStorage so a new tab starts from the last choice |
 * | W52-3 restart services | `actions.restartServices()` (MAINTENANCE; SESSION_ACTIVE refusal; DEVICE_COMMAND row) | `restartCoreServices` calls it |
 * | W52-4 release / SBOM | `releaseInfo`, `selectReleaseInfo` (synthetic) | re-exported |
 * | W52-5 presentation mode | `settings.presentationMode`, `actions.setPresentationMode` | `usePresentationModeSetting` / `setPresentationModeEverywhere` keep the D74 module in step |
 * | W52-6 RBAC | runDiagnostics, deviceCommand, setStoragePolicy, startSoftwareUpdate, restartServices check roles; the Demo Control Panel actions stay open to every role | the page still catches `SimPermissionError` |
 * | W52-7 export logs | `actions.exportLogs()` (scope LOGS), `logBundle` | the Maintenance panel calls it |
 * | W52-8 reset | `actions.resetDemo()` | the Demo panel calls it |
 */
import { useEffect, useRef } from 'react'
import {
  selectPresentationMode,
  selectSettings,
  useSim,
  useSimActions,
  type AuditRow,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { setPresentationMode, usePresentationMode } from '@/lib/presentation-mode'

export { releaseInfo, selectServicesSince, SERVICES_RESTART_SCOPE, type ReleaseInfo } from '@dems/shared/sim'

// ── Service uptime (W52-1): the audit-row fallback for snapshots from before step 54 ──────────
interface UptimeAnchors {
  bootAt: number
  restartAt: number | null
}

const anchorCache = new WeakMap<readonly AuditRow[], UptimeAnchors>()

/** Boot and last services-restart times, from the audit ring (memoised on the rows array). */
export function uptimeAnchors(s: SimState): UptimeAnchors {
  const rows = s.audit.rows
  const cached = anchorCache.get(rows)
  if (cached) return cached
  let bootAt: number | null = null
  let restartAt: number | null = null
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index] as AuditRow
    if (restartAt === null && row.type === 'DEVICE_COMMAND' && row.details.scope === 'CORE_SERVICES') restartAt = row.at
    if (row.type === 'SYSTEM_BOOT') {
      bootAt = row.at
      break
    }
  }
  const anchors: UptimeAnchors = {
    bootAt: bootAt ?? rows[0]?.at ?? s.meta.createdAt,
    restartAt: restartAt !== null && bootAt !== null && restartAt < bootAt ? null : restartAt,
  }
  anchorCache.set(rows, anchors)
  return anchors
}

// ── Restart services (W52-3) ─────────────────────────────────────────────────────────────────
/**
 * Restarts the Core services (simulated, audited by the simulator). Throws like a sim action:
 * `SimPermissionError` without MAINTENANCE, `SimTransitionError` (SESSION_ACTIVE) during a session.
 */
export function restartCoreServices(sim: Pick<Sim, 'actions'>): number {
  return sim.actions.restartServices()
}

// ── Presentation mode (W52-5) ────────────────────────────────────────────────────────────────
/** True while presentation mode is on (simulator settings or the D74 module). */
export function usePresentationModeSetting(): boolean {
  const flag = usePresentationMode()
  const simulated = useSim(selectPresentationMode)
  return flag || simulated
}

/** Sets presentation mode in the simulator and in the D74 module (Login reads either). */
export function setPresentationModeEverywhere(sim: Pick<Sim, 'actions'>, enabled: boolean): void {
  sim.actions.setPresentationMode(enabled)
  setPresentationMode(enabled)
}

// ── Console preferences (W52-2) ──────────────────────────────────────────────────────────────
/**
 * The console preferences from the simulator's `settings` slice. Each change also goes to
 * localStorage, and a fresh store (a new tab) starts from the stored choice once.
 */
export function useConsolePrefs(): [LocalPrefs, (patch: Partial<LocalPrefs>) => void] {
  const settings = useSim(selectSettings)
  const actions = useSimActions()
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    const stored = readPrefs()
    if (stored.timeFormat !== DEFAULT_PREFS.timeFormat || stored.notifyWarnings !== DEFAULT_PREFS.notifyWarnings || stored.notifySound !== DEFAULT_PREFS.notifySound) {
      actions.updateSettings(stored)
    }
  }, [actions])
  const prefs: LocalPrefs = { timeFormat: settings.timeFormat, notifyWarnings: settings.notifyWarnings, notifySound: settings.notifySound }
  const update = (patch: Partial<LocalPrefs>) => {
    actions.updateSettings(patch)
    writePrefs({ ...prefs, ...patch })
  }
  return [prefs, update]
}

// ── Stored preferences (the localStorage mirror of the settings slice) ─────────────────────────
export const PREFS_STORAGE_KEY = 'dems.system.prefs.v1'

export interface LocalPrefs {
  timeFormat: '24' | '12'
  notifyWarnings: boolean
  notifySound: boolean
}

export const DEFAULT_PREFS: LocalPrefs = { timeFormat: '24', notifyWarnings: true, notifySound: false }

export function readPrefs(): LocalPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<LocalPrefs>
    return {
      timeFormat: parsed.timeFormat === '12' ? '12' : '24',
      notifyWarnings: typeof parsed.notifyWarnings === 'boolean' ? parsed.notifyWarnings : DEFAULT_PREFS.notifyWarnings,
      notifySound: typeof parsed.notifySound === 'boolean' ? parsed.notifySound : DEFAULT_PREFS.notifySound,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/** Persists the preferences; false when storage is unavailable (the in-memory value still applies). */
export function writePrefs(prefs: LocalPrefs): boolean {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
    return true
  } catch {
    return false
  }
}

// ── Demo Control Panel switch (per-tab convenience, not state) ──────────────────────────────
export const DEMO_CONTROLS_STORAGE_KEY = 'dems.system.demoControls.v1'

export function readDemoControlsOpen(): boolean {
  try {
    return window.sessionStorage.getItem(DEMO_CONTROLS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDemoControlsOpen(open: boolean): void {
  try {
    window.sessionStorage.setItem(DEMO_CONTROLS_STORAGE_KEY, open ? '1' : '0')
  } catch {
    // Storage unavailable: the switch still works for this page view.
  }
}
