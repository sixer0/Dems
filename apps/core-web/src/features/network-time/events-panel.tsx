import { Table } from '@heroui/react'
import { ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { useSim, type SimEvent } from '@dems/shared/sim'
import { NetworkTimePanel } from './panel'
import { eventSource, selectNetworkTimeEvents } from './sim-adapter'

/** Rows shown in the compact log (newest first). */
const LOG_ROWS = 8

/** Rows from an earlier WIB day carry their date: "30 Sep 16:14:00". */
const OLDER_ROW_PATTERN = 'D MMM HH:mm:ss'

const selectLog = (s: Parameters<typeof selectNetworkTimeEvents>[0]) => selectNetworkTimeEvents(s, LOG_ROWS)

/**
 * Network and time event log (01_specs §14.5.6 row 5: compact `Table` over `events`). The filter is
 * The simulator's network/time buckets: time sync, GNSS and camera-link faults, tablet link and pairing, exports (the
 * Export domain), updates (the Service domain) and boot. Times are UTC+07:00 (D28/Q2).
 */
export function EventsPanel() {
  const { t } = useTranslation()
  const events = useSim(selectLog)
  // A string that changes once per WIB day, so the 10 Hz clock never re-renders the log (R8).
  const today = useSim((s) => formatDate(s.clock.now, DATE_PATTERNS.dayKey))
  return (
    <NetworkTimePanel id="log" icon={ScrollText} title={t('networkTime.log.title')}>
      {events.length === 0 ? (
        <p className="nt-collecting">{t('networkTime.log.empty')}</p>
      ) : (
        <Table variant="secondary" className="nt-log">
          <Table.ScrollContainer>
            <Table.Content aria-label={t('networkTime.log.title')}>
              <Table.Header>
                <Table.Column id="time" isRowHeader>
                  {t('networkTime.log.columns.time')}
                </Table.Column>
                <Table.Column id="event">{t('networkTime.log.columns.event')}</Table.Column>
                <Table.Column id="source">{t('networkTime.log.columns.source')}</Table.Column>
              </Table.Header>
              <Table.Body>
                {events.map((event) => (
                  <Table.Row key={event.id} id={event.id} data-testid="network-time-log-row" data-type={event.type}>
                    <Table.Cell>
                      <span className="nt-log-time nt-mono">
                        {formatDate(event.at, formatDate(event.at, DATE_PATTERNS.dayKey) === today ? DATE_PATTERNS.time : OLDER_ROW_PATTERN)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="nt-log-event" data-severity={event.severity}>
                        <span className="nt-log-dot" aria-hidden="true" />
                        <span className="nt-log-title">{t(`common.eventType.${event.type}`)}</span>
                        <EventDetail event={event} />
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="nt-log-source">{t(`networkTime.log.source.${eventSource(event) ?? 'SYSTEM'}`)}</span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </NetworkTimePanel>
  )
}

/** Short detail after the title: the time source, fault kind, evidence ID or version. */
function EventDetail({ event }: { event: SimEvent }) {
  const { t } = useTranslation()
  const { params } = event
  let text: string | null = null
  if (typeof params.source === 'string') text = t('networkTime.log.detail.source', { source: params.source })
  else if (typeof params.kind === 'string' && params.kind in FAULT_KINDS) {
    text = t(`common.faultKind.${params.kind as FaultKindKey}`)
  } else if (typeof params.evidenceId === 'string') text = t('networkTime.log.detail.evidence', { id: params.evidenceId })
  else if (typeof params.version === 'string') text = t('networkTime.log.detail.version', { version: params.version })
  if (!text) return null
  return <span className="nt-log-detail"> · {text}</span>
}

const FAULT_KINDS = { GNSS_LOSS: true, CAMERA_LOSS: true } as const
type FaultKindKey = keyof typeof FAULT_KINDS
