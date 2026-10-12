import { eventTitle } from '@/lib/event-words'
import { ScrollShadow } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import { Activity, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatWibTime, GB, useSim, type SimEvent } from '@dems/shared/sim'
import { AnimatedListItem } from '@/components/ui/animated-list'
import { fixed } from './model'
import { StoragePanel } from './panel'
import { selectStorageActivity } from './sim-adapter'
import { useNewRowIds } from './use-new-rows'

/** Rows shown (newest first); the list scrolls inside its ScrollShadow when the card is short. */
const ACTIVITY_ROWS = 10

/** Dot tone per event: sealed violet (D28/Q4), warnings amber, faults red, the rest by severity. */
function toneOf(event: SimEvent): string {
  if (event.type === 'EVIDENCE_SEALED') return 'sealed'
  if (event.type === 'EVIDENCE_EXPORTED') return 'info'
  if (event.severity === 'CRITICAL') return 'danger'
  if (event.severity === 'WARNING') return 'warning'
  if (event.severity === 'SUCCESS') return 'success'
  return 'accent'
}

/**
 * Recent Storage Activity (01_specs §14.5.5: `Card`, `ScrollShadow`, MU AnimatedList; Data: `events`
 * filtered to storage, the simulator's `selectStorageActivity`). Newest first, at most 10 rows. Rows on screen at mount arrive
 * with the panel; a row that arrives later slides in with the edited AnimatedListItem (M-C-07) and a
 * gold highlight fading over 1.5 s.
 */
export function ActivityPanel() {
  const { t } = useTranslation()
  const events = useSim((s) => selectStorageActivity(s, ACTIVITY_ROWS))
  const fresh = useNewRowIds(events.map((event) => event.id))

  const titleOf = (event: SimEvent) => {
    const title = eventTitle(t, event)
    if (event.type !== 'FAULT_RAISED' && event.type !== 'FAULT_CLEARED') return title
    // Only the two storage fault kinds pass the storage-activity filter.
    const kind = event.params.kind === 'STORAGE_FULL' ? 'STORAGE_FULL' : 'STORAGE_LOW'
    return `${title} · ${t(`common.faultKind.${kind}`)}`
  }

  const detailOf = (event: SimEvent): string | null => {
    const p = event.params
    if (typeof p.evidenceId === 'string') return p.evidenceId
    if (event.type === 'AUTOSAVE' && typeof p.bytesWritten === 'number') {
      return t('storage.activity.segment', { segment: String(p.segment ?? ''), size: fixed(p.bytesWritten / GB, 2) })
    }
    if (event.type === 'STORAGE_POLICY_CHANGED' && typeof p.retentionDays === 'number') {
      return t('storage.activity.policy', {
        days: p.retentionDays,
        autoArchive: p.autoArchive ? t('storage.kpi.on') : t('storage.kpi.off'),
      })
    }
    return event.sessionId
  }

  return (
    <StoragePanel
      id="activity"
      icon={Activity}
      title={t('storage.activity.title')}
      action={
        <Link to="/security-audit" className="stor-link">
          {t('storage.activity.viewAudit')}
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      }
      bodyClassName="stor-activity"
    >
      {events.length === 0 ? (
        <p className="stor-empty">{t('storage.activity.empty')}</p>
      ) : (
        <ScrollShadow className="stor-activity-scroll" hideScrollBar>
          <ol className="stor-activity-list" aria-label={t('storage.activity.listLabel')} aria-live="polite">
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <li key={event.id} className="stor-activity-item" data-testid="storage-activity-row">
                  <AnimatedListItem highlight={fresh.has(event.id)}>
                    <div className="stor-activity-row">
                      <span className="stor-activity-dot" data-tone={toneOf(event)} aria-hidden="true" />
                      <time className="stor-activity-time" dateTime={new Date(event.at).toISOString()}>
                        {formatWibTime(event.at)}
                      </time>
                      <span className="stor-activity-title">{titleOf(event)}</span>
                      <span className="stor-activity-detail">{detailOf(event)}</span>
                    </div>
                  </AnimatedListItem>
                </li>
              ))}
            </AnimatePresence>
          </ol>
        </ScrollShadow>
      )}
    </StoragePanel>
  )
}
