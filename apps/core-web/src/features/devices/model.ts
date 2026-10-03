/**
 * Devices & Inputs view model (01_specs §14.5.4; research/04 §5.2). Pure selectors over
 * `SimState` that return primitives or flat records, so `useSim` (shallow compare) re-renders a
 * component only when what it shows changes (03_motion_spec §9.3). The derived devices of the
 * simulator views come from `sim-adapter.ts`.
 */
import { SessionState } from '@dems/shared/domain'
import type { SimState } from '@dems/shared/sim'
import { bookPoe, rearPorts, type DeviceId } from './sim-adapter'

export type DeviceStatusCode =
  | 'READY'
  | 'FAULT'
  | 'NO_SIGNAL'
  | 'CLIP'
  | 'ACTIVE'
  | 'CONNECTED'
  | 'OFFLINE'
  | 'LOCKED'
  | 'NO_FIX'
  | 'OK'
  | 'FAILED'
  | 'STANDBY'
  | 'LAMP_ON'

export type DeviceTone = 'success' | 'warning' | 'danger' | 'default'

/** Chip tone per status (S8 tone map; the lit lamp is red because it is red, not because it failed). */
export const STATUS_TONE: Record<DeviceStatusCode, DeviceTone> = {
  READY: 'success',
  ACTIVE: 'success',
  CONNECTED: 'success',
  LOCKED: 'success',
  OK: 'success',
  STANDBY: 'success',
  LAMP_ON: 'danger',
  NO_SIGNAL: 'warning',
  CLIP: 'warning',
  OFFLINE: 'warning',
  NO_FIX: 'warning',
  FAULT: 'danger',
  FAILED: 'danger',
}

/** 0 healthy, 1 needs attention, 2 fault. Drives the banner, counts and escalation pulses (R8). */
export const STATUS_SEVERITY: Record<DeviceStatusCode, 0 | 1 | 2> = {
  READY: 0,
  ACTIVE: 0,
  CONNECTED: 0,
  LOCKED: 0,
  OK: 0,
  STANDBY: 0,
  LAMP_ON: 0,
  NO_SIGNAL: 1,
  CLIP: 1,
  OFFLINE: 1,
  NO_FIX: 1,
  FAULT: 2,
  FAILED: 2,
}

/** Devices counted by the banner (the front panel is the appliance itself, not a device). */
export const COUNTED_DEVICES = [
  'CAM-01',
  'CAM-02',
  'MIC-01',
  'MIC-02',
  'POE-SWITCH',
  'REC-INDICATOR',
  'TABLET',
  'GNSS',
  'TPM',
] as const satisfies readonly DeviceId[]
export type CountedDeviceId = (typeof COUNTED_DEVICES)[number]

export const OTHER_DEVICES = ['POE-SWITCH', 'REC-INDICATOR', 'TABLET', 'GNSS', 'TPM'] as const satisfies readonly DeviceId[]
export type OtherDeviceId = (typeof OTHER_DEVICES)[number]

type StatusInput = Pick<SimState, 'cameras' | 'mics' | 'network' | 'session' | 'tabletLink' | 'time' | 'security'>

export function deviceStatus(state: StatusInput, id: DeviceId): DeviceStatusCode {
  switch (id) {
    case 'CAM-01':
    case 'CAM-02': {
      const camera = state.cameras.find((entry) => entry.deviceId === id)
      return camera && camera.online && camera.lens === 'READY' ? 'READY' : 'FAULT'
    }
    case 'MIC-01':
    case 'MIC-02': {
      const mic = state.mics.find((entry) => entry.deviceId === id)
      if (!mic) return 'FAULT'
      if (mic.state === 'NO_SIGNAL') return 'NO_SIGNAL'
      if (mic.state === 'CLIP' || mic.clipLatched) return 'CLIP'
      return 'READY'
    }
    case 'POE-SWITCH':
      return bookPoe(state).cam1Link ? 'ACTIVE' : 'FAULT'
    case 'REC-INDICATOR':
      return state.session?.state === SessionState.RECORDING ? 'LAMP_ON' : 'STANDBY'
    case 'TABLET':
      return state.tabletLink.state === 'CONNECTED' ? 'CONNECTED' : 'OFFLINE'
    case 'GNSS':
      return state.time.gnss.locked && state.time.source === 'GNSS' ? 'LOCKED' : 'NO_FIX'
    case 'TPM':
      return state.security.tpm.ok ? 'OK' : 'FAILED'
    case 'FRONT-PANEL':
      return 'READY'
  }
}

export type StatusMap = Record<CountedDeviceId, DeviceStatusCode>

/** Every counted device's status, as one flat record (shallow-stable for `useSim`). */
export function selectStatusMap(state: SimState): StatusMap {
  const out = {} as StatusMap
  for (const id of COUNTED_DEVICES) out[id] = deviceStatus(state, id)
  return out
}

export type BannerKind = 'READY' | 'RECORDING' | 'ATTENTION' | 'CRITICAL'

export interface BannerModel {
  kind: BannerKind
  ready: number
  total: number
  issues: number
  /** The most severe device (first in page order on a tie), or null. */
  worst: CountedDeviceId | null
  worstCode: DeviceStatusCode | null
}

export const BANNER_RANK: Record<BannerKind, number> = { READY: 0, RECORDING: 0, ATTENTION: 1, CRITICAL: 2 }
export const BANNER_TONE: Record<BannerKind, DeviceTone> = {
  READY: 'success',
  RECORDING: 'success',
  ATTENTION: 'warning',
  CRITICAL: 'danger',
}

export function selectBanner(state: SimState): BannerModel {
  let ready = 0
  let worst: CountedDeviceId | null = null
  let worstSeverity = 0
  for (const id of COUNTED_DEVICES) {
    const severity = STATUS_SEVERITY[deviceStatus(state, id)]
    if (severity === 0) ready += 1
    if (severity > worstSeverity) {
      worstSeverity = severity
      worst = id
    }
  }
  const total = COUNTED_DEVICES.length
  const kind: BannerKind =
    worstSeverity === 2
      ? 'CRITICAL'
      : worstSeverity === 1
        ? 'ATTENTION'
        : state.session?.state === SessionState.RECORDING
          ? 'RECORDING'
          : 'READY'
  return {
    kind,
    ready,
    total,
    issues: total - ready,
    worst,
    worstCode: worst ? deviceStatus(state, worst) : null,
  }
}

export interface SummaryModel {
  camsOk: number
  camsTotal: number
  camsTone: DeviceTone
  micsOk: number
  micsTotal: number
  micsTone: DeviceTone
  otherOk: number
  otherTotal: number
  otherTone: DeviceTone
  portsUp: number
  portsTotal: number
  portsTone: DeviceTone
  portsSpare: number
  portsDisabled: number
}

const SEVERITY_TONE: Record<0 | 1 | 2, DeviceTone> = { 0: 'success', 1: 'warning', 2: 'danger' }

function worstTone(state: StatusInput, ids: readonly DeviceId[]): DeviceTone {
  let worst: 0 | 1 | 2 = 0
  for (const id of ids) {
    const severity = STATUS_SEVERITY[deviceStatus(state, id)]
    if (severity > worst) worst = severity
  }
  return SEVERITY_TONE[worst]
}

/** The four metric cards. Ports count the monitored links (spare and disabled ports excluded). */
export function selectSummary(state: SimState): SummaryModel {
  const ok = (id: DeviceId) => STATUS_SEVERITY[deviceStatus(state, id)] === 0
  const ports = rearPorts(state)
  const monitored = ports.filter((port) => port.link === 'up' || port.link === 'down')
  const portsUp = monitored.filter((port) => port.link === 'up').length
  const cams = ['CAM-01', 'CAM-02'] as const
  const mics = ['MIC-01', 'MIC-02'] as const
  return {
    camsOk: cams.filter(ok).length,
    camsTotal: cams.length,
    camsTone: worstTone(state, cams),
    micsOk: mics.filter(ok).length,
    micsTotal: mics.length,
    micsTone: worstTone(state, mics),
    otherOk: OTHER_DEVICES.filter(ok).length,
    otherTotal: OTHER_DEVICES.length,
    otherTone: worstTone(state, OTHER_DEVICES),
    portsUp,
    portsTotal: monitored.length,
    portsTone: portsUp === monitored.length ? 'success' : 'warning',
    portsSpare: ports.filter((port) => port.link === 'spare').length,
    portsDisabled: ports.filter((port) => port.link === 'disabled').length,
  }
}

export const selectIsRecordingNow = (state: SimState): boolean => state.session?.state === SessionState.RECORDING
/** The four LCD pages (book §4.2 "machine status only"), cycled with UP / DOWN; BACK goes home. */
export const LCD_PAGES = ['status', 'network', 'storage', 'device'] as const
export type LcdPage = (typeof LCD_PAGES)[number]

/** Terabytes with one decimal, as every storage surface shows them (D28/Q1: "3.2 TB free of 4.0 TB"). */
export function formatTb(bytes: number): string {
  return (bytes / 1e12).toFixed(1)
}
