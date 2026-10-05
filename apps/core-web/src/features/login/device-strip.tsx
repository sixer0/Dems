import { useEffect, useRef, type ReactNode } from 'react'
import { Card, Separator } from '@heroui/react'
import { animate, LayoutGroup, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime'
import { selectClockSecond, selectSystemState, useSim, type SimState } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { SlidingNumber } from '@/components/ui/sliding-number'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { useLiveCoreHealth } from './live-adapter'
import { LOGIN_ACCENT_LOOP_GROUP } from './login-choreography'
import { readinessOf, type CoreReadiness } from './login-live-model'
import { coreLinkKey, type CoreLinkView } from './login-model'
import { revealProps } from './login-motion'

type Tone = 'success' | 'warning' | 'danger' | 'muted'

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  muted: 'bg-muted',
}

// Primitive selectors only (review 40 R1): never the whole `selectSystemState` object.
const selectDeviceId = (s: SimState) => s.device.id
const selectRoom = (s: SimState) => s.device.name
const selectTimeKey = (s: SimState) => s.time.source
const selectSecurity = (s: SimState) => selectSystemState(s).state

export interface DeviceStripProps {
  coreLink: CoreLinkView
  delayMs: number
  leaving: boolean
  className?: string
}

/**
 * The device strip on the Login brand side (01_specs §14.8; research/04 §5.8 "the §4.1 #7
 * metric-card pattern in a compact single row"): device, room, clock, time sync, Core link and
 * security, so operators see the appliance is healthy before they authenticate.
 *
 * - Clock: MP SlidingNumber per digit group at 1 Hz (M-C-22 mapping; plain digits under §8).
 * - Core link: the mock-core heartbeat. Offline turns the dot red and it breathes over
 *   `glowBreath` (M-C-22), in the page's accent slot so the ≤ 4 loop cap holds (§9.4).
 *
 * Live mode (backend task 04_client_integration_spec §5.5 WS-5; plan row W55): the same strip, the
 * same six-cell layout. An anonymous client receives no Core state, so the cells show what the
 * Core server makes public: its service name and version and the readiness of its database and
 * engine (the health answer), its time (the Live clock, fed by the heartbeat), the Core link and
 * the data mode. Nothing of the simulator is read.
 */
export function DeviceStrip({ coreLink, delayMs, leaving, className }: DeviceStripProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const live = useCoreMode() === CoreMode.LIVE
  const reveal = revealProps(m, { delayMs, rise: tokens.distance.riseSm, leaving })

  return (
    <motion.div {...reveal} className={cn('dems-login-strip', className)} data-testid="login-device-strip">
      <Card
        variant="secondary"
        className="dems-login-strip-card"
        aria-label={t(live ? 'login.live.deviceStrip.label' : 'login.deviceStrip.label')}
        role="group"
      >
        {live ? <LiveCells coreLink={coreLink} /> : <SimulatedCells coreLink={coreLink} />}
      </Card>
    </motion.div>
  )
}

function coreLinkTone(coreLink: CoreLinkView): Tone {
  return coreLink === 'online' ? 'success' : coreLink === 'offline' ? 'danger' : coreLink === 'stale' ? 'warning' : 'muted'
}

/** Device, room, clock, time sync, Core link and security from the simulator (the strip as it always was). */
function SimulatedCells({ coreLink }: { coreLink: CoreLinkView }) {
  const { t } = useTranslation()
  const deviceId = useSim(selectDeviceId)
  const room = useSim(selectRoom)
  const timeKey = useSim(selectTimeKey)
  const security = useSim(selectSecurity)

  const coreTone = coreLinkTone(coreLink)
  const securityKey = security === 'READY' || security === 'RECORDING' ? 'SECURE' : security
  const securityTone: Tone = securityKey === 'SECURE' ? 'success' : securityKey === 'ATTENTION' ? 'warning' : securityKey === 'CRITICAL' ? 'danger' : 'muted'
  const timeTone: Tone = timeKey === 'GNSS' ? 'success' : 'warning'

  return (
    <>
      <StripCell label={t('login.deviceStrip.device')}>
        <span className="font-mono">{deviceId}</span>
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.deviceStrip.room')} className="dems-login-strip-room">
        <span>{room}</span>
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.deviceStrip.clock')}>
        <StripClock />
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.deviceStrip.gnss')}>
        <StatusDot tone={timeTone} />
        <span>{t(`login.deviceStrip.gnssValue.${timeKey}`)}</span>
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.deviceStrip.coreLink')} testId="login-core-link" state={coreLink}>
        <StatusDot tone={coreTone} breathe={coreLink === 'offline'} />
        <span>{t(`login.deviceStrip.coreLinkValue.${coreLinkKey(coreLink)}`)}</span>
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.deviceStrip.security')}>
        <StatusDot tone={securityTone} />
        <span>{t(`common.posture.${securityKey}`)}</span>
      </StripCell>
    </>
  )
}

const READINESS_TONE: Record<CoreReadiness, Tone> = { ready: 'success', 'not-ready': 'warning', unknown: 'muted' }
const READINESS_KEY = { ready: 'ready', 'not-ready': 'notReady', unknown: 'unknown' } as const satisfies Record<CoreReadiness, string>

/** WS-5: what the Core server makes public before sign-in. */
function LiveCells({ coreLink }: { coreLink: CoreLinkView }) {
  const { t } = useTranslation()
  const health = useLiveCoreHealth(true)
  // An answer that failed says nothing about the Core now: the cells fall back to "unknown".
  const answer = health.isError ? undefined : health.data
  const database = readinessOf(answer?.ready?.database)
  const engine = readinessOf(answer?.ready?.engine)

  return (
    <>
      <StripCell label={t('login.live.deviceStrip.service')} className="dems-login-strip-room" testId="login-core-service">
        <span className="font-mono">{answer ? `${answer.service} ${answer.version}` : t('login.live.deviceStrip.unknown')}</span>
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.deviceStrip.clock')}>
        <StripClock />
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.live.deviceStrip.database')} testId="login-core-database" state={database}>
        <StatusDot tone={READINESS_TONE[database]} />
        <span>{t(`login.live.deviceStrip.${READINESS_KEY[database]}`)}</span>
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.live.deviceStrip.engine')} testId="login-core-engine" state={engine}>
        <StatusDot tone={READINESS_TONE[engine]} />
        <span>{t(`login.live.deviceStrip.${READINESS_KEY[engine]}`)}</span>
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.deviceStrip.coreLink')} testId="login-core-link" state={coreLink}>
        <StatusDot tone={coreLinkTone(coreLink)} breathe={coreLink === 'offline'} />
        <span>{t(`login.deviceStrip.coreLinkValue.${coreLinkKey(coreLink)}`)}</span>
      </StripCell>
      <StripSeparator />
      <StripCell label={t('login.live.deviceStrip.mode')} testId="login-core-mode" state={CoreMode.LIVE}>
        <StatusDot tone={coreLink === 'offline' ? 'danger' : 'success'} />
        <span>{t(`common.coreMode.name.${CoreMode.LIVE}`)}</span>
      </StripCell>
    </>
  )
}

function StripSeparator() {
  return <Separator orientation="vertical" className="dems-login-strip-sep" />
}

function StripCell({
  label,
  children,
  className,
  testId,
  state,
}: {
  label: string
  children: ReactNode
  className?: string
  testId?: string
  state?: string
}) {
  return (
    <div className={cn('dems-login-strip-cell', className)} data-testid={testId} data-state={state}>
      <span className="dems-login-strip-label">{label}</span>
      <span className="dems-login-strip-value">{children}</span>
    </div>
  )
}

/** A status dot; `breathe` makes its halo breathe (a page ambient loop, M-C-22 Core offline). */
function StatusDot({ tone, breathe = false }: { tone: Tone; breathe?: boolean }) {
  const m = useMotionPolicy()
  const ref = useRef<HTMLSpanElement>(null)
  const haloRef = useRef<HTMLSpanElement>(null)
  const loop = useAmbientLoop('core-offline-dot', { ref, group: LOGIN_ACCENT_LOOP_GROUP, enabled: breathe })

  useEffect(() => {
    const halo = haloRef.current
    if (!loop.running || !halo) return undefined
    const control = animate(
      halo,
      { opacity: [0.25, 0.9] },
      { duration: m.seconds(tokens.ambient.glowBreath / 2), ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' },
    )
    return () => {
      control.stop()
      halo.style.opacity = ''
    }
  }, [loop.running, m])

  return (
    <span ref={ref} className="dems-login-dot" aria-hidden="true" {...(breathe ? loop.attrs : {})}>
      <span ref={haloRef} className={cn('dems-login-dot-halo', TONE_CLASS[tone])} />
      <span className={cn('dems-login-dot-core', TONE_CLASS[tone])} />
    </span>
  )
}

const selectSecond = (s: SimState) => selectClockSecond(s)

/** HH:mm:ss on the clock of the data source (the simulator's; in Live mode the Core server's), UTC+07:00, sliding digits at 1 Hz; readable as one `<time>`. */
function StripClock() {
  const m = useMotionPolicy()
  const second = useSim(selectSecond)
  const at = second * 1000
  const text = formatDate(at, DATE_PATTERNS.time)
  const [hh = '00', mm = '00', ss = '00'] = text.split(':')
  const slide = m.flags.animateNumbers
  return (
    <span className="dems-login-clock">
      <time className="sr-only" dateTime={new Date(at).toISOString()} data-testid="login-clock">
        {`${text} UTC${formatUtcOffset()}`}
      </time>
      <span className="dems-login-clock-face" aria-hidden="true" data-sliding={slide ? 'true' : 'false'}>
        {/* Its own group (DR-41-10): clock ticks never make the emblem's layout node re-measure. */}
        <LayoutGroup id="login-clock" inherit={false}>
          <ClockDigits value={hh} slide={slide} />
          <span>:</span>
          <ClockDigits value={mm} slide={slide} />
          <span>:</span>
          <ClockDigits value={ss} slide={slide} />
        </LayoutGroup>
      </span>
    </span>
  )
}

function ClockDigits({ value, slide }: { value: string; slide: boolean }) {
  return <span className="dems-login-clock-group">{slide ? <SlidingNumber value={Number(value)} padStart /> : value}</span>
}
