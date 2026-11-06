// Ambient loops: at most 4 per viewport, page before shell, paused when hidden or reduced
// (03_motion_spec P3, R10, §8, §9.4; AC-70; MS-04).
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createAmbientRegistry } from '../ambient-registry'
import { MotionPolicyProvider } from '../motion-policy-provider'
import { useAmbientLoop, useAmbientSnapshot } from '../use-ambient-loop'
import { fakeMatchMedia, memoryStorage } from './helpers'

afterEach(() => {
  cleanup()
})

describe('ambient registry', () => {
  it('grants at most 4 slots, page loops before shell loops, one slot per group', () => {
    const registry = createAmbientRegistry()
    expect(registry.cap).toBe(4)
    const releaseTopo = registry.acquire('topo', { label: 'topo-drift', priority: 'shell', group: 'shell' })
    registry.acquire('secure', { label: 'secure-dot', priority: 'shell', group: 'shell' })
    expect(registry.getSnapshot().slotsRequested).toBe(1) // drift + SECURE dot count as one loop

    const releases = ['ring-rotate', 'ring-breathe', 'ken-burns'].map((label) =>
      registry.acquire(label, { label }),
    )
    expect(registry.getSnapshot().slotsGranted).toBe(4)
    expect(registry.getSnapshot().grantedIds.has('topo')).toBe(true)

    // A fourth page loop takes the shell's slot: the page is at 4, so the drift pauses (§9.4).
    const releaseRipple = registry.acquire('ripple', { label: 'ripple' })
    let snapshot = registry.getSnapshot()
    expect(snapshot.slotsRequested).toBe(5)
    expect(snapshot.slotsGranted).toBe(4)
    expect(snapshot.suppressed.map((loop) => loop.label).sort()).toEqual(['secure-dot', 'topo-drift'])

    releaseRipple()
    snapshot = registry.getSnapshot()
    expect(snapshot.grantedIds.has('topo')).toBe(true)
    releases.forEach((release) => release())
    releaseTopo()
    expect(registry.getSnapshot().granted.map((loop) => loop.id)).toEqual(['secure'])
  })

  it('notifies subscribers and keeps the snapshot stable between changes', () => {
    const registry = createAmbientRegistry()
    let calls = 0
    const unsubscribe = registry.subscribe(() => {
      calls += 1
    })
    const first = registry.getSnapshot()
    expect(registry.getSnapshot()).toBe(first)
    const release = registry.acquire('a', { label: 'a' })
    release()
    release() // a second release is a no-op
    expect(calls).toBe(2)
    unsubscribe()
  })
})

function Loop({ label, priority }: { label: string; priority?: 'page' | 'shell' }) {
  const loop = useAmbientLoop(label, { priority })
  return <span data-testid={`loop-${label}`} {...loop.attrs} />
}

function Count() {
  const snapshot = useAmbientSnapshot()
  return <span data-testid="count">{`${snapshot.slotsGranted}/${snapshot.slotsRequested}`}</span>
}

function renderLoops(labels: string[], props: { search?: string; reduced?: boolean } = {}) {
  return render(
    <MotionPolicyProvider
      search={props.search ?? ''}
      storage={memoryStorage()}
      matchMedia={fakeMatchMedia(props.reduced ?? false).matchMedia}
    >
      {labels.map((label) => (
        <Loop key={label} label={label} priority={label.startsWith('shell') ? 'shell' : 'page'} />
      ))}
      <Count />
    </MotionPolicyProvider>,
  )
}

describe('useAmbientLoop', () => {
  it('runs loops under full motion and caps the viewport at 4', () => {
    renderLoops(['shell-topo', 'ring-rotate', 'ring-breathe', 'ken-burns', 'particles'])
    expect(screen.getByTestId('count')).toHaveTextContent('4/5')
    for (const label of ['ring-rotate', 'ring-breathe', 'ken-burns', 'particles']) {
      expect(screen.getByTestId(`loop-${label}`)).toHaveAttribute('data-ambient', 'running')
      expect(screen.getByTestId(`loop-${label}`)).toHaveAttribute('data-motion', 'full')
    }
    expect(screen.getByTestId('loop-shell-topo')).toHaveAttribute('data-ambient', 'paused')
  })

  it('keeps every loop static and marked data-motion="reduced" under reduced motion (AC-70)', () => {
    renderLoops(['ring-rotate', 'ken-burns', 'shell-topo'], { reduced: true })
    expect(screen.getByTestId('count')).toHaveTextContent('0/0')
    for (const label of ['ring-rotate', 'ken-burns', 'shell-topo']) {
      expect(screen.getByTestId(`loop-${label}`)).toHaveAttribute('data-motion', 'reduced')
      expect(screen.getByTestId(`loop-${label}`)).toHaveAttribute('data-ambient', 'paused')
    }
  })

  it('pauses every loop with the ?motion=off test switch (D43)', () => {
    renderLoops(['ring-rotate', 'particles'], { search: '?motion=off' })
    expect(screen.getByTestId('count')).toHaveTextContent('0/0')
    expect(screen.getByTestId('loop-particles')).toHaveAttribute('data-ambient', 'paused')
  })

  it('pauses while the tab is hidden and resumes when it is visible again (R10)', () => {
    renderLoops(['ring-rotate'])
    expect(screen.getByTestId('loop-ring-rotate')).toHaveAttribute('data-ambient', 'running')
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(screen.getByTestId('loop-ring-rotate')).toHaveAttribute('data-ambient', 'paused')
      expect(screen.getByTestId('count')).toHaveTextContent('0/0')

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(screen.getByTestId('loop-ring-rotate')).toHaveAttribute('data-ambient', 'running')
    } finally {
      delete (document as unknown as Record<string, unknown>).hidden
      if (hidden) Object.defineProperty(Document.prototype, 'hidden', hidden)
    }
  })
})
