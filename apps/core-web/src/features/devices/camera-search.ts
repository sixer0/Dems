/**
 * The camera search of the web console: its read, its gates and its command (task 3, R-9 / R-10,
 * blueprint row 137; `masterplan/08_client_ux_spec.md` §8c flow 9; `masterplan/03_api_contract.md`
 * §2.6 operations 93 and 94). Kept in a `.ts` module so the panel file exports only components.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `captureDiscoveryQueryOptions` | Operation 94 under its own key (WB-11): the gate is inside the factory, and it polls only while a search is `RUNNING`, once per second |
 * | `searchRead`, `searchPanelState` | The state of the panel (ux §8c.2 S1 to S13), drawn from an answer of operation 93 / 94 and from nothing else |
 * | `searchGate`, `connectGate` | G13 and G14 (ux §8c.6, §8d.9): Checking, then allowed, or refused with its reason |
 * | `searchProgress` | The bar's value from Core instants; it only grows (ux §8c.8) and never decides the end |
 * | `candidateGroups`, `candidateRow`, `makeModelOf` | The list as the Core returned it: never re-sorted, filtered or merged (ux §8c.3) |
 * | `startRefusal` | What a refused search is (S9, S10, S11, S14) |
 * | `useCameraSearch` | The controller in both data modes |
 *
 * This file is the search's OWN query-factory file (decision D95: `lib/core-queries.ts` is another
 * row's; the precedent is `features/system/stt-config-queries.ts`). It follows that file's rules:
 * the `queryFn` only reads and throws an error that carries a status and a code, never the answer's
 * text; a Retry invalidates the key, so the gate holds for a press as it does for a mount.
 *
 * **The list belongs to one operator session.** The Core answers operation 94 for the caller's own
 * search only. The entry lives in the query cache of the signed-in session (the bridge removes every
 * `['core', …]` entry when a session ends), it is in no slice and it is never written to storage.
 * In Simulated mode the key also names the simulator's sign-in, so another operator of the same
 * page never sees a held entry.
 *
 * **No credential here.** Nothing of the connect dialog passes through this file: the key, the
 * entry and the error hold ids, counts, codes and what the devices announced.
 */
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { queryOptions, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED,
  CAPTURE_DISCOVERY_TYPED_ADDRESS_MAX_LENGTH,
  CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN,
  CaptureCandidateStatus,
  CaptureDiscoveryReason,
  CaptureDiscoveryState,
  CaptureSourceClass,
  type CaptureCandidate,
  type CaptureDiscoverySearch,
  type CaptureDiscoveryStateBody,
} from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { LiveLinkState, useCorePermission, useLiveLink } from '@dems/shared/live'
import { hasActiveSession, Permission, selectCan, selectIsRecording, useSim, useSimInstance, type OperatorRole, type Sim } from '@dems/shared/sim'
import { useCoreSignedIn } from '@/lib/core-queries'
import { CORE_QUERY_ROOT, useWebLive, type WebLive } from '@/runtime'
import { rolesHolding } from './capture-selector'
import { reportDevicesError } from './report'

/** The id of the search panel; the System entry and the notifications link to it (`/devices#camera-search`). */
export const CAMERA_SEARCH_ANCHOR = 'camera-search'

/** Operation 94 is polled no faster than this, and only while the search is `RUNNING` (ux §8c.2 S3; C3 §2.6 "Why no slice"). */
export const CAPTURE_DISCOVERY_POLL_MS = 1_000

export const CAPTURE_DISCOVERY_PATH = '/api/v1/capture/discovery'

export type DiscoveryState = CaptureDiscoveryStateBody
export type DiscoverySearch = CaptureDiscoverySearch
export type { CaptureCandidate }

// ── The read (operation 94) ──────────────────────────────────────────────────────────────

/** A failed read of operation 94: the status and the code, never the answer's text. */
export class DiscoveryReadError extends Error {
  override readonly name = 'DiscoveryReadError'
  readonly operationId = 'getCaptureDiscovery'
  readonly status: number | null
  readonly code: string
  declare readonly failure: CoreCallFailure | null
  constructor(status: number | null, code: string, failure: CoreCallFailure | null) {
    super('A read of the Core (getCaptureDiscovery) failed.')
    this.status = status
    this.code = code
    Object.defineProperty(this, 'failure', { value: failure, enumerable: false, writable: false })
  }
}

export interface CaptureDiscoveryGate {
  readonly live: WebLive | null
  readonly sim: Sim
  /** The read may be made: signed in, the link up (Live), and `CAPTURE_CONFIG` held. Without it NO list is requested (S13). */
  readonly enabled: boolean
  /** The role and the link are resolved: a gated control may leave "Checking your permissions…". */
  readonly resolved: boolean
  readonly canConfigure: boolean
  /** Who is signed in, for the key in Simulated mode; a fixed word in Live mode (the bridge empties the cache with the session). */
  readonly owner: string
}

/** The gate of operations 93 and 94 (ux §8c.6): the base gate of every Core read, and `CAPTURE_CONFIG`. */
export function useCaptureDiscoveryGate(): CaptureDiscoveryGate {
  const live = useWebLive()
  const sim = useSimInstance()
  const signedIn = useCoreSignedIn()
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  const coreCan = useCorePermission(Permission.CAPTURE_CONFIG)
  const simCan = useSim((state) => selectCan(state, Permission.CAPTURE_CONFIG))
  const simOwner = useSim((state) => `${state.auth.operatorId ?? 'none'}:${state.auth.issuedAt ?? 0}`)
  const resolved = live === null ? signedIn : signedIn && linkUp
  const canConfigure = live === null ? simCan : coreCan
  return { live, sim, enabled: resolved && canConfigure, resolved, canConfigure, owner: live === null ? simOwner : 'live' }
}

export function captureDiscoveryQueryKey(owner: string): QueryKey {
  return [CORE_QUERY_ROOT, 'capture-discovery', owner]
}

interface SimErrorBody {
  readonly error?: { readonly code?: unknown; readonly details?: unknown }
}

const reasonOf = (details: unknown): string | null => {
  const reason = (details as { reason?: unknown } | null | undefined)?.reason
  return typeof reason === 'string' ? reason : null
}

async function readCaptureDiscovery(gate: Pick<CaptureDiscoveryGate, 'live' | 'sim'>): Promise<DiscoveryState> {
  if (gate.live !== null) {
    const answer = await gate.live.client.call('getCaptureDiscovery')
    if (answer.ok) return answer.data
    throw new DiscoveryReadError(answer.status, answer.error.code, answer)
  }
  // Simulated mode: the simulator's own answer to the same operation (OD-17).
  const response = gate.sim.request({ method: 'GET', path: CAPTURE_DISCOVERY_PATH })
  if (response.status === 200) return response.body as DiscoveryState
  const code = (response.body as SimErrorBody | null)?.error?.code
  throw new DiscoveryReadError(response.status, typeof code === 'string' ? code : 'SIMULATOR_ERROR', null)
}

/**
 * Operation 94 under `captureDiscoveryQueryKey`, enabled by its gate. It is read at every entry of
 * the panel and on focus (that is how an expired result is found: ux §8c.4, a client clock never
 * removes the list), and polled once per second while — and only while — the search is `RUNNING`.
 */
export function captureDiscoveryQueryOptions(gate: Pick<CaptureDiscoveryGate, 'live' | 'sim' | 'enabled' | 'owner'>) {
  return queryOptions({
    queryKey: captureDiscoveryQueryKey(gate.owner),
    enabled: gate.enabled,
    queryFn: () => readCaptureDiscovery(gate),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: false,
    refetchInterval: (query) => (query.state.data?.search?.state === CaptureDiscoveryState.RUNNING ? CAPTURE_DISCOVERY_POLL_MS : false),
  })
}

export type SearchRead =
  /** The role or the link is not resolved (S1). */
  | { readonly kind: 'CHECKING' }
  /** `CAPTURE_CONFIG` is not held, or the Core answered 403 (S13): no list is requested or drawn. */
  | { readonly kind: 'FORBIDDEN' }
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'READY'; readonly state: DiscoveryState }

/** The state of the read; pure. A failure wins over data held from before it. */
export function searchRead(input: {
  readonly resolved: boolean
  readonly canConfigure: boolean
  readonly data: DiscoveryState | undefined
  readonly error: unknown
}): SearchRead {
  if (!input.resolved) return { kind: 'CHECKING' }
  if (!input.canConfigure) return { kind: 'FORBIDDEN' }
  if (input.error != null) return input.error instanceof DiscoveryReadError && input.error.status === 403 ? { kind: 'FORBIDDEN' } : { kind: 'FAILED' }
  if (input.data === undefined) return { kind: 'LOADING' }
  return { kind: 'READY', state: input.data }
}

/** What the panel body is (ux §8c.2). `EXPIRED` is S12: `search: null` after a result was drawn. */
export type SearchPanelState = 'CHECKING' | 'FORBIDDEN' | 'LOADING' | 'READ_FAILED' | 'IDLE' | 'SEARCHING' | 'RESULTS' | 'EMPTY' | 'FAILED' | 'EXPIRED'

export function searchPanelState(read: SearchRead, hadResult: boolean): SearchPanelState {
  switch (read.kind) {
    case 'CHECKING':
      return 'CHECKING'
    case 'FORBIDDEN':
      return 'FORBIDDEN'
    case 'LOADING':
      return 'LOADING'
    case 'FAILED':
      return 'READ_FAILED'
    case 'READY':
      break
  }
  const { search, candidates } = read.state
  if (search === null) return hadResult ? 'EXPIRED' : 'IDLE'
  if (search.state === CaptureDiscoveryState.RUNNING) return 'SEARCHING'
  // "The search could not run" is its own state, never an empty list (ux §8c.2 S8).
  if (search.state === CaptureDiscoveryState.FAILED) return 'FAILED'
  // S6: a list of registered cameras only is a list, not the empty state (R-10 AC-1).
  return search.responderCount === 0 && candidates.length === 0 ? 'EMPTY' : 'RESULTS'
}

// ── The gates ────────────────────────────────────────────────────────────────────────────

/** Why "Search for cameras" / "Search again" (G13) is not offered now; `null` when it is. */
export type SearchBlock =
  | { readonly kind: 'CHECKING' }
  | { readonly kind: 'ROLE'; readonly roles: readonly OperatorRole[] }
  /** S14: the session records and the Core does not search then (before the lift, or its own 409). */
  | { readonly kind: 'RECORDING' }
  /** S11: the Core said when it takes the next search. A fixed number, never a ticking label. */
  | { readonly kind: 'LIMITED'; readonly seconds: number }

/** G13 (ux §8c.6); pure. The role is the lasting reason, so it is said first. */
export function searchGate(input: {
  readonly resolved: boolean
  readonly can: boolean
  readonly recording: boolean
  /** The Core answered `409 DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` during this recording. */
  readonly recordingRefused: boolean
  /** The lift of D86 C-4 (`CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED`). */
  readonly recordingAllowed: boolean
  readonly limitedSeconds: number | null
}): SearchBlock | null {
  if (!input.resolved) return { kind: 'CHECKING' }
  if (!input.can) return { kind: 'ROLE', roles: rolesHolding(Permission.CAPTURE_CONFIG) }
  if (input.recording && (!input.recordingAllowed || input.recordingRefused)) return { kind: 'RECORDING' }
  if (input.limitedSeconds !== null) return { kind: 'LIMITED', seconds: input.limitedSeconds }
  return null
}

/** Why "Connect" (G14) is not offered now; `null` when it is. */
export type ConnectBlock =
  | { readonly kind: 'CHECKING' }
  | { readonly kind: 'ROLE'; readonly roles: readonly OperatorRole[] }
  /** A session is open (`409 CAPTURE_CONFIG_LOCKED`): a disabled, explained state, never a toast (D80(4)). */
  | { readonly kind: 'LOCKED' }

/** G14 (ux §8d.9); pure. */
export function connectGate(input: { readonly resolved: boolean; readonly can: boolean; readonly locked: boolean }): ConnectBlock | null {
  if (!input.resolved) return { kind: 'CHECKING' }
  if (!input.can) return { kind: 'ROLE', roles: rolesHolding(Permission.CAPTURE_CONFIG) }
  if (input.locked) return { kind: 'LOCKED' }
  return null
}

// ── The progress of a running search ─────────────────────────────────────────────────────

/**
 * The bar's value, 0 to 100, from Core instants (`startedAt`, `windowMs`, the Core clock) — never
 * from a client timer. It is clamped and never lower than `previous` (ux §8c.8). At 100 the search
 * is not over: only operation 94 says `COMPLETE` or `FAILED`.
 */
export function searchProgress(search: Pick<DiscoverySearch, 'startedAt' | 'windowMs'>, coreNow: number, previous = 0): number {
  const raw = search.windowMs <= 0 ? 100 : ((coreNow - search.startedAt) / search.windowMs) * 100
  const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0
  return Math.max(previous, clamped)
}

// ── The list ─────────────────────────────────────────────────────────────────────────────

export interface CandidateGroups {
  /** Cameras on the network, in the order operation 94 returned them. */
  readonly network: readonly CaptureCandidate[]
  /** Development sources: their own group, drawn only when it has a row (ux §8c.3). Same order. */
  readonly development: readonly CaptureCandidate[]
}

/** Splits the list into its two groups and changes nothing else: no sort, no filter, no merge. */
export function candidateGroups(candidates: readonly CaptureCandidate[]): CandidateGroups {
  return {
    network: candidates.filter((candidate) => candidate.sourceClass !== CaptureSourceClass.DEVELOPMENT),
    development: candidates.filter((candidate) => candidate.sourceClass === CaptureSourceClass.DEVELOPMENT),
  }
}

/** "{{vendor}} {{model}}": a missing part is left out; `null` when the device announced neither. */
export function makeModelOf(candidate: Pick<CaptureCandidate, 'vendor' | 'model'>): string | null {
  const parts = [candidate.vendor, candidate.model].filter((part): part is string => part !== null && part.length > 0)
  return parts.length === 0 ? null : parts.join(' ')
}

/** What a row is, by the Core's fields alone. */
export type CandidateKind =
  /** `NEW` and testable: Connect is offered (subject to G14). */
  | 'NEW'
  | 'REGISTERED'
  /** Two devices, one identity (D86 SEC35-28): listed, never connectable. */
  | 'CONFLICT'
  /** The announced address is not the device's own (D80(11)): listed, never connectable. */
  | 'NOT_TESTABLE'

export function candidateKind(candidate: Pick<CaptureCandidate, 'status' | 'testable' | 'conflict'>): CandidateKind {
  if (candidate.status === CaptureCandidateStatus.REGISTERED) return 'REGISTERED'
  if (candidate.conflict) return 'CONFLICT'
  if (!candidate.testable) return 'NOT_TESTABLE'
  return 'NEW'
}

/** The name a row and the connect dialog use: the announced name, else the address. */
export function candidateName(candidate: Pick<CaptureCandidate, 'name' | 'host'>): string {
  return candidate.name ?? candidate.host
}

// ── The command (operation 93) ───────────────────────────────────────────────────────────

/** A search that was refused or not answered: the status and the codes, never the answer's text. */
export interface SearchFailure {
  readonly ok: false
  readonly status: number | null
  readonly code: string
  readonly reason: string | null
  readonly retryAfterSeconds: number | null
  /** The failed Live call, for the refusal presenter; `null` in Simulated mode. */
  readonly failure: CoreCallFailure | null
}

export type SearchAnswer = { readonly ok: true; readonly search: DiscoverySearch } | SearchFailure

/**
 * The typed address of operation 93 (task 4, blueprint row 98; contract row 94): ONE dotted IPv4
 * literal, the form the contract's schema holds (`CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN`, at most
 * 15 characters). Returns the literal to send (surrounding blanks are not part of it), or `null`
 * for a text of any other form - a name, a port, a link, an IPv6 text - which is refused in the
 * form and never sent. The form is all a client can judge: whether the Core may ask the address
 * needs the Core's own interfaces (`422 DISCOVERY_ADDRESS_NOT_ALLOWED`).
 */
export function typedAddressOf(text: string): string | null {
  const literal = text.trim()
  return literal.length <= CAPTURE_DISCOVERY_TYPED_ADDRESS_MAX_LENGTH && CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN.test(literal) ? literal : null
}

/** What the panel does with a refused search (ux §8c.2 S9 to S11, S14; row 98: the typed address the Core does not ask); pure. */
export type SearchRefusal = 'UNAVAILABLE' | 'BUSY' | 'LIMITED' | 'RECORDING' | 'ROLE' | 'ADDRESS_NOT_ALLOWED' | 'OTHER'

export function startRefusal(failure: Pick<SearchFailure, 'status' | 'code' | 'reason'>): SearchRefusal {
  if (failure.status === 503) return 'UNAVAILABLE'
  if (failure.status === 429) return 'LIMITED'
  if (failure.status === 422 && failure.reason === CaptureDiscoveryReason.DISCOVERY_ADDRESS_NOT_ALLOWED) return 'ADDRESS_NOT_ALLOWED'
  if (failure.status === 409 && failure.reason === CaptureDiscoveryReason.DISCOVERY_NOT_ALLOWED_WHILE_RECORDING) return 'RECORDING'
  if (failure.status === 409 && failure.reason === CaptureDiscoveryReason.DISCOVERY_IN_PROGRESS) return 'BUSY'
  if (failure.status === 403) return 'ROLE'
  return 'OTHER'
}

/** The inline notice a refused search leaves in the panel until the next search is accepted. */
export type SearchNotice = 'UNAVAILABLE' | 'BUSY' | 'FAILED' | null

const SEARCH_THREW_RECORD = 'A camera search could not be sent.'
const SEARCH_FAILED_RECORD = 'A camera search was not carried out.'

/**
 * One operation 93. Without `address` the request is exactly what it was before row 98: no body.
 * With it the body is the one member `address`, a literal `typedAddressOf` passed.
 */
async function startSearch(gate: Pick<CaptureDiscoveryGate, 'live' | 'sim'>, address: string | null): Promise<SearchAnswer> {
  if (gate.live !== null) {
    const answer = address === null ? await gate.live.client.call('startCaptureDiscovery') : await gate.live.client.call('startCaptureDiscovery', { body: { address } })
    if (answer.ok) return { ok: true, search: answer.data }
    return {
      ok: false,
      status: answer.status,
      code: answer.error.code,
      reason: reasonOf(answer.error.details),
      retryAfterSeconds: answer.retryAfterSeconds,
      failure: answer,
    }
  }
  const response = gate.sim.request(address === null ? { method: 'POST', path: CAPTURE_DISCOVERY_PATH } : { method: 'POST', path: CAPTURE_DISCOVERY_PATH, body: { address } })
  if (response.status === 200 || response.status === 202) return { ok: true, search: response.body as DiscoverySearch }
  const error = (response.body as SimErrorBody | null)?.error
  return {
    ok: false,
    status: response.status,
    code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR',
    reason: reasonOf(error?.details),
    retryAfterSeconds: null,
    failure: null,
  }
}

export interface CameraSearchController {
  readonly read: SearchRead
  readonly panel: SearchPanelState
  /** G13. */
  readonly block: SearchBlock | null
  /** G14, before the row's own state. */
  readonly connectBlock: ConnectBlock | null
  /** A search request is out (the press until the answer of operation 93). */
  readonly starting: boolean
  readonly notice: SearchNotice
  /** The failed call of the last refused search the page must hand to the presenter; consumed by the panel. */
  readonly lastFailure: SearchFailure | null
  /**
   * Starts a search (operation 93). One at a time; resolves when the Core answered. Never rejects.
   * `address` (row 98) is a literal `typedAddressOf` passed; any other text is not sent (`null`).
   */
  readonly start: (address?: string) => Promise<SearchAnswer | null>
  /** Reads operation 94 again (before the connect dialog opens; after a test or an adoption). Respects the gate. */
  readonly refresh: () => Promise<void>
  /** Asks again after a failed read. */
  readonly retryRead: () => void
  readonly gate: CaptureDiscoveryGate
}

/**
 * The search in both data modes. One instance per page (`CameraSearchProvider`): the header action,
 * the panel, the empty state of the selector and the notifications all press the same control.
 * Nothing starts a search but a press: not a mount, not a timer, not a read.
 */
export function useCameraSearch(): CameraSearchController {
  const gate = useCaptureDiscoveryGate()
  const queryClient = useQueryClient()
  const options = captureDiscoveryQueryOptions(gate)
  const query = useQuery(options)
  const recording = useSim(selectIsRecording)
  const sessionOpen = useSim(hasActiveSession)
  const configLocked = useSim((state) => state.captureConfig.locked)
  const [starting, setStarting] = useState(false)
  const inFlight = useRef(false)
  const [notice, setNotice] = useState<SearchNotice>(null)
  const [lastFailure, setLastFailure] = useState<SearchFailure | null>(null)
  const [recordingRefused, setRecordingRefused] = useState(false)
  const [limitedSeconds, setLimitedSeconds] = useState<number | null>(null)
  // S12: whether a result of THIS sign-in was drawn. Kept per key, so another owner starts idle.
  const [seen, setSeen] = useState<{ readonly owner: string; readonly had: boolean }>({ owner: gate.owner, had: false })
  const hadResult = seen.owner === gate.owner && seen.had
  const hasSearch = query.data !== undefined && query.data.search !== null
  if (hasSearch && !hadResult) setSeen({ owner: gate.owner, had: true })
  if (!hasSearch && seen.owner !== gate.owner) setSeen({ owner: gate.owner, had: false })

  // S14 is drawn from the session state: when the recording ends, so does the refusal.
  if (!recording && recordingRefused) setRecordingRefused(false)

  // S11: the button re-enables by itself at the instant the Core named. No label ticks and nothing is sent.
  useEffect(() => {
    if (limitedSeconds === null) return undefined
    const timer = setTimeout(() => setLimitedSeconds(null), limitedSeconds * 1000)
    return () => clearTimeout(timer)
  }, [limitedSeconds])

  const read = useMemo(
    () => searchRead({ resolved: gate.resolved, canConfigure: gate.canConfigure, data: query.data, error: query.error }),
    [gate.resolved, gate.canConfigure, query.data, query.error],
  )
  const panel = searchPanelState(read, hadResult)
  const block = searchGate({
    resolved: gate.resolved,
    can: gate.canConfigure,
    recording,
    recordingRefused,
    recordingAllowed: CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED,
    limitedSeconds,
  })
  const connectBlock = connectGate({ resolved: gate.resolved && read.kind !== 'LOADING', can: gate.canConfigure, locked: sessionOpen || configLocked })

  const queryKey = options.queryKey
  const refresh = useCallback(async () => {
    if (!gate.enabled) return
    await queryClient.invalidateQueries({ queryKey, exact: true })
  }, [gate.enabled, queryClient, queryKey])

  const retryRead = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey, exact: true })
  }, [queryClient, queryKey])

  const start = useCallback(async (address?: string): Promise<SearchAnswer | null> => {
    if (inFlight.current || !gate.enabled) return null
    // Row 98: the form rule holds here too, so no caller can send a text of another form.
    const typed = address === undefined ? null : typedAddressOf(address)
    if (address !== undefined && typed === null) return null
    inFlight.current = true
    setStarting(true)
    try {
      const answer = await startSearch(gate, typed)
      if (answer.ok) {
        setNotice(null)
        setLastFailure(null)
        setSeen({ owner: gate.owner, had: true })
        // The new search replaces the list the moment it is accepted (ux §8c.4): the old rows and their
        // test results are gone. The entry is the Core's own answer, completed by the read that follows.
        queryClient.setQueryData<DiscoveryState>(queryKey, { search: answer.search, candidates: [], truncated: false })
        await queryClient.invalidateQueries({ queryKey, exact: true })
        return answer
      }
      switch (startRefusal(answer)) {
        case 'UNAVAILABLE':
          setNotice('UNAVAILABLE')
          break
        case 'BUSY':
          setNotice('BUSY')
          break
        case 'RECORDING':
          setRecordingRefused(true)
          break
        case 'LIMITED':
          setLimitedSeconds(Math.max(1, answer.retryAfterSeconds ?? 1))
          break
        case 'ROLE':
          break
        case 'ADDRESS_NOT_ALLOWED':
          // Worded in the typed-address form, beside the field it is about; the list and its notices stay as they are.
          break
        case 'OTHER':
          setNotice('FAILED')
          reportDevicesError('features/devices.cameraSearch', null, SEARCH_FAILED_RECORD, { operationId: 'startCaptureDiscovery', status: answer.status, code: answer.code }, 'warn')
          break
      }
      setLastFailure(answer)
      return answer
    } catch (error) {
      reportDevicesError('features/devices.cameraSearch', error, SEARCH_THREW_RECORD, { operationId: 'startCaptureDiscovery' })
      setNotice('FAILED')
      return null
    } finally {
      inFlight.current = false
      setStarting(false)
    }
  }, [gate, queryClient, queryKey])

  return { read, panel, block, connectBlock, starting, notice, lastFailure, start, refresh, retryRead, gate }
}

// ── One search per page ──────────────────────────────────────────────────────────────────

/** Filled by `CameraSearchProvider` (`camera-search-context.tsx`). */
export const CameraSearchContext = createContext<CameraSearchController | null>(null)

export function useCameraSearchController(): CameraSearchController {
  const controller = use(CameraSearchContext)
  if (controller === null) throw new Error('useCameraSearchController needs a CameraSearchProvider above it.')
  return controller
}

/** Every block a gated control of flows 9, 10 and 13 can have (G13, G14, G17). */
export type GateBlock = SearchBlock | ConnectBlock

/** The sentence beside a blocked gated control of the search (ux §8c.6, §8d.9; §14.3: visible text, never a tooltip only). */
export function useGateReason(): (block: GateBlock | null) => string | null {
  const { t } = useTranslation()
  return (block) => {
    if (block === null) return null
    switch (block.kind) {
      case 'CHECKING':
        return t('devices.selector.checking')
      case 'ROLE':
        return t('common.rbac.requiresRole', { role: block.roles.map((role) => t(`common.roles.${role}`).toUpperCase()).join(` ${t('devices.selector.rolesJoin')} `) })
      case 'RECORDING':
        return t('common.captureSearch.recordingLocked')
      case 'LIMITED':
        // S11: the Core's own number, written once. It does not tick and nothing is sent when it ends.
        return t('common.coreErrors.limited', { seconds: block.seconds })
      case 'LOCKED':
        return t('common.captureConnect.locked')
    }
  }
}
