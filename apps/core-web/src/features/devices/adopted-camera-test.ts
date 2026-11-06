/**
 * "Test connection" of an ADOPTED camera: operation 108 `testCaptureDeviceConnection`, its one request,
 * what its answer means and the wording of its refusals (task 4 row W6; decisions C117, C126 (d), C144;
 * request line 526 (2) of `delegation_progress/file_requests.md`). Kept in a `.ts` module so the
 * control's file (`adopted-camera-test-control.tsx`) exports only components.
 *
 * WHY IT EXISTS. Since rows PR and V7 a production camera is assigned only with a STORED stream profile,
 * and the one step that stores them for a camera that is already registered is this test: when the
 * camera holds no stored profile and the test reads its stream, the Core stores what the stream states
 * (`profiles: PROFILES_STORED`) and the device entry carries the list - the selector then offers it
 * without a reload. When profiles ARE stored and the stream now states something else, nothing is
 * stored (`STREAM_PROFILE_DIFFERS`): a stored statement is never silently replaced.
 *
 * NO CREDENTIAL, NO BODY. The contract's operation has no request body at all (`CAPTURE_DEVICE_TEST_SCHEMAS`
 * holds no request schema: "It has no request schema: the operation has no body"): the device is the id in
 * the path, the address is the stored one and the camera password is the one the Core stored when the camera
 * was added - the Core reads it itself. Nothing here builds, holds or sends a credential; the camera password
 * is typed only in the connect dialog of a found camera (operation 95 / 96).
 *
 * | Export | What it is |
 * |--------|------------|
 * | `testAdoptedCamera` | Operation 108 in both data modes; ONE request per press, never repeated by itself |
 * | `adoptedTestResultOf` | What an answer says, first about the stored profiles, then the outcome; pure |
 * | `adoptedTestRefusal` | What a refusal is, by status, code and `details.reason`; pure |
 * | `adoptedTestPath` | The path of operation 108 for a device id |
 */
import {
  CaptureConnectionOutcome,
  CaptureConnectionTestReason,
  CaptureDeviceTestProfiles,
  CaptureDiscoveryReason,
  type CaptureDeviceConnectionTest,
  type CaptureDeviceTestRefusalReason,
} from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import type { Sim } from '@dems/shared/sim'
import type { WebLive } from '@/runtime'

/** The path of operation 108 for `deviceId` (the contract's `CAPTURE_DEVICE_TEST_PATH`). */
export const adoptedTestPath = (deviceId: string): string => `/api/v1/capture/devices/${encodeURIComponent(deviceId)}/test`

/** A refused or unanswered test: the status and the codes, never the answer's text. */
export interface AdoptedTestFailure {
  readonly ok: false
  readonly status: number | null
  readonly code: string
  readonly reason: string | null
  readonly retryAfterSeconds: number | null
  /** The failed Live call (the Core's envelope), for the presenter; `null` in Simulated mode. */
  readonly failure: CoreCallFailure | null
}

export type AdoptedTestAnswer = { readonly ok: true; readonly data: CaptureDeviceConnectionTest } | AdoptedTestFailure

export interface AdoptedTestTarget {
  readonly live: WebLive | null
  readonly sim: Sim
}

const reasonOf = (details: unknown): string | null => {
  const reason = (details as { reason?: unknown } | null | undefined)?.reason
  return typeof reason === 'string' ? reason : null
}

/** Operation 108, once, for the registered camera `deviceId`. No body: nothing is carried. A throw is the caller's to record. */
export async function testAdoptedCamera(target: AdoptedTestTarget, deviceId: string): Promise<AdoptedTestAnswer> {
  if (target.live !== null) {
    const answer = await target.live.client.call('testCaptureDeviceConnection', { params: { id: deviceId } })
    return answer.ok
      ? { ok: true, data: answer.data }
      : { ok: false, status: answer.status, code: answer.error.code, reason: reasonOf(answer.error.details), retryAfterSeconds: answer.retryAfterSeconds, failure: answer }
  }
  const response = target.sim.request({ method: 'POST', path: adoptedTestPath(deviceId) })
  if (response.status >= 200 && response.status < 300) return { ok: true, data: response.body as CaptureDeviceConnectionTest }
  const error = (response.body as { error?: { code?: unknown; details?: unknown } } | null)?.error
  return { ok: false, status: response.status, code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR', reason: reasonOf(error?.details), retryAfterSeconds: null, failure: null }
}

// ── What an answer says ──────────────────────────────────────────────────────────────────

export type AdoptedTestResult =
  /** The test stored the profiles the stream states: the camera can now be assigned. */
  | { readonly kind: 'PROFILES_STORED' }
  /** The stream states other profiles than the stored ones: nothing was stored, the stored statement stands. */
  | { readonly kind: 'STREAM_PROFILE_DIFFERS' }
  /** The camera refused a sign-in method this system does not use: the password was not sent. */
  | { readonly kind: 'SCHEME_NOT_ALLOWED' }
  /** The camera refused the stored password; `attemptsLeft` is the Core's count of refusals left before the guard closes. */
  | { readonly kind: 'PASSWORD_REFUSED'; readonly attemptsLeft: number }
  /** Any other outcome, with nothing to say about the stored profiles. */
  | { readonly kind: 'OUTCOME'; readonly outcome: Exclude<CaptureConnectionOutcome, 'AUTHENTICATION_FAILED'> }

/**
 * What a test answer says; pure. The statement about the STORED profiles comes first: it is what decides
 * whether the camera can be assigned. Without it the outcome is said, and a REACHABLE camera reads that
 * the connection works and that nothing about its profiles was stored (the Core judged no stream, or what
 * it stated agrees with what is stored).
 */
export function adoptedTestResultOf(data: Pick<CaptureDeviceConnectionTest, 'outcome' | 'reason' | 'profiles' | 'failedAttemptsRemaining'>): AdoptedTestResult {
  if (data.profiles === CaptureDeviceTestProfiles.PROFILES_STORED) return { kind: 'PROFILES_STORED' }
  if (data.profiles === CaptureDeviceTestProfiles.STREAM_PROFILE_DIFFERS) return { kind: 'STREAM_PROFILE_DIFFERS' }
  if (data.outcome === CaptureConnectionOutcome.AUTHENTICATION_FAILED) {
    return data.reason === CaptureConnectionTestReason.SCHEME_NOT_ALLOWED ? { kind: 'SCHEME_NOT_ALLOWED' } : { kind: 'PASSWORD_REFUSED', attemptsLeft: data.failedAttemptsRemaining }
  }
  return { kind: 'OUTCOME', outcome: data.outcome }
}

// ── What a refusal is ────────────────────────────────────────────────────────────────────

const REFUSAL_REASONS: readonly string[] = [CaptureDiscoveryReason.CANDIDATE_NOT_TESTABLE, CaptureDiscoveryReason.CREDENTIAL_REQUIRED, CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS]

export type AdoptedTestRefusal =
  /** `409 INVALID_STATE` with one of the three reasons of the contract: its sentence is the contract's (`CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES`). */
  | { readonly kind: 'REASON'; readonly reason: CaptureDeviceTestRefusalReason }
  /** `409 CAPTURE_CONFIG_LOCKED`: a session is open. */
  | { readonly kind: 'LOCKED' }
  /** `404`: the Core has no such registered camera. */
  | { readonly kind: 'NOT_FOUND' }
  /** `503 DISCOVERY_NOT_READY`: this Core has no production camera adapter (its capture is simulated, or it runs with development sources). */
  | { readonly kind: 'NOT_READY' }
  /** `503 CREDENTIAL_STORE_NOT_READY`: the stored password cannot be read now. */
  | { readonly kind: 'STORE_NOT_READY' }
  /** `429 CONNECTION_TEST_LOCKOUT_GUARD`: paused so that the camera does not lock its account. */
  | { readonly kind: 'LOCKOUT_GUARD'; readonly seconds: number | null }
  /** Another `429`. */
  | { readonly kind: 'RATE_LIMITED'; readonly seconds: number | null }
  /** `403`: the role, or not a web console session. */
  | { readonly kind: 'ROLE' }
  /** Anything else (an outage, a time-out, a `422`, another 5xx): the presenter's. */
  | { readonly kind: 'OTHER' }

/** What a refused test is; pure. */
export function adoptedTestRefusal(failure: Pick<AdoptedTestFailure, 'status' | 'code' | 'reason' | 'retryAfterSeconds'>): AdoptedTestRefusal {
  const { status, code, reason, retryAfterSeconds } = failure
  if (status === 409 && code === 'CAPTURE_CONFIG_LOCKED') return { kind: 'LOCKED' }
  if (status === 409 && reason !== null && REFUSAL_REASONS.includes(reason)) return { kind: 'REASON', reason: reason as CaptureDeviceTestRefusalReason }
  if (status === 404) return { kind: 'NOT_FOUND' }
  if (status === 503 && reason === CaptureDiscoveryReason.DISCOVERY_NOT_READY) return { kind: 'NOT_READY' }
  if (status === 503 && reason === CaptureDiscoveryReason.CREDENTIAL_STORE_NOT_READY) return { kind: 'STORE_NOT_READY' }
  if (status === 429) return reason === CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD ? { kind: 'LOCKOUT_GUARD', seconds: retryAfterSeconds } : { kind: 'RATE_LIMITED', seconds: retryAfterSeconds }
  if (status === 403) return { kind: 'ROLE' }
  return { kind: 'OTHER' }
}
