import { eventTitle } from '@/lib/event-words'
import { useCallback, useMemo } from 'react'
import { ScrollShadow } from '@heroui/react'
import { AnimatePresence } from 'motion/react'
import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime'
import { selectRecentEvents, useSim, type SimEvent, type SimState } from '@dems/shared/sim'
import { AnimatedListItem, HIGHLIGHT_FADE_MS } from '@/components/ui/animated-list'
import { DashPanel, PanelLink } from './dash-panel'
import { EVENT_TONE, eventDetail, groupEventsByDay, recordingStartOutcome, type RecordingStartOutcome } from './dashboard-model'
import { DASH_BEATS, useCoalesced, useNewIds } from './dashboard-motion'
import { StatusDot } from './status-bits'

/** The latest six events (01_specs §14.5.1 I). */
const EVENT_COUNT = 6
const selectEvents = (s: SimState) => selectRecentEvents(s, EVENT_COUNT)
/** Day labels change at most once per simulator minute. */
const selectMinute = (s: SimState) => Math.floor(s.clock.now / 60_000)
const selectOperators = (s: SimState) => s.operators
/**
 * Wave H closing pass Z2 (G75-11): what each accepted start among the shown events came to, as one flat
 * string `<event id>:<outcome>,...` (compares by value). Only the starts that are NOT a started
 * recording are listed.
 */
const selectStartOutcomes = (s: SimState): string =>
  selectEvents(s)
    .filter((event) => event.type === 'RECORDING_STARTED')
    .map((event) => [event.id, recordingStartOutcome(s, event.sessionId)] as const)
    .filter(([, outcome]) => outcome !== 'STARTED')
    .map(([id, outcome]) => `${id}:${outcome}`)
    .join(',')

/**
 * Panel I, Recent Events (01_specs §14.5.1 I; research/04 §3.1 I): the six newest operational
 * events grouped by day (04 §9 #34), each row a severity dot, the UTC+07:00 time, the event (i18n
 * from its type) and a detail (the evidence, session, operator, device or time source).
 *
 * Motion (M-C-07): new rows enter through MU AnimatedListItem (edited variants, `layout` push)
 * with the gold highlight fading over 1,500 ms; bursts closer than 400 ms coalesce into one
 * group (R9). The first render highlights nothing. Reduced motion: rows appear, highlight kept.
 */
export function RecentEventsPanel() {
  const { t } = useTranslation()
  const live = useSim(selectEvents)
  const events = useCoalesced(live)
  const minute = useSim(selectMinute)
  const operators = useSim(selectOperators)
  const startOutcomes = useSim(selectStartOutcomes)
  const outcomeOf = useMemo(() => {
    const map = new Map<string, RecordingStartOutcome>()
    for (const pair of startOutcomes === '' ? [] : startOutcomes.split(',')) {
      const at = pair.lastIndexOf(':')
      map.set(pair.slice(0, at), pair.slice(at + 1) as RecordingStartOutcome)
    }
    return map
  }, [startOutcomes])
  const ids = useMemo(() => events.map((event) => event.id), [events])
  const fresh = useNewIds(ids, HIGHLIGHT_FADE_MS)
  const groups = useMemo(() => groupEventsByDay(events, minute * 60_000), [events, minute])
  const operatorName = useCallback(
    (operatorId: string) => operators.find((operator) => operator.id === operatorId)?.displayName ?? null,
    [operators],
  )
  const zone = `UTC${formatUtcOffset()}`

  const dayLabel = (group: (typeof groups)[number]) =>
    group.label.kind === 'date'
      ? group.label.text
      : `${t(`common.time.${group.label.kind}`)} · ${formatDate(group.events[0]?.at ?? minute * 60_000, DATE_PATTERNS.date)}`

  return (
    <DashPanel
      id="i"
      beatMs={DASH_BEATS.row4}
      title={t('dashboard.recentEvents.title')}
      icon={Inbox}
      action={<PanelLink to="/security-audit">{t('dashboard.recentEvents.viewAll')}</PanelLink>}
    >
      {events.length === 0 ? (
        <p className="flex h-full items-center justify-center text-caption text-muted">{t('dashboard.recentEvents.empty')}</p>
      ) : (
        <ScrollShadow className="-mx-1 h-full min-h-0 px-1" hideScrollBar size={24}>
          <div role="list" aria-label={t('dashboard.recentEvents.title')} data-testid="recent-events">
            {groups.map((group) => (
              <div key={group.dayKey} role="group" aria-label={dayLabel(group)}>
                <div className="dems-events-day" aria-hidden="true">
                  {`${dayLabel(group)} · ${zone}`}
                </div>
                <AnimatePresence initial={false}>
                  {group.events.map((event) => (
                    <AnimatedListItem key={event.id} highlight={fresh.has(event.id)}>
                      <EventRow event={event} detail={eventDetail(event, operatorName)} fresh={fresh.has(event.id)} start={outcomeOf.get(event.id) ?? 'STARTED'} />
                    </AnimatedListItem>
                  ))}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </ScrollShadow>
      )}
    </DashPanel>
  )
}

function EventRow({ event, detail, fresh, start }: { event: SimEvent; detail: string | null; fresh: boolean; start: RecordingStartOutcome }) {
  const { t } = useTranslation()
  // G75-11: an accepted start that recorded nothing (yet) is not worded as a recording that started.
  const title = start === 'STARTED' ? eventTitle(t, event) : t(`dashboard.captureStart.${start}`)
  const tone = start === 'FAILED' ? EVENT_TONE.CRITICAL : start === 'CONNECTING' ? EVENT_TONE.INFO : EVENT_TONE[event.severity]
  return (
    <div role="listitem" className="dems-event-row" data-testid="recent-event" data-event-id={event.id} data-fresh={fresh ? 'true' : 'false'} data-start={start === 'STARTED' ? undefined : start}>
      <StatusDot tone={tone} />
      <time dateTime={new Date(event.at).toISOString()}>{formatDate(event.at, DATE_PATTERNS.time)}</time>
      <span className="dems-event-title">{title}</span>
      <span className="dems-event-detail">{detail ?? ''}</span>
    </div>
  )
}
