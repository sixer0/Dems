/**
 * THE CORE'S OWN COUNT OF ITEMS WITH / WITHOUT A VERIFICATION OF RECORD (fix wave J, driver J-W;
 * confirmation finding GM-02; `contract_wave_j.md` J-S 9).
 *
 * The tamper tile counted verify ROWS of the audit view (the newest 1,000 rows). As rows rotated out
 * the number of "items without a verify run" grew by itself: 21 stated, 18 in the trail. Operation
 * `getSecurityStatus` now answers `evidenceVerification { sealed, passed, failed, neverVerified }`,
 * counted by the Core over EVERY item by its verification of record. This file reads that member BY
 * NAME; absent (Simulated mode, an older Core) = not stated, and the tile keeps its row-based words.
 */
import { useQuery } from '@tanstack/react-query'
import { verificationOfRecordFailed, hasSealedValues, useSim, type SimState } from '@dems/shared/sim'
import { useCoreSignedIn } from '@/lib/core-queries'
import { CORE_QUERY_ROOT, useWebLive } from '@/runtime'

export interface EvidenceVerificationCounts {
  readonly sealed: number
  readonly passed: number
  readonly failed: number
  readonly neverVerified: number
}

const count = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null)

/** Reads the member from the answer of `getSecurityStatus`. Null: not stated, or the four numbers do not add up. Never throws. */
export function readEvidenceVerification(body: unknown): EvidenceVerificationCounts | null {
  if (typeof body !== 'object' || body === null) return null
  const stated = (body as Record<string, unknown>)['evidenceVerification']
  if (typeof stated !== 'object' || stated === null) return null
  const member = stated as Record<string, unknown>
  const sealed = count(member['sealed'])
  const passed = count(member['passed'])
  const failed = count(member['failed'])
  const neverVerified = count(member['neverVerified'])
  if (sealed === null || passed === null || failed === null || neverVerified === null) return null
  // `passed + failed + neverVerified = sealed` is the member's own rule: an answer that breaks it is not vouched for.
  return passed + failed + neverVerified === sealed ? { sealed, passed, failed, neverVerified } : null
}

/**
 * What changes the Core's count, read from the replicated `evidence` slice as one primitive: the number
 * of sealed items and of stored FAIL / PASS verdicts. A verify run or a new seal moves it, and the
 * query (keyed by it) asks the Core again - the tile never shows a count older than the list beside it.
 */
export function selectEvidenceVerificationStamp(s: Pick<SimState, 'evidence'>): string {
  let sealed = 0
  let failed = 0
  let passed = 0
  for (const item of s.evidence) {
    if (!hasSealedValues(item)) continue
    sealed += 1
    if (verificationOfRecordFailed(item)) failed += 1
    else if (item.verification.status === 'PASS') passed += 1
  }
  return `${sealed}:${passed}:${failed}`
}

/** The Core's count, or null (Simulated mode, signed out, no answer yet, an older Core). */
export function useEvidenceVerificationCounts(wanted = true): EvidenceVerificationCounts | null {
  const live = useWebLive()
  const signedIn = useCoreSignedIn()
  const stamp = useSim(selectEvidenceVerificationStamp)
  const query = useQuery({
    queryKey: [CORE_QUERY_ROOT, 'security-status', 'evidence-verification', stamp],
    // Asked only where the tile reads it (a Core in its own capture): a simulated Core's tile is the bundled DEMO packages'.
    enabled: wanted && live !== null && signedIn,
    staleTime: 0,
    queryFn: async (): Promise<EvidenceVerificationCounts | null> => {
      if (live === null) return null
      const answer = await live.client.call('getSecurityStatus')
      return answer.ok ? readEvidenceVerification(answer.data) : null
    },
    placeholderData: (previous) => previous,
  })
  return live === null || !wanted ? null : (query.data ?? null)
}
