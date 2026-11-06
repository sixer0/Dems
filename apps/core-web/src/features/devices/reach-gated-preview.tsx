import { CameraPreview, CameraPreviewTryAgain, type CameraPreviewProps } from './camera-preview'
import { autoPreviewBlocked, isLivePreviewDevice, usePreviewRetryStanding } from './camera-live-preview'
import { useRealCaptureCore, useTrackDevice } from './source-class'

/**
 * Row 130b (DF-13 on the session pages; decision D95, the rule of row 130). Session New (the device check's previews)
 * and the Session Monitor (the live feed, and its full-screen view) mount the live preview WITHOUT the Devices tile's
 * automatic gate: a `LivePreview` asks for a token at mount and again at its backoff (2 s .. 30 s) for as long as it
 * stands, so a camera the Core found unreachable kept asking - one Core preview note per attempt. The same rule as the
 * Devices tile applies here:
 *
 * | The Core's last reading of the track's production camera | What is drawn |
 * |---|---|
 * | `reach: NOT_REACHABLE`, no retry standing | the neutral "No preview" tile (it says "Not reachable") and row 130's `CameraPreviewTryAgain` in the tile's action slot; NO token is asked for |
 * | the operator pressed "Try again" (a retry stands until the Core states a newer `checkedAt`) | the live preview, so ONE new token; a newer NOT_REACHABLE reading takes it down again |
 * | `REACHABLE`, absent or null; a development source; simulated capture; `livePreview` not set | `CameraPreview` exactly as the caller asked |
 *
 * There is no debounce and no slot cap here: these surfaces never had them (they are not automatic per tile, D62).
 * The recording is not touched - this decides only whether the PAGE asks for a preview.
 */
export function ReachGatedCameraPreview({ livePreview = false, actions, ...props }: Omit<CameraPreviewProps, 'autoPreview'>) {
  const realCapture = useRealCaptureCore()
  const device = useTrackDevice(props.cameraId)
  const retrying = usePreviewRetryStanding(device?.id ?? '', device?.checkedAt)
  const held = livePreview && realCapture && device !== undefined && isLivePreviewDevice(device) && autoPreviewBlocked(device) && !retrying
  if (!held) return <CameraPreview {...props} livePreview={livePreview} actions={actions} />
  // The tile is no button, so the "Try again" button may stand in its action slot (the frames of both pages have a fixed
  // aspect: a sibling below the tile would fall outside them). The caller's own actions stay beside it.
  return (
    <CameraPreview
      {...props}
      livePreview={false}
      actions={
        <>
          <CameraPreviewTryAgain cameraId={props.cameraId} className="rounded bg-neutral-900/80 px-1.5 py-0.5 text-neutral-200" />
          {actions}
        </>
      }
    />
  )
}
