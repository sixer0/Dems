import { useRef, useState } from 'react'
import { Button, Tooltip } from '@heroui/react'
import { motion } from 'motion/react'
import { ChevronDown, ChevronUp, CornerDownLeft, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { useDeviceActions } from './context'
import { IdentifyRing } from './device-menu'
import { LcdDisplay } from './lcd-display'
import { LCD_PAGES, selectIsRecordingNow, type LcdPage } from './model'
import { LED_STAGGER_MS, PANEL_BEAT_MS, useStaggerVariants } from './motion'
import { frontPanelLeds, LED_IDS, LED_RANK, type LedId, type LedState } from './sim-adapter'

/**
 * Front panel (book §4.1–§4.2; BOM A.32–A.34; ICD-15): the local 800×480 status display, the
 * five LEDs POWER / RECORD / NETWORK / STORAGE / FAULT (the simulator's front-panel model derives them) and the four
 * navigation buttons UP / DOWN / ENTER / BACK. UP and DOWN cycle the LCD pages, BACK returns to
 * STATUS, ENTER opens the front panel's details. LEDs switch on 40 ms apart on enter (M-PG-DEV).
 */
export function FrontPanel() {
  const { t } = useTranslation()
  const { open } = useDeviceActions()
  const [page, setPage] = useState<LcdPage>('status')
  const leds = useSim(frontPanelLeds)
  const container = useStaggerVariants(PANEL_BEAT_MS.front, LED_STAGGER_MS)
  const step = (delta: number) =>
    setPage((current) => LCD_PAGES[(LCD_PAGES.indexOf(current) + delta + LCD_PAGES.length) % LCD_PAGES.length] ?? 'status')

  return (
    <div className="dev-front">
      <div className="dev-front-face">
        <div className="dev-front-lcd">
          <LcdDisplay page={page} />
          <IdentifyRing deviceId="FRONT-PANEL" />
        </div>
        <div className="dev-front-side">
          <motion.ul className="dev-leds" aria-label={t('devices.front.ledsLabel')} variants={container} initial="hidden" animate="visible">
            {LED_IDS.map((id) => (
              <Led key={id} id={id} state={leds[id]} />
            ))}
          </motion.ul>
          <div className="dev-front-buttons" role="group" aria-label={t('devices.front.buttonsLabel')}>
            <Button size="sm" variant="outline" className="dev-nav-btn" onPress={() => step(-1)} data-testid="lcd-up">
              <ChevronUp aria-hidden="true" size={14} />
              {t('devices.front.buttons.up')}
            </Button>
            <Button size="sm" variant="outline" className="dev-nav-btn" onPress={() => step(1)} data-testid="lcd-down">
              <ChevronDown aria-hidden="true" size={14} />
              {t('devices.front.buttons.down')}
            </Button>
            <Button size="sm" variant="outline" className="dev-nav-btn" onPress={() => open('FRONT-PANEL')} data-testid="lcd-enter">
              <CornerDownLeft aria-hidden="true" size={14} />
              {t('devices.front.buttons.enter')}
            </Button>
            <Button size="sm" variant="outline" className="dev-nav-btn" onPress={() => setPage('status')} data-testid="lcd-back">
              <Undo2 aria-hidden="true" size={14} />
              {t('devices.front.buttons.back')}
            </Button>
          </div>
        </div>
      </div>
      <p className="dev-front-plate">
        <span>{t('common.brand.wordmark')}</span>
        <span>{t('common.brand.tagline')}</span>
      </p>
    </div>
  )
}

/**
 * One front-panel LED (M-C-23): a lit dot with a pre-rendered glow. RECORD breathes over
 * `glowBreath` while recording (loop `rec-lamp`, shared with the room lamp); NETWORK flickers with
 * link activity at 1 Hz, 2 Hz while recording streams flow (loop `port-leds`, ≤ 2 Hz, P8). An
 * escalation plays one halo, then the colour holds (P7). Reduced motion: steady light.
 */
function Led({ id, state }: { id: LedId; state: LedState }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const ref = useRef<HTMLSpanElement>(null)
  const recording = useSim(selectIsRecordingNow)
  const recLoop = useAmbientLoop('rec-lamp', { ref, group: 'rec-lamp', enabled: state === 'rec' })
  const activityLoop = useAmbientLoop('port-leds', { ref, group: 'port-leds', enabled: state === 'activity' })
  const loop = state === 'rec' ? recLoop : activityLoop

  const [seen, setSeen] = useState({ state, pulses: 0 })
  let pulses = seen.pulses
  if (seen.state !== state) {
    pulses = LED_RANK[state] > LED_RANK[seen.state] ? seen.pulses + 1 : seen.pulses
    setSeen({ state, pulses })
  }
  const label = t(`devices.front.leds.${id}`)
  const stateText = t(`devices.front.ledState.${state}`)

  return (
    <motion.li className="dev-led" data-led={id} data-state={state} data-testid={`led-${id}`} variants={m.variants.fade}>
      <Tooltip delay={200}>
        <Tooltip.Trigger className="dev-led-trigger" aria-label={t('devices.front.ledTip', { led: label, state: stateText })}>
          <span ref={ref} className="dev-led-light" data-rate={recording ? 'fast' : 'slow'} {...loop.attrs}>
            <span className="dev-led-glow" />
            {pulses > 0 && m.flags.flashes ? (
              <motion.span key={pulses} className="dev-led-halo" variants={m.variants.halo} initial="hidden" animate="visible" />
            ) : null}
          </span>
          <span className="dev-led-label">{label}</span>
        </Tooltip.Trigger>
        <Tooltip.Content placement="left" offset={8}>
          {t('devices.front.ledTip', { led: label, state: stateText })}
        </Tooltip.Content>
      </Tooltip>
    </motion.li>
  )
}
