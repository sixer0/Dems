import { useImperativeHandle } from 'react'
import { VideoOff } from 'lucide-react'
import { sourceDeviceText } from './own-core-words'
import { checkedAtOf, sourceLineState } from './source-state'
import { useTranslation } from 'react-i18next'
import { selectIsRecording, useSim, cameraLinesInForce } from '@dems/shared/sim'
import { CameraFeed, RecIndicator, type CameraFeedProps } from '@/components/media'
import { cn } from '@/lib/utils'
import { useRealCaptureCore, useTrackDevice } from './source-class'

/**
 * Where a camera picture stands on a page (wave H, driver D; gate 70 finding G70-03, repeated as
 * G75-13; ruling D196). ONE component for every surface - Devices & Inputs, the pre-check tiles of
 * Session New, the Dashboard, the Session Monitor - with the props of `CameraFeed`:
 *
 * | The Core this console shows | What is drawn |
 * |-----------------------------|---------------|
 * | Simulated client mode, or a Core in simulated capture | `CameraFeed`, exactly as before: the bundled demo loop with its own DEMO caption |
 * | A Core in real capture (`useRealCaptureCore`) | The neutral "No preview" tile: this build has no live preview of a camera, and a stock picture beside real evidence reads as the camera's picture |
 *
 * The tile says only what the Core knows: the track, the device the selector names for it, and that
 * device's state as the selector line carries it (not assigned, offline, stream lost, online). Its
 * accessible name says that this build shows no live preview. The REC state of a recording stays
 * (it is the session's, not the picture's). A snapshot of it is `null`: there is no frame.
 */
export function CameraPreview(props: CameraFeedProps) {
  const realCapture = useRealCaptureCore()
  if (!realCapture) return <CameraFeed {...props} />
  return <NoPreviewTile {...props} />
}

function NoPreviewTile({ cameraId, variant = 'feed', recordingSince = null, actions, className, ref }: CameraFeedProps) {
  const { t } = useTranslation()
  // No frame exists, so no snapshot does: the caller's "no image" path, never a made-up picture.
  useImperativeHandle(ref, () => ({ snapshot: () => null }), [])
  // The selector the OPEN session was created under, else the stored one (`selector-in-force.ts` of the shared package: a sealed session's snapshot names nothing).
  const line = useSim((state) => cameraLinesInForce(state).find((camera) => camera.trackId === cameraId))
  const device = useTrackDevice(cameraId)
  const track = t(`common.tracks.${cameraId}`)
  // Fix wave L (G75d-06): a generated source is named as generated, never by the dataset's product name.
  const source = device === undefined ? (line?.deviceId ?? null) : sourceDeviceText(t, device, true)
  const recording = useSim(selectIsRecording)
  const name = source === null ? track : `${track} · ${source}`
  // Fix wave L (G70c-02): the word under "No preview" follows the rule of a source line - "Online" was said of sources nobody opened.
  const reach = line === undefined ? null : sourceLineState({ realCapture: true, recording, online: line.online, streamState: line.streamState, checkedAt: checkedAtOf(device) })
  const state =
    line === undefined || reach === null
      ? t('devices.selector.notAssigned')
      : reach.stream === 'LOST'
        ? t('devices.selector.stream.LOST')
        : reach.reach === 'NOT_REACHABLE'
          ? t('common.developmentRoster.notReachable')
          : reach.reach === 'NOT_CHECKED'
            ? t('web.source.notChecked')
            : reach.stream === 'LIVE'
              ? t('devices.selector.stream.LIVE')
              : t('common.developmentRoster.reachable')
  const small = variant === 'thumb'
  return (
    <div
      // Fix wave Q (CW-02): in a Dashboard tile the frame is as tall as its four lines at least (`data-variant="tile"`:
      // the lines are in the flow, not laid over a box of whatever height the row left - 44 px for 64 px of text at 1440;
      // `min-h-fit shrink-0` after the caller's classes, so the caller's `min-h-0` cannot shrink it under its text).
      className={cn('relative isolate aspect-video w-full rounded-lg border border-border bg-neutral-900 text-neutral-200', className, variant === 'tile' && 'flex min-h-fit shrink-0 flex-col')}
      data-testid="camera-no-preview-frame"
      data-camera={cameraId}
      data-variant={variant}
    >
      <div
        role="img"
        aria-label={t('devices.noPreview.aria', { name, state })}
        title={small ? t('devices.noPreview.aria', { name, state }) : undefined}
        data-testid="camera-no-preview"
        data-camera={cameraId}
        data-state={line === undefined ? 'NOT_ASSIGNED' : !line.online ? 'OFFLINE' : line.streamState === 'LOST' ? 'LOST' : 'ONLINE'}
        // Fix wave L (G89c-08): in a Dashboard tile (variant `tile`) the four lines fit the short stage at 1440 x 900 - a small icon and tight lines.
        className={cn(
          'flex flex-col items-center justify-center rounded-[inherit] px-2 text-center',
          variant === 'tile' ? 'relative min-h-fit flex-1 gap-0 py-1' : 'absolute inset-0 gap-1 overflow-hidden',
        )}
      >
        <VideoOff aria-hidden="true" size={small || variant === 'tile' ? 14 : 24} strokeWidth={1.75} />
        {/* Fix wave Q (CW-02 sweep): a thumb (59 x 33 px in the Monitor's inputs card) has no room for the icon AND the
            words - "No / preview" was cut by the frame. The thumb draws the icon; its words stay for assistive technology
            (the frame's name) and as the hover title. */}
        <span className={cn('font-semibold', small ? 'sr-only' : variant === 'tile' ? 'text-xs leading-4' : 'text-sm')}>{t('devices.noPreview.title')}</span>
        <span data-part="name" className={cn('max-w-full break-words text-[11px] leading-4', small && 'sr-only')}>
          {name}
        </span>
        <span data-part="state" className={cn('text-[11px] leading-4 text-neutral-400', small && 'sr-only')}>
          {state}
        </span>
      </div>
      {recordingSince !== null ? <RecIndicator since={recordingSince} size={variant === 'feed' ? 'md' : 'sm'} className="absolute right-2 top-2" /> : null}
      {actions ? <div className="absolute bottom-2 right-2 flex items-center gap-1">{actions}</div> : null}
    </div>
  )
}
