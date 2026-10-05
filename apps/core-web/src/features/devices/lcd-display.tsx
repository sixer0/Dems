import { useId, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { SessionState } from '@dems/shared/domain'
import { formatClock, formatDuration } from '@dems/shared/realtime'
import { DEVICE_IDENTITY, selectSystemState, storageSummary, useSim, type SimState } from '@dems/shared/sim'
import { palette, statusText } from '@dems/shared/tokens'
import { useSimSecond } from '@/components/media'
import { useMotionPolicy } from '@/motion'
import { useDeviceWords } from './live'
import { formatTb, LCD_PAGES, type LcdPage } from './model'
import { bookPoe } from './sim-adapter'

const W = 800
const H = 480
const TEXT = '#EDE6DE'
const DIM = palette.gray
const GOLD = palette.gold

interface LcdModel {
  system: 'READY' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN' | 'RECORDING'
  recording: boolean
  startedAt: number | null
  sessionId: string | null
  camsOk: number
  camsTotal: number
  micsOk: number
  micsTotal: number
  timeSource: SimState['time']['source']
  ip: string
  lan: string
  speed: number
  tablet: SimState['tabletLink']['state']
  poeDraw: number
  poeBudget: number
  down: number
  up: number
  usedPercent: number
  freeBytes: number
  totalBytes: number
  remainingMinutes: number
  storageState: SimState['storage']['state']
  deviceId: string
  room: string
  version: string
  tpmOk: boolean
  secureBoot: boolean
}

function selectLcd(state: SimState): LcdModel {
  const storage = storageSummary(state)
  const poe = bookPoe(state)
  const session = state.session
  return {
    system: selectSystemState(state).state,
    recording: session?.state === SessionState.RECORDING,
    startedAt: session?.state === SessionState.RECORDING ? session.startedAt : null,
    sessionId: session && session.state !== SessionState.SEALED ? session.id : null,
    camsOk: state.cameras.filter((camera) => camera.online && camera.lens === 'READY').length,
    camsTotal: state.cameras.length,
    micsOk: state.mics.filter((mic) => mic.state === 'READY' && !mic.clipLatched).length,
    micsTotal: state.mics.length,
    timeSource: state.time.source,
    ip: state.network.ip,
    lan: state.network.lanName,
    speed: state.network.linkSpeedMbps,
    tablet: state.tabletLink.state,
    poeDraw: poe.drawW,
    poeBudget: poe.budgetW,
    down: state.network.bandwidth.downMbps,
    up: state.network.bandwidth.upMbps,
    usedPercent: storage.usedPercent,
    freeBytes: storage.freeBytes,
    totalBytes: storage.totalBytes,
    remainingMinutes: Math.floor(storage.estimatedRemainingMs / 60_000),
    storageState: storage.state,
    deviceId: state.device.id,
    room: state.device.room,
    version: state.device.softwareVersion,
    tpmOk: state.security.tpm.ok,
    secureBoot: state.security.secureBoot,
  }
}

const SYSTEM_TONE: Record<LcdModel['system'], string> = {
  READY: statusText.success,
  RECORDING: statusText.danger,
  ATTENTION: statusText.warning,
  CRITICAL: statusText.danger,
  UNKNOWN: DIM,
}

function Line({ y, children, color = TEXT, size = 28, anchor = 'start', x = 40, weight = 500 }: {
  y: number
  children: ReactNode
  color?: string
  size?: number
  anchor?: 'start' | 'end' | 'middle'
  x?: number
  weight?: number
}) {
  return (
    <text x={x} y={y} fill={color} fontSize={size} fontWeight={weight} textAnchor={anchor} className="dev-lcd-text">
      {children}
    </text>
  )
}

export interface LcdDisplayProps {
  page: LcdPage
}

/**
 * The appliance's local 800×480 status display (BOM A.32; book §4.2 "machine status only, not
 * primary operator GUI"; §6.1 LCD Display Service), drawn as an SVG on the real 800×480 grid so
 * the text scales crisply. It re-renders at 1 Hz (the clock, R8) and cross-fades between pages
 * (160 ms, opacity only). Static texture, no loops. All copy is i18n (the simulator's front-panel model, step 54).
 */
export function LcdDisplay({ page }: LcdDisplayProps) {
  const { t } = useTranslation()
  // §3.2 (plan row W70): the label says "simulated" in Simulated mode only.
  const words = useDeviceWords()
  const m = useMotionPolicy()
  const uid = useId().replace(/:/g, '')
  const second = useSimSecond()
  const lcd = useSim(selectLcd)
  const now = second * 1000
  const index = LCD_PAGES.indexOf(page)
  const stateWord =
    lcd.system === 'RECORDING'
      ? t('devices.front.lcd.recording')
      : lcd.system === 'CRITICAL'
        ? t('devices.front.lcd.critical')
        : lcd.system === 'ATTENTION'
          ? t('devices.front.lcd.attention')
          : t('devices.front.lcd.ready')
  const pageTitle = t(`devices.front.pages.${page}`)

  let body: ReactNode
  switch (page) {
    case 'status':
      body = (
        <>
          <Line y={200} size={92} weight={700} color={SYSTEM_TONE[lcd.system]}>
            {stateWord}
            {lcd.recording && lcd.startedAt !== null ? (
              <tspan dx={28} fill={TEXT}>
                {formatDuration(now - lcd.startedAt)}
              </tspan>
            ) : null}
          </Line>
          <Line y={262} color={lcd.sessionId ? TEXT : DIM}>
            {lcd.sessionId ? t('devices.front.lcd.session', { id: lcd.sessionId }) : t('devices.front.lcd.noSession')}
          </Line>
          <Line y={310}>
            {t('devices.front.lcd.inputs', { cams: lcd.camsOk, camsTotal: lcd.camsTotal, mics: lcd.micsOk, micsTotal: lcd.micsTotal })}
          </Line>
          <Line y={358} color={DIM}>
            {t('devices.front.lcd.time', { time: formatClock(now), source: t(`common.enums.timeSource.${lcd.timeSource}`) })}
          </Line>
        </>
      )
      break
    case 'network':
      body = (
        <>
          <Line y={196} size={60} weight={700} color={GOLD}>
            {t('devices.front.lcd.ip', { ip: lcd.ip })}
          </Line>
          <Line y={250}>{t('devices.front.lcd.lan', { lan: lcd.lan, speed: lcd.speed })}</Line>
          <Line y={298} color={lcd.tablet === 'CONNECTED' ? statusText.success : statusText.warning}>
            {t('devices.front.lcd.tablet', { state: t(`common.tabletLinkState.${lcd.tablet}`) })}
          </Line>
          <Line y={346}>{t('devices.front.lcd.poe', { draw: lcd.poeDraw.toFixed(1), budget: lcd.poeBudget })}</Line>
          <Line y={394} color={DIM}>
            {t('devices.front.lcd.bandwidth', { down: lcd.down.toFixed(1), up: lcd.up.toFixed(1) })}
          </Line>
        </>
      )
      break
    case 'storage': {
      const barWidth = W - 80
      const tone =
        lcd.storageState === 'FULL' ? statusText.danger : lcd.storageState === 'LOW' ? statusText.warning : GOLD
      body = (
        <>
          <Line y={196} size={72} weight={700} color={tone}>
            {t('devices.front.lcd.used', { percent: lcd.usedPercent })}
          </Line>
          <rect x={40} y={222} width={barWidth} height={18} rx={4} fill="rgba(255,255,255,0.08)" />
          <rect x={40} y={222} width={(barWidth * Math.min(100, lcd.usedPercent)) / 100} height={18} rx={4} fill={tone} />
          <Line y={290}>
            {t('devices.front.lcd.free', {
              free: t('common.units.tb', { value: formatTb(lcd.freeBytes) }),
              total: t('common.units.tb', { value: formatTb(lcd.totalBytes) }),
            })}
          </Line>
          <Line y={338}>
            {t('devices.front.lcd.remaining', { hours: Math.floor(lcd.remainingMinutes / 60), minutes: lcd.remainingMinutes % 60 })}
          </Line>
          <Line y={386} color={DIM}>
            {t('devices.front.lcd.evidence', { state: t(`common.enums.storageState.${lcd.storageState}`) })}
          </Line>
        </>
      )
      break
    }
    case 'device':
      body = (
        <>
          <Line y={196} size={60} weight={700} color={GOLD}>
            {lcd.deviceId}
          </Line>
          <Line y={250}>{t('devices.front.lcd.deviceId', { id: lcd.deviceId, room: lcd.room })}</Line>
          <Line y={298}>{t('devices.front.lcd.firmware', { version: lcd.version })}</Line>
          <Line y={346}>{t('devices.front.lcd.serial', { serial: DEVICE_IDENTITY.serialNumber })}</Line>
          <Line y={394} color={lcd.tpmOk && lcd.secureBoot ? statusText.success : statusText.danger}>
            {t('devices.front.lcd.tpm', {
              state: lcd.tpmOk ? t('devices.status.OK') : t('devices.status.FAILED'),
              boot: lcd.secureBoot ? t('devices.front.lcd.on') : t('devices.front.lcd.off'),
            })}
          </Line>
        </>
      )
      break
  }

  return (
    <svg
      className="dev-lcd"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t(words.lcdLabel, { page: pageTitle })}
      data-testid="front-lcd"
      data-page={page}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1418" />
          <stop offset="1" stopColor="#05080A" />
        </linearGradient>
        <pattern id={`${uid}-scan`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="2" fill="rgba(255,255,255,0.028)" />
        </pattern>
        <radialGradient id={`${uid}-sheen`} cx="0.25" cy="0" r="0.9">
          <stop offset="0" stopColor="rgba(255,200,107,0.08)" />
          <stop offset="1" stopColor="rgba(255,200,107,0)" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} rx="14" fill={`url(#${uid}-bg)`} />
      <rect width={W} height={H} rx="14" fill={`url(#${uid}-sheen)`} />
      <rect width={W} height={H} rx="14" fill={`url(#${uid}-scan)`} />

      <Line y={52} size={24} color={GOLD} weight={600}>
        {lcd.deviceId}
      </Line>
      <Line y={52} size={24} x={W - 40} anchor="end" weight={600}>
        {formatClock(now)}
      </Line>
      <line x1={40} x2={W - 40} y1={72} y2={72} stroke="rgba(255,200,107,0.28)" strokeWidth={1.5} />

      {LCD_PAGES.map((name, position) => {
        const x = 40 + position * 182
        const active = name === page
        return (
          <g key={name}>
            <rect x={x} y={88} width={170} height={36} rx={6} fill={active ? 'rgba(255,200,107,0.16)' : 'transparent'} stroke={active ? GOLD : 'rgba(255,255,255,0.12)'} />
            <Line y={113} x={x + 85} anchor="middle" size={18} weight={600} color={active ? GOLD : DIM}>
              {t(`devices.front.pages.${name}`)}
            </Line>
          </g>
        )
      })}

      <AnimatePresence mode="wait" initial={false}>
        <motion.g
          key={page}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: m.seconds(m.reduced ? 120 : 160) }}
        >
          {body}
        </motion.g>
      </AnimatePresence>

      <line x1={40} x2={W - 40} y1={428} y2={428} stroke="rgba(255,255,255,0.1)" />
      <Line y={456} size={18} color={DIM}>
        {t('devices.front.lcd.hint')}
      </Line>
      <Line y={456} size={18} x={W - 40} anchor="end" color={DIM}>
        {t('devices.front.lcd.page', { current: index + 1, total: LCD_PAGES.length })}
      </Line>
    </svg>
  )
}
