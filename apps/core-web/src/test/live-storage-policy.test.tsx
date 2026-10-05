/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W71: settle site B-9 of the Storage page — "Apply policy" in the Manage Storage drawer
// (`features/storage/manage-drawer.tsx`, `setStoragePolicy` → operation 55, the one any-of of the
// registry) — in Live mode on the contract-checked fake transport, and the same drawer in Simulated
// mode as the control group (backend task 04_client_integration_spec §8.3 B-9, §8.1 LB-1 to LB-10,
// §6.2, AC-C-48; gate CLG (b) of 02_plan §11; decision F64 for the any-of refusal).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | B-9 success: one POST to operation 55 with the draft, the toast and the closing drawer after the answer, for both holders of the any-of | "B-9 success" |
// | B-9 refusal, AC-C-48: a 403 NOT_PERMITTED shows the denied toast and the control returns to idle; the drawer stays open with the draft (F64: no role is named for the any-of until W83) | "B-9 refusal" |
// | B-9: the Core's 422 (rebuilt as `SimTransitionError`, POLICY_RANGE) keeps `storage.manage.failed` and one record in the page's own log | "B-9 refusal" |
// | B-9 outage, LB-6 / CL-22 / AC-C-59 shape: the presenter's sentence, no success toast, the drawer stays open; with the link down no request is sent | "B-9 outage" |
// | LB-10: a 429 is a limit, not an outage, and the drawer keeps what was chosen | "B-9 outage" |
// | LB-1: busy at once (a second press sends nothing), spinner late, the busy mark on the footer (F63-2) | "B-9 pending" |
// | §3.2: no "simulated" word on the Live toast; Simulated mode keeps its words and its synchronous timing | "B-9 success", "Simulated mode is unchanged" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionInfo } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { LiveLinkState } from '@dems/shared/live'
import { rateLimited, refusal, type FakeCommandOptions } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  OPERATORS,
  ROLE_PERMISSIONS,
  type Sim,
  type StoragePolicy,
} from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { REDUCED_MOTION_MEDIA_QUERY } from '@/motion'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import {
  createLiveTestBed,
  INVESTIGATOR_SESSION,
  SUPERVISOR_SESSION,
  type LivePage,
  type LiveTestBed,
} from '@/runtime/testing/live-harness'

// The page is a lazily loaded chunk: under load the first import can take longer than the library's second.
configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 25_000 })

const RINA = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.RINA)!
/** The seeded TECHNICIAN: holds MAINTENANCE and not EVIDENCE_REVIEW, the other half of the any-of. */
const TECHNICIAN_SESSION: Pick<AuthSessionInfo, 'operator' | 'permissions'> = {
  operator: {
    id: RINA.id,
    username: RINA.username,
    rank: RINA.rank,
    name: RINA.name,
    displayName: RINA.displayName,
    initials: RINA.initials,
    role: RINA.role,
  },
  permissions: [...ROLE_PERMISSIONS.TECHNICIAN],
}

const M = en.storage.manage
const DENIED = en.common.rbac.deniedTitle
const OFFLINE = en.common.coreErrors.offline
const LIMITED = (seconds: number) => en.common.coreErrors.limited.replace('{{seconds}}', String(seconds))
/** The page's own record of a refused apply (`features/storage/log.ts`). */
const RECORD_SOURCE = 'Storage.ManageStorageDrawer.apply'

const originalMatchMedia = window.matchMedia
/** Reduced motion, as the folder's own drawer tests run it: the kit's drawer and popover open at once. */
function stubReducedMotion() {
  window.matchMedia = ((query: string) =>
    ({
      matches: query === REDUCED_MOTION_MEDIA_QUERY,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
}
/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}
/** The toasts on screen, by their text (scoped to the kit's toast slot, F76-9). */
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const toastWith = (text: string) => toastTexts().filter((entry) => entry.includes(text))

let bed: LiveTestBed | undefined

/** A signed-in operator on the Storage page in Live mode, the Policy panel on screen. */
async function liveStorage(session: Pick<AuthSessionInfo, 'operator' | 'permissions'> = SUPERVISOR_SESSION): Promise<{ bed: LiveTestBed; page: LivePage }> {
  const created = createLiveTestBed({ session })
  bed = created
  const page = await created.load()
  await created.mount(page, '/storage')
  await screen.findByTestId('page-storage')
  await screen.findByTestId('storage-manage-open')
  return { bed: created, page }
}

/** Opens Manage Storage and returns the drawer. */
async function openDrawer(): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('storage-manage-open'))
  return screen.findByTestId('storage-manage-drawer')
}
/** Picks a retention policy in the drawer's Select, by its option name. */
async function pickPolicy(drawer: HTMLElement, name: string): Promise<void> {
  fireEvent.click(within(within(drawer).getByTestId('storage-policy-select')).getByRole('button'))
  fireEvent.click(await screen.findByRole('option', { name }))
}
const applyButton = (drawer: HTMLElement) => within(drawer).getByTestId('storage-policy-apply')
const footer = (drawer: HTMLElement) => within(drawer).getByTestId('storage-policy-footer')
/** Opens the drawer, picks "1 year" and returns the drawer with Apply enabled. */
async function draftOneYear(): Promise<HTMLElement> {
  const drawer = await openDrawer()
  await pickPolicy(drawer, M.policies.YEAR_1)
  await waitFor(() => expect(applyButton(drawer)).not.toBeDisabled())
  return drawer
}
const requests = () => bed!.fake.log.requestsOf('setStoragePolicy')
const records = () => webErrorSink.records().filter((record) => record.source === RECORD_SOURCE)
/** The policy the drawer's Select shows (its trigger's text). */
const selectedPolicy = (drawer: HTMLElement) => within(drawer).getByTestId('storage-policy-select').textContent ?? ''
/** The Core's `storagePolicy` slice after a change, as a delta op. */
const policyDelta = (policy: StoragePolicy) => [{ op: 'replace', slice: 'storagePolicy', value: { ...policy } }] as FakeCommandOptions['ops']

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  stubReducedMotion()
})

afterEach(async () => {
  cleanup()
  window.matchMedia = originalMatchMedia
  await clearToasts()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('B-9 success (§8.3; LB-3)', () => {
  it('SUPERVISOR (EVIDENCE_REVIEW): one POST to operation 55 with the draft; the toast and the closing drawer follow the answer and say nothing of a simulation', async () => {
    const { bed } = await liveStorage()
    expect(bed.core.served.storagePolicy.retentionPolicy).not.toBe('YEAR_1')
    const command = bed.fake.scriptCommand('setStoragePolicy', {
      ops: policyDelta({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: bed.core.served.storagePolicy.autoArchive }),
      order: 'delta-first',
    })
    const drawer = await draftOneYear()
    fireEvent.click(applyButton(drawer))

    await waitFor(() => expect(toastWith(M.live.applied)).toHaveLength(1))
    expect(command.deltaSent).toBe(true)
    expect(requests()).toHaveLength(1)
    expect(requests()[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/storage/policy',
      body: { retentionPolicy: 'YEAR_1', autoArchive: bed.core.served.storagePolicy.autoArchive },
    })
    // §3.2: the Live toast carries no "(simulated)".
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
    expect(toastWith(M.applied)).toHaveLength(0)
    // LB-3: the drawer closed after the settle; the page shows the Core's policy (CL-16: the delta came first).
    await waitFor(() => expect(screen.queryByTestId('storage-manage-drawer')).not.toBeInTheDocument())
    expect(screen.getByTestId('storage-policy-retention')).toHaveTextContent(M.policies.YEAR_1)
    await waitFor(() => expect(screen.getByTestId('storage-kpi-retentionDays')).toHaveTextContent('365days'))
    expect(toastWith(M.failed)).toHaveLength(0)
    expect(records()).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('TECHNICIAN (MAINTENANCE, the other half of the any-of): Apply is enabled and auto-archive off is sent as chosen', async () => {
    const { bed } = await liveStorage(TECHNICIAN_SESSION)
    const served = bed.core.served.storagePolicy
    expect(served.autoArchive).toBe(true)
    bed.fake.scriptCommand('setStoragePolicy', {
      ops: policyDelta({ ...served, autoArchive: false }),
      order: 'delta-first',
      answer: { status: 200, body: { ...served, autoArchive: false } },
    })
    const drawer = await openDrawer()
    expect(within(drawer).queryByTestId('storage-policy-rbac')).not.toBeInTheDocument()
    fireEvent.click(within(drawer).getByRole('switch'))
    await waitFor(() => expect(applyButton(drawer)).not.toBeDisabled())
    fireEvent.click(applyButton(drawer))

    await waitFor(() => expect(toastWith(M.live.applied)).toHaveLength(1))
    expect(requests()[0]?.body).toEqual({ retentionPolicy: served.retentionPolicy, autoArchive: false })
    await waitFor(() => expect(screen.queryByTestId('storage-manage-drawer')).not.toBeInTheDocument())
  })

  it('an INVESTIGATOR (neither permission) sees Apply disabled with the two roles, from the session the Core gave', async () => {
    const { bed } = await liveStorage(INVESTIGATOR_SESSION)
    const drawer = await openDrawer()
    expect(within(drawer).getByTestId('storage-policy-rbac')).toHaveTextContent('Requires the Supervisor / Technician role')
    await pickPolicy(drawer, M.policies.YEAR_1)
    expect(applyButton(drawer)).toBeDisabled()
    fireEvent.click(applyButton(drawer))
    await bed.flush()
    expect(requests()).toHaveLength(0)
  })
})

describe('B-9 refusal (§6.2; AC-C-48; LB-5; F64)', () => {
  it('AC-C-48: a 403 NOT_PERMITTED (the contract\'s `notPermitted` example) shows the denied toast, no success toast; the drawer stays open with the draft and Apply is idle again', async () => {
    const { bed } = await liveStorage()
    bed.fake.answerOnce('setStoragePolicy', bed.fake.example('setStoragePolicy', 403, 'notPermitted'))
    const danger = vi.spyOn(toast, 'danger')
    const drawer = await draftOneYear()
    fireEvent.click(applyButton(drawer))

    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(danger).toHaveBeenCalledTimes(1)
    // F64: the any-of has three spellings and the presenter finds no role for the example's
    // `ANY-OF(...)`, so the toast is the generic denial until W83 decides the mapping. It never
    // names a role that cannot change the policy.
    expect(toastWith(DENIED)[0]).not.toMatch(/Investigator|Technician/)
    expect(toastWith(M.live.applied)).toHaveLength(0)
    expect(toastWith(M.failed)).toHaveLength(0)
    // The drawer stays open with what was chosen; Apply is idle and offers the command again.
    expect(screen.getByTestId('storage-manage-drawer')).toBe(drawer)
    expect(selectedPolicy(drawer)).toContain(M.policies.YEAR_1)
    expect(footer(drawer)).not.toHaveAttribute('aria-busy')
    expect(applyButton(drawer)).not.toBeDisabled()
    expect(applyButton(drawer)).not.toHaveAttribute('data-pending')
    // The presenter worded it: the page wrote no record of its own (the Live source reports the rejection itself, CL-24).
    expect(records()).toHaveLength(0)
    expect(requests()).toHaveLength(1)
  })

  it('the Core server\'s own spelling of the any-of (`EVIDENCE_REVIEW_OR_MAINTENANCE`, decision D88) reads the same', async () => {
    const { bed } = await liveStorage()
    // The envelope the lane's Core server sends (implementation/37 §6.1), written here: the contract's example differs (CONTRACT-GAP-5, F64).
    bed.fake.answerOnce(
      'setStoragePolicy',
      refusal(403, 'NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.', {
        operationId: 'setStoragePolicy',
        permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE',
        role: 'INVESTIGATOR',
      }),
    )
    const drawer = await draftOneYear()
    fireEvent.click(applyButton(drawer))
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).not.toMatch(/Investigator|Technician/)
    expect(screen.getByTestId('storage-manage-drawer')).toBe(drawer)
    expect(footer(drawer)).not.toHaveAttribute('aria-busy')
    expect(records()).toHaveLength(0)
  })

  it('the Core\'s 422 (rebuilt as `SimTransitionError` POLICY_RANGE) keeps the existing friendly toast and writes one record with code and class only', async () => {
    const { bed } = await liveStorage()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    bed.fake.answerOnce('setStoragePolicy', bed.fake.example('setStoragePolicy', 422, 'invalidInput'))
    const drawer = await draftOneYear()
    fireEvent.click(applyButton(drawer))

    await waitFor(() => expect(toastWith(M.failed)).toHaveLength(1))
    expect(toastWith(DENIED)).toHaveLength(0)
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(toastWith(M.live.applied)).toHaveLength(0)
    expect(records()).toHaveLength(1)
    const [record] = records()
    expect(record).toMatchObject({ level: 'error', message: 'Storage: the step "ManageStorageDrawer.apply" did not complete.' })
    expect(record?.context).toMatchObject({ retentionPolicy: 'YEAR_1', errorName: 'SimTransitionError', code: 'POLICY_RANGE' })
    expect(String(record?.context?.correlationId)).toMatch(/^stor-/)
    // The record quotes no text of the error (CPW1-8).
    expect(JSON.stringify(record)).not.toMatch(/Invalid input|The request body/i)
    expect(screen.getByTestId('storage-manage-drawer')).toBe(drawer)
    expect(selectedPolicy(drawer)).toContain(M.policies.YEAR_1)
    expect(footer(drawer)).not.toHaveAttribute('aria-busy')
  })
})

describe('B-9 outage (LB-6, CL-22; LB-10)', () => {
  it('a request that gets no answer shows "Core server unreachable. Nothing was changed.", no success toast; the drawer stays open with the draft', async () => {
    const { bed } = await liveStorage()
    bed.fake.failOnce('setStoragePolicy')
    const drawer = await draftOneYear()
    fireEvent.click(applyButton(drawer))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(M.live.applied)).toHaveLength(0)
    expect(toastWith(M.failed)).toHaveLength(0)
    expect(requests()).toHaveLength(1)
    expect(screen.getByTestId('storage-manage-drawer')).toBe(drawer)
    expect(selectedPolicy(drawer)).toContain(M.policies.YEAR_1)
    expect(footer(drawer)).not.toHaveAttribute('aria-busy')
    expect(records()).toHaveLength(0)
  })

  it('with the link down Apply is refused at once without a request, and five presses show one toast', async () => {
    const { bed, page } = await liveStorage()
    const drawer = await draftOneYear()
    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    for (let pressNumber = 0; pressNumber < 5; pressNumber += 1) {
      fireEvent.click(applyButton(drawer))
      await bed.flush()
    }
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(requests()).toHaveLength(0)
    expect(toastWith(M.live.applied)).toHaveLength(0)
    expect(screen.getByTestId('storage-manage-drawer')).toBe(drawer)
    expect(footer(drawer)).not.toHaveAttribute('aria-busy')
  })

  it('LB-10: a 429 shows the limit toast with the seconds of `retry-after`, never the outage sentence; the drawer keeps what was chosen', async () => {
    const { bed, page } = await liveStorage()
    bed.fake.answerOnce('setStoragePolicy', rateLimited(12))
    const drawer = await draftOneYear()
    fireEvent.click(applyButton(drawer))
    await waitFor(() => expect(toastWith(LIMITED(12))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
    expect(toastWith(M.failed)).toHaveLength(0)
    expect(page.live.link).toBe(LiveLinkState.ONLINE)
    expect(screen.getByTestId('shell-mode')).not.toHaveTextContent(/OFFLINE/)
    expect(screen.getByTestId('storage-manage-drawer')).toBe(drawer)
    expect(selectedPolicy(drawer)).toContain(M.policies.YEAR_1)
    expect(applyButton(drawer)).not.toBeDisabled()
  })
})

describe('B-9 pending (LB-1: busy at once, spinner late)', () => {
  it('while the command is out a second press sends nothing; the spinner shows only after LIVE_PENDING_REVEAL_MS; the toast and the closing follow the answer', async () => {
    const { bed } = await liveStorage()
    const held = bed.fake.hold('setStoragePolicy')
    const drawer = await draftOneYear()
    const apply = applyButton(drawer)
    const elementsBefore = footer(drawer).querySelectorAll('*').length
    const outsideApply = () => footer(drawer).querySelectorAll('*').length - apply.querySelectorAll('*').length
    const outsideBefore = outsideApply()
    fireEvent.click(apply)
    await waitFor(() => expect(requests()).toHaveLength(1))
    await bed.flush()

    // Busy at once, same look: the footer is marked, Apply is not pending and not disabled yet.
    expect(footer(drawer)).toHaveAttribute('aria-busy', 'true')
    expect(apply).not.toHaveAttribute('data-pending')
    expect(apply).not.toBeDisabled()
    expect(footer(drawer).querySelectorAll('*').length).toBe(elementsBefore)
    expect(toastWith(M.live.applied)).toHaveLength(0)

    // A second press while the first is out sends nothing.
    fireEvent.click(apply)
    await bed.flush()
    expect(requests()).toHaveLength(1)

    // Spinner late: after the reveal time (real timers; the motion policy's time scale is 1 here).
    await waitFor(() => expect(apply).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    // The pending state adds nothing outside the pressed control (AC-C-58 shape).
    expect(outsideApply()).toBe(outsideBefore)
    expect(apply.querySelector('[data-slot="spinner"], svg')).not.toBeNull()
    expect(screen.getByTestId('storage-manage-drawer')).toBe(drawer)

    await act(async () => {
      held.release()
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(M.live.applied)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByTestId('storage-manage-drawer')).not.toBeInTheDocument())
    expect(requests()).toHaveLength(1)
  })
})

// ── The control group: the same drawer in Simulated mode, as it was before this row ───────────

class SilentSocket implements SocketLike {
  readyState = 0
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
}

/** The simulator's fixed "now" (as the folder's own test, so the dataset does not depend on the date). */
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
const sims: Sim[] = []

async function simulatedStorage(operatorId: string): Promise<Sim> {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({
    clock: createManualClock(DEMO_NOW),
    scenario: 'idle',
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
  sims.push(sim)
  const router = createAppRouter(
    { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/storage'] }) },
  )
  render(<RouterProvider router={router} />)
  await screen.findByTestId('page-storage')
  await screen.findByTestId('storage-manage-open')
  return sim
}

describe('Simulated mode is unchanged (CLG (a); §3.2)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  })
  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
  })

  it('a TECHNICIAN applies through the simulator in the press: the store and its audit row change at once, the "(simulated)" toast shows and the drawer closes, never busy', async () => {
    const sim = await simulatedStorage(OPERATOR_IDS.RINA)
    const drawer = await draftOneYear()
    const before = sim.store.getState().audit.rows.length
    fireEvent.click(applyButton(drawer))
    // Synchronous: the simulator applied the policy in the press.
    expect(sim.store.getState().storagePolicy.retentionPolicy).toBe('YEAR_1')
    expect(sim.store.getState().audit.rows.length).toBe(before + 1)
    expect(sim.store.getState().audit.rows.at(-1)?.type).toBe('STORAGE_POLICY_CHANGED')
    expect(footer(drawer)).not.toHaveAttribute('aria-busy')
    expect(applyButton(drawer)).not.toHaveAttribute('data-pending')
    await waitFor(() => expect(toastWith(M.applied)).toHaveLength(1))
    expect(toastWith(M.live.applied).filter((text) => !text.includes('(simulated)'))).toHaveLength(0)
    await waitFor(() => expect(screen.queryByTestId('storage-manage-drawer')).not.toBeInTheDocument())
  })

  it('the volumes footnote keeps its Simulated words', async () => {
    await simulatedStorage(OPERATOR_IDS.BUDI)
    expect(await screen.findByTestId('storage-panel-volumes')).toHaveTextContent(en.storage.volumes.derivedNote)
    expect(screen.getByTestId('storage-panel-volumes')).not.toHaveTextContent(en.storage.volumes.live.derivedNote)
  })
})
