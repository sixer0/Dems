/**
 * Dashboard reads over the simulator (step 42; simplified by step 54, which closed the gaps
 * W42-1 and W42-2 in `packages/shared/src/sim`).
 *
 * - Panel A uses the simulator's stable `selectSystemState` (review 40 M1): the ring state, the
 *   flag count and the recording start are primitives, so `useSim` never loops.
 * - Panel D (sealed) shows the manifest digest of the sealed item. Since step 54 the simulator
 *   carries the step-93 DEMO package's digest on every item that joins a package (review 40 §5.c,
 *   rule R3), labelled by `EvidenceItem.integritySource`; a session the presenter recorded live
 *   keeps the simulator's synthetic hash, labelled "simulated". No demo-data import is needed.
 *
 * Live mode (backend task, plan row W63): every read here works on the Live source's replica
 * unchanged (`useSim` reads the store of the source in the context, 04_client_integration_spec
 * §2.3). Only the label of a hash that is not the package's differs: a Live screen never says
 * "simulated" (§3.2), so it says that the item has no media package (01_specs §11).
 */
import { SessionState } from '@dems/shared/domain'
import { CoreMode } from '@dems/shared/live'
import { selectSystemState, useSim, type SimState } from '@dems/shared/sim'

export { selectSystemStateValue } from '@dems/shared/sim'

export interface RingPrimitives {
  state: ReturnType<typeof selectSystemState>['state']
  /** Number of active flags (ATTENTION and CRITICAL show "N ISSUES"). */
  issues: number
  /** Recording start on the simulator clock, or null when not recording. */
  since: number | null
  /** Pass D7: RECORDING before the first durable fragment — "Connecting cameras…", never the recording ring. */
  connecting: boolean
}

/**
 * Integration pass D7 item 3 (ux §8e.2; D84, D91 R-1 option A): in a real capture operation a session is
 * RECORDING from the accepted start and its payload says `captureDurable: false` until the first durable
 * fragment. Only an explicit `false` counts: a session without the member reads as recording, as before.
 */
export const selectConnectingCameras = (s: SimState): boolean =>
  s.session?.state === SessionState.RECORDING && s.session.captureDurable === false

/** The ring state under RECORDING: what the system's own flags say (the severity RECORDING never hides, D96). */
const STATE_OF_SEVERITY = { OK: 'READY', WARNING: 'ATTENTION', CRITICAL: 'CRITICAL' } as const

export const selectRingPrimitives = (s: SimState): RingPrimitives => {
  const status = selectSystemState(s)
  const connecting = selectConnectingCameras(s)
  return {
    // While the cameras connect nothing records: the ring shows the system's own state, without REC or a timer.
    state: connecting ? STATE_OF_SEVERITY[status.severity] : status.state,
    issues: status.flags.length,
    since: s.session?.state === SessionState.RECORDING && !connecting ? s.session.startedAt : null,
    connecting,
  }
}

export type ManifestDigestSource = 'package' | 'simulated' | 'pending'

export interface ManifestDigest {
  /** Lowercase hex SHA-256, or null when the item is unknown. */
  digest: string | null
  source: ManifestDigestSource
}

const selectDigest =
  (evidenceId: string | null) =>
  (s: SimState): ManifestDigest => {
    const item = evidenceId ? s.evidence.find((entry) => entry.id === evidenceId) : undefined
    if (!item) return { digest: null, source: 'pending' }
    return { digest: item.manifestHash, source: item.integritySource === 'DEMO_PACKAGE' ? 'package' : 'simulated' }
  }

/** The manifest digest to show for a sealed evidence item (a flat object of primitives). */
export function useSealedManifestDigest(evidenceId: string | null): ManifestDigest {
  return useSim(selectDigest(evidenceId))
}

/**
 * The i18n key of the suffix after "Manifest hash", or null for none. A package digest has none
 * in either mode; a hash that is not the package's says "SIMULATED" in Simulated mode (as before)
 * and "NO MEDIA PACKAGE" in Live mode. Pure.
 */
export type ManifestSuffixKey = 'common.simulated.chip' | 'dashboard.activeSession.sealed.noPackage'

export function manifestSuffixKey(source: ManifestDigestSource, mode: CoreMode): ManifestSuffixKey | null {
  if (source !== 'simulated') return null
  return mode === CoreMode.LIVE ? 'dashboard.activeSession.sealed.noPackage' : 'common.simulated.chip'
}
