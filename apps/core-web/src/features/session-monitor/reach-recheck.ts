import { useContext, useEffect, useRef } from 'react'
import { cameraLinesInForce, SimContext, useSim, type SimState } from '@dems/shared/sim'
import { autoPreviewBlocked, isLivePreviewDevice, PREVIEW_NOT_AVAILABLE_RETRY_MS, requestPreviewRetry } from '@/features/devices/camera-live-preview'
import { useRealCaptureCore } from '@/features/devices/source-class'

/**
 * Row W4-1 (L8, D231): opening the Session Monitor re-checks, ONCE, each camera whose stored reach is stale.
 *
 * The Core keeps a camera's reach (`reach` + `checkedAt` of `captureDevices.devices[]`) in memory and writes it ONLY from
 * the outcome of a live preview (row 127: first frame -> REACHABLE, a failure note -> NOT_REACHABLE). It has no operation
 * that probes a camera without a preview, and nothing re-reads a camera by itself; so a NOT_REACHABLE reading from 08:21
 * stood until somebody pressed "Try again", and the feed showed "No preview" for a camera that answered again.
 *
 * This hook takes the SAME path as that button (no new operation): `requestPreviewRetry(deviceId, checkedAt)`, after which
 * every reach-gated mount of the page asks operation 112 for that camera until the Core states a newer reading (row 130's
 * standing retry). A newer NOT_REACHABLE closes the gate again and the operator's "Try again" stays.
 *
 * | Rule | Why |
 * |---|---|
 * | Once per mount of the page, at the first replica that holds devices | "on open" - never again while the page stands, so a camera that fails while watched is not re-asked by this hook |
 * | Only a production camera on a selector line in force that reads online, stated NOT_REACHABLE | exactly the cameras `CameraPreviewTryAgain` offers the button for |
 * | Only a reading at least `PREVIEW_NOT_AVAILABLE_RETRY_MS` (60 s) old on the Core clock | the console's own wait before it asks an unavailable camera again: going back and forth between pages costs nothing |
 * | Only on a Core in real capture | Simulated mode has no preview |
 */
export interface ReachRecheck {
  readonly deviceId: string
  readonly checkedAt: number | null
}

/** The cameras opening the monitor re-checks, in the order of the selector lines; pure. */
export function reachRecheckTargets(state: SimState, coreNow: number): ReachRecheck[] {
  const targets: ReachRecheck[] = []
  for (const line of cameraLinesInForce(state)) {
    if (!line.online) continue
    const device = state.captureDevices.devices.find((candidate) => candidate.id === line.deviceId)
    if (device === undefined || !isLivePreviewDevice(device) || !autoPreviewBlocked(device)) continue
    const checkedAt = device.checkedAt ?? null
    if (checkedAt !== null && coreNow - checkedAt < PREVIEW_NOT_AVAILABLE_RETRY_MS) continue
    if (targets.some((target) => target.deviceId === device.id)) continue
    targets.push({ deviceId: device.id, checkedAt })
  }
  return targets
}

/** Row W4-1: the one re-check of the stale unreachable cameras when the Session Monitor opens (see the head of this file). */
export function useReachRecheckOnOpen(): void {
  const sim = useContext(SimContext)
  const realCapture = useRealCaptureCore()
  const devices = useSim((state) => state.captureDevices.devices)
  const done = useRef(false)
  useEffect(() => {
    if (done.current || sim === null || !realCapture || devices.length === 0) return
    done.current = true
    const state = sim.store.getState()
    for (const target of reachRecheckTargets(state, state.clock.now)) requestPreviewRetry(target.deviceId, target.checkedAt)
  }, [sim, realCapture, devices])
}
