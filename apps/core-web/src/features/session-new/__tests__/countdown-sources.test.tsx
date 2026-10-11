/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Fix wave H, closing pass Z2 (driver D's note 124, section 4 item 3; decision D206): the notice rule
// of Session New fails closed while the capture sources are not known (G70-08) - but a Start that
// passed the rule ran its 3-2-1 countdown and then sent the start WHATEVER had happened to that
// knowledge in between (the link down, the device list being read again).
//
// The rule: THE START IS SENT ONLY IF THE SOURCES ARE STILL KNOWN. Knowledge lost during the
// countdown ends the countdown in the "Checking the capture sources…" state, nothing is sent, and
// the operator presses Start again (which asks the rule again).
// CONTROL: a countdown during which nothing is lost sends exactly one start.
import { act, cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { clearToasts, CORE_START_MS, coreWithSession, isDisabled, mountSessionNew, sessionOps, settleAll, stubMediaForJsdom, type MountedSessionNew } from './live-session-new-bed'
import { COUNTDOWN_FROM, COUNTDOWN_STEP_MS } from '../model'
import { CORE_QUERY_KEYS } from '@/runtime'
import { pageTimersFake, pageTimersReal, pass, until } from '@/runtime/testing/fake-time'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const C = en.devices.sourcesCheck
const COUNTDOWN_MS = COUNTDOWN_FROM * COUNTDOWN_STEP_MS
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

let live: MountedSessionNew | undefined
const step = () => screen.getByTestId('page-session-new').getAttribute('data-step')
const starts = () => live!.bed.fake.log.requestsOf('startSession').length
const reason = () => screen.queryByTestId('local-source-checking')

async function armed() {
  const core = coreWithSession(CORE_START_MS, 'ARMED')
  live = await mountSessionNew({ served: core.state() })
  await waitFor(() => expect(step()).toBe('3'))
  await waitFor(() => expect(isDisabled(screen.getByTestId('sn-start'))).toBe(false))
  core.sim.actions.startRecording()
  live.bed.fake.scriptCommand('startSession', { ops: sessionOps(core), order: 'delta-first' })
  live.bed.fake.answerAllFromExamples()
  return core
}

let restoreMedia: () => void = () => undefined
beforeAll(() => {
  restoreMedia = stubMediaForJsdom()
})
afterAll(() => restoreMedia())
beforeEach(async () => {
  await clearToasts()
})
afterEach(async () => {
  pageTimersReal()
  cleanup()
  await clearToasts()
  live?.bed.dispose()
  live = undefined
  vi.restoreAllMocks()
})

describe('Session New: knowledge of the capture sources lost during the 3-2-1 countdown', () => {
  it('the device list is being read again when the countdown would end: nothing is sent, the countdown is over, the reason is shown; a new press after the answer starts', async () => {
    await armed()
    // The countdown runs on the fake clock from here: armed before the press, so its timer is a fake one.
    pageTimersFake()
    fireEvent.click(screen.getByTestId('sn-start'))
    await until(() => screen.getByTestId('sn-countdown'))
    // One second in: the cache is invalidated (what RESYNCED does) and the new answer is held.
    await pass(COUNTDOWN_STEP_MS)
    expect(screen.getByTestId('sn-countdown')).toBeInTheDocument()
    const held = live!.bed.fake.hold('getCaptureDevices')
    await act(async () => {
      void live!.mounted.queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.captureDevices, exact: true })
    })
    await until(() => expect(reason()).toHaveTextContent(C.checking))
    // The countdown ends with the knowledge, two steps before its own end: no time has to pass for it.
    await until(() => expect(screen.queryByTestId('sn-countdown')).toBeNull(), { rounds: 20 })
    // Past the whole countdown.
    await pass(COUNTDOWN_MS + 500)
    await settleAll(live!.bed)
    expect(starts()).toBe(0)
    expect(screen.queryByTestId('sn-countdown')).toBeNull()
    expect(step()).toBe('3')
    expect(isDisabled(screen.getByTestId('sn-start'))).toBe(true)

    // The answer: the control is back, and nothing fires by itself.
    await act(async () => {
      held.release({ status: 200, body: clone(live!.bed.core.served.captureDevices) })
    })
    await until(() => expect(reason()).toBeNull())
    await pass(COUNTDOWN_MS + 500)
    await settleAll(live!.bed)
    expect(starts()).toBe(0)
    // The operator presses again: the countdown, then exactly one start.
    await until(() => expect(isDisabled(screen.getByTestId('sn-start'))).toBe(false))
    fireEvent.click(screen.getByTestId('sn-start'))
    await until(() => screen.getByTestId('sn-countdown'))
    // Not before the countdown is over …
    await pass(COUNTDOWN_MS - 100)
    await settleAll(live!.bed)
    expect(starts()).toBe(0)
    // … and then exactly one.
    await until(() => expect(starts()).toBe(1), { stepMs: 50, rounds: 40 })
    await pass(COUNTDOWN_MS + 500)
    await settleAll(live!.bed)
    expect(starts()).toBe(1)
  })

  it('the link goes down during the countdown: nothing is sent', async () => {
    await armed()
    pageTimersFake()
    fireEvent.click(screen.getByTestId('sn-start'))
    await until(() => screen.getByTestId('sn-countdown'))
    await pass(COUNTDOWN_STEP_MS)
    expect(screen.getByTestId('sn-countdown')).toBeInTheDocument()
    await act(async () => {
      live!.bed.core.unreachable()
    })
    // The countdown ends with the link, two steps before its own end: no time has to pass for it.
    await until(() => expect(screen.queryByTestId('sn-countdown')).toBeNull(), { rounds: 20 })
    await pass(COUNTDOWN_MS + 500)
    await settleAll(live!.bed)
    expect(starts()).toBe(0)
    expect(screen.queryByTestId('sn-countdown')).toBeNull()
  })

  // The ONE case of the countdown that stays on the system clock (audit 13, W1): the real 3-2-1.
  it('CONTROL - nothing is lost: the countdown ends in exactly one start', async () => {
    await armed()
    fireEvent.click(screen.getByTestId('sn-start'))
    await screen.findByTestId('sn-countdown')
    expect(starts()).toBe(0)
    await waitFor(() => expect(starts()).toBe(1), { timeout: COUNTDOWN_MS + 4_000 })
    await waitFor(() => expect(live!.mounted.router.state.location.pathname).toBe('/session'))
    expect(starts()).toBe(1)
  })
})
