/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Closing copy round, decision D186 on W83 ledger #90: the Health line's caption in Live mode is ONE
// sentence for both clients, the shared `devices.live.samples` ("Derived from the Core's data · last N
// samples"): the Core serves no per-device health history, so the line is derived on the client from the
// Core's data. Before, the web said "Last N samples" and the mobile app "Derived on this device from the
// Core's data · …". Simulated mode keeps "Simulated · last N samples".
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { Sim } from '@dems/shared/sim'
import { createTestSim, withProviders } from '@/components/composed/__tests__/test-utils'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'
import { HealthChart } from '../health-chart'

vi.setConfig({ testTimeout: 25_000 })

const LIVE_CAPTION = /^Derived from the Core's data · (?:last \d+ samples|1 sample)$/
const SIMULATED_CAPTION = /^Simulated · (?:last \d+ samples|1 sample)$/
const caption = (root: HTMLElement): string => root.querySelector('.dev-health-source')?.textContent ?? ''

let bed: LiveTestBed | undefined
const sims: Sim[] = []

const originalPlay = HTMLMediaElement.prototype.play
const originalPause = HTMLMediaElement.prototype.pause
const originalGetContext = HTMLCanvasElement.prototype.getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
})
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLMediaElement.prototype.play = originalPlay
  HTMLMediaElement.prototype.pause = originalPause
})

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(() => {
  cleanup()
  bed?.dispose()
  bed = undefined
  for (const sim of sims.splice(0)) sim.stop()
  vi.restoreAllMocks()
})

describe('the Live caption is one shared sentence', () => {
  it('says the line is derived from the Core\'s data, names no device or browser, and nothing about a simulation', () => {
    expect(en.devices.live.samples_other).toBe("Derived from the Core's data · last {{count}} samples")
    expect(en.devices.live.samples_one).toBe("Derived from the Core's data · {{count}} sample")
    for (const text of [en.devices.live.samples_one, en.devices.live.samples_other]) {
      expect([text, /simulat|this device|this browser/i.test(text)]).toEqual([text, false])
    }
    // The control: the Simulated caption is unchanged.
    expect(en.devices.drawer.health.samples_other).toBe('Simulated · last {{count}} samples')
  })
})

describe('Simulated mode keeps its caption', () => {
  it('the Health chart says "Simulated · last N samples"', () => {
    const sim = createTestSim()
    sims.push(sim)
    render(withProviders(<HealthChart deviceId="CAM-01" />, { sim }))
    const health = screen.getByTestId('device-health')
    expect(caption(health)).toMatch(SIMULATED_CAPTION)
    expect(getMissingI18nKeys()).toEqual([])
  })
})

describe('Live mode: the drawer\'s Health tab (real router, real Live source, fake transport)', () => {
  it('Camera 1: "Derived from the Core\'s data · …"; nothing on the tab claims a simulation', async () => {
    const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
    bed = created
    const page = await created.load()
    await created.mount(page, '/devices')
    await screen.findByTestId('page-devices')
    fireEvent.click(await screen.findByRole('button', { name: 'Open details for Camera 1' }))
    const drawer = await screen.findByTestId('device-drawer')
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Health' }))
    const health = await within(drawer).findByTestId('device-health')
    await waitFor(() => expect(caption(health)).toMatch(LIVE_CAPTION))
    expect(health.textContent ?? '').not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })
})
