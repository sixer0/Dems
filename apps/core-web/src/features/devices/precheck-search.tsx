import { useTranslation } from 'react-i18next'
import { CameraSearchProvider, SearchCamerasButton, SearchMicrophonesButton } from './camera-search-context'
import { useCameraSearchController } from './camera-search'
import { useMicRescanController } from './capture-inputs'

export interface PrecheckSearchActionsProps {
  /** A configured camera did not answer the pre-check: "Search again" is the camera search (G13). */
  camera: boolean
  /** A configured microphone did not answer: "Search again" re-reads the local inputs (G17). */
  microphone: boolean
}

/**
 * "Search again" on the pre-check of Session New (ux §8e.2 situation B, §8g.3): the same two gated
 * controls as on Devices & Inputs — the camera search (operation 93) and the re-read of the
 * microphones (operation 97) — for an operator who holds `CAPTURE_CONFIG`; for any other role each
 * is drawn disabled with the role sentence (ux §8e.3) and the pre-check's own Retry stays theirs.
 *
 * A press searches; it does not start, retry or change the pre-check, and it switches no microphone
 * (D83: no such control exists at pre-check). What a camera search found is listed on Devices &
 * Inputs, for the operator who searched; here only its counts are said.
 */
export function PrecheckSearchActions({ camera, microphone }: PrecheckSearchActionsProps) {
  if (!camera && !microphone) return null
  return (
    <CameraSearchProvider>
      <div className="flex flex-col gap-3" data-testid="precheck-search">
        {camera ? <CameraAction /> : null}
        {microphone ? <MicrophoneAction /> : null}
      </div>
    </CameraSearchProvider>
  )
}

function CameraAction() {
  const { t } = useTranslation()
  const search = useCameraSearchController()
  const done = search.read.kind === 'READY' && (search.panel === 'RESULTS' || search.panel === 'EMPTY') ? search.read.state.search : null
  return (
    <div className="flex flex-col items-start gap-1" data-testid="precheck-search-camera">
      <SearchCamerasButton place="precheck" again />
      {search.panel === 'SEARCHING' ? (
        <span className="text-caption text-foreground-2" role="status" aria-live="polite">
          {t('common.captureSearch.searching')}
        </span>
      ) : null}
      {done === null ? null : (
        <span className="text-caption text-foreground-2" role="status" data-testid="precheck-search-camera-result">
          {t('common.captureSearch.summary', { count: done.responderCount, newCount: done.newCount, registeredCount: done.registeredCount })}
        </span>
      )}
      {search.notice === 'UNAVAILABLE' ? <span className="text-caption text-foreground-2">{t('common.captureSearch.unavailable')}</span> : null}
      {search.notice === 'BUSY' ? <span className="text-caption text-foreground-2">{t('common.captureSearch.busy')}</span> : null}
      {search.notice === 'FAILED' || search.panel === 'FAILED' ? <span className="text-caption text-foreground-2">{t('common.captureSearch.failed')}</span> : null}
    </div>
  )
}

function MicrophoneAction() {
  const { t } = useTranslation()
  const rescan = useMicRescanController()
  return (
    <div className="flex flex-col items-start gap-1" data-testid="precheck-search-microphone">
      <SearchMicrophonesButton place="precheck" />
      <span className="text-caption text-foreground-2">{t('common.captureInputs.description')}</span>
      {rescan.notice === 'NOT_READY' ? <span className="text-caption text-foreground-2">{t('devices.selector.notReady')}</span> : null}
      {rescan.notice === 'FAILED' ? <span className="text-caption text-foreground-2">{t('devices.search.rescanFailed')}</span> : null}
    </div>
  )
}
