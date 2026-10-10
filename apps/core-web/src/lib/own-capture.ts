/**
 * THE ONE RULE OF THE WEB CONSOLE FOR "THIS SESSION IS A RECORDING OF THE CORE'S OWN CAPTURE"
 * (wave H closing pass Z2; driver A's decision 8, note 120): the session payload carries the member
 * `captureDurable` (`captureFactsOf` of `@dems/shared/sim`, which holds the rule of the state). A
 * session of the simulator's own durable recording carries none and keeps its demonstration values.
 *
 * What a surface does with it: beside such a session it states only what the Core knows - no
 * "integrity checks passing", no write speed, no time source read from a constant.
 */
import { captureFactsOf, isHostClockTime, isPlatformNotReported, useSim, type SimState } from '@dems/shared/sim'

type CaptureSession = { readonly state: string; readonly captureDurable?: boolean }

/** True when `session` carries the capture member (the Core's own capture). False without a session. */
export function isOwnCapture(session: CaptureSession | null | undefined): boolean {
  return captureFactsOf(session) !== null
}

/** `isOwnCapture` of the open session (a boolean: the selector's result compares by value). */
export function useOwnCapture(): boolean {
  return useSim((s) => isOwnCapture(s.session))
}

/**
 * THE ONE RULE FOR "THIS CORE RUNS ITS OWN CAPTURE" OUTSIDE A SESSION (fix wave I, driver B; finding
 * G75b-06): the `time` slice of such a Core carries `hostClock: true` (`HOST_CLOCK_TIME` of
 * `@dems/shared/sim`, set by the engine exactly where the capture is the Core's own). A simulated
 * Core carries none and keeps its demonstration of a GNSS time service, a TPM and Secure Boot.
 *
 * What a chip does with it: the time is "Host system clock" (no GNSS, no "holdover", no stratum, no
 * offset - nothing was ever synchronised or measured).
 *
 * THIS RULE IS FOR THE TIME ONLY. The platform facts (TPM, Secure Boot, posture) have a statement
 * of their own since closing pass J: `isPlatformNotReportedCore` below.
 */
export function isOwnCaptureCore(state: Pick<SimState, 'time'>): boolean {
  return isHostClockTime(state.time)
}

/** `isOwnCaptureCore` of the console's state (a boolean: the selector's result compares by value). */
export function useOwnCaptureCore(): boolean {
  return useSim(isOwnCaptureCore)
}

/**
 * THE ONE RULE FOR "THIS CORE REPORTS NO TPM / SECURE BOOT / POSTURE" (closing pass J, ruling
 * D217 (7); finding G75b-06 at its source): the member `security.platformNotReported` of the state,
 * read BY NAME (`isPlatformNotReported` of `@dems/shared/sim`). It replaces the interim rule of fix
 * wave I that inferred it from `time.hostClock`. Absent = the simulated device: its TPM, Secure Boot
 * and posture are what the slice says.
 *
 * What a surface does with it: the TPM and Secure Boot read "Not reported" (never "Verified" /
 * "Enabled" / "Attestation OK"); a posture that would read SECURE reads "Not reported" (a posture
 * that names a fault keeps it: the fault is a fact of the state).
 */
export function isPlatformNotReportedCore(state: Pick<SimState, 'security'>): boolean {
  return isPlatformNotReported(state.security)
}

/** `isPlatformNotReportedCore` of the console's state (a boolean: the selector's result compares by value). */
export function usePlatformNotReported(): boolean {
  return useSim(isPlatformNotReportedCore)
}
