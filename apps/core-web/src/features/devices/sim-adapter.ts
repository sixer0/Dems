/**
 * Devices & Inputs reads over the simulator (step 48; step 54 closed W48-1..5 in
 * `packages/shared/src/sim`, so most views here re-export the simulator's):
 *
 * - **PoE (W48-1, D79).** The simulator models the design book's 2 ports: PoE CAM 1 powers the one
 *   dual-lens camera (both video tracks), PoE CAM 2/AUX is the spare ("0 W normal / reserve up to
 *   30 W", §8). `bookPoe()` maps `selectPoeStatus` to the page's view.
 * - **GNSS receiver and TPM / Secure Element (W48-2)** are the simulator's platform devices
 *   (`selectPlatformDevices`); they accept the IDENTIFY command.
 * - **Front panel (W48-3).** `frontPanelLeds` (and the LCD model `selectFrontPanel`) come from the
 *   simulator. The LED mapping is a demo assumption (01_explore §3 A.34 "[Gap]").
 * - **Health series (W48-4).** `healthSeries` is the simulator's `deviceHealthSeries`; microphones
 *   read its 1 Hz level history (full at load), or the page's own 20 Hz sampler when it has points.
 * - **Identify (W48-5).** `deviceCommand(id, 'IDENTIFY')` writes a DEVICE_COMMAND audit row; the
 *   indicator blinks 3 times at 2 Hz (P8).
 */
import { SessionState, type AudioTrackId, type VideoTrackId } from '@dems/shared/domain'
import type { AudioFrame, AuditRow, SimState } from '@dems/shared/sim'
import {
  DEVICE_HEALTH_POINTS,
  deviceHealthSeries,
  FaultKind,
  POE_PORT_BUDGET_W as SIM_POE_PORT_BUDGET_W,
  poeStatus,
  type DeviceHealthMetric,
  type DeviceHealthPoint,
  type DeviceHealthSeries,
  type FrontPanelLedId,
  type FrontPanelLedState,
} from '@dems/shared/sim'

export {
  DEVICE_HEALTH_METRIC as HEALTH_METRIC,
  DEVICE_HEALTH_POINTS as HEALTH_POINTS,
  frontPanelLeds,
  IDENTIFY_BLINKS,
  IDENTIFY_PERIOD_MS,
  LED_IDS,
  LED_RANK,
  type FrontPanelLeds,
} from '@dems/shared/sim'

// ── Device identity ──────────────────────────────────────────────────────────────────────
/** Every device the page lists (sim device IDs plus the platform devices GNSS, TPM, FRONT-PANEL). */
export const DEVICE_IDS = [
  'CAM-01',
  'CAM-02',
  'MIC-01',
  'MIC-02',
  'POE-SWITCH',
  'REC-INDICATOR',
  'TABLET',
  'GNSS',
  'TPM',
  'FRONT-PANEL',
] as const
export type DeviceId = (typeof DEVICE_IDS)[number]

export const CAMERA_DEVICE: Record<VideoTrackId, 'CAM-01' | 'CAM-02'> = { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02' }
export const MIC_DEVICE: Record<AudioTrackId, 'MIC-01' | 'MIC-02'> = { 'AUDIO-01': 'MIC-01', 'AUDIO-02': 'MIC-02' }
export const DEVICE_CAMERA: Partial<Record<DeviceId, VideoTrackId>> = { 'CAM-01': 'VIDEO-01', 'CAM-02': 'VIDEO-02' }
export const DEVICE_MIC: Partial<Record<DeviceId, AudioTrackId>> = { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02' }

/** Devices the simulator's `deviceCommand` accepts (TEST_SIGNAL, RESTART). */
export const COMMANDABLE: ReadonlySet<DeviceId> = new Set([
  'CAM-01',
  'CAM-02',
  'MIC-01',
  'MIC-02',
  'POE-SWITCH',
  'REC-INDICATOR',
  'TABLET',
])

export function isDeviceId(value: string | null | undefined): value is DeviceId {
  return value !== null && value !== undefined && (DEVICE_IDS as readonly string[]).includes(value)
}

// ── PoE, book view (W48-1) ───────────────────────────────────────────────────────────────
/** Book §8: PoE CAM 1 "up to a 30 W budget"; PoE port 2 "0 W normal / reserve up to 30 W". */
export const POE_PORT_BUDGET_W = SIM_POE_PORT_BUDGET_W

export interface BookPoe {
  /** PoE CAM 1 carries power and data while at least one lens streams. */
  cam1Link: boolean
  cam1DrawW: number
  /** Ports delivering power (0 or 1) and spare ports (always 1: CAM 2/AUX). */
  active: number
  spare: number
  total: number
  budgetW: number
  drawW: number
}

export function bookPoe(state: Pick<SimState, 'cameras' | 'network'>): BookPoe {
  const poe = poeStatus(state)
  return {
    cam1Link: poe.cam1Link,
    cam1DrawW: poe.drawW,
    active: poe.poweredPorts,
    spare: poe.sparePorts,
    total: poe.totalPorts,
    budgetW: poe.budgetW,
    drawW: poe.drawW,
  }
}

/** The PoE port shown on each lens tile: both lenses share PoE CAM 1 (book B.01, §4.2). */
export const CAMERA_POE_PORT = 'POE_CAM_1' as const

// ── Rear-panel ports (book §4.2) ─────────────────────────────────────────────────────────
export type RearPortId =
  | 'AC_INPUT'
  | 'POE_CAM_1'
  | 'POE_CAM_2_AUX'
  | 'MGMT_LAN'
  | 'MIC_IN_1'
  | 'MIC_IN_2'
  | 'GNSS_SMA'
  | 'RELAY_IO'
  | 'SERVICE_USB'

/** `up` / `down` link, `spare` (no load by design), `disabled` (off by default). */
export type PortLink = 'up' | 'down' | 'spare' | 'disabled'

export interface RearPort {
  id: RearPortId
  link: PortLink
  /** Link activity blink (≤ 2 Hz, M-C-23): `fast` while recording streams flow. */
  activity: 'none' | 'slow' | 'fast'
  /** Device the port belongs to (opens the drawer), or null. */
  deviceId: DeviceId | null
}

/** Rear panel left to right, as the book lists it (§4.2; RECOVERY BUTTON is not a port). */
export const REAR_PORT_ORDER: readonly RearPortId[] = [
  'AC_INPUT',
  'POE_CAM_1',
  'POE_CAM_2_AUX',
  'MGMT_LAN',
  'MIC_IN_1',
  'MIC_IN_2',
  'GNSS_SMA',
  'RELAY_IO',
  'SERVICE_USB',
]

function simPortLink(state: Pick<SimState, 'ports'>, id: string): boolean {
  return state.ports.find((port) => port.id === id)?.link ?? false
}

function faultActive(state: Pick<SimState, 'faults'>, kind: FaultKind): boolean {
  return state.faults.active.some((fault) => fault.kind === kind)
}

/** The device drawer each rear-panel port opens (null: nothing to open). */
export const REAR_PORT_DEVICE: Record<RearPortId, DeviceId | null> = {
  AC_INPUT: 'FRONT-PANEL',
  POE_CAM_1: 'POE-SWITCH',
  POE_CAM_2_AUX: 'POE-SWITCH',
  MGMT_LAN: 'TABLET',
  MIC_IN_1: 'MIC-01',
  MIC_IN_2: 'MIC-02',
  GNSS_SMA: 'GNSS',
  RELAY_IO: 'REC-INDICATOR',
  SERVICE_USB: null,
}

export function rearPorts(state: Pick<SimState, 'cameras' | 'network' | 'ports' | 'faults' | 'tabletLink' | 'session'>): RearPort[] {
  const recording = state.session?.state === SessionState.RECORDING
  const poe = bookPoe(state)
  const tabletUp = state.tabletLink.state === 'CONNECTED'
  const up = (link: boolean): PortLink => (link ? 'up' : 'down')
  const port = (id: RearPortId, link: PortLink, activity: RearPort['activity'] = 'none'): RearPort => ({
    id,
    link,
    activity,
    deviceId: REAR_PORT_DEVICE[id],
  })
  return [
    port('AC_INPUT', up(!faultActive(state, FaultKind.POWER_FAIL))),
    port('POE_CAM_1', up(poe.cam1Link), poe.cam1Link ? (recording ? 'fast' : 'slow') : 'none'),
    port('POE_CAM_2_AUX', 'spare'),
    port(
      'MGMT_LAN',
      up(simPortLink(state, 'MGMT_LAN') && state.network.linkUp),
      tabletUp && state.network.linkUp ? (recording ? 'fast' : 'slow') : 'none',
    ),
    port('MIC_IN_1', up(simPortLink(state, 'MIC_IN_1'))),
    port('MIC_IN_2', up(simPortLink(state, 'MIC_IN_2'))),
    port('GNSS_SMA', up(simPortLink(state, 'GNSS_SMA'))),
    port('RELAY_IO', up(simPortLink(state, 'RELAY_IO'))),
    port('SERVICE_USB', 'disabled'),
  ]
}

// ── Front-panel LEDs (W48-3): the simulator's model ──────────────────────────────────────
export type LedId = FrontPanelLedId
/**
 * `on` steady green; `activity` green with a ≤ 2 Hz link blink; `rec` red, breathing over
 * `glowBreath`; `warn` steady amber; `fault` steady red; `off` dark. Escalations pulse once (P7).
 */
export type LedState = FrontPanelLedState

// ── Health series (W48-4): the simulator's per-device series ─────────────────────────────
export type HealthMetric = DeviceHealthMetric
export type HealthPoint = DeviceHealthPoint
export type HealthSeries = DeviceHealthSeries

/**
 * The device's health chart (the simulator's `deviceHealthSeries`). `micPoints` (the page's 20 Hz
 * sampler) override the microphone series once it has points; before that the simulator's 1 Hz
 * level history (full at load) is shown.
 */
export function healthSeries(state: SimState, deviceId: DeviceId, micPoints: readonly HealthPoint[] = []): HealthSeries {
  return deviceHealthSeries(state, deviceId, micPoints)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * 1 s peak sampler for both microphone channels (the page's live view; the simulator keeps its own
 * 1 Hz history since step 54). Feed it every audio frame
 * (`push`), it closes one point per simulator second. Holds `DEVICE_HEALTH_POINTS` points per channel.
 * Framework-free, so it is unit-testable; the page wraps it in a hook.
 */
export class MicLevelSampler {
  private readonly points: Record<AudioTrackId, HealthPoint[]> = { 'AUDIO-01': [], 'AUDIO-02': [] }
  private readonly open: Record<AudioTrackId, { second: number; peak: number } | null> = { 'AUDIO-01': null, 'AUDIO-02': null }
  private readonly listeners = new Set<() => void>()
  private version = 0

  push(channel: AudioTrackId, frame: Pick<AudioFrame, 'at' | 'dbfs' | 'noSignal'>): void {
    const second = Math.floor(frame.at / 1000)
    const level = frame.noSignal ? -90 : frame.dbfs
    const current = this.open[channel]
    if (current && current.second === second) {
      current.peak = Math.max(current.peak, level)
      return
    }
    if (current) {
      const list = this.points[channel]
      list.push({ t: current.second * 1000, v: round1(current.peak) })
      if (list.length > DEVICE_HEALTH_POINTS) list.splice(0, list.length - DEVICE_HEALTH_POINTS)
      this.version += 1
      for (const listener of this.listeners) listener()
    }
    this.open[channel] = { second, peak: level }
  }

  pointsOf(channel: AudioTrackId): readonly HealthPoint[] {
    return this.points[channel]
  }

  getVersion = (): number => this.version

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

// ── Device log (audit rows per device) ───────────────────────────────────────────────────
const FAULT_DEVICE: Partial<Record<FaultKind, DeviceId>> = {
  GNSS_LOSS: 'GNSS',
  TPM_FAILURE: 'TPM',
  SECURITY_FAULT: 'TPM',
  FAN_STALL: 'FRONT-PANEL',
  POWER_FAIL: 'FRONT-PANEL',
}

/** Which device an audit row belongs to, or null (rows carry `deviceId` or a fault `kind`). */
export function auditRowDevice(row: Pick<AuditRow, 'deviceId' | 'type' | 'details'>): DeviceId | null {
  if (row.type === 'RECORDING_STARTED' || row.type === 'RECORDING_STOPPED') return 'REC-INDICATOR'
  if (row.type === 'SYSTEM_BOOT') return 'FRONT-PANEL'
  const kind = typeof row.details.kind === 'string' ? (row.details.kind as FaultKind) : null
  if (kind && FAULT_DEVICE[kind]) return FAULT_DEVICE[kind] ?? null
  if (kind === FaultKind.TAMPER && row.details.target == null) return 'FRONT-PANEL'
  return isDeviceId(row.deviceId) ? row.deviceId : null
}

/** Newest first, at most `limit` rows. */
export function deviceLog(rows: readonly AuditRow[], deviceId: DeviceId, limit = 25): AuditRow[] {
  const out: AuditRow[] = []
  for (let index = rows.length - 1; index >= 0 && out.length < limit; index -= 1) {
    const row = rows[index]
    if (row && auditRowDevice(row) === deviceId) out.push(row)
  }
  return out
}
