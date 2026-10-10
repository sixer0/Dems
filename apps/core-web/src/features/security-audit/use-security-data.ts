/**
 * Page-level simulator subscriptions (01_specs §14.7; review 40 R1, R8). Every selector returns
 * a primitive or a store-owned reference, so `useSim`'s shallow comparison stays stable and the
 * page re-renders only when the data changes (the 100 ms clock tick never reaches it).
 */
import { useDeferredValue, useMemo, useState } from 'react'
import {
  selectClockSecond,
  selectOperator,
  useSim,
  useSimReady,
  type AuditLogSlice,
} from '@dems/shared/sim'
import { DEMO_EVIDENCE_INDEX } from '@dems/shared/demo-data'
import { usePlatformNotReported } from '@/lib/own-capture'
import {
  buildControls,
  isEscalation,
  postureOf,
  verifyChain,
  type ChainReport,
  type ControlView,
  type PostureState,
} from './model'

/**
 * The audit log at transition priority plus its hash-chain report (re-verified incrementally
 * whenever the deferred slice changes). See `audit-context.ts`.
 */
export function useDeferredAudit(): { audit: AuditLogSlice; chain: ChainReport } {
  const live = useSim((s) => s.audit)
  const audit = useDeferredValue(live)
  const chain = useMemo(() => verifyChain(audit), [audit])
  return { audit, chain }
}

/** The shown posture (UNKNOWN until hydrated; CRITICAL whenever the chain is broken). */
export function usePosture(chainOk: boolean): PostureState {
  const ready = useSimReady()
  const simPosture = useSim((s) => s.security.posture)
  const notReported = usePlatformNotReported()
  return postureOf(simPosture, chainOk, ready, notReported)
}

/** The controls checklist (9 items). */
export function useControls(chain: ChainReport): ControlView[] {
  const ready = useSimReady()
  const security = useSim((s) => s.security)
  const timeSource = useSim((s) => s.time.source)
  const timeLocked = useSim((s) => s.time.locked)
  const softwareVersion = useSim((s) => s.device.softwareVersion)
  const { ok, breakSeq } = chain
  return useMemo(
    () =>
      buildControls({
        security,
        time: { source: timeSource, locked: timeLocked },
        chain: { ok, breakSeq },
        softwareVersion,
        signatureAlgorithm: DEMO_EVIDENCE_INDEX.key.algorithm,
        ready,
      }),
    [security, timeSource, timeLocked, ok, breakSeq, softwareVersion, ready],
  )
}

/** Simulator time in whole seconds × 1000 (1 Hz UI, R8). */
export function useSimSecondMs(): number {
  return useSim(selectClockSecond) * 1000
}

/** Simulator time in whole minutes × 60,000 (for slow values such as certificate expiry). */
export function useSimMinuteMs(): number {
  return useSim((s) => Math.floor(s.clock.now / 60_000)) * 60_000
}

export function useSignedInOperatorId(): string | null {
  return useSim((s) => selectOperator(s)?.id ?? null)
}

/**
 * Counts escalations of a status, derived during render (R8, M-C-10): each new value replays
 * one halo pulse. Hydration (UNKNOWN →) and de-escalation never pulse.
 */
export function useEscalationCount(state: PostureState): number {
  const [seen, setSeen] = useState({ state, pulses: 0 })
  if (seen.state !== state) {
    const pulses = isEscalation(seen.state, state) ? seen.pulses + 1 : seen.pulses
    setSeen({ state, pulses })
    return pulses
  }
  return seen.pulses
}
