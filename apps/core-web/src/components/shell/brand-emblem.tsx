import { useId } from 'react'
import { motion } from 'motion/react'
import {
  EMBLEM_ARC_PATHS,
  EMBLEM_GRADIENT,
  EMBLEM_SHIELD_PATH,
  EMBLEM_STROKE_LINECAP,
  EMBLEM_STROKE_LINEJOIN,
  EMBLEM_STROKE_WIDTH,
  EMBLEM_VIEWBOX,
  emblemGradientId,
} from '@dems/shared/brand'
import { tween, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import type { EmblemDrawTiming } from './shell-choreography'

export interface BrandEmblemProps {
  /** Rendered width and height in px. */
  size: number
  className?: string
  /**
   * M-APP-03 stroke draw (03_motion_spec §4): the shield draws first, then the six arcs in
   * sequence like a scan. `null` or absent renders the finished emblem. Ignored under reduced
   * motion (§8: the emblem simply appears with the shell).
   */
  draw?: EmblemDrawTiming | null
}

/**
 * The DEMS emblem inlined from `@dems/shared/brand` (01_specs §14.10; D48, D53).
 *
 * - Each instance gets its own gradient id (`emblemGradientId(useId())`), so the Login emblem and
 *   this one can coexist during the M-APP-01 flight.
 * - Path `id`s stay on the asset file only (AC-68); inline copies mark their strokes with
 *   `data-emblem-part` (`shield`, `arc-1` … `arc-6`), which the M-APP-03 draw animates through
 *   SVG `pathLength` (allowed on SVGs ≤ 400 px, §9.2).
 * - Decorative: the lockup's link carries the accessible name.
 */
export function BrandEmblem({ size, className, draw = null }: BrandEmblemProps) {
  const gradientId = emblemGradientId(useId())
  const m = useMotionPolicy()
  const g = EMBLEM_GRADIENT
  const drawing = draw !== null && !m.reduced

  const drawProps = (startMs: number, durationMs: number) =>
    drawing
      ? {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { ...tween(durationMs, 'luxe', m.timeScale), delay: m.seconds(startMs) },
        }
      : {}

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={EMBLEM_VIEWBOX}
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('dems-emblem', className)}
      {...(drawing ? { 'data-emblem-draw': '' } : {})}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits={g.gradientUnits} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
          {g.stops.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      <g stroke={`url(#${gradientId})`} strokeLinecap={EMBLEM_STROKE_LINECAP} strokeLinejoin={EMBLEM_STROKE_LINEJOIN}>
        <motion.path
          data-emblem-part="shield"
          strokeWidth={EMBLEM_STROKE_WIDTH.shield}
          d={EMBLEM_SHIELD_PATH}
          {...(draw ? drawProps(0, draw.shieldMs) : {})}
        />
        {EMBLEM_ARC_PATHS.map((d, index) => (
          <motion.path
            key={d}
            data-emblem-part={`arc-${index + 1}`}
            strokeWidth={EMBLEM_STROKE_WIDTH.arc}
            d={d}
            {...(draw ? drawProps(draw.shieldMs + index * draw.arcStaggerMs, draw.arcMs) : {})}
          />
        ))}
      </g>
    </svg>
  )
}
