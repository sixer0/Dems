/**
 * THE STREAM PROFILE OF A CAMERA ASSIGNMENT (task 4 row W5; review `verification/060d` finding Q-02;
 * decisions C36, C60, C111). Kept in a `.ts` module so the panel file exports only components.
 *
 * THE RULE OF THE CORE (`apps/core-server/src/modules/capture-config/routes.ts`, `assertOwnProfile`): on a
 * Core in real capture a PRODUCTION camera (`kind: CAMERA`, `adapter: ONVIF_RTSP`) is assigned with a
 * profile of its own - one of the codes its stored row lists (`capture_devices.profiles`, minted from the
 * stream itself by adoption and the connection test: task 4 rows 50, 51, 187). No default ever stands in
 * for what the stream states (C36): an assignment that names none answers `CAMERA_PROFILE_NOT_STATED`.
 * Until this row the console sent operation 79 with a track alone, so no production camera could be
 * assigned from it.
 *
 * | The camera of the choice | `cameraAssignmentOf` | What the row does |
 * |---|---|---|
 * | any camera off a Core in real capture (Simulated mode, a Core in simulated capture) | `PLAIN` | exactly as before: operation 79, `{ trackId }` |
 * | a development source on a Core in real capture (`FAKE`, `LOCAL_DEVICE`) | `PLAIN` | exactly as before |
 * | a production camera with stored profiles | `CHOOSE` | the profiles are offered with what each IS; ONE stored profile is preselected and still shown; the chosen code is sent |
 * | a production camera with NO stored profile | `NO_PROFILE` | nothing is sent: the row says why and what to do |
 *
 * THE REQUEST. Operation 79's body has no profile member (`CaptureCameraSourceRequestSchema`: a strict
 * `{ trackId }`). The profile travels on a camera line of operation 78 (`CaptureConfigCameraUpdateSchema`:
 * `{ trackId, deviceId, profile }`), which the Core judges by the same rule (`cameraLinesOf`). DRIVER
 * DECISION of row W5: a `CHOOSE` assignment is ONE operation 78 with that one camera line.
 *
 * THE SEAM (`storedProfilesOf`). The list the Core holds for a device reaches NO client today: the
 * replicated `captureDevices` slice and operation 77 carry no profile member (`CaptureDeviceStatusSchema`
 * is a strict object, and the typed client refuses an answer with a member it does not name). The reader
 * below takes the member `profiles` of a device entry, the name of the stored column. Until the contract's
 * writer adds it and the Core's slice writer fills it (two request lines of row W5), every production
 * camera reads `NO_PROFILE` on a real Core: fail closed, and said in words.
 */
import type { TFunction } from 'i18next'
import { storedStreamFactsOf } from './stream-facts'

/** The adapter kind of a production camera (C3 §2.6 "Device shapes"; the Core's `CaptureAdapterKind.ONVIF_RTSP`). */
export const PRODUCTION_CAMERA_ADAPTER = 'ONVIF_RTSP'

/** The form of a profile code (the contract's `label()`): upper-case letters, digits and underscores. */
const PROFILE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/

/** The most profiles a device entry is read to: a camera's list is short; anything longer is not a list of one camera. */
export const STORED_PROFILES_MAX = 32

type DeviceLike = { readonly kind?: unknown; readonly adapter?: unknown } | null | undefined

/** True for the device the Core's profile rule is about: a camera behind the production camera adapter. */
export function isProductionCamera(device: DeviceLike): boolean {
  return device != null && device.kind === 'CAMERA' && device.adapter === PRODUCTION_CAMERA_ADAPTER
}

/**
 * The profile codes the Core states for a registered device, in the Core's order, each once. Read as
 * untrusted data: a member that is no list, or an element that is no code, states nothing. Pure.
 */
export function storedProfilesOf(device: unknown): readonly string[] {
  if (typeof device !== 'object' || device === null) return []
  const listed = (device as { readonly profiles?: unknown }).profiles
  if (!Array.isArray(listed)) return []
  const codes: string[] = []
  // Row V7: the contract's entry is `{ code, codec, resolution, fps }` (`CaptureDeviceProfileSchema`); a bare code is still read.
  for (const code of listed.slice(0, STORED_PROFILES_MAX).map((entry: unknown) => (typeof entry === 'object' && entry !== null ? (entry as { readonly code?: unknown }).code : entry))) {
    if (typeof code === 'string' && PROFILE_CODE.test(code) && !codes.includes(code)) codes.push(code)
  }
  return codes
}

export type CameraAssignment =
  /** No profile is part of the assignment: operation 79 as before. */
  | { readonly kind: 'PLAIN' }
  /** A production camera the Core holds no profile for: it cannot be assigned from the screen. */
  | { readonly kind: 'NO_PROFILE' }
  /** A production camera with stored profiles: one of `profiles` is chosen; `preselected` is the choice the row starts with. */
  | { readonly kind: 'CHOOSE'; readonly profiles: readonly string[]; readonly preselected: string | null }

/**
 * What assigning `device` asks of the operator; pure.
 *
 * `preselected`: the profile the slot's line already holds for THIS camera when the camera still lists it;
 * else the ONE stored profile of a camera that has exactly one; else nothing - the operator chooses.
 */
export function cameraAssignmentOf(input: {
  /** The console shows a Core in real capture (`useRealCaptureCore`). */
  readonly realCapture: boolean
  /** The camera of the choice as the Core's device list holds it; undefined for "Not assigned" or a device the list does not hold. */
  readonly device: unknown
  /** `storedProfilesOf(device)`: handed in by the caller, so that the read of the list is ONE place (the seam). */
  readonly profiles: readonly string[]
  /** The profile of the slot's line when that line already holds this camera; null otherwise. */
  readonly heldProfile: string | null
}): CameraAssignment {
  if (!input.realCapture || !isProductionCamera(input.device as DeviceLike)) return { kind: 'PLAIN' }
  const profiles = input.profiles
  if (profiles.length === 0) return { kind: 'NO_PROFILE' }
  const preselected = input.heldProfile !== null && profiles.includes(input.heldProfile) ? input.heldProfile : profiles.length === 1 ? profiles[0]! : null
  return { kind: 'CHOOSE', profiles, preselected }
}

/**
 * What a stored profile IS, in words: the codec, the picture and the rate as the stream stated them, each
 * "not stated" where the code states none. A code that is no stream statement at all reads "Not stated"
 * with the code, so that two such entries can still be told apart.
 */
export function profileWords(t: TFunction, code: string): string {
  const facts = storedStreamFactsOf(code)
  if (facts.codec === null && facts.resolution === null && facts.fps === null) return t('web.cameraProfile.notStated', { code })
  return t('web.cameraProfile.facts', {
    codec: facts.codec ?? t('web.cameraProfile.codecNotStated'),
    resolution: facts.resolution ?? t('web.cameraProfile.resolutionNotStated'),
    rate: facts.fps === null ? t('web.cameraProfile.rateNotStated') : t('web.cameraProfile.rate', { fps: facts.fps }),
  })
}
