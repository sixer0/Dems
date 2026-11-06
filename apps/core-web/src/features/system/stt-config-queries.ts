/**
 * The Core calls of the Transcription (STT) configuration section (task 3 blueprint row 117; C3 §2.5,
 * operations 90-92). This file is the section's OWN query-factory file (decision D95: row 117 does
 * not edit `lib/core-queries.ts`); it follows that file's rules:
 *
 * | Operation | How | Gate (all must hold) |
 * |-----------|-----|----------------------|
 * | 90 `getSttConfig` (AUTHENTICATED: every role reads) | `sttConfigQueryOptions` under `STT_CONFIG_QUERY_KEY` | Live, signed in (D176), link up (rule 6) |
 * | 91 `updateSttConfig` (`CAPTURE_CONFIG`) | `updateSttConfig` in a `usePendingControl` press; no `useMutation`, so no mutation cache ever holds the body (it may carry the write-only credential) | the control's own gate |
 * | 92 `testSttConnection` (`CAPTURE_CONFIG`) | `testSttConnection` in a press | the control's own gate |
 *
 * - The `queryFn` only reads, through `live.client.call(…)`, and throws an `SttReadError` (status and
 *   code; never the answer's text). The failed call is kept off the enumerable members.
 * - The key is under `CORE_QUERY_ROOT`, so the query bridge removes it with every other Core entry
 *   when a session ends. The answer of operation 90 holds no credential (`credentialSet` and
 *   `credentialKind` only), so nothing secret is ever cached.
 * - No realtime slice carries this configuration (C3 §2.5 "Slice"): it is read again on every entry
 *   of the section and after operation 91.
 */
import { queryOptions, type QueryKey } from '@tanstack/react-query'
import type { SttConfig, SttConfigUpdateRequest, SttConfigUpdateResult, SttConnectionTest } from '@dems/shared/api'
import { LiveLinkState, useLiveLink } from '@dems/shared/live'
import { useCoreSignedIn } from '@/lib/core-queries'
import { CORE_QUERY_ROOT, useWebLive, type WebLive } from '@/runtime'
import type { SttCallFailure } from './stt-config-model'

export const STT_CONFIG_QUERY_KEY = [CORE_QUERY_ROOT, 'stt-config'] as const satisfies QueryKey

/** A failed read of operation 90: status and code, never the answer's text. */
export class SttReadError extends Error {
  override readonly name = 'SttReadError'
  readonly operationId = 'getSttConfig'
  readonly status: number | null
  readonly code: string
  declare readonly failure: SttCallFailure | null
  constructor(failure: SttCallFailure | null) {
    super('A read of the Core (getSttConfig) failed.')
    this.status = failure?.status ?? null
    this.code = failure?.error.code ?? 'NOT_LIVE'
    Object.defineProperty(this, 'failure', { value: failure, enumerable: false, writable: false })
  }
}

export interface SttConfigGate {
  readonly live: WebLive | null
  readonly enabled: boolean
}

/** The gate of operation 90: Live mode, signed in, the link up. */
export function useSttConfigGate(): SttConfigGate {
  const live = useWebLive()
  const signedIn = useCoreSignedIn()
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  return { live, enabled: live !== null && signedIn && linkUp }
}

async function readSttConfig(live: WebLive | null): Promise<SttConfig> {
  if (live === null) throw new SttReadError(null)
  const answer = await live.client.call('getSttConfig')
  if (answer.ok) return answer.data
  throw new SttReadError(answer)
}

/** Operation 90 under `STT_CONFIG_QUERY_KEY`, enabled by its gate; read again at every mount. */
export function sttConfigQueryOptions(gate: SttConfigGate) {
  return queryOptions({
    queryKey: STT_CONFIG_QUERY_KEY,
    enabled: gate.live !== null && gate.enabled,
    queryFn: () => readSttConfig(gate.live),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

/** Operation 91. Rejects with the failed call itself (status, code, details): it never holds the request body. */
export async function updateSttConfig(live: WebLive, body: SttConfigUpdateRequest): Promise<SttConfigUpdateResult> {
  const answer = await live.client.call('updateSttConfig', { body })
  if (!answer.ok) throw answer
  return answer.data
}

/** Operation 92: tests the STORED configuration; no body. */
export async function testSttConnection(live: WebLive): Promise<SttConnectionTest> {
  const answer = await live.client.call('testSttConnection')
  if (!answer.ok) throw answer
  return answer.data
}

/** The failed call of a command, when `error` is one. */
export function sttCallFailureOf(error: unknown): SttCallFailure | null {
  if (typeof error !== 'object' || error === null) return null
  const candidate = error as Partial<SttCallFailure>
  return candidate.ok === false && typeof candidate.error === 'object' && candidate.error !== null ? (candidate as SttCallFailure) : null
}
