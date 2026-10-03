/**
 * CameraFeed maths (04_mobile_specs §8.3, §7.4 M-C-12; 03_motion_spec M-C-12): framing per camera,
 * Ken Burns, grain re-seeding, the scanline sweep and the burnt-in timestamp. Worklet-safe; the
 * timestamp is plain arithmetic at UTC+07:00 (no `Intl`, H-MB-08).
 */
import { DISPLAY_UTC_OFFSET_MINUTES } from '@dems/shared/realtime';
import { motion } from '@dems/shared/tokens';

/** The feed is drawn in a fixed 16:9 virtual space and scaled to cover the canvas. */
export const FEED_W = 320;
export const FEED_H = 180;

const tokenAmbient = motion.ambient as Readonly<Record<string, number | undefined>>;
/** One push-in (03M §2.3 `kenBurns`); it alternates, so a full cycle is twice this. */
export const KEN_BURNS_MS = tokenAmbient.kenBurns ?? 30_000;
export const KEN_BURNS_MAX = 1.06;
/** Scanline: a 1,200 ms sweep every 6 s (03M §2.3 `scanline`). */
export const SCANLINE_PERIOD_MS = tokenAmbient.scanline ?? 6_000;
export const SCANLINE_SWEEP_MS = 1_200;
export const SCANLINE_BAND = 22;
/** Grain re-seeds at 25 fps; 12.5 fps is the H-S18 fallback. */
export const GRAIN_FPS = 25;
export const GRAIN_FPS_FALLBACK = 12.5;
export const GRAIN_OPACITY = 0.07;
export const FIRST_PAINT_MS = 600;
export const CAMERA_SWITCH_MS = 320;
export const NO_SIGNAL_MS = 400;
/** Cam 2's Ken Burns runs 11 s out of phase with Cam 1 (03M M-C-12). */
export const CAM2_PHASE_MS = 11_000;
/** Local copy of the shared display offset (UTC+07:00), referenced from worklet bodies. */
export const FEED_UTC_OFFSET_MINUTES: number = DISPLAY_UTC_OFFSET_MINUTES;

export interface CameraFraming {
  index: 1 | 2;
  phaseMs: number;
  /** Cam 2 is a mirrored reverse-angle crop (01_specs §14.10). */
  mirror: boolean;
  /** Ken Burns focal point, as a fraction of the frame. */
  focalX: number;
  focalY: number;
}

/** `CAM-2`, `cam2`, `2` → the second camera; anything else frames as Cam 1. */
export function cameraFraming(cameraId: string): CameraFraming {
  const second = /2\s*$/.test(cameraId);
  return second
    ? { index: 2, phaseMs: CAM2_PHASE_MS, mirror: true, focalX: 0.58, focalY: 0.46 }
    : { index: 1, phaseMs: 0, mirror: false, focalX: 0.5, focalY: 0.42 };
}

/** 1.00 → 1.06 → 1.00, eased, one push-in per `KEN_BURNS_MS`. */
export function kenBurnsScale(timeMs: number, phaseMs: number): number {
  'worklet';
  const period = KEN_BURNS_MS * 2;
  const p = (((timeMs + phaseMs) % period) + period) % period;
  return 1 + (KEN_BURNS_MAX - 1) * 0.5 * (1 - Math.cos((2 * Math.PI * p) / period));
}

export function grainSeed(timeMs: number, fps: number): number {
  'worklet';
  return Math.floor(timeMs / (1000 / fps)) % 997;
}

/**
 * Top edge of the scanline band, or off-canvas between sweeps.
 *
 * Worklet rule used throughout this folder: defaults are resolved in the body, never as parameter
 * defaults that name imported bindings (the worklet closure does not capture those; on device that
 * is a ReferenceError on the UI thread).
 */
export function scanlineY(timeMs: number, heightArg?: number, bandArg?: number): number {
  'worklet';
  const height = heightArg ?? FEED_H;
  const band = bandArg ?? SCANLINE_BAND;
  const phase = ((timeMs % SCANLINE_PERIOD_MS) + SCANLINE_PERIOD_MS) % SCANLINE_PERIOD_MS;
  if (phase >= SCANLINE_SWEEP_MS) return -band * 2;
  return -band + (height + band) * (phase / SCANLINE_SWEEP_MS);
}

/** Uniform scale that covers a `width` × `height` canvas with the 16:9 virtual feed. */
export function coverScale(width: number, height: number): number {
  'worklet';
  return Math.max(width / FEED_W, height / FEED_H);
}

function pad2(n: number): string {
  'worklet';
  return n < 10 ? `0${n}` : `${n}`;
}

/** `YYYY-MM-DD HH:MM:SS` at a fixed offset (civil-from-days arithmetic, no `Date` formatting). */
export function formatFeedTimestamp(epochMs: number, offsetMinutesArg?: number): string {
  'worklet';
  const offsetMinutes = offsetMinutesArg ?? FEED_UTC_OFFSET_MINUTES;
  const ms = epochMs + offsetMinutes * 60_000;
  const days = Math.floor(ms / 86_400_000);
  const secs = Math.floor((ms - days * 86_400_000) / 1000);
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(Math.floor(secs / 3600))}:${pad2(Math.floor(secs / 60) % 60)}:${pad2(secs % 60)}`;
}
