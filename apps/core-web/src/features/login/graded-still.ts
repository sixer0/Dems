/**
 * The Login backdrop grade, baked once (research/04 §7; D46: brightness .55, sepia .35,
 * saturate .8 on the licensed room still).
 *
 * A live CSS `filter` on a full-viewport image is re-applied at composite time on every frame
 * that anything above it animates (the ring rotation, Ken Burns, the particles). With software
 * compositing (headless Chromium, and GPU-less machines) that alone held the Login at about
 * 17 fps; the same page without the filter ran at 44 fps (step 43 browser probe, 1920×1080).
 * So the grade is drawn once into a canvas with the *same* filter string (`ctx.filter` uses the
 * same filter implementation as CSS), encoded to an object URL, and the `<img>` shows that. Until
 * the baked copy is ready, or when canvas filters are unavailable (jsdom, old browsers), the
 * image keeps the CSS filter, so the look never changes, only the cost.
 */
import { useEffect, useState } from 'react'
import { reportLoginIssue } from './report'

export const BACKDROP_GRADE_FILTER = 'brightness(0.55) sepia(0.35) saturate(0.8)'
/** The baked copy only needs the viewport's pixels plus the Ken Burns headroom (scale 1.06). */
const KEN_BURNS_HEADROOM = 1.1
const JPEG_QUALITY = 0.86

export interface GradedStill {
  src: string
  /** True once `src` is the baked copy (the `<img>` then drops its CSS filter). */
  baked: boolean
}

function canvasFiltersSupported(context: CanvasRenderingContext2D | null): context is CanvasRenderingContext2D {
  return context !== null && typeof context.filter === 'string'
}

/** Width to bake at: the viewport in device pixels plus headroom, never above the source. */
export function bakeWidth(naturalWidth: number, viewportWidth: number, devicePixelRatio: number): number {
  return Math.max(1, Math.min(naturalWidth, Math.ceil(viewportWidth * devicePixelRatio * KEN_BURNS_HEADROOM)))
}

export function useGradedStill(source: string): GradedStill {
  const [still, setStill] = useState<GradedStill>({ src: source, baked: false })

  useEffect(() => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return undefined
    let cancelled = false
    let objectUrl: string | null = null
    const image = new Image()
    // Environments without `decode()` (jsdom) have no canvas either: keep the CSS filter.
    if (typeof image.decode !== 'function') return undefined
    image.decoding = 'async'
    image.src = source

    const bake = async () => {
      await image.decode()
      if (cancelled) return
      const width = bakeWidth(image.naturalWidth, window.innerWidth, window.devicePixelRatio || 1)
      const height = Math.round((image.naturalHeight * width) / image.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!canvasFiltersSupported(context)) return // keep the CSS filter
      context.filter = BACKDROP_GRADE_FILTER
      context.drawImage(image, 0, 0, width, height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      const baked = new Image()
      baked.src = objectUrl
      await baked.decode() // swap only once decoded: no blank frame
      if (!cancelled) setStill({ src: objectUrl, baked: true })
    }

    bake().catch((error: unknown) => {
      // The CSS filter stays: same look, higher per-frame cost. Worth knowing, not worth a UI.
      reportLoginIssue('warn', 'login.backdrop.bake', error)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [source])

  return still
}
