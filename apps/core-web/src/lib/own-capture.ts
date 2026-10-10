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

/**
 * THE ONE RULE FOR "THE DEVICE MODEL OF THIS CORE IS NOT A READING" (fix wave K, driver W; findings
 * C-2 / G75c-04, ruling D222 (1)): a Core that states `security.platformNotReported`, or whose time
 * is the host system clock, runs its OWN capture on a host that is not the appliance. The values
 * the simulator's device model holds for an appliance (the DEMO signing key and certificate, a
 * TPM-resident root key, an attestation, a firmware signature, an enclosure switch, a GNSS receiver
 * on an RTC, a write speed of 8.2 GB per hour) are constants of that model, not facts this Core
 * has. A surface shows the Core's own fact where the state holds one, else "Not reported".
 * Absent both members: the simulated device, whose demonstration values stay exactly as they are.
 */
export function isSelfCaptureCore(state: Pick<SimState, 'security' | 'time'>): boolean {
  return isPlatformNotReportedCore(state) || isOwnCaptureCore(state)
}

/** `isSelfCaptureCore` of the console's state (a boolean: the selector's result compares by value). */
export function useSelfCaptureCore(): boolean {
  return useSim(isSelfCaptureCore)
}

/** The evidence signing key a Core reports: the one its sealed items are signed with. */
export interface ReportedSigningKey {
  readonly keyId: string
  readonly algorithm: string
  /** `true`: the Core says the key is a development key. `false`: it says it is not. `null`: not stated. */
  readonly developmentKey: boolean | null
  /** The newest item that names the key. */
  readonly evidenceId: string
}

/**
 * The evidence signing key THE CORE REPORTS (C-2): the key id in the signature of its newest sealed
 * item whose signature is not the simulated stand-in (`signature.simulated === false`, operations
 * 39 / 40 and the `evidence` slice) - what the packages of this Core are signed with. null: no item
 * of this Core names one (nothing is sealed yet): "Not reported", never a DEMO name.
 */
export function reportedSigningKeyOf(evidence: readonly unknown[]): ReportedSigningKey | null {
  let newest: { key: ReportedSigningKey; at: number } | null = null
  for (const entry of evidence) {
    if (typeof entry !== 'object' || entry === null) continue
    const item = entry as { id?: unknown; sealedAt?: unknown; signature?: unknown }
    const signature = item.signature as { keyId?: unknown; algorithm?: unknown; simulated?: unknown; developmentKey?: unknown } | null | undefined
    if (typeof item.id !== 'string' || typeof signature !== 'object' || signature === null) continue
    if (signature.simulated !== false || typeof signature.keyId !== 'string' || signature.keyId === '' || typeof signature.algorithm !== 'string') continue
    const at = typeof item.sealedAt === 'number' ? item.sealedAt : 0
    if (newest !== null && at < newest.at) continue
    newest = { at, key: { keyId: signature.keyId, algorithm: signature.algorithm, developmentKey: typeof signature.developmentKey === 'boolean' ? signature.developmentKey : null, evidenceId: item.id } }
  }
  return newest?.key ?? null
}

/** `reportedSigningKeyOf` of the console's evidence slice (the slice reference is store-owned: the result is computed per change). */
export function useReportedSigningKey(): ReportedSigningKey | null {
  const evidence = useSim((s) => s.evidence)
  return reportedSigningKeyOf(evidence)
}
