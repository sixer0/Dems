/**
 * Live mode of the System page (plan row W76; backend task 04_client_integration_spec §7.3 G14,
 * §8.4 C-7; 01_specs DC-3). Pure helpers and two small hooks; no transport.
 *
 * | Need | Here |
 * |------|------|
 * | Is the Core server the Core? | `useSystemLiveMode()`: true only with a Live source in the context (TS-3) |
 * | May the Demo Control Panel be shown? (AC-C-52) | `useDemoPanelVisible()`: always in Simulated mode, as today; in Live mode only when the server's session holds `DEMO_CONTROL` **and** its `demoControls` flag is on |
 * | Which audit row belongs to my command? (C-7) | `newestOwnRow(rows, …)`: in Live mode the newest row of the ring may be the engine's or another console's |
 */
import { CoreMode, useCoreMode, useLiveSelector } from '@dems/shared/live'
import { Permission, type AuditRow, type AuditType } from '@dems/shared/sim'
import type { WebLive } from '@/runtime'

/** True when the Core server is the Core of this page load (a Live source in the context). */
export function useSystemLiveMode(): boolean {
  return useCoreMode() === CoreMode.LIVE
}

/** What the gate reads of the server's session: the permission hint and the demo flag (DC-3). */
export interface DemoGateSession {
  readonly permissions: readonly string[]
  readonly demoControls: boolean
}

/**
 * DC-3: the panel is for an operator whose role holds `DEMO_CONTROL` on a Core server started with
 * the demo flag. Both are the server's own words in the session information; the server still
 * decides every call (a 403 `DEMO_DISABLED` is worded by the presenter if the flag goes off).
 */
export function demoPanelAllowed(session: DemoGateSession | null): boolean {
  return session !== null && session.demoControls === true && session.permissions.includes(Permission.DEMO_CONTROL)
}

/** AC-C-52: in Simulated mode the panel is shown as today; in Live mode only by `demoPanelAllowed`. */
export function useDemoPanelVisible(): boolean {
  const live = useSystemLiveMode()
  // `session` is replaced on every change and never edited in place: the reference is a stable snapshot.
  const session = useLiveSelector((source: WebLive | null) => source?.session ?? null)
  return live ? demoPanelAllowed(session) : true
}

export interface OwnRowQuery {
  /** The audit types the command writes (a fault: FAULT_RAISED, FAULT_CLEARED; AUDIT_TAMPER: AUDIT_CHAIN_DISCONTINUITY). */
  readonly types: readonly AuditType[]
  /** Only rows after this sequence: the ring's `total` at the press. */
  readonly afterSeq: number
  /** The signed-in operator. The simulator's fault rows name no actor, so a row without one counts too. */
  readonly operatorId: string | null
  /** The fault kind the row must name in `details.kind`, when the command is about one. */
  readonly kind?: string
}

/**
 * C-7: the newest row the command wrote. A row of another console, of the engine (a tick, an
 * alert) or of an earlier command is skipped; `undefined` when none is in the ring, and the toast
 * then carries no audit note rather than a wrong one.
 */
export function newestOwnRow(rows: readonly AuditRow[], query: OwnRowQuery): AuditRow | undefined {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index] as AuditRow
    if (row.seq <= query.afterSeq) return undefined
    if (!query.types.includes(row.type)) continue
    if (row.actorId !== null && row.actorId !== query.operatorId) continue
    if (query.kind !== undefined && row.details.kind !== query.kind) continue
    return row
  }
  return undefined
}
