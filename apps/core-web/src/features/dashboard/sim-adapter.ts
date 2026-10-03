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
 */
import { SessionState } from '@dems/shared/domain'
import { selectSystemState, useSim, type SimState } from '@dems/shared/sim'

export { selectSystemStateValue } from '@dems/shared/sim'

export interface RingPrimitives {
  state: ReturnType<typeof selectSystemState>['state']
  /** Number of active flags (ATTENTION and CRITICAL show "N ISSUES"). */
  issues: number
  /** Recording start on the simulator clock, or null when not recording. */
  since: number | null
}

export const selectRingPrimitives = (s: SimState): RingPrimitives => {
  const status = selectSystemState(s)
  return {
    state: status.state,
    issues: status.flags.length,
    since: s.session?.state === SessionState.RECORDING ? s.session.startedAt : null,
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
