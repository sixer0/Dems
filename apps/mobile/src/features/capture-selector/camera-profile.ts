/**
 * THE STREAM PROFILE OF A CAMERA ASSIGNMENT, the tablet's side (task 4 row W5; review `verification/060d`
 * finding Q-02; decisions C36, C60, C111). The web console holds the same rule in
 * `apps/core-web/src/features/devices/camera-profile.ts`; what follows is that file's rule, word for word.
 *
 * THE RULE OF THE CORE (`apps/core-server/src/modules/capture-config/routes.ts`, `assertOwnProfile`): on a
 * Core in real capture a PRODUCTION camera (`kind: CAMERA`, `adapter: ONVIF_RTSP`) is assigned with a
 * profile of its own - one of the codes its stored row lists (`capture_devices.profiles`, minted from the
 * stream itself: task 4 rows 50, 51, 187). No default ever stands in for what the stream states (C36): an
 * assignment that names none answers `CAMERA_PROFILE_NOT_STATED`. Until this row the app sent operation 79
 * with a track alone, so no production camera could be assigned from it.
 *
 * | The camera of the choice | `cameraAssignmentOf` | What the sheet does |
 * |---|---|---|
 * | any camera off a Core in real capture (Simulated mode, a Core in simulated capture) | `PLAIN` | exactly as before: operation 79, `{ trackId }` |
 * | a development source on a Core in real capture (`FAKE`, `LOCAL_DEVICE`) | `PLAIN` | exactly as before |
 * | a production camera with stored profiles | `CHOOSE` | the profiles are offered with what each IS; ONE stored profile is preselected and still shown; the chosen code is sent |
 * | a production camera with NO stored profile | `NO_PROFILE` | nothing is sent: the sheet says why |
 *
 * THE REQUEST. Operation 79's body has no profile member (a strict `{ trackId }`). The profile travels on a
 * camera line of operation 78 (`{ cameras: [{ trackId, deviceId, profile }] }`), which the Core judges by
 * the same rule. DRIVER DECISION of row W5: a `CHOOSE` assignment is ONE operation 78 with that one line
 * (`cameraProfileBody` of `capture-selector-port.ts`).
 *
 * THE SEAM (`storedProfilesOf`). The list the Core holds for a device reaches NO client today: the
 * replicated `captureDevices` slice carries no profile member (`CaptureDeviceStatusSchema` is a strict
 * object). The reader takes the member `profiles` of a device entry, the name of the stored column. Until
 * the contract's writer adds it and the Core's slice writer fills it (request lines of row W5), every
 * production camera reads `NO_PROFILE` on a real Core: fail closed, and said in words.
 */
import { storedStreamFactsOf } from '@/features/devices/stream-facts';

/** The adapter kind of a production camera (C3 §2.6 "Device shapes"; the Core's `CaptureAdapterKind.ONVIF_RTSP`). */
export const PRODUCTION_CAMERA_ADAPTER = 'ONVIF_RTSP';

/** The form of a profile code (the contract's `label()`): upper-case letters, digits and underscores. */
const PROFILE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/** The most profiles a device entry is read to: a camera's list is short. */
export const STORED_PROFILES_MAX = 32;

/**
 * The profile codes the Core states for a registered device, in the Core's order, each once. Read as
 * untrusted data: a member that is no list, or an element that is no code, states nothing. Pure.
 */
export function storedProfilesOf(device: unknown): readonly string[] {
  if (typeof device !== 'object' || device === null) return [];
  const listed = (device as { readonly profiles?: unknown }).profiles;
  if (!Array.isArray(listed)) return [];
  const codes: string[] = [];
  // Row V7: the contract's entry is `{ code, codec, resolution, fps }` (`CaptureDeviceProfileSchema`); a bare code is still read.
  for (const code of listed.slice(0, STORED_PROFILES_MAX).map((entry: unknown) => (typeof entry === 'object' && entry !== null ? (entry as { readonly code?: unknown }).code : entry))) {
    if (typeof code === 'string' && PROFILE_CODE.test(code) && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

export type CameraAssignment =
  /** No profile is part of the assignment: operation 79 as before. */
  | { readonly kind: 'PLAIN' }
  /** A production camera the Core holds no profile for: it cannot be assigned from the screen. */
  | { readonly kind: 'NO_PROFILE' }
  /** A production camera with stored profiles: one of `profiles` is chosen; `preselected` is the choice the sheet starts with. */
  | { readonly kind: 'CHOOSE'; readonly profiles: readonly string[]; readonly preselected: string | null };

/**
 * What assigning a camera asks of the operator; pure.
 *
 * `preselected`: the profile the track's line already holds for THIS camera when the camera still lists it;
 * else the ONE stored profile of a camera that has exactly one; else nothing - the operator chooses.
 */
export function cameraAssignmentOf(input: {
  /** The app shows a Core in real capture. */
  readonly realCapture: boolean;
  /** `adapter` of the camera as the Core sent it. */
  readonly adapter: string | null | undefined;
  /** `storedProfilesOf` of the camera's device entry. */
  readonly profiles: readonly string[];
  /** The profile of the track's line when that line already holds this camera; null otherwise. */
  readonly heldProfile: string | null;
}): CameraAssignment {
  if (!input.realCapture || input.adapter !== PRODUCTION_CAMERA_ADAPTER) return { kind: 'PLAIN' };
  if (input.profiles.length === 0) return { kind: 'NO_PROFILE' };
  const preselected =
    input.heldProfile !== null && input.profiles.includes(input.heldProfile) ? input.heldProfile : input.profiles.length === 1 ? input.profiles[0]! : null;
  return { kind: 'CHOOSE', profiles: input.profiles, preselected };
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const WORDS = 'features.capture-selector.selector.cameraProfile';

/**
 * What a stored profile IS, in words: the codec, the picture and the rate as the stream stated them, each
 * "not stated" where the code states none. A code that is no stream statement at all reads "Not stated"
 * with the code, so that two such entries can still be told apart.
 */
export function profileWords(t: Translate, code: string): string {
  const facts = storedStreamFactsOf(code);
  if (facts.codec === null && facts.resolution === null && facts.fps === null) return t(`${WORDS}.notStated`, { code });
  return t(`${WORDS}.facts`, {
    codec: facts.codec ?? t(`${WORDS}.codecNotStated`),
    resolution: facts.resolution ?? t(`${WORDS}.resolutionNotStated`),
    rate: facts.fps === null ? t(`${WORDS}.rateNotStated`) : t(`${WORDS}.rate`, { fps: facts.fps }),
  });
}
