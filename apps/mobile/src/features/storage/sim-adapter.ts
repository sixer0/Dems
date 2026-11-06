/**
 * Local simulator adapter for the mobile Storage screen (P6: screens never write
 * `packages/shared/src/sim`). Each block is a logged gap for step 91, which moves it into the
 * simulator and deletes this file. Both mirror the web Storage page (implementation/28 §3; D77) so
 * the two apps stay coherent until the shared selector lands.
 *
 * SIM-GAP-M85-1  No storage-activity selector: `SimEvent` has no category, so "events filtered to
 *                storage" (04 §4.13 T3) is a filter by type here. Same need as the web page's
 *                SIM-GAP-W49-2 (one shared fix closes both).
 * SIM-GAP-M85-2  (text corrected by the contract close-out W83, finding F79-1) The simulator now
 *                checks EVIDENCE_REVIEW or MAINTENANCE on `setStoragePolicy` itself (step 54, web
 *                finding F-49-1; `packages/shared/src/sim/maintenance.ts:293`). The screen also gates
 *                the Manage Storage controls in the UI: SUPERVISOR (governance: EVIDENCE_REVIEW) and
 *                TECHNICIAN (MAINTENANCE) may change the policy, INVESTIGATOR sees it read-only (04 §5
 *                roles, S20 "RBAC in the UI via isDisabled + a reason").
 */
import { SessionState } from '@dems/shared/domain';
import { Permission, roleHas, type OperatorRole, type SimEvent, type SimEventType, type SimState } from '@dems/shared/sim';

// ── SIM-GAP-M85-1: storage activity ─────────────────────────────────────────────────────────

export const STORAGE_EVENT_TYPES: ReadonlySet<SimEventType> = new Set<SimEventType>([
  'RECORDING_STARTED',
  'RECORDING_STOPPED',
  'AUTOSAVE',
  'FINALIZATION_STARTED',
  'EVIDENCE_SEALED',
  'EVIDENCE_EXPORTED',
  'EVIDENCE_ARCHIVED',
  'SESSION_INCOMPLETE',
  'STORAGE_WRITE_VERIFIED',
  'STORAGE_POLICY_CHANGED',
]);

const STORAGE_FAULT_KINDS: ReadonlySet<string> = new Set(['STORAGE_LOW', 'STORAGE_FULL']);

export function isStorageEvent(event: SimEvent): boolean {
  if (STORAGE_EVENT_TYPES.has(event.type)) return true;
  if (event.type === 'FAULT_RAISED' || event.type === 'FAULT_CLEARED') {
    const kind = event.params.kind;
    return typeof kind === 'string' && STORAGE_FAULT_KINDS.has(kind);
  }
  return false;
}

/**
 * The newest `count` storage events, newest first. Returns the store's own event objects, so a
 * shallow `useSim` compare holds between ticks (the array re-renders only when a row changes).
 */
export function selectStorageActivity(state: Pick<SimState, 'events'>, count = 5): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = state.events.length - 1; i >= 0 && out.length < count; i -= 1) {
    const event = state.events[i];
    if (event && isStorageEvent(event)) out.push(event);
  }
  return out;
}

/**
 * M3-13 (row 203, register W5; web twin `apps/core-web/src/lib/event-words.ts` `selectFaultSessionId`,
 * row 110b / D63): the open session's id while it is in FAULT, else null. A primitive, so the activity
 * list does not re-render on every session tick.
 */
export function selectFaultSessionId(state: Pick<SimState, 'session'>): string | null {
  const session = state.session;
  return session !== null && session !== undefined && session.state === SessionState.FAULT ? session.id : null;
}

// ── SIM-GAP-M85-2: who may change the storage policy ────────────────────────────────────────

/** Whether `role` may change the retention policy and auto-archive (UI gate; see the header). */
export function canManageStoragePolicy(role: OperatorRole | null | undefined): boolean {
  return roleHas(role, Permission.EVIDENCE_REVIEW) || roleHas(role, Permission.MAINTENANCE);
}
