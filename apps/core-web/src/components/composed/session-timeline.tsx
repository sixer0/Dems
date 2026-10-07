import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Typography } from '@heroui/react'
import { motion, type Transition } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { timelineTitleKey, type TimelineEvent } from '@dems/shared/sim'
import { timelineNodeStyle, type TimelineNodeStyle } from './session-timeline.math'
import { formatClock } from '@dems/shared/realtime'
import { motion as tokens, toneHex } from '@dems/shared/tokens'
import { tween, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'

export type { TimelineEvent } from '@dems/shared/sim'
export type { TimelineNodeStyle } from './session-timeline.math'

const NODE_COLOUR: Record<TimelineNodeStyle, string> = {
  ok: toneHex.success,
  note: toneHex.warning,
  peak: toneHex.warning,
  fault: toneHex.danger,
}

/** M-C-08 literals (D49). */
export const TIMELINE_LINE_MS = 320
export const TIMELINE_TEXT_MS = 240
const TEXT_RISE_PX = 8
const HALO_PULSES = 2
const HALO_SCALE = 2.4
const TEXT_REST = { opacity: 1, y: 0 }
/** Auto-scroll to the newest node only if the user has not scrolled in the last 5 s. */
export const USER_SCROLL_QUIET_MS = 5000

export interface SessionTimelineProps {
  events: readonly TimelineEvent[]
  /** Simulator time (epoch ms): events after `now` are not shown yet. */
  now: number
  /** Title of an event. Default `session.timeline.kind.<KIND>` ("Audio Peak Detected"). */
  getTitle?: (event: TimelineEvent) => string
  /** Detail of an event. Default: `detail`, else the simulator label when it adds something. */
  getDetail?: (event: TimelineEvent) => string | null
  /** Show only the newest `limit` events (default: all). */
  limit?: number
  /** Accessible name of the list. Default `session.timeline.title`. */
  ariaLabel?: string
  className?: string
}

/**
 * Scrolls `item` into view inside the timeline's own scrolling panel (for example the page's
 * ScrollShadow) and nowhere else: the search stops at `<main>`, so an insertion never moves the
 * page or the shell's content area (the browser pass found `scrollIntoView` doing exactly that).
 */
function scrollIntoPanel(item: HTMLElement, behavior: ScrollBehavior) {
  let node = item.parentElement
  while (node && node.tagName !== 'MAIN' && node !== document.body) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      const panel = node.getBoundingClientRect()
      const box = item.getBoundingClientRect()
      const delta = box.bottom > panel.bottom ? box.bottom - panel.bottom : box.top < panel.top ? box.top - panel.top : 0
      if (delta !== 0 && typeof node.scrollBy === 'function') node.scrollBy({ top: delta, behavior })
      return
    }
    node = node.parentElement
  }
}

interface ItemProps {
  event: TimelineEvent
  title: string
  detail: string | null
  inserted: boolean
  newest: boolean
  first: boolean
  itemRef?: (element: HTMLLIElement | null) => void
}

const TimelineItem = memo(function TimelineItem({ event, title, detail, inserted, newest, first, itemRef }: ItemProps) {
  const m = useMotionPolicy()
  const style = timelineNodeStyle(event.kind)
  const colour = NODE_COLOUR[style]
  const animateInsert = inserted && !m.reduced
  const lineTransition: Transition = tween(TIMELINE_LINE_MS, 'luxe', m.timeScale)
  const popTransition: Transition = { ...m.transitions.completion, delay: m.seconds(TIMELINE_LINE_MS * 0.6) }
  const textTransition: Transition = { ...tween(TIMELINE_TEXT_MS, 'standard', m.timeScale), delay: m.seconds(TIMELINE_LINE_MS * 0.6) }
  const halo = newest && inserted && m.flags.flashes
  const textInitial = animateInsert ? { opacity: 0, y: TEXT_RISE_PX } : false

  return (
    <motion.li
      ref={itemRef}
      data-timeline-item={event.id}
      data-kind={event.kind}
      data-newest={newest ? 'true' : undefined}
      className="relative grid grid-cols-[1rem_4.75rem_minmax(0,1fr)] items-baseline gap-x-3 py-1.5 md:grid-cols-[1rem_4.75rem_minmax(0,0.9fr)_minmax(0,1.1fr)]"
      variants={inserted ? undefined : m.variants.row}
    >
      {/* Rail segment from the previous node down to this one (grows on insertion). */}
      {!first ? (
        <motion.span
          aria-hidden="true"
          data-timeline-line=""
          className="absolute left-[7.5px] top-[-50%] h-full w-px origin-top bg-bronze/45"
          initial={animateInsert ? { scaleY: 0 } : false}
          animate={{ scaleY: 1 }}
          transition={lineTransition}
        />
      ) : null}

      <span aria-hidden="true" className="relative flex size-4 items-center justify-center self-center">
        {halo ? (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${colour}` }}
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: HALO_SCALE }}
            transition={{
              duration: m.seconds(tokens.ambient.recPulse),
              repeat: HALO_PULSES - 1,
              ease: 'easeOut',
              delay: m.seconds(TIMELINE_LINE_MS),
            }}
          />
        ) : null}
        <motion.span
          data-timeline-node={style}
          className="relative block size-2.5 rounded-full"
          style={
            style === 'note'
              ? { border: `2px solid ${colour}`, backgroundColor: 'var(--surface)' }
              : { backgroundColor: colour, boxShadow: `0 0 6px ${colour}66` }
          }
          initial={animateInsert ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={popTransition}
        />
      </span>

      <time dateTime={new Date(event.at).toISOString()} className="font-mono text-caption tabular-nums text-foreground-2">
        {formatClock(event.at)}
      </time>

      <motion.div className="min-w-0" initial={textInitial} animate={TEXT_REST} transition={textTransition}>
        <Typography type="body-sm" weight="medium" truncate className="block">
          {title}
        </Typography>
      </motion.div>
      {detail ? (
        <motion.div
          className="col-start-3 min-w-0 md:col-start-auto"
          initial={textInitial}
          animate={TEXT_REST}
          transition={textTransition}
        >
          <Typography type="body-xs" color="muted" truncate className="block">
            {detail}
          </Typography>
        </motion.div>
      ) : (
        <span className="hidden md:block" />
      )}
    </motion.li>
  )
})

/**
 * SessionTimeline (01_specs §14.6; 03_motion_spec M-C-08; research/04 §3.2 Q).
 *
 * A vertical rail with one node per event, oldest first, times in UTC+07:00 (mono, tabular).
 * - First render: rows reveal with the row stagger (M-C-11).
 * - Insertion (M-C-08): the rail segment grows (`scaleY`, 320 ms `luxe`), the node pops
 *   (`bouncy`), the text rises 8 px (240 ms), and the newest node's halo pulses twice.
 * - The list scrolls to the newest node (smoothly) only if the user has not scrolled in 5 s.
 * - Reduced motion: rows appear at once, no halo, instant scroll.
 * Accessibility: `<ol>` list semantics; a polite live region announces each new item.
 */
export function SessionTimeline({
  events,
  now,
  getTitle,
  getDetail,
  limit,
  ariaLabel,
  className,
}: SessionTimelineProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()

  const visible = useMemo(() => {
    const shown = events.filter((event) => event.at <= now).slice().sort((a, b) => a.at - b.at)
    return limit !== undefined && limit >= 0 ? shown.slice(Math.max(0, shown.length - limit)) : shown
  }, [events, now, limit])

  // Items present at mount enter with the row reveal; later ones are insertions (M-C-08).
  const [initialIds] = useState(() => new Set(visible.map((event) => event.id)))
  const newest = visible.at(-1) ?? null

  const titleOf = useCallback(
    // A NOTE is titled by its author's role (E2E-T-5, `timelineTitleKey`); other kinds by their kind.
    (event: TimelineEvent) => getTitle?.(event) ?? t(timelineTitleKey(event)),
    [getTitle, t],
  )
  const detailOf = useCallback(
    (event: TimelineEvent) => {
      if (getDetail) return getDetail(event)
      if (event.detail) return event.detail
      const title = titleOf(event)
      return event.label && event.label.toLowerCase() !== title.toLowerCase() ? event.label : null
    },
    [getDetail, titleOf],
  )

  // ── Auto-scroll (only when the user has been quiet for 5 s) ──────────────────────────────
  const lastUserScroll = useRef(Number.NEGATIVE_INFINITY)
  const newestRef = useRef<HTMLLIElement | null>(null)
  const setNewestRef = useCallback((element: HTMLLIElement | null) => {
    newestRef.current = element
  }, [])
  const markUserScroll = useCallback(() => {
    lastUserScroll.current = Date.now()
  }, [])
  const newestInserted = newest !== null && !initialIds.has(newest.id)
  useEffect(() => {
    if (!newestInserted) return
    const element = newestRef.current
    if (!element) return
    if (Date.now() - lastUserScroll.current < USER_SCROLL_QUIET_MS) return
    scrollIntoPanel(element, m.reduced ? 'auto' : 'smooth')
  }, [newest?.id, newestInserted, m.reduced])

  const announcement =
    newest && newestInserted
      ? [formatClock(newest.at), titleOf(newest), detailOf(newest)].filter(Boolean).join(', ')
      : ''

  return (
    <div data-testid="session-timeline" data-motion={m.policy} className={cn('relative', className)}>
      <motion.ol
        aria-label={ariaLabel ?? t('session.timeline.title')}
        className="relative flex flex-col"
        variants={m.variants.rowContainer}
        initial="hidden"
        animate="visible"
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
        onKeyDown={markUserScroll}
      >
        {visible.map((event, index) => {
          const isNewest = event.id === newest?.id
          return (
            <TimelineItem
              key={event.id}
              event={event}
              title={titleOf(event)}
              detail={detailOf(event)}
              inserted={!initialIds.has(event.id)}
              newest={isNewest}
              first={index === 0}
              itemRef={isNewest ? setNewestRef : undefined}
            />
          )
        })}
      </motion.ol>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="session-timeline-live">
        {announcement}
      </div>
    </div>
  )
}
