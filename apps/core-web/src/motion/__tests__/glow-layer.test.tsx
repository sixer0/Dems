// GlowLayer: pre-rendered token glows, opacity-only changes, breathing as a counted ambient loop
// (03_motion_spec §2.2, §9.2, P3; AC-70).
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { elevation, palette } from '@dems/shared/tokens'
import { glowShadow } from '../glow'
import { GlowLayer, type GlowLayerProps } from '../glow-layer'
import { MotionPolicyProvider } from '../motion-policy-provider'
import { useAmbientSnapshot } from '../use-ambient-loop'
import { fakeMatchMedia, memoryStorage } from './helpers'

/** Reports every observed element as on screen, so R10 off-screen pausing lets loops run. */
class VisibleIntersectionObserver {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    queueMicrotask(() =>
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    )
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Count() {
  const snapshot = useAmbientSnapshot()
  return <span data-testid="count">{snapshot.granted.map((loop) => loop.label).join(',')}</span>
}

function renderGlow(props: GlowLayerProps, reduced = false) {
  return render(
    <MotionPolicyProvider search="" storage={memoryStorage()} matchMedia={fakeMatchMedia(reduced).matchMedia}>
      <div className="relative rounded-xl">
        <GlowLayer {...props} />
      </div>
      <Count />
    </MotionPolicyProvider>,
  )
}

describe('glowShadow', () => {
  it('uses the elevation tokens for the brand tone and swaps only the colour for status tones', () => {
    expect(glowShadow('brand', 2)).toBe(elevation[2])
    expect(glowShadow('brand', 0)).toBe('none')
    expect(glowShadow('danger', 1)).toBe(`0 0 0 1px ${palette.danger}59, 0 0 14px 0 ${palette.danger}1F`)
    expect(glowShadow('success', 3)).toBe(
      elevation[3].replaceAll('#FFC86B', palette.success).replaceAll('#FF9F3D', palette.success),
    )
  })
})

describe('GlowLayer', () => {
  it('pre-renders levels 1-3 plus a bloom layer, with only the current level visible', () => {
    renderGlow({ level: 2 })
    const root = screen.getByTestId('glow-layer')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root).toHaveAttribute('data-glow-level', '2')
    expect(root).toHaveAttribute('data-motion', 'full')
    expect(root).toHaveClass('pointer-events-none', 'absolute', 'inset-0')
    const layers = root.querySelectorAll('[data-glow-layer]')
    expect(layers).toHaveLength(4)
    const byLevel = (level: string) => root.querySelector<HTMLElement>(`[data-glow-layer="${level}"]`)!
    expect(byLevel('2').style.opacity).toBe('1')
    expect(byLevel('1').style.opacity).toBe('0')
    expect(byLevel('3').style.opacity).toBe('0')
    expect(byLevel('2').style.boxShadow).not.toBe('')
  })

  it('cross-fades to a new level by opacity', async () => {
    const view = renderGlow({ level: 1 })
    view.rerender(
      <MotionPolicyProvider search="" storage={memoryStorage()} matchMedia={fakeMatchMedia(false).matchMedia}>
        <div className="relative rounded-xl">
          <GlowLayer level={3} />
        </div>
      </MotionPolicyProvider>,
    )
    const root = screen.getByTestId('glow-layer')
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-glow-layer="3"]')!.style.opacity).toBe('1')
      expect(root.querySelector<HTMLElement>('[data-glow-layer="1"]')!.style.opacity).toBe('0')
    })
  })

  it('breathes as one registered ambient loop when on screen', async () => {
    renderGlow({ level: 2, breathe: true, loopLabel: 'ring-breathe' })
    await vi.waitFor(() => expect(screen.getByTestId('glow-layer')).toHaveAttribute('data-ambient', 'running'))
    expect(screen.getByTestId('count')).toHaveTextContent('ring-breathe')
  })

  it('never breathes under reduced motion and is marked data-motion="reduced" (AC-70)', async () => {
    renderGlow({ level: 2, breathe: true, loopLabel: 'ring-breathe' }, true)
    await act(async () => {
      await Promise.resolve()
    })
    const root = screen.getByTestId('glow-layer')
    expect(root).toHaveAttribute('data-motion', 'reduced')
    expect(root).toHaveAttribute('data-ambient', 'paused')
    expect(screen.getByTestId('count')).toHaveTextContent('')
    expect(root.querySelector<HTMLElement>('[data-glow-layer="2"]')!.style.opacity).toBe('1')
  })

  it('does not pulse on mount (the first pulseKey is the resting state)', () => {
    renderGlow({ level: 1, pulseKey: 'ready' })
    expect(screen.getByTestId('glow-layer').querySelector<HTMLElement>('[data-glow-layer="bloom"]')).toHaveClass(
      'opacity-0',
    )
  })
})
