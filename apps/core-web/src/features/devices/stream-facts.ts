import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { VideoTrackId } from '@dems/shared/domain'
import { cameraLinesInForce, useSim, type SimState } from '@dems/shared/sim'
import { activeCaptureNotices } from '@/lib/capture-notices'
import { useRealCaptureCore } from './source-class'
import { checkedAtOf, sourceLineState } from './source-state'

/**
 * THE STREAM FACTS OF A VIDEO TRACK, AS THE CORE THIS CONSOLE SHOWS STATES THEM (task 4 row W4; review
 * `verification/060c` findings R-01 to R-06, `060b` S-01; decisions C36, C98, C105). ONE rule for every reader:
 * the Devices tile and drawer, the Dashboard tile, the Session Monitor's input cards, the pre-check tiles of
 * Session New and the "No preview" tile.
 *
 * | The Core this console shows | The picture, the rate and the codec are | A camera in fault |
 * |---|---|---|
 * | Simulated client mode, or a Core in simulated capture | the `cameras` slice: the dataset's own statement, exactly as before | as before (the NO SIGNAL tile; the format stays the dataset's) |
 * | a Core in real capture (`useRealCaptureCore`) | the STORED stream statement of the track's selector line in force (`profile`), read back as the Core's device reads do; "Not stated" where the line names none or its code is no statement | the fault is said in the place of the facts: a stored fact is not shown as if the stream were live |
 *
 * WHY THE SLICE IS NOT READ ON A REAL CORE. The `cameras` slice a client receives on the state stream of a
 * real Core still holds the simulator's initial `1080p / 25 / H.264`: no writer of the Core puts stream facts
 * into it (rows B2 and V6 say so; request line of row V6). What the Core does state to a client is the
 * selector line: the profile code it minted from the stream itself and stored (task 4 rows 50, 51). The
 * Core's own device reads answer the three facts from exactly that code (`cameraStreamFactsOf` of
 * `apps/core-server/src/modules/devices/status.ts`); `storedStreamFactsOf` is the same reading.
 *
 * It is a SECOND statement of that code form (the first is the Core's): a request line of row W4 asks for the
 * one function in `packages/shared`. Until then the cases "W4" of `__tests__/source-state.test.tsx` hold it to
 * the Core's answers.
 */
export interface StreamFacts {
  readonly resolution: string | null
  readonly fps: number | null
  readonly codec: 'H.264' | 'HEVC' | null
}

/** No stream statement: the picture, the rate and the codec are each not stated. */
export const STREAM_FACTS_NOT_STATED: StreamFacts = Object.freeze({ resolution: null, fps: null, codec: null })

/** `<codec>_<height>P<rate>` for a 16:9 picture, else `<codec>_<width>X<height>P<rate>`; the rate absent when the stream states none. */
const STREAM_STATEMENT = /^(H264|HEVC)_(?:([1-9][0-9]{0,4})X)?([1-9][0-9]{0,4})P([1-9][0-9]{0,2})?$/
/** The picture as the contract carries it (`CAMERA_RESOLUTION_PATTERN`) and the highest rate it states (`CAMERA_FPS_MAX`). */
const RESOLUTION = /^(?:[1-9][0-9]{2,3}p|[1-9][0-9]{2,3}x[1-9][0-9]{2,3})$/
const FPS_MAX = 240

/**
 * What a stored profile code states of its stream. Every member null for a code that is no stream statement
 * (a development profile's name, an empty slot, a text that is no code) or whose numbers the contract cannot
 * carry: nothing is said in its place. Pure.
 */
export function storedStreamFactsOf(profile: unknown): StreamFacts {
  const stated = typeof profile === 'string' ? STREAM_STATEMENT.exec(profile) : null
  if (stated === null) return STREAM_FACTS_NOT_STATED
  const [, codec, width, height, rate] = stated
  const resolution = width === undefined ? `${String(height)}p` : `${width}x${String(height)}`
  // A code without a width states a 16:9 picture: one WITH a width that is 16:9 is not a code the mint makes.
  if (width !== undefined && Number(width) * 9 === Number(height) * 16) return STREAM_FACTS_NOT_STATED
  const fps = rate === undefined ? null : Number(rate)
  if (!RESOLUTION.test(resolution) || (fps !== null && fps > FPS_MAX)) return STREAM_FACTS_NOT_STATED
  return { resolution, fps, codec: codec === 'HEVC' ? 'HEVC' : 'H.264' }
}

/** The fault of the camera behind a track, in the words the console already has for it. */
export type TrackFault = 'STREAM_LOST' | 'NOT_REACHABLE' | 'NO_SIGNAL'

export interface TrackFacts {
  /** True on a Core in real capture: the facts are the stored statement, never the slice. */
  readonly stated: boolean
  /** False only where the slice carries no camera for the track off a real-capture Core: nothing is drawn then, as before. */
  readonly known: boolean
  readonly resolution: string | null
  readonly fps: number | null
  readonly codec: 'H.264' | 'HEVC' | null
  /** Set on a Core in real capture only. The simulated lane keeps its own NO SIGNAL drawing. */
  readonly fault: TrackFault | null
}

type FactsState = Pick<SimState, 'cameras' | 'captureConfig' | 'captureDevices' | 'session' | 'alerts'>

/**
 * The rule of this file's header for one track. Pure; a flat object of primitives (it compares by value).
 *
 * THE FAULT of a track on a Core in real capture, from what the Core reports, in this order:
 * 1. the selector line as `sourceLineState` reads it (the ONE rule of a source line): a lost stream, a source not reachable;
 * 2. an active "not reachable" notice of the Core that names the line's camera (pre-check or session start);
 * 3. the camera slice's own fault of the track (`online: false`, a lens fault): the engine's fault state.
 */
export function trackFactsOf(state: FactsState, cameraId: VideoTrackId, realCapture: boolean): TrackFacts {
  const camera = state.cameras.find((entry) => entry.id === cameraId)
  if (!realCapture) {
    if (camera === undefined) return { stated: false, known: false, ...STREAM_FACTS_NOT_STATED, fault: null }
    return { stated: false, known: true, resolution: camera.resolution, fps: camera.fps, codec: camera.codec, fault: null }
  }
  const line = cameraLinesInForce(state).find((entry) => entry.trackId === cameraId)
  const facts = line === undefined ? STREAM_FACTS_NOT_STATED : storedStreamFactsOf((line as { readonly profile?: unknown }).profile)
  const device = line === undefined ? undefined : state.captureDevices.devices.find((entry) => entry.id === line.deviceId)
  const reach =
    line === undefined
      ? null
      : sourceLineState({ realCapture: true, recording: state.session?.state === 'RECORDING', online: line.online, streamState: line.streamState, checkedAt: checkedAtOf(device) })
  const noticed =
    line !== undefined &&
    activeCaptureNotices(state.alerts).some((notice) => notice.kind === 'UNREACHABLE' && notice.deviceKind === 'CAMERA' && notice.deviceId === line.deviceId)
  const fault: TrackFault | null =
    reach?.stream === 'LOST'
      ? 'STREAM_LOST'
      : reach?.reach === 'NOT_REACHABLE' || noticed
        ? 'NOT_REACHABLE'
        : camera !== undefined && (!camera.online || camera.lens === 'FAULT')
          ? 'NO_SIGNAL'
          : null
  return { stated: true, known: true, ...facts, fault }
}

/** `trackFactsOf` of the console's data. */
export function useTrackFacts(cameraId: VideoTrackId): TrackFacts {
  const realCapture = useRealCaptureCore()
  return useSim((state) => trackFactsOf(state, cameraId, realCapture))
}

/** The fault in the console's existing words (the selector line's "Stream lost", the roster's "Not reachable", "NO SIGNAL"). */
export function trackFaultText(t: TFunction, fault: TrackFault): string {
  if (fault === 'STREAM_LOST') return t('devices.selector.stream.LOST')
  if (fault === 'NOT_REACHABLE') return t('common.developmentRoster.notReachable')
  return t('common.status.noSignal')
}

/** Picture and rate (the chip of a tile): "Not stated" without a picture, no rate where the stream states none. */
export function formatChipText(t: TFunction, facts: StreamFacts): string {
  if (facts.resolution === null) return t('common.devices.cameraFormatNotStated')
  if (facts.fps === null) return t('common.devices.cameraFormatNoRate', { resolution: facts.resolution })
  return t('common.devices.cameraFormat', { resolution: facts.resolution, fps: facts.fps })
}

/** Picture, rate and codec (a fact row): "Not stated" without a picture or a codec, no rate where the stream states none. */
export function formatLineText(t: TFunction, facts: StreamFacts): string {
  if (facts.resolution === null || facts.codec === null) return t('common.devices.cameraFormatNotStated')
  if (facts.fps === null) return t('common.devices.cameraFormatCodecNoRate', { resolution: facts.resolution, codec: facts.codec })
  return t('common.devices.cameraFormatCodec', { resolution: facts.resolution, fps: facts.fps, codec: facts.codec })
}

/**
 * What a reader on a Core in real capture prints for a track: the fault where the Core reports one, else the
 * stored facts ("Not stated" where null). `null` off a real-capture Core: the reader keeps its own drawing.
 */
export function useStatedFormat(cameraId: VideoTrackId, form: 'chip' | 'line'): { readonly text: string; readonly fault: TrackFault | null } | null {
  const { t } = useTranslation()
  const facts = useTrackFacts(cameraId)
  if (!facts.stated) return null
  if (facts.fault !== null) return { text: trackFaultText(t, facts.fault), fault: facts.fault }
  return { text: form === 'chip' ? formatChipText(t, facts) : formatLineText(t, facts), fault: null }
}
