/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Wave H, driver D (gate 70, finding G70-08; ruling D196: "the notice rule FAILS CLOSED while the
// device list is unknown"). The notice before a local device is opened is a client rule, so the
// console must not let a pre-check or a start out while it does not KNOW the selector's device
// classes. Real router, real Live source, the contract-checked fake transport; the "local" device
// is a fixture state that SAYS `adapter: LOCAL_DEVICE`: nothing is opened, no real Core is called.
//
// | State of the device list (operation 77) | What the page does | Test |
// |---|---|---|
// | not answered yet | Next disabled, "Checking the capture sources…"; a form submit around the button sends nothing; once answered with a local device, the notice as built | "held" |
// | failed | Next disabled with the failed sentence and a Retry; nothing is sent; after a good read the control is back | "error" |
// | the link is down (what "stale" the console can detect, part 1) | disabled with the reason; nothing is sent | "link down" |
// | a refetch is out after the cache was invalidated - what the query bridge does on RESYNCED (part 2) | disabled until the answer | "refetch" |
// | answered, no local device | as before: no reason line, Next enabled, create then pre-check, no notice | "known" |
// | a session left in CREATE (a reload) while the list is not answered | NO `beginPrecheck` by itself; with the answer (no local device) exactly one | "resume" |
import { act, cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SimState } from '@dems/shared/sim'
import {
  clearToasts,
  CORE_START_MS,
  coreWithSession,
  createCoreDriver,
  fillForm,
  FORM_INPUT,
  isDisabled,
  mountSessionNew,
  sessionOps,
  settleAll,
  stubMediaForJsdom,
  type MountedSessionNew,
} from '@/features/session-new/__tests__/live-session-new-bed'
import { CREATE_BEAT_MS } from '@/features/session-new/model'
import { CORE_QUERY_KEYS } from '@/runtime'
import { captureSourcesKnowledge, localGuardDecision } from '../local-source-gate'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const C = en.devices.sourcesCheck
const N = en.common.localSourceNotice
type Device = SimState['captureDevices']['devices'][number]

/** The registry with a third camera of `adapter`; VIDEO-01 names it. */
function thirdCamera(state: SimState, adapter: 'LOCAL_DEVICE' | 'FAKE'): { devices: Device[]; config: SimState['captureConfig'] } {
  const camera = state.captureDevices.devices.find((device) => device.kind === 'CAMERA')!
  return {
    // D60 (2026-11-04): CAM-03/CAM-04 are built-ins; the added third camera is minted above them.
    devices: [...state.captureDevices.devices, { ...camera, id: 'CAM-05', adapter, sourceClass: 'DEVELOPMENT' } as Device],
    config: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-05' } : line)) },
  }
}

/**
 * A Core whose selector names CAM-05 while the console's replica holds NO registry (the value a
 * Live client holds before the Core's device list reached it: `captureDevices: { devices: [] }`).
 * The list itself is what operation 77 answers - which the test holds, fails or releases.
 */
function replicaWithoutRegistry(state: SimState, adapter: 'LOCAL_DEVICE' | 'FAKE'): { served: SimState; devices: Device[] } {
  const { devices, config } = thirdCamera(state, adapter)
  return { served: { ...state, captureConfig: config, captureDevices: { devices: [] } }, devices }
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

let live: MountedSessionNew | undefined
const next = () => screen.getByTestId('sn-next')
const reason = () => screen.queryByTestId('local-source-checking')
const sent = () => live!.bed.fake.log.operationIds().filter((id) => id === 'createSession' || id === 'beginPrecheck' || id === 'retryPrecheck' || id === 'startSession')
const submitAroundTheButton = () => fireEvent.submit(document.getElementById('sn-info-form')!)
async function quiet() {
  await new Promise((resolve) => setTimeout(resolve, CREATE_BEAT_MS + 100))
  await settleAll(live!.bed)
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
  cleanup()
  await clearToasts()
  live?.bed.dispose()
  live = undefined
  vi.restoreAllMocks()
})

describe('G70-08 the rule itself (pure)', () => {
  it('known only in Simulated mode, or in Live mode with the link up and both reads answered, not failed and not being read again', () => {
    const ok = { answered: true, failed: false, fetching: false }
    expect(captureSourcesKnowledge({ live: false, open: false, reads: [] })).toBe('KNOWN')
    expect(captureSourcesKnowledge({ live: true, open: true, reads: [ok, ok] })).toBe('KNOWN')
    // Negative controls: each single unknown closes the rule.
    expect(captureSourcesKnowledge({ live: true, open: false, reads: [ok, ok] })).toBe('CHECKING')
    expect(captureSourcesKnowledge({ live: true, open: true, reads: [ok, { ...ok, answered: false }] })).toBe('CHECKING')
    expect(captureSourcesKnowledge({ live: true, open: true, reads: [ok, { ...ok, fetching: true }] })).toBe('CHECKING')
    expect(captureSourcesKnowledge({ live: true, open: true, reads: [{ ...ok, failed: true }, ok] })).toBe('FAILED')
    // A read that is being asked again is being checked, whatever it held before.
    expect(captureSourcesKnowledge({ live: true, open: true, reads: [ok, { answered: true, failed: true, fetching: true }] })).toBe('CHECKING')
  })

  it('the guard refuses while the classes are unknown, asks when a local device is named, and runs otherwise', () => {
    expect(localGuardDecision({ known: false, local: false })).toBe('REFUSE')
    expect(localGuardDecision({ known: false, local: true })).toBe('REFUSE')
    expect(localGuardDecision({ known: true, local: true })).toBe('ASK')
    expect(localGuardDecision({ known: true, local: false })).toBe('RUN')
  })
})

describe('G70-08 Session New while the device list is not known', () => {
  it('held: Next is disabled with "Checking the capture sources…", a submit around the button sends nothing; the answer names a local device and the notice comes as built', async () => {
    const idle = createCoreDriver(CORE_START_MS)
    const { served, devices } = replicaWithoutRegistry(idle.state(), 'LOCAL_DEVICE')
    let held: ReturnType<MountedSessionNew['bed']['fake']['hold']> | undefined
    live = await mountSessionNew({ served, prepare: (bed) => (held = bed.fake.hold('getCaptureDevices')) })
    fillForm()
    await quiet()
    expect(held!.call).not.toBeNull()
    expect(reason()).toHaveTextContent(C.checking)
    expect(reason()).toHaveAttribute('data-knowledge', 'CHECKING')
    expect(isDisabled(next())).toBe(true)
    expect(next()).toHaveAttribute('aria-describedby', reason()!.id)
    // Defence in depth: the form's own submit (Enter in a field) does not pass the disabled button.
    fireEvent.click(next())
    submitAroundTheButton()
    await quiet()
    expect(sent()).toEqual([])
    expect(screen.queryByTestId('local-source-notice')).toBeNull()

    await act(async () => {
      held!.release({ status: 200, body: clone({ devices }) })
    })
    await waitFor(() => expect(reason()).toBeNull())
    await waitFor(() => expect(isDisabled(next())).toBe(false))
    fireEvent.click(next())
    await screen.findByTestId('local-source-notice')
    // D60 (2026-11-04): the added local camera is CAM-05 — CAM-03/04 are built-ins.
    expect(screen.getByTestId('local-source-notice-devices')).toHaveTextContent(N.web.camera.replace('{{camera}}', 'CAM-05'))
    await quiet()
    expect(sent()).toEqual([])
  })

  it('error: the failed sentence with a Retry, Next disabled, nothing sent; a good read brings the control back', async () => {
    const idle = createCoreDriver(CORE_START_MS)
    const { served, devices } = replicaWithoutRegistry(idle.state(), 'FAKE')
    live = await mountSessionNew({ served, prepare: (bed) => bed.fake.fail('getCaptureDevices') })
    fillForm()
    await waitFor(() => expect(reason()).toHaveAttribute('data-knowledge', 'FAILED'))
    expect(reason()).toHaveTextContent(C.failed)
    expect(isDisabled(next())).toBe(true)
    submitAroundTheButton()
    await quiet()
    expect(sent()).toEqual([])

    live.bed.fake.answer('getCaptureDevices', { status: 200, body: clone({ devices }) })
    fireEvent.click(screen.getByTestId('local-source-retry'))
    await waitFor(() => expect(reason()).toBeNull())
    await waitFor(() => expect(isDisabled(next())).toBe(false))
  })

  it('link down, then a refetch after an invalidation (what RESYNCED does): disabled with the reason both times, nothing sent', async () => {
    const idle = createCoreDriver(CORE_START_MS)
    live = await mountSessionNew({ served: idle.state() })
    fillForm()
    await waitFor(() => expect(isDisabled(next())).toBe(false))
    expect(reason()).toBeNull()

    // Part 2 first (the link is still up): the cache is invalidated and the new answer is held.
    const held = live.bed.fake.hold('getCaptureDevices')
    await act(async () => {
      void live!.mounted.queryClient.invalidateQueries({ queryKey: CORE_QUERY_KEYS.captureDevices, exact: true })
    })
    await waitFor(() => expect(reason()).toHaveTextContent(C.checking))
    expect(isDisabled(next())).toBe(true)
    submitAroundTheButton()
    await quiet()
    expect(sent()).toEqual([])
    await act(async () => {
      held.release({ status: 200, body: clone(live!.bed.core.served.captureDevices) })
    })
    await waitFor(() => expect(reason()).toBeNull())
    expect(isDisabled(next())).toBe(false)

    // Part 1: the link goes down.
    await act(async () => {
      live!.bed.core.unreachable()
    })
    await waitFor(() => expect(reason()).toHaveTextContent(C.checking))
    expect(isDisabled(next())).toBe(true)
    submitAroundTheButton()
    await quiet()
    expect(sent()).toEqual([])
  })

  it('known, no local device: no reason line, and Next sends the create, then the pre-check, without a notice (as before)', async () => {
    const idle = createCoreDriver(CORE_START_MS)
    live = await mountSessionNew({ served: idle.state() })
    const core = createCoreDriver(live.bed.fake.clock.now())
    fillForm()
    await waitFor(() => expect(isDisabled(next())).toBe(false))
    expect(reason()).toBeNull()
    const created = core.sim.actions.createSession(FORM_INPUT)
    if (!created.ok) throw new Error('driver')
    live.bed.fake.scriptCommand('createSession', { ops: sessionOps(core), order: 'delta-first', answer: { status: 201, body: { sessionId: created.sessionId, state: 'CREATE', created: true } } })
    core.sim.actions.beginPrecheck()
    live.bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'delta-first' })
    fireEvent.click(next())
    await waitFor(() => expect(sent()).toEqual(['createSession', 'beginPrecheck']))
    expect(screen.queryByTestId('local-source-notice')).toBeNull()
  })

  it('resume: a session left in CREATE gets NO pre-check by itself while the list is held; with the answer (no local device) exactly one', async () => {
    const core = coreWithSession(CORE_START_MS, 'CREATE')
    let held: ReturnType<MountedSessionNew['bed']['fake']['hold']> | undefined
    live = await mountSessionNew({
      served: core.state(),
      path: '/session/new?step=2',
      prepare: (bed) => {
        held = bed.fake.hold('getCaptureDevices')
        core.sim.actions.beginPrecheck()
        bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'delta-first' })
      },
    })
    await quiet()
    expect(reason()).toHaveTextContent(C.checking)
    expect(sent()).toEqual([])
    await act(async () => {
      held!.release({ status: 200, body: clone(live!.bed.core.served.captureDevices) })
    })
    await waitFor(() => expect(sent()).toEqual(['beginPrecheck']))
    await quiet()
    expect(sent()).toEqual(['beginPrecheck'])
  })
})
