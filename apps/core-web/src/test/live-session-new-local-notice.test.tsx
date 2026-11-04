/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Fix pass F-M4, review finding R69-01 (decisions D163, D178): a pre-check on a selector that names
// this Mac's camera or microphone opens the real device, so the web console asks first.
// Real router, real Live source, the contract-checked fake transport (W50's harness); the Core's
// states come from a simulator that stands for its engine. The "local" devices here are a fixture
// state that SAYS `adapter: LOCAL_DEVICE`: nothing is opened, no real Core is called.
//
// | Path that can send a pre-check (`session-new/index.tsx`) | With a local device in the selector | Control: the same selector with `adapter: FAKE` |
// |---|---|---|
// | step 1 -> 2 (`submitInfo` -> `createAndCheck`: `createSession` + `beginPrecheck`) | 0 requests until Confirm; Cancel = 0 requests; Confirm = exactly create, then pre-check | create, then pre-check, no notice |
// | the resume effect (a session left in CREATE: a reload) | NO `beginPrecheck` by itself; the sentence + "Run the device check", which opens the notice; one request after Confirm; a refusal brings the sentence back | one `beginPrecheck` by itself, no sentence |
// | "Re-run checks" (`retryPrecheck`) | the notice once per press; 0 requests on Cancel; one per Confirm | one request per press, no notice |
//
// D181 (ruling 7): the START of a recording keeps the device on, so it has its own notice.
//
// | Path that can send the start (`session-new/index.tsx` `startNow`: the ONE sender of the console) | With a local device | Control (`adapter: FAKE`) |
// |---|---|---|
// | the Start press (countdown off: at once; countdown on: after 3-2-1) | the START notice first; 0 `startSession` until Confirm; "Not now" = 0; once per press; a confirmed PRE-CHECK notice of the same flow does not count | one `startSession`, no notice |
// | a reload on the ready step | nothing is sent by itself (no path sends a start without a press) | the same: nothing by itself |
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SimState } from '@dems/shared/sim'
import {
  clearToasts,
  CORE_START_MS,
  coreWithSession,
  createCoreDriver,
  deniedTitle,
  fillForm,
  FORM_INPUT,
  isDisabled,
  mountSessionNew,
  resolvePrecheck,
  sessionOps,
  settleAll,
  stubMediaForJsdom,
  toastsWith,
  type MountedSessionNew,
} from '@/features/session-new/__tests__/live-session-new-bed'
import { CREATE_BEAT_MS } from '@/features/session-new/model'
import { pageTimersFake, pageTimersReal, pass, until } from '@/runtime/testing/fake-time'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const N = en.common.localSourceNotice
const START = en.common.localSourceStartNotice
type Device = SimState['captureDevices']['devices'][number]

/**
 * The Core's state with a third camera and a third microphone behind VIDEO-01 and the PRIMARY
 * input. `adapter` is the ONLY difference between the local fixture and the control.
 */
function withThirdSources(state: SimState, adapter: 'LOCAL_DEVICE' | 'FAKE', which: { camera?: boolean; microphone?: boolean } = { camera: true, microphone: true }): SimState {
  const camera = state.captureDevices.devices.find((device) => device.kind === 'CAMERA')!
  const mic = state.captureDevices.devices.find((device) => device.kind === 'MIC')!
  const added: Device[] = []
  if (which.camera) added.push({ ...camera, id: 'CAM-05', adapter, sourceClass: 'DEVELOPMENT' } as Device) // D60 (2026-11-04): CAM-03/04 are built-ins now
  if (which.microphone) added.push({ ...mic, id: 'MIC-03', adapter, sourceClass: 'DEVELOPMENT' } as Device)
  return {
    ...state,
    captureDevices: { ...state.captureDevices, devices: [...state.captureDevices.devices, ...added] },
    captureConfig: {
      ...state.captureConfig,
      cameras: state.captureConfig.cameras.map((line) => (which.camera && line.trackId === 'VIDEO-01' ? { ...line, deviceId: 'CAM-05' } : line)),
      mics: state.captureConfig.mics.map((line) => (which.microphone && line.role === 'PRIMARY' ? { ...line, inputId: 'MIC-03', deviceId: 'MIC-03' } : line)) as SimState['captureConfig']['mics'],
    },
  }
}

let live: MountedSessionNew | undefined

const pageRoot = () => screen.getByTestId('page-session-new')
const step = () => pageRoot().getAttribute('data-step')
const next = () => screen.getByTestId('sn-next')
const requests = (operationId: string) => live!.bed.fake.log.requestsOf(operationId).length
const sent = () => live!.bed.fake.log.operationIds().filter((id) => id === 'createSession' || id === 'beginPrecheck' || id === 'retryPrecheck' || id === 'cancelSession')
const notice = () => screen.queryByTestId('local-source-notice')
const notStarted = () => screen.queryByTestId('local-source-not-started')
/** Longer than the page's own beat before the create, and every promise job and fake answer run. */
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
  pageTimersReal()
  cleanup()
  await clearToasts()
  live?.bed.dispose()
  live = undefined
  vi.restoreAllMocks()
})

/** An idle Core with the given selector; the form is filled; the create and the pre-check are scripted as the engine answers them. */
async function step1(adapter: 'LOCAL_DEVICE' | 'FAKE', which?: { camera?: boolean; microphone?: boolean }) {
  const idle = createCoreDriver(CORE_START_MS)
  live = await mountSessionNew({ served: withThirdSources(idle.state(), adapter, which) })
  const core = createCoreDriver(live.bed.fake.clock.now())
  fillForm()
  await waitFor(() => expect(isDisabled(next())).toBe(false))
  const created = core.sim.actions.createSession(FORM_INPUT)
  if (!created.ok) throw new Error('driver')
  live.bed.fake.scriptCommand('createSession', { ops: sessionOps(core), order: 'delta-first', answer: { status: 201, body: { sessionId: created.sessionId, state: 'CREATE', created: true } } })
  core.sim.actions.beginPrecheck()
  live.bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'delta-first' })
}

describe('R69-01 (a) step 1 -> 2 with a local device in the selector', () => {
  it('nothing is sent until Confirm: the notice names both devices; "Not now" sends nothing; Confirm sends exactly the create, then the pre-check', async () => {
    await step1('LOCAL_DEVICE')
    fireEvent.click(next())
    const dialog = await screen.findByTestId('local-source-notice')
    expect(dialog).toHaveTextContent(N.title)
    expect(screen.getByTestId('local-source-notice-devices')).toHaveTextContent(N.web.both.replace('{{camera}}', 'CAM-05').replace('{{microphone}}', 'MIC-03'))
    expect(dialog).toHaveTextContent(N.body)
    await quiet()
    expect(sent()).toEqual([])
    expect(step()).toBe('1')

    fireEvent.click(screen.getByTestId('local-source-notice-cancel'))
    await waitFor(() => expect(notice()).toBeNull())
    await quiet()
    expect(sent()).toEqual([])
    expect(step()).toBe('1')
    expect(next()).toHaveTextContent(en.common.actions.next)

    // The next press asks again: once per press.
    fireEvent.click(next())
    await screen.findByTestId('local-source-notice')
    await quiet()
    expect(sent()).toEqual([])
    fireEvent.click(screen.getByTestId('local-source-notice-confirm'))
    await waitFor(() => expect(step()).toBe('2'))
    await settleAll(live!.bed)
    expect(sent()).toEqual(['createSession', 'beginPrecheck'])
    expect(live!.bed.fake.log.requestsOf('createSession')[0]?.body).toMatchObject(FORM_INPUT)
    expect(notice()).toBeNull()
    expect(notStarted()).toBeNull()
  })

  it('only the microphone is local: the notice names the microphone alone', async () => {
    await step1('LOCAL_DEVICE', { microphone: true })
    fireEvent.click(next())
    await screen.findByTestId('local-source-notice')
    expect(screen.getByTestId('local-source-notice-devices')).toHaveTextContent(N.web.microphone.replace('{{microphone}}', 'MIC-03'))
    expect(screen.getByTestId('local-source-notice-devices')).not.toHaveTextContent('camera')
    await quiet()
    expect(sent()).toEqual([])
  })

  it('CONTROL: the same selector with test sources (`adapter: FAKE`) sends the create, then the pre-check, with no notice', async () => {
    await step1('FAKE')
    fireEvent.click(next())
    await waitFor(() => expect(step()).toBe('2'))
    await settleAll(live!.bed)
    expect(sent()).toEqual(['createSession', 'beginPrecheck'])
    expect(notice()).toBeNull()
    expect(notStarted()).toBeNull()
  })
})

describe('R69-01 (b) a session left in CREATE (a reload): no pre-check by itself', () => {
  /** The page opens AT step 2 under StrictMode (as `main.tsx` renders it) on a Core that holds a session in CREATE. */
  async function reloaded(adapter: 'LOCAL_DEVICE' | 'FAKE', script: (core: ReturnType<typeof coreWithSession>, bed: MountedSessionNew['bed']) => void) {
    const core = coreWithSession(CORE_START_MS, 'CREATE')
    live = await mountSessionNew({ served: withThirdSources(core.state(), adapter), path: '/session/new?step=2', mount: { strict: true }, prepare: (bed) => script(core, bed) })
    await waitFor(() => expect(step()).toBe('2'))
    return core
  }

  it('nothing is sent on the mount; the sentence and "Run the device check" stand; the button opens the notice; one request after Confirm', async () => {
    let command: { sendDelta(): void } | undefined
    await reloaded('LOCAL_DEVICE', (core, bed) => {
      core.sim.actions.beginPrecheck()
      command = bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'answer-first' })
    })
    await waitFor(() => expect(notStarted()).not.toBeNull())
    expect(notStarted()).toHaveTextContent(N.notStarted)
    expect(screen.getByTestId('local-source-run-check')).toHaveTextContent(N.runCheck)
    await quiet()
    expect(requests('beginPrecheck')).toBe(0)
    expect(pageRoot()).toHaveAttribute('data-session-state', 'CREATE')

    // "Not now": still nothing, the sentence stays.
    fireEvent.click(screen.getByTestId('local-source-run-check'))
    await screen.findByTestId('local-source-notice')
    fireEvent.click(screen.getByTestId('local-source-notice-cancel'))
    await waitFor(() => expect(notice()).toBeNull())
    await quiet()
    expect(requests('beginPrecheck')).toBe(0)
    expect(notStarted()).not.toBeNull()

    fireEvent.click(screen.getByTestId('local-source-run-check'))
    await screen.findByTestId('local-source-notice')
    expect(requests('beginPrecheck')).toBe(0)
    fireEvent.click(screen.getByTestId('local-source-notice-confirm'))
    await waitFor(() => expect(requests('beginPrecheck')).toBe(1))
    await quiet()
    // In flight (the answer is in, the delta is not): no second request, and the sentence is gone.
    expect(pageRoot()).toHaveAttribute('data-session-state', 'CREATE')
    expect(requests('beginPrecheck')).toBe(1)
    expect(notStarted()).toBeNull()
    command!.sendDelta()
    await waitFor(() => expect(pageRoot()).toHaveAttribute('data-session-state', 'PRECHECK'))
    await settleAll(live!.bed)
    expect(requests('beginPrecheck')).toBe(1)
  })

  it('a confirmed check the Core refuses: one request, the sentence is back, and nothing is sent again by itself', async () => {
    await reloaded('LOCAL_DEVICE', (_core, bed) => bed.fake.answerOnce('beginPrecheck', bed.fake.example('beginPrecheck', 403, 'notPermitted')))
    await waitFor(() => expect(notStarted()).not.toBeNull())
    fireEvent.click(screen.getByTestId('local-source-run-check'))
    await screen.findByTestId('local-source-notice')
    fireEvent.click(screen.getByTestId('local-source-notice-confirm'))
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    await quiet()
    expect(requests('beginPrecheck')).toBe(1)
    expect(notStarted()).not.toBeNull()
  })

  it('CONTROL: the same reload with test sources sends ONE pre-check by itself, with no sentence and no notice', async () => {
    let command: { sendDelta(): void } | undefined
    await reloaded('FAKE', (core, bed) => {
      core.sim.actions.beginPrecheck()
      command = bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'answer-first' })
    })
    await waitFor(() => expect(requests('beginPrecheck')).toBe(1))
    await quiet()
    expect(requests('beginPrecheck')).toBe(1)
    expect(notStarted()).toBeNull()
    expect(notice()).toBeNull()
    command!.sendDelta()
    await waitFor(() => expect(pageRoot()).toHaveAttribute('data-session-state', 'PRECHECK'))
  })
})

describe('R69-01 (c) "Re-run checks": the notice once per press', () => {
  async function blocked(adapter: 'LOCAL_DEVICE' | 'FAKE') {
    const core = coreWithSession(CORE_START_MS, 'BLOCK')
    live = await mountSessionNew({ served: withThirdSources(core.state(), adapter) })
    await waitFor(() => expect(screen.getByTestId('sn-step-devices')).toHaveAttribute('data-gate', 'block'))
    await settleAll(live.bed)
  }
  const refuseOnce = () => live!.bed.fake.answerOnce('retryPrecheck', live!.bed.fake.example('retryPrecheck', 403, 'notPermitted'))

  it('each press shows the notice; "Not now" sends nothing; each Confirm sends one request', async () => {
    await blocked('LOCAL_DEVICE')
    expect(notStarted()).toBeNull()
    fireEvent.click(screen.getByTestId('sn-retry'))
    await screen.findByTestId('local-source-notice')
    fireEvent.click(screen.getByTestId('local-source-notice-cancel'))
    await waitFor(() => expect(notice()).toBeNull())
    await quiet()
    expect(requests('retryPrecheck')).toBe(0)

    // The Core refuses, so the gate stays blocked and Retry can be pressed again.
    for (const count of [1, 2]) {
      refuseOnce()
      fireEvent.click(screen.getByTestId('sn-retry'))
      await screen.findByTestId('local-source-notice')
      expect(requests('retryPrecheck')).toBe(count - 1)
      fireEvent.click(screen.getByTestId('local-source-notice-confirm'))
      await waitFor(() => expect(requests('retryPrecheck')).toBe(count))
      await waitFor(() => expect(notice()).toBeNull())
      await waitFor(() => expect(screen.getByTestId('sn-retry')).not.toHaveAttribute('aria-busy'))
      await clearToasts()
    }
    expect(requests('beginPrecheck')).toBe(0)
  })

  it('CONTROL: with test sources a press sends one request, with no notice', async () => {
    await blocked('FAKE')
    refuseOnce()
    fireEvent.click(screen.getByTestId('sn-retry'))
    await waitFor(() => expect(requests('retryPrecheck')).toBe(1))
    await quiet()
    expect(notice()).toBeNull()
    expect(requests('retryPrecheck')).toBe(1)
  })
})

describe('D181 Start Recording with a local device in the selector', () => {
  const countdownSwitch = () => within(screen.getByTestId('sn-countdown-switch')).getByRole('switch')
  /** The Core's session is ARMED; the page is on the ready step with the countdown switched off. */
  async function armed(adapter: 'LOCAL_DEVICE' | 'FAKE', path?: string) {
    const core = coreWithSession(CORE_START_MS, 'ARMED')
    live = await mountSessionNew({ served: withThirdSources(core.state(), adapter), ...(path === undefined ? {} : { path, mount: { strict: true } }) })
    await waitFor(() => expect(step()).toBe('3'))
    return core
  }
  async function countdownOff() {
    fireEvent.click(countdownSwitch())
    await waitFor(() => expect(countdownSwitch()).not.toBeChecked())
  }
  /** The start as the engine answers it; the Session Monitor may ask for its own data when it opens. */
  function scriptStart(core: ReturnType<typeof coreWithSession>) {
    core.sim.actions.startRecording()
    live!.bed.fake.scriptCommand('startSession', { ops: sessionOps(core), order: 'delta-first' })
    live!.bed.fake.answerAllFromExamples()
  }

  it('(a) nothing is sent until Confirm: the START notice names both devices and says they stay on; "Not now" sends nothing; Confirm sends exactly one start', async () => {
    const core = await armed('LOCAL_DEVICE')
    await countdownOff()
    const id = core.state().session!.id
    fireEvent.click(screen.getByTestId('sn-start'))
    const dialog = await screen.findByTestId('local-source-notice')
    expect(dialog).toHaveAttribute('data-kind', 'START')
    expect(dialog).toHaveTextContent(START.title)
    expect(screen.getByTestId('local-source-notice-devices')).toHaveTextContent(START.web.both.replace('{{camera}}', 'CAM-05').replace('{{microphone}}', 'MIC-03'))
    expect(dialog).toHaveTextContent(START.body)
    expect(screen.getByTestId('local-source-notice-confirm')).toHaveTextContent(START.confirm)
    await quiet()
    expect(requests('startSession')).toBe(0)

    fireEvent.click(screen.getByTestId('local-source-notice-cancel'))
    await waitFor(() => expect(notice()).toBeNull())
    await quiet()
    expect(requests('startSession')).toBe(0)
    expect(step()).toBe('3')

    // The next press asks again: once per press.
    scriptStart(core)
    fireEvent.click(screen.getByTestId('sn-start'))
    await screen.findByTestId('local-source-notice')
    await quiet()
    expect(requests('startSession')).toBe(0)
    fireEvent.click(screen.getByTestId('local-source-notice-confirm'))
    await waitFor(() => expect(requests('startSession')).toBe(1))
    await waitFor(() => expect(live!.mounted.router.state.location.pathname).toBe('/session'))
    expect(requests('startSession')).toBe(1)
    expect(live!.bed.fake.log.requestsOf('startSession')[0]?.params).toEqual({ id })
  })

  it('(a) with the 3-2-1 countdown on: the notice comes before the countdown; no countdown and no start without Confirm', async () => {
    await armed('LOCAL_DEVICE')
    expect(countdownSwitch()).toBeChecked()
    // The page's timers are fake BEFORE the press (audit 13, W1): a countdown the press armed would
    // be a fake timer too, so the span below runs it through if it exists.
    pageTimersFake()
    fireEvent.click(screen.getByTestId('sn-start'))
    const dialog = await until(() => screen.getByTestId('local-source-notice'))
    expect(dialog).toHaveAttribute('data-kind', 'START')
    // Longer than the whole countdown would take.
    await pass(3_600)
    await settleAll(live!.bed)
    expect(requests('startSession')).toBe(0)
    fireEvent.click(screen.getByTestId('local-source-notice-cancel'))
    await until(() => expect(notice()).toBeNull(), { stepMs: 50 })
    // `quiet()` on the fake clock: longer than the page's own beat, every promise job and fake answer run.
    await pass(CREATE_BEAT_MS + 100)
    await settleAll(live!.bed)
    expect(requests('startSession')).toBe(0)
  })

  it('(b) the pre-check notice confirmed earlier in the same flow does not count: the START notice still appears, and nothing is sent before its own Confirm', async () => {
    // A session left in CREATE; the Core's pre-check passes, and its delta shows the session ARMED.
    const core = coreWithSession(CORE_START_MS, 'CREATE')
    live = await mountSessionNew({
      served: withThirdSources(core.state(), 'LOCAL_DEVICE'),
      path: '/session/new?step=2',
      prepare: (bed) => {
        core.sim.actions.beginPrecheck()
        resolvePrecheck(core)
        bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'delta-first' })
      },
    })
    await waitFor(() => expect(notStarted()).not.toBeNull())
    fireEvent.click(screen.getByTestId('local-source-run-check'))
    expect(await screen.findByTestId('local-source-notice')).toHaveAttribute('data-kind', 'PRECHECK')
    fireEvent.click(screen.getByTestId('local-source-notice-confirm'))
    await waitFor(() => expect(pageRoot()).toHaveAttribute('data-session-state', 'ARMED'))
    expect(requests('beginPrecheck')).toBe(1)
    await waitFor(() => expect(notice()).toBeNull())
    await waitFor(() => expect(isDisabled(next())).toBe(false))
    fireEvent.click(next())
    await waitFor(() => expect(step()).toBe('3'))
    await countdownOff()

    fireEvent.click(screen.getByTestId('sn-start'))
    const dialog = await screen.findByTestId('local-source-notice')
    expect(dialog).toHaveAttribute('data-kind', 'START')
    expect(dialog).toHaveTextContent(START.title)
    await quiet()
    expect(requests('startSession')).toBe(0)
    scriptStart(core)
    fireEvent.click(screen.getByTestId('local-source-notice-confirm'))
    await waitFor(() => expect(requests('startSession')).toBe(1))
  })

  it('(c) a reload on the ready step (StrictMode): no start is sent by itself, and no notice opens by itself', async () => {
    await armed('LOCAL_DEVICE', '/session/new?step=3')
    // On the SYSTEM clock on purpose: what a mount starts by itself is armed during the mount, which
    // needs the real timers (the route's chunk, `findBy…`). A fake clock from here on would not hold it.
    await new Promise((resolve) => setTimeout(resolve, 3_600))
    await settleAll(live!.bed)
    expect(requests('startSession')).toBe(0)
    expect(notice()).toBeNull()
    expect(step()).toBe('3')
  })

  it('(d) CONTROL: with test sources the start goes out on the press, with no notice', async () => {
    const core = await armed('FAKE')
    await countdownOff()
    scriptStart(core)
    fireEvent.click(screen.getByTestId('sn-start'))
    await waitFor(() => expect(requests('startSession')).toBe(1))
    expect(notice()).toBeNull()
    await waitFor(() => expect(live!.mounted.router.state.location.pathname).toBe('/session'))
    expect(requests('startSession')).toBe(1)
  })
})
