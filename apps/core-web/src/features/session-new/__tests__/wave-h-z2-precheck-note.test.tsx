// Fix wave H, closing pass Z2 - the pre-check TIME item of a Core in its own capture (closing pass
// Z1's request line of 10:30:00Z; ruling D203 (1)). It is a NOTE: `status: WARN`, `value:
// HOST_SYSTEM_CLOCK`, `reasonCode: null`, `params: { rule: 'TIME_HOST_CLOCK', source: 'RTC' }`; the
// run's outcome stays PASS and nothing is to be acknowledged (`isPrecheckNote`, `@dems/shared/sim`).
//
// | Rule | Case |
// |------|------|
// | The row says the host system clock - never the RTC FALLBACK sentence ("GNSS and NTP unavailable"), never a raw code, never "GNSS" as a state | "the row" |
// | The chip is a note, not a warning | "the row" |
// | The note is not counted with the warnings, and has no reason of the fallback table | "the rules" |
// | CONTROL: a real RTC fallback of the simulation (no rule) stays a warning with its sentence | both |
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, SimProvider, type PrecheckItem, type Sim } from '@dems/shared/sim'
import { getMissingI18nKeys, i18n, resetMissingI18nKeys } from '@/i18n'
import { MotionPolicyProvider } from '@/motion'
import { DevicesStep } from '../devices-step'
import { gateView, reasonKeyFor, type GateView } from '../model'

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

const pass = (id: PrecheckItem['id']): PrecheckItem => ({ id, status: 'PASS', value: null, reason: null, reasonCode: null, params: {} }) as PrecheckItem
const NOTE = { id: 'TIME', status: 'WARN', value: 'HOST_SYSTEM_CLOCK', reason: 'Time source: host system clock (no GNSS)', reasonCode: null, params: { rule: 'TIME_HOST_CLOCK', source: 'RTC' } } as unknown as PrecheckItem
const FALLBACK = { id: 'TIME', status: 'WARN', value: 'RTC', reason: 'core text', reasonCode: 'TIME_RTC', params: {} } as unknown as PrecheckItem
const itemsWith = (time: PrecheckItem): PrecheckItem[] => [pass('CORE'), pass('LENS_1'), pass('LENS_2'), pass('MIC_PRIMARY'), pass('MIC_STANDBY'), pass('STORAGE'), time, pass('SECURITY')]

function mountStep(items: PrecheckItem[], gate: GateView) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
  const sim = createSim({ scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const state = sim.store.getState()
  sim.store.setState({ session: { ...state.session!, precheck: { ...state.session!.precheck, items } } })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SimProvider sim={sim} autoStart={false}>
        <I18nextProvider i18n={i18n}>
          <MotionPolicyProvider>
            <DevicesStep gate={gate} acknowledged={false} onAcknowledgedChange={vi.fn()} onRetry={vi.fn()} />
          </MotionPolicyProvider>
        </I18nextProvider>
      </SimProvider>
    </QueryClientProvider>,
  )
}

describe('the pre-check TIME note of a Core in its own capture', () => {
  it('the row: the host system clock as a note - not the RTC fallback sentence, not a warning chip, no raw code', () => {
    resetMissingI18nKeys()
    const items = itemsWith(NOTE)
    mountStep(items, gateView({ items, outcome: 'PASS', warningsAcknowledged: false }, 'ARMED', false))
    const row = screen.getByTestId('sn-check-TIME')
    expect(row).toHaveAttribute('data-note', 'true')
    expect(row).toHaveTextContent(en.sessionNew.precheckNote.timeHostClock)
    expect(row).not.toHaveTextContent(en.sessionNew.devices.reasons.timeRtc)
    expect(row).not.toHaveTextContent('HOST_SYSTEM_CLOCK')
    expect(row).not.toHaveTextContent(en.common.precheckStatus.WARN)
    expect(row).toHaveTextContent(en.sessionNew.precheckNote.chip)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('CONTROL - an RTC fallback of the simulation stays a warning with its sentence', () => {
    const items = itemsWith(FALLBACK)
    mountStep(items, gateView({ items, outcome: 'WARN', warningsAcknowledged: false }, 'PRECHECK', false))
    const row = screen.getByTestId('sn-check-TIME')
    expect(row).not.toHaveAttribute('data-note')
    expect(row).toHaveTextContent(en.sessionNew.devices.reasons.timeRtc)
    expect(row).toHaveTextContent(en.common.precheckStatus.WARN)
  })

  it('the rules (pure): a note is no warning to count and has no reason of the fallback table', () => {
    expect(reasonKeyFor(NOTE)).toBeNull()
    expect(reasonKeyFor(FALLBACK)).toBe('timeRtc')
    const withNote = itemsWith(NOTE)
    expect(gateView({ items: withNote, outcome: 'PASS', warningsAcknowledged: false }, 'ARMED', false)).toMatchObject({ phase: 'pass', warnings: 0, needsAck: false, canProceed: true })
    const withFallback = itemsWith(FALLBACK)
    expect(gateView({ items: withFallback, outcome: 'WARN', warningsAcknowledged: false }, 'PRECHECK', false)).toMatchObject({ phase: 'warn', warnings: 1, needsAck: true })
  })
})
