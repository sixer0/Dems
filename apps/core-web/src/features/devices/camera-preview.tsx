import { useImperativeHandle } from 'react'
import { VideoOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
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
  // The selector the open session was created under, else the stored one (the rule of `usePrecheckDevice`).
  const line = useSim((state) => (state.session?.captureConfig ?? state.captureConfig).cameras.find((camera) => camera.trackId === cameraId))
  const device = useTrackDevice(cameraId)
  const track = t(`common.tracks.${cameraId}`)
  const source = device === undefined ? (line?.deviceId ?? null) : device.model ? `${device.id} · ${device.model}` : device.id
  const name = source === null ? track : `${track} · ${source}`
  const state =
    line === undefined
      ? t('devices.selector.notAssigned')
      : !line.online
        ? t('devices.selector.offline')
        : line.streamState === 'LOST'
          ? t('devices.selector.stream.LOST')
          : t('devices.selector.online')
  const small = variant === 'thumb'
  return (
    <div
      className={cn('relative isolate aspect-video w-full rounded-lg border border-border bg-neutral-900 text-neutral-200', className)}
      data-testid="camera-no-preview-frame"
      data-camera={cameraId}
      data-variant={variant}
    >
      <div
        role="img"
        aria-label={t('devices.noPreview.aria', { name, state })}
        data-testid="camera-no-preview"
        data-camera={cameraId}
        data-state={line === undefined ? 'NOT_ASSIGNED' : !line.online ? 'OFFLINE' : line.streamState === 'LOST' ? 'LOST' : 'ONLINE'}
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-[inherit] px-2 text-center"
      >
        <VideoOff aria-hidden="true" size={small ? 16 : 24} strokeWidth={1.75} />
        <span className={cn('font-semibold', small ? 'text-[11px] leading-4' : 'text-sm')}>{t('devices.noPreview.title')}</span>
        <span data-part="name" className={cn('max-w-full truncate text-[11px] leading-4', small && 'sr-only')}>
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
