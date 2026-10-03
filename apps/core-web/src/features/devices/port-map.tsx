import { useRef } from 'react'
import { Button, Chip, Tooltip } from '@heroui/react'
import { motion } from 'motion/react'
import { Cable, Mic, Plug, RadioTower, SatelliteDish, ToggleRight, Usb, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSim, type SimState } from '@dems/shared/sim'
import { useAmbientLoop, useMotionPolicy } from '@/motion'
import { useDeviceActions } from './context'
import { useDeviceLabels } from './labels'
import { LED_STAGGER_MS, PANEL_BEAT_MS, useStaggerVariants } from './motion'
import { bookPoe, REAR_PORT_DEVICE, REAR_PORT_ORDER, rearPorts, type PortLink, type RearPort, type RearPortId } from './sim-adapter'

type PortCode = `${PortLink}:${RearPort['activity']}`

/** Flat primitives only (review 40 M1): one `link:activity` code per port. */
function selectPortCodes(state: SimState): Record<RearPortId, PortCode> {
  const out = {} as Record<RearPortId, PortCode>
  for (const port of rearPorts(state)) out[port.id] = `${port.link}:${port.activity}`
  return out
}

const ICONS: Record<RearPortId, LucideIcon> = {
  AC_INPUT: Plug,
  POE_CAM_1: Cable,
  POE_CAM_2_AUX: Cable,
  MGMT_LAN: RadioTower,
  MIC_IN_1: Mic,
  MIC_IN_2: Mic,
  GNSS_SMA: SatelliteDish,
  RELAY_IO: ToggleRight,
  SERVICE_USB: Usb,
}

/**
 * Port map (01_specs §14.5.4; research/04 §5.2 "C2 Rear Panel"; book §4.2 rear panel): a grid
 * of kit `Chip`s with a link LED and a `Tooltip` each, left to right as the book lists the
 * connectors. The LEDs switch on 40 ms apart on enter; linked ports with traffic flicker at 1 Hz,
 * 2 Hz while recording streams flow (one `port-leds` loop, ≤ 2 Hz, M-C-23). PoE CAM 2/AUX is the
 * spare (the simulator's 2-port PoE model, D79) and SERVICE USB is disabled by default. A port opens its device's drawer.
 */
export function PortMap() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const labels = useDeviceLabels()
  const { open } = useDeviceActions()
  const codes = useSim(selectPortCodes)
  const poeDraw = useSim((s) => bookPoe(s).cam1DrawW)
  const speed = useSim((s) => s.network.linkSpeedMbps)
  const container = useStaggerVariants(PANEL_BEAT_MS.ports, LED_STAGGER_MS, REAR_PORT_ORDER.length)
  const gridRef = useRef<HTMLUListElement>(null)
  const anyActivity = REAR_PORT_ORDER.some((id) => !codes[id].endsWith(':none'))
  const loop = useAmbientLoop('port-leds', { ref: gridRef, group: 'port-leds', enabled: anyActivity })

  const tip = (id: RearPortId): string => {
    switch (id) {
      case 'POE_CAM_1':
        return t('devices.ports.tip.poeCam1', { watts: poeDraw.toFixed(1) })
      case 'POE_CAM_2_AUX':
        return t('devices.ports.tip.poeCam2')
      case 'MGMT_LAN':
        return t('devices.ports.tip.mgmtLan', { speed: speed })
      case 'MIC_IN_1':
      case 'MIC_IN_2':
        return t('devices.ports.tip.micIn')
      case 'GNSS_SMA':
        return t('devices.ports.tip.gnssSma')
      case 'RELAY_IO':
        return t('devices.ports.tip.relayIo')
      case 'AC_INPUT':
        return t('devices.ports.tip.acInput')
      case 'SERVICE_USB':
        return t('devices.ports.tip.serviceUsb')
    }
  }
  const linkWord = (link: PortLink): string =>
    link === 'up'
      ? t('devices.ports.linkUp')
      : link === 'down'
        ? t('devices.ports.linkDown')
        : link === 'spare'
          ? t('devices.ports.spare')
          : t('devices.ports.disabled')

  return (
    <motion.ul ref={gridRef} className="dev-ports" variants={container} initial="hidden" animate="visible" {...loop.attrs}>
      {REAR_PORT_ORDER.map((id) => {
        const [link, activity] = codes[id].split(':') as [PortLink, RearPort['activity']]
        const Icon = ICONS[id]
        const name = labels.port(id)
        const state = linkWord(link)
        const deviceId = REAR_PORT_DEVICE[id]
        const content = (
          <>
            <span className="dev-port-led" data-link={link} data-activity={activity} aria-hidden="true">
              <span className="dev-port-led-glow" />
            </span>
            <Icon className="dev-port-icon" aria-hidden="true" size={18} strokeWidth={1.6} />
            <Chip size="sm" variant="soft" color={link === 'up' ? 'success' : link === 'down' ? 'danger' : 'default'} className="dev-port-chip font-mono">
              <Chip.Label>{name}</Chip.Label>
            </Chip>
            <span className="dev-port-state">{state}</span>
          </>
        )
        const accessible = t('devices.ports.portState', { port: name, state })
        return (
          <motion.li key={id} className="dev-port" data-testid={`port-${id}`} data-link={link} variants={m.variants.fade}>
            <Tooltip delay={200}>
              {deviceId ? (
                <Button variant="ghost" className="dev-port-button" aria-label={`${accessible}. ${tip(id)}`} onPress={() => open(deviceId)}>
                  {content}
                </Button>
              ) : (
                <Tooltip.Trigger className="dev-port-button" aria-label={`${accessible}. ${tip(id)}`}>
                  {content}
                </Tooltip.Trigger>
              )}
              <Tooltip.Content placement="top" offset={8}>
                {tip(id)}
              </Tooltip.Content>
            </Tooltip>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}
