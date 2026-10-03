// Step 36 acceptance: the policy returns reduced variants under prefers-reduced-motion, and 10x
// durations under ?motion=slow on any route (03_motion_spec §8, §12; 01_specs §4.5).
import { act, cleanup, render } from '@testing-library/react'
import { useContext, useLayoutEffect } from 'react'
import { motion, MotionConfigContext } from 'motion/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { motion as tokens } from '@dems/shared/tokens'
import { MotionPolicyProvider } from '../motion-policy-provider'
import {
  parseDebugQuery,
  parseMotionQuery,
  REDUCED_MOTION_MEDIA_QUERY,
  REDUCED_MOTION_STORAGE_KEY,
  resolveMotionPolicy,
} from '../policy'
import { useMotionPolicy } from '../use-motion-policy'
import { asTransition, fakeMatchMedia, memoryStorage, renderPolicy, resolveTarget } from './helpers'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const FAST_S = tokens.duration.fast / 1000

describe('policy resolution (pure)', () => {
  it('reads ?motion=slow and ?motion=off from any route, and ?debug=1', () => {
    for (const url of [
      '?motion=slow',
      '/dashboard?motion=slow',
      '/evidence/EV-2026-0001?tab=integrity&motion=slow',
      'http://127.0.0.1:5173/developer/api?motion=SLOW#ops',
    ]) {
      expect(parseMotionQuery(url)).toBe('slow')
    }
    expect(parseMotionQuery('/session?motion=off')).toBe('off')
    expect(parseMotionQuery('?motion=reduced')).toBe('off')
    expect(parseMotionQuery('/session')).toBeNull()
    expect(parseMotionQuery('?motion=fast')).toBeNull()
    expect(parseDebugQuery('/session?debug=1')).toBe(true)
    expect(parseDebugQuery('/session?debug=0')).toBe(false)
  })

  it('is reduced when the OS, the in-app override or ?motion=off asks; slow only via ?motion=slow', () => {
    const none = { osReduced: false, override: false, query: null } as const
    expect(resolveMotionPolicy(none)).toMatchObject({ policy: 'full', speed: 'normal', timeScale: 1, ambient: true })
    expect(resolveMotionPolicy({ ...none, osReduced: true }).policy).toBe('reduced')
    expect(resolveMotionPolicy({ ...none, override: true }).policy).toBe('reduced')
    expect(resolveMotionPolicy({ ...none, query: 'off' })).toMatchObject({ policy: 'reduced', ambient: false })
    expect(resolveMotionPolicy({ ...none, query: 'slow' })).toMatchObject({
      policy: 'full',
      speed: 'slow',
      timeScale: tokens.proofSlowFactor,
    })
  })
})

describe('useMotionPolicy under prefers-reduced-motion: reduce', () => {
  it('returns the reduced policy and opacity-only variants of at most `fast`, with no stagger', () => {
    const media = fakeMatchMedia(true)
    const { value } = renderPolicy({ matchMedia: media.matchMedia })
    const policy = value()

    expect(media.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_MEDIA_QUERY)
    expect(policy.policy).toBe('reduced')
    expect(policy.reduced).toBe(true)
    expect(policy.sources.osReduced).toBe(true)

    // Enters and exits are opacity only (§8), with no rise, scale or blur.
    expect(policy.variants.panel.hidden).toEqual({ opacity: 0 })
    expect(policy.variants.hero.hidden).toEqual({ opacity: 0 })
    expect(policy.variants.rackFocus.hidden).toEqual({ opacity: 0 })
    expect(policy.variants.step.enter).toEqual({ opacity: 0 })
    expect(resolveTarget(policy.variants.route.hidden, -1)).toEqual({ opacity: 0 })
    // `visible` animates opacity; any other key only pins the resting value, so nothing travels,
    // scales or blurs (and a live policy switch cannot move a settled element).
    const resting: Record<string, unknown> = { x: 0, y: 0, scale: 1, filter: 'blur(0px)' }
    for (const name of ['panel', 'hero', 'row', 'fade', 'rackFocus', 'mediaIn', 'route', 'stamp'] as const) {
      const { hidden, visible } = policy.variants[name]
      expect(resolveTarget(hidden)).toEqual({ opacity: 0 })
      const target = resolveTarget(visible)
      expect(target.opacity).toBe(1)
      for (const [key, value] of Object.entries(target)) {
        if (key !== 'opacity' && key !== 'transition') expect(value, `${name}.${key}`).toEqual(resting[key])
      }
      expect(asTransition(target.transition).duration).toBeLessThanOrEqual(FAST_S)
    }
    // No stagger, no flights, no loops, no flashes (§8).
    expect(asTransition(resolveTarget(policy.variants.container.visible).transition).delayChildren).toBeUndefined()
    expect(policy.transitions.layout).toEqual({ duration: 0 })
    expect(policy.flags).toMatchObject({
      ambient: false,
      stagger: false,
      sharedLayout: false,
      blur: false,
      animateNumbers: false,
      flashes: false,
      chartAnimation: false,
      meterSpring: null,
      meterMaxHz: 10,
    })
    expect(policy.ambient).toBe(false)
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })

  it('also reads the real window.matchMedia when no seam is passed', () => {
    const media = fakeMatchMedia(true)
    vi.stubGlobal('matchMedia', media.matchMedia)
    const seen: { policy?: string } = {}
    const record = (policy: string) => {
      seen.policy = policy
    }
    function Probe() {
      const { policy } = useMotionPolicy()
      useLayoutEffect(() => record(policy))
      return null
    }
    render(
      <MotionPolicyProvider search="" storage={memoryStorage()}>
        <Probe />
      </MotionPolicyProvider>,
    )
    expect(seen.policy).toBe('reduced')
  })

  it('follows a live change of the OS setting without a reload', () => {
    const media = fakeMatchMedia(false)
    const { value } = renderPolicy({ matchMedia: media.matchMedia })
    expect(value().policy).toBe('full')
    act(() => media.set(true))
    expect(value().policy).toBe('reduced')
    expect(document.documentElement.dataset.motion).toBe('reduced')
    act(() => media.set(false))
    expect(value().policy).toBe('full')
  })

  it("tells Motion itself to reduce ('always'), including for the in-app override", () => {
    const seen: { reducedMotion?: string } = {}
    const record = (value: string | undefined) => {
      seen.reducedMotion = value
    }
    function Probe() {
      const { reducedMotion } = useContext(MotionConfigContext)
      useLayoutEffect(() => record(reducedMotion))
      return null
    }
    const storage = memoryStorage({ [REDUCED_MOTION_STORAGE_KEY]: '1' })
    render(
      <MotionPolicyProvider search="" storage={storage} matchMedia={fakeMatchMedia(false).matchMedia}>
        <Probe />
      </MotionPolicyProvider>,
    )
    expect(seen.reducedMotion).toBe('always')
  })

  it('persists the in-app "Reduce motion" switch in localStorage dems.motion.reduced', () => {
    const storage = memoryStorage()
    const { value } = renderPolicy({ storage })
    expect(value().policy).toBe('full')
    act(() => value().setReducedOverride(true))
    expect(value().policy).toBe('reduced')
    expect(value().sources.override).toBe(true)
    expect(storage.getItem(REDUCED_MOTION_STORAGE_KEY)).toBe('1')
    act(() => value().setReducedOverride(false))
    expect(value().policy).toBe('full')
    expect(storage.getItem(REDUCED_MOTION_STORAGE_KEY)).toBeNull()
  })

  it('falls back to the OS setting when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => undefined,
    } as unknown as Storage
    const { value } = renderPolicy({ storage: throwing })
    expect(value().policy).toBe('full')
    act(() => value().setReducedOverride(true))
    expect(value().policy).toBe('reduced') // applies for this page view even though it was not saved
  })

  it('?motion=off (D43 test switch) reduces motion and stops ambient loops', () => {
    const { value } = renderPolicy({ search: '/session?motion=off' })
    expect(value()).toMatchObject({ policy: 'reduced', ambient: false })
    expect(value().sources.query).toBe('off')
  })
})

describe('switching policy on a live page', () => {
  it('leaves settled elements at rest when motion becomes reduced (no jump back to the enter offset)', async () => {
    const media = fakeMatchMedia(false)
    function Panels() {
      const { variants } = useMotionPolicy()
      return (
        <motion.div variants={variants.container} initial="hidden" animate="visible">
          <motion.div data-testid="panel" variants={variants.panel} />
          <motion.div data-testid="row" variants={variants.row} />
          <motion.div data-testid="blur" variants={variants.rackFocus} />
        </motion.div>
      )
    }
    const { getByTestId } = render(
      <MotionPolicyProvider search="" storage={memoryStorage()} matchMedia={media.matchMedia}>
        <Panels />
      </MotionPolicyProvider>,
    )
    const settled = (id: string) => {
      const style = getByTestId(id).style
      return { opacity: style.opacity, transform: style.transform, filter: style.filter }
    }
    await vi.waitFor(() => expect(settled('panel').opacity).toBe('1'))
    const before = { panel: settled('panel'), row: settled('row'), blur: settled('blur') }
    expect(before.panel.transform).toBe('none')

    act(() => media.set(true))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(settled('panel')).toEqual(before.panel)
    expect(settled('row')).toEqual(before.row)
    expect(settled('blur')).toEqual(before.blur)

    act(() => media.set(false))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(settled('panel')).toEqual(before.panel)
  })
})

describe('useMotionPolicy under ?motion=slow (proof mode M-PX-01)', () => {
  it('multiplies every duration, delay and stagger by proofSlowFactor (10) on any route', () => {
    const normal = renderPolicy({ search: '/dashboard' }).value()
    cleanup()
    const slow = renderPolicy({ search: '/evidence/EV-2026-0001?motion=slow' }).value()
    const factor = tokens.proofSlowFactor

    expect(factor).toBe(10)
    expect(slow.speed).toBe('slow')
    expect(slow.timeScale).toBe(10)
    expect(document.documentElement.dataset.motionSpeed).toBe('slow')
    expect(document.documentElement.style.getPropertyValue('--motion-time-scale')).toBe('10')

    // R2 exit: 160 ms → 1.6 s.
    expect(asTransition(normal.transitions.exit).duration).toBeCloseTo(0.16)
    expect(asTransition(slow.transitions.exit).duration).toBeCloseTo(0.16 * factor)
    // Tweens: base 240 ms → 2.4 s.
    expect(asTransition(slow.transitions.crossFade).duration).toBeCloseTo(
      asTransition(normal.transitions.crossFade).duration! * factor,
    )
    // Springs become tweens of slower × 10 = 6.4 s with `luxe` easing (01_specs §4.5).
    expect(asTransition(normal.transitions.enter)).toMatchObject({ type: 'spring', stiffness: 170, damping: 26, mass: 1 })
    expect(asTransition(slow.transitions.enter)).toMatchObject({ type: 'tween', ease: tokens.easing.luxe })
    expect(asTransition(slow.transitions.enter).duration).toBeCloseTo((tokens.duration.slower * factor) / 1000)

    // R1 stagger: 80 ms + 60 ms × i, capped at 8 items → ×10.
    const normalDelay = asTransition(resolveTarget(normal.variants.container.visible).transition).delayChildren
    const slowDelay = asTransition(resolveTarget(slow.variants.container.visible).transition).delayChildren
    if (typeof normalDelay !== 'function' || typeof slowDelay !== 'function') throw new Error('expected dynamic stagger')
    expect(normalDelay(0, 12)).toBeCloseTo(0.08)
    expect(normalDelay(1, 12)).toBeCloseTo(0.14)
    expect(normalDelay(11, 12)).toBeCloseTo(normalDelay(7, 12)) // items after the 8th enter with the 8th
    for (const index of [0, 1, 5, 9]) {
      expect(slowDelay(index, 12)).toBeCloseTo(normalDelay(index, 12) * factor)
    }

    // Helpers for kit props and literal timings.
    expect(slow.seconds(240)).toBeCloseTo(2.4)
    expect(slow.delays.heldBeat).toBeCloseTo(normal.delays.heldBeat * factor)
    expect(asTransition(slow.loop(tokens.ambient.glowBreath)).duration).toBeCloseTo(
      asTransition(normal.loop(tokens.ambient.glowBreath)).duration! * factor,
    )
    // useSpring consumers: same damping ratio, 10x slower (ω scales by 1/10).
    const counter = slow.springOptions('counter')
    const zeta = (s: { stiffness: number; damping: number; mass: number }) => s.damping / (2 * Math.sqrt(s.stiffness * s.mass))
    expect(zeta(counter)).toBeCloseTo(zeta(tokens.spring.counter))
    expect(Math.sqrt(counter.stiffness / counter.mass)).toBeCloseTo(
      Math.sqrt(tokens.spring.counter.stiffness / tokens.spring.counter.mass) / factor,
    )
  })

  it('keeps full motion in proof mode unless something asks for reduced', () => {
    const slow = renderPolicy({ search: '?motion=slow' }).value()
    expect(slow.policy).toBe('full')
    expect(slow.variants.panel.hidden).toEqual({ opacity: 0, y: tokens.distance.rise, scale: tokens.scale.enterFrom })
  })
})

describe('full-motion variants', () => {
  it('follow R1 and R2 from the tokens', () => {
    const { value } = renderPolicy()
    const { variants, transitions } = value()
    expect(variants.panel.hidden).toEqual({ opacity: 0, y: 12, scale: 0.98 })
    expect(resolveTarget(variants.panel.exit)).toMatchObject({ opacity: 0, y: -tokens.distance.exitDrop })
    expect(asTransition(transitions.exit)).toMatchObject({ type: 'tween', ease: tokens.easing.exit })
    expect(variants.hero.hidden).toMatchObject({ y: tokens.distance.riseLg })
    expect(variants.row.hidden).toEqual({ opacity: 0, y: tokens.distance.riseSm })
    // R7 direction: forward enters from below or the right, back from above or the left.
    expect(resolveTarget(variants.route.hidden, 1)).toMatchObject({ y: tokens.distance.rise })
    expect(resolveTarget(variants.route.hidden, -1)).toMatchObject({ y: -tokens.distance.rise })
    expect(resolveTarget(variants.step.enter, 1)).toMatchObject({ x: tokens.distance.riseLg })
    expect(resolveTarget(variants.step.exit, 1)).toMatchObject({ x: -tokens.distance.riseLg })
    expect(variants.stamp.hidden).toMatchObject({ scale: tokens.scale.stampFrom })
    expect(asTransition(transitions.completion)).toMatchObject({ type: 'spring', ...tokens.spring.bouncy })
  })

  it('animate only composite-friendly properties in every policy and speed (§9.2, MS-01, MS-02)', () => {
    const allowed = new Set(['opacity', 'x', 'y', 'scale', 'filter', 'transition'])
    const blurAllowed = new Set(['rackFocus', 'mediaIn'])
    for (const search of ['', '?motion=slow', '?motion=off']) {
      const { variants, interactions } = renderPolicy({ search }).value()
      for (const [name, set] of Object.entries(variants)) {
        for (const state of Object.values(set)) {
          for (const custom of [1, -1]) {
            const target = resolveTarget(state, custom)
            for (const key of Object.keys(target)) {
              expect(allowed.has(key), `${name}.${key} (${search || 'normal'})`).toBe(true)
              if (key === 'filter') expect(blurAllowed.has(name)).toBe(true)
            }
          }
        }
      }
      for (const interaction of Object.values(interactions)) {
        for (const target of Object.values(interaction)) {
          for (const key of Object.keys(target as object)) expect(['y', 'scale', 'transition']).toContain(key)
        }
      }
      cleanup()
    }
  })
})
