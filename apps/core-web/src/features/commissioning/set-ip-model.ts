/**
 * The set-IP screens of the commissioning area: their requests, refusals and form rules (task 4,
 * blueprint row 113, package WP-22c; contract `implementation/102_commissioning_contract.md`,
 * operations 106 `setCameraNetwork` and 107 `getCameraNetworkJob` as built by
 * `implementation/111_set_ip_job.md`; decisions C1, C7, U10; requirement S13-12 (d)).
 *
 * | Export | What it is |
 * |--------|------------|
 * | `startCameraNetworkJob` | Operation 106 in both data modes. ONE request per press; the body is its argument and is kept nowhere |
 * | `readCameraNetworkJob` | Operation 107: the job of this operator session |
 * | `setIpRefusal` | What a refusal of operation 106 is, by status and `details.reason`; pure |
 * | `validateSetIpAddresses`, `setIpBodyOf` | The two optional addresses in the contract's form, and the body through the contract's schema |
 * | `macVerdict` | Whether the two hardware addresses of a job say "the same device" |
 * | `SET_IP_FIELD` | The neutral names and attributes of the two account fields |
 *
 * WHERE THE TYPED CAMERA ACCOUNT IS (the discipline of `features/devices/camera-connect.ts`, whose
 * field rules this file reuses): in the two UNCONTROLLED inputs of the open form - no React state,
 * no form library, no `value` attribute - and in the argument of the one call that sends it. This
 * file keeps neither. A failure it returns holds the status and the codes and, for the presenter,
 * the failed call, which carries the Core's envelope and never the request body. No query, no
 * cache, no log record, no error, no URL, no router state and no browser storage receives it.
 *
 * WHAT THE CORE DOES WITH `fromAddress` (record 111, D-4): it must be an address the LAST scan of
 * this Core listed, so the screen offers an address only from the scan result it holds.
 */
import {
  CAMERA_NETWORK_JOB_ID_PATTERN,
  CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN,
  CameraNetworkSetRequestSchema,
  CaptureCommissioningReason,
  CaptureDiscoveryReason,
  FactoryCameraDeviceCount,
  type CameraNetworkJob,
  type CameraNetworkSetRequest,
  type FactoryCamera,
} from '@dems/shared/api'
import { commissioningRefusal, liveFailure, simAnswer, type CommissioningAnswer, type CommissioningFailure, type CommissioningRefusal, type CommissioningTarget } from './model'

const SET_PATH = '/api/v1/capture/network/cameras/address'
const JOB_PATH = '/api/v1/capture/network/jobs'

/** How often the console asks the Core for a running job. */
export const SET_IP_POLL_MS = 2_000
/** After this many reads in a row that were not answered, the console stops asking by itself: the operator asks. */
export const SET_IP_POLL_MAX_FAILURES = 3

// ── The two account fields ───────────────────────────────────────────────────────────────

/**
 * The attributes of the two account fields: neutral names (nothing a password manager matches to a
 * sign-in form), no autofill of the console's own login, no spell-check service. As the connect
 * dialog of the Devices page (`CONNECT_FIELD`, SEC35-37); names of this form's own.
 */
export const SET_IP_FIELD = {
  username: { name: 'dems-setip-field-a', autoComplete: 'off' },
  password: { name: 'dems-setip-field-b', autoComplete: 'new-password' },
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

// ── The requests ─────────────────────────────────────────────────────────────────────────

/**
 * Operation 106. `body` holds the typed account: it is this function's argument, handed straight to
 * the transport, and referenced by nothing when the call has ended.
 */
export async function startCameraNetworkJob(target: CommissioningTarget, body: CameraNetworkSetRequest): Promise<CommissioningAnswer<CameraNetworkJob>> {
  if (target.live !== null) {
    const answer = await target.live.client.call('setCameraNetwork', { body })
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('setCameraNetwork', answer)
  }
  return simAnswer('setCameraNetwork', target.sim.request({ method: 'POST', path: SET_PATH, body }))
}

/** Operation 107: the job, by its id. The id is the Core's (`CNJ-` and six digits), never a typed text. */
export async function readCameraNetworkJob(target: CommissioningTarget, jobId: string): Promise<CommissioningAnswer<CameraNetworkJob>> {
  if (!CAMERA_NETWORK_JOB_ID_PATTERN.test(jobId)) return { ok: false, operationId: 'getCameraNetworkJob', status: null, code: 'JOB_ID_FORM', reason: null, cause: null, failure: null }
  if (target.live !== null) {
    const answer = await target.live.client.call('getCameraNetworkJob', { params: { id: jobId } })
    return answer.ok ? { ok: true, data: answer.data } : liveFailure('getCameraNetworkJob', answer)
  }
  return simAnswer('getCameraNetworkJob', target.sim.request({ method: 'GET', path: `${JOB_PATH}/${jobId}` }))
}

// ── What a refusal of operation 106 is ───────────────────────────────────────────────────

export type SetIpRefusal =
  /**
   * `409 COMMISSIONING_NOT_AVAILABLE`: this Core cannot run the job - it is not in production
   * capture operation, OR it is and its host does not provide the job's inputs (record 111,
   * section 8). The screen says both, in its own sentence: the contract's sentence names only the
   * first.
   */
  | { readonly kind: 'NOT_AVAILABLE' }
  /** `422 COMMISSIONING_ADDRESS_NOT_ALLOWED`: the present address is none of the last scan, or the new address or the gateway is refused by the Core's rule. */
  | { readonly kind: 'ADDRESS_NOT_ALLOWED' }
  /** `429` of the lock-out guard: too many refused sign-ins on this camera (the guard of the connection test; this operation is its fourth spender). */
  | { readonly kind: 'LOCKOUT_GUARD' }
  /** `429` of the guard's spacing: too soon after the last attempt on this camera. */
  | { readonly kind: 'RATE_LIMITED' }
  /** Every other refusal: as the rest of the commissioning screen names it. */
  | CommissioningRefusal

/** What a refused start of a set-network job is; pure. Before a job exists nothing was sent to the camera. */
export function setIpRefusal(failure: Pick<CommissioningFailure, 'status' | 'code' | 'reason' | 'cause'>): SetIpRefusal {
  if (failure.status === 429 && failure.reason === CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD) return { kind: 'LOCKOUT_GUARD' }
  if (failure.status === 429 && failure.reason === CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED) return { kind: 'RATE_LIMITED' }
  const refusal = commissioningRefusal(failure)
  if (refusal.kind === 'REASON' && refusal.reason === CaptureCommissioningReason.COMMISSIONING_NOT_AVAILABLE) return { kind: 'NOT_AVAILABLE' }
  if (refusal.kind === 'REASON' && refusal.reason === CaptureCommissioningReason.COMMISSIONING_ADDRESS_NOT_ALLOWED) return { kind: 'ADDRESS_NOT_ALLOWED' }
  return refusal
}

// ── The form ─────────────────────────────────────────────────────────────────────────────

/** The two optional addresses, as typed. Not credential material: they may be held as text. */
export interface SetIpAddressValues {
  toAddress: string
  gateway: string
}

export type SetIpAddressMessage = 'form' | 'same'
export interface SetIpAddressErrors {
  toAddress?: SetIpAddressMessage
  gateway?: SetIpAddressMessage
}

/**
 * The checks of the two addresses before a request: each empty or a private IPv4 host address in
 * the contract's form; the new address is not the present one. Whether an address of the right form
 * lies inside the camera subnet and is free is the Core's decision.
 */
export function validateSetIpAddresses(fromAddress: string, values: SetIpAddressValues): SetIpAddressErrors {
  const errors: SetIpAddressErrors = {}
  const to = values.toAddress.trim()
  const gateway = values.gateway.trim()
  if (to !== '' && !CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.test(to)) errors.toAddress = 'form'
  else if (to !== '' && to === fromAddress) errors.toAddress = 'same'
  if (gateway !== '' && !CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN.test(gateway)) errors.gateway = 'form'
  return errors
}

// ── What the scan knew of a row (row V6; cautions R119-03 and R119-04 of the security review of row 119) ──

/** True when the scan COUNTED more than one device at the row's address: no address change is offered there. */
export function scanConflict(camera: Pick<FactoryCamera, 'deviceCount'>): boolean {
  return camera.deviceCount === FactoryCameraDeviceCount.MORE_THAN_ONE
}

/**
 * True when the scan could NOT count the devices at the row's address (today: every scan). The
 * screen then SAYS "not known - connect one factory-address camera at a time"; it is never drawn as
 * "one device", as "no conflict" or as nothing. Anything that is not one of the two counted states
 * is "not known" too: an answer this console does not understand is no assurance.
 */
export function scanCountNotKnown(camera: Pick<FactoryCamera, 'deviceCount'>): boolean {
  return camera.deviceCount !== FactoryCameraDeviceCount.ONE && camera.deviceCount !== FactoryCameraDeviceCount.MORE_THAN_ONE
}

/**
 * The body of operation 106 through the contract's own schema: `fromAddress`, THE HARDWARE ADDRESS
 * OF THE CHOSEN SCAN ROW (`scannedMac`: what the technician saw and confirmed; the Core binds the
 * job to it), the two addresses only when typed, and the account pair. `null`: outside the schema
 * - a row that showed no hardware address among them - and nothing is sent then. The result is
 * returned to the caller's press handler and kept by nothing here.
 */
export function setIpBodyOf(camera: Pick<FactoryCamera, 'address' | 'mac'>, values: SetIpAddressValues, credential: { readonly username: string; readonly secret: string }): CameraNetworkSetRequest | null {
  const to = values.toAddress.trim()
  const gateway = values.gateway.trim()
  if (camera.mac === null) return null
  const parsed = CameraNetworkSetRequestSchema.safeParse({
    fromAddress: camera.address,
    scannedMac: camera.mac,
    ...(to === '' ? {} : { toAddress: to }),
    ...(gateway === '' ? {} : { gateway }),
    credential,
  })
  return parsed.success ? parsed.data : null
}

// ── The job ──────────────────────────────────────────────────────────────────────────────

/**
 * What the two hardware addresses of a job say (requirement S13-12 (d)):
 *   PENDING    one of them is not read yet;
 *   SAME       the address of the host's neighbour table equals the one the camera stated after sign-in;
 *   DIFFERENT  they differ - the Core set nothing.
 */
export type MacVerdict = 'PENDING' | 'SAME' | 'DIFFERENT'

export function macVerdict(job: Pick<CameraNetworkJob, 'neighbourMac' | 'authenticatedMac'>): MacVerdict {
  if (job.neighbourMac === null || job.authenticatedMac === null) return 'PENDING'
  return job.neighbourMac === job.authenticatedMac ? 'SAME' : 'DIFFERENT'
}
