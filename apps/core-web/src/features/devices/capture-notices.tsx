import { Alert, Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { MicInputId, VideoTrackId } from '@dems/shared/domain'
import { useSim, type SimAlert, type SimState } from '@dems/shared/sim'
import { activeCaptureNotices, captureNoticeText, type CaptureNotice } from '@/lib/capture-notices'
import { SearchCamerasButton, SearchMicrophonesButton } from './camera-search-context'
import { LOCAL_STATE_VIEW, localDeviceState, localStateSentenceKey } from './capture-inputs'
import { useMicInputDevice, useTrackDevice } from './source-class'

const selectAlerts = (state: SimState): SimAlert[] => state.alerts

/**
 * The no-device notifications on Devices & Inputs (ux §8e flow 11, situations A and B; R-10): one
 * kit `Alert` per notice the Core raised, each naming what was not found and offering "Search
 * again" — the camera search (G13) for a camera, the re-read of the local inputs (G17) for a
 * microphone. Everyone sees them, a role without `CAPTURE_CONFIG` with the control disabled and its
 * reason.
 *
 * The strip is a snapshot of the `alerts` slice: a notice is there while its alert is active and
 * gone at the first update after the Core resolved it. Nothing here hides one by a timer, raises
 * one, or counts down (R-10 AC-4, AC-5). Five empty searches are one alert, so they are one notice.
 */
export function CaptureNoticesStrip() {
  const { t } = useTranslation()
  const alerts = useSim(selectAlerts)
  const notices = activeCaptureNotices(alerts)
  if (notices.length === 0) return null
  return (
    <div className="dev-notices" data-testid="capture-notices" role="status" aria-live="polite">
      {notices.map((notice) => {
        const text = captureNoticeText(t, notice)
        return (
          <Alert key={notice.alertId} status="warning" data-testid={`capture-notice-${notice.alertId}`} data-notice={notice.kind} data-device={notice.kind === 'UNREACHABLE' ? notice.deviceId : undefined}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{text.title}</Alert.Title>
              <Alert.Description>{text.body}</Alert.Description>
            </Alert.Content>
            <NoticeAction notice={notice} />
          </Alert>
        )
      })}
    </div>
  )
}

function NoticeAction({ notice }: { notice: CaptureNotice }) {
  if (notice.kind === 'UNREACHABLE' && notice.deviceKind === 'MIC') return <SearchMicrophonesButton place={`notice-${notice.alertId}`} />
  return <SearchCamerasButton place={`notice-${notice.alertId}`} again reveal />
}

/**
 * The mark of a device row whose device did not answer the pre-check (ux §8e.2 situation B, §8f.3):
 * "Not reachable", or the named state of a local device ("Permission needed", "In use", "Not
 * found", "Could not be opened") with its sentence. The row keeps its name and its badge. Drawn
 * from the device's active alert only — its `cause` is the one place a local camera's cause reaches
 * the console (accepted limit OP-125-4).
 */
function UnreachableMark({ deviceId, kind, place }: { deviceId: string | undefined; kind: 'CAMERA' | 'MIC'; place: string }) {
  const { t } = useTranslation()
  const alerts = useSim(selectAlerts)
  if (deviceId === undefined) return null
  const notice = activeCaptureNotices(alerts).find((entry) => entry.kind === 'UNREACHABLE' && entry.deviceId === deviceId)
  if (notice === undefined || notice.kind !== 'UNREACHABLE') return null
  const state = localDeviceState({ present: false, errorCode: notice.cause })
  const view = LOCAL_STATE_VIEW[state]
  const sentenceKey = localStateSentenceKey(state, kind)
  return (
    <span className="dev-unreachable" data-testid={`unreachable-${place}`} data-state={state} data-device={deviceId}>
      <Chip size="sm" variant="soft" color={view.tone}>
        <Chip.Label>{t(view.chip)}</Chip.Label>
      </Chip>
      {sentenceKey === null ? null : <span className="dev-sel-reason">{t(sentenceKey)}</span>}
    </span>
  )
}

/** The unreachable mark of the device that feeds a video track now (a camera tile). */
export function TrackUnreachableMark({ trackId }: { trackId: VideoTrackId }) {
  const device = useTrackDevice(trackId)
  return <UnreachableMark deviceId={device?.id} kind="CAMERA" place={trackId} />
}

/** The unreachable mark of the device behind a microphone input now (an audio-input card). */
export function MicUnreachableMark({ inputId }: { inputId: MicInputId }) {
  const device = useMicInputDevice(inputId)
  return <UnreachableMark deviceId={device?.id} kind="MIC" place={inputId} />
}
