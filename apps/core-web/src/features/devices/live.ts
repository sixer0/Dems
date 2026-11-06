/**
 * What Devices & Inputs needs to read the same in both data modes (backend task, plan row W70;
 * 04_client_integration_spec §3.2, §8.1 LB-1, §8.3 B-7 and B-8, §8.4 D-5). Kept in a `.ts` module
 * so component files export only components.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `DEVICE_WORDS`, `useDeviceWords()` | The i18n keys of the words that say "simulated" in Simulated mode, and their Live twins (§3.2: a Live screen shows the Core's data and never says "simulated") |
 * | `DEVICE_COMMAND_OF` | The device command a kebab item sends |
 *
 * The late reveal of a busy control (LB-1) is the console's one implementation,
 * `usePendingReveal` of `@/lib/pending-control` (plan row W0); the page keeps its keyed in-flight
 * set (one command per device, several devices at once) in `index.tsx`.
 */
import { CoreMode, useCoreMode } from '@dems/shared/live'
import { DeviceCommand } from '@dems/shared/sim'
import type { DeviceAction } from './context'

/** The words per data mode. Simulated mode keeps the predecessor's keys, unchanged. */
export const DEVICE_WORDS = {
  [CoreMode.SIMULATED]: {
    testSignal: 'common.deviceMenu.testSignal',
    restart: 'common.deviceMenu.restart',
    testSignalSent: 'devices.actions.testSignalSent',
    restarted: 'devices.actions.restarted',
    lcdLabel: 'devices.front.lcdLabel',
    samples: 'devices.drawer.health.samples',
    feedAria: 'devices.cameras.feedAria',
  },
  [CoreMode.LIVE]: {
    testSignal: 'devices.live.menu.testSignal',
    restart: 'devices.live.menu.restart',
    testSignalSent: 'devices.live.actions.testSignalSent',
    restarted: 'devices.live.actions.restarted',
    lcdLabel: 'devices.live.lcdLabel',
    samples: 'devices.live.samples',
    feedAria: 'devices.live.feedAria',
  },
} as const

export type DeviceWords = (typeof DEVICE_WORDS)[CoreMode]

/** The words of the page's data mode. */
export function useDeviceWords(): DeviceWords {
  return DEVICE_WORDS[useCoreMode()]
}

/** The command of each kebab item that sends one (`details` opens the drawer and sends nothing). */
export const DEVICE_COMMAND_OF = {
  testSignal: DeviceCommand.TEST_SIGNAL,
  identify: DeviceCommand.IDENTIFY,
  restart: DeviceCommand.RESTART,
} as const satisfies Record<Exclude<DeviceAction, 'details'>, DeviceCommand>
