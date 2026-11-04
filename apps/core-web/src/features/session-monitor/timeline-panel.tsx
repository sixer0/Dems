import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import type { AudioTrackId } from '@dems/shared/domain' // D61 (2026-11-04): the four audio channels
import { ScrollShadow } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { captureFactsOf, captureFaultSentence, FaultKind, faultKindLabelKey, useSim, type TimelineEvent } from '@dems/shared/sim'
import { SessionTimeline } from '@/components/composed'
import { useMicInputName } from '@/features/devices/source-class'
import { isMicInputId } from '@/lib/capture-notices'
import { useOwnCapture } from '@/lib/own-capture'
import { formatBytesParts } from './model'
import { Panel } from './panel'
import { useScrollEdges } from './scroll-edges'
import { audioPeakLevel, autosaveSegment, bytesAt, captureFaultReasonOf, timelineOfOwnCapture, timelineWhileConnecting, timelineWithoutRepeatedFaults } from './sim-adapter'

const EMPTY: readonly TimelineEvent[] = []

/**
 * Q: SESSION TIMELINE (01_specs §14.5.2 Q; research/04 §3.2 Q; M-C-08). The SessionTimeline
 * composition inside its own kit ScrollShadow, so an insertion scrolls only this panel (step-39
 * B-1). Nodes stagger 50 ms on enter (M-PG-SM t = 400); insertions grow the rail, pop the node and
 * pulse its halo twice; marker and snapshot items arrive by flight (M-C-17, M-C-18).
 *
 * Wave H closing pass Z2: (a) beside a recording of the Core's own capture the rows the simulator's
 * generator invents (AUTOSAVE with its byte formula, HEALTH, its CHECK) are not drawn
 * (`timelineOfOwnCapture`, the rule of the tablet's timeline); (b) a FAULT row is WORDED for every
 * session - the capture fault by the shared capture wording (`captureFaultSentence`, with the reason
 * the item carries), any other fault by its name - never the code of the item's fallback label
 * ("Critical fault: CAPTURE_FAULT").
 */
// D61 (2026-11-04): the four microphone channels of the timeline's AUDIO_PEAK rows.
const TIMELINE_MIC_KEY = { 'AUDIO-01': 'common.devices.mic1', 'AUDIO-02': 'common.devices.mic2', 'AUDIO-03': 'common.devices.mic3', 'AUDIO-04': 'common.devices.mic4' } as const satisfies Partial<Record<AudioTrackId, string>>

export function TimelinePanel({ listRef }: { listRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation()
  const micName = useMicInputName()
  const stored = useSim((s) => s.session?.timeline ?? EMPTY)
  const ownCapture = useOwnCapture()
  // G75b-08: no "Recording Started" while the session is still connecting its cameras.
  const connecting = useSim((s) => captureFactsOf(s.session)?.capture === 'CONNECTING')
  // G75c-06 (c): a fault the Core listed twice at one instant is one row.
  const events = useMemo(() => timelineWithoutRepeatedFaults(timelineWhileConnecting(timelineOfOwnCapture(stored, ownCapture), connecting)), [stored, ownCapture, connecting])
  // G75c-06 (a), (b): the reason of a capture fault whose row carries none is the one its alert states.
  const alerts = useSim((s) => s.alerts)
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
        // D61 (2026-11-04): any of the four channels can peak; the names come from the shared catalog.
        const mic = t(TIMELINE_MIC_KEY[event.channel as keyof typeof TIMELINE_MIC_KEY] ?? 'common.devices.mic1')
        return level === null ? event.detail : t('session.timeline.audioPeakDetail', { mic, value: level.toFixed(1) })
      }
      if (event.kind === 'AUTOSAVE') {
        const segment = autosaveSegment(event)
        const bytes = bytesAt(event, startedAt)
        if (segment === null || bytes === null) return event.detail
        const size = formatBytesParts(bytes)
        return t('session.timeline.autosaveDetail', { segment, size: t(`common.units.${size.unit}`, { value: size.value }) })
      }
      if (event.kind === 'AUDIO_SWITCH') {
        // WB-10: the switch names both inputs (`params.from` / `params.to`, written by operation 81).
        // Pass D2: named from the ids the Core wrote (`MIC-NN`, any number).
        const from = event.params?.from
        const to = event.params?.to
        if (isMicInputId(from) && isMicInputId(to)) return t('session.audioSource.timelineDetail', { from: micName(from), to: micName(to) })
      }
      if (event.kind === 'FAULT') {
        const kind = event.params?.kind
        if (kind === 'CAPTURE_FAULT') {
          return captureFaultSentence(captureFaultReasonOf(event, alerts), null)
        }
        if (typeof kind === 'string' && Object.prototype.hasOwnProperty.call(FaultKind, kind)) return t(faultKindLabelKey(kind as FaultKind, event.params))
      }
      if (event.detail) return event.detail
      return event.label
    },
    [t, startedAt, micName, alerts],
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
