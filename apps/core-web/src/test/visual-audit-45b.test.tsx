// Step 45b (D96): regression tests for the step-45 visual-audit findings fixed outside the media
// budget (that one has components/media/__tests__/live-decode-budget.test.tsx).
// - F45-02: the shell's escalation signal always gets a slot; decoration yields first; cap 4.
// - F45-04: Session Monitor M Start Time carries the UTC+07:00 label (AC-74).
// - F45-06: the CRITICAL ring caption says recording continues while a session records.
// (F45-05, F45-07 and F45-08 are CSS/layout fixes, checked by screenshot in implementation/71.)
import { cleanup, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { FaultKind } from '@dems/shared/sim'
import { createAmbientRegistry } from '@/motion'
import { OnScreenObserver, createTestSim, withProviders } from '@/components/composed/__tests__/test-utils'
import { SystemRingPanel } from '@/features/dashboard/system-ring-panel'
import { DetailsPanel } from '@/features/session-monitor/details-panel'

const originalObserver = (globalThis as unknown as Record<string, unknown>).IntersectionObserver

beforeAll(() => {
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = OnScreenObserver
})

afterAll(() => {
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = originalObserver
})

afterEach(() => {
  cleanup()
})

describe('F45-02: escalation reserve in the ambient registry', () => {
  it('grants the shell slot to an escalation over four page loops and pauses decoration first', () => {
    const registry = createAmbientRegistry()
    // The Dashboard in `fault-demo` (audit 45 §3.1): ring rotation and breathing, panel D's REC
    // pulse, hero Ken Burns (decor), and the shell (drift, dot, clock colon).
    registry.acquire('topo', { label: 'topo-drift', priority: 'shell', group: 'shell' })
    registry.acquire('dot', { label: 'secure-dot', priority: 'shell', group: 'shell' })
    registry.acquire('rotate', { label: 'ring-rotate' })
    registry.acquire('breath', { label: 'ring-breath' })
    registry.acquire('hero', { label: 'hero-ken-burns', priority: 'decor' })
    registry.acquire('rec', { label: 'rec-pulse', group: 'rec-pulse' })
    let snapshot = registry.getSnapshot()
    // Before the escalation: four page/decor slots, the idle shell yields (§9.4, unchanged).
    expect(snapshot.slotsGranted).toBe(4)
    expect(snapshot.grantedIds.has('hero')).toBe(true)
    expect(snapshot.grantedIds.has('topo')).toBe(false)

    // The SECURE pill turns CRITICAL: the beam asks with escalation priority in the shell group.
    const releaseBeam = registry.acquire('beam', { label: 'secure-beam', priority: 'escalation', group: 'shell' })
    snapshot = registry.getSnapshot()
    expect(snapshot.slotsRequested).toBe(5)
    expect(snapshot.slotsGranted).toBe(4) // the cap still holds
    expect(snapshot.grantedIds.has('beam')).toBe(true)
    expect(snapshot.grantedIds.has('topo')).toBe(true) // the whole shell slot runs
    expect(snapshot.suppressed.map((loop) => loop.label)).toEqual(['hero-ken-burns']) // decor yields
    expect(['rotate', 'breath', 'rec'].every((id) => snapshot.grantedIds.has(id))).toBe(true)

    // Recovery: the beam stops, decoration resumes, the idle shell yields again.
    releaseBeam()
    snapshot = registry.getSnapshot()
    expect(snapshot.grantedIds.has('hero')).toBe(true)
    expect(snapshot.grantedIds.has('topo')).toBe(false)
  })

  it('ranks decoration above idle shell loops, so §9.4 page budgets are unchanged', () => {
    const registry = createAmbientRegistry()
    registry.acquire('topo', { label: 'topo-drift', priority: 'shell', group: 'shell' })
    for (const label of ['a', 'b', 'c']) registry.acquire(label, { label })
    registry.acquire('hero', { label: 'hero-ken-burns', priority: 'decor' })
    let snapshot = registry.getSnapshot()
    expect(snapshot.grantedIds.has('hero')).toBe(true)
    expect(snapshot.suppressed.map((loop) => loop.label)).toEqual(['topo-drift'])

    // The camera standby sweep (`idle`) only takes a slot nobody else wants: it ranks below the
    // shell, so the Dashboard keeps its §9.4 loops and the sweep stays still (F45-01).
    registry.acquire('standby', { label: 'camera-standby', priority: 'idle', group: 'camera-feeds' })
    snapshot = registry.getSnapshot()
    expect(snapshot.suppressed.map((loop) => loop.label)).toEqual(['topo-drift', 'camera-standby'])
  })

  it('lets the idle standby sweep run when slots are free (Devices: shell + sweep)', () => {
    const registry = createAmbientRegistry()
    registry.acquire('topo', { label: 'topo-drift', priority: 'shell', group: 'shell' })
    registry.acquire('standby', { label: 'camera-standby', priority: 'idle', group: 'camera-feeds' })
    const snapshot = registry.getSnapshot()
    expect(snapshot.slotsGranted).toBe(2)
    expect(snapshot.suppressed).toHaveLength(0)
  })
})

describe('F45-04: Session Monitor Start Time zone label (AC-74)', () => {
  it('appends UTC+07:00 to the start time', () => {
    render(withProviders(<DetailsPanel />, { sim: createTestSim('recording') }))
    const row = screen.getByTestId('sm-details')
    expect(row.textContent).toMatch(/\d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2} UTC\+07:00/)
  })
})

describe('F45-06: state-aware CRITICAL caption', () => {
  it('says recording continues when the system is CRITICAL during a recording', () => {
    const sim = createTestSim('recording')
    sim.actions.inject(FaultKind.CAMERA_LOSS)
    render(withProviders(<SystemRingPanel />, { sim }))
    expect(screen.getByText('Recording continues. A critical fault needs attention.')).toBeInTheDocument()
    expect(screen.queryByText(/blocks recording/)).toBeNull()
  })

  it('keeps "blocks recording" when no session records', () => {
    const sim = createTestSim('idle')
    sim.actions.inject(FaultKind.CAMERA_LOSS)
    render(withProviders(<SystemRingPanel />, { sim }))
    expect(screen.getByText('A critical fault blocks recording. Open System & Maintenance.')).toBeInTheDocument()
  })
})
