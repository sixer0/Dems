import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, type Transition } from 'motion/react'
import { Shield, ShieldAlert, ShieldQuestion, ShieldX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { motion as tokens } from '@dems/shared/tokens'
import { TextEffect } from '@/components/ui/text-effect'
import { RecIndicator } from '@/components/media/rec-indicator'
import { GlowLayer, tween, useAmbientLoop, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import {
  arcPath,
  BRACKET_ARCS,
  circlePath,
  isEscalation,
  RING_COLOURS,
  RING_RADII,
  RING_VIEWBOX,
  tickLines,
  type GlowRingMode,
  type GlowRingState,
} from './glow-ring.math'

export type { GlowRingMode, GlowRingState } from './glow-ring.math'

export interface GlowRingProps {
  state: GlowRingState
  /** Rendered width and height in px (hero ≈320, login ≈340, mini ≈120). */
  size: number
  /** Replaces the default centre (icon, "SYSTEM", state word). */
  center?: ReactNode
  /** Accessible name. Default `dashboard.systemRing.ariaLabel.<state>` ("System ready"). */
  label?: string
  /** `hero` (Dashboard), `login`, `mini` (Start Session step 3: no rotation, icon only). */
  mode?: GlowRingMode
  /** Default-centre icon: `shield` (Lucide shield family) or the brand `emblem`. Login defaults to the emblem. */
  centerIcon?: 'shield' | 'emblem'
  /** RECORDING: the centre shows REC and the timer from this simulator time (epoch ms). */
  recordingSince?: number | null
  /** Extra centre content below the state word (flags line, caption). Stays accessible. */
  children?: ReactNode
  /** Offsets the whole mount sequence (page choreography, R3), in ms. */
  delayMs?: number
  className?: string
}

/** M-C-01 mount timeline (ms, literals from the spec; D49). */
const TIMELINE = {
  ticksMs: tokens.duration.slow, // 420
  arcMs: 900,
  arcGapMs: 120,
  innerStartMs: 200,
  innerMs: 1200,
  centerStartMs: 900,
  centerMs: 600,
  wordsStartMs: 1000,
  stateMorphMs: 600,
} as const
/** Bracket glow copy breathing range (M-C-01) and its reduced resting value. */
const BREATH_RANGE = [0.55, 1]
const BREATH_REST = 0.8
/** RECORDING: the red arcs pulse at `recPulse`. */
const REC_PULSE_RANGE = [0.45, 1]

const VIEWBOX = `0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`
/** Static geometry, computed once per page (72 ticks, two bracket arcs). */
const TICKS = tickLines()
const ARCS = BRACKET_ARCS.map((arc) => ({ ...arc, d: arcPath(RING_RADII.bracket, arc.start, arc.end) }))

/** The element's current rotation in degrees (so a resumed loop continues in phase, R10). */
function currentRotation(element: Element): number {
  const transform = getComputedStyle(element).transform
  if (!transform || transform === 'none' || typeof DOMMatrixReadOnly !== 'function') return 0
  try {
    const matrix = new DOMMatrixReadOnly(transform)
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
  } catch {
    return 0
  }
}

const STATE_ICON = {
  ATTENTION: ShieldAlert,
  CRITICAL: ShieldX,
  UNKNOWN: ShieldQuestion,
} as const

/** The Lucide shield with its check drawn by Motion (`m9 12 2 2 4-4`, the ShieldCheck check). */
function DrawnShieldCheck({ size, drawDelayS, drawS, draw }: { size: number; drawDelayS: number; drawS: number; draw: boolean }) {
  return (
    <Shield size={size} strokeWidth={1.6} aria-hidden="true" focusable="false">
      <motion.path
        d="m9 12 2 2 4-4"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: drawS, delay: drawDelayS, ease: tokens.easing.luxe }}
      />
    </Shield>
  )
}

/** The brand emblem from `@dems/shared/brand`, with its own gradient id (D48) and a draw-on. */
function RingEmblem({ size, drawDelayS, drawS, draw }: { size: number; drawDelayS: number; drawS: number; draw: boolean }) {
  const gradientId = emblemGradientId(useId())
  const g = EMBLEM_GRADIENT
  const pathMotion = (delayS: number) =>
    draw
      ? {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { duration: drawS, delay: delayS, ease: tokens.easing.luxe },
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
      data-ring-emblem=""
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits={g.gradientUnits} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
          {g.stops.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      <g stroke={`url(#${gradientId})`} strokeLinecap={EMBLEM_STROKE_LINECAP} strokeLinejoin={EMBLEM_STROKE_LINEJOIN}>
        <motion.path strokeWidth={EMBLEM_STROKE_WIDTH.shield} d={EMBLEM_SHIELD_PATH} {...pathMotion(drawDelayS)} />
        {EMBLEM_ARC_PATHS.map((d, index) => (
          <motion.path key={d} strokeWidth={EMBLEM_STROKE_WIDTH.arc} d={d} {...pathMotion(drawDelayS + 0.2 + index * 0.06)} />
        ))}
      </g>
    </svg>
  )
}

/**
 * GlowRing, the SYSTEM READY ring (01_specs §14.6; 03_motion_spec M-C-01; research/04 §3.1 A).
 *
 * Four SVG layers plus a centre:
 * 1. an outer tick ring (72 ticks) that fades in, then rotates once per `ringRotate` (60 s);
 * 2. two bracket arcs at 9 and 3 o'clock that draw on (`pathLength`, 900 ms `luxe`, 120 ms apart)
 *    over a pre-blurred glow copy whose opacity breathes 0.55 ↔ 1 over `glowBreath`;
 * 3. an inner solid ring that draws from 200 ms over 1,200 ms;
 * 4. the centre: a shield whose check draws at 900 ms (or the brand emblem), then "SYSTEM" and the
 *    state word through Motion Primitives TextEffect (`fade-in-blur`, per character, 1,000 ms).
 *
 * State morph: `--ring-color` and `--ring-arc-color` move between gold, amber, red and grey in
 * 600 ms; an escalation adds one bloom pulse (R8). RECORDING turns the arcs red, pulses them at
 * `recPulse`, and cross-fades the centre to REC plus the SlidingNumber timer.
 * Rotation and breathing are ambient loops (§9.4); `mini` never rotates. While recording, the arc
 * pulse shares the page's `rec-pulse` slot with the REC chips. The rotating ticks, the glow copy and
 * the brackets are separate `<svg>` layers animated with element `animate()` (WAAPI transform and
 * opacity), so the loops are compositor-only (§9.2, §9.3). Reduced motion (§8): everything drawn
 * and static, the glow copy at 0.8, text opacity only.
 *
 * Accessibility: the SVG is `role="img"` with the state's label; every decorative layer and the
 * default centre are `aria-hidden`. `children` (caption) stay readable.
 */
export function GlowRing({
  state,
  size,
  center,
  label,
  mode = 'hero',
  centerIcon,
  recordingSince = null,
  children,
  delayMs = 0,
  className,
}: GlowRingProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const rootRef = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '_')
  const blurId = `glow-ring-blur-${uid}`
  const colours = RING_COLOURS[state]
  const recording = state === 'RECORDING'
  const draw = !m.reduced
  const s = (ms: number) => m.seconds(ms + delayMs)

  // R8: one bloom pulse on escalation, derived during render (no effect round-trip).
  // `changed` also tells the centre that the entrance (draw-on, delayed text) already played.
  const [escalation, setEscalation] = useState({ state, key: 0, changed: false })
  if (escalation.state !== state) {
    setEscalation({
      state,
      key: isEscalation(escalation.state, state) ? escalation.key + 1 : escalation.key,
      changed: true,
    })
  }

  // ── Ambient loops (§9.4: rotation and breathing are two of the page's four) ─────────────
  const rotation = useAmbientLoop('ring-rotate', { ref: rootRef, enabled: mode !== 'mini' })
  // While recording, the red arcs pulse at `recPulse` in the page's shared `rec-pulse` slot (one
  // loop with every REC chip, §9.4); otherwise the bracket glow breathes in a slot of its own.
  const breathing = useAmbientLoop(recording ? 'ring-rec-pulse' : 'ring-breath', {
    ref: rootRef,
    group: recording ? 'rec-pulse' : undefined,
  })
  const ticksRef = useRef<SVGSVGElement>(null)
  const glowRef = useRef<SVGSVGElement>(null)
  const bracketsRef = useRef<SVGSVGElement>(null)
  const breathRest = m.reduced ? BREATH_REST : 1

  // Rotation and breathing run on whole `<svg>` layers through Motion's element `animate()`
  // (native WAAPI for transform and opacity), so the compositor moves them without re-rasterising
  // the SVG every frame (§9.2, §9.3; the browser pass measured the difference, 20_compositions §5).
  useEffect(() => {
    const element = ticksRef.current
    if (!rotation.running || !element) return undefined
    const from = currentRotation(element)
    const controls = animate(
      element,
      { transform: [`rotate(${from}deg)`, `rotate(${from + 360}deg)`] },
      { duration: m.seconds(tokens.ambient.ringRotate), ease: 'linear', repeat: Infinity },
    )
    return () => controls.stop()
  }, [rotation.running, m])

  useEffect(() => {
    const glow = glowRef.current
    const brackets = bracketsRef.current
    if (!breathing.running || !glow || !brackets) return undefined
    const period = recording ? tokens.ambient.recPulse : tokens.ambient.glowBreath
    const options = {
      duration: m.seconds(period / 2),
      ease: 'easeInOut' as const,
      repeat: Infinity,
      repeatType: 'mirror' as const,
    }
    const controls = [animate(glow, { opacity: recording ? REC_PULSE_RANGE : BREATH_RANGE }, options)]
    if (recording) controls.push(animate(brackets, { opacity: REC_PULSE_RANGE }, options))
    return () => {
      for (const control of controls) control.stop()
      glow.style.opacity = String(breathRest)
      brackets.style.opacity = '1'
    }
  }, [breathing.running, recording, breathRest, m])

  // ── Colour morph through CSS custom properties (§9.2 allows colour variables) ────────────
  const morph: Transition = tween(m.reduced ? tokens.duration.fast : TIMELINE.stateMorphMs, 'standard', m.timeScale)
  const ringStyle = { '--ring-color': colours.ring, '--ring-arc-color': colours.arc }
  const iconChoice = centerIcon ?? (mode === 'login' ? 'emblem' : 'shield')
  const iconSize = Math.round(size * (mode === 'mini' ? 0.34 : 0.2))
  const accessibleName = label ?? t(`dashboard.systemRing.ariaLabel.${state}`)

  // Until the first state change: later changes cross-fade the centre without replaying the entrance.
  const entrance = !escalation.changed

  const Icon = state === 'READY' || state === 'RECORDING' ? null : STATE_ICON[state]
  const icon =
    iconChoice === 'emblem' ? (
      <RingEmblem size={iconSize} drawDelayS={s(TIMELINE.centerStartMs)} drawS={m.seconds(TIMELINE.centerMs)} draw={draw && entrance} />
    ) : Icon ? (
      <Icon size={iconSize} strokeWidth={1.6} aria-hidden="true" />
    ) : (
      <DrawnShieldCheck
        size={iconSize}
        drawDelayS={s(TIMELINE.centerStartMs)}
        drawS={m.seconds(TIMELINE.centerMs)}
        draw={draw && entrance}
      />
    )

  const defaultCenter = (
    <div aria-hidden="true" data-ring-center="" className="flex flex-col items-center" style={{ color: 'var(--ring-color)' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={state}
          className="flex flex-col items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={m.transitions.crossFade}
        >
          {icon}
          {mode === 'mini' ? null : recording ? (
            <RecIndicator since={recordingSince} size="md" look="soft" className="mt-1" />
          ) : (
            <>
              <TextEffect
                as="span"
                per="char"
                preset="fade-in-blur"
                delay={entrance ? (TIMELINE.wordsStartMs + delayMs) / 1000 : 0}
                className="mt-1 text-caption font-semibold uppercase tracking-[0.18em] text-foreground"
              >
                {t('dashboard.systemRing.overline')}
              </TextEffect>
              <TextEffect
                as="span"
                per="char"
                preset="fade-in-blur"
                delay={entrance ? (TIMELINE.wordsStartMs + delayMs + 120) / 1000 : 0}
                className="font-display text-display font-bold uppercase leading-none"
              >
                {t(`common.systemState.${state}`)}
              </TextEffect>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )


  return (
    <motion.div
      ref={rootRef}
      data-testid="glow-ring"
      data-state={state}
      data-mode={mode}
      data-motion={m.policy}
      className={cn('relative isolate shrink-0 rounded-full', className)}
      style={{ width: size, height: size, ...ringStyle }}
      initial={false}
      animate={ringStyle}
      transition={morph}
    >
      <GlowLayer level={0} tone={colours.tone} pulseKey={escalation.key} />
      {/* The strongest bloom in the UI (research/04 §1.3): static, coloured by the state. */}
      <span
        aria-hidden="true"
        data-ring-layer="bloom"
        className="pointer-events-none absolute inset-[6%] rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--ring-color) 16%, transparent) 0%, transparent 68%)' }}
      />

      {/* 1. Outer tick ring: its own layer, rotated whole (compositor-only). */}
      <svg
        ref={ticksRef}
        aria-hidden="true"
        data-ring-layer="ticks"
        {...rotation.attrs}
        viewBox={VIEWBOX}
        width={size}
        height={size}
        fill="none"
        className="pointer-events-none absolute inset-0"
        style={{ stroke: 'var(--ring-color)', willChange: 'transform' }}
      >
        <motion.g
          initial={draw ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: m.seconds(TIMELINE.ticksMs), delay: s(0), ease: tokens.easing.standard }}
        >
          <circle cx={100} cy={100} r={RING_RADII.ticks + 1.5} strokeWidth={0.6} strokeOpacity={0.35} />
          {TICKS.map(({ long, line: [x1, y1, x2, y2] }) => (
            <line
              key={`${x1}-${y1}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={long ? 1.4 : 0.8}
              strokeOpacity={long ? 0.85 : 0.45}
              strokeLinecap="round"
            />
          ))}
        </motion.g>
      </svg>

      {/* 2a. Pre-blurred glow copy of the brackets: only the layer's opacity moves (§9.2). */}
      <svg
        ref={glowRef}
        aria-hidden="true"
        data-ring-layer="bracket-glow"
        {...breathing.attrs}
        viewBox={VIEWBOX}
        width={size}
        height={size}
        fill="none"
        className="pointer-events-none absolute inset-0 overflow-visible"
        style={{ stroke: 'var(--ring-arc-color)', opacity: breathRest }}
      >
        <defs>
          <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>
        <g filter={`url(#${blurId})`}>
          {ARCS.map((arc) => (
            <path key={arc.id} d={arc.d} strokeWidth={9} strokeLinecap="round" />
          ))}
        </g>
      </svg>

      {/* The image: segmented track and inner solid ring (static once drawn). */}
      <svg
        role="img"
        aria-label={accessibleName}
        viewBox={VIEWBOX}
        width={size}
        height={size}
        className="absolute inset-0 overflow-visible"
        fill="none"
      >
        <g aria-hidden="true" data-ring-layer="track" style={{ stroke: 'var(--ring-color)' }}>
          <circle
            cx={100}
            cy={100}
            r={RING_RADII.track}
            strokeWidth={2.4}
            strokeOpacity={0.22}
            strokeDasharray="10 5"
          />
        </g>
        {/* 3. Inner solid ring. */}
        <g aria-hidden="true" data-ring-layer="inner" style={{ stroke: 'var(--ring-color)' }}>
          <motion.path
            d={circlePath(RING_RADII.inner)}
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={draw ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: m.seconds(TIMELINE.innerMs), delay: s(TIMELINE.innerStartMs), ease: tokens.easing.luxe }}
          />
        </g>
      </svg>

      {/* 2b. Bracket arcs: their own layer, so the RECORDING pulse is compositor-only too. */}
      <svg
        ref={bracketsRef}
        aria-hidden="true"
        data-ring-layer="brackets"
        viewBox={VIEWBOX}
        width={size}
        height={size}
        fill="none"
        className="pointer-events-none absolute inset-0 overflow-visible"
        style={{ stroke: 'var(--ring-arc-color)' }}
      >
        {ARCS.map((arc, index) => (
          <motion.path
            key={arc.id}
            d={arc.d}
            strokeWidth={5}
            strokeLinecap="round"
            initial={draw ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: m.seconds(TIMELINE.arcMs), delay: s(index * TIMELINE.arcGapMs), ease: tokens.easing.luxe }}
          />
        ))}
      </svg>

      <div className="absolute inset-[18%] flex flex-col items-center justify-center text-center">
        {center ?? defaultCenter}
        {children}
      </div>
    </motion.div>
  )
}
