import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { ScrollShadow } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, type TimelineEvent } from '@dems/shared/sim'
import { SessionTimeline } from '@/components/composed'
import { formatBytesParts } from './model'
import { Panel } from './panel'
import { useScrollEdges } from './scroll-edges'
import { audioPeakLevel, autosaveSegment, bytesAt } from './sim-adapter'

const EMPTY: readonly TimelineEvent[] = []

/**
 * Q: SESSION TIMELINE (01_specs §14.5.2 Q; research/04 §3.2 Q; M-C-08). The SessionTimeline
 * composition inside its own kit ScrollShadow, so an insertion scrolls only this panel (step-39
 * B-1). Nodes stagger 50 ms on enter (M-PG-SM t = 400); insertions grow the rail, pop the node and
 * pulse its halo twice; marker and snapshot items arrive by flight (M-C-17, M-C-18).
 */
export function TimelinePanel({ listRef }: { listRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation()
  const events = useSim((s) => s.session?.timeline ?? EMPTY)
  const startedAt = useSim((s) => s.session?.startedAt ?? null)
  // The simulator never schedules timeline items in the future, so "now" is the newest item's time:
  // the list re-renders on insertions only, not on every clock second (§9.3).
  const now = events.at(-1)?.at ?? 0
  const edges = useScrollEdges(listRef, events.length > 0)

  // A session joined mid-way opens on its newest items (the mockup's list ends at "now"); later
  // insertions scroll only when the operator has not scrolled for 5 s (SessionTimeline, M-C-08).
  const openedFor = useRef<string | null>(null)
  const firstId = events[0]?.id ?? null
  useEffect(() => {
    const panel = listRef.current
    if (!panel || firstId === null || openedFor.current === firstId) return
    openedFor.current = firstId
    panel.scrollTop = panel.scrollHeight
  }, [firstId, listRef])

  // The mockup's details come from the items' params (step 54; label fallback in sim-adapter.ts).
  const getDetail = useCallback(
    (event: TimelineEvent): string | null => {
      if (event.kind === 'AUDIO_PEAK') {
        const level = audioPeakLevel(event)
        const mic = event.channel === 'AUDIO-02' ? t('common.devices.mic2') : t('common.devices.mic1')
        return level === null ? event.detail : t('session.timeline.audioPeakDetail', { mic, value: level.toFixed(1) })
      }
      if (event.kind === 'AUTOSAVE') {
        const segment = autosaveSegment(event)
        const bytes = bytesAt(event, startedAt)
        if (segment === null || bytes === null) return event.detail
        const size = formatBytesParts(bytes)
        return t('session.timeline.autosaveDetail', { segment, size: t(`common.units.${size.unit}`, { value: size.value }) })
      }
      if (event.detail) return event.detail
      return event.label
    },
    [t, startedAt],
  )

  return (
    <Panel
      id="Q"
      icon={Clock}
      title={t('session.timeline.title')}
      className="sm-area-timeline"
      bodyClassName="sm-scroll-body"
      action={
        <Link to="/security-audit" className="sm-card-link">
          {t('session.timeline.viewAll')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <ScrollShadow ref={listRef} className="sm-scroll" size={24} visibility={edges} data-testid="sm-timeline-scroll">
        {events.length > 0 ? (
          <SessionTimeline events={events} now={now} getDetail={getDetail} />
        ) : (
          <p className="sm-empty">{t('session.timeline.empty')}</p>
        )}
      </ScrollShadow>
    </Panel>
  )
}
