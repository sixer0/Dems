/**
 * THE argument tables of the camera helper (blueprint row 134; capture spec §A.6.4 "Camera helper
 * - exact pipeline shape", HL-3, HL-12; §G.1 G-R12; Q-GOP).
 *
 * The helper is the FFmpeg command-line program (9.0.2 on this host), started through the door
 * with one of the argument lists below. Every argument is a literal of this file, except FOUR
 * values, each held to a strict shape before it becomes an argument:
 *   1. the push target: the `ingestUrl` of the plan, which must be the loopback listener of the
 *      worker (`LOOPBACK_RTSP_URL`, a port of the media range). The helper CONNECTS to it; it
 *      binds no port, and no argument names a listen mode, a datagram transport or another host;
 *   2. and 3. the number `S`, the Core's wall clock at the start of the helper, written twice:
 *      as seconds with three decimals (negated) and as microseconds;
 *   4. the device name, which passes `isUsableDeviceName` and was found as exactly one entry of
 *      the device list (`device-list.ts`) before this table is asked.
 * No value typed by an operator, read from the database or taken from the network reaches an
 * argument. No table holds a screen-capture name or option.
 *
 * WHY THE THREE CLOCK OPTIONS. The worker places a video frame by the wall-clock time the RTCP
 * sender report pairs with its RTP timestamp. `-use_wallclock_as_timestamps 1` stamps each frame
 * with the host's wall clock when it is read; `-copyts` keeps the stamp; `-output_ts_offset -S`
 * and `-start_time_realtime S` make "timestamp 0" mean the instant `S`. Check `M4-LOCAL-AV-1`
 * measures that they combine as described (hypothesis H-17), on a generated picture.
 */
import { CAPTURE_MEDIA_PORT_MAX, CAPTURE_MEDIA_PORT_MIN, LOOPBACK_RTSP_URL } from '@dems/capture-protocol';
import { isUsableDeviceName } from './device-list';

/** The camera of this Mac (probe P-1). Never an index, never the Desk View camera, never a screen (D74 (2)). */
export const LOCAL_CAMERA_DEVICE_NAME = 'MacBook Air Camera';
/** The one profile a local camera has: what the helper encodes. */
export const LOCAL_CAMERA_PROFILE = 'H264_720P30';
/** One keyframe per second at 30 frames per second (Q-GOP: at most 2 s). */
export const LOCAL_CAMERA_GOP_FRAMES = 30;
export const LOCAL_CAMERA_FRAME_RATE = 30;

export const CameraHelperEncoder = { VIDEOTOOLBOX: 'VIDEOTOOLBOX', X264: 'X264' } as const;
export type CameraHelperEncoder = (typeof CameraHelperEncoder)[keyof typeof CameraHelperEncoder];

const QUIET = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning'] as const;
/** The device input. The device name follows `-i` as ONE argument, `<name>:none` (video only). */
const DEVICE_INPUT = ['-f', 'avfoundation', '-use_wallclock_as_timestamps', '1', '-framerate', '30', '-video_size', '1280x720', '-pixel_format', 'nv12', '-i'] as const;
/** The generated picture of the development fake camera (slot 2, D74 (2)): no device is opened. */
const GENERATED_INPUT = ['-re', '-f', 'lavfi', '-use_wallclock_as_timestamps', '1', '-i', 'testsrc2=size=1280x720:rate=30,settb=1/1000000'] as const;
const ENCODER = {
  VIDEOTOOLBOX: ['-an', '-c:v', 'h264_videotoolbox', '-realtime', '1', '-profile:v', 'main', '-bf', '0', '-g', '30', '-b:v', '4M', '-flags', '+global_header'],
  X264: ['-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-g', '30', '-bf', '0', '-flags', '+global_header'],
} as const satisfies Record<CameraHelperEncoder, readonly string[]>;
/** Frames keep the time they were stamped with: none is repeated or dropped to fill a fixed grid. */
const TIMING = ['-fps_mode', 'passthrough', '-enc_time_base', '1/90000'] as const;
/**
 * The progress report on standard output: how the Core learns that a first frame / sample went out
 * (the no-delivery bound of `camera-helper.ts`, H-18). A global option pair of the push lists of BOTH
 * helpers; standard output is read by the door and nowhere else.
 */
export const PROGRESS_ARGUMENTS = ['-progress', 'pipe:1'] as const;
const PROGRESS = PROGRESS_ARGUMENTS;
const PUSH = ['-f', 'rtsp', '-rtsp_transport', 'tcp'] as const;
const DEVICE_LIST = ['-hide_banner', '-nostdin', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''] as const;
const PRECHECK_OUTPUT = ['-t', '0.2', '-an', '-f', 'null', '-'] as const;

export class CameraHelperArgumentError extends Error {
  readonly what: 'TARGET' | 'START' | 'NAME';
  constructor(what: 'TARGET' | 'START' | 'NAME') {
    super('a value of the camera helper is not of its shape');
    this.name = 'CameraHelperArgumentError';
    this.what = what;
  }
}

/** True when `url` is the loopback listener of a plan: the pattern of the protocol and a port of the media range. */
export function isLoopbackIngest(url: string): boolean {
  if (url.length > 256) return false;
  const port = Number(LOOPBACK_RTSP_URL.exec(url)?.[1]);
  return Number.isInteger(port) && port >= CAPTURE_MEDIA_PORT_MIN && port <= CAPTURE_MEDIA_PORT_MAX;
}

/** `S` written twice (values 2 and 3): `-<seconds>.<3 decimals>` and `<microseconds>`. */
function clockArguments(startMs: number): string[] {
  if (!Number.isSafeInteger(startMs) || startMs <= 0) throw new CameraHelperArgumentError('START');
  const seconds = Math.floor(startMs / 1000);
  const millis = String(startMs % 1000).padStart(3, '0');
  return ['-copyts', '-output_ts_offset', `-${seconds}.${millis}`, '-start_time_realtime', `${startMs}000`];
}

function deviceArgument(name: string): string {
  if (!isUsableDeviceName(name)) throw new CameraHelperArgumentError('NAME');
  return `${name}:none`;
}

export interface CameraPushArguments {
  /** `DEVICE`: this Mac's camera. `GENERATED`: the development fake camera. */
  readonly source: 'DEVICE' | 'GENERATED';
  /** The device name; read for `DEVICE` only. */
  readonly deviceName?: string;
  readonly encoder: CameraHelperEncoder;
  /** The plan's `ingestUrl`: where the worker listens for this camera. */
  readonly ingestUrl: string;
  /** `S`: the Core's wall clock at the start of the helper, in whole milliseconds. */
  readonly startMs: number;
}

/** The argument list of a helper that pushes to the worker. */
export function cameraPushArguments(input: CameraPushArguments): readonly string[] {
  if (!isLoopbackIngest(input.ingestUrl)) throw new CameraHelperArgumentError('TARGET');
  const source = input.source === 'DEVICE' ? [...DEVICE_INPUT, deviceArgument(input.deviceName ?? '')] : [...GENERATED_INPUT];
  return Object.freeze([...QUIET, ...source, ...ENCODER[input.encoder], ...TIMING, ...clockArguments(input.startMs), ...PROGRESS, ...PUSH, input.ingestUrl]);
}

/** The device list call: it opens no device and asks for no permission. */
export function deviceListArguments(): readonly string[] {
  return DEVICE_LIST;
}

/** The pre-check: one short open of the device, nothing pushed (HL-12). The FIRST open after boot is where macOS asks. */
export function cameraPrecheckArguments(deviceName: string): readonly string[] {
  return Object.freeze([...QUIET, ...DEVICE_INPUT, deviceArgument(deviceName), ...PRECHECK_OUTPUT]);
}

/**
 * For the static argument test (G-R12) and for a check that swaps the input for a generated one:
 * the literals of the tables, and where the input section of a push list ends.
 */
export const CAMERA_HELPER_TABLE = Object.freeze({
  literals: Object.freeze([...new Set<string>([...QUIET, ...DEVICE_INPUT, ...GENERATED_INPUT, ...ENCODER.VIDEOTOOLBOX, ...ENCODER.X264, ...TIMING, ...PROGRESS, ...PUSH, ...DEVICE_LIST, ...PRECHECK_OUTPUT, '-copyts', '-output_ts_offset', '-start_time_realtime'])]),
  quietLength: QUIET.length,
  deviceInputLength: DEVICE_INPUT.length + 1,
});
