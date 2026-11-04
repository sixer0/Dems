/**
 * Page-level contexts for Devices & Inputs: device actions (open the drawer, kebab commands),
 * the Identify blink (audited by the simulator) and the microphone level sampler (the page's live view).
 */
import { createContext, useContext, useMemo, useState, useSyncExternalStore } from 'react'
import type { AudioTrackId } from '@dems/shared/domain'
import { useAudioChannel } from '@dems/shared/sim'
import { MicLevelSampler, type DeviceId, type HealthPoint } from './sim-adapter'

export type DeviceAction = 'details' | 'testSignal' | 'identify' | 'restart'

export interface DeviceActionsValue {
  open: (deviceId: DeviceId) => void
  run: (deviceId: DeviceId, action: DeviceAction) => void
  /**
   * The devices with a command out (Live mode, plan row W70; LB-1): from the press until the Core
   * server answered. Always empty in Simulated mode, where a command settles before the press returns.
   */
  pending: ReadonlySet<DeviceId>
}

const noop = () => undefined
const NONE: ReadonlySet<DeviceId> = new Set()
export const DeviceActionsContext = createContext<DeviceActionsValue>({ open: noop, run: noop, pending: NONE })

/** Whether `deviceId` has a command out (LB-1). */
export function useDevicePending(deviceId: DeviceId | null | undefined): boolean {
  // D60 (2026-11-04): a video track with no built-in device has nothing that can pend.
  const pending = useContext(DeviceActionsContext).pending
  return deviceId === null || deviceId === undefined ? false : pending.has(deviceId)
}

export function useDeviceActions(): DeviceActionsValue {
  return useContext(DeviceActionsContext)
}

/** The device currently blinking (Identify), with a key that changes on every request. */
export interface IdentifyValue {
  deviceId: DeviceId | null
  key: number
}
export const IdentifyContext = createContext<IdentifyValue>({ deviceId: null, key: 0 })

/** The Identify key while `deviceId` blinks, else null. */
export function useIdentify(deviceId: DeviceId): number | null {
  const value = useContext(IdentifyContext)
  return value.deviceId === deviceId ? value.key : null
}

export const MicSamplerContext = createContext<MicLevelSampler | null>(null)

/**
 * One sampler per page: both channels feed it through transient 20 Hz subscriptions (no React
 * renders), and it closes one 1 s peak point per simulator second.
 */
export function usePageMicSampler(): MicLevelSampler {
  const [sampler] = useState(() => new MicLevelSampler())
  useAudioChannel('AUDIO-01', (frame) => sampler.push('AUDIO-01', frame))
  useAudioChannel('AUDIO-02', (frame) => sampler.push('AUDIO-02', frame))
  return sampler
}

/** The sampled 1 s peaks of `channel`; re-renders at most once per simulator second. */
export function useMicPoints(channel: AudioTrackId | null): readonly HealthPoint[] {
  const sampler = useContext(MicSamplerContext)
  const version = useSyncExternalStore(
    sampler ? sampler.subscribe : subscribeNever,
    sampler ? sampler.getVersion : zero,
    zero,
  )
  // `version` changes when a point closes; the copy keeps the chart's data immutable.
  return useMemo(
    () => (sampler && channel && version >= 0 ? sampler.pointsOf(channel).slice() : []),
    [sampler, channel, version],
  )
}

function subscribeNever(): () => void {
  return noop
}

function zero(): number {
  return 0
}
