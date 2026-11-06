/**
 * The connect flow of a found camera, web console only: its form rules, its commands and what each
 * answer means (task 3, R-9, blueprint row 137; `masterplan/08_client_ux_spec.md` §8d flow 10;
 * `masterplan/03_api_contract.md` §2.6 operations 95 and 96; `masterplan/09_security_design_review.md`
 * §11 SEC35-31, SEC35-37; decisions D80(3), D80(4), D86 C-1 / C-2, D117).
 *
 * | Export | What it is |
 * |--------|------------|
 * | `CONNECT_FIELD` | The neutral names and the attributes that keep a browser from filling the console's own login into the camera fields |
 * | `validateConnectForm` | The checks made before any request. Its result names a field and a message key — it never holds a typed character |
 * | `credentialOf` | The request member, built at the press and handed straight to the call |
 * | `testCandidateConnection`, `adoptCandidate` | Operations 95 and 96 in both data modes. One request per press; nothing here repeats one |
 * | `connectRefusal` | Which explained state of ux §8d.5 a refusal is |
 * | `OUTCOME_TONE`, `outcomeRole` | How each of the five outcomes is drawn (ux §8d.4). A failed test is a result, not an error |
 *
 * **Where the typed user name and password are.** In the two uncontrolled inputs of the open dialog
 * (no form library, no React state, no `value` attribute: fix F-M4, finding R69-04), and in the
 * arguments of the one call that sends them. This file keeps neither: a failure it returns holds the
 * status, the codes and (for the presenter) the failed call, which carries the Core's envelope and
 * never the request body. No query, no mutation cache, no log record, no error and no URL ever
 * receives them (ux §8d.3 "Where the typed values live"). The password is sent exactly as typed:
 * it is never trimmed or altered (D117).
 */
import {
  CAPTURE_CREDENTIAL_SECRET_MAX_LENGTH,
  CAPTURE_CREDENTIAL_SECRET_PATTERN,
  CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH,
  CAPTURE_CREDENTIAL_USERNAME_PATTERN,
  CaptureConnectionOutcome,
  CaptureConnectionTestReason,
  CaptureDiscoveryReason,
  type CaptureCandidateAdoption,
  type CaptureConnectionTest,
} from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import type { Sim } from '@dems/shared/sim'
import type { WebLive } from '@/runtime'
import { CAPTURE_DISCOVERY_PATH } from './camera-search'

// ── The two fields ───────────────────────────────────────────────────────────────────────

/**
 * SEC35-37 (a, b): the attributes of the two fields. The names are neutral on purpose — nothing a
 * password manager matches to a sign-in form — and there is no native form submission. No attribute
 * is a guarantee: the operator declines an offer to save.
 */
export const CONNECT_FIELD = {
  username: {
    name: 'dems-camera-field-a',
    autoComplete: 'off',
  },
  password: {
    name: 'dems-camera-field-b',
    autoComplete: 'new-password',
  },
  /** On both inputs: no spell-check service, no capitalisation, no correction, and the ignore hints of the common password managers. */
  input: {
    spellCheck: false,
    autoCapitalize: 'off',
    autoCorrect: 'off',
    'data-1p-ignore': 'true',
    'data-lpignore': 'true',
    'data-bwignore': 'true',
    'data-form-type': 'other',
  },
} as const

export interface ConnectFormValues {
  username: string
  password: string
}

/** A message key under `common.captureConnect`: what is wrong with a field. Never the field's text. */
export type ConnectFieldMessage = 'required' | 'charset'

export interface ConnectFormErrors {
  username?: ConnectFieldMessage
  password?: ConnectFieldMessage
}

/**
 * The checks before a request (ux §8d.3 "Validation"; C3 §2.6 op 95: printable ASCII, 1 to 120 and
 * 1 to 1024). The password is checked as typed: leading and trailing spaces are part of it (D117).
 * A user name that is only spaces is empty (the Core trims it).
 */
export function validateConnectForm(values: ConnectFormValues): ConnectFormErrors {
  const errors: ConnectFormErrors = {}
  const username = values.username.trim()
  if (username.length === 0) errors.username = 'required'
  else if (username.length > CAPTURE_CREDENTIAL_USERNAME_MAX_LENGTH || !CAPTURE_CREDENTIAL_USERNAME_PATTERN.test(username)) errors.username = 'charset'
  if (values.password.length === 0) errors.password = 'required'
  else if (values.password.length > CAPTURE_CREDENTIAL_SECRET_MAX_LENGTH || !CAPTURE_CREDENTIAL_SECRET_PATTERN.test(values.password)) errors.password = 'charset'
  return errors
}

export const hasConnectErrors = (errors: ConnectFormErrors): boolean => errors.username !== undefined || errors.password !== undefined

/** The write-only pair of operations 95 and 96. */
export interface ConnectCredential {
  readonly username: string
  readonly secret: string
}

/** The request member for these values. The password is the typed text, unchanged (D117). */
export function credentialOf(values: ConnectFormValues): ConnectCredential {
  return { username: values.username.trim(), secret: values.password }
}

// ── The commands ─────────────────────────────────────────────────────────────────────────

export type ConnectOperation = 'testCaptureCandidateConnection' | 'adoptCaptureCandidate'

/** A refused or unanswered request: the status and the codes. It never holds the request. */
export interface ConnectFailure {
  readonly ok: false
  readonly operationId: ConnectOperation
  readonly status: number | null
  readonly code: string
  readonly reason: string | null
  /** `details.deviceId` of `CANDIDATE_ALREADY_REGISTERED`, when it is a device id. */
  readonly deviceId: string | null
  /** `details.outcome` of `CONNECTION_TEST_FAILED`, when it is one of the five. */
  readonly outcome: CaptureConnectionOutcome | null
  readonly retryAfterSeconds: number | null
  /** The failed Live call (the Core's envelope; never the request body), for the presenter; `null` in Simulated mode. */
  readonly failure: CoreCallFailure | null
}

export type ConnectAnswer<T> = { readonly ok: true; readonly data: T } | ConnectFailure

export interface ConnectTarget {
  readonly live: WebLive | null
  readonly sim: Sim
}

const OUTCOMES = Object.values(CaptureConnectionOutcome) as readonly string[]
const DEVICE_ID = /^[A-Z][A-Z0-9-]{1,31}$/

function detailsOf(details: unknown): Pick<ConnectFailure, 'reason' | 'deviceId' | 'outcome'> {
  const record = (typeof details === 'object' && details !== null ? details : {}) as { reason?: unknown; deviceId?: unknown; outcome?: unknown }
  return {
    reason: typeof record.reason === 'string' ? record.reason : null,
    deviceId: typeof record.deviceId === 'string' && DEVICE_ID.test(record.deviceId) ? record.deviceId : null,
    outcome: typeof record.outcome === 'string' && OUTCOMES.includes(record.outcome) ? (record.outcome as CaptureConnectionOutcome) : null,
  }
}

function liveFailure(operationId: ConnectOperation, answer: CoreCallFailure): ConnectFailure {
  return { ok: false, operationId, status: answer.status, code: answer.error.code, ...detailsOf(answer.error.details), retryAfterSeconds: answer.retryAfterSeconds, failure: answer }
}

function simAnswer<T>(operationId: ConnectOperation, response: { readonly status: number; readonly body: unknown }): ConnectAnswer<T> {
  if (response.status >= 200 && response.status < 300) return { ok: true, data: response.body as T }
  const error = (response.body as { error?: { code?: unknown; details?: unknown } } | null)?.error
  return {
    ok: false,
    operationId,
    status: response.status,
    code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR',
    ...detailsOf(error?.details),
    retryAfterSeconds: null,
    failure: null,
  }
}

const candidatePath = (candidateId: string, step: 'test' | 'adopt'): string => `${CAPTURE_DISCOVERY_PATH}/candidates/${encodeURIComponent(candidateId)}/${step}`
const bodyOf = (credential: ConnectCredential | null): { credential?: ConnectCredential } => (credential === null ? {} : { credential })

/**
 * Operation 95: ONE read-only test of the candidate. `credential` is `null` for a development source
 * tested without one. Nothing here retries; a failed test is an answer with an outcome.
 */
export async function testCandidateConnection(target: ConnectTarget, candidateId: string, credential: ConnectCredential | null): Promise<ConnectAnswer<CaptureConnectionTest>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('testCaptureCandidateConnection', { params: { id: candidateId }, body: bodyOf(credential) })
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('testCaptureCandidateConnection', answer)
  }
  return simAnswer('testCaptureCandidateConnection', target.sim.request({ method: 'POST', path: candidatePath(candidateId, 'test'), body: bodyOf(credential) }))
}

/** Operation 96: registers the camera. The credential is exactly the one that was tested. */
export async function adoptCandidate(target: ConnectTarget, candidateId: string, credential: ConnectCredential | null): Promise<ConnectAnswer<CaptureCandidateAdoption>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('adoptCaptureCandidate', { params: { id: candidateId }, body: bodyOf(credential) })
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('adoptCaptureCandidate', answer)
  }
  return simAnswer('adoptCaptureCandidate', target.sim.request({ method: 'POST', path: candidatePath(candidateId, 'adopt'), body: bodyOf(credential) }))
}

// ── What a refusal is (ux §8d.5) ─────────────────────────────────────────────────────────

export type ConnectRefusal =
  /** `409 CAPTURE_CONFIG_LOCKED`: a session opened meanwhile. An explained state, never a toast. */
  | 'LOCKED'
  /** `404`: the result is no longer kept (unknown, expired or another session's id — one answer). */
  | 'RESULT_GONE'
  | 'ALREADY_REGISTERED'
  | 'NOT_TESTABLE'
  | 'IN_PROGRESS'
  /** On Add: no fresh passing test. */
  | 'NOT_TESTED'
  /** On Add: the re-verification did not pass (`outcome` says how). */
  | 'FINAL_CHECK_FAILED'
  /** `503 CREDENTIAL_STORE_NOT_READY`: the state before blueprint row 84. */
  | 'STORE_NOT_READY'
  | 'SEARCH_NOT_READY'
  /** `429 CONNECTION_TEST_LOCKOUT_GUARD`: paused so that the camera does not lock its account. */
  | 'LOCKOUT_GUARD'
  | 'RATE_LIMITED'
  | 'CREDENTIAL_REQUIRED'
  | 'INVALID_INPUT'
  | 'ROLE'
  | 'OTHER'

export function connectRefusal(failure: Pick<ConnectFailure, 'status' | 'code' | 'reason'>): ConnectRefusal {
  const { status, code, reason } = failure
  if (status === 409 && code === 'CAPTURE_CONFIG_LOCKED') return 'LOCKED'
  if (status === 404) return 'RESULT_GONE'
  if (status === 409) {
    if (reason === CaptureDiscoveryReason.CANDIDATE_ALREADY_REGISTERED) return 'ALREADY_REGISTERED'
    if (reason === CaptureDiscoveryReason.CANDIDATE_NOT_TESTABLE) return 'NOT_TESTABLE'
    if (reason === CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS) return 'IN_PROGRESS'
    if (reason === CaptureDiscoveryReason.CANDIDATE_NOT_TESTED) return 'NOT_TESTED'
    if (reason === CaptureDiscoveryReason.CONNECTION_TEST_FAILED) return 'FINAL_CHECK_FAILED'
    return 'OTHER'
  }
  if (status === 503) {
    if (reason === CaptureDiscoveryReason.CREDENTIAL_STORE_NOT_READY) return 'STORE_NOT_READY'
    if (reason === CaptureDiscoveryReason.DISCOVERY_NOT_READY) return 'SEARCH_NOT_READY'
    return 'OTHER'
  }
  if (status === 429) return reason === CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD ? 'LOCKOUT_GUARD' : 'RATE_LIMITED'
  if (status === 422) return reason === CaptureDiscoveryReason.CREDENTIAL_REQUIRED ? 'CREDENTIAL_REQUIRED' : 'INVALID_INPUT'
  if (status === 403) return 'ROLE'
  return 'OTHER'
}

// ── How an outcome is drawn (ux §8d.4) ───────────────────────────────────────────────────

export type OutcomeTone = 'success' | 'warning' | 'danger'

export const OUTCOME_TONE: Readonly<Record<CaptureConnectionOutcome, OutcomeTone>> = {
  REACHABLE: 'success',
  UNREACHABLE: 'warning',
  AUTHENTICATION_FAILED: 'danger',
  WRONG_PROFILE: 'warning',
  NOT_H264: 'warning',
}

/**
 * HOW THE RESULT OF A CONNECTION TEST IS WORDED (fix wave I, driver B; findings G70b-02, G70b-05;
 * ruling of driver A2, `contract_wave_i_a2.md` sections 1 and 2). An AUTHENTICATION_FAILED answer is
 * one of three different facts, and only one of them is a refused credential:
 *
 *   SCHEME_NOT_ALLOWED   `reason: SCHEME_NOT_ALLOWED` - the camera wants a sign-in method this
 *                        system does not answer; nothing was sent (R69-13)
 *   NO_CREDENTIAL_SENT   `authenticated: false` - the test carried no credential and the camera
 *                        asks for one; never "refused this user name or password"
 *   CREDENTIAL_REFUSED   a credential was sent and refused
 *
 * `showAttempts`: the remaining-attempts line. The Core's guard counts REJECTED CREDENTIAL-BEARING
 * requests only (erratum PE-FM4-03), and `failedAttemptsRemaining` is a required member the Core
 * sends with every answer, so the line is drawn for CREDENTIAL_REFUSED alone: beside the other two
 * nothing was counted. Every other outcome is `OUTCOME` (its own message).
 */
export type ConnectionTestWordingKind = 'OUTCOME' | 'SCHEME_NOT_ALLOWED' | 'NO_CREDENTIAL_SENT' | 'CREDENTIAL_REFUSED'

export function connectionTestWording(result: Pick<CaptureConnectionTest, 'outcome' | 'authenticated' | 'reason'>): { kind: ConnectionTestWordingKind; showAttempts: boolean } {
  if (result.outcome !== CaptureConnectionOutcome.AUTHENTICATION_FAILED) return { kind: 'OUTCOME', showAttempts: false }
  if (result.reason === CaptureConnectionTestReason.SCHEME_NOT_ALLOWED) return { kind: 'SCHEME_NOT_ALLOWED', showAttempts: false }
  if (result.authenticated === false) return { kind: 'NO_CREDENTIAL_SENT', showAttempts: false }
  return { kind: 'CREDENTIAL_REFUSED', showAttempts: result.reason === undefined }
}

/** ux §14.3: the outcome is `role="status"` when the camera can be added and `role="alert"` otherwise. */
export const outcomeRole = (outcome: CaptureConnectionOutcome): 'status' | 'alert' => (outcome === CaptureConnectionOutcome.REACHABLE ? 'status' : 'alert')
