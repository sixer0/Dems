/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W64: the Start New Session page in Live mode, steps 2 and 3 (backend task
// 04_client_integration_spec §8.3 B-6, §8.4 C-4, finding FC-7; CLG (b)). Real router, real Live
// source, fake transport (W50's harness); the Core's states come from a simulator that stands for
// its engine (`live-session-new-bed.ts`).
//
// | Site | Success | Refusal (AC-C-48: the denied toast) | Outage (LB-6) |
// |------|---------|-------------------------------------|---------------|
// | B-6 resume effect `beginPrecheck` (FC-7) | under StrictMode (as `main.tsx` renders) ONE request while it is in flight; the delta moves the gate on | one request, the denied toast | one request, the offline toast |
// | B-6 `acknowledgePrecheckWarnings` | step 3 in `ok` | step 2 stays, Next idle | step 2 stays |
// | B-6 `retryPrecheck` | the gate runs again; F69's wording on the blocked Core link before | still blocked | still blocked |
// | B-6 `startRecording`, C-4 the ID read before the call | a durable Core: "Recording started" names that ID; a Core still connecting (row 139): "Connecting cameras…" with that ID, no "Recording started"; then `/session` | no navigation, Start idle | no navigation |
// | B-6 `cancel` | "Session discarded.", then `/dashboard` | the dialog stays open | the dialog stays open |
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import {
  clearToasts,
  CORE_START_MS,
  coreWithSession,
  deniedRole,
  deniedTitle,
  isDisabled,
  mountSessionNew,
  offline,
  sessionOps,
  settleAll,
  stubMediaForJsdom,
  toastsWith,
  type CoreDriver,
  type MountedSessionNew,
} from '@/features/session-new/__tests__/live-session-new-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

let live: MountedSessionNew | undefined

const pageRoot = () => screen.getByTestId('page-session-new')
const step = () => pageRoot().getAttribute('data-step')
const requests = (operationId: string) => live!.bed.fake.log.requestsOf(operationId).length
const pathname = () => live!.mounted.router.state.location.pathname

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

describe('B-6 the resume effect: beginPrecheck once per session (FC-7)', () => {
  /**
   * The Core holds a session left in CREATE (a reload between create and pre-check). The page opens
   * AT step 2 under StrictMode (as `main.tsx` renders it), so React runs the resume effect twice on
   * mount: exactly what the in-flight marker is for.
   */
  async function resumeOnCreate(script: (core: CoreDriver, bed: MountedSessionNew['bed']) => void) {
    const core = coreWithSession(CORE_START_MS, 'CREATE')
    live = await mountSessionNew({ served: core.state(), path: '/session/new?step=2', mount: { strict: true }, prepare: (bed) => script(core, bed) })
    await waitFor(() => expect(step()).toBe('2'))
    await waitFor(() => expect(requests('beginPrecheck')).toBeGreaterThan(0))
    await settleAll(live.bed)
    return core
  }

  it('success: StrictMode runs the effect twice, ONE request goes out while it is in flight; the delta then moves the gate on', async () => {
    let command: { sendDelta(): void } | undefined
    await resumeOnCreate((core, bed) => {
      core.sim.actions.beginPrecheck()
      command = bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'answer-first' })
    })
    // In flight: the answer is in, the delta is not; the session is still CREATE in the replica.
    expect(pageRoot()).toHaveAttribute('data-session-state', 'CREATE')
    expect(requests('beginPrecheck')).toBe(1)
    command!.sendDelta()
    await waitFor(() => expect(pageRoot()).toHaveAttribute('data-session-state', 'PRECHECK'))
    await settleAll(live!.bed)
    expect(requests('beginPrecheck')).toBe(1)
  })

  it('refusal: a 403 shows the denied toast; one request, nothing is sent again', async () => {
    await resumeOnCreate((_core, bed) => bed.fake.answerOnce('beginPrecheck', bed.fake.example('beginPrecheck', 403, 'notPermitted')))
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    await settleAll(live!.bed)
    expect(requests('beginPrecheck')).toBe(1)
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
  })

  it('outage: the offline toast; one request, nothing is sent again', async () => {
    await resumeOnCreate((_core, bed) => bed.fake.failOnce('beginPrecheck'))
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
    await settleAll(live!.bed)
    expect(requests('beginPrecheck')).toBe(1)
  })
})

describe('B-6 acknowledgePrecheckWarnings (LB-1 on Next)', () => {
  /** The Core's pre-check ended with a warning; the page resumes at step 2 and the box is ticked. */
  async function warned() {
    const core = coreWithSession(CORE_START_MS, 'WARN')
    live = await mountSessionNew({ served: core.state() })
    await waitFor(() => expect(step()).toBe('2'))
    fireEvent.click(within(screen.getByTestId('sn-gate-warn')).getByRole('checkbox'))
    await waitFor(() => expect(isDisabled(screen.getByTestId('sn-next'))).toBe(false))
    return core
  }

  it('success: step 3 opens when the acknowledgement settled', async () => {
    const core = await warned()
    core.sim.actions.acknowledgePrecheckWarnings()
    live!.bed.fake.scriptCommand('acknowledgePrecheckWarnings', { ops: sessionOps(core), order: 'delta-first' })
    fireEvent.click(screen.getByTestId('sn-next'))
    await waitFor(() => expect(step()).toBe('3'))
    expect(pageRoot()).toHaveAttribute('data-session-state', 'ARMED')
    expect(requests('acknowledgePrecheckWarnings')).toBe(1)
  })

  it('refusal: a 403 shows the denied toast; step 2 stays and Next is idle again', async () => {
    await warned()
    // Every navigation the router starts: the page must not even ask for step 3 before the Core answered.
    const asked: unknown[] = []
    const stop = live!.mounted.router.subscribe('onBeforeNavigate', (event) => asked.push(event.toLocation.search))
    live!.bed.fake.answerOnce('acknowledgePrecheckWarnings', live!.bed.fake.example('acknowledgePrecheckWarnings', 403, 'notPermitted'))
    fireEvent.click(screen.getByTestId('sn-next'))
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    stop()
    expect(asked).not.toContainEqual(expect.objectContaining({ step: 3 }))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    expect(toastsWith(en.sessionNew.errors.acknowledge)).toHaveLength(0)
    expect(step()).toBe('2')
    await waitFor(() => expect(screen.getByTestId('sn-next')).not.toHaveAttribute('aria-busy'))
  })

  it('outage: the offline toast; step 2 stays', async () => {
    await warned()
    live!.bed.fake.failOnce('acknowledgePrecheckWarnings')
    fireEvent.click(screen.getByTestId('sn-next'))
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    expect(toastsWith(en.sessionNew.errors.acknowledge)).toHaveLength(0)
    expect(step()).toBe('2')
    await waitFor(() => expect(screen.getByTestId('sn-next')).not.toHaveAttribute('aria-busy'))
  })
})

describe('B-6 retryPrecheck (LB-1 on "Re-run checks"); the blocked Core link in Live mode (F69)', () => {
  /** The Core's pre-check is blocked because no paired tablet is connected. */
  async function blocked() {
    const core = coreWithSession(CORE_START_MS, 'BLOCK')
    live = await mountSessionNew({ served: core.state() })
    await waitFor(() => expect(screen.getByTestId('sn-step-devices')).toHaveAttribute('data-gate', 'block'))
    return core
  }

  it('the blocked Core link is worded as a missing paired tablet, without the "clear the fault" line; never an "unreachable" sentence', async () => {
    await blocked()
    const alert = screen.getByTestId('sn-gate-blocked')
    expect(alert).toHaveTextContent(en.sessionNew.devices.reasons.coreOffline)
    expect(within(alert).getByTestId('sn-gate-live-link')).toHaveTextContent(en.sessionNew.live.coreLinkHint)
    expect(alert).not.toHaveTextContent(en.sessionNew.devices.resolveHint)
    expect(isDisabled(screen.getByTestId('sn-next'))).toBe(true)
    expect(toastsWith(offline)).toHaveLength(0)
    expect(document.body.textContent).not.toContain('unreachable')
  })

  it('success: the checks run again when the retry settled', async () => {
    const core = await blocked()
    core.sim.actions.retryPrecheck()
    live!.bed.fake.scriptCommand('retryPrecheck', { ops: sessionOps(core), order: 'delta-first' })
    fireEvent.click(screen.getByTestId('sn-retry'))
    await waitFor(() => expect(screen.getByTestId('sn-step-devices')).not.toHaveAttribute('data-gate', 'block'))
    expect(requests('retryPrecheck')).toBe(1)
  })

  it('refusal: a 403 shows the denied toast; the gate stays blocked and the button idle', async () => {
    await blocked()
    live!.bed.fake.answerOnce('retryPrecheck', live!.bed.fake.example('retryPrecheck', 403, 'notPermitted'))
    fireEvent.click(screen.getByTestId('sn-retry'))
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
    expect(screen.getByTestId('sn-step-devices')).toHaveAttribute('data-gate', 'block')
    await waitFor(() => expect(screen.getByTestId('sn-retry')).not.toHaveAttribute('aria-busy'))
  })

  it('outage: the offline toast; the gate stays blocked', async () => {
    await blocked()
    live!.bed.fake.failOnce('retryPrecheck')
    fireEvent.click(screen.getByTestId('sn-retry'))
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
    expect(screen.getByTestId('sn-step-devices')).toHaveAttribute('data-gate', 'block')
  })
})

describe('B-6 startRecording and C-4 (the session ID is read before the call)', () => {
  /** The Core's session is ARMED; the page resumes at step 3 with the countdown switched off. */
  async function armed() {
    const core = coreWithSession(CORE_START_MS, 'ARMED')
    live = await mountSessionNew({ served: core.state() })
    await waitFor(() => expect(step()).toBe('3'))
    fireEvent.click(within(screen.getByTestId('sn-countdown-switch')).getByRole('switch'))
    await waitFor(() => expect(within(screen.getByTestId('sn-countdown-switch')).getByRole('switch')).not.toBeChecked())
    return core
  }
  const startedToast = (id: string) => en.sessionNew.ready.startedToast.replace('{{sessionId}}', id)

  const connectingToast = en.common.session.connectingCameras

  it('success, a Core that answers with a durable recording: the toast names the ID read before the call, then /session; one request', async () => {
    const core = await armed()
    const id = core.state().session!.id
    core.sim.actions.startRecording()
    // The Core's engine starts a session in "connecting cameras" (pass D10); this Core is past it
    // when it answers: the first fragment is durable, so the page says "Recording started".
    expect(core.runUntil((state) => state.session?.captureDurable !== false, 5_000)).toBe(true)
    expect(core.state().session).toMatchObject({ state: 'RECORDING' })
    live!.bed.fake.scriptCommand('startSession', { ops: sessionOps(core), order: 'delta-first' })
    // The Session Monitor (another row's page) may ask the Core for its own data when it opens.
    live!.bed.fake.answerAllFromExamples()
    fireEvent.click(screen.getByTestId('sn-start'))
    await waitFor(() => expect(toastsWith(startedToast(id))).toHaveLength(1))
    expect(toastsWith(connectingToast)).toHaveLength(0)
    await waitFor(() => expect(pathname()).toBe('/session'))
    expect(requests('startSession')).toBe(1)
    expect(live!.bed.fake.log.requestsOf('startSession')[0]?.params).toEqual({ id })
  })

  it('success, a Core that is still connecting its cameras (row 139; ux §8e.2, D84): "Connecting cameras…" with the ID read before the call, never "Recording started"; then /session', async () => {
    const core = await armed()
    const id = core.state().session!.id
    core.sim.actions.startRecording()
    // The accepted start as the engine answers it: RECORDING, nothing durable yet.
    expect(core.state().session).toMatchObject({ state: 'RECORDING', captureDurable: false })
    live!.bed.fake.scriptCommand('startSession', { ops: sessionOps(core), order: 'delta-first' })
    live!.bed.fake.answerAllFromExamples()
    fireEvent.click(screen.getByTestId('sn-start'))
    await waitFor(() => expect(toastsWith(connectingToast)).toHaveLength(1))
    expect(toastsWith(connectingToast)[0]).toHaveTextContent(id)
    expect(toastsWith(startedToast(id))).toHaveLength(0)
    await waitFor(() => expect(pathname()).toBe('/session'))
    expect(requests('startSession')).toBe(1)
  })

  it('refusal: a 403 shows the denied toast; no "Recording started", no navigation, Start idle', async () => {
    const core = await armed()
    const id = core.state().session!.id
    live!.bed.fake.answerOnce('startSession', live!.bed.fake.example('startSession', 403, 'notPermitted'))
    fireEvent.click(screen.getByTestId('sn-start'))
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    expect(toastsWith(en.sessionNew.errors.start)).toHaveLength(0)
    expect(toastsWith(startedToast(id))).toHaveLength(0)
    expect(pathname()).toBe('/session/new')
    expect(step()).toBe('3')
    await waitFor(() => expect(screen.getByTestId('sn-start')).not.toHaveAttribute('aria-busy'))
    expect(isDisabled(screen.getByTestId('sn-start'))).toBe(false)
  })

  it('outage: the offline toast; no navigation', async () => {
    const core = await armed()
    const id = core.state().session!.id
    live!.bed.fake.failOnce('startSession')
    fireEvent.click(screen.getByTestId('sn-start'))
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    expect(toastsWith(en.sessionNew.errors.start)).toHaveLength(0)
    expect(toastsWith(startedToast(id))).toHaveLength(0)
    expect(pathname()).toBe('/session/new')
  })
})

describe('B-6 cancel (LB-1 on the dialog\'s confirm; leaving happens in ok)', () => {
  /** A setup session at step 2; the Discard dialog is open. */
  async function discarding() {
    const core = coreWithSession(CORE_START_MS, 'WARN')
    live = await mountSessionNew({ served: core.state() })
    await waitFor(() => expect(step()).toBe('2'))
    fireEvent.click(screen.getByTestId('sn-cancel'))
    await screen.findByTestId('sn-cancel-dialog')
    return core
  }

  it('success: "Session discarded." and /dashboard after the Core answered', async () => {
    const core = await discarding()
    core.sim.actions.cancel()
    live!.bed.fake.scriptCommand('cancelSession', { ops: sessionOps(core), order: 'delta-first', answer: { status: 204 } })
    // The Dashboard (another row's page) may ask the Core for its own data when it opens.
    live!.bed.fake.answerAllFromExamples()
    fireEvent.click(screen.getByTestId('sn-cancel-confirm'))
    await waitFor(() => expect(toastsWith(en.sessionNew.discarded)).toHaveLength(1))
    await waitFor(() => expect(pathname()).toBe('/dashboard'))
    expect(requests('cancelSession')).toBe(1)
  })

  it('refusal: a 403 shows the denied toast; the dialog stays open, the page stays', async () => {
    await discarding()
    live!.bed.fake.answerOnce('cancelSession', live!.bed.fake.example('cancelSession', 403, 'notPermitted'))
    fireEvent.click(screen.getByTestId('sn-cancel-confirm'))
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    expect(toastsWith(en.sessionNew.errors.cancel)).toHaveLength(0)
    expect(toastsWith(en.sessionNew.discarded)).toHaveLength(0)
    expect(screen.getByTestId('sn-cancel-dialog')).toBeInTheDocument()
    expect(pathname()).toBe('/session/new')
    await waitFor(() => expect(screen.getByTestId('sn-cancel-confirm')).not.toHaveAttribute('aria-busy'))
  })

  it('outage: the offline toast; the dialog stays open', async () => {
    await discarding()
    live!.bed.fake.failOnce('cancelSession')
    fireEvent.click(screen.getByTestId('sn-cancel-confirm'))
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    expect(toastsWith(en.sessionNew.errors.cancel)).toHaveLength(0)
    expect(screen.getByTestId('sn-cancel-dialog')).toBeInTheDocument()
    expect(pathname()).toBe('/session/new')
  })
})
