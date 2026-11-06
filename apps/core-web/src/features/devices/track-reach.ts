import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain'
import { cameraLinesInForce, captureMicLines, micChannelOfTrack, selectIsRecording, useSim, type SimState } from '@dems/shared/sim'
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
/*
 * Row W4-2 (D226, U-05 family; the web twin of tablet row 191): an AUDIO track too. On the bench /devices said
 * "READY" on the AUDIO INPUTS cards MIC 1-4 and "Not checked" on the REGISTERED MICROPHONES cards MIC-03..06 - the
 * same four microphones: the audio card read `trackStatus` alone, the registered card `trackStatus` plus the registry
 * rule `rosterStateNotChecked`. Both now read `trackStatus` (the `slotSourceOf` reader) and THIS reach: the line of
 * the channel in force (`captureMicLines`), its device, the same `sourceLineState` rule as a camera. The contract says
 * it of the microphone line's `online` (`state-slices.ts` CaptureConfigMic): "a client at rest with no stated `reach`
 * says 'Not checked', not 'Online' or 'Ready' (finding JW-23)". A camera track reads exactly as before.
 */
export function trackReachOf(state: SimState, trackId: VideoTrackId | AudioTrackId, realCapture: boolean): SourceReach | null {
  if (!realCapture) return null
  if (trackId.startsWith('AUDIO-')) {
    const channel = micChannelOfTrack(trackId as AudioTrackId)
    const mic = captureMicLines(state).find((entry) => entry.channel === channel)
    if (mic === undefined) return null
    const device = state.captureDevices.devices.find((entry) => entry.id === mic.deviceId && entry.kind === 'MIC')
    return sourceLineState({ realCapture: true, recording: selectIsRecording(state), online: mic.online, checkedAt: checkedAtOf(device), reach: device?.reach }).reach
  }
  const line = cameraLinesInForce(state).find((camera) => camera.trackId === trackId)
  if (line === undefined) return null
  const device = state.captureDevices.devices.find((entry) => entry.id === line.deviceId)
  return sourceLineState({ realCapture: true, recording: selectIsRecording(state), online: line.online, streamState: line.streamState, checkedAt: checkedAtOf(device), reach: device?.reach }).reach
}

export function useTrackReach(trackId: VideoTrackId | AudioTrackId): SourceReach | null {
  const realCapture = useRealCaptureCore()
  return useSim((state) => trackReachOf(state, trackId, realCapture))
}
