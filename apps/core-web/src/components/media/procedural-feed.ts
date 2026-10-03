/**
 * Procedural camera renderer (01_specs §14.10 as amended by D50; 03_motion_spec M-C-12).
 *
 * The fallback of `CameraFeed` when a demo video cannot load or play: a graded crop of the hero
 * still (`@dems/shared/assets/hero/room-2560.jpg`, D46) with, all inside the canvas,
 * - Ken Burns push-in 1.00 → 1.06 over 30 s, alternating (Cam 2 phase-shifted by 11 s);
 * - film grain from the seeded RNG (tiles generated once, cycled at 25 fps);
 * - a scanline band (8%, a 1,200 ms sweep every 6 s) and a static vignette;
 * - a burnt-in UTC+07:00 timestamp from the simulator clock and a DEMO OSD line.
 * Reduced or paused: the push-in and scanline stop, the grain freezes on one tile, and the
 * timestamp still ticks at 1 Hz (it is information).
 *
 * Until the still has decoded, a room abstraction is painted from gradients (§14.10 fallback).
 * Everything is plain canvas 2D; nothing here touches React.
 */
import roomStillUrl from '@dems/shared/assets/hero/room-2560.jpg?url'
import type { VideoTrackId } from '@dems/shared/domain'
import { palette } from '@dems/shared/tokens'
import { mulberry32 } from '@dems/shared/sim'
import {
  CAMERA_FRAMING,
  SCANLINE_ALPHA,
  SCANLINE_BAND,
  kenBurnsScale,
  kenBurnsSourceRect,
  osdLabel,
  osdTimestamp,
  scanlineTop,
} from './camera-feed.math'

/** Grain tiles per camera and their edge (px). */
const GRAIN_TILES = 6
const GRAIN_SIZE = 128
/** Grain opacity on top of the image (sensor noise, subtle). */
const GRAIN_ALPHA = 0.07
/** Working width of the graded still per camera (enough for a 1280-wide backing store). */
const GRADED_WIDTH = 1440

let stillPromise: Promise<HTMLImageElement | null> | null = null

/** Loads and decodes the hero still once per page; resolves `null` when it cannot load. */
function loadStill(): Promise<HTMLImageElement | null> {
  if (stillPromise) return stillPromise
  stillPromise = new Promise((resolve) => {
    if (typeof Image !== 'function') {
      resolve(null)
      return
    }
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => {
      stillPromise = null // allow a later retry
      resolve(null)
    }
    image.src = roomStillUrl
  })
  return stillPromise
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const gradedCache = new Map<VideoTrackId, HTMLCanvasElement>()

/** The camera's crop, graded and mirrored once into an offscreen canvas. */
function gradedFrame(cameraId: VideoTrackId, still: HTMLImageElement): HTMLCanvasElement | null {
  const cached = gradedCache.get(cameraId)
  if (cached) return cached
  const { crop, mirror, grade } = CAMERA_FRAMING[cameraId]
  const width = Math.min(GRADED_WIDTH, crop.w)
  const height = Math.round((width * crop.h) / crop.w)
  const canvas = createCanvas(width, height)
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return null
  ctx.filter = grade
  if (mirror) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(still, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)
  gradedCache.set(cameraId, canvas)
  return canvas
}

/** Seeded grain tiles (grey noise with alpha), generated once per seed. */
const grainCache = new Map<number, HTMLCanvasElement[]>()
function grainTiles(seed: number): HTMLCanvasElement[] {
  const cached = grainCache.get(seed)
  if (cached) return cached
  const rng = mulberry32(seed)
  const tiles: HTMLCanvasElement[] = []
  for (let i = 0; i < GRAIN_TILES; i += 1) {
    const tile = createCanvas(GRAIN_SIZE, GRAIN_SIZE)
    const ctx = tile?.getContext('2d')
    if (!tile || !ctx) break
    const data = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE)
    for (let p = 0; p < data.data.length; p += 4) {
      const v = Math.floor(rng.next() * 256)
      data.data[p] = v
      data.data[p + 1] = v
      data.data[p + 2] = v
      data.data[p + 3] = 255
    }
    ctx.putImageData(data, 0, 0)
    tiles.push(tile)
  }
  grainCache.set(seed, tiles)
  return tiles
}

export interface ProceduralPaintState {
  /** Push-in, scanline and grain animate (false: reduced, suppressed or paused). */
  animate: boolean
  /** Simulator time for the burnt-in timestamp (epoch ms). */
  now: number
}

export interface ProceduralFeed {
  /** Paints one frame at loop time `t` (ms). */
  paint(t: number, state: ProceduralPaintState): void
  /** Re-sizes the backing store (CSS px × DPR, already capped by the caller). */
  resize(width: number, height: number): void
  /** True once the still has decoded (before that, the gradient room abstraction shows). */
  hasStill(): boolean
  destroy(): void
}

/**
 * Creates the painter for one canvas. Returns `null` when the canvas has no 2D context
 * (jsdom, or a browser that refuses one): the caller then keeps the poster or the plain frame.
 */
export function createProceduralFeed(
  canvas: HTMLCanvasElement,
  cameraId: VideoTrackId,
  onStillReady?: () => void,
): ProceduralFeed | null {
  const context = canvas.getContext('2d')
  if (!context) return null
  const ctx: CanvasRenderingContext2D = context
  const framing = CAMERA_FRAMING[cameraId]
  let graded: HTMLCanvasElement | null = null
  let destroyed = false
  let vignette: CanvasGradient | null = null
  let frameIndex = 0
  const tiles = grainTiles(framing.seed)
  const grainRng = mulberry32(framing.seed ^ 0x9e3779b9)

  void loadStill().then((still) => {
    if (destroyed || !still) return
    graded = gradedFrame(cameraId, still)
    onStillReady?.()
  })

  function buildVignette() {
    const { width, height } = canvas
    const r = Math.hypot(width, height) / 2
    vignette = ctx.createRadialGradient(width / 2, height / 2, r * 0.45, width / 2, height / 2, r)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)')
  }

  function paintRoomAbstraction(width: number, height: number) {
    // §14.10 fallback: warm walls, a darker floor and a table silhouette.
    const wall = ctx.createLinearGradient(0, 0, 0, height)
    wall.addColorStop(0, '#2a1d12')
    wall.addColorStop(0.62, '#1a120b')
    wall.addColorStop(1, '#0d0906')
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(255,200,107,0.08)'
    ctx.fillRect(width * 0.58, height * 0.08, width * 0.22, height * 0.42)
    ctx.fillStyle = '#080604'
    ctx.beginPath()
    ctx.ellipse(width * 0.52, height * 0.74, width * 0.3, height * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  function paintOsd(width: number, height: number, now: number) {
    // Legible text only: skip the OSD on thumbnails shorter than 110 backing px.
    if (height < 110) return
    const size = Math.max(10, Math.round(height * 0.036))
    ctx.font = `600 ${size}px ${'"JetBrains Mono Variable", ui-monospace, monospace'}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const lines = [osdTimestamp(now), osdLabel(cameraId)]
    let y = height - size * 0.9
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const text = lines[i] ?? ''
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillText(text, width / 2 + 1, y + 1)
      ctx.fillStyle = 'rgba(249,250,251,0.9)'
      ctx.fillText(text, width / 2, y)
      y -= size * 1.35
    }
  }

  return {
    hasStill: () => graded !== null,
    resize(width, height) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      buildVignette()
    },
    paint(t, { animate, now }) {
      const { width, height } = canvas
      if (width === 0 || height === 0) return
      ctx.save()
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      if (graded) {
        const scale = animate ? kenBurnsScale(t, framing.phaseMs) : 1
        const cropInGraded = { x: 0, y: 0, w: graded.width, h: graded.height }
        const src = kenBurnsSourceRect(cropInGraded, framing.origin, scale)
        ctx.drawImage(graded, src.x, src.y, src.w, src.h, 0, 0, width, height)
      } else {
        paintRoomAbstraction(width, height)
      }

      // Grain: cycle the seeded tiles at the paint rate, at a random offset; frozen when static.
      if (tiles.length > 0) {
        if (animate) frameIndex = (frameIndex + 1) % tiles.length
        const tile = tiles[frameIndex]
        const pattern = tile ? ctx.createPattern(tile, 'repeat') : null
        if (pattern) {
          const dx = animate ? Math.floor(grainRng.next() * GRAIN_SIZE) : 0
          const dy = animate ? Math.floor(grainRng.next() * GRAIN_SIZE) : 0
          ctx.globalAlpha = GRAIN_ALPHA
          ctx.globalCompositeOperation = 'overlay'
          ctx.translate(-dx, -dy)
          ctx.fillStyle = pattern
          ctx.fillRect(0, 0, width + GRAIN_SIZE, height + GRAIN_SIZE)
          ctx.translate(dx, dy)
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
        }
      }

      if (vignette) {
        ctx.fillStyle = vignette
        ctx.fillRect(0, 0, width, height)
      }

      const band = animate ? scanlineTop(t) : null
      if (band !== null) {
        const top = band * height
        const bandHeight = SCANLINE_BAND * height
        const gradient = ctx.createLinearGradient(0, top, 0, top + bandHeight)
        gradient.addColorStop(0, 'rgba(255,255,255,0)')
        gradient.addColorStop(0.5, `rgba(255,255,255,${SCANLINE_ALPHA})`)
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, top, width, bandHeight)
      }

      paintOsd(width, height, now)
      ctx.restore()
    },
    destroy() {
      destroyed = true
    },
  }
}

/**
 * NO SIGNAL noise painter (M-C-12: "the image fades to grey noise"): grey static on a small
 * canvas, scaled up by CSS. Returns `null` without a 2D context.
 */
export function createNoisePainter(canvas: HTMLCanvasElement, seed: number): ((animate: boolean) => void) | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const rng = mulberry32(seed)
  const width = canvas.width || 160
  const height = canvas.height || 90
  const image = ctx.createImageData(width, height)
  let painted = false
  return (animate) => {
    if (!animate && painted) return
    for (let p = 0; p < image.data.length; p += 4) {
      const v = 40 + Math.floor(rng.next() * 110)
      image.data[p] = v
      image.data[p + 1] = v
      image.data[p + 2] = v
      image.data[p + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
    painted = true
  }
}

/** Background colour of an empty feed before anything paints (L4 media black). */
export const FEED_BACKGROUND = palette.black
