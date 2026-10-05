/**
 * What the Paired Devices page reads and sends in Live mode (backend task 04_client_integration_spec
 * §10.1 PG-6, PG-11; §10.3; rules 1 to 4 of the page rows, `gateway_check/08_cp_web_runtime.md` §8;
 * plan row W81).
 *
 * | Operation | How | Held |
 * |-----------|-----|------|
 * | 16 `getPairingCodeStatus` | `useQuery` | `CORE_QUERY_KEYS.pairingCode`: whether a code is active, who issued it, until when, attempts left. NEVER the code |
 * | 19 `listPairedDevices` | `useQuery` | `CORE_QUERY_KEYS.pairedDevices`, the operation's own `PairedDeviceList` answer: the Devices drawer shares this entry (decision D156 (3)) |
 * | 15 `issuePairingCode` | `issueCode` in a `usePendingControl` press | The answer goes to `code-memory.ts` only: no `useMutation`, so not even the mutation cache sees the code |
 * | 17 `cancelPairingCode` | `cancelCode` in a press | — |
 * | 20 `revokeDevice` | `revokeDevice` in a press | The answer's device is written into the registry entry |
 *
 * Every call goes through `useWebLive().client.call(…)` (rule 1). A failed answer is handed to the
 * refusal presenter first (rule 2): a 403 names the role, an outage and a 429 have their own words
 * (LB-6, LB-10), and only what it leaves goes to the page's own branch. The bridge refetches both
 * reads on `admin.changed` (`DEVICES` → both, `PAIRING_CODE` → the status) and on a resync, and
 * removes them on a session end or a lost permission (PG-6a). The reads are enabled only in Live
 * mode, while an operator is signed in (decision D176), with `PAIRING_MANAGE`, while the link is up
 * (rule 6: the shell says the Core is unreachable).
 */
import { useCallback, useRef } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ActivePairingCode, PairedDevice, PairedDeviceList, PairingCodeIssued } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { LiveLinkState, useCoreMode, useCorePermission, useLiveLink, CoreMode } from '@dems/shared/live'
import { Permission, selectIsSignedIn, useSim } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { CORE_QUERY_KEYS, useWebLive, type WebLive } from '@/runtime'
import { PAIRING_RECORD, reportPairingError } from './report'

/** The permission of the five operations of this page (01_specs §7.7). */
export const PAIRING_PERMISSION = Permission.PAIRING_MANAGE

/** A read of this page failed; the presenter has already worded it. */
export class PairingReadError extends Error {
  override readonly name = 'PairingReadError'
  readonly code: string
  readonly status: number | null
  constructor(code: string, status: number | null) {
    super('A read of the Paired Devices page failed.')
    this.code = code
    this.status = status
  }
}

/** Whether a failure is a 403 refusal of the role (the Forbidden state of §10.1). */
export const isForbidden = (error: unknown): boolean => error instanceof PairingReadError && error.status === 403

export interface PairingReads {
  readonly live: boolean
  readonly enabled: boolean
  readonly status: UseQueryResult<ActivePairingCode, Error>
  readonly devices: UseQueryResult<PairedDeviceList, Error>
}

/**
 * The two reads of the page. A 403 is presented once for both (the presenter never coalesces a
 * refusal of the role, and two toasts for one visit would say the same thing twice); any success
 * re-arms it.
 */
export function usePairingReads(): PairingReads {
  const liveHandle = useWebLive()
  const live = useCoreMode() === CoreMode.LIVE && liveHandle !== null
  const linkUp = useLiveLink() === LiveLinkState.ONLINE
  const canManage = useCorePermission(PAIRING_PERMISSION)
  // Decision D176 (finding F75-2): a read is never sent for a signed-out console, also not by a page
  // that is still on screen while the shell leaves it after a sign-out or a session end.
  const signedIn = useSim(selectIsSignedIn)
  const presentCoreError = useCoreErrorPresenter()
  const forbiddenShown = useRef(false)
  const enabled = live && signedIn && linkUp && canManage

  const presentRead = useCallback(
    (answer: CoreCallFailure, record: string) => {
      if (answer.status === 403) {
        if (forbiddenShown.current) return
        forbiddenShown.current = true
      }
      if (presentCoreError(answer, { permission: PAIRING_PERMISSION }) === null) {
        reportPairingError(`features/paired-devices.${answer.operationId}`, answer, record, { operationId: answer.operationId, code: answer.error.code }, 'warn')
      }
    },
    [presentCoreError],
  )

  const status = useQuery({
    queryKey: CORE_QUERY_KEYS.pairingCode,
    enabled,
    queryFn: async (): Promise<ActivePairingCode> => {
      if (liveHandle === null) throw new PairingReadError('NOT_LIVE', null)
      const answer = await liveHandle.client.call('getPairingCodeStatus')
      if (answer.ok) {
        forbiddenShown.current = false
        return answer.data
      }
      presentRead(answer, PAIRING_RECORD.statusRead)
      throw new PairingReadError(answer.error.code, answer.status)
    },
  })

  const devices = useQuery({
    queryKey: CORE_QUERY_KEYS.pairedDevices,
    enabled,
    queryFn: async (): Promise<PairedDeviceList> => {
      if (liveHandle === null) throw new PairingReadError('NOT_LIVE', null)
      const answer = await liveHandle.client.call('listPairedDevices')
      if (answer.ok) {
        forbiddenShown.current = false
        return answer.data
      }
      presentRead(answer, PAIRING_RECORD.registryRead)
      throw new PairingReadError(answer.error.code, answer.status)
    },
  })

  return { live, enabled, status, devices }
}

/**
 * Operation 15. Resolves with the answer (which holds the code) or rejects with the failed call
 * itself, the presenter's input. The caller hands the answer to `holdCode` and to nothing else.
 */
export async function issueCode(live: WebLive): Promise<PairingCodeIssued> {
  const answer = await live.client.call('issuePairingCode')
  if (!answer.ok) throw answer
  return answer.data
}

/** Operation 17: 204 whether or not a code was active. */
export async function cancelCode(live: WebLive): Promise<void> {
  const answer = await live.client.call('cancelPairingCode')
  if (!answer.ok) throw answer
}

/** Operation 20 with the reason as typed (the Core trims and counts it, F59). */
export async function revokeDevice(live: WebLive, deviceId: string, reason: string): Promise<PairedDevice> {
  const answer = await live.client.call('revokeDevice', { params: { id: deviceId }, body: { reason } })
  if (!answer.ok) throw answer
  return answer.data
}

/** The failed call of a command, when `error` is one (`issueCode` and the others reject with it). */
export function callFailureOf(error: unknown): CoreCallFailure | null {
  if (typeof error !== 'object' || error === null) return null
  const candidate = error as Partial<CoreCallFailure>
  return candidate.ok === false && typeof candidate.error === 'object' && candidate.error !== null ? (candidate as CoreCallFailure) : null
}
