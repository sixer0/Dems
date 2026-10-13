/**
 * The operator-confirmed re-address of a registered camera: its offer, its one request and the
 * wording of its refusals (task 4, blueprint row 198, package WP-12; operation 100
 * `confirmCaptureDeviceAddress`; `implementation/194_readdress_contract.md`,
 * `implementation/197_readdress_wiring.md`). Kept in a `.ts` module so the dialog file exports
 * only components.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `readdressOffer` | Whether a search candidate is a registered camera at another address, and what the dialog then states; pure |
 * | `foundAddressOf` | The address the candidate shows, in the form adoption stores: `host`, or `host:port` |
 * | `confirmDeviceAddress` | Operation 100 in both data modes; sent ONLY by the dialog's explicit answer |
 * | `readdressRefusal` | What a refusal is, by status and `details.reason`; pure |
 * | `useRegisteredCameraAddress` | The address the Core holds for the registered camera (slice 30), for the dialog |
 *
 * NEVER AUTOMATIC. A probe answer is forgeable; following it would send the camera's stored
 * credential to whoever answered. Nothing here sends a request on its own, retries, or confirms a
 * second candidate: one press of the dialog's confirming button is one request.
 *
 * THE ADDRESS IS A CONFIRMATION, NOT A TARGET. The body's `address` is EXACTLY what the dialog
 * drew. The Core takes the new address from its own search state and compares; a list that
 * changed under the dialog confirms nothing (`READDRESS_CONFIRMATION_MISMATCH`).
 */
import { useQuery } from '@tanstack/react-query'
import {
  CAPTURE_CAMERA_DEVICE_ID_PATTERN,
  CAPTURE_DEVICE_CONFIRMED_ADDRESS_PATTERN,
  CaptureDiscoveryReason,
  CaptureReaddressReason,
  type CaptureCandidate,
  type CaptureDeviceAddressConfirmRequest,
} from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { useSim, type Sim } from '@dems/shared/sim'
import { captureDevicesQueryOptions, useCaptureReadGate } from '@/lib/core-queries'
import type { WebLive } from '@/runtime'

/** The path of operation 100. */
export const CAPTURE_READDRESS_PATH = '/api/v1/capture/devices/address/confirm'

/** What the dialog states and, on the operator's answer, sends. */
export interface ReaddressOffer {
  readonly deviceId: string
  readonly candidateId: string
  /** The address the candidate shows: `host`, or `host:port`. Drawn in the dialog and sent as `address`, unchanged. */
  readonly foundAddress: string
}

/**
 * The address a candidate shows, in the form adoption stores (the Core's `adoptionAddressOf`):
 * `host`, or `host:port` when the announced service address names a port that is not the default
 * of its scheme. The candidate of operation 94 carries that address as `connectionTarget` (the
 * port always written); a URL parser drops the default port exactly as the Core's does.
 */
export function foundAddressOf(candidate: Pick<CaptureCandidate, 'host' | 'connectionTarget'>): string {
  if (candidate.connectionTarget === undefined) return candidate.host
  try {
    const { port } = new URL(candidate.connectionTarget)
    return port === '' ? candidate.host : `${candidate.host}:${port}`
  } catch {
    return candidate.host
  }
}

/**
 * The offer of a re-address, or `null`. Offered exactly for a candidate the Core lists as a
 * REGISTERED camera that answers from another address than the stored one, and never for a row in
 * an identity conflict (the Core refuses both addresses) or an address outside the contract's form.
 */
export function readdressOffer(candidate: CaptureCandidate): ReaddressOffer | null {
  if (candidate.status !== 'REGISTERED' || !candidate.addressChanged || candidate.conflict) return null
  if (candidate.deviceId === null || !CAPTURE_CAMERA_DEVICE_ID_PATTERN.test(candidate.deviceId)) return null
  const foundAddress = foundAddressOf(candidate)
  if (!CAPTURE_DEVICE_CONFIRMED_ADDRESS_PATTERN.test(foundAddress)) return null
  return { deviceId: candidate.deviceId, candidateId: candidate.candidateId, foundAddress }
}

/** The body of operation 100 for an offer: the three members, nothing else. */
export function readdressBodyOf(offer: ReaddressOffer): CaptureDeviceAddressConfirmRequest {
  return { deviceId: offer.deviceId, candidateId: offer.candidateId, address: offer.foundAddress }
}

// ── The request ──────────────────────────────────────────────────────────────────────────

/** A refused or unanswered confirmation: the status and the codes, never the answer's text. */
export interface ReaddressFailure {
  readonly ok: false
  readonly status: number | null
  readonly code: string
  readonly reason: string | null
  /** The failed Live call, for the presenter; `null` in Simulated mode. */
  readonly failure: CoreCallFailure | null
}

export type ReaddressAnswer = { readonly ok: true } | ReaddressFailure

export interface ReaddressTarget {
  readonly live: WebLive | null
  readonly sim: Sim
}

const reasonOf = (details: unknown): string | null => {
  const reason = (details as { reason?: unknown } | null | undefined)?.reason
  return typeof reason === 'string' ? reason : null
}

/** Operation 100, once. Resolves with the answer; a throw is the caller's to record. */
export async function confirmDeviceAddress(target: ReaddressTarget, offer: ReaddressOffer): Promise<ReaddressAnswer> {
  const body = readdressBodyOf(offer)
  if (target.live !== null) {
    const answer = await target.live.client.call('confirmCaptureDeviceAddress', { body })
    return answer.ok ? { ok: true } : { ok: false, status: answer.status, code: answer.error.code, reason: reasonOf(answer.error.details), failure: answer }
  }
  const response = target.sim.request({ method: 'POST', path: CAPTURE_READDRESS_PATH, body })
  if (response.status >= 200 && response.status < 300) return { ok: true }
  const error = (response.body as { error?: { code?: unknown; details?: unknown } } | null)?.error
  return { ok: false, status: response.status, code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR', reason: reasonOf(error?.details), failure: null }
}

// ── What a refusal is ────────────────────────────────────────────────────────────────────

const READDRESS_REASONS = Object.values(CaptureReaddressReason) as readonly string[]

export type ReaddressRefusal =
  /** `409 INVALID_STATE` with one of the six reasons of the contract: its sentence is the contract's. */
  | { readonly kind: 'REASON'; readonly reason: CaptureReaddressReason }
  /** `409 CAPTURE_CONFIG_LOCKED`: a session opened meanwhile. */
  | { readonly kind: 'LOCKED' }
  /** `404`: the camera is no longer registered, or the search result is no longer kept (one answer). */
  | { readonly kind: 'RESULT_GONE' }
  /** `422 DISCOVERY_ADDRESS_NOT_ALLOWED`: the Core's destination rule refuses the address (one reason for every rule). */
  | { readonly kind: 'ADDRESS_NOT_ALLOWED' }
  /** `503 DISCOVERY_NOT_READY`: the Core has no camera search now. */
  | { readonly kind: 'SEARCH_NOT_READY' }
  /** `403`: the role, or not a web console session. */
  | { readonly kind: 'ROLE' }
  /** Another `422`: the request was not accepted as written. */
  | { readonly kind: 'INVALID_INPUT' }
  /** Anything else (an outage, a time-out, a 429, another 5xx): the presenter's. */
  | { readonly kind: 'OTHER' }

/** What a refused confirmation is; pure. */
export function readdressRefusal(failure: Pick<ReaddressFailure, 'status' | 'code' | 'reason'>): ReaddressRefusal {
  const { status, code, reason } = failure
  if (status === 409 && code === 'CAPTURE_CONFIG_LOCKED') return { kind: 'LOCKED' }
  if (status === 409 && reason !== null && READDRESS_REASONS.includes(reason)) return { kind: 'REASON', reason: reason as CaptureReaddressReason }
  if (status === 404) return { kind: 'RESULT_GONE' }
  if (status === 422) return reason === CaptureDiscoveryReason.DISCOVERY_ADDRESS_NOT_ALLOWED ? { kind: 'ADDRESS_NOT_ALLOWED' } : { kind: 'INVALID_INPUT' }
  if (status === 503 && reason === CaptureDiscoveryReason.DISCOVERY_NOT_READY) return { kind: 'SEARCH_NOT_READY' }
  if (status === 403) return { kind: 'ROLE' }
  return { kind: 'OTHER' }
}

/**
 * Whether the same confirmation may be pressed again after this refusal. Only a refusal that says
 * nothing about the candidate (the lock, an outage) leaves it; every other one needs a new search.
 */
export function readdressMayRepeat(refusal: ReaddressRefusal): boolean {
  return refusal.kind === 'LOCKED' || refusal.kind === 'OTHER' || refusal.kind === 'SEARCH_NOT_READY'
}

// ── The registered address ───────────────────────────────────────────────────────────────

/**
 * The address the Core holds for a registered camera (`captureDevices`, member `host`), or `null`
 * when the read has no such device or the device has no address the Core shows. Live mode: the
 * gated read of operation 77 (the query the selector fills); Simulated mode: the simulator's slice.
 */
export function useRegisteredCameraAddress(deviceId: string | null): string | null {
  const gate = useCaptureReadGate()
  const query = useQuery(captureDevicesQueryOptions(gate))
  const simulated = useSim((state) => state.captureDevices)
  if (deviceId === null) return null
  const devices = gate.live === null ? simulated.devices : (query.data?.devices ?? [])
  const host = devices.find((device) => device.id === deviceId && device.kind === 'CAMERA')?.host ?? null
  return host === null || host === '' ? null : host
}
