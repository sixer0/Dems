import { useEffect, useRef } from 'react'
import { AnimatePresence, animate, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import heroStill1600 from '@dems/shared/assets/hero/room-1600.jpg?url'
import heroStill2560 from '@dems/shared/assets/hero/room-2560.jpg?url'
import { SessionState } from '@dems/shared/domain'
import { useSim, type SimState } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { TextEffect } from '@/components/ui/text-effect'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { DashPanel } from './dash-panel'
import { selectConnectingCameras } from './sim-adapter'
import {
  DASH_BEATS,
  HERO_PHOTO_FADE_MS,
  KEN_BURNS_SCALE,
  PILLAR_GAP_MS,
  RULE_WIPE_MS,
  useBeatDelay,
} from './dashboard-motion'

/** M-C-13 beats inside the hero, after the tagline beat (ms; spec literals, D49). */
const LINE_GAP_MS = 120
const PARAGRAPH_AFTER_MS = 280
const RULE_AFTER_MS = 420
const PILLARS_AFTER_MS = RULE_AFTER_MS + RULE_WIPE_MS
/** TextEffect staggers lines 100 ms at speed 1; M-C-13 wants them 120 ms apart. */
const LINE_SPEED_REVEAL = 100 / LINE_GAP_MS

// Pass D7 item 3: `connecting` = RECORDING before the first durable fragment (`captureDurable: false`; D84, D91).
const selectRecordingCopy = (s: SimState) =>
  s.session?.state === SessionState.RECORDING
    ? { id: s.session.id, caseNumber: s.session.input.caseNumber, connecting: selectConnectingCameras(s) }
    : null

/** The element's current scale, so a resumed Ken Burns continues from where it paused (R10). */
function currentScale(element: Element): number {
  const transform = getComputedStyle(element).transform
  if (!transform || transform === 'none' || typeof DOMMatrixReadOnly !== 'function') return 1
  try {
    return new DOMMatrixReadOnly(transform).a || 1
  } catch {
    return 1
  }
}

/**
 * The graded room still with the slow push-in (M-C-13): it fades up at t = 0, then Ken Burns
 * scales it 1.00 → 1.06 over `kenBurns` (30 s) and back, from transform-origin 60% 40%, as one
 * of the page's four ambient loops. The loop runs on the `<img>` through element `animate()`
 * (WAAPI transform, compositor-only). Reduced motion: a static image (§8).
 */
function HeroPhoto({ delayMs }: { delayMs: number }) {
  const m = useMotionPolicy()
  const mediaRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  // `decor`: the first loop to yield when the shell's SECURE beam needs a slot (F45-02).
  const kenBurns = useAmbientLoop('hero-ken-burns', { ref: mediaRef, priority: 'decor' })
  const { seconds, reduced } = m

  useEffect(() => {
    const image = imageRef.current
    if (!kenBurns.running || !image) return undefined
    const from = currentScale(image)
    const controls = animate(
      image,
      { transform: [`scale(${from})`, `scale(${KEN_BURNS_SCALE})`] },
      { duration: seconds(tokens.ambient.kenBurns), ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' },
    )
    return () => controls.stop()
  }, [kenBurns.running, seconds])

  useEffect(() => {
    // §8: the static final frame is the unscaled photo.
    if (reduced && imageRef.current) imageRef.current.style.transform = 'none'
  }, [reduced])

  return (
    <motion.div
      ref={mediaRef}
      className="dems-dash-hero-media"
      data-testid="hero-media"
      {...kenBurns.attrs}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: seconds(reduced ? tokens.duration.fast : HERO_PHOTO_FADE_MS),
        delay: reduced ? 0 : seconds(delayMs),
        ease: tokens.easing.luxe,
      }}
    >
      <img
        ref={imageRef}
        className="dems-dash-hero-img"
        src={heroStill2560}
        srcSet={`${heroStill1600} 1600w, ${heroStill2560} 2560w`}
        sizes="(min-width: 1600px) 75vw, 90vw"
        alt=""
        decoding="async"
        draggable={false}
      />
      <div className="dems-dash-hero-shade" />
    </motion.div>
  )
}

/** Overline rack focus (§1): blur `focusIn` → 0 with an opacity rise; opacity only when reduced. */
function Overline({ delayMs }: { delayMs: number }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  return (
    <motion.p
      className="dems-hero-overline"
      initial={m.flags.blur ? { opacity: 0, filter: `blur(${tokens.blur.focusIn}px)` } : { opacity: 0 }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{
        duration: m.seconds(m.reduced ? tokens.duration.fast : tokens.duration.slow),
        delay: m.reduced ? 0 : m.seconds(delayMs),
        ease: tokens.easing.luxe,
      }}
    >
      {t('common.brand.overline')}
    </motion.p>
  )
}

function IdleCopy({ taglineMs }: { taglineMs: number }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const at = (offset: number) => (m.reduced ? 0 : m.seconds(taglineMs + offset))
  return (
    <>
      <TextEffect
        as="p"
        per="line"
        preset="fade-in-blur"
        speedReveal={LINE_SPEED_REVEAL}
        delay={taglineMs / 1000}
        className="dems-hero-title"
      >
        {`${t('common.brand.heroLine1')}\n${t('common.brand.heroLine2')}`}
      </TextEffect>
      <motion.p
        className="dems-hero-paragraph"
        initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: tokens.distance.riseSm }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...m.transitions.enter, delay: at(PARAGRAPH_AFTER_MS) }}
      >
        {t('dashboard.hero.paragraph')}
      </motion.p>
      {/* M-C-13 / D65: the gold rule wipes in (`scaleX`, 420 ms `luxe`). */}
      <motion.span
        aria-hidden="true"
        data-testid="hero-rule"
        className="dems-hero-rule"
        initial={m.reduced ? { opacity: 0 } : { scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: m.seconds(m.reduced ? tokens.duration.fast : RULE_WIPE_MS), delay: at(RULE_AFTER_MS), ease: tokens.easing.luxe }}
      />
    </>
  )
}

function RecordingCopy({ sessionId, caseNumber, connecting }: { sessionId: string; caseNumber: string; connecting: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      <p className="dems-hero-title">
        <span>{t('dashboard.hero.recordingTitle')}</span>
      </p>
      {/* Nothing says "Recording" before the first durable fragment (ux §8e.2). */}
      <p className="dems-hero-paragraph" data-testid="hero-session-line" data-connecting={connecting ? 'true' : undefined}>
        {connecting ? `${t('common.session.connectingCameras')} ${sessionId}` : t('dashboard.hero.recordingParagraph', { sessionId, caseNumber })}
      </p>
      <span aria-hidden="true" className="dems-hero-rule" />
    </>
  )
}

/** RECORD / PRESERVE / PROTECT, live text etched on glass, fading in 120 ms apart (M-C-13). */
function Pillars({ startMs }: { startMs: number }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const words = [t('common.brand.pillars.record'), t('common.brand.pillars.preserve'), t('common.brand.pillars.protect')]
  return (
    <div className="dems-hero-pillars" role="img" aria-label={t('dashboard.hero.pillarsLabel')}>
      {words.map((word, index) => (
        <motion.span
          key={word}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: m.seconds(m.reduced ? tokens.duration.fast : tokens.duration.slow),
            delay: m.reduced ? 0 : m.seconds(startMs + index * PILLAR_GAP_MS),
            ease: tokens.easing.standard,
          }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}

/**
 * Panel B, the hero (01_specs §14.5.1 B; research/04 §3.1 B; M-C-13): the graded room photo with
 * Ken Burns, the overline, the two-line oblique tagline (TextEffect per line), the paragraph, the
 * gold rule wipe and the RECORD / PRESERVE / PROTECT stack. While recording, the copy cross-fades
 * to "Session in progress" with the session and case (§7 ARMED → RECORDING).
 */
export function HeroPanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const heroMs = useBeatDelay(DASH_BEATS.hero)
  const taglineMs = useBeatDelay(DASH_BEATS.tagline)
  const recording = useSim(selectRecordingCopy)

  return (
    <DashPanel id="b" beatMs={DASH_BEATS.hero} surface="bare" ariaLabel={t('common.brand.tagline')}>
      <div className="dems-dash-hero" data-testid="dashboard-hero" data-motion={m.policy}>
        <HeroPhoto delayMs={heroMs} />
        <div className="dems-dash-hero-copy">
          <Overline delayMs={heroMs} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={recording ? 'recording' : 'idle'}
              data-testid="hero-copy"
              data-copy={recording ? 'recording' : 'idle'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={m.transitions.crossFade}
            >
              {recording ? (
                <RecordingCopy sessionId={recording.id} caseNumber={recording.caseNumber} connecting={recording.connecting} />
              ) : (
                <IdleCopy taglineMs={taglineMs} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <Pillars startMs={taglineMs + PILLARS_AFTER_MS} />
      </div>
    </DashPanel>
  )
}
