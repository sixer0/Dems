/**
 * "Search again" for microphones, and the states of a local device (task 3, R-10 AC-2 / R-11 AC-5,
 * blueprint row 137; `masterplan/08_client_ux_spec.md` §8g flow 13, §8f.3;
 * `masterplan/03_api_contract.md` §2.6 operation 97; decision D80(5)). Kept in a `.ts` module so the
 * component file exports only components.
 *
 * Operation 97 is ONE request and ONE answer: a re-read of the microphones connected to the Core.
 * It is no network search, lists nothing to connect and takes no password — microphones are local
 * inputs. Nothing here polls, retries or re-reads by itself.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `rescanGate` | G17 (ux §8g.4): Checking, then allowed, or refused with its reason |
 * | `rescanRefusal` | What a refused re-read is (`429`, `503`, `403`) |
 * | `localDeviceState`, `LOCAL_STATE_VIEW` | The row state of a device from the Core's named cause (ux §8f.3). The row keeps its name and its badge in every state: a local device that cannot be opened is never shown as another source (D80(11)) |
 * | `useMicRescan` | The control in both data modes; one per page |
 */
import { createContext, use, useCallback, useEffect, useRef, useState } from 'react'
import { CaptureDiscoveryReason, CaptureInputErrorCode, type CaptureInputScan, type CaptureInputScanEntry } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { Permission, type OperatorRole } from '@dems/shared/sim'
import { useCaptureDiscoveryGate, type CaptureDiscoveryGate } from './camera-search'
import { rolesHolding } from './capture-selector'
import { reportDevicesError } from './report'

export const CAPTURE_INPUT_RESCAN_PATH = '/api/v1/capture/inputs/rescan'

export type { CaptureInputScan, CaptureInputScanEntry }

// ── The gate (G17) ───────────────────────────────────────────────────────────────────────

export type RescanBlock =
  | { readonly kind: 'CHECKING' }
  | { readonly kind: 'ROLE'; readonly roles: readonly OperatorRole[] }
  /** `429 INPUT_RESCAN_RATE_LIMITED`: the Core's own number of seconds; the control re-enables by itself. */
  | { readonly kind: 'LIMITED'; readonly seconds: number }

export function rescanGate(input: { readonly resolved: boolean; readonly can: boolean; readonly limitedSeconds: number | null }): RescanBlock | null {
  if (!input.resolved) return { kind: 'CHECKING' }
  if (!input.can) return { kind: 'ROLE', roles: rolesHolding(Permission.CAPTURE_CONFIG) }
  if (input.limitedSeconds !== null) return { kind: 'LIMITED', seconds: input.limitedSeconds }
  return null
}

// ── The command (operation 97) ───────────────────────────────────────────────────────────

export interface RescanFailure {
  readonly ok: false
  readonly status: number | null
  readonly code: string
  readonly reason: string | null
  readonly retryAfterSeconds: number | null
  readonly failure: CoreCallFailure | null
}

export type RescanAnswer = { readonly ok: true; readonly scan: CaptureInputScan } | RescanFailure

export type RescanRefusal = 'LIMITED' | 'NOT_READY' | 'ROLE' | 'OTHER'

export function rescanRefusal(failure: Pick<RescanFailure, 'status' | 'reason'>): RescanRefusal {
  if (failure.status === 429) return 'LIMITED'
  if (failure.status === 503 && (failure.reason === null || failure.reason === CaptureDiscoveryReason.CAPTURE_NOT_READY)) return 'NOT_READY'
  if (failure.status === 403) return 'ROLE'
  return 'OTHER'
}

const reasonOf = (details: unknown): string | null => {
  const reason = (details as { reason?: unknown } | null | undefined)?.reason
  return typeof reason === 'string' ? reason : null
}

async function rescanInputs(gate: Pick<CaptureDiscoveryGate, 'live' | 'sim'>): Promise<RescanAnswer> {
  if (gate.live !== null) {
    const answer = await gate.live.client.call('rescanCaptureInputs')
    if (answer.ok) return { ok: true, scan: answer.data }
    return { ok: false, status: answer.status, code: answer.error.code, reason: reasonOf(answer.error.details), retryAfterSeconds: answer.retryAfterSeconds, failure: answer }
  }
  const response = gate.sim.request({ method: 'POST', path: CAPTURE_INPUT_RESCAN_PATH })
  if (response.status === 200) return { ok: true, scan: response.body as CaptureInputScan }
  const error = (response.body as { error?: { code?: unknown; details?: unknown } } | null)?.error
  return { ok: false, status: response.status, code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR', reason: reasonOf(error?.details), retryAfterSeconds: null, failure: null }
}

// ── The state of a device row (ux §8f.3) ─────────────────────────────────────────────────

export type LocalDeviceState =
  | 'READY'
  | 'PERMISSION_DENIED'
  | 'DEVICE_BUSY'
  | 'DEVICE_NOT_FOUND'
  /** `OPEN_FAILED` or `HELPER_EXITED`. */
  | 'OPEN_FAILED'
  /** Not present, and the Core named no cause (a device that is not a local one). */
  | 'NOT_REACHABLE'

/** The row state from what the Core found: `present` and the named cause. A cause wins over `present`. */
export function localDeviceState(found: { readonly present: boolean; readonly errorCode: string | null }): LocalDeviceState {
  switch (found.errorCode) {
    case CaptureInputErrorCode.PERMISSION_DENIED:
      return 'PERMISSION_DENIED'
    case CaptureInputErrorCode.DEVICE_BUSY:
      return 'DEVICE_BUSY'
    case CaptureInputErrorCode.DEVICE_NOT_FOUND:
      return 'DEVICE_NOT_FOUND'
    case CaptureInputErrorCode.OPEN_FAILED:
    case CaptureInputErrorCode.HELPER_EXITED:
      return 'OPEN_FAILED'
    default:
      return found.present ? 'READY' : 'NOT_REACHABLE'
  }
}

export type LocalStateTone = 'success' | 'warning' | 'danger'

/** The chip and the sentence of each state. `{kind}` is `Camera` or `Microphone` in the key. */
export const LOCAL_STATE_VIEW = {
  READY: { tone: 'success', chip: 'common.localDevice.state.READY', sentence: null },
  PERMISSION_DENIED: { tone: 'warning', chip: 'common.localDevice.state.PERMISSION_DENIED', sentence: 'permission' },
  DEVICE_BUSY: { tone: 'warning', chip: 'common.localDevice.state.DEVICE_BUSY', sentence: 'busy' },
  DEVICE_NOT_FOUND: { tone: 'danger', chip: 'common.localDevice.state.DEVICE_NOT_FOUND', sentence: 'notFound' },
  OPEN_FAILED: { tone: 'warning', chip: 'common.localDevice.openFailed.chip', sentence: 'openFailed' },
  NOT_REACHABLE: { tone: 'warning', chip: 'devices.search.notReachable', sentence: null },
} as const satisfies Record<LocalDeviceState, { tone: LocalStateTone; chip: string; sentence: 'permission' | 'busy' | 'notFound' | 'openFailed' | null }>

type SentenceKey =
  | 'common.localDevice.permissionCamera'
  | 'common.localDevice.permissionMicrophone'
  | 'common.localDevice.busyCamera'
  | 'common.localDevice.busyMicrophone'
  | 'common.localDevice.notFoundCamera'
  | 'common.localDevice.notFoundMicrophone'
  | 'common.localDevice.openFailed.camera'
  | 'common.localDevice.openFailed.microphone'

/** The text key of the sentence of a state for a camera or a microphone; `null` when the state has none. */
export function localStateSentenceKey(state: LocalDeviceState, kind: 'CAMERA' | 'MIC'): SentenceKey | null {
  const camera = kind === 'CAMERA'
  switch (LOCAL_STATE_VIEW[state].sentence) {
    case 'permission':
      return camera ? 'common.localDevice.permissionCamera' : 'common.localDevice.permissionMicrophone'
    case 'busy':
      return camera ? 'common.localDevice.busyCamera' : 'common.localDevice.busyMicrophone'
    case 'notFound':
      return camera ? 'common.localDevice.notFoundCamera' : 'common.localDevice.notFoundMicrophone'
    case 'openFailed':
      return camera ? 'common.localDevice.openFailed.camera' : 'common.localDevice.openFailed.microphone'
    case null:
      return null
  }
}

// ── The control ──────────────────────────────────────────────────────────────────────────

/** The inline notice a refused re-read leaves until the next one is accepted. */
export type RescanNotice = 'NOT_READY' | 'FAILED' | null

export interface MicRescanController {
  readonly block: RescanBlock | null
  /** The request is out (the press until the answer). No progress bar, no polling. */
  readonly busy: boolean
  /** The last answer of this page; `null` before the first. */
  readonly scan: CaptureInputScan | null
  readonly notice: RescanNotice
  /** One operation 97. One at a time; resolves with the answer; never rejects. */
  readonly run: () => Promise<RescanAnswer | null>
}

const RESCAN_THREW_RECORD = 'A re-read of the microphone inputs could not be sent.'
const RESCAN_FAILED_RECORD = 'A re-read of the microphone inputs was not carried out.'

export function useMicRescan(): MicRescanController {
  const gate = useCaptureDiscoveryGate()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [scan, setScan] = useState<CaptureInputScan | null>(null)
  const [notice, setNotice] = useState<RescanNotice>(null)
  const [limitedSeconds, setLimitedSeconds] = useState<number | null>(null)

  // ux §8g.1 state 6: the control re-enables by itself at the instant the Core named. Nothing is sent then.
  useEffect(() => {
    if (limitedSeconds === null) return undefined
    const timer = setTimeout(() => setLimitedSeconds(null), limitedSeconds * 1000)
    return () => clearTimeout(timer)
  }, [limitedSeconds])

  const block = rescanGate({ resolved: gate.resolved, can: gate.canConfigure, limitedSeconds })

  const run = useCallback(async (): Promise<RescanAnswer | null> => {
    if (inFlight.current || !gate.enabled) return null
    inFlight.current = true
    setBusy(true)
    try {
      const answer = await rescanInputs(gate)
      if (answer.ok) {
        setNotice(null)
        setScan(answer.scan)
        return answer
      }
      switch (rescanRefusal(answer)) {
        case 'LIMITED':
          setLimitedSeconds(Math.max(1, answer.retryAfterSeconds ?? 1))
          break
        case 'NOT_READY':
          setNotice('NOT_READY')
          break
        case 'ROLE':
          break
        case 'OTHER':
          setNotice('FAILED')
          reportDevicesError('features/devices.micRescan', null, RESCAN_FAILED_RECORD, { operationId: 'rescanCaptureInputs', status: answer.status, code: answer.code }, 'warn')
          break
      }
      return answer
    } catch (error) {
      reportDevicesError('features/devices.micRescan', error, RESCAN_THREW_RECORD, { operationId: 'rescanCaptureInputs' })
      setNotice('FAILED')
      return null
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [gate])

  return { block, busy, scan, notice, run }
}

/** Filled by `CameraSearchProvider` (`camera-search-context.tsx`): one microphone re-read control per page. */
export const MicRescanContext = createContext<MicRescanController | null>(null)

export function useMicRescanController(): MicRescanController {
  const controller = use(MicRescanContext)
  if (controller === null) throw new Error('useMicRescanController needs a CameraSearchProvider above it.')
  return controller
}
