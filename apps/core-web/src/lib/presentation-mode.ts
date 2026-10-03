/**
 * Presentation mode (controller ruling M8, relayed by review 40 as D74; owner: step 43).
 *
 * 01_specs §14.8 hides the Login "Demo operators" Disclosure in presentation mode, and §14.5.8
 * puts the presentation-mode `Switch` in the System page's Demo Control Panel. No simulator slice
 * holds the flag yet, so this tiny module is the one shared place:
 *
 * - `sessionStorage['dems.presentation.v1']` is `'1'` (on) or absent / `'0'` (off). Session scope:
 *   the flag lasts for the browser tab, like the simulator snapshot and `dems.auth`.
 * - `getPresentationMode()` / `setPresentationMode(enabled)` read and write it.
 * - `usePresentationMode()` subscribes: an in-page notifier (the System switch and the Login page
 *   can be on screen in the same tab) plus `storage` events (other browsing contexts that share the
 *   session storage).
 *
 * Readers: Login (step 43). Writer: System (step 52). Step 54 added the simulator's
 * `settings.presentationMode`: the Login and System sim-adapters read either and write both, so this
 * module keeps its API and stays in step.
 *
 * Storage failures (private mode, disabled storage) never throw: reads fall back to off, writes
 * still notify in-page subscribers, and the failure is reported once as a structured dev-console
 * entry (no client-log endpoint exists, D41(g)).
 */
import { useSyncExternalStore } from 'react'

export const PRESENTATION_MODE_STORAGE_KEY = 'dems.presentation.v1'

type Listener = () => void
const listeners = new Set<Listener>()
/** In-memory fallback so a write still takes effect in this tab when storage is unavailable. */
let memoryValue: boolean | null = null
let reportedFailure = false

function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function reportStorageFailure(operation: 'read' | 'write', error: unknown): void {
  if (reportedFailure) return
  reportedFailure = true
  if (import.meta.env.DEV) {
    console.warn('[core-web] presentation mode', {
      timestamp: new Date().toISOString(),
      level: 'warn',
      source: `lib/presentation-mode.${operation}`,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: { key: PRESENTATION_MODE_STORAGE_KEY },
    })
  }
}

/** The current flag. Off when nothing is stored or storage cannot be read. */
export function getPresentationMode(): boolean {
  const storage = sessionStore()
  if (!storage) return memoryValue ?? false
  try {
    const raw = storage.getItem(PRESENTATION_MODE_STORAGE_KEY)
    return raw === null ? (memoryValue ?? false) : raw === '1'
  } catch (error) {
    reportStorageFailure('read', error)
    return memoryValue ?? false
  }
}

/** Sets the flag for this browser tab and notifies every subscriber on the page. */
export function setPresentationMode(enabled: boolean): void {
  memoryValue = enabled
  const storage = sessionStore()
  try {
    storage?.setItem(PRESENTATION_MODE_STORAGE_KEY, enabled ? '1' : '0')
  } catch (error) {
    reportStorageFailure('write', error)
  }
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === PRESENTATION_MODE_STORAGE_KEY || event.key === null) listener()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** The flag, live. Re-renders when any code on the page (or a sibling context) changes it. */
export function usePresentationMode(): boolean {
  return useSyncExternalStore(subscribe, getPresentationMode, () => false)
}

/** Test helper: forgets the in-memory fallback (storage itself is cleared by the caller). */
export function resetPresentationModeForTests(): void {
  memoryValue = null
  reportedFailure = false
}
