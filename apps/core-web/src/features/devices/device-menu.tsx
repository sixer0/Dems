import type { Key } from 'react'
import { Button, Description, Dropdown, Label, Spinner } from '@heroui/react'
import { motion } from 'motion/react'
import { Activity, EllipsisVertical, Info, Lightbulb, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDeviceCommandGate } from '@/lib/device-command-gate'
import { usePendingReveal } from '@/lib/pending-control'
import { useMotionPolicy } from '@/motion'
import { useDeviceActions, useIdentify, type DeviceAction } from './context'
import { useDeviceWords } from './live'
import { COMMANDABLE, IDENTIFY_BLINKS, IDENTIFY_PERIOD_MS, type DeviceId } from './sim-adapter'

export interface DeviceMenuProps {
  deviceId: DeviceId
  name: string
}

const ACTIONS: readonly DeviceAction[] = ['details', 'testSignal', 'identify', 'restart']

function isDeviceAction(key: Key): key is DeviceAction {
  return (ACTIONS as readonly Key[]).includes(key)
}

/**
 * Kebab `Dropdown` on an `isIconOnly` ghost `Button` (01_specs §14.5.4; research/04 §5.2): Details,
 * Test signal, Identify (blink) and Restart, all simulated `deviceCommand`s (audit DEVICE_COMMAND).
 * Test signal and Restart exist on the commandable devices; Identify on every device (step 54).
 * Each command follows the permission the Core server checks (FXR-W W92-14, the one gate of both
 * device menus, `lib/device-command-gate.ts`): Test signal and Identify DIAGNOSTICS_RUN, Restart
 * DEVICE_MANAGE and not while recording; a blocked item names the first role that holds it.
 *
 * Live mode (plan row W70; LB-1, §3.2): while a command of this device is out its three command
 * items are disabled (Details stays), and after `LIVE_PENDING_REVEAL_MS` the trigger shows the
 * kit's spinner in place of its icon. The kit's `Button` does not pass `aria-busy` on, so the
 * tile head that holds this menu carries it. The two command words lose "(simulated)".
 */
export function DeviceMenu({ deviceId, name }: DeviceMenuProps) {
  const { t } = useTranslation()
  const { run, pending } = useDeviceActions()
  const words = useDeviceWords()
  const busy = pending.has(deviceId)
  const showPending = usePendingReveal(busy)
  const m = useMotionPolicy()
  const commandable = COMMANDABLE.has(deviceId)
  // W92-14: the one gate of both device menus (`lib/device-command-gate.ts`): Test signal and Identify
  // by DIAGNOSTICS_RUN, Restart by DEVICE_MANAGE and not while recording, each role named by the first
  // one that holds the permission; LB-1 while a command of this device is out.
  const gate = useDeviceCommandGate(busy)
  const testReason = gate.reasonOf('testSignal')
  const identifyReason = gate.reasonOf('identify')
  const restartReason = gate.reasonOf('restart')
  const label = `${t('common.deviceMenu.label')}: ${name}`
  const disabledKeys = (['testSignal', 'identify', 'restart'] as const).filter((key) => gate.blocks[key] !== null)

  return (
    <Dropdown>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={label}
        className="dev-kebab"
        data-testid={`device-menu-${deviceId}`}
        // Only while the spinner shows: Simulated mode renders the trigger exactly as before.
        {...(showPending ? { isPending: true, 'data-pending': 'true' } : {})}
      >
        {showPending ? (
          <Spinner size="sm" color="current" aria-hidden="true" />
        ) : (
          <motion.span className="inline-flex" {...m.interactions.iconPress}>
            <EllipsisVertical aria-hidden="true" size={18} />
          </motion.span>
        )}
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[240px]">
        <Dropdown.Menu
          aria-label={label}
          disabledKeys={disabledKeys}
          onAction={(key) => {
            if (isDeviceAction(key)) run(deviceId, key)
          }}
        >
          <Dropdown.Item id="details" textValue={t('common.deviceMenu.details')}>
            <Info aria-hidden="true" size={16} />
            <Label>{t('common.deviceMenu.details')}</Label>
          </Dropdown.Item>
          {commandable ? (
            <Dropdown.Item id="testSignal" textValue={t(words.testSignal)}>
              <Activity aria-hidden="true" size={16} />
              <div className="flex flex-col">
                <Label>{t(words.testSignal)}</Label>
                {testReason ? <Description>{testReason}</Description> : null}
              </div>
            </Dropdown.Item>
          ) : null}
          <Dropdown.Item id="identify" textValue={t('common.deviceMenu.identify')}>
            <Lightbulb aria-hidden="true" size={16} />
            <div className="flex flex-col">
              <Label>{t('common.deviceMenu.identify')}</Label>
              {identifyReason ? <Description>{identifyReason}</Description> : null}
            </div>
          </Dropdown.Item>
          {commandable ? (
            <Dropdown.Item id="restart" textValue={t(words.restart)}>
              <RotateCcw aria-hidden="true" size={16} />
              <div className="flex flex-col">
                <Label>{t(words.restart)}</Label>
                {restartReason ? <Description>{restartReason}</Description> : null}
              </div>
            </Dropdown.Item>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

export interface IdentifyRingProps {
  deviceId: DeviceId
}

/**
 * The Identify blink (an audited IDENTIFY command): a gold ring over the device's tile or row blinks three
 * times at 2 Hz (P8: ≤ 3 flashes per second). Reduced motion: a steady ring while it lasts.
 */
export function IdentifyRing({ deviceId }: IdentifyRingProps) {
  const key = useIdentify(deviceId)
  const m = useMotionPolicy()
  if (key === null) return null
  const blinks = Array.from({ length: IDENTIFY_BLINKS }, () => [0, 1]).flat()
  return (
    <motion.span
      key={key}
      aria-hidden="true"
      className="dev-identify-ring"
      data-testid={`identify-${deviceId}`}
      initial={{ opacity: 0 }}
      animate={m.flags.flashes ? { opacity: [...blinks, 0] } : { opacity: 1 }}
      transition={
        m.flags.flashes
          ? { duration: m.seconds(IDENTIFY_BLINKS * IDENTIFY_PERIOD_MS), ease: 'linear' }
          : { duration: m.seconds(160) }
      }
    />
  )
}
