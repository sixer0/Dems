/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W81: where the pairing code may live, and when it is dropped (backend task
// 04_client_integration_spec §10.3, PG-6a, WS-12, RC-3; security design review SD-20, SD-23), on
// the contract-checked fake transport through W50's harness. Every test issues the MARKER code of
// the bed and scans for it (SD-23).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-96: the code is in no web-storage value, no URL and no query-cache entry (queries and mutations) | "AC-C-96" |
// | AC-C-106: after a sign-out, `session.ended`, and a `session.updated` that removes `PAIRING_MANAGE` (or `USER_ADMIN`), the feature holds no code; a second operator on the same page load sees no digit of the first | "AC-C-106" |
// | §10.3: leaving the page and coming back shows the code again; a reload does not | "the life of the code" |
// | AC-C-107: a sign-in with a marker password, the issue of a code and the failure paths leave no marker, no code and no `ses_` / `dvc_` / `bio_` string in the web's error sink, the Live source's sink or the console | "AC-C-107" |
import { createElement } from 'react'
import { act, cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { Permission } from '@dems/shared/sim'
import { codeMemoryOf } from '@/features/paired-devices/code-memory'
import {
  cacheText,
  clearToasts,
  CODE_LIFETIME_MS,
  disposeBed,
  installPageStubs,
  MARKER_CODE,
  MARKER_QR,
  openPairedDevices,
  registryDevice,
  SECOND_SUPERVISOR,
  toastsWith,
  urlText,
  webStorageText,
  without,
  type PdBed,
} from '@/features/paired-devices/__tests__/pd-bed'
import { resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { CORE_QUERY_KEY, onCoreQueriesCleared, webErrorSink } from '@/runtime'
import { SUPERVISOR_SESSION } from '@/runtime/testing/live-harness'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

vi.mock('qrcode.react', () => ({
  // The stub renders no payload: a code on screen is only the page's own digits.
  QRCodeSVG: (props: Record<string, unknown>) => createElement('svg', { 'data-testid': props['data-testid'], role: 'img' }),
}))

/** SD-23: a marker password for the sign-in of AC-C-107. Not the demo password of any seed. */
const MARKER_PASSWORD = 'W81-marker-password-5f3a'
const CREDENTIAL_FORM = /\b(ses|dvc|bio)_[A-Za-z0-9]/

const shownDigits = () => (screen.queryByTestId('pd-code')?.textContent ?? '').replace(/\s+/g, '')
const bodyText = () => document.body.innerHTML

async function issueMarker() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('pd-issue'))
  })
  await screen.findByTestId('pd-code')
  await waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))
}

async function navigate(pd: PdBed, to: string) {
  await act(async () => {
    await pd.mounted.router.navigate({ to })
  })
  await pd.bed.flush()
}

/** Nothing of the code anywhere the page could keep it, other than its own memory. */
function expectNoCodeOutsideMemory(pd: PdBed) {
  for (const [where, text] of [
    ['web storage', webStorageText(pd.bed)],
    ['a URL', urlText(pd.bed, pd.mounted)],
    ['the query cache', cacheText(pd.mounted.queryClient)],
  ] as const) {
    expect(text, where).not.toContain(MARKER_CODE)
    expect(text, where).not.toContain(MARKER_QR)
  }
}

/** Every record of both sinks, and every console line, as one text. */
function logText(pd: PdBed, consoleCalls: unknown[][]): string {
  return JSON.stringify({ web: webErrorSink.records(), live: pd.page.sink.records(), console: consoleCalls.map((call) => call.map(String)) })
}

let restoreStubs: () => void = () => undefined
beforeAll(() => {
  restoreStubs = installPageStubs()
})
afterAll(() => restoreStubs())

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  disposeBed()
  vi.restoreAllMocks()
})

describe('AC-C-96: the code is in no web storage, no URL and no query-cache entry', () => {
  it('after the issue, while the code is on screen, and after the status was read again', async () => {
    const pd = await openPairedDevices()
    // The scan itself: the marker is nowhere before the issue.
    expectNoCodeOutsideMemory(pd)
    await issueMarker()
    expectNoCodeOutsideMemory(pd)
    await act(async () => {
      pd.bed.core.adminChanged('PAIRING_CODE')
    })
    await pd.bed.flush()
    expectNoCodeOutsideMemory(pd)
    // The code is where it belongs: the page load's memory, keyed by its query client.
    expect(codeMemoryOf(pd.mounted.queryClient).held?.code).toBe(MARKER_CODE)
    // The issue is no mutation of the query client.
    expect(pd.mounted.queryClient.getMutationCache().getAll()).toEqual([])
  })
})

describe('AC-C-106: the code is dropped at once (PG-6a)', () => {
  it('a sign-out of this console: no code in memory, no `[core, …]` entry, the page is left, no digit on screen', async () => {
    const pd = await openPairedDevices()
    await issueMarker()
    const { queryClient } = pd.mounted
    // What the cache and the memory hold in the turn of the bridge's clearing (a listener after the feature's).
    const atClearing: Array<{ entries: number; held: unknown }> = []
    const stop = onCoreQueriesCleared(queryClient, () => {
      atClearing.push({ entries: queryClient.getQueryCache().findAll({ queryKey: CORE_QUERY_KEY }).length, held: codeMemoryOf(queryClient).held })
    })
    await act(async () => {
      await pd.page.live.actions.signOut('USER')
    })
    await pd.bed.flush()
    stop()
    expect(atClearing).toEqual([{ entries: 0, held: null }])
    expect(codeMemoryOf(queryClient)).toMatchObject({ held: null, outcome: null, cancelledHere: null })
    // The page renders once more before the shell leaves it: its two observers build EMPTY entries again
    // (disabled: nobody is signed in). None holds data of the earlier operator, and none is fetched.
    for (const query of queryClient.getQueryCache().findAll({ queryKey: CORE_QUERY_KEY })) {
      expect(query.state.data, JSON.stringify(query.queryKey)).toBeUndefined()
      expect(query.state.dataUpdatedAt).toBe(0)
    }
    await waitFor(() => expect(pd.mounted.router.state.location.pathname).toBe('/login'))
    expect(bodyText()).not.toContain(MARKER_CODE)
    expect(cacheText(queryClient)).not.toContain(MARKER_CODE)
  })

  it('decision D176: after the sign-out the page sends no read of its own, also while it is still on screen', async () => {
    const pd = await openPairedDevices()
    await issueMarker()
    const reads = () => ({ status: pd.requests('getPairingCodeStatus').length, list: pd.requests('listPairedDevices').length })
    await act(async () => {
      await pd.page.live.actions.signOut('USER')
    })
    await pd.bed.flush()
    const atSignOut = reads()
    // The shell leaves; time passes on the Live clock; the socket resynchronises as anonymous.
    await waitFor(() => expect(pd.mounted.router.state.location.pathname).toBe('/login'))
    await pd.bed.elapse(5_000, 500)
    expect(reads()).toEqual(atSignOut)
    // And not one answer of either read was a 401: nothing was asked of a signed-out session.
    for (const operationId of ['getPairingCodeStatus', 'listPairedDevices']) {
      expect(pd.bed.fake.log.requestsOf(operationId).filter((call) => call.status === 401), operationId).toEqual([])
    }
  })

  it('`session.ended` (any reason, here the idle expiry): no code in memory', async () => {
    const pd = await openPairedDevices()
    await issueMarker()
    await act(async () => {
      pd.bed.core.end('IDLE_EXPIRED')
    })
    await pd.bed.flush()
    expect(codeMemoryOf(pd.mounted.queryClient).held).toBeNull()
    await waitFor(() => expect(pd.mounted.router.state.location.pathname).toBe('/login'))
    expect(bodyText()).not.toContain(MARKER_CODE)
  })

  it('`session.updated` without `PAIRING_MANAGE`: no code in memory before the guard leaves for the Dashboard (RC-3)', async () => {
    const pd = await openPairedDevices()
    await issueMarker()
    const heldWhenLeaving: unknown[] = []
    const stop = pd.mounted.router.subscribe('onBeforeNavigate', (event) => {
      if (event.toLocation.pathname === '/dashboard') heldWhenLeaving.push(codeMemoryOf(pd.mounted.queryClient).held)
    })
    await act(async () => {
      pd.bed.core.changeRole('SUPERVISOR', without(SUPERVISOR_SESSION.permissions, Permission.PAIRING_MANAGE))
    })
    await pd.bed.flush()
    await screen.findByTestId('page-dashboard')
    stop()
    expect(heldWhenLeaving).toEqual([null])
    expect(codeMemoryOf(pd.mounted.queryClient).held).toBeNull()
    expect(bodyText()).not.toContain(MARKER_CODE)
  })

  it('`session.updated` without `USER_ADMIN` empties the memory too; the page stays and shows "Active, code not known"', async () => {
    const pd = await openPairedDevices()
    await issueMarker()
    await act(async () => {
      pd.bed.core.changeRole('SUPERVISOR', without(SUPERVISOR_SESSION.permissions, Permission.USER_ADMIN))
    })
    await pd.bed.flush()
    expect(codeMemoryOf(pd.mounted.queryClient).held).toBeNull()
    await waitFor(() => expect(screen.getByTestId('pd-issue-panel')).toHaveAttribute('data-state', 'ACTIVE_UNKNOWN'))
    expect(pd.mounted.router.state.location.pathname).toBe('/admin/devices')
    expect(bodyText()).not.toContain(MARKER_CODE)
  })

  it('the code held while the operator is on another page is dropped by the sign-out there; a second operator on the same page load sees no digit of the first', async () => {
    const pd = await openPairedDevices()
    await issueMarker()
    const firstCodeId = pd.core.active!.codeId
    await navigate(pd, '/storage')
    await screen.findByTestId('page-storage')
    expect(codeMemoryOf(pd.mounted.queryClient).held?.code).toBe(MARKER_CODE)

    await act(async () => {
      await pd.page.live.actions.signOut('USER')
    })
    await pd.bed.flush()
    expect(codeMemoryOf(pd.mounted.queryClient).held).toBeNull()
    await waitFor(() => expect(pd.mounted.router.state.location.pathname).toBe('/login'))

    // The second operator signs in on the same page load (the same query client, the same module).
    pd.bed.core.signInAs = SECOND_SUPERVISOR
    pd.core.issuer = SECOND_SUPERVISOR.operator.id
    await act(async () => {
      await pd.page.live.actions.signIn(SECOND_SUPERVISOR.operator.username, 'not-a-real-password')
    })
    await pd.bed.flush()
    await navigate(pd, '/admin/devices')
    await screen.findByTestId('pd-issue-panel')
    // The first operator's code is still active on the Core: the second sees that, and nothing else.
    expect(pd.core.active?.codeId).toBe(firstCodeId)
    await waitFor(() => expect(screen.getByTestId('pd-issue-panel')).toHaveAttribute('data-state', 'ACTIVE_UNKNOWN'))
    expect(screen.getByTestId('pd-code-active-elsewhere')).toHaveTextContent('issued by AKP Andi Pratama')
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(bodyText()).not.toContain(MARKER_CODE)
    expect(bodyText()).not.toContain(MARKER_QR)
    expect(codeMemoryOf(pd.mounted.queryClient).held).toBeNull()
    expectNoCodeOutsideMemory(pd)
  })
})

describe('the life of the code (§10.3)', () => {
  it('leaving the page and coming back inside the console shows it again, at once', async () => {
    const pd = await openPairedDevices()
    await issueMarker()
    await navigate(pd, '/storage')
    await screen.findByTestId('page-storage')
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    await navigate(pd, '/admin/devices')
    await screen.findByTestId('pd-code')
    // Revealed once already: the digits show without the scramble.
    expect(shownDigits()).toBe(MARKER_CODE)
    expect(screen.getByTestId('pd-issue-panel')).toHaveAttribute('data-state', 'ACTIVE_KNOWN')
  })

  it('a reload does not: a new page load shows "A pairing code is active" and no digit', async () => {
    const pd = await openPairedDevices()
    await issueMarker()
    pd.mounted.unmount()
    const page = await pd.bed.load()
    const mounted = await pd.bed.mount(page, '/admin/devices')
    await screen.findByTestId('pd-issue-panel')
    await waitFor(() => expect(screen.getByTestId('pd-issue-panel')).toHaveAttribute('data-state', 'ACTIVE_UNKNOWN'))
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(bodyText()).not.toContain(MARKER_CODE)
    expect(codeMemoryOf(mounted.queryClient).held).toBeNull()
  })

  it('a redeemed code leaves the memory with its digits; only the outcome stays, and the sign-out drops that too', async () => {
    const pd = await openPairedDevices({ waitFor: 'pd-empty' })
    await issueMarker()
    const codeId = pd.core.active!.codeId
    pd.core.active = null
    pd.core.devices = [registryDevice(pd.bed, { id: 'DEV-0002', pairedWithCodeId: codeId, pairedAt: pd.bed.fake.clock.now() })]
    await act(async () => {
      pd.bed.core.adminChanged('DEVICES')
    })
    await pd.bed.flush()
    await waitFor(() => expect(screen.getByTestId('pd-issue-panel')).toHaveAttribute('data-state', 'REDEEMED'))
    expect(codeMemoryOf(pd.mounted.queryClient)).toMatchObject({ held: null, outcome: { kind: 'REDEEMED', codeId, deviceId: 'DEV-0002' } })
    expect(JSON.stringify(codeMemoryOf(pd.mounted.queryClient))).not.toContain(MARKER_CODE)
    await act(async () => {
      await pd.page.live.actions.signOut('USER')
    })
    await pd.bed.flush()
    expect(codeMemoryOf(pd.mounted.queryClient)).toMatchObject({ held: null, outcome: null, cancelledHere: null })
  })
})

describe('AC-C-107: nothing of a secret reaches a log', () => {
  it('a sign-in with a marker password, the issue, and the failure paths of every command leave no marker in the sinks or the console', async () => {
    const consoleCalls: unknown[][] = []
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleCalls.push(args)
      })
    }
    const pd = await openPairedDevices()
    // Sign out and in again through the Live source with the marker password (the Login page's own path is W55's).
    await act(async () => {
      await pd.page.live.actions.signOut('USER')
    })
    await pd.bed.flush()
    await act(async () => {
      await pd.page.live.actions.signIn(SUPERVISOR_SESSION.operator.username, MARKER_PASSWORD)
    })
    await pd.bed.flush()
    await navigate(pd, '/admin/devices')
    await screen.findByTestId('pd-issue-panel')

    // The issue, then failures the page's own branches and the presenter see.
    await issueMarker()
    pd.bed.fake.answerOnce('cancelPairingCode', { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Internal error.' } } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-cancel-code'))
    })
    await waitFor(() => expect(toastsWith(en.common.coreErrors.unavailable)).toHaveLength(1))
    // The session ends on the Core: the memory is emptied, and nothing of the code was logged on the way.
    await act(async () => {
      pd.bed.core.end('SIGNED_OUT')
    })
    await pd.bed.flush()
    expect(codeMemoryOf(pd.mounted.queryClient).held).toBeNull()

    const text = logText(pd, consoleCalls)
    expect(text).not.toContain(MARKER_PASSWORD)
    expect(text).not.toContain(MARKER_CODE)
    expect(text).not.toContain(MARKER_QR)
    expect(text).not.toMatch(CREDENTIAL_FORM)
  })

  it('an issue answer outside the contract (five digits) shows no digits, and neither sink holds them', async () => {
    const pd = await openPairedDevices()
    const now = pd.bed.fake.clock.now()
    pd.bed.fake.answerOnce('issuePairingCode', {
      status: 201,
      body: { codeId: 'PCD-000777', code: '86120', qrPayload: 'DEMS-PAIR:1:86120', issuedAt: now, expiresAt: now + CODE_LIFETIME_MS, attemptsAllowed: 5 },
      violatesContract: true,
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-issue'))
    })
    await pd.bed.flush()
    await waitFor(() => expect(toastsWith(en.common.coreErrors.unavailable)).toHaveLength(1))
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(codeMemoryOf(pd.mounted.queryClient).held).toBeNull()
    const sinks = JSON.stringify({ web: webErrorSink.records(), live: pd.page.sink.records() })
    expect(sinks).not.toContain('86120')
    // The client did report the violation, by member name.
    expect(sinks).toContain('CONTRACT_VIOLATION')
  })

  it('a refused, a failed and a limited issue write no record that names the code', async () => {
    const pd = await openPairedDevices()
    pd.bed.fake.answerOnce('issuePairingCode', pd.bed.fake.example('issuePairingCode', 403, 'notPermitted'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-issue'))
    })
    await pd.bed.flush()
    pd.bed.fake.failOnce('issuePairingCode')
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-issue'))
    })
    await pd.bed.flush()
    await screen.findByTestId('pd-issue-error')
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-issue-retry'))
    })
    await waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))
    const sinks = JSON.stringify({ web: webErrorSink.records(), live: pd.page.sink.records() })
    expect(sinks).not.toContain(MARKER_CODE)
    expect(sinks).not.toContain(MARKER_QR)
  })
})
