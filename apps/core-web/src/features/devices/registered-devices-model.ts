/**
 * The registered devices beyond the built-in ids, as the Devices page draws them (task 3, R-11,
 * blueprint row 140; rulings D137 (2), D128, D136 (3); `masterplan/08_client_ux_spec.md` §8f flow 12,
 * §8f.3 "The local-device rows"). Kept in a `.ts` module so the component files export only
 * components.
 *
 * **Why this exists.** The page's tiles, audio cards and drawer are keyed by a CLOSED set of ids
 * (`CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`, ...) with the simulator's device views behind them. The
 * Core registers more: this Mac's camera and microphone (`CAM-03` / `MIC-03`, D106 (4): NEW devices
 * with their own ids) and every camera an operator added (operation 96). Those had no card. The
 * roster here is built from the Core's own device list — the replicated `captureDevices` slice
 * (operation 77) — and from nothing else: no id is invented, no device is assumed.
 *
 * | Fact of a card | From (never client state) |
 * |---|---|
 * | which devices | `captureDevices.devices` of kind CAMERA / MIC, except a built-in id that stands on its OWN line - the one device the page's tile already draws (`drawnByOwnTile`; audit row 131, DF-16) |
 * | development badge, kind text | `sourceClass`, `adapter` of the device (ux §8f.1 "Decided by the Core") |
 * | 'is on' | `sourceOpen` of the device (SEC35-44 (4)) — an OPTIONAL member of the shared `captureDevices` slice (`packages/shared/src/api/state-slices.ts`): absent or false = nothing is drawn |
 * | used as | the selector line that names the device (`captureConfig`, operation 76) |
 * | state | `online`, and the named cause of the active "not reachable" notice of that device (flow 11 situation B; §8f.3) |
 * | rate warning | an active advisory alert `params.reason: MIC_RATE_AT_LIMIT` whose `target` is the device (ruling D144 (4)) |
 *
 * **Never silently replaced (D80(11)).** A local device that is not reachable stays the same card
 * with the same name and the same badge; nothing here offers a test source in its place.
 */
import type { TFunction } from 'i18next'
import { useMemo } from 'react'
import type { VideoTrackId } from '@dems/shared/domain'
import { audioTrackOfMicChannel, useSim, type MicChannel, type SimAlert, type SimState } from '@dems/shared/sim' // D61 (2026-11-04): the four microphone channels
import { activeCaptureNotices, micInputName } from '@/lib/capture-notices'
import { localDeviceState, type LocalDeviceState } from './capture-inputs'
import { trackStatus, type DeviceStatusCode } from './model'
import type { CaptureConfig, CaptureDevice } from './capture-selector'
import { restingSourceChecked } from './own-core-words'
import { DEVICE_CAMERA } from './sim-adapter'
import { LOCAL_DEVICE_ADAPTER, TEST_SOURCE_ADAPTER, isDevelopmentSource, isLocalSourceOn, type SourceDeviceKind } from './source-class'
import { trackReachOf } from './track-reach'

/** The ids the page's own tiles and audio cards already draw (D60, 2026-11-04: four cameras; D61, 2026-11-04: four microphones). Every other camera or microphone of the Core's list is a roster card. */
// D60 (2026-11-04): the four-track capture surface ships four built-in cameras — the simulator seeds
// CAM-03/CAM-04 as built-ins (`sim/initial-state.ts`, and `RETIRE_BUILT_IN_DEVICE_IDS` names them).
// Without them here the Devices page drew a roster card beside the track's own tile (Fix wave L's rule).
// D61 (2026-11-04): the four-channel microphone plane seeds MIC-03/MIC-04 the same way (nine built-ins).
export const BUILT_IN_SOURCE_IDS: readonly string[] = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']

/** `params.reason` of the advisory alert of a microphone whose rate controller is at its limit (capture protocol 4; `sim/capture-notices.ts`). */
export const MIC_RATE_AT_LIMIT = 'MIC_RATE_AT_LIMIT'

// D60 (2026-11-04): four video slots. D61 (2026-11-04): the roster names any of the four microphone
// CHANNELS — the PRIMARY/STANDBY roles of the earlier eras became the numbered channels.
export type RosterSlot = VideoTrackId | MicChannel

export interface RosterCard {
  readonly id: string
  readonly kind: SourceDeviceKind
  /** The device as the Core sent it: the badge and the 'is on' line are drawn from it. */
  readonly device: CaptureDevice
  /** `LOCAL_DEVICE` with class DEVELOPMENT: this Mac's camera or microphone. */
  readonly local: boolean
  /** The selector line that names the device, or null: registered and not used. */
  readonly slot: RosterSlot | null
  readonly state: LocalDeviceState
  readonly sourceOn: boolean
  /** True while the Core says the microphone's rate correction is at its limit. Always false for a camera. */
  readonly rateAtLimit: boolean
}

/** What the roster reads of an alert: identifiers, the kind, and `params` as untrusted data. */
type AlertLike = Pick<SimAlert, 'id' | 'kind' | 'active' | 'params' | 'target'>

/**
 * Audit row 131 (DF-16, U-09): TRUE only for the device the page's own tile or audio card draws -
 * a built-in id (`CAM-0n` / `MIC-0n`) standing on the line its id names (`CAM-0n` on `VIDEO-0n`,
 * `DEVICE_CAMERA`; `MIC-0n` on channel `MIC-0n`). Such a device appears once, as that tile, and is
 * no roster card.
 *
 * Why the line and not the id alone: the built-in ids are the DEMONSTRATION MODEL's seed, but a real
 * Core mints its registry ids from the same pattern, so a real camera or microphone can carry one
 * (the bench Core of 2026-11-05: ONVIF cameras `CAM-03`/`CAM-04` on VIDEO-01/02, USB microphones
 * `MIC-03`/`MIC-04` on channels 1/2). The earlier rule - built-in id AND on any line - dropped
 * exactly the devices feeding the tracks from "Registered cameras / microphones". A built-in id on
 * another line, or on none (Fix wave L, G70c-08), is a registered device like any other.
 */
export function drawnByOwnTile(config: Pick<CaptureConfig, 'cameras' | 'mics'>, device: Pick<CaptureDevice, 'id' | 'kind'>): boolean {
  if (!BUILT_IN_SOURCE_IDS.includes(device.id)) return false
  const slot = rosterSlotOf(config, device)
  if (slot === null) return false
  return device.kind === 'CAMERA' ? (DEVICE_CAMERA as Readonly<Record<string, string | undefined>>)[device.id] === slot : slot === device.id
}

/** The selector line that names a device: a camera by its track, a microphone by its role. */
export function rosterSlotOf(config: Pick<CaptureConfig, 'cameras' | 'mics'>, device: Pick<CaptureDevice, 'id' | 'kind'>): RosterSlot | null {
  if (device.kind === 'CAMERA') {
    const line = config.cameras.find((camera) => camera.deviceId === device.id)
    // D60 (2026-11-04): any of the four video tracks is a slot the roster can name.
    return line?.trackId ?? null
  }
  const line = config.mics.find((mic) => mic.deviceId === device.id)
  // D61 (2026-11-04): the slot of a microphone line is its channel.
  return line?.channel ?? null
}

/** True while an active advisory alert says the rate correction of this microphone is at its limit. */
export function rateAtLimitOf(alerts: readonly AlertLike[], deviceId: string): boolean {
  return alerts.some((alert) => alert.active && alert.kind === 'SYSTEM' && alert.params?.['reason'] === MIC_RATE_AT_LIMIT && (alert.target ?? null) === deviceId)
}

/**
 * The roster of one kind, in the Core's order. Pure: the three slices in, the cards out.
 * A device of another kind (the PoE switch) and a built-in device on its own line (`drawnByOwnTile`) are
 * not part of it; every other camera or microphone of the Core's list is, exactly once.
 */
export function registeredRoster(
  input: { readonly devices: readonly CaptureDevice[]; readonly config: Pick<CaptureConfig, 'cameras' | 'mics'>; readonly alerts: readonly AlertLike[] },
  kind: SourceDeviceKind,
): RosterCard[] {
  const unreachable = activeCaptureNotices(input.alerts)
  return input.devices
    // Fix wave L (G70c-08): a built-in source that left its line is a registered source on no track - it gets its card
    // (while `CAM-05` fed Camera 2, the unassigned `CAM-02` was on no tile and on no card).
    // Audit row 131 (DF-16): only a built-in id on its OWN line is the tile's; one on another line is a card.
    .filter((device) => device.kind === kind && !drawnByOwnTile(input.config, device))
    .map((device): RosterCard => {
      const notice = unreachable.find((entry) => entry.kind === 'UNREACHABLE' && entry.deviceId === device.id)
      const cause = notice !== undefined && notice.kind === 'UNREACHABLE' ? notice.cause : null
      return {
        id: device.id,
        kind,
        device,
        local: isDevelopmentSource(device) && device.adapter === LOCAL_DEVICE_ADAPTER,
        slot: rosterSlotOf(input.config, device),
        // A named cause wins over `online` (§8f.3); the plain "did not answer" is `online: false`.
        state: localDeviceState({ present: device.online && cause === null, errorCode: cause === 'UNREACHABLE' ? null : cause }),
        sourceOn: isLocalSourceOn(device),
        rateAtLimit: kind === 'MIC' && rateAtLimitOf(input.alerts, device.id),
      }
    })
}

/** The roster of one kind from the replicated slices. The three slices are store-owned references; the cards are made in `useMemo`. */
export function useRegisteredRoster(kind: SourceDeviceKind): readonly RosterCard[] {
  const devices = useSim((state) => state.captureDevices.devices)
  const config = useSim((state) => state.captureConfig)
  const alerts = useSim((state) => state.alerts)
  return useMemo(() => registeredRoster({ devices, config, alerts }, kind), [devices, config, alerts, kind])
}

/** One card by its id, of either kind; undefined when the Core's list does not hold it (or it is a built-in id). */
export function useRosterCard(deviceId: string | null): RosterCard | undefined {
  const cameras = useRegisteredRoster('CAMERA')
  const microphones = useRegisteredRoster('MIC')
  return deviceId === null ? undefined : (cameras.find((card) => card.id === deviceId) ?? microphones.find((card) => card.id === deviceId))
}

/**
 * The name of a card. The Core's local device, in real capture: "This Mac's camera" / "This Mac's
 * microphone" (D83). Another microphone: "MIC 3" (the id rule of pass D2). Another camera:
 * "Camera CAM-04" — its announced model is UNTRUSTED device text and is never the name.
 */
export function rosterCardName(t: TFunction, card: Pick<RosterCard, 'id' | 'kind' | 'local'>, realCapture: boolean): string {
  if (card.kind === 'MIC') return micInputName(t, card.id, card.local && realCapture)
  if (card.local && realCapture) return t('common.sourceClass.kind.localCamera')
  return t('common.developmentRoster.name', { kind: t('common.developmentRoster.kind.CAMERA'), id: card.id })
}

export type RosterSourceKey =
  | 'common.developmentRoster.source.LOCAL_DEVICE'
  | 'common.developmentRoster.source.FAKE'
  | 'common.developmentRoster.source.ONVIF_RTSP'
  | 'common.developmentRoster.source.USB_AUDIO'
  | 'common.developmentRoster.source.OTHER'

/** The words for the adapter kind the Core sent; an unknown or absent kind reads "Registered device". */
export function rosterSourceKey(adapter: string | null | undefined): RosterSourceKey {
  switch (adapter) {
    case LOCAL_DEVICE_ADAPTER:
      return 'common.developmentRoster.source.LOCAL_DEVICE'
    case TEST_SOURCE_ADAPTER:
      return 'common.developmentRoster.source.FAKE'
    case 'ONVIF_RTSP':
      return 'common.developmentRoster.source.ONVIF_RTSP'
    case 'USB_AUDIO':
      return 'common.developmentRoster.source.USB_AUDIO'
    default:
      return 'common.developmentRoster.source.OTHER'
  }
}

export type RosterLimitKey = 'common.developmentRoster.limits.localMicrophone' | 'common.developmentRoster.limits.localCamera' | 'common.developmentRoster.limits.test'

/**
 * The stated limit of a development source (D128: the local microphone is NOT fit for recording
 * yet; D136 (3): the local camera is variable-rate). `null` for a device that is no development
 * source, and outside real capture — the limits are facts of the Core's development sources.
 */
export function rosterLimitKey(card: Pick<RosterCard, 'device' | 'kind' | 'local'>, realCapture: boolean): RosterLimitKey | null {
  if (!realCapture || !isDevelopmentSource(card.device)) return null
  if (card.local) return card.kind === 'MIC' ? 'common.developmentRoster.limits.localMicrophone' : 'common.developmentRoster.limits.localCamera'
  return card.device.adapter === TEST_SOURCE_ADAPTER ? 'common.developmentRoster.limits.test' : null
}

export const ROSTER_SLOT_KEY = {
  'VIDEO-01': 'common.developmentRoster.usedAs.VIDEO-01',
  'VIDEO-02': 'common.developmentRoster.usedAs.VIDEO-02',
  'VIDEO-03': 'common.developmentRoster.usedAs.VIDEO-03', // D60 (2026-11-04)
  'VIDEO-04': 'common.developmentRoster.usedAs.VIDEO-04', // D60
  // D61 (2026-11-04): the four microphone channels (the shared usedAs list names channel 1 as the transcribed one).
  'MIC-01': 'common.developmentRoster.usedAs.MIC-01',
  'MIC-02': 'common.developmentRoster.usedAs.MIC-02',
  'MIC-03': 'common.developmentRoster.usedAs.MIC-03',
  'MIC-04': 'common.developmentRoster.usedAs.MIC-04',
} as const satisfies Record<RosterSlot, string>

/**
 * Fix wave L (G70c-02): THE STATE CHIP OF A REGISTERED SOURCE. On a Core in real capture "Ready" was
 * said of every enabled registry row - `CAM-03` nobody opened, `CAM-04` on an address where nothing
 * listens. `online: true` there only means "the row is enabled" (`contract_wave_l.md` section 5),
 * so a source the Core neither opened nor checked reads "Not checked". A named cause, an open local
 * source, a stated `checkedAt` and the simulated lane keep the state as it was.
 */
export function rosterStateNotChecked(card: Pick<RosterCard, 'state' | 'device'>, realCapture: boolean): boolean {
  return realCapture && card.state === 'READY' && !restingSourceChecked(card.device as { sourceOpen?: unknown; checkedAt?: unknown })
}

/**
 * Row W2c2 (129b, U-09b): THE STATE CHIP OF A REGISTERED CARD, one statement with the tile of the track it feeds.
 * On the bench /devices said "Ready" on the registered CAM-03..06 cards while the same cameras' tiles said "Not
 * checked" and the summary "CAMERAS 0/4 - 4 issues": the card read the registry row (`online`, the notices,
 * `restingSourceChecked`), the tiles and the summary read row 129's `trackStatus`.
 *
 * | Card | The chip says |
 * |---|---|
 * | its own state is not READY (a named cause, `online: false`) | that state, as before (a negative fact of the device is never hidden) |
 * | on a line (`slot`), and `trackStatus` of that track is not READY | the track's status word (`devices.status.*`), the tile's word |
 * | a camera on a line, READY | "Not checked" exactly when the tile says it (`trackReachOf` === NOT_CHECKED), else "Ready" |
 * | a microphone on a line, READY, or any card on no line | the registry rule as before (`rosterStateNotChecked`) |
 *
 * Flat result (compared shallowly by `useSim`): `status` null = the card's own state (`LOCAL_STATE_VIEW[card.state]`).
 */
export interface RosterCardStatus {
  readonly status: DeviceStatusCode | null
  readonly notChecked: boolean
}

export function rosterCardStatus(state: SimState, card: Pick<RosterCard, 'kind' | 'slot' | 'state' | 'device'>, realCapture: boolean): RosterCardStatus {
  if (card.state !== 'READY' || card.slot === null) return { status: null, notChecked: rosterStateNotChecked(card, realCapture) }
  if (card.kind === 'CAMERA') {
    const track = card.slot as VideoTrackId
    const status = trackStatus(state, track)
    if (status !== 'READY') return { status, notChecked: false }
    return { status: null, notChecked: trackReachOf(state, track, realCapture) === 'NOT_CHECKED' }
  }
  const status = trackStatus(state, audioTrackOfMicChannel(card.slot as MicChannel))
  if (status !== 'READY') return { status, notChecked: false }
  return { status: null, notChecked: rosterStateNotChecked(card, realCapture) }
}

/** The chip of a card from the replicated state (`rosterCardStatus`); `realCapture` is `useRealCaptureCore()`. */
export function useRosterCardStatus(card: Pick<RosterCard, 'kind' | 'slot' | 'state' | 'device'>, realCapture: boolean): RosterCardStatus {
  return useSim((state) => rosterCardStatus(state, card, realCapture))
}
