/**
 * Login reads over the simulator (step 43; simplified by step 54, which closed W43-1 and W43-2 in
 * `packages/shared/src/sim`).
 *
 * - Presentation mode (01_specs §14.8: the "Demo operators" Disclosure is hidden in it). The
 *   simulator now keeps it in its persisted `settings` slice (`selectPresentationMode`,
 *   `actions.setPresentationMode`). `@/lib/presentation-mode` (the D74 M8 store, written by the
 *   System page's switches) stays in step for existing readers; Login hides the Disclosure when
 *   either says so.
 * - Why the operator arrived (M-APP-02): the simulator's `selectLastSignOut` reads the newest
 *   sign-out, console lock or idle expiry from its event ring (it survives a reload).
 */
import { selectLastSignOut, selectPresentationMode, useSim, type Sim, type SimEvent } from '@dems/shared/sim'
import { usePresentationMode as usePresentationModeFlag } from '@/lib/presentation-mode'

/** True while presentation mode is on (simulator settings or the D74 module). */
export function usePresentationMode(): boolean {
  const flag = usePresentationModeFlag()
  const simulated = useSim(selectPresentationMode)
  return flag || simulated
}

/**
 * The last sign-out as the event shape `arrivalNoticeFor` reads, read once (not subscribed):
 * AUTH_LOGOUT with its reason, AUTH_EXPIRED, or null when the newest auth event is a sign-in.
 */
export function readLastAuthEvent(sim: Sim): Pick<SimEvent, 'type' | 'params'> | null {
  const last = selectLastSignOut(sim.store.getState())
  if (!last) return null
  return last.reason === 'EXPIRED'
    ? { type: 'AUTH_EXPIRED', params: { operatorId: last.operatorId } }
    : { type: 'AUTH_LOGOUT', params: { operatorId: last.operatorId, reason: last.reason } }
}
