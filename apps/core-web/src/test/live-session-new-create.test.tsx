/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W64: the Start New Session page in Live mode, step 1 (backend task
// 04_client_integration_spec §8.2 A3, A4; §8.4 C-3, D-2, D-3; CLG (b)). Every test runs the real
// router and the real Live source on the fake transport (W50's harness); the states the Core
// sends are produced by a simulator that stands for the Core's engine (`live-session-new-bed.ts`).
//
// | Site | Success | Refusal (AC-C-48: the denied toast) | Outage (LB-6) |
// |------|---------|-------------------------------------|---------------|
// | A3 `createSession` | awaited; step 2 with the Core's session | 403: the denied toast naming the role, Next idle, the form kept | the offline toast, Next idle, the form kept |
// | C-3 the state read after the create | a session the Core already holds in PRECHECK: no `beginPrecheck` is sent | 403: nothing read, no `beginPrecheck` | no `beginPrecheck` |
// | D-2 `cancel` then `createSession` | a changed form on a setup session: create 409, cancel, create, pre-check, in that order | cancel 403: the denied toast, no second create | cancel outage: the offline toast, no second create |
// | D-3 `createSession` then `beginPrecheck` | step 2 only after the pre-check settled | pre-check 403: the denied toast, step 1 | pre-check outage: the offline toast, step 1 |
// | A4 `scanCaseNumber` | the Core's reserved number in the field, one request | 403: the denied toast, then the replica's next number | the offline toast, then the replica's next number |
import { cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { selectNextCaseNumber } from '@dems/shared/sim'
import {
  clearToasts,
  CORE_START_MS,
  coreWithSession,
  createCoreDriver,
  deniedRole,
  deniedTitle,
  fillForm,
  FORM_INPUT,
  isDisabled,
  mountSessionNew,
  offline,
  sessionOps,
  settleAll,
  stubMediaForJsdom,
  toastsWith,
  type MountedSessionNew,
} from '@/features/session-new/__tests__/live-session-new-bed'

// A page's chunk is loaded by a dynamic import: under load that can take longer than the library's default second.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

let live: MountedSessionNew | undefined

const next = () => screen.getByTestId('sn-next')
const step = () => screen.getByTestId('page-session-new').getAttribute('data-step')
const requests = (operationId: string) => live!.bed.fake.log.requestsOf(operationId).length

/** Fills the form and waits until Next may be pressed. */
async function readyToCreate(options: { subject?: boolean } = {}) {
  fillForm(options)
  await waitFor(() => expect(isDisabled(next())).toBe(false))
}

/** After a refusal or an outage of step 1: the page stays, Next is idle, the form keeps what was typed. */
async function expectStep1Kept() {
  await waitFor(() => expect(next()).toHaveTextContent(en.common.actions.next))
  expect(next()).not.toHaveTextContent(en.sessionNew.creating)
  expect(isDisabled(next())).toBe(false)
  expect(step()).toBe('1')
  expect(screen.getByTestId('sn-case-number')).toHaveValue(FORM_INPUT.caseNumber)
  expect(screen.getByTestId('sn-subject-name')).toHaveValue(FORM_INPUT.subjectName)
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

describe('A3 createSession (awaited, CL-26)', () => {
  it('success: the create is sent once with the form, then the pre-check; step 2 shows the Core\'s session', async () => {
    live = await mountSessionNew()
    const core = createCoreDriver(live.bed.fake.clock.now())
    await readyToCreate()
    const created = core.sim.actions.createSession(FORM_INPUT)
    if (!created.ok) throw new Error('driver')
    live.bed.fake.scriptCommand('createSession', {
      ops: sessionOps(core),
      order: 'delta-first',
      answer: { status: 201, body: { sessionId: created.sessionId, state: 'CREATE', created: true } },
    })
    core.sim.actions.beginPrecheck()
    live.bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'delta-first' })

    // Two quick presses before the page renders again: one create goes out.
    fireEvent.click(next())
    fireEvent.click(next())
    // The form validates first (asynchronously); then the existing "Creating session…" state (LB-2).
    await waitFor(() => expect(next()).toHaveTextContent(en.sessionNew.creating))
    await waitFor(() => expect(step()).toBe('2'))
    expect(screen.getByTestId('sn-header-session')).toHaveTextContent(created.sessionId)
    await settleAll(live.bed)
    expect(live.bed.fake.log.operationIds().filter((id) => id === 'createSession' || id === 'beginPrecheck')).toEqual(['createSession', 'beginPrecheck'])
    expect(live.bed.fake.log.requestsOf('createSession')[0]?.body).toMatchObject(FORM_INPUT)
    expect(live.bed.fake.log.requestsOf('beginPrecheck')[0]?.params).toEqual({ id: created.sessionId })
  })

  it('refusal: a 403 shows the denied toast that names the role (not the Simulated sentence); Next returns to idle, the form is kept', async () => {
    live = await mountSessionNew()
    await readyToCreate()
    live.bed.fake.answerOnce('createSession', live.bed.fake.example('createSession', 403, 'notPermitted'))
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    expect(toastsWith(en.sessionNew.errors.create.NOT_PERMITTED)).toHaveLength(0)
    await expectStep1Kept()
    expect(requests('createSession')).toBe(1)
    expect(requests('beginPrecheck')).toBe(0)
  })

  it('outage: the offline toast of LB-6; Next returns to idle, the form is kept, nothing else is sent', async () => {
    live = await mountSessionNew()
    await readyToCreate()
    live.bed.fake.failOnce('createSession')
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    // The presenter worded it; the page adds no sentence of its own (LB-5, LB-6).
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
    await expectStep1Kept()
    expect(requests('createSession')).toBe(1)
    expect(requests('beginPrecheck')).toBe(0)
  })

  it('E5: another console created a session meanwhile (409 with no setup session seen before): the existing "session active" toast, no cancel', async () => {
    live = await mountSessionNew()
    await readyToCreate()
    live.bed.fake.answerOnce('createSession', live.bed.fake.example('createSession', 409, 'sessionActive'))
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(en.sessionNew.errors.create.SESSION_ACTIVE)).toHaveLength(1))
    await expectStep1Kept()
    expect(requests('cancelSession')).toBe(0)
  })
})

describe('C-3 the state read after the create decides the pre-check', () => {
  it('success: the Core answers 200 for a session it already holds in PRECHECK: the state is read after the awaited create, no pre-check is sent', async () => {
    live = await mountSessionNew()
    const core = createCoreDriver(live.bed.fake.clock.now())
    await readyToCreate()
    const created = core.sim.actions.createSession(FORM_INPUT)
    if (!created.ok) throw new Error('driver')
    core.sim.actions.beginPrecheck()
    live.bed.fake.scriptCommand('createSession', {
      ops: sessionOps(core),
      order: 'delta-first',
      answer: { status: 200, body: { sessionId: created.sessionId, state: 'PRECHECK', created: false } },
    })
    fireEvent.click(next())
    await waitFor(() => expect(step()).toBe('2'))
    await settleAll(live.bed)
    expect(requests('createSession')).toBe(1)
    expect(requests('beginPrecheck')).toBe(0)
  })

  it('refusal: after a 403 nothing is read and no pre-check is sent; the denied toast shows', async () => {
    live = await mountSessionNew()
    await readyToCreate()
    live.bed.fake.answerOnce('createSession', live.bed.fake.example('createSession', 403, 'notPermitted'))
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    await settleAll(live.bed)
    expect(requests('beginPrecheck')).toBe(0)
    expect(step()).toBe('1')
  })

  it('outage: no pre-check is sent; the offline toast shows', async () => {
    live = await mountSessionNew()
    await readyToCreate()
    live.bed.fake.failOnce('createSession')
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    await settleAll(live.bed)
    expect(requests('beginPrecheck')).toBe(0)
    expect(step()).toBe('1')
  })
})

describe('D-2 cancel, then createSession (a changed form on a setup session)', () => {
  /** The Core holds a setup session with other input (PRECHECK, warned); the page resumes at step 2 and goes back to step 1. */
  async function changedFormOnSetupSession() {
    const core = coreWithSession(CORE_START_MS, 'WARN')
    live = await mountSessionNew({ served: core.state() })
    await waitFor(() => expect(step()).toBe('2'))
    fireEvent.click(screen.getByTestId('sn-back'))
    await waitFor(() => expect(step()).toBe('1'))
    // The form holds the setup session's input; the subject is changed.
    expect(screen.getByTestId('sn-subject-name')).toHaveValue('Siti Rahma')
    // The subject type is already the one of the form: a second press would deselect it.
    await readyToCreate({ subject: false })
    live.bed.fake.answerOnce('createSession', live.bed.fake.example('createSession', 409, 'sessionActive'))
    return core
  }

  it('success: create 409, cancel, create, pre-check, in that order; step 2 shows the new session', async () => {
    const core = await changedFormOnSetupSession()
    core.sim.actions.cancel()
    live!.bed.fake.scriptCommand('cancelSession', { ops: sessionOps(core), order: 'delta-first', answer: { status: 204 } })
    const created = core.sim.actions.createSession(FORM_INPUT)
    if (!created.ok) throw new Error('driver')
    live!.bed.fake.scriptCommand('createSession', {
      ops: sessionOps(core),
      order: 'delta-first',
      answer: { status: 201, body: { sessionId: created.sessionId, state: 'CREATE', created: true } },
    })
    core.sim.actions.beginPrecheck()
    live!.bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'delta-first' })

    fireEvent.click(next())
    await waitFor(() => expect(screen.getByTestId('sn-header-session')).toHaveTextContent(created.sessionId))
    await waitFor(() => expect(step()).toBe('2'))
    expect(live!.bed.fake.log.operationIds().filter((id) => ['createSession', 'cancelSession', 'beginPrecheck'].includes(id))).toEqual([
      'createSession',
      'cancelSession',
      'createSession',
      'beginPrecheck',
    ])
  })

  it('refusal: the cancel is refused (403): the denied toast, no second create, step 1 with the form kept', async () => {
    await changedFormOnSetupSession()
    live!.bed.fake.answerOnce('cancelSession', live!.bed.fake.example('cancelSession', 403, 'notPermitted'))
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
    await waitFor(() => expect(next()).toHaveTextContent(en.common.actions.next))
    expect(step()).toBe('1')
    expect(requests('createSession')).toBe(1)
    expect(requests('cancelSession')).toBe(1)
  })

  it('outage: the cancel is not answered: the offline toast, no second create', async () => {
    await changedFormOnSetupSession()
    live!.bed.fake.failOnce('cancelSession')
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    await waitFor(() => expect(next()).toHaveTextContent(en.common.actions.next))
    expect(step()).toBe('1')
    expect(requests('createSession')).toBe(1)
  })
})

describe('D-3 createSession, then beginPrecheck, awaited in order', () => {
  /** The create is answered with the Core's new session; returns the driver for the pre-check. */
  async function createAnswered() {
    live = await mountSessionNew()
    const core = createCoreDriver(live.bed.fake.clock.now())
    await readyToCreate()
    const created = core.sim.actions.createSession(FORM_INPUT)
    if (!created.ok) throw new Error('driver')
    live.bed.fake.scriptCommand('createSession', {
      ops: sessionOps(core),
      order: 'delta-first',
      answer: { status: 201, body: { sessionId: created.sessionId, state: 'CREATE', created: true } },
    })
    return core
  }

  it('success: step 2 is shown only after the pre-check settled (its answer first, its delta later)', async () => {
    const core = await createAnswered()
    core.sim.actions.beginPrecheck()
    const precheck = live!.bed.fake.scriptCommand('beginPrecheck', { ops: sessionOps(core), order: 'answer-first' })
    fireEvent.click(next())
    await waitFor(() => expect(requests('beginPrecheck')).toBe(1))
    await settleAll(live!.bed)
    // The answer is in, its delta is not: the pre-check has not settled, the page waits on step 1.
    expect(step()).toBe('1')
    expect(next()).toHaveTextContent(en.sessionNew.creating)
    precheck.sendDelta()
    await waitFor(() => expect(step()).toBe('2'))
    expect(screen.getByTestId('page-session-new')).toHaveAttribute('data-session-state', 'PRECHECK')
    expect(requests('beginPrecheck')).toBe(1)
  })

  it('refusal: the pre-check is refused (403): the denied toast, the page stays on step 1 with Next idle', async () => {
    await createAnswered()
    live!.bed.fake.answerOnce('beginPrecheck', live!.bed.fake.example('beginPrecheck', 403, 'notPermitted'))
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
    await expectStep1Kept()
    expect(requests('beginPrecheck')).toBe(1)
  })

  it('outage: the pre-check is not answered: the offline toast, step 1', async () => {
    await createAnswered()
    live!.bed.fake.failOnce('beginPrecheck')
    fireEvent.click(next())
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
    await expectStep1Kept()
  })
})

describe('A4 scanCaseNumber (LB-1 on the scan button)', () => {
  it('success: the Core\'s reserved number is written into the field when the scan settled; one request', async () => {
    live = await mountSessionNew()
    live.bed.fake.answerOnce('scanCaseNumber', { status: 200, body: { caseNumber: 'LP/2026/1001-0042' } })
    fireEvent.click(screen.getByTestId('sn-scan'))
    await waitFor(() => expect(screen.getByTestId('sn-case-number')).toHaveValue('LP/2026/1001-0042'))
    expect(requests('scanCaseNumber')).toBe(1)
    expect(screen.getByTestId('sn-scan')).not.toHaveAttribute('aria-busy')
  })

  it('refusal: a 403 shows the denied toast, then the field gets the replica\'s next number (the adapter\'s fallback)', async () => {
    live = await mountSessionNew()
    const fallback = selectNextCaseNumber(live.page.runtime.sim.store.getState())
    live.bed.fake.answerOnce('scanCaseNumber', live.bed.fake.example('scanCaseNumber', 403, 'notPermitted'))
    fireEvent.click(screen.getByTestId('sn-scan'))
    await waitFor(() => expect(toastsWith(deniedTitle)).toHaveLength(1))
    expect(toastsWith(deniedTitle)[0]).toHaveTextContent(deniedRole)
    await waitFor(() => expect(screen.getByTestId('sn-case-number')).toHaveValue(fallback))
    expect(screen.getByTestId('sn-scan')).not.toHaveAttribute('aria-busy')
  })

  it('outage: the offline toast, then the replica\'s next number; the scan button is idle again', async () => {
    live = await mountSessionNew()
    const fallback = selectNextCaseNumber(live.page.runtime.sim.store.getState())
    live.bed.fake.failOnce('scanCaseNumber')
    fireEvent.click(screen.getByTestId('sn-scan'))
    await waitFor(() => expect(toastsWith(offline)).toHaveLength(1))
    await waitFor(() => expect(screen.getByTestId('sn-case-number')).toHaveValue(fallback))
    expect(screen.getByTestId('sn-scan')).not.toHaveAttribute('aria-busy')
    expect(isDisabled(screen.getByTestId('sn-scan'))).toBe(false)
  })
})
