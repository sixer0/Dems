import { Alert, Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { formatClock } from '@dems/shared/realtime'
import { captureDeviceName } from '@/lib/capture-notices'
import { SearchMicrophonesButton } from './camera-search-context'
import { LOCAL_STATE_VIEW, localDeviceState, localStateSentenceKey, useMicRescanController, type CaptureInputScanEntry } from './capture-inputs'
import { DevelopmentSourceBadge } from './source-badge'
import { isDevelopmentSource } from './source-class'

/**
 * One registered microphone as the last re-read found it (ux §8g.1 state 4, §8f.3): its name, the
 * state chip and — for a local device that cannot be opened — the sentence that says what to do on
 * the Mac. The row keeps its name and its badge in every state; no other source is shown in its
 * place and no control opens or changes a system setting (R-11 AC-5, AC-9).
 */
function ScanRow({ entry }: { entry: CaptureInputScanEntry }) {
  const { t } = useTranslation()
  const state = localDeviceState(entry)
  const view = LOCAL_STATE_VIEW[state]
  const sentenceKey = localStateSentenceKey(state, 'MIC')
  return (
    <li className="dev-scan-row" data-testid={`mic-scan-${entry.deviceId}`} data-state={state} data-present={entry.present ? 'true' : 'false'}>
      <span className="dev-tile-name">{captureDeviceName(t, entry.deviceId)}</span>
      <Chip size="sm" variant="soft" color={view.tone}>
        <Chip.Label>{t(view.chip)}</Chip.Label>
      </Chip>
      {isDevelopmentSource(entry) ? <DevelopmentSourceBadge adapter={entry.adapter} kind="MIC" testId={`mic-scan-badge-${entry.deviceId}`} /> : null}
      {sentenceKey === null ? null : (
        <span className="dev-sel-reason" data-testid={`mic-scan-sentence-${entry.deviceId}`}>
          {t(sentenceKey)}
        </span>
      )}
    </li>
  )
}

/**
 * "Search again" in the microphone panel of Devices & Inputs (ux §8g flow 13; G17): the control,
 * what it does in one sentence, and the result of the last re-read — each registered microphone as
 * present or not, "Checked at" as a Core instant, and a count of other inputs (nothing registers
 * one in this phase). No timer and no automatic re-read.
 */
export function MicRescan() {
  const { t } = useTranslation()
  const rescan = useMicRescanController()
  const { scan } = rescan
  return (
    <section className="dev-scan" data-testid="mic-rescan" aria-label={t('common.captureInputs.againLabel')} aria-busy={rescan.busy || undefined}>
      <div className="dev-scan-head">
        <SearchMicrophonesButton place="panel" />
        <p className="dev-sel-reason" data-testid="mic-rescan-description">
          {t('common.captureInputs.description')}
        </p>
      </div>
      {rescan.notice === 'NOT_READY' ? (
        // 503: said in the panel; the operator presses again (once per press, nothing retries by itself).
        <Alert status="warning" data-testid="mic-rescan-not-ready">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('devices.selector.notReady')}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {rescan.notice === 'FAILED' ? (
        <Alert status="danger" data-testid="mic-rescan-failed">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('devices.search.rescanFailed')}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {scan === null ? null : (
        <div className="dev-scan-result" data-testid="mic-rescan-result" role="status">
          <ul className="dev-scan-list">
            {scan.inputs.map((entry) => (
              <ScanRow key={entry.deviceId} entry={entry} />
            ))}
          </ul>
          <p className="dev-sel-reason" data-testid="mic-rescan-checked-at">
            {t('common.captureInputs.checkedAt', { time: formatClock(scan.scannedAt) })}
          </p>
          {scan.unregisteredCount > 0 ? (
            <p className="dev-sel-reason" data-testid="mic-rescan-unregistered">
              {t('common.captureInputs.unregistered', { count: scan.unregisteredCount })}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
