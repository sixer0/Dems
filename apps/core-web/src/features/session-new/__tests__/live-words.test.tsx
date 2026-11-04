/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Closing copy round (decision D164 DN-5; W83 ledger #89): the web console shows, in Live mode, the
// same two words as the mobile app, from ONE shared pair of keys (`sessionNew.live.*`). Simulated
// mode keeps its words (04_client_integration_spec §3.2).
//
// | Place | Simulated (unchanged) | Live |
// |-------|-----------------------|------|
// | Step 1, the case-number button (label and tooltip) | "Scan case number (simulated)" | "Fill in the next case number" |
// | Step 2, the meters' hint | "Speak to test (simulated)" | "Microphone levels from the Core server" |
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionCreateFormValues } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api'
import { HOST_CLOCK_TIME, type Sim } from '@dems/shared/sim'
import { enWeb } from '@/i18n-web'
import { createTestSim, withProviders } from '@/components/composed/__tests__/test-utils'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { DevicesStep } from '../devices-step'
import { InfoStep } from '../info-step'
import { gateView } from '../model'
import { clearToasts, CORE_START_MS, coreWithSession, mountSessionNew, settleAll, stubMediaForJsdom, type MountedSessionNew } from './live-session-new-bed'

vi.setConfig({ testTimeout: 30_000 })

const SIMULATION = /simulat/i
const LIVE_HINT = en.sessionNew.live.speakToTest
const LIVE_SCAN = en.sessionNew.live.scanCaseNumber
const SIMULATED_HINT = en.sessionNew.devices.speakToTest
const SIMULATED_SCAN = en.sessionNew.info.caseNumber.scan

let live: MountedSessionNew | undefined
const sims: Sim[] = []
let restoreMedia: () => void = () => undefined

beforeAll(() => {
  restoreMedia = stubMediaForJsdom()
})
afterAll(() => restoreMedia())

beforeEach(async () => {
  resetMissingI18nKeys()
  await clearToasts()
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  live?.bed.dispose()
  live = undefined
  for (const sim of sims.splice(0)) sim.stop()
  vi.restoreAllMocks()
})

const FORM: SessionCreateFormValues = {
  caseNumber: '',
  subjectType: undefined as unknown as SessionCreateFormValues['subjectType'],
  subjectName: '',
  investigatorId: '',
  room: '',
  profileId: 'STANDARD_1080P25',
  notes: '',
}

/** The scan button's tooltip, opened as a keyboard user opens it (focus after a Tab: React Aria's focus-visible). */
async function scanTooltip(): Promise<HTMLElement> {
  fireEvent.keyDown(document.body, { key: 'Tab' })
  act(() => screen.getByTestId('sn-scan').focus())
  return screen.findByRole('tooltip')
}

/** Step 1 alone, with the page's form shape; `live` as the page passes it. */
function InfoStepHost({ live }: { live?: boolean }) {
  const form = useForm<SessionCreateFormValues>({ defaultValues: FORM })
  return <InfoStep control={form.control} submitted={false} onSubmit={() => undefined} onScan={() => undefined} enterDelayMs={0} live={live} />
}

describe('the words are one shared pair', () => {
  it('the two Live texts are the mobile app\'s and say nothing about a simulation; the Simulated ones did', () => {
    expect(LIVE_HINT).toBe('Microphone levels from the Core server')
    expect(LIVE_SCAN).toBe('Fill in the next case number')
    for (const text of [LIVE_HINT, LIVE_SCAN]) expect([text, SIMULATION.test(text)]).toEqual([text, false])
    // The control: the Simulated words do say so, and are unchanged.
    expect(SIMULATED_HINT).toBe('Speak to test (simulated)')
    expect(SIMULATED_SCAN).toBe('Scan case number (simulated)')
  })
})

describe('Simulated mode keeps its words (the steps without `live`, as the page renders them in Simulated mode)', () => {
  it('step 1: the case-number button and its tooltip say "Scan case number (simulated)"', async () => {
    const sim = createTestSim()
    sims.push(sim)
    render(withProviders(<InfoStepHost />, { sim }))
    expect(screen.getByTestId('sn-scan')).toHaveAccessibleName(SIMULATED_SCAN)
    expect(await scanTooltip()).toHaveTextContent(SIMULATED_SCAN)
    expect(screen.queryByText(LIVE_SCAN)).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('step 2: the meters\' hint says "Speak to test (simulated)"', () => {
    const sim = createTestSim()
    sims.push(sim)
    render(withProviders(<DevicesStep gate={gateView(null, null, false)} acknowledged={false} onAcknowledgedChange={() => undefined} onRetry={() => undefined} />, { sim }))
    expect(screen.getByText(SIMULATED_HINT)).toBeInTheDocument()
    expect(screen.queryByText(LIVE_HINT)).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })
})

// Fix wave M (G75e-02, final re-check 75): on a Core in its own capture the meters of step 2 read "MIC 1 - Interviewer" /
// "MIC 2 - Subject" - the roles of the simulator's room - and named no primary.
describe('G75e-02: the microphone meters of step 2 are named from the selector in force', () => {
  const step = (sim: Sim) => render(withProviders(<DevicesStep gate={gateView(null, null, false)} acknowledged={false} onAcknowledgedChange={() => undefined} onRetry={() => undefined} live />, { sim }))
  /** A Core in its own capture whose four microphone lines are generated sources; `primary` names the line of the TRANSCRIBED channel 1 (D61 of 2026-11-04: the PRIMARY role became the numbered channel). */
  function ownCore(primary: 'MIC-01' | 'MIC-02'): Sim {
    const sim = createTestSim()
    sims.push(sim)
    const state = sim.store.getState()
    sim.store.setState({
      security: { ...state.security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE },
      time: { ...HOST_CLOCK_TIME },
      // D61: the lines are keyed by CHANNEL - `primary` takes channel 1, the line that held it takes `primary`'s old channel.
      captureConfig: { ...state.captureConfig, mics: state.captureConfig.mics.map((mic) => ({ ...mic, channel: mic.inputId === primary ? 'MIC-01' : mic.channel === 'MIC-01' ? primary : mic.channel })) },
      captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.map((device) => (device.kind === 'MIC' ? { ...device, adapter: 'FAKE', sourceClass: 'DEVELOPMENT' } : device)) },
    } as Partial<ReturnType<typeof sim.store.getState>>)
    return sim
  }
  const W = enWeb.web
  // D61 (2026-11-04): the meter names the CHANNEL - the chip words are the selector's (devices.selector.role).
  const CH1 = en.devices.selector.role.PRIMARY
  const CH2 = en.devices.selector.role.STANDBY

  it('a Core in its own capture: the input, the source on it, its channel and "Generated test source" - no dataset role', () => {
    step(ownCore('MIC-01'))
    const first = screen.getByTestId('sn-meter-AUDIO-01')
    const second = screen.getByTestId('sn-meter-AUDIO-02')
    expect(first).toHaveTextContent(`MIC 1 · MIC-01 · ${CH1} · ${W.waveL.source.generatedMic}`)
    expect(second).toHaveTextContent(`MIC 2 · MIC-02 · ${CH2} · ${W.waveL.source.generatedMic}`)
    expect(first).toHaveAttribute('data-channel', 'MIC-01')
    for (const meter of [first, second]) {
      expect(meter).not.toHaveTextContent('Interviewer')
      expect(meter).not.toHaveTextContent('Subject')
    }
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('with MIC-02 made the transcribed channel the two labels say which line holds channel 1 (D61)', () => {
    step(ownCore('MIC-02'))
    // D61: each meter names the LINE inside its channel - the labels trade with the lines.
    expect(screen.getByTestId('sn-meter-AUDIO-01')).toHaveTextContent(`MIC 2 · MIC-02 · ${CH1}`)
    expect(screen.getByTestId('sn-meter-AUDIO-02')).toHaveTextContent(`MIC 1 · MIC-01 · ${CH2}`)
    expect(screen.getByTestId('sn-meter-AUDIO-01')).toHaveAttribute('data-channel', 'MIC-01')
    expect(screen.getByTestId('sn-meter-AUDIO-02')).toHaveAttribute('data-channel', 'MIC-02')
  })

  it('CONTROL - the simulated lane keeps its track labels', () => {
    const sim = createTestSim()
    sims.push(sim)
    step(sim)
    expect(screen.getByTestId('sn-meter-AUDIO-01')).toHaveTextContent(en.common.tracks['AUDIO-01'])
    expect(screen.getByTestId('sn-meter-AUDIO-02')).toHaveTextContent(en.common.tracks['AUDIO-02'])
    expect(screen.getByTestId('sn-meter-AUDIO-01')).not.toHaveAttribute('data-channel') // D61: the channel mark belongs to a Core in its own capture
    expect(screen.getByTestId('sn-meter-AUDIO-01')).not.toHaveTextContent(W.waveL.source.generatedMic)
  })
})

describe('Live mode: the page says what is true (real router, real Live source, fake transport)', () => {
  it('step 1: the case-number button and its tooltip say "Fill in the next case number"; nothing on the step claims a simulation', async () => {
    live = await mountSessionNew()
    const button = await screen.findByTestId('sn-scan')
    expect(button).toHaveAccessibleName(LIVE_SCAN)
    expect(await scanTooltip()).toHaveTextContent(LIVE_SCAN)
    expect(screen.queryByText(SIMULATED_SCAN)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(SIMULATED_SCAN)).not.toBeInTheDocument()
    await settleAll(live.bed)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('step 2: the meters\' hint says "Microphone levels from the Core server"', async () => {
    const core = coreWithSession(CORE_START_MS, 'WARN')
    live = await mountSessionNew({ served: core.state() })
    await waitFor(() => expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-step', '2'))
    const page = screen.getByTestId('page-session-new')
    expect(within(page).getByText(LIVE_HINT)).toBeInTheDocument()
    expect(within(page).queryByText(SIMULATED_HINT)).not.toBeInTheDocument()
    await settleAll(live.bed)
    expect(getMissingI18nKeys()).toEqual([])
  })
})
