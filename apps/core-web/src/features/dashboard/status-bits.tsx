import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { motion as tokens } from '@dems/shared/tokens'
import type { StatusTone } from '@dems/shared/tokens'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { GLINT_MS, ICON_DRAW_MS } from './dashboard-motion'
import { DOT_CLASS } from './dashboard-model'

/** The DS "status LED" (AssetSample #4): a filled dot with a soft halo in the tone's colour. */
export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return <span aria-hidden="true" data-tone={tone} className={cn('dems-dot', DOT_CLASS[tone], className)} />
}

const DRAWABLE = 'path, circle, line, polyline, polygon, rect, ellipse'

/**
 * A Lucide icon whose strokes draw on once, `delayMs` after mount (M-PG-DASH row 3: "icons
 * draw"). Each stroke's Motion `pathLength` goes 0 → 1 (strokes 60 ms apart, `luxe`), the same
 * SVG draw the GlowRing uses (an SVG well under 400 px, §9.2). Reduced motion draws nothing: the
 * icon is simply there (§8).
 */
export function DrawIcon({
  icon: Icon,
  delayMs,
  size = 26,
  className,
}: {
  icon: LucideIcon
  delayMs: number
  size?: number
  className?: string
}) {
  const m = useMotionPolicy()
  const ref = useRef<HTMLSpanElement>(null)
  const animated = !m.reduced
  const { seconds } = m

  useEffect(() => {
    const host = ref.current
    if (!animated || !host) return undefined
    const strokes = Array.from(host.querySelectorAll<SVGElement>(DRAWABLE))
    const controls = strokes.map((stroke, index) =>
      animate(
        stroke,
        { pathLength: [0, 1] },
        { duration: seconds(ICON_DRAW_MS), delay: seconds(delayMs + index * 60), ease: tokens.easing.luxe },
      ),
    )
    return () => {
      for (const control of controls) control.stop()
      // Interrupted (policy flip, re-run): leave every stroke fully drawn.
      for (const stroke of strokes) animate(stroke, { pathLength: 1 }, { duration: 0 })
    }
  }, [animated, delayMs, seconds])

  return (
    <span ref={ref} className={cn('inline-flex', className)} data-motion={m.policy} aria-hidden="true">
      <Icon size={size} strokeWidth={1.75} />
    </span>
  )
}

/**
 * A one-shot light sweep across its parent (§1 "Light sweep"; M-PG-DASH "chips glint once"),
 * `delayMs` after mount, or again when `replayKey` changes (an escalation, R8 allows one).
 * The parent needs `.dems-glint-host`. Reduced motion: nothing (§8 flashes).
 */
export function Glint({ delayMs, replayKey }: { delayMs: number; replayKey?: string | number }) {
  const m = useMotionPolicy()
  const ref = useRef<HTMLSpanElement>(null)
  const { seconds, flags } = m
  useEffect(() => {
    const element = ref.current
    if (!flags.flashes || !element) return undefined
    const controls = animate(
      element,
      { transform: ['translateX(-120%)', 'translateX(120%)'] },
      { duration: seconds(GLINT_MS), delay: seconds(delayMs), ease: tokens.easing.luxe },
    )
    return () => controls.stop()
  }, [flags.flashes, delayMs, seconds, replayKey])
  return <span ref={ref} aria-hidden="true" className="dems-glint" />
}
