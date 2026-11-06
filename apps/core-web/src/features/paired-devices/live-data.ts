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
 *
 * FXR-W (W92-8): operation 19 is defined once, by `pairedDevicesQueryOptions` in `lib/core-queries.ts`
 * (the Devices drawer reads the same key through it), with this gate inside it. Both reads only read;
 * their failures are presented here, after the render, through `useQueryFailure`.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ActivePairingCode, PairedDevice, PairedDeviceList, PairingCodeIssued } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { useCoreMode, CoreMode } from '@dems/shared/live'
import { Permission } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { CoreReadError, isForbiddenCoreRead, pairedDevicesQueryOptions, usePairedDevicesGate, useQueryFailure } from '@/lib/core-queries'
import { CORE_QUERY_KEYS, useWebLive, type WebLive } from '@/runtime'
import { PAIRING_RECORD, reportPairingError } from './report'

/** The permission of the five operations of this page (01_specs §7.7). */
export const PAIRING_PERMISSION = Permission.PAIRING_MANAGE

/** Whether a failure is a 403 refusal of the role (the Forbidden state of §10.1). */
export const isForbidden = (error: unknown): boolean => isForbiddenCoreRead(error)

export interface PairingReads {
  readonly live: boolean
  readonly enabled: boolean
  readonly status: UseQueryResult<ActivePairingCode, Error>
  readonly devices: UseQueryResult<PairedDeviceList, Error>
}

/** Operation 16 (this page's own read; no other page reads the key). */
async function readPairingCodeStatus(live: WebLive | null): Promise<ActivePairingCode> {
  if (live === null) throw new CoreReadError('getPairingCodeStatus', null)
  const answer = await live.client.call('getPairingCodeStatus')
  if (answer.ok) return answer.data
  throw new CoreReadError('getPairingCodeStatus', answer)
}

/**
 * The two reads of the page. A 403 is presented once for both (the presenter never coalesces a
 * refusal of the role, and two toasts for one visit would say the same thing twice); any success
 * re-arms it.
 */
export function usePairingReads(): PairingReads {
  const liveHandle = useWebLive()
  const live = useCoreMode() === CoreMode.LIVE && liveHandle !== null
  // Decision D176 (finding F75-2): a read is never sent for a signed-out console, also not by a page
  // that is still on screen while the shell leaves it after a sign-out or a session end. The gate
  // (Live, signed in, link up, PAIRING_MANAGE) is the one of `lib/core-queries.ts`.
  const gate = usePairedDevicesGate()
  const presentCoreError = useCoreErrorPresenter()
  const forbiddenShown = useRef(false)
  const enabled = live && gate.enabled

  const status = useQuery({
    queryKey: CORE_QUERY_KEYS.pairingCode,
    enabled,
    queryFn: () => readPairingCodeStatus(liveHandle),
  })
  const devices = useQuery(pairedDevicesQueryOptions({ live: live ? gate.live : null, enabled }))

  // Any success re-arms the one 403 toast. Declared before the failure hooks, so a success and a
  // refusal in the same render re-arm first.
  useEffect(() => {
    forbiddenShown.current = false
  }, [status.dataUpdatedAt, devices.dataUpdatedAt])

  const presentRead = useCallback(
    (error: Error, record: string) => {
      const answer = error instanceof CoreReadError ? error.failure : null
      if (answer === null) return
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
  useQueryFailure(status, (error) => presentRead(error, PAIRING_RECORD.statusRead))
  useQueryFailure(devices, (error) => presentRead(error, PAIRING_RECORD.registryRead))

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
