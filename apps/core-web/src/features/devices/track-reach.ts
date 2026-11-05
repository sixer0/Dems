import { cameraLinesInForce, selectIsRecording, useSim, type SimState } from '@dems/shared/sim'
import type { CameraFeedProps } from '@/components/media'
import { useRealCaptureCore } from './source-class'
import { checkedAtOf, sourceLineState, type SourceReach } from './source-state'

/**
 * Fix wave J (JW-23 (4); the rule of `source-state.ts`): THE REACH OF THE SOURCE ON A VIDEO TRACK of a Core in
 * real capture, for a tile's status word. A camera on a dead port read "READY" on the Devices page and on
 * the Dashboard, because the Core's `online: true` only says "the registry row is enabled". null: not a
 * real-capture Core (the simulated lane keeps its words), or no line.
 *
 * Row W2c2 (129b, U-09b): the pure reader, so the registered camera card reads the SAME reach as the tile of the
 * track it feeds (`registered-devices-model.ts` `rosterCardStatus`). The device is the one the line in force names
 * (the rule of `useTrackDevice`).
 */
export function trackReachOf(state: SimState, cameraId: CameraFeedProps['cameraId'], realCapture: boolean): SourceReach | null {
  if (!realCapture) return null
  const line = cameraLinesInForce(state).find((camera) => camera.trackId === cameraId)
  if (line === undefined) return null
  const device = state.captureDevices.devices.find((entry) => entry.id === line.deviceId)
  return sourceLineState({ realCapture: true, recording: selectIsRecording(state), online: line.online, streamState: line.streamState, checkedAt: checkedAtOf(device), reach: device?.reach }).reach
}

export function useTrackReach(cameraId: CameraFeedProps['cameraId']): SourceReach | null {
  const realCapture = useRealCaptureCore()
  return useSim((state) => trackReachOf(state, cameraId, realCapture))
}
