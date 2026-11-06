import { useEffect, useId, useRef } from 'react'
import { animate, motion } from 'motion/react'
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
import { palette, toneHex } from '@dems/shared/tokens'
import { tween, useMotionPolicy } from '@/motion'
import { HANDOFF, SCAN_ARC_GAP_MS, SCAN_PERIOD_MS, type LoginChoreography } from './login-choreography'

export interface LoginEmblemProps {
  /** Rendered width and height in px (half the ring: 160-180 at ≥ 1280). */
  size: number
  /** M-PG-LOGIN stroke draw (shield, then the 6 arcs as a scan), or null for the finished mark. */
  draw: LoginChoreography['emblemDraw']
  /** One bloom behind the emblem after the draw (the page's hero moment), or null. */
  bloomAtMs: number | null
  /** M-C-22 Submitting: the fingerprint arcs pulse in sequence like a verification scan. */
  scanning: boolean
  /** M-APP-01 t = 0: the check draws over the emblem, then leaves before the flight. */
  success: boolean
}

/** A check across the shield, in the emblem's 128-unit box (the ShieldCheck check, scaled). */
const CHECK_PATH = 'M44 66 L58 80 L86 50'
const SCAN_LOW_OPACITY = 0.4
const BLOOM_MS = 900

/**
 * The DEMS emblem at the centre of the Login ring (01_specs §14.8; 04 §7: 160-180 px here).
 *
 * Built from `@dems/shared/brand` like the shell's `BrandEmblem` and the GlowRing centre, with its
 * own gradient id (D48: the Login and top-bar emblems coexist during the M-APP-01 flight). It adds
 * what only the Login needs: the entrance draw with a start offset, the Submitting scan, the
 * success check and the bloom. Everything animates transform, opacity or SVG `pathLength` on a
 * ≤ 400 px SVG (§9.2). Decorative (`aria-hidden`): the ring carries the accessible name.
 */
export function LoginEmblem({ size, draw, bloomAtMs, scanning, success }: LoginEmblemProps) {
  const m = useMotionPolicy()
  const gradientId = emblemGradientId(useId())
  const g = EMBLEM_GRADIENT
  const arcRefs = useRef<Array<SVGPathElement | null>>([])
  const drawing = draw !== null && !m.reduced
  const scan = scanning && !m.reduced

  // M-C-22: a wave of 0.4 ↔ 1 opacity runs across the arcs, 150 ms apart, while pending.
  useEffect(() => {
    if (!scan) return undefined
    const arcs = arcRefs.current.filter((arc): arc is SVGPathElement => arc !== null)
    const controls = arcs.map((arc, index) =>
      animate(
        arc,
        { opacity: [1, SCAN_LOW_OPACITY, 1] },
        {
          duration: m.seconds(SCAN_PERIOD_MS),
          delay: m.seconds(index * SCAN_ARC_GAP_MS),
          repeat: Infinity,
          ease: 'easeInOut',
        },
      ),
    )
    return () => {
      for (const control of controls) control.stop()
      for (const arc of arcs) arc.style.opacity = '1'
    }
  }, [scan, m])

  const drawProps = (startMs: number, durationMs: number) =>
    drawing
      ? {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { ...tween(durationMs, 'luxe', m.timeScale), delay: m.seconds(startMs) },
        }
      : {}

  const checkTransition = m.reduced
    ? { duration: 0 }
    : {
        pathLength: tween(HANDOFF.checkMs, 'luxe', m.timeScale),
        opacity: { ...tween(HANDOFF.checkFadeMs, 'standard', m.timeScale), delay: m.seconds(HANDOFF.checkFadeAtMs) },
      }

  return (
    <span className="dems-login-emblem-inner" data-emblem-draw={drawing ? '' : undefined} data-scanning={scan ? 'true' : 'false'}>
      {bloomAtMs !== null && !m.reduced ? (
        <motion.span
          aria-hidden="true"
          className="dems-login-emblem-bloom"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0] }}
          transition={{ ...tween(BLOOM_MS, 'standard', m.timeScale), delay: m.seconds(bloomAtMs) }}
        />
      ) : null}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={EMBLEM_VIEWBOX}
        width={size}
        height={size}
        fill="none"
        aria-hidden="true"
        focusable="false"
        className="dems-login-emblem-svg"
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
            {...(draw ? drawProps(draw.startMs, draw.shieldMs) : {})}
          />
          {EMBLEM_ARC_PATHS.map((d, index) => (
            <motion.path
              key={d}
              ref={(element) => {
                arcRefs.current[index] = element
              }}
              data-emblem-part={`arc-${index + 1}`}
              strokeWidth={EMBLEM_STROKE_WIDTH.arc}
              d={d}
              {...(draw ? drawProps(draw.startMs + draw.shieldMs + index * draw.arcStaggerMs, draw.arcMs) : {})}
            />
          ))}
        </g>
        {success ? (
          <g data-emblem-part="check" strokeLinecap="round" strokeLinejoin="round">
            <motion.path
              d={CHECK_PATH}
              stroke={palette.black}
              strokeWidth={11}
              initial={m.reduced ? { opacity: 1 } : { pathLength: 0, opacity: 1 }}
              animate={m.reduced ? { opacity: 1 } : { pathLength: 1, opacity: 0 }}
              transition={checkTransition}
            />
            <motion.path
              d={CHECK_PATH}
              stroke={toneHex.success}
              strokeWidth={6.5}
              initial={m.reduced ? { opacity: 1 } : { pathLength: 0, opacity: 1 }}
              animate={m.reduced ? { opacity: 1 } : { pathLength: 1, opacity: 0 }}
              transition={checkTransition}
            />
          </g>
        ) : null}
      </svg>
    </span>
  )
}
