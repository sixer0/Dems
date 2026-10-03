// Step 37: the copied-in Magic UI and Motion Primitives items obey the step-36 motion policy
// (03_motion_spec §8 reduced motion, §9.4 ambient cap of 4, R4 held beat) and §9.2 geometry rules.
import { StrictMode, useLayoutEffect, useRef, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MotionPolicyProvider, useAmbientSnapshot, type AmbientSnapshot } from '@/motion'
import { fakeMatchMedia, memoryStorage } from '@/motion/__tests__/helpers'
import { AnimatedBeam } from '../animated-beam'
import { AnimatedListItem } from '../animated-list'
import { AnimatedNumber } from '../animated-number'
import { OrbitingCircles } from '../orbiting-circles'
import { Particles } from '../particles'
import { Ripple } from '../ripple'
import { ShineBorder } from '../shine-border'
import { Spotlight } from '../spotlight'
import { TextScramble } from '../text-scramble'
import { TextShimmer } from '../text-shimmer'

// jsdom has no IntersectionObserver (setup.ts installs a no-op one). Ambient items observe their
// element (R10), so this suite reports every observed element as on screen.
class OnScreenObserver {
  private readonly callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    queueMicrotask(() =>
      this.callback(
        [{ isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry],
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

const g = globalThis as unknown as Record<string, unknown>
const originalObserver = g.IntersectionObserver
const originalGetContext = HTMLCanvasElement.prototype.getContext

beforeAll(() => {
  g.IntersectionObserver = OnScreenObserver
  // jsdom has no canvas; Particles already tolerates a null context.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof originalGetContext
})

afterAll(() => {
  g.IntersectionObserver = originalObserver
  HTMLCanvasElement.prototype.getContext = originalGetContext
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

let latest: AmbientSnapshot | null = null
const record = (snapshot: AmbientSnapshot) => {
  latest = snapshot
}
function SnapshotProbe() {
  const snapshot = useAmbientSnapshot()
  useLayoutEffect(() => record(snapshot))
  return null
}

function withPolicy(children: ReactNode, reduced = false) {
  return (
    <MotionPolicyProvider
      search=""
      matchMedia={fakeMatchMedia(reduced).matchMedia}
      storage={memoryStorage()}
    >
      {children}
      <SnapshotProbe />
    </MotionPolicyProvider>
  )
}

function BeamDiagram({ beams = 1, active = true }: { beams?: number; active?: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const from = useRef<HTMLDivElement>(null)
  const to = useRef<HTMLDivElement>(null)
  return (
    <div ref={container} data-testid="beam-diagram">
      <div ref={from} />
      <div ref={to} />
      {Array.from({ length: beams }, (_, i) => (
        <AnimatedBeam key={i} containerRef={container} fromRef={from} toRef={to} active={active} />
      ))}
    </div>
  )
}

/** Five ambient item types, one slot each by default. */
function AmbientWall({ active = true }: { active?: boolean }) {
  return (
    <>
      <div data-testid="ripple-host">
        <Ripple numCircles={3} active={active} />
      </div>
      <div data-testid="shine-host">
        <ShineBorder duration={8} active={active} />
      </div>
      <div data-testid="orbit-host">
        <OrbitingCircles radius={44} iconSize={16} active={active}>
          <span>A</span>
          <span>B</span>
        </OrbitingCircles>
      </div>
      <BeamDiagram active={active} />
      <div data-testid="particles-host">
        <Particles quantity={4} active={active} />
      </div>
    </>
  )
}

function ambientStates(): string[] {
  return [...document.querySelectorAll('[data-ambient]')].map(
    (element) => element.getAttribute('data-ambient') ?? '',
  )
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('ambient copy-in items (03_motion_spec §9.4, R10)', () => {
  it('register with the step-36 registry and never run more than 4 slots at once', async () => {
    latest = null
    render(withPolicy(<AmbientWall />))
    await flush()

    const snapshot = latest as AmbientSnapshot | null
    expect(snapshot).not.toBeNull()
    expect(snapshot!.slotsRequested).toBe(5)
    expect(snapshot!.slotsGranted).toBe(4)
    expect(new Set(snapshot!.granted.map((loop) => loop.label)).size).toBe(4)
    expect(snapshot!.suppressed.map((loop) => loop.label)).toEqual(['particles'])
    // Registered DOM roots show which loops actually run.
    expect(screen.getByTestId('particles-host').firstElementChild).toHaveAttribute(
      'data-ambient',
      'paused',
    )
    expect(screen.getByTestId('ripple-host').firstElementChild).toHaveAttribute(
      'data-ambient',
      'running',
    )
  })

  it('shares one slot for every beam of a diagram (default loopGroup)', async () => {
    latest = null
    render(withPolicy(<BeamDiagram beams={3} />))
    await flush()
    expect(latest!.slotsRequested).toBe(1)
    expect(latest!.granted).toHaveLength(3)
    expect(ambientStates()).toEqual(['running', 'running', 'running'])
  })

  it('stay static and request no slot under reduced motion (§8 "Off, static final frame")', async () => {
    latest = null
    render(withPolicy(<AmbientWall />, true))
    await flush()
    expect(latest!.slotsRequested).toBe(0)
    const states = ambientStates()
    expect(states.length).toBeGreaterThanOrEqual(5)
    expect(states.every((state) => state === 'paused')).toBe(true)
    for (const element of document.querySelectorAll('[data-ambient]')) {
      expect(element).toHaveAttribute('data-motion', 'reduced')
    }
  })

  it('request no slot while the caller condition is off (`active={false}`)', async () => {
    latest = null
    render(withPolicy(<AmbientWall active={false} />))
    await flush()
    expect(latest!.slotsRequested).toBe(0)
    expect(ambientStates().every((state) => state === 'paused')).toBe(true)
  })

  it('treat an endless TextShimmer as a loop, but not a one-sweep TextShimmer', async () => {
    latest = null
    render(
      withPolicy(
        <>
          <TextShimmer>Session Monitor</TextShimmer>
          <TextShimmer repeat={0}>Once</TextShimmer>
        </>,
      ),
    )
    await flush()
    expect(latest!.granted.map((loop) => loop.label)).toEqual(['text-shimmer'])
    expect(screen.getByText('Once')).not.toHaveAttribute('data-ambient')
  })
})

describe('AnimatedNumber (M-C-02, R4)', () => {
  // Motion paints MotionValue text on its own frame loop (real rAF), so only the held-beat
  // `setTimeout` is faked here.
  const realWait = (ms: number) =>
    act(async () => {
      await new Promise<void>((resolve) => queueMicrotask(resolve))
      await new Promise<void>((resolve) => globalThis.requestAnimationFrame(() => resolve()))
      const started = performance.now()
      while (performance.now() - started < ms) {
        await new Promise<void>((resolve) => globalThis.requestAnimationFrame(() => resolve()))
      }
    })

  it('waits for the 120 ms held beat before ticking from `from`', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(withPolicy(<AnimatedNumber value={42} from={0} />))
    act(() => {
      vi.advanceTimersByTime(119)
    })
    await realWait(100) // a started counter spring would read about 19 by now
    expect(screen.getByText('0')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    vi.useRealTimers()
    expect(await screen.findByText('42', undefined, { timeout: 4000 })).toBeInTheDocument()
  })

  it('jumps straight to the value under reduced motion (no held beat, no spring)', () => {
    render(withPolicy(<AnimatedNumber value={42} from={0} />, true))
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows the final value under reduced motion inside StrictMode too (browser-found bug)', () => {
    const { rerender } = render(
      <StrictMode>{withPolicy(<AnimatedNumber value={1234} from={0} />, true)}</StrictMode>,
    )
    expect(screen.getByText('1,234')).toBeInTheDocument()
    rerender(<StrictMode>{withPolicy(<AnimatedNumber value={1300} from={0} />, true)}</StrictMode>)
    expect(screen.getByText('1,300')).toBeInTheDocument()
  })

  it('applies a custom formatter', () => {
    render(withPolicy(<AnimatedNumber value={3.42} format={(n) => `${n.toFixed(2)} TB`} />))
    expect(screen.getByText('3.42 TB')).toBeInTheDocument()
  })
})

describe('TextScramble (M-C-07, M-C-21)', () => {
  it('scrambles, then resolves to the text and reports completion', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    render(
      withPolicy(
        <TextScramble as="span" characterSet="x" duration={0.2} onScrambleComplete={done}>
          ab12
        </TextScramble>,
      ),
    )
    act(() => {
      vi.advanceTimersByTime(40)
    })
    expect(screen.getByText('xxxx')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.getByText('ab12')).toBeInTheDocument()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('shows the final text at once under reduced motion and still reports completion', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    render(
      withPolicy(
        <TextScramble as="span" characterSet="x" onScrambleComplete={done}>
          ab12
        </TextScramble>,
        true,
      ),
    )
    expect(screen.getByText('ab12')).toBeInTheDocument()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('shows a changed text immediately (upstream fix #182)', () => {
    const { rerender } = render(
      withPolicy(
        <TextScramble as="span" trigger={false}>
          aaaa
        </TextScramble>,
      ),
    )
    rerender(
      withPolicy(
        <TextScramble as="span" trigger={false}>
          bbbb
        </TextScramble>,
      ),
    )
    expect(screen.getByText('bbbb')).toBeInTheDocument()
  })
})

describe('geometry and property rules (§9.2)', () => {
  it('Spotlight moves with transforms and keeps left/top fixed at 0', () => {
    render(
      withPolicy(
        <div data-testid="card">
          <Spotlight size={200} />
        </div>,
      ),
    )
    const light = screen.getByTestId('card').firstElementChild as HTMLElement
    fireEvent.mouseMove(screen.getByTestId('card'), { clientX: 150, clientY: 90 })
    expect(light.style.left).toBe('0px')
    expect(light.style.top).toBe('0px')
    expect(light.className).toContain('from-bronze/12')
  })

  it('OrbitingCircles places each child at its angle on the radius', () => {
    render(
      withPolicy(
        <div data-testid="orbit">
          <OrbitingCircles radius={44} iconSize={16} path={false}>
            <span>A</span>
            <span>B</span>
          </OrbitingCircles>
        </div>,
      ),
    )
    const placed = [...screen.getByTestId('orbit').querySelectorAll<HTMLElement>('[style*="translateY"]')]
    expect(placed.map((element) => element.style.transform)).toEqual([
      'rotate(0deg) translateY(44px) rotate(0deg)',
      'rotate(180deg) translateY(44px) rotate(-180deg)',
    ])
  })

  it('AnimatedListItem renders the newest-row highlight layer only when asked', () => {
    render(
      withPolicy(
        <>
          <AnimatedListItem highlight>
            <span>new</span>
          </AnimatedListItem>
          <AnimatedListItem>
            <span>old</span>
          </AnimatedListItem>
        </>,
      ),
    )
    expect(screen.getByText('new').parentElement!.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByText('old').parentElement!.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})
