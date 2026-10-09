// Task 3 R-10, blueprint row 137: the pre-check row of a source that did not answer (web, WB-03)
// (`masterplan/08_client_ux_spec.md` §8e.2 situation B, §8g.3; decisions D83, D114).
//
// | Check | Where |
// |-------|-------|
// | D114: an `UNREACHABLE` item is drawn from `params.rule` — the device by label and id, the count of the one search — never as "lens fault" or "no signal" | "one camera" |
// | M4-NODEV-B-W (component half): one camera unreachable is a warning row; the blocked alert lists the device when both rules block | "one camera", "the active microphone" |
// | M4-MIC-ACTIVE-W (component half): the active microphone unreachable is BLOCK with the cancel → Devices → start again sentence; NO control at pre-check switches a microphone (D83) | "the active microphone" |
// | ux §8e.3: without CAPTURE_CONFIG "Search again" is drawn disabled with the role sentence | "the active microphone" |
import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, SimProvider, type PrecheckItem, type Sim, type SimAlert } from '@dems/shared/sim'
import { i18n } from '@/i18n'
import { MotionPolicyProvider } from '@/motion'
import { DevicesStep } from '../devices-step'
import type { GateView } from '../model'

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
