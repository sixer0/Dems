import { useEffect, useRef } from 'react'
import { animate, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import roomStillUrl from '@dems/shared/assets/hero/room-2560.jpg?url'
import { motion as tokens, palette, toneHex } from '@dems/shared/tokens'
import { GlowRing } from '@/components/composed/glow-ring'
import type { GlowRingState } from '@/components/composed/glow-ring.math'
import { BRAND_EMBLEM_LAYOUT_ID } from '@/components/shell/shared-layout-ids'
import { Particles } from '@/components/ui/particles'
import { TextEffect } from '@/components/ui/text-effect'
import { GlowLayer, tween, useAmbientLoop, useMotionPolicy } from '@/motion'
import { DeviceStrip } from './device-strip'
import { useGradedStill } from './graded-still'
import { HANDOFF, HERO_BAND_INSET, LOGIN_ACCENT_LOOP_GROUP, PARTICLES, type LoginChoreography } from './login-choreography'
import { LoginEmblem } from './login-emblem'
import { emblemSizeFor, type CoreLinkView, type LoginTier } from './login-model'
import { revealProps } from './login-motion'

/** Ken Burns (M-C-13): scale 1.00 ↔ 1.06 over `kenBurns` (30 s) each way, origin 60% 40%. */
const KEN_BURNS_SCALE = 1.06

/** The element's current `scale` (so a resumed push-in continues from where it paused, R10). */
function currentScale(element: Element): number {
  const transform = getComputedStyle(element).transform
  if (!transform || transform === 'none' || typeof DOMMatrixReadOnly !== 'function') return 1
  try {
    return new DOMMatrixReadOnly(transform).a || 1
  } catch {
    return 1
  }
}

export interface LoginBackdropProps {
  choreography: LoginChoreography
  leaving: boolean
  /** Crop toward the Dashboard hero band on the hand-off (only where that band exists, ≥ 1280). */
  cropOnLeave: boolean
}

/**
 * The room still behind the Login page (01_specs §14.8, §14.10; D46): `object-position` 62% 45%,
 * the dark-warm grade (brightness .55, sepia .35, saturate .8, warm overlay; research/04 §7),
 * baked once so no per-frame filter runs (`graded-still.ts`, DR-43-8), and a fade into the
 * canvas toward the auth side. Never the mobile officer photo (D28).
 *
 * - Entrance: fades up over 900 ms `luxe` (M-PG-LOGIN t = 0).
 * - Ambient: Ken Burns on the image layer only (a transform, compositor-only; `will-change` is
 *   allowed on Ken Burns images, §9.3), one of the page's four loops; paused off-screen or hidden.
 * - Hand-off (M-APP-01 t = 150-450): crops toward the Dashboard hero band with `clip-path:
 *   inset()` (the one allowed use, §9.2) while it fades, so the hero photo can take over.
 */
export function LoginBackdrop({ choreography, leaving, cropOnLeave }: LoginBackdropProps) {
  const m = useMotionPolicy()
  const imageRef = useRef<HTMLImageElement>(null)
  const kenBurns = useAmbientLoop('ken-burns', { ref: imageRef })
  const still = useGradedStill(roomStillUrl)

  useEffect(() => {
    const image = imageRef.current
    if (!kenBurns.running || !image) return undefined
    const from = currentScale(image)
    const control = animate(
      image,
      { transform: [`scale(${from})`, `scale(${KEN_BURNS_SCALE})`] },
      { duration: m.seconds(tokens.ambient.kenBurns), ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' },
    )
    return () => control.stop()
  }, [kenBurns.running, m])

  const crop = cropOnLeave && !m.reduced
  const leaveTransition = m.reduced
    ? tween(HANDOFF.reducedFadeMs, 'exit', m.timeScale)
    : { ...tween(HANDOFF.backdropMs, 'luxe', m.timeScale), delay: m.seconds(HANDOFF.backdropDelayMs) }

  return (
    <motion.div
      aria-hidden="true"
      className="dems-login-backdrop"
      data-testid="login-backdrop"
      initial={{ opacity: 0, clipPath: 'inset(0% 0% 0% 0% round 0px)' }}
      animate={
        leaving
          ? { opacity: crop ? 0.2 : 0, ...(crop ? { clipPath: HERO_BAND_INSET } : {}) }
          : { opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)' }
      }
      transition={
        leaving
          ? leaveTransition
          : { ...tween(choreography.backdrop.durationMs, 'luxe', m.timeScale), delay: m.seconds(choreography.backdrop.delayMs) }
      }
    >
      <img
        ref={imageRef}
        src={still.src}
        alt=""
        className={still.baked ? 'dems-login-backdrop-image' : 'dems-login-backdrop-image dems-login-backdrop-image--css-grade'}
        data-grade={still.baked ? 'baked' : 'css'}
        decoding="async"
        draggable={false}
        {...kenBurns.attrs}
      />
      <span className="dems-login-backdrop-grade" />
      <span className="dems-login-backdrop-fade" />
    </motion.div>
  )
}

export interface BrandSideProps {
  tier: LoginTier
  ringSize: number
  ringState: GlowRingState
  choreography: LoginChoreography
  coreLink: CoreLinkView
  /** Submitting: the emblem's fingerprint arcs scan (M-C-22). */
  scanning: boolean
  /** The hand-off started (M-APP-01). */
  leaving: boolean
}

/**
 * The Login brand side (01_specs §14.8 "Brand side"; research/04 §5.8): GlowRing (`login` mode)
 * with the emblem at its centre, overline, wordmark, italic tagline, gold rule, vertical
 * RECORD / PRESERVE / PROTECT, the device strip and optional gold Particles.
 *
 * The emblem is a **sibling** of the ring, not its child, so the hand-off can fade the ring while
 * the emblem stays fully visible and flies to the top bar through `BRAND_EMBLEM_LAYOUT_ID` (D65;
 * 21_shell_motion §2: "never inside a faded parent"). No ancestor of the emblem animates a
 * transform, so Motion's layout projection measures it exactly.
 */
export function BrandSide({ tier, ringSize, ringState, choreography, coreLink, scanning, leaving }: BrandSideProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const emblemSize = emblemSizeFor(ringSize)
  const showStrip = tier === 'wide' || tier === 'split'
  const showPillars = tier === 'wide'
  const showParticles = (tier === 'wide' || tier === 'split') && !m.reduced
  const oneLineTagline = tier === 'stacked'
  const fadeOut = { leaving }

  const ringFade = m.reduced
    ? { duration: m.seconds(HANDOFF.reducedFadeMs) }
    : { ...tween(HANDOFF.fadeMs, 'exit', m.timeScale), delay: m.seconds(HANDOFF.fadeDelayMs) }

  return (
    <section className="dems-login-brand" aria-label={t('common.brand.name')} data-testid="login-brand">
      {showParticles ? (
        <motion.div
          className="dems-login-particles"
          aria-hidden="true"
          initial={false}
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={ringFade}
        >
          <Particles
            className="h-full w-full"
            quantity={PARTICLES.quantity}
            staticity={PARTICLES.staticity}
            ease={PARTICLES.ease}
            size={PARTICLES.size}
            color={palette.gold}
            loopGroup={LOGIN_ACCENT_LOOP_GROUP}
            active={coreLink !== 'offline' && !leaving}
          />
        </motion.div>
      ) : null}

      <div className="dems-login-brand-main">
        <div className="dems-login-ring-stage" style={{ width: ringSize, height: ringSize }} data-testid="login-ring-stage">
          <motion.div
            className="dems-login-ring-layer"
            initial={false}
            animate={{ opacity: leaving ? 0 : 1 }}
            transition={ringFade}
          >
            <GlowRing
              state={ringState}
              size={ringSize}
              mode="login"
              centerIcon="emblem"
              center={<span aria-hidden="true" />}
              delayMs={choreography.ringDelayMs}
            />
            <SuccessHalo active={leaving} />
          </motion.div>
          <motion.div
            className="dems-login-emblem"
            data-testid="login-emblem"
            data-layout-id={m.flags.sharedLayout ? BRAND_EMBLEM_LAYOUT_ID : undefined}
            // §8: under reduced motion there is no flight; the emblem cross-fades instead.
            layoutId={m.flags.sharedLayout ? BRAND_EMBLEM_LAYOUT_ID : undefined}
            transition={m.transitions.layout}
            {...(m.reduced
              ? {
                  initial: { opacity: 0 },
                  animate: { opacity: leaving ? 0 : 1 },
                }
              : {})}
          >
            <LoginEmblem
              size={emblemSize}
              draw={choreography.emblemDraw}
              bloomAtMs={choreography.bloomAtMs}
              scanning={scanning}
              success={leaving}
            />
          </motion.div>
        </div>

        <div className="dems-login-copy">
          {tier === 'wide' || tier === 'split' ? (
            <motion.p
              className="dems-login-overline"
              {...revealProps(m, { delayMs: choreography.overlineMs, rackFocus: true, ...fadeOut })}
            >
              {t('common.brand.overline')}
            </motion.p>
          ) : null}
          <motion.p
            className="dems-login-wordmark"
            {...revealProps(m, { delayMs: choreography.wordmarkMs, rackFocus: true, ...fadeOut })}
          >
            {t('common.brand.wordmark')}
          </motion.p>
          {tier !== 'compact' ? (
            <motion.div
              className="dems-login-tagline-wrap"
              initial={false}
              animate={{ opacity: leaving ? 0 : 1 }}
              transition={ringFade}
            >
              <TextEffect
                as="p"
                per="line"
                preset="fade-in-blur"
                delay={choreography.taglineMs / 1000}
                speedReveal={choreography.taglineLineGapMs > 0 ? 100 / choreography.taglineLineGapMs : 1}
                className="dems-login-tagline"
              >
                {oneLineTagline
                  ? `${t('common.brand.heroLine1')} ${t('common.brand.heroLine2')}`
                  : `${t('common.brand.heroLine1')}\n${t('common.brand.heroLine2')}`}
              </TextEffect>
            </motion.div>
          ) : null}
          {tier === 'wide' || tier === 'split' ? (
            <motion.span
              aria-hidden="true"
              className="dems-login-rule"
              initial={m.reduced ? { opacity: 0 } : { scaleX: 0 }}
              animate={leaving ? { opacity: 0 } : m.reduced ? { opacity: 1 } : { scaleX: 1 }}
              transition={
                leaving
                  ? ringFade
                  : m.reduced
                    ? tween('fast', 'standard', m.timeScale)
                    : { ...tween('slow', 'luxe', m.timeScale), delay: m.seconds(choreography.ruleMs) }
              }
            />
          ) : null}
        </div>
      </div>

      {showPillars ? (
        <ul className="dems-login-pillars" aria-label={t('common.brand.triplet')}>
          {(['record', 'preserve', 'protect'] as const).map((pillar, index) => (
            <motion.li
              key={pillar}
              {...revealProps(m, { delayMs: choreography.pillarsMs + index * choreography.pillarGapMs, ...fadeOut })}
            >
              {t(`common.brand.pillars.${pillar}`)}
            </motion.li>
          ))}
        </ul>
      ) : null}

      {showStrip ? <DeviceStrip coreLink={coreLink} delayMs={choreography.stripMs} leaving={leaving} /> : null}
    </section>
  )
}

/**
 * M-APP-01 t = 0: the ring flashes success green and blooms once (a pre-rendered green ring and a
 * success-tone GlowLayer; only opacity moves, §9.2). Reduced motion: no flash (§8 "Flashes").
 */
function SuccessHalo({ active }: { active: boolean }) {
  const m = useMotionPolicy()
  if (m.reduced) return null
  return (
    <span className="dems-login-halo" aria-hidden="true" data-active={active ? 'true' : 'false'}>
      <GlowLayer level={0} tone="success" pulseKey={active ? 1 : 0} pulseDurationMs={HANDOFF.navigateAtMs} />
      <motion.svg
        viewBox="0 0 200 200"
        className="dems-login-halo-ring"
        initial={{ opacity: 0 }}
        animate={active ? { opacity: [0, 1, 0] } : { opacity: 0 }}
        transition={
          active
            ? { duration: m.seconds(HANDOFF.haloInMs + HANDOFF.haloOutMs), times: [0, HANDOFF.haloInMs / (HANDOFF.haloInMs + HANDOFF.haloOutMs), 1], ease: 'easeInOut' }
            : { duration: 0 }
        }
      >
        <circle cx={100} cy={100} r={86} fill="none" stroke={toneHex.success} strokeWidth={5} />
        <circle cx={100} cy={100} r={74} fill="none" stroke={toneHex.success} strokeWidth={2.5} />
      </motion.svg>
    </span>
  )
}
