// Step 39: GlowRing (01_specs §14.6 accessibility contract; 03_motion_spec M-C-01, §8, §9.4).
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { GlowRing } from '../glow-ring'
import { arcPath, circlePath, isEscalation, RING_COLOURS, stateRank, tickLines } from '../glow-ring.math'
import { ambientSnapshot, OnScreenObserver, withProviders } from './test-utils'

const g = globalThis as unknown as Record<string, unknown>
const originalObserver = g.IntersectionObserver
beforeAll(() => {
  g.IntersectionObserver = OnScreenObserver
})
afterAll(() => {
  g.IntersectionObserver = originalObserver
})
afterEach(() => cleanup())

describe('GlowRing maths', () => {
  it('ranks states so only a rise to ATTENTION or CRITICAL is an escalation (R8)', () => {
    expect(stateRank('READY')).toBe(0)
    expect(isEscalation('READY', 'ATTENTION')).toBe(true)
    expect(isEscalation('ATTENTION', 'CRITICAL')).toBe(true)
    expect(isEscalation('CRITICAL', 'READY')).toBe(false)
    expect(isEscalation('READY', 'RECORDING')).toBe(false)
    expect(RING_COLOURS.RECORDING.arc).toBe('#EF4444')
    expect(RING_COLOURS.READY.ring).toBe('#FFC86B')
  })

  it('builds 72 ticks (12 long), bracket arcs and a closed inner ring', () => {
    const ticks = tickLines()
    expect(ticks).toHaveLength(72)
    expect(ticks.filter((tick) => tick.long)).toHaveLength(12)
    expect(arcPath(86, -30, 30)).toMatch(/^M[\d.]+ [\d.]+A86 86 0 0 1 /)
    expect(circlePath(74)).toMatch(/^M100 26A74 74/)
  })
})

describe('GlowRing', () => {
  const labels = {
    READY: 'System ready',
    ATTENTION: 'System needs attention',
    CRITICAL: 'System critical',
    UNKNOWN: 'System state unknown',
    RECORDING: 'Recording in progress',
  } as const

  it.each(Object.entries(labels))('is an image labelled for %s (§14.6)', (state, label) => {
    render(withProviders(<GlowRing state={state as keyof typeof labels} size={320} />, { sim: null }))
    const ring = screen.getByRole('img', { name: label })
    expect(ring.tagName.toLowerCase()).toBe('svg')
    expect(screen.getByTestId('glow-ring')).toHaveAttribute('data-state', state)
  })

  it('hides every decorative layer and the default centre from assistive technology', () => {
    render(withProviders(<GlowRing state="READY" size={320} />, { sim: null }))
    const layers = document.querySelectorAll('[data-ring-layer]')
    expect([...layers].map((layer) => layer.getAttribute('data-ring-layer')).sort()).toEqual(
      ['bloom', 'bracket-glow', 'brackets', 'inner', 'ticks', 'track'].sort(),
    )
    for (const layer of layers) expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('[data-ring-center]')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('keeps a custom label and caption children readable', () => {
    render(
      withProviders(
        <GlowRing state="READY" size={320} label="Core ready">
          <p>All core services are running.</p>
        </GlowRing>,
        { sim: null },
      ),
    )
    expect(screen.getByRole('img', { name: 'Core ready' })).toBeInTheDocument()
    expect(screen.getByText('All core services are running.')).toBeVisible()
  })

  it('shows the state word and SYSTEM in the default centre', () => {
    render(withProviders(<GlowRing state="ATTENTION" size={320} />, { sim: null }))
    const center = document.querySelector('[data-ring-center]') as HTMLElement
    expect(center.textContent).toContain('SYSTEM')
    expect(center.textContent).toContain('ATTENTION')
  })

  it('runs its rotation and breathing as two ambient loops (§9.4)', async () => {
    render(withProviders(<GlowRing state="READY" size={320} />, { sim: null }))
    await waitFor(() => expect(ambientSnapshot().slotsGranted).toBe(2))
    expect(ambientSnapshot().granted.map((loop) => loop.label).sort()).toEqual(['ring-breath', 'ring-rotate'])
    expect(document.querySelector('[data-ring-layer="ticks"]')).toHaveAttribute('data-ambient', 'running')
  })

  it('never rotates in mini mode', async () => {
    render(withProviders(<GlowRing state="READY" size={120} mode="mini" />, { sim: null }))
    await waitFor(() => expect(ambientSnapshot().slotsGranted).toBe(1))
    expect(ambientSnapshot().granted[0]?.label).toBe('ring-breath')
    expect(document.querySelector('[data-ring-layer="ticks"]')).toHaveAttribute('data-ambient', 'paused')
  })

  it('is static and marked reduced under reduced motion (§8, AC-70)', async () => {
    render(withProviders(<GlowRing state="READY" size={320} />, { sim: null, reduced: true }))
    const root = screen.getByTestId('glow-ring')
    expect(root).toHaveAttribute('data-motion', 'reduced')
    await act(async () => {
      await Promise.resolve()
    })
    expect(ambientSnapshot().slotsRequested).toBe(0)
    const ticks = document.querySelector('[data-ring-layer="ticks"]') as HTMLElement
    expect(ticks).toHaveAttribute('data-motion', 'reduced')
    expect(ticks).toHaveAttribute('data-ambient', 'paused')
    expect(Number((document.querySelector('[data-ring-layer="bracket-glow"]') as SVGElement).style.opacity)).toBeCloseTo(0.8)
  })

  it('turns the arcs red and shows REC with the timer while recording', () => {
    render(withProviders(<GlowRing state="RECORDING" size={320} recordingSince={Date.now() - 1_122_000} />, { sim: null }))
    const root = screen.getByTestId('glow-ring')
    expect(root.style.getPropertyValue('--ring-arc-color').toUpperCase()).toBe('#EF4444')
    expect(screen.getByTestId('rec-indicator')).toBeInTheDocument()
    expect(screen.getByText(/REC 00:18:4\d/)).toBeInTheDocument()
  })

  it('uses the brand emblem with a unique gradient id per instance (D48)', () => {
    render(
      withProviders(
        <>
          <GlowRing state="READY" size={340} mode="login" />
          <GlowRing state="READY" size={340} mode="login" />
        </>,
        { sim: null },
      ),
    )
    const gradients = [...document.querySelectorAll('[data-ring-emblem] linearGradient')].map((node) => node.id)
    expect(gradients).toHaveLength(2)
    expect(new Set(gradients).size).toBe(2)
  })
})
