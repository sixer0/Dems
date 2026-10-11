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
import { openUnsealableNoticesOf, sealAttentionOf, sealedPackageOf, selectSystemState, useSim, type SimState } from '@dems/shared/sim'
import { sealRetryingSessionOf } from '@/lib/seal-attention'

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

/**
 * `package`: the digest is the manifest's own - a bundled DEMO package, or (wave L, G89c-01) a package
 * THIS CORE holds and read under that digest (`sealedPackage: PRESENT`, the item's own word).
 * `unreadable`: the Core says the sealed package of the item cannot be read (`NOT_READABLE`).
 * `simulated`: neither - the item has no media package.
 */
/**
 * Fix wave L (G75d-01, G75d-03; rulings D228 (2), (3)): what the ring must say beyond the system's
 * flags - primitives, so `useSim` never loops.
 * `blockedSessionId`: sealing of the open session is BLOCKED (`sealAttentionOf`): no session can be
 * started, so the ring never reads "READY ... ready for recording".
 * `openNotices` / `noticeSessionId`: ACTIVE unsealable alerts (`openUnsealableNoticesOf`, the one
 * fact): a recording sits in quarantine; recording is not blocked.
 */
export const selectRingBlockedSession = (s: SimState): string | null => {
  const attention = sealAttentionOf(s)
  return attention !== null && attention.kind === 'BLOCKED' ? attention.sessionId : null
}
/** Fix wave M (G75e-06): the Core is running the seal of the open session again by itself (`sealRetryingSessionOf`). */
export const selectRingRetryingSession = (s: SimState): string | null => sealRetryingSessionOf(s)
export const selectOpenNoticeCount = (s: SimState): number => openUnsealableNoticesOf(s).length
export const selectNewestNoticeSession = (s: SimState): string | null => openUnsealableNoticesOf(s)[0]?.sessionId ?? null

export type ManifestDigestSource = 'package' | 'simulated' | 'pending' | 'unreadable'

export interface ManifestDigest {
  /** Lowercase hex SHA-256, or null when the item is unknown. */
  digest: string | null
  source: ManifestDigestSource
}

/** Where the digest of one sealed item comes from, by the item's own members. Pure. */
export function manifestDigestSourceOf(item: { readonly integritySource?: unknown; readonly sealedPackage?: unknown }): Exclude<ManifestDigestSource, 'pending'> {
  // Wave L (G89c-01): what THE CORE says of the item's package comes first. A real sealed item is not "no media package".
  const stated = sealedPackageOf(item)
  if (stated === 'PRESENT') return 'package'
  if (stated === 'NOT_READABLE') return 'unreadable'
  return item.integritySource === 'DEMO_PACKAGE' ? 'package' : 'simulated'
}

const selectDigest =
  (evidenceId: string | null) =>
  (s: SimState): ManifestDigest => {
    const item = evidenceId ? s.evidence.find((entry) => entry.id === evidenceId) : undefined
    if (!item) return { digest: null, source: 'pending' }
    return { digest: item.manifestHash, source: manifestDigestSourceOf(item) }
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
export type ManifestSuffixKey = 'common.simulated.chip' | 'dashboard.activeSession.sealed.noPackage' | 'web.dashboard.packageNotReadable'

export function manifestSuffixKey(source: ManifestDigestSource, mode: CoreMode): ManifestSuffixKey | null {
  if (source === 'unreadable') return 'web.dashboard.packageNotReadable'
  if (source !== 'simulated') return null
  return mode === CoreMode.LIVE ? 'dashboard.activeSession.sealed.noPackage' : 'common.simulated.chip'
}
