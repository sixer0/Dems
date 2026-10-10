/**
 * THE ONE RULE OF THE WEB CONSOLE FOR "THIS SESSION IS A RECORDING OF THE CORE'S OWN CAPTURE"
 * (wave H closing pass Z2; driver A's decision 8, note 120): the session payload carries the member
 * `captureDurable` (`captureFactsOf` of `@dems/shared/sim`, which holds the rule of the state). A
 * session of the simulator's own durable recording carries none and keeps its demonstration values.
 *
 * What a surface does with it: beside such a session it states only what the Core knows - no
 * "integrity checks passing", no write speed, no time source read from a constant.
 */
import { captureFactsOf, useSim } from '@dems/shared/sim'

type CaptureSession = { readonly state: string; readonly captureDurable?: boolean }

/** True when `session` carries the capture member (the Core's own capture). False without a session. */
export function isOwnCapture(session: CaptureSession | null | undefined): boolean {
  return captureFactsOf(session) !== null
}

/** `isOwnCapture` of the open session (a boolean: the selector's result compares by value). */
export function useOwnCapture(): boolean {
  return useSim((s) => isOwnCapture(s.session))
}
