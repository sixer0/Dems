/**
 * Pure maths of the procedural camera feed (03_motion_spec M-C-12; 01_specs §14.10; D46).
 *
 * The crops and grades match step 92's generator (`packages/shared/scripts/gen-demo-media.ts`,
 * cameras table), so the procedural fallback frames the room the same way as the videos it
 * replaces: Cam 1 is the full-width 16:9 band of the 3:2 still at object-position ≈62% 45% (D46),
 * Cam 2 a tighter, mirrored reverse-angle crop.
 */
import type { VideoTrackId } from '@dems/shared/domain'
import { motion as tokens } from '@dems/shared/tokens'
import { formatDate } from '@dems/shared/realtime'

/** Pixel size of `@dems/shared/assets/hero/room-2560.jpg` (step 29, D46). */
export const STILL_SIZE = { width: 2560, height: 1706 } as const

export interface CameraFraming {
  /** Crop of the 2560×1706 still, in still pixels. */
  crop: { x: number; y: number; w: number; h: number }
  mirror: boolean
  /** Canvas 2D `filter` (the D46 dark-warm grade, same order as step 92). */
  grade: string
  /** Ken Burns phase offset (Cam 2 runs 11 s behind, M-C-12). */
  phaseMs: number
  /** Push-in origin inside the crop, 0–1 (hero M-C-13 uses 60% 40%). */
  origin: { x: number; y: number }
  /** Seed of the grain noise (fixed per camera, so a reload shows the same grain). */
  seed: number
}

export const CAMERA_FRAMING: Record<VideoTrackId, CameraFraming> = {
  'VIDEO-01': {
    crop: { x: 0, y: 120, w: 2560, h: 1440 },
    mirror: false,
    grade: 'brightness(0.84) sepia(0.22) saturate(0.8) contrast(1.05)',
    phaseMs: 0,
    origin: { x: 0.6, y: 0.4 },
    seed: 20261001,
  },
  'VIDEO-02': {
    crop: { x: 640, y: 144, w: 1792, h: 1008 },
    mirror: true,
    grade: 'brightness(0.78) sepia(0.16) saturate(0.72) contrast(1.07)',
    phaseMs: 11_000,
    origin: { x: 0.45, y: 0.4 },
    seed: 20261002,
  },
}

/** M-C-12: push-in amplitude (scale 1.00 → 1.06). */
export const KEN_BURNS_MAX_SCALE = 1.06

/**
 * Ken Burns scale at time `t`: 1.00 → 1.06 over `kenBurns` (30 s), then back (alternating), with
 * a cosine ease so the turn-around has no visible kink. `t` in ms; phase in ms.
 */
export function kenBurnsScale(t: number, phaseMs = 0, periodMs: number = tokens.ambient.kenBurns): number {
  const cycle = 2 * periodMs
  const x = (((t - phaseMs) % cycle) + cycle) % cycle
  const eased = (1 - Math.cos((Math.PI * x) / periodMs)) / 2
  return 1 + (KEN_BURNS_MAX_SCALE - 1) * eased
}

/** M-C-12: scanline band opacity (8%). */
export const SCANLINE_ALPHA = 0.08
/** Band height as a share of the frame height. */
export const SCANLINE_BAND = 0.14

/**
 * Scanline band position at time `t`: during the first `scanlineSweep` (1,200 ms) of every
 * `scanline` period (6,000 ms) the band travels from above the frame to below it; `null` outside
 * the sweep. The result is the band's top edge as a share of the frame height.
 */
export function scanlineTop(
  t: number,
  periodMs: number = tokens.ambient.scanline,
  sweepMs: number = tokens.ambient.scanlineSweep,
): number | null {
  const phase = ((t % periodMs) + periodMs) % periodMs
  if (phase >= sweepMs) return null
  return -SCANLINE_BAND + (phase / sweepMs) * (1 + SCANLINE_BAND)
}

/**
 * Burnt-in OSD timestamp, `YYYY-MM-DD  HH:mm:ss  UTC+07:00` (the same layout as step 92's
 * evidence clips), from the simulator clock.
 */
export function osdTimestamp(epochMs: number): string {
  return formatDate(epochMs, 'YYYY-MM-DD  HH:mm:ss  [UTC]Z')
}

/**
 * Bottom OSD line of the procedural feed (step 92 live-loop wording; DEMO per P13). With the Core's
 * data (`liveData`, Live mode) the line keeps the DEMO marking and drops LIVE: the picture is the
 * bundled demo still (decision MS-1), not the Core's camera, and in Live mode the word "live" names
 * the server's data only (04_client_integration_spec §3.2; plan row W0, item 7).
 */
export function osdLabel(cameraId: VideoTrackId, liveData = false): string {
  const n = cameraId.slice(-2)
  return liveData ? `CAM-${n} | ${cameraId} | BUNDLED DEMO` : `CAM-${n} | ${cameraId} | LIVE | DEMO`
}

/**
 * Source rectangle for one frame: the crop scaled by `scale` around the push-in origin, clamped
 * so the rectangle never leaves the crop (drift stays inside the frame).
 */
export function kenBurnsSourceRect(
  crop: CameraFraming['crop'],
  origin: CameraFraming['origin'],
  scale: number,
): { x: number; y: number; w: number; h: number } {
  const w = crop.w / scale
  const h = crop.h / scale
  const x = crop.x + (crop.w - w) * origin.x
  const y = crop.y + (crop.h - h) * origin.y
  return { x, y, w, h }
}

/** Canvas backing size: CSS size × device pixel ratio, capped so a feed never exceeds 1280 wide. */
export function backingSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  maxWidth = 1280,
): { width: number; height: number } {
  if (!(cssWidth > 0) || !(cssHeight > 0)) return { width: 0, height: 0 }
  const ratio = Math.min(Math.max(1, dpr || 1), maxWidth / cssWidth)
  return { width: Math.max(1, Math.round(cssWidth * ratio)), height: Math.max(1, Math.round(cssHeight * ratio)) }
}
