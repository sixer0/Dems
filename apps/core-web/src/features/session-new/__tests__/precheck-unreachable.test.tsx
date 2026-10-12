// Task 3 R-10, blueprint row 137: the pre-check row of a source that did not answer (web, WB-03)
// (`masterplan/08_client_ux_spec.md` §8e.2 situation B, §8g.3; decisions D83, D114).
//
// | Check | Where |
// |-------|-------|
// | D114: an `UNREACHABLE` item is drawn from `params.rule` — the device by label and id, the count of the one search — never as "lens fault" or "no signal" | "one camera" |
// | M4-NODEV-B-W (component half): one camera unreachable is a warning row; the blocked alert lists the device when both rules block | "one camera", "the active microphone" |
// | M4-MIC-ACTIVE-W (component half): the active microphone unreachable is BLOCK with the cancel → Devices → start again sentence; NO control at pre-check switches a microphone (D83) | "the active microphone" |
// | ux §8e.3: without CAPTURE_CONFIG "Search again" is drawn disabled with the role sentence | "the active microphone" |
import { cleanup, render, screen, within, configure } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, describe, expect, it, vi, afterAll } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, SimProvider, type PrecheckItem, type Sim, type SimAlert } from '@dems/shared/sim'
import { i18n, getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { MotionPolicyProvider } from '@/motion'
import { DevicesStep } from '../devices-step'
import type { GateView } from '../model'
import { gateView, reasonKeyFor } from '../model'

describe("the pre-check row of a source that did not answer (D114)", () => {
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
  const unreachable = (id: PrecheckItem['id'], status: 'WARN' | 'BLOCK', params: Record<string, string>): PrecheckItem =>
    ({ id, status, value: 'UNREACHABLE', reason: 'core text', reasonCode: null, params }) as PrecheckItem

  function mountStep(operatorId: string, items: PrecheckItem[], gate: GateView, alerts: SimAlert[] = []) {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId, issuedAt: Date.now() })
    const sim = createSim({ scenario: 'recording', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const state = sim.store.getState()
    sim.store.setState({ session: { ...state.session!, precheck: { ...state.session!.precheck, items } }, alerts: [...state.alerts, ...alerts] })
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
    return sim
  }

  const OTHERS: PrecheckItem[] = [pass('CORE'), pass('LENS_1'), pass('STORAGE'), pass('TIME'), pass('SECURITY')]

  describe('the pre-check row of a source that did not answer (D114; ux §8g.3)', () => {
    it('one camera: a warning row from params.rule with the device named and the count of the one search — not "lens fault"', () => {
      const alert: SimAlert = {
        id: 'ALR-9',
        at: 1,
        severity: 'WARNING',
        kind: 'SYSTEM',
        message: 'core text',
        active: true,
        acknowledged: false,
        resolvedAt: null,
        target: 'CAM-02',
        params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchResponderCount: 1 },
      }
      resetMissingI18nKeys()
      mountStep(
        OPERATOR_IDS.ANDI,
        [...OTHERS, unreachable('LENS_2', 'WARN', { deviceId: 'CAM-02', deviceKind: 'CAMERA', rule: 'oneCamera' }), pass('MIC_PRIMARY'), pass('MIC_STANDBY')],
        { phase: 'warn', done: 8, total: 8, warnings: 1, needsAck: true, canRetry: true } as GateView,
        [alert],
      )
      const row = screen.getByTestId('sn-check-LENS_2')
      expect(row).toHaveAttribute('data-status', 'WARN')
      expect(row).toHaveAttribute('data-rule', 'oneCamera')
      expect(row).toHaveTextContent('Camera 2 (CAM-02) is not reachable. The session will record one camera only. It did not answer the pre-check. A search found 1 camera.')
      expect(row.textContent ?? '').not.toMatch(/lens fault|no signal|core text/i)
      // Fix wave Q (CW-03): the row asked the tree for `common.enums.lensState.UNREACHABLE` - a key that does not exist
      // (one "missing i18n key" warning in the console of lane 2) - although the row draws its sentence, not the value.
      // The value is worded through the one map (`lib/event-words.ts`, which asks the tree first): no key is recorded as
      // missing, and the raw value is nowhere on the row.
      expect(row.textContent ?? '').not.toContain('UNREACHABLE')
      expect(getMissingI18nKeys()).toEqual([])
      // "Search again" for cameras stands beside the pre-check's own Retry; none for microphones here.
      expect(within(screen.getByTestId('precheck-search-camera')).getByRole('button')).toHaveTextContent(en.common.captureSearch.again)
      expect(screen.queryByTestId('precheck-search-microphone')).not.toBeInTheDocument()
      expect(screen.getByTestId('sn-retry')).toBeInTheDocument()
    })

    it('the active microphone: BLOCK with the cancel → Devices → start again sentence, in the blocked alert too; nothing here switches a microphone', () => {
      mountStep(
        OPERATOR_IDS.BUDI,
        [...OTHERS, pass('LENS_2'), unreachable('MIC_PRIMARY', 'BLOCK', { deviceId: 'MIC-01', deviceKind: 'MIC', rule: 'activeMicrophone', other: 'MIC-02' }), pass('MIC_STANDBY')],
        { phase: 'block', done: 8, total: 8, warnings: 0, needsAck: false, canRetry: true } as GateView,
      )
      const sentence = 'MIC 1 (MIC-01) is the active microphone and is not reachable. Cancel this session, make MIC 2 (MIC-02) the primary microphone on Devices, then start again.'
      expect(screen.getByTestId('sn-check-MIC_PRIMARY')).toHaveAttribute('data-status', 'BLOCK')
      expect(screen.getByTestId('sn-check-MIC_PRIMARY')).toHaveTextContent(sentence)
      expect(screen.getByTestId('sn-gate-blocked')).toHaveTextContent(sentence)
      // D83: no toggle, no "make primary", no "use the other microphone" at pre-check.
      const step = screen.getByTestId('sn-step-devices')
      expect(step.querySelector('[role="switch"]')).toBeNull()
      expect(step.textContent ?? '').not.toMatch(/make primary|use (the )?other|switch to/i)
      expect(within(step).getAllByRole('button').map((button) => button.textContent)).toEqual([en.common.captureSearch.again, en.sessionNew.devices.retry])
      // ux §8e.3: the INVESTIGATOR starts sessions and holds no CAPTURE_CONFIG — the control is there, disabled, with the role sentence.
      const again = within(screen.getByTestId('precheck-search-microphone')).getByRole('button')
      expect(again).toBeDisabled()
      expect(screen.getByTestId('precheck-search-microphone')).toHaveTextContent(en.common.rbac.requiresRole.replace('{{role}}', 'SUPERVISOR or TECHNICIAN'))
      expect(screen.queryByTestId('precheck-search-camera')).not.toBeInTheDocument()
    })
  })
})

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
describe("the pre-check TIME note of a Core in its own capture", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

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
})
