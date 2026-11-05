// W3 row 158 (D5 register N-40; S5 §6; D55 R89-F1; D98): the /session/new devices step reads the
// camera-microphone pairs. Every meter leads with "Mic N (Camera N)" (`devices.pairs.micOfCamera`),
// there are four meters (AUDIO-01..04, step 2 drew only AUDIO-01/02 before), and the camera previews
// stay behind row 130b's ReachGatedCameraPreview (never the bare CameraPreview).
import { cleanup, render, screen, act, configure } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, CAPTURE_PAIRS, createMemoryAuthStorage, createSim, OPERATOR_IDS, SimProvider, type PrecheckItem, type Sim } from '@dems/shared/sim'
import { i18n, getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { MotionPolicyProvider } from '@/motion'
import { DevicesStep } from '../devices-step'
import type { GateView } from '../model'

// D98: the mount is pinned by a module double - a switch back to CameraPreview draws no stub and fails here.
vi.mock('@/features/devices/reach-gated-preview', () => ({
  ReachGatedCameraPreview: ({ cameraId, livePreview }: { cameraId: string; livePreview?: boolean }) => (
    <div data-testid={`reach-gated-${cameraId}`} data-live-preview={livePreview ? 'true' : 'false'} />
  ),
}))

configure({ asyncUtilTimeout: 5000 })

describe('W3 row 158: the devices step reads the camera-microphone pairs', () => {
  const sims: Sim[] = []
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
    HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
    HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
    Element.prototype.getAnimations ??= function getAnimations() {
      return []
    }
  })
  afterEach(() => {
    cleanup()
    for (const sim of sims.splice(0)) sim.stop()
  })

  const pass = (id: PrecheckItem['id']): PrecheckItem => ({ id, status: 'PASS', value: 'READY', reason: null, reasonCode: null, params: {} }) as PrecheckItem
  const ITEMS = (['CORE', 'LENS_1', 'LENS_2', 'LENS_3', 'LENS_4', 'MIC_PRIMARY', 'MIC_STANDBY', 'MIC_3', 'MIC_4', 'STORAGE', 'TIME', 'SECURITY'] as const).map(pass)
  const PASSED = { phase: 'pass', done: 12, total: 12, warnings: 0, needsAck: false, canRetry: false } as GateView
  const pairWords = (n: number) => en.devices.pairs.micOfCamera.replaceAll('{{n}}', String(n))
  // Cycle 2 (D125, R156-2): Pair 1 alone adds "Transcribed", as the selector's Pair 1 row.
  const pairHead = (n: number) => (n === 1 ? `${pairWords(1)} · ${en.devices.pairs.transcribed}` : pairWords(n))
  // Cycle 2 (D125): the old channel chips of the selector role / slot list are no meter words any more.
  const OLD_CHIPS = [en.devices.selector.role.PRIMARY, en.devices.selector.role.STANDBY, en.common.captureSlot['MIC-03'], en.common.captureSlot['MIC-04']]

  function mountStep() {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
    const sim = createSim({ scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const state = sim.store.getState()
    sim.store.setState({ session: { ...state.session!, precheck: { ...state.session!.precheck, items: ITEMS } } })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SimProvider sim={sim} autoStart={false}>
          <I18nextProvider i18n={i18n}>
            <MotionPolicyProvider>
              <DevicesStep gate={PASSED} acknowledged={false} onAcknowledgedChange={vi.fn()} onRetry={vi.fn()} />
            </MotionPolicyProvider>
          </I18nextProvider>
        </SimProvider>
      </QueryClientProvider>,
    )
    return sim
  }

  /** A Core in its own capture with the seeded four lines; no session copy of the selector, so the slice is in force. */
  const ownCore = (sim: Sim, keep: readonly string[] = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) => {
    const state = sim.store.getState()
    sim.store.setState({
      security: { ...state.security, platformNotReported: true } as typeof state.security,
      captureConfig: { ...state.captureConfig, mics: state.captureConfig.mics.filter((mic) => keep.includes(mic.channel)) },
      session: null,
    })
  }

  const meters = () => Array.from(document.querySelectorAll<HTMLElement>('.sn-meters > [data-testid^="sn-meter-"]'))

  it('the simulated lane: four meters AUDIO-01..04 in pair order, each led by "Mic N (Camera N)", the track words kept', () => {
    resetMissingI18nKeys()
    mountStep()
    expect(meters().map((meter) => meter.dataset.testid)).toEqual(['sn-meter-AUDIO-01', 'sn-meter-AUDIO-02', 'sn-meter-AUDIO-03', 'sn-meter-AUDIO-04'])
    for (const pair of CAPTURE_PAIRS) {
      const meter = screen.getByTestId(`sn-meter-${pair.audioTrackId}`)
      expect(meter).toHaveAttribute('data-pair', String(pair.pair))
      const label = meter.querySelector('.sn-meter-label')
      expect(label?.textContent).toBe(`${pairHead(pair.pair)} · ${en.common.tracks[pair.audioTrackId]}`)
    }
    expect(screen.getByTestId('sn-meter-AUDIO-03')).toHaveTextContent('Mic 3 (Camera 3)')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a Core in its own capture: channels 3 and 4 have their meters and name their lines after the pair', () => {
    resetMissingI18nKeys()
    const sim = mountStep()
    act(() => ownCore(sim))
    expect(meters()).toHaveLength(4)
    for (const pair of CAPTURE_PAIRS) {
      const meter = screen.getByTestId(`sn-meter-${pair.audioTrackId}`)
      expect(meter).toHaveAttribute('data-pair', String(pair.pair))
      expect(meter).toHaveAttribute('data-channel', pair.micChannel)
      expect(meter.querySelector('.sn-meter-label')?.textContent?.startsWith(`${pairHead(pair.pair)} · `)).toBe(true)
      expect(meter).toHaveTextContent(pair.micChannel)
      for (const chip of OLD_CHIPS) expect(meter).not.toHaveTextContent(chip)
      if (pair.pair !== 1) expect(meter).not.toHaveTextContent(en.devices.pairs.transcribed)
    }
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a channel with no line keeps its pair words and reads "Not assigned"', () => {
    const sim = mountStep()
    act(() => ownCore(sim, ['MIC-01', 'MIC-02']))
    for (const n of [3, 4] as const) {
      const meter = screen.getByTestId(`sn-meter-AUDIO-0${n}`)
      expect(meter).not.toHaveAttribute('data-input')
      expect(meter.querySelector('.sn-meter-label')?.textContent).toBe(`${pairWords(n)} · ${en.common.captureSlot.notAssigned}`)
    }
  })

  it('D98: the four camera previews are still ReachGatedCameraPreview mounts with the live picture asked for', () => {
    mountStep()
    for (const pair of CAPTURE_PAIRS) {
      expect(screen.getByTestId(`reach-gated-${pair.videoTrackId}`)).toHaveAttribute('data-live-preview', 'true')
    }
  })
})
