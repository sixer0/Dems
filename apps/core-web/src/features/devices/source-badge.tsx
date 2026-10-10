import { Chip } from '@heroui/react'
import { FlaskConical, Radio } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { VideoTrackId } from '@dems/shared/domain'
import type { CaptureDevice } from './capture-selector'
import {
  isDevelopmentSource,
  isLocalSourceOn,
  sourceKindKey,
  useCaptureDevice,
  useMicInputDevice,
  usePrecheckDevice,
  useRealCapture,
  useTrackDevice,
  type SourceDeviceKind,
} from './source-class'
// Pass D2: the badge is drawn outside the Devices page too (Monitor, Dashboard); its two classes live in the page's sheet.
import './devices.css'

export interface DevelopmentSourceBadgeProps {
  adapter: string | null | undefined
  kind: SourceDeviceKind
  testId?: string
}

/**
 * The ONE badge "Development source" (ux §8f.1): the kit chip, tone `warning`, an icon AND the text
 * (never colour alone), with the kind as a secondary text. Every surface draws this component and
 * no variant of it. It is not collapsible and not behind a tooltip. Outside real capture it draws
 * nothing (D83, D91): the Simulated mode banner already says what the data is.
 */
export function DevelopmentSourceBadge({ adapter, kind, testId = 'source-badge' }: DevelopmentSourceBadgeProps) {
  const { t } = useTranslation()
  const realCapture = useRealCapture()
  if (!realCapture) return null
  const kindKey = sourceKindKey(adapter, kind)
  return (
    <span className="dev-source-badge" data-testid={testId} data-adapter={adapter ?? undefined}>
      <Chip size="sm" variant="soft" color="warning">
        <FlaskConical aria-hidden="true" size={12} />
        <Chip.Label>{t('common.sourceClass.badge')}</Chip.Label>
      </Chip>
      {kindKey === null ? null : <span className="dev-source-kind">{t(kindKey)}</span>}
    </span>
  )
}

/** The badge of a registered capture device: drawn only when the Core sent `sourceClass: DEVELOPMENT` for it. */
export function DeviceSourceBadge({ device, testId }: { device: CaptureDevice | undefined; testId?: string }) {
  if (device === undefined || !isDevelopmentSource(device) || (device.kind !== 'CAMERA' && device.kind !== 'MIC')) return null
  return <DevelopmentSourceBadge adapter={device.adapter} kind={device.kind} testId={testId ?? `source-badge-${device.id}`} />
}

/** The badge and the 'is on' line of a device named by its id (the drawer header, a pre-check row). */
export function DeviceSourceMarks({ deviceId, place }: { deviceId: string | null; place: string }) {
  const device = useCaptureDevice(deviceId)
  return <SourceMarks device={device} place={place} />
}

/** The badge and the 'is on' line of the device that feeds a video track now (a camera tile). */
export function TrackSourceMarks({ trackId, place }: { trackId: VideoTrackId; place: string }) {
  const device = useTrackDevice(trackId)
  return <SourceMarks device={device} place={place} />
}

/** The badge and the 'is on' line of the device behind a microphone input now (an audio-input card). */
export function MicSourceMarks({ inputId, place }: { inputId: string; place: string }) {
  const device = useMicInputDevice(inputId)
  return <SourceMarks device={device} place={place} />
}

function SourceMarks({ device, place }: { device: CaptureDevice | undefined; place: string }) {
  if (device === undefined) return null
  return (
    <>
      <DeviceSourceBadge device={device} testId={`source-badge-${place}`} />
      <LocalSourceOn device={device} place={place} />
    </>
  )
}

/**
 * "This Mac's camera is on" / "This Mac's microphone is on" (ux §8f.3, SEC35-44 (4)): a fixed,
 * non-dismissable state whenever the Core holds a local device open. Drawn from `sourceOpen`, which
 * the shared slice does not carry yet — until it does, nothing is drawn (see `isLocalSourceOn`).
 */
export function LocalSourceOn({ device, place }: { device: CaptureDevice | undefined; place: string }) {
  const { t } = useTranslation()
  const realCapture = useRealCapture()
  if (!realCapture || !isLocalSourceOn(device) || device === undefined) return null
  return (
    <span className="dev-source-on" role="status" data-testid={`source-on-${place}`}>
      <Radio aria-hidden="true" size={12} />
      {t(device.kind === 'CAMERA' ? 'common.sourceClass.cameraOn.web' : 'common.sourceClass.microphoneOn.web')}
    </span>
  )
}

/** The badge and the 'is on' line of the device a pre-check row stands for (ux §8f.2 "Pre-check"). Draws nothing for a row that is no capture source. */
export function PrecheckSourceMarks({ checkId }: { checkId: string }) {
  const device = usePrecheckDevice(checkId)
  return <SourceMarks device={device} place={`precheck-${checkId}`} />
}
