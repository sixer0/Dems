/**
 * THE GENERATED CAMERA FILE OF A DEMO PACKAGE (blueprint row 82c; evidence package spec §F.4;
 * capture spec §A.6.4, §C.1). A pure argument table: this file starts no process and reads nothing.
 *
 * WHAT IT DESCRIBES. One short camera file as the capture worker would have written it from the
 * development fake camera - the same generated picture, the same software encoder settings, the
 * same fragment form - but written STRAIGHT TO A FILE by the private helper program, with nothing
 * recorded live: no worker, no listener, no device. The caller (the seed hook) hands the list to
 * the Core's one helper door; a test hands it to the helper itself.
 *
 *   picture    `testsrc2` 1280x720 at 30 frames per second, the profile `H264_720P30`
 *   encoder    libx264 ultrafast / zerolatency, one keyframe per second, no B-frames - the table of
 *              the development fake camera (`adapters/local/camera-helper-args.ts`), held equal by
 *              a test
 *   BITRATE    4 Mbit/s with a 4 Mbit/s ceiling (`-b:v`, `-maxrate`, `-bufsize`): the bitrate of
 *              the plan profile (capture spec §A.6.4: "near 2 GB per hour at 4 Mbit/s"). Without
 *              it the software encoder writes this picture at about 25 MB PER SECOND (finding
 *              F-86-1): a fragment of 50 MB and more, where a camera's is about 1 MB
 *   sound      one AAC-LC track, 48 kHz mono (the session audio that is inside both camera files)
 *   fragments  the worker's muxer flags, and its `min_frag_duration` of 2 s: every fragment starts
 *              on a keyframe and holds 2 s of media - about 1 MB
 *
 * A DEMO PACKAGE IS SMALL BY ARITHMETIC: seconds x (4,000,000 + 64,000) / 8 bytes per camera file,
 * two files per package. 8 s gives 4 fragments per file (the tamper demo needs fragment 3 and one
 * after it) and about 4 MB per file.
 */
import { CAPTURE_AUDIO_CHANNELS, CAPTURE_AUDIO_SAMPLE_RATE_HZ, CAPTURE_MIN_FRAG_DURATION_MS } from '@dems/shared/api';

export const DEMO_CAMERA_PROFILE = 'H264_720P30';
export const DEMO_CAMERA_FRAME_RATE = 30;
/** One keyframe per second, as the development fake camera. */
export const DEMO_CAMERA_GOP_FRAMES = 30;
/** The plan profile's bitrate, bits per second. */
export const DEMO_CAMERA_BITRATE_BPS = 4_000_000;
export const DEMO_AUDIO_BITRATE_BPS = 64_000;
/** The clip length of a demo camera file: 4 fragments of 2 s. */
export const DEMO_CLIP_SECONDS = 8;
export const DEMO_CLIP_SECONDS_MIN = 2;
export const DEMO_CLIP_SECONDS_MAX = 30;
/** The muxer flags of the capture worker (`DEMS_MOVFLAGS` of `apps/capture-worker/src/ingest.c`). */
export const DEMO_MOVFLAGS = '+frag_keyframe+empty_moov+default_base_moof+skip_trailer';

const QUIET = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'error'] as const;
const PICTURE = ['-f', 'lavfi', '-i', `testsrc2=size=1280x720:rate=${DEMO_CAMERA_FRAME_RATE}`] as const;
const TONE = ['-f', 'lavfi', '-i', `sine=frequency=880:sample_rate=${CAPTURE_AUDIO_SAMPLE_RATE_HZ}`] as const;
/** The software encoder of the development fake camera, without its rate. */
export const DEMO_VIDEO_ENCODER = ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-g', String(DEMO_CAMERA_GOP_FRAMES), '-bf', '0', '-flags', '+global_header'] as const;
/** THE CAMERA-REALISTIC RATE: an explicit bitrate and a ceiling of the same value over one second of buffer. */
export const DEMO_VIDEO_RATE = ['-b:v', String(DEMO_CAMERA_BITRATE_BPS), '-maxrate', String(DEMO_CAMERA_BITRATE_BPS), '-bufsize', String(DEMO_CAMERA_BITRATE_BPS)] as const;
const AUDIO_ENCODER = ['-c:a', 'aac', '-ar', String(CAPTURE_AUDIO_SAMPLE_RATE_HZ), '-ac', String(CAPTURE_AUDIO_CHANNELS), '-b:a', String(DEMO_AUDIO_BITRATE_BPS)] as const;
const MUXER = ['-movflags', DEMO_MOVFLAGS, '-min_frag_duration', String(CAPTURE_MIN_FRAG_DURATION_MS * 1000), '-f', 'mp4'] as const;

export class DemoSourceArgumentError extends Error {
  readonly what: 'SECONDS' | 'PATH';
  constructor(what: 'SECONDS' | 'PATH') {
    super('a value of the demo camera file is not of its shape');
    this.name = 'DemoSourceArgumentError';
    this.what = what;
  }
}

/** What one camera file of that length weighs at most, by the rate alone (container overhead not counted). */
export function demoCameraFileBytesBound(seconds: number): number {
  return Math.ceil((seconds * (DEMO_CAMERA_BITRATE_BPS + DEMO_AUDIO_BITRATE_BPS)) / 8);
}

/**
 * The whole argument list of the helper program for ONE demo camera file. `outPath` is absolute,
 * ends in `.mp4` and is the LAST argument; no argument is taken from outside but the two checked
 * values.
 */
export function demoCameraFileArguments(input: { readonly seconds: number; readonly outPath: string }): string[] {
  if (!Number.isInteger(input.seconds) || input.seconds < DEMO_CLIP_SECONDS_MIN || input.seconds > DEMO_CLIP_SECONDS_MAX) throw new DemoSourceArgumentError('SECONDS');
  if (typeof input.outPath !== 'string' || !input.outPath.startsWith('/') || !input.outPath.endsWith('.mp4') || input.outPath.includes('\0') || input.outPath.length > 1024) throw new DemoSourceArgumentError('PATH');
  return [...QUIET, ...PICTURE, ...TONE, '-t', String(input.seconds), ...DEMO_VIDEO_ENCODER, ...DEMO_VIDEO_RATE, ...AUDIO_ENCODER, ...MUXER, input.outPath];
}
