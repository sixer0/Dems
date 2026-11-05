/**
 * Devices & Inputs view model (01_specs §14.5.4; research/04 §5.2). Pure selectors over
 * `SimState` that return primitives or flat records, so `useSim` (shallow compare) re-renders a
 * component only when what it shows changes (03_motion_spec §9.3). The derived devices of the
 * simulator views come from `sim-adapter.ts`.
 */
import { SessionState, type AudioTrackId, type VideoTrackId } from '@dems/shared/domain'
import { cameraLinesInForce, captureMicLines, isHostClockTime, isPlatformNotReported, isSlotSourceUp, micChannelOfTrack, selectorInForce, slotSourceOf, SlotSourceState, type SimState } from '@dems/shared/sim'
import { bookPoe, DEVICE_CAMERA, DEVICE_MIC, rearPorts, type DeviceId } from './sim-adapter'

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
  'CAM-03', // D60 (2026-11-04): the banner counts all four built-in cameras
  'CAM-04', // D60
  'MIC-01',
  'MIC-02',
  'MIC-03', // D61 (2026-11-04): the banner counts all four built-in microphones
  'MIC-04', // D61
  'POE-SWITCH',
  'REC-INDICATOR',
  'TABLET',
  'GNSS',
  'TPM',
] as const satisfies readonly DeviceId[]
export type CountedDeviceId = (typeof COUNTED_DEVICES)[number]

export const OTHER_DEVICES = ['POE-SWITCH', 'REC-INDICATOR', 'TABLET', 'GNSS', 'TPM'] as const satisfies readonly DeviceId[]
export type OtherDeviceId = (typeof OTHER_DEVICES)[number]

type StatusInput = Pick<SimState, 'cameras' | 'mics' | 'network' | 'session' | 'tabletLink' | 'time' | 'security' | 'captureConfig' | 'captureDevices'>

/**
 * Row 129 (DF-11 web, U-05; decisions D24, D90; register R1-R3): THE SOURCE A TRACK HOLDS NOW and what the Core
 * states of its reach. The line of the selector in force (the open session's snapshot, else the stored selector)
 * names the device; the device entry of `captureDevices` carries the Core's reading (`reach` + `checkedAt`, row 125)
 * and the registry flag `online`.
 *
 * | Result | When |
 * |---|---|
 * | `UNASSIGNED` | no line holds the track (the selector leaves it empty) |
 * | `NOT_REACHABLE` | the Core states `reach: NOT_REACHABLE`, or the line or the device reads `online: false` (the start rule `captureReachabilityOf` reads the same flag), or the registry does not hold the device |
 * | `REACHABLE` | the Core states `reach: REACHABLE` |
 * | `NOT_STATED` | anything else: no reading is stated, so nothing is added to the track's own state |
 */
export type AssignedReach = 'UNASSIGNED' | 'NOT_REACHABLE' | 'REACHABLE' | 'NOT_STATED'

export interface AssignedSource {
  /** The device the line names, or null on an unassigned track. */
  readonly deviceId: string | null
  readonly reach: AssignedReach
}

type SourceInput = Pick<SimState, 'session' | 'captureConfig' | 'captureDevices'>

export function trackSourceOf(state: SourceInput, trackId: VideoTrackId | AudioTrackId): AssignedSource {
  // Row 128b (D100 (3)): the shared reader `slotSourceOf` (row 128, `@dems/shared/sim` capture-notices) decides, so the
  // tiles, the Core's operations 44 / 45 / 46 and the pre-check read ONE rule. This function keeps the web's names.
  const video = trackId.startsWith('VIDEO-')
  const slot = video ? (trackId as VideoTrackId) : micChannelOfTrack(trackId as AudioTrackId)
  const source = slotSourceOf(selectorInForce(state), state.captureDevices.devices, slot)
  if (source.state === SlotSourceState.NOT_ASSIGNED || source.deviceId === null) return { deviceId: null, reach: 'UNASSIGNED' }
  // The selector line's own flag still counts, as it did before the delegation (the shared reader reads the registry entry).
  const lineOnline = video ? cameraLinesInForce(state).find((camera) => camera.trackId === slot)?.online : captureMicLines(state).find((mic) => mic.channel === slot)?.online
  if (!isSlotSourceUp(source) || lineOnline === false) return { deviceId: source.deviceId, reach: 'NOT_REACHABLE' }
  return { deviceId: source.deviceId, reach: source.state === SlotSourceState.REACHABLE ? 'REACHABLE' : 'NOT_STATED' }
}

/**
 * Row 129 (DF-11 web, U-05): THE STATUS OF A TRACK - one reader for the Devices tiles, the audio cards, the
 * banner, the summary, the drawer and the Dashboard tiles, so the two pages cannot disagree.
 *
 * Until row 129 the Devices page looked a microphone up by the BUILT-IN device id (`MIC-01`) in the `mics` slice,
 * whose rows carry the device of their channel since row 92 (D39: AUDIO-01..04 = MIC-03..06 on the bench): no row
 * named MIC-01 / MIC-02 any more, so MIC 1 and MIC 2 read FAULT on /devices while the Dashboard, which reads the
 * row of the TRACK, read READY (U-05). Both now read the row of the track, then the source the track holds:
 * an unassigned track is OFFLINE, a source the Core cannot reach is FAULT (never READY), else the track's own state.
 */
export function trackStatus(state: Omit<StatusInput, 'network' | 'tabletLink' | 'time' | 'security'>, trackId: VideoTrackId | AudioTrackId): DeviceStatusCode {
  const source = trackSourceOf(state, trackId)
  if (source.reach === 'UNASSIGNED') return 'OFFLINE'
  if (trackId.startsWith('VIDEO-')) {
    const camera = state.cameras.find((entry) => entry.id === trackId)
    if (source.reach === 'NOT_REACHABLE') return 'FAULT'
    return camera && camera.online && camera.lens === 'READY' ? 'READY' : 'FAULT'
  }
  const mic = state.mics.find((entry) => entry.id === trackId)
  if (!mic || source.reach === 'NOT_REACHABLE') return 'FAULT'
  if (mic.state === 'NO_SIGNAL') return 'NO_SIGNAL'
  if (mic.state === 'CLIP' || mic.clipLatched) return 'CLIP'
  return 'READY'
}

export function deviceStatus(state: StatusInput, id: DeviceId): DeviceStatusCode {
  switch (id) {
    // D60 (2026-11-04): the four built-in camera ids are the identities of the four video tracks.
    // Row 129 (DF-11): they read the TRACK and the source it holds (`trackStatus`), never a row found by device id.
    case 'CAM-01':
    case 'CAM-02':
    case 'CAM-03':
    case 'CAM-04':
      return trackStatus(state, DEVICE_CAMERA[id] as VideoTrackId)
    // D61 (2026-11-04): the four built-in microphone ids are the identities of the four channels (the audio card's
    // line). Row 129 (U-05): read by the channel's track, as the Dashboard reads it.
    case 'MIC-01':
    case 'MIC-02':
    case 'MIC-03':
    case 'MIC-04':
      return trackStatus(state, DEVICE_MIC[id] as AudioTrackId)
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

/**
 * Row 129 (controller routing D92; DF-11): WHICH DRAWER "View device" of the camera search opens. The built-in drawer
 * (`device-drawer.tsx`) shows the TRACK identity CAM-01..04 / MIC-01..04 with the demonstration model's facts. On a
 * Core in real capture a found camera's id names a REGISTRY device (the bench's CAM-03 is a real camera on VIDEO-01),
 * so the drawer is the one built from the Core's device list - the same rule as the tiles: the device, never the
 * built-in row. In the simulator a counted id keeps the built-in drawer; any other built-in source id has no drawer
 * (the selector is scrolled to, as before row 129).
 */
export type ViewDeviceTarget = 'BUILT_IN_DRAWER' | 'REGISTERED_DRAWER' | 'SELECTOR'

export function viewDeviceTarget(deviceId: string, realCaptureCore: boolean, builtInSourceIds: readonly string[]): ViewDeviceTarget {
  if (realCaptureCore) return 'REGISTERED_DRAWER'
  if ((COUNTED_DEVICES as readonly string[]).includes(deviceId)) return 'BUILT_IN_DRAWER'
  return builtInSourceIds.includes(deviceId) ? 'SELECTOR' : 'REGISTERED_DRAWER'
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

/**
 * The devices the banner counts on THIS Core (fix wave K, C-2 / G75c-04): a Core on its host clock
 * has no GNSS receiver (it would count "GNSS Receiver: NO FIX" for ever), and a Core that states
 * `security.platformNotReported` reads no TPM (it would count an "OK" nobody read). A TPM that shows
 * a fault stays counted. The simulated device counts all of them, as before.
 */
export function countedDevicesOf(state: Pick<SimState, 'time' | 'security'>): readonly CountedDeviceId[] {
  const hostClock = isHostClockTime(state.time)
  const tpmNotRead = isPlatformNotReported(state.security) && state.security.tpm.ok
  if (!hostClock && !tpmNotRead) return COUNTED_DEVICES
  return COUNTED_DEVICES.filter((id) => !(id === 'GNSS' && hostClock) && !(id === 'TPM' && tpmNotRead))
}

export function selectBanner(state: SimState): BannerModel {
  let ready = 0
  let worst: CountedDeviceId | null = null
  let worstSeverity = 0
  const counted = countedDevicesOf(state)
  for (const id of counted) {
    const severity = STATUS_SEVERITY[deviceStatus(state, id)]
    if (severity === 0) ready += 1
    if (severity > worstSeverity) {
      worstSeverity = severity
      worst = id
    }
  }
  const total = counted.length
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
  // D60 (2026-11-04): the summary counts the four built-in cameras of the four-track surface.
  const cams = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'] as const
  // D61 (2026-11-04): the summary counts the four simultaneous microphone channels.
  const mics = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const
  const counted: readonly string[] = countedDevicesOf(state)
  const otherCounted = OTHER_DEVICES.filter((id) => counted.includes(id))
  return {
    camsOk: cams.filter(ok).length,
    camsTotal: cams.length,
    camsTone: worstTone(state, cams),
    micsOk: mics.filter(ok).length,
    micsTotal: mics.length,
    micsTone: worstTone(state, mics),
    // Fix wave L (G75d-07): the card counts what the banner counts - "4/5 - 1 issue" stood beside "ALL DEVICES READY 7/7"
    // on a Core that has no GNSS receiver and reads no TPM (`countedDevicesOf`). The simulated device counts all five.
    otherOk: otherCounted.filter(ok).length,
    otherTotal: otherCounted.length,
    otherTone: worstTone(state, otherCounted),
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
