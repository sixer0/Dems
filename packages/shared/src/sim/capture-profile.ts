/**
 * THE STORED STREAM PROFILES OF A CAMERA, AS A DEVICE ENTRY CARRIES THEM (task 4 row V7; decisions
 * C36, C111 (finding Q-02), C117; the two blocking request lines of row W5).
 *
 * A production camera is assigned to a video track with a profile OF ITS OWN: one of the codes its
 * stored row lists (`capture_devices.profiles`). The Core mints each code from the stream itself
 * when the camera is adopted (task 4 rows 50, 51) and holds the column to the code form by a CHECK
 * (migration 0022). Until this row the list reached no client: the device entry had no member for
 * it, so both screens read "no stored profile" for every production camera.
 *
 * THE MEMBER: `profiles` of a device entry (`CaptureDeviceStatus`) - a list of `CaptureDeviceProfile`,
 * in the stored order, each code once, at most `CAPTURE_DEVICE_PROFILES_MAX`. AN EMPTY LIST = the
 * Core holds no profile for this camera. PRESENT on every registered camera (`registerCaptureDevice`,
 * on the Core and in the in-app simulator; the row mapping's read-back). ABSENT on every other entry
 * (a microphone, the PoE switch, a built-in device) and from an older Core.
 *
 * THE FACTS OF AN ENTRY are what its CODE states - the code is the stream's statement in the closed
 * form the mint makes (`<codec>_<height>P<rate>` for a 16:9 picture, else
 * `<codec>_<width>X<height>P<rate>`, the rate absent when the stream states none), and reading it
 * back is the mint's inverse. Each fact is NULL where the code states none; a code that is no
 * stream statement at all has three nulls. NEVER A DEFAULT (C36).
 *
 * This is the ONE reader of the code form in the shared package (the request line of row W4). The
 * Core's `cameraStreamFactsOf` (`apps/core-server/src/modules/devices/status.ts`) and the two
 * clients' `storedStreamFactsOf` are older statements of the same form; `sim-capture-discovery.test.ts`
 * holds this one to the contract's bounds.
 */
import type { CameraStreamCodec, CaptureDeviceProfile } from './types';
// The bound of a list and the form of a code are constants of `./vocabulary` (the API contract reads them there).
import { CAPTURE_DEVICE_PROFILES_MAX, CAPTURE_PROFILE_CODE_PATTERN } from './vocabulary';

/** A profile code that is a stream statement (see the file header). */
const STREAM_STATEMENT = /^(H264|HEVC)_(?:([1-9][0-9]{0,4})X)?([1-9][0-9]{0,4})P([1-9][0-9]{0,2})?$/;
/** The picture as the contract carries it (`CAMERA_RESOLUTION_PATTERN` of the API contract; held equal by a test). */
const RESOLUTION = /^(?:[1-9][0-9]{2,3}p|[1-9][0-9]{2,3}x[1-9][0-9]{2,3})$/;
/** The highest rate the contract carries (`CAMERA_FPS_MAX`; held equal by a test). */
const FPS_MAX = 240;

/** What a code states of its stream; three nulls for a code that is no stream statement. */
export interface CaptureProfileFacts {
  codec: CameraStreamCodec | null;
  resolution: string | null;
  fps: number | null;
}

const NOT_STATED: CaptureProfileFacts = Object.freeze({ codec: null, resolution: null, fps: null });

/**
 * What a stored profile code states of its stream. Pure. Every member null for a text that is no
 * stream statement, or whose numbers the contract cannot carry (a side outside 100 to 9999, a rate
 * above 240): nothing is said in its place.
 */
export function captureProfileFactsOf(code: unknown): CaptureProfileFacts {
  const stated = typeof code === 'string' ? STREAM_STATEMENT.exec(code) : null;
  if (stated === null) return NOT_STATED;
  const [, codec, width, height, rate] = stated;
  // A code without a width states a 16:9 picture: one WITH a width that is 16:9 is not a code the mint makes.
  if (width !== undefined && Number(width) * 9 === Number(height) * 16) return NOT_STATED;
  const resolution = width === undefined ? `${String(height)}p` : `${width}x${String(height)}`;
  const fps = rate === undefined ? null : Number(rate);
  if (!RESOLUTION.test(resolution) || (fps !== null && fps > FPS_MAX)) return NOT_STATED;
  return { codec: codec === 'HEVC' ? 'HEVC' : 'H.264', resolution, fps };
}

/**
 * The profile entries of a stored list, or null when the value is no list of profile codes within
 * the bound. Nothing is cut, cleaned or guessed: a value that is no list, a list longer than the
 * bound, an element that is no code, a code named twice - each is NO LIST (the rule of the Core's
 * own reader, `storedProfilesOf` of the capture fence). The caller decides what "no list" means
 * for it: the engine's register action refuses it, the row mapping states an empty list.
 */
export function captureDeviceProfilesOf(codes: unknown): CaptureDeviceProfile[] | null {
  if (!Array.isArray(codes) || codes.length > CAPTURE_DEVICE_PROFILES_MAX) return null;
  const seen = new Set<string>();
  const profiles: CaptureDeviceProfile[] = [];
  for (const code of codes as readonly unknown[]) {
    if (typeof code !== 'string' || !CAPTURE_PROFILE_CODE_PATTERN.test(code) || seen.has(code)) return null;
    seen.add(code);
    profiles.push({ code, ...captureProfileFactsOf(code) });
  }
  return profiles;
}
