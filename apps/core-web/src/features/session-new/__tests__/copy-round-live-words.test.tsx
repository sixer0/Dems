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
import type { Sim } from '@dems/shared/sim'
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
