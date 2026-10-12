import { cameraLinesInForce, selectIsRecording, useSim } from '@dems/shared/sim'
import type { CameraFeedProps } from '@/components/media'
import { useRealCaptureCore, useTrackDevice } from './source-class'
import { checkedAtOf, sourceLineState, type SourceReach } from './source-state'

/**
 * Fix wave J (JW-23 (4); the rule of `source-state.ts`): THE REACH OF THE SOURCE ON A VIDEO TRACK of a Core in
 * real capture, for a tile's status word. A camera on a dead port read "READY" on the Devices page and on
 * the Dashboard, because the Core's `online: true` only says "the registry row is enabled". null: not a
 * real-capture Core (the simulated lane keeps its words), or no line.
 */
export function useTrackReach(cameraId: CameraFeedProps['cameraId']): SourceReach | null {
  const realCapture = useRealCaptureCore()
  const line = useSim((state) => cameraLinesInForce(state).find((camera) => camera.trackId === cameraId))
  const device = useTrackDevice(cameraId)
  const recording = useSim(selectIsRecording)
  if (!realCapture || line === undefined) return null
  return sourceLineState({ realCapture: true, recording, online: line.online, streamState: line.streamState, checkedAt: checkedAtOf(device) }).reach
}

