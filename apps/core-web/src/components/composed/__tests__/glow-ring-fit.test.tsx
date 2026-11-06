// E-fix FX-W, E2E-W1-5: the Dashboard ring's state word is fitted inside the inner ring when its ink
// would cross it, and keeps its display size (32 px) and look when it clears it.
//
// The geometry below was measured in the lane-3 console (Orbitron 700 at 32 px, canvas ink metrics;
// `gateway_check/assets/11b_ring_geometry.log`): ink widths READY 129.5, ATTENTION 209.6, CRITICAL
// 169.5, UNKNOWN 193.5 px; the ink reaches 43.1 px below the centre of the 258 px ring at 1440 x 900,
// 22.7 px in the 284 px ring at 390 x 844 and 26.2 px in the 322 px ring at 1920 x 1080.
import { cleanup, render } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { GlowRing } from '../glow-ring'
import { INNER_RING_STROKE, RING_RADII, RING_VIEWBOX, RING_WORD_AIR, RING_WORD_MIN_SCALE, ringWordBudget, ringWordScale } from '../glow-ring.math'
import { OnScreenObserver, withProviders } from './test-utils'

const INK = { READY: 129.5, ATTENTION: 209.6, CRITICAL: 169.5, UNKNOWN: 193.5 } as const
const AT_1440 = { size: 258, dy: 43.1 }
const AT_390 = { size: 284, dy: 22.7 }
const AT_1920 = { size: 322, dy: 26.2 }

/** How far the ink's farther corner stays inside the inner edge of the inner ring (negative: it crosses). */
function clearance(size: number, dy: number, inkWidth: number): number {
  const edge = ((RING_RADII.inner - INNER_RING_STROKE / 2) / RING_VIEWBOX) * size
  return edge - Math.hypot(inkWidth / 2, dy)
}

describe('ringWordScale (pure)', () => {
  it('keeps every word that clears the ring at scale 1 (its look unchanged)', () => {
    expect(ringWordScale(INK.READY, AT_1440.size, AT_1440.dy)).toBe(1)
    expect(ringWordScale(INK.READY, AT_390.size, AT_390.dy)).toBe(1)
    expect(ringWordScale(INK.CRITICAL, AT_390.size, AT_390.dy)).toBe(1)
    // UNKNOWN clears the 284 px ring by 3.9 px, more than the trigger air (≈2.3 px): unchanged.
    expect(clearance(AT_390.size, AT_390.dy, INK.UNKNOWN)).toBeGreaterThan(RING_WORD_AIR.trigger * AT_390.size)
    expect(ringWordScale(INK.UNKNOWN, AT_390.size, AT_390.dy)).toBe(1)
    // 1920 x 1080: every word fits the 322 px ring, ATTENTION included.
    for (const width of Object.values(INK)) expect(ringWordScale(width, AT_1920.size, AT_1920.dy)).toBe(1)
  })

  it('fits ATTENTION (E2E-W1-5) at 1440 x 900 and at 390 x 844, keeping the fit air inside the ring', () => {
    expect(clearance(AT_1440.size, AT_1440.dy, INK.ATTENTION)).toBeLessThan(0)
    expect(clearance(AT_390.size, AT_390.dy, INK.ATTENTION)).toBeLessThan(0)
    for (const at of [AT_1440, AT_390]) {
      const scale = ringWordScale(INK.ATTENTION, at.size, at.dy)
      expect(scale).toBeLessThan(1)
      expect(scale).toBeGreaterThanOrEqual(RING_WORD_MIN_SCALE)
      expect(INK.ATTENTION * scale).toBeLessThanOrEqual(ringWordBudget(at.size, at.dy, RING_WORD_AIR.fit) + 1e-9)
      expect(clearance(at.size, at.dy, INK.ATTENTION * scale)).toBeGreaterThanOrEqual(RING_WORD_AIR.fit * at.size - 0.5)
    }
    expect(ringWordScale(INK.ATTENTION, AT_1440.size, AT_1440.dy)).toBeCloseTo(0.756, 3)
    expect(ringWordScale(INK.ATTENTION, AT_390.size, AT_390.dy)).toBeCloseTo(0.918, 3)
  })

  it('also fits the other words whose ink crosses the 258 px ring (UNKNOWN, and CRITICAL by 1.2 px)', () => {
    expect(clearance(AT_1440.size, AT_1440.dy, INK.CRITICAL)).toBeCloseTo(-1.2, 1)
    expect(ringWordScale(INK.CRITICAL, AT_1440.size, AT_1440.dy)).toBeCloseTo(0.934, 3)
    expect(ringWordScale(INK.UNKNOWN, AT_1440.size, AT_1440.dy)).toBeCloseTo(0.818, 3)
  })

  it('is 1 without layout, never below the floor, and smaller for a wider word', () => {
    expect(ringWordScale(0, 258, 40)).toBe(1)
    expect(ringWordScale(200, 0, 40)).toBe(1)
    expect(ringWordScale(Number.NaN, 258, 40)).toBe(1)
    expect(ringWordScale(5000, 180, 60)).toBe(RING_WORD_MIN_SCALE)
    expect(ringWordScale(240, 258, 43.1)).toBeLessThan(ringWordScale(220, 258, 43.1))
  })
})

// ── The component: GlowRing measures its word and applies the scale ─────────────────────────

/** Display-size width of each word in the fake layout (the lane-3 box widths at 32 px). */
const BOX_WIDTH: Record<string, number> = { READY: 131.8, ATTENTION: 213.6, CRITICAL: 171.7, UNKNOWN: 197.3 }
const RING_SIZE = 258

function wordScaleOf(element: HTMLElement): number {
  const match = /\*\s*([\d.]+)\)/.exec(element.style.fontSize)
  return match ? Number(match[1]) : 1
}
function wordBoxOf(element: HTMLElement) {
  const text = element.textContent ?? ''
  const key = Object.keys(BOX_WIDTH).find((word) => text.includes(word)) ?? 'READY'
  const scale = wordScaleOf(element)
  const width = (BOX_WIDTH[key] ?? 0) * scale
  const height = 32 * scale
  // The word sits below the centre, as on the 258 px Dashboard ring (its box from 19 px below the centre).
  const top = RING_SIZE / 2 + 19
  return { left: RING_SIZE / 2 - width / 2, top, width, height }
}

const g = globalThis as unknown as Record<string, unknown>
const originalObserver = g.IntersectionObserver
beforeAll(() => {
  g.IntersectionObserver = OnScreenObserver
})
afterAll(() => {
  g.IntersectionObserver = originalObserver
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** jsdom has no layout: the ring and its word get boxes; every canvas is unavailable (the layout box stands in). */
function fakeLayout() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const element = this as HTMLElement
    if (element.dataset?.testid === 'glow-ring') return DOMRect.fromRect({ x: 0, y: 0, width: RING_SIZE, height: RING_SIZE })
    if (element.hasAttribute?.('data-ring-word')) {
      const box = wordBoxOf(element)
      return DOMRect.fromRect({ x: box.left, y: box.top, width: box.width, height: box.height })
    }
    return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 })
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-ring-word') ? wordBoxOf(this).width : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-ring-word') ? wordBoxOf(this).height : 0
  })
}

const word = () => document.querySelector<HTMLElement>('[data-ring-word]')

describe('FXR-W W92-22: one measuring canvas for every fit', () => {
  it('three fits (three state words) create at most one canvas between them', () => {
    fakeLayout()
    const getContext = vi.mocked(HTMLCanvasElement.prototype.getContext)
    render(
      withProviders(
        <>
          <GlowRing state="ATTENTION" size={RING_SIZE} />
          <GlowRing state="CRITICAL" size={RING_SIZE} />
          <GlowRing state="UNKNOWN" size={RING_SIZE} />
        </>,
        { sim: null },
      ),
    )
    const words = Array.from(document.querySelectorAll<HTMLElement>('[data-ring-word]'))
    expect(words).toHaveLength(3)
    for (const element of words) expect(element.getAttribute('data-fit-scale')).not.toBeNull()
    // A canvas asked for its context once at most (the context, or its absence, is kept).
    expect(getContext.mock.calls.length).toBeLessThanOrEqual(1)
  })
})

describe('GlowRing applies the fit to its state word', () => {
  it('ATTENTION in the 258 px ring gets a smaller font size through the display token; the word and its classes stay', () => {
    fakeLayout()
    render(withProviders(<GlowRing state="ATTENTION" size={RING_SIZE} />, { sim: null }))
    const element = word()
    expect(element).not.toBeNull()
    const scale = Number(element!.getAttribute('data-fit-scale'))
    expect(scale).toBeGreaterThan(RING_WORD_MIN_SCALE)
    expect(scale).toBeLessThan(0.8)
    expect(element!.style.fontSize).toBe(`calc(var(--text-display) * ${scale})`)
    expect(element!).toHaveClass('font-display', 'text-display', 'font-bold', 'uppercase', 'leading-none', 'whitespace-nowrap')
    expect(element!.textContent).toContain('ATTENTION')
  })

  it('READY keeps the display size: no fit attribute and no inline font size', () => {
    fakeLayout()
    render(withProviders(<GlowRing state="READY" size={RING_SIZE} />, { sim: null }))
    const element = word()
    expect(element).not.toBeNull()
    expect(element!).not.toHaveAttribute('data-fit-scale')
    expect(element!.style.fontSize).toBe('')
    expect(element!.textContent).toContain('READY')
  })

  it('without layout (plain jsdom) nothing is scaled', () => {
    render(withProviders(<GlowRing state="ATTENTION" size={RING_SIZE} />, { sim: null }))
    expect(word()).not.toHaveAttribute('data-fit-scale')
    expect(word()!.style.fontSize).toBe('')
  })
})
